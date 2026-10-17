/* ui/store.js — đọc/ghi dữ liệu cá nhân (Portal.prefs) vào localStorage.
   * Khoá "portal:v2". Lần đầu, nếu còn khoá của cổng cũ (portal:usage, portal:settings) thì chuyển sang rồi giữ nguyên bản cũ.
   * Ghi trễ 150 ms (gom nhiều thay đổi); đổi ở tab khác thì nhận qua sự kiện "storage".
   * localStorage có thể bị chặn (cửa sổ riêng tư): vẫn chạy trong phiên, `persistent` báo false để giao diện nói rõ. */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var KEY = "portal:v2", LEGACY_USAGE = "portal:usage", LEGACY_SETTINGS = "portal:settings";
  var current = P.prefs.defaults(), persistent = true, timer = 0, listeners = [], asked = false;

  function read(key) { try { var raw = root.localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); } catch (e) { return undefined; } }

  function load() {
    var raw = read(KEY);
    if (raw === undefined) { persistent = false; current = P.prefs.defaults(); return current; }
    if (raw) { current = P.prefs.parse(raw); return current; }
    var usage = read(LEGACY_USAGE), settings = read(LEGACY_SETTINGS);
    current = usage || settings ? P.prefs.fromLegacy(usage, settings) : P.prefs.defaults();
    flush();
    return current;
  }

  function flush() {
    clearTimeout(timer); timer = 0;
    try { root.localStorage.setItem(KEY, P.prefs.serialize(current)); persistent = true; } catch (e) { persistent = false; }
  }

  function get() { return current; }
  function set(next) {
    current = next;
    clearTimeout(timer);
    timer = setTimeout(flush, 150);
    return current;
  }

  /** Xin trình duyệt đừng tự xoá dữ liệu cổng khi thiếu chỗ — chỉ hỏi một lần, và chỉ khi người dùng đã ghim/ẩn gì đó. */
  function askPersist() {
    if (asked) return;
    asked = true;
    try { if (root.navigator.storage && root.navigator.storage.persist) root.navigator.storage.persist(); } catch (e) { /* bỏ qua */ }
  }

  function onExternal(fn) { listeners.push(fn); }
  root.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    current = P.prefs.parse(e.newValue);
    listeners.forEach(function (fn) { fn(current); });
  });
  root.addEventListener("pagehide", function () { if (timer) flush(); });

  P.store = { load: load, get: get, set: set, flush: flush, onExternal: onExternal, askPersist: askPersist, isPersistent: function () { return persistent; } };
})(typeof globalThis !== "undefined" ? globalThis : this);
