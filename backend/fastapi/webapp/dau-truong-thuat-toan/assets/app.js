/* ==========================================================================
   ĐẤU TRƯỜNG THUẬT TOÁN — viết heuristic cho bài toán người du lịch.

   Mã của người chơi chạy trong một Web Worker (không chạm được trang hay
   localStorage; quá 10 giây thì bị huỷ) trên đúng các thành phố máy chủ gửi
   (GET /arena/problems/<đề>). Nộp bài gửi CHU TRÌNH, không gửi độ dài: máy chủ
   dựng lại đề từ hạt giống, kiểm đó là một hoán vị, tự đo, rồi xếp hạng.
   Mã mỗi đề và tên người chơi cất trên máy này.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var cfg = window.__WEBAPP_CONFIG__ || {};
  var API = (typeof cfg.apiBase === "string" ? cfg.apiBase : "").replace(/\/+$/, "") + "/arena";
  var HAN_MS = 10000;

  function docLS(k, d) { try { var v = localStorage.getItem("dau-truong." + k); return v == null ? d : v; } catch (e) { return d; } }
  function ghiLS(k, v) { try { localStorage.setItem("dau-truong." + k, v); } catch (e) {} }

  /* sáng / tối: ?theme= một lần, rồi nút đổi */
  var qs = (location.search.match(/[?&]theme=(light|dark)/) || [])[1];
  if (qs) ghiLS("theme", qs);
  function apTheme() {
    var t = docLS("theme", "");
    if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
  }
  apTheme();
  $("#btnTheme").addEventListener("click", function () {
    var t = docLS("theme", ""), toi = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    ghiLS("theme", toi ? "light" : "dark");
    apTheme();
    ve();
  });

  var MAU = {
    "nn":
      "// diem: mảng {x, y} (0–999). Trả về một hoán vị các chỉ số 0…n−1:\n" +
      "// thứ tự đi qua các thành phố (cuối cùng tự quay về điểm đầu).\n" +
      "// Có sẵn: khoangCach(i, j), doDai(tour). Chạy trong Web Worker, tối đa 10 giây.\n" +
      "function giai(diem) {\n" +
      "  const n = diem.length, da = new Array(n).fill(false), tour = [0];\n" +
      "  da[0] = true;\n" +
      "  for (let k = 1; k < n; k++) {\n" +
      "    const cuoi = tour[tour.length - 1];\n" +
      "    let gan = -1, d = Infinity;\n" +
      "    for (let j = 0; j < n; j++) {\n" +
      "      if (!da[j] && khoangCach(cuoi, j) < d) { d = khoangCach(cuoi, j); gan = j; }\n" +
      "    }\n" +
      "    tour.push(gan);\n" +
      "    da[gan] = true;\n" +
      "  }\n" +
      "  return tour;\n" +
      "}\n",
    "2opt":
      "// Láng giềng gần nhất, rồi 2-opt: đảo một đoạn nếu hai cạnh mới ngắn hơn hai cạnh cũ.\n" +
      "function giai(diem) {\n" +
      "  const n = diem.length, da = new Array(n).fill(false), tour = [0];\n" +
      "  da[0] = true;\n" +
      "  for (let k = 1; k < n; k++) {\n" +
      "    const cuoi = tour[tour.length - 1];\n" +
      "    let gan = -1, d = Infinity;\n" +
      "    for (let j = 0; j < n; j++) if (!da[j] && khoangCach(cuoi, j) < d) { d = khoangCach(cuoi, j); gan = j; }\n" +
      "    tour.push(gan); da[gan] = true;\n" +
      "  }\n" +
      "  let caiThien = true;\n" +
      "  while (caiThien) {\n" +
      "    caiThien = false;\n" +
      "    for (let i = 0; i < n - 1; i++) {\n" +
      "      for (let k = i + 2; k < n; k++) {\n" +
      "        const a = tour[i], b = tour[i + 1], c = tour[k], e = tour[(k + 1) % n];\n" +
      "        if (a === e) continue;\n" +
      "        if (khoangCach(a, c) + khoangCach(b, e) < khoangCach(a, b) + khoangCach(c, e) - 1e-9) {\n" +
      "          for (let x = i + 1, y = k; x < y; x++, y--) { const t = tour[x]; tour[x] = tour[y]; tour[y] = t; }\n" +
      "          caiThien = true;\n" +
      "        }\n" +
      "      }\n" +
      "    }\n" +
      "  }\n" +
      "  return tour;\n" +
      "}\n",
    "ngau-nhien":
      "// Xáo ngẫu nhiên — cái mốc để thấy heuristic tốt hơn bao nhiêu.\n" +
      "function giai(diem) {\n" +
      "  const tour = diem.map((_, i) => i);\n" +
      "  for (let i = tour.length - 1; i > 0; i--) {\n" +
      "    const j = Math.floor(Math.random() * (i + 1));\n" +
      "    [tour[i], tour[j]] = [tour[j], tour[i]];\n" +
      "  }\n" +
      "  return tour;\n" +
      "}\n"
  };

  /* Worker: chạy hàm giai(diem) của người chơi, tách khỏi trang. */
  var MA_THO =
    "self.onmessage = function (e) {\n" +
    "  var diem = e.data.diem;\n" +
    "  function khoangCach(i, j) { var a = diem[i], b = diem[j]; return Math.hypot(a.x - b.x, a.y - b.y); }\n" +
    "  function doDai(t) { var s = 0; for (var i = 0; i < t.length; i++) s += khoangCach(t[i], t[(i + 1) % t.length]); return s; }\n" +
    "  var bat = Date.now();\n" +
    "  try {\n" +
    "    var giai = (new Function('diem', 'khoangCach', 'doDai',\n" +
    "      e.data.ma + '\\n;return typeof giai === \"function\" ? giai : null;'))(diem, khoangCach, doDai);\n" +
    "    if (!giai) throw new Error('Mã chưa có hàm giai(diem)');\n" +
    "    var tour = giai(diem.map(function (p) { return { x: p.x, y: p.y }; }), khoangCach, doDai);\n" +
    "    self.postMessage({ ok: true, tour: Array.isArray(tour) ? tour : null, ms: Date.now() - bat });\n" +
    "  } catch (er) {\n" +
    "    self.postMessage({ ok: false, loi: (er && er.name ? er.name + ': ' : '') + (er && er.message || er) });\n" +
    "  }\n" +
    "};\n";

  var S = { de: [], id: null, diem: [], tour: null, doDai: 0, dangChay: false };
  var cv = $("#cv"), g = cv.getContext("2d");

  function goi(duong, body) {
    return fetch(API + duong, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.message || (typeof j.detail === "string" ? j.detail : "") || "HTTP " + r.status);
          return j;
        });
      });
  }

  function mau(ten) { return getComputedStyle(document.documentElement).getPropertyValue("--" + ten).trim(); }
  function ve() {
    var W = cv.width, k = (W - 40) / 1000;
    g.clearRect(0, 0, W, W);
    if (S.tour) {
      g.strokeStyle = mau("duong"); g.lineWidth = 1.6; g.beginPath();
      S.tour.forEach(function (i, n) {
        var p = S.diem[i], x = 20 + p.x * k, y = 20 + p.y * k;
        if (n) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.closePath(); g.stroke();
    }
    g.fillStyle = mau("diem");
    var r = S.diem.length > 300 ? 1.8 : 3;
    S.diem.forEach(function (p) { g.beginPath(); g.arc(20 + p.x * k, 20 + p.y * k, r, 0, Math.PI * 2); g.fill(); });
  }

  function hopLe(tour) {
    var n = S.diem.length;
    if (!Array.isArray(tour) || tour.length !== n) return "Kết quả phải là mảng " + n + " chỉ số (mỗi thành phố một lần)";
    var da = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      var v = tour[i];
      if (typeof v !== "number" || v % 1 !== 0 || v < 0 || v >= n || da[v]) return "Chỉ số " + JSON.stringify(v) + " sai hoặc lặp lại";
      da[v] = 1;
    }
    return "";
  }
  function doDai(tour) {
    var s = 0;
    for (var i = 0; i < tour.length; i++) {
      var a = S.diem[tour[i]], b = S.diem[tour[(i + 1) % tour.length]];
      s += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return s;
  }

  function inRa(html) { $("#ra").innerHTML = html; }
  function chay() {
    if (S.dangChay || !S.diem.length) return;
    S.dangChay = true;
    $("#btnChay").disabled = true; $("#btnNop").disabled = true;
    inRa("Đang chạy…");
    var w = new Worker(URL.createObjectURL(new Blob([MA_THO], { type: "text/javascript" })));
    var hen = setTimeout(function () {
      w.terminate(); xong();
      inRa('<span class="loi">Dừng sau ' + HAN_MS / 1000 + " giây — vòng lặp vô hạn, hoặc thuật toán quá chậm cho đề này.</span>");
    }, HAN_MS);
    function xong() { clearTimeout(hen); S.dangChay = false; $("#btnChay").disabled = false; }
    w.onmessage = function (e) {
      w.terminate(); xong();
      var d = e.data || {};
      if (!d.ok) { inRa('<span class="loi">' + esc(d.loi) + "</span>"); return; }
      var loi = hopLe(d.tour);
      if (loi) { inRa('<span class="loi">' + esc(loi) + "</span>"); return; }
      S.tour = d.tour.slice(); S.doDai = doDai(S.tour);
      ve();
      $("#so").innerHTML = "<span>Độ dài <b>" + S.doDai.toFixed(1) + "</b></span><span>Thời gian <b>" + d.ms + " ms</b></span>" +
        "<span>" + S.diem.length + " thành phố</span>";
      inRa('<span class="tot">✓ Hợp lệ — độ dài ' + S.doDai.toFixed(3) + ". Nộp để máy chủ đo lại và xếp hạng.</span>");
      $("#btnNop").disabled = false;
    };
    w.onerror = function (ev) {
      ev.preventDefault(); w.terminate(); xong();
      inRa('<span class="loi">' + esc(ev.message || "Lỗi trong mã") + "</span>");
    };
    w.postMessage({ ma: $("#ma").value, diem: S.diem });
  }

  function nop() {
    var ten = $("#ten").value.trim();
    if (!ten) { $("#ten").focus(); inRa('<span class="loi">Nhập tên để lên bảng xếp hạng.</span>'); return; }
    if (!S.tour) return;
    ghiLS("ten", ten);
    $("#btnNop").disabled = true;
    goi("/problems/" + S.id + "/submit", { name: ten, tour: S.tour }).then(function (r) {
      inRa('<span class="tot">Máy chủ đo: ' + r.score.toFixed(3) + " · hạng " + r.rank +
        (r.improved ? " · kỷ lục mới của bạn!" : " · chưa hơn kết quả cũ của bạn") + "</span>");
      taiBang();
    }, function (er) {
      inRa('<span class="loi">' + esc(er.message) + "</span>");
      $("#btnNop").disabled = false;
    });
  }

  function taiBang() {
    var id = S.id;
    goi("/problems/" + id + "/leaderboard").then(function (r) {
      if (id !== S.id) return;
      var ten = docLS("ten", "");
      $("#bang").innerHTML = r.rows.map(function (x) {
        return '<tr class="' + (x.name === ten ? "toi" : "") + '"><td>' + x.rank + "</td><td>" + esc(x.name) + "</td><td>" +
          x.score.toFixed(3) + "</td><td>" + new Date(x.updatedAt * 1000).toLocaleDateString("vi-VN") + "</td></tr>";
      }).join("") || '<tr><td colspan="4" class="goi-y">Chưa ai nộp — bạn là người đầu tiên.</td></tr>';
    }, function (er) {
      $("#bang").innerHTML = '<tr><td colspan="4" class="goi-y">Không tải được bảng xếp hạng: ' + esc(er.message) + "</td></tr>";
    });
  }

  function chonDe(id) {
    var de = S.de.filter(function (d) { return d.id === id; })[0];
    if (!de) return;
    S.id = id; S.tour = null; S.diem = [];
    Array.prototype.forEach.call(document.querySelectorAll("#dsDe button"), function (b) { b.classList.toggle("on", b.dataset.id === id); });
    $("#bangTen").textContent = "Bảng xếp hạng — " + de.title;
    $("#ma").value = docLS("ma." + id, MAU.nn);
    $("#btnNop").disabled = true;
    $("#so").innerHTML = "<span>Chưa chạy</span>";
    inRa("");
    ghiLS("de", id);
    goi("/problems/" + id).then(function (p) {
      if (S.id !== id) return;
      S.diem = p.points.map(function (q) { return { x: q[0], y: q[1] }; });
      ve();
    });
    taiBang();
  }

  $("#mau").addEventListener("change", function (e) {
    var cu = $("#ma").value.trim();
    if (cu && cu !== docLS("ma." + S.id, MAU.nn).trim() && !confirm("Thay mã đang soạn bằng mẫu?")) return;
    $("#ma").value = MAU[e.target.value];
    ghiLS("ma." + S.id, $("#ma").value);
  });
  $("#ma").addEventListener("input", function () { ghiLS("ma." + S.id, $("#ma").value); });
  $("#ma").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); chay(); }
    else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      var t = e.target, a = t.selectionStart;
      t.setRangeText("  ", a, t.selectionEnd, "end");
      ghiLS("ma." + S.id, t.value);
    }
  });
  $("#btnChay").addEventListener("click", chay);
  $("#btnNop").addEventListener("click", nop);
  $("#btnTai").addEventListener("click", taiBang);
  $("#ten").value = docLS("ten", "");

  goi("/problems").then(function (r) {
    S.de = r.problems;
    $("#dsDe").innerHTML = S.de.map(function (d) {
      return '<button type="button" data-id="' + esc(d.id) + '">' + esc(d.title) + "</button>";
    }).join("");
    $("#dsDe").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-id]");
      if (b) chonDe(b.dataset.id);
    });
    var cu = docLS("de", "");
    chonDe(S.de.some(function (d) { return d.id === cu; }) ? cu : S.de[0].id);
  }, function (er) {
    inRa('<span class="loi">Không tải được danh sách đề: ' + esc(er.message) + "</span>");
  });
})();
