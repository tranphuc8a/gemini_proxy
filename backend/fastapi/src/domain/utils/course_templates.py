"""Starting structures for a new course, so it does not begin as a blank page.

Each template is the import format (`nav` + `docs`) with placeholder lessons
whose text says what to write there. They are ordinary documents: edit them,
move them, delete them.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

TEMPLATES: Dict[str, str] = {
    "trong": "Trống — chỉ có khoá, tự dựng mục lục",
    "co-ban": "Khoá học cơ bản — Giới thiệu, 3 phần, Tài liệu tra cứu",
    "chu-de": "Theo chủ đề — mỗi chủ đề một nhóm bài, có bài tổng kết",
}


def _doc(doc_id: str, slug: str, title: str, kind: str, lead: str) -> Dict[str, Any]:
    md = (
        f"# {title}\n\n"
        f"> 📌 {lead}\n\n"
        "## Mục tiêu\n\n- Sau bài này người học làm được gì?\n\n"
        "## Nội dung\n\nViết nội dung ở đây. Dùng `##` cho các mục chính — chúng thành mục lục bên phải bài.\n"
    )
    return {"id": doc_id, "slug": slug, "title": title, "kind": kind, "md": md}


def build(template: str, title: str) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """(nav, docs) of a template; ("trong" →) empty."""
    if template == "co-ban":
        docs = [
            _doc("gioi-thieu/README.md", "gioi-thieu", f"Giới thiệu {title}", "intro",
                 "Khoá học này dành cho ai, học xong làm được gì, học trong bao lâu."),
            _doc("phan-1/bai-01.md", "phan-1/bai-01", "Bài 1", "lesson", "Bài mở đầu của phần 1."),
            _doc("phan-1/bai-02.md", "phan-1/bai-02", "Bài 2", "lesson", "Bài tiếp theo của phần 1."),
            _doc("phan-2/bai-01.md", "phan-2/bai-01", "Bài 1", "lesson", "Bài mở đầu của phần 2."),
            _doc("phan-3/bai-01.md", "phan-3/bai-01", "Bài 1", "lesson", "Bài mở đầu của phần 3."),
            _doc("tai-lieu/thuat-ngu.md", "tai-lieu/thuat-ngu", "Thuật ngữ", "ref",
                 "Bảng thuật ngữ — mở khi đang học."),
        ]
        nav = [
            {"id": "khoa-hoc", "title": "Khoá học", "sub": "lộ trình chính", "icon": "compass", "groups": [
                {"title": "Bắt đầu", "short": "Bắt đầu", "items": ["gioi-thieu/README.md"]},
                {"title": "Phần 1 — Nền tảng", "short": "Phần 1", "items": ["phan-1/bai-01.md", "phan-1/bai-02.md"]},
                {"title": "Phần 2 — Thực hành", "short": "Phần 2", "items": ["phan-2/bai-01.md"]},
                {"title": "Phần 3 — Nâng cao", "short": "Phần 3", "items": ["phan-3/bai-01.md"]},
            ]},
            {"id": "tai-lieu", "title": "Tài liệu", "sub": "tra cứu", "icon": "book", "groups": [
                {"title": "Tra cứu", "short": "Tra cứu", "items": ["tai-lieu/thuat-ngu.md"]},
            ]},
        ]
        return nav, {d["id"]: d for d in docs}
    if template == "chu-de":
        docs = [
            _doc("gioi-thieu/README.md", "gioi-thieu", f"Giới thiệu {title}", "intro",
                 "Các chủ đề trong khoá, nên học theo thứ tự nào."),
            _doc("chu-de-1/tong-quan.md", "chu-de-1/tong-quan", "Chủ đề 1 — Tổng quan", "lesson", "Tổng quan chủ đề 1."),
            _doc("chu-de-2/tong-quan.md", "chu-de-2/tong-quan", "Chủ đề 2 — Tổng quan", "lesson", "Tổng quan chủ đề 2."),
            _doc("tong-ket/README.md", "tong-ket", "Tổng kết", "lesson", "Ôn lại và tự kiểm tra."),
        ]
        nav = [
            {"id": "khoa-hoc", "title": "Khoá học", "sub": "theo chủ đề", "icon": "layers", "groups": [
                {"title": "Bắt đầu", "short": "Bắt đầu", "items": ["gioi-thieu/README.md"]},
                {"title": "Chủ đề 1", "short": "CĐ 1", "items": ["chu-de-1/tong-quan.md"]},
                {"title": "Chủ đề 2", "short": "CĐ 2", "items": ["chu-de-2/tong-quan.md"]},
                {"title": "Tổng kết", "short": "Tổng kết", "items": ["tong-ket/README.md"]},
            ]},
        ]
        return nav, {d["id"]: d for d in docs}
    return [], {}
