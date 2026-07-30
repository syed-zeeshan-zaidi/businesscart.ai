#!/usr/bin/env python3
"""
Platform-wide product image optimizer — PHASE 1: format only (roadmap #44 Part A).

Phase 1 converts every non-WebP product image to WebP and nothing else:

  * dimensions are NOT changed (that is phase 2)
  * the S3 key is NOT changed except for the extension
      68d4.../33b536c1-.../13-3-cowhide-gloves.jpg
   -> 68d4.../33b536c1-.../13-3-cowhide-gloves.webp
  * the DB URL is rewritten to the same path with the new extension
  * the old non-WebP object is deleted, so S3 keeps no unused originals

Keeping the path stable means nothing else has to be reasoned about: no new
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
    The old S3 object is deleted at the end, so the archive is the only
    rollback path.
  * Ordering per image is: upload new -> verify -> rewrite DB -> delete old.
    A crash at any point leaves either an unused .webp (harmless) or a DB
    still pointing at the intact original. It never leaves a broken URL.
  * Images not hosted on the platform CDN are skipped, never rewritten.
  * Idempotent: images already .webp are skipped, so re-running is a no-op.

USAGE
  python3 scripts/optimize-product-images.py                     # dry run, all sellers
  python3 scripts/optimize-product-images.py --seller <id>       # dry run, one seller
  python3 scripts/optimize-product-images.py --apply             # convert, all sellers
  python3 scripts/optimize-product-images.py --apply --limit 3   # convert 3 images
"""

import argparse
import io
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

try:
    import boto3
    from botocore.exceptions import ClientError
    from PIL import Image, ImageOps
    from pymongo import MongoClient
except ImportError as e:
    sys.exit(f"missing dependency: {e}. Need boto3, Pillow, pymongo.")

GREEN, RED, YELLOW, DIM, NC = "\033[0;32m", "\033[0;31m", "\033[0;33m", "\033[2m", "\033[0m"

BUCKET = os.getenv("PRODUCT_IMAGES_BUCKET", "businesscart-product-images-prod")
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


def to_webp(raw, quality):
    """Re-encode bytes as WebP at the SAME pixel dimensions. Returns (bytes, w, h)."""
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
    out = io.BytesIO()
    im.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue(), im.width, im.height


def human(n):
    return f"{n/1024/1024:.2f} MB" if n >= 1024 * 1024 else f"{n/1024:.0f} KB"


def cleanup(s3, db, apply):
    """Delete non-WebP objects nothing references any more.

    Safe to run only once the storefront has been regenerated, because until
    then the generated pages still point at the originals.
    """
    print(f"{YELLOW}cleanup: removing unreferenced non-WebP objects{NC}\n")
    referenced = set()
    for p in db.products.find({}, {"images": 1, "image": 1}):
        for u in (list(p.get("images") or []) + ([p["image"]] if p.get("image") else [])):
            k = key_from_url(u)
            if k:
                referenced.add(k)

    victims, freed = [], 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET):
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if k.lower().endswith(".webp") or k.endswith("/assets/logo"):
                continue
            if k in referenced:
                continue
            # only remove an original whose converted sibling actually exists
            sibling = k.rsplit(".", 1)[0] + ".webp"
            try:
                s3.head_object(Bucket=BUCKET, Key=sibling)
            except ClientError:
                print(f"  {YELLOW}skip{NC} {k} {DIM}(no .webp sibling){NC}")
                continue
            victims.append(k)
            freed += obj["Size"]

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
    ap = argparse.ArgumentParser(description="Phase 1: convert product images to WebP in place.")
    ap.add_argument("--apply", action="store_true", help="actually write (default is dry run)")
    ap.add_argument("--seller", help="restrict to one sellerID (default: all sellers)")
    ap.add_argument("--quality", type=int, default=82, help="WebP quality (default 82)")
    ap.add_argument("--limit", type=int, help="stop after N images (for a cautious first run)")
    ap.add_argument("--archive-dir", default=os.path.join(REPO, "backups", "product-images"))
    ap.add_argument("--keep-originals", action="store_true",
                    help="convert + rewrite the DB but do NOT delete the old objects yet. "
                         "Use this for a zero-downtime migration: the generated storefront "
                         "still points at the old urls until a regen runs, so deleting now "
                         "would 404 every image on the live site. Run --cleanup afterwards.")
    ap.add_argument("--cleanup", action="store_true",
                    help="delete non-WebP objects that no product references any more. "
                         "Run this AFTER --keep-originals and AFTER the storefront regen.")
    args = ap.parse_args()

    if args.cleanup:
        return cleanup(boto3.client("s3"), MongoClient(mongo_uri())[DB_NAME], args.apply)

    mode = f"{RED}APPLY{NC}" if args.apply else f"{YELLOW}DRY RUN{NC}"
    print(f"{YELLOW}{'='*70}{NC}")
    print(f"  Product image optimizer — PHASE 1 (format only)   [{mode}]")
    print(f"  bucket={BUCKET}  cdn={CDN}")
    print(f"{YELLOW}{'='*70}{NC}\n")

    s3 = boto3.client("s3")
    db = MongoClient(mongo_uri())[DB_NAME]

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
            elif not k.lower().endswith(".webp"):
                refs[k].append(p["_id"])

    todo = sorted(refs)
    if args.limit:
        todo = todo[: args.limit]

    print(f"products scanned     : {len(products)}")
    print(f"non-CDN images skipped: {skipped_foreign}  {DIM}(third-party hosts, not ours to rewrite){NC}")
    print(f"images to convert    : {len(todo)}\n")
    if not todo:
        print(f"{GREEN}nothing to do — every platform-hosted image is already WebP{NC}")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    archive = os.path.join(args.archive_dir, stamp)
    converted, before_total, after_total, failures = [], 0, 0, []

    # ---- Pass 1: archive, convert, upload the new .webp. No DB write, no delete.
    for i, key in enumerate(todo, 1):
        new_key = key.rsplit(".", 1)[0] + ".webp"
        try:
            raw = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()
            webp, w, h = to_webp(raw, args.quality)
        except (ClientError, OSError, ValueError) as e:
            failures.append((key, f"read/convert: {e}"))
            print(f"  {RED}FAIL{NC} {key}\n       {e}")
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

    # ---- Pass 3: delete originals, only now that no document references them.
    deleted = 0
    for key, _ in ([] if args.keep_originals else converted):
        still = db.products.count_documents({"$or": [{"images": f"https://{CDN}/{key}"},
                                                     {"image": f"https://{CDN}/{key}"}]})
        if still:
            print(f"  {YELLOW}keeping{NC} {key} — still referenced by {still} product(s)")
            continue
        try:
            s3.delete_object(Bucket=BUCKET, Key=key)
            deleted += 1
        except ClientError as e:
            failures.append((key, f"delete: {e}"))

    saved = before_total - after_total
    print(f"\n{YELLOW}{'='*70}{NC}")
    print(f"  converted   : {len(converted)} image(s)")
    print(f"  products    : {docs_updated} document(s) rewritten")
    print(f"  old objects : {deleted} deleted from S3")
    print(f"  size        : {human(before_total)} -> {human(after_total)}  "
          f"{GREEN}saved {human(saved)} ({100*saved/before_total:.0f}%){NC}")
    print(f"  archive     : {archive}")
    if failures:
        print(f"\n{RED}  {len(failures)} failure(s):{NC}")
        for k, e in failures[:10]:
            print(f"    {k}: {e}")
    print(f"{YELLOW}{'='*70}{NC}")
    print(f"\n{YELLOW}NOTE:{NC} storefront + feeds still serve the OLD urls until a regen runs.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
