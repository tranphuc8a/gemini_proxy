"""`/run` over HTTP: the contract the web app codes against.

The providers are either a fake (to pin the wire shapes exactly) or the real
adapters on a `httpx.MockTransport` / the real `local` provider (to prove the
wiring: settings -> factory -> use case -> adapter). Nothing reaches the network.
"""

import os

os.environ.setdefault("TESTING", "1")

import json
import shutil

import httpx
import pytest
from fastapi.testclient import TestClient

from src.adapter.factory import run_factory
from src.adapter.output.run.piston_executor import PistonExecutor
from src.application.config.config import settings
from src.application.usecases.run_usecase import RunUseCase
from src.main import app
from tests.application.test_run_usecase import FakeExecutor

RUN = f"{settings.API_PREFIX}/run"
ADMIN_KEY = "test-course-key"
SOURCE = {"name": "main.py", "content": "print('hi')"}


def payload(**overrides):
    base = {"provider": "fake", "language": "python", "files": [SOURCE]}
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def fresh_wiring():
    run_factory.reset_for_tests()
    yield
    app.dependency_overrides.clear()
    run_factory.reset_for_tests()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("COURSE_ADMIN_KEY", ADMIN_KEY)
    # A developer's .env must not change what these tests mean.
    monkeypatch.setattr(settings, "RUN_ENABLED", True)
    monkeypatch.setattr(settings, "RUN_LOCAL_ENABLED", False)
    monkeypatch.setattr(settings, "RUN_RATE_PER_MIN", 1000)
    monkeypatch.setattr(settings, "RUN_DEFAULT_PROVIDER", "piston")
    monkeypatch.setattr(settings, "RUN_PISTON_URL", "https://emkc.org/api/v2/piston")
    with TestClient(app) as test_client:
        yield test_client


def use_fakes(*executors, **options):
    uc = RunUseCase({executor.id: executor for executor in executors}, **options)
    app.dependency_overrides[run_factory.get_run_input_port] = lambda: uc
    return uc


# ---------------------------------------------------------------------------
# GET /run/providers
# ---------------------------------------------------------------------------
def test_providers_have_the_documented_shape(client):
    use_fakes(FakeExecutor("piston"), FakeExecutor("local", kind="local", needs_session=True, available=False,
                                                    reason="Đang tắt"), default_provider="piston")
    res = client.get(f"{RUN}/providers")
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    body = res.json()
    assert set(body) == {"providers", "default"} and body["default"] == "piston"
    local = next(row for row in body["providers"] if row["id"] == "local")
    assert local == {
        "id": "local", "label": "Local", "kind": "local", "available": False, "reason": "Đang tắt",
        "languages": ["c", "cpp", "java", "python"], "multiFile": True, "multiFileLanguages": ["cpp", "python"],
        "needsSession": True,
    }


def test_real_providers_listing_needs_no_network_and_reports_what_is_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "RUN_JUDGE0_URL", "")
    monkeypatch.setattr(settings, "RUN_LOCAL_ENABLED", False)

    def no_network(request):
        pytest.fail(f"the listing called out to {request.url}")

    monkeypatch.setattr(httpx.AsyncClient, "send", lambda *a, **k: no_network(a[1]))
    res = client.get(f"{RUN}/providers")
    rows = {row["id"]: row for row in res.json()["providers"]}
    assert list(rows) == ["piston", "judge0", "wandbox", "local"]
    assert rows["piston"]["available"] and rows["wandbox"]["available"]
    assert not rows["judge0"]["available"] and "RUN_JUDGE0_URL" in rows["judge0"]["reason"]
    assert not rows["local"]["available"] and "RUN_LOCAL_ENABLED" in rows["local"]["reason"]
    assert rows["local"]["kind"] == "local" and rows["local"]["needsSession"] is True
    assert rows["piston"]["kind"] == "remote" and rows["piston"]["needsSession"] is False
    assert "cpp" in rows["piston"]["languages"] and "kotlin" not in rows["wandbox"]["languages"]
    assert res.json()["default"] == "piston"


# ---------------------------------------------------------------------------
# POST /run
# ---------------------------------------------------------------------------
def test_a_run_answers_bare_json_in_the_documented_shape(client):
    use_fakes(FakeExecutor())
    res = client.post(RUN, json=payload())
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    body = res.json()
    assert "status_code" not in body                                    # bare JSON, not the envelope
    assert set(body) >= {"ok", "provider", "language", "version", "compile", "run", "error"}
    assert body["ok"] is True and body["provider"] == "fake" and body["language"] == "python" and body["error"] is None
    assert body["compile"] is None
    assert set(body["run"]) >= {"ran", "ok", "stdout", "stderr", "code", "signal", "ms", "timedOut", "truncated"}
    assert body["run"]["stdout"] == "hi\n"


def test_the_code_failing_is_a_200_with_ok_false(client):
    from src.domain.vo.run_vo import StageResult, finish

    class Failing(FakeExecutor):
        async def execute(self, request):
            return finish(provider=self.id, language=request.language, version="1",
                          compile=StageResult(ran=True, ok=False, stderr="error: x", code=1),
                          run=StageResult(ran=False))

    use_fakes(Failing())
    res = client.post(RUN, json=payload())
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False and body["error"]["code"] == "compile_error" and body["run"]["ran"] is False
    assert set(body["compile"]) >= {"ran", "ok", "stdout", "stderr", "code", "ms"}


def test_errors_use_the_envelope_with_a_code(client):
    use_fakes(FakeExecutor())
    res = client.post(RUN, json=payload(provider="nope"))
    assert res.status_code == 400
    assert res.json() == {"status_code": 400, "message": "Không có nhà cung cấp chạy mã 'nope'",
                          "data": {"code": "run_unknown_provider"}}

    flag = client.post(RUN, json=payload(compileArgs=["-include/etc/passwd"]))
    assert flag.status_code == 400 and flag.json()["data"]["code"] == "run_bad_flag"
    assert flag.json()["data"]["flag"] == "-include/etc/passwd"


@pytest.mark.parametrize(
    "bad",
    [
        {"files": []},
        {"files": [{"name": "f", "content": ""}] * 65},
        {"files": [{"name": "x" * 201, "content": ""}]},
        {"files": [{"name": "main.py", "content": "x" * 131_073}]},
        {"stdin": "x" * 65_537},
        {"args": ["a"] * 17},
        {"args": ["a" * 201]},
        {"compileArgs": ["-O2"] * 17},
        {"provider": ""},
        {"provider": "x" * 33},
        {"language": "x" * 33},
        {"mainFile": "x" * 201},
        {"runTimeoutMs": 0},
        {"runTimeoutMs": "soon"},
    ],
)
def test_oversized_or_malformed_bodies_are_refused_before_any_work(client, bad):
    executor = FakeExecutor()
    use_fakes(executor)
    res = client.post(RUN, json=payload(**bad))
    assert res.status_code == 422
    assert executor.seen == []


def test_a_missing_field_is_a_422(client):
    use_fakes(FakeExecutor())
    assert client.post(RUN, json={"provider": "fake"}).status_code == 422
    assert client.post(RUN, content=b"not json", headers={"content-type": "application/json"}).status_code == 422


def test_rate_limit_answers_429_with_retry_after(client):
    use_fakes(FakeExecutor(), rate_per_minute=2)
    assert client.post(RUN, json=payload()).status_code == 200
    assert client.post(RUN, json=payload()).status_code == 200
    third = client.post(RUN, json=payload())
    assert third.status_code == 429 and third.json()["data"]["code"] == "run_rate_limited"
    assert int(third.headers["retry-after"]) >= 1


def test_a_disabled_feature_is_a_503(client):
    use_fakes(FakeExecutor(), enabled=False)
    res = client.post(RUN, json=payload())
    assert res.status_code == 503 and res.json()["data"]["code"] == "run_disabled"


def test_a_provider_that_runs_on_the_server_needs_an_admin_session(client):
    use_fakes(FakeExecutor("local", kind="local", needs_session=True))
    anonymous = client.post(RUN, json=payload(provider="local"))
    assert anonymous.status_code == 403 and anonymous.json()["data"]["code"] == "admin_required"

    wrong = client.post(RUN, json=payload(provider="local"), headers={"X-Admin-Key": "wrong"})
    assert wrong.status_code == 403

    by_key = client.post(RUN, json=payload(provider="local"), headers={"X-Admin-Key": ADMIN_KEY})
    assert by_key.status_code == 200 and by_key.json()["ok"] is True


def test_an_admin_session_token_works_as_well_as_the_key(client):
    use_fakes(FakeExecutor("local", kind="local", needs_session=True))
    from src.adapter.input.controllers import admin_auth
    from src.application.utils import admin_session

    token = admin_session.issue(ADMIN_KEY, salt=admin_auth.SESSION_SALT, ttl_seconds=600).token
    res = client.post(RUN, json=payload(provider="local"), headers={"X-Admin-Session": token})
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# real wiring
# ---------------------------------------------------------------------------
def test_real_wiring_reaches_piston_through_the_factory_and_never_leaks_its_address(client, monkeypatch):
    seen = []

    def provider(http_request: httpx.Request) -> httpx.Response:
        seen.append(http_request)
        return httpx.Response(200, json={"language": "python", "version": "3.12.0",
                                         "run": {"stdout": "hi\n", "stderr": "", "code": 0, "signal": None}})

    monkeypatch.setattr(settings, "RUN_PISTON_URL", "https://piston.internal.example/api")
    real_build = run_factory.build_executors

    def build():
        executors = real_build()
        executors["piston"] = PistonExecutor(base_url=settings.RUN_PISTON_URL,
                                             transport=httpx.MockTransport(provider))
        return executors

    monkeypatch.setattr(run_factory, "build_executors", build)
    res = client.post(RUN, json=payload(provider="piston"))
    assert res.status_code == 200, res.text
    assert res.json()["ok"] and res.json()["provider"] == "piston" and res.json()["version"] == "3.12.0"
    assert str(seen[0].url) == "https://piston.internal.example/api/execute"

    # Now the provider is down: a 502 envelope that does not say where it was.
    def down(http_request):
        raise httpx.ConnectError(f"connect to {http_request.url} failed")

    provider_handler = down
    monkeypatch.setattr(run_factory, "build_executors", lambda: {
        **real_build(), "piston": PistonExecutor(base_url=settings.RUN_PISTON_URL,
                                                 transport=httpx.MockTransport(provider_handler))})
    run_factory.reset_for_tests()
    failed = client.post(RUN, json=payload(provider="piston"))
    assert failed.status_code == 502
    assert failed.json()["data"]["code"] == "run_provider_unavailable"
    assert "internal.example" not in failed.text and "https://" not in failed.text


def test_real_wiring_a_client_supplied_address_is_just_an_unknown_provider(client):
    res = client.post(RUN, json=payload(provider="http://127.0.0.1:9/execute"))
    assert res.status_code == 400 and res.json()["data"]["code"] == "run_unknown_provider"


def test_real_wiring_local_is_off_by_default(client):
    res = client.post(RUN, json=payload(provider="local"), headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 503 and res.json()["data"]["code"] == "run_provider_disabled"
    assert "RUN_LOCAL_ENABLED" in res.json()["message"]


def test_real_wiring_local_runs_code_for_an_admin_when_switched_on(client, monkeypatch):
    monkeypatch.setattr(settings, "RUN_LOCAL_ENABLED", True)
    stdin_program = {"name": "main.py", "content": "print(input().upper())"}
    request = payload(provider="local", files=[stdin_program], stdin="hello\n")

    assert client.post(RUN, json=request).status_code == 403
    res = client.post(RUN, json=request, headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True and body["run"]["stdout"].strip() == "HELLO" and body["provider"] == "local"

    listing = client.get(f"{RUN}/providers").json()
    local = next(row for row in listing["providers"] if row["id"] == "local")
    assert local["available"] is True and "python" in local["languages"]


@pytest.mark.skipif(shutil.which("g++") is None, reason="g++ is not installed")
def test_real_wiring_local_cpp_end_to_end(client, monkeypatch):
    monkeypatch.setattr(settings, "RUN_LOCAL_ENABLED", True)
    code = '#include <iostream>\nint main(){ int n; std::cin >> n; std::cout << n * n; }\n'
    res = client.post(RUN, json=payload(provider="local", language="C++", files=[{"name": "main.cpp", "content": code}],
                                        stdin="12", compileArgs=["-O2", "-std=c++20"]),
                      headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True and body["run"]["stdout"] == "144" and body["compile"]["ok"] is True
    assert body["language"] == "cpp"


def test_the_source_is_never_written_to_the_log(client, caplog):
    import logging

    use_fakes(FakeExecutor())
    secret_source = "print('TOP-SECRET-SOURCE-MARKER')"
    with caplog.at_level(logging.DEBUG):
        client.post(RUN, json=payload(files=[{"name": "main.py", "content": secret_source}], stdin="STDIN-MARKER"))
        client.post(RUN, json=payload(provider="nope", files=[{"name": "main.py", "content": secret_source}]))
    assert "TOP-SECRET-SOURCE-MARKER" not in caplog.text and "STDIN-MARKER" not in caplog.text
    assert json.dumps(secret_source)[1:20] not in caplog.text
