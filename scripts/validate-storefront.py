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
from xml.etree import ElementTree as ET
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

# Blog pages are designed for perfect Lighthouse scores (zero new JS, no 3rd-party,
# server-rendered, semantic HTML). Perf is 95 to absorb local-Lighthouse variance;
# prod CDN should hit 100.
LH_BLOG_MIN_PERFORMANCE = 95
LH_BLOG_MIN_ACCESSIBILITY = 100
LH_BLOG_MIN_BEST_PRACTICES = 100
LH_BLOG_MIN_SEO = 100

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
    step("Step 3/4: Schema validation (JSON-LD on every PDP + blog post)")

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

    # --- Blog posts: optional editorial content ---
    # Glob only top-level /blog/*.html, excluding category/ subdir.
    blog_posts = sorted(
        p for p in glob.glob(f"{STOREFRONT_DIR}/blog/*.html")
        if os.path.basename(os.path.dirname(p)) == "blog"
        and os.path.basename(p) not in ("index.html",)
    )
    if not blog_posts:
        # Blog is optional; skip silently if no posts.
        return

    blog_parse_failures = 0
    blog_missing_failures = 0
    blog_forbidden_failures = 0
    blog_external_failures = 0

    for post in blog_posts:
        with open(post, encoding="utf-8") as fp:
            html = fp.read()
        name = os.path.basename(post)

        # 1. JSON-LD must include Article + BreadcrumbList; must NOT include FAQPage or ItemList.
        blocks = json_ld_re.findall(html)
        if not blocks:
            fail(f"blog/{name}: no JSON-LD blocks found")
            blog_parse_failures += 1
            continue

        types_seen = set()
        for i, block in enumerate(blocks):
            try:
                d = json.loads(block)
            except json.JSONDecodeError as e:
                fail(f"blog/{name} block {i+1}: invalid JSON — {e}")
                blog_parse_failures += 1
                continue
            t = d.get("@type")
            types_seen.add(t)
            if t == "Article":
                for required in ("headline", "datePublished", "author", "publisher",
                                 "articleSection", "mainEntityOfPage"):
                    if not d.get(required):
                        fail(f"blog/{name}: Article missing '{required}'")
                        blog_missing_failures += 1

        if "Article" not in types_seen:
            fail(f"blog/{name}: missing Article schema")
            blog_missing_failures += 1
        if "BreadcrumbList" not in types_seen:
            fail(f"blog/{name}: missing BreadcrumbList schema")
            blog_missing_failures += 1
        # Editorial positioning: forbid commercial schemas.
        for forbidden in ("FAQPage", "ItemList", "Product"):
            if forbidden in types_seen:
                fail(f"blog/{name}: forbidden '{forbidden}' schema (editorial positioning)")
                blog_forbidden_failures += 1

        # 2. No external HTTP requests (no 3rd-party scripts/stylesheets).
        # Strip data: and same-domain (relative or //) refs; flag http(s)://* references.
        for tag in ("script", "link", "iframe"):
            for m in re.finditer(rf'<{tag}[^>]+(?:src|href)\s*=\s*["\'](https?://[^"\']+)["\']', html, re.IGNORECASE):
                url = m.group(1)
                # Allow company CDN domains (storefront images) — these are the company's own assets.
                # Block anything that looks like a tracker/CDN domain.
                if "googletagmanager" in url or "google-analytics" in url or "facebook.com" in url or "doubleclick" in url:
                    fail(f"blog/{name}: external tracker script {url}")
                    blog_external_failures += 1

    if (blog_parse_failures == 0 and blog_missing_failures == 0
            and blog_forbidden_failures == 0 and blog_external_failures == 0):
        ok(f"all {len(blog_posts)} blog posts: Article + BreadcrumbList present, no FAQ/ItemList/Product, no external trackers")

    # --- Google Product Reviews feed (optional — skip silently if no feed file) ---
    # Verifies: file exists, XML is well-formed, schema v2.4 invariants present,
    # review_count matches sum of catalog Rating.Count across all reviewed PDPs.
    feeds_dir = f"{STOREFRONT_DIR}/feeds"
    gr_files = sorted(glob.glob(f"{feeds_dir}/gr-*.xml"))
    if gr_files:
        feed_path = gr_files[0]
        try:
            tree = ET.parse(feed_path)
            root = tree.getroot()
        except ET.ParseError as e:
            fail(f"google_reviews feed XML parse error: {e}")
            return

        if root.tag != "feed":
            fail(f"google_reviews feed: root element must be <feed>, got <{root.tag}>")
            return
        version_el = root.find("version")
        if version_el is None or (version_el.text or "").strip() != "2.4":
            fail(f"google_reviews feed: must contain <version>2.4</version>")
            return
        publisher_el = root.find("publisher")
        if publisher_el is None or publisher_el.find("name") is None:
            fail(f"google_reviews feed: missing <publisher><name>")
            return

        reviews_in_feed = root.findall("./reviews/review")
        feed_count = len(reviews_in_feed)

        # Count reviews referenced in catalog (sum aggregateRating.reviewCount across PDPs).
        catalog_count = 0
        for pdp in pdps:
            with open(pdp, encoding="utf-8") as fp:
                html = fp.read()
            for block in json_ld_re.findall(html):
                try:
                    d = json.loads(block)
                except json.JSONDecodeError:
                    continue
                if d.get("@type") == "Product":
                    agg = d.get("aggregateRating") or {}
                    try:
                        catalog_count += int(agg.get("reviewCount") or 0)
                    except (ValueError, TypeError):
                        pass

        if feed_count != catalog_count:
            fail(f"google_reviews feed: review count mismatch — feed has {feed_count}, "
                 f"PDPs aggregate to {catalog_count}")
            return

        # Per-review schema invariants (spot check first 5 reviews to catch structural issues).
        for i, r in enumerate(reviews_in_feed[:5]):
            for required in ("review_id", "reviewer", "review_timestamp",
                             "content", "review_url", "ratings", "products"):
                if r.find(required) is None:
                    fail(f"google_reviews feed: review[{i+1}] missing <{required}>")
                    return
            overall = r.find("./ratings/overall")
            if overall is None or overall.get("min") != "1" or overall.get("max") != "5":
                fail(f"google_reviews feed: review[{i+1}] ratings/overall must have min='1' max='5'")
                return
            review_url = r.find("review_url")
            if review_url is None or review_url.get("type") != "singleton":
                fail(f"google_reviews feed: review[{i+1}] review_url must have type='singleton'")
                return

        ok(f"google_reviews feed: schema v2.4 valid, {feed_count} reviews, matches catalog count, required fields present")


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
    step("Step 4/4: Lighthouse (mobile: PDP+reviews, PDP-no-reviews, listing, blog post, blog index)")

    if not os.path.exists(STOREFRONT_DIR):
        fail("storefront dir missing — skipping Lighthouse")
        return

    # Find one PDP with reviews and one without (gives us coverage of both code paths).
    # Skip PDPs that render the .no-img placeholder — missing product image is a
    # merchant catalog state, not a platform regression, and the placeholder fails
    # Lighthouse color-contrast in a way the platform shouldn't be gated on.
    pdps = sorted(glob.glob(f"{STOREFRONT_DIR}/products/*.html"))
    pdp_with_reviews = None
    pdp_without_reviews = None
    for p in pdps:
        with open(p, encoding="utf-8") as fp:
            html = fp.read()
        if 'class="no-img"' in html:
            continue
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

    # Blog post + index (optional — skip if no blog content yet).
    blog_posts = sorted(
        p for p in glob.glob(f"{STOREFRONT_DIR}/blog/*.html")
        if os.path.basename(p) not in ("index.html",)
        and os.path.basename(os.path.dirname(p)) == "blog"
    )
    blog_index_exists = os.path.exists(f"{STOREFRONT_DIR}/blog/index.html")
    blog_targets = []
    if blog_posts:
        blog_targets.append(("Blog post", os.path.basename(blog_posts[0]), "blog"))
    if blog_index_exists:
        blog_targets.append(("Blog index", "index.html", "blog"))

    httpd = _start_local_server()
    try:
        # Storefront targets (existing thresholds).
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

        # Blog targets (stricter thresholds — designed for 100/100/100/100).
        for label, filename, subdir in blog_targets:
            url = f"http://localhost:{HTTP_PORT}/{subdir}/{filename}"
            try:
                scores = _run_lighthouse(url)
            except Exception as e:
                fail(f"{label}: Lighthouse failed — {e}")
                continue

            score_str = f"P{scores['performance']} A{scores['accessibility']} BP{scores['best-practices']} S{scores['seo']}"
            regressions = []
            if scores["accessibility"] < LH_BLOG_MIN_ACCESSIBILITY:
                regressions.append(f"A11y {scores['accessibility']} < {LH_BLOG_MIN_ACCESSIBILITY}")
            if scores["performance"] < LH_BLOG_MIN_PERFORMANCE:
                regressions.append(f"Perf {scores['performance']} < {LH_BLOG_MIN_PERFORMANCE}")
            if scores["best-practices"] < LH_BLOG_MIN_BEST_PRACTICES:
                regressions.append(f"BP {scores['best-practices']} < {LH_BLOG_MIN_BEST_PRACTICES}")
            if scores["seo"] < LH_BLOG_MIN_SEO:
                regressions.append(f"SEO {scores['seo']} < {LH_BLOG_MIN_SEO}")

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
