/* ui/boards/logicgrid.js — bàn Logic Grid (lưới suy luận kiểu Einstein) + trình soạn "Logic Builder".
   Engine: assets/js/puzzles/logicgrid.js. state.v = K(K-1)/2 khối N×N, mỗi cặp nhóm (ci<cj) một khối: hàng = mục nhóm ci, cột = mục nhóm cj; 0 chưa biết · 1 ✓ (cùng nhóm) · 2 ✗ (khác nhóm).
   Hành động gửi cho engine: {k:"cycle", i} (trống → ✗ → ✓ → trống) · {k:"set", i, val:0|1|2}. Engine tự bổ sung hệ quả khi settings().autoRemove (cùng một diff = một lần hoàn tác).

   ── BÀN (mount) ─────────────────────────────────────────────────────────────────────────────────────────────────────
   • Manh mối đánh số luôn ở TRÊN CÙNG (cuộn nội bộ nếu dài, có nút Thu gọn). Chạm một manh mối = gạch "đã dùng" (trạng thái GIAO DIỆN, nhớ theo puzzle trong phiên); gợi ý có regions.clues thì tô các manh mối đó.
   • Hai bố cục dùng chung hàm vẽ khối:
       - BẬC THANG (Einstein): nhóm 0 làm hàng bên trái cho các khối cột đầu, các nhóm còn lại làm hàng/cột theo tam giác; nhãn cột ghi dọc. Tự chọn khi ô vẽ ra ≥ 24 px (≥ 30 px trên máy cảm ứng) — nên 3×3 vẫn vừa
         điện thoại; 5×5 ở khung 640 px (ô ≈ 26 px) vẫn là bậc thang.
       - TỪNG KHỐI: thanh chọn cặp nhóm (tab cuộn ngang, vuốt trái/phải trên khối để đổi) + một khối lớn. Tự chọn khi khung quá hẹp; nút "Bậc thang | Từng khối" cho người dùng ép (ép bậc thang ở khung hẹp ⇒ cuộn ngang TRONG vùng lưới).
     Bảng "Đã xác định" (các ✓ liên thông theo từng người/hàng nhóm 0) luôn hiện dưới lưới.
   • Thao tác ô: dụng cụ mặc định "Vòng" = action cycle (chạm lần lượt trống → ✗ → ✓ → trống); dụng cụ "Đúng ✓", "Loại ✗", "Xoá" đặt thẳng một giá trị (chạm lại cùng dấu = xoá) — dễ dùng hơn trên cảm ứng vì ✗ rất nhiều.
     Chuột phải = đặt/bỏ ✓. Bàn phím: mũi tên (sang khối kề ở bố cục bậc thang) · Home/End · Space/Enter = áp dụng dụng cụ · V = ✓ · X = ✗ · Delete/Backspace/0 = xoá · PageUp/PageDown hoặc [ ] đổi khối (từng khối) · Esc bỏ chọn.
   • ✓ vẽ dấu tích, ✗ vẽ dấu gạch chéo (SVG nội tuyến, đổi hình chứ không chỉ đổi màu); aria-label "An — Đỏ: chắc chắn đúng". Ô vi phạm (check().conflicts, khi showConflicts) tô lỗi + viền đậm.
   • Chọn ô ⇒ tô nhạt hàng + cột của nó trong khối và hai nhãn tương ứng. Nhóm CÓ THỨ TỰ: nhãn có thêm giá trị (vd "3 tuổi" hiện "3"), xem cat.values.
   • highlight(cells, kind): "hint" (hổ phách) / "replay" (xanh); từng khối thì tự chuyển sang khối chứa ô được tô. Lắng nghe game.on({type:"hint"}) để tô manh mối.
   Trạng thái GIAO DIỆN (ô chọn, dụng cụ, bố cục, khối đang xem, manh mối đã gạch) nằm ở đây; mọi nội dung bàn đi qua game.act.

   ── TRÌNH SOẠN (editor) ─────────────────────────────────────────────────────────────────────────────────────────────
   Danh sách nhóm (2–6; nhóm đầu là "hàng"; mỗi nhóm có tên, các mục, cờ "có thứ tự" + giá trị số), "Dùng ví dụ", "Từ vựng gợi ý", mỗi manh mối một dòng DSL kiểm tức thì bằng type.parseClue (lỗi tiếng Việt ngay dưới dòng,
   dòng đúng hiện câu đọc được), mẫu chèn nhanh, bảng chèn tên mục/phép toán vào dòng đang soạn, bảng cú pháp gập. Mỗi lần sửa gọi env.onChange({cats:[{name, items, ordered, values}], clues:[chuỗi DSL]}). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var SVG_YES = '<svg class="ic mk mk-yes" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 12.8l4.6 4.6L19.4 7.2"/></svg>';
  var SVG_NO = '<svg class="ic mk mk-no" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/></svg>';
  var CELL_MIN = 22, CELL_MAX_LADDER = 46, CELL_MAX_SINGLE = 60, USED_LIMIT = 60;
  var MOUNTS = 0, USED = {}, USED_ORDER = [];
  var TOOLS = [
    { id: "cycle", label: "Vòng", aria: "Công cụ vòng: mỗi lần chạm đổi trống, ✗, ✓, rồi lại trống", ic: icon("restart") },
    { id: "yes", label: "Đúng", aria: "Công cụ ✓: chạm để đánh dấu cùng một nhóm, chạm lại để xoá", ic: SVG_YES },
    { id: "no", label: "Loại", aria: "Công cụ ✗: chạm để loại (khác nhóm), chạm lại để xoá", ic: SVG_NO },
    { id: "erase", label: "Xoá", aria: "Công cụ xoá dấu", ic: icon("eraser") }
  ];

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  var meas = null;
  function textW(s, font) {
    try { if (!meas) meas = doc.createElement("canvas").getContext("2d"); meas.font = font; return meas.measureText(String(s)).width; } catch (e) { return String(s).length * 6.8; }
  }
  function isCoarse() { try { return !!(root.matchMedia && root.matchMedia("(pointer: coarse)").matches); } catch (e) { return false; } }
  function fold(s) {
    s = String(s == null ? "" : s).toLowerCase();
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* bỏ qua */ }
    return s.replace(/đ/g, "d").replace(/\s+/g, " ").trim();
  }

  /* ======================================================================================================== */
  /*  BÀN CHƠI                                                                                                 */
  /* ======================================================================================================== */
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, ro = !!env.readOnly;
    var data = puzzle.data, cats = data.cats, clues = data.clues || [], K = cats.length, N = cats[0].items.length, NN = N * N;
    var blocks = type.blocks(puzzle), NB = blocks.length, total = NB * NN, uid = "pzlg" + (++MOUNTS);
    var mode = "single", userMode = null, built = false, active = 0, sel = -1, tool = "cycle", marks = {}, hintClues = {}, conf = {}, peerSet = {}, folded = false;
    var cellEl = [], shownCls = [], shownVal = [], shownLab = [], blockEl = [], rowLabOf = [], colLabOf = [], litLabs = [], place = [], blockAt = {}, sbEl = [], chipEl = [];
    var tabCell = -1, offGame = null, resizeObs = null, raf = 0, sw = null, swallow = 0, dead = false, sumSig = "", chipsEl = null, areaMetrics = null, mq = null, mqFn = null;
    var uk = String(puzzle.id || game.id), used = USED[uk], fam = "sans-serif";
    if (!used) { used = USED[uk] = []; USED_ORDER.push(uk); if (USED_ORDER.length > USED_LIMIT) delete USED[USED_ORDER.shift()]; }
    try { fam = root.getComputedStyle(host).fontFamily || fam; } catch (e) { /* bỏ qua */ }

    // ---- hình học: bố cục bậc thang vẽ khối (t ≥ 1) theo chiều chuyển vị (hàng = nhóm lớn hơn) để nhãn hàng nằm ở lề trái
    function isTr(bi) { return mode === "ladder" && blocks[bi].ci >= 1; }
    function idxOf(bi, r, q) { var tr = isTr(bi); return blocks[bi].base + (tr ? q : r) * N + (tr ? r : q); }
    function dispOf(i) { var bi = (i / NN) | 0, o = i - blocks[bi].base, a = (o / N) | 0, b = o % N, tr = isTr(bi); return { bi: bi, r: tr ? b : a, q: tr ? a : b }; }
    function blockOf(i) { return (i / NN) | 0; }
    function visibleBlock(bi) { return mode === "ladder" || bi === active; }
    function labelOf(i) {
      var bi = blockOf(i), B = blocks[bi], o = i - B.base, a = (o / N) | 0, b = o % N, v = game.state.v[i];
      return cats[B.ci].items[a] + " — " + cats[B.cj].items[b] + ": " + (v === 1 ? "chắc chắn đúng" : v === 2 ? "đã loại" : "chưa đánh dấu") + (conf[i] ? " (mâu thuẫn)" : "");
    }
    function isAsc(c) { var v = cats[c].values; if (!cats[c].ordered || !v) return false; for (var k = 1; k < v.length; k++) if (!(v[k] > v[k - 1])) return false; return true; }
    function catTitle(c) { return cats[c].name + (cats[c].ordered ? (isAsc(c) ? " ↗" : " ⇅") : ""); }
    function catTip(c) { return cats[c].name + (cats[c].ordered ? ": nhóm có thứ tự" + (isAsc(c) ? " (tăng dần theo chiều đọc)" : "") : ""); }
    function valueTag(c, x) { var cat = cats[c]; return cat.ordered && cat.values ? String(cat.values[x]) : ""; }

    // ---- dựng khung ---------------------------------------------------------------------------------------
    var rootEl = h("div", { class: "pz-lg" });
    var cluesUi = buildClues(), barUi = buildBar(), areaEl = h("div", { class: "pz-lg-area" }), sumUi = buildSummary();
    var legend = h("p", { class: "pz-lg-legend", "aria-hidden": "true" }, h("span", { class: "lg-i", html: SVG_YES }), h("span", { text: " cùng một nhóm" }), h("span", { class: "lg-sep", text: "·" }), h("span", { class: "lg-i", html: SVG_NO }), h("span", { text: " khác nhóm" }));
    var footEl = h("div", { class: "pz-lg-foot" }, legend, barUi.layout);
    rootEl.append(cluesUi.root, barUi.root, areaEl, footEl, sumUi.root);
    host.replaceChildren(rootEl);

    // ---- manh mối
    function buildClues() {
      var cnt = h("span", { class: "pz-lg-ccnt" });
      var foldBtn = h("button", { type: "button", class: "pz-lg-fold", "aria-expanded": "true", "aria-controls": uid + "-cl" }, h("span", { text: "Thu gọn" }));
      var ol = h("ol", { class: "pz-lg-clist", id: uid + "-cl", "aria-label": "Danh sách manh mối" }), btns = [];
      clues.forEach(function (cl, k) {
        var txt = ""; try { txt = type.clueText(puzzle, k); } catch (e) { /* bỏ qua */ }
        var b = h("button", { type: "button", class: "pz-lg-clue", "aria-pressed": "false", title: "Chạm để gạch (đã dùng) / bỏ gạch", dataset: { k: String(k) } },
          h("span", { class: "n", "aria-hidden": "true", text: String(k + 1) }), h("span", { class: "t", text: txt || ("Manh mối " + (k + 1)) }));
        btns.push(b); ol.append(h("li", {}, b));
      });
      if (!clues.length) ol.append(h("li", { class: "pz-lg-cnone", text: "Đề này không có manh mối: chỉ dùng luật mỗi mục thuộc đúng một nhóm." }));
      ol.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest(".pz-lg-clue") : null; if (!b) return;
        var k = +b.dataset.k; used[k] = !used[k]; paintClues(false);
        env.announce("Manh mối " + (k + 1) + (used[k] ? " đã gạch" : " bỏ gạch"));
      });
      foldBtn.addEventListener("click", function () {
        folded = !folded; ol.hidden = folded; foldBtn.setAttribute("aria-expanded", String(!folded)); foldBtn.firstChild.textContent = folded ? "Mở rộng" : "Thu gọn";
      });
      var root_ = h("section", { class: "pz-lg-clues", "aria-label": "Manh mối" }, h("div", { class: "pz-lg-chead" }, h("h3", { text: "Manh mối" }), cnt, foldBtn), ol);
      return { root: root_, list: ol, btns: btns, cnt: cnt };
    }
    function paintClues(scrollToHint) {
      var n = 0, first = -1;
      cluesUi.btns.forEach(function (b, k) {
        var u = !!used[k], hl = !!hintClues[k];
        if (u) n++;
        var cls = "pz-lg-clue" + (u ? " used" : "") + (hl ? " hl-hint" : "");
        if (b.className !== cls) b.className = cls;
        var pr = u ? "true" : "false"; if (b.getAttribute("aria-pressed") !== pr) b.setAttribute("aria-pressed", pr);
        if (hl && first < 0) first = k;
      });
      cluesUi.cnt.replaceChildren(h("span", { text: clues.length ? n + "/" + clues.length : "" }), h("span", { class: "w", text: clues.length ? " đã dùng" : "" }));
      if (scrollToHint && first >= 0 && !folded) {
        var li = cluesUi.btns[first].parentNode, ol = cluesUi.list;
        if (li.offsetTop < ol.scrollTop || li.offsetTop + li.offsetHeight > ol.scrollTop + ol.clientHeight) ol.scrollTop = Math.max(0, li.offsetTop - 6);
      }
    }

    // ---- thanh công cụ + bố cục
    function buildBar() {
      var toolBtns = {}, tools = null, i;
      if (!ro) {
        tools = h("div", { class: "pz-lg-tools", role: "group", "aria-label": "Công cụ đánh dấu" });
        TOOLS.forEach(function (t) {
          var b = h("button", { type: "button", class: "pz-lg-tool", "aria-pressed": String(t.id === tool), "aria-label": t.aria, title: t.aria, dataset: { tool: t.id }, html: t.ic + "<span>" + t.label + "</span>" });
          b.addEventListener("click", function () { tool = t.id; for (var k in toolBtns) toolBtns[k].setAttribute("aria-pressed", String(k === tool)); });
          toolBtns[t.id] = b; tools.append(b);
        });
      }
      var layoutBtns = {}, layout = null;
      if (K > 2) {
        layout = h("div", { class: "pz-lg-layout seg", role: "group", "aria-label": "Bố cục lưới" });
        [["ladder", "Bậc thang", "Hiện mọi khối cùng lúc theo kiểu Einstein"], ["single", "Từng khối", "Mỗi lần một cặp nhóm, đổi bằng thanh chọn hoặc vuốt"]].forEach(function (d) {
          var b = h("button", { type: "button", "aria-pressed": "false", title: d[2], dataset: { layout: d[0] } }, h("span", { text: d[1] }));
          b.addEventListener("click", function () { userMode = d[0]; schedule(true); });
          layoutBtns[d[0]] = b; layout.append(b);
        });
      }
      return {
        root: h("div", { class: "pz-lg-bar" }, tools), layout: layout,
        sync: function () { for (var k in layoutBtns) layoutBtns[k].setAttribute("aria-pressed", String(k === mode)); }
      };
    }

    // ---- bảng "đã xác định"
    function buildSummary() {
      var head = h("h3", {}, h("span", { text: "Đã xác định" }), h("small", { class: "pz-lg-scnt" }));
      var tableWrap = h("div", { class: "pz-lg-sumscroll", role: "region", "aria-label": "Bảng đã xác định (cuộn ngang nếu rộng)", tabindex: "0" }), orph = h("p", { class: "pz-lg-orph" });
      return { root: h("section", { class: "pz-lg-sum", "aria-label": "Những gì đã xác định từ các dấu ✓" }, head, tableWrap, orph), wrap: tableWrap, orph: orph, cnt: head.lastChild };
    }
    function unionFind() {
      var par = [], i, bi, o, vs = game.state.v;
      for (i = 0; i < K * N; i++) par[i] = i;
      function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
      for (bi = 0; bi < NB; bi++) {
        var B = blocks[bi];
        for (o = 0; o < NN; o++) if (vs[B.base + o] === 1) { var x = find(B.ci * N + ((o / N) | 0)), y = find(B.cj * N + (o % N)); if (x !== y) par[x] = y; }
      }
      return find;
    }
    function paintSummary() {
      var find = unionFind(), rows = [], known = 0, a, c, b, comp = {}, rootOf = [], orphans = [];
      for (c = 0; c < K; c++) for (b = 0; b < N; b++) { var r = find(c * N + b); rootOf[c * N + b] = r; (comp[r] = comp[r] || []).push([c, b]); }
      for (a = 0; a < N; a++) {
        var r0 = rootOf[a], row = { name: cats[0].items[a], cells: [] };
        for (c = 1; c < K; c++) {
          var mem = (comp[r0] || []).filter(function (p) { return p[0] === c; }).map(function (p) { return cats[c].items[p[1]]; });
          if (mem.length === 1) known++;
          row.cells.push(mem);
        }
        rows.push(row);
      }
      Object.keys(comp).forEach(function (r) {
        var list = comp[r];
        if (list.length > 1 && !list.some(function (p) { return p[0] === 0; })) orphans.push(list.map(function (p) { return cats[p[0]].items[p[1]]; }).join(" = "));
      });
      var sig = JSON.stringify([rows, orphans]);
      sumUi.cnt.textContent = " " + known + "/" + (N * (K - 1));
      if (sig === sumSig) return;
      sumSig = sig;
      var thead = h("tr", {}, h("th", { scope: "col", text: cats[0].name }));
      for (c = 1; c < K; c++) thead.append(h("th", { scope: "col", text: cats[c].name }));
      var tbody = h("tbody", {});
      rows.forEach(function (row) {
        var tr = h("tr", {}, h("th", { scope: "row", text: row.name }));
        row.cells.forEach(function (mem, j) {
          var td = h("td", { class: mem.length === 0 ? "none" : mem.length > 1 ? "bad" : "ok" });
          if (mem.length) td.textContent = mem.join(" / "); else { td.append(h("span", { "aria-hidden": "true", text: "·" }), h("span", { class: "sr-only", text: "chưa biết " + cats[j + 1].name })); }
          tr.append(td);
        });
        tbody.append(tr);
      });
      sumUi.wrap.replaceChildren(h("table", { class: "pz-lg-sumtab" }, h("thead", {}, thead), tbody));
      sumUi.orph.textContent = orphans.length ? "Đã nối nhưng chưa biết thuộc " + (cats[0].kind === "person" ? "người" : cats[0].name.toLowerCase()) + " nào: " + orphans.join(" · ") : "";
      sumUi.orph.hidden = !orphans.length;
    }

    // ---- dựng lưới (hai bố cục dùng chung makeBlock) ------------------------------------------------------------
    function makeBlock(bi) {
      var B = blocks[bi], tr = isTr(bi), r, q;
      var grid = h("div", { class: "pz-lg-block", role: "grid", "aria-label": "Khối " + cats[B.ci].name + " × " + cats[B.cj].name + ": hàng " + cats[tr ? B.cj : B.ci].name + ", cột " + cats[tr ? B.ci : B.cj].name, "aria-rowcount": String(N), "aria-colcount": String(N), dataset: { bi: String(bi), ci: String(B.ci), cj: String(B.cj) } });
      for (r = 0; r < N; r++) {
        var row = h("div", { class: "pz-lg-row", role: "row" });
        for (q = 0; q < N; q++) {
          var i = B.base + (tr ? q : r) * N + (tr ? r : q);
          var el = h("div", { class: "pz-lg-cell", role: "gridcell", tabindex: "-1", "aria-colindex": String(q + 1), "aria-selected": "false", "data-v": "0", dataset: { i: String(i), r: String(r), q: String(q) } });
          cellEl[i] = el; shownCls[i] = null; shownVal[i] = -1; shownLab[i] = null; row.append(el);
        }
        grid.append(row);
      }
      blockEl[bi] = grid;
      return grid;
    }
    function labelEl(cls, cat, x, style) {
      var tag = valueTag(cat, x), full = cats[cat].items[x] + (tag && tag !== cats[cat].items[x] ? " (" + tag + ")" : "");
      return h("div", { class: cls, title: full, style: style }, h("span", { text: full }));
    }
    function buildLadder() {
      var rowC = [0], colC = [], i, rg, cg, q, r, bi;
      for (i = K - 1; i >= 2; i--) rowC.push(i);
      for (i = 1; i < K; i++) colC.push(i);
      var ladder = h("div", { class: "pz-lg-ladder", role: "group", "aria-label": "Lưới suy luận " + K + " nhóm" }), colLab = [], rowLab = [];
      for (cg = 0; cg < colC.length; cg++) {
        ladder.append(h("div", { class: "pz-lg-gt c", title: catTip(colC[cg]), style: "grid-row:1;grid-column:" + (3 + cg * N) + " / span " + N }, h("span", { text: catTitle(colC[cg]) })));
        colLab[cg] = [];
        for (q = 0; q < N; q++) { var ce = labelEl("pz-lg-cl" + (q === 0 ? " g0" : ""), colC[cg], q, "grid-row:2;grid-column:" + (3 + cg * N + q)); colLab[cg].push(ce); ladder.append(ce); }
      }
      for (rg = 0; rg < rowC.length; rg++) {
        ladder.append(h("div", { class: "pz-lg-gt r", title: catTip(rowC[rg]), style: "grid-column:1;grid-row:" + (3 + rg * N) + " / span " + N }, h("span", { text: catTitle(rowC[rg]) })));
        rowLab[rg] = [];
        for (r = 0; r < N; r++) { var re = labelEl("pz-lg-rl" + (r === 0 ? " g0" : ""), rowC[rg], r, "grid-column:2;grid-row:" + (3 + rg * N + r)); rowLab[rg].push(re); ladder.append(re); }
      }
      for (bi = 0; bi < NB; bi++) {
        var B = blocks[bi], rgi = B.ci === 0 ? 0 : K - B.cj, cgi = B.ci === 0 ? B.cj - 1 : B.ci - 1, blk = makeBlock(bi);
        blk.style.gridRow = (3 + rgi * N) + " / span " + N; blk.style.gridColumn = (3 + cgi * N) + " / span " + N;
        ladder.append(blk); place[bi] = { rg: rgi, cg: cgi }; blockAt[rgi + "," + cgi] = bi; rowLabOf[bi] = rowLab[rgi]; colLabOf[bi] = colLab[cgi];
      }
      areaEl.append(h("div", { class: "pz-lg-scroll" }, ladder));
    }
    function buildSingle() {
      var wrap = h("div", { class: "pz-lg-single" }), bi, q, r;
      if (NB > 1) {
        chipsEl = h("div", { class: "pz-lg-chips", role: "tablist", "aria-label": "Chọn cặp nhóm" });
        for (bi = 0; bi < NB; bi++) (function (bi) {
          var B = blocks[bi];
          var chip = h("button", { type: "button", class: "pz-lg-chip", role: "tab", id: uid + "-t" + bi, "aria-selected": "false", "aria-controls": uid + "-p" + bi, tabindex: "-1", dataset: { bi: String(bi) } },
            h("span", { class: "nm", text: cats[B.ci].name + " × " + cats[B.cj].name }), h("span", { class: "bd", "aria-hidden": "true" }));
          chipEl[bi] = chip; chipsEl.append(chip);
        })(bi);
        wrap.append(chipsEl);
      }
      var sbs = h("div", { class: "pz-lg-sbs" });
      for (bi = 0; bi < NB; bi++) {
        var B = blocks[bi], grid = h("div", { class: "pz-lg-sgrid" }), rl = [], cl = [];
        for (q = 0; q < N; q++) { var ce = labelEl("pz-lg-cl", B.cj, q, "grid-row:1;grid-column:" + (2 + q)); cl.push(ce); grid.append(ce); }
        for (r = 0; r < N; r++) { var re = labelEl("pz-lg-rl", B.ci, r, "grid-column:1;grid-row:" + (2 + r)); rl.push(re); grid.append(re); }
        var blk = makeBlock(bi); blk.style.gridRow = "2 / span " + N; blk.style.gridColumn = "2 / span " + N; grid.append(blk);
        rowLabOf[bi] = rl; colLabOf[bi] = cl;
        var sb = h("div", { class: "pz-lg-sb", role: NB > 1 ? "tabpanel" : null, id: uid + "-p" + bi, "aria-labelledby": NB > 1 ? uid + "-t" + bi : null, hidden: bi !== active },
          h("p", { class: "pz-lg-cap" }, "Hàng: ", h("b", { text: catTitle(B.ci) }), " · Cột: ", h("b", { text: catTitle(B.cj) })), grid);
        sbEl[bi] = sb; sbs.append(sb);
      }
      sbs.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse" || NB < 2) return; sw = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }; });
      sbs.addEventListener("pointerup", function (e) {
        if (!sw || e.pointerId !== sw.id) return;
        var dx = e.clientX - sw.x, dy = e.clientY - sw.y, dt = Date.now() - sw.t; sw = null;
        if (Math.abs(dx) > 56 && Math.abs(dx) > 1.8 * Math.abs(dy) && dt < 700) { swallow = Date.now(); setActive(clamp(active + (dx < 0 ? 1 : -1), 0, NB - 1), false); }
      });
      sbs.addEventListener("pointercancel", function () { sw = null; });
      wrap.append(sbs); areaEl.append(wrap);
    }
    function build() {
      cellEl = new Array(total); shownCls = []; shownVal = []; shownLab = []; blockEl = []; rowLabOf = []; colLabOf = []; litLabs = []; place = []; blockAt = {}; sbEl = []; chipEl = []; chipsEl = null; tabCell = -1; peerSet = {};
      if (active >= NB) active = 0;
      areaEl.className = "pz-lg-area " + mode; areaEl.replaceChildren();
      if (mode === "ladder") buildLadder(); else buildSingle();
      if (sel >= 0) peerSet = peersOf(sel);
      barUi.sync(); syncAll(); paintChips(); paintTab(); paintLabels();
    }

    // ---- kích thước ----------------------------------------------------------------------------------------
    function metrics() {
      var W = host.clientWidth; if (W < 60) return null;
      var font = "600 12.5px " + fam, i, rowC = [0], colC = [], rw = 0, cw = 0, lwCap = Math.max(54, Math.min(108, Math.floor(W * 0.32)));
      for (i = K - 1; i >= 2; i--) rowC.push(i);
      for (i = 1; i < K; i++) colC.push(i);
      function maxW(list) { var m = 0; list.forEach(function (c) { cats[c].items.forEach(function (s) { m = Math.max(m, textW(s, font) + (valueTag(c, 0) ? 14 : 0)); }); }); return m; }
      rw = maxW(rowC); cw = maxW(colC);
      var lw = clamp(Math.ceil(rw) + 18, 54, lwCap), hh = clamp(Math.ceil(cw) + 16, 46, 132), tw = 22, th = 26, cols = (K - 1) * N;
      var cfit = Math.floor((W - 4 - tw - lw) / cols), cmin = isCoarse() ? 30 : 24;
      var want = userMode || (K === 2 || cfit >= cmin ? "ladder" : "single"), out = { W: W, want: want, cfit: cfit };
      if (want === "ladder") { out.c = clamp(cfit, CELL_MIN, CELL_MAX_LADDER); out.lw = lw; out.hh = hh; out.tw = tw; out.th = th; out.cols = cols; return out; }
      out.lws = []; out.hhs = [];
      blocks.forEach(function (B) { out.lws.push(clamp(Math.ceil(maxW([B.ci])) + 18, 54, lwCap)); out.hhs.push(clamp(Math.ceil(maxW([B.cj])) + 16, 46, 132)); });
      var maxLw = Math.max.apply(null, out.lws);
      out.c = clamp(Math.floor((W - 4 - maxLw) / N), 24, CELL_MAX_SINGLE); out.hz = out.c >= 52;
      return out;
    }
    function applyMetrics(m) {
      var st = areaEl.style; areaMetrics = m;
      st.setProperty("--c", m.c + "px"); st.setProperty("--n", String(N));
      if (mode === "ladder") {
        st.setProperty("--lw", m.lw + "px"); st.setProperty("--hh", m.hh + "px"); st.setProperty("--tw", m.tw + "px"); st.setProperty("--th", m.th + "px"); st.setProperty("--cols", String(m.cols));
      } else {
        sbEl.forEach(function (sb, bi) { sb.style.setProperty("--lw", m.lws[bi] + "px"); sb.style.setProperty("--hh", (m.hz ? 46 : m.hhs[bi]) + "px"); });
        areaEl.classList.toggle("hz", !!m.hz);
      }
    }
    function relayout() {
      raf = 0; if (dead) return;
      var m = metrics();
      if (!m) { if (!built) { mode = "single"; build(); built = true; } return; }
      if (!built || m.want !== mode) { mode = m.want; build(); built = true; }
      applyMetrics(m);
    }
    function schedule(now) {
      if (dead) return;
      if (now) { if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf); relayout(); return; }
      if (raf) return;
      raf = root.requestAnimationFrame ? root.requestAnimationFrame(relayout) : (setTimeout(relayout, 16), 1);
    }

    // ---- vẽ ----------------------------------------------------------------------------------------------
    function peersOf(i) {
      var bi = blockOf(i), B = blocks[bi], o = i - B.base, a = (o / N) | 0, b = o % N, out = {}, k;
      for (k = 0; k < N; k++) { out[B.base + a * N + k] = 1; out[B.base + k * N + b] = 1; }
      return out;
    }
    function paintCell(i) {
      var el = cellEl[i]; if (!el) return;
      var v = game.state.v[i], cls = "pz-lg-cell", k = marks[i];
      if (v === 1) cls += " yes"; else if (v === 2) cls += " no";
      if (conf[i]) cls += " conflict";
      if (k) cls += " " + k;
      if (i === sel) cls += " sel"; else if (peerSet[i]) cls += " peer";
      if (cls !== shownCls[i]) { el.className = cls; el.setAttribute("aria-selected", String(i === sel)); }
      var lab = labelOf(i);
      if (v !== shownVal[i]) { el.innerHTML = v === 1 ? SVG_YES : v === 2 ? SVG_NO : ""; el.setAttribute("data-v", String(v)); }
      if (lab !== shownLab[i]) el.setAttribute("aria-label", lab);
      shownCls[i] = cls; shownVal[i] = v; shownLab[i] = lab;
    }
    function syncAll() { for (var i = 0; i < total; i++) paintCell(i); }
    function paintLabels() {
      var nl = [];
      if (sel >= 0) { var d = dispOf(sel); if (rowLabOf[d.bi] && rowLabOf[d.bi][d.r]) nl.push(rowLabOf[d.bi][d.r]); if (colLabOf[d.bi] && colLabOf[d.bi][d.q]) nl.push(colLabOf[d.bi][d.q]); }
      litLabs.forEach(function (e) { if (nl.indexOf(e) < 0) e.classList.remove("on"); });
      nl.forEach(function (e) { e.classList.add("on"); });
      litLabs = nl;
    }
    function paintTab() {
      var fi = sel >= 0 && visibleBlock(blockOf(sel)) ? sel : -1, bi, i;
      if (fi < 0) { bi = mode === "ladder" ? 0 : active; fi = bi * NN; }
      if (tabCell >= 0 && tabCell !== fi && cellEl[tabCell]) cellEl[tabCell].setAttribute("tabindex", "-1");
      if (cellEl[fi]) cellEl[fi].setAttribute("tabindex", "0");
      tabCell = fi;
      for (i = 0; i < NB; i++) if (chipEl[i]) { var on = i === active; chipEl[i].setAttribute("aria-selected", String(on)); chipEl[i].setAttribute("tabindex", on ? "0" : "-1"); }
    }
    function paintChips() {
      var vs = game.state.v, bi, o, n, bad;
      for (bi = 0; bi < NB; bi++) {
        var chip = chipEl[bi]; if (!chip) continue;
        var B = blocks[bi]; n = 0; bad = false;
        for (o = 0; o < NN; o++) { if (vs[B.base + o] === 1) n++; if (conf[B.base + o]) bad = true; }
        var cls = "pz-lg-chip" + (n === N ? " done" : "") + (bad ? " bad" : "") + (bi === active ? " on" : "");
        if (chip.className !== cls) chip.className = cls;
        var bd = chip.lastChild; bd.textContent = bad ? "!" : n === N ? "✓" : "";
        chip.setAttribute("aria-label", cats[B.ci].name + " × " + cats[B.cj].name + (bad ? ", có ô mâu thuẫn" : n === N ? ", đã đủ dấu ✓" : ""));
      }
    }
    function recompute() {
      var s = env.settings(), nc = {}, k, changed = [];
      if (s.showConflicts) { try { type.check(puzzle, game.state).conflicts.forEach(function (c) { nc[c] = 1; }); } catch (e) { /* bỏ qua */ } }
      for (k in conf) if (!nc[k]) changed.push(+k);
      for (k in nc) if (!conf[k]) changed.push(+k);
      conf = nc; changed.forEach(paintCell);
    }

    // ---- chọn ô, đổi khối
    function setActive(bi, focus) {
      if (mode !== "single" || bi < 0 || bi >= NB) return;
      active = bi;
      sbEl.forEach(function (sb, k) { sb.hidden = k !== bi; });
      paintTab(); paintChips();
      if (chipsEl && chipEl[bi]) { var c = chipEl[bi]; chipsEl.scrollLeft = Math.max(0, c.offsetLeft - (chipsEl.clientWidth - c.offsetWidth) / 2); }
      if (focus && cellEl[tabCell]) cellEl[tabCell].focus({ preventScroll: true });
      env.announce("Khối " + cats[blocks[bi].ci].name + " × " + cats[blocks[bi].cj].name);
    }
    function select(i, focus, quiet) {
      var old = peerSet, k;
      if (i >= 0 && mode === "single" && blockOf(i) !== active) { active = blockOf(i); sbEl.forEach(function (sb, b) { sb.hidden = b !== active; }); paintChips(); }
      sel = i; peerSet = i >= 0 ? peersOf(i) : {};
      for (k in old) paintCell(+k);
      for (k in peerSet) if (!old[k]) paintCell(+k);
      if (i >= 0) paintCell(i);
      paintLabels(); paintTab();
      if (focus && i >= 0 && cellEl[i]) cellEl[i].focus({ preventScroll: true });
      if (i >= 0 && !quiet) env.announce(labelOf(i));
    }
    function neighbor(i, dr, dq) {
      var d = dispOf(i), r = d.r + dr, q = d.q + dq;
      if (r >= 0 && r < N && q >= 0 && q < N) return idxOf(d.bi, r, q);
      if (mode === "ladder") {
        var pl = place[d.bi], rg = pl.rg + (r < 0 ? -1 : r >= N ? 1 : 0), cg = pl.cg + (q < 0 ? -1 : q >= N ? 1 : 0), nb = blockAt[rg + "," + cg];
        if (nb != null) return idxOf(nb, r < 0 ? N - 1 : r >= N ? 0 : r, q < 0 ? N - 1 : q >= N ? 0 : q);
      }
      return i;
    }

    // ---- thao tác
    function send(a, i) {
      if (ro) return null;
      var r = game.act(a);
      if (!r.ok) return r;
      var nv = game.state.v[i], extra = r.diff && r.diff.d ? r.diff.d.length - 1 : 0;
      env.announce(labelOf(i) + (extra > 0 ? ". Tự thêm " + extra + " dấu hệ quả." : "") + (r.mistakes ? " Dấu này không đúng với lời giải." : ""));
      return r;
    }
    function setVal(i, val) { if (ro) return; if (game.state.v[i] === val) return; send({ k: "set", i: i, val: val }, i); }
    function activate(i) {
      if (ro) return;
      var v = game.state.v[i];
      if (tool === "cycle") send({ k: "cycle", i: i }, i);
      else if (tool === "yes") setVal(i, v === 1 ? 0 : 1);
      else if (tool === "no") setVal(i, v === 2 ? 0 : 2);
      else setVal(i, 0);
    }

    // ---- sự kiện
    areaEl.addEventListener("click", function (e) {
      var chip = e.target.closest ? e.target.closest(".pz-lg-chip") : null;
      if (chip) { setActive(+chip.dataset.bi, false); chip.focus({ preventScroll: true }); return; }
      var c = e.target.closest ? e.target.closest(".pz-lg-cell") : null; if (!c) return;
      if (Date.now() - swallow < 350) return;
      var i = +c.dataset.i; select(i, true, !ro); activate(i);
    });
    areaEl.addEventListener("contextmenu", function (e) {
      var c = e.target.closest ? e.target.closest(".pz-lg-cell") : null; if (!c) return;
      e.preventDefault();                                   // không bật menu trình duyệt trên ô (nhấn giữ trên Android cũng vậy)
      if (e.button !== 2) return;
      var i = +c.dataset.i; select(i, true, !ro); setVal(i, game.state.v[i] === 1 ? 0 : 1);
    });
    areaEl.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tab = e.target.closest ? e.target.closest(".pz-lg-chip") : null;
      if (tab) {
        var nb = -1, bi = +tab.dataset.bi;
        if (e.key === "ArrowRight") nb = Math.min(NB - 1, bi + 1); else if (e.key === "ArrowLeft") nb = Math.max(0, bi - 1); else if (e.key === "Home") nb = 0; else if (e.key === "End") nb = NB - 1;
        if (nb >= 0) { e.preventDefault(); setActive(nb, false); chipEl[nb].focus({ preventScroll: true }); }
        return;
      }
      var c = e.target.closest ? e.target.closest(".pz-lg-cell") : null; if (!c) return;
      var i = +c.dataset.i, nx = -1, d;
      if (e.key === "ArrowRight") nx = neighbor(i, 0, 1); else if (e.key === "ArrowLeft") nx = neighbor(i, 0, -1); else if (e.key === "ArrowDown") nx = neighbor(i, 1, 0); else if (e.key === "ArrowUp") nx = neighbor(i, -1, 0);
      else if (e.key === "Home") { d = dispOf(i); nx = idxOf(d.bi, d.r, 0); } else if (e.key === "End") { d = dispOf(i); nx = idxOf(d.bi, d.r, N - 1); }
      if (nx >= 0) { e.preventDefault(); select(nx, true); return; }
      if (mode === "single" && NB > 1 && (e.key === "PageDown" || e.key === "]" || e.key === "PageUp" || e.key === "[")) {
        e.preventDefault(); var to = clamp(active + (e.key === "PageDown" || e.key === "]" ? 1 : -1), 0, NB - 1);
        if (to !== active) { setActive(to, false); select(to * NN + (i - blocks[blockOf(i)].base), true); }
        return;
      }
      if (e.key === "Escape") { select(-1, false); return; }
      if (ro) return;
      var k = e.key;
      if (k === " " || k === "Enter" || k === "Spacebar") { e.preventDefault(); sel !== i && select(i, false); activate(i); }
      else if (k === "v" || k === "V") { e.preventDefault(); setVal(i, 1); }
      else if (k === "x" || k === "X") { e.preventDefault(); setVal(i, 2); }
      else if (k === "Delete" || k === "Backspace" || k === "0") { e.preventDefault(); setVal(i, 0); }
    });

    offGame = game.on(function (ev) {
      if (dead) return;
      if (ev.type === "change") {
        if (ev.diff && ev.diff.d && !ev.reveal && !ev.restart) ev.diff.d.forEach(function (e) { if (e[0] === "v") paintCell(e[1]); });
        else syncAll();
        recompute(); paintSummary(); paintChips();
      } else if (ev.type === "hint") {
        hintClues = {}; var rg = ev.hint && ev.hint.regions;
        if (rg && rg.clues) rg.clues.forEach(function (k) { hintClues[k] = 1; });
        paintClues(true);
      } else if (ev.type === "status") paintChips();
    });

    // ---- khởi động
    relayout();
    recompute(); paintSummary(); paintClues(false);
    if (root.ResizeObserver) { resizeObs = new root.ResizeObserver(function () { if (host.clientWidth !== (areaMetrics && areaMetrics.W)) schedule(false); }); resizeObs.observe(host); }
    else root.addEventListener("resize", onWinResize);
    function onWinResize() { schedule(false); }
    try { if (root.matchMedia) { mq = root.matchMedia("(pointer: coarse)"); mqFn = function () { schedule(false); }; if (mq.addEventListener) mq.addEventListener("change", mqFn); else if (mq.addListener) mq.addListener(mqFn); } } catch (e) { mq = null; }

    return {
      destroy: function () {
        dead = true; if (offGame) offGame(); if (resizeObs) resizeObs.disconnect(); else root.removeEventListener("resize", onWinResize);
        if (mq && mqFn) { if (mq.removeEventListener) mq.removeEventListener("change", mqFn); else if (mq.removeListener) mq.removeListener(mqFn); }
        if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf);
        host.replaceChildren();
      },
      refresh: function () { recompute(); syncAll(); paintSummary(); paintChips(); },
      highlight: function (list, kind) {
        var old = marks, k; marks = {};
        var has = !!(kind && list && list.length);
        if (has) list.forEach(function (c) { marks[c] = kind; }); else hintClues = {};
        for (k in old) paintCell(+k);
        for (k in marks) if (!old[k]) paintCell(+k);
        paintClues(false);
        if (has) {
          var first = list[0];
          if (mode === "single" && blockOf(first) !== active) setActive(blockOf(first), false);
          var el = cellEl[first]; if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { /* bỏ qua */ } }
        }
      },
      focus: function () { var t = cellEl[tabCell >= 0 ? tabCell : 0]; if (t) t.focus({ preventScroll: true }); }
    };
  }

  /* ======================================================================================================== */
  /*  TRÌNH SOẠN                                                                                              */
  /* ======================================================================================================== */
  var KIND_ALIAS = { person: "person", people: "person", name: "person", color: "color", colour: "color", job: "job", profession: "job", pet: "pet", drink: "drink", city: "city", hobby: "hobby", vehicle: "vehicle", position: "position", pos: "position", age: "age" };
  var BAD_CHARS = /[=<>!|@,≠]/;

  function editor(host, env) {
    var type = env.type, lim = type.limits || { maxCats: 6, maxItems: 6, maxClues: 200 }, MAXC = lim.maxCats || 6, MAXI = lim.maxItems || 6, MAXK = lim.maxClues || 200;
    var uid = "pzlge" + (++MOUNTS), gid = 0, cats = [], rows = [], lastClue = null, rowInputs = [], vocab = [], vocabKind = {}, openVocab = false;
    try { vocab = type.vocabulary() || []; } catch (e) { vocab = []; }
    vocab.forEach(function (v) { vocabKind[fold(v.name)] = v.kind; });

    // ---- mô hình
    function defaultVals(c) {
      var nums = c.items.map(function (s) { var t = String(s).trim(); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; }), seen = {}, ok = nums.every(function (x) { return isFinite(x); });
      if (ok) { nums.forEach(function (x) { seen[x] = 1; }); ok = Object.keys(seen).length === nums.length; }
      return ok ? nums : c.items.map(function (_, i) { return i + 1; });
    }
    function valuesFor(c) {
      if (!c.ordered || !c.values) return null;
      var any = c.values.some(function (x) { return String(x).trim() !== ""; });
      if (!any) return null;
      var def = defaultVals(c);
      return c.items.map(function (_, i) { var s = String(c.values[i] == null ? "" : c.values[i]).trim(); if (s === "") return def[i]; var n = Number(s); return isFinite(n) ? n : s; });
    }
    function newCat(name, items, ordered, values) {
      var c = { id: ++gid, name: name, items: items.slice(), ordered: !!ordered, values: null };
      if (ordered) c.values = values ? values.map(String) : c.items.map(function () { return ""; });
      return c;
    }
    function catsFromInput(rc) {
      return rc.map(function (c) {
        var items = Array.isArray(c && c.items) ? c.items.map(function (x) { return String(x == null ? "" : x); }) : [];
        var ord = !!c && (c.ordered === true || c.ordered === 1 || c.ordered === "true"), vals = null;
        if (ord) { vals = Array.isArray(c.values) ? items.map(function (_, i) { return c.values[i] == null ? "" : String(c.values[i]); }) : null; }
        return newCat(String(c && c.name != null ? c.name : ""), items, ord, vals);
      });
    }
    function catsFromPuzzle(pz) {
      return pz.data.cats.map(function (c) {
        var tmp = { items: c.items }, def = defaultVals(tmp), same = c.ordered && c.values && c.values.every(function (x, i) { return x === def[i]; });
        return newCat(c.name, c.items, c.ordered, c.ordered && !same ? c.values : null);
      });
    }
    function exampleCats() { var ex = type.exampleInput(); return catsFromInput(ex.cats); }
    function dataForParse() {
      return { cats: cats.map(function (c, ci) {
        var items = c.items.map(function (s) { return String(s).replace(/\s+/g, " ").trim(); }).filter(function (s) { return s; });
        var nm = String(c.name).replace(/\s+/g, " ").trim() || ("Nhóm " + (ci + 1));
        var vals = c.ordered ? (valuesFor(c) || defaultVals({ items: items })) : null;
        return { name: nm, items: items, ordered: !!c.ordered, values: vals, kind: vocabKind[fold(nm)] || KIND_ALIAS[fold(nm)] || "" };
      }), clues: [] };
    }
    function loadInitial() {
      var inp = env.input, pz = env.puzzle;
      if (inp && Array.isArray(inp.cats) && inp.cats.length) {
        cats = catsFromInput(inp.cats);
        var d = dataForParse();
        rows = Array.isArray(inp.clues) ? inp.clues.map(function (x) { if (typeof x === "string") return x; try { return type.formatClue(x, d); } catch (e) { return ""; } }) : [];
      } else if (pz && pz.data && Array.isArray(pz.data.cats)) {
        cats = catsFromPuzzle(pz);
        rows = (pz.data.clues || []).map(function (cl, k) { try { return type.clueDSL(pz, k); } catch (e) { return ""; } });
      } else { cats = exampleCats(); rows = []; }
      if (!rows.length) rows = [""];
    }
    function buildInput() {
      return {
        cats: cats.map(function (c) { var o = { name: c.name, items: c.items.slice(), ordered: !!c.ordered, values: null }; if (c.ordered) { var v = valuesFor(c); if (v) o.values = v; } return o; }),
        clues: rows.map(function (s) { return String(s).trim(); }).filter(function (s) { return s; })
      };
    }
    function emit() { env.onChange(buildInput()); }

    // ---- khung giao diện
    var warnEl = h("div", { class: "pz-lg-warns", role: "status", "aria-live": "polite" });
    var groupsEl = h("div", { class: "pz-lg-groups" });
    var rowsEl = h("ol", { class: "pz-lg-rows", "aria-label": "Danh sách manh mối" });
    var palEl = h("div", { class: "pz-lg-pal" });
    var vocabEl = h("div", { class: "pz-lg-vocab", hidden: true });
    var stepCnt = h("b", { class: "pz-lg-stepn" });
    function btn(cls, text, label, fn, extra) {
      var b = h("button", Object.assign({ type: "button", class: cls }, extra || {}), text ? h("span", { text: text }) : null);
      if (label) b.setAttribute("aria-label", label);
      b.addEventListener("click", fn); return b;
    }

    // ---- nhóm
    function itemCount() { return cats.length ? cats[0].items.length : 0; }
    function groupWarnings() {
      var w = [], n0 = cats.length ? cats[0].items.length : 0, names = {};
      if (cats.length < 2) w.push("Cần ít nhất 2 nhóm.");
      cats.forEach(function (c, ci) {
        var tag = "Nhóm " + (ci + 1) + (c.name.trim() ? " «" + c.name.trim() + "»" : "") + ": ", seen = {};
        if (!c.name.trim()) w.push(tag + "chưa có tên."); else if (BAD_CHARS.test(c.name)) w.push(tag + "tên chứa ký tự không dùng được (= < > ! | @ ,).");
        else if (names[fold(c.name)]) w.push(tag + "trùng tên với nhóm khác."); names[fold(c.name)] = 1;
        if (c.items.length !== n0) w.push(tag + "có " + c.items.length + " mục, khác nhóm đầu (" + n0 + " mục): mọi nhóm phải cùng số mục.");
        if (c.items.length < 2 || c.items.length > MAXI) w.push(tag + "cần từ 2 đến " + MAXI + " mục (đang có " + c.items.length + ").");
        c.items.forEach(function (s) {
          var t = String(s).trim();
          if (!t) { if (w.indexOf(tag + "có mục trống.") < 0) w.push(tag + "có mục trống."); }
          else if (BAD_CHARS.test(t)) w.push(tag + "mục «" + t + "» chứa ký tự không dùng được (= < > ! | @ ,).");
          else if (seen[fold(t)]) w.push(tag + "mục «" + t + "» bị trùng trong nhóm.");
          seen[fold(t)] = 1;
        });
      });
      return w;
    }
    function paintWarns() {
      var w = groupWarnings();
      warnEl.replaceChildren.apply(warnEl, w.map(function (m) { return h("p", { class: "pz-lg-warn", text: "⚠ " + m }); }));
      warnEl.hidden = !w.length; stepCnt.textContent = String(itemCount());
    }
    function focusSel(sel) { var el = groupsEl.querySelector(sel); if (el) { el.focus(); if (el.select) el.select(); } }
    function renderGroups(focus) {
      groupsEl.replaceChildren();
      cats.forEach(function (c, ci) {
        var nameIn = h("input", { type: "text", class: "pz-lg-gname", maxlength: "40", value: c.name, placeholder: ci === 0 ? "Tên nhóm hàng (vd Người)" : "Tên nhóm (vd Màu)", "aria-label": "Tên nhóm " + (ci + 1), autocomplete: "off", spellcheck: "false", dataset: { g: String(c.id) } });
        nameIn.addEventListener("input", function () { c.name = nameIn.value; afterEdit(); });
        var ord = h("input", { type: "checkbox", class: "pz-lg-ordcb" }); ord.checked = !!c.ordered;
        ord.addEventListener("change", function () { c.ordered = ord.checked; if (c.ordered && !c.values) c.values = c.items.map(function () { return ""; }); renderGroups(); afterEdit(); });
        var head = h("div", { class: "pz-lg-ghead" },
          h("span", { class: "pz-lg-gnum", text: String(ci + 1) }), nameIn,
          h("label", { class: "pz-lg-ord", title: "Nhóm có thứ tự (vị trí, tuổi…) cho phép so sánh <, >, liền kề, hơn kém k" }, ord, h("span", { text: "Có thứ tự" })),
          cats.length > 2 ? btn("pz-lg-icon", "×", "Xoá nhóm " + (ci + 1) + (c.name.trim() ? " " + c.name.trim() : ""), function () { cats.splice(ci, 1); renderGroups(); afterEdit(); }, { title: "Xoá nhóm" }) : null);
        var items = h("div", { class: "pz-lg-items" + (c.ordered ? " ord" : "") });
        c.items.forEach(function (s, k) {
          var inp = h("input", { type: "text", class: "pz-lg-iname", maxlength: "40", value: s, placeholder: "Tên mục", "aria-label": "Mục " + (k + 1) + " của nhóm " + (c.name.trim() || ci + 1), autocomplete: "off", spellcheck: "false", dataset: { g: String(c.id), k: String(k) } });
          inp.addEventListener("input", function () { c.items[k] = inp.value; afterEdit(); });
          inp.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); if (k + 1 < c.items.length) focusSel(".pz-lg-iname[data-g='" + c.id + "'][data-k='" + (k + 1) + "']"); else addItem(c, true); }
          });
          var cell = h("div", { class: "pz-lg-item" }, inp);
          if (c.ordered) {
            var def = defaultVals({ items: c.items.map(function (x, j) { return j === k ? inp.value : x; }) });
            var vi = h("input", { type: "text", inputmode: "decimal", class: "pz-lg-ival", maxlength: "12", value: c.values && c.values[k] != null ? c.values[k] : "", placeholder: String(def[k]), "aria-label": "Giá trị số của mục " + (k + 1) + " (để trống: " + def[k] + ")", autocomplete: "off" });
            vi.addEventListener("input", function () { if (!c.values) c.values = c.items.map(function () { return ""; }); c.values[k] = vi.value; afterEdit(); });
            cell.append(vi);
          }
          if (c.items.length > 2) cell.append(btn("pz-lg-icon", "×", "Xoá mục " + (k + 1) + " của nhóm " + (c.name.trim() || ci + 1), function () { c.items.splice(k, 1); if (c.values) c.values.splice(k, 1); renderGroups(); afterEdit(); }, { title: "Xoá mục" }));
          items.append(cell);
        });
        var acts = h("div", { class: "pz-lg-gacts" }, c.items.length < MAXI ? btn("btn pz-lg-btn", "+ Thêm mục", "Thêm mục vào nhóm " + (c.name.trim() || ci + 1), function () { addItem(c, true); }) : null);
        var vk = vocabKind[fold(c.name)], vv = vocab.filter(function (x) { return x.kind === vk && x.pool; })[0];
        if (vk && vv) acts.append(btn("btn pz-lg-btn", "Gợi ý mục", "Điền gợi ý các mục cho nhóm " + c.name, function () { suggestItems(c, vk); }, { title: "Điền các mục mẫu từ kho từ vựng" }));
        groupsEl.append(h("article", { class: "pz-lg-gc" + (ci === 0 ? " first" : ""), "aria-label": "Nhóm " + (ci + 1) }, head,
          ci === 0 ? h("p", { class: "pz-lg-gtag", text: "Nhóm đầu là «hàng» của lưới (mỗi mục của nhóm khác được gán cho đúng một mục ở đây)." }) : null,
          c.ordered ? h("p", { class: "pz-lg-gtag", text: "Có thứ tự: ô nhỏ bên cạnh mục là giá trị số (để trống = 1, 2, 3… hoặc số trong tên mục)." }) : null, items, acts));
      });
      renderPalette(); renderTemplates(); validateRows(); paintWarns();
      if (focus) focusSel(focus);
    }
    function addItem(c, focus) {
      if (c.items.length >= MAXI) return;
      c.items.push(""); if (c.values) c.values.push("");
      renderGroups(focus ? ".pz-lg-iname[data-g='" + c.id + "'][data-k='" + (c.items.length - 1) + "']" : null); afterEdit();
    }
    function suggestItems(c, kind) {
      var v = vocab.filter(function (x) { return x.kind === kind; })[0], n = c.items.length;
      if (!v || !v.pool) return;
      c.items = v.pool.slice(0, n);
      renderGroups(); afterEdit();
    }
    function addGroup(name, items, ordered) {
      if (cats.length >= MAXC) { env.U && env.U.toast && env.U.toast("Tối đa " + MAXC + " nhóm."); return; }
      var n = itemCount() || 3, its = items ? items.slice(0, n) : [];
      while (its.length < n) its.push("");
      cats.push(newCat(name || "", its, ordered, null));
      renderGroups(".pz-lg-gname[data-g='" + cats[cats.length - 1].id + "']"); afterEdit();
    }
    function addVocabGroup(v) {
      var n = itemCount() || 3, items;
      if (v.pool) items = v.pool.slice(0, n);
      else if (v.kind === "position") { items = []; for (var i = 1; i <= n; i++) items.push(String(i)); }
      else { items = []; for (var j = 0; j < n; j++) items.push(String(20 + 5 * j)); }
      addGroup(v.name, items, v.ordered);
    }
    function setCount(delta) {
      var n = itemCount() + delta; if (n < 2 || n > MAXI) return;
      cats.forEach(function (c) {
        while (c.items.length < n) { c.items.push(""); if (c.values) c.values.push(""); }
        while (c.items.length > n) { c.items.pop(); if (c.values) c.values.pop(); }
      });
      renderGroups(); afterEdit();
    }
    function useExample() {
      var ex = type.exampleInput(); cats = catsFromInput(ex.cats);
      var d = dataForParse(); rows = ex.clues.map(function (x) { return typeof x === "string" ? x : type.formatClue(x, d); });
      renderGroups(); renderRows(); emit();
    }

    // ---- manh mối
    function tokenFor(ci, a) {
      var c = cats[ci], name = String(c.items[a]).trim(), f = fold(name), dup = false;
      cats.forEach(function (o, cj) { o.items.forEach(function (s, b) { if (!(cj === ci && b === a) && fold(s) === f) dup = true; }); });
      if (dup) return (String(c.name).trim() || "Nhóm") + ":" + name;
      return /^-?\d+(\.\d+)?$/.test(name) ? (String(c.name).trim() || "Nhóm") + " " + name : name;
    }
    function feedback(text, d) {
      var s = String(text).trim(); if (!s) return null;
      var r; try { r = type.parseClue(s, d); } catch (e) { r = { ok: false, error: "Không đọc được manh mối." }; }
      if (!r.ok) return { bad: true, msg: r.error };
      var t = ""; try { t = type.clueTextOf(r.clue, d); } catch (e) { /* bỏ qua */ }
      return { bad: false, msg: t };
    }
    var msgEls = [], rowEls = [];
    function paintRowMsg(k, d) {
      var m = msgEls[k], inp = rowInputs[k]; if (!m) return;
      var f = feedback(rows[k], d);
      m.className = "pz-lg-rowmsg" + (f ? (f.bad ? " bad" : " ok") : "");
      if (!f) m.textContent = ""; else m.textContent = f.bad ? "Dòng " + (k + 1) + ": " + f.msg : "→ " + f.msg;
      if (inp) { if (f && f.bad) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid"); }
    }
    function validateRows() { var d = dataForParse(); for (var k = 0; k < rows.length; k++) paintRowMsg(k, d); }
    function renderRows(focusAt) {
      rowsEl.replaceChildren(); rowInputs = []; msgEls = []; rowEls = [];
      rows.forEach(function (text, k) {
        var inp = h("input", { type: "text", class: "pz-lg-cin", value: text, placeholder: k === 0 ? "vd: Alice != Đỏ" : "Nhập manh mối…", "aria-label": "Manh mối " + (k + 1), autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "next" });
        var msg = h("p", { class: "pz-lg-rowmsg", role: "status" });
        function remember() { lastClue = { input: inp, start: inp.selectionStart, end: inp.selectionEnd }; }
        inp.addEventListener("input", function () { rows[k] = inp.value; paintRowMsg(k, dataForParse()); remember(); emit(); });
        ["focus", "keyup", "click", "select", "blur"].forEach(function (ev) { inp.addEventListener(ev, remember); });
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); addRow("", k + 1); }
          else if (e.key === "Backspace" && inp.value === "" && rows.length > 1) { e.preventDefault(); removeRow(k, Math.max(0, k - 1)); }
          else if (e.key === "ArrowUp" && rowInputs[k - 1]) { e.preventDefault(); rowInputs[k - 1].focus(); }
          else if (e.key === "ArrowDown" && rowInputs[k + 1]) { e.preventDefault(); rowInputs[k + 1].focus(); }
        });
        inp.addEventListener("paste", function (e) {
          var t = e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData("text") : "";
          if (!t || !/[\r\n]/.test(t)) return;
          e.preventDefault();
          var lines = t.split(/\r?\n/).map(function (l) { return l.replace(/^\s*\d+\s*[.)]\s*/, "").trim(); }).filter(function (l) { return l; });
          if (!lines.length) return;
          var cur = inp.value, a = inp.selectionStart == null ? cur.length : inp.selectionStart, b = inp.selectionEnd == null ? a : inp.selectionEnd;
          rows[k] = cur.slice(0, a) + lines[0] + cur.slice(b);
          var rest = lines.slice(1); rows.splice.apply(rows, [k + 1, 0].concat(rest)); rows = rows.slice(0, MAXK);
          renderRows(k + rest.length); emit();
        });
        var rm = btn("pz-lg-icon", "×", "Xoá manh mối " + (k + 1), function () { removeRow(k, Math.min(k, rows.length - 2)); }, { title: "Xoá dòng" });
        rowInputs.push(inp); msgEls.push(msg);
        var li = h("li", { class: "pz-lg-crow" }, h("div", { class: "pz-lg-cline" }, h("span", { class: "pz-lg-cn", "aria-hidden": "true", text: String(k + 1) }), inp, rows.length > 1 || text ? rm : null), msg);
        rowEls.push(li); rowsEl.append(li);
      });
      validateRows();
      if (focusAt != null && rowInputs[focusAt]) { rowInputs[focusAt].focus(); var L = rowInputs[focusAt].value.length; try { rowInputs[focusAt].setSelectionRange(L, L); } catch (e) { /* bỏ qua */ } }
    }
    function addRow(text, at) {
      if (rows.length >= MAXK) return;
      var pos = at == null ? rows.length : at; rows.splice(pos, 0, text || "");
      renderRows(pos); emit();
    }
    function removeRow(k, focusAt) {
      if (rows.length <= 1) { rows = [""]; renderRows(0); emit(); return; }
      rows.splice(k, 1); renderRows(focusAt); emit();
    }
    function insertAtCaret(text) {
      var lc = lastClue;
      if (!lc || !lc.input || !doc.contains(lc.input)) {
        var last = rows.length - 1;
        if (rows[last] !== "") addRow("", null);
        lc = lastClue = { input: rowInputs[rows.length - 1], start: 0, end: 0 };
      }
      var inp = lc.input, v = inp.value, s = lc.start == null ? v.length : lc.start, e2 = lc.end == null ? s : lc.end, pre = v.slice(0, s), post = v.slice(e2), ins = text;
      if (pre && !/\s$/.test(pre)) ins = " " + ins;
      if (post && !/^\s/.test(post)) ins += " ";
      inp.value = pre + ins + post;
      var pos = (pre + ins).length, k = rowInputs.indexOf(inp);
      if (k >= 0) { rows[k] = inp.value; paintRowMsg(k, dataForParse()); }
      inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (e) { /* bỏ qua */ }
      lastClue = { input: inp, start: pos, end: pos }; emit();
    }
    function renderPalette() {
      palEl.replaceChildren();
      var ops = h("div", { class: "pz-lg-palg" }, h("span", { class: "pz-lg-palh", text: "Phép toán" }));
      [["=", "=", "Cùng nhóm"], ["≠", "!=", "Khác nhóm"], ["hoặc", "|", "Hoặc (A = B | C)"], ["<", "<", "Đứng trước (nhóm có thứ tự)"], [">", ">", "Đứng sau"], ["liền kề", "next-to", "Liền kề"], ["không liền kề", "not-next-to", "Không liền kề"], ["+ k", "+ 1", "Hơn đúng k (B + k); sửa số 1 thành k"]].forEach(function (o) {
        var b = btn("pz-lg-chipb op", o[0], "Chèn phép toán: " + o[2], function () { insertAtCaret(o[1]); }, { title: o[2] });
        b.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") e.preventDefault(); });
        ops.append(b);
      });
      palEl.append(ops);
      cats.forEach(function (c, ci) {
        var g = h("div", { class: "pz-lg-palg" }, h("span", { class: "pz-lg-palh", text: c.name.trim() || ("Nhóm " + (ci + 1)) }));
        c.items.forEach(function (s, a) {
          if (!String(s).trim()) return;
          var b = btn("pz-lg-chipb", String(s).trim(), "Chèn mục " + String(s).trim(), function () { insertAtCaret(tokenFor(ci, a)); });
          b.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") e.preventDefault(); });
          g.append(b);
        });
        if (g.children.length > 1) palEl.append(g);
      });
    }
    var tplEl = h("div", { class: "pz-lg-tpl", role: "group", "aria-label": "Chèn nhanh một mẫu manh mối" });
    function renderTemplates() {
      tplEl.replaceChildren();
      var d = dataForParse(), N = d.cats.length && d.cats[0].items.length, oc = -1, i;
      for (i = 0; i < d.cats.length; i++) if (d.cats[i].ordered) { oc = i; break; }
      function tok(ci, a) { return d.cats[ci] && d.cats[ci].items[a] != null ? tokenFor(ci, a) : "?"; }
      var P0 = tok(0, 0), P1 = tok(0, 1), Q0 = tok(1, 0), Q1 = tok(1, 1);
      var defs = [
        { t: "A = B", tip: "Cùng nhóm", text: P0 + " = " + Q0, need: false },
        { t: "A ≠ B", tip: "Khác nhóm", text: P0 + " != " + Q0, need: false },
        { t: "A = B | C", tip: "A cùng nhóm với một trong hai (cần ≥ 3 mục mỗi nhóm)", text: P0 + " = " + Q0 + " | " + Q1, need: false, off: N < 3 || d.cats.length < 2 },
        { t: "A < B", tip: "Thứ tự: A đứng trước B (cần một nhóm có thứ tự)", text: P0 + " < " + P1, need: true },
        { t: "Liền kề", tip: "A và B liền kề (cần nhóm có thứ tự)", text: P0 + " next-to " + P1, need: true },
        { t: "Không liền kề", tip: "A và B không liền kề (cần nhóm có thứ tự)", text: P0 + " not-next-to " + P1, need: true },
        { t: "Hơn k", tip: "A hơn B đúng k (cần nhóm có thứ tự)", text: P0 + " = " + P1 + " + 1", need: true }
      ];
      defs.forEach(function (df) {
        var off = df.off || (df.need && oc < 0) || d.cats[0].items.length < 2;
        var b = btn("btn pz-lg-btn tpl", df.t, "Thêm mẫu: " + df.tip, function () { if (!off) { var k = rows.length === 1 && rows[0] === "" ? 0 : rows.length; if (k === 0) { rows[0] = df.text; renderRows(0); emit(); } else addRow(df.text, null); } }, { title: off ? df.tip + " — chưa dùng được" : df.tip });
        if (off) b.setAttribute("aria-disabled", "true");
        tplEl.append(b);
      });
    }
    function afterEdit() { renderPalette(); renderTemplates(); validateRows(); paintWarns(); emit(); }

    // ---- bảng vocab + cú pháp
    function renderVocab() {
      vocabEl.replaceChildren();
      vocab.forEach(function (v) {
        vocabEl.append(btn("pz-lg-chipb", v.name + (v.ordered ? " (thứ tự)" : ""), "Thêm nhóm gợi ý " + v.name, function () { addVocabGroup(v); }, { title: v.pool ? "Mục mẫu: " + v.pool.slice(0, 4).join(", ") + "…" : "Nhóm có thứ tự" }));
      });
    }
    var syn = [["A = B", "A và B cùng một nhóm", "Alice = Đỏ"], ["A != B", "A và B khác nhóm", "Alice != Đỏ"], ["A = B | C", "A cùng nhóm với B hoặc C", "Alice = Đỏ | Xanh"],
      ["A < B  (hoặc  A left-of B)", "giá trị thứ tự của A nhỏ hơn B", "An < Bình"], ["A > B", "A đứng sau B", "An > Bình"], ["A next-to B", "A, B liền kề (thứ tự chênh đúng 1)", "An next-to Bình"],
      ["A not-next-to B", "A, B không liền kề", "An not-next-to Bình"], ["A = B + k", "A hơn B đúng k", "An = Bình + 2"], ["… @Nhóm", "chọn nhóm có thứ tự khác (mặc định: nhóm có thứ tự đầu tiên)", "An < Bình @Tuổi"], ["Nhóm:Mục", "khi tên mục trùng giữa các nhóm", "Màu:Đỏ"]];
    var synTable = h("table", { class: "pz-lg-syn" }, h("thead", {}, h("tr", {}, h("th", { text: "Viết" }), h("th", { text: "Nghĩa" }), h("th", { text: "Ví dụ" }))),
      h("tbody", {}, syn.map(function (r) { return h("tr", {}, h("td", {}, h("code", { text: r[0] })), h("td", { text: r[1] }), h("td", {}, h("code", { text: r[2] }))); })));

    // ---- ráp
    loadInitial();
    var stepper = h("div", { class: "pz-lg-step", role: "group", "aria-label": "Số mục mỗi nhóm" },
      h("span", { text: "Số mục mỗi nhóm" }), btn("pz-lg-icon", "−", "Bớt một mục ở mọi nhóm", function () { setCount(-1); }), stepCnt, btn("pz-lg-icon", "+", "Thêm một mục ở mọi nhóm", function () { setCount(1); }));
    var vocabBtn = btn("btn pz-lg-btn", "Từ vựng gợi ý", "Mở hoặc đóng kho từ vựng gợi ý", function () { openVocab = !openVocab; vocabEl.hidden = !openVocab; vocabBtn.setAttribute("aria-expanded", String(openVocab)); }, { "aria-expanded": "false" });
    renderVocab();
    var secG = h("section", { class: "pz-lg-sec", "aria-label": "Nhóm và mục" }, h("h2", { text: "Nhóm và mục" }),
      h("p", { class: "pz-lg-hint", text: "Mỗi nhóm một loại thông tin (Người, Màu, Nghề…); mọi nhóm cùng số mục (2–" + MAXI + "). Nhóm đầu là «hàng»." }),
      h("div", { class: "pz-lg-tools2" }, btn("btn pz-lg-btn", "Dùng ví dụ", "Nạp ví dụ mẫu", useExample, { title: "Nạp ví dụ Alice/Bob/Carol" }), vocabBtn, btn("btn pz-lg-btn", "+ Thêm nhóm", "Thêm một nhóm", function () { addGroup("", null, false); }), stepper),
      vocabEl, warnEl, groupsEl);
    var secC = h("section", { class: "pz-lg-sec", "aria-label": "Manh mối" }, h("h2", { text: "Manh mối" }),
      h("p", { class: "pz-lg-hint", text: "Mỗi dòng một manh mối, ví dụ: Alice != Đỏ · Bob = Xanh · Carol = Bác sĩ | Kỹ sư. Dòng sai báo lỗi ngay bên dưới." }),
      tplEl, rowsEl, h("div", { class: "pz-lg-tools2" }, btn("btn pz-lg-btn", "+ Thêm dòng", "Thêm một dòng manh mối", function () { addRow("", null); })),
      h("details", { class: "pz-lg-det", open: true }, h("summary", { text: "Chèn tên mục / phép toán vào dòng đang soạn" }), palEl),
      h("details", { class: "pz-lg-det" }, h("summary", { text: "Bảng cú pháp manh mối" }), h("div", { class: "pz-lg-synwrap" }, synTable)));
    host.replaceChildren(h("div", { class: "pz-lg-ed" }, secG, secC));
    renderGroups(); renderRows(); emit();
    return { getInput: buildInput, destroy: function () { host.replaceChildren(); } };
  }

  P.boards = P.boards || {};
  P.boards.logicgrid = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
