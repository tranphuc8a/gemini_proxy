"""The HTTP client that talks to Google's generative-language endpoint.

The streaming tests matter most: Google returns the answer either as SSE or as
NDJSON, and may split a single JSON object across several frames, so the client
extracts text fields from a rolling buffer rather than parsing frame by frame.
"""

import asyncio

import httpx
import pytest
import respx

from src.adapter.output.gemini.helper.gemini_client import GeminiClient, GeminiClientError

URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
STREAM_URL = URL.replace(":generateContent", ":streamGenerateContent")


def arun(coro):
    return asyncio.run(coro)


@pytest.fixture
def no_configured_url(monkeypatch):
    """Simulate a deployment that never set GEMINI_URL.

    The client falls back to settings when constructed without a url, so the
    setting has to be cleared for "no endpoint configured" to be reachable.
    """
    from src.application.config.config import settings

    monkeypatch.setattr(settings, "GEMINI_URL", None)
    yield


def _client(url=URL, api_key="testkey", timeout=5) -> GeminiClient:
    return GeminiClient(url=url, api_key=api_key, timeout=timeout)


async def _collect(client: GeminiClient, *args, **kwargs):
    try:
        return [part async for part in client.stream_generate(*args, **kwargs)]
    finally:
        await client.stop()


async def _generate(client: GeminiClient, *args, **kwargs):
    try:
        return await client.generate(*args, **kwargs)
    finally:
        await client.stop()


# --------------------------------------------------------------------------
# generate
# --------------------------------------------------------------------------

def test_generate_returns_the_raw_payload():
    expected = {"candidates": [{"content": {"parts": [{"text": "Hello from Gemini"}]}}]}

    async def scenario():
        with respx.mock:
            route = respx.post(URL).mock(return_value=httpx.Response(200, json=expected))
            resp = await _generate(_client(), "hi there")
            assert resp == expected
            assert route.called

    arun(scenario())


def test_generate_sends_the_api_key_and_a_contents_payload():
    async def scenario():
        with respx.mock:
            route = respx.post(URL).mock(return_value=httpx.Response(200, json={}))
            await _generate(_client(), "hi there")

            request = route.calls[0].request
            assert request.headers["x-goog-api-key"] == "testkey"
            import json

            body = json.loads(request.content)
            assert body["contents"] == [{"role": "user", "parts": [{"text": "hi there"}]}]

    arun(scenario())


def test_generate_without_a_url_raises(no_configured_url):
    async def scenario():
        with pytest.raises(GeminiClientError):
            await _generate(_client(url=None, api_key=None), "hello")

    arun(scenario())


def test_generate_surfaces_an_http_error_with_its_body():
    async def scenario():
        with respx.mock:
            respx.post(URL).mock(return_value=httpx.Response(429, text="quota exceeded"))
            with pytest.raises(GeminiClientError) as exc:
                await _generate(_client(), "hi")
            assert "429" in str(exc.value)
            assert "quota exceeded" in str(exc.value)

    arun(scenario())


def test_a_401_explains_how_to_fix_it():
    async def scenario():
        with respx.mock:
            respx.post(URL).mock(return_value=httpx.Response(401, text="bad key"))
            with pytest.raises(GeminiClientError) as exc:
                await _generate(_client(), "hi")
            assert "GEMINI_API_KEY" in str(exc.value)

    arun(scenario())


def test_the_model_argument_rewrites_the_url():
    async def scenario():
        target = URL.replace("gemini-2.5-flash", "gemini-2.5-pro")
        with respx.mock:
            route = respx.post(target).mock(return_value=httpx.Response(200, json={}))
            await _generate(_client(), "hi", model="gemini-2.5-pro")
            assert route.called

    arun(scenario())


# --------------------------------------------------------------------------
# stream_generate
# --------------------------------------------------------------------------

def test_stream_extracts_text_from_sse_frames():
    body = (
        'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\n'
        'data: {"candidates":[{"content":{"parts":[{"text":"lo!"}]}}]}\n\n'
    )

    async def scenario():
        with respx.mock:
            respx.post(STREAM_URL).mock(return_value=httpx.Response(200, text=body))
            parts = await _collect(_client(), "hi")
            assert parts == ["Hel", "lo!"]

    arun(scenario())


def test_stream_extracts_text_from_ndjson():
    body = (
        '{"candidates":[{"content":{"parts":[{"text":"first"}]}}]}\n'
        '{"candidates":[{"content":{"parts":[{"text":" second"}]}}]}\n'
    )

    async def scenario():
        with respx.mock:
            respx.post(STREAM_URL).mock(return_value=httpx.Response(200, text=body))
            parts = await _collect(_client(), "hi")
            assert parts == ["first", " second"]

    arun(scenario())


def test_stream_unescapes_json_string_escapes():
    body = 'data: {"candidates":[{"content":{"parts":[{"text":"line\\nbreak \\"quoted\\""}]}}]}\n\n'

    async def scenario():
        with respx.mock:
            respx.post(STREAM_URL).mock(return_value=httpx.Response(200, text=body))
            parts = await _collect(_client(), "hi")
            assert parts == ['line\nbreak "quoted"']

    arun(scenario())


def test_stream_stops_at_the_done_sentinel():
    body = 'data: {"candidates":[{"content":{"parts":[{"text":"kept"}]}}]}\n\ndata: [DONE]\n\n'

    async def scenario():
        with respx.mock:
            respx.post(STREAM_URL).mock(return_value=httpx.Response(200, text=body))
            parts = await _collect(_client(), "hi")
            assert parts == ["kept"]

    arun(scenario())


def test_stream_ignores_sse_keepalive_comments():
    body = ': keepalive\n\ndata: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n'

    async def scenario():
        with respx.mock:
            respx.post(STREAM_URL).mock(return_value=httpx.Response(200, text=body))
            parts = await _collect(_client(), "hi")
            assert parts == ["ok"]

    arun(scenario())


def test_stream_without_a_url_raises(no_configured_url):
    async def scenario():
        with pytest.raises(GeminiClientError):
            await _collect(_client(url=None, api_key=None), "hi")

    arun(scenario())


def test_stream_surfaces_an_http_error():
    async def scenario():
        with respx.mock:
            respx.post(STREAM_URL).mock(return_value=httpx.Response(500, text="upstream down"))
            with pytest.raises(GeminiClientError) as exc:
                await _collect(_client(), "hi")
            assert "500" in str(exc.value)

    arun(scenario())
