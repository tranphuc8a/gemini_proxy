/* ==========================================================================
   Thư viện khoá học — nạp engine, hoặc vẽ danh mục mọi khoá học.

   Có ?khoa=<slug> (cau-hinh.js đã đặt window.CAU_HINH): nạp assets/app.js —
   engine đọc bài dùng chung, bản sao do engine/sync.py chép — và thôi.

   Không có ?khoa=: danh mục. Hỏi GET /courses, mỗi khoá một thẻ:
     · khoá có trang riêng dựng sẵn (course.config.webapp, vd
       "courses/system-design-course") và trang đó CÓ THẬT → thẻ trỏ sang đó;
     · còn lại — gồm mọi khoá vừa tạo ở trang Quản lý — → ?khoa=<slug> ngay
       trên trang này. Một config.webapp trỏ vào thư mục không tồn tại (vd
       "courses/test") không làm hỏng link: nó bị bỏ qua.
   Trình duyệt có token phiên của trang Quản lý (cùng gốc API) thì danh mục
   hỏi ?all=1 — bản nháp hiện kèm nhãn "nháp" và mở bằng &nhap=1.
   ========================================================================== */
(function () {
"use strict";

if (!window.THU_VIEN) {
  var s = document.createElement("script");
  s.src = "assets/app.js";
  s.async = false;
  document.body.appendChild(s);
  return;
}

/* Danh mục không nạp engine (engine tự nạp pwa.js khi đọc khoá) — tự nạp để trang
   này cũng cài được thành ứng dụng và mở được khi mất mạng. */
var pwa = document.createElement("script");
pwa.src = "assets/pwa.js";
document.body.appendChild(pwa);

var $ = function (q, r) { return (r || document).querySelector(q); };
var esc = function (v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};

document.body.classList.add("thu-vien");
$(".brand").setAttribute("href", "./");

/* ---- giao diện sáng/tối (engine không nạp ở chế độ này) ---- */
var KHOA_THEME = "kh-thu-vien.theme";
var mq = window.matchMedia("(prefers-color-scheme: dark)");
function layTheme() { try { return JSON.parse(localStorage.getItem(KHOA_THEME)) || "auto"; } catch (e) { return "auto"; } }
function datTheme(v) { try { localStorage.setItem(KHOA_THEME, JSON.stringify(v)); } catch (e) {} }
function apTheme() {
  var qs = (location.search.match(/[?&]theme=(light|dark)/) || [])[1];
  if (qs) datTheme(qs);
  var pref = layTheme();
  document.documentElement.setAttribute("data-theme", pref === "auto" ? (mq.matches ? "dark" : "light") : pref);
}
mq.addEventListener("change", function () { if (layTheme() === "auto") apTheme(); });
apTheme();
$("#btnTheme").addEventListener("click", function () {
  datTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  apTheme();
});

/* ---- gốc API: cùng quy tắc với engine (?api= chỉ cho máy cục bộ / file://) ---- */
function apiTuDiaChi() {
  var q = (location.search.match(/[?&]api=([^&]+)/) || [])[1];
  if (!q) return null;
  var u;
  try { u = new URL(decodeURIComponent(q)); } catch (e) { return null; }
  var cucBo = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
  if ((u.protocol === "http:" || u.protocol === "https:") && (cucBo || location.protocol === "file:")) {
    return (u.origin + u.pathname).replace(/\/+$/, "");
  }
  if (window.console) console.warn("Bỏ qua ?api=" + u.origin + ": chỉ nhận API ở máy cục bộ hoặc khi trang mở từ file://");
  return null;
}
var CFG = window.__WEBAPP_CONFIG__ || {};
var GOC = (function () {
  var q = apiTuDiaChi();
  if (q !== null) return q;
  return typeof CFG.apiBase === "string" ? CFG.apiBase.replace(/\/+$/, "") : "";
})();
var WEBAPP = typeof CFG.webappBase === "string" ? CFG.webappBase.replace(/\/+$/, "") : "";
var giu = (location.search.match(/[?&](api|theme)=[^&]*/g) || []).map(function (p) { return p.slice(1); });

/* Token phiên mà trang Quản lý cất cho đúng gốc API này. */
function tokenQuanTri() {
  try {
    var khoa = "qlkh.phien@" + new URL(GOC || "/", location.href).href.replace(/\/+$/, "") + ".token";
    return JSON.parse(localStorage.getItem(khoa) || "null");
  } catch (e) { return null; }
}

/* Các trang có thật trong webapp/ — một request tới danh sách của portal
   (/webapp/_api/list), thay vì thử mở từng config.webapp (mỗi lần trượt là một
   dòng 404 đỏ trong console). */
function trangCoThat() {
  if (!WEBAPP) return Promise.resolve({});
  return fetch(WEBAPP + "/_api/list", { credentials: "same-origin" }).then(function (r) {
    return r.ok ? r.json() : {};
  }).then(function (j) {
    var co = {};
    (j.apps || []).concat.apply(j.apps || [], (j.collections || []).map(function (c) { return c.apps || []; }))
      .forEach(function (a) { if (a && a.path && a.has_index) co[a.path] = true; });
    return co;
  }, function () { return {}; });
}

/* Trang riêng của khoá: config.webapp hợp lệ, có trong danh sách, và không phải trang này. */
function trangRieng(c, co) {
  var w = String((c.config || {}).webapp || "").replace(/\/+$/, "");
  if (!WEBAPP || !co[w] || /(^|\/)khoa-hoc$/.test(w)) return null;
  return WEBAPP + "/" + w + "/";
}

function linkDoc(c) {
  var q = ["khoa=" + encodeURIComponent(c.slug)].concat(c.published ? [] : ["nhap=1"]).concat(giu);
  return "?" + q.join("&");
}

function veKhung(noiDung) {
  $("#main").innerHTML =
    '<div class="home"><div class="hero"><h1>Thư viện <u>khoá học</u></h1>' +
    "<p>Mọi khoá học trong database. Khoá vừa tạo ở trang Quản lý có mặt ở đây ngay — " +
    "không cần dựng trang riêng.</p>" +
    '<div class="hero-cta"><a class="btn btn-s" href="../quan-ly-khoa-hoc/">' +
    '<svg class="ic"><use href="#i-note"/></svg>Quản lý khoá học</a></div></div>' + noiDung + "</div>";
}

function veThe(c, rieng) {
  var s = c.stats || {};
  var gio = s.minutes ? "~" + Math.max(1, Math.round(s.minutes / 60)) + " giờ đọc" : "";
  var moTa = c.subtitle || c.description || "";
  if (moTa.length > 170) moTa = moTa.slice(0, 168).replace(/\s+\S*$/, "") + "…";
  var nhan = !c.published ? '<span class="tv-tag nhap">nháp</span>' :
             rieng ? '<span class="tv-tag rieng">trang riêng</span>' : '<span class="tv-tag">trang đọc chung</span>';
  return '<a class="card" data-slug="' + esc(c.slug) + '" href="' + esc(rieng && c.published ? rieng : linkDoc(c)) + '">' +
    '<div class="card-top"><div class="card-n tv-em">' + esc(c.icon || "📘") + "</div><h3>" + esc(c.title) + "</h3></div>" +
    "<p>" + esc(moTa) + "</p>" +
    '<div class="card-foot tv-foot"><b>' + (c.docCount || 0) + " bài</b>" + (gio ? "<span>" + gio + "</span>" : "") + nhan + "</div></a>";
}

function taiDanhMuc() {
  veKhung('<div class="boot"><svg class="ic"><use href="#i-book"/></svg>Đang tải danh sách khoá học…</div>');
  var tk = tokenQuanTri();
  fetch(GOC + "/courses" + (tk ? "?all=1" : ""), {
    credentials: "same-origin", headers: tk ? { "X-Admin-Session": tk } : {}
  }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (r) {
    var ds = r.courses || [];
    return trangCoThat().then(function (co) {
      var rieng = ds.map(function (c) { return trangRieng(c, co); });
      var nhap = ds.filter(function (c) { return !c.published; }).length;
      veKhung('<div class="sec-h"><h2>' + ds.length + " khoá học</h2><span>" +
        (nhap ? nhap + " bản nháp — chỉ hiện vì bạn đang đăng nhập trang Quản lý" : "bấm một khoá để đọc") + "</span></div>" +
        (ds.length ? '<div class="grid">' + ds.map(function (c, i) { return veThe(c, rieng[i]); }).join("") + "</div>" :
          '<div class="tv-trong">Chưa có khoá học nào được xuất bản. Tạo khoá ở ' +
          '<a href="../quan-ly-khoa-hoc/">trang Quản lý khoá học</a> rồi đánh dấu “Đã xuất bản”.</div>'));
    });
  }).catch(function (e) {
    veKhung('<div class="tv-trong">Không tải được danh sách khoá học: ' + esc(e && e.message || e) +
      " (API <code>" + esc((GOC || location.origin) + "/courses") + "</code>). " +
      '<a href="#" id="tvThuLai">Thử lại</a></div>');
    var b = $("#tvThuLai");
    if (b) b.addEventListener("click", function (ev) { ev.preventDefault(); taiDanhMuc(); });
  });
}

document.title = "Thư viện khoá học";
taiDanhMuc();
})();
