"""Delta sync of the markdown editor's documents (md-sync B11, ke-hoach M4a).

    GET  /markdown/sync/changes?since=&limit=&device=&backend=   reader: records newer than the cursor
    POST /markdown/sync/push?backend=                            admin: apply a batch of node changes
    GET  /markdown/docs/{id}?backend=                            reader: the latest text of one document
    GET  /markdown/docs/{id}/revisions?before=&limit=&backend=   admin: its history, newest first, no text
    GET  /markdown/docs/{id}/revisions/{rev}?backend=            admin: one version rebuilt to its full text

"Reader" is the markdown administrator unless `MARKDOWN_PUBLIC_READ` is on (Q1: the store is
private by default); "admin" is always the administrator (`markdown_admin`: `X-Admin-Session`
or `X-Admin-Key`). History is never public. Answers are bare JSON and `no-store`; errors use the
common envelope `{status_code, message, data: {code}}`. The first call to `changes` or `push`
copies the old whole-tree store into this one (lazily, once; the old data is not touched).

A body that is not the right shape is refused with 422 before it reaches the use case; a body
that is too big or repeats a node is 400 for the whole request; a single op that cannot be
applied comes back as `rejected` / `conflict` in `results` while the others stand.
"""

from __future__ import annotations

from typing import Any, Awaitable, Dict, Optional

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import JSONResponse

from src.adapter.factory.markdown_docs_factory import get_markdown_docs_input_port
from src.adapter.input.controllers.markdown_admin import require_markdown_admin, require_markdown_reader
from src.application.exceptions.exceptions import AppException
from src.application.ports.input.markdown_docs_input_port import MarkdownDocsInputPort
from src.application.usecases.markdown_docs_usecase import store_unavailable
from src.domain.vo.markdown_docs_vo import PushRequest
from src.domain.vo.markdown_ids import DOC_ID_PATTERN

router = APIRouter(prefix="/markdown", tags=["markdown-sync"])

NO_STORE = {"Cache-Control": "no-store"}


async def _answer(call: Awaitable[Dict[str, Any]]) -> JSONResponse:
    """The use case's answer as `no-store` JSON. A failing store is one generic 503 (`store_unavailable`):
    the app-wide handler of an unexpected error would put the driver's message (database host, statement,
    the pushed text) in the body."""
    try:
        return JSONResponse(await call, headers=NO_STORE)
    except AppException:
        raise
    except Exception as cause:  # noqa: BLE001 - whatever the driver raised
        raise store_unavailable(cause) from None


def _doc_id() -> str:
    return Path(..., pattern=DOC_ID_PATTERN, max_length=80, description="The id of the document")


@router.get("/sync/changes", dependencies=[Depends(require_markdown_reader)],
            summary="Records changed since the cursor (one page)")
async def sync_changes(
    since: int = Query(default=0, ge=0, le=2**53, description="The `cursor` of the previous call; 0 = everything"),
    limit: Optional[int] = Query(default=None, ge=1, le=1000),
    device: str = Query(default="", pattern=r"^[A-Za-z0-9_.:-]{0,64}$",
                        description="This device: its own writes come back without text"),
    uc: MarkdownDocsInputPort = Depends(get_markdown_docs_input_port),
):
    return await _answer(uc.changes(since, limit, device))


@router.post("/sync/push", dependencies=[Depends(require_markdown_admin)],
             summary="Apply the changed nodes (each op ok / conflict / rejected on its own)")
async def sync_push(body: PushRequest, uc: MarkdownDocsInputPort = Depends(get_markdown_docs_input_port)):
    return await _answer(uc.push(body))


@router.get("/docs/{doc_id}", dependencies=[Depends(require_markdown_reader)],
            summary="The latest text of one document, by id")
async def get_document(doc_id: str = _doc_id(), uc: MarkdownDocsInputPort = Depends(get_markdown_docs_input_port)):
    return await _answer(uc.get_document(doc_id))


@router.get("/docs/{doc_id}/revisions", dependencies=[Depends(require_markdown_admin)],
            summary="Version history of one document, newest first (no text)")
async def list_revisions(
    doc_id: str = _doc_id(),
    before: Optional[int] = Query(default=None, ge=0, description="Only versions older than this rev"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    uc: MarkdownDocsInputPort = Depends(get_markdown_docs_input_port),
):
    return await _answer(uc.list_revisions(doc_id, before, limit))


@router.get("/docs/{doc_id}/revisions/{rev}", dependencies=[Depends(require_markdown_admin)],
            summary="One version of a document, rebuilt to its full text")
async def get_revision(
    doc_id: str = _doc_id(),
    rev: int = Path(..., ge=1, le=2**31 - 1),
    uc: MarkdownDocsInputPort = Depends(get_markdown_docs_input_port),
):
    return await _answer(uc.get_revision(doc_id, rev))
