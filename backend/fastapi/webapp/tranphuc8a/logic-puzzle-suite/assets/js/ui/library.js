/* ui/library.js — BỘ SƯU TẬP (spec #20): yêu thích ★, bộ sưu tập do người dùng tạo ("My Hard Problems", "Sudoku Training"…), puzzle tự tạo, nhập tệp.
   #/library            các tab: Yêu thích · Bộ sưu tập · Tự tạo · Tất cả
   #/library/<id bộ>    một bộ sưu tập
   Cũng xuất hộp thoại dùng chung: addToCollectionDialog(ctx, puzzle), exportDialog(ctx, puzzle), importDialog(ctx, onDone). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz;

  // ---------------------------------------------------------------------------------------------- hộp thoại dùng chung
  function addToCollectionDialog(ctx, puzzle) {
    var user = ctx.user, pid = puzzle.id || P.util.puzzleId(puzzle), dlg, list = h("div", { class: "stack" });
    function draw() {
      var cols = user.collections(), kids = [];
      if (!cols.length) kids.push(h("p", { class: "faint", text: "Chưa có bộ sưu tập nào — tạo bộ đầu tiên bên dưới." }));
      cols.forEach(function (c) {
        var inside = c.ids.indexOf(pid) >= 0;
        kids.push(h("button", { type: "button", class: "btn col-pick" + (inside ? " on" : ""), "aria-pressed": String(inside), on: { click: function () {
          (inside ? user.removeFromCollection(c.id, pid) : user.addToCollection(c.id, puzzle)).then(function () { ctx.toast(inside ? "Đã gỡ khỏi “" + c.name + "”." : "Đã thêm vào “" + c.name + "”."); draw(); }, function (e) { ctx.toast(e.message); });
        } } }, h("span", { html: icon(inside ? "check" : "folder") }), h("span", { text: c.name + " (" + c.ids.length + ")" })));
      });
      list.replaceChildren.apply(list, kids);
    }
    var nameIn = h("input", { type: "text", maxlength: "60", placeholder: "Tên bộ mới, ví dụ: Sudoku Training", "aria-label": "Tên bộ sưu tập mới" });
    var create = function () { var n = nameIn.value; user.createCollection(n).then(function (c) { nameIn.value = ""; return user.addToCollection(c.id, puzzle); }).then(function () { ctx.toast("Đã tạo bộ và thêm puzzle."); draw(); }, function (e) { ctx.toast(e.message); }); };
    nameIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); create(); } });
    draw();
    dlg = U.dialog("Thêm vào bộ sưu tập", [list, h("div", { class: "seed-row" }, nameIn, h("button", { type: "button", class: "btn", on: { click: create }, html: icon("plus") + "<span>Tạo bộ</span>" }))], [h("button", { type: "button", class: "btn", text: "Xong", on: { click: function () { dlg.close(); } } })]);
  }

  function exportDialog(ctx, puzzle) {
    var dlg, name = P.files.safeName(Z.puzzleTitle(puzzle)), def = Z.typeDef(puzzle.type);
    function b(label, ic, fn) { return h("button", { type: "button", class: "btn", on: { click: fn }, html: icon(ic) + "<span>" + label + "</span>" }); }
    var rows = [
      b("Chia sẻ tệp (điện thoại)", "share", function () { Z.sharePuzzle(puzzle, ctx.toast); }),
      b("Tải JSON (.json)", "download", function () { Z.download(name + ".json", P.files.exportJson([puzzle]), "application/json"); }),
      b("Tải văn bản (.txt)", "download", function () { Z.download(name + ".txt", P.files.exportText(puzzle), "text/plain;charset=utf-8"); }),
      b("Sao chép văn bản", "copy", function () { U.copyText(P.files.exportText(puzzle)).then(function (ok) { ctx.toast(ok ? "Đã sao chép — dán vào Nhập để mở lại." : "Không sao chép được."); }); })
    ];
    if (puzzle.seed != null) rows.push(b("Sao chép liên kết seed", "link", function () { U.copyText(Z.seedUrl(puzzle)).then(function (ok) { ctx.toast(ok ? "Đã sao chép liên kết — mở ra là cùng puzzle." : "Không sao chép được."); }); }));
    dlg = U.dialog("Xuất / chia sẻ", [h("p", { class: "faint", text: Z.puzzleTitle(puzzle) + " — " + (def ? def.name : puzzle.type) }), h("div", { class: "stack" }, rows),
      h("p", { class: "hint", text: "Tệp JSON mang đề + lời giải + độ khó; người nhận nhập lại, ứng dụng tự kiểm tra nghiệm chứ không tin dữ liệu trong tệp." })], [h("button", { type: "button", class: "btn", text: "Đóng", on: { click: function () { dlg.close(); } } })]);
  }

  function importDialog(ctx, onDone) {
    var user = ctx.user, dlg, ta = h("textarea", { rows: "7", placeholder: "Dán JSON hoặc văn bản puzzle vào đây (ví dụ 81 ký tự Sudoku 530070000…)", "aria-label": "Nội dung puzzle", spellcheck: "false" }), msg = h("div", { "aria-live": "polite" });
    function run(text) {
      var r = P.files.importText(text);
      msg.replaceChildren();
      r.errors.forEach(function (e) { msg.append(h("p", { class: "form-err", text: e })); });
      r.warnings.forEach(function (w) { msg.append(h("p", { class: "cr-warn", text: "⚠ " + w })); });
      if (!r.puzzles.length) return;
      var chain = Promise.resolve(), n = 0;
      r.puzzles.forEach(function (p) { chain = chain.then(function () { return user.savePuzzle(p, { source: "import" }).then(function () { n++; }); }); });
      chain.then(function () { ctx.toast("Đã nhập " + n + " puzzle."); if (dlg) dlg.close(); if (onDone) onDone(r.puzzles); else if (n === 1) ctx.go("#/library"); }, function (e) { msg.append(h("p", { class: "form-err", text: e.message })); });
    }
    var pick = h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Chọn tệp .json / .txt</span>", on: { click: function () {
      U.pickFiles(".json,.txt,application/json,text/plain", true).then(function (files) {
        if (!files.length) return;
        Promise.all(files.map(function (f) { return f.size > 20 * 1024 * 1024 ? Promise.resolve("") : f.text(); })).then(function (texts) { texts.forEach(function (t) { if (t) run(t); }); });
      });
    } } });
    dlg = U.dialog("Nhập puzzle", [h("div", { class: "btn-row" }, pick), h("p", { class: "faint", text: "hoặc dán nội dung:" }), ta, msg], [h("button", { type: "button", class: "btn", text: "Đóng", on: { click: function () { dlg.close(); } } }), h("button", { type: "button", class: "btn btn-primary", text: "Nhập", on: { click: function () { run(ta.value); } } })]);
  }

  // ---------------------------------------------------------------------------------------------- màn
  function puzzleRow(ctx, rec, opts) {
    var user = ctx.user, pz = rec.puzzle;
    var row = h("article", { class: "prow" },
      h("span", { class: "rs-ic", "aria-hidden": "true", text: (Z.typeDef(pz.type) || {}).icon || "?" }),
      h("div", { class: "prow-main" }, h("b", { text: Z.puzzleTitle(pz, rec) }), h("small", { text: (Z.typeDef(pz.type) ? Z.typeDef(pz.type).name : pz.type) + " · " + Z.sizeText(pz) + " · " + Z.ago(rec.updated) + (rec.source === "custom" ? " · tự tạo" : rec.source === "import" ? " · nhập" : "") })),
      Z.tierBadge(pz.tier, pz.score),
      h("div", { class: "prow-act" },
        h("button", { type: "button", class: "btn btn-primary", on: { click: function () { ctx.startGame(pz, { source: "library", ctx: opts && opts.colId ? { collectionId: opts.colId } : {} }); } }, html: icon("play") + "<span>Chơi</span>" }),
        h("button", { type: "button", class: "icon-btn fav-btn", "aria-label": rec.fav ? "Bỏ yêu thích" : "Yêu thích", "aria-pressed": String(!!rec.fav), html: icon("star"), on: { click: function () { user.savePuzzle(pz, { fav: !rec.fav }); } } }),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Thêm tuỳ chọn", "aria-haspopup": "menu", html: icon("more"), on: { click: function (e) {
          var items = [{ label: "Sửa bản sao", icon: "create", run: function () { ctx.go("#/create/" + pz.type + "?edit=" + encodeURIComponent(rec.id)); } },
            { label: "Thêm vào bộ sưu tập…", icon: "folder", run: function () { addToCollectionDialog(ctx, pz); } }, { label: "Xuất / chia sẻ…", icon: "share", run: function () { exportDialog(ctx, pz); } }];
          if (opts && opts.colId) items.push({ label: "Gỡ khỏi bộ này", icon: "x", run: function () { user.removeFromCollection(opts.colId, rec.id); } });
          items.push({ sep: true }, { label: "Xoá puzzle", icon: "trash", danger: true, run: function () { ctx.confirm("Xoá puzzle này?", "Puzzle sẽ bị xoá khỏi thư viện và mọi bộ sưu tập (lịch sử chơi vẫn còn).", "Xoá", true).then(function (ok) { if (ok) user.removePuzzle(rec.id); }); } });
          U.menu(e.currentTarget, items);
        } } })));
    return row;
  }

  function open(ctx, host, colId) {
    var user = ctx.user, off = null, timer = 0, dead = false, tab = "fav", shown = 60;

    function listOf(recs, opts) {
      if (!recs.length) return Z.emptyNote((opts && opts.empty) || "Chưa có puzzle nào.");
      var box = h("div", { class: "stack" }, h("div", { class: "prow-list" }, recs.slice(0, shown).map(function (r) { return puzzleRow(ctx, r, opts); })));   // phân trang: kho tới 20.000 puzzle không dựng một lúc
      if (recs.length > shown) box.append(h("button", { type: "button", class: "btn", text: "Xem thêm (" + (recs.length - shown) + ")", on: { click: function () { shown += 60; render(); } } }));
      return box;
    }
    function renderCollection(c) {
      var recs = c.ids.map(function (id) { return user.getPuzzle(id); }).filter(Boolean);
      var page = h("div", { class: "page" },
        h("div", { class: "ph" }, h("div", {}, h("h1", { text: c.name }), h("p", { class: "ph-sub", text: recs.length + " puzzle" })),
          h("div", { class: "ph-act" },
            recs.length ? h("button", { type: "button", class: "btn btn-primary", on: { click: function () { var r = recs[Math.floor(Math.random() * recs.length)]; ctx.startGame(r.puzzle, { source: "library", ctx: { collectionId: c.id } }); } }, html: icon("dice") + "<span>Chơi ngẫu nhiên</span>" }) : null,
            h("button", { type: "button", class: "btn", html: icon("pencil") + "<span>Đổi tên</span>", on: { click: function () { U.formBox("Đổi tên bộ sưu tập", [{ name: "n", label: "Tên", value: c.name, required: true, max: 60 }], "Lưu").then(function (v) { if (v) user.renameCollection(c.id, v.n).catch(function (e) { ctx.toast(e.message); }); }); } } }),
            h("button", { type: "button", class: "btn btn-danger", html: icon("trash") + "<span>Xoá bộ</span>", on: { click: function () { ctx.confirm("Xoá bộ “" + c.name + "”?", "Các puzzle đã ★ hoặc tự tạo vẫn được giữ.", "Xoá bộ", true).then(function (ok) { if (ok) user.deleteCollection(c.id).then(function () { ctx.go("#/library"); }); }); } } }))),
        listOf(recs, { colId: c.id, empty: "Bộ này còn trống — thêm puzzle từ bàn chơi (⋯ → Thêm vào bộ sưu tập) hoặc từ thư viện." }));
      host.replaceChildren(page);
    }
    function render() {
      if (dead) return;
      if (colId) { var c = user.getCollection(colId); if (!c) { host.replaceChildren(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Không có bộ sưu tập này" }), h("a", { class: "btn btn-primary", href: "#/library", text: "Về thư viện" }))); return; } renderCollection(c); return; }
      var all = user.puzzles(), body;
      if (tab === "fav") body = listOf(all.filter(function (r) { return r.fav; }), { empty: "Chưa có puzzle yêu thích — bấm ★ ở bàn chơi để lưu lại puzzle bạn thích." });
      else if (tab === "mine") body = listOf(all.filter(function (r) { return r.source === "custom"; }), { empty: "Chưa có puzzle tự tạo. Vào “Tạo puzzle” để nhập đề của riêng bạn." });
      else if (tab === "col") {
        var cols = user.collections();
        body = cols.length ? h("div", { class: "col-grid" }, cols.map(function (c) { return h("a", { class: "type-card pick", href: "#/library/" + encodeURIComponent(c.id) }, h("div", { class: "tc-head" }, h("span", { class: "tc-ic", "aria-hidden": "true", html: icon("folder") }), h("div", {}, h("h3", { text: c.name }), h("small", { text: c.ids.length + " puzzle" })))); })) : Z.emptyNote("Chưa có bộ sưu tập. Tạo bộ để gom puzzle theo chủ đề: “Sudoku Training”, “My Hard Problems”…");
      } else body = listOf(all, { empty: "Thư viện trống." });
      var tabs = Z.chips([{ id: "fav", label: "★ Yêu thích" }, { id: "col", label: "Bộ sưu tập (" + user.collections().length + ")" }, { id: "mine", label: "Tự tạo" }, { id: "all", label: "Tất cả (" + all.length + ")" }], tab, function (id) { tab = id; shown = 60; render(); }, "Bộ lọc thư viện");
      host.replaceChildren(h("div", { class: "page" },
        h("div", { class: "ph" }, h("div", {}, h("h1", { text: "Bộ sưu tập" }), h("p", { class: "ph-sub", text: "Puzzle bạn yêu thích, tự tạo hoặc gom theo chủ đề." })),
          h("div", { class: "ph-act" }, h("button", { type: "button", class: "btn", html: icon("plus") + "<span>Bộ mới</span>", on: { click: function () { U.formBox("Bộ sưu tập mới", [{ name: "n", label: "Tên", placeholder: "Ví dụ: My Hard Problems", required: true, max: 60 }], "Tạo").then(function (v) { if (v) user.createCollection(v.n).then(function (c) { ctx.go("#/library/" + encodeURIComponent(c.id)); }, function (e) { ctx.toast(e.message); }); }); } } }),
            h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Nhập tệp</span>", on: { click: function () { importDialog(ctx); } } }))),
        tabs, body));
    }
    render();
    off = user.on(function (ev) { if (/^(puzzle|collection|restore|wipe)$/.test(ev.type)) { clearTimeout(timer); timer = setTimeout(render, 60); } });
    return { destroy: function () { dead = true; clearTimeout(timer); if (off) off(); } };
  }

  U.library = { open: open, addToCollectionDialog: addToCollectionDialog, exportDialog: exportDialog, importDialog: importDialog };
})(typeof globalThis !== "undefined" ? globalThis : this);
