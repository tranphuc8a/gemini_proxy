"""The `local` provider, driven against the real programs on this machine.

These tests run real (small, harmless) code, so each language group is skipped when
its tool is not installed. What they establish is the part of `local` that is about
containing accidents: the run happens in a private directory that is removed, with
a clean environment and no shell; a runaway loop is killed - with its child
processes; huge output is cut; hostile paths cannot leave the directory; and only
a limited number of runs go at once.

None of it makes `local` a sandbox (see the module's docstring): the code still runs
as the server's user.
"""

import os

os.environ.setdefault("TESTING", "1")

import shutil
import subprocess
import sys
import threading
import time

import pytest

from src.adapter.output.run import local_executor
from src.adapter.output.run.local_executor import LocalExecutor, run_process
from src.application.exceptions.exceptions import AppException
from src.application.exceptions.run_exceptions import RunProviderUnavailable
from src.domain.vo.run_vo import MAX_OUTPUT_BYTES, ExecutionRequest, SourceFile
from tests.conftest import arun

needs_gxx = pytest.mark.skipif(shutil.which("g++") is None, reason="g++ is not installed")
needs_gcc = pytest.mark.skipif(shutil.which("gcc") is None, reason="gcc is not installed")
needs_java = pytest.mark.skipif(shutil.which("javac") is None or shutil.which("java") is None,
                                reason="javac/java are not installed")
needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def make_request(language, files, **overrides):
    values = dict(
        language=language,
        files=tuple(SourceFile(path=path, content=content) for path, content in files),
        main_file=files[0][0],
        stdin="",
        args=(),
        compile_args=(),
        run_timeout_ms=5000,
        compile_timeout_ms=30000,
    )
    values.update(overrides)
    return ExecutionRequest(**values)


def python_request(code, **overrides):
    return make_request("python", (("main.py", code),), **overrides)


@pytest.fixture
def work(tmp_path):
    root = tmp_path / "work"
    root.mkdir()
    return root


@pytest.fixture
def executor(work):
    return LocalExecutor(enabled=True, work_root=str(work))


def execute(executor, request):
    return arun(executor.execute(request))


def pid_alive(pid):
    if os.name == "nt":
        listing = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True).stdout
        return str(pid) in listing
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


# ---------------------------------------------------------------------------
# availability
# ---------------------------------------------------------------------------
def test_it_is_off_by_default_and_says_which_switch_turns_it_on():
    off = LocalExecutor()
    assert off.availability()[0] is False and "RUN_LOCAL_ENABLED" in off.availability()[1]
    assert off.needs_session is True and off.kind == "local"


def test_enabled_without_any_tool_is_unavailable():
    nothing = {key: "no-such-program-xyz" for key in ("gcc", "gxx", "javac", "java", "python", "node")}
    executor = LocalExecutor(enabled=True, tools=nothing)
    assert executor.languages() == ()
    available, reason = executor.availability()
    assert available is False and "trình biên dịch" in reason


def test_languages_follow_the_tools_found_and_overrides_are_honoured():
    executor = LocalExecutor(enabled=True, tools={"gxx": "no-such-program-xyz", "java": "no-such-program-xyz"})
    languages = executor.languages()
    assert "cpp" not in languages and "java" not in languages
    assert "python" in languages                                        # the interpreter running this suite
    assert executor.availability() == (True, "")
    python = LocalExecutor(enabled=True, tools={"python": sys.executable})
    assert "python" in python.languages()


def test_a_missing_tool_at_run_time_is_the_providers_problem():
    executor = LocalExecutor(enabled=True, tools={"python": "no-such-program-xyz"})
    with pytest.raises(RunProviderUnavailable):
        arun(executor.execute(python_request("print(1)")))


# ---------------------------------------------------------------------------
# python: the behaviours that do not depend on a compiler
# ---------------------------------------------------------------------------
def test_python_runs_with_stdin_arguments_and_unicode_output(executor):
    code = "import sys\nprint('xin chào', sys.argv[1:], sys.stdin.read().strip())"
    result = execute(executor, python_request(code, stdin="dữ liệu\n", args=("a b", "--c")))
    assert result.ok and result.error is None and result.compile is None
    assert result.run.stdout.strip() == "xin chào ['a b', '--c'] dữ liệu"
    assert result.run.code == 0 and result.run.ran and result.version.startswith("Python")
    assert result.provider == "local" and result.run.ms >= 0


def test_a_failing_program_is_an_ok_false_result_with_its_stderr(executor):
    result = execute(executor, python_request("raise ValueError('boom')"))
    assert not result.ok and result.error.code == "runtime_error"
    assert result.run.code == 1 and "ValueError: boom" in result.run.stderr and not result.run.timedOut


def test_exit_code_is_reported(executor):
    result = execute(executor, python_request("import sys; sys.exit(7)"))
    assert result.run.code == 7 and not result.ok


def test_multiple_python_files_can_import_each_other(executor):
    request = make_request("python", (("main.py", "import lib.util as u\nprint(u.twice(21))"),
                                      ("lib/__init__.py", ""), ("lib/util.py", "def twice(x): return 2 * x")))
    assert execute(executor, request).run.stdout.strip() == "42"


def test_compile_flags_do_not_apply_to_python_and_the_result_says_so(executor):
    result = execute(executor, python_request("print(1)", compile_args=("-O2",)))
    assert result.ok and any("compileArgs" in warning for warning in result.warnings)


def test_an_infinite_loop_is_killed_at_the_timeout(executor, work):
    started = time.perf_counter()
    result = execute(executor, python_request("while True:\n    pass", run_timeout_ms=400))
    elapsed = time.perf_counter() - started
    assert not result.ok and result.run.timedOut and result.error.code == "run_timeout"
    assert 0.35 <= result.run.ms / 1000 < 5 and elapsed < 8
    assert list(work.iterdir()) == []                                  # the private directory was removed


def test_killing_on_timeout_takes_the_child_processes_too(executor):
    code = (
        "import subprocess, sys, time\n"
        "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(120)'])\n"
        "print(child.pid, flush=True)\n"
        "time.sleep(120)\n"
    )
    result = execute(executor, python_request(code, run_timeout_ms=1500))
    assert result.run.timedOut
    child = int(result.run.stdout.split()[0])                           # partial output survives the kill
    for _ in range(20):
        if not pid_alive(child):
            break
        time.sleep(0.25)
    assert not pid_alive(child), "the grandchild outlived the timeout"


def test_huge_output_is_cut_at_the_limit_and_flagged(executor):
    code = "import sys\nsys.stdout.write('x' * 3_000_000)\nsys.stderr.write('e' * 2_000_000)"
    result = execute(executor, python_request(code, run_timeout_ms=15000))
    assert result.run.truncated is True
    assert len(result.run.stdout.encode()) == MAX_OUTPUT_BYTES
    assert len(result.run.stderr.encode()) == MAX_OUTPUT_BYTES
    assert result.ok and result.run.code == 0                           # draining keeps the exit status honest


def test_the_program_sees_a_clean_environment_in_a_private_directory(executor, work, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "must-not-leak")
    monkeypatch.setenv("COURSE_ADMIN_KEY", "must-not-leak-either")
    code = "import os, json\nprint(json.dumps({'env': dict(os.environ), 'cwd': os.getcwd()}))"
    result = execute(executor, python_request(code))
    import json
    seen = json.loads(result.run.stdout)
    assert "must-not-leak" not in result.run.stdout and "must-not-leak-either" not in result.run.stdout
    assert "GEMINI_API_KEY" not in seen["env"] and "COURSE_ADMIN_KEY" not in seen["env"]
    assert os.path.realpath(seen["cwd"]).startswith(os.path.realpath(str(work)))     # under the run root
    assert seen["env"]["HOME"] == seen["cwd"] or os.path.realpath(seen["env"]["HOME"]) == os.path.realpath(seen["cwd"])
    # Only what a program needs to start, not the parent's whole environment.
    assert len(seen["env"]) <= 12


def test_nothing_is_interpreted_by_a_shell(executor):
    nasty = ["a; echo pwned", "$(echo pwned)", "`echo pwned`", "x && y", "| z", "> out.txt", "'q'", '"d"']
    result = execute(executor, python_request("import sys\nfor a in sys.argv[1:]: print(a)", args=tuple(nasty)))
    assert result.run.stdout.splitlines() == nasty
    assert "pwned" not in result.run.stdout.replace("echo pwned", "")


def test_a_file_name_with_shell_characters_is_just_a_name(executor):
    request = make_request("python", (("x&y;z.py", "print('ran')"),))
    assert execute(executor, request).run.stdout.strip() == "ran"


def test_a_big_stdin_that_the_program_ignores_does_not_hang(executor):
    started = time.perf_counter()
    result = execute(executor, python_request("print('done')", stdin="z" * 65_536))
    assert result.ok and time.perf_counter() - started < 10


# ---------------------------------------------------------------------------
# path traversal, even if the use case's vetting were bypassed
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("path", ["../escape.py", "a/../../escape.py", "/tmp/escape.py", "C:/escape.py",
                                  "C:\\escape.py"])
def test_a_path_that_leaves_the_run_directory_is_refused_and_nothing_is_written(executor, work, path):
    request = make_request("python", (("main.py", "print(1)"), (path, "print('escaped')")))
    with pytest.raises(RunProviderUnavailable):
        arun(executor.execute(request))
    assert not (work.parent / "escape.py").exists()
    assert list(work.iterdir()) == []


def test_the_directory_is_removed_after_success_failure_and_timeout(executor, work):
    execute(executor, python_request("print(1)"))
    execute(executor, python_request("1/0"))
    execute(executor, python_request("import time; time.sleep(60)", run_timeout_ms=300))
    assert list(work.iterdir()) == []


def test_only_a_limited_number_of_runs_go_at_the_same_time(work):
    executor = LocalExecutor(enabled=True, work_root=str(work), max_concurrent=1)
    slow = python_request("import time; time.sleep(2.5); print('slow done')", run_timeout_ms=8000)
    outcome = {}

    def first():
        outcome["result"] = arun(executor.execute(slow))

    thread = threading.Thread(target=first)
    thread.start()
    try:
        for _ in range(100):                                          # wait until it has really started
            if any(work.iterdir()):
                break
            time.sleep(0.05)
        with pytest.raises(AppException) as caught:
            arun(executor.execute(python_request("print(1)")))
        assert caught.value.status_code == 429 and caught.value.payload["code"] == "run_busy"
    finally:
        thread.join(timeout=20)
    assert outcome["result"].run.stdout.strip() == "slow done"
    assert arun(executor.execute(python_request("print(2)"))).ok       # the slot was released


def test_run_process_kills_the_whole_tree_and_reports_the_timeout(tmp_path):
    outcome = run_process([sys.executable, "-c", "import time; time.sleep(60)"], cwd=str(tmp_path),
                          env=dict(os.environ), stdin=b"", timeout_s=0.5)
    assert outcome.timed_out and outcome.ms < 10_000


def test_run_process_with_a_program_that_cannot_start_raises_oserror(tmp_path):
    with pytest.raises(OSError):
        run_process([str(tmp_path / "does-not-exist")], cwd=str(tmp_path), env={}, stdin=b"", timeout_s=2)


def test_the_module_never_uses_a_shell():
    source = open(local_executor.__file__, encoding="utf-8").read()
    assert "shell=True" not in source and "os.system" not in source and "create_subprocess_shell" not in source


# ---------------------------------------------------------------------------
# C / C++
# ---------------------------------------------------------------------------
@needs_gxx
def test_cpp_compiles_and_runs_with_stdin_and_arguments(executor):
    code = (
        "#include <iostream>\n#include <string>\n"
        "int main(int argc, char** argv) { int a, b; std::cin >> a >> b;\n"
        "  std::cout << a + b << ' ' << (argc > 1 ? argv[1] : \"-\") << std::endl; return 0; }\n"
    )
    result = execute(executor, make_request("cpp", (("main.cpp", code),), stdin="20 22\n", args=("hi",)))
    assert result.ok, result.model_dump()
    assert result.run.stdout.strip() == "42 hi"
    assert result.compile.ran and result.compile.ok and result.compile.code == 0 and result.version


@needs_gxx
def test_cpp_defaults_to_cpp17_so_modern_code_builds(executor):
    code = "#include <optional>\n#include <iostream>\nint main(){ std::optional<int> v = 3; std::cout << *v; }\n"
    assert execute(executor, make_request("cpp", (("main.cpp", code),))).run.stdout == "3"


@needs_gxx
def test_cpp_compile_error_is_reported_and_nothing_runs(executor):
    result = execute(executor, make_request("cpp", (("main.cpp", "int main( { return 0 }\n"),)))
    assert not result.ok and result.error.code == "compile_error"
    assert result.compile.ran and not result.compile.ok and "error" in result.compile.stderr
    assert not result.run.ran and result.run.stdout == ""


@needs_gxx
def test_cpp_several_files_and_a_header_are_compiled_together(executor):
    files = (
        ("main.cpp", '#include "util.h"\n#include <iostream>\nint main(){ std::cout << twice(21); }\n'),
        ("util.h", "int twice(int);\n"),
        ("util.cpp", '#include "util.h"\nint twice(int x){ return 2 * x; }\n'),
    )
    result = execute(executor, make_request("cpp", files))
    assert result.ok, result.model_dump()
    assert result.run.stdout == "42"


@needs_gxx
def test_cpp_allowed_flags_take_effect(executor):
    code = "#include <iostream>\nint main(){\n#ifdef GREETING\n std::cout << GREETING;\n#endif\n}\n"
    result = execute(executor, make_request("cpp", (("main.cpp", code),), compile_args=("-O2", "-DGREETING=7")))
    assert result.ok and result.run.stdout == "7"


@needs_gxx
def test_cpp_infinite_loop_is_killed(executor, work):
    result = execute(executor, make_request("cpp", (("main.cpp", "int main(){ while(true){} }\n"),),
                                            run_timeout_ms=500))
    assert not result.ok and result.run.timedOut and result.error.code == "run_timeout"
    assert result.compile.ok
    assert list(work.iterdir()) == []


@needs_gxx
def test_cpp_output_flood_is_cut(executor):
    code = '#include <cstdio>\nint main(){ for(int i=0;i<200000;i++) std::puts("0123456789012345678901234567890123456789"); }\n'
    result = execute(executor, make_request("cpp", (("main.cpp", code),), run_timeout_ms=15000))
    assert result.run.truncated and len(result.run.stdout.encode()) <= MAX_OUTPUT_BYTES


@needs_gcc
def test_c_compiles_and_links_the_math_library(executor):
    code = '#include <stdio.h>\n#include <math.h>\nint main(void){ printf("%.0f", sqrt(144.0)); return 0; }\n'
    result = execute(executor, make_request("c", (("main.c", code),)))
    assert result.ok, result.model_dump()
    assert result.run.stdout == "12"


# ---------------------------------------------------------------------------
# Java / JavaScript
# ---------------------------------------------------------------------------
@needs_java
def test_java_compiles_and_runs_the_main_class_with_unicode(executor):
    code = ('public class Main { public static void main(String[] a) throws Exception {\n'
            '  java.util.Scanner s = new java.util.Scanner(System.in); int n = s.nextInt();\n'
            '  System.out.println("xin chào " + (n * 2) + " " + a.length); } }\n')
    result = execute(executor, make_request("java", (("Main.java", code),), stdin="21\n", args=("x",)))
    assert result.ok, result.model_dump()
    assert result.run.stdout.strip() == "xin chào 42 1"
    assert result.compile.ok and "javac" in result.version


@needs_java
def test_java_with_a_package_and_two_files(executor):
    files = (
        ("app/Main.java", "package app;\npublic class Main { public static void main(String[] a){ System.out.println(Util.hi()); } }\n"),
        ("app/Util.java", "package app;\nclass Util { static String hi(){ return \"hi\"; } }\n"),
    )
    result = execute(executor, make_request("java", files))
    assert result.ok, result.model_dump()
    assert result.run.stdout.strip() == "hi"


@needs_java
def test_java_compile_error_and_exception(executor):
    broken = execute(executor, make_request("java", (("Main.java", "public class Main { void x( }"),)))
    assert not broken.ok and broken.error.code == "compile_error" and not broken.run.ran
    crash = execute(executor, make_request(
        "java", (("Main.java", "public class Main { public static void main(String[] a){ throw new RuntimeException(\"bad\"); } }"),)))
    assert not crash.ok and crash.run.code == 1 and "RuntimeException" in crash.run.stderr


@needs_node
def test_javascript_runs_with_stdin(executor):
    code = "let d=''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => console.log(d.trim().toUpperCase(), process.argv.length));"
    result = execute(executor, make_request("javascript", (("main.js", code),), stdin="abc\n", args=("q",)))
    assert result.ok, result.model_dump()
    assert result.run.stdout.strip() == "ABC 3"
    assert result.compile is None


# ---------------------------------------------------------------------------
# rlimit (POSIX only): the limits are really applied to the child, not just written in a docstring.
# Checked on Linux (WSL Ubuntu, 2026-10); Windows has none of this, so these tests are skipped there.
# ---------------------------------------------------------------------------
posix_only = pytest.mark.skipif(os.name == "nt", reason="rlimit exists on POSIX only")


@posix_only
@needs_gcc
def test_native_program_gets_the_posix_limits(executor):
    code = (
        "#include <stdio.h>\n#include <sys/resource.h>\n"
        "int main(void){ struct rlimit r; const int w[] = {RLIMIT_CORE, RLIMIT_FSIZE, RLIMIT_NOFILE, RLIMIT_AS};\n"
        "  for (int i = 0; i < 4; i++) { getrlimit(w[i], &r); printf(\"%llu\\n\", (unsigned long long)r.rlim_cur); } return 0; }\n"
    )
    result = execute(executor, make_request("c", (("main.c", code),)))
    assert result.ok, result.model_dump()
    core, fsize, nofile, address = (int(x) for x in result.run.stdout.split())
    assert core == 0                                                    # no core files
    assert fsize == local_executor.FILE_SIZE_LIMIT
    assert nofile == local_executor.OPEN_FILES_LIMIT
    assert address == local_executor.NATIVE_MEMORY_LIMIT


@posix_only
@needs_gcc
def test_a_native_program_cannot_allocate_far_more_than_the_memory_limit(executor):
    code = "#include <stdio.h>\n#include <stdlib.h>\nint main(void){ void *p = malloc(3UL << 30); puts(p ? \"got\" : \"refused\"); return 0; }\n"
    result = execute(executor, make_request("c", (("main.c", code),)))
    assert result.ok and result.run.stdout.strip() == "refused", result.model_dump()


@posix_only
@needs_gcc
def test_writing_a_huge_file_is_stopped_by_the_file_size_limit(executor):
    code = (
        "#include <stdio.h>\nint main(void){ FILE *f = fopen(\"big.bin\", \"wb\"); static char b[1 << 20];\n"
        "  for (int i = 0; i < 200; i++) if (fwrite(b, 1, sizeof b, f) != sizeof b) { puts(\"short write\"); return 3; }\n"
        "  fclose(f); puts(\"wrote all\"); return 0; }\n"
    )
    result = execute(executor, make_request("c", (("main.c", code),)))
    assert not result.ok and "wrote all" not in result.run.stdout     # 200 MB is over the 64 MB limit: SIGXFSZ or a short write
    assert result.run.signal == "SIGXFSZ" or result.run.code == 3


@posix_only
@needs_gcc
def test_opening_too_many_files_fails_at_the_open_files_limit(executor):
    code = "#include <stdio.h>\nint main(void){ int n = 0; while (fopen(\"/dev/null\", \"r\")) n++; printf(\"%d\\n\", n); return 0; }\n"
    result = execute(executor, make_request("c", (("main.c", code),)))
    assert result.ok, result.model_dump()
    assert 900 <= int(result.run.stdout.strip()) <= local_executor.OPEN_FILES_LIMIT

