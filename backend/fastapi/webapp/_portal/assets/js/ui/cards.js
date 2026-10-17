/* ui/cards.js — thẻ app. Kích thước thẻ do CSS cố định (portal.css), ở đây chỉ chọn NỘI DUNG:
   hai tag đầu + "+N", nhãn thư mục · thể loại, huy hiệu Offline. Không chèn gì có thể làm thẻ cao/rộng thêm. */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var T = P.text, D = P.dom, h = D.h, icon = D.icon;
  var INLINE_TAGS = 2;

  function favLabel(on, title) { return (on ? "Bỏ ghim " : "Ghim ") + title; }

  /** o: {terms: [từ đã fold để tô sáng], fav, hidden, newTab} */
  function create(app, o) {
    o = o || {};
    var terms = o.terms || [];
    var shown = app.tags.slice(0, INLINE_TAGS), extra = app.tags.length - shown.length;
    var sub = [app.label, app.category].filter(Boolean).join(" · ");
    var el = h("article", { class: "card", dataset: { path: app.path, hidden: o.hidden ? "1" : "0" } });
    el.innerHTML =
      '<div class="card-icon" data-n="' + T.glyphCount(app.icon) + '" aria-hidden="true">' + T.esc(app.icon) + "</div>" +
      '<div class="card-head"><h3 class="card-title"><a class="card-link" href="' + T.esc(D.appUrl(app)) + '"' + (o.newTab ? ' target="_blank" rel="noopener"' : "") +
      ' title="' + T.esc(app.title) + '">' + T.highlight(app.title, terms) + "</a></h3>" +
      '<p class="card-sub">' + T.esc(sub) + "</p></div>" +
      '<p class="card-desc">' + T.highlight(app.desc, terms) + "</p>" +
      '<div class="card-foot">' +
      (app.fresh ? '<span class="pill-new" title="Vừa được cập nhật">Mới</span>' : "") +
      (app.pwa ? '<span class="pill-pwa" title="Cài được và mở được khi không có mạng">Offline</span>' : "") +
      shown.map(function (t) { return '<span class="tag" title="' + T.esc(t) + '">' + T.highlight(t, terms) + "</span>"; }).join("") +
      (extra > 0 ? '<span class="tag-more" title="' + T.esc(app.tags.slice(INLINE_TAGS).join(", ")) + '">+' + extra + "</span>" : "") +
      "</div>" +
      '<div class="card-actions">' +
      '<button type="button" class="act js-fav" aria-pressed="' + !!o.fav + '" aria-label="' + T.esc(favLabel(!!o.fav, app.title)) + '" title="' + (o.fav ? "Bỏ ghim" : "Ghim") + '">' + icon("star") + "</button>" +
      '<button type="button" class="act js-more" aria-label="Chi tiết ' + T.esc(app.title) + '" title="Chi tiết">' + icon("more") + "</button>" +
      "</div>";
    return el;
  }

  /** Đổi trạng thái ghim ngay trên thẻ, không dựng lại cả danh sách. */
  function setFav(el, on, title) {
    var b = el.querySelector(".js-fav");
    if (!b) return;
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", favLabel(on, title));
    b.title = on ? "Bỏ ghim" : "Ghim";
  }

  function skeleton(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(h("div", { class: "card skel", "aria-hidden": "true" }));
    return out;
  }

  P.cards = { create: create, setFav: setFav, skeleton: skeleton, INLINE_TAGS: INLINE_TAGS };
})(typeof globalThis !== "undefined" ? globalThis : this);
