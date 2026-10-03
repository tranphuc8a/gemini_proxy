#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra doc offline / cai ung dung (PWA) — dung chung cho check.py cua cac trang.

  tinh(thu_muc)
      ban sao engine khop nguon (sync.ban_sao_lech: app.js…, pwa.js, sw.js o goc).
      Trang trong nhom "pwa": manifest khop metadata.json + favicon (tao_pwa.py), du
      bieu tuong PNG dung kich thuoc.
  trinh_duyet(ctx, pg, url, cho, dem_yeu_cau=None)
      ctx la context MOI (chua co worker, chua co cache). Manifest nap duoc, worker
      dieu khien trang; tat mang roi tai lai van mo duoc trang (`cho` hien), co nhan
      "Dang offline". Truyen dem_yeu_cau() (so yeu cau may chu da nhan) thi kiem
      luon: luc offline KHONG yeu cau nao toi may chu — trang doc tu bo nho may that,
      khong phai do trinh duyet bo qua che do offline.

Moi ham tra [(dat, thong_diep)]; moi check.py tu bao theo kieu cua no.
"""
import io
import json
import os
import struct
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sync  # noqa: E402
import tao_pwa  # noqa: E402


def _kich_thuoc_png(p):
    try:
        with open(p, "rb") as f:
            dau = f.read(24)
    except OSError:
        return None
    if len(dau) < 24 or dau[:8] != b"\x89PNG\r\n\x1a\n" or dau[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", dau[16:24])


def tinh(thu_muc):
    trang = os.path.basename(os.path.normpath(thu_muc))
    lech = sync.ban_sao_lech(trang)
    kq = [(not lech, "ban sao engine khop courses/engine/" if not lech else
           "ban sao engine lech nguon: %s — chay `python engine/sync.py`" % ", ".join(lech))]
    if trang not in tao_pwa.cac_trang():
        return kq
    sua = "chay `python engine/tao_pwa.py %s`" % trang
    try:
        with io.open(os.path.join(thu_muc, "manifest.webmanifest"), encoding="utf-8") as f:
            co = json.load(f)
    except (OSError, ValueError) as e:
        return kq + [(False, "manifest.webmanifest: %s — %s" % (e, sua))]
    muon = tao_pwa.manifest_cua(trang)
    kq.append((co == muon, "manifest.webmanifest khop metadata.json + favicon" if co == muon else
               "manifest.webmanifest lech metadata.json / favicon — " + sua))
    hong = []
    for ic in muon["icons"]:
        n = int(ic["sizes"].split("x")[0])
        kt = _kich_thuoc_png(os.path.join(thu_muc, *ic["src"].split("/")))
        if kt != (n, n):
            hong.append("%s (%s)" % (ic["src"], "%dx%d" % kt if kt else "thieu"))
    kq.append((not hong, "bieu tuong cai dat du: " + ", ".join(i["src"] for i in muon["icons"]) if not hong else
               "bieu tuong sai / thieu: %s — %s" % (", ".join(hong), sua)))
    return kq


def la_cap_nhat_sw(dong):
    """Dong log la lan trinh duyet tu kiem ban moi cua sw.js.

    Moi lan dieu huong toi trang trong pham vi, trinh duyet tu tai lai sw.js de
    xem co ban moi (thuong tre mot chut sau khi trang tai xong). Yeu cau do do
    chinh trinh duyet gui — che do offline gia lap cua Playwright khong chan no —
    va khong phai trang lay noi dung tu mang; mat mang that thi no hong vo hai.
    """
    return '/sw.js HTTP/' in dong


def doi_yen(dem, on_dinh=0.8, toi_da=8.0):
    """So yeu cau may chu khi no thoi tang — moc dem cho luc offline.

    Viec nen cua trang luc con mang (tai truoc bai ke, worker lam moi cache) co the
    xong — va vao log — sau mot khoang cho co dinh, nhat la khi may dang ban; dem tu
    moc chup qua som thi tinh nham chung la yeu cau "luc offline".
    """
    han = time.time() + toi_da
    cu, luc = dem(), time.time()
    while time.time() < han:
        time.sleep(0.2)
        moi = dem()
        if moi != cu:
            cu, luc = moi, time.time()
        elif time.time() - luc >= on_dinh:
            break
    return cu


def trinh_duyet(ctx, pg, url, cho, dem_yeu_cau=None, liet_ke=None):
    try:
        return _trinh_duyet(ctx, pg, url, cho, dem_yeu_cau, liet_ke)
    except Exception as e:  # noqa: BLE001
        return [(False, "doc offline: %s" % str(e).splitlines()[0])]


def _trinh_duyet(ctx, pg, url, cho, dem_yeu_cau, liet_ke=None):
    kq = []
    pg.goto(url, wait_until="load")
    pg.wait_for_selector(cho, timeout=20000)
    man = pg.evaluate("""async () => {
        const l = document.querySelector('link[rel="manifest"]');
        if (!l) return {loi: 'khong co <link rel="manifest">'};
        try {
            const r = await fetch(l.href), j = await r.json();
            return {ok: r.ok, ten: j.name, loai: r.headers.get('content-type'),
                    mau: (document.querySelector('meta[name="theme-color"]') || {}).content || ''};
        } catch (e) { return {loi: String(e)}; }
    }""")
    kq.append((bool(man.get("ok")), "manifest nap duoc: %s (%s), theme-color %s" % (man.get("ten"), man.get("loai"), man.get("mau"))
               if man.get("ok") else "manifest khong nap duoc: %s" % man))
    try:
        pg.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=15000)
    except Exception:
        return kq + [(False, "service worker khong dieu khien trang sau 15 giay (sw.js phai nam o GOC trang)")]
    kq.append((True, "service worker dieu khien trang"))
    # Tai lai khi con mang: lan nay moi tep di qua worker va duoc luu.
    pg.reload(wait_until="load")
    pg.wait_for_selector(cho, timeout=20000)
    pg.wait_for_timeout(600)
    truoc = doi_yen(dem_yeu_cau) if dem_yeu_cau else None
    ctx.set_offline(True)
    try:
        pg.reload(wait_until="load")
        pg.wait_for_selector(cho, timeout=10000)
        kq.append((True, "mat mang: tai lai van mo duoc trang tu bo nho may"))
        nhan = pg.locator(".pwa-nhan.offline").count()
        kq.append((nhan == 1, "nhan 'Dang offline' hien khi mat mang" if nhan == 1 else "khong thay nhan 'Dang offline'"))
        if truoc is not None:
            la = ""
            if liet_ke:
                moi = [d for d in liet_ke(truoc) if not la_cap_nhat_sw(d)]
                them = len(moi)
                la = (": " + "; ".join(d.split(" - ", 1)[-1][:90] for d in moi[:3])) if moi else ""
            else:
                them = dem_yeu_cau() - truoc
            kq.append((them == 0, "luc offline khong yeu cau nao toi may chu" if them == 0 else
                       "luc offline van co %d yeu cau toi may chu — trang chua that su doc tu bo nho may%s" % (them, la)))
    except Exception as e:  # noqa: BLE001
        kq.append((False, "mat mang: tai lai khong mo duoc trang (%s)" % str(e).splitlines()[0]))
    finally:
        ctx.set_offline(False)
    return kq
