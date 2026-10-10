/* Vỏ trang Thực hành Heuristic: kho lưu, giao diện sáng/tối, thanh bên, định tuyến theo hash, trang chủ,
   sổ ghi chú tổng hợp, trang hướng dẫn (sao lưu/khôi phục). Các trang bài / lab / IDE nằm ở bai.js, lab.js, ide.js. */
(function (root) {
  "use strict";
  var TH = root.TH, D = TH.dom, h = D.h, $ = D.$;
  var K = TH.khoa;
  var kho = null;
  try { kho = root.localStorage; } catch (e) { kho = null; }
  var luu = TH.luu.tao(kho);

  var IC = {
    menu: "M3 6h18M3 12h18M3 18h18", x: "M6 6l12 12M18 6L6 18", sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5L3.6 3.6M20.4 20.4L19 19M19 5l1.4-1.4M3.6 20.4L5 19M12 8a4 4 0 100 8 4 4 0 000-8",
    moon: "M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z", book: "M4 4.5A2.5 2.5 0 016.5 2H20v16H6.5A2.5 2.5 0 004 20.5zM4 17.5A2.5 2.5 0 016.5 15H20",
    flask: "M9 3h6M10 3v6L4.5 19a2 2 0 001.8 3h11.4a2 2 0 001.8-3L14 9V3M7.5 15h9", code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
    note: "M5 3h11l4 4v14H5zM15 3v5h5M8 12h8M8 16h6", check: "M4 12.5l5 5L20 6.5", chev: "M9 5l7 7-7 7", left: "M19 12H5M11 18l-6-6 6-6", right: "M5 12h14M13 6l6 6-6 6",
    play: "M7 4l13 8-13 8z", stop: "M6 6h12v12H6z", copy: "M9 9h11v11H9zM5 15V5a2 2 0 012-2h8", reset: "M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5",
    bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0012 3", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6",
    dl: "M12 3v12M7 10l5 5 5-5M4 21h16", ul: "M12 21V9M7 14l5-5 5 5M4 3h16", ext: "M15 3h6v6M10 14L21 3M20 13v7a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h7",
    home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10", grid: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z", trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    plus: "M12 5v14M5 12h14", search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4", file: "M6 3h9l4 4v14H6zM14 3v5h5"
  };
  function ic(ten, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ic" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", IC[ten] || IC.file); s.appendChild(p);
    return s;
  }

  var ui = TH.ui = { luu: luu, trang: {}, ic: ic, dem: TH.dem || {} };

  /* ---------- dữ liệu bài ---------- */
  var tatCaId = [].concat.apply([], K.phan.map(function (p) { return p.bai; }));
  ui.tatCaId = tatCaId;
  ui.meta = function (id) { return K.bai[id] || null; };
  ui.nhanBai = function (id) { var m = K.bai[id]; return m ? (m.so ? "Bài " + m.so + " — " : "") + m.ten : id; };
  ui.phanCua = function (id) { return K.phan.filter(function (p) { return p.bai.indexOf(id) >= 0; })[0]; };
  ui.giangUrl = function (id) { var m = K.bai[id]; return m ? "../heuristic-course-2/#/" + m.giang : "../heuristic-course-2/"; };
  ui.visualUrl = function (demo) { return "../heuristic-visual-2/#/" + demo; };

  var dangNap = {};
  ui.napBai = function (id) {
    if (TH.bai.lay(id)) return Promise.resolve(TH.bai.lay(id));
    if (!K.bai[id]) return Promise.reject(new Error("Không có bài “" + id + "”"));
    if (dangNap[id]) return dangNap[id];
    dangNap[id] = new Promise(function (ok, loi) {
      var s = document.createElement("script");
      s.src = "data/" + id + ".js";
      s.onload = function () { delete dangNap[id]; TH.bai.lay(id) ? ok(TH.bai.lay(id)) : loi(new Error("Tệp bài không đăng ký nội dung")); };
      s.onerror = function () { delete dangNap[id]; loi(new Error("Không tải được nội dung bài — kiểm tra kết nối rồi thử lại")); };
      document.head.appendChild(s);
    });
    return dangNap[id];
  };

  /* ---------- tiến độ ---------- */
  ui.tdo = function (id) { return luu.doc("tdo/" + id, null); };
  ui.ghiTdo = function (id, vaTrai) {
    var r = Object.assign({}, luu.doc("tdo/" + id, {}), vaTrai);
    luu.ghi("tdo/" + id, r);
    capNhatVong(); dungNav();
    return r;
  };
  ui.trangThaiBai = function (id) { return TH.tienDo.trangThai(ui.tdo(id)); };
  function tongHopTien() { return TH.tienDo.tongHop(tatCaId, ui.tdo); }

  /* ---------- giao diện sáng/tối ---------- */
  function cai() { return luu.doc("cai", {}) || {}; }
  function ghiCai(vaTrai) { luu.ghi("cai", Object.assign({}, cai(), vaTrai)); }
  ui.cai = cai; ui.ghiCai = ghiCai;
  function apDungTheme() { document.documentElement.setAttribute("data-theme", cai().theme || "auto"); }
  function dangToi() {
    var t = cai().theme || "auto";
    return t === "dark" || (t === "auto" && root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function doiTheme() {
    var t = cai().theme || "auto", toi = dangToi();
    ghiCai({ theme: t === "auto" ? (toi ? "light" : "dark") : (t === "dark" ? "light" : "dark") });
    apDungTheme(); capNhatNutTheme();
  }
  var nutTheme = null;
  function capNhatNutTheme() {
    if (!nutTheme) return;
    nutTheme.replaceChildren(ic(dangToi() ? "sun" : "moon"));
    nutTheme.setAttribute("aria-label", dangToi() ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối");
  }

  /* ---------- Cho phép tải trình biên dịch C/C++ (một lần) ---------- */
  ui.canDongYCpp = function () {
    if (!TH.cpp || !TH.cpp.khaDung()) {
      D.toast("Trình duyệt này không hỗ trợ WebAssembly/Web Worker nên không biên dịch C++ được. Hãy dùng JavaScript.", "bad");
      return Promise.resolve(false);
    }
    if (cai().cppDongY) return Promise.resolve(true);
    return TH.cpp.cacheDaCo().then(function (co) {
      if (co) { ghiCai({ cppDongY: true }); return true; }
      return D.hoi({
        tieuDe: "Tải trình biên dịch C/C++ (một lần)",
        noiDung: h("div", { class: "md", html:
          "<p>Trình biên dịch chạy <b>ngay trong trình duyệt của bạn</b> (Clang → WebAssembly), không cần cài gì và không gửi mã của bạn đi đâu.</p>" +
          "<p>Lần đầu cần tải khoảng <b>25 MB</b> (≈ 105 MB sau khi giải nén) từ <code>cdn.jsdelivr.net</code>. Sau đó trình duyệt lưu lại và các lần sau dùng được cả khi offline. " +
          "Nếu đang dùng dữ liệu di động, nên chờ có Wi-Fi.</p>" +
          "<p>Điện thoại cấu hình thấp có thể biên dịch chậm hoặc thiếu bộ nhớ — khi đó hãy dùng JavaScript (không cần tải gì).</p>" }),
        nutChinh: "Tải và dùng", nutPhu: "Để sau"
      }).then(function (ok) { if (ok) ghiCai({ cppDongY: true }); return ok; });
    });
  };

  /* ---------- thanh trên + thanh bên ---------- */
  var elVong = null, elPct = null, elSide = null;
  function dungHeader() {
    var hdr = $(".hdr");
    nutTheme = h("button", { class: "ic-btn", type: "button", onclick: doiTheme });
    elPct = h("span", { text: "0%" });
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    svg.innerHTML = '<circle class="bg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3.5"/><circle class="fg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3.5" stroke-dasharray="97.4" stroke-dashoffset="97.4"/>';
    elVong = svg.querySelector(".fg");
    var vong = h("a", { class: "vong", href: "#/", title: "Tiến độ của bạn" }, svg, elPct);
    hdr.appendChild(h("button", { class: "ic-btn only-nar", type: "button", "aria-label": "Mở mục lục", onclick: function () { document.body.classList.toggle("nav-mo"); } }, ic("menu")));
    hdr.appendChild(h("a", { class: "brand", href: "#/" },
      h("span", { class: "brand-mark" }, ic("flask")),
      h("span", {}, "Thực hành Heuristic", h("small", { text: "bài tập · lab · IDE C/C++" }))));
    hdr.appendChild(h("nav", { class: "hdr-nav", "aria-label": "Chính" },
      h("a", { href: "#/", "data-nav": "home" }, "Lộ trình"),
      h("a", { href: "#/ide", "data-nav": "ide" }, ic("code"), "IDE C/C++"),
      h("a", { href: "#/ghi-chu", "data-nav": "ghi-chu" }, "Ghi chú"),
      h("a", { href: "#/huong-dan", "data-nav": "huong-dan" }, "Hướng dẫn")));
    hdr.appendChild(h("div", { class: "hdr-right" }, vong, nutTheme));
    capNhatNutTheme(); capNhatVong();
  }
  function capNhatVong() {
    if (!elVong) return;
    var p = tongHopTien().phanTram;
    elVong.setAttribute("stroke-dashoffset", String(97.4 * (1 - p)));
    elPct.textContent = Math.round(p * 100) + "%";
  }

  var bai = null;                                   /* id bài đang mở (đánh dấu trong thanh bên) */
  function dungNav() {
    if (!elSide) return;
    var kq = h("div", {});
    kq.appendChild(h("div", { class: "nav-ct", text: "CÔNG CỤ" }));
    [["home", "#/", "Lộ trình & tiến độ", "grid"], ["ide", "#/ide", "IDE C/C++ online", "code"], ["ghi-chu", "#/ghi-chu", "Ghi chú của tôi", "note"], ["huong-dan", "#/huong-dan", "Hướng dẫn & sao lưu", "book"]]
      .forEach(function (x) {
        kq.appendChild(h("a", { class: "nav-i", href: x[1], "data-nav": x[0] }, h("span", { class: "nav-so" }, ic(x[3])), h("span", { class: "nav-ten", text: x[2] })));
      });
    K.phan.forEach(function (p) {
      kq.appendChild(h("div", { class: "nav-ct", text: p.ten.toUpperCase() }));
      p.bai.forEach(function (id) {
        var m = K.bai[id], st = ui.trangThaiBai(id);
        kq.appendChild(h("a", { class: "nav-i", href: "#/bai/" + id, "data-id": id, "aria-current": bai === id ? "page" : null },
          h("span", { class: "nav-so", text: m.so || "•" }), h("span", { class: "nav-ten", text: m.ten }),
          h("span", { class: "cham " + st, title: st === "xong" ? "Đã hoàn thành" : st === "dang-hoc" ? "Đang học" : "Chưa học" })));
      });
    });
    elSide.replaceChildren(kq);
    markNav();
  }
  function markNav() {
    D.$$("[data-nav]").forEach(function (a) { a.removeAttribute("aria-current"); });
    var t = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "home";
    D.$$('[data-nav="' + (t === "lab" ? "x" : t) + '"]').forEach(function (a) { a.setAttribute("aria-current", "page"); });
    D.$$("[data-id]", elSide).forEach(function (a) {
      if (a.getAttribute("data-id") === bai) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  ui.danhDauBai = function (id) { bai = id; markNav(); var a = elSide && elSide.querySelector('[data-id="' + id + '"]'); if (a && a.scrollIntoView) { try { a.scrollIntoView({ block: "nearest" }); } catch (e) { /* bỏ qua */ } } };

  /* ---------- định tuyến ---------- */
  var main = null, donDep = null;
  ui.dangKyTrang = function (ten, fn) { ui.trang[ten] = fn; };
  ui.dieuHuong = function (hash) { if (location.hash === hash) route(); else location.hash = hash; };
  ui.tieuDe = function (t) { document.title = (t ? t + " · " : "") + "Thực hành Heuristic"; };
  function route() {
    var phanHash = location.hash.replace(/^#\/?/, "").split("#");        /* "bai/x#ghi-chu" → đường dẫn + mục neo */
    ui.neo = phanHash[1] || "";
    var seg = phanHash[0].split("/").map(function (s) { try { return decodeURIComponent(s); } catch (e) { return s; } });
    var ten = seg[0] || "home";
    if (donDep) { try { donDep(); } catch (e) { /* bỏ qua */ } donDep = null; }
    document.body.classList.remove("nav-mo");
    main.replaceChildren();
    bai = null;
    var fn = ui.trang[ten];
    if (!fn) { ten = "khong-co"; fn = ui.trang["khong-co"]; }
    var kq;
    try { kq = fn(main, seg.slice(1)); }
    catch (e) { if (root.console) console.error(e); main.replaceChildren(loiTrang(e)); }
    donDep = typeof kq === "function" ? kq : null;
    markNav();
    if (!ui.neo) root.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  function loiTrang(e) {
    return h("div", { class: "wrap" }, h("div", { class: "card" }, h("h2", { text: "Có lỗi khi dựng trang" }), h("p", { class: "mut", text: String(e && e.message || e) }),
      h("a", { class: "btn", href: "#/" }, "Về trang chủ")));
  }
  ui.loiTrang = loiTrang;

  /* ---------- trang chủ ---------- */
  function soLieu() {
    var t = { d: 0, n: 0 }, b = { hop: 0, so: 0 }, ghi = 0;
    tatCaId.forEach(function (id) {
      var r = ui.tdo(id);
      if (r && r.t) { t.d += r.t.d; t.n += r.t.n; }
      if (r && r.b) { b.hop += r.b.hopLe || 0; b.so += r.b.soLab || 0; }
      if ((luu.doc("ghichu/" + id, "") || "").trim()) ghi++;
    });
    return { t: t, b: b, ghi: ghi };
  }
  function theBai(id) {
    var m = K.bai[id], r = ui.tdo(id), st = TH.tienDo.trangThai(r), dem = ui.dem[id] || null;
    var hang = h("div", { class: "hang" });
    if (dem) {
      hang.appendChild(h("span", { class: "chip" + (r && r.t && r.t.d === r.t.n && r.t.n ? " ok" : ""), title: "Trắc nghiệm" }, "✔ " + (r && r.t ? r.t.d + "/" + r.t.n : dem.t)));
      hang.appendChild(h("span", { class: "chip" + (r && r.l && r.l.d === r.l.n && r.l.n ? " ok" : ""), title: "Tự luận" }, "✍ " + (r && r.l ? r.l.d + "/" + r.l.n : dem.l)));
      if (dem.b) hang.appendChild(h("span", { class: "chip" + (r && r.b && r.b.m >= r.b.n && r.b.n ? " ok" : ""), title: "Lab" }, "🧪 " + (r && r.b ? TH.tienDo.sao(r.b.m, r.b.n) : dem.b + " lab")));
    }
    if (st === "xong") hang.appendChild(h("span", { class: "chip ok" }, "Hoàn thành"));
    return h("a", { class: "the-bai", href: "#/bai/" + id },
      h("span", { class: "so", text: m.loai === "dau-vao" ? "KIỂM TRA ĐẦU VÀO" : m.loai === "ca" ? "CA NGHIÊN CỨU" : "BÀI " + m.so + (m.tag ? " · " + m.tag.toUpperCase() : "") }),
      h("h3", { text: m.ten }), hang);
  }
  ui.dangKyTrang("home", function (el) {
    ui.tieuDe(""); ui.danhDauBai(null);
    var tong = tongHopTien(), sl = soLieu(), gan = cai().gan && K.bai[cai().gan] ? cai().gan : null;
    var tiep = gan || K.phan[0].bai[0];
    var w = h("div", { class: "wrap" });
    w.appendChild(h("section", { class: "hero" },
      h("div", {}, h("h1", { text: "Thực hành Heuristic" }),
        h("p", { text: "Bài tập song song với từng bài giảng của khoá Heuristic: trắc nghiệm, tự luận, lab lập trình chấm tự động và ghi chú — kèm trình biên dịch C/C++ chạy ngay trong trình duyệt. Không cài đặt gì, dùng được cả trên điện thoại." })),
      h("div", { class: "hero-nut" },
        h("a", { class: "btn", href: "#/bai/" + tiep }, ic("play"), gan ? "Tiếp tục: " + ui.nhanBai(tiep) : "Bắt đầu: " + K.bai[tiep].ten),
        h("a", { class: "btn trong", href: "#/ide" }, ic("code"), "Mở IDE C/C++"),
        h("a", { class: "btn trong", href: "#/huong-dan" }, "Cách dùng"))));
    w.appendChild(h("div", { class: "so-lieu" },
      h("div", { class: "card" }, h("b", { text: tong.xong + "/" + tong.tong }), h("span", { text: "bài hoàn thành" })),
      h("div", { class: "card" }, h("b", { text: Math.round(tong.phanTram * 100) + "%" }), h("span", { text: "tiến độ chung" })),
      h("div", { class: "card" }, h("b", { text: sl.t.n ? sl.t.d + "/" + sl.t.n : "—" }), h("span", { text: "câu trắc nghiệm đúng" })),
      h("div", { class: "card" }, h("b", { text: sl.b.so ? sl.b.hop + "/" + sl.b.so : "—" }), h("span", { text: "lab đã hợp lệ" })),
      h("div", { class: "card" }, h("b", { text: String(sl.ghi) }), h("span", { text: "bài có ghi chú" }))));
    w.appendChild(h("a", { class: "the-bai the-ide", href: "#/ide", style: "margin-top:16px;min-height:0;flex-direction:row;align-items:center;gap:14px" },
      h("span", { class: "brand-mark", style: "width:44px;height:44px" }, ic("code")),
      h("div", {}, h("h3", { text: "IDE C/C++ online — không cần cài đặt" }),
        h("span", { class: "mut", text: "Viết, biên dịch (Clang → WebAssembly) và chạy C/C++ ngay trên trang; có JavaScript, nhập dữ liệu vào, lỗi biên dịch bấm là nhảy tới dòng." }))));
    K.phan.forEach(function (p) {
      var s = h("section", { class: "phan" }, h("h2", { text: p.ten }), h("p", { text: p.mota }));
      s.appendChild(h("div", { class: "luoi" }, p.bai.map(theBai)));
      w.appendChild(s);
    });
    w.appendChild(h("p", { class: "mut", style: "margin-top:30px;font-size:.9rem", html:
      'Mỗi bài có liên kết sang <b>bài giảng</b> và <b>mô phỏng trực quan</b> tương ứng. Tiến độ và mã của bạn lưu ngay trên thiết bị này' +
      (luu.luuDuoc() ? "." : ' — <b>trình duyệt đang chặn lưu trữ</b> nên sẽ mất khi đóng trang.') }));
    el.appendChild(w);
  });

  /* ---------- ghi chú tổng hợp ---------- */
  ui.dangKyTrang("ghi-chu", function (el) {
    ui.tieuDe("Ghi chú của tôi"); ui.danhDauBai(null);
    var w = h("div", { class: "wrap" });
    w.appendChild(h("h1", { text: "Ghi chú của tôi" }));
    var ds = tatCaId.map(function (id) { return { id: id, nd: (luu.doc("ghichu/" + id, "") || "").trim() }; }).filter(function (x) { return x.nd; });
    var o = h("input", { type: "search", placeholder: "Tìm trong ghi chú…", "aria-label": "Tìm trong ghi chú", style: "width:100%;max-width:420px" });
    var lst = h("div", {});
    function ve() {
      var q = D.boDau(o.value), kq = ds.filter(function (x) { return !q || D.boDau(x.nd + " " + ui.nhanBai(x.id)).indexOf(q) >= 0; });
      lst.replaceChildren();
      if (!kq.length) { lst.appendChild(h("p", { class: "mut", text: ds.length ? "Không có ghi chú khớp." : "Chưa có ghi chú nào. Mở một bài và viết ở mục “Ghi chú” — ghi chú tự lưu." })); return; }
      kq.forEach(function (x) {
        lst.appendChild(h("div", { class: "card" },
          h("h3", { style: "font-size:1.02rem" }, h("a", { href: "#/bai/" + x.id + "#ghi-chu", text: ui.nhanBai(x.id) })),
          h("div", { class: "md", html: TH.markup.html(x.nd) })));
      });
    }
    o.addEventListener("input", ve); ve();
    w.appendChild(h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 16px" }, o,
      h("button", { class: "btn", type: "button", disabled: !ds.length, onclick: function () {
        D.tai("ghi-chu-heuristic.md", "# Ghi chú — Thực hành Heuristic\n\n" + ds.map(function (x) { return "## " + ui.nhanBai(x.id) + "\n\n" + x.nd + "\n"; }).join("\n"), "text/markdown;charset=utf-8");
      } }, ic("dl"), "Tải tất cả (.md)")));
    w.appendChild(lst);
    el.appendChild(w);
  });

  /* ---------- hướng dẫn + dữ liệu của bạn ---------- */
  ui.dangKyTrang("huong-dan", function (el) {
    ui.tieuDe("Hướng dẫn"); ui.danhDauBai(null);
    var w = h("div", { class: "wrap" });
    w.appendChild(h("h1", { text: "Hướng dẫn" }));
    w.appendChild(h("div", { class: "card md", html: TH.markup.html([
      "## Mỗi bài có gì",
      "- **Tóm tắt** — những ý nhớ trong một phút.",
      "- **Trắc nghiệm** — chọn xong là biết đúng/sai kèm giải thích; làm lại được (đáp án được xáo).",
      "- **Tự luận** — tự viết, rồi xem đáp án mẫu và **tự chấm** theo các tiêu chí.",
      "- **Lab** — viết chương trình, nộp là được chấm tự động trên nhiều bộ dữ liệu; có mức đạt, so với lời giải tham chiếu và kiểm tra ý nghĩa thống kê như Bài 4.",
      "- **Ghi chú** — tự lưu, tổng hợp ở trang “Ghi chú của tôi”.",
      "",
      "## Lab hoạt động thế nào",
      "Trang sinh dữ liệu từ một seed cố định rồi đưa vào chương trình của bạn qua **stdin**; bạn in kết quả ra **stdout**. Cùng một đề giải được bằng **JavaScript** (chạy ngay, không tải gì) hoặc **C++** (biên dịch trong trình duyệt). Trong JavaScript có sẵn `readInput()`, `print()`, `log()` (gỡ lỗi, không bị chấm), `rng(seed)` và `now()`.",
      "",
      "## C/C++ không cần cài đặt",
      "Trình biên dịch là Clang chạy dưới dạng WebAssembly ngay trong trình duyệt. Lần đầu tải ≈ 25 MB (lưu lại để dùng offline). Giới hạn: **không có ngoại lệ** (`try/catch/throw`), không luồng, không tệp; stack 8 MB; bộ nhớ tối đa 512 MB. `#include <bits/stdc++.h>` dùng được.",
      "",
      "## Phím tắt",
      "- Trong trình soạn mã: `Ctrl`+`Enter` chạy · `Tab` / `Shift`+`Tab` thụt/lùi dòng · `Ctrl`+`/` chú thích dòng.",
      "- Điện thoại: dưới ô soạn có hàng phím ký hiệu `{ } ( ) [ ] ; < > …`."
    ].join("\n")) }));

    var dl = h("div", { class: "card", style: "margin-top:14px" }, h("h2", { style: "font-size:1.15rem", text: "Dữ liệu của bạn" }));
    dl.appendChild(h("p", { class: "mut", text: luu.luuDuoc()
      ? "Tiến độ, ghi chú và mã của bạn lưu ngay trên thiết bị này (không có tài khoản, không gửi lên máy chủ). Hãy sao lưu nếu muốn chuyển sang thiết bị khác."
      : "⚠️ Trình duyệt đang chặn lưu trữ (có thể do chế độ riêng tư) — dữ liệu chỉ tồn tại tới khi đóng trang. Vẫn có thể sao lưu thủ công bên dưới." }));
    var tep = h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      f.text().then(function (t) {
        var kq = luu.nhap(JSON.parse(t));
        D.toast("Đã khôi phục: " + kq.them + " mới, " + kq.capNhat + " cập nhật, " + kq.giu + " giữ nguyên (bản mới hơn thắng).", "ok");
        dungNav(); capNhatVong();
      }).catch(function (er) { D.toast("Không đọc được tệp: " + (er && er.message || er), "bad"); });
      e.target.value = "";
    } });
    dl.appendChild(h("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
      h("button", { class: "btn", type: "button", onclick: function () {
        var d = new Date(), z = function (n) { return (n < 10 ? "0" : "") + n; };
        D.tai("thuc-hanh-heuristic-" + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + ".json", JSON.stringify(luu.xuat()), "application/json");
      } }, ic("dl"), "Sao lưu (.json)"),
      h("button", { class: "btn", type: "button", onclick: function () { tep.click(); } }, ic("ul"), "Khôi phục từ tệp"), tep,
      h("button", { class: "btn btn-bad", type: "button", onclick: function () {
        D.hoi({ tieuDe: "Xoá toàn bộ dữ liệu?", noiDung: "Tiến độ, ghi chú, mã lab và đoạn mã trong IDE trên thiết bị này sẽ bị xoá. Không thể hoàn tác — nên sao lưu trước.", nutChinh: "Xoá tất cả", nguyHiem: true }).then(function (ok) {
          if (!ok) return; luu.khoa("").forEach(function (k) { luu.xoa(k); }); dungNav(); capNhatVong(); D.toast("Đã xoá dữ liệu", "ok");
        });
      } }, ic("trash"), "Xoá dữ liệu")));
    w.appendChild(dl);

    var cp = h("div", { class: "card", style: "margin-top:14px" }, h("h2", { style: "font-size:1.15rem", text: "Bộ nhớ trình biên dịch C/C++" }));
    var tt = h("p", { class: "mut", text: "Đang kiểm tra…" });
    cp.appendChild(tt);
    function lamMoi() {
      if (!TH.cpp) return;
      TH.cpp.cacheDaCo().then(function (co) {
        tt.textContent = co ? "Đã lưu trình biên dịch trên máy — dùng được khi offline." : "Chưa tải. Sẽ tải (≈ 25 MB) khi bạn biên dịch lần đầu.";
        xoa.disabled = !co;
      });
    }
    var xoa = h("button", { class: "btn", type: "button", onclick: function () {
      TH.cpp.xoaCache().then(function () { ghiCai({ cppDongY: false }); D.toast("Đã xoá bộ nhớ trình biên dịch", "ok"); lamMoi(); });
    } }, ic("trash"), "Xoá bộ nhớ trình biên dịch");
    cp.appendChild(xoa); lamMoi();
    w.appendChild(cp);

    var off = h("div", { class: "card", style: "margin-top:14px" }, h("h2", { style: "font-size:1.15rem", text: "Dùng khi không có mạng" }));
    var coSW = "serviceWorker" in navigator && /^https?:$/.test(location.protocol);
    off.appendChild(h("p", { class: "mut", text: coSW
      ? "Trang tự lưu các tệp đã mở. Bấm nút dưới để lưu trước toàn bộ " + tatCaId.length + " bài (vài trăm KB) — sau đó học được cả khi mất mạng. Riêng trình biên dịch C/C++ lưu khi bạn biên dịch lần đầu."
      : "Chế độ offline cần mở trang qua địa chỉ http(s) (không phải file://) bằng trình duyệt hỗ trợ service worker." }));
    off.appendChild(h("button", { class: "btn", type: "button", disabled: !coSW, onclick: function () {
      var urls = [location.href.split("#")[0], "manifest.webmanifest", "assets/icon-192.png"]
        .concat(D.$$("script[src],link[rel=stylesheet]").map(function (e) { return e.getAttribute("src") || e.getAttribute("href"); }))
        .concat(tatCaId.map(function (id) { return "data/" + id + ".js"; }));
      navigator.serviceWorker.ready.then(function (reg) {
        if (!reg.active) throw new Error("service worker chưa sẵn sàng");
        reg.active.postMessage({ loai: "luu", urls: urls });
        D.toast("Đang lưu " + urls.length + " tệp để dùng offline…", "ok");
      }).catch(function (er) { D.toast("Không lưu được: " + (er && er.message || er), "bad"); });
    } }, ic("dl"), "Lưu toàn bộ bài để dùng offline"));
    w.appendChild(off);
    el.appendChild(w);
  });

  ui.dangKyTrang("khong-co", function (el) {
    ui.tieuDe("Không tìm thấy");
    el.appendChild(h("div", { class: "wrap" }, h("div", { class: "card" }, h("h2", { text: "Không tìm thấy trang" }), h("p", { class: "mut", text: "Địa chỉ này không có trong trang thực hành." }), h("a", { class: "btn btn-ac", href: "#/" }, "Về trang chủ"))));
  });

  /* ---------- nhảy nhanh Ctrl+K ---------- */
  function nhayNhanh() {
    var dlg = h("dialog", { class: "hop", "aria-label": "Tìm bài", style: "padding:14px" });
    var o = h("input", { type: "search", placeholder: "Gõ tên bài (không cần dấu)…", "aria-label": "Tìm bài", style: "width:100%" });
    var lst = h("div", { style: "margin-top:10px;max-height:50vh;overflow:auto" });
    var chon = 0, kq = [];
    function ve() {
      var q = D.boDau(o.value);
      kq = tatCaId.filter(function (id) { return !q || D.boDau(ui.nhanBai(id)).indexOf(q) >= 0; }).slice(0, 12);
      chon = Math.min(chon, Math.max(0, kq.length - 1));
      lst.replaceChildren();
      kq.forEach(function (id, i) {
        lst.appendChild(h("a", { class: "nav-i", href: "#/bai/" + id, "aria-current": i === chon ? "page" : null, onclick: function () { dlg.close(); dlg.remove(); } }, h("span", { class: "nav-so", text: K.bai[id].so || "•" }), h("span", { class: "nav-ten", text: K.bai[id].ten })));
      });
      if (!kq.length) lst.appendChild(h("p", { class: "mut", text: "Không có bài khớp." }));
    }
    o.addEventListener("input", function () { chon = 0; ve(); });
    o.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { chon = Math.min(kq.length - 1, chon + 1); ve(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { chon = Math.max(0, chon - 1); ve(); e.preventDefault(); }
      else if (e.key === "Enter" && kq[chon]) { location.hash = "#/bai/" + kq[chon]; dlg.close(); dlg.remove(); }
    });
    dlg.addEventListener("close", function () { dlg.remove(); });
    dlg.appendChild(o); dlg.appendChild(lst);
    document.body.appendChild(dlg); ve();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    o.focus();
  }

  /* ---------- khởi động ---------- */
  function khoiDong() {
    main = $("#main"); elSide = $("#side");
    apDungTheme(); dungHeader(); dungNav();
    $("#scrim").addEventListener("click", function () { document.body.classList.remove("nav-mo"); });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); nhayNhanh(); }
      else if (e.key === "Escape") document.body.classList.remove("nav-mo");
    });
    if (root.matchMedia) {
      var mq = root.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", capNhatNutTheme);
    }
    root.addEventListener("hashchange", route);
    if (!luu.luuDuoc()) D.toast("Trình duyệt đang chặn lưu trữ — tiến độ sẽ không được nhớ.", "bad");
    route();
  }
  ui.khoiDong = khoiDong;
})(window);
