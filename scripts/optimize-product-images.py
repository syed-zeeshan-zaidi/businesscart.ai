#!/usr/bin/env python3
"""
Platform-wide product image optimizer — format AND size (roadmap #44 Part A).

It brings every platform-hosted product image to WebP AND within the size
budget:

  * non-WebP is re-encoded to WebP
      68d4.../33b536c1-.../13-3-cowhide-gloves.jpg
   -> 68d4.../33b536c1-.../13-3-cowhide-gloves.webp
  * anything over MAX_BYTES is downscaled to MAX_LONG_EDGE and re-encoded,
    including images that are ALREADY WebP. A resized WebP gets a fresh 8-hex
    suffix rather than overwriting in place, because overwriting the same key
    leaves CloudFront serving the cached old bytes until its TTL expires.
  * nothing is ever upscaled
  * the DB URL is rewritten to the new object
  * the old object is KEPT until --cleanup runs after a regen

Rewriting to a new key means nothing else has to be reasoned about: no new
UUIDs, no key-convention drift, no CloudFront invalidation beyond the changed
object, and a diff of the DB shows only ".jpg" -> ".webp".

Runs at PLATFORM level across every seller, because image weight is a platform
guarantee rather than something each merchant should have to manage. Talks to
Mongo and S3 directly: the presigned upload API derives the object key from the
CALLER's JWT, so an operator running this through it would file every company's
images under the operator's own prefix.

SAFETY
  * --dry-run is the DEFAULT. --apply is required to write anything.
  * Every original is downloaded to an archive directory BEFORE any write.
    The old S3 object is left in place by this command, so both the archive
    and the original object are rollback paths until --cleanup runs.
  * Ordering per image is: upload new -> verify -> rewrite DB. A crash at any
    point leaves either an unused .webp (harmless) or a DB still pointing at
    the intact original, so the DB never points at a missing object.
  * Originals are KEPT by default. The generated storefront and the shopping
    feeds are static artifacts that keep serving the OLD urls until a regen
    runs, so deleting in the same pass would 404 every product image on the
    live site in the meantime. Regenerate, then run --cleanup. Deleting in one
    pass is available via --delete-originals for the case where nothing static
    references the images.
  * Images not hosted on the platform CDN are skipped, never rewritten.
  * Selects on FORMAT and on WEIGHT. Phase 1 selected on format alone, so an
    image already converted to WebP was skipped however heavy it was, which is
    how a 689 KB .webp hero survived the sweep and kept failing Lighthouse.
  * Idempotent: an image that is already WebP and within the size budget is
    skipped, and a re-encode that gains less than MIN_GAIN is refused, so the
    sweep converges to a no-op instead of churning new keys forever.

USAGE
  python3 scripts/optimize-product-images.py                     # dry run, all sellers
  python3 scripts/optimize-product-images.py --seller <id>       # dry run, one seller
  python3 scripts/optimize-product-images.py --apply             # convert, all sellers
  #   ... then REGENERATE the storefront (required) ...
  python3 scripts/optimize-product-images.py --cleanup --apply   # reclaim the originals
  python3 scripts/optimize-product-images.py --apply --limit 3   # convert 3 images
"""

import argparse
import io
import uuid
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

try:
    import boto3
    from botocore.exceptions import ClientError
    from PIL import Image, ImageOps
    from pymongo import MongoClient
except ImportError as e:
    sys.exit(f"missing dependency: {e}. Need boto3, Pillow, pymongo.")

GREEN, RED, YELLOW, DIM, NC = "\033[0;32m", "\033[0;31m", "\033[0;33m", "\033[2m", "\033[0m"

BUCKET = os.getenv("PRODUCT_IMAGES_BUCKET", "businesscart-product-images-prod")

# Phase 2 targets (Roadmap #44 Part A).
#
# 1290 px long edge: product.html renders the hero at width=645 height=645 with
# fetchpriority=high (it IS the LCP element) and there is NO srcset, so the same
# file also serves the 64x64 thumbnails and the 300x300 related cards. It must be
# sized for the largest consumer, 645 CSS px x 2 for retina. Clicking a thumbnail
# swaps it into that same 645 px slot, so nothing needs more resolution.
MAX_LONG_EDGE = 1290
# Above this an image is worth re-encoding even if it is already WebP. Byte size
# is the operative metric because it is what LCP actually pays; dimensions matter
# only in so far as they drive it. It is also readable from S3 metadata without
# downloading the body, which is what keeps the scan cheap.
MAX_BYTES = 200 * 1024
# Re-encoding that barely helps is not worth a new object and a DB write. Without
# this floor an image that can never get under MAX_BYTES would be rewritten to a
# fresh key on every run, churning S3 and the database forever.
MIN_GAIN = 0.05
# An unreferenced object younger than this is not treated as garbage: a presigned
# upload reaches the bucket before the product row that will point at it.
UNREFERENCED_GRACE_DAYS = 7
CDN = os.getenv("PRODUCT_IMAGES_CDN", "d10v0xlzz7lzsq.cloudfront.net")
DB_NAME = "ProductService"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Pillow needs an explicit decoder bomb ceiling for large merchant photos.
Image.MAX_IMAGE_PIXELS = 200_000_000


def mongo_uri():
    """Read the catalog URI from local.env.json. Never printed or logged."""
    with open(os.path.join(REPO, "local.env.json")) as f:
        return json.load(f)["CatalogHandler"]["MONGO_URI"]


def key_from_url(url):
    """Return the S3 key for a platform-CDN URL, or None if hosted elsewhere.

    Third-party hosts (pexels, cloudinary, getty, ...) are deliberately skipped:
    we do not own those objects and must not rewrite those URLs. See #43-G.
    """
    prefix = f"https://{CDN}/"
    if not url or not url.startswith(prefix):
        return None
    key = url[len(prefix):].split("?", 1)[0]
    return key or None


def to_webp(raw, quality, max_edge=None):
    """Re-encode bytes as WebP, optionally downscaled. Returns (bytes, w, h).

    Downscale only: a long edge already at or under max_edge is left alone, and
    nothing is ever upscaled. Enlarging a small image would add bytes and invent
    detail that was never photographed.
    """
    im = Image.open(io.BytesIO(raw))
    # Phone photos carry EXIF rotation that WebP will not preserve; bake it in
    # so the converted image is not silently rotated on the storefront.
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA"):
        pass  # keep alpha; WebP supports it
    elif im.mode == "P" and "transparency" in im.info:
        im = im.convert("RGBA")
    else:
        im = im.convert("RGB")
    if max_edge:
        longest = max(im.width, im.height)
        if longest > max_edge:
            scale = max_edge / longest
            im = im.resize((max(1, round(im.width * scale)),
                            max(1, round(im.height * scale))), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue(), im.width, im.height


def human(n):
    return f"{n/1024/1024:.2f} MB" if n >= 1024 * 1024 else f"{n/1024:.0f} KB"


def scan_unreferenced(s3, db, verbose=False):
    """Originals no product references any more, whose .webp sibling exists.

    Read-only. Shared by --cleanup and by the startup banner, so that forgetting
    to reclaim after a convert run surfaces on the NEXT run of the script rather
    than sitting in S3 costing money unnoticed.
    """
    # EVERY collection that can point at an object in this bucket, not just
    # products. blog_posts.featuredImage is uploaded through the same presigned
    # route and lands in the same bucket; no post carries one today, but the field
    # is supported, so a products-only scan would eventually delete a live blog
    # image. A deletion pass must be told about every referrer, not the one that
    # happens to be populated.
    referenced = set()
    for p in db.products.find({}, {"images": 1, "image": 1}):
        for u in (list(p.get("images") or []) + ([p["image"]] if p.get("image") else [])):
            k = key_from_url(u)
            if k:
                referenced.add(k)
    for b in db.blog_posts.find({}, {"featuredImage": 1}):
        k = key_from_url(b.get("featuredImage") or "")
        if k:
            referenced.add(k)

    # An unreferenced object must also be OLD. A presigned upload lands in the
    # bucket before the product that will point at it is saved, so a just-arrived
    # object is not garbage, it is a merchant mid-edit.
    cutoff = datetime.now(timezone.utc) - timedelta(days=UNREFERENCED_GRACE_DAYS)

    victims, freed = [], 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET):
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if k.endswith("/assets/logo") or k in referenced:
                continue
            if obj["LastModified"] > cutoff:
                if verbose:
                    print(f"  {YELLOW}skip{NC} {k} {DIM}(uploaded in the last "
                          f"{UNREFERENCED_GRACE_DAYS}d, may be mid-edit){NC}")
                continue
            # A non-WebP original is only garbage once its converted form exists.
            # A superseded WebP has no extension sibling to check: it was replaced
            # by a differently-named WebP, and being unreferenced AND old is the
            # evidence. Phase 2 creates exactly those, so skipping .webp here
            # (which Phase 1 did) would leak every image it ever resized.
            if not k.lower().endswith(".webp"):
                try:
                    s3.head_object(Bucket=BUCKET, Key=k.rsplit(".", 1)[0] + ".webp")
                except ClientError:
                    if verbose:
                        print(f"  {YELLOW}skip{NC} {k} {DIM}(no .webp sibling){NC}")
                    continue
            victims.append(k)
            freed += obj["Size"]
    return victims, freed


def cleanup(s3, db, apply):
    """Delete non-WebP objects nothing references any more.

    Safe to run only once the storefront has been regenerated, because until
    then the generated pages still point at the originals.
    """
    print(f"{YELLOW}cleanup: removing unreferenced non-WebP objects{NC}\n")
    victims, freed = scan_unreferenced(s3, db, verbose=True)

    print(f"  unreferenced originals with a .webp sibling: {len(victims)}  ({human(freed)})")
    if not apply:
        for k in victims[:10]:
            print(f"    would delete {k}")
        print(f"\n{YELLOW}DRY RUN — nothing deleted. Re-run with --apply.{NC}")
        return 0
    for k in victims:
        s3.delete_object(Bucket=BUCKET, Key=k)
    print(f"\n{GREEN}deleted {len(victims)} object(s), freed {human(freed)}{NC}")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Convert product images to WebP and bring them within the size budget.")
    ap.add_argument("--apply", action="store_true", help="actually write (default is dry run)")
    ap.add_argument("--seller", help="restrict to one sellerID (default: all sellers)")
    ap.add_argument("--quality", type=int, default=82, help="WebP quality (default 82)")
    ap.add_argument("--limit", type=int, help="stop after N images (for a cautious first run)")
    ap.add_argument("--archive-dir", default=os.path.join(REPO, "backups", "product-images"))
    # There is deliberately NO flag to delete originals during a convert run.
    # It used to be the default, with --keep-originals as the opt-out, which is
    # backwards: the generated storefront and the shopping feeds are static
    # artifacts still serving the OLD urls until a regen runs, so the default run
    # 404'd every product image on the live site. Regenerating is a required step
    # between converting and reclaiming the space, so it is not offered as a
    # choice at all. Convert -> regen -> --cleanup.
    ap.add_argument("--cleanup", action="store_true",
                    help="delete the originals, once no product references them any more. "
                         "Run this ONLY after the storefront has been regenerated: until "
                         "then the generated pages and feeds still serve the old urls.")
    args = ap.parse_args()

    if args.cleanup:
        return cleanup(boto3.client("s3"), MongoClient(mongo_uri())[DB_NAME], args.apply)

    mode = f"{RED}APPLY{NC}" if args.apply else f"{YELLOW}DRY RUN{NC}"
    print(f"{YELLOW}{'='*70}{NC}")
    print(f"  Product image optimizer — format + size   [{mode}]")
    print(f"  bucket={BUCKET}  cdn={CDN}")
    print(f"{YELLOW}{'='*70}{NC}\n")

    s3 = boto3.client("s3")
    db = MongoClient(mongo_uri())[DB_NAME]

    # Anything a PREVIOUS run converted but never reclaimed. Surfaced on every
    # invocation, including a plain dry run, because the reclaim step is manual
    # and easy to forget: originals then sit in S3 costing money with nothing
    # pointing at them and nothing saying so.
    try:
        pending, pending_bytes = scan_unreferenced(s3, db)
        if pending:
            print(f"{RED}PENDING CLEANUP:{NC} {len(pending)} original(s) from an earlier run are "
                  f"unreferenced and still in S3 ({human(pending_bytes)}).")
            print(f"  Reclaim them with:  python3 {os.path.basename(__file__)} --cleanup --apply\n")
    except ClientError as e:
        print(f"{YELLOW}could not check for pending cleanup: {e}{NC}\n")

    q = {"sellerID": args.seller} if args.seller else {}
    products = list(db.products.find(q, {"name": 1, "sellerID": 1, "images": 1, "image": 1}))

    # A key can be shared by several products, so convert each key once and
    # rewrite every document that references it.
    refs = defaultdict(list)      # key -> [product _id, ...]
    skipped_foreign = 0
    for p in products:
        urls = list(p.get("images") or [])
        if p.get("image"):
            urls.append(p["image"])
        for u in urls:
            k = key_from_url(u)
            if k is None:
                skipped_foreign += 1
            else:
                refs[k].append(p["_id"])

    # Phase 1 selected on FORMAT alone, so an image already converted to WebP was
    # skipped no matter how heavy it was. That is how a 689 KB .webp hero survived
    # the sweep and kept failing Lighthouse. Phase 2 selects on weight too, read
    # from S3 metadata with head_object so nothing is downloaded to decide.
    todo, oversize, already_ok = [], 0, 0
    for k in sorted(refs):
        is_webp = k.lower().endswith(".webp")
        try:
            size = s3.head_object(Bucket=BUCKET, Key=k)["ContentLength"]
        except ClientError:
            # Referenced by a product but missing from the bucket. Not ours to
            # fix here, and downloading it would fail anyway.
            continue
        if not is_webp:
            todo.append(k)
        elif size > MAX_BYTES:
            todo.append(k)
            oversize += 1
        else:
            already_ok += 1

    todo = sorted(todo)
    if args.limit:
        todo = todo[: args.limit]

    print(f"products scanned     : {len(products)}")
    print(f"non-CDN images skipped: {skipped_foreign}  {DIM}(third-party hosts, not ours to rewrite){NC}")
    print(f"already compliant    : {already_ok}  {DIM}(WebP and <= {human(MAX_BYTES)}){NC}")
    print(f"images to process    : {len(todo)}  {DIM}({oversize} already WebP but over {human(MAX_BYTES)}){NC}\n")
    if not todo:
        print(f"{GREEN}nothing to do — every platform-hosted image is WebP and within budget{NC}")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    archive = os.path.join(args.archive_dir, stamp)
    converted, before_total, after_total, failures = [], 0, 0, []

    # ---- Pass 1: archive, convert, upload the new .webp. No DB write, no delete.
    for i, key in enumerate(todo, 1):
        # A resized WebP keeps the .webp extension, so swapping the extension
        # would produce the SAME key: we would overwrite the object in place and
        # CloudFront would keep serving the cached old bytes until its TTL. A
        # fresh name means a new URL, so the change is live immediately and no
        # invalidation is needed. Matches the platform key convention.
        stem, _, ext = key.rpartition(".")
        if ext.lower() == "webp":
            new_key = f"{stem}-{uuid.uuid4().hex[:8]}.webp"
        else:
            new_key = f"{stem}.webp"
        try:
            raw = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()
            webp, w, h = to_webp(raw, args.quality, MAX_LONG_EDGE)
        except (ClientError, OSError, ValueError) as e:
            failures.append((key, f"read/convert: {e}"))
            print(f"  {RED}FAIL{NC} {key}\n       {e}")
            continue

        # Refuse a rewrite that does not earn itself. Without this an image that
        # can never get under MAX_BYTES would be rewritten to a fresh key on
        # every run, churning S3 and the database forever, and the sweep would
        # never become a no-op.
        if raw and (1 - len(webp) / len(raw)) < MIN_GAIN:
            print(f"  [{i}/{len(todo)}] {DIM}skip{NC} {human(len(raw))} -> {human(len(webp))} "
                  f"(under {MIN_GAIN:.0%} gain, leaving it alone)  "
                  f"{DIM}{key.split('/')[-1][:44]}{NC}")
            continue

        before_total += len(raw)
        after_total += len(webp)
        pct = 100 * (1 - len(webp) / len(raw)) if raw else 0
        print(f"  [{i}/{len(todo)}] {human(len(raw)):>9} -> {human(len(webp)):>9} "
              f"({pct:4.0f}% smaller, {w}x{h})  {DIM}{key.split('/')[-1][:52]}{NC}")

        if not args.apply:
            converted.append((key, new_key))
            continue

        try:
            dest = os.path.join(archive, key)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:      # archive BEFORE anything destructive
                f.write(raw)
            s3.put_object(Bucket=BUCKET, Key=new_key, Body=webp, ContentType="image/webp")
            s3.head_object(Bucket=BUCKET, Key=new_key)   # verify it landed
            converted.append((key, new_key))
        except (ClientError, OSError) as e:
            failures.append((key, f"archive/upload: {e}"))
            print(f"       {RED}upload failed: {e}{NC}")

    if not args.apply:
        saved = before_total - after_total
        print(f"\n{YELLOW}DRY RUN — nothing written.{NC}")
        print(f"  would convert {len(converted)} image(s): "
              f"{human(before_total)} -> {human(after_total)}  "
              f"{GREEN}saving {human(saved)} ({100*saved/before_total:.0f}%){NC}")
        print(f"\n  re-run with --apply to write.")
        return 0

    # ---- Pass 2: rewrite DB URLs, one $set per product.
    rewritten = {k: f"https://{CDN}/{nk}" for k, nk in converted}
    touched, docs_updated = set(), 0
    for pid in {pid for k, _ in converted for pid in refs[k]}:
        doc = db.products.find_one({"_id": pid}, {"images": 1, "image": 1})
        if not doc:
            continue
        upd = {}
        imgs = list(doc.get("images") or [])
        new_imgs = [rewritten.get(key_from_url(u) or "", u) for u in imgs]
        if new_imgs != imgs:
            upd["images"] = new_imgs
        cur = doc.get("image")
        if cur:
            nxt = rewritten.get(key_from_url(cur) or "", cur)
            if nxt != cur:
                upd["image"] = nxt
        if upd:
            upd["updatedAt"] = datetime.now(timezone.utc)
            db.products.update_one({"_id": pid}, {"$set": upd})
            docs_updated += 1
            touched.add(pid)

    saved = before_total - after_total
    print(f"\n{YELLOW}{'='*70}{NC}")
    print(f"  converted   : {len(converted)} image(s)")
    print(f"  products    : {docs_updated} document(s) rewritten")
    print(f"  size        : {human(before_total)} -> {human(after_total)}  "
          f"{GREEN}saved {human(saved)} ({100*saved/before_total:.0f}%){NC}")
    print(f"  archive     : {archive}")
    if failures:
        print(f"\n{RED}  {len(failures)} failure(s):{NC}")
        for k, e in failures[:10]:
            print(f"    {k}: {e}")
    print(f"{YELLOW}{'='*70}{NC}")
    print(f"\n{YELLOW}NEXT, AND REQUIRED:{NC} the database now points at the .webp images, but the\n"
          f"  generated storefront and the shopping feeds are static and still serve the OLD\n"
          f"  urls. REGENERATE THE STOREFRONT before anything else, or the site keeps serving\n"
          f"  the originals. The originals are still in S3, so nothing is broken meanwhile.\n"
          f"  Once the regen is done, reclaim the space with:  --cleanup --apply")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
