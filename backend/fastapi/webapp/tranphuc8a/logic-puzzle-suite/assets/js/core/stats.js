/* core/stats.js — thống kê cá nhân và streak, TÍNH TỪ LỊCH SỬ (danh sách bản ghi g.record()). Thuần, không DOM.
   Một ván chỉ tính là "đã giải" khi result === "solved" (Reveal không tính là tự giải). Ngày theo giờ địa phương (record.day nếu có, không thì ngày của endedAt). */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});

  function dayOf(r) { return r.day || P.util.dayKey(r.endedAt || r.startedAt || 0); }
  function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function avg(a) { if (!a.length) return 0; var t = 0; a.forEach(function (x) { t += x; }); return t / a.length; }

  function bucket() { return { played: 0, solved: 0, revealed: 0, abandoned: 0, avgMs: 0, bestMs: 0, medianMs: 0, avgMistakes: 0, avgHints: 0, avgScore: 0, _t: [], _m: [], _h: [], _s: [] }; }
  function add(b, r) {
    b.played++;
    if (r.result === "solved") { b.solved++; b._t.push(r.time); b._m.push(r.mistakes || 0); b._h.push(r.hints || 0); b._s.push(r.score || 0); }
    else if (r.result === "revealed") b.revealed++; else b.abandoned++;
  }
  function seal(b) {
    b.avgMs = Math.round(avg(b._t)); b.bestMs = b._t.length ? Math.min.apply(null, b._t) : 0; b.medianMs = Math.round(median(b._t));
    b.avgMistakes = Math.round(avg(b._m) * 10) / 10; b.avgHints = Math.round(avg(b._h) * 10) / 10; b.avgScore = Math.round(avg(b._s) * 10) / 10;
    delete b._t; delete b._m; delete b._h; delete b._s; return b;
  }

  /** → { total: bucket, byType: {id: bucket + byTier:{tier: bucket}}, tiers… } */
  function summarize(records) {
    var total = bucket(), by = {};
    records.forEach(function (r) {
      add(total, r);
      var t = by[r.type] || (by[r.type] = { all: bucket(), tiers: {} });
      add(t.all, r);
      var tb = t.tiers[r.tier] || (t.tiers[r.tier] = bucket()); add(tb, r);
    });
    var out = { total: seal(total), byType: {} };
    Object.keys(by).forEach(function (id) {
      var o = seal(by[id].all); o.byTier = {};
      Object.keys(by[id].tiers).forEach(function (tid) { o.byTier[tid] = seal(by[id].tiers[tid]); });
      out.byType[id] = o;
    });
    return out;
  }

  /** Đếm số ván ĐÃ GIẢI theo ngày: { "2026-10-06": 2, … }. */
  function perDay(records) {
    var m = {}; records.forEach(function (r) { if (r.result === "solved") { var d = dayOf(r); m[d] = (m[d] || 0) + 1; } });
    return m;
  }

  /** Streak: số ngày liên tiếp đạt mục tiêu (goal ván/ngày). Streak hiện tại còn "sống" nếu hôm nay đã đạt HOẶC hôm qua đã đạt (hôm nay còn thời gian).
     → { current, best, todayCount, goal, todayDone, bestEnd } */
  function streak(records, today, goal) {
    goal = Math.max(1, goal | 0 || 1);
    var m = perDay(records), U = P.util, days = Object.keys(m).filter(function (d) { return m[d] >= goal; }).sort();
    var best = 0, run = 0, bestEnd = null, prev = null;
    days.forEach(function (d) { run = prev && U.dayNumber(d) - U.dayNumber(prev) === 1 ? run + 1 : 1; if (run > best) { best = run; bestEnd = d; } prev = d; });
    var set = {}; days.forEach(function (d) { set[d] = 1; });
    var cur = 0, d0 = set[today] ? today : U.addDays(today, -1);
    if (set[d0]) for (var d = d0; set[d]; d = U.addDays(d, -1)) cur++;
    return { current: cur, best: best, bestEnd: bestEnd, todayCount: m[today] || 0, goal: goal, todayDone: !!set[today] };
  }

  /** Các ván gần nhất của một loại (mới → cũ), mặc định chỉ ván đã giải. */
  function recent(records, type, n, onlySolved) {
    return records.filter(function (r) { return (!type || r.type === type) && (!onlySolved || r.result === "solved"); }).sort(function (a, b) { return (b.endedAt || 0) - (a.endedAt || 0); }).slice(0, n || 10);
  }

  P.stats = { summarize: summarize, perDay: perDay, streak: streak, recent: recent, dayOf: dayOf, median: median };
  if (typeof module !== "undefined" && module.exports) module.exports = P.stats;
})(typeof globalThis !== "undefined" ? globalThis : this);
