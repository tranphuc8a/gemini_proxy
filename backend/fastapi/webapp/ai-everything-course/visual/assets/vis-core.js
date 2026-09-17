/* =====================================================================
   vis-core.js — khung cho trang phu luc truc quan hoa.
   Khong phu thuoc thu vien nao. Chay duoc bang file://

   Moi demo tu dang ky bang demo({...}) o cac file vis-*.js nap SAU file nay.
   ===================================================================== */

(function () {
  "use strict";

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
  function thangMau(t) {
    t = Math.max(0, Math.min(1, t));
    var diem = [
      [0.00, [253, 242, 246]],
      [0.35, [244, 190, 214]],
      [0.65, [199, 60, 122]],
      [1.00, [88, 12, 45]]
    ];
    for (var i = 1; i < diem.length; i++) {
      if (t <= diem[i][0]) {
        var a = diem[i - 1], b = diem[i];
        var u = (t - a[0]) / (b[0] - a[0]);
        return "rgb(" + [0, 1, 2].map(function (k) {
          return Math.round(a[1][k] + u * (b[1][k] - a[1][k]));
        }).join(",") + ")";
      }
    }
    return "rgb(88,12,45)";
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
  function vongLap(buoc) {
    var id = null, dangChay = false;
    function tick() { buoc(); if (dangChay) id = requestAnimationFrame(tick); }
    return {
      chay: function () { if (!dangChay) { dangChay = true; id = requestAnimationFrame(tick); } },
      dung: function () { dangChay = false; if (id) cancelAnimationFrame(id); },
      dangChay: function () { return dangChay; }
    };
  }

  /* ---------- 6. Dang ky demo ---------------------------------------- */
  var DEMOS = [];
  window.demo = function (spec) { DEMOS.push(spec); };

  window.VIS = {
    el: el, $: $, truot: truot, nut: nut, chon: chon, danhDau: danhDau,
    veBang: veBang, veLuoi: veLuoi, mau: mau, thangMau: thangMau,
    rng: rng, vongLap: vongLap,
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
  var NHOM_THU_TU = ["Toán nền tảng", "Học máy", "Học sâu", "AI hiện đại", "Tìm kiếm & quyết định"];

  function dungMucLuc() {
    var nav = $("#nav");
    nav.innerHTML = "";
    NHOM_THU_TU.forEach(function (nhom) {
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
    toSang(null);
    document.title = "Phụ lục trực quan — Đại khoá học AI";
    var main = $("#main");
    main.innerHTML = "";
    main.appendChild(el("div", { class: "hero" }, [
      el("h1", { html: "Phụ lục <u>trực quan</u>" }),
      el("p", {
        html: "Những thứ <b>không trình bày được bằng văn bản</b>: gradient đi thế nào, " +
              "attention nhìn vào đâu, nhiễu bị gỡ ra sao, mô hình quá khớp trông như thế nào. " +
              "Mỗi demo <b>chỉnh được tham số</b> — hãy phá nó để xem nó hỏng ở đâu."
      }),
      el("p", { class: "hero-note", html:
        "💡 <b>Cách dùng đúng:</b> trước khi kéo một thanh trượt, hãy <b>dự đoán</b> điều sẽ xảy ra. " +
        "Mỗi lần dự đoán sai là một lần mô hình tư duy của bạn được sửa." })
    ]));
    NHOM_THU_TU.forEach(function (nhom) {
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
      'Thuộc <a href="../web/index.html">Đại khoá học Trí tuệ nhân tạo</a> · ' +
      DEMOS.length + " demo · không dùng thư viện ngoài" }));
  }

  function dinhTuyen() {
    var h = location.hash.replace(/^#\/?/, "");
    if (!h) trangChu(); else moDemo(h);
  }

  /* ---------- 8. Giao dien sang/toi ----------------------------------- */
  function datGiaoDien(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("vis-theme", t); } catch (e) {}
    var cur = location.hash;
    if (cur) { dinhTuyen(); }        /* ve lai canvas theo mau moi */
  }

  window.addEventListener("hashchange", dinhTuyen);
  window.addEventListener("DOMContentLoaded", function () {
    try {
      var t = localStorage.getItem("vis-theme");
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
