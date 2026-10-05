# -*- coding: utf-8 -*-
"""Tự kiểm tích hợp ứng dụng Quản lý chi tiêu — chạy server THẬT và trình duyệt THẬT.

    backend\\fastapi\\.venv\\Scripts\\python.exe quan-ly-chi-tieu\\selftest\\run.py            # tất cả
    ... run.py --only static|node|pytest|api|browser        # một tầng
    ... run.py --shots                                # lưu ảnh chụp vào selftest/out/

Năm tầng:
  0. static — tương phản AA, cú pháp, metadata, không mã ngoài
  1. node   — webapp/tranphuc8a/quan-ly-chi-tieu/kiem.js (logic thuần + động cơ đồng bộ)
  2. pytest — backend: usecase, 3 kho, controller của /spending
  3. api    — uvicorn thật + SQLite tạm: kịch bản HTTP cho kho json và mysql (chạy qua SQLite)
              (mongo chỉ chạy nếu bạn đặt SELFTEST_MONGO_URI; không thì ghi rõ "bỏ qua")
  4. browser— Edge/Chrome thật qua Playwright: 3 cỡ màn, nhập nhanh, XSS, sáng/tối, kết nối
              máy chủ, hai thiết bị cùng sửa (xung đột → gộp), offline → online

Mongo thật (tuỳ chọn, ghi vào database `qlct_selftest` rồi xoá): đặt SELFTEST_MONGO_URI=mongodb://… trước khi chạy.

AN TOÀN: server được khởi động với DB_URL trỏ SQLite trong thư mục tạm và MONGO_URI rỗng
(ghi đè .env), nên KHÔNG BAO GIỜ chạm vào MySQL/Mongo thật của bạn.
Trả exit code khác 0 nếu có phép kiểm sai. Tầng bị bỏ vì thiếu môi trường được báo "BỎ QUA", không tính là đạt.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
PRJ = os.path.dirname(HERE)
REPO = os.path.dirname(PRJ)
BE = os.path.join(REPO, "backend", "fastapi")
APP = os.path.join(BE, "webapp", "tranphuc8a", "quan-ly-chi-tieu")
APP_URL = "/webapp/tranphuc8a/quan-ly-chi-tieu/"
OUT = os.path.join(HERE, "out")
PY = os.path.join(BE, ".venv", "Scripts", "python.exe")
if not os.path.exists(PY):
    PY = sys.executable

G, R, Y, C, X = "\033[32m", "\033[31m", "\033[33m", "\033[36m", "\033[0m"
passed, failed, skipped = [], [], []


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"  {G}[ok]  {X}{name}" if ok else f"  {R}[SAI] {X}{name}   {detail}")
    (passed if ok else failed).append(name)
    return ok


def skip(name: str, why: str) -> None:
    print(f"  {Y}[BỎ QUA]{X} {name} — {why}")
    skipped.append(name)


def head(t: str) -> None:
    print(f"\n{C}{t}{X}\n" + "-" * 60)


# ---------------------------------------------------------------- tầng 1, 2
def step_node() -> None:
    head("TẦNG 1 — node kiem.js")
    node = shutil.which("node")
    if not node:
        return skip("node kiem.js", "không có node")
    r = subprocess.run([node, "kiem.js"], cwd=APP, capture_output=True, text=True, encoding="utf-8", errors="replace")
    tail = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    bad = [ln for ln in r.stdout.splitlines() if "[SAI]" in ln]
    check("kiem.js thoát 0 và không có [SAI]", r.returncode == 0 and not bad, "\n".join(bad[:5]) or r.stderr[-300:])
    print("      " + tail[0])


def step_pytest() -> None:
    head("TẦNG 2 — pytest backend (/spending)")
    files = ["tests/application/test_spending_usecase.py", "tests/adapter/output/spending/test_spending_repositories.py",
             "tests/adapter/input/controller/test_spending_controller.py"]
    r = subprocess.run([PY, "-m", "pytest", *files, "-q", "-p", "no:cacheprovider", "-W", "ignore"], cwd=BE, capture_output=True, text=True, encoding="utf-8", errors="replace")
    last = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    check("pytest /spending thoát 0", r.returncode == 0, r.stdout[-600:])
    print("      " + last[0])


# ----------------------------------------------------------------- server
def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Server:
    """uvicorn thật + SQLite tạm + thư mục dữ liệu tạm. Ghi đè .env để không chạm DB thật."""

    def __init__(self, mongo_uri: str = ""):
        self.tmp = tempfile.mkdtemp(prefix="qlct-selftest-")
        self.port = free_port()
        self.base = f"http://127.0.0.1:{self.port}"
        self.mongo_uri = mongo_uri
        self.proc = None

    def __enter__(self):
        env = dict(os.environ)
        env.update({
            "DB_URL": "sqlite+aiosqlite:///" + os.path.join(self.tmp, "dev.sqlite3").replace("\\", "/"),
            "DATA_DIR": self.tmp, "MONGO_URI": self.mongo_uri, "MONGO_DATABASE": "qlct_selftest", "API_PREFIX": "/api/v1", "PYTHONUTF8": "1",
            "SPENDING_STORAGE_BACKEND": "json", "SPENDING_JSON_FILE": "spending-selftest.json",
            "AI_ENABLED": "false", "PYTHONPATH": BE,
            # Dây an toàn thứ hai: nếu vì lý do gì DB_URL bị bỏ qua, các trường DB_* trỏ vào hư vô
            # thay vì MySQL thật trong .env.
            "DB_HOST": "127.0.0.1", "DB_PORT": "9", "DB_USERNAME": "selftest", "DB_PASSWORD": "selftest", "DB_DATABASE": "selftest",
        })
        self.log = open(os.path.join(self.tmp, "server.log"), "w", encoding="utf-8")
        self.proc = subprocess.Popen([PY, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(self.port), "--log-level", "warning"],
                                     cwd=BE, env=env, stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(120):
            try:
                urllib.request.urlopen(self.base + "/webapp/_api/list", timeout=1).read()
                return self
            except Exception:
                if self.proc.poll() is not None:
                    break
                time.sleep(0.5)
        self.__exit__(None, None, None)
        raise RuntimeError("Server không khởi động được:\n" + open(os.path.join(self.tmp, "server.log"), encoding="utf-8", errors="replace").read()[-1500:])

    def __exit__(self, *a):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=8)
            except Exception:
                self.proc.kill()
        try:
            self.log.close()
        except Exception:
            pass
        shutil.rmtree(self.tmp, ignore_errors=True)


# ------------------------------------------------------------------ tầng 3
def step_api(srv: Server) -> None:
    import httpx

    head("TẦNG 3 — API thật qua HTTP (uvicorn + SQLite tạm)")
    api = srv.base + "/api/v1/spending"
    with httpx.Client(timeout=20) as h:
        r = h.get(api + "/backends")
        check("GET /spending/backends trả danh sách kho", r.status_code == 200 and {b["id"] for b in r.json()["data"]["backends"]} == {"json", "mysql", "mongo"}, r.text[:200])
        bk = {b["id"]: b for b in r.json()["data"]["backends"]}
        with_mongo = bool(srv.mongo_uri)
        if with_mongo:
            check("json, mysql (SQLite tạm) và mongo (SELFTEST_MONGO_URI) đều dùng được", all(bk[k]["available"] for k in bk), json.dumps(bk, ensure_ascii=False)[:300])
        else:
            check("json và mysql (SQLite tạm) dùng được; mongo báo lý do vì không cấu hình", bk["json"]["available"] and bk["mysql"]["available"] and not bk["mongo"]["available"] and bk["mongo"]["reason"], json.dumps(bk, ensure_ascii=False)[:300])
            skip("kho mongo qua HTTP", "chưa đặt SELFTEST_MONGO_URI (mongo chỉ được kiểm bằng fake_mongo trong pytest)")

        def doc(n):
            return {"schema": 1, "transactions": [{"id": f"t{i}", "amount": 1000 * (i + 1), "note": "Cơm — Phở 🍜 ăn"} for i in range(n)]}

        for be in ("json", "mysql") + (("mongo",) if with_mongo else ()):
            print(f"  · kho {be}")
            q = {"backend": be}
            c = h.post(api + "/workspaces", params=q, json={"name": "Sổ thử", "data": doc(2)})
            ok = c.status_code == 201
            d = c.json().get("data", {}) if ok else {}
            check(f"{be}: tạo không gian, khoá chỉ hiện một lần", ok and d.get("revision") == 1 and d.get("access_key"), c.text[:200])
            if not ok:
                continue
            wid, key = d["id"], {"X-Workspace-Key": d["access_key"]}
            g = h.get(f"{api}/workspaces/{wid}", params=q, headers=key)
            check(f"{be}: đọc lại đúng dữ liệu, kể cả tiếng Việt và emoji", g.status_code == 200 and g.json()["data"]["data"]["transactions"][1]["note"] == "Cơm — Phở 🍜 ăn", g.text[:200])
            check(f"{be}: không khoá → 401, khoá sai → 401, id lạ → 404 (404 trước 401)",
                  h.get(f"{api}/workspaces/{wid}", params=q).status_code == 401 and h.get(f"{api}/workspaces/{wid}", params=q, headers={"X-Workspace-Key": "sai"}).status_code == 401
                  and h.get(f"{api}/workspaces/sp_khong_co", params=q, headers=key).status_code == 404)
            check(f"{be}: Bearer cũng được", h.get(f"{api}/workspaces/{wid}", params=q, headers={"Authorization": "Bearer " + d["access_key"]}).status_code == 200)
            p = h.put(f"{api}/workspaces/{wid}", params=q, headers=key, json={"revision": 1, "data": doc(3)})
            check(f"{be}: lưu đúng phiên bản → revision 2", p.status_code == 200 and p.json()["data"]["revision"] == 2, p.text[:200])
            st = h.put(f"{api}/workspaces/{wid}", params=q, headers=key, json={"revision": 1, "data": doc(9)})
            cur = st.json().get("data", {}).get("current", {}) if st.status_code == 409 else {}
            check(f"{be}: lưu phiên bản cũ → 409 kèm bản hiện tại", st.status_code == 409 and cur.get("revision") == 2 and len(cur["data"]["transactions"]) == 3, st.text[:200])
            u = h.get(f"{api}/workspaces/{wid}", params={**q, "since": 2}, headers=key).json()["data"]
            check(f"{be}: since=revision → unchanged, không gửi lại dữ liệu", u.get("unchanged") is True and u.get("data") is None, str(u)[:200])
            u2 = h.get(f"{api}/workspaces/{wid}", params={**q, "since": 1}, headers=key).json()["data"]
            check(f"{be}: since cũ → gửi đủ dữ liệu", not u2.get("unchanged") and len(u2["data"]["transactions"]) == 3)
            big = {"schema": 1, "x": "a" * 4_100_000}
            check(f"{be}: tài liệu > 4 MB → 400", h.put(f"{api}/workspaces/{wid}", params=q, headers=key, json={"revision": 2, "data": big}).status_code == 400)
            check(f"{be}: data không phải object → 4xx", 400 <= h.put(f"{api}/workspaces/{wid}", params=q, headers=key, json={"revision": 2, "data": [1]}).status_code < 500)
            odd = {"schema": 1, "$where": "1", "a.b": {"$gt": 1}}
            p2 = h.put(f"{api}/workspaces/{wid}", params=q, headers=key, json={"revision": 2, "data": odd})
            g2 = h.get(f"{api}/workspaces/{wid}", params=q, headers=key).json()["data"]["data"]
            check(f"{be}: khoá lạ ($where, a.b) lưu và đọc lại nguyên vẹn", p2.status_code == 200 and g2 == odd, str(g2)[:120])
            dl = h.delete(f"{api}/workspaces/{wid}", params=q, headers=key)
            check(f"{be}: xoá rồi đọc → 404", dl.status_code == 200 and h.get(f"{api}/workspaces/{wid}", params=q, headers=key).status_code == 404)

        # Cùng id ở hai kho là hai kho độc lập.
        a = h.post(api + "/workspaces", params={"backend": "json"}, json={"name": "A"}).json()["data"]
        check("kho độc lập: id của json không tồn tại ở mysql", h.get(f"{api}/workspaces/{a['id']}", params={"backend": "mysql"}, headers={"X-Workspace-Key": a["access_key"]}).status_code == 404)
        lst = h.get(srv.base + "/webapp/_api/list").json()
        apps = [a for a in lst["apps"] + [x for c in lst["collections"] for x in c["apps"]] if a["name"] == "quan-ly-chi-tieu"]
        check("portal (/webapp/_api/list) liệt kê app với tiêu đề và biểu tượng", len(apps) == 1 and apps[0]["title"] == "Quản lý chi tiêu" and apps[0]["icon"] and apps[0]["collection"] == "tranphuc8a", str(apps)[:200])
        cfg = h.get(srv.base + APP_URL).text
        check("server chèn window.__WEBAPP_CONFIG__ (apiBase) vào trang trước mọi script", cfg.find("__WEBAPP_CONFIG__") != -1 and cfg.find("__WEBAPP_CONFIG__") < cfg.find("assets/text.js") and '"apiBase":"/api/v1"' in cfg.replace(" ", ""))
        check("kho lạ → 400", h.get(f"{api}/workspaces/x", params={"backend": "oracle"}).status_code == 400)
        if not with_mongo:
            check("mongo chưa cấu hình → 503", h.post(api + "/workspaces", params={"backend": "mongo"}, json={"name": "m"}).status_code == 503)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["static", "node", "pytest", "api", "browser"])
    ap.add_argument("--shots", action="store_true")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    if args.only in (None, "static"):
        import static_checks
        static_checks.run(APP, check, head)
    if args.only in (None, "node"):
        step_node()
    if args.only in (None, "pytest"):
        step_pytest()
    if args.only in (None, "api", "browser"):
        try:
            with Server(os.environ.get("SELFTEST_MONGO_URI", "")) as srv:
                if args.only in (None, "api"):
                    step_api(srv)
                if args.only in (None, "browser"):
                    import browser_checks
                    browser_checks.run(srv, check, skip, head, shots=args.shots, out=OUT, app_url=APP_URL, file_url=__import__("pathlib").Path(APP, "index.html").as_uri())
        except RuntimeError as e:
            check("khởi động server thật", False, str(e))

    print("\n" + "=" * 60)
    print(f"Đạt {len(passed)} · SAI {len(failed)} · BỎ QUA {len(skipped)}")
    if failed:
        print(R + "Phép kiểm sai:" + X)
        for n in failed:
            print("  - " + n)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    sys.exit(main())
