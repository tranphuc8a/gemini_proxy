"""`/run` rules: provider choice, validation, access, rate limit.

A fake executor stands in for the providers: what is under test is everything the
use case does BEFORE a provider is called, and that it hands over exactly the
normalised request it should.
"""

import os

os.environ.setdefault("TESTING", "1")

from typing import List, Tuple

import pytest

from src.application.exceptions.exceptions import AppException, BadRequestError
from src.application.ports.output.code_executor_port import CodeExecutorPort
from src.application.usecases.run_usecase import RunUseCase
from src.domain.vo.run_vo import (
    ExecutionRequest,
    RunCaller,
    RunRequestIn,
    StageResult,
    finish,
)
from tests.conftest import arun


class FakeExecutor(CodeExecutorPort):
    def __init__(self, id="fake", *, kind="remote", languages=("c", "cpp", "python", "java"), multi=("cpp", "python"),
                 available=True, reason="", needs_session=False):
        self.id = id
        self.label = id.title()
        self.kind = kind
        self.needs_session = needs_session
        self._languages = languages
        self._multi = multi
        self._available = (available, reason)
        self.seen: List[ExecutionRequest] = []

    def languages(self) -> Tuple[str, ...]:
        return self._languages

    def multi_file_languages(self) -> Tuple[str, ...]:
        return self._multi

    def availability(self) -> Tuple[bool, str]:
        return self._available

    async def execute(self, request: ExecutionRequest):
        self.seen.append(request)
        return finish(provider=self.id, language=request.language, version="1",
                      compile=None, run=StageResult(ran=True, ok=True, stdout="hi\n", code=0))


def body(**overrides):
    base = dict(provider="fake", language="python", files=[{"name": "main.py", "content": "print('hi')"}])
    base.update(overrides)
    return RunRequestIn(**base)


def make(*executors, **options):
    return RunUseCase({executor.id: executor for executor in executors}, **options)


def run(uc, request, ip="1.1.1.1", admin=False):
    return arun(uc.run(request, RunCaller(ip=ip, admin=admin)))


def refused(uc, request, **kwargs):
    with pytest.raises(AppException) as caught:
        run(uc, request, **kwargs)
    return caught.value


# ---------------------------------------------------------------------------
# providers listing
# ---------------------------------------------------------------------------
def test_providers_lists_each_with_its_facts_and_a_working_default():
    piston = FakeExecutor("piston")
    broken = FakeExecutor("judge0", available=False, reason="Chưa cấu hình")
    local = FakeExecutor("local", kind="local", needs_session=True, languages=("cpp",), multi=("cpp",))
    out = make(piston, broken, local, default_provider="judge0").providers()

    rows = {row["id"]: row for row in out["providers"]}
    assert rows["piston"]["available"] is True and rows["piston"]["reason"] == ""
    assert rows["judge0"]["available"] is False and rows["judge0"]["reason"] == "Chưa cấu hình"
    assert rows["local"]["kind"] == "local" and rows["local"]["needsSession"] is True
    assert rows["piston"]["languages"] == ["c", "cpp", "java", "python"]          # canonical order, not the adapter's
    assert rows["piston"]["multiFile"] is True and rows["piston"]["multiFileLanguages"] == ["cpp", "python"]
    # The configured default is unavailable, so the first one that works is named.
    assert out["default"] == "piston"


def test_default_is_the_configured_one_when_it_works():
    uc = make(FakeExecutor("piston"), FakeExecutor("wandbox"), default_provider="wandbox")
    assert uc.providers()["default"] == "wandbox"


def test_everything_is_unavailable_when_the_feature_is_switched_off():
    uc = make(FakeExecutor("piston"), enabled=False)
    row = uc.providers()["providers"][0]
    assert row["available"] is False and "RUN_ENABLED" in row["reason"]
    error = refused(uc, body(provider="piston"))
    assert error.status_code == 503 and error.payload["code"] == "run_disabled"


# ---------------------------------------------------------------------------
# provider and language
# ---------------------------------------------------------------------------
def test_unknown_provider_is_a_400_that_cannot_carry_an_address():
    uc = make(FakeExecutor())
    for name in ("nope", "http://evil.example/execute", "FAKE2"):
        error = refused(uc, body(provider=name))
        assert error.status_code == 400 and error.payload["code"] == "run_unknown_provider"


def test_provider_and_language_are_matched_case_insensitively_and_by_alias():
    executor = FakeExecutor()
    result = run(make(executor), body(provider=" FAKE ", language="C++",
                                      files=[{"name": "main.cpp", "content": "int main(){}"}]))
    assert result.ok and result.language == "cpp"
    assert executor.seen[0].language == "cpp"


def test_unsupported_language_is_refused_for_the_whole_api_and_for_this_provider():
    uc = make(FakeExecutor(languages=("python",)))
    assert refused(uc, body(language="cobol")).payload["code"] == "run_language_unsupported"
    error = refused(uc, body(language="cpp", files=[{"name": "main.cpp", "content": ""}]))
    assert error.status_code == 400 and error.payload["code"] == "run_language_unsupported"


def test_an_unavailable_provider_is_a_503_with_its_reason():
    uc = make(FakeExecutor("local", available=False, reason="Đang tắt"))
    error = refused(uc, body(provider="local"))
    assert error.status_code == 503 and error.payload["code"] == "run_provider_disabled"
    assert error.message == "Đang tắt"


def test_a_provider_that_executes_on_this_machine_needs_an_administrator():
    executor = FakeExecutor("local", kind="local", needs_session=True)
    uc = make(executor)
    error = refused(uc, body(provider="local"))
    assert error.status_code == 403 and error.payload["code"] == "admin_required"
    assert executor.seen == []
    assert run(uc, body(provider="local"), admin=True).ok
    assert len(executor.seen) == 1


# ---------------------------------------------------------------------------
# files
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("name", ["../x.py", "/etc/passwd", "a b.py", "-x.py", "CON", "a\\b.py", "dir/"])
def test_bad_file_names_never_reach_a_provider(name):
    executor = FakeExecutor()
    error = refused(make(executor), body(files=[{"name": name, "content": "x"}]))
    assert error.status_code == 400 and error.payload["code"] == "run_bad_file"
    assert executor.seen == []


def test_duplicate_and_file_vs_folder_names_are_refused():
    uc = make(FakeExecutor())
    two = [{"name": "A.py", "content": ""}, {"name": "a.py", "content": ""}]
    assert refused(uc, body(files=two)).payload["code"] == "run_bad_file"
    clash = [{"name": "pkg", "content": ""}, {"name": "pkg/mod.py", "content": ""}]
    assert refused(uc, body(files=clash)).payload["code"] == "run_bad_file"


def test_sizes_are_counted_in_bytes_not_characters():
    uc = make(FakeExecutor())
    # 40,000 characters of 4 bytes each: 160,000 bytes, over the 128 KB file limit.
    assert refused(uc, body(files=[{"name": "main.py", "content": "😀" * 40_000}])).payload["code"] == "run_too_large"
    # Each file is fine, the total (3 x 100 KB) is not.
    many = [{"name": f"m{i}.py", "content": "x" * 100_000} for i in range(3)]
    error = refused(uc, body(files=many))
    assert error.payload["code"] == "run_too_large" and "Tổng" in error.message
    # stdin of 40,000 4-byte characters is over 64 KB.
    assert refused(uc, body(stdin="😀" * 40_000)).payload["code"] == "run_too_large"


def test_pydantic_stops_a_flood_before_the_use_case_sees_it():
    with pytest.raises(Exception):
        body(files=[{"name": f"f{i}.py", "content": ""} for i in range(65)])
    with pytest.raises(Exception):
        body(files=[])
    with pytest.raises(Exception):
        body(args=["x"] * 17)
    with pytest.raises(Exception):
        body(args=["x" * 201])
    with pytest.raises(Exception):
        body(stdin="x" * 70_000)


def test_main_file_goes_first_and_must_exist():
    executor = FakeExecutor()
    files = [{"name": "util.cpp", "content": "u"}, {"name": "app.cpp", "content": "a"}, {"name": "util.h", "content": "h"}]
    run(make(executor), body(language="cpp", files=files, mainFile="app.cpp"))
    seen = executor.seen[0]
    assert seen.main_file == "app.cpp"
    assert [file.path for file in seen.files] == ["app.cpp", "util.cpp", "util.h"]

    error = refused(make(executor), body(language="cpp", files=files, mainFile="nope.cpp"))
    assert error.payload["code"] == "run_bad_file"
    assert refused(make(executor), body(language="cpp", files=files, mainFile="../x.cpp")).payload["code"] == "run_bad_file"


def test_several_files_need_a_provider_that_takes_them_for_that_language():
    uc = make(FakeExecutor(multi=("python",)))
    files = [{"name": "A.java", "content": ""}, {"name": "B.java", "content": ""}]
    error = refused(uc, body(language="java", files=files))
    assert error.status_code == 400 and error.payload["code"] == "run_multifile_unsupported"
    two_py = [{"name": "main.py", "content": ""}, {"name": "lib.py", "content": ""}]
    assert run(uc, body(language="python", files=two_py)).ok


def test_a_compiled_language_needs_at_least_one_source_file():
    error = refused(make(FakeExecutor()), body(language="cpp", files=[{"name": "readme.txt", "content": "x"}]))
    assert error.payload["code"] == "run_no_source"


# ---------------------------------------------------------------------------
# flags, arguments, timeouts
# ---------------------------------------------------------------------------
def test_unsafe_compile_flags_are_a_400_naming_the_flag():
    executor = FakeExecutor()
    error = refused(make(executor), body(language="cpp", files=[{"name": "main.cpp", "content": ""}],
                                         compileArgs=["-O2", "-include/etc/passwd"]))
    assert error.status_code == 400 and error.payload["code"] == "run_bad_flag"
    assert error.payload["flag"] == "-include/etc/passwd"
    assert executor.seen == []


def test_safe_flags_arguments_and_stdin_are_passed_on_as_given():
    executor = FakeExecutor()
    run(make(executor), body(language="cpp", files=[{"name": "main.cpp", "content": "x"}],
                             compileArgs=["-std=c++20", "-O2", "-DN=5"], args=["a b", "--c"], stdin="1 2\n"))
    seen = executor.seen[0]
    assert seen.compile_args == ("-std=c++20", "-O2", "-DN=5")
    assert seen.args == ("a b", "--c") and seen.stdin == "1 2\n"


def test_a_nul_in_an_argument_is_refused():
    assert refused(make(FakeExecutor()), body(args=["a\x00b"])).payload["code"] == "run_bad_arg"


def test_timeouts_default_clamp_and_floor():
    executor = FakeExecutor()
    uc = make(executor)
    run(uc, body())
    assert (executor.seen[-1].run_timeout_ms, executor.seen[-1].compile_timeout_ms) == (5000, 15000)
    run(uc, body(runTimeoutMs=99_000, compileTimeoutMs=99_000))
    assert (executor.seen[-1].run_timeout_ms, executor.seen[-1].compile_timeout_ms) == (15000, 30000)
    run(uc, body(runTimeoutMs=1, compileTimeoutMs=2))
    assert (executor.seen[-1].run_timeout_ms, executor.seen[-1].compile_timeout_ms) == (100, 100)
    run(uc, body(runTimeoutMs=2500))
    assert executor.seen[-1].run_timeout_ms == 2500


# ---------------------------------------------------------------------------
# rate limit
# ---------------------------------------------------------------------------
def test_rate_limit_is_per_address_and_exempts_administrators():
    executor = FakeExecutor()
    uc = make(executor, rate_per_minute=3)
    for _ in range(3):
        run(uc, body(), ip="9.9.9.9")
    error = refused(uc, body(), ip="9.9.9.9")
    assert error.status_code == 429 and error.payload["code"] == "run_rate_limited"
    assert int(error.headers["Retry-After"]) >= 1
    assert len(executor.seen) == 3

    assert run(uc, body(), ip="8.8.8.8").ok                    # another address is unaffected
    for _ in range(5):                                          # administrators are not counted
        assert run(uc, body(), ip="9.9.9.9", admin=True).ok


def test_a_provider_failure_propagates_untouched():
    class Broken(FakeExecutor):
        async def execute(self, request):
            raise AppException("provider down", status_code=502, code="run_provider_unavailable")

    error = refused(make(Broken()), body())
    assert error.status_code == 502
