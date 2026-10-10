/* ==========================================================================
   FILE SINH RA — DUNG SUA O DAY.
   Nguon that: courses/engine/mo-lien-ket.js
   Sua o do roi chay: python engine/sync.py
   ========================================================================== */
/* ==========================================================================
   MÔ-ĐUN LIÊN KẾT SONG SONG — nút "Thực hành", "Mô phỏng"… ở đầu mỗi bài giảng và ở trang chủ,
   để người học nhảy sang trang bài tập / mô phỏng tương ứng.

   ★ NGUỒN THẬT: courses/engine/mo-lien-ket.js (engine/sync.py chép). Chỉ trang nào khai báo `lienKet` mới dùng.

   cau-hinh.js khai báo (xem heuristic-course-2):
     moDun: [... , "mo-lien-ket"],
     lienKet: [
       { ten: "Thực hành", trangChu: "../heuristic-practice-2/",        // khung "Học song song" ở trang chủ (tuỳ chọn)
         url: function (slug, doc) {                                       // → null | "đường dẫn" | {href, ten} | mảng các thứ đó
           return "../heuristic-practice-2/#/bai/" + ...; } }
     ]
   Mô-đun không biết gì về trang đích: ánh xạ bài → địa chỉ do cau-hinh.js quyết định.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K) return;
  var DS = K.cauHinh("lienKet", null);
  if (!DS || !DS.length) return;

  K.themBieuTuong("flask", '<path d="M9 3h6M10 3v6L4.5 19a2 2 0 001.8 3h11.4a2 2 0 001.8-3L14 9V3M7.5 15h9"/>');

  if (!document.getElementById("lk-style")) {
    var st = document.createElement("style");
    st.id = "lk-style";
    st.textContent =
      ".lk-ngoai{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 0}" +
      ".lk-ngoai>b{font-size:.82rem;color:var(--tx3);font-weight:600;margin-right:2px}" +
      ".lk-ngoai a,.lk-home a{display:inline-flex;gap:7px;align-items:center;padding:8px 14px;min-height:40px;border:1px solid var(--acbd);" +
      "background:var(--acbg);color:var(--ac);border-radius:99px;font-weight:600;font-size:.9rem;text-decoration:none}" +
      ".lk-ngoai a:hover,.lk-home a:hover{background:var(--ac);color:var(--actx);border-color:var(--ac)}" +
      ".lk-ngoai .ic,.lk-home .ic{width:16px;height:16px}" +
      ".lk-home{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:18px 0 6px;padding:14px 16px;border:1px solid var(--acbd);" +
      "background:var(--surf);border-radius:var(--rad)}" +
      ".lk-home p{margin:0;flex:1 1 260px;color:var(--tx2);font-size:.92rem}.lk-home p b{color:var(--tx)}";
    document.head.appendChild(st);
  }

  function chuan(r, ten) {
    if (!r) return [];
    return (Array.isArray(r) ? r : [r]).map(function (x) {
      return typeof x === "string" ? { href: x, ten: ten } : x;
    }).filter(function (x) { return x && x.href; });
  }

  K.nghe("bai", function (doc) {
    var cu = document.querySelector(".lk-ngoai");
    if (cu) cu.remove();
    var nut = [];
    DS.forEach(function (g) {
      var r = null;
      try { r = g.url ? g.url(doc.slug, doc) : null; } catch (e) { r = null; }
      chuan(r, g.ten).forEach(function (x) { nut.push(x); });
    });
    var chips = document.querySelector(".doc .chips"), body = document.getElementById("body");
    if (!nut.length || !chips || !body) return;
    var div = document.createElement("div");
    div.className = "lk-ngoai";
    div.innerHTML = "<b>Học song song</b>";
    nut.forEach(function (x) {
      var a = document.createElement("a");
      a.href = x.href;
      a.innerHTML = K.icon("flask") + "<span>" + K.esc(x.ten) + "</span>";
      div.appendChild(a);
    });
    chips.parentNode.insertBefore(div, body);
  });

  K.nghe("trang-chu", function (main) {
    var g = DS.filter(function (x) { return x.trangChu; })[0];
    var hero = main && main.querySelector(".hero, .home > *");
    if (!g || !hero || main.querySelector(".lk-home")) return;
    var d = document.createElement("div");
    d.className = "lk-home";
    d.innerHTML = "<p><b>Học bằng tay, không cần cài đặt.</b> Trắc nghiệm, tự luận, lab lập trình chấm tự động và IDE C/C++ chạy ngay trong trình duyệt — " +
      "dùng được cả trên điện thoại. Mỗi bài giảng có một trang thực hành tương ứng.</p>" +
      '<a href="' + K.esc(g.trangChu) + '">' + K.icon("flask") + "<span>" + K.esc(g.ten) + "</span></a>";
    hero.parentNode.insertBefore(d, hero.nextSibling);
  });
})();
