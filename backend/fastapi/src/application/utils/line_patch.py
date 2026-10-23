"""Line patches of the markdown sync (md-sync B1): the format the browser and the server share.

A document is a list of lines: `text.split("\\n")` and `"\\n".join(lines)` - the same in
JavaScript and in Python, so a `\\r` stays on its line and a trailing newline is an empty
last line. A patch is

    {"v": 1, "h": [[offset, removed, [inserted line, ...]], ...]}

meaning "replace `removed` lines of the BASE, starting at line `offset` (0-based), with
the inserted lines". Hunks are ordered by offset and never overlap.

The browser makes patches with its own Myers diff (`proto-diff.mjs` in the design); the
server only *applies* them (`apply_patch`) and checks the result against the SHA-256 the
client sent, so a bad patch is refused rather than stored. The server makes patches only
for its history (`make_delta`: the standard library's `difflib` after trimming the common
head and tail). Nothing here reads or writes storage.
"""

from __future__ import annotations

import json
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional

from src.application.utils.hashing import sha256_hex  # noqa: F401 - re-exported: one hash for patches and links

PATCH_VERSION = 1
#: Past this many lines (after the common head and tail are cut) a history delta is not worth the diff time:
#: the caller keeps the whole text.
MAX_DIFF_LINES = 50_000
#: `difflib` costs about one microsecond per pair of EQUAL lines (one from each side) that it may anchor on, so this
#: is the bound on its time (~0.4 s): a document whose lines repeat so much that the pairs outrun it - not
#: rare lines, but a few hundred distinct lines each many times over - is stored whole instead of diffed.
MAX_DIFF_PAIRS = 400_000


def split_lines(text: str) -> List[str]:
    return text.split("\n")


def join_lines(lines: List[str]) -> str:
    return "\n".join(lines)


def _bad(message: str) -> ValueError:
    return ValueError(message)


def validate_patch(patch: Any) -> List[List[Any]]:
    """The hunks of a well-formed patch, or `ValueError` (the shape only, not whether it fits a base)."""
    if not isinstance(patch, dict) or patch.get("v") != PATCH_VERSION:
        raise _bad("patch version is not 1")
    hunks = patch.get("h")
    if not isinstance(hunks, list):
        raise _bad("patch has no hunk list")
    cursor = 0
    for hunk in hunks:
        if not isinstance(hunk, (list, tuple)) or len(hunk) != 3:
            raise _bad("a hunk is not [offset, removed, lines]")
        offset, removed, inserted = hunk
        if isinstance(offset, bool) or isinstance(removed, bool) or not isinstance(offset, int) or not isinstance(removed, int):
            raise _bad("hunk offset and removed must be integers")
        if offset < 0 or removed < 0:
            raise _bad("hunk offset and removed must not be negative")
        if not isinstance(inserted, (list, tuple)) or not all(isinstance(line, str) for line in inserted):
            raise _bad("hunk lines must be strings")
        if offset < cursor:
            raise _bad("hunks must ascend and not overlap")
        cursor = offset + removed
    return hunks


def apply_patch(base: str, patch: Any) -> str:
    """`base` with the patch applied. `ValueError` when it is malformed or reaches outside the base."""
    hunks = validate_patch(patch)
    lines = split_lines(base)
    out: List[str] = []
    cursor = 0
    for offset, removed, inserted in hunks:
        if offset + removed > len(lines):
            raise _bad("a hunk reaches past the end of the base")
        out.extend(lines[cursor:offset])
        out.extend(inserted)
        cursor = offset + removed
    out.extend(lines[cursor:])
    return join_lines(out)


def _anchor_pairs(mid_a: List[str], mid_b: List[str]) -> int:
    """How many (line of `mid_a`, equal line of `mid_b`) pairs `SequenceMatcher(autojunk=True)` will walk.

    This is the work `difflib` does, and it is quadratic in the repeats: a line that occurs 150 times on each side is
    22,500 pairs. Lines it treats as "popular" (more than 1 % of `mid_b`, once `mid_b` has 200 lines) are never
    anchors and cost nothing - the same rule as its own `__chain_b`, mirrored here so the cost is known before it is paid.
    """
    counts: Dict[str, int] = {}
    for line in mid_b:
        counts[line] = counts.get(line, 0) + 1
    popular = len(mid_b) // 100 + 1 if len(mid_b) >= 200 else None
    pairs = 0
    for line in mid_a:
        seen = counts.get(line, 0)
        if seen and (popular is None or seen <= popular):
            pairs += seen
    return pairs


def make_delta(
    old: str, new: str, max_lines: int = MAX_DIFF_LINES, max_pairs: int = MAX_DIFF_PAIRS
) -> Optional[Dict[str, Any]]:
    """A patch turning `old` into `new`, or None when diffing them would cost too much.

    The common head and tail are cut first (a one-line edit of a megabyte is then instant). What is left is
    diffed by `difflib` with `autojunk=True`: it does not anchor on lines that are most of the text (blank lines,
    `---`, table rows), which is what keeps a long document from costing seconds - with `autojunk=False` two edits
    far apart in 12,000 lines took 3.6 s and 25,000 lines 17 s, with it 0.03 s. The price is a patch that may be a
    little bigger than the minimal one, which is harmless: it always applies, and the caller keeps the whole text
    when the patch is not clearly smaller. Never slower than `max_lines` lines or `max_pairs` anchor pairs allow.
    """
    a = split_lines(old)
    b = split_lines(new)
    head = 0
    limit = min(len(a), len(b))
    while head < limit and a[head] == b[head]:
        head += 1
    tail = 0
    while tail < limit - head and a[len(a) - 1 - tail] == b[len(b) - 1 - tail]:
        tail += 1
    mid_a = a[head:len(a) - tail]
    mid_b = b[head:len(b) - tail]
    if len(mid_a) > max_lines or len(mid_b) > max_lines:
        return None
    hunks: List[List[Any]] = []
    if mid_a or mid_b:
        if _anchor_pairs(mid_a, mid_b) > max_pairs:
            return None
        for tag, i1, i2, j1, j2 in SequenceMatcher(None, mid_a, mid_b, autojunk=True).get_opcodes():
            if tag == "equal":
                continue
            hunks.append([head + i1, i2 - i1, mid_b[j1:j2]])
    return {"v": PATCH_VERSION, "h": hunks}


def patch_json(patch: Dict[str, Any]) -> str:
    """The compact JSON text a history row keeps (UTF-8 as is, no spaces)."""
    return json.dumps(patch, ensure_ascii=False, separators=(",", ":"))


def patch_bytes(patch: Dict[str, Any]) -> int:
    return len(patch_json(patch).encode("utf-8"))
