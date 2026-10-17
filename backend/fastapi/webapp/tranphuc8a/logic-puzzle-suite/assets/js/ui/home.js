/* ui/home.js — màn "Chơi": Daily Puzzle, streak + mục tiêu ngày, ván đang chơi dở, và các loại puzzle (mỗi loại kèm bậc ĐỀ XUẤT theo lịch sử). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz;

  function open(ctx, host) {
    var user = ctx.user, off = null, timer = 0, dead = false;

    function dailyCard(today, records) {
      var spec = P.daily.forDay(today), card = h("section", { class: "daily-card" });
      if (!spec) { card.append(h("p", { class: "empty-note", text: "Chưa có loại puzzle nào." })); return card; }
      var def = Z.typeDef(spec.type), done = records.filter(function (r) { return r.source === "daily" && r.day === today && r.result === "solved"; })[0];
      var open = ctx.findGame(function (s) { return s.source === "daily" && s.ctx && s.ctx.day === today && s.status !== "solved" && s.status !== "revealed"; });
      var ti = P.util.tier(spec.tier);
      card.append(
        h("div", { class: "dc-main" },
          h("small", { class: "dc-day", text: "Daily Puzzle · " + Z.weekdayText(today) + ", " + Z.dayText(today) }),
          h("h2", {}, h("span", { class: "dc-ic", "aria-hidden": "true", text: def.icon }), h("span", { text: def.name })),
          h("p", { class: "dc-sub" }, h("span", { class: "tier t-" + spec.tier }, h("b", { text: ti.name })), h("span", { text: " · cỡ " + (def.sizes.filter(function (s) { return s.id === spec.sizeId; })[0] || def.sizes[0]).label + " · mọi thiết bị cùng ngày ra cùng puzzle" }))),
        h("div", { class: "dc-act" },
          done ? h("span", { class: "dc-done" }, h("span", { html: icon("check") }), h("span", { text: "Đã giải " + P.util.fmtTime(done.time) })) : null,
          h("button", { type: "button", class: "btn " + (done ? "" : "btn-primary"), on: { click: function () { ctx.openDaily(); } }, html: icon(open ? "play" : "new") + "<span>" + (open ? "Tiếp tục" : done ? "Chơi lại" : "Chơi ngay") + "</span>" })));
      return card;
    }

    function streakCard(records, today) {
      var goal = user.settings().dailyGoal, s = P.stats.streak(records, today, goal), pct = Math.min(100, Math.round(100 * s.todayCount / goal));
      return h("section", { class: "streak-card", "aria-label": "Chuỗi ngày luyện tập" },
        h("div", { class: "sc-num" }, h("span", { class: "sc-flame" + (s.current ? " on" : ""), html: icon("flame") }), h("b", { text: String(s.current) }), h("small", { text: s.current === 1 ? "ngày liên tiếp" : "ngày liên tiếp" })),
        h("div", { class: "sc-side" },
          h("p", {}, h("span", { text: "Kỷ lục " }), h("b", { text: s.best + " ngày" })),
          h("div", { class: "goal" }, h("div", { class: "goal-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(goal), "aria-valuenow": String(Math.min(goal, s.todayCount)), "aria-label": "Mục tiêu hôm nay" }, h("span", { style: "width:" + pct + "%" })),
            h("small", { text: s.todayDone ? "Đã đạt mục tiêu hôm nay ✓" : "Hôm nay " + s.todayCount + "/" + goal + " ván" }))));
    }

    function resumeList() {
      var list = user.games().filter(function (g) { return g.ser.status !== "solved" && g.ser.status !== "revealed"; }).slice(0, 4);
      if (!list.length) return null;
      var box = h("div", { class: "resume-list" });
      list.forEach(function (g) {
        var pz = g.ser.puzzle, c = g.ser.counters || {};
        box.append(h("div", { class: "resume" },
          h("a", { class: "resume-main", href: "#/play/" + encodeURIComponent(g.id) },
            h("span", { class: "rs-ic", "aria-hidden": "true", text: (Z.typeDef(pz.type) || {}).icon || "?" }),
            h("span", { class: "rs-t" }, h("b", { text: Z.puzzleTitle(pz) }), h("small", { text: P.util.fmtTime(g.ser.activeMs || 0) + " · " + (c.moves || 0) + " nước · " + Z.ago(g.updated) })),
            Z.tierBadge(pz.tier, pz.score)),
          h("button", { type: "button", class: "icon-btn", "aria-label": "Bỏ ván này", title: "Bỏ ván này", html: icon("trash"), on: { click: function () {
            ctx.confirm("Bỏ ván này?", "Ván sẽ được ghi vào lịch sử là “bỏ dở”.", "Bỏ ván", true).then(function (ok) { if (!ok) return; var gm = ctx.getGame(g.id); if (gm) user.finishGame(gm.record("abandoned")).then(function () { ctx.forget(g.id); }); }); } } })));
      });
      return Z.section("Tiếp tục chơi", box);
    }

    function typeCard(def, records) {
      var rec = P.progress.recommend(records, def.id), size = P.types.sizeOf(def, null), tier = P.daily.tierFor(size, rec.recommended);
      var solved = records.filter(function (r) { return r.type === def.id && r.result === "solved"; }).length;
      var arrow = rec.action === "up" ? " ↑" : rec.action === "down" ? " ↓" : "";
      return h("article", { class: "type-card" },
        h("div", { class: "tc-head" }, h("span", { class: "tc-ic", "aria-hidden": "true", text: def.icon }), h("div", {}, h("h3", { text: def.name }), h("small", { text: def.category + " · " + def.family }))),
        h("p", { class: "tc-blurb", text: def.blurb }),
        h("p", { class: "tc-meta" }, h("span", { title: rec.reason, text: "Đề xuất: " + Z.tierName(tier) + arrow }), h("span", { text: " · đã giải " + solved })),
        h("div", { class: "btn-row" },
          h("button", { type: "button", class: "btn btn-primary", on: { click: function () { ctx.begin({ type: def.id, seed: P.rng.randomSeed(), sizeId: size.id, tier: tier, source: "random" }); } }, html: icon("play") + "<span>Chơi " + T(Z.tierName(tier)) + "</span>" }),
          h("a", { class: "btn", href: "#/new/" + def.id, html: icon("grid") + "<span>Tuỳ chọn</span>" }),
          h("a", { class: "btn btn-ghost", href: "#/learn/" + def.id, html: icon("learn") + "<span>Học</span>" })));
    }
    function T(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

    function render() {
      if (dead) return;
      var records = user.history(), today = ctx.today();
      var page = h("div", { class: "page home" },
        h("div", { class: "ph" }, h("div", {}, h("h1", { text: "Phòng tập tư duy logic" }), h("p", { class: "ph-sub", text: "Chơi, nhận gợi ý có giải thích, hiểu chiến thuật — rồi tự tạo puzzle của riêng bạn." }))),
        h("div", { class: "home-top" }, dailyCard(today, records), streakCard(records, today)),
        resumeList(),
        Z.section("Chọn puzzle", h("div", { class: "type-grid" }, Z.types().map(function (d) { return typeCard(d, records); }))));
      host.replaceChildren(page);
    }
    render();
    off = user.on(function (ev) { if (/^(history|game|settings|restore|wipe)$/.test(ev.type)) { clearTimeout(timer); timer = setTimeout(render, 80); } });
    return { destroy: function () { dead = true; clearTimeout(timer); if (off) off(); } };
  }

  U.home = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
