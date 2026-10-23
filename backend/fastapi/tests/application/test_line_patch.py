"""Line patches (md-sync B1): the format the browser's diff and the server's history share."""

import hashlib
import json
import pathlib
import random
import time
from difflib import SequenceMatcher

import pytest

from src.application.utils.line_patch import (
    _anchor_pairs,
    apply_patch,
    join_lines,
    make_delta,
    patch_bytes,
    patch_json,
    sha256_hex,
    split_lines,
    validate_patch,
)
from tests.support.markdown_docs import repetitive_lines, shuffled_vocabulary

FIXTURE = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "markdown_patches.json"


def patch(*hunks):
    return {"v": 1, "h": [list(h) for h in hunks]}


# --------------------------------------------------------- shared fixture (also applied by node)

@pytest.mark.parametrize("case", json.loads(FIXTURE.read_text(encoding="utf-8")), ids=lambda case: case["name"])
def test_the_hand_made_fixture_applies(case):
    """The expected results were written by hand and re-checked by an independent JavaScript applier, so a
    patch made in the browser lands the same here."""
    assert apply_patch(case["base"], case["patch"]) == case["result"]


# ------------------------------------------------------------------- split / join

def test_lines_split_on_newline_only_and_keep_everything_else():
    assert split_lines("") == [""]
    assert split_lines("a\n") == ["a", ""]
    assert split_lines("a\r\nb") == ["a\r", "b"]
    assert split_lines("a b\x0bc") == ["a b\x0bc"], "only \\n splits (JavaScript's split('\\n') agrees)"
    for text in ["", "\n", "a", "a\n\n", "\r\n", "x\ny\nz\n"]:
        assert join_lines(split_lines(text)) == text


# ------------------------------------------------------------------ round trips

ALPHABET = ["", "a", "b", "c", "# Tiêu đề", "- item", "$x^2$", "a\r", "dòng dài " * 20]


def random_text(rng, max_lines=30):
    return "\n".join(rng.choice(ALPHABET) for _ in range(rng.randint(0, max_lines)))


def mutate(rng, text):
    lines = split_lines(text)
    for _ in range(rng.randint(0, 5)):
        action = rng.choice(["insert", "delete", "replace", "dup"])
        position = rng.randint(0, len(lines))
        if action == "insert":
            lines[position:position] = [rng.choice(ALPHABET) for _ in range(rng.randint(1, 3))]
        elif action == "delete" and lines:
            del lines[position:position + rng.randint(1, 3)]
        elif action == "replace" and lines:
            lines[min(position, len(lines) - 1)] = rng.choice(ALPHABET)
        elif action == "dup" and lines:
            lines.extend(lines[:3])
    return join_lines(lines)


def test_500_random_round_trips():
    rng = random.Random(20261023)
    for _ in range(500):
        old = random_text(rng)
        new = mutate(rng, old)
        delta = make_delta(old, new)
        assert delta is not None
        validate_patch(delta)
        assert apply_patch(old, delta) == new
        # and through the JSON text a history row keeps
        assert apply_patch(old, json.loads(patch_json(delta))) == new


@pytest.mark.parametrize("old,new", [
    ("", ""), ("", "x"), ("x", ""), ("a\r\nb\r\n", "a\r\nB\r\n"), ("a\n", "a"), ("a", "a\n"), ("\n\n\n", "\n"),
    ("same", "same"),
])
def test_edge_texts_round_trip(old, new):
    assert apply_patch(old, make_delta(old, new)) == new


def test_identical_texts_make_an_empty_patch():
    assert make_delta("a\nb", "a\nb") == {"v": 1, "h": []}


def test_a_one_line_edit_of_a_big_document_is_one_small_hunk():
    lines = [f"line {index} " + "x" * 40 for index in range(20_000)]
    old = join_lines(lines)
    edited = list(lines)
    edited[12_345] = "changed"
    delta = make_delta(old, join_lines(edited))
    assert delta["h"] == [[12_345, 1, ["changed"]]]
    assert patch_bytes(delta) < 100 < len(old.encode("utf-8")) / 10_000


def test_the_common_head_and_tail_are_cut_before_diffing():
    delta = make_delta("a\nb\nc\nd\ne", "a\nb\nX\nd\ne")
    assert delta["h"] == [[2, 1, ["X"]]]


def test_a_document_too_long_to_diff_gets_no_delta():
    old = join_lines([str(index) for index in range(60)])
    new = join_lines([str(index + 1) for index in range(60)])
    assert make_delta(old, new, max_lines=10) is None
    assert make_delta(old, new) is not None


# ------------------------------------------------- the cost of diffing a long document with repeated lines

def test_two_distant_edits_of_a_long_document_with_repeated_lines_diff_instantly():
    """20,000 lines, a quarter blank: after cutting the common head and tail the middle is the whole document, and
    `difflib(autojunk=False)` needed ~10 s for it (3.6 s at 12,000 lines, 17 s at 25,000) - on the event loop of the
    server, which stalled every other request meanwhile."""
    lines = repetitive_lines(random.Random(1), 20_000)
    edited = list(lines)
    edited[3] = "EDITED NEAR THE HEAD"
    edited[-4] = "EDITED NEAR THE TAIL"
    old, new = join_lines(lines), join_lines(edited)
    started = time.perf_counter()
    delta = make_delta(old, new)
    elapsed = time.perf_counter() - started
    assert elapsed < 1.0, f"took {elapsed:.2f} s"
    assert delta is not None and apply_patch(old, delta) == new
    assert [hunk[0] for hunk in delta["h"]] == [3, len(lines) - 4], "still the two small hunks, not a rewrite"
    assert patch_bytes(delta) < 200


def test_patches_of_long_repetitive_documents_always_apply():
    """`autojunk` changes which patch comes out, never whether it is right."""
    rng = random.Random(20261024)
    for _ in range(25):
        lines = repetitive_lines(rng, rng.randint(300, 1500))
        edited = list(lines)
        for _ in range(rng.randint(1, 12)):
            position = rng.randint(0, len(edited))
            action = rng.choice(["blank", "rule", "delete", "block", "row", "text"])
            if action == "blank":
                edited[position:position] = [""] * rng.randint(1, 4)
            elif action == "rule":
                edited[position:position] = ["---"]
            elif action == "delete":
                del edited[position:position + rng.randint(1, 40)]
            elif action == "block":
                edited[position:position] = edited[:rng.randint(1, 30)]
            elif action == "row":
                edited[position:position] = ["| name | value | note |"] * rng.randint(1, 3)
            else:
                edited[min(position, len(edited) - 1)] = f"new text {rng.random()}"
        old, new = join_lines(lines), join_lines(edited)
        delta = make_delta(old, new)
        assert delta is not None
        validate_patch(delta)
        assert apply_patch(old, delta) == new
        assert apply_patch(old, json.loads(patch_json(delta))) == new


def test_a_document_whose_lines_repeat_too_much_to_diff_cheaply_gets_no_delta():
    """Not a few popular lines (difflib skips those) but 150 distinct ones, each 130 times: ~2 s of quadratic work
    for 20,000 lines. It is refused up front, in a few milliseconds; the caller then keeps the whole text."""
    old_lines, new_lines = shuffled_vocabulary(random.Random(3), 20_000)
    old, new = join_lines(old_lines), join_lines(new_lines)
    started = time.perf_counter()
    assert make_delta(old, new) is None
    assert time.perf_counter() - started < 0.5, "it says no without paying for the diff"


def test_the_pair_budget_is_the_only_thing_that_refused_and_a_smaller_text_still_diffs():
    old_lines, new_lines = shuffled_vocabulary(random.Random(4), 3_000)
    old, new = join_lines(old_lines), join_lines(new_lines)
    assert make_delta(old, new, max_pairs=1_000) is None
    delta = make_delta(old, new)
    assert delta is not None and apply_patch(old, delta) == new


def test_anchor_pairs_counts_what_difflib_will_walk():
    """`_anchor_pairs` mirrors difflib's own "popular line" rule; this fails loudly if CPython ever changes it."""
    rng = random.Random(5)
    for size in (0, 1, 50, 199, 200, 201, 1000, 4000):
        for kinds in (3, 40, 400):
            a = [f"k{rng.randint(0, kinds)}" for _ in range(size)]
            b = [f"k{rng.randint(0, kinds)}" for _ in range(size)]
            matcher = SequenceMatcher(None, a, b, autojunk=True)
            assert _anchor_pairs(a, b) == sum(len(matcher.b2j.get(line, ())) for line in a), (size, kinds)


# ----------------------------------------------------------------------- refusals

@pytest.mark.parametrize("bad", [
    {"v": 2, "h": []},
    {"h": []},
    {"v": 1},
    {"v": 1, "h": "x"},
    {"v": 1, "h": [[0, 1]]},
    {"v": 1, "h": [[0, 1, [1]]]},
    {"v": 1, "h": [[-1, 0, []]]},
    {"v": 1, "h": [[0, -1, []]]},
    {"v": 1, "h": [[True, 1, []]]},
    {"v": 1, "h": [["0", 1, []]]},
    {"v": 1, "h": [[0, 1, "x"]]},
    {"v": 1, "h": [[2, 1, []], [1, 1, []]]},
    {"v": 1, "h": [[0, 3, []], [2, 1, []]]},
    [],
    None,
])
def test_malformed_patches_are_refused(bad):
    with pytest.raises(ValueError):
        apply_patch("a\nb\nc\nd", bad)


def test_a_hunk_outside_the_base_is_refused():
    with pytest.raises(ValueError):
        apply_patch("a\nb", patch((1, 5, [])))
    with pytest.raises(ValueError):
        apply_patch("a\nb", patch((3, 0, ["x"])))
    # the last position (== number of lines) is a legal insertion point
    assert apply_patch("a\nb", patch((2, 0, ["x"]))) == "a\nb\nx"


# ------------------------------------------------------------------------ the hash

def test_sha256_matches_the_standard_vectors_and_utf8():
    assert sha256_hex("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert sha256_hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert sha256_hex("Việt Nam ệ") == hashlib.sha256("Việt Nam ệ".encode("utf-8")).hexdigest()
    assert sha256_hex("ệ" * 70_000) == hashlib.sha256(("ệ" * 70_000).encode("utf-8")).hexdigest()
