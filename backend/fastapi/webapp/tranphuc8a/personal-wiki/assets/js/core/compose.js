/* core/compose.js — lõi thuần của "Soạn bằng AI" (POST /ai/wiki). Không DOM, không IndexedDB, không đồng hồ ngầm → kiểm bằng node (kiem.js).

   1. Chọn ghi chú liên quan để gửi kèm (top-K, mặc định 25, tối đa 40) bằng chỉ mục cục bộ — textInfo + rank (repo.related đọc danh sách
      bài đăng rồi gọi rank). Chỉ gửi tiêu đề + tag + đoạn trích ≤ 110 ký tự (hoặc chỉ tiêu đề), ref c1…cK — không gửi id, ngày, nội dung đầy đủ.
   2. Vùng toán + liên kết: mathRanges/blankMath/defangMath/parseLinks/rewriteLinks/sealLinks/verifyLinks. PHẢI khớp bản Python
      backend/fastapi/src/application/utils/wiki_links.py — cả hai đọc chung kiem-lien-ket.json (sửa luật ở đây thì sửa cả bên kia + thêm ca).
      Không phải liên kết: trong code (notes.js maskCode) và trong toán ($$…$$, \[…\], \(…\), $…$ theo luật pandoc; không vượt dòng trống;
      dấu mở không có dấu đóng thì không mở gì). Trong toán, [[ → "[ [" và ]] → "] ]" (TeX vẽ y hệt, không ai đọc nhầm thành liên kết).
   3. Kiểm lại ngay trước khi lưu (máy chủ đã kiểm, nhưng ghi chú ứng viên có thể vừa bị đổi tên/xoá): liên kết chỉ giữ khi tiêu đề giải được
      trên máy LÚC ÁP DỤNG, là ghi chú trong cùng lô, hoặc là chủ đề mới người dùng đã giữ; còn lại thành chữ thường.
   4. plan(): bản xem trước → danh sách thao tác. AI KHÔNG sửa ghi chú cũ: mặc định tạo ghi chú mới (trùng tiêu đề thì đổi tên "… (2)");
      chỉ khi người dùng chọn rõ "Gộp vào ghi chú có sẵn" mới nối thêm mục "## Bổ sung <ngày>" vào cuối ghi chú đó.
      Hoàn tác = hàm ngược tạo bản ghi MỚI HƠN: ghi chú tạo mới → Thùng rác; phần gộp → gỡ đúng đoạn đã nối (unappend), ghi chú đã đổi thì thôi. */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  ["text", "notes", "search"].forEach(function (m) { if (!W[m] && typeof require === "function") require("./" + m + ".js"); });
  var T = W.text, N = W.notes, S = W.search;

  var LIM = { text: 12000, hint: 300, maxNotes: 5, k: 25, kMax: 40, tags: 60, candTags: 8, snippet: 110, tokens: 48, note: 40000, title: 120, rels: 12, topics: 10, reason: 160 };
  var REL_TYPES = ["link"].concat(N.REL_TYPES);
  var SHORT_TOKEN = 0.25, REL_FLOOR = 0.1;
  var SPLIT = /[^\p{L}\p{N}]+/u;
  var TYPED = /^\s*([a-z_]+)\s*::\s*([\s\S]*)$/i;

  function clamp(n, lo, hi) { n = Math.floor(+n); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; }
  function str(x) { return typeof x === "string" ? x : x == null ? "" : String(x); }
  /** Một dòng: gộp khoảng trắng, cắt độ dài. */
  function oneLine(s, max) { return str(s).replace(/\s+/g, " ").trim().slice(0, max || 160); }

  // ============================================================================================ 1. chọn ghi chú liên quan
  function words(s) { return T.fold(s).split(SPLIT).filter(Boolean); }

  /** Văn bản thô → {tokens: ≤ 48 token chỉ mục khác nhau (ưu tiên dài ≥ 3 ký tự, rồi lặp nhiều, rồi xuất hiện sớm), set: mọi từ đã gấp,
      padded: " từ từ … " (để tìm cụm "tên ghi chú" nhắc nguyên văn)}. */
  function textInfo(text) {
    var toks = S.tokenize(text), count = new Map(), first = new Map();
    for (var i = 0; i < toks.length; i++) { var t = toks[i]; count.set(t, (count.get(t) || 0) + 1); if (!first.has(t)) first.set(t, i); }
    var uniq = Array.from(count.keys()).sort(function (a, b) {
      return ((b.length >= 3) - (a.length >= 3)) || (count.get(b) - count.get(a)) || (first.get(a) - first.get(b));
    }).slice(0, LIM.tokens);
    var ws = words(text);
    return { tokens: uniq, set: new Set(ws), padded: " " + ws.join(" ") + " " };
  }

  var TK_MEMO = new Map();
  function titleWords(tk) {
    var w = TK_MEMO.get(tk);
    if (!w) { if (TK_MEMO.size > 200000) TK_MEMO.clear(); w = tk.split(SPLIT).filter(Boolean); TK_MEMO.set(tk, w); }
    return w;
  }

  /** Xếp hạng ghi chú liên quan tới văn bản. heads: Map hoặc mảng đầu note (notes.js headOf); lists: [{tok, a: danh sách entry
      (search.js: n·32 + tf·8 + cờ), idf}] — repo.related đã bỏ token quá phổ biến; info = textInfo(text); o {k}.
      Điểm = Σ idf × (tiêu đề 3 + tag 2 + nội dung 1 + 0,3·tf)  +  8 × idf lớn nhất nếu văn bản NHẮC NGUYÊN VĂN tiêu đề (≥ 3 ký tự)
             +  2 cho mỗi tag của note xuất hiện trong văn bản.
      Token 2 ký tự chỉ tính 1/4 (bỏ dấu làm "bỏ"/"bò"/"bộ" thành cùng "bo"), và chỉ giữ note có điểm ≥ 10 % note đứng đầu — không gửi
      tiêu đề/trích của ghi chú gần như không liên quan lên máy chủ.
      → [{h, score}] chỉ note đang dùng có điểm > 0, điểm giảm dần (hoà: mới sửa trước), tối đa k. */
  function rank(heads, lists, info, o) {
    o = o || {};
    var k = clamp(o.k == null ? LIM.k : o.k, 1, LIM.kMax), score = new Map(), maxIdf = 0;
    for (var i = 0; i < lists.length; i++) {
      var a = lists[i].a, idf = lists[i].idf * (lists[i].tok && lists[i].tok.length < 3 ? SHORT_TOKEN : 1);
      if (lists[i].idf > maxIdf) maxIdf = lists[i].idf;
      for (var j = 0; j < a.length; j++) {
        var e = a[j], f = e & 7, n = e >>> 5;
        score.set(n, (score.get(n) || 0) + idf * ((f & 1 ? 3 : 0) + (f & 2 ? 2 : 0) + (f & 4 ? 1 + 0.3 * ((e >>> 3) & 3) : 0)));
      }
    }
    var bonus = 8 * (maxIdf || 1), tagHit = new Map(), out = [];
    function tagIn(tag) {
      var v = tagHit.get(tag);
      if (v === undefined) {
        var ws = words(tag);
        v = ws.length === 1 ? info.set.has(ws[0]) : ws.length > 1 && info.padded.indexOf(" " + ws.join(" ") + " ") !== -1;
        tagHit.set(tag, v);
      }
      return v;
    }
    heads.forEach(function (h) {
      if (!h || h.s !== "active") return;
      var s = score.get(h.n) || 0;
      if (h.tk && h.tk.length >= 3) {
        var tw = titleWords(h.tk);
        if (tw.length && info.set.has(tw[0])) {
          var all = true;
          for (var q = 1; q < tw.length; q++) if (!info.set.has(tw[q])) { all = false; break; }
          if (all && info.padded.indexOf(" " + tw.join(" ") + " ") !== -1) s += bonus;
        }
      }
      var tags = h.tags || [];
      for (var t = 0; t < tags.length; t++) if (tagIn(tags[t])) s += 2;
      if (s > 0) out.push({ h: h, score: s });
    });
    out.sort(function (x, y) { return y.score - x.score || y.h.u - x.h.u || x.h.n - y.h.n; });
    var floor = out.length ? out[0].score * REL_FLOOR : 0, end = 0;
    while (end < out.length && end < k && out[end].score >= floor) end++;
    return out.slice(0, end);
  }

  /** Kết quả xếp hạng → ứng viên gửi máy chủ ({ref: c1…, title, tags, snippet}) + bảng ref → id để giải lại khi áp dụng.
      o {exclude: Set id người dùng bỏ chọn, titlesOnly: chỉ gửi tiêu đề}. */
  function candidates(ranked, o) {
    o = o || {};
    var list = [], refs = {};
    (ranked || []).forEach(function (r) {
      var h = r.h || r;
      if (list.length >= LIM.kMax || (o.exclude && o.exclude.has(h.id))) return;
      var ref = "c" + (list.length + 1);
      refs[ref] = h.id;
      list.push({ ref: ref, title: oneLine(h.title, 200), tags: o.titlesOnly ? [] : (h.tags || []).slice(0, LIM.candTags), snippet: o.titlesOnly ? "" : oneLine(h.sn, LIM.snippet) });
    });
    return { list: list, refs: refs };
  }

  /** 60 tag nhiều ghi chú nhất (repo.tags() đã sắp) → mảng tên tag. */
  function contextTags(tags) { return (tags || []).slice(0, LIM.tags).map(function (t) { return typeof t === "string" ? t : t.tag; }).filter(Boolean); }

  /** Thân yêu cầu POST /ai/wiki (đúng giới hạn của máy chủ). titlesOnly: không gửi cả danh sách tag của wiki. */
  function request(o) {
    o = o || {};
    return { text: str(o.text).slice(0, LIM.text), hint: oneLine(o.hint, LIM.hint), maxNotes: clamp(o.maxNotes || 1, 1, LIM.maxNotes),
      candidates: (o.candidates || []).slice(0, LIM.kMax), tags: o.titlesOnly ? [] : contextTags(o.tags) };
  }

  // ============================================================================================ 2. vùng toán + liên kết (khớp wiki_links.py)
  /** [[đầu, cuối)] của mọi vùng toán trong văn bản ĐÃ che code (notes.js maskCode). Luật nằm ở notes.js (NGUỒN DUY NHẤT trong JS; markdown.js dùng chung). */
  var mathRanges = N.mathRanges;
  function mapMath(content, fn) {
    content = str(content);
    var rs = mathRanges(N.maskCode(content)), out = "", cur = 0;
    for (var i = 0; i < rs.length; i++) { out += content.slice(cur, rs[i][0]) + fn(content.slice(rs[i][0], rs[i][1])); cur = rs[i][1]; }
    return out + content.slice(cur);
  }
  /** Văn bản với mọi vùng toán thành khoảng trắng (giữ độ dài). */
  function blankMath(content) { return mapMath(content, function (m) { return " ".repeat(m.length); }); }
  /** [[ → "[ [" và ]] → "] ]" trong toán. */
  function defangMath(content) { return mapMath(content, function (m) { return m.replace(/\[(?=\[)/g, "[ ").replace(/\](?=\])/g, "] "); }); }
  /** Mọi [[…]] ngoài code VÀ ngoài toán → [{type, title, alias, raw, index}] (như notes.js parseLinks). */
  function parseLinks(content) { return N.parseLinks(blankMath(content)); }
  function linkText(type, title, alias) { return "[[" + (type === "link" || !type ? "" : type + "::") + title + (alias ? "|" + alias : "") + "]]"; }
  /** Giữ liên kết có tiêu đề `canonical` biết (viết lại đúng chữ của nó), còn lại thành chữ thường. [[link::X]] đọc như [[X]].
      canonical(title) → tiêu đề để viết | null.  → {text, dropped: [liên kết bị gỡ, như đã viết]}. */
  function rewrite(content, links, canonical, gone) {
    var out = "", cur = 0, dropped = [];
    links.forEach(function (l) {
      var real = content.slice(l.index, l.index + l.raw.length);
      out += content.slice(cur, l.index);
      if (real !== l.raw) {
        // Đọc XUYÊN một vùng toán (bộ đọc của trang thấy toán là khoảng trắng nên `raw` có dấu cách ở chỗ văn bản có TeX): trang không vẽ được liên kết này, và
        // viết lại tiêu đề của nó sẽ xoá mất công thức. Giữ nguyên từng ký tự, chỉ bẻ dấu ngoặc — không bộ đọc nào coi `[ [x] ]` là liên kết.
        out += "[ [" + real.slice(2, -2) + "] ]"; dropped.push(real);
      } else {
        var title = l.title, mt;
        if (l.type === "link" && (mt = TYPED.exec(title)) && mt[1].toLowerCase() === "link" && mt[2].trim()) title = mt[2].trim();
        var name = canonical(title);
        out += name ? linkText(l.type, name, l.alias) : gone(l, title);
        if (!name) dropped.push(l.raw);
      }
      cur = l.index + l.raw.length;
    });
    return { text: out + content.slice(cur), dropped: dropped };
  }
  function rewriteLinks(content, canonical) {
    content = str(content);
    return rewrite(content, parseLinks(content), canonical, function (l, title) { return l.alias || title; });
  }
  /** Bước chốt trên văn bản CUỐI CÙNG (khớp wiki_links.py seal_links): mọi thứ một bộ đọc còn thấy là liên kết phải trỏ tới tiêu đề `canonical` biết; cái khác giữ chữ nhưng
      mất nghĩa dấu ngoặc: `[[X]]` → `[ [X] ]`. Hai bộ đọc, theo thứ tự: notes.js parseLinks — che code nhưng KHÔNG che toán (đồ thị, backlink, bộ vẽ) — rồi bộ đọc của
      chính trang (parseLinks ở trên, che cả toán, nên một liên kết có thể hình thành XUYÊN một vùng toán: `[[a` + `$…$` + `]]` khi một liên kết bị gỡ để hai đầu sát nhau).
      rewriteLinks đã gỡ mọi liên kết nó thấy, nhưng phép thay thế của nó có thể tạo liên kết mới: gỡ `[[Bịa]]` khỏi `[[a [[Bịa]] b]]` để lại `[[a Bịa b]]`.
      Ngoặc vẫn còn nên lượt này không tự tạo liên kết nào, chạy hai lần không đổi gì. → {text, dropped}. */
  function sealLinks(content, canonical) {
    content = str(content);
    var gone = function (l) { return "[ [" + l.raw.slice(2, -2) + "] ]"; };
    var a = rewrite(content, N.parseLinks(content), canonical, gone), b = rewrite(a.text, parseLinks(a.text), canonical, gone);
    return { text: b.text, dropped: a.dropped.concat(b.dropped) };
  }
  var VERIFY_PASSES = 4;
  /** Kiểm lại một văn bản người khác viết (câu trả lời AI): gỡ ngòi toán, viết lại, chốt — ĐÚNG thứ tự đó (khớp wiki_links.py verify_links), lặp tới khi không đổi
      (kiểm kết quả lần nữa không đổi gì; ≤ VERIFY_PASSES vòng, và việc cuối luôn là chốt — an toàn một mình). Toán trước, vì lời thay thế của một liên kết bị gỡ
      (bí danh kết thúc bằng `\`, một `$`) có thể đóng sớm một vùng toán, và liên kết mà bước kiểm đã bỏ qua vì "trong toán" sẽ thành liên kết sống; ngược lại bước chốt
      có thể mở một vùng toán mới (`\` + `[`) mà vòng sau gỡ ngòi. → {text, dropped: mọi liên kết bị gỡ như đã viết}. */
  function verifyLinks(content, canonical) {
    var text = str(content), dropped = [];
    for (var round = 0; round < VERIFY_PASSES; round++) {
      var a = rewriteLinks(defangMath(text), canonical), b = sealLinks(a.text, canonical);
      dropped = dropped.concat(a.dropped, b.dropped);
      if (b.text === text) break;
      text = b.text;
    }
    return { text: text, dropped: dropped };
  }

  // ============================================================================================ 3–4. bản xem trước → kế hoạch áp dụng
  /** Tiêu đề nối được bằng [[…]]: một dòng, không [ ] |, không # đầu. */
  function cleanTitle(s) { return str(s).replace(/[\x00-\x1f]+/g, " ").replace(/[\[\]|]+/g, " ").replace(/\s+/g, " ").trim().replace(/^#+\s*/, "").slice(0, LIM.title).trim(); }

  /** Câu trả lời của máy chủ (KHÔNG tin: máy chủ cũ, proxy…) → bản nháp xem trước sửa được. Mọi quan hệ / chủ đề mới mặc định được giữ;
      ghi chú trùng tiêu đề một ghi chú có sẵn mặc định "tạo bản mới" (không đụng ghi chú cũ). */
  function fromResult(res) {
    res = res && typeof res === "object" ? res : {};
    var notes = [], topics = [], keys = {};
    (Array.isArray(res.notes) ? res.notes : []).slice(0, LIM.maxNotes).forEach(function (n, i) {
      if (!n || typeof n !== "object") return;
      var title = cleanTitle(n.title), md = str(n.markdown).slice(0, LIM.note);
      if (!title || !md.trim()) return;
      var key = /^n[0-9]{1,2}$/.test(n.key) && !keys[n.key] ? n.key : "n" + (i + 1) + "x";
      keys[key] = 1;
      var rels = (Array.isArray(n.relations) ? n.relations : []).slice(0, LIM.rels).map(function (r) {
        var tg = r && r.target && typeof r.target === "object" ? r.target : {};
        if (!r || REL_TYPES.indexOf(r.type) === -1 || !/^(existing|batch|new)$/.test(tg.kind) || !cleanTitle(tg.title)) return null;
        return { type: r.type, target: { kind: tg.kind, ref: str(tg.ref), key: str(tg.key), title: cleanTitle(tg.title) }, reason: oneLine(r.reason, LIM.reason), on: true };
      }).filter(Boolean);
      var ex = n.existing && typeof n.existing === "object" && /^c[0-9]{1,3}$/.test(n.existing.ref) ? { ref: n.existing.ref, title: cleanTitle(n.existing.title) } : null;
      notes.push({ key: key, aiTitle: title, title: title, tags: N.normTags(n.tags).slice(0, 8), markdown: md, summary: oneLine(n.summary, 200), relations: rels, existing: ex, mode: "new", on: true });
    });
    (Array.isArray(res.newTopics) ? res.newTopics : []).slice(0, LIM.topics).forEach(function (t) {
      var title = cleanTitle(t && t.title);
      if (title && !topics.some(function (x) { return T.titleKey(x.title) === T.titleKey(title); })) topics.push({ title: title, reason: oneLine(t.reason, LIM.reason), on: true });
    });
    return { notes: notes, topics: topics, dropped: (Array.isArray(res.dropped) ? res.dropped : []).slice(0, 30).map(function (x) { return oneLine(x, 200); }).filter(Boolean),
      shrunk: res.shrunk === true, truncated: res.truncated === true };
  }

  /** Nội dung ghi chú: markdown + mục "## Liên kết" (mỗi quan hệ được giữ một dòng "- [[kiểu::Đích]] — lý do"). */
  function build(markdown, rels) {
    var md = str(markdown).trimEnd();                                // không dùng /\s+$/ — bậc hai trên một dải khoảng trắng dài
    var lines = (rels || []).map(function (r) { return "- " + linkText(r.type, r.title) + (r.reason ? " — " + oneLine(r.reason, LIM.reason).replace(/[\[\]]+/g, "") : ""); });
    return (lines.length ? md + (md ? "\n\n" : "") + "## Liên kết\n\n" + lines.join("\n") : md) + "\n";
  }

  /** Kiểm lại một markdown: toán được "gỡ ngòi", liên kết chỉ giữ khi canonical biết, rồi chốt (sealLinks). → {text, dropped}. (Tên cũ của verifyLinks.) */
  var verify = verifyLinks;

  /** Bản nháp xem trước → kế hoạch.
      draft {notes: fromResult().notes (người dùng đã sửa title/tags/markdown/on/mode, quan hệ on; existing {ref} hoặc {id} — trùng một ghi chú
             không nằm trong ứng viên thì màn xem trước tự gắn id), topics: […{title, on}], refs: {c1: id}}
      env   {resolve(title) → đầu note chưa vào thùng rác | null, head(id) → đầu note | null, today: "YYYY-MM-DD"} — trạng thái kho LÚC ÁP DỤNG.
      → {ops: [{op:"create", key, title, content, tags} | {op:"append", key, id, title, add, tags}], dropped: [...], renamed: [{from, to}]} */
  function plan(draft, env) {
    var refs = draft.refs || {}, all = draft.notes || [], notes = all.filter(function (n) { return n.on; }), dropped = [], renamed = [], taken = {}, byKey = {};
    function drop(x) { x = oneLine(x, 200); if (x && dropped.indexOf(x) === -1 && dropped.length < 30) dropped.push(x); }
    function live(id) { var hd = id && env.head(id); return hd && hd.s !== "trashed" ? hd : null; }
    all.forEach(function (n) { byKey[n.key] = n; n._final = ""; n._target = null; });
    notes.forEach(function (n) {                                 // 1. tiêu đề cuối: gộp vào note có sẵn, hoặc tạo mới với tiêu đề chưa ai dùng
      if (n.mode === "append" && n.existing) { var hd = live(n.existing.id || refs[n.existing.ref]); if (hd) { n._target = hd; n._final = hd.title; return; } }
      var base = cleanTitle(n.title) || n.aiTitle || "Chưa đặt tên", t = base, k = 2;
      while (env.resolve(t) || taken[T.titleKey(t)]) { t = base.slice(0, LIM.title - 6).trim() + " (" + k + ")"; k++; }
      if (t !== base) renamed.push({ from: base, to: t });
      taken[T.titleKey(t)] = 1; n._final = t;
    });
    var batch = {}, topicsOn = {};
    notes.forEach(function (n) { batch[T.titleKey(n._final)] = n._final; });
    (draft.topics || []).forEach(function (t) { if (t.on) topicsOn[T.titleKey(t.title)] = t.title; });
    function canonical(title) { var key = T.titleKey(title), hd; return batch[key] || ((hd = env.resolve(title)) ? hd.title : null) || topicsOn[key] || null; }
    notes.forEach(function (n) { n._md = defangMath(n.markdown); });
    notes.forEach(function (src) {                               // 2. liên kết giữa các note của lô theo tiêu đề cuối (AI viết theo tiêu đề của nó)
      if (src.aiTitle && T.titleKey(src.aiTitle) !== T.titleKey(src._final) && !env.resolve(src.aiTitle)) notes.forEach(function (n) { n._md = N.rewriteLinks(n._md, src.aiTitle, src._final); });
    });
    var ops = notes.map(function (n) {                           // 3. kiểm liên kết + quan hệ trên trạng thái kho hiện tại
      var v = rewriteLinks(n._md, canonical), rels = [], seen = {};
      v.dropped.forEach(drop);
      (n.relations || []).forEach(function (r) {
        if (!r.on || REL_TYPES.indexOf(r.type) === -1) return;
        var tg = r.target || {}, title = null, hd, b;
        if (tg.kind === "existing") title = (hd = live(refs[tg.ref])) ? hd.title : null;
        else if (tg.kind === "batch") title = (b = byKey[tg.key]) && b.on && b._final ? b._final : null;
        else if (tg.kind === "new") title = topicsOn[T.titleKey(tg.title)] || null;
        if (!title) { drop(tg.title); return; }
        var sk = r.type + "|" + T.titleKey(title);
        if (T.titleKey(title) === T.titleKey(n._final) || seen[sk]) return;
        seen[sk] = 1; rels.push({ type: r.type, title: title, reason: r.reason });
      });
      var body = build(v.text, rels), tags = N.normTags(n.tags);
      var sealed = sealLinks(body, canonical);                    // chốt trên văn bản CUỐI (cả mục "## Liên kết"): liên kết thô còn lại phải trỏ tới tiêu đề có thật
      sealed.dropped.forEach(drop); body = sealed.text;
      delete n._md;
      if (n._target) return { op: "append", key: n.key, id: n._target.id, title: n._target.title, add: "\n\n## Bổ sung " + env.today + "\n\n" + body, tags: tags };
      return { op: "create", key: n.key, title: n._final, content: body, tags: tags };
    });
    return { ops: ops, dropped: dropped, renamed: renamed };
  }

  /** Hàm ngược của "gộp": gỡ đúng đoạn `add` ở cuối nội dung. Ghi chú đã bị sửa sau đó (không còn kết thúc bằng đoạn đó) → null (không đụng). */
  function unappend(content, add) {
    content = str(content); add = str(add);
    return add && content.length >= add.length && content.slice(content.length - add.length) === add ? content.slice(0, content.length - add.length) : null;
  }

  W.compose = {
    LIM: LIM, REL_TYPES: REL_TYPES, words: words, textInfo: textInfo, rank: rank, candidates: candidates, contextTags: contextTags, request: request,
    mathRanges: mathRanges, blankMath: blankMath, defangMath: defangMath, parseLinks: parseLinks, linkText: linkText, rewriteLinks: rewriteLinks,
    sealLinks: sealLinks, verifyLinks: verifyLinks,
    cleanTitle: cleanTitle, fromResult: fromResult, build: build, verify: verify, plan: plan, unappend: unappend
  };
  if (typeof module !== "undefined" && module.exports) module.exports = W.compose;
})(typeof globalThis !== "undefined" ? globalThis : this);
