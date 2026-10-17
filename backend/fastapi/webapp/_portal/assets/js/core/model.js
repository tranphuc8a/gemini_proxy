/* model.js — dữ liệu của cổng: chuẩn hoá danh sách app, lọc, sắp xếp, nhóm, và các phần của trang chủ.
   Thuần (không DOM, không đồng hồ, không storage): kiểm bằng node (kiem.js). */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  ["text", "search"].forEach(function (m) { if (!P[m] && typeof require === "function") require("./" + m + ".js"); });
  var T = P.text, S = P.search;

  var DEFAULT_CONFIG = {
    title: "Web Apps Portal",
    sections: [],
    library: { title: "Thư viện", icon: "🗂️", order: [] },
    labels: {},
    recentLimit: 8,
    newDays: 21
  };

  function str(x, max) { return typeof x === "string" ? x.slice(0, max || 200) : ""; }

  /** portal.config.json (do người dùng sửa tay) → cấu hình đã ép kiểu; thiếu/hỏng thì dùng mặc định. */
  function normalizeConfig(raw) {
    var c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (!raw || typeof raw !== "object") return c;
    c.title = str(raw.title, 80) || c.title;
    if (Array.isArray(raw.sections)) {
      c.sections = raw.sections.filter(function (s) { return s && typeof s === "object" && str(s.id) && Array.isArray(s.collections); }).slice(0, 8).map(function (s) {
        return { id: str(s.id, 40), title: str(s.title, 80) || str(s.id, 40), icon: str(s.icon, 8), collections: s.collections.map(function (x) { return str(x); }), limit: T.clamp(Math.floor(+s.limit) || 12, 1, 60) };
      });
    }
    if (raw.library && typeof raw.library === "object") {
      c.library.title = str(raw.library.title, 80) || c.library.title;
      c.library.icon = str(raw.library.icon, 8) || c.library.icon;
      if (Array.isArray(raw.library.order)) c.library.order = raw.library.order.map(function (x) { return str(x); });
    }
    if (raw.labels && typeof raw.labels === "object") Object.keys(raw.labels).forEach(function (k) { c.labels[k] = str(raw.labels[k], 60); });
    c.recentLimit = T.clamp(Math.floor(+raw.recentLimit) || c.recentLimit, 1, 24);
    c.newDays = T.clamp(Math.floor(+raw.newDays) || c.newDays, 1, 365);
    return c;
  }

  function normalizeApp(a, config) {
    var tags = T.uniq((Array.isArray(a.tags) ? a.tags : []).map(function (t) { return str(t, 60).trim(); }).filter(Boolean)).slice(0, 40);
    var title = str(a.title, 200) || str(a.name, 200), desc = str(a.description, 4000).trim();
    var collection = str(a.collection, 100), label = config.labels[collection] || collection || "Khác";
    // Mô tả tự sinh ("X — ứng dụng trong bộ sưu tập Y.") không nói gì thêm và làm mọi truy vấn "ứng dụng" khớp 226 app.
    var generic = /ứng dụng trong bộ sưu tập/i.test(desc);
    var category = str(a.category, 80);
    return {
      path: str(a.path, 200), name: str(a.name, 200), title: title, desc: desc, tags: tags, icon: T.glyph(str(a.icon, 64)) || "📦",
      category: category, collection: collection, label: label, updated: Math.max(0, Math.floor(+a.updated) || 0), pwa: !!a.pwa, generic: generic, fresh: false,
      f: {
        title: T.fold(title), name: T.fold(a.name), desc: generic ? "" : T.fold(desc), tags: tags.map(T.fold).join(" "), tagList: tags.map(T.fold),
        category: T.fold(category), collectionName: T.fold(collection), label: T.fold(label), collection: T.fold(collection + " " + label),
        tagSlugs: tags.map(T.slug), categorySlug: T.slug(category), collectionSlug: T.slug(collection), labelSlug: T.slug(label)
      }
    };
  }

  /** Dữ liệu GET /webapp/_api/list → mảng app chuẩn hoá, sắp ổn định theo tên. */
  function normalizeApps(data, config) {
    config = config || normalizeConfig();
    var raw = [];
    if (data && typeof data === "object") {
      raw = (Array.isArray(data.apps) ? data.apps : []).slice();
      (Array.isArray(data.collections) ? data.collections : []).forEach(function (c) {
        (c && Array.isArray(c.apps) ? c.apps : []).forEach(function (a) { raw.push(a); });
      });
    }
    var seen = {};
    return raw.filter(function (a) { return a && typeof a === "object" && typeof a.path === "string" && a.path && !seen[a.path] && (seen[a.path] = 1); })
      .map(function (a) { return normalizeApp(a, config); })
      .sort(function (a, b) { return a.title.localeCompare(b.title, "vi") || a.path.localeCompare(b.path); });
  }

  /** Đánh dấu app "mới" (sửa trong `days` ngày gần đây) bằng cách đặt `fresh`. Thời điểm sửa trên máy chủ đổi hàng loạt khi clone
      hay deploy: nếu quá 30% app cùng "mới" thì dấu hiệu này không còn nói lên điều gì → không đánh dấu app nào. Trả số app được đánh dấu. */
  function markFresh(apps, now, days) {
    var cutoff = Math.floor(now / 1000) - days * 86400, n = apps.filter(function (a) { return a.updated >= cutoff; }).length;
    var on = apps.length > 0 && n / apps.length <= 0.3;
    apps.forEach(function (a) { a.fresh = on && a.updated >= cutoff; });
    return on ? n : 0;
  }

  function countBy(apps, keyOf, labelOf) {
    var m = {}, order = [];
    apps.forEach(function (a) {
      var k = keyOf(a);
      if (!m.hasOwnProperty(k)) { m[k] = { name: k, label: labelOf ? labelOf(a) : k, count: 0 }; order.push(k); }
      m[k].count++;
    });
    return order.map(function (k) { return m[k]; }).sort(function (a, b) { return b.count - a.count || a.label.localeCompare(b.label, "vi"); });
  }

  function facets(apps) {
    var tagCount = {};
    apps.forEach(function (a) { a.tags.forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; }); });
    return {
      collections: countBy(apps, function (a) { return a.collection; }, function (a) { return a.label; }),
      categories: countBy(apps.filter(function (a) { return a.category; }), function (a) { return a.category; }),
      tags: Object.keys(tagCount).map(function (t) { return { name: t, label: t, count: tagCount[t] }; }).sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, "vi"); }),
      pwa: apps.filter(function (a) { return a.pwa; }).length
    };
  }

  function set(list) { var s = {}; (list || []).forEach(function (x) { s[x] = true; }); return s; }

  /** flt: {parsed, collections[], categories[], tags[], tagAll, pwa, scope: "visible"|"favorites"|"hidden"} → [{app, score}] (chưa sắp). */
  function filterApps(apps, flt, prefs) {
    var hidden = set(prefs.hidden), fav = set(prefs.favorites), scope = flt.scope || "visible";
    var parsed = flt.parsed || S.parseQuery("");
    var cols = flt.collections || [], cats = flt.categories || [], tags = flt.tags || [];
    var out = [];
    apps.forEach(function (a) {
      var isHidden = !!hidden[a.path];
      if (scope === "hidden" ? !isHidden : isHidden) return;
      if (scope === "favorites" && !fav[a.path]) return;
      if (cols.length && cols.indexOf(a.collection) === -1) return;
      if (cats.length && cats.indexOf(a.category) === -1) return;
      if (flt.pwa && !a.pwa) return;
      if (tags.length) {
        var ok = flt.tagAll ? tags.every(function (t) { return a.tags.indexOf(t) !== -1; }) : tags.some(function (t) { return a.tags.indexOf(t) !== -1; });
        if (!ok) return;
      }
      if (!S.matchesTokens(a, parsed)) return;
      var sc = S.score(a, parsed.terms);
      if (sc > 0) out.push({ app: a, score: sc });
    });
    return out;
  }

  function usageOf(prefs, a) { return prefs.usage[a.path] || { count: 0, last: 0 }; }

  function sortEntries(entries, sort, prefs) {
    var fav = set(prefs.favorites);
    var byTitle = function (x, y) { return x.app.title.localeCompare(y.app.title, "vi") || x.app.path.localeCompare(y.app.path); };
    var u = function (e) { return usageOf(prefs, e.app); };
    var cmp;
    switch (sort) {
      case "popular": cmp = function (x, y) { return u(y).count - u(x).count || byTitle(x, y); }; break;
      case "recent": cmp = function (x, y) { return u(y).last - u(x).last || byTitle(x, y); }; break;
      case "updated": cmp = function (x, y) { return y.app.updated - x.app.updated || byTitle(x, y); }; break;
      case "name": cmp = byTitle; break;
      case "name-desc": cmp = function (x, y) { return byTitle(y, x); }; break;
      case "collection": cmp = function (x, y) { return x.app.label.localeCompare(y.app.label, "vi") || byTitle(x, y); }; break;
      case "category": cmp = function (x, y) {   // chưa có thể loại thì xuống cuối, không trộn lên đầu
        return (x.app.category || "￿").localeCompare(y.app.category || "￿", "vi") || byTitle(x, y);
      }; break;
      default: cmp = function (x, y) {            // relevance: điểm khớp; hết điểm thì app ghim, hay dùng, vừa dùng
        return y.score - x.score || (fav[y.app.path] ? 1 : 0) - (fav[x.app.path] ? 1 : 0) || u(y).count - u(x).count || u(y).last - u(x).last || byTitle(x, y);
      };
    }
    return entries.slice().sort(cmp);
  }

  /** by: "none" | "collection" | "category" → [{id, label, entries}]. */
  function groupEntries(entries, by) {
    if (by !== "collection" && by !== "category") return [{ id: "all", label: "", entries: entries }];
    var m = {}, order = [];
    entries.forEach(function (e) {
      var k = by === "collection" ? e.app.collection : e.app.category, label = by === "collection" ? e.app.label : (e.app.category || "Chưa phân loại");
      var key = by + ":" + k;
      if (!m[key]) { m[key] = { id: key, label: label, entries: [], empty: !k }; order.push(key); }
      m[key].entries.push(e);
    });
    return order.map(function (k) { return m[k]; }).sort(function (a, b) { return (a.empty ? 1 : 0) - (b.empty ? 1 : 0) || b.entries.length - a.entries.length || a.label.localeCompare(b.label, "vi"); });
  }

  /** Các phần của trang chủ. Mỗi phần: {id, kind: "shelf"|"groups", title, icon, apps|groups, total, collections?}. */
  function homeSections(apps, prefs, config, now) {
    var hidden = set(prefs.hidden), vis = apps.filter(function (a) { return !hidden[a.path]; });
    var byPath = {}; apps.forEach(function (a) { byPath[a.path] = a; });
    var uc = function (a) { return usageOf(prefs, a); };
    var out = [];

    var favs = prefs.favorites.map(function (p) { return byPath[p]; }).filter(function (a) { return a && !hidden[a.path]; });
    if (favs.length) out.push({ id: "favorites", kind: "shelf", title: "Yêu thích", icon: "⭐", apps: favs, total: favs.length, tab: "favorites" });

    var recent = vis.filter(function (a) { return uc(a).last > 0; }).sort(function (x, y) { return uc(y).last - uc(x).last; });
    if (recent.length) out.push({ id: "recent", kind: "shelf", title: "Mở gần đây", icon: "🕘", apps: recent.slice(0, config.recentLimit), total: recent.length, sort: "recent" });

    var used = {};
    config.sections.forEach(function (s) {
      var list = vis.filter(function (a) { return s.collections.indexOf(a.collection) !== -1; });
      list.forEach(function (a) { used[a.path] = true; });
      if (!list.length) return;
      list.sort(function (x, y) { return uc(y).count - uc(x).count || y.updated - x.updated || x.title.localeCompare(y.title, "vi"); });
      out.push({ id: s.id, kind: "shelf", title: s.title, icon: s.icon, apps: list.slice(0, s.limit), total: list.length, collections: s.collections });
    });

    var rest = vis.filter(function (a) { return !used[a.path]; }), groups = {}, order = [];
    rest.forEach(function (a) {
      if (!groups[a.collection]) { groups[a.collection] = { id: "lib:" + a.collection, title: a.label, collections: [a.collection], apps: [] }; order.push(a.collection); }
      groups[a.collection].apps.push(a);
    });
    var pos = function (c) { var i = config.library.order.indexOf(c); return i === -1 ? 1e6 : i; };
    var libGroups = order.map(function (c) { return groups[c]; }).sort(function (a, b) {
      return pos(a.collections[0]) - pos(b.collections[0]) || b.apps.length - a.apps.length || a.title.localeCompare(b.title, "vi");
    });
    if (libGroups.length) out.push({ id: "library", kind: "groups", title: config.library.title, icon: config.library.icon, groups: libGroups, total: rest.length });
    return out;
  }

  /** Một app ngẫu nhiên trong số đang hiển thị (không ẩn); `rand` là hàm trả [0,1) để kiểm được. */
  function pickRandom(apps, prefs, rand) {
    var hidden = set(prefs.hidden), pool = apps.filter(function (a) { return !hidden[a.path]; });
    return pool.length ? pool[Math.min(pool.length - 1, Math.floor((rand || Math.random)() * pool.length))] : null;
  }

  P.model = {
    DEFAULT_CONFIG: DEFAULT_CONFIG, normalizeConfig: normalizeConfig, normalizeApps: normalizeApps, markFresh: markFresh, facets: facets, filterApps: filterApps,
    sortEntries: sortEntries, groupEntries: groupEntries, homeSections: homeSections, pickRandom: pickRandom
  };
  if (typeof module !== "undefined" && module.exports) module.exports = P.model;
})(typeof globalThis !== "undefined" ? globalThis : this);
