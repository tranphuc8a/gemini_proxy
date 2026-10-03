"""Links between the lessons of a course — what the "Kiểm tra liên kết" tab and
the delete warning are built on. Markdown is request input, so a hostile line
must cost linear time (CodeQL py/polynomial-redos)."""

import time

from src.domain.utils import course_links as cl


def test_every_link_form_is_judged():
    md = ('[a](b.md) ![h](assets/x.png) [c](<d.md> "tiêu đề") [e](#/slug#neo) [f](https://x.y) '
          '[g [h](d.md) [mất](khong-co.md)\n```\n[i](khong-co-2.md)\n```\n`[j](khong-co-3.md)`\n')
    rep = cl.scan({"a.md": md, "b.md": "", "d.md": ""}, {"slug": "b.md"}, {}, ["x.png"])
    assert [b["href"] for b in rep["broken"]] == ["khong-co.md"], "code blocks and inline code are not links"
    assert rep["inbound"] == {"b.md": ["a.md"], "d.md": ["a.md"]}, "a '[' inside the text still finds the link"
    assert rep["assetUse"] == {"x.png": ["a.md"]}
    assert rep["checked"] == 6


def test_hostile_lines_cost_linear_time():
    md = "\n".join(["[" * 100_000, "![" * 50_000, "[" + "\\[" * 50_000,
                    "[](" * 30_000, "[](<" * 30_000, "[a](" * 30_000, "[x](khong-co.md)"])
    started = time.perf_counter()
    rep = cl.scan({"a.md": md}, {}, {}, [])
    assert time.perf_counter() - started < 0.5
    assert [b["href"] for b in rep["broken"]] == ["khong-co.md"]
