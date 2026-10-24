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

  /** Bỏ mọi '-', '.', '/' ở hai đầu — bằng tay: regex /^[-./]+|[-./]+$/g bậc hai trên một dải './' dài ("a" + "./"×20.000 + "b" mất 4 giây). */
  function trimTagEdges(s) {
    var a = 0, b = s.length;
    while (a < b && "-./".indexOf(s.charAt(a)) !== -1) a++;
    while (b > a && "-./".indexOf(s.charAt(b - 1)) !== -1) b--;
    return s.slice(a, b);
  }
  /** Tag: thường, bỏ #, khoảng trắng → '-', chỉ chữ/số/_-./ ; tối đa 40 ký tự. */
  function normTag(t) {
    t = trimTagEdges(String(t == null ? "" : t).normalize("NFC").toLowerCase().trim().replace(/^#+/, "").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_\-./]/gu, "").replace(/-{2,}/g, "-"));
    return t.slice(0, LIM.tag);
  }
  function normTags(list) {
    if (typeof list === "string") list = list.split(/[,\n]/);
    return T.uniq((Array.isArray(list) ? list : []).map(normTag).filter(Boolean)).slice(0, LIM.tags);
  }

  /** Một dòng với các đoạn `code` nội tuyến thành khoảng trắng (cùng độ dài). Luật gốc là regex /(`+)(?!`)([^\n]*?[^`\n])\1(?!`)/g, bậc hai
      trên một dải dấu huyền dài (20.000 dấu: 2,8 giây MỖI lần gọi, mà AI soạn tới 40.000 ký tự) — đây là đúng kết quả đó trong một lượt, cùng thuật
      toán với wiki_links.py `mask_inline_code` (kiem.js so với regex gốc trên hàng nghìn dòng ngẫu nhiên). Với mỗi dải dấu huyền, thử các hậu tố dài
      trước (cả dải, rồi bỏ dấu đầu…): hậu tố dài m mở một đoạn khi có một dải SAU đó trên dòng đúng m dấu — đoạn kết thúc ở dải gần nhất như vậy.
      Hậu tố không mở gì thì giữ nguyên dấu huyền. */
  function maskInlineCode(line) {
    if (line.indexOf("`") === -1) return line;
    var starts = [], sizes = [], bySize = {}, seen = {}, m, re = /`+/g;      // bySize[độ dài] = chỉ số các dải có độ dài đó, theo thứ tự
    while ((m = re.exec(line))) { (bySize[m[0].length] || (bySize[m[0].length] = [])).push(starts.length); starts.push(m.index); sizes.push(m[0].length); }
    var out = "", cursor = 0, i = 0;
    while (i < starts.length) {
      var start = starts[i], size = sizes[i], nxt = i + 1;
      for (var want = size; want > 0; want--) {
        var later = bySize[want];
        if (!later) continue;
        var p = seen[want] || 0;                                             // seen[độ dài]: dải đầu tiên của độ dài đó chưa bị bỏ qua
        while (p < later.length && later[p] <= i) p++;
        seen[want] = p;
        if (p < later.length) {
          var j = later[p], a = start + size - want, b = starts[j] + want;
          out += line.slice(cursor, a) + " ".repeat(b - a);
          cursor = b; nxt = j + 1;
          break;
        }
      }
      i = nxt;
    }
    return cursor ? out + line.slice(cursor) : line;
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
        out.push(maskInlineCode(ln));
      }
    }
    return out.join("\n");
  }

  // ----------------------------------------------------------------------------------------------- vùng toán
  // NGUỒN DUY NHẤT của luật vùng toán trong JS (markdown.js dựng công thức, compose.js che toán khi quét [[liên kết]], parseLinks bên dưới).
  // PHẢI khớp bản Python `application/utils/wiki_links.py math_ranges`; hai bản chạy chung `kiem-lien-ket.json`. Đổi luật ⇒ sửa cả hai + thêm ca.
  // Luật: `\(…\)`, `\[…\]`, `$$…$$` và `$…$` (luật pandoc: sau `$` mở không được là khoảng trắng; `$` đóng không đứng sau khoảng trắng và không
  // được theo sau bởi chữ số hay `$` khác), tất cả trong CÙNG đoạn (không vượt dòng trống); `\$` và `\\(` không phải dấu; dấu mở không có dấu đóng thì
  // KHÔNG mở gì (một `$` lạc không nuốt phần còn lại). Tuyến tính: mỗi loại dấu đóng nhớ chỗ tìm hỏng.
  function isWS(c) { return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v"; }
  function blankLineAfter(s, k) {
    var n = s.length, m = k + 1;
    while (m < n && (s[m] === " " || s[m] === "\t" || s[m] === "\r")) m++;
    return m < n && s[m] === "\n";
  }
  /** Tìm dấu đóng `kind` (")", "]", "$$", "$") từ p, trong cùng đoạn. → [chỉ số sau dấu đóng (với "$": chỉ số CỦA nó), -1] hoặc [-1, chỗ dừng]. */
  function scanClose(s, p, kind) {
    var n = s.length, k = p;
    while (k < n) {
      var c = s[k];
      if (c === "\n" && blankLineAfter(s, k)) return [-1, k];
      if (c === "\\") {
        var j = k;
        while (j < n && s[j] === "\\") j++;
        if ((j - k) % 2 === 1 && j < n) {
          if ((kind === ")" || kind === "]") && s[j] === kind) return [j + 1, -1];
          k = j + 1; continue;                                   // ký tự bị thoát, không bao giờ là dấu
        }
        k = j; continue;
      }
      if (c === "$") {
        if (kind === "$$") { if (k + 1 < n && s[k + 1] === "$") return [k + 2, -1]; }
        else if (kind === "$") return [k, -1];
      }
      k++;
    }
    return [-1, n];
  }
  /** [[đầu, cuối)] của mọi vùng toán trong văn bản ĐÃ che code (maskCode). Không chồng lấn, theo thứ tự. */
  function mathRanges(masked) {
    var s = masked, n = s.length, i = 0, out = [], failed = {};
    if (s.indexOf("$") === -1 && s.indexOf("\\") === -1) return out;
    while (i < n) {
      var c = s[i];
      if (c === "\\") {
        var j = i;
        while (j < n && s[j] === "\\") j++;
        if ((j - i) % 2 === 1 && j < n) {
          var d = s[j];
          if (d === "(" || d === "[") {
            var close = d === "(" ? ")" : "]";
            if (j + 1 > (close in failed ? failed[close] : -1)) {
              var r = scanClose(s, j + 1, close);
              if (r[0] !== -1) { out.push([j - 1, r[0]]); i = r[0]; continue; }
              failed[close] = r[1];
            }
          }
          i = j + 1; continue;
        }
        i = j; continue;
      }
      if (c === "$") {
        if (i + 1 < n && s[i + 1] === "$") {
          if (i + 2 > ("$$" in failed ? failed.$$ : -1)) {
            var r2 = scanClose(s, i + 2, "$$");
            if (r2[0] !== -1) { out.push([i, r2[0]]); i = r2[0]; continue; }
            failed.$$ = r2[1];
          }
          i += 2; continue;
        }
        if (i + 1 < n && !isWS(s[i + 1])) {
          var k = scanClose(s, i + 1, "$")[0];
          if (k !== -1 && !(k + 1 < n && s[k + 1] === "$") && !isWS(s[k - 1]) && !(k + 1 < n && s[k + 1] >= "0" && s[k + 1] <= "9")) {
            out.push([i, k + 1]); i = k + 1; continue;
          }
        }
        i++; continue;
      }
      i++;
    }
    return out;
  }

  var LINK_RE = /\[\[([^\[\]\n]{1,300})\]\]/g;
  /** Mọi [[…]] ngoài code VÀ ngoài vùng toán → [{type, title, alias, raw, index}]. Tiền tố `kiểu::` chỉ được nhận khi kiểu hợp lệ.
      (Trước W4 toán chưa được che: `$[[0,1]]$` thành liên kết "0,1" trong đồ thị trong khi trang hiện công thức.) */
  function parseLinks(content) {
    var masked = maskCode(content), out = [], m, rs = mathRanges(masked);
    if (rs.length) {                                                         // vùng toán thành khoảng trắng cùng độ dài: chỉ số `index` vẫn đúng trên nội dung gốc
      var blanked = "", cur = 0;
      rs.forEach(function (r) { blanked += masked.slice(cur, r[0]) + " ".repeat(r[1] - r[0]); cur = r[1]; });
      masked = blanked + masked.slice(cur);
    }
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
    normTag: normTag, normTags: normTags, maskCode: maskCode, maskInlineCode: maskInlineCode, mathRanges: mathRanges, parseLinks: parseLinks, rewriteLinks: rewriteLinks, plainSnippet: plainSnippet, titleFromContent: titleFromContent,
    normalizeNote: normalizeNote, newNote: newNote, headOf: headOf, dailyTitle: dailyTitle, dailyId: dailyId, isBlank: isBlank, relationView: relationView
  };
  if (typeof module !== "undefined" && module.exports) module.exports = W.notes;
})(typeof globalThis !== "undefined" ? globalThis : this);
