/* model.js — tài liệu dữ liệu (schema v1), chuẩn hoá, thêm/sửa/xoá.

   Một tài liệu duy nhất chứa mọi thứ: cũng là thứ máy chủ lưu và file sao lưu.
   Mọi thao tác ở đây TRẢ VỀ tài liệu mới (không sửa tài liệu cũ), nên giao diện
   chỉ việc thay `state.doc`, và hoàn tác chỉ là giữ lại tài liệu cũ.
   Thuần: không DOM, không storage. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  var SCHEMA = 1;
  var COLLECTIONS = ["accounts", "categories", "people", "groups", "transactions", "budgets", "recurring"];
  var ME = "p_me";
  var TX_TYPES = ["expense", "income", "transfer", "settle"];
  var ACCOUNT_KINDS = ["cash", "bank", "ewallet", "savings"];
  var TOMBSTONE_DAYS = 90;
  var MAX_GROUP_MEMBERS = 40;

  /* ---------------------------------------------------------------- id & giờ */
  var seq = 0;
  function uid(prefix) {
    var r = "";
    var c = root.crypto;
    if (c && c.getRandomValues) {
      var a = new Uint32Array(2); c.getRandomValues(a);
      r = a[0].toString(36) + a[1].toString(36);
    } else {
      r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
    seq = (seq + 1) % 1296;
    return prefix + "_" + r.slice(0, 10) + seq.toString(36);
  }
  function nowIso(d) { return (d || new Date()).toISOString(); }

  /* --------------------------------------------------------------- mặc định */
  function defaultCategories() {
    var e = [
      ["c_food", "Ăn uống", "🍜", "#e8806a"],
      ["c_transport", "Đi lại", "🚌", "#e0a050"],
      ["c_housing", "Nhà trọ & hoá đơn", "🏠", "#c9b458"],
      ["c_shopping", "Mua sắm", "🛍️", "#b07cc6"],
      ["c_gift", "Quà tặng & hiếu hỉ", "🎁", "#e07aa0"],
      ["c_health", "Sức khoẻ", "💊", "#4fb8a8"],
      ["c_study", "Học tập", "📚", "#5b9bd5"],
      ["c_fun", "Du lịch & giải trí", "🎬", "#7a8cde"],
      ["c_family", "Gia đình", "👪", "#8fb86a"],
      ["c_other", "Khác", "⋯", "#98a2ad"]
    ].map(function (x, i) { return { id: x[0], name: x[1], kind: "expense", icon: x[2], color: x[3], archived: false, order: i }; });
    var i = [
      ["c_salary", "Lương", "💼", "#3fb27f"],
      ["c_bonus", "Thưởng", "🎉", "#5cc08f"],
      ["c_interest", "Lãi tiết kiệm", "🏦", "#4aa3a0"],
      ["c_income_other", "Thu khác", "➕", "#79b86a"]
    ].map(function (x, k) { return { id: x[0], name: x[1], kind: "income", icon: x[2], color: x[3], archived: false, order: 100 + k }; });
    return e.concat(i);
  }

  function defaultAccounts() {
    return [
      { id: "a_cash", name: "Tiền mặt", kind: "cash", icon: "💵", openingBalance: 0, archived: false, order: 0 },
      { id: "a_bank", name: "Tài khoản ngân hàng", kind: "bank", icon: "🏦", openingBalance: 0, archived: false, order: 1 },
      { id: "a_wallet", name: "Ví điện tử", kind: "ewallet", icon: "📱", openingBalance: 0, archived: false, order: 2 }
    ];
  }

  function emptyTombstones() {
    var t = {};
    COLLECTIONS.forEach(function (c) { t[c] = {}; });
    return t;
  }

  function emptyDoc(now) {
    var at = now || nowIso();
    function stamp(list) { return list.map(function (r) { r.updatedAt = at; return r; }); }
    return {
      schema: SCHEMA,
      settings: {
        updatedAt: at, meId: ME, smallAsThousand: true, defaultAccountId: "a_cash",
        defaultPartnerIds: [], defaultGroupId: null, theme: "system", lastBackupAt: null
      },
      accounts: stamp(defaultAccounts()),
      categories: stamp(defaultCategories()),
      people: [{ id: ME, name: "Tôi", archived: false, updatedAt: at }],
      groups: [],
      transactions: [],
      budgets: [],
      recurring: [],
      tombstones: emptyTombstones()
    };
  }

  /* ----------------------------------------------------------------- tiện ích */
  function isInt(n) { return typeof n === "number" && isFinite(n) && Math.floor(n) === n; }
  function str(v, max) { return typeof v === "string" ? v.slice(0, max || 500) : ""; }
  function bool(v, d) { return typeof v === "boolean" ? v : d; }
  function isoOrNow(v, at) { return typeof v === "string" && !isNaN(Date.parse(v)) ? v : at; }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function copyDoc(doc) {
    var d = {}; for (var k in doc) d[k] = doc[k];
    return d;
  }

  /* --------------------------------------------------------------- validateTx */
  /** Lỗi của một giao dịch theo bất biến §3.1 của design. Mảng rỗng = hợp lệ. */
  function validateTx(tx, doc) {
    var err = [];
    var D = QL.dates;
    if (!tx || TX_TYPES.indexOf(tx.type) === -1) { return ["Loại giao dịch không hợp lệ"]; }
    if (!isInt(tx.amount) || tx.amount <= 0) err.push("Số tiền phải là số nguyên lớn hơn 0");
    if (!D.isValid(tx.date)) err.push("Ngày không hợp lệ");
    var meId = (doc && doc.settings && doc.settings.meId) || ME;

    if (tx.type === "expense" || tx.type === "income") {
      if (!tx.categoryId) err.push("Chưa chọn danh mục");
      if (doc && tx.categoryId && !find(doc.categories, tx.categoryId)) err.push("Danh mục không tồn tại");
    }
    if (tx.type === "transfer") {
      if (!tx.accountId || !tx.toAccountId) err.push("Cần cả tài khoản nguồn và tài khoản đích");
      else if (tx.accountId === tx.toAccountId) err.push("Tài khoản nguồn và đích phải khác nhau");
    }
    if (tx.type === "settle") {
      if (!tx.personId || tx.personId === meId) err.push("Cần chọn người khác để thanh toán");
      if (tx.direction !== "in" && tx.direction !== "out") err.push("Hướng thanh toán không hợp lệ");
      if (!tx.accountId) err.push("Chưa chọn tài khoản");
    }
    // Khoản người khác trả hộ không đụng tới tài khoản của tôi nên không cần chọn tài khoản.
    var paidByOther = tx.type === "expense" && tx.split && tx.split.paidBy !== meId;
    if ((tx.type === "expense" && !paidByOther) || tx.type === "income") {
      if (!tx.accountId) err.push("Chưa chọn tài khoản");
    }
    if (doc && tx.accountId && !find(doc.accounts, tx.accountId)) err.push("Tài khoản không tồn tại");
    if (doc && tx.toAccountId && !find(doc.accounts, tx.toAccountId)) err.push("Tài khoản đích không tồn tại");

    if (tx.split) {
      if (tx.type !== "expense") err.push("Chỉ khoản chi mới chia tiền được");
      else {
        var sh = tx.split.shares || {}, ids = Object.keys(sh), sum = 0;
        if (!ids.length) err.push("Chưa có ai tham gia chia");
        ids.forEach(function (pid) {
          if (!isInt(sh[pid]) || sh[pid] < 0) err.push("Phần chia phải là số nguyên không âm");
          sum += isInt(sh[pid]) ? sh[pid] : 0;
          if (doc && !find(doc.people, pid)) err.push("Người tham gia không tồn tại");
        });
        if (isInt(tx.amount) && sum !== tx.amount) err.push("Tổng các phần chia (" + sum + ") phải bằng số tiền (" + tx.amount + ")");
        if (doc && !find(doc.people, tx.split.paidBy)) err.push("Người trả không tồn tại");
      }
    }
    // Nhóm chỉ gắn vào khoản chi CHUNG hoặc khoản thanh toán nợ (để số của nhóm tính được).
    if (tx.groupId != null) {
      if (typeof tx.groupId !== "string" || !tx.groupId) err.push("Nhóm không hợp lệ");
      else if (!((tx.type === "expense" && tx.split) || tx.type === "settle")) err.push("Chỉ khoản chi chung hoặc thanh toán nợ mới thuộc nhóm được");
      else if (doc && !find(doc.groups || [], tx.groupId)) err.push("Nhóm không tồn tại");
    }
    return err;
  }

  /* ---------------------------------------------------------------- normalize */
  /**
   * Nhận MỌI thứ đọc từ localStorage / máy chủ / file sao lưu (không tin được) và
   * trả về tài liệu đúng schema. Bản ghi hỏng bị bỏ và được ghi vào `fixes`;
   * tuyệt đối không ném lỗi — một dòng hỏng không được làm mất cả sổ.
   */
  function normalize(raw, now) {
    var at = now || nowIso();
    var fixes = [];
    var base = emptyDoc(at);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      fixes.push("Dữ liệu không phải một tài liệu — dùng sổ trống");
      return { doc: base, fixes: fixes };
    }
    var doc = { schema: SCHEMA };

    /* settings */
    var s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    doc.settings = {
      updatedAt: isoOrNow(s.updatedAt, at),
      meId: str(s.meId, 64) || ME,
      smallAsThousand: bool(s.smallAsThousand, true),
      defaultAccountId: str(s.defaultAccountId, 64) || "a_cash",
      defaultPartnerIds: Array.isArray(s.defaultPartnerIds) ? s.defaultPartnerIds.filter(function (x) { return typeof x === "string"; }).slice(0, 8) : [],
      defaultGroupId: str(s.defaultGroupId, 64) || null,
      theme: ["system", "light", "dark"].indexOf(s.theme) !== -1 ? s.theme : "system",
      lastBackupAt: typeof s.lastBackupAt === "string" ? s.lastBackupAt : null
    };

    /* gom bản ghi hợp lệ, id duy nhất */
    function clean(coll, fn) {
      var seen = {}, out = [];
      (Array.isArray(raw[coll]) ? raw[coll] : []).forEach(function (r, i) {
        if (!r || typeof r !== "object" || typeof r.id !== "string" || !r.id || r.id.length > 64) { fixes.push(coll + "[" + i + "]: bỏ (thiếu id)"); return; }
        if (seen[r.id]) { fixes.push(coll + "[" + r.id + "]: bỏ (trùng id)"); return; }
        var c = fn(r);
        if (!c) { fixes.push(coll + "[" + r.id + "]: bỏ (không hợp lệ)"); return; }
        c.id = r.id;
        c.updatedAt = isoOrNow(r.updatedAt, at);
        seen[r.id] = true; out.push(c);
      });
      return out;
    }

    doc.accounts = clean("accounts", function (r) {
      var kind = ACCOUNT_KINDS.indexOf(r.kind) !== -1 ? r.kind : "cash";
      var a = {
        name: str(r.name, 80) || "Tài khoản", kind: kind, icon: str(r.icon, 8) || "💵",
        openingBalance: isInt(r.openingBalance) ? r.openingBalance : 0,
        archived: bool(r.archived, false), order: isInt(r.order) ? r.order : 0
      };
      if (r.deposit && typeof r.deposit === "object" && QL.dates.isValid(r.deposit.openedOn)) {
        a.deposit = {
          rate: typeof r.deposit.rate === "number" && isFinite(r.deposit.rate) && r.deposit.rate >= 0 ? r.deposit.rate : 0,
          termMonths: isInt(r.deposit.termMonths) && r.deposit.termMonths > 0 ? r.deposit.termMonths : 12,
          openedOn: r.deposit.openedOn,
          taxPct: typeof r.deposit.taxPct === "number" && r.deposit.taxPct >= 0 && r.deposit.taxPct <= 100 ? r.deposit.taxPct : 0,
          closedOn: QL.dates.isValid(r.deposit.closedOn) ? r.deposit.closedOn : null
        };
      }
      return a;
    });
    doc.categories = clean("categories", function (r) {
      return {
        name: str(r.name, 80) || "Danh mục", kind: r.kind === "income" ? "income" : "expense",
        icon: str(r.icon, 8) || "•", color: /^#[0-9a-fA-F]{3,8}$/.test(r.color) ? r.color : "#98a2ad",
        archived: bool(r.archived, false), order: isInt(r.order) ? r.order : 0
      };
    });
    doc.people = clean("people", function (r) {
      return { name: str(r.name, 60) || "Người", archived: bool(r.archived, false) };
    });
    if (!find(doc.people, doc.settings.meId)) {
      doc.people.unshift({ name: "Tôi", archived: false, id: doc.settings.meId, updatedAt: at });
      fixes.push("Thiếu mục 'Tôi' — đã thêm lại");
    }
    var known = {};
    doc.people.forEach(function (p) { known[p.id] = true; });
    // Tôi luôn là thành viên ngầm của mọi nhóm, nên không nằm trong memberIds.
    doc.groups = clean("groups", function (r) {
      var seen = {};
      var members = (Array.isArray(r.memberIds) ? r.memberIds : []).filter(function (id) {
        if (typeof id !== "string" || !known[id] || id === doc.settings.meId || seen[id]) return false;
        seen[id] = true; return true;
      }).slice(0, MAX_GROUP_MEMBERS);
      return { name: str(r.name, 60) || "Nhóm", memberIds: members, archived: bool(r.archived, false), order: isInt(r.order) ? r.order : 0 };
    });

    doc.transactions = clean("transactions", function (r) {
      if (TX_TYPES.indexOf(r.type) === -1 || !isInt(r.amount) || r.amount <= 0 || !QL.dates.isValid(r.date)) return null;
      var t = {
        type: r.type, date: r.date, amount: r.amount,
        categoryId: typeof r.categoryId === "string" ? r.categoryId : null,
        accountId: typeof r.accountId === "string" ? r.accountId : null,
        toAccountId: typeof r.toAccountId === "string" ? r.toAccountId : null,
        note: str(r.note, 300),
        tags: Array.isArray(r.tags) ? r.tags.filter(function (x) { return typeof x === "string"; }).map(function (x) { return x.slice(0, 40); }).slice(0, 10) : [],
        createdAt: isoOrNow(r.createdAt, at)
      };
      if (r.type === "settle") {
        t.personId = typeof r.personId === "string" ? r.personId : null;
        t.direction = r.direction === "in" || r.direction === "out" ? r.direction : null;
      }
      if (r.recurringId && typeof r.recurringId === "string") t.recurringId = r.recurringId;
      if (r.type === "expense" && r.split && typeof r.split === "object" && r.split.shares && typeof r.split.shares === "object") {
        var shares = {}, ok = true, sum = 0;
        Object.keys(r.split.shares).forEach(function (k) {
          var v = r.split.shares[k];
          if (!isInt(v) || v < 0) ok = false; else { shares[k] = v; sum += v; }
        });
        if (ok && sum === r.amount && typeof r.split.paidBy === "string") t.split = { paidBy: r.split.paidBy, shares: shares };
        else fixes.push("transactions[" + r.id + "]: bỏ phần chia (tổng không khớp)");
      }
      if (typeof r.groupId === "string" && r.groupId && r.groupId.length <= 64 && (t.split || r.type === "settle")) t.groupId = r.groupId;
      return t;
    });
    doc.budgets = clean("budgets", function (r) {
      if (!isInt(r.amount) || r.amount <= 0) return null;
      return { categoryId: typeof r.categoryId === "string" ? r.categoryId : null, amount: r.amount };
    });
    doc.recurring = clean("recurring", function (r) {
      if (!isInt(r.amount) || r.amount <= 0 || !QL.dates.isValid(r.startOn)) return null;
      if (r.type !== "expense" && r.type !== "income") return null;
      var f = r.frequency === "weekly" ? "weekly" : "monthly";
      var day = isInt(r.day) ? r.day : 1;
      day = f === "weekly" ? Math.min(6, Math.max(0, day)) : Math.min(31, Math.max(1, day));
      return {
        name: str(r.name, 80) || "Định kỳ", type: r.type, amount: r.amount,
        categoryId: typeof r.categoryId === "string" ? r.categoryId : null,
        accountId: typeof r.accountId === "string" ? r.accountId : null,
        note: str(r.note, 300), frequency: f, day: day, startOn: r.startOn,
        endOn: QL.dates.isValid(r.endOn) ? r.endOn : null,
        lastDoneOn: QL.dates.isValid(r.lastDoneOn) ? r.lastDoneOn : null,
        active: bool(r.active, true)
      };
    });

    /* tombstones */
    doc.tombstones = emptyTombstones();
    var tb = raw.tombstones && typeof raw.tombstones === "object" ? raw.tombstones : {};
    COLLECTIONS.forEach(function (c) {
      var m = tb[c] && typeof tb[c] === "object" ? tb[c] : {};
      Object.keys(m).forEach(function (id) { if (typeof m[id] === "string" && !isNaN(Date.parse(m[id]))) doc.tombstones[c][id] = m[id]; });
    });
    return { doc: doc, fixes: fixes };
  }

  /* ------------------------------------------------------------ upsert / remove */
  /** Thêm hoặc thay một bản ghi; đóng dấu updatedAt; xoá bia mộ nếu có. */
  function upsert(doc, coll, rec, now) {
    var at = now || nowIso();
    var r = {}; for (var k in rec) r[k] = rec[k];
    r.updatedAt = at;
    if (coll === "transactions" && !r.createdAt) r.createdAt = at;
    var list = doc[coll].slice(), found = false;
    for (var i = 0; i < list.length; i++) if (list[i].id === r.id) { list[i] = r; found = true; break; }
    if (!found) list.push(r);
    var d = copyDoc(doc);
    d[coll] = list;
    if (doc.tombstones[coll] && doc.tombstones[coll][r.id] !== undefined) {
      var tb = {}; for (var c in doc.tombstones) tb[c] = doc.tombstones[c];
      var one = {}; for (var id in tb[coll]) if (id !== r.id) one[id] = tb[coll][id];
      tb[coll] = one; d.tombstones = tb;
    }
    return d;
  }

  /** Xoá một bản ghi và để lại bia mộ (để thiết bị khác biết đây là XOÁ chứ không phải chưa có). */
  function remove(doc, coll, id, now) {
    var at = now || nowIso();
    var d = copyDoc(doc);
    d[coll] = doc[coll].filter(function (r) { return r.id !== id; });
    var tb = {}; for (var c in doc.tombstones) tb[c] = doc.tombstones[c];
    var one = {}; for (var k in tb[coll]) one[k] = tb[coll][k];
    one[id] = at; tb[coll] = one;
    d.tombstones = tb;
    return d;
  }

  /** Xoá một người và gỡ họ khỏi mọi nhóm đang có họ. */
  function removePerson(doc, id, now) {
    var at = now || nowIso();
    var d = remove(doc, "people", id, at);
    (doc.groups || []).forEach(function (g) {
      if (g.memberIds.indexOf(id) === -1) return;
      var n = {}; for (var k in g) n[k] = g[k];
      n.memberIds = g.memberIds.filter(function (x) { return x !== id; });
      d = upsert(d, "groups", n, at);
    });
    if (d.settings.defaultPartnerIds && d.settings.defaultPartnerIds.indexOf(id) !== -1) {
      d = setSettings(d, { defaultPartnerIds: d.settings.defaultPartnerIds.filter(function (x) { return x !== id; }) }, at);
    }
    return d;
  }

  /** Cập nhật cài đặt (LWW cả khối theo settings.updatedAt). */
  function setSettings(doc, patch, now) {
    var d = copyDoc(doc), s = {};
    for (var k in doc.settings) s[k] = doc.settings[k];
    for (var p in patch) s[p] = patch[p];
    s.updatedAt = now || nowIso();
    d.settings = s;
    return d;
  }

  /* -------------------------------------------------------- sổ tiết kiệm (D8) */
  /**
   * Mở sổ: tạo tài khoản kind=savings mang `deposit` và chuyển `amount` từ tài khoản nguồn vào.
   * Trả {doc, accountId}.
   */
  function openDeposit(doc, p, now) {
    var at = now || nowIso();
    var acc = {
      id: p.id || uid("a"), name: p.name || "Sổ tiết kiệm", kind: "savings", icon: "🏦",
      openingBalance: 0, archived: false, order: doc.accounts.length,
      deposit: { rate: p.rate, termMonths: p.termMonths, openedOn: p.openedOn, taxPct: p.taxPct || 0, closedOn: null }
    };
    var d = upsert(doc, "accounts", acc, at);
    d = upsert(d, "transactions", {
      id: uid("t"), type: "transfer", date: p.openedOn, amount: p.amount,
      accountId: p.fromAccountId, toAccountId: acc.id, note: "Gửi " + acc.name, tags: []
    }, at);
    return { doc: d, accountId: acc.id };
  }

  /**
   * Tất toán: chuyển gốc về `toAccountId`, ghi lãi thực nhận (sau thuế) là thu nhập
   * "Lãi tiết kiệm", đặt closedOn và lưu trữ sổ. `principal` là số dư hiện tại của sổ.
   */
  function closeDeposit(doc, accountId, p, now) {
    var at = now || nowIso();
    var acc = find(doc.accounts, accountId);
    if (!acc || !acc.deposit) throw new Error("Không phải sổ tiết kiệm");
    var d = doc;
    if (p.principal > 0) {
      d = upsert(d, "transactions", {
        id: uid("t"), type: "transfer", date: p.date, amount: p.principal,
        accountId: accountId, toAccountId: p.toAccountId, note: "Tất toán " + acc.name, tags: []
      }, at);
    }
    if (p.interest > 0) {
      d = upsert(d, "transactions", {
        id: uid("t"), type: "income", date: p.date, amount: p.interest,
        categoryId: "c_interest", accountId: p.toAccountId, note: "Lãi " + acc.name, tags: []
      }, at);
    }
    var closed = {}; for (var k in acc) closed[k] = acc[k];
    closed.deposit = {}; for (var j in acc.deposit) closed.deposit[j] = acc.deposit[j];
    closed.deposit.closedOn = p.date; closed.archived = true;
    return upsert(d, "accounts", closed, at);
  }

  /* ------------------------------------------------------------------- định kỳ */
  /** Biến một lần đến hạn thành giao dịch thật (số tiền sửa được) và đánh dấu đã xử lý. */
  function confirmRecurring(doc, ruleId, dueOn, patch, now) {
    var at = now || nowIso();
    var rule = find(doc.recurring, ruleId);
    if (!rule) throw new Error("Không có quy tắc định kỳ");
    var tx = {
      id: uid("t"), type: rule.type, date: dueOn, amount: (patch && patch.amount) || rule.amount,
      categoryId: rule.categoryId, accountId: rule.accountId, note: rule.note || rule.name, tags: [], recurringId: rule.id
    };
    var d = upsert(doc, "transactions", tx, at);
    return markRecurringDone(d, ruleId, dueOn, at);
  }
  function markRecurringDone(doc, ruleId, dueOn, now) {
    var rule = find(doc.recurring, ruleId);
    var r = {}; for (var k in rule) r[k] = rule[k];
    if (!r.lastDoneOn || dueOn > r.lastDoneOn) r.lastDoneOn = dueOn;
    return upsert(doc, "recurring", r, now);
  }

  /* --------------------------------------------------------------- dữ liệu mẫu */
  var SAMPLE_TAG = "mau";

  /**
   * Thêm ~8 tuần dữ liệu mẫu theo đúng nhịp của nhật ký thật: cơm trưa chia đôi T2–T6, hai bữa cuối tuần,
   * vé bus tháng, tiền shopping, lương ngày 10, gửi tiết kiệm. Mọi thứ gắn thẻ #mau (và id bắt đầu bằng
   * "s_") để removeSample xoá sạch mà không đụng dữ liệu thật. Tất định: cùng `today` ra cùng dữ liệu.
   */
  function addSample(doc, today, now) {
    var D = QL.dates, M = QL.money, at = now || nowIso();
    var d = doc;
    d = upsert(d, "people", { id: "s_p", name: "Bạn cùng phòng", archived: false }, at);
    d = setSettings(d, { defaultPartnerIds: ["s_p"].concat((d.settings.defaultPartnerIds || []).filter(function (x) { return x !== "s_p"; })).slice(0, 8) }, at);
    d = upsert(d, "accounts", { id: "s_bank", name: "Ngân hàng (mẫu)", kind: "bank", icon: "🏦", openingBalance: 20000000, archived: false, order: 90 }, at);
    var seed = 7;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var n = 0;
    function tx(date, type, amount, cat, note, extra) {
      n++;
      var t = Object.assign({ id: "s_t" + n, type: type, date: date, amount: amount, categoryId: cat, accountId: "a_cash", note: note, tags: [SAMPLE_TAG] }, extra || {});
      d = upsert(d, "transactions", t, at);
    }
    function chung(amount, payer) {
      var parts = M.allocate(amount, [1, 1]);
      return { split: { paidBy: payer, shares: { p_me: parts[0], s_p: parts[1] } } };
    }
    var start = D.addDays(today, -55);
    for (var i = 0; i < 56; i++) {
      var day = D.addDays(start, i), wd = D.weekday(day), dom = +day.slice(8);
      if (wd <= 4) {
        var a = Math.round((55 + rnd() * 8) * 2) * 500, payer = rnd() < 0.5 ? "p_me" : "s_p";
        tx(day, "expense", a, "c_food", ["Cơm trưa", "Bún đậu", "Mì cay", "Bún chả"][Math.floor(rnd() * 4)], Object.assign(chung(a, payer), payer === "p_me" ? {} : { accountId: null }));
      } else {
        var b = Math.round((60 + rnd() * 25) * 2) * 500;
        tx(day, "expense", b, "c_food", wd === 5 ? "Cơm mai dịch" : "Nem nướng", chung(b, rnd() < 0.5 ? "p_me" : "s_p"));
        if (rnd() < 0.4) tx(day, "expense", 25000, "c_transport", "Bus 205");
      }
      if (dom === 1) tx(day, "expense", 280000, "c_transport", "Vé xe bus tháng");
      if (dom === 10) {
        tx(day, "income", 14900000, "c_salary", "Lương", { accountId: "s_bank" });
        tx(day, "expense", 300000, "c_shopping", "Shopping momo");
      }
      if (rnd() < 0.12) tx(day, "expense", Math.round((20 + rnd() * 90) * 2) * 500, "c_shopping", "Shopee");
    }
    // Lương ngày 10 gần nhất: gửi tiết kiệm.
    var salaryDay = null;
    for (var k = 0; k <= 56; k++) { var dd = D.addDays(today, -k); if (+dd.slice(8) === 10) { salaryDay = dd; break; } }
    if (salaryDay) {
      var sav = { id: "s_sav", name: "Sổ lương (mẫu)", kind: "savings", icon: "🏦", openingBalance: 0, archived: false, order: 91,
        deposit: { rate: 8.6, termMonths: 12, openedOn: salaryDay, taxPct: 0, closedOn: null } };
      d = upsert(d, "accounts", sav, at);
      tx(salaryDay, "transfer", 12000000, null, "Gửi Sổ lương (mẫu)", { accountId: "s_bank", toAccountId: "s_sav" });
    }
    d = upsert(d, "budgets", { id: "s_b1", categoryId: "c_shopping", amount: 300000 }, at);
    d = upsert(d, "budgets", { id: "s_b2", categoryId: "c_food", amount: 3000000 }, at);
    d = upsert(d, "recurring", { id: "s_r1", name: "Vé xe bus tháng", type: "expense", amount: 280000, categoryId: "c_transport", accountId: "a_cash", note: "Vé xe bus tháng", frequency: "monthly", day: 1, startOn: D.addMonths(D.startOfMonth(today), 1), endOn: null, lastDoneOn: null, active: true }, at);
    return d;
  }

  /** Xoá mọi thứ do addSample tạo (nhận ra bằng id bắt đầu "s_" hoặc thẻ #mau). */
  function removeSample(doc, now) {
    var at = now || nowIso(), d = doc;
    COLLECTIONS.forEach(function (coll) {
      d[coll].forEach(function (r) {
        var isSample = String(r.id).indexOf("s_") === 0 || (coll === "transactions" && (r.tags || []).indexOf(SAMPLE_TAG) !== -1);
        if (isSample) d = remove(d, coll, r.id, at);
      });
    });
    var defs = (d.settings.defaultPartnerIds || []).filter(function (x) { return x !== "s_p"; });
    var patch = { defaultPartnerIds: defs };
    if (String(d.settings.defaultGroupId || "").indexOf("s_") === 0) patch.defaultGroupId = null;
    return setSettings(d, patch, at);
  }

  QL.model = {
    SCHEMA: SCHEMA, COLLECTIONS: COLLECTIONS, ME: ME, TX_TYPES: TX_TYPES, ACCOUNT_KINDS: ACCOUNT_KINDS,
    TOMBSTONE_DAYS: TOMBSTONE_DAYS, MAX_GROUP_MEMBERS: MAX_GROUP_MEMBERS,
    uid: uid, nowIso: nowIso, emptyDoc: emptyDoc, defaultCategories: defaultCategories, defaultAccounts: defaultAccounts,
    emptyTombstones: emptyTombstones, find: find, isInt: isInt,
    validateTx: validateTx, normalize: normalize, upsert: upsert, remove: remove, removePerson: removePerson, setSettings: setSettings,
    openDeposit: openDeposit, closeDeposit: closeDeposit, addSample: addSample, removeSample: removeSample, SAMPLE_TAG: SAMPLE_TAG, confirmRecurring: confirmRecurring, markRecurringDone: markRecurringDone
  };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.model;
})(typeof globalThis !== "undefined" ? globalThis : this);
