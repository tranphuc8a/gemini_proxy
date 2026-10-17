/* core/catalog.js — danh mục hợp nhất: mục dựng sẵn (Algo.lib) + mục của người dùng (thư viện cá nhân). Chuẩn hoá mục người dùng nhập tay.
   Mục của tôi có id "u-<uuid>", source "user", category là một nhóm dựng sẵn hoặc "mine". */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var T = A.text, lib = A.lib;
  var LIM = { name: 80, summary: 220, description: 20000, line: 300, lines: 30, tags: 20, tag: 40, code: 100000, src: 200, title: 80, link: 500 };
  var MINE = { id: "mine", name: "Thư viện của tôi", icon: "mine", blurb: "Kiến thức bạn tự thêm: thuật toán ngoài danh mục, mẹo, ghi chép hệ thống…", compare: [] };

  var user = [], cache = null, byKey = null;

  function clip(x, n) { return typeof x === "string" ? x.slice(0, n) : ""; }
  function lines(x) { var a = Array.isArray(x) ? x : typeof x === "string" ? x.split("\n") : []; return a.map(function (s) { return clip(String(s).trim(), LIM.line); }).filter(Boolean).slice(0, LIM.lines); }
  function tagList(x) {
    var a = Array.isArray(x) ? x : typeof x === "string" ? x.split(/[,\s]+/) : [];
    return T.uniq(a.map(function (t) { return String(t).toLowerCase().trim().replace(/^#/, "").replace(/[^a-z0-9+#.\-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, LIM.tag); }).filter(Boolean)).slice(0, LIM.tags);
  }

  /** Chuẩn hoá một mục người dùng nhập; ném Error tiếng Việt khi thiếu tên. */
  function normalizeItem(raw, now) {
    raw = raw || {};
    var name = clip(String(raw.name || "").trim(), LIM.name);
    if (!name) throw new Error("Hãy đặt tên cho mục.");
    var cat = raw.category === "mine" || lib.CAT[raw.category] ? raw.category : "mine";
    var cx = raw.complexity || {};
    var code = raw.code && raw.code.src && String(raw.code.src).trim() ? { lang: lib.LANGS[raw.code.lang] ? raw.code.lang : "cpp", title: clip(String(raw.code.title || "template").trim(), LIM.title) || "template", src: clip(String(raw.code.src), LIM.code) } : null;
    var created = +raw.created || now;
    return {
      id: /^u-[0-9a-f-]{36}$/.test(String(raw.id)) ? raw.id : "u-" + T.uid(),
      name: name, aliases: lines(raw.aliases).slice(0, 10), category: cat, sub: clip(String(raw.sub || "").trim(), 60),
      level: raw.level >= 1 && raw.level <= 5 ? Math.floor(raw.level) : 3, tags: tagList(raw.tags),
      summary: clip(String(raw.summary || "").trim(), LIM.summary), description: clip(String(raw.description || ""), LIM.description),
      conditions: lines(raw.conditions), complexity: { time: clip(String(cx.time || "").trim(), 80), space: clip(String(cx.space || "").trim(), 80), note: clip(String(cx.note || ""), LIM.line) },
      ops: [], use_case: lines(raw.use_case), not_for: lines(raw.not_for), pitfalls: lines(raw.pitfalls),
      code: code, example: raw.example && (raw.example.input || raw.example.output) ? { input: clip(String(raw.example.input || ""), 4000), output: clip(String(raw.example.output || ""), 4000), explain: clip(String(raw.example.explain || ""), 1000) } : null,
      problems: [], related: Array.isArray(raw.related) ? raw.related.filter(function (r) { return typeof r === "string"; }).slice(0, 30) : [], compare: {}, cards: Array.isArray(raw.cards) ? raw.cards.filter(function (c) { return c && c.q && c.a; }).slice(0, 30).map(function (c) { return { q: clip(String(c.q), LIM.line * 2), a: clip(String(c.a), LIM.line * 4) }; }) : [],
      source: "user", origin: clip(String(raw.origin || "").trim(), LIM.src), link: /^https?:\/\//.test(String(raw.link || "")) ? clip(String(raw.link), LIM.link) : "",
      created: created, updated: +raw.updated || now
    };
  }

  function invalidate() { cache = null; byKey = null; }
  function setUser(list) { user = list || []; invalidate(); }
  function all() { return cache || (cache = lib.all().concat(user)); }
  var idMap = null, idMapFor = null;
  function get(id) { var a = all(); if (idMapFor !== a) { idMap = new Map(); a.forEach(function (e) { idMap.set(e.id, e); }); idMapFor = a; } return idMap.get(id) || null; }
  /** Tìm mục theo tên / bí danh (không phân biệt hoa thường, bỏ dấu) — dùng cho [[liên kết]] trong ghi chú. */
  function byName(title) {
    if (!byKey) { byKey = new Map(); all().forEach(function (e) { [e.name].concat(e.aliases || []).forEach(function (n) { var k = T.titleKey(n); if (k && !byKey.has(k)) byKey.set(k, e); }); }); }
    return byKey.get(T.titleKey(title)) || null;
  }
  function categories() {
    var out = lib.CATEGORIES.slice();
    if (user.some(function (e) { return e.category === "mine"; })) out.push(MINE);
    return out;
  }
  function catName(id) { return id === "mine" ? MINE.name : (lib.CAT[id] || {}).name || id; }
  function inCategory(id) { return all().filter(function (e) { return e.category === id; }); }

  A.catalog = { MINE: MINE, LIM: LIM, normalizeItem: normalizeItem, setUser: setUser, all: all, get: get, byName: byName, categories: categories, catName: catName, inCategory: inCategory, tagList: tagList, userItems: function () { return user; } };
  if (typeof module !== "undefined" && module.exports) module.exports = A.catalog;
})(typeof globalThis !== "undefined" ? globalThis : this);
