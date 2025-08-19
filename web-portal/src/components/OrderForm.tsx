// src/components/OrderForm.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getOrders, deleteOrder } from '../api';
import { Order } from '../types';
import Navbar from './Navbar';
import { TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /* ------------------------ Derived ------------------------ */
  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentRole   = currentUser?.role ?? '';
  const companyId     = currentRole === 'company' ? currentUser?.id : undefined;

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) =>
        o.id.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [orders, searchQuery]
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
          setOrders(data ?? []);
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
      setOrders(data ?? []);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
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

  /* ------------------------ Render ------------------------ */
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Orders</h1>
        </header>

        {/* Search */}
        <section className="mb-6">
          <label className="relative block">
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grand Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account ID
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${order.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.sellerId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.accountId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openDeleteConfirm(order.id)}
                          className="text-red-600 hover:text-red-800"
                          aria-label={`Delete order ${order.id}`}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-6 flex justify-end space-x-2">
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
                    ? 'bg-teal-600 text-white'
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
    </div>
  );
};

export default OrderForm;