/* ui/practice.js — Luyện tập: trang chung (#/practice), Flashcard (#/practice/cards), Quiz "nên dùng gì?" (#/practice/quiz).
   Thẻ = thẻ soạn tay của từng mục (cards) + thẻ tự sinh từ dữ liệu (độ phức tạp, khi nào dùng / không dùng, lỗi thường gặp). Lịch ôn SM-2 lưu theo id thẻ. */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, U = A.ui, h = U.h, icon = U.icon, C = A.catalog, lib = A.lib, SRS = A.srs;
  var NEW_PER_SESSION = 10;

  // ------------------------------------------------------------------------------------------------ thẻ
  /** Thẻ của một mục: [{id, q, a, auto}]. */
  function cardsOf(e) {
    var out = (e.cards || []).map(function (c, i) { return { id: e.id + "#" + i, q: c.q, a: c.a, algo: e.id }; });
    var cx = e.complexity || {};
    if (cx.time) out.push({ id: e.id + "#t", q: "Độ phức tạp của **" + e.name + "** là gì?", a: "Thời gian `" + cx.time + "`" + (cx.space ? ", bộ nhớ `" + cx.space + "`" : "") + (cx.note ? ". " + cx.note : ""), algo: e.id, auto: true });
    if ((e.use_case || [])[0]) out.push({ id: e.id + "#u", q: "Khi nào nên dùng **" + e.name + "**?", a: e.use_case.slice(0, 3).map(function (x) { return "- " + x; }).join("\n"), algo: e.id, auto: true });
    if ((e.not_for || [])[0]) out.push({ id: e.id + "#n", q: "Khi nào KHÔNG nên dùng **" + e.name + "**?", a: e.not_for.slice(0, 3).map(function (x) { return "- " + x; }).join("\n"), algo: e.id, auto: true });
    if ((e.pitfalls || [])[0]) out.push({ id: e.id + "#p", q: "Lỗi thường gặp khi dùng **" + e.name + "**?", a: e.pitfalls.slice(0, 3).map(function (x) { return "- " + x; }).join("\n"), algo: e.id, auto: true });
    return out;
  }
  function allCards(filter) { var out = []; C.all().forEach(function (e) { if (!filter || filter(e)) out = out.concat(cardsOf(e)); }); return out; }
  function dueCount(user) { var now = user.now(); return user.cards().filter(function (s) { return s.due <= now && C.get(s.id.split("#")[0]); }).length; }
  A.practice = { cardsOf: cardsOf, allCards: allCards, dueCount: dueCount };

  function md(s) { return U.detail.md(s); }

  /** Bộ thẻ cho một phiên: {due: [thẻ+state], fresh: [thẻ]} theo bộ lọc deck. */
  function queue(user, deck) {
    var now = user.now(), only = deck.ids ? new Set(deck.ids) : null;
    var filter = function (e) {
      if (only && !only.has(e.id)) return false;
      if (deck.cat && e.category !== deck.cat) return false;
      if (deck.bm && !user.isBookmarked(e.id)) return false;
      if (deck.learning && user.status(e.id) !== 1) return false;
      return true;
    };
    var cards = allCards(filter), due = [], fresh = [];
    cards.forEach(function (c) { var s = user.cardState(c.id); if (!s) fresh.push(c); else if (s.due <= now) due.push(Object.assign({}, c, { state: s })); });
    due.sort(function (a, b) { return a.state.due - b.state.due; });
    // thẻ mới: ưu tiên mục đang học / đã đánh dấu, rồi xáo
    fresh = A.quiz.shuffle(fresh, Math.random).sort(function (a, b) { var wa = (user.status(a.algo) === 1 ? 2 : 0) + (user.isBookmarked(a.algo) ? 1 : 0), wb = (user.status(b.algo) === 1 ? 2 : 0) + (user.isBookmarked(b.algo) ? 1 : 0); return wb - wa; });
    return { due: due, fresh: fresh, total: cards.length };
  }

  // ================================================================================================= Trang chung
  function hub(ctx, host) {
    var user = ctx.user, st = { destroyed: false }, el = h("div", { class: "page practice" });
    host.replaceChildren(el);
    function draw() {
      if (st.destroyed) return;
      var q = queue(user, {}), log = user.quizLog(), last = log[log.length - 1], weak = A.quiz.weakAreas(log);
      var weakList = Object.keys(weak).filter(function (k) { return weak[k] >= 0.34; }).sort(function (a, b) { return weak[b] - weak[a]; }).slice(0, 3).map(function (k) { return C.catName(k) + " (" + Math.round(weak[k] * 100) + "% sai)"; });
      el.replaceChildren(U.views.pageHead("Luyện tập", "Nhớ lâu bằng ôn ngắt quãng, rèn phản xạ chọn thuật toán, và xem thuật toán chạy từng bước."),
        h("div", { class: "cards3" },
          h("a", { class: "bigcard" + (q.due.length ? " due" : ""), href: "#/practice/cards" }, h("span", { class: "bc-ic", html: icon("cards") }), h("b", { text: "Flashcard" }), h("small", { text: q.due.length + " thẻ đến hạn · " + Math.min(NEW_PER_SESSION, q.fresh.length) + " thẻ mới" }), h("p", { text: "Hỏi–đáp ngắn về độ phức tạp, điều kiện, lỗi thường gặp. Lặp lại đúng lúc sắp quên." })),
          h("a", { class: "bigcard", href: "#/practice/quiz" }, h("span", { class: "bc-ic", html: icon("practice") }), h("b", { text: "Quiz: nên dùng gì?" }), h("small", { text: last ? "Lần gần nhất: " + last.score + "/" + last.total : lib.allScenarios().length + " tình huống" }), h("p", { text: "Đọc đề (N, thao tác, ràng buộc) rồi chọn thuật toán phù hợp." })),
          h("a", { class: "bigcard", href: "#/viz" }, h("span", { class: "bc-ic", html: icon("play") }), h("b", { text: "Trực quan hoá" }), h("small", { text: A.viz.list.length + " thuật toán chạy từng bước" }), h("p", { text: "Dijkstra, BFS, Fenwick, Segment Tree, KMP, knapsack… bấm Bước tiếp để hiểu." }))),
        weakList.length ? h("section", { class: "hs" }, h("h2", { text: "Nên ôn thêm" }), h("p", null, weakList.join(" · ")), h("a", { class: "btn", href: "#/practice/quiz?weak=1", text: "Quiz tập trung vào phần yếu" })) : null,
        log.length ? h("section", { class: "hs" }, h("h2", { text: "Lịch sử Quiz gần đây" }), h("ul", { class: "qlog" }, log.slice(-5).reverse().map(function (r) { return h("li", null, h("b", { text: r.score + "/" + r.total }), h("span", { class: "faint", text: " · " + T.fmtDateTime(r.at) })); }))) : null);
    }
    draw();
    var off = user.on(function (ev) { if (!st.destroyed && /^(card|quiz|mark|restore|wipe|item)$/.test(ev.type)) draw(); });
    return { destroy: function () { st.destroyed = true; off(); } };
  }

  // ================================================================================================= Flashcard
  function cards(ctx, host, q) {
    var user = ctx.user, st = { destroyed: false, deck: { cat: q.cat || "", bm: q.bm === "1", learning: q.learning === "1", ids: q.ids ? q.ids.split(",").filter(function (id) { return C.get(id); }) : null }, queue: [], i: 0, shown: false, reviewed: 0, again: 0, extra: 0 };
    var el = h("div", { class: "page review-page" }), onKey = null;
    host.replaceChildren(el);

    function deckBar() {
      var sel = h("select", { "aria-label": "Bộ thẻ" }, [["", "Tất cả thuật toán"], ["bm", "Đã đánh dấu"], ["learning", "Đang học"]].concat(C.categories().map(function (c) { return ["cat:" + c.id, c.name]; })).map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
      sel.value = st.deck.ids ? "" : st.deck.bm ? "bm" : st.deck.learning ? "learning" : st.deck.cat ? "cat:" + st.deck.cat : "";
      sel.addEventListener("change", function () { var v = sel.value; st.deck = { cat: v.indexOf("cat:") === 0 ? v.slice(4) : "", bm: v === "bm", learning: v === "learning", ids: null }; load(); });
      return h("div", { class: "deckbar" }, h("label", { text: "Bộ thẻ: " }), sel, st.deck.ids ? h("span", { class: "chip on", text: "chỉ " + st.deck.ids.length + " thuật toán đã chọn" }) : null);
    }
    function load(more) {
      var qq = queue(user, st.deck); if (!more) { st.reviewed = 0; st.again = 0; st.extra = 0; }
      st.queue = qq.due.concat(qq.fresh.slice(0, NEW_PER_SESSION + st.extra)); st.i = 0; st.shown = false; st.total = qq.total; st.dueN = qq.due.length; st.freshLeft = qq.fresh.length;
      draw();
    }
    function draw() {
      if (st.destroyed) return;
      var c = st.queue[st.i];
      if (!c) { done(); return; }
      var e = C.get(c.algo), pct = st.queue.length ? Math.round(100 * st.i / st.queue.length) : 0, cardSt = c.state || SRS.fresh(c.id, user.now());
      var qf = h("div", { class: "md fc-face", html: md(c.q) }), af = h("div", { class: "md fc-face fc-back", hidden: !st.shown, html: md(c.a) });
      var act = h("div", { class: "fc-actions" });
      if (!st.shown) act.append(h("button", { type: "button", class: "btn btn-primary big", html: "<span>Hiện đáp án</span> <kbd>Space</kbd>", on: { click: reveal } }));
      else { var pv = SRS.preview(cardSt, user.now()); SRS.GRADES.forEach(function (g, k) { act.append(h("button", { type: "button", class: "btn grade g" + k, dataset: { g: k }, on: { click: function () { rate(k); } } }, h("b", { text: g }), h("small", { text: pv[k] }), h("kbd", { text: String(k + 1) }))); }); }
      el.replaceChildren(U.views.pageHead("Flashcard", (st.queue.length - st.i) + " thẻ còn lại", h("a", { class: "btn btn-ghost", href: "#/practice", text: "Thoát" })), deckBar(),
        h("div", { class: "prog", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Tiến độ" }, h("span", { style: "width:" + pct + "%" })),
        h("article", { class: "fcard" }, h("p", { class: "fc-src" }, "Từ: ", e ? h("a", { href: "#/a/" + e.id, text: e.name }) : "(đã xoá)", c.state ? h("span", { class: "faint", text: " · ôn lần " + (c.state.reps + 1) }) : h("span", { class: "chip on", text: "mới" })), qf, af), act,
        h("p", { class: "faint kb", text: "Phím tắt: Space hiện đáp án · 1 Lại · 2 Khó · 3 Được · 4 Dễ" }));
    }
    function reveal() { st.shown = true; draw(); var b = el.querySelector(".fc-actions .g2"); if (b) b.focus(); }
    function rate(g) {
      var c = st.queue[st.i];
      user.review(c.id, g).then(function () {
        st.reviewed++; if (g === 0) { st.again++; st.queue.push(Object.assign({}, c, { state: null })); }      // "Lại": gặp lại ngay trong phiên
        st.i++; st.shown = false; draw();
      }, function (er) { ctx.toast("Không lưu được: " + er.message); });
    }
    function done() {
      var none = !st.reviewed;
      el.replaceChildren(U.views.pageHead("Flashcard", "Đã ôn " + st.reviewed + " thẻ" + (st.again ? " · " + st.again + " thẻ cần nhớ lại" : "")), deckBar(),
        h("div", { class: "done" }, h("p", { class: "big", text: none ? (st.total ? "Hôm nay không còn thẻ nào đến hạn ✓" : "Bộ thẻ này trống") : "Xong buổi ôn! 🎉" }),
          h("p", { text: none ? (st.total ? "Quay lại ngày mai, hoặc ôn thêm thẻ mới." : "Chọn bộ thẻ khác hoặc thêm kiến thức vào thư viện của bạn.") : "Thẻ bạn thấy khó sẽ quay lại sớm hơn; thẻ dễ giãn ra nhiều ngày." }),
          h("div", { class: "btn-row" }, st.freshLeft > st.extra + NEW_PER_SESSION ? h("button", { type: "button", class: "btn btn-primary", text: "Học thêm " + NEW_PER_SESSION + " thẻ mới", on: { click: function () { st.extra += NEW_PER_SESSION; load(true); } } }) : null, h("a", { class: "btn", href: "#/practice/quiz", text: "Làm Quiz" }), h("a", { class: "btn", href: "#/practice", text: "Về Luyện tập" }))));
    }
    onKey = function (e) {
      if (st.destroyed || U.isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
      if (!st.queue[st.i]) return;
      if (e.key === " " && !st.shown) { e.preventDefault(); reveal(); } else if (st.shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(+e.key - 1); }
    };
    document.addEventListener("keydown", onKey);
    load();
    return { destroy: function () { st.destroyed = true; document.removeEventListener("keydown", onKey); } };
  }

  // ================================================================================================= Quiz
  function quiz(ctx, host, q) {
    var user = ctx.user, st = { destroyed: false, qs: [], i: 0, answers: [], picked: null, opts: { n: 10, cats: [], types: ["scenario", "complexity", "summary"], weak: q.weak === "1" } };
    var el = h("div", { class: "page quiz" });
    host.replaceChildren(el);

    function setup() {
      var nSel = h("select", { "aria-label": "Số câu" }, [5, 10, 20].map(function (n) { return h("option", { value: n, text: n + " câu" }); })); nSel.value = String(st.opts.n);
      var catBox = h("div", { class: "chips" }, C.categories().filter(function (c) { return c.id !== "mine"; }).map(function (c) { return h("label", { class: "chip" + (st.opts.cats.indexOf(c.id) !== -1 ? " on" : "") }, h("input", { type: "checkbox", value: c.id, checked: st.opts.cats.indexOf(c.id) !== -1 ? true : null, class: "sr-only" }), h("span", { text: c.name })); }));
      var types = [["scenario", "Tình huống: nên dùng gì?"], ["complexity", "Độ phức tạp"], ["summary", "Nhận ra thuật toán từ mô tả"]];
      var typeBox = h("div", { class: "chips" }, types.map(function (t) { return h("label", { class: "chip" + (st.opts.types.indexOf(t[0]) !== -1 ? " on" : "") }, h("input", { type: "checkbox", value: t[0], checked: st.opts.types.indexOf(t[0]) !== -1 ? true : null, class: "sr-only" }), h("span", { text: t[1] })); }));
      var weak = h("label", { class: "switch-row" }, h("span", { class: "switch" }, h("input", { type: "checkbox", checked: st.opts.weak ? true : null }), h("span")), h("span", { text: " Ưu tiên nhóm tôi hay sai" }));
      [catBox, typeBox].forEach(function (b) { b.addEventListener("change", function (ev) { ev.target.parentNode.classList.toggle("on", ev.target.checked); }); });
      var go = h("button", { type: "button", class: "btn btn-primary big", html: icon("play") + "<span>Bắt đầu</span>" });
      go.addEventListener("click", function () {
        st.opts.n = +nSel.value; st.opts.cats = Array.from(catBox.querySelectorAll("input:checked")).map(function (x) { return x.value; }); st.opts.types = Array.from(typeBox.querySelectorAll("input:checked")).map(function (x) { return x.value; }); st.opts.weak = weak.querySelector("input").checked;
        if (!st.opts.types.length) { ctx.toast("Chọn ít nhất một loại câu hỏi."); return; }
        start();
      });
      el.replaceChildren(U.views.pageHead("Quiz", lib.allScenarios().length + " tình huống soạn sẵn + câu hỏi tự sinh từ dữ liệu. Chọn đáp án, xem giải thích ngay."), h("section", { class: "set" }, h("div", { class: "set-body" },
        h("div", { class: "set-row" }, h("div", null, h("label", { text: "Số câu" })), nSel), h("div", null, h("label", { text: "Nhóm (bỏ trống = tất cả)" }), catBox), h("div", null, h("label", { text: "Loại câu hỏi" }), typeBox), weak, h("div", { class: "btn-row" }, go))));
    }
    function start() {
      var weak = st.opts.weak ? A.quiz.weakAreas(user.quizLog()) : null;
      st.qs = A.quiz.make(C.all(), lib.allScenarios(), { n: st.opts.n, cats: st.opts.cats, types: st.opts.types, weak: weak });
      if (!st.qs.length) { ctx.toast("Không đủ dữ liệu để ra câu hỏi cho lựa chọn này — thử chọn thêm nhóm."); return; }
      st.i = 0; st.answers = []; st.picked = null; ask();
    }
    function ask() {
      if (st.destroyed) return;
      var qq = st.qs[st.i]; if (!qq) { finish(); return; }
      var answered = st.picked != null, g = answered ? A.quiz.grade(qq, st.picked) : null, pct = Math.round(100 * st.i / st.qs.length);
      var opts = h("div", { class: "qopts", role: "radiogroup", "aria-label": "Đáp án" }, qq.options.map(function (o, k) {
        var cls = "qopt", ok = qq.correct.indexOf(o.id) !== -1, soft = qq.ok.indexOf(o.id) !== -1;
        if (answered) cls += ok ? " right" : soft ? " soft" : o.id === st.picked ? " wrong" : " dim";
        var b = h("button", { type: "button", class: cls, role: "radio", "aria-checked": String(o.id === st.picked), disabled: answered ? true : null }, h("kbd", { text: String(k + 1) }), h("span", { text: o.label }));
        b.addEventListener("click", function () { pick(o.id); }); return b;
      }));
      var fb = answered ? h("div", { class: "qfb " + g }, h("b", { text: g === "right" ? "Đúng!" : g === "ok" ? "Chấp nhận được, nhưng chưa tối ưu" : "Chưa đúng" }), h("div", { class: "md", html: md(qq.why) }), (qq.ref || []).map(function (id) { var e = C.get(id); return e ? h("a", { class: "btn btn-ghost", href: "#/a/" + id, text: "Đọc: " + e.name }) : null; }), h("button", { type: "button", class: "btn btn-primary", html: "<span>" + (st.i + 1 < st.qs.length ? "Câu tiếp" : "Xem kết quả") + "</span> <kbd>Enter</kbd>", on: { click: function () { st.i++; st.picked = null; ask(); } } })) : null;
      el.replaceChildren(U.views.pageHead("Quiz", "Câu " + (st.i + 1) + "/" + st.qs.length, h("a", { class: "btn btn-ghost", href: "#/practice", text: "Thoát" })), h("div", { class: "prog", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Tiến độ" }, h("span", { style: "width:" + pct + "%" })),
        h("article", { class: "fcard qcard" }, h("p", { class: "fc-src" }, h("span", { class: "chip on", text: qq.type === "scenario" ? "Tình huống" : qq.type === "complexity" ? "Độ phức tạp" : "Nhận diện" }), " ", h("span", { class: "faint", text: C.catName(qq.cat) })), h("div", { class: "md qprompt", html: md(qq.prompt) }), opts), fb);
    }
    function pick(id) {
      var qq = st.qs[st.i]; if (st.picked != null) return;
      st.picked = id; var g = A.quiz.grade(qq, id); st.answers.push({ cat: qq.cat, r: g, ref: qq.ref[0], type: qq.type }); ask();
      var nb = el.querySelector(".qfb .btn-primary"); if (nb) nb.focus();
    }
    function finish() {
      var right = st.answers.filter(function (a) { return a.r === "right"; }).length, soft = st.answers.filter(function (a) { return a.r === "ok"; }).length, total = st.answers.length;
      user.logQuiz({ type: "mix", score: right, total: total, answers: st.answers });
      var per = {}; st.answers.forEach(function (a) { var p = per[a.cat] || (per[a.cat] = { n: 0, ok: 0 }); p.n++; if (a.r === "right") p.ok++; });
      var wrong = st.answers.filter(function (a) { return a.r === "wrong"; });
      el.replaceChildren(U.views.pageHead("Kết quả Quiz", ""), h("div", { class: "done" }, h("p", { class: "big", text: right + " / " + total + " đúng" + (soft ? " (+" + soft + " chấp nhận được)" : "") }),
        h("div", { class: "pbars" }, Object.keys(per).map(function (k) { var p = per[k], pct = Math.round(100 * p.ok / p.n); return h("div", { class: "pbar" }, h("span", { class: "pb-l", text: C.catName(k) }), h("span", { class: "pb-t" }, h("i", { style: "width:" + pct + "%" })), h("b", { text: p.ok + "/" + p.n })); })),
        wrong.length ? h("section", { class: "hs" }, h("h2", { text: "Nên đọc lại" }), h("div", { class: "mini-grid" }, A.catalog && Array.from(new Set(wrong.map(function (a) { return a.ref; }))).map(function (id) { return C.get(id) ? U.views.mini(C.get(id), "xem lại") : null; }).filter(Boolean))) : null,
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary", text: "Làm lại", on: { click: start } }), h("button", { type: "button", class: "btn", text: "Đổi lựa chọn", on: { click: setup } }), h("a", { class: "btn", href: "#/practice", text: "Về Luyện tập" }))));
    }
    var onKey = function (e) {
      if (st.destroyed || U.isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
      var qq = st.qs[st.i]; if (!qq) return;
      if (st.picked == null && /^[1-9]$/.test(e.key) && qq.options[+e.key - 1]) { e.preventDefault(); pick(qq.options[+e.key - 1].id); }
      else if (st.picked != null && e.key === "Enter" && !e.target.closest("button, a")) { e.preventDefault(); st.i++; st.picked = null; ask(); }
    };
    document.addEventListener("keydown", onKey);
    if (q.weak === "1") start(); else setup();
    return { destroy: function () { st.destroyed = true; document.removeEventListener("keydown", onKey); } };
  }

  U.practice = { hub: hub, cards: cards, quiz: quiz };
})(typeof globalThis !== "undefined" ? globalThis : this);
