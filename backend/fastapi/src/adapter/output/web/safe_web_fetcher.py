"""Fetch a public web page for the course drafter — and nothing else.

The URL comes from an administrator, but the server must not become a way into
its own network (SSRF). So: http(s) on the standard ports only, no credentials
in the URL, and every address the host name resolves to must be public. The
request then goes to that checked address — it is not resolved again, so a DNS
answer that changes between the check and the connection (rebinding) cannot
send it elsewhere — with the original host in the Host header and in TLS (SNI
and the certificate check). Redirects are followed by hand, each hop checked
the same way; proxies from the environment are ignored. The body is capped, and
HTML is reduced to its text.
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import ssl
from html.parser import HTMLParser
from typing import List, Optional, Tuple
from urllib.parse import urljoin, urlsplit

import httpx

from src.application.exceptions.exceptions import BadRequestError
from src.application.ports.output.web_page_output_port import WebPage, WebPageOutputPort

MAX_BYTES = 8 * 1024 * 1024
MAX_REDIRECTS = 4
TIMEOUT_SECONDS = 15.0
PORTS = {"http": 80, "https": 443}
USER_AGENT = "Mozilla/5.0 (compatible; course-drafter/1.0)"
HTML_TYPES = ("text/html", "application/xhtml+xml")
TEXT_TYPES = ("text/plain", "text/markdown")


def is_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip.split("%", 1)[0])
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not addr.is_multicast


async def resolve(host: str) -> List[str]:
    """Every address `host` resolves to (tests replace this)."""
    infos = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(info[4][0] for info in infos))


def target(url: str) -> Tuple[str, str, str, str]:
    """(scheme, host, Host header, path) of a URL the drafter may fetch, or a 400."""
    try:
        parts = urlsplit((url or "").strip())
        port = parts.port
    except ValueError as exc:
        raise BadRequestError("Địa chỉ URL không hợp lệ") from exc
    scheme = (parts.scheme or "").lower()
    if scheme not in PORTS or not parts.hostname:
        raise BadRequestError("Chỉ tải được trang http:// hoặc https://")
    if parts.username is not None or parts.password is not None:
        raise BadRequestError("URL không được chứa tên đăng nhập hay mật khẩu")
    if port not in (None, PORTS[scheme]):
        raise BadRequestError("Chỉ tải được trang ở cổng chuẩn (80 cho http, 443 cho https)")
    host = parts.hostname
    host_header = f"[{host}]" if ":" in host else host
    return scheme, host, host_header, (parts.path or "/") + (f"?{parts.query}" if parts.query else "")


async def public_address(host: str) -> str:
    try:
        addresses = await resolve(host)
    except (OSError, UnicodeError) as exc:
        raise BadRequestError(f"Không tìm thấy máy chủ {host!r}") from exc
    if not addresses:
        raise BadRequestError(f"Không tìm thấy máy chủ {host!r}")
    if not all(is_public(a) for a in addresses):
        raise BadRequestError("Địa chỉ này trỏ vào mạng nội bộ — chỉ tải được trang công khai trên Internet")
    return addresses[0]


class _Text(HTMLParser):
    """The readable text of a page: headings and list items kept as markdown marks."""

    SKIP = {"script", "style", "noscript", "template", "svg", "head", "iframe", "object"}
    BLOCK = {"p", "div", "br", "li", "ul", "ol", "tr", "table", "section", "article", "header", "footer", "main",
             "pre", "blockquote", "dd", "dt", "hr", "figure", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: List[str] = []
        self.title: List[str] = []
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        elif tag in self.SKIP:
            self._skip += 1
        elif not self._skip and tag in self.BLOCK:
            self.out.append("\n")
            if tag in ("h1", "h2", "h3", "h4"):
                self.out.append("#" * int(tag[1]) + " ")
            elif tag == "li":
                self.out.append("- ")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag in self.SKIP:
            self._skip = max(0, self._skip - 1)
        elif not self._skip and tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title.append(data)
        elif not self._skip:
            self.out.append(data)


def html_to_text(html: str) -> Tuple[str, str]:
    """(title, text) of an HTML document."""
    p = _Text()
    p.feed(html)
    p.close()
    lines = [re.sub(r"[ \t\r\f\v ]+", " ", line).strip() for line in "".join(p.out).split("\n")]
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return " ".join("".join(p.title).split()), text


async def _read_capped(response: httpx.Response) -> bytes:
    declared = response.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_BYTES:
        raise BadRequestError(f"Trang quá lớn (hơn {MAX_BYTES // (1024 * 1024)} MB)")
    chunks, size = [], 0
    async for chunk in response.aiter_bytes():
        size += len(chunk)
        if size > MAX_BYTES:
            raise BadRequestError(f"Trang quá lớn (hơn {MAX_BYTES // (1024 * 1024)} MB)")
        chunks.append(chunk)
    return b"".join(chunks)


def _page(url: str, response: httpx.Response, body: bytes) -> WebPage:
    kind = response.headers.get("content-type", "").split(";")[0].strip().lower()
    if kind == "application/pdf" or body[:5] == b"%PDF-":
        return WebPage(url=url, title=urlsplit(url).path.rsplit("/", 1)[-1], pdf=body)
    if kind and kind not in HTML_TYPES + TEXT_TYPES:
        raise BadRequestError(f"Không đọc được nội dung loại {kind!r} — cần trang HTML, văn bản hoặc PDF")
    text = body.decode(response.charset_encoding or "utf-8", errors="replace")
    if kind in HTML_TYPES or (not kind and "<html" in text[:2000].lower()):
        title, text = html_to_text(text)
        return WebPage(url=url, title=title, text=text)
    return WebPage(url=url, text=text.strip())


_SSL: Optional[ssl.SSLContext] = None


def _ssl_context() -> ssl.SSLContext:
    """One verifying context for every fetch: loading the CA bundle costs ~0.5 s each time."""
    global _SSL
    if _SSL is None:
        import certifi
        _SSL = ssl.create_default_context(cafile=certifi.where())
    return _SSL


class SafeWebFetcher(WebPageOutputPort):
    async def fetch(self, url: str) -> WebPage:
        current = url
        target(current)                                    # a bad URL fails before any connection is set up
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=False, trust_env=False,
                                     verify=_ssl_context()) as client:
            for _ in range(MAX_REDIRECTS + 1):
                scheme, host, host_header, path = target(current)
                ip = await public_address(host)
                netloc = f"[{ip}]" if ":" in ip else ip
                request = client.build_request(
                    "GET", f"{scheme}://{netloc}{path}",
                    headers={"Host": host_header, "User-Agent": USER_AGENT,
                             "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,application/pdf;q=0.8"},
                    extensions={"sni_hostname": host})
                try:
                    response = await client.send(request, stream=True)
                except httpx.TimeoutException as exc:
                    raise BadRequestError(f"Trang không trả lời trong {int(TIMEOUT_SECONDS)} giây") from exc
                except httpx.HTTPError as exc:
                    raise BadRequestError(f"Không tải được trang ({type(exc).__name__})") from exc
                try:
                    location = response.headers.get("location")
                    if response.status_code in (301, 302, 303, 307, 308) and location:
                        current = urljoin(current, location)
                        continue
                    if response.status_code != 200:
                        raise BadRequestError(f"Trang trả về HTTP {response.status_code}")
                    return _page(current, response, await _read_capped(response))
                finally:
                    await response.aclose()
        raise BadRequestError("Trang chuyển hướng quá nhiều lần")
