#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra mot trang doc bai giang (*-course) sau khi noi dung chuyen vao database.

Moi trang co mot check.py mong goi vao day:

    import kiem_khoa_hoc
    sys.exit(kiem_khoa_hoc.chay(HERE))

    python check.py --tinh     # TANG 1: tinh — khong can backend, khong can trinh duyet
    python check.py            # + TANG 2: FastAPI that, SQLite tam, Chromium
    python check.py --anh      # + chup anh vao _shots/

TANG 1 — tinh
   - index.html nap dung assets/cau-hinh.js -> assets/app.js, KHONG con content.js
   - assets/content.js / content.json KHONG ton tai (noi dung nang da ra khoi trang)
   - ban sao engine (app.js, app.css, mo-offline.js, pwa.js, sw.js o goc…) khop nguon
     courses/engine/ (engine/sync.py); manifest.webmanifest + bieu tuong (engine/tao_pwa.py)
   - cau-hinh.js khai bao khoaHoc, va backend/course-content/<khoaHoc>.json ton tai,
     doc duoc, cay muc luc chi tro toi bai co that
   - cu phap JS (node --check) neu co Node

TANG 2 — trinh duyet that, KHONG mock
   Dung uvicorn voi DB_URL tro vao mot SQLite tam, nap bundle bang
   tools/manage_courses.py, roi mo trang qua chinh route /webapp/… cua FastAPI —
   nen window.__WEBAPP_CONFIG__.apiBase duoc chen dung nhu khi deploy (API_PREFIX
   dat la /api/v1 de thu ca truong hop co tien to). Kiem: trang chu, muc luc,
   mo bai, bai tiep, tim kiem, tai lai (ETag -> 304), va KHONG co loi console.
   Doc offline (context moi): worker dieu khien trang, tat mang tai lai van mo; bam
   "Luu ca khoa", tat mang, mo mot bai CHUA mo lan nao — log may chu chung minh luc
   offline khong yeu cau nao toi duoc may chu.
   Tro giang AI (Gemini GIA): khach khong thay khi AI chi danh cho quan tri vien;
   quan tri vien tom tat, lam cau hoi on tap, hoi dap co nguon — bai gui toi model.
   On tap: the AI soan vao bo the, trang #/~on-tap lat the + cham (SM-2) hen ngay sau.
   Ma chay duoc trong bai (```js-chay, ```js-bai-tap): chay, nop sai / dung, ma sua duoc
   giu qua tai lai, vong lap vo han bi dung sau 5 giay. (Python can mang de tai Pyodide —
   khong kiem tu dong.)
   Cong cu hoc: muc "Cong cu hoc" trong muc luc; to sang -> so tay -> tai lai van to;
   ban do kien thuc (/graph) + duong ngan nhat; che do doc (co chu); thanh tich + huy hieu.
   Roi cac ca bien: ?api= tro ra may chu la bi bo qua; tieu de / meta mang the
   HTML (sua qua API) hien thanh chu, khong chay; nhom rong va muc luc rong
   khong lam trang chu ket o "Dang tai muc luc".
   Can: playwright trong python dang chay check.py, va venv backend/fastapi/.venv.

Tra exit code khac 0 khi co loi.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))           # courses/engine
COURSES = os.path.dirname(HERE)                               # webapp/courses
FASTAPI = os.path.dirname(os.path.dirname(COURSES))           # backend/fastapi
CONTENT = os.path.join(os.path.dirname(FASTAPI), "course-content")

DO, XANH, VANG, MO, HET = "\033[31m", "\033[32m", "\033[33m", "\033[90m", "\033[0m"
if os.name == "nt" and not os.environ.get("WT_SESSION"):
    try:
        import ctypes
        ctypes.windll.kernel32.SetConsoleMode(ctypes.windll.kernel32.GetStdHandle(-11), 7)
    except Exception:
        DO = XANH = VANG = MO = HET = ""


class BaoCao:
    def __init__(self):
        self.loi, self.nhac_nho = [], []

    def ok(self, msg):
        print("  " + XANH + "[ok]" + HET + "   " + msg)

    def sai(self, msg):
        print("  " + DO + "[SAI]" + HET + "  " + msg)
        self.loi.append(msg)

    def nhac(self, msg):
        print("  " + VANG + "[nhac]" + HET + " " + msg)
        self.nhac_nho.append(msg)

    def bo_qua(self, msg):
        print("  " + MO + "[bo qua] " + msg + HET)


# ------------------------------------------------------------ may chu thu

def python_backend():
    """Trinh thong dich co du thu vien backend (venv), hoac None."""
    ung_vien = [
        os.path.join(FASTAPI, ".venv", "Scripts", "python.exe"),
        os.path.join(FASTAPI, ".venv", "bin", "python"),
        sys.executable,
    ]
    for py in ung_vien:
        if not os.path.exists(py):
            continue
        r = subprocess.run([py, "-c", "import fastapi, uvicorn, aiosqlite, sqlalchemy"], capture_output=True)
        if r.returncode == 0:
            return py
    return None


def _cong_trong():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    cong = s.getsockname()[1]
    s.close()
    return cong


def _mau_theo_schema(s):
    """Mot gia tri hop le theo responseSchema (kieu OpenAPI cua Gemini)."""
    s = s or {}
    kieu = str(s.get("type", "STRING")).upper()
    if s.get("enum"):
        return s["enum"][0]
    if kieu == "OBJECT":
        return {k: _mau_theo_schema(v) for k, v in (s.get("properties") or {}).items()}
    if kieu == "ARRAY":
        return [_mau_theo_schema(s.get("items")) for _ in range(max(2, int(s.get("minItems") or 0)))]
    if kieu == "INTEGER":
        return max(1, int(s.get("minimum") or 0))
    if kieu == "NUMBER":
        return float(s.get("minimum") or 1)
    if kieu == "BOOLEAN":
        return True
    return "mẫu"


class GeminiGia:
    """Thay Google generateContent khi kiem thu: KHONG phep thu nao goi Gemini that
    (ton quota cua nguoi dung) — `.env` cua backend co the chua khoa that.

    Tra loi theo responseSchema neu co (JSON hop le), khong thi mot cau van ban
    nhac lai cau hoi. `goi` ghi moi request; `tra_loi = fn(body) -> str` de tu tra loi.
    """

    def __init__(self):
        self.goi = []
        self.tra_loi = None
        self._khoa = threading.Lock()
        gia = self

        class _Xu(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                try:
                    body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
                except ValueError:
                    body = {}
                with gia._khoa:
                    gia.goi.append({"path": self.path, "body": body})
                text = gia._van_ban(body)
                out = json.dumps({
                    "candidates": [{"content": {"role": "model", "parts": [{"text": text}]}, "finishReason": "STOP"}],
                    "usageMetadata": {"promptTokenCount": 120, "candidatesTokenCount": 30, "totalTokenCount": 150},
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(out)))
                self.end_headers()
                self.wfile.write(out)

        self._srv = ThreadingHTTPServer(("127.0.0.1", 0), _Xu)
        self.url = "http://127.0.0.1:%d/v1beta/models/gemini-2.5-flash:generateContent" % self._srv.server_address[1]
        threading.Thread(target=self._srv.serve_forever, daemon=True).start()

    def _van_ban(self, body):
        if self.tra_loi:
            return self.tra_loi(body)
        schema = (body.get("generationConfig") or {}).get("responseSchema")
        if schema:
            return json.dumps(_mau_theo_schema(schema), ensure_ascii=False)
        hoi = ""
        for turn in body.get("contents") or []:
            for part in turn.get("parts") or []:
                if part.get("text"):
                    hoi = part["text"]
        return "Câu trả lời mẫu cho: " + hoi[-80:]

    def dung(self):
        self._srv.shutdown()
        self._srv.server_close()


class MayChuThu:
    """FastAPI that tren SQLite tam, da nap san cac bundle. Dung trong `with`.

        with MayChuThu([duong_dan_bundle]) as may:
            may.goc          # "http://127.0.0.1:PORT"
            may.api          # may.goc + API_PREFIX
            may.gemini       # GeminiGia: moi loi goi AI cua may chu nay di vao day

    `env` them / de bien moi truong cho may chu (vd {"AI_ACCESS": "public"}).
    """

    def __init__(self, bundles, api_prefix="/api/v1", env=None):
        self.bundles = list(bundles)
        self.api_prefix = api_prefix
        self.env_them = dict(env or {})
        self.py = python_backend()
        self.proc = None
        self.tam = None
        self.gemini = None

    def _env(self):
        env = dict(os.environ)
        env.update({
            "DB_URL": "sqlite+aiosqlite:///" + os.path.join(self.tam, "kiem.sqlite3").replace("\\", "/"),
            "TESTING": "false",
            "API_PREFIX": self.api_prefix,
            "COURSE_ADMIN_KEY": self.khoa_admin,
            "PYTHONIOENCODING": "utf-8",
            # Bien moi truong thang .env: Gemini gia, khoa gia, quyen AI mac dinh.
            "GEMINI_URL": self.gemini.url,
            "GEMINI_API_KEY": "kiem-thu",
            "AI_ACCESS": "admin",
            "AI_ACCESS_CODE": "",
            "AI_ENABLED": "true",
        })
        env.update(self.env_them)
        return env

    def __enter__(self):
        if not self.py:
            raise RuntimeError("khong tim thay python co fastapi/uvicorn (backend/fastapi/.venv)")
        self.tam = tempfile.mkdtemp(prefix="kiem-khoa-hoc-")
        self.khoa_admin = secrets.token_hex(8)
        self.gemini = GeminiGia()
        env = self._env()
        cli = os.path.join(FASTAPI, "tools", "manage_courses.py")
        for args in [["init-db"]] + [["import", b] for b in self.bundles]:
            r = subprocess.run([self.py, cli] + args, cwd=FASTAPI, env=env, capture_output=True, text=True,
                               encoding="utf-8", errors="replace")
            if r.returncode != 0:
                self.__exit__(None, None, None)
                raise RuntimeError("manage_courses.py %s that bai:\n%s" % (" ".join(args), (r.stdout + r.stderr)[-1500:]))
        self.cong = _cong_trong()
        self.goc = "http://127.0.0.1:%d" % self.cong
        self.api = self.goc + self.api_prefix
        self.log = open(os.path.join(self.tam, "uvicorn.log"), "w", encoding="utf-8")
        self.proc = subprocess.Popen(
            [self.py, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(self.cong)],
            cwd=FASTAPI, env=env, stdout=self.log, stderr=subprocess.STDOUT)
        han = time.time() + 60
        while time.time() < han:
            if self.proc.poll() is not None:
                break
            try:
                with urllib.request.urlopen(self.goc + "/health/", timeout=2) as r:
                    if r.status == 200:
                        return self
            except Exception:
                time.sleep(0.4)
        self.__exit__(None, None, None)
        raise RuntimeError("uvicorn khong len trong 60 giay")

    def so_yeu_cau(self):
        """So yeu cau HTTP may chu da nhan — dem dong access log cua uvicorn."""
        return len(self.yeu_cau())

    def yeu_cau(self, tu=0):
        """Cac dong access log (moi dong mot yeu cau), tu yeu cau thu `tu`."""
        try:
            with open(os.path.join(self.tam, "uvicorn.log"), encoding="utf-8", errors="replace") as f:
                return [dong.strip() for dong in f if ' HTTP/1.1" ' in dong][tu:]
        except OSError:
            return []

    def doc_log(self):
        try:
            with open(os.path.join(self.tam, "uvicorn.log"), encoding="utf-8", errors="replace") as f:
                return f.read()[-3000:]
        except OSError:
            return ""

    def __exit__(self, *exc):
        if self.proc is not None and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if getattr(self, "log", None):
            self.log.close()
        if self.gemini is not None:
            self.gemini.dung()
            self.gemini = None
        if self.tam:
            shutil.rmtree(self.tam, ignore_errors=True)
        return False


# ----------------------------------------------------------------- tang 1

def _khoa_hoc_cua(thu_muc):
    p = os.path.join(thu_muc, "assets", "cau-hinh.js")
    if not os.path.exists(p):
        return None
    m = re.search(r'\bkhoaHoc:\s*"([a-z0-9][a-z0-9-]*)"', open(p, encoding="utf-8").read())
    return m.group(1) if m else None


def tang_1(thu_muc, B):
    print("\nTANG 1 — tinh")
    ten = os.path.basename(thu_muc.rstrip(os.sep))
    html = open(os.path.join(thu_muc, "index.html"), encoding="utf-8").read()
    srcs = [s for s in re.findall(r'<script[^>]+src="([^"]+)"', html) if not s.startswith("http")]
    if srcs == ["assets/hien-thi.js", "assets/cau-hinh.js", "assets/app.js"]:
        B.ok("index.html nap hien-thi.js -> cau-hinh.js -> app.js, khong con content.js")
    else:
        B.sai("thu tu <script> cuc bo trong index.html: %s (can: hien-thi.js, cau-hinh.js, app.js)" % srcs)
    for f in ("content.js", "content.json"):
        if os.path.exists(os.path.join(thu_muc, "assets", f)):
            B.sai("assets/%s van con — noi dung nang phai nam trong database, khong nam trong trang" % f)
    for s in srcs:
        if not os.path.exists(os.path.join(thu_muc, s)):
            B.sai("index.html tro toi tep khong co: " + s)

    sys.path.insert(0, HERE)
    import kiem_pwa
    for dat, msg in kiem_pwa.tinh(thu_muc):
        (B.ok if dat else B.sai)(msg)

    khoa = _khoa_hoc_cua(thu_muc)
    if not khoa:
        B.sai("assets/cau-hinh.js thieu khoaHoc (slug cua khoa trong database)")
        return None
    B.ok("khoaHoc = %s" % khoa)
    bundle_path = os.path.join(CONTENT, khoa + ".json")
    if not os.path.exists(bundle_path):
        B.sai("khong co bundle %s" % os.path.relpath(bundle_path, COURSES))
        return None
    try:
        bundle = json.load(open(bundle_path, encoding="utf-8"))
    except ValueError as e:
        B.sai("bundle khong doc duoc: %s" % e)
        return None
    docs = bundle.get("docs") or {}
    items = [i for s in bundle.get("nav", []) for g in s.get("groups", []) for i in g.get("items", [])]
    thieu = [i for i in items if i not in docs]
    if thieu:
        B.sai("cay muc luc tro toi %d bai khong co: %s" % (len(thieu), thieu[:5]))
    else:
        B.ok("bundle %s.json: %d bai, cay muc luc hop le" % (khoa, len(docs)))
    if (bundle.get("course") or {}).get("slug") not in (None, khoa):
        B.sai("bundle.course.slug (%s) khac khoaHoc (%s)" % (bundle["course"]["slug"], khoa))

    try:
        json.load(open(os.path.join(thu_muc, "metadata.json"), encoding="utf-8"))
        B.ok("metadata.json doc duoc")
    except Exception as e:  # noqa: BLE001
        B.sai("metadata.json: %s" % e)

    node = shutil.which("node")
    if node:
        for f in ("assets/hien-thi.js", "assets/cau-hinh.js", "assets/app.js", "assets/mo-offline.js",
                  "assets/mo-on-tap.js", "assets/mo-ai.js", "assets/ai-khach.js", "assets/mo-so-tay.js",
                  "assets/mo-ban-do.js", "assets/mo-doc.js", "assets/mo-thanh-tich.js", "assets/pwa.js", "sw.js"):
            r = subprocess.run([node, "--check", os.path.join(thu_muc, f)], capture_output=True, text=True)
            (B.ok if r.returncode == 0 else B.sai)("cu phap " + f + ("" if r.returncode == 0 else ": " + r.stderr.strip()[-200:]))
    else:
        B.bo_qua("khong co Node — bo qua kiem cu phap JS")
    return {"khoa": khoa, "bundle_path": bundle_path, "bundle": bundle, "ten": ten}


# ----------------------------------------------------------------- tang 2

def _tu_tim(bundle):
    """Mot tu de thu tim kiem: tu dai nhat trong tieu de mot bai o giua khoa."""
    order = bundle.get("order") or list(bundle.get("docs", {}))
    d = bundle["docs"][order[len(order) // 2]]
    tu = [w for w in re.findall(r"[^\W\d_]{4,}", d["title"])]
    return (max(tu, key=len) if tu else d["title"].split()[0]), d["id"]


def tang_2(thu_muc, info, B, chup):
    print("\nTANG 2 — FastAPI that + SQLite tam + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        B.bo_qua("chua cai playwright: pip install playwright && python -m playwright install chromium")
        return
    if not python_backend():
        B.bo_qua("khong tim thay venv backend/fastapi/.venv co fastapi + uvicorn")
        return
    bundle = info["bundle"]
    order = bundle.get("order") or list(bundle["docs"])
    old_size = os.path.getsize(info["bundle_path"])
    try:
        may = MayChuThu([info["bundle_path"]]).__enter__()
    except Exception as e:  # noqa: BLE001
        B.sai("khong dung duoc may chu thu: %s" % e)
        return
    anh = os.path.join(thu_muc, "_shots")
    try:
        B.ok("uvicorn len tai %s (API_PREFIX=%s), da nap %s" % (may.goc, may.api_prefix, info["khoa"]))
        url = "%s/webapp/courses/%s/?theme=light" % (may.goc, info["ten"])
        loi, phan_hoi, yeu_cau = [], [], []
        with sync_playwright() as pw:
            try:
                br = pw.chromium.launch()
            except Exception as e:  # noqa: BLE001
                B.bo_qua("khong mo duoc Chromium: %s" % str(e).splitlines()[0])
                return
            pg = br.new_page(viewport={"width": 1280, "height": 860})
            pg.on("console", lambda m: loi.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
            pg.on("response", lambda r: phan_hoi.append((r.url, r.status, r.headers.get("content-length"),
                                                         r.headers.get("content-encoding"))))
            pg.on("request", lambda r: yeu_cau.append(r.url))

            pg.goto(url, wait_until="load")
            try:
                pg.wait_for_selector(".hero h1", timeout=20000)
                B.ok("trang chu dung tu manifest")
            except Exception:
                B.sai("trang chu khong hien (.hero h1). Log may chu:\n" + may.doc_log()[-800:])
                return
            n_nav = pg.evaluate("() => document.querySelectorAll('#sideNav .nav-i').length")
            (B.ok if n_nav == len(order) else B.sai)("muc luc trai: %d muc / %d bai" % (n_nav, len(order)))
            man = [r for r in phan_hoi if "/manifest" in r[0]]
            if man:
                kb = int(man[0][2] or 0) / 1024.0
                B.ok("manifest %.0f KB tren day (%s) — bundle cu %.0f KB, giam %.0f lan"
                     % (kb, man[0][3] or "khong nen", old_size / 1024.0, old_size / max(1.0, kb * 1024)))
            else:
                B.sai("khong thay request /manifest")
            if any("content.js" in r[0] for r in phan_hoi):
                B.sai("trang van tai content.js")
            if chup:
                os.makedirs(anh, exist_ok=True)
                pg.screenshot(path=os.path.join(anh, "db-trang-chu.png"))

            # mo bai dau tien
            dau = bundle["docs"][order[0]]
            pg.evaluate("h => { location.hash = h; }", "#/" + dau["slug"])
            try:
                pg.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                                     " return b && b.textContent.trim().length > 30; }", timeout=15000)
                B.ok("mo bai '%s' — markdown tai rieng tu /docs/" % dau["title"][:50])
            except Exception:
                B.sai("bai dau tien khong hien noi dung")
            if not any("/docs/" in r[0] for r in phan_hoi):
                B.sai("khong thay request /docs/ khi mo bai")

            # bai tiep bang phim ]
            if len(order) > 1:
                truoc = pg.title()
                pg.keyboard.press("]")
                try:
                    pg.wait_for_function("t => document.title !== t", arg=truoc, timeout=10000)
                    pg.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                                         " return b && b.textContent.trim().length > 30; }", timeout=10000)
                    B.ok("phim ] mo bai tiep theo")
                except Exception:
                    B.sai("phim ] khong mo duoc bai tiep")
            if chup:
                pg.screenshot(path=os.path.join(anh, "db-bai-doc.png"), full_page=False)

            # tim kiem phia server. Mo o tim voi chuoi rong thi trang hien san "goi y"
            # (bai vua doc…), nen phai CHO phan hoi /search va ket qua co to sang tu
            # khoa — khong thi kiem nham vao danh sach goi y.
            tu, mong_doi = _tu_tim(bundle)
            pg.keyboard.press("Control+K")
            try:
                with pg.expect_response(lambda r: "/search?" in r.url, timeout=10000):
                    pg.fill("#q", tu)
                pg.wait_for_selector("#res .r-i mark", timeout=10000)
                hrefs = pg.evaluate("() => [...document.querySelectorAll('#res .r-i')].map(a => a.getAttribute('href'))")
                slug_md = "#/" + bundle["docs"][mong_doi]["slug"]
                (B.ok if slug_md in hrefs else B.sai)(
                    "tim kiem '%s' (server) ra %d ket qua%s" % (tu, len(hrefs), "" if slug_md in hrefs else
                                                                  ", THIEU bai co tu do trong tieu de"))
                pg.click("#res .r-i")
                pg.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                                     " return b && b.textContent.trim().length > 30; }", timeout=10000)
                B.ok("bam ket qua tim kiem mo dung bai")
            except Exception as e:  # noqa: BLE001
                B.sai("tim kiem '%s' khong ra ket qua hoac khong mo duoc bai: %s" % (tu, str(e).splitlines()[0]))

            # tai lai: manifest xac thuc lai bang ETag. Playwright bao trang thai cua
            # phan hoi da phuc vu tu cache (200) — su that nam o log may chu (304).
            pg.evaluate("() => { location.hash = '#/'; }")
            pg.reload(wait_until="load")
            pg.wait_for_selector(".hero h1", timeout=20000)
            pg.wait_for_timeout(300)
            dong = [l for l in may.doc_log().splitlines() if "/manifest" in l]
            if dong and "304" in dong[-1]:
                B.ok("tai lai: manifest tra 304 (ETag) — khong tai lai noi dung")
            else:
                B.sai("tai lai: may chu khong tra 304 cho manifest (%s)" % (dong[-1].strip() if dong else "khong co request"))
            if chup:
                pg.evaluate("() => { document.documentElement.setAttribute('data-theme','dark'); }")
                pg.screenshot(path=os.path.join(anh, "db-trang-chu-toi.png"))
                B.ok("anh chup trong _shots/")
            kiem_lab_nhung(pg, bundle, B)
            kiem_lien_ket(pg, bundle, thu_muc, B)
            kiem_offline(br, may, url, bundle, B)            # truoc ca_bien: ca bien xoa muc luc
            kiem_tro_giang(br, may, url, bundle, B)
            kiem_chay_ma(br, may, info, url, B)
            kiem_ai_hoc_tap(br, may, url, bundle, B)
            kiem_cong_cu(br, url, bundle, B)
            ca_bien(pg, may, info, url, order, yeu_cau, B)
            br.close()
        if loi:
            for l in loi[:8]:
                B.sai("console: " + l[:200])
        else:
            B.ok("khong co loi console / pageerror")
    finally:
        may.__exit__(None, None, None)


def kiem_lien_ket(pg, bundle, thu_muc, B):
    """Trang khai bao `lienKet` (engine/mo-lien-ket.js): bai giang co nut sang trang thuc hanh / mo phong,
    trang chu co khung "Hoc song song", va moi dich den la mot thu muc co that canh trang nay."""
    try:
        with open(os.path.join(thu_muc, "assets", "cau-hinh.js"), encoding="utf-8") as f:
            if "lienKet" not in f.read():
                return
    except OSError:
        return
    slugs = [d["slug"] for d in bundle["docs"].values()]
    ket = pg.evaluate(
        "slugs => { const g = KhoaHoc.cauHinh('lienKet', []), out = {};"
        " slugs.forEach(s => { const h = [];"
        "   g.forEach(x => { let r = null; try { r = x.url(s); } catch (e) { r = null; }"
        "     (Array.isArray(r) ? r : [r]).forEach(y => { const u = y && (typeof y === 'string' ? y : y.href); if (u) h.push(u); }); });"
        "   if (h.length) out[s] = h; }); return out; }", slugs)
    if not ket:
        B.sai("lienKet khai bao nhung khong bai nao co dich den")
        return
    cha = os.path.dirname(thu_muc)
    hong = set()
    for hs in ket.values():
        for u in hs:
            thu = os.path.normpath(os.path.join(thu_muc, u.split("#")[0]))
            if os.path.dirname(thu) != cha and not os.path.isdir(thu):
                hong.add(u)
            elif not os.path.isdir(thu):
                hong.add(u)
    (B.sai if hong else B.ok)("lienKet: %d bai giang co lien ket, %s" % (
        len(ket), ("DICH KHONG CO THAT: " + ", ".join(sorted(hong)[:4])) if hong else "moi dich la mot trang co that"))
    slug = sorted(ket, key=lambda s: -len(ket[s]))[0]
    pg.evaluate("h => { location.hash = h; }", "#/" + slug)
    try:
        pg.wait_for_selector(".lk-ngoai a", timeout=10000)
        hrefs = pg.evaluate("() => [...document.querySelectorAll('.lk-ngoai a')].map(a => a.getAttribute('href'))")
        (B.ok if sorted(hrefs) == sorted(ket[slug]) else B.sai)("bai '%s' hien %d nut hoc song song: %s" % (slug, len(hrefs), ", ".join(hrefs)[:120]))
    except Exception:
        B.sai("bai '%s' khong hien .lk-ngoai (mo-lien-ket.js chua nap?)" % slug)
        return
    pg.evaluate("() => { location.hash = '#/'; }")
    try:
        pg.wait_for_selector(".lk-home a", timeout=8000)
        B.ok("trang chu co khung 'Hoc song song'")
    except Exception:
        B.sai("trang chu khong co .lk-home")


def kiem_lab_nhung(pg, bundle, B):
    """Bai co khoi ```lab <id>``` (engine/hien-thi.js): khung mo phong chay ngay trong bai,
    trang lab o che do nhung, khung tu cao theo noi dung."""
    bai = next((d for d in bundle["docs"].values() if "```lab" in (d.get("md") or "")), None)
    if bai is None:
        return
    lab = re.search(r"```lab\s*\n\s*([a-z0-9-]+)", bai["md"]).group(1)
    try:
        pg.evaluate("s => { location.hash = '#/' + s; }", bai["slug"])
        pg.wait_for_selector("figure.lab-nhung iframe", timeout=15000)
        pg.locator("figure.lab-nhung").first.scroll_into_view_if_needed()
        pg.frame_locator("figure.lab-nhung iframe").first.locator(".d-head h1").wait_for(timeout=20000)
        pg.wait_for_timeout(500)
        kq = pg.evaluate("""() => { const f = document.querySelector('figure.lab-nhung iframe');
            const d = f.contentDocument;
            return {src: f.getAttribute('src'), nhung: d.documentElement.classList.contains('nhung'),
                    cao: Math.round(f.getBoundingClientRect().height),
                    than: Math.round(d.body.getBoundingClientRect().height)}; }""")
    except Exception as e:
        B.sai("lab nhung trong bai '%s' khong chay: %s" % (bai["slug"], str(e).splitlines()[0]))
        return
    if ("nhung=1" in kq["src"] and ("#/" + lab) in kq["src"] and kq["nhung"]
            and abs(kq["cao"] - min(kq["than"] + 4, 1600)) <= 6):
        B.ok("lab '%s' nhung trong bai '%s': che do nhung, khung tu cao %d px" % (lab, bai["slug"], kq["cao"]))
    else:
        B.sai("lab nhung trong bai '%s' sai: %s" % (bai["slug"], kq))


def kiem_offline(br, may, url, bundle, B):
    """Doc offline (engine/sw.js + pwa.js + mo-offline.js) trong context MOI. Phan chung
    o kiem_pwa.trinh_duyet; roi bam "Luu ca khoa", tat mang va mo bai CUOI — bai chua
    mo lan nao trong context nay, chi co the den tu ban "Luu ca khoa" vua tai."""
    import kiem_pwa
    order = bundle.get("order") or list(bundle["docs"])
    ctx = br.new_context(viewport={"width": 1280, "height": 860})
    try:
        pg = ctx.new_page()
        for dat, msg in kiem_pwa.trinh_duyet(ctx, pg, url, ".hero h1", may.so_yeu_cau, may.yeu_cau):
            (B.ok if dat else B.sai)(msg)
        pg.goto(url, wait_until="load")
        pg.wait_for_selector("#btnLuuKhoa", timeout=15000)
        pg.click("#btnLuuKhoa")
        pg.wait_for_function("() => /^Đã lưu \\d+\\/\\d+ bài/.test(document.querySelector('#offlineDong').textContent)",
                             timeout=120000)
        dong = pg.text_content("#offlineDong")
        so = re.match(r"Đã lưu (\d+)/(\d+) bài", dong)
        (B.ok if so and so.group(1) == so.group(2) != "0" else B.sai)("Luu ca khoa: " + dong[:100])
        cuoi = bundle["docs"][order[-1]]
        truoc = kiem_pwa.doi_yen(may.so_yeu_cau)
        ctx.set_offline(True)
        try:
            pg.reload(wait_until="load")
            pg.wait_for_selector(".hero h1", timeout=10000)
            pg.evaluate("h => { location.hash = h; }", "#/" + cuoi["slug"])
            pg.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                                 " return b && b.textContent.trim().length > 30; }", timeout=10000)
            them = [d for d in may.yeu_cau(truoc) if not kiem_pwa.la_cap_nhat_sw(d)]
            (B.ok if not them else B.sai)("mat mang: mo bai chua doc lan nao '%s' tu ban 'Luu ca khoa'%s" % (
                cuoi["title"][:40], "" if not them else " — NHUNG van co %d yeu cau toi may chu: %s" % (
                    len(them), "; ".join(d.split(" - ", 1)[-1][:90] for d in them[:3]))))
        except Exception as e:  # noqa: BLE001
            B.sai("mat mang: khong mo duoc bai chua doc sau 'Luu ca khoa' (%s)" % str(e).splitlines()[0])
        finally:
            ctx.set_offline(False)
    except Exception as e:  # noqa: BLE001
        B.sai("doc offline: %s" % str(e).splitlines()[0])
    finally:
        ctx.close()


def phien_quan_tri(may):
    """Token phien quan tri (nhu trang Quan ly lay) — de mo trang voi tu cach quan tri vien."""
    req = urllib.request.Request(may.api + "/courses/admin/verify", method="POST", data=b"{}",
                                 headers={"X-Admin-Key": may.khoa_admin, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))["session"]


def kiem_tro_giang(br, may, url, bundle, B):
    """Tro giang AI (engine/mo-ai.js) tren Gemini GIA: AI mac dinh chi cho quan tri vien."""
    order = bundle.get("order") or list(bundle["docs"])
    bai = bundle["docs"][order[0]]
    ctx = br.new_context(viewport={"width": 1280, "height": 860})
    loi = []
    try:
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: loi.append(str(e)))
        pg.goto(url + "#/" + bai["slug"], wait_until="load")
        pg.wait_for_selector("#body .prose", timeout=20000)
        pg.wait_for_timeout(800)
        (B.ok if not pg.locator(".ai-hang").count() else B.sai)(
            "tro giang AI: khach KHONG thay khi AI chi danh cho quan tri vien")

        pg.evaluate("([k, t]) => localStorage.setItem(k, JSON.stringify(t))",
                    ["qlkh.phien@" + may.api + ".token", phien_quan_tri(may)])
        truoc = len(may.gemini.goi)
        pg.reload(wait_until="load")
        pg.wait_for_selector(".ai-hang button", timeout=20000)
        pg.click('.ai-hang [data-viec="summary"]')
        pg.wait_for_selector("#aiKhung .ai-muc .prose", timeout=20000)
        gui = may.gemini.goi[truoc:]
        hoi = re.sub(r"\s+", " ", gui[-1]["body"]["contents"][0]["parts"][0]["text"]) if gui else ""
        dau_bai = re.sub(r"\s+", " ", re.sub(r"^#.*\n", "", bai.get("md") or "").strip())[:20]
        (B.ok if gui and dau_bai in hoi else B.sai)(
            "tro giang: quan tri vien thay hang viec; 'Tom tat' gui noi dung bai toi model (%d loi goi)" % len(gui))

        pg.click('.ai-hang [data-viec="quiz"]')
        pg.wait_for_selector("#aiKhung .ai-q .ai-dap-an", timeout=20000)
        pg.locator("#aiKhung .ai-q").first.locator(".ai-dap-an").first.click()
        kq = pg.evaluate("() => { const q = document.querySelector('#aiKhung .ai-q');"
                         " return {n: document.querySelectorAll('#aiKhung .ai-q').length,"
                         " cham: q.querySelectorAll('.dung, .sai').length, giai: !q.querySelector('.ai-giai').hidden}; }")
        (B.ok if kq["n"] >= 3 and kq["cham"] >= 1 and kq["giai"] else B.sai)("tro giang: cau hoi on tap cham ngay (%s)" % kq)

        pg.fill("#aiCau", "Y chinh cua bai la gi?")
        pg.press("#aiCau", "Enter")
        pg.wait_for_selector("#aiKhung .ai-nguon a", timeout=20000)
        nguon = pg.eval_on_selector_all("#aiKhung .ai-nguon a", "e => e.map(a => a.getAttribute('href'))")
        (B.ok if nguon and nguon[0] == "#/" + bai["slug"] else B.sai)("tro giang: hoi dap kem nguon trong khoa %s" % nguon)

        # on tap: the AI -> bo the -> trang #/~on-tap: lat, cham 'Duoc' -> het han hom nay, hen 1 ngay
        pg.click('.ai-hang [data-viec="cards"]')
        pg.wait_for_selector("#aiKhung .ai-the-chan button", timeout=20000)
        pg.click("#aiKhung .ai-the-chan button")
        da_them = pg.text_content("#aiKhung .ai-the-chan button")
        pg.evaluate("() => { location.hash = '#/~on-tap'; }")
        pg.wait_for_selector("#otKhung .ot-the", timeout=10000)
        pg.keyboard.press("Escape")
        pg.keyboard.press("Space")
        pg.wait_for_selector("#otCham:not([hidden])", timeout=5000)
        pg.keyboard.press("3")
        pg.wait_for_selector("#otKhung .ot-xong", timeout=5000)
        the = pg.evaluate("() => Object.keys(localStorage).filter(k => k.endsWith('.the'))"
                          ".map(k => JSON.parse(localStorage.getItem(k)))[0] || []")
        dat = (da_them.startswith("Đã thêm") and len(the) >= 1 and the[0]["lan"] == 1 and the[0]["iv"] == 1
               and the[0]["doc"] == order[0])
        (B.ok if dat else B.sai)("on tap: the AI vao bo, lat (Space) + cham 'Duoc' (3) -> hen 1 ngay (%s, %s)" % (
            da_them, [(c["front"][:20], c["iv"], c["lan"]) for c in the]))
        pg.evaluate("() => { location.hash = '#/'; }")
        pg.wait_for_selector("#otO", timeout=10000)
        (B.ok if "Đã ôn hết" in pg.text_content("#otO") else B.sai)("on tap: trang chu bao da on het the den han")
    except Exception as e:  # noqa: BLE001
        B.sai("tro giang AI: %s" % str(e).splitlines()[0])
    finally:
        ctx.close()
    if loi:
        B.sai("tro giang AI: pageerror %s" % loi[0][:200])


MD_CHAY = ("\n\n```js-chay\nconsole.log(1 + 2)\n```\n\n"
           "```js-bai-tap\nfunction tong(a, b) {\n  return 0;\n}\n---kiem---\n"
           "kiem(tong(1, 2) === 3, \"tong(1, 2) phải bằng 3\");\n```\n")


def kiem_chay_ma(br, may, info, url, B):
    """O ma chay duoc + bai tap tu cham (engine/hien-thi.js taoChay), trong Web Worker."""
    bundle = info["bundle"]
    order = bundle.get("order") or list(bundle["docs"])
    bai = bundle["docs"][order[-1]]
    duong = "/".join(urllib.parse.quote(x, safe="") for x in bai["id"].split("/"))
    req = urllib.request.Request(
        may.api + "/courses/" + info["khoa"] + "/docs/" + duong, method="PUT",
        data=json.dumps({"md": "# " + bai["title"] + MD_CHAY}).encode("utf-8"),
        headers={"X-Admin-Key": may.khoa_admin, "Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=30).read()
    ctx = br.new_context(viewport={"width": 1280, "height": 860})
    try:
        pg = ctx.new_page()
        pg.goto(url + "&t=9#/" + bai["slug"], wait_until="load")
        pg.wait_for_selector(".chay .chay-ma", timeout=20000)
        o1, o2 = pg.locator(".chay").nth(0), pg.locator(".chay.bai-tap")
        o1.locator('[data-viec="chay"]').click()
        o1.locator(".chay-ra:has-text('3')").wait_for(timeout=10000)
        (B.ok if o1.locator(".chay-ra").inner_text().strip() == "3" else B.sai)(
            "ma chay duoc: console.log(1 + 2) in ra 3 (Web Worker)")

        o2.locator('[data-viec="nop"]').click()
        o2.locator(".chay-ra.chua-dat").wait_for(timeout=10000)
        sai_tb = o2.locator(".chay-ra").inner_text()
        o2.locator(".chay-ma").fill("function tong(a, b) {\n  return a + b;\n}")
        o2.locator('[data-viec="nop"]').click()
        o2.locator(".chay-ra.dat").wait_for(timeout=10000)
        (B.ok if "tong(1, 2) phải bằng 3" in sai_tb and o2.locator(".chay-dat").is_visible() else B.sai)(
            "bai tap tu cham: nop sai bao loi cua kiem tra, nop dung -> Dat (%r)" % sai_tb.strip()[:60])

        pg.reload(wait_until="load")
        pg.wait_for_selector(".chay.bai-tap .chay-ma", timeout=20000)
        giu = pg.locator(".chay.bai-tap .chay-ma").input_value()
        (B.ok if "a + b" in giu and pg.locator(".chay.bai-tap .chay-dat").is_visible() else B.sai)(
            "ma da sua va trang thai Dat giu qua tai lai trang")

        o1 = pg.locator(".chay").nth(0)
        o1.locator(".chay-ma").fill("while (true) {}")
        o1.locator('[data-viec="chay"]').click()
        o1.locator(".chay-ra:has-text('Dừng sau')").wait_for(timeout=12000)
        o1.locator(".chay-ma").fill("console.log('chay lai duoc')")
        o1.locator('[data-viec="chay"]').click()
        o1.locator(".chay-ra:has-text('chay lai duoc')").wait_for(timeout=10000)
        B.ok("vong lap vo han bi dung sau 5 giay (worker bi huy), o ma chay lai duoc")
    except Exception as e:  # noqa: BLE001
        B.sai("ma chay duoc trong bai: %s" % str(e).splitlines()[0])
    finally:
        ctx.close()


def kiem_ai_hoc_tap(br, may, url, bundle, B):
    """AI hoc tap (dot 2026-10-08) tren Gemini GIA, voi tu cach quan tri vien: chon model (X-AI-Model),
    hoi ca khoa tu trang chu, goi y bai tap 3 muc, AI cham the on tap, on tu so tay.
    Chay SAU kiem_chay_ma (bai cuoi da co bai tap js tu cham voi ma khoi dau sai)."""
    order = bundle.get("order") or list(bundle["docs"])
    dau, cuoi = bundle["docs"][order[0]], bundle["docs"][order[-1]]
    ctx = br.new_context(viewport={"width": 1280, "height": 860})
    loi = []
    try:
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: loi.append(str(e)))
        pg.goto(url + "&t=13#/", wait_until="load")
        pg.evaluate("([k, t]) => localStorage.setItem(k, JSON.stringify(t))",
                    ["qlkh.phien@" + may.api + ".token", phien_quan_tri(may)])
        pg.reload(wait_until="load")
        pg.wait_for_selector("#btnAiKhoa", timeout=20000)

        # 1. hoi ca khoa tu trang chu, voi model tu chon
        pg.click("#btnAiKhoa")
        pg.wait_for_selector("#aiKhung:not([hidden]) [data-pv='khoa'][aria-pressed='true']", timeout=5000)
        pg.wait_for_selector("#aiKhung .ai-model select option[value='gemini-3.8-flash']", state="attached", timeout=15000)
        pg.select_option("#aiKhung .ai-model select", "gemini-3.8-flash")
        truoc = len(may.gemini.goi)
        pg.fill("#aiCau", dau["title"])
        pg.press("#aiCau", "Enter")
        pg.wait_for_selector("#aiKhung .ai-muc .ai-nguon a", timeout=20000)
        gui = may.gemini.goi[truoc:]
        duong = gui[-1]["path"] if gui else ""
        (B.ok if "/models/gemini-3.8-flash:" in duong else B.sai)(
            "chon model: lua chon gui qua X-AI-Model, may chu goi dung model do (%s)" % duong)
        nguon = pg.eval_on_selector_all("#aiKhung .ai-nguon a", "e => e.map(a => a.getAttribute('href'))")
        (B.ok if nguon and all(h.startswith("#/") for h in nguon) else B.sai)("hoi ca khoa tu trang chu: tra loi kem nguon %s" % nguon)
        luu = pg.evaluate("k => localStorage.getItem(k)", "ai.model@" + may.api)
        (B.ok if luu and "gemini-3.8-flash" in luu else B.sai)("model da chon cat theo goc API (dung chung moi trang): %s" % luu)
        pg.select_option("#aiKhung .ai-model select", "")
        pg.keyboard.press("Escape")

        # 2. goi y bai tap: nop sai -> nut Goi y -> muc 1, roi muc 2
        pg.evaluate("s => { location.hash = '#/' + s; }", cuoi["slug"])
        pg.wait_for_selector(".chay.bai-tap .chay-ma", timeout=20000)
        o = pg.locator(".chay.bai-tap")
        o.locator('[data-viec="nop"]').click()
        o.locator(".chay-ra.chua-dat").wait_for(timeout=10000)
        o.locator(".goi-y-nut").wait_for(timeout=5000)
        truoc = len(may.gemini.goi)
        o.locator(".goi-y-nut").click()
        o.locator(".goi-y-muc").first.wait_for(timeout=15000)
        hoi = may.gemini.goi[truoc:][-1]["body"]["contents"][0]["parts"][0]["text"] if may.gemini.goi[truoc:] else ""
        nhan = o.locator(".goi-y-nut").inner_text()
        (B.ok if "MÃ CỦA NGƯỜI HỌC" in hoi and "return 0" in hoi and "Mức 1" in hoi and "mức 2/3" in nhan else B.sai)(
            "goi y bai tap: gui ma + loi cua nguoi hoc, muc 1 roi moi len muc 2 (%r)" % nhan)

        # 3. AI cham the on tap: tu tra loi -> diem + goi y muc, dap an lat ra
        pg.evaluate("id => KhoaHoc.onTap.them(id, [{front: 'Cau hoi kiem tra AI?', back: 'Dap an mau'}])", dau["id"])
        pg.evaluate("() => { location.hash = '#/~on-tap'; }")
        pg.wait_for_selector("#otKhung .ot-ai textarea", timeout=10000)
        pg.fill("#otTraLoi", "Cau tra loi cua toi")
        pg.click("#otAiCham")
        pg.wait_for_selector("#otAiKq .ot-ai-diem", timeout=15000)
        kq = pg.evaluate("() => ({sau: !document.querySelector('#otSau').hidden, cham: !document.querySelector('#otCham').hidden,"
                         " goiY: [...document.querySelectorAll('#otCham .ot-goi-y')].map(b => b.dataset.q)})")
        (B.ok if kq["sau"] and kq["cham"] and len(kq["goiY"]) == 1 else B.sai)(
            "AI cham the on tap: lat dap an, goi y dung mot muc (%s)" % kq)

        # 4. on tu so tay: sinh the -> them vao bo on tap; tom tat
        pg.evaluate("id => KhoaHoc.LS.set('so-tay', [{id: 'st1', doc: id, chu: 'Mot doan to sang du dai de on tap', ghi: '', luc: Date.now()}])",
                    dau["id"])
        pg.evaluate("() => { location.hash = '#/~so-tay'; }")
        pg.wait_for_selector("#stAi:not([hidden]) [data-st='ai-the']", timeout=10000)
        pg.click("[data-st='ai-the']")
        pg.wait_for_selector("#stAiKq .ai-the li", timeout=15000)
        pg.click("#stAiKq .ai-the-chan button")
        nut = pg.inner_text("#stAiKq .ai-the-chan button")
        pg.click("[data-st='ai-tom']")
        pg.wait_for_selector("#stAiKq .prose", timeout=15000)
        (B.ok if nut.startswith("Đã thêm") else B.sai)("so tay: AI sinh the -> them vao bo on tap; tom tat de on (%r)" % nut)
    except Exception as e:  # noqa: BLE001
        B.sai("AI hoc tap: %s" % str(e).splitlines()[0])
    finally:
        ctx.close()
    if loi:
        B.sai("AI hoc tap: pageerror %s" % loi[0][:200])


def kiem_cong_cu(br, url, bundle, B):
    """So tay / ban do / che do doc / thanh tich (engine/mo-*.js) trong context moi."""
    order = bundle.get("order") or list(bundle["docs"])
    bai = bundle["docs"][order[1] if len(order) > 1 else order[0]]
    ctx = br.new_context(viewport={"width": 1280, "height": 860})
    loi = []
    try:
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: loi.append(str(e)))
        pg.goto(url + "&t=11#/" + bai["slug"], wait_until="load")
        pg.wait_for_selector("#body .prose p", timeout=20000)
        cc = pg.eval_on_selector_all(".nav-cc-i", "e => e.map(a => a.getAttribute('href'))")
        (B.ok if cc == ["#/~on-tap", "#/~so-tay", "#/~ban-do", "#/~thanh-tich"] else B.sai)(
            "muc 'Cong cu hoc' trong muc luc: %s" % cc)

        # to sang: chon chu cua doan dau tien co du chu -> thanh viec -> To sang
        pg.evaluate("""() => { const p = [...document.querySelectorAll('#body .prose p')].find(x => x.textContent.trim().length > 20);
            const r = document.createRange(); r.selectNodeContents(p);
            const s = getSelection(); s.removeAllRanges(); s.addRange(r);
            document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true})); }""")
        pg.wait_for_selector('.chon-thanh:not([hidden]) button:has-text("Tô sáng")', timeout=5000)
        pg.click('.chon-thanh button:has-text("Tô sáng")')
        pg.wait_for_timeout(200)
        hl = pg.evaluate("() => window.CSS && CSS.highlights && CSS.highlights.get('so-tay') ? CSS.highlights.get('so-tay').size : -1")
        pg.reload(wait_until="load")
        pg.wait_for_selector("#body .prose p", timeout=20000)
        pg.wait_for_timeout(300)
        hl2 = pg.evaluate("() => CSS.highlights.get('so-tay') ? CSS.highlights.get('so-tay').size : 0")
        pg.evaluate("() => { location.hash = '#/~so-tay'; }")
        pg.wait_for_selector(".st-trang", timeout=10000)
        n_to = pg.locator(".st-to").count()
        (B.ok if hl == 1 and hl2 == 1 and n_to == 1 else B.sai)(
            "to sang: ve bang CSS Highlight, tai lai van to, so tay co 1 doan (%s, %s, %s)" % (hl, hl2, n_to))

        # so tay -> Markdown Editor that (ban da publish): hop thu localStorage + ?import=1, nhan dung mot lan
        doan = " ".join(pg.text_content(".st-to blockquote").split())[:30]
        with ctx.expect_page(timeout=10000) as moi:
            pg.click('[data-st="mo"]')
        ed = moi.value
        ed.wait_for_function("t => { const a = document.querySelector('textarea.editor-input'); "
                             "return a && a.value.replace(/\\s+/g, ' ').includes(t); }", arg=doan, timeout=20000)
        con = ed.evaluate("() => localStorage.getItem('markdown-editor:inbox')")
        (B.ok if con is None and "import=1" not in ed.url else B.sai)(
            "so tay -> Markdown Editor: tab moi nhan dung noi dung, hop thu da xoa, bo ?import=1")
        ed.close()

        # ban do kien thuc + duong ngan nhat
        pg.evaluate("() => { location.hash = '#/~ban-do'; }")
        pg.wait_for_selector(".bd-svg .bd-nut", timeout=20000)
        n_nut = pg.locator(".bd-svg .bd-nut").count()
        pg.click("#bdTim")
        pg.wait_for_selector("#bdBen ol li", timeout=5000)
        buoc = pg.locator("#bdBen ol li").count()
        (B.ok if n_nut == len(order) and buoc >= 2 else B.sai)(
            "ban do kien thuc: %d/%d bai, duong ngan nhat %d bai" % (n_nut, len(order), buoc))

        # che do doc: tang co chu -> bien CSS tren <html>; dat lai -> bo
        pg.evaluate("h => { location.hash = h; }", "#/" + bai["slug"])
        pg.wait_for_selector("#body .prose p", timeout=10000)
        pg.click("#btnDoc")
        pg.click('.doc-hop [data-co="1"]')
        co = pg.evaluate("() => [document.documentElement.hasAttribute('data-doc'), getComputedStyle(document.querySelector('#body .prose')).fontSize]")
        pg.click('.doc-hop [data-lai="1"]')
        lai = pg.evaluate("() => document.documentElement.hasAttribute('data-doc')")
        (B.ok if co[0] and co[1] == "17.5px" and not lai else B.sai)("che do doc: co chu %s, dat lai %s" % (co, lai))

        # thanh tich: danh dau bai xong -> huy hieu 'Buoc dau', trang chu co o chuoi ngay hoc
        pg.keyboard.press("Escape")
        pg.click("#btnDone")
        pg.evaluate("() => { location.hash = '#/~thanh-tich'; }")
        pg.wait_for_selector(".tt-luoi", timeout=10000)
        mo = pg.eval_on_selector_all(".tt-hh.co b", "e => e.map(x => x.textContent)")
        pg.evaluate("() => { location.hash = '#/'; }")
        pg.wait_for_selector("#ttO", timeout=10000)
        (B.ok if "Bước đầu" in mo and "ngày liên tiếp" in pg.text_content("#ttO") else B.sai)(
            "thanh tich: huy hieu %s, trang chu bao chuoi ngay hoc" % mo)
    except Exception as e:  # noqa: BLE001
        B.sai("cong cu hoc: %s" % str(e).splitlines()[0])
    finally:
        ctx.close()
    if loi:
        B.sai("cong cu hoc: pageerror %s" % loi[0][:200])


def ca_bien(pg, may, info, url, order, yeu_cau, B):
    """Cac ca bien cua ban review: moi lan mo trang them &t=… de chac chan la
    mot lan tai that, khong phai doi hash tren trang cu."""
    def goi(method, duong, body=None):
        req = urllib.request.Request(
            may.api + "/courses/" + info["khoa"] + duong, method=method,
            data=None if body is None else json.dumps(body).encode("utf-8"),
            headers={"X-Admin-Key": may.khoa_admin, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))

    # 1. ?api= tro ra may chu la: bo qua, trang van doc API cung origin
    del yeu_cau[:]
    pg.goto(url + "&t=1&api=" + urllib.parse.quote("https://evil.invalid", safe=""), wait_until="load")
    try:
        pg.wait_for_selector(".hero h1", timeout=20000)
        # theo HOST cua request: dia chi cua chinh trang cung chua chu "evil.invalid" (trong ?api=)
        la = [u for u in yeu_cau if urllib.parse.urlsplit(u).hostname == "evil.invalid"]
        (B.ok if not la else B.sai)("?api=https://evil.invalid bi bo qua, trang van doc API cung origin"
                                    if not la else "trang goi toi may chu la: %s" % la[:2])
    except Exception:
        B.sai("?api= tro ra ngoai lam trang khong dung duoc")

    # 2. tieu de / meta mang the HTML: hien thanh chu, khong chay ma
    dau_id = order[0]
    slug = info["bundle"]["docs"][dau_id]["slug"]
    goi("PUT", "/docs/" + "/".join(urllib.parse.quote(x, safe="") for x in dau_id.split("/")),
        {"title": '<img src=x onerror="window.__xss=1">Tieu de la',
         "meta": {"no": '<img src=x onerror="window.__xss=2">', "of": "<i>9</i>", "level": 99}})
    pg.goto(url + "&t=2#/" + slug, wait_until="load")
    try:
        pg.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                             " return b && b.textContent.trim().length > 30; }", timeout=15000)
        kq = pg.evaluate("() => ({xss: window.__xss || 0,"
                         " img: document.querySelectorAll('#sideNav img, .chips img').length,"
                         " chu: document.querySelector('#sideNav').textContent.includes('<img src=x'),"
                         " sao: (document.querySelector('.chips .stars') || {}).textContent || ''})")
        dat = not kq["xss"] and not kq["img"] and kq["chu"] and kq["sao"] == "★★★★★"
        (B.ok if dat else B.sai)("tieu de / meta mang the HTML hien thanh chu, khong chay "
                                 "(xss=%s, img=%s, chu=%s, sao=%r)" % (kq["xss"], kq["img"], kq["chu"], kq["sao"]))
    except Exception as e:  # noqa: BLE001
        B.sai("bai co tieu de / meta la khong mo duoc: %s" % str(e).splitlines()[0])

    # 3. nhom rong (nguoi quan tri luu cay truoc, them bai sau)
    nav = goi("GET", "")["nav"]
    nav[0]["groups"].append({"title": "Nhóm mới chưa có bài", "short": "Moi", "items": []})
    goi("PUT", "/structure", {"nav": nav})
    pg.goto(url + "&t=3", wait_until="load")
    try:
        pg.wait_for_selector(".hero h1", timeout=20000)
        co = pg.evaluate("() => document.querySelector('#main').textContent.includes('Chưa có bài')")
        (B.ok if co else B.sai)("nhom rong: trang chu van dung" + ("" if co else " nhung the nhom khong bao 'Chua co bai'"))
    except Exception:
        B.sai("nhom rong lam trang chu ket o 'Dang tai muc luc'")

    # 4. muc luc rong: moi bai ra ngoai cay
    goi("PUT", "/structure", {"nav": []})
    pg.goto(url + "&t=4", wait_until="load")
    try:
        pg.wait_for_selector(".hero h1", timeout=20000)
        B.ok("muc luc rong: trang chu van dung")
    except Exception:
        B.sai("muc luc rong lam trang chu ket o 'Dang tai muc luc'")


def chay(thu_muc, argv=None):
    argv = sys.argv[1:] if argv is None else argv
    B = BaoCao()
    info = tang_1(thu_muc, B)
    if "--tinh" not in argv:
        if info:
            tang_2(thu_muc, info, B, "--anh" in argv)
        else:
            B.bo_qua("TANG 2 can tang 1 dat")
    print()
    if B.loi:
        print(DO + "[HONG]" + HET + " %d loi, %d nhac nho" % (len(B.loi), len(B.nhac_nho)))
        return 1
    print(XANH + "[DAT]" + HET + " 0 loi, %d nhac nho" % len(B.nhac_nho))
    return 0
