/* ==========================================================================
   SERVICE WORKER — đọc được khi mất mạng (trang khoá học, OPIc, lab).

   ★ NGUỒN THẬT: courses/engine/sw.js — `python engine/sync.py` chép vào GỐC từng
     trang (nhóm "pwa_goc" trong dong-bo.json, "vao": "."). Sửa ở bản sao sẽ mất.

   Phạm vi (scope) là thư mục của trang, nên mỗi trang có worker và bộ nhớ đệm
   riêng — tên cache mang theo scope. Chiến lược theo loại request:
     · trang (điều hướng)          mạng trước; mất mạng → bản đã lưu (bỏ ?query:
                                   trang đọc chung dùng một HTML cho mọi ?khoa=)
     · mục lục, bài, tệp của khoá  mạng trước; mất mạng (hoặc mạng treo > 4 s
       + danh mục khoá             khi đã có bản lưu) → bản đã lưu. Request mang
                                   token quản trị (xem bản nháp) KHÔNG được lưu.
     · tìm kiếm, AI, quản trị      chỉ mạng — không có gì để trả lời từ cache
     · tệp tĩnh cùng origin        bản đã lưu ngay, đồng thời cập nhật ngầm
     · thư viện CDN, phông chữ     bản đã lưu nếu có (đổi phiên bản = đổi URL)
   Trang gửi danh sách tệp nó vừa dùng (pwa.js, loai "luu") để lần mở đầu tiên
   — lúc worker chưa kịp chạy — cũng có bản lưu.
   ========================================================================== */
"use strict";

var PHIEN_BAN = "1";
var TIEN_TO = "kh:" + self.registration.scope + ":";
var VO = TIEN_TO + "vo:" + PHIEN_BAN;
var NOI_DUNG = TIEN_TO + "noi-dung:" + PHIEN_BAN;
var CDN = /^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//;
var CHO_MANG_MS = 4000;

self.addEventListener("install", function () { self.skipWaiting(); });

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ten) {
    return Promise.all(ten.filter(function (k) {
      return k.indexOf(TIEN_TO) === 0 && k !== VO && k !== NOI_DUNG;      /* phiên bản cũ của chính trang này */
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function noiDungKhoa(url) {
  return /\/courses\/[^/]+\/(manifest|bundle|docs\/|assets\/)/.test(url.pathname) ||
         /\/courses$/.test(url.pathname) ||                     /* danh mục của trang Thư viện */
         /^\/webapp\/_api\/(list|config)/.test(url.pathname);
}
function chiMang(url) {
  return /\/(ai|gemini)\//.test(url.pathname) || /\/courses\/admin\//.test(url.pathname) ||
         /\/courses\/[^/]+\/(search|links|history|trash|export)/.test(url.pathname);
}
function luuDuoc(res) { return res && (res.ok || res.type === "opaque"); }

function trang(req) {
  var url = new URL(req.url);
  var khoa = url.origin + url.pathname;
  return fetch(req).then(function (res) {
    if (res.ok) {
      var ban = res.clone();
      caches.open(VO).then(function (c) { c.put(khoa, ban); });
    }
    return res;
  }).catch(function () {
    return caches.match(khoa).then(function (r) {
      return r || caches.match(req, { ignoreSearch: true }).then(function (r2) {
        return r2 || new Response(
          "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
          "<title>Đang offline</title><body style='font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:auto'>" +
          "<h1>Đang offline</h1><p>Trang này chưa được lưu để đọc khi mất mạng. Kết nối lại rồi tải lại trang.</p>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
      });
    });
  });
}

function mangTruoc(req) {
  return caches.open(NOI_DUNG).then(function (c) {
    return c.match(req).then(function (daLuu) {
      var mang = fetch(req).then(function (res) {
        if (res.ok) c.put(req, res.clone());
        return res;
      });
      if (!daLuu) return mang;
      /* đã có bản lưu: mạng treo quá lâu thì đưa bản lưu, mạng về sau vẫn cập nhật bản lưu */
      var hetGio = new Promise(function (ok) { setTimeout(function () { ok(daLuu); }, CHO_MANG_MS); });
      return Promise.race([mang.catch(function () { return daLuu; }), hetGio]);
    });
  });
}

function luuTruocCapNhatSau(req) {
  return caches.open(VO).then(function (c) {
    return c.match(req).then(function (daLuu) {
      var mang = fetch(req).then(function (res) {
        if (res.ok) c.put(req, res.clone());
        return res;
      });
      if (daLuu) { mang.catch(function () {}); return daLuu; }
      return mang;
    });
  });
}

function cdn(req) {
  return caches.open(VO).then(function (c) {
    return c.match(req).then(function (daLuu) {
      return daLuu || fetch(req).then(function (res) {
        if (luuDuoc(res)) c.put(req, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (req.mode === "navigate") { e.respondWith(trang(req)); return; }
  if (url.origin === self.location.origin) {
    if (chiMang(url)) return;
    if (noiDungKhoa(url)) {
      if (!req.headers.get("X-Admin-Session")) e.respondWith(mangTruoc(req));
      return;
    }
    e.respondWith(luuTruocCapNhatSau(req));
    return;
  }
  if (CDN.test(req.url)) e.respondWith(cdn(req));
});

/* pwa.js gửi các tệp trang vừa nạp (trước khi worker kịp chạy) để lưu sẵn. */
self.addEventListener("message", function (e) {
  var d = e.data || {};
  if (d.loai !== "luu" || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(VO).then(function (c) {
    return Promise.all(d.urls.slice(0, 200).map(function (u) {
      var url;
      try { url = new URL(u, self.registration.scope); } catch (err) { return null; }
      if (url.origin === self.location.origin) {
        if (chiMang(url) || noiDungKhoa(url)) return null;
        return c.match(url.href).then(function (co) {
          return co || fetch(url.href).then(function (res) { if (res.ok) return c.put(url.href, res); }).catch(function () {});
        });
      }
      if (!CDN.test(url.href)) return null;
      /* Bản CORS dùng được cho cả request CORS (phông chữ do CSS nạp) lẫn no-cors
         (thẻ <script>); bản opaque chỉ dùng được cho no-cors — nên thử CORS trước. */
      return c.match(url.href).then(function (co) {
        return co || fetch(url.href, { mode: "cors", credentials: "omit" }).catch(function () {
          return fetch(url.href, { mode: "no-cors" });
        }).then(function (res) {
          if (luuDuoc(res)) return c.put(url.href, res);
        }).catch(function () {});
      });
    }));
  }));
});
