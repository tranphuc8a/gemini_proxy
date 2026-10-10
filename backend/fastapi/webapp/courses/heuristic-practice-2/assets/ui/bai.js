/* Trang thực hành của một bài: tóm tắt · trắc nghiệm · tự luận · lab · ghi chú, cùng liên kết sang bài giảng và mô phỏng. */
(function (root) {
  "use strict";
  var TH = root.TH, ui = TH.ui, D = TH.dom, h = D.h, ic = ui.ic, luu = ui.luu, TN = TH.tracNghiem, MK = TH.markup;
  var K = TH.khoa;

  var DEMO_TEN = {
    "bung-no-to-hop": "Bùng nổ tổ hợp", "bieu-dien-nghiem": "Biểu diễn nghiệm", "dia-hinh-toi-uu": "Địa hình tối ưu", "greedy-chi-so": "Greedy — bốn họ chỉ số",
    "gia-mo-lambda": "Giá mờ λ", "chen-va-tiet-kiem": "Chèn · tiếc nuối · tiết kiệm", "grasp-rcl": "GRASP — RCL", "leo-doi": "Leo đồi", "toan-tu-2opt": "Các toán tử 2-opt…",
    "delta-evaluation": "Đánh giá delta", "simulated-annealing": "Simulated annealing", "tabu-search": "Tabu search", "beam-search": "Beam search", "lns-alns": "LNS & ALNS",
    "dan-kien": "Đàn kiến", "di-truyen": "Giải thuật di truyền", "tien-hoa-vi-phan": "Tiến hoá vi phân", "bay-dan-pso": "Bầy hạt PSO", "dua-thuat-toan": "Đua bốn thuật toán",
    "do-luong-ablation": "Bao nhiêu test là đủ?", "can-tren-can-duoi": "Cận trên, cận dưới", "cau-truc-bien-duyen": "Biên duyên", "qua-khop-seed": "Quá khớp seed",
    "trieu-chung-go-loi": "Bốn triệu chứng gỡ lỗi", "phan-bo-cong-suc": "Phân bổ công sức"
  };
  ui.demoTen = function (d) { return DEMO_TEN[d] || d; };

  function sao(n) { var s = ""; for (var i = 0; i < 3; i++) s += i < n ? "★" : "☆"; return s; }
  function loiTai(el, e, thuLai) {
    el.replaceChildren(h("div", { class: "wrap" }, h("div", { class: "card" }, h("h2", { text: "Không mở được bài" }), h("p", { class: "mut", text: String(e && e.message || e) }),
      h("div", { style: "display:flex;gap:10px;flex-wrap:wrap" }, h("button", { class: "btn btn-ac", type: "button", onclick: thuLai }, "Thử lại"), h("a", { class: "btn", href: "#/" }, "Về trang chủ")))));
  }

  /* Cập nhật bản ghi tóm tắt tiến độ từ các bản ghi chi tiết (chỉ ghi khi có thay đổi). */
  function dongBoTienDo(id, bai) {
    var rt = luu.doc("trac/" + id, { kq: {} }), rl = luu.doc("luan/" + id, {});
    var tD = 0; (bai.trac || []).forEach(function (c) { if (rt.kq && rt.kq[c.id] === true) tD++; });
    var lD = 0; (bai.luan || []).forEach(function (c) { if (rl[c.id] && rl[c.id].xem) lD++; });
    var m = 0, n = 0, hop = 0;
    (bai.lab || []).forEach(function (l) {
      var r = luu.doc("lab/" + id + "/" + l.id, null), toiDa = 1 + (l.muc || []).length;
      n += toiDa; if (r && r.muc) { m += r.muc; if (r.muc >= 1) hop++; }
    });
    var moi = { t: { d: tD, n: (bai.trac || []).length }, l: { d: lD, n: (bai.luan || []).length }, b: { m: m, n: n, soLab: (bai.lab || []).length, hopLe: hop } };
    var cu = ui.tdo(id);
    if (!cu || JSON.stringify([cu.t, cu.l, cu.b]) !== JSON.stringify([moi.t, moi.l, moi.b])) ui.ghiTdo(id, moi);
  }
  ui.dongBoTienDo = dongBoTienDo;

  /* ---------------------------------------------------------------- trắc nghiệm */
  function veTrac(bai, id, vung) {
    var rec = luu.doc("trac/" + id, { kq: {}, lan: 0, tot: 0 });
    var dsGoc = bai.trac, ds = dsGoc, ketQua = {}, daLam = 0;
    var ghiKQ = function () { luu.ghi("trac/" + id, rec); dongBoTienDo(id, bai); };

    var khung = h("div", {}), tongKet = h("div", {});
    vung.appendChild(khung); vung.appendChild(tongKet);

    function batDau(chiSai) {
      ds = chiSai ? dsGoc.filter(function (c) { return rec.kq[c.id] === false || ketQua[c.id] === false; }) : dsGoc;
      rec.lan = (rec.lan || 0) + 1;                       /* mỗi lần làm đổi seed ⇒ đáp án xáo khác đi */
      var seed = rec.lan;
      ketQua = {}; daLam = 0;
      khung.replaceChildren(); tongKet.replaceChildren();
      ds.forEach(function (c, i) { khung.appendChild(theCau(c, i, seed)); });
      if (!ds.length) khung.appendChild(h("p", { class: "mut", text: "Không có câu nào cần làm lại — bạn đã đúng hết." }));
    }

    function theCau(cau, i, seed) {
      var the = h("article", { class: "card cau", "aria-label": "Câu " + (i + 1) });
      var truoc = rec.kq[cau.id];
      the.appendChild(h("div", { class: "cau-dau" }, h("span", { class: "cau-so", text: "Câu " + (i + 1) + "/" + ds.length }),
        cau.doKho ? h("span", { class: "chip xam", title: "Độ khó" }, "★".repeat(cau.doKho)) : null,
        cau.loai === "nhieu" ? h("span", { class: "chip warn" }, "Chọn mọi ý đúng") : null,
        truoc === true ? h("span", { class: "chip ok" }, "Lần trước: đúng") : truoc === false ? h("span", { class: "chip bad" }, "Lần trước: sai") : null));
      the.appendChild(h("div", { class: "cau-hoi md", html: MK.html(cau.hoi) }));
      var vungTL = h("div", {}), phanHoi = h("div", {}), xong = false;

      function chot(traLoi) {
        if (xong) return; xong = true;
        var c = TN.cham(cau, traLoi), dung = c.dung;
        ketQua[cau.id] = dung; daLam++;
        rec.kq[cau.id] = dung; ghiKQ();
        phanHoi.replaceChildren(h("div", { class: "phan-hoi " + (dung ? "ok" : "bad"), role: "status" },
          h("b", { class: "kq", text: dung ? "✔ Chính xác!" : "✘ Chưa đúng." }),
          dung ? null : h("div", {}, h("b", { text: "Đáp án: " }), h("span", { html: MK.dong(TN.dapAnChu(cau)) })),
          h("div", { class: "md", style: "margin-top:6px", html: MK.html(cau.giaiThich) }),
          cau.ref ? h("div", { class: "mut", style: "margin-top:6px;font-size:.86rem", text: "📖 " + cau.ref }) : null));
        if (daLam >= ds.length) hienTongKet();
        return c;
      }

      if (cau.loai === "so") {
        var o = h("input", { type: "text", inputmode: cau.dapAn < 0 ? "text" : "decimal", autocomplete: "off",   /* bàn phím số trên iOS không có dấu trừ */ "aria-label": "Câu trả lời của bạn", placeholder: "Nhập số" });
        var nut = h("button", { class: "btn btn-ac", type: "button", text: "Kiểm tra" });
        var kiem = function () {
          if (xong) return;
          if (!isFinite(TH.tienIch.docSo(o.value))) { D.toast("Hãy nhập một số (ví dụ 0,5 hoặc 390).", "bad"); o.focus(); return; }
          chot(o.value); o.disabled = true; nut.disabled = true;
        };
        nut.addEventListener("click", kiem);
        o.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); kiem(); } });
        vungTL.appendChild(h("div", { class: "so-nhap" }, o, cau.donVi ? h("span", { class: "mut", text: cau.donVi }) : null, nut));
      } else {
        var thuTu = TN.thuTu(cau, seed), nhieu = cau.loai === "nhieu", chon = {}, nuts = [];
        thuTu.forEach(function (goc, vt) {
          var nut2 = h("button", { type: "button", class: "lc" + (nhieu ? " nhieu" : ""), "aria-pressed": nhieu ? "false" : null },
            h("span", { class: "dau", "aria-hidden": "true", text: String.fromCharCode(65 + vt) }), h("span", { class: "nd md", html: MK.dong(cau.chon[goc]) }));
          nut2.addEventListener("click", function () {
            if (xong) return;
            if (nhieu) { chon[goc] = !chon[goc]; nut2.classList.toggle("chon", !!chon[goc]); nut2.setAttribute("aria-pressed", chon[goc] ? "true" : "false"); }
            else { var kq = chot(goc); tong(kq.dung ? [goc] : [goc], goc); }
          });
          nuts.push([goc, nut2]); vungTL.appendChild(nut2);
        });
        var tong = function (chonList) {                       /* tô màu sau khi chấm */
          var dungSet = nhieu ? cau.dung : [cau.dung];
          nuts.forEach(function (p) {
            p[1].disabled = true;
            var laDung = dungSet.indexOf(p[0]) >= 0, daChon = nhieu ? !!chon[p[0]] : chonList.indexOf(p[0]) >= 0;
            if (laDung) p[1].classList.add("dung"); else if (daChon) p[1].classList.add("sai");
            p[1].classList.remove("chon");
            if (laDung && !daChon) p[1].insertAdjacentHTML("beforeend", '<span class="vh"> (đáp án đúng bạn chưa chọn)</span>');
          });
        };
        if (nhieu) {
          var nutKT = h("button", { class: "btn btn-ac", type: "button", style: "margin-top:8px", text: "Kiểm tra" });
          nutKT.addEventListener("click", function () {
            var ds2 = Object.keys(chon).filter(function (k) { return chon[k]; }).map(Number);
            if (!ds2.length) { D.toast("Hãy chọn ít nhất một đáp án.", "bad"); return; }
            chot(ds2); tong(ds2); nutKT.disabled = true;
          });
          vungTL.appendChild(nutKT);
        }
      }
      the.appendChild(vungTL); the.appendChild(phanHoi);
      return the;
    }

    function hienTongKet() {
      var tk = TN.tongKet(dsGoc, rec.kq), lanNay = TN.tongKet(ds, ketQua);
      rec.tot = Math.max(rec.tot || 0, tk.tot); luu.ghi("trac/" + id, rec); dongBoTienDo(id, bai);
      var sai = dsGoc.filter(function (c) { return rec.kq[c.id] === false; }).length;
      tongKet.replaceChildren(h("div", { class: "card", style: "margin-top:14px", role: "status" },
        h("div", { class: "ket-qua-trac" },
          h("span", { class: "lon", text: lanNay.tot + "/" + lanNay.tong }),
          h("div", {}, h("b", { text: TN.xepLoai(tk.tyLe) }), h("div", { class: "mut", text: "Tổng cả bài: đang đúng " + tk.tot + "/" + tk.tong + " · cao nhất " + (rec.tot || 0) + "/" + tk.tong }))),
        h("div", { class: "thanh", style: "margin:10px 0" }, h("i", { style: "width:" + Math.round(tk.tyLe * 100) + "%" })),
        h("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
          sai ? h("button", { class: "btn btn-ac", type: "button", onclick: function () { batDau(true); tongKet.scrollIntoView({ block: "center" }); } }, ic("reset"), "Làm lại " + sai + " câu sai") : null,
          h("button", { class: "btn", type: "button", onclick: function () { batDau(false); vung.scrollIntoView({ block: "start" }); } }, ic("reset"), "Làm lại tất cả (xáo đáp án)"))));
    }
    batDau(false);
  }

  /* ---------------------------------------------------------------- tự luận */
  function veLuan(bai, id, vung) {
    var rec = luu.doc("luan/" + id, {});
    function ghi() { luu.ghi("luan/" + id, rec); dongBoTienDo(id, bai); }
    bai.luan.forEach(function (cau, i) {
      var r = rec[cau.id] || (rec[cau.id] = { nd: "", xem: false, tick: [], goiY: 0 });
      var the = h("article", { class: "card cau", "aria-label": "Tự luận " + (i + 1) });
      the.appendChild(h("div", { class: "cau-dau" }, h("span", { class: "cau-so", text: "Câu " + (i + 1) + "/" + bai.luan.length }),
        cau.doKho ? h("span", { class: "chip xam" }, "★".repeat(cau.doKho)) : null, cau.ref ? h("span", { class: "chip xam" }, "📖 " + cau.ref) : null));
      the.appendChild(h("div", { class: "cau-hoi md", html: MK.html(cau.hoi) }));
      var ta = h("textarea", { class: "tx", placeholder: "Viết câu trả lời của bạn (tự lưu)…", "aria-label": "Câu trả lời tự luận " + (i + 1), value: r.nd, style: "margin-top:10px" });
      var hen = 0;
      ta.addEventListener("input", function () { clearTimeout(hen); hen = setTimeout(function () { r.nd = ta.value; ghi(); }, 500); });
      the.appendChild(ta);
      var hang = h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px" });
      var dsGoiY = h("ul", { class: "goi-y-ds" }), vungMau = h("div", {});
      function veGoiY() {
        dsGoiY.replaceChildren();
        (cau.goiY || []).slice(0, r.goiY || 0).forEach(function (g) { dsGoiY.appendChild(h("li", { class: "md", html: MK.dong(g) })); });
        if (nutGoiY) { nutGoiY.hidden = !(cau.goiY && (r.goiY || 0) < cau.goiY.length); nutGoiY.lastChild.textContent = "Gợi ý (" + (r.goiY || 0) + "/" + (cau.goiY || []).length + ")"; }
      }
      var nutGoiY = (cau.goiY && cau.goiY.length) ? h("button", { class: "btn btn-sm", type: "button", onclick: function () { r.goiY = (r.goiY || 0) + 1; ghi(); veGoiY(); } }, ic("bulb"), h("span", { text: "Gợi ý" })) : null;
      var nutXem = h("button", { class: "btn btn-sm btn-ac", type: "button" }, ic("eye"), h("span", { text: r.xem ? "Ẩn đáp án mẫu" : "Xem đáp án mẫu" }));
      function veMau() {
        vungMau.replaceChildren();
        nutXem.lastChild.textContent = r.xem ? "Ẩn đáp án mẫu" : "Xem đáp án mẫu";
        if (!r.xem) return;
        var tick = r.tick || (r.tick = []);
        var tinh = h("span", { class: "chip" });
        function capNhat() { var d = tick.filter(Boolean).length; tinh.textContent = "Tự chấm: " + d + "/" + cau.tieuChi.length + " ý"; tinh.className = "chip " + (d === cau.tieuChi.length ? "ok" : d ? "warn" : "bad"); }
        var ds = h("ul", { class: "tieu-chi" });
        cau.tieuChi.forEach(function (t, k) {
          var cb = h("input", { type: "checkbox", checked: !!tick[k] });
          cb.addEventListener("change", function () { tick[k] = cb.checked ? 1 : 0; ghi(); capNhat(); });
          ds.appendChild(h("li", {}, h("label", {}, cb, h("span", { class: "md", html: MK.dong(t) }))));
        });
        vungMau.appendChild(h("div", { class: "luan-mau" },
          h("b", { text: "Đáp án mẫu" }), h("div", { class: "md", style: "margin-top:6px", html: MK.html(cau.mau) }),
          h("hr", { style: "border:0;border-top:1px solid var(--bd);margin:12px 0" }),
          h("b", { text: "Tự chấm — tick những ý bạn đã viết đúng:" }), ds, h("div", { style: "margin-top:8px" }, tinh)));
        capNhat();
      }
      nutXem.addEventListener("click", function () {
        if (r.xem) { r.xem = false; ghi(); veMau(); return; }
        var xem = function () { r.xem = true; r.nd = ta.value; ghi(); veMau(); };
        if (!ta.value.trim()) {
          D.hoi({ tieuDe: "Bạn chưa viết gì", noiDung: "Thử viết vài dòng trước rồi so với đáp án mẫu — cách đó nhớ lâu hơn nhiều so với chỉ đọc.", nutChinh: "Xem luôn", nutPhu: "Để mình viết trước" }).then(function (ok) { if (ok) xem(); else ta.focus(); });
        } else xem();
      });
      hang.appendChild(nutGoiY); hang.appendChild(nutXem);
      the.appendChild(hang); the.appendChild(dsGoiY); the.appendChild(vungMau);
      veGoiY(); veMau();
      vung.appendChild(the);
    });
  }

  /* ---------------------------------------------------------------- lab */
  function veLab(bai, id, vung) {
    if (bai.khongLab || !(bai.lab || []).length) {
      vung.appendChild(h("div", { class: "card" }, h("p", { class: "mut", style: "margin:0", text: bai.khongLab || "Bài này chưa có lab." })));
      return;
    }
    bai.lab.forEach(function (l) {
      var r = luu.doc("lab/" + id + "/" + l.id, null), toiDa = 1 + (l.muc || []).length, muc = r && r.muc ? r.muc : 0;
      var ngon = [h("span", { class: "chip" }, "JavaScript")];
      if (l.khoiDau && l.khoiDau.cpp) ngon.push(h("span", { class: "chip" }, "C++"));
      vung.appendChild(h("article", { class: "card the-lab" },
        h("div", { style: "min-width:0;flex:1 1 260px" },
          h("h3", { text: l.ten }),
          h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;align-items:center" }, ngon,
            l.doKho ? h("span", { class: "chip xam" }, "★".repeat(l.doKho)) : null,
            h("span", { class: "sao", title: "Mức đạt " + muc + "/" + toiDa }, TH.tienDo.sao(muc, toiDa)),
            r && r.muc ? h("span", { class: "mut", style: "font-size:.86rem", text: "Mức " + muc + "/" + toiDa }) : h("span", { class: "mut", style: "font-size:.86rem", text: "Chưa nộp" }))),
        h("a", { class: "btn btn-ac", href: "#/lab/" + id + "/" + l.id }, ic("code"), muc ? "Tiếp tục lab" : "Mở lab")));
    });
  }

  /* ---------------------------------------------------------------- ghi chú */
  function veGhiChu(bai, id, vung) {
    var v = luu.doc("ghichu/" + id, "");
    var ta = h("textarea", { class: "tx", "aria-label": "Ghi chú của bạn", placeholder: "Điều bạn hiểu, điều chưa rõ, việc cần làm… (tự lưu, hỗ trợ **đậm**, `mã`, danh sách)", value: v });
    var xemTruoc = h("div", { class: "md card", hidden: true, style: "margin-top:10px" });
    var tt = h("span", { class: "mut", style: "font-size:.86rem" });
    var hen = 0;
    function luuNote() { luu.ghi("ghichu/" + id, ta.value); tt.textContent = ta.value.trim() ? "Đã lưu · " + ta.value.length + " ký tự" : ""; }
    ta.addEventListener("input", function () { clearTimeout(hen); tt.textContent = "Đang lưu…"; hen = setTimeout(luuNote, 400); });
    var mau = bai.ghiChuGoiY || ["Điều tôi hiểu:", "Điều chưa rõ:", "Việc cần làm:"];
    var hang = h("div", { class: "hang-nut" });
    mau.forEach(function (m) {
      hang.appendChild(h("button", { class: "btn btn-sm", type: "button", onclick: function () {
        ta.value += (ta.value && !/\n$/.test(ta.value) ? "\n\n" : "") + "**" + m.replace(/:$/, "") + ":** ";
        ta.focus(); ta.dispatchEvent(new Event("input"));
      } }, ic("plus"), m.replace(/:$/, "")));
    });
    hang.appendChild(h("button", { class: "btn btn-sm", type: "button", onclick: function () {
      xemTruoc.hidden = !xemTruoc.hidden; if (!xemTruoc.hidden) xemTruoc.innerHTML = ta.value.trim() ? MK.html(ta.value) : '<p class="mut">Chưa có gì để xem.</p>';
    } }, ic("eye"), "Xem trước"));
    hang.appendChild(h("button", { class: "btn btn-sm", type: "button", onclick: function () { D.chep(ta.value).then(function (ok) { D.toast(ok ? "Đã chép ghi chú" : "Không chép được", ok ? "ok" : "bad"); }); } }, ic("copy"), "Chép"));
    hang.appendChild(tt);
    vung.appendChild(h("div", { class: "card ghi-chu" }, ta, hang, xemTruoc));
    if (v.trim()) tt.textContent = "Đã lưu · " + v.length + " ký tự";
  }

  /* ---------------------------------------------------------------- trang */
  ui.dangKyTrang("bai", function (el, args) {
    var id = args[0], m = ui.meta(id);
    if (!m) { el.appendChild(h("div", { class: "wrap" }, h("div", { class: "card" }, h("h2", { text: "Không có bài này" }), h("a", { class: "btn btn-ac", href: "#/" }, "Về trang chủ")))); return; }
    ui.tieuDe(ui.nhanBai(id)); ui.danhDauBai(id);
    ui.ghiCai({ gan: id });
    var huy = false, quan = null;
    el.appendChild(h("div", { class: "wrap" }, h("div", { class: "card" }, h("div", { class: "trang-thai" }, h("span", { class: "quay" }), h("span", { text: "Đang tải bài…" })))));
    function dung() {
      ui.napBai(id).then(function (bai) {
        if (huy) return;
        var w = h("div", { class: "wrap" });
        var part = ui.phanCua(id);
        w.appendChild(h("header", { class: "bai-dau" },
          h("div", { class: "part", text: part ? part.ten : "" }),
          h("h1", { text: ui.nhanBai(id) }),
          h("div", { style: "display:flex;gap:6px;flex-wrap:wrap" },
            m.tag ? h("span", { class: "chip warn" }, m.tag) : null,
            m.phut ? h("span", { class: "chip xam" }, "~" + m.phut + " phút đọc bài giảng") : null),
          h("div", { class: "lk-bar" },
            h("a", { class: "btn", href: ui.giangUrl(id) }, ic("book"), "Bài giảng"),
            (m.demo || []).map(function (d) { return h("a", { class: "btn", href: ui.visualUrl(d), title: "Mô phỏng tương tác" }, ic("flask"), "Mô phỏng: " + ui.demoTen(d)); }),
            h("a", { class: "btn", href: "#/ide" }, ic("code"), "IDE C/C++"))));
        var muc = [["tom-tat", "Tóm tắt", null], ["trac", "Trắc nghiệm", (bai.trac || []).length], ["luan", "Tự luận", (bai.luan || []).length],
                   ["lab", "Lab", bai.khongLab ? 0 : (bai.lab || []).length], ["ghi-chu", "Ghi chú", null]];
        var bar = h("nav", { class: "tab-bar", "aria-label": "Các phần của bài" });
        muc.forEach(function (x) {
          bar.appendChild(h("a", { href: "#/bai/" + id + "#" + x[0], "data-muc": x[0] }, x[1], x[2] ? h("span", { class: "chip xam", text: String(x[2]) }) : null));
        });
        bar.addEventListener("click", function (e) {
          var a = e.target.closest("a[data-muc]"); if (!a) return;
          e.preventDefault();
          var t = document.getElementById("muc-" + a.getAttribute("data-muc"));
          if (t) { t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); try { history.replaceState(null, "", "#/bai/" + id + "#" + a.getAttribute("data-muc")); } catch (er) { /* bỏ qua */ } }
        });
        w.appendChild(bar);

        function muc2(ma, tieuDe, noi) { var s = h("section", { class: "muc-bai", id: "muc-" + ma }, h("h2", {}, tieuDe)); noi(s); w.appendChild(s); return s; }
        muc2("tom-tat", "Nhớ trong một phút", function (s) {
          s.appendChild(h("div", { class: "card" }, h("ul", { class: "tom-tat md", style: "margin:0;padding-left:1.2em" }, (bai.tomTat || []).map(function (t) { return h("li", { html: MK.dong(t) }); }))));
        });
        muc2("trac", "Trắc nghiệm", function (s) { veTrac(bai, id, s); });
        muc2("luan", "Tự luận", function (s) { veLuan(bai, id, s); });
        muc2("lab", "Lab thực hành", function (s) { veLab(bai, id, s); });
        muc2("ghi-chu", "Ghi chú của bạn", function (s) { veGhiChu(bai, id, s); });

        var ds = ui.tatCaId, vt = ds.indexOf(id), truoc = ds[vt - 1], sau = ds[vt + 1];
        w.appendChild(h("div", { class: "dieu-huong" },
          truoc ? h("a", { class: "btn", href: "#/bai/" + truoc }, ic("left"), h("span", {}, h("small", { class: "mut", style: "display:block", text: "Bài trước" }), ui.nhanBai(truoc))) : h("span"),
          sau ? h("a", { class: "btn", href: "#/bai/" + sau }, h("span", {}, h("small", { class: "mut", style: "display:block", text: "Bài sau" }), ui.nhanBai(sau)), ic("right")) : null));

        el.replaceChildren(w);
        dongBoTienDo(id, bai);
        if (root.IntersectionObserver) {
          quan = new IntersectionObserver(function (es) {
            es.forEach(function (en) {
              if (!en.isIntersecting) return;
              var ma = en.target.id.replace(/^muc-/, "");
              D.$$("a[data-muc]", bar).forEach(function (a) { a.classList.toggle("act", a.getAttribute("data-muc") === ma); });
            });
          }, { rootMargin: "-" + 130 + "px 0px -60% 0px" });
          D.$$(".muc-bai", w).forEach(function (s) { quan.observe(s); });
        }
        if (ui.neo) { var t = document.getElementById("muc-" + ui.neo); if (t) setTimeout(function () { t.scrollIntoView({ block: "start" }); }, 30); }
      }, function (e) { if (!huy) loiTai(el, e, function () { el.replaceChildren(); dung(); }); });
    }
    dung();
    return function () { huy = true; if (quan) quan.disconnect(); };
  });
})(window);
