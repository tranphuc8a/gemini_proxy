/* ui/boards/coinbalance.js — bàn CÂN ĐỒNG XU: cân đòn (SVG nghiêng theo kết quả lần cân gần nhất) + hai đĩa + khay xu + nhật ký lần cân + kết luận, và trình soạn đề.
   Hành động gửi cho engine (assets/js/puzzles/coinbalance.js): {k:"weigh", L:[chỉ số xu…], R:[…]} · {k:"conclude", coin, heavy?} · {k:"truncate", n}. Engine tự tính kết quả cân (oracle) và ghi vào state —
   bàn KHÔNG giữ trạng thái logic: xu đang đặt lên đĩa TRƯỚC khi bấm "Cân" là trạng thái GIAO DIỆN (như ô đang chọn), mất khi bấm Cân / hoàn tác.
   Đầu vào trình soạn (type.fromInput): { n, k, fake: "heavy"|"either", ref: 0|1, dir: 0|1, mode: "fixed"|"adv", secret: {coin, heavy}|null }.

   Cách dùng: chọn "Đặt vào: Trái | Phải | Ngoài" rồi chạm xu (chạm lại đúng đĩa đó = bỏ xu ra ngoài). Nút "Cân" bị vô hiệu kèm lý do (lệch số xu, đĩa trống, hết lượt…).
   Bàn phím (focus trong khay xu, roving tabindex): mũi tên di chuyển · Home/End đầu/cuối · Space = đặt xu vào đĩa đang chọn · phím L / R / 0 = đặt trái / phải / ngoài · Enter = Cân.
   Cân đòn nghiêng + đĩa nặng hạ thấp; tắt chuyển động khi prefers-reduced-motion. Kết quả luôn có CHỮ và ký hiệu ◀ ＝ ▶, không chỉ hình/màu.
   Bảng Kết luận: lưới xu cũng roving tabindex (mũi tên / Home / End di chuyển, Space / Enter chọn) và cập nhật TẠI CHỖ nên không mất focus; các vùng vẽ lại cả hàng (Đặt vào, Nặng/Nhẹ, trình soạn) trả focus về đúng nút (keepFocus).
   Trợ năng: mỗi xu có aria-label (type.describeCell + đĩa đang đặt); thông báo kết quả qua env.announce. highlight(cells, kind) = chỉ số xu (gợi ý / replay). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document, NS = "http://www.w3.org/2000/svg";
  var TILT = 11, DROP = 14;                                            // độ nghiêng đòn (°) và độ hạ đĩa (px) khi có kết quả
  var PAN_NAME = { 0: "ngoài", 1: "trái", 2: "phải" };
  var RESULT = { 1: { glyph: "◀", text: "trái nặng hơn" }, 2: { glyph: "＝", text: "cân bằng" }, 3: { glyph: "▶", text: "phải nặng hơn" } };
  var mqReduce = null;
  try { mqReduce = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : null; } catch (e) { mqReduce = null; }

  function zeros(n) { var o = new Array(n); for (var i = 0; i < n; i++) o[i] = 0; return o; }
  function toInt(x) { if (typeof x === "string" && /^\s*\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function svg(tag, attrs) { var el = doc.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); }); return el; }
  function listText(lib, arr) { return arr.length ? lib.setText(arr) : "{ }"; }
  var uid = 0;                                                         // id duy nhất cho mỗi bàn đang mount (aria-describedby không trùng)
  var FOCUSABLE = "button, select, input, textarea, a[href]";
  /** Chạy fn (vẽ lại một vùng bằng replaceChildren) mà không để focus rơi về BODY: nhớ vị trí phần tử đang focus trong root, vẽ xong thì focus lại phần tử cùng vị trí
      (nếu nó bị vô hiệu thì tới phần tử bật được gần nhất). Chỉ cần cấu trúc phía TRƯỚC phần tử đang bấm không đổi — đúng với mọi chỗ gọi ở đây. */
  function keepFocus(root, fn) {
    var a = doc.activeElement, idx = a && root.contains(a) ? Array.prototype.indexOf.call(root.querySelectorAll(FOCUSABLE), a) : -1;
    fn();
    if (idx < 0) return;
    var els = root.querySelectorAll(FOCUSABLE), at = Math.min(idx, els.length - 1);
    for (var dist = 0; dist < els.length; dist++) {                   // phần tử cũ nếu còn bật; không thì láng giềng gần nhất (ưu tiên phía sau: nút "−" vừa bị vô hiệu → ô chọn số xu)
      var cand = [els[at + dist], els[at - dist]];
      for (var q = 0; q < 2; q++) if (cand[q] && !cand[q].disabled) { cand[q].focus({ preventScroll: true }); return; }
    }
  }
  /** Số cột của lưới nút (đếm các nút cùng hàng với nút đầu). */
  function colsOf(list) { var top = list[0].offsetTop, c = 0; while (c < list.length && Math.abs(list[c].offsetTop - top) < 3) c++; return Math.max(1, c); }
  /** Phím điều hướng lưới: chỉ số đích, hoặc −1 nếu không phải phím điều hướng. */
  function navKey(k, i, count, cc) {
    return k === "ArrowRight" ? Math.min(count - 1, i + 1) : k === "ArrowLeft" ? Math.max(0, i - 1) : k === "ArrowDown" ? Math.min(count - 1, i + cc) : k === "ArrowUp" ? Math.max(0, i - cc) : k === "Home" ? 0 : k === "End" ? count - 1 : -1;
  }
  function coinEl(i, cls) { return h("span", { class: "pz-cb-tok" + (cls ? " " + cls : ""), text: String(i + 1) }); }

  // ================================================================================================================ bàn chơi
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, lib = type.lib, plan = P.plan, ro = !!env.readOnly, d = puzzle.data;
    var n = d.n, C = n + d.ref, kk = d.k, pending = zeros(C), target = 1, focusI = 0, marks = {}, conclOpen = false, conclCoin = -1, conclHeavy = null, offGame = null, cbtns = [], concFocus = 0, rid = "pz-cb-reason-" + (++uid);

    // ---- khung
    var leftB = h("b", { text: "0" }), budgetB = h("b", { text: String(kk) });
    var stats = h("div", { class: "pz-cb-stats", role: "group", "aria-label": "Thông tin ván" },
      h("span", { class: "pz-cb-stat pz-cb-budget", "aria-live": "polite", title: "Số lần cân còn lại / tối đa — hết lượt thì chỉ còn kết luận được" }, "Còn ", leftB, " / " + kk + " lần cân"),
      h("span", { class: "pz-cb-stat", title: n + " xu" + (d.ref ? " + 1 xu chuẩn (chắc chắn thật)" : "") }, h("b", { text: String(n) }), d.ref ? " xu + 1 chuẩn" : " xu"),
      h("span", { class: "pz-cb-stat pz-cb-mode", title: d.mode === "adv" ? "Không có xu giả định sẵn: mỗi lần cân đối thủ chọn kết quả khó nhất." : "Xu giả được chọn sẵn theo seed." }, d.mode === "adv" ? "Đối thủ thích nghi" : "Xu giả cố định"));

    var beamG = svg("g", { class: "pz-cb-beam" }), panGl = svg("g", { class: "pz-cb-svgpan pz-cb-svgpan-l" }), panGr = svg("g", { class: "pz-cb-svgpan pz-cb-svgpan-r" });
    var scale = svg("svg", { class: "pz-cb-scale", viewBox: "0 0 300 110", role: "img", focusable: "false" });
    scale.append(svg("path", { class: "pz-cb-stand", d: "M150 28 V96 M118 96 H182" }));
    beamG.append(svg("line", { class: "pz-cb-bar", x1: "40", y1: "28", x2: "260", y2: "28" }), svg("circle", { class: "pz-cb-pivot", cx: "150", cy: "28", r: "6" }));
    [[panGl, 40], [panGr, 260]].forEach(function (pp) {
      var g = pp[0], x = pp[1];
      g.append(svg("line", { class: "pz-cb-hang", x1: String(x), y1: "28", x2: String(x - 26), y2: "62" }), svg("line", { class: "pz-cb-hang", x1: String(x), y1: "28", x2: String(x + 26), y2: "62" }), svg("path", { class: "pz-cb-dish", d: "M" + (x - 34) + " 62 H" + (x + 34) + " Q" + (x + 30) + " 80 " + x + " 80 Q" + (x - 30) + " 80 " + (x - 34) + " 62 Z" }));
    });
    scale.append(beamG, panGl, panGr);
    var caption = h("p", { class: "pz-cb-caption", "aria-live": "polite" });
    var panLCoins = h("div", { class: "pz-cb-pancoins" }), panRCoins = h("div", { class: "pz-cb-pancoins" }), panLN = h("b", { text: "0" }), panRN = h("b", { text: "0" });
    var panL = h("div", { class: "pz-cb-pan pz-cb-pan-l", role: "group", "aria-label": "Đĩa trái" }, h("div", { class: "pz-cb-panhead" }, h("span", { class: "pz-cb-pantitle", text: "◀ Đĩa trái" }), h("span", { class: "pz-cb-pancount" }, panLN, " xu")), panLCoins);
    var panR = h("div", { class: "pz-cb-pan pz-cb-pan-r", role: "group", "aria-label": "Đĩa phải" }, h("div", { class: "pz-cb-panhead" }, h("span", { class: "pz-cb-pantitle", text: "Đĩa phải ▶" }), h("span", { class: "pz-cb-pancount" }, panRN, " xu")), panRCoins);
    var scaleBox = h("div", { class: "pz-cb-scalebox" }, scale, h("div", { class: "pz-cb-pans" }, panL, panR), caption);

    // chọn đĩa đích
    var targetBox = ro ? null : h("div", { class: "pz-cb-target" });
    function drawTarget() {
      if (!targetBox) return;
      keepFocus(targetBox, drawTargetNow);
    }
    function drawTargetNow() {
      var chips = U.pz.chips([{ id: "1", label: "◀ Trái", title: "Chạm xu để đặt lên đĩa trái (phím L)" }, { id: "2", label: "Phải ▶", title: "Chạm xu để đặt lên đĩa phải (phím R)" }, { id: "0", label: "Ngoài", title: "Chạm xu để bỏ ra ngoài (phím 0)" }], String(target), function (id) { target = +id; drawTarget(); env.announce("Đặt vào đĩa " + PAN_NAME[target] + "."); }, "Đặt vào");
      targetBox.replaceChildren(h("span", { class: "pz-cb-lab", "aria-hidden": "true", text: "Đặt vào" }), chips);
    }

    // khay xu
    var tray = h("div", { class: "pz-cb-tray", role: "group", "aria-label": "Các xu — chạm để đặt lên đĩa" }), btns = [];
    function mkCoin(i) {
      var b = h("button", { type: "button", class: "pz-cb-coin" + (d.ref && i === n ? " is-ref" : ""), tabindex: "-1", dataset: { i: String(i), pan: "0" } },
        h("span", { class: "pz-cb-coinnum", text: String(i + 1) }), h("span", { class: "pz-cb-coinpan", "aria-hidden": "true" }));
      if (d.ref && i === n) b.append(h("span", { class: "pz-cb-coinref", "aria-hidden": "true", text: "chuẩn" }));
      return b;
    }
    for (var ci = 0; ci < C; ci++) { var cb = mkCoin(ci); btns.push(cb); tray.append(cb); }
    btns[0].setAttribute("tabindex", "0");

    // nút thao tác + lý do
    var weighBtn = h("button", { type: "button", class: "btn btn-primary pz-cb-act pz-cb-weigh", html: icon("play") + "<span>Cân</span>" });
    var clearBtn = h("button", { type: "button", class: "btn pz-cb-act pz-cb-clear", html: icon("eraser") + "<span>Xoá đĩa</span>" });
    var conclBtn = h("button", { type: "button", class: "btn pz-cb-act pz-cb-open", "aria-expanded": "false", html: icon("check") + "<span>Kết luận…</span>" });
    var reason = h("p", { class: "pz-cb-reason", id: rid, "aria-live": "polite" });
    weighBtn.setAttribute("aria-describedby", rid);
    var actions = ro ? null : h("div", { class: "pz-cb-actions" }, weighBtn, clearBtn, conclBtn);

    // bảng kết luận
    var conclGrid = h("div", { class: "pz-cb-cgrid", role: "group", "aria-label": "Chọn xu giả" }), conclDir = h("div", { class: "pz-cb-cdir" }), conclOk = h("button", { type: "button", class: "btn btn-primary pz-cb-cok", text: "Chốt kết luận" }), conclX = h("button", { type: "button", class: "btn pz-cb-cx", text: "Đóng" });
    var conclBox = ro ? null : h("section", { class: "pz-cb-concl", hidden: true, "aria-label": "Kết luận" }, h("h3", { text: "Kết luận: xu nào là xu giả?" }), conclGrid, conclDir, h("div", { class: "btn-row" }, conclOk, conclX),
      h("p", { class: "pz-cb-note faint", text: "Kết luận chỉ được tính khi các lần cân đã chứng minh nó. Đoán đúng nhờ may mắn không tính — nếu chưa chắc, bạn sẽ được mở lại để cân tiếp hoặc hoàn tác." }));
    var reopenBox = ro ? null : h("div", { class: "pz-cb-reopen", hidden: true, role: "status" });
    var logEl = h("ol", { class: "pz-cb-log", "aria-label": "Nhật ký các lần cân" }), logHead = h("h3", { class: "pz-cb-loghead", text: "Nhật ký cân" });
    var logBox = h("section", { class: "pz-cb-logbox" }, logHead, logEl);

    host.replaceChildren(h("div", { class: "pz-cb" }, stats, scaleBox, targetBox, tray, actions, reason, reopenBox, conclBox, logBox));

    // ---- trạng thái dẫn xuất từ game.state
    function recs() { return lib.records(puzzle, game.state); }
    function canAct() { return !ro && !game.finished() && game.status !== "paused"; }
    function used() { return plan.count(game.state); }
    function submitted() { return plan.isSubmitted(game.state); }
    function pansOf(pan) { var o = []; for (var i = 0; i < C; i++) if (pending[i] === pan) o.push(i); return o; }
    function weighReason() {
      var l = pansOf(1), r = pansOf(2);
      if (submitted()) return "Đã kết luận — hoàn tác hoặc mở lại để cân tiếp.";
      if (used() >= kk) return "Hết lượt cân — hãy kết luận.";
      if (!l.length && !r.length) return "Đặt xu lên hai đĩa rồi bấm Cân.";
      if (l.length !== r.length) return "Hai đĩa cần số xu bằng nhau (trái " + l.length + ", phải " + r.length + ").";
      return "";
    }

    // ---- vẽ
    function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
    function drawScale() {
      var rs = recs(), last = rs.length ? rs[rs.length - 1] : null, pl = pansOf(1), pr = pansOf(2), showPending = pl.length + pr.length > 0, res = showPending || !last ? 2 : last.result;
      var angle = res === 1 ? -TILT : res === 3 ? TILT : 0, dl = res === 1 ? DROP : res === 3 ? -DROP : 0, dr = -dl;
      beamG.style.transform = "rotate(" + angle + "deg)"; beamG.style.transformOrigin = "150px 28px";
      panGl.style.transform = "translateY(" + dl + "px)"; panGr.style.transform = "translateY(" + dr + "px)";
      panL.style.setProperty("--drop", dl + "px"); panR.style.setProperty("--drop", dr + "px");
      panL.classList.toggle("is-heavy", !showPending && res === 1); panR.classList.toggle("is-heavy", !showPending && res === 3);
      var Ls = showPending ? pl : last ? last.L : [], Rs = showPending ? pr : last ? last.R : [];
      panLCoins.replaceChildren.apply(panLCoins, Ls.map(function (i) { return coinEl(i, showPending ? "" : "past"); }));
      panRCoins.replaceChildren.apply(panRCoins, Rs.map(function (i) { return coinEl(i, showPending ? "" : "past"); }));
      setText(panLN, String(Ls.length)); setText(panRN, String(Rs.length));
      var cap = showPending ? "Đang chuẩn bị lần cân " + (used() + 1) + ": trái " + pl.length + " xu, phải " + pr.length + " xu." : last ? "Lần cân " + rs.length + ": " + RESULT[last.result].glyph + " " + RESULT[last.result].text + "." : "Chưa cân lần nào — đòn thăng bằng.";
      setText(caption, cap);
      scale.setAttribute("aria-label", "Cân đòn. " + cap);
      panL.setAttribute("aria-label", "Đĩa trái" + (showPending ? " (đang đặt)" : last ? " (lần cân " + rs.length + ")" : "") + ": " + listText(lib, Ls)); panR.setAttribute("aria-label", "Đĩa phải" + (showPending ? " (đang đặt)" : last ? " (lần cân " + rs.length + ")" : "") + ": " + listText(lib, Rs));
    }
    function paintCoin(i) {
      var b = btns[i], pan = pending[i], lab = type.describeCell(puzzle, game.state, i) + (pan ? " — đang đặt ở đĩa " + PAN_NAME[pan] : "") + (marks[i] === "hint" ? " — đang được gợi ý" : marks[i] === "replay" ? " — thuộc lần cân ở bước này" : "");
      if (b.dataset.pan !== String(pan)) { b.dataset.pan = String(pan); b.classList.toggle("on-l", pan === 1); b.classList.toggle("on-r", pan === 2); b.querySelector(".pz-cb-coinpan").textContent = pan === 1 ? "◀" : pan === 2 ? "▶" : ""; }
      b.classList.toggle("hint", marks[i] === "hint"); b.classList.toggle("replay", marks[i] === "replay");
      if (b.getAttribute("aria-label") !== lab) b.setAttribute("aria-label", lab);
    }
    function drawTray() { for (var i = 0; i < C; i++) paintCoin(i); tray.classList.toggle("is-locked", !canAct()); }
    function drawLog() {
      var rs = recs(), items = [], cn = lib.concluded(puzzle, game.state), chk = type.check(puzzle, game.state);
      rs.forEach(function (r, j) { items.push(h("li", { class: "pz-cb-logrow" }, h("span", { class: "pz-cb-logset", text: "Lần " + (j + 1) + ": " + lib.setText(r.L) + " ⚖ " + lib.setText(r.R) }), h("span", { class: "pz-cb-logres res-" + r.result, text: RESULT[r.result].glyph + " " + RESULT[r.result].text }))); });
      if (cn) items.push(h("li", { class: "pz-cb-logrow pz-cb-logend " + (chk.solved ? "is-ok" : "is-bad") }, h("span", { class: "pz-cb-logset", text: "Kết luận: xu " + (cn.coin + 1) + (d.dir ? (cn.dir === 1 ? " nặng hơn" : " nhẹ hơn") : " là xu giả") }), h("span", { class: "pz-cb-logres", text: chk.solved ? "✓ đã được chứng minh" : "✗ chưa được chứng minh" })));
      if (!items.length) items.push(h("li", { class: "pz-cb-logempty faint", text: "Chưa có lần cân nào." }));
      logEl.replaceChildren.apply(logEl, items);
      setText(logHead, "Nhật ký cân (" + rs.length + "/" + kk + ")");
    }
    function drawStats() { setText(leftB, String(Math.max(0, kk - used()))); }
    function drawActions() {
      if (ro) return;
      var act = canAct(), why = weighReason(), can = act && !why;
      weighBtn.disabled = !can; clearBtn.disabled = !act || !(pansOf(1).length + pansOf(2).length); conclBtn.disabled = !act || submitted();
      setText(reason, game.finished() ? "" : why);
      var sub = submitted() && !type.check(puzzle, game.state).solved && !game.finished();
      reopenBox.hidden = !sub;
      if (sub) reopenBox.replaceChildren(h("p", { text: "Kết luận chưa được chứng minh từ các lần cân (đoán đúng nhờ may mắn cũng không tính)." }), h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary pz-cb-reopenbtn", on: { click: doReopen }, text: "Mở lại để cân tiếp" })));
      else reopenBox.replaceChildren();
      conclBox.hidden = !(conclOpen && act && !submitted()); conclBtn.setAttribute("aria-expanded", String(!conclBox.hidden));
    }
    function setConcFocusable(i) { if (i === concFocus && cbtns[i].getAttribute("tabindex") === "0") return; cbtns[concFocus].setAttribute("tabindex", "-1"); concFocus = i; cbtns[i].setAttribute("tabindex", "0"); }
    function buildConcludeGrid() {                                       // dựng MỘT lần; chọn xu chỉ đổi class/aria-pressed tại chỗ (không mất focus), một điểm dừng Tab (roving tabindex)
      for (var i = 0; i < n; i++) (function (i) {
        var b = h("button", { type: "button", class: "pz-cb-cbtn", "aria-pressed": "false", "aria-label": "Xu " + (i + 1), tabindex: i === 0 ? "0" : "-1", dataset: { i: String(i) }, text: String(i + 1), on: { click: function () { setConcFocusable(i); conclCoin = i; drawConclude(); } } });
        cbtns.push(b); conclGrid.append(b);
      })(i);
    }
    function drawConclude() {
      if (ro) return;
      cbtns.forEach(function (b, i) { var on = conclCoin === i; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
      if (d.dir) keepFocus(conclDir, function () { conclDir.replaceChildren(U.pz.chips([{ id: "h", label: "Nặng hơn" }, { id: "l", label: "Nhẹ hơn" }], conclHeavy === null ? "" : conclHeavy ? "h" : "l", function (id) { conclHeavy = id === "h"; drawConclude(); }, "Xu giả nặng hay nhẹ")); });
      else conclDir.replaceChildren();
      conclOk.disabled = conclCoin < 0 || (d.dir && conclHeavy === null);
    }
    function drawAll() { drawScale(); drawTray(); drawLog(); drawStats(); drawActions(); }

    // ---- thao tác
    function setPan(i, pan) {
      if (!canAct() || submitted()) return;
      pending[i] = pan; paintCoin(i); drawScale(); drawActions();
    }
    function assign(i) { if (!canAct()) return; setPan(i, pending[i] === target ? 0 : target); env.announce("Xu " + (i + 1) + (pending[i] ? " đặt lên đĩa " + PAN_NAME[pending[i]] : " bỏ ra ngoài") + "."); }
    /** Chạy fn (một thao tác làm NÚT ĐANG FOCUS bị vô hiệu / ẩn / gỡ: Cân, Xoá đĩa, Chốt kết luận, Mở lại) rồi, nếu focus đang ở trong bàn mà bị mất, đưa focus tới `to()` — không để rơi về BODY.
        Focus đã chuyển ra ngoài bàn (hộp thoại "Đã giải"…) thì để nguyên. */
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
    function trayCoin() { return btns[focusI]; }
    function reopenButton() { return reopenBox ? reopenBox.querySelector(".pz-cb-reopenbtn") : null; }
    function doWeigh() {
      if (!canAct() || weighReason()) return;
      keepFocusAfter(function () {
        var l = pansOf(1), r = pansOf(2), res = game.act({ k: "weigh", L: l, R: r });
        if (!res.ok) return;
        pending = zeros(C);
        var rs = recs(), last = rs[rs.length - 1];
        env.announce("Lần cân " + rs.length + ": " + lib.setText(l) + " với " + lib.setText(r) + " — " + RESULT[last.result].text + ". " + (kk - used() > 0 ? "Còn " + (kk - used()) + " lần cân." : "Hết lượt cân, hãy kết luận."));
      }, trayCoin);
    }
    function doClear() { if (!canAct()) return; keepFocusAfter(function () { pending = zeros(C); drawTray(); drawScale(); drawActions(); env.announce("Đã xoá hai đĩa."); }, trayCoin); }
    function doConclude() {
      if (!canAct() || conclCoin < 0 || (d.dir && conclHeavy === null)) return;
      var a = { k: "conclude", coin: conclCoin }; if (d.dir) a.heavy = conclHeavy;
      var coin = conclCoin; conclOpen = false;
      keepFocusAfter(function () {                                       // kết luận chưa chứng minh → focus sang nút "Mở lại để cân tiếp" (việc tiếp theo cần làm); đã giải → về khay xu
        var res = game.act(a);
        if (res.ok) env.announce(res.check && res.check.solved ? "Đã giải! Xu " + (coin + 1) + " là xu giả." : "Kết luận xu " + (coin + 1) + " chưa được chứng minh.");
      }, function () { return reopenButton() || trayCoin(); });
    }
    function doReopen() { if (canAct()) keepFocusAfter(function () { game.act({ k: "truncate", n: used() }); }, trayCoin); }
    function setFocusable(i) { if (i === focusI && btns[i].getAttribute("tabindex") === "0") return; btns[focusI].setAttribute("tabindex", "-1"); focusI = i; btns[i].setAttribute("tabindex", "0"); }
    function focusCoin(i) { setFocusable(i); btns[i].focus({ preventScroll: true }); }
    function cols() { return colsOf(btns); }
    function coinOf(el) { return el && el.closest ? el.closest(".pz-cb-coin") : null; }

    // ---- sự kiện
    tray.addEventListener("click", function (e) { var c = coinOf(e.target); if (!c) return; var i = +c.dataset.i; setFocusable(i); assign(i); });
    tray.addEventListener("focusin", function (e) { var c = coinOf(e.target); if (c) setFocusable(+c.dataset.i); });
    tray.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var c = coinOf(e.target); if (!c) return;
      var i = +c.dataset.i, k = e.key, nx = navKey(k, i, C, cols());
      if (nx >= 0) { e.preventDefault(); if (nx !== i) focusCoin(nx); return; }
      if (k === " " || k === "Spacebar") { e.preventDefault(); if (!e.repeat) assign(i); return; }
      var lk = k.length === 1 ? k.toLowerCase() : "";
      if (lk === "l" || lk === "r" || lk === "0") { e.preventDefault(); setPan(i, lk === "l" ? 1 : lk === "r" ? 2 : 0); env.announce("Xu " + (i + 1) + " — đĩa " + PAN_NAME[pending[i]] + "."); return; }
      if (k === "Enter") { e.preventDefault(); doWeigh(); }
    });
    if (!ro) {
      weighBtn.addEventListener("click", doWeigh); clearBtn.addEventListener("click", doClear);
      conclBtn.addEventListener("click", function () { if (!canAct()) return; conclOpen = !conclOpen; if (conclOpen) { conclCoin = -1; conclHeavy = null; setConcFocusable(0); drawConclude(); } drawActions(); if (conclOpen) cbtns[concFocus].focus({ preventScroll: true }); });
      conclOk.addEventListener("click", doConclude);
      conclGrid.addEventListener("focusin", function (e) { var b = e.target && e.target.closest ? e.target.closest(".pz-cb-cbtn") : null; if (b) setConcFocusable(+b.dataset.i); });
      conclGrid.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var b = e.target && e.target.closest ? e.target.closest(".pz-cb-cbtn") : null; if (!b) return;
        var i = +b.dataset.i, nx = navKey(e.key, i, n, colsOf(cbtns));
        if (nx >= 0) { e.preventDefault(); if (nx !== i) { setConcFocusable(nx); cbtns[nx].focus({ preventScroll: true }); } }
      });
      conclX.addEventListener("click", function () { conclOpen = false; drawActions(); conclBtn.focus({ preventScroll: true }); });
      conclBox.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); conclOpen = false; drawActions(); conclBtn.focus({ preventScroll: true }); } });
      buildConcludeGrid(); drawTarget(); drawConclude();
    }
    offGame = game.on(function (ev) {
      if (ev.type === "change") { pending = zeros(C); if (submitted() || game.finished()) conclOpen = false; drawAll(); }
      else if (ev.type === "status") { drawTray(); drawActions(); }
    });
    drawAll();

    return {
      destroy: function () { if (offGame) offGame(); offGame = null; host.replaceChildren(); },
      refresh: function () { pending = zeros(C); drawAll(); },
      highlight: function (list, kind) {
        var old = marks, i;
        marks = {};
        if (list && list.length && kind) list.forEach(function (j) { if (j >= 0 && j < C) marks[j] = kind; });
        for (i in old) if (Object.prototype.hasOwnProperty.call(old, i)) paintCoin(+i);
        for (i in marks) if (Object.prototype.hasOwnProperty.call(marks, i)) paintCoin(+i);
      },
      focus: function () { btns[focusI].focus({ preventScroll: true }); }
    };
  }

  // ================================================================================================================ trình soạn
  /** Trình soạn (màn Tạo puzzle): loại xu giả, số xu, số lần cân, xu chuẩn, có phải nói nặng/nhẹ, chế độ, và (chế độ cố định) xu giả; mỗi thay đổi gọi env.onChange({ n, k, fake, ref, dir, mode, secret }).
      Vỏ kiểm bằng type.fromInput (trong worker) và hiện "✓ Có chiến lược chắc chắn trong k lần" hoặc "✗ … tối đa N xu". Dòng "Tối đa …" tính tại chỗ bằng type.lib.maxN. */
  function editor(host, env) {
    var lib = env.type.lib, st = { n: 12, k: 3, fake: "either", ref: 0, dir: 1, mode: "fixed", coin: 0, heavy: 1 };
    var inp = env.input, pz = env.puzzle, src = inp && typeof inp === "object" && (inp.n != null || inp.k != null) ? inp : pz && pz.data ? pz.data : null;
    if (src) {
      var n0 = toInt(src.n), k0 = toInt(src.k), r0 = toInt(src.ref), d0 = toInt(src.dir);
      if (n0 != null) st.n = Math.max(2, Math.min(lib.MAX_N, n0)); if (k0 != null) st.k = Math.max(1, Math.min(lib.MAX_K, k0));
      if (src.fake === "heavy" || src.fake === "either") st.fake = src.fake;
      if (r0 === 0 || r0 === 1) st.ref = r0; if (d0 === 0 || d0 === 1) st.dir = d0; if (src.mode === "adv" || src.mode === "fixed") st.mode = src.mode;
      var sc = src.secret && typeof src.secret === "object" ? src.secret : null;
      if (sc) { var c0 = toInt(sc.coin); if (c0 != null && c0 >= 0 && c0 < st.n) st.coin = c0; st.heavy = sc.heavy === 0 || sc.heavy === false ? 0 : 1; }
    }
    if (st.fake === "heavy") { st.dir = 0; st.heavy = 1; }
    var body = h("div", { class: "pz-cb pz-cb-ed" }), info = h("p", { class: "pz-cb-edinfo", "aria-live": "polite" });
    function secret() { return st.mode === "fixed" ? { coin: Math.min(st.coin, st.n - 1), heavy: st.fake === "heavy" ? 1 : st.heavy } : null; }
    function input() { return { n: st.n, k: st.k, fake: st.fake, ref: st.ref, dir: st.fake === "heavy" ? 0 : st.dir, mode: st.mode, secret: secret() }; }
    function emit() { env.onChange(input()); }
    function set(key, val) { st[key] = val; if (st.fake === "heavy") { st.dir = 0; st.heavy = 1; } if (st.coin >= st.n) st.coin = st.n - 1; keepFocus(body, render); emit(); }
    function field(label, ctrl, hint) { return h("div", { class: "pz-cb-field" }, h("span", { class: "pz-cb-flab", text: label }), ctrl, hint ? h("p", { class: "pz-cb-fhint faint", text: hint }) : null); }
    function render() {
      var max = lib.maxN(st.fake, st.ref, st.fake === "heavy" ? 0 : st.dir, st.k), sid = "pz-cb-n-" + Math.floor(Math.random() * 1e6).toString(36);
      var sel = h("select", { id: sid, "aria-label": "Số xu" });
      for (var i = 2; i <= lib.MAX_N; i++) sel.append(h("option", { value: String(i), text: String(i) }));
      sel.value = String(st.n);
      sel.addEventListener("change", function () { set("n", +sel.value); });
      var minus = h("button", { type: "button", class: "btn pz-cb-step", "aria-label": "Giảm số xu", html: icon("minus"), disabled: st.n <= 2 ? true : null, on: { click: function () { set("n", Math.max(2, st.n - 1)); } } });
      var plus = h("button", { type: "button", class: "btn pz-cb-step", "aria-label": "Tăng số xu", html: icon("plus"), disabled: st.n >= lib.MAX_N ? true : null, on: { click: function () { set("n", Math.min(lib.MAX_N, st.n + 1)); } } });
      var chips = U.pz.chips, kids = [
        field("Xu giả", chips([{ id: "heavy", label: "Nặng hơn (biết trước)" }, { id: "either", label: "Nặng hoặc nhẹ" }], st.fake, function (id) { set("fake", id); }, "Loại xu giả")),
        field("Số xu", h("div", { class: "pz-cb-dimrow" }, minus, sel, plus), "Tối đa có chiến lược chắc chắn với cấu hình này: " + (max || "không có") + " xu."),
        field("Số lần cân", chips([1, 2, 3, 4].map(function (v) { return { id: String(v), label: String(v) }; }), String(st.k), function (id) { set("k", +id); }, "Số lần cân")),
        field("Xu chuẩn (thêm 1 xu chắc chắn thật)", chips([{ id: "0", label: "Không" }, { id: "1", label: "Có" }], String(st.ref), function (id) { set("ref", +id); }, "Xu chuẩn"))];
      if (st.fake === "either") kids.push(field("Phải nói nặng hay nhẹ?", chips([{ id: "1", label: "Có — nói cả hướng" }, { id: "0", label: "Không — chỉ chỉ ra xu" }], String(st.dir), function (id) { set("dir", +id); }, "Nói nặng hay nhẹ")));
      kids.push(field("Chế độ", chips([{ id: "fixed", label: "Xu giả cố định" }, { id: "adv", label: "Đối thủ thích nghi" }], st.mode, function (id) { set("mode", id); }, "Chế độ"), st.mode === "adv" ? "Không có xu giả định sẵn: đối thủ chọn kết quả khó nhất mỗi lần cân." : "Chọn xu giả bên dưới."));
      if (st.mode === "fixed") {
        var grid = h("div", { class: "pz-cb-cgrid", role: "group", "aria-label": "Chọn xu giả cố định" });
        for (var c = 0; c < st.n; c++) (function (c) { grid.append(h("button", { type: "button", class: "pz-cb-cbtn" + (st.coin === c ? " on" : ""), "aria-pressed": String(st.coin === c), "aria-label": "Xu " + (c + 1), text: String(c + 1), on: { click: function () { set("coin", c); } } })); })(c);
        kids.push(field("Xu giả cố định", h("div", {}, grid, st.fake === "either" ? chips([{ id: "1", label: "Nặng hơn" }, { id: "0", label: "Nhẹ hơn" }], String(st.heavy), function (id) { set("heavy", +id); }, "Xu giả nặng hay nhẹ") : null)));
      }
      info.textContent = st.n + " xu, " + st.k + " lần cân" + (st.ref ? ", có xu chuẩn" : "") + ".";
      body.replaceChildren.apply(body, kids.concat([info, h("p", { class: "pz-cb-tip faint", text: "Kết quả kiểm tra (có chiến lược chắc chắn không) hiện ở khung bên cạnh. Số xu vượt giới hạn Dyson thì không có chiến lược nào chắc chắn." })]));
    }
    host.replaceChildren(body); render(); emit();
    return { getInput: function () { return input(); }, destroy: function () { host.replaceChildren(); } };
  }

  P.boards = P.boards || {};
  P.boards.coinbalance = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
