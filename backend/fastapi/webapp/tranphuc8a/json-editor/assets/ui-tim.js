/* =====================================================================
   ui-tim.js — Tim / Thay (Ctrl+F, Ctrl+H) cho tab Soan (Sua + Xem) va tab Cay,
   "Di toi" (Ctrl+G: dong, dong:cot, JSONPath, JSON Pointer) va duong dan tai con tro.

   Ruot tim / thay la assets/tim-kiem.js (thuan, da kiem). O day chi la giao dien:
   - mot thanh dung chung (#tim-thanh): o tim, Aa / ab| / .*, dem "3/120", ↑ ↓, thay, thay tat ca;
   - Soan (Sua): cac khop to bang <mark> tren lop to mau ao (chi cac hang dang ve, nghe su kien "ve-mau");
     khop hien tai = vung chon cua textarea; Xem: to tren cac hang .xh dang dung ("ve-xem"), nhay toi khop tu mo khoi gap;
   - Cay: nhay = mo to tien + nhom roi focus (JE_APP.denDuong), to <mark> tren .khoa / .gt cua cac hang dang hien;
   - Thay mot / Thay tat ca = MOT buoc hoan tac (datVanBan / apDungGoc), co nhan.
   Chu tu du lieu chi di vao DOM bang textContent / nut van ban, khong qua innerHTML.
   ===================================================================== */
(function () {
  "use strict";

  var APP = window.JE_APP, JE = window.JE;
  if (!APP || !JE || !JE.timKiem || !JE.jsonpath || !JE.viTri || !JE.chung) throw new Error("ui-tim.js cần json-editor.js (JE_APP), tim-kiem.js, jsonpath.js nạp trước");
  var K = JE.timKiem, VT = JE.viTri, JP = JE.jsonpath, JC = JE.chung;
  var HS = APP.hangSo;

  var $ = function (s) { return document.querySelector(s); };
  var thanh = $("#tim-thanh"), oQ = $("#tim-q"), oThay = $("#tim-thay"), dem = $("#tim-dem"), bao = $("#tim-bao");
  var nutHoa = $("#tim-hoa"), nutTu = $("#tim-tu"), nutRe = $("#tim-re"), chonVi = $("#tim-vi"), nhanVi = $("#tim-vi-nhan");
  var hangThay = $("#tim-hang-thay"), nutMoThay = $("#tim-mo-thay");
  var nhap = $("#nhap");

  var tc = { hoaThuong: false, caTu: false, regex: false, phamVi: "ca-hai" };
  var mo = false, thayMo = false;
  var ds = [], chiSo = -1, catBot = false, loiTim = "";
  var diemBatDau = -1;                          /* sau khi thay: chon khop dau tien o vi tri >= diem nay (Soan) */
  var henTim = 0, henDam = 0;

  function lsLay(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsDat(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* khong luu duoc */ } }

  (function khoiPhuc() {
    var luu = null;
    try { luu = JSON.parse(lsLay("json-editor:tim") || "null"); } catch (e) { luu = null; }
    if (luu && typeof luu === "object") {
      tc.hoaThuong = !!luu.hoaThuong; tc.caTu = !!luu.caTu; tc.regex = !!luu.regex;
      if (luu.phamVi === "khoa" || luu.phamVi === "gia-tri") tc.phamVi = luu.phamVi;
    }
  })();
  function luuTuyChon() { lsDat("json-editor:tim", JSON.stringify(tc)); }

  function ngu() {                              /* ngu canh tim: "soan" | "cay" | null */
    var t = APP.tabHien();
    return t === "soan" || t === "cay" ? t : null;
  }

  /* ----------------------------------------------------------------- thanh */
  function datBat(nut, bat) { if (!nut) return; nut.setAttribute("aria-pressed", bat ? "true" : "false"); nut.classList.toggle("dang-bat", !!bat); }
  function capNhatThanh() {
    datBat(nutHoa, tc.hoaThuong); datBat(nutTu, tc.caTu); datBat(nutRe, tc.regex);
    datBat(nutMoThay, thayMo);
    if (hangThay) hangThay.hidden = !thayMo;
    if (chonVi) chonVi.value = tc.phamVi;
    if (nhanVi) nhanVi.hidden = ngu() !== "cay";
    if (thanh) thanh.hidden = !(mo && ngu());
  }

  function datBao(chu, loi) {
    if (!bao) return;
    bao.textContent = chu || "";
    bao.classList.toggle("loi", !!loi);
  }

  function capNhatDem() {
    if (!dem) return;
    var n = ds.length;
    dem.textContent = (n ? (chiSo + 1) : 0) + "/" + n + (catBot ? "+" : "");
    dem.classList.toggle("khong", !n && !!(oQ && oQ.value));
    if (oQ) oQ.setAttribute("aria-invalid", loiTim ? "true" : "false");
  }

  /* ----------------------------------------------------------------- tinh cac khop */
  function layTuyChon() { return { hoaThuong: tc.hoaThuong, caTu: tc.caTu, regex: tc.regex, phamVi: tc.phamVi }; }

  function tinh(giuViTri) {
    clearTimeout(henTim); henTim = 0;
    var q = oQ ? oQ.value : "", cu = chiSo >= 0 && ds[chiSo] ? ds[chiSo] : null, cuBd = cu ? (cu.bd !== undefined && !cu.duong ? cu.bd : -1) : -1;
    ds = []; chiSo = -1; catBot = false; loiTim = "";
    var nguCanh = ngu();
    if (mo && q !== "" && nguCanh === "soan") {
      var r = K.timTrongVanBan(APP.layVanBan(), q, layTuyChon(), K.TRAN);
      ds = r; catBot = !!r.catBot; loiTim = r.loi || "";
    } else if (mo && q !== "" && nguCanh === "cay") {
      if (!APP.hopLe()) { loiTim = "JSON chưa hợp lệ — sửa ở tab Soạn rồi tìm trên cây"; }
      else {
        var r2 = K.timTrongGiaTri(APP.layDuLieu(), q, layTuyChon(), 5000);
        ds = r2; catBot = !!r2.catBot; loiTim = r2.loi || "";
      }
    }
    if (ds.length) {
      if (nguCanh === "soan") {
        var moc = diemBatDau >= 0 ? diemBatDau : giuViTri && cuBd >= 0 ? cuBd : (nhap && typeof nhap.selectionStart === "number" ? nhap.selectionStart : 0);
        var i = 0;
        while (i < ds.length && ds[i].bd < moc) i++;
        chiSo = i < ds.length ? i : 0;
      } else chiSo = giuViTri && cu ? Math.min(chiSoGanCay(cu), ds.length - 1) : 0;
    }
    diemBatDau = -1;
    capNhatDem();
    datBao(loiTim, !!loiTim);
    damLai();
  }

  function chiSoGanCay(cu) {
    var kd = JSON.stringify(cu.duong);
    for (var i = 0; i < ds.length; i++) if (JSON.stringify(ds[i].duong) === kd && ds[i].noi === cu.noi) return i;
    return 0;
  }

  /** Tinh lai sau 120 ms. nav = true (go trong o tim): nhay toi khop dau tien tu vi tri con tro (tim tang dan);
      false (van ban doi): chi tinh lai, KHONG di chuyen vung chon cua nguoi dang go. */
  function henTinh(nav) {
    clearTimeout(henTim);
    henTim = setTimeout(function () {
      tinh(!nav);
      if (nav && ds.length && !loiTim) diDen(chiSo);
    }, 120);
  }

  /* ----------------------------------------------------------------- nhay toi khop */
  function diDen(i) {
    if (!ds.length) return;
    chiSo = ((i % ds.length) + ds.length) % ds.length;
    var m = ds[chiSo], dangO = document.activeElement === oQ || document.activeElement === oThay, giu = document.activeElement;
    if (ngu() === "cay") APP.denDuong(m.duong, { tab: "cay" });
    else APP.denViTri(m.bd, m.kt);
    if (dangO && giu && giu.focus) { try { giu.focus(); } catch (e) { /* khong focus lai duoc */ } }
    capNhatDem();
    damLai();
  }
  function sau() { if (ds.length) diDen(chiSo + 1); }
  function truoc() { if (ds.length) diDen(chiSo - 1); }

  /* ----------------------------------------------------------------- <mark> */
  function xoaMark(goc) {
    if (!goc || !goc.querySelectorAll) return;
    var ms = goc.querySelectorAll("mark.tim-khop");
    var cha = [];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], p = m.parentNode;
      if (!p) continue;
      p.replaceChild(document.createTextNode(m.textContent), m);
      if (cha.indexOf(p) < 0) cha.push(p);
    }
    for (var j = 0; j < cha.length; j++) if (cha[j].normalize) cha[j].normalize();
  }

  /** Boc cac khoang [{a, b, hien}] (tang dan, khong chong; toa do trong textContent cua `el`) bang <mark>. */
  function boMark(el, khoang) {
    if (!khoang.length) return;
    var nodes = [], off = 0;
    (function duyet(n) {
      var cs = n.childNodes;
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        if (c.nodeType === 3) { nodes.push({ n: c, bd: off }); off += c.nodeValue.length; }
        else if (c.nodeType === 1) duyet(c);
      }
    })(el);
    var ki = 0;
    for (var t = 0; t < nodes.length; t++) {
      var tn = nodes[t], bd = tn.bd, txt = tn.n.nodeValue, kt = bd + txt.length;
      while (ki < khoang.length && khoang[ki].b <= bd) ki++;
      var j = ki, doan = [];
      while (j < khoang.length && khoang[j].a < kt) { doan.push(khoang[j]); j++; }
      if (!doan.length) continue;
      var frag = document.createDocumentFragment(), pos = bd;
      for (var d = 0; d < doan.length; d++) {
        var a = Math.max(doan[d].a, pos), b = Math.min(doan[d].b, kt);
        if (b <= a) continue;
        if (a > pos) frag.appendChild(document.createTextNode(txt.slice(pos - bd, a - bd)));
        var mk = document.createElement("mark");
        mk.className = "tim-khop" + (doan[d].hien ? " tim-hien" : "");
        mk.textContent = txt.slice(a - bd, b - bd);
        frag.appendChild(mk);
        pos = b;
      }
      if (pos < kt) frag.appendChild(document.createTextNode(txt.slice(pos - bd)));
      tn.n.parentNode.replaceChild(frag, tn.n);
    }
  }

  var daChiSo = { s: null, cs: null };
  function chiSoDongCua(s) {
    if (daChiSo.s !== s) { daChiSo = { s: s, cs: APP.tienIch.chiSoCua(s) }; }
    return daChiSo.cs;
  }

  /** To cac khop `ds` (van ban) len cac hang `rows` (hang r = dong tu + r). `cat(row)` tra gioi han so ky tu hien cua hang. */
  function damCacHang(rows, tu, s, layHang, gioiHan) {
    var cs = chiSoDongCua(s), n = cs.length;
    var cur = ds[chiSo];
    for (var r = 0; r < rows.length; r++) {
      var dong = tu + r;
      if (dong >= n) break;
      var ls = cs[dong], le = dong + 1 < n ? cs[dong + 1] - 1 : s.length;
      /* khop dau tien co kt > ls (tim nhi phan) */
      var lo = 0, hi = ds.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (ds[mid].kt > ls) hi = mid; else lo = mid + 1; }
      var khoang = [], hang = layHang(rows[r]);
      if (!hang) continue;
      var tran = gioiHan ? gioiHan(hang) : Infinity;
      for (var i = lo; i < ds.length && ds[i].bd < le; i++) {
        var a = Math.max(ds[i].bd, ls) - ls, b = Math.min(ds[i].kt, le) - ls;
        if (a >= tran) break;
        if (b > tran) b = tran;
        if (b > a) khoang.push({ a: a, b: b, hien: ds[i] === cur });
      }
      if (khoang.length) boMark(hang, khoang);
    }
  }

  function damSoan() {
    var lop = $("#lop-mau");
    if (!lop) return;
    xoaMark(lop);
    if (!mo || !ds.length || !oQ.value) return;
    var s = APP.layVanBan();
    if (APP.cheDoSoan() === "xem") return;
    var cua = lop.querySelector ? lop.querySelector(".mau-cua") : null, rows, tu;
    if (cua) { rows = cua.children; tu = +cua.getAttribute("data-tu") || 0; }
    else { rows = lop.querySelectorAll(".h"); tu = 0; if (!rows.length || s.length > HS.GIOI_HAN_MAU) return; }
    damCacHang(rows, tu, s, function (row) { return row; });
  }

  function damXem() {
    var cua = $("#xem-cua");
    if (!cua || !cua.querySelectorAll) return;
    xoaMark(cua);
    if (!mo || !ds.length || !oQ.value || ngu() !== "soan" || APP.cheDoSoan() !== "xem") return;
    var s = APP.layVanBan(), cs = chiSoDongCua(s), n = cs.length, hangs = cua.querySelectorAll(".xh"), cur = ds[chiSo];
    for (var r = 0; r < hangs.length; r++) {
      var dong = +hangs[r].getAttribute("data-l");
      if (!(dong >= 0) || dong >= n) continue;
      var xn = hangs[r].querySelector(".xn");
      if (!xn || xn.querySelector(".xp")) continue;              /* dong mo khoi gap: bo qua (chu thich nam giua dong) */
      var ls = cs[dong], le = dong + 1 < n ? cs[dong + 1] - 1 : s.length;
      var xc = xn.querySelector(".xc"), tong = xn.textContent.length, tran = tong - (xc ? xc.textContent.length : 0);
      var lo = 0, hi = ds.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (ds[mid].kt > ls) hi = mid; else lo = mid + 1; }
      var khoang = [];
      for (var i = lo; i < ds.length && ds[i].bd < le; i++) {
        var a = Math.max(ds[i].bd, ls) - ls, b = Math.min(ds[i].kt, le) - ls;
        if (a >= tran) break;
        if (b > tran) b = tran;
        if (b > a) khoang.push({ a: a, b: b, hien: ds[i] === cur });
      }
      if (khoang.length) boMark(xn, khoang);
    }
  }

  function damCay() {
    var cay = $("#cay");
    if (!cay || !cay.querySelectorAll) return;
    xoaMark(cay);
    if (!mo || !ds.length || !oQ.value || ngu() !== "cay") return;
    var cur = ds[chiSo], da = Object.create(null), toiDa = Math.min(ds.length, 600), i;
    for (i = 0; i < toiDa; i++) {
      var m = ds[i], nut = APP.nutCay(m.duong);
      if (!nut || !nut._dong) continue;
      var kg = JSON.stringify(m.duong) + "#" + m.noi;
      if (da[kg]) continue;
      da[kg] = 1;
      var el = nut._dong.querySelector(m.noi === "khoa" ? ".khoa" : ".gt");
      if (!el) continue;
      var text = el.textContent, hs = K.timTrongVanBan(text, oQ.value, layTuyChon(), 500), khoang = [], laHienTai = cur && cur.noi === m.noi && JSON.stringify(cur.duong) === JSON.stringify(m.duong);
      for (var h = 0; h < hs.length; h++) khoang.push({ a: hs[h].bd, b: hs[h].kt, hien: laHienTai && h === 0 });
      if (khoang.length) boMark(el, khoang);
    }
  }

  function damLai() {
    if (henDam) return;
    henDam = setTimeout(function () {
      henDam = 0;
      var t = ngu();
      if (t === "soan") { if (APP.cheDoSoan() === "xem") damXem(); else damSoan(); }
      else if (t === "cay") damCay();
    }, 0);
  }

  /* ----------------------------------------------------------------- thay */
  function sauThay(n, them) {
    datBao("Đã thay " + n + " chỗ — Ctrl+Z hoàn tác cả một bước" + (them ? " · " + them : ""), false);
  }

  function thayMot() {
    if (!ds.length || chiSo < 0) return;
    var m = ds[chiSo], thay = oThay ? oThay.value : "";
    if (ngu() === "soan") {
      var s = APP.layVanBan();
      var r = K.thayTrongVanBan(s, [m], thay, { regex: tc.regex, q: oQ.value, hoaThuong: tc.hoaThuong, caTu: tc.caTu });
      var delta = r.s.length - s.length;
      diemBatDau = m.kt + delta;
      APP.datVanBan(r.s, { nhan: "Thay", chon: [m.bd, m.kt + delta] });
      tinh(false);
      if (ds.length) diDen(chiSo);
      sauThay(1);
      return;
    }
    var thuTu = 0, kd = JSON.stringify(m.duong);
    for (var j = chiSo - 1; j >= 0 && ds[j].noi === m.noi && JSON.stringify(ds[j].duong) === kd; j--) thuTu++;
    var goc = APP.layDuLieu();
    var kq = K.thayTrongGiaTri(goc, oQ.value, thay, { hoaThuong: tc.hoaThuong, caTu: tc.caTu, regex: tc.regex, phamVi: tc.phamVi, chi: { duong: m.duong, noi: m.noi, thuTu: thuTu } });
    if (kq.loi) { datBao(kq.loi, true); return; }
    if (!kq.soThay) { datBao(kq.boQua.length ? "Không thay được: " + kq.boQua[0].lyDo : "Không có gì để thay ở khớp này", true); return; }
    APP.apDungGoc(kq.goc, null, m.noi === "khoa" ? m.duong.slice(0, -1) : m.duong, "Thay trên cây");
    tinh(false);
    sauThay(1);
  }

  function thayHet() {
    if (!oQ.value) return;
    var thay = oThay ? oThay.value : "";
    if (ngu() === "soan") {
      var s = APP.layVanBan();
      var r = K.thayTrongVanBan(s, oQ.value, thay, layTuyChon());
      if (r.loi) { datBao(r.loi, true); return; }
      if (!r.soThay) { datBao("Không có gì để thay", true); return; }
      APP.datVanBan(r.s, { nhan: "Thay tất cả (" + r.soThay + ")" });
      tinh(false);
      sauThay(r.soThay);
      return;
    }
    if (!APP.hopLe()) { datBao("JSON chưa hợp lệ — sửa ở tab Soạn rồi thay trên cây", true); return; }
    var kq = K.thayTrongGiaTri(APP.layDuLieu(), oQ.value, thay, layTuyChon());
    if (kq.loi) { datBao(kq.loi, true); return; }
    if (!kq.soThay) { datBao(kq.boQua.length ? "Không thay được: " + kq.boQua[0].lyDo : "Không có gì để thay", true); return; }
    APP.apDungGoc(kq.goc, null, null, "Thay tất cả trên cây (" + kq.soThay + ")");
    tinh(false);
    sauThay(kq.soThay, kq.boQua.length ? "bỏ qua " + kq.boQua.length + " (" + kq.boQua[0].lyDo + (kq.boQua.length > 1 ? "…" : "") + ")" : "");
  }

  /* ----------------------------------------------------------------- mo / dong */
  function chonSan() {
    if (ngu() !== "soan" || !nhap || APP.cheDoSoan() === "xem") return "";
    var a = nhap.selectionStart, b = nhap.selectionEnd;
    if (typeof a !== "number" || b <= a || b - a > 200) return "";
    var t = APP.layVanBan().slice(a, b);
    return t.indexOf("\n") >= 0 ? "" : t;
  }

  function moThanh(thay) {
    if (!ngu()) return false;
    var san = chonSan();
    mo = true;
    if (thay) thayMo = true;
    if (san && oQ) oQ.value = san;
    capNhatThanh();
    if (oQ) { try { oQ.focus(); oQ.select(); } catch (e) { /* khong focus duoc */ } }
    tinh(false);
    return true;
  }

  function dongThanh() {
    if (!mo) return;
    mo = false;
    ds = []; chiSo = -1;
    capNhatThanh();
    var lop = $("#lop-mau"), cua = $("#xem-cua"), cay = $("#cay");
    xoaMark(lop); xoaMark(cua); xoaMark(cay);
    var t = ngu();
    if (t === "soan" && nhap && nhap.focus && APP.cheDoSoan() !== "xem") { try { nhap.focus({ preventScroll: true }); } catch (e) { nhap.focus(); } }
    else if (t === "cay" && cay && cay.querySelector) {
      var n = cay.querySelector('.n[tabindex="0"]');
      if (n && n.focus) n.focus();
    }
  }

  /* ----------------------------------------------------------------- noi day thanh tim */
  if (oQ && oQ.addEventListener) {
    oQ.addEventListener("input", function () { henTinh(true); });
    oQ.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); if (henTim) { clearTimeout(henTim); henTim = 0; tinh(false); } if (e.shiftKey) truoc(); else sau(); }
      else if (e.key === "Escape") { e.preventDefault(); dongThanh(); }
    });
  }
  if (oThay && oThay.addEventListener) {
    oThay.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); if (e.ctrlKey || e.metaKey) thayHet(); else thayMot(); }
      else if (e.key === "Escape") { e.preventDefault(); dongThanh(); }
    });
  }
  function bat(nut, truong) {
    if (!nut) return;
    nut.onclick = function () { tc[truong] = !tc[truong]; luuTuyChon(); capNhatThanh(); tinh(false); if (oQ && oQ.focus) oQ.focus(); };
  }
  bat(nutHoa, "hoaThuong"); bat(nutTu, "caTu"); bat(nutRe, "regex");
  if (chonVi) chonVi.onchange = function () { tc.phamVi = this.value; luuTuyChon(); tinh(false); };
  if ($("#tim-truoc")) $("#tim-truoc").onclick = truoc;
  if ($("#tim-sau")) $("#tim-sau").onclick = sau;
  if ($("#tim-dong")) $("#tim-dong").onclick = dongThanh;
  if (nutMoThay) nutMoThay.onclick = function () { thayMo = !thayMo; capNhatThanh(); if (thayMo && oThay && oThay.focus) oThay.focus(); };
  if ($("#tim-thay-mot")) $("#tim-thay-mot").onclick = thayMot;
  if ($("#tim-thay-het")) $("#tim-thay-het").onclick = thayHet;

  /* phim tat toan trang: Ctrl+F / Ctrl+H / F3 / Ctrl+G (chi o tab Soan va Cay) */
  document.addEventListener("keydown", function (e) {
    var k = String(e.key || ""), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.altKey && !e.shiftKey && (k === "f" || k === "F")) {
      if (ngu() && moThanh(false)) e.preventDefault();
      return;
    }
    if (ctrl && !e.altKey && !e.shiftKey && (k === "h" || k === "H")) {
      if (ngu() && moThanh(true)) e.preventDefault();
      return;
    }
    if (ctrl && !e.altKey && !e.shiftKey && (k === "g" || k === "G")) {
      var o = $("#di-toi");
      if (ngu() && o && o.focus) { e.preventDefault(); o.focus(); if (o.select) o.select(); }
      return;
    }
    if (k === "F3" && (mo || (oQ && oQ.value)) && ngu()) {
      e.preventDefault();
      if (!mo) moThanh(false);
      if (e.shiftKey) truoc(); else sau();
      return;
    }
    if (mo && e.altKey && !ctrl && !e.shiftKey) {
      var c = k.toLowerCase();
      if (c === "c") { e.preventDefault(); if (nutHoa) nutHoa.click(); }
      else if (c === "w") { e.preventDefault(); if (nutTu) nutTu.click(); }
      else if (c === "r") { e.preventDefault(); if (nutRe) nutRe.click(); }
    }
  });

  APP.dangKy("ve-mau", function () { if (mo && ds.length) damSoan(); });
  APP.dangKy("ve-xem", function () { if (mo && ds.length) damXem(); });
  APP.dangKy("ve-cay", function () { if (mo && ds.length && ngu() === "cay") damLai(); });
  APP.dangKy("doi-du-lieu", function () { if (mo) henTinh(false); });
  var tabCu = APP.tabHien();
  APP.dangKy("doi-tab", function (t) {
    /* denViTri / denDuong cung phat "doi-tab" du dang o dung tab do: chi tinh lai khi tab THAT SU doi */
    capNhatThanh();
    if (t !== tabCu) { tabCu = t; if (mo) tinh(false); }
    capNhatDuongConTro();
  });
  APP.dangKy("doi-che-do", function () { if (mo) tinh(true); });
  capNhatThanh();

  /* ====================================================================
     Di toi (Ctrl+G) — dong, dong:cot, JSONPath, JSON Pointer
     ==================================================================== */
  var oDiToi = $("#di-toi");

  /** Phan tich so dong[:cot] bang cach tu quet (khong regex): tra {dong, cot|0} hoac null. */
  function docDongCot(t) {
    var i = 0, a = "", b = "";
    while (i < t.length && t.charCodeAt(i) >= 48 && t.charCodeAt(i) <= 57) a += t.charAt(i++);
    if (!a) return null;
    if (i < t.length && (t.charAt(i) === ":" || t.charAt(i) === ",")) {
      i++;
      while (i < t.length && t.charCodeAt(i) >= 48 && t.charCodeAt(i) <= 57) b += t.charAt(i++);
      if (!b) return null;
    }
    if (i !== t.length) return null;
    return { dong: +a, cot: b ? +b : 0 };
  }

  function diToi(chuoi) {
    var t = String(chuoi || "").trim();
    if (!t) return false;
    var dc = docDongCot(t);
    if (dc) {
      var s = APP.layVanBan(), cs = chiSoDongCua(s), n = cs.length, dong = Math.max(1, Math.min(dc.dong, n));
      var ls = cs[dong - 1], le = dong < n ? cs[dong] - 1 : s.length;
      var vt = dc.cot ? Math.min(ls + dc.cot - 1, le) : ls;
      APP.denViTri(vt, vt);
      APP.thongBao(dc.dong > n ? "Văn bản chỉ có " + n + " dòng — đã tới dòng cuối" : "Dòng " + dong + (dc.cot ? ", cột " + (vt - ls + 1) : ""));
      return true;
    }
    var duong = null, ghiChu = "";
    try {
      if (t.charAt(0) === "/" || t.charAt(0) === "#") duong = JC.conTroSangDuong(t);
      else {
        if (!APP.hopLe()) { APP.thongBao("JSON chưa hợp lệ — JSONPath cần dữ liệu hợp lệ (dùng JSON Pointer /a/0 hoặc số dòng)"); return false; }
        var kq = JP.chay(APP.layDuLieu(), t, 1000, { kieuCu: true });
        if (!kq.length) { APP.thongBao("JSONPath không khớp nút nào"); return false; }
        duong = kq[0].duong;
        if (kq.length > 1) ghiChu = " (" + kq.length + " kết quả — tới cái đầu)";
      }
    } catch (e) { APP.thongBao("Đường dẫn sai: " + (e && e.message ? e.message : e)); return false; }
    var ok = APP.denDuong(duong, { tab: "tu-dong", chon: "gia-tri" });
    APP.thongBao(ok ? "Đã tới " + JC.moTaDuong(duong) + ghiChu : "Không có nút nào ở " + JC.moTaDuong(duong));
    return ok;
  }

  if (oDiToi && oDiToi.addEventListener) {
    oDiToi.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); if (diToi(oDiToi.value)) { oDiToi.value = ""; } }
      else if (e.key === "Escape") { e.preventDefault(); oDiToi.value = ""; oDiToi.blur(); if (ngu() === "soan" && nhap && nhap.focus) nhap.focus(); }
    });
  }

  /* ====================================================================
     Duong dan tai con tro (chan trang): Soan (Sua) theo con tro, Cay theo hang dang chon
     ==================================================================== */
  var elDuong = $("#duong-con-tro"), nutCt = $("#duong-chep-ct"), nutJp = $("#duong-chep-jp");
  var duongHienTai = null, henDuong = 0;

  function hienDuong(duong) {
    duongHienTai = duong;
    if (!elDuong) return;
    var co = !!duong;
    elDuong.hidden = !co; if (nutCt) nutCt.hidden = !co; if (nutJp) nutJp.hidden = !co;
    if (co) {
      elDuong.textContent = JC.moTaDuong(duong);
      elDuong.title = "Vị trí con trỏ: " + JC.moTaDuong(duong) + " · JSON Pointer: " + (JC.duongSangConTro(duong) || "(gốc)");
    } else elDuong.textContent = "";
  }

  function capNhatDuongConTro() {
    clearTimeout(henDuong); henDuong = 0;
    var t = APP.tabHien();
    if (t === "soan" && APP.cheDoSoan() === "sua" && nhap && typeof nhap.selectionStart === "number") {
      var s = APP.layVanBan();
      if (s.length > HS.NGUONG_XEM) { hienDuong(null); return; }
      var r = null;
      try { r = VT.duongTaiViTri(s, nhap.selectionStart); } catch (e) { r = null; }
      hienDuong(r && r.duong ? r.duong : null);
    } else if (t === "cay") {
      var cay = $("#cay"), n = cay && cay.querySelector ? cay.querySelector('.n[tabindex="0"]') : null, p = n ? n.getAttribute("data-p") : null, d = null;
      if (p && p.charAt(0) === "[" && p.indexOf("#") < 0) { try { d = JSON.parse(p); } catch (e2) { d = null; } }
      hienDuong(d);
    } else hienDuong(null);
  }
  function henDuongCon() { clearTimeout(henDuong); henDuong = setTimeout(capNhatDuongConTro, 300); }

  if (nhap && nhap.addEventListener) {
    ["keyup", "click", "input", "focus"].forEach(function (ev) { nhap.addEventListener(ev, henDuongCon); });
  }
  var cayEl = $("#cay");
  if (cayEl && cayEl.addEventListener) cayEl.addEventListener("focusin", henDuongCon);
  if (nutCt) nutCt.onclick = function () { if (duongHienTai) APP.chepVaoBoNho(JC.duongSangConTro(duongHienTai) || "", function () { APP.thongBao("Đã chép JSON Pointer"); }); };
  if (nutJp) nutJp.onclick = function () { if (duongHienTai) APP.chepVaoBoNho(JC.moTaDuong(duongHienTai), function () { APP.thongBao("Đã chép JSONPath"); }); };
  APP.dangKy("doi-du-lieu", henDuongCon);
  APP.dangKy("doi-che-do", henDuongCon);

  /* cho kiem thu / cac module sau */
  window.JE_TIM = {
    mo: function (thay) { return moThanh(!!thay); }, dong: dongThanh, diToi: diToi,
    trang: function () { return { mo: mo, n: ds.length, chiSo: chiSo, catBot: catBot, loi: loiTim, tuyChon: layTuyChon() }; }
  };
})();
