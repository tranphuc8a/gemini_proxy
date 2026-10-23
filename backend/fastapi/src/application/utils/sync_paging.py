"""Cutting a page of records for a pull by cursor (md-sync B7) - a pure function.

The cursor is a record's `serverUpdatedAt` and the next call asks for strictly more, so a page
must not end between two records that carry the same stamp (two requests landing in the same
few milliseconds can stamp alike): the second would never be delivered. The page is then ended
BEFORE that run - a little shorter, never lossy. Same rule as `/wiki` (`wiki_usecase.list_items`),
plus one case `/wiki` does not handle: when the page is nothing but that run (a tiny `limit`, or a
crowd of simultaneous writes), the run is delivered whole, so the page may be longer than `size`. The
caller then fetched at most `size + 1` records and the run may go on past them: when
`len(page) >= fetched` it fetches again with a larger limit (`MarkdownDocsUseCase.changes`).
"""

from __future__ import annotations

from typing import Callable, List, Sequence, Tuple, TypeVar

T = TypeVar("T")


def cut_page(
    found: Sequence[T],
    size: int,
    page_bytes: int,
    weigh: Callable[[T], int],
    stamp: Callable[[T], int],
) -> Tuple[List[T], bool]:
    """`(page, more)` from `found` (oldest stamp first, up to `size + 1` records).

    A page holds at most `size` records and about `page_bytes` of weight, but never fewer than
    one record (a single oversized one must still be deliverable) - and never ends inside a run of
    equal stamps (see the module note).
    """
    more = len(found) > size
    page: List[T] = []
    used = 0
    for item in found[:size]:
        weight = weigh(item)
        if page and used + weight > page_bytes:
            more = True
            break
        page.append(item)
        used += weight
    if more and page and len(found) > len(page) and stamp(found[len(page)]) == stamp(page[-1]):
        last = stamp(page[-1])
        keep = len(page)
        while keep > 0 and stamp(page[keep - 1]) == last:
            keep -= 1
        if keep > 0:
            page = page[:keep]
        else:
            # The whole page is ONE run of equal stamps: there is nowhere to end it before the run, and
            # ending inside it would lose the tail (the next call asks for strictly more). Deliver the
            # run whole - as much of it as `found` holds.
            end = len(page)
            while end < len(found) and stamp(found[end]) == last:
                end += 1
            page = list(found[:end])
            more = len(found) > len(page)
    return page, more

