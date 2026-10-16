/* pwa.js — cài Code Studio như ứng dụng: đăng ký service worker (sw.js ở gốc app) và giữ lời mời cài của trình duyệt.
   Chỉ chạy trong trình duyệt. Mở bằng file:// thì không làm gì (không có service worker, không cài được).

   CS.pwa.state() cho giao diện biết phải hiện gì:
     installed  đang chạy như ứng dụng đã cài (cửa sổ riêng / màn hình chính)
     ready      trình duyệt đã cho phép cài — CS.pwa.install() mở hộp thoại cài
     ios        iPhone/iPad: không có hộp thoại cài, phải đi đường Chia sẻ → Thêm vào Màn hình chính
     insecure   trang không chạy qua HTTPS (máy chủ chạy ngay trên máy này cũng được) hoặc mở bằng file:// nên trình duyệt không cho cài
     menu       còn lại: cài bằng menu của trình duyệt (nút cài chưa xuất hiện hoặc trình duyệt không có)
   CS.pwa.offlineReady() → Promise<boolean>: service worker đã giữ bộ tệp của app trong Cache Storage (mở được khi mất mạng). */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});
  var nav = root.navigator;
  var offer = null;
  var listeners = [];

  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { /* một người nghe lỗi không được làm hỏng người khác */ } }); }
  function standalone() { return (root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) || nav.standalone === true; }
  function onIos() {
    var ua = nav.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);   /* iPadOS tự xưng là Mac */
  }
  function state() {
    if (standalone()) return "installed";
    if (offer) return "ready";
    if (!root.isSecureContext || !/^https?:$/.test(root.location.protocol) || !("serviceWorker" in nav)) return "insecure";
    return onIos() ? "ios" : "menu";
  }
  function install() {
    if (!offer) return Promise.resolve(false);
    var o = offer;
    offer = null;                                              /* lời mời chỉ dùng được một lần */
    o.prompt();
    return o.userChoice.then(function (r) { notify(); return r.outcome === "accepted"; }, function () { notify(); return false; });
  }
  function offlineReady() {
    if (!root.caches || !("serviceWorker" in nav)) return Promise.resolve(false);
    return root.caches.keys().then(function (ks) {
      var k = ks.filter(function (x) { return x.indexOf("codestudio:") === 0; })[0];
      return k ? root.caches.open(k).then(function (c) { return c.keys(); }).then(function (r) { return r.length >= 10; }) : false;
    }, function () { return false; });
  }

  root.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); offer = e; notify(); });
  root.addEventListener("appinstalled", function () { offer = null; notify(); });

  if ("serviceWorker" in nav && /^https?:$/.test(root.location.protocol)) {
    var register = function () {
      nav.serviceWorker.register("sw.js").catch(function (e) { if (root.console) root.console.warn("Không đăng ký được service worker:", e && e.message); });
    };
    if (root.document.readyState === "complete") register(); else root.addEventListener("load", register);   /* không tranh băng thông với lần vẽ đầu */
  }

  CS.pwa = { state: state, install: install, offlineReady: offlineReady, onChange: function (fn) { listeners.push(fn); } };
})(typeof globalThis !== "undefined" ? globalThis : this);
