/* ui/settings.js — Cài đặt: giao diện (sáng/tối/theo hệ thống, cỡ chữ), tuỳ chọn chơi (tự gạt ứng viên, tô xung đột, tự tạm dừng…), mục tiêu ngày,
   dữ liệu (xuất lịch sử CSV / mọi puzzle JSON, sao lưu + khôi phục .zip, xoá sạch), ứng dụng (cài PWA, trạng thái offline, phím tắt).
   Dữ liệu luyện tập nằm trên thiết bị này; không có gì rời máy (không backend). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, Z = U.pz;

  function switchRow(label, hint, checked, onChange) {
    var inp = h("input", { type: "checkbox", id: "sw-" + label.length + "-" + (hint || "").length }); inp.checked = !!checked;
    inp.addEventListener("change", function () { onChange(inp.checked); });
    return h("div", { class: "set-row" }, h("div", {}, h("label", { for: inp.id, text: label }), hint ? h("p", { class: "hint", text: hint }) : null), h("label", { class: "switch" }, inp, h("span", {})));
  }

  function open(ctx, host) {
    var user = ctx.user, dead = false, off = null;

    function render() {
      if (dead) return;
      var s = user.settings(), prefs = U.prefs(), set = function (k, v) { user.setSetting(k, v).catch(function (e) { ctx.toast(e.message); }); };
      var theme = Z.chips([{ id: "system", label: "Theo hệ thống" }, { id: "light", label: "Sáng" }, { id: "dark", label: "Tối" }], prefs.theme, function (id) { U.setPref("theme", id); render(); }, "Giao diện");
      var font = h("input", { type: "range", min: "13", max: "24", step: "1", value: String(prefs.font), "aria-label": "Cỡ chữ" }), fv = h("span", { class: "fs-val", text: prefs.font + " px" });
      font.addEventListener("input", function () { fv.textContent = font.value + " px"; U.setPref("font", +font.value); });
      var goal = h("select", { "aria-label": "Mục tiêu mỗi ngày" }, [1, 2, 3, 4, 5, 8, 10].map(function (n) { var o = h("option", { value: String(n), text: n + " ván/ngày" }); if (n === s.dailyGoal) o.selected = true; return o; }));
      goal.addEventListener("change", function () { set("dailyGoal", +goal.value); });

      var backup = function () {
        P.backup.build(user).then(function (b) { U.download(b.name, b.blob); U.setPref("lastBackup", Date.now()); ctx.toast("Đã tạo " + b.name + " (" + b.counts.puzzles + " puzzle, " + b.counts.history + " ván lịch sử)."); }, function (e) { ctx.toast("Không sao lưu được: " + e.message); });
      };
      var restore = function () {
        U.pickFiles(".zip,application/zip").then(function (files) {
          if (!files.length) return;
          files[0].arrayBuffer().then(function (buf) { return P.backup.parseBackup(new Uint8Array(buf)); }).then(function (r) {
            var c = r.manifest.counts || {};
            var dlg;
            var run = function (mode) { dlg.close(); user.restore(r.data, mode).then(function (res) { var sk = res.skipped.puzzles + res.skipped.history + res.skipped.games + res.skipped.collections; ctx.toast("Đã khôi phục " + res.puzzles + " puzzle, " + res.history + " ván lịch sử" + (sk ? " (bỏ qua " + sk + " mục hỏng)" : "") + "."); render(); }, function (e) { ctx.toast("Khôi phục lỗi: " + e.message); }); };
            dlg = U.dialog("Khôi phục từ sao lưu", [h("p", { text: "Tệp ghi " + (c.puzzles || 0) + " puzzle, " + (c.collections || 0) + " bộ sưu tập, " + (c.history || 0) + " ván lịch sử, " + (c.games || 0) + " ván dở (tạo lúc " + Z.dateTime(Date.parse(r.manifest.created_at) || 0) + ")." }),
              h("p", { class: "hint", text: "Gộp: giữ dữ liệu hiện có và thêm dữ liệu từ tệp. Thay thế: xoá dữ liệu hiện có rồi nạp đúng như tệp." })],
              [h("button", { type: "button", class: "btn", text: "Huỷ", on: { click: function () { dlg.close(); } } }), h("button", { type: "button", class: "btn btn-danger", text: "Thay thế", on: { click: function () { ctx.confirm("Thay thế toàn bộ dữ liệu?", "Dữ liệu hiện có trên máy sẽ bị xoá.", "Thay thế", true).then(function (ok) { if (ok) run("replace"); }); } } }), h("button", { type: "button", class: "btn btn-primary", text: "Gộp", on: { click: function () { run("merge"); } } })]);
          }).catch(function (e) { ctx.toast(e.message || "Không đọc được tệp.", { ms: 7000 }); });
        });
      };
      var wipe = function () {
        ctx.confirm("Xoá TẤT CẢ dữ liệu?", "Lịch sử, puzzle đã lưu, bộ sưu tập, ván dở và thiết lập trên máy này sẽ bị xoá vĩnh viễn. Hãy sao lưu trước nếu cần.", "Xoá tất cả", true).then(function (ok) { if (!ok) return; user.wipe().then(function () { ctx.toast("Đã xoá sạch."); render(); }); });
      };
      var install = U.pwa.installState(), pwaRow = h("div", { class: "set-row" }, h("div", {}, h("label", { text: "Cài như ứng dụng" }), h("p", { class: "hint", text: install === "installed" ? "Đã cài đặt." : install === "ready" ? "Bấm để cài vào màn hình chính." : install === "ios" ? "Trên iPhone/iPad: Chia sẻ → Thêm vào MH chính." : install === "menu" ? "Dùng menu của trình duyệt → “Cài đặt ứng dụng” / “Thêm vào màn hình chính”." : "Cần mở bằng HTTPS hoặc localhost để cài được." })));
      if (install === "ready") pwaRow.append(h("button", { type: "button", class: "btn btn-primary", text: "Cài đặt", on: { click: function () { U.pwa.promptInstall(); } } }));
      var offline = h("span", { class: "hint", text: "Đang kiểm tra…" });
      U.pwa.offlineStatus().then(function (st) { offline.textContent = st === "ready" ? "Sẵn sàng dùng khi mất mạng." : st === "preparing" ? "Đang tải về để dùng offline…" : st === "unsupported" ? "Trình duyệt không hỗ trợ chế độ offline." : String(st); });
      var counts = user.dump();

      host.replaceChildren(h("div", { class: "page settings" },
        h("div", { class: "ph" }, h("div", {}, h("h1", { text: "Cài đặt" }), h("p", { class: "ph-sub", text: "Mọi dữ liệu nằm trên thiết bị này." }))),
        h("section", { class: "set" }, h("h2", { text: "Giao diện" }), h("div", { class: "set-body" }, h("div", { class: "field" }, h("label", { text: "Chế độ màu" }), theme), h("div", { class: "set-row" }, h("div", {}, h("label", { text: "Cỡ chữ" })), font, fv))),
        h("section", { class: "set" }, h("h2", { text: "Khi chơi" }), h("div", { class: "set-body" },
          switchRow("Tự gạt ứng viên", "Điền một số thì tự bỏ số đó khỏi ghi chú của ô cùng hàng/cột/vùng (Sudoku, Logic Grid).", s.autoRemove, function (v) { set("autoRemove", v); }),
          switchRow("Tô ô xung đột", "Đánh dấu ô vi phạm luật ngay khi bạn điền.", s.showConflicts, function (v) { set("showConflicts", v); }),
          switchRow("Tô các ô cùng giá trị", "Chạm một ô có số thì làm nổi các ô cùng số.", s.highlightSame, function (v) { set("highlightSame", v); }),
          switchRow("Tự tạm dừng khi rời trang", "Đồng hồ dừng khi bạn chuyển tab hoặc khoá máy.", s.autoPause, function (v) { set("autoPause", v); }),
          switchRow("Hỏi trước khi hiện đáp án", "Tránh bấm nhầm Reveal làm mất ván tự giải.", s.confirmReveal, function (v) { set("confirmReveal", v); }),
          h("div", { class: "set-row" }, h("div", {}, h("label", { text: "Mục tiêu mỗi ngày" }), h("p", { class: "hint", text: "Số ván cần giải để tính một ngày vào chuỗi (streak)." })), goal))),
        h("section", { class: "set" }, h("h2", { text: "Dữ liệu của tôi" }), h("div", { class: "set-body" },
          h("p", { class: "hint", text: counts.history.length + " ván lịch sử · " + counts.puzzles.length + " puzzle đã lưu · " + counts.collections.length + " bộ sưu tập · " + counts.games.length + " ván dở." }),
          h("div", { class: "btn-row" },
            h("button", { type: "button", class: "btn btn-primary", html: icon("download") + "<span>Sao lưu (.zip)</span>", on: { click: backup } }), h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Khôi phục…</span>", on: { click: restore } })),
          h("div", { class: "btn-row" },
            h("button", { type: "button", class: "btn", html: icon("download") + "<span>Lịch sử (CSV)</span>", disabled: counts.history.length ? null : true, on: { click: function () { Z.download("lich-su-puzzle_" + P.util.dayKey().replace(/-/g, "") + ".csv", P.files.historyCsv(user.history()), "text/csv;charset=utf-8"); } } }),
            h("button", { type: "button", class: "btn", html: icon("download") + "<span>Mọi puzzle (JSON)</span>", disabled: counts.puzzles.length ? null : true, on: { click: function () { Z.download("puzzle-cua-toi_" + P.util.dayKey().replace(/-/g, "") + ".json", P.files.exportJson(user.puzzles().map(function (r) { return r.puzzle; })), "application/json"); } } }),
            h("button", { type: "button", class: "btn", html: icon("download") + "<span>Danh sách puzzle (CSV)</span>", disabled: counts.puzzles.length ? null : true, on: { click: function () { Z.download("puzzle-cua-toi_" + P.util.dayKey().replace(/-/g, "") + ".csv", P.files.puzzlesCsv(user.puzzles().map(function (r) { return r.puzzle; })), "text/csv;charset=utf-8"); } } }),
            h("button", { type: "button", class: "btn", html: icon("upload") + "<span>Nhập puzzle…</span>", on: { click: function () { U.library.importDialog(ctx); } } })),
          h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-danger", html: icon("trash") + "<span>Xoá tất cả dữ liệu</span>", on: { click: wipe } })),
          prefs.lastBackup ? h("p", { class: "hint", text: "Sao lưu gần nhất: " + Z.ago(prefs.lastBackup) + "." }) : h("p", { class: "warn", text: "Bạn chưa sao lưu lần nào. Một số trình duyệt (đặc biệt Safari) có thể xoá dữ liệu của trang không dùng lâu." }))),
        h("section", { class: "set" }, h("h2", { text: "Ứng dụng" }), h("div", { class: "set-body" }, pwaRow, h("div", { class: "set-row" }, h("div", {}, h("label", { text: "Dùng khi mất mạng" }), offline)),
          h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", text: "Phím tắt (?)", on: { click: function () { root.document.dispatchEvent(new root.KeyboardEvent("keydown", { key: "?", bubbles: true })); } } }), h("a", { class: "btn", href: "../algorithm-notebook/", text: "Mở Algorithm Notebook" }))))));
    }
    render();
    off = user.on(function (ev) { if (ev.type === "restore" || ev.type === "wipe") render(); });
    return { destroy: function () { dead = true; if (off) off(); } };
  }

  U.settings = { open: open };
})(typeof globalThis !== "undefined" ? globalThis : this);
