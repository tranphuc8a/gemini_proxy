/* ui/boards/sudoku.js — bàn Sudoku 9×9: lưới 81 ô (chữ số lớn hoặc ghi chú 3×3), bàn số 1–9 có đếm số còn thiếu, chế độ Ghi chú, Xoá, Tự ghi ứng viên.
   Hành động gửi cho engine (assets/js/puzzles/sudoku.js): {k:"set", i, val} (val 0 = xoá) · {k:"cand", i, bit} · {k:"clearcand", i} · {k:"autocand"}.
   Bàn phím (khi focus trong lưới): mũi tên di chuyển · 1–9 điền · Shift+1–9 hoặc phím N bật Ghi chú · 0/Delete/Backspace xoá · A tự ghi ứng viên.
   Trạng thái GIAO DIỆN (ô đang chọn, chế độ ghi chú) nằm ở đây; mọi nội dung bàn đi qua game.act nên undo/redo, đếm lỗi, tự lưu chạy tự động. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var N = 81, DIGIT_CODE = /^(?:Digit|Numpad)([0-9])$/;

  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, ro = !!env.readOnly;
    var sel = -1, notes = false, marks = {}, cells = [], gridEl, padEl, digitBtns = [], noteBtn, offGame = null;
    var rowOf = function (i) { return Math.floor(i / 9); }, colOf = function (i) { return i % 9; }, boxOf = function (i) { return Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3); };

    // ---- dựng khung
    gridEl = h("div", { class: "pz-su-grid", role: "grid", "aria-label": "Lưới Sudoku 9 nhân 9", "aria-rowcount": "9", "aria-colcount": "9" });
    for (var i = 0; i < N; i++) {
      var cell = h("div", { class: "pz-su-cell", role: "gridcell", tabindex: "-1", "aria-colindex": String(colOf(i) + 1), dataset: { i: String(i) } });
      if (colOf(i) % 3 === 0 && colOf(i)) cell.classList.add("bl"); if (rowOf(i) % 3 === 0 && rowOf(i)) cell.classList.add("bt");
      cell.append(h("span", { class: "d" }), h("span", { class: "nt", "aria-hidden": "true" }));
      for (var d = 1; d <= 9; d++) cell.lastChild.append(h("i", { dataset: { d: String(d) } }));
      cells.push(cell); gridEl.append(cell);
    }
    var wrap = h("div", { class: "pz-su" }, gridEl);
    if (!ro) {
      var digits = h("div", { class: "pz-su-digits", role: "group", "aria-label": "Chọn chữ số" });
      for (var n = 1; n <= 9; n++) (function (n) {
        var b = h("button", { type: "button", class: "pz-su-num", "aria-label": "Chữ số " + n }, h("b", { text: String(n) }), h("small", { "aria-hidden": "true" }));
        b.addEventListener("click", function () { press(n); }); digitBtns[n] = b; digits.append(b);
      })(n);
      noteBtn = h("button", { type: "button", class: "btn pz-su-tool", "aria-pressed": "false", title: "Ghi chú (N)", html: icon("pencil") + "<span>Ghi chú</span>" });
      noteBtn.addEventListener("click", function () { notes = !notes; noteBtn.setAttribute("aria-pressed", String(notes)); wrap.classList.toggle("notes-on", notes); });
      var erase = h("button", { type: "button", class: "btn pz-su-tool", html: icon("eraser") + "<span>Xoá ô</span>", title: "Xoá ô (Delete)" });
      erase.addEventListener("click", function () { clearCell(); });
      var auto = h("button", { type: "button", class: "btn pz-su-tool", html: icon("grid") + "<span>Tự ghi ứng viên</span>", title: "Điền ghi chú cho mọi ô trống từ các số đã điền (A)" });
      auto.addEventListener("click", function () { act({ k: "autocand" }); });
      padEl = h("div", { class: "pz-su-pad" }, digits, h("div", { class: "pz-su-tools" }, noteBtn, erase, auto));
      wrap.append(padEl);
    }
    host.replaceChildren(wrap);

    // ---- thao tác
    function act(a) { var r = game.act(a); if (r.ok && r.mistakes) env.announce("Chữ số này không đúng với lời giải."); return r; }
    function editable(i) { return i >= 0 && !ro && !type.isGiven(puzzle, i); }
    function press(d) {
      if (sel < 0) { env.announce("Hãy chọn một ô trước."); return; }
      if (!editable(sel)) { env.announce("Ô cho sẵn không sửa được."); return; }
      var v = game.state.v[sel];
      if (notes) { if (v) { env.announce("Ô đã có số — xoá số trước khi ghi chú."); return; } act({ k: "cand", i: sel, bit: d }); }
      else { var r = act({ k: "set", i: sel, val: v === d ? 0 : d }); if (r.ok) env.announce(v === d ? "Đã xoá ô" : "Điền " + d + " vào " + short(sel)); }
    }
    function clearCell() {
      if (!editable(sel)) return;
      if (game.state.v[sel]) act({ k: "set", i: sel, val: 0 }); else act({ k: "clearcand", i: sel });
    }
    function short(i) { return "R" + (rowOf(i) + 1) + "C" + (colOf(i) + 1); }
    function select(i, focus) {
      sel = i; paint(); if (focus && cells[i]) cells[i].focus({ preventScroll: true });
      if (i >= 0) env.announce(type.describeCell(puzzle, game.state, i));
    }

    // ---- vẽ
    function paint() {
      var st = game.state, s = env.settings(), conflicts = {}, vs = st.v, cs = st.c, counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], i, d;
      if (s.showConflicts) { try { type.check(puzzle, st).conflicts.forEach(function (c) { conflicts[c] = 1; }); } catch (e) { /* bỏ qua */ } }
      var selV = sel >= 0 ? vs[sel] : 0;
      for (i = 0; i < N; i++) {
        var el = cells[i], v = vs[i], cls = "pz-su-cell" + (colOf(i) % 3 === 0 && colOf(i) ? " bl" : "") + (rowOf(i) % 3 === 0 && rowOf(i) ? " bt" : "");
        if (type.isGiven(puzzle, i)) cls += " given";
        if (i === sel) cls += " sel";
        else if (sel >= 0 && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel))) cls += " peer";
        if (s.highlightSame && selV && v === selV && i !== sel) cls += " same";
        if (conflicts[i]) cls += " conflict";
        if (marks[i]) cls += " " + marks[i];
        if (!v && cs && cs[i]) cls += " has-notes";
        if (el.className !== cls) el.className = cls;
        var dEl = el.firstChild; if (dEl.textContent !== (v ? String(v) : "")) dEl.textContent = v ? String(v) : "";
        if (v) counts[v]++;
        var ns = el.lastChild.children, mask = !v && cs ? cs[i] : 0;
        for (d = 1; d <= 9; d++) { var on = (mask >> d) & 1; if (ns[d - 1].className !== (on ? "on" : "")) ns[d - 1].className = on ? "on" : ""; var t = on ? String(d) : ""; if (ns[d - 1].textContent !== t) ns[d - 1].textContent = t; }
        var lab = type.describeCell(puzzle, st, i); if (el.getAttribute("aria-label") !== lab) el.setAttribute("aria-label", lab);
        el.setAttribute("aria-selected", String(i === sel)); el.setAttribute("tabindex", i === sel || (sel < 0 && i === firstFocusable()) ? "0" : "-1");
      }
      if (padEl) for (d = 1; d <= 9; d++) { var left = 9 - counts[d], b = digitBtns[d]; b.lastChild.textContent = left > 0 ? String(left) : "✓"; b.classList.toggle("done", left <= 0); b.setAttribute("aria-label", "Chữ số " + d + (left > 0 ? ", còn " + left : ", đã đủ")); }
    }
    function firstFocusable() { return 0; }

    // ---- sự kiện
    gridEl.addEventListener("click", function (e) { var c = e.target.closest(".pz-su-cell"); if (!c || ro && false) return; select(+c.dataset.i, true); });
    gridEl.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = e.target.closest(".pz-su-cell"); if (!c) return;
      var i = +c.dataset.i, m = DIGIT_CODE.exec(e.code || ""), nx = -1;
      if (e.key === "ArrowRight") nx = colOf(i) < 8 ? i + 1 : i; else if (e.key === "ArrowLeft") nx = colOf(i) > 0 ? i - 1 : i; else if (e.key === "ArrowDown") nx = rowOf(i) < 8 ? i + 9 : i; else if (e.key === "ArrowUp") nx = rowOf(i) > 0 ? i - 9 : i;
      if (nx >= 0) { e.preventDefault(); select(nx, true); return; }
      if (ro) return;
      if (m && m[1] !== "0") { e.preventDefault(); sel = i; var was = notes; if (e.shiftKey) notes = true; press(+m[1]); notes = was; return; }
      if (m || e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); sel = i; clearCell(); return; }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); noteBtn.click(); return; }
      if (e.key === "a" || e.key === "A") { e.preventDefault(); act({ k: "autocand" }); return; }
      if (e.key === "Escape") { select(-1); }
    });
    offGame = game.on(function (ev) { if (ev.type === "change" || ev.type === "status") paint(); });
    paint();

    return {
      destroy: function () { if (offGame) offGame(); host.replaceChildren(); },
      refresh: paint,
      highlight: function (list, kind) { marks = {}; if (list && kind) list.forEach(function (i) { marks[i] = kind; }); paint(); if (list && list.length && kind === "hint") { /* không đổi ô chọn: chỉ tô */ } },
      focus: function () { var t = cells[sel >= 0 ? sel : 0]; if (t) t.focus({ preventScroll: true }); }
    };
  }

  /** Trình soạn (màn Tạo puzzle): bấm ô rồi bấm số để nhập ô cho sẵn, hoặc dán 81 ký tự (0 hoặc . = trống). onChange({ v: [81 số] }) — đúng dạng type.fromInput nhận. */
  function editor(host, env) {
    var type = env.type, v = [], sel = 0, i, cells = [];
    var seedV = env.input && (Array.isArray(env.input.v) ? env.input.v : null) || (env.puzzle && env.puzzle.initial ? env.puzzle.initial.v : null);
    for (i = 0; i < N; i++) v.push(seedV && seedV[i] >= 0 && seedV[i] <= 9 ? seedV[i] | 0 : 0);
    var gridEl = h("div", { class: "pz-su-grid", role: "grid", "aria-label": "Lưới Sudoku đang soạn" });
    for (i = 0; i < N; i++) { var c = h("div", { class: "pz-su-cell", role: "gridcell", tabindex: "-1", dataset: { i: String(i) } }, h("span", { class: "d" })); cells.push(c); gridEl.append(c); }
    var rowOf = function (k) { return Math.floor(k / 9); }, colOf = function (k) { return k % 9; };
    var paste = h("textarea", { rows: "3", placeholder: "Dán 81 ký tự, ví dụ 530070000600195000098000060…", "aria-label": "Dán chuỗi 81 ký tự", spellcheck: "false" });
    var info = h("p", { class: "faint", "aria-live": "polite" });
    function emit() { env.onChange({ v: v.slice() }); }
    function paint() {
      var given = 0;
      for (var k = 0; k < N; k++) {
        var el = cells[k], cls = "pz-su-cell" + (v[k] ? " given" : "") + (colOf(k) % 3 === 0 && colOf(k) ? " bl" : "") + (rowOf(k) % 3 === 0 && rowOf(k) ? " bt" : "") + (k === sel ? " sel" : "");
        if (el.className !== cls) el.className = cls;
        var t = v[k] ? String(v[k]) : ""; if (el.firstChild.textContent !== t) el.firstChild.textContent = t;
        el.setAttribute("tabindex", k === sel ? "0" : "-1"); el.setAttribute("aria-label", "Hàng " + (rowOf(k) + 1) + ", cột " + (colOf(k) + 1) + (v[k] ? ", số " + v[k] : ", trống"));
        if (v[k]) given++;
      }
      info.textContent = given + " ô cho sẵn" + (given < 17 ? " — Sudoku cần ít nhất 17 ô cho sẵn mới có thể có nghiệm duy nhất." : ".");
    }
    function set(k, d) { v[k] = d; paint(); emit(); }
    gridEl.addEventListener("click", function (e) { var c = e.target.closest(".pz-su-cell"); if (c) { sel = +c.dataset.i; paint(); c.focus({ preventScroll: true }); } });
    gridEl.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = +((e.target.closest(".pz-su-cell") || {}).dataset || {}).i, m = DIGIT_CODE.exec(e.code || ""), nx = -1; if (isNaN(k)) return;
      if (e.key === "ArrowRight") nx = colOf(k) < 8 ? k + 1 : k; else if (e.key === "ArrowLeft") nx = colOf(k) > 0 ? k - 1 : k; else if (e.key === "ArrowDown") nx = rowOf(k) < 8 ? k + 9 : k; else if (e.key === "ArrowUp") nx = rowOf(k) > 0 ? k - 9 : k;
      if (nx >= 0) { e.preventDefault(); sel = nx; paint(); cells[nx].focus({ preventScroll: true }); return; }
      if (m) { e.preventDefault(); set(k, +m[1]); } else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); set(k, 0); }
    });
    var digits = h("div", { class: "pz-su-digits", role: "group", "aria-label": "Chọn chữ số" });
    for (var n = 1; n <= 9; n++) (function (n) { var b = h("button", { type: "button", class: "pz-su-num", "aria-label": "Chữ số " + n }, h("b", { text: String(n) })); b.addEventListener("click", function () { set(sel, v[sel] === n ? 0 : n); }); digits.append(b); })(n);
    var clearBtn = h("button", { type: "button", class: "btn pz-su-tool", html: icon("eraser") + "<span>Xoá ô</span>", on: { click: function () { set(sel, 0); } } });
    var allBtn = h("button", { type: "button", class: "btn pz-su-tool", html: icon("trash") + "<span>Xoá hết</span>", on: { click: function () { v = v.map(function () { return 0; }); paint(); emit(); } } });
    var load = h("button", { type: "button", class: "btn btn-primary", text: "Nạp chuỗi", on: { click: function () {
      var s = paste.value.replace(/[\s|+\-]/g, "");
      if (s.length !== N || /[^0-9.]/.test(s)) { info.textContent = "Cần đúng 81 ký tự gồm chữ số 0–9 hoặc dấu chấm (đang có " + s.length + ")."; return; }
      v = s.split("").map(function (ch) { return ch === "." ? 0 : +ch; }); paint(); emit();
    } } });
    host.replaceChildren(h("div", { class: "pz-su" }, gridEl, h("div", { class: "pz-su-pad" }, digits, h("div", { class: "pz-su-tools" }, clearBtn, allBtn)), h("div", { class: "field" }, h("label", { text: "Hoặc dán nguyên chuỗi" }), paste, h("div", { class: "btn-row" }, load)), info));
    paint(); emit();
    return { getInput: function () { return { v: v.slice() }; }, destroy: function () { host.replaceChildren(); } };
  }

  P.boards = P.boards || {};
  P.boards.sudoku = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
