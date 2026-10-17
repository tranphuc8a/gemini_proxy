/* ui/facets.js — các mục lọc (thư mục, thể loại, tag, offline). Một hàm vẽ dùng cho cả thanh bên (máy tính) lẫn tờ trượt (điện thoại).
   Mọi thay đổi đi qua ctx.onChange(patch); mảng chọn được tính tăng dần từ view hiện tại (vì danh sách tag có thể đang bị lọc). */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var T = P.text, D = P.dom, h = D.h, icon = D.icon;
  var TAG_TOP = 40, TAG_MAX = 80;

  function row(kind, item, checked) {
    var input = h("input", { type: "checkbox", dataset: { kind: kind, value: item.name } });
    input.checked = checked;
    return h("label", { class: "frow" }, input, h("span", { class: "fname", text: item.label, title: item.label }), h("span", { class: "fcount", text: String(item.count) }));
  }

  function tagChip(item, checked) {
    var input = h("input", { type: "checkbox", dataset: { kind: "tag", value: item.name } });
    input.checked = checked;
    var el = h("label", { class: "chip" + (checked ? " on" : ""), title: item.name + " (" + item.count + ")" }, input, h("span", { text: "#" + item.label }), h("span", { class: "faint", text: String(item.count) }));
    return el;
  }

  /** Dựng lại cả mục lọc mỗi lần đổi sẽ làm mất focus bàn phím và nhảy vị trí cuộn: ghi lại rồi khôi phục. */
  function snapshot(container) {
    var a = root.document.activeElement, focus = null;
    if (a && container.contains(a)) {
      if (a.matches(".mini-search")) focus = { search: true, at: a.selectionStart };
      else if (a.dataset && a.dataset.kind) focus = { kind: a.dataset.kind, value: a.dataset.value };
      else if (a.dataset && a.dataset.tagall) focus = { tagall: a.dataset.tagall };
    }
    return { top: container.scrollTop, lists: D.$$(".facet-list, .tagcloud", container).map(function (e) { return e.scrollTop; }), focus: focus };
  }
  function restore(container, snap) {
    container.scrollTop = snap.top;
    D.$$(".facet-list, .tagcloud", container).forEach(function (e, i) { if (snap.lists[i] != null) e.scrollTop = snap.lists[i]; });
    var f = snap.focus, target = null;
    if (!f) return;
    if (f.search) target = D.$(".mini-search", container);
    else if (f.tagall) target = D.$('[data-tagall="' + f.tagall + '"]', container);
    else D.$$("input[data-kind]", container).some(function (i) { if (i.dataset.kind === f.kind && i.dataset.value === f.value) { target = i; return true; } return false; });
    if (target) { target.focus({ preventScroll: true }); if (f.search && f.at != null && target.setSelectionRange) { try { target.setSelectionRange(f.at, f.at); } catch (e) { /* type=search không hỗ trợ ở vài trình duyệt */ } } }
  }

  /** ctx: {facets, view, onChange(patch)} */
  function render(container, ctx) {
    var snap = snapshot(container);
    var f = ctx.facets, v = ctx.view;
    var selectedCols = {}, selectedCats = {}, selectedTags = {};
    v.collections.forEach(function (x) { selectedCols[x] = true; });
    v.categories.forEach(function (x) { selectedCats[x] = true; });
    v.tags.forEach(function (x) { selectedTags[x] = true; });
    var needle = container._tagNeedle || "";

    var colBox = h("div", { class: "facet-list", role: "group", "aria-label": "Thư mục" }, f.collections.map(function (c) { return row("collection", c, !!selectedCols[c.name]); }));
    var catBox = f.categories.length ? h("div", { class: "facet-list", role: "group", "aria-label": "Thể loại" }, f.categories.map(function (c) { return row("category", c, !!selectedCats[c.name]); })) : null;

    var cloud = h("div", { class: "tagcloud", role: "group", "aria-label": "Tag" });
    function fillCloud() {
      var n = T.fold(needle), list = f.tags.filter(function (t) { return !selectedTags[t.name]; });
      var picked = f.tags.filter(function (t) { return selectedTags[t.name]; });
      list = n ? list.filter(function (t) { return T.fold(t.name).indexOf(n) !== -1; }).slice(0, TAG_MAX) : list.slice(0, TAG_TOP);
      cloud.replaceChildren.apply(cloud, picked.map(function (t) { return tagChip(t, true); }).concat(list.map(function (t) { return tagChip(t, false); })));
      note.textContent = n ? (list.length ? "" : "Không có tag nào khớp.") : "Hiện " + TAG_TOP + " tag phổ biến nhất trong " + f.tags.length + " — gõ để tìm tag khác.";
    }
    var note = h("p", { class: "facet-note" });
    var search = h("input", { type: "search", class: "mini-search", placeholder: "Tìm tag…", "aria-label": "Tìm tag", value: needle, autocomplete: "off", autocapitalize: "none" });
    search.addEventListener("input", function () { needle = container._tagNeedle = search.value; fillCloud(); });
    fillCloud();

    var tagMode = v.tags.length > 1 ? h("div", { class: "seg", role: "group", "aria-label": "Cách ghép tag", style: "margin-top:8px" },
      h("button", { type: "button", dataset: { tagall: "0" }, "aria-pressed": String(!v.tagAll), text: "Có bất kỳ tag" }),
      h("button", { type: "button", dataset: { tagall: "1" }, "aria-pressed": String(v.tagAll), text: "Có đủ mọi tag" })) : null;

    var pwa = h("input", { type: "checkbox", dataset: { kind: "pwa" } });
    pwa.checked = !!v.pwa;
    var opt = h("label", { class: "frow" }, pwa, h("span", { class: "fname", text: "Chỉ app dùng được offline" }), h("span", { class: "fcount", text: String(f.pwa) }));

    container.replaceChildren(
      h("section", { class: "facet" }, h("div", { class: "facet-title", text: "Thư mục" }), colBox),
      catBox ? h("section", { class: "facet" }, h("div", { class: "facet-title", text: "Thể loại" }), catBox) : null,
      h("section", { class: "facet" }, h("div", { class: "facet-title", text: "Tag" }), search, cloud, note, tagMode),
      h("section", { class: "facet" }, h("div", { class: "facet-title", text: "Tuỳ chọn" }), opt)
    );

    restore(container, snap);
    container.onchange = function (e) {
      var t = e.target;
      if (!t || !t.dataset || !t.dataset.kind) return;
      var kind = t.dataset.kind, val = t.dataset.value;
      if (kind === "pwa") return ctx.onChange({ pwa: t.checked });
      var key = kind === "collection" ? "collections" : kind === "category" ? "categories" : "tags";
      var cur = v[key].filter(function (x) { return x !== val; });
      if (t.checked) cur.push(val);
      var patch = {}; patch[key] = cur;
      ctx.onChange(patch);
    };
    container.onclick = function (e) {
      var b = e.target.closest && e.target.closest("[data-tagall]");
      if (b) ctx.onChange({ tagAll: b.dataset.tagall === "1" });
    };
  }

  P.facets = { render: render, snapshot: snapshot, restore: restore };
})(typeof globalThis !== "undefined" ? globalThis : this);
