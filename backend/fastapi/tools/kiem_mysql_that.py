#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm kho MySQL của `/codestore` trên một MySQL/MariaDB THẬT (máy chủ CSDL tạm, không phải database của dự án).

    cd backend/fastapi
    .venv/Scripts/python.exe tools/kiem_mysql_that.py [đường-dẫn-tới-thư-mục-MariaDB]

Làm gì: dựng một MariaDB mới ở thư mục tạm (cổng trống, chỉ nghe 127.0.0.1, thư mục dữ liệu riêng — KHÔNG đụng dữ liệu đang có của bạn),
tạo database `cs_test`, đặt `CS_DB_URL=mysql+aiomysql://root@127.0.0.1:<cổng>/cs_test` rồi chạy
`webapp/tranphuc8a/code-studio/kiem-tich-hop.js` (backend thật + hai thiết bị đồng bộ, kho json VÀ mysql), cuối cùng tắt máy chủ và xoá hết.
Sau đó in các bảng `codestore_*` thật sự có trong MariaDB để chắc dữ liệu nằm ở đó chứ không phải SQLite.
Tìm MariaDB: tham số dòng lệnh → biến MARIADB_HOME → C:\\devtools\\mariadb\\mariadb-*\\mariadb-*\\ (bản portable) → `mariadbd` trong PATH.
Thoát 1 nếu có phép kiểm sai.
"""
import glob
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
BE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(BE))
SCRIPT = os.path.join(BE, "webapp", "tranphuc8a", "code-studio", "kiem-tich-hop.js")
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def find_home():
    cands = [a for a in sys.argv[1:] if not a.startswith("-")] + [os.environ.get("MARIADB_HOME", "")]
    cands += glob.glob(r"C:\devtools\mariadb\mariadb-*\mariadb-*") + glob.glob(r"C:\devtools\mariadb\mariadb-*")
    for c in cands:
        if c and os.path.exists(os.path.join(c, "bin", "mariadbd.exe")):
            return c
    return None


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    home = find_home()
    if not home:
        print("Không thấy MariaDB (đặt MARIADB_HOME hoặc truyền đường dẫn). Bỏ qua.")
        return 2
    node = shutil.which("node")
    if not node:
        print("Không thấy node."); return 2
    tmp = tempfile.mkdtemp(prefix="cs-maria-")
    data = os.path.join(tmp, "data")
    port = free_port()
    proc = None
    log = None
    code = 1
    try:
        r = subprocess.run([os.path.join(home, "bin", "mariadb-install-db.exe"), "--datadir=" + data, "--silent"], capture_output=True, text=True)
        if r.returncode:
            print("mariadb-install-db lỗi:", (r.stdout + r.stderr)[-400:]); return 1
        log = open(os.path.join(tmp, "mariadbd.log"), "w", encoding="utf-8")
        proc = subprocess.Popen([os.path.join(home, "bin", "mariadbd.exe"), "--no-defaults", "--datadir=" + data, "--basedir=" + home, "--port=%d" % port,
                                 "--bind-address=127.0.0.1", "--console", "--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci",
                                 "--innodb-buffer-pool-size=64M", "--max-connections=60"], stdout=log, stderr=subprocess.STDOUT)
        cli = [os.path.join(home, "bin", "mariadb.exe"), "--no-defaults", "-uroot", "-h127.0.0.1", "-P%d" % port, "--protocol=tcp"]
        t0 = time.time()
        while True:
            r = subprocess.run(cli + ["-e", "SELECT VERSION()"], capture_output=True, text=True)
            if r.returncode == 0:
                break
            if proc.poll() is not None or time.time() - t0 > 60:
                print("MariaDB không lên:", open(os.path.join(tmp, "mariadbd.log"), encoding="utf-8", errors="replace").read()[-600:]); return 1
            time.sleep(0.5)
        ver = r.stdout.strip().splitlines()[-1]
        subprocess.run(cli + ["-e", "CREATE DATABASE cs_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"], check=True)
        print("MariaDB tạm %s ở cổng %d (dữ liệu: %s)" % (ver, port, data))
        env = dict(os.environ, CS_DB_URL="mysql+aiomysql://root@127.0.0.1:%d/cs_test" % port, PYTHONUTF8="1")
        code = subprocess.run([node, SCRIPT], env=env).returncode
        # Bằng chứng dữ liệu đi qua MariaDB (kịch bản tự xoá không gian ở cuối nên bảng có thể trống): bảng đã được tạo + bộ đếm lệnh của chính máy chủ.
        r = subprocess.run(cli + ["-N", "-e", "SHOW TABLES FROM cs_test; SHOW GLOBAL STATUS WHERE Variable_name IN ('Com_insert','Com_update','Com_delete')"], capture_output=True, text=True)
        print("\nTrong MariaDB sau kịch bản (bảng + số lệnh INSERT/UPDATE/DELETE máy chủ đã chạy):\n" + (r.stdout.strip() or r.stderr.strip()))
        counts = {l.split()[0]: int(l.split()[1]) for l in r.stdout.splitlines() if l.startswith("Com_")}
        if "codestore_items" not in r.stdout or counts.get("Com_insert", 0) < 20:
            print("SAI: không thấy bằng chứng dữ liệu đã ghi vào MariaDB")
            code = 1
    finally:
        if proc and proc.poll() is None:
            try:
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
            except Exception:
                proc.kill()
            proc.wait(timeout=20)
        if log:
            log.close()                                   # còn giữ tệp log mở thì Windows không cho xoá thư mục
        for _ in range(10):
            shutil.rmtree(tmp, ignore_errors=True)
            if not os.path.exists(tmp):
                break
            time.sleep(0.5)
        print("(đã tắt MariaDB tạm và xoá %s: %s)" % (tmp, "OK" if not os.path.exists(tmp) else "KHÔNG xoá được"))
    return code


if __name__ == "__main__":
    sys.exit(main())
