/* Service worker của Thực hành Heuristic — dùng được khi mất mạng.
   Phạm vi = thư mục trang. Chỉ xử lý GET CÙNG ORIGIN dưới phạm vi này: trả bản đã lưu ngay và cập nhật ngầm
   (stale-while-revalidate). Không đụng gì tới tệp bên thứ ba: bộ biên dịch C++ (cdn.jsdelivr.net) có Cache Storage riêng
   do assets/cpp/cpp.js quản lý. Trang không có API/đồng bộ nên không có rủi ro ghi đè dữ liệu thiết bị khác. */
"use strict";

var PHIEN_BAN = "1";
var TIEN_TO = "th2-app-";
var TEN = TIEN_TO + PHIEN_BAN;
var GOC = new URL("./", self.location).pathname;

self.addEventListener("install", function () { self.skipWaiting(); });

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ds) {
    return Promise.all(ds.filter(function (k) { return k.indexOf(TIEN_TO) === 0 && k !== TEN; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.indexOf(GOC) !== 0) return;
  e.respondWith(caches.open(TEN).then(function (c) {
    return c.match(req, { ignoreSearch: req.mode === "navigate" }).then(function (daLuu) {
      var mang = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () { return daLuu || new Response("Đang offline và trang này chưa được lưu.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }); });
      return daLuu || mang;
    });
  }));
});

/* Trang gửi danh sách tệp muốn lưu trước (nút "Lưu để dùng offline"). */
self.addEventListener("message", function (e) {
  var d = e.data || {};
  if (d.loai !== "luu" || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(TEN).then(function (c) {
    return Promise.all(d.urls.map(function (u) {
      var url = new URL(u, self.location);
      if (url.origin !== self.location.origin || url.pathname.indexOf(GOC) !== 0) return null;
      return fetch(url.href).then(function (r) { if (r.ok) return c.put(url.href, r); return null; }).catch(function () { return null; });
    }));
  }));
});
