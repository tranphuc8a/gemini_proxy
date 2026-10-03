/* ==========================================================================
   CỜ TƯỚNG MỖI NGÀY — đoán nước đi của kỳ thủ trong một ván thật.

   Mỗi ngày (theo lịch của máy) một ván trong game/games.js. Sau 12 nước khai
   cuộc (13 vào ngày lẻ — ngày đó cầm quân Đen) người chơi cầm bên tới lượt và
   đoán 8 nước kỳ thủ đã đi: đúng ngay 3 điểm, lần hai 2, sai cả hai 0 (nước
   thật được bày ra). Mỗi gợi ý — quân cần đi, hoặc nước engine Wukong chọn
   (chạy trong Web Worker, không làm đơ trang) — trừ 1 điểm của nước đó.

   localStorage "xq.daily": {choi: {ngày: {van, d: [điểm 8 nước]}}, dang: tiến
   độ của ván hôm nay (tải lại trang không mất), chuoi, kyLuc, cuoiNgay}.

     ?ngay=YYYY-MM-DD   ván của một ngày khác — luyện, không tính chuỗi
     ?van=<id>          luyện một ván bất kỳ; ?van= (để trống) chọn ngẫu nhiên
   ========================================================================== */
(function () {
  "use strict";

  var ROUNDS = 8, OPENING = 12, BOT_MS = 1500;
  var KEY = "xq.daily", AM_KEY = "xq.daily.am";
  var TEN = ["", "Tốt", "Sĩ", "Tượng", "Mã", "Pháo", "Xe", "Tướng"];
  var EMOJI = ["🟥", "🟧", "🟨", "🟩"];
  var engine = new Engine();

  function $(id) { return document.getElementById(id); }
  function docLS(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function ghiLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* riêng tư / đầy: chơi tiếp, không lưu */ } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------------------------------------------------------- ngày */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoNgay(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function soNgay(iso) { var p = iso.split("-"); return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
  function hienNgay(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function homTruoc(iso) { var p = iso.split("-"); return isoNgay(new Date(+p[0], +p[1] - 1, +p[2] - 1)); }

  /* ------------------------------------------------------ chọn ván, bên */
  var POOL = Games.filter(function (g) { return g.moves.trim().split(/\s+/).length >= OPENING + 2 + 2 * ROUNDS; });
  var q = new URLSearchParams(location.search);
  var hom = isoNgay(new Date());
  var ngay = /^\d{4}-\d{2}-\d{2}$/.test(q.get("ngay") || "") ? q.get("ngay") : hom;
  var theoVan = q.has("van");
  var luyen = theoVan || ngay !== hom;
  var game, lech;
  if (theoVan) {
    var id = parseInt(q.get("van"), 10);
    game = POOL.filter(function (g) { return g.id === id; })[0] || POOL[Math.floor(Math.random() * POOL.length)];
    lech = game.id % 2;
  } else {
    game = POOL[(Math.imul(soNgay(ngay), 2654435761) >>> 0) % POOL.length];
    lech = soNgay(ngay) % 2;
  }
  var plies = game.moves.trim().split(/\s+/);
  var start = OPENING + lech;           // nước đầu tiên phải đoán (chỉ số ply)
  var ben = start % 2;                  // 0 = Đỏ, 1 = Đen — bên người chơi cầm
  var tenKyThu = ben ? game.black : game.red;

  /* -------------------------------------------------------------- trạng thái */
  var luu = docLS(KEY) || {};
  luu.choi = luu.choi || {};
  var S = { round: 0, tries: 0, sai: [], goiY: false, may: null, ket: [], chon: null, dich: [], dau: {}, ban: false,
            xong: false, xem: -1 };
  var am = docLS(AM_KEY) !== false;
  var tiengDi = new Audio("game/sounds/move.wav"), tiengAn = new Audio("game/sounds/capture.wav");
  tiengDi.volume = tiengAn.volume = 0.5;

  function plyDoan() { return start + 2 * S.round; }
  function tong(ket) { return ket.reduce(function (a, k) { return a + k.d; }, 0); }

  /* ---------------------------------------------------------------- bàn cờ */
  var banEl = $("ban"), oEl = {};

  function oVuong(file, rank) { return (11 - rank) * 11 + file + 1; }
  function tenQuan(p) { return TEN[p > 7 ? p - 7 : p] + (p > 7 ? " đen" : " đỏ"); }
  function cuaMinh(p) { return ben === 0 ? p >= 1 && p <= 7 : p >= 8 && p <= 14; }

  function luoi() {
    function l(x1, y1, x2, y2) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>'; }
    var s = '<svg viewBox="0 0 900 1000" aria-hidden="true"><g style="stroke:var(--wood-line);stroke-width:3;fill:none">' +
      '<rect x="50" y="50" width="800" height="900" style="stroke-width:5"/>';
    for (var j = 1; j < 9; j++) s += l(50, 50 + 100 * j, 850, 50 + 100 * j);
    for (var i = 1; i < 8; i++) s += l(50 + 100 * i, 50, 50 + 100 * i, 450) + l(50 + 100 * i, 550, 50 + 100 * i, 950);
    s += l(350, 50, 550, 250) + l(550, 50, 350, 250) + l(350, 750, 550, 950) + l(550, 750, 350, 950);
    return s + '</g><text x="450" y="514" text-anchor="middle" font-size="42" font-family="serif" letter-spacing="34" ' +
      'style="fill:var(--wood-line);opacity:.7">楚 河　　漢 界</text></svg>';
  }

  function dungBan() {
    banEl.innerHTML = luoi();
    for (var r = 9; r >= 0; r--) {
      for (var f = 0; f < 9; f++) {
        var sq = oVuong(f, r), b = document.createElement("button");
        b.type = "button";
        b.className = "o";
        b.dataset.sq = sq;
        b.dataset.ten = engine.squareToString(sq);
        // Người cầm Đen ngồi phía dưới: lật bàn.
        b.style.left = ((ben ? 8 - f : f) * 100 / 9) + "%";
        b.style.top = ((ben ? r : 9 - r) * 10) + "%";
        oEl[sq] = b;
        banEl.appendChild(b);
      }
    }
  }

  function veQuan() {
    var dich = {};
    S.dich.forEach(function (sq) { dich[sq] = 1; });
    Object.keys(oEl).forEach(function (k) {
      var sq = +k, b = oEl[k], p = engine.getPiece(sq), lop = "o";
      for (var ten in S.dau) if (S.dau[ten].indexOf(sq) >= 0) lop += " " + ten;
      if (S.chon === sq) lop += " chon";
      if (dich[sq]) lop += " dich" + (p ? " an" : "");
      var anh = p ? "game/images/traditional_pieces/" + p + ".svg" : "";
      if (b.dataset.anh !== anh) {
        b.innerHTML = p ? '<img src="' + anh + '" alt="">' : "";
        b.dataset.anh = anh;
      }
      b.className = lop;
      b.setAttribute("aria-label", b.dataset.ten + (p ? ", " + tenQuan(p) : ", trống") + (dich[sq] ? ", đi tới được" : ""));
    });
  }

  function viTri(n) {
    engine.setBoard(engine.START_FEN);
    if (n > 0) engine.loadMoves(plies.slice(0, n).join(" "));
    S.dau = {};
    if (n > 0) danhDau("cuoi", plies[n - 1]);
  }

  function hai(nuoc) {
    var m = engine.moveFromString(nuoc);
    return m ? [engine.getSourceSquare(m), engine.getTargetSquare(m)] : [];
  }
  function danhDau(ten, nuoc) { S.dau[ten] = nuoc ? hai(nuoc) : []; }

  function moTa(nuoc) {
    var m = engine.moveFromString(nuoc);
    var p = m ? engine.getPiece(engine.getSourceSquare(m)) : 0;
    return (p ? TEN[p > 7 ? p - 7 : p] + " " : "") + nuoc.slice(0, 2) + "→" + nuoc.slice(2, 4);
  }

  function keu(an) {
    if (!am) return;
    var a = an ? tiengAn : tiengDi;
    try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* không tiếng thì thôi */ }
  }

  function diNuoc(nuoc) {
    var m = engine.moveFromString(nuoc);
    var an = !!engine.getCaptureFlag(m);
    S.dau = {};
    danhDau("cuoi", nuoc);
    engine.makeMove(m);
    keu(an);
  }

  /* ----------------------------------------------------------------- chơi */
  function bam(sq) {
    if (S.ban || S.xong || S.xem >= 0) return;
    if (S.chon !== null && S.dich.indexOf(sq) >= 0) {
      doan(engine.squareToString(S.chon) + engine.squareToString(sq));
      return;
    }
    var p = engine.getPiece(sq);
    if (p && cuaMinh(p) && S.chon !== sq) {
      S.chon = sq;
      S.dich = engine.generateLegalMoves()
        .filter(function (x) { return engine.getSourceSquare(x.move) === sq; })
        .map(function (x) { return engine.getTargetSquare(x.move); });
      if (!S.dich.length) nhan("Quân này không đi được nước nào.");
    } else {
      S.chon = null;
      S.dich = [];
    }
    veQuan();
  }

  function doan(nuoc) {
    var dung = plies[plyDoan()];
    S.chon = null;
    S.dich = [];
    if (nuoc === dung) return xongNuoc(S.tries === 0 ? 3 : 2);
    S.sai.push(nuoc);
    S.tries++;
    if (S.tries < 2) {
      nhan('<span class="sai">Chưa phải.</span> Kỳ thủ không đi ' + esc(moTa(nuoc)) +
        ". Thử lần nữa — đúng lần này được 2 điểm.");
      veQuan();
      return;
    }
    xongNuoc(0);
  }

  function xongNuoc(goc) {
    var dung = plies[plyDoan()], tra = plies[plyDoan() + 1];
    var d = Math.max(0, goc - (S.goiY ? 1 : 0) - (S.may ? 1 : 0));
    var loi = goc ? '<span class="tot">Chính xác!</span> ' + esc(moTa(dung)) + " — +" + d + " điểm."
      : '<span class="sai">Sai cả hai lần.</span> Kỳ thủ đi ' + esc(moTa(dung)) + ".";
    S.ket.push({ d: d, sai: S.sai.slice(), goiY: S.goiY, may: !!S.may });
    S.tries = 0; S.sai = []; S.goiY = false; S.may = null;
    S.ban = true;
    diNuoc(dung);
    if (!goc) S.dau.dung = S.dau.cuoi;
    S.round++;
    ghiTienDo();
    nhan(loi);
    veQuan(); veNuoc(); veTrangThai();
    setTimeout(function () {
      var dap = tra ? moTa(tra) : "";            // trước khi đi: sau đó ô nguồn đã trống
      if (tra) {
        diNuoc(tra);
        veQuan(); veNuoc();
      }
      S.ban = false;
      if (S.round >= ROUNDS) return ketThuc();
      nhan(loi + " Đối thủ đáp " + esc(dap) + ". Tới lượt bạn.");
      veTrangThai();
    }, goc ? 700 : 1500);
  }

  function goiY() {
    if (S.ban || S.xong || S.goiY) return;
    S.goiY = true;
    S.dau["goi-y"] = hai(plies[plyDoan()]).slice(0, 1);
    nhan("Quân kỳ thủ đã đi đang được tô vàng (−1 điểm cho nước này).");
    veQuan(); veTrangThai();
  }

  var tho = null, hoi = 0;
  function hoiMay() {
    if (S.ban || S.xong || S.may) return;
    if (!window.Worker) return nhan("Trình duyệt này không chạy được engine.");
    if (!tho) {
      tho = new Worker("game/daily-worker.js");
      tho.onmessage = nhanMay;
      tho.onerror = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        S.may = null; tho = null;
        nhan("Engine gặp lỗi — thử lại.");
        veTrangThai();
      };
    }
    S.may = "dang";
    hoi++;
    nhan("Wukong đang tính…");
    veTrangThai();
    tho.postMessage({ id: hoi, vong: S.round, moves: plies.slice(0, plyDoan()).join(" "), ms: BOT_MS });
  }
  function nhanMay(ev) {
    var d = ev.data || {};
    if (d.id !== hoi || d.vong !== S.round || S.xong) return;
    if (!d.move) {
      S.may = null;
      nhan("Wukong không tìm được nước — thử lại.");
      return veTrangThai();
    }
    S.may = d.move;
    S.dau.may = hai(d.move);
    nhan("Wukong chọn <b>" + esc(moTa(d.move)) + "</b> (tô xanh) — máy không nhất thiết đi giống kỳ thủ. −1 điểm cho nước này.");
    veQuan(); veTrangThai();
  }

  /* ------------------------------------------------------------ hiển thị */
  function nhan(html) { $("loiNhan").innerHTML = html; }

  function veTrangThai() {
    var dang = Math.min(S.round + 1, ROUNDS);
    $("vongSo").textContent = S.xong ? "Đã xong 8 nước" : "Nước " + dang + " / " + ROUNDS;
    $("diem").textContent = tong(S.ket) + " / " + 3 * ROUNDS + " điểm";
    var html = "";
    for (var i = 0; i < ROUNDS; i++) {
      var k = S.ket[i];
      html += '<li class="' + (k ? "d" + k.d : i === S.round && !S.xong ? "dang" : "") + '"' +
        (k ? ' title="Nước ' + (i + 1) + ": " + k.d + ' điểm"' : "") + ">" + (k ? k.d : i + 1) + "</li>";
    }
    $("oDiem").innerHTML = html;
    $("btnGoiY").disabled = S.ban || S.xong || S.goiY;
    $("btnMay").disabled = S.ban || S.xong || !!S.may;
    banEl.dataset.van = game.id;
    banEl.dataset.ply = S.xong ? "" : plyDoan();
  }

  function veNuoc() {
    var di = engine.getMoves(), html = "";
    for (var i = 0; i < di.length; i += 2) {
      html += "<li>" + nuocHien(di, i) + (di[i + 1] ? " " + nuocHien(di, i + 1) : "") + "</li>";
    }
    var ol = $("nuoc");
    ol.innerHTML = html;
    ol.scrollTop = ol.scrollHeight;
  }
  function nuocHien(di, i) {
    var doanDuoc = i >= start && i < start + 2 * ROUNDS && (i - start) % 2 === 0;
    return doanDuoc ? "<b>" + esc(di[i]) + "</b>" : esc(di[i]);
  }

  function thongTin() {
    var benTen = ben ? '<span class="ben-cam den">Đen</span>' : '<span class="ben-cam do">Đỏ</span>';
    $("thongTin").innerHTML =
      '<div class="thong-tin-ten">' + esc(game.event) + "</div>" +
      "<div>Đỏ: " + esc(game.red) + " · Đen: " + esc(game.black) + "</div>" +
      "<p>Bạn cầm " + benTen + " — đoán nước của <b>" + esc(tenKyThu) + "</b> từ nước thứ " +
      (Math.floor(start / 2) + 1) + ".</p>" +
      '<div class="goi-y">Ván #' + game.id + " · " + (luyen ? "Luyện tập — không tính chuỗi ngày" : "Ván của hôm nay") + "</div>";
    $("ngay").textContent = theoVan ? "Luyện ván #" + game.id : (luyen ? "Ván ngày " : "Hôm nay, ") + hienNgay(ngay);
  }

  function chuoiHien() {
    var con = luu.cuoiNgay === hom || luu.cuoiNgay === homTruoc(hom);
    $("chuoi").innerHTML = "<div>🔥 Chuỗi <b>" + (con ? luu.chuoi || 0 : 0) + "</b> ngày</div>" +
      "<div>Kỷ lục <b>" + (luu.kyLuc || 0) + "</b></div>" +
      "<div>Đã chơi <b>" + Object.keys(luu.choi).length + "</b> ván</div>";
  }

  function ghiTienDo() {
    if (luyen) return;
    luu.dang = { ngay: ngay, van: game.id, ket: S.ket };
    ghiLS(KEY, luu);
  }

  /* -------------------------------------------------------------- kết thúc */
  function ketThuc(daLuu) {
    S.xong = true;
    S.chon = null; S.dich = [];
    var t = tong(S.ket), o = S.ket.map(function (k) { return EMOJI[k.d]; }).join("");
    if (!luyen && !daLuu) {
      luu.choi[ngay] = { van: game.id, d: S.ket.map(function (k) { return k.d; }) };
      luu.chuoi = luu.cuoiNgay === homTruoc(ngay) ? (luu.chuoi || 0) + 1 : (luu.cuoiNgay === ngay ? luu.chuoi || 1 : 1);
      luu.cuoiNgay = ngay;
      luu.kyLuc = Math.max(luu.kyLuc || 0, luu.chuoi);
      delete luu.dang;
      ghiLS(KEY, luu);
    }
    var trang = location.origin + location.pathname;
    var chia = (luyen ? "Cờ tướng · luyện ván #" + game.id : "Cờ tướng mỗi ngày · " + hienNgay(ngay)) + "\n" +
      o + " " + t + "/" + 3 * ROUNDS + (luyen ? "" : "\n🔥 Chuỗi " + (luu.chuoi || 1) + " ngày") + "\n" + trang;
    $("ketTieuDe").textContent = t >= 20 ? "Đọc cờ như kỳ thủ! 🏆" : t >= 12 ? "Hoàn thành — khá lắm!" : "Hoàn thành!";
    $("ketDiem").innerHTML = "<b>" + t + " / " + 3 * ROUNDS + "</b> điểm · đoán trúng " +
      S.ket.filter(function (k) { return k.d > 0; }).length + "/" + ROUNDS + " nước của " + esc(tenKyThu) + ".";
    $("ketChia").textContent = chia;
    $("ketGhi").textContent = luyen ? "Ván luyện không tính vào chuỗi ngày." : "Ván mới lúc 0 giờ — quay lại ngày mai để giữ chuỗi.";
    $("lnkLuyen").href = "?van=";
    $("ket").hidden = false;
    $("choi").hidden = true;
    $("duyet").hidden = false;
    S.xem = engine.getMoves().length;
    veTrangThai(); chuoiHien(); veQuan(); veDuyet();
  }

  function xemTai(n) {
    S.xem = Math.max(0, Math.min(plies.length, n));
    viTri(S.xem);
    veQuan(); veNuoc(); veDuyet();
  }
  function veDuyet() { $("duyetSo").textContent = S.xem + " / " + plies.length; }

  /* ------------------------------------------------------------- khởi động */
  function batDau() {
    dungBan();
    thongTin();
    chuoiHien();
    var xongRoi = !luyen && luu.choi[ngay] && luu.choi[ngay].van === game.id;
    if (xongRoi) {
      S.ket = luu.choi[ngay].d.map(function (d) { return { d: d }; });
      S.round = ROUNDS;
      viTri(start + 2 * ROUNDS);
      veNuoc();
      ketThuc(true);
      nhan("Bạn đã chơi ván hôm nay.");
      return;
    }
    if (!luyen && luu.dang && luu.dang.ngay === ngay && luu.dang.van === game.id && Array.isArray(luu.dang.ket)) {
      S.ket = luu.dang.ket.slice(0, ROUNDS - 1);
      S.round = S.ket.length;
    }
    viTri(plyDoan());
    veQuan(); veNuoc(); veTrangThai();
    nhan(S.round ? "Tiếp tục ván đang chơi dở." : "Chọn một quân " + (ben ? "Đen" : "Đỏ") +
      " rồi chọn ô đích — bạn nghĩ " + esc(tenKyThu) + " sẽ đi gì?");
  }

  banEl.addEventListener("click", function (ev) {
    var b = ev.target.closest(".o");
    if (b) bam(+b.dataset.sq);
  });
  $("btnGoiY").addEventListener("click", goiY);
  $("btnMay").addEventListener("click", hoiMay);
  $("btnChia").addEventListener("click", function () {
    var text = $("ketChia").textContent, nut = $("btnChia");
    function xong(ok) { nut.textContent = ok ? "✓ Đã chép" : "Chọn và chép ở khung trên"; setTimeout(function () { nut.textContent = "📋 Chép kết quả"; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { xong(true); }, function () { xong(false); });
    else xong(false);
  });
  $("duyet").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-di]");
    if (!b) return;
    var di = b.dataset.di;
    xemTai(di === "dau" ? 0 : di === "cuoi" ? plies.length : S.xem + (di === "toi" ? 1 : -1));
  });
  $("btnAm").addEventListener("click", function () {
    am = !am;
    ghiLS(AM_KEY, am);
    this.textContent = am ? "🔈" : "🔇";
    this.setAttribute("aria-pressed", String(am));
  });
  $("btnAm").textContent = am ? "🔈" : "🔇";
  $("btnAm").setAttribute("aria-pressed", String(am));

  batDau();
})();
