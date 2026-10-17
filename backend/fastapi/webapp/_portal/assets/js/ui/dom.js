/* ui/dom.js — tiện ích DOM dùng chung: dựng phần tử, biểu tượng SVG, thông báo nhanh, sao chép, tải tệp.
   Chỉ chạy trong trình duyệt. Mọi chuỗi từ dữ liệu vào innerHTML phải qua Portal.text.esc / highlight. */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var doc = root.document;

  function $(sel, from) { return (from || doc).querySelector(sel); }
  function $$(sel, from) { return Array.prototype.slice.call((from || doc).querySelectorAll(sel)); }

  /** h("div", {class:"a", dataset:{x:1}, on:{click:fn}, text:"…"}, child, child…) — tạo phần tử, an toàn (textContent). */
  function h(tag, props) {
    var el = doc.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;                                 // chỉ cho HTML đã thoát/tin cậy
      else if (k === "dataset") Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k === "on") Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); });
      else el.setAttribute(k, v === true ? "" : v);
    });
    kids.forEach(function (c) {
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null) el.append(x); });
      else if (c != null && c !== false) el.append(c);
    });
    return el;
  }

  /** Chuỗi SVG tham chiếu một biểu tượng trong bộ `<symbol>` ở portal.html. */
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
  }

  var toastTimer = 0;
  /** toast("Đã ghim", {action:{label:"Hoàn tác", run:fn}, ms:4500}) */
  function toast(message, opt) {
    opt = opt || {};
    var box = $("#toasts");
    if (!box) return function () {};
    var el = h("div", { class: "toast", role: "status" }, h("span", { text: message }));
    function close() { if (el.parentNode) el.parentNode.removeChild(el); }
    if (opt.action) el.append(h("button", { type: "button", text: opt.action.label, on: { click: function () { close(); opt.action.run(); } } }));
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    box.append(el);
    var ms = opt.ms == null ? 4000 : opt.ms;
    if (ms > 0) setTimeout(close, ms);
    return close;
  }

  function copyText(text) {
    if (root.navigator.clipboard && root.isSecureContext) return root.navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = h("textarea", { readonly: true, style: "position:fixed;top:-100px;opacity:0", "aria-hidden": "true" });
    ta.value = text; doc.body.append(ta); ta.select();
    var ok = false; try { ok = doc.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function download(name, text, type) {
    var url = root.URL.createObjectURL(new root.Blob([text], { type: type || "application/json" }));
    var a = h("a", { href: url, download: name });
    doc.body.append(a); a.click(); a.remove();
    setTimeout(function () { root.URL.revokeObjectURL(url); }, 4000);
  }

  function debounce(fn, ms) {
    var t = 0;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }

  /** Địa chỉ tuyệt đối của một app (cổng nằm ở /webapp/_portal/portal.html, app ở /webapp/<path>/ — suy ra từ chính URL trang
      nên vẫn đúng khi đặt sau một tiền tố proxy). */
  function appUrl(app) {
    return new root.URL("../" + app.path.split("/").map(encodeURIComponent).join("/") + "/", root.location.href).href;
  }

  function isTyping(el) {
    return !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
  }

  P.dom = { $: $, $$: $$, h: h, icon: icon, toast: toast, copyText: copyText, download: download, debounce: debounce, appUrl: appUrl, isTyping: isTyping };
})(typeof globalThis !== "undefined" ? globalThis : this);
