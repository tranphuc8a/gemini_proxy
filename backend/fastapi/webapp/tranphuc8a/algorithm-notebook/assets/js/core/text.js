/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */
/* text.js — chuỗi thuần: bỏ dấu tiếng Việt, thoát HTML, tô sáng, thời gian, băm, id.
   Không DOM, không đồng hồ ngầm (nhận `now`) → kiểm được bằng node (kiem.js). */
(function (root) {
  "use strict";
  var W = root.Algo || (root.Algo = {});
  var MARKS = /[̀-ͯ]/g;

  /** Chữ thường, bỏ dấu, đ → d: "Đồ thị" khớp "do thi".
      Nhanh: chuỗi toàn ASCII đi đường tắt; ký tự khác ASCII được gấp từng chữ qua bảng nhớ (normalize cả chuỗi chậm gấp 3–10 lần,
      đo trên 10.000 chuỗi). Kết quả y hệt toLowerCase → NFD → bỏ dấu → đ→d. */
  var FOLD_MEMO = [];
  function fold(s) {
    s = String(s == null ? "" : s).toLowerCase();
    if (!/[^\x00-\x7f]/.test(s)) return s;
    var out = "", start = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) continue;
      var m = FOLD_MEMO[c];
      if (m === undefined) { m = s.charAt(i).normalize("NFD").replace(MARKS, "").replace(/đ/g, "d"); FOLD_MEMO[c] = m; }
      if (m !== s.charAt(i)) { out += s.slice(start, i) + m; start = i + 1; }
    }
    return start === 0 ? s : out + s.slice(start);
  }

  /** fold + bảng dò: map[i] là chỉ số trong chuỗi GỐC của ký tự thứ i sau fold (phần tử cuối = độ dài gốc). */
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

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** "Khoá học" → "khoa-hoc". */
  function slug(s) { return fold(s).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""); }

  /** Khoá so sánh tiêu đề: bỏ dấu, thường, gộp khoảng trắng. "Hash  Function" ≡ "hash function". */
  function titleKey(s) { return fold(s).replace(/\s+/g, " ").trim(); }

  /** HTML đã thoát; các đoạn khớp `terms` (đã fold) bọc trong <mark>. */
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
  /** 'YYYY-MM-DD' theo GIỜ MÁY (ngày ghi chú theo ngày của người dùng, không theo UTC). */
  function dateKey(ms) { var d = new Date(ms); return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()); }
  function isDateKey(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && dateKey(new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)).getTime()) === s; }
  function fmtDate(ms) { var d = new Date(ms); return two(d.getDate()) + "/" + two(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function fmtDateTime(ms) { var d = new Date(ms); return fmtDate(ms) + " " + two(d.getHours()) + ":" + two(d.getMinutes()); }

  function relTime(ms, now) {
    if (!ms) return "";
    var s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 60) return "vừa xong";
    if (s < 3600) return Math.floor(s / 60) + " phút trước";
    if (s < 86400) return Math.floor(s / 3600) + " giờ trước";
    var d = Math.floor(s / 86400);
    if (d === 1) return "hôm qua";
    if (d < 30) return d + " ngày trước";
    return fmtDate(ms);
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function uniq(list) { var seen = {}, out = []; (list || []).forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }

  /** Băm 53-bit (cyrb53) → chuỗi hex 14 ký tự. Không mật mã; dùng làm id thẻ ôn và dấu chỉ mục. */
  function hash53(str, seed) {
    var h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    var n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return ("00000000000000" + n.toString(16)).slice(-14);
  }

  /** uuid v4. `rand` tuỳ chọn (hàm trả [0,1)) để kiểm được. */
  function uid(rand) {
    if (!rand && root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    var r = rand || Math.random;
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var v = Math.floor(r() * 16);
      return (c === "x" ? v : (v & 3) | 8).toString(16);
    });
  }
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  function bytes(str) { return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(str) : Uint8Array.from(unescape(encodeURIComponent(str)), function (c) { return c.charCodeAt(0); }); }
  function fmtBytes(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : n < 1073741824 ? (n / 1048576).toFixed(1) + " MB" : (n / 1073741824).toFixed(2) + " GB"; }

  W.text = {
    fold: fold, foldMap: foldMap, esc: esc, slug: slug, titleKey: titleKey, highlight: highlight, dateKey: dateKey, isDateKey: isDateKey,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, relTime: relTime, clamp: clamp, uniq: uniq, hash53: hash53, uid: uid, UUID_RE: UUID_RE, bytes: bytes, fmtBytes: fmtBytes
  };
  if (typeof module !== "undefined" && module.exports) module.exports = W.text;
})(typeof globalThis !== "undefined" ? globalThis : this);
