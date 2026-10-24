# -*- coding: utf-8 -*-
"""Phần dùng chung cho các phép kiểm trình duyệt của Markdown Editor Pro (ke-hoach §1.1, đợt cải tiến 23/10/2026).

Dùng bởi `kiem-hieu-nang.py` (và các script kiem-* sau này: kiem-hien-thi, kiem-chia-se, kiem-dong-bo):

- `MayChuTinh(thu_muc)`  — phục vụ một thư mục tĩnh (bản build) ở cổng trống, tiến trình riêng, kiểu MIME tường minh
  (Windows có máy đọc `.js` là `text/plain` từ registry ⇒ ES module không chạy).
- `MayChuThat()`         — uvicorn THẬT của backend/fastapi với SQLite tạm, `MONGO_URI=""`, `RATE_LIMIT_BACKEND=memory`, mọi kho json tạm, khoá quản trị giả, cổng trống;
  dừng/chạy lại trên CÙNG cổng (cùng origin) được. Không bao giờ chạm database thật: `DB_URL` trỏ SQLite tạm và các
  trường `DB_*` trỏ vào cổng 9 để nếu `DB_URL` bị bỏ qua thì cũng không nối được MySQL trong `.env`.
- `mo_trinh_duyet(pw)`   — Edge thật (`channel="msedge"`), dự phòng Chrome/Chromium khi được phép.
- `SoKiem`               — ghi phép kiểm đạt/sai, in gọn, trả exit code.
- `build_cu_hon_nguon()` — `dist/` có cũ hơn mã nguồn không (để script đo đúng bản vừa sửa).

Không gọi Gemini (`AI_ENABLED=false`), không cần mạng ngoài.
"""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ME = os.path.dirname(HERE)                      # markdown-editor/
REPO = os.path.dirname(ME)
BE = os.path.join(REPO, "backend", "fastapi")
DIST = os.path.join(ME, "dist")
APP_PATH = "/webapp/tranphuc8a/markdown-editor-pro/"
BAN_XUAT = os.path.join(BE, "webapp", "tranphuc8a", "markdown-editor-pro")
PY = os.path.join(BE, ".venv", "Scripts", "python.exe")
if not os.path.exists(PY):
    PY = sys.executable

KHOA_GIA = "kiem-chung-khoa-gia"

MIME = {
    ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8",
    ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
    ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".wasm": "application/wasm",
    ".map": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
}


def utf8_console() -> None:
    """In tiếng Việt an toàn trên console Windows (cp1252)."""
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def cong_trong() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _cho_cong(port: int, proc: subprocess.Popen | None = None, giay: float = 15.0) -> bool:
    han = time.time() + giay
    while time.time() < han:
        if proc is not None and proc.poll() is not None:
            return False
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.3).close()
            return True
        except OSError:
            time.sleep(0.1)
    return False


def _dung(proc: subprocess.Popen | None) -> None:
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except Exception:
            proc.kill()


class MayChuTinh:
    """Phục vụ `thu_muc` qua HTTP ở 127.0.0.1:<cổng trống>, trong một tiến trình con. Dùng với `with`."""

    def __init__(self, thu_muc: str):
        if not os.path.isfile(os.path.join(thu_muc, "index.html")):
            raise FileNotFoundError(f"Không có {os.path.join(thu_muc, 'index.html')} — chưa build?")
        self.thu_muc = thu_muc
        self.port = cong_trong()
        self.base = f"http://127.0.0.1:{self.port}/"
        self.proc: subprocess.Popen | None = None

    def __enter__(self) -> "MayChuTinh":
        self.proc = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--phuc-vu", self.thu_muc, str(self.port)],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not _cho_cong(self.port, self.proc):
            _dung(self.proc)
            raise RuntimeError(f"Máy chủ tĩnh không mở được cổng {self.port}")
        return self

    def __exit__(self, *exc) -> None:
        _dung(self.proc)
        self.proc = None


def _phuc_vu(thu_muc: str, port: int) -> None:
    from functools import partial
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **MIME}

        def log_message(self, *args) -> None:  # im lặng: phép đo không cần nhật ký truy cập
            pass

    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=thu_muc)).serve_forever()


class MayChuThat:
    """uvicorn thật + SQLite tạm; `start(khoa)` / `stop()` trên cùng cổng; `cleanup()` xoá thư mục tạm. Dùng với `with`."""

    def __init__(self, khoa_quan_tri: str = KHOA_GIA, api_prefix: str = "/api/v1", env_them: dict | None = None):
        self.tmp = tempfile.mkdtemp(prefix="mdpro-kiem-")
        self.port = cong_trong()
        self.base = f"http://127.0.0.1:{self.port}"
        self.api = self.base + api_prefix
        self.app_url = self.base + APP_PATH
        self.khoa = khoa_quan_tri
        self.api_prefix = api_prefix
        self.env_them = dict(env_them or {})
        self.proc: subprocess.Popen | None = None
        self._log = None

    def env(self, khoa: str) -> dict:
        env = dict(os.environ)
        env.update({
            "DB_URL": "sqlite+aiosqlite:///" + os.path.join(self.tmp, "dev.sqlite3").replace("\\", "/"),
            "DATA_DIR": self.tmp, "MONGO_URI": "", "API_PREFIX": self.api_prefix, "PYTHONUTF8": "1", "AI_ENABLED": "false",
            "MARKDOWN_ADMIN_KEY": khoa, "PYTHONPATH": BE,
            # .env của backend trỏ tới MySQL/Mongo THẬT và mã backend tự nạp nó: mọi kho phải bị ép về tệp tạm, bộ giới hạn tốc độ
            # về bộ nhớ (build_rate_limiter chế độ auto từng thử nối Aiven), kho markdown/wiki/... về json trong DATA_DIR.
            "RATE_LIMIT_BACKEND": "memory", "MARKDOWN_STORAGE_BACKEND": "json", "WIKI_STORAGE_BACKEND": "json",
            "CODESTORE_STORAGE_BACKEND": "json", "GRAPHUC_STORAGE_BACKEND": "json", "POSTMAN_STORAGE_BACKEND": "json",
            "SPENDING_STORAGE_BACKEND": "json",
            # dây an toàn thứ hai: nếu DB_URL bị bỏ qua, các trường DB_* trỏ vào hư vô thay vì MySQL thật trong .env
            "DB_HOST": "127.0.0.1", "DB_PORT": "9", "DB_USERNAME": "kiem", "DB_PASSWORD": "kiem", "DB_DATABASE": "kiem",
        })
        env.update(self.env_them)
        return env

    def start(self, khoa: str | None = None) -> "MayChuThat":
        if khoa is not None:
            self.khoa = khoa
        self._log = open(os.path.join(self.tmp, "server.log"), "a", encoding="utf-8")
        self.proc = subprocess.Popen([PY, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(self.port), "--log-level", "warning"],
                                     cwd=BE, env=self.env(self.khoa), stdout=self._log, stderr=subprocess.STDOUT)
        for _ in range(120):
            try:
                urllib.request.urlopen(self.base + "/webapp/_api/list", timeout=1).read()
                return self
            except Exception:
                if self.proc.poll() is not None:
                    break
                time.sleep(0.5)
        nhat_ky = self.nhat_ky()
        self.stop()
        raise RuntimeError("Máy chủ không khởi động được:\n" + nhat_ky[-1500:])

    def nhat_ky(self) -> str:
        try:
            with open(os.path.join(self.tmp, "server.log"), encoding="utf-8", errors="replace") as f:
                return f.read()
        except OSError:
            return ""

    def phien_quan_tri(self) -> str:
        """Đổi khoá giả lấy token phiên quản trị (`POST /markdown/admin/verify`), như người dùng bấm Unlock."""
        import json
        req = urllib.request.Request(self.api + "/markdown/admin/verify", method="POST", headers={"X-Admin-Key": self.khoa}, data=b"")
        with urllib.request.urlopen(req, timeout=10) as r:
            body = json.loads(r.read().decode("utf-8"))
        token = body.get("session") if isinstance(body, dict) else None
        if not isinstance(token, str) or not token:
            raise RuntimeError(f"/markdown/admin/verify không trả token: {str(body)[:200]}")
        return token

    def stop(self) -> None:
        _dung(self.proc)
        self.proc = None
        if self._log:
            self._log.close()
            self._log = None

    def cleanup(self) -> None:
        self.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def __enter__(self) -> "MayChuThat":
        return self.start()

    def __exit__(self, *exc) -> None:
        self.cleanup()


def mo_trinh_duyet(pw, *, headless: bool = True, args: list[str] | None = None, cho_thay_the: bool = True):
    """Trả (browser, tên kênh). Ưu tiên Edge thật; `cho_thay_the=False` thì chỉ Edge (số đo hiệu năng so được với mốc)."""
    kenh = ({"channel": "msedge"}, {"channel": "chrome"}, {}) if cho_thay_the else ({"channel": "msedge"},)
    for kw in kenh:
        try:
            return pw.chromium.launch(headless=headless, args=list(args or []), **kw), kw.get("channel", "chromium")
        except Exception:
            continue
    return None, None


class SoKiem:
    """Sổ phép kiểm: `kiem(tên, đúng?, chi tiết)`; `tong_ket()` in tổng và trả exit code (0 = mọi phép đạt)."""

    XANH, DO, HET = "\033[32m", "\033[31m", "\033[0m"

    def __init__(self, im_khi_dat: bool = False):
        self.dat: list[str] = []
        self.sai: list[str] = []
        self.im_khi_dat = im_khi_dat

    def kiem(self, ten: str, dung: bool, chi_tiet: str = "") -> bool:
        (self.dat if dung else self.sai).append(ten if dung or not chi_tiet else f"{ten} — {chi_tiet}")
        if not (dung and self.im_khi_dat):
            nhan = self.XANH + "[ok]" + self.HET if dung else self.DO + "[SAI]" + self.HET
            print(f"  {nhan}  {ten}" + (f"  — {chi_tiet}" if chi_tiet and not dung else ""))
        return dung

    def tong_ket(self, tieu_de: str = "") -> int:
        print(f"{tieu_de}Đạt {len(self.dat)} · SAI {len(self.sai)}")
        for s in self.sai:
            print(f"  - {s}")
        return 1 if self.sai else 0


# Những gì quyết định nội dung bản build — tệp nào mới hơn dist/index.html thì dist đã cũ.
_NGUON_BUILD = ("src", "public", "pwa", "index.html", "vite.config.ts", "package.json", "package-lock.json", "tsconfig.json", os.path.join("scripts", "make-sw.mjs"))


def build_cu_hon_nguon(dist: str = DIST) -> list[str]:
    """Danh sách tệp nguồn mới hơn `dist/index.html` (rỗng = dist khớp nguồn). Không có dist ⇒ ['<chưa build>']."""
    moc_path = os.path.join(dist, "index.html")
    if not os.path.isfile(moc_path):
        return ["<chưa build>"]
    moc = os.path.getmtime(moc_path)
    moi: list[str] = []
    for ten in _NGUON_BUILD:
        p = os.path.join(ME, ten)
        if os.path.isfile(p):
            if os.path.getmtime(p) > moc:
                moi.append(os.path.relpath(p, ME))
            continue
        for goc, _dirs, files in os.walk(p):
            for f in files:
                fp = os.path.join(goc, f)
                if os.path.getmtime(fp) > moc:
                    moi.append(os.path.relpath(fp, ME))
    return moi


def build(npm_script: str = "build") -> None:
    """`npm run build` trong markdown-editor/ (tsc -b + vite build + make-sw) — chỉ ghi vào dist/ (đã gitignore)."""
    npm = "npm.cmd" if os.name == "nt" else "npm"
    print(f"  · npm run {npm_script} (markdown-editor) …", flush=True)
    t = time.time()
    r = subprocess.run([npm, "run", npm_script], cwd=ME, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"npm run {npm_script} hỏng (exit {r.returncode}):\n{(r.stdout + r.stderr)[-2000:]}")
    print(f"  · build xong sau {time.time() - t:.0f} s", flush=True)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--phuc-vu":
        _phuc_vu(sys.argv[2], int(sys.argv[3]))
    else:
        print(__doc__)
