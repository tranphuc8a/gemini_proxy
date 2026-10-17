/* puzzles/sudoku.js — ENGINE SUDOKU 9×9 (thuần, không DOM; chạy trong node và Web Worker). Hợp đồng: HUONG-DAN-ENGINE.md.

   THIẾT KẾ
   · Dữ liệu: state.v = 81 số 0..9 (0 = trống), state.c = 81 bitmask ứng viên (bit d = chữ số d, 1..9). Ô cho sẵn = ô có puzzle.initial.v != 0.
     puzzle.data = { unique: true|false } (đề sinh ra luôn duy nhất; đề tự nhập có thể nhiều nghiệm → `mistakes` tính theo luật chứ không theo solution).
   · HAI BỘ GIẢI, hai việc khác nhau:
       (a) Bộ giải BITMASK nhanh — quay lui + MRV (chọn ô ít ứng viên nhất), mặt nạ hàng/cột/block. Dùng để ĐẾM nghiệm tới 2 (sinh đề, validate, fromInput)
           và làm "nhà tiên tri" khi bộ giải người bị kẹt. Ngân sách đếm bằng NÚT tìm kiếm, không bằng thời gian → kết quả lặp lại được.
       (b) Bộ giải KỸ THUẬT CỦA NGƯỜI — chạy lặp, mỗi vòng áp đúng MỘT bước của kỹ thuật dễ nhất còn áp dụng được:
           naked single → hidden single → pointing / claiming (locked candidates) → naked pair → hidden pair → naked triple → hidden triple
           → X-Wing → Swordfish → XY-Wing → (hết kỹ thuật) đoán. Mỗi bước sinh `steps[]` có lời giải thích tiếng Việt: là cơ sở cho điểm khó, hint và replay.
           "Đoán" ở đây = một nước điền lấy từ lời giải của bộ giải nhanh (nhà tiên tri; ưu tiên puzzle.solution nếu còn khớp) vào ô ít ứng viên nhất, kèm lời giải thích
           "các giả thiết khác dẫn tới mâu thuẫn" (đã kiểm bằng bộ giải nhanh); số lần đoán (guesses) đi vào điểm khó. Hint đoán là nước ĐÚNG và có kiểm chứng,
           nhưng khác các kỹ thuật khác ở chỗ không phải một phép suy luận trực tiếp.
   · Điểm khó 0–10 (difficulty): xem DIFFICULTY_NOTE ở cuối tệp. Sinh đề (TIER_CFG): lưới đầy ngẫu nhiên (rng) → đào ô, mỗi lần đào kiểm còn nghiệm DUY NHẤT.
     Dễ = dừng ở 34–40 ô cho sẵn và chỉ bỏ ô nếu vẫn giải được bằng single; Vừa = đào tới tối giản dưới trần naked triple; Khó/Chuyên gia = đào tới tối giản
     không trần (Khó có thêm bước repair: đề tối giản cần đoán thì thêm LẠI từng ô cho sẵn tới khi rơi vào bậc Khó). Chấm điểm → nhận nếu rơi đúng khoảng bậc,
     không thì thử lại bằng rng.fork("try"+k) (tối đa MAX_TRIES lần; hết ngân sách thì trả đề gần nhất kèm bậc THẬT theo điểm). Chi phí mỗi lần thử ≈ 2–20 ms.
   · Gợi ý (hint): dùng ứng viên TÍNH LẠI từ các số đã điền (bỏ qua ghi chú pencil). Mức 1 chỉ nêu vùng cần nhìn (không có chữ số nào ngoài toạ độ), mức 2 nêu ô/mẫu và
     điều đã biết (naked single: "chỉ còn 1 ứng viên: {2}"), mức 3 là nước điền + `why`; kỹ thuật chỉ loại ứng viên thì `why` kể từng bước loại rồi tới nước điền kế tiếp.
     Có ô điền sai (không thể hoàn thành lưới) thì hint nói ô sai trước, action = xoá ô đó (technique "error"). hint.regions.units = chỉ số đơn vị cần nhìn:
     0–8 hàng 1–9, 9–17 cột 1–9, 18–26 block 1–9. Đối tượng đăng ký còn có `techniqueNames` (id kỹ thuật → tên hiển thị) để UI dùng.

   ACTION (UI → moveFor):  {k:"set", i, val}  val 0 = xoá; điền thì xoá ứng viên của chính ô đó, và nếu settings.autoRemove thì gạt val khỏi ứng viên của hàng/cột/block (cùng một diff)
                           {k:"cand", i, bit}  bật/tắt ứng viên bit 1..9 (chỉ ô trống)      {k:"clearcand", i}  xoá hết ứng viên của ô      {k:"autocand"}  điền ứng viên tính từ số đã điền cho mọi ô trống
   INPUT (fromInput): chuỗi 81 ô (như fromText) | mảng 81 số | { v:[…] } | { initial:{v} } | { text|cells: chuỗi/mảng } và tuỳ chọn { name, source, note, seed }.
   Ký hiệu ô: "R5C7" = hàng 5, cột 7 (đếm từ 1). Block đánh số 1..9 trái→phải, trên→dưới. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var ALL = 0x3FE;                        // bit 1..9
  var NODE_BUDGET = 500000;                // số nút tối đa cho solve/validate/fromInput (đề bất kỳ ≤ ~1 s)
  var DIG_NODE_BUDGET = 40000;             // nút tối đa cho MỘT lần kiểm duy nhất khi đào ô (quá ngân sách = coi như không duy nhất → không bỏ ô đó)
  var MAX_TRIES = 80;                      // số lần thử tối đa của generate (đếm bằng lần thử, KHÔNG bằng thời gian)

  // ---------------------------------------------------------------- bảng cố định
  var POP = [], ROW = [], COL = [], BOX = [], UNITS = [], PEERS = [], ISPEER = [];
  (function () {                            // dựng bảng trong phạm vi riêng để không rò biến đếm ra ngoài
    var a, b, m0, pc, mm, pe;
    for (m0 = 0; m0 < 1024; m0++) { pc = 0; mm = m0; while (mm) { pc += mm & 1; mm >>= 1; } POP[m0] = pc; }
    for (a = 0; a < 81; a++) { ROW[a] = Math.floor(a / 9); COL[a] = a % 9; BOX[a] = Math.floor(ROW[a] / 3) * 3 + Math.floor(COL[a] / 3); }
    for (a = 0; a < 27; a++) UNITS[a] = [];
    for (a = 0; a < 81; a++) { UNITS[ROW[a]].push(a); UNITS[9 + COL[a]].push(a); UNITS[18 + BOX[a]].push(a); }
    for (a = 0; a < 81; a++) {
      PEERS[a] = []; ISPEER[a] = [];
      for (b = 0; b < 81; b++) { pe = a !== b && (ROW[a] === ROW[b] || COL[a] === COL[b] || BOX[a] === BOX[b]); ISPEER[a][b] = pe; if (pe) PEERS[a].push(b); }
    }
  })();
  function lb(mask) { return 31 - Math.clz32(mask & -mask); }               // chỉ số bit thấp nhất
  function zeros(n) { var a = []; for (var q = 0; q < n; q++) a.push(0); return a; }

  // ---------------------------------------------------------------- chuỗi tiếng Việt
  function cn(i) { return "R" + (ROW[i] + 1) + "C" + (COL[i] + 1); }
  function cl(cells) { return cells.map(cn).join(", "); }
  function dl(mask) { var o = []; for (var d = 1; d <= 9; d++) if (mask & (1 << d)) o.push(d); return o.join(", "); }
  function dset(mask) { return "{" + dl(mask) + "}"; }
  function un(u) { return u < 9 ? "hàng " + (u + 1) : u < 18 ? "cột " + (u - 8) : "block " + (u - 17); }
  function unCap(u) { var s = un(u); return s.charAt(0).toUpperCase() + s.slice(1); }
  function boxSpan(b) { var br = Math.floor(b / 3) * 3, bc = (b % 3) * 3; return "hàng " + (br + 1) + "–" + (br + 3) + ", cột " + (bc + 1) + "–" + (bc + 3); }
  function unLong(u) { return u >= 18 ? un(u) + " (" + boxSpan(u - 18) + ")" : un(u); }
  function plain(s) { return s == null ? "" : String(s); }

  // ---------------------------------------------------------------- tiện ích lưới
  function validGrid(v) {
    if (!Array.isArray(v) || v.length !== 81) return false;
    for (var q = 0; q < 81; q++) { var x = v[q]; if (typeof x !== "number" || x !== Math.floor(x) || x < 0 || x > 9) return false; }
    return true;
  }
  function unitDigits(v, u) { var mk = 0, cells = UNITS[u]; for (var q = 0; q < 9; q++) { var d = v[cells[q]]; if (d > 0 && d <= 9) mk |= 1 << d; } return mk; }
  /** Ứng viên TÍNH LẠI từ các số đã điền (ô đã điền → 0). */
  function candidatesFrom(v) {
    var rows = zeros(9), cols = zeros(9), boxes = zeros(9), c = [], q, d;
    for (q = 0; q < 81; q++) { d = v[q]; if (d > 0 && d <= 9) { rows[ROW[q]] |= 1 << d; cols[COL[q]] |= 1 << d; boxes[BOX[q]] |= 1 << d; } }
    for (q = 0; q < 81; q++) c[q] = v[q] ? 0 : (ALL & ~(rows[ROW[q]] | cols[COL[q]] | boxes[BOX[q]]));
    return c;
  }
  /** Các ô trùng chữ số trong hàng/cột/block (cả hai ô của mỗi cặp), tăng dần. */
  function conflictCells(v) {
    var bad = [], u, q, d, first;
    for (u = 0; u < 27; u++) {
      first = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
      for (q = 0; q < 9; q++) {
        var cell = UNITS[u][q]; d = v[cell];
        if (!(d > 0 && d <= 9)) continue;
        if (first[d] >= 0) { bad[first[d]] = true; bad[cell] = true; } else first[d] = cell;
      }
    }
    var out = []; for (q = 0; q < 81; q++) if (bad[q]) out.push(q);
    return out;
  }

  // ---------------------------------------------------------------- (a) bộ giải bitmask nhanh: quay lui + MRV, đếm nghiệm tới `limit`
  /** search(grid, limit, maxNodes, rng?) → { count, solution|null, nodes, truncated, conflict }.
      rng (tuỳ chọn) xáo thứ tự thử chữ số — dùng để sinh lưới đầy tất định. Không sửa `grid`. */
  function search(grid, limit, maxNodes, rng) {
    var rows = zeros(9), cols = zeros(9), boxes = zeros(9), b = grid.slice(), emp = [], q, d, bit;
    var res = { count: 0, solution: null, nodes: 0, truncated: false, conflict: false };
    for (q = 0; q < 81; q++) {
      d = b[q];
      if (d) {
        bit = 1 << d;
        if ((rows[ROW[q]] | cols[COL[q]] | boxes[BOX[q]]) & bit) { res.conflict = true; return res; }
        rows[ROW[q]] |= bit; cols[COL[q]] |= bit; boxes[BOX[q]] |= bit;
      } else emp.push(q);
    }
    function rec(left) {
      if (left === 0) { res.count++; if (!res.solution) res.solution = b.slice(); return; }
      var bestK = 0, bestM = 0, bestN = 10, kk, cell, mk, n;
      for (kk = 0; kk < left; kk++) {
        cell = emp[kk]; mk = ~(rows[ROW[cell]] | cols[COL[cell]] | boxes[BOX[cell]]) & ALL; n = POP[mk];
        if (n < bestN) { bestN = n; bestK = kk; bestM = mk; if (n < 2) break; }
      }
      if (bestN === 0) return;
      if (++res.nodes > maxNodes) { res.truncated = true; return; }
      cell = emp[bestK]; emp[bestK] = emp[left - 1]; emp[left - 1] = cell;
      var r = ROW[cell], c = COL[cell], x = BOX[cell], bt, dg, ds, z;
      if (rng) {
        ds = []; for (dg = 1; dg <= 9; dg++) if (bestM & (1 << dg)) ds.push(dg);
        rng.shuffle(ds);
        for (z = 0; z < ds.length; z++) {
          dg = ds[z]; bt = 1 << dg; b[cell] = dg; rows[r] |= bt; cols[c] |= bt; boxes[x] |= bt;
          rec(left - 1);
          rows[r] &= ~bt; cols[c] &= ~bt; boxes[x] &= ~bt; b[cell] = 0;
          if (res.truncated || res.count >= limit) return;
        }
      } else {
        while (bestM) {
          bt = bestM & -bestM; bestM ^= bt; dg = 31 - Math.clz32(bt);
          b[cell] = dg; rows[r] |= bt; cols[c] |= bt; boxes[x] |= bt;
          rec(left - 1);
          rows[r] &= ~bt; cols[c] &= ~bt; boxes[x] &= ~bt; b[cell] = 0;
          if (res.truncated || res.count >= limit) return;
        }
      }
    }
    rec(emp.length);
    return res;
  }

  // ---------------------------------------------------------------- (b) bộ giải kỹ thuật của người
  var TECH_NAME = {
    "naked-single": "Ô duy nhất (Naked Single)", "hidden-single": "Số duy nhất (Hidden Single)", "pointing": "Pointing (khoá ứng viên)", "claiming": "Claiming (box/line reduction)",
    "naked-pair": "Cặp trần (Naked Pair)", "hidden-pair": "Cặp ẩn (Hidden Pair)", "naked-triple": "Bộ ba trần (Naked Triple)", "hidden-triple": "Bộ ba ẩn (Hidden Triple)",
    "x-wing": "X-Wing", "swordfish": "Swordfish", "xy-wing": "XY-Wing", "guess": "Thử giả thiết (quay lui)"
  };
  var LEVEL = { "naked-single": 0, "hidden-single": 1, "pointing": 2, "claiming": 2, "naked-pair": 3, "hidden-pair": 4, "naked-triple": 5, "hidden-triple": 6, "x-wing": 7, "swordfish": 8, "xy-wing": 9, "guess": 10 };
  var MAX_LEVEL = 10;

  function mkPlace(tech, cell, digit, unit, text, why) { return { technique: tech, kind: "place", cell: cell, digit: digit, elims: [], cells: [cell], unit: unit, text: text, why: why }; }
  function mkElim(tech, cells, elims, unit, text, why, extra) { return { technique: tech, kind: "elim", cell: -1, digit: 0, elims: elims, cells: cells, unit: unit, text: text, why: why, dmask: extra && extra.dmask || 0, lines: extra && extra.lines || [] }; }
  /** [[ô, chữ số]…] → "loại 2 khỏi R5C5, R5C8; loại 7 khỏi R5C1". */
  function elimText(elims) {
    var by = {}, ds = [], o = [], q;
    for (q = 0; q < elims.length; q++) { var d = elims[q][1]; if (!by[d]) { by[d] = []; ds.push(d); } by[d].push(elims[q][0]); }
    ds.sort(function (a, b) { return a - b; });
    for (q = 0; q < ds.length; q++) o.push("loại " + ds[q] + " khỏi " + cl(by[ds[q]]));
    return o.join("; ");
  }
  function cellsWith(S, u, d) {
    var out = [], bit = 1 << d, cells = UNITS[u];
    for (var q = 0; q < 9; q++) { var x = cells[q]; if (S.v[x] === 0 && (S.c[x] & bit)) out.push(x); }
    return out;
  }
  function hasText(name, mask) { return mask ? name + " đã có " + dl(mask) + "." : name + " chưa có chữ số nào."; }

  function nakedSingle(S) {
    var v = S.v, c = S.c;
    for (var q = 0; q < 81; q++) if (v[q] === 0 && POP[c[q]] === 1) {
      var d = lb(c[q]), text = "", why = [];
      if (S.ex) {
        var rd = unitDigits(v, ROW[q]), cd = unitDigits(v, 9 + COL[q]), bd = unitDigits(v, 18 + BOX[q]);
        text = "Ô " + cn(q) + " chỉ còn một ứng viên nên điền " + d + ".";
        if ((ALL & ~(rd | cd | bd)) === c[q]) {
          why = [hasText("Hàng " + (ROW[q] + 1), rd), hasText("Cột " + (COL[q] + 1), cd), hasText("Block " + (BOX[q] + 1) + " (" + boxSpan(BOX[q]) + ")", bd),
            "→ ba nhóm này đã loại mọi chữ số khác, ô " + cn(q) + " chỉ còn " + d + "."];
        } else why = ["Sau các phép loại ứng viên ở các bước trước, ô " + cn(q) + " chỉ còn một ứng viên: " + d + "."];
      }
      return mkPlace("naked-single", q, d, -1, text, why);
    }
    return null;
  }

  var HS_ORDER = [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  function hiddenSingle(S) {
    var v = S.v, c = S.c, t, u, q, cells, placed, ones, twos, mk, single, d, cell, bit;
    for (t = 0; t < 27; t++) {
      u = HS_ORDER[t]; cells = UNITS[u]; placed = 0; ones = 0; twos = 0;
      for (q = 0; q < 9; q++) { cell = cells[q]; if (v[cell]) placed |= 1 << v[cell]; else { mk = c[cell]; twos |= ones & mk; ones |= mk; } }
      if (ALL & ~ones & ~placed) return { contradiction: true };
      single = ones & ~twos & ~placed & ALL;
      if (!single) continue;
      d = lb(single); bit = 1 << d;
      for (q = 0; q < 9; q++) { cell = cells[q]; if (v[cell] === 0 && (c[cell] & bit)) break; }
      var text = "", why = [];
      if (S.ex) {
        var others = [], blocked = true, z;
        for (z = 0; z < 9; z++) {
          var o = cells[z]; if (o === cell || v[o] !== 0) continue;
          others.push(o);
          var seen = false, pz;
          for (pz = 0; pz < PEERS[o].length; pz++) if (v[PEERS[o][pz]] === d) { seen = true; break; }
          if (!seen) blocked = false;
        }
        text = "Trong " + un(u) + ", chữ số " + d + " chỉ đặt được ở ô " + cn(cell) + ".";
        why = ["Trong " + unLong(u) + ", chữ số " + d + " chỉ đặt được ở ô " + cn(cell) + "."];
        if (others.length) why.push(blocked
          ? "Các ô trống còn lại của " + un(u) + " (" + cl(others) + ") đều đã có " + d + " ở hàng, cột hoặc block của chúng nên không thể là " + d + "."
          : "Các ô trống còn lại của " + un(u) + " (" + cl(others) + ") không thể là " + d + " (do hàng, cột, block hoặc các phép loại ứng viên ở bước trước).");
        why.push("→ " + cn(cell) + " = " + d + ".");
      }
      return mkPlace("hidden-single", cell, d, u, text, why);
    }
    return null;
  }

  function pointing(S) {
    var b, d, cells, kk, allRow, allCol, line, elims, bit, x, u, ux;
    for (b = 0; b < 9; b++) for (d = 1; d <= 9; d++) {
      cells = cellsWith(S, 18 + b, d); if (cells.length < 2) continue;
      bit = 1 << d; allRow = true; allCol = true;
      for (kk = 1; kk < cells.length; kk++) { if (ROW[cells[kk]] !== ROW[cells[0]]) allRow = false; if (COL[cells[kk]] !== COL[cells[0]]) allCol = false; }
      if (!allRow && !allCol) continue;
      u = allRow ? ROW[cells[0]] : 9 + COL[cells[0]]; elims = [];
      for (kk = 0; kk < 9; kk++) { x = UNITS[u][kk]; if (BOX[x] !== b && S.v[x] === 0 && (S.c[x] & bit)) elims.push([x, d]); }
      if (!elims.length) continue;
      var text = "", why = [];
      if (S.ex) {
        text = "Pointing: trong " + un(18 + b) + ", chữ số " + d + " chỉ còn ở " + un(u) + " → " + elimText(elims) + ".";
        why = ["Trong " + unLong(18 + b) + ", chữ số " + d + " chỉ còn đặt được ở " + cl(cells) + " — các ô này cùng nằm trên " + un(u) + ".",
          "Một trong các ô đó chắc chắn là " + d + ", nên " + d + " không thể nằm ở các ô khác của " + un(u) + " nằm ngoài " + un(18 + b) + ".",
          "→ " + elimText(elims) + "."];
      }
      ux = u;
      return mkElim("pointing", cells, elims, ux, text, why, { dmask: bit });
    }
    return null;
  }

  function claiming(S) {
    var u, d, cells, kk, same, elims, bit, bx, x, text, why;
    for (u = 0; u < 18; u++) for (d = 1; d <= 9; d++) {
      cells = cellsWith(S, u, d); if (cells.length < 2) continue;
      bx = BOX[cells[0]]; same = true;
      for (kk = 1; kk < cells.length; kk++) if (BOX[cells[kk]] !== bx) same = false;
      if (!same) continue;
      bit = 1 << d; elims = [];
      for (kk = 0; kk < 9; kk++) {
        x = UNITS[18 + bx][kk];
        if (S.v[x] === 0 && (S.c[x] & bit) && (u < 9 ? ROW[x] !== u : COL[x] !== u - 9)) elims.push([x, d]);
      }
      if (!elims.length) continue;
      text = ""; why = [];
      if (S.ex) {
        text = "Claiming: trong " + un(u) + ", chữ số " + d + " chỉ còn ở " + un(18 + bx) + " → " + elimText(elims) + ".";
        why = ["Trong " + un(u) + ", chữ số " + d + " chỉ còn đặt được ở " + cl(cells) + " — các ô này cùng nằm trong " + unLong(18 + bx) + ".",
          "Một trong các ô đó chắc chắn là " + d + ", nên " + d + " không thể nằm ở các ô khác của " + un(18 + bx) + " nằm ngoài " + un(u) + ".",
          "→ " + elimText(elims) + "."];
      }
      return mkElim("claiming", cells, elims, 18 + bx, text, why, { dmask: bit });
    }
    return null;
  }

  var NAME_K = { 2: "hai", 3: "ba" };
  function nakedTry(S, u, combo, kk) {
    var union = 0, q, x, elims = [], d, mk;
    for (q = 0; q < combo.length; q++) union |= S.c[combo[q]];
    if (POP[union] !== kk) return null;
    for (q = 0; q < 9; q++) {
      x = UNITS[u][q]; if (S.v[x] !== 0 || combo.indexOf(x) >= 0) continue;
      mk = S.c[x] & union;
      for (d = 1; d <= 9; d++) if (mk & (1 << d)) elims.push([x, d]);
    }
    if (!elims.length) return null;
    var tech = kk === 2 ? "naked-pair" : "naked-triple", text = "", why = [];
    if (S.ex) {
      text = (kk === 2 ? "Cặp trần " : "Bộ ba trần ") + dset(union) + " ở " + cl(combo) + " (" + un(u) + ") → " + elimText(elims) + ".";
      why = [cl(combo) + " là " + NAME_K[kk] + " ô trong " + unLong(u) + " mà hợp các ứng viên chỉ gồm " + kk + " chữ số " + dset(union) + ".",
        "Vậy " + kk + " chữ số này buộc phải nằm trong " + NAME_K[kk] + " ô đó (mỗi ô một chữ số) — không còn chỗ cho chúng ở các ô khác của " + un(u) + ".",
        "→ " + elimText(elims) + "."];
    }
    return mkElim(tech, combo, elims, u, text, why, { dmask: union });
  }
  function nakedSubset(S, kk) {
    var u, cand, i1, j1, l1, n, x, st;
    for (u = 0; u < 27; u++) {
      cand = [];
      for (i1 = 0; i1 < 9; i1++) { x = UNITS[u][i1]; if (S.v[x] === 0 && POP[S.c[x]] >= 2 && POP[S.c[x]] <= kk) cand.push(x); }
      n = cand.length;
      for (i1 = 0; i1 < n; i1++) for (j1 = i1 + 1; j1 < n; j1++) {
        if (kk === 2) { st = nakedTry(S, u, [cand[i1], cand[j1]], 2); if (st) return st; }
        else for (l1 = j1 + 1; l1 < n; l1++) { st = nakedTry(S, u, [cand[i1], cand[j1], cand[l1]], 3); if (st) return st; }
      }
    }
    return null;
  }

  function hiddenTry(S, u, loc, digs, kk) {
    var union = 0, dmask = 0, q, x, elims = [], d, extra, cells = [];
    for (q = 0; q < digs.length; q++) { union |= loc[digs[q]]; dmask |= 1 << digs[q]; }
    if (POP[union] !== kk) return null;
    for (q = 0; q < 9; q++) if (union & (1 << q)) {
      x = UNITS[u][q]; cells.push(x); extra = S.c[x] & ~dmask;
      for (d = 1; d <= 9; d++) if (extra & (1 << d)) elims.push([x, d]);
    }
    if (!elims.length) return null;
    var tech = kk === 2 ? "hidden-pair" : "hidden-triple", text = "", why = [];
    if (S.ex) {
      text = (kk === 2 ? "Cặp ẩn " : "Bộ ba ẩn ") + dset(dmask) + " ở " + cl(cells) + " (" + un(u) + ") → " + elimText(elims) + ".";
      why = ["Trong " + unLong(u) + ", các chữ số " + dset(dmask) + " chỉ đặt được trong " + NAME_K[kk] + " ô " + cl(cells) + ".",
        NAME_K[kk].charAt(0).toUpperCase() + NAME_K[kk].slice(1) + " ô đó phải chứa đủ " + kk + " chữ số này, nên mọi ứng viên khác trong chúng đều thừa.",
        "→ " + elimText(elims) + "."];
    }
    return mkElim(tech, cells, elims, u, text, why, { dmask: dmask });
  }
  function hiddenSubset(S, kk) {
    var u, loc, digs, d, pos, x, i1, j1, l1, n, st;
    for (u = 0; u < 27; u++) {
      loc = zeros(10);
      for (pos = 0; pos < 9; pos++) { x = UNITS[u][pos]; if (S.v[x] === 0) for (d = 1; d <= 9; d++) if (S.c[x] & (1 << d)) loc[d] |= 1 << pos; }
      digs = [];
      for (d = 1; d <= 9; d++) if (POP[loc[d]] >= 2 && POP[loc[d]] <= kk) digs.push(d);
      n = digs.length;
      for (i1 = 0; i1 < n; i1++) for (j1 = i1 + 1; j1 < n; j1++) {
        if (kk === 2) { st = hiddenTry(S, u, loc, [digs[i1], digs[j1]], 2); if (st) return st; }
        else for (l1 = j1 + 1; l1 < n; l1++) { st = hiddenTry(S, u, loc, [digs[i1], digs[j1], digs[l1]], 3); if (st) return st; }
      }
    }
    return null;
  }

  function fishTry(S, d, orient, combo, lm, kk) {
    var union = 0, q, p, l2, cell, elims = [], bit = 1 << d, base = [], lineNo, cover = [];
    for (q = 0; q < combo.length; q++) union |= lm[combo[q]];
    if (POP[union] !== kk) return null;
    for (p = 0; p < 9; p++) if (union & (1 << p)) {
      cover.push(p);
      for (l2 = 0; l2 < 9; l2++) {
        if (combo.indexOf(l2) >= 0) continue;
        cell = orient === 0 ? l2 * 9 + p : p * 9 + l2;
        if (S.v[cell] === 0 && (S.c[cell] & bit)) elims.push([cell, d]);
      }
    }
    if (!elims.length) return null;
    var cells = [];
    for (q = 0; q < combo.length; q++) for (p = 0; p < 9; p++) if (lm[combo[q]] & (1 << p)) cells.push(orient === 0 ? combo[q] * 9 + p : p * 9 + combo[q]);
    var tech = kk === 2 ? "x-wing" : "swordfish", text = "", why = [];
    if (S.ex) {
      var lines = combo.map(function (l) { return (l + 1); }).join(", "), covers = cover.map(function (l) { return (l + 1); }).join(", ");
      var baseName = orient === 0 ? "hàng" : "cột", coverName = orient === 0 ? "cột" : "hàng";
      text = (kk === 2 ? "X-Wing" : "Swordfish") + " chữ số " + d + " trên " + baseName + " " + lines + " và " + coverName + " " + covers + " → " + elimText(elims) + ".";
      why = ["Trong mỗi " + baseName + " " + lines + ", chữ số " + d + " chỉ còn đặt được ở các ô trong " + coverName + " " + covers + " (" + cl(cells) + ").",
        NAME_K[kk].charAt(0).toUpperCase() + NAME_K[kk].slice(1) + " " + baseName + " này cần đúng " + kk + " chữ số " + d + ", mà chỉ có " + kk + " " + coverName + " " + covers + " để đặt — nên mỗi " + coverName + " đó đã 'dùng' chữ số " + d + " cho các " + baseName + " này.",
        "→ " + coverName + " " + covers + " không còn chỗ cho " + d + " ở các " + baseName + " khác: " + elimText(elims) + "."];
    }
    return mkElim(tech, cells, elims, -1, text, why, { dmask: bit, lines: combo.map(function (l) { return orient === 0 ? l : 9 + l; }) });
  }
  function fish(S, kk) {
    var d, orient, lm, elig, l, p, cell, bit, n, i1, j1, l1, st;
    for (d = 1; d <= 9; d++) {
      bit = 1 << d;
      for (orient = 0; orient < 2; orient++) {
        lm = zeros(9); elig = [];
        for (l = 0; l < 9; l++) {
          for (p = 0; p < 9; p++) { cell = orient === 0 ? l * 9 + p : p * 9 + l; if (S.v[cell] === 0 && (S.c[cell] & bit)) lm[l] |= 1 << p; }
          if (POP[lm[l]] >= 2 && POP[lm[l]] <= kk) elig.push(l);
        }
        n = elig.length;
        for (i1 = 0; i1 < n; i1++) for (j1 = i1 + 1; j1 < n; j1++) {
          if (kk === 2) { st = fishTry(S, d, orient, [elig[i1], elig[j1]], lm, 2); if (st) return st; }
          else for (l1 = j1 + 1; l1 < n; l1++) { st = fishTry(S, d, orient, [elig[i1], elig[j1], elig[l1]], lm, 3); if (st) return st; }
        }
      }
    }
    return null;
  }

  function xyWing(S) {
    var v = S.v, c = S.c, pv, pm, ps, a, b, w1, w2, m1, m2, z, t, elims, x, y;
    for (pv = 0; pv < 81; pv++) {
      if (v[pv] !== 0 || POP[c[pv]] !== 2) continue;
      pm = c[pv]; ps = PEERS[pv];
      for (a = 0; a < ps.length; a++) {
        w1 = ps[a]; m1 = c[w1];
        if (v[w1] !== 0 || POP[m1] !== 2 || POP[m1 & pm] !== 1) continue;
        for (b = a + 1; b < ps.length; b++) {
          w2 = ps[b]; m2 = c[w2];
          if (v[w2] !== 0 || POP[m2] !== 2 || POP[m2 & pm] !== 1) continue;
          if ((m1 & pm) === (m2 & pm)) continue;
          if ((m1 & ~pm) !== (m2 & ~pm)) continue;
          z = m1 & ~pm; elims = [];
          for (t = 0; t < 81; t++) {
            if (t === pv || t === w1 || t === w2 || v[t] !== 0 || !(c[t] & z)) continue;
            if (ISPEER[t][w1] && ISPEER[t][w2]) elims.push([t, lb(z)]);
          }
          if (!elims.length) continue;
          var text = "", why = [], zd = lb(z);
          if (S.ex) {
            x = lb(m1 & pm); y = lb(m2 & pm);
            text = "XY-Wing: trục " + cn(pv) + " " + dset(pm) + ", cánh " + cn(w1) + " " + dset(m1) + " và " + cn(w2) + " " + dset(m2) + " → " + elimText(elims) + ".";
            why = ["Trục " + cn(pv) + " chỉ có thể là " + x + " hoặc " + y + "; cánh " + cn(w1) + " " + dset(m1) + " và cánh " + cn(w2) + " " + dset(m2) + " đều nhìn thấy trục.",
              "Nếu trục là " + x + " thì " + cn(w1) + " phải là " + zd + "; nếu trục là " + y + " thì " + cn(w2) + " phải là " + zd + ". Dù thế nào, một trong hai cánh cũng là " + zd + ".",
              "→ mọi ô nhìn thấy cả hai cánh không thể là " + zd + ": " + elimText(elims) + "."];
          }
          return mkElim("xy-wing", [pv, w1, w2], elims, -1, text, why, { dmask: pm | m1 | m2 });
        }
      }
    }
    return null;
  }

  var TECHS = [
    { id: "naked-single", level: 0, fn: nakedSingle }, { id: "hidden-single", level: 1, fn: hiddenSingle },
    { id: "pointing", level: 2, fn: pointing }, { id: "claiming", level: 2, fn: claiming },
    { id: "naked-pair", level: 3, fn: function (S) { return nakedSubset(S, 2); } }, { id: "hidden-pair", level: 4, fn: function (S) { return hiddenSubset(S, 2); } },
    { id: "naked-triple", level: 5, fn: function (S) { return nakedSubset(S, 3); } }, { id: "hidden-triple", level: 6, fn: function (S) { return hiddenSubset(S, 3); } },
    { id: "x-wing", level: 7, fn: function (S) { return fish(S, 2); } }, { id: "swordfish", level: 8, fn: function (S) { return fish(S, 3); } },
    { id: "xy-wing", level: 9, fn: xyWing }
  ];

  /** Bước kỹ thuật dễ nhất còn áp dụng được (cấp ≤ maxLevel); null nếu hết; { contradiction:true } nếu vô nghiệm. */
  function findStep(S, maxLevel) {
    var q, st;
    for (q = 0; q < 81; q++) if (S.v[q] === 0 && S.c[q] === 0) return { contradiction: true };
    for (q = 0; q < TECHS.length; q++) {
      if (TECHS[q].level > maxLevel) break;
      st = TECHS[q].fn(S);
      if (st) return st;
    }
    return null;
  }
  function applyStep(S, st) {
    var q, e, bit;
    if (st.kind === "elim") { for (q = 0; q < st.elims.length; q++) { e = st.elims[q]; S.c[e[0]] &= ~(1 << e[1]); } return; }
    bit = 1 << st.digit; S.v[st.cell] = st.digit; S.c[st.cell] = 0;
    for (q = 0; q < PEERS[st.cell].length; q++) S.c[PEERS[st.cell][q]] &= ~bit;
  }

  /** Bước "đoán": ô ít ứng viên nhất (hoà → chỉ số nhỏ nhất), chữ số lấy từ lời giải của bộ giải nhanh (nhà tiên tri). null nếu vô nghiệm. */
  function guessStep(S, orc) {
    if (orc.sol === undefined) {
      var q0, okg = !!orc.given;
      if (okg) for (q0 = 0; q0 < 81; q0++) if (S.v[q0] && S.v[q0] !== orc.given[q0]) { okg = false; break; }
      if (okg) orc.sol = orc.given;                                    // lời giải đã biết (puzzle.solution) và còn khớp các số đã điền → dùng nó
      else { var r = search(S.v, 1, NODE_BUDGET); orc.sol = r.count ? r.solution : null; }
    }
    if (!orc.sol) return null;
    var best = -1, bn = 10, q, n;
    for (q = 0; q < 81; q++) if (S.v[q] === 0) { n = POP[S.c[q]]; if (n < bn) { bn = n; best = q; } }
    if (best < 0) return null;
    var d = orc.sol[best];
    if (!(S.c[best] & (1 << d))) return null;
    var text = "", why = [];
    if (S.ex) {
      var others = S.c[best] & ~(1 << d), bad = [], okc = [], dd, t, r2;
      for (dd = 1; dd <= 9; dd++) if (others & (1 << dd)) {
        t = S.v.slice(); t[best] = dd; r2 = search(t, 1, 8000);
        if (r2.count === 0 && !r2.truncated) bad.push(dd); else okc.push(dd);
      }
      text = "Hết kỹ thuật suy luận trực tiếp: thử giả thiết " + cn(best) + " = " + d + ".";
      why = ["Không còn kỹ thuật nào (single, locked candidates, cặp/bộ ba, X-Wing, Swordfish, XY-Wing) áp dụng được ở trạng thái này.",
        "Ô " + cn(best) + " có ít ứng viên nhất: " + dset(S.c[best]) + ". Thử từng giả thiết:"];
      if (bad.length) why.push("· " + (bad.length === 1 ? "Nếu là " + bad[0] : "Nếu là " + bad.join(" hay ")) + " thì sớm hay muộn gặp mâu thuẫn (không điền nổi lưới) → loại.");
      if (okc.length) why.push("· " + okc.join(", ") + " cũng chưa dẫn tới mâu thuẫn — đề này có nhiều hơn một nghiệm (hoặc cần tìm sâu hơn).");
      why.push("→ chọn " + cn(best) + " = " + d + ".");
    }
    return { technique: "guess", kind: "place", cell: best, digit: d, elims: [], cells: [best], unit: -1, text: text, why: why, dmask: S.c[best], lines: [] };
  }

  /** humanSolve(grid, {maxLevel, explain, maxSteps}) → { solved, steps, counts, hardest, guesses, contradiction, stuck, v, c }.
      maxLevel < 10 → không đoán (kẹt thì dừng, stuck:true). Tất định. */
  function humanSolve(grid, opt) {
    opt = opt || {};
    var maxLevel = opt.maxLevel == null ? MAX_LEVEL : opt.maxLevel, maxSteps = opt.maxSteps || 500;
    var S = { v: grid.slice(), c: candidatesFrom(grid), ex: !!opt.explain }, orc = { given: validGrid(opt.oracle) ? opt.oracle : null };
    var out = { solved: false, steps: [], counts: {}, hardest: -1, guesses: 0, contradiction: false, stuck: false, v: null, c: null };
    if (conflictCells(S.v).length) { out.contradiction = true; out.v = S.v; out.c = S.c; return out; }
    var left = 0, q, st;
    for (q = 0; q < 81; q++) if (S.v[q] === 0) left++;
    while (left > 0 && out.steps.length < maxSteps) {
      st = findStep(S, maxLevel);
      if (st && st.contradiction) { out.contradiction = true; break; }
      if (!st) {
        if (maxLevel < MAX_LEVEL) { out.stuck = true; break; }
        st = guessStep(S, orc);
        if (!st) { out.contradiction = true; break; }
        out.guesses++;
      }
      applyStep(S, st);
      if (st.kind === "place") left--;
      out.steps.push(st);
      out.counts[st.technique] = (out.counts[st.technique] || 0) + 1;
      if (LEVEL[st.technique] > out.hardest) out.hardest = LEVEL[st.technique];
    }
    out.solved = left === 0 && !out.contradiction;
    out.v = S.v; out.c = S.c;
    return out;
  }

  // ---------------------------------------------------------------- điểm khó
  /* score = nền của kỹ thuật KHÓ NHẤT cần dùng + phần nội suy tới nền của cấp kế tiếp theo mức dùng (số lần, có trọng số) + số lần đoán + hiệu chỉnh theo số ô trống. */
  var LO = [1.0, 2.0, 3.75, 4.3, 4.8, 5.1, 5.8, 6.3, 6.7, 7.0, 7.8];     // nền của từng cấp kỹ thuật khó nhất (chỉ số = LEVEL)
  var HI = [1.9, 3.05, 4.25, 4.7, 5.0, 5.55, 6.25, 6.65, 6.95, 7.2, 9.8]; // trần nội suy của cấp đó (chưa tính hiệu chỉnh ô trống ±0,2)
  var WEIGHT = { "pointing": 1, "claiming": 1, "naked-pair": 1, "hidden-pair": 1.3, "naked-triple": 1.5, "hidden-triple": 1.8, "x-wing": 2, "swordfish": 2.5, "xy-wing": 2.2 };
  function scoreOf(stat) {
    var hard = stat.hardest < 0 ? 0 : stat.hardest, f, adv = 0, key;
    for (key in WEIGHT) if (stat.counts[key]) adv += WEIGHT[key] * stat.counts[key];
    if (hard === 0) f = (stat.counts["naked-single"] || 0) / ((stat.counts["naked-single"] || 0) + 60);
    else if (hard === 1) f = (stat.counts["hidden-single"] || 0) / ((stat.counts["hidden-single"] || 0) + 25);
    else if (hard < 10) f = adv / (adv + 8);
    else { var g = Math.max(1, stat.guesses); f = (g - 1) / (g + 4) + 0.1 * adv / (adv + 12); }
    var size = Math.max(-1, Math.min(1, (stat.blanks - 46) / 30)) * 0.2;
    return P.util.clampScore(LO[hard] + (HI[hard] - LO[hard]) * f + size);
  }
  /** Phân tích đề: chạy bộ giải người (không văn bản) → thống kê + điểm. Đề vô nghiệm → điểm 0. */
  function analyze(grid) {
    var hs = humanSolve(grid, { explain: false }), blanks = 0, q;
    for (q = 0; q < 81; q++) if (!grid[q]) blanks++;
    var stat = { counts: hs.counts, hardest: hs.hardest, guesses: hs.guesses, blanks: blanks, solved: hs.solved, contradiction: hs.contradiction };
    stat.score = hs.solved ? scoreOf(stat) : 0;
    return stat;
  }

  // ---------------------------------------------------------------- sinh đề
  /* Trần kỹ thuật của từng bậc khi đào ô (maxLevel = cấp kỹ thuật cao nhất cho phép; 10 = không trần) và khoảng số ô cho sẵn mà ta dừng đào.
     Dừng sớm ở bậc dễ để đề không quá "trơ" (ít ô cho sẵn); bậc chuyên gia đào tới gần tối giản. */
  var TIER_CFG = {
    easy: { maxLevel: 1, stop: [34, 40] },
    medium: { maxLevel: 5, stop: [17, 17] },
    hard: { maxLevel: 10, stop: [17, 17], repair: true },
    expert: { maxLevel: 10, stop: [17, 17] }
  };
  function fullGrid(rng) { var r = search(zeros(81), 1, 200000, rng); return r.count ? r.solution : null; }
  function dig(full, rng, cfg) {
    var grid = full.slice(), order = [], q, cell, saved, r, ok, clues = 81, stopAt = rng.range(cfg.stop[0], cfg.stop[1]);
    for (q = 0; q < 81; q++) order.push(q);
    rng.shuffle(order);
    for (q = 0; q < 81 && clues > stopAt; q++) {
      cell = order[q]; saved = grid[cell]; grid[cell] = 0;
      r = search(grid, 2, DIG_NODE_BUDGET);
      ok = r.count === 1 && !r.truncated;
      if (ok && cfg.maxLevel < MAX_LEVEL) ok = humanSolve(grid, { maxLevel: cfg.maxLevel }).solved;
      if (ok) clues--; else grid[cell] = saved;
    }
    return grid;
  }
  function buildPuzzle(v, sol, o) {
    var p = { v: 1, type: "sudoku", id: "", seed: o.seed == null ? null : o.seed, sizeId: "9", size: 9, tier: o.tier, score: o.score, data: { unique: !!o.unique },
      initial: { v: v.slice() }, solution: sol ? { v: sol.slice() } : null, meta: o.meta || {} };
    p.id = P.util.puzzleId(p);
    return p;
  }
  /** Đề tối giản cần "đoán" mà bậc cần đề khó vừa phải: thêm LẠI từng ô cho sẵn (thứ tự rng) tới khi đề rơi đúng bậc — đề thêm một ô thường mất nhu cầu đoán
      nhưng vẫn cần kỹ thuật cao. Vẫn duy nhất (thêm ô không làm mất tính duy nhất). Trả { grid, an } hoặc null. */
  function repair(grid, full, rng, tier) {
    var removed = [], q, g2, a2;
    for (q = 0; q < 81; q++) if (!grid[q]) removed.push(q);
    rng.shuffle(removed);
    for (q = 0; q < removed.length; q++) {
      g2 = grid.slice(); g2[removed[q]] = full[removed[q]];
      a2 = analyze(g2);
      if (a2.solved && P.util.tierOfScore(a2.score).id === tier) return { grid: g2, an: a2 };
    }
    return null;
  }
  function generate(seed, opts) {
    opts = opts || {};
    var tier = TIER_CFG[opts.tier] ? opts.tier : "medium", cfg = TIER_CFG[tier], target = P.util.tier(tier).target;
    var rng = P.rng.create(seed), best = null, bestGap = 1e9, k, r, full, grid, an, gap, done = false;
    function consider(g, a, f) {
      var gp = Math.abs(a.score - target);
      if (!best || gp < bestGap) { best = { grid: g, full: f, an: a }; bestGap = gp; }
      if (P.util.tierOfScore(a.score).id === tier) { best = { grid: g, full: f, an: a }; done = true; }
    }
    for (k = 0; k < MAX_TRIES && !done; k++) {
      r = rng.fork("try" + k);
      full = fullGrid(r.fork("grid")); if (!full) continue;
      grid = dig(full, r.fork("dig"), cfg);
      an = analyze(grid); if (!an.solved) continue;
      consider(grid, an, full);
      if (!done && cfg.repair && an.hardest >= MAX_LEVEL) { var fx = repair(grid, full, r.fork("fix"), tier); if (fx) consider(fx.grid, fx.an, full); }
    }
    return buildPuzzle(best.grid, best.full, { seed: rng.seed, tier: P.util.tierOfScore(best.an.score).id, score: best.an.score, unique: true });
  }

  // ---------------------------------------------------------------- nhập / xuất
  function parseText(text) {
    var errors = [], v = [], bad = [], q, ch;
    if (typeof text !== "string") return { v: null, errors: ["Đề phải là một chuỗi gồm 81 ô (chữ số 1–9; '.' hoặc 0 là ô trống)."] };
    for (q = 0; q < text.length; q++) {
      ch = text.charAt(q);
      if (ch >= "1" && ch <= "9") v.push(+ch);
      else if (ch === "0" || ch === ".") v.push(0);
      else if (/\s/.test(ch) || ch === "|" || ch === "-" || ch === "+") continue;
      else if (bad.indexOf(ch) < 0) bad.push(ch);
    }
    if (bad.length) errors.push("Ký tự lạ: " + bad.slice(0, 5).map(function (x) { return "‘" + x + "’"; }).join(", ") + " — chỉ dùng chữ số 1–9, dấu chấm hoặc số 0 cho ô trống.");
    else if (v.length !== 81) errors.push("Cần đúng 81 ô, nhận được " + v.length + ".");
    return { v: errors.length ? null : v, errors: errors };
  }
  function parseArray(arr) {
    var v = [], q, x;
    if (arr.length !== 81) return { v: null, errors: ["Cần đúng 81 ô, nhận được " + arr.length + "."] };
    for (q = 0; q < 81; q++) {
      x = arr[q];
      if (x == null || x === "" || x === ".") x = 0;
      else if (typeof x === "string" && /^[0-9]$/.test(x)) x = +x;
      if (typeof x !== "number" || x !== Math.floor(x) || x < 0 || x > 9) return { v: null, errors: ["Ô thứ " + (q + 1) + " không hợp lệ (chỉ nhận số nguyên 0–9, 0 là ô trống)."] };
      v.push(x);
    }
    return { v: v, errors: [] };
  }
  function cleanStr(s) { return typeof s === "string" ? s.trim().slice(0, 200) : ""; }
  function parseInput(input) {
    var meta = {}, seed = null, src, res;
    if (typeof input === "string") res = parseText(input);
    else if (Array.isArray(input)) res = parseArray(input);
    else if (input && typeof input === "object") {
      src = input.v != null ? input.v : input.initial && input.initial.v != null ? input.initial.v : input.text != null ? input.text : input.cells;
      if (typeof src === "string") res = parseText(src);
      else if (Array.isArray(src)) res = parseArray(src);
      else res = { v: null, errors: ["Thiếu dữ liệu các ô của đề (cần chuỗi 81 ô hoặc mảng 81 số)."] };
      if (cleanStr(input.name)) meta.name = cleanStr(input.name);
      if (cleanStr(input.source)) meta.source = cleanStr(input.source);
      if (cleanStr(input.note)) meta.note = cleanStr(input.note);
      if (typeof input.seed === "number" && input.seed >= 0 && input.seed < 4294967296 && input.seed === Math.floor(input.seed)) seed = input.seed;
    } else res = { v: null, errors: ["Đầu vào rỗng hoặc sai định dạng."] };
    return { v: res.v, errors: res.errors, meta: meta, seed: seed };
  }
  function conflictErrors(v) {
    var out = [], u, d, pos, q, total = 0;
    for (u = 0; u < 27; u++) {
      pos = {};
      for (q = 0; q < 9; q++) { d = v[UNITS[u][q]]; if (d > 0) (pos[d] || (pos[d] = [])).push(UNITS[u][q]); }
      for (d = 1; d <= 9; d++) if (pos[d] && pos[d].length > 1) { total++; if (out.length < 5) out.push(unCap(u) + " có chữ số " + d + " lặp ở " + cl(pos[d]) + "."); }
    }
    if (total > out.length) out.push("… và " + (total - out.length) + " chỗ trùng khác.");
    return out;
  }
  function statusOf(r) { return r.count === 0 && !r.truncated ? "none" : r.count >= 2 || r.truncated ? "multiple" : "unique"; }

  /** Dựng đề từ dữ liệu tự nhập. ok=false khi hỏng/vô nghiệm; nhiều nghiệm là CẢNH BÁO (ok=true). */
  function fromInput(input) {
    var pi = parseInput(input), warnings = [], fail = function (errs, status, count) { return { ok: false, puzzle: null, errors: errs, warnings: warnings, status: status || "none", count: count || 0 }; };
    try {
      if (pi.errors.length) return fail(pi.errors);
      var ce = conflictErrors(pi.v);
      if (ce.length) return fail(ce);
      var r = search(pi.v, 2, NODE_BUDGET), status = statusOf(r), clues = 0, q;
      for (q = 0; q < 81; q++) if (pi.v[q]) clues++;
      if (status === "none") return fail(["Đề vô nghiệm: dù không có hai số trùng nhau, không có cách nào điền hết lưới theo đúng luật."], "none", 0);
      if (r.truncated) warnings.push("Chưa xác định hết số nghiệm của đề (quá khó để đếm trong ngân sách) — coi như có thể có nhiều nghiệm.");
      else if (status === "multiple") warnings.push("Đề có nhiều hơn một nghiệm: bạn vẫn chơi được, nhưng lời giải không duy nhất (Sudoku chuẩn chỉ có đúng một nghiệm).");
      if (status === "multiple" && clues < 17) warnings.push("Chỉ có " + clues + " ô cho sẵn — dưới 17 ô thì chắc chắn có nhiều nghiệm.");
      if (clues === 81) warnings.push("Lưới đã điền đầy, không có ô trống để chơi.");
      var score = r.solution ? analyze(pi.v).score : 0;
      var p = buildPuzzle(pi.v, r.solution, { seed: pi.seed, tier: "custom", score: score, unique: status === "unique", meta: pi.meta });
      return { ok: true, puzzle: p, errors: [], warnings: warnings, status: status, count: r.count };
    } catch (e) { return fail(["Không đọc được đề: " + plain(e && e.message)]); }
  }

  function validate(puzzle) {
    var errors = [], v = puzzle && puzzle.initial && puzzle.initial.v, q;
    if (!puzzle || typeof puzzle !== "object") return { ok: false, errors: ["Thiếu đề."], status: "none", count: 0 };
    if (puzzle.type !== "sudoku") errors.push("Đề không phải loại Sudoku.");
    if (!validGrid(v)) { errors.push("Đề phải có đúng 81 ô, mỗi ô là số nguyên 0–9."); return { ok: false, errors: errors, status: "none", count: 0 }; }
    var ce = conflictErrors(v);
    if (ce.length) return { ok: false, errors: errors.concat(ce), status: "none", count: 0 };
    var r = search(v, 2, NODE_BUDGET), status = statusOf(r);
    if (status === "none") errors.push("Đề vô nghiệm.");
    var sol = puzzle.solution && puzzle.solution.v;
    if (sol) {
      if (!validGrid(sol) || conflictCells(sol).length) errors.push("Lời giải kèm theo không hợp lệ.");
      else { for (q = 0; q < 81; q++) if (sol[q] === 0 || (v[q] && v[q] !== sol[q])) { errors.push("Lời giải kèm theo không khớp các ô cho sẵn."); break; } }
    }
    var out = { ok: errors.length === 0, errors: errors, status: status, count: r.count };
    if (r.truncated) out.warnings = ["Chưa xác định hết số nghiệm (cạn ngân sách tìm kiếm)."];
    if (r.solution) out.solution = { v: r.solution };
    return out;
  }

  function solve(puzzle, opts) {
    opts = opts || {};
    var v = puzzle && puzzle.initial && puzzle.initial.v, limit = opts.limit > 0 ? Math.floor(opts.limit) : 2, maxNodes = opts.maxNodes > 0 ? opts.maxNodes : NODE_BUDGET;
    if (!validGrid(v)) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0, truncated: false, errors: ["Đề không hợp lệ."] };
    var r = search(v, Math.max(2, limit), maxNodes), status = statusOf(r);
    var out = { status: status, count: Math.min(r.count, limit), solution: r.solution ? { v: r.solution } : null, steps: [], techniques: {}, nodes: r.nodes, truncated: r.truncated, guesses: 0, hardest: null };
    if (r.truncated) out.warnings = ["Chưa xác định hết số nghiệm (cạn ngân sách tìm kiếm)."];
    if (r.solution && opts.steps !== false) {
      var hs = humanSolve(v, { explain: true });
      out.steps = hs.steps.map(function (s) { return { technique: s.technique, text: s.text, kind: s.kind, cell: s.cell, digit: s.digit }; });
      out.techniques = hs.counts; out.guesses = hs.guesses;
      out.hardest = hardestName(hs.counts);
    }
    return out;
  }
  function hardestName(counts) {
    var best = null, bl = -1, key;
    for (key in counts) if (LEVEL[key] > bl) { bl = LEVEL[key]; best = key; }
    return best;
  }
  function difficulty(puzzle) {
    var v = puzzle && puzzle.initial && puzzle.initial.v;
    if (!validGrid(v)) return 0;
    try { return analyze(v).score; } catch (e) { return 0; }
  }

  // ---------------------------------------------------------------- trạng thái, nước đi, kiểm tra
  function intIn(x, lo, hi) { return typeof x === "number" && x === Math.floor(x) && x >= lo && x <= hi; }
  function newState(puzzle) { return { v: puzzle.initial.v.slice(), c: zeros(81) }; }
  function isGiven(puzzle, i) { var v = puzzle && puzzle.initial && puzzle.initial.v; return !!(v && intIn(i, 0, 80) && v[i]); }

  function moveFor(puzzle, state, action, settings) {
    try {
      if (!puzzle || !puzzle.initial || !state || !validGrid(state.v) || !action || typeof action !== "object") return null;
      var init = puzzle.initial.v, v = state.v, c = state.c, d = [], q, i = action.i, bit, p, cp, cur;
      var cv = function (x) { return c && c[x] ? c[x] : 0; };
      if (action.k === "set") {
        if (!intIn(i, 0, 80) || !intIn(action.val, 0, 9) || init[i] || v[i] === action.val) return null;
        d.push(["v", i, v[i], action.val]);
        if (action.val) {
          bit = 1 << action.val;
          if (cv(i)) d.push(["c", i, cv(i), 0]);
          if (settings && settings.autoRemove) for (q = 0; q < PEERS[i].length; q++) { p = PEERS[i][q]; cp = cv(p); if (cp & bit) d.push(["c", p, cp, cp & ~bit]); }
        }
        return { d: d, label: action.val ? "Điền " + cn(i) + " = " + action.val : "Xoá " + cn(i) };
      }
      if (action.k === "cand") {
        if (!intIn(i, 0, 80) || !intIn(action.bit, 1, 9) || init[i] || v[i] !== 0) return null;
        cur = cv(i);
        return { d: [["c", i, cur, cur ^ (1 << action.bit)]], label: "Ứng viên " + action.bit + " ở " + cn(i) };
      }
      if (action.k === "clearcand") {
        if (!intIn(i, 0, 80) || init[i] || v[i] !== 0 || !cv(i)) return null;
        return { d: [["c", i, cv(i), 0]], label: "Xoá ứng viên ở " + cn(i) };
      }
      if (action.k === "autocand") {
        var cand = candidatesFrom(v);
        for (q = 0; q < 81; q++) if (cv(q) !== cand[q]) d.push(["c", q, cv(q), cand[q]]);
        return d.length ? { d: d, label: "Ghi ứng viên cho mọi ô trống" } : null;
      }
      return null;
    } catch (e) { return null; }
  }

  function check(puzzle, state) {
    var v = state && state.v, filled = 0, q;
    if (!Array.isArray(v) || v.length !== 81) return { solved: false, conflicts: [], filled: 0, total: 81 };
    for (q = 0; q < 81; q++) if (v[q] > 0 && v[q] <= 9) filled++;
    var conflicts = conflictCells(v);
    return { solved: filled === 81 && conflicts.length === 0, conflicts: conflicts, filled: filled, total: 81 };
  }

  /** Số nước sai MỚI trong diff (gọi trước khi áp diff). Đề duy nhất: ô điền khác lời giải. Đề nhiều nghiệm/không lời giải: chữ số trùng với một ô đã điền cùng hàng/cột/block. */
  function mistakes(puzzle, state, diff) {
    if (!diff || !Array.isArray(diff.d) || !puzzle) return 0;
    var sol = puzzle.solution && puzzle.solution.v, byRule = !sol || !(puzzle.data && puzzle.data.unique), n = 0, k, e, i, q, bad;
    for (k = 0; k < diff.d.length; k++) {
      e = diff.d[k];
      if (e[0] !== "v" || !e[3] || e[3] === e[2]) continue;
      i = e[1]; bad = false;
      if (!byRule) bad = e[3] !== sol[i];
      else if (state && state.v) for (q = 0; q < PEERS[i].length; q++) if (state.v[PEERS[i][q]] === e[3]) { bad = true; break; }
      if (bad) n++;
    }
    return n;
  }

  // ---------------------------------------------------------------- gợi ý
  function noneHint(level, text) { return { level: level, text: text, why: [], cells: [], none: true }; }
  function unionCells(units) { var out = [], seen = {}, a, b; for (a = 0; a < units.length; a++) for (b = 0; b < 9; b++) { var x = UNITS[units[a]][b]; if (!seen[x]) { seen[x] = 1; out.push(x); } } return out.sort(function (p, q) { return p - q; }); }
  function commonLine(cells) {
    var r = true, c = true, q;
    for (q = 1; q < cells.length; q++) { if (ROW[cells[q]] !== ROW[cells[0]]) r = false; if (COL[cells[q]] !== COL[cells[0]]) c = false; }
    return r ? ROW[cells[0]] : c ? 9 + COL[cells[0]] : -1;
  }
  function digitOf(mask) { return mask ? lb(mask) : 0; }
  /** Đơn vị (hàng/cột/block) để nhìn vào — dùng cho mức 1 (không lộ chữ số). */
  function regionUnits(st) {
    switch (st.technique) {
      case "naked-single": case "guess": return [18 + BOX[st.cell]];
      case "hidden-single": return [st.unit];
      case "pointing": return [18 + BOX[st.cells[0]]];
      case "claiming": return [commonLine(st.cells)];
      case "x-wing": case "swordfish": return st.lines;
      case "xy-wing": return [18 + BOX[st.cells[0]]];
      default: return [st.unit];
    }
  }
  function dirText(st) {
    var u = regionUnits(st)[0];
    switch (st.technique) {
      case "naked-single": return "Hãy tìm một ô trong " + un(u) + " chỉ còn một ứng viên.";
      case "hidden-single": return "Hãy tập trung vào " + un(u) + ": có một chữ số chỉ còn đúng một ô để đặt.";
      case "pointing": return "Hãy xem " + un(u) + ": có một chữ số mà mọi ô ứng viên của nó cùng nằm trên một hàng (hoặc một cột).";
      case "claiming": return "Hãy xem " + un(u) + ": có một chữ số mà trong " + (u < 9 ? "hàng" : "cột") + " này chỉ còn đặt được trong cùng một block.";
      case "naked-pair": return "Hãy tìm trong " + un(u) + " hai ô trống chỉ còn đúng hai ứng viên giống nhau.";
      case "naked-triple": return "Hãy tìm trong " + un(u) + " ba ô trống mà hợp các ứng viên của chúng chỉ có ba chữ số.";
      case "hidden-pair": return "Hãy xem " + un(u) + ": có hai chữ số chỉ còn đặt được trong cùng hai ô.";
      case "hidden-triple": return "Hãy xem " + un(u) + ": có ba chữ số chỉ còn đặt được trong cùng ba ô.";
      case "x-wing": return "Hãy xem " + st.lines.map(un).join(" và ") + ": có một chữ số mà ở cả hai đường này, ô ứng viên của nó chỉ nằm trên cùng hai " + (st.lines[0] < 9 ? "cột" : "hàng") + " (mẫu X-Wing).";
      case "swordfish": return "Hãy xem " + st.lines.map(un).join(", ") + ": có một chữ số mà ở cả ba đường này, ô ứng viên của nó chỉ nằm trên cùng ba " + (st.lines[0] < 9 ? "cột" : "hàng") + " (mẫu Swordfish).";
      case "xy-wing": return "Hãy tìm ba ô, mỗi ô chỉ còn hai ứng viên, nối nhau thành hình chữ Y (XY-Wing) — bắt đầu quanh " + un(u) + ".";
      default: return "Không còn kỹ thuật suy luận trực tiếp nào; hãy xem " + un(u) + ", nơi có ô ít ứng viên nhất, và thử một giả thiết.";
    }
  }
  function pinText(st) {
    var d = digitOf(st.dmask), line;
    switch (st.technique) {
      case "naked-single": return "Ô " + cn(st.cell) + " chỉ còn 1 ứng viên: {" + st.digit + "}.";
      case "hidden-single": return "Ô " + cn(st.cell) + " là ô duy nhất trong " + un(st.unit) + " còn đặt được chữ số " + st.digit + ".";
      case "pointing": return "Pointing: trong " + un(18 + BOX[st.cells[0]]) + ", chữ số " + d + " chỉ còn ở " + cl(st.cells) + " — cùng nằm trên " + un(st.unit) + ".";
      case "claiming": line = commonLine(st.cells); return "Claiming: trong " + un(line) + ", chữ số " + d + " chỉ còn ở " + cl(st.cells) + " — cùng nằm trong " + un(st.unit) + ".";
      case "naked-pair": return "Cặp trần " + dset(st.dmask) + " ở " + cl(st.cells) + " (" + un(st.unit) + ").";
      case "naked-triple": return "Bộ ba trần " + dset(st.dmask) + " ở " + cl(st.cells) + " (" + un(st.unit) + ").";
      case "hidden-pair": return "Cặp ẩn " + dset(st.dmask) + " ở " + cl(st.cells) + " (" + un(st.unit) + ").";
      case "hidden-triple": return "Bộ ba ẩn " + dset(st.dmask) + " ở " + cl(st.cells) + " (" + un(st.unit) + ").";
      case "x-wing": return "X-Wing chữ số " + d + " ở " + cl(st.cells) + " (" + st.lines.map(un).join(", ") + ").";
      case "swordfish": return "Swordfish chữ số " + d + " ở " + cl(st.cells) + " (" + st.lines.map(un).join(", ") + ").";
      case "xy-wing": return "XY-Wing: trục " + cn(st.cells[0]) + ", hai cánh " + cn(st.cells[1]) + " và " + cn(st.cells[2]) + " (ba chữ số " + dset(st.dmask) + ").";
      default: return "Hãy thử giả thiết ở ô " + cn(st.cell) + " (ứng viên " + dset(st.dmask) + ").";
    }
  }
  function planFrom(v, oracle) {
    var S = { v: v.slice(), c: candidatesFrom(v), ex: true }, orc = { given: validGrid(oracle) ? oracle : null }, chain = [], it, st;
    for (it = 0; it < 150; it++) {
      st = findStep(S, MAX_LEVEL);
      if (st && st.contradiction) return null;
      if (!st) { st = guessStep(S, orc); if (!st) return null; }
      if (st.kind === "place") return { chain: chain, place: st };
      chain.push(st); applyStep(S, st);
    }
    return null;
  }
  function planHint(plan, level) {
    var first = plan.chain.length ? plan.chain[0] : plan.place, pl = plan.place, why = [], q, n, cells;
    if (level === 1) return { level: 1, text: dirText(first), why: [], cells: unionCells(regionUnits(first)), technique: first.technique, regions: { units: regionUnits(first) } };
    if (level === 2) return { level: 2, text: pinText(first), why: [], cells: first.kind === "place" ? [first.cell] : first.cells.slice(), technique: first.technique, regions: { units: regionUnits(first) } };
    for (q = 0; q < plan.chain.length; q++) {
      why.push("Bước " + (q + 1) + " — " + TECH_NAME[plan.chain[q].technique] + ":");
      for (n = 0; n < plan.chain[q].why.length; n++) why.push("   " + plan.chain[q].why[n]);
    }
    if (plan.chain.length) { why.push("Bước " + (plan.chain.length + 1) + " — " + TECH_NAME[pl.technique] + ":"); for (n = 0; n < pl.why.length; n++) why.push("   " + pl.why[n]); }
    else why = pl.why.slice();
    cells = first.kind === "place" ? [pl.cell] : first.cells.concat([pl.cell]);
    cells = cells.filter(function (x, i2) { return cells.indexOf(x) === i2; }).sort(function (a, b) { return a - b; });
    return { level: 3, text: cn(pl.cell) + " = " + pl.digit, why: why, cells: cells, technique: first.technique, action: { k: "set", i: pl.cell, val: pl.digit }, regions: { units: regionUnits(first) } };
  }

  /** Ô điền sai (−1 nếu không có): trạng thái không thể hoàn thành thành lưới hợp lệ. Trách nhiệm đổ cho ô khác lời giải (ưu tiên ô đang xung đột). */
  function findWrong(puzzle, v) {
    var init = puzzle.initial.v, sol = puzzle.solution && puzzle.solution.v, r = search(v, 1, NODE_BUDGET), q;
    if (r.count > 0 || r.truncated) return -1;
    var cf = conflictCells(v), mine = [], bySol = [], inCf = function (x) { return cf.indexOf(x) >= 0; };
    for (q = 0; q < 81; q++) if (v[q] && !init[q]) mine.push(q);
    if (!mine.length) return -1;
    if (sol) for (q = 0; q < mine.length; q++) if (v[mine[q]] !== sol[mine[q]]) bySol.push(mine[q]);
    var pool = bySol.length ? bySol : mine, pref = pool.filter(inCf);
    return (pref.length ? pref : pool)[0];
  }
  function errorHint(v, i, level) {
    var p, other = -1, why;
    for (p = 0; p < PEERS[i].length; p++) if (v[PEERS[i][p]] === v[i]) { other = PEERS[i][p]; break; }
    if (level === 1) return { level: 1, text: "Có ô đang điền sai. Hãy kiểm tra lại " + un(ROW[i]) + ".", why: [], cells: UNITS[ROW[i]].slice(), technique: "error" };
    if (level === 2) return { level: 2, text: "Ô " + cn(i) + " đang điền sai.", why: [], cells: [i], technique: "error" };
    why = other >= 0
      ? [cn(i) + " = " + v[i] + " trùng với " + cn(other) + " (cùng " + (ROW[i] === ROW[other] ? un(ROW[i]) : COL[i] === COL[other] ? un(9 + COL[i]) : un(18 + BOX[i])) + ") — mỗi hàng, cột, block chỉ được có một chữ số " + v[i] + "."]
      : [cn(i) + " = " + v[i] + " tuy chưa trùng ô nào, nhưng với số này lưới không thể hoàn thành đúng luật (đáp án của ô này là một chữ số khác).", "Nên xoá số ở ô này trước khi đi tiếp."];
    return { level: 3, text: "Xoá số " + v[i] + " ở " + cn(i) + " (đang điền sai).", why: why, cells: other >= 0 ? [i, other].sort(function (a, b) { return a - b; }) : [i], technique: "error", action: { k: "set", i: i, val: 0 } };
  }
  function hint(puzzle, state, level) {
    level = Math.max(1, Math.min(3, Math.floor(+level) || 1));
    try {
      var v = state && state.v;
      if (!puzzle || !puzzle.initial || !validGrid(v)) return noneHint(level, "Trạng thái ván không hợp lệ nên chưa gợi ý được.");
      if (check(puzzle, state).solved) return noneHint(level, "Lưới đã giải xong — không còn gì để gợi ý.");
      var bad = findWrong(puzzle, v);
      if (bad >= 0) return errorHint(v, bad, level);
      var plan = planFrom(v, puzzle.solution && puzzle.solution.v);
      if (!plan) return noneHint(level, "Không tìm được gợi ý: đề này có thể vô nghiệm hoặc đã có ô mâu thuẫn.");
      return planHint(plan, level);
    } catch (e) { return noneHint(level, "Không tạo được gợi ý lúc này."); }
  }

  // ---------------------------------------------------------------- replay
  function replay(puzzle) {
    var v0 = puzzle && puzzle.initial && puzzle.initial.v;
    if (!validGrid(v0)) return [];
    var hs = humanSolve(v0, { explain: true, oracle: puzzle.solution && puzzle.solution.v }), cand = candidatesFrom(v0), d0 = [], cells0 = [], q, out = [];
    if (!hs.solved) return [];
    for (q = 0; q < 81; q++) if (!v0[q]) { d0.push(["c", q, 0, cand[q]]); cells0.push(q); }
    if (!cells0.length) return [];
    out.push({ text: "Ghi ứng viên cho mọi ô trống.", why: ["Ứng viên của một ô = các chữ số 1–9 chưa xuất hiện trong hàng, cột và block của ô đó.", "Từ đây mỗi bước giải chỉ là loại bớt ứng viên hoặc chốt một ô."],
      diff: { d: d0, label: "Ghi ứng viên" }, cells: cells0, technique: "candidates" });
    var T = { v: v0.slice(), c: cand.slice() }, before, d, k, st;
    for (k = 0; k < hs.steps.length; k++) {
      st = hs.steps[k]; before = { v: T.v.slice(), c: T.c.slice() };
      applyStep(T, st);
      d = [];
      for (q = 0; q < 81; q++) if (before.v[q] !== T.v[q]) d.push(["v", q, before.v[q], T.v[q]]);
      for (q = 0; q < 81; q++) if (before.c[q] !== T.c[q]) d.push(["c", q, before.c[q], T.c[q]]);
      out.push({ text: st.text, why: st.why.slice(), diff: { d: d, label: TECH_NAME[st.technique] }, cells: st.kind === "place" ? [st.cell] : st.cells.slice(), technique: st.technique });
    }
    return out;
  }

  // ---------------------------------------------------------------- constraint view và trace
  function constraintView(puzzle) {
    var v = puzzle && puzzle.initial && puzzle.initial.v;
    if (!validGrid(v)) return { summary: "Đề không hợp lệ.", variables: [], constraints: [], counts: { variables: 0, constraints: 0 } };
    var cand = candidatesFrom(v), given = 0, groups = {}, sizes = [], q, n, u, vars = [], cons = [], domainValues = 0;
    for (q = 0; q < 81; q++) {
      if (v[q]) { given++; domainValues++; continue; }
      n = POP[cand[q]]; domainValues += n;
      if (!groups[n]) { groups[n] = { count: 0, example: cand[q] }; sizes.push(n); }
      groups[n].count++;
    }
    sizes.sort(function (a, b) { return a - b; });
    if (given) vars.push({ name: "Ô cho sẵn", domain: "đã chốt một chữ số (miền 1 giá trị)", count: given });
    sizes.forEach(function (s) {
      vars.push({ name: "Ô trống còn " + s + " ứng viên", domain: "{1..9} thu hẹp còn " + s + " giá trị" + (s === 0 ? " — mâu thuẫn" : ", ví dụ " + dset(groups[s].example)), count: groups[s].count });
    });
    for (u = 0; u < 27; u++) {
      var cells = UNITS[u], given9 = unitDigits(v, u), first = cn(cells[0]), last = cn(cells[8]);
      cons.push(unCap(u) + (u >= 18 ? " (" + boxSpan(u - 18) + ")" : "") + ": all-different(" + first + " … " + last + ") — chín ô phải mang chín chữ số khác nhau" + (given9 ? "; đã có " + dl(given9) : ""));
    }
    return {
      summary: "Sudoku là bài toán thoả mãn ràng buộc: 81 biến (mỗi ô), miền {1..9}, 27 ràng buộc all-different (9 hàng, 9 cột, 9 block). " + given + " ô cho sẵn đã thu hẹp miền các ô còn lại về trung bình " + (81 - given ? (domainValues - given) / (81 - given) : 0).toFixed(1).replace(".", ",") + " giá trị.",
      variables: vars, constraints: cons,
      counts: { variables: 81, constraints: 27, givens: given, blanks: 81 - given, domainValues: domainValues, pairConstraints: 810, groups: vars.length }
    };
  }

  function placeIn(v, c, cell, d) { var bit = 1 << d, q; v[cell] = d; c[cell] = 0; for (q = 0; q < PEERS[cell].length; q++) c[PEERS[cell][q]] &= ~bit; }
  /** Lan truyền naked + hidden single tới khi hết; false nếu mâu thuẫn. */
  function propagate(v, c) {
    var changed = true, q, u, cells, placed, ones, twos, mk, single, cell, bit;
    while (changed) {
      changed = false;
      for (q = 0; q < 81; q++) if (v[q] === 0) {
        if (c[q] === 0) return false;
        if (POP[c[q]] === 1) { placeIn(v, c, q, lb(c[q])); changed = true; }
      }
      for (u = 0; u < 27; u++) {
        cells = UNITS[u]; placed = 0; ones = 0; twos = 0;
        for (q = 0; q < 9; q++) { cell = cells[q]; if (v[cell]) placed |= 1 << v[cell]; else { mk = c[cell]; twos |= ones & mk; ones |= mk; } }
        if (ALL & ~ones & ~placed) return false;
        single = ones & ~twos & ~placed & ALL;
        while (single) {
          bit = single & -single; single ^= bit;
          for (q = 0; q < 9; q++) { cell = cells[q]; if (v[cell] === 0 && (c[cell] & bit)) { placeIn(v, c, cell, lb(bit)); changed = true; break; } }
        }
      }
    }
    return true;
  }
  /** Cây của bộ giải quay lui (ô ít ứng viên nhất trước, thử chữ số tăng dần, lan truyền single sau mỗi lần gán). */
  function trace(puzzle, opts) {
    var v0 = puzzle && puzzle.initial && puzzle.initial.v, maxN = Math.max(1, Math.min(600, opts && opts.maxNodes > 0 ? Math.floor(opts.maxNodes) : 600));
    var tail = " Gợi ý và điểm khó dùng bộ giải kỹ thuật của người (cặp, X-Wing…) — nó thường không cần đoán như cây này.";
    var note0 = "Mỗi nút là một lần thử gán ô (R3C4 = 7); sau mỗi lần gán bộ giải lan truyền các ô duy nhất. fail = gán xong là mâu thuẫn ngay, dead = thử hết mọi giá trị mà không ra nghiệm, ok = nằm trên đường tới nghiệm, solution = lưới đã đầy.";
    if (!validGrid(v0)) return { kind: "tree", nodes: [], truncated: false, note: "Đề không hợp lệ nên không có cây tìm kiếm." };
    var nodes = [], truncated = false, v = v0.slice(), c = candidatesFrom(v), blanks = 0, q;
    for (q = 0; q < 81; q++) if (!v[q]) blanks++;
    function add(parent, label, status) { nodes.push({ id: nodes.length, parent: parent, label: label, status: status }); return nodes.length - 1; }
    add(-1, "Đề ban đầu (" + blanks + " ô trống) → lan truyền ô duy nhất", "ok");
    if (conflictCells(v).length || !propagate(v, c)) { nodes[0].status = "fail"; return { kind: "tree", nodes: nodes, truncated: false, note: "Đề mâu thuẫn ngay từ đầu (không có nghiệm). " + note0 + tail }; }
    function rec(vv, cc, id) {
      var best = -1, bn = 10, k, n, found = false, mk, d, v2, c2, nid;
      for (k = 0; k < 81; k++) if (vv[k] === 0) { n = POP[cc[k]]; if (n < bn) { bn = n; best = k; } }
      if (best < 0) { nodes[id].status = "solution"; return true; }
      mk = cc[best];
      for (d = 1; d <= 9 && !found; d++) if (mk & (1 << d)) {
        if (nodes.length >= maxN) { truncated = true; break; }
        v2 = vv.slice(); c2 = cc.slice(); placeIn(v2, c2, best, d);
        nid = add(id, cn(best) + " = " + d, "dead");
        if (!propagate(v2, c2)) { nodes[nid].status = "fail"; continue; }
        if (rec(v2, c2, nid)) found = true;
      }
      nodes[id].status = found ? "ok" : "dead";
      return found;
    }
    var solved = rec(v, c, 0);
    var summary = nodes.length === 1 && solved ? "Đề này giải xong chỉ bằng lan truyền ô duy nhất — không cần đoán, cây chỉ có nút gốc."
      : "Cây có " + nodes.length + " nút" + (truncated ? " (đã cắt ở " + maxN + " nút)" : "") + (solved ? ", tìm được nghiệm." : truncated ? "." : ", không có nghiệm.");
    return { kind: "tree", nodes: nodes, truncated: truncated, note: summary + " " + note0 + tail };
  }

  function describeCell(puzzle, state, i) {
    if (!intIn(i, 0, 80)) return "Ô không hợp lệ";
    var pre = "Hàng " + (ROW[i] + 1) + ", cột " + (COL[i] + 1) + ", ", v = state && state.v ? state.v[i] : 0, c = state && state.c ? state.c[i] : 0;
    if (isGiven(puzzle, i)) return pre + "ô cho sẵn, giá trị " + puzzle.initial.v[i];
    if (v > 0 && v <= 9) return pre + "đã điền " + v;
    return pre + "ô trống, " + (c ? "ứng viên " + dl(c).replace(/, /g, " ") : "chưa có ứng viên");
  }

  // ---------------------------------------------------------------- văn bản và tệp
  function gridStr(v) { return v.join(""); }
  function toText(puzzle) {
    var v = puzzle && puzzle.initial && puzzle.initial.v, lines = [], r, c, row;
    if (!validGrid(v)) return "";
    for (r = 0; r < 9; r++) {
      row = "";
      for (c = 0; c < 9; c++) { row += v[r * 9 + c] ? String(v[r * 9 + c]) : "."; if (c === 2 || c === 5) row += "|"; }
      lines.push(row);
      if (r === 2 || r === 5) lines.push("---+---+---");
    }
    return lines.join("\n");
  }
  function fromText(text) {
    if (typeof text !== "string") return { ok: false, puzzle: null, errors: ["Cần một chuỗi văn bản gồm 81 ô (chữ số 1–9; '.' hoặc 0 là ô trống)."], warnings: [], status: "none", count: 0 };
    return fromInput(text);
  }
  function toFile(puzzle) {
    var v = puzzle && puzzle.initial && puzzle.initial.v, sol = puzzle && puzzle.solution && puzzle.solution.v, md = (puzzle && puzzle.meta) || {}, meta = { app: "logic-puzzle-suite", format: 1, sizeId: "9", tier: puzzle && puzzle.tier || "custom" };
    if (md.name) meta.name = md.name;
    if (md.source) meta.source = md.source;
    if (md.note) meta.note = md.note;
    return { type: "sudoku", seed: puzzle && puzzle.seed != null ? puzzle.seed : null, difficulty: puzzle && puzzle.score || 0, size: 9,
      initialState: validGrid(v) ? gridStr(v) : "", solution: validGrid(sol) ? gridStr(sol) : "", metadata: meta };
  }
  /** Không tin difficulty/solution trong tệp: dựng lại qua fromInput. */
  function fromFile(obj) {
    var bad = function (msg) { return { ok: false, puzzle: null, errors: [msg], warnings: [] }; };
    try {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return bad("Tệp không phải một đối tượng JSON hợp lệ.");
      if (obj.type !== "sudoku") return bad("Tệp này không phải đề Sudoku (type = " + plain(obj.type).slice(0, 40) + ").");
      if (typeof obj.initialState !== "string") return bad("Thiếu trường initialState (chuỗi 81 ô).");
      var md = obj.metadata && typeof obj.metadata === "object" ? obj.metadata : {};
      var r = fromInput({ text: obj.initialState, name: md.name, source: md.source, note: md.note });
      if (r.ok && typeof obj.solution === "string" && obj.solution && r.puzzle.solution && r.puzzle.data.unique && obj.solution.replace(/\s/g, "") !== gridStr(r.puzzle.solution.v))
        r.warnings.push("Lời giải ghi trong tệp khác lời giải tính lại từ đề — app dùng lời giải tính lại.");
      return { ok: r.ok, puzzle: r.puzzle, errors: r.errors, warnings: r.warnings, status: r.status, count: r.count };
    } catch (e) { return bad("Không đọc được tệp: " + plain(e && e.message)); }
  }

  // ---------------------------------------------------------------- khai báo loại puzzle
  var DIFFICULTY_NOTE = "Điểm 0–10 = nền của kỹ thuật khó nhất mà bộ giải kiểu người phải dùng (single < locked candidates < cặp/bộ ba < X-Wing, Swordfish, XY-Wing < phải đoán), cộng phần nội suy theo số lần dùng kỹ thuật ngoài single (có trọng số), số lần đoán và hiệu chỉnh nhẹ ±0,2 theo số ô trống. Bậc: Dễ < 3,5 ≤ Vừa < 5,5 ≤ Khó < 7,5 ≤ Chuyên gia.";
  var def = {
    id: "sudoku", name: "Sudoku", family: "Grid Puzzle", category: "Ràng buộc", icon: "🔢",
    blurb: "Điền các chữ số 1–9 vào lưới 9×9 sao cho mỗi hàng, mỗi cột và mỗi block 3×3 đều có đủ chín chữ số, không lặp.",
    rules: [
      "Mỗi hàng chứa các chữ số từ 1 đến 9, mỗi chữ số đúng một lần.",
      "Mỗi cột chứa các chữ số từ 1 đến 9, mỗi chữ số đúng một lần.",
      "Mỗi block 3×3 (chín block ghép thành lưới) chứa các chữ số từ 1 đến 9, mỗi chữ số đúng một lần.",
      "Các ô cho sẵn là cố định. Một đề hay luôn có đúng một lời giải và suy ra được bằng logic — không cần đoán."
    ],
    sizes: [{ id: "9", label: "9 × 9", params: 9, default: true, tiers: ["easy", "medium", "hard", "expert"] }],
    algorithm: {
      title: "Sudoku: lan truyền ràng buộc, kỹ thuật của người, rồi quay lui",
      steps: [
        { title: "Mô hình hoá thành bài toán ràng buộc", text: "81 biến (mỗi ô) có miền {1..9} và 27 ràng buộc all-different (9 hàng, 9 cột, 9 block). Mỗi ô cho sẵn thu hẹp miền các ô cùng hàng, cột, block với nó. Miền mỗi ô được giữ bằng một bitmask 9 bit." },
        { title: "Lan truyền ràng buộc", text: "Hai luật đơn giản nhất: ô chỉ còn một ứng viên thì điền (naked single); một chữ số chỉ còn một chỗ trong hàng/cột/block thì điền (hidden single). Mỗi lần điền lại gạt chữ số khỏi 20 ô cùng nhóm, có thể mở ra các ô duy nhất mới." },
        { title: "Kỹ thuật suy luận của người", text: "Khi single hết, người giải dùng các phép LOẠI ứng viên hợp lệ: pointing/claiming (khoá ứng viên), cặp/bộ ba trần và ẩn, X-Wing, Swordfish, XY-Wing. Kỹ thuật khó nhất cần dùng chính là cơ sở chấm điểm độ khó, sinh gợi ý và phát lại lời giải." },
        { title: "Quay lui với MRV và đếm nghiệm", text: "Bộ giải nhanh chọn ô còn ÍT ứng viên nhất, thử từng chữ số, lan truyền rồi đệ quy; sai thì lùi (backtracking). Đếm nghiệm tới 2 để kiểm tra đề có duy nhất nghiệm; sinh đề = đào dần ô khỏi một lưới đầy ngẫu nhiên miễn là nghiệm còn duy nhất." }
      ],
      links: [{ id: "backtracking", label: "Backtracking (quay lui)" }, { id: "bit-manipulation", label: "Thao tác bit (bitmask ứng viên)" }]
    },
    difficultyNote: DIFFICULTY_NOTE,
    generate: generate, fromInput: fromInput, validate: validate, solve: solve, difficulty: difficulty, newState: newState, isGiven: isGiven, moveFor: moveFor, check: check, mistakes: mistakes,
    hint: hint, replay: replay, constraintView: constraintView, trace: trace, describeCell: describeCell, toFile: toFile, fromFile: fromFile, toText: toText, fromText: fromText,
    techniqueNames: TECH_NAME
  };
  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
