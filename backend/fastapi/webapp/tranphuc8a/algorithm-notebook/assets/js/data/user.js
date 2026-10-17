/* data/user.js — dữ liệu của người dùng (IndexedDB, local-first): thư viện cá nhân, ghi chú, template, bookmark + tiến độ, lịch ôn thẻ, lịch sử Quiz.
   Mọi thứ nạp hết vào RAM lúc mở (10.000 mục cá nhân vẫn nhỏ) nên đọc là đồng bộ; ghi đi qua giao dịch IndexedDB nguyên tử rồi mới cập nhật RAM,
   nên tắt máy giữa chừng không bao giờ để lại trạng thái nửa vời. Bản nháp (drafts) giữ chữ đang soạn qua sập máy. */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var T = A.text, C = A.catalog, SRS = A.srs;
  var STATUS = ["Chưa học", "Đang học", "Đã học", "Thành thạo"];
  var LIM = { note: 100000, tpl: 200000, templates: 2000, quiz: 2000 };

  function create(store, opt) {
    opt = opt || {};
    var clock = opt.now || function () { return Date.now(); };
    var items = new Map(), notes = new Map(), templates = new Map(), marks = new Map(), srs = new Map(), quiz = [], listeners = [];

    function emit(ev) { listeners.slice().forEach(function (f) { try { f(ev); } catch (e) { /* người nghe lỗi không làm hỏng kho */ } }); }
    function sync() { C.setUser(Array.from(items.values())); }

    function open() {
      return store.tx(["items", "notes", "templates", "marks", "srs", "quiz"], "r", function (t) {
        return Promise.all([t.all("items"), t.all("notes"), t.all("templates"), t.all("marks"), t.all("srs"), t.all("quiz")]);
      }).then(function (r) {
        items = new Map(r[0].map(function (x) { return [x.id, x]; }));
        notes = new Map(r[1].map(function (x) { return [x.id, x]; }));
        templates = new Map(r[2].map(function (x) { return [x.id, x]; }));
        marks = new Map(r[3].map(function (x) { return [x.id, x]; }));
        srs = new Map(r[4].map(function (x) { return [x.id, x]; }));
        quiz = r[5].sort(function (a, b) { return a.at - b.at; });
        sync();
        return api;
      });
    }
    function put(storeName, map, rec, ev) {
      return store.tx([storeName], "rw", function (t) { return t.put(storeName, rec); }).then(function () { map.set(rec.id, rec); emit(ev); return rec; });
    }
    function del(storeName, map, id, ev) {
      return store.tx([storeName], "rw", function (t) { return t.del(storeName, id); }).then(function () { map.delete(id); emit(ev); return true; });
    }

    // ------------------------------------------------------------------------------------------ thư viện cá nhân
    function saveItem(raw) {
      var old = raw && items.get(raw.id), rec = C.normalizeItem(Object.assign({}, old || {}, raw), clock());
      if (old) rec.created = old.created;
      rec.updated = Math.max(clock(), old ? old.updated + 1 : 0);
      return store.tx(["items", "drafts"], "rw", function (t) { return Promise.all([t.put("items", rec), t.del("drafts", "item:" + rec.id)]); }).then(function () { items.set(rec.id, rec); sync(); emit({ type: "item", id: rec.id, isNew: !old }); return rec; });
    }
    function removeItem(id) {
      var ids = [id];
      return store.tx(["items", "notes", "marks", "drafts"], "rw", function (t) {
        return Promise.all([t.del("items", id), t.del("notes", id), t.del("marks", id), t.del("drafts", "item:" + id), t.del("drafts", "note:" + id)]);
      }).then(function () { items.delete(id); notes.delete(id); marks.delete(id); sync(); emit({ type: "item", id: id, removed: true }); return ids.length; });
    }

    // ------------------------------------------------------------------------------------------ ghi chú cá nhân
    function saveNote(id, text) {
      text = String(text || "").slice(0, LIM.note);
      if (!text.trim()) return deleteNote(id);
      var rec = { id: id, text: text, updated: clock() };
      return store.tx(["notes", "drafts"], "rw", function (t) { return Promise.all([t.put("notes", rec), t.del("drafts", "note:" + id)]); }).then(function () { notes.set(id, rec); emit({ type: "note", id: id }); return rec; });
    }
    function deleteNote(id) {
      return store.tx(["notes", "drafts"], "rw", function (t) { return Promise.all([t.del("notes", id), t.del("drafts", "note:" + id)]); }).then(function () { notes.delete(id); emit({ type: "note", id: id, removed: true }); return null; });
    }

    // ------------------------------------------------------------------------------------------ nháp (chữ đang soạn, sống sót qua sập máy)
    function saveDraft(key, value) { return store.tx(["drafts"], "rw", function (t) { return t.put("drafts", { id: key, value: value, at: clock() }); }); }
    function getDraft(key) { return store.tx(["drafts"], "r", function (t) { return t.get("drafts", key); }); }
    function dropDraft(key) { return store.tx(["drafts"], "rw", function (t) { return t.del("drafts", key); }); }
    function listDrafts() { return store.tx(["drafts"], "r", function (t) { return t.all("drafts"); }); }

    // ------------------------------------------------------------------------------------------ template
    function saveTemplate(raw) {
      var old = raw && raw.id && templates.get(raw.id), title = String(raw.title || "").trim().slice(0, 80);
      if (!title) return Promise.reject(new Error("Hãy đặt tên tệp (vd template.cpp)."));
      if (!old && templates.size >= LIM.templates) return Promise.reject(new Error("Đã đủ " + LIM.templates + " template."));
      var rec = { id: old ? old.id : "t-" + T.uid(), title: title, lang: A.lib.LANGS[raw.lang] ? raw.lang : "cpp", src: String(raw.src || "").slice(0, LIM.tpl), tags: C.tagList(raw.tags), algo: typeof raw.algo === "string" ? raw.algo.slice(0, 80) : "", created: old ? old.created : clock(), updated: clock() };
      return store.tx(["templates", "drafts"], "rw", function (t) { return Promise.all([t.put("templates", rec), t.del("drafts", "tpl:" + rec.id)]); }).then(function () { templates.set(rec.id, rec); emit({ type: "template", id: rec.id }); return rec; });
    }
    function removeTemplate(id) { return del("templates", templates, id, { type: "template", id: id, removed: true }); }

    // ------------------------------------------------------------------------------------------ bookmark + tiến độ
    function mark(id) { return marks.get(id) || { id: id, bm: 0, st: 0, at: 0 }; }
    function setMark(id, patch) {
      var cur = mark(id), rec = Object.assign({}, cur, patch, { id: id, at: clock() });
      rec.st = Math.max(0, Math.min(3, rec.st | 0)); rec.bm = rec.bm ? 1 : 0;
      if (!rec.bm && !rec.st) return del("marks", marks, id, { type: "mark", id: id });
      return put("marks", marks, rec, { type: "mark", id: id });
    }

    // ------------------------------------------------------------------------------------------ flashcard
    function cardState(id) { return srs.get(id) || null; }
    function review(id, grade) {
      var now = clock(), next = SRS.schedule(srs.get(id) || SRS.fresh(id, now), grade, now);
      return put("srs", srs, next, { type: "card", id: id }).then(function () { return next; });
    }

    // ------------------------------------------------------------------------------------------ quiz
    function logQuiz(rec) {
      rec = Object.assign({}, rec, { id: "q" + clock() + "-" + Math.floor(Math.random() * 1e6), at: clock() });
      return store.tx(["quiz"], "rw", function (t) { return t.put("quiz", rec); }).then(function () {
        quiz.push(rec);
        if (quiz.length > LIM.quiz) { var drop = quiz.splice(0, quiz.length - LIM.quiz); store.tx(["quiz"], "rw", function (t) { return Promise.all(drop.map(function (d) { return t.del("quiz", d.id); })); }); }
        emit({ type: "quiz" }); return rec;
      });
    }

    // ------------------------------------------------------------------------------------------ meta
    function getMeta(k) { return store.tx(["meta"], "r", function (t) { return t.get("meta", k); }).then(function (r) { return r ? r.v : undefined; }); }
    function setMeta(k, v) { return store.tx(["meta"], "rw", function (t) { return t.put("meta", { k: k, v: v }); }); }

    // ------------------------------------------------------------------------------------------ sao lưu
    function dump() {
      return { items: Array.from(items.values()), notes: Array.from(notes.values()), templates: Array.from(templates.values()), marks: Array.from(marks.values()), srs: Array.from(srs.values()), quiz: quiz.slice() };
    }
    /** Nạp dữ liệu từ bản sao lưu. mode "merge": gộp, bản có `updated`/`at` mới hơn thắng; "replace": xoá hết rồi nạp. */
    function restore(d, mode) {
      d = d || {};
      var plan = { items: [], notes: [], templates: [], marks: [], srs: [], quiz: [] }, stat = { added: 0, updated: 0, skipped: 0 };
      function consider(kind, map, list, valid, stamp) {
        (Array.isArray(list) ? list : []).forEach(function (x) {
          if (!x || typeof x.id !== "string" || !valid(x)) { stat.skipped++; return; }
          var cur = map.get(x.id);
          if (cur && mode !== "replace" && (cur[stamp] || 0) >= (x[stamp] || 0)) { stat.skipped++; return; }
          plan[kind].push(x); if (cur && mode !== "replace") stat.updated++; else stat.added++;
        });
      }
      consider("items", items, d.items, function (x) { return /^u-[0-9a-f-]{36}$/.test(x.id) && x.name; }, "updated");
      consider("notes", notes, d.notes, function (x) { return typeof x.text === "string"; }, "updated");
      consider("templates", templates, d.templates, function (x) { return /^t-[0-9a-f-]{36}$/.test(x.id) && x.title; }, "updated");
      consider("marks", marks, d.marks, function (x) { return x.bm || x.st; }, "at");
      consider("srs", srs, d.srs, function (x) { return typeof x.due === "number"; }, "updated");
      consider("quiz", new Map(quiz.map(function (q) { return [q.id, q]; })), d.quiz, function (x) { return typeof x.at === "number"; }, "at");
      var all = ["items", "notes", "templates", "marks", "srs", "quiz"];
      return store.tx(all, "bulk", function (t) {
        var ops = [];
        if (mode === "replace") all.forEach(function (n) { ops.push(t.clear(n)); });
        var norm = { items: function (x) { return Object.assign(C.normalizeItem(x, clock()), { id: x.id, created: x.created || clock(), updated: x.updated || clock() }); } };
        all.forEach(function (n) { plan[n].forEach(function (x) { ops.push(t.put(n, norm[n] ? norm[n](x) : x)); }); });
        return Promise.all(ops);
      }).then(function () { return open(); }).then(function () { emit({ type: "restore" }); return stat; });
    }
    function wipe() {
      return store.tx(["items", "notes", "templates", "marks", "srs", "quiz", "drafts"], "rw", function (t) {
        return Promise.all(["items", "notes", "templates", "marks", "srs", "quiz", "drafts"].map(function (n) { return t.clear(n); }));
      }).then(function () { items.clear(); notes.clear(); templates.clear(); marks.clear(); srs.clear(); quiz = []; sync(); emit({ type: "wipe" }); });
    }

    var api = {
      store: store, open: open, on: function (f) { listeners.push(f); return function () { var i = listeners.indexOf(f); if (i !== -1) listeners.splice(i, 1); }; }, now: clock,
      items: function () { return Array.from(items.values()); }, item: function (id) { return items.get(id) || null; }, saveItem: saveItem, removeItem: removeItem,
      note: function (id) { return notes.get(id) || null; }, notes: function () { return Array.from(notes.values()); }, saveNote: saveNote,
      saveDraft: saveDraft, getDraft: getDraft, dropDraft: dropDraft, listDrafts: listDrafts,
      templates: function () { return Array.from(templates.values()); }, template: function (id) { return templates.get(id) || null; }, saveTemplate: saveTemplate, removeTemplate: removeTemplate,
      mark: mark, marks: function () { return Array.from(marks.values()); }, setMark: setMark, isBookmarked: function (id) { return !!(marks.get(id) && marks.get(id).bm); }, status: function (id) { return mark(id).st; },
      cardState: cardState, cards: function () { return Array.from(srs.values()); }, review: review,
      quizLog: function () { return quiz.slice(); }, logQuiz: logQuiz, getMeta: getMeta, setMeta: setMeta,
      dump: dump, restore: restore, wipe: wipe
    };
    return api;
  }

  A.user = { create: create, STATUS: STATUS, LIM: LIM };
  if (typeof module !== "undefined" && module.exports) module.exports = A.user;
})(typeof globalThis !== "undefined" ? globalThis : this);
