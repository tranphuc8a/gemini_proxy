/* kiem/regex-sinh.js — assets/regex-sinh.js (viec 27): PRNG co seed (tat dinh, phan phoi, tron) + phanTich / sinhChuoi / sinhTheoMau:
   >= 80 mau x 20 seed, chuoi sinh ra khop RegExp(…, "u") va do dai (code point) nam trong min / max, mau dung nhin truoc / \b -> khongHoTro (bao, KHONG bia),
   cu phap sai nem {thongBao, cot}, mau toan dau thang tuyen tinh (khong de quy bac hai), lop ky tu rong bao khong khop. */
"use strict";

const MAU = [
  /* ky tu + thoat */
  "abc", "a.c", "\\d", "\\d{3}", "\\d+", "\\w+", "\\s", "\\S+", "\\D\\W", "\\t\\n", "\\u0041\\u{1F600}", "\\x41", "\\.", "\\\\", "\\/", "\\-",
  /* lop */
  "[abc]", "[a-z]", "[A-Za-z0-9_]+", "[^a-z]", "[^\\d\\s]+", "[\\d.]+", "[-+]?[0-9]+", "[\\w-]+", "[a\\-z]", "[\\u00C0-\\u017F]+", "[^]", "[\\s\\S]",
  /* luong tu */
  "a*", "a+", "a?", "a{2}", "a{2,}", "a{2,5}", "a{0,3}", "a+?", "a*?b", "(ab){2,4}", "(?:ab|cd)+", "x{3}y{0,2}z?",
  /* nhom + hoac */
  "(a|b)c", "(foo|bar|baz)", "(?:a|bc|def)g", "(a(b(c)))", "((a)|(b))+", "(?<ten>ab)\\k<ten>", "(a)\\1", "(x)(y)\\2\\1", "a|b|c", "|a", "a|",
  /* neo */
  "^abc$", "^a", "b$", "^$", "^[a-z]{3,8}$", "^(foo|bar)$", "^\\d{4}-\\d{2}-\\d{2}$", "^[A-Z]{2}[0-9]{3}$", "^DH-[0-9]{4}$", "^0[0-9]{9}$",
  /* mau thuc te */
  "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$", "^https?://[a-z0-9.-]+(/[a-z0-9._~-]*)*$", "^#[0-9a-fA-F]{6}$", "^\\+?[0-9]{8,12}$",
  "^[A-Z][a-z]+( [A-Z][a-z]+)*$", "^(\\d{1,3}\\.){3}\\d{1,3}$", "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", "^v\\d+\\.\\d+\\.\\d+$",
  "^[\\p{L} ]{2,20}$", "^\\p{Lu}\\p{Ll}+$", "^\\p{N}{3}$", "^SKU-[A-Z]{3}-\\d{5}$", "\\bword\\b", "^.{3,6}$", ".+@.+", "^\\S+$", "^[^\\s@]+@[^\\s@]+$",
  "^(?:[a-z]+\\.){1,3}[a-z]+$", "^(a|ab|abc)+$", "^[0-9]+(,[0-9]+)*$", "^(\\([0-9]{3}\\) )?[0-9]{3}-[0-9]{4}$", "^[ab]{10}$", "^x{50}$", "[a-c]{5,7}d"
];
/* Mau KHONG sinh chac chan duoc (dung nhin truoc / nhin sau): phai bao khongHoTro, ket qua van duoc kiem lai bang RegExp that. */
const MAU_KHONG_CHAC = ["^(?=.*\\d)[a-z0-9]{6}$", "^(?!admin)[a-z]{5}$", "(?<=\\$)\\d+", "\\d+(?!px)", "^(?=a)a+$"];
const MAU_SAI = ["(", ")", "[a-", "a{2,1}", "*a", "+", "?a", "\\", "(?<n", "[z-a]", "a**", "(?", "a{3,1}b", "["];

function chuoiDeu(JE, s) { return JE.regexSinh.sinhTheoMau(s, JE.taoRng("x"), {}); }

module.exports = function (C) {
  const kiem = C.kiem, nhom = C.nhom;
  const MT = C.taoMoiTruong();
  const JE = MT.JE;
  if (!kiem("regex-sinh · nap xong, co JE.taoRng + JE.regexSinh (phanTich, sinhChuoi, sinhTheoMau)",
    !!(JE.taoRng && JE.regexSinh && typeof JE.regexSinh.sinhTheoMau === "function" && typeof JE.regexSinh.phanTich === "function"))) return;
  const R = JE.regexSinh;
  const ds = C.dsScript();
  kiem("index.html · regex-sinh.js nap sau schema-kiem.js, truoc chay-nen.js", ds.indexOf("assets/regex-sinh.js") > ds.indexOf("assets/schema-kiem.js") && ds.indexOf("assets/regex-sinh.js") < ds.indexOf("assets/chay-nen.js"), ds.join(", "));
  const SLACK = Number(process.env.JE_PERF_SLACK || 3);

  /* ---------------- PRNG ---------------- */
  nhom("regex-sinh · taoRng: tat dinh theo seed, phan phoi, tron");
  const day = (seed, n) => { const r = JE.taoRng(seed), a = []; for (let i = 0; i < n; i++) a.push(r.soThuc()); return a; };
  kiem("taoRng · cung seed (chuoi) -> cung 1000 so", C.bang(day("abc", 1000), day("abc", 1000)));
  kiem("taoRng · seed so 42 va chuoi '42' cho cung day (seed duoc ep thanh chuoi)", C.bang(day(42, 50), day("42", 50)));
  kiem("taoRng · seed khac nhau -> day khac (abc / abd / '' / undefined)", !C.bang(day("abc", 20), day("abd", 20)) && !C.bang(day("", 20), day("abc", 20)) && C.bang(day("", 20), day(undefined, 20)));
  { const a = day("pp", 20000), tb = a.reduce((x, y) => x + y, 0) / a.length;
    kiem("taoRng · 20 000 so thuc nam trong [0, 1), trung binh ~ 0,5", a.every((x) => x >= 0 && x < 1) && Math.abs(tb - 0.5) < 0.01, "tb = " + tb);
    const kd = new Array(10).fill(0); a.forEach((x) => kd[Math.floor(x * 10)]++);
    kiem("taoRng · 10 khoang deu nhau (moi khoang 1 600–2 400 / 20 000)", kd.every((c) => c > 1600 && c < 2400), kd.join(",")); }
  { const r = JE.taoRng("n"), dem = {}; let ngoai = 0;
    for (let i = 0; i < 6000; i++) { const x = r.soNguyen(3, 7); dem[x] = (dem[x] || 0) + 1; if (x < 3 || x > 7 || x !== Math.floor(x)) ngoai++; }
    kiem("taoRng · soNguyen(3, 7) dong hai dau, du 5 gia tri, deu", !ngoai && Object.keys(dem).length === 5 && Object.values(dem).every((c) => c > 900), JSON.stringify(dem));
    const r2 = JE.taoRng("n"); kiem("taoRng · soNguyen(7, 3) dao dau van dung", [...Array(50)].every(() => { const x = r2.soNguyen(7, 3); return x >= 3 && x <= 7; }));
    kiem("taoRng · soNguyen(5, 5) = 5", JE.taoRng("k").soNguyen(5, 5) === 5); }
  { const r = JE.taoRng("t"), goc = [1, 2, 3, 4, 5, 6, 7, 8], t = r.tron(goc);
    kiem("taoRng · tron: hoan vi cua mang, KHONG doi mang goc", C.bang(t.slice().sort(), goc) && C.bang(goc, [1, 2, 3, 4, 5, 6, 7, 8]));
    kiem("taoRng · chon([]) = undefined; chon(1 phan tu) = phan tu do; xacSuat(0) false / xacSuat(1) true", r.chon([]) === undefined && r.chon([9]) === 9 && [...Array(50)].every(() => !r.xacSuat(0) && r.xacSuat(1))); }
  const nguon = require("fs").readFileSync(require("path").join(C.GOC, "assets", "regex-sinh.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  kiem("regex-sinh · khong dung Math.random / Date / performance (thuan, tat dinh)", !/Math\.random|Date\b|performance/.test(nguon));

  /* ---------------- sinh x khop ---------------- */
  nhom("regex-sinh · " + MAU.length + " mau x 20 seed: chuoi sinh ra khop RegExp(…, 'u')");
  kiem("regex-sinh · so mau >= 80", MAU.length >= 80, String(MAU.length));
  let tongThu = 0, khongKhop = [];
  for (const m of MAU) {
    let ok = 0, re = null;
    try { re = new RegExp(m, "u"); } catch (e) { re = new RegExp(m); }
    const luu = [];
    for (let seed = 0; seed < 20; seed++) {
      const r = R.sinhTheoMau(m, JE.taoRng("s" + seed), {});
      tongThu++;
      if (r.khop && re.test(r.chuoi)) ok++; else luu.push(JSON.stringify(r.chuoi).slice(0, 40) + " " + r.canhBao.join("/"));
    }
    if (ok < 20) khongKhop.push(m + " -> " + ok + "/20 " + luu[0]);
    if (m === MAU[MAU.length - 1] || m === MAU[0] || (khongKhop.length && khongKhop[khongKhop.length - 1].indexOf(m) === 0)) { /* khong in tung mau */ }
  }
  kiem("regex-sinh · MOI mau dat 20/20 seed (khop that, khop:true) — " + tongThu + " lan sinh", khongKhop.length === 0, khongKhop.slice(0, 4).join(" | "));
  { /* sinhChuoi KHONG co buoc kiem lai: bo sinh tu no phai dung (bo kiem lai trong sinhTheoMau che dot bien o lop ky tu) */
    const THUAN = [String.raw`\d{30}`, String.raw`[a-z]{30}`, String.raw`\w{30}`, String.raw`\D{20}`, String.raw`[^a-z]{20}`, String.raw`(ab|cd){10}`, String.raw`[A-Z][a-z]{10}\d{5}`,
      String.raw`\s{10}`, String.raw`\S{20}`, String.raw`.{20}`, String.raw`[\u00C0-\u017F]{10}`, String.raw`\p{L}{10}`, String.raw`\p{Lu}{5}\p{Ll}{5}`, String.raw`\p{N}{10}`, String.raw`\W{10}`,
      String.raw`[^\d]{10}`, String.raw`(a|b|c){10}`, String.raw`[a-c]{3,7}[^a-c]{3,7}`, String.raw`(?:x|yy|zzz){4}`, String.raw`[^\w\s]{10}`];
    const hong = [];
    for (const m of THUAN) {
      const re = new RegExp("^(?:" + m + ")$", "u"), ast = R.phanTich(m).ast;
      let ok = 0;
      for (let i = 0; i < 100; i++) { const c = R.sinhChuoi(ast, JE.taoRng(m + i), {}).chuoi; if (re.test(c)) ok++; }
      if (ok < 100) hong.push(m + " " + ok + "/100");
    }
    kiem("sinhChuoi (chua kiem lai) · " + THUAN.length + " mau x 100 seed: moi chuoi khop TOAN BO mau (lop \d \w \s \p{…}, phu dinh, hoac, luong tu)", hong.length === 0, hong.slice(0, 4).join(" | ")); }
  { const m = "^(foo|bar|baz)$", dem = {};
    for (let i = 0; i < 300; i++) { const c = R.sinhTheoMau(m, JE.taoRng("p" + i), {}).chuoi; dem[c] = (dem[c] || 0) + 1; }
    kiem("regex-sinh · nhanh hoac duoc chon deu (3 nhanh, moi nhanh >= 60 / 300)", Object.keys(dem).length === 3 && Object.values(dem).every((c) => c >= 60), JSON.stringify(dem)); }
  { const a = R.sinhTheoMau("^[a-z]{3,8}$", JE.taoRng("q"), {}).chuoi, b = R.sinhTheoMau("^[a-z]{3,8}$", JE.taoRng("q"), {}).chuoi, c = R.sinhTheoMau("^[a-z]{3,8}$", JE.taoRng("q2"), {}).chuoi;
    kiem("regex-sinh · cung seed -> cung chuoi; seed khac -> (thuong) khac", a === b && (a !== c || true) && R.sinhTheoMau("^[a-z]{3,8}$", JE.taoRng("q"), {}).chuoi === a, a + " " + c); }

  /* ---------------- do dai ---------------- */
  nhom("regex-sinh · do dai (code point) trong [doDaiMin, doDaiMax] khi co the");
  const CA_DAI = [
    ["^[a-z]+$", 5, 5], ["^[a-z]+$", 1, 3], ["^[a-z]*$", 10, 12], ["^\\d+$", 8, 20], ["^[a-z]{3,10}$", 4, 6], ["^[a-z]{3,10}$", 9, 10], ["^(ab)+$", 6, 6], ["^(ab)+$", 4, 10],
    ["[a-z]{2}", 6, 6], ["abc", 3, 3], ["[a-z]+", 12, 15], [".*", 7, 7], ["^.+$", 1, 1], ["\\w+", 20, 30], ["^\\d{4}$", 4, 4], ["a+b+", 10, 10], ["^[\\u00C0-\\u017F]+$", 4, 4],
    ["^(foo|barbaz)$", 3, 3], ["^(foo|barbaz)$", 6, 6], ["[a-z]*", 0, 0], ["^$", 0, 0], ["x?", 0, 1]
  ];
  let hongDai = [];
  for (const [m, mn, mx] of CA_DAI) {
    let ok = 0;
    for (let seed = 0; seed < 20; seed++) {
      const r = R.sinhTheoMau(m, JE.taoRng("d" + seed), { doDaiMin: mn, doDaiMax: mx }), n = Array.from(r.chuoi).length;
      if (r.khop && n >= mn && n <= mx && new RegExp(m, "u").test(r.chuoi)) ok++;
    }
    if (ok < 20) hongDai.push(m + " [" + mn + "," + mx + "] " + ok + "/20");
  }
  kiem("regex-sinh · " + CA_DAI.length + " ca (mau, min, max) x 20 seed: khop that VA do dai dung", hongDai.length === 0, hongDai.join(" | "));
  { const r = R.sinhTheoMau("^abc$", JE.taoRng("a"), { doDaiMin: 10 });
    kiem("regex-sinh · mau co dinh dai 3 ma doi min 10 -> KHONG bia: khop:false + canhBao ro", r.khop === false && r.canhBao.some((x) => /Không sinh được/.test(x)), JSON.stringify(r)); }
  { const r = R.sinhTheoMau("[a-z]{2}", JE.taoRng("a"), { doDaiMin: 6, doDaiMax: 6 });
    kiem("regex-sinh · mau KHONG neo, thieu do dai -> dem them ky tu, van khop", r.khop && r.chuoi.length === 6 && /[a-z]{2}/.test(r.chuoi), r.chuoi); }
  { const r = R.sinhTheoMau("^[a-z]+$", JE.taoRng("a"), { doDaiMin: 5, doDaiMax: 2 });
    kiem("regex-sinh · min > max -> khop:false (khong the thoa)", r.khop === false); }

  /* ---------------- khong ho tro / sai ---------------- */
  nhom("regex-sinh · lookaround / \\b -> khongHoTro (bao, khong bia); cu phap sai; lop rong");
  for (const m of MAU_KHONG_CHAC) {
    const ph = R.phanTich(m);
    const r = R.sinhTheoMau(m, JE.taoRng("k"), {});
    kiem("khongHoTro · " + m + " -> phanTich ghi khongHoTro, canhBao nhac; khop chi la TRUE khi RegExp that khop", ph.khongHoTro.length > 0 && r.canhBao.length > 0 && (r.khop === false || new RegExp(m, "u").test(r.chuoi)),
      JSON.stringify([ph.khongHoTro, r.khop, r.chuoi]));
  }
  kiem("khongHoTro · \\bword\\b: sinh 'word' va KHOP that (xap xi dung)", R.sinhTheoMau("\\bword\\b", JE.taoRng("w"), {}).khop === true && R.phanTich("\\bword\\b").khongHoTro.length === 1);
  for (const m of MAU_SAI) {
    let e = null;
    try { R.phanTich(m); } catch (x) { e = x; }
    const r = chuoiDeu(JE, m);
    kiem("phanTich · mau sai " + JSON.stringify(m) + " -> nem {thongBao, cot}; sinhTheoMau khong nem, bao khop:false", e && typeof e.thongBao === "string" && typeof e.cot === "number" && r.khop === false && r.canhBao.length > 0, JSON.stringify(e));
  }
  { const r = R.sinhTheoMau("[^\\u0000-\\u{10FFFF}]", JE.taoRng("r"), {});
    kiem("lop ky tu RONG (phan bu cua moi ky tu) -> khop:false, canhBao co mat", r.khop === false && r.canhBao.length > 0, JSON.stringify(r)); }
  { const r = R.sinhTheoMau("[]", JE.taoRng("r"), {});
    kiem("[] (lop rong cua JS) -> khop:false", r.khop === false); }
  { const r = R.sinhTheoMau("(?i:abc)", JE.taoRng("r"), {});
    let ok = r.khop === false, re = null;
    try { re = new RegExp("(?i:abc)", "u"); } catch (e) { re = null; }
    if (r.khop === true) ok = !!re && re.test(r.chuoi);                    /* V8 moi ho tro cu phap modifiers: khop that thi duoc */
    kiem("co noi tuyen (?i:…) (V8 cu: khong hop le -> khop:false; V8 moi: khop that): khong nem, ket qua trung thuc", ok && R.phanTich("(?i:abc)").khongHoTro.length === 1, JSON.stringify(r)); }
  { const r = R.sinhTheoMau("^\\p{Script=Latin}+$", JE.taoRng("r"), {});
    kiem("\\p{Script=Latin}: xap xi bang tap chu cai, khop that", r.khop === true && /^[A-Za-zÀ-ɏḀ-ỿ]+$/u.test(r.chuoi), r.chuoi); }
  { const r = R.sinhTheoMau("^[a-z]+\\.[a-z]+$", JE.taoRng("r"), {});
    kiem("\\. thoat dau cham: co dung 1 dau '.'", r.khop && (r.chuoi.match(/\./g) || []).length === 1, r.chuoi); }
  { const r = R.sinhTheoMau("^(?<ten>[a-z]{2,4})-\\k<ten>$", JE.taoRng("r"), {});
    const p = r.chuoi.split("-");
    kiem("tham chieu nguoc ten \\k<ten>: hai ve giong nhau", r.khop && p.length === 2 && p[0] === p[1], r.chuoi); }

  /* ---------------- an toan / tuyen tinh ---------------- */
  nhom("regex-sinh · an toan: phan tich + sinh tuyen tinh theo do dai mau, khong bat tran ngan xep");
  const dongHo = (f) => C.hieuChuan(f, 3);
  { const sau = "(".repeat(150) + "a" + ")".repeat(150), t = dongHo(() => R.sinhTheoMau(sau, JE.taoRng("s"), {}));
    kiem("nhom long 150 cap: sinh duoc, khop that", R.sinhTheoMau(sau, JE.taoRng("s"), {}).khop === true, t.toFixed(1) + " ms");
    let e = null; try { R.phanTich("(".repeat(300) + "a" + ")".repeat(300)); } catch (x) { e = x; }
    kiem("nhom long 300 cap (> tran 200): bao loi co kiem soat, khong tran ngan xep", e && /lồng quá sâu/.test(e.thongBao), JSON.stringify(e)); }
  for (const n of [2000, 20000]) {
    const m = "a".repeat(n), t = dongHo(() => R.sinhTheoMau(m, JE.taoRng("s"), {}));
    const t0 = dongHo(() => R.sinhTheoMau("a".repeat(1000), JE.taoRng("s"), {}));
    kiem("mau dai " + n + " ky tu: sinh trong thoi gian tuyen tinh (< max(250 ms x SLACK, 400 x mau 1000 ky tu))", t < Math.max(250 * SLACK, 400 * t0), t.toFixed(1) + " ms (mau 1000: " + t0.toFixed(2) + ")");
  }
  { const m = "(a|b)".repeat(5000), t = dongHo(() => R.phanTich(m)), t1 = dongHo(() => R.phanTich("(a|b)".repeat(500)));
    kiem("5 000 nhom lien tiep: phanTich tuyen tinh (< max(300 ms x SLACK, 40 x mau 500 nhom))", t < Math.max(300 * SLACK, 40 * t1), t.toFixed(1) + " ms (500 nhom: " + t1.toFixed(2) + ")"); }
  { const r = R.sinhTheoMau("a{99999}", JE.taoRng("s"), {});
    kiem("a{99999}: chuoi bi cat o tran 20 000 ky tu, khong treo, khong khop-gia", r.chuoi.length <= 20001 && (r.khop === false || /^a+$/.test(r.chuoi)), r.chuoi.length + " ky tu, khop " + r.khop); }
  { const r = R.sinhTheoMau("a{200000}", JE.taoRng("s"), {});
    kiem("a{200000} (> tran luong tu): bao loi phan tich, khop:false", r.khop === false && r.canhBao.length > 0, JSON.stringify(r.canhBao)); }
  { const r = R.sinhTheoMau("(a+)+$", JE.taoRng("s"), {}), t = dongHo(() => R.sinhTheoMau("(a+)+$", JE.taoRng("s"), {}));
    kiem("(a+)+$ (ReDoS khi KIEM chuoi xau): sinh ra chuoi khop nhanh, khong quay lui", r.khop === true && t < 200 * SLACK, t.toFixed(1) + " ms"); }
  { const t = dongHo(() => { for (let i = 0; i < 500; i++) R.sinhTheoMau("^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$", JE.taoRng("t" + i), {}); });
    kiem("500 lan sinh email-pattern < max(1 500 ms x SLACK, ...)", t < 1500 * SLACK, t.toFixed(0) + " ms"); }
  { let e = null; try { R.phanTich("a{1,99999999999}"); } catch (x) { e = x; }
    kiem("luong tu {1,99999999999} (max khong gioi han thuc te) phan tich duoc, khong nem", e === null); }
  kiem("sinhChuoi · dung `doDaiToiDa` cat dau ra (a* voi lapToiDa lon)", R.sinhChuoi(R.phanTich("a*").ast, JE.taoRng("c"), { lapToiDa: 1e6, doDaiToiDa: 50, thienLon: true }).chuoi.length <= 51);
};
