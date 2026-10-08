/* =====================================================================
   kiem.js — kiểm phần LÕI của ứng dụng quản lý chi tiêu.

       node kiem.js

   Khuôn giống kiem.js của các ứng dụng tự viết khác trong thư mục này
   (dòng [ok]/[SAI], exit code khác 0 khi có phép kiểm sai) nên kiem-tat.js
   chạy được nó.

   Tiền, ngày tháng, chia tiền và gộp dữ liệu là chỗ sai mà KHÔNG LÀM TRẮNG
   TRANG: nó chỉ làm con số sai, và người dùng tin con số đó. Nên phần này
   được kiểm kỹ hơn phần giao diện nhiều — kể cả bằng những con số người
   dùng đã tự tính tay trong nhật ký chi tiêu cũ (xem mục "PDF").
   ===================================================================== */
"use strict";
const path = require("path");
const A = (f) => path.join(__dirname, "assets", f);
["text.js", "money.js", "dates.js", "model.js", "ledger.js", "parser.js", "sync.js", "csv.js", "charts.js", "store.js"].forEach((f) => require(A(f)));
const QL = globalThis.QL;

let hong = 0, dat = 0;
function kiem(ten, ok, chiTiet) {
  console.log("  " + (ok ? "[ok]  " : "[SAI] ") + ten + (!ok && chiTiet !== undefined ? "   " + chiTiet : ""));
  if (ok) dat++; else hong++;
}
const bang = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nhom = (t) => console.log("\n" + t + "\n" + "-".repeat(58));

/** Bộ sinh số giả ngẫu nhiên có hạt giống — để phép kiểm "ngẫu nhiên" tái lặp được. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

console.log("\nKiem quan-ly-chi-tieu\n" + "=".repeat(58));

/* ====================== text ====================== */
nhom("text");
{
  const T = QL.text;
  kiem("fold · bỏ dấu và đ", T.fold("Cơm Mai Dịch Đã Trả") === "com mai dich da tra", T.fold("Cơm Mai Dịch Đã Trả"));
  kiem("fold · giữ nguyên độ dài (chữ dựng sẵn)", T.fold("Phở bò Huế").length === "Phở bò Huế".length);
  kiem("fold · chữ dựng tổ hợp (NFD) cũng ra cùng kết quả", T.fold("Cơm".normalize("NFD")) === "com");
  kiem("fold · null/undefined không nổ", T.fold(null) === "" && T.fold(undefined) === "");
  kiem("esc · thoát đủ ký tự nguy hiểm",
    T.esc('<img src=x onerror="a(1)">&\'`') === "&lt;img src=x onerror=&quot;a(1)&quot;&gt;&amp;&#39;&#96;", T.esc('<img src=x onerror="a(1)">&\'`'));
  kiem("esc · số và null", T.esc(5) === "5" && T.esc(null) === "");
  kiem("matches · không dấu, tiền tố từ", T.matches("Cơm Mai Dịch", "com mai") && T.matches("Cơm Mai Dịch", "dich"));
  kiem("matches · phải đủ MỌI từ", !T.matches("Cơm Mai Dịch", "com pho"));
  kiem("matches · truy vấn rỗng khớp tất cả", T.matches("abc", "  "));
  kiem("matches · chỉ khớp ĐẦU từ, không khớp giữa từ ('com' không khớp 'Techcombank')", !T.matches("Techcombank", "com") && T.matches("Techcombank", "tech") && T.matches("Cơm", "com"));
}

/* ====================== money.parse ====================== */
nhom("money · đọc số tiền");
{
  const P = (s, o) => QL.money.parse(s, o);
  const V = (s, o) => P(s, o).value;
  const bangDoc = [
    // [chuỗi, giá trị kỳ vọng]
    ["50000", 50000], ["50.000", 50000], ["50,000", 50000], ["1.234.567", 1234567], ["19.485.250", 19485250],
    ["19,485,250", 19485250], ["50k", 50000], ["50K", 50000], ["61.5k", 61500], ["61,5k", 61500], ["56.5K", 56500],
    ["28.25k", 28250], ["3.520K", 3520000], ["15.000K", 15000000], ["840K", 840000], ["1tr", 1000000], ["1.5tr", 1500000],
    ["1,5 tr", 1500000], ["2 triệu", 2000000], ["12M", 12000000], ["12m", 12000000], ["10M", 10000000], ["1.250tr", 1250000],
    ["20 nghìn", 20000], ["20 ngàn", 20000], ["2 tỉ", 2000000000], ["2 tỷ", 2000000000], ["4tr", 4000000],
    ["-50000", -50000], ["−50.000", -50000], ["  1.000 ₫ ", 1000], ["1.000đ", 1000], ["50000 VND", 50000], ["500", 500000],
    ["57", 57000], ["55,5", 55500], ["56.5", 56500], ["0", 0], ["1.234,5", 1235], ["1000", 1000],
    // biểu thức
    ["87k - 50k", 37000], ["87k-50k", 37000], ["87K - Voucher".replace(" Voucher", " 50K"), 37000],
    ["60+57+68+55,5+57+60+82", 439500], ["87K - 50K = 37K", 37000], ["(không dùng)".slice(0, 0) + "100k + 20k", 120000],
    ["59 + 63 + 60", 182000]
  ];
  bangDoc.forEach(([s, ky]) => {
    const r = P(s);
    kiem("parse · " + JSON.stringify(s) + " → " + ky, r.ok && r.value === ky, "ra " + r.value + (r.ok ? "" : " (không đọc được)"));
  });
  kiem("parse · tắt 'số nhỏ là nghìn': 57 → 57", V("57", { smallAsThousand: false }) === 57);
  kiem("parse · tắt 'số nhỏ là nghìn' không ảnh hưởng 57k", V("57k", { smallAsThousand: false }) === 57000);
  ["", "abc", "k", "57 58", "5k abc", "12-", "1..2", null, undefined, "1e9999"].forEach((s) =>
    kiem("parse · rác " + JSON.stringify(s) + " → không đọc được, giá trị 0", !P(s).ok && P(s).value === 0, JSON.stringify(P(s))));
  kiem("parse · quá lớn bị từ chối", !P("99999 tỷ").ok);
  kiem("parse · dấu chấm câu cuối bị bỏ: \"57.\" = 57.000", V("57.") === 57000);
  kiem("parse · nhận số JS", P(1234.6).ok && V(1234.6) === 1235);
  let nguyen = true;
  ["1.5tr", "0.5k", "1,25 tr", "999", "1.234,5", "61.5k", "28.25"].forEach((x) => { if (!Number.isInteger(V(x))) nguyen = false; });
  kiem("parse · kết quả LUÔN là số nguyên", nguyen);
}

/* ====================== money.format / compact / allocate ====================== */
nhom("money · in ra và chia");
{
  const M = QL.money;
  kiem("format · ngăn nghìn", M.format(1234567) === "1.234.567 ₫", M.format(1234567));
  kiem("format · số nhỏ", M.format(999) === "999 ₫" && M.format(0) === "0 ₫");
  kiem("format · dấu trừ thật U+2212", M.format(-1000) === "−1.000 ₫");
  kiem("format · bỏ đơn vị", M.format(1000, false) === "1.000");
  kiem("format · làm tròn số lẻ", M.format(1000.6) === "1.001 ₫");
  let vong = true, lech = "";
  [0, 1, 999, 1000, 50000, 1234567, 999999999, 1000000000, 123456789012].forEach((v) => {
    const lai = M.parse(M.format(v, false), { smallAsThousand: false }).value;
    if (lai !== v) { vong = false; lech = v + " → " + lai; }
  });
  kiem("format · in ra rồi đọc lại ra đúng số cũ", vong, lech);
  kiem("compact · k/tr/tỷ", M.compact(50000) === "50k" && M.compact(1500000) === "1,5tr" && M.compact(2500000000) === "2,5tỷ" && M.compact(500) === "500");
  kiem("compact · số âm", M.compact(-1500000) === "−1,5tr");

  kiem("allocate · chia đôi số chẵn", bang(M.allocate(57000, [1, 1]), [28500, 28500]));
  kiem("allocate · chia đôi số lẻ — dư vào phần đầu", bang(M.allocate(100001, [1, 1]), [50001, 50000]));
  kiem("allocate · chia ba", bang(M.allocate(100, [1, 1, 1]), [34, 33, 33]));
  kiem("allocate · theo trọng số", bang(M.allocate(1000, [1, 3]), [250, 750]));
  kiem("allocate · không phần tử", bang(M.allocate(100, []), []));
  kiem("allocate · tổng trọng số 0 → chia đều", bang(M.allocate(10, [0, 0]), [5, 5]));
  kiem("allocate · số âm đối xứng", bang(M.allocate(-100001, [1, 1]), [-50001, -50000]));
  const r = rng(7);
  let tongDung = true, khongAm = true, thoiGian = "";
  for (let i = 0; i < 2000; i++) {
    const tong = Math.floor(r() * 1e9), n = 1 + Math.floor(r() * 7);
    const w = Array.from({ length: n }, () => 1 + Math.floor(r() * 5));
    const kq = M.allocate(tong, w);
    if (kq.reduce((a, b) => a + b, 0) !== tong) { tongDung = false; thoiGian = tong + " / " + w; }
    if (kq.some((x) => x < 0)) khongAm = false;
  }
  kiem("allocate · 2000 ca ngẫu nhiên: TỔNG CÁC PHẦN = TỔNG", tongDung, thoiGian);
  kiem("allocate · không phần nào âm", khongAm);
  kiem("allocate · tích vượt 2^53 vẫn đúng (BigInt)",
    M.allocate(9007199254740991, [3, 5]).reduce((a, b) => a + b, 0) === 9007199254740991);
  kiem("mulDiv · làm tròn nửa lên", M.mulDiv(5, 1, 2) === 3 && M.mulDiv(7, 1, 3) === 2 && M.mulDiv(-5, 1, 2) === -3);
}

/* ====================== dates ====================== */
nhom("dates");
{
  const D = QL.dates;
  kiem("isValid · ngày thật", D.isValid("2026-02-28") && D.isValid("2028-02-29"));
  kiem("isValid · ngày không có thật", !D.isValid("2026-02-29") && !D.isValid("2026-13-01") && !D.isValid("2026-4-5") && !D.isValid(""));
  kiem("addDays · qua tháng và năm", D.addDays("2026-12-31", 1) === "2027-01-01" && D.addDays("2026-03-01", -1) === "2026-02-28");
  kiem("addDays · năm nhuận", D.addDays("2028-02-28", 1) === "2028-02-29");
  kiem("diffDays", D.diffDays("2026-01-01", "2026-12-31") === 364 && D.diffDays("2026-10-05", "2026-10-01") === -4);
  kiem("addMonths · kẹp ngày cuối tháng", D.addMonths("2026-01-31", 1) === "2026-02-28" && D.addMonths("2028-01-31", 1) === "2028-02-29");
  kiem("addMonths · qua năm / lùi", D.addMonths("2026-11-15", 3) === "2027-02-15" && D.addMonths("2026-01-15", -2) === "2025-11-15");
  kiem("weekday · 2026-10-05 là thứ Hai", D.weekday("2026-10-05") === 0 && D.WD[D.weekday("2026-10-05")] === "T2");
  kiem("weekday · chủ nhật = 6", D.weekday("2026-10-04") === 6 && D.weekday("2026-10-10") === 5);
  kiem("startOfWeek / endOfWeek", D.startOfWeek("2026-10-08") === "2026-10-05" && D.endOfWeek("2026-10-08") === "2026-10-11" && D.startOfWeek("2026-10-04") === "2026-09-28");
  kiem("isoWeek · 2026-10-05 là tuần 41", D.isoWeek("2026-10-05").week === 41);
  kiem("isoWeek · đầu năm thuộc tuần cuối năm trước", D.isoWeek("2027-01-01").year === 2026 && D.isoWeek("2027-01-01").week === 53);
  kiem("dayLabel", D.dayLabel("2026-10-05") === "T2 05/10", D.dayLabel("2026-10-05"));
  kiem("relativeLabel", D.relativeLabel("2026-10-05", "2026-10-05") === "Hôm nay" && D.relativeLabel("2026-10-04", "2026-10-05") === "Hôm qua"
    && D.relativeLabel("2026-10-03", "2026-10-05") === "Hôm kia" && D.relativeLabel("2026-10-01", "2026-10-05") === "T5 01/10");
  kiem("lastWeekday · hôm nay tính", D.lastWeekday(0, "2026-10-05") === "2026-10-05");
  kiem("lastWeekday · lùi về lần gần nhất", D.lastWeekday(6, "2026-10-05") === "2026-10-04" && D.lastWeekday(4, "2026-10-05") === "2026-10-02");
  kiem("weekdayGroup · T2–T6 / T7 / CN", D.weekdayGroup(0) === "weekdays" && D.weekdayGroup(4) === "weekdays" && D.weekdayGroup(5) === "saturday" && D.weekdayGroup(6) === "sunday");
  kiem("today · nhận ngày giả", D.today(new Date(2026, 9, 5, 23, 59)) === "2026-10-05");

  const pw = D.period("week", "2026-10-07"), pm = D.period("month", "2026-10-07"), py = D.period("year", "2026-10-07");
  kiem("period week", pw.from === "2026-10-05" && pw.to === "2026-10-11" && pw.label === "Tuần 41 · 05/10 – 11/10", pw.label);
  kiem("period month", pm.from === "2026-10-01" && pm.to === "2026-10-31" && pm.label === "Tháng 10/2026");
  kiem("period year", py.from === "2026-01-01" && py.to === "2026-12-31" && py.label === "Năm 2026");
  kiem("period month · tháng 2 năm nhuận", D.period("month", "2028-02-10").to === "2028-02-29");
  kiem("shift week", D.shift(pw, -1).from === "2026-09-28" && D.shift(pw, 1).from === "2026-10-12");
  kiem("shift month · qua năm", D.shift(D.period("month", "2026-01-15"), -1).from === "2025-12-01");
  kiem("shift year", D.shift(py, 1).from === "2027-01-01");
  const pc = D.period("custom", "2026-10-01", { from: "2026-10-01", to: "2026-10-10" });
  kiem("shift custom · cùng độ dài", D.shift(pc, 1).from === "2026-10-11" && D.shift(pc, 1).to === "2026-10-20");
  kiem("inPeriod · biên hai đầu thuộc kỳ", D.inPeriod("2026-10-01", pm) && D.inPeriod("2026-10-31", pm) && !D.inPeriod("2026-11-01", pm));

  const U = (s, t) => D.parseUser(s, t || "2026-10-05");
  kiem("parseUser · dd/mm lấy năm hiện tại", U("27/2") === "2026-02-27" && U("5/10") === "2026-10-05");
  kiem("parseUser · dd/mm/yyyy và yy", U("05/10/2026") === "2026-10-05" && U("5/10/26") === "2026-10-05");
  kiem("parseUser · ISO", U("2026-10-05") === "2026-10-05");
  kiem("parseUser · dd-mm và dd.mm", U("5-10") === "2026-10-05" && U("5.10") === "2026-10-05");
  kiem("parseUser · ngày xa trong tương lai → năm trước", U("28/12", "2026-01-05") === "2025-12-28");
  kiem("parseUser · tương lai gần giữ nguyên năm", U("15/10") === "2026-10-15");
  kiem("parseUser · không có thật → null", U("30/2") === null && U("32/1") === null && U("abc") === null && U("") === null);
}

/* ====================== model ====================== */
nhom("model");
const Mo = QL.model, L = QL.ledger;
const NOW = "2026-10-05T01:00:00.000Z";
/** Sổ có hai người: "p_me" (tôi) và "p_x" (Phúc). */
function soMau() {
  let d = Mo.emptyDoc(NOW);
  d = Mo.upsert(d, "people", { id: "p_x", name: "Phúc", archived: false }, NOW);
  return d;
}
let _n = 0;
/** Thêm giao dịch; chi chung chia đều giữa những người trong `chiaCho`. */
function them(d, o) {
  const tx = Object.assign({ id: "t" + (++_n), tags: [], note: "", accountId: "a_cash", categoryId: "c_food" }, o);
  if (o.chiaCho) {
    const ids = o.chiaCho, phan = QL.money.allocate(tx.amount, ids.map(() => 1));
    tx.split = { paidBy: o.tra || "p_me", shares: Object.fromEntries(ids.map((id, i) => [id, phan[i]])) };
    delete tx.chiaCho; delete tx.tra;
  }
  return Mo.upsert(d, "transactions", tx, NOW);
}
{
  const d = Mo.emptyDoc(NOW);
  kiem("emptyDoc · schema 1, có mục 'Tôi', danh mục và tài khoản mặc định",
    d.schema === 1 && d.people[0].id === "p_me" && d.categories.length >= 14 && d.accounts.length === 3);
  kiem("emptyDoc · bia mộ có đủ các bộ sưu tập", Mo.COLLECTIONS.every((c) => typeof d.tombstones[c] === "object"));
  const ids = d.categories.map((c) => c.id);
  kiem("emptyDoc · id danh mục duy nhất", new Set(ids).size === ids.length);
  kiem("uid · không trùng trong 5000 lần", new Set(Array.from({ length: 5000 }, () => Mo.uid("t"))).size === 5000);

  const a = Mo.upsert(d, "people", { id: "p_a", name: "A" }, NOW);
  kiem("upsert · trả tài liệu MỚI, không sửa tài liệu cũ", a !== d && d.people.length === 1 && a.people.length === 2);
  kiem("upsert · đóng dấu updatedAt", a.people[1].updatedAt === NOW);
  const b = Mo.upsert(a, "people", { id: "p_a", name: "A2" }, "2026-10-06T00:00:00.000Z");
  kiem("upsert · thay cùng id, không nhân đôi", b.people.length === 2 && b.people[1].name === "A2" && b.people[1].updatedAt.startsWith("2026-10-06"));
  const c = Mo.remove(b, "people", "p_a", "2026-10-07T00:00:00.000Z");
  kiem("remove · bỏ bản ghi và để bia mộ", c.people.length === 1 && c.tombstones.people.p_a === "2026-10-07T00:00:00.000Z");
  kiem("remove · không sửa tài liệu cũ", b.people.length === 2 && !b.tombstones.people.p_a);
  const e = Mo.upsert(c, "people", { id: "p_a", name: "A3" }, "2026-10-08T00:00:00.000Z");
  kiem("upsert · thêm lại id đã xoá thì gỡ bia mộ", e.people.length === 2 && e.tombstones.people.p_a === undefined);
  const s = Mo.setSettings(d, { theme: "dark" }, "2026-10-09T00:00:00.000Z");
  kiem("setSettings · cập nhật và đóng dấu", s.settings.theme === "dark" && s.settings.updatedAt.startsWith("2026-10-09") && d.settings.theme === "system");
}

nhom("model · validateTx (bất biến §3.1)");
{
  let d = soMau();
  const ok = { type: "expense", date: "2026-10-05", amount: 57000, categoryId: "c_food", accountId: "a_cash" };
  const V = (o) => Mo.validateTx(Object.assign({}, ok, o), d);
  kiem("hợp lệ: chi thường", V({}).length === 0, V({}).join("; "));
  kiem("số tiền 0 / âm / lẻ bị từ chối", V({ amount: 0 }).length > 0 && V({ amount: -5 }).length > 0 && V({ amount: 10.5 }).length > 0);
  kiem("ngày không có thật bị từ chối", V({ date: "2026-02-30" }).length > 0);
  kiem("chi/thu cần danh mục tồn tại", V({ categoryId: null }).length > 0 && V({ categoryId: "c_ma" }).length > 0);
  kiem("chi cần tài khoản tồn tại", V({ accountId: null }).length > 0 && V({ accountId: "a_ma" }).length > 0);
  kiem("loại lạ bị từ chối", Mo.validateTx({ type: "x" }, d).length > 0);
  const tf = { type: "transfer", date: "2026-10-05", amount: 1000, accountId: "a_cash", toAccountId: "a_bank" };
  kiem("chuyển hợp lệ không cần danh mục", Mo.validateTx(tf, d).length === 0);
  kiem("chuyển cùng một tài khoản bị từ chối", Mo.validateTx(Object.assign({}, tf, { toAccountId: "a_cash" }), d).length > 0);
  kiem("chuyển thiếu tài khoản đích bị từ chối", Mo.validateTx(Object.assign({}, tf, { toAccountId: null }), d).length > 0);
  const chia = { split: { paidBy: "p_me", shares: { p_me: 28500, p_x: 28500 } } };
  kiem("chi chung: tổng phần = số tiền → hợp lệ", V(chia).length === 0, V(chia).join("; "));
  kiem("chi chung: tổng phần lệch 1 đồng bị từ chối", V({ split: { paidBy: "p_me", shares: { p_me: 28500, p_x: 28499 } } }).length > 0);
  kiem("chi chung: người không tồn tại bị từ chối", V({ split: { paidBy: "p_me", shares: { p_me: 28500, p_ma: 28500 } } }).length > 0);
  kiem("chi chung: phần âm/lẻ bị từ chối", V({ split: { paidBy: "p_me", shares: { p_me: 60000, p_x: -3000 } } }).length > 0);
  kiem("chi chung: người khác trả hộ không cần tài khoản", V({ accountId: null, split: { paidBy: "p_x", shares: { p_me: 28500, p_x: 28500 } } }).length === 0);
  kiem("chi chung: tôi trả thì vẫn cần tài khoản", V({ accountId: null, split: chia.split }).length > 0);
  kiem("thu không được có chia tiền", Mo.validateTx({ type: "income", date: "2026-10-05", amount: 57000, categoryId: "c_salary", accountId: "a_cash", split: chia.split }, d).length > 0);
  const st = { type: "settle", date: "2026-10-05", amount: 1000, personId: "p_x", direction: "in", accountId: "a_cash" };
  kiem("thanh toán nợ hợp lệ", Mo.validateTx(st, d).length === 0);
  kiem("thanh toán nợ với chính mình bị từ chối", Mo.validateTx(Object.assign({}, st, { personId: "p_me" }), d).length > 0);
  kiem("thanh toán nợ sai hướng bị từ chối", Mo.validateTx(Object.assign({}, st, { direction: "x" }), d).length > 0);
}

nhom("model · normalize (dữ liệu không tin được)");
{
  const N = (x) => Mo.normalize(x, NOW);
  kiem("null / mảng / chuỗi → sổ trống, không ném lỗi", [null, undefined, [], "abc", 5].every((x) => N(x).doc.schema === 1 && N(x).doc.people.length === 1));
  const raw = {
    schema: 1,
    settings: { theme: "tím", smallAsThousand: "yes", meId: "p_me" },
    accounts: [{ id: "a1", name: "Ví", kind: "ewallet", openingBalance: 5.5 }, { name: "không id" }, { id: "a1", name: "trùng" }, null],
    categories: [{ id: "c1", name: "Ăn", kind: "income", color: "đỏ" }],
    people: [{ id: "p_x", name: "Phúc" }],
    transactions: [
      { id: "t1", type: "expense", date: "2026-10-05", amount: 57000, categoryId: "c1", accountId: "a1", note: "x".repeat(1000), tags: ["a", 5, "b"] },
      { id: "t2", type: "expense", date: "2026-02-30", amount: 5 },
      { id: "t3", type: "expense", date: "2026-10-05", amount: -5 },
      { id: "t4", type: "bay", date: "2026-10-05", amount: 5 },
      { id: "t5", type: "expense", date: "2026-10-05", amount: 100, split: { paidBy: "p_me", shares: { p_me: 50, p_x: 40 } } },
      { id: "t6", type: "expense", date: "2026-10-05", amount: 100, split: { paidBy: "p_me", shares: { p_me: 50, p_x: 50 } } }
    ],
    budgets: [{ id: "b1", amount: 0 }, { id: "b2", amount: 100, categoryId: "c1" }],
    recurring: [{ id: "r1", type: "expense", amount: 10, startOn: "2026-01-01", frequency: "weekly", day: 99 }, { id: "r2", type: "transfer", amount: 10, startOn: "2026-01-01" }],
    tombstones: { transactions: { t9: "2026-10-01T00:00:00.000Z", t8: "không phải ngày" }, "lạ": { x: "y" } },
    rac: "bị bỏ"
  };
  const { doc, fixes } = N(raw);
  kiem("giữ bản ghi hợp lệ, bỏ bản hỏng", doc.transactions.map((t) => t.id).join() === "t1,t5,t6", doc.transactions.map((t) => t.id).join());
  kiem("tài khoản: bỏ thiếu id / trùng id; số dư lẻ về 0", doc.accounts.length === 1 && doc.accounts[0].openingBalance === 0);
  kiem("cài đặt rác về mặc định", doc.settings.theme === "system" && doc.settings.smallAsThousand === true);
  kiem("danh mục: kind=income được giữ, màu rác về mặc định", doc.categories[0].kind === "income" && /^#/.test(doc.categories[0].color));
  kiem("ghi chú dài bị cắt 300, thẻ không phải chuỗi bị bỏ", doc.transactions[0].note.length === 300 && bang(doc.transactions[0].tags, ["a", "b"]));
  kiem("chia tiền lệch tổng bị bỏ phần chia nhưng GIỮ giao dịch", doc.transactions[1].split === undefined && doc.transactions[2].split.shares.p_x === 50);
  kiem("thêm lại mục 'Tôi' khi thiếu", doc.people.some((p) => p.id === "p_me") && fixes.some((f) => /Tôi/.test(f)));
  kiem("ngân sách số 0 bị bỏ", doc.budgets.length === 1 && doc.budgets[0].id === "b2");
  kiem("định kỳ: thứ trong tuần kẹp 0..6; loại chuyển bị bỏ", doc.recurring.length === 1 && doc.recurring[0].day === 6);
  kiem("bia mộ: chỉ giữ cái hợp lệ, bỏ bộ sưu tập lạ", doc.tombstones.transactions.t9 && !doc.tombstones.transactions.t8 && !("lạ" in doc.tombstones));
  kiem("khoá lạ ở gốc bị bỏ", !("rac" in doc));
  kiem("normalize · đã chuẩn thì chuẩn lần nữa không đổi (lũy đẳng)", bang(N(doc).doc, doc));
  kiem("normalize · ghi lại lý do đã bỏ", fixes.length >= 5);
}

nhom("model · sổ tiết kiệm & định kỳ");
{
  let d = soMau();
  d = Mo.upsert(d, "accounts", Object.assign({}, d.accounts[1], { openingBalance: 20000000 }), NOW);
  const mo = Mo.openDeposit(d, { name: "Sổ lương 2609", fromAccountId: "a_bank", amount: 12000000, rate: 8.61, termMonths: 12, openedOn: "2026-09-10", taxPct: 0 }, NOW);
  let bal = L.accountBalances(mo.doc);
  kiem("openDeposit · tiền rời tài khoản nguồn, vào sổ", bal.a_bank === 8000000 && bal[mo.accountId] === 12000000);
  kiem("openDeposit · tổng tài sản không đổi", L.netWorth(mo.doc) === L.netWorth(d));
  const info = L.savingsInfo(mo.doc.accounts.find((a) => a.id === mo.accountId), 12000000, "2026-10-05");
  kiem("savingsInfo · đáo hạn đúng ngày, lãi 1.033.200", info.maturityOn === "2027-09-10" && info.interest === 1033200 && info.status === "active", JSON.stringify(info));
  const cl = Mo.closeDeposit(mo.doc, mo.accountId, { date: "2027-09-10", toAccountId: "a_bank", principal: 12000000, interest: 1033200 }, NOW);
  bal = L.accountBalances(cl);
  kiem("closeDeposit · gốc về tài khoản, sổ về 0", bal[mo.accountId] === 0 && bal.a_bank === 8000000 + 12000000 + 1033200);
  kiem("closeDeposit · tổng tài sản tăng đúng bằng lãi", L.netWorth(cl) === L.netWorth(d) + 1033200);
  const sa = cl.accounts.find((a) => a.id === mo.accountId);
  kiem("closeDeposit · sổ được lưu trữ và đặt closedOn", sa.archived && sa.deposit.closedOn === "2027-09-10");
  const sum = L.periodSummary(cl, QL.dates.period("year", "2027-09-10"), "2027-09-10");
  kiem("closeDeposit · lãi tính là thu nhập, gửi/rút không phải thu chi", sum.income === 1033200 && sum.expense === 0);
  kiem("closeDeposit · không phải sổ tiết kiệm thì ném lỗi", (() => { try { Mo.closeDeposit(cl, "a_cash", { date: "2027-09-10", toAccountId: "a_bank", principal: 1, interest: 0 }, NOW); return false; } catch (e) { return true; } })());

  let r = Mo.upsert(soMau(), "recurring", { id: "r1", name: "Vé bus tháng", type: "expense", amount: 280000, categoryId: "c_transport", accountId: "a_cash", note: "Vé bus tháng", frequency: "monthly", day: 28, startOn: "2026-02-28", endOn: null, lastDoneOn: null, active: true }, NOW);
  let due = L.dueRecurring(r, "2026-05-03");
  kiem("dueRecurring · 3 lần đến hạn: 28/2, 28/3, 28/4", bang(due.map((x) => x.dueOn), ["2026-02-28", "2026-03-28", "2026-04-28"]), JSON.stringify(due.map((x) => x.dueOn)));
  r = Mo.confirmRecurring(r, "r1", "2026-02-28", { amount: 290000 }, NOW);
  kiem("confirmRecurring · tạo giao dịch với số tiền đã sửa, gắn recurringId", r.transactions.length === 1 && r.transactions[0].amount === 290000 && r.transactions[0].recurringId === "r1");
  kiem("confirmRecurring · giao dịch tạo ra hợp lệ", Mo.validateTx(r.transactions[0], r).length === 0);
  due = L.dueRecurring(r, "2026-05-03");
  kiem("dueRecurring · sau khi xác nhận chỉ còn 2 lần", bang(due.map((x) => x.dueOn), ["2026-03-28", "2026-04-28"]));
  r = Mo.markRecurringDone(r, "r1", "2026-04-28", NOW);
  kiem("markRecurringDone (bỏ qua) · lần trước đó cũng coi như xong", L.dueRecurring(r, "2026-05-03").length === 0);
  kiem("dueRecurring · chưa tới hạn thì rỗng", L.dueRecurring(r, "2026-05-27").length === 0 && L.dueRecurring(r, "2026-05-28").length === 1);
  const k31 = Mo.upsert(soMau(), "recurring", { id: "r2", name: "Cuối tháng", type: "expense", amount: 1, frequency: "monthly", day: 31, startOn: "2026-01-31", active: true }, NOW);
  kiem("dueRecurring · ngày 31 kẹp về cuối tháng ngắn", bang(L.dueRecurring(k31, "2026-04-30").map((x) => x.dueOn), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]));
  const wk = Mo.upsert(soMau(), "recurring", { id: "r3", name: "Tuần", type: "expense", amount: 1, frequency: "weekly", day: 0, startOn: "2026-10-01", active: true }, NOW);
  kiem("dueRecurring · hằng tuần vào T2", bang(L.dueRecurring(wk, "2026-10-20").map((x) => x.dueOn), ["2026-10-05", "2026-10-12", "2026-10-19"]));
  const ended = Mo.upsert(soMau(), "recurring", { id: "r4", name: "Hết hạn", type: "expense", amount: 1, frequency: "monthly", day: 1, startOn: "2026-01-01", endOn: "2026-02-15", active: true }, NOW);
  kiem("dueRecurring · dừng ở endOn", L.dueRecurring(ended, "2026-12-31").length === 2);
  const off = Mo.upsert(soMau(), "recurring", { id: "r5", name: "Tắt", type: "expense", amount: 1, frequency: "monthly", day: 1, startOn: "2026-01-01", active: false }, NOW);
  kiem("dueRecurring · quy tắc tắt không đến hạn", L.dueRecurring(off, "2026-12-31").length === 0);
  const many = Mo.upsert(soMau(), "recurring", { id: "r6", name: "Lâu", type: "expense", amount: 1, frequency: "monthly", day: 1, startOn: "2020-01-01", active: true }, NOW);
  kiem("dueRecurring · tối đa 12 lần/quy tắc", L.dueRecurring(many, "2026-12-31").length === 12);
}

/* ====================== ledger ====================== */
nhom("ledger · tác động của giao dịch (bảng §3.2)");
{
  let d = soMau();
  d = Mo.upsert(d, "accounts", Object.assign({}, d.accounts[0], { openingBalance: 1000000 }), NOW);
  const E = (tx) => L.effects(tx, "p_me");
  const base = { id: "x", date: "2026-10-05", amount: 100000, accountId: "a_cash", categoryId: "c_food", tags: [] };

  let e = E(Object.assign({ type: "expense" }, base));
  kiem("chi thường · tài khoản −, chi của tôi = cả khoản", e.cash[0].delta === -100000 && e.spend === 100000 && !Object.keys(e.people).length);
  e = E(Object.assign({ type: "expense", split: { paidBy: "p_me", shares: { p_me: 50000, p_x: 50000 } } }, base));
  kiem("chi chung · TÔI trả: tài khoản −cả khoản, chi của tôi = phần tôi, Phúc nợ tôi phần của Phúc",
    e.cash[0].delta === -100000 && e.spend === 50000 && e.people.p_x === 50000);
  e = E(Object.assign({ type: "expense", split: { paidBy: "p_x", shares: { p_me: 50000, p_x: 50000 } } }, base));
  kiem("chi chung · PHÚC trả: tài khoản KHÔNG đổi, chi của tôi = phần tôi, tôi nợ Phúc",
    e.cash.length === 0 && e.spend === 50000 && e.people.p_x === -50000);
  e = E(Object.assign({ type: "expense", split: { paidBy: "p_me", shares: { p_x: 100000 } } }, base));
  kiem("chi hộ · tôi trả toàn bộ phần của Phúc: chi của tôi = 0", e.spend === 0 && e.people.p_x === 100000 && e.cash[0].delta === -100000);
  e = E(Object.assign({ type: "income", categoryId: "c_salary" }, base));
  kiem("thu · tài khoản +, thu của tôi", e.cash[0].delta === 100000 && e.income === 100000 && e.spend === 0);
  e = E(Object.assign({ type: "transfer", toAccountId: "a_bank" }, base));
  kiem("chuyển · hai tài khoản đối xứng, không thu không chi", e.cash.length === 2 && e.cash[0].delta + e.cash[1].delta === 0 && e.spend === 0 && e.income === 0);
  e = E(Object.assign({ type: "settle", personId: "p_x", direction: "in" }, base));
  kiem("Phúc trả nợ tôi · tài khoản +, Phúc nợ ít đi, không phải thu nhập", e.cash[0].delta === 100000 && e.people.p_x === -100000 && e.income === 0);
  e = E(Object.assign({ type: "settle", personId: "p_x", direction: "out" }, base));
  kiem("Tôi trả nợ Phúc · tài khoản −, nợ của tôi giảm", e.cash[0].delta === -100000 && e.people.p_x === 100000 && e.spend === 0);

  d = them(d, { type: "expense", date: "2026-10-05", amount: 100000 });
  d = them(d, { type: "expense", date: "2026-10-05", amount: 80000, chiaCho: ["p_me", "p_x"], tra: "p_x", accountId: null });
  d = them(d, { type: "income", date: "2026-10-05", amount: 500000, categoryId: "c_salary" });
  d = them(d, { type: "transfer", date: "2026-10-05", amount: 200000, toAccountId: "a_bank", categoryId: null });
  const bal = L.accountBalances(d);
  kiem("số dư tiền mặt = đầu kỳ − chi + thu − chuyển, bỏ qua khoản Phúc trả hộ", bal.a_cash === 1000000 - 100000 + 500000 - 200000, String(bal.a_cash));
  kiem("số dư tài khoản đích của khoản chuyển", bal.a_bank === 200000);
  kiem("tài sản = tổng số dư", L.netWorth(d) === bal.a_cash + bal.a_bank + bal.a_wallet);
  kiem("số dư với Phúc: tôi nợ Phúc 40.000 (nửa của 80.000)", L.personBalances(d).p_x === -40000);
}

nhom("ledger · ĐỐI CHIẾU SỐ TRONG PDF (requirements §6)");
{
  const K = (x) => Math.round(x * 1000);
  /** Dựng hai bên chi tiêu rồi hỏi: Phúc phải chuyển cho tôi bao nhiêu? */
  function quyetToan(minhTra, phucTra) {
    let d = soMau();
    minhTra.forEach((a) => { d = them(d, { type: "expense", date: "2026-06-10", amount: K(a), chiaCho: ["p_me", "p_x"], tra: "p_me" }); });
    phucTra.forEach((a) => { d = them(d, { type: "expense", date: "2026-06-10", amount: K(a), chiaCho: ["p_me", "p_x"], tra: "p_x", accountId: null }); });
    return { d, soDu: L.personBalances(d).p_x };
  }
  let r = quyetToan([60, 57, 68, 55.5, 57, 60, 82], [59, 63, 60]);
  kiem("trang 10 · 439,5K vs 182K → Phúc chuyển 128.750", r.soDu === 128750, String(r.soDu));
  kiem("trang 10 · tổng mình trả đúng 439,5K (như máy tính trong ảnh)", [60, 57, 68, 55.5, 57, 60, 82].reduce((a, b) => a + K(b), 0) === 439500);
  r = quyetToan([521], [272.5]);
  kiem("trang 17 · 521K vs 272,5K → 124.250", r.soDu === 124250, String(r.soDu));
  r = quyetToan([430.5], []);
  kiem("trang 19 · 430,5K vs 0 → 215.250", r.soDu === 215250, String(r.soDu));
  r = quyetToan([763], [584.5]);
  kiem("trang 27 · 763K vs 584,5K → 89.250", r.soDu === 89250, String(r.soDu));
  r = quyetToan([205.5, 315.5], [272.5]);
  kiem("trang 17 (nhiều khoản) · vẫn 124.250", r.soDu === 124250, String(r.soDu));

  // Thanh toán xong thì hết nợ.
  let d = r.d;
  d = them(d, { type: "settle", date: "2026-06-11", amount: 124250, personId: "p_x", direction: "in", categoryId: null });
  kiem("ghi khoản Phúc đã chuyển → số dư về 0", L.personBalances(d).p_x === 0);
  kiem("…và khoản chuyển vào tài khoản của tôi, không tính là thu nhập", L.accountBalances(d).a_cash === 124250 - 521000 && L.periodSummary(d, QL.dates.period("month", "2026-06-10"), "2026-06-30").income === 0);
  kiem("settlementOf · hướng và số tiền", bang(L.settlementOf(128750), { direction: "receive", amount: 128750 }) && bang(L.settlementOf(-5), { direction: "pay", amount: 5 }) && L.settlementOf(0).direction === "even");

  // Hoá đơn trọ trang 20.
  const hd = L.billSplit({ oldReading: 934, newReading: 1248, unitPrice: 4000, fixed: [200000, 200000, 4000000], people: 2 });
  kiem("trang 20 · điện (1248−934)×4000 = 1.256.000", hd.usage === 314 && hd.electricity === 1256000);
  kiem("trang 20 · tổng 5.656.000, mỗi người 2.828.000", hd.total === 5656000 && bang(hd.shares, [2828000, 2828000]));
  kiem("billSplit · chia 3 vẫn đúng tổng", L.billSplit({ oldReading: 0, newReading: 1, unitPrice: 100000, fixed: [], people: 3 }).shares.reduce((a, b) => a + b, 0) === 100000);
  kiem("billSplit · số cũ lớn hơn số mới → dùng 0, không âm", L.billSplit({ oldReading: 10, newReading: 5, unitPrice: 1000, fixed: [], people: 1 }).total === 0);

  // Sổ tiết kiệm trang 16/21/22/24.
  const acc = (rate, months, openedOn, tax) => ({ id: "a", deposit: { rate, termMonths: months, openedOn, taxPct: tax || 0, closedOn: null } });
  const SI = (rate, months, openedOn, P, tax) => L.savingsInfo(acc(rate, months, openedOn, tax), P, "2026-10-05");
  kiem("trang 21 · 15.000.000 · 8,35 % · 12 tháng → lãi 1.252.500", SI(8.35, 12, "2026-07-31", 15000000).interest === 1252500, String(SI(8.35, 12, "2026-07-31", 15000000).interest));
  kiem("trang 24 · 12.000.000 · 8,61 % → 1.033.200", SI(8.61, 12, "2026-09-10", 12000000).interest === 1033200);
  kiem("trang 16 · 20.000.000 · 4,85 % · 365 ngày → 970.000", SI(4.85, 12, "2025-07-25", 20000000).interest === 970000 && SI(4.85, 12, "2025-07-25", 20000000).termDays === 365);
  const t = SI(6.2, 12, "2025-08-22", 10000000, 5);
  kiem("trang 22 · lãi 620.000, thuế 5 % = 31.000, nhận 589.000", t.interest === 620000 && t.tax === 31000 && t.netInterest === 589000, JSON.stringify(t));
  kiem("savingsInfo · tổng nhận = gốc + lãi sau thuế", t.total === 10589000);
  kiem("savingsInfo · trạng thái: đang gửi / đáo hạn / đã tất toán",
    SI(8, 12, "2026-10-05", 1).status === "active" && SI(8, 12, "2025-10-05", 1).status === "matured" && L.savingsInfo({ id: "a", deposit: { rate: 8, termMonths: 12, openedOn: "2025-01-01", taxPct: 0, closedOn: "2026-01-01" } }, 1, "2026-10-05").status === "closed");
  kiem("savingsInfo · daysLeft đếm tới đáo hạn", SI(8, 12, "2026-09-10", 1).daysLeft === 340);
  kiem("savingsInfo · gốc lớn (1e12) không tràn số", SI(8.6, 12, "2026-01-01", 1e12).interest === 86000000000);
  kiem("savingsInfo · không phải sổ → null", L.savingsInfo({ id: "x" }, 1, "2026-10-05") === null);
  // Cảnh báo đáo hạn.
  let ds = soMau();
  ds = Mo.upsert(ds, "accounts", Object.assign({}, ds.accounts[1], { openingBalance: 30000000 }), NOW);
  ds = Mo.openDeposit(ds, { name: "Sổ A", fromAccountId: "a_bank", amount: 10000000, rate: 8, termMonths: 6, openedOn: "2026-04-20" }, NOW).doc;
  ds = Mo.openDeposit(ds, { name: "Sổ B", fromAccountId: "a_bank", amount: 10000000, rate: 8, termMonths: 12, openedOn: "2026-04-20" }, NOW).doc;
  const al = L.depositAlerts(ds, "2026-10-05", 30);
  kiem("depositAlerts · chỉ sổ A (đáo hạn 20/10, còn 15 ngày)", al.length === 1 && al[0].account.name === "Sổ A" && al[0].info.daysLeft === 15, JSON.stringify(al.map((x) => x.info.daysLeft)));
}

nhom("ledger · tổng kỳ, báo cáo, ngân sách, tìm kiếm");
{
  const D = QL.dates;
  let d = soMau();
  // Tuần 28/9–4/10/2026 (T2 = 28/9): chia kiểu T2–T6 / T7 / CN.
  d = them(d, { type: "expense", date: "2026-09-28", amount: 57000, note: "Cơm trưa", categoryId: "c_food" });
  d = them(d, { type: "expense", date: "2026-09-29", amount: 60000, note: "Bún chả", categoryId: "c_food" });
  d = them(d, { type: "expense", date: "2026-10-03", amount: 82000, note: "Bún chả tào phở", categoryId: "c_food", chiaCho: ["p_me", "p_x"] });
  d = them(d, { type: "expense", date: "2026-10-04", amount: 78500, note: "Nem nướng", categoryId: "c_food" });
  d = them(d, { type: "expense", date: "2026-10-01", amount: 280000, note: "Vé bus tháng 10", categoryId: "c_transport" });
  d = them(d, { type: "income", date: "2026-10-02", amount: 14607826, note: "Lương 2608", categoryId: "c_salary" });
  const wk = D.period("week", "2026-09-30");
  const s = L.periodSummary(d, wk, "2026-10-04");
  kiem("tuần · chi của tôi = 57+60+41(nửa của 82)+78,5+280", s.expense === 57000 + 60000 + 41000 + 78500 + 280000, String(s.expense));
  kiem("tuần · thu, chênh lệch", s.income === 14607826 && s.net === 14607826 - s.expense);
  kiem("tuần · chia theo danh mục xếp giảm dần, % cộng đúng ~100", s.categories[0].categoryId === "c_transport" && Math.abs(s.categories.reduce((a, c) => a + c.pct, 0) - 100) < 0.2);
  kiem("tuần · T2–T6 / T7 / CN (cách nhật ký cũ chia)", s.groups.weekdays === 57000 + 60000 + 280000 && s.groups.saturday === 41000 && s.groups.sunday === 78500, JSON.stringify(s.groups));
  kiem("tuần · theo thứ trong tuần", s.byWeekday[0] === 57000 && s.byWeekday[5] === 41000 && s.byWeekday[6] === 78500);
  kiem("tuần · số ngày mỗi nhóm trong 7 ngày", bang(s.groupDays, { weekdays: 5, saturday: 1, sunday: 1 }), JSON.stringify(s.groupDays));
  kiem("tuần · trung bình/ngày chia cho 7 ngày", s.days === 7 && s.avgPerDay === Math.round(s.expense / 7));
  const part = L.periodSummary(d, wk, "2026-09-30");
  kiem("kỳ chưa trôi hết · trung bình chỉ chia cho các ngày đã qua", part.days === 3);
  kiem("kỳ ở tương lai · days tối thiểu 1, không chia cho 0", L.periodSummary(d, D.period("month", "2027-01-01"), "2026-10-05").days === 1);
  const cmp = L.compareWithPrevious(d, D.period("week", "2026-10-07"), "2026-10-11");
  kiem("so với kỳ trước · tuần sau so tuần này", cmp.previous.expense === s.expense && cmp.expenseDelta === -s.expense && cmp.expensePct === -100);
  kiem("so với kỳ trước · kỳ 'tất cả' → null", L.compareWithPrevious(d, D.period("all", "2026-10-05"), "2026-10-05") === null);
  const ms = L.monthlySeries(d, "2026-10-15", 3);
  kiem("monthlySeries · 3 tháng cũ → mới", ms.map((m) => m.key).join() === "2026-08,2026-09,2026-10" && ms[1].expense === 57000 + 60000 && ms[2].income === 14607826);
  const top = L.topExpenses(d, D.period("month", "2026-10-01"), 2);
  kiem("topExpenses · xếp theo phần của tôi", top[0].tx.note === "Vé bus tháng 10" && top.length === 2);

  d = Mo.upsert(d, "budgets", { id: "b0", categoryId: null, amount: 1000000 }, NOW);
  d = Mo.upsert(d, "budgets", { id: "b1", categoryId: "c_food", amount: 250000 }, NOW);
  d = Mo.upsert(d, "budgets", { id: "b2", categoryId: "c_transport", amount: 600000 }, NOW);
  const bp = L.budgetProgress(d, "2026-10-01", "2026-10-04");
  const food = bp.find((x) => x.categoryId === "c_food"), tr = bp.find((x) => x.categoryId === "c_transport"), all = bp.find((x) => x.categoryId === null);
  kiem("ngân sách · thực chi, % và trạng thái", food.spent === 41000 + 78500 && tr.spent === 280000 && tr.status === "ok" && all.spent === 41000 + 78500 + 280000);
  const food2 = L.budgetProgress(Mo.upsert(d, "budgets", { id: "b1", categoryId: "c_food", amount: 140000 }, NOW), "2026-10-01", "2026-10-04").find((x) => x.categoryId === "c_food");
  kiem("ngân sách · ≥ 80 % cảnh báo (85 %)", food2.status === "warn" && food2.pct === 85.4, food2.pct + " " + food2.status);
  const food3 = L.budgetProgress(Mo.upsert(d, "budgets", { id: "b1", categoryId: "c_food", amount: 100000 }, NOW), "2026-10-01", "2026-10-04").find((x) => x.categoryId === "c_food");
  kiem("ngân sách · vượt 100 % báo 'over', không còn gợi ý theo ngày", food3.status === "over" && food3.perDay === null);
  kiem("ngân sách · còn bao nhiêu mỗi ngày (tháng đang chạy)", tr.perDay === Math.floor(320000 / 28), String(tr.perDay));
  kiem("ngân sách · tổng chi xếp đầu", bp[0].categoryId === null);

  const tx = L.filterTx(d, { q: "bun cha" });
  kiem("tìm không dấu: 'bun cha' ra 2 khoản", tx.length === 2);
  kiem("tìm theo số tiền", L.filterTx(d, { q: "280000" }).length === 1);
  kiem("tìm theo tên danh mục: 'di lai'", L.filterTx(d, { q: "di lai" }).length === 1);
  kiem("tìm theo tên người trong khoản chia: 'phuc'", L.filterTx(d, { q: "phuc" }).length === 1);
  kiem("lọc theo loại / khoảng tiền / người / chỉ khoản chung",
    L.filterTx(d, { type: "income" }).length === 1 && L.filterTx(d, { min: 80000 }).length === 3 && L.filterTx(d, { personId: "p_x" }).length === 1 && L.filterTx(d, { sharedOnly: true }).length === 1);
  kiem("lọc theo kỳ (hai đầu tính)", L.filterTx(d, { from: "2026-09-28", to: "2026-09-29" }).length === 2);
  kiem("sắp xếp mới → cũ", L.filterTx(d, {})[0].date === "2026-10-04");
  const gr = L.groupByDay(d, L.filterTx(d, { from: "2026-10-02", to: "2026-10-04" }));
  kiem("groupByDay · mỗi ngày một nhóm, tổng chi/thu", gr.length === 3 && gr[0].date === "2026-10-04" && gr[0].expense === 78500 && gr[2].income === 14607826 && gr[1].expense === 41000);
  let q = d;
  for (let i = 0; i < 3; i++) q = them(q, { type: "expense", date: "2026-10-0" + (i + 1), amount: 25000, note: "Bus 205", categoryId: "c_transport" });
  const tp = L.quickTemplates(q, 5);
  kiem("quickTemplates · cặp (ghi chú, số tiền) lặp ≥ 2 lần", tp.length === 1 && tp[0].note === "Bus 205" && tp[0].amount === 25000 && tp[0].count === 3);
}

/* ====================== parser ====================== */
nhom("parser · nhập nhanh một dòng");
{
  const P = QL.parser;
  const TODAY = "2026-10-05"; // thứ Hai
  let doc = soMau();
  doc = Mo.setSettings(doc, { defaultPartnerIds: ["p_x"] }, NOW);
  const Q = (t, d) => P.parseQuick(t, { today: TODAY, doc: d || doc });

  let r = Q("cơm mai dịch 61.5k hôm qua");
  kiem("'cơm mai dịch 61.5k hôm qua' → 61.500, hôm qua, Ăn uống", r.amount === 61500 && r.date === "2026-10-04" && r.categoryId === "c_food" && r.note === "cơm mai dịch" && r.type === "expense", JSON.stringify(r));
  r = Q("57/2 bún đậu");
  kiem("'57/2 bún đậu' → 57.000 chia đôi với Phúc, tôi trả", r.amount === 57000 && r.split && r.split.n === 2 && r.split.payerId === "p_me" && bang(r.split.participantIds, ["p_me", "p_x"]) && r.note === "bún đậu" && r.categoryId === "c_food", JSON.stringify(r));
  r = Q("57/2P bún đậu");
  kiem("'57/2P' → Phúc trả (chữ P)", r.split && r.split.payerId === "p_x", JSON.stringify(r.split));
  r = Q("57/2T cơm");
  kiem("'57/2T' → tôi trả (T = Tôi)", r.split && r.split.payerId === "p_me");
  r = Q("lương 14.916.956 10/6");
  kiem("'lương 14.916.956 10/6' → thu, 10/6, Lương", r.type === "income" && r.amount === 14916956 && r.date === "2026-06-10" && r.categoryId === "c_salary", JSON.stringify(r));
  r = Q("10/6 lương 14.916.956");
  kiem("'10/6 lương 14.916.956' (ngày đứng đầu) → như trên", r.type === "income" && r.amount === 14916956 && r.date === "2026-06-10");
  r = Q("87k - 50k voucher");
  kiem("'87k - 50k voucher' → 37.000", r.amount === 37000, JSON.stringify(r));
  r = Q("Mua quà Scoffee 87K - Voucher 50K = 37K");
  kiem("'… 87K - Voucher 50K = 37K' → 37.000 (lấy vế sau dấu =)", r.amount === 37000 && r.categoryId === "c_gift", JSON.stringify(r));
  r = Q("60+57+68+55,5+57+60+82");
  kiem("'60+57+68+55,5+57+60+82' → 439.500 (như máy tính trong PDF)", r.amount === 439500, JSON.stringify(r));
  r = Q("bus 205 25k");
  kiem("'bus 205 25k' → 25.000, '205' ở lại ghi chú, Đi lại", r.amount === 25000 && r.note === "bus 205" && r.categoryId === "c_transport", JSON.stringify(r));
  r = Q("bus 205 - 25k");
  kiem("'bus 205 - 25k' → 25.000 (dấu trừ KHÔNG biến thành phép trừ)", r.amount === 25000, JSON.stringify(r));
  r = Q("280k vé bus tháng 3");
  kiem("'280k vé bus tháng 3' → 280.000 (số 3 không phải tiền)", r.amount === 280000 && r.note === "vé bus tháng 3", JSON.stringify(r));
  r = Q("t7 trưa cơm thố 87");
  kiem("'t7 … 87' → thứ Bảy gần nhất, 87.000", r.date === "2026-10-03" && r.amount === 87000 && r.note === "trưa cơm thố", JSON.stringify(r));
  r = Q("grab 45k T6");
  kiem("'grab 45k T6' → thứ Sáu gần nhất 02/10", r.date === "2026-10-02" && r.amount === 45000 && r.categoryId === "c_transport");
  r = Q("cơm trưa 50k hôm nay");
  kiem("'hôm nay' = ngày hôm nay", r.date === TODAY);
  r = Q("bún chả 60k/2 hôm kia");
  kiem("'60k/2 hôm kia' → chia đôi, 03/10", r.amount === 60000 && r.split.n === 2 && r.date === "2026-10-03");
  r = Q("5/10 cơm 60");
  kiem("'5/10 cơm 60' → ngày 5/10, 60.000", r.date === "2026-10-05" && r.amount === 60000);
  r = Q("cơm 60 27/9");
  kiem("'cơm 60 27/9' → 27/9 là ngày (còn số tiền khác)", r.date === "2026-09-27" && r.amount === 60000);
  r = Q("25/2 bún đậu");
  kiem("'25/2 bún đậu' → chỉ có một số: hiểu là 25.000 chia đôi, KHÔNG phải ngày 25/2", r.amount === 25000 && r.split.n === 2 && r.dateGiven === false);
  r = Q("cơm 57/1");
  kiem("'/1' = không chia", r.amount === 57000 && r.split === null);
  r = Q("phúc trả cơm 57k");
  kiem("'phúc trả cơm 57k' → Phúc trả, chia đôi", r.split && r.split.payerId === "p_x" && r.note === "cơm", JSON.stringify(r));
  r = Q("cơm 120k @phuc");
  kiem("'@phuc' (không dấu) → Phúc trả", r.split && r.split.payerId === "p_x" && r.amount === 120000);
  r = Q("chuyển 2tr sang ngân hàng");
  kiem("'chuyển … sang …' → gợi ý chuyển khoản", r.type === "transfer" && r.amount === 2000000);
  r = Q("rút sổ tiết kiệm 7.718.147");
  kiem("'rút sổ tiết kiệm' → chuyển khoản, không phải chi", r.type === "transfer");
  r = Q("mua pin 5kg");
  kiem("'5kg' không phải tiền", r.amount === null && r.warnings.some((w) => /số tiền/.test(w)));
  r = Q("abc");
  kiem("không có số → amount null + cảnh báo", r.amount === null && r.warnings.length > 0);
  kiem("rỗng → null", Q("") === null && Q("   ") === null && Q(null) === null);
  r = Q("cơm 57 58");
  kiem("hai số trần → lấy số cuối, có cảnh báo", r.amount === 58000 && r.warnings.some((w) => /nhiều/.test(w)));
  r = Q("ăn tối 90k");
  kiem("không nêu ngày → hôm nay, dateGiven=false", r.date === TODAY && r.dateGiven === false);
  r = Q("cơm 5/13");
  kiem("'5/13' không phải ngày → không bị hiểu thành ngày", r.dateGiven === false);
  r = Q("🍜 bún bò 65k");
  kiem("emoji trong dòng không làm lệch chỉ số", r.amount === 65000 && r.note.indexOf("bún bò") !== -1, JSON.stringify(r));
  r = Q("<img src=x onerror=alert(1)> 20k");
  kiem("ghi chú chứa HTML được giữ NGUYÊN VĂN (thoát ở lúc hiển thị)", r.amount === 20000 && r.note.indexOf("<img") === 0);
  r = Q("57/2 cơm", Mo.emptyDoc(NOW));
  kiem("chưa có người nào để chia → cảnh báo, không nổ", r.split && r.split.participantIds.length === 1 && r.warnings.some((w) => /thêm người/.test(w)));
  r = Q("57/3 cơm");
  kiem("chia 3 mà mới có 2 người → cảnh báo", r.warnings.some((w) => /Mới có 2/.test(w)));
  r = Q("cơm 57/50");
  kiem("chia cho 50 người → bỏ phần chia + cảnh báo", r.split === null && r.warnings.some((w) => /không hợp lý/.test(w)));

  // Học từ lịch sử: thắng bảng từ khoá.
  let h = soMau();
  h = them(h, { type: "expense", date: "2026-10-01", amount: 61500, note: "Cơm mai dịch", categoryId: "c_gift" });
  r = Q("cơm mai dịch 62k", h);
  kiem("ghi chú đã gặp → dùng danh mục người dùng đã chọn (không theo từ khoá)", r.categoryId === "c_gift");
  r = Q("cơm mai dịch", h);
  kiem("…kể cả khi dòng chưa có số tiền", r.categoryId === "c_gift" && r.amount === null);
  const h2 = Mo.upsert(h, "categories", Object.assign({}, h.categories.find((c) => c.id === "c_gift"), { archived: true }), NOW);
  kiem("danh mục đã ẩn thì không được gợi ý", Q("cơm mai dịch 62k", h2).categoryId === "c_food");

  // Chuyển thành giao dịch.
  const tx = P.toTx(Q("57/2 bún đậu"), doc);
  kiem("toTx · chia đều không lệch đồng, hợp lệ", tx.split.shares.p_me + tx.split.shares.p_x === 57000 && Mo.validateTx(tx, doc).length === 0, JSON.stringify(tx));
  const tx2 = P.toTx(Q("phúc trả cơm 100001"), doc);
  kiem("toTx · Phúc trả hộ → không gắn tài khoản, vẫn hợp lệ, tổng phần = 100.001", tx2.accountId === null && tx2.split.shares.p_me + tx2.split.shares.p_x === 100001 && Mo.validateTx(tx2, doc).length === 0, JSON.stringify(tx2));
  kiem("toTx · thiếu số tiền → null", P.toTx(Q("abc"), doc) === null);
  kiem("toTx · thu nhập dùng danh mục 'Thu khác' khi không đoán được", P.toTx(Q("nhận 500k"), doc).categoryId === "c_income_other" && P.toTx(Q("nhận 500k"), doc).type === "income");
  kiem("toTx · chi không đoán được → 'Khác'", P.toTx(Q("xyz 10k"), doc).categoryId === "c_other");
}

nhom("parser · dán nhiều dòng (dòng thật trong PDF)");
{
  const P = QL.parser;
  const doc = Mo.setSettings(soMau(), { defaultPartnerIds: ["p_x"] }, NOW);
  const rows = P.parseLines([
    "Tháng 3 tuần 2:",
    "27/2: vé xe buýt tháng 3: 280K",
    "1/3: Mua data 4G 12 tháng: 840K",
    "2/3: Đi be về: 24K",
    "2/3: Thưởng PI: 19.485.250",
    "",
    "T2-T6: 72/2 (chè) + 0 (mỳ xôi) + 43/1 (bún đậu) + 57/2 (mỳ)",
    "Tổng Phúc = 258 + 20 = 278",
    "Chuyển Thiệp: 228K",
    "22/04: Rút sổ tiết kiệm 7.718.147",
    "04/08: Be OT từ SRV về trọ 20K",
    "Cắt tóc bác Chữ",
    "03/05: Gia hạn vé xe bus tháng 5: 280K",
    "Shopping 16/6/2026",
    "11/4: Nhận lương + quyết toán thuế: 17.342.381"
  ].join("\n"), { today: "2026-10-05", doc });
  const by = (n) => rows.find((r) => r.line.indexOf(n) === 0);
  let r = by("27/2");
  kiem("'27/2: vé xe buýt tháng 3: 280K' → 27/02, 280.000, Đi lại", r.status === "ok" && r.tx.date === "2026-02-27" && r.tx.amount === 280000 && r.tx.categoryId === "c_transport" && r.tx.note === "vé xe buýt tháng 3", JSON.stringify(r.tx));
  r = by("1/3");
  kiem("'1/3: Mua data 4G 12 tháng: 840K' → 840.000, Nhà trọ & hoá đơn", r.status === "ok" && r.tx.amount === 840000 && r.tx.categoryId === "c_housing", JSON.stringify(r.tx));
  r = by("2/3: Đi be");
  kiem("'2/3: Đi be về: 24K' → 24.000, Đi lại", r.status === "ok" && r.tx.amount === 24000 && r.tx.categoryId === "c_transport" && r.tx.date === "2026-03-02");
  r = by("2/3: Thưởng");
  kiem("'2/3: Thưởng PI: 19.485.250' → thu, Thưởng", r.status === "ok" && r.tx.type === "income" && r.tx.amount === 19485250 && r.tx.categoryId === "c_bonus", JSON.stringify(r.tx));
  r = by("11/4");
  kiem("'11/4: Nhận lương + quyết toán thuế: 17.342.381' → thu 17.342.381", r.status === "ok" && r.tx.type === "income" && r.tx.amount === 17342381 && r.tx.date === "2026-04-11", JSON.stringify(r.tx));
  kiem("tiêu đề tuần → bỏ qua", by("Tháng 3").status === "skip");
  kiem("dòng Tổng / Chuyển → bỏ qua", by("Tổng").status === "skip" && by("Chuyển").status === "skip");
  kiem("'T2-T6: …' gộp nhiều khoản → không hiểu, nói rõ lý do", by("T2-T6").status === "unclear" && /nhiều ngày/.test(by("T2-T6").reason));
  kiem("'Rút sổ tiết kiệm' → KHÔNG được nhập thành khoản chi", by("22/04").status === "unclear" && /chuyển/i.test(by("22/04").reason), by("22/04").status + " " + by("22/04").reason);
  kiem("'Cắt tóc bác Chữ' (không có số tiền) → không hiểu", by("Cắt").status === "unclear");
  kiem("'Shopping 16/6/2026' (ghi chú) → bỏ qua", by("Shopping").status === "skip");
  kiem("'04/08: Be OT từ SRV về trọ 20K' → 04/08, 20.000", by("04/08").tx.date === "2026-08-04" && by("04/08").tx.amount === 20000);
  kiem("dòng trống không thành hàng", rows.every((x) => x.line.length > 0) && rows.length === 14);
  kiem("mọi dòng 'ok' đều hợp lệ theo validateTx", rows.filter((x) => x.status === "ok").every((x) => Mo.validateTx(x.tx, doc).length === 0));
  const again = P.parseLines("27/2: vé xe buýt tháng 3: 280K", { today: "2026-10-05", doc });
  const withTx = them(doc, Object.assign({}, again[0].tx));
  kiem("nhập lại cùng dòng → phát hiện trùng", QL.ledger.findDuplicate(withTx, again[0].tx) !== null && QL.ledger.findDuplicate(doc, again[0].tx) === null);
}

/* ====================== sync.merge ====================== */
nhom("sync · gộp hai tài liệu");
{
  const S = QL.sync;
  const T1 = "2026-10-01T00:00:00.000Z", T2 = "2026-10-02T00:00:00.000Z", T3 = "2026-10-03T00:00:00.000Z", T4 = "2026-10-04T00:00:00.000Z";
  const base = soMau();
  const tx = (id, amount, at) => ({ id, type: "expense", date: "2026-10-01", amount, categoryId: "c_food", accountId: "a_cash", note: id, tags: [], createdAt: T1, updatedAt: at });
  const withTx = (d, ...list) => Object.assign({}, d, { transactions: list });
  const M = (a, b) => S.merge(a, b, T4);

  const a = withTx(base, tx("t1", 100, T2), tx("t2", 200, T2));
  const b = withTx(base, tx("t2", 250, T3), tx("t3", 300, T2));
  const m = M(a, b);
  kiem("thêm ở hai nơi → có đủ cả ba, không nhân đôi", m.transactions.map((t) => t.id).join() === "t1,t2,t3");
  kiem("cùng bản ghi sửa hai nơi → bản MUỘN hơn thắng", m.transactions.find((t) => t.id === "t2").amount === 250);
  kiem("gộp giao hoán: merge(a,b) = merge(b,a)", S.canon(M(a, b)) === S.canon(M(b, a)));
  kiem("gộp lặp lại không đổi: merge(a,a) = a", S.canon(M(a, a)) === S.canon(M(a, a)) && M(a, a).transactions.length === 2);

  // Xoá.
  const del = Mo.remove(withTx(base, tx("t1", 100, T2)), "transactions", "t1", T3);
  const stale = withTx(base, tx("t1", 100, T2));
  kiem("xoá ở A, B còn bản cũ → bị xoá (không sống lại)", M(del, stale).transactions.length === 0 && M(stale, del).transactions.length === 0);
  const edited = withTx(base, tx("t1", 999, T4));
  kiem("xoá (T3) rồi sửa MUỘN hơn ở B (T4) → sống lại và gỡ bia mộ", M(del, edited).transactions.length === 1 && M(del, edited).transactions[0].amount === 999 && M(del, edited).tombstones.transactions.t1 === undefined);
  const editedOld = withTx(base, tx("t1", 999, T2));
  kiem("sửa CŨ hơn lần xoá → vẫn bị xoá", M(del, editedOld).transactions.length === 0);
  kiem("bia mộ giữ khi gộp", M(del, stale).tombstones.transactions.t1 === T3);
  kiem("bia mộ quá 90 ngày bị dọn", S.merge(del, stale, "2027-03-01T00:00:00.000Z").tombstones.transactions.t1 === undefined);

  // Cài đặt: bản muộn hơn thắng.
  const sa = Mo.setSettings(base, { theme: "dark" }, T2), sb = Mo.setSettings(base, { theme: "light" }, T3);
  kiem("cài đặt: bản muộn hơn thắng, giao hoán", M(sa, sb).settings.theme === "light" && M(sb, sa).settings.theme === "light");

  // Ngẫu nhiên: ba tính chất.
  const r = rng(2026);
  function ngauNhien() {
    let d = soMau();
    const n = Math.floor(r() * 8);
    for (let i = 0; i < n; i++) {
      const id = "t" + Math.floor(r() * 10), at = "2026-10-0" + (1 + Math.floor(r() * 3)) + "T00:00:00.000Z";
      if (r() < 0.25) d = Mo.remove(d, "transactions", id, at);
      else d = Mo.upsert(d, "transactions", tx(id, 1 + Math.floor(r() * 5) * 100, at), at);
    }
    if (r() < 0.5) d = Mo.setSettings(d, { theme: r() < 0.5 ? "dark" : "light" }, "2026-10-0" + (1 + Math.floor(r() * 3)) + "T00:00:00.000Z");
    return d;
  }
  let giaoHoan = true, ketHop = true, luyDang = true, loi = "";
  for (let i = 0; i < 400; i++) {
    const x = ngauNhien(), y = ngauNhien(), z = ngauNhien();
    if (S.canon(M(x, y)) !== S.canon(M(y, x))) { giaoHoan = false; loi = "giao hoán #" + i; }
    if (S.canon(M(M(x, y), z)) !== S.canon(M(x, M(y, z)))) { ketHop = false; loi = "kết hợp #" + i; }
    if (S.canon(M(M(x, y), M(x, y))) !== S.canon(M(x, y))) { luyDang = false; loi = "lũy đẳng #" + i; }
  }
  kiem("400 bộ ngẫu nhiên · GIAO HOÁN", giaoHoan, loi);
  kiem("400 bộ ngẫu nhiên · KẾT HỢP", ketHop, loi);
  kiem("400 bộ ngẫu nhiên · LŨY ĐẲNG", luyDang, loi);
  let giuDuoc = true;
  for (let i = 0; i < 200; i++) {
    const x = ngauNhien(), y = ngauNhien(), mm = M(x, y);
    // Mọi id còn sống ở x hoặc y mà KHÔNG có bia mộ mới hơn thì phải có mặt.
    [x, y].forEach((d) => d.transactions.forEach((t) => {
      const tb = mm.tombstones.transactions[t.id];
      if (!mm.transactions.some((q) => q.id === t.id) && !(tb && tb >= t.updatedAt)) giuDuoc = false;
    }));
  }
  kiem("200 bộ ngẫu nhiên · không bản ghi nào biến mất mà không có bia mộ tương ứng", giuDuoc);
  kiem("merge · không sửa đầu vào", (() => { const x = ngauNhien(), before = S.canon(x); M(x, ngauNhien()); return S.canon(x) === before; })());
  kiem("countChanges · đếm thêm / đổi / xoá", S.countChanges(a, m) === 2 && S.countChanges(m, m) === 0, String(S.countChanges(a, m)));
}

/* ====================== csv ====================== */
nhom("csv · xuất và nhập");
{
  const C = QL.csv;
  let d = soMau();
  d = them(d, { type: "expense", date: "2026-10-03", amount: 82000, note: "Bún chả, \"tào phở\"\nlần 2", categoryId: "c_food", chiaCho: ["p_me", "p_x"], tra: "p_x", accountId: null });
  d = them(d, { type: "expense", date: "2026-10-01", amount: 280000, note: "=HYPERLINK(\"http://x\")", categoryId: "c_transport", tags: ["#bus", "#thang"] });
  d = them(d, { type: "income", date: "2026-10-02", amount: 14607826, note: "Lương", categoryId: "c_salary" });
  d = them(d, { type: "transfer", date: "2026-10-04", amount: 500000, toAccountId: "a_bank", categoryId: null, note: "Gửi ngân hàng" });
  d = them(d, { type: "settle", date: "2026-10-04", amount: 128750, personId: "p_x", direction: "in", categoryId: null });
  const csv = C.toCsv(d);
  kiem("xuất · có BOM UTF-8 và dòng tiêu đề", csv.charCodeAt(0) === 0xFEFF && csv.indexOf("ngay,loai,so_tien") === 1);
  kiem("xuất · ô có dấu phẩy / nháy / xuống dòng được bọc nháy và nhân đôi nháy", csv.indexOf('"Bún chả, ""tào phở""\nlần 2"') !== -1);
  kiem("xuất · chống CSV injection (= + - @ đầu ô)", csv.indexOf("'=HYPERLINK") !== -1 && !/,=HYPERLINK/.test(csv));
  kiem("xuất · sắp xếp theo ngày", csv.indexOf("2026-10-01") < csv.indexOf("2026-10-02") && csv.indexOf("2026-10-02") < csv.indexOf("2026-10-03"));
  const table = C.parseCsv(csv);
  kiem("parseCsv · số dòng/cột khớp (nháy, xuống dòng trong ô)", table.length === 6 && table.every((r) => r.length === C.HEADERS.length) && C.HEADERS.length === 11, table.map((r) => r.length).join());
  kiem("parseCsv · khôi phục đúng ô nhiều dòng", table.some((r) => r[6] === 'Bún chả, "tào phở"\nlần 2'));
  kiem("parseCsv · dấu ; (Excel tiếng Việt)", C.parseCsv("a;b;c\n1;2;3").length === 2 && C.parseCsv("a;b;c\n1;2;3")[1][2] === "3");
  kiem("parseCsv · CRLF và dòng cuối không xuống dòng", C.parseCsv("a,b\r\n1,2").length === 2);

  const empty = Mo.setSettings(soMau(), {}, NOW);
  const res = C.fromCsv(csv, empty, "2026-10-05");
  kiem("nhập · mọi dòng hợp lệ đều đọc được", res.error === null && res.rows.length === 5 && res.rows.every((r) => r.errors.length === 0), JSON.stringify(res.rows.map((r) => r.errors)));
  const got = C.applyImport(empty, res, {}, NOW);
  kiem("nhập · thêm đủ 5 giao dịch", got.added === 5 && got.doc.transactions.length === 5);
  const orig = L.accountBalances(d), back = L.accountBalances(got.doc);
  kiem("vòng tròn · số dư tài khoản sau nhập = trước khi xuất", orig.a_cash === back.a_cash && orig.a_bank === back.a_bank, JSON.stringify([orig, back]));
  kiem("vòng tròn · nợ với Phúc giữ nguyên", L.personBalances(got.doc).p_x === L.personBalances(d).p_x, JSON.stringify(L.personBalances(got.doc)));
  const sharedBack = got.doc.transactions.find((t) => t.split);
  kiem("vòng tròn · khoản chung giữ người trả và phần chia", sharedBack.split.paidBy === "p_x" && sharedBack.split.shares.p_me + sharedBack.split.shares.p_x === 82000 && Mo.validateTx(sharedBack, got.doc).length === 0);
  kiem("vòng tròn · ô công thức được gỡ dấu ' khi nhập lại", got.doc.transactions.some((t) => t.note === '=HYPERLINK("http://x")'));
  const res2 = C.fromCsv(csv, got.doc, "2026-10-05");
  kiem("nhập lại cùng file → mọi dòng bị đánh dấu TRÙNG", res2.rows.every((r) => r.duplicate), JSON.stringify(res2.rows.map((r) => r.duplicate)));
  kiem("nhập lại, bỏ trùng → thêm 0", C.applyImport(got.doc, res2, {}, NOW).added === 0);

  const bad = C.fromCsv("ngay,so_tien,loai,danh_muc\n32/13,100,chi,x\n2026-10-01,abc,chi,x\n2026-10-01,5000,bay,x\n2026-10-01,5000,chi,Cà phê", empty, "2026-10-05");
  kiem("nhập · dòng lỗi được báo từng dòng, dòng tốt vẫn đọc được", bad.rows[0].errors.length === 1 && bad.rows[1].errors.length === 1 && bad.rows[2].errors.length === 1 && bad.rows[3].errors.length === 0, JSON.stringify(bad.rows.map((r) => r.errors)));
  kiem("nhập · danh mục chưa có được hẹn tạo", bad.create.categories.length === 1 && bad.create.categories[0].name === "Cà phê");
  const created = C.applyImport(empty, bad, {}, NOW);
  kiem("nhập · tạo danh mục mới và gắn đúng", created.added === 1 && created.doc.categories.some((c) => c.name === "Cà phê") && created.doc.transactions[0].categoryId === created.doc.categories.find((c) => c.name === "Cà phê").id);
  kiem("nhập · không tạo danh mục thừa cho dòng lỗi", C.applyImport(empty, C.fromCsv("ngay,so_tien,loai,danh_muc\n32/13,100,chi,Thừa", empty, "2026-10-05"), {}, NOW).doc.categories.length === empty.categories.length);
  kiem("nhập · thiếu cột bắt buộc → báo lỗi rõ", /Thiếu cột/.test(C.fromCsv("a,b\n1,2", empty).error) && C.fromCsv("", empty).error === "File trống");
  const chiaBad = C.fromCsv("ngay,so_tien,loai,danh_muc,chia\n2026-10-01,100000,chi,Ăn uống,Tôi=40000;Phúc=40000", empty, "2026-10-05");
  kiem("nhập · tổng phần chia lệch bị từ chối", chiaBad.rows[0].errors.length === 1);
  const vn = C.fromCsv("Ngày;Loại;Số tiền;Danh mục\n05/10/2026;chi;57.000;Ăn uống", empty, "2026-10-05");
  kiem("nhập · tiêu đề có dấu, dấu ; và số kiểu Việt", vn.error === null && vn.rows[0].tx && vn.rows[0].tx.amount === 57000 && vn.rows[0].tx.date === "2026-10-05", JSON.stringify(vn));
}

/* ====================== charts ====================== */
nhom("charts · SVG");
{
  const CH = QL.charts;
  /** Kiểm tra XML đủ tốt cho SVG tự sinh: thẻ đóng/mở khớp, thuộc tính có nháy, không có NaN/undefined. */
  function hopLe(svg) {
    if (/NaN|undefined|Infinity/.test(svg)) return false;
    const stack = [], re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z0-9:-]+="[^"]*")*)\s*(\/?)>/g;
    let m, pos = 0;
    while ((m = re.exec(svg)) !== null) {
      if (svg.slice(pos, m.index).replace(/[^<>]/g, "").length) return false; // '<' hoặc '>' lạc
      pos = m.index + m[0].length;
      if (m[4]) continue;
      if (m[1]) { if (stack.pop() !== m[2]) return false; } else stack.push(m[2]);
    }
    return stack.length === 0 && svg.slice(pos).replace(/[^<>]/g, "") === "";
  }
  const items = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), values: [i % 4 === 0 ? 0 : i * 10000] }));
  kiem("bars · 31 cột hợp lệ", hopLe(CH.bars(items, { format: QL.money.compact })), CH.bars(items).slice(0, 120));
  kiem("bars · không dữ liệu → có chữ 'Chưa có dữ liệu', vẫn hợp lệ", hopLe(CH.bars([])) && /Chưa có dữ liệu/.test(CH.bars([])));
  kiem("bars · toàn số 0 không chia cho 0", hopLe(CH.bars([{ label: "a", values: [0] }, { label: "b", values: [0] }])));
  kiem("bars · giá trị NaN/âm/chuỗi không làm hỏng", hopLe(CH.bars([{ label: "a", values: [NaN] }, { label: "b", values: ["x"] }, { label: "c", values: [-5] }])));
  kiem("bars · hai chuỗi (thu/chi)", hopLe(CH.bars([{ label: "T9", values: [1000, 2000] }], { series: [{ cls: "b-a" }, { cls: "b-b" }] })) && /b-b/.test(CH.bars([{ label: "T9", values: [1000, 2000] }], { series: [{ cls: "b-a" }, { cls: "b-b" }] })));
  kiem("bars · nhãn bị thoát HTML", !/<script/.test(CH.bars([{ label: "<script>x</script>", values: [1] }])) && hopLe(CH.bars([{ label: "<script>x</script>", values: [1] }])));
  kiem("bars · tối đa ~12 nhãn trục x với 31 cột", (CH.bars(items).match(/text-anchor="middle"/g) || []).length <= 12);
  kiem("niceMax · cận trên = 4 bước tròn", CH.niceMax(0) === 1 && CH.niceMax(87) === 100 && CH.niceMax(280000) === 400000 && CH.niceMax(57000) === 80000 && CH.niceMax(1) === 1, [CH.niceMax(87), CH.niceMax(280000), CH.niceMax(57000)].join());
  const sl = [{ label: "Ăn uống", value: 600, color: "#e8806a" }, { label: "Đi lại", value: 400, color: "#e0a050" }];
  kiem("donut · hợp lệ, có tooltip phần trăm", hopLe(CH.donut(sl)) && /60%/.test(CH.donut(sl)) && /40%/.test(CH.donut(sl)));
  kiem("donut · một lát 100 %", hopLe(CH.donut([sl[0]])));
  kiem("donut · không dữ liệu / toàn 0", hopLe(CH.donut([])) && hopLe(CH.donut([{ label: "a", value: 0 }])));
  kiem("donut · màu bị thoát (không chèn được thuộc tính)", hopLe(CH.donut([{ label: "a", value: 1, color: '"><script>' }])));
}

/* ====================== store: động cơ đồng bộ ====================== */
nhom("store · đồng bộ với máy chủ giả (đúng hợp đồng /spending)");
{
  const ST = QL.store;

  /** localStorage giả; `day` = true khiến mọi lần ghi ném lỗi như khi đầy dung lượng. */
  function khoGia() {
    const m = new Map();
    return { m, day: false,
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem(k, v) { if (this.day) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
      removeItem: (k) => m.delete(k) };
  }
  /** Máy chủ giả: cùng hợp đồng với backend (envelope, 401/404/409, since). */
  function mayChuGia() {
    const ws = new Map(); let demId = 0;
    const s = { ws, offline: false, loi5xx: false, soPut: 0, soGet: 0, quaLon: false, log: [],
      fetch: async (url, init) => {
        s.log.push(init.method + " " + url);
        if (s.offline) throw new Error("Failed to fetch");
        if (s.loi5xx) return resp(503, { message: "Service Unavailable" });
        const u = new URL(url, "http://x"), p = u.pathname.replace(/^.*\/spending/, "");
        const key = init.headers["X-Workspace-Key"], body = init.body ? JSON.parse(init.body) : null;
        const be = u.searchParams.get("backend");
        if (p === "/backends") return resp(200, { data: { default: "json", backends: [{ id: "mysql", available: true }, { id: "mongo", available: false, reason: "chưa cấu hình" }] } });
        if (p === "/workspaces" && init.method === "POST") {
          if (s.quaLon) return resp(400, { message: "Dữ liệu vượt giới hạn" });
          const id = "sp_" + (++demId), k = "key" + demId;
          ws.set(id, { id, key: k, backend: be, revision: 1, data: body.data || {}, name: body.name });
          return resp(201, { data: { id, name: body.name, access_key: k, revision: 1 } });
        }
        const m = /^\/workspaces\/([^/]+)$/.exec(p);
        const w = m && ws.get(decodeURIComponent(m[1]));
        if (!w) return resp(404, { message: "Workspace không tồn tại" });
        if (key !== w.key) return resp(401, { message: "Access key không đúng" });
        const view = () => ({ id: w.id, name: w.name, revision: w.revision, data: w.data });
        if (init.method === "GET") {
          s.soGet++;
          const since = u.searchParams.get("since");
          if (since !== null && +since === w.revision) return resp(200, { data: { id: w.id, revision: w.revision, unchanged: true, data: null } });
          return resp(200, { data: view() });
        }
        if (init.method === "PUT") {
          s.soPut++;
          if (s.quaLon) return resp(400, { message: "Dữ liệu vượt giới hạn" });
          if (body.revision !== w.revision) return resp(409, { message: "xung đột", data: { current: view() } });
          w.data = body.data; w.revision++;
          return resp(200, { data: view() });
        }
        if (init.method === "DELETE") { ws.delete(w.id); return resp(200, { data: { deleted: true } }); }
        return resp(405, { message: "?" });
      } };
    function resp(status, body) { return { status, ok: status < 300, json: async () => Object.assign({ status_code: status, message: "OK" }, body) }; }
    return s;
  }
  /** Hẹn giờ giả: không chạy thật, chỉ chạy khi gọi `chay()`. */
  function henGioGia() {
    let id = 0; const q = new Map();
    return { setTimeout: (fn) => { q.set(++id, fn); return id; }, clearTimeout: (i) => q.delete(i),
      dem: () => q.size, async chay() { const l = [...q.values()]; q.clear(); for (const f of l) await f(); } };
  }
  function mayTinh(kho, server, opt) {
    opt = opt || {};
    const timers = henGioGia(); const lich = [];
    const eng = ST.createEngine({
      storage: kho, fetch: (u, i) => server.fetch(u, i), now: () => new Date("2026-10-05T01:00:00.000Z"),
      setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, apiBase: () => "http://localhost:6789/api/v1",
      onStatus: () => {}, onDoc: (d, why) => lich.push(why)
    });
    return { eng, timers, lich };
  }
  const chi = (id, amount, at) => (d) => Mo.upsert(d, "transactions", { id, type: "expense", date: "2026-10-05", amount, categoryId: "c_food", accountId: "a_cash", note: id, tags: [] }, at);
  const T1 = "2026-10-05T01:00:01.000Z", T2 = "2026-10-05T01:00:02.000Z", T3 = "2026-10-05T01:00:03.000Z";

  (async function () {
    /* ---- chế độ Máy này ---- */
    let kho = khoGia(), sv = mayChuGia();
    let a = mayTinh(kho, sv);
    await a.eng.init();
    kiem("local · lần đầu: sổ mặc định, chế độ local, không gọi mạng", a.eng.getMode() === "local" && a.eng.getDoc().people.length === 1 && sv.log.length === 0);
    a.eng.mutate(chi("t1", 57000, T1));
    kiem("local · sửa được ghi NGAY vào localStorage", JSON.parse(kho.getItem("qlct.doc.local")).transactions.length === 1);
    kiem("local · không hẹn đẩy lên máy chủ", a.timers.dem() === 0 && sv.log.length === 0);
    let b = mayTinh(kho, sv); await b.eng.init();
    kiem("local · mở lại (engine mới, cùng kho) vẫn còn dữ liệu", b.eng.getDoc().transactions.length === 1 && b.eng.getDoc().transactions[0].amount === 57000);
    kiem("local · mutate cùng tài liệu không làm gì (không ghi, không báo)", (() => { const n = b.lich.length; b.eng.mutate((d) => d); return b.lich.length === n; })());

    kho = khoGia(); kho.setItem("qlct.doc.local", "{không phải json"); sv = mayChuGia();
    a = mayTinh(kho, sv); await a.eng.init();
    kiem("local · JSON hỏng → sổ trống, bản gốc được GIỮ LẠI để cứu, có cảnh báo", a.eng.getDoc().transactions.length === 0
      && [...kho.m.keys()].some((k) => k.indexOf("qlct.corrupt.local") === 0) && a.eng.getStatus().localError !== "");
    kho = khoGia(); a = mayTinh(kho, sv); await a.eng.init();
    kho.day = true;
    let ne = false; try { a.eng.mutate(chi("t1", 1000, T1)); } catch (e) { ne = true; }
    kiem("local · đầy bộ nhớ: KHÔNG ném lỗi, vẫn giữ trong bộ nhớ, báo lỗi rõ", !ne && a.eng.getDoc().transactions.length === 1 && /đầy/.test(a.eng.getStatus().localError));
    kho.day = false; a.eng.mutate(chi("t2", 2000, T2));
    kiem("local · hết đầy thì cảnh báo tự gỡ", a.eng.getStatus().localError === "");

    /* ---- nối máy chủ ---- */
    kho = khoGia(); sv = mayChuGia();
    a = mayTinh(kho, sv); await a.eng.init();
    a.eng.mutate(chi("t1", 57000, T1));
    let kq = await a.eng.connectNew("mysql", "Sổ của tôi");
    kiem("connectNew · tạo không gian, trả mã id.khoá, chuyển sang mysql", kq.ok && /^sp_\d+\.key\d+$/.test(kq.code) && a.eng.getMode() === "mysql", JSON.stringify(kq));
    kiem("connectNew · dữ liệu đang có được đẩy lên ngay trong lần tạo", sv.ws.get("sp_1").data.transactions.length === 1 && sv.ws.get("sp_1").backend === "mysql");
    kiem("connectNew · mã tách lại đúng", bang(ST.parseCode(kq.code), { id: "sp_1", key: "key1" }) && ST.parseCode("khongco") === null && ST.parseCode(".x") === null && ST.parseCode("x.") === null);
    kiem("connectNew · trạng thái 'saved'", a.eng.getStatus().state === "saved");

    a.eng.mutate(chi("t2", 60000, T2));
    kiem("mysql · sửa → ghi cục bộ ngay, trạng thái 'pending', CHƯA gọi máy chủ", a.eng.getStatus().state === "pending" && sv.soPut === 0 && a.timers.dem() === 1);
    a.eng.mutate(chi("t3", 70000, T2)); a.eng.mutate(chi("t4", 80000, T2));
    kiem("mysql · nhiều lần sửa liên tiếp chỉ có MỘT hẹn đẩy (debounce)", a.timers.dem() === 1);
    await a.timers.chay();
    kiem("mysql · hết thời gian chờ → đúng 1 lần PUT chứa cả 4 giao dịch", sv.soPut === 1 && sv.ws.get("sp_1").data.transactions.length === 4 && sv.ws.get("sp_1").revision === 2);
    kiem("mysql · xong → 'saved', revision cập nhật, hết 'dirty'", a.eng.getStatus().state === "saved" && a.eng.getConn().revision === 2 && !a.eng.getStatus().pending);

    /* ---- hai thiết bị ---- */
    const kho2 = khoGia();
    const bb = mayTinh(kho2, sv); await bb.eng.init();
    kq = await bb.eng.connectExisting("mysql", a.eng.getConn().code, "replace");
    kiem("connectExisting(replace) · thiết bị 2 nhận đủ 4 giao dịch", kq.ok && bb.eng.getDoc().transactions.length === 4 && bb.eng.getMode() === "mysql");
    kiem("connectExisting(replace) · sổ cũ trên máy 2 được giữ để hoàn tác", kho2.getItem("qlct.undo.mysql") !== null);

    a.eng.mutate(chi("tA", 11000, T2));                    // A sửa, chưa đẩy
    bb.eng.mutate(chi("tB", 22000, T2));                   // B sửa
    await bb.eng.push();                                  // B lên trước → revision 3
    kiem("2 thiết bị · B đẩy trước thành công", sv.ws.get("sp_1").revision === 3);
    await a.eng.push();                                   // A đẩy với revision cũ → 409 → gộp → thử lại
    const sd = sv.ws.get("sp_1").data.transactions.map((t) => t.id).sort().join();
    kiem("2 thiết bị · A gặp 409 → GỘP rồi đẩy lại: máy chủ có đủ cả tA lẫn tB", sd === "t1,t2,t3,t4,tA,tB", sd);
    kiem("2 thiết bị · A nay cũng có tB, revision khớp máy chủ", a.eng.getDoc().transactions.some((t) => t.id === "tB") && a.eng.getConn().revision === sv.ws.get("sp_1").revision && a.eng.getStatus().state === "saved");
    kiem("2 thiết bị · A được báo 'đã gộp' để hiện thông báo", a.lich.some((w) => /^merged:[1-9]/.test(w)), a.lich.join());
    await bb.eng.pull();
    kiem("2 thiết bị · B kéo về cũng thấy tA", bb.eng.getDoc().transactions.some((t) => t.id === "tA") && bb.eng.getDoc().transactions.length === 6);

    // Cùng một bản ghi sửa hai nơi.
    a.eng.mutate(chi("t1", 100000, T3)); await a.eng.push();
    bb.eng.mutate(chi("t1", 200000, "2026-10-05T01:00:09.000Z")); await bb.eng.push();
    await a.eng.pull();
    kiem("2 thiết bị · cùng bản ghi sửa 2 nơi: bản MUỘN hơn thắng ở cả hai", a.eng.getDoc().transactions.find((t) => t.id === "t1").amount === 200000 && bb.eng.getDoc().transactions.find((t) => t.id === "t1").amount === 200000);
    // Xoá ở một nơi.
    bb.eng.mutate((d) => Mo.remove(d, "transactions", "t2", "2026-10-05T01:00:10.000Z")); await bb.eng.push();
    a.eng.mutate(chi("tC", 3000, "2026-10-05T01:00:11.000Z")); await a.eng.push();
    kiem("2 thiết bị · xoá ở B + thêm ở A: kết quả có tC, KHÔNG còn t2, ở cả hai", !a.eng.getDoc().transactions.some((t) => t.id === "t2") && a.eng.getDoc().transactions.some((t) => t.id === "tC")
      && !sv.ws.get("sp_1").data.transactions.some((t) => t.id === "t2") && sv.ws.get("sp_1").data.transactions.some((t) => t.id === "tC"));

    /* ---- pull ---- */
    sv.soGet = 0; const logN = sv.log.length;
    await a.eng.pull(); await a.eng.pull();
    kiem("pull · revision không đổi → máy chủ trả 'unchanged', sổ không đổi", sv.log.slice(logN).every((l) => /since=\d+/.test(l)) && a.eng.getStatus().state === "saved");

    /* ---- offline ---- */
    sv.offline = true;
    a.eng.mutate(chi("tOff", 5000, T3));
    await a.eng.push();
    kiem("offline · KHÔNG mất dữ liệu: vẫn ở sổ và ở localStorage, trạng thái 'offline', còn dirty",
      a.eng.getDoc().transactions.some((t) => t.id === "tOff") && a.eng.getStatus().state === "offline" && a.eng.getStatus().pending
      && JSON.parse(kho.getItem("qlct.doc.mysql")).transactions.some((t) => t.id === "tOff"));
    kiem("offline · tự hẹn thử lại", a.timers.dem() >= 1);
    sv.offline = false;
    await a.timers.chay();
    kiem("online lại · thử lại thành công, máy chủ có tOff", sv.ws.get("sp_1").data.transactions.some((t) => t.id === "tOff") && a.eng.getStatus().state === "saved");
    // Mở lại app khi còn dirty.
    sv.offline = true; a.eng.mutate(chi("tOff2", 6000, T3)); await a.eng.push();
    sv.offline = false;
    const re = mayTinh(kho, sv); await re.eng.init();
    kiem("tắt app lúc offline rồi mở lại · tự đẩy phần còn dirty", sv.ws.get("sp_1").data.transactions.some((t) => t.id === "tOff2") && re.eng.getStatus().state === "saved");

    sv.loi5xx = true; a.eng.mutate(chi("t5xx", 1, T3)); await a.eng.push();
    kiem("máy chủ 503 · coi như tạm thời: 'offline', giữ dirty, thử lại", a.eng.getStatus().state === "offline" && /Unavailable/.test(a.eng.getStatus().message));
    sv.loi5xx = false; await a.timers.chay();
    kiem("503 hết · tự lành", a.eng.getStatus().state === "saved");

    /* ---- lỗi vĩnh viễn ---- */
    const hu = mayTinh(khoGia(), sv); await hu.eng.init();
    hu.eng.mutate(chi("x1", 100, T1));
    await hu.eng.connectNew("mysql", "x");
    const wsId = hu.eng.getConn().id;
    sv.ws.get(wsId).key = "doi-khoa";
    hu.eng.mutate(chi("x2", 100, T1)); await hu.eng.push();
    kiem("401 · báo 'auth', KHÔNG mất dữ liệu, không thử lại mãi", hu.eng.getStatus().state === "auth" && hu.eng.getDoc().transactions.length === 2 && hu.timers.dem() === 0, hu.eng.getStatus().state);
    sv.ws.delete(wsId);
    hu.eng.mutate(chi("x3", 100, T1)); await hu.eng.push();
    kiem("404 (không gian bị xoá) · báo 'missing', dữ liệu còn nguyên", hu.eng.getStatus().state === "missing" && hu.eng.getDoc().transactions.length === 3);
    sv.quaLon = true;
    const lon = mayTinh(khoGia(), sv); await lon.eng.init();
    kq = await lon.eng.connectNew("mysql", "x");
    kiem("tài liệu quá lớn khi tạo · báo lỗi rõ, vẫn ở chế độ Máy này", !kq.ok && /giới hạn/.test(kq.message) && lon.eng.getMode() === "local");
    sv.quaLon = false;

    /* ---- connectExisting ---- */
    const mc = mayChuGia(); const x = mayTinh(khoGia(), mc), y = mayTinh(khoGia(), mc);
    await x.eng.init(); await y.eng.init();
    x.eng.mutate(chi("tx", 1000, T1)); const code = (await x.eng.connectNew("mongo", "m")).code;
    y.eng.mutate(chi("ty", 2000, T2));
    kq = await y.eng.connectExisting("mongo", code, "merge");
    const idsM = mc.ws.get("sp_1").data.transactions.map((t) => t.id).sort().join();
    kiem("connectExisting(merge) · gộp dữ liệu máy với máy chủ và đẩy kết quả lên", kq.ok && idsM === "tx,ty" && y.eng.getDoc().transactions.length === 2, idsM);
    kq = await y.eng.connectExisting("mongo", "sp_1.saikhoa", "merge");
    kiem("connectExisting · khoá sai → báo lỗi, không đổi trạng thái", !kq.ok && /Khoá/.test(kq.message) && y.eng.getMode() === "mongo");
    kq = await y.eng.connectExisting("mongo", "sp_99.key", "merge");
    kiem("connectExisting · không có không gian → báo lỗi", !kq.ok && /Không tìm thấy/.test(kq.message));
    kq = await y.eng.connectExisting("mongo", "hỏng", "merge");
    kiem("connectExisting · mã sai định dạng → báo lỗi", !kq.ok && /Mã kết nối/.test(kq.message));
    kq = await y.eng.connectExisting("oracle", code, "merge");
    kiem("connectExisting · kho lạ bị từ chối", !kq.ok);

    /* ---- sao chép sang kho khác, về máy, xoá ---- */
    kq = await y.eng.connectNew("mysql", "bản sao");
    kiem("sao chép sang kho khác · kho mới nhận bản sao độc lập, kho cũ còn nguyên", kq.ok && y.eng.getMode() === "mysql" && mc.ws.get("sp_2").data.transactions.length === 2 && mc.ws.get("sp_1").data.transactions.length === 2);
    kiem("sao chép · cả hai khoá đều được nhớ", y.eng.hasStoredConn("mongo") && y.eng.hasStoredConn("mysql"));
    y.eng.useLocal();
    kiem("useLocal · về Máy này, giữ nguyên dữ liệu đang làm việc, không gọi máy chủ nữa", y.eng.getMode() === "local" && y.eng.getDoc().transactions.length === 2 && y.eng.getConn() === null);
    const nPut = mc.soPut; y.eng.mutate(chi("tz", 5, T3)); await y.timers.chay();
    kiem("useLocal · sửa ở chế độ local không đẩy lên máy chủ", mc.soPut === nPut && y.timers.dem() === 0);
    kq = await y.eng.connectExisting("mysql", ST.makeCode("sp_2", "key2"), "merge");
    const del = await y.eng.deleteWorkspace();
    kiem("deleteWorkspace · xoá trên máy chủ, quên khoá, về Máy này, GIỮ dữ liệu trên máy", del.ok && !mc.ws.has("sp_2") && !y.eng.hasStoredConn("mysql") && y.eng.getMode() === "local" && y.eng.getDoc().transactions.length >= 2);
    kiem("deleteWorkspace · khi chưa kết nối → báo lỗi", !(await y.eng.deleteWorkspace()).ok);

    /* ---- khởi động lại ở chế độ máy chủ nhưng mất khoá ---- */
    const kk = khoGia(); kk.setItem("qlct.cfg", JSON.stringify({ mode: "mysql" }));
    const lost = mayTinh(kk, mayChuGia()); await lost.eng.init();
    kiem("cấu hình trỏ máy chủ nhưng mất khoá kết nối → quay về Máy này, không nổ", lost.eng.getMode() === "local");
    const cfgRac = khoGia(); cfgRac.setItem("qlct.cfg", "rác");
    const cr = mayTinh(cfgRac, mayChuGia()); await cr.eng.init();
    kiem("cấu hình hỏng → mặc định Máy này", cr.eng.getMode() === "local");

    /* ---- sửa trong lúc đang đẩy ---- */
    const chen = mayChuGia(); const c1 = mayTinh(khoGia(), chen); await c1.eng.init();
    c1.eng.mutate(chi("c1", 1, T1)); await c1.eng.connectNew("mysql", "c");
    const realFetch = chen.fetch; let da = false;
    chen.fetch = async (url, init) => {
      const r = await realFetch(url, init);
      if (!da && init.method === "PUT") { da = true; c1.eng.mutate(chi("giuaChung", 9, T2)); }   // người dùng gõ thêm đúng lúc đang gửi
      return r;
    };
    c1.eng.mutate(chi("c2", 2, T1)); await c1.eng.push();
    kiem("sửa thêm GIỮA LÚC đang đẩy · vẫn còn 'pending' và có hẹn đẩy tiếp (không bị coi là đã lưu)", c1.eng.getStatus().state === "pending" && c1.timers.dem() === 1);
    await c1.timers.chay();
    kiem("…lần đẩy tiếp theo mang theo cả khoản gõ giữa chừng", chen.ws.get("sp_1").data.transactions.some((t) => t.id === "giuaChung") && c1.eng.getStatus().state === "saved");

    /* ---- sao lưu / khôi phục ---- */
    const bk = mayTinh(khoGia(), mayChuGia()); await bk.eng.init();
    bk.eng.mutate(chi("b1", 1000, T1));
    const json = bk.eng.exportJson();
    const pr = bk.eng.parseBackup(json);
    kiem("sao lưu · xuất rồi đọc lại ra cùng tài liệu", pr.ok && pr.doc.transactions.map((t) => t.id + ":" + t.amount + ":" + t.date).join() === bk.eng.getDoc().transactions.map((t) => t.id + ":" + t.amount + ":" + t.date).join() && pr.fixes.length === 0);
    kiem("sao lưu · file không phải JSON / không phải sổ bị từ chối rõ ràng", !bk.eng.parseBackup("{hỏng").ok && !bk.eng.parseBackup("[]").ok && !bk.eng.parseBackup('{"a":1}').ok && /sao lưu/.test(bk.eng.parseBackup('{"a":1}').message));
    kiem("sao lưu · chịu được BOM", bk.eng.parseBackup("﻿" + json).ok);
    bk.eng.replaceDoc(Mo.emptyDoc(T3), "restore");
    kiem("thay cả sổ · có thể hoàn tác MỘT bước", bk.eng.getDoc().transactions.length === 0 && bk.eng.canUndoReplace() && bk.eng.undoReplace() && bk.eng.getDoc().transactions.length === 1 && !bk.eng.canUndoReplace());
    bk.eng.markBackedUp();
    kiem("markBackedUp · ghi lastBackupAt", typeof bk.eng.getDoc().settings.lastBackupAt === "string");
    kiem("usage · số byte của sổ", bk.eng.usageBytes() > 1000 && bk.eng.usageBytes() < ST.WARN_BYTES);

    /* ---- danh sách kho ---- */
    const bks = await a.eng.backends();
    kiem("backends · gọi GET /spending/backends", bks.status === 200 && bks.body.data.backends.length === 2);
    const off = mayChuGia(); off.offline = true;
    const bo = mayTinh(khoGia(), off); await bo.eng.init();
    kiem("backends · mất mạng → báo network, không ném lỗi", (await bo.eng.backends()).network === true);
    kq = await bo.eng.connectNew("mysql", "x");
    kiem("connectNew khi mất mạng · báo lỗi, giữ chế độ Máy này", !kq.ok && bo.eng.getMode() === "local");
  })().then(() => { fin(); }).catch((e) => { console.log("  [SAI] store · ngoại lệ không mong đợi: " + (e && e.stack || e)); hong++; fin(); });
}

function fin() {
  console.log("\n" + "=".repeat(58));
  if (hong) { console.log(hong + " phép kiểm SAI / " + (dat + hong) + "\n"); process.exit(1); }
  console.log("Đạt — " + dat + " phép kiểm.\n");
}
/* ====================== dữ liệu mẫu ====================== */
nhom("model · dữ liệu mẫu");
{
  const today = "2026-10-05";
  const base = Mo.emptyDoc(NOW);
  const s = Mo.addSample(base, today, NOW);
  kiem("addSample · tạo ra giao dịch, người, sổ tiết kiệm, ngân sách, định kỳ", s.transactions.length > 50 && s.people.some((p) => p.id === "s_p") && s.accounts.some((a) => a.id === "s_sav") && s.budgets.length === 2 && s.recurring.length === 1);
  kiem("addSample · MỌI giao dịch hợp lệ theo validateTx", s.transactions.every((t) => Mo.validateTx(t, s).length === 0), s.transactions.filter((t) => Mo.validateTx(t, s).length).map((t) => t.id + ":" + Mo.validateTx(t, s)[0]).slice(0, 3).join("; "));
  kiem("addSample · tất định (cùng ngày → cùng dữ liệu)", QL.sync.canon(s.transactions) === QL.sync.canon(Mo.addSample(base, today, NOW).transactions));
  kiem("addSample · qua normalize không mất gì", Mo.normalize(s, NOW).fixes.length === 0 && Mo.normalize(s, NOW).doc.transactions.length === s.transactions.length);
  const bal = L.accountBalances(s);
  kiem("addSample · số dư là số nguyên hữu hạn", Object.values(bal).every((v) => Number.isInteger(v)));
  kiem("addSample · tiền gửi tiết kiệm nằm ở sổ mẫu", bal.s_sav === 12000000 || !s.accounts.find((a) => a.id === "s_sav"));
  const rep = L.periodSummary(s, QL.dates.period("month", today), today);
  kiem("addSample · báo cáo tháng có chi và thu", rep.expense > 0 && rep.income >= 0);
  kiem("addSample · có khoản chia với bạn cùng phòng", Object.keys(L.personBalances(s)).includes("s_p"));
  const gone = Mo.removeSample(s, NOW);
  kiem("removeSample · xoá sạch giao dịch/người/tài khoản/ngân sách mẫu", gone.transactions.length === 0 && gone.people.length === 1 && gone.accounts.length === 3 && gone.budgets.length === 0 && gone.recurring.length === 0);
  const mixed = Mo.addSample(them(base, { type: "expense", date: today, amount: 1000, note: "của tôi" }), today, NOW);
  const mixedGone = Mo.removeSample(mixed, NOW);
  kiem("removeSample · KHÔNG đụng dữ liệu thật", mixedGone.transactions.length === 1 && mixedGone.transactions[0].note === "của tôi");
  kiem("removeSample · sau khi gộp với thiết bị khác vẫn không sống lại", QL.sync.merge(mixedGone, mixed, "2026-10-06T00:00:00.000Z").transactions.length === 1);
}

/* ====================== nhóm người ====================== */
nhom("nhóm · model (bộ sưu tập groups, tx.groupId)");
/** Sổ có nhóm "Phòng trọ" = tôi + Phúc (p_x) + Lan (p_l), là nhóm mặc định. */
function soNhom() {
  let d = soMau();
  d = Mo.upsert(d, "people", { id: "p_l", name: "Lan", archived: false }, NOW);
  d = Mo.upsert(d, "groups", { id: "g_tro", name: "Phòng trọ", memberIds: ["p_x", "p_l"], archived: false, order: 0 }, NOW);
  return Mo.setSettings(d, { defaultGroupId: "g_tro" }, NOW);
}
{
  const e = Mo.emptyDoc(NOW);
  kiem("emptyDoc · có groups rỗng, bia mộ nhóm, defaultGroupId null", Array.isArray(e.groups) && e.groups.length === 0 && typeof e.tombstones.groups === "object" && e.settings.defaultGroupId === null);
  const raw = JSON.parse(JSON.stringify(soNhom()));
  raw.groups.push({ id: "g_x", name: "", memberIds: ["p_x", "p_x", "p_me", "p_ma", 7], archived: "có" });
  raw.transactions.push(
    { id: "n1", type: "expense", date: "2026-10-01", amount: 300, categoryId: "c_food", accountId: "a_cash", groupId: "g_tro", split: { paidBy: "p_me", shares: { p_me: 100, p_x: 100, p_l: 100 } } },
    { id: "n2", type: "expense", date: "2026-10-01", amount: 300, categoryId: "c_food", accountId: "a_cash", groupId: "g_tro" },
    { id: "n3", type: "settle", date: "2026-10-01", amount: 50, personId: "p_x", direction: "in", accountId: "a_cash", groupId: "g_tro" },
    { id: "n4", type: "income", date: "2026-10-01", amount: 50, categoryId: "c_salary", accountId: "a_cash", groupId: "g_tro" });
  const n = Mo.normalize(raw, NOW).doc, g = n.groups.find((x) => x.id === "g_x");
  kiem("normalize · thành viên: bỏ trùng, bỏ 'tôi', bỏ người không tồn tại; tên mặc định; archived sai kiểu → false",
    bang(g.memberIds, ["p_x"]) && g.name === "Nhóm" && g.archived === false, JSON.stringify(g));
  const by = Object.fromEntries(n.transactions.map((t) => [t.id, t]));
  kiem("normalize · groupId giữ ở khoản chi CHUNG và thanh toán, bỏ ở khoản chi riêng và khoản thu",
    by.n1.groupId === "g_tro" && by.n3.groupId === "g_tro" && by.n2.groupId === undefined && by.n4.groupId === undefined);
  kiem("normalize · giữ nhóm mặc định", n.settings.defaultGroupId === "g_tro");

  const d = soNhom(), base = { id: "v1", type: "expense", date: "2026-10-01", amount: 300, categoryId: "c_food", accountId: "a_cash", tags: [], note: "" };
  const split = { paidBy: "p_me", shares: { p_me: 100, p_x: 100, p_l: 100 } };
  kiem("validateTx · khoản chi chung thuộc nhóm hợp lệ", Mo.validateTx(Object.assign({}, base, { split, groupId: "g_tro" }), d).length === 0);
  kiem("validateTx · nhóm không tồn tại → lỗi", Mo.validateTx(Object.assign({}, base, { split, groupId: "g_khong" }), d).some((x) => /Nhóm không tồn tại/.test(x)));
  kiem("validateTx · khoản chi RIÊNG gắn nhóm → lỗi", Mo.validateTx(Object.assign({}, base, { groupId: "g_tro" }), d).some((x) => /chi chung/.test(x)));
  kiem("validateTx · thanh toán nợ gắn nhóm hợp lệ", Mo.validateTx({ id: "v2", type: "settle", date: "2026-10-01", amount: 50, personId: "p_x", direction: "in", accountId: "a_cash", groupId: "g_tro" }, d).length === 0);

  const gone = Mo.removePerson(Mo.setSettings(d, { defaultPartnerIds: ["p_l"] }, NOW), "p_l", "2026-10-06T00:00:00.000Z");
  kiem("removePerson · xoá người, gỡ khỏi nhóm, gỡ khỏi người mặc định, để bia mộ",
    !gone.people.some((p) => p.id === "p_l") && bang(gone.groups[0].memberIds, ["p_x"]) && !gone.settings.defaultPartnerIds.includes("p_l") && !!gone.tombstones.people.p_l);
  kiem("removePerson · không sửa tài liệu cũ", d.groups[0].memberIds.length === 2 && d.people.some((p) => p.id === "p_l"));

  const A1 = Mo.upsert(d, "groups", Object.assign({}, d.groups[0], { name: "Trọ 302" }), "2026-10-07T00:00:00.000Z");
  const B1 = Mo.upsert(d, "groups", { id: "g_dl", name: "Đà Lạt", memberIds: ["p_x"], archived: false }, "2026-10-06T00:00:00.000Z");
  const m = QL.sync.merge(A1, B1, "2026-10-08T00:00:00.000Z");
  kiem("sync.merge · gộp nhóm theo bản ghi (sửa tên ở máy A + thêm nhóm ở máy B → có cả hai)",
    m.groups.length === 2 && m.groups.find((x) => x.id === "g_tro").name === "Trọ 302" && m.groups.some((x) => x.id === "g_dl"));
  const del = QL.sync.merge(Mo.remove(B1, "groups", "g_dl", "2026-10-09T00:00:00.000Z"), B1, "2026-10-10T00:00:00.000Z");
  kiem("sync.merge · xoá nhóm ở một máy không sống lại sau khi gộp", !del.groups.some((x) => x.id === "g_dl"));
  kiem("removeSample · nhóm mặc định là nhóm mẫu thì gỡ", Mo.removeSample(Mo.setSettings(d, { defaultGroupId: "s_g" }, NOW), NOW).settings.defaultGroupId === null);
}

nhom("nhóm · số dư, sổ khoản chung, đối chiếu và cách chuyển tiền");
{
  // Tôi trả 300k (chia 3), Phúc trả 600k (chia 3), và một khoản NGOÀI nhóm với Phúc 100k tôi trả chia đôi.
  let d = soNhom();
  const ba = (ids, a) => Object.fromEntries(ids.map((id, i) => [id, QL.money.allocate(a, ids.map(() => 1))[i]]));
  const ids3 = ["p_me", "p_x", "p_l"];
  d = Mo.upsert(d, "transactions", { id: "g1", type: "expense", date: "2026-09-20", amount: 300000, categoryId: "c_food", accountId: "a_cash", note: "Cơm nhà", tags: [], groupId: "g_tro", split: { paidBy: "p_me", shares: ba(ids3, 300000) } }, NOW);
  d = Mo.upsert(d, "transactions", { id: "g2", type: "expense", date: "2026-10-02", amount: 600000, categoryId: "c_housing", accountId: null, note: "Tiền điện", tags: [], groupId: "g_tro", split: { paidBy: "p_x", shares: ba(ids3, 600000) } }, NOW);
  d = Mo.upsert(d, "transactions", { id: "g3", type: "expense", date: "2026-10-03", amount: 100000, categoryId: "c_food", accountId: "a_cash", note: "Bún chả", tags: [], split: { paidBy: "p_me", shares: { p_me: 50000, p_x: 50000 } } }, NOW);
  kiem("dữ liệu kiểm · mọi khoản hợp lệ", d.transactions.every((t) => Mo.validateTx(t, d).length === 0), d.transactions.map((t) => Mo.validateTx(t, d)).join("|"));

  const gb = L.personBalances(d, "g_tro"), all = L.personBalances(d);
  kiem("personBalances(nhóm) · chỉ tính khoản của nhóm: Phúc −100.000 (tôi nợ), Lan +100.000", gb.p_x === -100000 && gb.p_l === 100000, JSON.stringify(gb));
  kiem("personBalances() · tổng mọi khoản vẫn như cũ: Phúc −50.000, Lan +100.000", all.p_x === -50000 && all.p_l === 100000, JSON.stringify(all));
  kiem("groupMembers · tôi trước, rồi thành viên", bang(L.groupMembers(d, "g_tro"), ["p_me", "p_x", "p_l"]));

  const st = L.groupStatement(d, "g_tro", QL.dates.period("all", "2026-10-05"));
  const r = Object.fromEntries(st.members.map((x) => [x.id, x]));
  kiem("groupStatement · đã trả / phần / chênh lệch từng người (tôi 0, Phúc +300k, Lan −300k), tổng chi 900k",
    r.p_me.net === 0 && r.p_x.net === 300000 && r.p_l.net === -300000 && st.spend === 900000 && st.count === 2, JSON.stringify(st.members));
  kiem("groupStatement · Σ chênh lệch = 0", st.members.reduce((a, x) => a + x.net, 0) === 0);
  const tr = st.transfers.map((t) => t.from + ">" + t.to + ":" + t.amount);
  kiem("groupStatement · cách chuyển: phần của tôi khớp sổ từng cặp (tôi→Phúc 100k, Lan→tôi 100k), còn lại Lan→Phúc 200k",
    bang(tr, ["p_me>p_x:100000", "p_l>p_me:100000", "p_l>p_x:200000"]), tr.join(", "));
  const paid = {};
  st.members.forEach((x) => { paid[x.id] = x.net; });
  st.transfers.forEach((t) => { paid[t.from] += t.amount; paid[t.to] -= t.amount; });
  kiem("groupStatement · làm theo cách chuyển thì mọi người về 0", Object.values(paid).every((v) => v === 0), JSON.stringify(paid));

  // Ghi nhận phần của tôi vào nhóm → số dư của tôi trong nhóm về 0, chỉ còn Lan→Phúc.
  let s2 = Mo.upsert(d, "transactions", { id: "g4", type: "settle", date: "2026-10-04", amount: 100000, personId: "p_l", direction: "in", accountId: "a_cash", groupId: "g_tro", note: "", tags: [] }, NOW);
  s2 = Mo.upsert(s2, "transactions", { id: "g5", type: "settle", date: "2026-10-04", amount: 100000, personId: "p_x", direction: "out", accountId: "a_cash", groupId: "g_tro", note: "", tags: [] }, NOW);
  const gb2 = L.personBalances(s2, "g_tro"), st2 = L.groupStatement(s2, "g_tro", QL.dates.period("all", "2026-10-05"));
  kiem("sau khi ghi thanh toán vào nhóm · tôi hết nợ trong nhóm, chỉ còn Lan→Phúc 200k",
    gb2.p_x === 0 && gb2.p_l === 0 && bang(st2.transfers.map((t) => t.from + ">" + t.to + ":" + t.amount), ["p_l>p_x:200000"]), JSON.stringify(st2.transfers));
  kiem("thanh toán ghi vào nhóm · vẫn tính vào số dư tổng với người đó", L.personBalances(s2).p_x === 50000 && L.personBalances(s2).p_l === 0, JSON.stringify(L.personBalances(s2)));

  /* sổ khoản chung + lọc */
  const G = (f) => L.sharedLedger(s2, { groupId: "g_tro" }, f);
  kiem("sharedLedger(nhóm) · mọi khoản của nhóm, mới → cũ (kể cả khoản tôi không trả), không lẫn khoản ngoài nhóm", bang(G().items.map((x) => x.tx.id), ["g4", "g5", "g2", "g1"]), G().items.map((x) => x.tx.id).join(","));
  kiem("sharedLedger · lọc theo tháng 10", bang(G({ from: "2026-10-01", to: "2026-10-31" }).items.map((x) => x.tx.id).sort(), ["g2", "g4", "g5"]));
  kiem("sharedLedger · lọc chỉ thanh toán / chỉ khoản chi", G({ kind: "settle" }).count === 2 && G({ kind: "expense" }).count === 2);
  kiem("sharedLedger · lọc theo thành viên Lan (tham gia, trả, hay thanh toán)", bang(G({ memberId: "p_l" }).items.map((x) => x.tx.id).sort(), ["g1", "g2", "g4"]));
  kiem("sharedLedger · lọc ai trả: tôi / người khác", bang(G({ payer: "me" }).items.map((x) => x.tx.id).sort(), ["g1", "g5"]) && bang(G({ payer: "other" }).items.map((x) => x.tx.id).sort(), ["g2", "g4"]));
  kiem("sharedLedger · tìm theo ghi chú (không dấu, đầu từ)", bang(G({ q: "dien" }).items.map((x) => x.tx.id), ["g2"]));
  kiem("sharedLedger · tổng trong bộ lọc: chi 900k, phần tôi 300k, tôi trả 300k", G({ kind: "expense" }).spend === 900000 && G({ kind: "expense" }).mine === 300000 && G({ kind: "expense" }).paidByMe === 300000);
  const P = (f) => L.sharedLedger(s2, { personId: "p_x" }, f);
  kiem("sharedLedger(người) · chênh lệch = số dư tổng với người đó", P().net === L.personBalances(s2).p_x && P().count === 4);
  kiem("sharedLedger(người) · lọc 'không thuộc nhóm' / theo nhóm", bang(P({ groupId: "none" }).items.map((x) => x.tx.id), ["g3"]) && P({ groupId: "g_tro" }).count === 3);

  /* settleUp: thuộc tính trên dữ liệu ngẫu nhiên */
  const R = rng(42);
  let okAll = true, worst = "";
  for (let k = 0; k < 300; k++) {
    const n = 2 + Math.floor(R() * 7), nets = Array.from({ length: n - 1 }, () => Math.round((R() - 0.5) * 2e6));
    nets.push(-nets.reduce((a, b) => a + b, 0));
    const rows = nets.map((v, i) => ({ id: "x" + i, net: v })), t = L.settleUp(rows), left = Object.fromEntries(rows.map((x) => [x.id, x.net]));
    t.forEach((x) => { left[x.from] += x.amount; left[x.to] -= x.amount; });
    if (!(Object.values(left).every((v) => v === 0) && t.length <= n - 1 && t.every((x) => Number.isInteger(x.amount) && x.amount > 0 && x.from !== x.to))) { okAll = false; worst = JSON.stringify(nets); break; }
  }
  kiem("settleUp · 300 bộ số ngẫu nhiên: ai cũng về 0, ≤ n−1 lần chuyển, số nguyên dương", okAll, worst);

  const msg = L.groupSettlementMessage(d, "g_tro", QL.dates.period("month", "2026-10-05"));
  kiem("groupSettlementMessage · có tên nhóm, kỳ, khoản trong kỳ, cách chuyển (khoản tháng 9 không vào)",
    msg.startsWith("Quyết toán nhóm Phòng trọ — Tháng 10/2026") && msg.includes("Tiền điện: Phúc trả 600.000") && !msg.includes("Cơm nhà") && msg.includes("Chuyển tiền:"), msg);
  kiem("quickTemplates · nhớ nhóm của khoản chung", L.quickTemplates(Mo.upsert(d, "transactions", Object.assign({}, d.transactions[0], { id: "g1b" }), NOW), 3)[0].split.groupId === "g_tro");
}

nhom("nhóm · nhập nhanh");
{
  const d = soNhom(), ctx = { today: "2026-10-05", doc: d }, Q = (s) => QL.parser.parseQuick(s, ctx);
  kiem("partners · thành viên nhóm mặc định đứng đầu", bang(QL.parser.partners(d).map((p) => p.id), ["p_x", "p_l"]));
  const a = Q("cơm 300k nhóm phòng trọ");
  kiem("'nhóm phòng trọ' · chia cho cả nhóm, gắn nhóm, ghi chú sạch",
    a.split && bang(a.split.participantIds, ["p_me", "p_x", "p_l"]) && a.split.groupId === "g_tro" && a.note === "cơm" && a.amount === 300000, JSON.stringify(a));
  const b = Q("@Phòng trọ tiền điện 900k Phúc trả");
  kiem("'@Phòng trọ … Phúc trả' · người trả là Phúc, chia 3", b.split && b.split.payerId === "p_x" && b.split.n === 3 && b.split.groupId === "g_tro" && b.note === "tiền điện", JSON.stringify(b));
  const c = Q("57/3 bún đậu");
  kiem("'57/3' · lấy nhóm mặc định, gắn nhóm", c.split && bang(c.split.participantIds, ["p_me", "p_x", "p_l"]) && c.split.groupId === "g_tro");
  const e = Q("57/2 bún đậu");
  kiem("'57/2' · tôi + người đầu nhóm mặc định, vẫn thuộc nhóm (mọi người đều ở nhóm)", e.split && bang(e.split.participantIds, ["p_me", "p_x"]) && e.split.groupId === "g_tro");
  const tx = QL.parser.toTx(a, d);
  kiem("toTx · mang groupId và hợp lệ", tx.groupId === "g_tro" && Mo.validateTx(Object.assign({ id: "q1" }, tx), d).length === 0, JSON.stringify(Mo.validateTx(Object.assign({ id: "q1" }, tx), d)));
  const f = Q("cơm 300k/2 nhóm phòng trọ");
  kiem("nhóm + '/2' khác số người · cảnh báo, chia theo nhóm", f.split.n === 3 && f.warnings.some((w) => /có 3 người/.test(w)));
  const lone = Mo.upsert(d, "groups", { id: "g_1", name: "Một mình", memberIds: [], archived: false }, NOW);
  const g = QL.parser.parseQuick("cơm 50k nhóm một mình", { today: "2026-10-05", doc: lone });
  kiem("nhóm chưa có thành viên · cảnh báo, không chia", !g.split && g.warnings.some((w) => /chưa có thành viên/.test(w)));
  const arch = Mo.upsert(d, "groups", Object.assign({}, d.groups[0], { archived: true }), NOW);
  const h = QL.parser.parseQuick("cơm 300k nhóm phòng trọ", { today: "2026-10-05", doc: arch });
  kiem("nhóm đã lưu trữ · không nhận, không gắn nhóm mặc định", !(h.split && h.split.groupId));
  const noDef = Mo.setSettings(d, { defaultGroupId: null }, NOW);
  kiem("không có nhóm mặc định · '57/2' như cũ, không gắn nhóm", !QL.parser.parseQuick("57/2 bún", { today: "2026-10-05", doc: noDef }).split.groupId);
}

nhom("nhóm · CSV (cột nhom)");
{
  let d = soNhom();
  const sh = { p_me: 100000, p_x: 100000, p_l: 100000 };
  d = Mo.upsert(d, "transactions", { id: "c1", type: "expense", date: "2026-10-01", amount: 300000, categoryId: "c_food", accountId: "a_cash", note: "Lẩu", tags: [], groupId: "g_tro", split: { paidBy: "p_me", shares: sh } }, NOW);
  d = Mo.upsert(d, "transactions", { id: "c2", type: "settle", date: "2026-10-02", amount: 100000, personId: "p_l", direction: "in", accountId: "a_cash", note: "", tags: [], groupId: "g_tro" }, NOW);
  d = Mo.upsert(d, "transactions", { id: "c3", type: "expense", date: "2026-10-03", amount: 20000, categoryId: "c_food", accountId: "a_cash", note: "Trà đá", tags: [] }, NOW);
  const csv = QL.csv.toCsv(d), lines = csv.replace(/^﻿/, "").trim().split(/\r\n/);
  kiem("xuất · thêm cột nhom ở cuối, ghi tên nhóm cho khoản chung và thanh toán của nhóm", lines[0].endsWith(",chia,nhom") && lines[1].endsWith(",Phòng trọ") && lines[2].endsWith(",Phòng trọ") && lines[3].endsWith(","), lines.join(" | "));
  const fresh = Mo.emptyDoc(NOW), res = QL.csv.fromCsv(csv, fresh, "2026-10-05");
  kiem("nhập vào sổ trống · hẹn tạo nhóm Phòng trọ", res.create.groups.length === 1 && res.create.groups[0].name === "Phòng trọ");
  const after = QL.csv.applyImport(fresh, res, {}, NOW).doc, g = after.groups[0];
  const names = g.memberIds.map((id) => after.people.find((p) => p.id === id).name).sort();
  kiem("nhập · nhóm mới có đúng thành viên (mọi người trong các dòng của nhóm, trừ tôi)", after.groups.length === 1 && bang(names, ["Lan", "Phúc"]), JSON.stringify(names));
  kiem("nhập · khoản chung và thanh toán gắn vào nhóm mới, khoản riêng không", after.transactions.filter((t) => t.groupId === g.id).length === 2 && after.transactions.every((t) => Mo.validateTx(t, after).length === 0));
  const again = QL.csv.fromCsv(csv, d, "2026-10-05");
  kiem("nhập vào sổ đã có nhóm cùng tên · dùng nhóm cũ, không tạo thêm", again.create.groups.length === 0 && again.rows.filter((r) => r.tx && r.tx.groupId === "g_tro").length === 2);
}

nhom("AI · đề xuất của máy chủ → dòng xem trước (parser.fromAi)");
{
  const d = soNhom(), P = QL.parser;
  const t = (o) => Object.assign({ type: "expense", date: "2026-10-08", amount: 57000, note: "Cơm trưa", categoryId: null, accountId: null,
    paidBy: { id: "p_me" }, participants: [], splitCount: 0, groupId: null, shares: [], source: "cơm 57k", confidence: 0.9, warnings: [] }, o);
  const res = {
    transactions: [
      t({}),                                                                                            // 0 chi riêng, danh mục tự đoán
      t({ participants: [{ id: "p_me" }, { id: "p_x" }] }),                                               // 1 chia đôi với Phúc
      t({ amount: 600000, note: "Lẩu", paidBy: { id: "p_l" }, groupId: "g_tro" }),                         // 2 Lan trả, cả nhóm
      t({ amount: 90000, note: "Cà phê", paidBy: { name: "Nam" }, participants: [{ id: "p_me" }, { name: "nam" }, { name: "Nam" }] }), // 3 người mới (một lần)
      t({ amount: 57000, shares: [{ id: "p_me", amount: 20000 }, { id: "p_x", amount: 37000 }], participants: [{ id: "p_me" }, { id: "p_x" }] }), // 4 chia theo số
      t({ amount: 90000, splitCount: 3 }),                                                               // 5 "chia 3": nhóm mặc định
      t({ type: "income", amount: 14900000, note: "Lương", categoryId: "c_salary", accountId: "a_bank" }), // 6 thu
      t({ categoryId: "c_salary" }),                                                                     // 7 danh mục sai loại → tự đoán lại
      t({ participants: [{ id: "p_ma" }, { id: "p_x" }] }),                                              // 8 id không có trong sổ (đã xoá) → bỏ người đó
    ],
    ignored: [{ text: "Tổng: 500k", reason: "Dòng tổng" }]
  };
  const out = P.fromAi(res, d, "2026-10-08"), r = out.rows;
  kiem("fromAi · mọi đề xuất ra một dòng, dòng bỏ qua ở cuối", r.length === 10 && r[9].status === "skip" && r[9].reason === "Dòng tổng");
  kiem("fromAi · mọi dòng 'ok' đều qua validateTx (trên sổ đã thêm người hẹn tạo)", r.filter((x) => x.status === "ok").length === 9, r.filter((x) => x.status !== "ok").map((x) => x.n + ":" + x.reason).join("; "));
  kiem("fromAi · chi riêng: danh mục tự đoán từ ghi chú, tài khoản mặc định, không chia", r[0].tx.categoryId === "c_food" && r[0].tx.accountId === "a_cash" && !r[0].tx.split);
  kiem("fromAi · chia đôi đều, tổng khớp", bang(r[1].tx.split, { paidBy: "p_me", shares: { p_me: 28500, p_x: 28500 } }) && r[1].tx.groupId === "g_tro");
  kiem("fromAi · nhóm không nêu tên người → cả nhóm; người khác trả thì không trừ tài khoản của tôi",
    bang(Object.keys(r[2].tx.split.shares), ["p_me", "p_x", "p_l"]) && r[2].tx.split.paidBy === "p_l" && r[2].tx.accountId === null && r[2].tx.groupId === "g_tro");
  kiem("fromAi · người mới chỉ hẹn tạo MỘT lần (không phân biệt hoa thường/dấu), dòng biết mình cần ai",
    out.people.length === 1 && out.people[0].name === "Nam" && bang(r[3].needs, [out.people[0].id]) && r[3].tx.split.paidBy === out.people[0].id && !d.people.some((p) => p.name === "Nam"));
  kiem("fromAi · khoản có người ngoài nhóm mặc định thì không gắn nhóm", r[3].tx.groupId === undefined);
  kiem("fromAi · chia theo số tiền AI đưa", bang(r[4].tx.split.shares, { p_me: 20000, p_x: 37000 }));
  kiem("fromAi · 'chia 3' không nêu tên → nhóm mặc định", bang(Object.keys(r[5].tx.split.shares), ["p_me", "p_x", "p_l"]) && r[5].tx.groupId === "g_tro");
  kiem("fromAi · khoản thu giữ danh mục và tài khoản AI chọn", r[6].tx.type === "income" && r[6].tx.categoryId === "c_salary" && r[6].tx.accountId === "a_bank" && !r[6].tx.split);
  kiem("fromAi · danh mục sai loại thì đoán lại theo ghi chú", r[7].tx.categoryId === "c_food");
  kiem("fromAi · người không còn trong sổ bị bỏ khỏi phần chia, có cảnh báo", bang(Object.keys(r[8].tx.split.shares), ["p_x"]) && /không còn trong sổ/.test(r[8].reason), JSON.stringify(r[8]));
  kiem("fromAi · KHÔNG đổi sổ đang có", d.transactions.length === 0 && d.people.length === 3);

  const bad = P.fromAi({ transactions: [t({ amount: 0 }), t({ date: "2026-02-30" }), t({ shares: [{ id: "p_me", amount: 1 }, { id: "p_x", amount: 1 }] })] }, d, "2026-10-08").rows;
  kiem("fromAi · số tiền 0 → 'chưa hiểu' kèm lý do của validateTx", bad[0].status === "unclear" && /Số tiền/.test(bad[0].reason));
  kiem("fromAi · ngày hỏng → lấy hôm nay", bad[1].status === "ok" && bad[1].tx.date === "2026-10-08");
  kiem("fromAi · phần chia lệch tổng → 'chưa hiểu'", bad[2].status === "unclear" && /Tổng các phần chia/.test(bad[2].reason));
  kiem("fromAi · kết quả rỗng / hỏng không nổ", P.fromAi(null, d, "2026-10-08").rows.length === 0 && P.fromAi({}, d, "2026-10-08").people.length === 0);

  const arch = Mo.upsert(d, "people", { id: "p_old", name: "Cũ", archived: true }, NOW);
  const ctx = P.aiContext(Mo.upsert(arch, "accounts", { id: "a_sav", name: "Sổ", kind: "savings", openingBalance: 0, archived: false, order: 9 }, NOW));
  kiem("aiContext · chỉ TÊN + id: không gửi tôi, người đã lưu trữ, sổ tiết kiệm; không có số dư/giao dịch",
    !ctx.people.some((p) => p.id === "p_me" || p.id === "p_old") && !ctx.accounts.some((a) => a.id === "a_sav") && ctx.me === "p_me" &&
    ctx.groups[0].memberIds.length === 2 && JSON.stringify(ctx).indexOf("openingBalance") === -1 && !("transactions" in ctx));
}

// @@SECTIONS-END
