/* =====================================================================
   ui-sua.js — nut "🩹 Sua loi" (chan trang) + hop XEM TRUOC cac cho sua tu dong cho JSON hong.

   Ruot la assets/sua-json.js (thuan, da kiem). O day chi la giao dien:
   - nut hien khi JSON dang hong (va co noi dung);
   - bam nut: chay JE.suaJson.sua tren van ban hien tai, liet ke "dong 3: Bo dau phay thua" kem doan
     truoc → sau; bam mot dong de toi cho do (khong doi gi); cho mo ho thi DUNG o do va bao ro (khong doan bua);
   - "Ap dung" = MOT buoc hoan tac (datVanBan, nhan "Sua JSON hong"), Ctrl+Z ve ban hong;
   - van ban chua JSON hop le: nut an. Nhieu gia tri o goc: o dau "Gop thanh mot mang" de tuy chon.
   Chu tu du lieu chi vao DOM bang textContent.
   ===================================================================== */
(function () {
  "use strict";

  var APP = window.JE_APP, JE = window.JE;
  if (!APP || !JE || !JE.suaJson) throw new Error("ui-sua.js cần json-editor.js (JE_APP) và sua-json.js nạp trước");
  var SJ = JE.suaJson;

  var $ = function (s) { return document.querySelector(s); };
  var nut = $("#sua-loi-nut"), hop = $("#hop-sua"), ds = $("#hop-sua-ds"), tom = $("#hop-sua-tom"), bao = $("#hop-sua-bao");
  var nutAp = $("#hop-sua-ap"), nutHuy = $("#hop-sua-huy"), nutDong = $("#hop-sua-dong");
  var nhanGop = $("#hop-sua-gop-nhan"), hopGop = $("#hop-sua-gop");

  var ket = null, vbGoc = null;                   /* ket qua sua dang xem va van ban goc cua no */

  function catGiua(s, n) {
    s = String(s);
    return s.length <= n ? s : s.slice(0, Math.floor(n / 2)) + "…" + s.slice(s.length - Math.floor(n / 2));
  }
  function hienXuongDong(s) { return String(s).replace(/\r/g, "␍").replace(/\n/g, "↵").replace(/\t/g, "⇥"); }

  /** Mot dong "truoc → sau" quanh cho sua, dung phan tu <del> / <ins>. */
  function xemTruocSua(x) {
    var bd = Math.max(0, x.bd - 14), kt = Math.min(vbGoc.length, x.kt + 14);
    var truoc = vbGoc.slice(bd, x.bd), giua = vbGoc.slice(x.bd, x.kt), sau = vbGoc.slice(x.kt, kt);
    var d = document.createElement("div");
    d.className = "sua-xem";
    function hang(nhan, noiDung, lop) {
      var r = document.createElement("div"), l = document.createElement("span"), t = document.createElement("code");
      l.className = "sua-nhan"; l.textContent = nhan;
      t.appendChild(document.createTextNode((bd > 0 ? "…" : "") + hienXuongDong(truoc)));
      if (noiDung !== "") { var m = document.createElement(lop); m.textContent = hienXuongDong(catGiua(noiDung, 60)); t.appendChild(m); }
      else { var m2 = document.createElement("span"); m2.className = "sua-diem"; m2.textContent = lop === "del" ? "" : "∅"; t.appendChild(m2); }
      t.appendChild(document.createTextNode(hienXuongDong(sau) + (kt < vbGoc.length ? "…" : "")));
      r.appendChild(l); r.appendChild(t);
      return r;
    }
    d.appendChild(hang("trước", giua === "" ? "▌" : giua, "del"));
    d.appendChild(hang("sau", x.thay, "ins"));
    return d;
  }

  function veDanhSach() {
    ds.textContent = "";
    var toiDa = Math.min(ket.sua.length, 300);
    for (var i = 0; i < toiDa; i++) {
      var x = ket.sua[i], li = document.createElement("li");
      li.className = "sua-muc" + (x.canhBao ? " canh-bao" : "");
      var b = document.createElement("button");
      b.type = "button"; b.className = "sua-toi"; b.setAttribute("data-i", String(i));
      b.textContent = (x.canhBao ? "⚠ " : "") + "dòng " + x.dong + ", cột " + x.cot + ": " + x.moTa;
      b.title = "Tới chỗ này trong văn bản";
      li.appendChild(b);
      li.appendChild(xemTruocSua(x));
      ds.appendChild(li);
    }
    if (ket.sua.length > toiDa) {
      var them = document.createElement("li");
      them.className = "sua-muc phu";
      them.textContent = "… và " + (ket.sua.length - toiDa) + " chỗ sửa nữa (đều sẽ được áp dụng)";
      ds.appendChild(them);
    }
  }

  function moHop() {
    if (!hop) return;
    vbGoc = APP.layVanBan();
    chay();
    hop.hidden = false;
    if (nutAp && !nutAp.disabled && nutAp.focus) nutAp.focus(); else if (nutHuy && nutHuy.focus) nutHuy.focus();
  }

  function chay() {
    ket = SJ.sua(vbGoc, { gopNhieuGiaTri: !!(hopGop && hopGop.checked) });
    veDanhSach();
    var n = ket.sua.length, cb = ket.soCanhBao;
    if (tom) tom.textContent = n + " chỗ sửa" + (cb ? " · " + cb + " cảnh báo (mất giá trị)" : "");
    if (nhanGop) nhanGop.hidden = !(ket.conLoi && ket.conLoi.nhieuGiaTri) && !(hopGop && hopGop.checked);
    var baoChu = "", loi = false;
    if (ket.conLoi) {
      loi = true;
      baoChu = (ket.conLoi.trongBanGoc ? "Dừng ở dòng " + ket.conLoi.dong + ", cột " + ket.conLoi.cot + " (văn bản gốc): " : "Sau khi sửa vẫn còn lỗi ở dòng " + ket.conLoi.dong + ", cột " + ket.conLoi.cot + ": ") +
        ket.conLoi.thongBao + (n ? " — bạn vẫn có thể áp dụng phần đã sửa được." : " — không có gì sửa tự động được.");
    } else if (n) baoChu = "Sau khi sửa, JSON hợp lệ.";
    if (bao) { bao.textContent = baoChu; bao.classList.toggle("loi", loi); }
    if (nutAp) {
      nutAp.disabled = !n;
      nutAp.textContent = ket.conLoi ? "Áp dụng phần sửa được" : "Áp dụng";
    }
  }

  function dongHop(tra) {
    if (!hop) return;
    hop.hidden = true; ket = null; vbGoc = null;
    if (tra && nut && !nut.hidden && nut.focus) nut.focus();
  }

  function apDung() {
    if (!ket || !ket.sua.length) return;
    if (APP.layVanBan() !== vbGoc) { chay(); if (bao) bao.textContent = "Văn bản đã đổi trong lúc xem — đã tính lại, bấm Áp dụng lần nữa"; return; }
    var n = ket.sua.length, conLoi = ket.conLoi;
    APP.datVanBan(ket.vanBan, { nhan: "Sửa JSON hỏng (" + n + " chỗ)" });
    dongHop(false);
    APP.thongBao("Đã sửa " + n + " chỗ" + (conLoi ? " — vẫn còn lỗi: " + conLoi.thongBao : "") + " · Ctrl+Z hoàn tác");
    capNhatNut();
  }

  function capNhatNut() {
    if (!nut) return;
    var s = APP.layVanBan();
    nut.hidden = APP.hopLe() || !s.trim();
  }

  if (nut && nut.addEventListener) {
    nut.onclick = moHop;
    if (nutAp) nutAp.onclick = apDung;
    if (nutHuy) nutHuy.onclick = function () { dongHop(true); };
    if (nutDong) nutDong.onclick = function () { dongHop(true); };
    if (hopGop) hopGop.onchange = function () { if (vbGoc !== null) chay(); };
    if (ds) ds.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".sua-toi") : null;
      if (!b || !ket) return;
      var x = ket.sua[+b.getAttribute("data-i")];
      if (x) APP.denViTri(x.bd, x.kt);
    });
    if (hop) hop.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); dongHop(true); } });
    APP.dangKy("doi-du-lieu", function () { capNhatNut(); if (hop && !hop.hidden && APP.layVanBan() !== vbGoc) dongHop(false); });
    capNhatNut();
  }

  window.JE_SUA = { mo: moHop, dong: function () { dongHop(true); }, ket: function () { return ket; } };
})();
