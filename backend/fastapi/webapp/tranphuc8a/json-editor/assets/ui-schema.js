/* =====================================================================
   ui-schema.js — tab "✓ Schema": soan schema, kiem du lieu dang soan theo
   schema (chay trong Worker, co han gio), danh sach loi bam duoc toi
   Cay / van ban / vi tri trong schema, huy hieu loi tren cay va o chan trang.

   Noi chuyen voi loi CHI qua window.JE_APP (nguon su that cua van ban du lieu
   van la #nhap). Moi chu tu du lieu / schema / thong bao loi vao DOM deu
   qua textContent / title (khong innerHTML) nen khong the chen HTML.
   Chi MOT schema hien tai, luu canh ban nhap (localStorage, moi lan doc /
   ghi bo try/catch). Khong tai $ref tu mang.
   ===================================================================== */
(function () {
  "use strict";

  var JE = window.JE, APP = window.JE_APP;
  if (!JE || !APP || !JE.schema || !JE.chayNen || !JE.viTri || !JE.chung || !JE.schemaSinh || !JE.schemaSuy) return;
  var S = JE.schema, CN = JE.chayNen, VT = JE.viTri, CH = JE.chung;
  var THU = window.JE_THU || {};

  var $ = function (s) { return document.querySelector(s); };
  var KHOA_SCHEMA = "json-editor:schema", KHOA_TC = "json-editor:schema-tuy-chon";
  var TRAN_HANG = 300;                                   /* so hang hien moi nhom; "Hiện thêm" cho phan con lai */

  var el = {
    nhap: $("#sc-nhap"), trangThai: $("#sc-trang-thai"), tom: $("#sc-tom"), loi: $("#sc-loi"), chan: $("#sc-chan"),
    goiY: $("#sc-goi-y"), goiYChu: $("#sc-goi-y-chu"), goiYDung: $("#sc-goi-y-dung"), goiYBo: $("#sc-goi-y-bo"),
    mo: $("#sc-mo"), tep: $("#sc-tep"), viDu: $("#sc-vi-du"), dinhDang: $("#sc-dinh-dang"), draft: $("#sc-draft"),
    format: $("#sc-format"), tuDong: $("#sc-tu-kiem"), kiemNgay: $("#sc-kiem-ngay"), hoTro: $("#sc-ho-tro"),
    suy: $("#sc-suy"), suyChat: $("#sc-suy-chat"), suyHoi: $("#sc-suy-hoi"), suyHoiChu: $("#sc-suy-hoi-chu"), suyDongY: $("#sc-suy-dong-y"), suyBo: $("#sc-suy-bo"),
    sinhMo: $("#sc-sinh-mo"), sinh: $("#sc-sinh"), sinhSeed: $("#sc-sinh-seed"), sinhDoi: $("#sc-sinh-doi"), sinhSo: $("#sc-sinh-so"), sinhTile: $("#sc-sinh-tile"),
    sinhSau: $("#sc-sinh-sau"), sinhChay: $("#sc-sinh-chay"), sinhBao: $("#sc-sinh-bao"), sinhXem: $("#sc-sinh-xem"), sinhDung: $("#sc-sinh-dung"),
    sinhChep: $("#sc-sinh-chep"), sinhTai: $("#sc-sinh-tai"), sinhLai: $("#sc-sinh-lai")
  };

  /* ----------------------------------------------------- luu tru */
  function docLuu(khoa) { try { return localStorage.getItem(khoa); } catch (e) { return null; } }
  function ghiLuu(khoa, v) { try { localStorage.setItem(khoa, v); } catch (e) { /* che do rieng tu / day bo nho */ } }

  var tcLuu = {};
  try { tcLuu = JSON.parse(docLuu(KHOA_TC) || "{}") || {}; } catch (e) { tcLuu = {}; }
  var tuyChon = {
    draft: ["tu-dong", "2020-12", "2019-09", "07"].indexOf(tcLuu.draft) >= 0 ? tcLuu.draft : "tu-dong",
    format: ["canh-bao", "loi", "bo-qua"].indexOf(tcLuu.format) >= 0 ? tcLuu.format : "canh-bao",
    tuDong: tcLuu.tuDong !== false
  };
  /* Tuy chon SINH du lieu mau (luu cung khoa; ui giu nguyen truong la khi ghi lai) + "Chat che" cua suy schema. */
  var SINH_MD = { seed: "mau-1", so: 1, tile: 50, sau: 6 };
  function kepSo(x, lo, hi, md) { x = typeof x === "number" ? x : parseFloat(x); return isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : md; }
  var sinhTc = (function () {
    var l = tcLuu.sinh && typeof tcLuu.sinh === "object" ? tcLuu.sinh : {};
    return { seed: typeof l.seed === "string" && l.seed ? l.seed.slice(0, 40) : SINH_MD.seed, so: kepSo(l.so, 1, 100, SINH_MD.so), tile: kepSo(l.tile, 0, 100, SINH_MD.tile), sau: kepSo(l.sau, 1, 12, SINH_MD.sau) };
  })();
  var suyChat = tcLuu.suyChat === true;
  function luuTuyChon() {
    tcLuu = Object.assign({}, tcLuu, { draft: tuyChon.draft, format: tuyChon.format, tuDong: tuyChon.tuDong, sinh: sinhTc, suyChat: suyChat });
    ghiLuu(KHOA_TC, JSON.stringify(tcLuu));
  }

  /* ----------------------------------------------------- tien ich */
  function tao(tag, lop, chu, thuocTinh) {
    var e = document.createElement(tag);
    if (lop) e.className = lop;
    if (chu !== undefined && chu !== null) e.textContent = chu;
    if (thuocTinh) for (var k in thuocTinh) e.setAttribute(k, thuocTinh[k]);
    return e;
  }
  function xoaCon(e) { e.textContent = ""; }

  function coChu(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace(".", ",") + " KB";
    return (n / 1024 / 1024).toFixed(2).replace(".", ",") + " MB";
  }

  /** Doan van ban schema / du lieu: chon [bd, kt) trong mot textarea, focus, cuon toi. */
  function chonTrong(ta, bd, kt) {
    try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    try { ta.setSelectionRange(bd, kt); } catch (e2) { ta.selectionStart = bd; ta.selectionEnd = kt; }
    var s = ta.value, dong = 0;
    for (var k = s.indexOf("\n"); k >= 0 && k < bd; k = s.indexOf("\n", k + 1)) dong++;
    var lh = 19;
    try { var x = parseFloat(window.getComputedStyle(ta).lineHeight); if (x > 0) lh = x; } catch (e3) { /* giu uoc luong */ }
    var h = ta.clientHeight || 0, dich = dong * lh;
    if (dich < (ta.scrollTop || 0) || dich > (ta.scrollTop || 0) + h - 2 * lh) ta.scrollTop = Math.max(0, dich - h / 3);
  }

  /** Ghi vao o schema bang execCommand de Ctrl+Z trong o hoan tac duoc; khong duoc thi gan .value. */
  function ghiSchema(chu) {
    var ok = false;
    try {
      el.nhap.focus({ preventScroll: true });
      if (document.activeElement === el.nhap) {          /* chi chen khi o schema THAT SU dang focus (tab Schema dang hien) */
        el.nhap.select();
        ok = document.execCommand("insertText", false, chu);
      }
    } catch (e) { ok = false; }
    if (!ok || el.nhap.value !== chu) el.nhap.value = chu;
    khiSchemaDoi();
  }

  /* ----------------------------------------------------- trang thai */
  var kq = null;                  /* ket qua gan nhat (xem datKq) */
  var dangKiem = false;
  var seq = 0;
  var soLan = 0;                  /* so lan datKetQua da chay (kiem thu doi ket qua moi) */
  var henKiem = null, henLuu = null;
  var viTriCache = null;          /* {van, map} cho "Van ban" — mot luot timNhieuViTri */
  var dangNen = false, seqNen = 0, kiemBiHuy = false;   /* viec nen sinh / suy dang chay (chung mot Worker voi kiem: lenh moi huy lenh cu) */

  function coSchema() { return el.nhap.value.trim() !== ""; }

  /** JSON.parse schema; loi -> {dong, cot, thongBao}. */
  function parseSchema(chu) {
    try { JSON.parse(chu); return null; }
    catch (e) {
      var vt = THU.viTriLoi ? THU.viTriLoi(e, chu) : null;
      var tb = String(e && e.message || e).replace(/^JSON\.parse:\s*/, "").replace(/\s*in JSON at position \d+.*$/, "").replace(/\s*at position \d+.*$/, "");
      return { dong: vt ? vt.dong : 0, cot: vt ? vt.cot : 0, thongBao: tb };
    }
  }

  function datKetQua(k) {
    kq = k;
    soLan++;
    viTriCache = null;
    ve();
    capNhatHuyHieu();
    capNhatChan();
    capNhatDong();
  }

  /* ----------------------------------------------------- chay kiem */
  function lenhLai(ms) {
    clearTimeout(henKiem);
    henKiem = setTimeout(function () { henKiem = null; chayKiem(false); }, ms);
  }

  function chayKiem(thuCong) {
    clearTimeout(henKiem); henKiem = null;
    if (dangNen) { lenhLai(150); return; }                /* dang sinh / suy: cho xong (lenh nen moi se huy lenh cu) */
    var sc = el.nhap.value;
    if (!sc.trim()) { seq++; dangKiem = false; datKetQua({ tt: "chua-co" }); return; }
    var loiSc = parseSchema(sc);
    if (loiSc) { seq++; dangKiem = false; datKetQua({ tt: "hong-json", loiJson: loiSc }); return; }
    var du = APP.layVanBan(), hopLeDu = APP.hopLe();
    var cu = !du.trim() ? "chua-du-lieu" : !hopLeDu ? "du-lieu-loi" : (du.length > APP.hangSo.NGUONG_KIEM_TU_DONG && !thuCong) ? "can-bam" : null;
    var tc = { format: tuyChon.format, toiDa: 200 };
    if (tuyChon.draft !== "tu-dong") tc.draft = tuyChon.draft;
    var id = ++seq;
    dangKiem = true;
    capNhatChan();
    capNhatTomDangKiem();
    CN.chay(cu ? "lint" : "kiem", { du: cu ? "" : du, schema: sc }, tc).then(function (r) {
      if (id !== seq) return;
      dangKiem = false;
      xuLyKetQua(r, cu, du);
    }).catch(function (e) { dangKiem = false; setTimeout(function () { throw e; }, 0); });
  }

  function xuLyKetQua(r, cu, du) {
    if (r.huy) return;
    var k = { vanBanDu: du, luongChinh: !!r.luongChinh, thoiGianMs: r.kq ? r.kq.thoiGianMs : 0 };
    if (r.hetGio) { k.tt = "het-gio"; k.han = r.hanMs; }
    else if (r.loi) {
      k.tt = r.loi.phan === "schema" ? "hong-json" : r.loi.phan === "du" ? "du-lieu-loi" : "he-thong";
      k.thongBao = r.loi.thongBao;
      if (k.tt === "hong-json") k.loiJson = parseSchema(el.nhap.value) || { dong: 0, cot: 0, thongBao: r.loi.thongBao };
    } else {
      var x = r.kq;
      k.loi = x.loi || []; k.canhBao = x.canhBao || []; k.loiSchema = x.loiSchema || []; k.canhBaoSchema = x.canhBaoSchema || [];
      k.draft = x.draft; k.catBot = !!x.catBot;
      k.tt = k.loiSchema.length ? "hong-schema" : cu ? cu : k.loi.length ? "loi" : "ok";
    }
    datKetQua(k);
  }

  /* ----------------------------------------------------- ve */
  var NHAN_TT = {
    "chua-co": "Chưa có schema — dán JSON Schema vào ô bên trái hoặc chọn “Ví dụ”.",
    "hong-json": "Schema không phải JSON hợp lệ",
    "het-gio": "Kiểm quá lâu",
    "he-thong": "Không kiểm được",
    "chua-du-lieu": "Chưa có dữ liệu — soạn JSON ở tab Soạn rồi quay lại",
    "du-lieu-loi": "Dữ liệu chưa là JSON hợp lệ — sửa ở tab Soạn rồi kiểm lại",
    "can-bam": "Dữ liệu lớn — bấm “Kiểm ngay” để kiểm",
    "chua-kiem": "Chưa kiểm — bấm “Kiểm ngay” (đang tắt “Tự kiểm”)",
    "dang": "Đang kiểm…"
  };

  function capNhatTomDangKiem() {
    el.tom.setAttribute("data-tt", "dang");
    el.tom.className = "sc-tom";
    el.tom.textContent = "Đang kiểm…";
  }

  function chuTom() {
    if (!kq) return coSchema() ? "Đang chuẩn bị kiểm…" : NHAN_TT["chua-co"];
    var tt = kq.tt, c;
    if (tt === "het-gio") {
      return "Kiểm quá lâu (> " + Math.round((kq.han || 8000) / 1000) + " s) — thường do một “pattern” quay lui thảm hoạ (vd (a+)+$); cũng có thể do schema có quá nhiều nhánh anyOf / $ref lồng nhau hoặc dữ liệu quá lớn. Sửa mẫu hoặc đơn giản hoá schema rồi kiểm lại.";
    }
    if (tt === "he-thong") return "Không kiểm được — " + (kq.thongBao || "lỗi không rõ");
    if (tt === "ok") c = "✓ Hợp lệ theo schema";
    else if (tt === "loi") c = "⛔ " + kq.loi.length + " lỗi dữ liệu" + (kq.catBot ? " (đã cắt bớt)" : "");
    else if (tt === "hong-schema") c = "Schema có " + kq.loiSchema.length + " lỗi — kết quả chỉ mang tính tham khảo";
    else return NHAN_TT[tt] || "";
    if (kq.canhBao && kq.canhBao.length) c += " · " + kq.canhBao.length + " cảnh báo";
    if (kq.draft) c += " · draft " + kq.draft;
    if (kq.thoiGianMs) c += " · " + kq.thoiGianMs + " ms";
    return c;
  }

  function lopTom() {
    if (!kq) return "sc-tom";
    var tt = kq.tt;
    return "sc-tom" + (tt === "ok" ? " ok" : (tt === "loi" || tt === "hong-json" || tt === "hong-schema" || tt === "het-gio" || tt === "he-thong") ? " loi" : "");
  }

  function hangNhom(chu, n) {
    return tao("li", "sc-nhom", chu + (n !== undefined ? " (" + n + ")" : ""), { role: "presentation" });
  }

  function nutNho(chu, hd, nhan) {
    var b = tao("button", "nut nho", chu, { type: "button", "data-hd": hd });
    if (nhan) b.setAttribute("aria-label", nhan);
    return b;
  }

  function hangDuLieu(e, i, kieu) {
    var li = tao("li", "sc-hang" + (kieu === "canh-bao" ? " canh" : ""));
    li._e = e; li._kieu = "du";
    var chinh = tao("button", "sc-chinh", null, { type: "button", "data-hd": "chinh", title: "Tới " + e.hien });
    chinh.appendChild(tao("span", "sc-bieu", kieu === "canh-bao" ? "⚠" : "⛔", { "aria-hidden": "true" }));
    chinh.appendChild(tao("code", "sc-duong", e.hien));
    chinh.appendChild(tao("span", "sc-tb", e.thongBao));
    li.appendChild(chinh);
    var hd = tao("span", "sc-hd");
    hd.appendChild(nutNho("Cây", "cay", "Tới nút trên cây: " + e.hien));
    hd.appendChild(nutNho("Văn bản", "soan", "Chọn đoạn văn bản: " + e.hien));
    hd.appendChild(nutNho("▸ schema", "schema", "Tới từ khoá trong schema: " + e.conTroSchema));
    li.appendChild(hd);
    if (e.con && e.con.length) {
      var ct = tao("details", "sc-con");
      ct.appendChild(tao("summary", null, "Nhánh gần đúng nhất (" + e.con.length + " lỗi)"));
      var ul = tao("ul", "sc-con-ds");
      for (var j = 0; j < e.con.length && j < 20; j++) {
        ul.appendChild(tao("li", null, e.con[j].hien + " — " + e.con[j].thongBao));
      }
      ct.appendChild(ul);
      li.appendChild(ct);
    }
    return li;
  }

  function hangSchema(e, kieu) {
    var li = tao("li", "sc-hang" + (kieu === "canh-bao" ? " canh" : ""));
    li._e = e; li._kieu = "sc";
    var chinh = tao("button", "sc-chinh", null, { type: "button", "data-hd": "schema", title: "Tới " + e.conTroSchema });
    chinh.appendChild(tao("span", "sc-bieu", kieu === "canh-bao" ? "⚠" : "⛔", { "aria-hidden": "true" }));
    chinh.appendChild(tao("code", "sc-duong", e.conTroSchema));
    chinh.appendChild(tao("span", "sc-tb", e.thongBao));
    li.appendChild(chinh);
    return li;
  }

  /** Them cac hang cua mot nhom (toi da TRAN_HANG, con lai sau nut "Hiện thêm"). */
  function themNhom(ds, tieuDe, dung, kieu) {
    if (!ds || !ds.length) return;
    el.loi.appendChild(hangNhom(tieuDe, ds.length));
    var da = 0, mo = null;
    function chen(li) { if (mo && mo.parentNode) el.loi.insertBefore(li, mo); else el.loi.appendChild(li); }
    function them(den) { for (; da < den && da < ds.length; da++) chen(dung(ds[da], da, kieu)); }
    them(TRAN_HANG);
    if (da < ds.length) {
      mo = tao("li", "sc-them");
      var b = tao("button", "nut nho", null, { type: "button" });
      var nhan = function () { b.textContent = "Hiện thêm " + Math.min(TRAN_HANG, ds.length - da) + " (còn " + (ds.length - da) + ")"; };
      nhan();
      b.onclick = function () {
        them(da + TRAN_HANG);
        if (da >= ds.length) { if (mo.parentNode) mo.parentNode.removeChild(mo); }
        else nhan();
      };
      mo.appendChild(b);
      el.loi.appendChild(mo);
    }
  }

  function ve() {
    xoaCon(el.loi);
    var tt = kq ? kq.tt : "chua-co";
    el.tom.setAttribute("data-tt", tt);
    el.tom.className = lopTom();
    var chu = chuTom();
    if (kq && kq.cu) chu += " (kết quả cũ — dữ liệu đã đổi)";
    el.tom.textContent = chu;
    if (kq && kq.luongChinh && kq.tt !== "chua-co") {
      el.tom.appendChild(tao("span", "sc-chip", "luồng chính", { title: "Trình duyệt không chạy được Worker nên kiểm ngay trên luồng chính: pattern quay lui thảm hoạ có thể làm treo trang" }));
    }
    if (!kq || !(kq.loiSchema || kq.loi || kq.canhBao || kq.canhBaoSchema)) return;
    themNhom(kq.loiSchema, "Lỗi schema", hangSchema, "loi");
    themNhom(kq.loi, kq.loiSchema && kq.loiSchema.length ? "Lỗi dữ liệu (tham khảo)" : "Lỗi dữ liệu", hangDuLieu, "loi");
    themNhom(kq.canhBao, "Cảnh báo (format…)", hangDuLieu, "canh-bao");
    themNhom(kq.canhBaoSchema, "Cảnh báo về schema", hangSchema, "canh-bao");
  }

  /** Dong trang thai duoi o schema: loi cu phap JSON (dong, cot) hoac tom tat lint. */
  function capNhatDong() {
    var t = el.trangThai;
    t.className = "sc-trang-thai";
    if (!coSchema()) { t.textContent = ""; return; }
    var lj = kq && kq.tt === "hong-json" ? kq.loiJson : parseSchema(el.nhap.value);
    if (lj) {
      t.className = "sc-trang-thai loi";
      t.textContent = "Schema: lỗi cú pháp JSON" + (lj.dong ? " ở dòng " + lj.dong + ", cột " + lj.cot : "") + " — " + lj.thongBao;
      return;
    }
    if (kq && kq.loiSchema && kq.loiSchema.length) {
      t.className = "sc-trang-thai loi";
      t.textContent = kq.loiSchema.length + " lỗi schema — " + kq.loiSchema[0].thongBao + (kq.loiSchema.length > 1 ? " …" : "");
      return;
    }
    t.textContent = "JSON Schema hợp lệ về cú pháp" + (kq && kq.draft ? " · draft " + kq.draft : "") +
      (kq && kq.canhBaoSchema && kq.canhBaoSchema.length ? " · " + kq.canhBaoSchema.length + " cảnh báo" : "");
  }

  /* ----------------------------------------------------- huy hieu */
  function capNhatHuyHieu() {
    if (!kq || !kq.loi || !kq.loi.length || kq.cu) { APP.datHuyHieuCay(null); return; }
    var map = new Map();
    for (var i = 0; i < kq.loi.length && i < 10000; i++) {
      var e = kq.loi[i], d = e.duong, k = JSON.stringify(d), h = map.get(k);
      if (!h) { h = { a: [], b: 0 }; map.set(k, h); }
      h.a.push(e.thongBao);
      for (var p = d.length - 1; p >= 0; p--) {
        var ka = JSON.stringify(d.slice(0, p)), ha = map.get(ka);
        if (!ha) { ha = { a: [], b: 0 }; map.set(ka, ha); }
        ha.b++;
      }
    }
    APP.datHuyHieuCay(map);
  }

  function capNhatChan() {
    var b = el.chan;
    if (!b) return;
    var chu = "", lop = "huy-hieu-chan", tt = kq ? kq.tt : "chua-co";
    if (!coSchema()) { b.hidden = true; return; }
    if (dangKiem) { chu = "Schema: đang kiểm…"; lop += " mo"; }
    else if (kq && kq.cu) { chu = "Schema: chưa kiểm lại"; lop += " mo"; }
    else if (tt === "hong-json") { chu = "Schema hỏng"; lop += " loi"; }
    else if (tt === "hong-schema") { chu = "Schema hỏng · " + kq.loiSchema.length + " lỗi"; lop += " loi"; }
    else if (tt === "het-gio") { chu = "Schema: hết giờ"; lop += " loi"; }
    else if (tt === "he-thong") { chu = "Schema: không kiểm được"; lop += " loi"; }
    else if (tt === "loi") { chu = "Schema: " + kq.loi.length + " lỗi"; lop += " loi"; }
    else if (tt === "ok") { chu = "Schema ✓" + (kq.canhBao.length ? " · " + kq.canhBao.length + " cảnh báo" : ""); lop += " ok"; }
    else if (tt === "du-lieu-loi") { chu = "Schema: chờ JSON hợp lệ"; lop += " mo"; }
    else if (tt === "chua-du-lieu") { chu = "Schema: chưa có dữ liệu"; lop += " mo"; }
    else if (tt === "can-bam" || tt === "chua-kiem") { chu = "Schema: chưa kiểm"; lop += " mo"; }
    else { chu = "Schema"; lop += " mo"; }
    b.hidden = false;
    b.className = lop;
    b.textContent = chu;
    b.setAttribute("data-tt", dangKiem ? "dang" : kq && kq.cu ? "cu" : tt);
  }

  /* ----------------------------------------------------- nhay toi vi tri */
  function nhayVanBan(e) {
    var van = APP.layVanBan(), vt = null;
    if (kq && kq.loi && van === kq.vanBanDu) {
      if (!viTriCache || viTriCache.van !== van) {
        viTriCache = { van: van, map: VT.timNhieuViTri(van, kq.loi.concat(kq.canhBao || []).map(function (x) { return x.duong; })) };
      }
      vt = viTriCache.map.get(JSON.stringify(e.duong));
    }
    if (!vt) vt = VT.timViTri(van, e.duong);
    if (!vt) { APP.thongBao("Không tìm thấy vị trí văn bản của " + e.hien + " (dữ liệu đã đổi?)"); return false; }
    var bd = vt.bd, kt = vt.kt;
    if (e.chiTiet && e.chiTiet.laKhoa && vt.khoaBd >= 0) { bd = vt.khoaBd; kt = vt.khoaKt; }
    else {
      var c = van.charAt(bd);
      if (c === "{" || c === "[") kt = bd + 1;           /* khoi lon: chi chon ngoac mo */
      else if (kt - bd > 200) kt = bd + 200;
    }
    return APP.denViTri(bd, kt);
  }

  function nhayCay(e) {
    if (!APP.hopLe()) { APP.thongBao("Dữ liệu đang lỗi JSON — xem ở tab Soạn"); return false; }
    var ok = APP.denDuong(e.duong, { tab: "cay" });
    if (!ok) APP.thongBao("Không tìm thấy nút ở " + e.hien + " trên cây (dữ liệu đã đổi?)");
    return ok;
  }

  /** Chon TU KHOA co loi trong o schema (token khoa); khong co thi chon gia tri / to tien gan nhat. */
  function nhaySchema(conTroSc) {
    APP.chuyenTab("schema");
    if (!conTroSc || conTroSc.charAt(0) !== "#") { APP.thongBao("Lỗi nằm ở schema bên ngoài (thư viện) — không có trong ô này"); return false; }
    var duong;
    try { duong = CH.conTroSangDuong(conTroSc); } catch (x) { return false; }
    var van = el.nhap.value, vt = VT.timViTri(van, duong);
    while (!vt && duong.length) { duong = duong.slice(0, -1); vt = VT.timViTri(van, duong); }
    if (!vt) { chonTrong(el.nhap, 0, 0); return false; }
    var bd = vt.bd, kt = vt.kt;
    if (vt.khoaBd >= 0) { bd = vt.khoaBd; kt = vt.khoaKt; }
    else if (kt - bd > 200) kt = bd + 1;
    chonTrong(el.nhap, bd, kt);
    return true;
  }

  el.loi.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("button") : null;
    if (!b || !el.loi.contains(b)) return;
    var li = b.closest("li");
    if (!li || !li._e) return;
    var hd = b.getAttribute("data-hd"), e = li._e;
    if (li._kieu === "sc") { nhaySchema(e.conTroSchema); return; }
    if (hd === "cay") nhayCay(e);
    else if (hd === "soan") nhayVanBan(e);
    else if (hd === "schema") nhaySchema(e.conTroSchema);
    else if (APP.tabDuLieuGan() === "soan") nhayVanBan(e);
    else nhayCay(e);
  });

  /* ----------------------------------------------------- su kien */
  /** Schema hoac du lieu vua doi: tu kiem (chayKiem tu quyet dinh kiem du hay chi lint khi du lieu lon) hoac danh dau "cu". */
  function lenhTuDong() {
    if (!coSchema()) return;
    if (tuyChon.tuDong) lenhLai(400);
    else if (!kq || kq.tt === "chua-co") datKetQua({ tt: "chua-kiem" });
    else if (!kq.cu) { kq.cu = true; ve(); capNhatHuyHieu(); capNhatChan(); }
  }

  function khiSchemaDoi() {
    if (typeof danhDauSinhCu === "function") danhDauSinhCu();
    clearTimeout(henLuu);
    henLuu = setTimeout(function () { henLuu = null; ghiLuu(KHOA_SCHEMA, el.nhap.value); }, 300);
    capNhatDong();
    capNhatChan();
    if (!coSchema()) { seq++; dangKiem = false; datKetQua({ tt: "chua-co" }); return; }
    lenhTuDong();
  }
  el.nhap.addEventListener("input", khiSchemaDoi);

  APP.dangKy("doi-du-lieu", lenhTuDong);

  function khiDoiTuyChon() {
    tuyChon.draft = el.draft.value;
    tuyChon.format = el.format.value;
    tuyChon.tuDong = !!el.tuDong.checked;
    luuTuyChon();
    if (coSchema() && (tuyChon.tuDong || kq)) chayKiem(false);
  }
  el.draft.addEventListener("change", khiDoiTuyChon);
  el.format.addEventListener("change", khiDoiTuyChon);
  el.tuDong.addEventListener("change", khiDoiTuyChon);
  el.kiemNgay.onclick = function () { chayKiem(true); };
  el.chan.onclick = function () { APP.chuyenTab("schema"); };

  /* "Dinh dang schema" */
  el.dinhDang.onclick = function () {
    var sc = el.nhap.value;
    if (!sc.trim()) return;
    var v;
    try { v = JSON.parse(sc); } catch (e) { capNhatDong(); return; }
    var cu = sc.match(/^[\t ]*\{\n(\t| +)"/);                  /* giu thut hien co neu co: 2 / 4 / tab */
    var thut = cu ? (cu[1] === "\t" ? "\t" : cu[1].length) : 2;
    ghiSchema(JSON.stringify(v, null, thut));
  };

  /* "Mo schema" tu tep */
  el.mo.onclick = function () { el.tep.click(); };
  el.tep.onchange = function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { ghiSchema(String(r.result)); };
    r.readAsText(f);
    ev.target.value = "";
  };

  /* ----------------------------------------------------- vi du */
  var VI_DU = [
    {
      ten: "Người dùng (cơ bản)",
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema", title: "Người dùng", type: "object", required: ["id", "ten", "email"],
        properties: {
          id: { type: "integer", minimum: 1 }, ten: { type: "string", minLength: 2, maxLength: 40 }, email: { type: "string", format: "email" },
          tuoi: { type: "integer", minimum: 0, maximum: 150 }, vaiTro: { enum: ["admin", "editor", "viewer"] },
          tags: { type: "array", items: { type: "string" }, uniqueItems: true }
        },
        additionalProperties: false
      },
      du: { id: 0, ten: "A", email: "khong-phai-email", tuoi: 200, vaiTro: "root", tags: ["a", "a"], thua: true }
    },
    {
      ten: "Đơn hàng ($defs, $ref, format, pattern)",
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema", title: "Đơn hàng", type: "object", required: ["ma", "ngay", "dong"],
        properties: {
          ma: { type: "string", pattern: "^DH-[0-9]{4}$" }, ngay: { type: "string", format: "date" },
          khach: { $ref: "#/$defs/khach" }, dong: { type: "array", minItems: 1, items: { $ref: "#/$defs/dong" } }
        },
        $defs: {
          khach: { type: "object", required: ["ten"], properties: { ten: { type: "string" }, sdt: { type: "string", pattern: "^0[0-9]{9}$" } } },
          dong: { type: "object", required: ["sp", "sl"], properties: { sp: { type: "string" }, sl: { type: "integer", exclusiveMinimum: 0 }, gia: { type: "number", multipleOf: 0.01 } } }
        }
      },
      du: { ma: "DH-12", ngay: "2024-02-30", khach: { sdt: "123" }, dong: [{ sp: "Bút", sl: 2, gia: 1.5 }, { sp: "Vở", sl: 0, gia: 2.505 }] }
    },
    {
      ten: "Cây đệ quy ($ref: #)",
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", required: ["ten"],
        properties: { ten: { type: "string" }, con: { type: "array", items: { $ref: "#" } } }
      },
      du: { ten: "gốc", con: [{ ten: "a", con: [{ ten: 1 }] }, { con: [] }] }
    },
    {
      ten: "Draft-07 (tuple, dependencies, if/then)",
      schema: {
        $schema: "http://json-schema.org/draft-07/schema#", type: "object",
        properties: { toaDo: { type: "array", items: [{ type: "number" }, { type: "number" }], additionalItems: false }, loai: { enum: ["vuong", "tron"] } },
        dependencies: { loai: ["toaDo"] },
        if: { properties: { loai: { const: "tron" } }, required: ["loai"] },
        then: { required: ["banKinh"], properties: { banKinh: { type: "number", exclusiveMinimum: 0 } } }
      },
      du: { loai: "tron", toaDo: [1, "2", 3] }
    }
  ];
  (function () {
    var o0 = tao("option", null, "Chọn…");
    o0.value = "";
    el.viDu.appendChild(o0);
    VI_DU.forEach(function (v, i) { var o = tao("option", null, v.ten); o.value = String(i); el.viDu.appendChild(o); });
  })();
  el.viDu.addEventListener("change", function () {
    var i = el.viDu.value === "" ? -1 : +el.viDu.value, v = VI_DU[i];
    el.viDu.value = "";
    if (!v) return;
    ghiSchema(JSON.stringify(v.schema, null, 2));
    if (!APP.layVanBan().trim()) APP.datVanBan(JSON.stringify(v.du, null, 2), { nhan: "Dữ liệu mẫu cho schema" });
    APP.thongBao("Đã chèn ví dụ “" + v.ten + "”");
  });

  /* ----------------------------------------------------- bang tu khoa ho tro */
  (function () {
    var tb = tao("table", "sc-bang");
    var dau = tao("tr");
    ["Từ khoá", "Draft", "Hỗ trợ", "Ghi chú"].forEach(function (c) { dau.appendChild(tao("th", null, c)); });
    tb.appendChild(dau);
    var NHAN = { co: "Có", "mot-phan": "Một phần", khong: "Chưa" };
    S.tuKhoaHoTro.forEach(function (x) {
      var tr = tao("tr", "sc-h-" + x.muc);
      tr.appendChild(tao("td", null, x.tu));
      tr.appendChild(tao("td", null, x.draft));
      tr.appendChild(tao("td", null, NHAN[x.muc] || x.muc));
      tr.appendChild(tao("td", null, x.ghiChu));
      tb.appendChild(tr);
    });
    el.hoTro.appendChild(tb);
  })();

  /* ----------------------------------------------------- mo tep trong nhu schema */
  var tepGoiY = null;
  APP.dangKy("mo-tep", function (t) {
    var v;
    try { v = JSON.parse(t.vanBan); } catch (e) { return; }
    if (!S.trongNhuSchema(v)) { el.goiY.hidden = true; return; }
    tepGoiY = t;
    el.goiYChu.textContent = "Tệp “" + t.ten + "” trông như một JSON Schema.";
    el.goiY.hidden = false;
  });
  el.goiYBo.onclick = function () { el.goiY.hidden = true; tepGoiY = null; };
  el.goiYDung.onclick = function () {
    var t = tepGoiY;
    el.goiY.hidden = true; tepGoiY = null;
    if (!t) return;
    if (APP.layVanBan() === t.vanBan && /^Mở tệp/.test(APP.lichSu().nhanHoanTac || "")) APP.hoanTac();   /* tra du lieu ve ban truoc khi mo tep */
    APP.chuyenTab("schema");                                /* hien o schema TRUOC khi ghi (focus + execCommand can o dang hien) */
    ghiSchema(t.vanBan);
  };

  /* ----------------------------------------------------- viec nen: sinh du lieu mau + suy schema (J4) */
  /** Chay mot lenh nen (sinh / suy) tren Worker chung. Neu dang kiem thi kiem bi huy -> chay lai sau khi xong. */
  function batDauNen(loai, du, tc, xong) {
    var id = ++seqNen;
    if (dangKiem) kiemBiHuy = true;
    dangNen = true;
    CN.chay(loai, du, tc).then(function (r) {
      if (id !== seqNen) { xong(r); return; }              /* bi viec nen moi hon thay: r = {huy:true}, de nguoi goi don trang thai "dang chay" */
      dangNen = false;
      xong(r);
      if (kiemBiHuy) { kiemBiHuy = false; chayKiem(false); }
    }).catch(function (e) { if (id === seqNen) dangNen = false; setTimeout(function () { throw e; }, 0); });
    return id;
  }
  function hanNen() { var h = CN.cauHinh && CN.cauHinh.han; return Math.round((h || 8000) / 1000); }

  /* --- sinh du lieu mau --- */
  var sinh = { kq: null, text: "", id: 0, soLan: 0, cu: false };
  /** Schema vua doi sau khi sinh: ban xem truoc khong con khop schema — lam mo + nhac, khong xoa (van dung duoc). */
  function danhDauSinhCu() {
    if (!sinh || !sinh.kq || sinh.cu || el.sinhBao.getAttribute("data-tt") === "dang") return;
    sinh.cu = true;
    el.sinhXem.classList.add("cu");
    el.sinhBao.appendChild(tao("span", "sc-chip", "schema đã đổi — bấm “Sinh” để cập nhật"));
  }
  var TRAN_XEM = 200000, TRAN_TO_MAU = 100000;

  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function datBaoSinh(tt, chu, ds) {
    el.sinhBao.setAttribute("data-tt", tt);
    el.sinhBao.textContent = chu;
    if (ds && ds.length) {
      var ul = tao("ul", "sc-khong-dam");
      for (var i = 0; i < ds.length && i < 4; i++) ul.appendChild(tao("li", null, (ds[i].conTroSchema ? ds[i].conTroSchema + " — " : "") + ds[i].lyDo));
      if (ds.length > 4) ul.appendChild(tao("li", null, "… và " + (ds.length - 4) + " điểm khác"));
      el.sinhBao.appendChild(ul);
    }
  }
  function veXem(txt) {
    if (!txt) { el.sinhXem.textContent = ""; return; }
    var cat = txt.length > TRAN_XEM ? txt.slice(0, TRAN_XEM) + "\n… (đã cắt khi xem — " + coChu(txt.length) + " tất cả; “Dùng làm dữ liệu” / “Chép” / “Tải” dùng đủ)" : txt;
    /* toMau thoat HTML tung ky tu; neu thieu thi tu thoat bang esc(). */
    if (cat.length <= TRAN_TO_MAU) el.sinhXem.innerHTML = THU.toMau ? THU.toMau(cat) : esc(cat);
    else el.sinhXem.textContent = cat;
  }
  function batNutSinh(co) { el.sinhDung.disabled = el.sinhChep.disabled = el.sinhTai.disabled = !co; }

  function docSinhTc() {
    sinhTc = {
      seed: (el.sinhSeed.value || "").slice(0, 40) || SINH_MD.seed, so: kepSo(el.sinhSo.value, 1, 100, SINH_MD.so),
      tile: kepSo(el.sinhTile.value, 0, 100, SINH_MD.tile), sau: kepSo(el.sinhSau.value, 1, 12, SINH_MD.sau)
    };
    el.sinhSeed.value = sinhTc.seed; el.sinhSo.value = sinhTc.so; el.sinhTile.value = sinhTc.tile; el.sinhSau.value = sinhTc.sau;
    luuTuyChon();
    return sinhTc;
  }

  function chaySinh() {
    var sc = el.nhap.value;
    if (!sc.trim()) {
      datBaoSinh("loi", "Chưa có schema — dán JSON Schema vào ô bên trái hoặc chọn “Ví dụ” rồi sinh.");
      batNutSinh(false); veXem(""); sinh.kq = null; sinh.text = "";
      return;
    }
    var lj = parseSchema(sc);
    if (lj) { datBaoSinh("loi", "Schema không phải JSON hợp lệ" + (lj.dong ? " (dòng " + lj.dong + ", cột " + lj.cot + ")" : "") + " — sửa rồi sinh lại."); return; }
    var t = docSinhTc();
    var tc = { seed: t.seed, soLuong: t.so, tiLeTuyChon: t.tile / 100, doSauToiDa: t.sau };
    if (tuyChon.draft !== "tu-dong") tc.draft = tuyChon.draft;
    datBaoSinh("dang", "Đang sinh…");
    var id = ++sinh.id;
    batDauNen("sinh", { schema: sc }, tc, function (r) { if (id === sinh.id) xuLySinh(r); });
  }

  function xuLySinh(r) {
    if (r.huy) { datBaoSinh("chua", "Đã dừng vì có việc nền mới hơn (suy schema / sinh khác) — bấm “Sinh” để chạy lại."); return; }
    sinh.soLan++;
    if (r.hetGio) { datBaoSinh("het-gio", "Sinh quá lâu (> " + hanNen() + " s) — thường do một “pattern” quay lui thảm hoạ hoặc schema quá phình. Đơn giản hoá schema rồi thử lại."); return; }
    if (r.loi) { datBaoSinh("loi", r.loi.phan === "schema" ? "Schema không phải JSON hợp lệ — sửa rồi sinh lại." : "Không sinh được — " + (r.loi.thongBao || "lỗi không rõ")); return; }
    var k = r.kq;
    sinh.kq = k;
    sinh.cu = false;
    el.sinhXem.classList.remove("cu");
    sinh.text = JSON.stringify(k.giaTri, null, 2);
    if (sinh.text === undefined) sinh.text = "null";
    veXem(sinh.text);
    batNutSinh(true);
    var ms = k.thoiGianMs ? " · " + k.thoiGianMs + " ms" : "";
    if (r.luongChinh) ms += " · luồng chính (trình duyệt không có Worker: pattern xấu có thể làm treo trang)";
    if (k.hopLe) {
      var chu = "✔ Hợp lệ theo schema (" + k.soLanThu + " lần thử" + (k.soLuong > 1 ? ", " + k.soLuong + " mẫu" : "") + ") · seed " + k.seed + ms;
      if (k.ghiChu && k.ghiChu.length) chu += " · " + k.ghiChu.length + " lưu ý";
      if (k.loiSchema && k.loiSchema.length) { datBaoSinh("khong-dam-bao", chu + " · ⚠ schema có " + k.loiSchema.length + " lỗi — mẫu chỉ mang tính tham khảo"); return; }
      datBaoSinh("ok", chu);
    } else {
      datBaoSinh("khong-dam-bao", "⚠ Không đảm bảo hợp lệ (mẫu gần đúng nhất ở dưới) · seed " + k.seed + ms, k.khongDamBao);
    }
  }

  function chepVanBan(t, xong) {
    function du() {
      var ta = tao("textarea", null, t, { "aria-hidden": "true", tabindex: "-1" });
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      xong(ok);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(function () { xong(true); }, du); return; }
    } catch (e) { /* roi ve du phong */ }
    du();
  }

  function moSinh(mo) {
    el.sinh.hidden = !mo;
    el.sinhMo.setAttribute("aria-expanded", mo ? "true" : "false");
  }
  el.sinhMo.onclick = function () {
    var mo = el.sinh.hidden;
    moSinh(mo);
    if (mo && !sinh.kq) chaySinh();
  };
  el.sinhChay.onclick = chaySinh;
  el.sinhLai.onclick = function () {
    var m = /^([\s\S]*?)(\d+)$/.exec(el.sinhSeed.value || "");          /* chuoi so cuoi + 1 (mau-1 -> mau-2; abc -> abc1) */
    el.sinhSeed.value = (m ? m[1] + (parseInt(m[2], 10) + 1) : (el.sinhSeed.value || SINH_MD.seed) + "1").slice(0, 40);
    chaySinh();
  };
  el.sinhDoi.onclick = function () {
    el.sinhSeed.value = Math.random().toString(36).slice(2, 8);
    chaySinh();
  };
  [el.sinhSeed, el.sinhSo, el.sinhTile, el.sinhSau].forEach(function (e) {
    e.addEventListener("change", function () { docSinhTc(); });
    e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); chaySinh(); } });
  });
  el.sinhDung.onclick = function () {
    if (!sinh.text) return;
    APP.datVanBan(sinh.text, { nhan: "Sinh dữ liệu mẫu" });
    APP.thongBao("Đã dùng mẫu làm dữ liệu — Ctrl+Z để hoàn tác");
  };
  el.sinhChep.onclick = function () {
    if (!sinh.text) return;
    chepVanBan(sinh.text, function (ok) { APP.thongBao(ok ? "Đã chép dữ liệu mẫu" : "Không chép được — trình duyệt chặn clipboard"); });
  };
  el.sinhTai.onclick = function () {
    if (!sinh.text) return;
    var b = new Blob([sinh.text], { type: "application/json" }), a = document.createElement("a"), u = URL.createObjectURL(b);
    a.href = u; a.download = "du-lieu-mau.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
  };

  /* --- suy schema tu du lieu --- */
  var suyCho = null;              /* schema suy ra dang cho nguoi dung xac nhan ghi de */
  function anSuyHoi() { el.suyHoi.hidden = true; suyCho = null; }
  function chaySuy() {
    var du = APP.layVanBan();
    if (!du.trim()) { APP.thongBao("Chưa có dữ liệu — soạn JSON ở tab Soạn rồi bấm “Suy schema từ dữ liệu”"); return; }
    if (!APP.hopLe()) { APP.thongBao("Dữ liệu chưa là JSON hợp lệ — sửa ở tab Soạn rồi bấm lại"); return; }
    el.suy.disabled = true;
    var tc = { draft: tuyChon.draft === "07" ? "07" : "2020-12", chat: !!el.suyChat.checked };
    batDauNen("suy", { du: du }, tc, function (r) {
      el.suy.disabled = false;
      if (r.huy) return;
      if (r.hetGio) { APP.thongBao("Suy schema quá lâu (> " + hanNen() + " s) — dữ liệu quá lớn?"); return; }
      if (r.loi) { APP.thongBao("Không suy được schema — " + (r.loi.thongBao || "lỗi không rõ")); return; }
      apDungSuy(JSON.stringify(r.kq.schema, null, 2));
    });
  }
  function apDungSuy(text) {
    if (coSchema() && el.nhap.value.trim() !== text.trim()) {
      suyCho = text;
      el.suyHoiChu.textContent = "Schema hiện có (" + coChu(el.nhap.value.length) + ") sẽ bị thay bằng schema suy ra từ dữ liệu (" + coChu(text.length) + "). Ctrl+Z trong ô schema hoàn tác được.";
      el.suyHoi.hidden = false;
      return;
    }
    anSuyHoi();
    ghiSchema(text);
    APP.thongBao("Đã suy schema từ dữ liệu");
  }
  el.suy.onclick = chaySuy;
  el.suyDongY.onclick = function () {
    var t = suyCho;
    anSuyHoi();
    if (t === null) return;
    APP.chuyenTab("schema");
    ghiSchema(t);
    APP.thongBao("Đã ghi đè schema bằng schema suy từ dữ liệu — Ctrl+Z trong ô schema để hoàn tác");
  };
  el.suyBo.onclick = anSuyHoi;
  el.suyChat.addEventListener("change", function () { suyChat = !!el.suyChat.checked; luuTuyChon(); });

  /* ----------------------------------------------------- khoi dong */
  el.draft.value = tuyChon.draft;
  el.sinhSeed.value = sinhTc.seed; el.sinhSo.value = sinhTc.so; el.sinhTile.value = sinhTc.tile; el.sinhSau.value = sinhTc.sau;
  el.suyChat.checked = suyChat;
  el.format.value = tuyChon.format;
  el.tuDong.checked = tuyChon.tuDong;
  var luu = docLuu(KHOA_SCHEMA);
  if (luu) el.nhap.value = luu;
  capNhatDong();
  capNhatChan();
  ve();
  if (coSchema()) { if (tuyChon.tuDong) lenhLai(60); else datKetQua({ tt: "chua-kiem" }); }

  JE.uiSchema = {
    ketQua: function () { return kq; },
    soLan: function () { return soLan; },
    chay: chayKiem,
    nhaySchema: nhaySchema,
    sinh: { chay: chaySinh, ketQua: function () { return sinh.kq; }, text: function () { return sinh.text; }, soLan: function () { return sinh.soLan; } },
    suy: chaySuy,
    viDu: VI_DU
  };
})();
