/* ==========================================================================
   FILE SINH RA — DUNG SUA O DAY.
   Nguon that: courses/engine/mo-thanh-tich.js
   Sua o do roi chay: python engine/sync.py
   ========================================================================== */
/* ==========================================================================
   MÔ-ĐUN THÀNH TÍCH — chuỗi ngày học, huy hiệu, chứng chỉ in được.

   ★ NGUỒN THẬT: courses/engine/mo-thanh-tich.js (engine/sync.py chép).

   Nhật ký hoạt động theo ngày (mở bài, đánh dấu xong; cộng các lượt ôn thẻ của
   mo-on-tap) → CHUỖI ngày học liên tiếp — hôm nay chưa học thì chuỗi tính tới
   hôm qua và vẫn "còn giữ". Huy hiệu tính lại từ tiến độ mỗi lần, mở khoá cái
   mới thì báo một lần. Học xong 100% → trang chứng chỉ (#/~chung-chi) in được
   (hoặc lưu PDF từ hộp thoại in). Tất cả nằm trên máy này, theo từng khoá.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K) return;

  function ngay(t) {
    var d = t ? new Date(t) : new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }
  function ngayChu(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }

  function ghi(loai) {
    var nk = K.LS.get("hoat-dong", {}), h = String(ngay());
    nk[h] = nk[h] || {};
    nk[h][loai] = (nk[h][loai] || 0) + 1;
    var khoa = Object.keys(nk).sort();
    while (khoa.length > 400) delete nk[khoa.shift()];
    K.LS.set("hoat-dong", nk);
  }
  function cacNgayHoc() {
    var nk = K.LS.get("hoat-dong", {}), on = K.onTap ? K.onTap.nhatKy() : {}, co = {};
    Object.keys(nk).forEach(function (d) { co[d] = 1; });
    Object.keys(on).forEach(function (d) { co[d] = 1; });
    return co;
  }
  function chuoi() {
    var co = cacNgayHoc(), h = ngay(), d = co[String(h)] ? h : h - 1, n = 0;
    while (co[String(d)]) { n++; d--; }
    var dai = 0, dang = 0;
    Object.keys(co).map(Number).sort(function (a, b) { return a - b; }).forEach(function (x, i, a) {
      dang = i && x === a[i - 1] + 1 ? dang + 1 : 1;
      dai = Math.max(dai, dang);
    });
    return { hienTai: n, homNay: !!co[String(h)], daiNhat: dai };
  }

  function tienDo() {
    var ids = K.thuTu(), xong = ids.filter(function (id) { return K.daXong(id); }).length;
    var nhom = 0;
    ((K.manifest() || {}).nav || []).forEach(function (s) {
      (s.groups || []).forEach(function (g) {
        var it = (g.items || []).filter(function (id) { return ids.indexOf(id) >= 0; });
        if (it.length && it.every(function (id) { return K.daXong(id); })) nhom++;
      });
    });
    var luotOn = 0, nk = K.onTap ? K.onTap.nhatKy() : {};
    Object.keys(nk).forEach(function (d) { luotOn += nk[d]; });
    var baiTap = 0;
    try {
      var tien = "hien-thi.chay@" + location.pathname;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(tien) === 0 && /\.dat$/.test(k)) baiTap++;
      }
    } catch (e) {}
    return { tong: ids.length, xong: xong, nhom: nhom, luotOn: luotOn, baiTap: baiTap, chuoi: chuoi() };
  }

  var HUY_HIEU = [
    { ma: "buoc-dau", icon: "🌱", ten: "Bước đầu", mo: "Học xong bài đầu tiên", dat: function (t) { return t.xong >= 1; } },
    { ma: "cham-chi", icon: "📚", ten: "Chăm chỉ", mo: "Học xong 10 bài", dat: function (t) { return t.xong >= 10; } },
    { ma: "tron-phan", icon: "🧩", ten: "Trọn một phần", mo: "Xong mọi bài của một phần", dat: function (t) { return t.nhom >= 1; } },
    { ma: "nua-chang", icon: "⛰️", ten: "Nửa chặng", mo: "Xong một nửa khoá học", dat: function (t) { return t.tong && t.xong * 2 >= t.tong; } },
    { ma: "ve-dich", icon: "🎓", ten: "Về đích", mo: "Xong toàn bộ khoá học", dat: function (t) { return t.tong && t.xong >= t.tong; } },
    { ma: "lua-3", icon: "🔥", ten: "Lửa 3 ngày", mo: "Học 3 ngày liên tiếp", dat: function (t) { return t.chuoi.daiNhat >= 3; } },
    { ma: "lua-7", icon: "🔥", ten: "Lửa 7 ngày", mo: "Học 7 ngày liên tiếp", dat: function (t) { return t.chuoi.daiNhat >= 7; } },
    { ma: "lua-30", icon: "🌋", ten: "Lửa 30 ngày", mo: "Học 30 ngày liên tiếp", dat: function (t) { return t.chuoi.daiNhat >= 30; } },
    { ma: "on-deu", icon: "🃏", ten: "Ôn đều", mo: "50 lượt ôn thẻ", dat: function (t) { return t.luotOn >= 50; } },
    { ma: "tho-code", icon: "💻", ten: "Thợ code", mo: "Đạt một bài tập lập trình trong bài", dat: function (t) { return t.baiTap >= 1; } },
    { ma: "tho-code-10", icon: "🧑‍💻", ten: "Thợ code lành nghề", mo: "Đạt 10 bài tập lập trình", dat: function (t) { return t.baiTap >= 10; } }
  ];

  /* Huy hiệu mới mở khoá: báo MỘT lần. */
  function xetHuyHieu() {
    var t = tienDo(), da = K.LS.get("huy-hieu", {}), moi = [];
    HUY_HIEU.forEach(function (h) {
      if (h.dat(t) && !da[h.ma]) { da[h.ma] = Date.now(); moi.push(h); }
    });
    if (moi.length) {
      K.LS.set("huy-hieu", da);
      K.toast("Huy hiệu mới: " + moi.map(function (h) { return h.icon + " " + h.ten; }).join(", "));
    }
    return t;
  }

  window.addEventListener("hashchange", function () {
    if (location.hash.indexOf("#/~chung-chi") !== 0) document.documentElement.classList.remove("in-chung-chi");
  });
  K.themLoiTat({ ten: "Thành tích", icon: "check", href: "#/~thanh-tich" });
  K.nghe("bai", function () { ghi("mo"); xetHuyHieu(); });
  K.nghe("tien-do", function (id, xong) { if (xong) ghi("xong"); xetHuyHieu(); });

  /* ---------------- ô trên trang chủ ---------------- */
  K.nghe("trang-chu", function (main) {
    var home = main.querySelector(".home");
    if (!home) return;
    var t = xetHuyHieu(), da = K.LS.get("huy-hieu", {});
    var co = HUY_HIEU.filter(function (h) { return da[h.ma]; });
    var o = document.createElement("div");
    o.className = "card full ot-o tt-o";
    o.id = "ttO";
    o.innerHTML = '<div class="offline-dau"><span class="tt-lua" aria-hidden="true">' + (t.chuoi.hienTai ? "🔥" : "✨") +
      "</span><b>" + (t.chuoi.hienTai ? t.chuoi.hienTai + " ngày liên tiếp" : "Bắt đầu chuỗi ngày học") + "</b></div><p>" +
      (t.chuoi.hienTai && !t.chuoi.homNay ? "Học một bài hôm nay để giữ chuỗi. " : "") +
      (co.length ? co.map(function (h) { return '<span class="tt-nho" title="' + K.esc(h.ten) + '">' + h.icon + "</span>"; }).join("") +
        " · " + co.length + "/" + HUY_HIEU.length + " huy hiệu" : "Chưa có huy hiệu — học xong bài đầu tiên để mở khoá.") +
      '</p><a class="btn btn-s" href="#/~thanh-tich">Thành tích</a>';
    home.appendChild(o);
  });

  /* ---------------- trang #/~thanh-tich ---------------- */
  function lich(co) {
    /* cột = tuần (thứ Hai → Chủ nhật), 12 cột, cột cuối là tuần này */
    var h = ngay(), tuan = 12, bat = h - (new Date(h * 86400000).getUTCDay() + 6) % 7 - 7 * (tuan - 1), o = "";
    for (var d = bat; d <= h; d++) {
      o += '<i class="' + (co[String(d)] ? "co" : "") + '" title="' + ngayChu(d) + (co[String(d)] ? " — có học" : "") + '"></i>';
    }
    return '<div class="tt-lich" aria-label="Các ngày có học trong 12 tuần qua">' + o + "</div>";
  }
  K.dangKyTrang("thanh-tich", function (main) {
    var t = xetHuyHieu(), da = K.LS.get("huy-hieu", {});
    document.title = "Thành tích — " + (((K.manifest() || {}).course || {}).title || "");
    main.innerHTML = '<div class="page"><article class="doc tt-trang">' +
      '<div class="crumb"><a href="#/">Trang chủ</a>' + K.icon("chev") + "<span>Thành tích</span></div>" +
      '<div class="prose prose-head"><h1>Thành tích</h1></div>' +
      '<div class="tt-so"><div><b>' + t.chuoi.hienTai + "</b><span>ngày liên tiếp</span></div><div><b>" + t.chuoi.daiNhat +
        "</b><span>chuỗi dài nhất</span></div><div><b>" + t.xong + "/" + t.tong + "</b><span>bài đã xong</span></div><div><b>" +
        t.luotOn + "</b><span>lượt ôn thẻ</span></div></div>" +
      "<h2 class=\"tt-h\">12 tuần qua</h2>" + lich(cacNgayHoc()) +
      '<h2 class="tt-h">Huy hiệu</h2><div class="tt-luoi">' + HUY_HIEU.map(function (h) {
        var co = !!da[h.ma];
        return '<div class="tt-hh' + (co ? " co" : "") + '"><span class="tt-icon">' + h.icon + "</span><b>" + K.esc(h.ten) +
          "</b><span>" + K.esc(h.mo) + "</span>" + (co ? "<em>" + new Date(da[h.ma]).toLocaleDateString("vi-VN") + "</em>" :
          "<em>chưa mở</em>") + "</div>";
      }).join("") + "</div>" +
      '<h2 class="tt-h">Chứng chỉ</h2>' + (t.tong && t.xong >= t.tong ?
        '<p>Bạn đã học xong toàn bộ khoá. <a class="btn btn-p" href="#/~chung-chi">🎓 Xem và in chứng chỉ</a></p>' :
        "<p>Học xong " + t.tong + " bài (còn " + (t.tong - t.xong) + ") để nhận chứng chỉ in được.</p>") +
      "</article></div>";
    window.scrollTo(0, 0);
  });

  /* ---------------- trang #/~chung-chi (in được) ---------------- */
  K.dangKyTrang("chung-chi", function (main) {
    var t = tienDo(), khoa = (K.manifest() || {}).course || {};
    if (!t.tong || t.xong < t.tong) {
      main.innerHTML = '<div class="page"><article class="doc"><div class="ot-xong">Chứng chỉ mở khi bạn học xong cả ' + t.tong +
        " bài (đã xong " + t.xong + "). <a href=\"#/~thanh-tich\">Xem thành tích</a></div></article></div>";
      return;
    }
    document.documentElement.classList.add("in-chung-chi");     /* luật in: chỉ in tờ chứng chỉ */
    if (!document.getElementById("phongNotoSerif")) {           /* có đủ dấu tiếng Việt (Georgia thì không) */
      var l = document.createElement("link");
      l.id = "phongNotoSerif"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&display=swap";
      document.head.appendChild(l);
    }
    var ten = K.LS.get("ten-hoc-vien", "");
    var da = K.LS.get("huy-hieu", {});
    var luc = da["ve-dich"] || Date.now();
    document.title = "Chứng chỉ — " + (khoa.title || "");
    main.innerHTML = '<div class="page"><article class="doc cc-trang">' +
      '<div class="cc-cong-cu"><label>Tên trên chứng chỉ <input id="ccTen" maxlength="80" value="' + K.esc(ten) +
        '" placeholder="Họ và tên"></label><button type="button" class="btn btn-p" id="ccIn">🖨 In / lưu PDF</button></div>' +
      '<section class="cc-giay" aria-label="Chứng chỉ hoàn thành"><div class="cc-vien">' +
        '<p class="cc-nho">Chứng nhận hoàn thành khoá học</p>' +
        '<p class="cc-ten" id="ccTenIn">' + K.esc(ten || "Học viên") + "</p>" +
        '<p class="cc-nho">đã học xong toàn bộ</p>' +
        '<p class="cc-khoa">' + K.esc(khoa.icon || "") + " " + K.esc(khoa.title || "") + "</p>" +
        '<p class="cc-nho">' + t.tong + " bài · chuỗi học dài nhất " + t.chuoi.daiNhat + " ngày · hoàn thành ngày " +
          new Date(luc).toLocaleDateString("vi-VN") + "</p>" +
      "</div></section></article></div>";
    var o = main.querySelector("#ccTen");
    o.addEventListener("input", function () {
      K.LS.set("ten-hoc-vien", o.value.trim());
      main.querySelector("#ccTenIn").textContent = o.value.trim() || "Học viên";
    });
    main.querySelector("#ccIn").addEventListener("click", function () { window.print(); });
    window.scrollTo(0, 0);
  });
})();
