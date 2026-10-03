"""Links between the documents of a course, and links that lead nowhere.

A lesson links to another lesson the way the source repository did: a relative
path to its markdown file (`../mon-02/bai-04.md#muc`), resolved against the
linking document's own id — exactly what the course engine does when it turns
the link into a route (`resolveHref` in courses/engine/hien-thi.js). It may also
link a route directly (`#/bai/slug`) or a file uploaded to the course
(`assets/hinh.png`).

Only targets this course is responsible for are judged: a relative path ending
in `.md`, a `#/route`, an `assets/` file. Anything else (a web address, a
source file of the original repository) is not counted as broken.
"""

from __future__ import annotations

import posixpath
import re
from typing import Dict, Iterable, List, Mapping, Optional, Set, Tuple

# [text](target "title") and ![alt](target) — the target stops at whitespace or ")".
# Neither the text nor the target holds a "[": when they could, every "[" of a
# line like "[[[[…" or "[]([](…" was scanned to the end of the line — 16 000 of
# them took 12 s and 66 s (CodeQL py/polynomial-redos). A stray "[" before a link
# is harmless, the scan restarts there; only nested brackets or an escaped "\]"
# in the text, or a "[" in the target, leave a link unjudged.
_LINK = re.compile(r"!?\[[^\[\]]*\]\(\s*<?([^)\s>\[]+)>?(?:\s+\"[^\"]*\")?\s*\)")
_FENCE = re.compile(r"^\s*(```|~~~)")
ASSET_PREFIX = re.compile(r"^(?:\./)?assets/(.+)$")


def _strip_code(md: str) -> List[Tuple[int, str]]:
    """(line number, text) of every line outside fenced code, inline code removed."""
    out, inside = [], False
    for n, line in enumerate(md.split("\n"), 1):
        if _FENCE.match(line):
            inside = not inside
            continue
        if not inside:
            out.append((n, re.sub(r"`[^`\n]*`", "", line)))
    return out


def resolve(href: str, from_id: str) -> str:
    base = posixpath.dirname(from_id)
    parts = base.split("/") if base else []
    for seg in href.split("/"):
        if not seg or seg == ".":
            continue
        if seg == "..":
            if parts:
                parts.pop()
        else:
            parts.append(seg)
    return "/".join(parts)


def target_doc(path: str, ids: Set[str]) -> Optional[str]:
    """The document a resolved path names, as the engine finds it."""
    for cand in (path, path + "/README.md", path.rstrip("/") + "/README.md"):
        if cand in ids:
            return cand
    return None


def scan(docs: Mapping[str, str], slugs: Mapping[str, str], aliases: Mapping[str, str],
         assets: Iterable[str]) -> Dict[str, object]:
    """`docs`: id → markdown. `slugs`: slug → id. `aliases`: old slug → id.

    Returns ``{"broken": [...], "inbound": {id: [from ids]}, "assetUse": {name: [ids]}, "checked": n}``.
    """
    ids = set(docs)
    asset_names = set(assets)
    broken: List[Dict[str, object]] = []
    inbound: Dict[str, List[str]] = {}
    asset_use: Dict[str, List[str]] = {}
    checked = 0

    def add(table: Dict[str, List[str]], key: str, from_id: str) -> None:
        lst = table.setdefault(key, [])
        if from_id not in lst:
            lst.append(from_id)

    for from_id, md in docs.items():
        for line_no, line in _strip_code(md or ""):
            for m in _LINK.finditer(line):
                href = m.group(1)
                if re.match(r"^[a-z][a-z0-9+.-]*:", href, re.I) or href.startswith("//"):
                    continue                                   # http:, mailto:, data: …
                checked += 1
                path, _, _anchor = href.partition("#")
                if not path:
                    route = _anchor
                    if route.startswith("/"):                  # "#/slug#heading"
                        slug = route[1:].split("#", 1)[0]
                        target = slugs.get(slug) or aliases.get(slug)
                        if target and target in ids:
                            add(inbound, target, from_id)
                        else:
                            broken.append({"from": from_id, "line": line_no, "href": href,
                                           "reason": "không có bài nào mang slug này"})
                    continue                                   # "#heading" inside the page
                am = ASSET_PREFIX.match(path)
                if am:
                    name = am.group(1)
                    if name in asset_names:
                        add(asset_use, name, from_id)
                    else:
                        broken.append({"from": from_id, "line": line_no, "href": href,
                                       "reason": "tệp chưa được tải lên khoá học"})
                    continue
                resolved = resolve(path, from_id)
                target = target_doc(resolved, ids)
                if target:
                    if target != from_id:
                        add(inbound, target, from_id)
                elif path.lower().endswith(".md"):
                    broken.append({"from": from_id, "line": line_no, "href": href,
                                   "reason": "bài đích không có trong khoá (%s)" % resolved})
    return {"broken": broken, "inbound": inbound, "assetUse": asset_use, "checked": checked}
