/* share.js (giao diện) — hộp thoại "Chia sẻ liên kết chỉ đọc" và việc nhân bản một bản chia sẻ về thư viện.
   Logic thuần: core/share.js (địa chỉ #, mục mới) + core/store.js (sync.share/shares/unshare, readShared). Trang XEM nằm ở share-view.js.
   Liên kết trỏ tới ẢNH CHỤP đang lưu trên máy chủ (nên phải đã bật đồng bộ); đoạn mã sửa sau đó không tự cập nhật — bấm "Cập nhật bản chia sẻ".
   Token chỉ nằm sau dấu # của liên kết. Mọi chuỗi từ máy chủ đi vào DOM qua textContent. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h, A = CS.app, SH = CS.share;

  function sync() { return A.Store && A.Store.sync; }
  function link(token) { return SH.linkFor(root.location.href, token, (sync() && sync().backend) || ""); }
  function when(ms) { return ms ? U.fmtTime(ms) : ""; }

  /* ------------------------------------------------------------------ hộp thoại */
  function open() {
    var it = A.S.item;
    if (!it) { U.toast("Mở một đoạn mã/dự án trước.", "bad"); return; }
    var sy = sync();
    if (!A.API || !sy || !A.Store.connected()) {
      U.dialog({
        title: "Chia sẻ liên kết chỉ đọc",
        body: h("div", { class: "cs-shd" }, [
          h("p", { text: "Liên kết trỏ tới bản chụp của đoạn mã/dự án trên máy chủ, nên cần bật đồng bộ trước." }),
          h("p", { class: "cs-note", text: A.API ? "Mở “Nơi lưu & đồng bộ”, chọn kho (MySQL/MongoDB/JSON) và tạo hoặc nối một không gian." : "Code Studio đang mở không qua máy chủ nên không có chỗ lưu liên kết." })
        ]),
        actions: A.API ? [{ label: "Đóng", value: null }, { label: "Nơi lưu & đồng bộ…", value: "storage", primary: true }] : [{ label: "Đóng", value: null }]
      }).then(function (v) { if (v === "storage") A.cmd("storage"); });
      return;
    }
    var state = { shares: [], busy: false, error: "", loading: true };
    var box = h("div", { class: "cs-shd" });
    function render() {
      box.innerHTML = "";
      var mine = state.shares.filter(function (s) { return s.itemId === it.id; })[0];
      box.appendChild(h("p", {}, [h("strong", { text: it.name || "Không tên" }), root.document.createTextNode(it.kind === "project" ? " · dự án " + it.files.length + " tệp" : " · đoạn mã")]));
      if (state.loading) box.appendChild(h("p", { class: "cs-ai-busy", role: "status", text: "Đang kiểm tra các liên kết hiện có…" }));
      else if (mine) {
        var url = link(mine.token);
        var inp = h("input", { type: "text", class: "inp", readonly: true, value: url, "aria-label": "Liên kết chia sẻ chỉ đọc", onfocus: function (e) { e.target.select(); } });
        box.appendChild(h("div", { class: "cs-shd-link" }, [inp,
          h("button", { type: "button", class: "btn sm pri", text: "Chép liên kết", disabled: state.busy ? true : null, onclick: function () { U.copy(url).then(function (ok) { U.toast(ok ? "Đã chép liên kết" : "Không chép được — hãy bôi đen ô bên cạnh", ok ? "ok" : "bad", 1800); }); } }),
          h("a", { class: "btn sm", href: url, target: "_blank", rel: "noopener", text: "Mở" })]));
        box.appendChild(h("p", { class: "cs-note", text: "Bản chụp lúc " + when(mine.updatedAt || mine.sharedAt) + ". Đã sửa mã từ đó? Bấm “Cập nhật bản chia sẻ” để người xem thấy bản mới (liên kết giữ nguyên)." }));
        box.appendChild(h("div", { class: "cs-tc-acts" }, [
          h("button", { type: "button", class: "btn sm", text: "Cập nhật bản chia sẻ", disabled: state.busy ? true : null, onclick: function () { act(function () { return share(it); }, "Đã cập nhật bản chia sẻ"); } }),
          h("button", { type: "button", class: "btn sm danger", text: "Thu hồi liên kết", disabled: state.busy ? true : null, onclick: function () { revoke(it.id, it.name); } })
        ]));
      } else {
        box.appendChild(h("p", { text: "Chưa có liên kết cho mục này. Tạo liên kết để bất kỳ ai có nó xem được mã (không sửa được, không thấy các mục khác của bạn)." }));
        box.appendChild(h("div", { class: "cs-tc-acts" }, [h("button", { type: "button", class: "btn pri", text: "Tạo liên kết chỉ đọc", disabled: state.busy ? true : null, onclick: function () { act(function () { return share(it); }, "Đã tạo liên kết"); } })]));
      }
      if (state.error) box.appendChild(h("p", { class: "cs-tc-bad", role: "alert", text: state.error }));
      box.appendChild(h("p", { class: "cs-note", text: "Người có liên kết đọc được bản chụp: mã nguồn, dữ liệu vào, tham số, bộ test (không có ghim hay thẻ đang mở). Đừng để mật khẩu/khoá trong mã. Thu hồi bất cứ lúc nào." }));
      var others = state.shares.filter(function (s) { return s.itemId !== it.id; });
      if (others.length) {
        var det = h("details", { class: "cs-shd-all" }, [h("summary", { text: "Các liên kết khác của không gian này (" + others.length + ")" })]);
        others.forEach(function (s) {
          det.appendChild(h("div", { class: "cs-shd-row" }, [
            h("span", { class: "n", text: s.name || s.itemId }), h("span", { class: "d", text: when(s.updatedAt || s.sharedAt) }),
            h("button", { type: "button", class: "btn sm", text: "Chép", onclick: function () { U.copy(link(s.token)).then(function (ok) { U.toast(ok ? "Đã chép liên kết" : "Không chép được", ok ? "ok" : "bad", 1500); }); } }),
            h("button", { type: "button", class: "btn sm danger", text: "Thu hồi", onclick: function () { revoke(s.itemId, s.name); } })]));
        });
        box.appendChild(det);
      }
    }
    function share(item) {
      return A.saveNow().then(function () { return sy.share(item.id); });                 /* lưu bản đang soạn → đẩy lên máy chủ → chụp */
    }
    function reload() {
      return sy.shares().then(function (list) { state.shares = list; });
    }
    function act(fn, okMsg) {
      state.busy = true; state.error = ""; render();
      return Promise.resolve().then(fn).then(reload).then(function () { if (okMsg) U.toast(okMsg, "ok", 1800); }).catch(function (e) { state.error = (e && e.message) || "Không làm được."; })
        .then(function () { state.busy = false; render(); });
    }
    function revoke(itemId, name) {
      U.confirm("Thu hồi liên kết?", "Ai đang giữ liên kết tới “" + (name || itemId) + "” sẽ không mở được nữa. Tạo lại sẽ ra liên kết KHÁC.", "Thu hồi", true).then(function (ok) {
        if (ok) act(function () { return sy.unshare(itemId); }, "Đã thu hồi liên kết");
      });
    }
    U.dialog({ title: "Chia sẻ liên kết chỉ đọc", body: box, wide: true, actions: [{ label: "Đóng", value: null }] });
    render();
    reload().catch(function (e) { state.error = (e && e.message) || "Không tải được danh sách liên kết."; }).then(function () { state.loading = false; render(); });
  }

  /* ------------------------------------------------------------------ nhân bản về thư viện (đoạn #clone=…) */
  /** → Promise<item|null>. Chỉ gọi sau khi kho lưu đã sẵn sàng. Luôn xoá đoạn # khỏi địa chỉ để tải lại trang không nhân bản lần nữa. */
  function clone(p) {
    function clear() { try { root.history.replaceState(null, "", root.location.pathname + root.location.search); } catch (e) { /* bỏ qua */ } }
    return CS.store.readShared(p.token, { apiBase: A.API, backend: p.backend }).then(function (res) {
      var item = SH.itemFromShared(res);
      return A.Store.put(item).then(function () { clear(); return A.openItem(item).then(function () { U.toast("Đã nhân bản “" + item.name + "” về thư viện của bạn", "ok", 3500); return item; }); });
    }).catch(function (e) {
      clear();
      U.toast("Không nhân bản được: " + ((e && e.code === "codestore_share_not_found") ? "liên kết không tồn tại hoặc đã bị thu hồi" : (e && e.message) || e), "bad", 6000);
      return null;
    });
  }

  A.share = { open: open, clone: clone };
})(window);
