/* ==========================================================================
   sw.js — Personal Wiki mở được khi mất mạng và cài như ứng dụng.

   Phạm vi (scope) = thư mục chứa tệp này (/webapp/tranphuc8a/personal-wiki/).

   Bất biến: worker chỉ đụng tới GET cùng origin NẰM TRONG phạm vi (vỏ ứng dụng: index.html, assets/*, manifest, biểu tượng).
   API đồng bộ (/api/v1/wiki/…) nằm ngoài phạm vi nên KHÔNG BAO GIỜ bị lưu đệm hay trả bản cũ — đồng bộ không thể ghi đè dữ liệu bằng bản lỗi thời.
   Ghi chú của người dùng nằm trong IndexedDB, không phải ở đây; xoá cache không làm mất ghi chú.

   Chiến lược: MẠNG TRƯỚC; mất mạng (hoặc treo quá CHO_MANG_MS) → bản đã lưu. Online luôn nhận bộ tệp mới đồng nhất.
   Cập nhật: PHIEN_BAN là dấu băm nội dung vỏ do `tao-pwa.py` đóng dấu (check.py báo lỗi nếu quên). Byte của sw.js đổi → trình duyệt cài
   worker mới nhưng ĐỂ NÓ CHỜ; trang hiện "Có bản mới — Tải lại"; người dùng đồng ý mới gửi SKIP_WAITING (không chiếm trang đang soạn dở).
   Cài lần đầu thì chiếm trang ngay.
   ========================================================================== */
"use strict";

var PHIEN_BAN = "ec67df0e0413";
var PHAM_VI = self.registration.scope;
var DUONG_DAN = new URL(PHAM_VI).pathname;
var TIEN_TO = "wiki:" + PHAM_VI + ":";                       /* ui/pwa.js (offlineStatus) đọc đúng tiền tố này */
var CACHE = TIEN_TO + PHIEN_BAN;
var CHO_MANG_MS = 3500;
var TRANG = PHAM_VI + "index.html";
var THEM = ["assets/js/core/graph-worker.js", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable.png", "assets/icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return fetch(new Request(TRANG, { cache: "reload" })).then(function (res) {
      if (!res.ok) throw new Error("index.html: HTTP " + res.status);
      var ban = res.clone();
      return res.text().then(function (html) {
        var tep = [];
        var them = function (u) { if (u.origin === self.location.origin && u.pathname.indexOf(DUONG_DAN) === 0 && u.pathname !== new URL(TRANG).pathname && tep.indexOf(u.href) === -1) tep.push(u.href); };
        html.replace(/<(?:script|link)\b[^>]*?\s(?:src|href)="([^"#]+)"/g, function (_, p) { them(new URL(p, TRANG)); return _; });   /* chỉ tài nguyên của trang, không phải liên kết <a> */
        THEM.forEach(function (p) { them(new URL(p, PHAM_VI)); });
        return c.put(TRANG, ban).then(function () {
          return c.addAll(tep.map(function (u) { return new Request(u, { cache: "reload" }); }));
        });
      });
    });
  }).then(function () { return self.registration.active ? null : self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ten) {
    return Promise.all(ten.filter(function (k) { return k.indexOf(TIEN_TO) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

function khoa(url) { return url.origin + url.pathname; }       /* ?source=pwa và #/… là cùng một trang */

function mangTruoc(req, key) {
  return caches.open(CACHE).then(function (c) {
    return c.match(key).then(function (daLuu) {
      var mang = fetch(req, req.mode === "navigate" ? undefined : { cache: "no-cache" }).then(function (res) {
        if (res.ok) c.put(key, res.clone());
        return res;
      });
      if (!daLuu) return mang;
      var hetGio = new Promise(function (ok) { setTimeout(function () { ok(daLuu); }, CHO_MANG_MS); });
      /* máy chủ lỗi (5xx, proxy chết) cũng đưa bản lưu, không đưa trang lỗi */
      return Promise.race([mang.then(function (res) { return res.ok ? res : daLuu; }, function () { return daLuu; }), hetGio]);
    });
  });
}

function trang(req, url) {
  return mangTruoc(req, khoa(url)).catch(function () {
    return caches.open(CACHE).then(function (c) { return c.match(TRANG); }).then(function (r) {   /* vd .../personal-wiki/ → dùng index.html đã lưu */
      return r || new Response(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Ngoại tuyến</title>" +
        "<body style='font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:auto'><h1>Đang ngoại tuyến</h1>" +
        "<p>Personal Wiki chưa được lưu trên máy này. Kết nối mạng rồi tải lại trang một lần.</p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(DUONG_DAN) !== 0) return;          /* ngoài phạm vi (API, app khác): để mạng xử lý */
  if (req.mode === "navigate") e.respondWith(trang(req, url));
  else e.respondWith(mangTruoc(req, khoa(url)));
});
