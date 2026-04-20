const API_URL = import.meta.env.VITE_API_URL;
const VISITOR_KEY = 'bc_visitor_id';
const ATTR_KEY = 'bc_attribution';

const PUBLIC_PAGES = [
  '/', '/about', '/contact-us', '/careers', '/faq',
  '/compare', '/industries', '/blog', '/user-guide',
  '/system-status', '/privacy-policy', '/terms-of-service',
];

function isPublicPage(page: string): boolean {
  return PUBLIC_PAGES.includes(page) || page.startsWith('/blog/');
}

function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeLocalSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* silently ignore */ }
}

function getVisitorId(): string {
  let id = safeLocalGet(VISITOR_KEY);
  if (!id) {
    id = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
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
    utm_term: params.get('utm_term') || '',
  };

  safeLocalSet(ATTR_KEY, JSON.stringify(attribution));
  return attribution;
}

function isInternalUser(): boolean {
  try {
    const token = safeLocalGet('accessToken');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const role = payload?.user?.role || '';
    return role === 'admin' || role === 'company' || role === 'partner';
  } catch { return false; }
}

let sessionTracked = false;

export function trackPageView(page: string) {
  try {
    if (sessionTracked) return;
    if (!isPublicPage(page)) return;
    if (!API_URL) return;
    if (isInternalUser()) return;

    sessionTracked = true;

    const sendEvent = () => {
      const attribution = getAttribution();

      fetch(`${API_URL}/visitors/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: getVisitorId(),
          event: 'page_view',
          page,
          referrer: attribution.referrer,
          utm_source: attribution.utm_source,
          utm_medium: attribution.utm_medium,
          utm_campaign: attribution.utm_campaign,
          utm_content: attribution.utm_content,
          utm_term: attribution.utm_term,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          screenWidth: window.screen?.width || 0,
          screenHeight: window.screen?.height || 0,
          language: navigator.language || '',
        }),
        keepalive: true,
      }).catch(() => {});
    };

    // Defer to idle so the tracker never blocks LCP. On initial page load,
    // wait for the `load` event first; on SPA navigations document is already
    // complete so the idle callback fires immediately.
    const deferredSend = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(sendEvent, { timeout: 2000 });
      } else {
        setTimeout(sendEvent, 1000);
      }
    };

    if (document.readyState === 'complete') {
      deferredSend();
    } else {
      window.addEventListener('load', deferredSend, { once: true });
    }
  } catch {
    // Never crash the app
  }
}
