/* Vài hàm DOM nhỏ dùng chung: dựng phần tử, thông báo nổi, hộp thoại xác nhận. Không thư viện ngoài. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});

  function $(s, g) { return (g || document).querySelector(s); }
  function $$(s, g) { return Array.prototype.slice.call((g || document).querySelectorAll(s)); }

  /* h("div", {class: "a", onclick: fn, "data-x": 1, html: "<b>tin cậy</b>"}, con1, "chuỗi", [con2, con3]) */
  function h(tag, thuoc) {
    var el = document.createElement(tag);
    if (thuoc) {
      Object.keys(thuoc).forEach(function (k) {
        var v = thuoc[k];
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "text") el.textContent = v;
        else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "value") el.value = v;
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) them(el, arguments[i]);
    return el;
  }
  function them(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { them(el, x); });
    else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }

  var toastEl = null, toastHen = 0;
  function toast(msg, loai) {
    if (!toastEl) { toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite" }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = "toast hien" + (loai ? " " + loai : "");
    clearTimeout(toastHen);
    toastHen = setTimeout(function () { toastEl.className = "toast"; }, 3200);
  }

  /* hoi({tieuDe, noiDung (Node|string), nutChinh, nutPhu, nguyHiem}) → Promise<boolean> */
  function hoi(o) {
    return new Promise(function (xong) {
      var dlg = h("dialog", { class: "hop", "aria-labelledby": "hop-td" });
      var noi = typeof o.noiDung === "string" ? h("p", { text: o.noiDung }) : o.noiDung;
      var chinh = h("button", { class: "btn " + (o.nguyHiem ? "btn-bad" : "btn-ac"), type: "button", text: o.nutChinh || "Đồng ý" });
      var phu = o.nutPhu === null ? null : h("button", { class: "btn", type: "button", text: o.nutPhu || "Huỷ" });
      dlg.appendChild(h("h3", { id: "hop-td", text: o.tieuDe || "Xác nhận" }));
      dlg.appendChild(h("div", { class: "hop-nd" }, noi));
      dlg.appendChild(h("div", { class: "hop-nut" }, phu, chinh));
      function dong(kq) { try { dlg.close(); } catch (e) { /* đã đóng */ } dlg.remove(); xong(kq); }
      chinh.addEventListener("click", function () { dong(true); });
      if (phu) phu.addEventListener("click", function () { dong(false); });
      dlg.addEventListener("cancel", function (e) { e.preventDefault(); dong(false); });
      document.body.appendChild(dlg);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
      chinh.focus();
    });
  }

  /* Bỏ dấu tiếng Việt để tìm kiếm không cần gõ dấu. */
  function boDau(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  }

  function tai(ten, noiDung, mime) {              /* tải một tệp văn bản xuống máy */
    var b = new Blob([noiDung], { type: mime || "text/plain;charset=utf-8" }), u = URL.createObjectURL(b);
    var a = h("a", { href: u, download: ten });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
  }

  function chep(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return false; });
    var ta = h("textarea", { value: txt, style: "position:fixed;opacity:0" });
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return Promise.resolve(ok);
  }

  TH.dom = { $: $, $$: $$, h: h, toast: toast, hoi: hoi, boDau: boDau, tai: tai, chep: chep };
})(window);
