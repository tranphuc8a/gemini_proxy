/* IDE C/C++ (và JavaScript) online: soạn, biên dịch, chạy ngay trong trình duyệt. Nhập dữ liệu vào (stdin), xem kết quả (stdout/stderr),
   lỗi biên dịch bấm là nhảy tới dòng, nhiều đoạn mã lưu trên máy, tải về .cpp/.c/.js. Chạy bằng TH.cpp (Clang → WebAssembly) / TH.chayJs. */
(function (root) {
  "use strict";
  var TH = root.TH, ui = TH.ui, D = TH.dom, h = D.h, ic = ui.ic, luu = ui.luu, TI = TH.tienIch;

  var CHUAN = { cpp: [["c++17", "C++17"], ["c++20", "C++20"], ["c++14", "C++14"], ["c++11", "C++11"]], c: [["c17", "C17"], ["c11", "C11"]] };
  var HAN = [[2000, "2 giây"], [5000, "5 giây"], [10000, "10 giây"], [30000, "30 giây"]];
  var DUOI = { cpp: ".cpp", c: ".c", js: ".js" };
  var TEN_NGON = { cpp: "C++", c: "C", js: "JavaScript" };

  var MAU = {
    cpp: [
      ["Xin chào", String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    cout << "Xin chào, Heuristic!" << endl;
    return 0;
}
`, ""],
      ["Đọc n số: tổng và lớn nhất", String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    scanf("%d", &n);
    long long tong = 0;
    int lon = INT_MIN;
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        tong += x;                  // long long: tránh tràn int (Bài 5, cạm bẫy 4)
        lon = max(lon, x);
    }
    printf("tong = %lld, lon nhat = %d\n", tong, lon);
    return 0;
}
`, "5\n3 -1 4 1 5\n"],
      ["Bộ sinh xorshift + đo thời gian", String.raw`#include <bits/stdc++.h>
using namespace std;

// Bộ sinh số giả ngẫu nhiên tự viết: cùng seed ⇒ cùng dãy ở mọi trình biên dịch (Bài 4, Bài 19).
struct Rng {
    unsigned long long s;
    explicit Rng(unsigned long long seed) : s(seed ? seed : 88172645463325252ULL) {}
    unsigned long long next() { s ^= s << 13; s ^= s >> 7; s ^= s << 17; return s; }
    int below(int n) { return (int)(next() % (unsigned long long)n); }   // [0, n)
};

int main() {
    auto t0 = chrono::steady_clock::now();
    Rng rng(12345);
    long long tong = 0;
    for (int i = 0; i < 5000000; i++) tong += rng.below(100);
    double ms = chrono::duration<double, milli>(chrono::steady_clock::now() - t0).count();
    printf("tong = %lld\n", tong);
    fprintf(stderr, "mat %.1f ms\n", ms);        // stderr: nhật ký, không lẫn vào kết quả
    return 0;
}
`, ""],
      ["Khung heuristic: leo đồi 2-opt có ngân sách", String.raw`#include <bits/stdc++.h>
using namespace std;

// Đọc n điểm, tìm chu trình ngắn bằng 2-opt trong ngân sách thời gian (Bài 9, 11, 19).
int n;
vector<double> X, Y;
double d(int a, int b) { return hypot(X[a] - X[b], Y[a] - Y[b]); }

int main() {
    scanf("%d", &n);
    X.resize(n); Y.resize(n);
    for (int i = 0; i < n; i++) scanf("%lf %lf", &X[i], &Y[i]);
    vector<int> t(n);
    iota(t.begin(), t.end(), 0);

    auto bat = chrono::steady_clock::now();
    auto het = [&] { return chrono::duration<double, milli>(chrono::steady_clock::now() - bat).count() > 200; };
    bool cai = true;
    while (cai && !het()) {
        cai = false;
        for (int i = 0; i + 2 < n; i++)
            for (int j = i + 2; j < n; j++) {
                if (i == 0 && j == n - 1) continue;
                int a = t[i], b = t[i + 1], c = t[j], e = t[(j + 1) % n];
                double delta = d(a, c) + d(b, e) - d(a, b) - d(c, e);   // delta evaluation O(1) (Bài 10)
                if (delta < -1e-9) { reverse(t.begin() + i + 1, t.begin() + j + 1); cai = true; }
            }
    }
    double dai = 0;
    for (int i = 0; i < n; i++) dai += d(t[i], t[(i + 1) % n]);
    for (int i = 0; i < n; i++) printf("%d%c", t[i] + 1, i + 1 < n ? ' ' : '\n');
    fprintf(stderr, "do dai = %.2f\n", dai);
    return 0;
}
`, "8\n0 0\n10 0\n10 10\n0 10\n5 1\n9 5\n5 9\n1 5\n"]
    ],
    c: [
      ["Xin chào", String.raw`#include <stdio.h>

int main(void) {
    printf("Xin chào từ C!\n");
    return 0;
}
`, ""],
      ["Đọc n số: tổng", String.raw`#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    long long tong = 0;
    for (int i = 0; i < n; i++) { int x; scanf("%d", &x); tong += x; }
    printf("tong = %lld\n", tong);
    return 0;
}
`, "4\n10 20 30 40\n"]
    ],
    js: [
      ["Xin chào", String.raw`// JavaScript chạy trong Web Worker. Có sẵn: readInput() print() log() rng(seed) now()
print("Xin chào, Heuristic!");
`, ""],
      ["Đọc n số: tổng và lớn nhất", String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], a = t.slice(1, 1 + n);
print("tong = " + a.reduce((x, y) => x + y, 0) + ", lon nhat = " + Math.max(...a));
log("đã đọc " + n + " số");   // log → stderr, không lẫn vào kết quả
`, "5\n3 -1 4 1 5\n"]
    ]
  };

  function tenMoi(ds, goc) {
    var dem = 1, ten = goc;
    while (ds.some(function (x) { return x.ten === ten; })) ten = goc + " (" + (++dem) + ")";
    return ten;
  }
  function moi(ngon, mau) {
    var m = (mau || MAU[ngon][0]);
    return { id: "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), ten: m[0], ngon: ngon, chuan: ngon === "c" ? "c17" : "c++17", toiUu: "O2", ma: m[1], stdin: m[2], ts: Date.now() };
  }
  function kb(n) { return n >= 1048576 ? TI.so(n / 1048576, 1) + " MB" : TI.so(n / 1024, 0) + " KB"; }

  ui.dangKyTrang("ide", function (el) {
    ui.tieuDe("IDE C/C++ online"); ui.danhDauBai(null);
    var ds = luu.doc("ide/ds", null) || [], hienId = luu.doc("ide/hien", null), cai = luu.doc("ide/cai", {}) || {};
    var han = cai.han || 5000, busy = false, jsRun = null, huyHien = null, huy = false, cpphuy = false;

    var handoff = null;
    try { var raw = root.sessionStorage.getItem("th2:ide-handoff"); if (raw) { handoff = JSON.parse(raw); root.sessionStorage.removeItem("th2:ide-handoff"); } } catch (e) { handoff = null; }
    if (handoff && typeof handoff.ma === "string") {
      var s0 = moi(handoff.ngon === "cpp" ? "cpp" : "js", [tenMoi(ds, String(handoff.ten || "Từ lab").slice(0, 60)), handoff.ma, String(handoff.stdin || "")]);
      ds.unshift(s0); hienId = s0.id;
    }
    if (!ds.length) { ds.push(moi("cpp")); hienId = ds[0].id; }
    var cur = ds.filter(function (x) { return x.id === hienId; })[0] || ds[0];
    function ghiDs() { luu.ghi("ide/ds", ds); luu.ghi("ide/hien", cur.id); }
    ghiDs();

    /* ----- khung ----- */
    var w = h("div", { class: "wrap rong" });
    w.appendChild(h("h1", { style: "font-size:1.5rem;margin-bottom:10px", text: "IDE C/C++ online" }));
    var selNgon = h("select", { "aria-label": "Ngôn ngữ" }, ["cpp", "c", "js"].map(function (n) { return h("option", { value: n, text: TEN_NGON[n] }); }));
    var selChuan = h("select", { "aria-label": "Chuẩn ngôn ngữ" });
    var selO = h("select", { "aria-label": "Mức tối ưu hoá" }, ["O0", "O1", "O2", "O3"].map(function (o) { return h("option", { value: o, text: "-" + o }); }));
    var selHan = h("select", { "aria-label": "Giới hạn thời gian chạy" }, HAN.map(function (x) { return h("option", { value: String(x[0]), text: x[1], selected: x[0] === han }); }));
    var inTen = h("input", { type: "text", class: "ide-ten", "aria-label": "Tên đoạn mã", maxlength: "60" });
    var nutChay = h("button", { class: "btn btn-ac", type: "button", title: "Ctrl+Enter" }, ic("play"), "Chạy");
    var nutDung = h("button", { class: "btn btn-bad", type: "button", hidden: true }, ic("stop"), "Dừng");
    var nutTep = h("button", { class: "btn btn-sm", type: "button", "aria-expanded": "false" }, ic("file"), "Đoạn mã");
    var nutMau = h("button", { class: "btn btn-sm", type: "button", "aria-expanded": "false" }, ic("book"), "Mẫu");
    var nutTai = h("button", { class: "btn btn-sm", type: "button" }, ic("dl"), "Tải về");
    var nutChep = h("button", { class: "btn btn-sm", type: "button" }, ic("copy"), "Chép");
    w.appendChild(h("div", { class: "ide-bar" }, inTen, nutTep, nutMau, nutTai, nutChep));
    var nganTep = h("div", { class: "ngan-keo", hidden: true }), nganMau = h("div", { class: "ngan-keo", hidden: true });
    w.appendChild(nganTep); w.appendChild(nganMau);
    w.appendChild(h("div", { class: "ide-bar", style: "margin-top:8px" },
      h("label", {}, "Ngôn ngữ", selNgon), h("label", { class: "ide-opt" }, "Chuẩn", selChuan), h("label", { class: "ide-opt" }, "Tối ưu", selO), h("label", {}, "Giới hạn", selHan),
      h("span", { style: "flex:1" }), nutChay, nutDung));
    var cot = h("div", { class: "ide-cot" });
    var edHost = h("div", {});
    var cotPhai = h("div", {});
    cot.appendChild(h("div", {}, edHost, h("p", { class: "mut", style: "font-size:.86rem;margin:6px 2px 0", text: "Ctrl+Enter để chạy · Tab thụt dòng · Ctrl+/ chú thích dòng. Mã tự lưu trên máy này." }))); cot.appendChild(cotPhai);
    w.appendChild(cot);

    var stdinTa = h("textarea", { class: "tx", style: "font-family:var(--mono);font-size:14px;min-height:110px", spellcheck: "false", "aria-label": "Dữ liệu vào (stdin)", placeholder: "Dữ liệu vào cho chương trình (stdin)…" });
    cotPhai.appendChild(h("div", { class: "card" }, h("label", { style: "font-weight:700;display:block;margin-bottom:6px", text: "Dữ liệu vào (stdin)" }), stdinTa));
    var tt = h("div", { class: "trang-thai", hidden: true, style: "margin-top:12px" }, h("span", { class: "quay" }), h("span", { class: "nd" }), h("div", { class: "thanh", hidden: true }, h("i", { style: "width:0" })));
    cotPhai.appendChild(tt);
    var tabs = h("div", { class: "tab-nho", role: "tablist" }), vung = h("div", { class: "card", style: "margin-top:10px;min-height:180px" });
    var tabBt = {};
    [["ra", "Kết quả"], ["bd", "Biên dịch"], ["tin", "Thông tin"]].forEach(function (t) {
      var b = h("button", { type: "button", role: "tab", "aria-selected": "false", onclick: function () { chonTab(t[0]); } }, t[1]);
      tabBt[t[0]] = b; tabs.appendChild(b);
    });
    cotPhai.appendChild(tabs); cotPhai.appendChild(vung);
    var outEl = h("pre", { class: "o-ra", style: "max-height:360px", text: "Bấm Chạy để thấy kết quả ở đây." });
    var errEl = h("pre", { class: "o-ra err", hidden: true });
    var tin = { bienDich: null, wasm: null, chay: null, code: null, outBytes: 0 }, chuanDoan = [], tabHien = "ra";
    el.appendChild(w);

    function chonTab(t) {
      tabHien = t;
      Object.keys(tabBt).forEach(function (k) { tabBt[k].setAttribute("aria-selected", k === t ? "true" : "false"); });
      vung.replaceChildren();
      if (t === "ra") { vung.appendChild(outEl); vung.appendChild(errEl); }
      else if (t === "bd") {
        if (!chuanDoan.length) vung.appendChild(h("p", { class: "mut", style: "margin:0", text: cur.ngon === "js" ? "JavaScript không cần biên dịch." : "Chưa có thông báo biên dịch (hoặc biên dịch sạch)." }));
        else vung.appendChild(h("ul", { class: "chuan-doan" }, chuanDoan.map(function (d) {
          return h("li", { class: d.loai, onclick: function () { if (d.dong) ed.nhayToi(d.dong, d.cot); } },
            h("span", { class: "loai", text: d.loai === "error" ? "lỗi" : d.loai === "warning" ? "cảnh báo" : "ghi chú" }), h("span", { class: "vt", text: d.dong ? d.dong + ":" + d.cot : "" }), h("span", { text: d.msg }));
        })));
      } else {
        var dl = h("dl", {});
        function dong(k, v) { if (v != null) { dl.appendChild(h("dt", { text: k })); dl.appendChild(h("dd", { text: v })); } }
        dong("Ngôn ngữ", TEN_NGON[cur.ngon] + (cur.ngon === "js" ? "" : " · " + (cur.chuan || "").toUpperCase() + " · -" + (cur.toiUu || "O2")));
        dong("Biên dịch", tin.bienDich != null ? TI.so(tin.bienDich / 1000, 1) + " giây" + (tin.wasm ? " · " + kb(tin.wasm) : "") : null);
        dong("Chạy", tin.chay != null ? Math.round(tin.chay) + " ms" : null);
        dong("Mã thoát", tin.code != null ? String(tin.code) : null);
        dong("Đầu ra", tin.outBytes ? kb(tin.outBytes) : null);
        dong("Trình biên dịch", cur.ngon === "js" ? null : "Clang/LLD " + (TH.cpp ? TH.cpp.phienBan : "") + " → WebAssembly (@yowasp/clang, ISC)");
        vung.appendChild(h("div", { class: "thong-tin" }, dl));
        if (cur.ngon !== "js") vung.appendChild(h("p", { class: "mut", style: "font-size:.86rem;margin:10px 0 0", text: "Giới hạn: không ngoại lệ (try/catch/throw), không luồng, không tệp. Stack 8 MB, bộ nhớ ≤ 512 MB, đầu ra tối đa 1 MB." }));
      }
    }

    /* ----- trình soạn ----- */
    var hen = 0;
    var ed = TH.editor.tao(edHost, {
      ngon: cur.ngon, giaTri: cur.ma, nhan: "Mã nguồn",
      khiDoi: function (v) { cur.ma = v; clearTimeout(hen); hen = setTimeout(function () { cur.ts = Date.now(); ghiDs(); }, 500); },
      khiChay: chay
    });
    function dungNgon() {
      var coC = cur.ngon !== "js";
      selNgon.value = cur.ngon;
      selChuan.replaceChildren();
      (CHUAN[cur.ngon] || []).forEach(function (c) { selChuan.appendChild(h("option", { value: c[0], text: c[1], selected: c[0] === cur.chuan })); });
      selO.value = cur.toiUu || "O2";
      D.$$(".ide-opt", w).forEach(function (l) { l.hidden = !coC; });
      ed.doiNgon(cur.ngon === "js" ? "js" : cur.ngon);
    }
    function mo(x) {
      cur = x; ghiDs(); inTen.value = cur.ten; ed.dat(cur.ma); stdinTa.value = cur.stdin || ""; dungNgon();
      chuanDoan = []; ed.danhDauLoi([]); outEl.textContent = "Bấm Chạy để thấy kết quả ở đây."; errEl.hidden = true; tin = { bienDich: null, wasm: null, chay: null, code: null, outBytes: 0 }; chonTab("ra");
    }
    mo(cur);
    inTen.addEventListener("input", function () { cur.ten = inTen.value.trim() || "Không tên"; cur.ts = Date.now(); ghiDs(); });
    stdinTa.addEventListener("input", function () { cur.stdin = stdinTa.value; clearTimeout(hen); hen = setTimeout(function () { cur.ts = Date.now(); ghiDs(); }, 500); });
    selNgon.addEventListener("change", function () {
      var n = selNgon.value, cuMau = (MAU[cur.ngon] || []).some(function (m) { return m[1] === cur.ma; });
      cur.ngon = n; cur.chuan = n === "c" ? "c17" : n === "cpp" ? "c++17" : ""; cur.toiUu = cur.toiUu || "O2";
      if (cuMau || !cur.ma.trim()) { cur.ma = MAU[n][0][1]; ed.dat(cur.ma); }
      ghiDs(); dungNgon();
    });
    selChuan.addEventListener("change", function () { cur.chuan = selChuan.value; ghiDs(); });
    selO.addEventListener("change", function () { cur.toiUu = selO.value; ghiDs(); });
    selHan.addEventListener("change", function () { han = +selHan.value; luu.ghi("ide/cai", Object.assign(cai, { han: han })); });

    /* ----- ngăn đoạn mã & mẫu ----- */
    function veNganTep() {
      nganTep.replaceChildren();
      ds.slice().sort(function (a, b) { return b.ts - a.ts; }).forEach(function (x) {
        nganTep.appendChild(h("div", { style: "display:flex;gap:4px;align-items:center" },
          h("button", { class: "muc", type: "button", "aria-current": x.id === cur.id ? "true" : null, onclick: function () { mo(x); nganTep.hidden = true; nutTep.setAttribute("aria-expanded", "false"); } },
            h("span", { text: x.ten }), h("span", { class: "chip xam", text: TEN_NGON[x.ngon] })),
          h("button", { class: "ic-btn", type: "button", "aria-label": "Nhân đôi " + x.ten, title: "Nhân đôi", onclick: function () { var b = Object.assign({}, x, moi(x.ngon), { ten: tenMoi(ds, x.ten + " (bản sao)"), ma: x.ma, stdin: x.stdin, chuan: x.chuan, toiUu: x.toiUu }); ds.push(b); ghiDs(); veNganTep(); } }, ic("copy")),
          h("button", { class: "ic-btn", type: "button", "aria-label": "Xoá " + x.ten, title: "Xoá", onclick: function () {
            D.hoi({ tieuDe: "Xoá “" + x.ten + "”?", noiDung: "Đoạn mã này sẽ bị xoá khỏi máy.", nutChinh: "Xoá", nguyHiem: true }).then(function (ok) {
              if (!ok) return;
              ds = ds.filter(function (y) { return y.id !== x.id; });
              if (!ds.length) ds.push(moi("cpp"));
              if (cur.id === x.id) mo(ds[0]); else ghiDs();
              veNganTep();
            });
          } }, ic("trash"))));
      });
      nganTep.appendChild(h("button", { class: "muc", type: "button", onclick: function () { var s = moi(cur.ngon, [tenMoi(ds, "Đoạn mã mới"), (MAU[cur.ngon] || MAU.cpp)[0][1], ""]); ds.push(s); mo(s); veNganTep(); } }, h("span", { text: "+ Đoạn mã mới" })));
    }
    nutTep.addEventListener("click", function () { var mo2 = nganTep.hidden; nganTep.hidden = !mo2; nganMau.hidden = true; nutTep.setAttribute("aria-expanded", String(mo2)); if (mo2) veNganTep(); });
    nutMau.addEventListener("click", function () {
      var mo2 = nganMau.hidden; nganMau.hidden = !mo2; nganTep.hidden = true; nutMau.setAttribute("aria-expanded", String(mo2));
      if (!mo2) return;
      nganMau.replaceChildren();
      (MAU[cur.ngon] || []).forEach(function (m) {
        nganMau.appendChild(h("button", { class: "muc", type: "button", onclick: function () {
          var xong = function () { cur.ma = m[1]; ed.dat(m[1]); stdinTa.value = m[2]; cur.stdin = m[2]; ghiDs(); nganMau.hidden = true; nutMau.setAttribute("aria-expanded", "false"); };
          var thayDoi = (MAU[cur.ngon] || []).every(function (x) { return x[1] !== cur.ma; }) && cur.ma.trim();
          if (thayDoi) D.hoi({ tieuDe: "Thay bằng mẫu?", noiDung: "Mã hiện tại sẽ bị thay (nên “Nhân đôi” đoạn mã trước nếu muốn giữ).", nutChinh: "Thay bằng mẫu" }).then(function (ok) { if (ok) xong(); }); else xong();
        } }, h("span", { text: m[0] })));
      });
    });
    nutTai.addEventListener("click", function () { D.tai((cur.ten.replace(/[^\w\-. ]+/g, "_").trim() || "main") + DUOI[cur.ngon], cur.ma); });
    nutChep.addEventListener("click", function () { D.chep(cur.ma).then(function (ok) { D.toast(ok ? "Đã chép mã" : "Không chép được", ok ? "ok" : "bad"); }); });

    /* ----- chạy ----- */
    function datBan(b) { busy = b; nutChay.disabled = b; nutDung.hidden = !b; if (!b) tt.hidden = true; }
    function noiTT(msg, pct) {
      tt.hidden = false; D.$(".nd", tt).textContent = msg;
      var th = D.$(".thanh", tt); th.hidden = pct == null; if (pct != null) th.firstChild.style.width = Math.round(pct) + "%";
    }
    function hienKetQua(out, err, tomTat, loai) {
      outEl.textContent = (out || "") + (tomTat ? (out && !/\n$/.test(out) ? "\n" : "") + "— " + tomTat + " —" : "");
      errEl.hidden = !err; errEl.textContent = err || "";
      if (!out && !tomTat) outEl.textContent = "(chương trình không in gì)";
      chonTab(loai === "bd" ? "bd" : "ra");
    }
    nutDung.addEventListener("click", function () { cpphuy = true; if (huyHien) huyHien(); if (jsRun) { jsRun.dung(); jsRun = null; } if (TH.cpp) TH.cpp.huy(); datBan(false); outEl.textContent += "\n— đã dừng —"; });

    function chayJs() {
      if (!jsRun) jsRun = TH.chayJs.taoTrinhChay();
      noiTT("Đang chạy JavaScript…");
      jsRun.chay(cur.ma, cur.stdin || "", han).then(function (r) {
        datBan(false);
        tin = { bienDich: null, wasm: null, chay: r.ms, code: r.ok ? 0 : 1, outBytes: (r.text || "").length };
        chuanDoan = r.ok ? [] : [{ dong: r.dong || 0, cot: 1, loai: "error", msg: r.loi }];
        ed.danhDauLoi(r.ok ? [] : (r.dong ? [{ dong: r.dong, msg: r.loi }] : []));
        hienKetQua(r.text, (r.err ? r.err + (r.loi ? "\n" : "") : "") + (r.ok ? "" : r.loi + (r.dong ? " (dòng " + r.dong + ")" : "")), r.ok ? "xong, " + Math.round(r.ms) + " ms" : (r.hetGio ? "quá giờ" : "lỗi"));
      });
    }
    function chayCpp() {
      ui.canDongYCpp().then(function (ok) {
        if (!ok || huy) { datBan(false); return; }
        cpphuy = false;
        var t0 = performance.now();
        noiTT("Đang chuẩn bị trình biên dịch…");
        TH.cpp.bienDich({
          ma: cur.ma, ngon: cur.ngon, chuan: cur.chuan, toiUu: cur.toiUu,
          tienDo: function (p) {
            if (p.loai === "tai") noiTT("Đang tải trình biên dịch… " + p.pct + "% (" + Math.round(p.da / 1048576) + "/" + Math.round(p.tong / 1048576) + " MB)", p.pct);
            else if (p.loai === "cache") noiTT("Nạp trình biên dịch từ bộ nhớ máy…");
            else if (p.loai === "bat-dau") noiTT("Đang biên dịch…");
            else if (p.loai === "giay") noiTT("Đang biên dịch… " + p.giay + " giây (lần đầu lâu hơn vì nạp bộ biên dịch)");
          }
        }).then(function (kq) {
          if (cpphuy || huy) return;
          chuanDoan = kq.chuanDoan; tin = { bienDich: performance.now() - t0, wasm: kq.wasm ? kq.wasm.length : 0, chay: null, code: null, outBytes: 0 };
          ed.danhDauLoi(kq.chuanDoan.filter(function (d) { return d.dong > 0 && d.loai === "error"; }));
          if (!kq.ok) {
            datBan(false);
            outEl.textContent = kq.loi || "Biên dịch thất bại — xem tab “Biên dịch”.";
            errEl.hidden = true;
            if (kq.chuanDoan.length) { chonTab("bd"); var d0 = kq.chuanDoan.filter(function (d) { return d.loai === "error" && d.dong; })[0]; if (d0) ed.nhayToi(d0.dong, d0.cot); } else chonTab("ra");
            return;
          }
          noiTT("Đang chạy…");
          outEl.textContent = ""; errEl.textContent = ""; errEl.hidden = true; chonTab("ra");
          var chay = TH.cpp.batDauChay(kq.wasm, cur.stdin || "", {
            hanMs: han,
            khiOut: function (s) { if (outEl.textContent.length < 400000) outEl.textContent += s; },
            khiErr: function (s) { errEl.hidden = false; if (errEl.textContent.length < 200000) errEl.textContent += s; }
          });
          huyHien = chay.dung;
          chay.xong.then(function (r) {
            huyHien = null;
            if (cpphuy || huy) return;
            datBan(false);
            tin.chay = r.ms; tin.code = r.code; tin.outBytes = r.out.length;
            outEl.textContent = r.out; errEl.textContent = r.err; errEl.hidden = !r.err;
            var ghi = r.hetGio ? r.loi : r.ok && !r.code ? "xong, " + Math.round(r.ms) + " ms" : (r.loi || "lỗi lúc chạy");
            outEl.textContent += (r.out && !/\n$/.test(r.out) ? "\n" : "") + "— " + ghi + " —";
            if (!r.ok || r.code) errEl.hidden = false, errEl.textContent += (r.err ? "\n" : "") + (r.loi || "");
            chonTab("ra");
          });
        });
      });
    }
    function chay() {
      if (busy) return;
      cur.ma = ed.lay(); cur.stdin = stdinTa.value; ghiDs();
      datBan(true); chuanDoan = []; ed.danhDauLoi([]); huyHien = null;
      if (cur.ngon === "js") chayJs(); else chayCpp();
    }
    nutChay.addEventListener("click", chay);

    return function () {
      huy = true;
      if (huyHien) huyHien();
      if (jsRun) { jsRun.dung(); jsRun = null; }
      if (TH.cpp && busy) TH.cpp.huy();
    };
  });
})(window);
