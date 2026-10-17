/* graph-worker.js — chạy bố cục đồ thị ngoài luồng giao diện (Web Worker). Nhận {type:"init", nodes, edges, center} và liên tục gửi
   {type:"pos", x, y, iter, move, done} (mảng Float64 chuyển quyền sở hữu, không sao chép) cho tới khi nút gần như đứng yên. */
"use strict";
importScripts("text.js", "graph.js");
var state = null, timer = 0, MAX_ITER = 450, SLICE = 3;

function loop() {
  if (!state) return;
  var move = self.Wiki.graph.run(state, SLICE), done = move < 0.6 || state.iter >= MAX_ITER, x = state.x.slice(), y = state.y.slice();
  self.postMessage({ type: "pos", x: x, y: y, iter: state.iter, move: move, done: done }, [x.buffer, y.buffer]);
  if (!done) timer = setTimeout(loop, 0);
}

self.onmessage = function (e) {
  var m = e.data;
  clearTimeout(timer);
  if (m.type === "init") { state = self.Wiki.graph.init(m.nodes, m.edges, { centerIndex: m.center }); loop(); }
  else if (m.type === "wake" && state) { state.iter = Math.min(state.iter, 200); loop(); }
  else if (m.type === "stop") state = null;
};
