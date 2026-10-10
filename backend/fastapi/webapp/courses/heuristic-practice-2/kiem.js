/* kiem.js — kiểm các module THUẦN của trang Thực hành Heuristic bằng node (không cần trình duyệt).

       node kiem.js            module lõi + toàn bộ nội dung (data/*.js)
       node kiem.js --loi      chỉ module lõi (nhanh)
       node kiem.js --cpp      thêm: biên dịch lời giải C++ bằng g++ trên máy và chấm (cần g++ trong PATH)
       node kiem.js --bai=bai-05-greedy,bai-06-gia-mo [--cpp]   chỉ kiểm các bài này (khi đang soạn)

   Kiểm nội dung: mọi tệp data/<id>.js đúng lược đồ; mọi câu trắc nghiệm hợp lệ; mọi lab có lời giải JS tham chiếu
   chạy qua ĐÚNG bộ chấm của trang và đạt mức cao nhất, còn khung khởi đầu thì không được đạt (lab không được "tự qua"). */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const GOC = __dirname;
const C = (p) => path.join(GOC, "assets", "core", p);
const TI = require(C("tien-ich.js"));
const MK = require(C("markup.js"));
const LUU = require(C("luu.js"));
const TN = require(C("trac-nghiem.js"));
const VD = require(C("vande.js"));
const CJ = require(C("chay-js.js"));
const CH = require(C("cham.js"));
const BAI = require(C("bai.js"));

const chiLoi = process.argv.includes("--loi");
const coCpp = process.argv.includes("--cpp");
const locArg = (process.argv.find((a) => a.indexOf("--bai=") === 0) || "").slice(6);
const locBai = locArg ? locArg.split(",") : null;              /* --bai=id1,id2: chỉ kiểm các bài này */
const dangSoan = process.argv.includes("--dang-soan") || !!locBai;
const loc = (id) => !locBai || locBai.indexOf(id) >= 0;

let hong = 0, dat = 0;
function kiem(ten, dk, chiTiet) {
  if (dk) { dat++; console.log("  [ok]  " + ten); }
  else { hong++; console.log("  [SAI] " + ten + (chiTiet ? "\n         → " + chiTiet : "")); }
}
function nhom(t) { console.log("\n" + t); }

/* ---------------------------------------------------------------- tiện ích */
nhom("tien-ich");
{
  kiem("so: nhóm nghìn bằng khoảng trắng không ngắt, dấu phẩy thập phân", TI.so(61420) === "61 420" && TI.so(0.5) === "0,5" && TI.so(-1234.5, 1) === "−1 234,5");
  kiem("so: không số/NaN → gạch", TI.so(NaN) === "—" && TI.so(undefined) === "—");
  kiem("docSo: dấu phẩy Việt, nghìn kiểu Mỹ, khoảng trắng, dấu trừ Unicode",
    TI.docSo("0,5") === 0.5 && TI.docSo("1,234.5") === 1234.5 && TI.docSo("1 234") === 1234 && TI.docSo("−3") === -3 && isNaN(TI.docSo("abc")) && isNaN(TI.docSo("")));
  const a = TI.rng(42), b = TI.rng(42), c = TI.rng(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  kiem("rng: cùng seed cùng dãy, khác seed khác dãy, nằm trong [0,1)", sa.join() === sb.join() && c() !== sa[0] && sa.every((x) => x >= 0 && x < 1));
  const r = TI.rng(7); let ok = true;
  for (let i = 0; i < 2000; i++) { const x = r.khoang(3, 5); if (x < 3 || x > 5 || x !== Math.floor(x)) ok = false; }
  kiem("rng.khoang(3,5): luôn nguyên trong [3,5]", ok);
  const t = TI.tron([1, 2, 3, 4, 5, 6], TI.rng(1));
  kiem("tron: là hoán vị của mảng gốc", t.slice().sort().join() === "1,2,3,4,5,6");
  kiem("thống kê: trung bình, độ lệch chuẩn mẫu (n−1), SE = σ/√N",
    TI.trungBinh([2, 4, 6]) === 4 && Math.abs(TI.doLech([2, 4, 6]) - 2) < 1e-12 && Math.abs(TI.saiSoChuan([2, 4, 6]) - 2 / Math.sqrt(3)) < 1e-12);
}

/* ---------------------------------------------------------------- markup */
nhom("markup");
{
  const h = (s) => MK.html(s);
  kiem("thoát HTML: <script> không bao giờ thành thẻ", !/<script/i.test(h("<script>alert(1)</script> **b**")) && /&lt;script&gt;/.test(h("<script>x</script>")));
  kiem("mã trong dòng được bảo vệ khỏi in đậm/nghiêng", h("`a*b*c` và **đậm**") === "<p><code>a*b*c</code> và <b>đậm</b></p>");
  kiem("liên kết javascript: bị bỏ, liên kết thường giữ", !/href="javascript/i.test(h("[x](javascript:alert(1))")) && /<a href="#\/bai\/x">/.test(h("[x](#/bai/x)")));
  kiem("liên kết ngoài mở tab mới có noopener", /target="_blank" rel="noopener noreferrer"/.test(h("[g](https://example.com)")));
  kiem("khối mã giữ nguyên ký tự đặc biệt", /<pre class="ma" data-ngon="cpp"><code>a &lt; b &amp;&amp; c<\/code><\/pre>/.test(h("```cpp\na < b && c\n```")));
  kiem("danh sách đánh số và không đánh số", /<ul><li>a<\/li><li>b<\/li><\/ul>/.test(h("- a\n- b")) && /<ol><li>x<\/li><li>y<\/li><\/ol>/.test(h("1. x\n2. y")));
  kiem("danh sách lồng nhau", /<ul><li>a<ul><li>b<\/li><\/ul><\/li><\/ul>/.test(h("- a\n  - b")));
  const bang = h("| A | B |\n|---|--:|\n| 1 | 2 |");
  kiem("bảng có đầu bảng, căn phải", /<th class="a-l">A<\/th><th class="a-r">B<\/th>/.test(bang) && /<td class="a-r">2<\/td>/.test(bang));
  kiem("trích dẫn có phân loại theo biểu tượng", /class="cal cal-warn"/.test(h("> ⚠️ cẩn thận")) && /class="cal cal-key"/.test(h("> 📌 nhớ")));
  kiem("đoạn gộp dòng; hai khoảng trắng cuối dòng là xuống dòng", h("a\nb") === "<p>a b</p>" && /a<br>b/.test(h("a  \nb")));
}

/* ---------------------------------------------------------------- kho lưu */
nhom("luu");
{
  let t = 1000;
  const mem = {}; const kho = { length: 0, key: () => null, getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  const L = LUU.tao(kho, { dongHo: () => t });
  L.ghi("trac/b1", { tot: 3 });
  kiem("ghi rồi đọc lại; có mặt trong kho thật", L.doc("trac/b1").tot === 3 && JSON.parse(mem["th2:trac/b1"]).v.tot === 3);
  kiem("đọc khoá không có → mặc định", L.doc("khong/co", "mac-dinh") === "mac-dinh");
  const hong2 = { setItem() { throw new Error("blocked"); }, getItem() { throw new Error("blocked"); }, removeItem() {}, length: 0, key: () => null };
  const L2 = LUU.tao(hong2);
  L2.ghi("a", 1);
  kiem("storage bị chặn: vẫn ghi/đọc được trong bộ nhớ, báo luuDuoc()=false", L2.doc("a") === 1 && L2.luuDuoc() === false);
  const goi = L.xuat();
  t = 2000; L.ghi("trac/b1", { tot: 5 });
  const L3 = LUU.tao({ length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }, { dongHo: () => 3000 });
  L3.ghi("trac/b1", { tot: 4 });
  const kq = L3.nhap(L.xuat());
  kiem("nhập sao lưu: bản mới hơn thắng, không xoá gì", L3.doc("trac/b1").tot === 4 && kq.giu === 1 && goi.loai === "heuristic-thuc-hanh-2");
  let loi = false; try { L3.nhap({ loai: "khac" }); } catch (e) { loi = true; }
  kiem("nhập tệp sai định dạng → ném lỗi", loi);
  const kq2 = LUU.tao(null).nhap({ loai: "heuristic-thuc-hanh-2", du: { "<b>x": { t: 1, v: 1 }, "ok/1": { t: 1, v: 2 } } });
  kiem("nhập bỏ qua khoá có ký tự lạ", kq2.them === 1);
}

/* ---------------------------------------------------------------- trắc nghiệm */
nhom("trac-nghiem");
{
  const mot = { id: "q", loai: "mot", hoi: "Câu hỏi có đủ dài không?", chon: ["a", "b", "c"], dung: 1, giaiThich: "Vì b đúng, a và c sai vì lý do rõ ràng." };
  kiem("lược đồ: câu hợp lệ không báo lỗi", TN.kiemLuoc(mot).length === 0, TN.kiemLuoc(mot).join("; "));
  kiem("lược đồ: bắt `tất cả các đáp án trên`", TN.kiemLuoc(Object.assign({}, mot, { chon: ["a", "b", "Tất cả các đáp án trên"] })).length > 0);
  kiem("lược đồ: bắt đáp án nằm ngoài khoảng và thiếu giải thích", TN.kiemLuoc(Object.assign({}, mot, { dung: 7 })).length > 0 && TN.kiemLuoc(Object.assign({}, mot, { giaiThich: "" })).length > 0);
  kiem("lược đồ: câu nhiều đáp án phải có ít hơn số lựa chọn", TN.kiemLuoc({ id: "q", loai: "nhieu", hoi: "Chọn những ý đúng nhé?", chon: ["a", "b", "c", "d"], dung: [0, 1, 2, 3], giaiThich: "x".repeat(30) }).length > 0);
  kiem("chấm một đáp án", TN.cham(mot, 1).dung && !TN.cham(mot, 0).dung && !TN.cham(mot, null).daTraLoi);
  const nhieu = { id: "n", loai: "nhieu", hoi: "Chọn mọi ý đúng nhé?", chon: ["a", "b", "c", "d"], dung: [0, 2], giaiThich: "x".repeat(30) };
  kiem("chấm nhiều đáp án: đủ và đúng mới đúng", TN.cham(nhieu, [2, 0]).dung && !TN.cham(nhieu, [0]).dung && !TN.cham(nhieu, [0, 1, 2]).dung && !TN.cham(nhieu, []).daTraLoi);
  const so = { id: "s", loai: "so", hoi: "Tính giá trị biểu thức đó?", dapAn: 1.5, saiSo: 0.01, giaiThich: "x".repeat(30) };
  kiem("chấm số: dấu phẩy Việt, sai số", TN.cham(so, "1,5").dung && TN.cham(so, "1.505").dung && !TN.cham(so, "1.6").dung && !TN.cham(so, "abc").daTraLoi);
  const th = TN.thuTu(mot, 1), th2 = TN.thuTu(mot, 1);
  kiem("xáo đáp án: tất định theo (id, seed), là hoán vị", th.join() === th2.join() && th.slice().sort().join() === "0,1,2");
  kiem("tổng kết & xếp loại", TN.tongKet([{ id: "a" }, { id: "b" }], { a: true, b: false }).tyLe === 0.5 && TN.xepLoai(0.95) === "Xuất sắc" && TN.xepLoai(0.2) === "Cần đọc lại bài");
}

/* ---------------------------------------------------------------- bài toán */
nhom("vande · tui (P0)");
{
  const i1 = VD.tui.sinh(5, { n: 30 }), i2 = VD.tui.sinh(5, { n: 30 });
  kiem("sinh tất định theo seed", JSON.stringify(i1) === JSON.stringify(i2) && i1.n === 30 && i1.B >= Math.max(...i1.w));
  kiem("viet: dòng đầu `n B`, đủ n dòng", VD.tui.viet(i1).split("\n")[0] === i1.n + " " + i1.B && VD.tui.viet(i1).trim().split("\n").length === i1.n + 1);
  kiem("cham: lời giải rỗng `0` hợp lệ, điểm 0", VD.tui.cham(i1, "0\n").ok && VD.tui.cham(i1, "0\n").diem === 0);
  kiem("cham: bắt vượt sức chứa", !VD.tui.cham(i1, i1.n + "\n" + i1.w.map((_, i) => i + 1).join(" ")).ok);
  kiem("cham: bắt chọn trùng, chỉ số ngoài khoảng, thiếu số, chữ lạ",
    !VD.tui.cham(i1, "2\n1 1").ok && !VD.tui.cham(i1, "1\n99").ok && !VD.tui.cham(i1, "3\n1 2").ok && !VD.tui.cham(i1, "xin chao").ok && !VD.tui.cham(i1, "").ok);
  let tot = true, msg = "";
  [1, 2, 3, 4, 5, 6, 7, 8].forEach((s) => {
    ["ngau-nhien", "tuong-quan", "deu"].forEach((kieu) => {
      const inst = VD.tui.sinh(s, { n: 40, kieu });
      const d = {}; Object.keys(VD.tui.thamChieu).forEach((k) => { d[k] = VD.tui.cham(inst, VD.tui.thamChieu[k](inst)); });
      Object.keys(d).forEach((k) => { if (!d[k].ok) { tot = false; msg = k + " " + d[k].loi; } });
      const opt = VD.tui.diemToiUu(inst), ub = VD.tui.canTrenPhanSo(inst);
      if (!(d.toiUu.diem === opt && d.tiSo.diem <= opt && d.giaTri.diem <= opt && opt <= ub + 1e-9)) { tot = false; msg = "thứ tự điểm sai ở seed " + s + " " + kieu + ": " + [d.giaTri.diem, d.tiSo.diem, opt, ub].join(" ≤ "); }
    });
  });
  kiem("mọi tham chiếu hợp lệ; giá trị, tỉ số ≤ tối ưu (DP) ≤ cận phân số", tot, msg);
}
nhom("vande · ship1 (P1)");
{
  const inst = VD.ship1.sinh(3, { n: 60 });
  kiem("sinh: 60 đơn trong lưới 100×100, kho (50,50), T=480", inst.n === 60 && inst.T === 480 && inst.x.every((v) => v >= 0 && v <= 99) && inst.kx === 50);
  kiem("viet: `n T`, `50 50`, rồi n dòng 4 số", VD.ship1.viet(inst).split("\n").slice(0, 2).join("|") === "60 480|50 50" && VD.ship1.viet(inst).trim().split("\n").length === 62);
  kiem("cham: tuyến rỗng hợp lệ điểm 0; một đơn xa nhất vẫn tính đúng", VD.ship1.cham(inst, "0\n").diem === 0);
  const dd = { n: 2, T: 100, kx: 50, ky: 50, x: [60, 90], y: [50, 50], p: [10, 20], s: [5, 5] };
  kiem("cham: thời gian = đi + giao, không quay về (10+5, +30+5 = 50)", VD.ship1.cham(dd, "2\n1 2").ok && VD.ship1.thoiGianTuyen(dd, [0, 1]) === 50);
  const qua = { n: 2, T: 40, kx: 50, ky: 50, x: [60, 90], y: [50, 50], p: [10, 20], s: [5, 5] };
  kiem("cham: vượt giờ không hợp lệ và nói rõ đơn nào", !VD.ship1.cham(qua, "2\n1 2").ok && /thứ 2/.test(VD.ship1.cham(qua, "2\n1 2").loi));
  let ok = true, msg = "", thuTu = true;
  for (let s = 1; s <= 6; s++) {
    [false, true].forEach((cum) => {
      const it = VD.ship1.sinh(s, { n: 60, cum });
      const d = {}; Object.keys(VD.ship1.thamChieu).forEach((k) => { d[k] = VD.ship1.cham(it, VD.ship1.thamChieu[k](it)); if (!d[k].ok) { ok = false; msg = k + ": " + d[k].loi; } });
      if (ok && d.tot.diem < d.tiSo.diem) { thuTu = false; msg = "tot < tiSo ở seed " + s; }
    });
  }
  kiem("mọi lời giải tham chiếu hợp lệ (dữ liệu rải đều và gom cụm)", ok, msg);
  kiem("tham chiếu `tot` không tệ hơn `tiSo` trên mọi test thử", thuTu, msg);
}
nhom("vande · tsp");
{
  const inst = VD.tsp.sinh(9, { n: 12 });
  kiem("cham: hoán vị đúng → độ dài; bắt trùng/thiếu", VD.tsp.cham(inst, inst.x.map((_, i) => i + 1).join(" ")).ok && !VD.tsp.cham(inst, "1 2 3").ok &&
    !VD.tsp.cham(inst, inst.x.map(() => 1).join(" ")).ok);
  let ok = true, msg = "";
  for (let s = 1; s <= 8; s++) {
    const it = VD.tsp.sinh(s, { n: 12 });
    const g = VD.tsp.cham(it, VD.tsp.thamChieu.ganNhat(it)), h = VD.tsp.cham(it, VD.tsp.thamChieu.haiOpt(it)), o = VD.tsp.cham(it, VD.tsp.thamChieu.toiUu(it));
    if (!(g.ok && h.ok && o.ok && h.diem <= g.diem + 1e-9 && o.diem <= h.diem + 1e-9)) { ok = false; msg = "seed " + s + ": " + [g.diem, h.diem, o.diem].join(", "); }
  }
  kiem("tối ưu (Held–Karp) ≤ 2-opt ≤ gần nhất, tất cả hợp lệ", ok, msg);
  const lon = VD.tsp.sinh(2, { n: 60 });
  kiem("n lớn: 2-opt chạy được và hợp lệ", VD.tsp.cham(lon, VD.tsp.thamChieu.haiOpt(lon)).ok);
}
nhom("vande · tuDapAn");
{
  const vd = VD.dangKy("thu-cong", VD.tuDapAn({
    sinh: (seed) => ({ a: seed, b: seed + 1 }), viet: (i) => i.a + " " + i.b + "\n", giai: (i) => [i.a + i.b, [i.a * i.b]], saiSo: 0
  }));
  const it = vd.sinh(3);
  kiem("đáp án đúng qua; sai chỉ rõ chỗ lệch; thiếu giá trị báo lỗi", vd.cham(it, "7 12").ok && /thứ 2/.test(vd.cham(it, "7 13").loi) && !vd.cham(it, "7").ok);
  const f = VD.tuDapAn({ sinh: () => ({}), viet: () => "", giai: () => [0.5], saiSo: 0.01 });
  kiem("sai số cho phép với số thực", f.cham({}, "0.505").ok && !f.cham({}, "0.6").ok);
}

/* ---------------------------------------------------------------- chạy JS + bộ chấm */
nhom("chay-js & cham");
{
  const r = CJ.chayDongBo("const t = readInput().split(/\\s+/).map(Number); print(t[0] + t[1]); log('gỡ lỗi');", "2 3");
  kiem("chayDongBo: print → stdout, log → stderr, đọc stdin", r.ok && r.text === "5\n" && r.err === "gỡ lỗi");
  const e = CJ.chayDongBo("\n\nthrow new Error('hỏng');", "");
  kiem("lỗi lúc chạy: có tên lỗi và số dòng người học", !e.ok && /Error: hỏng/.test(e.loi) && e.dong === 3, JSON.stringify(e));
  const s = CJ.chayDongBo("let x = ;", "");
  kiem("lỗi cú pháp được báo, không ném ra ngoài", !s.ok && /SyntaxError/.test(s.loi));
  const k = CJ.chayDongBo("const r = rng(1); print(r.khoang(1,3) >= 1, typeof now());", "");
  kiem("rng() và now() có sẵn", k.ok && k.text === "true number\n");

  const lab = {
    id: "thu", vanDe: "tui", tham: { n: 30 }, soTest: 6, muc: [{ ten: "Bằng greedy giá trị", so: "giaTri", heSo: 1 }, { ten: "Bằng greedy tỉ số", so: "tiSo", heSo: 1 }]
  };
  const chayJs = (src) => (input) => Promise.resolve(CJ.chayDongBo(src, input));
  const tiSoJs = [
    "const t = readInput().split(/\\s+/).map(Number); const n = t[0], B = t[1], w = [], p = [];",
    "for (let i = 0; i < n; i++) { w.push(t[2 + 2 * i]); p.push(t[3 + 2 * i]); }",
    "const o = w.map((_, i) => i).sort((a, b) => p[b] * w[a] - p[a] * w[b] || a - b); let W = 0; const ds = [];",
    "for (const i of o) if (W + w[i] <= B) { W += w[i]; ds.push(i + 1); } print(ds.length); print(ds.join(' '));"
  ].join("\n");
  return Promise.all([
    CH.chayLab(lab, VD.tui, chayJs(tiSoJs)),
    CH.chayLab(lab, VD.tui, chayJs("print('xin chao')")),
    CH.chayLab(lab, VD.tui, chayJs("print(0); print('');")),
    CH.chayLab(lab, VD.tui, chayJs("throw new Error('x')"))
  ]).then(([a, b, c, d]) => {
    kiem("greedy tỉ số: hợp lệ, đạt mức cao nhất, tỉ lệ so với chính nó = 1", a.hopLe && a.muc === 3 && a.mucToiDa === 3 && Math.abs(a.dsMuc[1].tile - 1) < 1e-9, JSON.stringify([a.muc, a.dsMuc]));
    kiem("kết quả sai định dạng → không hợp lệ, mức 0, có lý do", !b.hopLe && b.muc === 0 && /số nguyên/.test(b.tests[0].loi));
    kiem("chọn rỗng → hợp lệ (mức 1) nhưng không vượt mốc", c.hopLe && c.muc === 1 && !c.dsMuc[0].dat);
    kiem("lỗi chạy chung → dừng sớm, không lặp lại cùng một lỗi sáu lần", !d.hopLe && d.tests.length === 2 && d.tests[0].loiChayMa, "số test đã chạy: " + d.tests.length);
    kiem("chênh lệch có SE và cờ ý nghĩa thống kê", a.chenhLech && a.chenhLech.se >= 0 && typeof a.chenhLech.coYNghia === "boolean");
    return CH.chayLab({ id: "thu2", vanDe: "tsp", tham: { n: 15 }, soTest: 5, muc: [{ ten: "Bằng gần nhất", so: "ganNhat", heSo: 1 }] }, VD.tsp, chayJs(
      "const t = readInput().split(/\\s+/).map(Number); const n = t[0]; print(Array.from({length:n},(_, i) => i + 1).join(' '));"));
  }).then((q) => {
    kiem("bài toán cực tiểu (tsp): thứ tự 1..n hợp lệ nhưng không bằng gần nhất → mức 1", q.hopLe && q.muc === 1 && q.dsMuc[0].tile < 1, JSON.stringify(q.dsMuc));
    return tiepTuc();
  });
}

/* ---------------------------------------------------------------- nội dung */
function tiepTuc() {
  if (chiLoi) return ket();
  nhom("noi dung · data/*.js");
  global.TH.khoa = require(path.join(GOC, "data", "khoa.js"));
  const khoa = global.TH.khoa;
  const dsId = Object.keys(khoa.bai);
  const trongPhan = [].concat(...khoa.phan.map((p) => p.bai));
  kiem("khoa.js: mọi bài thuộc đúng một phần; không bài mồ côi", trongPhan.length === dsId.length && new Set(trongPhan).size === dsId.length && dsId.every((i) => trongPhan.includes(i)));

  const goiGoc = path.join(GOC, "..", "..", "..", "..", "course-content", "heuristic-2.json");
  let bundle = null;
  if (fs.existsSync(goiGoc)) { try { bundle = JSON.parse(fs.readFileSync(goiGoc, "utf8")); } catch (e) { bundle = null; } }
  if (bundle) {
    const slugs = new Set(Object.values(bundle.docs).map((d) => d.slug));
    const mat = dsId.filter((i) => !slugs.has(khoa.bai[i].giang));
    kiem("khoa.js: mọi `giang` là slug có thật trong bundle heuristic-2", !mat.length, mat.join(", "));
  }
  const visual = fs.readdirSync(path.join(GOC, "..", "heuristic-visual-2", "assets")).filter((f) => /^vis-\d/.test(f))
    .map((f) => fs.readFileSync(path.join(GOC, "..", "heuristic-visual-2", "assets", f), "utf8")).join("\n");
  const idVis = new Set([...visual.matchAll(/\bid:\s*"([a-z0-9-]+)",\s*nhom:/g)].map((m) => m[1]));
  const matDemo = [].concat(...dsId.map((i) => khoa.bai[i].demo.filter((d) => !idVis.has(d)).map((d) => i + ":" + d)));
  kiem("khoa.js: mọi `demo` là id có thật ở heuristic-visual-2 (" + idVis.size + " demo)", !matDemo.length, matDemo.join(", "));

  /* Liên kết ngược: cau-hinh.js của trang bài giảng phải ánh xạ đúng mọi bài giảng → bài thực hành (và mô phỏng) này. */
  const cauHinhGiang = path.join(GOC, "..", "heuristic-course-2", "assets", "cau-hinh.js");
  if (fs.existsSync(cauHinhGiang)) {
    const sb = { window: {} };
    require("vm").runInNewContext(fs.readFileSync(cauHinhGiang, "utf8"), sb);
    const lk = (sb.window.CAU_HINH || {}).lienKet;
    kiem("heuristic-course-2/cau-hinh.js khai báo lienKet và nạp mo-lien-ket", Array.isArray(lk) && lk.length >= 2 && (sb.window.CAU_HINH.moDun || []).includes("mo-lien-ket"));
    if (Array.isArray(lk) && lk.length >= 2) {
      const sai = [];
      dsId.forEach((id) => {
        const m = khoa.bai[id];
        let th = lk[0].url(m.giang);
        if (th !== "../heuristic-practice-2/#/bai/" + id) sai.push(id + " → " + JSON.stringify(th));
        const ms = (lk[1].url(m.giang) || []).map((x) => x.href).sort().join();
        if (ms !== m.demo.map((d) => "../heuristic-visual-2/#/" + d).sort().join()) sai.push(id + " mô phỏng: " + ms);
      });
      kiem("liên kết ngược: mọi bài giảng trỏ đúng bài thực hành và mô phỏng của nó (" + dsId.length + " bài)", !sai.length, sai.slice(0, 4).join("; "));
    }
  }

  const dir = path.join(GOC, "data");
  const tep = fs.readdirSync(dir).filter((f) => f !== "khoa.js" && f !== "dem.js" && /\.js$/.test(f)).sort();
  tep.forEach((f) => {
    if (locBai && locBai.indexOf(f.replace(/\.js$/, "")) < 0) return;
    try { require(path.join(dir, f)); } catch (e) { kiem("nạp được data/" + f, false, String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")); }
  });
  const dk = global.TH.bai.kho();
  const thieu = dsId.filter((i) => !dk[i]);
  kiem("đủ " + dsId.length + " bài: " + (dsId.length - thieu.length) + " đã có nội dung" + (thieu.length ? " — còn thiếu: " + thieu.join(", ") : ""), !thieu.length || dangSoan);
  const la = Object.keys(dk).filter((i) => !khoa.bai[i]);
  kiem("không có tệp nội dung mồ côi (id không có trong khoa.js)", !la.length, la.join(", "));

  let tongTrac = 0, tongLuan = 0, tongLab = 0;
  const viec = [];
  Object.keys(dk).sort().filter(loc).forEach((id) => {
    const b = dk[id];
    const lo = BAI.kiemLuocBai(b, khoa.bai[id].loai === "bai" ? {} : { toiThieuTrac: 5, toiThieuLuan: 2 });
    kiem(id + ": lược đồ (" + (b.trac || []).length + " trắc nghiệm, " + (b.luan || []).length + " tự luận, " + (b.lab || []).length + " lab)", !lo.length, lo.slice(0, 6).join("\n           → "));
    tongTrac += (b.trac || []).length; tongLuan += (b.luan || []).length; tongLab += (b.lab || []).length;
    (b.lab || []).forEach((l) => viec.push({ id: id, lab: l }));
  });
  console.log("\n  tổng: " + tongTrac + " trắc nghiệm · " + tongLuan + " tự luận · " + tongLab + " lab");

  /* data/dem.js: số câu/lab mỗi bài để trang chủ hiện chip mà không phải nạp cả 32 tệp nội dung. Sinh bằng --ghi-dem. */
  if (!locBai) {
    const dem = {};
    Object.keys(dk).sort().forEach((id) => { dem[id] = { t: (dk[id].trac || []).length, l: (dk[id].luan || []).length, b: (dk[id].khongLab ? 0 : (dk[id].lab || []).length) }; });
    const noiDung = "/* Sinh tự động bởi `node kiem.js --ghi-dem` — đừng sửa tay. Số câu trắc nghiệm / tự luận / lab của từng bài. */\nTH.dem = " + JSON.stringify(dem) + ";\n";
    const tepDem = path.join(GOC, "data", "dem.js");
    if (process.argv.includes("--ghi-dem")) { fs.writeFileSync(tepDem, noiDung, "utf8"); console.log("  đã ghi data/dem.js (" + Object.keys(dem).length + " bài)"); }
    else if (!dangSoan) kiem("data/dem.js khớp nội dung hiện tại (nếu lệch: node kiem.js --ghi-dem)", fs.existsSync(tepDem) && fs.readFileSync(tepDem, "utf8") === noiDung);
  }

  /* Lời giải tham chiếu JS phải đạt mức cao nhất; khung khởi đầu thì không. */
  nhom("noi dung · lab chạy qua bộ chấm");
  const chay = (src) => (input) => Promise.resolve(CJ.chayDongBo(src, input));
  return viec.reduce((p, v) => p.then(() => {
    const l = v.lab, vd = VD.lay(l.vanDe), ten = v.id + "/" + l.id;
    return CH.chayLab(l, vd, chay(l.loiGiai.js)).then((a) => {
      const mat = a.hopLe ? a.muc === a.mucToiDa : false;
      kiem(ten + ": lời giải JS tham chiếu đạt mức cao nhất (" + a.muc + "/" + a.mucToiDa + ", " + Math.round(a.msLonNhat) + " ms/test)", mat,
        !a.hopLe ? (a.tests.find((k) => !k.ok) || {}).loi : JSON.stringify(a.dsMuc.map((m) => [m.ten, m.tile && m.tile.toFixed(3), m.heSo])));
      return CH.chayLab(l, vd, chay(l.khoiDau.js)).then((b) => {
        kiem(ten + ": khung khởi đầu JS KHÔNG tự qua mức cao nhất", !(b.hopLe && b.muc === b.mucToiDa));
        const bts = (l.bienThe || []).map((_, i) => i).slice(1);
        return bts.reduce((q, bt) => q.then(() => CH.chayLab(l, vd, chay(l.loiGiai.js), { bienThe: bt }).then((c) => {
          kiem(ten + ": lời giải JS hợp lệ ở biến thể “" + l.bienThe[bt].ten + "” (mức " + c.muc + "/" + c.mucToiDa + ")", c.hopLe,
            (c.tests.find((k) => !k.ok) || {}).loi);
        })), Promise.resolve());
      });
    });
  }), Promise.resolve()).then(() => (coCpp ? kiemCpp(viec) : null)).then(ket);
}

/* g++ có sẵn trên máy: biên dịch từng lời giải C++ (-std=c++17, -fno-exceptions như trình biên dịch của trang) và chấm. */
function kiemCpp(viec) {
  nhom("noi dung · C++ bằng g++ trên máy");
  const gpp = spawnSync("g++", ["--version"], { encoding: "utf8" });
  if (gpp.error) { kiem("g++ có trong PATH", false, "không tìm thấy g++"); return null; }
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "th2-"));
  const shim = path.join(tmp, "bits"); fs.mkdirSync(shim);
  return viec.filter((v) => v.lab.loiGiai.cpp).reduce((p, v) => p.then(() => {
    const l = v.lab, vd = VD.lay(l.vanDe), ten = v.id + "/" + l.id, ex = path.join(tmp, v.id + "-" + l.id + ".exe");
    function bien(ma, hau) {
      const src = path.join(tmp, v.id + "-" + l.id + hau + ".cpp"); fs.writeFileSync(src, ma, "utf8");
      const out = path.join(tmp, v.id + "-" + l.id + hau + ".exe");
      const r = spawnSync("g++", ["-std=c++17", "-O2", "-fno-exceptions", "-o", out, src], { encoding: "utf8" });
      return { ok: r.status === 0, out: out, loi: (r.stderr || "").split("\n").slice(0, 6).join("\n") };
    }
    const lg = bien(l.loiGiai.cpp, "");
    if (!lg.ok) { kiem(ten + ": lời giải C++ biên dịch được", false, lg.loi); return null; }
    const chayExe = (exe) => (input) => {
      const t0 = Date.now(), r = spawnSync(exe, [], { input: input, encoding: "utf8", timeout: (l.gioiHanMs || 1500) * 2 });
      return Promise.resolve({ ok: r.status === 0, text: r.stdout || "", err: r.stderr || "", ms: Date.now() - t0, loi: r.status === 0 ? "" : "thoát với mã " + r.status });
    };
    return CH.chayLab(l, vd, chayExe(lg.out)).then((a) => {
      kiem(ten + ": lời giải C++ đạt mức cao nhất (" + a.muc + "/" + a.mucToiDa + ")", a.hopLe && a.muc === a.mucToiDa,
        !a.hopLe ? (a.tests.find((k) => !k.ok) || {}).loi : JSON.stringify(a.dsMuc.map((m) => [m.ten, m.tile && m.tile.toFixed(3)])));
      if (l.khoiDau.cpp) {
        const kd = bien(l.khoiDau.cpp, "-kd");
        kiem(ten + ": khung khởi đầu C++ biên dịch được", kd.ok, kd.loi);
      }
    });
  }), Promise.resolve());
}

function ket() {
  console.log("\n" + "-".repeat(58));
  if (hong) { console.log(hong + " mục SAI, " + dat + " mục đạt.\n"); process.exit(1); }
  console.log("Đạt — " + dat + " mục. Các module lõi" + (chiLoi ? "" : " và nội dung") + " của trang Thực hành hoạt động đúng.\n");
}
