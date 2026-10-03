/* ==========================================================================
   MÔ-ĐUN CHẾ ĐỘ ĐỌC — cỡ chữ, giãn dòng, độ rộng, phông; đọc to bài (vi-VN).

   ★ NGUỒN THẬT: courses/engine/mo-doc.js (engine/sync.py chép).

   Nút "Aa" trên header mở bảng chỉnh. Cài đặt CHUNG mọi khoá (localStorage
   "kh-doc"), áp bằng biến CSS lên <html> — chỉ thân bài (#body) đổi, khung trang
   giữ nguyên. Đọc to dùng speechSynthesis của trình duyệt, giọng tiếng Việt nếu
   máy có: đọc từng đoạn (đoạn dài cắt theo câu — Chrome tự dừng câu nói quá dài),
   tô đoạn đang đọc và cuộn theo; rời bài thì dừng.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K) return;

  var KHOA = "kh-doc";
  var MAC_DINH = { co: 16.4, dong: 1.78, rong: 816, chan: false, toc: 1 };
  var CO = [14, 15, 16.4, 17.5, 19, 21, 24];
  var DONG = [["Vừa", 1.6], ["Thoáng", 1.78], ["Rất thoáng", 2]];
  var RONG = [["Hẹp", 680], ["Vừa", 816], ["Rộng", 980]];

  function cai() {
    try { return Object.assign({}, MAC_DINH, JSON.parse(localStorage.getItem(KHOA) || "{}")); }
    catch (e) { return Object.assign({}, MAC_DINH); }
  }
  function ap(c) {
    var h = document.documentElement;
    h.style.setProperty("--doc-co", c.co + "px");
    h.style.setProperty("--doc-dong", String(c.dong));
    h.style.setProperty("--doc-rong", c.rong + "px");
    if (c.co !== MAC_DINH.co || c.dong !== MAC_DINH.dong || c.rong !== MAC_DINH.rong) h.setAttribute("data-doc", "");
    else h.removeAttribute("data-doc");
    if (c.chan) { napPhongChan(); h.setAttribute("data-doc-chan", ""); } else h.removeAttribute("data-doc-chan");
  }
  /* Phông có chân PHẢI đủ dấu tiếng Việt: Georgia thiếu, dấu rời khỏi chữ. Noto Serif (Google
     Fonts tự chia theo bảng chữ, có bộ tiếng Việt) chỉ nạp khi người đọc chọn. */
  function napPhongChan() {
    if (document.getElementById("phongNotoSerif")) return;
    var l = document.createElement("link");
    l.id = "phongNotoSerif"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&display=swap";
    document.head.appendChild(l);
  }
  function luu(c) { try { localStorage.setItem(KHOA, JSON.stringify(c)); } catch (e) {} ap(c); }
  ap(cai());

  /* ---------------- bảng chỉnh ---------------- */
  K.themBieuTuong("chu-aa", '<path d="M3 19 8 5l5 14M5 14h6"/><path d="M14 19l3.5-9 3.5 9M15.2 16h4.6"/>');
  var hop = null, nut = null;
  function veHop() {
    var c = cai(), coDocTo = "speechSynthesis" in window && !!K.baiDangDoc();
    function seg(ten, ds, gt, ma) {
      return '<div class="dh-hang"><span>' + ten + '</span><div class="dh-seg">' + ds.map(function (x) {
        return '<button type="button" data-' + ma + '="' + x[1] + '"' + (x[1] === gt ? ' class="on"' : "") + ">" + x[0] + "</button>";
      }).join("") + "</div></div>";
    }
    hop.innerHTML =
      '<div class="dh-hang"><span>Cỡ chữ</span><div class="dh-seg"><button type="button" data-co="-1" aria-label="Chữ nhỏ hơn">A−</button>' +
        '<b class="dh-so">' + c.co + "px</b>" + '<button type="button" data-co="1" aria-label="Chữ lớn hơn">A+</button></div></div>' +
      seg("Giãn dòng", DONG, c.dong, "dong") +
      seg("Độ rộng", RONG, c.rong, "rong") +
      seg("Phông", [["Không chân", 0], ["Có chân", 1]], c.chan ? 1 : 0, "chan") +
      '<div class="dh-hang"><span>Đọc to</span><div class="dh-seg">' +
        '<button type="button" data-doc-to="1"' + (coDocTo ? "" : " disabled") + ">🔊 Đọc bài này</button>" +
        '<select data-toc aria-label="Tốc độ đọc">' + [0.8, 1, 1.2, 1.5].map(function (t) {
          return '<option value="' + t + '"' + (t === c.toc ? " selected" : "") + ">" + t + "×</option>";
        }).join("") + "</select></div></div>" +
      '<div class="dh-chan"><button type="button" class="dh-lai" data-lai="1">Đặt lại mặc định</button></div>';
  }
  function moHop() {
    if (!hop) {
      hop = document.createElement("div");
      hop.className = "doc-hop";
      hop.setAttribute("role", "dialog");
      hop.setAttribute("aria-label", "Chế độ đọc");
      hop.hidden = true;
      document.body.appendChild(hop);
      hop.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var c = cai();
        if (b.hasAttribute("data-co")) {
          var i = CO.indexOf(c.co);
          if (i < 0) i = 2;
          c.co = CO[Math.max(0, Math.min(CO.length - 1, i + (+b.getAttribute("data-co"))))];
        } else if (b.hasAttribute("data-dong")) c.dong = +b.getAttribute("data-dong");
        else if (b.hasAttribute("data-rong")) c.rong = +b.getAttribute("data-rong");
        else if (b.hasAttribute("data-chan")) c.chan = b.getAttribute("data-chan") === "1";
        else if (b.hasAttribute("data-lai")) c = Object.assign({}, MAC_DINH, { toc: c.toc });
        else if (b.hasAttribute("data-doc-to")) { dongHop(); docTo(); return; }
        luu(c);
        veHop();
      });
      hop.addEventListener("change", function (e) {
        if (!e.target.hasAttribute("data-toc")) return;
        var c = cai();
        c.toc = +e.target.value;
        luu(c);
      });
      document.addEventListener("mousedown", function (e) {
        if (!hop.hidden && !hop.contains(e.target) && !(nut && nut.contains(e.target))) dongHop();
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") dongHop(); });
    }
    if (!hop.hidden) { dongHop(); return; }
    veHop();
    var r = nut.getBoundingClientRect();
    hop.style.top = Math.round(r.bottom + 8) + "px";
    hop.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + "px";
    hop.hidden = false;
  }
  function dongHop() { if (hop) hop.hidden = true; }
  nut = K.themNut({ ma: "btnDoc", icon: "chu-aa", title: "Chế độ đọc — cỡ chữ, giãn dòng, đọc to", khi: moHop });

  /* ---------------- đọc to ---------------- */
  var phien = null;              /* {cau: [{el, chu}], i, dung} */
  var thanh = null;
  function giongViet() {
    var ds = window.speechSynthesis.getVoices();
    return ds.filter(function (v) { return /^vi(-|_|$)/i.test(v.lang); })[0] || null;
  }
  function cacCau(body) {
    var out = [];
    Array.prototype.forEach.call(body.querySelectorAll("h1,h2,h3,h4,p,li,td,dd,summary"), function (el) {
      if (el.closest("pre, .chay, .lab-nhung, .cw, .katex")) return;
      if (el.tagName === "LI" && el.querySelector("p")) return;        /* chữ đã nằm trong <p> con */
      var chu = el.textContent.replace(/\s+/g, " ").trim();
      if (!chu) return;
      (chu.match(/[^.!?…]{1,220}(?:[.!?…]+|$)\s*/g) || [chu]).forEach(function (c) {
        if (c.trim()) out.push({ el: el, chu: c.trim() });
      });
    });
    return out;
  }
  function veThanh() {
    if (!thanh) {
      thanh = document.createElement("div");
      thanh.className = "doc-thanh";
      thanh.setAttribute("role", "status");
      document.body.appendChild(thanh);
      thanh.addEventListener("click", function (e) {
        var b = e.target.closest("[data-tt]");
        if (!b || !phien) return;
        var ss = window.speechSynthesis;
        if (b.getAttribute("data-tt") === "dung") { dungDoc(); return; }
        if (ss.paused) ss.resume(); else ss.pause();
        veThanh();
      });
    }
    if (!phien) { thanh.hidden = true; return; }
    thanh.hidden = false;
    thanh.innerHTML = "<span>🔊 Đang đọc " + Math.min(phien.i + 1, phien.cau.length) + "/" + phien.cau.length +
      (phien.giong ? "" : " · máy chưa có giọng tiếng Việt") + "</span>" +
      '<button type="button" data-tt="tam">' + (window.speechSynthesis.paused ? "▶ Tiếp" : "⏸ Tạm dừng") + "</button>" +
      '<button type="button" data-tt="dung">⏹ Dừng</button>';
  }
  function boTo() {
    Array.prototype.forEach.call(document.querySelectorAll(".dang-doc"), function (x) { x.classList.remove("dang-doc"); });
  }
  function noiTiep() {
    if (!phien || phien.dung) return;
    if (phien.i >= phien.cau.length) { dungDoc(); return; }
    var c = phien.cau[phien.i], u = new SpeechSynthesisUtterance(c.chu);
    u.lang = "vi-VN";
    if (phien.giong) u.voice = phien.giong;
    u.rate = cai().toc;
    u.onend = function () { if (phien && !phien.dung) { phien.i++; noiTiep(); } };
    u.onerror = function (ev) { if (ev.error !== "interrupted" && ev.error !== "canceled") dungDoc(); };
    if (!c.el.classList.contains("dang-doc")) {
      boTo();
      c.el.classList.add("dang-doc");
      c.el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    veThanh();
    window.speechSynthesis.speak(u);
  }
  function docTo() {
    if (!("speechSynthesis" in window)) { K.toast("Trình duyệt không hỗ trợ đọc to"); return; }
    var body = document.querySelector("#body .prose");
    if (!body) return;
    dungDoc();
    var cau = cacCau(body);
    if (!cau.length) { K.toast("Bài này không có đoạn chữ để đọc"); return; }
    phien = { cau: cau, i: 0, dung: false, giong: giongViet() };
    if (!phien.giong && window.speechSynthesis.getVoices().length === 0) {
      /* danh sách giọng nạp trễ ở lần đầu */
      window.speechSynthesis.onvoiceschanged = function () { if (phien) phien.giong = giongViet(); };
    }
    noiTiep();
  }
  function dungDoc() {
    if (phien) phien.dung = true;
    phien = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    boTo();
    veThanh();
  }
  K.nghe("bai", function () { dungDoc(); dongHop(); });
  K.nghe("trang-chu", function () { dungDoc(); dongHop(); });
})();
