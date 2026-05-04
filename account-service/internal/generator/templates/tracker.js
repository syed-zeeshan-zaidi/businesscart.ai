/**
 * D2C Storefront Visitor Tracker
 * Session-based: sends page_view once per session, conversion events always.
 * Fire-and-forget — never blocks UI, never throws.
 */
(function () {
    var API = (window.D2C_CONFIG || {}).apiBase || '';
    var SELLER = (window.D2C_CONFIG || {}).sellerId || '';
    var VID_KEY = 'bc_visitor_id';
    var ATTR_KEY = 'bc_attribution';
    var CLICK_KEY = 'bc_clickids';
    var SESSION_KEY = 'bc_session';
    var CLICK_KEYS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid', 'ttclid', 'epik', 'sccid', 'rdt_cid'];

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
    function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

    function visitorId() {
        var id = lsGet(VID_KEY);
        if (!id) {
            id = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            lsSet(VID_KEY, id);
        }
        return id;
    }

    function clickIds() {
        var p = new URLSearchParams(window.location.search);
        var fresh = {};
        for (var i = 0; i < CLICK_KEYS.length; i++) {
            var v = p.get(CLICK_KEYS[i]);
            if (v) fresh[CLICK_KEYS[i]] = v;
        }
        if (Object.keys(fresh).length) {
            lsSet(CLICK_KEY, JSON.stringify(fresh));
            return fresh;
        }
        try {
            var cached = lsGet(CLICK_KEY);
            if (cached) return JSON.parse(cached);
        } catch (e) {}
        return {};
    }

    function attribution() {
        var ids = clickIds();
        try {
            var cached = lsGet(ATTR_KEY);
            if (cached) {
                var c = JSON.parse(cached);
                c.clickIds = ids;
                return c;
            }
        } catch (e) {}
        var p = new URLSearchParams(window.location.search);
        var attr = {
            referrer: document.referrer || '',
            landingPage: window.location.pathname,
            utm_source: p.get('utm_source') || '',
            utm_medium: p.get('utm_medium') || '',
            utm_campaign: p.get('utm_campaign') || '',
            utm_content: p.get('utm_content') || '',
            utm_term: p.get('utm_term') || ''
        };
        lsSet(ATTR_KEY, JSON.stringify(attr));
        attr.clickIds = ids;
        return attr;
    }

    function customerId() {
        try {
            var token = lsGet('accessToken');
            if (!token) return '';
            var payload = JSON.parse(atob(token.split('.')[1]));
            var role = (payload.user || {}).role || '';
            if (role === 'admin' || role === 'company' || role === 'partner') return '';
            return (payload.user || {}).id || '';
        } catch (e) { return ''; }
    }

    var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    function send(event, page, metadata) {
        try {
            if (!API || isLocal) return;
            var attr = attribution();
            var body = {
                visitorId: visitorId(),
                event: event,
                page: page,
                referrer: attr.referrer,
                utm_source: attr.utm_source,
                utm_medium: attr.utm_medium,
                utm_campaign: attr.utm_campaign,
                utm_content: attr.utm_content,
                utm_term: attr.utm_term,
                clickIds: attr.clickIds || {},
                timezone: (function() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) { return ''; } })(),
                screenWidth: window.screen ? window.screen.width : 0,
                screenHeight: window.screen ? window.screen.height : 0,
                language: navigator.language || '',
                customerId: customerId(),
                sellerId: SELLER
            };
            if (metadata) body.metadata = metadata;
            fetch(API + '/visitors/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true
            }).catch(function () {});
        } catch (e) {}
    }

    // Expose for cart.js and customer.js to call (must be defined before any early return)
    window.D2C_TRACKER = {
        trackAddToCart: function (productId, productName, price) {
            try { send('add_to_cart', window.location.pathname, { productId: productId, productName: productName, price: price }); } catch (e) {}
        },
        trackOrder: function (orderId, amount) {
            try { send('order', window.location.pathname, { orderId: orderId, amount: amount }); } catch (e) {}
        },
        trackRegister: function (customerId) {
            try { send('register', window.location.pathname, { customerId: customerId }); } catch (e) {}
        },
        trackLogin: function (customerId) {
            try { send('login', window.location.pathname, { customerId: customerId }); } catch (e) {}
        }
    };

    // Track page view only once per session
    if (!ssGet(SESSION_KEY)) {
        ssSet(SESSION_KEY, '1');
        send('page_view', window.location.pathname);
    }
})();
