"""Which compiler flags `/run` forwards.

A compiler flag is code: `-include /etc/passwd`, `-fplugin=...`, `-o /somewhere`,
`-Wl,--wrap` and a hundred others read, write or load things. So the rule is an
allow-list of shapes known to be harmless, and every other flag is refused with
`run_bad_flag` instead of being passed through and hoped about.

Allowed: `-std=<id>`, `-O0`..`-O3`, `-Wall`, `-Wextra`, `-Wpedantic`,
`-pedantic`, `-Werror`, `-g`, `-pthread`, `-lm`, `-D<NAME>[=<value>]`, and
`-I<dir>` with a relative directory that stays inside the project.
"""

from __future__ import annotations

import re
from typing import Iterable, List

_EXACT = frozenset({
    "-O0", "-O1", "-O2", "-O3",
    "-Wall", "-Wextra", "-Wpedantic", "-pedantic", "-Werror",
    "-g", "-pthread", "-lm",
})
_STD = re.compile(r"-std=[A-Za-z0-9+:.]{1,20}")
_DEFINE = re.compile(r"-D[A-Za-z_][A-Za-z0-9_]{0,63}(=[A-Za-z0-9_.+\-]{0,64})?")
_INCLUDE_DIR = re.compile(r"-I[A-Za-z0-9_./-]{1,100}")


class BadFlag(ValueError):
    """The flag that was refused is `args[0]`."""


def _is_safe_include(flag: str) -> bool:
    if not _INCLUDE_DIR.fullmatch(flag):
        return False
    directory = flag[2:]
    if directory.startswith("/"):
        return False
    return ".." not in directory.split("/")


def is_allowed(flag: str) -> bool:
    return bool(
        flag in _EXACT
        or _STD.fullmatch(flag)
        or _DEFINE.fullmatch(flag)
        or _is_safe_include(flag)
    )


def check_compile_args(flags: Iterable[str]) -> List[str]:
    """The flags unchanged when all are allowed; otherwise `BadFlag(<first bad>)`."""
    checked: List[str] = []
    for flag in flags:
        if not is_allowed(flag):
            raise BadFlag(flag)
        checked.append(flag)
    return checked
