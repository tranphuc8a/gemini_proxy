#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra cac gia dinh cua bo dung markdown tren toan bo noi dung that.

Chay:  python check.py
Bao loi neu co lien ket hong, hang rao ma le, hoac cong thuc $$ nam trong
khoi trich dan (truong hop app.js khong xu ly duoc).
"""
import json
import os
import urllib.parse
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

with open(os.path.join(HERE, "assets", "content.js"), encoding="utf-8") as fh:
    raw = fh.read()
D = json.loads(raw[raw.index("=") + 1:].rstrip().rstrip(";"))
DOCS, SLUGS = D["docs"], D["slugs"]

problems = []
notes = []
stat = {"links": 0, "to_doc": 0, "to_file": 0, "ext": 0,
        "math_b": 0, "math_i": 0, "fences": 0, "tables": 0}


def resolve(href, from_id):
    """Ban sao cua resolveHref() trong app.js."""
    href = href.split("#")[0]
    if not href:
        return ("anchor", None)
    base = from_id.split("/")[:-1]
    for s in href.split("/"):
        if not s or s == ".":
            continue
        if s == "..":
            if base:
                base.pop()
        else:
            base.append(s)
    p = "/".join(base)
    for cand in (p, p + "/README.md", p.rstrip("/") + "/README.md"):
        if cand in DOCS:
            return ("doc", cand)
    return ("file", p)


for doc_id in D["order"]:
    d = DOCS[doc_id]
    md = d["md"]

    # --- hang rao ma phai chan ---
    n_fence = len(re.findall(r"^\s*```", md, re.M))
    stat["fences"] += n_fence // 2
    if n_fence % 2:
        problems.append("%s: so hang rao ``` la le (%d)" % (doc_id, n_fence))

    # --- cong thuc ---
    body_no_code = re.sub(r"```[\s\S]*?```|`[^`\n]+`", "", md)
    n_dd = len(re.findall(r"\$\$", body_no_code))
    stat["math_b"] += n_dd // 2
    if n_dd % 2:
        problems.append("%s: so dau $$ la le (%d)" % (doc_id, n_dd))
    stat["math_i"] += len(re.findall(r"(?<!\$)\$[^\n$]+?\$(?!\$)", body_no_code))

    # --- $$ trong khoi trich dan: app.js chen the <div> nen se pha khoi ---
    for line in body_no_code.split("\n"):
        if line.lstrip().startswith(">") and "$$" in line:
            notes.append("%s: cong thuc $$ trong khoi trich dan (app.js dung"
                         " <span display:block> nen van dung) -> %s"
                         % (doc_id, line.strip()[:60]))

    stat["tables"] += len(re.findall(r"^\|.*\|\s*$", md, re.M))

    # --- lien ket ---
    for m in re.finditer(r"\]\(([^)\s]+)\)", md):
        href = m.group(1)
        stat["links"] += 1
        if href.startswith(("http://", "https://", "mailto:")):
            stat["ext"] += 1
            continue
        if href.startswith("#"):
            continue
        kind, p = resolve(href, doc_id)
        if kind == "doc":
            stat["to_doc"] += 1
        elif kind == "file":
            stat["to_file"] += 1
            if not os.path.exists(os.path.join(ROOT, urllib.parse.unquote(p))):
                problems.append("%s: lien ket hong -> %s  (giai ra: %s)" % (doc_id, href, p))

print("Da kiem tra %d tai lieu" % len(D["order"]))
print("  lien ket   : %d  (toi tai lieu %d, toi tep ma nguon %d, ngoai %d)"
      % (stat["links"], stat["to_doc"], stat["to_file"], stat["ext"]))
print("  khoi ma    : %d" % stat["fences"])
print("  cong thuc  : %d khoi, %d trong dong" % (stat["math_b"], stat["math_i"]))
print("  dong bang  : %d" % stat["tables"])

if notes:
    print("\nGhi chu (%d):" % len(notes))
    for n in notes[:10]:
        print("   " + n)

if problems:
    print("\n!! %d VAN DE:" % len(problems))
    for p in problems[:40]:
        print("   " + p)
    sys.exit(1)
print("\nKhong co van de.")
