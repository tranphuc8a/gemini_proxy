/* core/util.js — tiện ích thuần dùng chung cho mọi loại puzzle: bậc độ khó, định dạng thời gian, ngày địa phương, nhận diện puzzle, bit.
   Không đụng DOM, chạy được trong node và trong Web Worker. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});

  /** Bốn bậc độ khó. `min` ≤ điểm < `max` (điểm 0–10). Mỗi loại puzzle sinh sao cho điểm thật rơi vào khoảng của bậc được chọn. */
  var TIERS = [
    { id: "easy", name: "Dễ", min: 0, max: 3.5, target: 2.5 },
    { id: "medium", name: "Vừa", min: 3.5, max: 5.5, target: 4.5 },
    { id: "hard", name: "Khó", min: 5.5, max: 7.5, target: 6.5 },
    { id: "expert", name: "Chuyên gia", min: 7.5, max: 10.01, target: 8.5 }
  ];
  function tierOfScore(score) {
    for (var i = 0; i < TIERS.length; i++) if (score < TIERS[i].max) return TIERS[i];
    return TIERS[TIERS.length - 1];
  }
  function tier(id) { for (var i = 0; i < TIERS.length; i++) if (TIERS[i].id === id) return TIERS[i]; return null; }
  function clampScore(x) { return Math.max(0, Math.min(10, Math.round(x * 10) / 10)); }

  /** 452000 ms → "07:32"; từ 1 giờ → "1:07:32". */
  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60, p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return h ? h + ":" + p(m) + ":" + p(ss) : p(m) + ":" + p(ss);
  }

  /** Khoá ngày theo GIỜ ĐỊA PHƯƠNG: "2026-10-06". Dùng cho streak và Daily Puzzle. */
  function dayKey(d) {
    d = d instanceof Date ? d : new Date(d == null ? Date.now() : d);
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  /** "2026-10-06" → số ngày kể từ 1970-01-01 (không phụ thuộc múi giờ, không lệch giờ mùa hè). */
  function dayNumber(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN;
  }
  function addDays(key, n) {
    var t = new Date(dayNumber(key) * 86400000 + n * 86400000), p = function (x) { return x < 10 ? "0" + x : "" + x; };
    return t.getUTCFullYear() + "-" + p(t.getUTCMonth() + 1) + "-" + p(t.getUTCDate());
  }

  function popcount(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); x = (x + (x >>> 4)) & 0x0f0f0f0f; return Math.imul(x, 0x01010101) >>> 24; }
  /** Vị trí các bit 1 của mask, tăng dần. */
  function bitsOf(mask) { var out = []; for (var i = 0; mask; i++, mask >>>= 1) if (mask & 1) out.push(i); return out; }
  function lowBit(mask) { return 31 - Math.clz32(mask & -mask); }

  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function eqArr(a, b) { if (a === b) return true; if (!a || !b || a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

  /** Mã nhận diện nội dung puzzle (ổn định): loại + băm phần tĩnh + trạng thái đầu. Hai puzzle giống hệt nhau → cùng id (nhập lại không nhân đôi). */
  function puzzleId(p) {
    var h = P.rng.hash32(JSON.stringify([p.type, p.size, p.data, p.initial && p.initial.v]));
    return p.type + "-" + h.toString(36);
  }

  /** Chạy fn rồi cho biết mất bao nhiêu ms (để báo cáo, không dùng cho logic). */
  function timeIt(fn) { var t0 = Date.now(), r = fn(); return { result: r, ms: Date.now() - t0 }; }

  P.util = { TIERS: TIERS, tierOfScore: tierOfScore, tier: tier, clampScore: clampScore, fmtTime: fmtTime, dayKey: dayKey, dayNumber: dayNumber, addDays: addDays,
    popcount: popcount, bitsOf: bitsOf, lowBit: lowBit, clone: clone, eqArr: eqArr, puzzleId: puzzleId, timeIt: timeIt };
  if (typeof module !== "undefined" && module.exports) module.exports = P.util;
})(typeof globalThis !== "undefined" ? globalThis : this);
