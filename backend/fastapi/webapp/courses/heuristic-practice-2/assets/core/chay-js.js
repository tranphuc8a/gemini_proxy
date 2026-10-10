/* Chạy mã JavaScript của người học theo giao thức stdin/stdout, trong Web Worker (bị dừng hẳn khi quá giờ).
   Mã người học là một script thường (không cần bọc hàm), được cấp sẵn:
     readInput()   → toàn bộ stdin (chuỗi)
     print(...)    → in một dòng ra stdout (kết quả để chấm)
     log(...)      → in ra stderr (nhật ký gỡ lỗi, KHÔNG bị chấm); console.log/console.error cũng đi vào đây
     rng(seed)     → bộ sinh số giả ngẫu nhiên tất định (mulberry32): r() ∈ [0,1), r.int(n), r.khoang(a,b)
     now()         → thời gian hiện tại tính bằng ms (đo ngân sách thời gian)
   Mã chạy trong worker nên không chạm được trang, cookie hay localStorage. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var TI = TH.tienIch || (typeof require !== "undefined" ? require("./tien-ich.js") : null);

  var TIEN_TO = 2;      /* số dòng thân hàm `new Function` chèn trước mã người học */

  /* Hàm tự chứa (không tham chiếu ngoài) — cũng được nhúng nguyên văn vào worker. */
  function chayMa(src, input, rng) {
    var out = [], err = [], t0 = Date.now();
    function noi(a) {
      return Array.prototype.map.call(a, function (x) {
        if (typeof x === "string") return x;
        try { return typeof x === "object" ? JSON.stringify(x) : String(x); } catch (e) { return String(x); }
      }).join(" ");
    }
    var print = function () { out.push(noi(arguments)); };
    var log = function () { err.push(noi(arguments)); };
    var cons = { log: log, info: log, warn: log, error: log, debug: log };
    var kq = { ok: true, text: "", err: "", loi: "", dong: 0, ms: 0 };
    try {
      var f = new Function("readInput", "print", "log", "console", "rng", "now", '"use strict";' + src);
      f(function () { return input; }, print, log, cons, rng, function () { return typeof performance !== "undefined" ? performance.now() : Date.now(); });
    } catch (e) {
      kq.ok = false;
      kq.loi = (e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : String(e));
      var m = /<anonymous>:(\d+):(\d+)/.exec(String(e && e.stack || ""));
      if (m) kq.dong = Math.max(1, parseInt(m[1], 10) - 2);
    }
    kq.text = out.length ? out.join("\n") + "\n" : "";
    kq.err = err.join("\n");
    kq.ms = Date.now() - t0;
    return kq;
  }

  /* Đồng bộ — dùng trong node (kiểm lời giải tham chiếu) hoặc bất kỳ nơi nào không cần giới hạn giờ. */
  function chayDongBo(src, input) { return chayMa(src, input, TI.rng); }

  /* Trình chạy trong Web Worker. Trả về {chay(src, input, hanMs) → Promise, dung()} */
  function taoTrinhChay() {
    var w = null, url = null;
    function nap() {
      if (w) return w;
      var ma = "var __chayMa = " + chayMa.toString() + ";\nvar __rng = " + TI.rng.toString() + ";\n" +
        "self.onmessage = function (e) { var d = e.data; var r = __chayMa(d.src, d.input, __rng); r.id = d.id; self.postMessage(r); };";
      url = URL.createObjectURL(new Blob([ma], { type: "text/javascript" }));
      w = new Worker(url);
      return w;
    }
    var dem = 0;
    return {
      chay: function (src, input, hanMs) {
        return new Promise(function (xong) {
          var worker = nap(), id = ++dem, het = false;
          var hen = setTimeout(function () {
            het = true;
            worker.terminate(); w = null;
            xong({ ok: false, hetGio: true, text: "", err: "", loi: "Quá giờ (" + hanMs + " ms)", ms: hanMs });
          }, hanMs);
          worker.onmessage = function (e) {
            if (het || !e.data || e.data.id !== id) return;
            clearTimeout(hen);
            xong(e.data);
          };
          worker.onerror = function (ev) {
            if (ev.preventDefault) ev.preventDefault();
            clearTimeout(hen); het = true;
            try { worker.terminate(); } catch (e) { /* đã dừng */ }
            w = null;
            xong({ ok: false, text: "", err: "", loi: (ev && ev.message) || "Trình chạy gặp lỗi", ms: 0 });
          };
          worker.postMessage({ id: id, src: src, input: input });
        });
      },
      dung: function () { if (w) { w.terminate(); w = null; } }
    };
  }

  TH.chayJs = { chayDongBo: chayDongBo, taoTrinhChay: taoTrinhChay, TIEN_TO: TIEN_TO };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.chayJs;
})(typeof globalThis !== "undefined" ? globalThis : this);
