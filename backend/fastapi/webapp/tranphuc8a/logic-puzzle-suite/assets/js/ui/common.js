/* ui/common.js — các mảnh giao diện dùng chung cho mọi màn: huy hiệu bậc, tên puzzle, ngày giờ, liên kết seed, chia sẻ/tải tệp, lớp phủ "đang sinh…", chip chọn.
   Gắn vào Puz.ui.pz. Mọi chuỗi từ dữ liệu đưa vào DOM qua textContent (h()) — không dùng innerHTML với dữ liệu người dùng. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  P.boards = P.boards || {};              // sổ đăng ký giao diện bàn: Puz.boards["<id>"] = { mount(host, env), editor(host, env) } — nạp sau tệp này (xem HUONG-DAN-ENGINE.md mục 9)

  function typeDef(id) { return P.types.get(id); }
  /** Các loại đã đăng ký, theo thứ tự cố định của Daily (loại V2 đứng sau). */
  function types() {
    var all = P.types.all(), out = [];
    P.daily.ORDER.forEach(function (id) { var d = all.filter(function (x) { return x.id === id; })[0]; if (d) out.push(d); });
    all.forEach(function (d) { if (out.indexOf(d) < 0) out.push(d); });
    return out;
  }
  function tierName(id) { var t = P.util.tier(id); return t ? t.name : id === "custom" ? "Tự tạo" : String(id || ""); }
  function scoreText(s) { return (s == null || isNaN(s) ? "?" : (Math.round(s * 10) / 10).toFixed(1)) + "/10"; }
  function tierBadge(tierId, score) {
    var el = h("span", { class: "tier t-" + (tierId || "custom"), title: "Độ khó " + scoreText(score) });
    el.append(h("b", { text: tierName(tierId) }), h("span", { text: scoreText(score) }));
    return el;
  }
  function sizeText(puzzle) {
    var d = typeDef(puzzle.type), s = d && d.sizes.filter(function (x) { return x.id === puzzle.sizeId; })[0];
    if (s) return s.label;
    var z = puzzle.size; return z && typeof z === "object" ? Object.keys(z).map(function (k) { return z[k]; }).join("×") : z != null ? String(z) : "";
  }
  function puzzleTitle(puzzle, rec) {
    var d = typeDef(puzzle.type), name = (rec && rec.name) || (puzzle.meta && puzzle.meta.name) || "";
    return name || (d ? d.name : puzzle.type) + " · " + sizeText(puzzle) + (puzzle.seed != null ? " · #" + puzzle.seed : "");
  }
  var VI_DAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  function dayText(key) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(key || ""); }
  function weekdayText(key) { return VI_DAYS[P.daily.weekday(key)] || ""; }
  function dateTime(ms) { var d = new Date(ms), p = function (n) { return n < 10 ? "0" + n : n; }; return dayText(P.util.dayKey(d)) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); }
  function ago(ms, now) {
    var s = Math.max(0, ((now || Date.now()) - ms) / 1000);
    return s < 60 ? "vừa xong" : s < 3600 ? Math.floor(s / 60) + " phút trước" : s < 86400 ? Math.floor(s / 3600) + " giờ trước" : Math.floor(s / 86400) + " ngày trước";
  }
  var RESULT = { solved: "Đã giải", revealed: "Xem đáp án", abandoned: "Bỏ dở" };

  /** Liên kết "cùng seed ra cùng puzzle": mở trang Puzzle mới đã điền sẵn và bắt đầu ngay. Loại có options (mục 11) thêm o=id:lựa-chọn,… (chỉ lựa chọn
      KHÁC mặc định, lấy từ puzzle.options) — loại cũ / toàn mặc định thì liên kết y hệt dạng cũ. */
  function seedHash(puzzle) {
    if (puzzle.seed == null) return "";
    var q = { size: puzzle.sizeId || "", tier: puzzle.tier && puzzle.tier !== "custom" ? puzzle.tier : "", seed: String(puzzle.seed) }, d = typeDef(puzzle.type), o = d && d.options ? P.types.encodeOptions(d, puzzle.options) : "";
    if (o) q.o = o;
    q.go = "1";
    return "#/new/" + puzzle.type + "?" + new root.URLSearchParams(q).toString();
  }
  function seedUrl(puzzle) { var hsh = seedHash(puzzle); return hsh ? root.location.origin + root.location.pathname + hsh : ""; }

  function download(name, text, mime) { U.download(name, new root.Blob([text], { type: mime || "text/plain;charset=utf-8" })); }
  /** Chia sẻ tệp puzzle: Web Share (điện thoại) nếu hỗ trợ tệp; không thì tải xuống. */
  function sharePuzzle(puzzle, toast) {
    var name = P.files.safeName(puzzleTitle(puzzle)) + ".json", text = P.files.exportJson([puzzle]);
    try {
      var file = new root.File([text], name, { type: "application/json" });
      if (root.navigator.canShare && root.navigator.canShare({ files: [file] })) return root.navigator.share({ files: [file], title: puzzleTitle(puzzle) }).catch(function (e) { if (e && e.name !== "AbortError") download(name, text, "application/json"); });
    } catch (e) { /* rơi xuống tải xuống */ }
    download(name, text, "application/json"); if (toast) toast("Đã tải " + name);
    return Promise.resolve();
  }

  /** Lớp phủ "đang làm…" có thể huỷ. → { close(), el }. */
  function busy(message, onCancel) {
    var box = h("div", { class: "busy-ov", role: "alertdialog", "aria-live": "assertive", "aria-label": message }, h("div", { class: "busy-card" }, h("span", { class: "spin", "aria-hidden": "true" }), h("p", { text: message })));
    if (onCancel) box.firstChild.append(h("button", { type: "button", class: "btn", text: "Huỷ", on: { click: function () { close(); onCancel(); } } }));
    function close() { if (box.parentNode) box.parentNode.removeChild(box); }
    doc.body.append(box);
    return { close: close, el: box };
  }

  /** Nhóm chip chọn một: items [{id, label, disabled, title}] */
  function chips(items, value, onPick, label) {
    var wrap = h("div", { class: "chips", role: "group", "aria-label": label || "" });
    items.forEach(function (it) {
      var b = h("button", { type: "button", class: "chip" + (it.id === value ? " on" : ""), "aria-pressed": String(it.id === value), disabled: it.disabled ? true : null, title: it.title || null, on: { click: function () { onPick(it.id); } } }, h("span", { text: it.label }));
      wrap.append(b);
    });
    return wrap;
  }

  function stat(label, value, sub) { return h("div", { class: "stat" }, h("b", { text: value }), h("small", { text: label }), sub ? h("small", { class: "faint", text: sub }) : null); }
  function section(title, body, actions) { return h("section", { class: "hs" }, h("div", { class: "hs-head" }, h("h2", { text: title }), actions || null), body); }
  function emptyNote(text) { return h("p", { class: "empty-note", text: text }); }

  U.pz = { typeDef: typeDef, types: types, tierName: tierName, scoreText: scoreText, tierBadge: tierBadge, sizeText: sizeText, puzzleTitle: puzzleTitle, dayText: dayText, weekdayText: weekdayText, dateTime: dateTime, ago: ago,
    RESULT: RESULT, seedHash: seedHash, seedUrl: seedUrl, download: download, sharePuzzle: sharePuzzle, busy: busy, chips: chips, stat: stat, section: section, emptyNote: emptyNote };
})(typeof globalThis !== "undefined" ? globalThis : this);
