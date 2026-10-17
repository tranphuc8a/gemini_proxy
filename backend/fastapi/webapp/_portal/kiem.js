/* kiem.js — kiểm các module lõi của cổng (assets/js/core/*) bằng node, không trình duyệt:
     node backend/fastapi/webapp/_portal/kiem.js
   Phần giao diện (assets/js/ui/*) kiểm bằng check.py (trình duyệt thật). */
"use strict";
var path = require("path");
var C = path.join(__dirname, "assets", "js", "core");
var T = require(path.join(C, "text.js"));
var S = require(path.join(C, "search.js"));
var M = require(path.join(C, "model.js"));
var PR = require(path.join(C, "prefs.js"));
var U = require(path.join(C, "url.js"));
var Q = require(path.join(C, "qr.js"));

var sai = 0, ok = 0;
function kiem(ten, dk, chiTiet) {
  if (dk) { ok++; console.log("  [ok]  " + ten); }
  else { sai++; console.log("  [SAI] " + ten + (chiTiet !== undefined ? "  — " + chiTiet : "")); }
}
function bang(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function ids(entries) { return entries.map(function (e) { return (e.app || e).path; }); }

/* ------------------------------------------------------------------ text */
console.log("text");
kiem("fold bỏ dấu, đ → d, chữ thường", T.fold("Đồ thị LƯU trữ") === "do thi luu tru");
kiem("fold chịu null/undefined", T.fold(null) === "" && T.fold(undefined) === "");
kiem("esc thoát & < > \" '", T.esc("<a href=\"x\">&'") === "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
kiem("highlight: khớp không dấu, giữ nguyên chữ gốc", T.highlight("Đồ thị Lưu", ["thi"]) === "Đồ <mark>thị</mark> Lưu", T.highlight("Đồ thị Lưu", ["thi"]));
kiem("highlight: chuỗi gốc dạng NFD (dấu rời) vẫn khớp đúng chỗ", T.highlight("Đồ thị".normalize("NFD"), ["thi"]).normalize("NFC") === "Đồ <mark>thị</mark>");
kiem("highlight: thoát HTML trong chữ gốc", T.highlight("<b>a</b>", ["a"]) === "&lt;b&gt;<mark>a</mark>&lt;/b&gt;");
kiem("highlight: hai từ chồng nhau gộp một <mark>", T.highlight("abcdef", ["abcd", "cdef"]) === "<mark>abcdef</mark>");
kiem("highlight: không có từ → chỉ thoát", T.highlight("a<b", []) === "a&lt;b" && T.highlight("x", ["zz"]) === "x");
var now = Date.UTC(2026, 9, 18, 12, 0, 0);
kiem("relTime: vừa xong / phút / giờ / hôm qua / ngày / ngày tháng",
  T.relTime(now - 30e3, now) === "vừa xong" && T.relTime(now - 5 * 60e3, now) === "5 phút trước" && T.relTime(now - 3 * 3600e3, now) === "3 giờ trước" &&
  T.relTime(now - 30 * 3600e3, now) === "hôm qua" && T.relTime(now - 5 * 86400e3, now) === "5 ngày trước" && /^\d\d\/\d\d\/\d{4}$/.test(T.relTime(now - 90 * 86400e3, now)) && T.relTime(0, now) === "");
kiem("relTime: thời điểm ở tương lai (đồng hồ lệch) không ra số âm", T.relTime(now + 1e6, now) === "vừa xong");
kiem("glyph: tối đa 2 ký tự hiển thị; emoji ghép (ZWJ, màu da) là MỘT; chuỗi dài bị cắt; rỗng/null an toàn",
  T.glyph("👨‍👩‍👧‍👦🧑🏽‍💻🚀") === "👨‍👩‍👧‍👦🧑🏽‍💻" && T.glyph("🚀") === "🚀" && T.glyph("{}") === "{}" && T.glyph("ABC") === "AB" && T.glyph("  🧪  ") === "🧪" && T.glyph("") === "" && T.glyph(null) === "" &&
  T.glyphCount("👨‍👩‍👧‍👦") === 1 && T.glyphCount("{}") === 2 && T.glyphCount("") === 0 && T.glyph("a😀b😀c", 3) === "a😀b");
kiem("clamp / uniq", T.clamp(9, 1, 5) === 5 && T.clamp(-1, 1, 5) === 1 && bang(T.uniq(["a", "b", "a"]), ["a", "b"]));

/* ---------------------------------------------------------------- search */
console.log("search");
var q = S.parseQuery("  #Game  @Khoá-học loại:Công-cụ  Đồ thị ");
kiem("parseQuery: tách #tag, @thư mục, loai:, từ khoá (đã bỏ dấu)", bang(q.tags, ["game"]) && bang(q.collections, ["khoa-hoc"]) && bang(q.categories, ["cong-cu"]) && bang(q.terms, ["do", "thi"]) && q.text === "do thi");
kiem("slug: dấu cách, gạch dưới, gạch ngang là một — 'Khoá học' ⇄ khoa-hoc", T.slug("Khoá học") === "khoa-hoc" && T.slug("  Thực_hành -- lab ") === "thuc-hanh-lab" && T.slug("") === "");
kiem("@khoa-hoc khớp thư mục có nhãn 'Khoá học'; #thuc-hanh khớp tag 'thực hành'; loai:khoa-hoc khớp thể loại 'Khoá học'", (function () {
  var app = M.normalizeApps({ apps: [{ name: "x", path: "c/x", collection: "courses", category: "Khoá học", tags: ["thực hành", "lab"] }] }, M.normalizeConfig({ labels: { courses: "Khoá học" } }))[0];
  var m = function (q) { return S.matchesTokens(app, S.parseQuery(q)); };
  return m("@khoa-hoc") && m("@courses") && m("#thuc-hanh") && m("#thuc") && m("loai:khoa-hoc") && m("cat:khoa") && !m("@games") && !m("#nope") && !m("loai:lab");
})());
kiem("parseQuery: cat: cũng được; # hoặc @ đứng một mình là từ khoá thường", bang(S.parseQuery("cat:lab").categories, ["lab"]) && bang(S.parseQuery("# @").terms, ["#", "@"]));
kiem("parseQuery: rỗng", S.isEmpty(S.parseQuery("")) && S.isEmpty(S.parseQuery("   ")) && !S.isEmpty(S.parseQuery("a")) && !S.isEmpty(S.parseQuery("#a")));

/* ----------------------------------------------------------------- model */
console.log("model");
var CFG = M.normalizeConfig({
  title: "Cổng thử",
  sections: [{ id: "mine", title: "Của tôi", icon: "🧑‍💻", collections: ["tranphuc8a"], limit: 2 }, { id: "learn", title: "Khoá học", collections: ["courses"] }, { bad: 1 }],
  library: { title: "Thư viện", order: ["games"] },
  labels: { tranphuc8a: "Của tôi", courses: "Khoá học" }
});
var NOW = Date.UTC(2026, 9, 18, 12, 0, 0), DAY = 86400;
var sec = function (d) { return Math.floor(NOW / 1000) - d * DAY; };
var API = {
  apps: [{ name: "solo", path: "solo", title: "Solo App", description: "Chạy một mình", tags: ["x"], icon: "🧪", collection: null, category: null, updated: sec(100), pwa: false }],
  collections: [
    { name: "tranphuc8a", apps: [
      { name: "chi-tieu", path: "tranphuc8a/chi-tieu", title: "Quản lý chi tiêu", description: "Sổ chi tiêu offline", tags: ["tiền", "sổ", "tiền"], icon: "💸", collection: "tranphuc8a", category: "Ứng dụng", updated: sec(2), pwa: true },
      { name: "json", path: "tranphuc8a/json", title: "JSON Editor", description: "Soạn JSON", tags: ["json", "tools"], icon: "{}", collection: "tranphuc8a", category: "Công cụ", updated: sec(90) },
      { name: "code", path: "tranphuc8a/code", title: "Code Studio", description: "IDE trên web", tags: ["ide", "code", "tools"], icon: "⌨️", collection: "tranphuc8a", category: "Công cụ", updated: sec(5), pwa: true }
    ] },
    { name: "courses", apps: [
      { name: "heuristic", path: "courses/heuristic", title: "Heuristic", description: "Khoá học thuật toán", tags: ["khoá học", "thuật toán"], icon: "📘", collection: "courses", category: "Khoá học", updated: sec(60), pwa: true }
    ] },
    { name: "games-main", apps: [
      { name: "2048", path: "games-main/2048", title: "2048 Game", description: "2048 Game — ứng dụng trong bộ sưu tập games-main.", tags: ["game", "puzzle"], icon: "🎮", collection: "games", category: "", updated: sec(300) },
      { name: "snake", path: "games-main/snake", title: "Snake", description: "Rắn săn mồi", tags: ["game"], icon: "🐍", collection: "games", updated: sec(300) }
    ] }
  ]
};
var APPS = M.normalizeApps(API, CFG);
var by = function (p) { return APPS.filter(function (a) { return a.path === p; })[0]; };
var P0 = PR.defaults();
kiem("normalizeApps: gộp app đứng riêng + trong thư mục, sắp theo tên", APPS.length === 7 && bang(APPS.map(function (a) { return a.title; }), ["2048 Game", "Code Studio", "Heuristic", "JSON Editor", "Quản lý chi tiêu", "Snake", "Solo App"]), APPS.map(function (a) { return a.title; }).join("|"));
kiem("normalizeApps: bỏ trùng path, bỏ mục hỏng, tag trùng gộp lại", M.normalizeApps({ apps: [{ path: "a", name: "a" }, { path: "a", name: "b" }, null, { name: "x" }, "s"] }, CFG).length === 1 && bang(by("tranphuc8a/chi-tieu").tags, ["tiền", "sổ"]));
kiem("normalizeApps: nhãn thư mục lấy từ cấu hình; app đứng riêng là 'Khác'; icon mặc định", by("tranphuc8a/json").label === "Của tôi" && by("solo").label === "Khác" && M.normalizeApps({ apps: [{ path: "p", name: "p" }] }, CFG)[0].icon === "📦");
kiem("normalizeApps: dữ liệu rác không ném lỗi", M.normalizeApps(null, CFG).length === 0 && M.normalizeApps({ apps: "x", collections: [{ apps: 5 }, null] }, CFG).length === 0);
kiem("mô tả tự sinh bị nhận ra và KHÔNG tham gia tìm kiếm", by("games-main/2048").generic === true && by("games-main/2048").f.desc === "" && by("solo").generic === false);
kiem("normalizeConfig: bỏ phần hỏng, ép kiểu, có mặc định", CFG.sections.length === 2 && CFG.sections[0].limit === 2 && CFG.sections[1].limit === 12 && CFG.title === "Cổng thử" && M.normalizeConfig("rác").sections.length === 0 && M.normalizeConfig(null).library.title === "Thư viện" && M.normalizeConfig({ recentLimit: 999 }).recentLimit === 24);

var fc = M.facets(APPS);
kiem("facets: đếm thư mục (giảm dần), thể loại (bỏ rỗng), tag, số app offline", fc.collections[0].name === "tranphuc8a" && fc.collections[0].count === 3 && fc.collections.some(function (c) { return c.name === "" && c.label === "Khác"; }) &&
  bang(fc.categories.map(function (c) { return c.name; }), ["Công cụ", "Khoá học", "Ứng dụng"]) && fc.tags[0].name === "game" && fc.tags[0].count === 2 && fc.pwa === 3, JSON.stringify(fc.categories));

var F = function (o) { return Object.assign({ parsed: S.parseQuery(""), collections: [], categories: [], tags: [], tagAll: false, pwa: false, scope: "visible" }, o); };
kiem("filterApps: không lọc → mọi app", M.filterApps(APPS, F({}), P0).length === 7);
kiem("filterApps: từ khoá không dấu, mọi từ phải khớp (AND)", bang(ids(M.filterApps(APPS, F({ parsed: S.parseQuery("quan ly") }), P0)), ["tranphuc8a/chi-tieu"]) && M.filterApps(APPS, F({ parsed: S.parseQuery("quan zzz") }), P0).length === 0);
kiem("filterApps: #tag, @thư mục, loai: trong câu truy vấn", bang(ids(M.filterApps(APPS, F({ parsed: S.parseQuery("#tools") }), P0)).sort(), ["tranphuc8a/code", "tranphuc8a/json"]) &&
  bang(ids(M.filterApps(APPS, F({ parsed: S.parseQuery("@khoa") }), P0)), ["courses/heuristic"]) && bang(ids(M.filterApps(APPS, F({ parsed: S.parseQuery("loai:khoa") }), P0)), ["courses/heuristic"]));
kiem("filterApps: lọc theo thư mục (kể cả '' = app đứng riêng), thể loại", bang(ids(M.filterApps(APPS, F({ collections: [""] }), P0)), ["solo"]) && M.filterApps(APPS, F({ collections: ["games", "courses"] }), P0).length === 3 && M.filterApps(APPS, F({ categories: ["Công cụ"] }), P0).length === 2);
kiem("filterApps: nhiều tag — 'bất kỳ' khác 'đủ mọi'", M.filterApps(APPS, F({ tags: ["ide", "json"] }), P0).length === 2 && M.filterApps(APPS, F({ tags: ["ide", "json"], tagAll: true }), P0).length === 0 && M.filterApps(APPS, F({ tags: ["tools", "ide"], tagAll: true }), P0).length === 1);
kiem("filterApps: chỉ app dùng được offline", M.filterApps(APPS, F({ pwa: true }), P0).length === 3);
var Pf = PR.toggleFavorite(PR.toggleFavorite(P0, "solo").prefs, "courses/heuristic").prefs, Ph = PR.toggleHidden(Pf, "games-main/snake").prefs;
kiem("filterApps: app ẩn không hiện ở tab thường, chỉ hiện ở 'hidden'", M.filterApps(APPS, F({}), Ph).length === 6 && bang(ids(M.filterApps(APPS, F({ scope: "hidden" }), Ph)), ["games-main/snake"]));
kiem("filterApps: tab yêu thích chỉ gồm app đã ghim", bang(ids(M.filterApps(APPS, F({ scope: "favorites" }), Pf)).sort(), ["courses/heuristic", "solo"]));
kiem("filterApps: tìm trong tab yêu thích vẫn lọc theo từ khoá", bang(ids(M.filterApps(APPS, F({ scope: "favorites", parsed: S.parseQuery("solo") }), Pf)), ["solo"]));

var UP = PR.recordOpen(PR.recordOpen(PR.recordOpen(P0, "courses/heuristic", 1000), "courses/heuristic", 2000), "solo", 3000);
var order = function (sort, p, o) { return ids(M.sortEntries(M.filterApps(APPS, F(o || {}), p || P0), sort, p || P0)); };
kiem("sort name / name-desc", order("name")[0] === "games-main/2048" && order("name-desc")[0] === "solo");
kiem("sort popular: nhiều lần mở trước, hoà thì theo tên", bang(order("popular", UP).slice(0, 2), ["courses/heuristic", "solo"]));
kiem("sort recent: mở gần nhất trước", bang(order("recent", UP).slice(0, 2), ["solo", "courses/heuristic"]));
kiem("sort updated: mới sửa nhất trước", order("updated")[0] === "tranphuc8a/chi-tieu" && order("updated")[1] === "tranphuc8a/code");
kiem("sort category: chưa phân loại xuống cuối, không trộn lên đầu", order("category").slice(-3).every(function (p) { return !by(p).category; }));
kiem("sort collection: theo nhãn thư mục", by(order("collection")[0]).label === "Của tôi" || by(order("collection")[0]).label === "Khoá học");
kiem("sort relevance: điểm khớp trước; hoà điểm thì app đã ghim rồi hay dùng", order("relevance", Pf).slice(0, 2).every(function (p) { return Pf.favorites.indexOf(p) !== -1; }) &&
  order("relevance", P0, { parsed: S.parseQuery("code") })[0] === "tranphuc8a/code");
var g = M.groupEntries(M.sortEntries(M.filterApps(APPS, F({}), P0), "name", P0), "category");
kiem("groupEntries theo thể loại: 'Chưa phân loại' luôn cuối, nhóm đông trước", g[g.length - 1].label === "Chưa phân loại" && g[g.length - 1].entries.length === 3 && g[0].label === "Công cụ", g.map(function (x) { return x.label + ":" + x.entries.length; }).join(","));
kiem("groupEntries theo thư mục và 'none'", M.groupEntries(M.filterApps(APPS, F({}), P0), "collection").length === 4 && M.groupEntries(M.filterApps(APPS, F({}), P0), "none").length === 1);

var hs = M.homeSections(APPS, UP, CFG, NOW), hid = function (id) { return hs.filter(function (s) { return s.id === id; })[0]; };
kiem("homeSections: thứ tự phần = yêu thích? → gần đây → phần cấu hình → thư viện", bang(hs.map(function (s) { return s.id; }), ["recent", "mine", "learn", "library"]), hs.map(function (s) { return s.id; }).join(","));
kiem("homeSections: 'gần đây' sắp theo lần mở cuối", bang(ids(hid("recent").apps), ["solo", "courses/heuristic"]));
kiem("markFresh: đánh dấu app sửa trong newDays ngày khi chúng là thiểu số", M.markFresh(APPS, NOW, 21) === 2 && by("tranphuc8a/chi-tieu").fresh && by("tranphuc8a/code").fresh && !by("solo").fresh && !by("courses/heuristic").fresh);
kiem("markFresh: nếu quá 30% app cùng 'mới' (clone/deploy đổi mtime hàng loạt) thì không đánh dấu app nào", (function () {
  var all = M.normalizeApps({ apps: [1, 2, 3, 4].map(function (i) { return { name: "a" + i, path: "a" + i, updated: sec(1) }; }) }, CFG);
  return M.markFresh(all, NOW, 21) === 0 && all.every(function (a) { return !a.fresh; }) && M.markFresh([], NOW, 21) === 0;
})());
kiem("homeSections: phần cấu hình giữ giới hạn nhưng báo tổng thật", hid("mine").apps.length === 2 && hid("mine").total === 3 && hid("learn").apps.length === 1 && bang(hid("mine").collections, ["tranphuc8a"]));
var lib = hid("library");
kiem("homeSections: thư viện = phần còn lại, nhóm theo thư mục, theo thứ tự cấu hình", lib.total === 3 && lib.groups[0].title === "games" && lib.groups[0].apps.length === 2 && lib.groups[1].title === "Khác", lib.groups.map(function (x) { return x.title; }).join(","));
kiem("homeSections: app trong phần cấu hình KHÔNG lặp lại trong thư viện", lib.groups.every(function (x) { return x.apps.every(function (a) { return a.collection !== "tranphuc8a" && a.collection !== "courses"; }); }));
var hs2 = M.homeSections(APPS, Ph, CFG, NOW);
kiem("homeSections: yêu thích đúng thứ tự ghim; app ẩn biến khỏi mọi phần", bang(ids(hs2[0].apps), ["solo", "courses/heuristic"]) && JSON.stringify(hs2).indexOf("games-main/snake") === -1);
kiem("homeSections: không dữ liệu thì không có phần nào", M.homeSections([], P0, CFG, NOW).length === 0);
kiem("pickRandom: bỏ app ẩn, xác định được, rỗng thì null", M.pickRandom(APPS, Ph, function () { return 0; }).path !== "games-main/snake" && M.pickRandom(APPS, P0, function () { return 0.9999; }) === APPS[APPS.length - 1] && M.pickRandom([], P0) === null);

/* ----------------------------------------------------------------- prefs */
console.log("prefs");
kiem("parse: rác → mặc định", bang(PR.parse("{không phải json"), PR.defaults()) && bang(PR.parse(null), PR.defaults()) && bang(PR.parse("[]"), PR.defaults()));
var dirty = PR.parse({ favorites: ["a", "a", 5, "", "b"], hidden: "x", usage: { a: { count: "7", last: -5 }, b: 3, "": { count: 1 } }, open: { x: true, y: 1 }, settings: { theme: "neon", view: "list", newTab: "yes", sort: "popular", hack: 1 }, isAdmin: true });
kiem("parse: ép kiểu, bỏ trùng, bỏ khoá lạ, enum sai về mặc định", bang(dirty.favorites, ["a", "b"]) && bang(dirty.hidden, []) && bang(dirty.usage, { a: { count: 7, last: 0 } }) && bang(dirty.open, { x: true }) &&
  dirty.settings.theme === "system" && dirty.settings.view === "list" && dirty.settings.newTab === false && dirty.settings.sort === "popular" && !("hack" in dirty.settings) && !("isAdmin" in dirty), JSON.stringify(dirty));
kiem("parse: cắt theo giới hạn (200 ghim, 600 lịch sử giữ cái mới nhất)", PR.parse({ favorites: Array.from({ length: 300 }, function (_, i) { return "f" + i; }) }).favorites.length === 200 &&
  (function () { var u = {}; for (var i = 0; i < 700; i++) u["p" + i] = { count: 1, last: i }; var r = PR.parse({ usage: u }).usage; return Object.keys(r).length === 600 && r.p699 && !r.p0; })());
kiem("serialize → parse khứ hồi giữ nguyên", bang(PR.parse(PR.serialize(UP)), UP));
var L1 = PR.fromLegacy({ "a/b": { count: 3, last: 9 } }, { theme: "light", view: "list", sort: "popular", tagMatchAll: true });
kiem("fromLegacy: chuyển lịch sử và cài đặt của cổng cũ; sort 'relevance' cũ giữ mặc định", L1.usage["a/b"].count === 3 && L1.settings.theme === "light" && L1.settings.view === "list" && L1.settings.sort === "popular" && PR.fromLegacy(null, { sort: "relevance" }).settings.sort === "relevance" && PR.fromLegacy(null, { theme: "dark" }).settings.theme === "dark");
var t1 = PR.toggleFavorite(P0, "a");
kiem("toggleFavorite: bật/tắt, bất biến, thứ tự ghim giữ nguyên", t1.on === true && bang(t1.prefs.favorites, ["a"]) && bang(P0.favorites, []) && PR.toggleFavorite(t1.prefs, "a").on === false && bang(PR.toggleFavorite(PR.toggleFavorite(P0, "a").prefs, "b").prefs.favorites, ["a", "b"]) && PR.toggleFavorite(P0, 5).prefs === P0);
var h1 = PR.toggleHidden(PR.toggleFavorite(P0, "a").prefs, "a");
kiem("toggleHidden: ẩn thì tự bỏ ghim; bỏ ẩn", h1.on === true && bang(h1.prefs.hidden, ["a"]) && bang(h1.prefs.favorites, []) && PR.toggleHidden(h1.prefs, "a").on === false);
kiem("recordOpen: cộng dồn số lần, ghi lần cuối", UP.usage["courses/heuristic"].count === 2 && UP.usage["courses/heuristic"].last === 2000 && PR.recordOpen(P0, "", 1) === P0);
kiem("setSetting: giá trị sai bị bỏ qua, đúng thì áp dụng", PR.setSetting(P0, "view", "list").settings.view === "list" && PR.setSetting(P0, "view", "cube") === P0 && PR.setSetting(P0, "newTab", "x") === P0 && PR.setSetting(P0, "newTab", true).settings.newTab === true && PR.setSetting(P0, "evil", 1) === P0);
kiem("setOpen / clearUsage", PR.setOpen(P0, "lib:x", true).open["lib:x"] === true && !PR.setOpen(PR.setOpen(P0, "lib:x", true), "lib:x", false).open["lib:x"] && bang(PR.clearUsage(UP).usage, {}));
var ex = PR.exportData(Ph, NOW);
kiem("exportData: có dấu nhận diện, phiên bản, thời điểm", ex.app === "portal" && ex.v === 2 && ex.exportedAt === "2026-10-18T12:00:00.000Z" && bang(ex.hidden, Ph.hidden));
var imp = PR.importData(UP, ex, "merge");
kiem("importData merge: hợp ghim/ẩn, lấy lớn hơn của lịch sử, không làm mất dữ liệu cũ", imp.prefs.hidden.indexOf("games-main/snake") !== -1 && imp.prefs.usage["courses/heuristic"].count === 2 && imp.prefs.favorites.every(function (f) { return imp.prefs.hidden.indexOf(f) === -1; }) && imp.summary.hidden === 1);
kiem("importData replace thay hẳn", bang(PR.importData(UP, ex, "replace").prefs.usage, ex.usage) && PR.importData(UP, ex, "replace").prefs.hidden.length === 1);
var bad = [function () { PR.importData(P0, "{hỏng"); }, function () { PR.importData(P0, { app: "khac" }); }, function () { PR.importData(P0, [1, 2]); }, function () { PR.importData(P0, null); }];
kiem("importData: tệp lạ/hỏng → lỗi tiếng Việt, không đổi gì", bad.every(function (f) { try { f(); return false; } catch (e) { return /JSON|không phải/.test(e.message); } }));
kiem("importData: dữ liệu độc trong tệp bị ép kiểu như parse()", (function () { var r = PR.importData(P0, { app: "portal", favorites: ["x", 7], settings: { theme: "<script>" }, evil: 1 }, "merge").prefs; return bang(r.favorites, ["x"]) && r.settings.theme === "system"; })());

/* ------------------------------------------------------------------- url */
console.log("url");
var v0 = U.emptyView();
v0.tab = "all"; v0.q = "đồ thị"; v0.collections = ["games", ""]; v0.categories = ["Công cụ"]; v0.tags = ["a", "b"]; v0.tagAll = true; v0.pwa = true; v0.sort = "name"; v0.group = "collection";
var qs = U.toQuery(v0, { sort: "relevance", group: "none" });
var back = U.fromQuery(qs, PR.ENUMS);
kiem("toQuery → fromQuery khứ hồi (kể cả thư mục rỗng '~', tiếng Việt có dấu)", bang(back, v0) && qs.indexOf("in=games,~") !== -1 || bang(back, v0), qs);
kiem("toQuery: chỉ ghi cái khác mặc định; trang chủ trống → chuỗi rỗng", U.toQuery(U.emptyView(), {}) === "" && U.toQuery(Object.assign(U.emptyView(), { sort: "name" }), { sort: "name" }) === "" && U.toQuery(Object.assign(U.emptyView(), { tab: "home" }), {}) === "");
kiem("fromQuery: tương thích URL cổng cũ (q, tags, in, cat, sort) và bỏ giá trị lạ", bang(U.fromQuery("?q=abc&tags=a,b&in=games&cat=Lab&sort=popular", PR.ENUMS).tags, ["a", "b"]) && U.fromQuery("?sort=xxx", PR.ENUMS).sort === null && U.fromQuery("?tab=hack", PR.ENUMS).tab === "home" && U.fromQuery("?group=zzz", PR.ENUMS).group === null);
kiem("fromQuery: cắt độ dài câu tìm và số mục lọc", U.fromQuery("?q=" + "a".repeat(500)).q.length === 200 && U.fromQuery("?tags=" + Array.from({ length: 80 }, function (_, i) { return "t" + i; }).join(",")).tags.length === 30);
kiem("all=1 chỉ ghi khi có từ 2 tag", U.toQuery(Object.assign(U.emptyView(), { tags: ["a"], tagAll: true }), {}).indexOf("all=1") === -1 && U.toQuery(Object.assign(U.emptyView(), { tags: ["a", "b"], tagAll: true }), {}).indexOf("all=1") !== -1);
kiem("isFiltering / filterCount", !U.isFiltering(U.emptyView()) && U.isFiltering(Object.assign(U.emptyView(), { q: " x " })) && !U.isFiltering(Object.assign(U.emptyView(), { q: "   " })) && U.isFiltering(Object.assign(U.emptyView(), { pwa: true })) && U.filterCount(v0) === 6);

/* -------------------------------------------------------------------- qr */
console.log("qr");
/* Bộ giải mã VIẾT RIÊNG (không dùng lại mã của qr.js, trừ việc đọc ma trận qua .get): bảng log/antilog GF(256),
   bản đồ mô-đun chức năng tự dựng, kiểm BCH của thông tin định dạng, kiểm đa thức sửa lỗi triệt tiêu, đọc lại chuỗi. */
var EXP = [], LOG = [], xv = 1, ii;
for (ii = 0; ii < 255; ii++) { EXP[ii] = xv; LOG[xv] = ii; xv <<= 1; if (xv & 0x100) xv ^= 0x11D; }
function gmul(a, b) { return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }
function polyEval(coefs, x) { var r = 0; coefs.forEach(function (c) { r = gmul(r, x) ^ c; }); return r; }
var SPEC = {   // ECC codewords/khối và số khối, v1..v10 — chép lại độc lập từ bảng của chuẩn
  L: { ec: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18], blocks: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4], data: [19, 34, 55, 80, 108, 136, 156, 194, 232, 274] },
  M: { ec: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], blocks: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5], data: [16, 28, 44, 64, 86, 108, 124, 154, 182, 216] }
};
var TOTAL_CW = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
function alignCenters(ver) {
  var tab = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  return tab[ver - 1];
}
function giaiMa(qr) {
  var n = qr.size, ver = (n - 17) / 4, x, y, i;
  var g = function (a, b) { return qr.get(a, b) ? 1 : 0; };
  // thông tin định dạng: hai bản phải giống nhau và là từ mã BCH hợp lệ
  var f1 = 0, f2 = 0;
  var p1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  for (i = 0; i < 15; i++) f1 |= g(p1[i][0], p1[i][1]) << i;
  for (i = 0; i < 8; i++) f2 |= g(n - 1 - i, 8) << i;
  for (i = 8; i < 15; i++) f2 |= g(8, n - 15 + i) << i;
  if (f1 !== f2) throw new Error("hai bản thông tin định dạng khác nhau");
  var fmt = f1 ^ 0x5412, rem = fmt;
  for (i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  if (rem !== 0) throw new Error("thông tin định dạng không phải từ mã BCH hợp lệ");
  var eclBits = (fmt >>> 13) & 3, mask = (fmt >>> 10) & 7, ecl = eclBits === 1 ? "L" : eclBits === 0 ? "M" : "?";
  if (g(8, n - 8) !== 1) throw new Error("thiếu mô-đun tối cố định");
  // bản đồ mô-đun chức năng, dựng độc lập
  var fn = [];
  for (y = 0; y < n; y++) { fn.push([]); for (x = 0; x < n; x++) fn[y].push(false); }
  var mark = function (x0, y0, x1, y1) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) if (xx >= 0 && yy >= 0 && xx < n && yy < n) fn[yy][xx] = true; };
  mark(0, 0, 8, 8); mark(n - 8, 0, n - 1, 8); mark(0, n - 8, 8, n - 1);
  for (i = 0; i < n; i++) { fn[6][i] = true; fn[i][6] = true; }
  var ac = ver > 1 ? alignCenters(ver) : [];
  ac.forEach(function (cy, a) { ac.forEach(function (cx, b) {
    if ((a === 0 && b === 0) || (a === 0 && b === ac.length - 1) || (a === ac.length - 1 && b === 0)) return;
    mark(cx - 2, cy - 2, cx + 2, cy + 2);
  }); });
  if (ver >= 7) { mark(n - 11, 0, n - 9, 5); mark(0, n - 11, 5, n - 9); }
  // đọc codeword theo zigzag, bỏ mặt nạ
  var bits = [], up = true;
  for (var col = n - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    for (var k = 0; k < n; k++) {
      var yy = up ? n - 1 - k : k;
      for (var d = 0; d < 2; d++) {
        var xx = col - d;
        if (fn[yy][xx]) continue;
        var invert = [(xx + yy) % 2 === 0, yy % 2 === 0, xx % 3 === 0, (xx + yy) % 3 === 0, (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 === 0, xx * yy % 2 + xx * yy % 3 === 0, (xx * yy % 2 + xx * yy % 3) % 2 === 0, ((xx + yy) % 2 + xx * yy % 3) % 2 === 0][mask];
        bits.push(g(xx, yy) ^ (invert ? 1 : 0));
      }
    }
    up = !up;
  }
  var total = TOTAL_CW[ver - 1];
  if (Math.floor(bits.length / 8) !== total) throw new Error("số codeword đọc được " + Math.floor(bits.length / 8) + " ≠ " + total);
  var cw = [];
  for (i = 0; i < total; i++) { var byte = 0; for (var b2 = 0; b2 < 8; b2++) byte = byte << 1 | bits[i * 8 + b2]; cw.push(byte); }
  // gỡ xen kẽ
  var sp = SPEC[ecl], nb = sp.blocks[ver - 1], ecLen = sp.ec[ver - 1];
  var shortCount = nb - total % nb, shortLen = Math.floor(total / nb), blocks = [], pos = 0;
  for (i = 0; i < nb; i++) blocks.push([]);
  var dataLens = blocks.map(function (_, bi) { return shortLen - ecLen + (bi < shortCount ? 0 : 1); });
  var maxData = Math.max.apply(null, dataLens);
  for (i = 0; i < maxData; i++) for (var bi = 0; bi < nb; bi++) if (i < dataLens[bi]) blocks[bi].push(cw[pos++]);
  for (i = 0; i < ecLen; i++) for (var bj = 0; bj < nb; bj++) blocks[bj].push(cw[pos++]);
  // đa thức sửa lỗi: hội chứng S_i = block(α^i) phải bằng 0 với mọi i < ecLen
  blocks.forEach(function (blk, bi) {
    for (var s = 0; s < ecLen; s++) if (polyEval(blk, EXP[s]) !== 0) throw new Error("khối " + bi + ": hội chứng " + s + " khác 0 (mã sửa lỗi sai)");
  });
  var data = [];
  blocks.forEach(function (blk, bi) { data = data.concat(blk.slice(0, dataLens[bi])); });
  if (data.length !== sp.data[ver - 1]) throw new Error("số codeword dữ liệu " + data.length + " ≠ " + sp.data[ver - 1]);
  // đọc luồng bit: 0100 + độ dài + byte
  var stream = data.map(function (b) { return ("00000000" + b.toString(2)).slice(-8); }).join("");
  if (stream.slice(0, 4) !== "0100") throw new Error("không phải chế độ byte");
  var cc = ver < 10 ? 8 : 16, len = parseInt(stream.slice(4, 4 + cc), 2), out = [];
  for (i = 0; i < len; i++) out.push(parseInt(stream.slice(4 + cc + i * 8, 12 + cc + i * 8), 2));
  var text = decodeURIComponent(out.map(function (b) { return "%" + ("0" + b.toString(16)).slice(-2); }).join(""));
  return { text: text, ver: ver, ecl: ecl, mask: mask };
}

kiem("bảng của qr.js khớp bảng chuẩn chép lại độc lập (ECC/khối, tổng codeword, sức chứa dữ liệu)", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(function (v) {
  return ["L", "M"].every(function (e) {
    return Q._t.ECC_PER_BLOCK[e][v] === SPEC[e].ec[v - 1] && Q._t.NUM_BLOCKS[e][v] === SPEC[e].blocks[v - 1] && Q._t.numDataCodewords(v, e) === SPEC[e].data[v - 1] && Math.floor(Q._t.numRawDataModules(v) / 8) === TOTAL_CW[v - 1];
  });
}));
kiem("vị trí mẫu căn chỉnh khớp bảng chuẩn", [2, 3, 4, 5, 6, 7, 8, 9, 10].every(function (v) { return bang(Q._t.alignmentPositions(v), alignCenters(v)); }) && Q._t.alignmentPositions(1).length === 0);
function khuHoi(s) { var r = giaiMa(Q.encode(s)); return r.text === s ? r : null; }
var tryOne = function (s) { try { return khuHoi(s); } catch (e) { return { loi: e.message }; } };
var mau = ["a", "http://localhost:6789/webapp/_portal/portal.html", "https://example.com/tranphuc8a/quan-ly-chi-tieu/?q=đồ thị&tag=1", "Đồ thị — 你好 🚀"];
mau.forEach(function (s) { var r = tryOne(s); kiem("QR khứ hồi: " + JSON.stringify(s).slice(0, 52) + " → v" + (r && r.ver) + "-" + (r && r.ecl) + " mask " + (r && r.mask), r && !r.loi, r && r.loi); });
var lens = [14, 15, 26, 27, 42, 43, 62, 63, 84, 85, 106, 107, 122, 123, 152, 153, 180, 181, 213];
var capOk = lens.every(function (L) { var r = tryOne("x".repeat(L)); return r && !r.loi; });
kiem("QR khứ hồi ở mọi ranh giới sức chứa của mức M (14…213 byte, v1…v10)", capOk, lens.map(function (L) { var r = tryOne("x".repeat(L)); return L + (r && !r.loi ? "ok" : ":" + (r && r.loi)); }).join(" "));
kiem("QR: chọn đúng phiên bản nhỏ nhất (14 byte → v1-M, 15 → v2-M, 213 → v10-M; vượt M thì mức L nhỏ nhất vừa đủ: 214 → v9-L, 271 → v10-L)",
  [[14, 1, "M"], [15, 2, "M"], [213, 10, "M"], [214, 9, "L"], [230, 9, "L"], [231, 10, "L"], [271, 10, "L"]].every(function (c) { var q2 = Q.encode("y".repeat(c[0])); return q2.version === c[1] && q2.ecl === c[2]; }));
kiem("QR: 272 byte → lỗi tiếng Việt, không treo", (function () { try { Q.encode("z".repeat(272)); return false; } catch (e) { return /quá dài/.test(e.message); } })());
var rnd = (function () { var s = 12345; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
var fuzzOk = 0, fuzzBad = "";
for (var fz = 0; fz < 60; fz++) {
  var L2 = 1 + Math.floor(rnd() * 270), s2 = "";
  for (var c2 = 0; c2 < L2; c2++) s2 += String.fromCharCode(32 + Math.floor(rnd() * 95));
  var r2 = tryOne(s2);
  if (r2 && !r2.loi) fuzzOk++; else fuzzBad = "độ dài " + L2 + ": " + (r2 && r2.loi);
}
kiem("QR: 60 chuỗi ngẫu nhiên (1–270 ký tự) đều giải lại đúng, mã sửa lỗi triệt tiêu", fuzzOk === 60, fuzzBad);
var qr1 = Q.encode("http://x/");
kiem("QR: ba mẫu dò (finder) có đủ, mô-đun tối cố định", [[0, 0], [qr1.size - 7, 0], [0, qr1.size - 7]].every(function (p) { return qr1.get(p[0], p[1]) && qr1.get(p[0] + 6, p[1] + 6) && !qr1.get(p[0] + 1, p[1] + 1) && qr1.get(p[0] + 3, p[1] + 3); }) && qr1.get(8, qr1.size - 8));
var svg = Q.toSvg(qr1, 4);
kiem("QR toSvg: viewBox đúng kích thước + viền, một path, không có thẻ lạ", svg.indexOf('viewBox="0 0 ' + (qr1.size + 8) + " " + (qr1.size + 8) + '"') !== -1 && (svg.match(/<path/g) || []).length === 1 && !/<script|onload/i.test(svg));
kiem("QR: cùng đầu vào → cùng ma trận (xác định)", bang(Q.encode("abc").modules, Q.encode("abc").modules));

console.log("\n" + "=".repeat(58));
if (sai) { console.log("SAI " + sai + " / " + (ok + sai) + " phép kiểm"); process.exit(1); }
console.log("Đạt — " + ok + " phép kiểm.");
