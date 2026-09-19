/* =====================================================================
   ENGINE TRUC QUAN — khung cho trang phu luc truc quan hoa.
   Khong phu thuoc thu vien nao. Chay duoc bang file://

   * DAY LA FILE SINH RA. DUNG SUA TRONG THU MUC KHOA HOC.
     Nguon that: courses/engine/vis-core.js
     Sua o do roi chay `python engine/sync.py`.

   Moi trang nap theo thu tu:
     (1) assets/cau-hinh.js   window.CAU_HINH_VIS  — rieng moi khoa
     (2) assets/vis-core.js   file nay             — dung chung
     (3) assets/vis-*.js      cac demo             — rieng moi khoa
   ===================================================================== */

(function () {
  "use strict";

  /* ---------- 0. Cau hinh cua khoa ----------------------------------- */
  var CH = window.CAU_HINH_VIS || {};
  function ch(k, macDinh) { return CH[k] === undefined ? macDinh : CH[k]; }

  var KHOA_LUU = ch("khoaLuu", "vis-theme");

  /* ---------- 1. Tien ich DOM ---------------------------------------- */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") e.className = attrs[k];
        else if (k === "html") e.innerHTML = attrs[k];
        else if (k === "text") e.textContent = attrs[k];
        else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function $(s, r) { return (r || document).querySelector(s); }

  /* ---------- 2. Dieu khien ------------------------------------------ */

  /** Thanh truot co nhan va gia tri hien tai. */
  function truot(o) {
    var out = el("b", { class: "gt", text: dinhDang(o.giaTri, o.buoc) + (o.donVi || "") });
    var inp = el("input", {
      type: "range", min: o.min, max: o.max, step: o.buoc || 0.01, value: o.giaTri
    });
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      out.textContent = dinhDang(v, o.buoc) + (o.donVi || "");
      o.doi(v);
    });
    var w = el("label", { class: "dk" }, [
      el("span", { class: "dk-t" }, [o.ten, out]), inp
    ]);
    w.datGiaTri = function (v) {
      inp.value = v;
      out.textContent = dinhDang(v, o.buoc) + (o.donVi || "");
    };
    return w;
  }

  function dinhDang(v, buoc) {
    if (buoc && buoc >= 1) return String(Math.round(v));
    if (Math.abs(v) >= 100) return v.toFixed(0);
    if (Math.abs(v) >= 1) return v.toFixed(2);
    return v.toFixed(3);
  }

  /** Nut bam. loai: "chinh" | "phu" */
  function nut(ten, onClick, loai) {
    return el("button", { class: "nut " + (loai || "phu"), onclick: onClick, text: ten });
  }

  /** Hop chon. */
  function chon(o) {
    var s = el("select", { class: "chon" });
    o.muc.forEach(function (m) {
      s.appendChild(el("option", { value: m.v, text: m.t }));
    });
    s.value = o.giaTri;
    s.addEventListener("change", function () { o.doi(s.value); });
    return el("label", { class: "dk" }, [el("span", { class: "dk-t" }, [o.ten]), s]);
  }

  /** O danh dau. */
  function danhDau(o) {
    var c = el("input", { type: "checkbox" });
    c.checked = !!o.giaTri;
    c.addEventListener("change", function () { o.doi(c.checked); });
    return el("label", { class: "dk dk-ck" }, [c, el("span", {}, [o.ten])]);
  }

  /* ---------- 3. Canvas co xu ly man hinh net cao -------------------- */
  function veBang(w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cv = el("canvas", { class: "cv" });
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    var g = cv.getContext("2d");
    g.scale(dpr, dpr);
    cv.W = w; cv.H = h; cv.g = g;
    /* Doi he toa do: goc o giua, truc y huong LEN (nhu toan hoc) */
    cv.hemToan = function (xmin, xmax, ymin, ymax) {
      var sx = w / (xmax - xmin), sy = h / (ymax - ymin);
      return {
        x: function (x) { return (x - xmin) * sx; },
        y: function (y) { return h - (y - ymin) * sy; },
        nx: function (px) { return px / sx + xmin; },
        ny: function (py) { return (h - py) / sy + ymin; },
        sx: sx, sy: sy
      };
    };
    return cv;
  }

  function mau(ten) {
    var cs = getComputedStyle(document.documentElement);
    return cs.getPropertyValue("--" + ten).trim() || "#000";
  }

  /* Ve luoi + truc cho he toa do toan hoc. */
  function veLuoi(g, T, xmin, xmax, ymin, ymax, W, H, buoc) {
    buoc = buoc || 1;
    g.save();
    g.strokeStyle = mau("bd2"); g.lineWidth = 1;
    for (var x = Math.ceil(xmin / buoc) * buoc; x <= xmax; x += buoc) {
      g.beginPath(); g.moveTo(T.x(x), 0); g.lineTo(T.x(x), H); g.stroke();
    }
    for (var y = Math.ceil(ymin / buoc) * buoc; y <= ymax; y += buoc) {
      g.beginPath(); g.moveTo(0, T.y(y)); g.lineTo(W, T.y(y)); g.stroke();
    }
    g.strokeStyle = mau("bd"); g.lineWidth = 1.5;
    if (ymin < 0 && ymax > 0) { g.beginPath(); g.moveTo(0, T.y(0)); g.lineTo(W, T.y(0)); g.stroke(); }
    if (xmin < 0 && xmax > 0) { g.beginPath(); g.moveTo(T.x(0), 0); g.lineTo(T.x(0), H); g.stroke(); }
    g.restore();
  }

  /* Bang mau chuyen (dung cho ban do nhiet / duong dong muc) */
  /* Thang mau chuyen cho ban do nhiet. Moi khoa de len bang
     CAU_HINH_VIS.thangMau = [[moc, [r,g,b]], ...] de khop mau nhan cua minh. */
  var THANG_MAC_DINH = [
    [0.00, [253, 242, 246]],
    [0.35, [244, 190, 214]],
    [0.65, [199, 60, 122]],
    [1.00, [88, 12, 45]]
  ];
  function thangMau(t) {
    t = Math.max(0, Math.min(1, t));
    var diem = ch("thangMau", THANG_MAC_DINH);
    for (var i = 1; i < diem.length; i++) {
      if (t <= diem[i][0]) {
        var a = diem[i - 1], b = diem[i];
        var u = (t - a[0]) / (b[0] - a[0]);
        return "rgb(" + [0, 1, 2].map(function (k) {
          return Math.round(a[1][k] + u * (b[1][k] - a[1][k]));
        }).join(",") + ")";
      }
    }
    var cuoi = diem[diem.length - 1][1];
    return "rgb(" + cuoi.join(",") + ")";
  }

  /* ---------- 4. So ngau nhien tai lap duoc -------------------------- */
  /* LCG don gian: cung hat giong -> cung day so, tren moi trinh duyet. */
  function rng(hat) {
    var s = (hat || 42) >>> 0;
    function u() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    u.chuan = function () {          /* Box–Muller */
      var a = Math.max(u(), 1e-12), b = u();
      return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
    };
    u.khoang = function (lo, hi) { return lo + u() * (hi - lo); };
    return u;
  }

  /* ---------- 5. Vong lap hoat hinh ---------------------------------- */
  /* Moi thu dang chay duoc ghi vao day de router dung het khi doi trang. */
  var DANG_CHAY = [];
  function ghiDanh(o) { if (DANG_CHAY.indexOf(o) < 0) DANG_CHAY.push(o); return o; }
  function dungHet() {
    DANG_CHAY.forEach(function (o) { try { o.dung(); } catch (e) {} });
    DANG_CHAY.length = 0;
  }

  function vongLap(buoc) {
    var id = null, dangChay = false;
    function tick() { buoc(); if (dangChay) id = requestAnimationFrame(tick); }
    var api = {
      chay: function () {
        if (!dangChay) { dangChay = true; ghiDanh(api); id = requestAnimationFrame(tick); }
      },
      dung: function () { dangChay = false; if (id) cancelAnimationFrame(id); },
      dangChay: function () { return dangChay; }
    };
    return api;
  }

  /* ---------- 5b. Bo phat: xem thuat toan chay nhu xem video --------- *
     phat({
       datLai : function () {...},          dat lai trang thai ve ban dau
       buoc   : function (k) {... return false khi het},   MOT buoc thuat toan
       ve     : function (k, xong) {...},   ve lai khung hinh
       toiDa  : 20000,        so buoc toi da (de co thanh tien do + tua)
       tocDo  : 8,            buoc/giay luc dau
       nhan   : function (k, xong) { return "..." },   dong chu trang thai
       tuTin  : true          tu chay ngay khi dat lai (mac dinh false)
     })
     Tra ve { dk(), datLai(), chay(), dung(), buoc(), toi(k), veLai(), chiSo() }
     dk() tra ve MOT phan tu DOM — cam vao mang dieuKhien cua V.khung.
   * ------------------------------------------------------------------ */
  function phat(o) {
    var toiDa  = o.toiDa || 0;
    var tocDo  = o.tocDo || 8;
    var k = 0, xong = false, dangChay = false, du = 0, tTruoc = 0, id = null;

    var nutPL   = nut("▶ Chạy", function () { dangChay ? dung() : chay(); }, "chinh");
    var thanhIn = el("div", { class: "phat-tt-i" });
    var thanh   = el("div", { class: "phat-tt" }, [thanhIn]);
    var dongNhan = el("div", { class: "phat-nhan" });
    var tuaIn = null;

    function capNhat() {
      nutPL.textContent = dangChay ? "⏸ Tạm dừng" : (xong ? "▶ Chạy lại" : "▶ Chạy");
      nutPL.classList.toggle("dang", dangChay);
      var t = toiDa ? Math.min(1, k / toiDa) : 0;
      thanhIn.style.width = (t * 100).toFixed(2) + "%";
      thanh.classList.toggle("het", xong);
      if (tuaIn && document.activeElement !== tuaIn) tuaIn.value = Math.min(k, toiDa);
      var s1 = toiDa ? ("bước " + k.toLocaleString("vi") + " / " + toiDa.toLocaleString("vi"))
                     : ("bước " + k.toLocaleString("vi"));
      /* nhan() doc trang thai cua demo — co the chua san sang o lan goi dau,
         hoac ngay sau khi doi tham so. Nhan la trang tri, khong duoc lam hong demo. */
      var s2 = "";
      if (o.nhan) { try { s2 = o.nhan(k, xong) || ""; } catch (e) { s2 = ""; } }
      dongNhan.innerHTML = "<b>" + s1 + "</b>" + (s2 ? " · " + s2 : "") +
                           (xong ? ' <i class="phat-het">đã xong</i>' : "");
    }

    function veLai() {
      if (o.ve) { try { o.ve(k, xong); } catch (e) { if (window.console) console.error(e); } }
      capNhat();
    }

    function datLai() {
      dung(); k = 0; xong = false; du = 0;
      if (o.datLai) o.datLai();
      veLai();
      if (o.tuTin) chay();
    }

    function motBuoc() {
      if (xong) return false;
      var r = o.buoc(k);
      k++;
      if (r === false || (toiDa && k >= toiDa)) xong = true;
      return !xong;
    }

    function khung(t) {
      if (!dangChay) return;
      if (!tTruoc) tTruoc = t;
      var dt = Math.min(0.2, (t - tTruoc) / 1000); tTruoc = t;
      du += dt * tocDo;
      var n = Math.min(Math.floor(du), 400000);
      du -= n;
      for (var i = 0; i < n; i++) { if (!motBuoc()) break; }
      veLai();
      if (xong) { dung(); } else id = requestAnimationFrame(khung);
    }

    function chay() {
      if (dangChay) return;
      if (xong) { datLai(); }
      dangChay = true; tTruoc = 0; du = 0;
      ghiDanh(api);
      id = requestAnimationFrame(khung);
      capNhat();
    }
    function dung() {
      dangChay = false; if (id) cancelAnimationFrame(id); id = null;
      capNhat();
    }
    /* Tua toi buoc muc tieu bang cach dat lai roi chay lai khong ve. */
    function toi(muc) {
      dung(); k = 0; xong = false; du = 0;
      if (o.datLai) o.datLai();
      var tran = Math.min(muc, toiDa || muc);
      for (var i = 0; i < tran; i++) { if (!motBuoc()) break; }
      veLai();
    }

    /* --- thanh dieu khien --- */
    function dk() {
      var nutB = nut("⏭ Một bước", function () { dung(); motBuoc(); veLai(); });
      var nutR = nut("↺ Đặt lại", function () { datLai(); });
      var hangNut = el("div", { class: "phat-nut" }, [nutPL, nutB, nutR]);

      var mucToc = el("b", { class: "gt", text: dinhDangToc(tocDo) });
      var slToc = el("input", {
        type: "range", min: 0, max: 100, step: 1,
        value: Math.round(Math.log(tocDo) / Math.LN10 * 25)
      });
      slToc.addEventListener("input", function () {
        tocDo = Math.max(1, Math.round(Math.pow(10, parseFloat(slToc.value) / 25)));
        mucToc.textContent = dinhDangToc(tocDo);
      });
      var oToc = el("label", { class: "dk" }, [
        el("span", { class: "dk-t" }, ["Tốc độ", mucToc]), slToc
      ]);

      var con = [hangNut, thanh, dongNhan, oToc];

      if (toiDa && o.tua !== false) {
        tuaIn = el("input", { type: "range", min: 0, max: toiDa, step: 1, value: 0 });
        tuaIn.addEventListener("input", function () { toi(parseInt(tuaIn.value, 10)); });
        con.splice(3, 0, el("label", { class: "dk" }, [
          el("span", { class: "dk-t" }, ["Tua tới bước"]), tuaIn
        ]));
      }
      return el("div", { class: "phat" }, con);
    }

    var api = {
      dk: dk, datLai: datLai, chay: chay, dung: dung, veLai: veLai,
      buoc: function () { dung(); motBuoc(); veLai(); },
      toi: toi,
      chiSo: function () { return k; },
      daXong: function () { return xong; },
      datToiDa: function (v) { toiDa = v; if (tuaIn) tuaIn.max = v; capNhat(); },
      datTocDo: function (v) { tocDo = v; }
    };
    return api;
  }

  function dinhDangToc(v) {
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k bước/giây";
    return v + " bước/giây";
  }

  /* ---------- 6. Dang ky demo ---------------------------------------- */
  var DEMOS = [];
  window.demo = function (spec) { DEMOS.push(spec); };

  window.VIS = {
    el: el, $: $, truot: truot, nut: nut, chon: chon, danhDau: danhDau,
    veBang: veBang, veLuoi: veLuoi, mau: mau, thangMau: thangMau,
    rng: rng, vongLap: vongLap, phat: phat, dungHet: dungHet,
    /* bo cuc chuan cho mot demo: [khung ve] [bang dieu khien] [giai thich] */
    khung: function (host, o) {
      var trai = el("div", { class: "ve" }, o.ve || []);
      var phai = el("div", { class: "dks" }, o.dieuKhien || []);
      host.appendChild(el("div", { class: "demo-body" }, [trai, phai]));
      if (o.giaiThich) host.appendChild(el("div", { class: "gt-box", html: o.giaiThich }));
      return { trai: trai, phai: phai };
    }
  };

  /* ---------- 7. Khung trang ----------------------------------------- */
  /* Thu tu nhom tren trang chu va muc luc. Nhom KHONG khai bao o day van
     hien — xep sau, theo thu tu gap phai. Quen khai bao thi mat trat tu,
     khong mat demo. */
  function thuTuNhom() {
    var dat = ch("nhomThuTu", []);
    var conLai = DEMOS.map(function (d) { return d.nhom; })
      .filter(function (n, i, a) { return a.indexOf(n) === i && dat.indexOf(n) < 0; });
    return dat.filter(function (n) {
      return DEMOS.some(function (d) { return d.nhom === n; });
    }).concat(conLai);
  }

  function dungMucLuc() {
    var nav = $("#nav");
    nav.innerHTML = "";
    thuTuNhom().forEach(function (nhom) {
      var ds = DEMOS.filter(function (d) { return d.nhom === nhom; });
      if (!ds.length) return;
      nav.appendChild(el("div", { class: "nav-h", text: nhom }));
      ds.forEach(function (d) {
        nav.appendChild(el("a", {
          class: "nav-i", href: "#/" + d.id, "data-id": d.id
        }, [
          el("span", { class: "nav-n", text: d.mon || "" }),
          el("span", {}, [d.ten])
        ]));
      });
    });
  }

  function toSang(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".nav-i"), function (a) {
      a.classList.toggle("on", a.getAttribute("data-id") === id);
    });
  }

  function moDemo(id) {
    var d = DEMOS.filter(function (x) { return x.id === id; })[0];
    var main = $("#main");
    dungHet();                       /* dung moi hoat hinh cua trang truoc */
    main.innerHTML = "";
    if (!d) { trangChu(); return; }
    toSang(id);
    document.title = d.ten + " — Phụ lục trực quan";
    main.appendChild(el("div", { class: "d-head" }, [
      el("div", { class: "d-nhom", text: d.nhom }),
      el("h1", { text: d.ten }),
      el("p", { class: "d-mo-ta", html: d.moTa || "" }),
      d.lienKet ? el("p", { class: "d-lk", html: "📖 Bài giảng liên quan: " + d.lienKet }) : null
    ]));
    var host = el("div", { class: "d-body" });
    main.appendChild(host);
    try {
      d.dung(host);
    } catch (e) {
      host.appendChild(el("div", { class: "loi", text: "Demo lỗi: " + e.message }));
      if (window.console) console.error(e);
    }
    window.scrollTo(0, 0);
  }

  function trangChu() {
    dungHet();
    toSang(null);
    document.title = ch("tieuDe", "Phụ lục trực quan");
    var main = $("#main");
    main.innerHTML = "";
    main.appendChild(el("div", { class: "hero" }, [
      el("h1", { html: ch("heroTieuDe", "Phụ lục <u>trực quan</u>") }),
      el("p", { html: ch("heroMoTa", "") }),
      el("p", { class: "hero-note", html:
        "💡 <b>Cách dùng đúng:</b> trước khi kéo một thanh trượt, hãy <b>dự đoán</b> điều sẽ xảy ra. " +
        "Mỗi lần dự đoán sai là một lần mô hình tư duy của bạn được sửa." })
    ]));
    thuTuNhom().forEach(function (nhom) {
      var ds = DEMOS.filter(function (d) { return d.nhom === nhom; });
      if (!ds.length) return;
      main.appendChild(el("h2", { class: "sec-h", text: nhom }));
      main.appendChild(el("div", { class: "luoi" }, ds.map(function (d) {
        return el("a", { class: "the", href: "#/" + d.id }, [
          el("div", { class: "the-n", text: d.mon || "•" }),
          el("h3", { text: d.ten }),
          el("p", { html: d.moTa || "" })
        ]);
      })));
    });
    main.appendChild(el("div", { class: "chan", html:
      'Thuộc <a href="../web/index.html">' + ch("tenKhoa", "khoá học") + "</a> · " +
      DEMOS.length + " demo · không dùng thư viện ngoài" }));
  }

  function dinhTuyen() {
    var h = location.hash.replace(/^#\/?/, "");
    if (!h) trangChu(); else moDemo(h);
  }

  /* ---------- 8. Giao dien sang/toi ----------------------------------- */
  function datGiaoDien(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(KHOA_LUU, t); } catch (e) {}
    var cur = location.hash;
    if (cur) { dinhTuyen(); }        /* ve lai canvas theo mau moi */
  }

  window.addEventListener("hashchange", dinhTuyen);
  window.addEventListener("DOMContentLoaded", function () {
    try {
      var t = localStorage.getItem(KHOA_LUU);
      if (t) document.documentElement.setAttribute("data-theme", t);
    } catch (e) {}
    $("#btnTheme").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var toi = cur === "dark" ||
        (cur !== "light" && window.matchMedia &&
         window.matchMedia("(prefers-color-scheme: dark)").matches);
      datGiaoDien(toi ? "light" : "dark");
    });
    $("#btnMenu").addEventListener("click", function () {
      document.body.classList.toggle("mo-nav");
    });
    dungMucLuc();
    dinhTuyen();
  });
})();
