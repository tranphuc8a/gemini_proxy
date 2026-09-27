/* =====================================================================
   trang.js — dung trang tra mau thiet ke.

   So do ve bang SVG noi dong, khong thu vien. Moi kieu so do la mot ham
   tra ve chuoi SVG; mau chi khai bao ten kieu, khong tu ve.
   ===================================================================== */
(function () {
  "use strict";

  var M = window.MAU_THIET_KE || [];
  var $ = function (s) { return document.querySelector(s); };

  var NHOM = [
    { ma: "tat-ca",   ten: "Tất cả" },
    { ma: "khoi-tao", ten: "Khởi tạo" },
    { ma: "cau-truc", ten: "Cấu trúc" },
    { ma: "hanh-vi",  ten: "Hành vi" },
    { ma: "hien-dai", ten: "Hiện đại" }
  ];
  var TEN_NHOM = {
    "khoi-tao": "KHỞI TẠO", "cau-truc": "CẤU TRÚC",
    "hanh-vi": "HÀNH VI", "hien-dai": "HIỆN ĐẠI"
  };

  var nhomDang = "tat-ca";
  var tuTim = "";
  var daMo = {};

  /* ==================================================================
     So do SVG
     ================================================================== */
  var W = 300, H = 118;

  function hop(x, y, w, h, chu, mau) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="6" fill="var(--surf2)" stroke="' + (mau || "var(--bd)") + '" stroke-width="1.4"/>' +
      '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 4) +
      '" text-anchor="middle" font-size="11" fill="var(--tx2)" ' +
      'font-family="system-ui,sans-serif">' + chu + "</text>";
  }
  function mui(x1, y1, x2, y2, net) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="var(--tx3)" stroke-width="1.3" marker-end="url(#m)"' +
      (net ? ' stroke-dasharray="4 3"' : "") + "/>";
  }

  var SO_DO = {
    "cha-con": function () {
      return hop(100, 6, 100, 26, "Lớp cha") +
        mui(125, 62, 125, 36) + mui(175, 62, 175, 36) +
        hop(48, 64, 92, 26, "Con A") + hop(160, 64, 92, 26, "Con B");
    },
    "ho": function () {
      return hop(14, 6, 110, 26, "Giao diện") +
        mui(50, 62, 50, 36) + mui(95, 62, 95, 36) +
        hop(10, 64, 78, 26, "Cách 1") + hop(96, 64, 78, 26, "Cách 2") +
        hop(196, 34, 92, 30, "Người dùng") + mui(192, 49, 130, 24, 1);
    },
    "chuoi": function () {
      return hop(6, 46, 76, 28, "Khâu 1") + mui(86, 60, 104, 60) +
        hop(108, 46, 76, 28, "Khâu 2") + mui(188, 60, 206, 60) +
        hop(210, 46, 76, 28, "Khâu 3");
    },
    "boc": function () {
      return hop(6, 44, 88, 30, "Người gọi") + mui(98, 59, 116, 59) +
        hop(120, 38, 74, 42, "Lớp bọc", "var(--ac)") + mui(198, 59, 216, 59) +
        hop(220, 44, 74, 30, "Vật thật");
    },
    "boc-nhieu": function () {
      return hop(96, 46, 108, 28, "Vật gốc") +
        '<rect x="80" y="36" width="140" height="48" rx="8" fill="none" ' +
        'stroke="var(--ac)" stroke-width="1.3"/>' +
        '<rect x="64" y="26" width="172" height="68" rx="10" fill="none" ' +
        'stroke="var(--tim)" stroke-width="1.3"/>' +
        '<text x="150" y="20" text-anchor="middle" font-size="10.5" ' +
        'fill="var(--tx3)" font-family="system-ui">bọc lồng nhau — THỨ TỰ có nghĩa</text>';
    },
    "cay": function () {
      return hop(110, 4, 80, 24, "Cành") +
        mui(130, 46, 138, 30) + mui(170, 46, 162, 30) +
        hop(78, 48, 62, 24, "Lá") + hop(158, 48, 62, 24, "Cành") +
        mui(180, 90, 180, 74) + hop(150, 92, 62, 22, "Lá");
    },
    "sao": function () {
      var s = hop(108, 46, 84, 28, "Trung tâm", "var(--ac)");
      var q = [[20, 10], [20, 86], [248, 10], [248, 86]];
      q.forEach(function (p) {
        s += hop(p[0], p[1], 58, 22, "bên");
        s += mui(p[0] < 100 ? 80 : 246, p[1] + 11, p[0] < 100 ? 104 : 196, 60, 1);
      });
      return s;
    },
    "don": function () {
      return hop(102, 44, 96, 32, "Một vật", "var(--ac)") +
        '<text x="150" y="98" text-anchor="middle" font-size="10.5" ' +
        'fill="var(--tx3)" font-family="system-ui">đóng gói một việc</text>';
    },
    "cau": function () {
      return hop(10, 6, 96, 26, "Trừu tượng") + hop(10, 68, 96, 26, "Mở rộng") +
        mui(58, 66, 58, 34) +
        hop(194, 6, 96, 26, "Cài đặt") + hop(194, 68, 96, 26, "Cài đặt 2") +
        mui(242, 66, 242, 34) +
        '<line x1="108" y1="19" x2="192" y2="19" stroke="var(--ac)" ' +
        'stroke-width="1.6" marker-end="url(#m)"/>' +
        '<text x="150" y="46" text-anchor="middle" font-size="10.5" ' +
        'fill="var(--ac)" font-family="system-ui">cầu</text>';
    },
    "mat-tien": function () {
      return hop(8, 44, 84, 30, "Người dùng") + mui(96, 59, 114, 59) +
        hop(118, 38, 66, 42, "Mặt tiền", "var(--ac)") +
        mui(188, 50, 212, 22) + mui(188, 59, 212, 59) + mui(188, 68, 212, 96) +
        hop(216, 10, 78, 22, "hệ con") + hop(216, 48, 78, 22, "hệ con") +
        hop(216, 86, 78, 22, "hệ con");
    },
    "dung-chung": function () {
      var s = hop(104, 44, 92, 30, "Phần chung", "var(--ac)");
      [18, 92, 166, 240].forEach(function (x) {
        s += hop(x, 4, 46, 20, "vật");
        s += mui(x + 23, 26, 150, 42, 1);
      });
      s += '<text x="150" y="98" text-anchor="middle" font-size="10.5" ' +
        'fill="var(--tx3)" font-family="system-ui">n vật · 1 bản sao phần chung</text>';
      return s;
    },
    "nhan-ban": function () {
      return hop(24, 44, 88, 30, "Bản gốc") + mui(118, 59, 172, 59) +
        hop(178, 44, 88, 30, "Bản sao", "var(--ac)") +
        '<text x="148" y="40" text-anchor="middle" font-size="10.5" ' +
        'fill="var(--tx3)" font-family="system-ui">nhân bản</text>';
    },
    "may": function () {
      return hop(10, 44, 76, 28, "Trạng thái A") +
        mui(90, 52, 114, 52) + hop(118, 44, 66, 28, "B", "var(--ac)") +
        mui(188, 52, 212, 52) + hop(216, 44, 76, 28, "C") +
        '<path d="M 250 40 Q 150 0 48 40" fill="none" stroke="var(--tx3)" ' +
        'stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#m)"/>';
    },
    "cheo": function () {
      return hop(10, 6, 80, 24, "Nút A") + hop(10, 50, 80, 24, "Nút B") +
        hop(202, 6, 88, 24, "Khách 1") + hop(202, 50, 88, 24, "Khách 2") +
        mui(94, 18, 198, 18, 1) + mui(94, 62, 198, 62, 1) +
        mui(94, 24, 198, 50, 1) + mui(94, 56, 198, 24, 1) +
        '<text x="150" y="100" text-anchor="middle" font-size="10.5" ' +
        'fill="var(--tx3)" font-family="system-ui">m nút × n thao tác</text>';
    }
  };

  function veSoDo(kieu) {
    var f = SO_DO[kieu] || SO_DO["don"];
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="sơ đồ ' + kieu + '">' +
      '<defs><marker id="m" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" ' +
      'markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="var(--tx3)"/>' +
      "</marker></defs>" + f() + "</svg>";
  }

  /* ==================================================================
     Loc va to sang tu khoa
     ================================================================== */
  function boDau(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  }

  function khop(m, tu) {
    if (!tu) return true;
    var kho = boDau([
      m.ten, m.viet, m.ma, m.yDinh,
      (m.dungKhi || []).join(" "), (m.khongDung || []).join(" "), m.tonKem
    ].join(" "));
    /* Moi tu phai co mat — tim theo tat ca cac tu, khong phai cum lien. */
    return boDau(tu).split(/\s+/).filter(Boolean).every(function (t) {
      return kho.indexOf(t) >= 0;
    });
  }

  function toSang(chu, tu) {
    if (!tu) return chu;
    var cac = boDau(tu).split(/\s+/).filter(Boolean);
    if (!cac.length) return chu;
    /* To tren ban KHONG DAU nhung cat tren ban GOC, de giu nguyen dau. */
    var kho = boDau(chu), ra = "", i = 0;
    var moc = [];
    cac.forEach(function (t) {
      var k = kho.indexOf(t);
      while (k >= 0) { moc.push([k, k + t.length]); k = kho.indexOf(t, k + 1); }
    });
    if (!moc.length) return chu;
    moc.sort(function (a, b) { return a[0] - b[0]; });
    var gop = [];
    moc.forEach(function (x) {
      var cuoi = gop[gop.length - 1];
      if (cuoi && x[0] <= cuoi[1]) cuoi[1] = Math.max(cuoi[1], x[1]);
      else gop.push([x[0], x[1]]);
    });
    gop.forEach(function (x) {
      ra += chu.slice(i, x[0]) + "<mark>" + chu.slice(x[0], x[1]) + "</mark>";
      i = x[1];
    });
    return ra + chu.slice(i);
  }

  /* ==================================================================
     Dung
     ================================================================== */
  function liKe(ds, tu) {
    return "<ul>" + ds.map(function (x) {
      return "<li>" + toSang(x, tu) + "</li>";
    }).join("") + "</ul>";
  }

  function thoat(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function veThe(m, tu) {
    var el = document.createElement("article");
    el.className = "mau" + (daMo[m.ma] ? " mo" : "");
    el.id = "m-" + m.ma;

    var dau = document.createElement("div");
    dau.className = "mau-dau";
    dau.innerHTML =
      '<span class="mau-ten">' + toSang(m.ten, tu) + "</span>" +
      '<span class="mau-viet">' + toSang(m.viet, tu) + "</span>" +
      '<span class="nhan-nhom n-' + m.nhom + '">' + TEN_NHOM[m.nhom] + "</span>";
    dau.onclick = function () {
      daMo[m.ma] = !daMo[m.ma];
      el.classList.toggle("mo", !!daMo[m.ma]);
    };
    el.appendChild(dau);

    var y = document.createElement("div");
    y.className = "mau-y";
    y.innerHTML = toSang(m.yDinh, tu);
    el.appendChild(y);

    var than = document.createElement("div");
    than.className = "than";
    than.innerHTML =
      '<div class="hop hop-dung"><h4 class="h-dung">✔ Dùng khi</h4>' +
        liKe(m.dungKhi, tu) + "</div>" +
      '<div class="hop hop-khong"><h4 class="h-khong">✘ Đừng dùng khi</h4>' +
        liKe(m.khongDung, tu) + "</div>" +
      '<div class="so-do rong">' + veSoDo(m.soDo) + "</div>" +
      '<div class="rong"><h4 class="h-gia">Cái giá phải trả</h4>' +
        '<div class="hop hop-gia"><p>' + toSang(m.tonKem, tu) + "</p></div></div>" +
      '<div class="rong"><pre>' + thoat(m.ma_nguon) + "</pre></div>" +
      (m.canh ? '<p class="canh rong">⚑ ' + m.canh + "</p>" : "");
    el.appendChild(than);
    return el;
  }

  function ve() {
    var ds = M.filter(function (m) {
      return (nhomDang === "tat-ca" || m.nhom === nhomDang) && khop(m, tuTim);
    });
    var hop2 = $("#danh-sach");
    hop2.innerHTML = "";
    if (!ds.length) {
      hop2.innerHTML = '<p class="trong">Không có mẫu nào khớp “' +
        thoat(tuTim) + "”.</p>";
    } else {
      ds.forEach(function (m) { hop2.appendChild(veThe(m, tuTim)); });
    }
    $("#dem-ket").textContent = ds.length + " / " + M.length + " mẫu";
  }

  /* --- thẻ nhóm --- */
  var hopNhom = $("#the-nhom");
  NHOM.forEach(function (n) {
    var b = document.createElement("button");
    b.className = "the" + (n.ma === nhomDang ? " dang" : "");
    b.textContent = n.ten + (n.ma === "tat-ca" ? "" :
      " (" + M.filter(function (m) { return m.nhom === n.ma; }).length + ")");
    b.onclick = function () {
      nhomDang = n.ma;
      Array.prototype.forEach.call(hopNhom.children, function (x) {
        x.classList.remove("dang");
      });
      b.classList.add("dang");
      ve();
    };
    hopNhom.appendChild(b);
  });

  var hen = null;
  $("#tim").addEventListener("input", function (e) {
    clearTimeout(hen);
    var v = e.target.value;
    hen = setTimeout(function () { tuTim = v.trim(); ve(); }, 120);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== $("#tim")) {
      e.preventDefault(); $("#tim").focus();
    }
    if (e.key === "Escape") { $("#tim").value = ""; tuTim = ""; ve(); }
  });

  $("#nut-sang-toi").onclick = function () {
    var sang = document.documentElement.getAttribute("data-sang") === "1";
    document.documentElement.setAttribute("data-sang", sang ? "0" : "1");
    try { localStorage.setItem("dp:sang", sang ? "0" : "1"); } catch (e) {}
  };
  try {
    var s = localStorage.getItem("dp:sang");
    if (s) document.documentElement.setAttribute("data-sang", s);
  } catch (e) {}

  /* Phoi ham thuan de kiem bang node. */
  window.DP_THU = { boDau: boDau, khop: khop, toSang: toSang, SO_DO: SO_DO, veSoDo: veSoDo };

  ve();
})();
