/**
 * D2C Customer Management SDK (Headless)
 * Handles Auth, Profile, and Orders directly with backend APIs.
 */

(function () {
    const AUTH_KEY = 'accessToken';
    const API_BASE = window.D2C_CONFIG?.apiBase || '';

    const Customer = {
        user: null,
        token: null,

        async init() {
            this.token = localStorage.getItem(AUTH_KEY);
            if (this.token) {
                await this.fetchProfile();
            }
            this.createDashboardUI();
            this.createLoginUI();
            this.updateHeaderUI();
            this._handlePaymentReturn();
        },

        _handlePaymentReturn() {
            const params = new URLSearchParams(window.location.search);
            const status = params.get('status');
            if (!status) return;
            const orderId = params.get('orderId');

            window.history.replaceState({}, '', window.location.pathname);

            if (status === 'success') {
                if (window.D2C_CART) window.D2C_CART.clear();
                this._showOrderConfirmation(orderId);
            } else {
                const messages = {
                    cancelled: 'Payment was cancelled. Your cart has been preserved.',
                    failed: 'Payment failed. Please try again.',
                    expired: 'Payment session expired. Please try again.',
                    error: 'Something went wrong. Please try again.'
                };
                const banner = document.createElement('div');
                banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;padding:16px 24px;text-align:center;font-weight:600;font-size:15px;color:#fff;background:#dc2626;box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;';
                banner.textContent = messages[status] || messages.error;
                banner.onclick = () => banner.remove();
                document.body.prepend(banner);
                setTimeout(() => banner.remove(), 8000);
            }
        },

        async _showOrderConfirmation(orderId) {
            const primaryColor = window.D2C_CONFIG?.primaryColor || '#121212';
            const overlay = document.createElement('div');
            overlay.id = 'order-confirm-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
            overlay.innerHTML = `
                <div style="background:#fff;border-radius:20px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.2);">
                    <div style="text-align:center;padding:2.5rem 2rem 1.5rem;">
                        <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <h2 style="margin:0 0 0.5rem;font-size:1.5rem;font-weight:900;color:#0f172a;">Order Confirmed!</h2>
                        <p style="margin:0;color:#64748b;font-size:0.95rem;">Thank you for your purchase.</p>
                    </div>
                    <div id="order-confirm-details" style="padding:0 2rem;">
                        <div style="text-align:center;padding:1rem;color:#94a3b8;font-size:0.9rem;">Loading order details...</div>
                    </div>
                    <div style="padding:1.5rem 2rem 2rem;display:flex;flex-direction:column;gap:0.75rem;">
                        <button onclick="D2C_CUSTOMER.showDashboard();document.getElementById('order-confirm-overlay')?.remove();" style="width:100%;padding:0.875rem;border:1px solid ${primaryColor};background:transparent;color:${primaryColor};border-radius:12px;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit;">View My Orders</button>
                        <button onclick="document.getElementById('order-confirm-overlay')?.remove();" style="width:100%;padding:0.875rem;border:none;background:${primaryColor};color:#fff;border-radius:12px;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit;">Continue Shopping</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            if (orderId && this.token) {
                try {
                    const orders = await this.getOrders();
                    const order = orders?.find(o => (o._id || o.id) === orderId);
                    const details = document.getElementById('order-confirm-details');
                    if (order && details) {
                        const shortId = (order._id || order.id || '').slice(-6).toUpperCase();
                        details.innerHTML = `
                            <div style="background:#f8fafc;border-radius:12px;padding:1.25rem;margin-bottom:0.5rem;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                                    <span style="font-size:0.8rem;color:#64748b;font-weight:600;">ORDER #${shortId}</span>
                                    <span style="font-size:0.8rem;color:#64748b;">${new Date(order.createdAt).toLocaleDateString()}</span>
                                </div>
                                ${order.items.map(item => `
                                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-top:1px solid #e2e8f0;">
                                        <div>
                                            <div style="font-weight:600;font-size:0.9rem;color:#0f172a;">${item.name}</div>
                                            <div style="font-size:0.8rem;color:#94a3b8;">Qty: ${item.quantity}</div>
                                        </div>
                                        <span style="font-weight:700;color:#0f172a;">$${((item.discountedPrice || item.price) * item.quantity).toFixed(2)}</span>
                                    </div>
                                `).join('')}
                                <div style="border-top:2px solid #e2e8f0;margin-top:0.75rem;padding-top:0.75rem;">
                                    ${order.shippingCost ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#64748b;margin-bottom:0.25rem;"><span>Shipping</span><span>$${order.shippingCost.toFixed(2)}</span></div>` : ''}
                                    ${order.taxAmount ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#64748b;margin-bottom:0.5rem;"><span>Tax</span><span>$${order.taxAmount.toFixed(2)}</span></div>` : ''}
                                    <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1.1rem;color:#0f172a;">
                                        <span>Total</span>
                                        <span>$${(order.grandTotal || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>`;
                    } else if (details) {
                        details.innerHTML = '';
                    }
                } catch {
                    const details = document.getElementById('order-confirm-details');
                    if (details) details.innerHTML = '';
                }
            } else {
                const details = document.getElementById('order-confirm-details');
                if (details) details.innerHTML = '';
            }
        },

        async fetchProfile() {
            try {
                const claims = JSON.parse(atob(this.token.split('.')[1]));
                const userId = claims.user.id;

                const response = await fetch(`${API_BASE}/accounts/${userId}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (response.ok) {
                    this.user = await response.json();
                } else if (response.status === 401) {
                    this.logout();
                }
            } catch (err) {
                console.error('Headless Profile Fetch Error:', err);
            }
        },

        async login(email, password) {
            const response = await fetch(`${API_BASE}/accounts/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                this.token = data.accessToken;
                localStorage.setItem(AUTH_KEY, this.token);
                await this.fetchProfile();
                this.updateHeaderUI();
                return true;
            }
            return false;
        },

        logout() {
            this.user = null;
            this.token = null;
            localStorage.removeItem(AUTH_KEY);
            this.updateHeaderUI();
            this.hideDashboard();
            window.location.reload();
        },

        async getOrders() {
            if (!this.token) return [];
            try {
                const response = await fetch(`${API_BASE}/checkout/orders?sellerId=${window.D2C_CONFIG.sellerId}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                return response.ok ? (await response.json() || []) : [];
            } catch { return []; }
        },

        createDashboardUI() {
            const overlay = document.createElement('div');
            overlay.id = 'customer-overlay';
            overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.4); z-index: 2000; display: none;
                backdrop-filter: blur(4px);
            `;
            overlay.onclick = () => {
                this.hideDashboard();
                this.hideLoginModal();
            };
            document.body.appendChild(overlay);

            const drawer = document.createElement('div');
            drawer.id = 'customer-dashboard';
            drawer.style = `
                position: fixed; top: 0; right: -450px; width: 450px; max-width: 90vw; height: 100vh;
                background: white; box-shadow: -10px 0 30px rgba(0,0,0,0.1);
                z-index: 2001; transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex; flex-direction: column; overflow: hidden;
            `;
            drawer.innerHTML = `
                <div style="padding: 2rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-weight: 800;">My Account</h2>
                    <button class="close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;" onclick="D2C_CUSTOMER.hideDashboard()">&times;</button>
                </div>
                <div class="cart-items" id="dashboard-content" style="flex: 1; overflow-y: auto; padding: 1.5rem;"></div>
                <div class="cart-footer" style="padding: 2rem; border-top: 1px solid #eee; background: #fafafa;">
                    <button class="close-btn" style="width:100%; font-size:1rem; background:#f1f5f9; border-radius:12px; height:50px; border:none; cursor:pointer; font-weight:700" onclick="D2C_CUSTOMER.logout()">Logout</button>
                </div>
            `;
            document.body.appendChild(drawer);
        },

        // --- API Methods for Dashboard ---
        async getAddresses() {
            if (!this.token || !this.user) return [];
            try {
                const response = await fetch(`${API_BASE}/accounts/locations/${this.user._id}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                return response.ok ? (await response.json() || []) : [];
            } catch { return []; }
        },

        async addAddress(addressData) {
            if (!this.token || !this.user) return false;
            const response = await fetch(`${API_BASE}/accounts/locations/${this.user._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(addressData)
            });
            return response.ok;
        },

        async deleteAddress(locationId) {
            if (!this.token || !this.user) return false;
            const response = await fetch(`${API_BASE}/accounts/locations/${this.user._id}/${locationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return response.ok;
        },

        async updateProfile(updates) {
            if (!this.token || !this.user) return false;
            const response = await fetch(`${API_BASE}/accounts/${this.user._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(updates)
            });
            if (response.ok) {
                await this.fetchProfile();
                return true;
            }
            return false;
        },

        // --- Checkout API Methods ---

        async clearCart(sellerId) {
            if (!this.token) return false;
            const response = await fetch(`${API_BASE}/checkout/cart?sellerId=${sellerId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return response.ok;
        },

        async addToCart(item) {
            if (!this.token) return false;
            const response = await fetch(`${API_BASE}/checkout/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ entity: item })
            });
            return response.ok ? await response.json() : null;
        },

        async createQuote(sellerId, addresses) {
            if (!this.token) return null;
            const cfg = window.D2C_CONFIG || {};
            const response = await fetch(`${API_BASE}/checkout/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({
                    sellerId: sellerId,
                    paymentMethods: cfg.paymentMethods || ['pickup_&_pay'],
                    deliveryMethods: cfg.deliveryMethods || ['shipping_out'],
                    shippingOutOptions: cfg.shippingOutOptions || ['standard'],
                    quotesAllowed: false,
                    companyLocations: [],
                    customerAddresses: addresses || [],
                    configurations: [],
                    quoteType: 'standard'
                })
            });
            return response.ok ? await response.json() : null;
        },

        async getQuote(quoteId) {
            if (!this.token) return null;
            const response = await fetch(`${API_BASE}/checkout/quotes/${quoteId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return response.ok ? await response.json() : null;
        },

        async placeOrder(quoteId, paymentMethod, deliveryMethod, pickupLocationId, deliveryAddressId) {
            if (!this.token) return null;
            const body = {
                quoteId: quoteId,
                paymentMethod: paymentMethod || 'pickup_&_pay',
                deliveryMethod: deliveryMethod || 'shipping_out',
                returnUrl: window.location.protocol === 'file:' ? (document.querySelector('link[rel="canonical"]')?.href || window.D2C_CONFIG.apiBase) : window.location.origin + window.location.pathname
            };
            if (pickupLocationId) body.pickupLocationId = pickupLocationId;
            if (deliveryAddressId) body.deliveryAddressId = deliveryAddressId;
            const response = await fetch(`${API_BASE}/checkout/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(body)
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
                return { redirect: true };
            }
            if (data.buttonConfig) {
                return { buttonConfig: data.buttonConfig };
            }
            return data;
        },

        // --- Headless Checkout UI ---

        async startCheckout(cartItems) {
            if (!this.token || !this.user) {
                this.showLoginModal();
                return;
            }

            const sellerId = window.D2C_CONFIG?.sellerId;
            if (!sellerId || !cartItems || cartItems.length === 0) return;

            // Show loading overlay
            this._showCheckoutLoading();

            try {
                // Step 1: Sync local cart to server
                await this.clearCart(sellerId);
                for (const item of cartItems) {
                    const result = await this.addToCart({
                        productId: item._id,
                        quantity: item.quantity || 1,
                        sellerId: sellerId,
                        name: item.name || 'Product',
                        price: item.price || 0,
                        discountedPrice: item.discountedPrice,
                        image: item.image
                    });
                    if (!result) throw new Error('Failed to add item to server cart');
                }

                // Step 2: Get customer addresses
                const addresses = await this.getAddresses();

                // Step 3: Create quote
                const customerAddresses = (addresses || []).map(a => ({
                    id: a._id || a.id,
                    addressLabel: a.addressLabel || 'Address',
                    recipientName: a.recipientName || '',
                    address: a.address || {}
                }));
                const quote = await this.createQuote(sellerId, customerAddresses);
                if (!quote) throw new Error('Failed to create quote');

                // Step 4: Show checkout modal with quote data
                this._showCheckoutOverlay(quote);
            } catch (err) {
                console.error('Checkout failed:', err);
                document.getElementById('d2c-checkout-overlay')?.remove();
                if (window.D2C_CART) window.D2C_CART.showToast(err.message || 'Checkout failed. Please try again.');
            }
        },

        _showCheckoutLoading() {
            const existing = document.getElementById('d2c-checkout-overlay');
            if (existing) existing.remove();
            const overlay = document.createElement('div');
            overlay.id = 'd2c-checkout-overlay';
            overlay.style = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)';
            overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:3rem;text-align:center;font-weight:700;color:#374151">Preparing checkout...</div>';
            document.body.appendChild(overlay);
        },

        _showCheckoutOverlay(quote) {
            const existing = document.getElementById('d2c-checkout-overlay');
            if (existing) existing.remove();

            const primaryColor = window.D2C_CONFIG?.primaryColor || '#0d9488';
            const deliveryMethods = quote.availableDeliveryMethods || ['shipping_out'];
            const paymentMethods = quote.availablePaymentMethods || ['pickup_&_pay'];
            const shippingOptions = quote.availableShippingOutOptions || [];
            const customerAddresses = quote.customerAddresses || [];
            const companyLocations = quote.companyLocations || [];

            const overlay = document.createElement('div');
            overlay.id = 'd2c-checkout-overlay';
            overlay.innerHTML = `
                <style>
                    #d2c-checkout-overlay {
                        position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center;
                        background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
                    }
                    .checkout-modal {
                        background: #fff; border-radius: 16px; max-width: 520px; width: 90%; max-height: 85vh; overflow-y: auto;
                        box-shadow: 0 25px 50px rgba(0,0,0,0.25); padding: 0;
                    }
                    .checkout-header {
                        padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
                        display: flex; justify-content: space-between; align-items: center;
                    }
                    .checkout-header h2 { margin: 0; font-size: 20px; font-weight: 700; color: #111; }
                    .checkout-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; }
                    .checkout-body { padding: 20px 24px; }
                    .checkout-item {
                        display: flex; justify-content: space-between; align-items: center;
                        padding: 10px 0; border-bottom: 1px solid #f3f4f6;
                    }
                    .checkout-item-name { font-weight: 500; color: #374151; }
                    .checkout-item-detail { color: #6b7280; font-size: 14px; }
                    .checkout-item-price { font-weight: 600; color: #111; }
                    .checkout-summary-row {
                        display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #6b7280;
                    }
                    .checkout-summary-row.total {
                        border-top: 2px solid #111; margin-top: 8px; padding-top: 12px;
                        font-size: 18px; font-weight: 700; color: #111;
                    }
                    .checkout-section { margin-top: 20px; }
                    .checkout-section h3 { font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
                    .checkout-select {
                        width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px;
                        font-size: 14px; color: #374151; background: #f9fafb; appearance: auto;
                    }
                    .checkout-radio-group { display: flex; flex-direction: column; gap: 8px; }
                    .checkout-radio {
                        display: flex; align-items: center; gap: 10px; padding: 10px 12px;
                        border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; background: #f9fafb;
                    }
                    .checkout-radio:hover { border-color: #d1d5db; }
                    .checkout-radio input { margin: 0; }
                    .checkout-radio label { font-size: 14px; color: #374151; cursor: pointer; font-weight: 500; }
                    .checkout-footer { padding: 16px 24px; border-top: 1px solid #e5e7eb; }
                    .checkout-btn {
                        width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 16px; font-weight: 700;
                        color: #fff; cursor: pointer; transition: opacity 0.2s;
                    }
                    .checkout-btn:hover { opacity: 0.9; }
                    .checkout-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                    .checkout-status { text-align: center; padding: 12px; font-size: 14px; color: #6b7280; }
                </style>
                <div class="checkout-modal">
                    <div class="checkout-header">
                        <h2>Checkout</h2>
                        <button class="checkout-close" onclick="document.getElementById('d2c-checkout-overlay').remove()">&times;</button>
                    </div>
                    <div class="checkout-body">
                        ${quote.items.map(item => `
                            <div class="checkout-item">
                                <div>
                                    <div class="checkout-item-name">${item.name || 'Product'}</div>
                                    <div class="checkout-item-detail">Qty: ${item.quantity || 1}</div>
                                </div>
                                <div class="checkout-item-price">$${(item.lineItemTotal || ((item.discountedPrice || item.price || 0) * (item.quantity || 1))).toFixed(2)}</div>
                            </div>
                        `).join('')}
                        <div style="margin-top:12px">
                            <div class="checkout-summary-row"><span>Subtotal</span><span>$${(quote.subtotal || 0).toFixed(2)}</span></div>
                            <div class="checkout-summary-row"><span>Shipping</span><span>$${(quote.shippingCost || 0).toFixed(2)}</span></div>
                            <div class="checkout-summary-row"><span>Tax</span><span>$${(quote.taxAmount || 0).toFixed(2)}</span></div>
                            <div class="checkout-summary-row total"><span>Grand Total</span><span>$${(quote.grandTotal || 0).toFixed(2)}</span></div>
                        </div>

                        <div class="checkout-section">
                            <h3>Delivery Method</h3>
                            <select id="checkout-delivery" class="checkout-select">
                                ${deliveryMethods.map(m => `<option value="${m}">${m.replace(/_/g, ' ')}</option>`).join('')}
                            </select>
                        </div>

                        <div class="checkout-section" id="checkout-address-section" style="display:${deliveryMethods[0] !== 'pickup' ? 'block' : 'none'}">
                            <h3>Delivery Address</h3>
                            ${customerAddresses.length > 0 ? `
                                <select id="checkout-address" class="checkout-select">
                                    <option value="">Select an address</option>
                                    ${customerAddresses.map(a => `<option value="${a.id}">${a.addressLabel || 'Address'}: ${a.address?.street || ''}, ${a.address?.city || ''}</option>`).join('')}
                                </select>
                            ` : '<div style="font-size:13px;color:#9ca3af;padding:8px 0">No saved addresses. You can add one from your profile.</div>'}
                        </div>

                        <div class="checkout-section" id="checkout-pickup-section" style="display:${deliveryMethods[0] === 'pickup' ? 'block' : 'none'}">
                            <h3>Pickup Location</h3>
                            ${companyLocations.length > 0 ? `
                                <select id="checkout-pickup" class="checkout-select">
                                    <option value="">Select a location</option>
                                    ${companyLocations.map(l => `<option value="${l.id}">${l.locationName} - ${l.address?.street || ''}, ${l.address?.city || ''}</option>`).join('')}
                                </select>
                            ` : '<div style="font-size:13px;color:#9ca3af;padding:8px 0">No pickup locations available.</div>'}
                        </div>

                        ${shippingOptions.length > 0 ? `
                        <div class="checkout-section" id="checkout-shipping-section" style="display:${deliveryMethods[0] === 'shipping_out' ? 'block' : 'none'}">
                            <h3>Shipping Option</h3>
                            <select id="checkout-shipping" class="checkout-select">
                                ${shippingOptions.map(o => `<option value="${o}">${o}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}

                        <div class="checkout-section">
                            <h3>Payment Method</h3>
                            <div class="checkout-radio-group">
                                ${paymentMethods.map((m, i) => `
                                    <div class="checkout-radio">
                                        <input type="radio" name="checkout-payment" id="pay-${m}" value="${m}" ${i === 0 ? 'checked' : ''}>
                                        <label for="pay-${m}">${m.replace(/_/g, ' ')}</label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div id="checkout-status" class="checkout-status" style="display:none;"></div>
                    </div>
                    <div class="checkout-footer">
                        <div id="d2c-pay-button" style="display:none;margin:0 auto 0.5rem;max-width:300px;"></div>
                        <button id="checkout-place-order-btn" class="checkout-btn" style="background-color: ${primaryColor};">
                            Place Order — $${(quote.grandTotal || 0).toFixed(2)}
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });

            // Toggle address/pickup/shipping sections based on delivery method
            const deliverySelect = document.getElementById('checkout-delivery');
            if (deliverySelect) {
                deliverySelect.addEventListener('change', () => {
                    const val = deliverySelect.value;
                    const addrSec = document.getElementById('checkout-address-section');
                    const pickupSec = document.getElementById('checkout-pickup-section');
                    const shipSec = document.getElementById('checkout-shipping-section');
                    if (addrSec) addrSec.style.display = val !== 'pickup' ? 'block' : 'none';
                    if (pickupSec) pickupSec.style.display = val === 'pickup' ? 'block' : 'none';
                    if (shipSec) shipSec.style.display = val === 'shipping_out' ? 'block' : 'none';
                });
            }

            document.getElementById('checkout-place-order-btn').addEventListener('click', () => {
                this._processCheckout(quote);
            });

            // When Amazon Pay is selected, show button instead of Place Order
            const paymentRadios = document.querySelectorAll('input[name="checkout-payment"]');
            paymentRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    const method = document.querySelector('input[name="checkout-payment"]:checked')?.value;
                    const placeBtn = document.getElementById('checkout-place-order-btn');
                    const payBtnContainer = document.getElementById('d2c-pay-button');
                    if (method === 'amazon_pay') {
                        placeBtn.style.display = 'none';
                        payBtnContainer.style.display = 'block';
                        this._fetchAndRenderPayButton(quote);
                    } else {
                        placeBtn.style.display = '';
                        payBtnContainer.style.display = 'none';
                        payBtnContainer.innerHTML = '';
                    }
                });
            });

            // If amazon_pay is pre-selected (first option), trigger immediately
            const initialMethod = document.querySelector('input[name="checkout-payment"]:checked')?.value;
            if (initialMethod === 'amazon_pay') {
                document.getElementById('checkout-place-order-btn').style.display = 'none';
                document.getElementById('d2c-pay-button').style.display = 'block';
                this._fetchAndRenderPayButton(quote);
            }
        },

        async _processCheckout(quote) {
            const btn = document.getElementById('checkout-place-order-btn');
            const status = document.getElementById('checkout-status');

            const deliveryMethod = document.getElementById('checkout-delivery')?.value || 'shipping_out';
            const paymentMethod = document.querySelector('input[name="checkout-payment"]:checked')?.value || 'pickup_&_pay';
            const pickupLocationId = deliveryMethod === 'pickup' ? (document.getElementById('checkout-pickup')?.value || '') : '';
            const deliveryAddressId = deliveryMethod !== 'pickup' ? (document.getElementById('checkout-address')?.value || '') : '';

            btn.disabled = true;
            btn.textContent = 'Placing order...';
            status.style.display = 'block';
            status.textContent = 'Processing your order...';

            try {
                const quoteId = quote._id || quote.id;
                const result = await this.placeOrder(quoteId, paymentMethod, deliveryMethod, pickupLocationId, deliveryAddressId);
                if (!result) throw new Error('Failed to place order');

                if (result.redirect) {
                    status.textContent = 'Redirecting to payment provider...';
                    return;
                }

                status.textContent = '';
                btn.textContent = 'Order Placed!';
                btn.style.backgroundColor = '#16a34a';

                if (window.D2C_CART) {
                    window.D2C_CART.clear();
                }

                const placedOrderId = result._id || result.id || '';
                setTimeout(() => {
                    document.getElementById('d2c-checkout-overlay')?.remove();
                    this._showOrderConfirmation(placedOrderId);
                }, 1000);

            } catch (err) {
                console.error('Checkout failed:', err);
                status.textContent = 'Checkout failed. Please try again.';
                btn.disabled = false;
                btn.textContent = 'Try Again';
                btn.style.backgroundColor = window.D2C_CONFIG?.primaryColor || '#0d9488';
            }
        },

        async _fetchAndRenderPayButton(quote) {
            const container = document.getElementById('d2c-pay-button');
            if (!container) return;
            container.innerHTML = '<p style="text-align:center;color:#888;font-size:14px;">Loading Amazon Pay...</p>';

            const deliveryMethod = document.getElementById('checkout-delivery')?.value || 'shipping_out';
            const pickupLocationId = deliveryMethod === 'pickup' ? (document.getElementById('checkout-pickup')?.value || '') : '';
            const deliveryAddressId = deliveryMethod !== 'pickup' ? (document.getElementById('checkout-address')?.value || '') : '';
            const quoteId = quote._id || quote.id;

            const result = await this.placeOrder(quoteId, 'amazon_pay', deliveryMethod, pickupLocationId, deliveryAddressId);
            if (!result || !result.buttonConfig) {
                container.innerHTML = '<p style="text-align:center;color:#e53e3e;font-size:14px;">Failed to load Amazon Pay</p>';
                return;
            }

            const config = result.buttonConfig;
            container.innerHTML = '';

            const initBtn = () => {
                if (!window.amazon) return;
                window.amazon.Pay.renderButton('#d2c-pay-button', {
                    merchantId: config.merchantId,
                    publicKeyId: config.publicKeyId,
                    ledgerCurrency: config.ledgerCurrency || 'USD',
                    sandbox: config.sandbox === 'true',
                    checkoutLanguage: 'en_US',
                    productType: 'PayOnly',
                    placement: 'Checkout',
                    createCheckoutSessionConfig: {
                        payloadJSON: config.payloadJSON,
                        signature: config.signature,
                        algorithm: 'AMZN-PAY-RSASSA-PSS-V2'
                    }
                });
            };

            if (window.amazon) {
                initBtn();
            } else {
                const s = document.createElement('script');
                s.src = 'https://static-na.payments-amazon.com/checkout.js';
                s.onload = initBtn;
                document.head.appendChild(s);
            }
        },

        _dashboardTab: 'profile',

        async showDashboard() {
            const content = document.getElementById('dashboard-content');
            if (!this.user) {
                this.showLoginModal();
                return;
            }

            // Inject dashboard styles once
            if (!document.getElementById('d2c-dash-styles')) {
                const s = document.createElement('style');
                s.id = 'd2c-dash-styles';
                s.textContent = `
                    .dash-tabs { display:flex; gap:0; border-bottom:2px solid #f1f5f9; margin-bottom:1.5rem; }
                    .dash-tab { flex:1; padding:0.75rem 0.5rem; text-align:center; font-weight:700; font-size:0.85rem; cursor:pointer; border:none; background:none; color:#94a3b8; transition:all 0.2s; border-bottom:2px solid transparent; margin-bottom:-2px; font-family:inherit; }
                    .dash-tab.active { color:var(--primary); border-bottom-color:var(--primary); }
                    .dash-tab:hover { color:var(--primary); }
                    .dash-card { padding:1rem; border:1px solid #e2e8f0; border-radius:14px; margin-bottom:0.75rem; background:#fff; transition:box-shadow 0.2s; }
                    .dash-card:hover { box-shadow:0 2px 8px rgba(0,0,0,0.05); }
                    .dash-label { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:0.25rem; }
                    .dash-value { font-weight:600; color:#1e293b; font-size:0.95rem; }
                    .dash-input { width:100%; padding:0.6rem 0.75rem; border:1px solid #e2e8f0; border-radius:10px; font-size:0.9rem; box-sizing:border-box; font-family:inherit; transition:border-color 0.2s; }
                    .dash-input:focus { outline:none; border-color:var(--primary); }
                    .dash-btn { padding:0.6rem 1.25rem; border:none; border-radius:10px; font-weight:700; cursor:pointer; font-size:0.85rem; transition:all 0.2s; font-family:inherit; }
                    .dash-btn-primary { background:var(--primary); color:#fff; }
                    .dash-btn-primary:hover { opacity:0.9; }
                    .dash-btn-outline { background:none; border:1px solid #e2e8f0; color:#64748b; }
                    .dash-btn-outline:hover { border-color:#cbd5e1; }
                    .dash-btn-danger { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
                    .dash-btn-danger:hover { background:#fee2e2; }
                    .dash-badge { font-size:0.7rem; padding:2px 8px; border-radius:10px; font-weight:700; }
                    .dash-empty { text-align:center; padding:2rem 1rem; color:#94a3b8; }
                    .dash-empty svg { margin-bottom:0.75rem; opacity:0.3; }
                `;
                document.head.appendChild(s);
            }

            // Build tabs
            content.innerHTML = `
                <div class="dash-tabs">
                    <button class="dash-tab ${this._dashboardTab === 'profile' ? 'active' : ''}" onclick="D2C_CUSTOMER.switchTab('profile')">Profile</button>
                    <button class="dash-tab ${this._dashboardTab === 'addresses' ? 'active' : ''}" onclick="D2C_CUSTOMER.switchTab('addresses')">Addresses</button>
                    <button class="dash-tab ${this._dashboardTab === 'orders' ? 'active' : ''}" onclick="D2C_CUSTOMER.switchTab('orders')">Orders</button>
                </div>
                <div id="dash-tab-content"><div style="text-align:center;padding:2rem;color:#94a3b8">Loading...</div></div>
            `;

            document.getElementById('customer-dashboard').style.right = '0';
            document.getElementById('customer-overlay').style.display = 'block';
            document.body.classList.add('cart-open');

            await this.renderTab();
        },

        async switchTab(tab) {
            this._dashboardTab = tab;
            // Update active tab styling
            document.querySelectorAll('.dash-tab').forEach(t => {
                t.classList.toggle('active', t.textContent.trim().toLowerCase() === tab);
            });
            await this.renderTab();
        },

        async renderTab() {
            const container = document.getElementById('dash-tab-content');
            if (!container) return;

            switch (this._dashboardTab) {
                case 'profile':
                    this.renderProfileTab(container);
                    break;
                case 'addresses':
                    await this.renderAddressesTab(container);
                    break;
                case 'orders':
                    await this.renderOrdersTab(container);
                    break;
            }
        },

        _editingProfile: false,

        renderProfileTab(container) {
            const u = this.user;
            if (this._editingProfile) {
                container.innerHTML = `
                    <form id="profile-edit-form" style="display:flex; flex-direction:column; gap:1rem">
                        <div>
                            <div class="dash-label">Full Name</div>
                            <input class="dash-input" name="name" value="${u.name || ''}" placeholder="Your name" required>
                        </div>
                        <div>
                            <div class="dash-label">Email</div>
                            <input class="dash-input" name="email" value="${u.email || ''}" type="email" placeholder="you@example.com" required>
                        </div>
                        <div>
                            <div class="dash-label">Phone</div>
                            <input class="dash-input" name="phone" value="${u.phone || ''}" type="tel" placeholder="+1 (555) 123-4567">
                        </div>
                        <div style="display:flex; gap:0.75rem; margin-top:0.5rem">
                            <button type="submit" class="dash-btn dash-btn-primary" style="flex:1">Save Changes</button>
                            <button type="button" class="dash-btn dash-btn-outline" onclick="D2C_CUSTOMER._editingProfile=false; D2C_CUSTOMER.renderTab()">Cancel</button>
                        </div>
                    </form>
                `;
                document.getElementById('profile-edit-form').onsubmit = async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    const btn = e.target.querySelector('button[type="submit"]');
                    btn.disabled = true; btn.textContent = 'Saving...';
                    const ok = await this.updateProfile({ name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone') });
                    if (ok) {
                        this._editingProfile = false;
                        this.updateHeaderUI();
                        this.showToast('Profile updated!');
                        this.renderTab();
                    } else {
                        this.showToast('Failed to update profile.', 'error');
                        btn.disabled = false; btn.textContent = 'Save Changes';
                    }
                };
            } else {
                const initials = (u.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                container.innerHTML = `
                    <div style="text-align:center; margin-bottom:1.5rem">
                        <div style="width:64px; height:64px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.25rem; margin:0 auto 0.75rem">${initials}</div>
                        <div style="font-weight:800; font-size:1.1rem">${u.name}</div>
                        <div style="color:#64748b; font-size:0.875rem; margin-top:0.25rem">${u.role === 'b2c' ? 'D2C Customer' : u.role}</div>
                    </div>
                    <div class="dash-card">
                        <div class="dash-label">Email</div>
                        <div class="dash-value">${u.email}</div>
                    </div>
                    ${u.phone ? `
                    <div class="dash-card">
                        <div class="dash-label">Phone</div>
                        <div class="dash-value">${u.phone}</div>
                    </div>` : ''}
                    <div class="dash-card">
                        <div class="dash-label">Member Since</div>
                        <div class="dash-value">${new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    <button class="dash-btn dash-btn-primary" style="width:100%; margin-top:0.5rem" onclick="D2C_CUSTOMER._editingProfile=true; D2C_CUSTOMER.renderTab()">Edit Profile</button>
                `;
            }
        },

        _showAddressForm: false,

        async renderAddressesTab(container) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8">Loading addresses...</div>';
            const addresses = await this.getAddresses();

            if (this._showAddressForm) {
                container.innerHTML = `
                    <h3 style="font-size:1rem; font-weight:800; margin-bottom:1rem">New Address</h3>
                    <form id="address-form" style="display:flex; flex-direction:column; gap:0.75rem">
                        <div>
                            <div class="dash-label">Label (e.g. Home, Work)</div>
                            <input class="dash-input" name="addressLabel" placeholder="Home" required>
                        </div>
                        <div>
                            <div class="dash-label">Recipient Name</div>
                            <input class="dash-input" name="recipientName" placeholder="John Doe" required>
                        </div>
                        <div>
                            <div class="dash-label">Phone</div>
                            <input class="dash-input" name="phoneNumber" type="tel" placeholder="+1 (555) 123-4567">
                        </div>
                        <div>
                            <div class="dash-label">Street</div>
                            <input class="dash-input" name="street" placeholder="123 Main St" required>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem">
                            <div>
                                <div class="dash-label">City</div>
                                <input class="dash-input" name="city" placeholder="New York" required>
                            </div>
                            <div>
                                <div class="dash-label">State</div>
                                <input class="dash-input" name="state" placeholder="NY" required>
                            </div>
                        </div>
                        <div>
                            <div class="dash-label">ZIP Code</div>
                            <input class="dash-input" name="zip" placeholder="10001" required>
                        </div>
                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; font-weight:600; color:#475569; cursor:pointer">
                            <input type="checkbox" name="isDefaultShipping"> Set as default shipping address
                        </label>
                        <div style="display:flex; gap:0.75rem; margin-top:0.5rem">
                            <button type="submit" class="dash-btn dash-btn-primary" style="flex:1">Save Address</button>
                            <button type="button" class="dash-btn dash-btn-outline" onclick="D2C_CUSTOMER._showAddressForm=false; D2C_CUSTOMER.renderTab()">Cancel</button>
                        </div>
                    </form>
                `;
                document.getElementById('address-form').onsubmit = async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    const btn = e.target.querySelector('button[type="submit"]');
                    btn.disabled = true; btn.textContent = 'Saving...';
                    const payload = {
                        recipientName: fd.get('recipientName'),
                        phoneNumber: fd.get('phoneNumber') || '',
                        addressLabel: fd.get('addressLabel'),
                        isDefaultShipping: !!fd.get('isDefaultShipping'),
                        address: { street: fd.get('street'), city: fd.get('city'), state: fd.get('state'), zip: fd.get('zip') }
                    };
                    const ok = await this.addAddress(payload);
                    if (ok) {
                        this._showAddressForm = false;
                        this.showToast('Address added!');
                        this.renderTab();
                    } else {
                        this.showToast('Failed to save address.', 'error');
                        btn.disabled = false; btn.textContent = 'Save Address';
                    }
                };
                return;
            }

            let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
                    <h3 style="font-size:1rem; font-weight:800; margin:0">My Addresses</h3>
                    <button class="dash-btn dash-btn-primary" style="font-size:0.8rem; padding:0.5rem 1rem" onclick="D2C_CUSTOMER._showAddressForm=true; D2C_CUSTOMER.renderTab()">+ Add New</button>
                </div>
            `;

            if (addresses.length === 0) {
                html += `
                    <div class="dash-empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <p style="font-weight:600">No addresses yet</p>
                        <p style="font-size:0.8rem">Add a shipping address to speed up checkout.</p>
                    </div>
                `;
            } else {
                addresses.forEach(a => {
                    const addr = a.address || {};
                    html += `
                        <div class="dash-card">
                            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.5rem">
                                <div>
                                    <span style="font-weight:700">${a.addressLabel || 'Address'}</span>
                                    ${a.isDefaultShipping ? '<span class="dash-badge" style="background:#f0fdf4;color:#16a34a;margin-left:0.5rem">Default</span>' : ''}
                                </div>
                                <button class="dash-btn dash-btn-danger" style="font-size:0.75rem; padding:0.3rem 0.75rem" onclick="D2C_CUSTOMER.confirmDeleteAddress('${a.id}')">Remove</button>
                            </div>
                            <div style="font-size:0.9rem; color:#475569; line-height:1.5">
                                <div style="font-weight:600">${a.recipientName || ''}</div>
                                <div>${addr.street || ''}</div>
                                <div>${addr.city || ''}${addr.state ? ', ' + addr.state : ''} ${addr.zip || ''}</div>
                                ${a.phoneNumber ? '<div style="margin-top:0.25rem; color:#64748b">' + a.phoneNumber + '</div>' : ''}
                            </div>
                        </div>
                    `;
                });
            }
            container.innerHTML = html;
        },

        async confirmDeleteAddress(id) {
            if (confirm('Remove this address?')) {
                const ok = await this.deleteAddress(id);
                if (ok) {
                    this.showToast('Address removed.');
                    this.renderTab();
                } else {
                    this.showToast('Failed to remove address.', 'error');
                }
            }
        },

        async renderOrdersTab(container) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8">Loading orders...</div>';
            const orders = (await this.getOrders()) || [];
            orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            if (orders.length === 0) {
                container.innerHTML = `
                    <div class="dash-empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
                        <p style="font-weight:600">No orders yet</p>
                        <p style="font-size:0.8rem">Your order history will appear here.</p>
                    </div>
                `;
                return;
            }

            const statusColors = { pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#16a34a', cancelled: '#ef4444' };

            container.innerHTML = `
                <h3 style="font-size:1rem; font-weight:800; margin-bottom:1rem">Order History</h3>
                ${orders.map(o => {
                const color = statusColors[o.status] || '#64748b';
                return `
                    <div class="dash-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
                            <span style="font-weight:700; font-size:0.9rem">Order #${(o._id || o.id || '').slice(-6)}</span>
                            <span style="font-weight:800; color:var(--primary)">$${(o.grandTotal || 0).toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center">
                            <span class="dash-badge" style="background:${color}15; color:${color}">${o.status}</span>
                            <span style="font-size:0.75rem; color:#94a3b8">${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''}</span>
                        </div>
                    </div>`;
            }).join('')}
            `;
        },


        hideDashboard() {
            document.getElementById('customer-dashboard').style.right = '-450px';
            document.getElementById('customer-overlay').style.display = 'none';
            document.body.classList.remove('cart-open');
        },

        updateHeaderUI() {
            const container = document.getElementById('customer-nav');
            if (!container) return;

            if (this.user) {
                container.innerHTML = `
                    <button class="nav-btn-user" onclick="D2C_CUSTOMER.showDashboard()" style="background:none; border:none; cursor:pointer; font-weight:700; color:var(--text); font-family:inherit">
                        Hello, ${this.user.name.split(' ')[0]}
                    </button>
                `;
            } else {
                container.innerHTML = `
                    <button class="nav-btn-signin" onclick="D2C_CUSTOMER.showLoginModal()" style="background:none; border:1px solid var(--primary); color:var(--primary); padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:700; font-family:inherit">
                        Sign In
                    </button>
                `;
            }
        },

        showLoginModal() {
            this.hideDashboard();
            document.getElementById('login-modal').classList.add('open');
            document.getElementById('customer-overlay').style.display = 'block';
        },

        hideLoginModal() {
            document.getElementById('login-modal').classList.remove('open');
            document.getElementById('customer-overlay').style.display = 'none';
        },

        createLoginUI() {
            const modal = document.createElement('div');
            modal.id = 'login-modal';
            modal.className = 'login-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <button class="close-btn" style="position:absolute; right:1.5rem; top:1.5rem; font-size:1.5rem; background:none; border:none; cursor:pointer" onclick="D2C_CUSTOMER.hideLoginModal()">&times;</button>
                    <div id="auth-form-container">
                        <h2>Welcome Back</h2>
                        <p>Sign in to your ${window.D2C_CONFIG.companyName} account</p>
                        <form onsubmit="D2C_CUSTOMER.handleAuth(event)">
                            <div class="form-group">
                                <label>Email Address</label>
                                <input type="email" name="email" required placeholder="you@example.com">
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" name="password" required placeholder="••••••••">
                            </div>
                            <button type="submit" class="checkout-btn" style="width:100%; padding:1rem; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:700; cursor:pointer">Sign In</button>
                        </form>
                        <p class="toggle-auth" style="text-align:center; margin-top:1.5rem; font-size:0.875rem">New here? <a href="#" style="color:var(--primary); font-weight:700; text-decoration:none" onclick="D2C_CUSTOMER.toggleAuthMode('register')">Create Account</a></p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const style = document.createElement('style');
            style.textContent = `
                .login-modal {
                    position: fixed;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -40%);
                    background: white;
                    width: 90%;
                    max-width: 400px;
                    border-radius: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    z-index: 2002;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                }
                .login-modal.open {
                    opacity: 1;
                    pointer-events: auto;
                    transform: translate(-50%, -50%);
                }
                .modal-content { padding: 2.5rem; position: relative; }
                .modal-content h2 { font-size: 1.75rem; font-weight: 800; margin: 0 0 0.5rem; }
                .modal-content p { color: #64748b; margin-bottom: 2rem; }
                .form-group { margin-bottom: 1.5rem; }
                .form-group label { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: #334155; }
                .form-group input { 
                    width: 100%; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 12px;
                    font-size: 1rem; transition: border-color 0.2s; box-sizing: border-box;
                }
                .form-group input:focus { outline: none; border-color: var(--primary); }
                
                #customer-nav button:hover {
                    color: white !important;
                }
                #customer-nav .nav-btn-signin:hover {
                    background-color: var(--primary) !important;
                }
            `;
            document.head.appendChild(style);
        },

        toggleAuthMode(mode) {
            const container = document.getElementById('auth-form-container');
            if (mode === 'register') {
                container.innerHTML = `
                    <h2>Join Us</h2>
                    <p>Create an account at ${window.D2C_CONFIG.companyName}</p>
                    <form onsubmit="D2C_CUSTOMER.handleAuth(event, 'register')">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" name="name" required placeholder="John Doe">
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" name="email" required placeholder="you@example.com">
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" required placeholder="••••••••">
                        </div>
                        <button type="submit" class="checkout-btn" style="width:100%; padding:1rem; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:700; cursor:pointer">Create Account</button>
                    </form>
                    <p class="toggle-auth" style="text-align:center; margin-top:1.5rem; font-size:0.875rem">Already have an account? <a href="#" style="color:var(--primary); font-weight:700; text-decoration:none" onclick="D2C_CUSTOMER.toggleAuthMode('login')">Sign In</a></p>
                `;
            } else {
                container.innerHTML = `
                    <h2>Welcome Back</h2>
                    <p>Sign in to your ${window.D2C_CONFIG.companyName} account</p>
                    <form onsubmit="D2C_CUSTOMER.handleAuth(event)">
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" name="email" required placeholder="you@example.com">
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" required placeholder="••••••••">
                        </div>
                        <button type="submit" class="checkout-btn" style="width:100%; padding:1rem; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:700; cursor:pointer">Sign In</button>
                    </form>
                    <p class="toggle-auth" style="text-align:center; margin-top:1.5rem; font-size:0.875rem">New here? <a href="#" style="color:var(--primary); font-weight:700; text-decoration:none" onclick="D2C_CUSTOMER.toggleAuthMode('register')">Create Account</a></p>
                `;
            }
        },

        showToast(message, type = 'success') {
            const existing = document.getElementById('d2c-toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.id = 'd2c-toast';
            const bg = type === 'success' ? '#16a34a' : '#dc2626';
            toast.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:1rem 2rem;border-radius:14px;font-weight:700;font-size:0.95rem;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.15);opacity:0;transition:opacity 0.3s;font-family:inherit`;
            toast.textContent = message;
            document.body.appendChild(toast);
            requestAnimationFrame(() => toast.style.opacity = '1');
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
        },

        async handleAuth(e, mode = 'login') {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // Disable button and show loading state
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.textContent = mode === 'register' ? 'Creating Account...' : 'Signing In...';

            try {
                if (mode === 'register') {
                    const companyCode = window.D2C_CONFIG.companyCode;

                    const response = await fetch(`${API_BASE}/accounts/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...data,
                            role: 'b2c',
                            code: companyCode
                        })
                    });

                    if (response.ok) {
                        this.showToast('Account created! Signing you in...');
                        // Register returns account object, not a token — auto-login with same credentials
                        const loginSuccess = await this.login(data.email, data.password);
                        if (loginSuccess) {
                            this.hideLoginModal();
                            this.showDashboard();
                        } else {
                            this.showToast('Account created but auto-login failed. Please sign in manually.', 'error');
                            this.toggleAuthMode('login');
                        }
                    } else {
                        const errData = await response.json().catch(() => null);
                        this.showToast(errData?.message || 'Registration failed. Please try again.', 'error');
                    }
                } else {
                    const success = await this.login(data.email, data.password);
                    if (success) {
                        this.showToast('Welcome back!');
                        this.hideLoginModal();
                        this.showDashboard();
                    } else {
                        this.showToast('Invalid email or password.', 'error');
                    }
                }
            } catch (err) {
                console.error('Auth Error:', err);
                this.showToast('Something went wrong. Please try again.', 'error');
            } finally {
                // Re-enable button
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = originalText;
            }
        }
    };

    window.addEventListener('DOMContentLoaded', () => Customer.init());
    window.D2C_CUSTOMER = Customer;
})();
