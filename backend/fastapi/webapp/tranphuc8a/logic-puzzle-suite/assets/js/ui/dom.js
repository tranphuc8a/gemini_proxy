/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */
/* ui/dom.js — tiện ích giao diện dùng chung: dựng phần tử, biểu tượng, thông báo, hộp thoại (xác nhận / nhập / menu), cài đặt người dùng, tải tệp.
   Chỉ chạy trong trình duyệt. Mọi chuỗi từ dữ liệu vào innerHTML phải qua Puz.text.esc / highlight. */
(function (root) {
  "use strict";
  var W = root.Puz || (root.Puz = {});
  var T = W.text, doc = root.document, U = W.ui = W.ui || {};

  function $(sel, from) { return (from || doc).querySelector(sel); }
  function $$(sel, from) { return Array.prototype.slice.call((from || doc).querySelectorAll(sel)); }

  /** h("div", {class, dataset, on:{click}, text, html}, …con) — an toàn: text dùng textContent; html chỉ cho HTML đã thoát. */
  function h(tag, props) {
    var el = doc.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "dataset") Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k === "on") Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); });
      else el.setAttribute(k, v === true ? "" : v);
    });
    kids.forEach(function (c) {
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null && x !== false) el.append(x); });
      else if (c != null && c !== false) el.append(c);
    });
    return el;
  }

  function icon(name, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }
  function debounce(fn, ms) { var t = 0; function d() { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); } d.flush = function () { clearTimeout(t); }; return d; }
  function isTyping(el) { return !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName)); }
  function enc(s) { return encodeURIComponent(s); }

  // ----------------------------------------------------------------------------------------------- thông báo
  function toast(message, opt) {
    opt = opt || {};
    var box = $("#toasts");
    if (!box) return function () {};
    var el = h("div", { class: "toast", role: "status" }, h("span", { text: message }));
    function close() { if (el.parentNode) el.parentNode.removeChild(el); }
    if (opt.action) el.append(h("button", { type: "button", text: opt.action.label, on: { click: function () { close(); opt.action.run(); } } }));
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    box.append(el);
    var ms = opt.ms == null ? 4500 : opt.ms;
    if (ms > 0) setTimeout(close, ms);
    return close;
  }

  // ----------------------------------------------------------------------------------------------- hộp thoại
  function dialog(title, body, foot, opt) {
    opt = opt || {};
    var d = h("dialog", { class: "dlg" + (opt.wide ? " wide" : ""), "aria-labelledby": "dlg-title" });
    d.innerHTML = '<div class="dlg-head"><h2 id="dlg-title">' + T.esc(title) + '</h2><button type="button" class="icon-btn" data-close aria-label="Đóng">' + icon("x") + "</button></div>" +
      '<div class="dlg-body"></div>' + (foot ? '<div class="dlg-foot"></div>' : "");
    var bodyEl = $(".dlg-body", d), footEl = $(".dlg-foot", d), opener = doc.activeElement;
    [].concat(body || []).forEach(function (x) { bodyEl.append(typeof x === "string" ? h("p", { text: x }) : x); });
    if (footEl) [].concat(foot).forEach(function (x) { footEl.append(x); });
    function close(result) { if (d.open) d.close(); d._result = result; }
    d.addEventListener("click", function (e) { if (e.target === d || (e.target.closest && e.target.closest("[data-close]"))) close(); });
    d.addEventListener("close", function () {
      doc.body.classList.remove("modal-open");
      if (d.parentNode) d.parentNode.removeChild(d);
      if (opener && opener.focus && doc.contains(opener)) { try { opener.focus(); } catch (e) { /* bỏ qua */ } }
      if (opt.onClose) opt.onClose(d._result);
    });
    doc.body.append(d);
    doc.body.classList.add("modal-open");
    d.showModal();
    return { el: d, body: bodyEl, close: close };
  }

  /** Hỏi xác nhận → Promise<boolean>. */
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var ok = h("button", { type: "button", class: "btn " + (danger ? "btn-danger-solid" : "btn-primary"), text: okLabel || "Đồng ý" }), no = h("button", { type: "button", class: "btn", text: "Huỷ" }), dlg;
      ok.addEventListener("click", function () { dlg.close(true); });
      no.addEventListener("click", function () { dlg.close(false); });
      dlg = dialog(title, [h("p", { text: text })], [no, ok], { onClose: function (r) { resolve(r === true); } });
      (danger ? no : ok).focus();
    });
  }

  /** Hỏi một đoạn chữ → Promise<string|null>. fields: [{name, label, value, placeholder, type, required, hint}] → Promise<object|null>. */
  function formBox(title, fields, okLabel) {
    return new Promise(function (resolve) {
      var form = h("form", { class: "stack", novalidate: true }), inputs = {};
      fields.forEach(function (f) {
        var id = "ff-" + f.name, input = f.type === "textarea" ? h("textarea", { id: id, rows: 4, placeholder: f.placeholder || "", maxlength: f.max || 4000 }) : h("input", { id: id, type: f.type || "text", placeholder: f.placeholder || "", autocomplete: "off", maxlength: f.max || 300 });
        if (f.value != null) input.value = f.value;
        inputs[f.name] = input;
        form.append(h("div", { class: "field" }, h("label", { for: id, text: f.label }), input, f.hint ? h("p", { class: "hint", text: f.hint }) : null));
      });
      var err = h("p", { class: "form-err", role: "alert", hidden: true }), ok = h("button", { type: "submit", class: "btn btn-primary", text: okLabel || "Lưu" }), no = h("button", { type: "button", class: "btn", text: "Huỷ" }), dlg;
      form.append(err, h("div", { class: "btn-row" }, no, ok));
      no.addEventListener("click", function () { dlg.close(null); });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var out = {};
        for (var i = 0; i < fields.length; i++) {
          var v = inputs[fields[i].name].value.trim();
          if (fields[i].required && !v) { err.textContent = "Hãy nhập " + fields[i].label.toLowerCase() + "."; err.hidden = false; inputs[fields[i].name].focus(); return; }
          out[fields[i].name] = v;
        }
        dlg.close(out);
      });
      dlg = dialog(title, [form], null, { onClose: function (r) { resolve(r || null); } });
      inputs[fields[0].name].focus();
    });
  }

  /** Menu nổi gắn vào một nút. items: [{label, icon, run, danger, disabled, sep}] */
  function menu(anchor, items) {
    var old = $(".popmenu"); if (old) old.remove();
    var m = h("div", { class: "popmenu", role: "menu" }), close = function () { m.remove(); doc.removeEventListener("pointerdown", away, true); doc.removeEventListener("keydown", key, true); if (anchor.focus) anchor.focus(); };
    function away(e) { if (!m.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); }
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var btns = $$("button:not([disabled])", m), at = btns.indexOf(doc.activeElement);
        btns[(at + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length].focus();
      }
    }
    items.forEach(function (it) {
      if (it.sep) { m.append(h("div", { class: "sep", role: "separator" })); return; }
      var b = h("button", { type: "button", role: "menuitem", class: it.danger ? "danger" : "", disabled: it.disabled ? true : null });
      b.innerHTML = (it.icon ? icon(it.icon) : "") + "<span>" + T.esc(it.label) + "</span>";
      b.addEventListener("click", function () { close(); if (it.run) it.run(); });
      m.append(b);
    });
    doc.body.append(m);
    var r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(root.innerWidth - mw - 8, r.right - mw)) + "px";
    m.style.top = (r.bottom + mh + 12 > root.innerHeight && r.top > mh + 12 ? r.top - mh - 6 : r.bottom + 6) + "px";
    doc.addEventListener("pointerdown", away, true); doc.addEventListener("keydown", key, true);
    var first = $("button:not([disabled])", m); if (first) first.focus();
    return { close: close };
  }

  // ----------------------------------------------------------------------------------------------- cài đặt người dùng (theme, cỡ chữ…): localStorage, có thể bị chặn
  var PREF_KEY = "pz:prefs", DEFAULTS = { theme: "system", font: 16, mode: "split", wrap: true, lastBackup: 0, backupEvery: 14 };
  var prefs = Object.assign({}, DEFAULTS), listeners = [];
  function loadPrefs() {
    try {
      var raw = JSON.parse(root.localStorage.getItem(PREF_KEY) || "null");
      if (raw && typeof raw === "object") {
        if (/^(system|light|dark)$/.test(raw.theme)) prefs.theme = raw.theme;
        if (raw.font >= 13 && raw.font <= 24) prefs.font = Math.round(raw.font);
        if (/^(edit|split|preview)$/.test(raw.mode)) prefs.mode = raw.mode;
        if (typeof raw.wrap === "boolean") prefs.wrap = raw.wrap;
        if (raw.lastBackup > 0) prefs.lastBackup = +raw.lastBackup;
        if (raw.backupEvery >= 1 && raw.backupEvery <= 365) prefs.backupEvery = Math.round(raw.backupEvery);
      }
    } catch (e) { /* bị chặn hoặc hỏng: dùng mặc định */ }
    return prefs;
  }
  function setPref(k, v) { prefs[k] = v; try { root.localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* riêng tư */ } applyPrefs(); listeners.forEach(function (f) { f(k, v); }); }
  function applyPrefs() {
    var de = doc.documentElement, dark = prefs.theme === "dark" || (prefs.theme === "system" && root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
    de.dataset.theme = dark ? "dark" : "light";
    de.style.setProperty("--editor-font", prefs.font + "px");
    $$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute("content", dark ? "#0a0f16" : "#f4f6fb"); });
  }

  function download(name, blob) {
    var url = root.URL.createObjectURL(blob), a = h("a", { href: url, download: name });
    doc.body.append(a); a.click(); a.remove();
    setTimeout(function () { root.URL.revokeObjectURL(url); }, 10000);
  }
  function copyText(text) {
    if (root.navigator.clipboard && root.isSecureContext) return root.navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(text); });
    return Promise.resolve(legacy(text));
  }
  function legacy(text) {
    var ta = h("textarea", { readonly: true, style: "position:fixed;top:-100px;opacity:0", "aria-hidden": "true" });
    ta.value = text; doc.body.append(ta); ta.select();
    var ok = false; try { ok = doc.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }
  /** Chọn tệp → Promise<File[]> (không cần phần tử có sẵn trong trang). */
  function pickFiles(accept, multiple) {
    return new Promise(function (resolve) {
      var inp = h("input", { type: "file", accept: accept || "", multiple: multiple ? true : null, style: "position:fixed;left:-999px" });
      inp.addEventListener("change", function () { var f = Array.prototype.slice.call(inp.files || []); inp.remove(); resolve(f); });
      inp.addEventListener("cancel", function () { inp.remove(); resolve([]); });
      doc.body.append(inp); inp.click();
    });
  }

  Object.assign(U, {
    $: $, $$: $$, h: h, icon: icon, debounce: debounce, isTyping: isTyping, enc: enc, toast: toast, dialog: dialog, confirmBox: confirmBox, formBox: formBox, menu: menu,
    prefs: function () { return prefs; }, loadPrefs: loadPrefs, setPref: setPref, applyPrefs: applyPrefs, onPref: function (f) { listeners.push(f); },
    download: download, copyText: copyText, pickFiles: pickFiles
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
