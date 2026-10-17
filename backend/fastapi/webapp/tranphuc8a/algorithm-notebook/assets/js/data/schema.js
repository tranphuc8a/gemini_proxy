/* data/schema.js — các kho (object store) của IndexedDB "algorithm-notebook". Phải nạp TRƯỚC store.js (bản chép từ personal-wiki, đọc Algo.storeSchema).
     items      thư viện cá nhân: thuật toán / kiến thức người dùng tự thêm (cùng hình dạng mục dựng sẵn)
     notes      ghi chú cá nhân (markdown), khoá = id thuật toán (dựng sẵn hoặc của tôi)
     templates  Template Manager: các tệp code người dùng lưu
     marks      dấu theo từng thuật toán: bookmark + trạng thái học (0 chưa học … 3 thành thạo)
     srs        lịch ôn flashcard (SM-2) theo id thẻ
     quiz       lịch sử làm Quiz
     drafts     bản nháp ghi chú / mục / template đang soạn (sống sót khi sập máy)
     meta       thiết lập và dấu mốc (lần sao lưu cuối…) */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  A.storeSchema = {
    items: { key: "id" }, notes: { key: "id" }, templates: { key: "id" }, marks: { key: "id" },
    srs: { key: "id", indexes: { due: "due" } }, quiz: { key: "id" }, drafts: { key: "id" }, meta: { key: "k" }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = A.storeSchema;
})(typeof globalThis !== "undefined" ? globalThis : this);
