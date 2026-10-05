/* dialogs.js — các hộp thoại: nhập giao dịch (trái tim UX), chia tiền, sổ tiết kiệm, kết nối…
   Truy cập trạng thái ứng dụng qua QL.app (do app.js dựng): ctx(), apply(), engine, refresh(). */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});
  var U = QL.ui, esc = QL.text.esc, M = QL.money, D = QL.dates, L = QL.ledger, Mo = QL.model, V = QL.views;
  var fmt = function (n) { return M.format(n); };
  var formSeq = 0;

  function A() { return QL.app; }
  function opts(doc) { return { smallAsThousand: doc.settings.smallAsThousand }; }

  /** Số tiền hiển thị trong ô nhập: đọc lại ra đúng số cũ dù bật "số nhỏ là nghìn". */
  function amtText(v) {
    if (!v) return "";
    if (v < 1000) return String(v / 1000).replace(".", ",") + "k";
    if (v % 1000 === 0 && v < 1e6) return (v / 1000) + "k";
    return M.format(v, false);
  }

  /** Hộp thoại có biểu mẫu: onSubmit(formData, dlg) trả chuỗi lỗi để hiện, hoặc rỗng để đóng. */
  function formDialog(title, body, submitLabel, onSubmit, o) {
    var fid = "f" + (++formSeq);
    var d = U.dialog(title, '<form id="' + fid + '" novalidate autocomplete="off">' + body + '<p class="hint err" id="' + fid + '-err" role="alert"></p></form>',
      '<button type="button" class="btn" data-close>Huỷ</button><button type="submit" form="' + fid + '" class="btn primary">' + esc(submitLabel) + "</button>", o);
    var form = d.el.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = onSubmit(new FormData(form), d, form);
      var box = d.el.querySelector("#" + fid + "-err");
      if (err) { box.textContent = err; box.scrollIntoView({ block: "nearest" }); } else d.close(true);
    });
    return d;
  }
  function moneyOf(fd, name, doc, allowZero) {
    var r = M.parse(fd.get(name) || "", opts(doc));
    if (!r.ok || r.value < 0 || (!allowZero && r.value === 0)) return null;
    return r.value;
  }

  function accountOptions(doc, selected, o) {
    o = o || {};
    return U.options(doc.accounts.filter(function (a) { return (o.all || (!a.archived && a.kind !== "savings")) || a.id === selected; }).map(function (a) { return { id: a.id, label: a.icon + " " + a.name }; }), selected);
  }

  /* ===================================================================
     Nhập giao dịch
     =================================================================== */
  /**
   * init: { tx? } sửa một giao dịch; { draft? } điền sẵn (nhân bản, từ nhập nhanh, từ hoá đơn); { type? }.
   */
  function openTxDialog(init) {
    init = init || {};
    var app = A(), c = app.ctx(), doc = c.doc, me = c.me, editing = init.tx || null;
    var src = editing || init.draft || {};
    var todayIso = c.today;
    var others = doc.people.filter(function (p) { return p.id !== me && !p.archived; });
    var T = {
      type: src.type || init.type || "expense",
      amount: src.amount ? amtText(src.amount) : "",
      date: src.date || todayIso,
      categoryId: src.categoryId || null,
      accountId: src.accountId || doc.settings.defaultAccountId,
      toAccountId: src.toAccountId || null,
      note: src.note || "",
      tags: (src.tags || []).join(" "),
      shared: !!src.split, paidBy: (src.split && src.split.paidBy) || me,
      ids: src.split ? Object.keys(src.split.shares) : [me].concat(others.length ? [QL.parser.partners(doc)[0].id] : []),
      mode: "equal", exact: {}, touched: {}
    };
    if (src.split) {
      // Nếu phần chia không đều, mở ở chế độ "theo số tiền".
      var sh = src.split.shares, ids = Object.keys(sh), eq = M.allocate(src.amount, ids.map(function () { return 1; }));
      var uneven = ids.some(function (id, i) { return Math.abs(sh[id] - eq[i]) > 1; }) && !ids.every(function (id) { return sh[id] === sh[ids[0]]; });
      if (uneven) { T.mode = "exact"; ids.forEach(function (id) { T.exact[id] = amtText(sh[id]); }); }
    }

    // Danh mục dùng gần đây lên đầu.
    var freq = {};
    doc.transactions.slice(-300).forEach(function (t) { if (t.categoryId) freq[t.categoryId] = (freq[t.categoryId] || 0) + 1; });
    function catsFor(type) {
      return doc.categories.filter(function (x) { return !x.archived && x.kind === (type === "income" ? "income" : "expense"); })
        .sort(function (a, b) { return (freq[b.id] || 0) - (freq[a.id] || 0) || a.order - b.order; });
    }
    var tmpl = L.quickTemplates(doc, 6);
    var notes = {}; doc.transactions.slice(-400).forEach(function (t) { if (t.note) notes[t.note] = 1; });

    var body =
      (editing ? "" : '<div><label class="sr" for="tx-quick">Nhập nhanh</label><input type="text" id="tx-quick" placeholder="Nhập nhanh: cơm trưa 57/2 hôm qua" autocomplete="off"><div class="preview mt-s" id="tx-prev" aria-live="polite"></div></div>') +
      U.seg("txType", [{ id: "expense", label: "Chi", cls: "t-expense" }, { id: "income", label: "Thu", cls: "t-income" }, { id: "transfer", label: "Chuyển", cls: "t-transfer" }], T.type, "type full") +
      U.field("Số tiền", '<input type="text" id="tx-amt" inputmode="decimal" autocomplete="off" placeholder="vd 57k, 1,5tr, 61.500" value="' + esc(T.amount) + '">', '<span id="tx-echo" aria-live="polite"></span>', "tx-amt") +
      '<div data-show="expense income"><div class="fld" id="cat-lbl">Danh mục</div><div class="cat-grid mt-s" id="tx-cats" role="group" aria-labelledby="cat-lbl"></div></div>' +
      '<div class="grid g2"><div data-show="expense income transfer"><label class="fld" for="tx-acc" id="acc-lbl">Tài khoản</label><span class="in"><select id="tx-acc"></select></span></div>' +
      '<div data-show="transfer"><label class="fld" for="tx-to">Đến tài khoản</label><span class="in"><select id="tx-to"></select></span></div></div>' +
      '<div><div class="fld">Ngày</div><div class="row wrap mt-s"><button type="button" class="chip" data-d="0">Hôm nay</button><button type="button" class="chip" data-d="-1">Hôm qua</button><input type="date" id="tx-date" style="width:auto;flex:1;min-width:150px" value="' + esc(T.date) + '"></div></div>' +
      U.field("Ghi chú", '<input type="text" id="tx-note" list="tx-notes" maxlength="300" value="' + esc(T.note) + '" placeholder="vd Cơm mai dịch"><datalist id="tx-notes">' + Object.keys(notes).slice(-80).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>", "", "tx-note") +
      U.field("Thẻ (tuỳ chọn)", '<input type="text" id="tx-tags" value="' + esc(T.tags) + '" placeholder="vd #dulich #quatang">', "", "tx-tags") +
      '<div data-show="expense" id="tx-split-wrap"><label class="chk"><input type="checkbox" id="tx-shared"> Chi chung — chia tiền với người khác</label><div id="tx-split" class="stack mt-s" hidden></div></div>' +
      (editing || !tmpl.length ? "" : '<div data-show="expense"><div class="fld">Mẫu nhanh</div><div class="chips mt-s" id="tx-tmpl"></div></div>') +
      '<p class="hint err" id="tx-err" role="alert"></p>';

    var foot = (editing ? '<button type="button" class="btn danger" data-del>Xoá</button><button type="button" class="btn" data-dup>Nhân bản</button>' : '<button type="button" class="btn" data-next>Lưu và thêm tiếp</button>') +
      '<button type="button" class="btn primary" data-save>Lưu</button>';
    var d = U.dialog(editing ? "Sửa giao dịch" : "Thêm giao dịch", body, foot, { focus: editing ? "#tx-amt" : "#tx-quick" });
    var el = d.el;
    var q = function (s) { return el.querySelector(s); };

    /* ---- dựng/ cập nhật phần phụ thuộc trạng thái ---- */
    function amountValue() { return M.parse(T.amount, opts(doc)); }
    function shareList() {
      var amt = amountValue(), ids = T.ids.filter(function (id) { return doc.people.some(function (p) { return p.id === id; }); });
      if (!ids.length) return { ok: false, msg: "Chọn ít nhất một người tham gia" };
      if (!amt.ok || amt.value <= 0) return { ok: false, msg: "", ids: ids };
      if (T.mode === "equal") {
        var parts = M.allocate(amt.value, ids.map(function () { return 1; })), shares = {};
        ids.forEach(function (id, i) { shares[id] = parts[i]; });
        return { ok: true, shares: shares, ids: ids };
      }
      var out = {}, sum = 0, bad = false;
      ids.forEach(function (id) { var r = M.parse(T.exact[id] || "0", { smallAsThousand: doc.settings.smallAsThousand }); if (!r.ok) bad = true; else { out[id] = r.value; sum += r.value; } });
      if (bad) return { ok: false, msg: "Có phần chia không đọc được", ids: ids };
      if (sum !== amt.value) return { ok: false, msg: "Tổng các phần " + fmt(sum) + (sum < amt.value ? " — còn thiếu " + fmt(amt.value - sum) : " — thừa " + fmt(sum - amt.value)), ids: ids, shares: out };
      return { ok: true, shares: out, ids: ids };
    }

    function renderCats() {
      var box = q("#tx-cats"); if (!box) return;
      var list = catsFor(T.type);
      if (T.categoryId && !list.some(function (x) { return x.id === T.categoryId; })) T.categoryId = null;   // đổi Chi ↔ Thu thì danh mục cũ không còn hợp lệ
      box.innerHTML = list.map(function (x) {
        return '<button type="button" data-cat="' + esc(x.id) + '" aria-pressed="' + (x.id === T.categoryId) + '"><span aria-hidden="true">' + esc(x.icon) + '</span><span class="nm">' + esc(x.name) + "</span></button>";
      }).join("");
    }
    function renderAccounts() {
      q("#tx-acc").innerHTML = accountOptions(doc, T.accountId, { all: T.type === "transfer" });
      if (T.type === "transfer") q("#tx-to").innerHTML = U.options(doc.accounts.filter(function (a) { return !a.archived || a.id === T.toAccountId; }).map(function (a) { return { id: a.id, label: a.icon + " " + a.name }; }), T.toAccountId, "— chọn —");
      q("#acc-lbl").textContent = T.type === "transfer" ? "Từ tài khoản" : (T.type === "income" ? "Nhận vào" : "Trả bằng");
    }
    function renderSplit() {
      var box = q("#tx-split"), on = T.shared && T.type === "expense";
      q("#tx-shared").checked = T.shared;
      box.hidden = !on;
      if (!on) return;
      var people = doc.people.filter(function (p) { return !p.archived || T.ids.indexOf(p.id) !== -1; });
      if (people.length < 2) {
        box.innerHTML = '<p class="hint">Chưa có người nào để chia. <button type="button" class="btn sm" data-addperson>Thêm người</button></p>'; return;
      }
      var sl = shareList();
      var html = U.field("Ai trả", '<select id="tx-payer">' + U.options(people.map(function (p) { return { id: p.id, label: p.id === me ? p.name + " (bạn)" : p.name }; }), T.paidBy) + "</select>", "", "tx-payer") +
        '<div><div class="fld">Ai tham gia</div><div class="chips mt-s">' + people.map(function (p) {
          return '<label class="chip' + (T.ids.indexOf(p.id) !== -1 ? " on" : "") + '"><input type="checkbox" data-pid="' + esc(p.id) + '"' + (T.ids.indexOf(p.id) !== -1 ? " checked" : "") + ' style="width:18px;height:18px"> ' + esc(p.name) + "</label>";
        }).join("") + "</div></div>" + U.seg("splitMode", [{ id: "equal", label: "Chia đều" }, { id: "exact", label: "Theo số tiền" }], T.mode);
      if (T.mode === "exact") {
        html += '<div class="stack gap-s">' + T.ids.map(function (id) {
          var p = QL.model.find(doc.people, id);
          return '<label class="row"><span style="min-width:90px">' + esc(p ? p.name : id) + '</span><input type="text" inputmode="decimal" data-exact="' + esc(id) + '" value="' + esc(T.exact[id] || "") + '" placeholder="số tiền"></label>';
        }).join("") + "</div>";
      }
      html += '<p class="hint ' + (sl.ok ? "ok" : (sl.msg ? "err" : "")) + '" id="tx-split-sum">' + splitSummary(sl) + "</p>";
      box.innerHTML = html;
    }
    function splitSummary(sl) {
      if (!sl.ok) return esc(sl.msg || "");
      return Object.keys(sl.shares).map(function (id) { var p = QL.model.find(doc.people, id); return esc(p ? p.name : id) + " " + fmt(sl.shares[id]); }).join(" · ") +
        (T.paidBy === me ? "" : " · " + esc(V.personName(c, T.paidBy)) + " trả hộ — không trừ tài khoản của bạn");
    }
    function refresh() {
      var amt = amountValue(), echo = q("#tx-echo");
      echo.className = "hint" + (T.amount && !amt.ok ? " err" : (amt.ok ? " ok" : ""));
      echo.textContent = !T.amount ? "" : (amt.ok ? "= " + fmt(amt.value) : "Không đọc được số tiền");
      el.querySelectorAll("[data-show]").forEach(function (g) { g.hidden = g.dataset.show.split(" ").indexOf(T.type) === -1; });
      el.querySelectorAll("[data-seg=txType]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === T.type)); });
      q("#tx-split-wrap").hidden = T.type !== "expense";
      renderCats(); renderAccounts(); renderSplit();
      if (T.type === "expense" && T.shared && T.paidBy !== me) q("#tx-acc").closest("[data-show]").hidden = true;
      var t = q("#tx-tmpl");
      if (t) t.innerHTML = tmpl.map(function (x, i) { var cat = V.catOf(c, x.categoryId); return '<button type="button" class="chip" data-tmpl="' + i + '">' + esc(cat.icon) + " " + esc(x.note) + " · " + esc(M.compact(x.amount)) + (x.split ? " · chia" : "") + "</button>"; }).join("");
    }

    /* ---- nhập nhanh ---- */
    function preview(p) {
      var box = q("#tx-prev"); if (!box) return;
      if (!p) { box.innerHTML = ""; return; }
      var chips = [];
      if (p.amount) chips.push('<span class="chip static num">' + fmt(p.amount) + "</span>"); else chips.push('<span class="chip warn">Chưa thấy số tiền</span>');
      chips.push('<span class="chip static">' + esc(D.relativeLabel(p.date, todayIso)) + "</span>");
      if (p.categoryId) { var cat = V.catOf(c, p.categoryId); chips.push('<span class="chip static">' + esc(cat.icon) + " " + esc(cat.name) + "</span>"); }
      if (p.type === "income") chips.push('<span class="chip static thu">Thu</span>');
      if (p.type === "transfer") chips.push('<span class="chip static chuyen">Chuyển khoản</span>');
      if (p.split) chips.push('<span class="chip static">Chia ' + p.split.n + (p.split.payerId !== me ? " · " + esc(V.personName(c, p.split.payerId)) + " trả" : "") + "</span>");
      p.warnings.forEach(function (w) { chips.push('<span class="chip warn">' + esc(w) + "</span>"); });
      box.innerHTML = chips.join("");
    }
    function applyQuick() {
      var qEl = q("#tx-quick"); if (!qEl) return;
      var p = QL.parser.parseQuick(qEl.value, { today: todayIso, doc: doc });
      preview(p);
      if (!p) return;
      if (!T.touched.type) T.type = p.type;
      if (p.amount && !T.touched.amount) { T.amount = amtText(p.amount); q("#tx-amt").value = T.amount; }
      if (p.dateGiven && !T.touched.date) { T.date = p.date; q("#tx-date").value = T.date; }
      if (p.categoryId && !T.touched.cat && p.type !== "transfer") T.categoryId = p.categoryId;
      if (!T.touched.note) { T.note = p.note; q("#tx-note").value = T.note; }
      if (!T.touched.shared) {
        if (p.split) { T.shared = true; T.paidBy = p.split.payerId; T.ids = p.split.participantIds.slice(); T.mode = "equal"; }
        else T.shared = false;
      }
      refresh();
    }

    /* ---- lưu ---- */
    function build() {
      var amt = amountValue();
      if (!amt.ok || amt.value <= 0) return { error: "Hãy nhập số tiền hợp lệ (vd 57k, 1,5tr, 61.500)" };
      var tx = { id: editing ? editing.id : Mo.uid("t"), type: T.type, date: q("#tx-date").value || T.date, amount: amt.value, note: q("#tx-note").value.trim(),
        tags: q("#tx-tags").value.split(/[\s,]+/).map(function (t) { return t.replace(/^#+/, ""); }).filter(Boolean).slice(0, 10), accountId: null, categoryId: null, toAccountId: null };
      if (editing) { if (editing.createdAt) tx.createdAt = editing.createdAt; if (editing.recurringId) tx.recurringId = editing.recurringId; }
      if (T.type === "transfer") { tx.accountId = q("#tx-acc").value || null; tx.toAccountId = q("#tx-to").value || null; }
      else {
        tx.categoryId = T.categoryId;
        tx.accountId = q("#tx-acc").value || null;
        if (T.type === "expense" && T.shared) {
          var sl = shareList();
          if (!sl.ok) return { error: sl.msg || "Phần chia chưa hợp lệ" };
          tx.split = { paidBy: T.paidBy, shares: sl.shares };
          if (T.paidBy !== me) tx.accountId = null;
        }
      }
      var errs = Mo.validateTx(tx, doc);
      return errs.length ? { error: errs[0] } : { tx: tx };
    }
    function save(again) {
      var r = build();
      if (r.error) { q("#tx-err").textContent = r.error; return; }
      var tx = r.tx;
      if (editing) {
        app.apply(function (dd) { return Mo.upsert(dd, "transactions", tx); }, "Đã cập nhật", function (dd) { return Mo.upsert(dd, "transactions", editing); });
        d.close(true);
      } else {
        app.apply(function (dd) { return Mo.upsert(dd, "transactions", tx); }, "Đã lưu " + fmt(tx.amount), function (dd) { return Mo.remove(dd, "transactions", tx.id); });
        if (again) { // giữ ngày, tài khoản, loại; xoá số tiền/ghi chú
          T.amount = ""; T.note = ""; T.touched = { type: true, date: true, shared: true }; T.exact = {};
          q("#tx-amt").value = ""; q("#tx-note").value = ""; q("#tx-err").textContent = "";
          var qe = q("#tx-quick"); if (qe) { qe.value = ""; preview(null); qe.focus(); }
          refresh();
        } else d.close(true);
      }
    }

    /* ---- sự kiện ---- */
    el.addEventListener("input", function (e) {
      var t = e.target;
      if (t.id === "tx-quick") applyQuick();
      else if (t.id === "tx-amt") { T.amount = t.value; T.touched.amount = true; refresh(); }
      else if (t.id === "tx-note") { T.note = t.value; T.touched.note = true; }
      else if (t.id === "tx-date") { T.date = t.value; T.touched.date = true; }
      else if (t.dataset && t.dataset.exact) { T.exact[t.dataset.exact] = t.value; var s = q("#tx-split-sum"); var sl = shareList(); if (s) { s.className = "hint " + (sl.ok ? "ok" : "err"); s.textContent = sl.ok ? "Tổng khớp số tiền" : sl.msg; } }
    });
    el.addEventListener("change", function (e) {
      var t = e.target;
      if (t.id === "tx-shared") { T.shared = t.checked; T.touched.shared = true; if (T.shared && T.ids.indexOf(me) === -1) T.ids.unshift(me); refresh(); }
      else if (t.id === "tx-payer") { T.paidBy = t.value; if (T.ids.indexOf(t.value) === -1) T.ids.push(t.value); refresh(); }
      else if (t.id === "tx-acc") T.accountId = t.value;
      else if (t.id === "tx-to") T.toAccountId = t.value;
      else if (t.dataset && t.dataset.pid) {
        var id = t.dataset.pid; T.ids = t.checked ? T.ids.concat(id) : T.ids.filter(function (x) { return x !== id; }); renderSplit();
      }
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") { e.preventDefault(); save(false); }
    });
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.seg === "txType") { T.type = b.dataset.v; T.touched.type = true; T.categoryId = null; refresh(); }
      else if (b.dataset.seg === "splitMode") {
        T.mode = b.dataset.v;
        if (T.mode === "exact") { var sl = shareList(); T.exact = {}; if (sl.shares) Object.keys(sl.shares).forEach(function (id) { T.exact[id] = amtText(sl.shares[id]); }); }
        renderSplit();
      }
      else if (b.dataset.cat) { T.categoryId = b.dataset.cat; T.touched.cat = true; renderCats(); }
      else if (b.dataset.d !== undefined) { T.date = D.addDays(todayIso, +b.dataset.d); q("#tx-date").value = T.date; T.touched.date = true; }
      else if (b.dataset.tmpl !== undefined) {
        var x = tmpl[+b.dataset.tmpl];
        T.amount = amtText(x.amount); q("#tx-amt").value = T.amount; T.note = x.note; q("#tx-note").value = x.note; T.categoryId = x.categoryId; T.touched = { amount: true, note: true, cat: true };
        if (x.accountId) T.accountId = x.accountId;
        if (x.split) { T.shared = true; T.paidBy = x.split.paidBy; T.ids = x.split.ids.slice(); T.mode = "equal"; T.touched.shared = true; } else { T.shared = false; T.touched.shared = true; }
        refresh(); q("#tx-amt").focus();
      }
      else if (b.hasAttribute("data-save")) save(false);
      else if (b.hasAttribute("data-next")) save(true);
      else if (b.hasAttribute("data-addperson")) { openPersonDialog(null, function (id) { doc = app.ctx().doc; c = app.ctx(); others = doc.people.filter(function (p) { return p.id !== me && !p.archived; }); T.ids = [me, id]; refresh(); }); }
      else if (b.hasAttribute("data-del")) {
        d.close(true);
        app.apply(function (dd) { return Mo.remove(dd, "transactions", editing.id); }, "Đã xoá", function (dd) { return Mo.upsert(dd, "transactions", editing); });
      }
      else if (b.hasAttribute("data-dup")) {
        d.close(true);
        var copy = JSON.parse(JSON.stringify(editing)); delete copy.id; delete copy.createdAt; copy.date = todayIso;
        setTimeout(function () { openTxDialog({ draft: copy }); }, 0);
      }
    });
    refresh();
    var qe0 = q("#tx-quick");
    if (qe0 && init.quick) { qe0.value = init.quick; applyQuick(); }
    return d;
  }

  /* ===================================================================
     Người, tài khoản, danh mục
     =================================================================== */
  function openPersonDialog(id, onDone) {
    var app = A(), doc = app.ctx().doc, p = id ? QL.model.find(doc.people, id) : null;
    var isDef = p && (doc.settings.defaultPartnerIds || []).indexOf(p.id) !== -1;
    var used = p && doc.transactions.some(function (t) { return t.personId === p.id || (t.split && (t.split.paidBy === p.id || t.split.shares[p.id] !== undefined)); });
    var d = formDialog(p ? "Sửa người" : "Thêm người",
      U.field("Tên", '<input type="text" name="name" maxlength="60" value="' + esc(p ? p.name : "") + '" placeholder="vd Phúc" required>') +
      '<label class="chk"><input type="checkbox" name="def"' + (isDef || !p ? " checked" : "") + '> Chia mặc định khi gõ “57/2”</label>' +
      (p ? '<label class="chk"><input type="checkbox" name="arch"' + (p.archived ? " checked" : "") + '> Lưu trữ (ẩn khỏi danh sách chọn)</label>' + (used ? '<p class="hint">Người này đã có trong giao dịch nên không xoá được — chỉ lưu trữ.</p>' : '<button type="button" class="btn danger" data-del>Xoá người này</button>') : ""),
      "Lưu", function (fd) {
        var name = (fd.get("name") || "").trim();
        if (!name) return "Hãy nhập tên";
        if (doc.people.some(function (x) { return x.id !== (p && p.id) && QL.text.fold(x.name) === QL.text.fold(name); })) return "Đã có người tên này";
        var rec = p ? Object.assign({}, p, { name: name, archived: !!fd.get("arch") }) : { id: Mo.uid("p"), name: name, archived: false };
        app.apply(function (dd) {
          var n = Mo.upsert(dd, "people", rec);
          var defs = (n.settings.defaultPartnerIds || []).filter(function (x) { return x !== rec.id; });
          if (fd.get("def")) defs.push(rec.id);
          return Mo.setSettings(n, { defaultPartnerIds: defs.slice(0, 8) });
        }, p ? "Đã cập nhật" : "Đã thêm " + name);
        if (onDone) onDone(rec.id);
      });
    var del = d.el.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () { d.close(); app.apply(function (dd) { return Mo.remove(dd, "people", p.id); }, "Đã xoá " + p.name, function (dd) { return Mo.upsert(dd, "people", p); }); });
  }

  var ICONS = ["💵", "🏦", "📱", "💳", "🪙", "🐷", "🏠", "🚗", "🎁", "🍜", "🛍️", "💊", "📚", "🎬", "👪", "✈️", "⋯", "➕"];
  function openAccountDialog(id) {
    var app = A(), doc = app.ctx().doc, a = id ? QL.model.find(doc.accounts, id) : null, dep = a && a.deposit;
    var used = a && doc.transactions.some(function (t) { return t.accountId === a.id || t.toAccountId === a.id; });
    var body = U.field("Tên", '<input type="text" name="name" maxlength="80" value="' + esc(a ? a.name : "") + '" placeholder="vd Techcombank" required>') +
      (dep ? "" : U.field("Loại", '<select name="kind">' + U.options([{ id: "cash", label: "Tiền mặt" }, { id: "bank", label: "Ngân hàng" }, { id: "ewallet", label: "Ví điện tử" }], a ? a.kind : "bank") + "</select>")) +
      U.field("Số dư đầu kỳ", '<input type="text" inputmode="decimal" name="open" value="' + esc(a && a.openingBalance ? amtText(a.openingBalance) : "") + '" placeholder="0">', "Số dư hiện tại = số dư đầu kỳ + các giao dịch. Nhập số dư đang có lúc bạn bắt đầu dùng app.");
    if (dep) body += U.field("Lãi suất (%/năm)", '<input type="text" inputmode="decimal" name="rate" value="' + esc(String(dep.rate).replace(".", ",")) + '">') + U.field("Kỳ hạn (tháng)", '<input type="number" name="term" min="1" max="120" value="' + dep.termMonths + '">') +
      U.field("Ngày gửi", '<input type="date" name="opened" value="' + esc(dep.openedOn) + '">') + U.field("Thuế trên lãi (%)", '<input type="text" inputmode="decimal" name="tax" value="' + esc(String(dep.taxPct || 0).replace(".", ",")) + '">');
    if (a) body += '<label class="chk"><input type="checkbox" name="arch"' + (a.archived ? " checked" : "") + '> Lưu trữ</label>' + (used ? "" : '<button type="button" class="btn danger" data-del>Xoá tài khoản</button>');
    var d = formDialog(a ? "Sửa tài khoản" : "Thêm tài khoản", body, "Lưu", function (fd) {
      var name = (fd.get("name") || "").trim(); if (!name) return "Hãy nhập tên";
      var open = (fd.get("open") || "").trim() === "" ? 0 : moneyOf(fd, "open", doc, true);
      if (open === null) return "Số dư đầu kỳ không đọc được";
      var rec = a ? Object.assign({}, a) : { id: Mo.uid("a"), kind: fd.get("kind"), archived: false, order: doc.accounts.length };
      rec.name = name; rec.openingBalance = open; if (a) rec.archived = !!fd.get("arch");
      if (!dep) { // loại không đổi được với sổ tiết kiệm; còn lại biểu tượng theo loại
        var kind = fd.get("kind");
        if (!a || a.kind !== kind) rec.icon = { cash: "💵", bank: "🏦", ewallet: "📱" }[kind] || "💵";
        rec.kind = kind;
      }
      if (dep) {
        var rate = parseFloat(String(fd.get("rate")).replace(",", ".")), tax = parseFloat(String(fd.get("tax") || "0").replace(",", ".")) || 0, term = parseInt(fd.get("term"), 10);
        if (!(rate >= 0) || !(term > 0) || !D.isValid(fd.get("opened"))) return "Lãi suất, kỳ hạn hoặc ngày gửi chưa hợp lệ";
        rec.deposit = Object.assign({}, dep, { rate: rate, termMonths: term, openedOn: fd.get("opened"), taxPct: Math.min(100, Math.max(0, tax)) });
      }
      app.apply(function (dd) { return Mo.upsert(dd, "accounts", rec); }, a ? "Đã cập nhật" : "Đã thêm tài khoản");
    });
    var del = d.el.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () { d.close(); app.apply(function (dd) { return Mo.remove(dd, "accounts", a.id); }, "Đã xoá", function (dd) { return Mo.upsert(dd, "accounts", a); }); });
  }

  function openCategoryDialog(id) {
    var app = A(), doc = app.ctx().doc, cat = id ? QL.model.find(doc.categories, id) : null;
    var used = cat && doc.transactions.some(function (t) { return t.categoryId === cat.id; });
    var d = formDialog(cat ? "Sửa danh mục" : "Thêm danh mục",
      U.field("Tên", '<input type="text" name="name" maxlength="80" value="' + esc(cat ? cat.name : "") + '" required>') +
      (cat ? "" : U.field("Loại", '<select name="kind">' + U.options([{ id: "expense", label: "Chi" }, { id: "income", label: "Thu" }], "expense") + "</select>")) +
      U.field("Biểu tượng", '<select name="icon">' + ICONS.map(function (i) { return '<option' + (cat && cat.icon === i ? " selected" : "") + ">" + i + "</option>"; }).join("") + "</select>") +
      U.field("Màu", '<input type="color" name="color" value="' + esc(cat && /^#[0-9a-f]{6}$/i.test(cat.color) ? cat.color : "#5b9bd5") + '" style="height:44px;padding:4px">') +
      (cat ? '<label class="chk"><input type="checkbox" name="arch"' + (cat.archived ? " checked" : "") + '> Ẩn (không hiện khi chọn, giao dịch cũ vẫn giữ)</label>' + (used ? '<p class="hint">Có giao dịch đang dùng danh mục này nên chỉ ẩn được.</p>' : '<button type="button" class="btn danger" data-del>Xoá danh mục</button>') : ""),
      "Lưu", function (fd) {
        var name = (fd.get("name") || "").trim(); if (!name) return "Hãy nhập tên";
        var rec = cat ? Object.assign({}, cat) : { id: Mo.uid("c"), kind: fd.get("kind"), archived: false, order: 50 + doc.categories.length };
        rec.name = name; rec.icon = fd.get("icon") || "•"; rec.color = fd.get("color") || "#98a2ad"; if (cat) rec.archived = !!fd.get("arch");
        app.apply(function (dd) { return Mo.upsert(dd, "categories", rec); }, cat ? "Đã cập nhật" : "Đã thêm danh mục");
      });
    var del = d.el.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () { d.close(); app.apply(function (dd) { return Mo.remove(dd, "categories", cat.id); }, "Đã xoá", function (dd) { return Mo.upsert(dd, "categories", cat); }); });
  }

  /* ===================================================================
     Sổ tiết kiệm
     =================================================================== */
  function openDepositDialog(pre) {
    pre = pre || {};
    var app = A(), c = app.ctx(), doc = c.doc;
    var sources = doc.accounts.filter(function (a) { return !a.archived && a.kind !== "savings"; });
    var d = formDialog("Mở sổ tiết kiệm",
      U.field("Tên sổ", '<input type="text" name="name" maxlength="80" value="' + esc(pre.name || "") + '" placeholder="vd Lương SRV 2610" required>') +
      U.field("Gửi từ tài khoản", '<select name="from">' + U.options(sources.map(function (a) { return { id: a.id, label: a.icon + " " + a.name }; }), pre.fromAccountId || doc.settings.defaultAccountId) + "</select>") +
      U.field("Số tiền gửi", '<input type="text" inputmode="decimal" name="amount" value="' + esc(pre.amount ? amtText(pre.amount) : "") + '" placeholder="vd 12tr" required>') +
      '<div class="grid g2">' + U.field("Lãi suất (%/năm)", '<input type="text" inputmode="decimal" name="rate" value="' + esc(pre.rate ? String(pre.rate).replace(".", ",") : "") + '" placeholder="vd 8,6" required>') +
      U.field("Kỳ hạn (tháng)", '<input type="number" name="term" min="1" max="120" value="' + (pre.termMonths || 12) + '">') + "</div>" +
      '<div class="grid g2">' + U.field("Ngày gửi", '<input type="date" name="opened" value="' + esc(pre.openedOn || c.today) + '">') + U.field("Thuế trên lãi (%)", '<input type="text" inputmode="decimal" name="tax" value="0">', "Một số ví điện tử khấu trừ 5 % thuế TNCN trên lãi.") + "</div>" +
      '<div class="card" id="dep-prev" aria-live="polite"></div>',
      "Mở sổ", function (fd) {
        var amount = moneyOf(fd, "amount", doc), rate = parseFloat(String(fd.get("rate")).replace(",", ".")), term = parseInt(fd.get("term"), 10);
        var name = (fd.get("name") || "").trim();
        if (!name) return "Hãy đặt tên sổ"; if (amount === null) return "Số tiền gửi không đọc được";
        if (!(rate >= 0) || isNaN(rate)) return "Lãi suất chưa hợp lệ"; if (!(term > 0)) return "Kỳ hạn chưa hợp lệ"; if (!D.isValid(fd.get("opened"))) return "Ngày gửi chưa hợp lệ";
        if (!fd.get("from")) return "Chưa có tài khoản nguồn — hãy tạo tài khoản trước";
        var tax = parseFloat(String(fd.get("tax") || "0").replace(",", ".")) || 0, id = Mo.uid("a");
        app.apply(function (dd) { return Mo.openDeposit(dd, { id: id, name: name, fromAccountId: fd.get("from"), amount: amount, rate: rate, termMonths: term, openedOn: fd.get("opened"), taxPct: Math.min(100, Math.max(0, tax)) }).doc; }, "Đã mở sổ " + name);
      });
    var form = d.el.querySelector("form");
    function prev() {
      var fd = new FormData(form), amount = moneyOf(fd, "amount", doc), rate = parseFloat(String(fd.get("rate")).replace(",", ".")), term = parseInt(fd.get("term"), 10), opened = fd.get("opened");
      var box = d.el.querySelector("#dep-prev");
      if (amount === null || isNaN(rate) || !(term > 0) || !D.isValid(opened)) { box.innerHTML = '<span class="muted">Nhập số tiền, lãi suất và kỳ hạn để xem ngày đáo hạn và lãi dự kiến.</span>'; return; }
      var tax = parseFloat(String(fd.get("tax") || "0").replace(",", ".")) || 0;
      var info = L.savingsInfo({ id: "x", deposit: { rate: rate, termMonths: term, openedOn: opened, taxPct: tax, closedOn: null } }, amount, c.today);
      box.innerHTML = "Đáo hạn <strong>" + esc(D.dm(info.maturityOn)) + "/" + info.maturityOn.slice(0, 4) + "</strong> (" + info.termDays + " ngày) · lãi dự kiến <strong class=\"thu num\">+" + fmt(info.interest) + "</strong>" + (info.tax ? " · thuế −" + fmt(info.tax) : "") + " · nhận về <strong class=\"num\">" + fmt(info.total) + "</strong>";
    }
    form.addEventListener("input", prev); prev();
  }

  function openCloseDepositDialog(id) {
    var app = A(), c = app.ctx(), doc = c.doc, a = QL.model.find(doc.accounts, id);
    var bal = L.accountBalances(doc)[id] || 0, info = L.savingsInfo(a, bal, c.today);
    var targets = doc.accounts.filter(function (x) { return !x.archived && x.kind !== "savings"; });
    formDialog("Tất toán " + a.name,
      '<p>Gốc <strong class="num">' + fmt(bal) + "</strong> · lãi dự kiến <strong class=\"num\">" + fmt(info.interest) + "</strong>" + (info.tax ? " − thuế " + fmt(info.tax) : "") + "</p>" +
      U.field("Lãi thực nhận (sau thuế)", '<input type="text" inputmode="decimal" name="interest" value="' + esc(amtText(info.netInterest) || "0") + '">', "Sửa lại nếu ngân hàng trả khác dự kiến (rút trước hạn, lãi không kỳ hạn…).") +
      U.field("Nhận về tài khoản", '<select name="to">' + U.options(targets.map(function (x) { return { id: x.id, label: x.icon + " " + x.name }; }), doc.settings.defaultAccountId) + "</select>") +
      U.field("Ngày tất toán", '<input type="date" name="date" value="' + esc(c.today) + '">') +
      '<label class="chk"><input type="checkbox" name="renew"> Tái tục: mở sổ mới bằng gốc + lãi vừa nhận</label>',
      "Tất toán", function (fd) {
        var interest = (fd.get("interest") || "").trim() === "" ? 0 : moneyOf(fd, "interest", doc, true);
        if (interest === null) return "Lãi không đọc được"; if (!D.isValid(fd.get("date"))) return "Ngày chưa hợp lệ"; if (!fd.get("to")) return "Chọn tài khoản nhận";
        var to = fd.get("to"), renew = !!fd.get("renew");
        app.apply(function (dd) { return Mo.closeDeposit(dd, id, { date: fd.get("date"), toAccountId: to, principal: bal, interest: interest }); }, "Đã tất toán " + a.name);
        if (renew) setTimeout(function () { openDepositDialog({ amount: bal + interest, fromAccountId: to, rate: a.deposit.rate, termMonths: a.deposit.termMonths, name: a.name + " (tái tục)", openedOn: fd.get("date") }); }, 0);
      });
  }

  /* ===================================================================
     Chia tiền: quyết toán, chi tiết, hoá đơn
     =================================================================== */
  function openSettleDialog(personId) {
    var app = A(), c = app.ctx(), doc = c.doc, p = QL.model.find(doc.people, personId);
    if (!p) return;
    var choices = [{ id: "wk", label: "Tuần này" }, { id: "pwk", label: "Tuần trước" }, { id: "mo", label: "Tháng này" }, { id: "pmo", label: "Tháng trước" }, { id: "all", label: "Tất cả" }];
    function periodOf(id) {
      if (id === "wk") return D.period("week", c.today); if (id === "pwk") return D.period("week", D.addDays(c.today, -7));
      if (id === "mo") return D.period("month", c.today); if (id === "pmo") return D.period("month", D.addMonths(c.today, -1)); return D.period("all", c.today);
    }
    var bal = L.personBalances(doc)[personId] || 0, s = L.settlementOf(bal);
    var d = formDialog("Quyết toán với " + p.name,
      U.field("Kỳ", '<select name="per">' + U.options(choices, "wk") + "</select>") +
      U.field("Tin nhắn quyết toán", '<textarea id="st-msg" readonly rows="9"></textarea>') + '<button type="button" class="btn" data-copy>Sao chép tin nhắn</button>' +
      (s.direction === "even" ? '<p class="hint ok">Hai bên đang hoà — không cần ghi thanh toán.</p>' :
        '<div class="card"><h3>' + (s.direction === "receive" ? esc(p.name) + " chuyển cho bạn" : "Bạn chuyển cho " + esc(p.name)) + '</h3>' +
        '<div class="grid g2 mt-s">' + U.field("Số tiền", '<input type="text" inputmode="decimal" name="amount" value="' + esc(amtText(s.amount)) + '">') +
        U.field(s.direction === "receive" ? "Nhận vào" : "Trả từ", '<select name="acc">' + accountOptions(doc, doc.settings.defaultAccountId) + "</select>") + "</div>" +
        '<label class="chk"><input type="checkbox" name="record"> Ghi nhận khoản thanh toán này (làm số nợ giảm)</label></div>'),
      "Xong", function (fd) {
        if (fd.get("record")) {
          var amount = moneyOf(fd, "amount", doc);
          if (amount === null) return "Số tiền không đọc được";
          var tx = { id: Mo.uid("t"), type: "settle", date: c.today, amount: amount, personId: personId, direction: s.direction === "receive" ? "in" : "out", accountId: fd.get("acc"), categoryId: null, toAccountId: null, note: "", tags: [] };
          var errs = Mo.validateTx(tx, doc); if (errs.length) return errs[0];
          app.apply(function (dd) { return Mo.upsert(dd, "transactions", tx); }, "Đã ghi thanh toán " + fmt(amount), function (dd) { return Mo.remove(dd, "transactions", tx.id); });
        }
      });
    var form = d.el.querySelector("form"), msg = d.el.querySelector("#st-msg");
    function upd() { msg.value = L.settlementMessage(doc, personId, periodOf(form.elements.per.value)); }
    form.elements.per.addEventListener("change", upd); upd();
    d.el.querySelector("[data-copy]").addEventListener("click", function () { U.copyText(msg.value).then(function (ok) { U.toast(ok ? "Đã sao chép tin nhắn" : "Không sao chép được — hãy bôi đen và sao chép tay"); }); });
  }

  function openPersonDetail(personId) {
    var app = A(), c = app.ctx(), p = QL.model.find(c.doc.people, personId); if (!p) return;
    var sh = L.sharedWith(c.doc, personId).items.slice().reverse();
    var bal = L.personBalances(c.doc)[personId] || 0, s = L.settlementOf(bal);
    U.dialog("Các khoản chung với " + p.name,
      '<p>' + (s.direction === "even" ? "Hai bên đang hoà." : (s.direction === "receive" ? esc(p.name) + " nợ bạn " : "Bạn nợ " + esc(p.name) + " ") + "<strong class=\"num\">" + fmt(s.amount) + "</strong>") + "</p>" +
      (sh.length ? '<div class="list">' + sh.map(function (it) {
        return '<button type="button" class="item" data-open="' + esc(it.tx.id) + '"><span class="mid"><span class="ttl">' + esc(V.txTitle(it.tx, c)) + '</span><span class="meta">' + esc(D.dayLabel(it.tx.date)) + (it.tx.type === "settle" ? " · thanh toán" : "") + '</span></span><span class="amt num ' + (it.delta > 0 ? "thu" : "chi") + '">' + (it.delta > 0 ? "+" : "−") + fmt(Math.abs(it.delta)) + "</span></button>";
      }).join("") + "</div>" : "<p class=\"muted\">Chưa có khoản chung nào.</p>"), '<button type="button" class="btn" data-close>Đóng</button>', { wide: true })
      .el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-open]"); if (!b) return;
        var tx = QL.model.find(app.ctx().doc.transactions, b.dataset.open); if (tx) { e.currentTarget.close(); app.editTx(tx); }
      });
  }

  function openBillDialog() {
    var app = A(), c = app.ctx(), doc = c.doc;
    var d = U.dialog("Máy tính chia hoá đơn trọ",
      '<form id="bill" autocomplete="off" class="stack">' +
      '<div class="grid g3">' + U.field("Chỉ số điện cũ", '<input type="number" name="old" inputmode="numeric" min="0">') + U.field("Chỉ số điện mới", '<input type="number" name="new" inputmode="numeric" min="0">') +
      U.field("Đơn giá điện (đ/số)", '<input type="text" inputmode="decimal" name="unit" value="4k">') + "</div>" +
      '<div class="grid g3">' + U.field("Tiền nước", '<input type="text" inputmode="decimal" name="water" placeholder="vd 200k">') + U.field("Tạm trú / khác", '<input type="text" inputmode="decimal" name="other" placeholder="vd 200k">') +
      U.field("Tiền phòng", '<input type="text" inputmode="decimal" name="rent" placeholder="vd 4tr">') + "</div>" +
      U.field("Số người chia", '<input type="number" name="n" min="1" max="9" value="2">') +
      '<div class="card" id="bill-out" aria-live="polite"></div></form>',
      '<button type="button" class="btn" data-copy>Sao chép kết quả</button><button type="button" class="btn primary" data-record>Ghi thành khoản chi chung</button>', { wide: true });
    var form = d.el.querySelector("form"), out = d.el.querySelector("#bill-out"), last = null;
    function val(n) { var r = M.parse(form.elements[n].value, opts(doc)); return r.ok ? r.value : 0; }
    function upd() {
      var r = L.billSplit({ oldReading: +form.elements.old.value || 0, newReading: +form.elements.new.value || 0, unitPrice: val("unit"), fixed: [val("water"), val("other"), val("rent")], people: +form.elements.n.value || 1 });
      last = r;
      out.innerHTML = '<table class="tbl"><tbody><tr><td>Điện: ' + r.usage + " số × " + fmt(val("unit")) + '</td><td class="r num">' + fmt(r.electricity) + '</td></tr><tr><td>Nước + tạm trú + phòng</td><td class="r num">' + fmt(r.fixedTotal) + '</td></tr><tr><td><strong>Tổng</strong></td><td class="r num"><strong>' + fmt(r.total) + "</strong></td></tr></tbody></table>" +
        '<p class="mt-s">Mỗi người: <strong class="num">' + r.shares.map(fmt).join(" · ") + "</strong></p>";
    }
    form.addEventListener("input", upd); upd();
    d.el.querySelector("[data-copy]").addEventListener("click", function () {
      var t = "Hoá đơn trọ: điện " + last.usage + " số = " + fmt(last.electricity) + ", cố định " + fmt(last.fixedTotal) + ", tổng " + fmt(last.total) + ", mỗi người " + last.shares.map(fmt).join(" / ");
      U.copyText(t).then(function () { U.toast("Đã sao chép"); });
    });
    d.el.querySelector("[data-record]").addEventListener("click", function () {
      if (!last || !last.total) { U.toast("Chưa có số tiền để ghi"); return; }
      d.close();
      var partners = QL.parser.partners(doc).slice(0, Math.max(0, (+form.elements.n.value || 1) - 1));
      var ids = [c.me].concat(partners.map(function (p) { return p.id; }));
      var parts = M.allocate(last.total, ids.map(function () { return 1; })), shares = {};
      ids.forEach(function (id, i) { shares[id] = parts[i]; });
      openTxDialog({ draft: { type: "expense", amount: last.total, categoryId: "c_housing", note: "Hoá đơn trọ", date: c.today, accountId: doc.settings.defaultAccountId, split: ids.length > 1 ? { paidBy: c.me, shares: shares } : undefined } });
    });
  }

  /* ===================================================================
     Ngân sách, định kỳ
     =================================================================== */
  function openBudgetDialog(id) {
    var app = A(), doc = app.ctx().doc, b = id ? QL.model.find(doc.budgets, id) : null;
    var cats = [{ id: "", label: "Tổng chi tiêu" }].concat(doc.categories.filter(function (x) { return x.kind === "expense" && !x.archived; }).map(function (x) { return { id: x.id, label: x.icon + " " + x.name }; }));
    var d = formDialog(b ? "Sửa hạn mức" : "Thêm hạn mức",
      U.field("Áp dụng cho", '<select name="cat"' + (b ? " disabled" : "") + ">" + U.options(cats, b ? b.categoryId || "" : "c_shopping") + "</select>") +
      U.field("Hạn mức mỗi tháng", '<input type="text" inputmode="decimal" name="amount" value="' + esc(b ? amtText(b.amount) : "") + '" placeholder="vd 3tr" required>') + (b ? '<button type="button" class="btn danger" data-del>Xoá hạn mức</button>' : ""),
      "Lưu", function (fd) {
        var amount = moneyOf(fd, "amount", doc); if (amount === null) return "Số tiền không đọc được";
        var cat = b ? b.categoryId : (fd.get("cat") || null);
        if (!b && doc.budgets.some(function (x) { return (x.categoryId || null) === cat; })) return "Đã có hạn mức cho mục này — hãy sửa hạn mức đó";
        app.apply(function (dd) { return Mo.upsert(dd, "budgets", { id: b ? b.id : Mo.uid("b"), categoryId: cat, amount: amount }); }, "Đã lưu hạn mức");
      });
    var del = d.el.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () { d.close(); app.apply(function (dd) { return Mo.remove(dd, "budgets", b.id); }, "Đã xoá hạn mức", function (dd) { return Mo.upsert(dd, "budgets", b); }); });
  }

  function openRecurringDialog(id) {
    var app = A(), c = app.ctx(), doc = c.doc, r = id ? QL.model.find(doc.recurring, id) : null;
    var cats = doc.categories.filter(function (x) { return !x.archived; }).map(function (x) { return { id: x.id, label: x.icon + " " + x.name + (x.kind === "income" ? " (thu)" : "") }; });
    var wk = D.WD.map(function (l, i) { return { id: String(i), label: D.WD_LONG[i] }; });
    var d = formDialog(r ? "Sửa khoản định kỳ" : "Thêm khoản định kỳ",
      U.field("Tên", '<input type="text" name="name" maxlength="80" value="' + esc(r ? r.name : "") + '" placeholder="vd Vé xe bus tháng" required>') +
      U.seg("rtype", [{ id: "expense", label: "Chi" }, { id: "income", label: "Thu" }], r ? r.type : "expense", "full") +
      U.field("Số tiền", '<input type="text" inputmode="decimal" name="amount" value="' + esc(r ? amtText(r.amount) : "") + '" placeholder="vd 280k" required>') +
      U.field("Danh mục", '<select name="cat">' + U.options(cats, r ? r.categoryId : "c_transport") + "</select>") +
      U.field("Tài khoản", '<select name="acc">' + accountOptions(doc, r ? r.accountId : doc.settings.defaultAccountId) + "</select>") +
      U.seg("rfreq", [{ id: "monthly", label: "Hằng tháng" }, { id: "weekly", label: "Hằng tuần" }], r ? r.frequency : "monthly", "full") +
      '<div class="grid g2"><div id="r-day-m">' + U.field("Ngày trong tháng", '<input type="number" name="day" min="1" max="31" value="' + (r && r.frequency === "monthly" ? r.day : 28) + '">', "Tháng ngắn hơn thì lấy ngày cuối tháng.") + '</div><div id="r-day-w" hidden>' +
      U.field("Thứ", '<select name="wday">' + U.options(wk, String(r && r.frequency === "weekly" ? r.day : 0)) + "</select>") + "</div>" + U.field("Bắt đầu từ", '<input type="date" name="start" value="' + esc(r ? r.startOn : c.today) + '">') + "</div>" +
      U.field("Ghi chú khi tạo giao dịch", '<input type="text" name="note" maxlength="300" value="' + esc(r ? r.note : "") + '">') +
      '<label class="chk"><input type="checkbox" name="active"' + (!r || r.active ? " checked" : "") + '> Đang bật</label>' + (r ? '<button type="button" class="btn danger" data-del>Xoá</button>' : ""),
      "Lưu", function (fd) {
        var amount = moneyOf(fd, "amount", doc), name = (fd.get("name") || "").trim();
        if (!name) return "Hãy đặt tên"; if (amount === null) return "Số tiền không đọc được"; if (!D.isValid(fd.get("start"))) return "Ngày bắt đầu chưa hợp lệ";
        var freq = state.freq, type = state.type;
        var day = freq === "weekly" ? parseInt(fd.get("wday"), 10) : parseInt(fd.get("day"), 10);
        if (isNaN(day)) return "Ngày chưa hợp lệ";
        var cat = QL.model.find(doc.categories, fd.get("cat"));
        if (!cat) return "Chọn danh mục";
        if ((cat.kind === "income") !== (type === "income")) return "Danh mục không khớp loại " + (type === "income" ? "thu" : "chi");
        var rec = { id: r ? r.id : Mo.uid("r"), name: name, type: type, amount: amount, categoryId: cat.id, accountId: fd.get("acc") || null, note: (fd.get("note") || "").trim(),
          frequency: freq, day: freq === "weekly" ? day : Math.min(31, Math.max(1, day)), startOn: fd.get("start"), endOn: r ? r.endOn : null, lastDoneOn: r ? r.lastDoneOn : null, active: !!fd.get("active") };
        app.apply(function (dd) { return Mo.upsert(dd, "recurring", rec); }, "Đã lưu");
      });
    var state = { freq: r ? r.frequency : "monthly", type: r ? r.type : "expense" };
    function sync() {
      d.el.querySelector("#r-day-m").hidden = state.freq !== "monthly"; d.el.querySelector("#r-day-w").hidden = state.freq !== "weekly";
      d.el.querySelectorAll("[data-seg]").forEach(function (b) { b.setAttribute("aria-pressed", String(state[b.dataset.seg === "rtype" ? "type" : "freq"] === b.dataset.v)); });
    }
    d.el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-seg]"); if (!b) return;
      if (b.dataset.seg === "rtype") state.type = b.dataset.v; else state.freq = b.dataset.v; sync();
    });
    sync();
    var del = d.el.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () { d.close(); app.apply(function (dd) { return Mo.remove(dd, "recurring", r.id); }, "Đã xoá", function (dd) { return Mo.upsert(dd, "recurring", r); }); });
  }

  /* ===================================================================
     Nhập / xuất dữ liệu
     =================================================================== */
  function openImportTextDialog() {
    var app = A(), c = app.ctx(), doc = c.doc;
    var d = U.dialog("Dán từ ghi chú",
      '<p class="muted small">Dán các dòng như <code>27/2: vé xe buýt tháng 3: 280K</code>. Dòng tiêu đề, dòng tổng, dòng gộp nhiều ngày sẽ được bỏ qua hoặc đánh dấu để bạn xử lý. Năm lấy theo hôm nay.</p>' +
      '<textarea id="it-text" rows="8" placeholder="27/2: vé xe buýt tháng 3: 280K&#10;1/3: Mua data 4G 12 tháng: 840K&#10;2/3: Thưởng PI: 19.485.250" spellcheck="false"></textarea>' +
      '<button type="button" class="btn" data-parse>Phân tích</button><div id="it-out"></div>',
      '<button type="button" class="btn" data-close>Đóng</button><button type="button" class="btn primary" data-do disabled>Nhập</button>', { wide: true });
    var rows = [];
    d.el.querySelector("[data-parse]").addEventListener("click", function () {
      rows = QL.parser.parseLines(d.el.querySelector("#it-text").value, { today: c.today, doc: doc });
      var ok = rows.filter(function (r) { return r.status === "ok"; });
      ok.forEach(function (r) { r.dup = L.findDuplicate(doc, r.tx) !== null; r.on = !r.dup; });
      d.el.querySelector("#it-out").innerHTML = rows.length ? '<div class="scroll-x"><table class="tbl"><thead><tr><th></th><th>Dòng</th><th>Nhận diện</th></tr></thead><tbody>' + rows.map(function (r, i) {
        var what = r.status === "ok" ? esc(D.dm(r.tx.date)) + " · " + esc(r.tx.type === "income" ? "Thu " : "Chi ") + fmt(r.tx.amount) + " · " + esc(V.catOf(c, r.tx.categoryId).name) + (r.tx.split ? " · chia" : "") + (r.dup ? ' <span class="badge warn">trùng</span>' : "") + (r.reason ? ' <span class="small muted">' + esc(r.reason) + "</span>" : "")
          : '<span class="muted">' + (r.status === "skip" ? "Bỏ qua — " : "Chưa hiểu — ") + esc(r.reason) + "</span>";
        return "<tr><td>" + (r.status === "ok" ? '<input type="checkbox" data-i="' + i + '"' + (r.on ? " checked" : "") + ' aria-label="Nhập dòng này">' : "") + "</td><td>" + esc(r.line) + "</td><td>" + what + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<p class="muted">Không có dòng nào.</p>';
      upd();
    });
    function upd() { var n = rows.filter(function (r) { return r.on; }).length; var b = d.el.querySelector("[data-do]"); b.disabled = !n; b.textContent = "Nhập " + n + " khoản"; }
    d.el.addEventListener("change", function (e) { var i = e.target.dataset && e.target.dataset.i; if (i !== undefined) { rows[+i].on = e.target.checked; upd(); } });
    d.el.querySelector("[data-do]").addEventListener("click", function () {
      var txs = rows.filter(function (r) { return r.on; }).map(function (r) { return Object.assign({ id: Mo.uid("t") }, r.tx); });
      if (!txs.length) return;
      app.apply(function (dd) { var x = dd; txs.forEach(function (t) { x = Mo.upsert(x, "transactions", t); }); return x; }, "Đã nhập " + txs.length + " khoản", function (dd) { var x = dd; txs.forEach(function (t) { x = Mo.remove(x, "transactions", t.id); }); return x; });
      d.close(true);
    });
  }

  function openCsvImportDialog(text) {
    var app = A(), c = app.ctx(), doc = c.doc;
    var res = QL.csv.fromCsv(text, doc, c.today);
    if (res.error) { U.toast(res.error, { ms: 6000 }); return; }
    var ok = res.rows.filter(function (r) { return r.tx; }), bad = res.rows.filter(function (r) { return !r.tx; }), dup = ok.filter(function (r) { return r.duplicate; });
    var newCount = res.create.categories.length + res.create.accounts.length + res.create.people.length;
    var d = U.dialog("Nhập CSV",
      '<p><strong>' + (ok.length - dup.length) + "</strong> giao dịch mới" + (dup.length ? ", <strong>" + dup.length + "</strong> trùng với dữ liệu đang có (sẽ bỏ qua)" : "") + (bad.length ? ", <strong class=\"chi\">" + bad.length + "</strong> dòng lỗi (sẽ bỏ qua)" : "") + ".</p>" +
      (newCount ? '<p class="muted small">Sẽ tạo thêm: ' + res.create.categories.map(function (x) { return esc(x.name) + " (danh mục)"; }).concat(res.create.accounts.map(function (x) { return esc(x.name) + " (tài khoản)"; }), res.create.people.map(function (x) { return esc(x.name) + " (người)"; })).join(", ") + ".</p>" : "") +
      (bad.length ? '<div class="scroll-x"><table class="tbl"><tbody>' + bad.slice(0, 8).map(function (r) { return "<tr><td>Dòng " + r.n + '</td><td class="chi">' + esc(r.errors.join("; ")) + "</td></tr>"; }).join("") + "</tbody></table></div>" : ""),
      '<button type="button" class="btn" data-close>Huỷ</button><button type="button" class="btn primary" data-do' + (ok.length - dup.length ? "" : " disabled") + ">Nhập</button>");
    d.el.querySelector("[data-do]").addEventListener("click", function () {
      var before = app.ctx().doc, n = 0;
      app.apply(function (dd) { var r = QL.csv.applyImport(dd, res, {}); n = r.added; return r.doc; }, "Đã nhập " + (ok.length - dup.length) + " giao dịch", function () { return before; });
      d.close(true);
    });
  }

  function openRestoreDialog(text, name) {
    var app = A(), eng = app.engine, pr = eng.parseBackup(text);
    if (!pr.ok) { U.toast(pr.message, { ms: 6000 }); return; }
    var n = pr.doc, cur = app.ctx().doc;
    var d = U.dialog("Khôi phục từ " + (name || "file sao lưu"),
      "<p>File có <strong>" + n.transactions.length + "</strong> giao dịch, " + n.accounts.length + " tài khoản, " + (n.people.length - 1) + " người khác. Sổ hiện tại có <strong>" + cur.transactions.length + "</strong> giao dịch.</p>" +
      (pr.fixes.length ? '<p class="hint err">' + pr.fixes.length + " mục trong file bị bỏ vì không hợp lệ (vd: " + esc(pr.fixes[0]) + ").</p>" : "") +
      '<label class="chk"><input type="radio" name="how" value="merge" checked> <span><b>Gộp</b> vào sổ hiện tại (giữ cả hai, bản mới hơn thắng)</span></label>' +
      '<label class="chk"><input type="radio" name="how" value="replace"> <span><b>Thay thế</b> toàn bộ sổ hiện tại (có thể hoàn tác một bước)</span></label>',
      '<button type="button" class="btn" data-close>Huỷ</button><button type="button" class="btn primary" data-do>Khôi phục</button>', { center: true });
    d.el.querySelector("[data-do]").addEventListener("click", function () {
      var how = d.el.querySelector("input[name=how]:checked").value;
      if (how === "replace") eng.replaceDoc(n, "restore"); else eng.mergeDoc(n);
      d.close(true); U.toast("Đã khôi phục", how === "replace" ? { action: function () { eng.undoReplace(); }, label: "Hoàn tác" } : {});
    });
  }

  /* ===================================================================
     Kết nối máy chủ
     =================================================================== */
  var BNAME = { mysql: "MySQL", mongo: "MongoDB" };
  function showCode(code, backend) {
    var d = U.dialog("Mã kết nối " + BNAME[backend],
      '<div class="banner" role="alert"><b>Hãy lưu mã này ngay.</b> Đây là cách duy nhất để mở sổ trên thiết bị khác. Máy chủ chỉ giữ bản băm của khoá — mất mã là không lấy lại được.</div>' +
      '<input type="text" readonly id="code" value="' + esc(code) + '" style="font-family:ui-monospace,monospace" aria-label="Mã kết nối">',
      '<button type="button" class="btn" data-close>Đóng</button><button type="button" class="btn primary" data-copy>Sao chép mã</button>', { autofocus: false });
    d.el.querySelector("[data-copy]").addEventListener("click", function () { U.copyText(code).then(function (ok) { U.toast(ok ? "Đã sao chép mã kết nối" : "Hãy bôi đen mã và sao chép tay"); }); });
    d.el.querySelector("#code").select();
  }
  function openConnectNew(backend) {
    var app = A(), n = app.ctx().doc.transactions.length;
    var d = U.dialog("Tạo không gian " + BNAME[backend],
      '<form id="cn" class="stack" autocomplete="off">' + U.field("Tên không gian", '<input type="text" name="name" maxlength="120" value="Sổ chi tiêu" required>') +
      '<p class="muted small">Dữ liệu hiện có (' + n + " giao dịch) sẽ được đẩy lên " + BNAME[backend] + ". Dữ liệu trên máy vẫn được giữ lại.</p>" +
      '<p class="hint err" id="cn-err" role="alert"></p></form>',
      '<button type="button" class="btn" data-close>Huỷ</button><button type="submit" form="cn" class="btn primary">Tạo và kết nối</button>');
    d.el.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (new FormData(e.target).get("name") || "").trim() || "Sổ chi tiêu", btn = d.el.querySelector("[type=submit]");
      btn.disabled = true; btn.textContent = "Đang tạo…";
      app.engine.connectNew(backend, name).then(function (r) {
        if (!r.ok) { btn.disabled = false; btn.textContent = "Tạo và kết nối"; d.el.querySelector("#cn-err").textContent = r.message; return; }
        d.close(true); app.refresh(); showCode(r.code, backend);
      });
    });
  }
  function openConnectCode(backend, prefill) {
    var app = A(), has = app.ctx().doc.transactions.length;
    var d = U.dialog("Nối vào " + BNAME[backend],
      '<form id="cc" class="stack" autocomplete="off">' + U.field("Mã kết nối", '<input type="text" name="code" id="cc-code" value="' + esc(prefill || "") + '" placeholder="sp_xxxx.khoá" style="font-family:ui-monospace,monospace" required>', "Dán mã đã được tạo ở thiết bị khác.") +
      (has ? '<label class="chk"><input type="radio" name="how" value="merge" checked> <span><b>Gộp</b> dữ liệu trên máy này (' + has + ' giao dịch) với dữ liệu máy chủ</span></label><label class="chk"><input type="radio" name="how" value="replace"> <span><b>Thay</b> bằng dữ liệu máy chủ (bản cũ giữ lại để hoàn tác)</span></label>' : '<input type="hidden" name="how" value="replace">') +
      '<p class="hint err" id="cc-err" role="alert"></p></form>',
      '<button type="button" class="btn" data-close>Huỷ</button><button type="submit" form="cc" class="btn primary">Kết nối</button>');
    d.el.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target), btn = d.el.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Đang kết nối…";
      app.engine.connectExisting(backend, fd.get("code"), fd.get("how") || "replace").then(function (r) {
        if (!r.ok) { btn.disabled = false; btn.textContent = "Kết nối"; d.el.querySelector("#cc-err").textContent = r.message; return; }
        d.close(true); app.refresh(); U.toast("Đã kết nối " + BNAME[backend]);
      });
    });
  }

  function openSyncDialog() {
    var app = A(), st = app.engine.getStatus(), conn = app.engine.getConn();
    var d = U.dialog("Đồng bộ",
      "<p>Chế độ: <strong>" + (st.mode === "local" ? "Máy này (chỉ trong trình duyệt)" : "Máy chủ · " + BNAME[st.mode]) + "</strong></p><p class=\"muted\">" + esc(st.message || ({ local: "Dữ liệu chỉ nằm trên thiết bị này. Hãy sao lưu thường xuyên hoặc kết nối máy chủ.", saved: "Mọi thay đổi đã được lưu lên máy chủ.", pending: "Có thay đổi chưa đồng bộ.", saving: "Đang lưu…" }[st.state] || "")) + "</p>" +
      (conn ? "<p class=\"small muted\">Không gian " + esc(conn.id) + " · phiên bản " + conn.revision + "</p>" : ""),
      (conn ? '<button type="button" class="btn primary" data-now>Đồng bộ ngay</button>' : "") + '<a class="btn" href="#/cai-dat" data-close>Mở cài đặt lưu trữ</a>', { center: true });
    var b = d.el.querySelector("[data-now]");
    if (b) b.addEventListener("click", function () { d.close(); app.syncNow(); });
  }

  function openHelpDialog() {
    U.dialog("Trợ giúp nhanh",
      "<h3>Nhập nhanh</h3><ul><li><code>cơm trưa 57k</code> — chi 57.000</li><li><code>57/2 bún đậu hôm qua</code> — chia đôi, hôm qua</li><li><code>57/2P</code> / <code>phúc trả cơm 57k</code> — người khác trả</li><li><code>lương 14.916.956 10/6</code> — thu</li><li><code>87k - 50k</code> — trừ voucher = 37.000</li><li>Số nhỏ hơn 1.000 hiểu là nghìn: <code>57</code> = 57.000</li></ul>" +
      "<h3>Phím tắt</h3><p><kbd>N</kbd> thêm · <kbd>/</kbd> nhập nhanh · <kbd>?</kbd> trợ giúp · <kbd>G</kbd> rồi <kbd>T</kbd>/<kbd>D</kbd>/<kbd>B</kbd> chuyển màn hình</p>",
      '<button type="button" class="btn primary" data-close>Đã hiểu</button>');
  }

  function openMoreMenu() {
    var items = V.NAV.filter(function (n) { return ["chia-tien", "tai-khoan", "ke-hoach", "cai-dat"].indexOf(n.id) !== -1; });
    U.dialog("Thêm", '<div class="list">' + items.map(function (n) { return '<a class="item" href="#/' + n.id + '" data-close style="text-decoration:none;color:inherit"><span class="ico" aria-hidden="true">' + n.ic + '</span><span class="mid"><span class="ttl">' + esc(n.label) + "</span></span></a>"; }).join("") + "</div>", "", { autofocus: false });
  }

  QL.dialogs = {
    tx: openTxDialog, person: openPersonDialog, account: openAccountDialog, category: openCategoryDialog,
    deposit: openDepositDialog, closeDeposit: openCloseDepositDialog, settle: openSettleDialog, personDetail: openPersonDetail, bill: openBillDialog,
    budget: openBudgetDialog, recurring: openRecurringDialog, importText: openImportTextDialog, importCsv: openCsvImportDialog, restore: openRestoreDialog,
    connectNew: openConnectNew, connectCode: openConnectCode, showCode: showCode, sync: openSyncDialog, help: openHelpDialog, more: openMoreMenu, amtText: amtText
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
