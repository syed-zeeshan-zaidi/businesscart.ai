const API_URL = import.meta.env.VITE_API_URL;
const VISITOR_KEY = 'bc_visitor_id';
const ATTR_KEY = 'bc_attribution';

function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeLocalSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* silently ignore */ }
}

function generateId(): string {
  return 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getVisitorId(): string {
  let id = safeLocalGet(VISITOR_KEY);
  if (!id) {
    id = generateId();
    safeLocalSet(VISITOR_KEY, id);
  }
  return id;
}

function getAttribution(): Record<string, string> {
  try {
    const existing = safeLocalGet(ATTR_KEY);
    if (existing) return JSON.parse(existing);
  } catch { /* corrupted data — recapture */ }

  const params = new URLSearchParams(window.location.search);
  const attribution: Record<string, string> = {
    referrer: document.referrer || '',
    landingPage: window.location.pathname,
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content: params.get('utm_content') || '',
  };

  safeLocalSet(ATTR_KEY, JSON.stringify(attribution));
  return attribution;
}

function getCustomerId(): string {
  try {
    const token = safeLocalGet('accessToken');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.user?.id || '';
  } catch {
    return '';
  }
}

function sendEvent(event: string, page: string, metadata?: Record<string, unknown>) {
  try {
    if (!API_URL) return;

    const visitorId = getVisitorId();
    const attribution = getAttribution();

    const body: Record<string, unknown> = {
      visitorId,
      event,
      page,
      referrer: attribution.referrer,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      customerId: getCustomerId(),
    };

    if (metadata) body.metadata = metadata;

    // Fire-and-forget — never block the UI, never throw
    fetch(`${API_URL}/visitors/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Absolute safety net — tracker must never crash the app
  }
}

export function trackPageView(page: string) {
  try { sendEvent('page_view', page); } catch { /* never throw */ }
}

export function trackRegister(customerId: string) {
  try { sendEvent('register', window.location.pathname, { customerId }); } catch { /* */ }
}

export function trackLogin(customerId: string) {
  try { sendEvent('login', window.location.pathname, { customerId }); } catch { /* */ }
}

export function trackAddToCart(productId: string, productName: string, price: number) {
  try { sendEvent('add_to_cart', window.location.pathname, { productId, productName, price }); } catch { /* */ }
}

export function trackOrder(orderId: string, amount: number) {
  try { sendEvent('order', window.location.pathname, { orderId, amount }); } catch { /* */ }
}

export function getVisitorAttribution(): { visitorId: string; source: string; medium: string; campaign: string; landingPage: string } {
  try {
    const attribution = getAttribution();
    return {
      visitorId: getVisitorId(),
      source: attribution.utm_source || '',
      medium: attribution.utm_medium || '',
      campaign: attribution.utm_campaign || '',
      landingPage: attribution.landingPage || '',
    };
  } catch {
    return { visitorId: '', source: '', medium: '', campaign: '', landingPage: '' };
  }
}
