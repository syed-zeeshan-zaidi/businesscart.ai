class D2CCart {
    constructor() {
        this.sellerId = window.D2C_CONFIG?.sellerId || '';
        this.items = this.loadCart();
        this.initDOM();
        this.render();
    }

    loadCart() {
        const key = `d2c_cart_${this.sellerId}`;
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch (e) {
            return [];
        }
    }

    saveCart() {
        const key = `d2c_cart_${this.sellerId}`;
        localStorage.setItem(key, JSON.stringify(this.items));
        this.render();
    }

    addItem(product) {
        const existing = this.items.find(item => item._id === product._id);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            this.items.push({ ...product, quantity: 1 });
        }
        this.saveCart();
        this.showDrawer();
        this.showToast(`Added ${product.name} to cart`);
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item._id !== productId);
        this.saveCart();
    }

    updateQuantity(productId, delta) {
        const item = this.items.find(item => item._id === productId);
        if (item) {
            item.quantity = Math.max(1, (item.quantity || 1) + delta);
            this.saveCart();
        }
    }

    clear() {
        this.items = [];
        this.saveCart();
    }

    getTotalPrice() {
        return this.items.reduce((sum, item) => sum + (item.discountedPrice || item.price) * item.quantity, 0);
    }

    initDOM() {
        // Create Cart Drawer if it doesn't exist
        if (!document.getElementById('cart-drawer')) {
            const drawer = document.createElement('div');
            drawer.id = 'cart-drawer';
            drawer.style = `
                position: fixed; top: 0; right: -450px; width: 450px; max-width: 90vw; height: 100vh;
                background: white; box-shadow: -10px 0 30px rgba(0,0,0,0.1);
                z-index: 2000; transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex; flex-direction: column;
            `;
            drawer.innerHTML = `
                <div style="padding: 2rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-weight: 800;">Your Cart</h2>
                    <button onclick="window.D2C_CART.hideDrawer()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">✕</button>
                </div>
                <div id="cart-items" style="flex: 1; overflow-y: auto; padding: 1.5rem;"></div>
                <div id="cart-footer" style="padding: 2rem; border-top: 1px solid #eee; background: #fafafa;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; font-size: 1.25rem; font-weight: 800;">
                        <span>Total</span>
                        <span id="cart-total">$0.00</span>
                    </div>
                    <button onclick="window.D2C_CART.handleCheckout()" style="width: 100%; background: var(--primary, #000); color: white; border: none; padding: 1.25rem; border-radius: 12px; font-weight: 800; font-size: 1.1rem; cursor: pointer;">
                        Checkout Now
                    </button>
                </div>
            `;
            document.body.appendChild(drawer);

            const overlay = document.createElement('div');
            overlay.id = 'cart-overlay';
            overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.4); z-index: 1999; display: none;
                backdrop-filter: blur(4px);
            `;
            overlay.onclick = () => this.hideDrawer();
            document.body.appendChild(overlay);
        }
    }

    render() {
        const container = document.getElementById('cart-items');
        if (!container) return;

        const countEl = document.getElementById('cart-count');
        const itemCount = this.items.reduce((sum, i) => sum + i.quantity, 0);

        if (countEl) {
            countEl.innerText = itemCount;
            countEl.style.display = itemCount > 0 ? 'flex' : 'none';
        }

        if (this.items.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 4rem 2rem; opacity: 0.5;">Your cart is empty</div>`;
            document.getElementById('cart-total').innerText = `$0.00`;
            return;
        }

        container.innerHTML = this.items.map(item => `
            <div style="display: flex; gap: 1rem; margin-bottom: 2rem; align-items: center;">
                <div style="width: 80px; height: 80px; background: #f5f5f5; border-radius: 12px; overflow: hidden;">
                    <img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; margin-bottom: 0.25rem;">${item.name}</div>
                    <div style="color: var(--primary); font-weight: 700;">$${((item.discountedPrice || item.price) * item.quantity).toFixed(2)}</div>
                    <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
                        <button onclick="window.D2C_CART.updateQuantity('${item._id}', -1)" style="border: 1px solid #ddd; background: white; border-radius: 4px; padding: 2px 8px;">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="window.D2C_CART.updateQuantity('${item._id}', 1)" style="border: 1px solid #ddd; background: white; border-radius: 4px; padding: 2px 8px;">+</button>
                        <button onclick="window.D2C_CART.removeItem('${item._id}')" style="margin-left: auto; color: #ff4444; border: none; background: none; font-size: 0.8rem; cursor: pointer;">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('cart-total').innerText = `$${this.getTotalPrice().toFixed(2)}`;
    }

    showDrawer() {
        document.getElementById('cart-drawer').style.right = '0';
        document.getElementById('cart-overlay').style.display = 'block';
    }

    hideDrawer() {
        document.getElementById('cart-drawer').style.right = '-450px';
        document.getElementById('cart-overlay').style.display = 'none';
    }

    toggleDrawer() {
        const drawer = document.getElementById('cart-drawer');
        if (drawer.style.right === '0px' || drawer.style.right === '0') {
            this.hideDrawer();
        } else {
            this.showDrawer();
        }
    }

    handleCheckout() {
        if (this.items.length === 0) return;
        if (window.D2C_CUSTOMER) {
            this.hideDrawer();
            window.D2C_CUSTOMER.startCheckout(this.items);
        } else {
            this.showToast('Checkout system is initializing...');
        }
    }

    showToast(msg) {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style = `
            position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
            background: #333; color: white; padding: 1rem 2rem; border-radius: 100px;
            z-index: 3000; box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.D2C_CART = new D2CCart();
});
