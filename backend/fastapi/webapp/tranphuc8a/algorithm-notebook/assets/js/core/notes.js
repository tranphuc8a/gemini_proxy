/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */
/* notes.js — mô hình note: chuẩn hoá, tag, liên kết [[…]], quan hệ, tóm tắt. Thuần, kiểm bằng node.

   Note: {id, title, content, created_at, updated_at, tags[], status, kind, fav, rel[], trashed_at, meta}
     status  active | archived | trashed        (archived khôi phục được; trashed tự xoá hẳn sau 30 ngày)
     kind    note | daily | book | chapter | quote
     rel     [{t: related_to|depends_on|parent_of|child_of, id: <id note đích>}]  — quan hệ thêm bằng bảng "Quan hệ"
   Liên kết trong nội dung:  [[Tiêu đề]]  [[Tiêu đề|chữ hiển thị]]  [[depends_on::Tiêu đề]]  — kiểu mặc định là "link" (tham chiếu).
   Mọi thứ đọc từ máy chủ / tệp nhập / IndexedDB đều KHÔNG tin được: normalizeNote ép kiểu, cắt độ dài, bỏ khoá lạ. */
(function (root) {
  "use strict";
  var W = root.Algo || (root.Algo = {});
  if (!W.text && typeof require === "function") require("./text.js");
  var T = W.text;

  var STATUSES = ["active", "archived", "trashed"];
  var KINDS = ["note", "daily", "book", "chapter", "quote"];
  var REL_TYPES = ["related_to", "depends_on", "parent_of", "child_of"];
  var LINK = "link";
  /** Nhãn khi nhìn từ phía note NGUỒN và từ phía note ĐÍCH (cạnh vào). required_by là nghịch đảo của depends_on. */
  var REL_LABEL = {
    link: ["Tham chiếu tới", "Được tham chiếu bởi"], related_to: ["Liên quan tới", "Liên quan tới"], depends_on: ["Phụ thuộc vào", "Được phụ thuộc bởi"],
    parent_of: ["Là cha của", "Là con của"], child_of: ["Là con của", "Là cha của"]
  };
  var SYMMETRIC = { related_to: true };
  var LIM = { title: 200, content: 500000, tags: 30, tag: 40, rel: 200, meta: 10, metaVal: 200, trashDays: 30 };

  function str(x, max) { return typeof x === "string" ? x.slice(0, max) : ""; }
  function ms(x) { x = Math.floor(+x); return isFinite(x) && x > 0 && x < 8.64e15 ? x : 0; }
  function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }

  /** Tag: thường, bỏ #, khoảng trắng → '-', chỉ chữ/số/_-./ ; tối đa 40 ký tự. */
  function normTag(t) {
    t = String(t == null ? "" : t).normalize("NFC").toLowerCase().trim().replace(/^#+/, "").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_\-./]/gu, "").replace(/-{2,}/g, "-").replace(/^[-./]+|[-./]+$/g, "");
    return t.slice(0, LIM.tag);
  }
  function normTags(list) {
    if (typeof list === "string") list = list.split(/[,\n]/);
    return T.uniq((Array.isArray(list) ? list : []).map(normTag).filter(Boolean)).slice(0, LIM.tags);
  }

  /** Chữ đã che phần code (khối ``` và `inline`) bằng khoảng trắng GIỮ NGUYÊN độ dài/vị trí — để quét [[…]], Q:/A: mà không dính code. */
  function maskCode(content) {
    var lines = String(content == null ? "" : content).split("\n"), inFence = false, fence = "", out = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], m = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
      if (inFence) {
        out.push(" ".repeat(ln.length));
        if (m && m[1].charAt(0) === fence.charAt(0) && m[1].length >= fence.length && /^ {0,3}[`~]+\s*$/.test(ln)) inFence = false;
      } else if (m) {
        inFence = true; fence = m[1]; out.push(" ".repeat(ln.length));
      } else {
        out.push(ln.replace(/(`+)(?!`)([^\n]*?[^`\n])\1(?!`)/g, function (s) { return " ".repeat(s.length); }));
      }
    }
    return out.join("\n");
  }

  var LINK_RE = /\[\[([^\[\]\n]{1,300})\]\]/g;
  /** Mọi [[…]] ngoài code → [{type, title, alias, raw, index}]. Tiền tố `kiểu::` chỉ được nhận khi kiểu hợp lệ. */
  function parseLinks(content) {
    var masked = maskCode(content), out = [], m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(masked))) {
      var inner = String(content).slice(m.index + 2, m.index + m[0].length - 2), type = LINK, mt = /^\s*([a-z_]+)\s*::\s*([\s\S]*)$/i.exec(inner);
      if (mt && REL_TYPES.indexOf(mt[1].toLowerCase()) !== -1) { type = mt[1].toLowerCase(); inner = mt[2]; }
      var bar = inner.indexOf("|"), title = (bar === -1 ? inner : inner.slice(0, bar)).trim(), alias = bar === -1 ? "" : inner.slice(bar + 1).trim();
      if (!title) continue;
      out.push({ type: type, title: title.slice(0, LIM.title), alias: alias.slice(0, LIM.title), raw: m[0], index: m.index });
    }
    return out;
  }

  /** Đổi `[[Cũ]]` thành `[[Mới]]` (giữ kiểu và chữ hiển thị) — dùng khi đổi tên note. Chỉ đụng liên kết ngoài code. */
  function rewriteLinks(content, oldTitle, newTitle) {
    var key = T.titleKey(oldTitle), links = parseLinks(content), out = "", cursor = 0;
    links.forEach(function (l) {
      if (T.titleKey(l.title) !== key) return;
      var inner = (l.type === LINK ? "" : l.type + "::") + newTitle + (l.alias ? "|" + l.alias : "");
      out += content.slice(cursor, l.index) + "[[" + inner + "]]";
      cursor = l.index + l.raw.length;
    });
    return cursor ? out + content.slice(cursor) : content;
  }

  /** Tóm tắt phẳng cho danh sách: bỏ ký hiệu markdown, giữ chữ. */
  function plainSnippet(content, max) {
    max = max || 120;
    var s = String(content == null ? "" : content).slice(0, 2000).replace(/```[\s\S]*?(```|$)/g, " ")
      .replace(/\[\[(?:[a-z_]+::)?([^\]|]*)(?:\|([^\]]*))?\]\]/gi, function (_, a, b) { return b || a; })
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^[ \t]*(#{1,6}|>|[-*+]|\d+\.)[ \t]+(\[[ xX]\][ \t]+)?/gm, "").replace(/[*_~`]+/g, "").replace(/\s+/g, " ").trim();
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function titleFromContent(content) {
    var m = /^\s*#{1,6}\s+(.+)$/m.exec(String(content || "")) || /^\s*(\S.*)$/m.exec(String(content || ""));
    var t = m ? plainSnippet(m[1], 80) : "";
    return t || "Chưa đặt tên";
  }

  function normRel(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (r) {
      if (!isObj(r) || REL_TYPES.indexOf(r.t) === -1 || !T.UUID_RE.test(String(r.id))) return;
      var k = r.t + "|" + r.id;
      if (!seen[k] && out.length < LIM.rel) { seen[k] = 1; out.push({ t: r.t, id: r.id }); }
    });
    return out;
  }

  function normMeta(m) {
    var out = {}, n = 0;
    if (isObj(m)) Object.keys(m).forEach(function (k) {
      if (n >= LIM.meta || !/^[a-z_]{1,24}$/.test(k)) return;
      var v = m[k];
      if (typeof v === "string") { out[k] = v.slice(0, LIM.metaVal); n++; } else if (typeof v === "number" && isFinite(v)) { out[k] = v; n++; }
    });
    return out;
  }

  /** Dữ liệu bất kỳ → note hợp lệ. `now` dùng khi thiếu thời gian. Ném Error nếu không có id hợp lệ và không cho phép tạo (opts.newId). */
  function normalizeNote(raw, now, opts) {
    opts = opts || {};
    if (!isObj(raw)) throw new Error("Dữ liệu note không hợp lệ.");
    var id = String(raw.id || "");
    if (!T.UUID_RE.test(id)) { if (opts.newId) id = T.uid(); else throw new Error("Note thiếu id hợp lệ."); }
    var content = str(raw.content, LIM.content), created = ms(raw.created_at) || ms(raw.created) || now, updated = ms(raw.updated_at) || ms(raw.updated) || created;
    var title = str(raw.title, LIM.title).trim() || titleFromContent(content);
    var status = STATUSES.indexOf(raw.status) !== -1 ? raw.status : "active";
    return {
      id: id, title: title, content: content, created_at: created, updated_at: Math.max(updated, created), tags: normTags(raw.tags),
      status: status, kind: KINDS.indexOf(raw.kind) !== -1 ? raw.kind : "note", fav: raw.fav === true, rel: normRel(raw.rel),
      trashed_at: status === "trashed" ? (ms(raw.trashed_at) || updated) : 0, meta: normMeta(raw.meta)
    };
  }

  function newNote(o, now) {
    o = o || {};
    return normalizeNote({ id: T.uid(), title: o.title || "", content: o.content || "", tags: o.tags, kind: o.kind, rel: o.rel, meta: o.meta, created_at: now, updated_at: now }, now);
  }

  /** Thông tin nhẹ giữ trong bộ nhớ cho cả 100.000 note (không có nội dung). */
  function headOf(note, n) {
    return { n: n, id: note.id, title: note.title, tk: T.titleKey(note.title), tags: note.tags, u: note.updated_at, c: note.created_at, s: note.status, f: note.fav ? 1 : 0, k: note.kind, sn: plainSnippet(note.content, 110), len: note.content.length };
  }

  function dailyTitle(dateKey) { return dateKey; }
  /** Id CỐ ĐỊNH theo ngày (dạng uuid v4): hai thiết bị cùng mở ghi chú ngày khi đang offline tạo ra CÙNG một note → đồng bộ gộp, không đẻ bản trùng. */
  function dailyId(dateKey) {
    var h = T.hash53("daily:" + dateKey + ":a") + T.hash53("daily:" + dateKey + ":b") + T.hash53("daily:" + dateKey + ":c");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-4" + h.slice(13, 16) + "-" + "89ab".charAt(parseInt(h.charAt(16), 16) % 4) + h.slice(17, 20) + "-" + h.slice(20, 32);
  }
  var DAILY_TEMPLATE = "## Ghi chú\n\n\n## Việc đã làm\n\n\n## Học được\n\n";

  /** Hai note cùng nội dung "có ý nghĩa" không? (dùng để bỏ qua daily note chỉ còn khung mẫu) */
  function isBlank(content, template) {
    var a = String(content || "").replace(/\s+/g, ""), b = String(template || "").replace(/\s+/g, "");
    return a === "" || a === b;
  }

  /** Nhóm mối quan hệ của một note để HIỂN THỊ: cạnh ra (theo kiểu) + cạnh vào (đảo nhãn), gộp trùng cặp đối xứng.
      edges: [{from, to, type}] đã giải về id. Trả [{type, dir:'out'|'in', label, id}]. */
  function relationView(noteId, edges) {
    var out = [], seen = {};
    edges.forEach(function (e) {
      var outgoing = e.from === noteId, other = outgoing ? e.to : e.from;
      if (!other || other === noteId || (!outgoing && e.to !== noteId)) return;
      var key = (SYMMETRIC[e.type] ? "sym" : outgoing ? "o" : "i") + "|" + e.type + "|" + other;
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ type: e.type, dir: outgoing ? "out" : "in", label: REL_LABEL[e.type][outgoing ? 0 : 1], id: other });
    });
    return out;
  }

  W.notes = {
    STATUSES: STATUSES, KINDS: KINDS, REL_TYPES: REL_TYPES, LINK: LINK, REL_LABEL: REL_LABEL, SYMMETRIC: SYMMETRIC, LIM: LIM, DAILY_TEMPLATE: DAILY_TEMPLATE,
    normTag: normTag, normTags: normTags, maskCode: maskCode, parseLinks: parseLinks, rewriteLinks: rewriteLinks, plainSnippet: plainSnippet, titleFromContent: titleFromContent,
    normalizeNote: normalizeNote, newNote: newNote, headOf: headOf, dailyTitle: dailyTitle, dailyId: dailyId, isBlank: isBlank, relationView: relationView
  };
  if (typeof module !== "undefined" && module.exports) module.exports = W.notes;
})(typeof globalThis !== "undefined" ? globalThis : this);
