/* core/quiz.js — sinh câu hỏi trắc nghiệm cho Quiz Mode.
   Ba loại:
     scenario   "Nên dùng gì?": bài toán được tả bằng lời (kịch bản soạn tay trong lib-*.js) → chọn thuật toán/cấu trúc; có đáp án CHẤP NHẬN ĐƯỢC (also) nhưng chưa tối ưu
     complexity "Độ phức tạp thời gian của X?" (tự sinh từ dữ liệu; đáp án nhiễu lấy cùng nhóm)
     summary    "Mô tả nào khớp tên?" ngược lại: cho tóm tắt, chọn tên
   Mọi ngẫu nhiên đi qua `rnd` (mặc định Math.random) nên test có thể cố định hạt giống. */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var T = A.text;

  function shuffle(a, rnd) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, n, rnd) { return shuffle(a, rnd).slice(0, n); }

  function scenarioQ(s, byId, rnd) {
    var ans = s.answer.filter(function (id) { return byId(id); }), also = (s.also || []).filter(function (id) { return byId(id); }), wrong = (s.wrong || []).filter(function (id) { return byId(id) && ans.indexOf(id) === -1; });
    if (!ans.length || wrong.length < 2) return null;
    var main = ans[0], opts = [main].concat(also.slice(0, 1), pick(wrong, 3, rnd));
    opts = shuffle(opts.filter(function (x, i) { return opts.indexOf(x) === i; }), rnd);
    return { type: "scenario", ref: [main], cat: byId(main).category, prompt: s.prompt, hint: s.hints || null, why: s.why, level: s.level || 2,
      options: opts.map(function (id) { return { id: id, label: byId(id).name }; }), correct: ans.filter(function (id) { return opts.indexOf(id) !== -1; }), ok: also.filter(function (id) { return opts.indexOf(id) !== -1; }) };
  }

  function complexityQ(e, pool, rnd) {
    var time = e.complexity && e.complexity.time;
    if (!time) return null;
    var other = T.uniq(pool.filter(function (x) { return x !== e && x.complexity && x.complexity.time && x.complexity.time !== time; }).map(function (x) { return x.complexity.time; }));
    var same = T.uniq(pool.filter(function (x) { return x !== e && x.category === e.category && x.complexity && x.complexity.time && x.complexity.time !== time; }).map(function (x) { return x.complexity.time; }));
    var wrong = pick(same, 3, rnd);
    if (wrong.length < 3) wrong = wrong.concat(pick(other.filter(function (t) { return wrong.indexOf(t) === -1; }), 3 - wrong.length, rnd));
    if (wrong.length < 3) return null;
    var opts = shuffle([time].concat(wrong), rnd);
    return { type: "complexity", ref: [e.id], cat: e.category, prompt: "Độ phức tạp thời gian của **" + e.name + "** là gì?", why: e.name + ": " + time + (e.complexity.note ? ". " + e.complexity.note : "") + ".",
      options: opts.map(function (t) { return { id: t, label: t }; }), correct: [time], ok: [] };
  }

  function summaryQ(e, pool, rnd) {
    if (!e.summary || T.fold(e.summary).indexOf(T.fold(e.name)) !== -1) return null;
    var same = pool.filter(function (x) { return x !== e && x.category === e.category; });
    if (same.length < 3) return null;
    var wrong = pick(same, 3, rnd), opts = shuffle([e].concat(wrong), rnd);
    return { type: "summary", ref: [e.id], cat: e.category, prompt: "Thuật toán / cấu trúc nào: *" + e.summary + "*", why: "Đó là **" + e.name + "** — " + ((e.use_case || [])[0] || e.summary),
      options: opts.map(function (x) { return { id: x.id, label: x.name }; }), correct: [e.id], ok: [] };
  }

  /** o: {n (mặc định 10), cats: [id] (rỗng = tất cả), types: ["scenario","complexity","summary"], weak: {catId: tỉ lệ sai 0..1}, only: Set id (chỉ các mục này), rnd}.
      → mảng câu hỏi (≤ n), không lặp cùng mục tham chiếu hai lần liền nhau. */
  function make(entries, scenarios, o) {
    o = o || {};
    var rnd = o.rnd || Math.random, n = o.n || 10, types = o.types && o.types.length ? o.types : ["scenario", "complexity", "summary"];
    var cats = o.cats && o.cats.length ? o.cats : null, only = o.only || null, map = {};
    entries.forEach(function (e) { map[e.id] = e; });
    var byId = function (id) { return map[id] || null; };
    var pool = entries.filter(function (e) { return (!cats || cats.indexOf(e.category) !== -1) && (!only || only.has(e.id)); });
    var weight = function (cat) { return 1 + 2 * ((o.weak && o.weak[cat]) || 0); };
    var cand = [];
    if (types.indexOf("scenario") !== -1) scenarios.forEach(function (s) { var m = map[s.answer[0]]; if (m && pool.indexOf(m) !== -1) cand.push({ w: 3 * weight(m.category), make: function () { return scenarioQ(s, byId, rnd); } }); });
    if (types.indexOf("complexity") !== -1) pool.forEach(function (e) { cand.push({ w: weight(e.category), make: function () { return complexityQ(e, entries, rnd); } }); });
    if (types.indexOf("summary") !== -1) pool.forEach(function (e) { cand.push({ w: weight(e.category), make: function () { return summaryQ(e, entries, rnd); } }); });
    var out = [], used = {}, guard = 0;
    while (out.length < n && cand.length && guard++ < 2000) {
      var total = cand.reduce(function (s, c) { return s + c.w; }, 0), r = rnd() * total, idx = 0;
      for (; idx < cand.length - 1; idx++) { r -= cand[idx].w; if (r <= 0) break; }
      var c = cand.splice(idx, 1)[0], q = c.make();
      if (!q) continue;
      var key = q.type + ":" + q.ref[0];
      if (used[key]) continue;
      used[key] = 1; out.push(q);
    }
    return out;
  }

  /** Chấm một câu: → "right" | "ok" (đáp án chấp nhận được, chưa tối ưu) | "wrong". */
  function grade(q, picked) { return q.correct.indexOf(picked) !== -1 ? "right" : q.ok.indexOf(picked) !== -1 ? "ok" : "wrong"; }

  /** Tỉ lệ sai theo nhóm từ lịch sử → {catId: 0..1} (chỉ nhóm đã có ≥ 3 câu). */
  function weakAreas(log) {
    var per = {};
    log.forEach(function (rec) { (rec.answers || []).forEach(function (a) { var p = per[a.cat] || (per[a.cat] = { n: 0, bad: 0 }); p.n++; if (a.r === "wrong") p.bad++; }); });
    var out = {}; Object.keys(per).forEach(function (c) { if (per[c].n >= 3) out[c] = per[c].bad / per[c].n; });
    return out;
  }

  A.quiz = { make: make, grade: grade, weakAreas: weakAreas, shuffle: shuffle };
  if (typeof module !== "undefined" && module.exports) module.exports = A.quiz;
})(typeof globalThis !== "undefined" ? globalThis : this);
