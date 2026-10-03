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


def trinh_duyet(ctx, pg, url, cho, dem_yeu_cau=None):
    try:
        return _trinh_duyet(ctx, pg, url, cho, dem_yeu_cau)
    except Exception as e:  # noqa: BLE001
        return [(False, "doc offline: %s" % str(e).splitlines()[0])]


def _trinh_duyet(ctx, pg, url, cho, dem_yeu_cau):
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
    truoc = dem_yeu_cau() if dem_yeu_cau else None
    ctx.set_offline(True)
    try:
        pg.reload(wait_until="load")
        pg.wait_for_selector(cho, timeout=10000)
        kq.append((True, "mat mang: tai lai van mo duoc trang tu bo nho may"))
        nhan = pg.locator(".pwa-nhan.offline").count()
        kq.append((nhan == 1, "nhan 'Dang offline' hien khi mat mang" if nhan == 1 else "khong thay nhan 'Dang offline'"))
        if truoc is not None:
            them = dem_yeu_cau() - truoc
            kq.append((them == 0, "luc offline khong yeu cau nao toi may chu" if them == 0 else
                       "luc offline van co %d yeu cau toi may chu — trang chua that su doc tu bo nho may" % them))
    except Exception as e:  # noqa: BLE001
        kq.append((False, "mat mang: tai lai khong mo duoc trang (%s)" % str(e).splitlines()[0]))
    finally:
        ctx.set_offline(False)
    return kq
