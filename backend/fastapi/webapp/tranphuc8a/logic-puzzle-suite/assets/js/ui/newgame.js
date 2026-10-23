/* ui/newgame.js — "Puzzle mới": chọn loại → cỡ, bậc, (tuỳ chọn của loại), seed → bắt đầu.
   #/new                       chọn loại
   #/new/<loại>?size=&tier=&seed=&o=&go=1   form; go=1 bắt đầu ngay (liên kết chia sẻ seed). Cùng (loại, cỡ, bậc, tuỳ chọn, seed) luôn ra CÙNG puzzle.
   o= là lựa chọn KHÁC mặc định của def.options dạng "id:lựa-chọn,…" (HUONG-DAN-ENGINE.md mục 11); vắng = mặc định (liên kết cũ không đổi nghĩa). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz;
  var KIND_NOTE = { interactive: "Puzzle tương tác: mỗi nước đi nhận phản hồi từ trò chơi (vd kết quả một lần cân); chỉ thắng khi kết luận được chứng minh từ các phản hồi.", optimize: "Puzzle tối ưu: không có đúng/sai — nộp kế hoạch và được chấm sao theo mức gần tối ưu." };

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
    var st = { size: P.types.sizeOf(def, q.size).id, tier: q.tier || "", seed: q.seed || "", options: P.types.optionsOf(def, q.o || null) };
    var sizeLabel = def.sizeLabel || "Cỡ bàn", sizeWord = def.sizeLabel ? def.sizeLabel.toLowerCase() : "cỡ";          // loại cũ giữ đúng chữ cũ
    function sizeDef() { return P.types.sizeOf(def, st.size); }
    function availTiers() { return sizeDef().tiers || P.util.TIERS.map(function (t) { return t.id; }); }
    if (!st.tier || availTiers().indexOf(st.tier) < 0) st.tier = P.daily.tierFor(sizeDef(), rec.recommended);

    function start() {
      var raw = st.seed.trim(), seed = raw ? P.rng.seedOf(raw) : P.rng.randomSeed();
      var spec = { type: def.id, seed: seed, sizeId: st.size, tier: st.tier, source: "random" };
      if (def.options) spec.options = P.types.compactOptions(def, st.options);
      return ctx.begin(spec);
    }
    /** Một hàng chip cho mỗi option của loại (chỉ loại có def.options). */
    function optionFields() {
      return (def.options || []).map(function (o) {
        var cur = st.options[o.id], picked = o.choices.filter(function (c) { return c.id === cur; })[0];
        return h("div", { class: "field ng-opt", dataset: { opt: o.id } }, h("label", { text: o.label }),
          Z.chips(o.choices.map(function (c) { return { id: c.id, label: c.label, title: c.note || "" }; }), cur, function (id) { st.options[o.id] = id; render(); }, o.label),
          picked && picked.note ? h("p", { class: "hint", text: picked.note }) : null);
      });
    }

    var body = h("div", { class: "page" });
    function render() {
      if (dead) return;
      var seedIn = h("input", { type: "text", id: "ng-seed", inputmode: "numeric", autocomplete: "off", placeholder: "Để trống = ngẫu nhiên", maxlength: "24", "aria-describedby": "ng-seed-hint" });
      seedIn.value = st.seed;
      seedIn.addEventListener("input", function () { st.seed = seedIn.value; });
      seedIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); start(); } });
      var tiers = P.util.TIERS.map(function (t) { return { id: t.id, label: t.name + (t.id === rec.recommended && rec.action !== "stay" ? " ★" : ""), disabled: availTiers().indexOf(t.id) < 0, title: availTiers().indexOf(t.id) < 0 ? sizeWord.charAt(0).toUpperCase() + sizeWord.slice(1) + " này không sinh được bậc " + t.name : t.id === rec.recommended ? rec.reason : "" }; });
      var rules = h("ul", { class: "rules" }, def.rules.map(function (r) { return h("li", { text: r }); }));
      var kind = P.types.kindOf(def), note = KIND_NOTE[kind] ? KIND_NOTE[kind] + (kind === "optimize" && def.objective ? " Tiêu chí: " + def.objective.label + "." : "") : "";
      body.replaceChildren(
        h("div", { class: "ph" }, h("div", {}, h("h1", {}, h("span", { class: "tc-ic", "aria-hidden": "true", text: def.icon }), h("span", { text: " " + def.name })), h("p", { class: "ph-sub", text: def.blurb }), note ? h("p", { class: "hint ng-kind", text: note }) : null), h("div", { class: "ph-act" }, h("a", { class: "btn btn-ghost", href: "#/learn/" + def.id, html: icon("learn") + "<span>Cách giải</span>" }))),
        h("div", { class: "set" },
          h("div", { class: "field" }, h("label", { text: sizeLabel }), Z.chips(def.sizes.map(function (s) { return { id: s.id, label: s.label }; }), st.size, function (id) { st.size = id; if (availTiers().indexOf(st.tier) < 0) st.tier = P.daily.tierFor(sizeDef(), st.tier); render(); }, sizeLabel)),
          optionFields(),
          h("div", { class: "field" }, h("label", { text: "Độ khó" }), Z.chips(tiers, st.tier, function (id) { st.tier = id; render(); }, "Độ khó"), h("p", { class: "hint", text: rec.reason + (rec.action !== "stay" ? " (bậc có ★ là bậc đề xuất)" : "") })),
          h("div", { class: "field" }, h("label", { for: "ng-seed", text: "Seed" }),
            h("div", { class: "seed-row" }, seedIn, h("button", { type: "button", class: "btn", "aria-label": "Seed ngẫu nhiên", title: "Seed ngẫu nhiên", html: icon("dice"), on: { click: function () { st.seed = String(P.rng.randomSeed()); seedIn.value = st.seed; } } })),
            h("p", { class: "hint", id: "ng-seed-hint", text: "Cùng loại + " + sizeWord + " + độ khó" + (def.options ? " + tuỳ chọn" : "") + " + seed luôn ra cùng một puzzle, trên mọi thiết bị. Nhập số, hoặc chữ bất kỳ (sẽ được băm thành số)." })),
          h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary btn-lg", on: { click: start }, html: icon("play") + "<span>Bắt đầu</span>" }))),
        h("details", { class: "rules-box" }, h("summary", { text: "Luật chơi" }), rules));
    }
    render(); host.replaceChildren(body);
    if (q.go === "1") setTimeout(function () { if (!dead) { ctx.go("#/new/" + def.id, true); start(); } }, 30);
    return { destroy: function () { dead = true; } };
  }

  U.newgame = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
