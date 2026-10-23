"""The Personal Wiki's [[links]], read exactly the way its pages read them.

Ports of the browser modules `personal-wiki/assets/js/core/notes.js`
(`maskCode`, `parseLinks`, `normTag`, `titleKey` from text.js) and
`core/compose.js` (math regions). The server checks an AI answer with these and
the page checks it again before saving, so both sides must agree on what is a
link: ONE fixture file drives the tests of both,
`backend/fastapi/webapp/tranphuc8a/personal-wiki/kiem-lien-ket.json`
(`node …/personal-wiki/kiem.js` and `pytest -k ai_wiki`). Change a rule here →
change it in compose.js / notes.js and add a case to that file.

What is NOT a link:
* anything inside code — a ``` / ~~~ fence (unclosed: to the end) or an
  `inline` span;
* anything inside math — `$$…$$`, `\\[…\\]`, `\\(…\\)` and `$…$` by the pandoc
  rule (an opening `$` has a non-space on its right; the closing one is the
  nearest single `$`, with a non-space on its left and no digit after it, so
  "$5 and $10" is not math). No region crosses a blank line, and an unclosed
  delimiter opens nothing (so a stray `$$` cannot hide the rest of a note from
  the link check). `\\$` is a plain dollar.

`defang_math` writes `[ [` / `] ]` for `[[` / `]]` inside math: TeX draws the
same thing (spaces do not count in math mode) and no reader — this module, the
page's link parser, its graph — can take it for a link any more.

`verify_links` is the whole check of an AI answer (defang → rewrite → seal, to a fixed point); the page runs the
same steps on the final text of each note (`compose.js` `verifyLinks` / `plan`), and `kiem-lien-ket.json` holds the
cases both must answer alike.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Callable, Dict, List, Optional, Tuple

LINK = "link"
#: The `kiểu::` prefixes notes.js accepts inside [[…]] (the plain link has none).
REL_TYPES = ("related_to", "depends_on", "parent_of", "child_of")
TITLE_CHARS = 200
TAG_CHARS = 40

_FENCE_OPEN = re.compile(r"^ {0,3}(`{3,}|~{3,})")
_FENCE_CLOSE = re.compile(r"^ {0,3}[`~]+\s*$")
_BACKTICKS = re.compile(r"`+")
_LINK_RE = re.compile(r"\[\[([^\[\]\n]{1,300})\]\]")
_TYPED = re.compile(r"^\s*([a-z_]+)\s*::\s*([\s\S]*)$", re.I)
_MARKS = re.compile(r"[̀-ͯ]")
_WS = " \t\n\r\f\v"


# ------------------------------------------------------------------------------------------ text.js / notes.js

def fold(s: object) -> str:
    """Lower case, no Vietnamese marks, đ → d (text.js `fold`)."""
    s = str("" if s is None else s).lower()
    if s.isascii():
        return s
    return _MARKS.sub("", unicodedata.normalize("NFD", s)).replace("đ", "d")


def title_key(s: object) -> str:
    """How titles are compared: folded, single spaces (text.js `titleKey`)."""
    return re.sub(r"\s+", " ", fold(s)).strip()


def norm_tag(t: object) -> str:
    """A tag the way notes.js stores it: lower case, no '#', spaces → '-', letters/digits/_-./ only, ≤ 40."""
    s = unicodedata.normalize("NFC", str("" if t is None else t)).lower().strip()
    s = re.sub(r"^#+", "", s)
    s = re.sub(r"\s+", "-", s)
    s = "".join(ch for ch in s if ch in "_-./" or unicodedata.category(ch)[:1] in ("L", "N"))
    s = re.sub(r"-{2,}", "-", s)
    # = re.sub(r"^[-./]+|[-./]+$", "", s) — whose `[-./]+$` backtracks quadratically on a long run like "./././…x"
    return s.strip("-./")[:TAG_CHARS]


def mask_inline_code(line: str) -> str:
    """One line with its `inline` spans turned into spaces (same length).

    Exactly what notes.js first did with the regex (`+)(?!`)([^\\n]*?[^`\\n])\\1(?!`) applied left to right — that
    regex backtracks quadratically on a long run of backticks, so here it is as one pass: for each run of backticks,
    try its suffixes longest first (the whole run, then without its first backtick…); a suffix of length m opens a
    span when a LATER run on the line has exactly m backticks, and the span ends with the nearest such run. A span that
    opens nothing leaves its backticks as they are.
    """
    if "`" not in line:
        return line
    runs = [(m.start(), m.end() - m.start()) for m in _BACKTICKS.finditer(line)]
    by_size: Dict[int, List[int]] = {}               # run length → indexes of the runs of that length, in order
    for idx, (_start, size) in enumerate(runs):
        by_size.setdefault(size, []).append(idx)
    seen: Dict[int, int] = {}                        # run length → position in by_size[length] of the first run not yet passed
    out: List[str] = []
    cursor, i = 0, 0
    while i < len(runs):
        start, size = runs[i]
        nxt = i + 1
        for want in range(size, 0, -1):
            later = by_size.get(want)
            if not later:
                continue
            p = seen.get(want, 0)
            while p < len(later) and later[p] <= i:
                p += 1
            seen[want] = p
            if p < len(later):
                j = later[p]
                a, b = start + size - want, runs[j][0] + want
                out.append(line[cursor:a])
                out.append(" " * (b - a))
                cursor, nxt = b, j + 1
                break
        i = nxt
    if not cursor:
        return line
    out.append(line[cursor:])
    return "".join(out)


def mask_code(content: object) -> str:
    """The text with code (fences and `inline` spans) turned into spaces, same length and line breaks."""
    lines = str(content or "").split("\n")
    out: List[str] = []
    in_fence, fence = False, ""
    for ln in lines:
        m = _FENCE_OPEN.match(ln)
        if in_fence:
            out.append(" " * len(ln))
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence) and _FENCE_CLOSE.match(ln):
                in_fence = False
        elif m:
            in_fence, fence = True, m.group(1)
            out.append(" " * len(ln))
        else:
            out.append(mask_inline_code(ln))
    return "\n".join(out)


# ------------------------------------------------------------------------------------------ math regions (compose.js)

def _blank_line_after(s: str, k: int) -> bool:
    """s[k] is a newline: is the next line empty or only spaces?"""
    n, m = len(s), k + 1
    while m < n and s[m] in " \t\r":
        m += 1
    return m < n and s[m] == "\n"


def _scan_close(s: str, p: int, kind: str) -> Tuple[int, int]:
    """Look for the closing `kind` (")", "]", "$$" or "$") from p, within the paragraph.

    → (index after the closing delimiter — for "$" the index OF it —, -1) when found,
      (-1, where the search stopped) when not.
    """
    n, k = len(s), p
    while k < n:
        c = s[k]
        if c == "\n" and _blank_line_after(s, k):
            return -1, k
        if c == "\\":
            j = k
            while j < n and s[j] == "\\":
                j += 1
            if (j - k) % 2 == 1 and j < n:
                if kind in (")", "]") and s[j] == kind:
                    return j + 1, -1
                k = j + 1                      # an escaped character, never a delimiter
                continue
            k = j
            continue
        if c == "$":
            if kind == "$$":
                if k + 1 < n and s[k + 1] == "$":
                    return k + 2, -1
            elif kind == "$":
                return k, -1
        k += 1
    return -1, n


def math_ranges(masked: str) -> List[Tuple[int, int]]:
    """[start, end) of every math region in a text whose code is already masked (mask_code)."""
    s, n, i = masked, len(masked), 0
    out: List[Tuple[int, int]] = []
    failed: Dict[str, int] = {}             # delimiter → where a failed search for its closing stopped
    while i < n:
        c = s[i]
        if c == "\\":
            j = i
            while j < n and s[j] == "\\":
                j += 1
            if (j - i) % 2 == 1 and j < n:
                d = s[j]
                if d in "([":
                    close = ")" if d == "(" else "]"
                    if j + 1 > failed.get(close, -1):
                        end, stop = _scan_close(s, j + 1, close)
                        if end != -1:
                            out.append((j - 1, end))
                            i = end
                            continue
                        failed[close] = stop
                i = j + 1
                continue
            i = j
            continue
        if c == "$":
            if i + 1 < n and s[i + 1] == "$":
                if i + 2 > failed.get("$$", -1):
                    end, stop = _scan_close(s, i + 2, "$$")
                    if end != -1:
                        out.append((i, end))
                        i = end
                        continue
                    failed["$$"] = stop
                i += 2
                continue
            if i + 1 < n and s[i + 1] not in _WS:
                k, _stop = _scan_close(s, i + 1, "$")
                if (k != -1 and not (k + 1 < n and s[k + 1] == "$") and s[k - 1] not in _WS
                        and not (k + 1 < n and "0" <= s[k + 1] <= "9")):
                    out.append((i, k + 1))
                    i = k + 1
                    continue
            i += 1
            continue
        i += 1
    return out


def blank_math(content: object) -> str:
    """The text with every math region turned into spaces (same length)."""
    content = str(content or "")
    out, cursor = [], 0
    for a, b in math_ranges(mask_code(content)):
        out.append(content[cursor:a])
        out.append(" " * (b - a))
        cursor = b
    out.append(content[cursor:])
    return "".join(out)


def defang_math(content: object) -> str:
    """`[[` → `[ [` and `]]` → `] ]` inside math: drawn the same by TeX, never read as a link."""
    content = str(content or "")
    out, cursor = [], 0
    for a, b in math_ranges(mask_code(content)):
        region = re.sub(r"\](?=\])", "] ", re.sub(r"\[(?=\[)", "[ ", content[a:b]))
        out.append(content[cursor:a])
        out.append(region)
        cursor = b
    out.append(content[cursor:])
    return "".join(out)


# ------------------------------------------------------------------------------------------ links

def _parse_links_raw(content: str) -> List[Dict[str, object]]:
    """notes.js `parseLinks`: every [[…]] outside code → {type, title, alias, raw, index}."""
    masked = mask_code(content)
    out: List[Dict[str, object]] = []
    for m in _LINK_RE.finditer(masked):
        inner = content[m.start() + 2:m.end() - 2]
        typ = LINK
        mt = _TYPED.match(inner)
        if mt and mt.group(1).lower() in REL_TYPES:
            typ, inner = mt.group(1).lower(), mt.group(2)
        bar = inner.find("|")
        title = (inner if bar == -1 else inner[:bar]).strip()
        alias = "" if bar == -1 else inner[bar + 1:].strip()
        if not title:
            continue
        out.append({"type": typ, "title": title[:TITLE_CHARS], "alias": alias[:TITLE_CHARS], "raw": m.group(0),
                    "index": m.start()})
    return out


def parse_links(content: object) -> List[Dict[str, object]]:
    """Every [[…]] outside code AND math (compose.js `parseLinks`)."""
    return _parse_links_raw(blank_math(content))


def link_text(typ: str, title: str, alias: str = "") -> str:
    return "[[" + ("" if typ == LINK else typ + "::") + title + ("|" + alias if alias else "") + "]]"


def _rewrite(content: str, links: List[Dict[str, object]], canonical: Callable[[str], Optional[str]],
             gone: Callable[[Dict[str, object], str], str]) -> Tuple[str, List[str]]:
    out, cursor, dropped = [], 0, []
    for ln in links:
        typ, title, alias = str(ln["type"]), str(ln["title"]), str(ln["alias"])
        start, raw = int(ln["index"]), str(ln["raw"])
        real = content[start:start + len(raw)]
        out.append(content[cursor:start])
        if real != raw:
            # Read through a math region (the page's reader sees the math as blanks, so `raw` has spaces where the text has
            # TeX): not a link the page can draw, and writing its title back would erase the math. Keep every character,
            # break the brackets — no reader takes `[ [x] ]` for a link.
            out.append("[ [" + real[2:-2] + "] ]")
            dropped.append(real)
        else:
            if typ == LINK:
                mt = _TYPED.match(title)
                if mt and mt.group(1).lower() == LINK and mt.group(2).strip():
                    title = mt.group(2).strip()
            name = canonical(title)
            if name:
                out.append(link_text(typ, name, alias))
            else:
                out.append(gone(ln, title))
                dropped.append(raw)
        cursor = start + len(raw)
    out.append(content[cursor:])
    return "".join(out), dropped


def rewrite_links(content: object, canonical: Callable[[str], Optional[str]]) -> Tuple[str, List[str]]:
    """Keep the links whose title `canonical` knows (written with its spelling), turn the others into plain text.

    `canonical(title) → title to write, or None` (the link goes). A `[[link::X]]` is read as `[[X]]`.
    → (new text, the dropped links as written).
    """
    content = str(content or "")
    return _rewrite(content, parse_links(content), canonical, lambda ln, title: str(ln["alias"]) or title)


def seal_links(content: object, canonical: Callable[[str], Optional[str]]) -> Tuple[str, List[str]]:
    """The last guard, on the FINAL text: whatever a reader still takes for a link must point to a title `canonical`
    knows; any other keeps its text but loses its brackets' meaning: `[[X]]` → `[ [X] ]`.

    Two readers, in this order: notes.js `parseLinks` — code skipped, math NOT (the graph, the backlinks, the renderer) —
    and the page's own, math-aware `parse_links`, which blanks math before it looks (so a link can be formed OVER a math
    region: `[[a $x$ ]]`, or `[[a` + `$…$` + `]]` after a dropped link left its neighbours touching).

    rewrite_links already dropped every link it saw, but its edits can make new ones: dropping `[[Bịa]]` out of
    `[[a [[Bịa]] b]]` leaves `[[a Bịa b]]`, and a replacement can move the code or math around it. The brackets stay
    here, so this pass makes no link of its own and running it twice changes nothing.
    """
    content = str(content or "")
    raw = lambda ln, _title: "[ [" + str(ln["raw"])[2:-2] + "] ]"                       # noqa: E731
    text, dropped = _rewrite(content, _parse_links_raw(content), canonical, raw)
    text, more = _rewrite(text, parse_links(text), canonical, raw)
    return text, dropped + more


VERIFY_PASSES = 4


def verify_links(content: object, canonical: Callable[[str], Optional[str]]) -> Tuple[str, List[str]]:
    """Check the links of a text someone else wrote (an AI answer): defang math, rewrite, seal — in THAT order, until
    nothing changes (so checking the result again changes nothing; ≤ VERIFY_PASSES rounds, and the last thing done is
    always a seal, which is safe on its own).

    Math first: the replacement of a dropped link (an alias ending with `\\`, a `$`) may end a math region early, and a
    link the check skipped as "in math" would then be a live one. A seal's edit may open a region too (`\\` + `[`), whose
    `[[` the next round defangs. → (text, every dropped link as written)."""
    text, dropped = str(content or ""), []
    for _ in range(VERIFY_PASSES):
        nxt, gone = rewrite_links(defang_math(text), canonical)
        nxt, more = seal_links(nxt, canonical)
        dropped += gone + more
        if nxt == text:
            break
        text = nxt
    return text, dropped
