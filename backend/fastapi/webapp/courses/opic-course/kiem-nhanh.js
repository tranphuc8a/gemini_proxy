/* =====================================================================
   kiem-nhanh.js — kiểm logic thuần của khoá OPIc bằng Node, không cần trình duyệt.

       node kiem-nhanh.js

   Nạp bundle backend/course-content/opic.json (đúng thứ API /courses/opic/bundle
   trả về), đổi qua OPICL.tuBundle như trang làm, rồi kiểm:
     - bộ chuyển đổi bundle -> dạng riêng giữ đủ chủ đề, câu hỏi, hướng dẫn, thứ tự
     - dữ liệu đủ trường, id không trùng, chủ đề / dạng hợp lệ
     - bỏ dấu giữ nguyên độ dài; các chế độ che script che đúng chỗ
     - lịch Leitner đi đúng 1·3·7·14·30 ngày
     - đề thi thử: 50 hạt giống × 3 bộ × 3 phạm vi, luôn đủ 15 câu đúng cấu trúc, không trùng
     - tìm kiếm không dấu ra đúng thứ
     - dữ liệu từ MySQL (khoá JSON bị sắp lại) và bundle lạ (định danh mang thẻ)
   Trả exit code 1 nếu có phép kiểm sai — nối vào check.py và CI.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const BUNDLE = path.join(HERE, "..", "..", "..", "..", "course-content", "opic.json");
const L = require(path.join(HERE, "assets", "logic.js"));
const bundle = JSON.parse(fs.readFileSync(BUNDLE, "utf8"));
const D = L.tuBundle(bundle);

let ok = 0, sai = 0;
function kiem(ten, dk, chiTiet) {
  if (dk) { ok++; console.log("  [ok]   " + ten); }
  else { sai++; console.log("  [SAI]  " + ten + (chiTiet ? "  — " + chiTiet : "")); }
}
function tieuDe(t) { console.log("\n" + t); }

/* ---------- bộ chuyển đổi --------------------------------------------- */
tieuDe("Bundle chung -> dạng riêng (OPICL.tuBundle)");
const nhomCd = bundle.nav.find(s => s.id === "chu-de").groups;
kiem("mỗi nhóm của section chu-de thành một chủ đề, giữ thứ tự", D.chuDe.map(c => c.id).join() === nhomCd.map(g => g.short).join());
kiem("chủ đề giữ icon / uuTien / moTa từ meta nhóm",
     D.chuDe.every((c, i) => c.icon === nhomCd[i].meta.icon && c.uuTien === nhomCd[i].meta.uuTien && c.moTa === nhomCd[i].meta.moTa));
kiem("mỗi tài liệu kind=script thành một câu hỏi",
     D.cauHoi.length === Object.values(bundle.docs).filter(d => d.kind === "script").length);
kiem("câu hỏi theo đúng thứ tự trong nhóm",
     D.cauHoi.map(q => q.id).join() === nhomCd.flatMap(g => g.items).join());
const a17 = D.cauHoi.find(q => q.id === "A17");
kiem("A17 giữ câu hỏi EN, dạng, phút, bộ, số hiển thị, chủ đề",
     a17 && /listen to music/.test(a17.en) && a17.dang === "mieu-ta" && a17.phut === 1 && a17.bo === "A" &&
     a17.so === "17" && a17.chuDe === "am-nhac");
const ar11 = D.cauHoi.find(q => q.id === "AR11");
kiem("chỉ dẫn sân khấu giữ nguyên thành một dòng riêng", ar11 && ar11.cau[0] === "(Call 1 – Báo sự cố)" && L.laChiDan(ar11.cau[0]));
kiem("số từ không tính chỉ dẫn sân khấu", ar11.tu === ar11.cau.filter(c => !L.laChiDan(c)).join(" ").split(/\s+/).length);
kiem("hướng dẫn: 10 bài, đúng thứ tự, slug bỏ tiền tố huong-dan/",
     D.huongDan.length === 10 && D.huongDan.every((h, i) => h.thuTu === i + 1) && D.huongDan[0].slug === "tong-quan");
kiem("định nghĩa dạng / bộ lấy từ course.config", Object.keys(D.dang).length === 8 && D.bo.A && D.bo.B);
kiem("thống kê tính lại khớp bundle.stats",
     D.thongKe.cauHoi === bundle.stats.cauHoi && D.thongKe.boA === bundle.stats.boA && D.thongKe.cau === bundle.stats.cau);
kiem("bundle rỗng không làm hỏng trang", (() => { const e = L.tuBundle({}); return e.cauHoi.length === 0 && e.chuDe.length === 0; })());

/* ---------- dữ liệu từ database ---------------------------------------- */
tieuDe("Dữ liệu từ database (MySQL, bundle lạ)");
/* MySQL trả object JSON với khoá đã sắp (theo độ dài rồi theo byte): bộ lọc
   "Dạng" phải theo dangThuTu, không theo thứ tự khoá đến từ database. */
const xao = JSON.parse(JSON.stringify(bundle));
const sapKieuMysql = o => Object.keys(o).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
  .reduce((r, k) => { r[k] = o[k]; return r; }, {});
xao.course.config.dang = sapKieuMysql(xao.course.config.dang);
kiem("giả lập MySQL: khoá dang đã bị xáo", Object.keys(xao.course.config.dang).join() !== bundle.course.config.dangThuTu.join());
kiem("dạng câu hỏi theo dangThuTu dù khoá đã bị xáo",
     Object.keys(L.tuBundle(xao).dang).join() === bundle.course.config.dangThuTu.join(),
     Object.keys(L.tuBundle(xao).dang).join());
kiem("bundle cũ không có dangThuTu vẫn chạy (theo thứ tự khoá)",
     (() => { const c = JSON.parse(JSON.stringify(bundle)); delete c.course.config.dangThuTu; return Object.keys(L.tuBundle(c).dang).length === 8; })());

/* Bundle lạ: định danh mang thẻ / dấu nháy không được lọt sang dạng riêng —
   app.js ghép thẳng chúng vào HTML. */
const ac = JSON.parse(JSON.stringify(bundle));
const nhomAc = ac.nav.find(s => s.id === "chu-de").groups[0];
nhomAc.meta.icon = '<img src=x onerror="alert(1)">';
nhomAc.meta.thuTu = '1"><script>';
const idAc = nhomAc.items[0];
ac.docs[idAc].meta.so = '"><img src=x onerror=alert(2)>';
ac.docs[idAc].meta.bo = 'A" onclick="alert(3)';
ac.docs[idAc].meta.dang = "<b>dang-la</b>";
ac.docs[idAc].meta.phut = "nhieu";
const DA = L.tuBundle(ac);
const cdA = DA.chuDe[0], qA = DA.cauHoi.find(q => q.chuDe === cdA.id);
const coThe = v => /[<>"'`]/.test(String(v));
kiem("icon / id / số thứ tự chủ đề không còn ký tự thẻ", !coThe(cdA.icon) && !coThe(cdA.id) && typeof cdA.thuTu === "number",
     JSON.stringify([cdA.icon, cdA.id, cdA.thuTu]));
kiem("mã câu, bộ, dạng của câu hỏi không còn ký tự thẻ", !coThe(qA.so) && !coThe(qA.bo) && !coThe(qA.dang) && !coThe(qA.id),
     JSON.stringify([qA.so, qA.bo, qA.dang]));
kiem("dạng / bộ lạ vẫn có mục trong D.dang, D.bo (trang không vỡ khi tra .ten)",
     !!(DA.dang[qA.dang] && DA.dang[qA.dang].ten && DA.bo[qA.bo] && DA.bo[qA.bo].ten));
kiem("số phút không hợp lệ rơi về mặc định", typeof qA.phut === "number" && qA.phut > 0, String(qA.phut));
kiem("nội dung thật đi qua nguyên vẹn (icon emoji, id A01, dạng có dấu gạch)",
     D.chuDe.every((c, i) => c.icon === nhomCd[i].meta.icon) && D.cauHoi.some(q => q.id === "A01") &&
     D.cauHoi.some(q => q.dang === "kinh-nghiem"));

/* ---------- dữ liệu ---------------------------------------------------- */
tieuDe("Dữ liệu (sau chuyển đổi)");
kiem("có chủ đề, câu hỏi, hướng dẫn", D && D.chuDe.length >= 10 && D.cauHoi.length >= 100 && D.huongDan.length >= 8,
     D && (D.chuDe.length + " chủ đề, " + D.cauHoi.length + " câu, " + D.huongDan.length + " bài"));
const ids = D.cauHoi.map(q => q.id);
kiem("id câu hỏi không trùng", new Set(ids).size === ids.length);
const cdIds = new Set(D.chuDe.map(c => c.id));
kiem("mọi câu hỏi trỏ tới chủ đề có thật", D.cauHoi.every(q => cdIds.has(q.chuDe)));
kiem("mọi câu hỏi có dạng hợp lệ", D.cauHoi.every(q => D.dang[q.dang]));
kiem("mọi câu hỏi có vi, en, ≥ 3 câu", D.cauHoi.every(q => q.vi && q.en && q.cau.filter(c => !L.laChiDan(c)).length >= 3),
     D.cauHoi.filter(q => !(q.vi && q.en && q.cau.filter(c => !L.laChiDan(c)).length >= 3)).map(q => q.id).join(","));
kiem("mọi câu hỏi có phút, tu, giay", D.cauHoi.every(q => q.phut > 0 && q.tu > 0 && q.giay > 0));
kiem("có đủ hai bộ A và B", D.thongKe.boA > 50 && D.thongKe.boB > 50, "A " + D.thongKe.boA + " · B " + D.thongKe.boB);
kiem("mọi bài hướng dẫn có H1 và nội dung", D.huongDan.every(h => /^#\s+\S/m.test(h.md) && h.tu > 150));
kiem("mỗi chủ đề có ít nhất 2 câu", D.chuDe.every(c => D.cauHoi.filter(q => q.chuDe === c.id).length >= 2));
kiem("có câu giới thiệu, diễn và tình huống (cho đề thi thử)",
     ["gioi-thieu", "dien", "tinh-huong", "y-kien", "so-sanh", "kinh-nghiem", "mieu-ta"].every(d => D.cauHoi.some(q => q.dang === d)));
const refs = [];
D.huongDan.forEach(h => { (h.md.match(/\{\{script:([A-Za-z0-9]+)\}\}/g) || []).forEach(m => refs.push(m.slice(9, -2))); });
kiem("tham chiếu {{script:…}} trong hướng dẫn đều có thật (" + refs.length + " tham chiếu)", refs.every(r => ids.includes(r)),
     refs.filter(r => !ids.includes(r)).join(","));

/* ---------- chuỗi ------------------------------------------------------ */
tieuDe("Chuỗi");
kiem("boDau giữ nguyên độ dài", L.boDau("Đại khoá học Trí tuệ") === "Dai khoa hoc Tri tue" && L.boDau("ấn chặt").length === "ấn chặt".length);
kiem("chuanHoa hạ chữ thường", L.chuanHoa("Nhà Cửa") === "nha cua");
kiem("soTu đếm từ có dấu nháy", L.soTu("I'm a light packer, so I bring the essentials.") === 9);
kiem("uocGiay ~130 từ/phút", L.uocGiay(130) === 60 && L.uocGiay(65) === 30);
kiem("dinhDangGiay", L.dinhDangGiay(90) === "1:30" && L.dinhDangGiay(5) === "0:05");
kiem("phutChu", L.phutChu(1) === "1′" && L.phutChu(1.5) === "1′30″" && L.phutChu(2) === "2′");
kiem("laChiDan nhận chỉ dẫn sân khấu", L.laChiDan("(Call 1 – Báo sự cố)") && !L.laChiDan("Hello (again)."));

/* ---------- chế độ che -------------------------------------------------- */
tieuDe("Chế độ che script");
const cau = "So, my name is Son and I work as a software engineer.";
const gy = L.goiY(cau, 3);
kiem("gợi ý giữ đúng 3 từ đầu, che 9 từ còn lại", gy.filter(p => !p.hid && p.t.trim()).length === 3 && gy.filter(p => p.hid).length === 9,
     gy.filter(p => p.hid).length + " từ bị che");
kiem("gợi ý ghép lại ra câu gốc", gy.map(p => p.t).join("") === cau);
const cc = L.chuCaiDau("Hello, world").map(p => p.t).join("");
kiem("chữ cái đầu: 'Hello, world' → 'H____, w____'", cc === "H____, w____", cc);
kiem("ẩn hết chỉ còn số từ (12)", /\(12 từ\)/.test(L.anHet(cau)[0].t), L.anHet(cau)[0].t);
const cz = L.cloze(cau, 3, 0);
kiem("điền khuyết che khoảng 1/3 số từ", cz.filter(p => p.hid).length === 4, cz.filter(p => p.hid).length + " từ bị che");
kiem("CHE_DO có 5 chế độ và 'day-du' không che gì", Object.keys(L.CHE_DO).length === 5 && L.CHE_DO["day-du"].lam(cau)[0].t === cau);

/* ---------- Leitner ------------------------------------------------------ */
tieuDe("Lặp lại ngắt quãng");
const NGAY = 86400000, t0 = Date.UTC(2026, 9, 1, 12);
let tt = L.cham(null, 2, t0);
kiem("thuộc lần 1 → hộp 1, gặp lại sau 1 ngày", tt.hop === 1 && tt.den === t0 + 1 * NGAY && tt.s === 2 && tt.lan === 1);
tt = L.cham(tt, 2, t0 + NGAY);
kiem("thuộc lần 2 → hộp 2, sau 3 ngày", tt.hop === 2 && tt.den === t0 + NGAY + 3 * NGAY);
tt = L.cham(tt, 2, t0 + 4 * NGAY);
kiem("thuộc lần 3 → hộp 3, sau 7 ngày", tt.hop === 3 && tt.den === t0 + 4 * NGAY + 7 * NGAY);
const tam = L.cham(tt, 1, t0 + 11 * NGAY);
kiem("tạm được → giữ hộp, gặp lại ngày mai", tam.hop === 3 && tam.den === t0 + 12 * NGAY && tam.s === 1);
const quen = L.cham(tt, 0, t0 + 11 * NGAY);
kiem("chưa thuộc → về hộp 0, gặp lại ngày mai", quen.hop === 0 && quen.den === t0 + 12 * NGAY && quen.lan === 4);
for (let i = 0; i < 10; i++) tt = L.cham(tt, 2, t0 + (20 + i * 40) * NGAY);
kiem("hộp không vượt quá hộp cuối (30 ngày)", tt.hop === L.HOP_NGAY.length - 1);
kiem("denHan: thẻ mới không đến hạn, thẻ quá hạn thì có", !L.denHan(null, t0) && !L.denHan({ s: 0 }, t0) && L.denHan({ s: 2, den: t0 - 1 }, t0) && !L.denHan({ s: 2, den: t0 + 1 }, t0));
kiem("cham không sửa đối tượng vào", (() => { const a = { s: 1, hop: 1, den: 5, lan: 1, luc: 1 }; L.cham(a, 2, t0); return a.hop === 1 && a.den === 5; })());

/* ---------- ngẫu nhiên ---------------------------------------------------- */
tieuDe("Ngẫu nhiên tái lập được");
const r1 = L.rng(42), r2 = L.rng(42);
kiem("cùng hạt giống → cùng dãy", [r1(), r1(), r1()].join() === [r2(), r2(), r2()].join());
kiem("giá trị trong [0,1)", Array.from({ length: 1000 }, () => L.rng(7)()).every(v => v >= 0 && v < 1));
kiem("tron giữ nguyên số phần tử", L.tron([1, 2, 3, 4, 5], L.rng(1)).sort().join() === "1,2,3,4,5");

/* ---------- đề thi thử ------------------------------------------------------ */
tieuDe("Sinh đề thi thử");
let tongDe = 0, loiDe = [];
for (const bo of ["AB", "A", "B"]) for (const uu of [1, 2, 3]) for (let hat = 1; hat <= 50; hat++) {
  const de = L.sinhDe(D, { bo, uuTienToiDa: uu, hat });
  tongDe++;
  const idsDe = de.map(d => d.q.id);
  const dangs = de.map(d => d.q.dang);
  const loi = [];
  if (de.length !== 15) loi.push("có " + de.length + " câu");
  if (new Set(idsDe).size !== idsDe.length) loi.push("trùng câu");
  if (dangs[0] !== "gioi-thieu") loi.push("câu 1 không phải giới thiệu");
  for (let g = 0; g < 3; g++) {
    const cds = de.slice(1 + g * 3, 4 + g * 3).map(d => d.q.chuDe);
    if (new Set(cds).size !== 1) loi.push("cụm " + (g + 1) + " không cùng chủ đề: " + cds.join("/"));
    if (de.slice(1 + g * 3, 4 + g * 3).some(d => ["gioi-thieu", "dien", "tinh-huong"].includes(d.q.dang))) loi.push("cụm " + (g + 1) + " có dạng không phải chủ đề");
  }
  if (dangs[10] !== "dien") loi.push("câu 11 không phải diễn");
  if (!["dien", "tinh-huong"].includes(dangs[11])) loi.push("câu 12 không phải diễn");
  if (!["tinh-huong", "dien"].includes(dangs[12])) loi.push("câu 13 không phải tình huống");
  if (!["y-kien", "so-sanh"].includes(dangs[13]) || !["y-kien", "so-sanh"].includes(dangs[14])) loi.push("câu 14–15 không phải cảm nghĩ / so sánh");
  if (de[13].q.chuDe !== de[14].q.chuDe) loi.push("câu 14–15 khác chủ đề");
  if (bo !== "AB" && de.slice(1, 10).some(d => d.q.bo !== bo)) loi.push("cụm chủ đề lấy sai bộ");
  if (uu === 1 && de.slice(1, 10).some(d => D.chuDe.find(c => c.id === d.q.chuDe).uuTien !== 1)) loi.push("phạm vi trọng tâm mà lấy chủ đề khác");
  if (loi.length) loiDe.push(bo + "/" + uu + "/" + hat + ": " + loi.join("; "));
}
kiem("đủ 15 câu đúng cấu trúc, không trùng, đúng bộ, đúng phạm vi (" + tongDe + " đề)", loiDe.length === 0, loiDe.slice(0, 3).join(" | "));
const deA = L.sinhDe(D, { hat: 5 }), deB = L.sinhDe(D, { hat: 5 });
kiem("cùng hạt giống → cùng đề", deA.map(d => d.q.id).join() === deB.map(d => d.q.id).join());
const khac = new Set(Array.from({ length: 20 }, (_, i) => L.sinhDe(D, { hat: i + 1 }).map(d => d.q.id).join()));
kiem("20 hạt giống → ít nhất 18 đề khác nhau", khac.size >= 18, khac.size + " đề khác nhau");

/* ---------- tìm kiếm -------------------------------------------------------- */
tieuDe("Tìm kiếm");
let kq = L.timKiem(D, "nha cua");
kiem("'nha cua' (không dấu) ra chủ đề Nhà cửa trong 3 kết quả đầu", kq.slice(0, 3).some(r => r.loai === "chu-de" && r.id === "nha-cua"), kq.slice(0, 3).map(r => r.loai + ":" + r.id).join(","));
kq = L.timKiem(D, "A09");
kiem("tìm theo id 'A09' ra đúng câu đầu tiên", kq[0] && kq[0].id === "A09");
kq = L.timKiem(D, "Ha Long");
kiem("tìm trong thân script ('Ha Long') ra script B012", kq.some(r => r.id === "B012"));
kq = L.timKiem(D, "survey");
kiem("tìm trong hướng dẫn ('survey') ra bài chọn survey", kq.some(r => r.loai === "huong-dan" && r.id === "chon-survey"));
kiem("từ không có → rỗng, chuỗi rỗng → rỗng", L.timKiem(D, "xyzzyqq").length === 0 && L.timKiem(D, "   ").length === 0);
const ts = L.toSang("Nhà cửa và việc nhà", "nha");
kiem("toSang đánh dấu đúng hai chỗ 'nhà'", ts.filter(p => p.on).length === 2 && ts.map(p => p.t).join("") === "Nhà cửa và việc nhà");

/* ---------- thống kê ------------------------------------------------------------ */
tieuDe("Thống kê");
const hoc = {}; hoc[D.cauHoi[0].id] = { s: 2, hop: 1, den: 0, lan: 3, luc: 0 }; hoc[D.cauHoi[1].id] = { s: 1, hop: 0, den: Date.now() + NGAY, lan: 1, luc: 0 };
let tk = L.thongKe(D, hoc, "AB");
kiem("thongKe đếm đúng tổng, thuộc, đang học, đến hạn", tk.tong === D.cauHoi.length && tk.thuoc === 1 && tk.dangHoc === 1 && tk.denHan === 1 && tk.luyen === 4);
tk = L.thongKe(D, hoc, "A");
kiem("thongKe lọc theo bộ A", tk.tong === D.thongKe.boA);
kiem("ngayKey dạng YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(L.ngayKey(new Date(2026, 0, 5))) && L.ngayKey(new Date(2026, 0, 5)) === "2026-01-05");
const homNay = new Date(2026, 9, 1, 12), nk = {};
nk[L.ngayKey(homNay)] = 1; nk[L.ngayKey(new Date(2026, 8, 30, 12))] = 2; nk[L.ngayKey(new Date(2026, 8, 29, 12))] = 1;
kiem("chuoiNgay: 3 ngày liên tiếp → 3", L.chuoiNgay(nk, homNay) === 3, String(L.chuoiNgay(nk, homNay)));
const nk2 = {}; nk2[L.ngayKey(new Date(2026, 8, 30, 12))] = 1;
kiem("chuoiNgay: hôm nay chưa luyện, hôm qua có → 1", L.chuoiNgay(nk2, homNay) === 1);
kiem("chuoiNgay: trống → 0", L.chuoiNgay({}, homNay) === 0);

console.log("\n" + (sai ? "[HONG] " : "[DAT]  ") + ok + " đạt, " + sai + " sai");
process.exit(sai ? 1 : 0);
