"""The shape of a document id in the markdown store (ke-hoach §1.2 "docId").

One definition for every markdown feature: read-only links (`markdown_share_vo`) key
on it today, and the delta sync (md-sync B2, `markdown_docs_vo`) must import this same
pattern rather than write its own - a link is found by the id the sync keeps.

Ids are made by the browser (`<kind>-<base36 time>-<counter>-<random>`, see
`markdown-editor/src/lib/id.ts`) plus the fixed `root` and `welcome`. Matching is
exact (case matters); on MySQL the adapters compare the value they read back, since
the default collation ignores case.
"""

from __future__ import annotations

import re

#: md-sync's `DocRecord.id` (thiet-ke/md-sync.md §3.1). Do not loosen it in one place only.
DOC_ID_PATTERN = r"^[A-Za-z0-9_.:-]{1,80}$"
DOC_ID_RE = re.compile(DOC_ID_PATTERN)

#: Ids every installation shares. `root` is the top folder of every editor, so a link on
#: it from one device would be overwritten by a link from another (ke-hoach §1.2).
UNSHAREABLE_DOC_IDS = frozenset({"root"})


def is_doc_id(value: str) -> bool:
    return isinstance(value, str) and DOC_ID_RE.fullmatch(value) is not None
