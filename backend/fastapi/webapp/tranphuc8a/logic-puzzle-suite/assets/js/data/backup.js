/* data/backup.js — sao lưu và khôi phục.
   Sao lưu  backup_YYYYMMDD.zip: manifest.json {app, v, created_at, counts} + data.json (puzzle đã lưu, bộ sưu tập, ván dở, lịch sử, thiết lập).
            Khôi phục kiểm dấu app + phiên bản, số lượng khớp manifest, CRC-32 từng tệp (zip.js); phần tử hỏng bị bỏ qua và đếm (user.restore).
   Việc xuất puzzle ra JSON/TXT/CSV là của core/files.js. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var T = P.text, Z = P.zip;
  var APP = "logic-puzzle-suite", VERSION = 1;

  function fail(msg, code) { var e = new Error(msg); e.code = code || "backup"; return e; }
  function stamp(ms) { return T.dateKey(ms).replace(/-/g, ""); }

  function build(user, o) {
    o = o || {};
    var now = (o.now || user.now)(), data = user.dump();
    var counts = { puzzles: data.puzzles.length, collections: data.collections.length, games: data.games.length, history: data.history.length };
    var manifest = { app: APP, v: VERSION, created_at: new Date(now).toISOString(), counts: counts };
    return Z.create([{ name: "manifest.json", data: JSON.stringify(manifest, null, 2) }, { name: "data.json", data: JSON.stringify(data) }], { deflate: o.deflate !== false, date: now })
      .then(function (blob) { return { blob: blob, name: "backup_" + stamp(now) + ".zip", counts: counts, manifest: manifest }; });
  }

  /** Đọc + kiểm tệp sao lưu → { manifest, data }. Chưa đụng vào kho. */
  function parseBackup(bytes) {
    return Z.read(bytes).then(function (files) {
      var by = {}; files.forEach(function (f) { by[f.name] = f; });
      if (!by["manifest.json"]) throw fail("Không phải tệp sao lưu của Logic Puzzle Suite (thiếu manifest.json).", "not_backup");
      return Promise.all([by["manifest.json"].text(), by["data.json"] ? by["data.json"].text() : Promise.resolve("")]).then(function (t) {
        var manifest, data;
        try { manifest = JSON.parse(t[0]); } catch (e) { throw fail("manifest.json hỏng.", "bad_manifest"); }
        if (!manifest || manifest.app !== APP) throw fail("Tệp này là sao lưu của ứng dụng khác.", "wrong_app");
        if (!(manifest.v >= 1) || manifest.v > VERSION) throw fail("Tệp sao lưu từ phiên bản mới hơn — hãy cập nhật ứng dụng.", "too_new");
        try { data = JSON.parse(t[1]); } catch (e) { throw fail("data.json hỏng hoặc thiếu.", "bad_data"); }
        Object.keys(manifest.counts || {}).forEach(function (k) {
          if (!Array.isArray(data[k]) || data[k].length !== manifest.counts[k]) throw fail("Sao lưu thiếu dữ liệu: “" + k + "” khai " + manifest.counts[k] + " mục nhưng có " + (Array.isArray(data[k]) ? data[k].length : 0) + ".", "count_mismatch");
        });
        return { manifest: manifest, data: data };
      });
    });
  }

  /** Đọc tệp sao lưu rồi nạp vào kho. mode: "merge" (mặc định) | "replace". → kết quả của user.restore. */
  function restoreBytes(user, bytes, mode) { return parseBackup(bytes).then(function (r) { return user.restore(r.data, mode || "merge"); }); }

  P.backup = { build: build, parseBackup: parseBackup, restoreBytes: restoreBytes, APP: APP, VERSION: VERSION };
  if (typeof module !== "undefined" && module.exports) module.exports = P.backup;
})(typeof globalThis !== "undefined" ? globalThis : this);
