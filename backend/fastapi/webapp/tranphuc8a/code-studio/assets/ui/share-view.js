/* share-view.js — trang XEM bản chia sẻ chỉ đọc: index.html#share=<token>&backend=<kho>.
   Khi địa chỉ có đoạn #share=… thì app.js KHÔNG dựng IDE: nó gọi CS.shareView.start() thay vào đó. Trang này không đụng tới thư viện, cài đặt,
   đồng bộ hay IndexedDB của người xem — chỉ tải bản chụp từ GET /codestore/shared/{token} (công khai) và hiện bằng trình soạn ở chế độ chỉ đọc.
   Nút "Nhân bản về thư viện" chuyển sang #clone=… để IDE đầy đủ nhập bản này thành mục MỚI của người xem (xem A.share.clone).
   Mọi chuỗi từ máy chủ đi vào DOM qua textContent. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h;
  var CFG = root.__WEBAPP_CONFIG__ || {};
  var API = String(CFG.apiBase || "").replace(/\/+$/, "");

  /** Địa chỉ hiện tại có phải liên kết xem không → {token, backend} hoặc null. */
  function wanted() {
    var p = CS.share && CS.share.parseHash(root.location.hash);
    return p && p.mode === "view" ? p : null;
  }

  function theme() {
    var s = U.lsGet("cs:settings", {}), t = s && s.theme;
    if (t === "dark" || t === "light") root.document.documentElement.setAttribute("data-theme", t);
  }
  function meta(name, content) {
    var m = root.document.createElement("meta"); m.setAttribute("name", name); m.setAttribute("content", content); root.document.head.appendChild(m);
  }

  function start(p) {
    theme();
    var cloning = false;                                                  /* nút "Nhân bản" tự tải lại trang; đừng tải lại hai lần */
    root.addEventListener("hashchange", function () { if (!cloning) root.location.reload(); });
    meta("robots", "noindex, nofollow");                  /* bản chia sẻ riêng tư theo người có liên kết — đừng để công cụ tìm kiếm lập chỉ mục */
    var app = U.$("#app");
    app.className = "cs-share"; app.removeAttribute("aria-live"); app.innerHTML = "";
    root.document.title = "Bản chia sẻ — Code Studio";

    var title = h("h1", { class: "cs-sh-t", text: "Đang tải bản chia sẻ…" });
    var sub = h("div", { class: "cs-sh-m" });
    var copyBtn = h("button", { type: "button", class: "btn", text: "Chép mã tệp này", hidden: true });
    var cloneBtn = h("button", { type: "button", class: "btn pri", text: "Nhân bản về thư viện của tôi", hidden: true, title: "Tạo bản sao của riêng bạn trong Code Studio để chạy và sửa" });
    var top = h("header", { class: "cs-sh-top" }, [h("a", { class: "cs-logo", href: root.location.pathname, title: "Mở Code Studio", "aria-label": "Mở Code Studio", text: "{}" }),
      h("div", { class: "cs-sh-id" }, [title, sub]), h("span", { class: "cs-sp" }), copyBtn, cloneBtn]);
    var tabs = h("div", { class: "cs-sh-tabs", role: "tablist", "aria-label": "Tệp", hidden: true });
    var host = h("div", { class: "cs-sh-ed", hidden: true });
    var input = h("details", { class: "cs-sh-in", hidden: true });
    var note = h("p", { class: "cs-sh-note", role: "status", text: "Đang tải…" });
    var foot = h("footer", { class: "cs-sh-foot" }, [h("span", { text: "Bản chụp chỉ đọc — không tự cập nhật khi chủ sửa mã; chủ có thể thu hồi liên kết bất cứ lúc nào." }),
      h("a", { href: root.location.pathname, text: "Mở Code Studio" })]);
    app.appendChild(top); app.appendChild(note); app.appendChild(tabs); app.appendChild(host); app.appendChild(input); app.appendChild(foot);

    if (!API && !/^https?:$/.test(root.location.protocol)) { fail("Liên kết chia sẻ cần mở qua máy chủ Code Studio (không mở được bằng file://)."); return; }

    function fail(msg) {
      title.textContent = "Không mở được bản chia sẻ";
      note.className = "cs-sh-note bad"; note.setAttribute("role", "alert"); note.textContent = msg;
    }

    CS.store.readShared(p.token, { apiBase: API, backend: p.backend }).then(function (res) {
      var it = res.item, files = it.files.slice(), lang = it.language || "plaintext";
      title.textContent = it.name || "Không tên";
      root.document.title = (it.name || "Bản chia sẻ") + " — Code Studio";
      sub.textContent = "";
      [(CS.langs.get(lang) || {}).name || lang, files.length > 1 ? "Dự án · " + files.length + " tệp" : "Đoạn mã", "Chỉ đọc", res.sharedAt ? "chia sẻ " + U.fmtTime(res.sharedAt) : ""].filter(Boolean).forEach(function (t) {
        sub.appendChild(h("span", { class: "chip", text: t }));
      });
      note.hidden = true; tabs.hidden = files.length < 2; host.hidden = false;
      var main = it.meta && it.meta.mainFile, order = files.map(function (f) { return f.path; });
      var cur = order.indexOf(main) >= 0 ? main : order[0];
      var ed = CS.editor.create(host, { lang: CS.langs.byFilename(cur), value: "", readOnly: true, label: "Mã nguồn (chỉ đọc)", fontSize: 14, wrap: false, completion: false, autoClose: false });

      /* Ô chỉ-đọc không "sửa được", nên trên một số WebKit phím Backspace ở đó bị coi là "Quay lại" và rời khỏi trang — chặn. */
      host.addEventListener("keydown", function (e) { if (e.key === "Backspace") e.preventDefault(); });

      function content(path) { return (files.filter(function (f) { return f.path === path; })[0] || {}).content || ""; }
      function show(path) {
        cur = path;
        ed.setLang(CS.langs.byFilename(path)); ed.setValue(content(path)); ed.setOptions({ readOnly: true });
        Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-path") === path)); });
      }
      files.forEach(function (f) {
        tabs.appendChild(h("button", { type: "button", class: "cs-sh-tab", role: "tab", "data-path": f.path, title: f.path, text: f.path, onclick: function () { show(f.path); } }));
      });
      show(cur);

      copyBtn.hidden = false;
      copyBtn.addEventListener("click", function () { U.copy(content(cur)).then(function (ok) { U.toast(ok ? "Đã chép " + cur : "Không chép được — hãy bôi đen và chép tay", ok ? "ok" : "bad", 1800); }); });
      cloneBtn.hidden = false;
      cloneBtn.addEventListener("click", function () {
        cloning = true;
        root.location.hash = CS.share.hashFor("clone", p.token, p.backend);        /* IDE đầy đủ sẽ nhập bản này ở lần tải sau */
        root.location.reload();
      });
      if (it.meta && typeof it.meta.stdin === "string" && it.meta.stdin.trim()) {
        input.hidden = false;
        input.appendChild(h("summary", { text: "Dữ liệu vào mẫu (stdin)" }));
        input.appendChild(h("pre", { text: it.meta.stdin }));
      }
      ed.refresh();
    }, function (e) {
      fail(e && e.code === "codestore_share_not_found" ? "Liên kết này không tồn tại hoặc chủ của nó đã thu hồi. Hãy xin liên kết mới." : (e && e.message) || "Lỗi không rõ.");
    });
  }

  CS.shareView = { wanted: wanted, start: start };
})(window);
