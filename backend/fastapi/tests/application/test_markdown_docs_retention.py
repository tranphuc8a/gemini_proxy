"""Which versions of a document the history keeps (policy of Q3/Q4, md-sync §3.5 "Giữ").

The pure rule `select_keep` first, then the whole path: 200 pushes spread over 120 days through the
use case, and what is left in the store - the 50 newest, the newest of each of the last 90 days, the
named ones, and the keyframe every kept delta needs, each still rebuilding to the text that was saved.
"""

import os

os.environ.setdefault("TESTING", "1")

import random
from datetime import datetime, timezone

from src.application.utils.history_retention import DAY_MS, select_keep
from src.domain.vo.markdown_docs_vo import Revision
from tests.conftest import arun
from tests.support.markdown_docs import T0, file_op, make_uc, push_one

SPACE = "default"
HOUR = 3_600_000


def row(rev, saved_at, encoding="full", base=None, label=None) -> Revision:
    return Revision(docId="d1", rev=rev, encoding=encoding, baseRev=base, label=label, savedAt=saved_at, hash="h" * 64)


# ------------------------------------------------------------------------ the pure rule

def test_a_short_recent_history_is_kept_whole():
    rows = [row(n, T0 - (10 - n) * HOUR) for n in range(1, 11)]
    assert select_keep(rows, T0) == set(range(1, 11))


def test_the_fifty_newest_stay_whatever_their_age():
    rows = [row(n, T0 - (300 - n) * DAY_MS) for n in range(1, 61)]                 # 60 rows, all more than 90 days old
    kept = select_keep(rows, T0)
    assert kept == set(range(11, 61)), "the newest 50 survive even when they are a year old; the older ones go"


def test_beyond_the_fifty_only_the_newest_of_each_recent_day_stays():
    day = 1_760_000_000_000 // DAY_MS * DAY_MS                                       # a UTC midnight
    rows = []
    rev = 0
    for days_ago in range(40, 0, -1):                                                # 40 days, 5 rows each: 200 rows
        for slot in range(5):
            rev += 1
            rows.append(row(rev, day - days_ago * DAY_MS + slot * HOUR))
    now = day + 12 * HOUR
    kept = select_keep(rows, now, keep_recent=50, daily_days=90, tz_offset_minutes=0)
    newest_of_day = {max(r.rev for r in rows if (r.savedAt // DAY_MS) == d) for d in {r.savedAt // DAY_MS for r in rows}}
    assert kept == set(range(151, 201)) | newest_of_day
    assert len(kept) == 50 + len(newest_of_day - set(range(151, 201)))


def test_the_day_is_the_local_day_not_the_utc_one():
    midnight = 1_760_000_000_000 // DAY_MS * DAY_MS
    late = row(1, midnight + 20 * HOUR)             # 20:00 UTC = 03:00 next day at +07:00
    early = row(2, midnight + 23 * HOUR)            # 23:00 UTC = 06:00 next day at +07:00
    other = row(3, midnight + 30 * HOUR)            # 06:00 UTC next day = 13:00 same local day as the others at +07:00
    now = midnight + 40 * HOUR
    assert select_keep([late, early, other], now, keep_recent=1, tz_offset_minutes=0) == {3, 2}, "UTC: rows 1 and 2 share a day"
    assert select_keep([late, early, other], now, keep_recent=1, tz_offset_minutes=420) == {3}, "+07:00: all three are one local day"


def test_a_named_version_is_kept_for_ever():
    old = row(1, T0 - 400 * DAY_MS, label="1.0 release")
    rows = [old] + [row(n, T0 - (200 - n) * HOUR) for n in range(2, 200)]
    assert 1 in select_keep(rows, T0)


def test_a_kept_delta_keeps_the_keyframe_it_is_built_on():
    frame = row(1, T0 - 200 * DAY_MS)
    delta = row(2, T0 - 100 * HOUR, "delta", base=1)
    filler = [row(n, T0 - (60 - n) * HOUR, "full") for n in range(3, 70)]
    kept = select_keep([frame, delta] + filler, T0, keep_recent=100)
    assert {1, 2} <= kept

    older = select_keep([frame, delta], T0 + 300 * DAY_MS, keep_recent=1, daily_days=90)
    assert older == {2, 1}, "the newest row is always kept, and takes its keyframe along"


def test_the_hard_cap_drops_the_oldest_daily_rows_first_but_never_recent_or_named():
    day0 = 1_760_000_000_000 // DAY_MS * DAY_MS
    rows = [row(n, day0 - (340 - n) * DAY_MS) for n in range(1, 341)]                  # 340 rows, one per day, 340 days
    rows[4] = row(5, rows[4].savedAt, label="keep me")
    now = day0 + 10 * HOUR
    kept = select_keep(rows, now, keep_recent=50, daily_days=400, hard_cap=100)
    assert len(kept) <= 100
    assert set(range(291, 341)) <= kept and 5 in kept
    assert max(r for r in kept if r < 291 and r != 5) == 340 - 50 and min(kept - {5}) > 100, "the cap cut from the old end"


def test_nothing_in_nothing_out():
    assert select_keep([], T0) == set()


# ---------------------------------------------------------------- through the use case

def utc_day(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def test_two_hundred_edits_over_four_months_leave_exactly_what_the_policy_promises(tmp_path):
    rng = random.Random(3)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0, history_tz_minutes=0)
        words = ["alpha", "beta", "gamma", "tiếng", "việt"]
        text = "\n".join(f"{n}: " + " ".join(rng.choice(words) for _ in range(9)) for n in range(120)) + "\n"
        journal = {}
        await push_one(uc, file_op("d1", text, name="a.md"))
        journal[1] = (text, clock.now)
        rev = 1
        for step in range(199):
            clock.advance(int(0.6 * DAY_MS))                                           # 199 x 0.6 day = about 119 days
            rows = text.split("\n")
            rows[rng.randrange(len(rows))] = f"edit {step} " + "x" * rng.randrange(30)
            text = "\n".join(rows)
            rev = (await push_one(uc, file_op("d1", text, base=rev)))["rev"]
            journal[rev] = (text, clock.now)
            if rev == 31:                                                              # the owner names an early version
                named = rev
                keep_row = await repo.get_revision(SPACE, "d1", named)
                await repo.add_revision(SPACE, keep_row.model_copy(update={"label": "milestone"}))
        rev = (await push_one(uc, file_op("d1", text + "one more\n", base=rev)))["rev"]  # the next write applies the policy again
        journal[rev] = (text + "one more\n", clock.now)
        kept = await repo.list_revisions(SPACE, "d1")
        rebuilt = {r.rev: (await uc.get_revision("d1", r.rev))["content"] for r in kept}
        return journal, kept, rebuilt, named, clock.now

    journal, kept, rebuilt, named, now = arun(scenario())
    kept_revs = {r.rev for r in kept}
    newest = sorted(journal)[-50:]
    assert set(newest) <= kept_revs, "the 50 newest versions are all there"
    assert named in kept_revs, "a named version is kept although it is a hundred days old"

    cutoff = now - 90 * DAY_MS
    by_day = {}
    for rev_no, (_text, saved) in journal.items():
        if saved >= cutoff:
            by_day.setdefault(utc_day(saved), []).append(rev_no)
    for day, revs in by_day.items():
        assert max(revs) in kept_revs, f"the last version of {day} is kept"

    by_rev = {r.rev: r for r in kept}
    for r in kept:
        if r.encoding == "delta":
            assert r.baseRev in by_rev and by_rev[r.baseRev].encoding == "full", "a delta never outlives its keyframe"
    allowed = set(newest) | {max(revs) for revs in by_day.values()} | {named} | {r.rev for r in kept if r.encoding == "full"}
    assert kept_revs <= allowed, "nothing else is kept: " + str(sorted(kept_revs - allowed))
    assert len(kept_revs) < 140, "200 versions became about a hundred and twenty"
    for rev_no, content in rebuilt.items():
        assert content == journal[rev_no][0], f"version {rev_no} rebuilds to the text that was saved"


def test_a_dormant_document_keeps_its_history_until_it_is_written_again(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        await push_one(uc, file_op("d1", "first version", name="a.md"))
        await push_one(uc, file_op("d1", "second version", base=1))
        clock.advance(500 * DAY_MS)
        return [r.rev for r in await repo.list_revisions(SPACE, "d1")]

    assert arun(scenario()) == [1, 2], "the policy runs when history is written, not on a timer"
