/* worker/gen.js — Web Worker chạy các hàm NẶNG của engine (generate, fromInput, solve, trace…) ngoài luồng giao diện.
   Trang gửi { op: "init", scripts: [URL…] } (các tệp core + puzzles đã nạp trong index.html, có thuộc tính data-pz) để worker nạp CÙNG mã bằng importScripts,
   rồi gửi { id, op: "call", type, fn, args } → nhận { id, ok: true, result } hoặc { id, error }. Thêm loại puzzle mới chỉ cần thêm thẻ <script data-pz> vào index.html. */
"use strict";
var ready = false;
self.onmessage = function (e) {
  var m = e.data || {};
  if (m.op === "init") {
    try { self.importScripts.apply(self, m.scripts); ready = true; self.postMessage({ op: "ready", types: self.Puz.types.all().map(function (d) { return d.id; }) }); }
    catch (err) { self.postMessage({ op: "initError", error: String(err && err.message || err) }); }
    return;
  }
  if (m.op !== "call") return;
  if (!ready) { self.postMessage({ id: m.id, error: "Bộ sinh chưa sẵn sàng." }); return; }
  try {
    var t = self.Puz.types.get(m.type);
    if (!t || typeof t[m.fn] !== "function") throw new Error("Không có " + m.type + "." + m.fn + "()");
    self.postMessage({ id: m.id, ok: true, result: t[m.fn].apply(t, m.args || []) });
  } catch (err) { self.postMessage({ id: m.id, error: String(err && err.message || err) }); }
};
