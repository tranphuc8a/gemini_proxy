#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm kho MongoDB của `/codestore` trên một `mongod` THẬT (tiến trình tạm trong WSL Ubuntu, không phải MongoDB của dự án).

    cd backend/fastapi
    .venv/Scripts/python.exe tools/kiem_mongo_that.py

Làm gì: lần đầu tải bản `mongod` cho Linux (~100 MB, lấy từ fastdl.mongodb.org) vào ~/.cache/cs-mongo trong WSL (các lần sau dùng lại), chạy nó với
thư mục dữ liệu tạm, chỉ nghe 127.0.0.1 ở một cổng trống, đặt `CS_MONGO_URI=mongodb://127.0.0.1:<cổng>/` rồi chạy
`webapp/tranphuc8a/code-studio/kiem-tich-hop.js` (backend thật + hai thiết bị đồng bộ, kho json, mysql VÀ mongo), cuối cùng tắt mongod và xoá dữ liệu tạm.
In bộ đếm lệnh của chính mongod (serverStatus.opcounters) làm bằng chứng dữ liệu đã đi qua nó.
Máy chủ thật chạy với `RATE_LIMIT_BACKEND=mongo`: các bộ đếm tốc độ (khoá sai, token sai) nằm trong collection `rate_limits` của mongod; công cụ in số đếm đó rồi chạy
thêm `tools/kiem_bo_dem_that.py` (nhiều kết nối + một tiến trình con cùng đếm, hết hạn, chỉ mục TTL, mongod chết thì fail-open). Cần WSL có distro tên "Ubuntu" (đổi bằng WSL_DISTRO).
Thoát 1 nếu có phép kiểm sai, 2 nếu thiếu môi trường.
"""
import os
import shutil
import socket
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
BE = os.path.dirname(HERE)
SCRIPT = os.path.join(BE, "webapp", "tranphuc8a", "code-studio", "kiem-tich-hop.js")
DISTRO = os.environ.get("WSL_DISTRO", "Ubuntu")
URL = "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2404-8.0.4.tgz"
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def wsl(cmd, **kw):
    return subprocess.run(["wsl", "-d", DISTRO, "-e", "bash", "-c", cmd], capture_output=True, **kw)


def clean(b):
    return b.decode("utf-8", "replace").replace("\x00", "")


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    node = shutil.which("node")
    if not node or not shutil.which("wsl"):
        print("Cần node và WSL (distro %s). Bỏ qua." % DISTRO)
        return 2
    r = wsl("echo ok")
    if b"ok" not in r.stdout:
        print("WSL distro %s không chạy được: %s" % (DISTRO, clean(r.stderr)[:200]))
        return 2
    print("Chuẩn bị mongod trong WSL (lần đầu tải ~100 MB)…")
    r = wsl('set -e; D=$HOME/.cache/cs-mongo; mkdir -p $D; [ -x $D/mongod ] || { curl -fsSL -m 600 "%s" | tar -xz --strip-components=2 -C $D --wildcards "*/bin/mongod"; }; $D/mongod --version | head -1' % URL)
    out = clean(r.stdout).strip()
    if r.returncode or "db version" not in out:
        print("Không chuẩn bị được mongod:", out[-300:], clean(r.stderr)[-300:])
        return 2
    print(out)
    port = free_port()
    # tiến trình WSL giữ nguyên suốt lúc chạy; thư mục dữ liệu nằm trong /tmp của WSL, xoá khi tắt
    proc = subprocess.Popen(["wsl", "-d", DISTRO, "-e", "bash", "-c",
                             'D=$(mktemp -d /tmp/cs-mongo-XXXXXX); trap "rm -rf $D" EXIT; exec $HOME/.cache/cs-mongo/mongod --dbpath $D --port %d --bind_ip 127.0.0.1 --nounixsocket --quiet --logpath $D/log' % port],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    code = 1
    try:
        import pymongo
        uri = "mongodb://127.0.0.1:%d/" % port
        t0 = time.time()
        client = None
        while True:
            try:
                client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=1500)
                client.admin.command("ping")
                break
            except Exception as e:
                if proc.poll() is not None or time.time() - t0 > 90:
                    print("mongod không nhận kết nối từ Windows:", str(e)[:200]); return 1
                time.sleep(0.7)
        ver = client.server_info()["version"]
        print("mongod %s thật ở cổng %d" % (ver, port))
        env = dict(os.environ, CS_MONGO_URI=uri, PYTHONUTF8="1", RATE_LIMIT_BACKEND="mongo")
        code = subprocess.run([node, SCRIPT], env=env).returncode
        ops = client.admin.command("serverStatus")["opcounters"]
        cols = sorted(c for db in client.list_database_names() if db not in ("admin", "local", "config") for c in client[db].list_collection_names())
        print("\nTrong mongod sau kịch bản: collection %s; opcounters insert=%s update=%s query=%s delete=%s" % (cols, ops["insert"], ops["update"], ops["query"], ops["delete"]))
        if ops["insert"] + ops["update"] < 20:
            print("SAI: không thấy bằng chứng dữ liệu đã ghi vào mongod")
            code = 1
        # Bộ đếm tốc độ bền: máy chủ thật (RATE_LIMIT_BACKEND=mongo) vừa đếm khoá sai / token sai vào collection rate_limits của mongod.
        counted = {}
        for db in client.list_database_names():
            if db in ("admin", "local", "config"):
                continue
            for doc in client[db]["rate_limits"].find():
                counted[doc["limiter"]] = counted.get(doc["limiter"], 0) + int(doc["hits"])
        print("Bộ đếm tốc độ trong mongod (collection rate_limits: bộ đếm → tổng lượt): %s" % dict(sorted(counted.items())))
        if counted.get("codestore_failures", 0) < 20 or counted.get("codestore_share_failures", 0) < 20:
            print("SAI: máy chủ thật không đếm khoá sai / token sai vào mongod (RATE_LIMIT_BACKEND=mongo)")
            code = 1
        if subprocess.run([sys.executable, os.path.join(HERE, "kiem_bo_dem_that.py")], env=dict(env, RL_MONGO_URI=uri)).returncode:
            code = 1
        client.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except Exception:
            proc.kill()
        wsl("pkill -x mongod; sleep 1; rm -rf /tmp/cs-mongo-*")
        print("(đã tắt mongod tạm và xoá dữ liệu)")
    return code


if __name__ == "__main__":
    sys.exit(main())
