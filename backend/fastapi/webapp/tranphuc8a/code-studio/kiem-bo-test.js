/* Kiểm "Bộ test" (core/tests.js): chuẩn hoá ca, 4 cách so sánh, bảng so dòng, phán quyết AC/WA/TLE/RE/CE/ERR, chạy lần lượt (dừng sớm, huỷ,
   không chạy chồng) — kể cả xuyên qua CS.runner thật với bộ chạy giả — và việc project.js giữ meta.tests/testMode.
   Được kiem.js nạp. Không gọi mạng, không chạy chương trình. */
"use strict";

const stage = (o) => Object.assign({ ran: true, ok: true, stdout: "", stderr: "", code: 0, signal: null, ms: 5, timedOut: false, truncated: false }, o || {});
const result = (run, compile) => ({ ok: true, provider: "t", language: "cpp", version: "", compile: compile || null, run: run === null ? stage({ ran: false, ok: false, code: null, ms: 0 }) : stage(run), error: null, warnings: [] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const C = (id, input, expected, name) => ({ id, name: name || id, input, expected });

module.exports = async function ({ nhom, kiem, bang, CS }) {
  const T = CS.tests, P = CS.project, R = CS.runner;
  if (!T) { nhom("bộ test"); kiem("có module tests", false); return; }

  /* ================================================================ chuẩn hoá */
  nhom("bộ test · chuẩn hoá ca");
  {
    const n = T.normalize([{ id: "abc123", name: "  Mẫu 1  ", input: "1 2\r\n", expected: "3\r\n" }, null, 5, "x", { name: "", input: 7, expected: null }, { id: "abc123", name: "trùng id" }]);
    kiem("bỏ phần tử không phải đối tượng; CRLF → LF; tên cắt khoảng trắng; kiểu lạ → chuỗi rỗng", n.length === 3 && n[0].name === "Mẫu 1" && n[0].input === "1 2\n" && n[0].expected === "3\n" && n[1].input === "" && n[1].expected === "", JSON.stringify(n));
    kiem("tên rỗng → “Test <số thứ tự>”", n[1].name === "Test 2");
    kiem("id trùng được cấp lại, id hợp lệ giữ nguyên, mọi id duy nhất", n[0].id === "abc123" && n[2].id !== "abc123" && new Set(n.map((c) => c.id)).size === 3 && n.every((c) => /^[a-z0-9]{4,12}$/.test(c.id)));
    kiem("lũy đẳng: chuẩn hoá hai lần = một lần", bang(T.normalize(n), n));
    kiem("đầu vào không phải mảng → []", bang(T.normalize(null), []) && bang(T.normalize("x"), []) && bang(T.normalize({}), []));
    const many = T.normalize(Array.from({ length: 45 }, (_, i) => C("id" + (1000 + i), "", "")));
    kiem("tối đa " + T.limits.cases + " ca", many.length === T.limits.cases);
    const big = T.normalize([{ id: "bigbig", name: "x".repeat(500), input: "a".repeat(40000), expected: "😀".repeat(20000) }])[0];
    kiem("tên ≤ 60 và mỗi trường ≤ 16 000 ký tự; không cắt đôi cặp thay thế", big.name.length === T.limits.nameChars && big.input.length === T.limits.fieldChars && !/[\ud800-\udbff]$/.test(big.expected) && big.expected.length <= T.limits.fieldChars);
    kiem("tên có ký tự điều khiển → dấu cách (không phá giao diện/JSON)", T.normalize([{ id: "ctrl01", name: "a\u0000b\nc" }])[0].name === "a b c");
    const c1 = T.createCase([]), c2 = T.createCase([c1]);
    kiem("createCase: tên “Test N+1”, id mới không trùng", c1.name === "Test 1" && c2.name === "Test 2" && c1.id !== c2.id && T.createCase([], { name: "Mẫu", input: "1\r\n", expected: "2" }).input === "1\n");
    kiem("chế độ so sánh: hợp lệ giữ, lạ → mặc định “lines”", T.normalizeMode("float") === "float" && T.normalizeMode("zzz") === "lines" && T.normalizeMode(undefined) === "lines" && T.defaultMode === "lines");
  }

  /* ================================================================ so sánh */
  nhom("bộ test · so sánh đầu ra");
  {
    const ok = (a, e, m) => T.compare(a, e, m).ok === true;
    kiem("lines: khoảng trắng cuối dòng và dòng trống cuối bị bỏ qua; CRLF = LF", ok("1 2 \t\r\n3\r\n\r\n\r\n", "1 2\n3", "lines") && ok("", "\n\n", "lines") && ok("a", "a\n", "lines"));
    kiem("lines: khoảng trắng ĐẦU dòng và dòng trống Ở GIỮA có nghĩa", !ok(" a", "a", "lines") && !ok("a\n\nb", "a\nb", "lines"));
    kiem("lines: phân biệt hoa/thường và thứ tự dòng", !ok("A", "a", "lines") && !ok("1\n2", "2\n1", "lines"));
    const d = T.compare("1\n41\n3", "1\n42\n3", "lines");
    kiem("lines: báo dòng khác đầu tiên (dòng 2, mong đợi 42, nhận 41) bằng tiếng Việt", !d.ok && d.kind === "diff" && d.unit === "line" && d.index === 2 && d.expected === "42" && d.actual === "41" && /Dòng 2 khác.*“42”.*“41”/.test(d.message), d.message);
    const mi = T.compare("1", "1\n2\n3", "lines"), ex = T.compare("1\n2\n3", "1", "lines");
    kiem("lines: thiếu dòng / thừa dòng được phân biệt", mi.kind === "missing" && mi.index === 2 && mi.expected === "2" && /^Thiếu dòng 2/.test(mi.message) && ex.kind === "extra" && ex.index === 2 && ex.actual === "2" && /^Thừa dòng 2/.test(ex.message), mi.message + " | " + ex.message);
    kiem("lines: đầu ra rỗng so với đáp án có nội dung → thiếu dòng 1", T.compare("", "5", "lines").kind === "missing" && T.compare("", "5", "lines").index === 1);
    kiem("thông báo cắt giá trị dài (≤ 80 ký tự + …)", T.compare("x".repeat(500), "y", "lines").message.length < 200);

    kiem("tokens: chỉ so từ — xuống dòng/dấu cách thừa/tab không quan trọng", ok("1  2\n\n3\t4 ", "1 2 3\n4", "tokens") && !ok("1 2 3", "1 2 4", "tokens") && !ok("12 3", "1 23", "tokens"));
    const td = T.compare("1 2 9", "1 2 3 4", "tokens");
    kiem("tokens: báo từ thứ 3 khác (không phải “dòng”)", !td.ok && td.unit === "token" && td.index === 3 && /^Từ thứ 3 khác/.test(td.message), td.message);
    kiem("tokens: thiếu từ / thừa từ", T.compare("1 2", "1 2 3", "tokens").kind === "missing" && /thiếu từ thứ 3/i.test(T.compare("1 2", "1 2 3", "tokens").message) && T.compare("1 2 3", "1 2", "tokens").kind === "extra");
    kiem("tokens: số thực KHÔNG được làm tròn (3.0 ≠ 3)", !ok("3.0", "3", "tokens"));

    kiem("float: lệch ≤ 1e-6 coi là bằng; 3.1 vs 3 thì không", ok("3.0000001", "3", "float") && ok("0.1234567", "0.1234568", "float") && !ok("3.1", "3", "float") && ok("2.50", "2.5", "float") && ok("1e-3", "0.001", "float"));
    kiem("float: số lớn dùng sai số tương đối", ok("1000000000.5", "1000000000", "float") && !ok("1000000000", "1000010000", "float"));
    kiem("float: từ không phải số phải giống hệt; nan/inf/hex không tính là số", ok("x 1.0", "x 1", "float") && !ok("abc 1", "abd 1", "float") && !ok("nan", "NaN", "float") && !ok("0x10", "16", "float") && !ok("inf", "1e999", "float"));
    kiem("float: dấu +/− và .5 / 5. hợp lệ", ok("+.5", "0.5", "float") && ok("5.", "5", "float") && !ok("-1", "1", "float"));

    kiem("exact: khoảng trắng cuối dòng CÓ nghĩa; chỉ bỏ MỘT dấu xuống dòng cuối", !ok("a \n", "a\n", "exact") && ok("a\n", "a", "exact") && !ok("a\n\n", "a", "exact") && ok("a\r\nb", "a\nb", "exact"));
    kiem("mặc định (mode không hợp lệ) là lines", ok("a  \n", "a", undefined) && ok("a  ", "a", "zzz"));
  }

  nhom("bộ test · bảng so từng dòng");
  {
    const a = T.diffRows("1\n2\nX\n4", "1\n2\n3\n4", "lines");
    kiem("đánh dấu đúng dòng khác, đủ số dòng, số thứ tự từ 1", a.rows.length === 4 && bang(a.rows.map((r) => r.same), [true, true, false, true]) && a.rows[2].n === 3 && a.rows[2].expected === "3" && a.rows[2].actual === "X" && a.before === 0 && a.after === 0, JSON.stringify(a));
    const b = T.diffRows("1", "1\n2", "lines");
    kiem("thiếu dòng: actual = null; thừa dòng: expected = null", b.rows[1].actual === null && b.rows[1].expected === "2" && !b.rows[1].same && T.diffRows("1\n2", "1", "lines").rows[1].expected === null);
    const big = Array.from({ length: 300 }, (_, i) => "d" + i), bad = big.slice(); bad[200] = "SAI";
    const w = T.diffRows(bad.join("\n"), big.join("\n"), "lines", 10);
    kiem("cửa sổ quanh chỗ khác đầu tiên (2 dòng trước), kèm số dòng bị ẩn", w.rows.length === 10 && w.rows[0].n === 199 && w.rows[2].same === false && w.rows[2].n === 201 && w.before === 198 && w.after === 300 - 198 - 10, JSON.stringify([w.before, w.after, w.rows[0].n]));
    kiem("chế độ từ/số thực: so từng dòng theo từ (dòng chỉ khác khoảng trắng/độ chính xác vẫn “giống”)", T.diffRows("1   2\n3.0000001", "1 2\n3", "float").rows.every((r) => r.same) && !T.diffRows("1 2\n3.1", "1 2\n3", "float").rows[1].same);
    kiem("dòng quá dài bị cắt để bảng không phình", T.diffRows("x".repeat(5000), "y", "lines").rows[0].actual.length <= T.limits.rowChars + 1);
    kiem("không có chỗ khác → toàn bộ “giống” (cửa sổ từ đầu)", T.diffRows("a\nb", "a\nb", "lines").rows.every((r) => r.same));
  }

  /* ================================================================ phán quyết */
  nhom("bộ test · phán quyết một ca");
  {
    const j = (run, exp, mode, compile) => T.judge(result(run, compile), exp == null ? "" : exp, mode || "lines");
    const ac = j({ stdout: "3\n", ms: 7 }, "3");
    kiem("AC: đúng đáp án; mang theo thời gian chạy và nhãn tiếng Việt", ac.verdict === "AC" && ac.label === "Đúng" && ac.ms === 7 && ac.actual === "3\n" && ac.diff === null);
    const wa = j({ stdout: "4\n" }, "3");
    kiem("WA: sai đáp án; giữ chi tiết so sánh để vẽ bảng", wa.verdict === "WA" && wa.diff && wa.diff.index === 1 && /mong đợi “3”, nhận “4”/.test(wa.message) && wa.actual === "4\n", wa.message);
    kiem("TLE: run.timedOut (dù có in gì)", j({ ok: false, timedOut: true, code: null, stdout: "3\n" }, "3").verdict === "TLE");
    const re = j({ ok: false, code: 139, stderr: "boom" }, "3");
    kiem("RE: mã thoát ≠ 0, nêu mã thoát và giữ stderr", re.verdict === "RE" && /mã thoát 139/.test(re.message) && re.stderr === "boom");
    kiem("RE: bị tín hiệu giết, nêu tên tín hiệu", /SIGSEGV/.test(j({ ok: false, code: null, signal: "SIGSEGV" }, "").message) && j({ ok: false, code: null, signal: "SIGSEGV" }, "").verdict === "RE");
    kiem("RE không so đáp án (đáp án đúng nhưng mã thoát 1 vẫn là RE)", j({ ok: false, code: 1, stdout: "3\n" }, "3").verdict === "RE");
    const ce = j({}, "3", "lines", stage({ ok: false, code: 1, stderr: "main.cpp:1: error: x", ms: 900 }));
    kiem("CE: biên dịch thất bại; giữ thông báo lỗi và thời gian biên dịch", ce.verdict === "CE" && /error: x/.test(ce.stderr) && ce.compileMs === 900 && ce.label === "Lỗi biên dịch");
    kiem("CE quá giờ", /quá thời gian/.test(j({}, "", "lines", stage({ ok: false, timedOut: true })).message) && j({}, "", "lines", stage({ ok: false, timedOut: true })).verdict === "CE");
    kiem("biên dịch xong rồi chạy: thời gian biên dịch được ghi nhận, vẫn chấm theo kết quả chạy", (() => { const o = j({ stdout: "1" }, "1", "lines", stage({ ms: 640 })); return o.verdict === "AC" && o.compileMs === 640; })());
    const er = T.judge(Object.assign(result(null), { ok: false, error: { code: "network", message: "Mất mạng" } }), "x");
    kiem("ERR: lần chạy không diễn ra (lỗi nơi chạy) — nêu lý do của nơi chạy", er.verdict === "ERR" && /Mất mạng/.test(er.message));
    kiem("ERR: kết quả không phải đối tượng", T.judge(null, "x").verdict === "ERR" && T.judge("x", "x").verdict === "ERR");
    kiem("đầu ra bị cắt ở 1 MiB mà sai → ghi chú trong thông báo; đúng thì vẫn AC", /1 MiB/.test(j({ stdout: "zz", truncated: true }, "a").message) && j({ stdout: "a", truncated: true }, "a").verdict === "AC");
    kiem("chế độ so sánh được truyền xuống (float cho phép lệch nhỏ, lines thì không)", j({ stdout: "3.0000001" }, "3", "float").verdict === "AC" && j({ stdout: "3.0000001" }, "3", "lines").verdict === "WA");
    const w2 = T.rejudge(wa, "4", "lines"), a2 = T.rejudge(ac, "9", "lines"), f2 = T.rejudge(wa, "4.0000001", "float");
    kiem("rejudge: sửa đáp án → WA thành AC (và ngược lại) không cần chạy lại; không sửa đối tượng cũ", w2.verdict === "AC" && w2.diff === null && w2.message === "" && w2.label === "Đúng" && wa.verdict === "WA" && a2.verdict === "WA" && /mong đợi “9”/.test(a2.message) && ac.verdict === "AC" && f2.verdict === "AC", w2.verdict + a2.verdict);
    kiem("rejudge: đổi cách so sánh; CE/TLE/RE/ERR giữ nguyên (không phụ thuộc đáp án)", T.rejudge(j({ stdout: "3.0000001" }, "3", "lines"), "3", "float").verdict === "AC" && [re, ce, er].every((o) => T.rejudge(o, "zzz", "lines") === o) && T.rejudge(null, "x") === null);
    kiem("judgeError: cancelled → SKIP đánh dấu cancelled (không phải lỗi); lỗi khác → ERR giữ mã", T.judgeError(Object.assign(new Error("Đã dừng chương trình."), { code: "cancelled" })).cancelled === true && T.judgeError(Object.assign(new Error("x"), { code: "cancelled" })).verdict === "SKIP" && T.judgeError(Object.assign(new Error("x"), { code: "run_rate_limited" })).code === "run_rate_limited" && T.judgeError("chuỗi").message === "chuỗi");
    const s = T.summarize([T.judge(result({ stdout: "1" }), "1"), T.judge(result({ stdout: "2" }), "1"), j({ ok: false, timedOut: true }, ""), { verdict: "SKIP", ms: 0 }]);
    kiem("summarize: đếm theo phán quyết, tổng thời gian, allPassed", s.total === 4 && s.counts.AC === 1 && s.counts.WA === 1 && s.counts.TLE === 1 && s.counts.SKIP === 1 && s.ran === 3 && s.passed === 1 && s.allPassed === false && s.ms === 15, JSON.stringify(s));
    kiem("summarize: tất cả AC → allPassed; danh sách rỗng → không", T.summarize([ac, ac]).allPassed === true && T.summarize([]).allPassed === false);
  }

  /* ================================================================ chạy lần lượt */
  nhom("bộ test · chạy lần lượt");
  {
    const cases = [C("t00001", "1", "1"), C("t00002", "2", "2"), C("t00003", "3", "9"), C("t00004", "4", "4")];
    let active = 0, maxActive = 0; const order = [], ev = [];
    const echo = async (c) => { active++; maxActive = Math.max(maxActive, active); order.push(c.id); await wait(3); active--; return result({ stdout: c.input + "\n" }); };
    const h = T.runAll(cases, echo, { mode: "lines", onStart: (i, c) => ev.push("s" + i), onCase: (i, o) => ev.push("c" + i + ":" + o.verdict) });
    const r = await h.promise;
    kiem("chạy đúng thứ tự, KHÔNG BAO GIỜ hai ca cùng lúc (máy chủ có hạn mức, trình duyệt có một worker)", bang(order, ["t00001", "t00002", "t00003", "t00004"]) && maxActive === 1, order.join() + " max=" + maxActive);
    kiem("onStart/onCase gọi xen kẽ đúng thứ tự", bang(ev, ["s0", "c0:AC", "s1", "c1:AC", "s2", "c2:WA", "s3", "c3:AC"]), ev.join());
    kiem("kết quả theo thứ tự ca; tóm tắt 3/4 đúng", r.results.map((o) => o.verdict).join() === "AC,AC,WA,AC" && r.summary.passed === 3 && r.summary.total === 4 && r.summary.allPassed === false && r.summary.cancelled === false);
    kiem("promise không bao giờ reject (lỗi nằm trong kết quả)", (await T.runAll(cases, () => { throw new Error("hỏng đồng bộ"); }, {}).promise).results[0].verdict === "ERR");
    kiem("danh sách ca rỗng / không phải mảng → tóm tắt rỗng, không gọi runOne", (await T.runAll([], () => { throw new Error("x"); }).promise).summary.total === 0 && (await T.runAll(null, () => { throw new Error("x"); }).promise).results.length === 0);

    const ce = await T.runAll(cases, async (c) => (c.id === "t00001" ? result({}, stage({ ok: false, code: 1, stderr: "lỗi cú pháp" })) : (() => { throw new Error("không được chạy tiếp sau CE"); })()), {}).promise;
    kiem("CE ở ca đầu: dừng cả bộ, các ca còn lại SKIP kèm lý do", ce.results[0].verdict === "CE" && ce.results.slice(1).every((o) => o.verdict === "SKIP" && /biên dịch/.test(o.message)) && ce.summary.counts.SKIP === 3, ce.results.map((o) => o.verdict).join());
    let calls = 0;
    const er = await T.runAll(cases, async (c) => { calls++; if (calls === 2) throw Object.assign(new Error("Hết hạn mức"), { code: "run_rate_limited" }); return result({ stdout: c.input }); }, {}).promise;
    kiem("lỗi nơi chạy (ERR) ở ca 2: dừng, ca sau SKIP; ca trước giữ nguyên kết quả", er.results.map((o) => o.verdict).join() === "AC,ERR,SKIP,SKIP" && calls === 2 && er.results[1].code === "run_rate_limited");
    const wr = await T.runAll(cases, async (c) => (c.id === "t00002" ? result({ ok: false, code: 1 }) : c.id === "t00003" ? result({ ok: false, timedOut: true, code: null }) : result({ stdout: c.input })), {}).promise;
    kiem("WA/RE/TLE KHÔNG dừng bộ test (chỉ CE và ERR mới dừng)", wr.results.map((o) => o.verdict).join() === "AC,RE,TLE,AC");

    /* huỷ giữa chừng: ca đang chạy bị huỷ qua handle của bộ chạy */
    const started = []; let cancelledCalls = 0;
    const slow = (c) => {
      started.push(c.id);
      let rej; const p = new Promise((_, r2) => { rej = r2; });
      return { promise: p, cancel: () => { cancelledCalls++; rej(Object.assign(new Error("Đã dừng chương trình."), { code: "cancelled" })); } };
    };
    const hc = T.runAll(cases, slow, { onStart: (i) => { if (i === 0) setTimeout(() => hc.cancel(), 5); } });
    const rc = await hc.promise;
    kiem("huỷ giữa chừng: ca đang chạy bị huỷ đúng một lần, ca sau không bao giờ bắt đầu, tóm tắt cancelled", cancelledCalls === 1 && started.length === 1 && rc.results[0].verdict === "SKIP" && rc.results[0].cancelled === true && rc.results.slice(1).every((o) => o.verdict === "SKIP") && rc.summary.cancelled === true, JSON.stringify(rc.results.map((o) => o.verdict)));
    const hd = T.runAll(cases, echo, { onCase: (i) => { if (i === 1) hd.cancel(); } });
    const rd = await hd.promise;
    kiem("huỷ giữa hai ca (khi không có ca nào đang chạy): ca kế tiếp không bắt đầu", rd.results.map((o) => o.verdict).join() === "AC,AC,SKIP,SKIP" && rd.summary.cancelled === true);
    kiem("huỷ khi runOne chỉ trả Promise (không có cancel): vẫn dừng ở ranh giới ca", await (async () => { const hp = T.runAll(cases, echo, { onStart: (i) => { if (i === 0) hp.cancel(); } }); const rp = await hp.promise; return rp.results[0].verdict === "AC" && rp.results.slice(1).every((o) => o.verdict === "SKIP"); })());
    kiem("hàm gọi lại của giao diện ném lỗi không làm hỏng lần chạy", (await T.runAll(cases.slice(0, 2), echo, { onStart: () => { throw new Error("ui"); }, onCase: () => { throw new Error("ui"); } }).promise).summary.passed === 2);
  }

  /* ================================================================ xuyên qua CS.runner thật */
  nhom("bộ test · qua CS.runner thật (bộ chạy giả đăng ký cho javascript)");
  if (R && R.registerExecutor) {
    const seen = [];
    R.registerExecutor("javascript", async (p) => {
      seen.push({ stdin: p.stdin, args: p.args.slice() });
      const sum = p.stdin.split(/\s+/).filter(Boolean).map(Number).reduce((a, b) => a + b, 0);
      if (p.stdin.indexOf("boom") >= 0) return { run: { ran: true, ok: false, stdout: "", stderr: "ReferenceError: x", code: 1, ms: 2 } };
      return { run: { ran: true, ok: true, stdout: sum + "\n", stderr: "", code: 0, ms: 4 } };
    });
    try {
      const cs = [C("r00001", "1 2\n", "3", "cộng"), C("r00002", "10 20\n", "31", "sai"), C("r00003", "boom", "x", "lỗi"), C("r00004", "5\n", "5\n", "xuống dòng")];
      const run = (c) => R.run({ target: "browser", language: "javascript", files: [{ name: "main.js", content: "x" }], stdin: c.input, args: ["--a"] });
      const rr = await T.runAll(cs, run, { mode: "lines" }).promise;
      kiem("mỗi ca nhận ĐÚNG stdin của nó (và tham số chung); kết quả AC/WA/RE/AC", bang(seen.map((s) => s.stdin), cs.map((c) => c.input)) && seen.every((s) => bang(s.args, ["--a"])) && rr.results.map((o) => o.verdict).join() === "AC,WA,RE,AC", rr.results.map((o) => o.verdict).join());
      kiem("thời gian chạy lấy từ bộ chạy; WA mang chi tiết (mong đợi 31, nhận 30)", rr.results[0].ms === 4 && rr.results[1].diff && rr.results[1].diff.expected === "31" && rr.results[1].diff.actual === "30" && /stderr|ReferenceError/.test(rr.results[2].stderr), JSON.stringify(rr.results[1].diff));
      const bad = await T.runAll(cs, (c) => R.run({ target: "browser", language: "javascript", files: [], stdin: c.input }), {}).promise;
      kiem("yêu cầu chạy hỏng (không có tệp): ERR ở ca đầu và dừng, không ném ra ngoài", bad.results[0].verdict === "ERR" && bad.results.slice(1).every((o) => o.verdict === "SKIP"));
      const hcancel = T.runAll(cs, (c) => R.run({ target: "browser", language: "javascript", files: [{ name: "main.js", content: "x" }], stdin: c.input }), { onStart: (i) => { if (i === 1) hcancel.cancel(); } });
      const rcan = await hcancel.promise;
      kiem("huỷ qua runner thật: tóm tắt cancelled, ca sau SKIP", rcan.summary.cancelled === true && rcan.results.slice(2).every((o) => o.verdict === "SKIP"), rcan.results.map((o) => o.verdict).join());
    } finally { R.unregisterExecutor("javascript"); }
  } else kiem("CS.runner có registerExecutor", false);

  /* ================================================================ project.js giữ meta.tests */
  nhom("bộ test · lưu trong meta của dự án");
  {
    const base = () => P.createSnippet({ id: "bt1", name: "Có test", language: "python", content: "print(1)" });
    const withTests = (extra) => P.normalize(Object.assign(base(), { meta: Object.assign({}, base().meta, extra) }));
    kiem("meta mặc định KHÔNG có tests/testMode (không đổi hình dạng meta cũ)", !("tests" in base().meta) && !("testMode" in base().meta));
    const q = withTests({ tests: [{ id: "abc123", name: "A", input: "1\r\n", expected: "2" }, "rác"], testMode: "float" });
    kiem("normalize giữ meta.tests đã chuẩn hoá (LF, bỏ phần tử rác) và testMode hợp lệ", q.meta.tests.length === 1 && q.meta.tests[0].input === "1\n" && q.meta.tests[0].id === "abc123" && q.meta.testMode === "float", JSON.stringify(q.meta));
    kiem("testMode mặc định (lines) hay lạ → bỏ khỏi meta; tests rỗng → không có khoá", !("testMode" in withTests({ testMode: "lines" }).meta) && !("testMode" in withTests({ testMode: "zzz" }).meta) && !("tests" in withTests({ tests: [] }).meta) && !("tests" in withTests({ tests: "x" }).meta));
    kiem("lũy đẳng cả với bộ test", bang(P.normalize(q), q));
    kiem("clone/setMeta mang bộ test đi cùng; validate sạch", bang(P.clone(q).meta.tests, q.meta.tests) && bang(P.setMeta(q, { stdin: "5" }).meta.tests, q.meta.tests) && P.validate(q).length === 0, JSON.stringify(P.validate(q)));
    const copy = P.duplicate ? P.duplicate(q, { id: "bt2" }) : null;
    kiem("nhân đôi đoạn mã giữ bộ test", !copy || (copy.meta.tests && copy.meta.tests.length === 1));

    const max = P.limits.store.metaBytes;
    const fat = Array.from({ length: 30 }, (_, i) => ({ id: "f" + String(10000 + i), name: "ca " + i, input: "x".repeat(700), expected: "y".repeat(700) }));
    const m = withTests({ tests: fat, stdin: "z".repeat(3000), openTabs: ["main.py"] });
    kiem("meta quá đầy: tổng ≤ giới hạn máy chủ; ca CUỐI bị bỏ trước, ca đầu còn nguyên", P.pyJsonBytes(m.meta) <= max && m.meta.tests.length < 30 && m.meta.tests.length > 0 && m.meta.tests[0].id === "f10000", P.pyJsonBytes(m.meta) + "/" + max + " ca=" + (m.meta.tests || []).length);
    kiem("… và stdin bị cắt trước khi đụng tới bộ test (tests là dữ liệu soạn tay)", m.meta.stdin.length < 3000 && m.meta.stdinTruncated === true || m.meta.tests.length === 30, "stdin=" + m.meta.stdin.length);

    const saved = CS.tests; delete CS.tests;
    try {
      const raw = [{ id: "keep01", name: "giữ", input: "1", expected: "1" }];
      const n = P.normalize(Object.assign(base(), { meta: Object.assign({}, base().meta, { tests: raw, testMode: "tokens" }) }));
      kiem("trang không nạp tests.js (IDE heuristic): bộ test và chế độ đi qua nguyên vẹn, không mất dữ liệu", bang(n.meta.tests, raw) && n.meta.testMode === "tokens");
    } finally { CS.tests = saved; }
  }
};
