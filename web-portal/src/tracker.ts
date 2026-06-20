const API_URL = import.meta.env.VITE_API_URL;
const VISITOR_KEY = 'bc_visitor_id';
const ATTR_KEY = 'bc_attribution';
const CLICK_KEY = 'bc_clickids';
const CLICK_KEYS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid', 'ttclid', 'epik', 'sccid', 'rdt_cid'];

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

// Read paid-ad click IDs (gclid, msclkid, fbclid, etc.) from URL, cache in
// localStorage so they survive SPA navigation. Returns cached if no fresh.
function clickIds(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const fresh: Record<string, string> = {};
  for (const k of CLICK_KEYS) {
    const v = params.get(k);
    if (v) fresh[k] = v;
  }
  if (Object.keys(fresh).length) {
    safeLocalSet(CLICK_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    const cached = safeLocalGet(CLICK_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* corrupted, return empty */ }
  return {};
}

// Strip self-referrals (e.g. businesscart.ai -> businesscart.ai). Backend
// inferSource defaults unknown referrers to "referral / referral"; sending
// an empty string makes it fall through to "direct / direct".
function cleanReferrer(ref: string): string {
  if (!ref) return '';
  try {
    const rh = new URL(ref).hostname.replace(/^www\./, '').toLowerCase();
    const ch = window.location.hostname.replace(/^www\./, '').toLowerCase();
    if (rh === ch) return '';
  } catch { /* invalid URL — leave as-is */ }
  return ref;
}

function getAttribution(): Record<string, string> {
  try {
    const existing = safeLocalGet(ATTR_KEY);
    if (existing) {
      const cached = JSON.parse(existing);
      cached.referrer = cleanReferrer(cached.referrer || '');
      return cached;
    }
  } catch { /* corrupted data — recapture */ }

  const params = new URLSearchParams(window.location.search);
  const attribution: Record<string, string> = {
    referrer: cleanReferrer(document.referrer || ''),
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
          clickIds: clickIds(),
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

// Fires a contact_conversion event when a paid-ad visitor reaches /contact-us
// AFTER visiting at least one prior page in this session. Filters direct loads
// (returning users, bookmarks, bots) and non-PPC traffic. The landingPage check
// uses cached attribution: if /contact-us is the recorded first page, the
// visitor came straight here without browsing first.
export function trackContactConversion(page: string) {
  try {
    if (page !== '/contact-us') return;
    if (!API_URL) return;
    if (isInternalUser()) return;

    const attr = getAttribution();
    if (attr.landingPage === '/contact-us') return;  // direct land, skip

    const ids = clickIds();
    if (!ids.gclid) return;  // not from Google Ads, skip

    fetch(`${API_URL}/visitors/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getVisitorId(),
        event: 'contact_conversion',
        page,
        clickIds: ids,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never crash the app
  }
}
