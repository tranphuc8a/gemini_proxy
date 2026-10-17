/* backup.js — sao lưu / khôi phục / xuất.

   Sao lưu  backup_YYYYMMDD.zip:  manifest.json {app, v, created_at, counts}  ·  notes.jsonl (mỗi dòng một note)  ·  cards.jsonl (lịch ôn)
            Khôi phục kiểm: dấu app + phiên bản, số dòng khớp manifest, CRC-32 từng tệp (do zip.js), từng note qua normalizeNote (dòng hỏng bị đếm và báo, không làm hỏng cả bản khôi phục).
   Xuất     JSON (một tệp) · Markdown ZIP (mỗi note một .md có front-matter, xếp thư mục theo loại/trạng thái, tên tệp an toàn cho Windows/macOS/Linux).
   Nhập     Markdown (.md / .zip có .md): đọc front-matter (id, title, tags, status, kind, favorite, created, updated), không có thì lấy tên tệp làm tiêu đề. */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  ["text", "notes", "flash", "zip"].forEach(function (m) { if (!W[m] && typeof require === "function") require((m === "zip" ? "./" : "../core/") + m + ".js"); });
  var T = W.text, N = W.notes, F = W.flash, Z = W.zip;
  var APP = "personal-wiki", VERSION = 1, ENC = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

  function enc(s) { return ENC ? ENC.encode(s) : T.bytes(s); }
  function iso(ms) { return new Date(ms).toISOString(); }
  function stamp(ms) { return T.dateKey(ms).replace(/-/g, ""); }
  function fail(msg, code) { var e = new Error(msg); e.code = code || "backup"; return e; }

  // ----------------------------------------------------------------------------------------------- sao lưu
  function build(repo, o) {
    o = o || {};
    var now = (o.now || repo.now)(), noteChunks = [], count = 0;
    return repo.forEachNote(function (batch) {
      var lines = batch.map(function (n) { count++; return JSON.stringify(n) + "\n"; }).join("");
      noteChunks.push(enc(lines));
      if (o.onProgress) o.onProgress({ done: count, total: repo.size() });
    }, { batch: 800 }).then(function () { return repo.allCards(); }).then(function (cards) {
      var cardLines = cards.filter(function (c) { return c.reps > 0 || c.lapses > 0; }).map(function (c) { return JSON.stringify(c) + "\n"; });
      var manifest = { app: APP, v: VERSION, created_at: iso(now), counts: { notes: count, cards: cardLines.length } };
      return Z.create([
        { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
        { name: "notes.jsonl", data: noteChunks.length ? noteChunks : [new Uint8Array(0)] },
        { name: "cards.jsonl", data: cardLines.join("") }
      ], { deflate: o.deflate !== false, date: now }).then(function (blob) { return { blob: blob, name: "backup_" + stamp(now) + ".zip", counts: manifest.counts, manifest: manifest }; });
    });
  }

  /** Đọc từng dòng của một chuỗi byte lớn mà không giữ cả chuỗi: cb(dòng) — dừng nếu cb trả false. */
  function eachLine(bytes, cb) {
    var dec = new TextDecoder("utf-8"), step = 4 * 1024 * 1024, rest = "";
    for (var at = 0; at < bytes.length; at += step) {
      rest += dec.decode(bytes.subarray(at, Math.min(bytes.length, at + step)), { stream: at + step < bytes.length });
      var from = 0, nl;
      while ((nl = rest.indexOf("\n", from)) !== -1) { var line = rest.slice(from, nl); from = nl + 1; if (line && cb(line) === false) return; }
      rest = rest.slice(from);
    }
    if (rest.trim()) cb(rest);
  }

  /** Đọc + kiểm tệp sao lưu → {manifest, notes[], cards[], bad[]}. Chưa đụng vào kho. */
  function parseBackup(bytes, o) {
    return Z.read(bytes, o).then(function (entries) {
      var by = {}; entries.forEach(function (e) { by[e.name] = e; });
      if (!by["manifest.json"]) throw fail("Đây không phải tệp sao lưu của Personal Wiki (thiếu manifest.json).", "not_backup");
      return by["manifest.json"].text().then(function (txt) {
        var manifest; try { manifest = JSON.parse(txt); } catch (e) { throw fail("manifest.json bị hỏng.", "not_backup"); }
        if (!manifest || manifest.app !== APP) throw fail("Tệp này không phải sao lưu của Personal Wiki.", "not_backup");
        if (!(manifest.v >= 1 && manifest.v <= VERSION)) throw fail("Sao lưu tạo bởi phiên bản mới hơn (v" + manifest.v + ") — hãy cập nhật ứng dụng.", "too_new");
        return Promise.all([by["notes.jsonl"] ? by["notes.jsonl"].bytes() : new Uint8Array(0), by["cards.jsonl"] ? by["cards.jsonl"].bytes() : new Uint8Array(0)]).then(function (r) {
          var notes = [], cards = [], bad = [], lines = 0, now = Date.now();
          eachLine(r[0], function (line) {
            lines++;
            try { notes.push(N.normalizeNote(JSON.parse(line), now)); } catch (e) { if (bad.length < 20) bad.push("dòng " + lines + ": " + e.message); }
          });
          eachLine(r[1], function (line) { try { cards.push(F.normalizeCard(JSON.parse(line), now)); } catch (e) { /* thẻ hỏng bỏ qua */ } });
          var expect = manifest.counts && manifest.counts.notes;
          if (typeof expect === "number" && expect !== lines) throw fail("Sao lưu không đủ: manifest ghi " + expect + " note nhưng tệp có " + lines + " dòng.", "count_mismatch");
          return { manifest: manifest, notes: notes, cards: cards, bad: bad, lines: lines };
        });
      });
    });
  }

  /** Nạp một danh sách note vào kho theo kiểu gộp: id chưa có → thêm hàng loạt; id đã có → chỉ đè khi bản mới HƠN (updated_at). */
  function importNotes(repo, notes, o) {
    o = o || {};
    var fresh = [], newer = [], skipped = 0;
    notes.forEach(function (n) {
      var h = repo.head(n.id);
      if (!h) fresh.push(n); else if (n.updated_at > h.u) newer.push(n); else skipped++;
    });
    return repo.bulkAdd(fresh, { onProgress: o.onProgress }).then(function () {
      return newer.reduce(function (pr, n) { return pr.then(function () { return repo.save(n, { keepTime: true, force: true }); }); }, Promise.resolve());
    }).then(function () { return { added: fresh.length, updated: newer.length, skipped: skipped }; });
  }

  /** Khôi phục vào kho. mode "merge" (mặc định): note có id trùng chỉ bị đè khi bản trong tệp MỚI hơn; "replace": xoá hết rồi nạp. → số liệu. */
  function restore(repo, bytes, o) {
    o = o || {};
    var mode = o.mode === "replace" ? "replace" : "merge";
    return parseBackup(bytes, o).then(function (p) {
      var wipe = mode === "replace" ? repo.wipe() : Promise.resolve();
      return wipe.then(function () { return importNotes(repo, p.notes, o); }).then(function (r) {
        return p.cards.reduce(function (pr, c) { return pr.then(function () { return repo.applyCard(c); }); }, Promise.resolve()).then(function () {
          return { added: r.added, updated: r.updated, skipped: r.skipped, bad: p.bad, cards: p.cards.length, mode: mode, created_at: p.manifest.created_at };
        });
      });
    });
  }

  // ----------------------------------------------------------------------------------------------- xuất JSON
  function exportJson(repo, o) {
    o = o || {};
    var parts = ['{"app":"' + APP + '","v":' + VERSION + ',"exported_at":"' + iso((o.now || repo.now)()) + '","notes":[\n'], first = true;
    return repo.forEachNote(function (batch) {
      parts.push(batch.map(function (n) { var s = (first ? "" : ",\n") + JSON.stringify(n); first = false; return s; }).join(""));
    }, { batch: 800 }).then(function () { return repo.allCards(); }).then(function (cards) {
      parts.push('\n],"cards":' + JSON.stringify(cards.filter(function (c) { return c.reps > 0; })) + "}\n");
      return { blob: new Blob(parts, { type: "application/json" }), name: "personal-wiki_" + stamp((o.now || repo.now)()) + ".json" };
    });
  }

  // ----------------------------------------------------------------------------------------------- Markdown
  var RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  /** Tên tệp an toàn mọi hệ điều hành: bỏ ký tự cấm, dấu chấm/cách ở cuối, tên thiết bị Windows; ≤ 100 ký tự. */
  function safeName(title) {
    var s = String(title || "").normalize("NFC").replace(/[\u0000-\u001f\u007f\\/:*?"<>|#^\[\]]+/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+|[. ]+$/g, "");
    s = Array.from(s).slice(0, 100).join("").trim();
    if (!s || RESERVED.test(s)) s = "note" + (s ? " " + s : "");
    return s;
  }
  function yamlStr(s) { return JSON.stringify(String(s)); }

  function toMarkdownFile(note, titleOf) {
    var fm = ["---", "id: " + note.id, "title: " + yamlStr(note.title), "tags: [" + note.tags.map(yamlStr).join(", ") + "]", "status: " + note.status, "kind: " + note.kind];
    if (note.fav) fm.push("favorite: true");
    fm.push("created: " + iso(note.created_at), "updated: " + iso(note.updated_at));
    var meta = Object.keys(note.meta || {});
    if (meta.length) { fm.push("meta:"); meta.forEach(function (k) { fm.push("  " + k + ": " + yamlStr(note.meta[k])); }); }
    if (note.rel.length) {
      fm.push("relations:");
      note.rel.forEach(function (r) { fm.push("  - " + r.t + ": " + yamlStr(titleOf(r.id) || r.id)); });
    }
    fm.push("---", "");
    return fm.join("\n") + note.content + (note.content.endsWith("\n") ? "" : "\n");
  }

  /** Tệp .md cho mọi note (đang dùng + lưu trữ; thùng rác bỏ qua). Thư mục: notes/ daily/ books/ archive/. */
  function exportMarkdown(repo, o) {
    o = o || {};
    var now = (o.now || repo.now)(), used = {}, entries = [], titles = {};
    return repo.forEachNote(function (batch) { batch.forEach(function (n) { titles[n.id] = n.title; }); }, { batch: 800 }).then(function () {
      return repo.forEachNote(function (batch) {
        batch.forEach(function (n) {
          if (n.status === "trashed") return;
          var dir = n.status === "archived" ? "archive" : n.kind === "daily" ? "daily" : (n.kind === "book" || n.kind === "chapter" || n.kind === "quote") ? "books" : "notes";
          var base = safeName(n.title), name = dir + "/" + base + ".md", k = 2;
          while (used[name.toLowerCase()]) name = dir + "/" + base + " (" + k++ + ").md";
          used[name.toLowerCase()] = 1;
          entries.push({ name: name, data: toMarkdownFile(n, function (id) { return titles[id]; }) });
        });
      }, { batch: 800 });
    }).then(function () {
      return Z.create(entries, { deflate: o.deflate !== false, date: now }).then(function (blob) { return { blob: blob, name: "personal-wiki-markdown_" + stamp(now) + ".zip", count: entries.length }; });
    });
  }

  function unq(s) { s = String(s).trim(); if (/^".*"$/.test(s)) { try { return JSON.parse(s); } catch (e) { return s.slice(1, -1); } } return s.replace(/^'(.*)'$/, "$1"); }
  /** Front-matter YAML đơn giản (khoá: giá trị, danh sách [a, b], khối meta/relations) → {data, body}. Không có thì data = {}. */
  function parseFrontMatter(text) {
    var m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
    if (!m) return { data: {}, body: text };
    var data = {}, block = null;
    m[1].split(/\r?\n/).forEach(function (ln) {
      var sub = /^\s{2,}(?:-\s+)?([\w]+):\s*(.*)$/.exec(ln);
      if (sub && block) {
        if (block === "relations") (data.relations = data.relations || []).push({ t: sub[1], title: unq(sub[2]) });
        else (data.meta = data.meta || {})[sub[1]] = unq(sub[2]);
        return;
      }
      var kv = /^([\w]+):\s*(.*)$/.exec(ln);
      if (!kv) return;
      block = null;
      if (kv[2] === "" && (kv[1] === "meta" || kv[1] === "relations")) { block = kv[1]; return; }
      if (/^\[.*\]$/.test(kv[2].trim())) {
        var inner = kv[2].trim().slice(1, -1), items = [], cur = "", q = false;
        for (var i = 0; i < inner.length; i++) { var ch = inner.charAt(i); if (ch === '"' && inner.charAt(i - 1) !== "\\") q = !q; if (ch === "," && !q) { items.push(cur); cur = ""; } else cur += ch; }
        if (cur.trim()) items.push(cur);
        data[kv[1]] = items.map(unq).filter(Boolean);
      } else data[kv[1]] = unq(kv[2]);
    });
    return { data: data, body: text.slice(m[0].length) };
  }

  /** Một tệp .md → note (chưa lưu). Tiêu đề: front-matter → dòng # đầu → tên tệp. */
  function noteFromMarkdown(name, text, now) {
    var fm = parseFrontMatter(String(text).replace(/^﻿/, "")), d = fm.data, base = name.replace(/^.*\//, "").replace(/\.(md|markdown|txt)$/i, "");
    var ms = function (s) { var t = Date.parse(s); return isFinite(t) ? t : 0; };
    return N.normalizeNote({
      id: T.UUID_RE.test(String(d.id || "")) ? d.id : "", title: d.title || base, content: fm.body.replace(/^\s*\n/, ""), tags: d.tags, status: d.status, kind: d.kind, fav: d.favorite === "true",
      created_at: ms(d.created), updated_at: ms(d.updated), meta: d.meta
    }, now, { newId: true });
  }

  /** Nhập .md hoặc .zip chứa .md → {notes[], skipped[]}. */
  function importMarkdown(files, now) {
    var notes = [], skipped = [];
    return files.reduce(function (p, f) {
      return p.then(function () {
        if (/\.zip$/i.test(f.name)) {
          return f.bytes().then(function (b) { return Z.read(b); }).then(function (entries) {
            return entries.filter(function (e) { return /\.(md|markdown)$/i.test(e.name) && e.name.indexOf("__MACOSX/") !== 0; }).reduce(function (q, e) {
              return q.then(function () { return e.text().then(function (t) { notes.push(noteFromMarkdown(e.name, t, now)); }, function (er) { skipped.push(e.name + ": " + er.message); }); });
            }, Promise.resolve());
          });
        }
        return f.text().then(function (t) { notes.push(noteFromMarkdown(f.name, t, now)); });
      });
    }, Promise.resolve()).then(function () { return { notes: notes, skipped: skipped }; });
  }

  W.backup = { build: build, parseBackup: parseBackup, restore: restore, importNotes: importNotes, exportJson: exportJson, exportMarkdown: exportMarkdown, importMarkdown: importMarkdown, safeName: safeName, parseFrontMatter: parseFrontMatter, noteFromMarkdown: noteFromMarkdown, toMarkdownFile: toMarkdownFile, APP: APP, VERSION: VERSION };
  if (typeof module !== "undefined" && module.exports) module.exports = W.backup;
})(typeof globalThis !== "undefined" ? globalThis : this);
