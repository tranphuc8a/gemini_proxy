/* tests.js (giao diện) — thẻ "Bộ test" của bảng dưới: soạn các ca (dữ liệu vào → đáp án), chạy một ca / cả bộ, xem phán quyết
   AC/WA/TLE/RE/CE kèm bảng so dòng. Logic thuần ở core/tests.js; ở đây chỉ là vỏ: dựng DOM, ghi vào meta.tests của mục đang mở,
   gọi CS.runner qua A.prepareRun/A.runOptions (cùng nơi chạy, cùng cài đặt với nút ▶ Chạy). Kết quả chỉ giữ trong bộ nhớ, không lưu. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h, A = CS.app, T = CS.tests, P = CS.project;
  var st = { itemId: null, results: {}, open: {}, curId: null, progress: null, msg: "", head: null, list: null, cards: {}, lastToast: 0 };

  function S() { return A.S; }
  function meta() { var it = S().item; return it ? (it.meta = it.meta || {}) : null; }
  function cases() { var m = meta(); return m && Array.isArray(m.tests) ? m.tests : []; }
  function mode() { var m = meta(); return T.normalizeMode(m && m.testMode); }
  function byId(id) { return cases().filter(function (c) { return c.id === id; })[0] || null; }
  /** Đáp án lấy từ đầu ra thật: bỏ dấu xuống dòng cuối (mọi cách so sánh đều bỏ qua nó, còn ô nhập thì gọn hơn). */
  function finalNewline(t) { return String(t || "").replace(/\r?\n$/, ""); }
  function attached(el) { return !!el && el.isConnected !== false && root.document.body.contains(el); }

  /* Đổi sang đoạn mã khác thì kết quả cũ không còn nghĩa. */
  function syncItem() {
    var it = S().item, id = it ? it.id : null;
    if (id !== st.itemId) { st.itemId = id; st.results = {}; st.open = {}; st.curId = null; st.progress = null; st.msg = ""; }
  }

  /* ------------------------------------------------------------------ lưu (có giữ chỗ cho dung lượng meta) */
  function used() { return P.pyJsonBytes(meta() || {}); }
  function over() { return used() > P.limits.store.metaBytes; }
  function toastFull() {
    var now = Date.now();
    if (now - st.lastToast < 2500) return;
    st.lastToast = now;
    U.toast("Bộ test đã đầy (" + U.fmtBytes(used()) + " / " + U.fmtBytes(P.limits.store.metaBytes) + " dành cho dữ liệu kèm theo mã). Rút ngắn dữ liệu hoặc xoá bớt ca.", "bad", 5000);
  }
  /** Ghi `value` vào `obj[key]`; nếu làm meta vượt hạn mức máy chủ thì trả lại giá trị cũ. → true nếu ghi được. */
  function commit(obj, key, value) {
    var old = obj[key]; obj[key] = value;
    if (over()) { obj[key] = old; toastFull(); return false; }
    A.markDirty(); paintHead();
    return true;
  }
  /** Thay cả danh sách ca (thêm/xoá/nhân đôi); hoàn lại nếu quá đầy. */
  function setCases(list) {
    var m = meta(), old = { tests: m.tests };
    if (list.length) m.tests = list; else delete m.tests;
    if (over()) { if (old.tests) m.tests = old.tests; else delete m.tests; toastFull(); return false; }
    A.markDirty();
    return true;
  }
  function setMode(v) {
    var m = meta();
    if (T.normalizeMode(v) === T.defaultMode) delete m.testMode; else m.testMode = T.normalizeMode(v);
    A.markDirty();
    cases().forEach(function (c) { rejudgeCase(c); });
    render(st.body); paintBadge();
  }
  function rejudgeCase(c) {
    var o = st.results[c.id];
    if (o) st.results[c.id] = T.rejudge(o, c.expected, mode());
  }

  /* ------------------------------------------------------------------ tóm tắt */
  function tally() {
    var list = cases(), got = list.map(function (c) { return st.results[c.id]; }).filter(Boolean);
    var s = T.summarize(got);
    s.cases = list.length;
    s.complete = got.length === list.length && list.length > 0;
    return s;
  }
  function paintBadge() {
    var b = U.$('.cs-ptab[data-ptab="tests"] .n.t'); if (!b) return;
    syncItem();
    var n = cases().length;
    if (!n) { b.hidden = true; return; }
    var s = tally(), ran = s.counts.AC + s.counts.WA + s.counts.TLE + s.counts.RE + s.counts.CE + s.counts.ERR;
    b.hidden = false;
    b.textContent = ran ? s.passed + "/" + n : String(n);
    b.className = "n t" + (ran ? (s.counts.AC === n ? " ok" : " bad") : " idle");
  }

  /* ------------------------------------------------------------------ vẽ */
  function render(b) {
    syncItem();
    if (!b) return;
    st.body = b; st.cards = {}; b.innerHTML = "";
    var it = S().item;
    if (!it) { b.appendChild(h("p", { class: "cs-runst", text: "Mở một đoạn mã/dự án trước." })); return; }
    st.head = buildHead();
    b.appendChild(st.head);
    var list = cases();
    if (!list.length) {
      b.appendChild(h("div", { class: "cs-tempty" }, [
        h("p", { text: "Chưa có test nào. Mỗi test gồm dữ liệu vào (stdin) và đáp án mong đợi; “Chạy tất cả” chạy chương trình với từng test rồi chấm Đúng / Sai / Quá giờ / Lỗi." }),
        h("p", { class: "cs-note", text: "Mẹo: nhập dữ liệu vào, bấm ▶ Chạy để xem kết quả, rồi bấm “Từ lần chạy gần nhất” để biến chính lần chạy đó thành một test." })
      ]));
    } else {
      st.list = h("div", { class: "cs-tcases", role: "list" });
      list.forEach(function (c, i) { var el = card(c, i); st.cards[c.id] = el; st.list.appendChild(el); });
      b.appendChild(st.list);
    }
    paintHead(); paintBadge();
  }

  /* Thanh nút của đầu thẻ dựng MỘT lần mỗi lần vẽ thẻ; paintHead chỉ đổi thuộc tính/chữ của nút và dựng lại dòng tóm tắt (chỉ có chữ).
     Thay nút giữa lúc nhấn xuống và thả ra thì trình duyệt (WebKit) không phát "click" — mà "■ Dừng" cần bấm được ngay giữa lúc chạy. */
  function buildHead() {
    var hd = h("div", { class: "cs-thead" }), r = {};
    var bar = h("div", { class: "cs-tbar" });
    r.run = h("button", { type: "button", class: "btn sm run", onclick: function () { runCases(null); } });
    r.stop = h("button", { type: "button", class: "btn sm stop", text: "■ Dừng", onclick: function () { A.cmd("stop"); } });
    r.add = h("button", { type: "button", class: "btn sm", text: "+ Thêm test", onclick: function () { add(); } });
    r.last = h("button", { type: "button", class: "btn sm", text: "+ Từ lần chạy gần nhất",
      title: "Tạo test từ dữ liệu vào và kết quả của lần ▶ Chạy gần nhất (kết quả đó thành đáp án)", onclick: function () { addFromLastRun(); } });
    r.mode = h("select", { class: "sel sm", "aria-label": "Cách so sánh đầu ra" });
    T.modes.forEach(function (x) { r.mode.appendChild(h("option", { value: x.id, text: "So sánh: " + x.label.toLowerCase() })); });
    r.mode.addEventListener("change", function () { setMode(r.mode.value); });
    r.more = h("button", { type: "button", class: "btn sm", text: "⋯", "aria-label": "Thêm", title: "Thêm", onclick: function (e) { moreMenu(e.currentTarget); } });
    [r.run, r.stop, r.add, r.last, r.mode, h("span", { class: "grow" }), r.more].forEach(function (x) { bar.appendChild(x); });
    r.sum = h("div", { class: "cs-tsum", "aria-live": "polite" });
    hd.appendChild(bar); hd.appendChild(r.sum);
    hd._r = r;
    return hd;
  }
  function paintHead() {
    var hd = st.head; if (!attached(hd) || !hd._r) return;
    var r = hd._r, n = cases().length, running = !!(S().running && S().running.batch), s = tally();
    r.run.hidden = running; r.stop.hidden = !running;
    r.run.textContent = "▶ Chạy tất cả" + (n ? " (" + n + ")" : ""); r.run.disabled = !n;
    r.last.disabled = !(S().lastResult && S().lastResult.run && S().lastResult.run.ran);
    if (r.mode.value !== mode()) r.mode.value = mode();
    r.mode.title = (T.modes.filter(function (x) { return x.id === mode(); })[0] || {}).hint || "";
    var sum = r.sum;
    sum.innerHTML = ""; st.msgEl = null;
    if (running && st.progress) {
      sum.appendChild(h("span", { class: "pill busy", text: "Đang chạy " + Math.min(st.progress.done + 1, st.progress.total) + "/" + st.progress.total }));
      st.msgEl = h("span", { text: st.msg });
      sum.appendChild(st.msgEl);
    } else if (s.total) {
      var bad = n - s.counts.AC;
      sum.appendChild(h("span", { class: "pill " + (s.complete && !bad ? "ok" : "bad"), text: s.passed + "/" + n + " đúng" }));
      var parts = [];
      ["WA", "TLE", "RE", "CE", "ERR"].forEach(function (k) { if (s.counts[k]) parts.push(s.counts[k] + " " + T.verdicts[k].label.toLowerCase()); });
      if (s.total < n) parts.push("mới chạy " + s.total + " ca");
      if (parts.length) sum.appendChild(h("span", { text: parts.join(" · ") }));
      if (s.ms) sum.appendChild(h("span", { text: "tổng " + s.ms + " ms" }));
    } else if (n) sum.appendChild(h("span", { text: n + " test — chưa chạy." }));
    if (n) {
      var pct = used() / P.limits.store.metaBytes;
      sum.appendChild(h("span", { class: "grow" }));
      sum.appendChild(h("span", { class: "cs-budget" + (pct > 0.85 ? " warn" : ""), text: "Dung lượng " + Math.round(pct * 100) + "%",
        title: "Bộ test nằm trong dữ liệu kèm theo mã (cùng chỗ với dữ liệu vào, tham số…), tối đa " + U.fmtBytes(P.limits.store.metaBytes) + "." }));
    }
  }

  function card(c, i) {
    var el = h("div", { class: "cs-tc", role: "listitem", "data-id": c.id });
    var open = !!st.open[c.id];
    var tg = h("button", { type: "button", class: "cs-tc-tg", "aria-expanded": String(open), "aria-label": "Mở/đóng " + c.name, text: open ? "▾" : "▸" });
    var pill = h("span", { class: "pill" });
    var name = h("input", { type: "text", class: "cs-tc-name", value: c.name, maxlength: T.limits.nameChars, spellcheck: "false", "aria-label": "Tên test " + (i + 1) });
    var ms = h("span", { class: "cs-tc-ms" });
    var run = h("button", { type: "button", class: "btn sm", text: "▶", title: "Chạy riêng test này", "aria-label": "Chạy test " + c.name });
    var dup = h("button", { type: "button", class: "btn sm", text: "⎘", title: "Nhân đôi", "aria-label": "Nhân đôi test " + c.name });
    var del = h("button", { type: "button", class: "btn sm danger", text: "✕", title: "Xoá test", "aria-label": "Xoá test " + c.name });
    var head = h("div", { class: "cs-tc-h" }, [tg, pill, name, ms, run, dup, del]);

    var inp = h("textarea", { class: "inp", spellcheck: "false", maxlength: T.limits.fieldChars, placeholder: "Dữ liệu vào (stdin) của test này…", "aria-label": "Dữ liệu vào của " + c.name });
    inp.value = c.input;
    var exp = h("textarea", { class: "inp", spellcheck: "false", maxlength: T.limits.fieldChars, placeholder: "Đáp án mong đợi (stdout)…", "aria-label": "Đáp án mong đợi của " + c.name });
    exp.value = c.expected;
    var io = h("div", { class: "cs-tc-io" }, [h("label", { class: "fld" }, [h("span", { text: "Dữ liệu vào" }), inp]), h("label", { class: "fld" }, [h("span", { text: "Đáp án mong đợi" }), exp])]);
    var res = h("div", { class: "cs-tc-res" });
    var body = h("div", { class: "cs-tc-b", hidden: open ? null : true }, [io, res]);
    el.appendChild(head); el.appendChild(body);
    el._r = { pill: pill, ms: ms, res: res, body: body, tg: tg, run: run };

    function toggle(force) {
      var on = force === undefined ? !st.open[c.id] : force;
      st.open[c.id] = on; body.hidden = !on; tg.setAttribute("aria-expanded", String(on)); tg.textContent = on ? "▾" : "▸";
    }
    tg.addEventListener("click", function () { toggle(); });
    name.addEventListener("input", function () { commit(c, "name", name.value.trim() || c.name); });
    name.addEventListener("blur", function () { if (!name.value.trim()) name.value = c.name; });
    name.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); toggle(true); inp.focus(); } });
    inp.addEventListener("input", function () {
      if (!commit(c, "input", inp.value)) { inp.value = c.input; return; }
      if (st.results[c.id]) { delete st.results[c.id]; paintCard(c.id); paintHead(); paintBadge(); }      /* dữ liệu vào đổi → kết quả cũ không còn đúng */
    });
    exp.addEventListener("input", function () {
      if (!commit(c, "expected", exp.value)) { exp.value = c.expected; return; }
      rejudgeCase(c); paintCard(c.id); paintHead(); paintBadge();                                          /* đáp án đổi → chấm lại ngay, khỏi chạy lại */
    });
    run.addEventListener("click", function () { runCases([c.id]); });
    dup.addEventListener("click", function () { duplicate(c.id); });
    del.addEventListener("click", function () { remove(c.id); });
    paintCard(c.id, el);
    return el;
  }

  /** Cập nhật phần hiển thị phán quyết của một thẻ (không dựng lại ô nhập, nên không mất con trỏ khi đang gõ). */
  function paintCard(id, elOpt) {
    var el = elOpt || st.cards[id]; if (!el || !el._r || !attached(el)) { if (!elOpt) return; }
    var r = el._r, c = byId(id), o = st.results[id];
    if (!c) return;
    var busy = st.curId === id;
    r.pill.className = "pill" + (busy ? " busy" : o ? " " + T.verdicts[o.verdict].cls : "");
    r.pill.textContent = busy ? "Đang chạy…" : o ? o.label : "Chưa chạy";
    r.pill.setAttribute("data-v", busy ? "BUSY" : o ? o.verdict : "NONE");
    r.ms.textContent = !busy && o && o.verdict !== "SKIP" && o.ms ? o.ms + " ms" : "";
    r.res.innerHTML = "";
    if (!busy && o) result(r.res, c, o);
  }

  function result(box, c, o) {
    if (o.verdict === "AC") { box.appendChild(h("p", { class: "cs-tc-ok", text: "✓ Đầu ra khớp đáp án" + (o.ms ? " — chạy " + o.ms + " ms" : "") + (o.compileMs ? ", biên dịch " + (o.compileMs >= 1000 ? (o.compileMs / 1000).toFixed(1).replace(".", ",") + " s" : o.compileMs + " ms") : "") + "." })); return; }
    if (o.verdict === "SKIP") { box.appendChild(h("p", { class: "cs-note", text: o.message })); return; }
    box.appendChild(h("p", { class: "cs-tc-bad", text: o.message || o.label }));
    if (o.verdict === "WA") {
      box.appendChild(diffTable(o, c));
      var acts = h("div", { class: "cs-tc-acts" });
      var canTake = o.actual.length <= T.limits.fieldChars && !o.truncated;
      acts.appendChild(h("button", { type: "button", class: "btn sm", text: "Dùng đầu ra này làm đáp án", disabled: canTake ? null : true,
        title: canTake ? "Ghi đầu ra thật của lần chạy này vào ô “Đáp án mong đợi” (hãy chắc là nó đúng!)" : "Đầu ra quá dài hoặc bị cắt — không ghi được",
        onclick: function () { takeOutput(c.id); } }));
      acts.appendChild(h("button", { type: "button", class: "btn sm", text: "Chép đầu ra", onclick: function () { U.copy(o.actual).then(function (ok) { U.toast(ok ? "Đã chép đầu ra" : "Không chép được", ok ? "ok" : "bad", 1500); }); } }));
      box.appendChild(acts);
    }
    if ((o.verdict === "RE" || o.verdict === "CE") && o.stderr) box.appendChild(h("pre", { class: "cs-tc-err", text: o.stderr.length > 3000 ? o.stderr.slice(0, 3000) + "\n…" : o.stderr }));
    if (o.verdict === "CE") box.appendChild(h("button", { type: "button", class: "btn sm", text: "Xem ở thẻ Vấn đề", onclick: function () { A.showPanel("problems"); } }));
    if (o.verdict === "RE" && o.actual) box.appendChild(h("details", { class: "cs-tc-det" }, [h("summary", { text: "Đầu ra trước khi lỗi" }), h("pre", { class: "cs-tc-err", text: o.actual.length > 3000 ? o.actual.slice(0, 3000) + "\n…" : o.actual })]));
    if (o.verdict === "TLE" && o.actual) box.appendChild(h("details", { class: "cs-tc-det" }, [h("summary", { text: "Đầu ra đã in được" }), h("pre", { class: "cs-tc-err", text: o.actual.length > 3000 ? o.actual.slice(0, 3000) + "\n…" : o.actual })]));
  }

  function diffTable(o, c) {
    var d = T.diffRows(o.actual, c.expected, mode()), t = h("table", { class: "cs-diff" });
    t.appendChild(h("thead", {}, [h("tr", {}, [h("th", { text: "Dòng" }), h("th", { text: "Mong đợi" }), h("th", { text: "Nhận được" })])]));
    var tb = h("tbody");
    function note(text) { tb.appendChild(h("tr", { class: "gap" }, [h("td", { colspan: "3", text: text })])); }
    if (d.before) note("… " + d.before + " dòng giống nhau ở trên");
    d.rows.forEach(function (r) {
      tb.appendChild(h("tr", { class: r.same ? "" : "x" }, [h("td", { class: "n", text: String(r.n) }),
        h("td", { class: r.expected === null ? "none" : "", text: r.expected === null ? "(không có dòng này)" : r.expected }),
        h("td", { class: r.actual === null ? "none" : "", text: r.actual === null ? "(không có dòng này)" : r.actual })]));
    });
    if (d.after) note("… còn " + d.after + " dòng nữa");
    t.appendChild(tb);
    return h("div", { class: "cs-diffwrap", tabindex: "0", role: "group", "aria-label": "So sánh đầu ra với đáp án" }, [t]);
  }

  /* ------------------------------------------------------------------ thao tác trên danh sách */
  function focusNew(id) {
    st.open[id] = true;
    render(st.body);
    var el = st.cards[id], ta = el && el.querySelector("textarea");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    if (ta) ta.focus();
  }
  function ensureTab() { if (S().settings.panelTab !== "tests" || !S().settings.panelOpen) A.showPanel("tests"); }
  function add(init) {
    if (!S().item) { U.toast("Mở một đoạn mã/dự án trước.", "bad"); return null; }
    var list = cases();
    if (list.length >= T.limits.cases) { U.toast("Tối đa " + T.limits.cases + " test cho mỗi đoạn mã/dự án.", "bad"); return null; }
    ensureTab();
    var c = T.createCase(list, init);
    if (!setCases(list.concat([c]))) return null;
    focusNew(c.id);
    return c;
  }
  function addFromLastRun() {
    var m = meta(), last = S().lastResult;
    if (!m || !last || !last.run || !last.run.ran) { U.toast("Chạy chương trình một lần trước đã.", "bad"); return; }
    var c = add({ input: S().lastStdin != null ? S().lastStdin : (m.stdin || ""), expected: finalNewline(last.run.stdout) });
    if (c && last.run.ok === false) U.toast("Lần chạy gần nhất có lỗi — kiểm tra lại đáp án.", "bad", 4000);
  }
  function duplicate(id) {
    var list = cases(), i = list.map(function (c) { return c.id; }).indexOf(id);
    if (i < 0) return;
    if (list.length >= T.limits.cases) { U.toast("Tối đa " + T.limits.cases + " test.", "bad"); return; }
    var c = list[i], copy = T.createCase(list, { name: (c.name + " (bản sao)").slice(0, T.limits.nameChars), input: c.input, expected: c.expected });
    var next = list.slice(); next.splice(i + 1, 0, copy);
    if (setCases(next)) focusNew(copy.id);
  }
  function remove(id) {
    var next = cases().filter(function (c) { return c.id !== id; });
    delete st.results[id]; delete st.open[id];
    setCases(next);
    render(st.body);
  }
  function takeOutput(id) {
    var c = byId(id), o = st.results[id];
    if (!c || !o || o.verdict !== "WA") return;
    var ta = st.cards[id] && st.cards[id].querySelectorAll("textarea")[1];
    if (!commit(c, "expected", finalNewline(o.actual))) return;
    if (ta) ta.value = c.expected;
    rejudgeCase(c); paintCard(id); paintHead(); paintBadge();
    U.toast("Đã ghi đầu ra làm đáp án", "ok", 1500);
  }
  function moreMenu(el) {
    var n = cases().length;
    U.menu(el, [
      { label: "Xoá kết quả (giữ test)", disabled: !Object.keys(st.results).length, onclick: function () { st.results = {}; render(st.body); } },
      { label: "Mở tất cả thẻ", disabled: !n, onclick: function () { cases().forEach(function (c) { st.open[c.id] = true; }); render(st.body); } },
      { label: "Thu gọn tất cả", disabled: !n, onclick: function () { st.open = {}; render(st.body); } },
      "-",
      { label: "Xoá toàn bộ test…", danger: true, disabled: !n, onclick: function () {
        U.confirm("Xoá toàn bộ test?", "Xoá " + n + " test của đoạn mã/dự án này. Không hoàn lại được.", "Xoá hết", true).then(function (ok) { if (ok) { st.results = {}; st.open = {}; setCases([]); render(st.body); } });
      } }
    ]);
  }

  /* ------------------------------------------------------------------ chạy */
  /** ids = null → tất cả. Chạy lần lượt; dùng chung nút Dừng và trạng thái "đang chạy" với ▶ Chạy. */
  function runCases(ids) {
    syncItem();
    if (!S().item) { U.toast("Mở một đoạn mã/dự án trước.", "bad"); return null; }
    if (S().running) { U.toast("Đang có một lần chạy — dừng nó (■) trước đã.", "bad", 2500); return null; }
    var list = cases().filter(function (c) { return !ids || ids.indexOf(c.id) >= 0; });
    if (!list.length) { U.toast("Chưa có test nào — bấm “+ Thêm test”.", "bad"); return null; }
    var p = A.prepareRun(); if (!p) return null;
    if (!p.req) { U.toast("HTML chỉ xem trước, không chấm test được.", "bad"); return null; }
    ensureTab();
    list.forEach(function (c) { delete st.results[c.id]; });
    st.progress = { done: 0, total: list.length }; st.msg = ""; st.curId = null;
    var lastRes = null, batch = null, itemId = S().item.id;
    function same() { return !!S().item && S().item.id === itemId; }                 /* đã chuyển sang mục khác giữa chừng: đừng ghi kết quả vào mục mới */
    var token = { batch: true, cancel: function () { if (batch) batch.cancel(); } };
    var end = A.beginBatch(token);
    render(st.body);
    function onProgress(ev) {
      if (!ev) return;
      var t = ev.type || "";
      if (t === "stdout" || t === "stderr") return;
      st.msg = ev.label || ev.message || "";
      if (t === "download" && ev.total) st.msg += " " + U.fmtBytes(ev.loaded || 0) + " / " + U.fmtBytes(ev.total);
      if (attached(st.msgEl)) st.msgEl.textContent = st.msg;
    }
    batch = T.runAll(list, function (c) {
      var hnd = CS.runner.run(Object.assign({}, p.req, { stdin: c.input }), A.runOptions(onProgress));
      return { cancel: hnd.cancel, promise: hnd.promise.then(function (res) { lastRes = res; return res; }) };
    }, {
      mode: mode(),
      onStart: function (i, c) { if (!same()) return; st.curId = c.id; paintCard(c.id); paintHead(); var el = st.cards[c.id]; if (el && el.scrollIntoView && list.length > 1) el.scrollIntoView({ block: "nearest" }); },
      onCase: function (i, o) {
        if (!same()) return;
        var c = list[i]; st.curId = null; st.results[c.id] = o; st.progress.done = i + 1;
        if (o.verdict !== "AC" && o.verdict !== "SKIP") st.open[c.id] = true;
        paintCard(c.id); if (st.cards[c.id] && st.open[c.id]) { var r = st.cards[c.id]._r; r.body.hidden = false; r.tg.textContent = "▾"; r.tg.setAttribute("aria-expanded", "true"); }
        paintHead(); paintBadge();
      }
    });
    return batch.promise.then(function (r) {
      end(); st.progress = null; st.curId = null; st.msg = "";
      if (lastRes && r.summary.counts.CE) A.setDiagnostics(lastRes.diagnostics || []);
      paintHead(); paintBadge();
      var s = r.summary;
      if (s.cancelled) U.toast("Đã dừng bộ test.", "", 1800);
      else if (s.counts.CE) U.toast("Lỗi biên dịch — xem thẻ “Vấn đề”.", "bad");
      else if (s.counts.ERR) U.toast("Không chạy được: " + (r.results.filter(function (o) { return o.verdict === "ERR"; })[0] || {}).message, "bad", 6000);
      else if (s.allPassed) U.toast("Đạt " + s.passed + "/" + s.total + " test", "ok", 2200);
      else U.toast(s.passed + "/" + s.total + " test đúng", "bad", 3500);
      return r;
    });
  }

  A.tests = { render: render, paintBadge: paintBadge, add: add, runAll: function () { return runCases(null); }, run: runCases };
})(window);
