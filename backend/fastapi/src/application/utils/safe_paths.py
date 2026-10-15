"""File-name rules for the two features that accept a tree of user files.

Both exist to keep a hostile name from escaping the directory it is written to
or from being read as something other than a name:

* `normalize_run_path` is the strict one, for `/run`: the names become real files
  on disk (the `local` provider) and arguments of a compiler, so the alphabet is
  `[A-Za-z0-9_.-]` per segment, no segment may start with `-` (it would read as a
  flag) or end with `.` (Windows strips it, so two names would collide), and
  Windows device names (`CON`, `NUL`, ...) are refused.
* `normalize_store_path` is the lenient one, for `/codestore`: files are only
  stored and handed back, so Unicode names with spaces are fine. It repairs what
  is harmless (`\\` becomes `/`, `./` and `//` are dropped) and refuses what is
  not (`..`, absolute paths, drive letters, control characters).

Both raise `ValueError` with a Vietnamese message the use case turns into a 400.
"""

from __future__ import annotations

import re
import unicodedata
from typing import List

MAX_RUN_PATH_CHARS = 200
MAX_RUN_SEGMENT_CHARS = 100
MAX_RUN_DEPTH = 8

MAX_STORE_PATH_CHARS = 512
MAX_STORE_SEGMENT_CHARS = 255
MAX_STORE_DEPTH = 16

_RUN_SEGMENT = re.compile(r"[A-Za-z0-9_.-]+")
_DRIVE = re.compile(r"[A-Za-z]:")
_WINDOWS_DEVICE = re.compile(r"(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?", re.IGNORECASE | re.DOTALL)
# Characters that reorder text on screen: a name that LOOKS like `main.cpp` and
# is not.
_BIDI = set("‎‏‪‫‬‭‮⁦⁧⁨⁩")


def normalize_run_path(name: str) -> str:
    if not isinstance(name, str) or not name:
        raise ValueError("Tên tệp không được để trống")
    if len(name) > MAX_RUN_PATH_CHARS:
        raise ValueError(f"Tên tệp quá dài (tối đa {MAX_RUN_PATH_CHARS} ký tự)")
    if name.startswith("/") or name.endswith("/") or _DRIVE.match(name):
        raise ValueError(f"Tên tệp {name!r} phải là đường dẫn tương đối")
    segments = name.split("/")
    if len(segments) > MAX_RUN_DEPTH:
        raise ValueError(f"Đường dẫn {name!r} lồng quá sâu (tối đa {MAX_RUN_DEPTH} cấp)")
    for segment in segments:
        if segment in ("", ".", ".."):
            raise ValueError(f"Đường dẫn {name!r} có thành phần không hợp lệ")
        if len(segment) > MAX_RUN_SEGMENT_CHARS:
            raise ValueError(f"Đường dẫn {name!r} có thành phần quá dài")
        if not _RUN_SEGMENT.fullmatch(segment):
            raise ValueError(f"Tên tệp {name!r} chỉ được gồm chữ, số, '_', '-', '.' (và '/' cho thư mục con)")
        if segment.startswith("-"):
            raise ValueError(f"Tên tệp {name!r} không được bắt đầu bằng '-'")
        if segment.endswith("."):
            raise ValueError(f"Tên tệp {name!r} không được kết thúc bằng '.'")
        if _WINDOWS_DEVICE.fullmatch(segment):
            raise ValueError(f"Tên tệp {name!r} trùng tên thiết bị của Windows")
    return "/".join(segments)


def normalize_store_path(path: str) -> str:
    if not isinstance(path, str) or not path.strip():
        raise ValueError("Đường dẫn tệp không được để trống")
    for char in path:
        if unicodedata.category(char) == "Cc" or char in _BIDI:
            raise ValueError("Đường dẫn tệp chứa ký tự điều khiển")
    unified = path.replace("\\", "/")
    if unified.startswith("/") or _DRIVE.match(unified):
        raise ValueError(f"Đường dẫn {path!r} phải là đường dẫn tương đối")
    if unified.endswith("/"):
        raise ValueError(f"Đường dẫn {path!r} không được kết thúc bằng '/'")
    segments: List[str] = []
    for segment in unified.split("/"):
        if segment in ("", "."):
            continue
        if segment == "..":
            raise ValueError(f"Đường dẫn {path!r} chứa '..'")
        if segment != segment.strip() or segment.endswith("."):
            raise ValueError(f"Đường dẫn {path!r} có thành phần bắt đầu/kết thúc bằng khoảng trắng hoặc '.'")
        if len(segment) > MAX_STORE_SEGMENT_CHARS:
            raise ValueError(f"Đường dẫn {path!r} có thành phần quá dài")
        segments.append(segment)
    if not segments:
        raise ValueError("Đường dẫn tệp không được để trống")
    if len(segments) > MAX_STORE_DEPTH:
        raise ValueError(f"Đường dẫn {path!r} lồng quá sâu (tối đa {MAX_STORE_DEPTH} cấp)")
    result = "/".join(segments)
    if len(result) > MAX_STORE_PATH_CHARS:
        raise ValueError(f"Đường dẫn quá dài (tối đa {MAX_STORE_PATH_CHARS} ký tự)")
    return result


def find_path_conflict(paths: List[str]) -> str | None:
    """A message when two paths cannot coexist on a file system, else None.

    Compared case-insensitively (Windows and macOS would merge `A.cpp` and
    `a.cpp`), and a file cannot also be a directory (`a` and `a/b`).
    """
    seen = set()
    directories = set()
    for path in paths:
        key = path.lower()
        if key in seen:
            return f"Trùng tên tệp: {path!r}"
        seen.add(key)
        parts = key.split("/")
        for depth in range(1, len(parts)):
            directories.add("/".join(parts[:depth]))
    for path in paths:
        if path.lower() in directories:
            return f"{path!r} vừa là tệp vừa là thư mục"
    return None
