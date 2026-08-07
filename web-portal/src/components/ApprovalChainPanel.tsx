import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { patchQuote } from '../api';
import { Quote } from '../types';

/**
 * A quote's approval chain, and the decision controls for whoever is looking at
 * it.
 *
 * ONE implementation for both sides (Roadmap #21d). The buyer's page and the
 * seller's page render the same chain, and a seller's own sign-off level now sits
 * in the same list as the buyer's — so two copies would drift the moment either
 * side changed, and the audit trail is exactly the thing that must read the same
 * to everyone.
 *
 * Which levels a viewer may DECIDE still differs, and that is the `userRole`
 * prop: a level is cleared inside the organisation that owns it. The backend
 * enforces the same rule and is the authority; this only keeps the UI honest.
 */
interface Props {
  quote: Quote;
  currentUserId: string;
  userRole: string;
  onDecided: (quote: Quote) => void;
}

const sideOf = (step?: { side?: string }) => (step?.side === 'seller' ? 'seller' : 'buyer');

const ApprovalChainPanel: React.FC<Props> = ({ quote, currentUserId, userRole, onDecided }) => {
  const [note, setNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  // Only quotes the gate actually fired for. A policy is denormalised onto every
  // eligible quote, so chain presence alone would show a bogus 'Level 1 pending'
  // card on ordinary under-threshold orders.
  const chain = quote.approvalRequired ? quote.approvalChain || [] : [];
  const decisions = quote.approvalDecisions ?? [];
  // A recorded decision must never be hidden, even if the chain is somehow gone.
  // The whole point of the record is that it outlives the chain.
  if (chain.length === 0 && decisions.length === 0) return null;

  const stage = quote.approvalStage ?? 0;
  const awaitingApproval = quote.status === 'pending_approval';
  const currentStep = awaitingApproval ? chain[stage] : undefined;
  const isCurrentApprover = !!currentStep?.approvers?.some(a => a.accountId === currentUserId);
  const currentSide = sideOf(currentStep);
  const roleMatchesSide = currentSide === 'seller' ? userRole === 'company' : userRole === 'customer';
  const canDecide = isCurrentApprover && roleMatchesSide;
  const approvalExpired = !!quote.approvalExpiresAt && new Date(quote.approvalExpiresAt) < new Date();

  const decide = async (decision: 'approve' | 'reject') => {
    setDeciding(true);
    try {
      const updated = await patchQuote(quote.id, 'approvalDecision', { decision, note: note.trim() || undefined });
      onDecided(updated);
      setNote('');
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected');
    } catch (err: any) {
      // 409 means another approver on this level decided first; the message from
      // the server already says to refresh, so surface it verbatim.
      toast.error(err.response?.data?.message || `Failed to ${decision} this order.`);
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Order Approval</h2>
        {awaitingApproval && quote.approvalExpiresAt && (
          <span className={`text-xs ${approvalExpired ? 'text-red-600' : 'text-gray-500'}`}>
            {approvalExpired
              ? 'Approval window expired, this order must be resubmitted'
              : `Respond by ${new Date(quote.approvalExpiresAt).toLocaleString()}`}
          </span>
        )}
      </div>

      <ol className="space-y-3">
        {chain.map((step, idx) => {
          const done = step.status === 'approved';
          const rejected = step.status === 'rejected';
          // Levels the seller overrode because the approver never responded.
          // Without this case they render as "Pending" on an order that is
          // already approved and payable, telling the buyer the opposite of
          // what happened.
          const released = step.status === 'released';
          const active = awaitingApproval && idx === stage;
          const tone = rejected ? 'border-red-300 bg-red-50' : done ? 'border-green-300 bg-green-50' : released ? 'border-amber-300 bg-amber-50' : active ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-gray-50';
          return (
            <li key={idx} className={`border rounded p-3 ${tone}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">
                  Level {idx + 1}{step.name ? ` - ${step.name}` : ''}
                  {/* Which organisation owns the level. Without it the two chains
                      read as one long list of strangers, and neither side can tell
                      whether they are waiting on their own people or the other's. */}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {sideOf(step) === 'seller' ? 'seller sign-off' : 'buyer sign-off'}
                  </span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {rejected ? 'Rejected' : done ? 'Approved' : released ? 'Released by seller' : active ? 'Awaiting decision' : 'Pending'}
                </span>
              </div>
              {/* The other organisation's levels come back with no approvers: who
                  signs off inside a business, and what they wrote about it, is not
                  the counterparty's to see. Existence and status still are. */}
              <p className="text-xs text-gray-600 mt-1">
                {(step.approvers ?? []).length === 0
                  ? `Handled inside the ${sideOf(step) === 'seller' ? 'selling' : 'buying'} organisation`
                  : (step.approvers ?? []).map(a => a.name || a.email || a.accountId).join(', ')}
                {(step.approvers ?? []).length > 1 && !done && !rejected && ' (any one can approve)'}
              </p>
              {/* Who / when / note - the audit trail competitors are criticised for lacking. */}
              {step.decidedBy && step.decidedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  {rejected ? 'Rejected' : 'Approved'} by {step.decidedBy.name || step.decidedBy.email} on {new Date(step.decidedAt).toLocaleString()}
                  {step.note ? ` - "${step.note}"` : ''}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/* The permanent record, distinct from the chain above.
          The chain is live state and is rebuilt whenever the gate re-fires, so it
          only ever shows the CURRENT run. This is every decision ever made on the
          quote, including ones from before a withdraw-and-reinstate that the chain
          no longer reflects, and every level a seller override skipped. Collapsed
          by default because on a simple quote it just restates the chain; native
          <details> so it costs no state and no JS. */}
      {decisions.length > 0 && (
        <details className="mt-4 border-t pt-4">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">
            Decision record ({decisions.length})
          </summary>
          <ol className="mt-3 space-y-2">
            {decisions.map((d, i) => (
              <li key={i} className="text-xs text-gray-600 border-l-2 border-gray-200 pl-3">
                <span className="font-medium text-gray-800">
                  Level {d.level}
                  {d.stepName ? ` (${d.stepName})` : ''}
                  {' '}
                  {d.decision === 'released' ? 'released without approval' : d.decision}
                </span>
                {' by '}
                {d.by ? (d.by.name || d.by.email || d.by.accountId) : `the ${sideOf(d) === 'seller' ? 'selling' : 'buying'} organisation`}
                {' on '}{new Date(d.at).toLocaleString()}
                {typeof d.grandTotal === 'number' && d.grandTotal > 0 && (
                  <span className="text-gray-500"> at ${d.grandTotal.toFixed(2)}</span>
                )}
                {d.note ? <span className="block text-gray-500 mt-0.5">&ldquo;{d.note}&rdquo;</span> : null}
              </li>
            ))}
          </ol>
        </details>
      )}

      {awaitingApproval && (
        <div className="mt-4 border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={!canDecide || approvalExpired || deciding}
            className="w-full p-2 border rounded mb-3 disabled:bg-gray-100"
            placeholder="Recorded against your decision"
          />
          {/* Platform rule: role-gated controls stay visible but disabled with
              a tooltip, never removed from the DOM. */}
          <div
            className="flex gap-3"
            title={
              approvalExpired
                ? 'This approval request has expired; the buyer must resubmit the order.'
                : canDecide
                  ? ''
                  : isCurrentApprover
                    ? `This level is decided inside the ${currentSide === 'seller' ? 'selling' : 'buying'} organisation.`
                    : 'Only an approver for the current level can decide this order.'
            }
          >
            <button
              onClick={() => decide('approve')}
              disabled={!canDecide || approvalExpired || deciding}
              className="px-6 py-2 rounded-md bg-teal-700 text-white hover:bg-teal-800 transition disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {deciding ? 'Saving...' : 'Approve'}
            </button>
            <button
              onClick={() => decide('reject')}
              disabled={!canDecide || approvalExpired || deciding}
              className="px-6 py-2 rounded-md border border-red-300 text-red-700 hover:bg-red-50 transition disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalChainPanel;
