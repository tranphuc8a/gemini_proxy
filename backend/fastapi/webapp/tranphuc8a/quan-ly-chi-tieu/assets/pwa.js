/* pwa.js — cài ứng dụng: đăng ký service worker (sw.js ở gốc app) và giữ lời mời cài của trình duyệt.
   Chỉ chạy trong trình duyệt. Mở bằng file:// thì không làm gì (không có service worker, không cài được).

   QL.pwa.state() cho giao diện biết phải hiện gì:
     installed  đang chạy như ứng dụng đã cài (cửa sổ riêng / màn hình chính)
     ready      trình duyệt đã cho phép cài — QL.pwa.install() mở hộp thoại cài
     ios        iPhone/iPad: không có hộp thoại cài, phải đi đường Chia sẻ → Thêm vào Màn hình chính
     insecure   trang không chạy qua HTTPS (máy chủ chạy ngay trên máy này cũng được) hoặc đang mở bằng file:// nên trình duyệt không cho cài
     menu       còn lại: cài bằng menu của trình duyệt (nút cài chưa xuất hiện hoặc trình duyệt không có)
   QL.pwa.onChange(fn) gọi fn khi state() có thể đã đổi. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});
  var nav = root.navigator;
  var offer = null;
  var listeners = [];

  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { /* một người nghe lỗi không được làm hỏng người khác */ } }); }

  function standalone() {
    return (root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) || nav.standalone === true;
  }
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

  root.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); offer = e; notify(); });
  root.addEventListener("appinstalled", function () { offer = null; notify(); });

  if ("serviceWorker" in nav && /^https?:$/.test(root.location.protocol)) {
    var register = function () {
      nav.serviceWorker.register("sw.js").catch(function (e) { if (root.console) root.console.warn("Không đăng ký được service worker:", e && e.message); });
    };
    if (document.readyState === "complete") register(); else root.addEventListener("load", register);   /* không tranh băng thông với lần vẽ đầu */
  }

  QL.pwa = { state: state, install: install, onChange: function (fn) { listeners.push(fn); } };
})(typeof globalThis !== "undefined" ? globalThis : this);
