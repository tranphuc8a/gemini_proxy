"""The input rules of `/run` and `/codestore`: file names, compiler flags, entry points.

These are pure functions, and they are the security-relevant ones: a name that
escapes its directory or a flag that reads a file must be refused here, whichever
provider (or store) comes next.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest

from src.application.utils.compile_flags import BadFlag, check_compile_args, is_allowed
from src.application.utils.safe_paths import find_path_conflict, normalize_run_path, normalize_store_path
from src.domain.utils.run_languages import LANGUAGES, canonical_language, pick_main_file, source_files


# ---------------------------------------------------------------------------
# /run file names (strict)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("name", ["main.cpp", "Main.java", "a_b-c.1.py", "src/util/helper.h", "x" * 100, ".hidden"])
def test_run_paths_that_are_safe_pass_unchanged(name):
    assert normalize_run_path(name) == name


@pytest.mark.parametrize(
    "name",
    [
        "", "../etc/passwd", "a/../../b", "/etc/passwd", "C:/Windows/x.cpp", "C:x.cpp", "a\\b.cpp", "a//b.cpp",
        "dir/", "./main.cpp", "a/./b.cpp", "-rf.cpp", "src/-x.c", "main.cpp.", "ma in.cpp", "naïve.cpp",
        "main.cpp\n", "a\x00b.cpp", "tab\t.c", "CON", "nul.txt", "Com1.c", "lpt9", "a" * 101, "a/" * 9 + "b",
        "x" * 201, "a;b.cpp", "$(id).c", "`id`.c", "a|b", "a&b", "a b",
    ],
)
def test_run_paths_that_could_escape_or_be_misread_are_refused(name):
    with pytest.raises(ValueError):
        normalize_run_path(name)


def test_a_trailing_newline_does_not_slip_through_the_name_pattern():
    # `re.match(r"...$")` accepts "a.c\n"; the check must be a full match.
    with pytest.raises(ValueError):
        normalize_run_path("a.c\n")


def test_conflicts_are_found_case_insensitively_and_between_file_and_folder():
    assert find_path_conflict(["a.cpp", "b.cpp"]) is None
    assert "Trùng" in find_path_conflict(["Main.cpp", "main.cpp"])
    assert "thư mục" in find_path_conflict(["src", "src/a.cpp"])
    assert find_path_conflict(["src/a.cpp", "src/b.cpp", "lib/a.cpp"]) is None


# ---------------------------------------------------------------------------
# /codestore paths (lenient but never climbing)
# ---------------------------------------------------------------------------
def test_store_paths_are_repaired_when_harmless():
    assert normalize_store_path("src\\main.cpp") == "src/main.cpp"
    assert normalize_store_path("./src//main.cpp") == "src/main.cpp"
    assert normalize_store_path("Bài 1/Chương trình chính.cpp") == "Bài 1/Chương trình chính.cpp"


@pytest.mark.parametrize(
    "path",
    ["", "   ", "../x", "a/../../x", "a\\..\\x", "/abs", "\\abs", "C:\\x", "d:/x", "dir/", "a/\x00b", "a\x1bb",
     "a/\u202egnp.cpp", "a/ b", "a/b ", "a/b.", "x" * 600, "/".join(["d"] * 20) + "/f", "a/" + "x" * 256, ".", "./"],
)
def test_store_paths_that_climb_or_hold_control_characters_are_refused(path):
    with pytest.raises(ValueError):
        normalize_store_path(path)


# ---------------------------------------------------------------------------
# compiler flags
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "flag",
    ["-std=c++17", "-std=gnu11", "-std=c++2a", "-O0", "-O1", "-O2", "-O3", "-Wall", "-Wextra", "-Wpedantic", "-g",
     "-DDEBUG", "-DN=100", "-DNAME=value_1.5", "-D_X9", "-I.", "-Iinclude", "-Isrc/inc", "-pthread", "-lm"],
)
def test_harmless_flags_are_allowed(flag):
    assert is_allowed(flag)
    assert check_compile_args([flag]) == [flag]


@pytest.mark.parametrize(
    "flag",
    [
        "-include/etc/passwd", "-include", "-fplugin=evil.so", "-o", "-o/tmp/x", "-Wl,--wrap=main", "-Wl,-rpath,/x",
        "-I/etc", "-I../secret", "-I..", "-Ia/../b", "-O4", "-Ofast", "-Os", "-std=", "-std=c++17;rm", "-DX=$(id)",
        "-DX=a b", "-D", "-D1X", "-D=3", "-Wall\n", "--sysroot=/", "-B/tmp", "-x", "-xc++", "-specs=/x", "-@file",
        "main.cpp", "", "-std=c++17\n", "-lpthread", "-L/usr/lib", "-save-temps", "-E", "-S", "-Werror=format",
    ],
)
def test_every_other_flag_is_refused(flag):
    assert not is_allowed(flag)
    with pytest.raises(BadFlag) as caught:
        check_compile_args(["-Wall", flag])
    assert caught.value.args[0] == flag


# ---------------------------------------------------------------------------
# languages and entry points
# ---------------------------------------------------------------------------
def test_language_aliases_resolve_to_one_canonical_id():
    assert canonical_language("C++") == "cpp"
    assert canonical_language(" cpp ") == "cpp"
    assert canonical_language("py") == "python"
    assert canonical_language("JS") == "javascript"
    assert canonical_language("c#") == "csharp"
    assert canonical_language("sh") == "bash"
    assert canonical_language("cobol") is None
    assert canonical_language("") is None
    assert all(canonical_language(language) == language for language in LANGUAGES)


def test_main_file_is_the_requested_one_else_the_conventional_one():
    assert pick_main_file("cpp", ["util.cpp", "main.cpp"]) == "main.cpp"
    assert pick_main_file("cpp", ["util.cpp", "app.cpp"]) == "util.cpp"                 # first of the language
    assert pick_main_file("cpp", ["util.cpp", "app.cpp"], "app.cpp") == "app.cpp"      # requested wins
    assert pick_main_file("java", ["Util.java", "src/Main.java"]) == "src/Main.java"   # conventional name at depth
    assert pick_main_file("python", ["README.md", "tool.py"]) == "tool.py"
    assert pick_main_file("python", ["notes"]) == "notes"                               # nothing matches: the first
    with pytest.raises(ValueError):
        pick_main_file("cpp", ["a.cpp"], "missing.cpp")


def test_source_files_keep_only_the_languages_extensions_in_order():
    assert source_files("cpp", ["b.cpp", "x.h", "a.CC", "n.txt"]) == ["b.cpp", "a.CC"]
    assert source_files("c", ["a.c", "a.cpp"]) == ["a.c"]
