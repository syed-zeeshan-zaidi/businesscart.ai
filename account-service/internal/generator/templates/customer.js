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

            let orderGrandTotal = 0;
            let orderItems = [];
            if (orderId && this.token) {
                try {
                    const orders = await this.getOrders();
                    const order = orders?.find(o => (o._id || o.id) === orderId);
                    const details = document.getElementById('order-confirm-details');
                    if (order && details) {
                        orderGrandTotal = order.grandTotal || 0;
                        orderItems = (order.items || []).map(function (it) { return { id: it.productId, quantity: it.quantity, price: it.discountedPrice || it.price }; });
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
                                    ${order.promoDiscount && order.promoDiscount > 0 ? (() => { const escCode = String(order.promoCode || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); return `<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#059669;margin-bottom:0.5rem;"><span>Discount${escCode ? ' (' + escCode + ')' : ''}</span><span>-$${order.promoDiscount.toFixed(2)}</span></div>`; })() : ''}
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
            // Fire conversion event exactly once per orderId, with real grandTotal when available.
            // Tracking must never break the order-confirmation UI: guard the method and
            // swallow any error (the order is already placed at this point).
            try {
                if (orderId && window.D2C_TRACKER && window.D2C_TRACKER.trackOrder) {
                    this._trackedOrderIds = this._trackedOrderIds || new Set();
                    if (!this._trackedOrderIds.has(orderId)) {
                        this._trackedOrderIds.add(orderId);
                        window.D2C_TRACKER.trackOrder(orderId, orderGrandTotal, orderItems);
                    }
                }
            } catch (e) {}
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

        async reorder(orderId) {
            if (!this.token || !window.D2C_CART) return;
            var orders = await this.getOrders();
            var order = orders.find(function(o) { return (o._id || o.id) === orderId; });
            if (!order || !order.items || order.items.length === 0) return;
            window.D2C_CART.clear();
            for (var i = 0; i < order.items.length; i++) {
                var item = order.items[i];
                window.D2C_CART.items.push({
                    _id: item.productId,
                    name: item.name,
                    price: item.price,
                    discountedPrice: item.discountedPrice || 0,
                    image: item.image || '',
                    quantity: item.quantity
                });
            }
            window.D2C_CART.saveCart();
            this.hideDashboard();
            window.D2C_CART.showDrawer();
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

        async createQuote(sellerId, addresses, promoCode) {
            if (!this.token) return null;
            const cfg = window.D2C_CONFIG || {};
            const body = {
                sellerId: sellerId,
                paymentMethods: cfg.paymentMethods || ['pickup_&_pay'],
                deliveryMethods: cfg.deliveryMethods || ['shipping_out'],
                shippingOutOptions: cfg.shippingOutOptions || ['standard'],
                quotesAllowed: false,
                companyLocations: [],
                customerAddresses: addresses || [],
                configurations: [],
                quoteType: 'standard'
            };
            // Coupon: only sent if the company has the feature enabled (baked into
            // D2C_CONFIG at storefront-gen time). Customer-level override on the JWT
            // is applied server-side; the server is the source of truth.
            if (cfg.couponsEnabled) {
                body.couponsEnabled = true;
                if (promoCode) body.promoCode = String(promoCode).trim();
            }
            const response = await fetch(`${API_BASE}/checkout/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(body)
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
            const visitorId = (function(){ try { return localStorage.getItem('bc_visitor_id') || ''; } catch(e) { return ''; } })();
            const clickIds = (function(){ try { return JSON.parse(localStorage.getItem('bc_clickids') || '{}'); } catch(e) { return {}; } })();
            const body = {
                quoteId: quoteId,
                paymentMethod: paymentMethod || 'pickup_&_pay',
                deliveryMethod: deliveryMethod || 'shipping_out',
                returnUrl: window.location.protocol === 'file:' ? (document.querySelector('link[rel="canonical"]')?.href || window.D2C_CONFIG.apiBase) : window.location.origin + window.location.pathname,
                visitorId: visitorId,
                clickIds: clickIds
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
            if (!cartItems || cartItems.length === 0) return;

            // Fire InitiateCheckout for EVERYONE who reaches checkout — including
            // guests, BEFORE the auth branch — so guest intent is captured. (Guests
            // used to hit the login wall here and never fire it, which is why
            // initiate_checkout read 0.) Isolated so tracking can never break checkout.
            this._fireInitiateCheckout(cartItems);

            // Guest checkout: no login wall. Capture email, create a passwordless
            // b2c account, then run the exact same checkout as a logged-in customer.
            if (!this.token || !this.user) {
                this.showGuestCheckout(cartItems);
                return;
            }
            await this._continueCheckout(cartItems);
        },

        _fireInitiateCheckout(cartItems) {
            try {
                if (window.D2C_TRACKER && window.D2C_TRACKER.trackInitiateCheckout) {
                    let total = 0;
                    const icItems = (cartItems || []).map(function (it) {
                        const price = it.discountedPrice || it.price || 0;
                        total += price * (it.quantity || 1);
                        return { id: it._id, quantity: it.quantity || 1, price: price };
                    });
                    window.D2C_TRACKER.trackInitiateCheckout(total, icItems);
                }
            } catch (e) {}
        },

        // Runs checkout once a token+user exist (logged-in OR just-registered guest):
        // sync cart → quote → checkout overlay (which handles the shipping address +
        // payment method, including its own add-address form for new customers).
        async _continueCheckout(cartItems) {
            const sellerId = window.D2C_CONFIG?.sellerId;
            if (!sellerId || !cartItems || cartItems.length === 0) return;

            this._showCheckoutLoading();

            try {
                await this.clearCart(sellerId);
                for (const item of cartItems) {
                    const result = await this.addToCart({
                        productId: item._id,
                        quantity: item.quantity || 1,
                        sellerId: sellerId,
                        partnerId: item.partnerId || '',
                        name: item.name || 'Product',
                        price: item.price || 0,
                        discountedPrice: item.discountedPrice,
                        image: item.image
                    });
                    if (!result) throw new Error('Failed to add item to server cart');
                }

                const addresses = await this.getAddresses();
                const customerAddresses = (addresses || []).map(a => ({
                    id: a._id || a.id,
                    addressLabel: a.addressLabel || 'Address',
                    recipientName: a.recipientName || '',
                    phoneNumber: a.phoneNumber || '',
                    address: a.address || {},
                    isDefaultShipping: !!a.isDefaultShipping
                }));
                const quote = await this.createQuote(sellerId, customerAddresses);
                if (!quote) throw new Error('Failed to create quote');

                this._showCheckoutOverlay(quote);
            } catch (err) {
                console.error('Checkout failed:', err);
                document.getElementById('d2c-checkout-overlay')?.remove();
                if (window.D2C_CART) window.D2C_CART.showToast(err.message || 'Checkout failed. Please try again.');
            }
        },

        // Guest checkout: one lean modal for name + email (no password). On submit,
        // create a passwordless b2c account (server seals it; claimable later via the
        // password-reset flow) and continue straight into checkout. A returning email
        // (409) routes to sign-in. Inline styles + no external requests (Lighthouse).
        showGuestCheckout(cartItems) {
            const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const primaryColor = window.D2C_CONFIG?.primaryColor || '#0d9488';
            document.getElementById('d2c-guest-modal')?.remove();
            const modal = document.createElement('div');
            modal.id = 'd2c-guest-modal';
            modal.style = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);padding:1rem';
            modal.innerHTML = `
                <div style="background:#fff;border-radius:16px;padding:2rem;max-width:26rem;width:100%;box-shadow:0 20px 50px rgba(0,0,0,0.25)">
                    <h2 style="margin:0 0 0.25rem;font-size:1.35rem;font-weight:800;color:#111827">Checkout</h2>
                    <p style="margin:0 0 1.25rem;font-size:0.875rem;color:#6b7280">Enter your details to continue. No account or password needed.</p>
                    <form id="d2c-guest-form">
                        <label style="display:block;font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:0.35rem">Full name</label>
                        <input name="name" required autocomplete="name" style="width:100%;padding:0.7rem 0.85rem;border:1px solid #d1d5db;border-radius:10px;font-size:0.95rem;margin-bottom:1rem;box-sizing:border-box">
                        <label style="display:block;font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:0.35rem">Email</label>
                        <input name="email" type="email" required autocomplete="email" style="width:100%;padding:0.7rem 0.85rem;border:1px solid #d1d5db;border-radius:10px;font-size:0.95rem;margin-bottom:1.25rem;box-sizing:border-box">
                        <button type="submit" style="width:100%;padding:0.8rem;background:${esc(primaryColor)};color:#fff;border:0;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer">Continue to shipping &amp; payment</button>
                    </form>
                    <p style="margin:1rem 0 0;text-align:center;font-size:0.8rem;color:#6b7280">Already have an account? <a href="#" id="d2c-guest-signin" style="color:${esc(primaryColor)};font-weight:700;text-decoration:none">Sign in</a></p>
                </div>`;
            document.body.appendChild(modal);
            modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
            modal.querySelector('#d2c-guest-signin').addEventListener('click', e => {
                e.preventDefault(); modal.remove(); this.showLoginModal();
            });
            modal.querySelector('#d2c-guest-form').addEventListener('submit', async e => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = true; btn.textContent = 'Please wait...';
                const fd = new FormData(e.target);
                try {
                    const resp = await fetch(`${API_BASE}/accounts/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: fd.get('name'), email: String(fd.get('email')).trim(), role: 'b2c', code: window.D2C_CONFIG.companyCode })
                    });
                    if (resp.status === 409) {
                        modal.remove();
                        if (window.D2C_CART) window.D2C_CART.showToast('You already have an account — please sign in.');
                        this.showLoginModal();
                        return;
                    }
                    const data = resp.ok ? await resp.json() : null;
                    if (!data || !data.accessToken) throw new Error('Could not start checkout. Please try again.');
                    this.token = data.accessToken;
                    localStorage.setItem(AUTH_KEY, this.token);
                    this.user = data.account;
                    modal.remove();
                    await this._continueCheckout(cartItems);
                } catch (err) {
                    btn.disabled = false; btn.textContent = 'Continue to shipping & payment';
                    if (window.D2C_CART) window.D2C_CART.showToast(err.message || 'Something went wrong.');
                }
            });
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

        // Renders only the totals block. Called on initial overlay render and again
        // after a coupon is applied (innerHTML swap, no full overlay rebuild).
        // Inline escape (escText is scoped inside _showCheckoutOverlay; this method
        // is invoked both from inside that scope and from the apply handler).
        _renderCheckoutTotals(quote) {
            const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const promo = quote.promoDiscount || 0;
            return `
                <div class="checkout-summary-row"><span>Subtotal</span><span>$${(quote.subtotal || 0).toFixed(2)}</span></div>
                <div class="checkout-summary-row"><span>Shipping</span><span>$${(quote.shippingCost || 0).toFixed(2)}</span></div>
                <div class="checkout-summary-row"><span>Tax</span><span>$${(quote.taxAmount || 0).toFixed(2)}</span></div>
                ${promo > 0 ? `<div class="checkout-summary-row" style="color:#059669"><span>Discount${quote.promoCode ? ' (' + esc(quote.promoCode) + ')' : ''}</span><span>-$${promo.toFixed(2)}</span></div>` : ''}
                <div class="checkout-summary-row total"><span>Grand Total</span><span>$${(quote.grandTotal || 0).toFixed(2)}</span></div>
            `;
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

            // Human-readable labels for raw enum values from the API.
            // Customers should never see "shipping_out" or "pickup_&_pay".
            const PAYMENT_LABELS = {
                amazon_pay: 'Amazon Pay',
                stripe_pay: 'Credit / Debit Card',
                google_pay: 'Google Pay',
                credit_card: 'Credit Card',
                purchase_order: 'Purchase Order',
                'pickup_&_pay': 'Pay at Pickup',
                deliver_pay: 'Pay on Delivery',
            };
            const DELIVERY_LABELS = {
                shipping_out: 'Ship to my address',
                pickup: 'Pick up at store',
                dropoff: 'Local delivery',
            };
            const labelFor = (map, key) => map[key] || (key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            // Inline SVG icons (currentColor, 20px) — no external requests, theme-aware.
            const ICON_CARD = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 15h2"/></svg>';
            const ICON_BAG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
            const ICON_PHONE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
            const ICON_DOC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>';
            const ICON_CASH = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
            const ICON_TRUCK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
            const ICON_STORE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-6h16l1 6"/><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 21V13h6v8"/></svg>';
            const ICON_MAP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

            const PAYMENT_ICONS = {
                amazon_pay: ICON_BAG,
                stripe_pay: ICON_CARD,
                google_pay: ICON_PHONE,
                credit_card: ICON_CARD,
                purchase_order: ICON_DOC,
                'pickup_&_pay': ICON_CASH,
                deliver_pay: ICON_CASH,
            };
            const DELIVERY_ICONS = {
                shipping_out: ICON_TRUCK,
                pickup: ICON_STORE,
                dropoff: ICON_MAP,
            };
            const iconFor = (map, key) => map[key] || ICON_DOC;
            // HTML escapers — used everywhere user-supplied text/attributes are interpolated.
            const escText = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const escAttr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            // Address state — closure-scoped so we can re-render just the address slot
            // when the customer adds a new address inline (without rebuilding the modal).
            let addrList = customerAddresses.slice();
            let addrPreselectId = (addrList.find(a => a.isDefaultShipping) || addrList[0])?.id;
            const user = this.user || {};
            const defaultRecipient = `${user.firstName || ''} ${user.lastName || ''}`.trim();

            const buildAddressListHtml = () => {
                if (addrList.length === 0) {
                    // Zero-state path is unchanged — closes modal + opens dashboard address tab.
                    return `<div id="checkout-new-address-section">
                        <p style="font-size:13px;color:#9ca3af;padding:4px 0 8px">No saved addresses.</p>
                        <button type="button" onclick="document.getElementById('d2c-checkout-overlay')?.remove(); D2C_CUSTOMER._showAddressForm=true; D2C_CUSTOMER._dashboardTab='addresses'; D2C_CUSTOMER.showDashboard();" style="background:var(--primary);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">+ Add Delivery Address</button>
                    </div>`;
                }
                return `
                    <select id="checkout-address" class="checkout-select">
                        ${addrList.map(a => `<option value="${escAttr(a.id)}" ${a.id === addrPreselectId ? 'selected' : ''}>${escText((a.addressLabel || 'Address') + (a.isDefaultShipping ? ' (Default)' : '') + ': ' + (a.address?.street || '') + ', ' + (a.address?.city || ''))}</option>`).join('')}
                    </select>
                    <button type="button" class="checkout-add-link" data-action="open-add-form">+ Add new address</button>
                `;
            };

            const buildAddressFormHtml = () => `
                <form id="checkout-add-address-form" class="checkout-form">
                    <div>
                        <label class="checkout-form-label" for="addr-label">Label</label>
                        <input class="checkout-input" id="addr-label" name="addressLabel" placeholder="Home, Work" required>
                    </div>
                    <div>
                        <label class="checkout-form-label" for="addr-recipient">Recipient name</label>
                        <input class="checkout-input" id="addr-recipient" name="recipientName" value="${escAttr(defaultRecipient)}" required>
                    </div>
                    <div>
                        <label class="checkout-form-label" for="addr-phone">Phone (optional)</label>
                        <input class="checkout-input" id="addr-phone" name="phoneNumber" type="tel" autocomplete="tel">
                    </div>
                    <div>
                        <label class="checkout-form-label" for="addr-street">Street address</label>
                        <input class="checkout-input" id="addr-street" name="street" autocomplete="street-address" required>
                    </div>
                    <div class="checkout-form-row">
                        <div>
                            <label class="checkout-form-label" for="addr-city">City</label>
                            <input class="checkout-input" id="addr-city" name="city" autocomplete="address-level2" required>
                        </div>
                        <div>
                            <label class="checkout-form-label" for="addr-state">State</label>
                            <input class="checkout-input" id="addr-state" name="state" autocomplete="address-level1" required>
                        </div>
                    </div>
                    <div>
                        <label class="checkout-form-label" for="addr-zip">ZIP</label>
                        <input class="checkout-input" id="addr-zip" name="zip" autocomplete="postal-code" required>
                    </div>
                    <label class="checkout-checkbox-row">
                        <input type="checkbox" name="isDefaultShipping"> Set as default shipping address
                    </label>
                    <div class="checkout-form-actions">
                        <button type="button" class="checkout-btn-secondary" data-action="cancel-add-form">Cancel</button>
                        <button type="submit" class="checkout-btn-primary-sm">Save Address</button>
                    </div>
                </form>
            `;

            const overlay = document.createElement('div');
            overlay.id = 'd2c-checkout-overlay';
            overlay.innerHTML = `
                <style>
                    #d2c-checkout-overlay {
                        position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center;
                        background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
                    }
                    .checkout-modal {
                        background: #fff; border-radius: 16px; max-width: 560px; width: 92%; max-height: 90vh;
                        box-shadow: 0 25px 50px rgba(0,0,0,0.25); padding: 0;
                        display: flex; flex-direction: column;
                    }
                    .checkout-header {
                        padding: 18px 24px; border-bottom: 1px solid #e5e7eb;
                        display: flex; justify-content: space-between; align-items: center;
                        flex-shrink: 0;
                    }
                    .checkout-header h2 { margin: 0; font-size: 20px; font-weight: 700; color: #111; }
                    .checkout-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #6b7280; padding: 4px 10px; line-height: 1; border-radius: 8px; }
                    .checkout-close:hover { background: #f3f4f6; color: #111; }
                    .checkout-body { padding: 18px 24px 8px; flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; }
                    .checkout-item {
                        display: flex; align-items: center; gap: 12px;
                        padding: 12px 0; border-bottom: 1px solid #f3f4f6;
                    }
                    .checkout-item-thumb {
                        width: 56px; height: 56px; border-radius: 8px; object-fit: cover;
                        border: 1px solid #e5e7eb; flex-shrink: 0; background: #f9fafb;
                    }
                    .checkout-item-thumb-placeholder {
                        width: 56px; height: 56px; border-radius: 8px; background: #f3f4f6;
                        display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 20px;
                        flex-shrink: 0; border: 1px solid #e5e7eb;
                    }
                    .checkout-item-info { flex: 1; min-width: 0; }
                    .checkout-item-name { font-weight: 600; color: #111; font-size: 14px; line-height: 1.35; word-break: break-word; }
                    .checkout-item-detail { color: #6b7280; font-size: 13px; margin-top: 2px; }
                    .checkout-item-price { font-weight: 700; color: #111; font-size: 14px; flex-shrink: 0; }
                    .checkout-summary-row {
                        display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #6b7280;
                    }
                    .checkout-summary-row.total {
                        border-top: 2px solid #111; margin-top: 8px; padding-top: 12px;
                        font-size: 18px; font-weight: 700; color: #111;
                    }
                    .checkout-section { margin-top: 22px; }
                    .checkout-section h3 {
                        font-size: 14px; font-weight: 700; color: #111;
                        text-transform: none; letter-spacing: 0; margin: 0 0 10px;
                    }
                    .checkout-select {
                        width: 100%; padding: 11px 12px; border: 1px solid #d1d5db; border-radius: 8px;
                        font-size: 14px; color: #111; background: #fff; appearance: auto;
                    }
                    .checkout-select:focus { outline: 2px solid var(--primary, #0d9488); outline-offset: 1px; border-color: transparent; }
                    .checkout-radio-group { display: flex; flex-direction: column; gap: 8px; }
                    .checkout-radio {
                        display: flex; align-items: center; gap: 10px; padding: 12px 14px;
                        border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer; background: #fff;
                        transition: border-color 0.15s, background 0.15s;
                    }
                    .checkout-radio:hover { border-color: #9ca3af; background: #f9fafb; }
                    .checkout-radio input { margin: 0; accent-color: var(--primary, #0d9488); }
                    .checkout-radio label { font-size: 14px; color: #111; cursor: pointer; font-weight: 500; flex: 1; }
                    .checkout-method-icon {
                        display: inline-flex; align-items: center; justify-content: center;
                        width: 32px; height: 32px; border-radius: 6px;
                        background: #f3f4f6; color: #374151; flex-shrink: 0;
                    }
                    .checkout-radio.locked .checkout-method-icon { background: #fff; }
                    .checkout-radio.locked { background: #f9fafb; cursor: default; border-style: dashed; }
                    .checkout-radio.locked:hover { background: #f9fafb; border-color: #d1d5db; }
                    .checkout-radio.locked label { cursor: default; color: #374151; pointer-events: none; }
                    .checkout-radio.locked input { cursor: default; pointer-events: none; }
                    .checkout-add-link {
                        display: inline-flex; align-items: center; margin-top: 10px;
                        background: none; border: none; padding: 6px 0; cursor: pointer;
                        color: var(--primary, #0d9488); font-size: 14px; font-weight: 600;
                    }
                    .checkout-add-link:hover { text-decoration: underline; }
                    .checkout-form { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
                    .checkout-form-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
                    .checkout-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .checkout-input {
                        width: 100%; padding: 11px 12px; border: 1px solid #d1d5db; border-radius: 8px;
                        font-size: 14px; color: #111; background: #fff; font-family: inherit; box-sizing: border-box;
                    }
                    .checkout-input:focus { outline: 2px solid var(--primary, #0d9488); outline-offset: 1px; border-color: transparent; }
                    .checkout-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; cursor: pointer; padding: 4px 0; }
                    .checkout-checkbox-row input { accent-color: var(--primary, #0d9488); }
                    .checkout-form-actions { display: flex; gap: 10px; margin-top: 6px; }
                    .checkout-form-actions button { flex: 1; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: opacity 0.15s, background 0.15s; font-family: inherit; }
                    .checkout-btn-secondary { background: #fff; border-color: #d1d5db; color: #374151; }
                    .checkout-btn-secondary:hover { background: #f9fafb; }
                    .checkout-btn-primary-sm { background: var(--primary, #0d9488); color: #fff; }
                    .checkout-btn-primary-sm:hover:not(:disabled) { opacity: 0.92; }
                    .checkout-btn-primary-sm:disabled { opacity: 0.5; cursor: not-allowed; }
                    .checkout-footer {
                        padding: 14px 24px 18px; border-top: 1px solid #e5e7eb;
                        background: #fff; box-shadow: 0 -4px 12px rgba(0,0,0,0.04); flex-shrink: 0;
                    }
                    .checkout-trust {
                        display: flex; align-items: center; justify-content: center; gap: 6px;
                        font-size: 12px; color: #6b7280; margin-bottom: 10px;
                    }
                    .checkout-trust svg { flex-shrink: 0; }
                    .checkout-validation-msg {
                        font-size: 13px; color: #b45309; text-align: center; margin-top: 8px; min-height: 18px;
                    }
                    .checkout-btn {
                        width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 16px; font-weight: 700;
                        color: #fff; cursor: pointer; transition: opacity 0.2s, transform 0.1s;
                    }
                    .checkout-btn:hover:not(:disabled) { opacity: 0.92; }
                    .checkout-btn:active:not(:disabled) { transform: scale(0.99); }
                    .checkout-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                    .checkout-status { text-align: center; padding: 8px 0; font-size: 14px; color: #6b7280; }
                    @media (max-width: 480px) {
                        .checkout-modal { width: 96%; max-height: 95vh; border-radius: 12px; }
                        .checkout-header, .checkout-body, .checkout-footer { padding-left: 16px; padding-right: 16px; }
                        .checkout-item-thumb, .checkout-item-thumb-placeholder { width: 48px; height: 48px; }
                        .checkout-select { padding: 14px 12px; min-height: 48px; }
                        .checkout-radio { padding: 14px; min-height: 48px; }
                        .checkout-close { font-size: 32px; padding: 6px 12px; }
                        .checkout-btn { padding: 16px; font-size: 17px; min-height: 52px; }
                    }
                </style>
                <div class="checkout-modal">
                    <div class="checkout-header">
                        <h2>Checkout</h2>
                        <button class="checkout-close" onclick="document.getElementById('d2c-checkout-overlay').remove()">&times;</button>
                    </div>
                    <div class="checkout-body">
                        ${(quote.items || []).map(item => {
                            const lineTotal = item.lineItemTotal || ((item.discountedPrice || item.price || 0) * (item.quantity || 1));
                            const img = item.image || '';
                            return `
                            <div class="checkout-item">
                                ${img
                                    ? `<img class="checkout-item-thumb" src="${escAttr(img)}" alt="${escAttr(item.name || 'Product')}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'checkout-item-thumb-placeholder',textContent:'📦'}))">`
                                    : `<div class="checkout-item-thumb-placeholder">📦</div>`}
                                <div class="checkout-item-info">
                                    <div class="checkout-item-name">${escText(item.name || 'Product')}</div>
                                    <div class="checkout-item-detail">Qty: ${item.quantity || 1}</div>
                                </div>
                                <div class="checkout-item-price">$${lineTotal.toFixed(2)}</div>
                            </div>`;
                        }).join('')}
                        <div style="margin-top:12px" id="checkout-totals">
                            ${this._renderCheckoutTotals(quote)}
                        </div>

                        ${(window.D2C_CONFIG || {}).couponsEnabled ? `
                        <div class="checkout-section" id="checkout-coupon-section">
                            <h3>Coupon</h3>
                            <div style="display:flex;gap:8px">
                                <input type="text" id="checkout-coupon-input" placeholder="Enter code (e.g., SAVE10)" value="${escAttr(quote.promoCode || '')}" autocomplete="off" inputmode="latin" style="flex:1;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;text-transform:uppercase">
                                <button type="button" id="checkout-coupon-apply" style="background:var(--primary);color:#fff;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px">Apply</button>
                            </div>
                            <div id="checkout-coupon-status" style="font-size:12px;margin-top:6px;min-height:14px"></div>
                        </div>
                        ` : ''}

                        ${deliveryMethods.length > 1 ? `
                        <div class="checkout-section">
                            <h3>Delivery Method</h3>
                            <div class="checkout-radio-group" id="checkout-delivery-group">
                                ${deliveryMethods.map((m, i) => `
                                    <label class="checkout-radio" for="dlv-${i}">
                                        <input type="radio" name="checkout-delivery-radio" id="dlv-${i}" value="${escAttr(m)}" ${i === 0 ? 'checked' : ''}>
                                        <span class="checkout-method-icon">${iconFor(DELIVERY_ICONS, m)}</span>
                                        <span style="flex:1; font-size:14px; color:#111; font-weight:500">${escText(labelFor(DELIVERY_LABELS, m))}</span>
                                    </label>
                                `).join('')}
                            </div>
                            <input type="hidden" id="checkout-delivery" value="${escAttr(deliveryMethods[0] || '')}">
                        </div>
                        ` : `<input type="hidden" id="checkout-delivery" value="${escAttr(deliveryMethods[0] || '')}">`}

                        <div class="checkout-section" id="checkout-address-section" style="display:${deliveryMethods[0] !== 'pickup' ? 'block' : 'none'}">
                            <h3>Delivery Address</h3>
                            <div id="checkout-address-content">${buildAddressListHtml()}</div>
                        </div>

                        <div class="checkout-section" id="checkout-pickup-section" style="display:${deliveryMethods[0] === 'pickup' ? 'block' : 'none'}">
                            <h3>Pickup Location</h3>
                            ${companyLocations.length > 0 ? `
                                <select id="checkout-pickup" class="checkout-select">
                                    ${companyLocations.length === 1 ? '' : '<option value="">Select a location</option>'}
                                    ${companyLocations.map((l, i) => `<option value="${escAttr(l.id)}" ${i === 0 && companyLocations.length === 1 ? 'selected' : ''}>${escText(l.locationName + ' - ' + (l.address?.street || '') + ', ' + (l.address?.city || ''))}</option>`).join('')}
                                </select>
                            ` : '<div style="font-size:13px;color:#9ca3af;padding:8px 0">No pickup locations available.</div>'}
                        </div>

                        ${shippingOptions.length > 1 ? `
                        <div class="checkout-section" id="checkout-shipping-section" style="display:${deliveryMethods[0] === 'shipping_out' ? 'block' : 'none'}">
                            <h3>Shipping Option</h3>
                            <select id="checkout-shipping" class="checkout-select">
                                ${shippingOptions.map(o => `<option value="${escAttr(o)}">${escText(o)}</option>`).join('')}
                            </select>
                        </div>
                        ` : (shippingOptions.length === 1 ? `<input type="hidden" id="checkout-shipping" value="${escAttr(shippingOptions[0])}">` : '')}

                        ${paymentMethods.length === 0 ? '' : `
                        <div class="checkout-section">
                            <h3>Payment Method</h3>
                            <div class="checkout-radio-group">
                                ${paymentMethods.map((m, i) => `
                                    <div class="checkout-radio${paymentMethods.length === 1 ? ' locked' : ''}">
                                        <input type="radio" name="checkout-payment" id="pay-${i}" value="${escAttr(m)}" ${i === 0 ? 'checked' : ''} ${paymentMethods.length === 1 ? 'tabindex="-1"' : ''}>
                                        <span class="checkout-method-icon">${iconFor(PAYMENT_ICONS, m)}</span>
                                        <label for="pay-${i}">${escText(labelFor(PAYMENT_LABELS, m))}</label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        `}

                        <div id="checkout-status" class="checkout-status" style="display:none;"></div>
                    </div>
                    <div class="checkout-footer">
                        <div class="checkout-trust">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <span>Secure checkout · Encrypted payment</span>
                        </div>
                        <div id="d2c-pay-button" style="display:none;margin:0 auto 0.5rem;max-width:300px;"></div>
                        <button id="checkout-place-order-btn" class="checkout-btn" style="background-color: ${primaryColor};">
                            Place Order — $${(quote.grandTotal || 0).toFixed(2)}
                        </button>
                        <div id="checkout-validation-msg" class="checkout-validation-msg"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });

            // Coupon apply: rebuild quote with promoCode, swap totals in place. The Apply
            // button is the only new network call this UI introduces; nothing fires on
            // overlay-open or main-thread render.
            const couponApply = document.getElementById('checkout-coupon-apply');
            if (couponApply) {
                couponApply.addEventListener('click', async () => {
                    const input = document.getElementById('checkout-coupon-input');
                    const status = document.getElementById('checkout-coupon-status');
                    const code = (input?.value || '').trim();
                    if (!code) { if (status) status.textContent = ''; return; }
                    couponApply.disabled = true;
                    if (status) { status.style.color = '#6b7280'; status.textContent = 'Applying...'; }
                    try {
                        const updated = await this.createQuote(quote.sellerId, customerAddresses, code);
                        if (!updated) throw new Error('Update failed');
                        // Update outer quote ref so place-order uses the new totals.
                        Object.assign(quote, updated);
                        const totalsEl = document.getElementById('checkout-totals');
                        if (totalsEl) totalsEl.innerHTML = this._renderCheckoutTotals(quote);
                        if (status) {
                            if ((updated.promoDiscount || 0) > 0) {
                                status.style.color = '#059669';
                                status.textContent = `Code applied: -$${updated.promoDiscount.toFixed(2)}`;
                            } else {
                                status.style.color = '#dc2626';
                                status.textContent = 'Code not recognized';
                            }
                        }
                    } catch {
                        if (status) { status.style.color = '#dc2626'; status.textContent = 'Could not apply code'; }
                    } finally {
                        couponApply.disabled = false;
                    }
                });
            }

            // Toggle address/pickup/shipping sections when delivery method changes.
            // Multi-delivery is now a radio group; sync selected value to the hidden #checkout-delivery
            // input so validateCheckout + _processCheckout still read the same field name.
            const deliveryGroup = document.getElementById('checkout-delivery-group');
            const deliveryHidden = document.getElementById('checkout-delivery');
            if (deliveryGroup && deliveryHidden) {
                deliveryGroup.addEventListener('change', (e) => {
                    if (!e.target.matches('input[name="checkout-delivery-radio"]')) return;
                    const val = e.target.value;
                    deliveryHidden.value = val;
                    const addrSec = document.getElementById('checkout-address-section');
                    const pickupSec = document.getElementById('checkout-pickup-section');
                    const shipSec = document.getElementById('checkout-shipping-section');
                    if (addrSec) addrSec.style.display = val !== 'pickup' ? 'block' : 'none';
                    if (pickupSec) pickupSec.style.display = val === 'pickup' ? 'block' : 'none';
                    if (shipSec) shipSec.style.display = val === 'shipping_out' ? 'block' : 'none';
                    validateCheckout();
                });
            }

            // Address section — event delegation survives re-renders of #checkout-address-content.
            // Handles: dropdown change, "+ Add new address" click, form submit, form cancel.
            const addrSectionEl = document.getElementById('checkout-address-section');
            const addrContentEl = () => document.getElementById('checkout-address-content');
            const renderAddrList = () => {
                const el = addrContentEl();
                if (el) { el.innerHTML = buildAddressListHtml(); validateCheckout(); }
            };
            const renderAddrForm = () => {
                const el = addrContentEl();
                if (el) {
                    el.innerHTML = buildAddressFormHtml();
                    validateCheckout();
                    el.querySelector('input[name="addressLabel"]')?.focus();
                }
            };
            if (addrSectionEl) {
                addrSectionEl.addEventListener('change', e => {
                    if (e.target.matches('#checkout-address')) validateCheckout();
                });
                addrSectionEl.addEventListener('click', e => {
                    const action = e.target.closest('[data-action]')?.getAttribute('data-action');
                    if (action === 'open-add-form') { e.preventDefault(); renderAddrForm(); }
                    else if (action === 'cancel-add-form') { e.preventDefault(); renderAddrList(); }
                });
                addrSectionEl.addEventListener('submit', async e => {
                    if (e.target.id !== 'checkout-add-address-form') return;
                    e.preventDefault();
                    const form = e.target;
                    const submitBtn = form.querySelector('button[type="submit"]');
                    const cancelBtn = form.querySelector('button[data-action="cancel-add-form"]');
                    const fd = new FormData(form);
                    const payload = {
                        addressLabel: fd.get('addressLabel'),
                        recipientName: fd.get('recipientName'),
                        phoneNumber: fd.get('phoneNumber') || '',
                        isDefaultShipping: !!fd.get('isDefaultShipping'),
                        address: { street: fd.get('street'), city: fd.get('city'), state: fd.get('state'), zip: fd.get('zip') }
                    };
                    submitBtn.disabled = true; if (cancelBtn) cancelBtn.disabled = true;
                    submitBtn.textContent = 'Saving…';
                    try {
                        const ok = await this.addAddress(payload);
                        if (!ok) throw new Error('save-failed');
                        const fresh = await this.getAddresses();
                        // Defensive: if re-fetch returns empty after a known-successful save (network
                        // glitch / Lambda cold-start race), do NOT wipe the existing list — we'd lose
                        // visibility of all saved addresses AND can't preselect the new one because we
                        // don't have its server-assigned id. Keep current list, restore form state,
                        // ask user to retry.
                        if (!fresh || fresh.length === 0) {
                            submitBtn.disabled = false; if (cancelBtn) cancelBtn.disabled = false;
                            submitBtn.textContent = 'Save Address';
                            if (window.D2C_CART?.showToast) window.D2C_CART.showToast('Address saved — please tap Cancel and reopen to use it.');
                            return;
                        }
                        addrList = fresh.map(a => ({
                            id: a._id || a.id,
                            addressLabel: a.addressLabel || 'Address',
                            recipientName: a.recipientName || '',
                            phoneNumber: a.phoneNumber || '',
                            address: a.address || {},
                            isDefaultShipping: !!a.isDefaultShipping
                        }));
                        // Quote is source of truth; refresh it with the updated list so the new
                        // address is in quote.customerAddresses when the order is placed and the
                        // backend can snapshot it. Mirrors the promo-code recreate flow above.
                        const refreshed = await this.createQuote(quote.sellerId, addrList, quote.promoCode || '');
                        if (refreshed) Object.assign(quote, refreshed);
                        // Identify the newly created address: prefer label+street+zip match,
                        // fall back to the last list entry (insertion order).
                        const newAddr = addrList.find(a =>
                            a.addressLabel === payload.addressLabel &&
                            (a.address?.street || '') === payload.address.street &&
                            (a.address?.zip || '') === payload.address.zip
                        ) || addrList[addrList.length - 1];
                        addrPreselectId = newAddr?.id || addrPreselectId;
                        renderAddrList();
                        if (window.D2C_CART?.showToast) window.D2C_CART.showToast('Address added');
                    } catch (err) {
                        submitBtn.disabled = false; if (cancelBtn) cancelBtn.disabled = false;
                        submitBtn.textContent = 'Save Address';
                        if (window.D2C_CART?.showToast) window.D2C_CART.showToast('Could not save address. Please try again.');
                    }
                });
            }

            // Validate checkout form and enable/disable Place Order button.
            // Populates inline message so customer knows WHY the button is disabled.
            const validateCheckout = () => {
                const btn = document.getElementById('checkout-place-order-btn');
                const msg = document.getElementById('checkout-validation-msg');
                const dm = document.getElementById('checkout-delivery')?.value || '';
                const pm = document.querySelector('input[name="checkout-payment"]:checked')?.value || '';
                let reason = '';

                if (!dm) reason = 'Select a delivery method to continue';
                else if (dm !== 'pickup') {
                    const addrSelect = document.getElementById('checkout-address');
                    const addrFormOpen = !!document.getElementById('checkout-add-address-form');
                    if (addrFormOpen) reason = 'Save your address to continue';
                    else if (!addrSelect) reason = 'Add a delivery address to continue';
                    else if (!addrSelect.value) reason = 'Select a delivery address to continue';
                } else if (dm === 'pickup') {
                    const pickupSelect = document.getElementById('checkout-pickup');
                    if (!pickupSelect || !pickupSelect.value) reason = 'Select a pickup location to continue';
                }
                if (!reason && !pm) reason = 'Select a payment method to continue';

                const valid = !reason;
                // Hide validation message when Amazon Pay is the active method — its own button
                // is rendered in place of the Place Order CTA, and it handles address details itself.
                if (msg) msg.textContent = (valid || pm === 'amazon_pay') ? '' : reason;
                if (btn && pm !== 'amazon_pay') {
                    btn.disabled = !valid;
                    btn.style.opacity = valid ? '1' : '0.5';
                    btn.style.cursor = valid ? 'pointer' : 'not-allowed';
                }
            };

            // Run validation on all form changes
            document.querySelectorAll('#checkout-delivery, #checkout-pickup').forEach(el => {
                el.addEventListener('change', validateCheckout);
                el.addEventListener('input', validateCheckout);
            });
            document.querySelectorAll('input[name="checkout-payment"]').forEach(el => {
                el.addEventListener('change', validateCheckout);
            });
            validateCheckout(); // initial state

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
            let deliveryAddressId = deliveryMethod !== 'pickup' ? (document.getElementById('checkout-address')?.value || '') : '';

            btn.disabled = true;
            btn.textContent = 'Placing order...';
            status.style.display = 'block';
            status.style.color = '';
            status.textContent = 'Processing your order...';

            if (deliveryMethod !== 'pickup' && !deliveryAddressId) {
                status.style.color = '#dc2626';
                status.textContent = 'Please add a delivery address first.';
                btn.disabled = false;
                btn.textContent = 'Place Order';
                return;
            }

            if (deliveryMethod === 'pickup' && !pickupLocationId) {
                status.style.color = '#dc2626';
                status.textContent = 'Please select a pickup location.';
                btn.disabled = false;
                btn.textContent = 'Place Order';
                return;
            }

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

            if (deliveryMethod !== 'pickup' && !deliveryAddressId) {
                container.innerHTML = '<p style="text-align:center;color:#dc2626;font-size:14px;">Please add a delivery address first.</p>';
                return;
            }
            if (deliveryMethod === 'pickup' && !pickupLocationId) {
                container.innerHTML = '<p style="text-align:center;color:#dc2626;font-size:14px;">Please select a pickup location first.</p>';
                return;
            }

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

            const statusColors = { pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#16a34a', cancelled: '#ef4444', returned: '#d97706', refunded: '#a855f7' };
            this._cachedOrders = orders;

            container.innerHTML = `
                <h3 style="font-size:1rem; font-weight:800; margin-bottom:1rem">Order History</h3>
                ${orders.map(o => {
                const color = statusColors[o.status] || '#64748b';
                const oid = o._id || o.id;
                const trackingLabel = [o.trackingCarrier ? o.trackingCarrier.toUpperCase() : '', o.trackingNumber || ''].filter(Boolean).join(' ');
                const refundedAmt = (o.refunds || []).reduce((s, r) => s + (r.amount || 0), 0);
                const netTotal = Math.max(0, (o.grandTotal || 0) - refundedAmt);
                return `
                    <div class="dash-card" style="cursor:pointer" onclick="if(event.target.tagName==='BUTTON'||event.target.tagName==='A')return; D2C_CUSTOMER.showOrderDetail('${oid}')">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
                            <span style="font-weight:700; font-size:0.9rem">Order #${(oid || '').slice(-6)}</span>
                            <span style="font-weight:800; color:var(--primary)">${refundedAmt > 0 ? `<span style="text-decoration:line-through;color:#94a3b8;font-weight:400;font-size:0.85em;margin-right:4px">$${(o.grandTotal || 0).toFixed(2)}</span>$${netTotal.toFixed(2)}` : `$${(o.grandTotal || 0).toFixed(2)}`}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem">
                            <span class="dash-badge" style="background:${color}15; color:${color}">${o.status}</span>
                            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap">
                                <span style="font-size:0.75rem; color:#94a3b8">${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''}</span>
                                <button onclick="event.stopPropagation(); D2C_CUSTOMER.reorder('${oid}')" style="font-size:0.75rem; color:var(--primary); font-weight:600; background:none; border:none; cursor:pointer; text-decoration:underline; padding:0">Reorder</button>
                            </div>
                        </div>
                        ${o.trackingNumber ? `
                        <div style="margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid #f1f5f9; font-size:0.75rem; color:#64748b">
                            ${trackingLabel}${o.trackingUrl ? ` · <a href="${o.trackingUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color:var(--primary); font-weight:600; text-decoration:none">Track package →</a>` : ''}
                        </div>
                        ` : ''}
                    </div>`;
            }).join('')}
            `;
        },

        showOrderDetail(orderId) {
            const order = (this._cachedOrders || []).find(o => (o._id || o.id) === orderId);
            if (!order) return;
            this._renderOrderDetailOverlay(order);
        },

        _renderOrderDetailOverlay(order) {
            document.getElementById('order-detail-overlay')?.remove();
            const escText = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const PAYMENT_LABELS = {
                amazon_pay: 'Amazon Pay', stripe_pay: 'Credit / Debit Card', google_pay: 'Google Pay',
                credit_card: 'Credit Card', purchase_order: 'Purchase Order',
                'pickup_&_pay': 'Pay at Pickup', deliver_pay: 'Pay on Delivery',
            };
            const DELIVERY_LABELS = { shipping_out: 'Ship to address', pickup: 'Pick up at store', dropoff: 'Local delivery' };
            const STATUS_COLORS = { pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#16a34a', cancelled: '#ef4444', returned: '#d97706', refunded: '#a855f7' };
            const labelFor = (m, k) => m[k] || (k || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
            const oid = order._id || order.id || '';
            const color = STATUS_COLORS[order.status] || '#64748b';
            const trackingLabel = [order.trackingCarrier ? order.trackingCarrier.toUpperCase() : '', order.trackingNumber || ''].filter(Boolean).join(' ');

            const overlay = document.createElement('div');
            overlay.id = 'order-detail-overlay';
            overlay.innerHTML = `
                <style>
                    #order-detail-overlay { position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                        background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); padding:1rem; }
                    #order-detail-overlay .od-modal { background:#fff; border-radius:16px; max-width:520px; width:100%; max-height:90vh;
                        display:flex; flex-direction:column; box-shadow:0 25px 50px rgba(0,0,0,0.25); }
                    #order-detail-overlay .od-head { padding:18px 20px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-shrink:0; }
                    #order-detail-overlay .od-head h2 { margin:0; font-size:18px; font-weight:800; color:#0f172a; }
                    #order-detail-overlay .od-head .meta { margin-top:4px; font-size:12px; color:#64748b; }
                    #order-detail-overlay .od-close { background:none; border:none; font-size:26px; cursor:pointer; color:#94a3b8; padding:8px 12px; line-height:1; border-radius:8px; min-width:44px; min-height:44px; }
                    #order-detail-overlay .od-close:hover { background:#f1f5f9; color:#0f172a; }
                    #order-detail-overlay .od-body { padding:18px 20px; overflow-y:auto; -webkit-overflow-scrolling:touch; flex:1 1 auto; }
                    #order-detail-overlay .od-section { margin-bottom:18px; }
                    #order-detail-overlay .od-section h3 { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 8px; }
                    #order-detail-overlay .od-item { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f1f5f9; }
                    #order-detail-overlay .od-item:last-child { border-bottom:none; }
                    #order-detail-overlay .od-thumb { width:44px; height:44px; border-radius:6px; object-fit:cover; border:1px solid #e2e8f0; background:#f8fafc; flex-shrink:0; }
                    #order-detail-overlay .od-thumb-ph { width:44px; height:44px; border-radius:6px; background:#f1f5f9; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; color:#94a3b8; flex-shrink:0; font-size:18px; }
                    #order-detail-overlay .od-item-info { flex:1; min-width:0; }
                    #order-detail-overlay .od-item-name { font-size:13px; font-weight:600; color:#0f172a; word-break:break-word; line-height:1.3; }
                    #order-detail-overlay .od-item-detail { font-size:11px; color:#94a3b8; margin-top:2px; }
                    #order-detail-overlay .od-item-price { font-size:13px; font-weight:700; color:#0f172a; flex-shrink:0; }
                    #order-detail-overlay .od-row { display:flex; justify-content:space-between; padding:4px 0; font-size:13px; color:#64748b; }
                    #order-detail-overlay .od-row.total { border-top:2px solid #0f172a; margin-top:6px; padding-top:8px; font-size:15px; font-weight:800; color:#0f172a; }
                    #order-detail-overlay .od-kv { display:flex; justify-content:space-between; gap:0.5rem; padding:3px 0; font-size:13px; }
                    #order-detail-overlay .od-kv dt { color:#94a3b8; }
                    #order-detail-overlay .od-kv dd { margin:0; color:#0f172a; font-weight:600; text-align:right; }
                    #order-detail-overlay .od-foot { padding:14px 20px; border-top:1px solid #e5e7eb; background:#fafafa; display:flex; gap:0.5rem; flex-shrink:0; }
                    #order-detail-overlay .od-btn { flex:1; padding:12px; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; border:none; font-family:inherit; }
                    #order-detail-overlay .od-btn-secondary { background:#fff; border:1px solid #cbd5e1; color:#475569; }
                    #order-detail-overlay .od-btn-primary { background:var(--primary); color:#fff; }
                    @media (max-width:480px) {
                        #order-detail-overlay { padding:0.5rem; }
                        #order-detail-overlay .od-modal { max-height:96vh; border-radius:12px; }
                        #order-detail-overlay .od-thumb, #order-detail-overlay .od-thumb-ph { width:40px; height:40px; }
                    }
                </style>
                <div class="od-modal">
                    <div class="od-head">
                        <div>
                            <h2>Order #${escText(oid.slice(-6))}</h2>
                            <div class="meta">${order.createdAt ? escText(new Date(order.createdAt).toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'})) : ''}</div>
                            <div style="margin-top:8px"><span class="dash-badge" style="background:${color}15; color:${color}">${escText(order.status || 'pending')}</span></div>
                        </div>
                        <button class="od-close" onclick="document.getElementById('order-detail-overlay').remove()" aria-label="Close">×</button>
                    </div>
                    <div class="od-body">
                        <section class="od-section">
                            <h3>Items (${(order.items || []).length})</h3>
                            ${(order.items || []).length === 0
                                ? '<div style="font-size:13px; color:#94a3b8; padding:8px 0">No items recorded.</div>'
                                : (order.items || []).map(it => {
                                    const lineTotal = it.lineItemTotal || ((it.discountedPrice ?? it.price ?? 0) * (it.quantity || 1));
                                    const img = it.image || '';
                                    return `
                                    <div class="od-item">
                                        ${img
                                            ? `<img class="od-thumb" src="${escAttr(img)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'od-thumb-ph',textContent:'📦'}))">`
                                            : `<div class="od-thumb-ph">📦</div>`}
                                        <div class="od-item-info">
                                            <div class="od-item-name">${escText(it.name || 'Product')}</div>
                                            <div class="od-item-detail">Qty ${it.quantity || 1}</div>
                                        </div>
                                        <div class="od-item-price">$${lineTotal.toFixed(2)}</div>
                                    </div>`;
                                }).join('')}
                        </section>

                        <section class="od-section">
                            <h3>Summary</h3>
                            <div class="od-row"><span>Subtotal</span><span>$${(order.subtotal || 0).toFixed(2)}</span></div>
                            <div class="od-row"><span>Shipping</span><span>$${(order.shippingCost || 0).toFixed(2)}</span></div>
                            <div class="od-row"><span>Tax</span><span>$${(order.taxAmount || 0).toFixed(2)}</span></div>
                            ${order.promoDiscount && order.promoDiscount > 0 ? `<div class="od-row" style="color:#059669"><span>Discount${order.promoCode ? ' (' + escText(order.promoCode) + ')' : ''}</span><span>-$${order.promoDiscount.toFixed(2)}</span></div>` : ''}
                            <div class="od-row total"><span>Total</span><span>$${(order.grandTotal || 0).toFixed(2)}</span></div>
                            ${(() => {
                                const refunded = (order.refunds || []).reduce((s, r) => s + (r.amount || 0), 0);
                                if (refunded <= 0) return '';
                                const net = Math.max(0, (order.grandTotal || 0) - refunded);
                                const lines = (order.refunds || []).map(r => `<div class="od-row" style="font-size:12px"><span>${r.refundedAt ? escText(new Date(r.refundedAt).toLocaleDateString()) : ''}${r.reason ? ' &middot; ' + escText(r.reason) : ''}</span><span>-$${(r.amount || 0).toFixed(2)}</span></div>`).join('');
                                return `<div class="od-row" style="color:#a855f7;font-weight:600"><span>Refunded</span><span>-$${refunded.toFixed(2)}</span></div>${lines}<div class="od-row total"><span>Net Total</span><span>$${net.toFixed(2)}</span></div>`;
                            })()}
                        </section>

                        <section class="od-section">
                            <h3>Delivery</h3>
                            <dl style="margin:0">
                                <div class="od-kv"><dt>Method</dt><dd>${escText(labelFor(DELIVERY_LABELS, order.deliveryMethod))}</dd></div>
                                ${order.shippedAt ? `<div class="od-kv"><dt>Shipped</dt><dd>${escText(new Date(order.shippedAt).toLocaleDateString())}</dd></div>` : ''}
                                ${order.deliveredAt ? `<div class="od-kv"><dt>Delivered</dt><dd>${escText(new Date(order.deliveredAt).toLocaleDateString())}</dd></div>` : ''}
                            </dl>
                            ${order.trackingNumber ? `
                            <div style="margin-top:8px; padding:10px 12px; background:#f8fafc; border-radius:8px; font-size:13px;">
                                <div style="color:#64748b; font-size:11px; margin-bottom:2px">Tracking</div>
                                <div style="color:#0f172a; font-weight:600">${escText(trackingLabel)}</div>
                                ${order.trackingUrl ? `<a href="${escAttr(order.trackingUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; color:var(--primary); font-weight:700; text-decoration:none; font-size:13px">Track package →</a>` : ''}
                            </div>` : ''}
                        </section>

                        ${order.deliveryAddress ? `
                        <section class="od-section">
                            <h3>Ship to</h3>
                            <div style="font-size:13px; color:#0f172a; line-height:1.5">
                                ${order.deliveryAddress.recipientName ? `<div>${escText(order.deliveryAddress.recipientName)}</div>` : ''}
                                ${order.deliveryAddress.street ? `<div>${escText(order.deliveryAddress.street)}</div>` : ''}
                                ${(order.deliveryAddress.city || order.deliveryAddress.state || order.deliveryAddress.zip) ? `<div>${escText([order.deliveryAddress.city, [order.deliveryAddress.state, order.deliveryAddress.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</div>` : ''}
                                ${order.deliveryAddress.phoneNumber ? `<div style="font-size:12px; color:#64748b; margin-top:4px">${escText(order.deliveryAddress.phoneNumber)}</div>` : ''}
                            </div>
                        </section>
                        ` : ''}

                        <section class="od-section">
                            <h3>Payment</h3>
                            <dl style="margin:0">
                                <div class="od-kv"><dt>Method</dt><dd>${escText(labelFor(PAYMENT_LABELS, order.paymentMethod))}</dd></div>
                                ${order.transactionId ? `<div class="od-kv"><dt>Reference</dt><dd style="font-family:monospace; font-size:11px; word-break:break-all; max-width:60%">${escText(order.transactionId)}</dd></div>` : ''}
                            </dl>
                        </section>
                    </div>
                    <div class="od-foot">
                        <button class="od-btn od-btn-secondary" onclick="document.getElementById('order-detail-overlay').remove()">Close</button>
                        <button class="od-btn od-btn-primary" onclick="document.getElementById('order-detail-overlay').remove(); D2C_CUSTOMER.reorder('${escAttr(oid)}')">Reorder</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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
                                ${this.pwField('password', '••••••••')}
                                ${this.forgotLink()}
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
                .pw-wrapper { position: relative; }
                .pw-wrapper input { padding-right: 2.5rem; }
                .pw-toggle { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; }
                .pw-toggle:hover { color: #475569; }
                .forgot-link { text-align: right; margin-top: 0.25rem; }
                .forgot-link a { font-size: 0.8rem; color: var(--primary); text-decoration: none; font-weight: 600; }
                .forgot-link a:hover { text-decoration: underline; }

                #customer-nav button:hover {
                    color: white !important;
                }
                #customer-nav .nav-btn-signin:hover {
                    background-color: var(--primary) !important;
                }
            `;
            document.head.appendChild(style);
        },

        togglePassword(btn) {
            const input = btn.parentElement.querySelector('input');
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.innerHTML = isHidden
                ? '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>'
                : '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1.01 1.01 0 010 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
        },

        pwField(name, placeholder, minlength) {
            const ml = minlength ? ` minlength="${minlength}"` : '';
            return `<div class="pw-wrapper">
                <input type="password" name="${name}" required placeholder="${placeholder}"${ml}>
                <button type="button" class="pw-toggle" aria-label="Toggle password visibility" onclick="D2C_CUSTOMER.togglePassword(this)">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1.01 1.01 0 010 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
            </div>`;
        },

        forgotLink() {
            return `<div class="forgot-link"><a href="#" onclick="event.preventDefault(); D2C_CUSTOMER.toggleAuthMode('forgot')">Forgot password?</a></div>`;
        },

        async handleForgotPassword(e) {
            e.preventDefault();
            const email = new FormData(e.target).get('email');
            if (!email) { this.showToast('Please enter your email', 'error'); return; }
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Sending...';
            try {
                await fetch(`${API_BASE}/accounts/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
            } catch (_) { /* always show success */ }
            const safe = String(email).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            const container = document.getElementById('auth-form-container');
            container.innerHTML = `
                <h2>Check Your Email</h2>
                <p>If an account with <strong>${safe}</strong> exists, we've sent a password reset link.</p>
                <p style="font-size:0.875rem; color:#64748b">The link expires in 1 hour.</p>
                <button onclick="D2C_CUSTOMER.toggleAuthMode('login')" class="checkout-btn" style="width:100%; padding:1rem; margin-top:1.5rem; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:700; cursor:pointer">Back to Sign In</button>
            `;
        },

        toggleAuthMode(mode) {
            const container = document.getElementById('auth-form-container');
            if (mode === 'forgot') {
                container.innerHTML = `
                    <h2>Reset Password</h2>
                    <p>Enter your email and we'll send a reset link.</p>
                    <form onsubmit="D2C_CUSTOMER.handleForgotPassword(event)">
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" name="email" required placeholder="you@example.com">
                        </div>
                        <button type="submit" class="checkout-btn" style="width:100%; padding:1rem; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:700; cursor:pointer">Send Reset Link</button>
                    </form>
                    <p class="toggle-auth" style="text-align:center; margin-top:1.5rem; font-size:0.875rem"><a href="#" style="color:var(--primary); font-weight:700; text-decoration:none" onclick="D2C_CUSTOMER.toggleAuthMode('login')">Back to Sign In</a></p>
                `;
            } else if (mode === 'register') {
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
                            ${this.pwField('password', '••••••••', '8')}
                            <small style="color:#64748b;font-size:0.75rem">Min 8 characters with uppercase, lowercase, digit, and special character.</small>
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
                            ${this.pwField('password', '••••••••')}
                            ${this.forgotLink()}
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
                            if (window.D2C_TRACKER) window.D2C_TRACKER.trackRegister(this.user?.id || '');
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
                        if (window.D2C_TRACKER) window.D2C_TRACKER.trackLogin(this.user?.id || '');
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
