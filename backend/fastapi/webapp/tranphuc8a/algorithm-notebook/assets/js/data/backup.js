/* data/backup.js — sao lưu, khôi phục, xuất.
   Sao lưu  backup_YYYYMMDD.zip: manifest.json {app, v, created_at, counts} + data.json (mục của tôi, ghi chú, template, bookmark/tiến độ, lịch ôn thẻ, lịch sử quiz).
            Khôi phục kiểm dấu app + phiên bản, số lượng khớp manifest, CRC-32 từng tệp (zip.js); phần tử hỏng bị bỏ qua và đếm (user.restore).
   Xuất     JSON (toàn bộ thư viện + dữ liệu của tôi) · Markdown ZIP (mỗi thuật toán một .md theo thư mục nhóm + cheatsheet.md + templates/) · từng mục ra .md. */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var T = A.text, Z = A.zip, C = A.catalog, lib = A.lib;
  var APP = "algorithm-notebook", VERSION = 1, ENC = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  var EXT = { cpp: "cpp", py: "py", js: "js", java: "java" };

  function iso(ms) { return new Date(ms).toISOString(); }
  function stamp(ms) { return T.dateKey(ms).replace(/-/g, ""); }
  function fail(msg, code) { var e = new Error(msg); e.code = code || "backup"; return e; }
  function safeName(s) {
    var n = String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 80);
    return !n ? "untitled" : /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n) ? "_" + n : n;
  }

  // ----------------------------------------------------------------------------------------------- sao lưu
  function build(user, o) {
    o = o || {};
    var now = (o.now || user.now)(), data = user.dump();
    var manifest = { app: APP, v: VERSION, created_at: iso(now), counts: { items: data.items.length, notes: data.notes.length, templates: data.templates.length, marks: data.marks.length, srs: data.srs.length, quiz: data.quiz.length } };
    return Z.create([{ name: "manifest.json", data: JSON.stringify(manifest, null, 2) }, { name: "data.json", data: JSON.stringify(data) }], { deflate: o.deflate !== false, date: now })
      .then(function (blob) { return { blob: blob, name: "backup_" + stamp(now) + ".zip", counts: manifest.counts, manifest: manifest }; });
  }

  /** Đọc + kiểm tệp sao lưu → {manifest, data}. Chưa đụng vào kho. */
  function parseBackup(bytes) {
    return Z.read(bytes).then(function (files) {
      var by = {}; files.forEach(function (f) { by[f.name] = f; });
      if (!by["manifest.json"]) throw fail("Không phải tệp sao lưu của Algorithm Notebook (thiếu manifest.json).", "not_backup");
      return Promise.all([by["manifest.json"].text(), by["data.json"] ? by["data.json"].text() : Promise.resolve("")]).then(function (t) {
        var manifest, data;
        try { manifest = JSON.parse(t[0]); } catch (e) { throw fail("manifest.json hỏng.", "bad_manifest"); }
        if (!manifest || manifest.app !== APP) throw fail("Tệp này là sao lưu của ứng dụng khác.", "wrong_app");
        if (!(manifest.v >= 1) || manifest.v > VERSION) throw fail("Tệp sao lưu từ phiên bản mới hơn — hãy cập nhật ứng dụng.", "too_new");
        try { data = JSON.parse(t[1]); } catch (e) { throw fail("data.json hỏng hoặc thiếu.", "bad_data"); }
        Object.keys(manifest.counts || {}).forEach(function (k) { if (!Array.isArray(data[k]) || data[k].length !== manifest.counts[k]) throw fail("Sao lưu thiếu dữ liệu: \"" + k + "\" khai " + manifest.counts[k] + " mục nhưng đọc được " + (Array.isArray(data[k]) ? data[k].length : 0) + ".", "short"); });
        return { manifest: manifest, data: data };
      });
    });
  }
  function restore(user, bytes, o) { return parseBackup(bytes).then(function (r) { return user.restore(r.data, (o && o.mode) || "merge").then(function (stat) { stat.manifest = r.manifest; return stat; }); }); }

  // ----------------------------------------------------------------------------------------------- Markdown của một mục
  function fence(code) { var ticks = "```"; while (code.indexOf(ticks) !== -1) ticks += "`"; return ticks; }
  function list(a) { return (a || []).map(function (x) { return "- " + x; }).join("\n"); }
  /** Một thuật toán → Markdown (front-matter + các mục + mã + ví dụ + bài tập + ghi chú cá nhân). */
  function entryToMarkdown(e, note) {
    var cx = e.complexity || {}, out = ["---", "id: " + e.id, "name: " + JSON.stringify(e.name), "category: " + e.category, "level: " + e.level, "tags: [" + (e.tags || []).map(function (t) { return JSON.stringify(t); }).join(", ") + "]", "---", "", "# " + e.name, "", e.summary ? "> " + e.summary : "", ""];
    function sec(title, body) { if (body && String(body).trim()) out.push("## " + title, "", String(body).trim(), ""); }
    sec("Mô tả", e.description);
    sec("Điều kiện áp dụng", list(e.conditions));
    sec("Độ phức tạp", ["- Thời gian: `" + (cx.time || "—") + "`", cx.space ? "- Bộ nhớ: `" + cx.space + "`" : "", cx.note ? "- Ghi chú: " + cx.note : ""].filter(Boolean).join("\n") + ((e.ops || []).length ? "\n\n| Thao tác | Độ phức tạp |\n|---|---|\n" + e.ops.map(function (o) { return "| " + o[0] + " | `" + o[1] + "` |"; }).join("\n") : ""));
    sec("Khi nào dùng", list(e.use_case));
    sec("Khi nào KHÔNG dùng", list(e.not_for));
    sec("Lỗi thường gặp", list(e.pitfalls));
    if (e.code) { var f = fence(e.code.src); sec("Code (" + (lib.LANGS[e.code.lang] || e.code.lang) + ") — " + e.code.title, f + e.code.lang + "\n" + e.code.src.replace(/\n$/, "") + "\n" + f); }
    if (e.example) sec("Ví dụ", "Input:\n\n```\n" + e.example.input + "\n```\n\nOutput:\n\n```\n" + e.example.output + "\n```" + (e.example.explain ? "\n\n" + e.example.explain : ""));
    sec("Bài tập liên quan", (e.problems || []).map(function (p) { var u = lib.problemUrl(p); return "- " + (lib.SITES[p.site] || p.site) + ": " + (u ? "[" + p.name + "](" + u + ")" : p.name) + (lib.problemVerified(p) ? "" : " _(chưa kiểm)_"); }).join("\n"));
    sec("Liên quan", (e.related || []).map(function (id) { var r = C.get(id); return r ? "- [[" + r.name + "]]" : ""; }).filter(Boolean).join("\n"));
    if (e.origin) sec("Nguồn", e.origin + (e.link ? " — " + e.link : ""));
    if (note && note.text) sec("Ghi chú của tôi", note.text);
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }
  /** Cheat sheet (ngắn gọn) của một danh sách mục → Markdown. */
  function cheatToMarkdown(entries, title) {
    var out = ["# " + (title || "Cheat Sheet"), ""], by = {};
    entries.forEach(function (e) { (by[e.category] = by[e.category] || []).push(e); });
    lib.CATEGORIES.concat([C.MINE]).forEach(function (c) {
      if (!by[c.id]) return;
      out.push("## " + c.name, "");
      by[c.id].forEach(function (e) {
        var cx = e.complexity || {};
        out.push("### " + e.name, "", "- **Thời gian:** `" + (cx.time || "—") + "`" + (cx.space ? " · **Bộ nhớ:** `" + cx.space + "`" : ""));
        (e.ops || []).forEach(function (o) { out.push("- " + o[0] + ": `" + o[1] + "`"); });
        if ((e.use_case || [])[0]) out.push("- **Dùng khi:** " + e.use_case[0]);
        if ((e.not_for || [])[0]) out.push("- **Không dùng khi:** " + e.not_for[0]);
        out.push("");
      });
    });
    return out.join("\n");
  }

  // ----------------------------------------------------------------------------------------------- xuất
  function exportJson(user, o) {
    o = o || {};
    var now = (o.now || user.now)(), mine = user.dump();
    var body = { app: APP, v: VERSION, exported_at: iso(now), algorithms: o.mineOnly ? mine.items : C.all(), mine: mine };
    return Promise.resolve({ blob: new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }), name: "algorithm-notebook_" + stamp(now) + ".json" });
  }
  function exportMarkdown(user, o) {
    o = o || {};
    var now = (o.now || user.now)(), used = {}, entries = [];
    C.all().forEach(function (e) {
      var folder = safeName(C.catName(e.category)), base = safeName(e.name), name = folder + "/" + base + ".md", n = 2;
      while (used[name.toLowerCase()]) name = folder + "/" + base + " (" + n++ + ").md";
      used[name.toLowerCase()] = 1; entries.push({ name: name, data: entryToMarkdown(e, user.note(e.id)) });
    });
    entries.push({ name: "cheatsheet.md", data: cheatToMarkdown(C.all(), "Cheat Sheet — Algorithm Notebook") });
    user.templates().forEach(function (t) { var nm = "templates/" + safeName(t.title); if (!/\.[a-z0-9]+$/i.test(nm)) nm += "." + (EXT[t.lang] || "txt"); entries.push({ name: nm, data: t.src }); });
    return Z.create(entries, { deflate: o.deflate !== false, date: now }).then(function (blob) { return { blob: blob, name: "algorithm-notebook-markdown_" + stamp(now) + ".zip", count: entries.length }; });
  }
  function exportTemplates(user, o) {
    var now = ((o || {}).now || user.now)(), used = {};
    var entries = user.templates().map(function (t) {
      var nm = safeName(t.title); if (!/\.[a-z0-9]+$/i.test(nm)) nm += "." + (EXT[t.lang] || "txt");
      var base = nm, n = 2; while (used[nm.toLowerCase()]) nm = base.replace(/(\.[^.]+)$/, " (" + n++ + ")$1"); used[nm.toLowerCase()] = 1;
      return { name: nm, data: t.src };
    });
    return Z.create(entries, { deflate: true, date: now }).then(function (blob) { return { blob: blob, name: "templates_" + stamp(now) + ".zip", count: entries.length }; });
  }

  A.backup = { APP: APP, VERSION: VERSION, build: build, parseBackup: parseBackup, restore: restore, exportJson: exportJson, exportMarkdown: exportMarkdown, exportTemplates: exportTemplates, entryToMarkdown: entryToMarkdown, cheatToMarkdown: cheatToMarkdown, safeName: safeName, stamp: stamp };
  if (typeof module !== "undefined" && module.exports) module.exports = A.backup;
})(typeof globalThis !== "undefined" ? globalThis : this);
