/* text.js — xử lý chuỗi thuần: bỏ dấu tiếng Việt, thoát HTML, tô sáng từ khoá, thời gian tương đối.
   Không DOM, không đồng hồ (nhận `now`), nên kiểm được bằng node (kiem.js). */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var MARKS = /[̀-ͯ]/g;

  /** Chữ thường, bỏ dấu, đ → d: "Đồ thị" khớp "do thi". */
  function fold(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(MARKS, "").replace(/đ/g, "d");
  }

  /** fold + bảng dò: map[i] là chỉ số trong chuỗi GỐC của ký tự thứ i sau khi fold (có phần tử cuối = độ dài gốc).
      Cần vì NFD có thể đổi độ dài, nên không thể lấy vị trí tìm thấy trong chuỗi đã fold áp thẳng lên chuỗi gốc. */
  function foldMap(s) {
    s = String(s == null ? "" : s);
    var text = "", map = [];
    for (var i = 0; i < s.length;) {
      var ch = String.fromCodePoint(s.codePointAt(i)), f = fold(ch);
      for (var k = 0; k < f.length; k++) map.push(i);
      text += f;
      i += ch.length;
    }
    map.push(s.length);
    return { text: text, map: map };
  }

  /** "Khoá học" → "khoa-hoc": để gõ @khoa-hoc, #thuc-hanh hay loai:khoa-hoc đều khớp dù tên gốc có dấu cách. */
  function slug(s) {
    return fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  /** Tối đa `max` ký tự hiển thị (grapheme) đầu của chuỗi — emoji ghép như 👨‍👩‍👧‍👦 là MỘT. Biểu tượng app do metadata.json tự khai báo nên
      không được tin là ngắn: chuỗi dài sẽ tràn ô 40px. */
  function glyph(s, max) {
    s = String(s == null ? "" : s).trim();
    max = max || 2;
    var parts;
    if (typeof Intl !== "undefined" && Intl.Segmenter) parts = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), function (x) { return x.segment; });
    else parts = Array.from(s);
    return parts.slice(0, max).join("");
  }

  function glyphCount(s) {
    s = String(s == null ? "" : s);
    return typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)).length : Array.from(s).length;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** HTML đã thoát với các đoạn khớp `terms` (đã fold) bọc trong <mark>. */
  function highlight(text, terms) {
    text = String(text == null ? "" : text);
    if (!terms || !terms.length) return esc(text);
    var fm = foldMap(text), ranges = [];
    terms.forEach(function (t) {
      if (!t) return;
      for (var from = 0; ;) {
        var at = fm.text.indexOf(t, from);
        if (at === -1) break;
        ranges.push([at, at + t.length]);
        from = at + t.length;
      }
    });
    if (!ranges.length) return esc(text);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [ranges[0]];
    ranges.slice(1).forEach(function (r) {
      var last = merged[merged.length - 1];
      if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r);
    });
    var html = "", cursor = 0, n = fm.text.length;
    merged.forEach(function (r) {
      var a = fm.map[r[0]], b = r[1];
      while (b < n && fm.map[b] === fm.map[b - 1]) b++;                  // không cắt giữa một ký tự gốc
      b = b >= n ? text.length : fm.map[b];
      if (a < cursor) a = cursor;
      html += esc(text.slice(cursor, a)) + "<mark>" + esc(text.slice(a, b)) + "</mark>";
      cursor = b;
    });
    return html + esc(text.slice(cursor));
  }

  function two(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtDate(ms) {
    var d = new Date(ms);
    return two(d.getDate()) + "/" + two(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  /** "vừa xong", "5 phút trước", "hôm qua", … — `ms` và `now` đều là mili-giây. */
  function relTime(ms, now) {
    if (!ms) return "";
    var s = Math.round((now - ms) / 1000);
    if (s < 0) s = 0;
    if (s < 60) return "vừa xong";
    if (s < 3600) return Math.floor(s / 60) + " phút trước";
    if (s < 86400) return Math.floor(s / 3600) + " giờ trước";
    var d = Math.floor(s / 86400);
    if (d === 1) return "hôm qua";
    if (d < 30) return d + " ngày trước";
    return fmtDate(ms);
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function uniq(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  P.text = { fold: fold, slug: slug, glyph: glyph, glyphCount: glyphCount, foldMap: foldMap, esc: esc, highlight: highlight, relTime: relTime, fmtDate: fmtDate, clamp: clamp, uniq: uniq };
  if (typeof module !== "undefined" && module.exports) module.exports = P.text;
})(typeof globalThis !== "undefined" ? globalThis : this);
