/* Engine Wukong cho "Cờ tướng mỗi ngày": tìm nước tốt nhất trong một thế cờ mà
   không làm đơ trang. Nhận {id, vong, moves: "h2e2 h9g7 …", ms} — các nước từ
   thế khai cuộc và thời gian nghĩ; trả {id, vong, move: "b0c2"} ("" khi không có). */
importScripts("../../engine/wukong.js");

var engine = new Engine();

self.onmessage = function (event) {
  var d = event.data || {};
  var move = 0;
  try {
    engine.setBoard(engine.START_FEN);
    if (d.moves) engine.loadMoves(d.moves);
    var timing = engine.getTimeControl();
    timing.timeSet = 1;
    timing.stopped = 0;
    timing.time = Math.max(200, Math.min(5000, +d.ms || 1500));
    timing.stopTime = Date.now() + timing.time;
    engine.setTimeControl(timing);
    move = engine.search(64);
  } catch (e) {
    move = 0;
  }
  self.postMessage({ id: d.id, vong: d.vong, move: move ? engine.moveToString(move) : "" });
};
