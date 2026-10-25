/* ui/boards/lightsoutx.js — bàn LIGHTS OUT BIẾN THỂ: lưới w×h với luật bấm tuỳ chọn (chữ thập, X, vua, mã, chữ thập dài), bàn quấn mép (xuyến), k mức (2: đèn bật/tắt; 3, 5: đèn nhiều mức), ô khoá.
   Hành động gửi cho engine (assets/js/puzzles/lightsoutx.js): {k:"press", i} — bấm ô i, cộng 1 (mod k) vào các ô của mẫu bấm. state.v[i] = mức 0…k−1; mục tiêu: mọi ô về 0. Ô khoá: isGiven, không bấm được.
   Đầu vào của trình soạn (type.fromInput): { w, h, rule, topo, k, holes:[chỉ số ô khoá], v:[w*h mức] }.
   Luật bấm KHÔNG nhân bản ở đây: bản xem trước lấy từ type.lib.effect(puzzle, i) — [[ô, số lần cộng]] (đã cuốn vòng khi xuyến, bỏ ô khoá, cộng dồn khi trùng).

   Hiển thị k mức: ô nền tối cố định; MỘT VÒNG k−1 CUNG, i cung sáng (hổ phách) = mức i, kèm CHỮ SỐ mức ở giữa — không chỉ dựa vào màu. k = 2 giữ đúng biểu tượng đèn của Lights Out (đĩa + tia).
   Ô khoá: nền sọc chéo + viền đứt, aria-disabled, không vào thứ tự Tab, bàn phím nhảy qua. Xuyến: khung viền ĐỨT + dòng chú thích "quấn mép"; xem trước tô cả ô ở mép đối diện.
   Bàn rộng (> 12 cột, chỉ bàn tự nhập): khung cuộn ngang, ô không nhỏ hơn 30 px (trang không tràn ngang).
   Bàn phím (focus trong lưới, roving tabindex): mũi tên di chuyển (bỏ qua ô khoá) · Home/End đầu/cuối hàng · PageUp/PageDown đầu/cuối cột · Space hoặc Enter = bấm ô.
   Chuột/cảm ứng: như Lights Out cổ điển — bấm = nhả trên đúng ô vừa nhấn; kéo > 10 px huỷ; rê chuột / focus bàn phím / GIỮ ≥ 300 ms trên cảm ứng ⇒ tô các ô sẽ đổi (kèm "+n").
   Đợt P7: công tắc kiểu gợi ý (Ít bấm nhất / Đuổi đèn — Đuổi đèn chỉ hiện khi luật chữ thập, có mép, không ô khoá, nhớ ở localStorage "puz:lox-hint"); chip "Par K lần bấm" ("≈" khi nhân quá lớn nên par là ước lượng). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var HOLD_MS = 300, MOVE_PX = 10, MIN_D = 2, MAX_D = 20, WIDE = 12;
  var NS = "http://www.w3.org/2000/svg";
  var RAYS = '<span class="pz-lo-lit" aria-hidden="true"></span><svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
    '<path class="rays" d="M50 5V16M50 84V95M5 50H16M84 50H95M74 26L81.8 18.2M74 74L81.8 81.8M26 74L18.2 81.8M26 26L18.2 18.2"/><circle class="core" cx="50" cy="50" r="21"/></svg>';
  var mqReduce = null;
  try { mqReduce = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : null; } catch (e) { mqReduce = null; }
  function reduced() { return !!(mqReduce && mqReduce.matches); }

  function toInt(x) { if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function clampD(x) { return Math.max(MIN_D, Math.min(MAX_D, x)); }
  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function rcText(w, i) { return "hàng " + (Math.floor(i / w) + 1) + ", cột " + (i % w + 1); }
  function cellOf(el) { return el && el.closest ? el.closest(".pz-lo-cell") : null; }
  function onFlipEnd(root0) { root0.addEventListener("animationend", function (e) { if (e.animationName === "pz-lo-flip") { var c = cellOf(e.target); if (c) c.classList.remove("flip"); } }); }
  function T() { return P.types.get("lightsoutx"); }
  function lib() { var t = T(); return t && t.lib ? t.lib : null; }

  /** Vòng k−1 cung (k > 2) + chữ số mức ở giữa. Mỗi cung là path; cung thứ j sáng khi mức > j. */
  function arcsHtml(k) {
    var n = k - 1, gap = 18, span = 360 / n, out = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g class="arcs">', j;
    for (j = 0; j < n; j++) {
      var a0 = (-90 + j * span + gap / 2) * Math.PI / 180, a1 = (-90 + (j + 1) * span - gap / 2) * Math.PI / 180, r = 40;
      var x0 = 50 + r * Math.cos(a0), y0 = 50 + r * Math.sin(a0), x1 = 50 + r * Math.cos(a1), y1 = 50 + r * Math.sin(a1);
      out += '<path class="seg" data-j="' + j + '" d="M' + x0.toFixed(2) + " " + y0.toFixed(2) + " A" + r + " " + r + " 0 " + (span - gap > 180 ? 1 : 0) + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2) + '"/>';
    }
    return out + '</g><text class="num" x="50" y="51" text-anchor="middle" dominant-baseline="central">0</text></svg>';
  }
  /** Dựng lưới w×h (role=grid > row > gridcell). */
  function buildGrid(spec, label, extraClass) {
    var w = spec.w, hh = spec.h, k = spec.k, holeSet = {}, i;
    spec.holes.forEach(function (q) { holeSet[q] = 1; });
    var tmpl = k === 2 ? RAYS : arcsHtml(k);
    var grid = h("div", { class: "pz-lo-grid pz-lox" + (k > 2 ? " pz-lox-multi" : "") + (spec.topo === "torus" ? " torus" : "") + (extraClass ? " " + extraClass : ""), role: "grid", "aria-label": label, "aria-rowcount": String(hh), "aria-colcount": String(w) }), cells = [];
    grid.style.setProperty("--w", String(w)); grid.style.setProperty("--h", String(hh));
    grid.style.setProperty("--gk", w >= 9 ? "0.7" : w >= 7 ? "1" : "1.3");
    for (var r = 0; r < hh; r++) {
      var row = h("div", { class: "pz-lo-row", role: "row", "aria-rowindex": String(r + 1) });
      for (var c = 0; c < w; c++) {
        i = r * w + c;
        var locked = !!holeSet[i], cell = h("div", { class: "pz-lo-cell" + (locked ? " lock" : ""), role: "gridcell", tabindex: "-1", "aria-colindex": String(c + 1), dataset: { i: String(i) }, html: locked ? "" : tmpl + '<span class="pz-lox-add" aria-hidden="true"></span>' });
        if (locked) cell.setAttribute("aria-disabled", "true");
        cells.push(cell); row.append(cell);
      }
      grid.append(row);
    }
    return { grid: grid, cells: cells };
  }
  function specOfPuzzle(puzzle) {
    var d = puzzle.data || {}, sz = puzzle.size || {};
    return { w: toInt(d.w != null ? d.w : sz.w) || 5, h: toInt(d.h != null ? d.h : sz.h) || 5, rule: d.rule || "cross", topo: d.topo || "flat", k: toInt(d.k) || 2, holes: Array.isArray(d.holes) ? d.holes.slice() : [] };
  }
  /** Bao lưới trong khung cuộn khi bàn rộng. */
  function wrap(grid, w) {
    if (w <= WIDE) return grid;
    grid.classList.add("pz-lox-wide");
    return h("div", { class: "pz-lox-scroll", tabindex: "-1" }, grid);
  }
  /** Ô đích khi bấm phím điều hướng (bỏ qua ô khoá); -1 nếu không phải phím điều hướng. */
  function navTarget(key, i, w, n, locked) {
    var rows = n / w, r = Math.floor(i / w), c = i % w, dr = 0, dc = 0;
    if (key === "ArrowRight") dc = 1; else if (key === "ArrowLeft") dc = -1; else if (key === "ArrowDown") dr = 1; else if (key === "ArrowUp") dr = -1;
    else if (key === "Home" || key === "End" || key === "PageUp" || key === "PageDown") {
      var line = [], q;
      if (key === "Home" || key === "End") { for (q = 0; q < w; q++) line.push(r * w + q); } else { for (q = 0; q < rows; q++) line.push(q * w + c); }
      if (key === "End" || key === "PageDown") line.reverse();
      for (q = 0; q < line.length; q++) if (!locked[line[q]]) return line[q];
      return i;
    } else return -1;
    var rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < rows && cc >= 0 && cc < w) { var j = rr * w + cc; if (!locked[j]) return j; rr += dr; cc += dc; }
    return i;
  }

  // ---- kiểu gợi ý: "min" = ít bấm nhất (mặc định), "chase" = đuổi đèn (chỉ khi luật cho phép)
  var HINT_KEY = "puz:lox-hint", HINT_STYLES = [
    { id: "min", label: "Ít bấm nhất", title: "Gợi ý ô thuộc lời giải ngắn nhất (tính bằng khử Gauss mod k)" },
    { id: "chase", label: "Đuổi đèn", title: "Gợi ý theo cách giải bằng tay: tắt từng hàng từ trên xuống, rồi tra bảng hàng cuối" }];
  function loadHintStyle() { try { var s = root.localStorage.getItem(HINT_KEY); return s === "chase" ? "chase" : "min"; } catch (e) { return "min"; } }
  function saveHintStyle(s) { try { root.localStorage.setItem(HINT_KEY, s); } catch (e) { /* cửa sổ riêng tư: chỉ không nhớ */ } }

  // =================================================================================================================== bàn chơi
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, ro = !!env.readOnly, L = lib();
    var spec = specOfPuzzle(puzzle), w = spec.w, hh = spec.h, N = w * hh, k = spec.k, KP = puzzle.data && puzzle.data.presses && puzzle.data.presses.length ? puzzle.data.presses.length : 0;
    var est = !!(puzzle.data && puzzle.data.exact === false), locked = {};
    spec.holes.forEach(function (q) { locked[q] = 1; });
    var shown = [], shownMk = [], shownLab = [], marks = {}, preview = [], focusI = 0, hover = -1, hold = -1, kbFocus = -1, down = null, holdTimer = 0, lastTouch = 0, offGame = null;
    for (focusI = 0; focusI < N && locked[focusI]; focusI++);
    if (focusI >= N) focusI = 0;

    // ---- khung
    var litB = h("b", { text: "0" }), movesB = h("b", { text: "0" });
    var specLabel = L ? L.specText(spec) : "";
    var stats = h("div", { class: "pz-lo-stats", role: "group", "aria-label": "Thông tin bàn" },
      h("span", { class: "pz-lo-stat pz-lox-spec", title: "Luật bấm, kiểu mép, số mức và ô khoá của bàn này" }, specLabel),
      h("span", { class: "pz-lo-stat", title: k === 2 ? "Số đèn đang sáng — tắt hết là thắng" : "Số ô chưa về mức 0 — đưa hết về 0 là thắng" }, litB, k === 2 ? " đèn sáng" : " ô khác 0"),
      h("span", { class: "pz-lo-stat", title: "Số lần bạn đã bấm" }, movesB, " lần bấm"),
      KP ? h("span", { class: "pz-lo-stat pz-lo-par", title: "Par = số lần bấm ít " + (est ? "nhất app tìm được (nhân quá lớn nên có thể còn cách ngắn hơn)" : "nhất có thể") + ". Đúng par: ★★★; hơn par không quá " + Math.ceil(KP / 4) + " lần: ★★; còn lại ★." }, "Par " + (est ? "≈ " : ""), h("b", { text: String(KP) }), " lần bấm") : null);
    var noteText = [spec.topo === "torus" ? "Quấn mép: ô ở rìa kề với ô ở rìa đối diện." : "", spec.holes.length ? "Ô sọc chéo là ô khoá: không bấm được, không bị ảnh hưởng." : "", k > 2 ? "Mỗi lần bấm cộng 1 vào các ô của mẫu; sau mức " + (k - 1) + " thì quay về 0." : ""].filter(Boolean).join(" ");
    var note = noteText ? h("p", { class: "pz-lox-note faint", text: noteText }) : null;
    var built = buildGrid(spec, "Bàn Lights Out biến thể " + w + " nhân " + hh + ", " + specLabel + ", bấm một ô để đổi các ô của mẫu bấm", ""), grid = built.grid, cells = built.cells;
    var style = loadHintStyle(), canChase = !!(L && L.chaseOk(spec)), swHost = ro || !canChase ? null : h("div", { class: "pz-lo-hintsw" });
    function drawSwitch() {
      if (!swHost) return;
      var chips = U.pz.chips(HINT_STYLES, style, function (id) {
        if (id === style) return;
        style = id; saveHintStyle(id); game.setSettings({ loHint: id }); drawSwitch();
        if (env.clearHint) env.clearHint();
        env.announce("Kiểu gợi ý: " + (id === "chase" ? "Đuổi đèn" : "Ít bấm nhất") + ".");
      }, "Kiểu gợi ý");
      swHost.replaceChildren(h("span", { class: "pz-lo-hintsw-lab", "aria-hidden": "true", text: "Kiểu gợi ý" }), chips);
    }
    if (!ro) { game.setSettings({ loHint: canChase ? style : "min" }); drawSwitch(); }
    host.replaceChildren(h("div", { class: "pz-lo pz-lox-root" }, stats, note, wrap(grid, w), swHost));

    // ---- vẽ
    function canAct() { return !ro && !game.finished(); }
    function paintCell(i, animate) {
      if (locked[i]) {
        var labL = type.describeCell(puzzle, game.state, i); if (shownLab[i] !== labL) { shownLab[i] = labL; cells[i].setAttribute("aria-label", labL); }
        return;
      }
      var el = cells[i], lv = game.state.v[i] | 0, mk = marks[i] || "";
      if (shown[i] !== lv) {
        var first = shown[i] === undefined; shown[i] = lv; el.classList.toggle("on", lv > 0);
        if (k > 2) {
          el.style.setProperty("--lvf", String(lv / (k - 1)));
          var segs = el.querySelectorAll(".seg"), q;
          for (q = 0; q < segs.length; q++) segs[q].classList.toggle("f", q < lv);
          var num = el.querySelector(".num"); if (num && num.textContent !== String(lv)) num.textContent = String(lv);
        }
        if (animate && !first && !reduced()) { el.classList.remove("flip"); void el.offsetWidth; el.classList.add("flip"); }
      }
      if (shownMk[i] !== mk) { shownMk[i] = mk; el.classList.toggle("hint", mk === "hint"); el.classList.toggle("replay", mk === "replay"); }
      var lab = type.describeCell(puzzle, game.state, i) + (mk === "hint" ? " — đang được gợi ý" : mk === "replay" ? " — ô vừa đổi ở bước này" : "");
      if (shownLab[i] !== lab) { shownLab[i] = lab; el.setAttribute("aria-label", lab); }
    }
    function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
    function updateHud() {
      var v = game.state.v, lit = 0, i, mv = game.counters.moves;
      for (i = 0; i < N; i++) if (v[i] && !locked[i]) lit++;
      setText(litB, String(lit)); setText(movesB, ro && !mv ? "–" : String(mv));
      var lk = !canAct();
      grid.classList.toggle("is-solved", lit === 0); grid.classList.toggle("is-locked", lk); grid.setAttribute("aria-readonly", String(lk));
    }
    function paintAll(animate) { for (var i = 0; i < N; i++) paintCell(i, animate); updateHud(); }
    function setFocusable(i) {
      if (locked[i] || (i === focusI && cells[i].getAttribute("tabindex") === "0")) return;
      cells[focusI].setAttribute("tabindex", "-1"); focusI = i; cells[i].setAttribute("tabindex", "0");
    }
    function clearPreview() { for (var q = 0; q < preview.length; q++) { var c = cells[preview[q]]; c.classList.remove("xp", "xp-c"); var a = c.querySelector(".pz-lox-add"); if (a) a.textContent = ""; } preview = []; }
    function setPreview(i) {
      clearPreview();
      if (i < 0 || !canAct() || locked[i] || !L) return;
      var eff = L.effect(puzzle, i);
      for (var q = 0; q < eff.length; q++) {
        var c = cells[eff[q][0]]; if (!c) continue;
        c.classList.add(eff[q][0] === i ? "xp-c" : "xp"); preview.push(eff[q][0]);
        var a = c.querySelector(".pz-lox-add"); if (a) a.textContent = k > 2 || eff[q][1] > 1 ? "+" + eff[q][1] : "";
      }
    }
    function refreshPreview() { setPreview(hold >= 0 ? hold : hover >= 0 ? hover : kbFocus); }

    // ---- thao tác
    function press(i) {
      if (!canAct() || locked[i]) return;
      var r = game.act({ k: "press", i: i });
      if (!r.ok) return;
      var lit = 0, v = game.state.v, q;
      for (q = 0; q < N; q++) if (v[q] && !locked[q]) lit++;
      env.announce("Đã bấm " + rcText(w, i) + ", đổi " + (r.diff ? r.diff.d.length : 0) + " ô. " + (lit ? "Còn " + lit + (k === 2 ? " đèn sáng." : " ô khác 0.") : "Đã về 0 hết!"));
    }
    function focusCell(i) { setFocusable(i); cells[i].focus({ preventScroll: true }); }
    function cancelDown() { clearTimeout(holdTimer); holdTimer = 0; down = null; if (hold >= 0) { hold = -1; refreshPreview(); } }

    // ---- sự kiện
    onFlipEnd(grid);
    grid.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return;
      var c = cellOf(e.target); if (!c || c.classList.contains("lock")) return;
      var i = +c.dataset.i;
      down = { id: e.pointerId, i: i, x: e.clientX, y: e.clientY, type: e.pointerType, moved: false };
      if (e.pointerType && e.pointerType !== "mouse") lastTouch = Date.now();
      clearTimeout(holdTimer);
      if (canAct() && e.pointerType !== "mouse") holdTimer = setTimeout(function () { holdTimer = 0; if (down) { hold = down.i; refreshPreview(); } }, HOLD_MS);
    });
    grid.addEventListener("pointermove", function (e) {
      if (!down || e.pointerId !== down.id || down.moved) return;
      if (Math.abs(e.clientX - down.x) > MOVE_PX || Math.abs(e.clientY - down.y) > MOVE_PX) { down.moved = true; clearTimeout(holdTimer); holdTimer = 0; if (hold >= 0) { hold = -1; refreshPreview(); } }
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
    grid.addEventListener("contextmenu", function (e) { if (down && down.type !== "mouse" || Date.now() - lastTouch < 1200) e.preventDefault(); });
    grid.addEventListener("pointerover", function (e) { if (e.pointerType !== "mouse") return; var c = cellOf(e.target); hover = c && !c.classList.contains("lock") ? +c.dataset.i : -1; refreshPreview(); });
    grid.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hover = -1; refreshPreview(); } });
    grid.addEventListener("focusin", function (e) {
      var c = cellOf(e.target); if (!c || c.classList.contains("lock")) return;
      var i = +c.dataset.i, vis = false; setFocusable(i);
      try { vis = c.matches(":focus-visible"); } catch (x) { vis = false; }
      kbFocus = vis ? i : -1; refreshPreview();
    });
    grid.addEventListener("focusout", function () { kbFocus = -1; refreshPreview(); });
    grid.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = cellOf(e.target); if (!c || c.classList.contains("lock")) return;
      var i = +c.dataset.i, nx = navTarget(e.key, i, w, N, locked);
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
    if (!locked[focusI]) cells[focusI].setAttribute("tabindex", "0");
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
  /** Trình soạn (màn Tạo puzzle): chọn rộng/cao 2–20, luật, mép, số mức; chế độ "Đặt mức" (bấm ô = tăng mức vòng) hoặc "Khoá ô" (bấm = khoá/mở khoá); "Bàn ngẫu nhiên" (luôn giải được);
      onChange({ w, h, rule, topo, k, holes, v }) — đúng dạng type.fromInput nhận. Bàn không giải được: tô nhóm ô bất biến (viền chấm) bằng type.lib.obstruction. */
  function editor(host, env) {
    var L = lib(), RULE_NAMES = L ? L.RULES : {}, st = { w: 5, h: 5, rule: "cross", topo: "flat", k: 2, holes: [], v: null }, mode = "level", cells = [], gridHost, info, obInfo, gridEl = null, sel = 0;
    var inp = env.input, pz = env.puzzle, src = null;
    function ruleOk(r) { return L && L.RULE_IDS.indexOf(r) >= 0 ? r : "cross"; }
    if (inp && typeof inp === "object" && (inp.w != null || inp.v != null)) {
      var iw = toInt(inp.w != null ? inp.w : inp.n), ih = toInt(inp.h != null ? inp.h : inp.n);
      if (iw != null) st.w = clampD(iw); st.h = ih != null ? clampD(ih) : st.w;
      st.rule = ruleOk(inp.rule); st.topo = inp.topo === "torus" ? "torus" : "flat"; st.k = toInt(inp.k) === 3 || toInt(inp.k) === 5 ? toInt(inp.k) : 2;
      st.holes = Array.isArray(inp.holes) ? inp.holes.filter(function (q) { return toInt(q) != null; }) : []; src = inp.v;
    } else if (pz && pz.initial && pz.initial.v) {
      var sp = specOfPuzzle(pz); st.w = clampD(sp.w); st.h = clampD(sp.h); st.rule = ruleOk(sp.rule); st.topo = sp.topo; st.k = sp.k; st.holes = sp.holes; src = pz.initial.v;
    }
    if (typeof src === "string") src = src.split("").map(function (c) { var n = Number(c); return isFinite(n) ? n : 0; });
    st.v = zeros(st.w * st.h);
    if (Array.isArray(src) && src.length === st.w * st.h) for (var q0 = 0; q0 < st.v.length; q0++) st.v[q0] = Math.max(0, Math.min(st.k - 1, src[q0] | 0));
    st.holes.forEach(function (q) { if (q >= 0 && q < st.v.length) st.v[q] = 0; });

    function isHole(i) { return st.holes.indexOf(i) >= 0; }
    function specNow() { return { w: st.w, h: st.h, rule: st.rule, topo: st.topo, k: st.k, holes: st.holes.slice() }; }
    function emit() { env.onChange({ w: st.w, h: st.h, rule: st.rule, topo: st.topo, k: st.k, holes: st.holes.slice(), v: st.v.slice() }); }
    function obstruction() { try { return L && st.holes.length < st.w * st.h ? L.obstruction(specNow(), st.v) : null; } catch (e) { return null; } }

    // ---- điều khiển
    function dimControl(labelText, key) {
      var sid = "pz-lox-" + key + "-" + Math.floor(Math.random() * 1e6).toString(36);
      var sel2 = h("select", { id: sid, "aria-label": labelText });
      for (var n = MIN_D; n <= MAX_D; n++) sel2.append(h("option", { value: String(n), text: String(n) }));
      var minus = h("button", { type: "button", class: "btn pz-lo-step", "aria-label": "Giảm " + labelText.toLowerCase(), title: "Giảm", html: icon("minus") });
      var plus = h("button", { type: "button", class: "btn pz-lo-step", "aria-label": "Tăng " + labelText.toLowerCase(), title: "Tăng", html: icon("plus") });
      function cur() { return key === "w" ? st.w : st.h; }
      function apply(n) { n = clampD(n); resize(key === "w" ? n : st.w, key === "h" ? n : st.h); }
      minus.addEventListener("click", function () { apply(cur() - 1); });
      plus.addEventListener("click", function () { apply(cur() + 1); });
      sel2.addEventListener("change", function () { apply(+sel2.value); });
      return { el: h("div", { class: "pz-lo-dim" }, h("label", { for: sid, text: labelText }), h("div", { class: "pz-lo-dim-row" }, minus, sel2, plus)), sync: function () { sel2.value = String(cur()); minus.disabled = cur() <= MIN_D; plus.disabled = cur() >= MAX_D; } };
    }
    var cw = dimControl("Chiều rộng", "w"), ch = dimControl("Chiều cao", "h");
    var ruleHost = h("div", { class: "pz-lox-opt" }), topoHost = h("div", { class: "pz-lox-opt" }), kHost = h("div", { class: "pz-lox-opt" }), modeHost = h("div", { class: "pz-lox-opt" });
    function optRow(label, chipsEl) { return h("div", { class: "pz-lox-optrow" }, h("span", { class: "pz-lo-hintsw-lab", text: label }), chipsEl); }
    function drawOpts() {
      ruleHost.replaceChildren(U.pz.chips(L ? L.RULE_IDS.map(function (id) { return { id: id, label: RULE_NAMES[id].name, title: RULE_NAMES[id].note }; }) : [], st.rule, function (id) { st.rule = id; drawOpts(); paint(); emit(); }, "Luật bấm"));
      topoHost.replaceChildren(U.pz.chips([{ id: "flat", label: "Có mép" }, { id: "torus", label: "Quấn mép", title: "Xuyến: rìa trái nối rìa phải, rìa trên nối rìa dưới" }], st.topo, function (id) { st.topo = id; drawOpts(); rebuild(); paint(); emit(); }, "Kiểu mép"));
      kHost.replaceChildren(U.pz.chips([{ id: "2", label: "2 (bật/tắt)" }, { id: "3", label: "3 mức" }, { id: "5", label: "5 mức" }], String(st.k), function (id) { st.k = +id; for (var i = 0; i < st.v.length; i++) st.v[i] = Math.min(st.v[i], st.k - 1); drawOpts(); rebuild(); paint(); emit(); }, "Số mức"));
      modeHost.replaceChildren(U.pz.chips([{ id: "level", label: "Đặt mức", title: "Bấm ô để đổi mức (vòng lại 0)" }, { id: "hole", label: "Khoá ô", title: "Bấm ô để khoá/mở khoá" }], mode, function (id) { mode = id; drawOpts(); }, "Chế độ bấm"));
    }
    var randBtn = h("button", { type: "button", class: "btn pz-lo-tool", title: "Bấm ngẫu nhiên vài ô từ bàn tắt hết — bàn nào ra cũng giải được", html: icon("dice") + "<span>Bàn ngẫu nhiên</span>" });
    randBtn.addEventListener("click", function () {
      var act = st.w * st.h - st.holes.length, m = Math.max(2, Math.round(act * (0.25 + Math.random() * 0.2)));
      var nv = L && act > 0 ? L.randomPresses(specNow(), m, Math.floor(Math.random() * 4294967295)) : null;
      if (nv && nv.some(function (x) { return x; })) { st.v = nv; paint(); emit(); }
    });
    var clearBtn = h("button", { type: "button", class: "btn pz-lo-tool", html: icon("eraser") + "<span>Về 0 hết</span>", title: "Đưa mọi ô về mức 0 (rồi đặt lại các ô bạn muốn)" });
    clearBtn.addEventListener("click", function () { st.v = zeros(st.w * st.h); paint(); emit(); });
    var unlockBtn = h("button", { type: "button", class: "btn pz-lo-tool", html: icon("eraser") + "<span>Mở hết ô khoá</span>", title: "Bỏ mọi ô khoá" });
    unlockBtn.addEventListener("click", function () { st.holes = []; paint(); emit(); });
    info = h("p", { class: "pz-lo-info", "aria-live": "polite" });
    obInfo = h("p", { class: "pz-lo-obinfo", "aria-live": "polite", hidden: true });
    gridHost = h("div", { class: "pz-lo-grid-host" });

    // ---- vẽ
    function setCell(i, lv, hole, inOb) {
      var el = cells[i];
      if (hole) { el.classList.add("lock"); el.classList.remove("on", "obst"); el.setAttribute("aria-disabled", "true"); el.setAttribute("aria-label", rcText(st.w, i) + ", ô khoá. Bấm (chế độ Khoá ô) để mở khoá."); return; }
      el.classList.remove("lock"); el.removeAttribute("aria-disabled");
      el.classList.toggle("on", lv > 0); el.classList.toggle("obst", !!inOb);
      if (st.k > 2) { el.style.setProperty("--lvf", String(lv / (st.k - 1))); var segs = el.querySelectorAll(".seg"); for (var q = 0; q < segs.length; q++) segs[q].classList.toggle("f", q < lv); var num = el.querySelector(".num"); if (num) num.textContent = String(lv); }
      el.setAttribute("aria-label", rcText(st.w, i).replace(/^h/, "H") + (st.k === 2 ? ", đèn " + (lv ? "bật" : "tắt") : ", mức " + lv + " trên " + (st.k - 1)) + (inOb ? ", thuộc nhóm bất biến" : "") + ". Bấm để " + (mode === "hole" ? "khoá/mở khoá" : "đổi mức") + ".");
    }
    function paint() {
      var n = st.w * st.h, lit = 0, k2, ob = obstruction(), inOb = {};
      if (ob) ob.cells.forEach(function (i) { inOb[i] = 1; });
      for (k2 = 0; k2 < n; k2++) { var hole = isHole(k2); if (!hole && st.v[k2]) lit++; setCell(k2, st.v[k2], hole, inOb[k2]); }
      info.textContent = (lit ? lit + " trên " + (n - st.holes.length) + " ô đang khác 0." : "Chưa có ô nào khác 0 — hãy đặt ít nhất một ô.") + " Bàn " + st.w + "×" + st.h + (L ? " · " + L.specText(specNow()) : "") + ".";
      obInfo.hidden = !ob; obInfo.textContent = ob ? "Không giải được: nhóm " + ob.size + " ô viền chấm đỏ — " + ob.text : "";
      unlockBtn.hidden = !st.holes.length;
      cw.sync(); ch.sync();
    }
    function rebuild() {
      var b = buildGrid({ w: st.w, h: st.h, rule: st.rule, topo: st.topo, k: st.k, holes: st.holes }, "Bàn Lights Out biến thể " + st.w + " nhân " + st.h + " đang soạn", "pz-lo-ed-grid");
      gridEl = b.grid; cells = b.cells; if (sel >= cells.length) sel = 0;
      cells[sel].setAttribute("tabindex", "0");
      gridHost.replaceChildren(wrap(gridEl, st.w));
    }
    function resize(nw, nh) {
      nw = clampD(nw); nh = clampD(nh);
      if (nw === st.w && nh === st.h) { cw.sync(); ch.sync(); return; }
      var nv = zeros(nw * nh), r, c, nholes = [];
      for (r = 0; r < Math.min(st.h, nh); r++) for (c = 0; c < Math.min(st.w, nw); c++) { nv[r * nw + c] = st.v[r * st.w + c]; if (isHole(r * st.w + c)) nholes.push(r * nw + c); }
      st.w = nw; st.h = nh; st.v = nv; st.holes = nholes.sort(function (a, b) { return a - b; }); rebuild(); paint(); emit();
    }
    function toggle(i) {
      if (mode === "hole") {
        var at = st.holes.indexOf(i);
        if (at >= 0) st.holes.splice(at, 1); else { if (st.holes.length >= st.w * st.h - 1) return; st.holes.push(i); st.holes.sort(function (a, b) { return a - b; }); st.v[i] = 0; }
        rebuild(); paint(); emit(); return;
      }
      if (isHole(i)) return;
      st.v[i] = (st.v[i] + 1) % st.k;
      var el = cells[i]; el.classList.remove("flip"); if (!reduced()) { void el.offsetWidth; el.classList.add("flip"); }
      paint(); emit();
    }
    function setSel(i, focus) { cells[sel].setAttribute("tabindex", "-1"); sel = i; cells[i].setAttribute("tabindex", "0"); if (focus) cells[i].focus({ preventScroll: true }); }
    function lockedMap() { var m = {}; st.holes.forEach(function (q) { m[q] = 1; }); return mode === "hole" ? {} : m; }

    // ---- sự kiện
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
      if (c && +c.dataset.i === d0.i) { if (!c.classList.contains("lock") || mode === "hole") setSel(d0.i, false); toggle(d0.i); }
    });
    gridHost.addEventListener("focusin", function (e) { var c = cellOf(e.target); if (c && +c.dataset.i !== sel) setSel(+c.dataset.i, false); });
    gridHost.addEventListener("contextmenu", function (e) { if (down) e.preventDefault(); });
    gridHost.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = cellOf(e.target); if (!c) return;
      var i = +c.dataset.i, nx = navTarget(e.key, i, st.w, st.w * st.h, lockedMap());
      if (nx >= 0) { e.preventDefault(); if (nx !== i) setSel(nx, true); return; }
      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); if (!e.repeat) toggle(i); }
    });

    host.replaceChildren(h("div", { class: "pz-lo pz-lo-ed pz-lox-ed" },
      h("div", { class: "pz-lo-ed-dims" }, cw.el, ch.el),
      optRow("Luật bấm", ruleHost), optRow("Mép bàn", topoHost), optRow("Số mức", kHost), optRow("Khi bấm ô", modeHost),
      h("div", { class: "pz-lo-tools" }, randBtn, clearBtn, unlockBtn),
      gridHost, info, obInfo,
      h("p", { class: "pz-lo-tip faint", text: "Chế độ \"Đặt mức\": bấm ô để tăng mức (vòng lại 0 — mức > 0 là ô cần xử lý). Chế độ \"Khoá ô\": bấm để khoá/mở khoá ô. Bàn phải có ít nhất một ô khác 0 và phải giải được; kết quả kiểm tra hiện ở khung bên cạnh. Bàn tới 20×20 (cuộn ngang nếu rộng)." })));
    drawOpts(); rebuild(); paint(); emit();
    return {
      getInput: function () { return { w: st.w, h: st.h, rule: st.rule, topo: st.topo, k: st.k, holes: st.holes.slice(), v: st.v.slice() }; },
      destroy: function () { host.replaceChildren(); }
    };
  }

  P.boards = P.boards || {};
  P.boards.lightsoutx = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
