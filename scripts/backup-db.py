#!/usr/bin/env python3
"""Full backup of the entire MongoDB cluster (all databases) to a local,
timestamped, gzipped mongodump — the recovery point an M0 (free) Atlas tier
does not give you. This is what would have made the order-deletion incident a
30-second restore instead of a manual reconstruction.

  Backup:   python3 scripts/backup-db.py
  Restore:  mongorestore --uri="<MONGO_URI>" --gzip --drop backups/<timestamp>
            (drop only the collection(s) you're restoring; test on a scratch DB first)

Backups land in ./backups/<UTC-timestamp>/ (gitignored — it's the whole prod DB
incl. customer PII). Keeps the most recent KEEP backups, prunes older ones.
"""
import datetime
import os
import re
import shutil
import subprocess
import sys

KEEP = 14           # how many timestamped backups to retain
MIN_INTERVAL_H = 24  # don't take another backup if one exists within this many hours

def newest_backup_age_hours(root):
    """Age (hours) of the most recent backup dir, or None if there are none."""
    if not os.path.isdir(root):
        return None
    newest = None
    for d in os.listdir(root):
        try:
            t = datetime.datetime.strptime(d, "%Y-%m-%dT%H-%M-%SZ").replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            continue
        if newest is None or t > newest:
            newest = t
    if newest is None:
        return None
    return (datetime.datetime.now(datetime.timezone.utc) - newest).total_seconds() / 3600

def mongo_uri():
    uri = None
    for line in open("checkout-service/.env"):
        if line.startswith("MONGO_URI="):
            uri = line.split("=", 1)[1].strip()
            break
    if not uri:
        sys.exit("MONGO_URI not found in checkout-service/.env")
    # Strip any database from the path so mongodump captures the WHOLE cluster
    # (all of AccountService / CheckoutService / ProductService), not just one DB.
    return re.sub(r'(mongodb(?:\+srv)?://[^/]+)/[^?]*', r'\1/', uri)

def main():
    force = "--force" in sys.argv
    uri = mongo_uri()
    root = os.path.abspath("backups")
    os.makedirs(root, exist_ok=True)

    # Throttle: at most one backup per MIN_INTERVAL_H, unless --force.
    age = newest_backup_age_hours(root)
    if age is not None and age < MIN_INTERVAL_H and not force:
        print(f"↷ skipping backup — most recent is {age:.1f}h old "
              f"(< {MIN_INTERVAL_H}h; use --force to override).")
        return

    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    dest = os.path.join(root, ts)

    print(f"▶ backing up entire cluster → backups/{ts}/ (gzip) …")
    r = subprocess.run(
        ["mongodump", f"--uri={uri}", f"--out={dest}", "--gzip"],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        # mongodump writes progress to stderr; only treat a non-zero exit as failure
        print(r.stderr[-800:])
        sys.exit(f"✗ mongodump failed (exit {r.returncode})")

    # Summary: databases + collections captured
    total_files = 0
    total_bytes = 0
    print("✓ captured:")
    for db in sorted(os.listdir(dest)):
        dbdir = os.path.join(dest, db)
        if not os.path.isdir(dbdir):
            continue
        colls = [f for f in os.listdir(dbdir) if f.endswith(".bson.gz")]
        size = sum(os.path.getsize(os.path.join(dbdir, f)) for f in os.listdir(dbdir))
        total_files += len(colls)
        total_bytes += size
        print(f"    {db:18s} {len(colls):2d} collections  ({size/1024:.0f} KB)")
    print(f"  total: {total_files} collections, {total_bytes/1024/1024:.1f} MB → backups/{ts}/")

    # Prune old backups (keep newest KEEP)
    stamps = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)))
    for old in stamps[:-KEEP]:
        shutil.rmtree(os.path.join(root, old), ignore_errors=True)
        print(f"  pruned old backup {old}")

if __name__ == "__main__":
    main()
