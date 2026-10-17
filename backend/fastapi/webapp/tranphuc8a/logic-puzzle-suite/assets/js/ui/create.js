/* ui/create.js — TẠO PUZZLE TỰ NHẬP (spec #21–23): trình soạn trực quan của từng loại (Puz.boards[loại].editor) + kiểm tra tức thì bằng engine (type.fromInput):
   hợp lệ không, có nghiệm duy nhất không (⚠ nhiều nghiệm — spec #13), độ khó bao nhiêu. Rồi: Chơi thử · Lưu vào thư viện · Xuất · Thêm vào bộ sưu tập.
   #/create                 chọn loại + nhập từ tệp/văn bản
   #/create/<loại>[?edit=<id puzzle đã lưu>]   trình soạn. Bản nháp tự lưu (sập máy không mất) ở kho `drafts` khoá "edit:<loại>". */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz;
  var STATUS = {
    unique: ["ok", "✓ Có đúng một nghiệm"], multiple: ["warn", "⚠ Puzzle có nhiều nghiệm"], none: ["bad", "✗ Vô nghiệm"]
  };

  function open(ctx, host, typeId, q) {
    var user = ctx.user, def = typeId && P.types.get(typeId), dead = false;
    if (!def) {
      var grid = h("div", { class: "type-grid" }, Z.types().map(function (d) {
        return h("a", { class: "type-card pick", href: "#/create/" + d.id }, h("div", { class: "tc-head" }, h("span", { class: "tc-ic", "aria-hidden": "true", text: d.icon }), h("div", {}, h("h3", { text: d.name }), h("small", { text: d.category }))),
          h("p", { class: "tc-blurb", text: d.blurb }));
      }));
      host.replaceChildren(h("div", { class: "page" }, h("div", { class: "ph" }, h("div", {}, h("h1", { text: "Tạo puzzle" }), h("p", { class: "ph-sub", text: "Tự nhập đề, được kiểm tra nghiệm duy nhất ngay khi bạn gõ; hoặc nhập từ tệp." })),
        h("div", { class: "ph-act" }, h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Nhập từ tệp / văn bản</span>", on: { click: function () { U.library.importDialog(ctx); } } }))), grid));
      return { destroy: function () { dead = true; } };
    }

    var board = P.boards[def.id], editorView = null, result = null, seq = 0, input = null, initial = null, draftKey = "edit:" + def.id, saved = q && q.edit ? user.getPuzzle(q.edit) : null;
    var ui = {}, status = h("div", { class: "cr-status", "aria-live": "polite" });
    var validateSoon = U.debounce(validate, 450), saveDraftSoon = U.debounce(function () { if (input != null) user.saveDraft(draftKey, { input: input, at: Date.now() }).catch(function () { }); }, 500);

    function validate() {
      if (dead) return; var my = ++seq;
      status.replaceChildren(h("p", { class: "faint", text: "Đang kiểm tra…" }));
      P.gen.call(def.id, "fromInput", [input], { timeout: 15000 }).then(function (r) { if (dead || my !== seq) return; result = r; drawStatus(); }, function (e) { if (dead || my !== seq) return; result = null; status.replaceChildren(h("p", { class: "form-err", text: "Không kiểm tra được: " + (e && e.message || e) })); setButtons(); });
    }
    function drawStatus() {
      var r = result, kids = [];
      if (!r) { setButtons(); return; }
      var st = STATUS[r.status];
      // "nhiều nghiệm" chỉ là CẢNH BÁO khi engine tự nêu cảnh báo (Sudoku, Nonogram, Logic Grid…); với loại mà nhiều nghiệm là bình thường (Lights Out) engine không thêm cảnh báo → báo trung tính.
      var benign = r.ok && r.status === "multiple" && !(r.warnings && r.warnings.length);
      if (benign) kids.push(h("p", { class: "cr-chip c-ok", text: "✓ Giải được — " + (r.count || "nhiều") + " cách giải (bình thường với loại này)" }));
      else if (st) kids.push(h("p", { class: "cr-chip c-" + st[0], text: st[1] + (r.status === "multiple" && r.count ? " (từ " + r.count + " nghiệm)" : "") }));
      if (r.ok && r.puzzle) kids.push(h("p", { class: "cr-diff" }, Z.tierBadge("custom", r.puzzle.score), h("span", { text: " Độ khó " + Z.scoreText(r.puzzle.score) + " (" + Z.tierName(P.util.tierOfScore(r.puzzle.score).id) + ")" })));
      (r.errors || []).forEach(function (e) { kids.push(h("p", { class: "form-err", text: e })); });
      (r.warnings || []).forEach(function (w) { kids.push(h("p", { class: "cr-warn", text: "⚠ " + w })); });
      if (r.ok && r.status === "multiple" && !benign) kids.push(h("p", { class: "hint", text: "Vẫn chơi và lưu được, nhưng lời giải và gợi ý chỉ dựa trên một trong các nghiệm. Thêm manh mối/ô cho sẵn để đề có nghiệm duy nhất." }));
      status.replaceChildren.apply(status, kids); setButtons();
    }
    function setButtons() { var ok = !!(result && result.ok && result.puzzle); [ui.play, ui.save, ui.share, ui.col].forEach(function (b) { if (b) b.disabled = !ok; }); }
    function puzzleNow() { return result && result.ok ? result.puzzle : null; }

    function mountEditor(puzzle) {
      if (editorView && editorView.destroy) editorView.destroy(); editorView = null; ui.editor.replaceChildren();
      if (!board || !board.editor) { ui.editor.append(h("div", { class: "main-empty" }, h("p", { class: "big", text: "Chưa có trình soạn cho " + def.name }), h("p", { class: "faint", text: "Bạn vẫn có thể nhập puzzle từ văn bản hoặc tệp." }), h("button", { type: "button", class: "btn", on: { click: function () { U.library.importDialog(ctx); } }, text: "Nhập từ văn bản / tệp" }))); return; }
      try {
        editorView = board.editor(ui.editor, { input: initial, puzzle: puzzle || null, U: U, ctx: ctx, type: def, onChange: function (inp) {
          input = inp; saveDraftSoon();
          result = null; seq++; setButtons();                       // kết quả cũ không còn đúng với đề đang sửa: bỏ ngay (không để "Chơi thử" chạy nhầm đề cũ)
          status.replaceChildren(h("p", { class: "faint", text: "Đang kiểm tra…" })); validateSoon();
        } });
        input = editorView.getInput ? editorView.getInput() : initial; validate();
      } catch (e) { ui.editor.append(h("p", { class: "form-err", text: "Lỗi khi mở trình soạn: " + (e && e.message || e) })); if (root.console) root.console.error(e); }
    }

    function nameThen(fn, label) {
      var p = puzzleNow(); if (!p) return;
      U.formBox(label || "Đặt tên puzzle", [{ name: "name", label: "Tên", value: (p.meta && p.meta.name) || "", placeholder: "Ví dụ: Sudoku của tôi #1", max: 80 }], "Lưu").then(function (v) { if (v) fn(Object.assign({}, p, { meta: Object.assign({}, p.meta, { name: v.name }) }), v.name); });
    }

    ui.editor = h("div", { class: "editor-host" });
    ui.play = h("button", { type: "button", class: "btn btn-primary", on: { click: function () { var p = puzzleNow(); if (p) ctx.startGame(p, { source: "custom" }); } }, html: icon("play") + "<span>Chơi thử</span>" });
    ui.save = h("button", { type: "button", class: "btn", on: { click: function () { nameThen(function (p, name) { user.savePuzzle(p, { name: name, source: "custom" }).then(function () { ctx.toast("Đã lưu vào Bộ sưu tập → Tự tạo."); user.dropDraft(draftKey); }, function (e) { ctx.toast(e.message); }); }); } }, html: icon("star") + "<span>Lưu vào thư viện</span>" });
    ui.share = h("button", { type: "button", class: "btn", on: { click: function () { var p = puzzleNow(); if (p) U.library.exportDialog(ctx, p); } }, html: icon("share") + "<span>Xuất / chia sẻ</span>" });
    ui.col = h("button", { type: "button", class: "btn", on: { click: function () { var p = puzzleNow(); if (p) U.library.addToCollectionDialog(ctx, p); } }, html: icon("folder") + "<span>Thêm vào bộ sưu tập</span>" });
    ui.imp = h("button", { type: "button", class: "btn btn-ghost", on: { click: function () { U.library.importDialog(ctx, function (puzzles) { var pz = puzzles.filter(function (p) { return p.type === def.id; })[0]; if (pz) { initial = null; mountEditor(pz); ctx.toast("Đã nạp puzzle vào trình soạn."); } }); } }, html: icon("upload") + "<span>Nhập</span>" });
    ui.reset = h("button", { type: "button", class: "btn btn-ghost", on: { click: function () { ctx.confirm("Bắt đầu lại?", "Trình soạn sẽ trống và bản nháp bị xoá.", "Bắt đầu lại", true).then(function (ok) { if (ok) { user.dropDraft(draftKey); initial = null; result = null; status.replaceChildren(); mountEditor(null); } }); } }, html: icon("restart") + "<span>Làm mới</span>" });

    host.replaceChildren(h("div", { class: "page create" },
      h("div", { class: "ph" }, h("div", {}, h("h1", {}, h("span", { class: "tc-ic", "aria-hidden": "true", text: def.icon }), h("span", { text: " Tạo " + def.name })), h("p", { class: "ph-sub", text: saved ? "Đang sửa bản sao của puzzle đã lưu." : "Soạn đề, xem trạng thái nghiệm ngay bên dưới, rồi chơi thử hoặc lưu lại." })),
        h("div", { class: "ph-act" }, ui.imp, ui.reset)),
      h("div", { class: "create-body" }, ui.editor, h("aside", { class: "create-side" }, h("h2", { text: "Kiểm tra đề" }), status, h("div", { class: "btn-row stack-sm" }, ui.play, ui.save, ui.col, ui.share)))));
    setButtons();

    user.getDraft(draftKey).then(function (d) {
      if (dead) return;
      if (!saved && d && d.value && d.value.input != null) { initial = d.value.input; ctx.toast("Đã khôi phục bản nháp chưa lưu.", { ms: 5000 }); }
      mountEditor(saved ? saved.puzzle : null);
    }, function () { if (!dead) mountEditor(saved ? saved.puzzle : null); });

    return { destroy: function () { dead = true; validateSoon.flush && validateSoon.flush(); if (input != null) user.saveDraft(draftKey, { input: input, at: Date.now() }).catch(function () { }); if (editorView && editorView.destroy) editorView.destroy(); } };
  }

  U.create = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
