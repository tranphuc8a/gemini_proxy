import respx
import httpx
from src.adapter.gemini.gemini_client import GeminiClient, GeminiClientError


def test_generate_google_style_success():
    url = "https://generativelanguage.googleapis.com/v1/models/foo:generate"
    client = GeminiClient(url=url, api_key="testkey", timeout=5)

    expected = {"candidates": [{"output": "Hello from Gemini"}]}

    with respx.mock:
        route = respx.post(url).mock(return_value=httpx.Response(200, json=expected))
        resp = client.generate("hi there")
        assert resp == expected
        assert route.called


def test_generate_missing_url_raises():
    client = GeminiClient(url=None, api_key=None)
    try:
        client.generate("hello")
        assert False, "should have raised"
    except GeminiClientError:
        assert True
