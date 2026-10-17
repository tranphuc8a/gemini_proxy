/* ui/settings.js — Cài đặt: giao diện, độ bền dữ liệu, sao lưu & khôi phục, xuất, ứng dụng & offline, xoá dữ liệu. */
(function (root) {
  "use strict";
  var A = root.Algo, T = A.text, B = A.backup, U = A.ui, h = U.h, icon = U.icon, $ = U.$;

  function group(title, hint, nodes) { return h("section", { class: "set" }, h("h2", { text: title }), hint ? h("p", { class: "faint", text: hint }) : null, h("div", { class: "set-body" }, nodes)); }
  function row(label, control, hint) { return h("div", { class: "set-row" }, h("div", null, h("label", { text: label }), hint ? h("p", { class: "hint", text: hint }) : null), control); }
  function segCtl(name, items, cur, onPick) {
    var s = h("div", { class: "seg", role: "group", "aria-label": name });
    items.forEach(function (i) { s.append(h("button", { type: "button", "aria-pressed": String(cur === i[0]), on: { click: function () { onPick(i[0]); U.$$("button", s).forEach(function (b, k) { b.setAttribute("aria-pressed", String(items[k][0] === i[0])); }); } } }, h("span", { text: i[1] }))); });
    return s;
  }

  function open(ctx, host) {
    var user = ctx.user, st = { destroyed: false }, el = h("div", { class: "page settings" });
    host.replaceChildren(el);
    var prefs = U.prefs(), busy = h("p", { class: "busy", role: "status", "aria-live": "polite", hidden: true });
    function say(msg) { busy.textContent = msg || ""; busy.hidden = !msg; }

    var look = group("Giao diện", null, [
      row("Chủ đề", segCtl("Chủ đề", [["system", "Theo máy"], ["light", "Sáng"], ["dark", "Tối"]], prefs.theme, function (v) { U.setPref("theme", v); })),
      row("Cỡ chữ", h("input", { type: "range", min: 13, max: 24, step: 1, value: prefs.font, "aria-label": "Cỡ chữ", on: { input: function (e) { U.setPref("font", +e.target.value); $(".fs-val", el).textContent = e.target.value + " px"; } } }), "Áp dụng cho ô soạn ghi chú và code.")
    ]);
    look.querySelector('input[type="range"]').after(h("span", { class: "fs-val", text: prefs.font + " px" }));

    var dur = h("div", { class: "dur" }), durRow = group("Lưu trữ trên máy này", "Mọi dữ liệu của bạn nằm trong IndexedDB của trình duyệt — dùng được khi không có mạng. Danh mục thuật toán dựng sẵn đi kèm ứng dụng.", [dur]);
    function drawDur() {
      var parts = [];
      parts.push(h("p", null, h("b", { text: user.items().length.toLocaleString("vi-VN") }), " mục của tôi · ", h("b", { text: user.notes().length.toLocaleString("vi-VN") }), " ghi chú · ", h("b", { text: user.templates().length }), " template · ", h("b", { text: user.marks().length }), " dấu bookmark/tiến độ · ", h("b", { text: user.cards().length }), " thẻ đã ôn"));
      if (user.store.volatile) parts.push(h("p", { class: "warn", role: "alert", text: "⚠ Trình duyệt đang chặn lưu trữ lâu dài (chế độ riêng tư?). Dữ liệu CHỈ giữ trong phiên này và sẽ mất khi đóng thẻ. Hãy mở app ở cửa sổ thường." }));
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

    var last = h("p", { class: "faint" });
    function drawLast() { last.textContent = "Sao lưu gần nhất: " + (prefs.lastBackup ? T.fmtDateTime(prefs.lastBackup) + " (" + T.relTime(prefs.lastBackup, Date.now()) + ")" : "chưa bao giờ"); }
    drawLast();
    function doBackup() {
      say("Đang tạo bản sao lưu…");
      return B.build(user).then(function (out) { U.download(out.name, out.blob); U.setPref("lastBackup", Date.now()); drawLast(); say(""); ctx.toast("Đã tạo " + out.name + " (" + T.fmtBytes(out.blob.size) + ")"); return out; }, function (e) { say(""); ctx.toast("Sao lưu lỗi: " + e.message, { ms: 8000 }); throw e; });
    }
    function doRestore() {
      U.pickFiles(".zip,application/zip").then(function (files) {
        var f = files[0]; if (!f) return;
        say("Đang đọc " + f.name + "…");
        f.arrayBuffer().then(function (buf) { return B.parseBackup(new Uint8Array(buf)).then(function (p) { return { buf: buf, p: p }; }); }).then(function (r) {
          say("");
          var c = r.p.manifest.counts || {}, msg = "Tệp chứa " + (c.items || 0) + " mục của tôi, " + (c.notes || 0) + " ghi chú, " + (c.templates || 0) + " template, " + (c.marks || 0) + " dấu" + (r.p.manifest.created_at ? ", tạo lúc " + T.fmtDateTime(Date.parse(r.p.manifest.created_at)) : "") + ".";
          var merge = h("button", { type: "button", class: "btn btn-primary", text: "Gộp (giữ cả hai)" }), replace = h("button", { type: "button", class: "btn btn-danger", text: "Thay thế toàn bộ" }), dlg;
          merge.addEventListener("click", function () { dlg.close("merge"); }); replace.addEventListener("click", function () { dlg.close("replace"); });
          dlg = U.dialog("Khôi phục sao lưu", [h("p", { text: msg }), h("p", { class: "hint", text: "Gộp: mục mới được thêm; mục trùng chỉ bị đè khi bản trong tệp mới hơn. Thay thế: xoá hết dữ liệu hiện có rồi nạp lại — ứng dụng tự tải về một bản sao lưu an toàn trước." })], [replace, merge], { onClose: function (mode) { if (mode) run(mode, r.buf); } });
        }, function (e) { say(""); ctx.toast(e.message, { ms: 8000 }); });
      });
    }
    function run(mode, buf) {
      var has = user.items().length + user.notes().length + user.templates().length + user.marks().length > 0, pre = mode === "replace" && has ? doBackup() : Promise.resolve();
      pre.then(function () { say("Đang khôi phục…"); return B.restore(user, new Uint8Array(buf), { mode: mode }); })
        .then(function (r) { say(""); ctx.toast("Đã khôi phục: thêm " + r.added + ", cập nhật " + r.updated + ", bỏ qua " + r.skipped, { ms: 9000 }); drawDur(); }, function (e) { say(""); ctx.toast("Khôi phục lỗi: " + e.message, { ms: 9000 }); });
    }
    var backup = group("Sao lưu & khôi phục", "Một tệp .zip chứa mục của tôi, ghi chú, template, bookmark, tiến độ, lịch ôn thẻ và lịch sử quiz. Giữ ở nơi khác (đám mây, ổ USB) để an toàn trước mất máy.", [
      last,
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary", html: icon("download") + "<span>Tạo bản sao lưu</span>", on: { click: function () { doBackup().catch(function () {}); } } }), h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Khôi phục từ tệp…</span>", on: { click: doRestore } })),
      row("Nhắc sao lưu sau", h("select", { "aria-label": "Nhắc sao lưu", on: { change: function (e) { U.setPref("backupEvery", +e.target.value); } } }, [[7, "7 ngày"], [14, "14 ngày"], [30, "30 ngày"], [90, "90 ngày"]].map(function (o) { return h("option", { value: o[0], selected: prefs.backupEvery === o[0] ? true : null, text: o[1] }); })))
    ]);

    function exportAs(kind) {
      say("Đang chuẩn bị tệp…");
      (kind === "json" ? B.exportJson(user) : kind === "md" ? B.exportMarkdown(user) : B.exportTemplates(user)).then(function (o) { U.download(o.name, o.blob); say(""); ctx.toast("Đã xuất " + o.name + (o.count ? " (" + o.count + " tệp)" : "")); }, function (e) { say(""); ctx.toast("Xuất lỗi: " + e.message, { ms: 8000 }); });
    }
    var exp = group("Xuất", "Dữ liệu không bị khoá trong app. PDF: mở trang thuật toán / Cheat Sheet / So sánh rồi bấm In / PDF.", [
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn", text: "Xuất JSON (toàn bộ)", on: { click: function () { exportAs("json"); } } }),
        h("button", { type: "button", class: "btn", text: "Xuất Markdown (.zip)", on: { click: function () { exportAs("md"); } } }),
        h("button", { type: "button", class: "btn", text: "Xuất template (.zip)", on: { click: function () { exportAs("tpl"); } } })),
      h("p", { class: "hint", text: "Markdown: mỗi thuật toán một tệp .md (thư mục theo nhóm, kèm ghi chú của bạn) + cheatsheet.md + thư mục templates/." })
    ]);

    var inst = U.pwa, app = h("div", { class: "set-app" });
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

    function wipeAll() {
      ctx.confirm("Xoá TOÀN BỘ dữ liệu của tôi trên máy này?", "Mục của tôi, ghi chú, template, bookmark, tiến độ, lịch ôn thẻ sẽ bị xoá. Danh mục dựng sẵn không bị ảnh hưởng. Nên tạo bản sao lưu trước.", "Tiếp tục", true).then(function (ok) {
        if (!ok) return;
        U.formBox("Xác nhận xoá", [{ name: "w", label: "Gõ XOA để xác nhận", required: true, max: 8 }], "Xoá hết").then(function (v) {
          if (!v || v.w.toUpperCase() !== "XOA") { if (v) ctx.toast("Chưa đúng — không xoá gì."); return; }
          user.wipe().then(function () { ctx.toast("Đã xoá toàn bộ dữ liệu của tôi"); drawDur(); });
        });
      });
    }
    var data = group("Dữ liệu", null, [h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-danger", text: "Xoá toàn bộ dữ liệu của tôi…", on: { click: wipeAll } }))]);

    el.append(U.views.pageHead("Cài đặt"), busy, look, durRow, backup, exp, appGroup, data, h("p", { class: "faint about" }, "Algorithm Notebook · dữ liệu lưu trên máy bạn · ", h("a", { href: "../../_portal/portal.html", text: "về cổng ứng dụng" })));
    var offU = user.on(function () { if (!st.destroyed) drawDur(); });
    if (inst && inst.onChange) inst.onChange(drawApp);
    return { destroy: function () { st.destroyed = true; offU(); } };
  }

  U.settings = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
