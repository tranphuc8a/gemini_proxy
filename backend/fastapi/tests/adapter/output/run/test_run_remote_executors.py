"""Piston, Judge0 and Wandbox adapters, against `httpx.MockTransport`.

Nothing here touches the network: each test hands the adapter a transport that
plays the provider and records what the adapter sent. The assertions are about
(1) the request being the one the provider's API documents, (2) every kind of
answer becoming the right `RunResult`, and (3) every kind of failure becoming
the right `AppException` WITHOUT the provider's address or key in the message.

The shapes of the replies are written from each provider's documentation (see the
modules' docstrings); that they match the live services has not been verified.
"""

import base64
import io
import json
import os
import time as real_time
import zipfile
from types import SimpleNamespace

os.environ.setdefault("TESTING", "1")

import httpx
import pytest

from src.adapter.output.run import judge0_executor, piston_executor, wandbox_executor
from src.adapter.output.run.common import clip_text, java_main_class, parse_overrides
from src.adapter.output.run.judge0_executor import Judge0Executor
from src.adapter.output.run.piston_executor import PistonExecutor
from src.adapter.output.run.wandbox_executor import WandboxExecutor
from src.application.exceptions.exceptions import AppException, BadRequestError
from src.application.exceptions.run_exceptions import (
    RunProviderRejected,
    RunProviderTimeout,
    RunProviderUnavailable,
)
from src.domain.utils.run_languages import LANGUAGES
from src.domain.vo.run_vo import MAX_OUTPUT_BYTES, ExecutionRequest, SourceFile
from tests.conftest import arun

PISTON_URL = "https://piston.internal.example/api/v2/piston"
JUDGE0_URL = "https://judge0.internal.example"
WANDBOX_URL = "https://wandbox.internal.example/api"
SECRET = "sk-very-secret-key-123"


def request(language="cpp", files=(("main.cpp", "int main(){}"),), **overrides):
    values = dict(
        language=language,
        files=tuple(SourceFile(path=path, content=content) for path, content in files),
        main_file=files[0][0],
        stdin="",
        args=(),
        compile_args=(),
        run_timeout_ms=5000,
        compile_timeout_ms=15000,
    )
    values.update(overrides)
    return ExecutionRequest(**values)


class Server:
    """A fake provider: replies with `reply`, remembers every request it got."""

    def __init__(self, reply):
        self.reply = reply
        self.requests = []

    def transport(self):
        def handler(http_request: httpx.Request) -> httpx.Response:
            self.requests.append(http_request)
            reply = self.reply(http_request) if callable(self.reply) else self.reply
            if isinstance(reply, Exception):
                raise reply
            return reply

        return httpx.MockTransport(handler)

    @property
    def last(self):
        return self.requests[-1]

    def body(self, index=-1):
        return json.loads(self.requests[index].content)


def json_reply(data, status=200, headers=None):
    return httpx.Response(status, json=data, headers=headers)


def piston(server, **kwargs):
    return PistonExecutor(base_url=PISTON_URL, transport=server.transport(), **kwargs)


def judge0(server, **kwargs):
    kwargs.setdefault("poll_interval_s", 0)
    return Judge0Executor(base_url=JUDGE0_URL, transport=server.transport(), **kwargs)


def wandbox(server, **kwargs):
    return WandboxExecutor(base_url=WANDBOX_URL, transport=server.transport(), **kwargs)


def failure(executor, req=None):
    with pytest.raises(AppException) as caught:
        arun(executor.execute(req or request()))
    return caught.value


# ---------------------------------------------------------------------------
# language tables
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("table", [piston_executor.LANGUAGE_MAP, judge0_executor.LANGUAGE_IDS,
                                   wandbox_executor.COMPILER_MAP])
def test_every_mapped_language_is_a_known_canonical_id(table):
    assert set(table) <= set(LANGUAGES)
    assert all(value not in ("", None) for value in table.values())


def test_the_tables_name_each_language_the_way_its_provider_does():
    assert piston_executor.LANGUAGE_MAP["cpp"] == "c++"
    assert piston_executor.LANGUAGE_MAP["csharp"] == "csharp"
    assert set(piston_executor.LANGUAGE_MAP) == set(LANGUAGES)
    assert judge0_executor.LANGUAGE_IDS["cpp"] == 54 and judge0_executor.LANGUAGE_IDS["python"] == 71
    assert judge0_executor.MULTI_FILE_ID == 89
    assert len(set(judge0_executor.LANGUAGE_IDS.values())) == len(judge0_executor.LANGUAGE_IDS)
    assert wandbox_executor.COMPILER_MAP["c"].endswith("-c") and not wandbox_executor.COMPILER_MAP["cpp"].endswith("-c")
    assert "kotlin" not in wandbox_executor.COMPILER_MAP
    assert set(judge0_executor.MULTI_FILE_LANGUAGES) <= set(judge0_executor.LANGUAGE_IDS)


def test_languages_and_availability_are_known_without_a_network_call():
    server = Server(lambda r: pytest.fail("no request expected"))
    assert piston(server).availability() == (True, "")
    assert "kotlin" in piston(server).languages()
    assert "kotlin" not in wandbox(server).languages()
    assert Judge0Executor(base_url="").availability()[0] is False
    assert "RUN_JUDGE0_URL" in Judge0Executor(base_url="").availability()[1]
    assert PistonExecutor(base_url="  ").availability()[0] is False
    assert server.requests == []


def test_overrides_parse_leniently():
    assert parse_overrides("cpp=105, py = 100 ,junk,=3,cobol=1,go=") == {"cpp": "105", "python": "100"}
    assert parse_overrides("") == {}
    executor = Judge0Executor(base_url=JUDGE0_URL, language_ids="cpp=105,python=oops")
    assert executor._ids["cpp"] == 105 and executor._ids["python"] == 71     # a junk id is ignored
    assert wandbox(Server(None), compilers="cpp=gcc-head")._compilers["cpp"] == "gcc-head"


def test_output_clipping_counts_bytes_and_keeps_valid_text():
    text, cut = clip_text("é" * 10, limit=5)
    assert cut and len(text.encode()) <= 5 and text == "éé"
    assert clip_text("abc", 10) == ("abc", False)
    assert clip_text(None) == ("", False)


def test_java_main_class_follows_the_package_declaration():
    assert java_main_class("Main.java", "public class Main {}") == "Main"
    assert java_main_class("src/app/Main.java", "package app;\n\npublic class Main {}") == "app.Main"


# ---------------------------------------------------------------------------
# Piston
# ---------------------------------------------------------------------------
PISTON_OK = {
    "language": "c++", "version": "10.2.0",
    "compile": {"stdout": "", "stderr": "warning: unused", "code": 0, "signal": None, "status": None, "wall_time": 412},
    "run": {"stdout": "hello\n", "stderr": "", "code": 0, "signal": None, "status": None, "wall_time": 3},
}


def test_piston_sends_the_documented_request_with_the_main_file_first():
    server = Server(json_reply(PISTON_OK))
    req = request(files=(("main.cpp", "int main(){}"), ("util.h", "#pragma once")), stdin="5\n", args=("a", "b c"),
                  run_timeout_ms=2500, compile_timeout_ms=9000)
    arun(piston(server, api_key=SECRET).execute(req))

    assert server.last.url == httpx.URL(PISTON_URL + "/execute")
    assert server.last.method == "POST"
    assert server.last.headers["authorization"] == SECRET
    assert server.body() == {
        "language": "c++", "version": "*",
        "files": [{"name": "main.cpp", "content": "int main(){}"}, {"name": "util.h", "content": "#pragma once"}],
        "stdin": "5\n", "args": ["a", "b c"],
        "compile_timeout": 9000, "run_timeout": 2500, "compile_cpu_time": 9000, "run_cpu_time": 2500,
    }


def test_piston_without_a_key_sends_no_authorization_header():
    server = Server(json_reply(PISTON_OK))
    arun(piston(server).execute(request()))
    assert "authorization" not in server.last.headers


def test_piston_success_maps_both_stages():
    result = arun(piston(Server(json_reply(PISTON_OK))).execute(request()))
    assert result.ok and result.error is None
    assert (result.provider, result.language, result.version) == ("piston", "cpp", "10.2.0")
    assert result.compile.ran and result.compile.ok and result.compile.stderr == "warning: unused"
    assert result.compile.ms == 412 and result.run.ms == 3
    assert result.run.ran and result.run.ok and result.run.stdout == "hello\n" and result.run.code == 0
    assert not result.run.timedOut and not result.run.truncated


def test_piston_interpreted_language_has_no_compile_stage():
    reply = {"language": "python", "version": "3.12.0", "run": {"stdout": "3\n", "stderr": "", "code": 0, "signal": None}}
    result = arun(piston(Server(json_reply(reply))).execute(
        request("python", (("main.py", "print(3)"),))))
    assert result.ok and result.compile is None and result.run.stdout == "3\n"


def test_piston_compile_error_is_an_ok_false_answer_not_an_http_error():
    reply = {"language": "c++", "version": "10", "compile": {"stdout": "", "stderr": "main.cpp:1: error", "code": 1,
                                                              "signal": None, "status": "RE"}}
    result = arun(piston(Server(json_reply(reply))).execute(request()))
    assert not result.ok and result.error.code == "compile_error"
    assert result.compile.ran and not result.compile.ok and "error" in result.compile.stderr
    assert not result.run.ran


def test_piston_runtime_error_timeout_and_output_limit():
    def run_reply(**run):
        return {"language": "python", "version": "3", "run": {"stdout": "", "stderr": "", "code": 0, "signal": None, **run}}

    python = request("python", (("main.py", "x"),))
    crashed = arun(piston(Server(json_reply(run_reply(code=1, stderr="Traceback", status="RE")))).execute(python))
    assert not crashed.ok and crashed.error.code == "runtime_error" and crashed.run.code == 1
    assert crashed.run.stderr == "Traceback"

    slow = arun(piston(Server(json_reply(run_reply(code=None, signal="SIGKILL", status="TO")))).execute(python))
    assert not slow.ok and slow.run.timedOut and slow.run.signal == "SIGKILL" and slow.error.code == "run_timeout"

    flooded = arun(piston(Server(json_reply(run_reply(status="OL", signal="SIGKILL", code=None)))).execute(python))
    assert flooded.run.truncated and not flooded.ok


def test_piston_old_server_without_status_infers_a_timeout_from_a_late_sigkill():
    executor = piston(Server(None))
    data = {"language": "python", "version": "3", "run": {"stdout": "", "stderr": "", "code": None, "signal": "SIGKILL"}}
    req = request("python", (("main.py", "x"),), run_timeout_ms=1000)
    assert executor.read_result(data, req, elapsed_ms=1010).run.timedOut is True
    assert executor.read_result(data, req, elapsed_ms=40).run.timedOut is False      # killed early: not a timeout


def test_piston_cuts_a_huge_output_and_flags_it():
    reply = {"language": "python", "version": "3",
             "run": {"stdout": "x" * (MAX_OUTPUT_BYTES + 5000), "stderr": "", "code": 0, "signal": None}}
    result = arun(piston(Server(json_reply(reply))).execute(request("python", (("main.py", "x"),))))
    assert len(result.run.stdout.encode()) == MAX_OUTPUT_BYTES and result.run.truncated
    assert result.ok                      # a long answer is still a successful run


def test_piston_cannot_take_compile_flags_and_says_so():
    result = arun(piston(Server(json_reply(PISTON_OK))).execute(request(compile_args=("-O2",))))
    assert any("compileArgs" in warning for warning in result.warnings)
    assert arun(piston(Server(json_reply(PISTON_OK))).execute(request())).warnings == []


def test_piston_unusable_answers_are_provider_unavailable():
    for reply in (json_reply({"message": "weird"}), json_reply({"run": "no"}), httpx.Response(200, text="<html>"),
                  httpx.Response(200, json=["list"])):
        error = failure(piston(Server(reply)))
        assert error.status_code == 502 and error.payload["code"] == "run_provider_unavailable"


def test_piston_compile_ok_but_no_run_object_is_unavailable():
    reply = {"language": "c++", "version": "1", "compile": {"stdout": "", "stderr": "", "code": 0, "signal": None}}
    assert failure(piston(Server(json_reply(reply)))).payload["code"] == "run_provider_unavailable"


# ---------------------------------------------------------------------------
# provider failures: mapping, and nothing sensitive in the message
# ---------------------------------------------------------------------------
def assert_clean(error):
    shown = json.dumps({"message": error.message, "payload": error.payload}, ensure_ascii=False)
    for secret in (SECRET, "internal.example", "https://", "http://"):
        assert secret not in shown, f"{secret!r} leaked in {shown}"


def test_a_400_carries_the_providers_sentence_with_address_and_key_scrubbed():
    sentence = f"python3.99 runtime is unknown (see {PISTON_URL}/runtimes, token {SECRET})"
    error = failure(piston(Server(json_reply({"message": sentence}, status=400)), api_key=SECRET))
    assert error.status_code == 502 and error.payload["code"] == "run_provider_rejected"
    assert "runtime is unknown" in error.payload["detail"]
    assert_clean(error)
    assert error.payload["provider"] == "piston"


def test_401_403_and_429_are_rejections_with_their_own_messages():
    auth = failure(piston(Server(json_reply({"message": "Unauthorized"}, status=401))))
    assert auth.payload["code"] == "run_provider_rejected" and "khoá" in auth.message
    forbidden = failure(piston(Server(httpx.Response(403, text="nope"))))
    assert forbidden.payload["code"] == "run_provider_rejected"

    limited = failure(piston(Server(json_reply({}, status=429, headers={"Retry-After": "7"}))))
    assert limited.payload["code"] == "run_provider_rejected" and limited.payload["retryAfter"] == 7
    assert "giới hạn" in limited.message


def test_a_5xx_is_unavailable_and_says_only_the_status():
    error = failure(piston(Server(httpx.Response(503, text=f"upstream {PISTON_URL} down"))))
    assert error.status_code == 502 and error.payload["code"] == "run_provider_unavailable"
    assert error.payload["detail"] == "HTTP 503"
    assert_clean(error)


def test_a_connection_failure_is_unavailable_and_does_not_quote_the_address():
    error = failure(piston(Server(httpx.ConnectError(f"cannot connect to {PISTON_URL}"))))
    assert error.status_code == 502 and error.payload["code"] == "run_provider_unavailable"
    assert_clean(error)


def test_a_slow_provider_is_a_504():
    for slow in (httpx.ReadTimeout("slow"), httpx.ConnectTimeout("slow")):
        error = failure(piston(Server(slow)))
        assert error.status_code == 504 and error.payload["code"] == "run_provider_timeout"
        assert isinstance(error, RunProviderTimeout)


def test_the_http_timeout_covers_compile_and_run_but_never_exceeds_the_ceiling():
    executor = piston(Server(None), http_timeout_s=30)
    assert executor._timeout_for(request(run_timeout_ms=5000, compile_timeout_ms=15000)) == 25
    assert executor._timeout_for(request(run_timeout_ms=15000, compile_timeout_ms=30000)) == 30
    assert piston(Server(None), http_timeout_s=2)._timeout_for(request(run_timeout_ms=100, compile_timeout_ms=100)) == 5


def test_exception_types_are_the_documented_ones():
    assert issubclass(RunProviderUnavailable, AppException) and issubclass(RunProviderRejected, AppException)
    assert RunProviderUnavailable("x").status_code == 502 and RunProviderTimeout("x").status_code == 504


# ---------------------------------------------------------------------------
# Judge0
# ---------------------------------------------------------------------------
def b64(text):
    return base64.b64encode(text.encode()).decode()


def judge0_reply(status=3, description="Accepted", **fields):
    data = {"stdout": None, "stderr": None, "compile_output": None, "message": None, "exit_code": 0,
            "exit_signal": None, "status": {"id": status, "description": description}, "time": "0.004",
            "wall_time": "0.010", "memory": 1000, "token": "tok-1"}
    data.update(fields)
    return json_reply(data)


def test_judge0_single_file_request_is_the_documented_submission():
    server = Server(judge0_reply(stdout=b64("hi\n"), compile_output=b64("")))
    req = request(files=(("main.cpp", "int main(){ return 0; }"),), stdin="7\n", args=("a b", "c"),
                  compile_args=("-O2", "-std=c++17"), run_timeout_ms=4000)
    arun(judge0(server, api_key=SECRET, key_header="X-Auth-Token").execute(req))

    assert server.last.method == "POST" and server.last.url.path == "/submissions"
    query = dict(server.last.url.params)
    assert query["base64_encoded"] == "true" and query["wait"] == "true" and query["fields"] == "*"
    assert server.last.headers["x-auth-token"] == SECRET
    body = server.body()
    assert base64.b64decode(body["source_code"]).decode() == "int main(){ return 0; }"
    assert base64.b64decode(body["stdin"]).decode() == "7\n"
    assert body["language_id"] == 54
    assert body["command_line_arguments"] == "'a b' c"
    assert body["compiler_options"] == "-O2 -std=c++17"
    assert body["cpu_time_limit"] == 4.0 and body["wall_time_limit"] == 9.0 and body["memory_limit"] == 256000
    assert "additional_files" not in body


def test_judge0_limits_are_capped_at_what_a_default_server_allows():
    server = Server(judge0_reply())
    arun(judge0(server).execute(request(run_timeout_ms=15000)))
    body = server.body()
    assert body["cpu_time_limit"] == 15.0 and body["wall_time_limit"] == 20.0


def test_judge0_custom_key_header_and_language_id_override():
    server = Server(judge0_reply())
    arun(judge0(server, api_key=SECRET, key_header="X-RapidAPI-Key", language_ids="cpp=105").execute(request()))
    assert server.last.headers["x-rapidapi-key"] == SECRET and "x-auth-token" not in server.last.headers
    assert server.body()["language_id"] == 105


def test_judge0_success_decodes_base64_and_maps_the_stages():
    result = arun(judge0(Server(judge0_reply(stdout=b64("xin chào\n"), stderr=b64("warn"),
                                             compile_output=b64("w: unused")))).execute(request()))
    assert result.ok and result.provider == "judge0" and result.version == "GCC 9.2.0"
    assert result.run.stdout == "xin chào\n" and result.run.stderr == "warn" and result.run.code == 0
    assert result.run.ms == 10                                   # wall_time "0.010" s
    assert result.compile.ran and result.compile.ok and result.compile.stderr == "w: unused"


def test_judge0_interpreted_language_has_no_compile_stage():
    result = arun(judge0(Server(judge0_reply(stdout=b64("3")))).execute(request("python", (("main.py", "print(3)"),))))
    assert result.ok and result.compile is None


def test_judge0_compilation_error_status_6():
    reply = judge0_reply(6, "Compilation Error", compile_output=b64("main.cpp:1: error: expected ;"), exit_code=None)
    result = arun(judge0(Server(reply)).execute(request()))
    assert not result.ok and result.error.code == "compile_error"
    assert "expected ;" in result.compile.stderr and not result.compile.ok and not result.run.ran


def test_judge0_time_limit_status_5_and_runtime_errors():
    slow = arun(judge0(Server(judge0_reply(5, "Time Limit Exceeded", exit_code=None, exit_signal=9))).execute(request()))
    assert not slow.ok and slow.run.timedOut and slow.error.code == "run_timeout" and slow.run.signal == "SIGKILL"

    crash = arun(judge0(Server(judge0_reply(11, "Runtime Error (SIGSEGV)", stderr=b64("Segmentation fault"),
                                            exit_code=None, exit_signal=11))).execute(request()))
    assert not crash.ok and crash.run.signal == "SIGSEGV" and crash.run.stderr == "Segmentation fault"
    assert crash.error.code == "runtime_error"

    nonzero = arun(judge0(Server(judge0_reply(12, "Runtime Error (NZEC)", exit_code=3))).execute(request()))
    assert not nonzero.ok and nonzero.run.code == 3


def test_judge0_internal_error_is_the_providers_fault():
    error = failure(judge0(Server(judge0_reply(13, "Internal Error"))))
    assert error.status_code == 502 and error.payload["code"] == "run_provider_unavailable"


def test_judge0_reply_without_a_status_is_unusable():
    assert failure(judge0(Server(json_reply({"stdout": None})))).payload["code"] == "run_provider_unavailable"


def test_judge0_polls_when_the_server_does_not_allow_wait():
    calls = []

    def reply(http_request):
        calls.append((http_request.method, http_request.url.path, dict(http_request.url.params)))
        if http_request.method == "POST" and http_request.url.params.get("wait") == "true":
            return json_reply({"error": "wait not allowed"}, status=400)
        if http_request.method == "POST":
            return json_reply({"token": "tok-9"}, status=201)
        if len([c for c in calls if c[0] == "GET"]) < 3:
            return judge0_reply(2, "Processing")
        return judge0_reply(stdout=b64("done"))

    result = arun(judge0(Server(reply)).execute(request("python", (("main.py", "x"),))))
    assert result.ok and result.run.stdout == "done"
    assert [c[0] for c in calls] == ["POST", "POST", "GET", "GET", "GET"]
    assert "wait" not in calls[1][2] and calls[2][1] == "/submissions/tok-9"


def test_judge0_polling_gives_up_with_a_timeout(monkeypatch):
    def reply(http_request):
        if http_request.method == "POST" and http_request.url.params.get("wait") == "true":
            return json_reply({"error": "wait not allowed"}, status=400)
        if http_request.method == "POST":
            return json_reply({"token": "t"}, status=201)
        return judge0_reply(1, "In Queue")

    # The loop's deadline is compile + run + 10 s: let its clock jump past it
    # instead of waiting.
    clock = iter(range(0, 10_000, 100))
    monkeypatch.setattr(judge0_executor, "time", SimpleNamespace(monotonic=lambda: next(clock),
                                                                 perf_counter=real_time.perf_counter))
    req = request("python", (("main.py", "x"),), run_timeout_ms=100, compile_timeout_ms=100)
    error = failure(judge0(Server(reply)), req)
    assert error.status_code == 504 and error.payload["code"] == "run_provider_timeout"


def test_judge0_other_4xx_is_not_mistaken_for_the_wait_switch():
    error = failure(judge0(Server(json_reply({"language_id": ["is invalid"]}, status=422))))
    assert error.payload["code"] == "run_provider_rejected" and "is invalid" in error.payload["detail"]


def test_judge0_multi_file_submission_is_a_zip_with_compile_and_run_scripts():
    files = (("main.cpp", "#include \"util.h\"\nint main(){}"), ("util.cpp", "int u(){return 1;}"),
             ("util.h", "int u();"))
    server = Server(judge0_reply(stdout=b64("ok")))
    arun(judge0(server).execute(request(files=files, compile_args=("-O2",), args=("x y",))))

    body = server.body()
    assert body["language_id"] == 89 and "command_line_arguments" not in body and "compiler_options" not in body
    assert body["source_code"] == ""                                   # the real service rejects any text here ("must be blank")
    archive = zipfile.ZipFile(io.BytesIO(base64.b64decode(body["additional_files"])))
    assert sorted(archive.namelist()) == ["compile", "main.cpp", "run", "util.cpp", "util.h"]
    compile_script = archive.read("compile").decode()
    run_script = archive.read("run").decode()
    assert compile_script.startswith("#!/bin/bash\n")
    assert "g++ -O2 -o prog main.cpp util.cpp" in compile_script and "util.h" not in compile_script.split("\n")[1]
    assert run_script.splitlines()[1] == "./prog 'x y'"
    assert (archive.getinfo("compile").external_attr >> 16) & 0o111 and (archive.getinfo("run").external_attr >> 16) & 0o111
    assert (archive.getinfo("main.cpp").external_attr >> 16) & 0o111 == 0
    assert archive.read("util.cpp").decode() == "int u(){return 1;}"


@pytest.mark.parametrize(
    "language, files, compile_has, run_line",
    [
        ("c", (("main.c", "x"), ("a.c", "y")), "gcc  -o prog main.c a.c -lm", "./prog"),
        ("java", (("Main.java", "public class Main{}"), ("Util.java", "class Util{}")),
         "javac -encoding UTF-8 -d out Main.java Util.java", "java -Xmx200m -cp out Main"),
        ("python", (("main.py", "x"), ("lib.py", "y")), ":", "python3 main.py"),
        ("javascript", (("main.js", "x"), ("lib.js", "y")), ":", "node main.js"),
        ("bash", (("main.sh", "x"), ("lib.sh", "y")), ":", "bash main.sh"),
    ],
)
def test_judge0_multi_file_scripts_per_language(language, files, compile_has, run_line):
    server = Server(judge0_reply())
    arun(judge0(server).execute(request(language, files)))
    archive = zipfile.ZipFile(io.BytesIO(base64.b64decode(server.body()["additional_files"])))
    assert compile_has in archive.read("compile").decode()
    assert archive.read("run").decode().splitlines()[1].startswith(run_line)


def test_judge0_java_multi_file_runs_the_packaged_main_class():
    files = (("app/Main.java", "package app;\npublic class Main{}"), ("app/Util.java", "package app;\nclass Util{}"))
    server = Server(judge0_reply())
    arun(judge0(server).execute(request("java", files)))
    archive = zipfile.ZipFile(io.BytesIO(base64.b64decode(server.body()["additional_files"])))
    assert "-cp out app.Main" in archive.read("run").decode()


def test_judge0_multi_file_languages_are_declared():
    executor = Judge0Executor(base_url=JUDGE0_URL)
    assert set(executor.multi_file_languages()) == {"c", "cpp", "java", "python", "javascript", "ruby", "php", "bash"}
    assert "go" in executor.languages() and "go" not in executor.multi_file_languages()


def test_judge0_script_quoting_keeps_arguments_from_becoming_shell_syntax():
    server = Server(judge0_reply())
    nasty = "$(rm -rf /); `id` 'q'"
    arun(judge0(server).execute(request("python", (("main.py", "x"), ("lib.py", "y")), args=(nasty,))))
    archive = zipfile.ZipFile(io.BytesIO(base64.b64decode(server.body()["additional_files"])))
    line = archive.read("run").decode().splitlines()[1]
    import shlex
    assert shlex.split(line) == ["python3", "main.py", nasty]


# ---------------------------------------------------------------------------
# Wandbox
# ---------------------------------------------------------------------------
def wandbox_reply(**fields):
    data = {"status": "0", "signal": "", "compiler_output": "", "compiler_error": "", "compiler_message": "",
            "program_output": "hello\n", "program_error": "", "program_message": "hello\n"}
    data.update(fields)
    return json_reply(data)


def test_wandbox_sends_the_main_file_as_code_and_the_rest_as_codes():
    server = Server(wandbox_reply())
    req = request(files=(("main.cpp", "int main(){}"), ("util.cpp", "int u(){}"), ("util.h", "int u();")),
                  stdin="9", args=("one", "two"), compile_args=("-O2", "-Wall"))
    arun(wandbox(server).execute(req))

    assert server.last.url == httpx.URL(WANDBOX_URL + "/compile.json") and "authorization" not in server.last.headers
    assert server.body() == {
        "compiler": "gcc-13.2.0", "code": "int main(){}", "stdin": "9", "save": False,
        "codes": [{"file": "util.cpp", "code": "int u(){}"}, {"file": "util.h", "code": "int u();"}],
        # Only the main file is compiled unless the other sources are listed.
        "compiler-option-raw": "-O2\n-Wall\nutil.cpp",
        "runtime-option-raw": "one\ntwo",
    }


def test_wandbox_single_file_has_no_extras_in_the_request():
    server = Server(wandbox_reply())
    arun(wandbox(server).execute(request("python", (("main.py", "print(1)"),))))
    assert server.body() == {"compiler": "cpython-3.12.7", "code": "print(1)", "stdin": "", "save": False}


def test_wandbox_success_failure_and_the_two_kinds_of_non_zero_exit():
    ok = arun(wandbox(Server(wandbox_reply())).execute(request()))
    assert ok.ok and ok.version == "gcc-13.2.0" and ok.run.stdout == "hello\n" and ok.compile.ok
    assert ok.run.ms >= 0

    # No program_* fields at all: the compiler failed.
    broken = arun(wandbox(Server(json_reply({"status": "1", "compiler_error": "prog.cc:1:1: error: x",
                                              "compiler_message": "prog.cc:1:1: error: x"}))).execute(request()))
    assert not broken.ok and broken.error.code == "compile_error" and not broken.run.ran
    assert "error: x" in broken.compile.stderr and broken.compile.code == 1

    # The program ran and exited 3.
    exited = arun(wandbox(Server(wandbox_reply(status="3", program_output="", program_message=""))).execute(request()))
    assert not exited.ok and exited.error.code == "runtime_error" and exited.run.code == 3 and exited.compile.ok

    killed = arun(wandbox(Server(wandbox_reply(status="0", signal="Segmentation fault"))).execute(request()))
    assert not killed.ok and killed.run.signal == "Segmentation fault"


def test_wandbox_a_late_kill_reads_as_a_timeout_and_an_early_one_does_not():
    executor = wandbox(Server(None))
    data = {"status": "0", "signal": "Killed", "program_output": "", "program_error": "", "program_message": ""}
    req = request(run_timeout_ms=1000)
    assert executor.read_result(data, req, elapsed_ms=1500).run.timedOut is True
    assert executor.read_result(data, req, elapsed_ms=50).run.timedOut is False


def test_wandbox_interpreted_language_has_no_compile_stage_and_a_reply_without_status_is_unusable():
    result = arun(wandbox(Server(wandbox_reply())).execute(request("python", (("main.py", "x"),))))
    assert result.compile is None
    assert failure(wandbox(Server(json_reply({"nonsense": 1})))).payload["code"] == "run_provider_unavailable"


def test_wandbox_refuses_arguments_it_cannot_carry():
    server = Server(wandbox_reply())
    with pytest.raises(BadRequestError) as caught:
        arun(wandbox(server).execute(request(args=("two\nlines",))))
    assert caught.value.payload["code"] == "run_bad_arg" and server.requests == []


def test_wandbox_multi_file_is_for_c_cpp_python_and_java_only():
    executor = WandboxExecutor(base_url=WANDBOX_URL)
    assert set(executor.multi_file_languages()) == {"c", "cpp", "python", "java"}


# Java on the real service (measured): compiled as prog.java and run as class Main, so a top-level
# `public` type is a javac error; several files work in a flat directory; `package` cannot.
def test_wandbox_java_drops_public_from_top_level_types_and_says_so():
    server = Server(wandbox_reply())
    files = (("Main.java", "import java.util.*;\npublic class Main {\n  public static void main(String[] a) {}\n  public static class In {}\n}\n"),
             ("Util.java", "public final class Util {}\n"))
    result = arun(wandbox(server).execute(request("java", files)))
    body = server.body()
    assert "public class" not in body["code"] and "\nclass Main {" in body["code"]
    assert "public static void main" in body["code"] and "public static class In" in body["code"]    # members stay public
    assert body["codes"] == [{"file": "Util.java", "code": "final class Util {}\n"}]
    assert any("public" in w for w in result.warnings)


def test_wandbox_java_without_a_main_class_warns():
    result = arun(wandbox(Server(wandbox_reply())).execute(request("java", (("App.java", "class App {}"),))))
    assert any("Main" in w for w in result.warnings)


def test_wandbox_java_package_is_refused_without_calling_the_service():
    server = Server(wandbox_reply())
    with pytest.raises(BadRequestError) as caught:
        arun(wandbox(server).execute(request("java", (("A.java", "package app;\npublic class A {}"),))))
    assert caught.value.payload["code"] == "run_multifile_unsupported" and server.requests == []


def test_wandbox_waits_long_enough_for_its_slow_builds():
    executor = WandboxExecutor(base_url=WANDBOX_URL, http_timeout_s=30.0)
    assert executor._timeout_for(request()) >= 60.0
    assert PistonExecutor(base_url=PISTON_URL)._timeout_for(request(run_timeout_ms=1000, compile_timeout_ms=1000)) < 10


def test_wandbox_unknown_compiler_name_is_a_rejection_naming_what_wandbox_said():
    error = failure(wandbox(Server(json_reply({"error": "compiler not found"}, status=400))))
    assert error.payload["code"] == "run_provider_rejected" and "compiler not found" in error.payload["detail"]
