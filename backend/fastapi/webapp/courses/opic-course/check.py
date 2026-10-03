#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra khoa OPIc.

    python check.py --tinh     # tang 1 + 2, khong can backend hay trinh duyet
    python check.py            # them tang 3: FastAPI that + SQLite tam + Chromium
    python check.py --anh      # tang 3 chup anh vao anh-kiem/

Noi dung OPIc nam trong database nhu moi khoa. Nguon soan thao o
backend/course-content/opic/ (content/ + build.py), bundle sinh ra o
backend/course-content/opic.json; trang tai /courses/opic/bundle tu API.

  TANG 1 — tinh, chi can Python
     - content/ doc duoc, du truong, id khong trung, lien ket {{script:..}} co that
     - opic.json khop content/ (chua chay lai build.py thi bao)
     - index.html nap dung logic.js -> ai-khach.js -> app.js -> pwa.js, KHONG con content.js
     - ban sao pwa.js / sw.js khop engine; manifest + bieu tuong (engine/tao_pwa.py)
     - cu phap JS (node --check) neu co Node
  TANG 2 — logic thuan trong Node: kiem-nhanh.js (doc opic.json qua OPICL.tuBundle)
  TANG 3 — FastAPI that tren SQLite tam (engine/kiem_khoa_hoc.MayChuThu), nap
            opic.json bang manage_courses.py, mo trang qua route /webapp/… cua
            FastAPI bang Chromium: di qua moi trang, che script, tien do, tim kiem,
            thi thu, luyen the, va KHONG co loi console. Doc offline: worker dieu
            khien trang, tat mang tai lai van mo, khong yeu cau nao toi may chu.
            AI nhan xet bai noi (Gemini GIA): ban ghi -> WAV 16 kHz -> /ai/opic -> the nhan xet.

Tra exit code khac 0 khi co loi.
"""
import base64
import json
import os
import re
import shutil
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
COURSES = os.path.dirname(HERE)
NGUON = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(COURSES))), "course-content", "opic")
BUNDLE = os.path.join(os.path.dirname(NGUON), "opic.json")
sys.path.insert(0, NGUON)
sys.path.insert(0, os.path.join(COURSES, "engine"))
import build  # noqa: E402  backend/course-content/opic/build.py
import kiem_khoa_hoc  # noqa: E402  courses/engine/kiem_khoa_hoc.py
import kiem_pwa  # noqa: E402  courses/engine/kiem_pwa.py

DO, XANH, VANG, MO, HET = kiem_khoa_hoc.DO, kiem_khoa_hoc.XANH, kiem_khoa_hoc.VANG, kiem_khoa_hoc.MO, kiem_khoa_hoc.HET
B = kiem_khoa_hoc.BaoCao()
ok, sai, nhac, bo_qua = B.ok, B.sai, B.nhac, B.bo_qua


# ---------------------------------------------------------------- tang 1
def tang_1():
    print("\nTANG 1 — tinh")
    payload, loi = build.doc_tat_ca()
    for l in loi:
        sai("noi dung: " + l)
    if not loi:
        s = payload["thongKe"]
        ok("content/: %d chu de · %d cau hoi · %d bai huong dan" % (s["chuDe"], s["cauHoi"], s["huongDan"]))

    if not os.path.exists(BUNDLE):
        sai("thieu backend/course-content/opic.json — chay python build.py trong backend/course-content/opic")
    elif not loi:
        try:
            co = json.load(open(BUNDLE, encoding="utf-8"))
            moi = build.bundle_tu_payload(payload)
            lech = [k for k in ("nav", "order", "docs", "stats") if co.get(k) != moi[k]]
            if lech:
                sai("opic.json lech content/ (%s) — chay lai build.py" % ", ".join(lech))
            else:
                ok("opic.json khop content/ (%.0f KB)" % (os.path.getsize(BUNDLE) / 1024.0))
        except ValueError as e:
            sai("opic.json khong doc duoc: %s" % e)

    html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    srcs = [s for s in re.findall(r'<script[^>]+src="([^"]+)"', html) if not s.startswith("http")]
    if srcs == ["assets/logic.js", "assets/ai-khach.js", "assets/app.js", "assets/pwa.js"]:
        ok("index.html nap logic.js -> ai-khach.js -> app.js -> pwa.js, khong con content.js")
    else:
        sai("thu tu <script> trong index.html: %s (can: logic.js, ai-khach.js, app.js, pwa.js)" % srcs)
    for dat, msg in kiem_pwa.tinh(HERE):
        (ok if dat else sai)(msg)
    for f in ("content.js", "content.json"):
        if os.path.exists(os.path.join(HERE, "assets", f)):
            sai("assets/%s van con — noi dung phai nam trong database" % f)

    try:
        m = json.load(open(os.path.join(HERE, "metadata.json"), encoding="utf-8"))
        miss = [k for k in ("title", "description", "category", "tags", "icon") if k not in m]
        (sai if miss else ok)("metadata.json %s" % ("thieu " + ", ".join(miss) if miss else "doc duoc"))
    except Exception as e:  # noqa: BLE001
        sai("metadata.json: %s" % e)

    node = shutil.which("node")
    if node:
        for f in ("assets/logic.js", "assets/ai-khach.js", "assets/app.js", "assets/pwa.js", "sw.js", "kiem-nhanh.js"):
            r = subprocess.run([node, "--check", os.path.join(HERE, f)], capture_output=True, text=True)
            (ok if r.returncode == 0 else sai)("cu phap %s%s" % (f, "" if r.returncode == 0 else ": " + r.stderr.strip()[-200:]))
    else:
        bo_qua("khong co Node — bo qua kiem cu phap JS")
    return bool(node)


# ---------------------------------------------------------------- tang 2
def tang_2():
    print("\nTANG 2 — logic thuan (node kiem-nhanh.js)")
    r = subprocess.run([shutil.which("node"), os.path.join(HERE, "kiem-nhanh.js")], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", cwd=HERE)
    out = (r.stdout or "") + (r.stderr or "")
    n_ok, n_sai = out.count("[ok]"), out.count("[SAI]")
    for line in out.splitlines():
        if "[SAI]" in line or "Error" in line:
            print("    " + line.strip())
    if r.returncode == 0 and not n_sai:
        ok("kiem-nhanh.js: %d phep kiem dat" % n_ok)
    else:
        sai("kiem-nhanh.js: %d dat, %d sai (exit %d)" % (n_ok, n_sai, r.returncode))


# ---------------------------------------------------------------- tang 3
TUYEN = [
    ("#/", "trang chu", ".hero"),
    ("#/huong-dan", "danh sach huong dan", ".lesson-li"),
    ("#/huong-dan/bay-dang-cau-hoi", "bai huong dan", ".md h2"),
    ("#/chu-de", "danh sach chu de", ".tcard"),
    ("#/chu-de/am-nhac", "trang chu de", ".qrow"),
    ("#/script/A01", "trang script", "#sent li"),
    ("#/script/AR11", "script co chi dan san khau", "#sent li.stage"),
    ("#/luyen", "luyen the", "#lBat"),
    ("#/thi-thu", "thi thu", "#tTao"),
    ("#/tien-do", "tien do", ".ptable"),
]


def tang_3(chup):
    print("\nTANG 3 — FastAPI that + SQLite tam + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        bo_qua("chua cai playwright: pip install playwright && python -m playwright install chromium")
        return
    if not kiem_khoa_hoc.python_backend():
        bo_qua("khong tim thay venv backend/fastapi/.venv co fastapi + uvicorn")
        return
    try:
        may = kiem_khoa_hoc.MayChuThu([BUNDLE]).__enter__()
    except Exception as e:  # noqa: BLE001
        sai("khong dung duoc may chu thu: %s" % e)
        return
    anh_dir = os.path.join(HERE, "anh-kiem")
    if chup:
        os.makedirs(anh_dir, exist_ok=True)
    loi_console, phan_hoi = [], []
    try:
        ok("uvicorn len tai %s (API_PREFIX=%s), da nap opic" % (may.goc, may.api_prefix))
        with sync_playwright() as p:
            try:
                br = p.chromium.launch()
            except Exception as e:  # noqa: BLE001
                bo_qua("khong mo duoc Chromium: %s" % str(e).splitlines()[0])
                return
            pg = br.new_page(viewport={"width": 1280, "height": 860})
            pg.on("console", lambda m: loi_console.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: loi_console.append("pageerror: %s" % e))
            pg.on("response", lambda r: phan_hoi.append((r.url, r.status, r.headers.get("content-length"),
                                                         r.headers.get("content-encoding"))))
            pg.goto(may.goc + "/webapp/courses/opic-course/?theme=light", wait_until="load")
            try:
                pg.wait_for_selector(".hero", timeout=20000)
            except Exception:
                sai("trang khong dung duoc tu API. Log may chu:\n" + may.doc_log()[-800:])
                return
            bun = [r for r in phan_hoi if "/courses/opic/bundle" in r[0]]
            if bun and bun[0][1] == 200:
                ok("tai /courses/opic/bundle: %.0f KB tren day (%s)" % (int(bun[0][2] or 0) / 1024.0, bun[0][3] or "khong nen"))
            else:
                sai("khong thay /courses/opic/bundle tra 200")
            if any(r[0].endswith("content.js") for r in phan_hoi):
                sai("trang van tai content.js")

            for hash_, ten, chon in TUYEN:
                pg.evaluate("h => { location.hash = h; }", hash_)
                try:
                    pg.wait_for_selector(chon, timeout=4000)
                    ok("%-28s %s" % (ten, hash_))
                except Exception:
                    sai("%s (%s): khong thay %s" % (ten, hash_, chon))
                if chup:
                    pg.screenshot(path=os.path.join(anh_dir, hash_.strip("#/").replace("/", "-") or "trang-chu") + ".png")

            pg.evaluate("() => { location.hash = '#/script/A01'; }")
            pg.wait_for_selector("#sent li")
            for mode in ("goi-y", "chu-cai-dau", "an-het", "day-du"):
                pg.click('#segCheDo button[data-v="%s"]' % mode)
            hid = pg.evaluate("() => document.querySelectorAll('#sent .w.hid').length")
            pg.click('#segCheDo button[data-v="goi-y"]')
            hid2 = pg.evaluate("() => document.querySelectorAll('#sent .w.hid').length")
            (ok if hid == 0 and hid2 > 0 else sai)("che do Goi y che %d tu, Day du khong che (%d)" % (hid2, hid))

            pg.click('.status button[data-s="2"]')
            pg.wait_for_timeout(100)
            pct = pg.evaluate("() => document.getElementById('hdrPct').textContent")
            (ok if pct != "0%" else sai)("danh dau 'Da thuoc' cap nhat vong tien do (%s)" % pct)

            pg.fill("#taToi", "Hi, my name is Test. I live in Hanoi.")
            pg.wait_for_timeout(450)
            luu = pg.evaluate("() => JSON.parse(localStorage.getItem('opic.cua-toi') || '{}')['A01']")
            (ok if luu and "Test" in luu else sai)("script cua toi tu luu vao localStorage")

            pg.keyboard.press("Control+K")
            pg.fill("#q", "nha cua")
            pg.wait_for_timeout(150)
            n = pg.evaluate("() => document.querySelectorAll('#res .sr').length")
            (ok if n > 0 else sai)("tim kiem 'nha cua' ra %d ket qua" % n)
            pg.keyboard.press("Escape")

            pg.evaluate("() => { location.hash = '#/thi-thu'; }")
            pg.wait_for_selector("#tTao")
            pg.click("#tTao")
            pg.wait_for_timeout(150)
            n = pg.evaluate("() => document.querySelectorAll('.ex-list li').length")
            (ok if n == 15 else sai)("thi thu sinh %d cau" % n)

            pg.evaluate("() => { location.hash = '#/luyen'; }")
            pg.wait_for_selector("#lBat")
            pg.click("#lBat")
            pg.wait_for_timeout(150)
            if pg.evaluate("() => !!document.querySelector('.fc .q')"):
                ok("luyen the mo duoc the dau tien")
                pg.click("#lHien")
                pg.click('#lGrade button[data-k="2"]')
                pg.wait_for_timeout(80)
                ok("cham the 'Thuoc' chuyen sang the ke")
            else:
                sai("luyen the khong mo duoc the")

            # tai lai: bundle xac thuc lai bang ETag (log may chu la su that)
            pg.reload(wait_until="load")
            pg.wait_for_selector(".hero, .fc, .wrap", timeout=20000)
            pg.wait_for_timeout(300)
            dong = [l for l in may.doc_log().splitlines() if "/courses/opic/bundle" in l]
            (ok if dong and "304" in dong[-1] else sai)(
                "tai lai: bundle %s" % ("tra 304 (ETag)" if dong and "304" in dong[-1] else "KHONG tra 304: " + (dong[-1].strip() if dong else "?")))

            if chup:
                pg.evaluate("() => { location.hash = '#/script/A09'; }")
                pg.wait_for_selector("#sent li")
                pg.screenshot(path=os.path.join(anh_dir, "script-A09.png"), full_page=True)
                pg.evaluate("() => { document.documentElement.setAttribute('data-theme','dark'); location.hash = '#/'; }")
                pg.wait_for_timeout(200)
                pg.screenshot(path=os.path.join(anh_dir, "trang-chu-toi.png"))

            # AI nhan xet bai noi (Gemini GIA): ban ghi WAV 2 giay dat thang vao IndexedDB, quan tri vien
            pg.evaluate("([k, t]) => localStorage.setItem(k, JSON.stringify(t))",
                        ["qlkh.phien@" + may.api + ".token", kiem_khoa_hoc.phien_quan_tri(may)])
            pg.evaluate("""() => new Promise((ok, hong) => {
                const hz = 8000, n = hz * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
                const chu = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
                chu(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); chu(8, 'WAVE'); chu(12, 'fmt ');
                v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, hz, true);
                v.setUint32(28, hz * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
                chu(36, 'data'); v.setUint32(40, n * 2, true);
                for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(8000 * Math.sin(i / 4)), true);
                const r = indexedDB.open('opic-ghi-am', 1);
                r.onupgradeneeded = () => r.result.createObjectStore('ban-ghi', {keyPath: 'id', autoIncrement: true}).createIndex('qid', 'qid');
                r.onsuccess = () => { const tx = r.result.transaction('ban-ghi', 'readwrite');
                  tx.objectStore('ban-ghi').add({qid: 'A01', luc: Date.now(), giay: 2, blob: new Blob([buf], {type: 'audio/wav'}), kieu: 'audio/wav'});
                  tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => hong(tx.error); };
                r.onerror = () => hong(r.error);
            })""")
            truoc = len(may.gemini.goi)
            pg.reload(wait_until="load")
            pg.evaluate("() => { location.hash = '#/script/A01'; }")
            try:
                pg.wait_for_selector("#dsGhi [data-ai]:not([hidden])", timeout=15000)
                pg.click("#dsGhi [data-ai]")
                pg.wait_for_selector("#aiOp .ai-op-diem", timeout=20000)
                gui = may.gemini.goi[truoc:]
                am = gui[-1]["body"]["contents"][0]["parts"][1]["inlineData"] if gui else {}
                wav = base64.b64decode(am.get("data", ""))
                dat = am.get("mimeType") == "audio/wav" and wav[:4] == b"RIFF" and wav[8:12] == b"WAVE" \
                    and abs(len(wav) - (44 + 16000 * 2 * 2)) < 2000
                (ok if dat and "Ước lượng" in pg.text_content("#aiOp") else sai)(
                    "AI nhan xet bai noi: ban ghi -> WAV 16 kHz mono (%d byte) -> the nhan xet" % len(wav))
            except Exception as e:  # noqa: BLE001
                sai("AI nhan xet bai noi: %s" % str(e).splitlines()[0])

            # doc offline: context moi, chua co worker
            ctx = br.new_context(viewport={"width": 1280, "height": 860})
            for dat, msg in kiem_pwa.trinh_duyet(ctx, ctx.new_page(), may.goc + "/webapp/courses/opic-course/?theme=light",
                                                 ".hero", may.so_yeu_cau):
                (ok if dat else sai)(msg)
            ctx.close()
            br.close()
    finally:
        may.__exit__(None, None, None)
    if loi_console:
        for l in loi_console[:8]:
            sai("console: " + l[:160])
    else:
        ok("khong co loi console / pageerror")
    if chup:
        ok("anh chup trong anh-kiem/")


def main():
    args = sys.argv[1:]
    co_node = tang_1()
    if co_node:
        tang_2()
    else:
        bo_qua("TANG 2 can Node")
    if "--tinh" not in args:
        tang_3("--anh" in args)
    print()
    if B.loi:
        print(DO + "[HONG]" + HET + " %d loi, %d nhac nho" % (len(B.loi), len(B.nhac_nho)))
        sys.exit(1)
    print(XANH + "[DAT]" + HET + " 0 loi, %d nhac nho" % len(B.nhac_nho))


if __name__ == "__main__":
    main()
