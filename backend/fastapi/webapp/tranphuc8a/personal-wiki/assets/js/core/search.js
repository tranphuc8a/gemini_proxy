/* search.js — tìm kiếm: tách từ, cú pháp truy vấn, danh sách bài đăng (posting) nén, giao nhiều danh sách, tóm tắt có tô sáng. Thuần, kiểm bằng node.

   Chỉ mục ngược (token → danh sách note) được cất trong IndexedDB (repo.js), cập nhật theo từng lần lưu, nên mở app không phải quét lại 100.000 note.
   Một mục trong danh sách là MỘT số nguyên 32-bit:  entry = n·32 + tf·8 + cờ
       n   số thứ tự note (< 2^27 ≈ 134 triệu)           cờ  bit0 = có trong tiêu đề, bit1 = có trong tag, bit2 = có trong nội dung
       tf  số lần xuất hiện trong nội dung, chặn ở 3
   Danh sách luôn sắp tăng theo n ⇒ chèn/xoá/giao bằng tìm nhị phân và hai con trỏ, không cần giải nén.

   Cú pháp truy vấn (bỏ dấu, không phân biệt hoa thường):   từ khoá …  "cụm từ chính xác"  tag:algorithm  status:archived  is:fav  kind:book */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  if (!W.text && typeof require === "function") require("./text.js");
  var T = W.text;

  var MAX_TOKEN = 40;
  /** Từ quá phổ biến (Anh + Việt đã bỏ dấu): chỉ mục không lưu — danh sách của chúng dài bằng cả kho và không giúp tìm. */
  var STOP = {};
  ("a an and or of to in on at is are was were be been it its this that these those with for as by from not no but if so do does did has have had will would can could " +
   "la va cua cac mot nhung nay do cho duoc co khong trong voi de den tu khi se da rat nhu ma hay the nao nen thi cung con cai nguoi vao ra len xuong lai moi nhieu it hon").split(" ")
    .forEach(function (w) { STOP[w] = 1; });

  var TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;
  /** Văn bản → mảng token đã fold (có lặp). Bỏ token ngắn hơn 2 ký tự (trừ số), dài hơn 40, và từ dừng. */
  function tokenize(text, keepStop) {
    var parts = T.fold(text).split(TOKEN_SPLIT), out = [];
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i];
      if (!t || t.length > MAX_TOKEN || (t.length < 2 && !/^\d$/.test(t))) continue;
      if (!keepStop && STOP[t]) continue;
      out.push(t);
    }
    return out;
  }

  /** Note → Map token → entry (không có n; n nhân vào sau). Tiêu đề và tag nhẹ hơn nội dung nhưng được ưu tiên khi xếp hạng. */
  function indexTerms(note) {
    var m = new Map();
    function bump(tok, flag, tf) { var cur = m.get(tok) || 0; m.set(tok, ((cur & 7) | flag) | (Math.max(cur >> 3 & 3, tf) << 3)); }
    tokenize(note.title).forEach(function (t) { bump(t, 1, 0); });
    (note.tags || []).forEach(function (tag) { tokenize(tag.replace(/[-_./]/g, " "), true).forEach(function (t) { bump(t, 2, 0); }); tokenize(tag, true).forEach(function (t) { bump(t, 2, 0); }); });
    var counts = new Map(), toks = tokenize(note.content);
    for (var i = 0; i < toks.length; i++) counts.set(toks[i], (counts.get(toks[i]) || 0) + 1);
    counts.forEach(function (c, t) { bump(t, 4, Math.min(3, c)); });
    return m;
  }

  // ----------------------------------------------------------------------------------------------- posting list
  function entryN(e) { return e >>> 5; }
  function mk(n, bits) { return (n * 32 + bits) >>> 0; }

  /** Vị trí đầu tiên có n' >= n (tìm nhị phân). */
  function lowerBound(arr, n) {
    var lo = 0, hi = arr.length;
    while (lo < hi) { var mid = (lo + hi) >>> 1; if ((arr[mid] >>> 5) < n) lo = mid + 1; else hi = mid; }
    return lo;
  }

  /** Đặt (n → bits) vào danh sách (bits = 0 → xoá n). Trả Uint32Array MỚI, hoặc chính `arr` nếu không đổi. */
  function postingSet(arr, n, bits) {
    arr = arr || new Uint32Array(0);
    var at = lowerBound(arr, n), has = at < arr.length && (arr[at] >>> 5) === n;
    if (has && bits && arr[at] === mk(n, bits)) return arr;
    if (!has && !bits) return arr;
    var out;
    if (has && bits) { out = arr.slice(); out[at] = mk(n, bits); return out; }
    if (has) { out = new Uint32Array(arr.length - 1); out.set(arr.subarray(0, at), 0); out.set(arr.subarray(at + 1), at); return out; }
    out = new Uint32Array(arr.length + 1);
    out.set(arr.subarray(0, at), 0); out[at] = mk(n, bits); out.set(arr.subarray(at), at + 1);
    return out;
  }

  /** Trộn một lô (đã sắp tăng theo n) vào danh sách: thêm/đổi/xoá nhiều n một lần — O(len + lô), dùng khi nhập hàng loạt. */
  function postingMerge(arr, batch) {
    arr = arr || new Uint32Array(0);
    var out = new Uint32Array(arr.length + batch.length), i = 0, j = 0, k = 0;
    while (i < arr.length || j < batch.length) {
      var a = i < arr.length ? arr[i] >>> 5 : Infinity, b = j < batch.length ? batch[j][0] : Infinity;
      if (a < b) out[k++] = arr[i++];
      else if (a > b) { if (batch[j][1]) out[k++] = mk(b, batch[j][1]); j++; }
      else { if (batch[j][1]) out[k++] = mk(b, batch[j][1]); i++; j++; }
    }
    return out.subarray(0, k).slice();
  }

  /** Giao nhiều danh sách → [{n, bits, tf}] (bits = OR cờ; tf = tổng tf), theo thứ tự n tăng. Chạy từ danh sách NGẮN NHẤT. */
  function intersect(lists) {
    if (!lists.length) return [];
    var ord = lists.slice().sort(function (a, b) { return a.length - b.length; }), base = ord[0], out = [];
    for (var i = 0; i < base.length; i++) {
      var n = base[i] >>> 5, bits = base[i] & 7, tf = base[i] >>> 3 & 3, ok = true;
      for (var k = 1; k < ord.length; k++) {
        var l = ord[k], at = lowerBound(l, n);
        if (at >= l.length || (l[at] >>> 5) !== n) { ok = false; break; }
        bits |= l[at] & 7; tf += l[at] >>> 3 & 3;
      }
      if (ok) out.push({ n: n, bits: bits, tf: tf });
    }
    return out;
  }

  /** Hợp (cho mở rộng tiền tố: "filt" → filter ∪ filtering …): giữ OR cờ, tf lớn nhất. */
  function union(lists) {
    var m = new Map();
    lists.forEach(function (l) {
      for (var i = 0; i < l.length; i++) {
        var n = l[i] >>> 5, cur = m.get(n);
        m.set(n, cur === undefined ? (l[i] & 31) : ((cur | l[i]) & 7) | (Math.max(cur >>> 3 & 3, l[i] >>> 3 & 3) << 3));
      }
    });
    var ns = Array.from(m.keys()).sort(function (a, b) { return a - b; }), out = new Uint32Array(ns.length);
    for (var i = 0; i < ns.length; i++) out[i] = mk(ns[i], m.get(ns[i]));
    return out;
  }

  // ----------------------------------------------------------------------------------------------- truy vấn
  function parseQuery(q) {
    var out = { terms: [], phrases: [], tags: [], status: "", fav: false, kind: "", text: "", raw: String(q == null ? "" : q).slice(0, 300) }, s = out.raw;
    s = s.replace(/"([^"]{1,200})"/g, function (_, p) { var f = T.fold(p).replace(/\s+/g, " ").trim(); if (f) out.phrases.push(f); return " "; });
    s.trim().split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      var m = /^(tag|status|kind|is):(.*)$/i.exec(tok);
      if (m) {
        var key = m[1].toLowerCase(), val = T.fold(m[2]);
        if (key === "tag" && val) out.tags.push(W.notes ? W.notes.normTag(m[2]) : val);
        else if (key === "status" && /^(active|archived|trashed)$/.test(val)) out.status = val;
        else if (key === "kind" && /^(note|daily|book|chapter|quote)$/.test(val)) out.kind = val;
        else if (key === "is" && /^(fav|favorite|favourite|pinned)$/.test(val)) out.fav = true;
        else if (val) out.terms.push(val);
        return;
      }
      T.fold(tok).split(TOKEN_SPLIT).forEach(function (t) { if (t) out.terms.push(t); });
    });
    out.terms = out.terms.filter(function (t) { return t.length <= MAX_TOKEN; });
    out.text = out.terms.join(" ");
    return out;
  }
  function isEmpty(p) { return !p.terms.length && !p.phrases.length && !p.tags.length && !p.status && !p.fav && !p.kind; }

  /** Điểm xếp hạng từ cờ/tf của TỪNG từ khoá đã khớp (cộng các từ), cộng thưởng cho tiêu đề; recency tách riêng để hoà điểm. */
  function scoreBits(bits, tf) { return (bits & 1 ? 100 : 0) + (bits & 2 ? 40 : 0) + (bits & 4 ? 10 + tf * 3 : 0); }

  /** Đoạn trích ~`len` ký tự quanh chỗ khớp đầu tiên, đã thoát HTML, từ khoá bọc <mark>. */
  function snippet(content, terms, len) {
    len = len || 140;
    var text = String(content == null ? "" : content).replace(/\s+/g, " "), flat = T.foldMap(text), at = -1, ts = terms.filter(Boolean);
    for (var i = 0; i < ts.length; i++) { var p = flat.text.indexOf(ts[i]); if (p !== -1 && (at === -1 || p < at)) at = p; }
    var start = at === -1 ? 0 : Math.max(0, flat.map[at] - Math.floor(len / 3));
    if (start > 0) { var sp = text.indexOf(" ", start); if (sp !== -1 && sp - start < 14) start = sp + 1; }
    var piece = text.slice(start, start + len);
    return (start > 0 ? "…" : "") + T.highlight(piece, ts) + (start + len < text.length ? "…" : "");
  }

  W.search = {
    tokenize: tokenize, indexTerms: indexTerms, postingSet: postingSet, postingMerge: postingMerge, intersect: intersect, union: union, lowerBound: lowerBound, entryN: entryN, mk: mk,
    parseQuery: parseQuery, isEmpty: isEmpty, scoreBits: scoreBits, snippet: snippet, STOP: STOP, MAX_TOKEN: MAX_TOKEN
  };
  if (typeof module !== "undefined" && module.exports) module.exports = W.search;
})(typeof globalThis !== "undefined" ? globalThis : this);
