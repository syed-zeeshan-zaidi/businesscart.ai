import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import {
  getAccounts,
  getStatement,
  getStatements,
  sendStatement,
  Statement,
  PersistedStatement,
  SendStatementResponse,
} from '../api';
import { Account } from '../types';
import { PageHeader, Band, CARD, TH, TD, ROW_HOVER, Pill, Spinner } from '../components/ui';

interface Row {
  account: Account;
  loading: boolean;
  statement: Statement | null;
  error: string | null;
}

// First and last day of the current calendar month, RFC3339 strings.
function currentMonthRange(now: Date = new Date()): { from: string; to: string; label: string } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = new Date(year, month, 1, 0, 0, 0).toISOString();
  const to = new Date(year, month + 1, 1, 0, 0, 0).toISOString();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const label = `${monthName} ${year}`;
  return { from, to, label };
}

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, decodeJWT } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const decoded = token ? decodeJWT(token) : null;
  const role: string = decoded?.role || '';

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (role !== 'admin' && role !== 'company') {
      toast.error('Billing not available for this role');
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, role]);

  if (role === 'admin') return <AdminView />;
  if (role === 'company') return <CompanyView accountId={decoded?.id || ''} />;
  return null;
};

// ─────────────────────── Admin view ───────────────────────

const AdminView: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const period = currentMonthRange();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const accounts = await getAccounts();
        const companies = accounts.filter((a) => a.role === 'company');
        const initial: Row[] = companies.map((a) => ({ account: a, loading: true, statement: null, error: null }));
        setRows(initial);
        const enriched: Row[] = [];
        for (const r of initial) {
          try {
            const s = await getStatement(r.account._id, period.from, period.to);
            enriched.push({ ...r, loading: false, statement: s });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed';
            enriched.push({ ...r, loading: false, error: msg });
          }
        }
        setRows(enriched);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load companies';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period.from, period.to]);

  const totalProjected = rows.reduce((s, r) => s + (r.statement?.totalDue || 0), 0);

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <PageHeader
              title="Billing"
              subtitle={<>Period <strong className="text-gray-600">{period.label}</strong> · auto-derived from each company&rsquo;s order count this month.</>}
            />

            {/* Hero: projected platform total */}
            <section className={`relative overflow-hidden ${CARD} shadow-md p-5 sm:p-6 mt-6`}>
              <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-teal-600 to-emerald-500" aria-hidden="true" />
              <div className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-gray-400">Projected this month · all companies</div>
              <div className="text-4xl font-extrabold tracking-tight text-teal-700 tabular-nums mt-1.5">
                ${totalProjected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1.5 tabular-nums">{rows.length} compan{rows.length === 1 ? 'y' : 'ies'} billing this period</div>
            </section>

            <Band>Companies</Band>
            <div className={`${CARD} overflow-hidden`}>
              {loading ? (
                <div className="p-8 flex justify-center"><Spinner /></div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No companies found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={`${TH} text-left`}>Company</th>
                        <th className={`${TH} text-center`}>Orders</th>
                        <th className={`${TH} text-left`}>Tier</th>
                        <th className={`${TH} text-right`}>Monthly fee</th>
                        <th className={`${TH} text-right`}>Txn fees</th>
                        <th className={`${TH} text-right`}>Total due</th>
                        <th className={`${TH} text-right`}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const name = r.account.company?.name || r.account.name || r.account.email;
                        const s = r.statement;
                        return (
                          <tr key={r.account._id} className={ROW_HOVER}>
                            <td className={`${TD} font-semibold text-gray-800`}>{name}</td>
                            {r.loading ? (
                              <td colSpan={6} className={`${TD} text-center text-gray-400`}>Loading…</td>
                            ) : r.error ? (
                              <td colSpan={6} className={`${TD} text-center text-red-500`}>{r.error}</td>
                            ) : s ? (
                              <>
                                <td className={`${TD} text-center text-gray-700 tabular-nums`}>{s.orderCount}</td>
                                <td className={TD}><Pill tone="teal">{s.tier}</Pill></td>
                                <td className={`${TD} text-right text-gray-700 tabular-nums`}>${s.monthlyFee.toFixed(2)}</td>
                                <td className={`${TD} text-right text-gray-700 tabular-nums`}>${s.transactionFees.toFixed(2)}</td>
                                <td className={`${TD} text-right font-bold text-gray-900 tabular-nums`}>${s.totalDue.toFixed(2)}</td>
                                <td className={`${TD} text-right`}>
                                  <button onClick={() => setSelected(r)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800">Generate statement</button>
                                </td>
                              </>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {selected && selected.statement && (
        <SendStatementModal
          row={selected}
          period={period}
          onClose={() => setSelected(null)}
          onSent={() => {
            toast.success('Statement sent');
            setSelected(null);
          }}
        />
      )}
    </div>
  );
};

// ─────────────────────── Company view ───────────────────────

const CompanyView: React.FC<{ accountId: string }> = ({ accountId }) => {
  const period = currentMonthRange();
  const [current, setCurrent] = useState<Statement | null>(null);
  const [history, setHistory] = useState<PersistedStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [cur, hist] = await Promise.all([
          getStatement(accountId, period.from, period.to),
          getStatements(accountId),
        ]);
        setCurrent(cur);
        setHistory(hist);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load billing');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accountId, period.from, period.to]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <PageHeader
              title="Billing"
              subtitle="Your tier auto-applies based on monthly order volume. Statements are emailed by the BusinessCart team."
            />

            {loading ? (
              <div className="p-8 flex justify-center mt-6"><Spinner /></div>
            ) : (
              <>
                {/* Hero: this month's projected total */}
                <section className={`relative overflow-hidden ${CARD} shadow-md p-5 sm:p-6 mt-6`}>
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-teal-600 to-emerald-500" aria-hidden="true" />
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-gray-400">Projected for {period.label} · in progress</div>
                  <div className="text-4xl font-extrabold tracking-tight text-teal-700 tabular-nums mt-1.5">
                    ${(current?.totalDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {current && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5 text-[13px] text-gray-600 tabular-nums">
                      <Pill tone="teal">{current.tier}</Pill>
                      <span>{current.orderCount} order{current.orderCount === 1 ? '' : 's'} so far</span>
                      <span className="text-gray-300">·</span>
                      <span>${current.monthlyFee.toFixed(2)} monthly fee + ${current.transactionFees.toFixed(2)} txn fees</span>
                    </div>
                  )}
                </section>

                <Band>Sent statements</Band>
                <div className={`${CARD} overflow-hidden`}>
                  {history.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No statements sent yet. The first one appears here once your billing period closes.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className={`${TH} text-left`}>Period</th>
                            <th className={`${TH} text-left hidden sm:table-cell`}>Sent</th>
                            <th className={`${TH} text-center`}>Orders</th>
                            <th className={`${TH} text-left`}>Tier</th>
                            <th className={`${TH} text-right hidden md:table-cell`}>Monthly fee</th>
                            <th className={`${TH} text-right hidden md:table-cell`}>Txn fees</th>
                            <th className={`${TH} text-right`}>Total billed</th>
                            <th className={`${TH} text-left`}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((s) => (
                            <tr key={s.id} className={ROW_HOVER}>
                              <td className={`${TD} font-semibold text-gray-800`}>{s.periodLabel || new Date(s.periodStart).toLocaleDateString()}</td>
                              <td className={`${TD} text-gray-600 hidden sm:table-cell tabular-nums`}>{new Date(s.sentAt).toLocaleDateString()}</td>
                              <td className={`${TD} text-center text-gray-700 tabular-nums`}>{s.orderCount}</td>
                              <td className={TD}><Pill tone="teal">{s.tier}</Pill></td>
                              <td className={`${TD} text-right text-gray-700 hidden md:table-cell tabular-nums`}>${s.monthlyFee.toFixed(2)}</td>
                              <td className={`${TD} text-right text-gray-700 hidden md:table-cell tabular-nums`}>${s.transactionFees.toFixed(2)}</td>
                              <td className={`${TD} text-right font-bold text-gray-900 tabular-nums`}>${s.totalDue.toFixed(2)}</td>
                              <td className={TD}>{s.paidAt ? <Pill tone="green">Paid</Pill> : <Pill tone="amber">Open</Pill>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

// ─────────────────────── Send modal (admin only) ───────────────────────

interface ModalProps {
  row: Row;
  period: { from: string; to: string; label: string };
  onClose: () => void;
  onSent: () => void;
}

const SendStatementModal: React.FC<ModalProps> = ({ row, period, onClose, onSent }) => {
  const account = row.account;
  const stmt = row.statement!;
  const defaultRecipient = account.email || '';
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipient);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [preview, setPreview] = useState<SendStatementResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await sendStatement({
        sellerId: account._id,
        from: period.from,
        to: period.to,
        recipientEmail,
        companyName: account.company?.name || account.name || account.email,
        periodLabel: period.label,
        paymentInstructions,
        dryRun: true,
      });
      setPreview(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!preview) {
      toast.error('Click Preview first');
      return;
    }
    if (!confirm(`Send statement to ${recipientEmail} for $${stmt.totalDue.toFixed(2)}?`)) return;
    setSending(true);
    try {
      await sendStatement({
        sellerId: account._id,
        from: period.from,
        to: period.to,
        recipientEmail,
        companyName: account.company?.name || account.name || account.email,
        periodLabel: period.label,
        paymentInstructions,
        dryRun: false,
      });
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Send Statement</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Recipient email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Payment instructions (max 2000 chars)
            </label>
            <textarea
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value.slice(0, 2000))}
              placeholder="e.g., Pay via ACH to ... or by Stripe link below."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>

          <div className="bg-gray-50 rounded-md p-3 text-sm">
            <p className="font-semibold text-gray-700 mb-1">Statement summary</p>
            <p className="text-gray-600">Tier: <strong>{stmt.tier}</strong></p>
            <p className="text-gray-600">Orders: <strong>{stmt.orderCount}</strong></p>
            <p className="text-gray-600">Gross revenue: <strong>${stmt.totalGrandTotal.toFixed(2)}</strong></p>
            {/* Only when refunds exist. Without these two lines the transaction fee
                does not reconcile against gross revenue and there is nothing on the
                statement explaining the difference. */}
            {(stmt.totalRefunded ?? 0) > 0 && (
              <>
                <p className="text-gray-600">Refunds issued: <strong className="text-red-700">-${(stmt.totalRefunded ?? 0).toFixed(2)}</strong></p>
                <p className="text-gray-600">Net revenue: <strong>${(stmt.totalGrandTotal - (stmt.totalRefunded ?? 0)).toFixed(2)}</strong></p>
              </>
            )}
            <p className="text-gray-600">Monthly fee: <strong>${stmt.monthlyFee.toFixed(2)}</strong></p>
            <p className="text-gray-600">Transaction fees: <strong>${stmt.transactionFees.toFixed(2)}</strong></p>
            <p className="text-gray-900 mt-1">Total due: <strong className="text-teal-700">${stmt.totalDue.toFixed(2)}</strong></p>
          </div>

          {!preview && (
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="w-full px-4 py-2 text-sm font-medium rounded bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {previewing ? 'Generating preview…' : 'Preview email'}
            </button>
          )}

          {preview && (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email preview (HTML)</p>
                <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                  <div
                    className="p-2 text-sm"
                    dangerouslySetInnerHTML={{ __html: preview.htmlBody || '' }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {sending ? 'Sending…' : `Send to ${recipientEmail}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Billing;
