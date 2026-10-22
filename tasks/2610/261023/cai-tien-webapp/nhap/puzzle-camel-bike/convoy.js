// convoy.js — mô phỏng CHÍNH XÁC (số nguyên) chiến lược đoàn lạc đà cho N lớn: kiểm khả thi (không âm, ≤ C) và đạt công thức.
"use strict";
function lcm(a, b) { function g(x, y) { return y ? g(y, x % y) : x; } return a / g(a, b) * b; }
function sim(N, C, ret) {
  // camels: {x, load, home}; depots: map x->amount
  var cam = [], i, j, dep = {}, log = [];
  for (i = 0; i < N; i++) cam.push({ x: 0, load: C });
  function need(c) { if (c.load < 0 || c.load > C) throw new Error("vi phạm tải: " + c.load); }
  var alive = cam.slice(), x = 0, returned = 0;
  for (j = 1; j <= N; j++) {
    var delta = ret ? C / (2 * (N - j) + 1) : C / (N - j + 1);
    if (delta !== Math.floor(delta)) throw new Error("C không chia hết");
    alive.forEach(function (c) { c.load -= delta; c.x += delta; need(c); });
    x += delta;
    if (j === N) break;
    var sup = alive.shift();           // con hỗ trợ j quay đầu
    var cont = alive.length;
    alive.forEach(function (c) { var t = C - c.load; sup.load -= t; c.load += t; need(c); });
    if (ret) {
      var later = N - 1 - j;            // số con hỗ trợ sẽ quay về sau đi qua điểm này
      sup.load -= later * delta; dep[x] = later * delta; need(sup);
      // con hỗ trợ j quay về: mỗi đoạn lùi dùng kho đã để lại ở điểm trước
      var pos = x, path = [];
      for (var k = j; k >= 1; k--) {
        var dk = C / (2 * (N - k) + 1);
        if (k < j) { var px = pos; sup.load += dk; dep[px] -= dk; if (dep[px] < 0) throw new Error("kho âm"); }
        sup.load -= dk; pos -= dk; need(sup);
      }
      if (pos !== 0 || sup.load !== 0) throw new Error("về A sai: pos=" + pos + " load=" + sup.load);
      returned++;
    } else { if (sup.load !== 0) throw new Error("dư " + sup.load); }
    log.push("x=" + x + ": con " + j + (ret ? " quay về" : " dừng") + ", " + cont + " con đi tiếp đầy " + C);
  }
  return { far: x, log: log, returned: returned };
}
function H(N) { var s = 0; for (var i = 1; i <= N; i++) s += 1 / i; return s; }
function ODD(N) { var s = 0; for (var i = 1; i <= N; i++) s += 1 / (2 * i - 1); return s; }
[[2, 6], [3, 6], [4, 12], [5, 60], [6, 60]].forEach(function (r) { var o = sim(r[0], r[1], false); console.log("V2a N=" + r[0] + " C=" + r[1] + ": xa nhất " + o.far + " = C·H_N " + (r[1] * H(r[0])).toFixed(4) + " | " + o.log.join("; ")); });
[[2, 3], [3, 15], [4, 105], [5, 315]].forEach(function (r) { var o = sim(r[0], r[1], true); console.log("V2b N=" + r[0] + " C=" + r[1] + ": xa nhất " + o.far + " = C·ΣOdd " + (r[1] * ODD(r[0])).toFixed(4) + ", " + o.returned + " con đã về A | " + o.log.join("; ")); });
