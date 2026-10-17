/* data/schema.js — các kho (object store) của IndexedDB "logic-puzzle-suite". Phải nạp TRƯỚC store.js (bản chép từ personal-wiki, đọc Puz.storeSchema).
     puzzles      puzzle đã lưu: tự nhập, yêu thích, thuộc bộ sưu tập, nhập từ tệp  { id, puzzle, name, fav, source, created, updated }
     collections  bộ sưu tập do người dùng tạo                                       { id, name, ids:[puzzleId], created, updated }
     games        ván ĐANG CHƠI dở (sống sót qua sập máy), khoá = id ván            { id, type, updated, ser: game.serialize() }
     history      mỗi ván đã kết thúc: solved | revealed | abandoned                 game.record()
     drafts       bản nháp trình soạn puzzle đang nhập dở                            { id, value, at }
     meta         thiết lập và dấu mốc ("settings", "lastBackup"…)                    { k, value } */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  P.storeSchema = {
    puzzles: { key: "id" }, collections: { key: "id" }, games: { key: "id" },
    history: { key: "id" }, drafts: { key: "id" }, meta: { key: "k" }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = P.storeSchema;
})(typeof globalThis !== "undefined" ? globalThis : this);
