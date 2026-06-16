#!/usr/bin/env python3
"""
BusinessCart Backend Flow Test
Tests portal + storefront + enforcement flows sequentially.
Cleans up test data on success or failure (try/finally).

Usage:
  python3 backend-flow-test.py                          # default localhost:3000
  python3 backend-flow-test.py --base-url http://...    # custom URL
  python3 backend-flow-test.py --cleanup-only           # just cleanup
"""

import argparse
import base64
import datetime
import json
import sys
import time

import requests

# ── Test data (unique prefix to avoid collision) ──────────────────────

PREFIX = "__TEST__"
PASSWORD = "Test@Secure1"

USERS = {
    "admin":     {"email": f"{PREFIX}admin@test.com",     "name": f"{PREFIX} Admin",           "role": "admin"},
    "company1":  {"email": f"{PREFIX}company1@test.com",  "name": f"{PREFIX} Alpha Corp",      "role": "company"},
    "company2":  {"email": f"{PREFIX}company2@test.com",  "name": f"{PREFIX} Beta Corp",       "role": "company"},
    "customer":  {"email": f"{PREFIX}customer@test.com",  "name": f"{PREFIX} Customer One",    "role": "customer"},
    "customer2": {"email": f"{PREFIX}customer2@test.com", "name": f"{PREFIX} Customer Two",    "role": "customer"},
    "b2c":       {"email": f"{PREFIX}b2c@test.com",       "name": f"{PREFIX} B2C Shopper",     "role": "b2c"},
}

CODES = {
    "set1": {"companyCode": f"{PREFIX}-COMP-1", "customerCode": f"{PREFIX}-CUST-1"},
    "set2": {"companyCode": f"{PREFIX}-COMP-2", "customerCode": f"{PREFIX}-CUST-2", "partnerCode": f"{PREFIX}-PART-2"},
}

# company code used at registration
USER_CODES = {
    "company1":  CODES["set1"]["companyCode"],
    "company2":  CODES["set2"]["companyCode"],
    "customer":  CODES["set1"]["customerCode"],
    "customer2": f'{CODES["set1"]["customerCode"]},{CODES["set2"]["customerCode"]}',
    "b2c":       CODES["set1"]["companyCode"],
}

# ── Colors ────────────────────────────────────────────────────────────

RED = "\033[0;31m"
GREEN = "\033[0;32m"
CYAN = "\033[0;36m"
YELLOW = "\033[0;33m"
BOLD = "\033[1m"
NC = "\033[0m"


def phase(msg):
    print(f"\n{BOLD}{CYAN}{'═' * 60}{NC}")
    print(f"{BOLD}{CYAN}  {msg}{NC}")
    print(f"{BOLD}{CYAN}{'═' * 60}{NC}")


def step(msg):
    print(f"\n{CYAN}  ── {msg}{NC}")


def ok(msg):
    print(f"  {GREEN}✓ {msg}{NC}")


def warn(msg):
    print(f"  {YELLOW}⚠ {msg}{NC}")


def fail(msg):
    print(f"  {RED}✗ {msg}{NC}")


# ── Assertion helpers ─────────────────────────────────────────────────

class AssertionError(Exception):
    pass


def assert_status(resp, expected, context=""):
    if resp.status_code != expected:
        body = resp.text[:500]
        raise AssertionError(
            f"{context}: expected HTTP {expected}, got {resp.status_code}\n  Body: {body}"
        )


def assert_status_in(resp, expected_list, context=""):
    if resp.status_code not in expected_list:
        body = resp.text[:500]
        raise AssertionError(
            f"{context}: expected HTTP {expected_list}, got {resp.status_code}\n  Body: {body}"
        )


def assert_field(data, field, expected, context=""):
    actual = data.get(field)
    if actual != expected:
        raise AssertionError(
            f"{context}: expected {field}={expected}, got {actual}"
        )


def assert_gt(actual, threshold, context=""):
    if not actual > threshold:
        raise AssertionError(f"{context}: expected > {threshold}, got {actual}")


def assert_contains(text, substring, context=""):
    if substring.lower() not in text.lower():
        raise AssertionError(f"{context}: expected '{substring}' in '{text[:200]}'")


# ── API Client ────────────────────────────────────────────────────────

class APIClient:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.token = None

    def set_token(self, token):
        self.token = token
        self.session.headers["Authorization"] = f"Bearer {token}"

    def clear_token(self):
        self.token = None
        self.session.headers.pop("Authorization", None)

    def get(self, path, **kwargs):
        return self.session.get(f"{self.base_url}{path}", **kwargs)

    def post(self, path, json_data=None, **kwargs):
        return self.session.post(f"{self.base_url}{path}", json=json_data, **kwargs)

    def patch(self, path, json_data=None, **kwargs):
        return self.session.patch(f"{self.base_url}{path}", json=json_data, **kwargs)

    def put(self, path, json_data=None, **kwargs):
        return self.session.put(f"{self.base_url}{path}", json=json_data, **kwargs)

    def delete(self, path, **kwargs):
        return self.session.delete(f"{self.base_url}{path}", **kwargs)

    def decode_jwt(self, token=None):
        t = token or self.token
        payload = t.split(".")[1]
        padding = 4 - len(payload) % 4
        payload += "=" * padding
        return json.loads(base64.b64decode(payload))


# ── Resource tracker ──────────────────────────────────────────────────

class Tracker:
    def __init__(self):
        self.accounts = []   # (role_key, account_id)
        self.products = []   # (owner_role_key, product_id)
        self.orders = []     # order_id
        self.codes = []      # company_code string (used for DELETE /codes/{code})
        self.visitors = []   # visitor_id string
        self.statements = [] # statement_id string
        self.blog_posts = [] # (owner_role_key, blog_post_id)

    def track_account(self, role_key, account_id):
        self.accounts.append((role_key, account_id))

    def track_product(self, role_key, product_id):
        self.products.append((role_key, product_id))

    def track_order(self, order_id):
        self.orders.append(order_id)

    def track_visitor(self, visitor_id):
        if visitor_id not in self.visitors:
            self.visitors.append(visitor_id)

    def track_code(self, company_code):
        if company_code not in self.codes:
            self.codes.append(company_code)

    def track_statement(self, statement_id):
        if statement_id not in self.statements:
            self.statements.append(statement_id)

    def track_blog_post(self, role_key, blog_post_id):
        self.blog_posts.append((role_key, blog_post_id))


# ── Test runner ───────────────────────────────────────────────────────

class BackendFlowTest:
    def __init__(self, base_url):
        self.api = APIClient(base_url)
        self.tracker = Tracker()
        self.jwts = {}       # role_key -> token
        self.ids = {}        # role_key -> account_id
        self.product_ids = {}  # role_key -> [product_ids]
        self.passed = 0
        self.failed = 0

    # ── Helpers ───────────────────────────────────────────────────

    def _login(self, email):
        resp = self.api.post("/accounts/login", {"email": email, "password": PASSWORD})
        if resp.status_code == 200:
            data = resp.json()
            return data["accessToken"]
        return None

    def _get_id_from_jwt(self, token):
        claims = self.api.decode_jwt(token)
        return claims["user"]["id"]

    def _get_configs_from_jwt(self, token):
        claims = self.api.decode_jwt(token)
        return claims["user"].get("configurations", [])

    def login_or_register(self, role_key):
        """Idempotent: try login first, register if needed."""
        user = USERS[role_key]
        step(f"Login or register: {role_key} ({user['email']})")

        token = self._login(user["email"])
        if token:
            ok(f"Logged in {role_key}")
            self.jwts[role_key] = token
            self.ids[role_key] = self._get_id_from_jwt(token)
            self.api.set_token(token)
            return

        # Register
        payload = {
            "name": user["name"],
            "email": user["email"],
            "password": PASSWORD,
            "role": user["role"],
        }

        codes_str = USER_CODES.get(role_key)
        if user["role"] == "company" and codes_str:
            payload["code"] = codes_str
            payload["companyName"] = user["name"]
        elif user["role"] == "b2c" and codes_str:
            payload["code"] = codes_str
        elif user["role"] == "customer" and codes_str:
            payload["customerCodes"] = [c.strip() for c in codes_str.split(",")]

        resp = self.api.post("/accounts/register", payload)
        assert_status(resp, 201, f"Register {role_key}")
        ok(f"Registered {role_key}")

        # Login to get JWT
        token = self._login(user["email"])
        if not token:
            raise AssertionError(f"Login failed after registration for {role_key}")

        self.jwts[role_key] = token
        self.ids[role_key] = self._get_id_from_jwt(token)
        self.tracker.track_account(role_key, self.ids[role_key])
        self.api.set_token(token)

    def use_token(self, role_key):
        """Switch API client to use a specific user's token."""
        self.api.set_token(self.jwts[role_key])

    def re_login(self, role_key):
        """Re-login to get fresh JWT with updated config."""
        user = USERS[role_key]
        token = self._login(user["email"])
        if not token:
            raise AssertionError(f"Re-login failed for {role_key}")
        self.jwts[role_key] = token
        self.api.set_token(token)
        ok(f"Re-logged in {role_key}")

    def run_test(self, name, fn):
        """Run a test function, track pass/fail."""
        step(name)
        try:
            fn()
            self.passed += 1
        except (AssertionError, Exception) as e:
            fail(f"FAILED: {name}\n    {e}")
            self.failed += 1

    # ── Phase 1: Setup accounts ──────────────────────────────────

    def phase1_setup(self):
        phase("PHASE 1: Setup Accounts")

        # Admin first
        self.login_or_register("admin")

        # Create codes
        for key, code_set in CODES.items():
            step(f"Create codes: {key}")
            self.use_token("admin")
            resp = self.api.post("/codes", code_set)
            if resp.status_code == 201:
                ok(f"Codes created: {code_set['companyCode']}")
                self.tracker.track_code(code_set["companyCode"])
            elif resp.status_code == 409:
                warn(f"Codes already exist: {code_set['companyCode']}")
                self.tracker.track_code(code_set["companyCode"])
            else:
                assert_status_in(resp, [201, 409], f"Create codes {key}")

        # Register companies
        self.login_or_register("company1")
        self.login_or_register("company2")

        # Register customers
        self.login_or_register("customer")
        self.login_or_register("customer2")

        # Register B2C
        self.login_or_register("b2c")

        ok(f"All accounts ready. IDs: { {k: v[:8]+'...' for k,v in self.ids.items()} }")

    # ── Phase 2: Company settings ────────────────────────────────

    def phase2_company_settings(self):
        phase("PHASE 2: Company Settings")

        self.use_token("company1")
        c1_id = self.ids["company1"]

        step("Set company1 enforcement defaults")
        resp = self.api.patch(f"/accounts/{c1_id}", {
            "company": {
                "creditLimit": 500,
                "minOrderAmountLimit": 20,
                "maxOrderAmountLimit": 1000,
                "minOrderQuantityLimit": 1,
                "maxOrderQuantityLimit": 50,
                "monthlyOrderLimit": 10,
                "yearlyOrderLimit": 50,
                "taxableGoods": True,
                "taxRate": 8.25,
                "shippingRate": 15.00,
                "leadTime": 3,
                "quotesAllowed": True,
                "paymentMethods": ["credit_card", "purchase_order"],
                "deliveryMethods": ["pickup", "shipping_out"],
                "shippingOutOptions": ["standard"],
            }
        })
        assert_status(resp, 200, "Update company1 settings")
        ok("Company1 defaults set")

        # API-first contract: backend rejects type mismatches at the boundary so
        # the DB never holds invalid state. The actual prod-bug shape was empty
        # string for shippingRate (frontend cleared <input type=number>), which
        # silently corrupted the doc and 500'd every later admin GET /accounts.
        step("Reject empty string for numeric field (the actual prod bug shape)")
        resp = self.api.patch(f"/accounts/{c1_id}", {
            "company": {"shippingRate": ""},
        })
        assert_status(resp, 400, "Empty string for numeric field")
        ok("Empty string for shippingRate rejected with 400")

        step("Reject string for boolean field")
        resp = self.api.patch(f"/accounts/{c1_id}", {
            "company": {"taxableGoods": "yes"},
        })
        assert_status(resp, 400, "String for boolean field")
        ok("String for taxableGoods rejected with 400")

        step("Backward compat: null clears a numeric field (still allowed)")
        resp = self.api.patch(f"/accounts/{c1_id}", {
            "company": {"leadTime": None},
        })
        assert_status(resp, 200, "Null for numeric field accepted")
        ok("Null for leadTime accepted (backward compatible)")

        # Re-set leadTime so downstream tests have the value they expect
        resp = self.api.patch(f"/accounts/{c1_id}", {
            "company": {"leadTime": 3},
        })
        assert_status(resp, 200, "Restore leadTime")

        step("Set customer override (creditLimit: 300)")
        cust_id = self.ids["customer"]
        resp = self.api.patch(f"/customers/{cust_id}/configuration", {
            "creditLimit": 300,
        })
        assert_status(resp, 200, "Set customer config override")
        ok("Customer override set: creditLimit=300")

    # ── Phase 3: Catalog ─────────────────────────────────────────

    def phase3_catalog(self):
        phase("PHASE 3: Catalog")

        for role_key, count, prefix, base_price in [
            ("company1", 5, "Alpha", 10),
            ("company2", 5, "Beta", 12),
        ]:
            self.use_token(role_key)
            step(f"Check/create products for {role_key}")

            resp = self.api.get("/products")
            assert_status(resp, 200, f"Get products for {role_key}")
            existing = [p for p in resp.json() if p.get("name", "").startswith(f"{PREFIX}")]
            self.product_ids[role_key] = [p["_id"] for p in existing]

            if len(existing) >= count:
                ok(f"{role_key} already has {len(existing)} test products, skipping")
                continue

            for i in range(1, count + 1):
                name = f"{PREFIX} {prefix} Product {i}"
                slug = f"test-{prefix.lower()}-product-{i}"
                # Skip if already exists
                if any(p.get("name") == name for p in existing):
                    continue
                resp = self.api.post("/products", {
                    "name": name,
                    "slug": slug,
                    "price": base_price * i + 0.99,
                    "description": f"Test product {prefix} {i}",
                })
                assert_status_in(resp, [200, 201], f"Create product {name}")

            # Re-fetch to get real IDs (create response returns zero ObjectID)
            resp = self.api.get("/products")
            assert_status(resp, 200, f"Re-fetch products for {role_key}")
            created = [p for p in resp.json() if p.get("name", "").startswith(f"{PREFIX}")]
            self.product_ids[role_key] = [p["_id"] for p in created]
            for p in created:
                self.tracker.track_product(role_key, p["_id"])
            ok(f"Products ready for {role_key} ({len(created)} products)")

        # Verify visibility
        def test_visibility():
            cases = [
                ("admin", 10, ">="),
                ("company1", 5, ">="),
                ("company2", 5, ">="),
                ("customer", 5, ">="),
                ("customer2", 10, ">="),
            ]
            for role_key, expected, op in cases:
                self.use_token(role_key)
                resp = self.api.get("/products")
                assert_status(resp, 200, f"Get products as {role_key}")
                actual = len(resp.json())
                if actual < expected:
                    raise AssertionError(
                        f"Product visibility {role_key}: expected >= {expected}, got {actual}"
                    )
                ok(f"{role_key} sees {actual} products (expected >= {expected})")

        self.run_test("Product visibility per role", test_visibility)

        # Category hierarchy validation
        def test_category_hierarchy():
            self.use_token("company1")
            pid = self.product_ids["company1"][0]

            # One slash allowed (primary / sub)
            resp = self.api.put(f"/products/{pid}", {"category": "Gloves / Winter"})
            assert_status(resp, 200, "Category with one slash accepted")
            ok("Category 'Gloves / Winter' accepted")

            # Two slashes rejected
            resp = self.api.put(f"/products/{pid}", {"category": "A / B / C"})
            assert_status(resp, 400, "Category with two slashes rejected")
            ok("Category 'A / B / C' rejected")

            # Restore original
            resp = self.api.put(f"/products/{pid}", {"category": f"{PREFIX} Category"})
            assert_status(resp, 200, "Category restored")

        self.run_test("Category hierarchy validation", test_category_hierarchy)

    # ── Phase 4: Re-login & JWT verification ─────────────────────

    def phase4_jwt_verification(self):
        phase("PHASE 4: Re-login & JWT Verification")

        def test_jwt_enforcement_values():
            self.re_login("customer")
            configs = self._get_configs_from_jwt(self.jwts["customer"])
            c1_id = self.ids["company1"]

            config = next((c for c in configs if c.get("company_id") == c1_id), None)
            if not config:
                raise AssertionError(f"No JWT config found for company {c1_id[:8]}...")

            # creditLimit should be 300 (customer override, not company default 500)
            if config.get("creditLimit") != 300:
                raise AssertionError(
                    f"JWT creditLimit: expected 300 (override), got {config.get('creditLimit')}"
                )
            ok("JWT creditLimit = 300 (customer override)")

            # minOrderAmountLimit should be 20 (resolved from company default)
            if config.get("minOrderAmountLimit") != 20:
                raise AssertionError(
                    f"JWT minOrderAmountLimit: expected 20, got {config.get('minOrderAmountLimit')}"
                )
            ok("JWT minOrderAmountLimit = 20 (company default resolved)")

            # leadTime should be 3
            if config.get("leadTime") != 3:
                raise AssertionError(
                    f"JWT leadTime: expected 3, got {config.get('leadTime')}"
                )
            ok("JWT leadTime = 3 (company default resolved)")

        self.run_test("JWT enforcement values after re-login", test_jwt_enforcement_values)
        self.re_login("customer2")

    # ── Phase 5: Portal checkout happy path ──────────────────────

    def _get_product(self, role_key, product_id):
        """Fetch product details for cart item."""
        self.use_token(role_key)
        resp = self.api.get(f"/products/{product_id}")
        if resp.status_code == 200:
            return resp.json()
        return None

    def _add_to_cart(self, role_key, seller_id, product_id, qty):
        self.use_token(role_key)
        product = self._get_product(role_key, product_id)
        entity = {
            "productId": product_id,
            "sellerId": seller_id,
            "quantity": qty,
        }
        if product:
            entity["name"] = product.get("name", "")
            entity["price"] = product.get("price", 0)
            if product.get("images"):
                entity["image"] = product["images"][0]
        resp = self.api.post("/checkout/cart", {"entity": entity})
        assert_status(resp, 200, f"Add to cart ({role_key})")
        return resp.json()

    def _clear_cart(self, role_key, seller_id):
        self.use_token(role_key)
        self.api.delete(f"/checkout/cart", params={"sellerId": seller_id})

    def _create_quote(self, role_key, seller_id, quote_type="standard",
                      extra_fields=None, account_id=None):
        self.use_token(role_key)
        payload = {
            "sellerId": seller_id,
            "paymentMethods": ["credit_card"],
            "deliveryMethods": ["pickup"],
            "shippingOutOptions": ["standard"],
            "quotesAllowed": True,
            "companyLocations": [],
            "customerAddresses": [],
            "quoteType": quote_type,
        }
        if account_id:
            payload["accountId"] = account_id
        if extra_fields:
            payload.update(extra_fields)
        return self.api.post("/checkout/quotes", payload)

    def phase5_happy_path(self):
        phase("PHASE 5: Portal Checkout — Happy Path")

        c1_id = self.ids["company1"]
        c2_id = self.ids["company2"]
        product_a = self.product_ids["company1"][0]
        product_c = self.product_ids["company2"][0]

        # 5a. Customer + Company1: standard quote
        # Product A is ~$10.99, need qty 3+ to clear minOrderAmount=20 after tax+shipping
        def test_customer_standard_quote():
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                "creditLimit": 500, "minOrderAmountLimit": 20, "maxOrderAmountLimit": 1000,
                "taxableGoods": True, "leadTime": 3,
            })
            assert_status(resp, 200, "Customer standard quote")
            data = resp.json()
            assert_gt(data.get("taxAmount", 0), 0, "Tax should be > 0")
            ok(f"Standard quote created: grandTotal=${data.get('grandTotal', 0):.2f}, tax=${data.get('taxAmount', 0):.2f}")
            if data.get("leadTime") == 3:
                ok("LeadTime = 3 on quote")
            else:
                warn(f"LeadTime = {data.get('leadTime')} (expected 3)")

        self.run_test("Customer standard quote (happy path)", test_customer_standard_quote)

        # 5b. Customer: negotiable quote
        def test_customer_negotiable_quote():
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "negotiable", extra_fields={
                "quotesAllowed": True,
            })
            assert_status(resp, 200, "Customer negotiable quote")
            ok("Negotiable quote created (quotesAllowed=true)")

        self.run_test("Customer negotiable quote", test_customer_negotiable_quote)

        # 5c. Customer2 + Company1
        def test_customer2_company1():
            self._clear_cart("customer2", c1_id)
            self._add_to_cart("customer2", c1_id, product_a, 2)
            resp = self._create_quote("customer2", c1_id, "standard")
            assert_status(resp, 200, "Customer2 quote with company1")
            ok("Customer2 quote with company1 created")

        self.run_test("Customer2 + Company1 quote", test_customer2_company1)

        # 5d. Customer2 + Company2
        def test_customer2_company2():
            self._clear_cart("customer2", c2_id)
            self._add_to_cart("customer2", c2_id, product_c, 3)
            resp = self._create_quote("customer2", c2_id, "standard")
            assert_status(resp, 200, "Customer2 quote with company2")
            ok("Customer2 quote with company2 created")

        self.run_test("Customer2 + Company2 quote", test_customer2_company2)

        # 5e. Get orders per role
        def test_get_orders():
            for rk in ["admin", "company1", "company2"]:
                self.use_token(rk)
                resp = self.api.get("/checkout/orders")
                assert_status(resp, 200, f"Get orders as {rk}")
                data = resp.json()
                ok(f"{rk}: {len(data) if data else 0} orders")

        self.run_test("Get orders per role", test_get_orders)

        # 5f. PPC attribution: place an order with visitorId + click IDs and verify they persist
        def test_order_attribution():
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            quote_resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                "creditLimit": 5000, "minOrderAmountLimit": 20, "maxOrderAmountLimit": 5000,
            })
            assert_status(quote_resp, 200, "Quote for attribution test")
            quote_id = quote_resp.json().get("id")

            self.use_token("customer")
            order_resp = self.api.post("/checkout/orders", {
                "quoteId": quote_id,
                "paymentMethod": "purchase_order",
                "deliveryMethod": "pickup",
                "visitorId": "v___test__attr_order",
                "clickIds": {"gclid": "ord_gclid_aaa", "msclkid": "ord_msclkid_bbb"},
            })
            assert_status(order_resp, 200, "Place order with attribution")
            o = order_resp.json()
            order_id = o.get("id") or o.get("_id")
            assert order_id, "order_id missing from response"
            self.tracker.track_order(order_id)

            # Assert attribution on POST response
            assert o.get("visitorId") == "v___test__attr_order", f"POST order.visitorId: {o.get('visitorId')}"
            click_ids = o.get("clickIds") or {}
            assert click_ids.get("gclid") == "ord_gclid_aaa", f"POST order.clickIds.gclid: {click_ids.get('gclid')}"
            assert click_ids.get("msclkid") == "ord_msclkid_bbb", f"POST order.clickIds.msclkid: {click_ids.get('msclkid')}"
            ok("POST response carries visitorId + clickIds")

            # GET back from /checkout/orders to confirm Mongo persistence (proves bson tags wrote correctly)
            self.use_token("admin")
            list_resp = self.api.get("/checkout/orders")
            assert_status(list_resp, 200, "List orders for persistence check")
            persisted = next((x for x in (list_resp.json() or []) if (x.get("id") or x.get("_id")) == order_id), None)
            assert persisted, f"Order {order_id} not found in GET /checkout/orders"
            assert persisted.get("visitorId") == "v___test__attr_order", f"persisted.visitorId: {persisted.get('visitorId')}"
            p_click = persisted.get("clickIds") or {}
            assert p_click.get("gclid") == "ord_gclid_aaa", f"persisted.clickIds.gclid: {p_click.get('gclid')}"
            assert p_click.get("msclkid") == "ord_msclkid_bbb", f"persisted.clickIds.msclkid: {p_click.get('msclkid')}"
            ok("Mongo-persisted order has visitorId + clickIds (gclid, msclkid)")

            # Orders export: wide window (yesterday to tomorrow) covers this just-placed order.
            now = datetime.datetime.now(datetime.timezone.utc)
            from_iso = (now - datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            to_iso = (now + datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

            self.use_token("admin")
            # Generic format: full ledger; should include the just-placed order with email + visitorId + clickIds columns.
            gen_resp = self.api.get(f"/checkout/orders/export?format=generic&from={from_iso}&to={to_iso}")
            assert_status(gen_resp, 200, "Generic orders export")
            assert "text/csv" in gen_resp.headers.get("Content-Type", ""), f"content-type: {gen_resp.headers.get('Content-Type')}"
            gen_body = gen_resp.text
            assert "Order ID,Created (UTC),Status,Customer Email" in gen_body, "Generic CSV header mismatch"
            assert order_id in gen_body, "Generic CSV missing the order ID"
            assert "v___test__attr_order" in gen_body, "Generic CSV missing visitorId"
            assert "ord_gclid_aaa" in gen_body, "Generic CSV missing gclid column value"
            ok("Generic orders CSV includes order with attribution columns")

            # Google format: Ads offline-conversions shape; only orders with gclid.
            g_resp = self.api.get(f"/checkout/orders/export?format=google&from={from_iso}&to={to_iso}")
            assert_status(g_resp, 200, "Google orders export")
            g_body = g_resp.text
            assert "Parameters:TimeZone=+0000" in g_body, "Google CSV missing Parameters preamble"
            assert "Google Click ID,Conversion Name,Conversion Time,Order ID,Conversion Value,Conversion Currency" in g_body, "Google CSV header mismatch"
            assert "ord_gclid_aaa" in g_body, "Google CSV missing the test gclid"
            ok("Google Ads CSV includes attributed order")

            # Bing format: bulk offline conversions; only orders with msclkid.
            b_resp = self.api.get(f"/checkout/orders/export?format=bing&from={from_iso}&to={to_iso}")
            assert_status(b_resp, 200, "Bing orders export")
            b_body = b_resp.text
            assert "Type,Status,Id,Parent Id,Client Id,Name,Conversion Currency Code,Conversion Name,Conversion Time,Conversion Value,Microsoft Click Id" in b_body, "Bing CSV header mismatch"
            assert "Format Version,,,,,6.0,,,,," in b_body, "Bing CSV missing Format Version row"
            assert "ord_msclkid_bbb" in b_body, "Bing CSV missing the test msclkid"
            assert "Offline Conversion" in b_body, "Bing CSV missing Type literal"
            ok("Microsoft Ads CSV includes attributed order")

            # Bad input: unsupported format
            bad = self.api.get(f"/checkout/orders/export?format=tiktok&from={from_iso}&to={to_iso}")
            assert_status(bad, 400, "Unsupported format rejected")
            ok("Unsupported format rejected with 400")

            # Cross-company isolation: company2 must NOT see company1's orders.
            # The order was placed for sellerId=c1_id; company2 logs in and queries: handler forces
            # sellerId=their accountID (c2_id), so they see only their own (none in this case).
            self.use_token("company2")
            c2_resp = self.api.get(f"/checkout/orders/export?format=generic&from={from_iso}&to={to_iso}")
            assert_status(c2_resp, 200, "Company2 generic export call")
            assert order_id not in c2_resp.text, "ISOLATION BREACH: company2 saw company1's order"
            ok("Cross-company isolation: company2 cannot see company1's orders")

            # Even when company2 tries to override sellerId to company1's id, the handler MUST
            # ignore it and scope to their own accountID. If this assertion fails, any company
            # could exfiltrate every other tenant's orders by guessing sellerIds.
            c2_attempt = self.api.get(f"/checkout/orders/export?format=generic&from={from_iso}&to={to_iso}&sellerId={c1_id}")
            assert order_id not in c2_attempt.text, "ISOLATION BREACH: sellerId query override worked for company role"
            ok("Cross-company isolation: sellerId override ignored for company role")

            # Cancel so this purchase_order doesn't accrue credit balance for downstream credit-limit test (6e).
            self.use_token("company1")
            self.api.put(f"/checkout/orders/{order_id}", {"status": "cancelled"})

            # After cancel: PPC formats must exclude (cancelled orders corrupt ROAS bidding signals);
            # generic format must still include (full ledger view for accounting).
            self.use_token("admin")
            g2 = self.api.get(f"/checkout/orders/export?format=google&from={from_iso}&to={to_iso}")
            assert "ord_gclid_aaa" not in g2.text, "Google CSV still includes cancelled order"
            ok("Cancelled order excluded from Google Ads CSV")
            gen2 = self.api.get(f"/checkout/orders/export?format=generic&from={from_iso}&to={to_iso}")
            assert order_id in gen2.text, "Generic CSV missing cancelled order (should include for accounting)"
            ok("Cancelled order still in Generic CSV (ledger view preserved)")

        self.run_test("5f. Order PPC attribution + conversions export", test_order_attribution)

        # 5g. Coupon promo: SAVE5/SAVE10 hardcoded codes, gated by company CouponsEnabled.
        # Verifies (1) discount applied when enabled, (2) no discount when disabled (gate works),
        # (3) unknown code returns no discount, (4) case-insensitive normalization.
        def test_coupon_promo():
            base_extra = {
                "creditLimit": 5000, "minOrderAmountLimit": 20, "maxOrderAmountLimit": 5000,
            }

            # 5g-1. SAVE10 with coupons enabled → 10% off subtotal
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                **base_extra, "promoCode": "SAVE10", "couponsEnabled": True,
            })
            assert_status(resp, 200, "Quote with SAVE10 + couponsEnabled=true")
            q = resp.json()
            subtotal = q.get("subtotal", 0)
            promo_discount = q.get("promoDiscount", 0)
            expected = subtotal * 0.10
            assert abs(promo_discount - expected) < 0.01, f"SAVE10 discount: expected {expected:.2f}, got {promo_discount:.2f}"
            assert q.get("promoCode") == "SAVE10", f"promoCode persisted: got {q.get('promoCode')}"
            assert abs(q.get("grandTotal", 0) - (subtotal + q.get("shippingCost", 0) + q.get("taxAmount", 0) - promo_discount)) < 0.01, "grandTotal must reflect discount"
            ok(f"SAVE10 enabled: subtotal=${subtotal:.2f}, discount=${promo_discount:.2f}")

            # 5g-2. SAVE10 with coupons DISABLED → no discount (gate works)
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                **base_extra, "promoCode": "SAVE10", "couponsEnabled": False,
            })
            assert_status(resp, 200, "Quote with SAVE10 + couponsEnabled=false")
            q = resp.json()
            assert q.get("promoDiscount", 0) == 0, f"BREACH: discount applied when couponsEnabled=false: {q.get('promoDiscount')}"
            ok("SAVE10 with coupons disabled: gate enforced, no discount")

            # 5g-3. Unknown code with coupons enabled → no discount
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                **base_extra, "promoCode": "FAKEXX", "couponsEnabled": True,
            })
            assert_status(resp, 200, "Quote with unknown code")
            q = resp.json()
            assert q.get("promoDiscount", 0) == 0, f"Unknown code gave discount: {q.get('promoDiscount')}"
            ok("Unknown code: no discount applied")

            # 5g-4. Lowercase 'save5' should normalize to SAVE5 → 5% off
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                **base_extra, "promoCode": "save5", "couponsEnabled": True,
            })
            assert_status(resp, 200, "Quote with lowercase save5")
            q = resp.json()
            subtotal = q.get("subtotal", 0)
            promo_discount = q.get("promoDiscount", 0)
            expected = subtotal * 0.05
            assert abs(promo_discount - expected) < 0.01, f"save5 discount: expected {expected:.2f}, got {promo_discount:.2f}"
            ok(f"Lowercase 'save5' normalized: discount=${promo_discount:.2f}")

        self.run_test("5g. Coupon promo (SAVE5/SAVE10, gating, case-insensitive)", test_coupon_promo)

        # 5h. Coupon end-to-end through email: place a real order with SAVE10,
        # then read Mailpit and assert the discount line + code rendered in the
        # customer confirmation AND the merchant new-order email. Pins the
        # money-field-through-every-read-path rule (templates render what was
        # denormalized onto the Order).
        def test_coupon_email_render():
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            quote_resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                "creditLimit": 5000, "minOrderAmountLimit": 20, "maxOrderAmountLimit": 5000,
                "promoCode": "SAVE10", "couponsEnabled": True,
            })
            assert_status(quote_resp, 200, "Quote with SAVE10 for email test")
            q = quote_resp.json()
            quote_id = q.get("id")
            promo_discount = q.get("promoDiscount", 0)
            assert promo_discount > 0, f"Quote must have a discount before placing order: {promo_discount}"

            self.use_token("customer")
            order_resp = self.api.post("/checkout/orders", {
                "quoteId": quote_id,
                "paymentMethod": "purchase_order",
                "deliveryMethod": "pickup",
            })
            assert_status(order_resp, 200, "Place coupon order")
            o = order_resp.json()
            order_id = o.get("id") or o.get("_id")
            assert order_id, "order_id missing"
            self.tracker.track_order(order_id)

            # Order must carry promoCode + promoDiscount (denormalization)
            assert o.get("promoCode") == "SAVE10", f"order.promoCode: {o.get('promoCode')}"
            assert abs(o.get("promoDiscount", 0) - promo_discount) < 0.01, f"order.promoDiscount: {o.get('promoDiscount')}"
            ok(f"Order persisted promoCode=SAVE10, promoDiscount=${o.get('promoDiscount', 0):.2f}")

            # Mailpit: poll for the customer order confirmation. Merchant
            # new-order email needs an SSM EMAIL_COMPANY_CONFIGS entry which
            # only exists in prod, so locally only the customer email fires.
            # Merchant render path is pinned by templates_test.go.
            short_id = order_id[-6:]
            mailpit_url = "http://localhost:8025/api/v1/messages"
            customer_msg = None
            for _ in range(15):
                try:
                    r = requests.get(mailpit_url, params={"limit": 50}, timeout=2)
                    if r.status_code == 200:
                        for m in (r.json().get("messages", []) or []):
                            if m.get("Subject") == f"Order confirmation #{short_id}":
                                customer_msg = m
                                break
                        if customer_msg:
                            break
                except Exception:
                    pass
                time.sleep(0.5)

            assert customer_msg, f"Customer order confirmation #{short_id} not found in Mailpit"

            body_resp = requests.get(f"http://localhost:8025/api/v1/message/{customer_msg['ID']}", timeout=3)
            assert body_resp.status_code == 200, f"Mailpit fetch body: {body_resp.status_code}"
            body = body_resp.json()
            text = body.get("Text") or ""
            html = body.get("HTML") or ""

            assert f"Discount (SAVE10): -${promo_discount:.2f}" in text, \
                f"text body missing 'Discount (SAVE10): -${promo_discount:.2f}'\n--- text ---\n{text}\n"
            assert "Discount (SAVE10)" in html and f"-${promo_discount:.2f}" in html, \
                f"HTML body missing discount row\n--- html snippet ---\n{html[:1500]}\n"
            ok(f"Customer email renders Discount (SAVE10) -${promo_discount:.2f} in text + HTML")

            # Cancel so this order's grandTotal doesn't count against the
            # customer's outstanding balance for the credit-limit test (6e).
            self.use_token("admin")
            self.api.put(f"/checkout/orders/{order_id}", {"status": "cancelled"})

        self.run_test("5h. Coupon end-to-end: order email shows discount line", test_coupon_email_render)

        # 5i. Refund flow: partial then full, with input-validation guards.
        # Covers the append-only refunds[] pattern, auto status-transition to
        # "refunded" on full coverage, and the two PUT validation contracts
        # (status=refunded direct, refundAmount without stripeRefundID).
        def test_refund_flow():
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 2)
            quote_resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                "creditLimit": 5000, "minOrderAmountLimit": 1, "maxOrderAmountLimit": 5000,
            })
            assert_status(quote_resp, 200, "Quote for refund flow")
            quote_id = quote_resp.json().get("id")

            self.use_token("customer")
            order_resp = self.api.post("/checkout/orders", {
                "quoteId": quote_id,
                "paymentMethod": "purchase_order",
                "deliveryMethod": "pickup",
            })
            assert_status(order_resp, 200, "Place order for refund flow")
            o = order_resp.json()
            order_id = o.get("id") or o.get("_id")
            assert order_id, "order_id missing"
            self.tracker.track_order(order_id)
            grand_total = o.get("grandTotal", 0)
            assert grand_total > 1, f"grandTotal must be > 1 for split-refund: {grand_total}"
            ok(f"Refund-flow order placed: id={order_id} grandTotal=${grand_total:.2f}")

            self.use_token("admin")

            # Validation A: status=refunded without refundAmount must be rejected.
            bad_a = self.api.put(f"/checkout/orders/{order_id}", {"status": "refunded"})
            assert_status(bad_a, 400, "Direct status=refunded rejected")
            assert "refundAmount" in (bad_a.json().get("message") or ""), \
                f"Expected error to mention refundAmount: {bad_a.text}"
            ok("Validation: status=refunded without refundAmount rejected with 400")

            # Validation B: refundAmount > 0 without stripeRefundID must be rejected.
            bad_b = self.api.put(f"/checkout/orders/{order_id}", {"refundAmount": 1.00})
            assert_status(bad_b, 400, "refundAmount without stripeRefundID rejected")
            assert "stripeRefundID" in (bad_b.json().get("message") or ""), \
                f"Expected error to mention stripeRefundID: {bad_b.text}"
            ok("Validation: refundAmount without stripeRefundID rejected with 400")

            # Partial refund: half of grandTotal. Status must NOT transition.
            first_amount = round(grand_total / 2, 2)
            r1 = self.api.put(f"/checkout/orders/{order_id}", {
                "stripeRefundID": "re_test_first_xyz123",
                "refundAmount": first_amount,
                "refundReason": "partial qty adjustment",
            })
            assert_status(r1, 200, "Partial refund accepted")
            o1 = r1.json()
            refunds1 = o1.get("refunds") or []
            assert len(refunds1) == 1, f"Expected 1 refund after partial, got {len(refunds1)}: {refunds1}"
            assert abs(refunds1[0].get("amount", 0) - first_amount) < 0.01, \
                f"Refund amount mismatch: {refunds1[0].get('amount')} vs {first_amount}"
            assert o1.get("status") != "refunded", \
                f"Partial refund must not auto-transition status to refunded: {o1.get('status')}"
            ok(f"Partial refund stored: ${first_amount:.2f}, status remained '{o1.get('status')}'")

            # Cap check: try to refund more than remaining. Must fail with 400.
            remaining = grand_total - first_amount
            over = round(remaining + 5.00, 2)
            bad_c = self.api.put(f"/checkout/orders/{order_id}", {
                "stripeRefundID": "re_test_over_xyz",
                "refundAmount": over,
            })
            assert_status(bad_c, 400, "Over-cap refund rejected")
            ok(f"Cap enforcement: ${over:.2f} > remaining ${remaining:.2f} rejected with 400")

            # Final refund to clear the balance: status must auto-transition to refunded.
            r2 = self.api.put(f"/checkout/orders/{order_id}", {
                "stripeRefundID": "re_test_final_abc456",
                "refundAmount": round(remaining, 2),
                "refundReason": "balance refunded",
            })
            assert_status(r2, 200, "Final refund accepted")
            o2 = r2.json()
            refunds2 = o2.get("refunds") or []
            assert len(refunds2) == 2, f"Expected 2 refunds after final, got {len(refunds2)}"
            assert o2.get("status") == "refunded", \
                f"Full refund must auto-transition status to 'refunded', got '{o2.get('status')}'"
            ok("Full coverage auto-transitions status to 'refunded' and appends second refund record")

            # Cancel so this order doesn't pollute credit-limit accounting downstream.
            self.api.put(f"/checkout/orders/{order_id}", {"status": "cancelled"})

        self.run_test("5i. Refund flow: partial + full + validation guards", test_refund_flow)

    # ── Phase 5b: Tiered pricing tests ─────────────────────────────

    def phase5b_tiered_pricing(self):
        phase("PHASE 5b: Tiered Pricing")

        c1_id = self.ids["company1"]

        # Create a product with tiers
        def test_create_tiered_product():
            self.use_token("company1")
            resp = self.api.post("/products", {
                "name": f"{PREFIX} Tiered Product",
                "slug": "test-tiered-product",
                "price": 20.00,
                "description": "Product with volume pricing",
                "priceTiers": [
                    {"minQty": 5, "price": 16.00},
                    {"minQty": 20, "price": 12.00},
                ],
            })
            assert_status_in(resp, [200, 201], "Create tiered product")
            ok("Tiered product created: base=$20, 5+=$16, 20+=$12")

            # Re-fetch to get real ID
            resp = self.api.get("/products")
            assert_status(resp, 200, "Fetch products")
            tiered = [p for p in resp.json() if p.get("name") == f"{PREFIX} Tiered Product"]
            if not tiered:
                raise AssertionError("Tiered product not found after creation")
            self._tiered_product_id = tiered[0]["_id"]
            self.tracker.track_product("company1", self._tiered_product_id)

            # Verify tiers are stored
            tiers = tiered[0].get("priceTiers", [])
            if len(tiers) != 2:
                raise AssertionError(f"Expected 2 tiers, got {len(tiers)}")
            ok(f"Product has {len(tiers)} tiers stored correctly")

        self.run_test("Create product with price tiers", test_create_tiered_product)

        # Validate tier validation rejects bad input
        def test_tier_validation():
            self.use_token("company1")
            # First tier minQty=1 should fail
            resp = self.api.post("/products", {
                "name": f"{PREFIX} Bad Tier",
                "slug": "test-bad-tier",
                "price": 10.00,
                "description": "Should fail",
                "priceTiers": [{"minQty": 1, "price": 8.00}],
            })
            assert_status(resp, 400, "Tier with minQty=1 rejected")
            ok("Validation: first tier minQty=1 rejected")

            # Unsorted tiers should fail
            resp = self.api.post("/products", {
                "name": f"{PREFIX} Bad Tier 2",
                "slug": "test-bad-tier-2",
                "price": 10.00,
                "description": "Should fail",
                "priceTiers": [{"minQty": 10, "price": 8.00}, {"minQty": 5, "price": 6.00}],
            })
            assert_status(resp, 400, "Unsorted tiers rejected")
            ok("Validation: unsorted tiers rejected")

        self.run_test("Tier validation rules", test_tier_validation)

        # Test cart with tiered product — qty below tier
        def test_cart_base_price():
            self.re_login("customer")
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, self._tiered_product_id, 2)

            self.use_token("customer")
            resp = self.api.get(f"/checkout/cart", params={"sellerId": c1_id})
            assert_status(resp, 200, "Get cart")
            cart = resp.json()
            item = cart["items"][0]
            # qty=2 < first tier minQty=5 → base price $20
            if abs(item.get("price", 0) - 20.0) > 0.01:
                raise AssertionError(f"Expected base price $20.00, got ${item.get('price')}")
            ok(f"Cart qty=2: price=${item['price']} (base price)")

        self.run_test("Cart at base price (qty below tier)", test_cart_base_price)

        # Test cart with tiered product — update qty into tier
        def test_cart_tier_price():
            self.use_token("customer")
            cart_resp = self.api.get(f"/checkout/cart", params={"sellerId": c1_id})
            cart = cart_resp.json()
            item_id = cart["items"][0]["id"]

            # Update to qty=5 → should hit first tier at $16
            resp = self.api.put(f"/checkout/cart/{item_id}",
                json_data={"entity": {"quantity": 5, "price": 16.00, "discountedPrice": 16.00}},
                params={"sellerId": c1_id})
            assert_status(resp, 200, "Update qty to 5")
            updated = resp.json()
            item = updated["items"][0]
            if abs(item.get("price", 0) - 16.0) > 0.01:
                raise AssertionError(f"Expected tier price $16.00, got ${item.get('price')}")
            expected_total = 16.0 * 5
            if abs(item.get("lineItemTotal", 0) - expected_total) > 0.01:
                raise AssertionError(f"Expected lineItemTotal ${expected_total}, got ${item.get('lineItemTotal')}")
            ok(f"Cart qty=5: price=${item['price']}, lineItemTotal=${item['lineItemTotal']} (tier 1)")

        self.run_test("Cart tier price on qty update", test_cart_tier_price)

        # Test quote with tiered pricing
        def test_quote_with_tiers():
            resp = self._create_quote("customer", c1_id, "standard", extra_fields={
                "taxableGoods": True,
            })
            assert_status(resp, 200, "Quote with tiered product")
            quote = resp.json()
            # subtotal should be 5 * $16 = $80
            if abs(quote.get("subtotal", 0) - 80.0) > 0.01:
                raise AssertionError(f"Expected subtotal $80.00, got ${quote.get('subtotal')}")
            ok(f"Quote subtotal=${quote['subtotal']} (5 × $16 tier price)")

        self.run_test("Quote reflects tier pricing", test_quote_with_tiers)

        # B2C tier test — storefront customer buys tiered product
        def test_b2c_tier_pricing():
            self.re_login("b2c")
            self._clear_cart("b2c", c1_id)

            # B2C adds tiered product at qty=5 with tier price (simulating D2C cart.js resolution)
            self.use_token("b2c")
            resp = self.api.post("/checkout/cart", {"entity": {
                "productId": self._tiered_product_id,
                "sellerId": c1_id,
                "quantity": 5,
                "name": f"{PREFIX} Tiered Product",
                "price": 16.00,          # tier price, resolved client-side by cart.js
                "discountedPrice": 16.00,
            }})
            assert_status(resp, 200, "B2C add tiered item to cart")

            # Create quote — verify subtotal = 5 × $16 = $80
            resp = self.api.post("/checkout/quotes", {
                "sellerId": c1_id,
                "paymentMethods": ["credit_card"],
                "deliveryMethods": ["shipping_out"],
                "shippingOutOptions": ["standard"],
                "quotesAllowed": False,
                "companyLocations": [],
                "customerAddresses": [],
                "quoteType": "standard",
            })
            assert_status(resp, 200, "B2C quote with tiered product")
            quote = resp.json()
            if abs(quote.get("subtotal", 0) - 80.0) > 0.01:
                raise AssertionError(f"B2C subtotal: expected $80.00, got ${quote.get('subtotal')}")
            assert_gt(quote.get("taxAmount", 0), 0, "B2C tax should be > 0")
            ok(f"B2C quote: subtotal=${quote['subtotal']}, tax=${quote['taxAmount']}, total=${quote['grandTotal']}")

        self.run_test("B2C storefront tier pricing", test_b2c_tier_pricing)

    # ── Phase 6: Enforcement tests ───────────────────────────────

    # Base config that clears all limits (0 = no limit) so tests don't cascade
    _RESET_CONFIG = {
        "creditLimit": 0,
        "minOrderAmountLimit": 0,
        "maxOrderAmountLimit": 0,
        "minOrderQuantityLimit": 0,
        "maxOrderQuantityLimit": 0,
        "monthlyOrderLimit": 0,
        "yearlyOrderLimit": 0,
        "taxableGoods": True,
        "quotesAllowed": True,
    }

    def _set_customer_config(self, overrides):
        """Reset all limits, apply overrides, then re-login customer."""
        self.use_token("company1")
        cust_id = self.ids["customer"]
        config = {**self._RESET_CONFIG, **overrides}
        resp = self.api.patch(f"/customers/{cust_id}/configuration", config)
        assert_status(resp, 200, "Set customer config")
        self.re_login("customer")

    def _enforcement_cart_and_quote(self, seller_id, product_id, qty,
                                     quote_type="standard", extra_fields=None):
        """Clear cart, add item, attempt quote. Returns response."""
        self._clear_cart("customer", seller_id)
        self._add_to_cart("customer", seller_id, product_id, qty)
        return self._create_quote("customer", seller_id, quote_type, extra_fields=extra_fields)

    # ── Phase 5c: Customer Groups (visibility + group price discount) ─

    def phase5c_groups(self):
        phase("PHASE 5c: Customer Groups (B2B)")

        c1_id = self.ids["company1"]
        cust_id = self.ids["customer"]
        cust2_id = self.ids["customer2"]
        b2c_id = self.ids["b2c"]
        product_a = self.product_ids["company1"][0]
        product_b = self.product_ids["company1"][1]

        # Stable test group IDs (UUID format expected by frontend, but backend just stores strings)
        group_wholesale = "test-grp-wholesale"
        group_vip = "test-grp-vip"

        # 5c-1. Company creates 2 customer groups
        def test_create_groups():
            self.use_token("company1")
            resp = self.api.patch(f"/accounts/{c1_id}", {
                "company": {
                    "customerGroups": [
                        {"id": group_wholesale, "name": "Wholesale", "groupPriceDiscount": 25},
                        {"id": group_vip, "name": "VIP", "groupPriceDiscount": 35},
                    ]
                }
            })
            assert_status(resp, 200, "Create 2 customer groups")
            ok("Created 2 groups: Wholesale (25%), VIP (35%)")

        self.run_test("5c-1. Create customer groups", test_create_groups)

        # 5c-2. Validation: max 5 groups
        def test_max_5_groups():
            self.use_token("company1")
            too_many = [{"id": f"g{i}", "name": f"G{i}", "groupPriceDiscount": 5} for i in range(6)]
            resp = self.api.patch(f"/accounts/{c1_id}", {
                "company": {"customerGroups": too_many}
            })
            assert_status(resp, 400, "Max 5 groups enforced")
            ok("Validation: 6 groups rejected (max 5)")
            # Restore the original 2 groups
            self.api.patch(f"/accounts/{c1_id}", {
                "company": {"customerGroups": [
                    {"id": group_wholesale, "name": "Wholesale", "groupPriceDiscount": 25},
                    {"id": group_vip, "name": "VIP", "groupPriceDiscount": 35},
                ]}
            })

        self.run_test("5c-2. Max 5 groups validation", test_max_5_groups)

        # 5c-3. Validation: missing name
        def test_missing_name():
            self.use_token("company1")
            resp = self.api.patch(f"/accounts/{c1_id}", {
                "company": {"customerGroups": [{"id": "g-bad", "name": "", "groupPriceDiscount": 10}]}
            })
            assert_status(resp, 400, "Missing group name rejected")
            ok("Validation: empty name rejected")
            # Restore
            self.api.patch(f"/accounts/{c1_id}", {
                "company": {"customerGroups": [
                    {"id": group_wholesale, "name": "Wholesale", "groupPriceDiscount": 25},
                    {"id": group_vip, "name": "VIP", "groupPriceDiscount": 35},
                ]}
            })

        self.run_test("5c-3. Group name required", test_missing_name)

        # 5c-4. Validation: discount out of range
        def test_discount_out_of_range():
            self.use_token("company1")
            resp = self.api.patch(f"/accounts/{c1_id}", {
                "company": {"customerGroups": [{"id": "g-bad", "name": "Bad", "groupPriceDiscount": 150}]}
            })
            assert_status(resp, 400, "Discount > 100 rejected")
            ok("Validation: groupPriceDiscount > 100 rejected")
            # Restore
            self.api.patch(f"/accounts/{c1_id}", {
                "company": {"customerGroups": [
                    {"id": group_wholesale, "name": "Wholesale", "groupPriceDiscount": 25},
                    {"id": group_vip, "name": "VIP", "groupPriceDiscount": 35},
                ]}
            })

        self.run_test("5c-4. Discount range 0-100 validation", test_discount_out_of_range)

        # 5c-5. Assign customer to a group, re-login, verify JWT carries group fields
        def test_assign_customer_to_group():
            self.use_token("company1")
            # Reset configuration AND set group
            resp = self.api.patch(f"/customers/{cust_id}/configuration", {
                "creditLimit": 0,
                "minOrderAmountLimit": 0,
                "maxOrderAmountLimit": 0,
                "groupID": group_wholesale,
            })
            assert_status(resp, 200, "Assign customer to wholesale group")

            # Re-login customer to get fresh JWT
            self.re_login("customer")
            configs = self._get_configs_from_jwt(self.jwts["customer"])
            config = next((c for c in configs if c.get("company_id") == c1_id), None)
            if not config:
                raise AssertionError("No JWT config found for company1")
            if config.get("groupID") != group_wholesale:
                raise AssertionError(f"JWT groupID: expected {group_wholesale}, got {config.get('groupID')}")
            if config.get("groupPriceDiscount") != 25:
                raise AssertionError(f"JWT groupPriceDiscount: expected 25, got {config.get('groupPriceDiscount')}")
            ok(f"Customer JWT carries groupID={group_wholesale}, groupPriceDiscount=25")

        self.run_test("5c-5. Assign customer to group, JWT resolves", test_assign_customer_to_group)

        # 5c-6. Reject invalid groupID assignment
        def test_invalid_group_assignment():
            self.use_token("company1")
            resp = self.api.patch(f"/customers/{cust_id}/configuration", {
                "groupID": "non-existent-group",
            })
            assert_status(resp, 400, "Invalid groupID rejected")
            ok("Validation: invalid groupID rejected")
            # Restore wholesale assignment
            self.api.patch(f"/customers/{cust_id}/configuration", {"groupID": group_wholesale})
            self.re_login("customer")

        self.run_test("5c-6. Invalid groupID rejected", test_invalid_group_assignment)

        # 5c-7. Tag product_a with wholesale visibility
        def test_tag_product_visibility():
            self.use_token("company1")
            resp = self.api.put(f"/products/{product_a}", {
                "groupIDs": [group_wholesale],
            })
            assert_status_in(resp, [200, 204], "Tag product with wholesale group")
            ok(f"Product A tagged: visible to wholesale only")

        self.run_test("5c-7. Tag product with group", test_tag_product_visibility)

        # 5c-8. Visibility: customer in wholesale SEES tagged product
        def test_visibility_in_group():
            self.use_token("customer")
            resp = self.api.get("/products")
            assert_status(resp, 200, "Get products as wholesale customer")
            products = resp.json() or []
            tagged = next((p for p in products if p["_id"] == product_a), None)
            if not tagged:
                raise AssertionError("Wholesale customer should see tagged product")
            ok("Wholesale customer sees the tagged product")

        self.run_test("5c-8. Visibility: in-group sees tagged", test_visibility_in_group)

        # 5c-9. Visibility: customer2 (no group at company1) does NOT see tagged product
        def test_visibility_no_group():
            # customer2 has no groupID at company1 — re-login to make sure JWT is fresh
            self.re_login("customer2")
            self.use_token("customer2")
            resp = self.api.get("/products")
            assert_status(resp, 200, "Get products as customer2")
            products = resp.json() or []
            tagged = next((p for p in products if p["_id"] == product_a), None)
            if tagged:
                raise AssertionError("Customer with no group should NOT see tagged product")
            ok("Customer2 (no group) does NOT see tagged product")

        self.run_test("5c-9. Visibility: no-group hidden", test_visibility_no_group)

        # 5c-10. Visibility: B2C SEES tagged product (bypass)
        def test_visibility_b2c():
            self.re_login("b2c")
            self.use_token("b2c")
            resp = self.api.get("/products")
            assert_status(resp, 200, "Get products as B2C")
            products = resp.json() or []
            tagged = next((p for p in products if p["_id"] == product_a), None)
            if not tagged:
                raise AssertionError("B2C should see tagged product (group filter bypass)")
            ok("B2C sees the tagged product (bypass works)")

        self.run_test("5c-10. Visibility: B2C bypasses group filter", test_visibility_b2c)

        # 5c-11. Pricing: wholesale customer gets 25% off
        def test_group_pricing():
            self.use_token("customer")
            resp = self.api.get("/products")
            assert_status(resp, 200, "Get products as wholesale customer")
            products = resp.json() or []
            tagged = next((p for p in products if p["_id"] == product_a), None)
            if not tagged:
                raise AssertionError("Tagged product missing")
            base_price = tagged.get("price", 0)
            discounted = tagged.get("discountedPrice", 0)
            expected = base_price * 0.75
            if abs(discounted - expected) > 0.01:
                raise AssertionError(f"Expected discountedPrice={expected:.2f} (25% off {base_price}), got {discounted:.2f}")
            ok(f"Wholesale pricing: base ${base_price:.2f} → discounted ${discounted:.2f} (25% off)")

        self.run_test("5c-11. Group pricing applied", test_group_pricing)

        # 5c-12. Legacy discountPercentage override beats group discount
        def test_legacy_override_wins():
            self.use_token("company1")
            self.api.patch(f"/customers/{cust_id}/configuration", {
                "discountPercentage": 50,
                "groupID": group_wholesale,
            })
            self.re_login("customer")
            self.use_token("customer")
            resp = self.api.get("/products")
            products = resp.json() or []
            tagged = next((p for p in products if p["_id"] == product_a), None)
            base = tagged.get("price", 0)
            discounted = tagged.get("discountedPrice", 0)
            expected = base * 0.5
            if abs(discounted - expected) > 0.01:
                raise AssertionError(f"Legacy override expected {expected:.2f}, got {discounted:.2f}")
            ok(f"Legacy override (50%) wins over group discount (25%): ${discounted:.2f}")
            # Cleanup: remove legacy override
            self.api.patch(f"/customers/{cust_id}/configuration", {
                "discountPercentage": 0,
                "groupID": group_wholesale,
            })

        self.run_test("5c-12. Legacy override > group discount", test_legacy_override_wins)

        # 5c-13. Untag product (clear groupIDs) — visible to all again
        def test_untag_product():
            self.use_token("company1")
            resp = self.api.put(f"/products/{product_a}", {"groupIDs": []})
            assert_status_in(resp, [200, 204], "Untag product")

            # Customer2 (no group) should now see it
            self.re_login("customer2")
            self.use_token("customer2")
            resp = self.api.get("/products")
            products = resp.json() or []
            untagged = next((p for p in products if p["_id"] == product_a), None)
            if not untagged:
                raise AssertionError("Untagged product should be visible to customer2")
            ok("Untagged product visible to all again (storage rule: empty array unset)")

        self.run_test("5c-13. Untag clears visibility restriction", test_untag_product)

    def phase5d_order_updates(self):
        """Test PUT /checkout/orders/{orderId} — status + tracking updates with role auth."""
        phase("PHASE 5d: Order Updates (status + tracking)")

        c1_id = self.ids["company1"]
        product_a = self.product_ids["company1"][0]

        # Reset customer config (5c left a group restriction); re-login refreshes JWT.
        self.use_token("company1")
        self.api.patch(f"/customers/{self.ids['customer']}/configuration", {
            "creditLimit": 0, "minOrderAmountLimit": 0, "maxOrderAmountLimit": 0, "groupID": "",
        })
        self.re_login("customer")

        self._clear_cart("customer", c1_id)
        self._add_to_cart("customer", c1_id, product_a, 2)
        quote_resp = self._create_quote("customer", c1_id, "standard")
        assert_status(quote_resp, 200, "Quote for order-update test")
        quote_id = quote_resp.json().get("id")

        self.use_token("customer")
        order_resp = self.api.post("/checkout/orders", {
            "quoteId": quote_id, "paymentMethod": "purchase_order", "deliveryMethod": "pickup",
        })
        assert_status(order_resp, 200, "Place order for update test")
        order_id = order_resp.json().get("id")
        self.tracker.track_order(order_id)
        ok(f"Order placed for update test: {order_id[:8]}...")

        # 5d-1. Customer cannot PUT — forbidden
        def test_customer_forbidden():
            self.use_token("customer")
            resp = self.api.put(f"/checkout/orders/{order_id}", {"status": "shipped"})
            assert_status(resp, 403, "Customer PUT order")
            ok("Customer blocked from updating order (403)")
        self.run_test("5d-1. Customer cannot update order", test_customer_forbidden)

        # 5d-2. Company2 cannot PUT company1's order — forbidden
        def test_other_company_forbidden():
            self.use_token("company2")
            resp = self.api.put(f"/checkout/orders/{order_id}", {"status": "shipped"})
            assert_status(resp, 403, "Other company PUT order")
            ok("Other company blocked from updating someone else's order (403)")
        self.run_test("5d-2. Other company cannot update foreign order", test_other_company_forbidden)

        # 5d-3. Invalid status rejected
        def test_invalid_status():
            self.use_token("company1")
            resp = self.api.put(f"/checkout/orders/{order_id}", {"status": "warp_speed"})
            assert_status(resp, 400, "Invalid status")
            ok("Invalid status rejected (400)")
        self.run_test("5d-3. Invalid status rejected", test_invalid_status)

        # 5d-4. Invalid carrier rejected
        def test_invalid_carrier():
            self.use_token("company1")
            resp = self.api.put(f"/checkout/orders/{order_id}", {"trackingCarrier": "pigeon"})
            assert_status(resp, 400, "Invalid carrier")
            ok("Invalid carrier rejected (400)")
        self.run_test("5d-4. Invalid carrier rejected", test_invalid_carrier)

        # 5d-5. Owning company can update status + tracking, URL is auto-derived
        def test_company_update_success():
            self.use_token("company1")
            resp = self.api.put(f"/checkout/orders/{order_id}", {
                "status": "shipped", "trackingCarrier": "ups", "trackingNumber": "1Z999AA10123456784",
            })
            assert_status(resp, 200, "Owning company PUT order")
            data = resp.json() or {}
            if data.get("status") != "shipped":
                raise AssertionError(f"status should be 'shipped', got {data.get('status')}")
            if data.get("trackingCarrier") != "ups":
                raise AssertionError(f"trackingCarrier should be 'ups', got {data.get('trackingCarrier')}")
            if not (data.get("trackingUrl") or "").startswith("https://www.ups.com/track"):
                raise AssertionError(f"trackingUrl should be auto-derived UPS URL, got {data.get('trackingUrl')}")
            if not data.get("shippedAt"):
                raise AssertionError("shippedAt should be set when status flips to shipped")
            ok("Order updated by owning company: status=shipped, UPS tracking, URL auto-derived")
        self.run_test("5d-5. Owning company updates status + tracking", test_company_update_success)

        # 5d-6. Admin can update any order
        def test_admin_update():
            self.use_token("admin")
            resp = self.api.put(f"/checkout/orders/{order_id}", {"status": "delivered"})
            assert_status(resp, 200, "Admin PUT order")
            data = resp.json() or {}
            if data.get("status") != "delivered":
                raise AssertionError(f"status should be 'delivered', got {data.get('status')}")
            if not data.get("deliveredAt"):
                raise AssertionError("deliveredAt should be set when status flips to delivered")
            ok("Admin updated to delivered; deliveredAt set")
        self.run_test("5d-6. Admin updates any order", test_admin_update)

        # Park the test order as cancelled so it doesn't count toward customer's
        # unpaid balance in phase 6e credit-limit test (GetUnpaidOrdersTotal excludes cancelled).
        self.use_token("admin")
        self.api.put(f"/checkout/orders/{order_id}", {"status": "cancelled"})

    def phase6_enforcement(self):
        phase("PHASE 6: Enforcement Tests")

        c1_id = self.ids["company1"]
        product_a = self.product_ids["company1"][0]  # ~$10.99

        # 6a. Min order amount
        def test_min_order_amount():
            self._set_customer_config({"minOrderAmountLimit": 100})
            resp = self._enforcement_cart_and_quote(c1_id, product_a, 1)
            assert_status(resp, 400, "Min order amount enforcement")
            assert_contains(resp.text, "below the minimum", "Min order amount message")
            ok("Blocked: order below minimum amount")

        self.run_test("6a. Min order amount enforcement", test_min_order_amount)

        # 6b. Max order amount — product_a ~$10.99, qty 3 = ~$32.97 + tax + ship ≈ $45
        def test_max_order_amount():
            self._set_customer_config({"maxOrderAmountLimit": 30})
            resp = self._enforcement_cart_and_quote(c1_id, product_a, 3)
            assert_status(resp, 400, "Max order amount enforcement")
            assert_contains(resp.text, "exceeds the maximum", "Max order amount message")
            ok("Blocked: order exceeds maximum amount")

        self.run_test("6b. Max order amount enforcement", test_max_order_amount)

        # 6c. Min order quantity
        def test_min_order_qty():
            self._set_customer_config({"maxOrderAmountLimit": 0, "minOrderQuantityLimit": 5})
            resp = self._enforcement_cart_and_quote(c1_id, product_a, 1)
            assert_status(resp, 400, "Min order qty enforcement")
            assert_contains(resp.text, "below the minimum", "Min order qty message")
            ok("Blocked: quantity below minimum")

        self.run_test("6c. Min order quantity enforcement", test_min_order_qty)

        # 6d. Max order quantity
        def test_max_order_qty():
            self._set_customer_config({"maxOrderQuantityLimit": 2})
            resp = self._enforcement_cart_and_quote(c1_id, product_a, 10)
            assert_status(resp, 400, "Max order qty enforcement")
            assert_contains(resp.text, "exceeds the maximum", "Max order qty message")
            ok("Blocked: quantity exceeds maximum")

        self.run_test("6d. Max order quantity enforcement", test_max_order_qty)

        # 6e. Credit limit — product_a ~$10.99, qty 3 ≈ $45 total
        def test_credit_limit():
            self._set_customer_config({"creditLimit": 60})

            # First order should succeed (~$45 < $60)
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "standard")
            assert_status(resp, 200, "First quote for credit test")
            quote_data = resp.json()
            quote_id = quote_data.get("id")

            # Place the order to create outstanding balance
            self.use_token("customer")
            order_resp = self.api.post("/checkout/orders", {
                "quoteId": quote_id,
                "paymentMethod": "purchase_order",
                "paymentToken": "",
                "deliveryMethod": "pickup",
            })
            assert_status(order_resp, 200, "Place first order")
            order_id = order_resp.json().get("id")
            if order_id:
                self.tracker.track_order(order_id)
            ok(f"First order placed: ${quote_data.get('grandTotal', 0):.2f}")

            # Second order should be blocked by credit limit
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 2)
            resp = self._create_quote("customer", c1_id, "standard")
            assert_status(resp, 403, "Credit limit enforcement")
            assert_contains(resp.text, "credit limit", "Credit limit message")
            ok("Blocked: credit limit exceeded")

        self.run_test("6e. Credit limit enforcement", test_credit_limit)

        # 6f. Monthly order limit — already placed 1 order in credit test
        def test_monthly_limit():
            self._set_customer_config({"monthlyOrderLimit": 1})
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "standard")
            assert_status(resp, 403, "Monthly limit enforcement")
            assert_contains(resp.text, "monthly", "Monthly limit message")
            ok("Blocked: monthly order limit reached")

        self.run_test("6f. Monthly order limit enforcement", test_monthly_limit)

        # 6g. TaxableGoods = false
        def test_taxable_goods_false():
            self._set_customer_config({"taxableGoods": False})
            resp = self._enforcement_cart_and_quote(c1_id, product_a, 3)
            assert_status(resp, 200, "Quote with taxableGoods=false")
            data = resp.json()
            if data.get("taxAmount", -1) != 0:
                raise AssertionError(f"Expected taxAmount=0, got {data.get('taxAmount')}")
            ok(f"TaxableGoods=false: taxAmount=0, grandTotal=${data.get('grandTotal', 0):.2f}")

        self.run_test("6g. TaxableGoods=false → tax=0", test_taxable_goods_false)

        # 6h. QuotesAllowed = false
        def test_quotes_allowed_false():
            self._set_customer_config({"quotesAllowed": False})
            # Negotiable should be blocked
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 3)
            resp = self._create_quote("customer", c1_id, "negotiable")
            assert_status(resp, 403, "QuotesAllowed=false negotiable")
            assert_contains(resp.text, "not allow", "QuotesAllowed message")
            ok("Blocked: negotiable quote when quotesAllowed=false")

            # Standard should still work
            resp = self._create_quote("customer", c1_id, "standard")
            assert_status(resp, 200, "Standard quote when quotesAllowed=false")
            ok("Standard quote still works when quotesAllowed=false")

        self.run_test("6h. QuotesAllowed=false → negotiable blocked", test_quotes_allowed_false)

    # ── Phase 7: Company-side quote ──────────────────────────────

    def phase7_company_side(self):
        phase("PHASE 7: Company-Side Quote Creation")

        def test_company_creates_quote():
            c1_id = self.ids["company1"]
            cust_id = self.ids["customer"]
            product_a = self.product_ids["company1"][0]

            # Company adds to cart for customer
            self.use_token("company1")
            resp = self.api.post("/checkout/cart", {
                "entity": {
                    "productId": product_a,
                    "sellerId": c1_id,
                    "quantity": 2,
                }
            }, params={"accountId": cust_id})
            assert_status(resp, 200, "Company adds to cart for customer")

            # Company creates quote for customer
            resp = self._create_quote("company1", c1_id, "standard",
                                       account_id=cust_id,
                                       extra_fields={
                                           "creditLimit": 500,
                                           "taxableGoods": True,
                                           "leadTime": 3,
                                       })
            assert_status(resp, 200, "Company creates quote for customer")
            ok("Company-side quote created for customer")

        self.run_test("Company creates quote for customer", test_company_creates_quote)

    # ── Phase 8: D2C storefront flow ─────────────────────────────

    def phase8_storefront(self):
        phase("PHASE 8: D2C Storefront Flow (backward compat)")

        def test_storefront_minimal():
            c1_id = self.ids["company1"]
            product_a = self.product_ids["company1"][0]

            # B2C login
            self.re_login("b2c")

            # Add to cart (enough qty to clear any enforcement limits from JWT)
            self._clear_cart("b2c", c1_id)
            self._add_to_cart("b2c", c1_id, product_a, 3)

            # Create quote with MINIMAL payload (like D2C storefront does)
            self.use_token("b2c")
            resp = self.api.post("/checkout/quotes", {
                "sellerId": c1_id,
                "paymentMethods": ["credit_card"],
                "deliveryMethods": ["shipping_out"],
                "shippingOutOptions": ["standard"],
                "quotesAllowed": False,
                "companyLocations": [],
                "customerAddresses": [],
                "quoteType": "standard",
                # NO enforcement fields — this is the backward compat test
            })
            assert_status(resp, 200, "D2C storefront quote")
            data = resp.json()
            assert_gt(data.get("taxAmount", 0), 0, "D2C: tax should be > 0 (default taxable)")
            ok(f"D2C quote OK: grandTotal=${data.get('grandTotal', 0):.2f}, tax=${data.get('taxAmount', 0):.2f}")

        self.run_test("D2C storefront: minimal payload, tax charged", test_storefront_minimal)

    # ── Phase 8b: Time-based deals & CSV export ──────────────────

    def phase8b_deals_and_export(self):
        phase("PHASE 8b: Time-Based Deals & CSV Export")

        c1_id = self.ids["company1"]
        product_a = self.product_ids["company1"][0]

        def test_active_deal():
            """Set deal with future end date → deal should be active"""
            self.use_token("company1")
            from datetime import datetime, timedelta, timezone
            start = (datetime.now(timezone.utc) - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            end = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
            resp = self.api.put(f"/products/{product_a}", {
                "dealPrice": 15,
                "dealStartDate": start,
                "dealEndDate": end,
            })
            assert_status(resp, 200, "Set active deal with dates")

            # Customer should see dealPrice on this product
            self.use_token("customer")
            resp = self.api.get(f"/products/{product_a}")
            assert_status(resp, 200, "Get product as customer")
            data = resp.json()
            assert data.get("dealPrice") == 15, f"Expected dealPrice=15, got {data.get('dealPrice')}"
            assert data.get("dealEndDate") is not None, "Expected dealEndDate to be set"
            ok(f"Active deal: dealPrice={data['dealPrice']}%, ends={data['dealEndDate'][:10]}")

        self.run_test("Active deal with date range", test_active_deal)

        def test_expired_deal():
            """Set deal with past end date → product still has dealPrice but dates indicate expired"""
            self.use_token("company1")
            from datetime import datetime, timedelta, timezone
            start = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%dT%H:%M:%SZ")
            end = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            resp = self.api.put(f"/products/{product_a}", {
                "dealPrice": 10,
                "dealStartDate": start,
                "dealEndDate": end,
            })
            assert_status(resp, 200, "Set expired deal")

            # Product still has dealPrice in DB, but frontend/storefront filters it out
            self.use_token("customer")
            resp = self.api.get(f"/products/{product_a}")
            assert_status(resp, 200, "Get product with expired deal")
            data = resp.json()
            assert data.get("dealPrice") == 10, f"Expected dealPrice=10, got {data.get('dealPrice')}"
            # Verify end date is in the past
            from datetime import datetime, timezone
            end_dt = datetime.fromisoformat(data["dealEndDate"].replace("Z", "+00:00"))
            assert end_dt < datetime.now(timezone.utc), "Expected dealEndDate in the past"
            ok(f"Expired deal stored: dealPrice={data['dealPrice']}%, ended={data['dealEndDate'][:10]}")

        self.run_test("Expired deal (stored but filtered client-side)", test_expired_deal)

        def test_clear_deal():
            """Clear deal dates and price"""
            self.use_token("company1")
            resp = self.api.put(f"/products/{product_a}", {
                "dealPrice": 0,
                "dealStartDate": "",
                "dealEndDate": "",
            })
            assert_status(resp, 200, "Clear deal")
            ok("Deal cleared")

        self.run_test("Clear deal dates", test_clear_deal)

        def test_csv_export():
            """Company exports customer list as CSV"""
            self.use_token("company1")
            resp = self.api.get("/accounts/export")
            assert_status(resp, 200, "CSV export")
            body = resp.text
            assert "Name,Email,Role,Created" in body, f"Expected CSV header, got: {body[:100]}"
            lines = [l for l in body.strip().split("\n") if l]
            assert len(lines) >= 2, f"Expected at least header + 1 row, got {len(lines)} lines"
            ok(f"CSV export: {len(lines) - 1} customer rows")

        self.run_test("Customer CSV export (company)", test_csv_export)

    # ── Phase 8c: Password reset & email case ───────────────────

    def phase8c_password_reset(self):
        phase("PHASE 8c: Password Reset & Email Case")

        def test_forgot_password():
            """Forgot password returns 200 with generic message"""
            resp = self.api.post("/accounts/forgot-password", {
                "email": USERS["customer"]["email"]
            })
            assert_status(resp, 200, "Forgot password")
            msg = resp.json().get("message", "")
            assert "If an account" in msg, f"Expected generic message, got: {msg}"
            ok(f"Forgot password: {msg[:60]}")

        self.run_test("Forgot password endpoint", test_forgot_password)

        def test_forgot_nonexistent():
            """Forgot password with unknown email still returns 200 (no enumeration)"""
            resp = self.api.post("/accounts/forgot-password", {
                "email": "nonexistent@nowhere.com"
            })
            assert_status(resp, 200, "Forgot password (nonexistent)")
            ok("Nonexistent email returns 200 (no enumeration)")

        self.run_test("Forgot password no enumeration", test_forgot_nonexistent)

        def test_reset_bad_token():
            """Reset password with invalid token returns 400"""
            resp = self.api.post("/accounts/reset-password", {
                "token": "invalidtoken123",
                "password": "New@Secure1"
            })
            assert_status(resp, 400, "Reset bad token")
            ok("Bad token rejected")

        self.run_test("Reset password bad token", test_reset_bad_token)

        def test_email_case_login():
            """Login with different case should work (email normalized)"""
            email = USERS["customer"]["email"]
            upper = email.upper()
            resp = self.api.post("/accounts/login", {"email": upper, "password": PASSWORD})
            assert_status(resp, 200, "Login with uppercase email")
            ok(f"Login with {upper} works (normalized to lowercase)")

        self.run_test("Email case-insensitive login", test_email_case_login)

        def test_tax_rate():
            """Tax calculated using company taxRate, not hardcoded"""
            c1_id = self.ids["company1"]
            product_a = self.product_ids["company1"][0]

            self.re_login("customer")
            self._clear_cart("customer", c1_id)
            self._add_to_cart("customer", c1_id, product_a, 1)

            resp = self._create_quote("customer", c1_id)
            assert_status(resp, 200, "Quote with taxRate")
            data = resp.json()
            subtotal = data.get("subtotal", 0)
            tax = data.get("taxAmount", 0)
            rate = data.get("taxRate", 0)
            assert rate == 8.25, f"Expected taxRate=8.25, got {rate}"
            expected_tax = round(subtotal * 0.0825, 2)
            assert abs(tax - expected_tax) < 0.02, f"Expected tax ~{expected_tax}, got {tax}"
            shipping = data.get("shippingCost", 0)
            shipping_rate = data.get("shippingRate", 0)
            assert shipping_rate == 15.0, f"Expected shippingRate=15, got {shipping_rate}"
            assert shipping == 15.0, f"Expected shippingCost=15, got {shipping}"
            ok(f"Tax correct: ${subtotal:.2f} × {rate}% = ${tax:.2f}, shipping=${shipping:.2f}")

        self.run_test("Tax and shipping rate from company config", test_tax_rate)

    # ── Phase 8d: Visitor Tracking ─────────────────────────────────

    def phase8d_visitor_tracking(self):
        phase("PHASE 8d: Visitor Tracking")

        test_vid = "v___test__" + str(int(time.time()))
        self.tracker.track_visitor(test_vid)

        # Test 1: Normal visitor event captures all fields
        def test_visitor_event():
            resp = self.api.post("/visitors/event", {
                "visitorId": test_vid,
                "event": "page_view",
                "page": "/",
                "referrer": "https://www.google.com/",
                "utm_source": "google",
                "utm_medium": "cpc",
                "utm_campaign": "shopify-alt",
                "utm_content": "ad-v1",
                "utm_term": "shopify alternative no monthly fee",
                "clickIds": {"gclid": "test_gclid_abc123", "msclkid": "test_msclkid_xyz789"},
                "timezone": "America/New_York",
                "screenWidth": 1920,
                "screenHeight": 1080,
                "language": "en-US",
            })
            assert_status(resp, 200, "Visitor event accepted")
            ok("Visitor page_view event accepted")

        self.run_test("Visitor event with all fields", test_visitor_event)

        # Test 2: Admin visitor is skipped (when customerId is admin)
        def test_admin_skipped():
            admin_id = self.ids.get("admin", "")
            resp = self.api.post("/visitors/event", {
                "visitorId": "v___test__admin_skip",
                "event": "page_view",
                "page": "/",
                "customerId": admin_id,
            })
            assert_status(resp, 200, "Admin event returns 200")
            body = resp.json()
            assert body.get("status") == "skipped", f"Expected skipped, got {body.get('status')}"
            ok("Admin visitor correctly skipped")

        self.run_test("Admin visitor skipped", test_admin_skipped)

        # Test 3: Company visitor is skipped
        def test_company_skipped():
            company_id = self.ids.get("company1", "")
            resp = self.api.post("/visitors/event", {
                "visitorId": "v___test__company_skip",
                "event": "page_view",
                "page": "/",
                "customerId": company_id,
            })
            assert_status(resp, 200, "Company event returns 200")
            body = resp.json()
            assert body.get("status") == "skipped", f"Expected skipped, got {body.get('status')}"
            ok("Company visitor correctly skipped")

        self.run_test("Company visitor skipped", test_company_skipped)

        # Test 4: Retrieve visitor and verify all stored fields
        def test_visitor_data():
            self.use_token("admin")
            resp = self.api.get(f"/visitors?visitorId={test_vid}")
            assert_status(resp, 200, "Get visitor by ID")
            visitors = resp.json().get("visitors", [])
            assert len(visitors) == 1, f"Expected 1 visitor, got {len(visitors)}"
            v = visitors[0]

            # Attribution
            attr = v.get("attribution", {})
            assert attr.get("source") == "google", f"source: {attr.get('source')}"
            assert attr.get("medium") == "cpc", f"medium: {attr.get('medium')}"
            assert attr.get("campaign") == "shopify-alt", f"campaign: {attr.get('campaign')}"
            assert attr.get("content") == "ad-v1", f"content: {attr.get('content')}"
            assert attr.get("term") == "shopify alternative no monthly fee", f"term: {attr.get('term')}"
            assert attr.get("landingPage") == "/", f"landingPage: {attr.get('landingPage')}"
            ok("Attribution fields correct (source, medium, campaign, content, term, landingPage)")

            # Click IDs (PPC attribution)
            click_ids = attr.get("clickIds", {})
            assert click_ids.get("gclid") == "test_gclid_abc123", f"gclid: {click_ids.get('gclid')}"
            assert click_ids.get("msclkid") == "test_msclkid_xyz789", f"msclkid: {click_ids.get('msclkid')}"
            ok("Click IDs captured (gclid, msclkid)")

            # Geo — timezone from browser fallback
            geo = v.get("geo", {})
            assert geo.get("timezone") == "America/New_York", f"timezone: {geo.get('timezone')}"
            ok("Timezone captured from browser fallback")

            # Device info
            assert v.get("screenWidth") == 1920, f"screenWidth: {v.get('screenWidth')}"
            assert v.get("screenHeight") == 1080, f"screenHeight: {v.get('screenHeight')}"
            assert v.get("language") == "en-US", f"language: {v.get('language')}"
            ok("Screen resolution and language captured")

            # Activity
            assert v.get("totalSessions") == 1, f"sessions: {v.get('totalSessions')}"
            assert v.get("totalPageViews") == 1, f"pageViews: {v.get('totalPageViews')}"
            assert "/" in v.get("pages", []), f"pages: {v.get('pages')}"
            ok("Activity counters correct")

        self.run_test("Visitor data verification", test_visitor_data)

        # Test 5: Milestone event (add_to_cart)
        def test_milestone():
            resp = self.api.post("/visitors/event", {
                "visitorId": test_vid,
                "event": "add_to_cart",
                "page": "/products/test.html",
                "timezone": "America/New_York",
                "screenWidth": 1920,
                "screenHeight": 1080,
                "language": "en-US",
                "metadata": {"productId": "test123", "productName": "Test Product", "price": 29.99},
            })
            assert_status(resp, 200, "Add to cart event")

            self.use_token("admin")
            resp = self.api.get(f"/visitors?visitorId={test_vid}")
            v = resp.json().get("visitors", [])[0]
            milestones = v.get("milestones", [])
            assert len(milestones) >= 1, f"Expected milestones, got {len(milestones)}"
            m = milestones[0]
            assert m.get("event") == "add_to_cart", f"milestone event: {m.get('event')}"
            assert m.get("metadata", {}).get("productName") == "Test Product", "milestone metadata"
            ok("Milestone (add_to_cart) stored with metadata")

        self.run_test("Visitor milestone event", test_milestone)

        # Test 6: Click IDs follow last-click semantics; UTMs + landing page stay first-click
        def test_clickid_last_click_overwrite():
            resp = self.api.post("/visitors/event", {
                "visitorId": test_vid,
                "event": "page_view",
                "page": "/products/other.html",
                "utm_source": "bing",  # different source: must be IGNORED (first-click UTMs)
                "utm_medium": "cpc",
                "clickIds": {"gclid": "NEW_gclid_999"},  # different gclid: must WIN (last-click)
            })
            assert_status(resp, 200, "Return visit accepted")

            self.use_token("admin")
            v = self.api.get(f"/visitors?visitorId={test_vid}").json().get("visitors", [])[0]
            attr = v.get("attribution", {})
            # Last-click: new gclid wins; msclkid cleared (replaced map)
            assert attr.get("clickIds", {}).get("gclid") == "NEW_gclid_999", f"gclid not overwritten: {attr.get('clickIds')}"
            assert "msclkid" not in attr.get("clickIds", {}), f"msclkid not cleared: {attr.get('clickIds')}"
            # First-click: original UTMs and landing page preserved
            assert attr.get("source") == "google", f"source clobbered: {attr.get('source')}"
            assert attr.get("landingPage") == "/", f"landingPage clobbered: {attr.get('landingPage')}"
            ok("Last-click clickIds + first-click UTMs/landingPage preserved")

        self.run_test("Click IDs last-click + UTMs first-click", test_clickid_last_click_overwrite)

        # Cleanup: delete test visitor
        def test_cleanup_visitor():
            # Direct DB cleanup not possible via API — visitor will be orphaned but harmless
            # Just verify the skipped visitors weren't created
            self.use_token("admin")
            for skip_vid in ["v___test__admin_skip", "v___test__company_skip"]:
                resp = self.api.get(f"/visitors?visitorId={skip_vid}")
                visitors = resp.json().get("visitors") or []
                assert len(visitors) == 0, f"Skipped visitor {skip_vid} should not exist, found {len(visitors)}"
            ok("Skipped visitors confirmed not in database")

        self.run_test("Verify skipped visitors not stored", test_cleanup_visitor)

    # ── Phase 8e: Billing Statements ───────────────────────────────

    def phase8e_billing_statements(self):
        phase("PHASE 8e: Billing Statements")

        c1_id = self.ids["company1"]
        # Period covering all of "this month" — orders created earlier in this run fall inside.
        now = datetime.datetime.now(datetime.timezone.utc)
        from_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Add ~32 days then snap to first of next month for the upper bound.
        next_month = (from_dt + datetime.timedelta(days=32)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        from_str = from_dt.isoformat().replace("+00:00", "Z")
        to_str = next_month.isoformat().replace("+00:00", "Z")

        def test_get_statement_admin():
            """Admin can fetch any seller's statement"""
            self.use_token("admin")
            resp = self.api.get("/checkout/orders/statement",
                                params={"sellerId": c1_id, "from": from_str, "to": to_str})
            assert_status(resp, 200, "Admin GET statement")
            data = resp.json()
            assert data.get("sellerId") == c1_id, f"sellerId mismatch: {data.get('sellerId')}"
            assert data.get("tier") in ("Starter", "Growth", "Enterprise"), f"bad tier: {data.get('tier')}"
            assert "orderCount" in data, "missing orderCount"
            assert "totalDue" in data, "missing totalDue"
            ok(f"Statement: tier={data['tier']} orders={data['orderCount']} totalDue=${data['totalDue']:.2f}")

        self.run_test("GET statement as admin", test_get_statement_admin)

        def test_get_statement_own_seller():
            """Company can fetch its OWN statement"""
            self.use_token("company1")
            resp = self.api.get("/checkout/orders/statement",
                                params={"sellerId": c1_id, "from": from_str, "to": to_str})
            assert_status(resp, 200, "Company GET own statement")
            data = resp.json()
            assert data.get("sellerId") == c1_id, "own sellerId mismatch"
            ok("Company can fetch own statement")

        self.run_test("GET own statement as company", test_get_statement_own_seller)

        def test_get_statement_other_forbidden():
            """Customer fetching another seller's statement is forbidden"""
            self.use_token("customer")
            resp = self.api.get("/checkout/orders/statement",
                                params={"sellerId": c1_id, "from": from_str, "to": to_str})
            assert_status(resp, 403, "Customer GET others' statement")
            ok("Non-admin/non-seller correctly forbidden")

        self.run_test("Statement forbidden for unrelated role", test_get_statement_other_forbidden)

        def test_get_statement_bad_dates():
            """Invalid date range rejected"""
            self.use_token("admin")
            resp = self.api.get("/checkout/orders/statement",
                                params={"sellerId": c1_id, "from": to_str, "to": from_str})
            assert_status(resp, 400, "Inverted date range")
            ok("Inverted date range rejected (400)")

        self.run_test("Statement bad date range", test_get_statement_bad_dates)

        def test_send_statement_dryrun():
            """Admin dryRun returns rendered email body without sending"""
            self.use_token("admin")
            resp = self.api.post("/checkout/orders/statement/send", {
                "sellerId": c1_id,
                "from": from_str,
                "to": to_str,
                "recipientEmail": "billing-test@example.com",
                "companyName": "Test Co",
                "periodLabel": "Test Period",
                "paymentInstructions": "Pay via test rails.",
                "dryRun": True,
            })
            assert_status(resp, 200, "Dry-run send")
            data = resp.json()
            assert data.get("dryRun") is True, "dryRun flag not echoed"
            assert data.get("htmlBody"), "missing htmlBody"
            assert data.get("textBody"), "missing textBody"
            assert "statement" in data, "missing statement"
            ok("Dry-run preview returns htmlBody, textBody, statement")

        self.run_test("Send statement dryRun preview", test_send_statement_dryrun)

        def test_send_statement_company_forbidden():
            """Non-admin POST to send is rejected"""
            self.use_token("company1")
            resp = self.api.post("/checkout/orders/statement/send", {
                "sellerId": c1_id,
                "from": from_str,
                "to": to_str,
                "recipientEmail": "x@example.com",
                "companyName": "X",
                "periodLabel": "P",
                "dryRun": True,
            })
            assert_status(resp, 403, "Company send")
            ok("Non-admin send correctly forbidden")

        self.run_test("Send statement admin-only", test_send_statement_company_forbidden)

        def test_send_statement_bad_email():
            """Malformed recipientEmail rejected"""
            self.use_token("admin")
            resp = self.api.post("/checkout/orders/statement/send", {
                "sellerId": c1_id,
                "from": from_str,
                "to": to_str,
                "recipientEmail": "not-an-email",
                "companyName": "X",
                "periodLabel": "P",
                "dryRun": True,
            })
            assert_status(resp, 400, "Bad email")
            ok("Malformed email rejected (400)")

        self.run_test("Send statement validates email", test_send_statement_bad_email)

        def test_statement_route_guard():
            """POST /checkout/orders/statement (no /send) must NOT fall through to place-order.
            API Gateway has no POST method on /statement, so it rejects with 403 before Lambda
            is invoked — strictly safer than reaching the handler."""
            self.use_token("admin")
            resp = self.api.post("/checkout/orders/statement", {})
            assert_status(resp, 403, "POST /statement (no /send)")
            ok("API Gateway rejects unmapped POST /statement (no fall-through to place-order)")

        self.run_test("Statement route guard", test_statement_route_guard)

        # Track statement count before real send so we can verify exactly one new row.
        def test_send_statement_persists():
            """Real (non-dryRun) send returns a snapshot doc with id+sentAt.
            Local SMTP is no-op — Send returns nil so the snapshot still persists,
            which is the path we want to test."""
            self.use_token("admin")
            resp = self.api.post("/checkout/orders/statement/send", {
                "sellerId": c1_id,
                "from": from_str,
                "to": to_str,
                "recipientEmail": "billing-test@example.com",
                "companyName": "Test Co",
                "periodLabel": "Test Period",
                "paymentInstructions": "Pay via test rails.",
                "dryRun": False,
            })
            assert_status(resp, 200, "Real send")
            data = resp.json()
            assert data.get("sent") is True, "sent flag not true"
            snap = data.get("snapshot")
            assert snap, f"missing snapshot in response: {data}"
            assert snap.get("id"), "snapshot missing id"
            assert snap.get("sentAt"), "snapshot missing sentAt"
            assert snap.get("sellerId") == c1_id, "snapshot sellerId mismatch"
            assert snap.get("recipientEmail") == "billing-test@example.com", "snapshot recipient mismatch"
            self.tracker.track_statement(snap["id"])
            ok(f"Statement persisted: id={snap['id'][:8]}... totalDue=${snap['totalDue']:.2f}")

        self.run_test("Send statement persists snapshot", test_send_statement_persists)

        def test_get_statements_admin():
            """Admin can list any seller's persisted statements"""
            self.use_token("admin")
            resp = self.api.get("/checkout/statements", params={"sellerId": c1_id})
            assert_status(resp, 200, "Admin list statements")
            arr = resp.json()
            assert isinstance(arr, list), f"expected list, got {type(arr)}"
            assert len(arr) >= 1, f"expected ≥1 statement, got {len(arr)}"
            assert arr[0].get("sellerId") == c1_id, "list result sellerId mismatch"
            ok(f"Admin sees {len(arr)} statement(s)")

        self.run_test("List statements as admin", test_get_statements_admin)

        def test_get_statements_own_seller():
            """Company can list its own persisted statements"""
            self.use_token("company1")
            resp = self.api.get("/checkout/statements", params={"sellerId": c1_id})
            assert_status(resp, 200, "Company list own")
            arr = resp.json()
            assert len(arr) >= 1, "company should see own statement"
            ok(f"Company sees {len(arr)} own statement(s)")

        self.run_test("List own statements as company", test_get_statements_own_seller)

        def test_get_statements_other_forbidden():
            """Customer listing another seller's statements is forbidden"""
            self.use_token("customer")
            resp = self.api.get("/checkout/statements", params={"sellerId": c1_id})
            assert_status(resp, 403, "Customer list others'")
            ok("Non-admin/non-seller correctly forbidden on list")

        self.run_test("List statements forbidden for unrelated role", test_get_statements_other_forbidden)

        def test_get_statements_missing_seller():
            """Missing sellerId rejected"""
            self.use_token("admin")
            resp = self.api.get("/checkout/statements")
            assert_status(resp, 400, "Missing sellerId")
            ok("Missing sellerId rejected (400)")

        self.run_test("List statements requires sellerId", test_get_statements_missing_seller)

    # ── Phase 8f: Blog posts (editorial CMS) ─────────────────────
    # Uses uSetGo's REAL welding-gloves blog post as the test fixture.
    # No synthetic create/delete — protects prod content from test churn.

    def phase8f_blog_posts(self):
        phase("PHASE 8f: Blog Post Permissions + Validation (real uSetGo post)")

        USETGO_SELLER_ID = "68d46f98e4dc5dd472e33655"

        # ── 1. Discover the real uSetGo welding-gloves post ───────
        def test_discover_usetgo_post():
            self.use_token("admin")
            resp = self.api.get("/blog")
            assert_status(resp, 200, "Admin list blog posts")
            posts = resp.json()
            usetgo_welding = [
                p for p in posts
                if p.get("sellerID") == USETGO_SELLER_ID
                and p.get("category") == "welding-gloves"
            ]
            assert len(usetgo_welding) >= 1, \
                f"Expected ≥1 uSetGo welding-gloves post in prod Mongo, found {len(usetgo_welding)}"
            self._usetgo_post = usetgo_welding[0]
            ok(f"Found uSetGo post: '{self._usetgo_post['title'][:50]}...' "
               f"slug={self._usetgo_post['slug']} _id={self._usetgo_post['_id'][:8]}...")

        self.run_test("8f-1. Discover uSetGo welding-gloves post (admin)", test_discover_usetgo_post)

        # ── 2. Admin can GET uSetGo post by ID ────────────────────
        def test_admin_get_post():
            self.use_token("admin")
            pid = self._usetgo_post["_id"]
            resp = self.api.get(f"/blog/{pid}")
            assert_status(resp, 200, "Admin GET uSetGo post by ID")
            body = resp.json()
            assert body.get("sellerID") == USETGO_SELLER_ID
            assert body.get("category") == "welding-gloves"
            ok(f"Admin read uSetGo post by ID ({len(body.get('body', ''))} chars body)")

        self.run_test("8f-2. Admin GET by ID", test_admin_get_post)

        # ── 3. Slug uniqueness blocks duplicate against existing uSetGo slug ─
        # Uses admin role (can target uSetGo's sellerID). Validation-only — no
        # data created (409 short-circuits before insert).
        def test_slug_uniqueness():
            self.use_token("admin")
            dup_slug = self._usetgo_post["slug"]
            resp = self.api.post("/blog", {
                "title": f"{PREFIX} Duplicate Slug Validation Test",
                "slug": dup_slug,
                "body": "x" * 250,
                "author": "Test Author",
                "category": "welding-gloves",
            })
            # Note: admin's sellerID != uSetGo's, so slug check may pass for admin.
            # If admin role's own sellerID has no posts, this 201s. We only assert
            # that the endpoint behaves correctly (201 OK or 409 on duplicate).
            # Track if accidentally created so cleanup can remove it.
            if resp.status_code in (200, 201):
                resp2 = self.api.get("/blog")
                if resp2.status_code == 200:
                    matches = [p for p in resp2.json() if p.get("slug") == dup_slug]
                    for m in matches:
                        if m.get("_id") != self._usetgo_post["_id"]:
                            self.tracker.track_blog_post("admin", m["_id"])
                ok("Admin can create post (different sellerID from uSetGo)")
            elif resp.status_code == 409:
                ok("Duplicate slug correctly rejected (409)")
            else:
                raise AssertionError(f"Unexpected status: {resp.status_code}")

        self.run_test("8f-3. Slug uniqueness behavior", test_slug_uniqueness)

        # ── 4. Required field validation (POST rejected, nothing created) ─
        def test_required_fields():
            self.use_token("company1")
            # Missing title
            resp = self.api.post("/blog", {
                "slug": "validation-missing-title",
                "body": "x" * 250,
                "author": "Author",
                "category": "test",
            })
            assert_status(resp, 400, "Missing title rejected")
            ok("Missing title → 400")
            # Body too short
            resp = self.api.post("/blog", {
                "title": f"{PREFIX} Short body validation test post title",
                "slug": "validation-short-body",
                "body": "too short",
                "author": "Author",
                "category": "test",
            })
            assert_status(resp, 400, "Short body rejected")
            ok("Body < 200 chars → 400")

        self.run_test("8f-4. Required field validation", test_required_fields)

        # ── 5. Slug format validation (POST rejected, nothing created) ────
        def test_slug_format():
            self.use_token("company1")
            for bad_slug in ["UPPER-CASE", "has spaces", "has/slash", "-leading", "trailing-", "double--hyphen"]:
                resp = self.api.post("/blog", {
                    "title": f"{PREFIX} Slug format test for validation rules here",
                    "slug": bad_slug,
                    "body": "x" * 250,
                    "author": "Author",
                    "category": "test",
                })
                assert_status(resp, 400, f"Bad slug '{bad_slug}' rejected")
            ok("All 6 invalid slug formats correctly rejected")

        self.run_test("8f-5. Slug format validation", test_slug_format)

        # ── 6. Cross-company isolation (company2 vs uSetGo) ───────
        def test_cross_company_isolation():
            self.use_token("company2")
            pid = self._usetgo_post["_id"]
            # GET should be forbidden — company2 has no relation to uSetGo
            resp = self.api.get(f"/blog/{pid}")
            assert_status(resp, 403, "Cross-company GET forbidden")
            ok("company2 GET on uSetGo post → 403")
            # PUT should be forbidden (rejected at auth, never mutates)
            resp = self.api.put(f"/blog/{pid}", {"title": f"{PREFIX} Should fail"})
            assert_status(resp, 403, "Cross-company PUT forbidden")
            ok("company2 PUT on uSetGo post → 403")

        self.run_test("8f-6. Cross-company isolation", test_cross_company_isolation)

        # ── 7. Company list scoped to own (company2 doesn't see uSetGo) ──
        def test_list_company_scoped():
            self.use_token("company2")
            resp = self.api.get("/blog")
            assert_status(resp, 200, "company2 list blog posts")
            posts = resp.json()
            assert not any(p.get("sellerID") == USETGO_SELLER_ID for p in posts), \
                "company2 saw uSetGo's posts in their list"
            ok(f"company2 list scoped — uSetGo posts excluded ({len(posts)} visible)")

        self.run_test("8f-7. Company list scoped to own posts", test_list_company_scoped)

        # ── 8. Admin sees all posts including uSetGo's ────────────
        def test_admin_sees_all():
            self.use_token("admin")
            resp = self.api.get("/blog")
            assert_status(resp, 200, "Admin list blog posts")
            posts = resp.json()
            usetgo_post_id = self._usetgo_post["_id"]
            assert any(p["_id"] == usetgo_post_id for p in posts), \
                "Admin did not see uSetGo post in list"
            ok(f"Admin sees uSetGo post in list ({len(posts)} total)")

        self.run_test("8f-8. Admin sees all posts", test_admin_sees_all)

    # ── Phase 9: Cleanup ─────────────────────────────────────────

    def cleanup(self):
        phase("PHASE 9: Cleanup")

        # Clear carts
        step("Clearing carts")
        for role_key in ["customer", "customer2", "b2c"]:
            if role_key in self.jwts:
                for seller_key in ["company1", "company2"]:
                    if seller_key in self.ids:
                        try:
                            self._clear_cart(role_key, self.ids[seller_key])
                        except Exception:
                            pass
        ok("Carts cleared")

        # Delete orders (admin only)
        step("Deleting test orders")
        if "admin" in self.jwts:
            self.use_token("admin")
            for oid in self.tracker.orders:
                try:
                    resp = self.api.delete(f"/checkout/orders/{oid}")
                    if resp.status_code in (200, 204):
                        ok(f"Deleted order {oid[:8]}...")
                    else:
                        warn(f"Failed to delete order {oid[:8]}...: HTTP {resp.status_code}")
                except Exception as e:
                    warn(f"Error deleting order {oid[:8]}...: {e}")

        # Delete products
        step("Deleting test products")
        for role_key, pid in self.tracker.products:
            if role_key in self.jwts:
                try:
                    self.use_token(role_key)
                    resp = self.api.delete(f"/products/{pid}")
                    if resp.status_code in (200, 204):
                        ok(f"Deleted product {pid[:8]}...")
                    else:
                        warn(f"Failed to delete product {pid[:8]}...: HTTP {resp.status_code}")
                except Exception as e:
                    warn(f"Error deleting product {pid[:8]}...: {e}")

        # Delete blog posts
        step("Deleting test blog posts")
        for role_key, pid in self.tracker.blog_posts:
            if role_key in self.jwts:
                try:
                    self.use_token(role_key)
                    resp = self.api.delete(f"/blog/{pid}")
                    if resp.status_code in (200, 204):
                        ok(f"Deleted blog post {pid[:8]}...")
                    else:
                        warn(f"Failed to delete blog post {pid[:8]}...: HTTP {resp.status_code}")
                except Exception as e:
                    warn(f"Error deleting blog post {pid[:8]}...: {e}")

        # Delete accounts (admin only, reverse order — customers first, then companies)
        step("Deleting test accounts")
        if "admin" in self.jwts:
            self.use_token("admin")
            delete_order = ["b2c", "customer2", "customer", "company2", "company1"]
            for role_key in delete_order:
                if role_key in self.ids:
                    try:
                        resp = self.api.delete(f"/accounts/{self.ids[role_key]}")
                        if resp.status_code in (200, 204):
                            ok(f"Deleted {role_key} ({self.ids[role_key][:8]}...)")
                        else:
                            warn(f"Failed to delete {role_key}: HTTP {resp.status_code}")
                    except Exception as e:
                        warn(f"Error deleting {role_key}: {e}")

            # Delete admin last
            try:
                resp = self.api.delete(f"/accounts/{self.ids['admin']}")
                if resp.status_code in (200, 204):
                    ok("Deleted admin account")
                else:
                    warn(f"Failed to delete admin: HTTP {resp.status_code}")
            except Exception:
                warn("Error deleting admin")

        # Delete codes (admin only)
        step("Deleting test codes")
        if "admin" in self.jwts:
            self.use_token("admin")
            for code in self.tracker.codes:
                try:
                    resp = self.api.delete(f"/codes/{code}")
                    if resp.status_code in (200, 204):
                        ok(f"Deleted code {code}")
                    else:
                        warn(f"Failed to delete code {code}: HTTP {resp.status_code}")
                except Exception as e:
                    warn(f"Error deleting code {code}: {e}")

        # Delete test visitors
        step("Deleting test visitors")
        if "admin" in self.jwts:
            self.use_token("admin")
            for vid in self.tracker.visitors:
                try:
                    resp = self.api.delete(f"/visitors?visitorId={vid}")
                    if resp.status_code == 200:
                        ok(f"Deleted visitor {vid}")
                    else:
                        warn(f"Failed to delete visitor {vid}: HTTP {resp.status_code}")
                except Exception as e:
                    warn(f"Error deleting visitor {vid}: {e}")

        # Delete persisted statement snapshots (admin only).
        # Statements are immutable in production but tests must clean up so the
        # collection doesn't accumulate orphans across runs.
        step("Deleting test statements")
        if "admin" in self.jwts:
            self.use_token("admin")
            for sid in self.tracker.statements:
                try:
                    resp = self.api.delete(f"/checkout/statements/{sid}")
                    if resp.status_code == 200:
                        ok(f"Deleted statement {sid[:8]}...")
                    else:
                        warn(f"Failed to delete statement {sid[:8]}...: HTTP {resp.status_code}")
                except Exception as e:
                    warn(f"Error deleting statement {sid[:8]}...: {e}")

        step("Cleanup complete")

    # ── Main ─────────────────────────────────────────────────────

    def _orphan_sweep(self):
        """Scan by PREFIX (not by ownership) and delete anything matching test
        prefixes. Catches orphans from prior crashed runs where the parent test
        account no longer exists, so the standard discovery (which queries via
        known account logins) cannot find them.

        Strict prefix match (startswith) + per-collection safety cap.
        Requires admin token already in self.jwts['admin']."""
        SAFETY_CAP = 100
        if "admin" not in self.jwts:
            return  # standard discovery handles current-run state if available
        self.use_token("admin")
        deleted = {"accounts": 0, "products": 0, "visitors": 0, "codes": 0}

        # Accounts: __test__ or __smoke prefix, excluding ones we just logged in to
        # (those are tracked through the standard cleanup path).
        known_ids = set(self.ids.values())
        try:
            resp = self.api.get("/accounts")
            if resp.status_code == 200:
                orphans = [a for a in (resp.json() or [])
                           if (a.get("email", "").startswith("__test__") or a.get("email", "").startswith("__smoke"))
                           and a.get("_id") not in known_ids]
                if len(orphans) > SAFETY_CAP:
                    print(f"  ⚠ orphan-sweep: {len(orphans)} accounts exceeds cap {SAFETY_CAP}, aborting")
                    return
                for a in orphans:
                    if self.api.delete(f"/accounts/{a['_id']}").status_code in (200, 204):
                        deleted["accounts"] += 1
        except Exception:
            pass

        # Products: __TEST__ prefix
        try:
            resp = self.api.get("/products")
            if resp.status_code == 200:
                orphans = [p for p in (resp.json() or []) if p.get("name", "").startswith("__TEST__")]
                if len(orphans) > SAFETY_CAP:
                    print(f"  ⚠ orphan-sweep: {len(orphans)} products exceeds cap {SAFETY_CAP}, aborting")
                    return
                for p in orphans:
                    if self.api.delete(f"/products/{p['_id']}").status_code in (200, 204):
                        deleted["products"] += 1
        except Exception:
            pass

        # Visitors: v___test__ prefix
        try:
            resp = self.api.get("/visitors")
            if resp.status_code == 200:
                body = resp.json() or {}
                visitors = body.get("visitors", []) if isinstance(body, dict) else body
                orphans = [v for v in visitors if v.get("visitorId", "").startswith("v___test__")]
                if len(orphans) > SAFETY_CAP:
                    print(f"  ⚠ orphan-sweep: {len(orphans)} visitors exceeds cap {SAFETY_CAP}, aborting")
                    return
                for v in orphans:
                    if self.api.delete(f"/visitors?visitorId={v['visitorId']}").status_code in (200, 204):
                        deleted["visitors"] += 1
        except Exception:
            pass

        # Codes: __TEST__ prefix, EXCLUDING ones phase1 just created (in
        # self.tracker.codes). Without this exclusion the sweep deletes the
        # codes the current run depends on.
        try:
            resp = self.api.get("/codes")
            if resp.status_code == 200:
                known_codes = set(self.tracker.codes)
                orphans = [c for c in (resp.json() or [])
                           if c.get("companyCode", "").startswith("__TEST__")
                           and c.get("companyCode") not in known_codes]
                if len(orphans) > SAFETY_CAP:
                    print(f"  ⚠ orphan-sweep: {len(orphans)} codes exceeds cap {SAFETY_CAP}, aborting")
                    return
                for c in orphans:
                    code = c.get("companyCode")
                    if code and self.api.delete(f"/codes/{code}").status_code in (200, 204):
                        deleted["codes"] += 1
        except Exception:
            pass

        total = sum(deleted.values())
        if total > 0:
            ok(f"Orphan sweep removed: {deleted}")
        else:
            ok("Orphan sweep: no orphans found")

    def discover_and_cleanup(self):
        """Log in to known test accounts, discover any leftover test data, and
        run the standard cleanup. Used both in --cleanup-only mode and as a
        safety net before phase1 in a normal run (catches leftovers from a
        prior crashed run)."""
        step("Logging in existing test accounts for cleanup")
        for role_key in ["admin", "company1", "company2", "customer", "customer2", "b2c"]:
            token = self._login(USERS[role_key]["email"])
            if token:
                self.jwts[role_key] = token
                self.ids[role_key] = self._get_id_from_jwt(token)
                ok(f"Found {role_key}: {self.ids[role_key][:8]}...")
            else:
                # Quiet during pre-cleanup; only loud in --cleanup-only mode
                pass

        step("Discovering test data to clean up")

        # Discover orders (admin sees all)
        if "admin" in self.jwts:
            self.use_token("admin")
            resp = self.api.get("/checkout/orders")
            if resp.status_code == 200:
                test_account_ids = set(self.ids.values())
                for order in resp.json():
                    if order.get("accountId") in test_account_ids:
                        self.tracker.track_order(order["id"])
                ok(f"Found {len(self.tracker.orders)} test orders")

        # Discover products (per company)
        for role_key in ["company1", "company2"]:
            if role_key in self.jwts:
                self.use_token(role_key)
                resp = self.api.get("/products")
                if resp.status_code == 200:
                    for p in resp.json():
                        if p.get("name", "").startswith(PREFIX):
                            self.tracker.track_product(role_key, p["_id"])
                    ok(f"Found {len([x for x in self.tracker.products if x[0]==role_key])} test products for {role_key}")

        # Track known code strings
        for code_set in CODES.values():
            self.tracker.track_code(code_set["companyCode"])

        # Discover persisted statements per known seller account
        if "admin" in self.jwts:
            self.use_token("admin")
            for seller_role in ["company1", "company2"]:
                if seller_role in self.ids:
                    try:
                        resp = self.api.get("/checkout/statements", params={"sellerId": self.ids[seller_role]})
                        if resp.status_code == 200:
                            for s in resp.json():
                                if s.get("id"):
                                    self.tracker.track_statement(s["id"])
                    except Exception:
                        pass
            if self.tracker.statements:
                ok(f"Found {len(self.tracker.statements)} test statement(s)")

        self.cleanup()
        # Reset state so the caller can proceed with a fresh phase1_setup.
        self.jwts = {}
        self.ids = {}
        self.tracker = Tracker()
        self.api.clear_token()

    def run(self, cleanup_only=False):
        start_time = time.time()

        if cleanup_only:
            phase("CLEANUP ONLY MODE")
            self.discover_and_cleanup()
            return

        # Pre-clean: catch leftovers from a prior crashed run before starting.
        phase("PRE-CLEAN: removing any leftover test data")
        self.discover_and_cleanup()

        try:
            self.phase1_setup()
            # Orphan sweep runs AFTER phase1 (admin is now logged in via
            # login_or_register). Catches __test__/__TEST__ data orphaned by
            # prior crashed runs whose parent accounts no longer exist.
            # self.ids has phase1's just-created accounts so sweep excludes them.
            try:
                self._orphan_sweep()
            except Exception as e:
                print(f"  ⚠ orphan-sweep skipped due to error: {e}")
            self.phase2_company_settings()
            self.phase3_catalog()
            self.phase4_jwt_verification()
            self.phase5_happy_path()
            self.phase5b_tiered_pricing()
            self.phase5c_groups()
            self.phase5d_order_updates()
            self.phase6_enforcement()
            self.phase7_company_side()
            self.phase8_storefront()
            self.phase8b_deals_and_export()
            self.phase8c_password_reset()
            self.phase8d_visitor_tracking()
            self.phase8e_billing_statements()
            self.phase8f_blog_posts()
        finally:
            self.cleanup()

        elapsed = time.time() - start_time
        print(f"\n{'═' * 60}")
        print(f"  {GREEN}PASSED: {self.passed}{NC}  {RED}FAILED: {self.failed}{NC}  Time: {elapsed:.1f}s")
        print(f"{'═' * 60}\n")

        if self.failed > 0:
            sys.exit(1)


# ── Entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BusinessCart Backend Flow Test")
    parser.add_argument("--base-url", default="http://127.0.0.1:3000", help="API base URL")
    parser.add_argument("--cleanup-only", action="store_true", help="Only run cleanup")
    args = parser.parse_args()

    print(f"{BOLD}BusinessCart Backend Flow Test{NC}")
    print(f"Base URL: {args.base_url}")

    test = BackendFlowTest(args.base_url)
    test.run(cleanup_only=args.cleanup_only)
