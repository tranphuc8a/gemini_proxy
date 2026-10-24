/* =====================================================================
   ui-xem.js — che do XEM cua o Soan: cuon ao chi doc cho tai lieu lon.

   Textarea khong sua noi tai lieu lon (do that tren Edge: ~0,1 s moi phim
   o 1,3 MB, ~1,6 s o 10 MB — rieng trinh duyet). Tren NGUONG_XEM (1,5 MB)
   o Soan tu chuyen sang day: chi dung ~60 hang nhin thay, so dong ao,
   to mau tung dong (toMauDong cua loi), GAP KHOI {…} […] voi chu thich
   "⟨ 2.108 phan tu · 1,2 MB · object×2.100 ⟩", va "Sua khoi" de sua mot
   khoi nho cua tai lieu ma khong can mo ca van ban vao textarea.

   Van ban van la nguon su that trong #nhap (an di khi o Xem). Moi thay
   doi di qua JE_APP.datVanBan (mot buoc hoan tac co nhan) — Sua khoi ghep
   chuoi: phan con lai cua tai lieu GIU NGUYEN tung byte.

   Ham thuan (dung dsHien, anh xa cuon ti le, khoi chua dong…) phoi ra
   window.JE_XEM_THU de kiem bang node.
   ===================================================================== */
(function () {
  "use strict";

  var APP = window.JE_APP, JE = window.JE;
  if (!APP || !JE || !JE.viTri) throw new Error("ui-xem.js cần json-editor.js (JE_APP) nạp trước");
  var VT = JE.viTri, TT = JE.tomTat;
  var TI = APP.tienIch, thoat = TI.thoat, toMauDong = TI.toMauDong, haiChamSau = TI.haiChamSau, coChu = TI.coChu;
  var HS = APP.hangSo;

  var $ = function (s) { return document.querySelector(s); };
  var cuon = $("#xem-cuon"), cao = $("#xem-cao"), cua = $("#xem-cua");
  var tienDo = $("#xem-tien-do");

  var LH = 21;                   /* do cao hang (kieu.css .xh) */
  var DEM = 8;                   /* hang dem tren / duoi vung nhin thay */
  var SLAT = 1500000;            /* ky tu quet moi lat (≈ 18 ms) */

  /* ====================================================================
     Ham THUAN
     ==================================================================== */

  /** Cac dong that hien ra khi mot so khoi bi gap. `quet` = ket qua bo quet khoi
      (khoiCuaDong, dongDong), `gap` = Uint8Array theo khoi. Khong gap khoi nao: ds = null
      (hang h = dong h). Dong mo cua khoi gap van hien (kem chu thich); cac dong sau no toi
      HET dong dong khoi bi bo. */
  function dungDsHien(quet, gap, nDong) {
    var i, soGap = 0;
    if (!quet || !gap) return { ds: null, n: nDong, soGap: 0 };
    for (i = 0; i < gap.length; i++) if (gap[i]) soGap++;
    if (!soGap) return { ds: null, n: nDong, soGap: 0 };
    var ra = new Int32Array(nDong), m = 0, kc = quet.khoiCuaDong, dd = quet.dongDong;
    for (var L = 0; L < nDong; L++) {
      ra[m++] = L;
      var k = kc[L];
      if (k >= 0 && gap[k]) { var dong = dd[k] - 1; if (dong > L) L = dong; }
    }
    return { ds: ra.subarray(0, m), n: m, soGap: soGap };
  }

  /** Hang hien (tu 0) chua dong that L: dong bi gap thi tra hang cua dong mo khoi gap do. */
  function hangCuaDong(ds, L, nHien) {
    if (!ds) return Math.max(0, Math.min(L, nHien - 1));
    var lo = 0, hi = ds.length - 1;
    if (hi < 0) return 0;
    while (lo < hi) {
      var g = (lo + hi + 1) >> 1;
      if (ds[g] <= L) lo = g; else hi = g - 1;
    }
    return lo;
  }

  /** Dong that cua hang hien h. */
  function dongCuaHang(ds, h) { return ds ? ds[h] : h; }

  /** Khoi (da gap neu gap[k]) trong cac khoi MO TREN DONG L chua dong L o phan than (khong ke dong mo).
      Tra mang chi so khoi cac khoi chua L, tu ngoai vao trong. */
  function khoiChua(quet, L) {
    var ra = [], dm = quet.dongMo, dd = quet.dongDong, n = quet.soKhoi;
    for (var k = 0; k < n; k++) {
      if (dm[k] - 1 <= L && L <= dd[k] - 1 && dd[k] > dm[k]) ra.push(k);
    }
    return ra;
  }

  /** Khoi trong cung (nho nhat) chua dong L (dong mo hoac dong dong cung tinh); -1 neu khong co. */
  function khoiTrongCung(quet, L) {
    var ds = khoiChua(quet, L);
    return ds.length ? ds[ds.length - 1] : -1;
  }

  /** Gap moi khoi sau tu cap `cap` (0 = khoi goc): cap 1 → moi khoi sau >= 1 gap, khoi goc mo, con cua no hien dang mot dong. */
  function gapToiCap(quet, cap) {
    var gap = new Uint8Array(quet.soKhoi), sau = quet.sau, dm = quet.dongMo, dd = quet.dongDong;
    for (var k = 0; k < quet.soKhoi; k++) if (sau[k] >= cap && dd[k] > dm[k]) gap[k] = 1;
    return gap;
  }

  /** Anh xa cuon <-> hang. Tong cao tong * lh vuot `maxPx` thi khung cuon bi ep ve maxPx va
      scrollTop duoc nhan `tiLe` (>= 1) de ra vi tri ao. Tra {caoPx, tiLe}. */
  function khungCuon(nHien, lh, caoKhung, maxPx) {
    var tong = nHien * lh;
    if (tong <= maxPx) return { caoPx: tong, tiLe: 1 };
    return { caoPx: maxPx, tiLe: (tong - caoKhung) / Math.max(1, maxPx - caoKhung) };
  }

  /** Hang dau nhin thay + do lech (px) cua no so voi mep tren khung, tu scrollTop. */
  function hangTuCuon(st, tiLe, lh) {
    var vy = st * tiLe, h = Math.floor(vy / lh);
    return { h: h, lech: vy - h * lh };
  }

  /** scrollTop de hang h nam o mep tren (hoac giua khung neu `giua`). */
  function cuonTuHang(h, tiLe, lh, caoKhung, giua) {
    var vy = h * lh - (giua ? Math.max(0, (caoKhung - lh) / 2) : 0);
    return Math.max(0, Math.round(vy / tiLe));
  }

  /** Cat dong dai: {chu, bo} — `bo` la so ky tu bi cat. Khong cat doi cap surrogate. */
  function catDong(d, toiDa) {
    if (d.length <= toiDa) return { chu: d, bo: 0 };
    var c = d.charCodeAt(toiDa - 1);
    var cat = c >= 0xd800 && c <= 0xdbff ? toiDa - 1 : toiDa;
    return { chu: d.slice(0, cat), bo: d.length - cat };
  }

  /** Nhan so luong cho chu thich: "2.108 phan tu" / "12 khoa". */
  function nhanSo(loai, n) { return TT.soCoDau(n) + (loai === 2 ? " phần tử" : " khoá"); }

  window.JE_XEM_THU = {
    dungDsHien: dungDsHien, hangCuaDong: hangCuaDong, dongCuaHang: dongCuaHang, khoiChua: khoiChua,
    khoiTrongCung: khoiTrongCung, gapToiCap: gapToiCap, khungCuon: khungCuon, hangTuCuon: hangTuCuon,
    cuonTuHang: cuonTuHang, catDong: catDong
  };

  /* ====================================================================
     Trang thai
     ==================================================================== */
  var dangXem = false;
  var vb = "";                   /* van ban dang xem */
  var chiSo = null, nDong = 0;
  var boQuet = null, quet = null, gap = null, henQuet = 0, thuTuQuet = 0;
  var dsHien = null, nHien = 0;
  var kc = { caoPx: 0, tiLe: 1 };
  var chonDong = -1;             /* dong that dang chon (hang to nen) */
  var nhayDong = -1;
  var veCu = { tu: -1, den: -1, n: -1, ct: -1, nhay: -1 };
  var bangChuThich = Object.create(null);   /* khoi -> {chu, tieuDe} */
  var choSauQuet = [];

  function laXem() { return dangXem; }

  function textDong(L) {
    var e = L + 1 < nDong ? chiSo[L + 1] - 1 : vb.length;
    return vb.slice(chiSo[L], e);
  }

  function datTienDo(chu) { if (tienDo) tienDo.textContent = chu; }

  /* ----------------------------------------------------- quet khoi (chia lat) */
  function batDauQuet() {
    clearTimeout(henQuet);
    quet = null; gap = null; boQuet = VT.taoBoQuetKhoi();
    var luot = ++thuTuQuet, bq = boQuet, s = vb;
    datTienDo("Đang quét khối…");
    var tiep = function () {
      henQuet = 0;
      if (luot !== thuTuQuet || !dangXem) return;
      var xong = bq.chay(s, SLAT);
      if (!xong) { henQuet = setTimeout(tiep, 0); return; }
      quet = bq.ketQua();
      gap = new Uint8Array(quet.soKhoi);
      datTienDo(TT.soCoDau(quet.soKhoi) + " khối");
      var ds = choSauQuet; choSauQuet = [];
      ds.forEach(function (f) { try { f(); } catch (e) { setTimeout(function () { throw e; }, 0); } });
      ve(true);
    };
    henQuet = setTimeout(tiep, 0);
  }

  /** Chay `f` khi bo quet khoi xong (ngay neu da xong). */
  function choQuet(f) {
    if (quet) f(); else choSauQuet.push(f);
  }

  /* ----------------------------------------------------- khung cuon ao */
  function caoKhungCuon() { return cuon.clientHeight || 600; }

  function tinhKhung() {
    kc = khungCuon(nHien, LH, caoKhungCuon(), HS.XEM_MAX_PX || 15000000);
    cao.style.height = kc.caoPx + "px";
  }

  function dongDauHien() {
    var h = hangTuCuon(cuon.scrollTop || 0, kc.tiLe, LH).h;
    return dongCuaHang(dsHien, Math.max(0, Math.min(h, nHien - 1)));
  }

  function cuonToiDong(L, giua) {
    var h = hangCuaDong(dsHien, L, nHien);
    cuon.scrollTop = cuonTuHang(h, kc.tiLe, LH, caoKhungCuon(), giua);
  }

  function datLaiDs() {
    var r = dungDsHien(quet, gap, nDong);
    dsHien = r.ds; nHien = r.n;
    tinhKhung();
  }

  /* ----------------------------------------------------- chu thich khoi gap */
  function layTai(goc, duong) {
    var f = window.JE_THU && window.JE_THU.layTai;
    return f ? f(goc, duong) : undefined;
  }

  /** Chu thich cua khoi k: "2.108 phần tử · 1,2 MB · object×2.100" (mo hinh co) hoac
      "2.108 phần tử · ≈ 1,2 M ký tự" (JSON dang loi / qua lon de do). */
  function chuThich(k) {
    if (bangChuThich[k]) return bangChuThich[k];
    var loai = quet.loai[k], so = quet.soCon[k];
    var kyTu = quet.viTriDong[k] >= 0 ? quet.viTriDong[k] - quet.viTriMo[k] + 1 : vb.length - quet.viTriMo[k];
    var chu = nhanSo(loai, so), tieuDe = chu, daDo = false;
    if (APP.hopLe()) {
      var v;
      try { v = layTai(APP.layDuLieu(), quet.duongCuaKhoi(k)); } catch (e) { v = undefined; }
      if (v !== undefined && v !== null && typeof v === "object") {
        var t = TT.tomTatNut(v, { byte: true, ngan: { con: 60000 } });
        if (t.byte !== null) {
          daDo = true;
          chu += " · " + TT.dinhDangByte(t.byte);
          if (t.kieuCon) chu += " · " + t.kieuCon;
          tieuDe = chu + " · " + TT.soCoDau(t.nut) + " nút";
        }
      }
    }
    if (!daDo) {
      var xap = kyTu >= 1000000 ? (kyTu / 1000000).toFixed(1).replace(".", ",") + " M" : TT.soCoDau(kyTu);
      chu += " · ≈ " + xap + " ký tự";
      tieuDe = chu;
    }
    return (bangChuThich[k] = { chu: chu, tieuDe: tieuDe });
  }

  /* ----------------------------------------------------- ve hang */
  /** HTML mot hang (dong that L). Moi chuoi tu du lieu di qua toMauDong / thoat. */
  function htmlHang(L) {
    var d = textDong(L), k = quet ? quet.khoiCuaDong[L] : -1, dongK = k >= 0 && gap && gap[k] === 1;
    var bd = "", noi, haiCham = false, sua = "", mui = "";
    if (dongK) {
      var viTriMo = quet.viTriMo[k] - chiSo[L];
      var truoc = d.slice(0, viTriMo + 1), sau = "";
      var dongDongK = quet.dongDong[k] - 1;
      if (quet.viTriDong[k] >= 0 && dongDongK < nDong) {
        sau = textDong(dongDongK).slice(quet.viTriDong[k] + 1 - chiSo[dongDongK]);
      }
      var ct = chuThich(k);
      noi = toMauDong(catDong(truoc, HS.DONG_DAI_TOI_DA).chu, false, -1) +
        '<button type="button" class="xp" data-mo="' + k + '" title="' + thoat(ct.tieuDe) + ' — bấm để mở" aria-label="Mở khối: ' + thoat(ct.tieuDe) + '">⟨ ' + thoat(ct.chu) + " ⟩</button>" +
        toMauDong(catDong(sau, HS.DONG_DAI_TOI_DA).chu, false, -1);
      mui = "▸";
    } else {
      var c = catDong(d, HS.DONG_DAI_TOI_DA);
      noi = toMauDong(c.chu, haiChamDong(L), -1) + (c.bo ? '<span class="xc"> … (+' + TT.soCoDau(c.bo) + " ký tự)</span>" : "");
      if (k >= 0) mui = "▾";
    }
    if (k >= 0 && quet.viTriDong[k] >= 0) {
      sua = '<button type="button" class="xe" data-sua="' + k + '" tabindex="-1" title="Sửa khối này" aria-label="Sửa khối bắt đầu ở dòng ' + (L + 1) + '">✎</button>';
    }
    bd = '<div class="xh' + (L === chonDong ? " xh-chon" : "") + (L === nhayDong ? " xh-nhay" : "") + '" data-l="' + L + '">' +
      '<span class="xs">' + (L + 1) + "</span>" +
      '<button type="button" class="xg" data-gap="' + k + '" tabindex="-1"' + (k >= 0 ? ' aria-label="' + (dongK ? "Mở khối" : "Gập khối") + '"' : " disabled") + ">" + (mui || "&nbsp;") + "</button>" +
      '<span class="xn">' + noi + "</span>" + sua + "</div>";
    return bd;
  }

  /** Ky tu that dau tien SAU dong L co phai ":" khong (de to dung khoa o cuoi dong): nhin toi da 64 dong. */
  function haiChamDong(L) {
    for (var j = L + 1; j < nDong && j < L + 65; j++) {
      var b = chiSo[j], e = j + 1 < nDong ? chiSo[j + 1] - 1 : vb.length;
      for (var q = b; q < e; q++) {
        var c = vb.charCodeAt(q);
        if (c !== 32 && c !== 9 && c !== 13) return c === 58;
      }
    }
    return false;
  }

  /** Ve cua so hang quanh vung nhin thay. `ep`: ve lai du khong doi cua so. */
  function ve(ep) {
    if (!dangXem || !chiSo) return;
    var ct = cuon.scrollTop || 0, cm = caoKhungCuon();
    var ht = hangTuCuon(ct, kc.tiLe, LH), so = Math.ceil(cm / LH) + 1;
    var tu = Math.max(0, ht.h - DEM), den = Math.min(nHien, ht.h + so + DEM);
    var coDinh = kc.tiLe === 1;
    var ok = !ep && coDinh && veCu.n === nHien && veCu.ct === chonDong && veCu.nhay === nhayDong &&
      veCu.tu >= 0 && ht.h - 2 >= veCu.tu && ht.h + so + 2 <= veCu.den;
    if (ok) return;
    var html = "";
    for (var h = tu; h < den; h++) html += htmlHang(dongCuaHang(dsHien, h));
    cua.style.top = (coDinh ? tu * LH : ct - ht.lech - (ht.h - tu) * LH) + "px";
    datHtmlCua(html);
    veCu = { tu: tu, den: den, n: nHien, ct: chonDong, nhay: nhayDong };
  }

  /** Gan cac hang vao cua so. `html` do htmlHang dung: moi chuoi tu du lieu da qua toMauDong / thoat( truoc khi noi vao. */
  function datHtmlCua(html) {
    /* `html` do htmlHang dung: moi chuoi tu du lieu da qua toMauDong / thoat( truoc khi toi day */
    cua.innerHTML = html;
  }

  /* ----------------------------------------------------- vao / ra / lam moi */
  function lamMoi(dongGiu) {
    vb = APP.layVanBan();
    chiSo = TI.chiSoCua(vb);
    nDong = chiSo.length;
    quet = null; gap = null; dsHien = null; nHien = nDong;
    bangChuThich = Object.create(null);
    choSauQuet = [];
    veCu = { tu: -1, den: -1, n: -1, ct: -1, nhay: -1 };
    tinhKhung();
    if (chonDong >= nDong) chonDong = -1;
    if (dongGiu !== undefined && dongGiu >= 0) cuonToiDong(Math.min(dongGiu, nDong - 1));
    ve(true);
    batDauQuet();
  }

  function vao(tc) {
    dangXem = true;
    var dong = tc && tc.dong > 0 ? tc.dong - 1 : 0;
    lamMoi(dong);
    if (cuon && cuon.focus && !(tc && tc.tuDong)) { try { cuon.focus({ preventScroll: true }); } catch (e) { cuon.focus(); } }
  }

  function ra() {
    dangXem = false;
    clearTimeout(henQuet); henQuet = 0; thuTuQuet++;
    vb = ""; chiSo = null; quet = null; gap = null; dsHien = null; boQuet = null; bangChuThich = Object.create(null);
    cua.textContent = "";
    datTienDo("");
  }

  APP.dangKy("doi-du-lieu", function () {
    if (!dangXem) return;
    if (APP.layVanBan() === vb) return;
    lamMoi(dongDauHien());
  });

  /* ----------------------------------------------------- gap / mo */
  function giuViTri(f) {
    var L0 = dongDauHien();
    f();
    datLaiDs();
    cuonToiDong(L0);
    ve(true);
  }

  function batTatKhoi(k, gapMoi) {
    if (!quet || k < 0 || k >= quet.soKhoi) return false;
    var moi = gapMoi === undefined ? (gap[k] ? 0 : 1) : (gapMoi ? 1 : 0);
    if (gap[k] === moi) return false;
    giuViTri(function () { gap[k] = moi; });
    return true;
  }

  function gapToiCapN(cap) {
    if (!quet) return false;
    giuViTri(function () { gap = gapToiCap(quet, cap); });
    return true;
  }

  function moHet() {
    if (!quet) return false;
    giuViTri(function () { gap = new Uint8Array(quet.soKhoi); });
    return true;
  }

  /** Mo cac khoi gap chua dong L (khong tinh dong mo cua chinh khoi do) de dong L hien ra. */
  function moToiDong(L) {
    if (!quet) return;
    var ds = khoiChua(quet, L), doi = false;
    for (var i = 0; i < ds.length; i++) {
      var k = ds[i];
      if (gap[k] && quet.dongMo[k] - 1 < L) { gap[k] = 0; doi = true; }
    }
    if (doi) { datLaiDs(); }
  }

  /* ----------------------------------------------------- di chuyen */
  function nhay(L) {
    nhayDong = L; chonDong = L;
    ve(true);
    setTimeout(function () { if (nhayDong === L) { nhayDong = -1; ve(true); } }, 1300);
  }

  /** JE_APP.denViTri trong che do Xem: mo khoi chua, cuon toi dong chua `bd`, nhay hang. */
  function denViTri(bd, kt) {
    var s = APP.layVanBan();
    if (s !== vb) lamMoi(0);
    var L = Math.min(nDong - 1, Math.max(0, VT.dongCuaViTri(chiSo, Math.max(0, bd)) - 1));
    var xong = function () { moToiDong(L); cuonToiDong(L, true); nhay(L); };
    if (quet) xong(); else { cuonToiDong(L, true); ve(true); choQuet(xong); }
    return true;
  }

  function chonHang(h) {
    h = Math.max(0, Math.min(nHien - 1, h));
    chonDong = dongCuaHang(dsHien, h);
    var ct = cuon.scrollTop || 0, cm = caoKhungCuon();
    var tren = cuonTuHang(h, kc.tiLe, LH, cm, false), duoi = cuonTuHang(h + 1, kc.tiLe, LH, cm, false) - cm;
    if (tren < ct) cuon.scrollTop = tren;
    else if (duoi > ct) cuon.scrollTop = Math.max(0, duoi + 4);
    ve(true);
  }

  /* ----------------------------------------------------- sua */
  /** Sua tai dong L: van ban nho thi sang o Sua dung vi tri; lon thi mo "Sua khoi". */
  function suaTaiDong(L) {
    if (vb.length <= HS.NGUONG_XEM) {
      var i = chiSo[Math.max(0, Math.min(nDong - 1, L))];
      APP.datCheDoSoan("sua", { khongChon: true });
      APP.denViTri(i, i);
      return true;
    }
    if (!quet) { datTienDo("Đang quét khối… thử lại sau giây lát"); return false; }
    var k = quet.khoiCuaDong[L] >= 0 && quet.viTriDong[quet.khoiCuaDong[L]] >= 0 ? quet.khoiCuaDong[L] : khoiTrongCung(quet, L);
    if (k < 0) { datTienDo("Dòng này không thuộc khối nào để sửa"); return false; }
    return moSuaKhoi(k);
  }

  var hopSua = null;

  function dungHopSua() {
    var khung = $("#xem-khung");
    hopSua = document.createElement("div");
    hopSua.className = "xem-sua";
    hopSua.hidden = true;
    hopSua.setAttribute("role", "dialog");
    hopSua.setAttribute("aria-modal", "true");
    hopSua.setAttribute("aria-label", "Sửa khối");
    var hop = document.createElement("div"); hop.className = "xem-sua-hop";
    var tieuDe = document.createElement("h2"); tieuDe.id = "xem-sua-tieu-de";
    var vbSua = document.createElement("textarea"); vbSua.className = "xem-sua-vb"; vbSua.id = "xem-sua-vb";
    vbSua.spellcheck = false; vbSua.setAttribute("aria-label", "Văn bản của khối");
    var loi = document.createElement("p"); loi.className = "xem-sua-loi"; loi.id = "xem-sua-loi"; loi.setAttribute("role", "alert");
    var hd = document.createElement("div"); hd.className = "xem-sua-hd";
    var luu = document.createElement("button"); luu.type = "button"; luu.className = "nut"; luu.id = "xem-sua-luu"; luu.textContent = "Lưu khối";
    var huy = document.createElement("button"); huy.type = "button"; huy.className = "nut"; huy.id = "xem-sua-huy"; huy.textContent = "Huỷ";
    hd.appendChild(huy); hd.appendChild(luu);
    hop.appendChild(tieuDe); hop.appendChild(vbSua); hop.appendChild(loi); hop.appendChild(hd);
    hopSua.appendChild(hop);
    khung.appendChild(hopSua);
    luu.onclick = luuKhoi;
    huy.onclick = dongHopSua;
    hopSua.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dongHopSua(); }
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); luuKhoi(); }
    });
  }

  var khoiDangSua = null;        /* {bd, kt, goc, dong} */

  function moSuaKhoi(k) {
    if (quet.viTriDong[k] < 0) { datTienDo("Khối chưa đóng — không sửa khối được"); return false; }
    var bd = quet.viTriMo[k], kt = quet.viTriDong[k] + 1;
    if (kt - bd > HS.NGUONG_XEM) {
      datTienDo("Khối quá lớn (" + coChu(kt - bd) + ") — sửa khối con nhỏ hơn hoặc dùng tab Cây");
      return false;
    }
    if (!hopSua) dungHopSua();
    khoiDangSua = { bd: bd, kt: kt, goc: vb, dong: quet.dongMo[k] - 1 };
    var duong = quet.duongCuaKhoi(k);
    $("#xem-sua-tieu-de").textContent = "Sửa khối " + (duong && duong.length ? JE.chung.moTaDuong(duong) : "gốc") + " · " + coChu(kt - bd);
    $("#xem-sua-vb").value = vb.slice(bd, kt);
    $("#xem-sua-loi").textContent = "";
    hopSua.hidden = false;
    $("#xem-sua-vb").focus();
    return true;
  }

  function dongHopSua() {
    if (!hopSua) return;
    hopSua.hidden = true;
    khoiDangSua = null;
    if (cuon && cuon.focus) { try { cuon.focus({ preventScroll: true }); } catch (e) { cuon.focus(); } }
  }

  function luuKhoi() {
    if (!khoiDangSua) return false;
    var moi = $("#xem-sua-vb").value, ks = khoiDangSua, loi = $("#xem-sua-loi");
    var hienTai = APP.layVanBan();
    if (hienTai !== ks.goc) { loi.textContent = "Văn bản đã đổi trong lúc sửa — đóng hộp và mở lại khối."; return false; }
    if (APP.hopLe()) {
      try { JSON.parse(moi); }
      catch (e) { loi.textContent = "Khối không phải JSON hợp lệ — " + String(e && e.message || e); return false; }
    }
    var sMoi = hienTai.slice(0, ks.bd) + moi + hienTai.slice(ks.kt);
    var dong = ks.dong;
    dongHopSua();
    APP.datVanBan(sMoi, { nhan: "Sửa khối" });
    if (dangXem) { vb === sMoi || lamMoi(dong); cuonToiDong(dong); ve(true); }
    return true;
  }

  /* ----------------------------------------------------- su kien */
  var cuonCho = 0;
  cuon.addEventListener("scroll", function () {
    if (cuonCho) return;
    cuonCho = 1;
    var xong = function () { cuonCho = 0; ve(false); };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(xong); else setTimeout(xong, 0);
  });
  if (typeof window.ResizeObserver === "function") new window.ResizeObserver(function () { if (dangXem) { tinhKhung(); ve(true); } }).observe(cuon);

  function hangCua(el) {
    var x = el && el.closest ? el.closest(".xh") : null;
    return x ? parseInt(x.getAttribute("data-l"), 10) : -1;
  }

  cua.addEventListener("click", function (e) {
    var t = e.target, nut;
    if (!t || !t.closest) return;
    if ((nut = t.closest(".xp"))) { batTatKhoi(parseInt(nut.getAttribute("data-mo"), 10), false); return; }
    if ((nut = t.closest(".xg")) && !nut.disabled) { batTatKhoi(parseInt(nut.getAttribute("data-gap"), 10)); return; }
    if ((nut = t.closest(".xe"))) { if (quet) moSuaKhoi(parseInt(nut.getAttribute("data-sua"), 10)); return; }
    var L = hangCua(t);
    if (L < 0) return;
    /* Bam doi (detail >= 2): sua tai dong. Dung click.detail thay vi dblclick: lan bam dau chon hang, neu ve lai hang
       thi lan bam thu hai roi vao the moi va mot so trinh duyet khong ban dblclick. */
    if (e.detail >= 2) { suaTaiDong(L); return; }
    chonHangDom(L);
    if (cuon.focus) { try { cuon.focus({ preventScroll: true }); } catch (x) { cuon.focus(); } }
  });
  cua.addEventListener("dblclick", function (e) {
    var L = hangCua(e.target);
    if (L >= 0 && !(hopSua && !hopSua.hidden) && !(e.target.closest && e.target.closest(".xg, .xp, .xe"))) suaTaiDong(L);
  });

  /** Doi hang chon bang cach doi lop (khong ve lai: the dang duoc bam khong bi thay giua hai lan bam). */
  function chonHangDom(L) {
    if (L === chonDong) return;
    var cu = cua.querySelector ? cua.querySelector(".xh.xh-chon") : null;
    if (cu) cu.classList.remove("xh-chon");
    chonDong = L;
    var moi = cua.querySelector ? cua.querySelector('.xh[data-l="' + L + '"]') : null;
    if (moi) moi.classList.add("xh-chon");
    veCu.ct = chonDong;
  }

  cuon.addEventListener("keydown", function (e) {
    if (!dangXem || e.ctrlKey || e.metaKey || e.altKey) return;
    var h = hangCuaDong(dsHien, chonDong >= 0 ? chonDong : dongDauHien(), nHien), k = e.key, xong = true;
    var trang = Math.max(1, Math.floor(caoKhungCuon() / LH) - 1);
    if (k === "ArrowDown") chonHang(chonDong < 0 ? h : h + 1);
    else if (k === "ArrowUp") chonHang(chonDong < 0 ? h : h - 1);
    else if (k === "PageDown") chonHang(h + trang);
    else if (k === "PageUp") chonHang(h - trang);
    else if (k === "Home") chonHang(0);
    else if (k === "End") chonHang(nHien - 1);
    else if (k === "Enter") { if (chonDong >= 0) suaTaiDong(chonDong); }
    else if (k === "ArrowRight" || k === "ArrowLeft") {
      if (chonDong < 0 || !quet) xong = false;
      else {
        var kk = quet.khoiCuaDong[chonDong];
        if (kk >= 0) batTatKhoi(kk, k === "ArrowLeft");
      }
    } else xong = false;
    if (xong) e.preventDefault();
  });

  /* thanh cong cu */
  Array.prototype.forEach.call(document.querySelectorAll ? document.querySelectorAll("#xem-cong-cu [data-cap]") : [], function (b) {
    b.onclick = function () { gapToiCapN(parseInt(b.getAttribute("data-cap"), 10)); };
  });
  var nutMoHet = $("#xem-mo-het");
  if (nutMoHet) nutMoHet.onclick = moHet;

  /* Ctrl+Shift+[ gap khoi chua con tro (tu o Sua: chuyen sang Xem, cuon toi do); Ctrl+Shift+] mo khoi. */
  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
    var gapKhoi = e.key === "[" || e.key === "{", moKhoi = e.key === "]" || e.key === "}";
    if (!gapKhoi && !moKhoi) return;
    if (APP.tabHien() !== "soan") return;
    e.preventDefault();
    var tuSua = APP.cheDoSoan() === "sua", nhapEl = $("#nhap");
    var caret = tuSua ? Math.min(nhapEl.selectionStart || 0, nhapEl.value.length) : -1;
    var lamViec = function () {
      var L = caret >= 0 ? Math.max(0, VT.dongCuaViTri(chiSo, caret) - 1) : (chonDong >= 0 ? chonDong : dongDauHien());
      choQuet(function () {
        var ks = khoiChua(quet, L), k = -1;
        if (gapKhoi) { for (var i = ks.length - 1; i >= 0; i--) if (!gap[ks[i]]) { k = ks[i]; break; } }
        else { for (var j = 0; j < ks.length; j++) if (gap[ks[j]]) k = ks[j]; }
        if (k >= 0) { batTatKhoi(k, gapKhoi); chonDong = dongCuaHang(dsHien, hangCuaDong(dsHien, quet.dongMo[k] - 1, nHien)); cuonToiDong(chonDong, true); ve(true); }
        else datTienDo(gapKhoi ? "Không có khối nào để gập ở đây" : "Không có khối gập nào ở đây");
      });
    };
    if (tuSua) { APP.datCheDoSoan("xem", { dong: VT.dongCuaViTri(TI.chiSoCua(nhapEl.value), caret) }); }
    lamViec();
  });

  APP.dangKyXem({
    vao: vao, ra: ra, denViTri: denViTri, laXem: laXem,
    soDong: function () { return nDong; },
    dongDau: function () { return dongDauHien() + 1; }
  });
})();
