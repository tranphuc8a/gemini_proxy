/* chung.js — khoản chung nhiều người: nhóm, sổ "Các khoản chung" (lọc + phân trang), quyết toán nhóm.
   Chỉ chạy trong trình duyệt. Mọi con số tính ở ledger.js (thuần, kiểm bằng kiem.js); file này chỉ vẽ và nhận thao tác.
   Gắn thêm vào QL.dialogs (dialogs.js nạp trước) nên app.js gọi như mọi hộp thoại khác. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});
  var U = QL.ui, esc = QL.text.esc, M = QL.money, D = QL.dates, L = QL.ledger, Mo = QL.model, V = QL.views, DL = QL.dialogs;
  var fmt = function (n) { return M.format(n); };
  var PAGE = 50;

  function A() { return QL.app; }
  function nameIn(c) { return function (id) { return id === c.me ? "Bạn" : V.personName(c, id); }; }
  function monthLabel(key) { return "Tháng " + (+key.slice(5)) + "/" + key.slice(0, 4); }
  function select(id, label, list, cur) {
    return '<label class="sr" for="' + id + '">' + esc(label) + '</label><select id="' + id + '">' + U.options(list, cur) + "</select>";
  }

  /* ===================================================================
     Các khoản chung — với một người, hoặc của một nhóm
     =================================================================== */
  /** scope: {personId} | {groupId}; init: {month: "YYYY-MM", memberId}. */
  function openSharedLedger(scope, init) {
    init = init || {};
    var app = A(), c = app.ctx(), doc = c.doc, nm = nameIn(c);
    var person = scope.personId ? Mo.find(doc.people, scope.personId) : null;
    var group = scope.groupId ? Mo.find(doc.groups || [], scope.groupId) : null;
    if (!person && !group) return;

    var all = L.sharedLedger(doc, scope), months = {};
    all.items.forEach(function (it) { var k = D.monthKey(it.tx.date); months[k] = (months[k] || 0) + 1; });
    var monthKeys = Object.keys(months).sort().reverse();                       // mới → cũ
    var F = { month: init.month && months[init.month] ? init.month : "", kind: "", payer: "", memberId: init.memberId || "", groupId: "", q: "" };
    var limit = PAGE;
    var groupsOfP = person ? L.groupsOfPerson(doc, person.id, true) : [];
    var gname = {}; (doc.groups || []).forEach(function (g) { gname[g.id] = g.name; });

    var head;
    if (person) {
      var s = L.settlementOf(L.personBalances(doc)[person.id] || 0);
      head = s.direction === "even" ? "Hai bên đang hoà." : (s.direction === "receive" ? esc(person.name) + " nợ bạn " : "Bạn nợ " + esc(person.name) + " ") + '<strong class="num">' + fmt(s.amount) + "</strong>";
      head += ' <span class="muted small">(tính mọi khoản)</span>';
    } else {
      var gb = L.personBalances(doc, group.id), tot = 0;
      Object.keys(gb).forEach(function (id) { tot += gb[id]; });
      var t = L.settlementOf(tot);
      head = (t.direction === "even" ? "Bạn đã hoà với nhóm." : (t.direction === "receive" ? "Cả nhóm nợ bạn " : "Bạn nợ nhóm ") + '<strong class="num">' + fmt(t.amount) + "</strong>") +
        '<br><span class="muted small">' + esc(L.groupMembers(doc, group).map(nm).join(", ")) + "</span>";
    }

    var memberOpts = group ? [{ id: "", label: "Mọi thành viên" }].concat(L.groupMembers(doc, group).map(function (id) { return { id: id, label: nm(id) }; })) : null;
    var body = '<p>' + head + "</p>" +
      '<div class="sl-bar stack gap-s">' +
      '<div class="row gap-s"><button type="button" class="icon-btn" data-step="1" aria-label="Tháng cũ hơn">‹</button>' +
      select("sl-month", "Tháng", [{ id: "", label: "Tất cả các tháng · " + all.count + " khoản" }].concat(monthKeys.map(function (k) { return { id: k, label: monthLabel(k) + " · " + months[k] + " khoản" }; })), F.month) +
      '<button type="button" class="icon-btn" data-step="-1" aria-label="Tháng mới hơn">›</button></div>' +
      '<div class="grid sl-f">' +
      select("sl-kind", "Loại", [{ id: "", label: "Mọi loại" }, { id: "expense", label: "Khoản chi chung" }, { id: "settle", label: "Thanh toán" }], "") +
      select("sl-payer", "Ai trả", [{ id: "", label: "Ai trả: tất cả" }, { id: "me", label: "Bạn trả" }, { id: "other", label: "Người khác trả" }], "") +
      (group ? select("sl-member", "Thành viên", memberOpts, F.memberId) : "") +
      (groupsOfP.length ? select("sl-group", "Nhóm", [{ id: "", label: "Mọi nhóm" }, { id: "none", label: "Không thuộc nhóm" }].concat(groupsOfP.map(function (g) { return { id: g.id, label: "Nhóm " + g.name }; })), "") : "") +
      '<label class="sr" for="sl-q">Tìm</label><input type="search" id="sl-q" placeholder="Tìm ghi chú, danh mục…" autocomplete="off">' +
      "</div>" +
      '<p class="sl-sum" id="sl-sum" role="status" aria-live="polite"></p></div>' +
      '<div id="sl-out" class="stack"></div>';

    var d = U.dialog(person ? "Các khoản chung với " + person.name : "Khoản chung · nhóm " + group.name, body,
      '<button type="button" class="btn" data-close>Đóng</button><button type="button" class="btn primary" data-settle>Quyết toán</button>', { wide: true, autofocus: false });
    var el = d.el, out = el.querySelector("#sl-out"), sum = el.querySelector("#sl-sum");

    function filters() {
      var f = { kind: F.kind || undefined, payer: F.payer || undefined, memberId: F.memberId || undefined, groupId: F.groupId || undefined, q: F.q || undefined };
      if (F.month) { var per = D.period("month", F.month + "-01"); f.from = per.from; f.to = per.to; }
      return f;
    }
    function row(it) {
      var tx = it.tx, settle = tx.type === "settle", cat = V.catOf(c, tx.categoryId), meta = [D.dayLabel(tx.date)];
      if (settle) meta.push(nm(it.payer) + " chuyển cho " + nm(tx.direction === "in" ? c.me : tx.personId));
      else meta.push(nm(it.payer) + " trả " + fmt(tx.amount), "chia " + Object.keys(tx.split.shares).length);
      if (person && tx.groupId) meta.push("nhóm " + (gname[tx.groupId] || "(đã xoá)"));
      var amt = it.delta ? (it.delta > 0 ? "+" : "−") + fmt(Math.abs(it.delta)) : "—";
      return '<button type="button" class="item" data-open="' + esc(tx.id) + '"><span class="ico" aria-hidden="true">' + esc(settle ? "🤝" : cat.icon) + "</span>" +
        '<span class="mid"><span class="ttl">' + esc(V.txTitle(tx, c)) + '</span><span class="meta">' + esc(meta.join(" · ")) + "</span></span>" +
        '<span class="amt num ' + (it.delta > 0 ? "thu" : it.delta < 0 ? "chi" : "") + '">' + amt + "</span></button>";
    }
    function draw(focusFrom) {
      var r = L.sharedLedger(app.ctx().doc, scope, filters());
      var st = L.settlementOf(r.net), parts = [r.count + " khoản"];
      if (r.spend) parts.push("chi chung " + fmt(r.spend), "phần của bạn " + fmt(r.mine), "bạn đã trả " + fmt(r.paidByMe));
      parts.push(st.direction === "even" ? "chênh lệch 0" : (person ? (st.direction === "receive" ? person.name + " nợ bạn " : "bạn nợ " + person.name + " ")
        : (st.direction === "receive" ? "nhóm nợ bạn " : "bạn nợ nhóm ")) + fmt(st.amount));
      sum.textContent = "Trong bộ lọc: " + parts.join(" · ");
      var filtered = F.month || F.kind || F.payer || F.memberId || F.groupId || F.q;
      out.innerHTML = r.count ? '<div class="list">' + r.items.slice(0, limit).map(row).join("") + "</div>" +
        '<p class="small muted">Số bên phải: <span class="thu">+</span> ' + (person ? esc(person.name) + " nợ bạn thêm" : "nhóm nợ bạn thêm") + ", <span class=\"chi\">−</span> bạn nợ thêm (hoặc đã được trả).</p>" +
        (r.count > limit ? '<button type="button" class="btn" data-more style="align-self:center">Hiện thêm ' + Math.min(PAGE, r.count - limit) + " (còn " + (r.count - limit) + ")</button>" : "")
        : '<p class="muted">' + (filtered ? "Không có khoản nào khớp bộ lọc." : "Chưa có khoản chung nào.") + "</p>";
      var idx = monthKeys.indexOf(F.month);
      el.querySelector('[data-step="1"]').disabled = !monthKeys.length || idx === monthKeys.length - 1;
      el.querySelector('[data-step="-1"]').disabled = idx <= 0;
      if (focusFrom !== undefined) { var nx = out.querySelectorAll(".item")[focusFrom]; if (nx) nx.focus(); }
    }

    var search = U.debounce(function (v) { F.q = v.trim(); limit = PAGE; draw(); }, 150);
    el.addEventListener("input", function (e) { if (e.target.id === "sl-q") search(e.target.value); });
    el.addEventListener("change", function (e) {
      var key = { "sl-month": "month", "sl-kind": "kind", "sl-payer": "payer", "sl-member": "memberId", "sl-group": "groupId" }[e.target.id];
      if (!key) return;
      F[key] = e.target.value; limit = PAGE; draw();
    });
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.step) {
        var i = monthKeys.indexOf(F.month) + (+b.dataset.step);
        if (i < 0 || i >= monthKeys.length) return;
        F.month = monthKeys[i]; el.querySelector("#sl-month").value = F.month; limit = PAGE; draw();
      } else if (b.hasAttribute("data-more")) { var from = limit; limit += PAGE; draw(from); }
      else if (b.dataset.open) {
        var tx = Mo.find(app.ctx().doc.transactions, b.dataset.open);
        if (tx) { d.close(); app.editTx(tx); }
      } else if (b.hasAttribute("data-settle")) {
        d.close();
        if (person) DL.settle(person.id, F.month ? F.month + "-01" : undefined); else openGroupSettle(group.id, F.month ? F.month + "-01" : undefined);
      }
    });
    draw();
    return d;
  }

  /* ===================================================================
     Nhóm: tạo / sửa
     =================================================================== */
  function openGroupDialog(id, onDone) {
    var app = A(), c = app.ctx(), doc = c.doc, me = c.me, g = id ? Mo.find(doc.groups || [], id) : null;
    var used = g && doc.transactions.some(function (t) { return t.groupId === g.id; });
    var fresh = [], chosen = g ? g.memberIds.slice() : [];
    var wasDef = !!g && doc.settings.defaultGroupId === g.id, prevDef = doc.settings.defaultGroupId || null;
    var d = DL.formDialog(g ? "Sửa nhóm" : "Tạo nhóm",
      U.field("Tên nhóm", '<input type="text" name="name" maxlength="60" value="' + esc(g ? g.name : "") + '" placeholder="vd Phòng trọ 302, Đà Lạt tháng 9" required>') +
      '<div><div class="fld" id="gm-lbl">Thành viên (ngoài bạn)</div><div class="chips mt-s" id="gm" role="group" aria-labelledby="gm-lbl"></div></div>' +
      '<div class="row gap-s"><label class="sr" for="gm-new">Tên người mới</label><input type="text" id="gm-new" maxlength="60" placeholder="Thêm người mới, vd Lan" autocomplete="off"><button type="button" class="btn" data-addm>Thêm</button></div>' +
      '<label class="chk"><input type="checkbox" name="def"' + (wasDef || (!g && !QL.parser.defaultGroup(doc)) ? " checked" : "") + "> Nhóm mặc định khi chia (gõ “57/3”, bấm “Chi chung”, hoá đơn trọ)</label>" +
      (g ? '<label class="chk"><input type="checkbox" name="arch"' + (g.archived ? " checked" : "") + "> Lưu trữ (ẩn khỏi danh sách chọn)</label>" +
        (used ? '<p class="hint">Nhóm đã có khoản chung nên không xoá được — chỉ lưu trữ.</p>' : '<button type="button" class="btn danger" data-del>Xoá nhóm</button>') : ""),
      "Lưu", function (fd) {
        var name = (fd.get("name") || "").trim();
        if (!name) return "Hãy nhập tên nhóm";
        if ((doc.groups || []).some(function (x) { return x.id !== (g && g.id) && QL.text.fold(x.name) === QL.text.fold(name); })) return "Đã có nhóm tên này";
        var members = chosen.filter(function (x) { return x !== me; });
        if (!members.length) return "Chọn ít nhất một người cùng nhóm với bạn";
        if (members.length > Mo.MAX_GROUP_MEMBERS) return "Một nhóm tối đa " + Mo.MAX_GROUP_MEMBERS + " người";
        var rec = g ? Object.assign({}, g, { name: name, memberIds: members, archived: !!fd.get("arch") })
          : { id: Mo.uid("g"), name: name, memberIds: members, archived: false, order: (doc.groups || []).length };
        var newPeople = fresh.filter(function (p) { return members.indexOf(p.id) !== -1; });
        var wantDef = !!fd.get("def") && !rec.archived;
        app.apply(function (dd) {
          var x = dd;
          newPeople.forEach(function (p) { x = Mo.upsert(x, "people", { id: p.id, name: p.name, archived: false }); });
          x = Mo.upsert(x, "groups", rec);
          if (wantDef !== wasDef) x = Mo.setSettings(x, { defaultGroupId: wantDef ? rec.id : (prevDef === rec.id ? null : prevDef) });
          return x;
        }, g ? "Đã cập nhật nhóm" : "Đã tạo nhóm " + name, function (dd) {
          var x = g ? Mo.upsert(dd, "groups", g) : Mo.remove(dd, "groups", rec.id);
          newPeople.forEach(function (p) { x = Mo.remove(x, "people", p.id); });
          if (wantDef !== wasDef) x = Mo.setSettings(x, { defaultGroupId: prevDef });
          return x;
        });
        if (onDone) onDone(rec.id);
      });
    var el = d.el, box = el.querySelector("#gm");
    function drawMembers() {
      var list = doc.people.filter(function (p) { return p.id !== me && (!p.archived || chosen.indexOf(p.id) !== -1); }).concat(fresh);
      box.innerHTML = list.length ? list.map(function (p) {
        var on = chosen.indexOf(p.id) !== -1;
        return '<label class="chip' + (on ? " on" : "") + '"><input type="checkbox" data-mid="' + esc(p.id) + '"' + (on ? " checked" : "") + ' style="width:18px;height:18px"> ' + esc(p.name) + "</label>";
      }).join("") : '<p class="hint">Chưa có ai trong sổ — thêm người mới ở ô dưới.</p>';
    }
    function addMember() {
      var inp = el.querySelector("#gm-new"), name = inp.value.trim();
      if (!name) { inp.focus(); return; }
      var f = QL.text.fold(name), hit = doc.people.filter(function (p) { return p.id !== me && QL.text.fold(p.name) === f; })[0] || fresh.filter(function (p) { return QL.text.fold(p.name) === f; })[0];
      if (!hit) { hit = { id: Mo.uid("p"), name: name.slice(0, 60) }; fresh.push(hit); }
      if (chosen.indexOf(hit.id) === -1) chosen.push(hit.id);
      inp.value = ""; drawMembers(); inp.focus();
    }
    el.addEventListener("change", function (e) {
      var mid = e.target.dataset && e.target.dataset.mid; if (!mid) return;
      chosen = e.target.checked ? chosen.concat(mid) : chosen.filter(function (x) { return x !== mid; });
      e.target.closest(".chip").classList.toggle("on", e.target.checked);
    });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "gm-new") { e.preventDefault(); addMember(); } });
    el.querySelector("[data-addm]").addEventListener("click", addMember);
    var del = el.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () {
      d.close();
      app.apply(function (dd) { var x = Mo.remove(dd, "groups", g.id); return wasDef ? Mo.setSettings(x, { defaultGroupId: null }) : x; }, "Đã xoá nhóm " + g.name,
        function (dd) { var x = Mo.upsert(dd, "groups", g); return wasDef ? Mo.setSettings(x, { defaultGroupId: g.id }) : x; });
    });
    drawMembers();
    return d;
  }

  /* ===================================================================
     Quyết toán nhóm
     =================================================================== */
  function openGroupSettle(groupId, monthIso) {
    var app = A(), c = app.ctx(), doc = c.doc, nm = nameIn(c), g = Mo.find(doc.groups || [], groupId);
    if (!g) return;
    var pc = DL.periodChoices(c.today, monthIso);
    var pair = L.personBalances(doc, groupId), owed = Object.keys(pair).filter(function (id) { return pair[id]; });
    var rows = owed.map(function (id) {
      var s = L.settlementOf(pair[id]);
      return '<div class="row wrap gap-s"><label class="chk" style="flex:1 1 220px"><input type="checkbox" name="rec-' + esc(id) + '"> ' +
        (s.direction === "receive" ? esc(nm(id)) + " chuyển cho bạn" : "Bạn chuyển cho " + esc(nm(id))) + "</label>" +
        '<input type="text" inputmode="decimal" name="amt-' + esc(id) + '" value="' + esc(DL.amtText(s.amount)) + '" style="width:9em" aria-label="Số tiền với ' + esc(nm(id)) + '"></div>';
    }).join("");
    var d = DL.formDialog("Quyết toán nhóm " + g.name,
      U.field("Kỳ", '<select name="per">' + U.options(pc.list, pc.initial || "mo") + "</select>") +
      '<div id="gs-out" class="stack gap-s"></div>' +
      U.field("Tin nhắn quyết toán (gửi vào nhóm chat)", '<textarea id="gs-msg" readonly rows="10"></textarea>') + '<button type="button" class="btn" data-copy>Sao chép tin nhắn</button>' +
      '<div class="card"><h3>Ghi nhận phần của bạn</h3><p class="muted small">Tính mọi kỳ của nhóm. Sổ của bạn chỉ ghi tiền giữa bạn và từng người — tiền hai người khác chuyển cho nhau không vào sổ.</p>' +
      (owed.length ? '<div class="stack gap-s mt-s">' + rows + "</div>" + U.field("Tài khoản", '<select name="acc">' + DL.accountOptions(doc, doc.settings.defaultAccountId) + "</select>")
        : '<p class="hint ok">Bạn đã hoà với mọi người trong nhóm.</p>') + "</div>",
      "Xong", function (fd) {
        var txs = [];
        for (var i = 0; i < owed.length; i++) {
          var id = owed[i];
          if (!fd.get("rec-" + id)) continue;
          var amount = DL.moneyOf(fd, "amt-" + id, doc);
          if (amount === null) return "Số tiền với " + nm(id) + " không đọc được";
          var tx = { id: Mo.uid("t"), type: "settle", date: c.today, amount: amount, personId: id, direction: pair[id] > 0 ? "in" : "out", accountId: fd.get("acc"),
            categoryId: null, toAccountId: null, note: "Quyết toán nhóm " + g.name, tags: [], groupId: g.id };
          var errs = Mo.validateTx(tx, doc);
          if (errs.length) return errs[0];
          txs.push(tx);
        }
        if (txs.length) app.apply(function (dd) { return txs.reduce(function (x, t) { return Mo.upsert(x, "transactions", t); }, dd); }, "Đã ghi " + txs.length + " khoản thanh toán",
          function (dd) { return txs.reduce(function (x, t) { return Mo.remove(x, "transactions", t.id); }, dd); });
      }, { wide: true });
    var form = d.el.querySelector("form"), out = d.el.querySelector("#gs-out"), msg = d.el.querySelector("#gs-msg");
    function upd() {
      var per = pc.of(form.elements.per.value), cur = app.ctx().doc, st = L.groupStatement(cur, groupId, per);
      var signed = function (v) { return v ? (v > 0 ? "+" : "−") + fmt(Math.abs(v)) : "0"; };
      out.innerHTML = '<div class="scroll-x"><table class="tbl"><thead><tr><th>Người</th><th class="r">Đã trả</th><th class="r">Phần</th><th class="r">Thanh toán</th><th class="r">Còn lại</th></tr></thead><tbody>' +
        st.members.map(function (r) {
          return "<tr><td>" + esc(nm(r.id)) + '</td><td class="r num">' + fmt(r.paid) + '</td><td class="r num">' + fmt(r.share) + '</td><td class="r num">' + signed(r.sent - r.received) +
            '</td><td class="r num ' + (r.net > 0 ? "thu" : r.net < 0 ? "chi" : "") + '">' + signed(r.net) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="small muted">Tổng chi chung ' + fmt(st.spend) + " · " + st.count + " khoản. Còn lại dương = được nhận lại, âm = cần trả thêm.</p>" +
        (st.transfers.length ? transfersHtml(st.transfers) : '<p class="hint ok">Cả nhóm đã hoà trong kỳ.</p>');
      msg.value = L.groupSettlementMessage(cur, groupId, per);
    }
    function transfersHtml(list) {
      var li = function (t) { return "<li>" + esc(nm(t.from)) + " chuyển cho " + esc(nm(t.to)) + ' <strong class="num">' + fmt(t.amount) + "</strong></li>"; };
      var mine = list.filter(function (t) { return t.from === c.me || t.to === c.me; }), rest = list.filter(function (t) { return t.from !== c.me && t.to !== c.me; });
      return '<div><div class="fld">Cách chuyển tiền</div>' +
        (mine.length ? '<p class="small muted mt-s">Với bạn — đúng số nợ từng người trong sổ của bạn:</p><ul class="small">' + mine.map(li).join("") + "</ul>" : "") +
        (rest.length ? '<p class="small muted mt-s">Giữa những người còn lại — gộp cho ít lần chuyển nhất:</p><ul class="small">' + rest.map(li).join("") + "</ul>" : "") + "</div>";
    }
    form.elements.per.addEventListener("change", upd);
    d.el.querySelector("[data-copy]").addEventListener("click", function () {
      U.copyText(msg.value).then(function (ok) { U.toast(ok ? "Đã sao chép tin nhắn" : "Không sao chép được — hãy bôi đen và sao chép tay"); });
    });
    upd();
    return d;
  }

  Object.assign(QL.dialogs, {
    sharedLedger: openSharedLedger,
    personDetail: function (personId, init) { return openSharedLedger({ personId: personId }, init); },
    groupDetail: function (groupId, init) { return openSharedLedger({ groupId: groupId }, init); },
    group: openGroupDialog, groupSettle: openGroupSettle
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
