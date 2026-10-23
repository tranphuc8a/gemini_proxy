"""What comes back from the AI markdown formatter is cut loose from its ```markdown wrapper in linear time.

`_unwrap` runs on whatever the model wrote, inside the event loop (also for /ai/wiki): the regex it replaced backtracks
quadratically over a long run of line breaks after the opening fence.
"""

from __future__ import annotations

import random
import re
import time

import pytest

from src.application.usecases.ai_markdown_usecase import _unwrap

#: The rule as `_unwrap` first wrote it — the SPEC the by-hand version must agree with on every text.
_OLD = re.compile(r"^\s*```(?:markdown|md)?\s*\n(.*)\n```\s*$", flags=re.S | re.I)


def _spec(md: str) -> str:
    m = _OLD.match(md)
    return m.group(1) if m and "```" not in m.group(1) else md


def test_unwrap_takes_the_document_out_of_its_fence():
    assert _unwrap("```markdown\n# T\n\nbody\n```") == "# T\n\nbody"
    assert _unwrap("  ```MD  \n\n  x\n```  \n") == "  x"           # the last line break of the gap opens the text; its own indent stays
    assert _unwrap("```\n\n```") == "" and _unwrap("```\n```") == "```\n```"
    for keep in ("# plain\n", "```python\nx = 1\n```", "```markdown\na\n```\nb\n```", "```md\nunclosed", "```mdx\nx\n```", "``` md\nx\n```x", ""):
        assert _unwrap(keep) == keep, keep


def test_unwrap_is_the_old_rule_on_random_texts():
    rnd = random.Random(31)
    tokens = ["```", "`", "``", "md", "markdown", "MD", "Markdown", "\n", "\n", "\n\n", " ", "\t", "\r\n", "x", "a b", "mdx", "py", "\u00a0", "\u2028"]
    for _ in range(30000):
        s = "".join(rnd.choice(tokens) for _ in range(rnd.randint(0, 12)))
        assert _unwrap(s) == _spec(s), repr(s)


@pytest.mark.parametrize("make", [
    lambda n: "```" + "\n" * n + "x",
    lambda n: "```markdown" + "\n" * n + "x\n```",
    lambda n: "```\n" + "\n" * n + "```",
    lambda n: "```md\n" + "a\n" * n + "```" + " " * n,
    lambda n: " " * n + "```" + " " * n + "x",
    lambda n: "```" + "\n```" * n,
], ids=["open", "closed", "empty", "long-body", "spaces", "many-fences"])
def test_unwrap_stays_linear(make):
    t0 = time.perf_counter()
    _unwrap(make(200000))
    assert time.perf_counter() - t0 < 0.3
