/* ui/learn.js — phần HỌC: luật chơi, thuật toán dùng để giải (spec #26) kèm liên kết sang Algorithm Notebook, độ khó tính thế nào,
   và "xem bộ giải làm việc" trên một puzzle ví dụ: Constraint View (biến, miền, ràng buộc — spec #24) và Show Solver (cây tìm kiếm / các bước khử — spec #27).
   #/learn            chọn loại
   #/learn/<loại>     bài học của loại đó
   Dùng lại cho hộp thoại trong bàn chơi: U.learn.puzzleDialog(ctx, puzzle, "constraint" | "trace"). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz;
  var NOTEBOOK = "../algorithm-notebook/#/a/";
  var EXAMPLE_SEED = 20261017;

  /** Nội dung Constraint View của một puzzle. */
  function constraintBlock(cv) {
    var box = h("div", { class: "cv" });
    if (cv.summary) box.append(h("p", { class: "cv-sum", text: cv.summary }));
    var counts = cv.counts || {}, chips = h("div", { class: "chips" });
    Object.keys(counts).forEach(function (k) { chips.append(h("span", { class: "chip static" }, h("span", { text: k + ": " + counts[k] }))); });
    if (chips.children.length) box.append(chips);
    var vars = cv.variables || [], vt = h("table", { class: "cv-table" }, h("thead", {}, h("tr", {}, h("th", { text: "Biến" }), h("th", { text: "Miền giá trị" }))));
    var tb = h("tbody", {}); vars.slice(0, 60).forEach(function (v) { tb.append(h("tr", {}, h("td", { text: v.name + (v.count ? " (×" + v.count + ")" : "") }), h("td", { class: "mono", text: v.domain }))); });
    vt.append(tb);
    box.append(h("h3", { text: "Variables & Domains" }), h("div", { class: "cv-scroll" }, vt));
    if (vars.length > 60) box.append(h("p", { class: "faint", text: "… và " + (vars.length - 60) + " biến nữa." }));
    var cons = cv.constraints || [];
    box.append(h("h3", { text: "Constraints" }), h("ol", { class: "cv-cons" }, cons.slice(0, 80).map(function (c) { return h("li", { class: "mono", text: c }); })));
    if (cons.length > 80) box.append(h("p", { class: "faint", text: "… và " + (cons.length - 80) + " ràng buộc nữa." }));
    return box;
  }

  /** Lấy dữ liệu (qua worker) rồi dựng nội dung vào `into`. which: "constraint" | "trace". */
  function fill(ctx, puzzle, which, into) {
    into.replaceChildren(h("p", { class: "faint", text: "Đang tính…" }));
    var fn = which === "constraint" ? "constraintView" : "trace", args = which === "constraint" ? [puzzle] : [puzzle, { maxNodes: 600 }];
    return P.gen.call(puzzle.type, fn, args, { timeout: 20000 }).then(function (r) {
      into.replaceChildren(which === "constraint" ? constraintBlock(r) : U.treeview.render(r));
    }, function (e) { into.replaceChildren(h("p", { class: "form-err", text: "Không tính được: " + (e && e.message || e) })); });
  }

  function puzzleDialog(ctx, puzzle, which) {
    var title = (which === "constraint" ? "Constraint View — " : "Show Solver — ") + Z.puzzleTitle(puzzle), body = h("div", { class: "learn-dlg" });
    var d = U.dialog(title, [body], [h("button", { type: "button", class: "btn", text: "Đóng", on: { click: function () { d.close(); } } })], { wide: true });
    fill(ctx, puzzle, which, body);
  }

  function open(ctx, host, typeId) {
    var def = typeId && P.types.get(typeId), dead = false;
    if (!def) {
      var grid = h("div", { class: "type-grid" }, Z.types().map(function (d) {
        return h("a", { class: "type-card pick", href: "#/learn/" + d.id }, h("div", { class: "tc-head" }, h("span", { class: "tc-ic", "aria-hidden": "true", text: d.icon }), h("div", {}, h("h3", { text: d.name }), h("small", { text: d.category + " · " + d.family }))), h("p", { class: "tc-blurb", text: d.blurb }), h("p", { class: "tc-meta", text: d.algorithm.title }));
      }));
      host.replaceChildren(h("div", { class: "page" }, h("div", { class: "ph" }, h("div", {}, h("h1", { text: "Học cách giải" }), h("p", { class: "ph-sub", text: "Mỗi puzzle là một bài toán thuật toán thu nhỏ: luật chơi, cách máy giải, và vì sao gợi ý đúng." }))),
        grid, h("p", { class: "faint" }, h("span", { text: "Muốn đọc sâu hơn về từng thuật toán (độ phức tạp, mã mẫu C++, trực quan hoá)? Mở " }), h("a", { href: "../algorithm-notebook/", text: "Algorithm Notebook" }), h("span", { text: "." }))));
      return { destroy: function () { dead = true; } };
    }
    var a = def.algorithm, size = P.types.sizeOf(def, null), st = { size: size.id, tier: P.daily.tierFor(size, "medium") }, ex = h("div", { class: "learn-ex" }), exPuzzle = null, which = "constraint";
    var steps = h("ol", { class: "alg-steps" }, a.steps.map(function (s) { return h("li", {}, h("b", { text: s.title }), h("p", { text: s.text })); }));
    var links = null;
    if (a.links && a.links.length) {
      links = h("p", { class: "alg-links" }, h("span", { text: "Đọc thêm trong Algorithm Notebook: " }));
      a.links.forEach(function (l, i) { if (i) links.append(h("span", { text: " · " })); links.append(h("a", { href: NOTEBOOK + encodeURIComponent(l.id), text: l.label })); });
    }

    function exControls() {
      var sz = P.types.sizeOf(def, st.size), avail = sz.tiers || P.util.TIERS.map(function (t) { return t.id; });
      return h("div", { class: "stack" },
        Z.chips(def.sizes.map(function (s) { return { id: s.id, label: s.label }; }), st.size, function (id) { st.size = id; if ((P.types.sizeOf(def, id).tiers || avail).indexOf(st.tier) < 0) st.tier = P.daily.tierFor(P.types.sizeOf(def, id), st.tier); drawEx(); }, "Cỡ"),
        Z.chips(P.util.TIERS.map(function (t) { return { id: t.id, label: t.name, disabled: avail.indexOf(t.id) < 0 }; }), st.tier, function (id) { st.tier = id; drawEx(); }, "Độ khó"),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary", on: { click: gen }, html: icon("play") + "<span>Sinh puzzle ví dụ</span>" })));
    }
    function drawEx() {
      ex.replaceChildren(exControls());
      if (exPuzzle) {
        var out = h("div", { class: "learn-out" });
        ex.append(h("p", { class: "faint" }, h("span", { text: "Ví dụ: " }), Z.tierBadge(exPuzzle.tier, exPuzzle.score), h("span", { text: " seed " + exPuzzle.seed })),
          Z.chips([{ id: "constraint", label: "Constraint View" }, { id: "trace", label: "Show Solver" }], which, function (id) { which = id; drawEx(); }, "Chế độ xem"), out,
          h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", on: { click: function () { ctx.startGame(exPuzzle, { source: "random" }); } }, html: icon("play") + "<span>Chơi puzzle này</span>" })));
        fill(ctx, exPuzzle, which, out);
      }
    }
    function gen() {
      ctx.generate(def.id, EXAMPLE_SEED, { sizeId: st.size, tier: st.tier }).then(function (pz) { if (dead || !pz) return; exPuzzle = pz; drawEx(); });
    }
    host.replaceChildren(h("div", { class: "page learn" },
      h("div", { class: "ph" }, h("div", {}, h("h1", {}, h("span", { class: "tc-ic", "aria-hidden": "true", text: def.icon }), h("span", { text: " " + def.name })), h("p", { class: "ph-sub", text: def.category + " · " + def.family + " — " + def.blurb })),
        h("div", { class: "ph-act" }, h("a", { class: "btn btn-primary", href: "#/new/" + def.id, html: icon("play") + "<span>Chơi</span>" }), h("a", { class: "btn", href: "#/create/" + def.id, html: icon("create") + "<span>Tự tạo</span>" }))),
      Z.section("Luật chơi", h("ul", { class: "rules" }, def.rules.map(function (r) { return h("li", { text: r }); }))),
      Z.section("Cách giải: " + a.title, h("div", {}, steps, links)),
      Z.section("Độ khó được tính thế nào", h("p", { text: def.difficultyNote })),
      Z.section("Xem bộ giải làm việc", ex)));
    drawEx();
    return { destroy: function () { dead = true; } };
  }

  U.learn = { open: open, puzzleDialog: puzzleDialog, constraintBlock: constraintBlock };
})(typeof globalThis !== "undefined" ? globalThis : this);
