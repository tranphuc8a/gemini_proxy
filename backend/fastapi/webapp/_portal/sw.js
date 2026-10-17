/* ==========================================================================
   sw.js — Web Apps Portal mở được khi mất mạng và cài như ứng dụng.

   Phải nằm ở GỐC thư mục cổng: phạm vi (scope) của worker chính là thư mục chứa nó (/webapp/_portal/).

   Bất biến quan trọng nhất: worker chỉ đụng tới GET cùng origin, và chỉ ba loại:
     1. vỏ của cổng (portal.html, assets/*, portal.config.json, manifest, biểu tượng) và ai-khach.js (nằm ngoài phạm vi
        nhưng trang nạp bằng <script>, thiếu nó thì mở offline sẽ lỗi);
     2. hai lời gọi ĐỌC danh sách app: /webapp/_api/list và /webapp/_api/config — để offline vẫn thấy danh sách đã lưu;
     3. không gì khác. Trang của từng app (/webapp/<app>/) có phạm vi, service worker và cache riêng (nếu app là PWA);
        API (/api/v1/…) không bao giờ bị chạm, nên đồng bộ không thể đọc nhầm bản cũ rồi ghi đè dữ liệu.

   Chiến lược (một cho vỏ): MẠNG TRƯỚC, mất mạng (hoặc treo quá CHO_MANG_MS) → bản đã lưu. Online luôn nhận bộ tệp mới đồng nhất.
   Danh sách app: cũng mạng-trước; khi dùng bản lưu thì gắn header X-Portal-Cache: hit + X-Portal-Date để trang báo "danh sách lưu lúc …".

   Cập nhật: PHIEN_BAN là dấu băm nội dung vỏ, do `python tao-pwa.py` đóng dấu (check.py báo lỗi nếu quên). Đổi tệp → đóng dấu lại →
   byte của sw.js đổi → trình duyệt cài worker mới nhưng ĐỂ NÓ CHỜ; trang hiện "Có bản mới — Tải lại", người dùng đồng ý mới gửi
   SKIP_WAITING. Lần cài đầu tiên thì chiếm trang ngay.
   ========================================================================== */
"use strict";

var PHIEN_BAN = "9374e1b100bb";
var PHAM_VI = self.registration.scope;                       /* .../webapp/_portal/ */
var DUONG_DAN = new URL(PHAM_VI).pathname;
var GOC = new URL("../", PHAM_VI);                           /* .../webapp/ */
var TIEN_TO = "portal:" + PHAM_VI + ":";
var CACHE = TIEN_TO + PHIEN_BAN;
var CACHE_API = TIEN_TO + "api";                             /* sống qua các phiên bản vỏ: danh sách app không phụ thuộc mã cổng */
var CHO_MANG_MS = 3500;
var TRANG = PHAM_VI + "portal.html";
var API = [new URL("_api/list", GOC).pathname, new URL("_api/config", GOC).pathname];
var NGOAI = [new URL("courses/engine/ai-khach.js", GOC).pathname];
var THEM = ["portal.config.json", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable.png", "assets/icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return fetch(new Request(TRANG, { cache: "reload" })).then(function (res) {
      if (!res.ok) throw new Error("portal.html: HTTP " + res.status);
      var ban = res.clone();
      return res.text().then(function (html) {
        var tep = [];
        var them = function (u) { if (u.origin === self.location.origin && u.href !== TRANG && tep.indexOf(u.href) === -1) tep.push(u.href); };
        html.replace(/(?:src|href)="([^"#]+)"/g, function (_, p) { them(new URL(p, TRANG)); return _; });
        THEM.forEach(function (p) { them(new URL(p, PHAM_VI)); });
        return c.put(TRANG, ban).then(function () {
          return c.addAll(tep.map(function (u) { return new Request(u, { cache: "reload" }); }));
        });
      });
    });
  }).then(function () { return self.registration.active ? null : self.skipWaiting(); }));   /* cập nhật thì chờ người dùng; cài lần đầu thì chiếm ngay */
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ten) {
    return Promise.all(ten.filter(function (k) { return k.indexOf(TIEN_TO) === 0 && k !== CACHE && k !== CACHE_API; })    /* phiên bản cũ của chính cổng này */
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

function khoa(url) { return url.origin + url.pathname; }       /* ?tab=… ?q=… là cùng một trang */

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
    return caches.open(CACHE).then(function (c) { return c.match(TRANG); }).then(function (r) {   /* vd .../_portal/ → dùng portal.html đã lưu */
      return r || new Response(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Ngoại tuyến</title>" +
        "<body style='font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:auto'><h1>Đang ngoại tuyến</h1>" +
        "<p>Cổng chưa được lưu trên máy này. Kết nối mạng rồi tải lại trang một lần.</p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    });
  });
}

/* Lưu kèm thời điểm lấy về, để khi phải dùng bản cũ còn biết nó cũ cỡ nào. */
function luu(c, key, res) {
  var hd = new Headers(res.headers);
  hd.set("X-Portal-Date", new Date().toUTCString());
  return res.clone().blob().then(function (b) { return c.put(key, new Response(b, { status: res.status, statusText: res.statusText, headers: hd })); });
}
function danhDau(saved) {
  var hd = new Headers(saved.headers);
  hd.set("X-Portal-Cache", "hit");
  return new Response(saved.body, { status: saved.status, statusText: saved.statusText, headers: hd });
}

function danhSach(req, url) {
  var key = khoa(url);
  return caches.open(CACHE_API).then(function (c) {
    var mang = fetch(req, { cache: "no-cache" }).then(function (res) {
      if (res.ok) luu(c, key, res);
      return res;
    });
    return c.match(key).then(function (saved) {
      if (!saved) return mang;
      var hetGio = new Promise(function (ok) { setTimeout(function () { ok(danhDau(saved.clone())); }, CHO_MANG_MS); });
      return Promise.race([mang.then(function (res) { return res.ok ? res : danhDau(saved.clone()); }, function () { return danhDau(saved.clone()); }), hetGio]);
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  var p = url.pathname;
  if (API.indexOf(p) !== -1) { e.respondWith(danhSach(req, url)); return; }
  if (p.indexOf(DUONG_DAN) !== 0 && NGOAI.indexOf(p) === -1) return;       /* ngoài cổng (app khác, API…): để mạng xử lý */
  if (req.mode === "navigate") e.respondWith(trang(req, url));
  else e.respondWith(mangTruoc(req, khoa(url)));
});
