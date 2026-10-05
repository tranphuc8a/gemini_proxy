/* ==========================================================================
   sw.js — Quản lý chi tiêu mở được khi mất mạng (cài như ứng dụng).

   Phải nằm ở GỐC thư mục app: phạm vi (scope) của worker chính là thư mục chứa nó.

   Bất biến quan trọng nhất: worker CHỈ đụng tới tệp nằm dưới phạm vi của app.
   API đồng bộ (/api/v1/spending/…) nằm ngoài phạm vi, và máy chủ ở origin khác thì
   bị bỏ qua — nên không bao giờ có chuyện đồng bộ đọc nhầm một bản đã lưu cũ rồi
   ghi đè sổ của thiết bị khác. Mất mạng thì lời gọi API thất bại thật, đúng như
   store.js mong đợi (trạng thái "offline", giữ dirty, tự thử lại).

   Chiến lược (một cho mọi tệp của app): MẠNG TRƯỚC, mất mạng → bản đã lưu.
   Online luôn nhận bộ tệp mới đồng nhất sau mỗi lần deploy — không có cảnh index.html
   mới chạy với app.js cũ. Mạng treo quá CHO_MANG_MS mà đã có bản lưu thì dùng bản lưu.

   Khi cài (install) worker tự đọc index.html và lưu sẵn mọi assets/* nó nhắc tới,
   nên thêm tệp mới vào index.html không cần sửa danh sách ở đây. Đổi quy tắc của
   worker thì tăng PHIEN_BAN để bộ nhớ đệm cũ bị dọn.
   ========================================================================== */
"use strict";

var PHIEN_BAN = "1";
var PHAM_VI = self.registration.scope;                       /* .../quan-ly-chi-tieu/ */
var DUONG_DAN = new URL(PHAM_VI).pathname;
var TIEN_TO = "qlct:" + PHAM_VI + ":";
var CACHE = TIEN_TO + PHIEN_BAN;
var CHO_MANG_MS = 4000;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return fetch(new Request(PHAM_VI, { cache: "reload" })).then(function (res) {
      if (!res.ok) throw new Error("index.html: HTTP " + res.status);
      var ban = res.clone();
      return res.text().then(function (html) {
        var tep = [];
        html.replace(/(?:src|href)="(assets\/[^"]+)"/g, function (_, p) { if (tep.indexOf(p) === -1) tep.push(p); return _; });
        return c.put(PHAM_VI, ban).then(function () {
          return c.addAll(tep.map(function (p) { return new Request(p, { cache: "reload" }); }));
        });
      });
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ten) {
    return Promise.all(ten.filter(function (k) { return k.indexOf(TIEN_TO) === 0 && k !== CACHE; })   /* phiên bản cũ của chính app này */
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function mangTruoc(req, khoa) {
  return caches.open(CACHE).then(function (c) {
    return c.match(khoa).then(function (daLuu) {
      /* tệp tĩnh: hỏi lại máy chủ thay vì tin bản trong bộ nhớ đệm HTTP của trình duyệt */
      var mang = fetch(req, req.mode === "navigate" ? undefined : { cache: "no-cache" }).then(function (res) {
        if (res.ok) c.put(khoa, res.clone());
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
  return mangTruoc(req, url.origin + url.pathname).catch(function () {
    return caches.open(CACHE).then(function (c) { return c.match(PHAM_VI); }).then(function (r) {   /* vd .../index.html: dùng bản gốc */
      return r || new Response(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<title>Đang offline</title><body style='font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:auto'>" +
        "<h1>Đang offline</h1><p>Ứng dụng chưa được lưu trên máy này. Kết nối mạng rồi tải lại trang một lần.</p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(DUONG_DAN) !== 0) return;                  /* ngoài app (API…): để mạng xử lý */
  if (req.mode === "navigate") e.respondWith(trang(req, url));
  else e.respondWith(mangTruoc(req, url.origin + url.pathname));
});
