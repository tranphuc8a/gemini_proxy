"""The folding, statistics and ranking that moved from the browser to the server.

These used to run in `courses/engine/app.js` over the bundled course. They must
keep giving the same answers here, or a search that found a lesson yesterday
stops finding it today.
"""

from src.domain.utils import course_text as ct


def test_fold_strips_diacritics_and_keeps_length():
    assert ct.fold("Đại khoá học Trí tuệ") == "dai khoa hoc tri tue"
    for s in ("ấn chặt", "Ứng dụng NGÔN NGỮ", "İstanbul", "x"):
        assert len(ct.fold(s)) == len(s), s


def test_find_word_requires_a_word_boundary_at_the_start():
    """The rule is a PREFIX match at a word boundary, as in the engine: "bo"
    must not hit the middle of "sandbox", but it does find "Bốn" — typing the
    start of a word is how people search."""
    hay = ct.fold("sandbox bộ nhớ, Bốn bộ")
    assert ct.find_word(hay, "bo") == hay.index("bo nho")
    assert ct.find_word(hay, "box") == -1
    assert ct.count_word(hay, "bo") == 3          # bộ, Bốn, bộ — not sandbox


def test_outline_and_stats_match_the_old_build():
    md = "# Bài 1\n\nmột hai ba bốn năm\n\n## Mục **A**\n\n```py\nx = 1\ny = 2\n```\n\n### Mục `B`\n\n## Mục C\n"
    assert ct.outline(md) == [{"d": 2, "t": "Mục A"}, {"d": 3, "t": "Mục B"}, {"d": 2, "t": "Mục C"}]
    words, code_lines, minutes = ct.stats(md)
    assert code_lines == 2
    assert words == len("# Bài 1 một hai ba bốn năm ## Mục **A** ### Mục `B` ## Mục C".split())
    assert minutes == 2
    assert ct.title_of(md, "x") == "Bài 1"
    assert ct.title_of("no heading", "fallback") == "fallback"


def test_ranking_prefers_title_then_headings_then_body():
    terms = ct.terms_of("gradient")
    in_title = ct.score_doc(ct.fold("Gradient descent"), "", ct.fold("gradient gradient"), terms, "gradient", "lesson")
    in_heads = ct.score_doc(ct.fold("Tối ưu"), ct.fold("Gradient"), ct.fold("gradient"), terms, "gradient", "lesson")
    in_body = ct.score_doc(ct.fold("Tối ưu"), "", ct.fold("nói về gradient"), terms, "gradient", "ref")
    assert in_title > in_heads > in_body > 0
    assert ct.score_doc(ct.fold("Khác"), "", ct.fold("không có"), terms, "gradient", "lesson") == 0


def test_every_term_must_be_present():
    terms = ct.terms_of("học sâu")
    assert ct.score_doc("", "", ct.fold("học máy"), terms, "hoc sau", "lesson") == 0
    assert ct.score_doc("", "", ct.fold("học sâu là"), terms, "hoc sau", "lesson") > 0


def test_snippet_strips_markdown():
    md = "Xem [bài này](x.md) và **đậm** | bảng | ─── rồi tiếp"
    pos = ct.find_word(ct.fold(md), "dam")
    s = ct.snippet(md, pos)
    assert "](" not in s and "*" not in s and "|" not in s
    assert "đậm" in s
    assert ct.snippet("", -1, [{"t": "A"}, {"t": "B"}]) == "A · B"


# ------------------------------------------------- search is public input
#
# The review measured 37 s for "a " x 100 on the AI course: one-letter terms,
# repeated, each rescanned in a pure-Python loop. The limits below and the
# loop's hand-off to a compiled regex bound what one query can cost — without
# changing a single answer.

def test_terms_are_deduplicated_and_bounded():
    assert ct.terms_of("a " * 100) == [], "one-letter terms are dropped"
    assert ct.terms_of("Gradient gradient GRADIENT descent") == ["gradient", "descent"]
    assert ct.terms_of("a b xác suất") == ["xac", "suat"], "the rest of the query still searches"
    assert len(ct.terms_of(" ".join(f"tu{i}" for i in range(50)))) == ct.MAX_TERMS


def _find_reference(hay, term, start=0):
    """The engine's findWord, written plainly: the rule the fast path must keep."""
    i = hay.find(term, start)
    while i >= 0:
        if i == 0 or not ("a" <= hay[i - 1] <= "z" or "0" <= hay[i - 1] <= "9"):
            return i
        i = hay.find(term, i + 1)
    return -1


def _count_reference(hay, term, cap=60):
    n, i = 0, _find_reference(hay, term)
    while i >= 0 and n < cap:
        n += 1
        i = _find_reference(hay, term, i + len(term))
    return n


def test_word_matching_agrees_with_the_reference_rule_past_the_regex_hand_off():
    import random

    rnd = random.Random(5)
    for _ in range(400):
        # Few letters, so terms hide inside words often and the loop hands off.
        hay = "".join(rnd.choice("an uo-.ng") for _ in range(rnd.randint(0, 500)))
        for term in ("an", "uo", "ng", "a", "n-", ".n", "an an", "nga"):
            start = rnd.randint(0, 60)
            assert ct.find_word(hay, term, start) == _find_reference(hay, term, start), (hay, term, start)
            assert ct.count_word(hay, term) == _count_reference(hay, term), (hay, term)
            assert ct.count_word(hay, term, 3) == _count_reference(hay, term, 3), (hay, term)


def test_the_regex_path_keeps_the_boundary_rule():
    hay = "xan " * 50 + "an"                       # 50 hits inside words, then one word start
    assert ct.find_word(hay, "an") == len(hay) - 2
    assert ct.count_word(hay, "an") == 1
    assert ct.find_word("xab", "ab", 1) == -1, "the boundary looks before the start offset"
