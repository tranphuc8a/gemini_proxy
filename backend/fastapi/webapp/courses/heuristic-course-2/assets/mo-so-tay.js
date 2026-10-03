/* ==========================================================================
   FILE SINH RA — DUNG SUA O DAY.
   Nguon that: courses/engine/mo-so-tay.js
   Sua o do roi chay: python engine/sync.py
   ========================================================================== */
/* ==========================================================================
   MÔ-ĐUN SỔ TAY — tô sáng đoạn bài, gom ghi chú, xuất markdown.

   ★ NGUỒN THẬT: courses/engine/mo-so-tay.js (engine/sync.py chép).

   Bôi đen một đoạn trong bài → "🖍 Tô sáng" (thanh việc của engine). Đoạn tô
   sáng được vẽ bằng CSS Custom Highlight API — KHÔNG sửa DOM của bài, nên không
   đụng công thức, mã, liên kết; lần sau mở bài nó được tìm lại theo chữ (bỏ qua
   khác biệt khoảng trắng). Trang Sổ tay (#/~so-tay) gom mọi đoạn tô sáng và ghi
   chú cuối bài theo thứ tự khoá học; ghi được chú thích cho từng đoạn, tải về
   .md, chép, hoặc mở thẳng trong Markdown Editor. Tất cả nằm trên máy này.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K) return;

  var HOP_KHOI = "p,li,h1,h2,h3,h4,h5,h6,blockquote,pre,td,th,dd,dt,figcaption,summary";
  function ds() { return K.LS.get("so-tay", []); }
  function luu(x) { K.LS.set("so-tay", x); capNhatNut(); }

  /* Chữ của bài với khoảng trắng gộp về một dấu cách, kèm vị trí → (nút chữ, offset),
     để một đoạn đã lưu tìm lại được thành Range — kể cả khi trải qua nhiều thẻ. */
  function chuCua(goc) {
    var w = document.createTreeWalker(goc, NodeFilter.SHOW_TEXT, null), n, chu = "", map = [], trang = true, khoiTruoc = null;
    while ((n = w.nextNode())) {
      var cha = n.parentNode;
      if (!cha || (cha.closest && cha.closest(".chay, .lab-nhung, .cw-lang, .cw-cp, script, style"))) continue;
      var khoi = cha.closest ? cha.closest(HOP_KHOI) : null;
      if (khoi !== khoiTruoc && !trang && map.length) { chu += " "; map.push(map[map.length - 1]); trang = true; }
      khoiTruoc = khoi;
      var s = n.nodeValue;
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (/\s/.test(c)) { if (trang) continue; c = " "; trang = true; } else trang = false;
        chu += c;
        map.push([n, i]);
      }
    }
    return { chu: chu, map: map };
  }
  function timRange(ban, can) {
    var kim = String(can || "").replace(/\s+/g, " ").trim();
    var i = kim ? ban.chu.indexOf(kim) : -1;
    if (i < 0) return null;
    var dau = ban.map[i], cuoi = ban.map[i + kim.length - 1];
    var r = document.createRange();
    r.setStart(dau[0], dau[1]);
    r.setEnd(cuoi[0], cuoi[1] + 1);
    return r;
  }

  var coHighlight = !!(window.CSS && CSS.highlights && typeof window.Highlight === "function");
  function veToSang() {
    if (!coHighlight) return;
    var body = document.getElementById("body"), d = K.baiDangDoc();
    var hl = new window.Highlight();
    if (body && d) {
      var ban = chuCua(body);
      ds().forEach(function (h) {
        if (h.doc !== d.id) return;
        var r = timRange(ban, h.chu);
        if (r) hl.add(r);
      });
    }
    if (hl.size) CSS.highlights.set("so-tay", hl); else CSS.highlights.delete("so-tay");
  }

  K.themViecChon({
    chu: "🖍 Tô sáng", toiThieu: 3,
    khi: function (chu) {
      var d = K.baiDangDoc();
      if (!d) return;
      var x = ds();
      if (x.some(function (h) { return h.doc === d.id && h.chu === chu; })) { K.toast("Đoạn này đã tô sáng"); return; }
      x.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), doc: d.id, chu: chu, ghi: "", luc: Date.now() });
      luu(x);
      veToSang();
      var sel = window.getSelection && window.getSelection();
      if (sel) sel.removeAllRanges();
      K.toast(coHighlight ? "Đã tô sáng — xem lại trong Sổ tay" : "Đã lưu vào Sổ tay");
    }
  });
  K.nghe("bai", function () { veToSang(); });
  K.nghe("trang-chu", function () { if (coHighlight) CSS.highlights.delete("so-tay"); });

  /* ---------------- nút trên header ---------------- */
  K.themBieuTuong("so-tay", '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M10 8h5M10 12h5"/>');
  var nut = null;
  function soGhiChu() {
    var g = K.ghiChu() || {};
    return Object.keys(g).filter(function (k) { return String(g[k] || "").trim(); }).length;
  }
  function capNhatNut() {
    if (nut || (!ds().length && !soGhiChu())) return;
    nut = K.themNut({ ma: "btnSoTay", icon: "so-tay", title: "Sổ tay — đoạn tô sáng và ghi chú",
                      khi: function () { location.hash = "#/~so-tay"; } });
  }
  K.themLoiTat({ ten: "Sổ tay", icon: "so-tay", href: "#/~so-tay" });
  K.nghe("san-sang", capNhatNut);

  /* ---------------- markdown ---------------- */
  function nhom() {
    var docs = K.docs(), g = K.ghiChu() || {}, x = ds(), theoBai = {};
    x.forEach(function (h) { (theoBai[h.doc] = theoBai[h.doc] || []).push(h); });
    var thuTu = K.thuTu().slice();
    Object.keys(theoBai).concat(Object.keys(g)).forEach(function (id) { if (thuTu.indexOf(id) < 0) thuTu.push(id); });
    return thuTu.filter(function (id) { return (theoBai[id] || []).length || String(g[id] || "").trim(); }).map(function (id) {
      return { id: id, bai: docs[id], to: theoBai[id] || [], ghi: String(g[id] || "").trim() };
    });
  }
  function tenKhoa() { return ((K.manifest() || {}).course || {}).title || K.khoa || "Khoá học"; }
  function sangMarkdown() {
    var out = ["# Sổ tay — " + tenKhoa(), "", "_Xuất ngày " + new Date().toLocaleDateString("vi-VN") + "_", ""];
    nhom().forEach(function (b) {
      out.push("## " + (b.bai ? b.bai.title : b.id), "");
      b.to.forEach(function (h) {
        out.push("> " + h.chu.replace(/\n/g, "\n> "), "");
        if (h.ghi) out.push(h.ghi, "");
      });
      if (b.ghi) out.push("**Ghi chú của bài:**", "", b.ghi, "");
    });
    return out.join("\n");
  }

  /* ---------------- trang #/~so-tay ---------------- */
  function veTrang(main) {
    var cac = nhom(), soTo = ds().length;
    document.title = "Sổ tay — " + tenKhoa();
    main.innerHTML = '<div class="page"><article class="doc st-trang">' +
      '<div class="crumb"><a href="#/">Trang chủ</a>' + K.icon("chev") + "<span>Sổ tay</span></div>" +
      '<div class="prose prose-head"><h1>Sổ tay</h1></div>' +
      '<p class="ot-tom">' + soTo + " đoạn tô sáng · " + soGhiChu() + " bài có ghi chú" +
        (coHighlight ? "" : " · trình duyệt này chưa vẽ được đoạn tô sáng trong bài (vẫn lưu ở đây)") + "</p>" +
      (cac.length ? '<div class="st-cong-cu"><button type="button" class="btn btn-s" data-st="tai">Tải .md</button>' +
        '<button type="button" class="btn btn-s" data-st="chep">Chép markdown</button>' +
        '<button type="button" class="btn btn-s" data-st="mo">Mở trong Markdown Editor</button></div>' : "") +
      (cac.length ? cac.map(function (b) {
        return '<section class="st-bai"><h2>' + (b.bai ? '<a href="#/' + K.esc(b.bai.slug) + '">' + K.esc(b.bai.title) + "</a>" :
          K.esc(b.id)) + "</h2>" + b.to.map(function (h) {
            return '<div class="st-to"><blockquote>' + K.esc(h.chu) + "</blockquote>" +
              '<div class="st-to-chan"><textarea rows="1" data-ghi="' + K.esc(h.id) + '" placeholder="Chú thích cho đoạn này…">' +
              K.esc(h.ghi || "") + '</textarea><button type="button" class="ic-btn" data-xoa="' + K.esc(h.id) +
              '" title="Bỏ tô sáng" aria-label="Bỏ tô sáng">✕</button></div></div>';
          }).join("") + (b.ghi ? '<div class="st-ghi"><b>Ghi chú của bài</b><p>' + K.esc(b.ghi) + "</p></div>" : "") + "</section>";
      }).join("") : '<div class="ot-xong">Chưa có gì. Bôi đen một đoạn trong bài rồi bấm <b>🖍 Tô sáng</b>; ghi chú cuối mỗi bài ' +
        "cũng hiện ở đây.</div>") +
      "</article></div>";
    var tLuu;
    main.oninput = function (e) {
      var id = e.target.getAttribute("data-ghi");
      if (!id) return;
      clearTimeout(tLuu);
      tLuu = setTimeout(function () {
        luu(ds().map(function (h) { if (h.id === id) h.ghi = e.target.value.trim(); return h; }));
      }, 300);
    };
    main.onclick = function (e) {
      var x = e.target.closest("[data-xoa]"), b = e.target.closest("[data-st]");
      if (x) { luu(ds().filter(function (h) { return h.id !== x.getAttribute("data-xoa"); })); veTrang(main); return; }
      if (!b) return;
      var md = sangMarkdown(), viec = b.getAttribute("data-st");
      if (viec === "tai") {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
        a.download = "so-tay-" + (K.khoa || "khoa-hoc") + ".md";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      } else if (viec === "chep") {
        (navigator.clipboard ? navigator.clipboard.writeText(md) : Promise.reject()).then(function () {
          K.toast("Đã chép markdown");
        }, function () { K.toast("Không chép được — dùng Tải .md"); });
      } else {
        /* Hộp thư của Markdown Editor: trang đó đọc khi mở với ?import=1 rồi xoá. */
        try {
          localStorage.setItem("markdown-editor:inbox", JSON.stringify({ name: "so-tay-" + (K.khoa || "khoa-hoc") + ".md",
            content: md, at: Date.now(), from: tenKhoa() }));
        } catch (er) { K.toast("Không ghi được hộp thư của Markdown Editor"); return; }
        var cfg = window.__WEBAPP_CONFIG__ || {};
        window.open(String(cfg.webappBase || "/webapp").replace(/\/+$/, "") + "/tranphuc8a/markdown-editor-pro/?import=1", "_blank", "noopener");
      }
    };
    window.scrollTo(0, 0);
  }
  K.dangKyTrang("so-tay", veTrang);
})();
