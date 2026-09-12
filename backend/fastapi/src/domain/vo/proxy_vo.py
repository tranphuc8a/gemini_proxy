"""Value objects for the HTTP forward proxy used by the postman-lite web app.

The browser cannot issue a cross-origin request to a server that does not opt in
with CORS headers, so the app hands the whole request description to the backend
and gets the whole response description back. Bodies travel as text when they are
valid UTF-8 and as base64 otherwise, because JSON cannot carry arbitrary bytes.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

BodyEncoding = Literal["text", "base64"]


class ProxyRequest(BaseModel):
    """One HTTP call the caller wants the server to make on its behalf."""

    method: str = Field(default="GET", max_length=16)
    url: str = Field(min_length=1, max_length=8192)
    headers: Dict[str, str] = Field(default_factory=dict)
    body: Optional[str] = None
    body_encoding: BodyEncoding = "text"
    timeout_seconds: Optional[float] = Field(default=None, gt=0, le=600)
    follow_redirects: bool = True


class ProxyResponse(BaseModel):
    """What the upstream answered, described well enough to render it verbatim."""

    status: int
    status_text: str = ""
    headers: Dict[str, str] = Field(default_factory=dict)
    # Kept alongside `headers` because Set-Cookie legitimately repeats and a dict
    # would silently collapse every cookie but one.
    raw_headers: List[List[str]] = Field(default_factory=list)
    body: str = ""
    body_encoding: BodyEncoding = "text"
    content_type: str = ""
    size_bytes: int = 0
    elapsed_ms: int = 0
    final_url: str = ""
    redirected: bool = False
    truncated: bool = False
