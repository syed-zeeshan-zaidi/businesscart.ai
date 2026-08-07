import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { updateAccount } from '../api';
import { Account, Approver, ApprovalPolicy, ApprovalScope, ApprovalStepConfig } from '../types';
import { CARD, BTN_PRIMARY, BTN_SECONDARY } from './ui';

/**
 * An organisation's OWN order-approval structure.
 *
 * Shown on the account holder's own page and saved to their own account, because
 * approval governance belongs to the organisation it governs. A seller must not
 * configure who signs off inside their customer's business, and a buyer must not
 * configure their supplier's — each side manages itself and the portal simply
 * shows the right one.
 *
 * Both sides use this same form (Roadmap #21d). A selling organisation's levels
 * run first, before the quote is put to the buyer at all; the buyer's run after.
 *
 * Never rendered for a b2c storefront shopper: they are a person, not an
 * organisation, and the backend refuses the field for that role anyway.
 */
interface Props {
  account: Account;
  onSaved: (account: Account) => void;
}

// A level as this form works with it. `approvers` is optional on the wire because
// a READ redacts the other organisation's levels, but a policy you are EDITING is
// always your own, so every level genuinely has a list even when it is empty.
type EditableStep = ApprovalStepConfig & { approvers: Approver[] };

const ApprovalPolicyForm: React.FC<Props> = ({ account, onSaved }) => {
  // A selling organisation gates what LEAVES it (a quote a rep is about to send);
  // a buying one gates what it commits to. Same structure, opposite direction, so
  // only the wording differs.
  const isSeller = account.role === 'company';
  const existing = account.governance?.approval;
  const [policy, setPolicy] = useState<ApprovalPolicy>({
    scope: existing?.scope ?? 'none',
    threshold: existing?.threshold,
    quantityThreshold: existing?.quantityThreshold,
    validityHours: existing?.validityHours,
    chain: existing?.chain ?? [],
  });
  const [saving, setSaving] = useState(false);

  // Normalised once here rather than guarded at each use. On READ the backend
  // omits approvers from the other organisation's levels, so the field is
  // optional on the wire; a policy you are EDITING is always your own, so every
  // level genuinely has a list, even if empty.
  const chain: EditableStep[] = (policy.chain ?? []).map(s => ({ ...s, approvers: s.approvers ?? [] }));
  const emptyLevels = chain.filter(s => !s.approvers.length).length;
  const armed =
    chain.length > 0 &&
    policy.scope !== 'none' &&
    ((policy.threshold ?? 0) > 0 || (policy.quantityThreshold ?? 0) > 0);

  const setChain = (next: EditableStep[]) => setPolicy(p => ({ ...p, chain: next }));

  const num = (v: string) => (v === '' ? undefined : parseFloat(v));

  // Approvers are named by EMAIL. There is deliberately no picker: a customer's
  // GET /accounts returns only themselves, so the businesses they buy from never
  // have their customer list exposed. The backend resolves each address to a real
  // account, and rejects one that does not exist.
  const [draftEmail, setDraftEmail] = useState<Record<number, string>>({});

  const addApprover = (idx: number) => {
    const email = (draftEmail[idx] ?? '').trim().toLowerCase();
    if (!email) return;
    if (email === account.email.toLowerCase()) {
      toast.error('You cannot approve your own orders.');
      return;
    }
    if (chain[idx].approvers.some(a => a.email?.toLowerCase() === email)) return;
    setChain(chain.map((step, i) =>
      i === idx ? { ...step, approvers: [...step.approvers, { accountId: '', email }] } : step));
    setDraftEmail(d => ({ ...d, [idx]: '' }));
  };

  const removeApprover = (idx: number, email?: string) =>
    setChain(chain.map((step, i) =>
      i === idx ? { ...step, approvers: step.approvers.filter(a => a.email !== email) } : step));

  const handleSave = async () => {
    if (emptyLevels > 0) return;
    setSaving(true);
    try {
      const updated = await updateAccount(account._id, { governance: { approval: policy } });
      toast.success('Approval structure saved');
      onSaved(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not save your approval structure');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${CARD} p-5 sm:p-6 mt-6`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">Order Approval</h2>
        <span className="text-xs text-gray-400">Your organisation&rsquo;s own sign-off rules</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {isSeller
          ? 'Hold large quotes for internal sign-off before a rep can send them to the customer. Only your organisation can change this, and your customers never see it.'
          : 'Hold your own large orders for sign-off before they can be paid. Only your organisation can change this \u2014 the businesses you buy from cannot see or edit it.'}
      </p>

      {emptyLevels > 0 ? (
        <div className="text-xs rounded border px-3 py-2 mb-4 bg-red-50 text-red-700 border-red-200">
          {emptyLevels} level(s) have no approver and would never clear. Add someone or remove the level.
        </div>
      ) : armed ? (
        <div className="text-xs rounded border px-3 py-2 mb-4 bg-green-50 text-green-700 border-green-200">
          {isSeller ? 'Quotes' : 'Orders'}
          {(policy.threshold ?? 0) > 0 ? ` at or above $${policy.threshold}` : ''}
          {(policy.threshold ?? 0) > 0 && (policy.quantityThreshold ?? 0) > 0 ? ' or' : ''}
          {(policy.quantityThreshold ?? 0) > 0 ? ` of ${policy.quantityThreshold}+ units` : ''}
          {' '}need {chain.length} level(s) of approval.
        </div>
      ) : chain.length > 0 ? (
        <div className="text-xs rounded border px-3 py-2 mb-4 bg-amber-50 text-amber-700 border-amber-200">
          Approvers are set, but nothing will be held until you choose what this applies to and a threshold.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Approval At or Above ($)</label>
          <input type="number" step="0.01" min="0" value={policy.threshold ?? ''} placeholder="0 = no approval"
            onChange={e => setPolicy(p => ({ ...p, threshold: num(e.target.value) }))}
            className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Approval At or Above (units)</label>
          <input type="number" min="0" value={policy.quantityThreshold ?? ''} placeholder="0 = no approval"
            onChange={e => setPolicy(p => ({ ...p, quantityThreshold: num(e.target.value) }))}
            className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Applies To</label>
          <select value={policy.scope ?? 'none'} className="w-full p-2 border rounded"
            onChange={e => setPolicy(p => ({ ...p, scope: e.target.value as ApprovalScope }))}>
            <option value="none">No approval</option>
            {/* A seller only ever gets a decision point on a NEGOTIABLE quote:
                self-serve checkout is created and paid by the buyer with no
                seller step in between, so a "checkout" scope here would be a
                control that looks armed and could never fire. The backend
                refuses those values for a selling account for the same reason. */}
            {!isSeller && <option value="standard">Checkout only</option>}
            <option value="negotiable">Quotes only</option>
            {!isSeller && <option value="both">Checkout and quotes</option>}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium">Approval Valid For (hours)</label>
        <input type="number" min="1" value={policy.validityHours ?? ''} placeholder="72 (default)"
          onChange={e => setPolicy(p => ({ ...p, validityHours: num(e.target.value) }))}
          className="w-full p-2 border rounded" />
        <p className="text-xs text-gray-400 mt-1">
          How long a request may sit unanswered. Once approved, the order carries on as normal.
        </p>
      </div>

      <div className="space-y-3 mt-4">
        {chain.map((step, idx) => (
          <div key={idx} className="border border-gray-200 rounded p-3 space-y-2 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 shrink-0">Level {idx + 1}</span>
              <input value={step.name ?? ''} placeholder="Label, e.g. Manager or Finance"
                onChange={e => setChain(chain.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                className="flex-1 p-1.5 border rounded text-sm" />
              <button type="button" onClick={() => setChain(chain.filter((_, i) => i !== idx))}
                className="text-red-600 hover:text-red-800 text-xs">Remove</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {step.approvers.map(a => (
                <span key={a.email} className="text-xs px-2 py-1 rounded border bg-teal-600 text-white border-teal-600 inline-flex items-center gap-1">
                  {a.name || a.email}
                  <button type="button" onClick={() => removeApprover(idx, a.email)}
                    aria-label={`Remove ${a.email}`} className="hover:text-teal-200">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={draftEmail[idx] ?? ''}
                onChange={e => setDraftEmail(d => ({ ...d, [idx]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addApprover(idx); } }}
                placeholder="Approver's email address"
                className="flex-1 p-1.5 border rounded text-sm"
              />
              <button type="button" onClick={() => addApprover(idx)} className={`${BTN_SECONDARY} text-xs`}>Add</button>
            </div>
            {step.approvers.length > 1 && (
              <p className="text-xs text-gray-500">
                Any one of these {step.approvers.length} can approve, so an order keeps moving if someone is away.
              </p>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setChain([...chain, { name: '', approvers: [] }])}
          className={`${BTN_SECONDARY} text-xs`}>+ Add approval level</button>
      </div>

      <div className="flex justify-end mt-5">
        <button onClick={handleSave} disabled={saving || emptyLevels > 0}
          title={emptyLevels > 0 ? 'Every level needs at least one approver.' : ''}
          className={`${BTN_PRIMARY} disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}>
          {saving ? 'Saving...' : 'Save approval structure'}
        </button>
      </div>
    </div>
  );
};

export default ApprovalPolicyForm;
