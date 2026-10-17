/* ui/newgame.js — "Puzzle mới": chọn loại → cỡ, bậc, seed → bắt đầu.
   #/new                       chọn loại
   #/new/<loại>?size=&tier=&seed=&go=1   form; go=1 bắt đầu ngay (liên kết chia sẻ seed). Cùng (loại, cỡ, bậc, seed) luôn ra CÙNG puzzle. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz;

  function open(ctx, host, typeId, q) {
    var user = ctx.user, def = typeId && P.types.get(typeId), dead = false;
    if (!def) {
      var grid = h("div", { class: "type-grid" }, Z.types().map(function (d) {
        return h("a", { class: "type-card pick", href: "#/new/" + d.id }, h("div", { class: "tc-head" }, h("span", { class: "tc-ic", "aria-hidden": "true", text: d.icon }), h("div", {}, h("h3", { text: d.name }), h("small", { text: d.category }))), h("p", { class: "tc-blurb", text: d.blurb }));
      }));
      host.replaceChildren(h("div", { class: "page" }, h("div", { class: "ph" }, h("div", {}, h("h1", { text: "Puzzle mới" }), h("p", { class: "ph-sub", text: "Chọn loại puzzle, rồi cỡ, độ khó và (nếu muốn) seed." }))), grid));
      return { destroy: function () { dead = true; } };
    }
    var rec = P.progress.recommend(user.history(), def.id);
    var st = { size: P.types.sizeOf(def, q.size).id, tier: q.tier || "", seed: q.seed || "" };
    function sizeDef() { return P.types.sizeOf(def, st.size); }
    function availTiers() { return sizeDef().tiers || P.util.TIERS.map(function (t) { return t.id; }); }
    if (!st.tier || availTiers().indexOf(st.tier) < 0) st.tier = P.daily.tierFor(sizeDef(), rec.recommended);

    function start() {
      var raw = st.seed.trim(), seed = raw ? P.rng.seedOf(raw) : P.rng.randomSeed();
      return ctx.begin({ type: def.id, seed: seed, sizeId: st.size, tier: st.tier, source: "random" });
    }

    var body = h("div", { class: "page" });
    function render() {
      if (dead) return;
      var seedIn = h("input", { type: "text", id: "ng-seed", inputmode: "numeric", autocomplete: "off", placeholder: "Để trống = ngẫu nhiên", maxlength: "24", "aria-describedby": "ng-seed-hint" });
      seedIn.value = st.seed;
      seedIn.addEventListener("input", function () { st.seed = seedIn.value; });
      seedIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); start(); } });
      var tiers = P.util.TIERS.map(function (t) { return { id: t.id, label: t.name + (t.id === rec.recommended && rec.action !== "stay" ? " ★" : ""), disabled: availTiers().indexOf(t.id) < 0, title: availTiers().indexOf(t.id) < 0 ? "Cỡ này không sinh được bậc " + t.name : t.id === rec.recommended ? rec.reason : "" }; });
      var rules = h("ul", { class: "rules" }, def.rules.map(function (r) { return h("li", { text: r }); }));
      body.replaceChildren(
        h("div", { class: "ph" }, h("div", {}, h("h1", {}, h("span", { class: "tc-ic", "aria-hidden": "true", text: def.icon }), h("span", { text: " " + def.name })), h("p", { class: "ph-sub", text: def.blurb })), h("div", { class: "ph-act" }, h("a", { class: "btn btn-ghost", href: "#/learn/" + def.id, html: icon("learn") + "<span>Cách giải</span>" }))),
        h("div", { class: "set" },
          h("div", { class: "field" }, h("label", { text: "Cỡ bàn" }), Z.chips(def.sizes.map(function (s) { return { id: s.id, label: s.label }; }), st.size, function (id) { st.size = id; if (availTiers().indexOf(st.tier) < 0) st.tier = P.daily.tierFor(sizeDef(), st.tier); render(); }, "Cỡ bàn")),
          h("div", { class: "field" }, h("label", { text: "Độ khó" }), Z.chips(tiers, st.tier, function (id) { st.tier = id; render(); }, "Độ khó"), h("p", { class: "hint", text: rec.reason + (rec.action !== "stay" ? " (bậc có ★ là bậc đề xuất)" : "") })),
          h("div", { class: "field" }, h("label", { for: "ng-seed", text: "Seed" }),
            h("div", { class: "seed-row" }, seedIn, h("button", { type: "button", class: "btn", "aria-label": "Seed ngẫu nhiên", title: "Seed ngẫu nhiên", html: icon("dice"), on: { click: function () { st.seed = String(P.rng.randomSeed()); seedIn.value = st.seed; } } })),
            h("p", { class: "hint", id: "ng-seed-hint", text: "Cùng loại + cỡ + độ khó + seed luôn ra cùng một puzzle, trên mọi thiết bị. Nhập số, hoặc chữ bất kỳ (sẽ được băm thành số)." })),
          h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary btn-lg", on: { click: start }, html: icon("play") + "<span>Bắt đầu</span>" }))),
        h("details", { class: "rules-box" }, h("summary", { text: "Luật chơi" }), rules));
    }
    render(); host.replaceChildren(body);
    if (q.go === "1") setTimeout(function () { if (!dead) { ctx.go("#/new/" + def.id, true); start(); } }, 30);
    return { destroy: function () { dead = true; } };
  }

  U.newgame = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
