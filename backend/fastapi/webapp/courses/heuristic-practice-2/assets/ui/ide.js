/* IDE online: soạn, định dạng, biên dịch, chạy. Nơi chạy do người học chọn:
     • Trong trình duyệt (offline): C/C++ bằng Clang → WebAssembly (TH.cpp), JavaScript trong Web Worker (TH.chayJs) — như cũ, không gửi mã đi đâu;
     • Máy chủ: backend chuyển mã tới Piston / Judge0 / Wandbox hoặc trình biên dịch cài trên máy chủ (CS.runner, hợp đồng POST /run) — thêm Java, Python;
     • Piston của bạn: gọi thẳng từ trình duyệt tới máy Piston bạn tự dựng.
   Trình soạn dùng chung CS.editor (gợi ý khi gõ, tự đóng ngoặc, tự thụt, tìm/thay, định dạng…). Định dạng: bộ tự viết hoặc clang-format / Prettier / Ruff tải về một lần.
   Đoạn mã lưu trong kho của trang (localStorage, có trong sao lưu .json); tuỳ chọn đồng bộ lên máy chủ (kho JSON / MySQL / MongoDB) khi mở qua backend. */
(function (root) {
  "use strict";
  var TH = root.TH, CS = root.CS, ui = TH.ui, D = TH.dom, h = D.h, ic = ui.ic, luu = ui.luu, TI = TH.tienIch;

  var NGON = ["cpp", "c", "javascript", "java", "python"];
  var TEN_NGON = { cpp: "C++", c: "C", javascript: "JavaScript", java: "Java", python: "Python" };
  var CHUAN = { cpp: [["c++17", "C++17"], ["c++20", "C++20"], ["c++14", "C++14"], ["c++11", "C++11"]], c: [["c17", "C17"], ["c11", "C11"]] };
  var HAN = [[2000, "2 giây"], [5000, "5 giây"], [10000, "10 giây"], [15000, "15 giây (trần máy chủ)"], [30000, "30 giây (chỉ trong trình duyệt)"]];
  var CHAY_OFFLINE = { cpp: 1, c: 1, javascript: 1 };
  var API = String((root.__WEBAPP_CONFIG__ && root.__WEBAPP_CONFIG__.apiBase) || "").replace(/\/+$/, "");
  /* Backend chèn __WEBAPP_CONFIG__ vào index.html khi phục vụ trang. apiBase có thể RỖNG (API_PREFIX trống: route nằm ở gốc, /run, /codestore…)
     mà vẫn là "có máy chủ" — nên có-máy-chủ = có cấu hình được chèn, KHÔNG phải apiBase khác rỗng. Trang mở bằng file:// hay máy chủ tĩnh thì không có cấu hình. */
  var HAS_API = !!root.__WEBAPP_CONFIG__ && typeof root.__WEBAPP_CONFIG__.apiBase === "string";
  var HOI_MAT = "Bấm Chạy để thấy kết quả ở đây.";

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
    javascript: [
      ["Xin chào", String.raw`// JavaScript chạy trong Web Worker. Có sẵn: readInput() print() log() rng(seed) now()
print("Xin chào, Heuristic!");
`, ""],
      ["Đọc n số: tổng và lớn nhất", String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const n = t[0], a = t.slice(1, 1 + n);
print("tong = " + a.reduce((x, y) => x + y, 0) + ", lon nhat = " + Math.max(...a));
log("đã đọc " + n + " số");   // log → stderr, không lẫn vào kết quả
`, "5\n3 -1 4 1 5\n"]
    ],
    java: [
      ["Xin chào", String.raw`public class Main {
    public static void main(String[] args) {
        System.out.println("Xin chào, Heuristic!");
    }
}
`, ""],
      ["Đọc n số: tổng và lớn nhất", String.raw`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long tong = 0;
        int lon = Integer.MIN_VALUE;
        for (int i = 0; i < n; i++) {
            int x = sc.nextInt();
            tong += x;                  // long: tránh tràn int
            lon = Math.max(lon, x);
        }
        System.out.println("tong = " + tong + ", lon nhat = " + lon);
    }
}
`, "5\n3 -1 4 1 5\n"]
    ],
    python: [
      ["Xin chào", String.raw`print("Xin chào, Heuristic!")
`, ""],
      ["Đọc n số: tổng và lớn nhất", String.raw`import sys

data = sys.stdin.read().split()
n = int(data[0])
a = list(map(int, data[1:1 + n]))
print("tong =", sum(a), ", lon nhat =", max(a))
`, "5\n3 -1 4 1 5\n"]
    ]
  };

  /* ---------- kho: chuyển luu (localStorage chịu lỗi, có trong sao lưu .json) thành kv của CS.store ---------- */
  function kvLuu(tienTo) {
    return {
      persistent: luu.luuDuoc(),
      get: function (k) { return Promise.resolve(luu.doc(tienTo + k, null)); },
      set: function (k, v) { luu.ghi(tienTo + k, v); return Promise.resolve(); },
      del: function (k) { luu.xoa(tienTo + k); return Promise.resolve(); },
      keys: function (p) { var dau = tienTo + (p || ""); return Promise.resolve(luu.khoa(dau).map(function (k) { return k.slice(tienTo.length); })); }
    };
  }
  function sach(o) { return JSON.parse(JSON.stringify(o)); }
  function kb(n) { return n >= 1048576 ? TI.so(n / 1048576, 1) + " MB" : TI.so(n / 1024, 0) + " KB"; }
  function tenMoi(ds, goc) {
    var dem = 1, ten = goc;
    while (ds.some(function (x) { return x.name === ten; })) ten = goc + " (" + (++dem) + ")";
    return ten;
  }
  function tepCua(ngon) { return CS.langs.defaultFile(ngon); }
  function moi(ngon, mau, ten) {
    var m = mau || MAU[ngon][0];
    var it = CS.project.createSnippet({ name: ten || m[0], language: ngon, content: m[1] });
    it.meta.stdin = m[2] || ""; it.meta.std = ngon === "c" ? "c17" : ngon === "cpp" ? "c++17" : ""; it.meta.opt = "O2";
    return it;
  }
  function maCua(it) { return it.files[0] ? it.files[0].content : ""; }
  function datMa(it, v) { if (!it.files.length) it.files.push({ path: tepCua(it.language), content: v }); else it.files[0].content = v; }
  function laMau(ngon, ma) { return (MAU[ngon] || []).some(function (m) { return m[1] === ma; }); }

  /* nhập đoạn mã cũ (th2:ide/ds) một lần — không xoá bản cũ để an toàn */
  function chuyenDoanCu(lib) {
    var cu = luu.doc("ide/ds", null);
    if (!Array.isArray(cu) || luu.doc("ide2/daChuyen", false)) return Promise.resolve(0);
    var ngonMap = { js: "javascript", cpp: "cpp", c: "c" }, n = 0;
    return cu.reduce(function (p, x) {
      return p.then(function () {
        if (!x || typeof x.ma !== "string") return null;
        var ng = ngonMap[x.ngon] || "cpp", it = CS.project.createSnippet({ name: String(x.ten || "Đoạn mã").slice(0, 200), language: ng, content: x.ma });
        it.meta.stdin = String(x.stdin || ""); it.meta.std = x.chuan || ""; it.meta.opt = x.toiUu || "O2";
        n++;
        return lib.put(it);
      });
    }, Promise.resolve()).then(function () { luu.ghi("ide2/daChuyen", true); return n; });
  }

  /* hộp thoại nhiều nút (D.hoi chỉ có hai nút) */
  function hop(tieuDe, noiDung, nut) {
    return new Promise(function (xong) {
      var dlg = h("dialog", { class: "hop", "aria-labelledby": "hop-td", style: "width:min(94vw,640px)" });
      var nutEl = h("div", { class: "hop-nut" });
      nut.forEach(function (n) { nutEl.appendChild(h("button", { type: "button", class: "btn" + (n.chinh ? " btn-ac" : "") + (n.hai ? " btn-bad" : ""), text: n.ten, onclick: function () { dong(n.gt); } })); });
      dlg.appendChild(h("h3", { id: "hop-td", text: tieuDe }));
      dlg.appendChild(h("div", { class: "hop-nd", style: "max-height:62vh;overflow:auto" }, noiDung));
      dlg.appendChild(nutEl);
      function dong(v) { try { dlg.close(); } catch (e) { /* đã đóng */ } dlg.remove(); xong(v); }
      dlg.addEventListener("cancel", function (e) { e.preventDefault(); dong(null); });
      document.body.appendChild(dlg);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    });
  }

  ui.dangKyTrang("ide", function (el) {
    ui.tieuDe("IDE online"); ui.danhDauBai(null);
    var huy = false, busy = false, jsRun = null, huyHien = null, cpphuy = false, runHandle = null, hen = 0;
    var lib = null, sync = null, san = null, cur = null, dsCache = [], servers = [];
    var tin = { bienDich: null, wasm: null, chay: null, code: null, outBytes: 0, noi: "" }, chuanDoan = [], tabHien = "ra", loc = "";
    function ide() { return ui.cai().ide || {}; }
    function ghiIde(vaTrai) { ui.ghiCai({ ide: Object.assign({}, ide(), vaTrai) }); }
    function han() { return (cur && cur.meta && cur.meta.han) || ide().han || 5000; }

    /* ----- khung ----- */
    var w = h("div", { class: "wrap rong" });
    w.appendChild(h("h1", { style: "font-size:1.5rem;margin-bottom:10px", text: "IDE online" }));
    var selNgon = h("select", { "aria-label": "Ngôn ngữ" }, NGON.map(function (n) { return h("option", { value: n, text: TEN_NGON[n] }); }));
    var selChuan = h("select", { "aria-label": "Chuẩn ngôn ngữ" });
    var selO = h("select", { "aria-label": "Mức tối ưu hoá" }, ["O0", "O1", "O2", "O3"].map(function (o) { return h("option", { value: o, text: "-" + o }); }));
    var selHan = h("select", { "aria-label": "Giới hạn thời gian chạy" }, HAN.map(function (x) { return h("option", { value: String(x[0]), text: x[1] }); }));
    var selNoi = h("select", { "aria-label": "Nơi chạy", title: "Chạy trong trình duyệt (offline) hay trên máy chủ / Piston của bạn" });
    var selFmt = h("select", { "aria-label": "Bộ định dạng", title: "Bộ định dạng mã" });
    var inTen = h("input", { type: "text", class: "ide-ten", "aria-label": "Tên đoạn mã", maxlength: "200" });
    var nutChay = h("button", { class: "btn btn-ac", type: "button", title: "Ctrl+Enter" }, ic("play"), "Chạy");
    var nutDung = h("button", { class: "btn btn-bad", type: "button", hidden: true }, ic("stop"), "Dừng");
    var nutTep = h("button", { class: "btn btn-sm", type: "button", "aria-expanded": "false" }, ic("file"), "Đoạn mã");
    var nutMau = h("button", { class: "btn btn-sm", type: "button", "aria-expanded": "false" }, ic("book"), "Mẫu");
    var nutDD = h("button", { class: "btn btn-sm", type: "button", title: "Định dạng mã (Shift+Alt+F)" }, ic("reset"), "Định dạng");
    var nutTai = h("button", { class: "btn btn-sm", type: "button" }, ic("dl"), "Tải về");
    var nutChep = h("button", { class: "btn btn-sm", type: "button" }, ic("copy"), "Chép");
    var nutCai = h("button", { class: "btn btn-sm", type: "button", title: "Cài đặt: cỡ chữ, kiểu định dạng, nơi chạy, Piston, nơi lưu" }, ic("eye"), "Cài đặt");
    w.appendChild(h("div", { class: "ide-bar" }, inTen, nutTep, nutMau, nutDD, selFmt, nutTai, nutChep, nutCai));
    var nganTep = h("div", { class: "ngan-keo", hidden: true }), nganMau = h("div", { class: "ngan-keo", hidden: true });
    w.appendChild(nganTep); w.appendChild(nganMau);
    w.appendChild(h("div", { class: "ide-bar", style: "margin-top:8px" },
      h("label", {}, "Ngôn ngữ", selNgon), h("label", { class: "ide-opt" }, "Chuẩn", selChuan), h("label", { class: "ide-opt" }, "Tối ưu", selO), h("label", {}, "Giới hạn", selHan), h("label", {}, "Nơi chạy", selNoi),
      h("span", { style: "flex:1" }), nutChay, nutDung));
    var cot = h("div", { class: "ide-cot" });
    var edHost = h("div", {});
    var cotPhai = h("div", {});
    cot.appendChild(h("div", {}, edHost, h("p", { class: "mut", style: "font-size:.86rem;margin:6px 2px 0", text: "Ctrl+Enter chạy · Shift+Alt+F định dạng · Ctrl+Space gợi ý · Ctrl+F tìm · Ctrl+/ chú thích dòng · Tab thụt dòng. Mã tự lưu trên máy này." }))); cot.appendChild(cotPhai);
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
    var outEl = h("pre", { class: "o-ra", style: "max-height:360px", text: HOI_MAT });
    var errEl = h("pre", { class: "o-ra err", hidden: true });
    el.appendChild(w);

    function chonTab(t) {
      tabHien = t;
      Object.keys(tabBt).forEach(function (k) { tabBt[k].setAttribute("aria-selected", k === t ? "true" : "false"); });
      vung.replaceChildren();
      if (t === "ra") { vung.appendChild(outEl); vung.appendChild(errEl); }
      else if (t === "bd") {
        if (!chuanDoan.length) vung.appendChild(h("p", { class: "mut", style: "margin:0", text: !cur || cur.language === "javascript" || cur.language === "python" ? "Ngôn ngữ này không có bước biên dịch riêng (lỗi chạy hiện ở tab Kết quả)." : "Chưa có thông báo biên dịch (hoặc biên dịch sạch)." }));
        else vung.appendChild(h("ul", { class: "chuan-doan" }, chuanDoan.map(function (d) {
          return h("li", { class: d.loai, onclick: function () { if (d.dong) ed.nhayToi(d.dong, d.cot); } },
            h("span", { class: "loai", text: d.loai === "error" ? "lỗi" : d.loai === "warning" ? "cảnh báo" : "ghi chú" }), h("span", { class: "vt", text: d.dong ? d.dong + (d.cot ? ":" + d.cot : "") : "" }), h("span", { text: d.msg }));
        })));
      } else {
        var dl = h("dl", {});
        function dong(k, v) { if (v != null && v !== "") { dl.appendChild(h("dt", { text: k })); dl.appendChild(h("dd", { text: v })); } }
        var ng = cur ? cur.language : "cpp";
        dong("Ngôn ngữ", TEN_NGON[ng] + (cur && cur.meta.std && (ng === "cpp" || ng === "c") ? " · " + cur.meta.std.toUpperCase() + " · -" + (cur.meta.opt || "O2") : ""));
        dong("Nơi chạy", tin.noi);
        dong("Biên dịch", tin.bienDich != null ? TI.so(tin.bienDich / 1000, 1) + " giây" + (tin.wasm ? " · " + kb(tin.wasm) : "") : null);
        dong("Chạy", tin.chay != null ? Math.round(tin.chay) + " ms" : null);
        dong("Mã thoát", tin.code != null ? String(tin.code) : null);
        dong("Đầu ra", tin.outBytes ? kb(tin.outBytes) : null);
        if (!tin.noi || tin.noi.indexOf("trình duyệt") >= 0) dong("Trình biên dịch", ng === "javascript" ? null : (ng === "cpp" || ng === "c") ? "Clang/LLD " + (TH.cpp ? TH.cpp.phienBan : "") + " → WebAssembly (@yowasp/clang, ISC)" : null);
        vung.appendChild(h("div", { class: "thong-tin" }, dl));
        if (ng === "cpp" || ng === "c") vung.appendChild(h("p", { class: "mut", style: "font-size:.86rem;margin:10px 0 0", text: "Trong trình duyệt: không ngoại lệ (try/catch/throw), không luồng, không tệp. Stack 8 MB, bộ nhớ ≤ 512 MB, đầu ra tối đa 1 MB. Chạy trên máy chủ không bị các giới hạn này." }));
      }
    }

    /* ----- trình soạn ----- */
    var ed = TH.editor.tao(edHost, {
      ngon: "cpp", giaTri: "", nhan: "Mã nguồn",
      khiDoi: function (v) { if (!cur) return; datMa(cur, v); henLuu(); },
      khiChay: chay, khiDinhDang: dinhDang, khiLuu: function () { luuNgay().then(function () { D.toast("Đã lưu trên máy này" + (dongBoNoi() ? " · đang đồng bộ" : ""), "ok"); }); },
      khiDoiTuyChon: function (o) { var p = {}; if ("fontSize" in o) p.coChu = o.fontSize; if ("wrap" in o) p.ngatDong = o.wrap; ui.ghiCai(p); }
    });

    /* ----- lưu ----- */
    function luuNgay() {
      clearTimeout(hen);
      if (!cur || !lib) return Promise.resolve();
      cur.meta.stdin = stdinTa.value;
      return lib.put(sach(cur)).then(function (saved) { if (saved && saved.updatedAt) cur.updatedAt = saved.updatedAt; if (sync && dongBoNoi()) khoiDongBo(); });
    }
    function henLuu() { clearTimeout(hen); hen = setTimeout(luuNgay, 450); }
    var khoiDongBo = (function () { var t = 0; return function () { clearTimeout(t); t = setTimeout(function () { if (sync && dongBoNoi()) sync.syncNow().then(veNganTepNeuMo, function () { /* trạng thái đã ghi lỗi */ }).then(capNhatChanTep); }, 1500); }; })();
    function dongBoNoi() { return !!(sync && (sync.isConnected ? sync.isConnected() : sync.workspaceId)); }
    function veNganTepNeuMo() { if (!nganTep.hidden) return napDs().then(veNganTep); }

    /* ----- mở một đoạn mã ----- */
    function dungNgon() {
      var coC = cur.language === "cpp" || cur.language === "c";
      selNgon.value = cur.language;
      selChuan.replaceChildren();
      (CHUAN[cur.language] || []).forEach(function (c) { selChuan.appendChild(h("option", { value: c[0], text: c[1], selected: c[0] === cur.meta.std })); });
      selO.value = cur.meta.opt || "O2";
      D.$$(".ide-opt", w).forEach(function (l) { l.hidden = !coC; });
      selHan.value = String(han());
      ed.doiNgon(cur.language);
      veDinhDang(); veNoiChay();
    }
    function mo(x) {
      cur = sach(x); cur.meta = cur.meta || {};
      ui.ghiCai({ ide: Object.assign({}, ide(), { hien: cur.id }) });
      inTen.value = cur.name; ed.dat(maCua(cur)); stdinTa.value = cur.meta.stdin || ""; dungNgon();
      chuanDoan = []; ed.danhDauLoi([]); outEl.textContent = HOI_MAT; errEl.hidden = true; tin = { bienDich: null, wasm: null, chay: null, code: null, outBytes: 0, noi: "" }; chonTab("ra");
    }
    function chuyenNgon(n) {
      var cuMau = laMau(cur.language, maCua(cur)) || !maCua(cur).trim();
      cur.language = n; cur.meta.std = n === "c" ? "c17" : n === "cpp" ? "c++17" : ""; cur.meta.opt = cur.meta.opt || "O2";
      if (cur.files[0]) cur.files[0].path = tepCua(n);
      if (cuMau) { var m = MAU[n][0]; datMa(cur, m[1]); ed.dat(m[1]); }
      dungNgon(); henLuu();
    }

    /* ----- bộ định dạng ----- */
    function tuyChonDD() {
      var d = ide().dinhDang || {};
      return { provider: (d.provider || {})[cur.language] || "builtin", braces: d.braces || "kr", pointer: d.pointer || "auto", keepOneLiners: d.giuMotDong !== false, clangStyle: d.clangStyle || "Google" };
    }
    function veDinhDang() {
      selFmt.replaceChildren();
      var now = tuyChonDD().provider;
      CS.format.listFor(cur.language).forEach(function (p) { selFmt.appendChild(h("option", { value: p.id, text: p.label.replace(/ \(.*$/, "") + (p.needsDownload ? " · tải " + p.needsDownload : ""), selected: p.id === now })); });
      selFmt.value = now;
    }
    function dinhDang() {
      if (!cur || busy) return;
      var truoc = ed.lay();
      return ed.dinhDang(tuyChonDD()).then(function (r) {
        if (r.ok && ed.lay() !== truoc) D.toast("Đã định dạng" + (r.provider !== "builtin" ? " bằng " + ((CS.format.providers[r.provider] || {}).label || r.provider) : ""), "ok");
        else if (r.ok) D.toast("Mã đã gọn — không có gì để đổi");
        if (r.error) D.toast(r.error, r.ok ? "" : "bad");
      });
    }
    CS.format.confirmDownload = function (p) {
      var nd = h("div", { class: "md" }, h("p", {}, "Bộ định dạng ", h("b", { text: p.label }), " chạy ngay trong trình duyệt nhưng cần tải về một lần", p.needsDownload ? " (" + p.needsDownload + ")" : "", " từ cdn.jsdelivr.net. Mã của bạn không bị gửi đi — chỉ tải tệp công cụ."), p.note ? h("p", { class: "mut", text: p.note }) : null);
      return D.hoi({ tieuDe: "Tải bộ định dạng?", noiDung: nd, nutChinh: "Tải", nutPhu: "Để sau" });
    };

    /* ----- nơi chạy ----- */
    function dsNoiChay(ng) {
      var out = [];
      if (CHAY_OFFLINE[ng]) out.push({ id: "browser", label: "Trong trình duyệt (offline)", available: true });
      if (CS.runner) {
        var rt = [];
        try { rt = CS.runner.targets({ language: ng, languages: [ng], server: servers, pistonUrl: ide().pistonUrl || "" }) || []; } catch (e) { rt = []; }
        rt.forEach(function (t) { if (t.id !== "browser") out.push(t); });
      }
      return out;
    }
    function noiHienTai(ng) {
      var ds = dsNoiChay(ng), muon = (ide().noiChay || {})[ng];
      return ds.filter(function (t) { return t.id === muon && t.available !== false; })[0] || ds.filter(function (t) { return t.available !== false; })[0] || ds[0] || null;
    }
    function veNoiChay() {
      selNoi.replaceChildren();
      var ds = dsNoiChay(cur.language), now = noiHienTai(cur.language);
      ds.forEach(function (t) { selNoi.appendChild(h("option", { value: t.id, text: (t.label || t.id) + (t.available === false ? " — không dùng được" : ""), disabled: t.available === false ? true : null })); });
      if (!ds.length) selNoi.appendChild(h("option", { value: "", text: "Chưa có nơi chạy cho " + TEN_NGON[cur.language] + " — mở trang qua backend hoặc đặt Piston ở Cài đặt" }));
      if (now) selNoi.value = now.id;
      selNoi.title = (ds.filter(function (t) { return t.id === selNoi.value; })[0] || {}).reason || selNoi.title;
    }
    function napMayChu() {
      if (!HAS_API || !CS.runner) return Promise.resolve();
      return CS.runner.loadServerProviders(API, { fetch: root.fetch.bind(root) }).then(function (ds) { servers = ds || []; if (cur && !huy) veNoiChay(); });
    }

    /* ----- ngăn đoạn mã (thư viện) & mẫu ----- */
    function napDs() { return lib.list().then(function (ds) { dsCache = ds || []; }); }
    function veNganTep() {
      nganTep.replaceChildren();
      var q = h("input", { type: "search", "aria-label": "Tìm đoạn mã", placeholder: "Tìm theo tên, ngôn ngữ, nội dung…", value: loc, style: "width:100%;margin-bottom:6px" });
      q.addEventListener("input", function () { loc = q.value; ve(); });
      var ds = h("div", {});
      nganTep.appendChild(q); nganTep.appendChild(ds);
      var chan = h("div", { class: "mut", style: "font-size:.84rem;padding:6px 10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center", id: "ide-chan" });
      function ve() {
        ds.replaceChildren();
        var tu = D.boDau(loc).split(/\s+/).filter(Boolean);
        var xs = dsCache.filter(function (x) {
          if (!tu.length) return true;
          var kho = D.boDau(x.name + " " + x.language + " " + maCua(x).slice(0, 20000));
          return tu.every(function (t) { return kho.indexOf(t) >= 0; });
        });
        xs.forEach(function (x) {
          var ghim = !!(x.meta && x.meta.pinned);
          ds.appendChild(h("div", { style: "display:flex;gap:4px;align-items:center" },
            h("button", { class: "muc", type: "button", "aria-current": cur && x.id === cur.id ? "true" : null, onclick: function () { luuNgay().then(function () { mo(x); nganTep.hidden = true; nutTep.setAttribute("aria-expanded", "false"); }); } },
              h("span", { text: (ghim ? "📌 " : "") + x.name }), h("span", { class: "chip xam", text: TEN_NGON[x.language] || x.language })),
            h("button", { class: "ic-btn", type: "button", "aria-label": (ghim ? "Bỏ ghim " : "Ghim ") + x.name, title: ghim ? "Bỏ ghim" : "Ghim lên đầu", onclick: function () {
              var y = sach(x); y.meta = y.meta || {}; y.meta.pinned = !ghim;
              (cur && cur.id === x.id ? (cur.meta.pinned = !ghim, luuNgay()) : lib.put(y)).then(napDs).then(veNganTep);
            } }, ic("bulb")),
            h("button", { class: "ic-btn", type: "button", "aria-label": "Nhân đôi " + x.name, title: "Nhân đôi", onclick: function () {
              var y = sach(x); y.id = CS.project.newId(); y.name = tenMoi(dsCache, x.name + " (bản sao)"); y.updatedAt = 0; y.meta = y.meta || {}; y.meta.pinned = false;
              lib.put(y).then(napDs).then(veNganTep);
            } }, ic("copy")),
            h("button", { class: "ic-btn", type: "button", "aria-label": "Xoá " + x.name, title: "Xoá", onclick: function () {
              D.hoi({ tieuDe: "Xoá “" + x.name + "”?", noiDung: "Đoạn mã này sẽ bị xoá khỏi máy" + (dongBoNoi() ? " và khỏi các thiết bị đã đồng bộ." : "."), nutChinh: "Xoá", nguyHiem: true }).then(function (ok) {
                if (!ok) return;
                var laCur = cur && cur.id === x.id;
                lib.remove(x.id).then(napDs).then(function () {
                  if (laCur) { cur = null; if (dsCache.length) mo(dsCache[0]); else return lib.put(moi("cpp")).then(napDs).then(function () { mo(dsCache[0]); }); }
                }).then(veNganTep);
              });
            } }, ic("trash"))));
        });
        if (!xs.length) ds.appendChild(h("p", { class: "mut", style: "margin:8px 10px", text: dsCache.length ? "Không có đoạn mã nào khớp." : "Chưa có đoạn mã." }));
      }
      ve();
      nganTep.appendChild(h("button", { class: "muc", type: "button", onclick: function () {
        luuNgay().then(function () { var s = moi(cur ? cur.language : "cpp", null, tenMoi(dsCache, "Đoạn mã mới")); return lib.put(s).then(function (sv) { return napDs().then(function () { mo(sv || s); veNganTep(); }); }); });
      } }, h("span", { text: "+ Đoạn mã mới" })));
      nganTep.appendChild(h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;padding:6px 4px" },
        h("button", { class: "btn btn-sm", type: "button", onclick: xuatTatCa }, ic("dl"), "Xuất tất cả (.json)"),
        h("button", { class: "btn btn-sm", type: "button", onclick: nhapDs }, ic("ul"), "Nhập…"),
        h("button", { class: "btn btn-sm", type: "button", onclick: hopNoiLuu }, ic("grid"), "Nơi lưu & đồng bộ…")));
      nganTep.appendChild(chan);
      capNhatChanTep();
    }
    function capNhatChanTep() {
      var c = D.$("#ide-chan", nganTep); if (!c) return;
      var st = sync ? { s: sync.status, e: sync.lastError } : null;
      c.textContent = !sync ? "Đoạn mã lưu trên máy này" + (luu.luuDuoc() ? "" : " (trình duyệt đang chặn lưu — mất khi đóng trang)") + "."
        : !dongBoNoi() ? "Chưa kết nối không gian đồng bộ." : st.s === "error" ? "Lỗi đồng bộ: " + st.e : st.s === "offline" ? "Mất mạng — sẽ đồng bộ lại sau." : st.s === "syncing" ? "Đang đồng bộ…" : "Đã đồng bộ với máy chủ (" + (ide().luuTru || {}).backend + ").";
    }
    function xuatTatCa() {
      Promise.resolve(lib.exportJson()).then(function (j) { D.tai("doan-ma-ide-" + new Date().toISOString().slice(0, 10) + ".json", j, "application/json"); });
    }
    function nhapDs() {
      var inp = h("input", { type: "file", accept: ".json,.c,.cpp,.cc,.h,.hpp,.java,.py,.js,.txt", multiple: true, style: "display:none" });
      inp.addEventListener("change", function () {
        var fs = Array.prototype.slice.call(inp.files || []); inp.remove();
        Promise.all(fs.map(function (f) { return f.text().then(function (t) { return { ten: f.name, t: t }; }); })).then(function (rs) {
          var js = rs.filter(function (r) { return /\.json$/i.test(r.ten); }), tep = rs.filter(function (r) { return !/\.json$/i.test(r.ten); });
          var p = Promise.resolve();
          js.forEach(function (r) { p = p.then(function () { return lib.importJson(r.t, { mode: "merge" }); }).then(function (kq) { D.toast("Đã khôi phục " + (kq && kq.imported != null ? kq.imported + " đoạn mã" : "từ bản sao lưu"), "ok"); }); });
          tep.forEach(function (r) {
            p = p.then(function () {
              var ng = CS.langs.byFilename(r.ten); if (NGON.indexOf(ng) < 0) { D.toast("Bỏ qua " + r.ten + " (ngôn ngữ chưa hỗ trợ ở đây)", "bad"); return null; }
              var it = moi(ng, [r.ten, r.t, ""], tenMoi(dsCache, r.ten)); return lib.put(it);
            });
          });
          return p.then(napDs).then(veNganTep);
        }).catch(function (e) { D.toast("Không nhập được: " + (e && e.message || e), "bad"); });
      });
      document.body.appendChild(inp); inp.click();
    }
    nutTep.addEventListener("click", function () { var mo2 = nganTep.hidden; nganTep.hidden = !mo2; nganMau.hidden = true; nutMau.setAttribute("aria-expanded", "false"); nutTep.setAttribute("aria-expanded", String(mo2)); if (mo2) napDs().then(veNganTep); });
    nutMau.addEventListener("click", function () {
      var mo2 = nganMau.hidden; nganMau.hidden = !mo2; nganTep.hidden = true; nutTep.setAttribute("aria-expanded", "false"); nutMau.setAttribute("aria-expanded", String(mo2));
      if (!mo2) return;
      nganMau.replaceChildren();
      (MAU[cur.language] || []).forEach(function (m) {
        nganMau.appendChild(h("button", { class: "muc", type: "button", onclick: function () {
          var xong = function () { datMa(cur, m[1]); ed.dat(m[1]); stdinTa.value = m[2]; cur.meta.stdin = m[2]; luuNgay(); nganMau.hidden = true; nutMau.setAttribute("aria-expanded", "false"); };
          var thayDoi = !laMau(cur.language, maCua(cur)) && maCua(cur).trim();
          if (thayDoi) D.hoi({ tieuDe: "Thay bằng mẫu?", noiDung: "Mã hiện tại sẽ bị thay (nên “Nhân đôi” đoạn mã trước nếu muốn giữ).", nutChinh: "Thay bằng mẫu" }).then(function (ok) { if (ok) xong(); }); else xong();
        } }, h("span", { text: m[0] })));
      });
    });
    nutDD.addEventListener("click", dinhDang);
    nutTai.addEventListener("click", function () { var ext = (CS.langs.get(cur.language).exts[0] || "txt"); D.tai((cur.name.replace(/[^\w\-. ]+/g, "_").trim() || "main") + "." + ext, ed.lay()); });
    nutChep.addEventListener("click", function () { D.chep(ed.lay()).then(function (ok) { D.toast(ok ? "Đã chép mã" : "Không chép được", ok ? "ok" : "bad"); }); });
    inTen.addEventListener("input", function () { if (!cur) return; cur.name = inTen.value.trim() || "Không tên"; henLuu(); });
    stdinTa.addEventListener("input", function () { if (!cur) return; cur.meta.stdin = stdinTa.value; henLuu(); });
    selNgon.addEventListener("change", function () { chuyenNgon(selNgon.value); });
    selChuan.addEventListener("change", function () { cur.meta.std = selChuan.value; henLuu(); });
    selO.addEventListener("change", function () { cur.meta.opt = selO.value; henLuu(); });
    selHan.addEventListener("change", function () { cur.meta.han = +selHan.value; ghiIde({ han: +selHan.value }); henLuu(); });
    selNoi.addEventListener("change", function () { var m = Object.assign({}, ide().noiChay); m[cur.language] = selNoi.value; ghiIde({ noiChay: m }); veNoiChay(); });
    selFmt.addEventListener("change", function () { var d = Object.assign({}, ide().dinhDang), p = Object.assign({}, d.provider); p[cur.language] = selFmt.value; d.provider = p; ghiIde({ dinhDang: d }); });

    /* ----- cài đặt + nơi lưu ----- */
    function hopCaiDat() {
      var d = ide().dinhDang || {};
      function chon(nhan, gt, ds, fn) {
        var s = h("select", { "aria-label": nhan, style: "max-width:100%" }, ds.map(function (o) { return h("option", { value: String(o[0]), text: o[1] }); }));
        s.value = String(gt); s.addEventListener("change", function () { fn(s.value); });
        return h("label", { style: "display:grid;gap:4px;font-weight:600;font-size:.9rem" }, nhan, s);
      }
      var piston = h("input", { type: "text", "aria-label": "URL Piston của bạn", placeholder: "http://localhost:2000/api/v2", value: ide().pistonUrl || "", style: "width:100%" });
      piston.addEventListener("change", function () { ghiIde({ pistonUrl: piston.value.trim().replace(/\/+$/, "") }); veNoiChay(); });
      var khoa = h("input", { type: "password", "aria-label": "Khoá quản trị", autocomplete: "off", placeholder: "chỉ cần cho “Máy chủ cục bộ”", style: "width:100%" });
      try { khoa.value = root.sessionStorage.getItem("th2:adminKey") || ""; } catch (e) { /* bỏ qua */ }
      khoa.addEventListener("change", function () { try { if (khoa.value) root.sessionStorage.setItem("th2:adminKey", khoa.value); else root.sessionStorage.removeItem("th2:adminKey"); } catch (e) { D.toast("Trình duyệt chặn lưu tạm — khoá chỉ dùng trong phiên này", "bad"); } });
      var ngatDong = h("input", { type: "checkbox" }); ngatDong.checked = !!ui.cai().ngatDong;
      ngatDong.addEventListener("change", function () { ui.ghiCai({ ngatDong: ngatDong.checked }); ed.tuyChon({ wrap: ngatDong.checked }); });
      var giu = h("input", { type: "checkbox" }); giu.checked = d.giuMotDong !== false;
      giu.addEventListener("change", function () { var x = Object.assign({}, ide().dinhDang); x.giuMotDong = giu.checked; ghiIde({ dinhDang: x }); });
      var nd = h("div", { style: "display:grid;gap:12px" },
        h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px" },
          chon("Cỡ chữ", ui.cai().coChu || 14, [10, 11, 12, 13, 14, 15, 16, 18, 20, 22].map(function (n) { return [n, n + " px"]; }), function (v) { ui.ghiCai({ coChu: +v }); ed.tuyChon({ fontSize: +v }); }),
          chon("Kiểu ngoặc nhọn", d.braces || "kr", [["kr", "K&R — { cùng dòng"], ["allman", "Allman — { xuống dòng"]], function (v) { var x = Object.assign({}, ide().dinhDang); x.braces = v; ghiIde({ dinhDang: x }); }),
          chon("Con trỏ (C/C++)", d.pointer || "auto", [["auto", "Tự suy theo mã"], ["right", "int *p"], ["left", "int* p"]], function (v) { var x = Object.assign({}, ide().dinhDang); x.pointer = v; ghiIde({ dinhDang: x }); }),
          chon("Kiểu clang-format", d.clangStyle || "Google", ["Google", "LLVM", "Chromium", "Mozilla", "WebKit", "Microsoft", "GNU"].map(function (x) { return [x, x]; }), function (v) { var x = Object.assign({}, ide().dinhDang); x.clangStyle = v; ghiIde({ dinhDang: x }); })),
        h("label", { style: "display:flex;gap:8px;align-items:center" }, ngatDong, "Ngắt dòng mềm (Alt+Z)"),
        h("label", { style: "display:flex;gap:8px;align-items:center" }, giu, "Giữ các dòng gọn một dòng khi định dạng (hàm/vòng lặp ngắn)"),
        h("label", { style: "display:grid;gap:4px;font-weight:600;font-size:.9rem" }, "Piston của bạn (gọi thẳng từ trình duyệt, cần CORS)", piston),
        h("label", { style: "display:grid;gap:4px;font-weight:600;font-size:.9rem" }, "Khoá quản trị (lưu tạm trong phiên, chỉ gửi tới máy chủ của trang)", khoa),
        h("p", { class: "mut", style: "font-size:.88rem;margin:0", text: HAS_API ? "Máy chủ: " + (servers.length ? servers.map(function (s) { return s.label + (s.available ? "" : " (không dùng được)"); }).join(", ") : "đang tải danh sách…") : "Trang đang mở không qua backend nên không có nơi chạy “Máy chủ” — vẫn dùng được chạy trong trình duyệt và Piston của bạn." }),
        h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
          h("button", { type: "button", class: "btn btn-sm", onclick: function () { napMayChu().then(function () { D.toast("Đã tải lại danh sách nơi chạy", "ok"); }); } }, "Tải lại danh sách nơi chạy"),
          h("button", { type: "button", class: "btn btn-sm", onclick: hopNoiLuu }, "Nơi lưu & đồng bộ…")));
      return hop("Cài đặt IDE", nd, [{ ten: "Xong", gt: true, chinh: true }]).then(function () { veNoiChay(); veDinhDang(); });
    }
    nutCai.addEventListener("click", hopCaiDat);

    function khoiTaoDongBo() {
      if (sync && sync.dispose) sync.dispose();
      sync = null;
      var lt = ide().luuTru || {};
      if (lt.mode !== "server" || !HAS_API || !CS.store || !CS.store.sync) return Promise.resolve();
      sync = CS.store.sync({ library: lib, kv: kv, fetch: root.fetch.bind(root), apiBase: API, backend: lt.backend || "json" });
      if (sync.onStatus) sync.onStatus(capNhatChanTep);
      return Promise.resolve(sync.ready || null).then(function () { if (dongBoNoi()) khoiDongBo(); });
    }
    /* chờ khởi động xong (kho + đồng bộ đã dựng) rồi mới mở hộp — bấm quá sớm thì hai bộ đồng bộ đè nhau */
    function hopNoiLuu() { return (san || Promise.resolve()).then(hopNoiLuuThat); }
    function hopNoiLuuThat() {
      if (!HAS_API) return hop("Nơi lưu đoạn mã", h("div", {}, h("p", { text: "Trang đang mở trực tiếp (file:// hoặc máy chủ tĩnh), không có máy chủ API — đoạn mã chỉ lưu trên máy này (có trong sao lưu .json ở trang Hướng dẫn)." }), h("p", { class: "mut", text: "Muốn đồng bộ giữa các thiết bị, mở trang qua backend: /webapp/courses/heuristic-practice-2/." })), [{ ten: "Đóng", gt: true, chinh: true }]);
      var lt = ide().luuTru || { mode: "local", backend: "json" };
      var mode = h("select", { "aria-label": "Chế độ lưu", style: "width:100%" }, [h("option", { value: "local", text: "Chỉ trên máy này" }), h("option", { value: "server", text: "Máy này + đồng bộ máy chủ" })]); mode.value = lt.mode || "local";
      var back = h("select", { "aria-label": "Kho máy chủ", style: "width:100%" }, [h("option", { value: "json", text: "JSON (tệp trên máy chủ)" }), h("option", { value: "mysql", text: "MySQL" }), h("option", { value: "mongo", text: "MongoDB" })]); back.value = lt.backend || "json";
      var info = h("p", { class: "mut", style: "font-size:.88rem;margin:0", text: "Đang hỏi máy chủ…" });
      var ws = h("input", { type: "text", "aria-label": "Mã không gian", placeholder: "Mã không gian (cs_…)", spellcheck: "false", style: "width:100%" });
      var kh = h("input", { type: "password", "aria-label": "Khoá bí mật", placeholder: "Khoá bí mật", autocomplete: "off", style: "width:100%" });
      var nd = h("div", { style: "display:grid;gap:10px" },
        h("label", { style: "display:grid;gap:4px;font-weight:600" }, "Chế độ", mode), h("label", { style: "display:grid;gap:4px;font-weight:600" }, "Kho trên máy chủ", back), info,
        h("p", { class: "mut", style: "margin:0", text: dongBoNoi() ? "Đang kết nối không gian " + sync.workspaceId + "." : "Chưa kết nối không gian nào." }),
        h("div", { class: "card", style: "padding:12px" }, h("b", { text: "Kết nối không gian đã có (thiết bị khác)" }), h("div", { style: "display:grid;gap:6px;margin-top:6px" }, ws, kh)),
        h("p", { class: "mut", style: "font-size:.86rem;margin:0", text: "Không có tài khoản: mỗi không gian là cặp mã + khoá bí mật (máy chủ chỉ giữ bản băm). Mất khoá thì không đọc lại được; ai có khoá thì đọc/sửa được." }));
      khoiTaoDongBo().then(function () {
        var p = sync && sync.backends ? sync.backends() : root.fetch(API + "/codestore/backends").then(function (r) { return r.json(); });
        return Promise.resolve(p);
      }).then(function (j) {
        var ds = (j && (j.backends || j)) || [];
        info.textContent = ds.map(function (b) { return b.id + ": " + (b.available ? "dùng được" + (b.persistent === false ? " (tạm — mất khi máy chủ khởi động lại)" : "") : "không dùng được" + (b.reason ? " — " + b.reason : "")); }).join(" · ") || "Máy chủ không có kho nào.";
      }, function () { info.textContent = "Không hỏi được máy chủ (mất mạng?)."; });
      return hop("Nơi lưu & đồng bộ", nd, [{ ten: "Đóng", gt: null }, { ten: "Ngắt kết nối", gt: "ngat", hai: true }, { ten: "Kết nối mã + khoá", gt: "noi" }, { ten: "Tạo không gian mới", gt: "moi", chinh: true }]).then(function (v) {
        var doi = (lt.mode || "local") !== mode.value || (lt.backend || "json") !== back.value;
        ghiIde({ luuTru: { mode: v === "moi" || v === "noi" ? "server" : mode.value, backend: back.value } });
        return (doi || v ? khoiTaoDongBo() : Promise.resolve()).then(function () {
          if (v === "ngat") { if (sync && sync.disconnect) return Promise.resolve(sync.disconnect()).then(function () { ghiIde({ luuTru: { mode: "local", backend: back.value } }); sync = null; D.toast("Đã ngắt — đoạn mã vẫn còn trên máy này"); }); return null; }
          if (!sync) { if (v === "moi" || v === "noi") D.toast("Chưa bật được đồng bộ (thiếu mô-đun hoặc máy chủ)", "bad"); return null; }
          if (v === "moi") return Promise.resolve(sync.createWorkspace()).then(function (r) {
            var chu = "Mã không gian: " + r.workspaceId + "\nKhoá bí mật: " + r.key;
            return hop("Đã tạo không gian đồng bộ", h("div", {}, h("p", { text: "Lưu lại cặp mã + khoá để kết nối từ thiết bị khác. Khoá chỉ hiện MỘT lần." }), h("pre", { class: "o-ra", text: chu })), [{ ten: "Chép", gt: "chep" }, { ten: "Đã lưu", gt: true, chinh: true }]).then(function (x) { if (x === "chep") D.chep(chu); return sync.syncNow(); });
          });
          if (v === "noi") { if (!ws.value.trim() || !kh.value) { D.toast("Nhập đủ mã không gian và khoá", "bad"); return null; } return Promise.resolve(sync.connect(ws.value.trim(), kh.value)).then(function () { return sync.syncNow(); }).then(function () { D.toast("Đã kết nối và đồng bộ", "ok"); }); }
          return null;
        }).catch(function (e) { D.toast("Đồng bộ lỗi: " + (e && e.message || e), "bad"); }).then(function () { capNhatChanTep(); return napDs(); }).then(function () { if (!nganTep.hidden) veNganTep(); });
      });
    }

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
    nutDung.addEventListener("click", function () { cpphuy = true; if (huyHien) huyHien(); if (jsRun) { jsRun.dung(); jsRun = null; } if (TH.cpp) TH.cpp.huy(); if (runHandle) { runHandle.cancel(); runHandle = null; } datBan(false); outEl.textContent += "\n— đã dừng —"; });

    function chayJs() {
      if (!jsRun) jsRun = TH.chayJs.taoTrinhChay();
      noiTT("Đang chạy JavaScript…");
      jsRun.chay(maCua(cur), cur.meta.stdin || "", han()).then(function (r) {
        datBan(false);
        tin = { bienDich: null, wasm: null, chay: r.ms, code: r.ok ? 0 : 1, outBytes: (r.text || "").length, noi: "Trong trình duyệt (Web Worker)" };
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
          ma: maCua(cur), ngon: cur.language, chuan: cur.meta.std, toiUu: cur.meta.opt,
          tienDo: function (p) {
            if (p.loai === "tai") noiTT("Đang tải trình biên dịch… " + p.pct + "% (" + Math.round(p.da / 1048576) + "/" + Math.round(p.tong / 1048576) + " MB)", p.pct);
            else if (p.loai === "cache") noiTT("Nạp trình biên dịch từ bộ nhớ máy…");
            else if (p.loai === "bat-dau") noiTT("Đang biên dịch…");
            else if (p.loai === "giay") noiTT("Đang biên dịch… " + p.giay + " giây (lần đầu lâu hơn vì nạp bộ biên dịch)");
          }
        }).then(function (kq) {
          if (cpphuy || huy) return;
          chuanDoan = kq.chuanDoan; tin = { bienDich: performance.now() - t0, wasm: kq.wasm ? kq.wasm.length : 0, chay: null, code: null, outBytes: 0, noi: "Trong trình duyệt (Clang → WebAssembly)" };
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
          var chayX = TH.cpp.batDauChay(kq.wasm, cur.meta.stdin || "", {
            hanMs: han(),
            khiOut: function (s) { if (outEl.textContent.length < 400000) outEl.textContent += s; },
            khiErr: function (s) { errEl.hidden = false; if (errEl.textContent.length < 200000) errEl.textContent += s; }
          });
          huyHien = chayX.dung;
          chayX.xong.then(function (r) {
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
    function chayMayChu(tgt) {
      if (!CS.runner) { datBan(false); D.toast("Thiếu mô-đun chạy trực tuyến", "bad"); return; }
      var path = cur.files[0] ? cur.files[0].path : tepCua(cur.language), nhan = tgt.label || tgt.id;
      var khoa = ""; try { khoa = root.sessionStorage.getItem("th2:adminKey") || ""; } catch (e) { khoa = ""; }
      var req = { target: tgt.id, language: cur.language, files: [{ name: path, content: maCua(cur) }], mainFile: path, stdin: cur.meta.stdin || "", args: [], std: cur.meta.std || "", opt: cur.meta.opt || "O2",
        compileArgs: CS.project.compileFlags({ language: cur.language, meta: { std: cur.meta.std, opt: cur.meta.opt } }).flags, runTimeoutMs: Math.min(han(), 15000) };
      noiTT("Đang gửi tới " + nhan + "…");
      outEl.textContent = ""; errEl.textContent = ""; errEl.hidden = true; chonTab("ra");
      cpphuy = false;
      var t0 = performance.now();
      runHandle = CS.runner.run(req, {
        apiBase: API, fetch: root.fetch.bind(root), pistonUrl: ide().pistonUrl || "", adminKey: khoa,
        confirmDownload: function () { return Promise.resolve(true); },
        onProgress: function (e) { if (e && e.message && !cpphuy) noiTT(e.message); }
      });
      runHandle.promise.then(function (res) {
        runHandle = null;
        if (cpphuy || huy) return;
        datBan(false);
        var c = res.compile, x = res.run || {};
        tin = { bienDich: c && c.ran ? (c.ms || 0) : null, wasm: null, chay: x.ran === false ? null : x.ms, code: x.code, outBytes: (x.stdout || "").length,
          noi: "Máy chủ · " + (res.provider || tgt.id) + (res.version ? " " + res.version : "") + " (" + Math.round(performance.now() - t0) + " ms cả đường truyền)" };
        chuanDoan = (res.diagnostics || []).map(function (d) { return { dong: d.line, cot: d.col, loai: d.severity, msg: d.message }; });
        ed.danhDauLoi(chuanDoan.filter(function (d) { return d.dong > 0 && d.loai === "error"; }));
        if (c && c.ran && !c.ok) {
          outEl.textContent = ((c.stdout || "") + (c.stderr || "")).trim() || "Biên dịch thất bại.";
          chonTab(chuanDoan.length ? "bd" : "ra");
          var d0 = chuanDoan.filter(function (d) { return d.loai === "error" && d.dong; })[0]; if (d0) ed.nhayToi(d0.dong, d0.cot);
          return;
        }
        var ghi = res.ok ? "xong, " + Math.round(x.ms || 0) + " ms" : (res.error && res.error.message) || "lỗi lúc chạy";
        var canhBao = (c && c.stderr ? c.stderr : "") + (res.warnings || []).map(function (s) { return "ℹ " + s; }).join("\n");
        hienKetQua(x.stdout || "", (x.stderr || "") + (canhBao && !x.stderr ? canhBao : ""), (x.truncated ? "đầu ra bị cắt ở 1 MiB · " : "") + ghi);
      }, function (e) {
        runHandle = null;
        if (cpphuy || huy) return;
        datBan(false);
        outEl.textContent = (e && e.message) || "Không chạy được.";
        if (e && e.code === "admin_required") outEl.textContent += "\nĐặt khoá quản trị ở Cài đặt (chỉ cần cho “Máy chủ cục bộ”).";
        chonTab("ra");
      });
    }
    function chay() {
      if (busy || !cur) return;
      var tgt = noiHienTai(cur.language);
      if (!tgt) { D.toast("Chưa có nơi chạy cho " + TEN_NGON[cur.language] + ": mở trang qua backend hoặc đặt URL Piston ở Cài đặt", "bad"); return; }
      if (tgt.available === false) { D.toast(tgt.reason || "Nơi chạy này đang không dùng được — chọn nơi khác", "bad"); return; }
      cur.meta.stdin = stdinTa.value; luuNgay();
      datBan(true); chuanDoan = []; ed.danhDauLoi([]); huyHien = null;
      if (tgt.id === "browser") { if (cur.language === "javascript") chayJs(); else chayCpp(); } else chayMayChu(tgt);
    }
    nutChay.addEventListener("click", chay);

    /* ----- khởi tạo: kho → (nhập đoạn mã cũ, đoạn mã từ lab) → mở ----- */
    var kv = kvLuu("ide2/");
    lib = CS.store.library({ kv: kv });
    san = Promise.resolve(lib.ready).then(function () { return chuyenDoanCu(lib); }).then(function () { return napDs(); }).then(function () {
      if (huy) return null;
      var handoff = null;
      try { var raw = root.sessionStorage.getItem("th2:ide-handoff"); if (raw) { handoff = JSON.parse(raw); root.sessionStorage.removeItem("th2:ide-handoff"); } } catch (e) { handoff = null; }
      if (handoff && typeof handoff.ma === "string") {
        var ng = handoff.ngon === "cpp" ? "cpp" : "javascript";
        var s0 = moi(ng, [tenMoi(dsCache, String(handoff.ten || "Từ lab").slice(0, 60)), handoff.ma, String(handoff.stdin || "")]);
        return lib.put(s0).then(function (sv) { return napDs().then(function () { return sv || s0; }); });
      }
      var hien = dsCache.filter(function (x) { return x.id === ide().hien; })[0];
      if (hien) return hien;
      if (dsCache.length) return dsCache[0];
      var m0 = moi("cpp");
      return lib.put(m0).then(function (sv) { return napDs().then(function () { return sv || m0; }); });
    }).then(function (it) { if (it && !huy) { mo(it); } }).then(khoiTaoDongBo).then(napMayChu).catch(function (e) {
      D.toast("Không mở được kho đoạn mã: " + (e && e.message || e), "bad");
    });
    chonTab("ra");

    return function () {
      huy = true;
      luuNgay();
      if (huyHien) huyHien();
      if (jsRun) { jsRun.dung(); jsRun = null; }
      if (runHandle) { runHandle.cancel(); runHandle = null; }
      if (TH.cpp && busy) TH.cpp.huy();
      if (sync && sync.dispose) sync.dispose();
    };
  });
})(window);
