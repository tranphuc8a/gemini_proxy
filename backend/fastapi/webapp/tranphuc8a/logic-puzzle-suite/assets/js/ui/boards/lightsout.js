/* ui/boards/lightsout.js — bàn LIGHTS OUT: lưới w×h "đèn" (bật = sáng vàng + tia + quầng, tắt = tối + vòng rỗng — khác nhau cả hình dạng chứ không chỉ màu) và trình soạn bàn đầu.
   Hành động gửi cho engine (assets/js/puzzles/lightsout.js): {k:"press", i} — bấm ô i, đảo chữ thập 5 ô (tự nghịch đảo). state.v[i] = 1 đèn BẬT, 0 TẮT; mục tiêu: tắt hết.
   Đầu vào của trình soạn (type.fromInput): { w, h, v:[w*h số 0/1] }.

   Bàn phím (focus trong lưới, roving tabindex): mũi tên di chuyển · Home/End đầu/cuối hàng · PageUp/PageDown đầu/cuối cột · Space hoặc Enter = bấm ô.
   Chuột/cảm ứng (Pointer Events): bấm = nhả chuột/ngón tay trên đúng ô vừa nhấn; kéo > 10 px hoặc cuộn trang thì huỷ (không bấm nhầm khi cuộn).
   Trợ giúp thị giác: rê chuột, focus bàn phím, hoặc GIỮ ≥ 300 ms trên cảm ứng ⇒ tô chữ thập 5 ô sẽ bị đảo (nhả ngón tay trên ô đó thì bấm; kéo ra ngoài thì huỷ). Không dựa vào hover.
   Chuyển động bật/tắt (lật nhẹ) tự tắt khi hệ điều hành đặt prefers-reduced-motion.
   Vẽ theo diff (ev.diff.d) khi có thể, DOM không dựng lại nên focus được giữ; vỏ gọi refresh() khi replay đổi state ngoài act. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var HOLD_MS = 300, MOVE_PX = 10, MIN_D = 2, MAX_D = 10;
  // đèn: lớp .lit (ánh vàng, hiện khi bật) + biểu tượng: vòng rỗng (tắt) → đĩa đặc + 8 tia (bật)
  var LAMP = '<span class="pz-lo-lit" aria-hidden="true"></span><svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
    '<path class="rays" d="M50 5V16M50 84V95M5 50H16M84 50H95M74 26L81.8 18.2M74 74L81.8 81.8M26 74L18.2 81.8M26 26L18.2 18.2"/><circle class="core" cx="50" cy="50" r="21"/></svg>';
  var mqReduce = null;
  try { mqReduce = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : null; } catch (e) { mqReduce = null; }
  function reduced() { return !!(mqReduce && mqReduce.matches); }

  function toInt(x) { if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function clampD(x) { return Math.max(MIN_D, Math.min(MAX_D, x)); }
  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function rcText(w, i) { return "hàng " + (Math.floor(i / w) + 1) + ", cột " + (i % w + 1); }
  /** Các ô bị đảo khi bấm ô i (kể cả chính nó) — chỉ để TÔ trợ giúp; luật thật nằm ở engine. */
  function crossOf(w, hh, i) {
    var r = Math.floor(i / w), c = i % w, o = [i];
    if (r > 0) o.push(i - w);
    if (c > 0) o.push(i - 1);
    if (c < w - 1) o.push(i + 1);
    if (r < hh - 1) o.push(i + w);
    return o;
  }
  /** Ô đích khi bấm phím điều hướng, -1 nếu không phải phím điều hướng. */
  function navTarget(key, i, w, n) {
    var r = Math.floor(i / w), c = i % w, rows = n / w;
    if (key === "ArrowRight") return c < w - 1 ? i + 1 : i;
    if (key === "ArrowLeft") return c > 0 ? i - 1 : i;
    if (key === "ArrowDown") return r < rows - 1 ? i + w : i;
    if (key === "ArrowUp") return r > 0 ? i - w : i;
    if (key === "Home") return r * w;
    if (key === "End") return r * w + w - 1;
    if (key === "PageUp") return c;
    if (key === "PageDown") return (rows - 1) * w + c;
    return -1;
  }
  function cellOf(el) { return el && el.closest ? el.closest(".pz-lo-cell") : null; }
  /** Gỡ lớp .flip khi hoạt ảnh lật xong (để lần đảo sau chạy lại được và lớp không nằm lại mãi). Uỷ quyền ở lưới/khung chứa lưới. */
  function onFlipEnd(root0) {
    root0.addEventListener("animationend", function (e) { if (e.animationName === "pz-lo-flip") { var c = cellOf(e.target); if (c) c.classList.remove("flip"); } });
  }
  /** Dựng lưới w×h (role=grid > row > gridcell). Khoảng cách giữa ô co theo bề rộng khung; bàn dày (≥ 9 cột) khít hơn để ô vẫn ≥ 28 px trên điện thoại. */
  function buildGrid(w, hh, label, extraClass) {
    var grid = h("div", { class: "pz-lo-grid" + (extraClass ? " " + extraClass : ""), role: "grid", "aria-label": label, "aria-rowcount": String(hh), "aria-colcount": String(w) }), cells = [];
    grid.style.setProperty("--w", String(w));
    grid.style.setProperty("--h", String(hh));
    grid.style.setProperty("--gk", w >= 9 ? "0.7" : w >= 7 ? "1" : "1.3");
    for (var r = 0; r < hh; r++) {
      var row = h("div", { class: "pz-lo-row", role: "row", "aria-rowindex": String(r + 1) });
      for (var c = 0; c < w; c++) {
        var i = r * w + c, cell = h("div", { class: "pz-lo-cell", role: "gridcell", tabindex: "-1", "aria-colindex": String(c + 1), dataset: { i: String(i) }, html: LAMP });
        cells.push(cell); row.append(cell);
      }
      grid.append(row);
    }
    return { grid: grid, cells: cells };
  }

  // =================================================================================================================== bàn chơi
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, ro = !!env.readOnly;
    var dd = puzzle.data || {}, sz = puzzle.size || {}, w = toInt(dd.w != null ? dd.w : sz.w) || 5, hh = toInt(dd.h != null ? dd.h : sz.h) || 5, N = w * hh;
    var K = dd.presses && dd.presses.length ? dd.presses.length : 0;
    var shown = [], shownMk = [], shownLab = [], marks = {}, preview = [], focusI = 0, hover = -1, hold = -1, kbFocus = -1, down = null, holdTimer = 0, lastTouch = 0, offGame = null;

    // ---- khung
    var litB = h("b", { text: "0" }), movesB = h("b", { text: "0" });
    var stats = h("div", { class: "pz-lo-stats", role: "group", "aria-label": "Thông tin bàn" },
      h("span", { class: "pz-lo-stat", title: "Số đèn đang sáng — tắt hết là thắng" }, litB, " đèn sáng"),
      h("span", { class: "pz-lo-stat", title: "Số lần bạn đã bấm" }, movesB, " lần bấm"),
      K ? h("span", { class: "pz-lo-stat", title: "Số lần bấm tối thiểu để tắt hết đèn (chỉ là độ khó, không cho biết ô nào)" }, "Ít nhất ", h("b", { text: String(K) }), " lần bấm") : null);
    var built = buildGrid(w, hh, "Bàn Lights Out " + w + " nhân " + hh + ", bấm một ô để đảo đèn của ô đó và bốn ô kề", ""), grid = built.grid, cells = built.cells;
    host.replaceChildren(h("div", { class: "pz-lo" }, stats, grid));

    // ---- vẽ
    function canAct() { return !ro && !game.finished(); }
    function paintCell(i, animate) {
      var el = cells[i], on = game.state.v[i] ? 1 : 0, mk = marks[i] || "";
      if (shown[i] !== on) {
        var first = shown[i] === undefined; shown[i] = on; el.classList.toggle("on", !!on);
        if (animate && !first && !reduced()) { el.classList.remove("flip"); void el.offsetWidth; el.classList.add("flip"); }
      }
      if (shownMk[i] !== mk) { shownMk[i] = mk; el.classList.toggle("hint", mk === "hint"); el.classList.toggle("replay", mk === "replay"); }
      var lab = type.describeCell(puzzle, game.state, i) + (mk === "hint" ? " — đang được gợi ý" : mk === "replay" ? " — đèn vừa đổi ở bước này" : "");
      if (shownLab[i] !== lab) { shownLab[i] = lab; el.setAttribute("aria-label", lab); }
    }
    function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
    function updateHud() {
      var v = game.state.v, lit = 0, i, mv = game.counters.moves;
      for (i = 0; i < N; i++) if (v[i]) lit++;
      setText(litB, String(lit)); setText(movesB, ro && !mv ? "–" : String(mv));
      var locked = !canAct();
      grid.classList.toggle("is-solved", lit === 0); grid.classList.toggle("is-locked", locked); grid.setAttribute("aria-readonly", String(locked));
    }
    function paintAll(animate) { for (var i = 0; i < N; i++) paintCell(i, animate); updateHud(); }
    function setFocusable(i) {
      if (i === focusI && cells[i].getAttribute("tabindex") === "0") return;
      cells[focusI].setAttribute("tabindex", "-1"); focusI = i; cells[i].setAttribute("tabindex", "0");
    }
    function setPreview(i) {
      var want = i >= 0 && canAct() ? crossOf(w, hh, i) : [], k;
      for (k = 0; k < preview.length; k++) cells[preview[k]].classList.remove("xp", "xp-c");
      preview = want;
      for (k = 0; k < want.length; k++) cells[want[k]].classList.add(want[k] === i ? "xp-c" : "xp");
    }
    function refreshPreview() { setPreview(hold >= 0 ? hold : hover >= 0 ? hover : kbFocus); }

    // ---- thao tác
    function press(i) {
      if (!canAct()) return;
      var r = game.act({ k: "press", i: i });
      if (!r.ok) return;                                   // paused / finished / noop: vỏ đang che bàn hoặc đã xong — không báo lỗi
      var lit = 0, v = game.state.v, k;
      for (k = 0; k < N; k++) if (v[k]) lit++;
      env.announce("Đã bấm " + rcText(w, i) + ", đảo " + (r.diff ? r.diff.d.length : 0) + " đèn. " + (lit ? "Còn " + lit + " đèn sáng." : "Đã tắt hết đèn!"));
    }
    function focusCell(i) { setFocusable(i); cells[i].focus({ preventScroll: true }); }
    function cancelDown() { clearTimeout(holdTimer); holdTimer = 0; down = null; if (hold >= 0) { hold = -1; refreshPreview(); } }

    // ---- sự kiện
    onFlipEnd(grid);
    grid.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return;
      var c = cellOf(e.target); if (!c) return;
      var i = +c.dataset.i;
      down = { id: e.pointerId, i: i, x: e.clientX, y: e.clientY, type: e.pointerType, moved: false };
      if (e.pointerType && e.pointerType !== "mouse") lastTouch = Date.now();
      clearTimeout(holdTimer);
      if (canAct() && e.pointerType !== "mouse") holdTimer = setTimeout(function () { holdTimer = 0; if (down) { hold = down.i; refreshPreview(); } }, HOLD_MS);
    });
    grid.addEventListener("pointermove", function (e) {
      if (!down || e.pointerId !== down.id || down.moved) return;
      if (Math.abs(e.clientX - down.x) > MOVE_PX || Math.abs(e.clientY - down.y) > MOVE_PX) { down.moved = true; clearTimeout(holdTimer); holdTimer = 0; if (hold >= 0) { hold = -1; refreshPreview(); } }   // kéo đi xa = không phải bấm
    });
    grid.addEventListener("pointerup", function (e) {
      if (!down || e.pointerId !== down.id) return;
      var d0 = down; cancelDown();
      if (d0.moved) return;
      var el = doc.elementFromPoint(e.clientX, e.clientY), c = cellOf(el);
      if (!c || +c.dataset.i !== d0.i) return;
      press(d0.i);
    });
    grid.addEventListener("pointercancel", function () { cancelDown(); });
    grid.addEventListener("contextmenu", function (e) { if (down && down.type !== "mouse" || Date.now() - lastTouch < 1200) e.preventDefault(); });   // giữ ngón tay không bật menu ngữ cảnh
    grid.addEventListener("pointerover", function (e) { if (e.pointerType !== "mouse") return; var c = cellOf(e.target); hover = c ? +c.dataset.i : -1; refreshPreview(); });
    grid.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hover = -1; refreshPreview(); } });
    grid.addEventListener("focusin", function (e) {
      var c = cellOf(e.target); if (!c) return;
      var i = +c.dataset.i, vis = false; setFocusable(i);
      try { vis = c.matches(":focus-visible"); } catch (x) { vis = false; }
      kbFocus = vis ? i : -1; refreshPreview();
    });
    grid.addEventListener("focusout", function () { kbFocus = -1; refreshPreview(); });
    grid.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = cellOf(e.target); if (!c) return;
      var i = +c.dataset.i, nx = navTarget(e.key, i, w, N);
      if (nx >= 0) { e.preventDefault(); if (nx !== i) focusCell(nx); return; }
      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); if (!e.repeat) press(i); }
    });
    offGame = game.on(function (ev) {
      if (ev.type === "change") {
        if (ev.diff && ev.diff.d && !ev.restart && !ev.reveal) { ev.diff.d.forEach(function (e) { if (e[0] === "v" && cells[e[1]]) paintCell(e[1], true); }); updateHud(); }
        else paintAll(true);
        if (!canAct()) { hover = -1; kbFocus = -1; hold = -1; }
        refreshPreview();
      } else if (ev.type === "status") { updateHud(); refreshPreview(); }
    });
    cells[0].setAttribute("tabindex", "0");
    paintAll(false);

    return {
      destroy: function () { clearTimeout(holdTimer); if (offGame) offGame(); offGame = null; host.replaceChildren(); },
      refresh: function () { paintAll(true); },
      highlight: function (list, kind) {
        var old = marks, i;
        marks = {};
        if (list && list.length && kind) list.forEach(function (j) { if (j >= 0 && j < N) marks[j] = kind; });
        for (i in old) if (Object.prototype.hasOwnProperty.call(old, i)) paintCell(+i, false);
        for (i in marks) if (Object.prototype.hasOwnProperty.call(marks, i)) paintCell(+i, false);
      },
      focus: function () { cells[focusI].focus({ preventScroll: true }); }
    };
  }

  // =================================================================================================================== trình soạn
  /** Trình soạn (màn Tạo puzzle): chọn rộng/cao 2–10, bấm ô để bật/tắt đèn của bàn đầu; "Bàn ngẫu nhiên" = bấm ngẫu nhiên từ bàn tắt (luôn giải được);
      onChange({ w, h, v:[w*h số 0/1] }) — đúng dạng type.fromInput nhận. Engine từ chối bàn tắt hết và bàn không giải được; vỏ hiện lỗi đó. */
  function editor(host, env) {
    var w = 5, hh = 5, v = null, square = true, sel = 0, cells = [], gridHost, info, gridEl = null;
    var inp = env.input, pz = env.puzzle, src = null;
    if (inp && typeof inp === "object" && (inp.w != null || inp.n != null || inp.v != null)) {
      var iw = toInt(inp.w != null ? inp.w : inp.n), ih = toInt(inp.h != null ? inp.h : inp.n);
      if (iw != null) w = clampD(iw); if (ih != null) hh = clampD(ih); else if (iw != null && inp.h == null) hh = w;
      src = inp.v;
    } else if (pz && pz.initial && pz.initial.v) {
      var pw = pz.data && toInt(pz.data.w) || pz.size && toInt(pz.size.w), ph = pz.data && toInt(pz.data.h) || pz.size && toInt(pz.size.h);
      if (pw != null && ph != null) { w = clampD(pw); hh = clampD(ph); src = pz.initial.v; }
    }
    if (typeof src === "string") src = src.split("").map(Number);
    v = zeros(w * hh);
    if (Array.isArray(src) && src.length === w * hh) for (var q = 0; q < v.length; q++) v[q] = src[q] ? 1 : 0;
    square = w === hh;

    // ---- điều khiển kích thước
    function dimControl(labelText, key) {
      var sid = "pz-lo-" + key + "-" + Math.floor(Math.random() * 1e6).toString(36);
      var sel2 = h("select", { id: sid, "aria-label": labelText });
      for (var n = MIN_D; n <= MAX_D; n++) sel2.append(h("option", { value: String(n), text: String(n) }));
      var minus = h("button", { type: "button", class: "btn pz-lo-step", "aria-label": "Giảm " + labelText.toLowerCase(), title: "Giảm", html: icon("minus") });
      var plus = h("button", { type: "button", class: "btn pz-lo-step", "aria-label": "Tăng " + labelText.toLowerCase(), title: "Tăng", html: icon("plus") });
      function cur() { return key === "w" ? w : hh; }
      function apply(n) { n = clampD(n); if (square) resize(n, n); else resize(key === "w" ? n : w, key === "h" ? n : hh); }
      minus.addEventListener("click", function () { apply(cur() - 1); });
      plus.addEventListener("click", function () { apply(cur() + 1); });
      sel2.addEventListener("change", function () { apply(+sel2.value); });
      return { el: h("div", { class: "pz-lo-dim" }, h("label", { for: sid, text: labelText }), h("div", { class: "pz-lo-dim-row" }, minus, sel2, plus)), sync: function () { sel2.value = String(cur()); minus.disabled = cur() <= MIN_D; plus.disabled = cur() >= MAX_D; } };
    }
    var cw = dimControl("Chiều rộng", "w"), ch = dimControl("Chiều cao", "h");
    var sqBtn = h("button", { type: "button", class: "btn pz-lo-tool", "aria-pressed": String(square), title: "Bật: đổi rộng thì cao đổi theo (bàn vuông)", html: icon("grid") + "<span>Bàn vuông</span>" });
    sqBtn.addEventListener("click", function () { square = !square; sqBtn.setAttribute("aria-pressed", String(square)); if (square && w !== hh) resize(w, w); });
    var randBtn = h("button", { type: "button", class: "btn pz-lo-tool", title: "Bấm ngẫu nhiên vài ô từ bàn tắt hết — bàn nào ra cũng giải được", html: icon("dice") + "<span>Bàn ngẫu nhiên</span>" });
    randBtn.addEventListener("click", function () { v = randomBoard(w, hh); paint(); emit(); });
    var clearBtn = h("button", { type: "button", class: "btn pz-lo-tool", html: icon("eraser") + "<span>Tắt hết</span>", title: "Tắt mọi đèn (rồi bật lại các ô bạn muốn)" });
    clearBtn.addEventListener("click", function () { v = zeros(w * hh); paint(); emit(); });
    info = h("p", { class: "pz-lo-info", "aria-live": "polite" });
    gridHost = h("div", { class: "pz-lo-grid-host" });

    /** Bấm ngẫu nhiên (Math.random — chỉ ở giao diện soạn) vài ô từ bàn tắt hết: bàn sinh ra luôn có lời giải (khác bật ngẫu nhiên từng ô, thường vô nghiệm ở 4×4). */
    function randomBoard(cw0, ch0) {
      var n = cw0 * ch0, tries = 0, nv, idx, k, j, t, cs;
      do {
        nv = zeros(n); idx = [];
        for (k = 0; k < n; k++) idx.push(k);
        for (k = n - 1; k > 0; k--) { j = Math.floor(Math.random() * (k + 1)); t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
        var presses = Math.max(2, Math.round(n * (0.25 + Math.random() * 0.2)));
        for (k = 0; k < presses && k < n; k++) { cs = crossOf(cw0, ch0, idx[k]); for (j = 0; j < cs.length; j++) nv[cs[j]] ^= 1; }
        tries++;
      } while (tries < 20 && nv.indexOf(1) < 0);
      if (nv.indexOf(1) < 0) { cs = crossOf(cw0, ch0, Math.floor(Math.random() * n)); for (j = 0; j < cs.length; j++) nv[cs[j]] = 1; }
      return nv;
    }

    // ---- vẽ / phát đầu vào
    function emit() { env.onChange({ w: w, h: hh, v: v.slice() }); }
    function paint() {
      var lit = 0, n = w * hh, k;
      for (k = 0; k < n; k++) {
        var el = cells[k], on = v[k] ? 1 : 0; if (on) lit++;
        el.classList.toggle("on", !!on);
        var lab = "Hàng " + (Math.floor(k / w) + 1) + ", cột " + (k % w + 1) + ", đèn " + (on ? "bật" : "tắt") + ". Bấm để đổi.";
        if (el.getAttribute("aria-label") !== lab) el.setAttribute("aria-label", lab);
      }
      info.textContent = (lit ? lit + " trên " + n + " đèn đang sáng." : "Chưa có đèn nào sáng — hãy bật ít nhất một đèn.") + " Bàn " + w + "×" + hh + ".";
      cw.sync(); ch.sync();
    }
    function rebuild() {
      var b = buildGrid(w, hh, "Bàn Lights Out " + w + " nhân " + hh + " đang soạn", "pz-lo-ed-grid");
      gridEl = b.grid; cells = b.cells; if (sel >= cells.length) sel = 0;
      cells[sel].setAttribute("tabindex", "0");
      gridHost.replaceChildren(gridEl);
    }
    function resize(nw, nh) {
      nw = clampD(nw); nh = clampD(nh);
      if (nw === w && nh === hh) { cw.sync(); ch.sync(); return; }
      var nv = zeros(nw * nh), r, c;
      for (r = 0; r < Math.min(hh, nh); r++) for (c = 0; c < Math.min(w, nw); c++) nv[r * nw + c] = v[r * w + c];
      w = nw; hh = nh; v = nv; rebuild(); paint(); emit();
    }
    function toggle(i) { v[i] = v[i] ? 0 : 1; var el = cells[i]; el.classList.remove("flip"); if (!reduced()) { void el.offsetWidth; el.classList.add("flip"); } paint(); emit(); }
    function setSel(i, focus) { cells[sel].setAttribute("tabindex", "-1"); sel = i; cells[i].setAttribute("tabindex", "0"); if (focus) cells[i].focus({ preventScroll: true }); }

    // ---- sự kiện (uỷ quyền ở gridHost nên dựng lại lưới khi đổi cỡ không cần gắn lại)
    var down = null;
    onFlipEnd(gridHost);
    gridHost.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return;
      var c = cellOf(e.target); down = c ? { id: e.pointerId, i: +c.dataset.i, x: e.clientX, y: e.clientY } : null;
    });
    gridHost.addEventListener("pointermove", function (e) { if (down && e.pointerId === down.id && (Math.abs(e.clientX - down.x) > MOVE_PX || Math.abs(e.clientY - down.y) > MOVE_PX)) down = null; });
    gridHost.addEventListener("pointercancel", function () { down = null; });
    gridHost.addEventListener("pointerup", function (e) {
      if (!down || e.pointerId !== down.id) return;
      var d0 = down; down = null;
      var c = cellOf(doc.elementFromPoint(e.clientX, e.clientY));
      if (c && +c.dataset.i === d0.i) { setSel(d0.i, false); toggle(d0.i); }
    });
    gridHost.addEventListener("focusin", function (e) { var c = cellOf(e.target); if (c && +c.dataset.i !== sel) setSel(+c.dataset.i, false); });
    gridHost.addEventListener("contextmenu", function (e) { if (down) e.preventDefault(); });
    gridHost.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = cellOf(e.target); if (!c) return;
      var i = +c.dataset.i, nx = navTarget(e.key, i, w, w * hh);
      if (nx >= 0) { e.preventDefault(); if (nx !== i) setSel(nx, true); return; }
      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); if (!e.repeat) toggle(i); }
    });

    host.replaceChildren(h("div", { class: "pz-lo pz-lo-ed" },
      h("div", { class: "pz-lo-ed-dims" }, cw.el, ch.el),
      h("div", { class: "pz-lo-tools" }, sqBtn, randBtn, clearBtn),
      gridHost, info,
      h("p", { class: "pz-lo-tip faint", text: "Bấm vào ô để bật/tắt đèn của bàn đầu (đèn sáng = ô cần tắt). Bàn phải có ít nhất một đèn sáng và phải giải được; kết quả kiểm tra hiện ở khung bên cạnh." })));
    rebuild(); paint(); emit();
    return {
      getInput: function () { return { w: w, h: hh, v: v.slice() }; },
      destroy: function () { host.replaceChildren(); }
    };
  }

  P.boards = P.boards || {};
  P.boards.lightsout = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
