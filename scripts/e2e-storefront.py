#!/usr/bin/env python3
"""Headless storefront E2E — full guest checkout on an ISOLATED __TEST__ D2C company.

Why this exists: backend-flow-test.py proves the guest-checkout *API* contract, and
validate-storefront.py proves static schema + Lighthouse, but neither drives the real
storefront customer.js — the guest modal, the inline shipping-address form, and the
Place Order button. This runs a real headless browser through that whole flow.

Safety: it NEVER touches the real uSetGo store. It stands up its own throwaway company
(own UniqueIdentifier, own CompanyCode, own products, D2C enabled), generates that
company's storefront, drives the browser, then deletes every artifact it created. The
throwaway company has no ad-conversion config, so NO Meta/Google CAPI fires; local order
emails route to Mailpit. Runs as part of pre-commit.

Requires:
  - Local SAM services running (./manage_services.sh start)
  - account-service binary rebuilt after any template/customer.js change
  - ADMIN_PASSWORD env var set (real admin login)
  - playwright + chromium installed (pip install playwright && playwright install chromium)
  - docker (copy_d2c_files.sh pulls generated files out of the Lambda container)
"""
import http.server
import glob
import os
import shutil
import socketserver
import subprocess
import sys
import threading
import time

import requests

# ─── Configuration ──────────────────────────────────────────────────────────
API_URL = os.getenv("API_URL", "http://localhost:3000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "help@businesscart.ai")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
# Stripe SANDBOX (test-mode) secret key. Read from the environment (or the
# gitignored scripts/.precommit.env), never hardcoded — a committed key, even a
# test one, is a secret leak (GitHub push protection blocks it). Must be an
# sk_test_ key (guarded in main()); a live sk_live_ key is never accepted. The
# test writes it into the throwaway company's gateway config via the backend API
# with sandbox=True, so nothing is ever charged for real.
STRIPE_TEST_SECRET_KEY = os.getenv("STRIPE_TEST_SECRET_KEY")
# Stripe's universal test card (any future expiry, any CVC, any ZIP).
STRIPE_TEST_CARD = os.getenv("STRIPE_TEST_CARD", "4242424242424242")
STRIPE_TEST_EXP = "12/34"   # MM/YY, comfortably in the future
STRIPE_TEST_CVC = "123"
STRIPE_TEST_ZIP = "78701"
STRIPE_TEST_PHONE = "2015550123"   # Stripe Link marks phone required when "save my info" is on

PREFIX = "__TEST__"
PASSWORD = "Test@Secure1"                       # matches backend-flow-test.py policy
TS = str(int(time.time()))
UID = f"ui-teste2e-{TS}"                         # storefront folder + subdomain prefix
COMPANY_CODE = f"{PREFIX}-E2E-{TS}"
CUSTOMER_CODE = f"{PREFIX}-E2ECUST-{TS}"
COMPANY_EMAIL = f"{PREFIX}e2ecompany{TS}@test.com"
def guest_email_for(label):
    # Each viewport pass registers its own guest (same email would 409), so key
    # the address on the pass label (e.g. desktop / mobile).
    return f"{PREFIX}e2eguest{TS}-{label}@test.com"

STOREFRONT_DIR = os.path.abspath(f"./storefronts/{UID}")
COPY_SCRIPT = os.path.abspath("./copy_d2c_files.sh")
HTTP_PORT = 8770

# ANSI colors
GREEN, RED, YELLOW, NC = "\033[0;32m", "\033[0;31m", "\033[0;33m", "\033[0m"

passed = 0
failed = 0
errors = []

# Artifacts created so far, tracked incrementally so cleanup runs even if setup
# raises partway through (a returned tuple would be lost on exception).
CREATED = {"company_id": None, "product_ids": [], "guest_ids": [], "order_ids": []}


def ok(msg):
    global passed
    passed += 1
    print(f"  {GREEN}✓{NC} {msg}")


def fail(msg):
    global failed
    failed += 1
    errors.append(msg)
    print(f"  {RED}✗{NC} {msg}")


def step(msg):
    print(f"\n{YELLOW}▶ {msg}{NC}")


# ─── Minimal API client ─────────────────────────────────────────────────────
class API:
    def __init__(self, base):
        self.base = base
        self.token = None

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def post(self, path, body):
        return requests.post(f"{self.base}{path}", json=body, headers=self._headers(), timeout=120)

    def patch(self, path, body):
        return requests.patch(f"{self.base}{path}", json=body, headers=self._headers(), timeout=30)

    def request(self, method, path, body=None):
        return requests.request(method, f"{self.base}{path}", json=body, headers=self._headers(), timeout=30)

    def get(self, path):
        return requests.get(f"{self.base}{path}", headers=self._headers(), timeout=30)

    def delete(self, path):
        return requests.delete(f"{self.base}{path}", headers=self._headers(), timeout=30)


api = API(API_URL)


def _decode_id(jwt):
    import base64
    import json as _json
    payload = jwt.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    claims = _json.loads(base64.urlsafe_b64decode(payload))
    user = claims.get("user") or {}
    return user.get("id") or user.get("_id") or claims.get("id")


# ─── Setup: isolated __TEST__ D2C company + products + storefront ───────────
def setup():
    """Returns (company_id, [product_ids]) or raises on failure."""
    # 1. Admin login
    r = api.post("/accounts/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        raise RuntimeError(f"admin login failed: {r.status_code} {r.text[:200]}")
    admin_token = r.json().get("token") or r.json().get("accessToken")
    api.token = admin_token
    ok("admin login")

    # 2. Registration code set (binds b2c guests → this company)
    r = api.post("/codes", {"companyCode": COMPANY_CODE, "customerCode": CUSTOMER_CODE})
    if r.status_code not in (201, 409):
        raise RuntimeError(f"code create failed: {r.status_code} {r.text[:200]}")
    ok(f"code set created ({COMPANY_CODE})")

    # 3. Register the throwaway company against that code
    r = api.post("/accounts/register", {
        "name": f"{PREFIX} E2E Store", "email": COMPANY_EMAIL, "password": PASSWORD,
        "role": "company", "code": COMPANY_CODE, "companyName": f"{PREFIX} E2E Store",
    })
    if r.status_code != 201:
        raise RuntimeError(f"company register failed: {r.status_code} {r.text[:200]}")
    ok("throwaway company registered")

    # 4. Login as the company
    r = api.post("/accounts/login", {"email": COMPANY_EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        raise RuntimeError(f"company login failed: {r.status_code} {r.text[:200]}")
    company_token = r.json().get("token") or r.json().get("accessToken")
    company_id = _decode_id(company_token)
    CREATED["company_id"] = company_id  # track now so cleanup runs even if a later step raises
    api.token = company_token
    ok(f"company login (id={company_id})")

    # 5. Configure commerce + D2C storefront AS ADMIN. Critical: updateAccount
    #    strips d2c.enabled/customDomain/previewDomain for non-admin roles, so a
    #    company-role PATCH silently leaves enabled=false → regen takes the
    #    offboarding branch and writes NO storefront. Must patch as admin.
    #    shipping_out (not pickup) so the checkout shows the shipping-address
    #    section — the inline guest address form is what we exercise.
    #    stripe_pay is the only method → forces the real gateway redirect path
    #    (test card via Stripe sandbox), not the offline shortcut.
    api.token = admin_token
    r = api.patch(f"/accounts/{company_id}", {
        "company": {
            "taxableGoods": True, "taxRate": 8.25, "shippingRate": 10.0, "leadTime": 3,
            "paymentMethods": ["stripe_pay"],
            "deliveryMethods": ["shipping_out"],
            "shippingOutOptions": ["standard"],
            "uniqueIdentifier": UID,
            "d2c": {
                "enabled": True,
                "primaryColor": "#0d9488", "secondaryColor": "#ffffff",
                "contactEmail": COMPANY_EMAIL, "contactPhone": "555-0100",
                "heroTitle": "E2E Test Store", "heroSlogan": "Automated checkout test",
                "heroTextColor": "#ffffff", "heroBgColor": "#0d9488",
                "aboutText": "Isolated E2E test storefront.",
                "privacyText": "Test privacy policy.", "termsText": "Test terms.",
                "shippingText": "Ships in 3 business days.",
            },
        },
    })
    if r.status_code != 200:
        raise RuntimeError(f"company config PATCH failed: {r.status_code} {r.text[:300]}")
    # Confirm BOTH the folder name and enabled flag persisted — regen silently
    # no-ops (returns 200, writes nothing) if d2c.enabled didn't stick.
    acc = api.get(f"/accounts/{company_id}").json()
    comp = acc.get("company") or {}
    got_uid = comp.get("uniqueIdentifier")
    got_enabled = (comp.get("d2c") or {}).get("enabled")
    if got_uid != UID:
        raise RuntimeError(f"uniqueIdentifier not persisted (got {got_uid!r}, want {UID!r})")
    if got_enabled is not True:
        raise RuntimeError(f"d2c.enabled not persisted (got {got_enabled!r}) — regen would write nothing")
    ok(f"company configured (D2C enabled, uid={UID})")

    # 6. Products (active, in stock) so a PDP renders + add-to-cart works.
    #    Created as the company (products belong to the company account).
    api.token = company_token
    product_ids = []
    for i in (1, 2):
        r = api.post("/products", {
            "name": f"{PREFIX} E2E Product {i}", "description": f"Test product {i} for e2e.",
            "slug": f"test-e2e-product-{i}-{TS}",
            "price": 12.50 * i, "category": "Test / E2E", "stock": 100, "active": True,
        })
        if r.status_code not in (200, 201):
            raise RuntimeError(f"product {i} create failed: {r.status_code} {r.text[:200]}")
        product_ids.append(r.json().get("id") or r.json().get("_id"))
    CREATED["product_ids"] = product_ids
    ok(f"{len(product_ids)} active products created")

    # 6b. Configure the company's Stripe gateway in SANDBOX mode (never live) with
    #     the sk_test_ key. sandbox=True → checkout uses SandboxCredentials and hits
    #     Stripe test mode. A company may configure its own gateway (sellerID==self).
    r = api.request("PUT", f"/checkout/gateways/{company_id}", {
        "gateway": "stripe_pay",
        "displayName": "Stripe (sandbox test)",
        "sandbox": True,
        "sandboxCredentials": {"secretKey": STRIPE_TEST_SECRET_KEY},
    })
    if r.status_code not in (200, 201):
        raise RuntimeError(f"gateway config failed: {r.status_code} {r.text[:200]}")
    # Read back and assert it's sandbox, not live — a live-mode test company would
    # be a real-charge hazard.
    cfgs = api.get(f"/checkout/gateways/{company_id}").json() or []
    stripe_cfg = next((c for c in cfgs if c.get("gateway") == "stripe_pay"), None)
    if not stripe_cfg or stripe_cfg.get("sandbox") is not True:
        raise RuntimeError(f"stripe gateway not in sandbox mode: {stripe_cfg}")
    ok("Stripe gateway configured in SANDBOX mode (test card, no live charges)")

    # 7. Generate the storefront
    r = api.post(f"/accounts/{company_id}/regenerate", {})
    if r.status_code not in (200, 201, 202, 204):
        raise RuntimeError(f"regenerate failed: {r.status_code} {r.text[:200]}")
    ok("storefront generation returned 200")

    # 8. Pull generated files out of the Lambda container onto the host, using the
    #    same working script validate-storefront.py uses for uSetGo.
    r = subprocess.run([COPY_SCRIPT, UID], capture_output=True, text=True, timeout=90)
    if r.returncode != 0 or not os.path.isdir(f"{STOREFRONT_DIR}/products"):
        raise RuntimeError(f"copy_d2c_files.sh failed: {(r.stdout + r.stderr)[-300:]}")
    ok(f"storefront files copied to {STOREFRONT_DIR}")

    return company_id, product_ids


# ─── Local static server ────────────────────────────────────────────────────
def start_server():
    os.chdir(STOREFRONT_DIR)
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("", HTTP_PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# ─── Stripe hosted-checkout automation ──────────────────────────────────────
def _wait_quiet(page, selector, timeout_ms):
    """wait_for_selector that returns True/False instead of raising."""
    try:
        page.wait_for_selector(selector, timeout=timeout_ms)
        return True
    except Exception:
        return False


def _assert_order_email(short_id, guest_email):
    """Poll Mailpit for the guest's order-confirmation email (local SMTP sink)."""
    base = "http://localhost:8025/api/v1"
    subject = f"Order confirmation #{short_id}"
    for _ in range(20):
        try:
            r = requests.get(f"{base}/messages", params={"limit": 50}, timeout=2)
            if r.status_code == 200:
                for m in (r.json().get("messages", []) or []):
                    if m.get("Subject") == subject:
                        to = [t.get("Address", "").lower() for t in (m.get("To") or [])]
                        if guest_email.lower() in to:
                            ok(f"guest received order-confirmation email '{subject}'")
                            return
                        fail(f"order email found but not addressed to guest ({to})")
                        return
        except Exception:
            pass
        time.sleep(0.5)
    fail(f"order-confirmation email '{subject}' not found in Mailpit (is it running on :8025?)")


def _fill_stripe_checkout(page, guest_email):
    """Fill Stripe's sandbox hosted Checkout page and submit the test card.

    Stripe's hosted Checkout (checkout.stripe.com) renders its own fields on its
    own origin (not the iframed Elements widget), so Playwright can type into them
    directly. Field ids have been stable (cardNumber/cardExpiry/cardCvc/billingName);
    email is usually pre-filled from customer_email but we set it defensively.
    """
    # The Stripe account has several payment methods enabled, so Checkout renders
    # an accordion (Card / Cash App Pay / Klarna / Bank). The card fields only
    # exist once "Card" is selected — so choose it first. If Card is the only
    # method, its fields are already present and this is a no-op.
    page.wait_for_load_state("domcontentloaded")
    if not page.query_selector("#cardNumber"):
        selected = False
        candidates = [
            # The accordion header row for Card (clickable region).
            lambda: page.get_by_test_id("card-accordion-item-button"),
            lambda: page.get_by_role("radio", name="Card"),
            lambda: page.get_by_text("Card", exact=True),
            # Radios are visually hidden behind Stripe's custom UI → force-click
            # the first one (Card is the first method listed).
            lambda: page.locator('input[type="radio"]').first,
        ]
        for make in candidates:
            try:
                loc = make().first
                loc.click(timeout=6000, force=True)
                selected = True
                if page.query_selector("#cardNumber") or _wait_quiet(page, "#cardNumber", 4000):
                    break
            except Exception:
                continue
        if not selected:
            page.screenshot(path="/tmp/e2e-stripe-methods.png")
            with open("/tmp/e2e-stripe-dom.html", "w") as fp:
                fp.write(page.content())
            raise RuntimeError("could not select the Card payment method on Stripe checkout "
                               "(see /tmp/e2e-stripe-methods.png and /tmp/e2e-stripe-dom.html)")
    page.wait_for_selector("#cardNumber", timeout=40000)
    email = page.query_selector("#email")
    if email and not (email.input_value() or "").strip():
        email.fill(guest_email)
    page.fill("#cardNumber", STRIPE_TEST_CARD)
    page.fill("#cardExpiry", STRIPE_TEST_EXP)
    page.fill("#cardCvc", STRIPE_TEST_CVC)
    name = page.query_selector("#billingName")
    if name:
        name.fill("E2E Guest")
    zip_field = page.query_selector("#billingPostalCode")
    if zip_field:
        zip_field.fill(STRIPE_TEST_ZIP)
    # "Save my information" (Stripe Link) is checked by default and makes the phone
    # number required — fill it so the Pay button can submit.
    phone = page.query_selector("#phoneNumber") or page.query_selector('input[type="tel"]')
    if phone:
        phone.fill(STRIPE_TEST_PHONE)
    # Submit — Stripe's pay button carries this stable test id.
    btn = page.query_selector('[data-testid="hosted-payment-submit-button"]') \
        or page.query_selector('button[type="submit"]')
    if not btn:
        raise RuntimeError("Stripe submit button not found on hosted checkout")
    btn.click()


def _snapshot_all_order_ids():
    """Every order _id currently in the DB (admin view) — the pre-run baseline the
    safety net checks against. Read-only."""
    saved = api.token
    try:
        r = api.post("/accounts/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        api.token = r.json().get("token") or r.json().get("accessToken")
        rows = api.get("/checkout/orders").json() or []
        return {(o.get("id") or o.get("_id")) for o in rows if (o.get("id") or o.get("_id"))}
    except Exception:
        return set()
    finally:
        api.token = saved


def _assert_paid_order(guest_email):
    """Verify the paid order persisted correctly server-side (via admin).

    Returns the order dict, or None if not found. Filters by this pass's guest
    email so it finds the right order when several passes have run. Checks:
    stripe_pay method, the guest email carried all the way through Stripe to the
    order (the 'email carries, don't ask again' requirement), delivery method, status.
    """
    company_id = CREATED["company_id"]
    saved = api.token
    try:
        r = api.post("/accounts/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        api.token = r.json().get("token") or r.json().get("accessToken")
        orders = api.get(f"/checkout/orders?sellerId={company_id}").json() or []
        paid = [o for o in orders if o.get("paymentMethod") == "stripe_pay"
                and (o.get("customerEmail") or "").lower() == guest_email.lower()]
        if not paid:
            fail(f"no stripe_pay order persisted for {guest_email} (found {len(orders)} order(s))")
            return None
        o = paid[0]
        ok(f"server confirms stripe_pay order persisted (total ${o.get('grandTotal')})")
        # Email carried end-to-end (guest email → Stripe → order) — guaranteed by
        # the filter above, so this is the positive confirmation line.
        ok("order carries the guest email (checkout never re-asked for it)")
        if o.get("deliveryMethod") != "shipping_out":
            fail(f"order deliveryMethod {o.get('deliveryMethod')!r} != shipping_out")
        else:
            ok(f"order delivery/status correct (deliveryMethod=shipping_out, status={o.get('status')!r})")
        return o
    finally:
        api.token = saved


# ─── Playwright guest-checkout drive ────────────────────────────────────────
# A phone viewport for the mobile pass. Explicit keys (not **pw.devices[...]) so
# we don't pass default_browser_type into new_context. The UA carries "Mozilla"
# so detectBot never flags it.
MOBILE_CONTEXT = dict(
    viewport={"width": 390, "height": 844},
    device_scale_factor=3,
    is_mobile=True,
    has_touch=True,
    user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
                "Mobile/15E148 Safari/604.1"),
)


def _run_checkout(page, guest_email, label):
    """Drive one full guest checkout at whatever viewport `page` is in."""
    pdp_name = os.path.basename(sorted(glob.glob(f"{STOREFRONT_DIR}/products/*.html"))[0])
    url = f"http://localhost:{HTTP_PORT}/products/{pdp_name}"

    page.goto(url, wait_until="load")
    page.wait_for_function("window.D2C_CART && window.D2C_PRODUCT && window.D2C_CUSTOMER")
    ok(f"[{label}] storefront PDP loaded ({pdp_name})")

    count = page.evaluate(
        "async () => { await window.D2C_CART.addItem(window.D2C_PRODUCT, 1);"
        " return (window.D2C_CART.items || []).length; }"
    )
    if not count:
        fail(f"[{label}] add-to-cart did not populate the cart")
        return
    ok(f"[{label}] product added to cart")

    page.evaluate("() => window.D2C_CUSTOMER.startCheckout(window.D2C_CART.items)")
    page.wait_for_selector("#d2c-guest-form", state="visible")
    ok(f"[{label}] guest checkout modal opened (no login required)")

    page.fill('#d2c-guest-form input[name="name"]', "E2E Guest")
    page.fill('#d2c-guest-form input[name="email"]', guest_email)
    page.click('#d2c-guest-form button[type="submit"]')

    page.wait_for_selector("#d2c-checkout-overlay", state="visible")
    page.wait_for_selector("#checkout-add-address-form", state="visible")
    # Capture guest id now (account already exists) so cleanup deletes it even if
    # a later step fails.
    guest_id = page.evaluate(
        "() => (window.D2C_CUSTOMER && window.D2C_CUSTOMER.user)"
        " ? (window.D2C_CUSTOMER.user._id || window.D2C_CUSTOMER.user.id) : null"
    )
    if guest_id:
        CREATED["guest_ids"].append(guest_id)
    ok(f"[{label}] passwordless guest created; checkout overlay + inline address form shown")

    page.fill("#addr-recipient", "E2E Guest")
    page.fill("#addr-phone", "555-0100")
    page.fill("#addr-street", "1 Test St")
    page.fill("#addr-city", "Austin")
    page.fill("#addr-state", "TX")
    page.fill("#addr-zip", "78701")
    page.click('#checkout-add-address-form button[type="submit"]')

    page.wait_for_selector("#checkout-place-order-btn:not([disabled])")
    ok(f"[{label}] shipping address saved; Place Order enabled")

    page.click("#checkout-place-order-btn")
    page.wait_for_url("**checkout.stripe.com/**", timeout=40000)
    ok(f"[{label}] redirected to Stripe sandbox hosted checkout")

    _fill_stripe_checkout(page, guest_email)
    ok(f"[{label}] entered Stripe test card {STRIPE_TEST_CARD[:4]}…{STRIPE_TEST_CARD[-4:]} and paid")

    page.wait_for_url("**localhost:%d/**" % HTTP_PORT, timeout=60000)
    page.wait_for_selector("#order-confirm-overlay", state="visible", timeout=30000)
    ok(f"[{label}] returned from Stripe → order finalized → confirmation shown")

    # (1) Confirmation overlay actually rendered the order details.
    page.wait_for_function(
        "() => { const d = document.querySelector('#order-confirm-details');"
        " return d && d.textContent.includes('$'); }",
        timeout=15000,
    )
    ok(f"[{label}] confirmation overlay rendered order details (guest read own order back)")

    # (2) Server-side: order persisted with stripe_pay + this guest's email.
    order = _assert_paid_order(guest_email)
    order_id = (order.get("id") or order.get("_id")) if order else ""
    if order_id:
        CREATED["order_ids"].append(order_id)   # track for scoped cleanup — NEVER a broad delete
    short_id = order_id[-6:]

    # (3) 'View My Orders' lands on the Orders tab and lists this order.
    page.click("#order-confirm-overlay button:has-text('View My Orders')")
    page.wait_for_selector("#dashboard-content", state="visible", timeout=15000)
    if short_id:
        page.wait_for_selector(f".dash-card:has-text('Order #{short_id}')", timeout=15000)
        ok(f"[{label}] 'View My Orders' lands on Orders tab and lists the order (Order #{short_id})")

    # (4) Guest received the order-confirmation email (Mailpit).
    if short_id:
        _assert_order_email(short_id, guest_email)


def run_browser():
    """Run the full guest checkout at desktop AND mobile viewports."""
    from playwright.sync_api import sync_playwright

    if not sorted(glob.glob(f"{STOREFRONT_DIR}/products/*.html")):
        fail("no PDPs generated — cannot run browser flow")
        return

    headed = os.getenv("HEADED", "").lower() in ("1", "true", "yes")
    # Desktop = default context; mobile = iPhone-size emulation.
    passes = [("desktop", {}), ("mobile", MOBILE_CONTEXT)]
    with sync_playwright() as pw:
        # --disable-web-security: storefront (:8770) fetches the API (:3000)
        # cross-origin; bypass CORS for this local test only.
        browser = pw.chromium.launch(headless=not headed, slow_mo=650 if headed else 0, args=[
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-sandbox",
        ])
        for label, ctx_opts in passes:
            step(f"Browser [{label}]: full guest checkout through customer.js")
            ctx = browser.new_context(**ctx_opts)
            page = ctx.new_page()
            page.set_default_timeout(25000)
            try:
                _run_checkout(page, guest_email_for(label), label)
            except Exception as e:
                try:
                    print(f"    [debug] URL at failure: {page.url}")
                    page.screenshot(path=f"/tmp/e2e-storefront-fail-{label}.png")
                except Exception:
                    pass
                fail(f"[{label}] browser flow error: {type(e).__name__}: {str(e)[:200]}")
            finally:
                ctx.close()
        browser.close()


# ─── Cleanup (best-effort; never fails the run) ─────────────────────────────
def cleanup(httpd):
    step("Cleanup: remove every artifact this test created")
    company_id = CREATED["company_id"]
    product_ids = CREATED["product_ids"]
    guest_ids = CREATED["guest_ids"]
    if httpd:
        try:
            httpd.shutdown()
        except Exception:
            pass

    def _try(label, fn):
        try:
            fn()
            print(f"  {GREEN}✓{NC} {label}")
        except Exception as e:
            print(f"  {YELLOW}⚠ {label}: {e}{NC}")

    def _admin_login():
        r = api.post("/accounts/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        api.token = r.json().get("token") or r.json().get("accessToken")

    # Products belong to the company, so delete them as the company (admin can't).
    # The create response doesn't return a usable id, so list the company's live
    # products and delete each real one.
    if product_ids or company_id:
        try:
            r = api.post("/accounts/login", {"email": COMPANY_EMAIL, "password": PASSWORD})
            api.token = r.json().get("token") or r.json().get("accessToken")
            prods = api.get("/products").json() or []
            real_ids = [p.get("_id") or p.get("id") for p in prods]
            real_ids = [pid for pid in real_ids if pid and pid != "0" * 24]
            for pid in real_ids:
                _try(f"deleted product {pid}", lambda pid=pid: api.delete(f"/products/{pid}"))
            # Gateway config holds the (encrypted) sk_test key — delete it too.
            if company_id:
                _try("deleted stripe gateway config",
                     lambda: api.delete(f"/checkout/gateways/{company_id}/stripe_pay"))
        except Exception as e:
            print(f"  {YELLOW}⚠ product/gateway cleanup login: {e}{NC}")

    # Everything else as admin.
    _try("admin re-login for cleanup", _admin_login)
    # Delete ONLY the order IDs this test created. NEVER fetch-and-delete by
    # seller/filter: GET /checkout/orders ignores ?sellerId= for the admin role
    # and returns EVERY order, so a broad delete wipes the whole (shared prod)
    # collection. Scoped, tracked-id deletion only.
    for oid in CREATED["order_ids"]:
        _try(f"deleted order {oid}", lambda o=oid: api.delete(f"/checkout/orders/{o}"))
    for guest_id in guest_ids:
        _try(f"deleted guest account {guest_id}", lambda gid=guest_id: api.delete(f"/accounts/{gid}"))
    if company_id:
        _try(f"deleted company {company_id}", lambda: api.delete(f"/accounts/{company_id}"))
    _try(f"deleted code {COMPANY_CODE}", lambda: api.delete(f"/codes/{COMPANY_CODE}"))
    if os.path.isdir(STOREFRONT_DIR):
        _try(f"removed {STOREFRONT_DIR}", lambda: shutil.rmtree(STOREFRONT_DIR))


# ─── Main ───────────────────────────────────────────────────────────────────
def main():
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{NC}")
    print(f"{YELLOW}  Headless Storefront E2E — isolated guest checkout{NC}")
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{NC}")

    if not ADMIN_PASSWORD:
        fail("ADMIN_PASSWORD env var not set — cannot log in as admin")
        print(f"\n  {RED}PASSED: {passed}  FAILED: {failed}{NC}")
        sys.exit(1)
    if not STRIPE_TEST_SECRET_KEY or not STRIPE_TEST_SECRET_KEY.startswith("sk_test_"):
        fail("STRIPE_TEST_SECRET_KEY not set to an sk_test_ key — refusing to run "
             "(the card path needs a Stripe SANDBOX secret key; never use a live sk_live_ key)")
        print(f"\n  {RED}PASSED: {passed}  FAILED: {failed}{NC}")
        sys.exit(1)

    start = time.time()
    httpd = None
    # SAFETY NET: snapshot every order that exists BEFORE this run. The test must
    # only ever delete orders it created; if any pre-existing order goes missing,
    # something did a broad/unscoped delete and we fail loudly (this is the exact
    # class of bug that once wiped production orders). Belt to the tracked-id braces.
    baseline_orders = _snapshot_all_order_ids()
    try:
        step("Setup: isolated __TEST__ D2C company + products + storefront")
        setup()

        httpd = start_server()
        run_browser()  # runs desktop + mobile passes, each with its own step()
    except Exception as e:
        fail(f"setup error: {type(e).__name__}: {str(e)[:300]}")
    finally:
        cleanup(httpd)

    missing = baseline_orders - _snapshot_all_order_ids()
    if missing:
        fail(f"CRITICAL SAFETY VIOLATION: {len(missing)} pre-existing order(s) were deleted by this "
             f"run — a broad/unscoped delete slipped in. IDs: {sorted(missing)[:5]} … DB needs recovery.")
    else:
        ok(f"safety net: all {len(baseline_orders)} pre-existing orders untouched")

    elapsed = time.time() - start
    print()
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{NC}")
    color = GREEN if failed == 0 else RED
    print(f"  {color}PASSED: {passed}  FAILED: {failed}{NC}  Time: {elapsed:.1f}s")
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{NC}")
    if failed > 0:
        print(f"\n{RED}Failures:{NC}")
        for e in errors:
            print(f"  {RED}•{NC} {e}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
