/* ui/dialogs.js — các hộp thoại (<dialog> gốc: có sẵn khoá focus, Esc, trả focus về nút đã mở):
   chi tiết app (+ mã QR), menu cài đặt/tiện ích, phím tắt, tờ trượt bộ lọc (điện thoại), mã QR.
   Điện thoại: tờ trượt từ đáy; máy tính: hộp giữa màn hình (CSS). Cần Portal.dialogs.init(api) từ app.js. */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var T = P.text, D = P.dom, icon = D.icon, $ = D.$;
  var doc = root.document, api = null;

  function wire(dlg) {
    if (dlg._wired) return;
    dlg._wired = true;
    dlg.addEventListener("click", function (e) { if (e.target === dlg || (e.target.closest && e.target.closest("[data-close]"))) dlg.close(); });
    dlg.addEventListener("close", function () { if (!doc.querySelector("dialog[open]")) doc.body.classList.remove("modal-open"); });
  }
  function show(dlg, html) {
    wire(dlg);
    dlg.innerHTML = html;
    if (!dlg.open) { doc.body.classList.add("modal-open"); dlg.showModal(); }
    return dlg;
  }
  function head(id, title) {
    return '<div class="dlg-head"><h2 id="' + id + '">' + T.esc(title) + '</h2><button type="button" class="icon-btn" data-close aria-label="Đóng">' + icon("x") + "</button></div>";
  }
  function seg(set, items, cur) {
    return '<div class="seg" role="group">' + items.map(function (i) {
      return '<button type="button" data-set="' + set + '" data-val="' + i[0] + '" aria-pressed="' + (i[0] === cur) + '">' + (i[2] ? icon(i[2]) : "") + "<span>" + T.esc(i[1]) + "</span></button>";
    }).join("") + "</div>";
  }
  function isLocalHost(url) { try { return /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(new root.URL(url).hostname); } catch (e) { return false; } }

  // ------------------------------------------------------------------ chi tiết app
  function info(app) {
    var prefs = api.prefs(), fav = prefs.favorites.indexOf(app.path) !== -1, hid = prefs.hidden.indexOf(app.path) !== -1;
    var u = prefs.usage[app.path], url = D.appUrl(app), now = Date.now(), sub = [app.label, app.category].filter(Boolean).join(" · ");
    var rows = '<dt>Đường dẫn</dt><dd><code>/webapp/' + T.esc(app.path) + "/</code></dd>";
    if (app.updated) rows += "<dt>Cập nhật</dt><dd>" + T.fmtDate(app.updated * 1000) + " (" + T.relTime(app.updated * 1000, now) + ")</dd>";
    rows += "<dt>Đã mở</dt><dd>" + (u && u.count ? u.count + " lần · lần cuối " + T.relTime(u.last, now) : "Chưa lần nào") + "</dd>";
    rows += "<dt>Offline</dt><dd>" + (app.pwa ? "Cài được và mở được khi không có mạng" : "Cần kết nối mạng") + "</dd>";
    var secondary =
      '<button type="button" class="btn" data-act="fav" aria-pressed="' + fav + '">' + icon("star") + (fav ? "Bỏ ghim" : "Ghim") + "</button>" +
      '<button type="button" class="btn" data-act="hide">' + icon(hid ? "eye" : "eye-off") + (hid ? "Bỏ ẩn" : "Ẩn") + "</button>" +
      '<button type="button" class="btn" data-act="copy">' + icon("link") + "Sao chép liên kết</button>" +
      '<button type="button" class="btn" data-act="qr">' + icon("qr") + "Mã QR</button>" +
      (root.navigator.share ? '<button type="button" class="btn" data-act="share">' + icon("share") + "Chia sẻ</button>" : "");
    var dlg = show($("#dlgInfo"),
      head("infoTitle", "Chi tiết ứng dụng") +
      '<div class="dlg-body">' +
      '<div class="info-hero"><div class="card-icon" data-n="' + T.glyphCount(app.icon) + '" aria-hidden="true">' + T.esc(app.icon) + "</div><div><h3>" + T.esc(app.title) + '</h3><p class="muted">' + T.esc(sub) + "</p></div></div>" +
      (app.desc ? '<p class="info-desc">' + T.esc(app.desc) + "</p>" : "") +
      (app.tags.length ? '<div><div class="grp-title">Tag — bấm để lọc</div><div class="info-tags">' + app.tags.map(function (t) { return '<button type="button" class="chip" data-tag="' + T.esc(t) + '"><span>#' + T.esc(t) + "</span></button>"; }).join("") + "</div></div>" : "") +
      '<dl class="info-meta">' + rows + "</dl>" +
      '<div class="btn-row">' + secondary + "</div>" +
      '<div class="qr-box" id="infoQr" hidden></div>' +
      "</div>" +
      '<div class="dlg-foot"><a class="btn btn-primary" href="' + T.esc(url) + '" data-act="open">' + "Mở ứng dụng</a>" +
      '<a class="btn" href="' + T.esc(url) + '" target="_blank" rel="noopener" data-act="open-new">' + icon("external") + "Mở tab mới</a></div>");
    dlg.onclick = function (e) {
      var t = e.target.closest && e.target.closest("[data-act], [data-tag]");
      if (!t) return;
      if (t.dataset.tag) { dlg.close(); api.filterTag(t.dataset.tag); return; }
      var act = t.dataset.act;
      if (act === "open") { e.preventDefault(); dlg.close(); api.openApp(app, {}); }
      else if (act === "open-new") api.recordOpen(app.path);
      else if (act === "fav") { api.toggleFav(app.path); info(app); }
      else if (act === "hide") { api.toggleHide(app.path); info(app); }
      else if (act === "copy") D.copyText(url).then(function (ok) { D.toast(ok ? "Đã sao chép liên kết" : "Không sao chép được — hãy chép tay: " + url); });
      else if (act === "share") root.navigator.share({ title: app.title, url: url }).catch(function () { /* người dùng đóng bảng chia sẻ */ });
      else if (act === "qr") {
        var box = $("#infoQr", dlg);
        if (!box.hidden) { box.hidden = true; return; }
        box.innerHTML = qrMarkup(url);
        box.hidden = false;
        box.scrollIntoView({ block: "nearest" });
      }
    };
    return dlg;
  }

  function qrMarkup(url) {
    var svg;
    try { svg = P.qr.toSvg(P.qr.encode(url), 4); } catch (e) { return '<p class="palette-error">' + T.esc(e.message) + "</p>"; }
    return svg + "<p>Quét bằng camera điện thoại để mở.</p>" +
      (isLocalHost(url) ? '<p class="faint">Địa chỉ đang là <b>' + T.esc(new root.URL(url).hostname) + "</b> — điện thoại không mở được địa chỉ này. Mở cổng bằng địa chỉ IP của máy tính (vd. 192.168.x.x:" + T.esc(root.location.port || "80") + ") rồi tạo lại mã.</p>" : "") +
      '<p class="faint" style="word-break:break-all">' + T.esc(url) + "</p>";
  }

  function qr(url, title) {
    var dlg = show($("#dlgQr"), head("qrTitle", title || "Mã QR") + '<div class="dlg-body"><div class="qr-box">' + qrMarkup(url) + "</div></div>");
    return dlg;
  }

  // ------------------------------------------------------------------ menu
  function menu() {
    var p = api.prefs(), s = p.settings, ins = api.installState();
    var installRow = ins === "ready" ? '<button type="button" class="btn btn-primary" data-act="install">' + icon("download") + "Cài đặt ứng dụng</button>"
      : ins === "installed" ? '<p class="muted">✓ Đang chạy như ứng dụng đã cài.</p>'
      : ins === "ios" ? '<p class="muted">Trên iPhone/iPad: bấm <b>Chia sẻ</b> rồi <b>Thêm vào MH chính</b>.</p>'
      : ins === "insecure" ? '<p class="muted">Cần địa chỉ https (hoặc localhost) mới cài được và dùng offline.</p>'
      : '<p class="muted">Dùng menu của trình duyệt → <b>Cài đặt ứng dụng</b> / <b>Thêm vào màn hình chính</b>.</p>';
    var opt = function (list, cur) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + T.esc(o[1]) + "</option>"; }).join(""); };
    var dlg = show($("#dlgMenu"),
      head("menuTitle", "Cài đặt và tiện ích") +
      '<div class="dlg-body">' +
      '<section><div class="grp-title">Giao diện</div>' + seg("theme", [["system", "Hệ thống", "monitor"], ["light", "Sáng", "sun"], ["dark", "Tối", "moon"]], s.theme) + "</section>" +
      '<section class="stack"><div class="grp-title">Hiển thị</div>' +
      '<div class="set-row"><span>Kiểu</span>' + seg("view", [["grid", "Lưới", "grid"], ["list", "Danh sách", "rows"]], s.view) + "</div>" +
      '<div class="set-row"><span>Mật độ</span>' + seg("density", [["comfortable", "Thoải mái"], ["compact", "Gọn"]], s.density) + "</div>" +
      '<div class="set-row"><label for="setSort">Sắp xếp mặc định</label><select id="setSort" data-select="sort">' + opt([["relevance", "Phù hợp nhất"], ["popular", "Hay mở nhất"], ["recent", "Mở gần đây"], ["updated", "Mới cập nhật"], ["name", "Tên A → Z"], ["name-desc", "Tên Z → A"], ["collection", "Theo thư mục"], ["category", "Theo thể loại"]], s.sort) + "</select></div>" +
      '<div class="set-row"><label for="setGroup">Nhóm theo</label><select id="setGroup" data-select="group">' + opt([["none", "Không nhóm"], ["collection", "Thư mục"], ["category", "Thể loại"]], s.group) + "</select></div>" +
      '<div class="set-row"><div><label for="setTab">Mở app trong tab mới</label><div class="hint">Cổng ở lại để bạn mở nhiều app</div></div><span class="switch"><input type="checkbox" id="setTab" data-switch="newTab"' + (s.newTab ? " checked" : "") + "><span></span></span></div></section>" +
      '<section class="stack"><div class="grp-title">Ứng dụng</div>' + installRow +
      '<div class="set-row"><span>Dùng offline</span><span class="muted" id="offlineState">…</span></div>' +
      '<div class="btn-row"><button type="button" class="btn" data-act="refresh">' + icon("refresh") + 'Làm mới danh sách</button><button type="button" class="btn" data-act="portalqr">' + icon("qr") + "Mở cổng trên điện thoại</button></div></section>" +
      '<section class="stack"><div class="grp-title">Dữ liệu của bạn</div>' +
      '<p class="muted">' + p.favorites.length + " ghim · " + p.hidden.length + " ẩn · " + Object.keys(p.usage).length + " app đã mở. Lưu trên trình duyệt này.</p>" +
      (api.persistent() ? "" : '<p class="palette-error">Trình duyệt đang chặn lưu trữ: cài đặt chỉ giữ trong phiên này.</p>') +
      '<div class="btn-row"><button type="button" class="btn" data-act="export">' + icon("download") + 'Xuất</button><label class="btn" tabindex="0">' + icon("upload") + 'Nhập<input type="file" accept="application/json,.json" data-file hidden></label>' +
      '<button type="button" class="btn btn-danger" data-act="clear">' + icon("trash") + "Xoá lịch sử</button></div></section>" +
      '<section><div class="grp-title">Tiện ích</div><div class="btn-row"><button type="button" class="btn" data-act="random">' + icon("dice") + 'Mở app ngẫu nhiên</button><button type="button" class="btn" data-act="help">' + icon("keyboard") + "Phím tắt</button></div></section>" +
      "</div>");
    api.offlineStatus().then(function (st) {
      var el = $("#offlineState", dlg);
      if (el) el.textContent = st === "ready" ? "Sẵn sàng ✓" : st === "preparing" ? "Đang chuẩn bị…" : "Không hỗ trợ ở đây";
    });
    dlg.onclick = function (e) {
      var t = e.target.closest && e.target.closest("[data-set], [data-act]");
      if (!t) return;
      if (t.dataset.set) { api.setSetting(t.dataset.set, t.dataset.val); menu(); return; }
      var act = t.dataset.act;
      if (act === "install") api.promptInstall().then(function () { menu(); });
      else if (act === "refresh") { dlg.close(); api.refresh(); }
      else if (act === "portalqr") qr(api.portalUrl(), "Mở cổng trên điện thoại");
      else if (act === "export") { var x = api.exportData(); D.download(x.name, x.text); D.toast("Đã xuất dữ liệu"); }
      else if (act === "random") { dlg.close(); api.randomApp(); }
      else if (act === "help") { dlg.close(); help(); }
      else if (act === "clear") {
        if (!t.dataset.armed) { t.dataset.armed = "1"; t.lastChild.textContent = "Bấm lần nữa để xoá"; setTimeout(function () { if (t.isConnected) { delete t.dataset.armed; t.lastChild.textContent = "Xoá lịch sử"; } }, 4000); }
        else { api.clearHistory(); menu(); D.toast("Đã xoá lịch sử mở app"); }
      }
    };
    dlg.onchange = function (e) {
      var t = e.target;
      if (t.dataset.select) api.setSetting(t.dataset.select, t.value);
      else if (t.dataset.switch) api.setSetting(t.dataset.switch, t.checked);
      else if (t.hasAttribute("data-file") && t.files && t.files[0]) {      // data-file không có giá trị → dataset.file là "" (falsy)
        var f = t.files[0];
        if (f.size > 2e6) { D.toast("Tệp quá lớn để là dữ liệu của cổng."); return; }
        f.text().then(function (text) {
          try { var r = api.importData(text); menu(); D.toast("Đã nhập: " + r.favorites + " ghim, " + r.hidden + " ẩn, " + r.usage + " lịch sử"); }
          catch (err) { D.toast(err.message, { ms: 6000 }); }
        });
      }
    };
    return dlg;
  }

  // ------------------------------------------------------------------ phím tắt
  var KEYS = [
    [["/"], "Vào ô tìm kiếm"], [["Ctrl", "K"], "Tìm mọi thứ: app, khoá học, bài học, lab — hoặc hỏi AI"], [["?"], "Mở bảng này"],
    [["g", "h"], "Về Trang chủ"], [["g", "a"], "Tất cả ứng dụng"], [["g", "f"], "Yêu thích"],
    [["←", "↑", "→", "↓"], "Di chuyển giữa các thẻ"], [["Enter"], "Mở app đang chọn"], [["Shift", "Enter"], "Mở app đang chọn ở tab mới"],
    [["f"], "Ghim / bỏ ghim app đang chọn"], [["i"], "Xem chi tiết app đang chọn"], [["h"], "Ẩn / bỏ ẩn app đang chọn"],
    [["1", "…", "9"], "Mở app ghim thứ 1…9"], [["r"], "Mở một app ngẫu nhiên"], [["v"], "Đổi lưới ⇄ danh sách"], [["t"], "Đổi giao diện sáng / tối"], [["Esc"], "Đóng hộp thoại; xoá ô tìm"]
  ];
  function help() {
    return show($("#dlgHelp"), head("helpTitle", "Phím tắt") + '<div class="dlg-body"><dl class="kbd-list">' + KEYS.map(function (k) {
      return "<dt>" + k[0].map(function (x) { return "<kbd>" + T.esc(x) + "</kbd>"; }).join("") + "</dt><dd>" + T.esc(k[1]) + "</dd>";
    }).join("") + '</dl><p class="faint">Các phím chữ chỉ có tác dụng khi bạn không đang gõ trong một ô nhập.</p></div>');
  }

  // ------------------------------------------------------------------ tờ trượt bộ lọc (điện thoại)
  function facets() {
    var dlg = show($("#dlgFacets"), head("facetsTitle", "Lọc") + '<div class="dlg-body" id="sheetFacets"></div>' +
      '<div class="dlg-foot"><button type="button" class="btn" data-act="clear">Xoá lọc</button><button type="button" class="btn btn-primary" data-close id="sheetDone">Xem kết quả</button></div>');
    dlg.onclick = function (e) {
      if (e.target.closest && e.target.closest("[data-act=clear]")) api.clearFilters();
    };
    refreshFacets();
    return dlg;
  }
  function refreshFacets() {
    var dlg = $("#dlgFacets");
    if (!dlg || !dlg.open) return;
    P.facets.render($("#sheetFacets", dlg), api.facetsCtx());
    var n = api.resultCount();
    $("#sheetDone", dlg).textContent = n ? "Xem " + n + " ứng dụng" : "Không có app nào";
  }

  function closeAll() { D.$$("dialog[open]").forEach(function (d) { d.close(); }); }

  P.dialogs = { init: function (a) { api = a; }, info: info, menu: menu, help: help, facets: facets, refreshFacets: refreshFacets, qr: qr, closeAll: closeAll, KEYS: KEYS };
})(typeof globalThis !== "undefined" ? globalThis : this);
