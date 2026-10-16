/* tests.js — "Bộ test" của Code Studio: các ca (dữ liệu vào → đáp án mong đợi) nằm trong meta của đoạn mã/dự án, so sánh đầu ra,
   ra phán quyết kiểu chấm bài và chạy lần lượt các ca. LÕI THUẦN: không đụng DOM, không biết chạy bằng cách nào — bộ chạy một ca
   (`runOne`) do giao diện đưa vào (thường bọc CS.runner.run). Kiểm bằng node: kiem-bo-test.js.

   Mô hình (lưu trong item.meta, đi cùng đoạn mã khi đồng bộ):
     meta.tests    = [{ id, name, input, expected }]        ≤ 30 ca; mỗi trường ≤ 16 000 ký tự; xuống dòng luôn là LF
     meta.testMode = "lines" | "tokens" | "float" | "exact"   cách so sánh (mặc định "lines")
   Dung lượng chung của meta (≤ metaBytes của máy chủ) do project.js giữ: ca ở cuối bị bỏ trước nhất khi meta quá đầy.

   Phán quyết của một ca: AC đúng · WA sai kết quả · TLE quá giờ · RE lỗi khi chạy (mã thoát ≠ 0, bị tín hiệu giết)
   · CE lỗi biên dịch (cả bộ test dừng, vì mọi ca cùng một chương trình) · ERR không chạy được (mạng, hạn mức, người dùng dừng…)
   · SKIP chưa chạy (do dừng sớm). */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  var LIMITS = { cases: 30, nameChars: 60, fieldChars: 16000, diffRows: 40, rowChars: 300, scanLines: 5000 };
  var EPS = 1e-6;
  var DEFAULT_MODE = "lines";
  var MODES = [
    { id: "lines", label: "Từng dòng", hint: "Bỏ khoảng trắng ở cuối mỗi dòng và các dòng trống ở cuối đầu ra; còn lại phải giống từng ký tự." },
    { id: "tokens", label: "Từng từ", hint: "Chỉ so các từ/số cách nhau bởi khoảng trắng — xuống dòng hay dấu cách thừa không quan trọng." },
    { id: "float", label: "Số thực (sai số 1e-6)", hint: "Như “Từng từ”, nhưng hai số coi là bằng nhau khi lệch ≤ 1e-6 (tuyệt đối, hoặc tương đối với số lớn)." },
    { id: "exact", label: "Chính xác", hint: "Giống từng ký tự, kể cả khoảng trắng (chỉ bỏ một dấu xuống dòng ở cuối đầu ra)." }
  ];
  var MODE_IDS = Object.create(null);
  MODES.forEach(function (m) { MODE_IDS[m.id] = true; });
  var VERDICTS = {
    AC: { label: "Đúng", cls: "ok" }, WA: { label: "Sai kết quả", cls: "bad" }, TLE: { label: "Quá giờ", cls: "bad" },
    RE: { label: "Lỗi khi chạy", cls: "bad" }, CE: { label: "Lỗi biên dịch", cls: "bad" }, ERR: { label: "Không chạy được", cls: "bad" },
    SKIP: { label: "Chưa chạy", cls: "" }
  };
  var ID_RE = /^[a-z0-9]{4,12}$/;
  var ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
  var NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
  var CTRL_RE = /[\u0000-\u001f\u007f-\u009f]/g;

  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function str(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }
  function text(v) { return typeof v === "string" ? v : ""; }       /* trường do người dùng nhập: không phải chuỗi thì coi là rỗng (như project.js làm với stdin) */
  function lf(s) { return str(s).replace(/\r\n?/g, "\n"); }
  /** Cắt còn tối đa `max` đơn vị UTF-16, không để lại nửa cặp thay thế. */
  function cut(s, max) {
    if (s.length <= max) return s;
    var c = s.slice(0, max);
    return /[\ud800-\udbff]$/.test(c) ? c.slice(0, -1) : c;
  }
  function brief(s, max) { s = str(s); return s.length > max ? cut(s, max) + "…" : s; }
  function safe(fn, a, b) { if (typeof fn !== "function") return; try { fn(a, b); } catch (e) { /* hàm gọi lại của giao diện không được làm hỏng lần chạy */ } }

  /* ------------------------------------------------------------------ ca test */
  function newId(taken) {
    var id;
    do {
      id = "";
      for (var i = 0; i < 6; i++) id += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    } while (taken && taken[id]);
    return id;
  }
  /** Danh sách ca sạch: đủ trường, kiểu đúng, id duy nhất, tên không rỗng, LF, ≤ giới hạn. Lũy đẳng; đầu vào hỏng → []. */
  function normalize(list) {
    var out = [], taken = Object.create(null);
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < LIMITS.cases; i++) {
      var c = list[i];
      if (!isObj(c)) continue;
      var id = typeof c.id === "string" && ID_RE.test(c.id) && !taken[c.id] ? c.id : newId(taken);
      taken[id] = true;
      var name = cut(text(c.name).replace(CTRL_RE, " ").trim(), LIMITS.nameChars);
      out.push({ id: id, name: name || "Test " + (out.length + 1), input: cut(lf(text(c.input)), LIMITS.fieldChars), expected: cut(lf(text(c.expected)), LIMITS.fieldChars) });
    }
    return out;
  }
  function normalizeMode(m) { return typeof m === "string" && MODE_IDS[m] ? m : DEFAULT_MODE; }
  /** Một ca mới (tên "Test N" theo số ca đã có), id không trùng. */
  function createCase(list, init) {
    var taken = Object.create(null);
    (list || []).forEach(function (c) { taken[c.id] = true; });
    init = init || {};
    return { id: newId(taken), name: cut(text(init.name).replace(CTRL_RE, " ").trim(), LIMITS.nameChars) || "Test " + ((list || []).length + 1), input: cut(lf(text(init.input)), LIMITS.fieldChars), expected: cut(lf(text(init.expected)), LIMITS.fieldChars) };
  }

  /* ------------------------------------------------------------------ so sánh */
  function lineList(text, mode) {
    var lines = lf(text).split("\n");
    if (mode === "exact") { if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop(); return lines; }
    lines = lines.map(function (l) { return l.replace(/[ \t\f\v ]+$/, ""); });
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines;
  }
  function tokenList(text) { return lf(text).split(/\s+/).filter(Boolean); }
  function isTokenMode(mode) { return mode === "tokens" || mode === "float"; }
  function tokenEq(a, b, mode) {
    if (a === b) return true;
    if (mode !== "float" || !NUM_RE.test(a) || !NUM_RE.test(b)) return false;
    var x = Number(a), y = Number(b);
    return isFinite(x) && isFinite(y) && Math.abs(x - y) <= EPS * Math.max(1, Math.abs(y));
  }
  function lineEq(a, b, mode) {
    if (!isTokenMode(mode)) return a === b;
    var x = tokenList(a), y = tokenList(b);
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (!tokenEq(x[i], y[i], mode)) return false;
    return true;
  }
  function quote(s) { return "“" + brief(s, 80) + "”"; }

  /** So đầu ra thật với đáp án. → {ok:true} | {ok:false, kind:"diff"|"missing"|"extra", unit:"line"|"token", index (từ 1), expected, actual, message} */
  function compare(actual, expected, mode) {
    mode = normalizeMode(mode);
    var tok = isTokenMode(mode), a = tok ? tokenList(actual) : lineList(actual, mode), e = tok ? tokenList(expected) : lineList(expected, mode);
    var unit = tok ? "token" : "line", noun = tok ? "từ" : "dòng", ord = tok ? "Từ thứ " : "Dòng ";
    var n = Math.max(a.length, e.length);
    for (var i = 0; i < n; i++) {
      if (i >= a.length) return { ok: false, kind: "missing", unit: unit, index: i + 1, expected: e[i], actual: null, message: "Thiếu " + noun + " " + (tok ? "thứ " : "") + (i + 1) + " (mong đợi " + quote(e[i]) + ")" };
      if (i >= e.length) return { ok: false, kind: "extra", unit: unit, index: i + 1, expected: null, actual: a[i], message: "Thừa " + noun + " " + (tok ? "thứ " : "") + (i + 1) + " (" + quote(a[i]) + ")" };
      if (!(tok ? tokenEq(a[i], e[i], mode) : a[i] === e[i])) return { ok: false, kind: "diff", unit: unit, index: i + 1, expected: e[i], actual: a[i], message: ord + (i + 1) + " khác: mong đợi " + quote(e[i]) + ", nhận " + quote(a[i]) };
    }
    return { ok: true };
  }
  /** Bảng so từng dòng để hiển thị: {rows:[{n, expected, actual, same}], before, after} — cửa sổ ≤ diffRows dòng quanh chỗ khác đầu tiên. */
  function diffRows(actual, expected, mode, max) {
    mode = normalizeMode(mode); max = max > 0 ? max : LIMITS.diffRows;
    var a = lineList(actual, isTokenMode(mode) ? "lines" : mode).slice(0, LIMITS.scanLines), e = lineList(expected, isTokenMode(mode) ? "lines" : mode).slice(0, LIMITS.scanLines);
    var n = Math.max(a.length, e.length), rows = [], first = -1;
    for (var i = 0; i < n; i++) {
      var same = i < a.length && i < e.length && lineEq(a[i], e[i], mode);
      if (!same && first < 0) first = i;
      rows.push({ n: i + 1, expected: i < e.length ? brief(e[i], LIMITS.rowChars) : null, actual: i < a.length ? brief(a[i], LIMITS.rowChars) : null, same: same });
    }
    var start = Math.max(0, first < 0 ? 0 : first - 2), win = rows.slice(start, start + max);
    return { rows: win, before: start, after: Math.max(0, rows.length - start - win.length) };
  }

  /* ------------------------------------------------------------------ phán quyết */
  function outcome(verdict, message, extra) {
    var o = { verdict: verdict, label: VERDICTS[verdict].label, message: message || "", ms: 0, compileMs: 0, actual: "", stderr: "", diff: null, truncated: false };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  /** Kết quả chuẩn của CS.runner.run (compile/run/error) + đáp án → phán quyết của MỘT ca. */
  function judge(res, expected, mode) {
    if (!isObj(res)) return outcome("ERR", "Không nhận được kết quả chạy.");
    var c = isObj(res.compile) ? res.compile : null, r = isObj(res.run) ? res.run : {};
    var cms = c && c.ran ? (c.ms | 0) : 0;
    if (c && c.ran && !c.ok) return outcome("CE", c.timedOut ? "Biên dịch quá thời gian cho phép." : "Biên dịch thất bại.", { compileMs: cms, stderr: str(c.stderr) || str(c.stdout) });
    if (r.ran === false) return outcome("ERR", (res.error && res.error.message) || "Chương trình không chạy được.", { compileMs: cms });
    var base = { ms: r.ms | 0, compileMs: cms, actual: str(r.stdout), stderr: str(r.stderr), truncated: !!r.truncated };
    if (r.timedOut) return outcome("TLE", "Chạy quá thời gian cho phép.", base);
    if (r.ok === false) {
      var why = r.signal ? "Bị dừng bởi tín hiệu " + r.signal : "Chương trình kết thúc với mã thoát " + (r.code == null ? "?" : r.code);
      return outcome("RE", why + ".", base);
    }
    return rejudge(outcome("AC", "", base), expected, mode);
  }
  /** Chấm lại một kết quả AC/WA với đáp án hoặc cách so sánh mới — KHÔNG cần chạy lại chương trình (đầu ra thật đã giữ trong `actual`).
      Kết quả loại khác (CE, TLE, RE…) không phụ thuộc đáp án nên trả nguyên. Không sửa đối tượng đầu vào. */
  function rejudge(o, expected, mode) {
    if (!o || (o.verdict !== "AC" && o.verdict !== "WA")) return o;
    var d = compare(o.actual, expected, mode), n = {};
    Object.keys(o).forEach(function (k) { n[k] = o[k]; });
    n.verdict = d.ok ? "AC" : "WA"; n.label = VERDICTS[n.verdict].label;
    n.diff = d.ok ? null : d;
    n.message = d.ok ? "" : d.message + (o.truncated ? " (đầu ra bị cắt ở 1 MiB)" : "");
    return n;
  }
  /** Ca bị dừng bởi lỗi của lời gọi chạy (ném Error). `fatal`: các ca sau chắc chắn cũng hỏng, nên dừng cả bộ. */
  function judgeError(e) {
    var code = e && e.code ? String(e.code) : "";
    var msg = e && e.message ? String(e.message) : String(e);
    if (code === "cancelled") return outcome("SKIP", "Đã dừng.", { cancelled: true });       /* người dùng dừng: ca này chưa chấm xong, không phải lỗi */
    return outcome("ERR", msg, { code: code });
  }

  function summarize(results, cancelled) {
    var counts = { AC: 0, WA: 0, TLE: 0, RE: 0, CE: 0, ERR: 0, SKIP: 0 }, ms = 0, ran = 0;
    results.forEach(function (o) { if (!o) return; counts[o.verdict]++; if (o.verdict !== "SKIP") ran++; ms += o.ms || 0; });
    return { total: results.length, ran: ran, counts: counts, passed: counts.AC, allPassed: results.length > 0 && counts.AC === results.length, ms: ms, cancelled: !!cancelled };
  }

  /**
   * Chạy lần lượt các ca.
   *   runOne(case, index) → Promise<kết quả chuẩn> | {promise, cancel} (đúng hình dạng CS.runner.run trả về)
   *   opts = { mode, onStart(index, case), onCase(index, outcome) }
   * → {promise, cancel()}. promise resolve {results:[outcome], summary}; không bao giờ reject.
   * Dừng sớm khi: CE (mọi ca chung một chương trình), lỗi ERR (mạng/hạn mức/…: các ca sau chắc cũng hỏng) hoặc người dùng dừng
   * — các ca còn lại là SKIP kèm lý do.
   */
  function runAll(cases, runOne, opts) {
    opts = opts || {};
    cases = Array.isArray(cases) ? cases : [];
    var results = [], cancelled = false, cur = null, i = 0;
    function skipRest(reason) {
      for (; i < cases.length; i++) { results[i] = outcome("SKIP", reason); safe(opts.onCase, i, results[i]); }
    }
    function done() { return { results: results, summary: summarize(results, cancelled) }; }
    function step() {
      if (cancelled) { skipRest("Đã dừng."); return done(); }
      if (i >= cases.length) return done();
      var idx = i, c = cases[idx], h;
      safe(opts.onStart, idx, c);
      try { h = runOne(c, idx); } catch (e) { h = Promise.reject(e); }
      cur = h && typeof h.cancel === "function" ? h : null;
      var p = h && h.promise ? h.promise : h;
      return Promise.resolve(p).then(function (res) { return judge(res, c.expected, opts.mode); }, judgeError).then(function (out) {
        cur = null;
        results[idx] = out; i = idx + 1;
        safe(opts.onCase, idx, out);
        if (out.cancelled) { cancelled = true; skipRest("Đã dừng."); return done(); }
        if (out.verdict === "CE") { skipRest("Bỏ qua vì lỗi biên dịch."); return done(); }
        if (out.verdict === "ERR") { skipRest("Bỏ qua vì ca trước không chạy được."); return done(); }
        return step();
      });
    }
    var promise = Promise.resolve().then(step);
    return { promise: promise, cancel: function () { cancelled = true; if (cur) cur.cancel(); } };
  }

  CS.tests = {
    limits: LIMITS, modes: MODES, verdicts: VERDICTS, defaultMode: DEFAULT_MODE,
    normalize: normalize, normalizeMode: normalizeMode, createCase: createCase, newId: newId,
    compare: compare, diffRows: diffRows, judge: judge, rejudge: rejudge, judgeError: judgeError, summarize: summarize, runAll: runAll
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.tests;
})(typeof globalThis !== "undefined" ? globalThis : this);
