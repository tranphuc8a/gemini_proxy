"""The languages `/run` knows, in one table.

Each provider names languages its own way (`c++`, `gcc-13.2.0`, id 54...); the
mapping lives in its adapter. What is shared is here: the canonical id the API
speaks, the file extensions, the file names that conventionally hold `main`, and
whether the language has a separate compile step.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Sequence, Tuple


@dataclass(frozen=True)
class Language:
    id: str
    label: str
    extensions: Tuple[str, ...]
    #: Preferred entry-point file names, best first (compared case-sensitively).
    main_names: Tuple[str, ...]
    compiled: bool


LANGUAGES: Dict[str, Language] = {
    lang.id: lang
    for lang in (
        Language("c", "C", (".c",), ("main.c",), True),
        Language("cpp", "C++", (".cpp", ".cc", ".cxx", ".c++"), ("main.cpp", "main.cc", "main.cxx"), True),
        Language("java", "Java", (".java",), ("Main.java",), True),
        Language("python", "Python", (".py",), ("main.py", "__main__.py"), False),
        Language("javascript", "JavaScript", (".js", ".mjs", ".cjs"), ("main.js", "index.js"), False),
        Language("typescript", "TypeScript", (".ts",), ("main.ts", "index.ts"), True),
        Language("go", "Go", (".go",), ("main.go",), True),
        Language("rust", "Rust", (".rs",), ("main.rs",), True),
        Language("csharp", "C#", (".cs",), ("Program.cs", "Main.cs"), True),
        Language("kotlin", "Kotlin", (".kt",), ("Main.kt", "main.kt"), True),
        Language("php", "PHP", (".php",), ("main.php", "index.php"), False),
        Language("ruby", "Ruby", (".rb",), ("main.rb",), False),
        Language("bash", "Bash", (".sh", ".bash"), ("main.sh", "script.sh"), False),
    )
}

ALIASES: Dict[str, str] = {
    "c++": "cpp", "cxx": "cpp", "cc": "cpp",
    "py": "python", "python3": "python",
    "js": "javascript", "node": "javascript", "nodejs": "javascript",
    "ts": "typescript",
    "golang": "go",
    "rs": "rust",
    "c#": "csharp", "cs": "csharp",
    "kt": "kotlin",
    "rb": "ruby",
    "sh": "bash", "shell": "bash",
}


def canonical_language(value: str) -> Optional[str]:
    """`C++`, `cpp`, `c++` -> `cpp`; unknown -> None."""
    key = (value or "").strip().lower()
    key = ALIASES.get(key, key)
    return key if key in LANGUAGES else None


def pick_main_file(language: str, paths: Sequence[str], requested: Optional[str] = None) -> str:
    """The entry point among `paths` (already normalised).

    A `requested` file wins when present. Otherwise the conventional name for the
    language, then the first file with the language's extension, then simply the
    first file. Raises `ValueError` when `requested` is not one of `paths`.
    """
    if requested:
        if requested not in paths:
            raise ValueError(f"mainFile {requested!r} không nằm trong danh sách tệp")
        return requested
    spec = LANGUAGES[language]
    for name in spec.main_names:
        for path in paths:
            # A name matches at any depth, so `src/Main.java` is found too.
            if path == name or path.endswith("/" + name):
                return path
    for path in paths:
        if path.lower().endswith(spec.extensions):
            return path
    return paths[0]


def source_files(language: str, paths: Sequence[str]) -> list[str]:
    """The files of `paths` that are source code of `language`, in order."""
    extensions = LANGUAGES[language].extensions
    return [path for path in paths if path.lower().endswith(extensions)]
