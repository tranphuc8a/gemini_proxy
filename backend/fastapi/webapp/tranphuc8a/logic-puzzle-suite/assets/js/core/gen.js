/* core/gen.js — cửa gọi các hàm nặng của engine: Puz.gen.call(type, fn, args) → Promise<kết quả>.
   Trong trình duyệt chạy trong Web Worker (assets/js/worker/gen.js) để giao diện không đơ khi sinh đề Khó/Chuyên gia hay giải đề tự nhập;
   không có Worker (mở bằng file://, bị chặn, node) thì chạy NGAY trên luồng hiện tại sau một nhịp (setTimeout 0) để màn hình kịp vẽ "đang sinh…".
   Cùng một đầu vào cho cùng một kết quả ở cả hai đường (engine tất định). Gọi mới không huỷ gọi cũ; `cancel()` dừng hẳn worker (đang sinh dở thì bỏ). */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var worker = null, workerState = "none", pending = new Map(), seq = 0, initWait = [], disabled = false;
  var DEFAULT_TIMEOUT = 25000;

  function scriptList() {
    var d = root.document; if (!d) return [];
    return Array.prototype.slice.call(d.querySelectorAll("script[data-pz]")).map(function (s) { return s.src; });
  }
  function killWorker(reason) {
    if (worker) { try { worker.terminate(); } catch (e) { /* đã chết */ } }
    worker = null; workerState = "none";
    pending.forEach(function (p) { clearTimeout(p.timer); p.reject(new Error(reason || "Đã huỷ.")); }); pending.clear();
    initWait.splice(0).forEach(function (w) { w.reject(new Error(reason || "Đã huỷ.")); });
  }
  function ensureWorker() {
    if (disabled || typeof root.Worker === "undefined" || !root.document || /^file:/.test(root.location && root.location.protocol)) return Promise.resolve(null);
    if (workerState === "ready") return Promise.resolve(worker);
    if (workerState === "starting") return new Promise(function (ok, no) { initWait.push({ resolve: ok, reject: no }); });
    workerState = "starting";
    return new Promise(function (ok, no) {
      initWait.push({ resolve: ok, reject: no });
      var w;
      try { w = new root.Worker(new root.URL("assets/js/worker/gen.js", root.document.baseURI).href); } catch (e) { disabled = true; workerState = "none"; initWait.splice(0).forEach(function (x) { x.resolve(null); }); return; }
      worker = w;
      w.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.op === "ready") { workerState = "ready"; initWait.splice(0).forEach(function (x) { x.resolve(w); }); return; }
        if (m.op === "initError") { disabled = true; try { w.terminate(); } catch (e) { /* ok */ } worker = null; workerState = "none"; initWait.splice(0).forEach(function (x) { x.resolve(null); }); return; }
        var p = pending.get(m.id); if (!p) return;
        pending.delete(m.id); clearTimeout(p.timer);
        if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || "Lỗi trong bộ sinh."));
      };
      w.onerror = function () { if (workerState === "starting") { disabled = true; worker = null; workerState = "none"; initWait.splice(0).forEach(function (x) { x.resolve(null); }); } };
      w.postMessage({ op: "init", scripts: scriptList() });
    });
  }

  function inline(type, fn, args) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try { var t = P.types.get(type); if (!t || typeof t[fn] !== "function") throw new Error("Không có " + type + "." + fn + "()"); resolve(t[fn].apply(t, args || [])); } catch (e) { reject(e); }
      }, 0);
    });
  }

  /** opts: { timeout (ms, 0 = không giới hạn), inline: true (ép chạy tại chỗ) } */
  function call(type, fn, args, opts) {
    opts = opts || {};
    if (opts.inline) return inline(type, fn, args);
    return ensureWorker().then(function (w) {
      if (!w) return inline(type, fn, args);
      return new Promise(function (resolve, reject) {
        var id = ++seq, ms = opts.timeout == null ? DEFAULT_TIMEOUT : opts.timeout;
        var p = { resolve: resolve, reject: reject, timer: 0 };
        if (ms > 0) p.timer = setTimeout(function () { killWorker("Sinh đề quá lâu — đã dừng. Thử lại hoặc chọn bậc/cỡ nhẹ hơn."); }, ms);
        pending.set(id, p);
        w.postMessage({ op: "call", id: id, type: type, fn: fn, args: args || [] });
      });
    });
  }

  function generate(type, seed, o, opts) { return call(type, "generate", [seed, o], opts); }
  function cancel() { killWorker("Đã huỷ."); }
  function status() { return disabled ? "inline" : workerState; }

  P.gen = { call: call, generate: generate, cancel: cancel, status: status };
  if (typeof module !== "undefined" && module.exports) module.exports = P.gen;
})(typeof globalThis !== "undefined" ? globalThis : this);
