/* ui/boards/nonogram.js — bàn Nonogram w×h (2–25): lưới ô, số manh mối hàng ở bên TRÁI và cột ở phía TRÊN (đóng băng khi cuộn), dụng cụ Tô / Gạch / Xoá,
   kéo ngón tay/chuột thành MỘT nét thẳng (khoá theo hàng hoặc cột đầu tiên kéo) gửi một action duy nhất → một lần hoàn tác lùi cả nét.
   Hành động gửi cho engine (assets/js/puzzles/nonogram.js): {k:"fill", cells:[i…], val:0|1|2} · {k:"clearline", axis:"r"|"c", idx}. state.v: 0 chưa biết · 1 tô · 2 gạch.
   Bàn phím (focus trong lưới): mũi tên di chuyển (Home/End về đầu/cuối hàng) · Space/Enter áp dụng dụng cụ · X gạch · F tô · Delete/Backspace/0 xoá.
   Cảm ứng: lưới có touch-action:none để kéo tô; BÀN LỚN cuộn bằng hai ngón (tự xử lý ở đây), hoặc kéo một ngón trên vùng manh mối / thanh cuộn; nút − Vừa + đổi cỡ ô.
   Trạng thái GIAO DIỆN (ô đang chọn, dụng cụ, cỡ ô, nét đang kéo) nằm ở đây; mọi nội dung bàn đi qua game.act nên hoàn tác/đếm lỗi/tự lưu/giải xong chạy tự động.
   Trình soạn (editor): "Vẽ ảnh" (phát {w,h,image}) và "Nhập manh mối" (phát {w,h,rows,cols}). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var MINN = 2, MAXN = 25, CELL_MIN = 12, CELL_MAX = 72, FIT_MAX = 64;

  /* ===================================================================================================== */
  /*  Phần dùng chung: khung bàn (lưới + manh mối dính + cuộn + cỡ ô + cuộn hai ngón)                         */
  /* ===================================================================================================== */
  function centroid(pts) { var k, n = 0, x = 0, y = 0; for (k in pts) { n++; x += pts[k].x; y += pts[k].y; } return n ? { x: x / n, y: y / n } : { x: 0, y: 0 }; }
  /** Tổ tiên gần nhất cuộn được theo chiều dọc (vỏ app cuộn ở .pane-main chứ không phải cửa sổ). */
  function scrollParent(el) {
    for (var p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
      var o = root.getComputedStyle(p).overflowY;
      if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return null;
  }

  /** Khung bàn: lưới W×H ô + vùng manh mối + vùng cuộn. label: chữ cho aria. */
  function makeFrame(W, H, label) {
    var f = { W: W, H: H, c: 28, auto: true, cells: [], rowEl: [], colEl: [], floor: Math.max(W, H) <= 15 ? 14 : 18, onLayout: null, touch: { pts: {}, n: 0, pan: false, cx: 0, cy: 0 }, ro: null, lastW: 0 };
    var i, r, c, cell, frag = doc.createDocumentFragment();
    f.gridEl = h("div", { class: "pz-ng-grid", role: "grid", "aria-label": label, "aria-rowcount": String(H), "aria-colcount": String(W) });
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      i = r * W + c;
      cell = h("div", { class: "pz-ng-cell", role: "gridcell", tabindex: "-1", "aria-rowindex": String(r + 1), "aria-colindex": String(c + 1), dataset: { i: String(i) } });
      f.cells.push(cell); frag.append(cell);
    }
    f.gridEl.append(frag);
    f.rowsEl = h("div", { class: "pz-ng-rows" });
    f.colsEl = h("div", { class: "pz-ng-cols" });
    f.corner = h("div", { class: "pz-ng-corner", "aria-hidden": "true" });
    f.board = h("div", { class: "pz-ng-board" }, h("div", { class: "pz-ng-top" }, f.corner, f.colsEl), h("div", { class: "pz-ng-body" }, f.rowsEl, f.gridEl));
    f.board.style.setProperty("--w", String(W));
    f.scroll = h("div", { class: "pz-ng-scroll", tabindex: "0", role: "region", "aria-label": label + " cùng manh mối (vùng cuộn được)" }, f.board);
    f.tip = h("p", { class: "pz-ng-tip faint", hidden: true, text: "Bàn lớn: cuộn bằng hai ngón (hoặc thanh cuộn, hoặc kéo một ngón trên vùng manh mối). Nút − Vừa + đổi cỡ ô." });
    f.root = h("div", { class: "pz-ng-frame" }, f.scroll, f.tip);

    /** Dựng manh mối: rows (H mảng số), cols (W mảng số). Giữ nguyên tham chiếu f.rowEl/f.colEl để tô trạng thái. */
    f.setClues = function (rows, cols) {
      var k, j, e, nums, kids;
      f.rowsEl.replaceChildren(); f.colsEl.replaceChildren(); f.rowEl = []; f.colEl = [];
      function build(list, axis, n, parent, arr) {
        for (k = 0; k < n; k++) {
          nums = list && list[k] || []; kids = [];
          if (!nums.length) kids.push(h("span", { class: "n z", "aria-hidden": "true", text: "0" }));
          for (j = 0; j < nums.length; j++) kids.push(h("span", { class: "n", "aria-hidden": "true", text: String(nums[j]) }));
          e = h("div", { class: "pz-ng-clue " + axis + (k % 5 === 4 && k < n - 1 ? (axis === "r" ? " by" : " bx") : ""), role: "group" }, kids);
          e._base = e.className; e._cls = null; e._nums = nums;
          parent.append(e); arr.push(e);
        }
      }
      build(rows, "r", H, f.rowsEl, f.rowEl);
      build(cols, "c", W, f.colsEl, f.colEl);
      f.layout();
    };
    f.layout = function () {
      f.board.style.setProperty("--rw", f.rowsEl.offsetWidth + "px");
      var sc = f.scroll; f.tip.hidden = !(sc.scrollWidth > sc.clientWidth + 1 || sc.scrollHeight > sc.clientHeight + 1);
      if (f.onLayout) f.onLayout();
    };
    f.setPx = function (px, quick) { f.c = px; f.board.style.setProperty("--c", px + "px"); if (!quick) f.layout(); };
    /** Cỡ ô lớn nhất (≤ FIT_MAX) mà cả manh mối + lưới còn vừa bề rộng khung; không bé hơn f.floor (bé hơn thì cuộn). */
    f.fit = function () {
      var host = f.root.parentNode, avail, a = f.floor, b = FIT_MAX, best = f.floor, mid, tries;
      if (!host) return;
      avail = host.clientWidth - 2;
      if (avail <= 0) return;
      while (a <= b) { mid = (a + b) >> 1; f.setPx(mid, true); if (f.rowsEl.offsetWidth + W * mid <= avail) { best = mid; a = mid + 1; } else b = mid - 1; }
      f.setPx(best);
      for (tries = 0; tries < 3 && best > f.floor && f.scroll.scrollWidth > f.scroll.clientWidth + 1; tries++) { best--; f.setPx(best); }
      f.auto = true;
    };
    f.zoom = function (dir) {
      var sc = f.scroll, fx = sc.scrollWidth ? (sc.scrollLeft + sc.clientWidth / 2) / sc.scrollWidth : 0, fy = sc.scrollHeight ? (sc.scrollTop + sc.clientHeight / 2) / sc.scrollHeight : 0, n;
      n = dir > 0 ? Math.max(f.c + 2, Math.round(f.c * 1.2)) : Math.min(f.c - 2, Math.round(f.c / 1.2));
      n = Math.max(CELL_MIN, Math.min(CELL_MAX, n));
      if (n === f.c) return false;
      f.auto = false; f.setPx(n);
      sc.scrollLeft = fx * sc.scrollWidth - sc.clientWidth / 2; sc.scrollTop = fy * sc.scrollHeight - sc.clientHeight / 2;
      return true;
    };
    /** Theo dõi bề rộng của phần tử cha (KHÔNG theo vùng cuộn: thanh cuộn dọc hiện/ẩn làm vùng cuộn đổi bề rộng → vòng lặp). */
    f.watch = function (target) {
      f.lastW = target.clientWidth;
      if (root.ResizeObserver) {
        f.ro = new root.ResizeObserver(function () { var w = target.clientWidth; if (w !== f.lastW) { f.lastW = w; if (f.auto) f.fit(); else f.layout(); } });
        f.ro.observe(target);
      }
    };
    f.destroy = function () { if (f.ro) { f.ro.disconnect(); f.ro = null; } };

    /** Ô dưới điểm (x,y) màn hình. clamp=false → −1 nếu ngoài lưới. Ô vuông đúng f.c px, không viền ngoài → phép chia chính xác. */
    f.at = function (x, y, clamp) {
      var rc = f.gridEl.getBoundingClientRect(), col, row;
      if (!rc.width || !rc.height) return -1;
      col = Math.floor((x - rc.left) / (rc.width / W)); row = Math.floor((y - rc.top) / (rc.height / H));
      if (col < 0 || col >= W || row < 0 || row >= H) {
        if (!clamp) return -1;
        col = Math.max(0, Math.min(W - 1, col)); row = Math.max(0, Math.min(H - 1, row));
      }
      return row * W + col;
    };
    /** Kéo gần mép vùng cuộn → cuộn theo (bàn lớn). */
    f.edge = function (x, y) {
      var sc = f.scroll, rc = sc.getBoundingClientRect(), m = 26, sp = 16, rw = f.rowsEl.offsetWidth, chh = f.colsEl.offsetHeight;
      if (sc.scrollWidth > sc.clientWidth + 1) { if (x > rc.right - m) sc.scrollLeft += sp; else if (x < rc.left + rw + m) sc.scrollLeft -= sp; }
      if (sc.scrollHeight > sc.clientHeight + 1) { if (y > rc.bottom - m) sc.scrollTop += sp; else if (y < rc.top + chh + m) sc.scrollTop -= sp; }
    };
    /** Đưa ô i vào vùng nhìn thấy (trừ phần manh mối đóng băng). */
    f.reveal = function (i) {
      var sc = f.scroll, cp = f.c, rw = f.rowsEl.offsetWidth, chh = f.colsEl.offsetHeight, rr = Math.floor(i / W), cc = i - rr * W, left = rw + cc * cp, top = chh + rr * cp;
      if (left - rw < sc.scrollLeft) sc.scrollLeft = left - rw; else if (left + cp > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = left + cp - sc.clientWidth;
      if (top - chh < sc.scrollTop) sc.scrollTop = top - chh; else if (top + cp > sc.scrollTop + sc.clientHeight) sc.scrollTop = top + cp - sc.clientHeight;
    };

    /* ---- cuộn bằng hai ngón (vì lưới có touch-action:none nên trình duyệt không tự cuộn): gọi tDown/tMove/tUp từ các handler của lưới */
    f.tDown = function (e) {
      var t = f.touch;
      if (e.pointerType !== "touch") return false;
      if (!t.pts[e.pointerId]) t.n++;
      t.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (t.n >= 2) { if (!t.pan) { var cc = centroid(t.pts); t.pan = true; t.cx = cc.x; t.cy = cc.y; } return true; }
      return false;
    };
    f.tMove = function (e) {
      var t = f.touch, cc, dx, dy, sc = f.scroll, bx, by, rem, sp;
      if (e.pointerType !== "touch" || !t.pts[e.pointerId]) return false;
      t.pts[e.pointerId].x = e.clientX; t.pts[e.pointerId].y = e.clientY;
      if (!t.pan) return false;
      cc = centroid(t.pts); dx = t.cx - cc.x; dy = t.cy - cc.y; t.cx = cc.x; t.cy = cc.y;
      bx = sc.scrollLeft; by = sc.scrollTop;
      sc.scrollLeft += dx; sc.scrollTop += dy;
      rem = dy - (sc.scrollTop - by);
      if (Math.abs(rem) > 0.5) { sp = scrollParent(sc); if (sp) sp.scrollTop += rem; else if (root.scrollBy) root.scrollBy(0, rem); }
      return true;
    };
    f.tUp = function (e) {
      var t = f.touch;
      if (t.pts[e.pointerId]) { delete t.pts[e.pointerId]; t.n--; }
      if (t.n < 2) t.pan = false;
    };
    return f;
  }

  /** Bao các ô của một nét: từ ô s tới ô j theo trục axis ("r" ngang giữ nguyên hàng của s, "c" dọc giữ nguyên cột của s). */
  function segCells(W, s, j, axis) {
    var out = [], r0 = Math.floor(s / W), c0 = s - r0 * W, r1 = Math.floor(j / W), c1 = j - r1 * W, k, a, b;
    if (axis === "r") { a = Math.min(c0, c1); b = Math.max(c0, c1); for (k = a; k <= b; k++) out.push(r0 * W + k); }
    else if (axis === "c") { a = Math.min(r0, r1); b = Math.max(r0, r1); for (k = a; k <= b; k++) out.push(k * W + c0); }
    else out.push(s);
    return out;
  }

  /** Dòng dài n, clue B, ô đã biết L(0/1/2) (hàm chỉ số): còn cách xếp hợp lệ nào không? (cùng định nghĩa "vi phạm chắc chắn" với engine). */
  function lineFeasible(B, get, n) {
    var k = B.length, ones = [0], twos = [0], i, memo = {};
    for (i = 0; i < n; i++) { ones.push(ones[i] + (get(i) === 1 ? 1 : 0)); twos.push(twos[i] + (get(i) === 2 ? 1 : 0)); }
    function go(j, p) {
      var key = j * 64 + p, b, res = false, s, e;
      if (j === k) return ones[n] - ones[p] === 0;
      if (memo[key] !== undefined) return memo[key];
      b = B[j];
      for (s = p; s + b <= n && !res; s++) {
        if (ones[s] - ones[p] > 0) break;               // các ô bỏ qua [p,s) chứa ô tô → không thể bỏ thêm nữa
        e = s + b;
        if (twos[e] - twos[s] > 0) continue;            // khối đè lên ô gạch
        if (e < n && get(e) === 1) continue;            // ô ngay sau khối phải trống
        res = go(j + 1, e < n ? e + 1 : n);
      }
      memo[key] = res;
      return res;
    }
    return go(0, 0);
  }

  function clueWords(nums) { return nums.length ? nums.join(" ") : "trống"; }

  /* ===================================================================================================== */
  /*  BÀN CHƠI                                                                                              */
  /* ===================================================================================================== */
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, ro = !!env.readOnly;
    var D = puzzle.data, W = D.w, H = D.h, N = W * H;
    var frame = makeFrame(W, H, "Lưới Nonogram " + W + " nhân " + H), cells = frame.cells, gridEl = frame.gridEl;
    var sel = -1, tabAt = 0, tool = 1, marks = {}, hlRows = {}, hlCols = {}, pv = {}, pvVal = 0, cf = {}, cfRows = [], cfCols = [], cache = [], lastV = [], stroke = null, offGame = null, popTimer = 0, i, r, c;
    var toolBtns = {}, lineBtns = {}, wrap, bar;
    var selR = function () { return sel >= 0 ? Math.floor(sel / W) : -1; }, selC = function () { return sel >= 0 ? sel % W : -1; };
    function locked() { return ro || game.finished(); }
    function sett() { try { return env.settings() || {}; } catch (e) { return {}; } }

    frame.setClues(D.rows, D.cols);

    // ---- thanh dụng cụ
    function toolBtn(val, label, sw, title) {
      var b = h("button", { type: "button", class: "btn pz-ng-tool", "aria-pressed": String(val === tool), title: title }, sw, h("span", { text: label }));
      b.addEventListener("click", function () { setTool(val); });
      toolBtns[val] = b; return b;
    }
    function setTool(v) {
      tool = v;
      for (var k in toolBtns) toolBtns[k].setAttribute("aria-pressed", String(+k === v));
      env.announce("Dụng cụ: " + (v === 1 ? "Tô" : v === 2 ? "Gạch" : "Xoá"));
    }
    function lineBtn(axis, label) {
      var b = h("button", { type: "button", class: "btn pz-ng-line", disabled: true, text: label });
      b.addEventListener("click", function () {
        if (sel < 0 || locked()) return;
        var idx = axis === "r" ? selR() : selC(), res = game.act({ k: "clearline", axis: axis, idx: idx });
        if (res.ok) env.announce(res.diff.label);
      });
      lineBtns[axis] = b; return b;
    }
    var zoomOut = h("button", { type: "button", class: "btn pz-ng-z", "aria-label": "Thu nhỏ ô", title: "Thu nhỏ ô", html: icon("minus") });
    var zoomFit = h("button", { type: "button", class: "btn pz-ng-z", "aria-label": "Vừa khung", title: "Cỡ ô vừa khung", text: "Vừa" });
    var zoomIn = h("button", { type: "button", class: "btn pz-ng-z", "aria-label": "Phóng to ô", title: "Phóng to ô", html: icon("plus") });
    zoomOut.addEventListener("click", function () { frame.zoom(-1); });
    zoomIn.addEventListener("click", function () { frame.zoom(1); });
    zoomFit.addEventListener("click", function () { frame.fit(); });
    var zoomBox = h("div", { class: "pz-ng-group pz-ng-zoom", role: "group", "aria-label": "Cỡ ô" }, zoomOut, zoomFit, zoomIn);
    var toolsBox = null, linesBox = null;
    if (!ro) {
      toolsBox = h("div", { class: "pz-ng-group pz-ng-tools", role: "group", "aria-label": "Dụng cụ" },
        toolBtn(1, "Tô", h("span", { class: "pz-ng-sw f", "aria-hidden": "true" }), "Tô ô (F)"),
        toolBtn(2, "Gạch", h("span", { class: "pz-ng-sw x", "aria-hidden": "true" }), "Gạch ô — đánh dấu ô trống (X)"),
        toolBtn(0, "Xoá", h("span", { class: "pz-ng-sw e", "aria-hidden": "true", html: icon("eraser") }), "Xoá dấu (Delete)"));
      linesBox = h("div", { class: "pz-ng-group pz-ng-lines", role: "group", "aria-label": "Xoá cả dòng" }, lineBtn("r", "Xoá hàng"), lineBtn("c", "Xoá cột"));
    }
    bar = h("div", { class: "pz-ng-bar" }, toolsBox, linesBox, zoomBox);
    wrap = h("div", { class: "pz-ng" + (ro ? " ro" : "") }, frame.root, bar);
    host.replaceChildren(wrap);

    // ---- vẽ
    function cellCls(i, v) {
      var rr = Math.floor(i / W), cc = i - rr * W, cls = "pz-ng-cell", fin = game.finished();
      if (cc % 5 === 4 && cc < W - 1) cls += " bx";
      if (rr % 5 === 4 && rr < H - 1) cls += " by";
      if (v === 1) cls += " f"; else if (v === 2) cls += " x";
      if (i === sel) cls += " sel"; else if (sel >= 0 && !fin && (rr === selR() || cc === selC())) cls += " pr";
      if (cf[i]) cls += " cf";
      if (marks[i]) cls += " " + marks[i];
      if (pv[i]) cls += " pv" + pvVal;
      return cls;
    }
    function paintCell(i) {
      var el = cells[i], v = game.state.v[i], cls = cellCls(i, v);
      if (cache[i] !== cls) { el.className = cls; cache[i] = cls; }
      if (lastV[i] !== v) { lastV[i] = v; el.setAttribute("aria-label", type.describeCell(puzzle, game.state, i)); }
    }
    /** Dòng (axis,idx) đã đủ khối? Ô gạch và ô chưa biết đều tính là trống (đúng định nghĩa của engine). Dòng trống "0": chỉ mờ khi mọi ô đã gạch. */
    function lineDone(axis, idx) {
      var B = axis === "r" ? D.rows[idx] : D.cols[idx], n = axis === "r" ? W : H, base = axis === "r" ? idx * W : idx, stride = axis === "r" ? 1 : W, v = game.state.v, run = 0, k = 0, marked = 0, x, t;
      for (t = 0; t <= n; t++) {
        x = t < n ? v[base + t * stride] : 0;
        if (x === 2) marked++;
        if (x === 1) run++;
        else if (run) { if (k >= B.length || B[k] !== run) return false; k++; run = 0; }
      }
      return k === B.length && (B.length > 0 || marked === n);
    }
    function paintClue(e, axis, idx, done, bad) {
      var on = sel >= 0 && !game.finished() && (axis === "r" ? idx === selR() : idx === selC()), hl = (axis === "r" ? hlRows[idx] : hlCols[idx]) || "", cls, lab;
      cls = e._base + (done ? " done" : "") + (bad ? " cf" : "") + (on ? " on" : "") + (hl ? " hl-" + hl : "");
      if (e._cls === cls) return;
      e._cls = cls; e.className = cls;
      lab = "Manh mối " + (axis === "r" ? "hàng " : "cột ") + (idx + 1) + ": " + clueWords(e._nums) + (done ? ", đã khớp" : "") + (bad ? ", đang sai" : "");
      e.setAttribute("aria-label", lab);
    }
    function paintClues() {
      var fin = game.finished(), k;
      for (k = 0; k < H; k++) paintClue(frame.rowEl[k], "r", k, fin || lineDone("r", k), !!cfRows[k]);
      for (k = 0; k < W; k++) paintClue(frame.colEl[k], "c", k, fin || lineDone("c", k), !!cfCols[k]);
    }
    /** Tính lại ô xung đột (theo engine) và dòng vi phạm chắc chắn (chỉ xét các dòng chứa ô xung đột). Trả {ô: 1} của lượt trước để so sánh. */
    function computeConflicts() {
      var old = cf, list = [], next = {}, k, line, cand;
      if (sett().showConflicts && !game.finished()) { try { list = type.check(puzzle, game.state).conflicts; } catch (e) { list = []; } }
      for (k = 0; k < list.length; k++) next[list[k]] = 1;
      cf = next; cfRows = []; cfCols = [];
      if (list.length) {
        var rs = {}, cs = {}, v = game.state.v;
        for (k = 0; k < list.length; k++) { rs[Math.floor(list[k] / W)] = 1; cs[list[k] % W] = 1; }
        for (line in rs) (function (rr) { cfRows[rr] = !lineFeasible(D.rows[rr], function (t) { return v[rr * W + t]; }, W); })(+line);
        for (line in cs) (function (cc) { cfCols[cc] = !lineFeasible(D.cols[cc], function (t) { return v[t * W + cc]; }, H); })(+line);
      }
      return old;
    }
    function paintAll() {
      var k;
      computeConflicts();
      for (k = 0; k < N; k++) paintCell(k);
      paintClues(); setBar();
      wrap.classList.toggle("done", game.finished());
    }
    function repaintLines(rr, cc) {
      var k;
      if (rr >= 0) for (k = 0; k < W; k++) paintCell(rr * W + k);
      if (cc >= 0) for (k = 0; k < H; k++) paintCell(k * W + cc);
    }
    function setBar() {
      var lk = locked(), k;
      for (k in toolBtns) toolBtns[k].disabled = lk;
      if (lineBtns.r) {
        lineBtns.r.disabled = lk || sel < 0; lineBtns.c.disabled = lk || sel < 0;
        lineBtns.r.setAttribute("aria-label", sel < 0 ? "Xoá hàng (chọn một ô trước)" : "Xoá hàng " + (selR() + 1)); lineBtns.c.setAttribute("aria-label", sel < 0 ? "Xoá cột (chọn một ô trước)" : "Xoá cột " + (selC() + 1));
      }
    }

    // ---- chọn ô
    function select(i, focus, quiet) {
      var oldR = selR(), oldC = selC(), old = sel;
      sel = i;
      repaintLines(oldR, oldC); repaintLines(selR(), selC());
      if (old >= 0 && cells[old]) cells[old].setAttribute("aria-selected", "false");
      if (i >= 0) { cells[i].setAttribute("aria-selected", "true"); setTab(i); }
      paintClues(); setBar();
      if (focus && i >= 0) { cells[i].focus({ preventScroll: true }); frame.reveal(i); }
      if (!quiet && i >= 0) env.announce(type.describeCell(puzzle, game.state, i));
    }
    function setTab(i) { if (cells[tabAt]) cells[tabAt].setAttribute("tabindex", "-1"); tabAt = i; cells[i].setAttribute("tabindex", "0"); }

    // ---- gửi action
    function doFill(list, val) {
      var res = game.act({ k: "fill", cells: list, val: val });
      if (res.ok) {
        env.announce(res.diff.label + (res.mistakes ? ". Có ô không đúng với lời giải." : ""));
      }
      return res;
    }
    function applyAt(i, base) {
      if (locked()) return;
      var cur = game.state.v[i];
      doFill([i], base !== 0 && cur === base ? 0 : base);
    }

    // ---- nét kéo (xem trước chỉ cập nhật các ô đổi)
    function setPreview(list, val) {
      var next = {}, old = pv, k;
      for (k = 0; k < list.length; k++) next[list[k]] = 1;
      pv = next; pvVal = val;
      for (k in old) if (!next[k]) paintCell(+k);
      for (k in next) if (!old[k]) paintCell(+k);
    }
    function cancelStroke() { if (stroke) { stroke = null; setPreview([], 0); } }
    function updateStroke(e) {
      var s = stroke.start, j = frame.at(e.clientX, e.clientY, true), rs, rj, cs, cj;
      if (j < 0) return;
      if (!stroke.axis && j !== s) {
        rs = Math.floor(s / W); rj = Math.floor(j / W); cs = s - rs * W; cj = j - rj * W;
        stroke.axis = rj === rs ? "r" : cj === cs ? "c" : Math.abs(e.clientX - stroke.x0) >= Math.abs(e.clientY - stroke.y0) ? "r" : "c";
      }
      stroke.cells = segCells(W, s, j, stroke.axis);
      setPreview(stroke.cells, stroke.val);
      frame.edge(e.clientX, e.clientY);
    }
    gridEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    gridEl.addEventListener("pointerdown", function (e) {
      var i, base, cur;
      if (frame.tDown(e)) { cancelStroke(); e.preventDefault(); return; }
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
      i = frame.at(e.clientX, e.clientY, false);
      if (i < 0) return;
      if (locked()) { select(i, true, false); return; }
      base = e.button === 2 ? 2 : tool; cur = game.state.v[i];
      stroke = { start: i, axis: null, val: base !== 0 && cur === base ? 0 : base, cells: [i], pid: e.pointerId, x0: e.clientX, y0: e.clientY };
      try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* không bắt buộc */ }
      setPreview(stroke.cells, stroke.val);
      select(i, true, true);
      e.preventDefault();
    });
    gridEl.addEventListener("pointermove", function (e) {
      if (frame.tMove(e)) { e.preventDefault(); return; }
      if (!stroke || e.pointerId !== stroke.pid) return;
      updateStroke(e);
    });
    function endStroke(e, commit) {
      frame.tUp(e);
      if (!stroke || e.pointerId !== stroke.pid) return;
      var s = stroke, list, last;
      if (commit) updateStroke(e);
      list = stroke.cells; last = list[list.length - 1]; stroke = null;
      setPreview([], 0);
      if (!commit) return;
      doFill(list, s.val);
      select(last, true, true);
    }
    gridEl.addEventListener("pointerup", function (e) { endStroke(e, true); });
    gridEl.addEventListener("pointercancel", function (e) { endStroke(e, false); });

    // ---- bàn phím
    gridEl.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var el = e.target.closest ? e.target.closest(".pz-ng-cell") : null, i, rr, cc, nx = -1;
      if (!el) return;
      i = +el.dataset.i; rr = Math.floor(i / W); cc = i - rr * W;
      if (e.key === "ArrowRight") nx = cc < W - 1 ? i + 1 : i; else if (e.key === "ArrowLeft") nx = cc > 0 ? i - 1 : i;
      else if (e.key === "ArrowDown") nx = rr < H - 1 ? i + W : i; else if (e.key === "ArrowUp") nx = rr > 0 ? i - W : i;
      else if (e.key === "Home") nx = rr * W; else if (e.key === "End") nx = rr * W + W - 1;
      if (nx >= 0) { e.preventDefault(); select(nx, true); return; }
      if (e.key === "Escape") { select(-1, false, true); return; }
      if (locked()) return;
      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); select(i, false, true); applyAt(i, tool); return; }
      if (e.key === "x" || e.key === "X") { e.preventDefault(); select(i, false, true); applyAt(i, 2); return; }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); select(i, false, true); applyAt(i, 1); return; }
      if (e.key === "Delete" || e.key === "Backspace" || e.key === "0") { e.preventDefault(); select(i, false, true); applyAt(i, 0); return; }
    });

    // ---- đồng bộ với ván
    offGame = game.on(function (ev) {
      var d, changed = [], k, old, seen;
      if (ev.type === "solved") { pop(); return; }
      if (ev.type === "status") { if (game.finished()) paintAll(); setBar(); return; }
      if (ev.type !== "change") return;
      d = ev.diff && ev.diff.d;
      if (!d || ev.restart || ev.reveal) { paintAll(); return; }
      for (k = 0; k < d.length; k++) if (d[k][0] === "v") changed.push(d[k][1]);
      old = computeConflicts(); seen = {};
      for (k = 0; k < changed.length; k++) { seen[changed[k]] = 1; paintCell(changed[k]); }
      for (k in old) if (!seen[k] && !cf[k]) { seen[k] = 1; paintCell(+k); }
      for (k in cf) if (!seen[k]) paintCell(+k);
      paintClues(); setBar();
      wrap.classList.toggle("done", game.finished());
    });
    function pop() {
      var k, rr, cc;
      for (k = 0; k < N; k++) { rr = Math.floor(k / W); cc = k - rr * W; cells[k].style.setProperty("--d", (rr + cc) * 16 + "ms"); }
      wrap.classList.add("pop");
      clearTimeout(popTimer); popTimer = setTimeout(function () { wrap.classList.remove("pop"); }, 1700);
    }

    // ---- khởi tạo
    for (i = 0; i < N; i++) cache.push(null);
    setTab(0);
    paintAll();
    frame.fit();
    frame.watch(wrap);

    return {
      destroy: function () { if (offGame) offGame(); frame.destroy(); clearTimeout(popTimer); host.replaceChildren(); },
      refresh: function () { paintAll(); },
      /** Tô các ô được gợi ý / bước replay; thêm: tô nhạt manh mối của hàng/cột chứa các ô đó (cả hàng → chỉ manh mối hàng đó; cả cột → chỉ cột đó; ô lẻ → hàng và cột của nó). */
      highlight: function (list, kind) {
        var old = marks, k, rs = {}, cs = {}, nr = 0, nc = 0, ii, rr, cc, onlyR = -1, onlyC = -1;
        marks = {}; hlRows = {}; hlCols = {};
        if (list && list.length && kind) {
          for (k = 0; k < list.length; k++) {
            ii = list[k]; if (!(ii >= 0 && ii < N)) continue;
            marks[ii] = kind; rr = Math.floor(ii / W); cc = ii - rr * W;
            if (!rs[rr]) { rs[rr] = 1; nr++; onlyR = rr; } if (!cs[cc]) { cs[cc] = 1; nc++; onlyC = cc; }
          }
          if (nr === 1 && nc >= 2) hlRows[onlyR] = kind;
          else if (nc === 1 && nr >= 2) hlCols[onlyC] = kind;
          else if (nr >= 1 && nr <= 3 && nc <= 3) { for (k in rs) hlRows[k] = kind; for (k in cs) hlCols[k] = kind; }
        }
        for (k in old) if (!marks[k]) paintCell(+k);
        for (k in marks) if (!old[k] || old[k] !== marks[k]) paintCell(+k);
        paintClues();
      },
      focus: function () { var t = cells[sel >= 0 ? sel : tabAt]; if (t) t.focus({ preventScroll: true }); }
    };
  }

  /* ===================================================================================================== */
  /*  TRÌNH SOẠN                                                                                            */
  /* ===================================================================================================== */
  function cluesOfImage(img, W, H) {
    var rows = [], cols = [], r, c, run, line;
    for (r = 0; r < H; r++) { line = []; run = 0; for (c = 0; c <= W; c++) { if (c < W && img[r * W + c]) run++; else if (run) { line.push(run); run = 0; } } rows.push(line); }
    for (c = 0; c < W; c++) { line = []; run = 0; for (r = 0; r <= H; r++) { if (r < H && img[r * W + c]) run++; else if (run) { line.push(run); run = 0; } } cols.push(line); }
    return { rows: rows, cols: cols };
  }
  function clueToText(nums) { return nums && nums.length ? nums.join(" ") : "0"; }
  function intIn(x, a, b) { return typeof x === "number" && x === Math.floor(x) && x >= a && x <= b; }
  function clampN(x, d) { x = Math.round(+x); return x >= MINN && x <= MAXN ? x : d; }

  /** Phân tích một ô nhập manh mối: {ok, nums, err}. Cho phép cách nhau bằng khoảng trắng, dấu phẩy, chấm phẩy. "0" một mình = dòng trống. */
  function parseLine(txt, n, what) {
    var s = String(txt == null ? "" : txt).trim(), parts, nums = [], k, need = -1, zero = false;
    if (!s) return { ok: false, nums: null, err: "Chưa nhập (gõ 0 nếu " + what + " này trống)." };
    parts = s.split(/[\s,;]+/);
    for (k = 0; k < parts.length; k++) {
      if (!/^\d{1,3}$/.test(parts[k])) return { ok: false, nums: null, err: "Chỉ nhập số nguyên dương, cách nhau bằng khoảng trắng hoặc dấu phẩy." };
      if (+parts[k] === 0) zero = true; else nums.push(+parts[k]);
    }
    if (zero && parts.length > 1) return { ok: false, nums: null, err: "Số 0 chỉ dùng một mình cho dòng trống." };
    for (k = 0; k < nums.length; k++) need += nums[k] + 1;
    if (need > n) return { ok: false, nums: nums, err: "Cần ít nhất " + need + " ô nhưng " + what + " chỉ dài " + n + " ô." };
    return { ok: true, nums: nums, err: "" };
  }

  /** Dựng trạng thái khởi tạo của trình soạn từ env.input (bản nháp) hoặc env.puzzle (sửa bản sao); không có thì ảnh trống 10×10. */
  function seedState(env) {
    var st = { mode: "draw", w: 10, h: 10, img: null, rows: null, cols: null }, inp = env.input, p = env.puzzle, k, im, w, hh, flat, ok;
    function zeros(n) { var a = [], t; for (t = 0; t < n; t++) a.push(0); return a; }
    if (inp && typeof inp === "object") {
      w = Math.round(+inp.w); hh = Math.round(+inp.h);
      if (inp.image != null) {
        im = inp.image; flat = null;
        if (typeof im === "string") { im = im.replace(/\s+/g, "").split(""); flat = im.map(function (ch) { return ch === "1" || ch === "#" ? 1 : 0; }); }
        else if (Array.isArray(im) && im.length && Array.isArray(im[0])) { if (!(w >= MINN)) w = im[0].length; if (!(hh >= MINN)) hh = im.length; flat = []; ok = true; im.forEach(function (row) { if (!Array.isArray(row)) ok = false; else row.forEach(function (x) { flat.push(x === 1 || x === true ? 1 : 0); }); }); if (!ok) flat = null; }
        else if (Array.isArray(im)) flat = im.map(function (x) { return x === 1 || x === true ? 1 : 0; });
        if (flat && intIn(w, MINN, MAXN) && intIn(hh, MINN, MAXN) && flat.length === w * hh) { st.mode = "draw"; st.w = w; st.h = hh; st.img = flat; return st; }
      }
      if (Array.isArray(inp.rows) && Array.isArray(inp.cols)) {
        w = inp.cols.length; hh = inp.rows.length;
        if (intIn(w, MINN, MAXN) && intIn(hh, MINN, MAXN)) {
          st.mode = "clue"; st.w = w; st.h = hh;
          st.rows = inp.rows.map(function (x) { return Array.isArray(x) ? clueToText(x) : String(x); });
          st.cols = inp.cols.map(function (x) { return Array.isArray(x) ? clueToText(x) : String(x); });
          return st;
        }
      }
    }
    if (p && p.data && intIn(p.data.w, MINN, MAXN) && intIn(p.data.h, MINN, MAXN)) {
      w = p.data.w; hh = p.data.h; st.w = w; st.h = hh;
      if (p.solution && p.solution.v && p.solution.v.length === w * hh) { st.img = []; for (k = 0; k < w * hh; k++) st.img.push(p.solution.v[k] === 1 ? 1 : 0); return st; }
      st.mode = "clue"; st.rows = p.data.rows.map(clueToText); st.cols = p.data.cols.map(clueToText); return st;
    }
    st.img = zeros(st.w * st.h);
    return st;
  }

  function editor(host, env) {
    var st = seedState(env), mode = st.mode, W = st.w, H = st.h, img = st.img, rowsTxt = st.rows, colsTxt = st.cols;
    var frame = null, esel = -1, etab = 0, drawing = null, cache = [], clueRaf = 0, dead = false;
    var seg, segDraw, segClue, selW, selH, sizeBox, drawPane, cluePane, info = h("p", { class: "faint pz-ng-info", "aria-live": "polite" }), rowsList, colsList, totalsEl, fieldEls = { r: [], c: [] };
    var i;

    function blank(n) { var a = [], t; for (t = 0; t < n; t++) a.push(0); return a; }
    if (!img) {
      // vào từ chế độ nhập manh mối: chưa có ảnh → ảnh trống; chuyển sang Vẽ ảnh thì dùng ảnh trống này
      img = blank(W * H);
    }
    if (!rowsTxt || rowsTxt.length !== H || !colsTxt || colsTxt.length !== W) {
      var cl = cluesOfImage(img, W, H);
      rowsTxt = cl.rows.map(clueToText); colsTxt = cl.cols.map(clueToText);
    }

    // ---- phát dữ liệu
    function getInput() {
      var k, rr, cc, p;
      if (mode === "draw") return { w: W, h: H, image: img.slice() };
      rr = []; cc = [];
      for (k = 0; k < H; k++) { p = parseLine(rowsTxt[k], W, "hàng"); rr.push(p.nums ? p.nums : p.ok ? p.nums : String(rowsTxt[k] || "").trim() || "?"); }
      for (k = 0; k < W; k++) { p = parseLine(colsTxt[k], H, "cột"); cc.push(p.nums ? p.nums : p.ok ? p.nums : String(colsTxt[k] || "").trim() || "?"); }
      return { w: W, h: H, rows: rr, cols: cc };
    }
    function emit() { env.onChange(getInput()); }

    // ---- chế độ Vẽ ảnh
    function pixCls(k) {
      var rr = Math.floor(k / W), cc = k - rr * W, cls = "pz-ng-cell";
      if (cc % 5 === 4 && cc < W - 1) cls += " bx";
      if (rr % 5 === 4 && rr < H - 1) cls += " by";
      if (img[k]) cls += " f";
      if (k === esel) cls += " sel";
      return cls;
    }
    function paintPix(k) {
      var el = frame.cells[k], cls = pixCls(k), lab;
      if (cache[k] !== cls) { el.className = cls; cache[k] = cls; lab = "Hàng " + (Math.floor(k / W) + 1) + ", cột " + (k % W + 1) + (img[k] ? ", đã tô" : ", trống"); el.setAttribute("aria-label", lab); }
    }
    function paintClueText() {
      var cl = cluesOfImage(img, W, H);
      frame.setClues(cl.rows, cl.cols);
      var tot = 0, k; for (k = 0; k < img.length; k++) tot += img[k];
      info.textContent = "Đã tô " + tot + "/" + (W * H) + " ô. Chạm hoặc kéo để tô; chạm ô đã tô rồi kéo để xoá. Manh mối tính tự động bên cạnh.";
      for (k = 0; k < H; k++) { var e = frame.rowEl[k]; e.setAttribute("aria-label", "Manh mối hàng " + (k + 1) + ": " + clueWords(cl.rows[k])); }
      for (k = 0; k < W; k++) frame.colEl[k].setAttribute("aria-label", "Manh mối cột " + (k + 1) + ": " + clueWords(cl.cols[k]));
    }
    function scheduleClues() { if (clueRaf) return; clueRaf = (root.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(function () { clueRaf = 0; if (!dead && mode === "draw") paintClueText(); }); }
    function setPix(k, v) { if (img[k] !== v) { img[k] = v; paintPix(k); } }
    function line(a, b) {
      var out = [], r0 = Math.floor(a / W), c0 = a - r0 * W, r1 = Math.floor(b / W), c1 = b - r1 * W, n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)), t;
      for (t = 0; t <= n; t++) out.push(Math.round(r0 + (r1 - r0) * (n ? t / n : 0)) * W + Math.round(c0 + (c1 - c0) * (n ? t / n : 0)));
      return out;
    }

    function buildDraw() {
      if (frame) frame.destroy();
      frame = makeFrame(W, H, "Ảnh Nonogram " + W + " nhân " + H + " đang vẽ");
      frame.rowsEl.style.minWidth = (Math.ceil(W / 3) + 1) * 1.1 + 1.3 + "em";      // chừa chỗ cho manh mối dài dần khi vẽ → bàn không nhảy cỡ
      cache = [];
      for (i = 0; i < W * H; i++) cache.push(null);
      var el = frame.gridEl;
      el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      el.addEventListener("pointerdown", function (e) {
        var k, v;
        if (frame.tDown(e)) { drawing = null; e.preventDefault(); return; }
        if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
        k = frame.at(e.clientX, e.clientY, false);
        if (k < 0) return;
        v = e.button === 2 ? 0 : img[k] ? 0 : 1;
        drawing = { pid: e.pointerId, last: k, val: v };
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* không bắt buộc */ }
        selectPix(k, true); setPix(k, v); scheduleClues();
        e.preventDefault();
      });
      el.addEventListener("pointermove", function (e) {
        var k, cells, t;
        if (frame.tMove(e)) { e.preventDefault(); return; }
        if (!drawing || e.pointerId !== drawing.pid) return;
        k = frame.at(e.clientX, e.clientY, true);
        if (k < 0 || k === drawing.last) return;
        cells = line(drawing.last, k);
        for (t = 0; t < cells.length; t++) setPix(cells[t], drawing.val);
        drawing.last = k; selectPix(k, false); scheduleClues(); frame.edge(e.clientX, e.clientY);
      });
      function end(e, commit) {
        frame.tUp(e);
        if (!drawing || e.pointerId !== drawing.pid) return;
        drawing = null;
        if (commit) { paintClueText(); emit(); }
      }
      el.addEventListener("pointerup", function (e) { end(e, true); });
      el.addEventListener("pointercancel", function (e) { end(e, false); });
      el.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target.closest ? e.target.closest(".pz-ng-cell") : null, k, rr, cc, nx = -1;
        if (!t) return;
        k = +t.dataset.i; rr = Math.floor(k / W); cc = k - rr * W;
        if (e.key === "ArrowRight") nx = cc < W - 1 ? k + 1 : k; else if (e.key === "ArrowLeft") nx = cc > 0 ? k - 1 : k;
        else if (e.key === "ArrowDown") nx = rr < H - 1 ? k + W : k; else if (e.key === "ArrowUp") nx = rr > 0 ? k - W : k;
        else if (e.key === "Home") nx = rr * W; else if (e.key === "End") nx = rr * W + W - 1;
        if (nx >= 0) { e.preventDefault(); selectPix(nx, true); return; }
        if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") { e.preventDefault(); selectPix(k, false); setPix(k, img[k] ? 0 : 1); paintClueText(); emit(); }
        else if (e.key === "Delete" || e.key === "Backspace" || e.key === "0") { e.preventDefault(); setPix(k, 0); paintClueText(); emit(); }
      });
      paintClueText();
      for (i = 0; i < W * H; i++) paintPix(i);
      frame.cells[etab].setAttribute("tabindex", "0");
    }
    function selectPix(k, focus) {
      var old = esel;
      esel = k;
      if (frame.cells[etab]) frame.cells[etab].setAttribute("tabindex", "-1");
      etab = k; frame.cells[k].setAttribute("tabindex", "0");
      if (old >= 0 && old !== k) paintPix(old);
      paintPix(k);
      if (focus) { frame.cells[k].focus({ preventScroll: true }); frame.reveal(k); }
    }

    // ---- chế độ Nhập manh mối
    function fieldFor(axis, k) {
      var id = "ng-ed-" + axis + k, inp = h("input", { type: "text", id: id, autocomplete: "off", autocapitalize: "off", spellcheck: "false", placeholder: "vd 3 1 2", "aria-describedby": id + "-e" }),
        msg = h("small", { class: "pz-ng-err", id: id + "-e", role: "alert" }), lab = h("label", { for: id, text: (axis === "r" ? "Hàng " : "Cột ") + (k + 1) });
      inp.value = (axis === "r" ? rowsTxt[k] : colsTxt[k]) || "";
      inp.addEventListener("input", function () { if (axis === "r") rowsTxt[k] = inp.value; else colsTxt[k] = inp.value; checkField(axis, k); totals(); emit(); });
      fieldEls[axis][k] = { inp: inp, msg: msg };
      return h("div", { class: "pz-ng-field" }, lab, inp, msg);
    }
    function checkField(axis, k) {
      var f = fieldEls[axis][k], p = parseLine(axis === "r" ? rowsTxt[k] : colsTxt[k], axis === "r" ? W : H, axis === "r" ? "hàng" : "cột");
      f.msg.textContent = p.ok ? "" : p.err;
      if (p.ok) f.inp.removeAttribute("aria-invalid"); else f.inp.setAttribute("aria-invalid", "true");
      return p;
    }
    function totals() {
      var sr = 0, sc = 0, bad = 0, k, p;
      for (k = 0; k < H; k++) { p = parseLine(rowsTxt[k], W, "hàng"); if (p.nums && p.ok) sr += p.nums.reduce(function (a, b) { return a + b; }, 0); else bad++; }
      for (k = 0; k < W; k++) { p = parseLine(colsTxt[k], H, "cột"); if (p.nums && p.ok) sc += p.nums.reduce(function (a, b) { return a + b; }, 0); else bad++; }
      totalsEl.className = "pz-ng-totals" + (!bad && sr !== sc ? " bad" : "");
      totalsEl.textContent = bad ? bad + " dòng chưa hợp lệ (xem thông báo dưới từng ô nhập)." : sr === sc ? "Tổng ô tô: " + sr + " (hàng và cột khớp nhau)." : "Tổng ô tô theo hàng (" + sr + ") khác theo cột (" + sc + "): hai bộ manh mối mâu thuẫn nhau.";
    }
    function buildClue() {
      var k;
      fieldEls = { r: [], c: [] };
      rowsList = h("div", { class: "pz-ng-fields" }); colsList = h("div", { class: "pz-ng-fields" });
      for (k = 0; k < H; k++) rowsList.append(fieldFor("r", k));
      for (k = 0; k < W; k++) colsList.append(fieldFor("c", k));
      totalsEl = h("p", { class: "pz-ng-totals", "aria-live": "polite" });
      cluePane.replaceChildren(
        h("p", { class: "faint", text: "Nhập các số của mỗi dòng, cách nhau bằng khoảng trắng hoặc dấu phẩy (vd 3 1 2). Dòng trống ghi 0. Hàng đọc từ trái sang phải, cột đọc từ trên xuống dưới." }),
        h("fieldset", { class: "pz-ng-set" }, h("legend", { text: "Manh mối các hàng (" + H + ")" }), rowsList),
        h("fieldset", { class: "pz-ng-set" }, h("legend", { text: "Manh mối các cột (" + W + ")" }), colsList), totalsEl);
      for (k = 0; k < H; k++) checkField("r", k);
      for (k = 0; k < W; k++) checkField("c", k);
      totals();
    }

    // ---- khung chung
    function btn(label, ic, fn, extra) {
      var b = h("button", { type: "button", class: "btn" + (extra ? " " + extra : ""), html: (ic ? icon(ic) : "") + "<span></span>" });
      b.lastChild.textContent = label; b.addEventListener("click", fn); return b;
    }
    function opts(sel_, cur) { var k; for (k = MINN; k <= MAXN; k++) sel_.append(h("option", { value: String(k), selected: k === cur ? true : null, text: String(k) })); sel_.value = String(cur); }
    function resize(nw, nh) {
      var k, rr, cc, ni = [], nrow = [], ncol = [];
      if (nw === W && nh === H) return;
      for (rr = 0; rr < nh; rr++) for (cc = 0; cc < nw; cc++) ni.push(rr < H && cc < W ? img[rr * W + cc] : 0);
      for (k = 0; k < nh; k++) nrow.push(k < H ? rowsTxt[k] : "");
      for (k = 0; k < nw; k++) ncol.push(k < W ? colsTxt[k] : "");
      W = nw; H = nh; img = ni; rowsTxt = nrow; colsTxt = ncol; esel = -1; etab = 0;
      render(); emit();
    }
    function setMode(m) {
      if (m === mode) return;
      var cl;
      if (m === "clue") {                                   // ảnh → manh mối của ảnh để chỉnh tay
        cl = cluesOfImage(img, W, H); rowsTxt = cl.rows.map(clueToText); colsTxt = cl.cols.map(clueToText); mode = "clue"; render(); emit();
        return;
      }
      cl = cluesOfImage(img, W, H);
      var same = true, k;
      for (k = 0; k < H; k++) if (clueToText(cl.rows[k]) !== (rowsTxt[k] || "").trim().replace(/[\s,;]+/g, " ")) same = false;
      for (k = 0; k < W; k++) if (clueToText(cl.cols[k]) !== (colsTxt[k] || "").trim().replace(/[\s,;]+/g, " ")) same = false;
      if (!same && env.ctx && env.ctx.confirm) {
        env.ctx.confirm("Chuyển sang Vẽ ảnh?", "Manh mối bạn đã nhập tay sẽ được thay bằng manh mối tính từ ảnh đang có (ảnh hiện tại: " + (img.some(function (x) { return x; }) ? "đã vẽ" : "trống") + ").", "Chuyển", false).then(function (ok) { if (ok && !dead) { mode = "draw"; render(); emit(); } });
        return;
      }
      mode = "draw"; render(); emit();
    }
    function render() {
      segDraw.setAttribute("aria-pressed", String(mode === "draw")); segClue.setAttribute("aria-pressed", String(mode === "clue"));
      selW.value = String(W); selH.value = String(H);
      drawPane.hidden = mode !== "draw"; cluePane.hidden = mode !== "clue";
      if (mode === "draw") {
        buildDraw();
        drawPane.replaceChildren(frame.root, h("div", { class: "pz-ng-bar" },
          h("div", { class: "pz-ng-group" }, btn("Xoá hết", "trash", function () { img = blank(W * H); for (var k = 0; k < img.length; k++) paintPix(k); paintClueText(); emit(); }),
            btn("Đảo ảnh", "restart", function () { for (var k = 0; k < img.length; k++) { img[k] = img[k] ? 0 : 1; paintPix(k); } paintClueText(); emit(); }),
            btn("Ảnh ngẫu nhiên", "dice", function () { randomImage(); })),
          h("div", { class: "pz-ng-group pz-ng-zoom", role: "group", "aria-label": "Cỡ ô" },
            btn("", "minus", function () { frame.zoom(-1); }, "pz-ng-z"), btn("Vừa", null, function () { frame.fit(); }, "pz-ng-z"), btn("", "plus", function () { frame.zoom(1); }, "pz-ng-z"))), info);
        drawPane.querySelectorAll(".pz-ng-z")[0].setAttribute("aria-label", "Thu nhỏ ô"); drawPane.querySelectorAll(".pz-ng-z")[2].setAttribute("aria-label", "Phóng to ô");
        drawPane.querySelectorAll(".pz-ng-z")[1].setAttribute("aria-label", "Cỡ ô vừa khung");
        frame.fit(); frame.watch(drawPane);
      } else {
        if (frame) { frame.destroy(); frame = null; }
        buildClue();
      }
    }
    function randomImage() {
      var dens = 0.42 + Math.random() * 0.2, k, rr, cc, t, n, a, b, cnt, tmp;
      for (k = 0; k < img.length; k++) img[k] = Math.random() < dens ? 1 : 0;
      for (t = 0; t < 2; t++) {                       // làm mịn (đa số 3×3) cho thành mảng hình thay vì nhiễu
        tmp = img.slice();
        for (rr = 0; rr < H; rr++) for (cc = 0; cc < W; cc++) {
          cnt = 0; n = 0;
          for (a = -1; a <= 1; a++) for (b = -1; b <= 1; b++) { if (rr + a >= 0 && rr + a < H && cc + b >= 0 && cc + b < W) { n++; cnt += tmp[(rr + a) * W + cc + b]; } }
          img[rr * W + cc] = cnt * 2 > n ? 1 : cnt * 2 < n ? 0 : tmp[rr * W + cc];
        }
      }
      for (k = 0; k < img.length; k++) paintPix(k);
      paintClueText(); emit();
    }

    segDraw = h("button", { type: "button", "aria-pressed": "true", html: icon("pencil") + "<span>Vẽ ảnh</span>" });
    segClue = h("button", { type: "button", "aria-pressed": "false", html: icon("grid") + "<span>Nhập manh mối</span>" });
    segDraw.addEventListener("click", function () { setMode("draw"); });
    segClue.addEventListener("click", function () { setMode("clue"); });
    seg = h("div", { class: "seg pz-ng-seg", role: "group", "aria-label": "Cách soạn" }, segDraw, segClue);
    selW = h("select", { id: "ng-ed-w", "aria-label": "Số cột (chiều rộng)" }); selH = h("select", { id: "ng-ed-h", "aria-label": "Số hàng (chiều cao)" });
    opts(selW, W); opts(selH, H);
    selW.addEventListener("change", function () { resize(clampN(selW.value, W), H); });
    selH.addEventListener("change", function () { resize(W, clampN(selH.value, H)); });
    sizeBox = h("div", { class: "pz-ng-size" }, h("label", { for: "ng-ed-w", text: "Rộng" }), selW, h("span", { class: "faint", "aria-hidden": "true", text: "×" }), h("label", { for: "ng-ed-h", text: "Cao" }), selH);
    drawPane = h("div", { class: "pz-ng-pane" }); cluePane = h("div", { class: "pz-ng-pane pz-ng-cluepane", hidden: true });
    host.replaceChildren(h("div", { class: "pz-ng pz-ng-ed" }, h("div", { class: "pz-ng-edhead" }, seg, sizeBox), drawPane, cluePane));
    render();
    emit();

    return {
      getInput: getInput,
      destroy: function () { dead = true; if (frame) frame.destroy(); host.replaceChildren(); }
    };
  }

  P.boards = P.boards || {};
  P.boards.nonogram = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
