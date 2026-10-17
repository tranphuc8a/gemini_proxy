/* url.js — trạng thái xem (tab, tìm kiếm, bộ lọc) ⇄ query string, để một góc nhìn chia sẻ/đánh dấu được và nút Back hoàn tác được.
   Khoá giữ tương thích với cổng cũ: q, tags, in, cat, sort. Thuần, kiểm bằng node. */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});

  var TABS = ["home", "all", "favorites", "hidden"];
  /** Thư mục rỗng (app đứng riêng, không thuộc thư mục nào) cần một ký hiệu để đi qua URL. */
  var NO_COLLECTION = "~";

  function list(params, key) {
    return (params.get(key) || "").split(",").filter(Boolean).slice(0, 30).map(function (x) { return x === NO_COLLECTION ? "" : x; });
  }

  function emptyView() {
    return { tab: "home", q: "", collections: [], categories: [], tags: [], tagAll: false, pwa: false, sort: null, group: null };
  }

  /** `enums` (tuỳ chọn) = {sort:[…], group:[…]} để bỏ giá trị lạ. */
  function fromQuery(search, enums) {
    var p = new URLSearchParams(search || ""), v = emptyView();
    enums = enums || {};
    if (TABS.indexOf(p.get("tab")) !== -1) v.tab = p.get("tab");
    v.q = (p.get("q") || "").slice(0, 200);
    v.collections = list(p, "in");
    v.categories = list(p, "cat");
    v.tags = list(p, "tags");
    v.tagAll = p.get("all") === "1";
    v.pwa = p.get("offline") === "1";
    if (!enums.sort || enums.sort.indexOf(p.get("sort")) !== -1) v.sort = p.get("sort");
    if (!enums.group || enums.group.indexOf(p.get("group")) !== -1) v.group = p.get("group");
    return v;
  }

  /** `defaults` = {sort, group} hiện hành: chỉ ghi vào URL khi khác mặc định. Trả "" hoặc "?…". */
  function toQuery(v, defaults) {
    var p = new URLSearchParams();
    defaults = defaults || {};
    if (v.tab && v.tab !== "home") p.set("tab", v.tab);
    if (v.q) p.set("q", v.q);
    if (v.collections.length) p.set("in", v.collections.map(function (x) { return x === "" ? NO_COLLECTION : x; }).join(","));
    if (v.categories.length) p.set("cat", v.categories.join(","));
    if (v.tags.length) p.set("tags", v.tags.join(","));
    if (v.tagAll && v.tags.length > 1) p.set("all", "1");
    if (v.pwa) p.set("offline", "1");
    if (v.sort && v.sort !== defaults.sort) p.set("sort", v.sort);
    if (v.group && v.group !== defaults.group) p.set("group", v.group);
    var s = p.toString();
    return s ? "?" + s : "";
  }

  /** Có điều kiện lọc/tìm nào đang bật không (khác "chỉ chọn tab")? Khi có, trang chủ nhường chỗ cho danh sách kết quả. */
  function isFiltering(v) {
    return !!(v.q.trim() || v.collections.length || v.categories.length || v.tags.length || v.pwa);
  }

  function filterCount(v) { return v.collections.length + v.categories.length + v.tags.length + (v.pwa ? 1 : 0); }

  P.url = { TABS: TABS, NO_COLLECTION: NO_COLLECTION, emptyView: emptyView, fromQuery: fromQuery, toQuery: toQuery, isFiltering: isFiltering, filterCount: filterCount };
  if (typeof module !== "undefined" && module.exports) module.exports = P.url;
})(typeof globalThis !== "undefined" ? globalThis : this);
