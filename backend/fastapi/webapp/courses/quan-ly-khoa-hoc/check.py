#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra trang Quan ly khoa hoc tren FastAPI that (SQLite tam) bang Chromium.

    python check.py            # can playwright + venv backend/fastapi/.venv
    python check.py --anh      # chup anh vao _shots/

Moi thao tac tren giao dien deu duoc DOI CHIEU bang API (GET /courses/…): kiem
rang thay doi da vao database, khong chi la giao dien trong co ve dung.
"""
import json
import os
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "engine"))
import kiem_khoa_hoc as K  # noqa: E402

B = K.BaoCao()
ok, sai = B.ok, B.sai

#: Noi dung gio sua duoc qua API, nen markdown khong con la tep tin cay trong repo.
#: Moi dong la mot cach chay ma pho bien; dong <details> la HTML vo hai phai giu.
DOC_DOC_HAI = (
    "# Bai thu bao mat\n\n<details><summary>Mo</summary>noi dung an</details>\n\n"
    # anh hong (data: khong giai ma duoc) van ban onerror, nhung khong tao request 404 nao
    "<img src=\"data:image/png;base64,AAAA\" onerror=\"window.__xss='img'\">\n\n<script>window.__xss='script'</script>\n\n"
    "<svg onload=\"window.__xss='svg'\"><circle r=2></circle></svg>\n\n"
    "<iframe src=\"javascript:parent.__xss='iframe'\"></iframe>\n\n"
    "[bam](javascript:window.__xss='link') va <a href=\" JaVaScRiPt:window.__xss='a2'\">x</a>\n\n"
    "<p onclick=\"window.__xss='click'\" id=\"pclick\">doan co onclick</p>\n"
)
KIEM_DOC_HAI = """() => ({
    xss: window.__xss || null,
    details: !!document.querySelector('ROOT details summary'),
    nguyHiem: document.querySelectorAll('ROOT script, ROOT iframe').length
      + [...document.querySelectorAll('ROOT *')].filter(e => [...e.attributes].some(a => a.name.startsWith('on'))).length
      + [...document.querySelectorAll('ROOT a')].filter(a => /javascript/i.test(a.getAttribute('href') || '')).length
})"""


def lay(may, path, headers=None):
    req = urllib.request.Request(may.api + path, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        return e.code, None


def main():
    chup = "--anh" in sys.argv
    print("\nQuan ly khoa hoc — FastAPI that + SQLite tam + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        B.bo_qua("chua cai playwright")
        return 0
    bundle = os.path.join(K.CONTENT, "system-design.json")
    nho = {
        "course": {"slug": "nap-thu", "title": "Khoá nạp thử", "icon": "🧪"},
        "nav": [{"id": "chinh", "title": "Chính", "groups": [{"title": "Nhóm A", "short": "A", "items": ["a/1.md"]}]}],
        "docs": {"a/1.md": {"id": "a/1.md", "slug": "a-1", "title": "Bài một", "md": "# Bài một\n\nNội dung.\n"}},
    }
    tep_nho = os.path.join(tempfile.mkdtemp(prefix="qlkh-"), "nap-thu.json")
    with open(tep_nho, "w", encoding="utf-8") as f:
        json.dump(nho, f, ensure_ascii=False)

    may = K.MayChuThu([bundle]).__enter__()
    admin = {"X-Admin-Key": may.khoa_admin}
    loi = []
    dap = []                       # tra loi cho prompt/confirm, lan luot

    def hop_thoai(d):
        v = dap.pop(0) if dap else None
        if v is False:
            d.dismiss()
        elif v is None:
            d.accept()
        else:
            d.accept(v)

    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page(viewport={"width": 1366, "height": 900}, accept_downloads=True)
            # Lan dang nhap sai khoa o buoc 1 la CO Y: Chromium ghi "Failed to load
            # resource: 403" cho no. Chi bo qua dung loi do (theo URL), khong bo qua moi 403.
            pg.on("console", lambda m: loi.append(m.text) if m.type == "error" and not (
                "403" in m.text and (m.location or {}).get("url", "").endswith("/courses/admin/verify")) else None)
            pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
            pg.on("dialog", hop_thoai)
            pg.goto(may.goc + "/webapp/courses/quan-ly-khoa-hoc/?theme=light")

            # 1. dang nhap
            pg.wait_for_selector("#login:not([hidden])")
            pg.fill("#inpKey", "sai-khoa")
            pg.click("#frmLogin button")
            pg.wait_for_selector("#loginErr:not([hidden])")
            ok("khoa sai bi tu choi")
            pg.fill("#inpKey", may.khoa_admin)
            pg.click("#frmLogin button")
            pg.wait_for_selector("#app:not([hidden]) .ci")
            # token cat theo dung may chu da cap no: "qlkh.phien@<goc API>.token"
            tok = pg.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('qlkh.phien@')"
                              " && k.endsWith('.token')).map(k => JSON.parse(localStorage.getItem(k)))[0]")
            (ok if tok and may.khoa_admin not in tok else sai)("dang nhap: trinh duyet giu token phien, khong giu khoa")

            # 2. chon khoa, sua thong tin, an ban nhap
            pg.click('.ci[data-slug="system-design"]')
            pg.wait_for_selector("#fSub")
            try:
                pg.wait_for_selector("#lkRieng a", timeout=10000)
                rieng = pg.get_attribute("#lkRieng a", "href")
            except Exception:  # noqa: BLE001
                rieng = None
            (ok if rieng == "/webapp/courses/system-design-course/" and
             pg.get_attribute("#lkDoc", "href") == "../khoa-hoc/?khoa=system-design" else sai)(
                "khoa co trang rieng: nut 'Trang rieng' (%s) + nut trang doc chung" % rieng)
            pg.fill("#fSub", "Phụ đề sửa từ trang quản lý")
            pg.uncheck("#fPub")
            pg.click("#bLuu")
            pg.wait_for_selector(".chip.wa")
            st, c = lay(may, "/courses/system-design", admin)
            (ok if c and c["subtitle"] == "Phụ đề sửa từ trang quản lý" and c["published"] is False else sai)(
                "luu thong tin + chuyen thanh nhap (doi chieu API)")
            st, _ = lay(may, "/courses/system-design/manifest")
            (ok if st == 404 else sai)("ban nhap an khoi API cong khai (manifest %s)" % st)
            pg.check("#fPub")
            pg.click("#bLuu")
            pg.wait_for_selector(".chip.ok")
            if chup:
                os.makedirs(os.path.join(HERE, "_shots"), exist_ok=True)
                pg.screenshot(path=os.path.join(HERE, "_shots", "ql-thong-tin.png"))

            # 3. cau truc: dua nhom thu hai len dau, luu
            pg.click('.tab[data-tab="tree"]')
            pg.wait_for_selector("#tree .grp")
            truoc = lay(may, "/courses/system-design", admin)[1]["nav"][0]["groups"]
            pg.click('.grp:nth-child(3) .grp-h button[data-op="len"]')        # nhom thu 2 cua section 1 (sau .sec-h)
            pg.wait_for_selector(".bar.dirty")
            pg.click("#bLuuCay")
            pg.wait_for_selector(".bar:not(.dirty)")
            sau = lay(may, "/courses/system-design", admin)[1]["nav"][0]["groups"]
            (ok if [g["title"] for g in sau[:2]] == [truoc[1]["title"], truoc[0]["title"]] else sai)(
                "doi thu tu nhom va luu cau truc (doi chieu API)")

            # 4. mo bai, sua markdown, luu
            dau = sau[0]["items"][0]
            pg.click('.di[data-id="%s"] .t' % dau)      # tieu de, khong phai nut dieu khien cua dong
            pg.wait_for_selector("#eMd")
            md_cu = pg.input_value("#eMd")
            pg.fill("#eMd", md_cu + "\n\nDòng thêm từ trang quản lý.\n")
            pg.click("#eXem")
            pg.wait_for_selector("#ePrev")
            (ok if "Dòng thêm từ trang quản lý" in pg.inner_text("#ePrev") else sai)("xem truoc markdown")
            pg.click("#eLuu")
            pg.wait_for_timeout(600)
            d = lay(may, "/courses/system-design/docs/" + dau)[1]
            (ok if d and d["md"].rstrip().endswith("Dòng thêm từ trang quản lý.") else sai)("sua va luu bai (doi chieu API)")

            # 5. bai moi trong nhom dau, roi xoa
            dap[:] = ["moi/bai-thu.md"]
            pg.click('.grp:nth-child(2) .grp-h button[data-op="baiMoi"]')
            pg.wait_for_selector("#eId:not([disabled])")
            pg.fill("#eMd", "# Bài thử mới\n\nNội dung bài mới.\n")
            pg.click("#eLuu")
            pg.wait_for_selector('.di[data-id="moi/bai-thu.md"]')
            m = lay(may, "/courses/system-design/manifest")[1]
            (ok if m["nav"][0]["groups"][0]["items"][-1] == "moi/bai-thu.md" and m["docs"]["moi/bai-thu.md"]["title"] == "Bài thử mới"
             else sai)("tao bai moi o cuoi nhom, tieu de lay tu H1 (doi chieu API)")
            dap[:] = [None]
            pg.click("#eXoa")
            pg.wait_for_function("() => !document.querySelector('.di[data-id=\"moi/bai-thu.md\"]')")
            (ok if lay(may, "/courses/system-design/docs/moi/bai-thu.md")[0] == 404 else sai)("xoa bai (doi chieu API)")
            if chup:
                pg.click('.di[data-id="%s"] .t' % dau)
                pg.wait_for_selector("#eMd")
                pg.screenshot(path=os.path.join(HERE, "_shots", "ql-cau-truc.png"))

            # 6. tim kiem thu
            pg.click('.tab[data-tab="search"]')
            pg.fill("#tQ", "cache")
            pg.click("#tTim")
            pg.wait_for_selector("#tKq li[data-id]")
            ok("tim kiem thu ra %d ket qua" % pg.evaluate("() => document.querySelectorAll('#tKq li[data-id]').length"))

            # 7. xuat bundle
            pg.click('.tab[data-tab="info"]')
            with pg.expect_download() as dl:
                pg.click("#bXuat")
            out = dl.value.path()
            data = json.load(open(out, encoding="utf-8"))
            (ok if len(data["docs"]) == 80 and data["course"]["slug"] == "system-design" else sai)(
                "xuat bundle: %d bai" % len(data["docs"]))

            # 8. tao khoa moi
            pg.click("#btnNew")
            pg.fill("#nSlug", "khoa-moi")
            pg.fill("#nTitle", "Khoá mới từ trang quản lý")
            pg.click("#nTao")
            pg.wait_for_selector('.ci[data-slug="khoa-moi"]')
            st, c = lay(may, "/courses/khoa-moi", admin)
            (ok if st == 200 and c["published"] is False else sai)("tao khoa moi (nhap) — doi chieu API")
            pg.wait_for_selector("#lkDoc")
            href = pg.get_attribute("#lkDoc", "href")
            (ok if href == "../khoa-hoc/?khoa=khoa-moi&nhap=1" else sai)(
                "khoa vua tao co ngay link sang trang doc chung (%s)" % href)

            # 9. nap bundle nho tu tep
            pg.set_input_files("#inpImport", tep_nho)
            pg.wait_for_selector('.ci[data-slug="nap-thu"]')
            st, m2 = lay(may, "/courses/nap-thu/manifest")
            (ok if st == 200 and m2["order"] == ["a/1.md"] else sai)("nap bundle tu tep (doi chieu API)")

            # 10. xoa khoa (phai go lai slug)
            dap[:] = ["sai-slug"]
            pg.click("#bXoa")
            pg.wait_for_timeout(300)
            (ok if lay(may, "/courses/nap-thu", admin)[0] == 200 else sai)("go sai slug thi khong xoa")
            dap[:] = ["nap-thu"]
            pg.click("#bXoa")
            pg.wait_for_function("() => !document.querySelector('.ci[data-slug=\"nap-thu\"]')")
            (ok if lay(may, "/courses/nap-thu", admin)[0] == 404 else sai)("xoa khoa (doi chieu API)")

            # 11. tai lai trang: phien con, khong phai dang nhap lai
            pg.reload()
            pg.wait_for_selector("#app:not([hidden]) .ci")
            ok("tai lai trang: phien duoc lam moi, khong phai nhap lai khoa")

            # 12. an toan: markdown doc hai khong duoc chay tren trang khoa hoc lan xem truoc.
            #     Doi chung am: cung payload gan thang vao innerHTML thi CO chay — chung minh
            #     phep thu bat duoc loi neu bo loc bi go.
            req = urllib.request.Request(
                may.api + "/courses/system-design/docs/bao-mat/thu.md", method="PUT",
                data=json.dumps({"md": DOC_DOC_HAI, "section": "khoa-hoc", "group": sau[0]["title"]}).encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Admin-Key": may.khoa_admin})
            urllib.request.urlopen(req).close()
            trang = br.new_page()
            hop = []
            trang.on("dialog", lambda d: (hop.append(d.message), d.dismiss()))
            trang.goto(may.goc + "/webapp/courses/system-design-course/#/bao-mat/thu")
            trang.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                                    " return b && b.textContent.includes('doan co onclick'); }", timeout=15000)
            trang.wait_for_timeout(700)
            trang.click("#pclick")
            kq = trang.evaluate(KIEM_DOC_HAI.replace("ROOT", "#body"))
            (ok if kq["xss"] is None and not hop and kq["details"] and kq["nguyHiem"] == 0 else sai)(
                "trang khoa hoc go phan chay ma khoi markdown, giu <details> (%s)" % kq)
            trang.evaluate("() => { const d = document.createElement('div');"
                           " d.innerHTML = '<img src=x onerror=\"window.__doiChung=1\">'; }")
            trang.wait_for_timeout(500)
            (ok if trang.evaluate("() => window.__doiChung === 1") else sai)(
                "doi chung am: innerHTML tho thi payload CO chay (phep thu co hieu luc)")
            trang.close()
            pg.click('.ci[data-slug="system-design"]')            # sau khi tai lai, chua chon khoa nao
            pg.wait_for_selector('.tab[data-tab="tree"]')
            pg.click('.tab[data-tab="tree"]')
            pg.wait_for_selector('.di[data-id="bao-mat/thu.md"] .t')
            pg.click('.di[data-id="bao-mat/thu.md"] .t')
            pg.wait_for_selector("#eMd")
            pg.click("#eXem")
            pg.wait_for_selector("#ePrev details")
            pg.wait_for_timeout(500)
            kq = pg.evaluate(KIEM_DOC_HAI.replace("ROOT", "#ePrev"))
            (ok if kq["xss"] is None and kq["nguyHiem"] == 0 else sai)("xem truoc o trang quan ly cung duoc loc (%s)" % kq)

            # 13. ?api= tro ra may chu la (ban review: mo link la gui token phien di, khong can bam):
            #     bi bo qua — trang van dung API cung origin va token khong roi khoi may chu da cap.
            #     Dung lai chinh trang `pg` (buoc cuoi): no co san token phien trong localStorage.
            ra_ngoai = []
            pg.on("request", lambda r: ra_ngoai.append(r.url)
                  if urllib.parse.urlsplit(r.url).hostname == "evil.invalid" else None)
            pg.goto(may.goc + "/webapp/courses/quan-ly-khoa-hoc/?api=" + urllib.parse.quote("https://evil.invalid", safe=""))
            try:
                pg.wait_for_selector("#app:not([hidden]) .ci", timeout=15000)
                vao = True
            except Exception:  # noqa: BLE001
                vao = False
            (ok if vao and not ra_ngoai else sai)(
                "?api=https://evil.invalid bi bo qua: token o lai may chu, trang van vao bang API cung origin"
                + ("" if not ra_ngoai else " — DA GUI TOI: %s" % ra_ngoai[:2]))

            # 14. di theo link cua khoa vua tao (ban nhap, token phien cua trang nay): trang doc chung mo duoc
            pg.goto(may.goc + "/webapp/courses/quan-ly-khoa-hoc/" + href)
            try:
                pg.wait_for_selector(".hero h1", timeout=15000)
                h1 = pg.evaluate("() => document.querySelector('.hero h1').textContent")
            except Exception:  # noqa: BLE001
                h1 = ""
            (ok if "Khoá mới từ trang quản lý" in h1 else sai)(
                "di theo link: trang doc chung hien khoa vua tao, ca khi con la nhap (%r)" % h1)
            br.close()
    finally:
        may.__exit__(None, None, None)
    if loi:
        for l in loi[:8]:
            sai("console: " + l[:200])
    else:
        ok("khong co loi console / pageerror")
    print()
    if B.loi:
        print(K.DO + "[HONG]" + K.HET + " %d loi" % len(B.loi))
        return 1
    print(K.XANH + "[DAT]" + K.HET + " 0 loi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
