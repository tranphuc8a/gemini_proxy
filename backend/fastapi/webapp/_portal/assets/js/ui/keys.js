/* ui/keys.js — phím tắt toàn cổng. Danh sách và mô tả nằm ở Portal.dialogs.KEYS (bảng "Phím tắt").
   Quy tắc: phím chữ chỉ có tác dụng khi KHÔNG đang gõ trong ô nhập và không có hộp thoại/bảng lệnh mở;
   Ctrl/⌘+K luôn dùng được. Không phím nào xoá bộ lọc ngầm (Esc chỉ đóng hộp thoại hoặc xoá ô tìm). */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var D = P.dom, doc = root.document;
  var pendingG = 0;

  /** Mũi tên: nhảy sang thẻ kế bên theo ĐÚNG hình học trên màn hình (lưới nhiều cột hay danh sách một cột đều được). */
  function move(card, key) {
    var cards = D.$$("#content .card:not(.skel)"), i = cards.indexOf(card), target = null;
    if (key === "ArrowRight") target = cards[i + 1];
    else if (key === "ArrowLeft") target = cards[i - 1];
    else {
      var r = card.getBoundingClientRect(), cx = r.left + r.width / 2, mid = r.top + r.height / 2, best = Infinity;
      cards.forEach(function (c) {
        if (c === card) return;
        var b = c.getBoundingClientRect();
        if (key === "ArrowDown" ? b.top <= mid : b.bottom >= mid) return;
        var cost = Math.abs(b.top - r.top) * 1000 + Math.abs(b.left + b.width / 2 - cx);       // hàng gần nhất trước, rồi cột gần nhất
        if (cost < best) { best = cost; target = c; }
      });
    }
    var link = target && D.$(".card-link", target);
    if (link) { link.focus(); target.scrollIntoView({ block: "nearest" }); }
  }

  function init(api) {
    doc.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (P.palette.isOpen()) P.palette.close(); else P.palette.open();
        return;
      }
      if (P.palette.isOpen() || doc.querySelector("dialog[open]")) return;
      var t = e.target;
      if (D.isTyping(t)) {
        if (e.key === "Escape" && t.id === "q") { e.preventDefault(); if (t.value) api.setQuery("", true); else t.blur(); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var key = e.key;

      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        var tab = { h: "home", a: "all", f: "favorites" }[key];
        if (tab) { e.preventDefault(); api.goTab(tab); return; }
      }
      if (key === "g") { pendingG = Date.now(); return; }

      var card = t && t.closest && t.closest(".card");
      if (key === "/") { e.preventDefault(); api.focusSearch(); }
      else if (key === "?") { e.preventDefault(); P.dialogs.help(); }
      else if (key === "r") { e.preventDefault(); api.randomApp(); }
      else if (key === "t") api.cycleTheme();
      else if (key === "v") api.toggleView();
      else if (/^[1-9]$/.test(key)) api.openFavorite(Number(key) - 1);
      else if (card && /^Arrow/.test(key)) { e.preventDefault(); move(card, key); }
      else if (card && key === "f") api.cardAction(card, "fav");
      else if (card && key === "i") api.cardAction(card, "info");
      else if (card && key === "h") api.cardAction(card, "hide");
    });
  }

  P.keys = { init: init };
})(typeof globalThis !== "undefined" ? globalThis : this);
