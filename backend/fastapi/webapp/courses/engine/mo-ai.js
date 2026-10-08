/* ==========================================================================
   MÔ-ĐUN TRỢ GIẢNG AI — hỏi về bài đang đọc, hoặc về cả khoá.

   ★ NGUỒN THẬT: courses/engine/mo-ai.js (engine/sync.py chép). Engine nạp tệp
     này sau app.js và cho nó API window.KhoaHoc.

   Dưới tiêu đề mỗi bài: Tóm tắt · Giải thích dễ hiểu · Câu hỏi ôn tập · Thẻ ôn tập
   · Hỏi về bài này. Bôi đen một đoạn trong bài → việc "✨ Giải thích" trên thanh nổi
   của engine (KhoaHoc.themViecChon). Câu trả lời mở trong khung bên phải; câu hỏi
   tự do có kèm nguồn — những bài trong khoá mà câu trả lời dựa vào, bấm để mở.
   Khung có hai phạm vi hỏi: "Bài này" (POST /ai/tutor — bài đang đọc + bài liên
   quan) và "Cả khoá" (POST /ai/ask với course — tìm trong cả khoá); nút ✨ trên
   header mở thẳng phạm vi cả khoá, kể cả từ trang chủ. Ô "Model" chọn model Gemini
   (dùng chung cho mọi trang của máy chủ — xem ai-khach.js).

   Cho mô-đun khác (ôn tập, sổ tay, bài tập code):
     KhoaHoc.ai.trangThai() / .dungDuoc(s)   có nên mời dùng AI không
     KhoaHoc.ai.goi(duong, body)             gọi /ai/<duong> sau khi kiểm quyền
     KhoaHoc.ai.hienLoi(noi, loi, thuLai)    lỗi + ô nhập mã truy cập / nút Thử lại
     KhoaHoc.ai.oModel()                     ô chọn model
   và đăng ký "gợi ý bài tập" với HienThi.dangKyGoiY (POST /ai/hint, 3 mức).

   Máy chủ quyết ai được dùng (GET /ai/status, qua ai-khach.js): quản trị viên
   (token phiên của trang Quản lý), người có mã truy cập AI, hoặc mọi người. Chế
   độ "chỉ quản trị viên" thì khách không thấy gì. Hạn mức, ngân sách ngày, bộ nhớ
   câu trả lời nằm ở máy chủ. Câu trả lời là dữ liệu không tin cậy: dựng bằng bộ
   dựng bài (HienThi), khối mã chạy được bị đổi thành khối mã thường.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K || K.nguon().kieu !== "api" || !window.AiKhach) return;   /* tệp tĩnh: không có máy chủ AI */

  var AI = window.AiKhach.tao(K.gocApi());
  var CHON_MIN = 12;
  var TEN_VIEC = { summary: "Tóm tắt bài", explain: "Giải thích dễ hiểu", quiz: "Câu hỏi ôn tập",
                   cards: "Thẻ ôn tập", ask: "Hỏi" };

  /* ---------------- dùng chung cho các mô-đun ---------------- */
  function kiemQuyen(s) {
    if (!s.enabled) throw Object.assign(new Error("Tính năng AI đang tắt trên máy chủ này"), { ma: "ai_disabled" });
    if (!s.allowed) throw Object.assign(new Error("Cần mã truy cập AI"), { ma: s.needs === "code" ? "ai_code_required" : "ai_admin_only" });
  }
  function goi(duong, body) {
    return AI.trangThai().then(function (s) { kiemQuyen(s); return AI.goi(duong, body); });
  }
  /* Khối mã chạy được trong câu trả lời AI chỉ để đọc. */
  function boChay(md) {
    return String(md || "").replace(/```[ \t]*(py|python|js|javascript)-(chay|bai-tap)/g, function (m, ngon) {
      return "```" + (/^py/.test(ngon) ? "python" : "javascript");
    });
  }
  function hienLoi(noi, e, thuLai) {
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
  K.ai = {
    trangThai: function (moi) { return AI.trangThai(moi); },
    dungDuoc: function (s) { return AI.dungDuoc(s); },
    goi: goi, hienLoi: hienLoi, boChay: boChay,
    oModel: function (lop) { return AI.oModel(lop); }
  };

  /* ---------------- khung bên phải ---------------- */
  var khung = null, baiHienTai = null, luong = {}, phamVi = "bai";

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
      '<div class="ai-cong-cu" id="aiCongCu"><div class="ai-pham-vi" role="group" aria-label="Phạm vi câu hỏi">' +
        '<button type="button" data-pv="bai" aria-pressed="true">Bài này</button>' +
        '<button type="button" data-pv="khoa" aria-pressed="false">Cả khoá</button></div></div>' +
      '<div class="ai-luong" id="aiLuong" aria-live="polite"></div>' +
      '<form class="ai-chan" id="aiHoi"><textarea id="aiCau" rows="2" maxlength="1000" ' +
        'placeholder="Hỏi về bài này… (Enter để gửi, Shift+Enter xuống dòng)"></textarea>' +
        '<button type="submit" class="btn btn-p">Hỏi</button></form>';
    document.body.appendChild(khung);
    khung.querySelector("#aiCongCu").appendChild(AI.oModel("ai-model-khung"));
    khung.querySelector("#aiDong").addEventListener("click", dongKhung);
    khung.querySelector(".ai-pham-vi").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pv]");
      if (b && !b.disabled) { phamVi = b.getAttribute("data-pv"); veKhung(); khung.querySelector("#aiCau").focus(); }
    });
    var cau = khung.querySelector("#aiCau");
    khung.querySelector("#aiHoi").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = cau.value.trim();
      if (!q) return;
      cau.value = "";
      if (caKhoa()) hoiKhoa(q); else hoi("ask", { question: q });
    });
    cau.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        khung.querySelector("#aiHoi").requestSubmit();
      }
    });
    return khung;
  }

  function caKhoa() { return phamVi === "khoa" || !baiHienTai; }
  function tenKhoa() { return ((K.manifest() || {}).course || {}).title || "khoá học"; }

  function luongCua(khoa, tieuDe) {
    if (!luong[khoa]) {
      var l = document.createElement("div");
      l.className = "ai-luong-bai";
      l.innerHTML = khoa === "~khoa" ?
        '<p class="ai-trong">Hỏi bất cứ điều gì về khoá «' + K.esc(tieuDe) + "» — trợ giảng tìm những bài liên quan trong khoá " +
          "và trả lời kèm nguồn.</p>" :
        '<p class="ai-trong">Hỏi bất cứ điều gì về bài «' + K.esc(tieuDe) + "», hoặc chọn một việc bên dưới tiêu đề bài. " +
          "Bôi đen một đoạn trong bài để được giải thích riêng đoạn đó.</p>";
      luong[khoa] = l;
    }
    return luong[khoa];
  }
  function luongHienTai() { return caKhoa() ? luongCua("~khoa", tenKhoa()) : luongCua(baiHienTai.id, baiHienTai.title); }

  function veKhung() {
    if (!khung) return;
    var khoa = caKhoa();
    khung.querySelector("#aiBai").textContent = khoa ? "Cả khoá «" + tenKhoa() + "»" : baiHienTai.title;
    Array.prototype.forEach.call(khung.querySelectorAll("[data-pv]"), function (b) {
      var pv = b.getAttribute("data-pv");
      b.setAttribute("aria-pressed", String((pv === "khoa") === khoa));
      if (pv === "bai") b.disabled = !baiHienTai;
    });
    khung.querySelector("#aiCau").placeholder = (khoa ? "Hỏi về cả khoá học…" : "Hỏi về bài này…") + " (Enter để gửi, Shift+Enter xuống dòng)";
    var vung = khung.querySelector("#aiLuong");
    var l = luongHienTai();
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
    var l = luongHienTai();
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
    phamVi = "bai";
    moKhung();
    var nhan = viec === "ask" ? "Hỏi: " + them.question :
               viec === "explain" && them.selection ? "Giải thích đoạn: “" + rutGon(them.selection, 90) + "”" :
               TEN_VIEC[viec] + (them.variant ? " (bộ " + (them.variant + 1) + ")" : "");
    var muc = themMuc(nhan);
    goi("tutor", {
      course: K.khoa, doc: d.id, action: viec,
      question: them.question || "", selection: them.selection || "", variant: them.variant || 0
    }).then(function (kq) {
      veKetQua(muc, d, kq, viec, them);
    }, function (e) {
      hienLoi(muc.querySelector(".ai-noi"), e, function () { muc.remove(); hoi(viec, them); });
    });
  }

  function hoiKhoa(q) {
    phamVi = "khoa";
    moKhung();
    var muc = themMuc("Hỏi cả khoá: " + q);
    goi("ask", { q: q, course: K.khoa }).then(function (kq) {
      var noi = muc.querySelector(".ai-noi");
      noi.innerHTML = "";
      if (!kq.found) {
        var p = document.createElement("p");
        p.className = "ai-trong";
        p.textContent = "Không thấy bài nào trong khoá khớp với câu hỏi — thử diễn đạt khác, hoặc mở một bài rồi hỏi về bài đó.";
        noi.appendChild(p);
        return;
      }
      noi.appendChild(K.render(boChay(kq.answer || ""), ""));
      veNguon(noi, kq.sources || []);
      if (kq.cached) ghiCache(noi);
      denMuc(muc);
    }, function (e) {
      hienLoi(muc.querySelector(".ai-noi"), e, function () { muc.remove(); hoiKhoa(q); });
    });
  }

  function rutGon(s, n) { s = String(s).replace(/\s+/g, " "); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  /* Câu trả lời vừa về: đưa đầu mục lên đầu khung để đọc từ đầu. */
  function denMuc(muc) {
    var vung = khung && khung.querySelector("#aiLuong");
    if (vung && vung.contains(muc)) vung.scrollTop = Math.max(0, muc.offsetTop - vung.offsetTop - 10);
  }
  function veNguon(noi, ds) {
    var nguon = ds.filter(function (s) { return s && s.slug; });
    if (!nguon.length) return;
    var p = document.createElement("p");
    p.className = "ai-nguon";
    p.innerHTML = "Nguồn trong khoá: " + nguon.map(function (s, i) {
      return '<a href="#/' + K.esc(s.slug) + '">[' + (i + 1) + "] " + K.esc(s.title) + "</a>";
    }).join(" ");
    noi.appendChild(p);
  }
  function ghiCache(noi) {
    var c = document.createElement("p");
    c.className = "ai-ghi";
    c.textContent = "Câu trả lời đã có sẵn từ lần hỏi trước — không tốn lượt.";
    noi.appendChild(c);
  }

  function veKetQua(muc, d, kq, viec, them) {
    var noi = muc.querySelector(".ai-noi");
    noi.innerHTML = "";
    if (viec === "quiz") {
      veQuiz(noi, kq.questions || [], them);
    } else if (viec === "cards") {
      veBoThe(noi, d, kq.cards || []);
    } else {
      noi.appendChild(K.render(boChay(kq.answer || ""), d.id));
      veNguon(noi, kq.sources || []);
    }
    if (kq.cached) ghiCache(noi);
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

  /* ---------------- gợi ý bài tập code (hien-thi.js) ---------------- */
  function goiYBaiTap(x, muc, thuLai) {
    return goi("hint", {
      course: K.khoa, doc: x.docId, lang: x.ngon, task: x.de || "", code: x.ma, checks: x.kiem || "",
      errors: x.loi ? [x.loi] : [], passed: 0, total: 0, level: muc
    }).then(function (kq) {
      var hop = document.createElement("div");
      hop.appendChild(K.render(boChay(kq.hint || ""), x.docId));
      if ((kq.lines || []).length) {
        var p = document.createElement("p");
        p.className = "ai-ghi";
        p.textContent = "Dòng nên xem lại: " + kq.lines.join(", ");
        hop.appendChild(p);
      }
      return hop;
    }, function (e) {
      var hop = document.createElement("div");
      hienLoi(hop, e, thuLai);
      return hop;
    });
  }

  /* ---------------- gắn vào engine ---------------- */
  var dangNghe = false, nutKhoa = null;
  function batDau(s) {
    if (dangNghe || !AI.dungDuoc(s)) return;
    dangNghe = true;
    K.themViecChon({ chu: "✨ Giải thích", toiThieu: CHON_MIN,
                     khi: function (chu) { hoi("explain", { selection: chu }); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") dongKhung(); });
    if (window.HienThi && window.HienThi.dangKyGoiY) window.HienThi.dangKyGoiY(goiYBaiTap);
    nutKhoa = K.themNut({ ma: "btnAiKhoa", chu: "✨", title: "Trợ giảng AI — hỏi về cả khoá học",
                          khi: function () { phamVi = "khoa"; moKhung(); khung.querySelector("#aiCau").focus(); } });
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
      if (v === "ask") { phamVi = "bai"; moKhung(); khung.querySelector("#aiCau").focus(); return; }
      hoi(v, {});
    });
    chips.parentNode.insertBefore(hang, chips.nextSibling);
  }

  K.nghe("san-sang", function () {
    AI.trangThai().then(function (s) { batDau(s); }, function () { /* offline…: không hiện trợ giảng */ });
  });
  K.nghe("bai", function (d) {
    baiHienTai = d;
    phamVi = "bai";
    AI.trangThai().then(function (s) {
      if (!AI.dungDuoc(s) || baiHienTai !== d) return;
      batDau(s);
      hangViec(d);
      if (khung && !khung.hidden) veKhung();
    }, function () { /* không hỏi được máy chủ (offline…): không hiện trợ giảng */ });
  });
  K.nghe("trang-chu", function () { baiHienTai = null; dongKhung(); });
})();
