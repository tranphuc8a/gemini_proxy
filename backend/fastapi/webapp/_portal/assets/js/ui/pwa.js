/* ui/pwa.js — cài cổng như ứng dụng, dùng offline, và báo khi có bản mới.

   * Đăng ký sw.js (cùng thư mục, phạm vi /webapp/_portal/) sau khi trang tải xong.
   * Giữ lời mời cài của trình duyệt (beforeinstallprompt) để nút "Cài đặt" tự bật.
   * Có bản mới: worker mới đứng chờ (không tự chiếm trang đang mở) → hiện thông báo "Tải lại"; người dùng đồng ý thì
     gửi SKIP_WAITING, worker mới nhận quyền, trang tải lại đúng một lần.
   * Theo dõi online/offline.

   installState():  installed | ready | ios | insecure | menu   (như các app khác của dự án) */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var nav = root.navigator;
  var offer = null, waiting = null, reloading = false, listeners = [], lastCheck = 0;

  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { /* một người nghe lỗi không được làm hỏng người khác */ } }); }
  function onChange(fn) { listeners.push(fn); }
  function standalone() { return (root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) || nav.standalone === true; }
  function onIos() { var ua = nav.userAgent || ""; return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1); }

  function installState() {
    if (standalone()) return "installed";
    if (offer) return "ready";
    if (!root.isSecureContext || !/^https?:$/.test(root.location.protocol) || !("serviceWorker" in nav)) return "insecure";
    return onIos() ? "ios" : "menu";
  }

  function promptInstall() {
    if (!offer) return Promise.resolve(false);
    var o = offer; offer = null;
    o.prompt();
    return o.userChoice.then(function (r) { notify(); return r.outcome === "accepted"; }, function () { notify(); return false; });
  }

  /** Cổng đã được worker lưu đủ để mở khi không có mạng chưa? */
  function offlineStatus() {
    if (!root.caches || !("serviceWorker" in nav) || !root.isSecureContext) return Promise.resolve("unsupported");
    var scope = new root.URL("./", root.location.href).href, prefix = "portal:" + scope + ":";
    return root.caches.keys().then(function (names) {
      var mine = names.filter(function (n) { return n.indexOf(prefix) === 0 && n !== prefix + "api"; });
      if (!mine.length) return "preparing";
      return root.caches.open(mine[0]).then(function (c) { return c.match(new root.URL("portal.html", scope).href); }).then(function (r) { return r ? "ready" : "preparing"; });
    }, function () { return "preparing"; });
  }

  function watch(reg) {
    function consider(worker) {
      if (worker && nav.serviceWorker.controller) { waiting = worker; notify(); }
    }
    if (reg.waiting) consider(reg.waiting);
    reg.addEventListener("updatefound", function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener("statechange", function () { if (w.state === "installed") consider(w); });
    });
    // Người dùng để tab mở rất lâu: thỉnh thoảng hỏi lại xem có bản mới không (tối đa 30 phút một lần).
    root.document.addEventListener("visibilitychange", function () {
      if (root.document.visibilityState === "visible" && Date.now() - lastCheck > 30 * 60 * 1000) { lastCheck = Date.now(); reg.update().catch(function () { /* offline */ }); }
    });
  }

  function applyUpdate() {
    if (!waiting) return;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  function init() {
    root.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); offer = e; notify(); });
    root.addEventListener("appinstalled", function () { offer = null; notify(); });
    root.addEventListener("online", notify);
    root.addEventListener("offline", notify);
    if (!("serviceWorker" in nav) || !/^https?:$/.test(root.location.protocol)) return;
    nav.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading) return;
      reloading = true;
      root.location.reload();
    });
    var register = function () {
      lastCheck = Date.now();
      nav.serviceWorker.register("./sw.js").then(function (reg) { if (reg) watch(reg); }, function (e) { if (root.console) root.console.warn("Không đăng ký được service worker:", e && e.message); });
    };
    if (root.document.readyState === "complete") register(); else root.addEventListener("load", register);   // không tranh băng thông với lần vẽ đầu
  }

  P.pwa = {
    init: init, installState: installState, promptInstall: promptInstall, offlineStatus: offlineStatus, onChange: onChange,
    updateReady: function () { return !!waiting; }, applyUpdate: applyUpdate, isOnline: function () { return nav.onLine !== false; }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
