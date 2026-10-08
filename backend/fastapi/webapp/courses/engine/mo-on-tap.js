/* ==========================================================================
   MÔ-ĐUN ÔN TẬP — thẻ ghi nhớ, lặp lại ngắt quãng (thuật toán SM-2).

   ★ NGUỒN THẬT: courses/engine/mo-on-tap.js (engine/sync.py chép). Engine nạp
     tệp này sau app.js và cho nó API window.KhoaHoc.

   Thẻ đến từ trợ giảng AI ("Thẻ ôn tập" dưới tiêu đề bài) hoặc tự thêm ở trang
   Ôn tập (#/~on-tap). Mỗi lần ôn, người học chấm một trong bốn mức — Quên / Khó /
   Được / Dễ — và SM-2 hẹn ngày gặp lại: nhớ càng chắc thì khoảng cách càng giãn
   (1 ngày → 6 ngày → nhân hệ số dễ của thẻ; thẻ mới chấm "Dễ" ngay lần đầu được
   4 ngày như Anki). Thẻ "Quên" quay lại ngay trong buổi ôn. Trang chủ báo "Hôm
   nay cần ôn N thẻ"; nút trên header mang số thẻ đến hạn.
   Mọi thứ nằm trên máy này (localStorage, riêng từng khoá học).

   API cho mô-đun khác: KhoaHoc.onTap.them(idBai, [{front, back}]) → số thẻ mới;
   .denHan() → số thẻ đến hạn; .nhatKy() → {ngày: số thẻ đã ôn}.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K) return;

  var MUC = [{ q: 1, ten: "Quên" }, { q: 3, ten: "Khó" }, { q: 4, ten: "Được" }, { q: 5, ten: "Dễ" }];
  var GIU_NHAT_KY = 400;

  /* ngày theo giờ máy, đếm từ 1970 — so sánh "đến hạn" theo ngày, không theo giờ */
  function ngay(t) {
    var d = t ? new Date(t) : new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }
  function bo() { return K.LS.get("the", []); }
  function luu(ds) { K.LS.set("the", ds); capNhatNut(); }
  function denHan(ds) {
    var h = ngay();
    return (ds || bo()).filter(function (c) { return c.due <= h; });
  }

  /* SM-2: q ∈ {1,3,4,5}; q < 3 là quên → học lại từ đầu */
  function sau(c, q) {
    var n = c.n, iv = c.iv, ef = c.ef;
    if (q < 3) { n = 0; iv = 1; }
    else { n += 1; iv = n === 1 ? (q === 5 ? 4 : 1) : n === 2 ? 6 : Math.round(iv * ef); }
    ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    return { n: n, iv: iv, ef: Math.round(ef * 100) / 100 };
  }
  function nhanKhoang(ngayCon) {
    return ngayCon <= 1 ? "1 ngày" : ngayCon < 30 ? ngayCon + " ngày" : ngayCon < 365 ? Math.round(ngayCon / 30) + " tháng" :
      (Math.round(ngayCon / 36.5) / 10) + " năm";
  }

  function ghiNhatKy() {
    var nk = K.LS.get("on-tap.ngay", {}), h = String(ngay());
    nk[h] = (nk[h] || 0) + 1;
    var khoa = Object.keys(nk).sort();
    while (khoa.length > GIU_NHAT_KY) delete nk[khoa.shift()];
    K.LS.set("on-tap.ngay", nk);
  }

  function them(idBai, ds) {
    var cu = bo(), co = {};
    cu.forEach(function (c) { co[c.doc + "\u0001" + K.norm(c.front)] = 1; });
    var moi = 0, h = ngay();
    (ds || []).forEach(function (x) {
      var front = String(x && x.front || "").trim(), back = String(x && x.back || "").trim();
      var k = idBai + "\u0001" + K.norm(front);
      if (!front || !back || co[k]) return;
      co[k] = 1;
      cu.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), doc: idBai || "", front: front,
                back: back, ef: 2.5, n: 0, iv: 0, due: h, tao: Date.now(), lan: 0 });
      moi++;
    });
    if (moi) luu(cu);
    return moi;
  }

  K.onTap = {
    them: them,
    denHan: function () { return denHan().length; },
    nhatKy: function () { return K.LS.get("on-tap.ngay", {}); }
  };

  /* ---------------- nút trên header ---------------- */
  K.themBieuTuong("the-on", '<rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>');
  var nut = null;
  function capNhatNut() {
    var n = denHan().length;
    if (!nut) {
      if (!bo().length) return;
      nut = K.themNut({ ma: "btnOnTap", icon: "the-on", title: "Ôn tập", khi: function () { location.hash = "#/~on-tap"; } });
      nut.classList.add("ot-nut");
    }
    nut.title = n ? "Ôn tập — " + n + " thẻ đến hạn hôm nay" : "Ôn tập — hôm nay không còn thẻ đến hạn";
    var so = nut.querySelector(".ot-so-nut");
    if (!so) { so = document.createElement("span"); so.className = "ot-so-nut"; nut.appendChild(so); }
    so.textContent = n > 99 ? "99+" : String(n);
    so.hidden = !n;
  }

  /* ---------------- ô trên trang chủ ---------------- */
  K.nghe("trang-chu", function (main) {
    var home = main.querySelector(".home");
    if (!home) return;
    var ds = bo(), n = denHan(ds).length;
    var o = document.createElement("div");
    o.className = "card full ot-o";
    o.id = "otO";
    o.innerHTML = '<div class="offline-dau">' + K.icon("the-on") + "<b>Ôn tập</b></div><p>" +
      (!ds.length ? "Chưa có thẻ nào. Mở một bài, bấm “Thẻ ôn tập” ở hàng trợ giảng AI — hoặc tự thêm thẻ — rồi ôn đều mỗi ngày." :
        n ? "Hôm nay cần ôn <b>" + n + "</b> thẻ (bộ có " + ds.length + " thẻ)." :
        "Đã ôn hết thẻ đến hạn hôm nay — bộ có " + ds.length + " thẻ.") +
      '</p><a class="btn ' + (n ? "btn-p" : "btn-s") + '" href="#/~on-tap">' + (n ? "Ôn ngay" : "Mở bộ thẻ") + "</a>";
    home.appendChild(o);
  });

  /* ---------------- trang #/~on-tap ---------------- */
  var phien = null;              /* {hang: [id…], da: số thẻ đã chấm} */

  function veTrang(main) {
    var ds = bo();
    main.innerHTML = '<div class="page"><article class="doc ot-trang">' +
      '<div class="crumb"><a href="#/">Trang chủ</a>' + K.icon("chev") + "<span>Ôn tập</span></div>" +
      '<div class="prose prose-head"><h1>Ôn tập</h1></div>' +
      '<p class="ot-tom" id="otTom"></p>' +
      '<div id="otKhung"></div>' +
      '<details class="ot-ds"' + (ds.length ? "" : " open") + '><summary>Bộ thẻ (' + ds.length + ')</summary><div id="otDs"></div>' +
        '<form class="ot-them" id="otThem"><b>Thêm thẻ</b>' +
        '<textarea name="front" rows="2" maxlength="400" placeholder="Mặt trước — câu hỏi" required></textarea>' +
        '<textarea name="back" rows="3" maxlength="1200" placeholder="Mặt sau — câu trả lời" required></textarea>' +
        '<button type="submit" class="btn btn-s">Thêm thẻ</button></form></details>' +
      "</article></div>";
    document.title = "Ôn tập — " + (((K.manifest() || {}).course || {}).title || "");
    /* buổi ôn giữ hàng đợi khi rời trang rồi quay lại; thẻ mới đến hạn được gộp vào */
    if (!phien) phien = { hang: [], da: 0 };
    denHan(ds).forEach(function (c) { if (phien.hang.indexOf(c.id) < 0) phien.hang.push(c.id); });
    veTom();
    veThe();
    veDs();
    main.querySelector("#otThem").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var n = them("", [{ front: f.front.value, back: f.back.value }]);
      K.toast(n ? "Đã thêm thẻ" : "Thẻ này đã có");
      if (n) { phien.hang.push(bo().slice(-1)[0].id); f.reset(); veTom(); veThe(); veDs(); }
    });
    window.scrollTo(0, 0);
  }

  function veTom() {
    var e = document.getElementById("otTom");
    if (!e) return;
    var ds = bo(), nk = K.LS.get("on-tap.ngay", {});
    e.textContent = "Còn " + phien.hang.length + " thẻ trong buổi này · bộ có " + ds.length + " thẻ · hôm nay đã ôn " +
      (nk[String(ngay())] || 0) + " lượt";
  }

  function theCua(id) { return bo().filter(function (c) { return c.id === id; })[0]; }

  function veThe() {
    var khung = document.getElementById("otKhung");
    if (!khung) return;
    while (phien.hang.length && !theCua(phien.hang[0])) phien.hang.shift();     /* thẻ đã xoá */
    if (!phien.hang.length) {
      var ds = bo(), mai = ds.filter(function (c) { return c.due === ngay() + 1; }).length;
      khung.innerHTML = '<div class="ot-xong">' + (ds.length ?
        "<b>Xong phần hôm nay" + (phien.da ? " — đã ôn " + phien.da + " lượt" : "") + ".</b> " +
          (mai ? "Ngày mai có " + mai + " thẻ đến hạn." : "Ngày mai chưa có thẻ nào đến hạn.") :
        "<b>Chưa có thẻ nào.</b> Mở một bài và bấm “Thẻ ôn tập” ở hàng trợ giảng AI, hoặc thêm thẻ ở dưới.") + "</div>";
      return;
    }
    var c = theCua(phien.hang[0]), bai = c.doc && K.docs()[c.doc];
    khung.innerHTML = '<div class="ot-the">' +
      (bai ? '<div class="ot-bai">Bài: <a href="#/' + K.esc(bai.slug) + '">' + K.esc(bai.title) + "</a></div>" : "") +
      '<div class="ot-mat" id="otTruoc"></div><div class="ot-mat ot-sau" id="otSau" hidden></div>' +
      '<div class="ot-nut-hang"><button type="button" class="btn btn-p" id="otLat">Hiện đáp án <kbd>Space</kbd></button>' +
      '<div class="ot-cham" id="otCham" hidden>' + MUC.map(function (m, i) {
        var s = sau(c, m.q);
        return '<button type="button" class="btn btn-s" data-q="' + m.q + '"><b>' + m.ten + "</b><span>" +
          (m.q < 3 ? "ôn lại ngay" : nhanKhoang(s.iv)) + "</span><kbd>" + (i + 1) + "</kbd></button>";
      }).join("") + "</div></div></div>";
    khung.querySelector("#otTruoc").appendChild(K.render(c.front, c.doc));
    khung.querySelector("#otSau").appendChild(K.render(c.back, c.doc));
    khung.querySelector("#otLat").addEventListener("click", lat);
    khung.querySelector("#otCham").addEventListener("click", function (e) {
      var b = e.target.closest("[data-q]");
      if (b) cham(+b.getAttribute("data-q"));
    });
    if (K.ai) K.ai.trangThai().then(function (s) { if (K.ai.dungDuoc(s) && phien.hang[0] === c.id) themAiCham(khung, c); },
                                     function () { /* không hỏi được máy chủ: ôn như cũ */ });
  }

  /* ---- ✨ tự trả lời rồi để AI chấm (POST /ai/review): gợi ý mức, người học vẫn tự chọn ---- */
  var VERDICT = { dung: "✓ Đúng", "gan-dung": "≈ Gần đúng", sai: "✗ Chưa đúng", "bo-trong": "Chưa trả lời" };
  function mucTuDiem(diem) { return diem >= 5 ? 5 : diem === 4 ? 4 : diem === 3 ? 3 : 1; }
  function themAiCham(khung, c) {
    var the = khung.querySelector(".ot-the");
    if (!the || the.querySelector(".ot-ai")) return;
    var hop = document.createElement("div");
    hop.className = "ot-ai";
    hop.innerHTML = '<label class="ot-ai-nhan" for="otTraLoi">✨ Tự trả lời trước khi lật thẻ — AI chấm giúp (tuỳ chọn)</label>' +
      '<textarea id="otTraLoi" rows="2" maxlength="2000" placeholder="Câu trả lời của bạn…"></textarea>' +
      '<div class="ot-ai-chan"><button type="button" class="btn btn-s" id="otAiCham">✨ Chấm</button>' +
      '<span class="ot-ai-meo">Ctrl+Enter</span></div><div class="ot-ai-kq" id="otAiKq" aria-live="polite"></div>';
    the.insertBefore(hop, the.querySelector(".ot-nut-hang"));
    var o = hop.querySelector("#otTraLoi"), nut = hop.querySelector("#otAiCham"), kq = hop.querySelector("#otAiKq");
    function chamAi() {
      var tl = o.value.trim();
      if (!tl) { K.toast("Viết câu trả lời trước đã"); o.focus(); return; }
      nut.disabled = true;
      kq.innerHTML = '<p class="ai-cho">Đang chấm…</p>';
      K.ai.goi("review", { question: c.front, expected: c.back, answer: tl, course: K.khoa, doc: c.doc || "" }).then(function (r) {
        nut.disabled = false;
        kq.innerHTML = '<div class="ot-ai-diem ' + K.esc(r.verdict) + '"><b>' + (VERDICT[r.verdict] || "") + "</b> · " + (+r.score || 0) + "/5</div>" +
          "<p>" + K.esc(r.feedback || "") + "</p>" +
          ((r.missing || []).length ? '<p class="ot-ai-thieu">Còn thiếu: ' + r.missing.map(K.esc).join(" · ") + "</p>" : "");
        lat();
        var q = mucTuDiem(+r.score || 0);
        Array.prototype.forEach.call(document.querySelectorAll("#otCham [data-q]"), function (b) {
          var la = +b.getAttribute("data-q") === q;
          b.classList.toggle("ot-goi-y", la);
          if (la) b.title = "AI gợi ý mức này — bạn vẫn tự chọn";
        });
      }, function (e) {
        nut.disabled = false;
        K.ai.hienLoi(kq, e, chamAi);
      });
    }
    nut.addEventListener("click", chamAi);
    o.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); chamAi(); } });
  }

  function lat() {
    var s = document.getElementById("otSau");
    if (!s || !s.hidden) return;
    s.hidden = false;
    document.getElementById("otLat").hidden = true;
    document.getElementById("otCham").hidden = false;
  }

  function cham(q) {
    var s = document.getElementById("otSau");
    if (!s || s.hidden || !phien.hang.length) return;
    var ds = bo(), id = phien.hang.shift();
    ds.forEach(function (c) {
      if (c.id !== id) return;
      var m = sau(c, q);
      c.n = m.n; c.iv = m.iv; c.ef = m.ef; c.due = ngay() + m.iv; c.lan = (c.lan || 0) + 1;
      if (q < 3) phien.hang.push(id);                 /* quên: gặp lại cuối buổi này */
    });
    luu(ds);
    ghiNhatKy();
    phien.da++;
    veTom();
    veThe();
  }

  function veDs() {
    var hop = document.getElementById("otDs");
    if (!hop) return;
    var ds = bo(), docs = K.docs(), theoBai = {};
    ds.forEach(function (c) { (theoBai[c.doc] = theoBai[c.doc] || []).push(c); });
    var h = ngay();
    hop.innerHTML = Object.keys(theoBai).map(function (id) {
      var bai = docs[id];
      return '<div class="ot-nhom"><div class="ot-nhom-h">' + (bai ? '<a href="#/' + K.esc(bai.slug) + '">' + K.esc(bai.title) + "</a>" :
        id ? K.esc(id) : "Thẻ tự thêm") + "</div><ul>" + theoBai[id].map(function (c) {
          return "<li><span>" + K.esc(c.front) + '</span><em>' + (c.due <= h ? "đến hạn" : "còn " + nhanKhoang(c.due - h)) +
            '</em><button type="button" class="ic-btn" data-xoa="' + K.esc(c.id) + '" title="Xoá thẻ" aria-label="Xoá thẻ">✕</button></li>';
        }).join("") + "</ul></div>";
    }).join("") || '<p class="ot-trong">Bộ thẻ trống.</p>';
    hop.onclick = function (e) {
      var b = e.target.closest("[data-xoa]");
      if (!b) return;
      luu(bo().filter(function (c) { return c.id !== b.getAttribute("data-xoa"); }));
      veTom(); veThe(); veDs();
    };
  }

  K.dangKyTrang("on-tap", function (main) { veTrang(main); });

  document.addEventListener("keydown", function (e) {
    if (!document.getElementById("otKhung")) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " " || e.key === "Enter") {
      var s = document.getElementById("otSau");
      if (s && s.hidden) { e.preventDefault(); lat(); }
    } else if (/^[1-4]$/.test(e.key)) {
      cham(MUC[+e.key - 1].q);
    }
  });

  K.themLoiTat({ ten: "Ôn tập", icon: "the-on", href: "#/~on-tap" });
  K.nghe("san-sang", capNhatNut);
})();
