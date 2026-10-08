/* ==========================================================================
   KHOÁ LUYỆN THI OPIc — giao diện. Ứng dụng một trang, không build.

   Nạp theo đúng thứ tự:  ① logic.js (tính toán, OPICL)  ② app.js (file này)
   Nội dung KHÔNG nằm trong trang: nó ở database như mọi khoá khác. Lúc mở,
   trang tải GET /courses/opic/bundle (≈ 250 KB, gzip ≈ 60 KB — đủ nhỏ để tải
   một lần, vì thẻ luyện và đề thi thử cần toàn bộ kho script) rồi đổi về dạng
   riêng bằng OPICL.tuBundle. Có window.OPIC (một content.js offline) thì dùng nó.
   Mọi trạng thái người học nằm trong localStorage (tiền tố "opic.") và
   IndexedDB ("opic-ghi-am" cho các bản ghi âm). Không tài khoản.
   ========================================================================== */
(function () {
"use strict";

var L = window.OPICL;
var KHOA_HOC = "opic";                     /* slug của khoá trong database */
var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};
var icon = function (n, cls) {
  return '<svg class="ic ' + esc(cls || "") + '"><use href="#i-' + String(n || "").replace(/[^a-z0-9-]/gi, "") + '"/></svg>';
};

/* ---------- 0. Nạp nội dung ------------------------------------------
   Gốc API: ?api=… > cấu hình FastAPI chèn vào trang > cùng origin. Chuỗi rỗng
   là câu trả lời hợp lệ ("cùng origin"), nên so bằng typeof, không bằng truthy.
   ?api= chỉ được nghe khi API ở máy cục bộ (localhost, 127.0.0.1, [::1]) hoặc
   trang mở từ file:// — một đường link trỏ ?api= ra máy chủ lạ bị bỏ qua. */
function apiTuDiaChi() {
  var q = (location.search.match(/[?&]api=([^&]+)/) || [])[1];
  if (!q) return null;
  var u;
  try { u = new URL(decodeURIComponent(q)); } catch (e) { return null; }
  var cucBo = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
  if ((u.protocol === "http:" || u.protocol === "https:") && (cucBo || location.protocol === "file:")) {
    return (u.origin + u.pathname).replace(/\/+$/, "");
  }
  if (window.console) console.warn("Bỏ qua ?api=" + u.origin + ": chỉ nhận API ở máy cục bộ hoặc khi trang mở từ file://");
  return null;
}
function gocApi() {
  var q = apiTuDiaChi();
  if (q !== null) return q;
  var cfg = window.__WEBAPP_CONFIG__;
  return cfg && typeof cfg.apiBase === "string" ? cfg.apiBase.replace(/\/+$/, "") : "";
}
/* Khách AI (engine/ai-khach.js): nhận xét bài nói. Không có máy chủ thì không có AI. */
var AI = window.AiKhach && !window.OPIC ? window.AiKhach.tao(gocApi()) : null;

function taiNoiDung() {
  if (window.OPIC) return Promise.resolve(window.OPIC);
  var url = gocApi() + "/courses/" + KHOA_HOC + "/bundle";
  return fetch(url, { credentials: "same-origin" }).then(function (r) {
    if (r.ok) return r.json();
    return r.json().then(function (j) { throw new Error((j && j.message) || "HTTP " + r.status); },
                         function () { throw new Error("HTTP " + r.status); });
  }, function () {
    throw new Error("Không kết nối được tới máy chủ (" + (gocApi() || location.origin) + ")");
  }).then(function (b) { return L.tuBundle(b); });
}
function batDau() {
  if (!L) {
    $("#main").innerHTML = '<div class="wrap"><div class="empty">Thiếu <code>assets/logic.js</code>.</div></div>';
    return;
  }
  $("#main").innerHTML = '<div class="wrap"><div class="empty">Đang tải nội dung khoá học…</div></div>';
  taiNoiDung().then(chay, function (err) {
    var meo = location.protocol === "file:" ? "Trang đang mở bằng file:// nên không gọi được API. Mở qua FastAPI " +
      "(<code>/webapp/courses/opic-course/</code>) hoặc thêm <code>?api=http://127.0.0.1:6789</code>." : "";
    $("#main").innerHTML = '<div class="wrap"><div class="empty">Không tải được nội dung: ' + esc(err.message || err) +
      (meo ? "<br>" + meo : "") + '<br><br><button class="btn" id="btnThuLai">' + icon("reset") + "Thử lại</button></div></div>";
    $("#btnThuLai").addEventListener("click", batDau);
  });
}
batDau();

function chay(D) {

/* ---------- 1. Lưu trạng thái ---------------------------------------- */
var KHOA = "opic";
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem(KHOA + "." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(KHOA + "." + k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(KHOA + "." + k); } catch (e) {} }
};
var hoc     = LS.get("hoc", {});          /* {id: {s, hop, den, lan, luc}} */
var cuaToi  = LS.get("cua-toi", {});      /* {id: "script của tôi"} */
var ghiChu  = LS.get("ghi-chu", {});
var sao     = new Set(LS.get("sao", []));
var daDoc   = new Set(LS.get("da-doc", []));
var nhatKy  = LS.get("nhat-ky", {});      /* {"2026-10-01": số lần luyện} */
var lichSu  = LS.get("thi", []);          /* thi thử đã làm */
var caiDat  = Object.assign({ giong: "", tocDo: 1, bo: "AB", cheDo: "day-du", tuGhi: false, docHaiLan: true, anChu: false },
                            LS.get("cai-dat", {}));
var cuoi    = LS.get("cuoi", null);
function luuHoc()    { LS.set("hoc", hoc); }
function luuCaiDat() { LS.set("cai-dat", caiDat); }

/* ---------- 2. Chỉ mục dữ liệu --------------------------------------- */
var CAU = {}, CD = {}, HD = {}, THEO_CD = {};
D.cauHoi.forEach(function (q) { CAU[q.id] = q; (THEO_CD[q.chuDe] = THEO_CD[q.chuDe] || []).push(q); });
D.chuDe.forEach(function (c) { CD[c.id] = c; });
D.huongDan.forEach(function (h) { HD[h.slug] = h; });
var UU_TIEN = { 1: ["Trọng tâm", "ac"], 2: ["Hay gặp", ""], 3: ["Ít gặp", ""] };

function hopBo(q) { return caiDat.bo === "AB" || q.bo === caiDat.bo; }
function trangThai(id) { return hoc[id] || { s: 0, hop: 0, den: 0, lan: 0, luc: 0 }; }
function chipDang(dang) {
  var d = D.dang[dang] || { ten: dang };
  return '<span class="chip dang" style="--dc:var(--d-' + esc(dang) + ')">' + esc(d.ten) + '</span>';
}
function chipBo(bo) { return '<span class="chip bo" title="' + esc(D.bo[bo].ten) + '">Bộ ' + bo + '</span>'; }
function chipTrangThai(id) {
  var s = trangThai(id).s;
  return s === 2 ? '<span class="chip ok">' + icon("check") + 'Đã thuộc</span>'
       : s === 1 ? '<span class="chip wa">Đang học</span>' : '<span class="chip">Chưa học</span>';
}

/* ---------- 3. Giao diện sáng / tối ---------------------------------- */
var mq = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  var qs = (location.search.match(/[?&]theme=(light|dark)/) || [])[1];
  if (qs) LS.set("theme", qs);
  var pref = LS.get("theme", "auto");
  document.documentElement.setAttribute("data-theme", pref === "auto" ? (mq.matches ? "dark" : "light") : pref);
}
mq.addEventListener("change", function () { if (LS.get("theme", "auto") === "auto") applyTheme(); });
applyTheme();
$("#btnTheme").addEventListener("click", function () {
  LS.set("theme", document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  applyTheme();
});

/* ---------- 4. Tiện ích ---------------------------------------------- */
var toastT;
function toast(msg) {
  var t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(function () { t.hidden = true; }, 2200);
}
function chep(text) {
  var ok = function () { toast("Đã chép vào bộ nhớ tạm"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { chepCu(text); ok(); });
  else { chepCu(text); ok(); }
}
function chepCu(text) {
  var ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}
function ngayGio(ms) {
  var d = new Date(ms);
  return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
/* Mỗi lần luyện thật (ghi âm xong, chấm thẻ, xong câu thi thử) ghi vào nhật ký ngày
   — nguồn của "chuỗi ngày" và bản đồ nhiệt ở trang Tiến độ. */
function ghiLuyen(qid) {
  var k = L.ngayKey();
  nhatKy[k] = (nhatKy[k] || 0) + 1;
  LS.set("nhat-ky", nhatKy);
  if (qid && CAU[qid]) {
    var tt = trangThai(qid);
    if (!tt.s) tt.s = 1;
    tt.lan = (tt.lan || 0) + 1; tt.luc = Date.now();
    hoc[qid] = tt; luuHoc();
  }
  paintProgress();
}
function datTrangThai(qid, s) {
  var tt = trangThai(qid);
  if (s === 2) tt = L.cham(tt, 2);
  else if (s === 1) { tt.s = 1; tt.den = Date.now() + 86400000; }
  else { tt.s = 0; tt.hop = 0; tt.den = 0; }
  hoc[qid] = tt; luuHoc(); paintProgress();
}
function paintProgress() {
  var tk = L.thongKe(D, hoc, caiDat.bo), pct = Math.round(tk.pt * 100);
  $("#hdrPct").textContent = pct + "%";
  $("#hdrRing").style.strokeDashoffset = (97.4 - 97.4 * tk.pt).toFixed(2);
  $("#hdrRing").parentNode.parentNode.title = tk.thuoc + " / " + tk.tong + " script đã thuộc";
}

/* ---------- 5. Máy đọc (Web Speech) ---------------------------------- */
var TTS = {
  san: !!window.speechSynthesis,
  giongs: [], dang: false, hienTai: null,
  nap: function () {
    if (!TTS.san) return;
    var all = speechSynthesis.getVoices();
    TTS.giongs = all.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    if (!TTS.giongs.length) TTS.giongs = all;
  },
  giong: function () {
    var g = TTS.giongs;
    if (!g.length) return null;
    for (var i = 0; i < g.length; i++) if (g[i].name === caiDat.giong) return g[i];
    for (i = 0; i < g.length; i++) if (/en[-_]US/i.test(g[i].lang)) return g[i];
    return g[0];
  },
  doc: function (text, onend) {
    if (!TTS.san) { toast("Trình duyệt không hỗ trợ đọc văn bản"); if (onend) onend(); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var v = TTS.giong();
    if (v) u.voice = v;
    u.lang = (v && v.lang) || "en-US";
    u.rate = caiDat.tocDo || 1;
    u.onend = function () { TTS.dang = false; TTS.hienTai = null; if (onend) onend(); };
    u.onerror = function () { TTS.dang = false; TTS.hienTai = null; if (onend) onend(); };
    TTS.dang = true; TTS.hienTai = u;
    speechSynthesis.speak(u);
  },
  /* đọc lần lượt từng câu, gọi onIndex(i) trước mỗi câu để giao diện tô sáng */
  docDay: function (cauList, onIndex, onDone) {
    var i = 0, huy = false;
    function tiep() {
      if (huy || i >= cauList.length) { if (onIndex) onIndex(-1); if (onDone) onDone(); return; }
      var k = i++;
      if (onIndex) onIndex(k);
      TTS.doc(cauList[k], function () { if (!huy) tiep(); });
    }
    tiep();
    return function () { huy = true; TTS.dung(); if (onIndex) onIndex(-1); };
  },
  dung: function () { if (TTS.san) speechSynthesis.cancel(); TTS.dang = false; TTS.hienTai = null; }
};
if (TTS.san) { TTS.nap(); speechSynthesis.addEventListener("voiceschanged", TTS.nap); }
var dungDocDay = null;
function dungMoiAmThanh() { if (dungDocDay) { dungDocDay(); dungDocDay = null; } TTS.dung(); }

/* tiếng bíp khi hết giờ — WebAudio, không cần tệp âm thanh */
var audioCtx = null;
function bip(lan) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    var t = audioCtx.currentTime;
    for (var i = 0; i < (lan || 2); i++) {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.0001, t + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.25 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t + i * 0.25); o.stop(t + i * 0.25 + 0.2);
    }
  } catch (e) {}
}

/* ---------- 6. Đồng hồ ----------------------------------------------- */
/* Một đồng hồ vẽ vào host. Trả về điều khiển; tự huỷ khi host rời DOM. */
function taoDongHo(host, o) {
  o = o || {};
  var tong = o.giay || 60, con = tong, chay = false, tick = null, qua = false;
  host.innerHTML =
    '<div class="timer">' +
      '<div class="tring"><svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="36"/><circle class="fg" cx="40" cy="40" r="36"/></svg><div class="tt">' + L.dinhDangGiay(con) + '</div></div>' +
      '<div class="ctl">' +
        '<div class="row preset">' + [60, 90, 120].map(function (s) {
          return '<button class="btn sm' + (s === tong ? " on" : "") + '" data-giay="' + s + '">' + L.phutChu(s / 60) + '</button>';
        }).join("") + '</div>' +
        '<div class="row"><button class="btn sm pri" data-act="bat">' + icon("play") + 'Bắt đầu</button>' +
        '<button class="btn sm" data-act="lai">' + icon("reset") + 'Đặt lại</button></div>' +
      '</div>' +
    '</div>';
  var fg = $(".fg", host), tt = $(".tt", host), ring = $(".tring", host), btnBat = $('[data-act="bat"]', host);
  function ve() {
    var r = Math.max(0, con) / tong;
    fg.style.strokeDashoffset = (226 - 226 * r).toFixed(1);
    tt.textContent = (con < 0 ? "+" : "") + L.dinhDangGiay(Math.abs(con));
    ring.classList.toggle("over", con < 0);
  }
  function dat(s) { tong = s; con = s; qua = false; ve(); $$(".preset .btn", host).forEach(function (b) { b.classList.toggle("on", +b.dataset.giay === s); }); }
  function dung() { chay = false; clearInterval(tick); tick = null; btnBat.innerHTML = icon("play") + (con === tong ? "Bắt đầu" : "Tiếp tục"); }
  function bat() {
    if (chay) return;
    chay = true;
    btnBat.innerHTML = icon("pause") + "Tạm dừng";
    if (o.onBat) o.onBat();
    var moc = Date.now(), goc = con;
    tick = setInterval(function () {
      if (!document.body.contains(host)) { dung(); return; }
      con = goc - Math.round((Date.now() - moc) / 1000);
      if (con <= 0 && !qua) { qua = true; bip(3); if (o.onHet) o.onHet(); }
      ve();
    }, 250);
  }
  function datLai() { dung(); con = tong; qua = false; ve(); btnBat.innerHTML = icon("play") + "Bắt đầu"; if (o.onLai) o.onLai(); }
  host.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.giay) { dung(); dat(+b.dataset.giay); }
    else if (b.dataset.act === "bat") { chay ? dung() : bat(); }
    else if (b.dataset.act === "lai") datLai();
  });
  ve();
  return { dat: dat, bat: bat, dung: dung, datLai: datLai, dangChay: function () { return chay; }, daDung: function () { return tong - con; } };
}

/* ---------- 7. Ghi âm + IndexedDB ------------------------------------ */
var IDB = {
  db: null,
  mo: function () {
    return new Promise(function (res, rej) {
      if (IDB.db) return res(IDB.db);
      if (!window.indexedDB) return rej(new Error("no idb"));
      var r = indexedDB.open("opic-ghi-am", 1);
      r.onupgradeneeded = function () {
        var s = r.result.createObjectStore("ban-ghi", { keyPath: "id", autoIncrement: true });
        s.createIndex("qid", "qid");
      };
      r.onsuccess = function () { IDB.db = r.result; res(IDB.db); };
      r.onerror = function () { rej(r.error); };
    });
  },
  them: function (rec) {
    return IDB.mo().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("ban-ghi", "readwrite");
        tx.objectStore("ban-ghi").add(rec).onsuccess = function (e) { res(e.target.result); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  },
  theoCau: function (qid) {
    return IDB.mo().then(function (db) {
      return new Promise(function (res, rej) {
        /* IDBIndex KHÔNG có .transaction — gán onerror vào đó từng ném TypeError ngay trong
           promise, .catch nuốt lỗi và danh sách bản ghi luôn trống. Giữ transaction riêng. */
        var out = [], tx = db.transaction("ban-ghi"), idx = tx.objectStore("ban-ghi").index("qid");
        idx.openCursor(IDBKeyRange.only(qid)).onsuccess = function (e) {
          var c = e.target.result;
          if (c) { out.push(c.value); c.continue(); } else res(out.sort(function (a, b) { return b.luc - a.luc; }));
        };
        tx.onerror = function () { rej(tx.error); };
      });
    }).catch(function () { return []; });
  },
  xoa: function (id) {
    return IDB.mo().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction("ban-ghi", "readwrite");
        tx.objectStore("ban-ghi").delete(id);
        tx.oncomplete = res; tx.onerror = res;
      });
    });
  },
  demTatCa: function () {
    return IDB.mo().then(function (db) {
      return new Promise(function (res) {
        var r = db.transaction("ban-ghi").objectStore("ban-ghi").count();
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(0); };
      });
    }).catch(function () { return 0; });
  }
};
var REC = {
  dang: false, mr: null, chunks: [], stream: null, batDauLuc: 0, qid: null, onDoi: null,
  co: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
  bat: function (qid, onDoi) {
    if (!REC.co()) { toast("Trình duyệt không hỗ trợ ghi âm, hoặc trang chưa mở qua http(s)/localhost"); return Promise.resolve(false); }
    if (REC.dang) return Promise.resolve(true);
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      REC.stream = stream; REC.chunks = []; REC.qid = qid; REC.onDoi = onDoi;
      var mr = new MediaRecorder(stream);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) REC.chunks.push(e.data); };
      mr.onstop = function () {
        var blob = new Blob(REC.chunks, { type: mr.mimeType || "audio/webm" });
        var giay = Math.round((Date.now() - REC.batDauLuc) / 1000);
        stream.getTracks().forEach(function (t) { t.stop(); });
        REC.dang = false; REC.mr = null;
        if (blob.size > 0 && REC.qid) {
          IDB.them({ qid: REC.qid, luc: Date.now(), giay: giay, blob: blob, kieu: blob.type }).then(function () {
            return IDB.theoCau(REC.qid);
          }).then(function (ds) {           /* giữ 5 bản gần nhất mỗi câu */
            return Promise.all(ds.slice(5).map(function (r) { return IDB.xoa(r.id); }));
          }).catch(function () {}).then(function () {
            ghiLuyen(REC.qid);
            toast("Đã lưu bản ghi " + L.dinhDangGiay(giay));
            if (REC.onDoi) REC.onDoi(false);
          });
        } else if (REC.onDoi) REC.onDoi(false);
      };
      REC.mr = mr; REC.dang = true; REC.batDauLuc = Date.now();
      mr.start();
      if (onDoi) onDoi(true);
      return true;
    }).catch(function (e) {
      toast("Không mở được micro: " + (e && e.message ? e.message : e));
      return false;
    });
  },
  dung: function () { if (REC.dang && REC.mr && REC.mr.state !== "inactive") REC.mr.stop(); },
  giayDaGhi: function () { return REC.dang ? Math.round((Date.now() - REC.batDauLuc) / 1000) : 0; }
};

/* ---------- 7b. Bản ghi → WAV cho AI --------------------------------
   MediaRecorder ghi webm/ogg tuỳ trình duyệt; Gemini nghe chắc chắn được WAV.
   Giải mã, trộn về một kênh, lấy mẫu lại 16 kHz, PCM 16 bit: 90 giây ≈ 2,9 MB —
   vừa giới hạn thân request 4,5 MB của Vercel sau khi mã hoá base64. */
var AI_GIAY = 90, AI_HZ = 16000;
function maWav(f32, hz) {
  var n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  function chu(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
  chu(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); chu(8, "WAVE"); chu(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, hz, true);
  v.setUint32(28, hz * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  chu(36, "data"); v.setUint32(40, n * 2, true);
  for (var i = 0; i < n; i++) {
    var s = Math.max(-1, Math.min(1, f32[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}
function base64(u8) {
  var s = "";
  for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function sangWav(blob) {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !window.OfflineAudioContext) return Promise.reject(new Error("Trình duyệt không xử lý được âm thanh"));
  return blob.arrayBuffer().then(function (buf) {
    var ac = new AC();
    return new Promise(function (ok, hong) { ac.decodeAudioData(buf, ok, hong); }).then(function (am) {
      if (ac.close) ac.close();
      var giay = Math.min(am.duration, AI_GIAY);
      var oc = new OfflineAudioContext(1, Math.max(1, Math.ceil(giay * AI_HZ)), AI_HZ);
      var src = oc.createBufferSource();
      src.buffer = am; src.connect(oc.destination); src.start(0);
      return oc.startRendering().then(function (r) {
        return { wav: maWav(r.getChannelData(0), AI_HZ), giay: giay, cat: am.duration > AI_GIAY + 0.5 };
      });
    });
  });
}

/* ---------- 8. Markdown tối giản --------------------------------------
   Đủ cho bài hướng dẫn: tiêu đề, đoạn, danh sách lồng nhau, trích dẫn (thành
   hộp chú ý theo biểu tượng đầu dòng), bảng, mã, in đậm / nghiêng / liên kết,
   và hai thẻ riêng {{script:ID}} / {{huong-dan:slug}}. Không tải thư viện ngoài
   nên trang chạy hoàn toàn offline. */
function slugify(t) {
  return L.chuanHoa(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "m";
}
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
    /* Nội dung đến từ database: liên kết javascript:/vbscript:/data: chỉ còn chữ.
       (u đã qua esc() nên không thoát được khỏi thuộc tính; còn lại là scheme.) */
    if (/^(javascript|vbscript|data):/.test(u.replace(/[\u0000-\u0020]+/g, "").toLowerCase())) return t;
    var ext = /^https?:/.test(u);
    return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
  });
  s = s.replace(/\{\{script:([A-Za-z0-9]+)\}\}/g, function (_, id) {
    var q = CAU[id];
    if (!q) return "<code>" + id + "</code>";
    return '<a class="sref" href="#/script/' + id + '"><span class="id">' + id + '</span><span class="vi">' + esc(q.vi) + "</span></a>";
  });
  s = s.replace(/\{\{huong-dan:([a-z0-9-]+)\}\}/g, function (_, slug) {
    var h = HD[slug];
    return h ? '<a href="#/huong-dan/' + slug + '">' + esc(h.ten) + "</a>" : slug;
  });
  return s;
}
function mdRender(md, used) {
  used = used || {};
  var lines = String(md || "").replace(/\r\n/g, "\n").split("\n"), out = [], i = 0, n = lines.length;
  var BLOCK = /^(#{1,4}\s|>|\||```|---+\s*$|\s*([-*]|\d+\.)\s+)/;
  function cells(r) { return r.replace(/^\s*\||\|\s*$/g, "").split("|").map(function (c) { return c.trim(); }); }
  function danhSach() {
    var items = [];
    while (i < n) {
      var l = lines[i], m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (m) { items.push({ ind: m[1].length, ord: /\d/.test(m[2]), txt: m[3] }); i++; }
      else if (/^\s+\S/.test(l) && !BLOCK.test(l) && items.length) { items[items.length - 1].txt += " " + l.trim(); i++; }
      else break;
    }
    function build(k, ind) {
      var type = items[k].ord ? "ol" : "ul", html = "<" + type + ">";
      while (k < items.length && items[k].ind >= ind) {
        if (items[k].ind > ind) {
          var sub = build(k, items[k].ind);
          html = html.replace(/<\/li>$/, "") + sub.html + "</li>";
          k = sub.k;
          continue;
        }
        html += "<li>" + inline(items[k].txt) + "</li>"; k++;
      }
      return { html: html + "</" + type + ">", k: k };
    }
    return build(0, items[0].ind).html;
  }
  while (i < n) {
    var line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^```/.test(line)) {
      var buf = []; i++;
      while (i < n && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push("<pre>" + esc(buf.join("\n")) + "</pre>"); continue;
    }
    var m = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (m) {
      var id = slugify(m[2]), base = id, k = 2;
      while (used[id]) id = base + "-" + (k++);
      used[id] = true;
      out.push("<h" + m[1].length + ' id="' + id + '">' + inline(m[2]) + "</h" + m[1].length + ">"); i++; continue;
    }
    if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^>/.test(line)) {
      var qb = [];
      while (i < n && /^>/.test(lines[i])) qb.push(lines[i++].replace(/^>\s?/, ""));
      var first = qb.join(" ").trim(), cls = "co-note";
      if (/^(⚠️|⚠)/.test(first)) cls = "co-warn";
      else if (/^(💡|✅)/.test(first)) cls = "co-tip";
      else if (/^📝/.test(first)) cls = "co-script";
      out.push('<blockquote class="' + cls + '">' + mdRender(qb.join("\n"), used) + "</blockquote>"); continue;
    }
    if (/^\s*\|/.test(line)) {
      var rows = [];
      while (i < n && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      var html = "<table><thead><tr>" + cells(rows[0]).map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
      for (var r = 2; r < rows.length; r++) html += "<tr>" + cells(rows[r]).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
      out.push(html + "</tbody></table>"); continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) { out.push(danhSach()); continue; }
    var pb = [];
    while (i < n && !/^\s*$/.test(lines[i]) && !BLOCK.test(lines[i])) pb.push(lines[i++]);
    if (!pb.length) { pb.push(lines[i++]); }
    out.push("<p>" + inline(pb.join(" ")) + "</p>");
  }
  return out.join("\n");
}

/* ---------- 9. Mục lục trái ------------------------------------------ */
var state = { view: "", id: "" };
function buildNav() {
  var html = '<div class="nav-h">BẮT ĐẦU</div>' +
    navItem("#/", "home", "Trang chủ", state.view === "home") +
    navItem("#/luyen", "target", "Luyện thẻ", state.view === "luyen") +
    navItem("#/thi-thu", "flag", "Thi thử 15 câu", state.view === "thi-thu") +
    navItem("#/tien-do", "chart", "Tiến độ & sao lưu", state.view === "tien-do") +
    '<div class="nav-h">HƯỚNG DẪN</div>' +
    D.huongDan.map(function (h) {
      var on = state.view === "huong-dan" && state.id === h.slug;
      return '<a class="nav-i' + (on ? " on" : "") + '" href="#/huong-dan/' + h.slug + '"><span class="n" style="margin:0;min-width:16px">' + h.thuTu + '</span><span class="lb">' + esc(h.ten) + "</span>" +
        (daDoc.has(h.slug) ? '<span class="dot" title="Đã đọc"></span>' : "") + "</a>";
    }).join("") +
    '<div class="nav-h">CHỦ ĐỀ</div>' +
    D.chuDe.map(function (c) {
      var on = (state.view === "chu-de" && state.id === c.id) || (state.view === "script" && CAU[state.id] && CAU[state.id].chuDe === c.id);
      var qs = (THEO_CD[c.id] || []).filter(hopBo), thuoc = qs.filter(function (q) { return trangThai(q.id).s === 2; }).length;
      return '<a class="nav-i' + (on ? " on" : "") + '" href="#/chu-de/' + c.id + '"><span class="em">' + c.icon + '</span><span class="lb">' + esc(c.ten) + "</span>" +
        '<span class="n">' + thuoc + "/" + qs.length + "</span></a>";
    }).join("");
  $("#sideNav").innerHTML = html;
  var on = $(".nav-i.on", $("#sideNav"));
  if (on) {
    var side = $("#side"), r = on.getBoundingClientRect(), s = side.getBoundingClientRect();
    if (r.top < s.top + 40 || r.bottom > s.bottom - 40) on.scrollIntoView({ block: "center" });
  }
}
function navItem(href, ic, ten, on) {
  return '<a class="nav-i' + (on ? " on" : "") + '" href="' + href + '">' + icon(ic) + '<span class="lb">' + ten + "</span></a>";
}
$("#btnMenu").addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
$("#scrim").addEventListener("click", function () { document.body.classList.remove("nav-open"); });
$("#sideNav").addEventListener("click", function (e) { if (e.target.closest("a")) document.body.classList.remove("nav-open"); });

/* ---------- 10. Router ----------------------------------------------- */
function route() {
  dungMoiAmThanh();
  if (REC.dang) REC.dung();
  /* "#/luyen?cd=nha-cua": phần sau dấu ? là tham số của trang, không thuộc đường đi */
  var h = location.hash.replace(/^#\/?/, "").split("?")[0], parts = h.split("/").map(decodeURIComponent);
  var v = parts[0] || "home", id = parts.slice(1).join("/");
  state.view = v; state.id = id;
  var main = $("#main");
  main.scrollTop = 0; window.scrollTo(0, 0);
  if (v === "home") viewHome();
  else if (v === "huong-dan") id ? viewHuongDan(id) : viewHuongDanList();
  else if (v === "chu-de") id ? viewChuDe(id) : viewChuDeList();
  else if (v === "script") viewScript(id);
  else if (v === "luyen") viewLuyen();
  else if (v === "thi-thu") viewThiThu();
  else if (v === "tien-do") viewTienDo();
  else { main.innerHTML = '<div class="wrap"><div class="empty">Không có trang <code>#/' + esc(h) + '</code>. <a href="#/">Về trang chủ</a></div></div>'; }
  buildNav();
  document.title = (TIEU_DE[v] || "Luyện thi OPIc");
}
var TIEU_DE = { home: "Khoá luyện thi OPIc", luyen: "Luyện thẻ — OPIc", "thi-thu": "Thi thử 15 câu — OPIc", "tien-do": "Tiến độ — OPIc" };
window.addEventListener("hashchange", route);

/* ---------- 11. Trang chủ -------------------------------------------- */
function viewHome() {
  var tk = L.thongKe(D, hoc, caiDat.bo), homNay = nhatKy[L.ngayKey()] || 0, chuoi = L.chuoiNgay(nhatKy);
  var last = cuoi && CAU[cuoi] ? CAU[cuoi] : null;
  var html = '<div class="wrap wide">' +
    '<section class="hero">' +
      '<h1>Luyện thi <u>OPIc</u> theo script — chọn survey đúng, thuộc khung 7 dạng, nói đi nói lại</h1>' +
      '<p>Toàn bộ hướng dẫn gốc được viết lại thành 10 bài ngắn, kèm <b>' + D.thongKe.cauHoi + ' script mẫu</b> chia theo ' + D.thongKe.chuDe +
      ' chủ đề. Mỗi script có máy đọc, chế độ che dần để học thuộc, đồng hồ 1′ – 2′, ghi âm và ô viết script của riêng bạn.</p>' +
      '<div class="row">' +
        '<a class="btn pri" href="#/huong-dan/tong-quan">' + icon("book") + 'Bắt đầu từ hướng dẫn</a>' +
        '<a class="btn" href="#/luyen">' + icon("target") + 'Luyện thẻ</a>' +
        '<a class="btn" href="#/thi-thu">' + icon("flag") + 'Thi thử 15 câu</a>' +
      '</div>' +
    '</section>' +
    '<div class="kpis">' +
      kpi(tk.thuoc + '<small>/ ' + tk.tong + '</small>', "script đã thuộc" + (caiDat.bo !== "AB" ? " (bộ " + caiDat.bo + ")" : ""), tk.pt) +
      kpi(tk.denHan, "thẻ đến hạn ôn hôm nay") +
      kpi(chuoi + '<small>ngày</small>', "chuỗi ngày luyện liên tiếp") +
      kpi(homNay, "lần luyện hôm nay") +
    '</div>' +
    (last ? '<a class="next" href="#/script/' + last.id + '"><span class="em">' + CD[last.chuDe].icon + '</span><span class="t2"><b>Học tiếp: ' + esc(last.vi) + '</b><span>' + esc(CD[last.chuDe].ten) + ' · ' + esc(D.dang[last.dang].ten) + '</span></span>' + icon("right") + '</a>' : "") +
    '<div class="sec-h"><h2>Chủ đề</h2><span class="muted">trọng tâm = 9 chủ đề của hướng dẫn · hay gặp = câu 1, nhà cửa, diễn</span></div>' +
    '<div class="grid">' + D.chuDe.map(theChuDe).join("") + '</div>' +
    '<div class="sec-h"><h2>Hướng dẫn</h2><span class="muted">' + D.thongKe.huongDan + ' bài · ~' + D.thongKe.phutDoc + ' phút đọc</span></div>' +
    '<div class="grid">' + D.huongDan.map(function (h) {
      return '<a class="lesson-li" href="#/huong-dan/' + h.slug + '"><span class="no">' + (h.thuTu < 10 ? "0" : "") + h.thuTu + '</span><span><b>' + esc(h.ten) + '</b><span>' + esc(h.tomTat.slice(0, 110)) + (h.tomTat.length > 110 ? "…" : "") + '</span></span>' + (daDoc.has(h.slug) ? icon("check") : "") + '</a>';
    }).join("") + '</div>' +
    '<div class="sec-h"><h2>Hai bộ script</h2></div>' +
    '<div class="grid">' + ["A", "B"].map(function (b) {
      var n = D.cauHoi.filter(function (q) { return q.bo === b; }).length;
      return '<div class="card"><h3>' + esc(D.bo[b].ten) + ' <span class="chip">' + n + ' script</span></h3><p class="small" style="margin:0 0 6px"><b>Nhân vật:</b> ' + esc(D.bo[b].nhanVat) + '</p><p class="small muted" style="margin:0">' + esc(D.bo[b].moTa) + '</p></div>';
    }).join("") + '</div>' +
  '</div>';
  $("#main").innerHTML = html;
}
function kpi(so, nhan, pt) {
  return '<div class="kpi"><b>' + so + '</b><span>' + nhan + '</span>' + (pt != null ? '<div class="bar"><i style="width:' + Math.round(pt * 100) + '%"></i></div>' : "") + '</div>';
}
function theChuDe(c) {
  var qs = (THEO_CD[c.id] || []).filter(hopBo), thuoc = qs.filter(function (q) { return trangThai(q.id).s === 2; }).length;
  var u = UU_TIEN[c.uuTien] || UU_TIEN[2];
  return '<a class="tcard' + (c.uuTien === 1 ? " p1" : "") + '" href="#/chu-de/' + c.id + '">' +
    '<div class="top"><span class="em">' + c.icon + '</span><b>' + esc(c.ten) + '</b></div>' +
    '<p>' + esc(c.moTa) + '</p>' +
    '<div class="ft"><span class="chip ' + u[1] + '">' + u[0] + '</span><div class="bar sm"><i style="width:' + (qs.length ? Math.round(thuoc / qs.length * 100) : 0) + '%"></i></div><span>' + thuoc + '/' + qs.length + '</span></div></a>';
}

/* ---------- 12. Hướng dẫn -------------------------------------------- */
function viewHuongDanList() {
  $("#main").innerHTML = '<div class="wrap"><h1 class="t">Hướng dẫn</h1><p class="sub">Mười bài viết lại từ 23 trang tài liệu gốc, theo đúng thứ tự nên đọc. Bài 5 (bảy dạng câu hỏi) và bài 6 (chuẩn bị script) là hai bài quan trọng nhất.</p>' +
    '<div class="grid" style="grid-template-columns:1fr">' + D.huongDan.map(function (h) {
      return '<a class="lesson-li" href="#/huong-dan/' + h.slug + '"><span class="no">' + (h.thuTu < 10 ? "0" : "") + h.thuTu + '</span><span><b>' + esc(h.ten) + '</b><span>' + esc(h.tomTat) + ' · ' + h.phut + ' phút</span></span>' + (daDoc.has(h.slug) ? icon("check") : "") + '</a>';
    }).join("") + '</div></div>';
}
function viewHuongDan(slug) {
  var h = HD[slug];
  if (!h) { $("#main").innerHTML = '<div class="wrap"><div class="empty">Không có bài hướng dẫn <code>' + esc(slug) + '</code>.</div></div>'; return; }
  var i = D.huongDan.indexOf(h), prev = D.huongDan[i - 1], next = D.huongDan[i + 1];
  var used = {};
  var body = mdRender(h.md, used);
  var toc = h.outline.map(function (o) { return '<a class="d' + o.d + '" href="#' + slugify(o.t) + '" data-toc>' + esc(o.t) + "</a>"; }).join("");
  $("#main").innerHTML = '<div class="wrap wide">' +
    '<div class="crumb"><a href="#/huong-dan">Hướng dẫn</a>' + icon("chev") + '<span>Bài ' + h.thuTu + ' / ' + D.huongDan.length + ' · ' + h.phut + ' phút đọc</span></div>' +
    '<div class="two"><article class="md">' + body + '</article>' +
    (toc ? '<nav class="toc">' + toc + '</nav>' : "") + '</div>' +
    '<div class="pn">' + (prev ? '<a href="#/huong-dan/' + prev.slug + '"><span>← Bài trước</span><b>' + esc(prev.ten) + '</b></a>' : "<span></span>") +
    (next ? '<a class="r" href="#/huong-dan/' + next.slug + '"><span>Bài tiếp →</span><b>' + esc(next.ten) + '</b></a>' : '<a class="r" href="#/chu-de"><span>Tiếp theo</span><b>Vào kho script</b></a>') + '</div>' +
  '</div>';
  daDoc.add(slug); LS.set("da-doc", Array.from(daDoc));
  document.title = h.ten + " — OPIc";
  /* mục lục trong bài: cuộn mượt tới tiêu đề, không đổi hash */
  $$("[data-toc]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var el = document.getElementById(a.getAttribute("href").slice(1));
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); $$("[data-toc]").forEach(function (x) { x.classList.toggle("on", x === a); }); }
    });
  });
}

/* ---------- 13. Chủ đề ----------------------------------------------- */
function viewChuDeList() {
  $("#main").innerHTML = '<div class="wrap wide"><h1 class="t">Kho script theo chủ đề</h1><p class="sub">' + D.thongKe.cauHoi + ' câu hỏi · bộ A ' + D.thongKe.boA + ' · bộ B ' + D.thongKe.boB + '. Chủ đề trọng tâm là 9 chủ đề của hướng dẫn; "hay gặp" là câu 1, nhà cửa và nhóm diễn.</p>' +
    '<div class="grid">' + D.chuDe.map(theChuDe).join("") + '</div></div>';
}
var locChuDe = { bo: "AB", dang: "", tt: "" };
function viewChuDe(id) {
  var c = CD[id];
  if (!c) { $("#main").innerHTML = '<div class="wrap"><div class="empty">Không có chủ đề <code>' + esc(id) + '</code>.</div></div>'; return; }
  var qs = THEO_CD[id] || [], u = UU_TIEN[c.uuTien] || UU_TIEN[2];
  var dangs = []; qs.forEach(function (q) { if (dangs.indexOf(q.dang) < 0) dangs.push(q.dang); });
  function ve() {
    var ds = qs.filter(function (q) {
      return (locChuDe.bo === "AB" || q.bo === locChuDe.bo) && (!locChuDe.dang || q.dang === locChuDe.dang) &&
             (!locChuDe.tt || String(trangThai(q.id).s) === locChuDe.tt);
    });
    $("#dsCau").innerHTML = ds.length ? ds.map(hangCau).join("") : '<div class="empty">Không có câu nào khớp bộ lọc.</div>';
    $("#demCau").textContent = ds.length + " / " + qs.length + " câu";
  }
  $("#main").innerHTML = '<div class="wrap wide">' +
    '<div class="crumb"><a href="#/chu-de">Chủ đề</a>' + icon("chev") + '<span>' + esc(c.ten) + '</span></div>' +
    '<h1 class="t">' + c.icon + ' ' + esc(c.ten) + '</h1><p class="sub">' + esc(c.moTa) + '</p>' +
    '<div class="chips"><span class="chip ' + u[1] + '">' + u[0] + '</span><span class="chip" id="demCau"></span></div>' +
    '<div class="filters">' +
      '<div class="seg" data-loc="bo">' + ["AB", "A", "B"].map(function (b) { return '<button data-v="' + b + '"' + (locChuDe.bo === b ? ' class="on"' : "") + '>' + (b === "AB" ? "Cả hai bộ" : "Bộ " + b) + '</button>'; }).join("") + '</div>' +
      '<div class="seg" data-loc="dang"><button data-v=""' + (!locChuDe.dang ? ' class="on"' : "") + '>Mọi dạng</button>' + dangs.map(function (d) { return '<button data-v="' + d + '"' + (locChuDe.dang === d ? ' class="on"' : "") + '>' + esc(D.dang[d].ten) + '</button>'; }).join("") + '</div>' +
      '<div class="seg" data-loc="tt"><button data-v=""' + (!locChuDe.tt ? ' class="on"' : "") + '>Mọi trạng thái</button><button data-v="0">Chưa học</button><button data-v="1">Đang học</button><button data-v="2">Đã thuộc</button></div>' +
      '<a class="btn sm" href="#/luyen?cd=' + id + '">' + icon("target") + 'Luyện chủ đề này</a>' +
    '</div>' +
    '<div id="dsCau"></div>' +
  '</div>';
  ve();
  $$(".seg", $("#main")).forEach(function (seg) {
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      locChuDe[seg.dataset.loc] = b.dataset.v;
      $$("button", seg).forEach(function (x) { x.classList.toggle("on", x === b); });
      ve();
    });
  });
  document.title = c.ten + " — OPIc";
}
function hangCau(q) {
  var tt = trangThai(q.id);
  return '<a class="qrow" href="#/script/' + q.id + '"><span class="id ' + q.bo + '">' + q.so + '</span>' +
    '<span><div class="vi">' + esc(q.vi) + '</div><div class="en">' + esc(q.en) + '</div></span>' +
    '<span class="meta">' + chipDang(q.dang) + '<span class="chip">' + L.phutChu(q.phut) + ' · ' + q.cau.length + ' câu</span>' +
    (sao.has(q.id) ? '<span class="chip ac">' + icon("star") + '</span>' : "") +
    '<span class="st s' + tt.s + '" title="' + (tt.s === 2 ? "Đã thuộc" : tt.s === 1 ? "Đang học" : "Chưa học") + '"></span></span></a>';
}

/* ---------- 14. Trang script ----------------------------------------- */
function viewScript(id) {
  var q = CAU[id];
  if (!q) { $("#main").innerHTML = '<div class="wrap"><div class="empty">Không có script <code>' + esc(id) + '</code>.</div></div>'; return; }
  var c = CD[q.chuDe], ds = THEO_CD[q.chuDe], i = ds.indexOf(q), prev = ds[i - 1], next = ds[i + 1];
  cuoi = id; LS.set("cuoi", id);
  var tt = trangThai(id), giay = Math.round(q.phut * 60);
  var html = '<div class="wrap wide">' +
    '<div class="crumb"><a href="#/chu-de">Chủ đề</a>' + icon("chev") + '<a href="#/chu-de/' + c.id + '">' + c.icon + ' ' + esc(c.ten) + '</a>' + icon("chev") + '<span>' + q.id + '</span></div>' +
    '<div class="qhead">' +
      '<div class="chips" style="margin:0">' + chipBo(q.bo) + chipDang(q.dang) + '<span class="chip">' + icon("clock") + L.phutChu(q.phut) + ' gợi ý</span><span id="chipTT">' + chipTrangThai(id) + '</span></div>' +
      '<div class="vi">' + esc(q.vi) + '</div>' +
      '<div class="en"><b>CÂU HỎI (EN)</b><button class="btn sm" id="btnDocHoi" title="Nghe câu hỏi">' + icon("volume") + 'Nghe</button>' + esc(q.en) + '</div>' +
      '<div class="meta-l"><span><b>' + q.cau.filter(function (x) { return !L.laChiDan(x); }).length + '</b> câu</span><span><b>' + q.tu + '</b> từ</span><span>nói ≈ <b>' + L.dinhDangGiay(q.giay) + '</b> ở 130 từ/phút</span><span>đã luyện <b>' + (tt.lan || 0) + '</b> lần</span>' +
      (tt.den && tt.s ? '<span>ôn lại: <b>' + new Date(tt.den).toLocaleDateString("vi-VN") + '</b></span>' : "") + '</div>' +
    '</div>' +
    '<div class="sgrid"><div>' +
      '<div class="scard"><div class="sh"><b>Script mẫu</b>' +
        '<div class="seg modes" id="segCheDo">' + Object.keys(L.CHE_DO).map(function (k) { return '<button data-v="' + k + '"' + (caiDat.cheDo === k ? ' class="on"' : "") + '>' + L.CHE_DO[k].ten + '</button>'; }).join("") + '</div>' +
        '<span class="sp"></span><button class="btn sm" id="btnDocCa">' + icon("volume") + 'Nghe cả bài</button><button class="btn sm" id="btnDung" hidden>' + icon("stop") + 'Dừng</button><button class="btn sm" id="btnChep" title="Chép script">' + icon("copy") + '</button></div>' +
        '<ol class="sent" id="sent"></ol>' +
        '<div class="small muted" style="padding:0 16px 12px">Bấm vào một câu để nghe riêng câu đó. Chế độ <b>Gợi ý</b> giữ 3 từ đầu, <b>Chữ cái đầu</b> chỉ còn chữ đầu mỗi từ, <b>Ẩn hết</b> chỉ còn số từ — thuộc ở mức ẩn hết mới tính là thuộc.</div>' +
      '</div>' +
      '<div class="scard myscript" style="margin-top:14px"><div class="sh"><b>Script của tôi</b><span class="chip">tự lưu</span><span class="sp"></span><button class="btn sm" id="btnDocToi">' + icon("volume") + 'Nghe</button><button class="btn sm" id="btnChepMau" title="Chép script mẫu xuống làm nháp">' + icon("edit") + 'Lấy mẫu làm nháp</button><button class="btn sm" id="btnAiScript" hidden title="AI nhận xét script bạn viết: mức ước lượng, chỗ sửa, bản tốt hơn">✨ Nhận xét script</button></div>' +
        '<div class="tool"><textarea id="taToi" placeholder="Viết script của riêng bạn cho câu này — 5 đến 7 câu, dùng chi tiết thật của bạn (tên, nơi ở, sở thích). Viết tiếng Việt trước cũng được, rồi chuyển sang tiếng Anh.">' + esc(cuaToi[id] || "") + '</textarea>' +
        '<div class="cnt"><span><b id="cTu">0</b> từ</span><span>nói ≈ <b id="cGiay">0:00</b></span><span id="cNhan" class="muted"></span></div></div></div>' +
      '<div class="scard ai-op" id="aiOp" style="margin-top:14px" hidden></div>' +
      '<div class="scard note" style="margin-top:14px"><div class="sh"><b>Ghi chú</b><span class="chip">từ khó · lỗi hay mắc · ý thay thế</span></div><div class="tool"><textarea id="taGhiChu" placeholder="Ví dụ: nhớ nhấn âm /θ/ trong three; thay Samsung bằng công ty mình…">' + esc(ghiChu[id] || "") + '</textarea></div></div>' +
      '<div class="related"><div class="sec-h"><h2>Cùng chủ đề</h2><a class="more" href="#/chu-de/' + c.id + '">tất cả ' + ds.length + ' câu</a></div>' +
        ds.filter(function (x) { return x !== q; }).slice(0, 6).map(hangCau).join("") + '</div>' +
      '<div class="pn">' + (prev ? '<a href="#/script/' + prev.id + '"><span>← ' + prev.id + '</span><b>' + esc(prev.vi) + '</b></a>' : "<span></span>") +
        (next ? '<a class="r" href="#/script/' + next.id + '"><span>' + next.id + ' →</span><b>' + esc(next.vi) + '</b></a>' : "<span></span>") + '</div>' +
    '</div>' +
    '<aside class="spanel">' +
      '<div class="scard"><div class="tool"><h4>' + icon("check") + 'TRẠNG THÁI</h4><div class="status">' +
        '<button class="btn sm' + (tt.s === 0 ? " on" : "") + '" data-s="0">Chưa học</button><button class="btn sm' + (tt.s === 1 ? " wa" : "") + '" data-s="1">Đang học</button><button class="btn sm' + (tt.s === 2 ? " ok" : "") + '" data-s="2">' + icon("check") + 'Đã thuộc</button></div>' +
        '<div class="row" style="margin-top:8px"><button class="btn sm' + (sao.has(id) ? " on" : "") + '" id="btnSao">' + icon("star") + (sao.has(id) ? "Đã đánh dấu" : "Đánh dấu") + '</button></div></div></div>' +
      '<div class="scard"><div class="tool"><h4>' + icon("clock") + 'ĐỒNG HỒ</h4><div id="dongHo"></div>' +
        '<label class="lbl" style="margin-top:8px"><input type="checkbox" id="ckTuGhi"' + (caiDat.tuGhi ? " checked" : "") + '> Tự ghi âm khi bắt đầu bấm giờ</label></div></div>' +
      '<div class="scard"><div class="tool"><h4>' + icon("mic") + 'GHI ÂM</h4>' +
        '<div class="row"><button class="btn sm pri" id="btnGhi">' + icon("mic") + 'Ghi âm</button><span id="ghiTT" class="small muted"></span></div>' +
        '<ul class="rec-l" id="dsGhi"></ul>' +
        '<div class="small muted" style="margin-top:8px">Giữ 5 bản gần nhất mỗi câu, lưu trong trình duyệt này. Nghe lại để biết mình có nói đủ ' + L.phutChu(q.phut) + ' không.</div></div></div>' +
      '<div class="scard"><div class="tool tts-ctl"><h4>' + icon("volume") + 'GIỌNG ĐỌC</h4>' +
        '<select id="selGiong"></select>' +
        '<div class="rate"><span>Tốc độ</span><input type="range" id="rgToc" min="0.6" max="1.2" step="0.05" value="' + caiDat.tocDo + '"><b id="tocV">' + caiDat.tocDo.toFixed(2) + '×</b></div>' +
        '<div class="small muted">Shadowing: để 0,8 – 0,9, nói đè lên máy, bắt chước ngữ điệu.</div></div></div>' +
    '</aside></div></div>';
  $("#main").innerHTML = html;
  document.title = q.vi + " — OPIc";

  /* --- câu + chế độ --- */
  var cheDo = caiDat.cheDo, dangTo = -1;
  function veCau() {
    $("#sent").innerHTML = q.cau.map(function (cau, k) {
      if (L.laChiDan(cau)) return '<li class="stage" data-k="' + k + '"><span class="n"></span><span>' + esc(cau) + '</span></li>';
      var parts = L.CHE_DO[cheDo].lam(cau, k);
      var inner = parts.map(function (p) {
        if (p.hid) return '<span class="w hid">' + esc(p.t) + '</span>';
        if (p.cue) return '<span class="cue">' + esc(p.t) + '</span>';
        if (p.blank) return '<span class="txt">' + esc(p.t) + '</span>';
        return esc(p.t);
      }).join("");
      return '<li data-k="' + k + '"' + (k === dangTo ? ' class="on"' : "") + '><span class="n">' + (k + 1) + '</span><span>' + inner + '</span></li>';
    }).join("");
  }
  veCau();
  $("#segCheDo").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    cheDo = b.dataset.v; caiDat.cheDo = cheDo; luuCaiDat();
    $$("button", $("#segCheDo")).forEach(function (x) { x.classList.toggle("on", x === b); });
    veCau();
  });
  function toCau(k) { dangTo = k; $$("#sent li").forEach(function (li) { li.classList.toggle("on", +li.dataset.k === k); }); }
  $("#sent").addEventListener("click", function (e) {
    var li = e.target.closest("li"); if (!li || li.classList.contains("stage")) return;
    dungMoiAmThanh();
    var k = +li.dataset.k; toCau(k);
    TTS.doc(q.cau[k], function () { toCau(-1); });
  });
  var cauNoi = q.cau.filter(function (x) { return !L.laChiDan(x); });
  var chiSo = q.cau.map(function (x, k) { return L.laChiDan(x) ? -1 : k; }).filter(function (k) { return k >= 0; });
  $("#btnDocCa").addEventListener("click", function () {
    dungMoiAmThanh();
    $("#btnDung").hidden = false;
    dungDocDay = TTS.docDay(cauNoi, function (k) { toCau(k < 0 ? -1 : chiSo[k]); }, function () { $("#btnDung").hidden = true; });
  });
  $("#btnDung").addEventListener("click", function () { dungMoiAmThanh(); $("#btnDung").hidden = true; toCau(-1); });
  $("#btnDocHoi").addEventListener("click", function () { dungMoiAmThanh(); TTS.doc(q.en); });
  $("#btnChep").addEventListener("click", function () { chep(cauNoi.join("\n")); });

  /* --- script của tôi + ghi chú --- */
  var ta = $("#taToi"), tLuu;
  function demToi() {
    var tu = L.soTu(ta.value);
    $("#cTu").textContent = tu;
    $("#cGiay").textContent = L.dinhDangGiay(L.uocGiay(tu));
    $("#cNhan").textContent = !tu ? "" : tu < 60 ? "hơi ngắn — thêm một ý hoặc một ví dụ" : tu > 170 ? "hơi dài cho " + L.phutChu(q.phut) + " — cắt bớt" : "độ dài vừa";
  }
  demToi();
  ta.addEventListener("input", function () {
    demToi();
    clearTimeout(tLuu);
    tLuu = setTimeout(function () {
      if (ta.value.trim()) cuaToi[id] = ta.value; else delete cuaToi[id];
      LS.set("cua-toi", cuaToi);
    }, 300);
  });
  $("#btnDocToi").addEventListener("click", function () { if (!ta.value.trim()) { toast("Chưa có script của bạn"); return; } dungMoiAmThanh(); TTS.doc(ta.value); });
  $("#btnChepMau").addEventListener("click", function () {
    if (ta.value.trim() && !confirm("Ghi đè script hiện có bằng script mẫu?")) return;
    ta.value = cauNoi.join("\n"); ta.dispatchEvent(new Event("input")); ta.focus();
  });
  var tg = $("#taGhiChu"), tLuu2;
  tg.addEventListener("input", function () {
    clearTimeout(tLuu2);
    tLuu2 = setTimeout(function () { if (tg.value.trim()) ghiChu[id] = tg.value; else delete ghiChu[id]; LS.set("ghi-chu", ghiChu); }, 300);
  });

  /* --- trạng thái, sao --- */
  $$(".status .btn").forEach(function (b) {
    b.addEventListener("click", function () {
      datTrangThai(id, +b.dataset.s);
      $$(".status .btn").forEach(function (x) { x.className = "btn sm" + (x === b ? (b.dataset.s === "2" ? " ok" : b.dataset.s === "1" ? " wa" : " on") : ""); });
      $("#chipTT").innerHTML = chipTrangThai(id);
      buildNav();
      if (b.dataset.s === "2") toast("Đã thuộc — sẽ ôn lại sau " + L.HOP_NGAY[trangThai(id).hop] + " ngày");
    });
  });
  $("#btnSao").addEventListener("click", function () {
    if (sao.has(id)) sao.delete(id); else sao.add(id);
    LS.set("sao", Array.from(sao));
    $("#btnSao").className = "btn sm" + (sao.has(id) ? " on" : "");
    $("#btnSao").innerHTML = icon("star") + (sao.has(id) ? "Đã đánh dấu" : "Đánh dấu");
  });

  /* --- đồng hồ + ghi âm --- */
  var ghiTT = $("#ghiTT"), btnGhi = $("#btnGhi"), tickGhi;
  function veGhi(dang) {
    if (dang) {
      btnGhi.className = "btn sm ba"; btnGhi.innerHTML = icon("stop") + "Dừng";
      ghiTT.innerHTML = '<span class="rec-dot"></span> đang ghi 0:00';
      clearInterval(tickGhi);
      tickGhi = setInterval(function () { if (!document.body.contains(ghiTT)) { clearInterval(tickGhi); return; } ghiTT.innerHTML = '<span class="rec-dot"></span> đang ghi ' + L.dinhDangGiay(REC.giayDaGhi()); }, 500);
    } else {
      clearInterval(tickGhi);
      btnGhi.className = "btn sm pri"; btnGhi.innerHTML = icon("mic") + "Ghi âm";
      ghiTT.textContent = "";
      veDsGhi();
    }
  }
  function veDsGhi() {
    IDB.theoCau(id).then(function (ds) {
      var ul = $("#dsGhi"); if (!ul) return;
      ul.innerHTML = ds.map(function (r) {
        var url = URL.createObjectURL(r.blob);
        return '<li><span style="min-width:72px">' + L.dinhDangGiay(r.giay) + ' · ' + new Date(r.luc).toLocaleDateString("vi-VN") + '</span><audio controls preload="none" src="' + url + '"></audio>' +
          '<a class="ic-btn" style="width:28px;height:28px" href="' + url + '" download="opic-' + id + '-' + r.luc + '.webm" title="Tải về">' + icon("download") + '</a>' +
          '<button class="ic-btn" style="width:28px;height:28px" data-xoa="' + r.id + '" title="Xoá">' + icon("trash") + '</button>' +
          '<button class="btn sm ai-op-nut" data-ai="' + r.id + '" title="AI nghe và nhận xét bản ghi này" hidden>🤖 Nhận xét</button></li>';
      }).join("") || '<li class="muted">Chưa có bản ghi nào.</li>';
      if (AI && ds.length) AI.trangThai().then(function (s) {
        if (AI.dungDuoc(s)) $$("#dsGhi [data-ai]").forEach(function (b) { b.hidden = false; });
      }, function () {});
    });
  }

  /* --- AI nhận xét bài nói: bản ghi → WAV → POST /ai/opic --- */
  var TEN_TIEU_CHI = { fluency: "Trôi chảy", grammar: "Ngữ pháp", vocabulary: "Từ vựng", pronunciation: "Phát âm",
                       task: "Đúng trọng tâm" };
  /* Script VIẾT (POST /ai/opic/script): không có giọng nói nên không chấm trôi chảy / phát âm. */
  var TIEU_CHI_SCRIPT = { grammar: "Ngữ pháp", vocabulary: "Từ vựng", task: "Đúng trọng tâm", coherence: "Mạch lạc" };
  function nhanXetScript() {
    var hop = $("#aiOp"), chu = ta.value.trim();
    if (chu.split(/\s+/).filter(Boolean).length < 15) { toast("Viết script ít nhất vài câu (15 từ) rồi nhờ AI nhận xét"); ta.focus(); return; }
    hop.hidden = false;
    hop.onclick = null;
    hop.innerHTML = '<div class="sh"><b>✨ Nhận xét script</b></div><div class="tool"><p class="small muted">AI đang đọc script của bạn…</p></div>';
    hop.scrollIntoView({ block: "nearest", behavior: "smooth" });
    var tool = hop.querySelector(".tool");
    AI.goi("opic/script", { question: q.en, questionVi: q.vi, kind: (D.dang[q.dang] || {}).ten || q.dang || "", script: chu })
      .then(function (kq) { veNhanXet(hop, kq, { cat: false }, true); })
      .catch(function (e) {
        tool.innerHTML = '<p class="ai-op-loi">' + esc(e && e.message || e) + "</p>";
        if (e && e.ma === "ai_code_required") tool.appendChild(AI.oMa(nhanXetScript, "btn sm pri"));
      });
  }
  if (AI) AI.trangThai().then(function (s) {
    var b = $("#btnAiScript");
    if (!b || !AI.dungDuoc(s)) return;
    b.hidden = false;
    b.addEventListener("click", nhanXetScript);
    var m = AI.oModel("ai-model-opic");
    b.parentNode.insertBefore(m, b);
  }, function () {});
  function nhanXet(recId) {
    var hop = $("#aiOp");
    hop.hidden = false;
    hop.onclick = null;
    hop.innerHTML = '<div class="sh"><b>🤖 Nhận xét của AI</b></div><div class="tool"><p class="small muted">Đang chuẩn bị bản ghi…</p></div>';
    hop.scrollIntoView({ block: "nearest", behavior: "smooth" });
    var tool = hop.querySelector(".tool");
    IDB.theoCau(id).then(function (ds) {
      var r = ds.filter(function (x) { return x.id === recId; })[0];
      if (!r) throw new Error("Không tìm thấy bản ghi");
      return sangWav(r.blob);
    }).then(function (w) {
      tool.innerHTML = '<p class="small muted">AI đang nghe và chấm' + (w.cat ? " " + AI_GIAY + " giây đầu" : "") + "…</p>";
      return AI.goi("opic", {
        question: q.en, questionVi: q.vi, kind: (D.dang[q.dang] || {}).ten || q.dang || "", script: cuaToi[id] || "",
        audio: base64(w.wav), mime: "audio/wav", seconds: Math.round(w.giay)
      }).then(function (kq) { veNhanXet(hop, kq, w); });
    }).catch(function (e) {
      tool.innerHTML = '<p class="ai-op-loi">' + esc(e && e.message || e) + "</p>";
      if (e && e.ma === "ai_code_required") tool.appendChild(AI.oMa(function () { nhanXet(recId); }, "btn sm pri"));
    });
  }
  function veNhanXet(hop, kq, w, laScript) {
    function ds(xs) { return "<ul>" + xs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; }
    var tieuChi = laScript ? TIEU_CHI_SCRIPT : TEN_TIEU_CHI;
    var diem = Object.keys(tieuChi).map(function (k) {
      var v = Math.max(0, Math.min(5, +kq.scores[k] || 0));
      return '<div class="ai-op-tc"><span>' + tieuChi[k] + '</span><span class="ai-op-cham" aria-hidden="true">' +
        "●●●●●".slice(0, v) + "<i>" + "●●●●●".slice(v) + "</i></span><b>" + v + "/5</b></div>";
    }).join("");
    hop.innerHTML = '<div class="sh"><b>' + (laScript ? "✨ Nhận xét script" : "🤖 Nhận xét của AI") + '</b><span class="chip ac">Ước lượng ' + esc(kq.level) + "</span>" +
      (kq.cached ? '<span class="chip">đã chấm trước đó</span>' : "") + '</div><div class="tool ai-op-than">' +
      (w.cat ? '<p class="small muted">Bản ghi dài hơn ' + AI_GIAY + " giây — AI chấm " + AI_GIAY + " giây đầu.</p>" : "") +
      (kq.summary ? "<p>" + esc(kq.summary) + "</p>" : "") +
      '<div class="ai-op-diem">' + diem + "</div>" +
      (laScript ? "" : "<h4>Lời bạn đã nói</h4><p class=\"ai-op-chep\">" + (esc(kq.transcript) || "<i>(AI không nghe rõ lời nói)</i>") + "</p>") +
      (kq.strengths.length ? "<h4>Điểm mạnh</h4>" + ds(kq.strengths) : "") +
      (kq.fixes.length ? '<h4>Sửa cho tốt hơn</h4><ul class="ai-op-sua">' + kq.fixes.map(function (f) {
        return "<li><s>" + esc(f.said) + "</s> → <b>" + esc(f.better) + "</b>" + (f.why ? "<span>" + esc(f.why) + "</span>" : "") + "</li>";
      }).join("") + "</ul>" : "") +
      (kq.tips.length ? "<h4>Luyện tiếp</h4>" + ds(kq.tips) : "") +
      (kq.better_answer ? '<h4>Một câu trả lời tốt hơn</h4><p class="ai-op-mau">' + esc(kq.better_answer) + "</p>" +
        '<div class="row"><button class="btn sm" data-op="nghe">' + icon("volume") + 'Nghe</button>' +
        '<button class="btn sm" data-op="lay">' + icon("edit") + "Dùng làm script của tôi</button></div>" : "") +
      '<p class="small muted" style="margin-bottom:0">Mức ước lượng chỉ dựa trên một câu trả lời — để tham khảo, không thay bài thi thật.</p></div>';
    hop.onclick = function (e) {
      var b = e.target.closest("[data-op]");
      if (!b) return;
      if (b.dataset.op === "nghe") { dungMoiAmThanh(); TTS.doc(kq.better_answer); return; }
      if (ta.value.trim() && !confirm("Ghi đè script hiện có bằng câu trả lời AI gợi ý?")) return;
      ta.value = kq.better_answer; ta.dispatchEvent(new Event("input")); ta.focus();
    };
  }
  veDsGhi();
  $("#dsGhi").addEventListener("click", function (e) {
    var a = e.target.closest("[data-ai]");
    if (a) { nhanXet(+a.dataset.ai); return; }
    var b = e.target.closest("[data-xoa]"); if (!b) return;
    IDB.xoa(+b.dataset.xoa).then(veDsGhi);
  });
  btnGhi.addEventListener("click", function () {
    if (REC.dang) REC.dung(); else { dungMoiAmThanh(); REC.bat(id, veGhi); }
  });
  var dh = taoDongHo($("#dongHo"), {
    giay: giay,
    onBat: function () { if (caiDat.tuGhi && !REC.dang) REC.bat(id, veGhi); },
    onHet: function () { toast("Hết giờ"); }
  });
  $("#ckTuGhi").addEventListener("change", function (e) { caiDat.tuGhi = e.target.checked; luuCaiDat(); });

  /* --- giọng đọc --- */
  function veGiong() {
    var sel = $("#selGiong"); if (!sel) return;
    if (!TTS.san) { sel.innerHTML = "<option>Trình duyệt không hỗ trợ</option>"; sel.disabled = true; return; }
    TTS.nap();
    var g = TTS.giong();
    sel.innerHTML = TTS.giongs.map(function (v) { return '<option value="' + esc(v.name) + '"' + (g && v.name === g.name ? " selected" : "") + '>' + esc(v.name) + ' (' + esc(v.lang) + ')</option>'; }).join("") || "<option>Chưa có giọng tiếng Anh</option>";
  }
  veGiong();
  if (TTS.san) speechSynthesis.addEventListener("voiceschanged", veGiong);
  $("#selGiong").addEventListener("change", function (e) { caiDat.giong = e.target.value; luuCaiDat(); });
  $("#rgToc").addEventListener("input", function (e) { caiDat.tocDo = +e.target.value; $("#tocV").textContent = caiDat.tocDo.toFixed(2) + "×"; luuCaiDat(); });
}

/* ---------- 15. Luyện thẻ -------------------------------------------- */
var luyen = null;     /* phiên đang chạy: {bo, chuDe, dang, chiDenHan, so, ...} */
function viewLuyen() {
  var qs = location.hash.split("?")[1] || "", cdMacDinh = (qs.match(/cd=([a-z0-9-]+)/) || [])[1];
  if (luyen && luyen.bo && luyen.bo.length && !cdMacDinh) { veTheLuyen(); return; }
  var tk = L.thongKe(D, hoc, caiDat.bo);
  var cfg = Object.assign({ bo: caiDat.bo, chuDe: cdMacDinh ? [cdMacDinh] : D.chuDe.filter(function (c) { return c.uuTien <= 2; }).map(function (c) { return c.id; }),
                            dang: Object.keys(D.dang), uuTienDenHan: true, so: 15 }, LS.get("luyen-cfg", {}));
  if (cdMacDinh) cfg.chuDe = [cdMacDinh];
  $("#main").innerHTML = '<div class="wrap wide" id="lCfg"><h1 class="t">Luyện thẻ</h1><p class="sub">Mỗi thẻ là một câu hỏi: nghe câu hỏi, nói trong khi đồng hồ chạy, rồi hiện script mẫu và script của bạn để so. Chấm <b>Chưa thuộc / Tạm được / Thuộc</b> — thẻ sẽ quay lại sau 1 · 3 · 7 · 14 · 30 ngày. Hôm nay có <b>' + tk.denHan + '</b> thẻ đến hạn.</p>' +
    '<div class="dconf"><span class="small"><b>Bộ</b></span><div class="seg" id="lBo">' + ["AB", "A", "B"].map(function (b) { return '<button data-v="' + b + '"' + (cfg.bo === b ? ' class="on"' : "") + '>' + (b === "AB" ? "Cả hai" : "Bộ " + b) + '</button>'; }).join("") + '</div>' +
      '<span class="small"><b>Số thẻ</b></span><select id="lSo">' + [10, 15, 20, 30, 50].map(function (n) { return '<option' + (cfg.so === n ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select>' +
      '<label class="lbl"><input type="checkbox" id="lDenHan"' + (cfg.uuTienDenHan ? " checked" : "") + '> Ưu tiên thẻ đến hạn, rồi thẻ mới</label></div>' +
    '<div class="dconf"><span class="small"><b>Chủ đề</b> <a href="#" id="lTatCaCd" class="small">tất cả</a> · <a href="#" id="lTrongTam" class="small">trọng tâm</a></span><div class="chk">' +
      D.chuDe.map(function (c) { return '<label><input type="checkbox" data-cd="' + c.id + '"' + (cfg.chuDe.indexOf(c.id) >= 0 ? " checked" : "") + '> ' + c.icon + ' ' + esc(c.ten) + '</label>'; }).join("") + '</div></div>' +
    '<div class="dconf"><span class="small"><b>Dạng</b> <a href="#" id="lTatCaDang" class="small">tất cả</a></span><div class="chk">' +
      Object.keys(D.dang).map(function (d) { return '<label><input type="checkbox" data-dang="' + d + '"' + (cfg.dang.indexOf(d) >= 0 ? " checked" : "") + '> ' + esc(D.dang[d].ten) + '</label>'; }).join("") + '</div></div>' +
    '<div class="row"><button class="btn pri" id="lBat">' + icon("play") + 'Bắt đầu luyện</button><span class="small muted" id="lDem"></span></div>' +
  '</div>';
  function docCfg() {
    cfg.bo = $("#lBo .on").dataset.v;
    cfg.so = +$("#lSo").value;
    cfg.uuTienDenHan = $("#lDenHan").checked;
    cfg.chuDe = $$("[data-cd]:checked").map(function (x) { return x.dataset.cd; });
    cfg.dang = $$("[data-dang]:checked").map(function (x) { return x.dataset.dang; });
    LS.set("luyen-cfg", cfg);
    return cfg;
  }
  function boTheLuyen() {
    var c = docCfg();
    return D.cauHoi.filter(function (q) { return (c.bo === "AB" || q.bo === c.bo) && c.chuDe.indexOf(q.chuDe) >= 0 && c.dang.indexOf(q.dang) >= 0; });
  }
  function dem() { $("#lDem").textContent = boTheLuyen().length + " câu khớp bộ lọc"; }
  dem();
  /* gắn vào khung cấu hình, KHÔNG gắn vào #main: #main sống qua mọi trang, listener
     sẽ chạy khi người dùng đổi ô chọn ở trang khác và đọc phần tử không còn tồn tại */
  $("#lCfg").addEventListener("change", dem);
  $("#lBo").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; $$("button", $("#lBo")).forEach(function (x) { x.classList.toggle("on", x === b); }); dem(); });
  $("#lTatCaCd").addEventListener("click", function (e) { e.preventDefault(); $$("[data-cd]").forEach(function (x) { x.checked = true; }); dem(); });
  $("#lTrongTam").addEventListener("click", function (e) { e.preventDefault(); $$("[data-cd]").forEach(function (x) { x.checked = CD[x.dataset.cd].uuTien === 1; }); dem(); });
  $("#lTatCaDang").addEventListener("click", function (e) { e.preventDefault(); $$("[data-dang]").forEach(function (x) { x.checked = true; }); dem(); });
  $("#lBat").addEventListener("click", function () {
    var c = docCfg(), ds = boTheLuyen(), now = Date.now();
    if (!ds.length) { toast("Không có câu nào khớp bộ lọc"); return; }
    var rand = L.rng(now & 0xffffffff);
    ds = L.tron(ds, rand);
    if (c.uuTienDenHan) {
      var hang = function (q) { var tt = hoc[q.id]; return L.denHan(tt, now) ? 0 : !tt || !tt.s ? 1 : 2; };
      ds.sort(function (a, b) { return hang(a) - hang(b); });
    }
    luyen = { bo: ds.slice(0, c.so), i: 0, ket: [0, 0, 0], hien: false };
    if (location.hash.indexOf("?") >= 0) { location.hash = "#/luyen"; return; }
    veTheLuyen();
  });
}
function veTheLuyen() {
  var s = luyen;
  if (s.i >= s.bo.length) {
    $("#main").innerHTML = '<div class="wrap"><div class="fc"><div class="q">Xong ' + s.bo.length + ' thẻ 🎉</div>' +
      '<div class="kpis" style="margin:0"><div class="kpi"><b>' + s.ket[2] + '</b><span>thuộc</span></div><div class="kpi"><b>' + s.ket[1] + '</b><span>tạm được</span></div><div class="kpi"><b>' + s.ket[0] + '</b><span>chưa thuộc</span></div></div>' +
      '<div class="ft"><button class="btn pri" id="lLai">' + icon("reset") + 'Luyện lại thẻ chưa thuộc</button><button class="btn" id="lMoi">Phiên mới</button><a class="btn" href="#/tien-do">' + icon("chart") + 'Xem tiến độ</a></div></div></div>';
    $("#lLai").addEventListener("click", function () {
      var lai = s.bo.filter(function (q) { return s.chua && s.chua[q.id]; });
      if (!lai.length) { toast("Không còn thẻ chưa thuộc"); return; }
      luyen = { bo: lai, i: 0, ket: [0, 0, 0] }; veTheLuyen();
    });
    $("#lMoi").addEventListener("click", function () { luyen = null; viewLuyen(); });
    return;
  }
  var q = s.bo[s.i], c = CD[q.chuDe], tt = trangThai(q.id), giay = Math.round(q.phut * 60);
  var toi = cuaToi[q.id];
  $("#main").innerHTML = '<div class="wrap"><div class="fc-top" style="max-width:720px;margin:0 auto 12px"><span>Thẻ ' + (s.i + 1) + ' / ' + s.bo.length + '</span><div class="bar"><i style="width:' + Math.round(s.i / s.bo.length * 100) + '%"></i></div><button class="btn sm" id="lThoat">Thoát</button></div>' +
    '<div class="fc"><div class="chips" style="margin:0">' + chipBo(q.bo) + chipDang(q.dang) + '<span class="chip">' + c.icon + ' ' + esc(c.ten) + '</span>' + chipTrangThai(q.id) + (L.denHan(tt) ? '<span class="chip wa">đến hạn</span>' : "") + '</div>' +
      '<div class="q">' + esc(q.vi) + '</div><div class="en">' + esc(q.en) + '</div>' +
      '<div class="row"><button class="btn sm" id="lNghe">' + icon("volume") + 'Nghe câu hỏi</button><button class="btn sm" id="lGhi">' + icon("mic") + 'Ghi âm</button><span class="small muted" id="lGhiTT"></span></div>' +
      '<div id="lDongHo"></div>' +
      '<div class="ans" id="lAns" hidden>' +
        '<div class="small muted" style="margin-bottom:6px"><b>Script mẫu</b> ' + q.id + '</div><ol class="sent" style="padding:0">' + q.cau.map(function (x, k) { return L.laChiDan(x) ? '<li class="stage"><span class="n"></span><span>' + esc(x) + '</span></li>' : '<li data-k="' + k + '"><span class="n">' + (k + 1) + '</span><span>' + esc(x) + '</span></li>'; }).join("") + '</ol>' +
        (toi ? '<div class="small muted" style="margin:10px 0 6px"><b>Script của tôi</b></div><div style="white-space:pre-wrap;padding:8px 12px;background:var(--surf2);border-radius:9px;font-size:15px">' + esc(toi) + '</div>' : '<div class="small muted" style="margin-top:8px">Chưa có script của bạn — <a href="#/script/' + q.id + '">viết ngay</a>.</div>') +
      '</div>' +
      '<div class="ft"><button class="btn pri" id="lHien">' + icon("eye") + 'Hiện script</button><a class="btn" href="#/script/' + q.id + '">' + icon("ext") + 'Mở trang script</a><span class="sp"></span><button class="btn" id="lBo">Bỏ qua</button></div>' +
      '<div class="grade" id="lGrade" hidden>' +
        '<button class="btn ba" data-k="0">Chưa thuộc<small>gặp lại ngày mai</small></button><button class="btn wa" data-k="1">Tạm được<small>gặp lại ngày mai</small></button><button class="btn ok" data-k="2">Thuộc<small>gặp lại sau ' + L.HOP_NGAY[Math.min((tt.hop || 0) + 1, L.HOP_NGAY.length - 1)] + ' ngày</small></button></div>' +
    '</div></div>';
  var dh = taoDongHo($("#lDongHo"), { giay: giay, onHet: function () { toast("Hết giờ — hiện script để so"); } });
  $("#lThoat").addEventListener("click", function () { luyen = null; dungMoiAmThanh(); viewLuyen(); });
  $("#lNghe").addEventListener("click", function () { dungMoiAmThanh(); TTS.doc(q.en); });
  var ghiTT = $("#lGhiTT"), tick;
  $("#lGhi").addEventListener("click", function () {
    if (REC.dang) { REC.dung(); return; }
    REC.bat(q.id, function (dang) {
      $("#lGhi").innerHTML = dang ? icon("stop") + "Dừng" : icon("mic") + "Ghi âm";
      $("#lGhi").className = "btn sm" + (dang ? " ba" : "");
      clearInterval(tick);
      if (dang) tick = setInterval(function () { if (!document.body.contains(ghiTT)) { clearInterval(tick); return; } ghiTT.innerHTML = '<span class="rec-dot"></span> ' + L.dinhDangGiay(REC.giayDaGhi()); }, 500);
      else ghiTT.textContent = "đã lưu";
    });
  });
  $("#lHien").addEventListener("click", function () {
    $("#lAns").hidden = false; $("#lGrade").hidden = false; $("#lHien").hidden = true; dh.dung();
    $("#lAns").querySelectorAll("li[data-k]").forEach(function (li) { li.addEventListener("click", function () { dungMoiAmThanh(); TTS.doc(q.cau[+li.dataset.k]); }); });
  });
  $("#lBo").addEventListener("click", function () { dungMoiAmThanh(); if (REC.dang) REC.dung(); s.i++; veTheLuyen(); });
  $("#lGrade").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var k = +b.dataset.k;
    hoc[q.id] = L.cham(hoc[q.id], k); luuHoc();
    ghiLuyen();
    s.ket[k]++;
    if (k === 0) { s.chua = s.chua || {}; s.chua[q.id] = true; }
    dungMoiAmThanh(); if (REC.dang) REC.dung();
    s.i++; veTheLuyen();
  });
}

/* ---------- 16. Thi thử ---------------------------------------------- */
var thi = null;       /* {de, i, batDau, ket: [], hat} */
function viewThiThu() {
  if (thi && thi.dang) { veCauThi(); return; }
  var cfg = Object.assign({ bo: caiDat.bo, uuTien: 2 }, LS.get("thi-cfg", {}));
  var de = thi && thi.de ? thi.de : null;
  $("#main").innerHTML = '<div class="wrap wide"><h1 class="t">Thi thử 15 câu</h1><p class="sub">Đề sinh đúng cấu trúc thật: câu 1 giới thiệu · ba cụm chủ đề × 3 câu · hai câu diễn · một câu giải quyết tình huống · hai câu cảm nghĩ. Ava đọc câu hỏi hai lần, đồng hồ chạy theo dạng câu, ghi âm từng câu nếu bạn bật.</p>' +
    '<div class="dconf"><span class="small"><b>Bộ</b></span><div class="seg" id="tBo">' + ["AB", "A", "B"].map(function (b) { return '<button data-v="' + b + '"' + (cfg.bo === b ? ' class="on"' : "") + '>' + (b === "AB" ? "Cả hai" : "Bộ " + b) + '</button>'; }).join("") + '</div>' +
      '<span class="small"><b>Phạm vi</b></span><div class="seg" id="tUu">' + [[1, "9 chủ đề trọng tâm"], [2, "+ hay gặp"], [3, "tất cả"]].map(function (u) { return '<button data-v="' + u[0] + '"' + (cfg.uuTien === u[0] ? ' class="on"' : "") + '>' + u[1] + '</button>'; }).join("") + '</div>' +
      '<label class="lbl"><input type="checkbox" id="tHaiLan"' + (caiDat.docHaiLan ? " checked" : "") + '> Đọc câu hỏi 2 lần</label>' +
      '<label class="lbl"><input type="checkbox" id="tAnChu"' + (caiDat.anChu ? " checked" : "") + '> Che chữ câu hỏi (chỉ nghe)</label>' +
      '<label class="lbl"><input type="checkbox" id="tTuGhi"' + (caiDat.tuGhi ? " checked" : "") + '> Tự ghi âm mỗi câu</label>' +
      '<button class="btn pri" id="tTao">' + icon("shuffle") + (de ? "Tạo đề khác" : "Tạo đề") + '</button></div>' +
    '<div id="tDe"></div>' +
    '<div class="sec-h"><h2>Lịch sử thi thử</h2><span class="muted">' + lichSu.length + ' đề</span></div><div id="tLs"></div></div>';
  function docCfg() { cfg.bo = $("#tBo .on").dataset.v; cfg.uuTien = +$("#tUu .on").dataset.v; LS.set("thi-cfg", cfg); }
  function veDe() {
    if (!de) { $("#tDe").innerHTML = '<div class="empty">Bấm <b>Tạo đề</b> để sinh 15 câu.</div>'; return; }
    $("#tDe").innerHTML = '<div class="card" style="margin-top:14px"><ol class="ex-list">' + de.map(function (d) {
      return '<li><span class="no">' + d.so + '</span><span><span class="grp">' + esc(d.nhom) + (d.chuDe && CD[d.chuDe] ? ' · ' + CD[d.chuDe].icon + ' ' + esc(CD[d.chuDe].ten) : "") + '</span><a href="#/script/' + d.q.id + '">' + esc(d.q.vi) + '</a></span>' + chipDang(d.q.dang) + '</li>';
    }).join("") + '</ol><div class="row" style="margin-top:14px"><button class="btn pri" id="tBat">' + icon("play") + 'Bắt đầu thi (≈ ' + Math.round(de.reduce(function (s, d) { return s + d.q.phut; }, 0) + 15 * 0.5) + ' phút)</button><button class="btn" id="tChepDe">' + icon("copy") + 'Chép danh sách câu hỏi</button></div></div>';
    $("#tBat").addEventListener("click", function () {
      thi = { de: de, i: 0, batDau: Date.now(), ket: [], dang: true, hienScript: false };
      veCauThi();
    });
    $("#tChepDe").addEventListener("click", function () { chep(de.map(function (d) { return d.so + ". " + d.q.en; }).join("\n")); });
  }
  function veLs() {
    $("#tLs").innerHTML = lichSu.length ? '<table class="ex-hist"><thead><tr><th>Lúc</th><th>Câu đã làm</th><th>Thời gian</th><th></th></tr></thead><tbody>' + lichSu.slice().reverse().map(function (r, k) {
      return '<tr><td>' + ngayGio(r.luc) + '</td><td>' + r.xong + '/' + r.de.length + '</td><td>' + L.dinhDangGiay(r.giay) + '</td><td><button class="btn sm" data-lai="' + (lichSu.length - 1 - k) + '">Làm lại đề này</button></td></tr>';
    }).join("") + '</tbody></table>' : '<div class="empty">Chưa làm đề nào. Mục tiêu: 10 đề trước ngày thi.</div>';
    $$("[data-lai]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = lichSu[+b.dataset.lai];
        de = r.de.map(function (id, k) { return { q: CAU[id], so: k + 1, nhom: r.nhom ? r.nhom[k] : "" }; }).filter(function (d) { return d.q; });
        thi = { de: de }; veDe(); window.scrollTo(0, 0);
      });
    });
  }
  veDe(); veLs();
  $("#tBo").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; $$("button", $("#tBo")).forEach(function (x) { x.classList.toggle("on", x === b); }); docCfg(); });
  $("#tUu").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; $$("button", $("#tUu")).forEach(function (x) { x.classList.toggle("on", x === b); }); docCfg(); });
  $("#tHaiLan").addEventListener("change", function (e) { caiDat.docHaiLan = e.target.checked; luuCaiDat(); });
  $("#tAnChu").addEventListener("change", function (e) { caiDat.anChu = e.target.checked; luuCaiDat(); });
  $("#tTuGhi").addEventListener("change", function (e) { caiDat.tuGhi = e.target.checked; luuCaiDat(); });
  $("#tTao").addEventListener("click", function () {
    docCfg();
    de = L.sinhDe(D, { bo: cfg.bo, uuTienToiDa: cfg.uuTien, hat: Date.now() & 0xffffffff });
    thi = { de: de }; veDe(); $("#tTao").innerHTML = icon("shuffle") + "Tạo đề khác";
  });
}
function veCauThi() {
  var s = thi;
  if (s.i >= s.de.length) { ketThucThi(); return; }
  var d = s.de[s.i], q = d.q, c = CD[q.chuDe], giay = Math.round(q.phut * 60);
  $("#main").innerHTML = '<div class="wrap"><div class="exam">' +
    '<div class="ex-top"><b>Câu ' + d.so + ' / 15</b><span>' + esc(d.nhom) + (d.chuDe && CD[d.chuDe] ? ' · ' + esc(CD[d.chuDe].ten) : "") + '</span><div class="bar"><i style="width:' + Math.round(s.i / 15 * 100) + '%"></i></div><button class="btn sm" id="eThoat">Dừng thi</button></div>' +
    '<div class="ex-q">' +
      '<div class="ava"><div class="face" id="eFace">Ava</div><div class="who"><b>Ava — giám khảo ảo</b>' + chipDang(q.dang) + ' <span class="chip">' + icon("clock") + L.phutChu(q.phut) + '</span></div></div>' +
      '<div class="qt' + (caiDat.anChu ? " hid" : "") + '" id="eQt">' + esc(q.en) + '</div>' +
      '<div class="vi">' + esc(q.vi) + '</div>' +
      '<div class="row"><button class="btn sm" id="eNgheLai">' + icon("volume") + 'Nghe lại</button>' + (caiDat.anChu ? '<button class="btn sm" id="eHienChu">' + icon("eye") + 'Hiện chữ</button>' : "") +
        '<button class="btn sm" id="eGhi">' + icon("mic") + 'Ghi âm</button><span class="small muted" id="eGhiTT"></span></div>' +
      '<div id="eDongHo"></div>' +
      '<div id="eScript" hidden><div class="small muted" style="margin-bottom:6px"><b>Script mẫu</b> ' + q.id + '</div><ol class="sent" style="padding:0">' + q.cau.map(function (x, k) { return '<li' + (L.laChiDan(x) ? ' class="stage"' : "") + '><span class="n">' + (L.laChiDan(x) ? "" : k + 1) + '</span><span>' + esc(x) + '</span></li>'; }).join("") + '</ol>' +
        (cuaToi[q.id] ? '<div class="small muted" style="margin:10px 0 6px"><b>Script của tôi</b></div><div style="white-space:pre-wrap;padding:8px 12px;background:var(--surf2);border-radius:9px;font-size:15px">' + esc(cuaToi[q.id]) + '</div>' : "") + '</div>' +
      '<div class="row"><button class="btn pri" id="eTiep">' + icon("right") + (s.i === 14 ? "Nộp bài" : "Xong câu này") + '</button><button class="btn" id="eHienScript">' + icon("eye") + 'Hiện script mẫu</button></div>' +
    '</div></div></div>';
  var dh = taoDongHo($("#eDongHo"), { giay: giay, onHet: function () { toast("Hết giờ câu " + d.so); } });
  var face = $("#eFace"), batDauCau = Date.now();
  function docHoi(lan) {
    face.classList.add("talk");
    TTS.doc(q.en, function () {
      if (lan > 1) { setTimeout(function () { docHoi(lan - 1); }, 700); return; }
      face.classList.remove("talk");
      if (!dh.dangChay()) dh.bat();
      if (caiDat.tuGhi && !REC.dang) REC.bat(q.id, veGhi);
    });
  }
  var ghiTT = $("#eGhiTT"), tick;
  function veGhi(dang) {
    $("#eGhi").innerHTML = dang ? icon("stop") + "Dừng" : icon("mic") + "Ghi âm";
    $("#eGhi").className = "btn sm" + (dang ? " ba" : "");
    clearInterval(tick);
    if (dang) tick = setInterval(function () { if (!document.body.contains(ghiTT)) { clearInterval(tick); return; } ghiTT.innerHTML = '<span class="rec-dot"></span> ' + L.dinhDangGiay(REC.giayDaGhi()); }, 500);
    else ghiTT.textContent = "đã lưu";
  }
  if (TTS.san) docHoi(caiDat.docHaiLan ? 2 : 1); else { dh.bat(); if (caiDat.tuGhi) REC.bat(q.id, veGhi); }
  $("#eNgheLai").addEventListener("click", function () { dungMoiAmThanh(); docHoi(1); });
  if ($("#eHienChu")) $("#eHienChu").addEventListener("click", function () { $("#eQt").classList.remove("hid"); });
  $("#eGhi").addEventListener("click", function () { if (REC.dang) REC.dung(); else REC.bat(q.id, veGhi); });
  $("#eHienScript").addEventListener("click", function () { $("#eScript").hidden = !$("#eScript").hidden; s.hienScript = true; });
  $("#eThoat").addEventListener("click", function () {
    if (!confirm("Dừng thi thử? Kết quả các câu đã làm vẫn được lưu.")) return;
    dungMoiAmThanh(); if (REC.dang) REC.dung(); dh.dung(); ketThucThi(true);
  });
  $("#eTiep").addEventListener("click", function () {
    dungMoiAmThanh(); dh.dung(); if (REC.dang) REC.dung();
    s.ket.push({ id: q.id, giay: Math.round((Date.now() - batDauCau) / 1000), gioiHan: giay, xemScript: !$("#eScript").hidden });
    ghiLuyen(q.id);
    s.i++; veCauThi();
  });
}
function ketThucThi(som) {
  var s = thi; s.dang = false;
  var tong = Math.round((Date.now() - s.batDau) / 1000);
  lichSu.push({ luc: Date.now(), de: s.de.map(function (d) { return d.q.id; }), nhom: s.de.map(function (d) { return d.nhom; }), xong: s.ket.length, giay: tong });
  if (lichSu.length > 50) lichSu = lichSu.slice(-50);
  LS.set("thi", lichSu);
  $("#main").innerHTML = '<div class="wrap"><div class="exam"><h1 class="t">' + (som ? "Đã dừng" : "Nộp bài") + ' — ' + s.ket.length + ' / 15 câu · ' + L.dinhDangGiay(tong) + '</h1>' +
    '<p class="sub">Nghe lại các bản ghi ở từng trang script (mục Ghi âm). Câu nào nói chưa đủ thời gian hoặc phải xem script thì chấm "Chưa thuộc" để thẻ quay lại ngày mai.</p>' +
    '<table class="ex-hist"><thead><tr><th>#</th><th>Câu hỏi</th><th>Dạng</th><th>Thời gian</th><th></th></tr></thead><tbody>' + s.ket.map(function (r, k) {
      var q = CAU[r.id];
      return '<tr><td>' + (k + 1) + '</td><td><a href="#/script/' + q.id + '">' + esc(q.vi) + '</a></td><td>' + chipDang(q.dang) + '</td><td>' + L.dinhDangGiay(r.giay) + ' / ' + L.dinhDangGiay(r.gioiHan) + (r.xemScript ? ' <span class="chip wa">xem script</span>' : "") + '</td><td><a class="btn sm" href="#/script/' + q.id + '">Luyện</a></td></tr>';
    }).join("") + '</tbody></table>' +
    '<div class="row" style="margin-top:18px"><button class="btn pri" id="eLai">' + icon("shuffle") + 'Đề mới</button><a class="btn" href="#/tien-do">' + icon("chart") + 'Tiến độ</a></div></div></div>';
  $("#eLai").addEventListener("click", function () { thi = null; viewThiThu(); });
  thi = { de: s.de };
}

/* ---------- 17. Tiến độ & sao lưu ------------------------------------ */
function viewTienDo() {
  var tk = L.thongKe(D, hoc, caiDat.bo), chuoi = L.chuoiNgay(nhatKy), tongLuyen = 0;
  Object.keys(nhatKy).forEach(function (k) { tongLuyen += nhatKy[k]; });
  var soToi = Object.keys(cuaToi).length;
  /* bản đồ nhiệt 12 tuần: mỗi ô một ngày, một màu nhấn đậm dần theo số lần luyện */
  var oNgay = [], d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 83);
  for (var k = 0; k < 84; k++) { var key = L.ngayKey(d), n = nhatKy[key] || 0; oNgay.push('<i class="' + (n >= 6 ? "l3" : n >= 3 ? "l2" : n >= 1 ? "l1" : "") + '" title="' + key + ': ' + n + ' lần"></i>'); d.setDate(d.getDate() + 1); }
  $("#main").innerHTML = '<div class="wrap wide"><h1 class="t">Tiến độ</h1><p class="sub">Mọi thứ lưu trong trình duyệt này. Xuất tệp JSON để sao lưu hoặc đem sang máy khác; bản ghi âm không nằm trong tệp xuất.</p>' +
    '<div class="dconf"><span class="small"><b>Tôi học bộ</b></span><div class="seg" id="pBo">' + ["AB", "A", "B"].map(function (b) { return '<button data-v="' + b + '"' + (caiDat.bo === b ? ' class="on"' : "") + '>' + (b === "AB" ? "Cả hai" : "Bộ " + b) + '</button>'; }).join("") + '</div><span class="small muted">— quyết định mẫu số của vòng tiến độ và các bộ đếm dưới đây.</span></div>' +
    '<div class="kpis">' + kpi(tk.thuoc + '<small>/ ' + tk.tong + '</small>', "đã thuộc", tk.pt) + kpi(tk.dangHoc, "đang học") + kpi(tk.denHan, "đến hạn ôn") + kpi(soToi, "script của tôi đã viết") + kpi(chuoi + '<small>ngày</small>', "chuỗi ngày") + kpi(tongLuyen, "lần luyện tổng cộng") + kpi(lichSu.length + '<small>/ 10</small>', "đề thi thử đã làm", Math.min(1, lichSu.length / 10)) + '</div>' +
    '<div class="card"><h3>12 tuần gần nhất</h3><div class="heat">' + oNgay.join("") + '</div><div class="heat-l">ít <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i> nhiều — mỗi ô một ngày, đậm dần theo số lần ghi âm / chấm thẻ / câu thi thử</div></div>' +
    '<div class="sec-h"><h2>Theo chủ đề</h2></div><table class="ptable"><thead><tr><th>Chủ đề</th><th>Ưu tiên</th><th class="num">Tổng</th><th class="num">Thuộc</th><th class="num">Đang học</th><th class="num">Đến hạn</th><th></th></tr></thead><tbody>' +
      D.chuDe.map(function (c) {
        var t = tk.theoChuDe[c.id], u = UU_TIEN[c.uuTien];
        return '<tr><td><a href="#/chu-de/' + c.id + '">' + c.icon + ' ' + esc(c.ten) + '</a></td><td><span class="chip ' + u[1] + '">' + u[0] + '</span></td><td class="num">' + t.tong + '</td><td class="num">' + t.thuoc + '</td><td class="num">' + t.dangHoc + '</td><td class="num">' + t.denHan + '</td><td><div class="bar"><i style="width:' + (t.tong ? Math.round(t.thuoc / t.tong * 100) : 0) + '%"></i></div></td></tr>';
      }).join("") + '</tbody></table>' +
    '<div class="sec-h"><h2>Sao lưu</h2></div><div class="row"><button class="btn" id="pXuat">' + icon("download") + 'Xuất JSON</button><button class="btn" id="pNhap">' + icon("upload") + 'Nhập JSON</button><input type="file" id="pTep" accept="application/json" hidden><span class="sp" style="flex:1"></span><button class="btn ba" id="pXoa">' + icon("trash") + 'Xoá toàn bộ tiến độ</button></div>' +
    '<p class="small muted" style="margin-top:8px">Tệp xuất gồm: trạng thái từng script, script của tôi, ghi chú, đánh dấu sao, bài đã đọc, nhật ký luyện, lịch sử thi thử, cài đặt.</p>' +
  '</div>';
  $("#pBo").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; caiDat.bo = b.dataset.v; luuCaiDat(); paintProgress(); viewTienDo(); buildNav(); });
  $("#pXuat").addEventListener("click", function () {
    var data = { phienBan: 1, luc: Date.now(), hoc: hoc, cuaToi: cuaToi, ghiChu: ghiChu, sao: Array.from(sao), daDoc: Array.from(daDoc), nhatKy: nhatKy, thi: lichSu, caiDat: caiDat };
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = "opic-tien-do-" + L.ngayKey() + ".json"; a.click();
  });
  $("#pNhap").addEventListener("click", function () { $("#pTep").click(); });
  $("#pTep").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        if (!data || typeof data !== "object" || !data.hoc) throw new Error("không đúng định dạng");
        if (!confirm("Thay toàn bộ tiến độ hiện tại bằng tệp này?")) return;
        LS.set("hoc", data.hoc || {}); LS.set("cua-toi", data.cuaToi || {}); LS.set("ghi-chu", data.ghiChu || {});
        LS.set("sao", data.sao || []); LS.set("da-doc", data.daDoc || []); LS.set("nhat-ky", data.nhatKy || {});
        LS.set("thi", data.thi || []); LS.set("cai-dat", data.caiDat || {});
        location.reload();
      } catch (err) { toast("Không đọc được tệp: " + err.message); }
    };
    r.readAsText(f);
  });
  $("#pXoa").addEventListener("click", function () {
    if (!confirm("Xoá toàn bộ tiến độ, script của tôi, ghi chú và lịch sử thi thử? Không hoàn tác được.")) return;
    ["hoc", "cua-toi", "ghi-chu", "sao", "da-doc", "nhat-ky", "thi", "cuoi", "luyen-cfg", "thi-cfg"].forEach(LS.del);
    location.reload();
  });
}

/* ---------- 18. Tìm kiếm --------------------------------------------- */
var srch = { chon: 0, kq: [] };
function moTim(q) {
  $("#ovl").hidden = false;
  var inp = $("#q"); inp.value = q || ""; inp.focus(); inp.select();
  veKq();
}
function dongTim() { $("#ovl").hidden = true; }
function veKq() {
  var q = $("#q").value.trim(), res = $("#res");
  if (!q) {
    res.innerHTML = '<div class="small muted" style="padding:10px 12px">Gõ không dấu vẫn ra: <code>nha cua</code>, <code>so sanh</code>, <code>park</code>, <code>role play</code>, <code>A09</code>…</div>';
    srch.kq = []; return;
  }
  srch.kq = L.timKiem(D, q, 30); srch.chon = 0;
  if (!srch.kq.length) { res.innerHTML = '<div class="empty" style="margin:8px">Không tìm thấy gì cho “' + esc(q) + '”.</div>'; return; }
  res.innerHTML = srch.kq.map(function (r, k) {
    var href = r.loai === "script" ? "#/script/" + r.id : r.loai === "huong-dan" ? "#/huong-dan/" + r.id : "#/chu-de/" + r.id;
    var nhan = r.loai === "script" ? r.id : r.loai === "huong-dan" ? "HD" : "CĐ";
    return '<a class="sr' + (k === 0 ? " on" : "") + '" href="' + href + '" data-k="' + k + '"><span class="k">' + esc(nhan) + '</span><span><b>' + toSang(r.ten, q) + '</b><span>' + toSang(r.mo, q) + '</span></span></a>';
  }).join("");
}
function toSang(text, q) { return L.toSang(text, q).map(function (p) { return p.on ? "<mark>" + esc(p.t) + "</mark>" : esc(p.t); }).join(""); }
$("#btnSearch").addEventListener("click", function () { moTim(""); });
$("#btnCloseSrch").addEventListener("click", dongTim);
$("#ovl").addEventListener("click", function (e) { if (e.target === $("#ovl")) dongTim(); });
$("#res").addEventListener("click", function () { dongTim(); });
$("#q").addEventListener("input", veKq);
$("#q").addEventListener("keydown", function (e) {
  if (!srch.kq.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    srch.chon = (srch.chon + (e.key === "ArrowDown" ? 1 : -1) + srch.kq.length) % srch.kq.length;
    $$(".sr").forEach(function (a, k) { a.classList.toggle("on", k === srch.chon); });
    var on = $(".sr.on"); if (on) on.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    var on = $(".sr.on"); if (on) { location.hash = on.getAttribute("href"); dongTim(); }
  }
});
document.addEventListener("keydown", function (e) {
  var tag = (e.target.tagName || "").toLowerCase(), trongO = tag === "input" || tag === "textarea" || tag === "select";
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); moTim(""); return; }
  if (e.key === "Escape") { if (!$("#ovl").hidden) dongTim(); else document.body.classList.remove("nav-open"); return; }
  if (trongO) return;
  if (e.key === "/") { e.preventDefault(); moTim(""); }
  else if (e.key === "[" || e.key === "]") {
    var pn = $$(".pn a[href]"); var a = e.key === "[" ? pn[0] : pn[pn.length - 1];
    if (a && a.getAttribute("href") && ((e.key === "[" && !a.classList.contains("r")) || (e.key === "]" && a.classList.contains("r")))) location.hash = a.getAttribute("href");
  }
});

/* ---------- 19. Khởi động -------------------------------------------- */
paintProgress();
var q0 = (location.search.match(/[?&]q=([^&]+)/) || [])[1];
route();
if (q0) moTim(decodeURIComponent(q0.replace(/\+/g, " ")));
window.addEventListener("beforeunload", function () { if (REC.dang) REC.dung(); });
}   /* chay(D) */
})();
