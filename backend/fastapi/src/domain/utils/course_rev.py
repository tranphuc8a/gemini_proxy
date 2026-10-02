"""Fingerprints of what an editor was looking at, for conflict detection.

The management page sends back the fingerprint of the version it loaded
(`If-Match`). If the stored version no longer has that fingerprint, someone
else saved in between, and the save is refused with 409 instead of silently
overwriting their work.

Three independent fingerprints, so unrelated edits do not collide:

* a document's — its editable fields (title, slug, kind, tag, meta, markdown);
  moving it in the tree does not change it;
* the navigation tree's — sections, groups and the order of documents;
* the course information's — title, texts, icon, publication, configuration
  (minus the keys the server maintains itself, see `RESERVED_CONFIG_KEYS`).

JSON is serialised with sorted keys: MySQL returns JSON objects with their keys
reordered, and a fingerprint must not change just because a row was re-read.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Iterable, Mapping, Optional

#: Configuration keys the server writes (old slug → document, old id → new id).
#: The course information editor neither shows nor overwrites them.
RESERVED_CONFIG_KEYS = ("slugAliases", "idAliases")


def _fingerprint(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def doc_rev(title: str, slug: str, kind: str, tag: Optional[str], meta: Optional[Mapping[str, Any]], md: str) -> str:
    return _fingerprint(["doc", title or "", slug or "", kind or "", tag or "", dict(meta or {}), md or ""])


def tree_rev(sections: Iterable[Any]) -> str:
    """`sections` are domain objects or plain dicts in the API's shape."""
    out = []
    for sec in sections:
        s = sec.model_dump() if hasattr(sec, "model_dump") else dict(sec)
        out.append({
            "id": s.get("id", ""), "title": s.get("title", ""), "sub": s.get("sub", "") or "",
            "icon": s.get("icon", "") or "",
            "groups": [{"title": g.get("title", ""), "short": g.get("short", "") or "", "meta": dict(g.get("meta") or {}),
                        "items": list(g.get("items") or [])} for g in (s.get("groups") or [])],
        })
    return _fingerprint(["tree", out])


def public_config(config: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    return {k: v for k, v in dict(config or {}).items() if k not in RESERVED_CONFIG_KEYS}


def info_rev(title: str, subtitle: str, description: str, icon: str, config: Optional[Mapping[str, Any]],
             published: bool) -> str:
    return _fingerprint(["info", title or "", subtitle or "", description or "", icon or "",
                         public_config(config), bool(published)])


def parse_if_match(header: Optional[str]) -> Optional[str]:
    """The fingerprint in an `If-Match` header: quotes and a weak `W/` prefix
    are tolerated; empty or `*` means "no condition"."""
    if not header:
        return None
    value = header.strip()
    if value.startswith("W/"):
        value = value[2:]
    value = value.strip().strip('"').strip()
    return None if value in ("", "*") else value
