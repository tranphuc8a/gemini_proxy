/* complete.js — gợi ý khi gõ (autocomplete) cho Code Studio. Thuần, không DOM, kiểm bằng node (kiem-goi-y.js).
   CS.complete.suggest({text, pos, lang, extraWords?, limit?}) → {from, to, prefix, context, items:[{label, insert, kind, detail, snippet}]}
     • trong chuỗi/chú thích: không gợi ý (trừ `#include <…>` / `"…"` → tên tệp tiêu đề)
     • sau `#` đầu dòng (C/C++/C#): chỉ thị tiền xử lý
     • sau `.` `->` `::` `?.`: thành viên — suy kiểu biến từ khai báo trong tệp (vector<int> v → push_back, size…);
       không rõ kiểu thì dùng những tên từng đứng sau dấu chấm trong tệp + thành viên phổ biến
     • còn lại: từ khoá, kiểu, hàm/ký hiệu có sẵn, mẫu đoạn mã (snippet), tên trong tệp (và các tệp khác của dự án qua extraWords)
   Xếp hạng: đúng tiền tố (phân biệt hoa thường) > tiền tố không phân biệt > khớp đầu từ (pb → push_back) > khớp rải; rồi theo loại và tần suất. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  var PP = "include define undef ifdef ifndef if elif else endif pragma error warning line".split(" ");
  var EXTRA = {
    javascript: {
      Array: "push pop shift unshift slice splice concat join map filter reduce reduceRight forEach find findIndex findLast some every includes indexOf lastIndexOf sort reverse flat flatMap fill keys values entries at length",
      String: "length charAt charCodeAt codePointAt indexOf lastIndexOf includes startsWith endsWith slice substring split trim trimStart trimEnd toUpperCase toLowerCase replace replaceAll repeat padStart padEnd match matchAll at localeCompare normalize",
      Map: "get set has delete clear size keys values entries forEach", Set: "add has delete clear size keys values entries forEach",
      Number: "toFixed toString toPrecision", Object: "hasOwnProperty toString valueOf"
    },
    python: {},
    java: { Array: "length clone" }
  };
  EXTRA.typescript = EXTRA.javascript;

  function isWordCh(c) { return /[A-Za-z0-9_$À-￿]/.test(c); }

  /** Chữ cái đầu mỗi "từ con": pushBack → pb, push_back → pb, HashMap → hm. */
  function initials(s) {
    var out = s.charAt(0).toLowerCase();
    for (var i = 1; i < s.length; i++) {
      var c = s.charAt(i), p = s.charAt(i - 1);
      if ((c >= "A" && c <= "Z" && !(p >= "A" && p <= "Z")) || ((p === "_" || p === "$") && c !== "_")) out += c.toLowerCase();
    }
    return out;
  }
  /** Điểm khớp của `label` với `prefix` (0 = không khớp). */
  function matchScore(label, prefix) {
    if (!prefix) return 500;
    if (label.indexOf(prefix) === 0) return 1000;
    var ll = label.toLowerCase(), pl = prefix.toLowerCase();
    if (ll.indexOf(pl) === 0) return 800;
    if (pl.length >= 2 && initials(label).indexOf(pl) === 0) return 650;
    if (pl.length >= 2) {                                            /* khớp rải: các ký tự theo đúng thứ tự, chữ đầu phải khớp */
      if (ll.charAt(0) !== pl.charAt(0)) return 0;
      var j = 0;
      for (var i = 0; i < ll.length && j < pl.length; i++) if (ll.charAt(i) === pl.charAt(j)) j++;
      if (j === pl.length) return 300;
    }
    return 0;
  }

  /** Phân tích ngữ cảnh tại con trỏ dựa trên từ tố của phần văn bản trước con trỏ. */
  function contextAt(text, pos, L) {
    var before = text.slice(0, pos), lineStart = before.lastIndexOf("\n") + 1, line = before.slice(lineStart);
    var m;
    if ((L.id === "c" || L.id === "cpp") && (m = /^\s*#\s*include\s*([<"])([^>"]*)$/.exec(line))) return { kind: "include", prefix: m[2], from: pos - m[2].length, quote: m[1] };
    if ((L.id === "c" || L.id === "cpp" || L.id === "csharp") && (m = /^\s*#\s*(\w*)$/.exec(line))) return { kind: "pp", prefix: m[1], from: pos - m[1].length };
    if (before.length <= 400000) {
      var toks = CS.tokenize.run(before, L.id), last = toks[toks.length - 1];
      if (last && (last.k === "st" || last.k === "cm" || last.k === "rx")) {
        /* con trỏ ở trong (hoặc ngay sau) chuỗi/chú thích chưa đóng? */
        var v = last.v, closed;
        if (last.k === "cm") closed = /^\/\*/.test(v) ? /\*\/$/.test(v) && v.length >= 4 : false;
        else if (last.k === "st") { var q = v.replace(/^[A-Za-z@$]*/, "").charAt(0); closed = v.length >= 2 && v.charAt(v.length - 1) === q && !/\\$/.test(v.slice(0, -1)) && !(q === '"' && /^"""/.test(v.replace(/^[A-Za-z@$]*/, "")) && !/"""$/.test(v)); }
        else closed = true;
        if (!closed) return { kind: "none" };
      }
    }
    var p = pos;
    while (p > 0 && isWordCh(text.charAt(p - 1))) p--;
    var prefix = text.slice(p, pos), q2 = p;
    while (q2 > 0 && (text.charAt(q2 - 1) === " " || text.charAt(q2 - 1) === "\t")) q2--;
    var op = text.slice(Math.max(0, q2 - 2), q2);
    var member = op === "->" || op === "::" || op === "?." ? op : (text.charAt(q2 - 1) === "." && text.charAt(q2 - 2) !== "." ? "." : null);
    if (member) {
      var e = q2 - member.length, s = e;
      while (s > 0 && isWordCh(text.charAt(s - 1))) s--;
      var obj = text.slice(s, e);
      if (text.charAt(e - 1) === ")" || text.charAt(e - 1) === "]") obj = "";
      /* System.out. → "System.out" */
      var s2 = s;
      if (text.charAt(s - 1) === "." && obj) { var s3 = s - 1; while (s3 > 0 && isWordCh(text.charAt(s3 - 1))) s3--; var outer = text.slice(s3, s - 1); if (outer) obj = outer + "." + obj; s2 = s3; }
      return { kind: "member", prefix: prefix, from: p, op: member, object: obj };
    }
    return { kind: "word", prefix: prefix, from: p };
  }

  /** Suy kiểu các biến từ khai báo trong tệp: {tênBiến: Kiểu} — đủ để gợi ý thành viên. */
  function inferTypes(text, L) {
    var types = Object.create(null), keys = Object.keys(L.memberMap || {}).concat(Object.keys((EXTRA[L.id] || {})));
    var m, re;
    if (L.id === "cpp" || L.id === "c" || L.id === "java" || L.id === "csharp") {
      var names = keys.filter(function (k) { return /^[A-Za-z_]\w*$/.test(k); }).join("|");
      if (names) {
        re = new RegExp("\\b(?:std::)?(" + names + ")\\b\\s*(?:<[^;(){}]*?>)?\\s*(?:\\[\\s*\\])?\\s*[&*]?\\s*([A-Za-z_]\\w*(?:\\s*(?:\\[[^\\]]*\\]|\\([^)]*\\)|\\{[^}]*\\})?\\s*,\\s*[&*]?\\s*[A-Za-z_]\\w*)*)", "g");
        while ((m = re.exec(text))) {
          var t = m[1];
          m[2].split(",").forEach(function (part) { var nm = /([A-Za-z_]\w*)\s*$/.exec(part.replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, "").trim()); if (nm && !L.kwSet[nm[1]]) types[nm[1]] = t; });
        }
      }
      /* auto x = vector<...>(...) / new ArrayList<>() */
      re = /\b(?:auto|var)\s+([A-Za-z_]\w*)\s*=\s*(?:new\s+)?(?:std::)?([A-Za-z_]\w*)/g;
      while ((m = re.exec(text))) if (keys.indexOf(m[2]) >= 0) types[m[1]] = m[2];
      if (L.id === "java") { re = /\b(ArrayList|LinkedList)\b/; }
    } else if (L.id === "javascript" || L.id === "typescript") {
      re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*([A-Za-z_][\w<>\[\]]*))?\s*=\s*(\[|\{|"|'|`|new\s+([A-Za-z_]\w*)|-?\d|[A-Za-z_$][\w$.]*\.(?:split|map|filter|slice|concat)\()/g;
      while ((m = re.exec(text))) {
        var v = m[3], tp = m[4] ? m[4] : v === "[" || /\.(split|map|filter|slice|concat)\($/.test(v) ? "Array" : v === "{" ? "Object" : /^["'`]$/.test(v) ? "String" : /^-?\d$/.test(v) ? "Number" : null;
        if (m[2]) tp = /\[\]$/.test(m[2]) || /^Array/.test(m[2]) ? "Array" : m[2] === "string" ? "String" : m[2] === "number" ? "Number" : (m[2].replace(/<.*$/, "") || tp);
        if (tp) types[m[1]] = tp;
      }
    } else if (L.id === "python") {
      re = /^[ \t]*([A-Za-z_]\w*)\s*(?::\s*(\w+))?\s*=\s*(\[|\{|"|'|f"|f'|-?\d|set\(|dict\(|list\(|str\(|input\(\))/gm;
      while ((m = re.exec(text))) {
        var pv = m[3], pt = m[2] || (pv === "[" || pv === "list(" ? "list" : pv === "{" || pv === "dict(" ? "dict" : pv === "set(" ? "set" : /^(["']|f["']|str\(|input\(\))$/.test(pv) ? "str" : null);
        if (pt) types[m[1]] = pt;
      }
    }
    return types;
  }

  /** Các tên từng đứng sau dấu chấm/mũi tên trong tệp (gợi ý thành viên khi chưa rõ kiểu). */
  function usedMembers(text, object) {
    var out = Object.create(null), re = /([A-Za-z_$][\w$]*)\s*(?:\.|->)\s*([A-Za-z_$][\w$]*)/g, m;
    while ((m = re.exec(text))) if (!object || m[1] === object) out[m[2]] = (out[m[2]] || 0) + 1;
    return out;
  }

  /** Mọi tên (định danh) trong văn bản kèm số lần xuất hiện. Bỏ từ ở ngay con trỏ. */
  function words(text, skipFrom, skipTo) {
    var out = Object.create(null), re = /[A-Za-z_$À-￿][\w$À-￿]*/g, m;
    while ((m = re.exec(text))) {
      if (m.index >= skipFrom && m.index < skipTo) continue;
      if (m[0].length < 2 || /^\d/.test(m[0])) continue;
      out[m[0]] = (out[m[0]] || 0) + 1;
    }
    return out;
  }

  function suggest(o) {
    var text = String(o.text || ""), pos = Math.max(0, Math.min(o.pos == null ? text.length : o.pos, text.length));
    var L = CS.langs.get(o.lang), limit = o.limit || 40;
    var ctx = contextAt(text, pos, L);
    var to = pos;
    while (to < text.length && isWordCh(text.charAt(to))) to++;                  /* thay luôn phần còn lại của từ đang đứng */
    var res = { from: ctx.from == null ? pos : ctx.from, to: ctx.kind === "include" ? pos : to, prefix: ctx.prefix || "", context: ctx.kind, items: [] };
    if (ctx.kind === "none") return res;
    var cand = [], seen = Object.create(null);
    function add(label, kind, base, detail, insert, snippet) {
      if (!label || seen[label + "\u0000" + (snippet ? "s" : "")]) return;
      var ms = matchScore(label, res.prefix);
      if (!ms) return;
      if (label === res.prefix && !snippet) return;
      seen[label + "\u0000" + (snippet ? "s" : "")] = 1;
      cand.push({ label: label, insert: insert == null ? label : insert, kind: kind, detail: detail || "", snippet: !!snippet, score: ms + base - label.length * 0.3 });
    }
    if (ctx.kind === "include") {
      String(L.includes || "").split(/\s+/).forEach(function (h) { add(h, "file", 0, "tệp tiêu đề", h + (ctx.quote === "<" ? ">" : '"')); });
      (o.files || []).forEach(function (f) { if (/\.(h|hpp|hh|hxx)$/i.test(f)) add(f, "file", 30, "tệp của dự án", f + (ctx.quote === "<" ? ">" : '"')); });
    } else if (ctx.kind === "pp") {
      PP.forEach(function (d) { add(d, "keyword", 0, "chỉ thị tiền xử lý", d === "include" ? "include <$0>" : d, d === "include"); });
    } else if (ctx.kind === "member") {
      var types = inferTypes(text, L), obj = ctx.object, isVar = !!types[obj], typ = types[obj] || (L.memberMap[obj] ? obj : null) || ((EXTRA[L.id] || {})[obj] ? obj : null);
      if (ctx.op === "::" && (obj === "std" || obj === "")) {
        Object.keys(L.tySet).forEach(function (k) { add(k, "type", 40, "std"); });
        Object.keys(L.biSet).forEach(function (k) { add(k, "function", 30, "std"); });
      } else {
        /* biến (a = [] …) → phương thức thể hiện trước; tên kiểu (Array., Math.) → thành viên tĩnh trước */
        var inst = typ ? String((EXTRA[L.id] || {})[typ] || "").split(/\s+/).filter(Boolean) : [], stat = typ ? (L.memberMap[typ] || []) : [];
        var list = isVar ? inst.concat(stat) : stat.concat(inst);
        list.forEach(function (k, i) { add(k, "member", 120 - Math.min(i, 40), typ); });
        var used = usedMembers(text.slice(0, ctx.from) + text.slice(to), obj);
        Object.keys(used).forEach(function (k) { add(k, "member", 60 + Math.min(used[k], 20), "đã dùng"); });
        if (!typ) {
          var anyUsed = usedMembers(text.slice(0, ctx.from) + text.slice(to), null);
          Object.keys(anyUsed).forEach(function (k) { add(k, "member", 20 + Math.min(anyUsed[k], 10), "trong tệp"); });
          var mm = L.memberMap; Object.keys(mm).forEach(function (t) { mm[t].forEach(function (k) { add(k, "member", 0, t); }); });
        }
      }
    } else {
      if (!res.prefix && !o.explicit) return res;
      L.snippetList.forEach(function (s) { add(s.label, "snippet", 45, "mẫu: " + s.body.split("\n")[0].replace("$0", "…").slice(0, 40), s.body, true); });
      Object.keys(L.kwSet).forEach(function (k) { add(k, "keyword", 40); });
      Object.keys(L.tySet).forEach(function (k) { add(k, "type", 35); });
      Object.keys(L.biSet).forEach(function (k) { add(k, "function", 30); });
      var ws = words(text, res.from, to);
      Object.keys(ws).forEach(function (k) { add(k, "variable", 50 + Math.min(ws[k], 25)); });
      (o.extraWords || []).forEach(function (k) { add(k, "variable", 25, "tệp khác"); });
    }
    cand.sort(function (a, b) { return b.score - a.score || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0); });
    res.items = cand.slice(0, limit).map(function (c) { return { label: c.label, insert: c.insert, kind: c.kind, detail: c.detail, snippet: c.snippet }; });
    return res;
  }

  /**
   * Áp một gợi ý vào văn bản: thay [from,to) bằng insert; snippet thì thụt mọi dòng theo dòng hiện tại và đặt con trỏ ở $0.
   * Trả {text, cursor}. Thuần — trình soạn gọi rồi tự đặt giá trị/con trỏ (giữ được hoàn tác bằng execCommand).
   */
  function apply(text, res, item, indentUnit) {
    var from = res.from, to = res.to, ins = item.insert;
    var lineStart = text.lastIndexOf("\n", from - 1) + 1, indent = (/^[ \t]*/.exec(text.slice(lineStart, from)) || [""])[0];
    if (item.snippet) {
      ins = ins.split("\n").map(function (l, i) { return i ? indent + l.replace(/^( {4})+/, function (m) { return indentUnit ? new Array(m.length / 4 + 1).join(indentUnit) : m; }) : l; }).join("\n");
      var cur = ins.indexOf("$0"); ins = ins.replace("$0", "");
      return { text: text.slice(0, from) + ins + text.slice(to), cursor: from + (cur < 0 ? ins.length : cur), insert: ins, from: from, to: to };
    }
    return { text: text.slice(0, from) + ins + text.slice(to), cursor: from + ins.length, insert: ins, from: from, to: to };
  }

  CS.complete = { suggest: suggest, apply: apply, matchScore: matchScore, initials: initials, inferTypes: inferTypes, contextAt: contextAt };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.complete;
})(typeof globalThis !== "undefined" ? globalThis : this);
