/* ui/boards/nqueens.js — bàn N-Queens: bàn cờ n×n (ô xen kẽ hai sắc), quân hậu SVG nội tuyến, chấm loại, "Hiện ô bị tấn công", dòng trạng thái "Hậu x/N", trình soạn (chọn N + bấm đặt hậu cho sẵn).
   Hành động gửi cho engine (assets/js/puzzles/nqueens.js): {k:"set", i, val} (val 0 trống · 1 hậu · 2 chấm loại) · {k:"clear"} · {k:"clearmarks"}. (Engine còn {k:"cycle"} nhưng bàn này KHÔNG dùng: xem mô hình bên dưới.)

   MÔ HÌNH THAO TÁC (chọn để dùng được trên điện thoại, không cần chuột phải):
   · Có công tắc chế độ "Hậu" | "Chấm". Chế độ Hậu (mặc định): chạm ô = đặt hậu, chạm lại = gỡ hậu (ô đang có chấm thì chạm = đổi thành hậu).
     Chế độ Chấm: chạm ô trống = đánh dấu chấm "ô này không đặt được", chạm lại = bỏ chấm; ô đang có hậu thì không đổi (phải gỡ hậu trước).
   · Thao tác thay thế không cần đổi chế độ: GIỮ LÂU một ô (≈ 0,45 s) hoặc bấm CHUỘT PHẢI = làm điều của chế độ kia (chế độ Hậu: đặt/bỏ chấm; chế độ Chấm: đặt/gỡ hậu).
   · Hậu cho sẵn khóa: chạm vào chỉ rung nhẹ + đọc "Hậu cho sẵn, không đổi được".
   Bàn phím (focus trong bàn): mũi tên di chuyển (Home/End về đầu/cuối hàng) · Space/Enter = hành động chính theo chế độ · Q đặt/gỡ hậu · "." đặt/bỏ chấm · Delete/Backspace gỡ hậu/chấm ở ô.
   "Hiện ô bị tấn công": tô nhạt (nền tím + vạch chéo) các ô nằm trong hàng/cột/2 đường chéo của một hậu đang có — chỉ là trợ giúp thị giác tính ở giao diện, không đổi state; nhớ lựa chọn trong phiên.
   Hậu ăn nhau (type.check(...).conflicts, chỉ khi settings().showConflicts): ô viền đỏ + hậu đỏ + đường nối đỏ giữa các hậu liên tiếp cùng hàng/cột/chéo + chữ "Xung đột: k hậu".
   Trạng thái GIAO DIỆN (chế độ chạm, bật/tắt tấn công, ô đang focus) nằm ở đây; mọi nội dung bàn đi qua game.act nên undo/redo, đếm lỗi, tự lưu chạy tự động. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var SVGNS = "http://www.w3.org/2000/svg", LONG_MS = 450;
  var atkPref = false;                                    // nhớ công tắc "Hiện ô bị tấn công" trong phiên (mặc định tắt)

  // Hình tĩnh (không chứa dữ liệu người dùng) nên dùng innerHTML an toàn.
  var QUEEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="3.1" cy="7" r="1.75"/><circle cx="7.55" cy="4.7" r="1.75"/><circle cx="12" cy="3.9" r="1.75"/><circle cx="16.45" cy="4.7" r="1.75"/><circle cx="20.9" cy="7" r="1.75"/>' +
    '<path d="M3.1 8.7 L6.4 15 L7.55 6.5 L9.9 14.6 L12 5.7 L14.1 14.6 L16.45 6.5 L17.6 15 L20.9 8.7 L19.2 18.4 L4.8 18.4 Z"/><rect x="4" y="19.2" width="16" height="3" rx="1.3"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4.5" y="10.5" width="15" height="11" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';

  function sizeClass(n) { return n <= 8 ? "n-s" : n <= 12 ? "n-m" : n <= 18 ? "n-l" : "n-xl"; }
  function rcText(n, i) { return "hàng " + (Math.floor(i / n) + 1) + ", cột " + (i % n + 1); }
  function queensOf(vs) { var q = [], i; for (i = 0; i < vs.length; i++) if (vs[i] === 1) q.push(i); return q; }

  /** Ô nằm trong tầm ăn của một hậu nào đó (hàng, cột, 2 đường chéo) → mảng 0/1. Chỉ là trợ giúp thị giác. */
  function attackedMap(n, vs) {
    var m = [], i, k, d, r, c, q = queensOf(vs);
    for (i = 0; i < n * n; i++) m.push(0);
    for (k = 0; k < q.length; k++) {
      r = Math.floor(q[k] / n); c = q[k] % n;
      for (d = 0; d < n; d++) {
        m[r * n + d] = 1; m[d * n + c] = 1;
        if (r + d < n && c + d < n) m[(r + d) * n + c + d] = 1;
        if (r + d < n && c - d >= 0) m[(r + d) * n + c - d] = 1;
        if (r - d >= 0 && c + d < n) m[(r - d) * n + c + d] = 1;
        if (r - d >= 0 && c - d >= 0) m[(r - d) * n + c - d] = 1;
      }
    }
    return m;
  }

  /** Các đoạn nối hai hậu LIÊN TIẾP trên cùng hàng/cột/đường chéo: [[r1,c1,r2,c2], …] (đủ thể hiện mọi cặp ăn nhau mà không rối ở N lớn). */
  function conflictLines(n, vs) {
    var q = queensOf(vs), groups = {}, out = [], k, key, g, j;
    function add(key, along, i) { (groups[key] = groups[key] || []).push([along, i]); }
    for (k = 0; k < q.length; k++) {
      var r = Math.floor(q[k] / n), c = q[k] % n;
      add("r" + r, c, q[k]); add("c" + c, r, q[k]); add("d" + (r - c), r, q[k]); add("a" + (r + c), r, q[k]);
    }
    for (key in groups) {
      g = groups[key]; if (g.length < 2) continue;
      g.sort(function (a, b) { return a[0] - b[0]; });
      for (j = 0; j + 1 < g.length; j++) out.push([Math.floor(g[j][1] / n), g[j][1] % n, Math.floor(g[j + 1][1] / n), g[j + 1][1] % n]);
    }
    return out;
  }

  /** Dựng khung bàn n×n (chưa gắn sự kiện). → { wrap, grid, cells[], lines (svg) } */
  function buildBoard(n, label) {
    var wrap = h("div", { class: "pz-nq-wrap " + sizeClass(n) }), board = h("div", { class: "pz-nq-board" });
    wrap.style.setProperty("--n", String(n));
    var grid = h("div", { class: "pz-nq-grid", role: "grid", "aria-label": label, "aria-rowcount": String(n), "aria-colcount": String(n) }), cells = [], r, c, row, cell;
    for (r = 0; r < n; r++) {
      row = h("div", { class: "pz-nq-row", role: "row", "aria-rowindex": String(r + 1) });
      for (c = 0; c < n; c++) {
        cell = h("div", { class: "pz-nq-cell sq" + ((r + c) & 1), role: "gridcell", tabindex: "-1", "aria-colindex": String(c + 1), dataset: { i: String(r * n + c) } });
        cells.push(cell); row.append(cell);
      }
      grid.append(row);
    }
    var lines = doc.createElementNS(SVGNS, "svg");
    lines.setAttribute("class", "pz-nq-lines"); lines.setAttribute("viewBox", "0 0 " + n + " " + n); lines.setAttribute("preserveAspectRatio", "none");
    lines.setAttribute("aria-hidden", "true"); lines.setAttribute("focusable", "false");
    board.append(grid, lines); wrap.append(board);
    return { wrap: wrap, grid: grid, cells: cells, lines: lines };
  }

  /** Bảo đảm ô có (hoặc không có) phần tử quân/chấm/khoá đúng theo v (0/1/2); chỉ chạm DOM khi đổi. */
  function syncGlyph(el, v, given) {
    var q = el._q, d = el._d, k = el._k;
    if (v === 1) { if (!q) { q = el._q = h("span", { class: "pz-nq-q", html: QUEEN }); el.append(q); } if (q.hidden) q.hidden = false; } else if (q && !q.hidden) q.hidden = true;
    if (v === 2) { if (!d) { d = el._d = h("i", { class: "pz-nq-dot", "aria-hidden": "true" }); el.append(d); } if (d.hidden) d.hidden = false; } else if (d && !d.hidden) d.hidden = true;
    if (given) { if (!k) { k = el._k = h("span", { class: "pz-nq-lk", html: LOCK }); el.append(k); } } else if (k) { k.remove(); el._k = null; }
  }

  /** Vẽ các đoạn nối lên lớp phủ SVG (chỉ khi đổi). */
  function drawLines(svg, list) {
    var sig = list.map(function (l) { return l.join(","); }).join(";");
    if (svg._sig === sig) return; svg._sig = sig;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    list.slice(0, 220).forEach(function (l) {
      var x1 = l[1] + 0.5, y1 = l[0] + 0.5, x2 = l[3] + 0.5, y2 = l[2] + 0.5, dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), cut = Math.min(0.3, len * 0.3), ln = doc.createElementNS(SVGNS, "line");
      ln.setAttribute("x1", String(x1 + dx / len * cut)); ln.setAttribute("y1", String(y1 + dy / len * cut));
      ln.setAttribute("x2", String(x2 - dx / len * cut)); ln.setAttribute("y2", String(y2 - dy / len * cut));
      svg.appendChild(ln);
    });
  }

  /** Pointer Events: chạm/bấm nhả trên cùng ô = onMain(i); giữ lâu hoặc chuột phải = onAlt(i) (nếu có); kéo/cuộn thì huỷ. Click không do con trỏ (trình đọc màn hình, detail 0) = onMain. → hàm gỡ. */
  function attachPointer(gridEl, onMain, onAlt) {
    var press = null, timer = 0;
    function clear() { if (timer) { clearTimeout(timer); timer = 0; } press = null; }
    function cellOf(e) { var t = e.target; return t && t.closest ? t.closest(".pz-nq-cell") : null; }
    function down(e) {
      var c = cellOf(e); if (!c) return;
      var i = +c.dataset.i;
      if (e.pointerType === "mouse" && e.button !== 0) { if (e.button === 2 && onAlt) { e.preventDefault(); onAlt(i); } return; }
      clear();
      press = { i: i, x: e.clientX, y: e.clientY, id: e.pointerId, long: false };
      if (onAlt) timer = setTimeout(function () { timer = 0; if (press) { press.long = true; onAlt(press.i); } }, LONG_MS);
    }
    function move(e) { if (press && e.pointerId === press.id && (Math.abs(e.clientX - press.x) > 10 || Math.abs(e.clientY - press.y) > 10)) clear(); }
    function up(e) {
      var p = press; if (!p || e.pointerId !== p.id) return;
      var c = cellOf(e), long = p.long; clear();
      if (!long && c && +c.dataset.i === p.i) onMain(p.i);
    }
    function click(e) { if (e.detail === 0) { var c = cellOf(e); if (c) onMain(+c.dataset.i); } }
    function noMenu(e) { e.preventDefault(); }
    gridEl.addEventListener("pointerdown", down); gridEl.addEventListener("pointermove", move); gridEl.addEventListener("pointerup", up);
    gridEl.addEventListener("pointercancel", clear); gridEl.addEventListener("contextmenu", noMenu); gridEl.addEventListener("click", click);
    return function detach() {
      clear();
      gridEl.removeEventListener("pointerdown", down); gridEl.removeEventListener("pointermove", move); gridEl.removeEventListener("pointerup", up);
      gridEl.removeEventListener("pointercancel", clear); gridEl.removeEventListener("contextmenu", noMenu); gridEl.removeEventListener("click", click);
    };
  }

  /** Vị trí ô kế tiếp theo phím mũi tên / Home / End (-1 nếu không phải phím di chuyển). */
  function moveKey(e, i, n) {
    var r = Math.floor(i / n), c = i % n;
    if (e.key === "ArrowRight") return c < n - 1 ? i + 1 : i;
    if (e.key === "ArrowLeft") return c > 0 ? i - 1 : i;
    if (e.key === "ArrowDown") return r < n - 1 ? i + n : i;
    if (e.key === "ArrowUp") return r > 0 ? i - n : i;
    if (e.key === "Home") return r * n;
    if (e.key === "End") return r * n + n - 1;
    return -1;
  }

  function flash(el) { if (!el) return; el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); setTimeout(function () { el.classList.remove("nope"); }, 300); }

  // ============================================================================================== bàn chơi
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, ro = !!env.readOnly;
    var n = (puzzle.data && puzzle.data.n) || Math.round(Math.sqrt(game.state.v.length)), N = n * n;
    var mode = "queen", sel = 0, marks = {}, offGame = null, detach = null, clsC = [], labC = [], tabC = [], i;
    var B = buildBoard(n, "Bàn cờ " + n + " nhân " + n + " — đặt " + n + " hậu không ăn nhau"), cells = B.cells, gridEl = B.grid;
    if (ro) gridEl.classList.add("ro");

    var countEl = h("span", { class: "pz-nq-count" }), confEl = h("span", { class: "pz-nq-conf" });
    var hud = h("div", { class: "pz-nq-hud" }, countEl, confEl);
    var tools = null, modeBtns = {}, atkBtn, clearBtn, marksBtn;
    var wrap = h("div", { class: "pz-nq" }, hud, B.wrap);

    function mkMode(id, ic, text, label) {
      var b = h("button", { type: "button", "aria-pressed": String(id === mode), "aria-label": label, title: label, dataset: { mode: id } }, h("span", { class: "ico", html: ic }), h("span", { text: text }));
      b.addEventListener("click", function () { setMode(id); }); modeBtns[id] = b; return b;
    }
    if (!ro) {
      var seg = h("div", { class: "seg", role: "group", "aria-label": "Chế độ khi chạm vào ô" }, mkMode("queen", QUEEN, "Hậu", "Chế độ Hậu: chạm để đặt hoặc gỡ hậu"), mkMode("dot", "<i></i>", "Chấm", "Chế độ Chấm: chạm để đánh dấu ô không đặt được"));
      atkBtn = h("button", { type: "button", class: "btn", "aria-pressed": String(atkPref), text: "Hiện ô bị tấn công", title: "Tô nhạt các ô nằm trong tầm ăn của các hậu đang có" });
      clearBtn = h("button", { type: "button", class: "btn", text: "Xoá hậu của tôi", "aria-label": "Xoá hậu của tôi (giữ hậu cho sẵn)" });
      marksBtn = h("button", { type: "button", class: "btn", text: "Xoá dấu chấm", "aria-label": "Xoá dấu chấm" });
      clearBtn.addEventListener("click", function () { var r = act({ k: "clear" }); if (r.ok) env.announce("Đã xoá hậu của bạn, giữ hậu cho sẵn."); });
      marksBtn.addEventListener("click", function () { var r = act({ k: "clearmarks" }); if (r.ok) env.announce("Đã xoá các dấu chấm."); });
      tools = h("div", { class: "pz-nq-tools" }, seg, atkBtn, clearBtn, marksBtn);
    } else {
      atkBtn = h("button", { type: "button", class: "btn", "aria-pressed": String(atkPref), text: "Hiện ô bị tấn công", title: "Tô nhạt các ô nằm trong tầm ăn của các hậu đang có" });
      tools = h("div", { class: "pz-nq-tools" }, atkBtn);
    }
    atkBtn.addEventListener("click", function () { atkPref = !atkPref; atkBtn.setAttribute("aria-pressed", String(atkPref)); paint(); env.announce(atkPref ? "Đang hiện các ô bị hậu tấn công." : "Đã tắt hiện ô bị tấn công."); });
    wrap.append(tools, h("p", { class: "pz-nq-help", text: ro ? "Chỉ xem." : "Chạm = đặt/gỡ hậu theo chế độ đang chọn. Giữ lâu hoặc chuột phải = làm điều của chế độ kia. Phím: Q hậu, . chấm, Delete xoá." }));
    host.replaceChildren(wrap);

    // ---- thao tác
    function act(a) { var r = game.act(a); if (r.ok && r.mistakes) env.announce("Nước này sai: hậu vừa đặt không thể thuộc lời giải nào."); return r; }
    function setMode(id) {
      mode = id; for (var k in modeBtns) modeBtns[k].setAttribute("aria-pressed", String(k === id));
      env.announce(id === "queen" ? "Chế độ Hậu: chạm để đặt hoặc gỡ hậu." : "Chế độ Chấm: chạm để đánh dấu ô không đặt được.");
    }
    function setSel(k) { sel = k; for (var j = 0; j < N; j++) { var t = j === sel ? "0" : "-1"; if (tabC[j] !== t) { tabC[j] = t; cells[j].setAttribute("tabindex", t); } } }
    /** kind "queen" | "dot": đảo hậu/chấm ở ô i. */
    function apply(i, kind) {
      if (ro) return;
      setSel(i);
      if (type.isGiven(puzzle, i)) { flash(cells[i]); env.announce("Hậu cho sẵn ở " + rcText(n, i) + ", không đổi được."); return; }
      var v = game.state.v[i], val;
      if (kind === "queen") val = v === 1 ? 0 : 1;
      else { if (v === 1) { flash(cells[i]); env.announce("Ô đang có hậu. Gỡ hậu trước khi đánh dấu chấm."); return; } val = v === 2 ? 0 : 2; }
      var r = act({ k: "set", i: i, val: val });
      if (!r.ok) return;
      var conflict = val === 1 && env.settings().showConflicts && r.check && r.check.conflicts.indexOf(i) >= 0;
      env.announce(val === 1 ? "Đặt hậu ở " + rcText(n, i) + (conflict ? ", đang ăn hậu khác." : ".") : val === 2 ? "Đánh dấu chấm ở " + rcText(n, i) + "." : (v === 1 ? "Gỡ hậu ở " : "Bỏ dấu chấm ở ") + rcText(n, i) + ".");
    }
    function clearCell(i) {
      if (ro || type.isGiven(puzzle, i)) return;
      setSel(i);
      var v = game.state.v[i]; if (!v) return;
      var r = act({ k: "set", i: i, val: 0 }); if (r.ok) env.announce((v === 1 ? "Gỡ hậu ở " : "Bỏ dấu chấm ở ") + rcText(n, i) + ".");
    }
    function other() { return mode === "queen" ? "dot" : "queen"; }

    // ---- vẽ
    /** aria-label = type.describeCell. Bàn lớn (> 256 ô): chỉ ô đang chọn cập nhật ngay, các ô khác ngay sau đó (và mỗi ô được làm mới đúng lúc nhận focus) để mỗi nước đi vẫn tức thì. */
    var lazyLabels = N > 256, labTimer = 0;
    function label(j) { if (j < 0 || j >= N) return; var lab = type.describeCell(puzzle, game.state, j); if (labC[j] !== lab) { labC[j] = lab; cells[j].setAttribute("aria-label", lab); } }
    function labelAll() { labTimer = 0; for (var j = 0; j < N; j++) label(j); }
    function paint() {
      var st = game.state, vs = st.v, s = env.settings(), conf = {}, chk, k, j;
      try { chk = type.check(puzzle, st); } catch (e) { chk = { conflicts: [], filled: 0, total: n, solved: false }; }
      if (s.showConflicts) for (k = 0; k < chk.conflicts.length; k++) conf[chk.conflicts[k]] = 1;
      var atk = atkPref ? attackedMap(n, vs) : null, mine = 0, dots = 0;
      for (j = 0; j < N; j++) {
        var el = cells[j], v = vs[j], given = type.isGiven(puzzle, j), cls = "pz-nq-cell sq" + (((Math.floor(j / n) + j % n) & 1));
        if (given) cls += " given";
        if (v === 1) { cls += " queen"; if (!given) mine++; } else if (v === 2) { cls += " dotted"; dots++; }
        if (conf[j]) cls += " conflict";
        if (atk && atk[j] && v !== 1) cls += " atk";
        if (marks[j]) cls += " " + marks[j];
        if (clsC[j] !== cls) { clsC[j] = cls; el.className = cls; }
        syncGlyph(el, v, given);
        if (!lazyLabels) label(j);
        var tb = j === sel ? "0" : "-1"; if (tabC[j] !== tb) { tabC[j] = tb; el.setAttribute("tabindex", tb); }
      }
      if (lazyLabels) { label(sel); if (!labTimer) labTimer = setTimeout(labelAll, 80); }
      countEl.textContent = "Hậu: " + chk.filled + "/" + n + (chk.solved ? " ✓" : "");
      if (s.showConflicts) {
        var kc = chk.conflicts.length;
        confEl.textContent = kc ? "⚠ Xung đột: " + kc + " hậu đang ăn nhau" : "✓ Không có xung đột";
        confEl.className = "pz-nq-conf " + (kc ? "bad" : "ok");
        drawLines(B.lines, conflictLines(n, vs));
      } else { confEl.textContent = "Xung đột: đang ẩn (bật “Tô ô xung đột” trong Cài đặt)"; confEl.className = "pz-nq-conf"; drawLines(B.lines, []); }
      if (clearBtn) clearBtn.disabled = mine === 0;
      if (marksBtn) marksBtn.disabled = dots === 0;
    }

    // ---- sự kiện
    if (!ro) detach = attachPointer(gridEl, function (i) { apply(i, mode); }, function (i) { apply(i, other()); });
    else detach = attachPointer(gridEl, function (i) { setSel(i); }, null);
    gridEl.addEventListener("keydown", onKey); gridEl.addEventListener("focusin", onFocusIn);
    function onFocusIn(e) { var c = e.target.closest ? e.target.closest(".pz-nq-cell") : null; if (c) label(+c.dataset.i); }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = e.target.closest ? e.target.closest(".pz-nq-cell") : null; if (!c) return;
      var i = +c.dataset.i, nx = moveKey(e, i, n);
      if (nx >= 0) { e.preventDefault(); setSel(nx); label(nx); cells[nx].focus({ preventScroll: true }); return; }
      if (ro) return;
      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); apply(i, mode); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); clearCell(i); return; }
      if (e.key === "." || e.key === "," || e.key === "x" || e.key === "X") { e.preventDefault(); apply(i, "dot"); return; }
      if (e.key === "q" || e.key === "Q") { e.preventDefault(); apply(i, "queen"); }
    }
    offGame = game.on(function (ev) { if (ev.type === "change" || ev.type === "status") paint(); });
    paint();

    return {
      destroy: function () { if (offGame) offGame(); if (detach) detach(); if (labTimer) { clearTimeout(labTimer); labTimer = 0; } gridEl.removeEventListener("keydown", onKey); gridEl.removeEventListener("focusin", onFocusIn); host.replaceChildren(); },
      refresh: paint,
      highlight: function (list, kind) { marks = {}; if (list && kind) list.forEach(function (i) { marks[i] = kind; }); paint(); },
      focus: function () { var t = cells[sel]; if (t) t.focus({ preventScroll: true }); }
    };
  }

  // ============================================================================================== trình soạn
  /** Trình soạn (màn Tạo puzzle): chọn N (4–24), bấm ô để đặt/gỡ hậu CHO SẴN. onChange({ n, v: [n*n số 0/1] }) — đúng dạng type.fromInput nhận. */
  function editor(host, env) {
    var MIN_N = 4, MAX_N = 24, n = 8, v = [], sel = 0, B = null, cells = [], detach = null, i;
    var src = env.input || null, pz = env.puzzle || null;
    function fromList(nn, arr) { var o = [], k; for (k = 0; k < nn * nn; k++) o.push(arr && arr[k] === 1 ? 1 : 0); return o; }
    if (src && typeof src === "object" && src.n >= MIN_N && src.n <= MAX_N && src.n === Math.floor(src.n)) {
      n = src.n; var sv = src.v;
      if (typeof sv === "string") sv = sv.split("").map(Number);
      if (!Array.isArray(sv) && Array.isArray(src.queens)) { sv = []; for (i = 0; i < n * n; i++) sv.push(0); src.queens.forEach(function (q) { if (q >= 0 && q < n * n) sv[q] = 1; }); }
      v = fromList(n, Array.isArray(sv) && sv.length === n * n ? sv : null);
    } else if (pz && pz.data && pz.data.n >= MIN_N && pz.data.n <= MAX_N && pz.initial && Array.isArray(pz.initial.v)) {
      n = pz.data.n; v = fromList(n, pz.initial.v.length === n * n ? pz.initial.v : null);
    } else v = fromList(n, null);

    var count = h("span", { class: "pz-nq-count" }), note = h("p", { class: "pz-nq-note", "aria-live": "polite" });
    var sel_n = h("select", { "aria-label": "Kích thước bàn N" });
    for (i = MIN_N; i <= MAX_N; i++) sel_n.append(h("option", { value: String(i), text: "N = " + i + " (" + i + "×" + i + ")" }));
    var dec = h("button", { type: "button", class: "btn", "aria-label": "Giảm N", title: "Giảm N", html: icon("minus") }), inc = h("button", { type: "button", class: "btn", "aria-label": "Tăng N", title: "Tăng N", html: icon("plus") });
    var nrow = h("div", { class: "pz-nq-nsel" }, h("label", { text: "Kích thước N (4–24)" }), h("div", { class: "pz-nq-step" }, dec, sel_n, inc));
    var clearAll = h("button", { type: "button", class: "btn", text: "Xoá hết hậu", "aria-label": "Xoá hết hậu cho sẵn" });
    var tools = h("div", { class: "pz-nq-tools" }, clearAll);
    var boardSlot = h("div", {});
    var wrap = h("div", { class: "pz-nq pz-nq-edit" }, nrow, h("div", { class: "pz-nq-hud" }, count), boardSlot, note, tools, h("p", { class: "pz-nq-help", text: "Chạm ô để đặt hoặc gỡ một hậu CHO SẴN. Đề tốt có đúng một cách hoàn thành; kết quả kiểm tra nằm ở khung bên cạnh. Phím: mũi tên di chuyển, Space/Enter đặt-gỡ, Delete gỡ." }));
    host.replaceChildren(wrap);

    function emit() { env.onChange({ n: n, v: v.slice() }); }
    function build() {
      if (detach) { detach(); detach = null; }
      B = buildBoard(n, "Bàn cờ " + n + " nhân " + n + " đang soạn — bấm để đặt hậu cho sẵn"); cells = B.cells;
      boardSlot.replaceChildren(B.wrap);
      detach = attachPointer(B.grid, function (k) { toggle(k); }, function (k) { toggle(k); });
      B.grid.addEventListener("keydown", onKey);
      if (sel >= n * n) sel = 0;
    }
    function paint() {
      var q = queensOf(v), conf = {}, k, lines = conflictLines(n, v);
      lines.forEach(function (l) { conf[l[0] * n + l[1]] = 1; conf[l[2] * n + l[3]] = 1; });
      for (k = 0; k < n * n; k++) {
        var el = cells[k], on = v[k] === 1, cls = "pz-nq-cell sq" + (((Math.floor(k / n) + k % n) & 1)) + (on ? " given queen" : "") + (conf[k] ? " conflict" : "");
        if (el.className !== cls) el.className = cls;
        syncGlyph(el, on ? 1 : 0, on);
        var lab = "Hàng " + (Math.floor(k / n) + 1) + ", cột " + (k % n + 1) + (on ? ", có hậu cho sẵn" + (conf[k] ? ", đang ăn hậu khác" : "") : ", ô trống");
        if (el.getAttribute("aria-label") !== lab) el.setAttribute("aria-label", lab);
        var tb = k === sel ? "0" : "-1"; if (el.getAttribute("tabindex") !== tb) el.setAttribute("tabindex", tb);
      }
      drawLines(B.lines, lines);
      count.textContent = "Hậu cho sẵn: " + q.length + " (bàn " + n + "×" + n + ")";
      var bad = Object.keys(conf).length;
      note.className = "pz-nq-note" + (bad ? " bad" : "");
      note.textContent = bad ? "⚠ Có " + bad + " hậu cho sẵn đang ăn nhau — đề này vô nghiệm, hãy gỡ bớt." : q.length === 0 ? "Bàn trống: đề sẽ có rất nhiều nghiệm. Hãy đặt vài hậu cho sẵn." : "";
      if (sel_n.value !== String(n)) sel_n.value = String(n);
      dec.disabled = n <= MIN_N; inc.disabled = n >= MAX_N; clearAll.disabled = q.length === 0;
    }
    function toggle(k) { sel = k; v[k] = v[k] === 1 ? 0 : 1; paint(); emit(); }
    function setN(m) {
      m = Math.max(MIN_N, Math.min(MAX_N, m | 0)); if (m === n) { paint(); return; }
      var nv = [], r, c;                                              // giữ các hậu còn nằm trong bàn mới
      for (r = 0; r < m; r++) for (c = 0; c < m; c++) nv.push(r < n && c < n ? v[r * n + c] : 0);
      n = m; v = nv; sel = 0; build(); paint(); emit();
    }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = e.target.closest ? e.target.closest(".pz-nq-cell") : null; if (!c) return;
      var k = +c.dataset.i, nx = moveKey(e, k, n);
      if (nx >= 0) { e.preventDefault(); sel = nx; paint(); cells[nx].focus({ preventScroll: true }); return; }
      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); toggle(k); }
      else if ((e.key === "Delete" || e.key === "Backspace") && v[k] === 1) { e.preventDefault(); toggle(k); }
    }
    sel_n.addEventListener("change", function () { setN(+sel_n.value); });
    dec.addEventListener("click", function () { setN(n - 1); }); inc.addEventListener("click", function () { setN(n + 1); });
    clearAll.addEventListener("click", function () { v = fromList(n, null); paint(); emit(); });

    build(); paint(); emit();
    return {
      getInput: function () { return { n: n, v: v.slice() }; },
      destroy: function () { if (detach) detach(); host.replaceChildren(); }
    };
  }

  P.boards = P.boards || {};
  P.boards.nqueens = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
