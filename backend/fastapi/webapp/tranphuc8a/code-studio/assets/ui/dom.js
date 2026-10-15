/* dom.js — tiện ích DOM nhỏ cho giao diện Code Studio: dựng phần tử, thông báo, hộp thoại (thay prompt/confirm),
   menu ngữ cảnh, tải tệp xuống / chọn tệp lên. Mọi chuỗi từ người dùng/dữ liệu vào DOM đều qua textContent hoặc esc(). */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});
  var D = root.document;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  /** h("button", {class: "x", onclick: fn, text: "…"}, [con…]) */
  function h(tag, attrs, kids) {
    var el = D.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === "string" ? D.createTextNode(c) : c); });
    return el;
  }
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }

  var toastBox = null;
  function toast(msg, kind, ms) {
    if (!toastBox) { toastBox = h("div", { class: "cs-toasts", role: "status", "aria-live": "polite" }); D.body.appendChild(toastBox); }
    var t = h("div", { class: "cs-toast " + (kind || ""), text: msg });
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 300); }, ms || (kind === "bad" ? 6000 : 3200));
  }

  /** Hộp thoại chung. o = {title, body: Node|string, actions: [{label, value, primary, danger}], wide, onOpen(el)} → Promise<value|null> */
  function dialog(o) {
    return new Promise(function (resolve) {
      var dlg = h("dialog", { class: "cs-dlg" + (o.wide ? " wide" : ""), "aria-labelledby": "cs-dlg-t" });
      var bodyEl = typeof o.body === "string" ? h("div", { class: "cs-dlg-b", html: o.body }) : h("div", { class: "cs-dlg-b" }, o.body);
      var foot = h("div", { class: "cs-dlg-f" });
      (o.actions || [{ label: "Đóng", value: null }]).forEach(function (a) {
        foot.appendChild(h("button", { type: "button", class: "btn" + (a.primary ? " pri" : "") + (a.danger ? " danger" : ""), text: a.label, onclick: function () { done(a.value === undefined ? a.label : a.value); } }));
      });
      dlg.appendChild(h("div", { class: "cs-dlg-h" }, [h("h2", { id: "cs-dlg-t", text: o.title || "" }), h("button", { type: "button", class: "ic", "aria-label": "Đóng", text: "✕", onclick: function () { done(null); } })]));
      dlg.appendChild(bodyEl);
      dlg.appendChild(foot);
      D.body.appendChild(dlg);
      var finished = false;
      function done(v) { if (finished) return; finished = true; try { dlg.close(); } catch (e) { /* đã đóng */ } dlg.remove(); resolve(v); }
      dlg.addEventListener("cancel", function (e) { e.preventDefault(); done(null); });
      dlg.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON" && e.target.tagName !== "SELECT") {
          var pri = (o.actions || []).filter(function (a) { return a.primary; })[0];
          if (pri) { e.preventDefault(); done(pri.value === undefined ? pri.label : pri.value); }
        }
      });
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
      var first = dlg.querySelector("input,select,textarea") || foot.querySelector(".pri") || foot.querySelector("button");
      if (first) first.focus();
      if (o.onOpen) o.onOpen(dlg, done);
    });
  }
  function confirmBox(title, msg, okLabel, danger) {
    return dialog({ title: title, body: h("p", { text: msg }), actions: [{ label: "Huỷ", value: false }, { label: okLabel || "Đồng ý", value: true, primary: true, danger: !!danger }] }).then(function (v) { return v === true; });
  }
  /** Hỏi một chuỗi. validate(v) → thông báo lỗi hoặc "" */
  function promptBox(title, label, value, validate, okLabel) {
    var inp = h("input", { type: "text", class: "inp", value: value || "", spellcheck: "false", "aria-label": label });
    var err = h("p", { class: "cs-err", role: "alert" });
    var body = h("div", {}, [h("label", { class: "fld" }, [h("span", { text: label }), inp]), err]);
    return new Promise(function (resolve) {
      dialog({
        title: title, body: body, actions: [{ label: "Huỷ", value: null }, { label: okLabel || "OK", value: "__ok", primary: true }],
        onOpen: function (dlg) { inp.select(); inp.addEventListener("input", function () { err.textContent = ""; }); }
      }).then(function (v) {
        if (v !== "__ok") { resolve(null); return; }
        var val = inp.value.trim(), msg = validate ? validate(val) : "";
        if (msg) { toast(msg, "bad"); resolve(promptBox(title, label, val, validate, okLabel)); return; }
        resolve(val);
      });
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
    });
  }

  /** Menu ngữ cảnh: items [{label, kbd, onclick, danger, disabled}] | "-" ; tại điểm {x,y} hoặc dưới phần tử */
  var openMenu = null;
  function menu(at, items) {
    closeMenu();
    var m = h("div", { class: "cs-menu", role: "menu" });
    items.forEach(function (it) {
      if (it === "-") { m.appendChild(h("div", { class: "sep", role: "separator" })); return; }
      m.appendChild(h("button", { type: "button", role: "menuitem", class: it.danger ? "danger" : "", disabled: it.disabled || null, onclick: function () { closeMenu(); it.onclick(); } },
        [h("span", { text: it.label }), it.kbd ? h("kbd", { text: it.kbd }) : null]));
    });
    D.body.appendChild(m);
    var x, y;
    if (at && at.getBoundingClientRect) { var r = at.getBoundingClientRect(); x = r.left; y = r.bottom + 2; } else { x = at.x; y = at.y; }
    var w = m.offsetWidth, hh = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, root.innerWidth - w - 4)) + "px";
    m.style.top = Math.max(4, y + hh > root.innerHeight - 4 ? y - hh - 4 : y) + "px";
    openMenu = m;
    var b = m.querySelector("button:not([disabled])"); if (b) b.focus();
    m.addEventListener("keydown", function (e) {
      var bs = $$("button:not([disabled])", m), i = bs.indexOf(D.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); closeMenu(); }
    });
    setTimeout(function () { D.addEventListener("mousedown", outside, true); }, 0);
  }
  function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; D.removeEventListener("mousedown", outside, true); } }

  function download(name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob), a = h("a", { href: url, download: name });
    D.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function pickFiles(accept, multiple, dir) {
    return new Promise(function (resolve) {
      var inp = h("input", { type: "file", accept: accept || null, multiple: multiple ? true : null, style: { display: "none" } });
      if (dir) inp.setAttribute("webkitdirectory", "");
      inp.addEventListener("change", function () { resolve(Array.prototype.slice.call(inp.files || [])); inp.remove(); });
      D.body.appendChild(inp); inp.click();
    });
  }
  function readText(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = function () { rej(r.error); }; r.readAsText(file); }); }
  function readBytes(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = function () { rej(r.error); }; r.readAsArrayBuffer(file); }); }
  function copy(text) {
    if (root.navigator && navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    var ta = h("textarea", { style: { position: "fixed", left: "-9999px" } }); ta.value = text; D.body.appendChild(ta); ta.select();
    var ok = false; try { ok = D.execCommand("copy"); } catch (e) { ok = false; } ta.remove();
    return Promise.resolve(ok);
  }
  function debounce(fn, ms) { var t = 0; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
  function fmtBytes(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : n + " B"; }
  function fmtTime(ms) { if (!ms) return ""; var d = new Date(ms), now = new Date(), p = function (x) { return x < 10 ? "0" + x : x; }; return d.toDateString() === now.toDateString() ? p(d.getHours()) + ":" + p(d.getMinutes()) : p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
  /** Lưu cấu hình nhỏ (bọc try/catch: chế độ riêng tư có thể chặn localStorage) */
  var memStore = {};
  function lsGet(k, def) { try { var v = root.localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return k in memStore ? memStore[k] : def; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { memStore[k] = v; return false; } }

  CS.dom = { esc: esc, h: h, $: $, $$: $$, toast: toast, dialog: dialog, confirm: confirmBox, prompt: promptBox, menu: menu, closeMenu: closeMenu,
    download: download, pickFiles: pickFiles, readText: readText, readBytes: readBytes, copy: copy, debounce: debounce, fmtBytes: fmtBytes, fmtTime: fmtTime, lsGet: lsGet, lsSet: lsSet };
})(window);
