/* Trang một lab: đề bài + trình soạn mã (JavaScript hoặc C++) + chạy thử một test + nộp bài chấm nhiều test, kèm mức đạt. */
(function (root) {
  "use strict";
  var TH = root.TH, ui = TH.ui, D = TH.dom, h = D.h, ic = ui.ic, luu = ui.luu, MK = TH.markup, TI = TH.tienIch;

  var API_JS = "Có sẵn: readInput() · print(…) · log(…) (gỡ lỗi, không bị chấm) · rng(seed) · now()";

  function veCanvas(canvas, vd, inst, text) {
    if (!vd.ve) { canvas.hidden = true; return; }
    canvas.hidden = false;
    var dpr = root.devicePixelRatio || 1, w = canvas.clientWidth || 360;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, w);
    try { vd.ve(ctx, w, w, inst, text); } catch (e) { /* hình minh hoạ hỏng không được làm hỏng lab */ }
  }

  function dinhDangDiem(vd, x) { return TI.so(x, vd.tot === "thap" ? 1 : 0); }

  ui.dangKyTrang("lab", function (el, args) {
    var id = args[0], labId = args[1], m = ui.meta(id);
    if (!m) { el.appendChild(h("div", { class: "wrap" }, h("div", { class: "card" }, h("h2", { text: "Không có bài này" }), h("a", { class: "btn btn-ac", href: "#/" }, "Về trang chủ")))); return; }
    ui.danhDauBai(id);
    var huy = false, jsRun = null, dangChay = null, onResizeFn = null;
    el.appendChild(h("div", { class: "wrap" }, h("div", { class: "card" }, h("div", { class: "trang-thai" }, h("span", { class: "quay" }), h("span", { text: "Đang tải lab…" })))));

    ui.napBai(id).then(function (bai) {
      if (huy) return;
      var lab = (bai.lab || []).filter(function (l) { return l.id === labId; })[0];
      if (!lab) { el.replaceChildren(h("div", { class: "wrap" }, h("div", { class: "card" }, h("h2", { text: "Không có lab này" }), h("a", { class: "btn btn-ac", href: "#/bai/" + id }, "Về bài học")))); return; }
      var vd = TH.vande.lay(lab.vanDe);
      ui.tieuDe("Lab: " + lab.ten);
      dung(bai, lab, vd);
    }, function (e) { if (!huy) el.replaceChildren(ui.loiTrang(e)); });

    function dung(bai, lab, vd) {
      var khoaLuu = "lab/" + id + "/" + lab.id;
      var rec = luu.doc(khoaLuu, null) || { ma: {}, ngon: "js", bt: 0, muc: 0 };
      rec.ma = rec.ma || {};
      var coCpp = !!(lab.khoiDau && lab.khoiDau.cpp), ngon = rec.ngon === "cpp" && coCpp ? "cpp" : "js", bt = rec.bt || 0;
      if (lab.bienThe && bt >= lab.bienThe.length) bt = 0;
      var busy = false, gioiHan = lab.gioiHanMs || 1500, soGoiY = 0, ketQuaCuoi = null;
      var toiDa = 1 + (lab.muc || []).length;

      /* ----- khung trang ----- */
      var w = h("div", { class: "wrap rong" });
      w.appendChild(h("div", { class: "bai-dau" },
        h("a", { class: "part", href: "#/bai/" + id, style: "text-decoration:none" }, "← " + ui.nhanBai(id)),
        h("h1", { text: lab.ten }),
        h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center" },
          lab.doKho ? h("span", { class: "chip xam" }, "★".repeat(lab.doKho)) : null,
          lab.ref ? h("span", { class: "chip xam" }, "📖 " + lab.ref) : null,
          h("a", { class: "btn btn-sm", href: ui.giangUrl(id) }, ic("book"), "Bài giảng"),
          (m.demo || []).slice(0, 2).map(function (d) { return h("a", { class: "btn btn-sm", href: ui.visualUrl(d) }, ic("flask"), "Mô phỏng"); }))));
      var seg = h("div", { class: "seg", role: "tablist", "aria-label": "Phần của lab" });
      var cot = h("div", { class: "lab-cot sap" });
      function chonPane(ten) {
        D.$$("[data-pane]", cot).forEach(function (p) { p.classList.toggle("hien", p.getAttribute("data-pane") === ten); });
        D.$$("button", seg).forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-p") === ten ? "true" : "false"); });
      }
      [["de", "Đề bài"], ["ma", "Mã"], ["kq", "Kết quả"]].forEach(function (p) {
        seg.appendChild(h("button", { type: "button", role: "tab", "data-p": p[0], onclick: function () { chonPane(p[0]); }, text: p[1] }));
      });
      w.appendChild(seg); w.appendChild(cot);

      /* ----- pane đề bài ----- */
      var paneDe = h("section", { "data-pane": "de", class: "hien lab-de" });
      var cardDe = h("div", { class: "card" });
      cardDe.appendChild(h("div", { class: "md", html: MK.html(lab.de) }));
      if (vd.dinhDang) {
        cardDe.appendChild(h("details", { style: "margin-top:12px", open: true }, h("summary", { style: "cursor:pointer;font-weight:700;min-height:32px", text: "Định dạng vào / ra" }),
          h("div", { class: "md", style: "margin-top:8px" }, h("p", {}, h("b", { text: "Vào (stdin): " }), h("span", { html: MK.dong(vd.dinhDang.vao || "") })),
            h("p", {}, h("b", { text: "Ra (stdout): " }), h("span", { html: MK.dong(vd.dinhDang.ra || "") })))));
      }
      if (lab.bienThe) {                                        /* kiểu dữ liệu: nhóm "tab" — thấy hết các lựa chọn, đổi một chạm */
        var nhomBT = h("div", { class: "bt-tab", role: "tablist", "aria-label": "Kiểu dữ liệu" }, lab.bienThe.map(function (v, i) {
          return h("button", { type: "button", role: "tab", "aria-selected": i === bt ? "true" : "false", "data-i": String(i), text: v.ten });
        }));
        nhomBT.addEventListener("click", function (e) {
          var b = e.target.closest("button[data-i]"); if (!b) return;
          var i = +b.getAttribute("data-i"); if (i === bt) return;
          bt = i; rec.bt = bt; luu.ghi(khoaLuu, rec); ketQuaCuoi = null; kq.replaceChildren();
          D.$$("button", nhomBT).forEach(function (x) { x.setAttribute("aria-selected", +x.getAttribute("data-i") === bt ? "true" : "false"); });
          D.toast("Đã đổi kiểu dữ liệu — hãy chạy/nộp lại.");
        });
        cardDe.appendChild(h("div", { style: "margin-top:12px" }, h("div", { style: "font-weight:700;margin-bottom:6px", text: "Kiểu dữ liệu" }), nhomBT));
      }
      var thang = h("ol", { class: "bac-thang", style: "padding-left:0" });
      thang.appendChild(h("li", { class: "bac" }, h("span", { class: "ico", text: "1" }), h("div", {}, h("b", { text: "Hợp lệ" }), h("small", { text: "mọi test đều in đúng định dạng, trong giới hạn " + gioiHan + " ms" }))));
      (lab.muc || []).forEach(function (mc, i) {
        thang.appendChild(h("li", { class: "bac" }, h("span", { class: "ico", text: String(i + 2) }), h("div", {}, h("b", { text: mc.ten }),
          h("small", { text: "tổng điểm " + (vd.tot === "thap" ? "(càng thấp càng tốt) " : "") + "đạt ≥ " + TI.so(mc.heSo == null ? 1 : mc.heSo, 2) + " × lời giải tham chiếu" }))));
      });
      cardDe.appendChild(h("h3", { style: "font-size:1rem;margin-top:14px", text: "Các mức đạt" }));
      cardDe.appendChild(thang);
      var dsGoiY = h("ul", { class: "goi-y-ds" });
      var nutGoiY = h("button", { class: "btn btn-sm", type: "button" }, ic("bulb"), h("span", { text: "Gợi ý (0/" + lab.goiY.length + ")" }));
      nutGoiY.addEventListener("click", function () {
        soGoiY++; dsGoiY.appendChild(h("li", { class: "md", html: MK.dong(lab.goiY[soGoiY - 1]) }));
        nutGoiY.lastChild.textContent = "Gợi ý (" + soGoiY + "/" + lab.goiY.length + ")"; if (soGoiY >= lab.goiY.length) nutGoiY.hidden = true;
      });
      cardDe.appendChild(h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px" }, nutGoiY,
        h("button", { class: "btn btn-sm", type: "button", onclick: xemLoiGiai }, ic("eye"), "Lời giải tham chiếu")));
      cardDe.appendChild(dsGoiY);
      paneDe.appendChild(cardDe);

      /* ----- pane mã ----- */
      var paneMa = h("section", { "data-pane": "ma" });
      var tab = h("div", { class: "ngon-tab", role: "group", "aria-label": "Ngôn ngữ" },
        h("button", { type: "button", "aria-pressed": ngon === "js" ? "true" : "false", "data-n": "js", text: "JavaScript" }),
        coCpp ? h("button", { type: "button", "aria-pressed": ngon === "cpp" ? "true" : "false", "data-n": "cpp", text: "C++" }) : null);
      var nutThu = h("button", { class: "btn", type: "button" }, ic("play"), "Chạy thử");
      var nutNop = h("button", { class: "btn btn-ac", type: "button" }, ic("check"), "Nộp bài");
      var nutDung = h("button", { class: "btn btn-bad", type: "button", hidden: true }, ic("stop"), "Dừng");
      var tool = h("div", { class: "tool-lab" }, tab, h("span", { class: "gian" }), nutThu, nutNop, nutDung);
      paneMa.appendChild(tool);
      var edHost = h("div", {});
      paneMa.appendChild(edHost);
      var ghiChuNgon = h("p", { class: "mut", style: "font-size:.86rem;margin:6px 2px 0" });
      paneMa.appendChild(ghiChuNgon);
      paneMa.appendChild(h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px" },
        h("button", { class: "btn btn-sm", type: "button", onclick: datLai }, ic("reset"), "Khung ban đầu"),
        h("button", { class: "btn btn-sm", type: "button", onclick: moIde }, ic("code"), "Mở trong IDE"),
        h("button", { class: "btn btn-sm", type: "button", onclick: function () { D.chep(ed.lay()).then(function (ok) { D.toast(ok ? "Đã chép mã" : "Không chép được", ok ? "ok" : "bad"); }); } }, ic("copy"), "Chép mã")));

      /* ----- pane kết quả ----- */
      var paneKq = h("section", { "data-pane": "kq" });
      var tt = h("div", { class: "trang-thai", hidden: true }, h("span", { class: "quay" }), h("span", { class: "nd" }), h("div", { class: "thanh", hidden: true }, h("i", { style: "width:0" })));
      var kq = h("div", { class: "kq-lab", "aria-live": "polite" });
      paneKq.appendChild(tt); paneKq.appendChild(kq);

      cot.appendChild(paneDe); cot.appendChild(paneMa); cot.appendChild(paneKq);
      el.replaceChildren(w);
      chonPane("de");
      if (root.matchMedia && root.matchMedia("(min-width: 900px)").matches) cot.classList.remove("sap");
      onResizeFn = function () { cot.classList.toggle("sap", !(root.matchMedia && root.matchMedia("(min-width: 900px)").matches)); };
      root.addEventListener("resize", onResizeFn);

      /* ----- trình soạn ----- */
      var hen = 0;
      var ed = TH.editor.tao(edHost, {
        ngon: ngon === "cpp" ? "cpp" : "js", nhan: "Mã nguồn lời giải",
        giaTri: rec.ma[ngon] != null ? rec.ma[ngon] : lab.khoiDau[ngon],
        khiDoi: function (v) { clearTimeout(hen); hen = setTimeout(function () { rec.ma[ngon] = v; rec.ngon = ngon; rec.ts = Date.now(); luu.ghi(khoaLuu, rec); }, 500); },
        khiChay: function () { chayThu(); }
      });
      function capNhatGhiChuNgon() {
        ghiChuNgon.textContent = ngon === "js" ? API_JS : "C++17 biên dịch trong trình duyệt (Clang → WebAssembly): không ngoại lệ, không luồng. Ctrl+Enter chạy thử.";
      }
      capNhatGhiChuNgon();
      D.$$("button", tab).forEach(function (b) {
        b.addEventListener("click", function () {
          var n = b.getAttribute("data-n"); if (n === ngon) return;
          rec.ma[ngon] = ed.lay(); ngon = n; rec.ngon = n; luu.ghi(khoaLuu, rec);
          D.$$("button", tab).forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-n") === n ? "true" : "false"); });
          ed.doiNgon(n === "cpp" ? "cpp" : "js"); ed.dat(rec.ma[n] != null ? rec.ma[n] : lab.khoiDau[n]); capNhatGhiChuNgon();
        });
      });
      function datLai() {
        D.hoi({ tieuDe: "Về khung ban đầu?", noiDung: "Mã " + (ngon === "cpp" ? "C++" : "JavaScript") + " hiện tại của bạn sẽ bị thay bằng khung ban đầu.", nutChinh: "Đặt lại", nguyHiem: true }).then(function (ok) {
          if (!ok) return; ed.dat(lab.khoiDau[ngon]); rec.ma[ngon] = lab.khoiDau[ngon]; luu.ghi(khoaLuu, rec);
        });
      }
      function moIde() {
        try {
          root.sessionStorage.setItem("th2:ide-handoff", JSON.stringify({ ma: ed.lay(), ngon: ngon === "cpp" ? "cpp" : "js", stdin: TH.cham.danhSachTest(lab, vd, bt)[0].input, ten: "Lab: " + lab.ten }));
        } catch (e) { /* sessionStorage bị chặn: IDE mở trống */ }
        location.hash = "#/ide";
      }
      function xemLoiGiai() {
        var n = ngon === "cpp" && lab.loiGiai.cpp ? "cpp" : "js";
        D.hoi({ tieuDe: "Xem lời giải tham chiếu?", noiDung: "Bạn đã thử đủ lâu chưa? Tự cài trước rồi mới so sánh sẽ nhớ lâu hơn nhiều. Lời giải này đạt mức cao nhất của lab.", nutChinh: "Cho tôi xem", nutPhu: "Để tôi thử thêm" }).then(function (ok) {
          if (!ok) return;
          var host = h("div", {}), edLG = null;
          var dlg = h("dialog", { class: "hop", style: "width:min(96vw,760px)", "aria-label": "Lời giải tham chiếu" },
            h("h3", { text: "Lời giải tham chiếu (" + (n === "cpp" ? "C++" : "JavaScript") + ")" }), host,
            h("div", { class: "hop-nut", style: "margin-top:12px" },
              h("button", { class: "btn", type: "button", onclick: function () { D.chep(edLG.lay()).then(function (c) { D.toast(c ? "Đã chép" : "Không chép được"); }); } }, ic("copy"), "Chép"),
              h("button", { class: "btn btn-ac", type: "button", onclick: function () { dlg.close(); dlg.remove(); } }, "Đóng")));
          dlg.addEventListener("close", function () { dlg.remove(); });
          document.body.appendChild(dlg); dlg.showModal();
          edLG = TH.editor.tao(host, { ngon: n === "cpp" ? "cpp" : "js", chiDoc: true, giaTri: lab.loiGiai[n], nhan: "Lời giải tham chiếu" });
        });
      }

      /* ----- chạy ----- */
      function datBan(b) {
        busy = b; nutThu.disabled = b; nutNop.disabled = b; nutDung.hidden = !b;
        if (!b) tt.hidden = true;
      }
      function noiTT(msg, pct) {
        tt.hidden = false; D.$(".nd", tt).textContent = msg;
        var th = D.$(".thanh", tt); th.hidden = pct == null; if (pct != null) th.firstChild.style.width = Math.round(pct) + "%";
      }
      function trinhChay() {
        if (ngon === "js") {
          if (!jsRun) jsRun = TH.chayJs.taoTrinhChay();
          var src = ed.lay();
          return function (input, c) { return jsRun.chay(src, input, c.gioiHan); };
        }
        return TH.cpp.trinhChayLab(ed.lay(), {
          hanNhan: 2,
          tienDo: function (p) {
            if (p.loai === "tai") noiTT("Đang tải trình biên dịch… " + p.pct + "% (" + Math.round(p.da / 1048576) + "/" + Math.round(p.tong / 1048576) + " MB)", p.pct);
            else if (p.loai === "cache") noiTT("Nạp trình biên dịch từ bộ nhớ máy…");
            else if (p.loai === "bat-dau") noiTT("Đang biên dịch…");
            else if (p.loai === "giay") noiTT("Đang biên dịch… " + p.giay + " giây (lần đầu lâu hơn vì nạp bộ biên dịch)");
          }
        });
      }
      function truocKhiChay() {
        if (busy) return Promise.resolve(false);
        return ngon === "cpp" ? ui.canDongYCpp() : Promise.resolve(true);
      }
      function dungMay() {
        if (jsRun) { jsRun.dung(); jsRun = null; }
        if (TH.cpp) TH.cpp.huy();
        dangChay = null;
      }
      nutDung.addEventListener("click", function () { if (dangChay) dangChay.huy = true; dungMay(); datBan(false); kq.replaceChildren(h("div", { class: "card" }, "Đã dừng.")); });

      function hienLoiBienDich(bd) {
        ed.danhDauLoi(bd.chuanDoan.filter(function (d) { return d.dong > 0 && d.loai === "error"; }));
        return h("div", { class: "card" }, h("h3", { style: "font-size:1rem", text: "Lỗi biên dịch" }),
          bd.loi && !bd.chuanDoan.length ? h("p", { class: "mut", text: bd.loi }) : h("ul", { class: "chuan-doan" }, bd.chuanDoan.filter(function (d) { return d.loai !== "note"; }).map(function (d) {
            return h("li", { class: d.loai, onclick: function () { chonPane("ma"); if (d.dong) ed.nhayToi(d.dong, d.cot); } },
              h("span", { class: "loai", text: d.loai === "error" ? "lỗi" : "cảnh báo" }), h("span", { class: "vt", text: d.dong ? d.dong + ":" + d.cot : "" }), h("span", { text: d.msg }));
          })));
      }

      function chayThu() {
        truocKhiChay().then(function (ok) {
          if (!ok) return;
          ed.danhDauLoi([]); datBan(true); chonPane("kq"); kq.replaceChildren();
          var t = TH.cham.danhSachTest(lab, vd, bt)[0], moc = { huy: false }; dangChay = moc;
          noiTT(ngon === "cpp" ? "Đang chuẩn bị…" : "Đang chạy thử trên test #1…");
          Promise.resolve(trinhChay()(t.input, { i: 0, gioiHan: gioiHan })).then(function (r) {
            if (moc.huy) return;
            datBan(false);
            if (r.bienDichLoi) { kq.replaceChildren(hienLoiBienDich(r.bienDichLoi)); return; }
            kq.replaceChildren(hienMotTest(t, r));
          }).catch(function (e) { if (!moc.huy) { datBan(false); kq.replaceChildren(h("div", { class: "card" }, "Lỗi: " + String(e && e.message || e))); } });
        });
      }
      function cat(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "\n… (cắt bớt, còn " + (s.length - n) + " ký tự)" : s; }
      function hienMotTest(t, r) {
        var c = (!r.loi && !r.hetGio) ? vd.cham(t.inst, r.text) : { ok: false, loi: r.loi };
        var card = h("div", { class: "card" });
        card.appendChild(h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px" },
          h("b", { text: "Chạy thử — test #1" }), lab.bienThe ? h("span", { class: "chip xam" }, lab.bienThe[bt].ten) : null,
          h("span", { class: "chip " + (c.ok ? "ok" : "bad") }, c.ok ? "✔ hợp lệ" : "✘ không hợp lệ"),
          r.ms ? h("span", { class: "chip xam" }, Math.round(r.ms) + " ms") : null,
          c.ok ? h("span", { class: "chip" }, "điểm " + dinhDangDiem(vd, c.diem)) : null));
        if (!c.ok) card.appendChild(h("div", { class: "phan-hoi bad" }, c.loi || "Không hợp lệ", r.dong ? " (dòng " + r.dong + ")" : ""));
        if (c.ok && (lab.muc || []).length) {
          var ls = h("ul", { style: "margin:8px 0 0;padding-left:1.2em" });
          lab.muc.forEach(function (mc) {
            var rf = TH.cham.diemThamChieu(vd, t.inst, t.khoa, mc.so);
            if (rf != null) ls.appendChild(h("li", { html: MK.dong("**" + mc.ten + "**: tham chiếu " + dinhDangDiem(vd, rf) + " · bạn " + dinhDangDiem(vd, c.diem)) }));
          });
          card.appendChild(ls);
        }
        if (r.text) card.appendChild(h("details", { open: !c.ok }, h("summary", { style: "cursor:pointer;min-height:32px", text: "Kết quả chương trình in ra (stdout)" }), h("pre", { class: "o-ra", text: cat(r.text, 3000) })));
        if (r.err) card.appendChild(h("details", { open: true }, h("summary", { style: "cursor:pointer;min-height:32px", text: "Nhật ký gỡ lỗi (stderr / log)" }), h("pre", { class: "o-ra err", text: cat(r.err, 3000) })));
        card.appendChild(h("details", {}, h("summary", { style: "cursor:pointer;min-height:32px", text: "Dữ liệu vào của test #1 (để tự thử ở IDE)" }),
          h("pre", { class: "o-ra", text: cat(t.input, 2500) }),
          h("button", { class: "btn btn-sm", type: "button", onclick: function () { D.chep(t.input).then(function (o) { D.toast(o ? "Đã chép dữ liệu vào" : "Không chép được"); }); } }, ic("copy"), "Chép dữ liệu")));
        var cv = h("canvas", { class: "ve", "aria-label": "Minh hoạ lời giải" });
        card.appendChild(cv);
        setTimeout(function () { veCanvas(cv, vd, t.inst, r.text || ""); }, 0);
        return card;
      }

      function nopBai() {
        truocKhiChay().then(function (ok) {
          if (!ok) return;
          ed.danhDauLoi([]); datBan(true); chonPane("kq"); kq.replaceChildren();
          var moc = { huy: false }, soTest = lab.soTest || 10; dangChay = moc;
          var chay = trinhChay(), bdLoi = null;
          noiTT("Đang chấm " + soTest + " test…", 0);
          TH.cham.chayLab(lab, vd, function (input, c) {
            return Promise.resolve(chay(input, c)).then(function (r) { if (r.bienDichLoi) bdLoi = r.bienDichLoi; return r; });
          }, {
            bienThe: bt, huy: function () { return moc.huy; },
            tienDo: function (i, n) { noiTT("Đang chấm… test " + i + "/" + n, i / n * 100); }
          }).then(function (res) {
            if (moc.huy) return;
            datBan(false);
            if (bdLoi) { kq.replaceChildren(hienLoiBienDich(bdLoi)); return; }
            ketQuaCuoi = res;
            kq.replaceChildren(hienTongHop(res));
            var cu = rec.muc || 0;
            if (res.muc > cu) { rec.muc = res.muc; rec.mucTD = toiDa; luu.ghi(khoaLuu, rec); ui.dongBoTienDo(id, bai); D.toast(res.muc >= toiDa ? "Tuyệt vời! Đạt mức cao nhất " + res.muc + "/" + toiDa + " 🎉" : "Đạt mức " + res.muc + "/" + toiDa, "ok"); }
            else { rec.mucTD = toiDa; luu.ghi(khoaLuu, rec); }
          }).catch(function (e) { if (!moc.huy) { datBan(false); kq.replaceChildren(h("div", { class: "card" }, "Lỗi: " + String(e && e.message || e))); } });
        });
      }

      function hienTongHop(res) {
        var card = h("div", { class: "card" });
        var tenMuc = res.muc === 0 ? "Chưa đạt" : res.muc === 1 ? "Hợp lệ" : (lab.muc[res.muc - 2] || {}).ten;
        if (lab.bienThe) card.appendChild(h("div", { class: "mut", style: "font-size:.86rem;margin-bottom:6px", text: "Kiểu dữ liệu: " + lab.bienThe[bt].ten }));
        card.appendChild(h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center" },
          h("span", { class: "sao", style: "font-size:1.5rem" }, TH.tienDo.sao(res.muc, res.mucToiDa)),
          h("div", {}, h("b", { style: "font-size:1.1rem", text: "Mức " + res.muc + "/" + res.mucToiDa + " — " + tenMuc }),
            h("div", { class: "mut", style: "font-size:.9rem", text: res.soHopLe + "/" + res.soTest + " test hợp lệ" + (res.daChay < res.soTest ? " (dừng sớm sau " + res.daChay + ")" : "") +
              (res.hopLe ? " · tổng điểm " + dinhDangDiem(vd, res.tongDiem) : "") + " · " + Math.round(res.msTrungBinh) + " ms/test (lớn nhất " + Math.round(res.msLonNhat) + ")" }))));
        var thang2 = h("ol", { class: "bac-thang" });
        thang2.appendChild(h("li", { class: "bac " + (res.hopLe ? "dat" : "chua") }, h("span", { class: "ico", text: res.hopLe ? "✓" : "✕" }), h("div", {}, h("b", { text: "Hợp lệ trên mọi test" }), h("small", { text: res.soHopLe + "/" + res.soTest }))));
        res.dsMuc.forEach(function (mc) {
          thang2.appendChild(h("li", { class: "bac " + (mc.dat ? "dat" : "chua") }, h("span", { class: "ico", text: mc.dat ? "✓" : "✕" }),
            h("div", {}, h("b", { text: mc.ten }), h("small", { text: mc.tile == null ? "không so được" : "tỉ lệ so với tham chiếu = " + TI.so(mc.tile, 3) + " (cần ≥ " + TI.so(mc.heSo, 3) + ") · tham chiếu " + dinhDangDiem(vd, mc.tongRef) + ", bạn " + dinhDangDiem(vd, res.tongDiem) }))));
        });
        card.appendChild(thang2);
        if (res.chenhLech) {
          var cl = res.chenhLech;
          card.appendChild(h("div", { class: "phan-hoi " + (cl.coYNghia ? (cl.tb > 0 ? "ok" : "bad") : ""), style: cl.coYNghia ? "" : "background:var(--code-bg);border-left:4px solid var(--bd2)", html: MK.dong(
            "**Kiểm định (Bài 4):** so với «" + cl.so + "», chênh lệch trung bình theo từng test là **" + (cl.tb >= 0 ? "+" : "−") + TI.so(Math.abs(cl.tb) * 100, 2) + " %** ± " + TI.so(cl.se * 100, 2) + " % (SE). " +
            (cl.coYNghia ? (cl.tb > 0 ? "Vượt ngưỡng 2·SE — khác biệt này **có ý nghĩa**, không phải nhiễu." : "Thấp hơn mốc và vượt ngưỡng 2·SE — **kém thật**, không phải nhiễu.") : "Nhỏ hơn 2·SE — chưa đủ bằng chứng là khác biệt; có thể chỉ là nhiễu của bộ test.")) }));
        }
        var hang = h("tbody", {});
        res.tests.forEach(function (t, i) {
          hang.appendChild(h("tr", { class: t.ok ? "" : "sai" }, h("td", { text: "#" + (i + 1) }), h("td", { text: t.ok ? "✔" : "✘" }), h("td", { class: "r", text: t.ok ? dinhDangDiem(vd, t.diem) : "—" }),
            h("td", { class: "r", text: Math.round(t.ms || 0) + " ms" }), h("td", { text: t.ok ? "" : (t.loi || "").slice(0, 160) + (t.dong ? " (dòng " + t.dong + ")" : "") })));
        });
        card.appendChild(h("details", { open: !res.hopLe, style: "margin-top:10px" }, h("summary", { style: "cursor:pointer;min-height:32px;font-weight:700", text: "Chi tiết từng test" }),
          h("div", { class: "bang-cuon" }, h("table", { class: "bang-test" }, h("thead", {}, h("tr", {}, h("th", { text: "Test" }), h("th", { text: "" }), h("th", { class: "r", text: "Điểm" }), h("th", { class: "r", text: "Thời gian" }), h("th", { text: "Ghi chú" }))), hang))));
        var loiDau = res.tests.filter(function (t) { return t.err; })[0];
        if (loiDau) card.appendChild(h("details", {}, h("summary", { style: "cursor:pointer;min-height:32px", text: "Nhật ký gỡ lỗi (stderr/log) của test #" + (loiDau.i + 1) }), h("pre", { class: "o-ra err", text: cat(loiDau.err, 2000) })));
        if (vd.ve) {
          var tests = TH.cham.danhSachTest(lab, vd, bt);
          var sel = h("select", { "aria-label": "Chọn test để xem hình" }, res.tests.map(function (t, i) { return h("option", { value: String(i), text: "Xem test #" + (i + 1) }); }));
          var cv = h("canvas", { class: "ve", "aria-label": "Minh hoạ lời giải" });
          var ve = function () { var i = +sel.value; veCanvas(cv, vd, tests[i].inst, res.tests[i].text || ""); };
          sel.addEventListener("change", ve);
          card.appendChild(h("div", { style: "margin-top:12px" }, sel, cv));
          setTimeout(ve, 0);
        }
        if (res.muc >= res.mucToiDa) {
          var tiep = ui.tatCaId[ui.tatCaId.indexOf(id) + 1];
          card.appendChild(h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px" }, h("a", { class: "btn", href: "#/bai/" + id }, "Về bài học"), tiep ? h("a", { class: "btn btn-ac", href: "#/bai/" + tiep }, "Bài tiếp theo", ic("right")) : null));
        }
        return card;
      }

      nutThu.addEventListener("click", chayThu);
      nutNop.addEventListener("click", nopBai);
      ui.dongBoTienDo(id, bai);
    }

    return function () {
      huy = true;
      if (onResizeFn) root.removeEventListener("resize", onResizeFn);
      if (jsRun) { jsRun.dung(); jsRun = null; }
      if (TH.cpp && dangChay) TH.cpp.huy();
    };
  });
})(window);
