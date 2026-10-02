#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Quản lý nội dung khoá học trong database — không qua HTTP.

Đây là đường chính để nạp những khoá lớn: một bundle 8 MB vượt giới hạn thân
request 4,5 MB của Vercel, nên `POST /courses/import` không dùng được cho nó trên
production, còn lệnh này ghi thẳng vào database.

    python tools/manage_courses.py info                    # đang trỏ vào DB nào, có bảng chưa
    python tools/manage_courses.py init-db                 # tạo bảng (SQLite dev; MySQL dùng alembic)
    python tools/manage_courses.py list [--all]
    python tools/manage_courses.py import FILE.json [--slug S] [--title T] [--yes]
    python tools/manage_courses.py import-all [THU_MUC] [--yes]     # mặc định ../course-content/*.json
    python tools/manage_courses.py export SLUG [-o FILE] [--js]     # --js: content.js chạy offline
    python tools/manage_courses.py search SLUG "từ khoá"
    python tools/manage_courses.py publish SLUG on|off [--yes]
    python tools/manage_courses.py delete SLUG --yes

Database đích: biến môi trường `DB_URL` (hoặc `--db URL`) nếu có, không thì các
trường DB_* trong `.env` — tức là MySQL production. Lệnh in ra đích trước khi làm
gì, và mọi lệnh GHI vào một database không phải SQLite đều đòi `--yes`.

    DB_URL=sqlite+aiosqlite:///data/dev.sqlite3 python tools/manage_courses.py import-all
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

FASTAPI_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONTENT = FASTAPI_ROOT.parent / "course-content"
CALLER_CWD = Path.cwd()


def _arg_path(value: str) -> Path:
    """Paths on the command line are relative to where the user ran the command."""
    p = Path(value).expanduser()
    return p if p.is_absolute() else (CALLER_CWD / p).resolve()


def _bootstrap(db_url: str | None) -> None:
    if db_url:
        os.environ["DB_URL"] = db_url
    # settings read `.env` from the working directory, and `src` must be importable.
    os.chdir(FASTAPI_ROOT)
    sys.path.insert(0, str(FASTAPI_ROOT))


def _target():
    from src.adapter.output.mysql.db.base import get_async_engine

    url = get_async_engine().url
    return url, url.get_backend_name() == "sqlite"


def _describe(url) -> str:
    if url.get_backend_name() == "sqlite":
        return f"SQLite  {url.database}"
    return f"{url.get_backend_name()}  {url.username}@{url.host}:{url.port}/{url.database}"


def _require_yes(args, action: str) -> None:
    url, is_sqlite = _target()
    if not is_sqlite and not args.yes:
        sys.exit(f"Từ chối {action} trên database thật ({_describe(url)}). Thêm --yes nếu đúng là ý bạn.")


async def _with_uc(work):
    from src.adapter.output.mysql.db.base import get_async_session
    from src.adapter.output.mysql.repositories.course_repository import CourseRepository
    from src.application.usecases.course_usecase import CourseUseCase

    session = get_async_session()
    try:
        return await work(CourseUseCase(CourseRepository(session)))
    finally:
        await session.close()


def _load_bundle(path: Path):
    from src.domain.models.course_domain import CourseBundle

    raw = json.loads(path.read_text(encoding="utf-8"))
    return CourseBundle.model_validate(raw)


# ------------------------------------------------------------------ commands

async def cmd_info(args) -> int:
    from sqlalchemy import inspect

    from src.adapter.output.mysql.db.base import get_async_engine

    url, _ = _target()
    print("Database:", _describe(url))
    async with get_async_engine().connect() as conn:
        tables = await conn.run_sync(lambda c: inspect(c).get_table_names())
    wanted = ["courses", "course_sections", "course_groups", "course_docs"]
    missing = [t for t in wanted if t not in tables]
    print("Bảng khoá học:", "đủ" if not missing else "THIẾU " + ", ".join(missing))
    if missing:
        print("  → SQLite: chạy `init-db`.  MySQL: chạy `alembic upgrade head` (hoặc khởi động app một lần).")
        return 1
    courses = await _with_uc(lambda uc: uc.list_courses(include_unpublished=True))
    print(f"Khoá học: {len(courses)}")
    for c in courses:
        print(f"  {c.slug:18s} v{c.version:<4d} {c.doc_count:4d} bài  {'' if c.published else '[nháp] '}{c.title}")
    return 0


async def cmd_init_db(args) -> int:
    from src.adapter.output.mysql.db.base import Base, get_async_engine
    # `Base.metadata` only knows the tables whose entity modules were imported;
    # without this line create_all succeeds and creates nothing.
    import src.adapter.output.mysql.entities  # noqa: F401

    _require_yes(args, "tạo bảng")
    url, _ = _target()
    async with get_async_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        tables = await conn.run_sync(lambda c: __import__("sqlalchemy").inspect(c).get_table_names())
    print("Đã tạo các bảng còn thiếu trên", _describe(url))
    print("  bảng hiện có:", ", ".join(sorted(tables)))
    return 0


async def cmd_list(args) -> int:
    courses = await _with_uc(lambda uc: uc.list_courses(include_unpublished=args.all))
    if not courses:
        print("(chưa có khoá học nào)")
    for c in courses:
        s = c.stats or {}
        print(f"{c.slug:18s} v{c.version:<4d} {c.doc_count:4d} bài  {s.get('words', 0):>8,d} từ  "
              f"{'' if c.published else '[nháp] '}{c.title}")
    return 0


async def _import_one(path: Path, slug: str | None, title: str | None):
    bundle = _load_bundle(path)
    fields = {"title": title} if title else None
    return await _with_uc(lambda uc: uc.import_bundle(bundle, slug=slug, course_fields=fields))


async def cmd_import(args) -> int:
    _require_yes(args, "nạp (ghi đè) khoá học")
    path = _arg_path(args.file)
    course = await _import_one(path, args.slug, args.title)
    print(f"Đã nạp {course.slug}: {course.doc_count} bài, phiên bản {course.version}")
    return 0


async def cmd_import_all(args) -> int:
    _require_yes(args, "nạp (ghi đè) mọi khoá học")
    folder = _arg_path(args.dir) if args.dir else DEFAULT_CONTENT
    files = sorted(p for p in folder.glob("*.json"))
    if not files:
        print("Không có tệp .json nào trong", folder)
        return 1
    failed = 0
    for path in files:
        try:
            course = await _import_one(path, None, None)
            print(f"  [ok]   {path.name:22s} → {course.slug}: {course.doc_count} bài, v{course.version}")
        except Exception as cause:  # noqa: BLE001 — report and carry on with the rest
            failed += 1
            print(f"  [LỖI]  {path.name}: {getattr(cause, 'message', None) or cause}")
    return 1 if failed else 0


async def cmd_export(args) -> int:
    # Same as GET /courses/{slug}/export: uploaded files ride along (base64) so `import`
    # restores them. The --js offline format has no way to serve files, so it drops them.
    data = await _with_uc(lambda uc: uc.export_json(args.slug))
    if args.js:
        data.pop("assets", None)
    text = json.dumps(data, ensure_ascii=False, indent=None if args.js else 1)
    if args.js:
        # The old offline format: the course engine uses window.COURSE when present.
        text = "/* Xuat tu database boi manage_courses.py export --js — dung sua tay. */\nwindow.COURSE = " + \
               text.replace("</", "<\\/") + ";\n"
    if args.out:
        out = _arg_path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + ("" if args.js else "\n"), encoding="utf-8", newline="\n")
        tep = f", {len(data['assets'])} tệp" if data.get("assets") else ""
        print(f"Đã ghi {out} ({out.stat().st_size / 1048576:.2f} MB, {len(data['docs'])} bài{tep})")
    else:
        sys.stdout.write(text + "\n")
    return 0


async def cmd_search(args) -> int:
    hits = await _with_uc(lambda uc: uc.search(args.slug, args.query, limit=args.limit, include_unpublished=True))
    for h in hits:
        print(f"{h.score:7.1f}  {h.id}\n         {h.title}\n         {h.snippet[:140]}")
    if not hits:
        print("(không có kết quả)")
    return 0


async def cmd_publish(args) -> int:
    _require_yes(args, "đổi trạng thái xuất bản")
    course = await _with_uc(lambda uc: uc.update_course(args.slug, {"published": args.state == "on"}))
    print(f"{course.slug}: {'đã xuất bản' if course.published else 'nháp (ẩn khỏi trang công khai)'}")
    return 0


async def cmd_delete(args) -> int:
    if not args.yes:
        sys.exit("Xoá khoá học không hoàn tác được — thêm --yes.")
    await _with_uc(lambda uc: uc.delete_course(args.slug))
    print("Đã xoá", args.slug)
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Quản lý nội dung khoá học trong database.")
    parser.add_argument("--db", help="SQLAlchemy async URL, ghi đè DB_URL / .env")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("info", help="database đích, bảng, các khoá học")
    p = sub.add_parser("init-db", help="tạo bảng còn thiếu")
    p.add_argument("--yes", action="store_true")
    p = sub.add_parser("list", help="liệt kê khoá học")
    p.add_argument("--all", action="store_true", help="kể cả bản nháp")
    p = sub.add_parser("import", help="nạp một bundle (ghi đè khoá cùng slug)")
    p.add_argument("file")
    p.add_argument("--slug")
    p.add_argument("--title")
    p.add_argument("--yes", action="store_true")
    p = sub.add_parser("import-all", help="nạp mọi bundle trong một thư mục")
    p.add_argument("dir", nargs="?")
    p.add_argument("--yes", action="store_true")
    p = sub.add_parser("export", help="xuất một khoá thành bundle")
    p.add_argument("slug")
    p.add_argument("-o", "--out")
    p.add_argument("--js", action="store_true", help="dạng window.COURSE = … (content.js offline)")
    p = sub.add_parser("search", help="thử tìm kiếm phía server")
    p.add_argument("slug")
    p.add_argument("query")
    p.add_argument("--limit", type=int, default=10)
    p = sub.add_parser("publish", help="xuất bản / ẩn một khoá")
    p.add_argument("slug")
    p.add_argument("state", choices=["on", "off"])
    p.add_argument("--yes", action="store_true")
    p = sub.add_parser("delete", help="xoá một khoá")
    p.add_argument("slug")
    p.add_argument("--yes", action="store_true")

    args = parser.parse_args(argv)
    _bootstrap(args.db)
    handler = {
        "info": cmd_info, "init-db": cmd_init_db, "list": cmd_list, "import": cmd_import,
        "import-all": cmd_import_all, "export": cmd_export, "search": cmd_search,
        "publish": cmd_publish, "delete": cmd_delete,
    }[args.cmd]
    async def run():
        from src.adapter.output.mysql.db.base import get_async_engine

        try:
            return await handler(args)
        finally:
            # Close pooled connections while the loop still runs; otherwise aiomysql
            # closes them from __del__ after asyncio.run() and prints
            # "RuntimeError: Event loop is closed" under a successful command.
            await get_async_engine().dispose()

    try:
        return asyncio.run(run())
    except Exception as cause:  # noqa: BLE001 — a CLI should end in a sentence, not a traceback
        message = getattr(cause, "message", None) or str(cause)
        print(f"Lỗi: {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
