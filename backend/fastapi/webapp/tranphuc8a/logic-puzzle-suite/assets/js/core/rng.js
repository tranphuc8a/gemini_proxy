/* core/rng.js — seed và bộ sinh số ngẫu nhiên TẤT ĐỊNH (mulberry32). Cùng seed → cùng dãy số → cùng puzzle trên mọi máy, mọi trình duyệt.
   Seed hiển thị là một số nguyên không âm < 2^32 ("Seed: 18372941"); chuỗi không phải số được băm (FNV-1a) ra số đó.
   `fork(nhãn)` tách một dòng số riêng từ cùng seed: thêm/bớt lời gọi ở bước này không làm lệch kết quả bước khác. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});

  function hash32(str) {
    var h = 2166136261, s = String(str);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  /** Số (hoặc chuỗi toàn chữ số) → uint32; chuỗi khác → băm. Không bao giờ ném lỗi. */
  function seedOf(x) {
    if (typeof x === "number" && isFinite(x)) return Math.floor(Math.abs(x)) % 4294967296;
    var s = String(x == null ? "" : x).trim();
    if (/^\d{1,15}$/.test(s)) return Number(s) % 4294967296;
    return hash32(s);
  }

  function create(seed) {
    var base = seedOf(seed), s = base;
    function next() {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var r = {
      seed: base,
      next: next,
      int: function (n) { return Math.floor(next() * n); },                       // [0, n)
      range: function (a, b) { return a + Math.floor(next() * (b - a + 1)); },     // [a, b]
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      shuffle: function (arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
      fork: function (label) { return create(hash32(base + ":" + label)); }
    };
    return r;
  }

  /** Seed ngẫu nhiên "đẹp" (8 chữ số) cho nút Puzzle mới. */
  function randomSeed() {
    var a = new Uint32Array(1);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a); else a[0] = Math.floor(Math.random() * 4294967296);
    return 10000000 + (a[0] % 90000000);
  }

  P.rng = { create: create, seedOf: seedOf, hash32: hash32, randomSeed: randomSeed };
  if (typeof module !== "undefined" && module.exports) module.exports = P.rng;
})(typeof globalThis !== "undefined" ? globalThis : this);
