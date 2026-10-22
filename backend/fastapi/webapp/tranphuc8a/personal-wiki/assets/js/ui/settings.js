/* ui/settings.js — Cài đặt: đồng bộ (đầu trang, neo #/settings/sync), giao diện, độ bền dữ liệu, sao lưu & khôi phục, xuất/nhập, dữ liệu mẫu, xoá. */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, B = W.backup, U = W.ui, h = U.h, icon = U.icon, $ = U.$;

  function group(title, hint, nodes) { return h("section", { class: "set" }, h("h2", { text: title }), hint ? h("p", { class: "faint", text: hint }) : null, h("div", { class: "set-body" }, nodes)); }
  function row(label, control, hint) { return h("div", { class: "set-row" }, h("div", null, h("label", { text: label }), hint ? h("p", { class: "hint", text: hint }) : null), control); }
  function segCtl(name, items, cur, onPick) {
    var s = h("div", { class: "seg", role: "group", "aria-label": name });
    items.forEach(function (i) { s.append(h("button", { type: "button", "aria-pressed": String(cur === i[0]), on: { click: function () { onPick(i[0]); $$("button", s).forEach(function (b, k) { b.setAttribute("aria-pressed", String(items[k][0] === i[0])); }); } } }, h("span", { text: i[1] }))); });
    return s;
  }
  function $$(s, f) { return U.$$(s, f); }
  function fileTime(ms) { return ms ? T.fmtDateTime(ms) : "chưa bao giờ"; }

  function open(ctx, host, anchor) {
    var repo = ctx.repo, st = { destroyed: false }, el = h("div", { class: "page settings" });
    host.replaceChildren(el);
    var prefs = U.prefs(), busy = h("p", { class: "busy", role: "status", "aria-live": "polite", hidden: true });
    function say(msg) { busy.textContent = msg || ""; busy.hidden = !msg; }

    // ----------------------------------------------------------------------------------- giao diện
    var look = group("Giao diện", null, [
      row("Chủ đề", segCtl("Chủ đề", [["system", "Theo máy"], ["light", "Sáng"], ["dark", "Tối"]], prefs.theme, function (v) { U.setPref("theme", v); })),
      row("Cỡ chữ khi soạn", h("input", { type: "range", min: 13, max: 24, step: 1, value: prefs.font, "aria-label": "Cỡ chữ", on: { input: function (e) { U.setPref("font", +e.target.value); $(".fs-val", el).textContent = e.target.value + " px"; } } }), "Áp dụng cho khung soạn và xem trước."),
      row("Chế độ soạn mặc định", segCtl("Chế độ", [["edit", "Sửa"], ["split", "Chia đôi"], ["preview", "Xem"]], prefs.mode, function (v) { U.setPref("mode", v); }), "“Chia đôi” chỉ dùng được trên màn rộng."),
      row("Tự xuống dòng", h("label", { class: "switch" }, h("input", { type: "checkbox", checked: prefs.wrap ? true : null, on: { change: function (e) { U.setPref("wrap", e.target.checked); } } }), h("span")))
    ]);
    look.querySelector('input[type="range"]').after(h("span", { class: "fs-val", text: prefs.font + " px" }));

    // ----------------------------------------------------------------------------------- độ bền dữ liệu
    var dur = h("div", { class: "dur" }), durRow = group("Lưu trữ trên máy này", "Mọi ghi chú nằm trong IndexedDB của trình duyệt — dùng được khi không có mạng.", [dur]);
    function drawDur() {
      var s = repo.stats(), parts = [];
      parts.push(h("p", null, h("b", { text: s.total.toLocaleString("vi-VN") }), " ghi chú (" + s.active.toLocaleString("vi-VN") + " đang dùng · " + s.archived + " lưu trữ · " + s.trashed + " thùng rác) · " + s.tags + " tag"));
      if (repo.store.volatile) parts.push(h("p", { class: "warn", role: "alert", text: "⚠ Trình duyệt đang chặn lưu trữ lâu dài (chế độ riêng tư?). Dữ liệu CHỈ giữ trong phiên này và sẽ mất khi đóng thẻ. Hãy mở app ở cửa sổ thường." }));
      var line = h("p", { class: "faint", text: "Đang kiểm tra dung lượng…" }); parts.push(line);
      dur.replaceChildren.apply(dur, parts);
      var nav = root.navigator.storage;
      if (nav && nav.estimate) Promise.all([nav.estimate(), nav.persisted ? nav.persisted() : Promise.resolve(null)]).then(function (r) {
        if (st.destroyed) return;
        line.textContent = "Đã dùng " + T.fmtBytes(r[0].usage || 0) + (r[0].quota ? " / " + T.fmtBytes(r[0].quota) : "") + ". " + (r[1] === true ? "Trình duyệt đã cam kết KHÔNG tự xoá dữ liệu này." : r[1] === false ? "Trình duyệt có thể xoá dữ liệu khi máy thiếu chỗ." : "");
        if (r[1] === false && nav.persist) { var b = h("button", { type: "button", class: "btn", text: "Xin giữ dữ liệu lâu dài" }); b.addEventListener("click", function () { nav.persist().then(function (ok) { ctx.toast(ok ? "Đã được cam kết giữ dữ liệu" : "Trình duyệt chưa đồng ý — cài app lên màn hình chính sẽ giúp"); drawDur(); }); }); dur.append(b); }
      }, function () { line.textContent = ""; });
      else line.textContent = "";
    }
    drawDur();

    // ----------------------------------------------------------------------------------- sao lưu & khôi phục
    var last = h("p", { class: "faint" });
    function drawLast() { last.textContent = "Sao lưu gần nhất: " + fileTime(prefs.lastBackup) + (prefs.lastBackup ? " (" + T.relTime(prefs.lastBackup, Date.now()) + ")" : ""); }
    drawLast();
    function doBackup() {
      say("Đang tạo bản sao lưu…");
      return B.build(repo, { onProgress: function (p) { say("Đang đóng gói " + p.done.toLocaleString("vi-VN") + " / " + p.total.toLocaleString("vi-VN") + " ghi chú…"); } }).then(function (out) {
        U.download(out.name, out.blob); U.setPref("lastBackup", Date.now()); drawLast(); say(""); ctx.toast("Đã tạo " + out.name + " (" + out.counts.notes.toLocaleString("vi-VN") + " ghi chú, " + T.fmtBytes(out.blob.size) + ")");
        return out;
      }, function (e) { say(""); ctx.toast("Sao lưu lỗi: " + e.message, { ms: 8000 }); throw e; });
    }
    function doRestore() {
      U.pickFiles(".zip,application/zip").then(function (files) {
        var f = files[0]; if (!f) return;
        say("Đang đọc " + f.name + "…");
        f.arrayBuffer().then(function (buf) { return B.parseBackup(new Uint8Array(buf)).then(function (p) { return { buf: buf, p: p }; }); }).then(function (r) {
          say("");
          var p = r.p, existing = repo.size(), msg = "Tệp chứa " + p.notes.length.toLocaleString("vi-VN") + " ghi chú" + (p.manifest.created_at ? ", tạo lúc " + T.fmtDateTime(Date.parse(p.manifest.created_at)) : "") + (p.bad.length ? " (" + p.bad.length + " dòng hỏng sẽ bị bỏ qua)" : "") + ". Máy này đang có " + existing.toLocaleString("vi-VN") + " ghi chú.";
          var merge = h("button", { type: "button", class: "btn btn-primary", text: "Gộp (giữ cả hai)" }), replace = h("button", { type: "button", class: "btn btn-danger", text: "Thay thế toàn bộ" }), dlg;
          merge.addEventListener("click", function () { dlg.close("merge"); }); replace.addEventListener("click", function () { dlg.close("replace"); });
          dlg = U.dialog("Khôi phục sao lưu", [h("p", { text: msg }), h("p", { class: "hint", text: "Gộp: ghi chú mới được thêm; ghi chú trùng chỉ bị đè khi bản trong tệp mới hơn. Thay thế: xoá hết dữ liệu hiện có rồi nạp lại — ứng dụng sẽ tự tải về một bản sao lưu an toàn trước." })], [replace, merge], { onClose: function (mode) { if (mode) run(mode, r.buf); } });
        }, function (e) { say(""); ctx.toast(e.message, { ms: 8000 }); });
      });
    }
    function run(mode, buf) {
      var pre = mode === "replace" && repo.size() ? doBackup() : Promise.resolve();
      pre.then(function () {
        say("Đang khôi phục…");
        return B.restore(repo, new Uint8Array(buf), { mode: mode, onProgress: function (p) { say("Khôi phục: " + (p.phase === 1 ? "ghi chú " : "liên kết ") + p.done.toLocaleString("vi-VN") + " / " + p.total.toLocaleString("vi-VN")); } });
      }).then(function (r) { say(""); ctx.toast("Đã khôi phục: thêm " + r.added + ", cập nhật " + r.updated + ", bỏ qua " + r.skipped + (r.bad.length ? ", " + r.bad.length + " dòng hỏng" : ""), { ms: 9000 }); drawDur(); }, function (e) { say(""); ctx.toast("Khôi phục lỗi: " + e.message, { ms: 9000 }); });
    }
    var backup = group("Sao lưu & khôi phục", "Một tệp .zip chứa toàn bộ ghi chú và lịch ôn tập. Giữ ở nơi khác (đám mây, ổ USB) để an toàn trước mất máy.", [
      last,
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary", html: icon("download") + "<span>Tạo bản sao lưu</span>", on: { click: function () { doBackup().catch(function () {}); } } }), h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Khôi phục từ tệp…</span>", on: { click: doRestore } })),
      row("Nhắc sao lưu sau", h("select", { "aria-label": "Nhắc sao lưu", on: { change: function (e) { U.setPref("backupEvery", +e.target.value); } } }, [[7, "7 ngày"], [14, "14 ngày"], [30, "30 ngày"], [90, "90 ngày"]].map(function (o) { return h("option", { value: o[0], selected: prefs.backupEvery === o[0] ? true : null, text: o[1] }); })))
    ]);

    // ----------------------------------------------------------------------------------- xuất / nhập
    function exportAs(kind) {
      say("Đang chuẩn bị tệp…");
      (kind === "json" ? B.exportJson(repo) : B.exportMarkdown(repo)).then(function (o) { U.download(o.name, o.blob); say(""); ctx.toast("Đã xuất " + o.name + (o.count ? " (" + o.count + " tệp .md)" : "")); }, function (e) { say(""); ctx.toast("Xuất lỗi: " + e.message, { ms: 8000 }); });
    }
    function importMd() {
      U.pickFiles(".md,.markdown,.txt,.zip", true).then(function (files) {
        if (!files.length) return;
        say("Đang đọc " + files.length + " tệp…");
        B.importMarkdown(files, repo.now()).then(function (r) {
          return B.importNotes(repo, r.notes, { onProgress: function (p) { say("Nhập " + p.done + " / " + p.total + "…"); } }).then(function (n) { say(""); ctx.toast("Đã nhập " + n.added + " ghi chú" + (n.updated ? ", cập nhật " + n.updated : "") + (n.skipped ? ", bỏ qua " + n.skipped + " (đã có, không mới hơn)" : "") + (r.skipped.length ? ", " + r.skipped.length + " tệp lỗi" : ""), { ms: 8000 }); drawDur(); });
        }).catch(function (e) { say(""); ctx.toast("Nhập lỗi: " + e.message, { ms: 8000 }); });
      });
    }
    var exp = group("Xuất & nhập", "Dữ liệu của bạn không bị khoá trong app: xuất ra định dạng mở bất cứ lúc nào.", [
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn", text: "Xuất JSON", on: { click: function () { exportAs("json"); } } }),
        h("button", { type: "button", class: "btn", text: "Xuất Markdown (.zip)", on: { click: function () { exportAs("md"); } } }),
        h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Nhập Markdown…</span>", on: { click: importMd } })),
      h("p", { class: "hint", text: "Mỗi ghi chú xuất thành một tệp .md có front-matter (id, tag, ngày…); nhập lại được vào Obsidian hay app khác. Xuất từng ghi chú ra PDF / ảnh: menu ⋯ trong ghi chú." })
    ]);

    // ----------------------------------------------------------------------------------- ứng dụng
    var inst = W.ui.pwa ? W.ui.pwa : null, app = h("div", { class: "set-app" });
    function drawApp() {
      var state = inst ? inst.installState() : "insecure", parts = [];
      if (state === "installed") parts.push(h("p", { text: "✓ Đang chạy như ứng dụng đã cài." }));
      else if (state === "ready") parts.push(h("button", { type: "button", class: "btn btn-primary", html: icon("download") + "<span>Cài đặt ứng dụng</span>", on: { click: function () { inst.promptInstall().then(drawApp); } } }));
      else if (state === "ios") parts.push(h("p", { text: "iPhone/iPad: bấm Chia sẻ → Thêm vào MH chính." }));
      else if (state === "insecure") parts.push(h("p", { class: "faint", text: "Cần địa chỉ https (hoặc localhost) mới cài được và mở offline." }));
      else parts.push(h("p", { text: "Dùng menu trình duyệt → Cài đặt ứng dụng / Thêm vào màn hình chính." }));
      if (inst) { var off = h("p", { class: "faint", text: "Dùng offline: …" }); parts.push(off); inst.offlineStatus().then(function (s) { off.textContent = "Dùng offline: " + (s === "ready" ? "sẵn sàng ✓ — mở được khi không có mạng" : s === "preparing" ? "đang chuẩn bị…" : "không hỗ trợ ở địa chỉ này"); }); }
      app.replaceChildren.apply(app, parts);
    }
    drawApp();
    var appGroup = group("Ứng dụng & offline", null, [app]);

    // ----------------------------------------------------------------------------------- dữ liệu
    var s0 = repo.stats();
    var data = group("Dữ liệu", null, [
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn", text: "Tạo ghi chú mẫu", on: { click: function () { W.ui.views.samples(ctx).then(drawDur); } } }),
        h("button", { type: "button", class: "btn", text: "Dọn thùng rác (" + s0.trashed + ")", disabled: s0.trashed ? null : true, on: { click: function () { ctx.emptyTrash().then(function () { ctx.route({}, true, "settings"); }); } } }),
        h("button", { type: "button", class: "btn btn-danger", text: "Xoá toàn bộ dữ liệu…", on: { click: wipeAll } }))
    ]);
    function wipeAll() {
      ctx.confirm("Xoá TOÀN BỘ dữ liệu trên máy này?", "Mọi ghi chú, tag, thẻ ôn trên thiết bị này sẽ bị xoá. Nên tạo bản sao lưu trước. (Nếu bật đồng bộ, dữ liệu trên máy chủ không bị xoá ở bước này.)", "Tiếp tục", true).then(function (ok) {
        if (!ok) return;
        U.formBox("Xác nhận xoá", [{ name: "w", label: "Gõ XOA để xác nhận", required: true, max: 8 }], "Xoá hết").then(function (v) {
          if (!v || v.w.toUpperCase() !== "XOA") { if (v) ctx.toast("Chưa đúng — không xoá gì."); return; }
          repo.wipe().then(function () { ctx.toast("Đã xoá toàn bộ dữ liệu trên máy này"); drawDur(); });
        });
      });
    }

    // Đồng bộ đứng ĐẦU trang (trước đây nằm gần cuối, sau Giao diện / Lưu trữ / Sao lưu / Xuất — khó tìm). Neo #/settings/sync cuộn + đưa focus tới đây
    // (chỉ báo đồng bộ ở thanh bên, mục "Đồng bộ" trong menu Thêm và biểu ngữ lỗi đồng bộ đều trỏ vào neo này).
    var sync = W.ui.syncPanel ? W.ui.syncPanel(ctx) : null;
    el.append(W.ui.views.pageHead("Cài đặt"), busy, sync, look, durRow, backup, exp, appGroup, data,
      h("p", { class: "faint about" }, "Personal Wiki · dữ liệu lưu trên máy bạn · ", h("a", { href: "../../_portal/portal.html", text: "về cổng ứng dụng" })));
    if (anchor === "sync" && sync) {
      sync.scrollIntoView({ block: "start" });
      var hd = sync.querySelector("h2"); if (hd) { try { hd.focus({ preventScroll: true }); } catch (e) { hd.focus(); } }
    }
    var off = repo.on(function () { if (!st.destroyed) drawDur(); });
    var offPwa = inst && inst.onChange ? inst.onChange(drawApp) : null;
    return { destroy: function () { st.destroyed = true; if (off) off(); } };
  }

  U.settings = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
