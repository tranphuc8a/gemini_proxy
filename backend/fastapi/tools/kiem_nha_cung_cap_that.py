#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thử THẬT các nhà cung cấp chạy mã của `POST /run` (Wandbox, Judge0, Piston) bằng chương trình "tổng hai số" nhỏ.

    cd backend/fastapi
    .venv/Scripts/python.exe tools/kiem_nha_cung_cap_that.py                       # wandbox (mặc định, không cần khoá)
    RUN_JUDGE0_URL=https://ce.judge0.com .venv/Scripts/python.exe tools/kiem_nha_cung_cap_that.py wandbox judge0
    RUN_PISTON_URL=http://localhost:2000/api/v2 .venv/Scripts/python.exe tools/kiem_nha_cung_cap_that.py piston

Khởi động uvicorn thật với cấu hình an toàn (DB SQLite tạm, MONGO_URI rỗng, API_PREFIX=/api/v1) rồi gọi `/run` như giao diện làm.
MÃ NGUỒN GỬI RA DỊCH VỤ BÊN NGOÀI (chỉ vài dòng vô hại ở đây) — đó là lý do công cụ này không nằm trong bộ test tự động.
Dùng sau khi đổi adapter hoặc khi nghi một nhà cung cấp đổi hành vi. Thoát 1 nếu có ca sai.
"""
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BE = os.path.dirname(HERE)
PY = os.path.join(BE, ".venv", "Scripts", "python.exe")
if not os.path.exists(PY):
    PY = sys.executable
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SUM = "40 2\n"
# (ngôn ngữ, tệp chính, [(tên, nội dung)], mong đợi trong stdout)
SINGLE = {
    "cpp": ("main.cpp", '#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout<<"tong="<<a+b<<std::endl; }\n', "tong=42"),
    "c": ("main.c", '#include <stdio.h>\nint main(void){ int a,b; scanf("%d %d",&a,&b); printf("tong=%d\\n",a+b); return 0; }\n', "tong=42"),
    "python": ("main.py", "a,b=map(int,input().split())\nprint('tong=%d'%(a+b))\n", "tong=42"),
    "java": ("Main.java", 'import java.util.*;\npublic class Main { public static void main(String[] x){ Scanner s=new Scanner(System.in); System.out.println("tong="+(s.nextInt()+s.nextInt())); } }\n', "tong=42"),
    "javascript": ("main.js", "const t=require('fs').readFileSync(0,'utf8').split(/\\s+/).map(Number); console.log('tong='+(t[0]+t[1]));\n", "tong=42"),
    "go": ("main.go", 'package main\nimport "fmt"\nfunc main(){ var a,b int; fmt.Scan(&a,&b); fmt.Println("tong=",a+b) }\n', "tong="),
    "rust": ("main.rs", 'use std::io::*;\nfn main(){ let mut s=String::new(); stdin().read_to_string(&mut s).unwrap(); let v:Vec<i32>=s.split_whitespace().map(|x|x.parse().unwrap()).collect(); println!("tong={}", v[0]+v[1]); }\n', "tong=42"),
}
MULTI = {
    "cpp 3 tệp (src+include)": ("cpp", "main.cpp", [
        ("main.cpp", '#include <iostream>\n#include "include/calc.h"\nint main(){ std::cout << "kq=" << cong(40, 2) << std::endl; }\n'),
        ("include/calc.h", "int cong(int a, int b);\n"),
        ("src/calc.cpp", '#include "../include/calc.h"\nint cong(int a, int b){ return a + b; }\n')], "kq=42"),
    "c 2 tệp": ("c", "main.c", [
        ("main.c", '#include <stdio.h>\n#include "util.h"\nint main(void){ printf("kq=%d\\n", cong(40, 2)); return 0; }\n'),
        ("util.h", "int cong(int a, int b);\n"), ("util.c", '#include "util.h"\nint cong(int a, int b){ return a + b; }\n')], "kq=42"),
    "python 2 mô-đun": ("python", "main.py", [
        ("main.py", "from utils import cong\nprint('kq=%d' % cong(40, 2))\n"), ("utils.py", "def cong(a, b):\n    return a + b\n")], "kq=42"),
    "java 2 lớp": ("java", "Main.java", [
        ("Main.java", 'public class Main { public static void main(String[] a){ System.out.println("kq=" + Util.cong(40, 2)); } }\n'),
        ("Util.java", "public class Util { static int cong(int a, int b){ return a + b; } }\n")], "kq=42"),
    "java có package": ("java", "src/app/Main.java", [
        ("src/app/Main.java", 'package app;\nimport app.util.Calc;\npublic class Main { public static void main(String[] a){ System.out.println("kq=" + Calc.cong(40, 2)); } }\n'),
        ("src/app/util/Calc.java", "package app.util;\npublic class Calc { public static int cong(int a, int b){ return a + b; } }\n")], "kq=42"),
    "javascript 2 tệp": ("javascript", "main.js", [
        ("main.js", "const { cong } = require('./util');\nconsole.log('kq=' + cong(40, 2));\n"), ("util.js", "exports.cong = (a, b) => a + b;\n")], "kq=42"),
}
# Ca mà nhà cung cấp KHÔNG hỗ trợ và backend phải từ chối rõ ràng (không tính là sai): (nhà, ca) → mã lỗi
EXPECT_REFUSED = {("wandbox", "java có package"): "run_multifile_unsupported", ("wandbox", "javascript 2 tệp"): "run_multifile_unsupported"}


def post(api, body):
    req = urllib.request.Request(api + "/run", data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"err": str(e)[:200]}


def main():
    nha = [a for a in sys.argv[1:] if not a.startswith("-")] or ["wandbox"]
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    tmp = tempfile.mkdtemp(prefix="run-that-")
    env = dict(os.environ, PYTHONUTF8="1", DB_URL="sqlite+aiosqlite:///" + tmp.replace("\\", "/") + "/dev.sqlite3", MONGO_URI="",
               API_PREFIX="/api/v1", AI_ENABLED="false", RUN_ENABLED="true", RUN_RATE_PER_MIN="600", COURSE_ADMIN_KEY=secrets.token_urlsafe(12))
    log = open(os.path.join(tmp, "uvicorn.log"), "w", encoding="utf-8")
    proc = subprocess.Popen([PY, "-m", "uvicorn", "src.main:app", "--port", str(port), "--log-level", "warning"], cwd=BE, env=env, stdout=log, stderr=subprocess.STDOUT)
    api = "http://127.0.0.1:%d/api/v1" % port
    sai = 0
    try:
        t0 = time.time()
        while True:
            try:
                provs = json.loads(urllib.request.urlopen(api + "/run/providers", timeout=3).read().decode("utf-8"))["providers"]
                break
            except Exception:
                if time.time() - t0 > 60 or proc.poll() is not None:
                    raise SystemExit("uvicorn không lên")
                time.sleep(0.4)
        info = {p["id"]: p for p in provs}
        for n in nha:
            print("\n=== %s ===" % n)
            p = info.get(n)
            if not p or not p["available"]:
                print("  [--] không dùng được: %s" % ((p or {}).get("reason") or "không có nhà cung cấp này"))
                sai += 1
                continue
            for lang, (main_file, code, want) in SINGLE.items():
                if lang not in p["languages"]:
                    continue
                st, j = post(api, {"provider": n, "language": lang, "files": [{"name": main_file, "content": code}], "mainFile": main_file, "stdin": SUM, "runTimeoutMs": 10000, "compileTimeoutMs": 25000})
                out = ((j.get("run") or {}).get("stdout") or "").strip()
                good = st == 200 and want in out
                sai += 0 if good else 1
                d = j.get("data") or {}
                print("  [%s] %-26s %s %s" % ("ok" if good else "SAI", lang, (j.get("version") or "") if st == 200 else "", "" if good else "→ %s %s %s" % (st, d.get("code"), (d.get("detail") or out or j.get("message") or "")[:100])))
            for ten, (lang, main_file, files, want) in MULTI.items():
                if lang not in p["multiFileLanguages"]:
                    continue
                st, j = post(api, {"provider": n, "language": lang, "files": [{"name": a, "content": b} for a, b in files], "mainFile": main_file, "runTimeoutMs": 10000, "compileTimeoutMs": 25000})
                out = ((j.get("run") or {}).get("stdout") or "").strip()
                d = j.get("data") or {}
                if (n, ten) in EXPECT_REFUSED:
                    good = st == 400 and d.get("code") == EXPECT_REFUSED[(n, ten)]
                    print("  [%s] %-26s (từ chối đúng: %s)" % ("ok" if good else "SAI", ten, EXPECT_REFUSED[(n, ten)]))
                else:
                    good = st == 200 and want in out
                    print("  [%s] %-26s %s" % ("ok" if good else "SAI", ten, "" if good else "→ %s %s %s" % (st, d.get("code"), (d.get("detail") or out or j.get("message") or "")[:100])))
                sai += 0 if good else 1
    finally:
        try:
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            proc.kill()
        log.close()
        shutil.rmtree(tmp, ignore_errors=True)
    print("\n%s" % ("ĐẠT" if not sai else "%d ca SAI" % sai))
    return 1 if sai else 0


if __name__ == "__main__":
    sys.exit(main())
