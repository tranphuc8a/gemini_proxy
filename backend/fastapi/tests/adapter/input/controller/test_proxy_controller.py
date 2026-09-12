"""Tests for the HTTP forward proxy that lets postman-lite bypass CORS.

Upstream traffic is intercepted with respx, so nothing leaves the machine.
"""

import base64
import os

os.environ.setdefault("TESTING", "1")

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from src.application.config.config import settings
from src.main import app

BASE = f"{settings.API_PREFIX}/proxy"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def default_proxy_settings(monkeypatch):
    monkeypatch.setattr(settings, "PROXY_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "PROXY_ALLOWED_HOSTS", "*", raising=False)
    monkeypatch.setattr(settings, "PROXY_MAX_BYTES", 10 * 1024 * 1024, raising=False)


def test_status_reports_configuration(client):
    body = client.get(f"{BASE}/status").json()
    assert body["status_code"] == 200
    assert body["data"]["enabled"] is True


@respx.mock
def test_forwards_get_and_returns_all_upstream_headers(client):
    respx.get("https://api.example.com/items").mock(
        return_value=httpx.Response(
            200,
            headers={"content-type": "application/json", "x-custom": "visible"},
            json={"ok": True},
        )
    )

    body = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://api.example.com/items"},
    ).json()

    data = body["data"]
    assert data["status"] == 200
    assert data["body_encoding"] == "text"
    assert '"ok"' in data["body"]
    # The point of the proxy: a cross-origin fetch would hide x-custom.
    assert data["headers"]["x-custom"] == "visible"


@respx.mock
def test_forwards_body_and_headers_the_browser_refuses_to_send(client):
    route = respx.post("https://api.example.com/login").mock(
        return_value=httpx.Response(201, text="created")
    )

    client.post(
        f"{BASE}/request",
        json={
            "method": "POST",
            "url": "https://api.example.com/login",
            "headers": {
                "Cookie": "session=abc",
                "User-Agent": "postman-lite",
                "Content-Length": "999",
            },
            "body": '{"user":"a"}',
        },
    )

    sent = route.calls[0].request
    assert sent.content == b'{"user":"a"}'
    assert sent.headers["cookie"] == "session=abc"
    assert sent.headers["user-agent"] == "postman-lite"
    # Hop-by-hop headers describe the browser->backend hop, not this one.
    assert sent.headers["content-length"] == str(len(sent.content))


@respx.mock
def test_binary_response_comes_back_as_base64(client):
    png = b"\x89PNG\r\n\x1a\n\x00\xff\xfe"
    respx.get("https://cdn.example.com/a.png").mock(
        return_value=httpx.Response(200, headers={"content-type": "image/png"}, content=png)
    )

    data = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://cdn.example.com/a.png"},
    ).json()["data"]

    assert data["body_encoding"] == "base64"
    assert base64.b64decode(data["body"]) == png


@respx.mock
def test_base64_request_body_is_decoded_before_sending(client):
    route = respx.put("https://api.example.com/blob").mock(
        return_value=httpx.Response(204)
    )

    client.post(
        f"{BASE}/request",
        json={
            "method": "PUT",
            "url": "https://api.example.com/blob",
            "body": base64.b64encode(b"\x00\x01\x02").decode(),
            "body_encoding": "base64",
        },
    )

    assert route.calls[0].request.content == b"\x00\x01\x02"


@respx.mock
def test_oversized_response_is_truncated_not_dropped(client, monkeypatch):
    monkeypatch.setattr(settings, "PROXY_MAX_BYTES", 8, raising=False)
    respx.get("https://api.example.com/big").mock(
        return_value=httpx.Response(200, text="x" * 100)
    )

    data = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://api.example.com/big"},
    ).json()["data"]

    assert data["truncated"] is True
    assert data["size_bytes"] == 100
    assert len(data["body"]) == 8


@respx.mock
def test_upstream_error_status_is_passed_through_not_raised(client):
    respx.get("https://api.example.com/missing").mock(
        return_value=httpx.Response(404, text="nope")
    )

    body = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://api.example.com/missing"},
    ).json()

    # The call succeeded; it is the upstream that said 404.
    assert body["status_code"] == 200
    assert body["data"]["status"] == 404


@respx.mock
def test_connection_failure_becomes_502(client):
    respx.get("https://down.example.com/").mock(
        side_effect=httpx.ConnectError("refused")
    )

    res = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://down.example.com/"},
    )
    assert res.status_code == 502


@respx.mock
def test_timeout_becomes_504(client):
    respx.get("https://slow.example.com/").mock(
        side_effect=httpx.ReadTimeout("too slow")
    )

    res = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://slow.example.com/"},
    )
    assert res.status_code == 504


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/x",
        "http://169.254.169.254/latest/meta-data/",
    ],
)
def test_dangerous_targets_are_refused(client, url):
    res = client.post(f"{BASE}/request", json={"method": "GET", "url": url})
    assert res.status_code == 400


def test_allow_list_blocks_other_hosts(client, monkeypatch):
    monkeypatch.setattr(settings, "PROXY_ALLOWED_HOSTS", "*.allowed.com", raising=False)

    res = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://evil.example.com/"},
    )
    assert res.status_code == 400


def test_disabled_proxy_refuses_every_request(client, monkeypatch):
    monkeypatch.setattr(settings, "PROXY_ENABLED", False, raising=False)

    res = client.post(
        f"{BASE}/request",
        json={"method": "GET", "url": "https://api.example.com/"},
    )
    assert res.status_code == 400


def test_unsupported_method_is_refused(client):
    res = client.post(
        f"{BASE}/request",
        json={"method": "TRACE", "url": "https://api.example.com/"},
    )
    assert res.status_code == 400
