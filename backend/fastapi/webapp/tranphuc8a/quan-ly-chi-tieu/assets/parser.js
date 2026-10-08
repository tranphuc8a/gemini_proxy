/* parser.js — hiểu một dòng tiếng Việt thành giao dịch (FR-02..06).

     cơm mai dịch 61.5k hôm qua     →  chi 61.500, hôm qua, Ăn uống
     57/2 bún đậu                   →  chi 57.000 chia đôi
     lương 14.916.956 10/6          →  thu 14.916.956 ngày 10/6
     87k - 50k voucher              →  chi 37.000

   Nguyên tắc: kết quả chỉ là ĐỀ XUẤT. Giao diện luôn cho xem và sửa trước khi
   lưu, và không bao giờ lưu im lặng một giá trị đoán mà người dùng chưa thấy.
   Thuần: không DOM, không storage; ngày hôm nay do người gọi đưa vào. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  /* Số (có thể kèm đơn vị) + tuỳ chọn "/n" (chia n) + tuỳ chọn "/yyyy". Chạy trên chuỗi
     ĐÃ BỎ DẤU. Không dùng lookbehind (Safari < 16.4 không hiểu); ký tự đứng trước
     được kiểm tay trong vòng lặp. */
  var NUM = /(\d[\d.,]*(?:\s?(?:nghin|ngan|trieu|tr|ty|ti|k|m)(?![a-z0-9]))?)(?:\s?\/\s?(\d{1,4}))?(?:\s?\/\s?(\d{1,4}))?/g;

  function fold(s) { return QL.text.fold(s); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* ------------------------------------------------------- gợi ý danh mục */
  /* Từ khoá đã bỏ dấu. Nhiều từ khớp hơn thì điểm cao hơn; hoà thì theo thứ tự bảng. */
  var KEYWORDS = [
    ["c_transport", ["bus", "xe buyt", "ve xe", "ve thang", "grab", "taxi", "xang", "gui xe", "be", "ot be", "xe om", "ve tau", "ve may bay"]],
    ["c_housing", ["tien tro", "tien dien", "tien nuoc", "dien nuoc", "nong lanh", "tam tru", "wifi", "internet", "data", "4g", "tro"]],
    ["c_food", ["com", "bun", "pho", "mi", "my", "mien", "chao", "nem", "banh", "xoi", "che", "tra sua", "tra dao", "hong tra", "ca phe", "cafe", "coffee",
      "an sang", "an trua", "an toi", "an vat", "ga u muoi", "lau", "nuong", "bia", "sua chua", "hoa qua", "trai cay", "cha", "an"]],
    ["c_shopping", ["shopee", "tiktok", "tiktokshop", "lazada", "momo", "shopping", "mua sam", "tap hoa", "sieu thi", "op lung", "op da", "cuong luc",
      "tai nghe", "quan", "ao", "giay", "dep", "ghe", "vo goi", "sticker", "bot giat", "giay ve sinh"]],
    ["c_gift", ["qua", "scoffee", "scafe", "sinh nhat", "vieng", "tang", "dam cuoi", "dam ma", "phong bi", "li xi", "hieu hi", "mung"]],
    ["c_health", ["thuoc", "kham", "benh vien", "nha khoa", "suc khoe", "medlatech", "vitamin", "khau trang"]],
    ["c_study", ["sach", "hoc phi", "khoa hoc", "but may", "vo viet", "tap viet", "lop hoc"]],
    ["c_fun", ["du lich", "ha long", "khach san", "phim", "game", "nap game", "karaoke", "ve vui choi", "dac san"]],
    ["c_family", ["cho bo", "cho me", "bieu bo", "bieu me", "boc yen xe", "gia dinh"]],
    ["c_salary", ["luong", "nhan luong", "srv"]],
    ["c_bonus", ["thuong", "pi", "quyet toan", "bonus"]],
    ["c_interest", ["lai", "tai tich luy", "rut lai"]],
    ["c_income_other", ["voucher", "hoan tien", "hoan", "duoc tang"]]
  ];

  function hasKeyword(padded, kw) { return padded.indexOf(" " + kw + " ") !== -1; }

  /** Danh mục dùng được cho `type` (tồn tại, chưa ẩn, đúng loại thu/chi). */
  function usable(doc, id, type) {
    var c = QL.model.find(doc.categories, id);
    return c && !c.archived && c.kind === (type === "income" ? "income" : "expense") ? c : null;
  }

  /**
   * Danh mục cho một ghi chú: (1) ghi chú giống hệt trong lịch sử, (2) rất giống,
   * (3) từ khoá mặc định. Trả id hoặc null — không đoán bừa.
   */
  function suggestCategory(note, type, doc) {
    var nf = fold(note).replace(/[^a-z0-9]+/g, " ").trim();
    if (!nf) return null;
    var words = nf.split(" ").filter(Boolean), wset = {};
    words.forEach(function (w) { wset[w] = true; });

    var exact = {}, fuzzy = {};
    doc.transactions.forEach(function (tx) {
      if (!tx.note || !tx.categoryId || tx.type !== (type === "income" ? "income" : "expense")) return;
      var hf = fold(tx.note).replace(/[^a-z0-9]+/g, " ").trim();
      if (hf === nf) { exact[tx.categoryId] = (exact[tx.categoryId] || 0) + 1; return; }
      var hw = hf.split(" ").filter(Boolean), inter = 0;
      hw.forEach(function (w) { if (wset[w] && w.length >= 3) inter++; });
      var union = Object.keys(wset).length + hw.length - inter;
      if (inter >= 1 && union && inter / union >= 0.6) fuzzy[tx.categoryId] = (fuzzy[tx.categoryId] || 0) + inter / union;
    });
    function best(m) {
      var top = null, score = 0;
      Object.keys(m).forEach(function (id) { if (m[id] > score && usable(doc, id, type)) { top = id; score = m[id]; } });
      return top;
    }
    var h = best(exact) || best(fuzzy);
    if (h) return h;

    var padded = " " + nf + " ", topId = null, topScore = 0;
    KEYWORDS.forEach(function (row) {
      var score = 0;
      row[1].forEach(function (kw) { if (hasKeyword(padded, kw)) score++; });
      if (score > topScore && usable(doc, row[0], type)) { topId = row[0]; topScore = score; }
    });
    return topId;
  }

  /* ----------------------------------------------------------- phân tích */
  var DATE_WORDS = [[/(^|[^a-z0-9])(hom kia)(?![a-z0-9])/, -2], [/(^|[^a-z0-9])(hom qua)(?![a-z0-9])/, -1], [/(^|[^a-z0-9])(hom nay)(?![a-z0-9])/, 0]];
  var WD_WORDS = { t2: 0, t3: 1, t4: 2, t5: 3, t6: 4, t7: 5, cn: 6, "thu hai": 0, "thu ba": 1, "thu tu": 2, "thu nam": 3, "thu sau": 4, "thu bay": 5, "chu nhat": 6 };
  var WD_RE = /(^|[^a-z0-9])(t[2-7]|cn|thu (?:hai|ba|tu|nam|sau|bay)|chu nhat)(?![a-z0-9])/;
  var INCOME_RE = /^\s*(luong|thuong|thu nhap|nhan luong|nhan thuong|nhan tien|nhan|tien lai|lai|hoan tien|hoan|quyet toan)(?![a-z0-9])/;
  var TRANSFER_RE = /(^|[^a-z0-9])(chuyen khoan|chuyen tien|chuyen|rut tien|rut so|nap tien|gui tiet kiem)(?![a-z0-9]).*(sang|vao|ve|toi)(?![a-z0-9])/;

  var SAVINGS_RE = /^\s*(rut so|rut tien|gui tiet kiem|gui so|tiet kiem|tich luy|tai tich luy|nap tien tich luy)(?![a-z0-9])/;
  var AMT = "\\d[\\d.,]*(?:\\s?(?:nghin|ngan|trieu|tr|ty|ti|k|m)(?![a-z0-9]))?";
  var EXPR = new RegExp("(" + AMT + ")((?:\\s*[+\\-]\\s*" + AMT + ")+)(?:\\s*=\\s*(" + AMT + "))?", "g");

  /**
   * Biểu thức cộng/trừ tiền: "60+57+68" · "87k - 50k" · "87k - 50k = 37k". Dấu trừ chỉ được
   * hiểu khi CẢ HAI vế có đơn vị (nếu không "bus 205 - 25k" sẽ thành 180k). Có "=" thì lấy vế sau.
   * Trả {start,end,value} hoặc null.
   */
  function findExpression(work, smallAsThousand) {
    EXPR.lastIndex = 0;
    var m;
    while ((m = EXPR.exec(work)) !== null) {
      var whole = m[0];
      if (m.index > 0 && /[a-z]/.test(work.charAt(m.index - 1))) continue;
      if (/\//.test(whole)) continue;
      var ops = m[2].match(/[+\-]/g) || [];
      var okMinus = true;
      var raw = m[1] + m[2];
      var parts = raw.split(/([+\-])/);          // [a, op, b, op, c ...]
      for (var i = 1; i < parts.length; i += 2) {
        if (parts[i] === "-" && !(/[a-z]$/.test(parts[i - 1].trim()) && /[a-z]$/.test(parts[i + 1].trim()))) okMinus = false;
      }
      if (!okMinus || !ops.length) continue;
      var expr = m[3] ? m[3] : raw;
      var v = QL.money.parse(expr, { smallAsThousand: smallAsThousand });
      if (!v.ok || v.value <= 0) continue;
      return { start: m.index, end: m.index + whole.length, value: v.value, text: whole };
    }
    return null;
  }

  function smallFlag(ctx) { return !(ctx.doc && ctx.doc.settings && ctx.doc.settings.smallAsThousand === false); }

  function blank(arr, a, b) { // thay một đoạn bằng khoảng trắng (giữ nguyên chỉ số)
    return arr.slice(0, a) + new Array(b - a + 1).join(" ") + arr.slice(b);
  }

  /** Nhóm mặc định khi chia ("57/3"), nếu còn dùng được. */
  function defaultGroup(doc) {
    var id = doc.settings.defaultGroupId, g = id ? QL.model.find(doc.groups || [], id) : null;
    return g && !g.archived ? g : null;
  }

  /** Thành viên của nhóm còn chọn được (tôi trước, bỏ người đã lưu trữ). */
  function activeMembers(doc, g) {
    var me = doc.settings.meId || "p_me";
    return [me].concat(g.memberIds.filter(function (id) { var p = QL.model.find(doc.people, id); return p && !p.archived && id !== me; }));
  }

  /** Người (không phải tôi, chưa ẩn) theo thứ tự ưu tiên chia: nhóm mặc định, người mặc định, rồi tới danh sách. */
  function partners(doc) {
    var me = doc.settings.meId || "p_me";
    var others = doc.people.filter(function (p) { return p.id !== me && !p.archived; });
    var g = defaultGroup(doc), pref = [];
    if (g) g.memberIds.forEach(function (id) { var p = QL.model.find(others, id); if (p) pref.push(p); });
    (doc.settings.defaultPartnerIds || []).forEach(function (id) { var p = QL.model.find(others, id); if (p && pref.indexOf(p) === -1) pref.push(p); });
    return pref.length ? pref : others;
  }

  /** Khoản chia mà mọi người tham gia đều ở nhóm mặc định thì tính vào nhóm đó. */
  function tagDefaultGroup(split, doc) {
    var g = defaultGroup(doc), me = doc.settings.meId || "p_me";
    if (g && split.participantIds.length > 1 && split.participantIds.every(function (id) { return id === me || g.memberIds.indexOf(id) !== -1; }) &&
        (split.payerId === me || g.memberIds.indexOf(split.payerId) !== -1)) split.groupId = g.id;
    return split;
  }

  /**
   * @param {string} text
   * @param {{today:string, doc:object}} ctx
   * @returns {null|{type,amount,date,note,categoryId,split,warnings,spans}}
   */
  function parseQuick(text, ctx) {
    var src = String(text == null ? "" : text).normalize("NFC").trim();
    if (!src) return null;
    var D = QL.dates, M = QL.money, doc = ctx.doc, me = doc.settings.meId || "p_me";
    var f = fold(src);            // cùng độ dài với src
    var work = f;                 // đoạn đã nhận ra sẽ bị thay bằng khoảng trắng
    var warnings = [], spans = [];
    var date = null, amountTok = null;

    /* 1. Từ chỉ ngày: hôm nay/qua/kia, T2..CN, thứ hai.. */
    for (var i = 0; i < DATE_WORDS.length && date === null; i++) {
      var dm = DATE_WORDS[i][0].exec(work);
      if (dm) {
        var s0 = dm.index + dm[1].length;
        date = D.addDays(ctx.today, DATE_WORDS[i][1]);
        spans.push({ kind: "date", start: s0, end: s0 + dm[2].length });
        work = blank(work, s0, s0 + dm[2].length);
      }
    }
    if (date === null) {
      var wm = WD_RE.exec(work);
      if (wm) {
        var s1 = wm.index + wm[1].length;
        date = D.lastWeekday(WD_WORDS[wm[2]], ctx.today);
        spans.push({ kind: "date", start: s1, end: s1 + wm[2].length });
        work = blank(work, s1, s1 + wm[2].length);
      }
    }

    /* 2. Mọi token số. Biểu thức cộng/trừ ("87k - 50k", "60+57") là MỘT khoản. */
    var tokens = [], m;
    var ex = findExpression(work, smallFlag(ctx));
    if (ex) {
      tokens.push({ start: ex.start, end: ex.end, text: ex.text, hasUnit: true, split: null, third: undefined, letter: null,
        dateLike: false, ok: { ok: true, value: ex.value }, strong: true });
      work = blank(work, ex.start, ex.end);
    }
    NUM.lastIndex = 0;
    while ((m = NUM.exec(work)) !== null) {
      var start = m.index, end = start + m[0].length;
      if (start > 0 && /[a-z]/.test(work.charAt(start - 1))) continue;           // "t2", "a4"
      var letter = null;
      if (m[2] !== undefined && /[a-z]/.test(work.charAt(end)) && !/[a-z0-9]/.test(work.charAt(end + 1) || " ")) {
        letter = work.charAt(end); end += 1;                                      // "57/2P"
      } else if (/[a-z]/.test(work.charAt(end))) { NUM.lastIndex = end; continue; } // "5kg", "2ly"
      var numPart = m[1].replace(/\s+/g, "");
      var hasUnit = /[a-z]$/.test(numPart);
      var plainInt = /^\d{1,2}$/.test(numPart);
      var d1 = plainInt ? +numPart : 0, d2 = m[2] !== undefined ? +m[2] : 0;
      var dateLike = plainInt && m[2] !== undefined && d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 12 &&
        (m[3] === undefined || /^(\d{2}|\d{4})$/.test(m[3]));
      var plain = M.parse(m[1], { smallAsThousand: false });
      tokens.push({
        start: start, end: end, text: m[1], hasUnit: hasUnit, split: m[2] !== undefined ? +m[2] : null, third: m[3],
        letter: letter, dateLike: dateLike, ok: M.parse(m[1], { smallAsThousand: smallFlag(ctx) }),
        strong: hasUnit || (plain.ok && plain.value >= 1000) || (m[2] !== undefined && !dateLike)
      });
      NUM.lastIndex = end;
    }

    tokens.sort(function (a, b) { return a.start - b.start; });

    /* 3. Ngày dạng số: token giống dd/mm chỉ là NGÀY khi còn token tiền khác trong dòng. */
    var money = tokens.filter(function (t) { return !t.dateLike; });
    var dated = tokens.filter(function (t) { return t.dateLike; });
    if (!money.length && dated.length) {
      var as = dated[0];
      if (as.split >= 2 && as.split <= 9) { money = [as]; dated = dated.slice(1); } // "25/2 bún" = 25K chia 2
    }
    if (dated.length) {
      var dt = dated[0];
      if (date === null) {
        date = D.parseUser(+dt.text + "/" + dt.split + (dt.third ? "/" + dt.third : ""), ctx.today);
        if (date === null) warnings.push("Không hiểu ngày '" + src.slice(dt.start, dt.end) + "'");
      }
      spans.push({ kind: "date", start: dt.start, end: dt.end });
      work = blank(work, dt.start, dt.end);
    }

    /* 4. Số tiền: ưu tiên token "mạnh" (có đơn vị, ≥ 1.000, hoặc có /n), lấy token cuối. */
    var strong = money.filter(function (t) { return t.strong; });
    var pool = strong.length ? strong : money;
    if (pool.length) amountTok = pool[pool.length - 1];
    if (money.length > 1 && strong.length !== 1 && pool.length > 1) warnings.push("Có nhiều số tiền — lấy số cuối cùng");
    var amount = null, split = null, payerId = null;

    if (amountTok) {
      if (amountTok.ok.ok && amountTok.ok.value > 0) amount = amountTok.ok.value;
      else warnings.push("Không đọc được số tiền '" + src.slice(amountTok.start, amountTok.end).trim() + "'");
      spans.push({ kind: "amount", start: amountTok.start, end: amountTok.end });
      work = blank(work, amountTok.start, amountTok.end);
      if (amountTok.split !== null) {
        if (amountTok.split >= 2 && amountTok.split <= 9) split = { n: amountTok.split };
        else if (amountTok.split !== 1) warnings.push("Chia cho " + amountTok.split + " người không hợp lý — bỏ qua phần chia");
      }
      if (amountTok.third !== undefined && !amountTok.dateLike) warnings.push("Bỏ qua '/" + amountTok.third + "' thừa");
    } else {
      warnings.push("Chưa thấy số tiền");
    }

    /* 5. Nhóm: "nhóm Phòng trọ" hoặc "@Phòng trọ" — chia cho mọi thành viên của nhóm. */
    var groupHit = null;
    (doc.groups || []).forEach(function (g) {
      if (groupHit || g.archived) return;
      var w = fold(g.name).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      if (!w) return;
      var gm = new RegExp("(^|[^a-z0-9])((?:nhom\\s+|@)" + reEsc(w).replace(/ /g, "\\s+") + ")(?![a-z0-9])").exec(work);
      if (gm) {
        var s4 = gm.index + gm[1].length;
        groupHit = g;
        spans.push({ kind: "group", start: s4, end: s4 + gm[2].length });
        work = blank(work, s4, s4 + gm[2].length);
      }
    });

    /* 6. Ai trả: "@Phúc", "Phúc trả", hậu tố chữ cái sau /n ("57/2P"), "tôi trả". */
    var people = doc.people.filter(function (p) { return !p.archived; });
    people.forEach(function (p) {
      if (payerId) return;
      var words = [fold(p.name).replace(/[^a-z0-9 ]+/g, " ").trim()];
      var parts = words[0].split(" ").filter(Boolean);
      if (parts.length > 1) words.push(parts[parts.length - 1]);
      words.forEach(function (w) {
        if (payerId || !w) return;
        var re = new RegExp("(^|[^a-z0-9])(@" + reEsc(w) + "|" + reEsc(w) + "\\s+(?:da\\s+)?(?:tra|thanh toan))(?![a-z0-9])");
        var pm = re.exec(work);
        if (pm) {
          var s2 = pm.index + pm[1].length;
          payerId = p.id;
          spans.push({ kind: "payer", start: s2, end: s2 + pm[2].length });
          work = blank(work, s2, s2 + pm[2].length);
        }
      });
    });
    if (!payerId && /(^|[^a-z0-9])(toi|minh|em|anh|chi)\s+(da\s+)?tra(?![a-z0-9])/.test(work)) {
      payerId = me;
      var tm = /(^|[^a-z0-9])((?:toi|minh|em|anh|chi)\s+(?:da\s+)?tra)(?![a-z0-9])/.exec(work);
      if (tm) { var s3 = tm.index + tm[1].length; spans.push({ kind: "payer", start: s3, end: s3 + tm[2].length }); work = blank(work, s3, s3 + tm[2].length); }
    }
    if (!payerId && amountTok && amountTok.letter) {
      var cands = people.filter(function (p) { return fold(p.name).charAt(0) === amountTok.letter; });
      if (cands.length === 1) payerId = cands[0].id;
      else warnings.push("Chưa rõ ai trả (" + amountTok.letter.toUpperCase() + ")");
    }

    /* 7. Chia tiền: tìm người tham gia. */
    if (groupHit) {
      var gids = activeMembers(doc, groupHit);
      if (gids.length < 2) { warnings.push("Nhóm " + groupHit.name + " chưa có thành viên nào để chia"); split = null; }
      else {
        if (split && split.n !== gids.length) warnings.push("Nhóm " + groupHit.name + " có " + gids.length + " người — chia " + gids.length);
        if (payerId && gids.indexOf(payerId) === -1) warnings.push("Người trả không thuộc nhóm " + groupHit.name);
        split = { n: gids.length, payerId: payerId || me, participantIds: gids, groupId: groupHit.id };
      }
    } else if (split) {
      var list = partners(doc), ids = [me];
      list.forEach(function (p) { if (ids.length < split.n && ids.indexOf(p.id) === -1) ids.push(p.id); });
      if (payerId && ids.indexOf(payerId) === -1) { if (ids.length >= split.n) ids.pop(); ids.push(payerId); }
      if (ids.length < split.n) warnings.push("Mới có " + ids.length + " người — thêm người ở mục Chia tiền để chia " + split.n);
      split = tagDefaultGroup({ n: split.n, payerId: payerId || me, participantIds: ids }, doc);
    } else if (payerId && payerId !== me) {
      // "Phúc trả" mà không nói chia: coi là chia đôi với người đó.
      split = tagDefaultGroup({ n: 2, payerId: payerId, participantIds: [me, payerId] }, doc);
    }

    /* 8. Phần còn lại là ghi chú. */
    var note = "";
    for (var k = 0; k < src.length; k++) note += work.charAt(k) === " " && f.charAt(k) !== " " ? " " : src.charAt(k);
    note = note.replace(/\s+/g, " ").replace(/^[\s:;,\-–—=()]+|[\s:;,\-–—=()]+$/g, "").trim();

    var nf = fold(note);
    var type = "expense";
    if (INCOME_RE.test(nf)) type = "income";
    else if (TRANSFER_RE.test(nf) || SAVINGS_RE.test(nf)) type = "transfer";
    if (type === "income" && split) { split = null; }

    var categoryId = type === "transfer" ? null : suggestCategory(note, type, doc);

    return {
      type: type, amount: amount, date: date || ctx.today, dateGiven: date !== null,
      note: note, categoryId: categoryId, split: split, warnings: warnings, spans: spans
    };
  }

  /**
   * Biến kết quả phân tích thành giao dịch (chưa có id). Chia đều không lệch đồng.
   * Trả null khi thiếu số tiền hoặc là gợi ý chuyển khoản (giao diện tự xử lý).
   */
  function toTx(p, doc) {
    if (!p || !p.amount || p.type === "transfer") return null;
    var me = doc.settings.meId || "p_me";
    var tx = {
      type: p.type, date: p.date, amount: p.amount, note: p.note, tags: [],
      categoryId: p.categoryId || (p.type === "income" ? "c_income_other" : "c_other"),
      accountId: QL.model.find(doc.accounts, doc.settings.defaultAccountId) ? doc.settings.defaultAccountId : (doc.accounts[0] && doc.accounts[0].id)
    };
    if (p.split && p.type === "expense") {
      var ids = p.split.participantIds.slice();
      var parts = QL.money.allocate(p.amount, ids.map(function () { return 1; }));
      var shares = {};
      ids.forEach(function (id, i) { shares[id] = parts[i]; });
      tx.split = { paidBy: p.split.payerId, shares: shares };
      if (p.split.payerId !== me) tx.accountId = null;
      if (p.split.groupId) tx.groupId = p.split.groupId;
    }
    return tx;
  }

  /* ----------------------------------------------------------- nhiều dòng */
  var SKIP_RE = /^(thang\s*\d|tuan\s*\d|tong\b|chuyen\s+\S+\s*[:=]|ghi chu|notes?\b|chung\s*:|rieng\s*:|shopp?(ing)?\s+\d|\.{2,}|…|-{3,}|_{3,})/;
  var RANGE_RE = /^(t[2-7]|cn)(\s*[-–]\s*(t[2-7]|cn))?\s*:/;
  var LEAD_DATE = /^\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*[:\-–]\s*(.*)$/;

  /**
   * Phân tích nhiều dòng dán vào (FR-05). Mỗi dòng trả về một trong:
   *   ok      — hiểu được, có `tx`
   *   skip    — tiêu đề / tổng / ghi chú, bỏ qua
   *   unclear — có chữ nhưng không hiểu (thiếu số tiền, hoặc nhiều ngày gộp một dòng)
   */
  function parseLines(text, ctx) {
    var rows = [];
    String(text == null ? "" : text).replace(/^﻿/, "").split(/\r?\n/).forEach(function (line, i) {
      var raw = line.trim();
      if (!raw) return;
      var row = { n: i + 1, line: raw, status: "unclear", reason: "", parsed: null, tx: null };
      rows.push(row);
      var nf = fold(raw);
      if (SKIP_RE.test(nf)) { row.status = "skip"; row.reason = "Tiêu đề / dòng tổng — bỏ qua"; return; }
      if (RANGE_RE.test(nf) && (nf.replace(RANGE_RE, "").match(/\d+/g) || []).length > 1) {
        row.reason = "Một dòng gộp nhiều ngày — hãy tách thành từng khoản"; return;
      }
      var body = raw, date = null, ld = LEAD_DATE.exec(raw);
      if (ld) {
        date = QL.dates.parseUser(ld[1], ctx.today);
        if (date) body = ld[2];
      }
      var p = parseQuick(body, ctx);
      if (!p || !p.amount) { row.reason = p && p.warnings.length ? p.warnings[0] : "Không thấy số tiền"; return; }
      if (date) { p.date = date; p.dateGiven = true; }
      row.parsed = p;
      row.tx = toTx(p, ctx.doc);
      if (!row.tx) { row.reason = "Đây là chuyển khoản — nhập ở mục Chuyển"; return; }
      row.status = "ok";
      row.reason = p.warnings.join("; ");
    });
    return rows;
  }

  /* ----------------------------------------------------------- từ AI */
  /**
   * Đề xuất của POST /ai/spending (máy chủ đã kiểm id) → các dòng xem trước giống parseLines, để
   * cùng một bảng "Nhập từ văn bản" cho chọn rồi mới lưu. Không đổi `doc`.
   * Người AI nhắc tên mà sổ chưa có → hẹn tạo (`people`); dòng nào cần họ thì `needs` liệt kê id.
   * Mọi giao dịch đi qua validateTx như khi gõ tay (trên sổ đã thêm những người hẹn tạo).
   * Trả {rows: [{n, line, status: ok|unclear|skip, reason, tx, needs, confidence, ai}], people: [{id, name}]}.
   */
  function fromAi(res, doc, today) {
    var Mo = QL.model, me = doc.settings.meId || "p_me", rows = [], made = {}, people = [];
    function idOf(ref) {
      if (!ref) return null;
      if (ref.id) return Mo.find(doc.people, ref.id) ? ref.id : null;
      var name = String(ref.name || "").replace(/\s+/g, " ").trim().slice(0, 60), f = fold(name);
      if (!f) return null;
      var hit = doc.people.filter(function (x) { return fold(x.name) === f; })[0];
      if (hit) return hit.id;
      if (!made[f]) { made[f] = { id: Mo.uid("p"), name: name }; people.push(made[f]); }
      return made[f].id;
    }
    function uniq(list) { var out = []; list.forEach(function (x) { if (x && out.indexOf(x) === -1) out.push(x); }); return out; }
    var defAcc = Mo.find(doc.accounts, doc.settings.defaultAccountId) ? doc.settings.defaultAccountId : (doc.accounts[0] && doc.accounts[0].id);

    ((res && res.transactions) || []).forEach(function (t, i) {
      var row = { n: i + 1, line: String(t.source || t.note || ""), status: "ok", reason: "", tx: null, needs: [], confidence: typeof t.confidence === "number" ? t.confidence : null, ai: true };
      var type = t.type === "income" ? "income" : "expense", note = String(t.note || "").trim().slice(0, 300), warns = (t.warnings || []).slice();
      var tx = { type: type, date: QL.dates.isValid(t.date) ? t.date : today, amount: t.amount, note: note, tags: [],
        categoryId: t.categoryId && usable(doc, t.categoryId, type) ? t.categoryId : (suggestCategory(note, type, doc) || (type === "income" ? "c_income_other" : "c_other")),
        accountId: t.accountId && Mo.find(doc.accounts, t.accountId) ? t.accountId : defAcc, toAccountId: null };
      if (type === "expense") {
        var payer = idOf(t.paidBy) || me;
        var group = t.groupId ? Mo.find(doc.groups || [], t.groupId) : null;
        if (group && group.archived) group = null;
        var mapped = (t.participants || []).map(idOf), ids = uniq(mapped), dropped = mapped.filter(function (x) { return !x; }).length;
        if (dropped) warns.push("Bỏ " + dropped + " người không còn trong sổ");
        if (!ids.length && t.shares && t.shares.length) ids = uniq(t.shares.map(idOf));
        if (!ids.length && group) ids = activeMembers(doc, group);
        if (!ids.length && t.splitCount >= 2) {
          ids = [me];
          partners(doc).forEach(function (p) { if (ids.length < t.splitCount && ids.indexOf(p.id) === -1) ids.push(p.id); });
          if (ids.length < t.splitCount) warns.push("Mới có " + ids.length + " người để chia " + t.splitCount);
        }
        if (ids.length && !(ids.length === 1 && ids[0] === me && payer === me)) {
          var shares = {};
          if (t.shares && t.shares.length) t.shares.forEach(function (x) { var id = idOf(x); if (id) shares[id] = (shares[id] || 0) + x.amount; });
          else { var parts = QL.money.allocate(tx.amount, ids.map(function () { return 1; })); ids.forEach(function (id, k) { shares[id] = parts[k]; }); }
          tx.split = { paidBy: payer, shares: shares };
          if (payer !== me) tx.accountId = null;
          var everyone = Object.keys(shares).concat(payer);
          var dg = defaultGroup(doc), inGroup = function (g) { return everyone.every(function (id) { return id === me || g.memberIds.indexOf(id) !== -1; }); };
          if (group) { tx.groupId = group.id; if (!inGroup(group)) warns.push("Có người ngoài nhóm " + group.name); }
          else if (dg && Object.keys(shares).length > 1 && inGroup(dg)) tx.groupId = dg.id;
        }
        row.needs = people.filter(function (x) { return tx.split && (tx.split.paidBy === x.id || tx.split.shares[x.id] !== undefined); }).map(function (x) { return x.id; });
      }
      row.tx = tx;
      row.reason = warns.join("; ");
      rows.push(row);
    });
    // Kiểm như giao dịch gõ tay, trên sổ đã có những người hẹn tạo.
    var preview = people.reduce(function (x, p) { return Mo.upsert(x, "people", { id: p.id, name: p.name, archived: false }); }, doc);
    rows.forEach(function (r) {
      var errs = Mo.validateTx(Object.assign({ id: "ai" }, r.tx), preview);
      if (errs.length) { r.status = "unclear"; r.reason = errs[0] + (r.reason ? "; " + r.reason : ""); r.tx = null; }
    });
    ((res && res.ignored) || []).forEach(function (x) { rows.push({ n: rows.length + 1, line: String(x.text || ""), status: "skip", reason: String(x.reason || "Bỏ qua"), tx: null, needs: [], ai: true }); });
    return { rows: rows, people: people };
  }

  /** Những gì AI được biết về sổ: TÊN + id (không số dư, không giao dịch cũ) — đúng giới hạn của POST /ai/spending. */
  function aiContext(doc) {
    var me = doc.settings.meId || "p_me";
    var live = function (x) { return !x.archived; };
    return {
      me: me,
      categories: doc.categories.filter(live).slice(0, 120).map(function (c) { return { id: c.id, name: c.name, kind: c.kind }; }),
      accounts: doc.accounts.filter(function (a) { return live(a) && a.kind !== "savings"; }).slice(0, 60).map(function (a) { return { id: a.id, name: a.name }; }),
      people: doc.people.filter(function (p) { return live(p) && p.id !== me; }).slice(0, 200).map(function (p) { return { id: p.id, name: p.name }; }),
      groups: (doc.groups || []).filter(live).slice(0, 50).map(function (g) { return { id: g.id, name: g.name, memberIds: g.memberIds.slice(0, 40) }; })
    };
  }

  QL.parser = { parseQuick: parseQuick, parseLines: parseLines, toTx: toTx, suggestCategory: suggestCategory, partners: partners, defaultGroup: defaultGroup, activeMembers: activeMembers,
    fromAi: fromAi, aiContext: aiContext };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.parser;
})(typeof globalThis !== "undefined" ? globalThis : this);
