/* ui/statsview.js — THỐNG KÊ CÁ NHÂN (spec #15–18): tổng số đã giải, streak + mục tiêu ngày, từng loại (đã giải / trung bình / tốt nhất / bậc hiện tại + đề xuất),
   biểu đồ 14 ngày, lịch sử ván (lọc, chơi lại bằng seed, xoá, xuất CSV). Tính hoàn toàn từ lịch sử trên máy (core/stats.js, core/progress.js). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz, doc = root.document, NS = "http://www.w3.org/2000/svg";
  var PAGE = 40;

  function svgEl(tag, attrs, text) { var el = doc.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); }); if (text != null) el.textContent = text; return el; }

  /** Cột "số ván giải" cho n ngày gần nhất. */
  function dayChart(records, today, n, goal) {
    var per = P.stats.perDay(records), days = [], max = Math.max(goal, 1), i;
    for (i = n - 1; i >= 0; i--) { var d = P.util.addDays(today, -i); days.push({ d: d, c: per[d] || 0 }); max = Math.max(max, per[d] || 0); }
    var W = 560, H = 150, pad = 26, bw = (W - pad * 2) / n, s = svgEl("svg", { class: "chart", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Số ván đã giải mỗi ngày trong " + n + " ngày gần nhất: " + days.map(function (x) { return x.c; }).join(", ") });
    var base = H - 28, scale = (base - 12) / max;
    s.append(svgEl("line", { x1: pad, y1: base, x2: W - pad, y2: base, class: "ch-axis" }));
    s.append(svgEl("line", { x1: pad, y1: base - goal * scale, x2: W - pad, y2: base - goal * scale, class: "ch-goal" }));
    days.forEach(function (x, k) {
      var bh = x.c * scale, bx = pad + k * bw + 3;
      var r = svgEl("rect", { x: bx, y: base - bh, width: Math.max(2, bw - 6), height: bh, rx: 3, class: "ch-bar" + (x.c >= goal ? " ok" : "") }); r.append(svgEl("title", {}, Z.dayText(x.d) + ": " + x.c + " ván"));
      s.append(r);
      if (x.c) s.append(svgEl("text", { x: bx + (bw - 6) / 2, y: base - bh - 4, class: "ch-num", "text-anchor": "middle" }, String(x.c)));
      if (k % 2 === (n % 2 ? 0 : 1) || n <= 7) s.append(svgEl("text", { x: bx + (bw - 6) / 2, y: H - 10, class: "ch-lab", "text-anchor": "middle" }, x.d.slice(8) + "/" + x.d.slice(5, 7)));
    });
    return s;
  }

  function open(ctx, host) {
    var user = ctx.user, off = null, timer = 0, dead = false, f = { type: "", result: "", shown: PAGE };

    function typeRows(records, sum) {
      var rows = [];
      Z.types().forEach(function (d) {
        var b = sum.byType[d.id], rec = P.progress.recommend(records, d.id);
        var tiers = P.util.TIERS.map(function (t) { var tb = b && b.byTier[t.id]; return tb && tb.solved ? h("li", {}, h("b", { text: t.name }), h("span", { text: tb.solved + " ván · TB " + P.util.fmtTime(tb.avgMs) + " · tốt nhất " + P.util.fmtTime(tb.bestMs) })) : null; });
        rows.push(h("article", { class: "tcard" },
          h("div", { class: "tc-head" }, h("span", { class: "tc-ic", "aria-hidden": "true", text: d.icon }), h("div", {}, h("h3", { text: d.name }), h("small", { text: b ? b.solved + " đã giải" + (b.revealed ? " · " + b.revealed + " xem đáp án" : "") + (b.abandoned ? " · " + b.abandoned + " bỏ dở" : "") : "Chưa chơi" }))),
          b && b.solved ? h("div", { class: "stat-grid" }, Z.stat("Trung bình", P.util.fmtTime(b.avgMs)), Z.stat("Tốt nhất", P.util.fmtTime(b.bestMs)), Z.stat("Lỗi TB", String(b.avgMistakes)), Z.stat("Gợi ý TB", String(b.avgHints))) : null,
          h("p", { class: "tc-meta" }, h("b", { text: "Bậc hiện tại: " + Z.tierName(rec.current) }), h("span", { text: " — " + rec.reason })),
          b && b.solved ? h("ul", { class: "tier-rows" }, tiers) : null,
          h("div", { class: "btn-row" }, h("a", { class: "btn", href: "#/new/" + d.id, html: icon("play") + "<span>Chơi</span>" }))));
      });
      return h("div", { class: "type-grid" }, rows);
    }

    function history(records) {
      var list = records.slice().sort(function (a, b) { return (b.endedAt || 0) - (a.endedAt || 0); }).filter(function (r) { return (!f.type || r.type === f.type) && (!f.result || r.result === f.result); });
      var typeChips = Z.chips([{ id: "", label: "Mọi loại" }].concat(Z.types().map(function (d) { return { id: d.id, label: d.name }; })), f.type, function (id) { f.type = id; f.shown = PAGE; render(); }, "Lọc theo loại");
      var resChips = Z.chips([{ id: "", label: "Mọi kết quả" }, { id: "solved", label: "Đã giải" }, { id: "revealed", label: "Xem đáp án" }, { id: "abandoned", label: "Bỏ dở" }], f.result, function (id) { f.result = id; f.shown = PAGE; render(); }, "Lọc theo kết quả");
      var body = list.length ? h("div", { class: "hist" }, list.slice(0, f.shown).map(function (r) { return histRow(r); })) : Z.emptyNote(records.length ? "Không có ván nào khớp bộ lọc." : "Chưa có ván nào — chơi một ván để bắt đầu thống kê.");
      var more = list.length > f.shown ? h("button", { type: "button", class: "btn", text: "Xem thêm (" + (list.length - f.shown) + ")", on: { click: function () { f.shown += PAGE; render(); } } }) : null;
      return h("div", { class: "stack" }, typeChips, resChips, body, more);
    }
    function histRow(r) {
      var d = Z.typeDef(r.type), canReplay = r.seed != null || user.getPuzzle(r.puzzleId);
      return h("div", { class: "hrow r-" + r.result },
        h("span", { class: "rs-ic", "aria-hidden": "true", text: d ? d.icon : "?" }),
        h("div", { class: "hrow-main" }, h("b", { text: (d ? d.name : r.type) + (r.source === "daily" ? " · Daily" : "") }), h("small", { text: Z.dateTime(r.endedAt) + " · " + (Z.RESULT[r.result] || r.result) })),
        Z.tierBadge(r.tier, r.score),
        h("div", { class: "hrow-nums" }, h("span", { title: "Thời gian", text: P.util.fmtTime(r.time) }), h("span", { title: "Lỗi", text: "✗ " + r.mistakes }), h("span", { title: "Gợi ý", text: "💡 " + r.hints })),
        h("div", { class: "prow-act" },
          h("button", { type: "button", class: "icon-btn", "aria-label": "Chơi lại puzzle này", title: canReplay ? "Chơi lại puzzle này" : "Không còn dữ liệu puzzle", disabled: canReplay ? null : true, html: icon("restart"), on: { click: function () {
            var saved = user.getPuzzle(r.puzzleId);
            if (saved) ctx.startGame(saved.puzzle, { source: "library" });
            else ctx.go("#/new/" + r.type + "?" + new root.URLSearchParams({ size: r.sizeId || "", tier: r.tier === "custom" ? "" : r.tier, seed: String(r.seed), go: "1" }).toString());
          } } }),
          h("button", { type: "button", class: "icon-btn", "aria-label": "Xoá khỏi lịch sử", title: "Xoá khỏi lịch sử", html: icon("trash"), on: { click: function () { ctx.confirm("Xoá ván này khỏi lịch sử?", "Thống kê và streak sẽ được tính lại.", "Xoá", true).then(function (ok) { if (ok) user.removeRecord(r.id); }); } } })));
    }

    function render() {
      if (dead) return;
      var records = user.history(), today = ctx.today(), goal = user.settings().dailyGoal, sum = P.stats.summarize(records), st = P.stats.streak(records, today, goal);
      var top = h("div", { class: "stat-grid big" },
        Z.stat("Đã giải", String(sum.total.solved), sum.total.played + " ván đã chơi"), Z.stat("Chuỗi hiện tại", st.current + " ngày", "Kỷ lục " + st.best + " ngày"),
        Z.stat("Hôm nay", st.todayCount + "/" + goal, st.todayDone ? "Đã đạt mục tiêu ✓" : "Mục tiêu " + goal + " ván/ngày"), Z.stat("Thời gian TB", sum.total.solved ? P.util.fmtTime(sum.total.avgMs) : "—", sum.total.solved ? "Tốt nhất " + P.util.fmtTime(sum.total.bestMs) : ""));
      host.replaceChildren(h("div", { class: "page stats" },
        h("div", { class: "ph" }, h("div", {}, h("h1", { text: "Thống kê" }), h("p", { class: "ph-sub", text: "Chỉ nằm trên thiết bị này — không gửi đi đâu." })),
          h("div", { class: "ph-act" }, h("button", { type: "button", class: "btn", disabled: records.length ? null : true, html: icon("download") + "<span>Xuất CSV</span>", on: { click: function () { Z.download("lich-su-puzzle_" + P.util.dayKey().replace(/-/g, "") + ".csv", P.files.historyCsv(records), "text/csv;charset=utf-8"); } } }),
            h("a", { class: "btn", href: "#/settings", html: icon("settings") + "<span>Mục tiêu ngày</span>" }))),
        top,
        Z.section("14 ngày gần nhất", h("div", { class: "chart-box" }, dayChart(records, today, 14, goal), h("p", { class: "faint", text: "Đường nét đứt là mục tiêu " + goal + " ván/ngày; cột xanh là ngày đạt mục tiêu." }))),
        Z.section("Theo từng loại", typeRows(records, sum)),
        Z.section("Lịch sử ván", history(records))));
    }
    render();
    off = user.on(function (ev) { if (/^(history|settings|restore|wipe)$/.test(ev.type)) { clearTimeout(timer); timer = setTimeout(render, 60); } });
    return { destroy: function () { dead = true; clearTimeout(timer); if (off) off(); } };
  }

  U.statsview = { open: open, dayChart: dayChart };
})(typeof globalThis !== "undefined" ? globalThis : this);
