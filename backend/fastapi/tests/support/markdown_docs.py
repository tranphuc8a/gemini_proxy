"""Helpers shared by the markdown delta-sync tests: a fake clock, a use case on a temporary JSON
store, and builders for push ops (so a test says WHAT is pushed, not how it is encoded)."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional

from src.adapter.output.markdown_docs.json_repository import JsonMarkdownDocsRepository
from src.application.usecases.markdown_docs_usecase import MarkdownDocsUseCase
from src.application.utils.line_patch import make_delta, sha256_hex
from src.domain.vo.markdown_docs_vo import PushOp, PushRequest

T0 = 1_761_000_000_000          # 2025-10-20, an arbitrary "now"
DAY = 24 * 3600 * 1000


class Clock:
    def __init__(self, now: int = T0):
        self.now = now

    def __call__(self) -> int:
        return self.now

    def advance(self, ms: int) -> int:
        self.now += ms
        return self.now


def make_uc(tmp_path, clock: Optional[Clock] = None, legacy=None, shares=None, **options):
    """`(use_case, repository, clock)` over a JSON store in `tmp_path`, already marked migrated unless a legacy reader is given."""
    clock = clock or Clock()
    repo = JsonMarkdownDocsRepository(file_path=tmp_path / "markdown-docs.json")
    uc = MarkdownDocsUseCase(repo, legacy, shares, clock=clock, **options)
    return uc, repo, clock


def file_op(doc_id: str, content: str, base: int = 0, name: Optional[str] = None, parent: Any = "root", **extra) -> Dict[str, Any]:
    op: Dict[str, Any] = {
        "id": doc_id, "kind": "file", "baseRev": base, "content": content, "hash": sha256_hex(content),
        "updatedAt": T0, **extra,
    }
    meta = {}
    if name is not None:
        meta["name"] = name
    if parent != "unset":
        meta["parentId"] = parent
    if meta:
        op["set"] = meta
    return op


def patch_op(doc_id: str, old: str, new: str, base: int, **extra) -> Dict[str, Any]:
    return {
        "id": doc_id, "kind": "file", "baseRev": base, "patch": make_delta(old, new), "baseHash": sha256_hex(old),
        "hash": sha256_hex(new), "updatedAt": T0, **extra,
    }


def meta_op(doc_id: str, base: int, kind: str = "file", **meta) -> Dict[str, Any]:
    return {"id": doc_id, "kind": kind, "baseRev": base, "set": meta, "updatedAt": T0}


def delete_op(doc_id: str, base: int, kind: str = "file") -> Dict[str, Any]:
    return {"id": doc_id, "kind": kind, "baseRev": base, "deleted": True, "updatedAt": T0}


def folder_op(doc_id: str, name: str, base: int = 0, parent: Any = "root", **extra) -> Dict[str, Any]:
    return {"id": doc_id, "kind": "folder", "baseRev": base, "set": {"name": name, "parentId": parent}, "updatedAt": T0, **extra}


def request(*ops: Dict[str, Any], device: str = "dev-a") -> PushRequest:
    return PushRequest(device=device, ops=[PushOp(**op) for op in ops])


async def push(uc: MarkdownDocsUseCase, *ops: Dict[str, Any], device: str = "dev-a") -> List[Dict[str, Any]]:
    return (await uc.push(request(*ops, device=device)))["results"]


async def push_one(uc: MarkdownDocsUseCase, op: Dict[str, Any], device: str = "dev-a") -> Dict[str, Any]:
    return (await push(uc, op, device=device))[0]


# ------------------------------------------------------- big documents (the cost of diffing them)

def repetitive_lines(rng, count: int, blank: float = 0.25) -> List[str]:
    """Lines as a real long document has them: a quarter blank, `---` rules and table rows over and over, the rest
    unique paragraphs. This is the shape that made `difflib(autojunk=False)` quadratic."""
    out: List[str] = []
    for number in range(count):
        roll = rng.random()
        if roll < blank:
            out.append("")
        elif roll < blank + 0.05:
            out.append("---")
        elif roll < blank + 0.15:
            out.append("| name | value | note |")
        else:
            out.append(f"paragraph {number} " + "x" * rng.randint(5, 60))
    return out


def shuffled_vocabulary(rng, count: int, kinds: int = 150):
    """`(old_lines, new_lines)`: `count` lines drawn from `kinds` distinct ones (each a fraction of a percent of the text, so
    never "popular" to difflib, yet repeated 100+ times) and the same lines with the middle shuffled. The one input
    whose diff cost is quadratic whatever `autojunk` says: it must be refused, not computed."""
    vocabulary = [f"line kind {n}" for n in range(kinds)]
    old = [rng.choice(vocabulary) for _ in range(count)]
    new = list(old)
    middle = new[100:-100]
    rng.shuffle(middle)
    new[100:-100] = middle
    return old, new


class LoopWatch:
    """`async with LoopWatch() as watch:` - a task that ticks every 20 ms and remembers its longest gap
    (`watch.longest`, seconds): how long the event loop was stuck by whatever ran inside the block."""

    def __init__(self):
        self.longest = 0.0
        self._stop = asyncio.Event()
        self._task = None

    async def __aenter__(self):
        async def tick():
            last = time.perf_counter()
            while not self._stop.is_set():
                await asyncio.sleep(0.02)
                now = time.perf_counter()
                self.longest = max(self.longest, now - last)
                last = now

        self._task = asyncio.create_task(tick())
        await asyncio.sleep(0.05)
        return self

    async def __aexit__(self, *exc):
        self._stop.set()
        await self._task
