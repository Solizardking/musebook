#!/usr/bin/env python3
"""Sync a local directory to a repo path prefix via the Git Data API.

Usage: push_dir_to_github.py <local_dir> <repo_prefix> <commit_message> [--dry-run]

- Idempotent: predicts git blob SHAs locally (hash-object semantics) and only
  uploads files that are new or changed (uploads run in parallel).
- Handles deletions: repo blobs under <repo_prefix> with no local counterpart
  are removed (sha: null tree entries).
- Never force-pushes: ref update is a fast-forward against the fetched head;
  on a race (422) it refetches head and retries once.
- Auth: ~/workspace/skills/github/bin/gh_api.py (surrogate, token never printed).
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

GH = os.path.expanduser("~/workspace/skills/github/bin/gh_api.py")
OWNER, REPO, BRANCH = "Solizardking", "musebook", "main"
WORKERS = 8


def gh(method, path, payload=None):
    cmd = [sys.executable, GH, method, path]
    inp = None
    if payload is not None:
        cmd += ["-"]
        inp = json.dumps(payload)
    out = subprocess.run(cmd, input=inp, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"gh_api failed ({method} {path}): {out.stderr.strip() or out.stdout.strip()}")
    return json.loads(out.stdout)


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def get_head():
    ref = gh("GET", f"/repos/{OWNER}/{REPO}/git/refs/heads/{BRANCH}")
    head = ref["object"]["sha"]
    commit = gh("GET", f"/repos/{OWNER}/{REPO}/git/commits/{head}")
    return head, commit["tree"]["sha"]


def repo_blobs_under(prefix):
    tree = gh("GET", f"/repos/{OWNER}/{REPO}/git/trees/{BRANCH}?recursive=1")
    if tree.get("truncated"):
        sys.exit("recursive tree truncated; refusing to sync (deletion set would be unsafe)")
    pfx = prefix.rstrip("/") + "/"
    out = {}
    for e in tree.get("tree", []):
        if e["type"] == "blob" and e["path"].startswith(pfx):
            out[e["path"][len(pfx):]] = e["sha"]
    return out


def local_files(local_dir):
    out = {}
    for root, _, files in os.walk(local_dir):
        for f in files:
            p = os.path.join(root, f)
            with open(p, "rb") as fh:
                out[os.path.relpath(p, local_dir)] = fh.read()
    return out


def upload_blob(args):
    prefix, rel, data = args
    b = gh("POST", f"/repos/{OWNER}/{REPO}/git/blobs",
           {"content": base64.b64encode(data).decode(), "encoding": "base64"})
    return {"path": f"{prefix}/{rel}", "mode": "100644", "type": "blob", "sha": b["sha"]}


def attempt(local_dir, prefix, message, dry_run):
    head, base_tree = get_head()
    current = repo_blobs_under(prefix)
    local = local_files(local_dir)
    changed = [(rel, data) for rel, data in sorted(local.items())
               if current.get(rel) != blob_sha(data)]
    deleted = sorted(rel for rel in current if rel not in local)
    stats = {"new": sum(1 for rel, _ in changed if rel not in current),
             "changed": sum(1 for rel, _ in changed if rel in current),
             "deleted": len(deleted),
             "unchanged": len(local) - len(changed)}
    print(f"stats: {stats}", flush=True)
    if dry_run:
        print(f"dry-run: would push {len(changed) + len(deleted)} tree entries")
        return None
    if not changed and not deleted:
        print("no changes; repo already current")
        return None
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        entries = list(ex.map(upload_blob,
                              [(prefix, rel, data) for rel, data in changed]))
    entries += [{"path": f"{prefix}/{rel}", "mode": "100644",
                 "type": "blob", "sha": None} for rel in deleted]
    new_tree = gh("POST", f"/repos/{OWNER}/{REPO}/git/trees",
                  {"base_tree": base_tree, "tree": entries})
    new_commit = gh("POST", f"/repos/{OWNER}/{REPO}/git/commits",
                    {"message": message, "tree": new_tree["sha"], "parents": [head]})
    try:
        gh("PATCH", f"/repos/{OWNER}/{REPO}/git/refs/heads/{BRANCH}",
           {"sha": new_commit["sha"]})
    except SystemExit as e:
        if "422" in str(e):
            print("race on ref update; refetching head and retrying once", flush=True)
            return "retry"
        raise
    print(f"pushed commit {new_commit['sha']}", flush=True)
    return new_commit["sha"]


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in sys.argv[1:]
    if len(args) != 3:
        sys.exit("usage: push_dir_to_github.py <local_dir> <repo_prefix> <commit_message> [--dry-run]")
    local_dir, prefix, message = args
    for _ in range(2):
        r = attempt(local_dir, prefix, message, dry_run)
        if r != "retry":
            return
    sys.exit("ref race on second attempt; aborting")


if __name__ == "__main__":
    main()
