"""The drafter's web fetch: public pages only, sent to the address that was checked.

DNS is replaced by a table, and respx answers at the HTTP layer — so these
tests also show WHERE the request went: to the checked IP, with the original
host in the Host header and as the TLS server name.
"""

from __future__ import annotations

import httpx
import pytest
import respx

from src.adapter.output.web import safe_web_fetcher as F
from src.application.exceptions.exceptions import BadRequestError
from tests.conftest import arun

PUBLIC = "93.184.216.34"
PUBLIC6 = "2606:2800:220:1::1"


@pytest.fixture
def dns(monkeypatch):
    table = {
        "example.org": [PUBLIC], "v6.example.org": [PUBLIC6],
        "evil.test": ["10.0.0.7"], "mixed.test": [PUBLIC, "127.0.0.1"], "meta.test": ["169.254.169.254"],
        "mapped.test": ["::ffff:127.0.0.1"], "localhost": ["127.0.0.1", "::1"], "127.0.0.1": ["127.0.0.1"],
        "cgnat.test": ["100.64.0.1"], "multicast.test": ["224.0.0.1"],
    }

    async def resolve(host):
        if host not in table:
            raise OSError("no such host")
        return table[host]

    monkeypatch.setattr(F, "resolve", resolve)
    return table


def _fetch(url):
    return arun(F.SafeWebFetcher().fetch(url))


@pytest.mark.parametrize("url", [
    "ftp://example.org/x", "file:///etc/passwd", "javascript:alert(1)", "example.org/no-scheme",
    "http://user:pw@example.org/", "http://user@example.org/", "http://example.org:8080/",
    "https://example.org:22/", "http://[::1/", "http://nowhere.test/",
])
def test_only_plain_web_urls_on_standard_ports(url, dns):
    with pytest.raises(BadRequestError):
        _fetch(url)


@pytest.mark.parametrize("host", ["evil.test", "mixed.test", "meta.test", "mapped.test", "localhost", "127.0.0.1",
                                  "cgnat.test", "multicast.test"])
@respx.mock
def test_any_private_address_refuses_the_whole_host(host, dns):
    with pytest.raises(BadRequestError) as exc:
        _fetch(f"http://{host}/")
    assert "nội bộ" in exc.value.message
    assert not respx.calls, "nothing was sent"


@respx.mock
def test_a_public_page_goes_to_the_checked_address_with_its_own_name(dns):
    route = respx.get(f"https://{PUBLIC}/bai?x=1").mock(return_value=httpx.Response(
        200, headers={"content-type": "text/html; charset=utf-8"},
        text="<html><head><title> Tiêu   đề </title><script>danger()</script><style>p{}</style></head>"
             "<body><h2>Mục một</h2><p>Nội dung&nbsp;chính &amp; phụ</p><ul><li>một</li><li>hai</li></ul>"
             "<svg><text>hình</text></svg></body></html>"))
    page = _fetch("https://example.org/bai?x=1")
    req = route.calls.last.request
    assert req.headers["host"] == "example.org" and req.extensions["sni_hostname"] == "example.org"
    assert page.title == "Tiêu đề" and page.pdf is None
    assert "## Mục một" in page.text and "Nội dung chính & phụ" in page.text and "- một\n" in page.text
    assert "danger" not in page.text and "hình" not in page.text and "p{}" not in page.text


@respx.mock
def test_an_ipv6_address_is_bracketed(dns):
    respx.get(f"https://[{PUBLIC6}]/").mock(return_value=httpx.Response(200, text="ok", headers={"content-type": "text/plain"}))
    assert _fetch("https://v6.example.org").text == "ok"


@respx.mock
def test_redirects_are_followed_and_each_hop_is_checked(dns):
    respx.get(f"http://{PUBLIC}/a").mock(return_value=httpx.Response(301, headers={"location": "/b"}))
    respx.get(f"http://{PUBLIC}/b").mock(return_value=httpx.Response(200, text="xin chào", headers={"content-type": "text/plain"}))
    assert _fetch("http://example.org/a").text == "xin chào"

    respx.get(f"http://{PUBLIC}/r").mock(return_value=httpx.Response(302, headers={"location": "http://meta.test/latest"}))
    with pytest.raises(BadRequestError) as exc:
        _fetch("http://example.org/r")
    assert "nội bộ" in exc.value.message

    respx.get(f"http://{PUBLIC}/loop").mock(return_value=httpx.Response(302, headers={"location": "/loop"}))
    with pytest.raises(BadRequestError) as exc:
        _fetch("http://example.org/loop")
    assert "chuyển hướng" in exc.value.message


@respx.mock
def test_errors_sizes_and_kinds(dns, monkeypatch):
    respx.get(f"http://{PUBLIC}/404").mock(return_value=httpx.Response(404))
    with pytest.raises(BadRequestError) as exc:
        _fetch("http://example.org/404")
    assert "404" in exc.value.message

    respx.get(f"http://{PUBLIC}/png").mock(return_value=httpx.Response(200, content=b"\x89PNG", headers={"content-type": "image/png"}))
    with pytest.raises(BadRequestError):
        _fetch("http://example.org/png")

    monkeypatch.setattr(F, "MAX_BYTES", 10)
    respx.get(f"http://{PUBLIC}/big").mock(return_value=httpx.Response(200, content=b"x" * 11, headers={"content-type": "text/plain"}))
    with pytest.raises(BadRequestError) as exc:
        _fetch("http://example.org/big")
    assert "quá lớn" in exc.value.message

    respx.get(f"http://{PUBLIC}/slow").mock(side_effect=httpx.ReadTimeout("slow"))
    with pytest.raises(BadRequestError):
        _fetch("http://example.org/slow")


@respx.mock
def test_a_pdf_comes_back_as_bytes(dns):
    respx.get(f"https://{PUBLIC}/doc.pdf").mock(return_value=httpx.Response(
        200, content=b"%PDF-1.7 ...", headers={"content-type": "application/pdf"}))
    page = _fetch("https://example.org/doc.pdf")
    assert page.pdf == b"%PDF-1.7 ..." and page.title == "doc.pdf" and page.text == ""
