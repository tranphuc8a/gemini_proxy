/* ledger.js — sổ cái: từ danh sách giao dịch ra mọi con số người dùng nhìn thấy.

   Hai con số KHÁC NHAU được giữ riêng (design §3.2):
     · dòng tiền  — tài khoản của tôi giảm đúng số tiền tôi đã trả;
     · chi của tôi — chỉ phần của tôi trong một khoản chi chung.
   Báo cáo chi tiêu dùng "chi của tôi"; số dư tài khoản dùng dòng tiền.
   Thuần: không DOM, không storage, không đọc đồng hồ (nhận `today` làm tham số). */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  function meOf(doc) { return (doc.settings && doc.settings.meId) || "p_me"; }
  function byId(list) { var m = {}; list.forEach(function (r) { m[r.id] = r; }); return m; }

  /* ------------------------------------------------------------------- effects */
  /**
   * Tác động của MỘT giao dịch (bảng §3.2):
   *   cash   — [{accountId, delta}] thay đổi số dư tài khoản
   *   spend  — chi của tôi (đồng); income — thu của tôi
   *   people — {personId: delta} thay đổi "người đó nợ tôi" (dương = họ nợ tôi thêm)
   */
  function effects(tx, meId) {
    var e = { cash: [], spend: 0, income: 0, people: {} };
    if (tx.type === "expense") {
      var sp = tx.split;
      var paidByOther = !!sp && sp.paidBy !== meId;
      if (!paidByOther && tx.accountId) e.cash.push({ accountId: tx.accountId, delta: -tx.amount });
      if (!sp) { e.spend = tx.amount; return e; }
      var mine = sp.shares[meId] || 0;
      e.spend = mine;
      if (sp.paidBy === meId) {
        Object.keys(sp.shares).forEach(function (pid) {
          if (pid !== meId && sp.shares[pid]) e.people[pid] = (e.people[pid] || 0) + sp.shares[pid];
        });
      } else if (mine) {
        e.people[sp.paidBy] = (e.people[sp.paidBy] || 0) - mine;
      }
    } else if (tx.type === "income") {
      e.cash.push({ accountId: tx.accountId, delta: tx.amount });
      e.income = tx.amount;
    } else if (tx.type === "transfer") {
      e.cash.push({ accountId: tx.accountId, delta: -tx.amount });
      e.cash.push({ accountId: tx.toAccountId, delta: tx.amount });
    } else if (tx.type === "settle") {
      var sign = tx.direction === "in" ? 1 : -1;
      e.cash.push({ accountId: tx.accountId, delta: sign * tx.amount });
      e.people[tx.personId] = -sign * tx.amount;
    }
    return e;
  }

  /* -------------------------------------------------------------------- số dư */
  function accountBalances(doc) {
    var me = meOf(doc), bal = {};
    doc.accounts.forEach(function (a) { bal[a.id] = a.openingBalance || 0; });
    doc.transactions.forEach(function (tx) {
      effects(tx, me).cash.forEach(function (c) { if (c.accountId in bal) bal[c.accountId] += c.delta; });
    });
    return bal;
  }
  function netWorth(doc, balances) {
    var b = balances || accountBalances(doc), t = 0;
    for (var id in b) t += b[id];
    return t;
  }

  /**
   * Số dư từng người: dương = người đó nợ tôi; âm = tôi nợ người đó.
   * Có `groupId`: chỉ tính giao dịch của nhóm đó (khoản chi chung + thanh toán ghi vào nhóm).
   */
  function personBalances(doc, groupId) {
    var me = meOf(doc), bal = {};
    if (groupId) groupMembers(doc, groupId).forEach(function (id) { if (id !== me) bal[id] = 0; });
    else doc.people.forEach(function (p) { if (p.id !== me) bal[p.id] = 0; });
    doc.transactions.forEach(function (tx) {
      if (groupId && tx.groupId !== groupId) return;
      var pe = effects(tx, me).people;
      for (var pid in pe) {
        if (pid in bal) bal[pid] += pe[pid];
        else if (groupId) bal[pid] = pe[pid];        // đã rời nhóm nhưng còn khoản cũ trong nhóm
      }
    });
    return bal;
  }
  function settlementOf(balance) {
    if (balance > 0) return { direction: "receive", amount: balance };
    if (balance < 0) return { direction: "pay", amount: -balance };
    return { direction: "even", amount: 0 };
  }

  /* ----------------------------------------------------------------- tổng kỳ */
  function firstDate(doc) {
    var f = null;
    doc.transactions.forEach(function (t) { if (f === null || t.date < f) f = t.date; });
    return f;
  }

  /**
   * Tổng hợp một kỳ. `per` là kết quả của dates.period(); `today` để tính trung bình/ngày
   * (chỉ tính tới hôm nay, không chia cho cả những ngày chưa tới).
   */
  function periodSummary(doc, per, today) {
    var D = QL.dates, me = meOf(doc);
    var out = {
      income: 0, expense: 0, net: 0, count: 0,
      byCategory: {}, incomeByCategory: {}, byDay: {}, byWeekday: [0, 0, 0, 0, 0, 0, 0],
      groups: { weekdays: 0, saturday: 0, sunday: 0 }
    };
    doc.transactions.forEach(function (tx) {
      if (tx.date < per.from || tx.date > per.to) return;
      var e = effects(tx, me);
      if (e.spend > 0) {
        out.expense += e.spend; out.count++;
        var c = tx.categoryId || "";
        out.byCategory[c] = (out.byCategory[c] || 0) + e.spend;
        out.byDay[tx.date] = (out.byDay[tx.date] || 0) + e.spend;
        var w = D.weekday(tx.date);
        out.byWeekday[w] += e.spend;
        out.groups[D.weekdayGroup(w)] += e.spend;
      }
      if (e.income > 0) {
        out.income += e.income; out.count++;
        var ic = tx.categoryId || "";
        out.incomeByCategory[ic] = (out.incomeByCategory[ic] || 0) + e.income;
      }
    });
    out.net = out.income - out.expense;

    var start = per.kind === "all" ? (firstDate(doc) || today) : per.from;
    var end = per.to < today ? per.to : today;
    out.days = end < start ? 1 : D.diffDays(start, end) + 1;
    out.avgPerDay = Math.round(out.expense / out.days);

    // Số ngày mỗi nhóm có mặt trong kỳ (tới hôm nay) để tính trung bình/ngày từng nhóm.
    out.groupDays = { weekdays: 0, saturday: 0, sunday: 0 };
    if (out.days <= 4000 && end >= start) {
      for (var d = start, n = 0; d <= end && n < 4000; d = D.addDays(d, 1), n++) out.groupDays[D.weekdayGroup(D.weekday(d))]++;
    }
    out.categories = rank(out.byCategory, out.expense);
    out.incomeCategories = rank(out.incomeByCategory, out.income);
    return out;
  }

  function rank(map, total) {
    return Object.keys(map).map(function (id) {
      return { categoryId: id, amount: map[id], pct: total ? Math.round(map[id] * 1000 / total) / 10 : 0 };
    }).sort(function (a, b) { return b.amount - a.amount || (a.categoryId < b.categoryId ? -1 : 1); });
  }

  /** Kỳ trước + hiệu số so với kỳ trước (null khi kỳ là "tất cả"). */
  function compareWithPrevious(doc, per, today) {
    if (per.kind === "all") return null;
    var prev = QL.dates.shift(per, -1);
    var a = periodSummary(doc, per, today), b = periodSummary(doc, prev, today);
    function pct(x, y) { return y ? Math.round((x - y) * 1000 / y) / 10 : null; }
    return {
      previous: b, period: prev,
      expenseDelta: a.expense - b.expense, expensePct: pct(a.expense, b.expense),
      incomeDelta: a.income - b.income, incomePct: pct(a.income, b.income)
    };
  }

  /** n tháng kết thúc ở tháng chứa `endIso`, cũ → mới. */
  function monthlySeries(doc, endIso, n) {
    var D = QL.dates, me = meOf(doc);
    var first = D.addMonths(D.startOfMonth(endIso), -(n - 1));
    var rows = [], idx = {};
    for (var i = 0; i < n; i++) {
      var key = D.monthKey(D.addMonths(first, i));
      idx[key] = rows.length; rows.push({ key: key, income: 0, expense: 0 });
    }
    doc.transactions.forEach(function (tx) {
      var r = rows[idx[D.monthKey(tx.date)]];
      if (!r) return;
      var e = effects(tx, me);
      r.expense += e.spend; r.income += e.income;
    });
    return rows;
  }

  function topExpenses(doc, per, n) {
    var me = meOf(doc), list = [];
    doc.transactions.forEach(function (tx) {
      if (tx.date < per.from || tx.date > per.to) return;
      var e = effects(tx, me);
      if (e.spend > 0) list.push({ tx: tx, amount: e.spend });
    });
    list.sort(function (a, b) { return b.amount - a.amount || (a.tx.date < b.tx.date ? 1 : -1); });
    return list.slice(0, n);
  }

  /* ------------------------------------------------------------------- chia tiền */
  /** Các giao dịch liên quan tới một người trong kỳ, kèm tác động lên số dư của họ. */
  function sharedWith(doc, personId, per) {
    var me = meOf(doc), items = [], net = 0;
    doc.transactions.forEach(function (tx) {
      if (per && (tx.date < per.from || tx.date > per.to)) return;
      var d = effects(tx, me).people[personId];
      if (d) { items.push({ tx: tx, delta: d }); net += d; }
    });
    items.sort(function (a, b) { return a.tx.date < b.tx.date ? -1 : (a.tx.date > b.tx.date ? 1 : 0); });
    return { items: items, net: net };
  }

  /* ------------------------------------------------------------------- nhóm */
  function groupOf(doc, group) { return typeof group === "string" ? QL.model.find(doc.groups || [], group) : group || null; }

  /** Thành viên của nhóm: tôi trước, rồi những người còn trong sổ (giữ thứ tự của nhóm). */
  function groupMembers(doc, group) {
    var g = groupOf(doc, group), me = meOf(doc);
    if (!g) return [];
    var ppl = byId(doc.people);
    return [me].concat(g.memberIds.filter(function (id) { return ppl[id] && id !== me; }));
  }

  /** Các nhóm (chưa lưu trữ, trừ khi `withArchived`) có người này. */
  function groupsOfPerson(doc, personId, withArchived) {
    return (doc.groups || []).filter(function (g) { return (withArchived || !g.archived) && g.memberIds.indexOf(personId) !== -1; });
  }

  /** Ai bỏ tiền ra trong một giao dịch: người trả khoản chi chung, hoặc người chuyển tiền khi thanh toán nợ. */
  function payerOf(tx, me) {
    if (tx.type === "settle") return tx.direction === "in" ? tx.personId : me;
    return tx.split ? tx.split.paidBy : me;
  }
  function involves(tx, personId) {
    return tx.personId === personId || !!(tx.split && (tx.split.paidBy === personId || tx.split.shares[personId] !== undefined));
  }

  /**
   * Sổ khoản chung theo phạm vi, có lọc — cho hộp "Các khoản chung" (người hoặc nhóm).
   *   scope: {personId} — mọi khoản làm đổi số nợ giữa tôi và người đó
   *          {groupId}  — mọi khoản ghi vào nhóm (kể cả khoản tôi không tham gia)
   *   f: {from, to, kind: "expense"|"settle", payer: "me"|"other", memberId, groupId: id|"none", q}
   * Mỗi dòng có `delta` = tác động lên "họ nợ tôi" (nhóm: cộng cả nhóm).
   * Trả {items (mới → cũ), count, net, spend, mine, paidByMe}: tổng tính trên đúng các dòng đã lọc.
   */
  function sharedLedger(doc, scope, f) {
    f = f || {};
    var me = meOf(doc), items = [], net = 0, spend = 0, mine = 0, paidByMe = 0;
    var ctx = { cats: byId(doc.categories), accs: byId(doc.accounts), people: byId(doc.people) };
    var qWords = f.q ? QL.text.words(f.q) : null, sig = qWords && qWords.length ? ctxSig(ctx) : "";
    doc.transactions.forEach(function (tx) {
      var delta = 0, pe;
      if (scope.groupId) {
        if (tx.groupId !== scope.groupId) return;
        pe = effects(tx, me).people;
        for (var pid in pe) delta += pe[pid];
      } else {
        delta = effects(tx, me).people[scope.personId] || 0;
        if (!delta) return;
      }
      if (f.from && tx.date < f.from) return;
      if (f.to && tx.date > f.to) return;
      if (f.kind && tx.type !== f.kind) return;
      var payer = payerOf(tx, me);
      if (f.payer === "me" && payer !== me) return;
      if (f.payer === "other" && payer === me) return;
      if (f.memberId && !involves(tx, f.memberId)) return;
      if (f.groupId === "none" && tx.groupId) return;
      if (f.groupId && f.groupId !== "none" && tx.groupId !== f.groupId) return;
      if (qWords && qWords.length) {
        var hw = wordsOf(tx, ctx, sig);
        if (!qWords.every(function (w) { return hw.some(function (x) { return x.indexOf(w) === 0; }); })) return;
      }
      items.push({ tx: tx, delta: delta, payer: payer });
      net += delta;
      if (tx.type === "expense") {
        spend += tx.amount;
        mine += tx.split ? (tx.split.shares[me] || 0) : tx.amount;
        if (payer === me) paidByMe += tx.amount;
      }
    });
    items.sort(function (a, b) {
      if (a.tx.date !== b.tx.date) return a.tx.date < b.tx.date ? 1 : -1;
      var ca = a.tx.createdAt || "", cb = b.tx.createdAt || "";
      return ca < cb ? 1 : (ca > cb ? -1 : 0);
    });
    return { items: items, count: items.length, net: net, spend: spend, mine: mine, paidByMe: paidByMe };
  }

  /**
   * Cách chuyển tiền để mọi người về 0. `rows` [{id, net}] với Σ net = 0 (dương = được nhận).
   * Tham lam: người nợ nhiều nhất trả người được nhận nhiều nhất → tối đa n−1 lần chuyển. Hoà thì theo thứ tự đầu vào.
   */
  function settleUp(rows) {
    function side(sign) {
      return rows.map(function (r, i) { return { id: r.id, left: sign * r.net, i: i }; }).filter(function (x) { return x.left > 0; });
    }
    var debt = side(-1), cred = side(1), out = [];
    function order(a, b) { return b.left - a.left || a.i - b.i; }
    while (debt.length && cred.length) {
      debt.sort(order); cred.sort(order);
      var d = debt[0], c = cred[0], x = Math.min(d.left, c.left);
      out.push({ from: d.id, to: c.id, amount: x });
      d.left -= x; c.left -= x;
      if (!d.left) debt.shift();
      if (!c.left) cred.shift();
    }
    return out;
  }

  /**
   * Đối chiếu một nhóm trong kỳ (cách nhìn "sổ của tôi" — design §3.6):
   *   mỗi người: paid (đã trả các khoản chung), share (phần phải chịu), sent/received (thanh toán ghi vào nhóm),
   *   net = paid − share + sent − received (dương = nhóm nợ người đó).
   * Cách chuyển: phần của TÔI theo đúng số nợ từng cặp trong sổ (để ghi nhận khớp sổ), phần còn lại
   * giữa những người khác thì gộp cho ít lần chuyển nhất. Tiền hai người khác trả cho nhau không có trong sổ.
   */
  function groupStatement(doc, groupId, per) {
    var me = meOf(doc), g = groupOf(doc, groupId);
    var rows = {}, order = [];
    function row(id) {
      if (!rows[id]) { rows[id] = { id: id, paid: 0, share: 0, sent: 0, received: 0, net: 0 }; order.push(id); }
      return rows[id];
    }
    groupMembers(doc, g).forEach(row);
    if (!rows[me]) row(me);
    var spend = 0, count = 0, pair = {};
    doc.transactions.forEach(function (tx) {
      if (!g || tx.groupId !== g.id) return;
      if (per && (tx.date < per.from || tx.date > per.to)) return;
      if (tx.type === "expense" && tx.split) {
        count++; spend += tx.amount;
        row(tx.split.paidBy).paid += tx.amount;
        for (var p in tx.split.shares) row(p).share += tx.split.shares[p];
      } else if (tx.type === "settle") {
        count++;
        row(payerOf(tx, me)).sent += tx.amount;
        row(tx.direction === "in" ? me : tx.personId).received += tx.amount;
      } else return;
      var pe = effects(tx, me).people;
      for (var pid in pe) pair[pid] = (pair[pid] || 0) + pe[pid];
    });
    var list = order.map(function (id) { var r = rows[id]; r.net = r.paid - r.share + r.sent - r.received; return r; });
    var transfers = [], rest = {};
    list.forEach(function (r) { rest[r.id] = r.net; });
    order.forEach(function (id) {
      var b = pair[id] || 0;
      if (id === me || !b) return;
      // b > 0: người đó nợ tôi b → họ chuyển cho tôi; b < 0: tôi chuyển cho họ.
      if (b > 0) { transfers.push({ from: id, to: me, amount: b }); rest[id] += b; rest[me] -= b; }
      else { transfers.push({ from: me, to: id, amount: -b }); rest[me] -= b; rest[id] += b; }
    });
    transfers = transfers.concat(settleUp(order.filter(function (id) { return id !== me; }).map(function (id) { return { id: id, net: rest[id] }; })));
    return { group: g, members: list, spend: spend, count: count, pair: pair, transfers: transfers };
  }

  /** Tin nhắn quyết toán cho cả nhóm (dán vào nhóm chat). */
  function groupSettlementMessage(doc, groupId, per) {
    var M = QL.money, D = QL.dates, me = meOf(doc), st = groupStatement(doc, groupId, per);
    if (!st.group) return "";
    var ppl = byId(doc.people), cat = byId(doc.categories);
    function nm(id) { return ppl[id] ? ppl[id].name : "(đã xoá)"; }
    var lines = ["Quyết toán nhóm " + st.group.name + " — " + per.label];
    var led = sharedLedger(doc, { groupId: st.group.id }, { from: per.from, to: per.to }).items.slice().reverse();
    var LIMIT = 40;
    led.slice(0, LIMIT).forEach(function (it) {
      var tx = it.tx;
      if (tx.type === "settle") {
        lines.push("· " + D.dm(tx.date) + " " + nm(payerOf(tx, me)) + " đã chuyển cho " + nm(tx.direction === "in" ? me : tx.personId) + " " + M.format(tx.amount));
      } else {
        var what = tx.note || (cat[tx.categoryId] ? cat[tx.categoryId].name : "Khoản chung");
        lines.push("· " + D.dm(tx.date) + " " + what + ": " + nm(tx.split.paidBy) + " trả " + M.format(tx.amount) + " (chia " + Object.keys(tx.split.shares).length + ")");
      }
    });
    if (led.length > LIMIT) lines.push("· … và " + (led.length - LIMIT) + " khoản khác");
    if (!led.length) lines.push("(Không có khoản chung nào trong kỳ)");
    lines.push("");
    lines.push("Tổng chi " + M.format(st.spend) + " · " + st.count + " khoản");
    st.members.forEach(function (r) {
      if (!r.paid && !r.share && !r.sent && !r.received) return;
      lines.push(nm(r.id) + ": đã trả " + M.format(r.paid) + ", phần " + M.format(r.share) +
        (r.sent || r.received ? ", đã chuyển " + M.format(r.sent) + ", đã nhận " + M.format(r.received) : "") +
        (r.net > 0 ? " → được nhận " + M.format(r.net) : r.net < 0 ? " → cần trả " + M.format(-r.net) : " → hoà"));
    });
    lines.push("");
    if (st.transfers.length) {
      var mineT = st.transfers.filter(function (t) { return t.from === me || t.to === me; }), restT = st.transfers.filter(function (t) { return t.from !== me && t.to !== me; });
      var line = function (t) { lines.push("→ " + nm(t.from) + " chuyển cho " + nm(t.to) + " " + M.format(t.amount)); };
      lines.push("Chuyển tiền:");
      if (mineT.length && restT.length) lines.push("Với " + nm(me) + ":");
      mineT.forEach(line);
      if (mineT.length && restT.length) lines.push("Giữa những người còn lại:");
      restT.forEach(line);
    } else lines.push("→ Cả nhóm đã hoà trong kỳ");
    return lines.join("\n");
  }

  /** Tin nhắn quyết toán sao chép được (FR-12). */
  function settlementMessage(doc, personId, per) {
    var M = QL.money, D = QL.dates, me = meOf(doc);
    var person = QL.model.find(doc.people, personId);
    var name = person ? person.name : "bạn";
    var inPer = sharedWith(doc, personId, per);
    var all = personBalances(doc)[personId] || 0;
    var cat = byId(doc.categories);
    var lines = ["Quyết toán " + per.label + " với " + name];
    var paidByMe = 0, theirShareOfMine = 0, paidByThem = 0, myShareOfTheirs = 0, paidIn = 0, paidOut = 0;
    inPer.items.forEach(function (it) {
      var tx = it.tx, what = tx.note || (cat[tx.categoryId] ? cat[tx.categoryId].name : "Khoản chung");
      if (tx.type === "settle") {
        if (tx.direction === "in") paidIn += tx.amount; else paidOut += tx.amount;
        lines.push("· " + D.dm(tx.date) + " " + (tx.direction === "in" ? name + " đã chuyển " : "Bạn đã chuyển ") + M.format(tx.amount));
      } else if (tx.split.paidBy === me) {
        paidByMe += tx.amount; theirShareOfMine += tx.split.shares[personId] || 0;
        lines.push("· " + D.dm(tx.date) + " " + what + ": bạn trả " + M.format(tx.amount) + " (phần " + name + " " + M.format(tx.split.shares[personId] || 0) + ")");
      } else {
        paidByThem += tx.amount; myShareOfTheirs += tx.split.shares[me] || 0;
        lines.push("· " + D.dm(tx.date) + " " + what + ": " + name + " trả " + M.format(tx.amount) + " (phần bạn " + M.format(tx.split.shares[me] || 0) + ")");
      }
    });
    if (inPer.items.length === 0) lines.push("(Không có khoản chung nào trong kỳ)");
    lines.push("");
    lines.push("Bạn trả " + M.format(paidByMe) + " · " + name + " trả " + M.format(paidByThem));
    var s = settlementOf(inPer.net);
    lines.push(s.direction === "receive" ? "→ " + name + " chuyển cho bạn " + M.format(s.amount) + " (trong kỳ)"
      : s.direction === "pay" ? "→ Bạn chuyển cho " + name + " " + M.format(s.amount) + " (trong kỳ)"
      : "→ Hai bên hoà trong kỳ");
    var t = settlementOf(all);
    if (t.direction !== "even") {
      lines.push("Còn lại tính tất cả các kỳ: " + (t.direction === "receive" ? name + " nợ bạn " : "bạn nợ " + name + " ") + M.format(t.amount));
    }
    return lines.join("\n");
  }

  /* ----------------------------------------------------------------- ngân sách */
  function budgetProgress(doc, monthIso, today) {
    var D = QL.dates, per = D.period("month", monthIso);
    var sum = periodSummary(doc, per, today), cats = byId(doc.categories);
    var inMonth = today >= per.from && today <= per.to;
    var daysLeft = inMonth ? D.diffDays(today, per.to) + 1 : 0;
    return doc.budgets.map(function (b) {
      var spent = b.categoryId ? (sum.byCategory[b.categoryId] || 0) : sum.expense;
      var pct = b.amount ? Math.round(spent * 1000 / b.amount) / 10 : 0;
      var remaining = b.amount - spent;
      return {
        budget: b, categoryId: b.categoryId, name: b.categoryId ? (cats[b.categoryId] ? cats[b.categoryId].name : "(đã xoá)") : "Tổng chi tiêu",
        amount: b.amount, spent: spent, remaining: remaining, pct: pct,
        status: spent >= b.amount ? "over" : (pct >= 80 ? "warn" : "ok"),
        perDay: inMonth && remaining > 0 && daysLeft > 0 ? Math.floor(remaining / daysLeft) : null
      };
    }).sort(function (a, b) { return (a.categoryId === null ? -1 : 0) - (b.categoryId === null ? -1 : 0) || b.pct - a.pct; });
  }

  /* ---------------------------------------------------------------- tiết kiệm */
  /**
   * Thông tin sổ tiết kiệm. `principal` là số dư hiện tại của tài khoản sổ.
   * Lãi đơn: gốc × lãi suất × số ngày / 365 (làm tròn đồng, không mất chính xác).
   */
  function savingsInfo(account, principal, today) {
    if (!account || !account.deposit) return null;
    var D = QL.dates, dp = account.deposit;
    var maturityOn = D.addMonths(dp.openedOn, dp.termMonths);
    var days = D.diffDays(dp.openedOn, maturityOn);
    var P = BigInt(Math.max(0, Math.round(principal))), bp = BigInt(Math.round(dp.rate * 100)), den = 10000n * 365n;
    var interest = Number((P * bp * BigInt(days) * 2n + den) / (2n * den));
    var tax = QL.money.mulDiv(interest, Math.round((dp.taxPct || 0) * 100), 10000);
    return {
      principal: principal, openedOn: dp.openedOn, maturityOn: maturityOn, termDays: days,
      interest: interest, tax: tax, netInterest: interest - tax, total: principal + interest - tax,
      daysLeft: D.diffDays(today, maturityOn),
      status: dp.closedOn ? "closed" : (today >= maturityOn ? "matured" : "active")
    };
  }

  /** Sổ sắp đáo hạn (hoặc đã đáo hạn mà chưa tất toán). */
  function depositAlerts(doc, today, withinDays) {
    var bal = accountBalances(doc), out = [];
    doc.accounts.forEach(function (a) {
      if (!a.deposit || a.deposit.closedOn) return;
      var info = savingsInfo(a, bal[a.id] || 0, today);
      if (info.daysLeft <= (withinDays == null ? 30 : withinDays)) out.push({ account: a, info: info });
    });
    return out.sort(function (a, b) { return a.info.daysLeft - b.info.daysLeft; });
  }

  /* -------------------------------------------------------------------- định kỳ */
  function occurrences(rule, today) {
    var D = QL.dates, out = [];
    var limit = rule.endOn && rule.endOn < today ? rule.endOn : today;
    if (rule.startOn > limit) return out;
    function ok(d) { return d >= rule.startOn && d <= limit && (!rule.lastDoneOn || d > rule.lastDoneOn); }
    if (rule.frequency === "weekly") {
      var d = D.addDays(rule.startOn, (rule.day - D.weekday(rule.startOn) + 7) % 7);
      for (; d <= limit && out.length < 12; d = D.addDays(d, 7)) if (ok(d)) out.push(d);
    } else {
      var p = D.parse(rule.startOn);
      for (var k = 0; k < 600 && out.length < 12; k++) {
        var first = D.addMonths(D.make(p.y, p.m, 1), k);
        var q = D.parse(first);
        var day = Math.min(rule.day, D.daysInMonth(q.y, q.m));
        var cand = D.make(q.y, q.m, day);
        if (cand > limit) break;
        if (ok(cand)) out.push(cand);
      }
    }
    return out;
  }

  /** Mọi lần đến hạn chưa xử lý tính tới `today` (tối đa 12 lần/quy tắc). */
  function dueRecurring(doc, today) {
    var out = [];
    doc.recurring.forEach(function (r) {
      if (!r.active) return;
      occurrences(r, today).forEach(function (d) { out.push({ rule: r, dueOn: d }); });
    });
    return out.sort(function (a, b) { return a.dueOn < b.dueOn ? -1 : (a.dueOn > b.dueOn ? 1 : 0); });
  }

  /* -------------------------------------------------------------- lọc / tìm kiếm */
  /* Từ đã bỏ dấu của từng giao dịch, nhớ theo đối tượng giao dịch (bất biến) + chữ ký tên danh mục/tài khoản/người.
     Không có nó, mỗi phím gõ vào ô tìm tách lại chữ của cả nghìn giao dịch (~260 ms với 10.000 khoản). */
  var wordCache = typeof WeakMap === "function" ? new WeakMap() : null;
  function ctxSig(ctx) {
    var s = "";
    [ctx.cats, ctx.accs, ctx.people].forEach(function (m) { for (var id in m) s += id + "=" + m[id].name + "|"; });
    return s;
  }
  function wordsOf(tx, ctx, sig) {
    var hit = wordCache && wordCache.get(tx);
    if (hit && hit.sig === sig) return hit.words;
    var words = QL.text.words(haystack(tx, ctx));
    if (wordCache) wordCache.set(tx, { sig: sig, words: words });
    return words;
  }

  function haystack(tx, ctx) {
    var parts = [tx.note || "", (tx.tags || []).join(" "), String(tx.amount)];
    var c = ctx.cats[tx.categoryId]; if (c) parts.push(c.name);
    var a = ctx.accs[tx.accountId]; if (a) parts.push(a.name);
    if (tx.split) Object.keys(tx.split.shares).forEach(function (pid) { var p = ctx.people[pid]; if (p) parts.push(p.name); });
    if (tx.personId && ctx.people[tx.personId]) parts.push(ctx.people[tx.personId].name);
    return parts.join(" ");
  }

  /**
   * Lọc + sắp xếp (mới nhất trước). f: {from,to,q,type,categoryId,accountId,personId,min,max,sharedOnly}.
   * `min`/`max` so với số tiền gốc của giao dịch.
   */
  function filterTx(doc, f) {
    f = f || {};
    var ctx = { cats: byId(doc.categories), accs: byId(doc.accounts), people: byId(doc.people) };
    var qWords = f.q ? QL.text.words(f.q) : null, sig = qWords && qWords.length ? ctxSig(ctx) : "";
    var out = doc.transactions.filter(function (tx) {
      if (f.from && tx.date < f.from) return false;
      if (f.to && tx.date > f.to) return false;
      if (f.type && tx.type !== f.type) return false;
      if (f.categoryId && tx.categoryId !== f.categoryId) return false;
      if (f.accountId && tx.accountId !== f.accountId && tx.toAccountId !== f.accountId) return false;
      if (f.personId) {
        var inSplit = tx.split && (tx.split.shares[f.personId] !== undefined || tx.split.paidBy === f.personId);
        if (!inSplit && tx.personId !== f.personId) return false;
      }
      if (f.sharedOnly && !tx.split) return false;
      if (f.min != null && tx.amount < f.min) return false;
      if (f.max != null && tx.amount > f.max) return false;
      if (qWords && qWords.length) {
        var hw = wordsOf(tx, ctx, sig);
        if (!qWords.every(function (w) { return hw.some(function (x) { return x.indexOf(w) === 0; }); })) return false;
      }
      return true;
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || "") < (b.createdAt || "") ? 1 : ((a.createdAt || "") > (b.createdAt || "") ? -1 : 0);
    });
    return out;
  }

  /** Giao dịch đã có giống hệt (cùng ngày, loại, số tiền, ghi chú, danh mục) — để nhập lại không nhân đôi. */
  function findDuplicate(doc, tx) {
    var note = QL.text.fold(tx.note || "");
    for (var i = 0; i < doc.transactions.length; i++) {
      var t = doc.transactions[i];
      if (t.date === tx.date && t.type === tx.type && t.amount === tx.amount && QL.text.fold(t.note || "") === note &&
          (t.categoryId || null) === (tx.categoryId || null)) return t;
    }
    return null;
  }

  /** Nhóm theo ngày (đầu vào đã sắp mới → cũ): [{date, txs, expense, income}]. */
  function groupByDay(doc, txs) {
    var me = meOf(doc), groups = [], cur = null;
    txs.forEach(function (tx) {
      if (!cur || cur.date !== tx.date) { cur = { date: tx.date, txs: [], expense: 0, income: 0 }; groups.push(cur); }
      var e = effects(tx, me);
      cur.txs.push(tx); cur.expense += e.spend; cur.income += e.income;
    });
    return groups;
  }

  /* ------------------------------------------------------------- hoá đơn nhà trọ */
  /**
   * Chia hoá đơn điện/nước/trọ (FR-13): điện = (số mới − số cũ) × đơn giá, cộng các khoản
   * cố định, rồi chia đều cho `people` người mà tổng phần luôn bằng tổng hoá đơn.
   */
  function billSplit(p) {
    var usage = Math.max(0, Math.round(p.newReading) - Math.round(p.oldReading));
    var electricity = usage * Math.round(p.unitPrice || 0);
    var fixedTotal = (p.fixed || []).reduce(function (a, b) { return a + Math.round(b); }, 0);
    var total = electricity + fixedTotal;
    var n = Math.max(1, Math.round(p.people || 1));
    return { usage: usage, electricity: electricity, fixedTotal: fixedTotal, total: total,
      shares: QL.money.allocate(total, Array.from({ length: n }, function () { return 1; })) };
  }

  /* ----------------------------------------------------------------- mẫu nhanh */
  /** Cặp (ghi chú, số tiền) hay gặp nhất — chạm một cái là điền sẵn (FR-06). */
  function quickTemplates(doc, n) {
    var seen = {};
    doc.transactions.forEach(function (tx) {
      if (tx.type !== "expense" || !tx.note) return;
      var key = QL.text.fold(tx.note) + "|" + tx.amount;
      var s = seen[key] || (seen[key] = { count: 0, last: "", tx: tx });
      s.count++;
      if (tx.date >= s.last) { s.last = tx.date; s.tx = tx; }
    });
    return Object.keys(seen).map(function (k) { return seen[k]; })
      .filter(function (s) { return s.count >= 2; })
      .sort(function (a, b) { return b.count - a.count || (a.last < b.last ? 1 : -1); })
      .slice(0, n)
      .map(function (s) {
        var t = s.tx;
        return {
          note: t.note, amount: t.amount, categoryId: t.categoryId, accountId: t.accountId, count: s.count,
          split: t.split ? { paidBy: t.split.paidBy, ids: Object.keys(t.split.shares), groupId: t.groupId || null } : null
        };
      });
  }

  QL.ledger = {
    effects: effects, accountBalances: accountBalances, netWorth: netWorth,
    personBalances: personBalances, settlementOf: settlementOf, sharedWith: sharedWith, settlementMessage: settlementMessage,
    groupMembers: groupMembers, groupsOfPerson: groupsOfPerson, sharedLedger: sharedLedger, settleUp: settleUp,
    groupStatement: groupStatement, groupSettlementMessage: groupSettlementMessage, payerOf: payerOf,
    periodSummary: periodSummary, compareWithPrevious: compareWithPrevious, monthlySeries: monthlySeries, topExpenses: topExpenses,
    budgetProgress: budgetProgress, savingsInfo: savingsInfo, depositAlerts: depositAlerts,
    occurrences: occurrences, dueRecurring: dueRecurring,
    filterTx: filterTx, groupByDay: groupByDay, quickTemplates: quickTemplates, billSplit: billSplit, findDuplicate: findDuplicate, byId: byId, meOf: meOf
  };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.ledger;
})(typeof globalThis !== "undefined" ? globalThis : this);
