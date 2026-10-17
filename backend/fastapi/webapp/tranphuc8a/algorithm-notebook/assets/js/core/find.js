/* core/find.js — tìm kiếm trong danh mục (dựng sẵn + của tôi). Quét tuyến tính trên chuỗi đã tiền xử lý: 10.000 mục vẫn < 100 ms (check.py đo thật).
   Cách tìm (mọi từ phải khớp — AND):
     tên / bí danh  chính xác 100 · tiền tố 85 · đầu một từ 65 · chứa 45 · gõ sai một chữ (≥ 4 ký tự) 25
     tag            "tag:x" hoặc "#x" lọc đúng tag; từ thường khớp tag cũng được điểm
     độ phức tạp    câu hỏi bắt đầu bằng O( … ) → so khớp dạng rút gọn: "O(logN)" = "O(log N)", khớp thời gian và độ phức tạp từng thao tác
     use case       tìm trong mô tả dùng-khi-nào, tóm tắt, thẻ; rồi tới toàn văn (điều kiện, lỗi thường gặp, mô tả)
     "cat:graph"    lọc nhóm */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var T = A.text;
  var DEEP_BELOW = 30;

  /** Dạng rút gọn để so độ phức tạp: bỏ dấu cách, dấu nhân, log2/lg → log, Θ/Ω → O. */
  function compactCx(s) {
    return T.fold(String(s || "")).replace(/\s+/g, "").replace(/[*·×]/g, "").replace(/log2|lg/g, "log").replace(/√/g, "sqrt").replace(/α/g, "alpha").replace(/[θω]\(/g, "o(");
  }
  function words(s) { return s.split(/[^a-z0-9+#]+/).filter(Boolean); }
  function wordPrefix(ws, t) { for (var i = 0; i < ws.length; i++) if (ws[i].indexOf(t) === 0) return true; return false; }
  function within(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i; var best = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return false;
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length] <= max;
  }

  /** Bản ghi tìm kiếm của một mục. Các trường ngắn gấp sẵn; `text` (mô tả, điều kiện, lỗi thường gặp, ghi chú cá nhân) gấp LƯỜI khi cần lần đầu rồi nhớ lại. */
  function record(e, noteText) {
    var nameK = T.fold(e.name), cx = e.complexity || {}, ops = e.ops || [];
    var tags = (e.tags || []).map(function (t) { return t.toLowerCase(); });
    return {
      e: e, nameK: nameK, nameWords: words(nameK), aliasK: (e.aliases || []).map(T.fold),
      tags: tags, tagWords: words(tags.join(" ")), cx: [compactCx(cx.time)].concat(ops.map(function (o) { return compactCx(o[1]); })),
      main: compactCx(cx.time), catK: T.fold(A.catalog ? A.catalog.catName(e.category) : e.category) + " " + e.category,
      use: T.fold((e.use_case || []).join(" ") + " " + (e.summary || "") + " " + tags.join(" ")),
      hay: null,
      text: null, raw: (e.description || "") + " " + (e.conditions || []).join(" ") + " " + (e.pitfalls || []).join(" ") + " " + (e.not_for || []).join(" ") + " " + (cx.note || "") + " " + (noteText || "")
    };
  }
  /** Một chuỗi gộp mọi trường ngắn: lọc nhanh bằng MỘT indexOf cho mỗi từ (mọi cách khớp không-gõ-sai đều là chuỗi con của nó). */
  function hayOf(r) { return r.hay === null ? (r.hay = r.nameK + "\n" + r.aliasK.join("\n") + "\n" + r.tags.join(" ") + "\n" + r.use + "\n" + r.catK) : r.hay; }
  function build(entries) { return entries.map(function (e) { return record(e); }); }
  function textOf(r) { return r.text === null ? (r.text = T.fold(r.raw)) : r.text; }
  /** Gấp sẵn toàn văn trong lúc rảnh để lần tìm sâu đầu tiên không phải gấp cả 10.000 bản ghi. Gọi lặp tới khi trả true; mỗi lần tối đa budgetMs. */
  function warm(index, budgetMs) {
    var t0 = Date.now(), i = index.warmAt || 0;
    for (; i < index.length; i++) { if (index[i].text === null) textOf(index[i]); if ((i & 63) === 63 && Date.now() - t0 > budgetMs) { i++; break; } }
    index.warmAt = i;
    return i >= index.length;
  }

  function parse(q) {
    q = String(q || "").trim();
    var out = { terms: [], tags: [], cat: "", cx: "" };
    if (/^[oθΘΩ]\s*\(/i.test(q)) { out.cx = compactCx(q); return out; }
    q.split(/\s+/).forEach(function (tk) {
      if (!tk) return;
      var m;
      if ((m = /^(?:tag:|#)(.+)$/i.exec(tk))) out.tags.push(T.fold(m[1])); else if ((m = /^cat:(.+)$/i.exec(tk))) out.cat = T.fold(m[1]); else out.terms.push(T.fold(tk));
    });
    return out;
  }

  function termScore(r, t, fuzzy, deep) {
    var s = 0, i, a;
    if (r.nameK === t) s = 100; else if (r.nameK.indexOf(t) === 0) s = 85; else if (wordPrefix(r.nameWords, t)) s = 65; else if (r.nameK.indexOf(t) !== -1) s = 45;
    if (s < 90) for (i = 0; i < r.aliasK.length; i++) {
      a = r.aliasK[i];
      var v = a === t ? 90 : a.indexOf(t) === 0 ? 70 : wordPrefix(words(a), t) ? 55 : a.indexOf(t) !== -1 ? 35 : 0;
      if (v > s) s = v;
    }
    for (i = 0; i < r.tags.length; i++) { var g = r.tags[i], tv = g === t ? 50 : g.indexOf(t) === 0 ? 38 : 0; if (tv > s) s = tv; }
    if (s < 35 && wordPrefix(r.tagWords, t)) s = Math.max(s, 30);
    if (s < 15 && r.catK.indexOf(t) !== -1) s = 15;
    if (s < 20 && r.use.indexOf(t) !== -1) s = 20;
    if (s < 8 && deep && textOf(r).indexOf(t) !== -1) s = 8;
    if (!s && fuzzy && t.length >= 4) {
      var max = t.length >= 8 ? 2 : 1;
      for (i = 0; i < r.nameWords.length; i++) if (r.nameWords[i].length >= 4 && within(t, r.nameWords[i], max)) { s = 25; break; }
    }
    return s;
  }

  /** index = build(entries). → { results: [{e, score}], total, ms }. o: {limit, filter(e) → bool}. Truy vấn rỗng → mọi mục (đã lọc) theo tên. */
  function search(index, q, o) {
    o = o || {};
    var t0 = Date.now(), p = parse(q), limit = o.limit || 100, filter = o.filter, out = [], i, r;
    var anyText = p.terms.length || p.tags.length || p.cat || p.cx;
    var tagOk = function (r) { return !p.tags.length || p.tags.every(function (tg) { return r.tags.some(function (x) { return T.fold(x) === tg || x.indexOf(tg) === 0; }); }); };
    function scan(deep, fuzzy) {
      var res = [];
      for (i = 0; i < index.length; i++) {
        r = index[i];
        if (filter && !filter(r.e)) continue;
        if (!anyText) { res.push({ e: r.e, score: 0 }); continue; }
        if (p.cat && r.catK.indexOf(p.cat) === -1) continue;
        if (!tagOk(r)) continue;
        if (p.cx) {
          var hit = false;
          for (var k = 0; k < r.cx.length; k++) if (r.cx[k].indexOf(p.cx) !== -1) { hit = true; break; }
          if (hit) res.push({ e: r.e, score: r.main === p.cx ? 100 : r.main.indexOf(p.cx) !== -1 ? 80 : 50 });
          continue;
        }
        var total = 0, ok = true, j;
        if (!fuzzy) for (j = 0; j < p.terms.length && ok; j++) if (hayOf(r).indexOf(p.terms[j]) === -1 && !(deep && textOf(r).indexOf(p.terms[j]) !== -1)) ok = false;   // lọc nhanh
        for (j = 0; j < p.terms.length && ok; j++) { var sc = termScore(r, p.terms[j], fuzzy, deep); if (!sc) ok = false; else total += sc; }
        if (ok) res.push({ e: r.e, score: total + (p.terms.length ? 0 : 1) });
      }
      return res;
    }
    out = scan(false, false);                                             // lượt 1: các trường ngắn (tên, bí danh, tag, use case) — nhanh
    if (p.terms.length && !p.cx && out.length < DEEP_BELOW) out = scan(true, false);   // ít kết quả → tìm cả toàn văn (mô tả, lỗi thường gặp, ghi chú)
    if (!out.length && p.terms.length && !p.cx) out = scan(true, true);   // vẫn không có → thử gõ sai chính tả
    out.sort(function (a, b) { return b.score - a.score || (a.e.name < b.e.name ? -1 : a.e.name > b.e.name ? 1 : 0); });
    var total = out.length;
    return { results: out.slice(0, limit), total: total, ms: Date.now() - t0, parsed: p };
  }

  A.find = { build: build, record: record, warm: warm, search: search, parse: parse, compactCx: compactCx, within: within };
  if (typeof module !== "undefined" && module.exports) module.exports = A.find;
})(typeof globalThis !== "undefined" ? globalThis : this);
