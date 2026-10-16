#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm BỘ ĐẾM TỐC ĐỘ BỀN (`RateLimiterPort`) trên MySQL/MariaDB và/hoặc MongoDB THẬT (máy chủ tạm, KHÔNG phải CSDL của dự án).

Không chạy thẳng: do `tools/kiem_mysql_that.py` và `tools/kiem_mongo_that.py` gọi sau khi dựng CSDL tạm, truyền địa chỉ qua biến môi trường:

    RL_DB_URL    = mysql+aiomysql://root@127.0.0.1:<cổng>/cs_test      (chạy phần SQL)
    RL_MONGO_URI = mongodb://127.0.0.1:<cổng>/                          (chạy phần MongoDB)

Từ chối mọi địa chỉ không phải 127.0.0.1/localhost (không bao giờ chạm database thật; `.env` của dự án bị biến môi trường đè).

Mỗi phần kiểm: (1) hai đối tượng bộ đếm cùng tên + một TIẾN TRÌNH CON thứ hai cùng đếm một khoá đồng thời (nhiều kết nối) và tổng
phải đúng từng đơn vị (đếm nguyên tử: SQL `ON DUPLICATE KEY UPDATE`, Mongo `$inc` + upsert); (2) đủ hạn mức thì `retry_after` trả số giây,
chờ đúng số giây đó (đồng hồ thật, cửa sổ 6 giây) thì hết bị chặn; (3) khoá được lưu dạng băm, không lộ địa chỉ; (4) dọn hàng hết hạn (SQL) /
chỉ mục TTL (Mongo); (5) CSDL không tới được thì `FailOpenRateLimiter` không ném lỗi mà đếm trong bộ nhớ.
Thoát 1 nếu có phép kiểm sai, 2 nếu thiếu môi trường.
"""
import asyncio
import os
import subprocess
import sys
import time
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
BE = os.path.dirname(HERE)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DB_URL = os.environ.get("RL_DB_URL", "").strip()
MONGO_URI = os.environ.get("RL_MONGO_URI", "").strip()
LOCAL = ("127.0.0.1", "localhost")


def local_only(address):
    host = (urlparse(address.replace("mysql+aiomysql://", "http://", 1)).hostname or "").lower()
    return host in LOCAL


if DB_URL and not local_only(DB_URL) or MONGO_URI and not local_only(MONGO_URI):
    print("Từ chối: chỉ chạy trên CSDL ở 127.0.0.1/localhost.")
    sys.exit(2)
# Đặt TRƯỚC khi nạp mã dự án: `Settings` đọc môi trường, môi trường thắng tệp .env.
if DB_URL:
    os.environ["DB_URL"] = DB_URL
if MONGO_URI:
    os.environ["MONGO_URI"] = MONGO_URI
sys.path.insert(0, BE)

tong = sai = 0


def kiem(ten, ok, chi_tiet=None):
    global tong, sai
    tong += 1
    if ok:
        print("  [ok]  " + ten)
    else:
        sai += 1
        print("  [SAI] " + ten + ("   → %s" % (chi_tiet,) if chi_tiet is not None else ""))


def nhom(ten):
    print("\n== " + ten)


def subprocess_env(**extra):
    return dict(os.environ, PYTHONUTF8="1", PYTHONDONTWRITEBYTECODE="1", **extra)


# ---------------------------------------------------------------------------------------------------- tiến trình con
async def child(kind, name, count):
    """Tiến trình con: đếm `count` lần cho khoá 'dung-chung' qua kết nối của riêng nó."""
    limiter = make(kind, name, 10_000, 600)
    await asyncio.gather(*[limiter.add("dung-chung") for _ in range(count)])
    await dong_ket_noi()


async def dong_ket_noi():
    """Đóng hồ chứa kết nối của engine SQL / client Mongo trước khi vòng lặp sự kiện đóng (không thì driver in lỗi 'Event loop is closed')."""
    if DB_URL:
        from src.adapter.output.mysql.db.base import get_async_engine
        await get_async_engine().dispose()
    if MONGO_URI:
        from src.adapter.output.mongostore import client as mongo_store
        await mongo_store.shutdown()


def make(kind, name, max_events, window, clock=time.time):
    if kind == "database":
        from src.adapter.output.ratelimit.database_rate_limiter import DatabaseRateLimiter
        return DatabaseRateLimiter(name, max_events, window, clock=clock)
    from src.adapter.output.ratelimit.mongo_rate_limiter import MongoRateLimiter
    return MongoRateLimiter(name, max_events, window, clock=clock)


# ---------------------------------------------------------------------------------------------------- SQL
async def tong_hits(name):
    from sqlalchemy import text
    from src.adapter.output.mysql.db.base import get_async_session

    session = get_async_session()
    try:
        row = (await session.execute(text("SELECT COALESCE(SUM(hits), 0), COUNT(*) FROM rate_limit_hits WHERE limiter = :n"), {"n": name})).fetchone()
        return int(row[0]), int(row[1])
    finally:
        await session.close()


async def phan_sql():
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.adapter.output.mysql.db.base import get_async_engine, get_async_session
    from src.adapter.output.ratelimit.database_rate_limiter import DatabaseRateLimiter
    from src.adapter.factory import rate_limit_factory
    from src.application.utils.rate_limiter import FailOpenRateLimiter, MemoryRateLimiter, subject_digest

    nhom("SQL thật · bộ đếm bền (DatabaseRateLimiter)")
    session = get_async_session()
    try:
        phien_ban = (await session.execute(text("SELECT VERSION()"))).scalar()
        dialect = session.get_bind().dialect.name
    finally:
        await session.close()
    kiem("kết nối MySQL/MariaDB thật qua engine của ứng dụng (dialect '%s', %s)" % (dialect, phien_ban), dialect == "mysql" and get_async_engine().url.get_backend_name() == "mysql")
    kiem("RATE_LIMIT_BACKEND=auto chọn 'database' với DB_URL là MySQL (ngoài pytest)", rate_limit_factory.resolve_backend("auto", under_test=False) == "database")

    name = "that_sql_%d" % os.getpid()
    # 1) nhiều kết nối, nhiều tiến trình: tổng phải chính xác
    a, b = make("database", name, 1000, 600), make("database", name, 1000, 600)
    proc = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--child", "database", name, "40"], env=subprocess_env())
    await asyncio.gather(*[(a if i % 2 else b).add("dung-chung") for i in range(60)])
    proc.wait(timeout=120)
    hits, rows = await tong_hits(name)
    kiem("60 lượt đếm đồng thời qua 2 đối tượng + 40 lượt từ TIẾN TRÌNH CON thứ hai → tổng đúng 100, không mất lượt nào", proc.returncode == 0 and hits == 100, "hits=%s rows=%s child=%s" % (hits, rows, proc.returncode))
    kiem("hai đối tượng bộ đếm thấy chung một số liệu: đủ 100 thì chặn, hạn mức 101 thì chưa", await make("database", name, 100, 600).retry_after("dung-chung") is not None and await make("database", name, 101, 600).retry_after("dung-chung") is None)

    # 2) địa chỉ không lưu thô
    session = get_async_session()
    try:
        subjects = [r[0] for r in (await session.execute(text("SELECT subject FROM rate_limit_hits WHERE limiter = :n"), {"n": name})).fetchall()]
    finally:
        await session.close()
    kiem("bảng chỉ giữ SHA-256 của khoá (64 ký tự hex), không giữ khoá thô", subjects == [subject_digest("dung-chung")] * len(subjects) and all(len(s) == 64 for s in subjects), subjects[:2])

    # 3) hạn mức + chờ đúng số giây (đồng hồ thật, cửa sổ 6 s => xô 1 s)
    limiter = make("database", name + "_t", 3, 6)
    truoc = []
    for _ in range(3):
        truoc.append(await limiter.retry_after("a"))
        await limiter.add("a")
    cho = await limiter.retry_after("a")
    kiem("3/6 giây: 3 lượt đầu được, lượt thứ 4 bị chặn kèm số giây chờ (1 ≤ chờ ≤ 7); địa chỉ khác không bị ảnh hưởng", truoc == [None] * 3 and cho is not None and 1 <= cho <= 7 and await limiter.retry_after("b") is None, (truoc, cho))
    t0 = time.time()
    await asyncio.sleep(max(0, (cho or 1) - 1))
    con_chan = await limiter.retry_after("a")
    await asyncio.sleep(1.2)
    het = await limiter.retry_after("a")
    kiem("chờ đúng %ss (đồng hồ thật) thì hết bị chặn (sớm 1 giây vẫn còn chặn: %s)" % (cho, "có" if con_chan is not None else "không"), het is None, (con_chan, het, round(time.time() - t0, 1)))

    # 4) dọn hàng hết hạn: lượt đếm kế tiếp (sau khi cửa sổ qua) xoá các xô chết
    ten_don = name + "_p"
    don = DatabaseRateLimiter(ten_don, 3, 2, purge_every_s=0)
    await don.add("x")
    await don.add("y")
    truoc_don = (await tong_hits(ten_don))[1]
    await asyncio.sleep(2 + 2 + 1)                     # cửa sổ 2 s + một xô (1 s) + dư
    await don.add("z")
    sau_don = (await tong_hits(ten_don))[1]
    kiem("hàng hết hạn bị xoá khi đếm tiếp (2 hàng → còn 1 hàng của lượt mới)", truoc_don == 2 and sau_don == 1, (truoc_don, sau_don))

    # 5) reset
    await make("database", name + "_t", 3, 6).reset("a")
    kiem("reset(khoá) xoá đếm của khoá đó", await make("database", name + "_t", 3, 6).retry_after("a") is None)

    # 6) DB không tới được => không ném lỗi, đếm trong bộ nhớ
    cong_chet = create_async_engine("mysql+aiomysql://root@127.0.0.1:1/khong_co")
    ra_phien = async_sessionmaker(cong_chet, expire_on_commit=False)
    gioi_han = FailOpenRateLimiter(DatabaseRateLimiter(name + "_f", 2, 60, session_factory=ra_phien), MemoryRateLimiter(2, 60),
                                   name=name + "_f", timeout_s=5, cooldown_s=30)
    try:
        await gioi_han.add("k")
        await gioi_han.add("k")
        chan = await gioi_han.retry_after("k")
        loi = None
    except Exception as e:  # noqa: BLE001
        chan, loi = None, e
    finally:
        await cong_chet.dispose()
    kiem("CSDL không tới được (cổng 1) → không ném lỗi, báo degraded, bộ nhớ vẫn chặn đúng hạn mức", loi is None and gioi_han.degraded and chan is not None, (loi, chan))


# ---------------------------------------------------------------------------------------------------- Mongo
async def phan_mongo():
    from src.adapter.output.mongostore import client as mongo_store
    from src.adapter.output.ratelimit.mongo_rate_limiter import COLLECTION, MongoRateLimiter
    from src.application.utils.rate_limiter import FailOpenRateLimiter, MemoryRateLimiter, subject_digest
    from src.adapter.factory import rate_limit_factory

    nhom("MongoDB thật · bộ đếm bền (MongoRateLimiter)")
    thong_tin = await mongo_store.ping()
    kiem("kết nối mongod thật qua client của ứng dụng (v%s)" % thong_tin.get("server_version"), thong_tin["ok"] is True)
    kiem("RATE_LIMIT_BACKEND=auto KHÔNG tự chọn mongo dù MONGO_URI đã đặt", rate_limit_factory.resolve_backend("auto", under_test=False) != "mongo")

    name = "that_mongo_%d" % os.getpid()
    collection = mongo_store.get_collection(COLLECTION)

    async def tong(n):
        hits = rows = 0
        async for doc in collection.find({"limiter": n}):
            hits += int(doc["hits"])
            rows += 1
        return hits, rows

    a, b = make("mongo", name, 1000, 600), make("mongo", name, 1000, 600)
    proc = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--child", "mongo", name, "40"], env=subprocess_env())
    await asyncio.gather(*[(a if i % 2 else b).add("dung-chung") for i in range(60)])
    proc.wait(timeout=120)
    hits, rows = await tong(name)
    kiem("60 lượt đếm đồng thời + 40 lượt từ TIẾN TRÌNH CON thứ hai → tổng đúng 100 ($inc + upsert nguyên tử, không mất lượt)", proc.returncode == 0 and hits == 100, "hits=%s rows=%s child=%s" % (hits, rows, proc.returncode))
    kiem("hai đối tượng thấy chung số liệu: đủ 100 thì chặn, hạn mức 101 thì chưa", await make("mongo", name, 100, 600).retry_after("dung-chung") is not None and await make("mongo", name, 101, 600).retry_after("dung-chung") is None)

    doc = await collection.find_one({"limiter": name})
    kiem("tài liệu giữ SHA-256 của khoá, có expire_at (ngày giờ) cho TTL; _id = <bộ đếm>:<băm>:<xô>", doc["subject"] == subject_digest("dung-chung") and hasattr(doc["expire_at"], "year") and doc["_id"].startswith(name + ":" + doc["subject"] + ":"), {k: doc[k] for k in ("_id", "bucket")})
    chi_muc = [(i["name"], i.get("expireAfterSeconds")) async for i in await collection.list_indexes()]
    kiem("có chỉ mục TTL trên expire_at (expireAfterSeconds=0) ở server thật", ("expire_at_1", 0) in chi_muc, chi_muc)

    limiter = make("mongo", name + "_t", 3, 6)
    truoc = []
    for _ in range(3):
        truoc.append(await limiter.retry_after("a"))
        await limiter.add("a")
    cho = await limiter.retry_after("a")
    kiem("3/6 giây: lượt thứ 4 bị chặn kèm số giây chờ (1 ≤ chờ ≤ 7); địa chỉ khác không ảnh hưởng", truoc == [None] * 3 and cho is not None and 1 <= cho <= 7 and await limiter.retry_after("b") is None, (truoc, cho))
    await asyncio.sleep(max(0, (cho or 1) - 1))
    con_chan = await limiter.retry_after("a")
    await asyncio.sleep(1.2)
    kiem("chờ đúng %ss (đồng hồ thật) thì hết bị chặn" % cho, await limiter.retry_after("a") is None, con_chan)
    await make("mongo", name + "_t", 3, 6).reset()
    kiem("reset() xoá cả bộ đếm", (await tong(name + "_t"))[1] == 0)

    from pymongo import AsyncMongoClient
    chet = AsyncMongoClient("mongodb://127.0.0.1:1/", serverSelectionTimeoutMS=300)
    that = mongo_store._clients.get(mongo_store._loop_key())
    mongo_store._clients[mongo_store._loop_key()] = chet           # từ giờ "kết nối Mongo" trỏ vào cổng chết
    try:
        gioi_han = FailOpenRateLimiter(MongoRateLimiter(name + "_f", 2, 60), MemoryRateLimiter(2, 60), name=name + "_f", timeout_s=5, cooldown_s=30)
        try:
            await gioi_han.add("k")
            await gioi_han.add("k")
            chan, loi = await gioi_han.retry_after("k"), None
        except Exception as e:  # noqa: BLE001
            chan, loi = None, e
    finally:
        await chet.close()
        mongo_store._clients[mongo_store._loop_key()] = that       # trả lại client thật để đóng gọn ở cuối
    kiem("Mongo không tới được → không ném lỗi, degraded, bộ nhớ vẫn chặn đúng hạn mức", loi is None and gioi_han.degraded and chan is not None, (loi, chan))


async def main():
    try:
        if DB_URL:
            await phan_sql()
        if MONGO_URI:
            await phan_mongo()
    finally:
        await dong_ket_noi()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--child":
        asyncio.run(child(sys.argv[2], sys.argv[3], int(sys.argv[4])))
        sys.exit(0)
    if not (DB_URL or MONGO_URI):
        print("Đặt RL_DB_URL và/hoặc RL_MONGO_URI (xem docstring). Bỏ qua.")
        sys.exit(2)
    asyncio.run(main())
    print("\n" + "=" * 58)
    if sai:
        print("SAI %d/%d phép kiểm bộ đếm." % (sai, tong))
        sys.exit(1)
    print("Đạt — %d phép kiểm bộ đếm bền trên CSDL thật." % tong)
