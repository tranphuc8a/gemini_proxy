/* ui/syncpanel.js — mục "Đồng bộ giữa các thiết bị" trong Cài đặt: tạo kho, nối thiết bị bằng mã, xem trạng thái, ngắt, xoá kho trên máy chủ.
   Không có tài khoản: kho = mã kho + khoá bí mật. Mã nối "<backend>.<mã kho>.<khoá>" chính là chìa khoá — ai có mã đọc/ghi được ghi chú trong kho. */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, U = W.ui, h = U.h, icon = U.icon;

  function syncPanel(ctx) {
    var S = W.sync && W.sync.instance, box = h("div", { class: "set-body" }), el = h("section", { class: "set" }, h("h2", { text: "Đồng bộ giữa các thiết bị" }), box);
    var backends = null, chosen = "";

    if (!S) { box.append(h("p", { class: "faint", text: "Đồng bộ chưa sẵn sàng." })); return el; }
    if (!S.state().available) {
      box.append(h("p", { class: "faint", text: "Cần mở app qua máy chủ (địa chỉ …/webapp/tranphuc8a/personal-wiki/) để đồng bộ. Ở chế độ mở tệp hoặc offline, ghi chú vẫn lưu trên máy này." }));
      return el;
    }

    function fail(e) { ctx.toast(e && e.message ? e.message : "Không thực hiện được", { ms: 7000 }); }
    function when(ms) { return ms ? T.fmtDateTime(ms) + " (" + T.relTime(ms, Date.now()) + ")" : "chưa lần nào"; }

    function showCode() {
      var code = S.code();
      var input = h("input", { type: "text", readonly: true, value: code, "aria-label": "Mã nối thiết bị", class: "code-in" });
      input.addEventListener("focus", function () { input.select(); });
      var copy = h("button", { type: "button", class: "btn btn-primary", html: icon("copy") + "<span>Sao chép mã</span>", on: { click: function () { U.copyText(code).then(function (ok) { ctx.toast(ok ? "Đã sao chép mã nối" : "Không sao chép được — chọn và chép tay"); }); } } });
      U.dialog("Mã nối thiết bị", [
        h("p", { text: "Trên thiết bị khác: Cài đặt → Đồng bộ → “Nối vào kho có sẵn” rồi dán mã này." }),
        input,
        h("p", { class: "warn", text: "Mã này là chìa khoá: ai có mã đọc và sửa được mọi ghi chú trong kho. Chỉ đưa cho thiết bị của bạn; không đăng lên chỗ công khai." })
      ], [copy]);
    }

    function pickBackend() {
      var sel = h("select", { "aria-label": "Nơi lưu trên máy chủ" }, ((backends && backends.backends) || []).map(function (b) {
        return h("option", { value: b.id === backends.default ? "" : b.id, disabled: b.available ? null : true, text: b.label + (b.available ? "" : " (chưa dùng được)") + (b.available && !b.persistent ? " — mất khi máy chủ khởi động lại" : "") });
      }));
      sel.value = chosen; sel.addEventListener("change", function () { chosen = sel.value; render(); });
      return sel;
    }

    function create() {
      ctx.confirm("Tạo kho đồng bộ mới?", "Toàn bộ ghi chú trên máy này sẽ được gửi lên máy chủ. Bạn nhận một mã nối để dùng trên thiết bị khác.", "Tạo và gửi").then(function (ok) {
        if (!ok) return;
        S.create(chosen).then(function () { ctx.toast("Đã tạo kho. Đang gửi ghi chú…"); showCode(); render(); }, fail);
      });
    }
    function join() {
      U.formBox("Nối vào kho có sẵn", [{ name: "code", label: "Mã nối", required: true, placeholder: "default.abc123.xyz…", hint: "Lấy từ thiết bị đã đồng bộ: Cài đặt → Đồng bộ → Xem mã nối.", max: 400 }], "Nối").then(function (v) {
        if (!v) return;
        S.join(v.code).then(function () { ctx.toast("Đã nối. Đang kéo ghi chú về…"); render(); }, function (e) { fail(e.status === 401 ? new Error("Sai khoá hoặc kho không tồn tại.") : e.status === 404 ? new Error("Không tìm thấy kho này (đúng loại lưu trữ chưa?).") : e); });
      });
    }

    function render() {
      var s = S.state(), kids = [];
      if (!s.configured) {
        kids.push(h("p", { class: "faint", text: "Ghi chú luôn lưu trên máy này trước; đồng bộ chỉ sao chép chúng giữa các thiết bị của bạn qua máy chủ. Không cần tài khoản." }));
        if (!backends) {
          kids.push(h("p", { class: "faint", text: "Đang kiểm tra máy chủ…" }));
          S.backends().then(function (b) { backends = b; chosen = ""; if (el.isConnected) render(); }, function (e) { box.replaceChildren(h("p", { class: "warn", text: "Không hỏi được máy chủ: " + e.message })); });
        } else {
          kids.push(h("div", { class: "set-row" }, h("div", null, h("label", { text: "Nơi lưu trên máy chủ" }), h("p", { class: "hint", text: "“Tệp JSON” trên máy chủ dùng tạm có thể mất khi khởi động lại; MySQL / MongoDB bền hơn." })), pickBackend()));
          kids.push(h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary", html: icon("cloud") + "<span>Tạo kho đồng bộ mới</span>", on: { click: create } }), h("button", { type: "button", class: "btn", html: icon("link") + "<span>Nối vào kho có sẵn…</span>", on: { click: join } })));
        }
      } else {
        var line = s.phase === "push" ? "Đang gửi lên… " + s.done.toLocaleString("vi-VN") + (s.total ? " / " + s.total.toLocaleString("vi-VN") : "") : s.phase === "pull" ? "Đang kéo về… " + s.done.toLocaleString("vi-VN") : s.phase === "offline" ? "Đang ngoại tuyến — sẽ đồng bộ khi có mạng" : s.error ? "" : "Đã đồng bộ";
        kids.push(h("p", { role: "status", "aria-live": "polite" }, h("b", { text: line || "Chưa đồng bộ được" }), s.error ? h("span", { class: s.fatal ? "warn" : "faint", text: s.error }) : null));
        kids.push(h("p", { class: "faint", text: "Lần cuối: " + when(s.last) + (s.pending ? " · còn " + s.pending.toLocaleString("vi-VN") + " thay đổi chờ gửi" : "") + (s.skipped ? " · " + s.skipped + " bản ghi bị máy chủ từ chối (vd quá lớn), giữ nguyên trên máy" : "") }));
        kids.push(h("div", { class: "btn-row" },
          h("button", { type: "button", class: "btn btn-primary", html: icon("refresh") + "<span>Đồng bộ ngay</span>", on: { click: function () { S.now(); } } }),
          h("button", { type: "button", class: "btn", html: icon("link") + "<span>Xem mã nối…</span>", on: { click: showCode } }),
          h("button", { type: "button", class: "btn", text: "Ngắt kết nối", on: { click: function () { ctx.confirm("Ngắt kết nối?", "Ghi chú giữ nguyên trên máy này; kho trên máy chủ cũng giữ nguyên. Nối lại bằng mã nối bất cứ lúc nào.", "Ngắt").then(function (ok) { if (ok) S.leave().then(render); }); } } }),
          h("button", { type: "button", class: "btn btn-danger", text: "Xoá kho trên máy chủ…", on: { click: function () { ctx.confirm("Xoá kho trên máy chủ?", "Mọi bản sao trên máy chủ bị xoá và các thiết bị khác không đồng bộ được nữa. Ghi chú trên máy này (và máy khác) vẫn còn.", "Xoá kho", true).then(function (ok) { if (ok) S.deleteRemote().then(function () { ctx.toast("Đã xoá kho trên máy chủ"); render(); }, fail); }); } } })));
      }
      box.replaceChildren.apply(box, kids);
    }

    var off = S.on(function () { if (!el.isConnected) { off(); return; } render(); });
    render();
    return el;
  }

  U.syncPanel = syncPanel;
})(typeof globalThis !== "undefined" ? globalThis : this);
