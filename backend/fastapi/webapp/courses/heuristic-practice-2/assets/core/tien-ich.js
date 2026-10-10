/* Tiện ích thuần cho trang Thực hành Heuristic: thoát HTML, số giả ngẫu nhiên tất định,
   thống kê, định dạng số kiểu Việt. Không DOM, không storage — chạy được bằng node. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* mulberry32 — cùng seed thì cùng dãy ở mọi máy (Bài 4: bộ sinh tất định). */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    function r() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    r.int = function (n) { return Math.floor(r() * n); };                       /* [0, n) */
    r.khoang = function (lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }; /* [lo, hi] */
    return r;
  }

  function bam(chuoi) {                                   /* FNV-1a 32 bit */
    var h = 0x811c9dc5;
    chuoi = String(chuoi);
    for (var i = 0; i < chuoi.length; i++) { h ^= chuoi.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function tron(mang, r) {                                /* Fisher–Yates, trả bản sao */
    var a = mang.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = r.int(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function trungBinh(a) {
    if (!a.length) return 0;
    var s = 0; for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }
  function doLech(a) {                                    /* độ lệch chuẩn mẫu (chia n−1) */
    if (a.length < 2) return 0;
    var m = trungBinh(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  function saiSoChuan(a) { return a.length ? doLech(a) / Math.sqrt(a.length) : 0; }   /* SE = σ/√N */

  /* 61420 → "61 420" ; 0.5 → "0,5". Dùng khoảng trắng không ngắt để số không bị xuống dòng. */
  function so(x, thapPhan) {
    if (x == null || !isFinite(x)) return "—";
    var p = thapPhan == null ? 2 : thapPhan;
    var s = Math.abs(x).toFixed(p);
    if (thapPhan == null && s.indexOf(".") >= 0) s = s.replace(/\.?0+$/, "");     /* không chỉ định: bỏ số 0 thừa */
    var phan = s.split(".");
    phan[0] = phan[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (x < 0 && +s !== 0 ? "−" : "") + phan.join(",");
  }

  function phanTram(x, thapPhan) { return so(x * 100, thapPhan == null ? 1 : thapPhan) + "%"; }

  /* "1 234,5" / "1,234.5" / "-0.5" → số; không đọc được → NaN */
  function docSo(chuoi) {
    var s = String(chuoi == null ? "" : chuoi).trim().replace(/[\s  ]/g, "").replace("−", "-");
    if (!s) return NaN;
    if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    return /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s) ? parseFloat(s) : NaN;
  }

  TH.tienIch = {
    esc: esc, rng: rng, bam: bam, tron: tron, trungBinh: trungBinh, doLech: doLech,
    saiSoChuan: saiSoChuan, so: so, phanTram: phanTram, docSo: docSo
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.tienIch;
})(typeof globalThis !== "undefined" ? globalThis : this);
