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
   - ban sao app.js / app.css khop nguon courses/engine/ (engine/sync.py)
   - cau-hinh.js khai bao khoaHoc, va backend/course-content/<khoaHoc>.json ton tai,
     doc duoc, cay muc luc chi tro toi bai co that
   - cu phap JS (node --check) neu co Node

TANG 2 — trinh duyet that, KHONG mock
   Dung uvicorn voi DB_URL tro vao mot SQLite tam, nap bundle bang
   tools/manage_courses.py, roi mo trang qua chinh route /webapp/… cua FastAPI —
   nen window.__WEBAPP_CONFIG__.apiBase duoc chen dung nhu khi deploy (API_PREFIX
   dat la /api/v1 de thu ca truong hop co tien to). Kiem: trang chu, muc luc,
   mo bai, bai tiep, tim kiem, tai lai (ETag -> 304), va KHONG co loi console.
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
import time
import urllib.parse
import urllib.request

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


class MayChuThu:
    """FastAPI that tren SQLite tam, da nap san cac bundle. Dung trong `with`.

        with MayChuThu([duong_dan_bundle]) as may:
            may.goc          # "http://127.0.0.1:PORT"
            may.api          # may.goc + API_PREFIX
    """

    def __init__(self, bundles, api_prefix="/api/v1"):
        self.bundles = list(bundles)
        self.api_prefix = api_prefix
        self.py = python_backend()
        self.proc = None
        self.tam = None

    def _env(self):
        env = dict(os.environ)
        env.update({
            "DB_URL": "sqlite+aiosqlite:///" + os.path.join(self.tam, "kiem.sqlite3").replace("\\", "/"),
            "TESTING": "false",
            "API_PREFIX": self.api_prefix,
            "COURSE_ADMIN_KEY": self.khoa_admin,
            "PYTHONIOENCODING": "utf-8",
        })
        return env

    def __enter__(self):
        if not self.py:
            raise RuntimeError("khong tim thay python co fastapi/uvicorn (backend/fastapi/.venv)")
        self.tam = tempfile.mkdtemp(prefix="kiem-khoa-hoc-")
        self.khoa_admin = secrets.token_hex(8)
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
    import sync
    ch = sync.doc_cau_hinh()
    tep = (ch.get("khoa_hoc") or {}).get("tep", [])
    lech = [t for t in tep if not os.path.exists(os.path.join(thu_muc, "assets", t))
            or open(os.path.join(thu_muc, "assets", t), encoding="utf-8", newline="").read() != sync.noi_dung_dich(t)]
    if lech:
        B.sai("ban sao engine lech nguon: %s — chay `python engine/sync.py`" % ", ".join(lech))
    else:
        B.ok("ban sao app.js / app.css khop courses/engine/")

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
        for f in ("assets/hien-thi.js", "assets/cau-hinh.js", "assets/app.js"):
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
            ca_bien(pg, may, info, url, order, yeu_cau, B)
            br.close()
        if loi:
            for l in loi[:8]:
                B.sai("console: " + l[:200])
        else:
            B.ok("khong co loi console / pageerror")
    finally:
        may.__exit__(None, None, None)


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
