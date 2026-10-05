/* csv.js — xuất / nhập CSV giao dịch (FR-54).

   CSV là để mở bằng bảng tính và nhập từ nơi khác; bản sao lưu ĐẦY ĐỦ là JSON
   (giữ tài khoản, sổ tiết kiệm, ngân sách…). Cột (tiếng Việt, mở được bằng Excel):

     ngay, loai, so_tien, danh_muc, tai_khoan, tai_khoan_den, ghi_chu, the, nguoi_tra, chia

   loai: chi | thu | chuyen | nhan-no | tra-no.   chia: "Tôi=28500;Phúc=28500".
   Thuần: không DOM, không storage. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  var HEADERS = ["ngay", "loai", "so_tien", "danh_muc", "tai_khoan", "tai_khoan_den", "ghi_chu", "the", "nguoi_tra", "chia"];
  var ALIAS = {
    ngay: "ngay", date: "ngay", loai: "loai", type: "loai", so_tien: "so_tien", sotien: "so_tien", tien: "so_tien", amount: "so_tien",
    danh_muc: "danh_muc", danhmuc: "danh_muc", category: "danh_muc", tai_khoan: "tai_khoan", taikhoan: "tai_khoan", account: "tai_khoan",
    tai_khoan_den: "tai_khoan_den", den: "tai_khoan_den", ghi_chu: "ghi_chu", ghichu: "ghi_chu", note: "ghi_chu",
    the: "the", tags: "the", nguoi_tra: "nguoi_tra", nguoitra: "nguoi_tra", paid_by: "nguoi_tra", chia: "chia", split: "chia"
  };
  var TYPE_IN = { chi: "expense", expense: "expense", thu: "income", income: "income", chuyen: "transfer", transfer: "transfer", "nhan-no": "settle_in", "tra-no": "settle_out" };

  /* ----------------------------------------------------------------- ghi */
  /** Ô bắt đầu bằng = + - @ bị bảng tính hiểu là CÔNG THỨC (CSV injection) → thêm dấu ' phía trước. */
  function safe(s) { s = String(s == null ? "" : s); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
  function cell(s) {
    s = safe(s);
    return /[",\r\n]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(doc) {
    var cats = QL.ledger.byId(doc.categories), accs = QL.ledger.byId(doc.accounts), ppl = QL.ledger.byId(doc.people);
    function nm(map, id) { return id && map[id] ? map[id].name : ""; }
    var rows = [HEADERS.join(",")];
    doc.transactions.slice().sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); }).forEach(function (tx) {
      var loai = tx.type === "expense" ? "chi" : tx.type === "income" ? "thu" : tx.type === "transfer" ? "chuyen" : (tx.direction === "in" ? "nhan-no" : "tra-no");
      var chia = tx.split ? Object.keys(tx.split.shares).map(function (id) { return nm(ppl, id).replace(/[;=]/g, " ") + "=" + tx.split.shares[id]; }).join(";") : "";
      var tra = tx.split ? nm(ppl, tx.split.paidBy) : (tx.type === "settle" ? nm(ppl, tx.personId) : "");
      rows.push([tx.date, loai, tx.amount, nm(cats, tx.categoryId), nm(accs, tx.accountId), nm(accs, tx.toAccountId),
        tx.note || "", (tx.tags || []).join(" "), tra, chia].map(cell).join(","));
    });
    return "﻿" + rows.join("\r\n") + "\r\n";
  }

  /* ----------------------------------------------------------------- đọc */
  /** Tách CSV theo RFC 4180 (ô có dấu phẩy / nháy kép / xuống dòng). Tự nhận dấu phân cách ',' hoặc ';'. */
  function parseCsv(text) {
    text = String(text == null ? "" : text).replace(/^﻿/, "");
    var firstLine = text.split(/\r?\n/, 1)[0] || "";
    var delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
    var rows = [], row = [], cur = "", q = false, i = 0, c;
    while (i < text.length) {
      c = text.charAt(i);
      if (q) {
        if (c === '"') { if (text.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(cur); cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cur += c;
      i++;
    }
    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }

  function unsafe(s) { return /^'[=+\-@]/.test(s) ? s.slice(1) : s; }

  /**
   * Đọc CSV thành bản nháp. Không đổi `doc`: trả {rows, create} để giao diện cho xem trước,
   * rồi gọi applyImport. Danh mục / tài khoản / người chưa có sẽ được tạo mới.
   */
  function fromCsv(text, doc, today) {
    var T = QL.text, M = QL.money, D = QL.dates;
    var table = parseCsv(text);
    var out = { rows: [], create: { categories: [], accounts: [], people: [] }, error: null };
    if (!table.length) { out.error = "File trống"; return out; }
    var col = {};
    table[0].forEach(function (h, i) {
      var key = ALIAS[T.fold(h).replace(/[^a-z_]+/g, "_").replace(/^_+|_+$/g, "")];
      if (key && col[key] === undefined) col[key] = i;
    });
    if (col.ngay === undefined || col.so_tien === undefined) {
      out.error = "Thiếu cột bắt buộc: ngay, so_tien (dòng đầu phải là tiêu đề cột)"; return out;
    }
    var me = doc.settings.meId || "p_me";
    var known = { categories: {}, accounts: {}, people: {} };
    doc.categories.forEach(function (c) { known.categories[c.kind + "|" + T.fold(c.name)] = c.id; });
    doc.accounts.forEach(function (a) { known.accounts[T.fold(a.name)] = a.id; });
    doc.people.forEach(function (p) { known.people[T.fold(p.name)] = p.id; });
    var pending = { categories: {}, accounts: {}, people: {} };

    function ref(kind, name, extra) {          // tra id theo tên; chưa có thì hẹn tạo
      var key = (kind === "categories" ? extra + "|" : "") + T.fold(name);
      if (known[kind][key]) return known[kind][key];
      if (!pending[kind][key]) {
        var id = QL.model.uid(kind === "categories" ? "c" : kind === "accounts" ? "a" : "p");
        pending[kind][key] = id;
        var item = { id: id, name: name.trim() };
        if (kind === "categories") { item.kind = extra; item.icon = "•"; item.color = "#98a2ad"; }
        if (kind === "accounts") { item.kind = "cash"; item.icon = "💵"; item.openingBalance = 0; }
        out.create[kind].push(item);
      }
      return pending[kind][key];
    }
    function get(r, k) { return col[k] === undefined ? "" : unsafe((r[col[k]] || "").trim()); }

    table.slice(1).forEach(function (r, i) {
      var row = { n: i + 2, errors: [], tx: null, duplicate: false };
      out.rows.push(row);
      var date = D.parseUser(get(r, "ngay"), today || D.today());
      var amount = M.parse(get(r, "so_tien"), { smallAsThousand: false });
      var loai = TYPE_IN[T.fold(get(r, "loai")) || "chi"];
      if (!date) row.errors.push("Ngày không hợp lệ: '" + get(r, "ngay") + "'");
      if (!amount.ok || amount.value <= 0) row.errors.push("Số tiền không hợp lệ: '" + get(r, "so_tien") + "'");
      if (!loai) row.errors.push("Loại không hợp lệ: '" + get(r, "loai") + "' (chi, thu, chuyen, nhan-no, tra-no)");
      if (row.errors.length) return;

      var tx = { type: loai.indexOf("settle") === 0 ? "settle" : loai, date: date, amount: amount.value, note: get(r, "ghi_chu"),
        tags: get(r, "the").split(/\s+/).filter(Boolean), categoryId: null, accountId: null, toAccountId: null };
      var accName = get(r, "tai_khoan"), toName = get(r, "tai_khoan_den"), catName = get(r, "danh_muc");
      var accId = accName ? ref("accounts", accName) : doc.settings.defaultAccountId;
      if (tx.type === "expense" || tx.type === "income") tx.categoryId = catName ? ref("categories", catName, tx.type) : (tx.type === "income" ? "c_income_other" : "c_other");
      if (tx.type === "transfer") {
        tx.accountId = accId; tx.toAccountId = toName ? ref("accounts", toName) : null;
        if (!tx.toAccountId) row.errors.push("Chuyển khoản cần cột tai_khoan_den");
      } else tx.accountId = accId;
      if (loai === "settle_in" || loai === "settle_out") {
        var who = get(r, "nguoi_tra");
        if (!who) row.errors.push("Thanh toán nợ cần cột nguoi_tra"); else tx.personId = ref("people", who);
        tx.direction = loai === "settle_in" ? "in" : "out";
      }
      var chia = get(r, "chia");
      if (chia && tx.type === "expense") {
        var shares = {}, sum = 0, bad = false;
        chia.split(";").forEach(function (part) {
          var kv = part.split("="), name = (kv[0] || "").trim(), v = M.parse(kv[1] || "", { smallAsThousand: false });
          if (!name || !v.ok || v.value < 0) { bad = true; return; }
          shares[ref("people", name)] = v.value; sum += v.value;
        });
        if (bad || sum !== tx.amount) row.errors.push("Cột chia không hợp lệ hoặc tổng phần (" + sum + ") khác số tiền (" + tx.amount + ")");
        else {
          var payer = get(r, "nguoi_tra");
          tx.split = { paidBy: payer ? ref("people", payer) : me, shares: shares };
          if (tx.split.paidBy !== me) tx.accountId = null;
        }
      }
      if (row.errors.length) return;
      row.tx = tx;
      row.duplicate = QL.ledger.findDuplicate(doc, tx) !== null;
    });
    return out;
  }

  /** Áp bản nháp vào tài liệu: tạo mục còn thiếu, thêm các dòng hợp lệ (bỏ dòng lỗi; bỏ dòng trùng nếu skipDuplicates). */
  function applyImport(doc, result, opts, now) {
    var M = QL.model, d = doc, used = {};
    var skipDup = !(opts && opts.skipDuplicates === false);
    var added = 0;
    result.rows.forEach(function (r) { if (r.tx && !(skipDup && r.duplicate)) { /* đánh dấu mục được dùng */ [r.tx.categoryId, r.tx.accountId, r.tx.toAccountId, r.tx.personId].forEach(function (x) { if (x) used[x] = true; }); if (r.tx.split) { used[r.tx.split.paidBy] = true; Object.keys(r.tx.split.shares).forEach(function (x) { used[x] = true; }); } } });
    ["categories", "accounts", "people"].forEach(function (coll) {
      result.create[coll].forEach(function (item) { if (used[item.id]) d = M.upsert(d, coll, Object.assign({ archived: false, order: d[coll].length }, item), now); });
    });
    result.rows.forEach(function (r) {
      if (!r.tx || (skipDup && r.duplicate)) return;
      d = M.upsert(d, "transactions", Object.assign({ id: M.uid("t") }, r.tx), now);
      added++;
    });
    return { doc: d, added: added };
  }

  QL.csv = { HEADERS: HEADERS, toCsv: toCsv, parseCsv: parseCsv, fromCsv: fromCsv, applyImport: applyImport };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.csv;
})(typeof globalThis !== "undefined" ? globalThis : this);
