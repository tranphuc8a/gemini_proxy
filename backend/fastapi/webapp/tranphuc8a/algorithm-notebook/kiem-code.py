#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Biên dịch và chạy thử MẪU CODE C++ của từng mục thư viện bằng g++ (có sẵn trên máy: C:/devtools/mingw).

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\algorithm-notebook\\kiem-code.py            # mọi mục có code
    ... kiem-code.py dijkstra dsu               # chỉ vài mục
    ... kiem-code.py --lo tệp.js                # chỉ các mục trong lib-*.js đó (dùng khi đang soạn)

Mỗi mục có `code` PHẢI có kiem-code/<id>.test.cpp. Tệp thử chứa một dòng đúng nguyên văn `// @TEMPLATE` — script thay dòng đó bằng mẫu code
(mẫu tự có #include <bits/stdc++.h>), rồi biên dịch `g++ -std=c++17 -O2 -Wall`, chạy (≤ 30 s) và yêu cầu in dòng `OK`. Tệp thử phải thật sự thử:
dữ liệu ngẫu nhiên có hạt giống cố định so với cách làm vét cạn / công thức, gồm cả ca biên (rỗng, một phần tử, không có đường đi…).
Cảnh báo của trình biên dịch (-Wall) được in ra nhưng không làm sai; lỗi biên dịch, chạy sai, quá giờ, thiếu tệp thử thì sai (exit 1)."""
import io
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TESTS = os.path.join(HERE, "kiem-code")
GPP = os.environ.get("GPP") or "g++"


def node(*args):
    return subprocess.run(["node", os.path.join(HERE, "kiem-lib.js")] + list(args), capture_output=True, text=True, encoding="utf-8")


def entries_with_code(only_files=None):
    """→ [(id, tệp nguồn)] cho mọi mục có code C++ (đọc thẳng từ assets/data bằng regex trên id + trường code, không cần chạy trình duyệt)."""
    r = node("--ids")
    if r.returncode:
        raise SystemExit(r.stderr or r.stdout)
    return [i for i in r.stdout.split() if i]


def main():
    args = [a for a in sys.argv[1:]]
    ids = None
    if "--lo" in args:
        i = args.index("--lo")
        files = [args[i + 1]]
        del args[i:i + 2]
        r = subprocess.run(["node", "-e", """
            const path=require('path');const H=process.argv[1];require(path.join(H,'assets/js/core/text.js'));const lib=require(path.join(H,'assets/js/core/lib.js'));
            process.argv.slice(2).forEach(f=>require(path.isAbsolute(f)?f:path.join(H,'assets','data',f)));
            console.log(lib.all().filter(e=>e.code).map(e=>e.id).join('\\n'));""", HERE] + files, capture_output=True, text=True, encoding="utf-8")
        if r.returncode:
            raise SystemExit(r.stderr)
        ids = [x for x in r.stdout.split() if x]
    elif args:
        ids = args
    else:
        ids = entries_with_code()
    # lọc bỏ mục không có code (nocode)
    todo = []
    for i in ids:
        out = tempfile.mktemp(suffix=".cpp")
        r = node("--dump", i, out)
        if r.returncode == 0:
            todo.append((i, out))
        elif r.returncode != 2:
            raise SystemExit(r.stderr)
    ok = bad = 0
    tmp = tempfile.mkdtemp(prefix="algo-code-")
    for i, tpl in todo:
        test = os.path.join(TESTS, i + ".test.cpp")
        if not os.path.exists(test):
            print("  ✗ %-28s thiếu kiem-code/%s.test.cpp" % (i, i))
            bad += 1
            continue
        body = io.open(test, encoding="utf-8").read()
        if "// @TEMPLATE" not in body:
            print("  ✗ %-28s tệp thử không có dòng `// @TEMPLATE`" % i)
            bad += 1
            continue
        src = body.replace("// @TEMPLATE", io.open(tpl, encoding="utf-8").read(), 1)
        cpp = os.path.join(tmp, i + ".cpp")
        exe = os.path.join(tmp, i + ".exe")
        io.open(cpp, "w", encoding="utf-8", newline="\n").write(src)
        c = subprocess.run([GPP, "-std=c++17", "-O2", "-Wall", "-o", exe, cpp], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if c.returncode:
            print("  ✗ %-28s KHÔNG BIÊN DỊCH ĐƯỢC\n%s" % (i, "\n".join(c.stderr.splitlines()[:12])))
            bad += 1
            continue
        warn = [l for l in c.stderr.splitlines() if "warning" in l]
        try:
            r = subprocess.run([exe], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
        except subprocess.TimeoutExpired:
            print("  ✗ %-28s QUÁ GIỜ (> 30 s)" % i)
            bad += 1
            continue
        if r.returncode != 0 or r.stdout.strip().splitlines()[-1:] != ["OK"]:
            print("  ✗ %-28s CHẠY SAI (exit %d): %s" % (i, r.returncode, (r.stdout + r.stderr).strip()[-300:]))
            bad += 1
            continue
        ok += 1
        print("  ✓ %-28s%s" % (i, ("  (%d cảnh báo -Wall)" % len(warn)) if warn else ""))
    print("\n%d mẫu code đạt, %d sai" % (ok, bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
