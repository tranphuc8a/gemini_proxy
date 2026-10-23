/* ui/syncpanel.js — mục "Đồng bộ giữa các thiết bị" (đầu trang Cài đặt, neo #/settings/sync): tạo kho, nối thiết bị bằng mã / liên kết / mã QR,
   xem trạng thái, ngắt, xoá kho trên máy chủ.
   Không có tài khoản: kho = mã kho + khoá bí mật. Mã nối "<nơi lưu>.<mã kho>.<khoá>" chính là chìa khoá — ai có mã đọc/ghi được ghi chú trong kho.

   Mỗi tình huống "chưa đồng bộ được" có thông điệp riêng kèm việc làm được ngay (thuộc tính data-sync để check.py kiểm):
     file       mở tệp trực tiếp (file://)                  → chỉ đường: mở app qua máy chủ
     no_config  http(s) nhưng trang thiếu cấu hình máy chủ   → Tải lại trang / mở địa chỉ thư mục ./
     offline    có máy chủ, đang mất mạng, chưa nối kho      → chờ có mạng (tự vẽ lại khi mất / có mạng)
     ephemeral  máy chủ chỉ có kho tạm (vd JSON ở /tmp)       → cảnh báo + hộp xác nhận nói rõ khi tạo kho
     lost       kho mất thật (401 / 404 + wiki_not_found)    → nối lại bằng mã / ngắt kết nối rồi tạo kho mới
     no_api     địa chỉ này không có API /wiki (404 không mã) → thử lại / tải lại trang; KHÔNG bảo nối lại (khoá kho vẫn giữ) */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, U = W.ui, h = U.h, icon = U.icon;
  var onlineHook = null;                                           // listener "online"/"offline" của bảng đồng bộ đang hiện (tối đa một)
  function unhookOnline(f) { if (!f) return; root.removeEventListener("online", f); root.removeEventListener("offline", f); if (onlineHook === f) onlineHook = null; }

  var EPHEMERAL_ALL = "Máy chủ này chỉ có kho tạm: dữ liệu có thể mất hoặc các thiết bị không thấy nhau. Hãy sao lưu.";
  var EPHEMERAL_ONE = "Nơi lưu này là kho tạm: dữ liệu trên máy chủ có thể mất khi máy chủ khởi động lại và các thiết bị có thể không thấy nhau. Nên chọn nơi lưu bền.";

  function syncPanel(ctx) {
    var S = W.sync && W.sync.instance, box = h("div", { class: "set-body" });
    var el = h("section", { class: "set set-sync", id: "set-sync", "aria-labelledby": "set-sync-h" }, h("h2", { id: "set-sync-h", tabindex: "-1", text: "Đồng bộ giữa các thiết bị" }), box);
    var backends = null, chosen = "", asking = false, askErr = null;

    if (!S) {
      box.append(h("p", { class: "faint", text: "Đồng bộ chưa sẵn sàng." }));
      if (ctx.takeJoin && ctx.takeJoin()) ctx.toast("Đồng bộ chưa sẵn sàng nên chưa mở được liên kết nối — tải lại trang rồi mở lại liên kết.", { ms: 8000 });
      return el;
    }
    var pendingJoin = ctx.takeJoin ? ctx.takeJoin() : "";          // mã từ liên kết …/#/join/<mã> (app.js đã xoá khỏi địa chỉ); lấy SAU khi chắc có S

    function fail(e) { ctx.toast(e && e.message ? e.message : "Không thực hiện được", { ms: 7000 }); }
    function when(ms) { return ms ? T.fmtDateTime(ms) + " (" + T.relTime(ms, Date.now()) + ")" : "chưa lần nào"; }
    function btn(label, ic, run, cls) { return h("button", { type: "button", class: "btn" + (cls ? " " + cls : ""), html: (ic ? icon(ic) : "") + "<span>" + T.esc(label) + "</span>", on: { click: run } }); }
    function reload() { root.location.reload(); }

    // ------------------------------------------------------------------------------------------- mã nối, liên kết, QR
    function showCode() {
      var code = S.code(), d = null;
      var codeIn = h("input", { type: "text", readonly: true, value: code, "aria-label": "Mã nối thiết bị", class: "code-in" });
      var linkIn = h("input", { type: "text", readonly: true, value: "", "aria-label": "Liên kết nối thiết bị", class: "link-in" });   // không dùng lớp code-in: .code-in là ô mã
      var qr = h("div", { class: "qr-box", role: "img", "aria-label": "Mã QR của liên kết nối" });
      function fill(c) {
        code = c; codeIn.value = c;
        var link = W.sync.joinLink(root.location.href, c);
        linkIn.value = link;
        if (!W.qr) { qr.hidden = true; return; }
        // SVG do bộ mã hoá của app tự sinh (chỉ có dữ liệu đường vẽ) — không chứa chuỗi nào của người dùng
        try { qr.innerHTML = W.qr.toSvg(W.qr.encode(link), 4); qr.hidden = false; } catch (e) { qr.replaceChildren(h("p", { class: "hint", text: e.message + " Hãy dùng liên kết hoặc mã bên dưới." })); }
      }
      fill(code);
      [codeIn, linkIn].forEach(function (i) { i.addEventListener("focus", function () { i.select(); }); });
      function copier(label, get, done) { return btn(label, "copy", function () { U.copyText(get()).then(function (ok) { ctx.toast(ok ? done : "Không sao chép được — chọn và chép tay"); }); }); }
      d = U.dialog("Mã nối thiết bị", [
        h("p", { text: "Trên thiết bị khác: quét mã QR (hoặc mở liên kết) bằng trình duyệt rồi bấm “Nối”. Hoặc vào Cài đặt → Đồng bộ → “Nối vào kho có sẵn” và dán mã." }),
        qr,
        h("label", { class: "code-lb", text: "Liên kết nối" }), linkIn,
        h("label", { class: "code-lb", text: "Mã nối" }), codeIn,
        h("p", { class: "warn", text: "Mã, liên kết và mã QR này là chìa khoá: ai có được đều đọc và sửa được mọi ghi chú trong kho. Chỉ đưa cho thiết bị của bạn; không đăng lên chỗ công khai." })
      ], [copier("Sao chép liên kết", function () { return linkIn.value; }, "Đã sao chép liên kết nối"), copier("Sao chép mã", function () { return code; }, "Đã sao chép mã nối")]);
      d.el.classList.add("code-dlg");
      // máy nối bằng mã cũ "default.…": ghi hẳn tên nơi lưu (mã không còn phụ thuộc mặc định của máy chủ) rồi cập nhật hộp thoại
      if (/^default\./.test(code)) S.fullCode().then(function (c) { if (c !== code && d.el.isConnected) fill(c); });
    }

    // ------------------------------------------------------------------------------------------- nơi lưu, tạo, nối
    function ask() {
      if (asking) return;
      asking = true;
      S.backends().then(function (b) { asking = false; askErr = null; backends = b; chosen = W.sync.chooseBackend(b).id; if (el.isConnected) render(); },
        function (e) { asking = false; askErr = e; if (el.isConnected) render(); });
    }
    function pickBackend() {
      var sel = h("select", { "aria-label": "Nơi lưu trên máy chủ", class: "sync-backend" }, ((backends && backends.backends) || []).map(function (b) {
        var note = !b.available ? " (chưa dùng được)" : !b.persistent ? " — kho tạm, có thể mất" : "";
        return h("option", { value: b.id, disabled: b.available ? null : true, text: b.label + (b.id === backends.default ? " · mặc định của máy chủ" : "") + note });
      }));
      sel.value = chosen; sel.addEventListener("change", function () { chosen = sel.value; render(); });
      return sel;
    }
    function create() {
      var eph = W.sync.isEphemeral(backends, chosen);
      ctx.confirm(eph ? "Tạo kho tạm?" : "Tạo kho đồng bộ mới?",
        (eph ? "Đây là KHO TẠM: dữ liệu trên máy chủ có thể mất khi máy chủ khởi động lại, và các thiết bị có thể không thấy nhau. Ghi chú trên máy này vẫn an toàn — hãy sao lưu. " : "") +
        "Toàn bộ ghi chú trên máy này sẽ được gửi lên máy chủ. Bạn nhận một mã nối (kèm liên kết và mã QR) để dùng trên thiết bị khác.", eph ? "Vẫn tạo kho tạm" : "Tạo và gửi").then(function (ok) {
        if (!ok) return;
        S.create(chosen).then(function () { ctx.toast("Đã tạo kho. Đang gửi ghi chú…"); showCode(); render(); }, fail);
      });
    }
    function join(prefill) {
      var s = S.state();
      var hint = (prefill ? "Mã lấy từ liên kết nối bạn vừa mở — kiểm tra rồi bấm “Nối”. " : "Lấy từ thiết bị đã đồng bộ: Cài đặt → Đồng bộ → Xem mã nối. ") +
        (s.configured && !s.lost ? "Máy này đang nối một kho khác: nối mã này sẽ THAY kho đó (ghi chú trên máy giữ nguyên và được gửi lên kho mới)." : "");
      U.formBox("Nối vào kho có sẵn", [{ name: "code", label: "Mã nối", required: true, value: prefill || "", placeholder: "json.wk_….…", hint: hint, max: 400 }], "Nối").then(function (v) {
        if (!v) return;
        // 404 không mã (wiki_no_api) = địa chỉ này không có API đồng bộ, KHÔNG phải "không có kho": giữ thông báo của sync.js
        S.join(v.code).then(function () { ctx.toast("Đã nối. Đang kéo ghi chú về…"); render(); }, function (e) { fail(e.status === 401 ? new Error("Sai khoá hoặc kho không tồn tại.") : e.status === 404 && e.code === "wiki_not_found" ? new Error("Không tìm thấy kho này (đúng nơi lưu chưa?).") : e); });
      });
    }
    /** Mở hộp "Nối" điền sẵn mã từ liên kết — KHÔNG tự nối: người dùng xem và bấm "Nối". */
    function maybeJoin(s) {
      if (!pendingJoin || !s.loaded) return;
      var c = pendingJoin; pendingJoin = "";
      if (!S.parseCode(c)) { ctx.toast("Liên kết nối không hợp lệ (mã sai dạng).", { ms: 7000 }); return; }
      // so theo kho (mã kho + khoá), không so cả chuỗi: máy nối bằng mã cũ "default.<kho>.<khoá>" mở liên kết "json.<kho>.<khoá>" vẫn là cùng kho
      if (s.configured && W.sync.sameStore(c, S.code())) { ctx.toast("Máy này đã nối đúng kho này rồi."); return; }
      setTimeout(function () { if (el.isConnected) join(c); }, 0);
    }

    // ------------------------------------------------------------------------------------------- vẽ
    function setup(s, why, kids) {
      kids.push(h("p", { class: "faint", text: "Ghi chú luôn lưu trên máy này trước; đồng bộ chỉ sao chép chúng giữa các thiết bị của bạn qua máy chủ. Không cần tài khoản." }));
      if (why === "offline") {
        // có máy chủ nhưng đang mất mạng (vd PWA mở offline, hoặc rớt mạng khi bảng đang mở — kể cả đã hỏi được danh sách nơi lưu):
        // không hỏi máy chủ, không mời "Tạo kho" / "Nối" (đều cần mạng) — nói đúng lý do
        kids.push(h("p", { class: "faint", "data-sync": "offline", text: "Đang ngoại tuyến — bật đồng bộ khi có mạng." }));
        return;
      }
      if (askErr) {
        kids.push(h("p", { class: "warn", "data-sync": askErr.code === "wiki_no_api" ? "no_api" : "ask_failed", text: "Không hỏi được máy chủ: " + askErr.message }));
        kids.push(h("div", { class: "btn-row" }, btn("Thử lại", "refresh", function () { askErr = null; render(); }, "btn-primary")));
        return;
      }
      if (!backends) { kids.push(h("p", { class: "faint", text: "Đang kiểm tra máy chủ…" })); ask(); return; }
      var pick = W.sync.chooseBackend(backends);
      kids.push(h("div", { class: "set-row" }, h("div", null, h("label", { text: "Nơi lưu trên máy chủ" }), h("p", { class: "hint", text: "Đã chọn sẵn nơi lưu bền. “Tệp JSON” ở thư mục tạm của máy chủ có thể mất khi khởi động lại; MySQL / MongoDB bền hơn." })), pickBackend()));
      if (pick.none) kids.push(h("p", { class: "warn", "data-sync": "no_backend", text: "Máy chủ chưa có nơi lưu nào dùng được nên chưa tạo được kho mới. Vẫn nối được vào kho có sẵn bằng mã nối." }));
      else if (W.sync.isEphemeral(backends, chosen)) kids.push(h("p", { class: "warn", "data-sync": "ephemeral", text: pick.ephemeral ? EPHEMERAL_ALL : EPHEMERAL_ONE }));
      var mk = btn("Tạo kho đồng bộ mới", "cloud", create, "btn-primary");
      if (pick.none || !chosen) mk.disabled = true;
      kids.push(h("div", { class: "btn-row" }, mk, btn("Nối vào kho có sẵn…", "link", function () { join(""); })));
    }

    function connected(s, kids) {
      var stopped = s.fatal && (s.lost || s.errorCode === "wiki_no_api");
      var line = s.phase === "push" ? "Đang gửi lên… " + s.done.toLocaleString("vi-VN") + (s.total ? " / " + s.total.toLocaleString("vi-VN") : "") : s.phase === "pull" ? "Đang kéo về… " + s.done.toLocaleString("vi-VN") :
        s.phase === "offline" ? "Đang ngoại tuyến — sẽ đồng bộ khi có mạng" : s.fatal ? "Đồng bộ đã dừng" : s.error ? "Chưa đồng bộ được" : "Đã đồng bộ";
      kids.push(h("p", { role: "status", "aria-live": "polite", class: "sync-line" }, h("b", { text: line }), s.error && !stopped ? h("span", { class: s.fatal ? "warn" : "faint", text: s.error + (s.fatal ? "" : " Sẽ tự thử lại.") }) : null));
      kids.push(h("p", { class: "faint", text: "Lần cuối: " + when(s.last) + (s.pending ? " · còn " + s.pending.toLocaleString("vi-VN") + " thay đổi chờ gửi" : "") + (s.skipped ? " · " + s.skipped + " bản ghi bị máy chủ từ chối (vd quá lớn), giữ nguyên trên máy" : "") }));
      var leaveBtn = btn("Ngắt kết nối", null, function () { ctx.confirm("Ngắt kết nối?", "Ghi chú giữ nguyên trên máy này; kho trên máy chủ (nếu còn) cũng giữ nguyên. Nối lại hoặc tạo kho mới bất cứ lúc nào.", "Ngắt").then(function (ok) { if (ok) S.leave().then(render); }); });
      if (s.fatal && s.lost) {
        kids.push(h("p", { class: "warn", "data-sync": "lost", text: "Kho đồng bộ không còn trên máy chủ hoặc khoá đã đổi — cần nối lại. Ghi chú trên máy này vẫn còn nguyên: nối lại bằng mã nối từ thiết bị còn kho, hoặc ngắt kết nối rồi tạo kho mới từ máy này." }));
        kids.push(h("div", { class: "btn-row" }, btn("Nối lại bằng mã…", "link", function () { join(""); }, "btn-primary"), leaveBtn));
        return;
      }
      if (s.fatal && s.errorCode === "wiki_no_api") {
        kids.push(h("p", { class: "warn", "data-sync": "no_api", text: (s.error || W.sync.NO_API) + " Khoá kho vẫn giữ trên máy — sửa xong là đồng bộ tiếp, không cần nối lại." }));
        kids.push(h("div", { class: "btn-row" }, btn("Thử lại", "refresh", function () { S.now(); }, "btn-primary"), btn("Tải lại trang", null, reload), leaveBtn));
        return;
      }
      kids.push(h("div", { class: "btn-row" },
        btn("Đồng bộ ngay", "refresh", function () { S.now(); }, "btn-primary"),
        btn("Xem mã nối…", "link", showCode),
        leaveBtn,
        h("button", { type: "button", class: "btn btn-danger", text: "Xoá kho trên máy chủ…", on: { click: function () { ctx.confirm("Xoá kho trên máy chủ?", "Mọi bản sao trên máy chủ bị xoá và các thiết bị khác không đồng bộ được nữa. Ghi chú trên máy này (và máy khác) vẫn còn.", "Xoá kho", true).then(function (ok) { if (ok) S.deleteRemote().then(function () { ctx.toast("Đã xoá kho trên máy chủ"); render(); }, fail); }); } } })));
    }

    function render() {
      var s = S.state(), kids = [], why = W.sync.blocker({ available: s.available, online: s.online, protocol: root.location.protocol });
      if (why === "file") {
        kids.push(h("p", { class: "faint", "data-sync": "file" }, "Bạn đang mở tệp trực tiếp (file://) nên chưa đồng bộ được. Đồng bộ cần mở app qua máy chủ, ví dụ ",
          h("code", { text: "http(s)://<máy chủ>/webapp/tranphuc8a/personal-wiki/" }), ". Ghi chú vẫn lưu trên máy này."));
        if (pendingJoin) { pendingJoin = ""; ctx.toast("Liên kết nối chỉ dùng được khi mở app qua máy chủ.", { ms: 7000 }); }
      } else if (why === "no_config") {
        kids.push(h("p", { class: "warn", "data-sync": "no_config", text: "Trang không nhận được địa chỉ API của máy chủ (thiếu cấu hình) nên chưa đồng bộ được. Ghi chú vẫn lưu trên máy này." }));
        kids.push(h("div", { class: "btn-row" }, btn("Tải lại trang", "refresh", reload, "btn-primary"), h("a", { class: "btn", href: "./", text: "Mở từ địa chỉ thư mục" })));
        kids.push(h("p", { class: "hint", text: "Nếu vẫn thế: mở đúng địa chỉ của máy chủ …/webapp/tranphuc8a/personal-wiki/ (không phải bản tải về hay một máy chủ tĩnh khác)." }));
        if (pendingJoin) { pendingJoin = ""; ctx.toast("Trang chưa có cấu hình máy chủ — tải lại rồi mở lại liên kết nối.", { ms: 8000 }); }
      } else if (!s.loaded) {
        kids.push(h("p", { class: "faint", text: "Đang đọc cài đặt đồng bộ…" }));
      } else if (!s.configured) {
        setup(s, why, kids);
      } else {
        connected(s, kids);
      }
      el.dataset.sync = why || (!s.loaded ? "loading" : !s.configured ? "setup" : s.fatal ? (s.lost ? "lost" : s.errorCode === "wiki_no_api" ? "no_api" : "stopped") : "on");
      box.replaceChildren.apply(box, kids);
      maybeJoin(s);
    }

    var off = S.on(function () { if (!el.isConnected) { off(); return; } render(); });
    // Mất mạng / có mạng lại thì vẽ lại khi chưa nối kho ("ngoại tuyến" ⇄ nút Tạo/Nối; đã nối kho thì sync.js tự báo qua S.on). Chỉ giữ MỘT
    // listener cho bảng đang hiện: mở lại Cài đặt thì gỡ listener của bảng cũ, không để chúng dồn lại theo số lần mở tới tận sự kiện kế tiếp.
    function back() { if (!el.isConnected) { unhookOnline(back); return; } if (!S.state().configured) render(); }
    if (root.addEventListener) { unhookOnline(onlineHook); onlineHook = back; root.addEventListener("online", back); root.addEventListener("offline", back); }
    render();
    return el;
  }

  U.syncPanel = syncPanel;
})(typeof globalThis !== "undefined" ? globalThis : this);
