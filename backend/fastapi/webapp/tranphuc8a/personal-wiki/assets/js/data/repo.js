/* repo.js — kho tri thức: note, chỉ mục tìm kiếm, liên kết, thẻ ôn, bản nháp, hàng đợi đồng bộ — trên MỘT giao diện store (IndexedDB hoặc bộ nhớ).

   Nguyên tắc
   • Mỗi thao tác ghi = MỘT giao dịch nguyên tử trên mọi kho liên quan (note + đầu note + chỉ mục + liên kết + thẻ + hàng đợi): chết giữa chừng thì không có gì nửa vời.
   • Mọi ghi được xếp hàng tuần tự (serial) nên bộ nhớ và kho luôn khớp nhau.
   • Trong RAM chỉ giữ "đầu note" (tiêu đề, tag, ngày, tóm tắt ~110 ký tự) — ~100 byte/note, đủ để liệt kê, lọc, sắp xếp 100.000 note tức thì. Nội dung nằm ở kho `notes`, đọc khi mở.
   • Chỉ mục ngược chia KHỐI theo n (8192 note/khối): note mới luôn rơi vào khối cuối ⇒ mỗi lần lưu chỉ ghi lại các khối nhỏ, không đụng danh sách của cả kho.
   • Khoá kho `tokens` = "từ\0khối"; tìm tiền tố bằng khoảng khoá của IndexedDB (không cần từ điển trong RAM). */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  ["text", "notes", "search", "flash"].forEach(function (m) { if (!W[m] && typeof require === "function") require("../core/" + m + ".js"); });
  var T = W.text, N = W.notes, S = W.search, F = W.flash;

  var CHUNK_SHIFT = 7, BLOCK_SHIFT = 13, BATCH = 1500;
  var ALL = ["notes", "heads", "tokens", "links", "cards", "changes", "drafts", "meta"];
  var TRASH_MS = N.LIM.trashDays * 86400000;
  var TOK_SEP = "\u0000";

  function pkey(tok, n) { return tok + TOK_SEP + (n >>> BLOCK_SHIFT).toString(36).padStart(4, "0"); }
  function tokOf(key) { return key.slice(0, key.indexOf(TOK_SEP)); }
  function sameNote(a, b) {
    return a.title === b.title && a.content === b.content && a.status === b.status && a.kind === b.kind && a.fav === b.fav && a.tags.join("\u0001") === b.tags.join("\u0001") &&
      JSON.stringify(a.rel) === JSON.stringify(b.rel) && JSON.stringify(a.meta) === JSON.stringify(b.meta);
  }
  function stripN(rec) { if (!rec) return rec; var o = Object.assign({}, rec); delete o.n; return o; }

  function create(store, opts) {
    opts = opts || {};
    var clock = opts.now || Date.now;
    var heads = new Map(), byId = new Map(), byKey = new Map(), tagCount = new Map(), nextN = 1, version = 0, queue = Promise.resolve(), cache = {};
    var listeners = [];

    function emit(ev) { listeners.slice().forEach(function (fn) { try { fn(ev); } catch (e) { /* người nghe lỗi không được làm hỏng kho */ } }); }
    function serial(fn) { var run = queue.then(fn); queue = run.catch(function () {}); return run; }

    // ============================================================================================ bộ nhớ (đầu note)
    function untrack(h) {
      var arr = byKey.get(h.tk);
      if (arr) { var i = arr.indexOf(h.n); if (i !== -1) arr.splice(i, 1); if (!arr.length) byKey.delete(h.tk); }
      if (h.s !== "trashed") h.tags.forEach(function (t) { var c = (tagCount.get(t) || 0) - 1; if (c > 0) tagCount.set(t, c); else tagCount.delete(t); });
    }
    function track(h, prev) {
      if (prev) untrack(prev);
      heads.set(h.n, h); byId.set(h.id, h.n);
      var arr = byKey.get(h.tk); if (!arr) byKey.set(h.tk, arr = []);
      if (arr.indexOf(h.n) === -1) { arr.push(h.n); arr.sort(function (a, b) { return a - b; }); }
      if (h.s !== "trashed") h.tags.forEach(function (t) { tagCount.set(t, (tagCount.get(t) || 0) + 1); });
      version++; cache = {};
    }
    function forget(h) { untrack(h); heads.delete(h.n); byId.delete(h.id); version++; cache = {}; }

    /** Giải tiêu đề → n của note đích (ưu tiên số nhỏ nhất, không tính thùng rác); 0 nếu chưa có. */
    function resolveKey(tk) {
      var arr = byKey.get(tk);
      if (!arr) return 0;
      for (var i = 0; i < arr.length; i++) { var h = heads.get(arr[i]); if (h && h.s !== "trashed") return arr[i]; }
      return 0;
    }

    function open() {
      return store.tx(["heads", "meta"], "r", function (t) {
        return Promise.all([t.all("heads"), t.get("meta", "nextN")]);
      }).then(function (r) {
        heads.clear(); byId.clear(); byKey.clear(); tagCount.clear(); cache = {};
        var maxN = 0;
        r[0].forEach(function (chunk) { Object.keys(chunk.h).forEach(function (k) { var h = chunk.h[k]; track(h, null); if (h.n > maxN) maxN = h.n; }); });
        nextN = Math.max(maxN + 1, (r[1] && r[1].v) || 1);
        version = 0;
        return api;
      });
    }

    /** Nạp lại đầu note từ kho (thẻ trình duyệt khác vừa ghi) rồi phát sự kiện {type:"save", remote:true} cho mọi note đã đổi. */
    function reload() {
      return serial(function () {
        var before = new Map(); heads.forEach(function (h) { before.set(h.id, h.u + ":" + h.s); });
        return open().then(function () {
          var changed = [];
          heads.forEach(function (h) { if (before.get(h.id) !== h.u + ":" + h.s) changed.push(h.id); before.delete(h.id); });
          before.forEach(function (_, id) { changed.push(id); });
          changed.forEach(function (id) { emit({ type: "save", id: id, remote: true }); });
          emit({ type: "reload", changed: changed.length });
          return changed.length;
        });
      });
    }

    // ============================================================================================ chỉ mục
    function diffTerms(oldNote, newNote) {
      var a = oldNote ? S.indexTerms(oldNote) : new Map(), b = newNote ? S.indexTerms(newNote) : new Map(), out = [];
      b.forEach(function (bits, tok) { if (a.get(tok) !== bits) out.push([tok, bits]); });
      a.forEach(function (bits, tok) { if (!b.has(tok)) out.push([tok, 0]); });
      return out;
    }
    function applyIndex(t, n, changes) {
      return Promise.all(changes.map(function (c) { return t.get("tokens", pkey(c[0], n)).then(function (rec) { return [c, rec]; }); })).then(function (rs) {
        return Promise.all(rs.map(function (x) {
          var key = pkey(x[0][0], n), arr = S.postingSet(x[1] && x[1].a, n, x[0][1]);
          if (x[1] && arr === x[1].a) return null;
          return arr.length ? t.put("tokens", { t: key, a: arr }) : t.del("tokens", key);
        }));
      });
    }

    // ============================================================================================ liên kết
    function edgeKey(from, type, to, tk) { return from + "|" + type + "|" + (to ? to : "~" + tk); }
    function computeEdges(n, note, ownTk) {
      var out = {}, add = function (type, to, tk) { var k = edgeKey(n, type, to, tk); if (!out[k]) out[k] = { k: k, from: n, to: to, tk: tk, type: type }; };
      N.parseLinks(note.content).forEach(function (l) { var tk = T.titleKey(l.title), to = resolveKey(tk); if (tk !== ownTk && to !== n) add(l.type, to, tk); });
      note.rel.forEach(function (r) { var to = byId.get(r.id); if (to && to !== n) add(r.t, to, heads.get(to).tk); });
      return Object.keys(out).map(function (k) { return out[k]; });
    }
    function replaceEdges(t, n, edges) {
      return t.byIndex("links", "from", n).then(function (old) {
        var keep = {}; edges.forEach(function (e) { keep[e.k] = 1; });
        var ops = old.filter(function (e) { return !keep[e.k]; }).map(function (e) { return t.del("links", e.k); });
        return Promise.all(ops.concat(edges.map(function (e) { return t.put("links", e); })));
      });
    }
    /** Liên kết chưa giải được tới tiêu đề `tk` → trỏ vào n (note vừa có / vừa đổi tên / vừa khôi phục). */
    function resolvePending(t, n, tk) {
      return t.byIndex("links", "tk", tk).then(function (es) {
        return Promise.all(es.filter(function (e) { return e.to === 0 && e.from !== n; }).map(function (e) {
          return t.del("links", e.k).then(function () { var ne = Object.assign({}, e, { to: n, k: edgeKey(e.from, e.type, n, tk) }); return t.put("links", ne); });
        }));
      });
    }

    // ============================================================================================ lưu một note
    function headChunk(t, n, update) {
      var c = n >> CHUNK_SHIFT;
      return t.get("heads", c).then(function (rec) { rec = rec || { c: c, h: {} }; update(rec.h); return t.put("heads", rec); });
    }
    function cardsFor(t, note, now, remote) {
      return t.byIndex("cards", "note", note.id).then(function (existing) {
        var r = F.reconcile(existing, F.extractCards(note.id, note.content), note.id, now);
        return Promise.all(r.add.concat(r.update).map(function (c) { return t.put("cards", c); }).concat(r.remove.map(function (id) { return t.del("cards", id); })));
      });
    }

    function doSave(input, o) {
      var now = o.now || clock(), prevN = input.id ? byId.get(input.id) : 0, isNew = !prevN, oldHead = prevN ? heads.get(prevN) : null, done = {};
      return store.tx(ALL, o.bulk ? "bulk" : "rw", function (t) {
        // Số thứ tự n của note MỚI lấy từ bộ đếm TRONG kho (không tin bản nhớ): hai thẻ trình duyệt cùng mở app vẫn không bao giờ cấp trùng n.
        return Promise.all([isNew ? t.get("meta", "nextN") : null, isNew ? null : t.get("notes", prevN)]).then(function (rr) {
          var old = rr[1], fresh = isNew ? Math.max(nextN, (rr[0] && rr[0].v) || 1) : 0;
          var merged = Object.assign({}, old || {}, input);
          merged.created_at = old ? old.created_at : (input.created_at || now);
          merged.updated_at = o.keepTime && input.updated_at ? input.updated_at : Math.max(now, old ? old.updated_at + 1 : 0);
          if (input.status === "trashed" && (!old || old.status !== "trashed") && !input.trashed_at) merged.trashed_at = now;
          var note = N.normalizeNote(merged, now, { newId: true });
          if (old && !o.force && sameNote(note, N.normalizeNote(old, now))) { done.same = old; return null; }
          var n = isNew ? fresh : prevN, head = N.headOf(note, n), oldNote = old ? N.normalizeNote(old, now) : null;
          done.note = note; done.head = head; done.n = n; done.old = oldNote; done.isNew = isNew;
          var tkChanged = !oldNote || oldHead.tk !== head.tk, restored = oldNote && oldNote.status === "trashed" && note.status !== "trashed";
          var work = [
            t.put("notes", Object.assign({ n: n }, note)),
            headChunk(t, n, function (h) { h[n] = head; }),
            applyIndex(t, n, diffTerms(oldNote, note)),
            replaceEdges(t, n, computeEdges(n, note, head.tk)),
            cardsFor(t, note, now, o.remote),
            t.del("drafts", note.id)
          ];
          if (isNew) work.push(t.put("meta", { k: "nextN", v: n + 1 }));
          if (!o.remote) work.push(t.put("changes", { id: "note:" + note.id, kind: "note", rid: note.id, ts: now, del: false }));
          if (note.status !== "trashed" && (isNew || tkChanged || restored)) work.push(resolvePending(t, n, head.tk));
          return Promise.all(work);
        });
      }).then(function () {
        if (done.same) return { note: stripN(done.same), changed: false };
        if (done.isNew) nextN = Math.max(nextN, done.n + 1);
        track(done.head, oldHead);
        emit({ type: "save", id: done.note.id, isNew: done.isNew, remote: !!o.remote });
        var res = { note: done.note, changed: true, renamedFrom: done.old && done.old.title !== done.note.title ? done.old.title : null };
        if (res.renamedFrom && !o.noRewrite) return rewriteBacklinks(done.n, res.renamedFrom, done.note.title, o).then(function () { return res; });
        return res;
      });
    }

    /** Đổi tên note → mọi [[Tên cũ]] trong note khác đổi theo (kể cả kiểu quan hệ và chữ hiển thị). */
    function rewriteBacklinks(n, oldTitle, newTitle, o) {
      return store.tx(["links"], "r", function (t) { return t.byIndex("links", "to", n); }).then(function (edges) {
        var from = T.uniq(edges.map(function (e) { return e.from; })).filter(function (f) { return f !== n; });
        return from.reduce(function (p, f) {
          return p.then(function () {
            return store.tx(["notes"], "r", function (t) { return t.get("notes", f); }).then(function (src) {
              if (!src) return null;
              var content = N.rewriteLinks(src.content, oldTitle, newTitle);
              return content === src.content ? null : doSave({ id: src.id, content: content }, Object.assign({}, o, { noRewrite: true }));
            });
          });
        }, Promise.resolve());
      });
    }

    function save(input, o) { return serial(function () { return doSave(input, o || {}); }); }

    // ============================================================================================ xoá hẳn
    function doRemove(id, o) {
      var n = byId.get(id), head = heads.get(n);
      if (!n) return Promise.resolve(false);
      return store.tx(ALL, "rw", function (t) {
        return t.get("notes", n).then(function (old) {
          var now = (o && o.now) || clock(), work = [
            t.del("notes", n),
            headChunk(t, n, function (h) { delete h[n]; }),
            old ? applyIndex(t, n, diffTerms(N.normalizeNote(old, now), null)) : null,
            t.byIndex("links", "from", n).then(function (es) { return Promise.all(es.map(function (e) { return t.del("links", e.k); })); }),
            t.byIndex("links", "to", n).then(function (es) {
              return Promise.all(es.filter(function (e) { return e.from !== n; }).map(function (e) {
                return t.del("links", e.k).then(function () { return t.put("links", Object.assign({}, e, { to: 0, k: edgeKey(e.from, e.type, 0, e.tk) })); });
              }));
            }),
            t.byIndex("cards", "note", id).then(function (cs) { return Promise.all(cs.map(function (c) { return t.del("cards", c.id); })); }),
            t.del("drafts", id)
          ];
          if (!(o && o.remote)) work.push(t.put("changes", { id: "note:" + id, kind: "note", rid: id, ts: now, del: true }));
          return Promise.all(work.filter(Boolean));
        });
      }).then(function () { forget(head); emit({ type: "remove", id: id }); return true; });
    }
    function removeForever(id, o) { return serial(function () { return doRemove(id, o || {}); }); }

    // ============================================================================================ đọc
    function getNote(id) {
      var n = typeof id === "number" ? id : byId.get(id);
      if (!n) return Promise.resolve(null);
      return store.tx(["notes"], "r", function (t) { return t.get("notes", n); }).then(stripN);
    }
    function getMany(ns) {
      return store.tx(["notes"], "r", function (t) { return Promise.all(ns.map(function (n) { return t.get("notes", n); })); });
    }
    function headById(id) { var n = byId.get(id); return n ? heads.get(n) : null; }
    function headByN(n) { return heads.get(n) || null; }
    function findByTitle(title) { var n = resolveKey(T.titleKey(title)); return n ? heads.get(n) : null; }

    var SORTS = {
      updated: function (a, b) { return b.u - a.u || a.n - b.n; }, created: function (a, b) { return b.c - a.c || a.n - b.n; },
      title: function (a, b) { return a.tk < b.tk ? -1 : a.tk > b.tk ? 1 : a.n - b.n; }
    };
    /** Danh sách đầu note đã lọc + sắp (được nhớ tạm theo phiên bản dữ liệu). o: {status, tag, kind, fav, sort, dir} */
    function list(o) {
      o = o || {};
      var status = o.status || "active", key = [status, o.tag || "", o.kind || "", o.fav ? 1 : 0, o.sort || "updated", o.dir || ""].join("|");
      if (cache[key]) return cache[key];
      var out = [];
      heads.forEach(function (h) {
        if (h.s !== status) return;
        if (o.tag && h.tags.indexOf(o.tag) === -1) return;
        if (o.kind && h.k !== o.kind) return;
        if (o.fav && !h.f) return;
        out.push(h);
      });
      out.sort(SORTS[o.sort || "updated"] || SORTS.updated);
      if (o.dir === "asc") out.reverse();
      return (cache[key] = out);
    }
    function tags() {
      var out = [];
      tagCount.forEach(function (c, t) { out.push({ tag: t, count: c }); });
      return out.sort(function (a, b) { return b.count - a.count || (a.tag < b.tag ? -1 : 1); });
    }
    function stats() {
      var s = { total: heads.size, active: 0, archived: 0, trashed: 0, favorites: 0, tags: tagCount.size };
      heads.forEach(function (h) { s[h.s]++; if (h.f && h.s === "active") s.favorites++; });
      return s;
    }
    /** Gợi ý tiêu đề cho ô gõ [[ — bắt đầu bằng trước, rồi chứa. */
    function suggest(prefix, limit) {
      var key = T.titleKey(prefix), a = [], b = [];
      limit = limit || 8;
      var all = list({ status: "active" });
      for (var i = 0; i < all.length && a.length < limit; i++) {
        var h = all[i], at = key ? h.tk.indexOf(key) : 0;
        if (at === 0) a.push(h); else if (at > 0 && b.length < limit) b.push(h);
      }
      return a.concat(b).slice(0, limit);
    }

    // ============================================================================================ tìm kiếm
    function termLists(t, term, expand) {
      if (!expand) return t.all("tokens", { lo: term + TOK_SEP, hi: term + TOK_SEP + "￿" }).then(function (recs) { return concat(recs); });
      return t.keys("tokens", { lo: term, hi: term + "￿", limit: 2500 }).then(function (keys) {
        var toks = T.uniq(keys.map(tokOf)).slice(0, 40);
        return Promise.all(toks.map(function (tok) { return t.all("tokens", { lo: tok + TOK_SEP, hi: tok + TOK_SEP + "￿" }).then(concat); })).then(function (ls) { return ls.length === 1 ? ls[0] : S.union(ls); });
      });
    }
    function concat(recs) {
      if (recs.length === 1) return recs[0].a;
      var len = 0, i; for (i = 0; i < recs.length; i++) len += recs[i].a.length;
      var out = new Uint32Array(len), at = 0;
      for (i = 0; i < recs.length; i++) { out.set(recs[i].a, at); at += recs[i].a.length; }
      return out;
    }
    function headOk(h, p, statuses) {
      if (statuses.indexOf(h.s) === -1) return false;
      if (p.kind && h.k !== p.kind) return false;
      if (p.fav && !h.f) return false;
      for (var i = 0; i < p.tags.length; i++) if (h.tags.indexOf(p.tags[i]) === -1) return false;
      return true;
    }

    /** → {results: [{head, score, snippet}], total, ms, parsed}. o: {limit, statuses} — mặc định chỉ note đang dùng; status:archived trong câu truy vấn đổi điều đó. */
    function search(q, o) {
      o = o || {};
      var started = (root.performance && root.performance.now) ? root.performance.now() : Date.now();
      var p = S.parseQuery(q), limit = o.limit || 50, statuses = p.status ? [p.status] : (o.statuses || ["active"]);
      if (S.isEmpty(p)) return Promise.resolve({ results: [], total: 0, ms: 0, parsed: p });
      var idxTerms = T.uniq(p.terms.filter(function (x) { return !S.STOP[x]; }));
      var phraseTokens = p.phrases.map(function (ph) { return S.tokenize(ph); });
      var needIndex = idxTerms.length || phraseTokens.some(function (l) { return l.length; });
      return store.tx(["tokens"], "r", function (t) {
        if (!needIndex) return [];
        var jobs = idxTerms.map(function (term) { return termLists(t, term, term.length >= 2); });
        phraseTokens.forEach(function (l) { l.forEach(function (tok) { jobs.push(termLists(t, tok, false)); }); });
        return Promise.all(jobs);
      }).then(function (lists) {
        var cand = new Map(), i;
        if (needIndex) {
          if (lists.every(function (l) { return l.length; })) S.intersect(lists).forEach(function (c) { cand.set(c.n, c); });
        }
        if (p.terms.length) {                                          // quét tiêu đề trong RAM: bắt từ dừng, khớp giữa từ ("loom" trong "bloom")
          heads.forEach(function (h) {
            if (cand.has(h.n)) return;
            for (var k = 0; k < p.terms.length; k++) if (h.tk.indexOf(p.terms[k]) === -1) return;
            cand.set(h.n, { n: h.n, bits: 1, tf: 0 });
          });
        }
        if (!needIndex && !p.terms.length && !p.phrases.length) {      // chỉ có bộ lọc (tag:, is:fav…)
          heads.forEach(function (h) { cand.set(h.n, { n: h.n, bits: 0, tf: 0 }); });
        }
        var rows = [];
        cand.forEach(function (c) {
          var h = heads.get(c.n);
          if (!h || !headOk(h, p, statuses)) return;
          var score = S.scoreBits(c.bits, c.tf) + (p.text && h.tk.indexOf(p.text) !== -1 ? 60 : 0) + (p.text && h.tk === p.text ? 80 : 0);
          rows.push({ h: h, score: score });
        });
        rows.sort(function (a, b) { return b.score - a.score || b.h.u - a.h.u; });
        return rows;
      }).then(function (rows) {
        var need = p.phrases.length ? rows.slice(0, 400) : rows.slice(0, limit), total = rows.length;
        return getMany(need.map(function (r) { return r.h.n; })).then(function (notes) {
          var out = [];
          need.forEach(function (r, i) {
            var note = notes[i];
            if (!note) return;
            if (p.phrases.length) {
              var hay = T.fold(note.title + "\n" + note.content).replace(/\s+/g, " ");
              if (!p.phrases.every(function (ph) { return hay.indexOf(ph) !== -1; })) return;
            }
            out.push({ head: r.h, score: r.score, snippet: S.snippet(note.content, p.terms.concat(p.phrases), 150) });
          });
          var now2 = (root.performance && root.performance.now) ? root.performance.now() : Date.now();
          return { results: out.slice(0, limit), total: p.phrases.length ? out.length : total, ms: Math.round((now2 - started) * 10) / 10, parsed: p };
        });
      });
    }

    // ============================================================================================ liên kết & đồ thị
    function allEdges(ns) {
      return store.tx(["links"], "r", function (t) {
        return Promise.all(ns.map(function (n) { return Promise.all([t.byIndex("links", "from", n), t.byIndex("links", "to", n)]); }));
      }).then(function (rs) { return [].concat.apply([], rs.map(function (r) { return r[0].concat(r[1]); })); });
    }
    /** Cạnh thẳng/ngược của một note đã đổi sang id, chỉ tính note chưa vào thùng rác. */
    function relations(id) {
      var n = byId.get(id);
      if (!n) return Promise.resolve({ items: [], ghosts: [] });
      return allEdges([n]).then(function (edges) {
        var seen = {}, resolved = [], ghosts = [];
        edges.forEach(function (e) {
          if (seen[e.k]) return; seen[e.k] = 1;
          if (e.from === n && !e.to) { ghosts.push({ title: e.tk, type: e.type }); return; }
          var other = e.from === n ? e.to : e.from, h = heads.get(other);
          if (h && h.s !== "trashed") resolved.push({ from: heads.get(e.from).id, to: heads.get(e.to).id, type: e.type });
        });
        var out = { items: N.relationView(id, resolved).map(function (r) { return Object.assign({ head: headById(r.id) }, r); }).filter(function (r) { return r.head; }), ghosts: ghosts };
        if (!ghosts.length) return out;
        return getNote(id).then(function (note) {                              // cạnh mờ chỉ nhớ khoá đã gấp (chữ thường, bỏ dấu); lấy lại cách viết gốc từ nội dung
          var shown = {};
          if (note) N.parseLinks(note.content).forEach(function (l) { shown[T.titleKey(l.title)] = l.title; });
          ghosts.forEach(function (g) { g.title = shown[g.title] || g.title; });
          return out;
        });
      });
    }
    function backlinks(id) { return relations(id).then(function (r) { return r.items.filter(function (x) { return x.dir === "in"; }); }); }

    /** Đồ thị: o.center (id) + o.depth → vùng lân cận; không center → toàn bộ, giới hạn o.limit nút có bậc cao nhất. */
    function graph(o) {
      o = o || {};
      var limit = o.limit || 1500, center = o.center ? byId.get(o.center) : 0;
      function finish(edges, ns) {
        var set = {}, deg = {}; ns.forEach(function (n) { set[n] = 1; });
        var out = [], seen = {};
        edges.forEach(function (e) {
          if (!e.to || !set[e.from] || !set[e.to] || e.from === e.to || seen[e.k]) return; seen[e.k] = 1;
          out.push({ a: e.from, b: e.to, type: e.type }); deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1;
        });
        var nodes = ns.map(function (n) { var h = heads.get(n); return { n: n, id: h.id, title: h.title, tags: h.tags, k: h.k, deg: deg[n] || 0 }; });
        return { nodes: nodes, edges: out, center: center, centerId: center ? heads.get(center).id : null, truncated: ns.length >= limit };
      }
      if (center) {
        var depth = T.clamp(o.depth || 1, 1, 4), seen = {}, frontier = [center], all = [center], edges = [];
        seen[center] = 1;
        var step = function (d) {
          if (d >= depth || !frontier.length || all.length >= limit) return Promise.resolve(finish(edges, all.slice(0, limit)));
          return allEdges(frontier).then(function (es) {
            edges = edges.concat(es);
            var next = [];
            es.forEach(function (e) { [e.from, e.to].forEach(function (n) { var h = n && heads.get(n); if (n && !seen[n] && h && h.s !== "trashed" && all.length + next.length < limit) { seen[n] = 1; next.push(n); } }); });
            all = all.concat(next); frontier = next;
            return step(d + 1);
          });
        };
        return step(0).then(function (g) { return finishEdges(g); });
      }
      return store.tx(["links"], "r", function (t) { return t.all("links"); }).then(function (es) {
        var deg = {};
        es.forEach(function (e) { if (e.to) { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; } });
        var ns = Object.keys(deg).map(Number).filter(function (n) { var h = heads.get(n); return h && h.s !== "trashed"; }).sort(function (a, b) { return deg[b] - deg[a] || a - b; }).slice(0, limit);
        return finish(es, ns);
      });
      function finishEdges(g) {   // lần cuối: nạp đủ cạnh giữa các nút đã chọn (BFS chỉ lấy cạnh của lớp trước)
        return allEdges(g.nodes.map(function (x) { return x.n; })).then(function (es) { return finish(es, g.nodes.map(function (x) { return x.n; })); });
      }
    }

    // ============================================================================================ nháp, daily, tag
    function saveDraft(d) {
      var rec = { id: d.id, note: d.note, base: d.base || 0, saved_at: clock() };
      return store.tx(["drafts"], "rw", function (t) { return t.put("drafts", rec); });
    }
    function getDraft(id) { return store.tx(["drafts"], "r", function (t) { return t.get("drafts", id); }); }
    function listDrafts() { return store.tx(["drafts"], "r", function (t) { return t.all("drafts"); }); }
    function dropDraft(id) { return store.tx(["drafts"], "rw", function (t) { return t.del("drafts", id); }); }

    /** Ghi chú ngày: có rồi thì trả về; chưa có thì trả bản ẢO (chưa lưu cho tới khi người dùng gõ gì đó ngoài khung mẫu). */
    function daily(dateKey) {
      var id = N.dailyId(dateKey), h = headById(id);
      if (h) return getNote(id).then(function (n) { return { note: n, virtual: false }; });
      var note = N.normalizeNote({ id: id, title: N.dailyTitle(dateKey), content: N.DAILY_TEMPLATE, tags: ["daily"], kind: "daily", created_at: clock(), updated_at: clock() }, clock());
      return Promise.resolve({ note: note, virtual: true });
    }

    function retag(from, to) {
      var ids = [];
      heads.forEach(function (h) { if (h.tags.indexOf(from) !== -1) ids.push(h.id); });
      return ids.reduce(function (p, id) {
        return p.then(function () {
          return getNote(id).then(function (n) {
            var tags = n.tags.filter(function (x) { return x !== from; });
            if (to) tags.push(to);
            return save({ id: id, tags: N.normTags(tags) });
          });
        });
      }, Promise.resolve()).then(function () { return ids.length; });
    }
    function renameTag(from, to) { to = N.normTag(to); return to ? retag(from, to) : Promise.reject(new Error("Tên tag không hợp lệ.")); }
    function deleteTag(tag) { return retag(tag, null); }

    // ============================================================================================ thẻ ôn
    function dueCards(o) {
      o = o || {};
      var now = o.now || clock();
      return store.tx(["cards"], "r", function (t) { return t.all("cards"); }).then(function (cs) {
        var out = cs.filter(function (c) {
          var h = headById(c.note);
          return h && h.s === "active" && (!o.tag || h.tags.indexOf(o.tag) !== -1) && (o.all || c.due <= now);
        });
        out.sort(function (a, b) { return a.due - b.due; });
        return o.limit ? out.slice(0, o.limit) : out;
      });
    }
    function cardStats(now) {
      now = now || clock();
      return store.tx(["cards"], "r", function (t) { return t.all("cards"); }).then(function (cs) {
        var s = { total: 0, due: 0, fresh: 0 };
        cs.forEach(function (c) { var h = headById(c.note); if (!h || h.s !== "active") return; s.total++; if (c.due <= now) s.due++; if (!c.reps) s.fresh++; });
        return s;
      });
    }
    function review(cardId, grade) {
      return serial(function () {
        return store.tx(["cards", "changes"], "rw", function (t) {
          return t.get("cards", cardId).then(function (c) {
            if (!c) throw new Error("Không còn thẻ này (câu hỏi đã bị sửa hoặc xoá).");
            var next = F.schedule(c, grade, clock());
            return Promise.all([t.put("cards", next), t.put("changes", { id: "card:" + cardId, kind: "card", rid: cardId, ts: next.updated_at, del: false })]).then(function () { return next; });
          });
        }).then(function (next) { emit({ type: "card", id: cardId }); return next; });         // để huy hiệu "thẻ đến hạn" cập nhật
      });
    }
    function notesCards(id) { return store.tx(["cards"], "r", function (t) { return t.byIndex("cards", "note", id); }); }

    // ============================================================================================ duyệt toàn bộ, nhập hàng loạt
    /** Duyệt MỌI note theo lô (không nạp hết vào RAM): cb(batch[]) có thể trả Promise. */
    function forEachNote(cb, o) {
      o = o || {};
      var size = o.batch || 500, cursor = 0, total = 0;
      function next() {
        return store.tx(["notes"], "r", function (t) { return t.all("notes", { lo: cursor, limit: size }); }).then(function (rows) {
          if (!rows.length) return total;
          cursor = rows[rows.length - 1].n + 1; total += rows.length;
          return Promise.resolve(cb(rows.map(stripN))).then(next);
        });
      }
      return next();
    }
    function allCards() { return store.tx(["cards"], "r", function (t) { return t.all("cards"); }); }

    /** Nhập nhiều note MỚI cùng lúc (id chưa có). Pha 1: note + đầu + chỉ mục + thẻ. Pha 2: liên kết (khi mọi tiêu đề đã có để giải). */
    function bulkAdd(list, o) {
      o = o || {};
      return serial(function () {
        var startN = nextN, added = 0, notes = list.map(function (x) { return N.normalizeNote(x, clock(), { newId: true }); }).filter(function (n) { return !byId.has(n.id); });
        var seenIds = {}; notes = notes.filter(function (n) { if (seenIds[n.id]) return false; seenIds[n.id] = 1; return true; });
        var i = 0;
        function phase1() {
          if (i >= notes.length) return Promise.resolve();
          var slice = notes.slice(i, i + BATCH), base = nextN, newHeads = [];
          return store.tx(ALL, "bulk", function (t) { return t.get("meta", "nextN").then(function (mn) {
            base = Math.max(nextN, (mn && mn.v) || 1); newHeads = [];
            var chunks = new Map(), posts = new Map(), puts = [], cardPuts = [], nowT = clock();
            slice.forEach(function (note, k) {
              var n = base + k, head = N.headOf(note, n);
              newHeads.push(head);
              puts.push(t.put("notes", Object.assign({ n: n }, note)));
              var c = n >> CHUNK_SHIFT; if (!chunks.has(c)) chunks.set(c, {}); chunks.get(c)[n] = head;
              S.indexTerms(note).forEach(function (bits, tok) { var key = pkey(tok, n), a = posts.get(key); if (!a) posts.set(key, a = []); a.push([n, bits]); });
              F.extractCards(note.id, note.content).forEach(function (cd) { cardPuts.push(t.put("cards", F.newCard(cd, note.id, nowT))); });
            });
            var work = puts.concat(cardPuts);
            chunks.forEach(function (hs, c) { work.push(t.get("heads", c).then(function (rec) { rec = rec || { c: c, h: {} }; Object.assign(rec.h, hs); return t.put("heads", rec); })); });
            posts.forEach(function (batch, key) { work.push(t.get("tokens", key).then(function (rec) { return t.put("tokens", { t: key, a: S.postingMerge(rec && rec.a, batch) }); })); });
            work.push(t.put("meta", { k: "nextN", v: base + slice.length }));
            return Promise.all(work);
          }); }).then(function () {
            newHeads.forEach(function (h) { track(h, null); });
            nextN = base + slice.length; added += slice.length; i += BATCH;
            if (o.onProgress) o.onProgress({ phase: 1, done: added, total: notes.length });
            return phase1();
          });
        }
        function phase2(from) {
          if (from >= nextN) return Promise.resolve();
          var to = Math.min(from + BATCH, nextN);
          return store.tx(["notes", "links"], "bulk", function (t) {
            return t.all("notes", { lo: from, hi: to - 1 }).then(function (rows) {
              var ops = [];
              rows.forEach(function (rec) { var h = heads.get(rec.n); if (h) computeEdges(rec.n, rec, h.tk).forEach(function (e) { ops.push(t.put("links", e)); }); });
              return Promise.all(ops);
            });
          }).then(function () { if (o.onProgress) o.onProgress({ phase: 2, done: to - startN, total: nextN - startN }); return phase2(to); });
        }
        return phase1().then(function () { return phase2(startN); }).then(function () { emit({ type: "bulk", added: added }); return added; });
      });
    }

    /** Xoá sạch kho (dùng khi khôi phục kiểu "thay thế"). Giữ nguyên `meta` ngoài bộ đếm n (cài đặt đồng bộ, mã thiết bị). */
    function wipe() {
      return serial(function () {
        return store.tx(ALL, "rw", function (t) {
          return Promise.all(["notes", "heads", "tokens", "links", "cards", "changes", "drafts"].map(function (n) { return t.clear(n); }).concat([t.del("meta", "nextN")]));
        }).then(function () { heads.clear(); byId.clear(); byKey.clear(); tagCount.clear(); nextN = 1; version++; cache = {}; emit({ type: "wipe" }); });
      });
    }

    /** Dọn thùng rác: note vào thùng quá 30 ngày thì xoá hẳn. */
    function purgeTrash(now) {
      now = now || clock();
      var ids = [];
      heads.forEach(function (h) { if (h.s === "trashed" && now - (h.u || 0) > TRASH_MS) ids.push(h.id); });
      return ids.reduce(function (p, id) { return p.then(function () { return removeForever(id); }); }, Promise.resolve()).then(function () { return ids.length; });
    }

    // ============================================================================================ meta + hàng đợi đồng bộ
    function getMeta(k) { return store.tx(["meta"], "r", function (t) { return t.get("meta", k); }).then(function (r) { return r ? r.v : undefined; }); }
    function setMeta(k, v) { return store.tx(["meta"], "rw", function (t) { return t.put("meta", { k: k, v: v }); }); }
    function pendingChanges(limit) { return store.tx(["changes"], "r", function (t) { return t.all("changes", { limit: limit || 200 }); }); }
    function pendingCount() { return store.tx(["changes"], "r", function (t) { return t.count("changes"); }); }
    function getCard(id) { return store.tx(["cards"], "r", function (t) { return t.get("cards", id); }); }
    /** Xếp một note/thẻ vào hàng đợi đồng bộ (vd bản cục bộ mới hơn bản xoá vừa nhận về nên phải gửi lại). */
    function queueChange(kind, id) {
      return serial(function () { return store.tx(["changes"], "rw", function (t) { return t.put("changes", { id: kind + ":" + id, kind: kind, rid: id, ts: clock(), del: false }); }); });
    }
    function ackChanges(done) {
      // chỉ xoá mục chưa bị ghi đè sau lúc gửi (ts khớp) — thay đổi mới hơn phải được gửi ở lượt sau
      return serial(function () {
        return store.tx(["changes"], "rw", function (t) {
          return Promise.all(done.map(function (d) { return t.get("changes", d.id).then(function (c) { return c && c.ts === d.ts ? t.del("changes", d.id) : null; }); }));
        });
      });
    }
    function markAllChanged() {
      return serial(function () {
        var ts = clock();
        return forEachNote(function (batch) {
          return store.tx(["changes"], "bulk", function (t) { return Promise.all(batch.map(function (n) { return t.put("changes", { id: "note:" + n.id, kind: "note", rid: n.id, ts: ts, del: false }); })); });
        }).then(function () { return allCards(); }).then(function (cs) {
          return store.tx(["changes"], "bulk", function (t) { return Promise.all(cs.filter(function (c) { return c.reps > 0; }).map(function (c) { return t.put("changes", { id: "card:" + c.id, kind: "card", rid: c.id, ts: ts, del: false }); })); });
        });
      });
    }
    /** Áp thẻ ôn từ máy chủ: chỉ nhận nếu mới hơn bản cục bộ và thẻ còn tồn tại (note chứa nó đã có ở máy này). */
    function applyCard(raw) {
      return serial(function () {
        return store.tx(["cards"], "rw", function (t) {
          var c = F.normalizeCard(raw, clock());
          // thẻ mới sinh ở máy này (chưa ôn lần nào) luôn nhường lịch ôn đã có ở nơi khác, dù giờ sinh thẻ muộn hơn giờ ôn
          return t.get("cards", c.id).then(function (cur) { if (!cur || (cur.reps > 0 && cur.updated_at >= c.updated_at) || (cur.reps === 0 && c.reps === 0)) return false; return t.put("cards", Object.assign({}, cur, { due: c.due, ease: c.ease, interval: c.interval, reps: c.reps, lapses: c.lapses, updated_at: c.updated_at })).then(function () { return true; }); });
        });
      });
    }

    var api = {
      open: open, reload: reload, on: function (fn) { listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }; }, store: store, now: clock,
      save: save, removeForever: removeForever, bulkAdd: bulkAdd, get: getNote, getMany: getMany, head: headById, headByN: headByN, findByTitle: findByTitle, resolve: function (title) { var n = resolveKey(T.titleKey(title)); return n ? heads.get(n) : null; },
      list: list, tags: tags, stats: stats, suggest: suggest, search: search, relations: relations, backlinks: backlinks, graph: graph,
      saveDraft: saveDraft, getDraft: getDraft, listDrafts: listDrafts, dropDraft: dropDraft, daily: daily, renameTag: renameTag, deleteTag: deleteTag,
      wipe: wipe, dueCards: dueCards, cardStats: cardStats, review: review, notesCards: notesCards, allCards: allCards, forEachNote: forEachNote, purgeTrash: purgeTrash,
      getMeta: getMeta, setMeta: setMeta, pendingChanges: pendingChanges, pendingCount: pendingCount, getCard: getCard, queueChange: queueChange, ackChanges: ackChanges, markAllChanged: markAllChanged, applyCard: applyCard,
      size: function () { return heads.size; }, version: function () { return version; },
      setStatus: function (id, status) { return save({ id: id, status: status }); },
      toggleFav: function (id) { var h = headById(id); return save({ id: id, fav: !(h && h.f) }); }
    };
    return api;
  }

  W.repo = { create: create, pkey: pkey, TRASH_MS: TRASH_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = W.repo;
})(typeof globalThis !== "undefined" ? globalThis : this);
