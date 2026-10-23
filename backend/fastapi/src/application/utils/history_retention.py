"""Which history rows of one document are kept (md-sync §3.5 "Giữ"; policy of Q3/Q4).

Pure: give it the rows' metadata, get back the revisions to keep. A row is kept when it is

* one of the `keep_recent` newest (50),
* the newest row of its local day, for days within the last `daily_days` (90),
* named (`label`) - kept for ever,
* the keyframe (`baseRev`) of any kept delta row: a delta cannot be rebuilt without it.

The hard cap `hard_cap` (300) wins over the daily rule: past it the oldest rows that are kept
only by the daily rule go first (and their keyframes with them, unless something else needs
them). Named and recent rows are never dropped by the cap.
"""

from __future__ import annotations

from typing import Dict, Iterable, Sequence, Set

from src.domain.vo.markdown_docs_vo import Revision

DAY_MS = 24 * 3600 * 1000


def _with_keyframes(kept: Set[int], by_rev: Dict[int, Revision]) -> Set[int]:
    closed = set(kept)
    for rev in kept:
        row = by_rev.get(rev)
        if row is not None and row.encoding == "delta" and row.baseRev is not None and row.baseRev in by_rev:
            closed.add(row.baseRev)
    return closed


def select_keep(
    rows: Iterable[Revision],
    now: int,
    *,
    keep_recent: int = 50,
    daily_days: int = 90,
    tz_offset_minutes: int = 0,
    hard_cap: int = 300,
) -> Set[int]:
    """The `rev`s to keep out of `rows` (metadata is enough: no `body` is read)."""
    ordered: Sequence[Revision] = sorted(rows, key=lambda row: row.rev, reverse=True)
    by_rev = {row.rev: row for row in ordered}

    always: Set[int] = {row.rev for row in ordered[:max(0, keep_recent)]}
    always.update(row.rev for row in ordered if row.label)

    daily: Set[int] = set()
    seen_days: Set[int] = set()
    cutoff = now - daily_days * DAY_MS
    for row in ordered:                                   # newest first: the first row of a day is its newest
        if row.savedAt < cutoff:
            continue
        day = (row.savedAt + tz_offset_minutes * 60_000) // DAY_MS
        if day not in seen_days:
            seen_days.add(day)
            daily.add(row.rev)

    kept = _with_keyframes(always | daily, by_rev)
    if len(kept) <= hard_cap:
        return kept

    droppable = sorted(daily - always)                    # oldest first
    surviving = set(daily)
    for rev in droppable:
        surviving.discard(rev)
        kept = _with_keyframes(always | surviving, by_rev)
        if len(kept) <= hard_cap:
            break
    return kept
