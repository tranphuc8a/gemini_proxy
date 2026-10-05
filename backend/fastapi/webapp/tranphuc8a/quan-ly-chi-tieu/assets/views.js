/* views.js — các màn hình: nhận ngữ cảnh `c` và TRẢ VỀ chuỗi HTML (không đụng DOM).
   c = { doc, today, me, cats, accs, people, ui, status, mode }.
   Mọi dữ liệu người dùng đi qua esc(). Sự kiện dùng uỷ quyền qua data-act (xem app.js). */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});
  var esc = QL.text.esc, M = QL.money, D = QL.dates, L = QL.ledger;
  var fmt = function (n) { return M.format(n); };

  var NAV = [
    { id: "tong-quan", label: "Tổng quan", ic: "🏠" }, { id: "giao-dich", label: "Giao dịch", ic: "🧾" },
    { id: "bao-cao", label: "Báo cáo", ic: "📊" }, { id: "chia-tien", label: "Chia tiền", ic: "🤝" },
    { id: "tai-khoan", label: "Tài khoản", ic: "🏦" }, { id: "ke-hoach", label: "Kế hoạch", ic: "🎯" },
    { id: "cai-dat", label: "Cài đặt", ic: "⚙️" }
  ];
  var PERIODS = [{ id: "week", label: "Tuần" }, { id: "month", label: "Tháng" }, { id: "year", label: "Năm" }, { id: "all", label: "Tất cả" }];
  var TYPE_LABEL = { expense: "Chi", income: "Thu", transfer: "Chuyển", settle: "Thanh toán nợ" };

  /* --------------------------------------------------------------- helpers */
  function seg(name, items, cur, extra) { return QL.ui.seg(name, items, cur, extra); }
  function empty(icon, title, text, actions) {
    return '<div class="empty"><div class="big" aria-hidden="true">' + icon + "</div><h3>" + esc(title) + "</h3><p>" + esc(text) + "</p>" +
      (actions ? '<div class="row wrap mt" style="justify-content:center">' + actions + "</div>" : "") + "</div>";
  }
  function catOf(c, id) { return c.cats[id] || { name: "(đã xoá)", icon: "❔", color: "#98a2ad" }; }
  function accName(c, id) { return c.accs[id] ? c.accs[id].name : "(đã xoá)"; }
  function personName(c, id) { return c.people[id] ? c.people[id].name : "(đã xoá)"; }
  function colorBg(color) { return "color-mix(in srgb, " + esc(color) + " 22%, transparent)"; }

  function deltaPill(delta, pct, lowerIsBetter) {
    if (pct === null || pct === undefined) return '<span class="muted">chưa có kỳ trước để so</span>';
    if (delta === 0) return '<span class="muted">bằng kỳ trước</span>';
    var good = lowerIsBetter ? delta < 0 : delta > 0;
    return '<span class="' + (good ? "thu" : "chi") + '">' + (delta > 0 ? "▲" : "▼") + " " + Math.abs(pct).toString().replace(".", ",") + "% so với kỳ trước</span>";
  }

  function stat(label, value, cls, sub) {
    return '<div class="card stat"><div class="lbl">' + esc(label) + '</div><div class="val num ' + (cls || "") + '">' + value + "</div>" + (sub ? '<div class="sub">' + sub + "</div>" : "") + "</div>";
  }

  /* ----------------------------------------------------------- một dòng giao dịch */
  function txTitle(tx, c) {
    if (tx.note) return tx.note;
    if (tx.type === "transfer") return "Chuyển " + accName(c, tx.accountId) + " → " + accName(c, tx.toAccountId);
    if (tx.type === "settle") return (tx.direction === "in" ? personName(c, tx.personId) + " trả nợ" : "Trả nợ " + personName(c, tx.personId));
    return catOf(c, tx.categoryId).name;
  }

  function txRow(tx, c) {
    var e = L.effects(tx, c.me), cat = catOf(c, tx.categoryId), icon, meta = [], amount, cls;
    if (tx.type === "transfer") { icon = "🔁"; cls = "chuyen"; amount = fmt(tx.amount); meta.push("Chuyển khoản", accName(c, tx.accountId) + " → " + accName(c, tx.toAccountId)); }
    else if (tx.type === "settle") { icon = "🤝"; cls = "chuyen"; amount = (tx.direction === "in" ? "+" : "−") + fmt(tx.amount); meta.push("Thanh toán nợ", accName(c, tx.accountId)); }
    else if (tx.type === "income") { icon = cat.icon; cls = "thu"; amount = "+" + fmt(tx.amount); meta.push(cat.name, accName(c, tx.accountId)); }
    else {
      icon = cat.icon; cls = "chi";
      amount = "−" + fmt(e.spend);
      meta.push(cat.name);
      if (tx.accountId) meta.push(accName(c, tx.accountId));
    }
    var badge = "";
    if (tx.split) {
      var n = Object.keys(tx.split.shares).length;
      badge = ' <span class="badge acc">Chia ' + n + (tx.split.paidBy !== c.me ? " · " + esc(personName(c, tx.split.paidBy)) + " trả" : "") + "</span>";
    }
    var sub = tx.split && tx.type === "expense" ? '<span class="sub num">tổng ' + fmt(tx.amount) + "</span>" : "";
    var bg = tx.type === "expense" || tx.type === "income" ? ' style="background:' + colorBg(cat.color) + '"' : "";
    return '<button type="button" class="item" data-act="tx-edit" data-id="' + esc(tx.id) + '">' +
      '<span class="ico"' + bg + ' aria-hidden="true">' + esc(icon) + "</span>" +
      '<span class="mid"><span class="ttl">' + esc(txTitle(tx, c)) + '</span><span class="meta">' + meta.map(esc).join(" · ") + badge + "</span></span>" +
      '<span class="amt num ' + cls + '"><span class="sr">' + esc(TYPE_LABEL[tx.type]) + " </span>" + amount + sub + "</span></button>";
  }

  function txList(txs, c, limit) {
    if (!txs.length) return "";
    var shown = txs.slice(0, limit || 200);
    var groups = L.groupByDay(c.doc, shown), out = "";
    groups.forEach(function (g) {
      var tot = [];
      if (g.expense) tot.push('<span class="chi num">−' + fmt(g.expense) + "</span>");
      if (g.income) tot.push('<span class="thu num">+' + fmt(g.income) + "</span>");
      out += '<section class="day"><div class="day-head"><span>' + esc(D.dayLabel(g.date)) + (g.date === c.today ? " · Hôm nay" : "") + "</span><span>" + tot.join(" ") + '</span></div><div class="list">' +
        g.txs.map(function (t) { return txRow(t, c); }).join("") + "</div></section>";
    });
    if (txs.length > shown.length) out += '<div class="row mt" style="justify-content:center"><button type="button" class="btn" data-act="tx-more">Hiện thêm (' + (txs.length - shown.length) + " khoản)</button></div>";
    return out;
  }

  function periodBar(kind, per, name) {
    return '<div class="row wrap">' + seg(name, PERIODS, kind) +
      (kind !== "all" ? '<div class="row gap-s"><button type="button" class="icon-btn" data-act="period-prev" data-for="' + name + '" aria-label="Kỳ trước">◀</button><strong class="num" aria-live="polite">' + esc(per.label) +
        '</strong><button type="button" class="icon-btn" data-act="period-next" data-for="' + name + '" aria-label="Kỳ sau">▶</button><button type="button" class="btn sm ghost" data-act="period-now" data-for="' + name + '">Hôm nay</button></div>' : "") + "</div>";
  }

  /* ---------------------------------------------------------------- banners */
  function banners(c) {
    var out = "";
    if (c.status.localError) out += '<div class="banner bad" role="alert">' + esc(c.status.localError) + "</div>";
    if (c.mode === "local") {
      var last = c.doc.settings.lastBackupAt;
      var stale = c.doc.transactions.length >= 10 && (!last || D.diffDays(last.slice(0, 10), c.today) > 30);
      if (stale) out += '<div class="banner" role="status">Dữ liệu chỉ nằm trong trình duyệt này và ' + (last ? "đã hơn 30 ngày chưa sao lưu" : "chưa từng sao lưu") + '. <button type="button" class="btn sm" data-act="backup-json">Sao lưu ngay</button> hoặc <a href="#/cai-dat" data-act="goto-storage">đồng bộ lên máy chủ</a>.</div>';
    }
    if (c.status.usageBytes > QL.store.WARN_BYTES) out += '<div class="banner" role="status">Dữ liệu đã ' + (c.status.usageBytes / 1e6).toFixed(1).replace(".", ",") + ' MB, gần giới hạn đồng bộ 4 MB. Hãy sao lưu rồi xoá bớt các giao dịch cũ.</div>';
    return out;
  }

  /* ----------------------------------------------------------- 1. Tổng quan */
  function overview(c) {
    var doc = c.doc, per = D.period("month", c.today);
    var sum = L.periodSummary(doc, per, c.today), cmp = L.compareWithPrevious(doc, per, c.today);
    var head = '<div class="view-head"><div><h2>Tổng quan</h2><p class="muted">' + esc(per.label) + '</p></div><button type="button" class="btn primary no-print" data-act="tx-new">＋ Thêm giao dịch</button></div>';
    if (!doc.transactions.length) {
      return head + banners(c) + '<div class="card">' + empty("🧾", "Chưa có giao dịch nào", "Gõ một dòng như “cơm trưa 57/2 hôm qua” ở ô nhập nhanh, hoặc bắt đầu với dữ liệu mẫu.",
        '<button type="button" class="btn primary" data-act="tx-new">＋ Thêm giao dịch đầu tiên</button><button type="button" class="btn" data-act="sample">Thử với dữ liệu mẫu</button><button type="button" class="btn" data-act="import-text">Dán từ ghi chú cũ</button>') + "</div>";
    }
    var days = [];
    for (var d = per.from; d <= per.to; d = D.addDays(d, 1)) days.push({ label: String(+d.slice(8)), values: [sum.byDay[d] || 0], tip: D.dayLabel(d) + ": " + fmt(sum.byDay[d] || 0) });
    var cats = sum.categories.slice(0, 5).map(function (r) {
      var cat = catOf(c, r.categoryId);
      return '<div class="stack gap-s"><div class="row between"><span>' + esc(cat.icon) + " " + esc(cat.name) + '</span><span class="num">' + fmt(r.amount) + ' <span class="muted small">' + String(r.pct).replace(".", ",") + '%</span></span></div><div class="bar"><i style="width:' + Math.min(100, r.pct) + "%;background:" + esc(cat.color) + '"></i></div></div>';
    }).join("") || '<p class="muted">Tháng này chưa có khoản chi.</p>';

    var due = L.dueRecurring(doc, c.today), alerts = L.depositAlerts(doc, c.today, 30);
    var dueHtml = due.slice(0, 5).map(function (x) {
      return '<div class="row between wrap"><span>🔁 ' + esc(x.rule.name) + ' <span class="muted small">' + esc(D.dm(x.dueOn)) + '</span></span><span class="row gap-s"><span class="num">' + fmt(x.rule.amount) +
        '</span><button type="button" class="btn sm primary" data-act="rec-confirm" data-rule="' + esc(x.rule.id) + '" data-due="' + x.dueOn + '">Ghi</button><button type="button" class="btn sm" data-act="rec-skip" data-rule="' + esc(x.rule.id) + '" data-due="' + x.dueOn + '">Bỏ qua</button></span></div>';
    }).join("") + alerts.map(function (a) {
      return '<div class="row between wrap"><span>🏦 ' + esc(a.account.name) + ' <span class="badge ' + (a.info.status === "matured" ? "warn" : "acc") + '">' + (a.info.status === "matured" ? "đã đáo hạn" : "còn " + a.info.daysLeft + " ngày") +
        '</span></span><a href="#/tai-khoan">Lãi ' + fmt(a.info.netInterest) + "</a></div>";
    }).join("");

    var pb = L.personBalances(doc), debts = Object.keys(pb).filter(function (id) { return pb[id] !== 0; }).map(function (id) {
      var s = L.settlementOf(pb[id]);
      return '<div class="row between wrap"><span>' + (s.direction === "receive" ? esc(personName(c, id)) + ' nợ bạn' : 'Bạn nợ ' + esc(personName(c, id))) + ' <strong class="num ' + (s.direction === "receive" ? "thu" : "chi") + '">' + fmt(s.amount) +
        '</strong></span><button type="button" class="btn sm" data-act="settle" data-id="' + esc(id) + '">Quyết toán</button></div>';
    }).join("");

    var bal = L.accountBalances(doc), nw = L.netWorth(doc, bal);
    var recent = L.filterTx(doc, {}).slice(0, 5);
    var bud = L.budgetProgress(doc, c.today, c.today).slice(0, 3).map(function (b) {
      return '<div class="stack gap-s"><div class="row between"><span>' + esc(b.name) + '</span><span class="num ' + (b.status === "over" ? "chi" : "") + '">' + fmt(b.spent) + " / " + fmt(b.amount) + '</span></div><div class="bar ' + b.status + '"><i style="width:' + Math.min(100, b.pct) + '%"></i></div></div>';
    }).join("");

    return head + banners(c) +
      '<div class="grid g3">' +
      stat("Chi tháng này", "−" + fmt(sum.expense), "chi", cmp ? deltaPill(cmp.expenseDelta, cmp.expensePct, true) : "") +
      stat("Thu tháng này", "+" + fmt(sum.income), "thu", cmp ? deltaPill(cmp.incomeDelta, cmp.incomePct, false) : "") +
      stat("Còn lại", (sum.net < 0 ? "−" : "") + fmt(Math.abs(sum.net)), sum.net < 0 ? "chi" : "thu", "Trung bình chi " + fmt(sum.avgPerDay) + "/ngày") + "</div>" +
      '<div class="grid g2w mt"><div class="card chart"><h3>Chi theo ngày</h3>' + QL.charts.bars(days, { format: M.compact, label: "Chi theo ngày trong " + per.label, maxLabels: 10 }) + "</div>" +
      '<div class="card"><div class="row between"><h3>Chi theo danh mục</h3><a href="#/bao-cao" class="small">Xem báo cáo</a></div><div class="stack mt-s">' + cats + "</div></div></div>" +
      '<div class="grid g2 mt">' +
      (dueHtml ? '<div class="card"><h3>Đến hạn</h3><div class="stack">' + dueHtml + "</div></div>" : "") +
      '<div class="card"><div class="row between"><h3>Nợ chung</h3><a class="small" href="#/chia-tien">Chi tiết</a></div><div class="stack">' + (debts || '<p class="muted">Không có khoản nợ nào đang treo.</p>') + "</div></div>" +
      (bud ? '<div class="card"><div class="row between"><h3>Ngân sách tháng</h3><a class="small" href="#/ke-hoach">Chỉnh sửa</a></div><div class="stack">' + bud + "</div></div>" : "") +
      '<div class="card"><div class="row between"><h3>Tài sản</h3><a class="small" href="#/tai-khoan">Chi tiết</a></div><div class="val num" style="font-size:24px;font-weight:700">' + fmt(nw) + '</div><p class="muted small">Tổng số dư các tài khoản và sổ tiết kiệm</p></div>' +
      "</div>" +
      '<div class="card mt"><div class="row between"><h3>Gần đây</h3><a class="small" href="#/giao-dich">Tất cả giao dịch</a></div><div class="list" style="border:0;border-radius:0">' + recent.map(function (t) { return txRow(t, c); }).join("") + "</div></div>";
  }

  /* ---------------------------------------------------------- 2. Giao dịch */
  function filterPanel(c) {
    var f = c.ui.filters, doc = c.doc;
    var cats = doc.categories.filter(function (x) { return !x.archived; }).map(function (x) { return { id: x.id, label: x.icon + " " + x.name }; });
    var accs = doc.accounts.map(function (x) { return { id: x.id, label: x.name }; });
    var ppl = doc.people.filter(function (p) { return p.id !== c.me; }).map(function (x) { return { id: x.id, label: x.name }; });
    var o = QL.ui.options;
    return '<div class="card mt-s" id="filter-panel"><div class="grid g3">' +
      QL.ui.field("Loại", '<select data-on="filter" name="type">' + o([{ id: "expense", label: "Chi" }, { id: "income", label: "Thu" }, { id: "transfer", label: "Chuyển" }, { id: "settle", label: "Thanh toán nợ" }], f.type, "Tất cả") + "</select>") +
      QL.ui.field("Danh mục", '<select data-on="filter" name="categoryId">' + o(cats, f.categoryId, "Tất cả") + "</select>") +
      QL.ui.field("Tài khoản", '<select data-on="filter" name="accountId">' + o(accs, f.accountId, "Tất cả") + "</select>") +
      QL.ui.field("Người", '<select data-on="filter" name="personId">' + o(ppl, f.personId, "Tất cả") + "</select>") +
      QL.ui.field("Từ số tiền", '<input type="text" inputmode="decimal" data-on="filter" name="min" value="' + esc(f.min || "") + '" placeholder="vd 50k">') +
      QL.ui.field("Đến số tiền", '<input type="text" inputmode="decimal" data-on="filter" name="max" value="' + esc(f.max || "") + '" placeholder="vd 2tr">') +
      '</div><div class="row between wrap mt-s"><label class="chk"><input type="checkbox" data-on="filter" name="sharedOnly"' + (f.sharedOnly ? " checked" : "") + '> Chỉ khoản chi chung</label><button type="button" class="btn sm" data-act="filter-clear">Xoá bộ lọc</button></div></div>';
  }

  function activeFilters(ui, c) {
    var f = ui.filters, q = {};
    var per = ui.txPeriod.kind === "all" ? null : D.period(ui.txPeriod.kind, ui.txPeriod.anchor);
    if (per) { q.from = per.from; q.to = per.to; }
    ["q", "type", "categoryId", "accountId", "personId"].forEach(function (k) { if (f[k]) q[k] = f[k]; });
    if (f.sharedOnly) q.sharedOnly = true;
    if (f.min) { var a = M.parse(f.min, { smallAsThousand: c.doc.settings.smallAsThousand }); if (a.ok) q.min = a.value; }
    if (f.max) { var b = M.parse(f.max, { smallAsThousand: c.doc.settings.smallAsThousand }); if (b.ok) q.max = b.value; }
    return q;
  }
  function filterCount(f) { return ["type", "categoryId", "accountId", "personId", "min", "max"].filter(function (k) { return f[k]; }).length + (f.sharedOnly ? 1 : 0); }

  /** Phần danh sách + tóm tắt — được vẽ lại riêng khi gõ tìm kiếm (không làm mất focus ô tìm). */
  function txResults(c) {
    var q = activeFilters(c.ui, c), list = L.filterTx(c.doc, q);
    var e = 0, i = 0;
    list.forEach(function (t) { var x = L.effects(t, c.me); e += x.spend; i += x.income; });
    var summary = '<p class="muted" role="status">' + list.length + " giao dịch" + (e ? ' · chi <span class="chi num">−' + fmt(e) + "</span>" : "") + (i ? ' · thu <span class="thu num">+' + fmt(i) + "</span>" : "") + "</p>";
    if (!list.length) {
      var filtered = c.ui.filters.q || filterCount(c.ui.filters);
      return summary + '<div class="card mt">' + (filtered ? empty("🔍", "Không có giao dịch khớp", "Thử bỏ bớt bộ lọc hoặc đổi từ khoá.", '<button type="button" class="btn" data-act="filter-clear">Xoá bộ lọc</button>')
        : empty("🧾", "Kỳ này chưa có giao dịch", "Bấm “Thêm giao dịch” hoặc gõ vào ô nhập nhanh.", '<button type="button" class="btn primary" data-act="tx-new">＋ Thêm giao dịch</button>')) + "</div>";
    }
    return summary + txList(list, c, c.ui.limit);
  }

  function transactions(c) {
    var ui = c.ui, per = D.period(ui.txPeriod.kind, ui.txPeriod.anchor), n = filterCount(ui.filters);
    return '<div class="view-head"><h2>Giao dịch</h2><button type="button" class="btn primary no-print" data-act="tx-new">＋ Thêm</button></div>' + banners(c) +
      '<div class="stack">' + periodBar(ui.txPeriod.kind, per, "txPeriod") +
      '<div class="row"><label class="sr" for="tx-q">Tìm giao dịch</label><input type="search" id="tx-q" data-on="search" placeholder="Tìm: ghi chú, danh mục, tài khoản, người, số tiền…" value="' + esc(ui.filters.q || "") + '" autocomplete="off">' +
      '<button type="button" class="btn" data-act="filter-toggle" aria-expanded="' + !!ui.showFilters + '">Lọc' + (n ? " (" + n + ")" : "") + "</button></div>" +
      (ui.showFilters ? filterPanel(c) : "") + '<div id="tx-results">' + txResults(c) + "</div></div>";
  }

  /* ------------------------------------------------------------- 3. Báo cáo */
  function reports(c) {
    var ui = c.ui, doc = c.doc, per = D.period(ui.repPeriod.kind, ui.repPeriod.anchor);
    var sum = L.periodSummary(doc, per, c.today), cmp = L.compareWithPrevious(doc, per, c.today);
    var head = '<div class="view-head"><h2>Báo cáo</h2><div class="row no-print"><button type="button" class="btn" data-act="report-copy">Sao chép tóm tắt</button><button type="button" class="btn" data-act="print">In / PDF</button></div></div>';
    var bar = periodBar(ui.repPeriod.kind, per, "repPeriod");
    if (!doc.transactions.length) return head + bar + '<div class="card mt">' + empty("📊", "Chưa có dữ liệu để báo cáo", "Thêm vài giao dịch rồi quay lại đây.", '<button type="button" class="btn primary" data-act="tx-new">＋ Thêm giao dịch</button>') + "</div>";

    var slices = sum.categories.map(function (r) { var cat = catOf(c, r.categoryId); return { label: cat.name, value: r.amount, color: cat.color }; });
    var catRows = sum.categories.map(function (r) {
      var cat = catOf(c, r.categoryId);
      return "<tr><td><span class=\"dot\" style=\"background:" + esc(cat.color) + '"></span>' + esc(cat.icon) + " " + esc(cat.name) + '</td><td class="r num">' + fmt(r.amount) + '</td><td class="r num">' + String(r.pct).replace(".", ",") + "%</td></tr>";
    }).join("");

    // Cột theo ngày (tuần/tháng) hoặc theo tháng (năm/tất cả).
    var timeline, timelineTitle;
    if (per.kind === "week" || per.kind === "month") {
      var items = [];
      for (var d = per.from; d <= per.to; d = D.addDays(d, 1)) items.push({ label: per.kind === "week" ? D.WD[D.weekday(d)] : String(+d.slice(8)), values: [sum.byDay[d] || 0], tip: D.dayLabel(d) + ": " + fmt(sum.byDay[d] || 0) });
      timeline = QL.charts.bars(items, { format: M.compact, label: "Chi theo ngày", maxLabels: 12 }); timelineTitle = "Chi theo ngày";
    } else {
      var n = per.kind === "year" ? 12 : 12, end = per.kind === "year" ? D.addMonths(per.from, 11) : c.today;
      var series = L.monthlySeries(doc, end, n);
      timeline = QL.charts.bars(series.map(function (m) { return { label: m.key.slice(5), values: [m.expense], tip: "Tháng " + m.key.slice(5) + "/" + m.key.slice(0, 4) + ": " + fmt(m.expense) }; }), { format: M.compact, label: "Chi theo tháng", maxLabels: 12 });
      timelineTitle = "Chi theo tháng";
    }
    var wd = D.WD.map(function (l, i) { return { label: l, values: [sum.byWeekday[i]], tip: D.WD_LONG[i] + ": " + fmt(sum.byWeekday[i]) }; });
    var g = sum.groups, gd = sum.groupDays;
    function avg(total, days) { return days ? fmt(Math.round(total / days)) : "—"; }
    var trend = L.monthlySeries(doc, c.today, 12);
    var top = L.topExpenses(doc, per, 5).map(function (x) {
      return '<button type="button" class="item" data-act="tx-edit" data-id="' + esc(x.tx.id) + '"><span class="mid"><span class="ttl">' + esc(txTitle(x.tx, c)) + '</span><span class="meta">' + esc(D.dayLabel(x.tx.date)) + " · " + esc(catOf(c, x.tx.categoryId).name) + '</span></span><span class="amt num chi">−' + fmt(x.amount) + "</span></button>";
    }).join("");
    var inc = sum.incomeCategories.map(function (r) { var cat = catOf(c, r.categoryId); return "<tr><td>" + esc(cat.icon) + " " + esc(cat.name) + '</td><td class="r num thu">+' + fmt(r.amount) + "</td></tr>"; }).join("");

    return head + '<div class="stack">' + bar + banners(c) +
      '<div class="grid g4">' + stat("Chi", "−" + fmt(sum.expense), "chi", cmp ? deltaPill(cmp.expenseDelta, cmp.expensePct, true) : "") + stat("Thu", "+" + fmt(sum.income), "thu", cmp ? deltaPill(cmp.incomeDelta, cmp.incomePct, false) : "") +
      stat("Chênh lệch", (sum.net < 0 ? "−" : "") + fmt(Math.abs(sum.net)), sum.net < 0 ? "chi" : "thu") + stat("Chi trung bình/ngày", fmt(sum.avgPerDay), "", sum.days + " ngày tính") + "</div>" +
      '<div class="card"><h3>Chi theo danh mục</h3>' + (sum.expense ? '<div class="donut-wrap"><div class="chart">' + QL.charts.donut(slices, { format: fmt, label: "Chi theo danh mục", center: fmt(sum.expense) }) + '</div><div class="scroll-x"><table class="tbl"><thead><tr><th>Danh mục</th><th class="r">Số tiền</th><th class="r">%</th></tr></thead><tbody>' + catRows + "</tbody></table></div></div>" : '<p class="muted">Kỳ này chưa có khoản chi.</p>') + "</div>" +
      '<div class="grid g2"><div class="card chart"><h3>' + timelineTitle + "</h3>" + timeline + '</div><div class="card chart"><h3>Chi theo thứ trong tuần</h3>' + QL.charts.bars(wd, { format: M.compact, label: "Chi theo thứ trong tuần" }) +
      '<table class="tbl mt-s"><thead><tr><th>Nhóm</th><th class="r">Tổng</th><th class="r">TB/ngày</th></tr></thead><tbody><tr><td>T2 – T6</td><td class="r num">' + fmt(g.weekdays) + '</td><td class="r num">' + avg(g.weekdays, gd.weekdays) + "</td></tr><tr><td>Thứ Bảy</td><td class=\"r num\">" + fmt(g.saturday) + '</td><td class="r num">' + avg(g.saturday, gd.saturday) + "</td></tr><tr><td>Chủ nhật</td><td class=\"r num\">" + fmt(g.sunday) + '</td><td class="r num">' + avg(g.sunday, gd.sunday) + "</td></tr></tbody></table></div></div>" +
      '<div class="card chart"><h3>Thu – chi 12 tháng gần nhất</h3>' + QL.charts.bars(trend.map(function (m) { return { label: m.key.slice(5), values: [m.expense, m.income], tip: "Tháng " + m.key.slice(5) + "/" + m.key.slice(0, 4) + " — chi " + fmt(m.expense) + ", thu " + fmt(m.income) }; }), { format: M.compact, series: [{ cls: "b-a" }, { cls: "b-b" }], label: "Thu và chi 12 tháng" }) +
      '<p class="small muted"><span class="dot" style="background:var(--chi)"></span>Chi <span class="dot" style="background:var(--thu);margin-left:12px"></span>Thu</p></div>' +
      '<div class="grid g2">' + (top ? '<div class="card"><h3>Khoản chi lớn nhất</h3><div class="list" style="border:0">' + top + "</div></div>" : "") + (inc ? '<div class="card"><h3>Thu theo danh mục</h3><table class="tbl"><tbody>' + inc + "</tbody></table></div>" : "") + "</div></div>";
  }

  function reportText(c) {
    var per = D.period(c.ui.repPeriod.kind, c.ui.repPeriod.anchor), s = L.periodSummary(c.doc, per, c.today), lines = ["Báo cáo " + per.label,
      "Chi: " + fmt(s.expense) + " · Thu: " + fmt(s.income) + " · Chênh lệch: " + (s.net < 0 ? "−" : "") + fmt(Math.abs(s.net)), "Chi trung bình/ngày: " + fmt(s.avgPerDay), "", "Theo danh mục:"];
    s.categories.forEach(function (r) { lines.push("· " + catOf(c, r.categoryId).name + ": " + fmt(r.amount) + " (" + String(r.pct).replace(".", ",") + "%)"); });
    return lines.join("\n");
  }

  /* ----------------------------------------------------------- 4. Chia tiền */
  function sharing(c) {
    var doc = c.doc, pb = L.personBalances(doc), others = doc.people.filter(function (p) { return p.id !== c.me; });
    var cards = others.map(function (p) {
      var s = L.settlementOf(pb[p.id] || 0), shared = L.sharedWith(doc, p.id).items.length;
      var text = s.direction === "receive" ? esc(p.name) + " nợ bạn" : s.direction === "pay" ? "Bạn nợ " + esc(p.name) : "Đã hoà với " + esc(p.name);
      var isDefault = (doc.settings.defaultPartnerIds || []).indexOf(p.id) !== -1;
      return '<div class="card"><div class="row between wrap"><div><h3>' + esc(p.name) + (p.archived ? ' <span class="badge">đã lưu trữ</span>' : "") + (isDefault ? ' <span class="badge acc">mặc định chia</span>' : "") + '</h3><p class="muted small">' + shared + ' khoản liên quan</p></div>' +
        '<div class="right"><div class="small muted">' + text + '</div><div class="val num ' + (s.direction === "receive" ? "thu" : s.direction === "pay" ? "chi" : "") + '" style="font-size:22px;font-weight:700">' + fmt(s.amount) + "</div></div></div>" +
        '<div class="row wrap mt-s"><button type="button" class="btn primary" data-act="settle" data-id="' + esc(p.id) + '">Quyết toán</button><button type="button" class="btn" data-act="person-detail" data-id="' + esc(p.id) + '">Các khoản chung</button>' +
        '<button type="button" class="btn ghost" data-act="person-edit" data-id="' + esc(p.id) + '">Sửa</button></div></div>';
    }).join("");
    return '<div class="view-head"><h2>Chia tiền</h2><button type="button" class="btn primary" data-act="person-new">＋ Thêm người</button></div>' + banners(c) +
      (others.length ? '<div class="grid g2">' + cards + "</div>" : '<div class="card">' + empty("🤝", "Chưa có ai để chia tiền", "Thêm bạn cùng phòng hoặc người thân, rồi đánh dấu “Chi chung” khi nhập khoản chi — app sẽ tự tính ai nợ ai, thay cho phép tính tay cuối tuần.", '<button type="button" class="btn primary" data-act="person-new">＋ Thêm người</button>') + "</div>") +
      '<div class="card mt"><div class="row between wrap"><div><h3>Máy tính chia hoá đơn trọ</h3><p class="muted small">Điện theo chỉ số công tơ + nước, tạm trú, tiền phòng… rồi chia đều.</p></div><button type="button" class="btn" data-act="bill">Mở máy tính</button></div></div>';
  }

  /* ----------------------------------------------------------- 5. Tài khoản */
  function accounts(c) {
    var doc = c.doc, bal = L.accountBalances(doc), nw = L.netWorth(doc, bal);
    var normal = doc.accounts.filter(function (a) { return a.kind !== "savings" && !a.archived; });
    var deposits = doc.accounts.filter(function (a) { return a.kind === "savings"; });
    var open = deposits.filter(function (a) { return !(a.deposit && a.deposit.closedOn); }), closed = deposits.filter(function (a) { return a.deposit && a.deposit.closedOn; });
    var rows = normal.map(function (a) {
      return '<button type="button" class="item" data-act="account-edit" data-id="' + esc(a.id) + '"><span class="ico" aria-hidden="true">' + esc(a.icon) + '</span><span class="mid"><span class="ttl">' + esc(a.name) + '</span><span class="meta">' + esc({ cash: "Tiền mặt", bank: "Ngân hàng", ewallet: "Ví điện tử" }[a.kind] || "Tài khoản") + '</span></span><span class="amt num ' + (bal[a.id] < 0 ? "chi" : "") + '">' + fmt(bal[a.id] || 0) + "</span></button>";
    }).join("");
    var cards = open.map(function (a) {
      var info = L.savingsInfo(a, bal[a.id] || 0, c.today), dp = a.deposit;
      return '<div class="card"><div class="row between wrap"><h3>🏦 ' + esc(a.name) + '</h3><span class="badge ' + (info.status === "matured" ? "warn" : "acc") + '">' + (info.status === "matured" ? "Đã đáo hạn" : "Còn " + info.daysLeft + " ngày") + "</span></div>" +
        '<div class="val num" style="font-size:22px;font-weight:700">' + fmt(info.principal) + '</div><p class="muted small">' + String(dp.rate).replace(".", ",") + "%/năm · " + dp.termMonths + " tháng · gửi " + esc(D.dm(dp.openedOn)) + "/" + dp.openedOn.slice(0, 4) + " · đáo hạn " + esc(D.dm(info.maturityOn)) + "/" + info.maturityOn.slice(0, 4) + "</p>" +
        '<p class="mt-s">Lãi dự kiến <strong class="num thu">+' + fmt(info.interest) + "</strong>" + (info.tax ? " · thuế −" + fmt(info.tax) : "") + ' · nhận về <strong class="num">' + fmt(info.total) + '</strong></p>' +
        '<div class="row wrap mt-s"><button type="button" class="btn primary" data-act="deposit-close" data-id="' + esc(a.id) + '">Tất toán</button><button type="button" class="btn ghost" data-act="account-edit" data-id="' + esc(a.id) + '">Sửa</button></div></div>';
    }).join("");
    return '<div class="view-head"><h2>Tài khoản</h2><div class="row wrap"><button type="button" class="btn" data-act="tx-transfer">Chuyển tiền</button><button type="button" class="btn" data-act="account-new">＋ Tài khoản</button><button type="button" class="btn primary" data-act="deposit-new">＋ Sổ tiết kiệm</button></div></div>' + banners(c) +
      '<div class="card stat"><div class="lbl">Tổng tài sản</div><div class="val num ' + (nw < 0 ? "chi" : "") + '">' + fmt(nw) + '</div><div class="sub">Số dư tính từ giao dịch — không phải nhập tay. Muốn đúng, hãy đặt số dư đầu kỳ cho từng tài khoản.</div></div>' +
      '<h3 class="mt">Tiền mặt, ngân hàng, ví</h3><div class="list mt-s">' + (rows || '<p class="muted" style="padding:14px">Chưa có tài khoản.</p>') + "</div>" +
      '<h3 class="mt">Sổ tiết kiệm</h3>' + (cards ? '<div class="grid g2 mt-s">' + cards + "</div>" : '<div class="card mt-s">' + empty("🏦", "Chưa có sổ tiết kiệm", "Ghi lãi suất, kỳ hạn và ngày gửi — app tính ngày đáo hạn, lãi dự kiến, thuế và nhắc khi sắp đến hạn.", '<button type="button" class="btn primary" data-act="deposit-new">＋ Mở sổ tiết kiệm</button>') + "</div>") +
      (closed.length ? '<h3 class="mt">Đã tất toán</h3><div class="list mt-s">' + closed.map(function (a) { return '<div class="item"><span class="ico" aria-hidden="true">🏦</span><span class="mid"><span class="ttl">' + esc(a.name) + '</span><span class="meta">Tất toán ' + esc(D.dm(a.deposit.closedOn)) + "/" + a.deposit.closedOn.slice(0, 4) + "</span></span></div>"; }).join("") + "</div>" : "");
  }

  /* ------------------------------------------------------------- 6. Kế hoạch */
  function plans(c) {
    var ui = c.ui, doc = c.doc, tab = ui.planTab;
    var head = '<div class="view-head"><h2>Kế hoạch</h2>' + seg("planTab", [{ id: "budget", label: "Ngân sách" }, { id: "recurring", label: "Định kỳ" }], tab) + "</div>";
    if (tab === "budget") {
      var bp = L.budgetProgress(doc, c.today, c.today);
      var list = bp.map(function (b) {
        return '<div class="card"><div class="row between wrap"><h3>' + esc(b.name) + '</h3><span class="badge ' + (b.status === "over" ? "chi" : b.status === "warn" ? "warn" : "thu") + '">' + (b.status === "over" ? "Vượt hạn mức" : b.status === "warn" ? "Sắp hết" : "Ổn") + "</span></div>" +
          '<div class="bar ' + b.status + ' mt-s"><i style="width:' + Math.min(100, b.pct) + '%"></i></div><div class="row between wrap mt-s"><span class="num">' + fmt(b.spent) + " / " + fmt(b.amount) + ' <span class="muted small">(' + String(b.pct).replace(".", ",") + '%)</span></span>' +
          '<span class="small muted">' + (b.remaining >= 0 ? "Còn " + fmt(b.remaining) + (b.perDay ? " ≈ " + fmt(b.perDay) + "/ngày" : "") : "Vượt " + fmt(-b.remaining)) + '</span></div><div class="row wrap mt-s"><button type="button" class="btn sm" data-act="budget-edit" data-id="' + esc(b.budget.id) + '">Sửa</button></div></div>';
      }).join("");
      return head + banners(c) + '<div class="row between wrap mb"><p class="muted">Hạn mức cho ' + esc(D.period("month", c.today).label) + ' — tính theo phần chi của bạn.</p><button type="button" class="btn primary" data-act="budget-new">＋ Thêm hạn mức</button></div>' +
        (list ? '<div class="grid g2 mt-s">' + list + "</div>" : '<div class="card mt-s">' + empty("🎯", "Chưa đặt hạn mức", "Đặt hạn mức cho từng danh mục (ví dụ Mua sắm 300.000 ₫ như khoản “shopping momo” hằng tháng) hoặc cho tổng chi.", '<button type="button" class="btn primary" data-act="budget-new">＋ Thêm hạn mức</button>') + "</div>");
    }
    var due = L.dueRecurring(doc, c.today);
    var dueHtml = due.length ? '<div class="card mt-s"><h3>Đến hạn — chờ xác nhận</h3><div class="stack mt-s">' + due.map(function (x) {
      return '<div class="row between wrap"><span>🔁 ' + esc(x.rule.name) + ' <span class="muted small">' + esc(D.dayLabel(x.dueOn)) + '</span></span><span class="row gap-s"><span class="num">' + fmt(x.rule.amount) + '</span><button type="button" class="btn sm primary" data-act="rec-confirm" data-rule="' + esc(x.rule.id) + '" data-due="' + x.dueOn + '">Ghi</button><button type="button" class="btn sm" data-act="rec-skip" data-rule="' + esc(x.rule.id) + '" data-due="' + x.dueOn + '">Bỏ qua</button></span></div>';
    }).join("") + "</div></div>" : "";
    var rules = doc.recurring.map(function (r) {
      var cat = catOf(c, r.categoryId);
      return '<button type="button" class="item" data-act="rec-edit" data-id="' + esc(r.id) + '"><span class="ico" aria-hidden="true">' + esc(cat.icon) + '</span><span class="mid"><span class="ttl">' + esc(r.name) + (r.active ? "" : ' <span class="badge">tạm dừng</span>') + '</span><span class="meta">' +
        (r.frequency === "weekly" ? "Hằng tuần · " + D.WD[r.day] : "Hằng tháng · ngày " + r.day) + " · " + esc(cat.name) + '</span></span><span class="amt num ' + (r.type === "income" ? "thu" : "chi") + '">' + (r.type === "income" ? "+" : "−") + fmt(r.amount) + "</span></button>";
    }).join("");
    return head + banners(c) + dueHtml + '<div class="row between wrap mt"><p class="muted">Khoản lặp lại như vé bus tháng, tiền trọ, lương. Đến hạn app hỏi bạn xác nhận — không tự ghi.</p><button type="button" class="btn primary" data-act="rec-new">＋ Thêm định kỳ</button></div>' +
      (rules ? '<div class="list mt-s">' + rules + "</div>" : '<div class="card mt-s">' + empty("🔁", "Chưa có khoản định kỳ", "Thêm vé xe bus tháng, tiền trọ, data 4G, lương… để khỏi gõ lại mỗi tháng.", '<button type="button" class="btn primary" data-act="rec-new">＋ Thêm định kỳ</button>') + "</div>");
  }

  /* -------------------------------------------------------------- 7. Cài đặt */
  /** Mục "Cài ứng dụng". `state` là QL.pwa.state() — xem pwa.js. Mỗi trạng thái nói đúng việc người dùng làm được lúc đó. */
  function installSection(state) {
    var intro = "Cài để mở từ màn hình chính / menu Start trong cửa sổ riêng và dùng được cả khi mất mạng. Dữ liệu vẫn lưu ở nơi bạn đã chọn ở trên.";
    var body = {
      installed: '<p class="hint ok">✓ Đang chạy như ứng dụng đã cài trên thiết bị này.</p>',
      ready: '<p class="muted small">' + intro + '</p><div class="row wrap mt-s"><button type="button" class="btn primary" data-act="pwa-install">⬇ Cài ứng dụng</button></div>',
      ios: '<p class="muted small">' + intro + '</p><p class="small mt-s">Trên iPhone/iPad: bấm nút <b>Chia sẻ</b> của Safari → <b>Thêm vào Màn hình chính</b>.</p>' +
        '<p class="hint err">Lưu ý: ứng dụng trên màn hình chính có kho dữ liệu RIÊNG, tách khỏi Safari — sổ đang ở chế độ “Máy này” sẽ không tự sang. Hãy <b>Sao lưu JSON</b> rồi <b>Khôi phục</b> trong ứng dụng mới, hoặc bật đồng bộ máy chủ trước khi cài.</p>',
      menu: '<p class="muted small">' + intro + '</p><p class="small mt-s">Trình duyệt chưa đưa nút cài. Mở menu của trình duyệt và chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.</p>',
      insecure: '<p class="muted small">Chỉ cài được khi trang mở qua <b>HTTPS</b> từ máy chủ (hoặc máy chủ chạy ngay trên máy này) — không cài được từ file:// hay địa chỉ http:// thường của máy khác. Hãy mở bằng địa chỉ https://… của máy chủ.</p>'
    }[state];
    return body ? '<section class="stack mt" id="pwa"><h3>Cài ứng dụng</h3>' + body + "</section>" : "";
  }

  function settings(c) {
    var doc = c.doc, st = c.status, mode = c.mode, conn = c.conn;
    var modeCard = function (id, title, text, extra) {
      var on = mode === id;
      return '<div class="card" style="' + (on ? "border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-bg)" : "") + '"><div class="row between wrap"><h3>' + title + "</h3>" + (on ? '<span class="badge acc">Đang dùng</span>' : "") + '</div><p class="muted small mt-s">' + text + '</p><div class="mt-s">' + extra + "</div></div>";
    };
    var avail = c.backends || {};
    function srvBtn(id, name) {
      var a = avail[id], dis = a && a.available === false;
      if (mode === id) return '<div class="row wrap"><button type="button" class="btn" data-act="copy-code">Sao chép mã kết nối</button><button type="button" class="btn" data-act="sync-now">Đồng bộ ngay</button><button type="button" class="btn danger" data-act="ws-delete">Xoá trên máy chủ</button></div>' +
        '<p class="hint">Không gian <b>' + esc(conn.id) + "</b> · phiên bản " + conn.revision + "</p>";
      var has = c.storedConn && c.storedConn[id];
      return '<div class="row wrap"><button type="button" class="btn primary" data-act="connect-new" data-b="' + id + '"' + (dis ? " disabled" : "") + '>Tạo không gian mới</button><button type="button" class="btn" data-act="connect-code" data-b="' + id + '"' + (dis ? " disabled" : "") + ">Nối bằng mã</button>" +
        (has ? '<button type="button" class="btn" data-act="connect-saved" data-b="' + id + '"' + (dis ? " disabled" : "") + '>Dùng lại kết nối đã lưu</button>' : "") + "</div>" +
        (a ? '<p class="hint ' + (dis ? "err" : "ok") + '">' + (dis ? "Chưa dùng được: " + esc(a.reason || "") : "Sẵn sàng") + "</p>" : '<p class="hint">Bấm “Kiểm tra kết nối” để biết kho này có dùng được không.</p>');
    }
    var statusText = { local: "Chỉ lưu trong trình duyệt này", saved: "Đã đồng bộ" + (st.at ? " lúc " + esc(st.at.slice(11, 16)) + " UTC" : ""), saving: "Đang lưu…", pending: "Có thay đổi chưa đồng bộ", offline: "Mất kết nối — sẽ tự thử lại", auth: "Khoá truy cập không đúng", missing: "Không gian không còn trên máy chủ", error: "Lỗi đồng bộ" }[st.state] || st.state;
    var cats = function (kind) {
      return doc.categories.filter(function (x) { return x.kind === kind; }).map(function (x) {
        return '<button type="button" class="chip' + (x.archived ? " static" : "") + '" data-act="cat-edit" data-id="' + esc(x.id) + '"><span aria-hidden="true">' + esc(x.icon) + "</span> " + esc(x.name) + (x.archived ? " (ẩn)" : "") + "</button>";
      }).join("");
    };
    return '<div class="view-head"><h2>Cài đặt</h2></div>' + banners(c) +
      '<section class="stack" id="storage"><div class="row between wrap"><h3>Lưu trữ & đồng bộ</h3><button type="button" class="btn sm" data-act="check-backends">Kiểm tra kết nối máy chủ</button></div>' +
      '<p class="muted small" role="status">Trạng thái: <strong>' + statusText + "</strong>" + (st.message ? " — " + esc(st.message) : "") + " · Dữ liệu " + (st.usageBytes / 1024).toFixed(0) + " KB</p>" +
      '<div class="grid g3">' +
      modeCard("local", "💻 Máy này", "Lưu trong trình duyệt, hoạt động offline, không cần mạng. Dữ liệu mất nếu xoá dữ liệu trình duyệt — hãy sao lưu.", mode === "local" ? "" : '<button type="button" class="btn primary" data-act="use-local">Chuyển về máy này</button>') +
      modeCard("mysql", "🐬 Máy chủ · MySQL", "Đồng bộ giữa điện thoại và máy tính qua FastAPI, lưu trong MySQL. Mỗi kho là một sổ riêng.", srvBtn("mysql", "MySQL")) +
      modeCard("mongo", "🍃 Máy chủ · MongoDB", "Như trên nhưng lưu trong MongoDB. Có thể sao chép sổ hiện tại sang kho này bằng “Tạo không gian mới”.", srvBtn("mongo", "MongoDB")) + "</div>" +
      QL.ui.field("Địa chỉ máy chủ (chỉ cần khi mở file trực tiếp)", '<input type="url" id="api-base" data-on="apibase" value="' + esc(c.apiBase) + '" placeholder="vd http://localhost:6789/api/v1 — để trống nếu mở từ chính máy chủ">', "Khoá truy cập được lưu trong trình duyệt này để tự đồng bộ. Đừng dùng chế độ máy chủ trên máy lạ.") + "</section>" + installSection(c.pwa) +
      '<section class="stack mt"><h3>Dữ liệu</h3><div class="row wrap">' +
      '<button type="button" class="btn" data-act="backup-json">⬇ Sao lưu JSON</button><button type="button" class="btn" data-act="restore-json">⬆ Khôi phục JSON</button><button type="button" class="btn" data-act="export-csv">⬇ Xuất CSV</button><button type="button" class="btn" data-act="import-csv">⬆ Nhập CSV</button><button type="button" class="btn" data-act="import-text">📋 Dán từ ghi chú</button>' +
      (c.canUndoReplace ? '<button type="button" class="btn" data-act="undo-replace">↩ Hoàn tác lần thay thế gần nhất</button>' : "") + '<button type="button" class="btn" data-act="sample">Dữ liệu mẫu</button><button type="button" class="btn danger" data-act="wipe">Xoá toàn bộ dữ liệu</button></div></section>' +
      '<section class="stack mt"><h3>Giao diện & nhập liệu</h3><div class="grid g2"><div>' + QL.ui.field("Chủ đề", seg("theme", [{ id: "system", label: "Theo máy" }, { id: "light", label: "Sáng" }, { id: "dark", label: "Tối" }], doc.settings.theme)) + "</div>" +
      '<label class="chk"><input type="checkbox" data-on="smallk"' + (doc.settings.smallAsThousand ? " checked" : "") + "> Số nhỏ hơn 1.000 hiểu là nghìn (gõ 57 = 57.000 ₫)</label>" +
      QL.ui.field("Tài khoản mặc định khi nhập", '<select data-on="defacc">' + QL.ui.options(doc.accounts.filter(function (a) { return !a.archived && a.kind !== "savings"; }).map(function (a) { return { id: a.id, label: a.name }; }), doc.settings.defaultAccountId) + "</select>") + "</div></section>" +
      '<section class="stack mt"><div class="row between wrap"><h3>Danh mục</h3><button type="button" class="btn sm" data-act="cat-new">＋ Danh mục</button></div><p class="small muted">Chi</p><div class="chips">' + cats("expense") + '</div><p class="small muted">Thu</p><div class="chips">' + cats("income") + "</div></section>" +
      '<section class="stack mt"><h3>Phím tắt</h3><p class="muted small"><kbd>N</kbd> thêm giao dịch · <kbd>/</kbd> nhập nhanh / tìm · <kbd>?</kbd> trợ giúp · <kbd>G</kbd> rồi <kbd>T</kbd> tổng quan, <kbd>D</kbd> giao dịch, <kbd>B</kbd> báo cáo · <kbd>Esc</kbd> đóng hộp thoại.</p></section>';
  }

  QL.views = {
    NAV: NAV, PERIODS: PERIODS, TYPE_LABEL: TYPE_LABEL,
    overview: overview, transactions: transactions, txResults: txResults, reports: reports, sharing: sharing, accounts: accounts, plans: plans, settings: settings,
    txRow: txRow, txList: txList, txTitle: txTitle, reportText: reportText, activeFilters: activeFilters, catOf: catOf, personName: personName, accName: accName, empty: empty
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
