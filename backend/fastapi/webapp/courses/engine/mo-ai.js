/* ==========================================================================
   MÔ-ĐUN TRỢ GIẢNG AI — hỏi về bài đang đọc.

   ★ NGUỒN THẬT: courses/engine/mo-ai.js (engine/sync.py chép). Engine nạp tệp
     này sau app.js và cho nó API window.KhoaHoc.

   Dưới tiêu đề mỗi bài: Tóm tắt · Giải thích dễ hiểu · Câu hỏi ôn tập · Hỏi về
   bài này. Bôi đen một đoạn trong bài → nút "Giải thích đoạn này". Câu trả lời
   mở trong khung bên phải; câu hỏi tự do có kèm nguồn — những bài trong khoá mà
   câu trả lời dựa vào, bấm để mở.

   Máy chủ quyết ai được dùng (GET /ai/status, qua ai-khach.js): quản trị viên
   (token phiên của trang Quản lý), người có mã truy cập AI, hoặc mọi người. Chế
   độ "chỉ quản trị viên" thì khách không thấy gì. Mọi câu hỏi đi qua POST
   /ai/tutor — hạn mức, ngân sách ngày, bộ nhớ câu trả lời nằm ở máy chủ. Câu trả
   lời là dữ liệu không tin cậy: dựng bằng bộ dựng bài (HienThi) — phần chạy được
   đã bị gỡ.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K || K.nguon().kieu !== "api" || !window.AiKhach) return;   /* tệp tĩnh: không có máy chủ AI */

  var AI = window.AiKhach.tao(K.gocApi());
  var CHON_MIN = 12, CHON_MAX = 4000;
  var TEN_VIEC = { summary: "Tóm tắt bài", explain: "Giải thích dễ hiểu", quiz: "Câu hỏi ôn tập",
                   cards: "Thẻ ôn tập", ask: "Hỏi" };


  /* ---------------- khung bên phải ---------------- */
  var khung = null, baiHienTai = null, luong = {};

  function taoKhung() {
    if (khung) return khung;
    khung = document.createElement("aside");
    khung.className = "ai-khung";
    khung.id = "aiKhung";
    khung.hidden = true;
    khung.setAttribute("aria-label", "Trợ giảng AI");
    khung.innerHTML =
      '<div class="ai-dau"><div><b>✨ Trợ giảng AI</b><span id="aiBai"></span></div>' +
        '<button type="button" class="ic-btn" id="aiDong" title="Đóng (Esc)" aria-label="Đóng">✕</button></div>' +
      '<div class="ai-luong" id="aiLuong" aria-live="polite"></div>' +
      '<form class="ai-chan" id="aiHoi"><textarea id="aiCau" rows="2" maxlength="1000" ' +
        'placeholder="Hỏi về bài này… (Enter để gửi, Shift+Enter xuống dòng)"></textarea>' +
        '<button type="submit" class="btn btn-p">Hỏi</button></form>';
    document.body.appendChild(khung);
    khung.querySelector("#aiDong").addEventListener("click", dongKhung);
    var cau = khung.querySelector("#aiCau");
    khung.querySelector("#aiHoi").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = cau.value.trim();
      if (!q) return;
      cau.value = "";
      hoi("ask", { question: q });
    });
    cau.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        khung.querySelector("#aiHoi").requestSubmit();
      }
    });
    return khung;
  }

  function luongCua(d) {
    if (!luong[d.id]) {
      var l = document.createElement("div");
      l.className = "ai-luong-bai";
      l.innerHTML = '<p class="ai-trong">Hỏi bất cứ điều gì về bài «' + K.esc(d.title) + "», hoặc chọn một việc " +
        "bên dưới tiêu đề bài. Bôi đen một đoạn trong bài để được giải thích riêng đoạn đó.</p>";
      luong[d.id] = l;
    }
    return luong[d.id];
  }

  function veKhung() {
    if (!khung || !baiHienTai) return;
    khung.querySelector("#aiBai").textContent = baiHienTai.title;
    var vung = khung.querySelector("#aiLuong");
    var l = luongCua(baiHienTai);
    if (vung.firstChild !== l) { vung.innerHTML = ""; vung.appendChild(l); }
  }

  function moKhung() {
    taoKhung();
    veKhung();
    khung.hidden = false;
    document.body.classList.add("ai-mo");
  }
  function dongKhung() {
    if (!khung) return;
    khung.hidden = true;
    document.body.classList.remove("ai-mo");
  }

  function themMuc(nhan) {
    var l = luongCua(baiHienTai);
    var tro = l.querySelector(".ai-trong");
    if (tro) tro.remove();
    var m = document.createElement("div");
    m.className = "ai-muc";
    m.innerHTML = '<div class="ai-muc-h"></div><div class="ai-noi"><p class="ai-cho">Trợ giảng đang soạn câu trả lời</p></div>';
    m.querySelector(".ai-muc-h").textContent = nhan;
    l.appendChild(m);
    m.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return m;
  }

  /* ---------------- hỏi ---------------- */
  function hoi(viec, them) {
    them = them || {};
    var d = baiHienTai;
    if (!d) return;
    moKhung();
    var nhan = viec === "ask" ? "Hỏi: " + them.question :
               viec === "explain" && them.selection ? "Giải thích đoạn: “" + rutGon(them.selection, 90) + "”" :
               TEN_VIEC[viec] + (them.variant ? " (bộ " + (them.variant + 1) + ")" : "");
    var muc = themMuc(nhan);
    AI.trangThai().then(function (s) {
      if (!s.enabled) throw Object.assign(new Error("Tính năng AI đang tắt trên máy chủ này"), { ma: "ai_disabled" });
      if (!s.allowed) throw Object.assign(new Error("Cần mã truy cập AI"), { ma: s.needs === "code" ? "ai_code_required" : "ai_admin_only" });
      return AI.goi("tutor", {
        course: K.khoa, doc: d.id, action: viec,
        question: them.question || "", selection: them.selection || "", variant: them.variant || 0
      });
    }).then(function (kq) {
      veKetQua(muc, d, kq, viec, them);
    }, function (e) {
      veLoi(muc, e, function () { muc.remove(); hoi(viec, them); });
    });
  }

  function rutGon(s, n) { s = String(s).replace(/\s+/g, " "); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  /* Câu trả lời vừa về: đưa đầu mục lên đầu khung để đọc từ đầu. */
  function denMuc(muc) {
    var vung = khung && khung.querySelector("#aiLuong");
    if (vung && vung.contains(muc)) vung.scrollTop = Math.max(0, muc.offsetTop - vung.offsetTop - 10);
  }

  function veKetQua(muc, d, kq, viec, them) {
    var noi = muc.querySelector(".ai-noi");
    noi.innerHTML = "";
    if (viec === "quiz") {
      veQuiz(noi, kq.questions || [], them);
    } else if (viec === "cards") {
      veBoThe(noi, d, kq.cards || []);
    } else {
      noi.appendChild(K.render(kq.answer || "", d.id));
      var nguon = (kq.sources || []).filter(function (s) { return s && s.slug; });
      if (nguon.length) {
        var p = document.createElement("p");
        p.className = "ai-nguon";
        p.innerHTML = "Nguồn trong khoá: " + nguon.map(function (s, i) {
          return '<a href="#/' + K.esc(s.slug) + '">[' + (i + 1) + "] " + K.esc(s.title) + "</a>";
        }).join(" ");
        noi.appendChild(p);
      }
    }
    if (kq.cached) {
      var c = document.createElement("p");
      c.className = "ai-ghi";
      c.textContent = "Câu trả lời đã có sẵn từ lần hỏi trước — không tốn lượt.";
      noi.appendChild(c);
    }
    denMuc(muc);
  }

  function veQuiz(noi, ds, them) {
    var dung = 0, xong = 0;
    var diem = document.createElement("span");
    diem.textContent = "Chọn một đáp án cho mỗi câu";
    ds.forEach(function (q, i) {
      var box = document.createElement("div");
      box.className = "ai-q";
      box.innerHTML = "<p><b>" + (i + 1) + ".</b> " + K.esc(q.question) + "</p>" +
        q.choices.map(function (c, j) {
          return '<button type="button" class="ai-dap-an" data-j="' + j + '">' + "ABCDEF".charAt(j) + ". " + K.esc(c) + "</button>";
        }).join("") + '<p class="ai-giai" hidden></p>';
      box.addEventListener("click", function (e) {
        var b = e.target.closest(".ai-dap-an");
        if (!b || box.classList.contains("xong")) return;
        box.classList.add("xong");
        var j = +b.getAttribute("data-j");
        xong++;
        if (j === q.answer) dung++;
        Array.prototype.forEach.call(box.querySelectorAll(".ai-dap-an"), function (x) {
          var k = +x.getAttribute("data-j");
          x.disabled = true;
          if (k === q.answer) x.classList.add("dung"); else if (k === j) x.classList.add("sai");
        });
        var g = box.querySelector(".ai-giai");
        g.textContent = (j === q.answer ? "✓ Đúng. " : "✗ Chưa đúng. ") + (q.explain || "");
        g.hidden = false;
        if (xong === ds.length) diem.textContent = "Kết quả: đúng " + dung + "/" + ds.length + " câu";
      });
      noi.appendChild(box);
    });
    var chan = document.createElement("div");
    chan.className = "ai-quiz-chan";
    var khac = document.createElement("button");
    khac.type = "button";
    khac.className = "btn btn-s";
    khac.textContent = "Bộ câu khác";
    khac.addEventListener("click", function () { hoi("quiz", { variant: (them.variant || 0) + 1 }); });
    chan.appendChild(diem);
    chan.appendChild(khac);
    noi.appendChild(chan);
  }

  /* Thẻ ghi nhớ → bộ ôn tập của mo-on-tap.js (nếu khoá bật mô-đun đó). */
  function veBoThe(noi, d, ds) {
    var ol = document.createElement("ol");
    ol.className = "ai-the";
    ds.forEach(function (c) {
      var li = document.createElement("li");
      var truoc = K.render(c.front, d.id), sau = K.render(c.back, d.id);
      truoc.classList.add("ai-the-truoc");
      li.appendChild(truoc);
      li.appendChild(sau);
      ol.appendChild(li);
    });
    noi.appendChild(ol);
    if (!K.onTap || !ds.length) return;
    var chan = document.createElement("div");
    chan.className = "ai-the-chan";
    chan.innerHTML = '<button type="button" class="btn btn-s">Thêm ' + ds.length + " thẻ vào bộ ôn tập</button>" +
      '<a href="#/~on-tap">Mở trang Ôn tập</a>';
    var b = chan.querySelector("button");
    b.addEventListener("click", function () {
      var n = K.onTap.them(d.id, ds);
      b.disabled = true;
      b.textContent = n ? "Đã thêm " + n + " thẻ" : "Các thẻ này đã có trong bộ ôn tập";
    });
    noi.appendChild(chan);
  }

  function veLoi(muc, e, thuLai) {
    var noi = muc.querySelector(".ai-noi");
    noi.innerHTML = "";
    var p = document.createElement("p");
    p.className = "ai-loi";
    p.textContent = e && e.message || String(e);
    noi.appendChild(p);
    if (e && e.ma === "ai_code_required") {
      var f = AI.oMa(thuLai, "btn btn-p");
      noi.appendChild(f);
      f.querySelector("input").focus();
    } else if (e && e.ma !== "ai_admin_only" && e.ma !== "ai_disabled" && e.ma !== "ai_unconfigured") {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-s";
      b.textContent = "Thử lại";
      b.addEventListener("click", thuLai);
      noi.appendChild(b);
    }
  }

  /* ---------------- bôi đen để hỏi ---------------- */
  var nutChon = null, doanChon = "";
  function anNutChon() { if (nutChon) nutChon.hidden = true; }
  function xetChon() {
    var body = document.getElementById("body");
    var sel = window.getSelection && window.getSelection();
    var txt = sel ? String(sel).trim() : "";
    if (!body || !baiHienTai || txt.length < CHON_MIN || !sel.rangeCount || !body.contains(sel.anchorNode)) {
      anNutChon();
      return;
    }
    if (!nutChon) {
      nutChon = document.createElement("button");
      nutChon.type = "button";
      nutChon.className = "ai-chon";
      nutChon.textContent = "✨ Giải thích đoạn này";
      /* giữ vùng bôi đen khi bấm */
      nutChon.addEventListener("mousedown", function (e) { e.preventDefault(); });
      nutChon.addEventListener("click", function () { anNutChon(); hoi("explain", { selection: doanChon }); });
      document.body.appendChild(nutChon);
    }
    doanChon = txt.slice(0, CHON_MAX);
    var r = sel.getRangeAt(0).getBoundingClientRect();
    nutChon.style.top = Math.round(window.scrollY + r.bottom + 8) + "px";
    nutChon.style.left = Math.round(Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - 230))) + "px";
    nutChon.hidden = false;
  }

  /* ---------------- gắn vào engine ---------------- */
  var dangNghe = false;
  function batDau(s) {
    if (dangNghe || !AI.dungDuoc(s)) return;
    dangNghe = true;
    document.addEventListener("mouseup", function () { setTimeout(xetChon, 0); });
    document.addEventListener("keyup", function (e) { if (e.shiftKey) setTimeout(xetChon, 0); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { anNutChon(); dongKhung(); }
    });
  }

  function hangViec(d) {
    var chips = document.querySelector(".doc .chips");
    if (!chips || document.querySelector(".ai-hang")) return;
    var hang = document.createElement("div");
    hang.className = "ai-hang";
    hang.innerHTML = '<span class="ai-nhan">✨ Trợ giảng AI</span>' + ["summary", "explain", "quiz", "cards", "ask"].map(function (v) {
      return '<button type="button" data-viec="' + v + '">' + (v === "ask" ? "Hỏi về bài này" : TEN_VIEC[v]) + "</button>";
    }).join("");
    hang.addEventListener("click", function (e) {
      var b = e.target.closest("[data-viec]");
      if (!b) return;
      var v = b.getAttribute("data-viec");
      if (v === "ask") { moKhung(); khung.querySelector("#aiCau").focus(); return; }
      hoi(v, {});
    });
    chips.parentNode.insertBefore(hang, chips.nextSibling);
  }

  K.nghe("bai", function (d) {
    baiHienTai = d;
    anNutChon();
    AI.trangThai().then(function (s) {
      if (!AI.dungDuoc(s) || baiHienTai !== d) return;
      batDau(s);
      hangViec(d);
      if (khung && !khung.hidden) veKhung();
    }, function () { /* không hỏi được máy chủ (offline…): không hiện trợ giảng */ });
  });
  K.nghe("trang-chu", function () { baiHienTai = null; anNutChon(); dongKhung(); });
})();
