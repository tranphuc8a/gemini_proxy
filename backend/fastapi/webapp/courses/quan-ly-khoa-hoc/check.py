#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra trang Quan ly khoa hoc tren FastAPI that (SQLite tam) bang Chromium.

    python check.py            # can playwright + venv backend/fastapi/.venv
    python check.py --anh      # chup anh vao _shots/

Moi thao tac tren giao dien deu duoc DOI CHIEU bang API (GET /courses/…): kiem
rang thay doi da vao database, khong chi la giao dien trong co ve dung. Cac buoc
ghi ma QA-xx la loi tim thay o dot kiem thu (docs/kiem-thu-quan-ly-khoa-hoc.md),
giu lai o day de khong tai phat.
"""
import base64
import json
import os
import sys
import tempfile
import time
import traceback
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
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
DA_LUU = "() => { const t = document.querySelector('#eTT'); return !!t && t.textContent.includes('đã lưu'); }"
NEN = "() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]"


# ------------------------------------------------------------ tien ich

def goi(may, method, path, body=None, headers=None):
    h = dict(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(may.api + path, headers=h, data=data, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "null")
        except Exception:  # noqa: BLE001
            return e.code, None


def lay(may, path, headers=None):
    return goi(may, "GET", path, headers=headers)


def doi(dieu_kien, giay=10.0):
    """Hoi lai (API) toi khi dieu kien dung — cho thao tac giao dien chay ngam."""
    het = time.time() + giay
    while time.time() < het:
        v = dieu_kien()
        if v:
            return v
        time.sleep(0.2)
    return dieu_kien()


def cho(pg, js, arg=None, timeout=10000):
    """Doi mot dieu kien JS tren trang; True neu dat trong thoi han (khong nem loi)."""
    try:
        pg.wait_for_function(js, arg=arg, timeout=timeout)
        return True
    except Exception:  # noqa: BLE001
        return False


def cho_khoa(pg, slug, timeout=15000):
    """Danh sach khoa ve TRUOC, phan dau khoa ve SAU (hai request): doi phan dau."""
    return cho(pg, "s => { const a = document.querySelector('#lkDoc');"
                   " return !!a && new URL(a.href).searchParams.get('khoa') === s; }", slug, timeout)


def cho_bai(pg, doc_id, timeout=15000):
    return cho(pg, "id => { const e = document.querySelector('#eId'); return !!e && e.value === id; }", doc_id, timeout)


def hop_thoai(pg, gia_tri=None, nut="submit", timeout=8000):
    """Dien hop thoai cua trang (khong phai prompt cua trinh duyet) roi bam nut."""
    pg.wait_for_selector(".dlg", timeout=timeout)
    for ten, v in (gia_tri or {}).items():
        el = pg.locator('.dlg [data-ten="%s"]' % ten)
        if el.get_attribute("type") == "checkbox":
            el.set_checked(bool(v))
        elif el.evaluate("e => e.tagName") == "SELECT":
            el.select_option(v)
        else:
            el.fill(v)
    if nut == "submit":
        pg.click(".dlg [type=submit]")
    elif nut == "huy":
        pg.click(".dlg [data-huy]")
    else:
        pg.click('.dlg [data-lua="%s"]' % nut)


def cho_het_dlg(pg):
    pg.wait_for_selector(".dlg-lop", state="detached", timeout=10000)


def menu(pg, muc):
    pg.click("#eThem")
    pg.click('.menu-noi [data-m="%s"]' % muc)


# ------------------------------------------------------------ kich ban

def kich_ban(pw, may, tep_nho, tep_anh, chup, anh, loi):
    admin = {"X-Admin-Key": may.khoa_admin}
    QL = may.goc + "/webapp/courses/quan-ly-khoa-hoc/"
    SD = "/courses/system-design"

    def ghi_loi(m):
        if m.type != "error":
            return
        url = (m.location or {}).get("url", "")
        # 4xx CO Y: khoa sai (verify), het phien gia lap (docs), xung dot co y (409)
        if ("403" in m.text and ("/courses/admin/verify" in url or "/docs/" in url)) or "409" in m.text:
            return
        loi.append(m.text + " @ " + url)

    def anh_chup(trang, ten):
        if chup:
            os.makedirs(anh, exist_ok=True)
            trang.screenshot(path=os.path.join(anh, ten))

    st, _ = goi(may, "POST", "/courses", {"slug": "phu", "title": "Khoá phụ", "published": True}, admin)
    if st >= 300:
        sai("tao khoa phu qua API: HTTP %s" % st)

    br = pw.chromium.launch()
    try:
        ctx = br.new_context(viewport={"width": 1366, "height": 900}, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("console", ghi_loi)
        pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
        pg.on("dialog", lambda d: d.accept())      # chi con beforeunload; moi hop thoai khac la cua trang
        pg.goto(QL + "?theme=light")

        # 1. dang nhap — khoa doi lay token phien, trinh duyet khong giu khoa
        pg.wait_for_selector("#login:not([hidden])")
        pg.fill("#inpKey", "sai-khoa")
        pg.press("#inpKey", "Enter")
        pg.wait_for_selector("#loginErr:not([hidden])")
        thong_bao = pg.text_content("#loginErr")
        (ok if thong_bao == "Khoá không đúng." else sai)("khoa sai bi tu choi, thong bao tieng Viet (%r)" % thong_bao)
        pg.fill("#inpKey", may.khoa_admin)
        pg.press("#inpKey", "Enter")
        pg.wait_for_selector("#app:not([hidden]) .ci")
        giu_khoa = pg.evaluate("k => Object.keys(localStorage).some(x => (localStorage.getItem(x) || '').includes(k))", may.khoa_admin)
        co_token = pg.evaluate("() => Object.keys(localStorage).some(k => k.startsWith('qlkh.phien@') && k.endsWith('.token'))")
        (ok if co_token and not giu_khoa else sai)("dang nhap: localStorage giu token phien theo may chu, khong giu khoa")

        # 2. QA-13 chon khoa bang ban phim; QA-08 URL theo khoa / tab
        pg.focus('.ci[data-slug="system-design"]')
        pg.keyboard.press("Enter")
        cho_khoa(pg, "system-design")
        pg.wait_for_selector("#fSub")
        (ok if pg.url.endswith("#/system-design/info") and pg.get_attribute("#tabBody", "role") == "tabpanel" else sai)(
            "chon khoa bang ban phim (QA-13); URL = %s" % pg.url.split("#")[-1])
        try:
            pg.wait_for_selector("#lkRieng a", timeout=10000)
            rieng = pg.get_attribute("#lkRieng a", "href")
        except Exception:  # noqa: BLE001
            rieng = None
        (ok if rieng == "/webapp/courses/system-design-course/" and
         pg.get_attribute("#lkDoc", "href") == "../khoa-hoc/?khoa=system-design" else sai)(
            "khoa co trang rieng: nut 'Trang rieng' (%s) + nut trang doc chung" % rieng)
        anh_chup(pg, "thong-tin.png")

        # 3. QA-03 sua thong tin do dang roi doi khoa -> hoi; huy -> giu nguyen
        pg.fill("#fSub", "Phụ đề sửa từ trang quản lý")
        (ok if "dirty" in (pg.get_attribute("#infoBar", "class") or "") else sai)("tab Thong tin: thanh trang thai bao 'chua luu'")
        pg.click('.ci[data-slug="phu"]')
        pg.wait_for_selector(".dlg")
        (ok if "thông tin khoá" in pg.text_content(".dlg") else sai)("doi khoa khi dang sua thong tin: hoi truoc (QA-03)")
        hop_thoai(pg, nut="huy")
        cho_het_dlg(pg)
        (ok if pg.input_value("#fSub") == "Phụ đề sửa từ trang quản lý" and pg.url.endswith("#/system-design/info") else sai)(
            "huy -> van o khoa cu, phan dang sua con nguyen")

        # 4. luu thong tin, chuyen thanh nhap; cau hinh sai bao ngay canh o
        cfg0 = pg.input_value("#fCfg")
        pg.fill("#fCfg", "[1, 2]")
        sai_cfg = pg.is_visible("#cfgLoi")
        pg.fill("#fCfg", cfg0)
        (ok if sai_cfg and not pg.is_visible("#cfgLoi") else sai)("cau hinh khong phai object JSON: bao loi ngay canh o, sua lai thi het")
        pg.uncheck("#fPub")
        pg.click("#bLuu")
        pg.wait_for_selector(".ch .chip.wa")
        st, c = lay(may, SD, admin)
        (ok if c and c["subtitle"] == "Phụ đề sửa từ trang quản lý" and c["published"] is False
         and (c.get("config") or {}).get("tags") else sai)("luu thong tin + chuyen thanh nhap, cau hinh giu nguyen (doi chieu API)")
        st, _ = lay(may, SD + "/manifest")
        (ok if st == 404 else sai)("ban nhap an khoi API cong khai (manifest %s)" % st)

        # 5. QA-01 (thong tin): nguoi khac vua luu -> hoi, khong ghi de im lang
        goi(may, "PATCH", SD, {"subtitle": "Phụ đề của người khác"}, admin)
        pg.check("#fPub")
        pg.click("#bLuu")
        pg.wait_for_selector(".dlg")
        (ok if "nơi khác" in pg.text_content(".dlg") else sai)("thong tin: nguoi khac vua luu -> hoi, khong ghi de (QA-01)")
        hop_thoai(pg, nut="0")                         # tai ban tren server
        cho_het_dlg(pg)
        (ok if cho(pg, "() => { const e = document.querySelector('#fSub'); return !!e && e.value === 'Phụ đề của người khác'; }")
         else sai)("chon 'tai ban tren server' -> thay ban moi")
        pg.check("#fPub")
        pg.click("#bLuu")
        pg.wait_for_selector(".ch .chip.ok")

        # 6. QA-19 tim kiem thu: to sang tu khoa, bam ket qua mo bai trong cay
        pg.click('.tab[data-tab="search"]')
        pg.fill("#tQ", "kiem tra dau vao")
        pg.press("#tQ", "Enter")
        pg.wait_for_selector("#tKq .hit")
        hit = pg.evaluate("() => { const b = document.querySelector('#tKq .hit');"
                          " return {id: b.dataset.id, mark: b.querySelector('mark') ? b.querySelector('mark').textContent : ''}; }")
        (ok if hit["mark"] else sai)("tim kiem thu: to sang tu khoa trong ket qua (%r)" % hit["mark"])
        pg.click("#tKq .hit >> nth=0")
        (ok if cho_bai(pg, hit["id"]) and pg.url.endswith("#/system-design/tree/" + hit["id"]) else sai)(
            "bam ket qua -> tab Cau truc, mo dung bai, URL co id bai")

        # 7. QA-02 cay chua luu + ↻ -> hoi; keo-tha nhom va bai; loc; thu gon
        pg.wait_for_selector(".di .t")
        (ok if pg.eval_on_selector_all("#tree select", "e => e.length") == 0 else sai)("cay khong con <select> nao tren moi dong (QA-17)")
        pg.click('.di[data-s="0"][data-g="0"][data-i="0"] [data-op="xuong"]')
        pg.wait_for_selector("#treeBar.dirty")
        tieu_diem = pg.evaluate("() => { const a = document.activeElement, r = a && a.closest('.di');"
                                " return a && a.dataset.op === 'xuong' && r ? r.dataset.i : null; }")
        (ok if tieu_diem == "1" else sai)("↓ giu tieu diem theo dong vua chuyen — bam tiep bang ban phim duoc (%s)" % tieu_diem)
        pg.click("#btnReload")
        pg.wait_for_selector(".dlg")
        (ok if "cấu trúc mục lục" in pg.text_content(".dlg") else sai)("↻ khi cay chua luu: hoi truoc (QA-02)")
        hop_thoai(pg, nut="huy")
        cho_het_dlg(pg)
        (ok if pg.is_visible("#treeBar.dirty") else sai)("huy -> thay doi cay con nguyen")
        pg.click("#bHuy")
        pg.wait_for_selector("#treeBar:not(.dirty)")

        _, truoc = lay(may, SD, admin)
        g0, g1 = [g["title"] for g in truoc["nav"][0]["groups"][:2]]
        pg.drag_and_drop('.grp-h[data-s="0"][data-g="1"] .nm', '.grp-h[data-s="0"][data-g="0"]', target_position={"x": 40, "y": 3})
        if cho(pg, "() => !!document.querySelector('#treeBar.dirty')", timeout=5000):
            pg.click("#bLuuCay")
            pg.wait_for_selector("#treeBar:not(.dirty)")
        _, sau = lay(may, SD, admin)
        (ok if [g["title"] for g in sau["nav"][0]["groups"][:2]] == [g1, g0] else sai)(
            "keo-tha nhom len dau + luu cau truc (doi chieu API)")
        id_keo = sau["nav"][0]["groups"][0]["items"][0]
        pg.drag_and_drop('.di[data-id="%s"] .keo' % id_keo, '.grp-h[data-s="0"][data-g="1"]')
        if cho(pg, "() => !!document.querySelector('#treeBar.dirty')", timeout=5000):
            pg.click("#bLuuCay")
            pg.wait_for_selector("#treeBar:not(.dirty)")
        _, sau2 = lay(may, SD, admin)
        (ok if sau2["nav"][0]["groups"][1]["items"][-1] == id_keo and id_keo not in sau2["nav"][0]["groups"][0]["items"] else sai)(
            "keo-tha bai sang nhom khac (doi chieu API)")
        pg.fill("#locBai", "kiem tra dau")
        hien = pg.eval_on_selector_all(".di .t", "e => e.map(x => x.textContent)")
        (ok if hien and all("Kiểm tra đầu" in h for h in hien) else sai)("o loc bai, go khong dau: con %d bai khop %s" % (len(hien), hien[:3]))
        pg.fill("#locBai", "")
        n_truoc = pg.eval_on_selector_all(".di", "e => e.length")
        pg.click('.grp-h[data-s="0"][data-g="0"] [data-op="tg"]')
        n_sau = pg.eval_on_selector_all(".di", "e => e.length")
        pg.click('.grp-h[data-s="0"][data-g="0"] [data-op="tg"]')
        (ok if n_sau < n_truoc == pg.eval_on_selector_all(".di", "e => e.length") else sai)(
            "thu gon / mo nhom: %d -> %d dong" % (n_truoc, n_sau))

        # 8. QA-11 section moi qua hop thoai, kiem id tai cho; them nhom
        pg.click("#bThemSec")
        pg.wait_for_selector(".dlg")
        pg.fill('.dlg [data-ten="title"]', "Phần phụ lục")
        (ok if pg.input_value('.dlg [data-ten="id"]') == "phan-phu-luc" else sai)("id section tu sinh tu tieu de, bo dau")
        pg.fill('.dlg [data-ten="id"]', "Phần 1")
        pg.click(".dlg [type=submit]")
        (ok if pg.is_visible('.dlg [data-loi="id"]') else sai)("id section sai -> bao loi ngay, hop thoai van mo (QA-11)")
        pg.fill('.dlg [data-ten="id"]', "phu-luc")
        pg.select_option('.dlg [data-ten="icon"]', "layers")
        pg.click(".dlg [type=submit]")
        cho_het_dlg(pg)
        so_sec = len(sau2["nav"])
        pg.click('.sec-h[data-s="%d"] [data-op="themNhom"]' % so_sec)
        hop_thoai(pg, {"title": "Bắt đầu nhanh", "short": "Bắt đầu nhanh"})
        cho_het_dlg(pg)
        pg.click("#bLuuCay")
        pg.wait_for_selector("#treeBar:not(.dirty)")
        _, s3 = lay(may, SD, admin)
        moi = s3["nav"][-1]
        (ok if moi["id"] == "phu-luc" and moi["icon"] == "layers" and moi["groups"][0]["title"] == "Bắt đầu nhanh" else sai)(
            "them section (co icon) + nhom bang hop thoai (doi chieu API)")

        # 9. QA-07 bai moi: id goi y bo dau, khong trung
        pg.click('.grp-h[data-s="%d"][data-g="0"] [data-op="baiMoi"]' % so_sec)
        pg.wait_for_selector(".dlg")
        pg.fill('.dlg [data-ten="title"]', "Bài đầu tiên")
        id1 = pg.input_value('.dlg [data-ten="id"]')
        (ok if id1 == "bat-dau-nhanh/bai-dau-tien.md" else sai)("id bai goi y bo dau tieng Viet: %s (QA-07)" % id1)
        pg.click(".dlg [type=submit]")
        cho_het_dlg(pg)
        cho_bai(pg, id1)
        st, d1 = lay(may, SD + "/docs/" + id1, admin)
        (ok if st == 200 and d1["group"] == "Bắt đầu nhanh" else sai)("tao bai moi vao dung nhom (doi chieu API)")
        pg.click('.grp-h[data-s="%d"][data-g="0"] [data-op="baiMoi"]' % so_sec)
        pg.wait_for_selector(".dlg")
        pg.fill('.dlg [data-ten="title"]', "Bài đầu tiên")
        id2 = pg.input_value('.dlg [data-ten="id"]')
        (ok if id2 != id1 and id2.startswith("bat-dau-nhanh/") else sai)("bai thu hai cung tieu de: id goi y khong trung (%s)" % id2)
        hop_thoai(pg, nut="huy")
        cho_het_dlg(pg)

        # 10. QA-14 xem truoc dung bo dung cua trang doc; QA-18 Ctrl+S
        pg.click('[data-che-do="chia"]')
        pg.fill("#eMd", "# Bài đầu tiên\n\n## Công thức\n\nĐộ dài $a^2+b^2=c^2$.\n\n> 📌 Ghi nhớ điều này.\n\n"
                        "```python\ndef f():\n    return 1\n```\n")
        (ok if pg.text_content("#eTT").startswith("●") else sai)("trang thai bai: 'chua luu' khi go")
        pg.wait_for_selector("#ePrev .katex", timeout=10000)
        pr = pg.evaluate("() => ({hop: !!document.querySelector('#ePrev blockquote.cal-key'),"
                         " ma: !!document.querySelector('#ePrev .cw .hljs-keyword')})")
        (ok if pr["hop"] and pr["ma"] else sai)("xem truoc chia doi: KaTeX, hop chu y, khoi ma to mau (QA-14) %s" % pr)
        pg.focus("#eMd")
        pg.keyboard.press("Control+s")
        pg.wait_for_function(DA_LUU)
        _, d1 = lay(may, SD + "/docs/" + id1, admin)
        (ok if "a^2+b^2" in d1["md"] else sai)("Ctrl+S trong o soan luu bai (QA-18, doi chieu API)")
        # luu xong S.doc la object moi ma o soan khong ve lai: go tiep van phai toi xem truoc / ban nhap
        pg.fill("#eMd", pg.input_value("#eMd") + "\nĐoạn gõ sau khi lưu.\n")
        (ok if cho(pg, "() => document.querySelector('#ePrev').textContent.includes('Đoạn gõ sau khi lưu')") else sai)(
            "go tiep sau khi luu: xem truoc van cap nhat")
        anh_chup(pg, "soan-chia-doi.png")

        # 11. QA-04 meta sai -> bao canh o, khong gui; loi 422 thanh cau doc duoc
        pg.evaluate("() => { document.querySelector('details.tt').open = true; }")
        pg.fill("#eMeta", "[]")
        (ok if pg.is_visible("#eMetaLoi") else sai)("meta khong phai object: bao loi canh o")
        pg.click("#eLuu")
        pg.wait_for_selector("#toast.loi")
        loi_toast = pg.text_content("#toast")
        (ok if "Thuộc tính" in loi_toast and "object Object" not in loi_toast else sai)("bam Luu khi meta sai: khong gui, chi ro o can sua (%r)" % loi_toast)
        pg.fill("#eMeta", "{}")
        msg = pg.evaluate("() => QL.thongDiep({detail: [{type: 'dict_type', loc: ['body', 'meta'], msg: 'x'}]}, 422)")
        (ok if msg == "“meta” phải là một object JSON {…}" else sai)("loi 422 cua FastAPI thanh cau doc duoc: %s (QA-04)" % msg)

        # 12. QA-08 tai lai trang giu cho; ban nhap tren may khoi phuc duoc
        pg.fill("#eMd", pg.input_value("#eMd") + "\nDòng gõ dở chưa lưu.\n")
        pg.wait_for_timeout(1100)                      # nhap tu luu sau 0,8 s
        pg.reload()
        pg.wait_for_selector("#eBanner .banner", timeout=15000)
        (ok if pg.url.endswith("#/system-design/tree/" + id1) and pg.input_value("#eId") == id1 else sai)(
            "tai lai trang: van o khoa, tab va bai dang soan (QA-08)")
        pg.click("#nKhoiPhuc")
        (ok if "Dòng gõ dở chưa lưu" in pg.input_value("#eMd") else sai)("ban nhap tu luu tren may: tai lai trang van khoi phuc duoc")
        pg.keyboard.press("Control+s")
        pg.wait_for_function(DA_LUU)

        # 13. QA-01 (bai): nguoi khac luu truoc -> hien khac biet, ghi de co chu y
        goi(may, "PUT", SD + "/docs/" + id1, {"md": "# Bài đầu tiên\n\nBản của người khác.\n"}, admin)
        pg.fill("#eMd", "# Bài đầu tiên\n\nBản của tôi.\n")
        pg.click("#eLuu")
        pg.wait_for_selector(".dlg .khac")
        (ok if "Bản của người khác" in pg.text_content(".dlg .khac") else sai)("xung dot bai: hien khac biet voi ban tren server (QA-01)")
        hop_thoai(pg, nut="1")                         # ghi de bang ban cua toi
        pg.wait_for_function(DA_LUU)
        _, d1 = lay(may, SD + "/docs/" + id1, admin)
        (ok if "Bản của tôi" in d1["md"] else sai)("ghi de co chu y (doi chieu API)")

        # 14. lich su bai: xem khac biet, dua ban cu vao trinh soan
        menu(pg, "lichSu")
        pg.wait_for_selector("#lsXem .khac, #lsXem p", timeout=10000)
        so_ban = pg.eval_on_selector_all(".ls-i", "e => e.length")
        pg.click("#lsDua")
        (ok if so_ban >= 4 and "Bản của người khác" in pg.input_value("#eMd") else sai)(
            "lich su %d ban; dua ban truoc lan ghi de vao trinh soan" % so_ban)
        pg.keyboard.press("Control+s")
        pg.wait_for_function(DA_LUU)

        # 15. QA-09 doi slug giu dia chi cu; doi id giu tien do; nhan ban bai
        pg.fill("#eSlug", "bai/dau-tien-moi")
        pg.keyboard.press("Control+s")
        pg.wait_for_function(DA_LUU)
        _, man = lay(may, SD + "/manifest")
        (ok if man["aliases"].get("bat-dau-nhanh/bai-dau-tien") == id1 else sai)("doi slug: dia chi cu thanh bi danh (QA-09)")
        menu(pg, "doiId")
        hop_thoai(pg, {"id": "bat-dau-nhanh/bai-01.md"})
        cho_bai(pg, "bat-dau-nhanh/bai-01.md")
        _, man = lay(may, SD + "/manifest")
        (ok if "bat-dau-nhanh/bai-01.md" in man["docs"] and man["idAliases"].get(id1) == "bat-dau-nhanh/bai-01.md" else sai)(
            "doi id: tien do nguoi hoc di theo (idAliases)")
        menu(pg, "nhanBan")
        hop_thoai(pg)
        dup = "bat-dau-nhanh/bai-01-ban-sao.md"
        cho_bai(pg, dup)
        st, dd = lay(may, SD + "/docs/" + dup, admin)
        (ok if st == 200 and dd["group"] == "Bắt đầu nhanh" else sai)("nhan ban bai vao cung nhom: %s" % dup)

        # 16. tep: tai len tu trinh soan (ten bo dau), chen markdown, xem truoc thay anh
        pg.set_input_files("#eTep", tep_anh)
        co_md = cho(pg, "() => document.querySelector('#eMd').value.includes('assets/anh-so-do.png')")
        co_anh = co_md and cho(pg, "() => !!document.querySelector('#ePrev img[src*=\"assets/anh-so-do.png\"]')")
        (ok if co_anh else sai)("anh tai len khoa, chen markdown, xem truoc hien anh")
        pg.fill("#eMd", pg.input_value("#eMd") + "\n[Bài gốc](bai-01.md) · [Mất](khong-co.md)\n")
        pg.keyboard.press("Control+s")
        pg.wait_for_function(DA_LUU)
        pg.click('.tab[data-tab="files"]')
        pg.wait_for_selector('.tep-ds li[data-ten="anh-so-do.png"]')
        (ok if "dùng trong 1 bài" in pg.text_content('.tep-ds li[data-ten="anh-so-do.png"]') else sai)("tab Tep: biet tep dung trong bai nao")

        # 17. QA-20 kiem tra lien ket; xoa bai dang duoc link -> canh bao; thung rac
        pg.click('.tab[data-tab="links"]')
        hong = '#kqLk .hit[data-id="%s"]' % dup
        pg.wait_for_selector(hong, timeout=15000)
        (ok if pg.eval_on_selector_all(hong + " .lk-h code", "e => e.map(x => x.textContent)") == ["khong-co.md"] else sai)(
            "kiem tra lien ket: chi bao link hong, link dung (bai-01.md) khong bi bao")
        pg.click(hong)
        (ok if cho(pg, "() => { const t = document.querySelector('#eMd'); return !!t &&"
                       " t.value.slice(t.selectionStart, t.selectionEnd).includes('khong-co.md'); }") else sai)(
            "bam link hong -> mo bai, chon san dong co link")
        pg.click('.di[data-id="bat-dau-nhanh/bai-01.md"] .t')
        cho_bai(pg, "bat-dau-nhanh/bai-01.md")
        menu(pg, "xoa")
        pg.wait_for_selector(".dlg")
        (ok if "1 bài đang link tới bài này" in pg.text_content(".dlg") else sai)("xoa bai dang duoc link: canh bao (QA-20)")
        pg.click(".dlg [type=submit]")
        cho_het_dlg(pg)
        pg.wait_for_selector('.di[data-id="bat-dau-nhanh/bai-01.md"]', state="detached")
        rac = doi(lambda: [d for d in lay(may, "/courses/trash", admin)[1]["docs"] if d["docId"] == "bat-dau-nhanh/bai-01.md"])
        (ok if rac else sai)("bai da xoa nam trong thung rac")
        pg.click("#btnTrash")
        pg.wait_for_selector('[data-kp-bai="%s"]' % rac[0]["id"])
        pg.click('[data-kp-bai="%s"]' % rac[0]["id"])
        pg.wait_for_selector('.grp[data-s="%d"] .di[data-id="bat-dau-nhanh/bai-01.md"]' % so_sec, timeout=15000)
        ok("khoi phuc bai tu thung rac -> ve dung nhom cu")

        # 18. het phien giua chung (gia lap): dang nhap de len, noi dung con, luu tiep
        cho_bai(pg, "bat-dau-nhanh/bai-01.md")
        lan = {"n": 0}

        def het(route):
            if route.request.method == "PUT" and lan["n"] == 0:
                lan["n"] += 1
                route.fulfill(status=403, content_type="application/json", body=json.dumps(
                    {"status_code": 403, "message": "Phiên quản trị đã hết hạn — nhập lại khoá quản trị",
                     "data": {"code": "session_expired"}}))
            else:
                route.continue_()
        pg.route("**/courses/system-design/docs/**", het)
        pg.fill("#eMd", "# Bài đầu tiên\n\nViết sau khi hết phiên.\n")
        pg.click("#eLuu")
        pg.wait_for_selector("#login.phu:not([hidden])")
        (ok if "Viết sau khi hết phiên" in pg.input_value("#eMd") else sai)("het phien: dang nhap de len ung dung, noi dung dang soan con")
        pg.fill("#inpKey", may.khoa_admin)
        pg.press("#inpKey", "Enter")
        pg.wait_for_selector("#login", state="hidden")
        pg.click("#eLuu")
        pg.wait_for_function(DA_LUU)
        pg.unroute("**/courses/system-design/docs/**")
        _, d01 = lay(may, SD + "/docs/bat-dau-nhanh/bai-01.md", admin)
        (ok if "Viết sau khi hết phiên" in d01["md"] else sai)("dang nhap lai -> luu tiep duoc (doi chieu API)")

        # 19. khoa moi tu mau, link trang doc; nhan ban khoa; nap bundle (va nap de); xoa / khoi phuc khoa
        pg.click("#btnNew")
        hop_thoai(pg, {"title": "Khoá mẫu QA", "template": "co-ban"})
        cho_khoa(pg, "khoa-mau-qa")
        st, c = lay(may, "/courses/khoa-mau-qa", admin)
        (ok if st == 200 and len(c["nav"]) == 2 and c["docCount"] == 6 and c["published"] is False else sai)(
            "khoa moi tu mau 'co-ban': slug tu sinh, 2 section, 6 bai, la ban nhap")
        href_moi = pg.get_attribute("#lkDoc", "href")
        doc = ctx.new_page()
        doc.on("pageerror", lambda e: loi.append("pageerror(trang doc): %s" % e))
        doc.goto(QL + href_moi)
        try:
            doc.wait_for_selector(".hero h1", timeout=15000)
            h1 = doc.text_content(".hero h1")
        except Exception:  # noqa: BLE001
            h1 = ""
        doc.close()
        (ok if href_moi == "../khoa-hoc/?khoa=khoa-mau-qa&nhap=1" and "Khoá mẫu QA" in h1 else sai)(
            "khoa vua tao co ngay link trang doc; theo link thay khoa (ban nhap) %r" % h1)
        pg.click("#bNhanBan")
        hop_thoai(pg, {"slug": "khoa-mau-qa-2"})
        cho_khoa(pg, "khoa-mau-qa-2")
        st, c2 = lay(may, "/courses/khoa-mau-qa-2", admin)
        (ok if st == 200 and c2["docCount"] == 6 and c2["published"] is False else sai)("nhan ban khoa: du bai, la ban nhap (doi chieu API)")
        pg.set_input_files("#inpImport", tep_nho)
        hop_thoai(pg)
        cho_khoa(pg, "nap-thu")
        st, m2 = lay(may, "/courses/nap-thu/manifest", admin)
        (ok if st == 200 and m2["order"] == ["a/1.md"] else sai)("nap bundle tu tep (doi chieu API)")
        pg.set_input_files("#inpImport", tep_nho)
        hop_thoai(pg)                                  # cung slug -> hoi them mot lan
        pg.wait_for_selector(".dlg")
        (ok if "Thay khoá" in pg.text_content(".dlg") else sai)("nap trung slug khoa da co: hoi truoc khi thay")
        hop_thoai(pg)

        def so_rac(slug):
            return sum(1 for x in lay(may, "/courses/trash", admin)[1]["courses"] if x["slug"] == slug)
        (ok if doi(lambda: so_rac("nap-thu") == 1) else sai)("nap de: ban cu vao thung rac")
        pg.wait_for_timeout(500)
        pg.click('.tab[data-tab="info"]')
        pg.click("#bXoa")
        pg.fill('.dlg [data-ten="slug"]', "sai")
        pg.click(".dlg [type=submit]")
        (ok if pg.is_visible("#dlgLoi") else sai)("xoa khoa: go sai slug -> khong xoa")
        pg.fill('.dlg [data-ten="slug"]', "nap-thu")
        pg.click(".dlg [type=submit]")
        cho(pg, "() => !document.querySelector('.ci[data-slug=\"nap-thu\"]')")
        (ok if doi(lambda: so_rac("nap-thu") == 2) else sai)("xoa khoa -> vao thung rac")
        pg.click("#btnTrash")
        pg.wait_for_selector('[data-kp-khoa][data-slug="nap-thu"]')
        pg.click('[data-kp-khoa][data-slug="nap-thu"] >> nth=0')
        (ok if cho_khoa(pg, "nap-thu") else sai)("khoi phuc khoa tu thung rac")
        pg.click("#btnTrash")
        pg.wait_for_selector('[data-kp-khoa][data-slug="nap-thu"]')
        pg.click('[data-kp-khoa][data-slug="nap-thu"]')
        pg.wait_for_selector(".dlg")
        (ok if "đang được dùng" in pg.text_content(".dlg") else sai)("khoi phuc khi slug da co khoa khac: hoi slug moi")
        hop_thoai(pg)
        (ok if cho_khoa(pg, "nap-thu-khoi-phuc") else sai)("khoi phuc duoi slug moi")

        # 20. an toan: markdown doc hai khong chay tren trang khoa hoc lan xem truoc
        _, cc = lay(may, SD, admin)
        nhom = cc["nav"][0]["groups"][0]
        goi(may, "PUT", SD + "/docs/bao-mat/thu.md",
            {"md": DOC_DOC_HAI, "section": cc["nav"][0]["id"], "group": nhom.get("short") or nhom["title"]}, admin)
        trang = ctx.new_page()
        hop = []
        trang.on("dialog", lambda d: (hop.append(d.message), d.dismiss()))
        trang.goto(may.goc + "/webapp/courses/system-design-course/#/bao-mat/thu")
        trang.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                                " return b && b.textContent.includes('doan co onclick'); }", timeout=15000)
        trang.wait_for_timeout(500)
        trang.click("#pclick")
        kq = trang.evaluate(KIEM_DOC_HAI.replace("ROOT", "#body"))
        (ok if kq["xss"] is None and not hop and kq["details"] and kq["nguyHiem"] == 0 else sai)(
            "trang khoa hoc go phan chay ma khoi markdown, giu <details> (%s)" % kq)
        trang.evaluate("() => { const d = document.createElement('div');"
                       " d.innerHTML = '<img src=x onerror=\"window.__doiChung=1\">'; }")
        trang.wait_for_timeout(500)
        (ok if trang.evaluate("() => window.__doiChung === 1") else sai)("doi chung am: innerHTML tho thi payload CO chay")
        trang.close()
        pg.goto(QL + "#/system-design/tree/bao-mat/thu.md")
        pg.wait_for_selector("#ePrev details", timeout=15000)
        pg.wait_for_timeout(400)
        kq = pg.evaluate(KIEM_DOC_HAI.replace("ROOT", "#ePrev"))
        (ok if kq["xss"] is None and kq["nguyHiem"] == 0 else sai)("xem truoc o trang quan ly cung duoc loc (%s)" % kq)

        # 21. ?api= tro ra may chu la: bi bo qua — token khong roi khoi may chu da cap
        ra_ngoai = []
        pg.on("request", lambda r: ra_ngoai.append(r.url)
              if urllib.parse.urlsplit(r.url).hostname == "evil.invalid" else None)
        pg.goto(QL + "?api=" + urllib.parse.quote("https://evil.invalid", safe=""))
        try:
            pg.wait_for_selector("#app:not([hidden]) .ci", timeout=15000)
            vao = True
        except Exception:  # noqa: BLE001
            vao = False
        (ok if vao and not ra_ngoai else sai)(
            "?api=https://evil.invalid bi bo qua: token o lai may chu" + ("" if not ra_ngoai else " — DA GUI TOI: %s" % ra_ngoai[:2]))

        # 22. sang / toi: ?theme= chi dat mot lan, nut van doi duoc
        pg.goto(QL + "?theme=light")
        pg.wait_for_selector("#app:not([hidden]) .ci")
        sang = pg.evaluate(NEN)
        pg.click("#btnTheme")                          # sang -> theo he dieu hanh
        pg.click("#btnTheme")                          # -> toi
        toi = pg.evaluate(NEN)
        (ok if sang[0] == "light" and toi[0] == "dark" and toi[1] != sang[1] else sai)(
            "nut sang / toi doi giao dien that, ?theme= khong khoa nut (%s -> %s)" % (sang, toi))
        ctx.close()

        # 23. QA-05 dien thoai: ngan keo, khong tran ngang, cay / soan hai man, nut du lon
        mctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        m = mctx.new_page()
        m.on("pageerror", lambda e: loi.append("pageerror(dien thoai): %s" % e))
        m.goto(QL + "?theme=light")
        m.wait_for_selector("#login:not([hidden])")
        m.fill("#inpKey", may.khoa_admin)
        m.press("#inpKey", "Enter")
        m.wait_for_selector("#app:not([hidden])")
        m.click("#btnDs")
        m.wait_for_selector('.ci[data-slug="system-design"]', state="visible")
        m.click('.ci[data-slug="system-design"]')
        cho_khoa(m, "system-design")
        rong = m.evaluate("() => [document.documentElement.scrollWidth, innerWidth, document.body.classList.contains('ds-mo')]")
        (ok if rong[0] <= rong[1] and not rong[2] else sai)("dien thoai: chon khoa xong ngan keo dong, khong tran ngang (%s)" % rong)
        m.click('.tab[data-tab="tree"]')
        m.wait_for_selector(".di .t")
        rong = m.evaluate("() => [document.documentElement.scrollWidth, innerWidth]")
        (ok if rong[0] <= rong[1] else sai)("dien thoai: cay khong tran ngang (%s)" % rong)
        anh_chup(m, "dien-thoai-cay.png")
        m.click(".di >> nth=1 >> .t")
        m.wait_for_selector("#eMd", state="visible")
        man2 = m.evaluate("() => ({cay: !!document.querySelector('.cay-cot').offsetParent, rong: document.documentElement.scrollWidth,"
                          " nut: Math.round(document.querySelector('#eLuu').getBoundingClientRect().height),"
                          " cham: matchMedia('(pointer: coarse)').matches})")
        (ok if not man2["cay"] and man2["rong"] <= 390 and man2["nut"] >= 36 else sai)(
            "dien thoai: mo bai -> man soan rieng, nut du lon de cham (%s)" % man2)
        anh_chup(m, "dien-thoai-soan.png")
        m.click("#eVe")
        m.wait_for_selector(".cay-cot", state="visible")
        ok("dien thoai: '← Muc luc' quay ve cay")
        mctx.close()
    finally:
        br.close()


def main():
    chup = "--anh" in sys.argv
    print("\nQuan ly khoa hoc — FastAPI that + SQLite tam + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:  # noqa: BLE001
        B.bo_qua("chua cai playwright")
        return 0
    bundle = os.path.join(K.CONTENT, "system-design.json")
    nho = {
        "course": {"slug": "nap-thu", "title": "Khoá nạp thử", "icon": "🧪"},
        "nav": [{"id": "chinh", "title": "Chính", "groups": [{"title": "Nhóm A", "short": "A", "items": ["a/1.md"]}]}],
        "docs": {"a/1.md": {"id": "a/1.md", "slug": "a-1", "title": "Bài một", "md": "# Bài một\n\nNội dung.\n"}},
    }
    tam = tempfile.mkdtemp(prefix="qlkh-")
    tep_nho = os.path.join(tam, "nap-thu.json")
    with open(tep_nho, "w", encoding="utf-8") as f:
        json.dump(nho, f, ensure_ascii=False)
    tep_anh = os.path.join(tam, "Ảnh Sơ Đồ.png")
    with open(tep_anh, "wb") as f:
        f.write(PNG)

    loi = []
    may = K.MayChuThu([bundle]).__enter__()
    try:
        with sync_playwright() as pw:
            try:
                kich_ban(pw, may, tep_nho, tep_anh, chup, os.path.join(HERE, "_shots"), loi)
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                sai("dung giua chung: %s" % str(e).splitlines()[0][:300])
    finally:
        may.__exit__(None, None, None)
    if loi:
        for x in loi[:8]:
            sai("console: " + x[:200])
    else:
        ok("khong co loi console / pageerror (ngoai cac 4xx co y)")
    print()
    if B.loi:
        print(K.DO + "[HONG]" + K.HET + " %d loi" % len(B.loi))
        return 1
    print(K.XANH + "[DAT]" + K.HET + " 0 loi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
