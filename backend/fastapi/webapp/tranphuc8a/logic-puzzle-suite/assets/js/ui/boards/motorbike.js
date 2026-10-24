/* ui/boards/motorbike.js — bàn ĐI BỘ & XE MÁY: BIỂU ĐỒ KHÔNG–THỜI GIAN (SVG: ngang = vị trí A→B, dọc = thời gian đi xuống; người = nét mảnh, xe = nét dày mỗi xe một kiểu nét,
   xe đỗ = đoạn thẳng đứng; vạch ngang "người cuối tới B"), chọn xe, các LỆNH (Lấy xe / Chở tới / Đón / Xuống / Bỏ xe) có xem trước, danh sách KẾ HOẠCH (mỗi dòng có nút quay về)
   và nút NỘP; kèm trình soạn đề (cách hiểu, n, k, m).
   Hành động gửi cho engine (assets/js/puzzles/motorbike.js): {k:"cmd", bike, op:"take"|"ride"|"meet"|"off", a, b} · {k:"abandon", bike} · {k:"truncate", n} · {k:"submit"}.
   Bàn KHÔNG tự cài luật: mọi xem trước ("xe tới 3/5 quãng lúc …, người cuối tới B sau …") và lý do lỗi do type.sim.preview(puzzle, state, action) trả về; xe đang chọn, vị trí thanh trượt,
   người đang chọn trong ô, hộp xác nhận nộp là trạng thái GIAO DIỆN (không vào state). Đầu vào trình soạn (type.fromInput): { interp: "A" | "B", n, k, m: "5" | "5/2" }.
   Trợ năng: biểu đồ có aria-label tóm tắt + bảng sự kiện ẩn trong <details> cho trình đọc màn hình; thanh trượt là <input type=range> (phím mũi tên); mọi nút ≥ 44 px, có chữ;
   xe phân biệt bằng KIỂU NÉT + nhãn (không dựa vào màu); dòng trạng thái / ghi chú xem trước aria-live. Giá trị tối ưu KHÔNG hiện sẵn (chỉ ở gợi ý mức ≥ 2 và hộp thoại kết thúc). */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var uid = 0, NS = "http://www.w3.org/2000/svg";
  var FOCUSABLE = "button, select, input, textarea, a[href]";
  var DASH = ["", "9 5", "2 5", "11 4 2 4"];

  function toInt(x) { if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
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
  function svgEl(name, attrs, text) {
    var e = doc.createElementNS(NS, name), k;
    for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) e.setAttribute(k, String(attrs[k]));
    if (text != null) e.textContent = text;
    return e;
  }
  function minText(t) { var s = Math.round(t * 3600), m = Math.floor(s / 60), r = s % 60; return m + "′" + (r < 10 ? "0" : "") + r + "″"; }

  // ================================================================================================================ bàn chơi
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, lib = type.lib, plan = P.plan, ro = !!env.readOnly, d = puzzle.data, Gd = d.G, A = d.interp !== "B", k = d.k, n = d.n;
    var sel = 0, slide = Math.round(Gd / 2), confirmOpen = false, marks = {}, hintPos = [], hintAct = null, offGame = null, base = "pz-mb-" + (++uid), lastW = 0;
    function nm(i) { return "P" + (i + 1); }

    var stats = h("div", { class: "pz-mb-stats", role: "group", "aria-label": "Đề bài" },
      h("span", { class: "pz-mb-stat" }, h("b", { text: String(n) }), " người"),
      h("span", { class: "pz-mb-stat", title: A ? "Mỗi xe chở 2 người của nhóm: người lái + người ngồi sau" : "Mỗi xe ôm chở 1 khách; tài xế ngoài nhóm" }, h("b", { text: String(k) }), A ? " xe (2 chỗ)" : " xe ôm (1 khách)"),
      h("span", { class: "pz-mb-stat", title: "Xe nhanh gấp m lần đi bộ" }, "Xe nhanh gấp ", h("b", { text: lib.mText(d) })),
      h("span", { class: "pz-mb-stat", title: "Đi bộ cả quãng AB mất 60 phút" }, "Đi bộ cả quãng: ", h("b", { text: "60 phút" })),
      h("span", { class: "pz-mb-stat pz-mb-goal", title: "Giá trị = thời điểm người cuối cùng tới B" }, "Mục tiêu: người cuối tới B sớm nhất"));

    // ---- biểu đồ không–thời gian
    var diagHost = h("div", { class: "pz-mb-diag" });
    var status = h("p", { class: "pz-mb-status", "aria-live": "polite" });
    var evTable = h("table", { class: "pz-mb-evtable" });
    var evBox = h("details", { class: "pz-mb-evbox" }, h("summary", { text: "Bảng sự kiện (chữ, cho trình đọc màn hình)" }), evTable);

    // ---- điều khiển
    var bikeChips = h("div", { class: "pz-mb-bikes", role: "radiogroup", "aria-label": "Chọn xe" });
    var bikeInfo = h("p", { class: "pz-mb-binfo", "aria-live": "polite" });
    var ctlBox = h("div", { class: "pz-mb-ctls" });
    var controls = ro ? null : h("section", { class: "pz-mb-controls", "aria-label": "Lệnh cho xe" }, h("h3", { class: "pz-mb-h", text: "Lệnh cho xe" }), bikeChips, bikeInfo, ctlBox);

    // ---- kế hoạch
    var planList = h("ol", { class: "pz-mb-plan", "aria-label": "Kế hoạch" });
    var planCount = h("b", { text: "0" });
    var ghost = h("p", { class: "pz-mb-ghost", hidden: true, "aria-live": "polite" });
    var submitBtn = h("button", { type: "button", class: "btn btn-primary pz-mb-act pz-mb-submit", html: icon("check") + "<span>Nộp kế hoạch…</span>", "aria-expanded": "false" });
    var undoBtn = h("button", { type: "button", class: "btn pz-mb-act pz-mb-popbtn", html: icon("undo") + "<span>Xoá lệnh cuối</span>" });
    var clearBtn = h("button", { type: "button", class: "btn pz-mb-act pz-mb-clear", html: icon("trash") + "<span>Xoá kế hoạch</span>" });
    var reopenBtn = h("button", { type: "button", class: "btn pz-mb-act pz-mb-reopen", html: icon("undo") + "<span>Mở lại để sửa</span>", hidden: true });
    var confirmBox = h("section", { class: "pz-mb-confirm", hidden: true, role: "group", "aria-label": "Xác nhận nộp" });
    var planBox = h("section", { class: "pz-mb-planbox" }, h("h3", { class: "pz-mb-h" }, "Kế hoạch (", planCount, " / " + lib.CAP + " lệnh)"), planList, ghost, ro ? null : h("div", { class: "pz-mb-actions" }, submitBtn, undoBtn, clearBtn, reopenBtn), ro ? null : confirmBox);

    host.replaceChildren(h("div", { class: "pz-mb" }, stats, h("div", { class: "pz-mb-diagbox" }, diagHost, status, evBox), controls, planBox));

    // ---- trạng thái dẫn xuất
    function canAct() { return !ro && !game.finished() && game.status !== "paused"; }
    function submitted() { return plan.isSubmitted(game.state); }
    function view() { return type.sim.view(puzzle, game.state); }
    function prev(action) { return type.sim.preview(puzzle, game.state, action); }
    function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
    function posOf(b) { return b.xq === "0" ? "A" : b.xq === "1" ? "B" : b.xq + " quãng"; }

    // ---- vẽ biểu đồ
    function drawDiagram() {
      var v = view(), W = Math.max(260, Math.round(diagHost.clientWidth || lastW || 320)), H = 270, pl = 38, pr = 12, pt = 20, pb = 30;
      lastW = W;
      if (!v.ok) { diagHost.replaceChildren(h("p", { class: "pz-mb-bad", text: "Kế hoạch không hợp lệ: " + v.error })); return; }
      var tmax = Math.max(1, v.Tf) * 1.04, sx = function (x) { return pl + x * (W - pl - pr); }, sy = function (t) { return pt + t / tmax * (H - pt - pb); };
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", height: H, class: "pz-mb-svg", role: "img", "aria-label": "Biểu đồ không–thời gian: ngang là vị trí từ A tới B, dọc là thời gian đi xuống. Người cuối tới B sau " + v.Ttext + "." });
      var i, s;
      for (i = 0; i <= 6; i++) {                                              // lưới thời gian mỗi 10 phút
        var tm = i / 6; if (tm > tmax) break;
        svg.append(svgEl("line", { x1: pl, x2: W - pr, y1: sy(tm), y2: sy(tm), class: "pz-mb-grid" }), svgEl("text", { x: pl - 5, y: sy(tm) + 4, class: "pz-mb-axt", "text-anchor": "end" }, (i * 10) + "′"));
      }
      for (i = 0; i <= 4; i++) svg.append(svgEl("line", { x1: sx(i / 4), x2: sx(i / 4), y1: pt, y2: H - pb, class: "pz-mb-grid" }));
      svg.append(svgEl("text", { x: sx(0), y: H - 10, class: "pz-mb-axt pz-mb-axb", "text-anchor": "middle" }, "A"), svgEl("text", { x: sx(1), y: H - 10, class: "pz-mb-axt pz-mb-axb", "text-anchor": "middle" }, "B"),
        svgEl("text", { x: sx(0.5), y: H - 10, class: "pz-mb-axt", "text-anchor": "middle" }, "vị trí →"));
      if (tmax > 1.02) svg.append(svgEl("line", { x1: pl, x2: W - pr, y1: sy(1), y2: sy(1), class: "pz-mb-ref" }), svgEl("text", { x: W - pr - 2, y: sy(1) - 4, class: "pz-mb-axt", "text-anchor": "end" }, "60′ = đi bộ cả quãng"));
      v.segs.forEach(function (sg) { if (sg.kind === "walk" || sg.kind === "wait") svg.append(svgEl("line", { x1: sx(sg.x0), y1: sy(sg.t0), x2: sx(sg.x1), y2: sy(sg.t1), class: sg.kind === "walk" ? "pz-mb-walk" : "pz-mb-wait" })); });
      v.segs.forEach(function (sg) { if (sg.kind === "bike") svg.append(svgEl("line", { x1: sx(sg.x0), y1: sy(sg.t0), x2: sx(sg.x1), y2: sy(sg.t1), class: "pz-mb-bike pz-mb-b" + (sg.id % 4), "stroke-dasharray": DASH[sg.id % 4] || null })); });
      v.events.forEach(function (e) { svg.append(svgEl("circle", { cx: sx(e.x), cy: sy(e.t), r: 3.4, class: "pz-mb-dot pz-mb-b" + (e.bike % 4) })); });
      svg.append(svgEl("line", { x1: pl, x2: W - pr, y1: sy(v.Tf), y2: sy(v.Tf), class: "pz-mb-tline" }));
      // nhãn người tới B (gộp những người cùng thời điểm)
      var groups = {}, order = [];
      v.arrivals.forEach(function (a, p) { if (!groups[a.q]) { groups[a.q] = { f: a.f, text: a.text, who: [] }; order.push(a.q); } groups[a.q].who.push(nm(p)); });
      order.sort(function (a, b) { return groups[a].f - groups[b].f; });
      var lastY = -99;
      order.forEach(function (key) {
        var gr = groups[key], y = sy(gr.f) - 5; if (y - lastY < 13 && lastY > -90) y = lastY + 13; lastY = y;
        svg.append(svgEl("text", { x: W - pr - 2, y: y, class: "pz-mb-arr", "text-anchor": "end" }, gr.who.join(" ") + " tới B · " + gr.text));
      });
      hintPos.forEach(function (x) { if (x >= 0 && x <= 1) svg.append(svgEl("line", { x1: sx(x), x2: sx(x), y1: pt, y2: H - pb, class: "pz-mb-hintline" }), svgEl("text", { x: sx(x) + 3, y: pt + 10, class: "pz-mb-hinttxt" }, "gợi ý")); });
      diagHost.replaceChildren(svg);
      setText(status, "Nếu nộp bây giờ: người cuối tới B sau " + v.Ttext + " (" + v.T + " giờ). Mỗi xe: " + v.bikes.map(function (b, i) { return "xe " + (i + 1) + (b.used ? " ở " + posOf(b) : " chưa dùng"); }).join("; ") + ".");
      var rows = [h("tr", null, h("th", { text: "Lệnh" }), h("th", { text: "Sự kiện" }))];
      v.events.forEach(function (e) { rows.push(h("tr", null, h("td", { text: String(e.idx + 1) }), h("td", { text: e.text }))); });
      evTable.replaceChildren.apply(evTable, rows);
    }

    // ---- điều khiển (dựng lại mỗi lần đổi, giữ focus)
    function walkerList(forTake) {
      var ws = type.sim.walkers(puzzle, game.state, sel), out = [];
      ws.forEach(function (w) { if (w.mode === "walk" || (!forTake && w.mode === "done")) out.push(w); });
      return out;
    }
    function personSelect(id, label, list, withNone) {
      var el = h("select", { class: "pz-mb-sel", id: id, "aria-label": label });
      if (withNone) el.append(h("option", { value: "0", text: "— không có —" }));
      list.forEach(function (w) { el.append(h("option", { value: String(w.id + 1), text: nm(w.id) + (w.mode === "done" ? " (đã tới B)" : "") })); });
      return el;
    }
    function noteEl(id) { return h("p", { class: "pz-mb-note", id: id, "aria-live": "polite" }); }
    function row(lab, line, note) { return h("div", { class: "pz-mb-ctl" }, h("span", { class: "pz-mb-lab", text: lab }), h("div", { class: "pz-mb-line" }, line), note); }
    function btn(cls, ic, text) { return h("button", { type: "button", class: "btn pz-mb-act " + cls, html: icon(ic) + "<span>" + text + "</span>" }); }
    var ui = {};
    function drawBikes() {
      var kids = [];
      for (var b = 0; b < k; b++) kids.push(h("button", { type: "button", role: "radio", class: "chip pz-mb-bikechip" + (b === sel ? " on" : ""), "aria-checked": b === sel ? "true" : "false", dataset: { bike: String(b) },
        text: (A ? "Xe " : "Xe ôm ") + (b + 1), on: { click: (function (bb) { return function () { sel = bb; drawControls(); }; })(b) } }));
      bikeChips.replaceChildren.apply(bikeChips, kids);
    }
    function drawControls() {
      if (ro) return;
      keepFocus(host, function () {
        drawBikes();
        var v = view(), b = v.ok ? v.bikes[sel] : null;
        if (!b) { bikeInfo.textContent = "Kế hoạch không hợp lệ."; ctlBox.replaceChildren(); return; }
        var real = b.riders.length, riding = real ? "trên xe: " + b.riders.map(function (r, i) { return nm(r) + (A && i === 0 ? " (lái)" : ""); }).join(", ") : A ? "đang đỗ, chưa có ai trên xe" : "tài xế chờ, chưa có khách";
        setText(bikeInfo, (A ? "Xe " : "Xe ôm ") + (sel + 1) + ": " + (b.used ? "đang ở " + posOf(b) + " lúc " + b.tText : "chưa dùng, ở A") + " · " + riding + ".");
        var kids = [], canTake = real === 0, canMeet = A ? real === 1 : real === 0, canRide = A ? real >= 1 : true, canOff = real >= 1;
        ui = {};
        if (canTake) {
          var tw = walkerList(true), s1 = personSelect(base + "-t1", A ? "Người lái" : "Khách lên xe", tw, false), s2 = A ? personSelect(base + "-t2", "Người ngồi sau (không bắt buộc)", tw, true) : null;
          ui.take = { s1: s1, s2: s2, btn: btn("pz-mb-take", "plus", A ? "Lấy xe" : "Nhận khách tại chỗ"), note: noteEl(base + "-nt") }; ui.take.btn.setAttribute("aria-describedby", ui.take.note.id);
          kids.push(row(A ? "Lấy xe tại chỗ: ai lái, ai ngồi sau" : "Nhận khách (khách phải ở phía sau xe)", [s1, s2, ui.take.btn], ui.take.note));
        }
        if (canRide) {
          var rg = h("input", { type: "range", class: "pz-mb-range", min: "0", max: String(Gd), step: "1", value: String(slide), "aria-label": "Vị trí muốn chở tới (trên quãng AB)" }), rl = h("output", { class: "pz-mb-rval", "aria-hidden": "true" });
          ui.ride = { rg: rg, rl: rl, btn: btn("btn-primary pz-mb-ride", "next", "Chở tới"), toB: btn("pz-mb-toB", "last", "Chở thẳng tới B"), note: noteEl(base + "-nr") }; ui.ride.btn.setAttribute("aria-describedby", ui.ride.note.id);
          kids.push(row("Chở tới (kéo thanh hoặc phím ←/→, " + Gd + " vạch)", [rg, rl, ui.ride.btn, ui.ride.toB], ui.ride.note));
        }
        if (canMeet) {
          var mw = walkerList(false), s3 = personSelect(base + "-m", "Người muốn đón", mw, false);
          ui.meet = { sel: s3, btn: btn("pz-mb-meet", "restart", "Quay lại đón"), note: noteEl(base + "-nm") }; ui.meet.btn.setAttribute("aria-describedby", ui.meet.note.id);
          kids.push(row("Chạy tới gặp người đang đi bộ rồi đón lên xe", [s3, ui.meet.btn], ui.meet.note));
        }
        if (canOff) {
          var offs = b.riders.map(function (r) { var bt = btn("pz-mb-off", "minus", "Thả " + nm(r)); bt.dataset.who = String(r + 1); return bt; });
          ui.offs = offs; ui.offNote = noteEl(base + "-no");
          if (A) { ui.aband = btn("pz-mb-aband", "trash", "Bỏ xe tại đây"); ui.aband.setAttribute("aria-describedby", ui.offNote.id); }
          kids.push(row("Xuống xe tại chỗ (người đó đi bộ tiếp" + (A ? "; xuống hết = bỏ xe" : "") + ")", offs.concat(A ? [ui.aband] : []), ui.offNote));
        }
        if (!kids.length) kids.push(h("p", { class: "pz-mb-note", text: "Xe này chưa có lệnh khả dụng." }));
        ctlBox.replaceChildren.apply(ctlBox, kids);
        wire();
        refreshNotes();
      });
    }
    function actTake() { var a = toInt(ui.take.s1.value), b2 = ui.take.s2 ? toInt(ui.take.s2.value) : 0; return { k: "cmd", bike: sel + 1, op: "take", a: a, b: b2 || 0 }; }
    function actRide() { return { k: "cmd", bike: sel + 1, op: "ride", a: toInt(ui.ride.rg.value), b: 0 }; }
    function actMeet() { return { k: "cmd", bike: sel + 1, op: "meet", a: toInt(ui.meet.sel.value), b: 0 }; }
    function actOff(who) { return { k: "cmd", bike: sel + 1, op: "off", a: who, b: 0 }; }
    function showNote(el, res, okText) { el.classList.toggle("bad", !res.ok); setText(el, res.ok ? okText + res.after.event + " Nếu dừng ở đây, người cuối tới B sau " + res.after.Ttext + "." : res.error || ""); }
    function refreshNotes() {
      if (ro || !ui) return;
      var act = canAct(), res;
      if (ui.take) { res = prev(actTake()); showNote(ui.take.note, res, "Sau lệnh: "); ui.take.btn.disabled = !act || !res.ok; }
      if (ui.ride) {
        slide = Math.max(0, Math.min(Gd, toInt(ui.ride.rg.value) == null ? slide : toInt(ui.ride.rg.value))); setText(ui.ride.rl, lib.gridText(slide, Gd) + " (" + Math.round(slide / Gd * 1000) / 10 + " %)");
        res = prev(actRide()); showNote(ui.ride.note, res, "Sau lệnh: "); ui.ride.btn.disabled = !act || !res.ok;
        var rb = prev({ k: "cmd", bike: sel + 1, op: "ride", a: Gd, b: 0 }); ui.ride.toB.disabled = !act || !rb.ok;
      }
      if (ui.meet) { res = ui.meet.sel.value ? prev(actMeet()) : { ok: false, error: "Không còn ai để đón." }; showNote(ui.meet.note, res, "Sau lệnh: "); ui.meet.btn.disabled = !act || !res.ok; }
      if (ui.offs) {
        ui.offs.forEach(function (bt) { var r1 = prev(actOff(toInt(bt.dataset.who))); bt.disabled = !act || !r1.ok; });
        if (ui.aband) { var ra = prev({ k: "abandon", bike: sel + 1 }); ui.aband.disabled = !act || !ra.ok; setText(ui.offNote, ra.ok ? "Bỏ xe: " + ra.after.event : ra.error || ""); ui.offNote.classList.toggle("bad", !ra.ok); }
        else setText(ui.offNote, "");
      }
    }
    function wire() {
      if (ui.take) { ui.take.btn.addEventListener("click", function () { run(actTake(), "Đã lấy xe."); }); [ui.take.s1, ui.take.s2].forEach(function (s) { if (s) s.addEventListener("change", refreshNotes); }); }
      if (ui.ride) {
        ui.ride.rg.addEventListener("input", refreshNotes);
        ui.ride.btn.addEventListener("click", function () { run(actRide(), "Đã chở tới " + lib.gridText(slide, Gd) + "."); });
        ui.ride.toB.addEventListener("click", function () { ui.ride.rg.value = String(Gd); run({ k: "cmd", bike: sel + 1, op: "ride", a: Gd, b: 0 }, "Đã chở tới B."); });
      }
      if (ui.meet) { ui.meet.btn.addEventListener("click", function () { run(actMeet(), "Đã quay lại đón."); }); ui.meet.sel.addEventListener("change", refreshNotes); }
      if (ui.offs) ui.offs.forEach(function (bt) { bt.addEventListener("click", function () { run(actOff(toInt(bt.dataset.who)), "Đã thả người xuống."); }); });
      if (ui.aband) ui.aband.addEventListener("click", function () { run({ k: "abandon", bike: sel + 1 }, "Đã bỏ xe."); });
    }

    // ---- kế hoạch
    function drawPlan() {
      var recs = plan.read(game.state, lib.LAYOUT), v = view(), kids = [], sub = submitted();
      recs.forEach(function (r, i) {
        var txt = type.describeCell(puzzle, game.state, i), ev = v.ok ? v.events.filter(function (e) { return e.idx === i; }).map(function (e) { return e.text; }).join(" ") : "";
        var li = h("li", { class: "pz-mb-step" + (marks[i] === "hint" ? " hint" : marks[i] === "replay" ? " replay" : ""), "aria-label": txt + (ev ? ". " + ev : "") },
          h("span", { class: "pz-mb-stext", text: txt.replace(/^Lệnh \d+: /, "") }), ev ? h("span", { class: "pz-mb-safter", text: ev }) : null);
        if (!ro && i < recs.length - 1) li.append(h("button", { type: "button", class: "btn pz-mb-cut", "aria-label": "Quay kế hoạch về sau lệnh " + (i + 1) + " (bỏ " + (recs.length - 1 - i) + " lệnh sau)", title: "Giữ tới lệnh " + (i + 1) + ", bỏ các lệnh sau", dataset: { n: String(i + 1) }, text: "↩ Giữ tới đây", disabled: canAct() ? null : true, on: { click: function () { doTruncate(i + 1); } } }));
        kids.push(li);
      });
      if (!kids.length) kids.push(h("li", { class: "pz-mb-empty faint", text: "Chưa có lệnh nào: ai chưa được lệnh thì đi bộ về B (60 phút). Hãy chọn xe và lấy xe cho một người." }));
      planList.replaceChildren.apply(planList, kids);
      setText(planCount, String(recs.length));
      if (hintAct && hintAct.k === "cmd") { ghost.hidden = false; setText(ghost, "Gợi ý sẽ thêm: " + type.lib.recText(d, [hintAct.bike, lib["OP_" + hintAct.op.toUpperCase()], hintAct.a, hintAct.b || 0]) + "."); }
      else if (hintAct && hintAct.k === "truncate") { ghost.hidden = false; setText(ghost, "Gợi ý: quay kế hoạch về còn " + hintAct.n + " lệnh."); }
      else { ghost.hidden = true; setText(ghost, ""); }
      if (!ro) { submitBtn.disabled = !(canAct() && recs.length >= 1 && !sub); undoBtn.disabled = !canAct() || !recs.length || sub; clearBtn.disabled = !canAct() || !recs.length; reopenBtn.hidden = !sub || game.finished(); }
    }
    function drawConfirm() {
      if (ro) return;
      confirmBox.hidden = !(confirmOpen && canAct() && !submitted()); submitBtn.setAttribute("aria-expanded", String(!confirmBox.hidden));
      if (confirmBox.hidden) { confirmBox.replaceChildren(); return; }
      if (confirmBox.childNodes.length) return;
      var v = view();
      confirmBox.append(h("p", { class: "pz-mb-cp", text: "Nộp kế hoạch hiện tại: người cuối tới B sau " + (v.ok ? v.Ttext : "—") + ". Nộp xong ván kết thúc và được chấm so với mức tối ưu." }),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary pz-mb-ok", text: "Nộp", on: { click: doSubmit } }), h("button", { type: "button", class: "btn pz-mb-back", text: "Xem lại", on: { click: function () { closeConfirm(true); } } })));
    }
    function drawAll() { drawDiagram(); drawPlan(); drawControls(); drawConfirm(); }

    // ---- thao tác
    function keepAfter(fn) {
      var a0 = doc.activeElement, had = !!a0 && host.contains(a0);
      fn();
      if (!had) return;
      var b = doc.activeElement;
      if (b && b !== doc.body && !host.contains(b)) return;
      if (b && b !== doc.body && !b.disabled && !(b.closest && b.closest("[hidden]"))) return;
      var t = host.querySelector(".pz-mb-bikechip.on") || host; if (t && t.focus) t.focus({ preventScroll: true });
    }
    function run(action, say) {
      if (!canAct()) return;
      keepAfter(function () { var r = game.act(action); if (r.ok && say) env.announce(say + " " + status.textContent); });
    }
    function doTruncate(m) { run({ k: "truncate", n: m }, "Quay kế hoạch về sau lệnh " + m + "."); }
    function doSubmit() { if (!canAct()) return; confirmOpen = false; keepAfter(function () { var r = game.act({ k: "submit" }); if (r.ok) env.announce("Đã nộp kế hoạch."); }); }
    function closeConfirm(focus) { confirmOpen = false; drawConfirm(); if (focus) submitBtn.focus({ preventScroll: true }); }
    if (!ro) {
      submitBtn.addEventListener("click", function () { if (!canAct()) return; confirmOpen = !confirmOpen; drawConfirm(); if (confirmOpen) { var ok = confirmBox.querySelector(".pz-mb-ok"); if (ok) ok.focus({ preventScroll: true }); } });
      confirmBox.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeConfirm(true); } });
      undoBtn.addEventListener("click", function () { doTruncate(Math.max(0, plan.count(game.state) - 1)); });
      clearBtn.addEventListener("click", function () { doTruncate(0); });
      reopenBtn.addEventListener("click", function () { run({ k: "truncate", n: plan.count(game.state) }, "Đã mở lại kế hoạch."); });
    }
    var onResize = function () { var w = Math.round(diagHost.clientWidth || 0); if (w && Math.abs(w - lastW) > 2) drawDiagram(); }, ro2 = null;
    if (root.ResizeObserver) { ro2 = new root.ResizeObserver(onResize); ro2.observe(diagHost); } else root.addEventListener("resize", onResize);
    function hintFrom(hh) {
      hintPos = hh && hh.regions && hh.regions.positions ? hh.regions.positions.slice() : []; hintAct = hh && hh.action && (hh.action.k === "cmd" || hh.action.k === "truncate") ? hh.action : null;
      if (hintAct && hintAct.k === "cmd" && !ro) { sel = Math.max(0, Math.min(k - 1, hintAct.bike - 1)); if (hintAct.op === "ride") slide = hintAct.a; }
    }
    offGame = game.on(function (ev) {
      if (ev.type === "change") {
        confirmOpen = false; hintPos = []; hintAct = null; marks = {};
        var v = view(); if (v.ok && ui.ride) { var b = v.bikes[sel]; slide = Math.max(0, Math.min(Gd, Math.round(b.x * Gd) + Math.max(1, Math.round(Gd / 5)))); }
        drawAll();
      } else if (ev.type === "status") { drawPlan(); refreshNotes(); drawConfirm(); }
      else if (ev.type === "hint") { hintFrom(ev.hint); drawDiagram(); drawPlan(); drawControls(); }
    });
    drawAll();

    return {
      destroy: function () { if (offGame) offGame(); offGame = null; if (ro2) ro2.disconnect(); else root.removeEventListener("resize", onResize); host.replaceChildren(); },
      refresh: function () { confirmOpen = false; hintPos = []; hintAct = null; marks = {}; drawAll(); },
      highlight: function (list, kind) {
        marks = {};
        if (list && list.length && kind) list.forEach(function (j) { marks[j] = kind; });
        if (!kind || !list || !list.length) { hintPos = []; hintAct = null; }
        else if (kind === "hint" && game.lastHint) hintFrom(game.lastHint);
        drawDiagram(); drawPlan();
      },
      focus: function () { var t = host.querySelector(".pz-mb-bikechip.on"); (t || host).focus({ preventScroll: true }); }
    };
  }

  // ================================================================================================================ trình soạn
  /** Trình soạn (màn Tạo puzzle): chọn cách hiểu (A: người trong nhóm lái / B: xe ôm), n, k, m; mỗi thay đổi gọi env.onChange({ interp, n, k, m }). Dòng kết quả tính tại chỗ bằng type.fromInput. */
  function editor(host, env) {
    var type = env.type, st = { interp: "A", n: 4, k: 1, m: "5" };
    var inp = env.input, pz = env.puzzle, src = inp && typeof inp === "object" && (inp.n != null || inp.k != null) ? inp : pz && pz.data ? pz.data : null;
    if (src) {
      if (src.interp === "A" || src.interp === "B") st.interp = src.interp;
      var n0 = toInt(src.n), k0 = toInt(src.k); if (n0 != null) st.n = n0; if (k0 != null) st.k = k0;
      if (typeof src.m === "string" || typeof src.m === "number") st.m = String(src.m); else if (src.mu != null) st.m = src.mv > 1 ? src.mu + "/" + src.mv : String(src.mu);
    }
    var body = h("div", { class: "pz-mb pz-mb-ed" }), info = h("p", { class: "pz-mb-edinfo", "aria-live": "polite" });
    var samples = [{ label: "4 người, 1 xe, m = 5", interp: "A", n: 4, k: 1, m: "5" }, { label: "4 người, 1 xe, m = 2 (bỏ xe)", interp: "A", n: 4, k: 1, m: "2" }, { label: "6 người, 2 xe, m = 5", interp: "A", n: 6, k: 2, m: "5" },
      { label: "5 người, 1 xe, m = 2 (chưa biết tối ưu)", interp: "A", n: 5, k: 1, m: "2" }, { label: "Xe ôm: 6 người, 2 xe, m = 4", interp: "B", n: 6, k: 2, m: "4" }];
    function input() { return { interp: st.interp, n: st.n, k: st.k, m: st.m }; }
    function emit() { env.onChange(input()); }
    function setInfo() {
      var r;
      try { r = type.fromInput(input()); } catch (e) { r = { ok: false, errors: ["Lỗi tính: " + e.message] }; }
      info.textContent = r.ok ? r.statusText + (r.warnings.length ? " — " + r.warnings[0] : "") : (r.errors[0] || "Đề chưa hợp lệ.");
      info.className = "pz-mb-edinfo " + (r.ok ? (r.statusKind === "warn" ? "warn" : "good") : "bad");
    }
    function field(label, ctrl, hint) { return h("div", { class: "pz-mb-field" }, h("span", { class: "pz-mb-flab", text: label }), ctrl, hint ? h("p", { class: "pz-mb-fhint faint", text: hint }) : null); }
    function numField(label, key, min, max, hint) {
      var el = h("input", { type: "number", inputmode: "numeric", class: "pz-mb-num", "aria-label": label, min: String(min), max: String(max), step: "1", value: String(st[key]) });
      el.addEventListener("input", function () { var v = toInt(el.value); if (v != null) { st[key] = v; emit(); } setInfo(); });
      return field(label, el, hint);
    }
    function render() {
      var chips = U.pz.chips, mEl = h("input", { type: "text", inputmode: "decimal", class: "pz-mb-num", "aria-label": "Tốc độ xe gấp m lần đi bộ", value: st.m, placeholder: "5 hoặc 5/2" });
      mEl.addEventListener("input", function () { st.m = mEl.value; emit(); setInfo(); });
      var kids = [
        field("Cách hiểu", chips([{ id: "A", label: "Người trong nhóm lái" }, { id: "B", label: "Xe ôm (tài xế ngoài nhóm)" }], st.interp, function (id) { st.interp = id; keepFocus(body, render); emit(); }, "Cách hiểu"),
          st.interp === "A" ? "Xe chở 2 người của nhóm (lái + ngồi sau); được bỏ xe bên đường cho người sau nhặt." : "Mỗi xe có tài xế ngoài nhóm, chở 1 khách; tài xế không cần tới B."),
        numField("Số người (n)", "n", 1, type.lib.MAX_N, "Tối đa " + type.lib.MAX_N + " người."), numField("Số xe (k)", "k", 1, type.lib.MAX_K, "Tối đa " + type.lib.MAX_K + " xe."),
        field("Xe nhanh gấp m lần đi bộ", mEl, "m > 1: số nguyên (5), phân số (5/2) hoặc thập phân (2,5); m ≤ 20.")];
      kids.push(h("div", { class: "pz-mb-samples", role: "group", "aria-label": "Mẫu có sẵn" }, samples.map(function (sm) { return h("button", { type: "button", class: "btn", text: sm.label, on: { click: function () { st.interp = sm.interp; st.n = sm.n; st.k = sm.k; st.m = sm.m; keepFocus(body, render); emit(); } } }); })));
      kids.push(info, h("p", { class: "pz-mb-tip faint", text: "Biết tối ưu chính xác khi: m ≥ 3 và k chia hết n, hoặc m ≤ 3 và 2k chia hết n (xe ôm: k chia hết n). Các đề khác vẫn chơi được, chấm so với cận dưới LP." }));
      body.replaceChildren.apply(body, kids);
      setInfo();
    }
    host.replaceChildren(body); render(); emit();
    return { getInput: function () { return input(); }, destroy: function () { host.replaceChildren(); } };
  }

  P.boards = P.boards || {};
  P.boards.motorbike = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
