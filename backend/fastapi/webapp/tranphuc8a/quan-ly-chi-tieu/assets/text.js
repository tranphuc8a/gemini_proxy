/* text.js — chuỗi: bỏ dấu tiếng Việt, thoát HTML, so khớp tìm kiếm.
   Thuần: không DOM, không storage. Chạy được trong trình duyệt và trong node. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  /** Bỏ dấu, hạ chữ thường; ĐỘ DÀI KHÔNG ĐỔI với chữ dựng sẵn (NFC), nên chỉ số
      trong chuỗi đã bỏ dấu trỏ đúng vào chuỗi gốc. */
  function fold(s) {
    s = String(s == null ? "" : s).normalize("NFC");
    var out = "";
    for (var ch of s) {
      if (ch === "đ") out += "d";
      else if (ch === "Đ") out += "D";
      else {
        var nfd = ch.normalize("NFD");
        out += (ch.length === 1 && nfd.length > 1) ? nfd.charAt(0) : ch;
      }
    }
    return out.toLowerCase();
  }

  var HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

  /** Thoát HTML. MỌI chuỗi do người dùng nhập đều đi qua đây trước khi vào innerHTML. */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"'`]/g, function (c) { return HTML[c]; });
  }

  /** Tách thành các "từ" đã bỏ dấu (chữ+số), dùng cho tìm kiếm và gợi ý. */
  function words(s) {
    return fold(s).split(/[^a-z0-9]+/).filter(Boolean);
  }

  /** Mọi từ của `query` đều phải là TIỀN TỐ của một từ nào đó trong `text` ("com" khớp "Cơm" nhưng không khớp "Techcombank"). */
  function matches(text, query) {
    var q = words(query);
    if (!q.length) return true;
    var t = words(text);
    return q.every(function (w) {
      return t.some(function (x) { return x.indexOf(w) === 0; });
    });
  }

  QL.text = { fold: fold, esc: esc, words: words, matches: matches };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.text;
})(typeof globalThis !== "undefined" ? globalThis : this);
