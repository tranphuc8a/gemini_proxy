/* share.js — liên kết chia sẻ CHỈ ĐỌC của Code Studio (lõi thuần, kiểm bằng node: kiem-chia-se.js).
   Phần HTTP (tạo/thu hồi/đọc) nằm ở core/store.js (CS.store.sync(...).share/unshare/shares, CS.store.readShared). Ở đây chỉ có:
     • ghép/đọc đoạn "#" của địa chỉ:  #share=<token>&backend=json  (xem)   |   #clone=<token>&backend=json  (nhân bản về thư viện)
       — token đặt SAU dấu "#": trình duyệt không gửi đoạn này lên máy chủ nên nó không lọt vào nhật ký truy cập hay tiêu đề Referer
     • biến một bản chia sẻ thành mục thư viện MỚI (id mới, tên có hậu tố, bỏ dấu vết của chủ cũ)
   Bản chia sẻ là ẢNH CHỤP lúc tạo/cập nhật liên kết, không phải liên kết sống: chủ sửa mã sau đó thì người xem không thấy cho tới khi chủ bấm “Cập nhật”. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  var TOKEN_RE = /^[A-Za-z0-9_-]{16,100}$/;
  var BACKENDS = { json: 1, mysql: 1, mongo: 1 };
  var SUFFIX = " (bản chia sẻ)";

  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }

  /** "#share=T&backend=json" → {mode:"view", token, backend}; "#clone=T…" → {mode:"clone", …}; không hợp lệ → null. */
  function parseHash(hash) {
    var h = String(hash || "").replace(/^#/, "");
    if (!h) return null;
    var out = null, backend = "";
    h.split("&").forEach(function (part) {
      var i = part.indexOf("="), k = i < 0 ? part : part.slice(0, i), v = i < 0 ? "" : part.slice(i + 1);
      try { v = decodeURIComponent(v); } catch (e) { return; }
      if ((k === "share" || k === "clone") && !out) out = { mode: k === "share" ? "view" : "clone", token: v };
      else if (k === "backend" && BACKENDS[v]) backend = v;
    });
    if (!out || !TOKEN_RE.test(out.token)) return null;
    out.backend = backend;
    return out;
  }
  /** Đoạn "#" (kèm dấu #). mode: "view" | "clone". */
  function hashFor(mode, token, backend) {
    return "#" + (mode === "clone" ? "clone" : "share") + "=" + encodeURIComponent(token) + (backend && BACKENDS[backend] ? "&backend=" + backend : "");
  }
  /** Địa chỉ đầy đủ của liên kết, dựng từ địa chỉ trang hiện tại (bỏ ? và #). */
  function linkFor(pageUrl, token, backend) {
    var base = String(pageUrl || "").replace(/[?#].*$/, "");
    return base + hashFor("view", token, backend);
  }

  /**
   * Bản chia sẻ {item, sharedAt} → mục thư viện MỚI sẵn sàng `lib.put`: id mới, tên + " (bản chia sẻ)", updatedAt = bây giờ,
   * không phải bia mộ, không ghim; tệp/meta giữ nguyên (đã chuẩn hoá qua CS.project.normalize nên mọi giới hạn vẫn đúng).
   * o = {newId(), now}
   */
  function itemFromShared(shared, o) {
    o = o || {};
    var P = CS.project;
    if (!P) throw new Error("Thiếu core/project.js");
    if (!isObj(shared) || !isObj(shared.item) || !Array.isArray(shared.item.files)) throw new Error("Bản chia sẻ không đúng định dạng");
    var it = shared.item;
    var id = typeof o.newId === "function" ? o.newId() : P.newId();
    var now = typeof o.now === "number" ? o.now : Date.now();
    var meta = isObj(it.meta) ? JSON.parse(JSON.stringify(it.meta)) : {};
    delete meta.pinned; delete meta.openTabs; delete meta.activeFile;
    var name = String(it.name == null ? "" : it.name).trim() || "Không tên";
    var item = P.normalize({
      id: id, kind: it.kind === "project" ? "project" : "snippet", name: name + SUFFIX, language: it.language,
      files: it.files.map(function (f) { return { path: f && f.path, content: f && f.content }; }), meta: meta, updatedAt: now, deleted: false
    });
    var errs = P.validate(item);
    if (errs.length) throw new Error("Bản chia sẻ không dùng được: " + errs[0]);
    return item;
  }

  CS.share = { TOKEN_RE: TOKEN_RE, SUFFIX: SUFFIX, parseHash: parseHash, hashFor: hashFor, linkFor: linkFor, itemFromShared: itemFromShared };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.share;
})(typeof globalThis !== "undefined" ? globalThis : this);
