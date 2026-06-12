#!/usr/bin/env python3
"""Local pre-commit validation: regenerate uSetGo storefront against real Atlas data,
validate JSON-LD schema, run Lighthouse against representative pages.

Run BEFORE every commit. Catches:
  - template parse errors (regen returns non-200)
  - JSON-LD validity (parses cleanly, has required fields when applicable)
  - PageSpeed regressions (Lighthouse with hard thresholds)
  - Stale binary (you forgot to rebuild — manifests as no-op regen or stale output)

Requires:
  - Local SAM services running (./manage_services.sh start)
  - account-service binary rebuilt after any template/generator change
  - ADMIN_PASSWORD env var set (real admin login on Atlas)
  - lighthouse + chrome installed (npm i -g lighthouse, system chrome)
"""
import glob
import http.server
import json
import os
import re
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

USETGO_COMPANY_ID = "68d46f98e4dc5dd472e33655"
USETGO_UID = "ui-sid-888"
STOREFRONT_DIR = os.path.abspath(f"./storefronts/{USETGO_UID}")
COPY_SCRIPT = os.path.abspath("./copy_d2c_files.sh")

HTTP_PORT = 8765
# Lighthouse thresholds. Local Lighthouse has ~3pt variance vs prod CDN.
# Tighter on A11y (deterministic), looser on Perf (depends on local network).
LH_MIN_PERFORMANCE = 85
LH_MIN_ACCESSIBILITY = 100
LH_MIN_BEST_PRACTICES = 95
LH_MIN_SEO = 100

# ANSI colors
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
NC = "\033[0m"

passed = 0
failed = 0
errors = []


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


# ─── Step 1: Clean storefront dir ───────────────────────────────────────────
def step_clean():
    step("Step 1/4: Clean local storefront dir")
    if os.path.exists(STOREFRONT_DIR):
        shutil.rmtree(STOREFRONT_DIR)
        ok(f"cleaned {STOREFRONT_DIR}")
    else:
        ok(f"already clean: {STOREFRONT_DIR}")


# ─── Step 2: Login + regenerate via local API ───────────────────────────────
def step_regenerate():
    step("Step 2/4: Trigger regen via local SAM API")

    if not ADMIN_PASSWORD:
        fail("ADMIN_PASSWORD env var not set — cannot log in as admin")
        return

    # Login
    try:
        r = requests.post(
            f"{API_URL}/accounts/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        if r.status_code != 200:
            fail(f"admin login failed: {r.status_code} {r.text[:200]}")
            return
        token = r.json().get("token") or r.json().get("accessToken")
        if not token:
            fail(f"login response missing token: {r.json()}")
            return
        ok("admin login")
    except Exception as e:
        fail(f"admin login error: {e}")
        return

    # Regenerate uSetGo
    try:
        r = requests.post(
            f"{API_URL}/accounts/{USETGO_COMPANY_ID}/regenerate",
            headers={"Authorization": f"Bearer {token}"},
            timeout=120,
        )
        if r.status_code not in (200, 201, 202, 204):
            fail(f"regenerate failed: {r.status_code} {r.text[:200]}")
            return
        ok(f"regen API returned {r.status_code}")
    except Exception as e:
        fail(f"regen request error: {e}")
        return

    # Copy from Lambda container to host filesystem
    try:
        r = subprocess.run(
            [COPY_SCRIPT, USETGO_UID],
            check=False, capture_output=True, text=True, timeout=60,
        )
        if r.returncode != 0:
            fail(f"copy_d2c_files.sh failed: {r.stderr[:300]}")
            return
        if not os.path.isdir(f"{STOREFRONT_DIR}/products"):
            fail(f"copy succeeded but {STOREFRONT_DIR}/products is missing")
            return
        ok(f"files copied to {STOREFRONT_DIR}")
    except Exception as e:
        fail(f"copy script error: {e}")
        return


# ─── Step 3: JSON-LD schema validation ──────────────────────────────────────
def step_schema():
    step("Step 3/4: Schema validation (JSON-LD on every PDP)")

    pdps = sorted(glob.glob(f"{STOREFRONT_DIR}/products/*.html"))
    if not pdps:
        fail(f"no PDPs found in {STOREFRONT_DIR}/products — regen probably failed silently")
        return

    json_ld_re = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.DOTALL)

    parse_failures = 0
    missing_field_failures = 0
    rating_mismatch_failures = 0

    for pdp in pdps:
        with open(pdp, encoding="utf-8") as fp:
            html = fp.read()
        blocks = json_ld_re.findall(html)
        if not blocks:
            fail(f"{os.path.basename(pdp)}: no JSON-LD blocks found")
            parse_failures += 1
            continue

        for i, block in enumerate(blocks):
            try:
                d = json.loads(block)
            except json.JSONDecodeError as e:
                fail(f"{os.path.basename(pdp)} block {i+1}: invalid JSON — {e}")
                parse_failures += 1
                continue

            t = d.get("@type")
            if t == "Product":
                for required in ("name", "offers", "brand"):
                    if not d.get(required):
                        fail(f"{os.path.basename(pdp)}: Product missing '{required}'")
                        missing_field_failures += 1

                agg = d.get("aggregateRating")
                reviews = d.get("review", [])
                if agg:
                    for required in ("ratingValue", "reviewCount"):
                        if not agg.get(required):
                            fail(f"{os.path.basename(pdp)}: aggregateRating missing '{required}'")
                            missing_field_failures += 1
                    if not isinstance(reviews, list) or len(reviews) == 0:
                        fail(f"{os.path.basename(pdp)}: aggregateRating present but no review[] array")
                        rating_mismatch_failures += 1
                elif reviews:
                    fail(f"{os.path.basename(pdp)}: review[] present but no aggregateRating")
                    rating_mismatch_failures += 1

    if parse_failures == 0 and missing_field_failures == 0 and rating_mismatch_failures == 0:
        ok(f"all {len(pdps)} PDPs: JSON-LD parses + schema fields present + rating/review consistency")


# ─── Step 4: Lighthouse against served storefront ───────────────────────────
def _start_local_server():
    """Serve storefront dir on HTTP_PORT in a background thread."""
    os.chdir(STOREFRONT_DIR)
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a, **k: None  # quiet
    httpd = socketserver.TCPServer(("", HTTP_PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def _run_lighthouse(url):
    """Run Lighthouse mobile against URL, return scores dict."""
    out = f"/tmp/lh-{int(time.time()*1000)}.json"
    r = subprocess.run(
        [
            "lighthouse", url,
            "--output=json", f"--output-path={out}",
            "--form-factor=mobile", "--throttling-method=simulate",
            "--only-categories=performance,accessibility,best-practices,seo",
            "--chrome-flags=--headless --no-sandbox --disable-gpu",
            "--quiet",
        ],
        capture_output=True, text=True, timeout=180,
    )
    if r.returncode != 0:
        raise Exception(f"lighthouse exit {r.returncode}: {r.stderr[:200]}")
    with open(out) as fp:
        lh = json.load(fp)
    return {
        k: round(lh["categories"].get(k, {}).get("score", 0) * 100)
        for k in ("performance", "accessibility", "best-practices", "seo")
    }


def step_lighthouse():
    step("Step 4/4: Lighthouse (mobile, 1 PDP with reviews + 1 without + listing)")

    if not os.path.exists(STOREFRONT_DIR):
        fail("storefront dir missing — skipping Lighthouse")
        return

    # Find one PDP with reviews and one without (gives us coverage of both code paths)
    pdps = sorted(glob.glob(f"{STOREFRONT_DIR}/products/*.html"))
    pdp_with_reviews = None
    pdp_without_reviews = None
    for p in pdps:
        with open(p, encoding="utf-8") as fp:
            html = fp.read()
        if "aggregateRating" in html and pdp_with_reviews is None:
            pdp_with_reviews = p
        elif "aggregateRating" not in html and pdp_without_reviews is None:
            pdp_without_reviews = p
        if pdp_with_reviews and pdp_without_reviews:
            break

    targets = []
    if pdp_with_reviews:
        targets.append(("PDP with reviews", os.path.basename(pdp_with_reviews)))
    if pdp_without_reviews:
        targets.append(("PDP without reviews", os.path.basename(pdp_without_reviews)))
    targets.append(("Listing", "../products.html"))

    httpd = _start_local_server()
    try:
        for label, rel in targets:
            url = f"http://localhost:{HTTP_PORT}/products/{rel}"
            if rel.startswith("../"):
                url = f"http://localhost:{HTTP_PORT}/{rel[3:]}"
            try:
                scores = _run_lighthouse(url)
            except Exception as e:
                fail(f"{label}: Lighthouse failed — {e}")
                continue

            score_str = f"P{scores['performance']} A{scores['accessibility']} BP{scores['best-practices']} S{scores['seo']}"
            regressions = []
            if scores["accessibility"] < LH_MIN_ACCESSIBILITY:
                regressions.append(f"A11y {scores['accessibility']} < {LH_MIN_ACCESSIBILITY}")
            if scores["performance"] < LH_MIN_PERFORMANCE:
                regressions.append(f"Perf {scores['performance']} < {LH_MIN_PERFORMANCE}")
            if scores["best-practices"] < LH_MIN_BEST_PRACTICES:
                regressions.append(f"BP {scores['best-practices']} < {LH_MIN_BEST_PRACTICES}")
            if scores["seo"] < LH_MIN_SEO:
                regressions.append(f"SEO {scores['seo']} < {LH_MIN_SEO}")

            if regressions:
                fail(f"{label} ({score_str}): {', '.join(regressions)}")
            else:
                ok(f"{label} ({score_str})")
    finally:
        httpd.shutdown()


# ─── Main ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{NC}")
    print(f"{YELLOW}  uSetGo Storefront Pre-Commit Validation{NC}")
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{NC}")

    start = time.time()
    step_clean()
    step_regenerate()
    if failed == 0:
        step_schema()
        step_lighthouse()
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
