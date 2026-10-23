"""Read-only share links of the markdown editor (md-share, ke-hoach M3).

    POST   /markdown/shares?backend=             admin: make (201) or refresh (200) the link of one document
    GET    /markdown/shares?backend=             admin: every link, newest first, no snapshots
    DELETE /markdown/shares?backend=&docId=      admin: revoke the link of a document
    GET    /markdown/shared?backend=             PUBLIC: the snapshot a link shows; the token travels
                                                 in the `X-Share-Token` header, never in the URL

The token is the read key. The page that opens a link keeps it after `#`
(`.../markdown-editor-pro/#share=<token>&backend=<store>`), so the browser never sends
it to the server as part of a URL, and the API takes it from a header so it does not
land in an access log either (Code Studio puts it in the path; this API deliberately
does not). Every answer is `no-store`; the public read also says `noindex`.

Administration is the markdown administrator (`markdown_admin`: `X-Admin-Session` or
`X-Admin-Key`). Answers are bare JSON; errors use the common envelope with `data.code`.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse

from src.adapter.factory.markdown_share_factory import get_markdown_share_input_port
from src.adapter.input.controllers.admin_auth import client_address
from src.adapter.input.controllers.markdown_admin import require_markdown_admin
from src.application.exceptions.exceptions import AppException
from src.application.ports.input.markdown_share_input_port import MarkdownShareInputPort
from src.application.usecases.markdown_share_usecase import store_unavailable
from src.domain.vo.markdown_share_vo import MarkdownShareIn

router = APIRouter(prefix="/markdown", tags=["markdown-share"])

NO_STORE = {"Cache-Control": "no-store"}
PUBLIC_READ_HEADERS = {
    **NO_STORE,
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
}


@router.post("/shares", status_code=201, dependencies=[Depends(require_markdown_admin)],
             summary="Make a read-only link to one document, or refresh the snapshot of the one it has")
async def create_share(body: MarkdownShareIn, uc: MarkdownShareInputPort = Depends(get_markdown_share_input_port)):
    """The snapshot is the `content` sent here (not the server's saved tree). 201 for a new
    link; 200 when the document already had one - same token, same `sharedAt`."""
    created, out = await uc.create_or_refresh(body)
    return JSONResponse(out, status_code=201 if created else 200, headers=NO_STORE)


@router.get("/shares", dependencies=[Depends(require_markdown_admin)], summary="Every read-only link of this store")
async def list_shares(uc: MarkdownShareInputPort = Depends(get_markdown_share_input_port)):
    return JSONResponse(await uc.list_shares(), headers=NO_STORE)


@router.delete("/shares", dependencies=[Depends(require_markdown_admin)], summary="Revoke the link of a document")
async def revoke_share(
    docId: str = Query(..., min_length=1, max_length=200, description="The id of the shared document"),
    uc: MarkdownShareInputPort = Depends(get_markdown_share_input_port),
):
    return JSONResponse(await uc.revoke(docId), headers=NO_STORE)


@router.get("/shared", summary="PUBLIC: the snapshot a read-only link shows (token in X-Share-Token)")
async def read_shared(
    request: Request,
    x_share_token: Optional[str] = Header(default=None),
    uc: MarkdownShareInputPort = Depends(get_markdown_share_input_port),
):
    # No length or shape check here: a wrong token of any form must get the same 404 as an
    # unknown one (the use case decides), not a 422 that tells them apart. Any other failure
    # is one generic 503 (`store_unavailable`): the app-wide handler of an unexpected error
    # logs the traceback and answers `str(exc)`, and a driver's message carries the token.
    try:
        out = await uc.read_shared(x_share_token or "", ip=client_address(request))
    except Exception as cause:  # noqa: BLE001 - see above: nothing unexpected may reach the app-wide 500
        error = cause if isinstance(cause, AppException) else store_unavailable(cause)
        error.headers = {**(error.headers or {}), **PUBLIC_READ_HEADERS}
        if error is cause:
            raise
        raise error from None
    return JSONResponse(out, headers=PUBLIC_READ_HEADERS)
