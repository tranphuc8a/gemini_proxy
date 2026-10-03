"""Text helpers for course content: folding, statistics, outline, search ranking.

Everything here is a port of what the course web engine (`courses/engine/app.js`)
used to do in the browser over the whole bundled course. With the content in a
database the browser only ever holds one document, so the index and the ranking
move here — and they must give the same answers, otherwise a search that used to
find a lesson stops finding it.

Pure functions only: no I/O, no SQLAlchemy, so they are tested in isolation.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Dict, List, Sequence, Tuple

# ----------------------------------------------------------------- folding

_VI_GROUPS = [
    ("a", "àáạảãâầấậẩẫăằắặẳẵ"),
    ("e", "èéẹẻẽêềếệểễ"),
    ("i", "ìíịỉĩ"),
    ("o", "òóọỏõôồốộổỗơờớợởỡ"),
    ("u", "ùúụủũưừứựửữ"),
    ("y", "ỳýỵỷỹ"),
    ("d", "đ"),
]


def _build_fold_table() -> Dict[int, str]:
    table: Dict[int, str] = {}
    for base, chars in _VI_GROUPS:
        for ch in chars:
            table[ord(ch)] = base
            table[ord(ch.upper())] = base
    return table


_FOLD_TABLE = _build_fold_table()


def fold(text: str) -> str:
    """Lower-case and strip Vietnamese diacritics, ONE character to ONE character.

    Length is preserved on purpose: a match position found in the folded text
    is a valid position in the original, which is how snippets are cut from the
    markdown without a second search. `str.lower()` alone would break this for
    the handful of code points whose lower-case form is longer (``İ``), so the
    fast path — one `lower()` and one `translate()` over the whole text, which
    folds the 6 MB AI course in milliseconds — is only taken when the lengths
    agree, and the per-character loop handles the rest.
    """
    low = text.lower()
    if len(low) == len(text):
        return low.translate(_FOLD_TABLE)
    out = []
    for ch in text:
        lc = ch.lower()
        if len(lc) != 1:
            lc = ch
        out.append(_FOLD_TABLE.get(ord(lc), lc))
    return "".join(out)


# ------------------------------------------------------------- word matching

#: A query is public input; these bound what one request can cost. Measured on
#: the AI course (6.3 MB folded): "a " repeated 100 times took 37 s with the
#: first matcher, because every term was rescanned and a one-letter term stops
#: at hundreds of thousands of places that are not word starts.
MAX_TERMS = 6
MIN_TERM_LEN = 2

_WORD_CHARS = frozenset("abcdefghijklmnopqrstuvwxyz0123456789")

#: Substring hits that are NOT word starts tolerated in the Python loop before
#: the rest of the scan is handed to a compiled regex, which walks it in C.
#: Normal terms rarely reach it, so they keep the speed of `str.find`; terms
#: hidden inside common syllables ("uo" in "duoc", "nguoi") do, and a crafted
#: six-syllable query on the AI course drops from 480 ms to 170 ms.
_LOOP_MISSES = 8


@lru_cache(maxsize=512)
def _word_re(term: str) -> "re.Pattern[str]":
    # Literal first, so the regex engine scans for the term itself; the word
    # boundary is checked afterwards, by a fixed-width look-behind over "one
    # character + the term". A look-behind in FRONT would be tried at every
    # position of the text and is 40 times slower. The look-behind also sees
    # characters before `pos`, so `search(hay, pos)` keeps the boundary rule.
    e = re.escape(term)
    return re.compile(e + r"(?<![a-z0-9]" + e + r")")


def find_word(hay: str, term: str, start: int = 0) -> int:
    """Index of `term` in `hay` at a WORD BOUNDARY, or -1.

    Same rule as the engine's findWord: the character before the match is not
    [a-z0-9]. Without it, short Vietnamese words ("bộ", "trị", "cực") match
    inside unrelated words (sandbox, bớt, Bốn) and swamp the results.
    """
    if not term:
        return -1
    i = hay.find(term, start)
    misses = 0
    while i >= 0:
        if i == 0 or hay[i - 1] not in _WORD_CHARS:
            return i
        misses += 1
        if misses > _LOOP_MISSES:
            m = _word_re(term).search(hay, i + 1)
            return m.start() if m else -1
        i = hay.find(term, i + 1)
    return -1


def count_word(hay: str, term: str, cap: int = 60) -> int:
    """Non-overlapping word-start matches, counting stops at `cap`."""
    if not term:
        return 0
    n, misses, step = 0, 0, len(term)
    i = hay.find(term)
    while i >= 0 and n < cap:
        if i == 0 or hay[i - 1] not in _WORD_CHARS:
            n += 1
            i = hay.find(term, i + step)
            continue
        misses += 1
        if misses > _LOOP_MISSES:
            for _ in _word_re(term).finditer(hay, i + 1):
                n += 1
                if n >= cap:
                    break
            return n
        i = hay.find(term, i + 1)
    return n


def terms_of(query: str) -> List[str]:
    """Folded search terms: de-duplicated, at least two characters, at most six.

    A one-letter term matches nearly everywhere and ranks nothing; a repeated
    term only multiplies the work. Both are dropped rather than rejected, so a
    query like "a b xác suất" still searches for "xac suat".
    """
    out: List[str] = []
    for t in fold(query.strip()).split():
        if len(t) >= MIN_TERM_LEN and t not in out:
            out.append(t)
            if len(out) >= MAX_TERMS:
                break
    return out


# --------------------------------------------------------- outline and stats

_FENCE = re.compile(r"^\s*(```|~~~)")
# Markdown arrives in requests (a save, an import). The old forms, `\s+(.+?)\s*$`,
# let the lazy group and the trailing `\s*` both claim spaces, so a run of spaces
# inside a heading was rescanned once per space: 16 000 spaces took 4 s, a 1 MB
# lesson hours, on the request path (CodeQL py/polynomial-redos). Now the text
# starts at a non-space and runs to the end of the line; callers strip the end.
_HEADING = re.compile(r"^(#{2,3})\s+(\S.*)")
#: [ \t], not \s: a lone "#" must not take its title from the next line.
_H1 = re.compile(r"^#[ \t]+(\S.*)", re.M)


def strip_fences(md: str) -> str:
    out, inside = [], False
    for line in md.split("\n"):
        if _FENCE.match(line):
            inside = not inside
            continue
        if not inside:
            out.append(line)
    return "\n".join(out)


def outline(md: str) -> List[Dict[str, object]]:
    """H2/H3 headings as `{d, t}`, what the engine shows as the in-page TOC."""
    res: List[Dict[str, object]] = []
    for line in strip_fences(md).split("\n"):
        m = _HEADING.match(line)
        if m:
            res.append({"d": len(m.group(1)), "t": re.sub(r"[*`_]", "", m.group(2)).strip()})
    return res


def heads_text(outline_items: Sequence[Dict[str, object]]) -> str:
    return " · ".join(str(o.get("t", "")) for o in outline_items)


def stats(md: str) -> Tuple[int, int, int]:
    """(words, code lines, reading minutes) — same formula as the old build.py."""
    body = strip_fences(md)
    words = len(re.findall(r"[^\s]+", body))
    code_lines, inside = 0, False
    for line in md.split("\n"):
        if _FENCE.match(line):
            inside = not inside
            continue
        if inside:
            code_lines += 1
    minutes = max(2, int(round(words / 170.0 + code_lines / 22.0)))
    return words, code_lines, minutes


def title_of(md: str, fallback: str) -> str:
    m = _H1.search(md)
    return m.group(1).strip() if m else fallback


# ------------------------------------------------------------------ ranking

def score_doc(title_f: str, heads_f: str, body_f: str, terms: Sequence[str], query_f: str, kind: str) -> float:
    """The engine's ranking, verbatim: every term must land somewhere; the title
    outranks headings outranks the body; frequency in the body counts a little;
    a whole-phrase title match and being a lesson are small bonuses."""
    score = 0.0
    for t in terms:
        in_t = find_word(title_f, t) >= 0
        in_h = find_word(heads_f, t) >= 0
        p = find_word(body_f, t)
        if not in_t and not in_h and p < 0:
            return 0.0
        if in_t:
            score += 120
        if in_h:
            score += 34
        if p >= 0:
            score += 10
            score += min(28, count_word(body_f, t) * 1.6)
    if query_f and find_word(title_f, query_f) >= 0:
        score += 90
    if kind == "lesson":
        score += 6
    return score


def first_position(body_f: str, terms: Sequence[str]) -> int:
    for t in terms:
        p = find_word(body_f, t)
        if p >= 0:
            return p
    return -1


_SNIPPET_JUNK = re.compile(r"[|│┌┐└┘─━├┤┬┴┼╌▲▼►◄●○→←↑↓]")
#: An excerpt is 250 characters, but the headings a snippet falls back to are
#: not bounded — and the link patterns below are quadratic on a run of "[".
_SNIPPET_MAX = 600


def clean_snippet(s: str) -> str:
    """Strip markdown syntax from an excerpt: links, tables, ASCII drawings."""
    s = s[:_SNIPPET_MAX]
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"\]\([^)]*\)", "", s)          # a link whose "[" the excerpt cut off
    s = re.sub(r"[\[\]`*_#>~]", "", s)
    s = _SNIPPET_JUNK.sub(" ", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"^[\s.,:;)\]]+", "", s)
    return s.strip()


def snippet(md: str, pos: int, outline_items: Sequence[Dict[str, object]] = ()) -> str:
    if pos >= 0:
        return clean_snippet(md[max(0, pos - 85): pos + 165])
    return clean_snippet(" · ".join(str(o.get("t", "")) for o in list(outline_items)[:4]))
