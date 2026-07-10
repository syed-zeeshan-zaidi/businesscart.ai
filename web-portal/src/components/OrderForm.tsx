// src/components/OrderForm.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getOrders, deleteOrder, updateOrder, exportOrders, requestOrderReview } from '../api';
import { Order } from '../types';
import Navbar from './Navbar';
import { TrashIcon, MagnifyingGlassIcon, PencilIcon, PrinterIcon, ArrowPathIcon, ArrowDownTrayIcon, XMarkIcon, StarIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';

/* ------------------------------------------------------------------ */
/*  Status badge styling                                              */
/* ------------------------------------------------------------------ */
const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
const CARRIER_OPTIONS = ['ups', 'fedex', 'usps', 'dhl', 'other'] as const;
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-amber-100 text-amber-700',
  refunded: 'bg-purple-100 text-purple-700',
};
const PAYMENT_LABELS: Record<string, string> = {
  amazon_pay: 'Amazon Pay',
  stripe_pay: 'Credit / Debit Card',
  google_pay: 'Google Pay',
  credit_card: 'Credit Card',
  purchase_order: 'Purchase Order',
  'pickup_&_pay': 'Pay at Pickup',
  deliver_pay: 'Pay on Delivery',
};
const DELIVERY_LABELS: Record<string, string> = {
  shipping_out: 'Ship to address',
  pickup: 'Pick up at store',
  dropoff: 'Local delivery',
};
const labelFor = (map: Record<string, string>, key?: string) =>
  (key && map[key]) || (key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';

const txnInfo = (id?: string): { label: string; url: string | null } => {
  if (!id) return { label: 'Payment reference', url: null };
  if (id.startsWith('pi_')) return { label: 'Stripe payment intent', url: `https://dashboard.stripe.com/payments/${id}` };
  if (id.startsWith('ch_')) return { label: 'Stripe charge', url: `https://dashboard.stripe.com/payments/${id}` };
  return { label: 'Payment reference', url: null };
};

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const CACHE_KEY = 'orders_cache';
const CACHE_DURATION = 30 * 60_000; // 30 min in ms
const ORDERS_PER_PAGE = 10;

/* ------------------------------------------------------------------ */
/*  Helper to extract current user from JWT                           */
/* ------------------------------------------------------------------ */
const getCurrentUser = () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.user ?? null;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
const OrderForm = () => {
  /* ------------------------ State ------------------------ */
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editCarrier, setEditCarrier] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Refund modal state (separate from edit modal — refund is a discrete event).
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);
  const [refundStripeID, setRefundStripeID] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundItemQtys, setRefundItemQtys] = useState<Record<string, string>>({});

  // Export modal state: matches customer export pattern, with format selector for Google/Bing PPC.
  const [exportOpen, setExportOpen] = useState(false);
  const exportToday = new Date();
  const exportMonthAgo = new Date(exportToday.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmtExportDate = (d: Date) => d.toISOString().slice(0, 10);
  const [exportFrom, setExportFrom] = useState(fmtExportDate(exportMonthAgo));
  const [exportTo, setExportTo] = useState(fmtExportDate(exportToday));
  const [exportFormat, setExportFormat] = useState<'generic' | 'google' | 'bing'>('generic');
  const [exportConversionName, setExportConversionName] = useState('Purchase');
  const [exportRunning, setExportRunning] = useState(false);

  const handleExport = useCallback(async () => {
    if (exportRunning) return;
    setExportRunning(true);
    try {
      // Parse date input as LOCAL time (no 'Z'), so a user in PST picking
      // "May 3 → May 3" gets all of May 3 PST, not May 3 UTC.
      const fromIso = new Date(exportFrom + 'T00:00:00').toISOString();
      const toIso = new Date(exportTo + 'T23:59:59').toISOString();
      await exportOrders(fromIso, toIso, exportFormat, exportConversionName);
      toast.success('Orders CSV downloaded');
      setExportOpen(false);
    } catch {
      toast.error('Export failed');
    } finally {
      setExportRunning(false);
    }
  }, [exportRunning, exportFrom, exportTo, exportFormat, exportConversionName]);

  /* ------------------------ Derived ------------------------ */
  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentRole   = currentUser?.role ?? '';
  const companyId     = currentRole === 'company' ? currentUser?.id : undefined;
  const canEdit       = currentRole === 'admin' || currentRole === 'company';
  const isPartner     = currentRole === 'partner';

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) => {
        const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = !statusFilter || o.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [orders, searchQuery, statusFilter]
  );

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = useMemo(
    () =>
      filteredOrders.slice(
        (currentPage - 1) * ORDERS_PER_PAGE,
        currentPage * ORDERS_PER_PAGE
      ),
    [filteredOrders, currentPage]
  );

  /* ------------------------ Effects ------------------------ */
  useEffect(() => {
    const load = async () => {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          const sorted = [...(data ?? [])].sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(sorted);
          return;
        }
      }
      await fetchOrders();
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------ Handlers ------------------------ */
  const invalidateCache = useCallback(
    () => localStorage.removeItem(CACHE_KEY),
    []
  );

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getOrders(companyId);
      const sorted = [...(data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: sorted, timestamp: Date.now() })
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Error fetching orders'
      );
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const openDeleteConfirm = useCallback((id: string) => {
    setOrderToDelete(id);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!orderToDelete) return;
    setIsLoading(true);
    try {
      await deleteOrder(orderToDelete);
      toast.success('Order deleted successfully');
      invalidateCache();
      await fetchOrders();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Failed to delete order'
      );
    } finally {
      setIsDeleteConfirmOpen(false);
      setOrderToDelete(null);
      setIsLoading(false);
    }
  }, [orderToDelete, fetchOrders, invalidateCache]);

  const openEditModal = useCallback((order: Order) => {
    setEditingOrder(order);
    setEditStatus(order.status || 'pending');
    setEditCarrier(order.trackingCarrier || '');
    setEditTrackingNumber(order.trackingNumber || '');
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingOrder(null);
    setEditStatus('');
    setEditCarrier('');
    setEditTrackingNumber('');
  }, []);

  // ----- Refund handlers -----

  const totalRefunded = useCallback((order: Order) =>
    (order.refunds || []).reduce((sum, r) => sum + (r.amount || 0), 0), []);

  const netTotal = useCallback((order: Order) =>
    Math.max(0, order.grandTotal - totalRefunded(order)), [totalRefunded]);

  // Sum of qty already returned for each product across all prior refunds.
  // Used to cap the per-product return-qty input in the refund modal so an
  // admin can't accidentally over-record returns (e.g., 4+3 of 6 ordered).
  const alreadyReturnedByProduct = useCallback((order: Order): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const r of order.refunds || []) {
      for (const a of r.itemAdjustments || []) {
        map[a.productID] = (map[a.productID] || 0) + a.quantity;
      }
    }
    return map;
  }, []);

  const openRefundModal = useCallback((order: Order) => {
    setRefundingOrder(order);
    // Default refund amount: remaining balance (full refund of what's left).
    const remaining = Math.max(0, order.grandTotal - totalRefunded(order));
    setRefundAmount(remaining > 0 ? remaining.toFixed(2) : '');
    setRefundStripeID('');
    setRefundReason('');
    setRefundItemQtys({});
  }, [totalRefunded]);

  const closeRefundModal = useCallback(() => {
    setRefundingOrder(null);
    setRefundStripeID('');
    setRefundAmount('');
    setRefundReason('');
    setRefundItemQtys({});
  }, []);

  const handleSubmitRefund = useCallback(async () => {
    if (!refundingOrder) return;
    const amount = parseFloat(refundAmount);
    if (!refundStripeID.trim()) {
      toast.error('Stripe refund ID is required');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('Refund amount must be greater than 0');
      return;
    }
    const remaining = refundingOrder.grandTotal - totalRefunded(refundingOrder);
    if (amount > remaining + 0.01) {
      toast.error(`Refund cannot exceed remaining $${remaining.toFixed(2)}`);
      return;
    }
    // Build item adjustments from filled qty inputs (optional — admin may
    // record a money-only refund without itemizing).
    const priorReturned = alreadyReturnedByProduct(refundingOrder);
    for (const it of refundingOrder.items) {
      const qty = parseInt(refundItemQtys[it.productId] || '0', 10);
      if (!qty || qty <= 0) continue;
      const remainingForItem = it.quantity - (priorReturned[it.productId] || 0);
      if (qty > remainingForItem) {
        toast.error(`Cannot return ${qty}x ${it.name} (only ${remainingForItem} left to return)`);
        return;
      }
    }
    const itemAdjustments = refundingOrder.items
      .map((it) => {
        const qty = parseInt(refundItemQtys[it.productId] || '0', 10);
        if (!qty || qty <= 0) return null;
        const unit = it.discountedPrice ?? it.price ?? 0;
        return {
          productID: it.productId,
          quantity: qty,
          lineAmount: parseFloat((unit * qty).toFixed(2)),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    setIsLoading(true);
    try {
      const updated = await updateOrder(refundingOrder.id, {
        stripeRefundID: refundStripeID.trim(),
        refundAmount: amount,
        refundReason: refundReason.trim() || undefined,
        refundItemAdjustments: itemAdjustments.length > 0 ? itemAdjustments : undefined,
      });
      toast.success('Refund added and notifications sent');
      invalidateCache();
      await fetchOrders();
      // Refresh edit-modal state with the updated order so the Refunds list,
      // Net Total, Add-Refund-button gating, and editStatus all reflect the
      // backend's new state (including any auto-transition to "refunded").
      setEditingOrder(updated);
      setEditStatus(updated.status);
      setEditCarrier(updated.trackingCarrier || '');
      setEditTrackingNumber(updated.trackingNumber || '');
      closeRefundModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record refund');
    } finally {
      setIsLoading(false);
    }
  }, [refundingOrder, refundStripeID, refundAmount, refundReason, refundItemQtys, totalRefunded, alreadyReturnedByProduct, fetchOrders, invalidateCache, closeRefundModal]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingOrder) return;
    setIsLoading(true);
    try {
      await updateOrder(editingOrder.id, {
        status: editStatus,
        trackingCarrier: editCarrier || undefined,
        trackingNumber: editTrackingNumber || undefined,
      });
      toast.success('Order updated');
      invalidateCache();
      await fetchOrders();
      closeEditModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update order');
    } finally {
      setIsLoading(false);
    }
  }, [editingOrder, editStatus, editCarrier, editTrackingNumber, fetchOrders, invalidateCache, closeEditModal]);

  // Ask the customer for a review. Enabled only once the order is shipped or
  // delivered (see button gating below). Customer replies by email; the review
  // is transcribed into the product via the catalog admin (manual moderation).
  const handleRequestReview = useCallback(async (orderId: string) => {
    try {
      const updated = await requestOrderReview(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, reviewRequestedAt: updated.reviewRequestedAt } : o)));
      setEditingOrder((prev) => (prev && prev.id === orderId ? { ...prev, reviewRequestedAt: updated.reviewRequestedAt } : prev));
      toast.success('Review request sent');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send review request');
    }
  }, []);

  /* ------------------------ Render ------------------------ */
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Orders</h1>
        </header>

        {/* Search + status filter */}
        <section className="mb-6 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1 block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search orders by ID..."
              className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </label>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:w-48 sm:flex-none"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { invalidateCache(); fetchOrders(); }}
              disabled={isLoading}
              className="shrink-0 p-2 min-w-[44px] min-h-[44px] border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center"
              aria-label="Refresh orders"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              disabled={isPartner}
              className={`shrink-0 p-2 min-w-[44px] min-h-[44px] border border-gray-300 rounded-md text-gray-700 flex items-center justify-center gap-1.5 px-3 ${isPartner ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              aria-label="Export orders"
              title={isPartner ? 'Export is not available for partner accounts' : 'Export orders'}
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-medium">Export</span>
            </button>
          </div>
        </section>

        {/* Table */}
        <section className="bg-white rounded-lg shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <span className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : paginatedOrders.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No orders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700 max-w-[200px] truncate" title={order.customerEmail || order.accountId}>
                        {order.customerEmail || `#${order.accountId.slice(-6).toUpperCase()}`}
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.items?.length || 0}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                          {order.status || 'pending'}
                        </span>
                        {order.trackingNumber && (
                          <div className="mt-1 text-xs text-gray-500 truncate max-w-[160px]" title={[order.trackingCarrier?.toUpperCase(), order.trackingNumber].filter(Boolean).join(' ')}>
                            {[order.trackingCarrier?.toUpperCase(), order.trackingNumber].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {isPartner ? 'N/A' : `$${order.grandTotal.toFixed(2)}`}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(order)}
                          disabled={!canEdit}
                          className={`rounded p-2 mr-1 ${canEdit ? 'text-yellow-600 hover:bg-yellow-50' : 'text-yellow-600 opacity-50 cursor-not-allowed'}`}
                          aria-label={`Edit order ${order.id}`}
                          title={canEdit ? 'Edit order' : 'Editing orders is not available for partner accounts'}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        {(() => {
                          const reviewEligible = order.status === 'shipped' || order.status === 'delivered';
                          const requested = !!order.reviewRequestedAt;
                          const enabled = canEdit && reviewEligible && !!order.customerEmail;
                          const title = !canEdit
                            ? 'Requesting reviews is not available for partner accounts'
                            : !order.customerEmail
                              ? 'No customer email on this order'
                              : !reviewEligible
                                ? 'Available once the order is shipped or delivered'
                                : requested
                                  ? `Review requested ${new Date(order.reviewRequestedAt!).toLocaleDateString()} — click to resend`
                                  : 'Request a review from the customer';
                          return (
                            <button
                              onClick={() => handleRequestReview(order.id)}
                              disabled={!enabled}
                              className={`rounded p-2 mr-1 ${enabled ? (requested ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50') : 'text-amber-600 opacity-50 cursor-not-allowed'}`}
                              aria-label={`Request review for order ${order.id}`}
                              title={title}
                            >
                              <StarIcon className="h-5 w-5" />
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => console.log('Print order', order.id)}
                          disabled={isPartner}
                          className={`rounded p-2 mr-1 ${isPartner ? 'text-teal-700 opacity-50 cursor-not-allowed' : 'text-teal-700 hover:bg-teal-50'}`}
                          aria-label={`Print order ${order.id}`}
                          title={isPartner ? 'Printing orders is not available for partner accounts' : 'Print order'}
                        >
                          <PrinterIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(order.id)}
                          disabled={!canEdit}
                          className={`rounded p-2 ${canEdit ? 'text-red-600 hover:bg-red-50' : 'text-red-600 opacity-50 cursor-not-allowed'}`}
                          aria-label={`Delete order ${order.id}`}
                          title={canEdit ? 'Delete order' : 'Deleting orders is not available for partner accounts'}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Record count & Pagination */}
        {filteredOrders.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {((currentPage - 1) * ORDERS_PER_PAGE) + 1}-{Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
          </div>
        )}
        {totalPages > 1 && (
          <nav className="mt-2 flex justify-end space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm font-medium ${
                  currentPage === i + 1
                    ? 'bg-teal-700 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        )}
      </main>

      {/* Edit Order Modal — full order detail + update controls */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Order #{editingOrder.id.slice(-6).toUpperCase()}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Placed {new Date(editingOrder.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                {editingOrder.updatedAt && (
                  <p className="text-xs text-gray-400">
                    Last updated {new Date(editingOrder.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
              </div>
              <span className={`self-start inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[editStatus] || STATUS_COLORS.pending}`}>
                {editStatus || 'pending'}
              </span>
            </div>

            <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1">
              {/* Customer & payment info */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Email</dt>
                    <dd className="text-gray-900 break-all">
                      {editingOrder.customerEmail
                        ? <a href={`mailto:${editingOrder.customerEmail}`} className="text-teal-700 hover:text-teal-900 hover:underline">{editingOrder.customerEmail}</a>
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Account ID</dt>
                    <dd className="text-gray-900 font-mono text-xs break-all">{editingOrder.accountId}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fulfillment</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Delivery method</dt>
                    <dd className="text-gray-900">{labelFor(DELIVERY_LABELS, editingOrder.deliveryMethod)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Payment method</dt>
                    <dd className="text-gray-900">{labelFor(PAYMENT_LABELS, editingOrder.paymentMethod)}</dd>
                  </div>
                  {editingOrder.deliveryAddress && (
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500">Ship to</dt>
                      <dd className="text-gray-900">
                        {editingOrder.deliveryAddress.recipientName && (
                          <div>{editingOrder.deliveryAddress.recipientName}</div>
                        )}
                        {editingOrder.deliveryAddress.street && (
                          <div>{editingOrder.deliveryAddress.street}</div>
                        )}
                        {(editingOrder.deliveryAddress.city || editingOrder.deliveryAddress.state || editingOrder.deliveryAddress.zip) && (
                          <div>
                            {[
                              editingOrder.deliveryAddress.city,
                              [editingOrder.deliveryAddress.state, editingOrder.deliveryAddress.zip].filter(Boolean).join(' ')
                            ].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {editingOrder.deliveryAddress.phoneNumber && (
                          <div className="text-sm text-gray-600 mt-1">{editingOrder.deliveryAddress.phoneNumber}</div>
                        )}
                      </dd>
                    </div>
                  )}
                  {editingOrder.deliveryAddressId && (
                    <div>
                      <dt className="text-gray-500">Delivery address ID</dt>
                      <dd className="text-gray-900 font-mono text-xs break-all">{editingOrder.deliveryAddressId}</dd>
                    </div>
                  )}
                  {editingOrder.pickupLocationId && (
                    <div>
                      <dt className="text-gray-500">Pickup location ID</dt>
                      <dd className="text-gray-900 font-mono text-xs break-all">{editingOrder.pickupLocationId}</dd>
                    </div>
                  )}
                  {editingOrder.transactionId && (() => {
                    const t = txnInfo(editingOrder.transactionId);
                    return (
                      <div className="sm:col-span-2">
                        <dt className="text-gray-500">{t.label}</dt>
                        <dd className="text-gray-900 font-mono text-xs break-all">
                          {t.url ? (
                            <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:text-teal-900 hover:underline">
                              {editingOrder.transactionId} ↗
                            </a>
                          ) : editingOrder.transactionId}
                        </dd>
                      </div>
                    );
                  })()}
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500">Quote ID</dt>
                    <dd className="text-gray-900 font-mono text-xs break-all">{editingOrder.quoteId}</dd>
                  </div>
                  {editingOrder.shippedAt && (
                    <div>
                      <dt className="text-gray-500">Shipped</dt>
                      <dd className="text-gray-900">{new Date(editingOrder.shippedAt).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {editingOrder.deliveredAt && (
                    <div>
                      <dt className="text-gray-500">Delivered</dt>
                      <dd className="text-gray-900">{new Date(editingOrder.deliveredAt).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {editingOrder.trackingNumber && (
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500">Tracking</dt>
                      <dd className="text-gray-900">
                        {[editingOrder.trackingCarrier?.toUpperCase(), editingOrder.trackingNumber].filter(Boolean).join(' ')}
                        {editingOrder.trackingUrl && (
                          <> · <a href={editingOrder.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:text-teal-900 hover:underline font-medium">Track package →</a></>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Items */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Items ({editingOrder.items?.length || 0})</h3>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500" colSpan={2}>Item</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(editingOrder.items || []).length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-xs">No items recorded for this order.</td></tr>
                      ) : (editingOrder.items || []).map((it, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 w-12">
                            {it.image
                              ? <img
                                  src={it.image}
                                  alt=""
                                  loading="lazy"
                                  className="w-10 h-10 object-cover rounded border border-gray-200"
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    img.replaceWith(Object.assign(document.createElement('div'), {
                                      className: 'w-10 h-10 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-gray-400 text-xs',
                                      textContent: '—',
                                    }));
                                  }}
                                />
                              : <div className="w-10 h-10 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">—</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-900 break-words">{it.name}</td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">{it.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">${(it.discountedPrice ?? it.price ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <dl className="mt-3 space-y-1 text-sm max-w-xs ml-auto">
                  <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd>${editingOrder.subtotal.toFixed(2)}</dd></div>
                  <div className="flex justify-between text-gray-600"><dt>Shipping</dt><dd>${editingOrder.shippingCost.toFixed(2)}</dd></div>
                  <div className="flex justify-between text-gray-600"><dt>Tax</dt><dd>${editingOrder.taxAmount.toFixed(2)}</dd></div>
                  {editingOrder.promoDiscount && editingOrder.promoDiscount > 0 ? (
                    <div className="flex justify-between text-emerald-600"><dt>Discount{editingOrder.promoCode ? ` (${editingOrder.promoCode})` : ''}</dt><dd>-${editingOrder.promoDiscount.toFixed(2)}</dd></div>
                  ) : null}
                  <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200"><dt>Total</dt><dd>${editingOrder.grandTotal.toFixed(2)}</dd></div>
                  {totalRefunded(editingOrder) > 0 && (
                    <>
                      <div className="flex justify-between text-purple-700"><dt>Refunded</dt><dd>-${totalRefunded(editingOrder).toFixed(2)}</dd></div>
                      <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200"><dt>Net Total</dt><dd>${netTotal(editingOrder).toFixed(2)}</dd></div>
                    </>
                  )}
                </dl>
              </section>

              {/* Refunds */}
              <section className="border-t border-gray-200 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Refunds</h3>
                  {editingOrder.grandTotal - totalRefunded(editingOrder) > 0.01 && (
                    <button
                      type="button"
                      onClick={() => openRefundModal(editingOrder)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200"
                    >
                      Add Refund
                    </button>
                  )}
                </div>
                {(editingOrder.refunds || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No refunds on this order.</p>
                ) : (
                  <ul className="space-y-2">
                    {(editingOrder.refunds || []).map((r) => (
                      <li key={r.id} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="text-sm">
                            <div className="font-semibold text-gray-900">${r.amount.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(r.refundedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              {r.refundedBy ? ` · by ${r.refundedBy}` : ''}
                            </div>
                          </div>
                          <div className="text-xs font-mono text-gray-500 break-all max-w-[50%] text-right">{r.stripeRefundID}</div>
                        </div>
                        {r.reason && <p className="mt-2 text-sm text-gray-700">{r.reason}</p>}
                        {r.itemAdjustments && r.itemAdjustments.length > 0 && (
                          <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                            {r.itemAdjustments.map((a, i) => {
                              const item = editingOrder.items.find((it) => it.productId === a.productID);
                              return (
                                <li key={i}>
                                  · {a.quantity}× {item ? item.name : a.productID} (${a.lineAmount.toFixed(2)})
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Update controls */}
              <section className="border-t border-gray-200 pt-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Update</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tracking carrier</label>
                    <select
                      value={editCarrier}
                      onChange={(e) => setEditCarrier(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">— None —</option>
                      {CARRIER_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tracking number</label>
                    <input
                      type="text"
                      value={editTrackingNumber}
                      onChange={(e) => setEditTrackingNumber(e.target.value)}
                      placeholder="e.g., 1Z999AA10123456784"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Customer gets a shipping email when status changes to "shipped".</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-2 flex-shrink-0">
              {(() => {
                const reviewEligible = editingOrder.status === 'shipped' || editingOrder.status === 'delivered';
                const requested = !!editingOrder.reviewRequestedAt;
                const enabled = canEdit && reviewEligible && !!editingOrder.customerEmail;
                const title = !canEdit
                  ? 'Requesting reviews is not available for partner accounts'
                  : !editingOrder.customerEmail
                    ? 'No customer email on this order'
                    : !reviewEligible
                      ? 'Available once the order is shipped or delivered'
                      : requested
                        ? `Review requested ${new Date(editingOrder.reviewRequestedAt!).toLocaleDateString()} — click to resend`
                        : 'Request a review from the customer';
                return (
                  <button
                    onClick={() => handleRequestReview(editingOrder.id)}
                    disabled={!enabled}
                    title={title}
                    className={`mr-auto inline-flex items-center gap-1.5 px-4 py-2 border rounded-md text-sm font-medium ${enabled ? (requested ? 'border-green-300 text-green-700 bg-white hover:bg-green-50' : 'border-amber-300 text-amber-700 bg-white hover:bg-amber-50') : 'border-gray-300 text-gray-400 bg-white opacity-60 cursor-not-allowed'}`}
                  >
                    <StarIcon className="h-4 w-4" /> {requested ? 'Resend review request' : 'Request review'}
                  </button>
                );
              })()}
              <button
                onClick={closeEditModal}
                className="px-4 py-2 border border-gray-300 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isLoading}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={closeRefundModal}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add Refund</h2>
                <p className="text-xs text-gray-500 mt-0.5">Order #{refundingOrder.id.slice(-6).toUpperCase()}</p>
              </div>
              <button onClick={closeRefundModal} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              <div className="bg-purple-50 border border-purple-100 rounded-md p-3 text-sm">
                <div className="flex justify-between text-gray-700"><span>Order total</span><span>${refundingOrder.grandTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-700"><span>Already refunded</span><span>-${totalRefunded(refundingOrder).toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold text-purple-900 pt-1 border-t border-purple-200 mt-1">
                  <span>Refundable</span>
                  <span>${(refundingOrder.grandTotal - totalRefunded(refundingOrder)).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stripe refund ID <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={refundStripeID}
                  onChange={(e) => setRefundStripeID(e.target.value)}
                  placeholder="re_3PqXyZ2abc..."
                  className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500">Process the refund in Stripe first, then paste the refund ID here.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refund amount (USD) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  placeholder="e.g., Customer adjusted order from 6 pairs to 1 pair."
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items returned (optional)</label>
                <p className="text-xs text-gray-500 mb-2">Leave blank for a money-only refund (e.g., shipping/tax adjustment).</p>
                <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                  {(() => {
                    const priorReturned = alreadyReturnedByProduct(refundingOrder);
                    return refundingOrder.items.map((it) => {
                      const returnedSoFar = priorReturned[it.productId] || 0;
                      const remaining = it.quantity - returnedSoFar;
                      return (
                        <div key={it.productId} className="flex items-center justify-between p-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{it.name}</div>
                            <div className="text-xs text-gray-500">
                              Ordered: {it.quantity} × ${(it.discountedPrice ?? it.price).toFixed(2)}
                              {returnedSoFar > 0 && (
                                <span className="text-purple-700"> · {returnedSoFar} already returned</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-3">
                            <label className="text-xs text-gray-600">Return qty</label>
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              disabled={remaining <= 0}
                              value={refundItemQtys[it.productId] || ''}
                              onChange={(e) => setRefundItemQtys({ ...refundItemQtys, [it.productId]: e.target.value })}
                              className="w-16 p-1.5 border border-gray-300 rounded-md text-sm text-center disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-2 flex-shrink-0">
              <button
                onClick={closeRefundModal}
                className="px-4 py-2 border border-gray-300 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRefund}
                disabled={isLoading}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Add Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h2 className="text-lg font-medium text-gray-900">
              Confirm Deletion
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete this order? This action cannot be
              undone.
            </p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 border rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setExportOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Export Orders</h2>
              <button type="button" onClick={() => setExportOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'generic' | 'google' | 'bing')}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="generic">Generic CSV (full ledger for accounting, reporting)</option>
                  <option value="google">Google Ads offline conversions upload</option>
                  <option value="bing">Microsoft Ads bulk offline conversions</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              {exportFormat !== 'generic' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Conversion Name</label>
                  <input type="text" value={exportConversionName} onChange={(e) => setExportConversionName(e.target.value)} placeholder="Purchase" className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                  <p className="text-xs text-gray-500 mt-1">
                    Must match the action you set up in {exportFormat === 'google' ? 'Google Ads (Tools → Conversions)' : 'Microsoft Advertising (Conversion Goals)'}.
                  </p>
                </div>
              )}
              {exportFormat === 'generic' && (
                <p className="text-xs text-gray-500">
                  Includes every order in the window (all statuses) with totals, customer email, payment/delivery, tracking, and PPC click IDs.
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" onClick={() => setExportOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exportRunning || !exportFrom || !exportTo}
                className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {exportRunning ? 'Downloading…' : 'Download CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderForm;