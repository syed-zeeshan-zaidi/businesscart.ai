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

    def track_account(self, role_key, account_id):
        self.accounts.append((role_key, account_id))

    def track_product(self, role_key, product_id):
        self.products.append((role_key, product_id))

    def track_order(self, order_id):
        self.orders.append(order_id)

    def track_code(self, company_code):
        if company_code not in self.codes:
            self.codes.append(company_code)


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
                "leadTime": 3,
                "quotesAllowed": True,
                "paymentMethods": ["credit_card", "purchase_order"],
                "deliveryMethods": ["pickup", "shipping_out"],
                "shippingOutOptions": ["standard"],
            }
        })
        assert_status(resp, 200, "Update company1 settings")
        ok("Company1 defaults set")

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

        step("Cleanup complete")

    # ── Main ─────────────────────────────────────────────────────

    def run(self, cleanup_only=False):
        start_time = time.time()

        if cleanup_only:
            phase("CLEANUP ONLY MODE")
            step("Logging in existing test accounts for cleanup")
            for role_key in ["admin", "company1", "company2", "customer", "customer2", "b2c"]:
                token = self._login(USERS[role_key]["email"])
                if token:
                    self.jwts[role_key] = token
                    self.ids[role_key] = self._get_id_from_jwt(token)
                    ok(f"Found {role_key}: {self.ids[role_key][:8]}...")
                else:
                    warn(f"{role_key} not found, skipping")

            # Discover existing test data since tracker is empty
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

            self.cleanup()
            return

        try:
            self.phase1_setup()
            self.phase2_company_settings()
            self.phase3_catalog()
            self.phase4_jwt_verification()
            self.phase5_happy_path()
            self.phase5b_tiered_pricing()
            self.phase6_enforcement()
            self.phase7_company_side()
            self.phase8_storefront()
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
