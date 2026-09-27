/* =====================================================================
   trang.js — phan GIAO DIEN cua ung dung chi tieu.

   Moi phep tinh nam trong loi.js va duoc kiem bang node. Tep nay chi
   noi day: doc/ghi localStorage, dung DOM, bat su kien.
   ===================================================================== */
(function () {
  "use strict";

  var CT = window.CT;
  var $ = function (s) { return document.querySelector(s); };

  var KHOA_GD  = "chi-tieu:giao-dich";
  var KHOA_HAN = "chi-tieu:han-muc";

  var gd = [];            /* toan bo giao dich */
  var han = {};           /* han muc theo nhom */
  var thangDang = CT.thangCua(CT.homNay());
  var nhomDang = "an-uong";

  /* ==================================================================
     Luu tru — luon boc try, che do rieng tu co the chan localStorage
     ================================================================== */
  function nap() {
    try {
      gd = JSON.parse(localStorage.getItem(KHOA_GD) || "[]");
      han = JSON.parse(localStorage.getItem(KHOA_HAN) || "{}");
    } catch (e) { gd = []; han = {}; }
    if (!Array.isArray(gd)) gd = [];
    if (!han || typeof han !== "object") han = {};
  }
  function luu() {
    try {
      localStorage.setItem(KHOA_GD, JSON.stringify(gd));
      localStorage.setItem(KHOA_HAN, JSON.stringify(han));
      bao(gd.length + " khoản đã lưu trong máy bạn");
    } catch (e) {
      bao("⚠ Không lưu được — trình duyệt đang chặn bộ nhớ cục bộ");
    }
  }
  function bao(chu) { $("#trang-thai").textContent = chu; }

  /* ==================================================================
     Dung giao dien
     ================================================================== */
  function veLuoiNhom() {
    var h = $("#luoi-nhom");
    h.innerHTML = "";
    CT.NHOM.forEach(function (n) {
      var b = document.createElement("div");
      b.className = "o-nhom" + (n.ma === nhomDang ? " dang" : "");
      var bieu = document.createElement("span");
      bieu.className = "b";
      bieu.textContent = n.bieu;
      b.appendChild(bieu);
      b.appendChild(document.createTextNode(n.ten));
      b.onclick = function () {
        nhomDang = n.ma;
        veLuoiNhom();
      };
      h.appendChild(b);
    });
  }

  function veChonThang() {
    var s = $("#chon-thang");
    var ds = CT.cacThang(gd);
    if (ds.indexOf(thangDang) < 0) ds.unshift(thangDang);
    s.innerHTML = ds.map(function (t) {
      return '<option value="' + t + '"' + (t === thangDang ? " selected" : "") + ">" +
        CT.tenThang(t) + "</option>";
    }).join("");
  }

  function veTomTat() {
    var ds = CT.locThang(gd, thangDang);
    var t = CT.tongKet(ds);
    var truoc = CT.tongKet(CT.locThang(gd, CT.thangTruoc(thangDang)));

    function sanh(nay, cu) {
      if (!cu) return "";
      var d = nay - cu;
      if (d === 0) return "bằng tháng trước";
      return (d > 0 ? "▲ " : "▼ ") + CT.tienGon(Math.abs(d)) + " so với tháng trước";
    }

    $("#tom-tat").innerHTML =
      '<div class="o-tom thu"><div class="nhan">Thu vào</div>' +
        '<div class="so">' + CT.dinhDangTien(t.thu) + "</div>" +
        '<div class="phu2">' + sanh(t.thu, truoc.thu) + "</div></div>" +
      '<div class="o-tom chi"><div class="nhan">Chi ra</div>' +
        '<div class="so">' + CT.dinhDangTien(t.chi) + "</div>" +
        '<div class="phu2">' + sanh(t.chi, truoc.chi) + "</div></div>" +
      '<div class="o-tom"><div class="nhan">Còn lại</div>' +
        '<div class="so" style="color:' + (t.con < 0 ? "var(--loi)" : "var(--tx)") + '">' +
        CT.dinhDangTien(t.con) + "</div>" +
        '<div class="phu2">' + (ds.length + " khoản") + "</div></div>";
  }

  function veBieuNgay() {
    var m = CT.theoNgay(gd, thangDang);
    var max = Math.max.apply(null, m.concat([1]));
    var h = $("#bieu-ngay");
    /* Thang rong: 31 cot cao 1px trong nhu mot vach mo vo nghia. Noi thang
       ra thi hon. (Anh chup Chromium cho thay cho nay.) */
    if (!m.some(function (v) { return v > 0; })) {
      h.innerHTML = '<p class="trong" style="margin:auto">' +
        "Chưa có khoản chi nào trong tháng này.</p>";
      return;
    }
    h.innerHTML = m.map(function (v, i) {
      var cao = Math.max(1, Math.round(v / max * 100));
      return '<div class="cot" style="height:' + cao + '%' +
        (v === 0 ? ";background:var(--bd)" : "") + '">' +
        '<span class="hien">Ngày ' + (i + 1) + ": " + CT.dinhDangTien(v) + "</span></div>";
    }).join("");
  }

  function veTheoNhom() {
    var ds = CT.locThang(gd, thangDang).filter(function (g) { return !CT.laThu(g); });
    var n = CT.theoNhom(ds);
    var tong = n.reduce(function (a, b) { return a + b.tien; }, 0);
    var h = $("#theo-nhom");
    if (!n.length) { h.innerHTML = '<p class="trong">Chưa có khoản chi nào trong tháng này.</p>'; return; }
    h.innerHTML = n.map(function (x) {
      var ti = tong ? x.tien / tong : 0;
      return '<div class="hang-nhom"><span class="ten">' + x.ten + "</span>" +
        '<span class="thanh"><i style="width:' + (ti * 100).toFixed(1) + "%;background:" +
        x.mau + '"></i></span>' +
        '<span class="so">' + CT.dinhDangTien(x.tien) + "</span>" +
        '<span class="ti">' + (ti * 100).toFixed(0) + "%</span></div>";
    }).join("");
  }

  function veNganSach() {
    var ds = CT.locThang(gd, thangDang);
    var r = CT.soNganSach(ds, han);
    var h = $("#ngan-sach");
    if (!r.length) {
      h.innerHTML = '<p class="trong">Chưa đặt hạn mức nào. Đặt ở cột bên trái.</p>';
      return;
    }
    h.innerHTML = r.map(function (x) {
      var rong = Math.min(100, x.tiLe * 100);
      return '<div class="hang-han' + (x.vuot ? " vuot" : "") + '">' +
        '<div class="tren"><b>' + x.ten + "</b><span class=day></span>" +
        '<span class="so">' + CT.dinhDangTien(x.daChi) + " / " +
        CT.dinhDangTien(x.han) + "</span></div>" +
        '<div class="thanh"><i style="width:' + rong.toFixed(1) + "%;background:" +
        (x.vuot ? "var(--loi)" : x.tiLe > 0.8 ? "var(--ba)" : x.mau) + '"></i></div>' +
        (x.vuot ? '<div class="phu nho" style="color:var(--loi);margin-top:4px">' +
          "vượt " + CT.dinhDangTien(-x.conLai) + "</div>" : "") +
        "</div>";
    }).join("");
  }

  function veDatHan() {
    var h = $("#dat-han");
    h.innerHTML = "";
    CT.NHOM.filter(function (n) { return !n.thu; }).forEach(function (n) {
      var d = document.createElement("div");
      d.className = "han-dat";
      d.innerHTML = '<span class="ten">' + n.bieu + " " + n.ten + "</span>";
      var i = document.createElement("input");
      i.type = "text";
      i.value = han[n.ma] ? CT.dinhDangTien(han[n.ma], false) : "";
      i.placeholder = "0";
      i.onchange = function () {
        var v = CT.docTien(i.value);
        if (v > 0) han[n.ma] = v; else delete han[n.ma];
        i.value = v > 0 ? CT.dinhDangTien(v, false) : "";
        luu(); veNganSach();
      };
      d.appendChild(i);
      h.appendChild(d);
    });
  }

  function veDanhSach() {
    var ds = CT.locThang(gd, thangDang).slice().sort(function (a, b) {
      return a.ngay === b.ngay ? (b.id || 0) - (a.id || 0) : (a.ngay < b.ngay ? 1 : -1);
    });
    $("#dem-khoan").textContent = ds.length ? "· " + ds.length : "";
    var h = $("#danh-sach");
    if (!ds.length) {
      h.innerHTML = '<p class="trong">Chưa có khoản nào trong tháng này.</p>';
      return;
    }
    h.innerHTML = "";
    ds.forEach(function (g) {
      var n = CT.banNhom[g.nhom] || { ten: g.nhom, mau: "#888", bieu: "•" };
      var thu = CT.laThu(g);
      var d = document.createElement("div");
      d.className = "khoan";
      var mau = /^#[0-9a-f]{6}$/i.test(n.mau) ? n.mau : "#888888";
      var bieu = document.createElement("span");
      bieu.className = "bieu2";
      bieu.style.backgroundColor = mau + "22";
      bieu.style.color = mau;
      bieu.textContent = String(n.bieu || "•");

      var giua = document.createElement("span");
      giua.className = "giua";
      var ten = document.createElement("div");
      ten.className = "ten2";
      ten.textContent = String(g.ghiChu || n.ten);
      var ngay = document.createElement("div");
      ngay.className = "ngay2";
      ngay.textContent = String(n.ten) + " · " + ngayViet(g.ngay);
      giua.appendChild(ten);
      giua.appendChild(ngay);

      var tien = document.createElement("span");
      tien.className = "tien2" + (thu ? " thu" : "");
      tien.textContent = (thu ? "+" : "−") + CT.dinhDangTien(g.tien);

      d.appendChild(bieu);
      d.appendChild(giua);
      d.appendChild(tien);
      var x = document.createElement("button");
      x.className = "xoa"; x.textContent = "×"; x.title = "Xoá khoản này";
      x.onclick = function () {
        gd = gd.filter(function (k) { return k !== g; });
        luu(); veHet();
      };
      d.appendChild(x);
      h.appendChild(d);
    });
  }

  function ngayViet(s) {
    var p = String(s).split("-");
    return p.length === 3 ? (parseInt(p[2], 10) + "/" + parseInt(p[1], 10)) : s;
  }
  function thoat(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function veHet() {
    veChonThang(); veTomTat(); veBieuNgay();
    veTheoNhom(); veNganSach(); veDanhSach();
  }

  /* ==================================================================
     Noi day
     ================================================================== */
  $("#f-ngay").value = CT.homNay();

  /* Vua go vua hien so doc duoc — de nguoi dung thay ngay "1.5tr" la bao
     nhieu, truoc khi bam them. */
  $("#f-tien").addEventListener("input", function (e) {
    var v = CT.docTien(e.target.value);
    $("#goi-tien").textContent = v ? "= " + CT.dinhDangTien(v) : "";
  });

  $("#form").addEventListener("submit", function (e) {
    e.preventDefault();
    var tien = CT.docTien($("#f-tien").value);
    if (tien <= 0) { bao("Số tiền phải lớn hơn 0"); return; }
    gd.push({
      id: Date.now(),
      ngay: $("#f-ngay").value || CT.homNay(),
      nhom: nhomDang,
      tien: tien,
      ghiChu: $("#f-chu").value.trim()
    });
    luu();
    thangDang = CT.thangCua($("#f-ngay").value || CT.homNay());
    $("#f-tien").value = ""; $("#f-chu").value = ""; $("#goi-tien").textContent = "";
    veHet();
    $("#f-tien").focus();
  });

  $("#chon-thang").addEventListener("change", function (e) {
    thangDang = e.target.value; veHet();
  });

  $("#nut-xuat").onclick = function () {
    if (!gd.length) { bao("Chưa có gì để xuất"); return; }
    var b = new Blob(["﻿" + CT.sangCSV(gd)], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "chi-tieu.csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    bao("Đã xuất " + gd.length + " khoản");
  };

  $("#nut-nhap").onclick = function () {
    $("#che").hidden = false;
    $("#csv-bao").textContent = "";
    $("#csv-nhap").focus();
  };
  $("#csv-huy").onclick = function () { $("#che").hidden = true; };
  $("#che").onclick = function (e) { if (e.target === $("#che")) $("#che").hidden = true; };

  $("#csv-tep").onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      $("#csv-nhap").value = String(r.result).replace(/^﻿/, "");
      $("#csv-bao").textContent = "Đã đọc " + f.name;
    };
    r.readAsText(f);
  };

  $("#csv-ok").onclick = function () {
    var moi;
    try { moi = CT.tuCSV($("#csv-nhap").value.replace(/^﻿/, "")); }
    catch (e) { $("#csv-bao").textContent = "Không đọc được: " + e.message; return; }
    if (!moi.length) { $("#csv-bao").textContent = "Không tìm thấy dòng nào hợp lệ."; return; }
    moi.forEach(function (g, i) { g.id = Date.now() + i; gd.push(g); });
    luu();
    $("#che").hidden = true;
    $("#csv-nhap").value = "";
    thangDang = CT.cacThang(gd)[0] || thangDang;
    veHet();
    bao("Đã nhập thêm " + moi.length + " khoản");
  };

  $("#nut-xoa-het").onclick = function () {
    if (!gd.length && !Object.keys(han).length) return;
    /* Xoa la khong lay lai duoc, nen phai hoi — va noi ro con duong giu lai. */
    if (!confirm("Xoá sạch " + gd.length + " khoản và mọi hạn mức?\n\n" +
                 "Không hoàn tác được. Nên bấm “Xuất CSV” trước nếu muốn giữ.")) return;
    gd = []; han = {};
    luu(); veDatHan(); veHet();
    bao("Đã xoá sạch");
  };

  $("#nut-sang-toi").onclick = function () {
    var sang = document.documentElement.getAttribute("data-sang") === "1";
    document.documentElement.setAttribute("data-sang", sang ? "0" : "1");
    try { localStorage.setItem("chi-tieu:sang", sang ? "0" : "1"); } catch (e) {}
  };
  try {
    var s = localStorage.getItem("chi-tieu:sang");
    if (s) document.documentElement.setAttribute("data-sang", s);
  } catch (e) {}

  /* --- khởi động --- */
  nap();
  if (gd.length) thangDang = CT.cacThang(gd)[0];
  veLuoiNhom();
  veDatHan();
  veHet();
  bao(gd.length ? gd.length + " khoản đã lưu trong máy bạn" : "Sổ trống — ghi khoản đầu tiên ở bên trái");
})();
