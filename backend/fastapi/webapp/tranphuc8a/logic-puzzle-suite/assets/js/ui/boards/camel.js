/* ui/boards/camel.js — bàn LẠC ĐÀ CHỞ CHUỐI (V1, một lạc đà): trục km nằm ngang (kho = cột có số quả, 🐪 + thẻ tải, vạch đích D, điểm gợi ý), ô LẤY / ĐẶT / ĐI TỚI có xem trước,
   hai nút nhanh (Chuyến tiếp tế, Đi hết sức), danh sách KẾ HOẠCH (mỗi dòng có nút quay về), dải đường đi zigzag và nút NỘP; kèm trình soạn đề.
   Hành động gửi cho engine (assets/js/puzzles/camel.js): {k:"load", n} · {k:"drop", n} · {k:"go", x} · {k:"trip", to} · {k:"run"} · {k:"truncate", n} · {k:"submit"}.
   Bàn KHÔNG tự cài luật: mọi xem trước ("sau đó ở km …, chở …") và lý do lỗi do type.sim.preview(puzzle, state, action) trả về; km đang chọn, số trong ô nhập, hộp xác nhận nộp là trạng thái GIAO DIỆN.
   Đầu vào trình soạn (type.fromInput): { mode: "far" | "deliver", B, C, D }.

   Chọn km: chạm / bấm / kéo trên trục (Pointer Events, touch-action: pan-y để vẫn cuộn dọc được), hoặc ô số "Đi tới km", hoặc bàn phím khi focus ở trục (role=slider):
   ← → ±1 · PageUp/PageDown ±10 · Home/End = A / cuối bản đồ · Enter = Đi tới. Ô nhập: Enter = thực hiện thao tác của ô đó. Giá trị tối ưu KHÔNG hiện sẵn (chỉ ở gợi ý mức ≥ 2 và hộp thoại kết thúc).
   Gợi ý: highlight(cells, "hint") tô các dòng kế hoạch (chỉ số bước) + vạch km trong game.lastHint.regions.positions + liệt kê các thao tác gợi ý sẽ thêm; replay: tô các dòng của chặng.
   Trợ năng: trục role=slider có aria-valuetext; mỗi dòng kế hoạch có aria-label (type.describeCell); dòng trạng thái và ghi chú xem trước aria-live; mọi nút ≥ 44 px, có chữ; hộp xác nhận nộp trả focus đúng chỗ. */
(function (root) {
  "use strict";
  var P = root.Puz, U = P.ui, h = U.h, icon = U.icon, doc = root.document;
  var uid = 0;
  var FOCUSABLE = "button, select, input, textarea, a[href]";

  function toInt(x) { if (typeof x === "string" && /^\s*-?\d+\s*$/.test(x)) x = Number(x); return typeof x === "number" && isFinite(x) && Math.floor(x) === x ? x : null; }
  function nf(n) { return P.grade.fmt(n, 0); }
  /** Chạy fn (vẽ lại một vùng bằng replaceChildren) mà không để focus rơi về BODY: nhớ vị trí phần tử đang focus trong root rồi focus lại phần tử cùng vị trí / láng giềng bật gần nhất. */
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
  /** Chọn các vạch số đẹp (bội của 1/2/5 × 10^n) cho trục 0…max, tối đa ~6 vạch. */
  function niceTicks(max) {
    var raw = max / 5, pow = Math.pow(10, Math.floor(Math.log(Math.max(raw, 1)) / Math.LN10)), step = pow;
    [1, 2, 5, 10].some(function (m) { step = m * pow; return raw <= step; });
    var out = [];
    for (var x = 0; x <= max; x += step) out.push(x);
    return out;
  }

  // ================================================================================================================ bàn chơi
  function mount(host, env) {
    var game = env.game, puzzle = env.puzzle, type = env.type, lib = type.lib, plan = P.plan, ro = !!env.readOnly, d = puzzle.data, C = d.C, mx = d.maxX, lay = lib.layoutOf();
    var tgt = Math.max(1, Math.min(mx, Math.round(mx / 8))), marks = {}, hintPos = [], hintOps = null, confirmOpen = false, offGame = null, dragging = false, base = "pz-cm-" + (++uid);
    var unit = d.mode === "far" ? "km" : "quả";

    // ---- thông số cố định
    var stats = h("div", { class: "pz-cm-stats", role: "group", "aria-label": "Đề bài" },
      h("span", { class: "pz-cm-stat", title: "Kho ở A (km 0)" }, h("b", { text: nf(d.B) }), " quả ở A"),
      h("span", { class: "pz-cm-stat", title: "Sức chở tối đa của lạc đà" }, "Chở tối đa ", h("b", { text: nf(C) })),
      h("span", { class: "pz-cm-stat", title: "Mỗi km đi — tới hay quay về — ăn 1 quả đang chở" }, "Ăn ", h("b", { text: "1" }), " quả/km (cả khi về)"),
      h("span", { class: "pz-cm-stat pz-cm-goal", title: d.mode === "far" ? "Giá trị = điểm xa A nhất lạc đà từng tới" : "Giá trị = số chuối có ở km " + d.D + " khi nộp (kho + phần đang chở nếu đứng ở đó)" },
        d.mode === "far" ? "Mục tiêu: đi xa nhất" : "Mục tiêu: nhiều chuối nhất ở km " + nf(d.D)));

    // ---- trục km (HTML định vị theo %, chữ không bị co theo bề rộng)
    var track = h("div", { class: "pz-cm-track", role: "slider", tabindex: ro ? null : "0", "aria-label": "Chọn km muốn đi tới (kéo, hoặc phím mũi tên)", "aria-valuemin": "0", "aria-valuemax": String(mx), "aria-valuenow": String(tgt), "aria-valuetext": "km " + tgt });
    if (ro) track.setAttribute("aria-readonly", "true");
    var layer = h("div", { class: "pz-cm-layer" });
    track.append(layer);
    var status = h("p", { class: "pz-cm-status", "aria-live": "polite" });
    var board = h("div", { class: "pz-cm-trackbox" }, track, status);

    // ---- điều khiển
    function numIn(label, ph, extra) { return h("input", Object.assign({ type: "number", inputmode: "numeric", class: "pz-cm-num", "aria-label": label, placeholder: ph || "", step: "1" }, extra || {})); }
    var loadIn = numIn("Số quả muốn lấy từ kho tại chỗ", "số quả", { min: "1" }), dropIn = numIn("Số quả muốn đặt xuống kho tại chỗ", "số quả", { min: "1" }), goIn = numIn("Km muốn đi tới", "km", { min: "0", max: String(mx), value: String(tgt) });
    var loadFull = h("button", { type: "button", class: "btn pz-cm-mini", text: "Đầy", title: "Lấy đến khi đầy sức chở hoặc hết kho" });
    var dropAll = h("button", { type: "button", class: "btn pz-cm-mini", text: "Hết", title: "Đặt xuống toàn bộ số đang chở" });
    var loadBtn = h("button", { type: "button", class: "btn pz-cm-act pz-cm-load", html: icon("plus") + "<span>Lấy</span>" });
    var dropBtn = h("button", { type: "button", class: "btn pz-cm-act pz-cm-drop", html: icon("minus") + "<span>Đặt</span>" });
    var goBtn = h("button", { type: "button", class: "btn btn-primary pz-cm-act pz-cm-go", html: icon("next") + "<span>Đi tới</span>" });
    var tripBtn = h("button", { type: "button", class: "btn pz-cm-act pz-cm-trip", html: icon("restart") + "<span>Chuyến tiếp tế</span>", title: "Lấy đầy, đi tới km đang chọn, đặt phần thừa (giữ đủ ăn để về), quay về chỗ cũ" });
    var runBtn = h("button", { type: "button", class: "btn pz-cm-act pz-cm-run", html: icon("last") + "<span>Đi hết sức</span>", title: "Lấy đầy và đi thẳng về phía trước đến khi hết chuối ăn dọc đường" });
    var notes = { load: h("p", { class: "pz-cm-note", id: base + "-nl", "aria-live": "polite" }), drop: h("p", { class: "pz-cm-note", id: base + "-nd", "aria-live": "polite" }), go: h("p", { class: "pz-cm-note", id: base + "-ng", "aria-live": "polite" }),
      trip: h("p", { class: "pz-cm-note", id: base + "-nt", "aria-live": "polite" }), run: h("p", { class: "pz-cm-note", id: base + "-nr", "aria-live": "polite" }) };
    loadBtn.setAttribute("aria-describedby", notes.load.id); dropBtn.setAttribute("aria-describedby", notes.drop.id); goBtn.setAttribute("aria-describedby", notes.go.id); tripBtn.setAttribute("aria-describedby", notes.trip.id); runBtn.setAttribute("aria-describedby", notes.run.id);
    function row(lab, inp, extra, btn, note) { return h("div", { class: "pz-cm-ctl" }, h("span", { class: "pz-cm-lab" }, lab), h("div", { class: "pz-cm-line" }, inp, extra, btn), note); }
    var controls = ro ? null : h("div", { class: "pz-cm-controls", role: "group", "aria-label": "Thao tác" },
      row("Lấy từ kho tại chỗ", loadIn, loadFull, loadBtn, notes.load), row("Đặt xuống kho tại chỗ", dropIn, dropAll, dropBtn, notes.drop), row("Đi tới km", goIn, null, goBtn, notes.go),
      h("div", { class: "pz-cm-ctl pz-cm-quick" }, h("span", { class: "pz-cm-lab", text: "Nhanh" }), h("div", { class: "pz-cm-line" }, tripBtn, runBtn), notes.trip, notes.run));

    // ---- kế hoạch
    var planList = h("ol", { class: "pz-cm-plan", "aria-label": "Kế hoạch" });
    var planCount = h("b", { text: "0" });
    var ghost = h("p", { class: "pz-cm-ghost", hidden: true, "aria-live": "polite" });
    var submitBtn = h("button", { type: "button", class: "btn btn-primary pz-cm-act pz-cm-submit", html: icon("check") + "<span>Nộp kế hoạch…</span>", "aria-expanded": "false" });
    var clearBtn = h("button", { type: "button", class: "btn pz-cm-act pz-cm-clear", html: icon("trash") + "<span>Xoá kế hoạch</span>" });
    var reopenBtn = h("button", { type: "button", class: "btn pz-cm-act pz-cm-reopen", html: icon("undo") + "<span>Mở lại để sửa</span>", hidden: true });
    var confirmBox = h("section", { class: "pz-cm-confirm", hidden: true, role: "group", "aria-label": "Xác nhận nộp" });
    var planBox = h("section", { class: "pz-cm-planbox" }, h("h3", { class: "pz-cm-h" }, "Kế hoạch (", planCount, " / " + lib.CAP + " thao tác)"), planList, ghost, ro ? null : h("div", { class: "pz-cm-actions" }, submitBtn, clearBtn, reopenBtn), ro ? null : confirmBox);
    var zig = h("div", { class: "pz-cm-zig" });
    var zigBox = h("details", { class: "pz-cm-zigbox" }, h("summary", { text: "Đường đi (ngang = km, xuống = từng bước)" }), zig);

    host.replaceChildren(h("div", { class: "pz-cm" }, stats, board, controls, planBox, zigBox));

    // ---- trạng thái dẫn xuất
    function canAct() { return !ro && !game.finished() && game.status !== "paused"; }
    function submitted() { return plan.isSubmitted(game.state); }
    function view() { var v = type.sim.view(puzzle, game.state); return v.ok ? v.view : { pos: 0, load: 0, far: 0, value: 0, depots: [{ x: 0, n: d.B }] }; }
    function depotAt(v, x) { for (var i = 0; i < v.depots.length; i++) if (v.depots[i].x === x) return v.depots[i].n; return 0; }
    function pct(x) { return (mx > 0 ? x / mx * 100 : 0) + "%"; }
    function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
    function afterText(a) { return "ở km " + a.pos + ", chở " + a.load + "/" + C + ", kho tại đây " + depotAt(a, a.pos) + (d.mode === "far" ? ", đã tới xa nhất km " + a.far : ", có " + nf(a.value) + " quả ở km " + nf(d.D)); }
    function prev(action) { return type.sim.preview(puzzle, game.state, action); }
    function nVal(inp) { return toInt(inp.value); }

    // ---- vẽ trục
    function drawTrack() {
      var v = view(), kids = [], maxDep = 1, lastLab = -99, i;
      v.depots.forEach(function (z) { if (z.n > maxDep) maxDep = z.n; });
      kids.push(h("div", { class: "pz-cm-ground" }));
      niceTicks(mx).forEach(function (x) { kids.push(h("span", { class: "pz-cm-tick", style: "left:" + pct(x), text: String(x) }), h("i", { class: "pz-cm-tickmark", style: "left:" + pct(x) })); });
      if (d.mode === "deliver") kids.push(h("div", { class: "pz-cm-dest" + (d.D / mx > 0.55 ? " flip" : ""), style: "left:" + pct(d.D) }, h("span", { text: "D · km " + nf(d.D) })));
      kids.push(h("div", { class: "pz-cm-flag", style: "left:0%" }, h("span", { text: "A" })));
      hintPos.forEach(function (x) { if (x >= 0 && x <= mx) kids.push(h("div", { class: "pz-cm-hintpos" + (x / mx > 0.55 ? " flip" : ""), style: "left:" + pct(x), title: "Gợi ý: km " + x }, h("span", { text: "km " + x }))); });
      if (!ro) kids.push(h("div", { class: "pz-cm-target" + (tgt / mx > 0.55 ? " flip" : ""), style: "left:" + pct(tgt), "aria-hidden": "true" }, h("span", { text: "→ " + tgt })));
      v.depots.forEach(function (z) {
        var hgt = 14 + 52 * z.n / maxDep, showLab = (z.x - lastLab) / Math.max(1, mx) >= 0.045 || z.x === v.pos;
        if (showLab) lastLab = z.x;
        kids.push(h("div", { class: "pz-cm-depot" + (z.x === v.pos ? " here" : ""), style: "left:" + pct(z.x) + ";--h:" + hgt + "px", title: "Kho km " + z.x + ": " + nf(z.n) + " quả" }, showLab ? h("span", { class: "pz-cm-dn", text: nf(z.n) }) : null));
      });
      kids.push(h("div", { class: "pz-cm-camel", style: "left:" + pct(v.pos) }, h("span", { class: "pz-cm-emoji", "aria-hidden": "true", text: "🐪" }), h("span", { class: "pz-cm-cload", text: v.load + "/" + C })));
      layer.replaceChildren.apply(layer, kids);
      track.setAttribute("aria-valuenow", String(tgt)); track.setAttribute("aria-valuetext", "km " + tgt);
      var depotsText = v.depots.length ? v.depots.map(function (z) { return "km " + z.x + ": " + nf(z.n) + " quả"; }).join("; ") : "không còn kho nào";
      setText(status, "Lạc đà ở km " + v.pos + " · chở " + v.load + "/" + C + " · " + (d.mode === "far" ? "đã tới xa nhất km " + v.far : nf(v.value) + " quả ở km " + nf(d.D)) + " · kho: " + depotsText + ".");
    }
    function drawZig() {
      var recs = plan.read(game.state, lay), sim = lib.newSim(d), pts = [[0, 0]], row = 0, w = 100, hh = Math.max(40, Math.min(220, 8 * (recs.length + 2)));
      recs.forEach(function (r) { var why = lib.stepSim(d, sim, r[1], r[2]); if (why) return; row++; if (r[1] === lib.OP_GO) pts.push([sim.pos, row]); });
      var NS = "http://www.w3.org/2000/svg", s = doc.createElementNS(NS, "svg");
      s.setAttribute("viewBox", "0 0 " + w + " " + hh); s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("class", "pz-cm-zigsvg"); s.setAttribute("role", "img");
      s.setAttribute("aria-label", "Đường đi của lạc đà: " + (pts.length - 1) + " lần di chuyển"); s.style.height = hh + "px";
      var pl = doc.createElementNS(NS, "polyline");
      pl.setAttribute("points", pts.map(function (q) { return (mx > 0 ? q[0] / mx * w : 0).toFixed(2) + "," + (row > 0 ? 4 + q[1] / row * (hh - 8) : 4).toFixed(2); }).join(" ")); pl.setAttribute("class", "pz-cm-zigline"); pl.setAttribute("vector-effect", "non-scaling-stroke");
      s.append(pl); zig.replaceChildren(s);
    }
    // ---- kế hoạch
    function drawPlan() {
      var recs = plan.read(game.state, lay), sim = lib.newSim(d), kids = [], sub = submitted();
      recs.forEach(function (r, i) {
        lib.stepSim(d, sim, r[1], r[2]);
        var txt = type.describeCell(puzzle, game.state, i), li = h("li", { class: "pz-cm-step" + (marks[i] === "hint" ? " hint" : marks[i] === "replay" ? " replay" : ""), "aria-label": txt + ". Sau bước này: ở km " + sim.pos + ", chở " + sim.load },
          h("span", { class: "pz-cm-stext", text: txt.replace(/^Bước \d+: /, "") }), h("span", { class: "pz-cm-safter", text: "→ km " + sim.pos + " · chở " + sim.load }));
        if (!ro && i < recs.length - 1) li.append(h("button", { type: "button", class: "btn pz-cm-cut", "aria-label": "Quay kế hoạch về sau bước " + (i + 1) + " (bỏ " + (recs.length - 1 - i) + " bước sau)", title: "Giữ tới bước " + (i + 1) + ", bỏ các bước sau", dataset: { n: String(i + 1) }, text: "↩ Giữ tới đây", disabled: canAct() ? null : true, on: { click: function () { doTruncate(i + 1); } } }));
        kids.push(li);
      });
      if (!kids.length) kids.push(h("li", { class: "pz-cm-empty faint", text: "Chưa có thao tác nào. Lấy chuối từ kho, đi, đặt kho trung gian…" }));
      planList.replaceChildren.apply(planList, kids);
      setText(planCount, String(recs.length));
      if (hintOps && hintOps.length) { ghost.hidden = false; setText(ghost, "Gợi ý sẽ thêm: " + hintOps.map(function (o) { return o.op === "go" ? "đi tới km " + o.n : o.op === "load" ? "lấy " + o.n : "đặt " + o.n; }).join(" → ") + "."); }
      else { ghost.hidden = true; setText(ghost, ""); }
      var wantSub = !ro && canAct() && recs.length >= 1 && !sub;
      if (!ro) { submitBtn.disabled = !wantSub; clearBtn.disabled = !canAct() || !recs.length; reopenBtn.hidden = !sub || game.finished(); }
    }
    function drawConfirm() {
      if (ro) return;
      confirmBox.hidden = !(confirmOpen && canAct() && !submitted()); submitBtn.setAttribute("aria-expanded", String(!confirmBox.hidden));
      if (confirmBox.hidden) { confirmBox.replaceChildren(); return; }
      if (confirmBox.childNodes.length) return;
      var v = view();
      confirmBox.append(h("p", { class: "pz-cm-cp", text: "Nộp kế hoạch hiện tại: " + (d.mode === "far" ? "đi xa nhất km " + v.far : nf(v.value) + " quả ở km " + nf(d.D)) + ". Nộp xong ván kết thúc và được chấm so với mức tối ưu." }),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary pz-cm-ok", text: "Nộp", on: { click: doSubmit } }), h("button", { type: "button", class: "btn pz-cm-back", text: "Xem lại", on: { click: function () { closeConfirm(true); } } })));
    }
    // ---- xem trước + trạng thái nút
    function noteOf(key, res, okText) {
      var el = notes[key]; el.classList.toggle("bad", !res.ok && !res.soft);
      setText(el, res.ok ? okText + afterText(res.after) + "." : res.error || "");
    }
    function drawControls() {
      if (ro) return;
      var act = canAct(), v = view(), here = depotAt(v, v.pos), room = C - v.load, x = nVal(goIn), n1 = nVal(loadIn), n2 = nVal(dropIn), res;
      loadFull.disabled = !act || !(Math.min(room, here) > 0); dropAll.disabled = !act || v.load < 1;
      res = n1 == null || n1 < 1 ? { ok: false, soft: true, error: "Nhập số quả muốn lấy (kho tại đây có " + here + ", còn chỗ chở " + room + ")." } : prev({ k: "load", n: n1 }); noteOf("load", res, "Sau khi lấy: "); loadBtn.disabled = !act || !res.ok;
      res = n2 == null || n2 < 1 ? { ok: false, soft: true, error: "Nhập số quả muốn đặt (đang chở " + v.load + ")." } : prev({ k: "drop", n: n2 }); noteOf("drop", res, "Sau khi đặt: "); dropBtn.disabled = !act || !res.ok;
      res = x == null ? { ok: false, soft: true, error: "Nhập km muốn đi tới (0–" + mx + ")." } : prev({ k: "go", x: x }); noteOf("go", res, "Sau khi đi: "); goBtn.disabled = !act || !res.ok;
      res = x == null ? { ok: false, error: "Nhập km (ô 'Đi tới') hoặc chọn trên trục." } : prev({ k: "trip", to: x }); noteOf("trip", res, "Chuyến tiếp tế tới km " + x + ", sau đó: "); tripBtn.disabled = !act || !res.ok;
      res = prev({ k: "run" }); noteOf("run", res, "Đi hết sức, sau đó: "); runBtn.disabled = !act || !res.ok;
      tripBtn.querySelector("span").textContent = "Chuyến tiếp tế tới km " + (x == null ? "…" : x);
    }
    function drawAll() { drawTrack(); drawPlan(); drawControls(); drawConfirm(); drawZig(); }

    // ---- thao tác
    function keepAfter(fn) {
      var a0 = doc.activeElement, had = !!a0 && host.contains(a0);
      fn();
      if (!had) return;
      var b = doc.activeElement;
      if (b && b !== doc.body && !host.contains(b)) return;
      if (b && b !== doc.body && !b.disabled && !(b.closest && b.closest("[hidden]"))) return;
      var t = (!goIn.disabled && goIn) || track; if (t && t.focus) t.focus({ preventScroll: true });
    }
    function run(action, say) {
      if (!canAct()) return;
      keepAfter(function () { var r = game.act(action); if (r.ok && say) env.announce(say()); });
    }
    function doLoad() { var n = nVal(loadIn); if (n != null) run({ k: "load", n: n }, function () { return "Lấy " + n + " quả. " + status.textContent; }); }
    function doDrop() { var n = nVal(dropIn); if (n != null) run({ k: "drop", n: n }, function () { return "Đặt " + n + " quả. " + status.textContent; }); }
    function doGo() { var x = nVal(goIn); if (x != null) run({ k: "go", x: x }, function () { return "Đi tới km " + x + ". " + status.textContent; }); }
    function doTrip() { var x = nVal(goIn); if (x != null) run({ k: "trip", to: x }, function () { return "Chuyến tiếp tế tới km " + x + ". " + status.textContent; }); }
    function doRun() { run({ k: "run" }, function () { return "Đi hết sức. " + status.textContent; }); }
    function doTruncate(n) { run({ k: "truncate", n: n }, function () { return "Quay kế hoạch về sau bước " + n + "."; }); }
    function doSubmit() { if (!canAct()) return; confirmOpen = false; keepAfter(function () { var r = game.act({ k: "submit" }); if (r.ok) env.announce("Đã nộp kế hoạch."); }); }
    function closeConfirm(focus) { confirmOpen = false; drawConfirm(); if (focus) submitBtn.focus({ preventScroll: true }); }
    function setTarget(x, fromInput) {
      x = Math.max(0, Math.min(mx, x));
      if (x === tgt && !fromInput) return;
      tgt = x; if (!fromInput && goIn.value !== String(x)) goIn.value = String(x);
      drawTrack(); drawControls();
    }

    // ---- sự kiện
    function kmOfPointer(e) { var r = layer.getBoundingClientRect(), w = Math.max(1, r.width); return Math.round((e.clientX - r.left) / w * mx); }
    if (!ro) {
      track.addEventListener("pointerdown", function (e) { if (!canAct() || (e.button != null && e.button > 0)) return; dragging = true; try { track.setPointerCapture(e.pointerId); } catch (x) { /* thôi */ } setTarget(kmOfPointer(e)); });
      track.addEventListener("pointermove", function (e) { if (dragging) setTarget(kmOfPointer(e)); });
      track.addEventListener("pointerup", function (e) { dragging = false; try { track.releasePointerCapture(e.pointerId); } catch (x) { /* thôi */ } });
      track.addEventListener("pointercancel", function () { dragging = false; });
      track.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var k = e.key, STEP = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
        if (Object.prototype.hasOwnProperty.call(STEP, k)) { e.preventDefault(); setTarget(tgt + STEP[k]); return; }
        if (k === "Home") { e.preventDefault(); setTarget(0); return; }
        if (k === "End") { e.preventDefault(); setTarget(mx); return; }
        if (k === "Enter") { e.preventDefault(); doGo(); }
      });
      [[loadIn, doLoad], [dropIn, doDrop], [goIn, doGo]].forEach(function (pr) { pr[0].addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); pr[1](); } }); });
      goIn.addEventListener("input", function () { var x = nVal(goIn); if (x != null && x >= 0 && x <= mx) { tgt = x; drawTrack(); } drawControls(); });
      loadIn.addEventListener("input", drawControls); dropIn.addEventListener("input", drawControls);
      loadBtn.addEventListener("click", doLoad); dropBtn.addEventListener("click", doDrop); goBtn.addEventListener("click", doGo); tripBtn.addEventListener("click", doTrip); runBtn.addEventListener("click", doRun);
      loadFull.addEventListener("click", function () { var v = view(); loadIn.value = String(Math.max(0, Math.min(C - v.load, depotAt(v, v.pos)))); drawControls(); loadIn.focus({ preventScroll: true }); });
      dropAll.addEventListener("click", function () { var v = view(); dropIn.value = String(v.load); drawControls(); dropIn.focus({ preventScroll: true }); });
      submitBtn.addEventListener("click", function () { if (!canAct()) return; confirmOpen = !confirmOpen; drawConfirm(); if (confirmOpen) { var ok = confirmBox.querySelector(".pz-cm-ok"); if (ok) ok.focus({ preventScroll: true }); } });
      confirmBox.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeConfirm(true); } });
      clearBtn.addEventListener("click", function () { doTruncate(0); });
      reopenBtn.addEventListener("click", function () { run({ k: "truncate", n: plan.count(game.state) }, function () { return "Đã mở lại kế hoạch."; }); });
    }
    offGame = game.on(function (ev) {
      if (ev.type === "change") {
        confirmOpen = false;
        hintPos = []; hintOps = null; marks = {};
        var v = view(); if (nVal(loadIn) != null && nVal(loadIn) > Math.min(C - v.load, depotAt(v, v.pos))) loadIn.value = "";
        drawAll();
      } else if (ev.type === "status") { drawPlan(); drawControls(); drawConfirm(); }
      else if (ev.type === "hint") { var hh = ev.hint; hintPos = hh && hh.regions && hh.regions.positions ? hh.regions.positions.slice() : []; hintOps = hh && hh.action && hh.action.k === "steps" ? hh.action.ops : null; drawTrack(); drawPlan(); }
    });
    drawAll();

    return {
      destroy: function () { if (offGame) offGame(); offGame = null; host.replaceChildren(); },
      refresh: function () { confirmOpen = false; hintPos = []; hintOps = null; marks = {}; drawAll(); },
      highlight: function (list, kind) {
        marks = {};
        if (list && list.length && kind) list.forEach(function (j) { marks[j] = kind; });
        if (!kind || !list || !list.length) { hintPos = []; hintOps = null; }
        else if (kind === "hint" && game.lastHint) { var hh = game.lastHint; hintPos = hh.regions && hh.regions.positions ? hh.regions.positions.slice() : []; hintOps = hh.action && hh.action.k === "steps" ? hh.action.ops : null; }
        drawTrack(); drawPlan();
      },
      focus: function () { (track.getAttribute("tabindex") ? track : host).focus({ preventScroll: true }); }
    };
  }

  // ================================================================================================================ trình soạn
  /** Trình soạn (màn Tạo puzzle): chọn bài (đi xa nhất / chở tới D), nhập B, C, D (ô số + nút mẫu); mỗi thay đổi gọi env.onChange({ mode, B, C, D }). Dòng kết quả (tối ưu rời rạc, liên tục) tính tại chỗ bằng type.fromInput. */
  function editor(host, env) {
    var type = env.type, st = { mode: "far", B: 3000, C: 1000, D: 1000 };
    var inp = env.input, pz = env.puzzle, src = inp && typeof inp === "object" && (inp.B != null || inp.C != null) ? inp : pz && pz.data ? pz.data : null;
    if (src) {
      var b0 = toInt(src.B), c0 = toInt(src.C), d0 = toInt(src.D);
      if (src.mode === "far" || src.mode === "deliver") st.mode = src.mode;
      if (b0 != null) st.B = b0; if (c0 != null) st.C = c0; if (d0 != null && d0 > 0) st.D = d0;
    }
    var body = h("div", { class: "pz-cm pz-cm-ed" }), info = h("p", { class: "pz-cm-edinfo", "aria-live": "polite" }), samples = [{ label: "Kinh điển 3000 / 1000", mode: "far", B: 3000, C: 1000, D: 1000 }, { label: "Gọn 45 / 15", mode: "far", B: 45, C: 15, D: 15 }, { label: "Tới đích 3000 / 1000 → km 1000", mode: "deliver", B: 3000, C: 1000, D: 1000 }];
    function input() { return { mode: st.mode, B: st.B, C: st.C, D: st.mode === "deliver" ? st.D : 0 }; }
    function emit() { env.onChange(input()); }
    function setInfo() {
      var r;
      try { r = type.fromInput(input()); } catch (e) { r = { ok: false, errors: ["Lỗi tính: " + e.message] }; }
      info.textContent = r.ok ? r.statusText + (r.warnings.length ? " — " + r.warnings[0] : "") : (r.errors[0] || "Đề chưa hợp lệ.");
      info.className = "pz-cm-edinfo " + (r.ok ? (r.statusKind === "warn" ? "warn" : "good") : "bad");
    }
    function field(label, ctrl, hint) { return h("div", { class: "pz-cm-field" }, h("span", { class: "pz-cm-flab", text: label }), ctrl, hint ? h("p", { class: "pz-cm-fhint faint", text: hint }) : null); }
    function numField(label, key, min, max, hint) {
      var el = h("input", { type: "number", inputmode: "numeric", class: "pz-cm-num", "aria-label": label, min: String(min), max: String(max), step: "1", value: String(st[key]) });
      el.addEventListener("input", function () { var v = toInt(el.value); if (v != null) { st[key] = v; emit(); } setInfo(); });
      return field(label, el, hint);
    }
    function render() {
      var chips = U.pz.chips, kids = [
        field("Bài toán", chips([{ id: "far", label: "Đi xa nhất" }, { id: "deliver", label: "Chở tới đích D" }], st.mode, function (id) { st.mode = id; keepFocus(body, render); emit(); }, "Bài toán")),
        numField("Chuối ở kho A (B)", "B", 1, type.lib.MAX_B, "Tối đa " + nf(type.lib.MAX_B) + " quả."),
        numField("Sức chở (C)", "C", 1, type.lib.MAX_C, "Tối đa " + nf(type.lib.MAX_C) + " quả; B/C ≤ " + type.lib.MAX_K + " (kế hoạch tối ưu phải vừa " + type.lib.CAP + " thao tác).")];
      if (st.mode === "deliver") kids.push(numField("Đích D (km)", "D", 1, type.lib.MAX_X, "Phải nhỏ hơn quãng xa nhất có thể đi."));
      kids.push(h("div", { class: "pz-cm-samples", role: "group", "aria-label": "Mẫu có sẵn" }, samples.map(function (sm) { return h("button", { type: "button", class: "btn", text: sm.label, on: { click: function () { st.mode = sm.mode; st.B = sm.B; st.C = sm.C; st.D = sm.D; keepFocus(body, render); emit(); } } }); })));
      kids.push(info, h("p", { class: "pz-cm-tip faint", text: "Ví dụ kinh điển: 3000 quả, sức chở 1000, đi xa nhất: liên tục 1 533 1/3 km nhưng vì dừng ở km nguyên chỉ 1 533. Đề tự nhập luôn chấm theo tối ưu rời rạc (km nguyên, chuối nguyên quả)." }));
      body.replaceChildren.apply(body, kids);
      setInfo();
    }
    host.replaceChildren(body); render(); emit();
    return { getInput: function () { return input(); }, destroy: function () { host.replaceChildren(); } };
  }

  P.boards = P.boards || {};
  P.boards.camel = { mount: mount, editor: editor };
})(typeof globalThis !== "undefined" ? globalThis : this);
