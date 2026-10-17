/* prefs.js — dữ liệu cá nhân của người dùng: ghim, ẩn, lịch sử mở, cài đặt, các nhóm đang mở.
   Toàn hàm thuần, bất biến (trả bản mới), không đụng storage — ui/store.js lo việc đọc/ghi.
   Mọi thứ đọc từ storage hoặc từ tệp nhập đều KHÔNG tin được: parse() ép kiểu, cắt độ dài, bỏ khoá lạ. */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});

  var ENUMS = {
    theme: ["system", "light", "dark"],
    view: ["grid", "list"],
    density: ["comfortable", "compact"],
    sort: ["relevance", "popular", "recent", "updated", "name", "name-desc", "collection", "category"],
    group: ["none", "collection", "category"]
  };
  var LIMITS = { favorites: 200, hidden: 500, usage: 600, open: 200, path: 200 };

  function defaults() {
    return {
      v: 2, favorites: [], hidden: [], usage: {}, open: {},
      settings: { theme: "system", view: "grid", density: "comfortable", sort: "relevance", group: "none", newTab: false }
    };
  }

  function isPath(x) { return typeof x === "string" && x.length > 0 && x.length <= LIMITS.path; }
  function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }
  function pathList(list, max) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) { if (isPath(x) && !seen[x] && out.length < max) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function cleanSettings(src, base) {
    var out = Object.assign({}, base);
    if (!isObj(src)) return out;
    Object.keys(ENUMS).forEach(function (k) { if (ENUMS[k].indexOf(src[k]) !== -1) out[k] = src[k]; });
    if (typeof src.newTab === "boolean") out.newTab = src.newTab;
    return out;
  }

  function cleanUsage(src) {
    var rows = [];
    if (isObj(src)) Object.keys(src).forEach(function (k) {
      var u = src[k];
      if (isPath(k) && isObj(u)) rows.push([k, Math.max(0, Math.floor(+u.count) || 0), Math.max(0, Math.floor(+u.last) || 0)]);
    });
    rows.sort(function (a, b) { return b[2] - a[2]; });                         // quá giới hạn thì bỏ cái cũ nhất
    var out = {};
    rows.slice(0, LIMITS.usage).forEach(function (r) { out[r[0]] = { count: r[1], last: r[2] }; });
    return out;
  }

  function cleanOpen(src) {
    var out = {}, n = 0;
    if (isObj(src)) Object.keys(src).forEach(function (k) { if (isPath(k) && src[k] === true && n++ < LIMITS.open) out[k] = true; });
    return out;
  }

  /** Từ chuỗi JSON (hoặc object) bất kỳ → prefs hợp lệ. Hỏng thì trả mặc định. */
  function parse(raw) {
    var src = raw;
    if (typeof raw === "string") { try { src = JSON.parse(raw); } catch (e) { return defaults(); } }
    var base = defaults();
    if (!isObj(src)) return base;
    return {
      v: 2,
      favorites: pathList(src.favorites, LIMITS.favorites),
      hidden: pathList(src.hidden, LIMITS.hidden),
      usage: cleanUsage(src.usage),
      open: cleanOpen(src.open),
      settings: cleanSettings(src.settings, base.settings)
    };
  }

  /** Cổng cũ (v1) cất `portal:usage` = {path:{count,last}} và `portal:settings` = {sort,view,theme,…}. */
  function fromLegacy(usage, settings) {
    var p = defaults();
    p.usage = cleanUsage(usage);
    if (isObj(settings)) {
      var s = {};
      if (settings.theme === "light" || settings.theme === "dark") s.theme = settings.theme;   // "dark" mặc định của v1 không phải lựa chọn
      if (settings.view === "list" || settings.view === "grid") s.view = settings.view;
      if (settings.sort === "popular" || settings.sort === "recent" || settings.sort === "name" || settings.sort === "name-desc" || settings.sort === "collection" || settings.sort === "category") s.sort = settings.sort;
      p.settings = cleanSettings(s, p.settings);
    }
    return p;
  }

  function withList(p, key, list) { var n = Object.assign({}, p); n[key] = list; return n; }

  function toggleFavorite(p, path) {
    if (!isPath(path)) return { prefs: p, on: false };
    var has = p.favorites.indexOf(path) !== -1;
    var list = has ? p.favorites.filter(function (x) { return x !== path; }) : p.favorites.concat(path).slice(-LIMITS.favorites);
    return { prefs: withList(p, "favorites", list), on: !has };
  }

  function toggleHidden(p, path) {
    if (!isPath(path)) return { prefs: p, on: false };
    var has = p.hidden.indexOf(path) !== -1;
    var list = has ? p.hidden.filter(function (x) { return x !== path; }) : p.hidden.concat(path).slice(-LIMITS.hidden);
    var n = withList(p, "hidden", list);
    if (!has && p.favorites.indexOf(path) !== -1) n.favorites = p.favorites.filter(function (x) { return x !== path; });   // ẩn thì bỏ ghim
    return { prefs: n, on: !has };
  }

  function recordOpen(p, path, now) {
    if (!isPath(path)) return p;
    var u = Object.assign({}, p.usage), cur = u[path] || { count: 0, last: 0 };
    u[path] = { count: cur.count + 1, last: now };
    return Object.assign({}, p, { usage: cleanUsage(u) });
  }

  function setSetting(p, key, value) {
    var ok = key === "newTab" ? typeof value === "boolean" : (ENUMS[key] && ENUMS[key].indexOf(value) !== -1);
    if (!ok) return p;
    var s = Object.assign({}, p.settings); s[key] = value;
    return Object.assign({}, p, { settings: s });
  }

  function setOpen(p, id, isOpen) {
    var o = Object.assign({}, p.open);
    if (isOpen) o[id] = true; else delete o[id];
    return Object.assign({}, p, { open: cleanOpen(o) });
  }

  function clearUsage(p) { return Object.assign({}, p, { usage: {} }); }

  /** Gói dữ liệu để người dùng tải về / chuyển sang máy khác. */
  function exportData(p, now) {
    return { app: "portal", v: 2, exportedAt: new Date(now).toISOString(), favorites: p.favorites, hidden: p.hidden, usage: p.usage, settings: p.settings, open: p.open };
  }

  /** Nhập từ chuỗi/object. mode "merge" (gộp: hợp ghim/ẩn, lấy lớn hơn của lịch sử) hoặc "replace". Ném Error tiếng Việt nếu không phải tệp của cổng. */
  function importData(p, raw, mode) {
    var src = raw;
    if (typeof raw === "string") { try { src = JSON.parse(raw); } catch (e) { throw new Error("Tệp không phải JSON hợp lệ."); } }
    if (!isObj(src) || src.app !== "portal") throw new Error("Đây không phải tệp dữ liệu của cổng (thiếu \"app\": \"portal\").");
    var inc = parse(src), out;
    if (mode === "replace") {
      out = inc;
    } else {
      var usage = Object.assign({}, p.usage);
      Object.keys(inc.usage).forEach(function (k) {
        var a = usage[k], b = inc.usage[k];
        usage[k] = a ? { count: Math.max(a.count, b.count), last: Math.max(a.last, b.last) } : b;
      });
      out = {
        v: 2,
        favorites: pathList(p.favorites.concat(inc.favorites), LIMITS.favorites),
        hidden: pathList(p.hidden.concat(inc.hidden), LIMITS.hidden),
        usage: cleanUsage(usage),
        open: Object.assign({}, p.open, inc.open),
        settings: isObj(src.settings) ? cleanSettings(src.settings, p.settings) : p.settings
      };
      out.favorites = out.favorites.filter(function (x) { return out.hidden.indexOf(x) === -1; });
    }
    return { prefs: out, summary: { favorites: inc.favorites.length, hidden: inc.hidden.length, usage: Object.keys(inc.usage).length } };
  }

  function serialize(p) { return JSON.stringify(p); }

  P.prefs = {
    ENUMS: ENUMS, LIMITS: LIMITS, defaults: defaults, parse: parse, fromLegacy: fromLegacy, toggleFavorite: toggleFavorite,
    toggleHidden: toggleHidden, recordOpen: recordOpen, setSetting: setSetting, setOpen: setOpen, clearUsage: clearUsage,
    exportData: exportData, importData: importData, serialize: serialize
  };
  if (typeof module !== "undefined" && module.exports) module.exports = P.prefs;
})(typeof globalThis !== "undefined" ? globalThis : this);
