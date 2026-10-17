/* ui/pwa.js — cài app, dùng offline, báo khi có bản mới.
   Đăng ký sw.js (cùng thư mục) sau khi trang tải xong; giữ lời mời cài của trình duyệt; worker mới ĐỨNG CHỜ (không tự chiếm trang đang soạn dở)
   → hiện "Có bản mới — Tải lại"; người dùng đồng ý mới gửi SKIP_WAITING và tải lại đúng một lần. */
(function (root) {
  "use strict";
  var W = root.Wiki, U = W.ui, nav = root.navigator;
  var offer = null, waiting = null, reloading = false, listeners = [], lastCheck = 0;

  function notify() { listeners.slice().forEach(function (f) { try { f(); } catch (e) { /* một người nghe lỗi không làm hỏng người khác */ } }); }
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
    var o = offer; offer = null; o.prompt();
    return o.userChoice.then(function (r) { notify(); return r.outcome === "accepted"; }, function () { notify(); return false; });
  }
  function offlineStatus() {
    if (!root.caches || !("serviceWorker" in nav) || !root.isSecureContext) return Promise.resolve("unsupported");
    var scope = new root.URL("./", root.location.href).href, prefix = "wiki:" + scope + ":";
    return root.caches.keys().then(function (names) {
      var mine = names.filter(function (n) { return n.indexOf(prefix) === 0; });
      if (!mine.length) return "preparing";
      return root.caches.open(mine[0]).then(function (c) { return c.match(new root.URL("index.html", scope).href).then(function (r) { return r || c.match(scope); }); }).then(function (r) { return r ? "ready" : "preparing"; });
    }, function () { return "preparing"; });
  }
  function watch(reg) {
    function consider(w) { if (w && nav.serviceWorker.controller) { waiting = w; notify(); } }
    if (reg.waiting) consider(reg.waiting);
    reg.addEventListener("updatefound", function () { var w = reg.installing; if (w) w.addEventListener("statechange", function () { if (w.state === "installed") consider(w); }); });
    root.document.addEventListener("visibilitychange", function () { if (root.document.visibilityState === "visible" && Date.now() - lastCheck > 30 * 60 * 1000) { lastCheck = Date.now(); reg.update().catch(function () {}); } });
  }
  function init() {
    root.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); offer = e; notify(); });
    root.addEventListener("appinstalled", function () { offer = null; notify(); });
    root.addEventListener("online", notify); root.addEventListener("offline", notify);
    if (!("serviceWorker" in nav) || !/^https?:$/.test(root.location.protocol)) return;
    var hadController = !!nav.serviceWorker.controller;
    nav.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController) { hadController = true; return; }                  // cài lần đầu: worker chiếm trang — KHÔNG tải lại (người dùng có thể đang gõ dở)
      if (reloading) return; reloading = true; root.location.reload();       // cập nhật do người dùng đồng ý: tải lại đúng một lần
    });
    var register = function () { lastCheck = Date.now(); nav.serviceWorker.register("./sw.js").then(function (reg) { if (reg) watch(reg); }, function (e) { if (root.console) root.console.warn("Không đăng ký được service worker:", e && e.message); }); };
    if (root.document.readyState === "complete") register(); else root.addEventListener("load", register);
  }

  U.pwa = { init: init, installState: installState, promptInstall: promptInstall, offlineStatus: offlineStatus, onChange: function (f) { listeners.push(f); }, updateReady: function () { return !!waiting; }, applyUpdate: function () { if (waiting) waiting.postMessage({ type: "SKIP_WAITING" }); }, isOnline: function () { return nav.onLine !== false; } };
})(typeof globalThis !== "undefined" ? globalThis : this);
