# -*- coding: utf-8 -*-
"""Chạy RIÊNG check_board_lightsoutx.py (không chạy cả check.py). MayChuThu = FastAPI thật trên SQLite tạm (không chạm DB thật).
   MONGO_URI="" PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe lox-run.py"""
import importlib.util, os, sys
HERE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../../backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite"))
sys.path.insert(0, HERE)
import check as C  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

may = C.K.MayChuThu([]).__enter__()
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        P = C.Page(br, may.goc + C.PATH, "desk", viewport={"width": 1366, "height": 860}, permissions=["clipboard-read", "clipboard-write"])
        spec = importlib.util.spec_from_file_location("check_board_lightsoutx", os.path.join(HERE, "check_board_lightsoutx.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        C.section(" · bàn lightsoutx")
        mod.run(P, C.check, C.section, "lightsoutx")
        if len(sys.argv) > 1 and sys.argv[1] == "--vong-doi":
            C.tuong_loai(P, "lightsoutx", "Chromium máy tính")
        P.close()
        br.close()
finally:
    may.__exit__(None, None, None)
if C.ERRORS:
    print("Lỗi console/pageerror:", C.ERRORS[:8])
print("\n%d đạt, %d sai" % (C.OK, C.FAIL))
sys.exit(1 if C.FAIL else 0)
