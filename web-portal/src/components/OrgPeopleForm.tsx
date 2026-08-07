import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { updateAccount, getAccounts } from '../api';
import { Account } from '../types';
import { CARD, BTN_SECONDARY } from './ui';

/**
 * The people who belong to an organisation.
 *
 * Labelled by side, following the market: a selling company's people are Staff
 * (Shopify's term), a buying organisation's are Company users (Adobe's). They are
 * two different populations — internal people who run the store, and external
 * people who buy from it — so calling a customer's buyers "staff" in a merchant
 * portal would read as though they work for the seller.
 *
 * Only shown to the organisation ROOT. A root's id is the OrgID every
 * seller-scoped record is keyed by, which is why only it hands out invites.
 */
interface Props {
  account: Account;
  onChanged: (account: Account) => void;
}

const OrgPeopleForm: React.FC<Props> = ({ account, onChanged }) => {
  const [people, setPeople] = useState<Account[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isCompany = account.role === 'company';
  const noun = isCompany ? 'Staff' : 'Company users';
  const nounSingular = isCompany ? 'staff member' : 'company user';

  const load = async () => {
    setBusy(true);
    try {
      const all = await getAccounts();
      setPeople(all.filter((a: Account) => a.parentAccountId === account._id));
      setLoaded(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not load your organisation');
    } finally {
      setBusy(false);
    }
  };

  const patchOrg = async (org: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      const updated = await updateAccount(account._id, { org } as never);
      toast.success(success);
      onChanged(updated);
      if (loaded) await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  const code = account.orgInviteCode;

  return (
    <div className={`${CARD} p-5 sm:p-6 mt-6`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">{noun}</h2>
        <span className="text-xs text-gray-400">People who share this account&rsquo;s data</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {isCompany
          ? 'Colleagues who join with your invite code see the same products, orders and customers as you.'
          : 'Colleagues who join with your invite code buy from the same suppliers, and can be named as approvers on your orders.'}
      </p>

      <div className="border border-gray-200 rounded p-3 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-gray-500">Invite code</p>
            {code ? (
              <p className="font-mono text-sm text-gray-800 mt-1 break-all">{code}</p>
            ) : (
              <p className="text-sm text-gray-400 mt-1">None yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => patchOrg({ regenerateInviteCode: true }, code ? 'New invite code generated' : 'Invite code created')}
              disabled={busy}
              className={`${BTN_SECONDARY} text-xs disabled:opacity-50`}
            >
              {code ? 'Regenerate' : 'Create code'}
            </button>
            {code && (
              <button
                onClick={() => patchOrg({ revokeInviteCode: true }, 'Invite code revoked')}
                disabled={busy}
                className="text-xs px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Revoke
              </button>
            )}
          </div>
        </div>
        {/* Rotating or revoking never removes anyone: the link is the account's
            parent, not the code they happened to arrive with. */}
        <p className="text-xs text-gray-400 mt-2">
          Anyone with this code can join and see your data, so share it carefully. Regenerating or
          revoking it does not remove people who have already joined, and does not end a session
          they already have.
        </p>
      </div>

      {!loaded ? (
        <button onClick={load} disabled={busy} className={`${BTN_SECONDARY} text-xs disabled:opacity-50`}>
          {busy ? 'Loading...' : `Show ${noun.toLowerCase()}`}
        </button>
      ) : (people ?? []).length === 0 ? (
        <p className="text-sm text-gray-500">Nobody has joined yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
          {(people ?? []).map(p => (
            <li key={p._id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name || p.email}</p>
                <p className="text-xs text-gray-500 truncate">{p.email}</p>
              </div>
              <button
                onClick={() => {
                  if (!window.confirm(`Remove ${p.name || p.email} from your organisation? Their orders and approval decisions are kept.`)) return;
                  patchOrg({ removeAccountId: p._id }, 'Removed from your organisation');
                }}
                disabled={busy}
                className="text-xs text-red-600 hover:text-red-800 disabled:text-gray-400 shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Removal unlinks rather than deletes: a departing person may own quotes,
          orders and approval decisions that must stay attributable.

          The delay is real and must be stated. Access is carried by a signed
          token valid for up to 72 hours, and nothing revokes one mid-flight, so
          "removed" means "issues no new access" rather than "locked out now".
          Saying otherwise would have an owner believe an urgent removal took
          effect immediately. Immediate revocation is on the roadmap. */}
      <p className="text-xs text-gray-400 mt-3">
        Removing a {nounSingular} stops them signing in again, but a session they already
        have can last up to 72 hours. Their past orders and approvals stay on record.
      </p>
    </div>
  );
};

export default OrgPeopleForm;
