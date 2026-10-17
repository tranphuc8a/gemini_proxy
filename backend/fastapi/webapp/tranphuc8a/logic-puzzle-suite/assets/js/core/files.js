/* core/files.js — nhập/xuất puzzle (spec #29): JSON (một puzzle, nhiều puzzle, hoặc cả bộ), TXT đọc được, CSV (lịch sử, danh sách puzzle). Thuần, không DOM.
   Tệp JSON:  { format: "logic-puzzle-suite", version: 1, exported: "<ISO>", puzzles: [ type.toFile(p), … ] }  — mỗi phần tử đúng dạng spec:
              { type, seed, difficulty, size, initialState, solution, metadata }.
   KHÔNG tin dữ liệu trong tệp: mọi puzzle nhập vào đều đi qua type.fromFile/fromText → fromInput, nên độ khó, lời giải, số nghiệm được TÍNH LẠI.
   TXT: một dòng đầu `#puzzle type=sudoku seed=123 tier=hard score=7.4` (tuỳ chọn, giúp nhận đúng loại) + phần type.toText(p). */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var FORMAT = "logic-puzzle-suite", MAX_PUZZLES = 2000;

  function errOut(msg) { return { ok: false, puzzles: [], errors: [msg], warnings: [] }; }

  function exportJson(puzzles, now) {
    var arr = [];
    puzzles.forEach(function (p) { var t = P.types.get(p.type); if (t) arr.push(t.toFile(p)); });
    return JSON.stringify({ format: FORMAT, version: 1, exported: new Date(now == null ? Date.now() : now).toISOString(), puzzles: arr }, null, 2);
  }
  function exportText(p) {
    var t = P.types.get(p.type);
    return "#puzzle type=" + p.type + (p.seed != null ? " seed=" + p.seed : "") + " tier=" + (p.tier || "custom") + " score=" + (p.score != null ? p.score : "") + "\n" + t.toText(p) + "\n";
  }

  function fromFileObj(o, out, label) {
    var t = o && typeof o === "object" ? P.types.get(o.type) : null;
    if (!t) { out.errors.push(label + ": loại puzzle không biết (" + (o && o.type) + ")"); return; }
    var r;
    try { r = t.fromFile(o); } catch (e) { out.errors.push(label + ": lỗi khi đọc (" + (e && e.message) + ")"); return; }
    if (!r || !r.ok) { out.errors.push(label + ": " + ((r && r.errors && r.errors[0]) || "tệp hỏng")); return; }
    out.puzzles.push(r.puzzle); (r.warnings || []).forEach(function (w) { out.warnings.push(label + ": " + w); });
  }

  /** Đọc chuỗi bất kỳ người dùng đưa vào (nội dung tệp .json/.txt hoặc dán) → { ok, puzzles, errors, warnings }. Không bao giờ ném lỗi. */
  function importText(text) {
    var out = { ok: false, puzzles: [], errors: [], warnings: [] };
    try {
      text = String(text == null ? "" : text).replace(/^﻿/, "");
      var s = text.trim();
      if (!s) return errOut("Tệp trống.");
      if (s.length > 20 * 1024 * 1024) return errOut("Tệp quá lớn (trên 20 MB).");
      if (s.charAt(0) === "{" || s.charAt(0) === "[") {
        var j;
        try { j = JSON.parse(s); } catch (e) { return errOut("Không đọc được JSON: " + e.message); }
        var list = Array.isArray(j) ? j : j && Array.isArray(j.puzzles) ? j.puzzles : j && j.type ? [j] : null;
        if (!list) return errOut("JSON không phải tệp puzzle (cần trường `puzzles` hoặc `type`).");
        if (j && !Array.isArray(j) && j.format && j.format !== FORMAT) out.warnings.push("Tệp ghi định dạng '" + j.format + "', không phải " + FORMAT + " — vẫn thử đọc.");
        if (list.length > MAX_PUZZLES) return errOut("Quá nhiều puzzle trong một tệp (tối đa " + MAX_PUZZLES + ").");
        list.forEach(function (o, i) { fromFileObj(o, out, "Puzzle " + (i + 1)); });
      } else {
        var m = /^#puzzle\b(.*)$/m.exec(s), hint = null;
        if (m) { var tm = /\btype=([a-z0-9_-]+)/i.exec(m[1]); if (tm) hint = tm[1].toLowerCase(); s = s.replace(/^#puzzle\b.*$/m, "").trim(); }
        var cands = hint ? [P.types.get(hint)].filter(Boolean) : P.types.all();
        if (hint && !cands.length) return errOut("Không biết loại puzzle '" + hint + "'.");
        var good = [], firstErr = null;
        cands.forEach(function (t) {
          var r; try { r = t.fromText(s); } catch (e) { r = { ok: false, errors: [e && e.message] }; }
          if (r && r.ok) good.push(r); else if (!firstErr && r && r.errors && r.errors[0]) firstErr = (hint ? "" : t.name + ": ") + r.errors[0];
        });
        if (!good.length) return errOut(firstErr || "Không nhận ra định dạng văn bản của puzzle nào.");
        if (good.length > 1) out.warnings.push("Văn bản khớp nhiều loại puzzle — chọn '" + good[0].puzzle.type + "'. Thêm dòng `#puzzle type=…` để chỉ rõ.");
        out.puzzles.push(good[0].puzzle); (good[0].warnings || []).forEach(function (w) { out.warnings.push(w); });
      }
      out.ok = out.puzzles.length > 0 && out.errors.length === 0;
      if (out.puzzles.length && out.errors.length) { out.ok = true; out.warnings.push("Bỏ qua " + out.errors.length + " mục lỗi."); }
      if (!out.puzzles.length && !out.errors.length) out.errors.push("Không có puzzle nào trong tệp.");
    } catch (e) { return errOut("Không đọc được tệp: " + (e && e.message)); }
    return out;
  }

  // ---- CSV (có BOM để Excel đọc đúng tiếng Việt)
  function cell(v) { var s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           /* chặn "công thức" trong Excel/Sheets */ return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(rows) { return "﻿" + rows.map(function (r) { return r.map(cell).join(","); }).join("\r\n") + "\r\n"; }
  function historyCsv(records) {
    var head = ["ngày", "loại", "seed", "bậc", "điểm khó", "cỡ", "nguồn", "kết quả", "thời gian (giây)", "lỗi", "gợi ý", "nước đi"];
    return csv([head].concat(records.slice().sort(function (a, b) { return (a.endedAt || 0) - (b.endedAt || 0); }).map(function (r) {
      return [P.stats.dayOf(r), r.type, r.seed, r.tier, r.score, typeof r.size === "object" ? JSON.stringify(r.size) : r.size, r.source, r.result, Math.round((r.time || 0) / 1000), r.mistakes, r.hints, r.moves];
    })));
  }
  function puzzlesCsv(puzzles) {
    var rows = [["loại", "tên", "seed", "bậc", "điểm khó", "trạng thái đầu", "lời giải"]];
    puzzles.forEach(function (p) { var t = P.types.get(p.type); if (!t) return; var f = t.toFile(p); rows.push([p.type, p.meta && p.meta.name || "", p.seed, p.tier, p.score, f.initialState, f.solution]); });
    return csv(rows);
  }

  function safeName(s) { return String(s || "puzzle").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "puzzle"; }

  P.files = { FORMAT: FORMAT, exportJson: exportJson, exportText: exportText, importText: importText, historyCsv: historyCsv, puzzlesCsv: puzzlesCsv, csv: csv, safeName: safeName };
  if (typeof module !== "undefined" && module.exports) module.exports = P.files;
})(typeof globalThis !== "undefined" ? globalThis : this);
