/* search.js — cú pháp tìm kiếm và chấm điểm. Thuần, kiểm bằng node.

   Cú pháp (mọi thứ đều bỏ dấu, không phân biệt hoa thường):
     từ khoá …        mọi từ phải xuất hiện đâu đó (AND); tên > tag > thể loại > thư mục > mô tả
     #tag             chỉ app có tag đó (khớp đầu tag)
     @thumuc          chỉ app trong thư mục đó (khớp tên hoặc nhãn)
     loai:khoa-hoc    chỉ app thuộc thể loại đó (cũng viết cat:…) */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  if (!P.text && typeof require === "function") require("./text.js");
  var fold = P.text.fold, slug = P.text.slug;

  var WEIGHTS = { title: 100, name: 80, tags: 45, category: 35, collection: 30, desc: 12 };

  function parseQuery(q) {
    var out = { terms: [], tags: [], collections: [], categories: [], text: "" };
    String(q == null ? "" : q).trim().split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      var m;
      if (tok.charAt(0) === "#" && tok.length > 1) out.tags.push(slug(tok.slice(1)));
      else if (tok.charAt(0) === "@" && tok.length > 1) out.collections.push(slug(tok.slice(1)));
      else if ((m = /^(?:cat|loai):(.+)$/.exec(fold(tok)))) out.categories.push(slug(m[1]));
      else out.terms.push(fold(tok));
    });
    out.text = out.terms.join(" ");
    return out;
  }

  function isEmpty(parsed) {
    return !parsed.terms.length && !parsed.tags.length && !parsed.collections.length && !parsed.categories.length;
  }

  function atBoundary(text, at) {
    if (at === 0) return true;
    return !/[a-z0-9]/.test(text.charAt(at - 1));
  }

  /** 0 = không khớp. Không có từ khoá thì mọi app điểm 1 (để dùng chung một đường lọc/sắp xếp). */
  function score(app, terms) {
    if (!terms.length) return 1;
    var f = app.f, total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i], best = 0;
      for (var key in WEIGHTS) {
        var text = f[key];
        if (!text) continue;
        var at = text.indexOf(term);
        if (at === -1) continue;
        var pts = WEIGHTS[key];
        if (at === 0) pts *= 1.6; else if (atBoundary(text, at)) pts *= 1.25;
        if (text === term) pts *= 2.2;
        if (pts > best) best = pts;
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  /** #tag, @thumuc, loai: — phần "bộ lọc" của câu truy vấn. */
  function matchesTokens(app, parsed) {
    var f = app.f, i;
    for (i = 0; i < parsed.tags.length; i++) {
      var t = parsed.tags[i];
      if (!f.tagSlugs.some(function (x) { return x === t || x.indexOf(t) === 0; })) return false;
    }
    for (i = 0; i < parsed.collections.length; i++) {
      var c = parsed.collections[i];
      if (f.collectionSlug.indexOf(c) !== 0 && f.labelSlug.indexOf(c) !== 0) return false;
    }
    for (i = 0; i < parsed.categories.length; i++) {
      if (f.categorySlug.indexOf(parsed.categories[i]) === -1) return false;
    }
    return true;
  }

  P.search = { parseQuery: parseQuery, isEmpty: isEmpty, score: score, matchesTokens: matchesTokens, WEIGHTS: WEIGHTS };
  if (typeof module !== "undefined" && module.exports) module.exports = P.search;
})(typeof globalThis !== "undefined" ? globalThis : this);
