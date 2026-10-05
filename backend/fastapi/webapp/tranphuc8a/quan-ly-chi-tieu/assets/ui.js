/* ui.js — tiện ích DOM dùng chung: thoát HTML, toast, hộp thoại, tệp, sao chép.
   Chỉ chạy trong trình duyệt. Mọi chuỗi người dùng PHẢI đi qua esc() trước khi vào innerHTML. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});
  var esc = QL.text.esc;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------------------------------------------------------------- toast */
  function toast(message, opt) {
    opt = opt || {};
    var box = $("#toasts");
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span>' + esc(message) + "</span>" + (opt.action ? '<button type="button">' + esc(opt.label || "Hoàn tác") + "</button>" : "");
    if (opt.action) el.querySelector("button").addEventListener("click", function () { remove(); opt.action(); });
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    var timer = setTimeout(remove, opt.ms || (opt.action ? 7000 : 3500));
    function remove() { clearTimeout(timer); if (el.parentNode) el.parentNode.removeChild(el); }
    return remove;
  }

  /* ------------------------------------------------------------ hộp thoại */
  /**
   * Mở <dialog> modal. `html` là phần thân; trả {el, close}. Esc và bấm nền đều đóng.
   * Dùng <dialog> gốc nên có sẵn khoá focus và trả focus về nút đã mở.
   */
  function dialog(title, bodyHtml, footHtml, opt) {
    opt = opt || {};
    var el = document.createElement("dialog");
    el.className = "dlg" + (opt.wide ? " wide" : "") + (opt.center ? " center" : "");
    el.setAttribute("aria-labelledby", "dlg-t");
    el.innerHTML = '<div class="dlg-in"><div class="dlg-head"><h2 id="dlg-t">' + esc(title) + '</h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button></div>' +
      '<div class="dlg-body">' + bodyHtml + "</div>" + (footHtml ? '<div class="dlg-foot">' + footHtml + "</div>" : "") + "</div>";
    document.body.appendChild(el);
    var opener = document.activeElement;
    function close(result) { if (el.open) el.close(); el._result = result; }
    el.addEventListener("close", function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (opener && opener.focus && document.contains(opener)) { try { opener.focus(); } catch (e) { /* bỏ qua */ } }
      if (opt.onClose) opt.onClose(el._result);
    });
    el.addEventListener("click", function (e) {
      if (e.target === el || (e.target.closest && e.target.closest("[data-close]"))) close();
    });
    el.showModal();
    var first = opt.focus ? el.querySelector(opt.focus) : el.querySelector("input:not([type=hidden]):not([type=checkbox]), select, textarea");
    if (first && opt.autofocus !== false) first.focus();
    return { el: el, close: close };
  }

  /** Hỏi xác nhận; trả Promise<boolean>. */
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var d = dialog(title, '<p>' + esc(text) + "</p>",
        '<button type="button" class="btn" data-close>Huỷ</button><button type="button" class="btn ' + (danger ? "danger" : "primary") + '" data-ok>' + esc(okLabel || "Đồng ý") + "</button>",
        { center: true, autofocus: false, onClose: function (r) { resolve(r === true); } });
      d.el.querySelector("[data-ok]").addEventListener("click", function () { d.close(true); });
      d.el.querySelector("[data-ok]").focus();
    });
  }

  /* ---------------------------------------------------------------- tệp */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function pickFile(accept) {
    return new Promise(function (resolve) {
      var inp = document.createElement("input");
      inp.type = "file"; inp.accept = accept || "";
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0];
        if (!f) return resolve(null);
        var r = new FileReader();
        r.onload = function () { resolve({ name: f.name, text: String(r.result) }); };
        r.onerror = function () { resolve(null); };
        r.readAsText(f, "utf-8");
      });
      inp.click();
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }

  function debounce(fn, ms) {
    var t = null;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }

  /* ----------------------------------------------------- mảnh HTML dùng lại */
  function attr(o) {
    var s = "";
    for (var k in o) if (o[k] !== false && o[k] != null) s += " " + k + (o[k] === true ? "" : '="' + esc(o[k]) + '"');
    return s;
  }
  /** Ô nhập có nhãn. */
  function field(label, inner, hint, id) {
    return '<label class="fld"' + (id ? ' for="' + id + '"' : "") + ">" + esc(label) + '<span class="in">' + inner + "</span>" + (hint ? '<span class="hint">' + hint + "</span>" : "") + "</label>";
  }
  function options(list, selected, empty) {
    return (empty ? '<option value="">' + esc(empty) + "</option>" : "") +
      list.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === selected ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("");
  }
  /** Điều khiển phân đoạn: items [{id,label,cls?}]. */
  function seg(name, items, current, extra) {
    return '<div class="seg ' + (extra || "") + '" role="group" aria-label="' + esc(name) + '">' +
      items.map(function (i) { return '<button type="button" data-seg="' + esc(name) + '" data-v="' + esc(i.id) + '" aria-pressed="' + (i.id === current) + '" class="' + esc(i.cls || "") + '">' + esc(i.label) + "</button>"; }).join("") + "</div>";
  }

  QL.ui = {
    $: $, $$: $$, esc: esc, toast: toast, dialog: dialog, confirmBox: confirmBox, download: download, pickFile: pickFile,
    copyText: copyText, debounce: debounce, attr: attr, field: field, options: options, seg: seg
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
