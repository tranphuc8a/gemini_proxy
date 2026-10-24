# -*- coding: utf-8 -*-
"""Chạy HẸP phần trình duyệt của MỘT loại puzzle trên máy chủ TĨNH (http.server) — không FastAPI, không backend, không database (an toàn với DB thật), ~30–60 s thay vì ~15 phút.

    backend\fastapi\.venv\Scripts\python.exe tasks\2610\261023\cai-tien-webapp\nhap\puzzle-lo-coin\chay-rieng.py <id loại> [vong-doi] [ban] [hoc] [di-dong]
        (không đối số tầng = vong-doi + ban + hoc + di-dong)

    vong-doi  check.tuong_loai (vòng đời chung: seed, gợi ý 3 mức, hoàn tác, tạm dừng, tải lại, giải bằng gợi ý, replay, Reveal, bỏ ván)
    ban       check_board_<loại>.py: run(P, check, section, tid)
    hoc       check.hoc (trang Học, Constraint View, Show Solver)
    di-dong   check.di_dong trên Pixel 5

Không thay thế `check.py --chuc-nang --co-gian` (chạy ĐÚNG MỘT LẦN cuối đợt: service worker, WebKit iPhone 13, Firefox, tràn ngang nhiều bề rộng, dữ liệu xấu…). Đặt PYTHONUTF8=1."""
import functools, http.server, importlib.util, os, sys, threading, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *([".."] * 6)))
HERE = os.path.join(ROOT, "backend", "fastapi", "webapp", "tranphuc8a", "logic-puzzle-suite")
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location("chk", os.path.join(HERE, "check.py"))
chk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chk)


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    tid, only = sys.argv[1], set(sys.argv[2:]) or {"vong-doi", "ban", "hoc", "di-dong"}
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=HERE))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/index.html" % srv.server_address[1]
    from playwright.sync_api import sync_playwright
    t0 = time.time()
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        P = chk.Page(br, url, "chay-rieng", viewport={"width": 1366, "height": 860}, permissions=["clipboard-read", "clipboard-write"])
        if "vong-doi" in only:
            chk.tuong_loai(P, tid, "Chromium chạy riêng")
        f = os.path.join(HERE, "check_board_%s.py" % tid)
        if "ban" in only and os.path.exists(f):
            s2 = importlib.util.spec_from_file_location("cbb", f)
            mod = importlib.util.module_from_spec(s2)
            s2.loader.exec_module(mod)
            chk.section(" · bàn %s: tương tác riêng" % tid)
            mod.run(P, chk.check, chk.section, tid)
        if "hoc" in only:
            chk.hoc(P, tid)
        P.close()
        if "di-dong" in only:
            P = chk.Page(br, url, "pixel5", **pw.devices["Pixel 5"])
            chk.di_dong(P, [tid], "Pixel 5 chạy riêng")
            P.close()
        br.close()
    print("\n%d đạt, %d sai (%.0f s)" % (chk.OK, chk.FAIL, time.time() - t0))
    for e in chk.ERRORS[:10]:
        print("ERR", e)
    return 1 if chk.FAIL or chk.ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
