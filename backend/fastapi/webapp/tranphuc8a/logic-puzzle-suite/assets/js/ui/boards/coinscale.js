/* ui/boards/coinscale.js — bàn CÂN ĐIỆN TỬ: màn hình số gam + (chồng xu: mỗi chồng một bộ chọn "lấy t xu" | hai loại: khay xu bật/tắt "trên cân") + nhật ký + kết luận, và trình soạn đề.
   Hành động gửi cho engine (assets/js/puzzles/coinscale.js): {k:"weigh", take:[t_0…]} (chồng xu) | {k:"weigh", set:[chỉ số xu…]} (hai loại) · {k:"conclude", stack} | {k:"conclude", x:[0|1…]} (1 = xu nặng) · {k:"truncate", n}.
   Engine tự tính số đọc (oracle) và ghi vào state — bàn KHÔNG giữ trạng thái logic: số xu đang chuẩn bị lấy / nhóm xu đang đặt lên cân TRƯỚC khi bấm "Cân" là trạng thái GIAO DIỆN, mất khi bấm Cân / hoàn tác.
   Đầu vào trình soạn (type.fromInput): { form:"stack", n, c, k, mode, secret (chỉ số 0…)|null } | { form:"two", n, k, mode, secret ("0101", 1 = xu nặng)|null }.

   Bàn phím — chồng xu: mỗi chồng là MỘT điểm dừng Tab (role=spinbutton, roving tabindex): ↑/↓ (hoặc +/−) đổi số xu lấy, phím số 0–9 đặt thẳng, ←/→ chuyển chồng, Home/End chồng đầu/cuối, Enter = Cân.
   Hai loại: khay xu roving tabindex — mũi tên di chuyển, Space bật/tắt "trên cân", Enter = Cân. Kết luận: lưới xu (chồng xu: chọn một; hai loại: mỗi chạm xoay ? → nặng → nhẹ → ?). Mọi kết quả có CHỮ (số gam), không chỉ hình/màu.
   Trợ năng: mỗi chồng/xu có aria-label (type.describeCell + trạng thái đang chuẩn bị); thông báo kết quả qua env.announce. highlight(cells, kind) = chỉ số chồng/xu (gợi ý / replay). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var uid = 0;
  var FOCUSABLE = "button, select, input, textarea, a[href], [role=spinbutton][tabindex]";

  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function toInt(x) { if (typeof x === "string" && /^\s*\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function viNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function keepFocus(rootEl, fn) {
    var a = doc.activeElement, idx = a && rootEl.contains(a) ? Array.prototype.indexOf.call(rootEl.querySelectorAll(FOCUSABLE), a) : -1;
    fn();
    if (idx < 0) return;
    var els = rootEl.querySelectorAll(FOCUSABLE), at = Math.min(idx, els.length - 1);
    for (var dist = 0; dist < els.length; dist++) {
      var cand = [els[at + dist], els[at - dist]];
      for (var q = 0; q < 2; q++) if (cand[q] && !cand[q].disabled) { cand[q].focus({ preventScroll: true }); return; }
    }
  }
  function colsOf(list) { var top = list[0].offsetTop, c = 0; while (c < list.length && Math.abs(list[c].offsetTop - top) < 3) c++; return Math.max(1, c); }
  function navKey(k, i, count, cc) {
    return k === "ArrowRight" ? Math.min(count - 1, i + 1) : k === "ArrowLeft" ? Math.max(0, i - 1) : k === "ArrowDown" ? Math.min(count - 1, i + cc) : k === "ArrowUp" ? Math.max(0, i - cc) : k === "Home" ? 0 : k === "End" ? count - 1 : -1;
  }

  // ================================================================================================================ bàn chơi
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, lib = type.lib, plan = P.plan, ro = !!env.readOnly, d = puzzle.data;
    var stack = d.form === "stack", n = d.n, kk = d.k, cmax = stack ? d.c : 1;
    var pending = zeros(n), focusI = 0, marks = {}, conclOpen = false, conclPick = -1, conclVec = zeros(n), offGame = null, cbtns = [], concFocus = 0, rid = "pz-cs-reason-" + (++uid);

    // ---- khung
    var leftB = h("b", { text: "0" });
    var stats = h("div", { class: "pz-cs-stats", role: "group", "aria-label": "Thông tin ván" },
      h("span", { class: "pz-cs-stat pz-cs-budget", "aria-live": "polite", title: "Số lần cân còn lại / tối đa — hết lượt thì chỉ còn kết luận được" }, "Còn ", leftB, " / " + kk + " lần cân"),
      h("span", { class: "pz-cs-stat", title: stack ? n + " chồng, mỗi chồng " + d.c + " xu. Xu thật 10 g, xu giả 11 g." : n + " xu, mỗi xu nhẹ 9 g hoặc nặng 10 g." }, stack ? h("span", {}, h("b", { text: String(n) }), " chồng × " + d.c + " xu") : h("span", {}, h("b", { text: String(n) }), " xu · 9 g / 10 g")),
      h("span", { class: "pz-cs-stat pz-cs-mode", title: d.mode === "adv" ? "Không có bí mật định sẵn: mỗi lần cân đối thủ chọn kết quả khó nhất." : "Bí mật được chọn sẵn theo seed." }, d.mode === "adv" ? "Đối thủ thích nghi" : "Bí mật cố định"));

    var lcdNum = h("span", { class: "pz-cs-lcdnum", text: "0 g" }), caption = h("p", { class: "pz-cs-caption", "aria-live": "polite" });
    var lcd = h("div", { class: "pz-cs-lcd", role: "img", "aria-label": "Màn hình cân" }, h("span", { class: "pz-cs-lcdlab", "aria-hidden": "true", text: "CÂN ĐIỆN TỬ" }), lcdNum);
    var scaleBox = h("div", { class: "pz-cs-scalebox" }, lcd, caption);

    // khay: chồng xu = n bộ chọn số xu; hai loại = n xu bật/tắt
    var tray = h("div", { class: "pz-cs-tray" + (stack ? " pz-cs-stacks" : " pz-cs-coins"), role: "group", "aria-label": stack ? "Các chồng xu — chọn số xu lấy từ mỗi chồng" : "Các xu — chạm để đặt lên cân" }), btns = [], valEls = [], dotEls = [];
    function mkStack(i) {
      var val = h("b", { class: "pz-cs-stkval", text: "0" }), dots = h("span", { class: "pz-cs-dots", "aria-hidden": "true" }), k;
      for (k = 0; k < cmax; k++) dots.append(h("i", { class: "pz-cs-dot" }));
      var minus = h("button", { type: "button", class: "pz-cs-pm", tabindex: "-1", "aria-label": "Bớt một xu từ chồng " + (i + 1), dataset: { act: "-" }, text: "−" });
      var plus = h("button", { type: "button", class: "pz-cs-pm", tabindex: "-1", "aria-label": "Thêm một xu từ chồng " + (i + 1), dataset: { act: "+" }, text: "+" });
      var el = h("div", { class: "pz-cs-stk", role: "spinbutton", tabindex: "-1", "aria-valuemin": "0", "aria-valuemax": String(cmax), "aria-valuenow": "0", dataset: { i: String(i) } },
        h("span", { class: "pz-cs-stkname", text: "Chồng " + (i + 1) }), dots, h("span", { class: "pz-cs-ctl" }, minus, val, plus));
      valEls.push(val); dotEls.push(dots);
      return el;
    }
    function mkCoin(i) {
      return h("button", { type: "button", class: "pz-cs-coin", tabindex: "-1", "aria-pressed": "false", dataset: { i: String(i), on: "0" } },
        h("span", { class: "pz-cs-coinnum", text: String(i + 1) }), h("span", { class: "pz-cs-coinon", "aria-hidden": "true" }));
    }
    for (var ci = 0; ci < n; ci++) { var cb = stack ? mkStack(ci) : mkCoin(ci); btns.push(cb); tray.append(cb); }
    btns[0].setAttribute("tabindex", "0");

    var weighBtn = h("button", { type: "button", class: "btn btn-primary pz-cs-act pz-cs-weigh", html: icon("play") + "<span>Cân</span>" });
    var clearBtn = h("button", { type: "button", class: "btn pz-cs-act pz-cs-clear", html: icon("eraser") + "<span>Xoá lựa chọn</span>" });
    var conclBtn = h("button", { type: "button", class: "btn pz-cs-act pz-cs-open", "aria-expanded": "false", html: icon("check") + "<span>Kết luận…</span>" });
    var reason = h("p", { class: "pz-cs-reason", id: rid, "aria-live": "polite" });
    weighBtn.setAttribute("aria-describedby", rid);
    var actions = ro ? null : h("div", { class: "pz-cs-actions" }, weighBtn, clearBtn, conclBtn);

    var conclGrid = h("div", { class: "pz-cs-cgrid", role: "group", "aria-label": stack ? "Chọn chồng giả" : "Đặt từng xu là nặng hay nhẹ" });
    var conclOk = h("button", { type: "button", class: "btn btn-primary pz-cs-cok", text: "Chốt kết luận" }), conclX = h("button", { type: "button", class: "btn pz-cs-cx", text: "Đóng" });
    var conclBox = ro ? null : h("section", { class: "pz-cs-concl", hidden: true, "aria-label": "Kết luận" }, h("h3", { text: stack ? "Kết luận: chồng nào toàn xu giả?" : "Kết luận: xu nào nặng, xu nào nhẹ?" }), conclGrid, h("div", { class: "btn-row" }, conclOk, conclX),
      h("p", { class: "pz-cs-note faint", text: stack ? "Kết luận chỉ được tính khi các lần cân đã chứng minh nó. Đoán đúng nhờ may mắn không tính — nếu chưa chắc, bạn sẽ được mở lại để cân tiếp hoặc hoàn tác." : "Chạm mỗi xu để xoay ? → nặng → nhẹ → ?. Phải đặt đủ mọi xu. Kết luận chỉ được tính khi các lần cân đã chứng minh đúng từng xu; đoán may không tính." }));
    var reopenBox = ro ? null : h("div", { class: "pz-cs-reopen", hidden: true, role: "status" });
    var logEl = h("ol", { class: "pz-cs-log", "aria-label": "Nhật ký các lần cân" }), logHead = h("h3", { class: "pz-cs-loghead", text: "Nhật ký cân" });
    var logBox = h("section", { class: "pz-cs-logbox" }, logHead, logEl);

    host.replaceChildren(h("div", { class: "pz-cs" }, stats, scaleBox, tray, actions, reason, reopenBox, conclBox, logBox));

    // ---- trạng thái dẫn xuất
    function recs() { return lib.records(puzzle, game.state); }
    function canAct() { return !ro && !game.finished() && game.status !== "paused"; }
    function used() { return plan.count(game.state); }
    function submitted() { return plan.isSubmitted(game.state); }
    function pendSum() { var s = 0; for (var i = 0; i < n; i++) s += pending[i]; return s; }
    function pendSet() { var o = []; for (var i = 0; i < n; i++) if (pending[i]) o.push(i); return o; }
    function weighReason() {
      if (submitted()) return "Đã kết luận — hoàn tác hoặc mở lại để cân tiếp.";
      if (used() >= kk) return "Hết lượt cân — hãy kết luận.";
      if (!pendSum()) return stack ? "Chọn số xu lấy từ ít nhất một chồng rồi bấm Cân." : "Chạm xu để đặt lên cân rồi bấm Cân.";
      return "";
    }
    function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
    function logItemText(r, j) {
      var what = stack ? "lấy " + r.take.map(function (t, i) { return t ? t + " xu từ chồng " + (i + 1) : ""; }).filter(Boolean).join(", ") : "nhóm " + lib.setText(r.set) + " (" + r.set.length + " xu)";
      return "Lần " + (j + 1) + ": " + what;
    }

    // ---- vẽ
    function drawScale() {
      var rs = recs(), last = rs.length ? rs[rs.length - 1] : null, ps = pendSum(), cap;
      if (ps) {
        var base = stack ? pending.reduce(function (a, t) { return a + t; }, 0) * lib.W_REAL : pendSet().length * lib.W_LIGHT;
        setText(lcdNum, "— g");
        cap = "Đang chuẩn bị lần cân " + (used() + 1) + ": " + (stack ? "lấy " + ps + " xu" : pendSet().length + " xu trên cân") + " (nếu " + (stack ? "toàn xu thật" : "toàn xu nhẹ") + " sẽ là " + viNum(base) + " g).";
      } else if (last) { setText(lcdNum, viNum(last.grams) + " g"); cap = "Lần cân " + rs.length + ": " + viNum(last.grams) + " g (nếu " + (stack ? "toàn xu thật" : "toàn xu nhẹ") + " sẽ là " + viNum(last.base) + " g)."; }
      else { setText(lcdNum, "0 g"); cap = "Chưa cân lần nào."; }
      setText(caption, cap);
      lcd.setAttribute("aria-label", "Màn hình cân: " + (ps ? "đang chuẩn bị" : last ? viNum(last.grams) + " gam" : "0 gam"));
    }
    function paintItem(i) {
      var b = btns[i], v = pending[i], lab = type.describeCell(puzzle, game.state, i) + (stack ? (v ? " — đang chuẩn bị lấy " + v + " xu" : "") : (v ? " — đang đặt trên cân" : "")) + (marks[i] === "hint" ? " — đang được gợi ý" : marks[i] === "replay" ? " — thuộc lần cân ở bước này" : "");
      if (stack) {
        valEls[i].textContent = String(v); b.setAttribute("aria-valuenow", String(v)); b.setAttribute("aria-valuetext", v + " xu");
        var ds = dotEls[i].children; for (var k = 0; k < ds.length; k++) ds[k].classList.toggle("on", k < v);
        b.classList.toggle("has", v > 0);
        var mn = b.querySelector("[data-act='-']"), pl = b.querySelector("[data-act='+']"); mn.disabled = !canAct() || v <= 0; pl.disabled = !canAct() || v >= cmax;
      } else {
        if (b.dataset.on !== String(v)) { b.dataset.on = String(v); b.classList.toggle("on", v === 1); b.setAttribute("aria-pressed", String(v === 1)); b.querySelector(".pz-cs-coinon").textContent = v ? "⚖" : ""; }
      }
      b.classList.toggle("hint", marks[i] === "hint"); b.classList.toggle("replay", marks[i] === "replay");
      if (b.getAttribute("aria-label") !== lab) b.setAttribute("aria-label", lab);
    }
    function drawTray() { for (var i = 0; i < n; i++) paintItem(i); tray.classList.toggle("is-locked", !canAct()); }
    function drawLog() {
      var rs = recs(), items = [], cn = lib.concluded(puzzle, game.state), chk = type.check(puzzle, game.state);
      rs.forEach(function (r, j) { items.push(h("li", { class: "pz-cs-logrow" }, h("span", { class: "pz-cs-logset", text: logItemText(r, j) }), h("span", { class: "pz-cs-logres", text: viNum(r.grams) + " g" }), h("span", { class: "pz-cs-logbase faint", text: "(" + (stack ? "toàn xu thật" : "toàn xu nhẹ") + ": " + viNum(r.base) + " g)" }))); });
      if (cn) {
        var ct = stack ? "chồng " + (cn.stack + 1) + " là chồng giả" : (function () { var hv = [], lt = [], i; for (i = 0; i < n; i++) if ((cn.x >> i) & 1) hv.push(i); else lt.push(i); return (hv.length ? "xu " + lib.setText(hv) + " nặng" : "không xu nào nặng") + (lt.length ? ", xu " + lib.setText(lt) + " nhẹ" : ""); })();
        items.push(h("li", { class: "pz-cs-logrow pz-cs-logend " + (chk.solved ? "is-ok" : "is-bad") }, h("span", { class: "pz-cs-logset", text: "Kết luận: " + ct }), h("span", { class: "pz-cs-logres", text: chk.solved ? "✓ đã được chứng minh" : "✗ chưa được chứng minh" })));
      }
      if (!items.length) items.push(h("li", { class: "pz-cs-logempty faint", text: "Chưa có lần cân nào." }));
      logEl.replaceChildren.apply(logEl, items);
      setText(logHead, "Nhật ký cân (" + rs.length + "/" + kk + ")");
    }
    function drawStats() { setText(leftB, String(Math.max(0, kk - used()))); }
    function drawActions() {
      if (ro) return;
      var act = canAct(), why = weighReason(), can = act && !why;
      weighBtn.disabled = !can; clearBtn.disabled = !act || !pendSum(); conclBtn.disabled = !act || submitted();
      setText(reason, game.finished() ? "" : why);
      var sub = submitted() && !type.check(puzzle, game.state).solved && !game.finished();
      reopenBox.hidden = !sub;
      if (sub) reopenBox.replaceChildren(h("p", { text: "Kết luận chưa được chứng minh từ các lần cân (đoán đúng nhờ may mắn cũng không tính)." }), h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary pz-cs-reopenbtn", on: { click: doReopen }, text: "Mở lại để cân tiếp" })));
      else reopenBox.replaceChildren();
      conclBox.hidden = !(conclOpen && act && !submitted()); conclBtn.setAttribute("aria-expanded", String(!conclBox.hidden));
    }
    function setConcFocusable(i) { if (i === concFocus && cbtns[i].getAttribute("tabindex") === "0") return; cbtns[concFocus].setAttribute("tabindex", "-1"); concFocus = i; cbtns[i].setAttribute("tabindex", "0"); }
    var VEC_NAME = ["?", "nặng", "nhẹ"];
    function buildConcludeGrid() {
      for (var i = 0; i < n; i++) (function (i) {
        var b = h("button", { type: "button", class: "pz-cs-cbtn", "aria-pressed": "false", "aria-label": (stack ? "Chồng " : "Xu ") + (i + 1), tabindex: i === 0 ? "0" : "-1", dataset: { i: String(i) } }, h("span", { class: "pz-cs-cnum", text: String(i + 1) }), stack ? null : h("span", { class: "pz-cs-cstate", text: "?" }));
        b.addEventListener("click", function () {
          setConcFocusable(i);
          if (stack) conclPick = i; else conclVec[i] = (conclVec[i] + 1) % 3;
          drawConclude();
        });
        cbtns.push(b); conclGrid.append(b);
      })(i);
    }
    function drawConclude() {
      if (ro) return;
      cbtns.forEach(function (b, i) {
        if (stack) { var on = conclPick === i; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
        else { var v = conclVec[i]; b.classList.toggle("on", v === 1); b.classList.toggle("on2", v === 2); b.setAttribute("aria-pressed", String(v !== 0)); b.querySelector(".pz-cs-cstate").textContent = v === 1 ? "nặng" : v === 2 ? "nhẹ" : "?"; b.setAttribute("aria-label", "Xu " + (i + 1) + ": " + (v === 1 ? "nặng" : v === 2 ? "nhẹ" : "chưa chọn")); }
      });
      conclOk.disabled = stack ? conclPick < 0 : conclVec.some(function (v) { return v === 0; });
    }
    function drawAll() { drawScale(); drawTray(); drawLog(); drawStats(); drawActions(); }

    // ---- thao tác
    function setVal(i, v) {
      if (!canAct() || submitted()) return;
      v = Math.max(0, Math.min(cmax, v)); if (pending[i] === v) return;
      pending[i] = v; paintItem(i); drawScale(); drawActions();
    }
    function bump(i, delta) { var before = pending[i]; setVal(i, pending[i] + delta); if (pending[i] !== before) env.announce("Chồng " + (i + 1) + ": lấy " + pending[i] + " xu."); }
    function toggleCoin(i) { if (!canAct()) return; setVal(i, pending[i] ? 0 : 1); env.announce("Xu " + (i + 1) + (pending[i] ? " đặt lên cân" : " bỏ ra ngoài") + "."); }
    function keepFocusAfter(fn, to) {
      var a0 = doc.activeElement, had = !!a0 && host.contains(a0);
      fn();
      if (!had) return;
      var b = doc.activeElement;
      if (b && b !== doc.body && !host.contains(b)) return;
      if (b && b !== doc.body && !b.disabled && !(b.closest && b.closest("[hidden]"))) return;
      var t = to();
      if (t && !t.disabled) t.focus({ preventScroll: true });
    }
    function trayItem() { return btns[focusI]; }
    function reopenButton() { return reopenBox ? reopenBox.querySelector(".pz-cs-reopenbtn") : null; }
    function doWeigh() {
      if (!canAct() || weighReason()) return;
      keepFocusAfter(function () {
        var a = stack ? { k: "weigh", take: pending.slice() } : { k: "weigh", set: pendSet() }, res = game.act(a);
        if (!res.ok) return;
        pending = zeros(n);
        var rs = recs(), last = rs[rs.length - 1];
        env.announce("Lần cân " + rs.length + ": " + viNum(last.grams) + " gam (nếu " + (stack ? "toàn xu thật" : "toàn xu nhẹ") + " sẽ là " + viNum(last.base) + " gam). " + (kk - used() > 0 ? "Còn " + (kk - used()) + " lần cân." : "Hết lượt cân, hãy kết luận."));
      }, trayItem);
    }
    function doClear() { if (!canAct()) return; keepFocusAfter(function () { pending = zeros(n); drawTray(); drawScale(); drawActions(); env.announce("Đã xoá lựa chọn."); }, trayItem); }
    function doConclude() {
      if (!canAct() || conclOk.disabled) return;
      var a = stack ? { k: "conclude", stack: conclPick } : { k: "conclude", x: conclVec.map(function (v) { return v === 1 ? 1 : 0; }) };
      conclOpen = false;
      keepFocusAfter(function () {
        var res = game.act(a);
        if (res.ok) env.announce(res.check && res.check.solved ? "Đã giải! Kết luận được chứng minh." : "Kết luận chưa được chứng minh.");
      }, function () { return reopenButton() || trayItem(); });
    }
    function doReopen() { if (canAct()) keepFocusAfter(function () { game.act({ k: "truncate", n: used() }); }, trayItem); }
    function setFocusable(i) { if (i === focusI && btns[i].getAttribute("tabindex") === "0") return; btns[focusI].setAttribute("tabindex", "-1"); focusI = i; btns[i].setAttribute("tabindex", "0"); }
    function focusItem(i) { setFocusable(i); btns[i].focus({ preventScroll: true }); }
    function itemOf(el) { return el && el.closest ? el.closest(stack ? ".pz-cs-stk" : ".pz-cs-coin") : null; }

    // ---- sự kiện
    tray.addEventListener("click", function (e) {
      var c = itemOf(e.target); if (!c) return;
      var i = +c.dataset.i; setFocusable(i);
      if (stack) { var b = e.target.closest ? e.target.closest("[data-act]") : null; if (b) bump(i, b.dataset.act === "+" ? 1 : -1); else if (doc.activeElement !== c) c.focus({ preventScroll: true }); }
      else toggleCoin(i);
    });
    tray.addEventListener("focusin", function (e) { var c = itemOf(e.target); if (c) setFocusable(+c.dataset.i); });
    tray.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = itemOf(e.target); if (!c || e.target !== c) return;
      var i = +c.dataset.i, k = e.key, nx;
      if (stack) {
        if (k === "ArrowUp" || k === "+" || k === "=") { e.preventDefault(); bump(i, 1); return; }
        if (k === "ArrowDown" || k === "-") { e.preventDefault(); bump(i, -1); return; }
        if (/^[0-9]$/.test(k)) { e.preventDefault(); setVal(i, +k); env.announce("Chồng " + (i + 1) + ": lấy " + pending[i] + " xu."); return; }
        nx = k === "ArrowRight" ? Math.min(n - 1, i + 1) : k === "ArrowLeft" ? Math.max(0, i - 1) : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
        if (nx >= 0) { e.preventDefault(); if (nx !== i) focusItem(nx); return; }
      } else {
        nx = navKey(k, i, n, colsOf(btns));
        if (nx >= 0) { e.preventDefault(); if (nx !== i) focusItem(nx); return; }
        if (k === " " || k === "Spacebar") { e.preventDefault(); if (!e.repeat) toggleCoin(i); return; }
      }
      if (k === "Enter") { e.preventDefault(); doWeigh(); }
    });
    if (!ro) {
      weighBtn.addEventListener("click", doWeigh); clearBtn.addEventListener("click", doClear);
      conclBtn.addEventListener("click", function () { if (!canAct()) return; conclOpen = !conclOpen; if (conclOpen) { conclPick = -1; conclVec = zeros(n); setConcFocusable(0); drawConclude(); } drawActions(); if (conclOpen) cbtns[concFocus].focus({ preventScroll: true }); });
      conclOk.addEventListener("click", doConclude);
      conclGrid.addEventListener("focusin", function (e) { var b = e.target && e.target.closest ? e.target.closest(".pz-cs-cbtn") : null; if (b) setConcFocusable(+b.dataset.i); });
      conclGrid.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var b = e.target && e.target.closest ? e.target.closest(".pz-cs-cbtn") : null; if (!b) return;
        var i = +b.dataset.i, nx = navKey(e.key, i, n, colsOf(cbtns));
        if (nx >= 0) { e.preventDefault(); if (nx !== i) { setConcFocusable(nx); cbtns[nx].focus({ preventScroll: true }); } }
      });
      conclX.addEventListener("click", function () { conclOpen = false; drawActions(); conclBtn.focus({ preventScroll: true }); });
      conclBox.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); conclOpen = false; drawActions(); conclBtn.focus({ preventScroll: true }); } });
      buildConcludeGrid(); drawConclude();
    }
    offGame = game.on(function (ev) {
      if (ev.type === "change") { pending = zeros(n); if (submitted() || game.finished()) conclOpen = false; drawAll(); }
      else if (ev.type === "status") { drawTray(); drawActions(); }
    });
    drawAll();

    return {
      destroy: function () { if (offGame) offGame(); offGame = null; host.replaceChildren(); },
      refresh: function () { pending = zeros(n); drawAll(); },
      highlight: function (list, kind) {
        var old = marks, i;
        marks = {};
        if (list && list.length && kind) list.forEach(function (j) { if (j >= 0 && j < n) marks[j] = kind; });
        for (i in old) if (Object.prototype.hasOwnProperty.call(old, i)) paintItem(+i);
        for (i in marks) if (Object.prototype.hasOwnProperty.call(marks, i)) paintItem(+i);
      },
      focus: function () { btns[focusI].focus({ preventScroll: true }); }
    };
  }

  // ================================================================================================================ trình soạn
  /** Trình soạn (màn Tạo puzzle): dạng (chồng xu | hai loại), số chồng/xu, xu mỗi chồng, số lần cân, chế độ, bí mật (chế độ cố định); mỗi thay đổi gọi env.onChange(input).
      Vỏ kiểm bằng type.fromInput (trong worker) và hiện "✓ Có chiến lược chắc chắn trong k lần" hoặc "✗ …". Dòng "tối đa/ít nhất" tính tại chỗ bằng type.lib. */
  function editor(host, env) {
    var lib = env.type.lib, st = { form: "stack", n: 10, c: 9, k: 1, mode: "fixed", secS: 0, secT: [0, 1, 0, 1, 0, 0] };
    var inp = env.input, pz = env.puzzle, src = inp && typeof inp === "object" && (inp.n != null || inp.k != null) ? inp : pz && pz.data ? pz.data : null;
    if (src) {
      var n0 = toInt(src.n), k0 = toInt(src.k), c0 = toInt(src.c);
      if (src.form === "two") { st.form = "two"; st.n = 4; st.k = 3; }
      if (n0 != null) st.n = Math.max(2, Math.min(st.form === "two" ? lib.MAX_N2 : lib.MAX_S, n0));
      if (k0 != null) st.k = Math.max(1, Math.min(st.form === "two" ? lib.MAX_K2 : lib.MAX_KS, k0));
      if (c0 != null && st.form === "stack") st.c = Math.max(1, Math.min(lib.MAX_C, c0));
      if (src.mode === "adv" || src.mode === "fixed") st.mode = src.mode;
      if (st.form === "stack") { var s0 = toInt(src.secret); if (s0 != null && s0 >= 0 && s0 < st.n) st.secS = s0; }
      else if (typeof src.secret === "string" && /^[01]+$/.test(src.secret) && src.secret.length === st.n) st.secT = src.secret.split("").map(Number);
      else if (typeof src.secret === "number") st.secT = zeros(6).map(function (_, i) { return (src.secret >> i) & 1; });
    }
    var body = h("div", { class: "pz-cs pz-cs-ed" }), info = h("p", { class: "pz-cs-edinfo", "aria-live": "polite" });
    function secret() {
      if (st.mode !== "fixed") return null;
      if (st.form === "stack") return Math.min(st.secS, st.n - 1);
      return st.secT.slice(0, st.n).join("");
    }
    function input() { return st.form === "stack" ? { form: "stack", n: st.n, c: st.c, k: st.k, mode: st.mode, secret: secret() } : { form: "two", n: st.n, k: st.k, mode: st.mode, secret: secret() }; }
    function emit() { env.onChange(input()); }
    function set(key, val) {
      st[key] = val;
      if (key === "form") { if (val === "two") { st.n = 4; st.k = 3; } else { st.n = 10; st.c = 9; st.k = 1; } }
      if (st.secS >= st.n) st.secS = st.n - 1;
      keepFocus(body, render); emit();
    }
    function field(label, ctrl, hint) { return h("div", { class: "pz-cs-field" }, h("span", { class: "pz-cs-flab", text: label }), ctrl, hint ? h("p", { class: "pz-cs-fhint faint", text: hint }) : null); }
    function render() {
      var chips = U.pz.chips, stack = st.form === "stack", kids = [], minN = 2, maxN = stack ? lib.MAX_S : lib.MAX_N2;
      kids.push(field("Dạng", chips([{ id: "stack", label: "Chồng xu (tìm chồng giả)" }, { id: "two", label: "Xu hai loại 9 g / 10 g" }], st.form, function (id) { set("form", id); }, "Dạng")));
      var sel = h("select", { "aria-label": stack ? "Số chồng" : "Số xu" });
      for (var i = minN; i <= maxN; i++) sel.append(h("option", { value: String(i), text: String(i) }));
      sel.value = String(st.n);
      sel.addEventListener("change", function () { set("n", +sel.value); });
      var minus = h("button", { type: "button", class: "btn pz-cs-step", "aria-label": "Giảm", html: icon("minus"), disabled: st.n <= minN ? true : null, on: { click: function () { set("n", Math.max(minN, st.n - 1)); } } });
      var plus = h("button", { type: "button", class: "btn pz-cs-step", "aria-label": "Tăng", html: icon("plus"), disabled: st.n >= maxN ? true : null, on: { click: function () { set("n", Math.min(maxN, st.n + 1)); } } });
      var kmin = stack ? lib.needC({ form: "stack", n: st.n, c: st.c, k: 4 }, lib.fullSet({ form: "stack", n: st.n, c: st.c }), 12) : lib.bestK({ form: "two", n: st.n, k: 8 });
      kids.push(field(stack ? "Số chồng" : "Số xu", h("div", { class: "pz-cs-dimrow" }, minus, sel, plus), stack ? "Với " + st.c + " xu mỗi chồng, " + st.k + " lần cân tìm được tối đa " + lib.powCap(st.c + 1, st.k) + " chồng." : "Số lần cân ít nhất để xác định chắc chắn " + st.n + " xu: " + (kmin <= 8 ? kmin : "nhiều hơn 8") + "."));
      if (stack) {
        var cs = h("select", { "aria-label": "Số xu mỗi chồng" });
        for (var q = 1; q <= lib.MAX_C; q++) cs.append(h("option", { value: String(q), text: String(q) }));
        cs.value = String(st.c);
        cs.addEventListener("change", function () { set("c", +cs.value); });
        kids.push(field("Số xu mỗi chồng", h("div", { class: "pz-cs-dimrow" }, cs)));
      }
      var kmax = stack ? lib.MAX_KS : lib.MAX_K2, kopts = []; for (var z = 1; z <= kmax; z++) kopts.push({ id: String(z), label: String(z) });
      kids.push(field("Số lần cân", chips(kopts, String(st.k), function (id) { set("k", +id); }, "Số lần cân")));
      kids.push(field("Chế độ", chips([{ id: "fixed", label: "Bí mật cố định" }, { id: "adv", label: "Đối thủ thích nghi" }], st.mode, function (id) { set("mode", id); }, "Chế độ"), st.mode === "adv" ? "Không có bí mật định sẵn: đối thủ chọn kết quả khó nhất mỗi lần cân." : "Chọn bí mật bên dưới."));
      if (st.mode === "fixed") {
        var grid = h("div", { class: "pz-cs-cgrid", role: "group", "aria-label": stack ? "Chọn chồng giả cố định" : "Chọn loại từng xu" });
        for (var c = 0; c < st.n; c++) (function (c) {
          if (stack) grid.append(h("button", { type: "button", class: "pz-cs-cbtn" + (st.secS === c ? " on" : ""), "aria-pressed": String(st.secS === c), "aria-label": "Chồng " + (c + 1), text: String(c + 1), on: { click: function () { set("secS", c); } } }));
          else { var hv = st.secT[c] === 1; grid.append(h("button", { type: "button", class: "pz-cs-cbtn" + (hv ? " on" : " on2"), "aria-pressed": String(hv), "aria-label": "Xu " + (c + 1) + ": " + (hv ? "nặng" : "nhẹ"), on: { click: function () { var t2 = st.secT.slice(); t2[c] = t2[c] ? 0 : 1; set("secT", t2); } } }, h("span", { class: "pz-cs-cnum", text: String(c + 1) }), h("span", { class: "pz-cs-cstate", text: hv ? "nặng" : "nhẹ" }))); }
        })(c);
        kids.push(field(stack ? "Chồng giả cố định" : "Loại từng xu (bí mật cố định)", grid));
      }
      info.textContent = stack ? st.n + " chồng × " + st.c + " xu, " + st.k + " lần cân." : st.n + " xu hai loại, " + st.k + " lần cân.";
      body.replaceChildren.apply(body, kids.concat([info, h("p", { class: "pz-cs-tip faint", text: "Kết quả kiểm tra (có chiến lược chắc chắn không) hiện ở khung bên cạnh. Xu hai loại tính được tới 6 xu." })]));
    }
    host.replaceChildren(body); render(); emit();
    return { getInput: function () { return input(); }, destroy: function () { host.replaceChildren(); } };
  }

  P.boards = P.boards || {};
  P.boards.coinscale = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
