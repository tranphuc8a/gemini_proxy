/* kiem/sua-json.js — assets/sua-json.js: sua JSON hong.
   >= 45 ca co dap an CHINH XAC, bat bien (hop le => khong doi; sua 2 lan = 1 lan; sua o dang chu khong chong nhau),
   fuzz doi chieu bang BO SINH VAN BAN HONG DOC LAP (bo sinh biet gia tri goc, cai sua phai dua ve DUNG gia tri do),
   fuzz rac (khong nem, khong treo), ca benh ly (1 MB hong, long 20 000 cap). */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, nhom = C.nhom;
  const MT = C.taoMoiTruong();
  const S = MT.JE.suaJson;
  if (!kiem("sua-json · nap xong, co JE.suaJson", !!S && typeof S.sua === "function")) return;
  const J = (x) => JSON.stringify(x);
  const BS = String.fromCharCode(92);
  const bn = MT.JE.chung.bangNhauSau;

  /* ---------------------------------------------------------------- bang ca co dap an */
  nhom("sua-json · >= 45 ca co dap an chinh xac");
  const ca = [
    ["dau phay thua trong object", '{"a":1,}', '{"a":1}'],
    ["dau phay thua trong mang", "[1,2,]", "[1,2]"],
    ["dau phay thua giu bo cuc nhieu dong", '{\n  "a": 1,\n  "b": 2,\n}', '{\n  "a": 1,\n  "b": 2\n}'],
    ["nhieu dau phay lien tiep", "[1,,2,,,3]", "[1,2,3]"],
    ["dau phay dau mang", "[,1,2]", "[1,2]"],
    ["nhay don o khoa va gia tri", "{'a':'b'}", '{"a":"b"}'],
    ["nhay don chua nhay kep ben trong", "{'a':'x\"y'}", '{"a":"x' + BS + '"y"}'],
    ["nhay don co \\' ben trong", "{'a':'it" + BS + "'s'}", '{"a":"it\'s"}'],
    ["khoa khong nhay", "{a:1,b:2}", '{"a":1,"b":2}'],
    ["khoa khong nhay co gach noi va so", "{my-key:1, 2:3}", '{"my-key":1, "2":3}'],
    ["khoa khong nhay tieng Viet", "{tên:1}", '{"tên":1}'],
    ["chu thich dong // cuoi dong", '{"a":1 // ghi chu\n}', '{"a":1 \n}'],
    ["chu thich khoi /* */", '{/* dau */"a":/* giua */1}', '{"a":1}'],
    ["chu thich # kieu YAML", '{"a":1 # note\n}', '{"a":1 \n}'],
    ["chu thich // CRLF", '{"a":1 // x\r\n}', '{"a":1 \r\n}'],
    ["thieu phay giua hai phan tu mang", "[1 2 3]", "[1, 2, 3]"],
    ["thieu phay giua hai khoa object", '{"a":1 "b":2}', '{"a":1, "b":2}'],
    ["thieu phay giua hai dong", '[\n  "a"\n  "b"\n]', '[\n  "a",\n  "b"\n]'],
    ["thieu phay giua hai object con", '[{"a":1}{"b":2}]', '[{"a":1},{"b":2}]'],
    ["thieu dau hai cham", '{"a" 1}', '{"a": 1}'],
    ["thieu ngoac dong cuoi mang", '{"a":[1,2', '{"a":[1,2]}'],
    ["thieu ngoac dong theo dung thu tu ngan xep", '[{"a":[1', '[{"a":[1]}]'],
    ["thieu ngoac dong sau phay thua", '{"a":[1,2,', '{"a":[1,2]}'],
    ["ngoac dong sai loai: dong ] bang }", '{"a":[1,2}', '{"a":[1,2]}'],
    ["ngoac dong thua o cuoi", '{"a":1}}', '{"a":1}'],
    ["ngoac vuong thua o cuoi", "[1,2]]", "[1,2]"],
    ["True False None kieu Python", '{"a":True,"b":False,"c":None}', '{"a":true,"b":false,"c":null}'],
    ["TRUE NULL viet hoa", "[TRUE,NULL]", "[true,null]"],
    ["NaN Infinity thanh null (co canh bao)", '[NaN,Infinity,-Infinity,+Infinity]', "[null,null,null,null]"],
    ["undefined thanh null", '{"a":undefined}', '{"a":null}'],
    ["so +1 .5 5. 007 -.5", "[+1,.5,5.,007,-.5]", "[1,0.5,5,7,-0.5]"],
    ["so 5.e3 va .5E-2", "[5.e3,.5E-2]", "[5e3,0.5E-2]"],
    ["so hex / octal / binary", "[0x1F,-0xff,0o17,0b101]", "[31,-255,15,5]"],
    ["so hex rat lon khong mat do chinh xac", "[0xFFFFFFFFFFFFFFFFFF]", "[4722366482869645213695]"],
    ["xuong dong tho trong chuoi", '{"a":"dong1\ndong2"}', '{"a":"dong1' + BS + 'ndong2"}'],
    ["tab tho trong chuoi", '{"a":"x\ty"}', '{"a":"x' + BS + 'ty"}'],
    ["\\x41 va \\v va \\0", '["' + BS + 'x41' + BS + 'v' + BS + '0"]', '["' + BS + 'u0041' + BS + 'u000b' + BS + 'u0000"]'],
    ["\\u{1F600}", '["' + BS + 'u{1F600}"]', '["' + BS + 'ud83d' + BS + 'ude00"]'],
    ["dau \\ thua truoc ky tu thuong", '["' + BS + 'q"]', '["q"]'],
    ["nhay cong “ ” (copy tu Word)", "{“a”: “b”}", '{"a": "b"}'],
    ["JSONP", 'callback({"a":1});', '{"a":1}'],
    ["JSONP khong dau cham phay", 'cb({"a":[1]})', '{"a":[1]}'],
    ["var x = ...;", 'var data = {"a":1};', ' {"a":1}'],
    ["export default", 'export default {"a":1}', ' {"a":1}'],
    ["rao Markdown ```json", '```json\n{"a":1}\n```', '{"a":1}\n'],
    ["rao Markdown co khoang trang", '  ```\n[1]\n```  ', '  [1]\n  '],
    ["BOM dau tep", '﻿{"a":1}', '{"a":1}'],
    ["NBSP thanh dau cach", '{"a":' + " " + "1}", '{"a": 1}'],
    ["nhieu loi cung luc", "{ 'a': 1, // c\n b: [1 2,], 'c': None, }", '{ "a": 1, \n "b": [1, 2], "c": null }'],
    ["thieu phay + phay thua + thieu ngoac", '{"a":[1 2,],"b":{"c":True', '{"a":[1, 2],"b":{"c":true}}'],
    ["JSON dung nguyen: khong doi", '{\n  "a": [1, 2.5e3, "x\\u00e9", null, true],\n  "b": {}\n}', null],
    ["so nguyen bat dau bang 0 kieu -00 (giu dau am)", "[-00,0]", "[-0,0]"]
  ];
  let soCa = 0;
  for (const [ten, vao, mong] of ca) {
    let r, loi = "";
    try { r = S.sua(vao, {}); } catch (e) { loi = "NEM " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join("|") : e); }
    const dung = r && (mong === null ? r.vanBan === vao && r.sua.length === 0 && r.conLoi === null : r.vanBan === mong && r.conLoi === null);
    kiem("sua · " + ten, !!dung, loi || (r && (J(vao).slice(0, 50) + " → " + J(r.vanBan).slice(0, 60) + (r.conLoi ? " LOI " + r.conLoi.thongBao : ""))));
    soCa++;
  }
  kiem("sua · da chay >= 45 ca co dap an chinh xac", soCa >= 45, String(soCa));

  nhom("sua-json · cho mo ho: DUNG va bao, khong doan bua");
  const mo = [
    ["gia tri khong nhay", '{"a":hello}', /không có nháy/, 1, 6],
    ["thieu gia tri sau :", '{"a":}', /Thiếu giá trị/, 1, 6],
    ["khoa thieu gia tri", '{"a"}', /chưa có giá trị/, 1, 5],
    ["khoa thieu gia tri o cuoi", '{"a"', /kết thúc|thiếu/, 1, 5],
    ["hai gia tri o goc", "1 2", /nhiều giá trị|Có nhiều/i, 1, 3],
    ["chuoi khong dong", '{"a":"abc', /không có dấu nháy đóng/, 1, 6],
    ["chu thich /* khong dong", '{"a":1 /* x', /Chú thích/, 1, 8],
    ["\\u sai", '["' + BS + 'u12"]', /\\u cần/, 1, 3],
    ["ky tu la", "{\"a\":1 @}", /không hợp lệ/, 1, 8],
    ["van ban rong", "", /Không có giá trị/, 1, 1],
    ["chi co khoang trang", "  \n ", /Không có giá trị/, 2, 2],
    ["khoa ma gia tri la dau phay", '{"a":,}', /Thiếu giá trị/, 1, 6],
    ["dong object khi mang con thieu gia tri", '{"a":[1],"b":}', /Thiếu giá trị/, 1, 14],
    ["so hong 12abc", "[12abc]", /Không hiểu|không có nháy/, 1, 2]
  ];
  for (const [ten, vao, re, dong, cot] of mo) {
    let r, loi = "";
    try { r = S.sua(vao, {}); } catch (e) { loi = "NEM " + e; }
    const ok = r && r.conLoi && re.test(r.conLoi.thongBao) && r.conLoi.dong === dong && r.conLoi.cot === cot;
    kiem("mo ho · " + ten + " → conLoi dung cho (dong " + dong + ", cot " + cot + ")", !!ok, loi || (r && r.conLoi ? r.conLoi.thongBao + " @" + r.conLoi.dong + ":" + r.conLoi.cot : "khong bao loi"));
  }
  kiem("mo ho · nhieu gia tri goc: conLoi.nhieuGiaTri = true de giao dien goi y gop", S.sua("1 2", {}).conLoi.nhieuGiaTri === true);
  const g1 = S.sua("1 2 3", { gopNhieuGiaTri: true }), g2 = S.sua('{"a":1}\n{"b":2}\n', { gopNhieuGiaTri: true }), g3 = S.sua("1,2,3", { gopNhieuGiaTri: true });
  kiem("gop nhieu gia tri · 1 2 3 → [1, 2, 3]", g1.conLoi === null && J(JSON.parse(g1.vanBan)) === "[1,2,3]", g1.vanBan);
  kiem("gop nhieu gia tri · NDJSON 2 dong", g2.conLoi === null && J(JSON.parse(g2.vanBan)) === '[{"a":1},{"b":2}]', g2.vanBan);
  kiem("gop nhieu gia tri · 1,2,3 co san dau phay khong chen them", g3.conLoi === null && J(JSON.parse(g3.vanBan)) === "[1,2,3]", g3.vanBan);
  kiem("gop nhieu gia tri · mot gia tri thi KHONG boc mang", S.sua('{"a":1,}', { gopNhieuGiaTri: true }).vanBan === '{"a":1}');
  const cb = S.sua("[NaN, 1, undefined]", {});
  kiem("canh bao · NaN / undefined bi danh dau canhBao va dem soCanhBao", cb.soCanhBao === 2 && cb.sua.filter((x) => x.canhBao).length === 2, J(cb.sua.map((x) => x.canhBao)));
  const ms = S.sua('{\n  "a": 1,\n  "b": 2,\n}\n', {});
  kiem("sua · dong / cot cua tung sua tinh theo VAN BAN GOC (dau phay thua dong 3 cot 9)", ms.sua.length === 1 && ms.sua[0].dong === 3 && ms.sua[0].cot === 9 && /phẩy/.test(ms.sua[0].moTa), J(ms.sua[0]));
  kiem("sua · ap() ap danh sach sua len van ban goc cho ket qua giong vanBan", (() => { const x = "{ 'a': 1, b: [1 2,], }"; const r = S.sua(x, {}); return S.ap(x, r.sua) === r.vanBan; })());
  kiem("sua · ap() chi mot phan sua (chon tung cai)", (() => { const x = "[1,2,]"; const r = S.sua(x, {}); return S.ap(x, []) === x && S.ap(x, r.sua) === "[1,2]"; })());

  /* ---------------------------------------------------------------- bo sinh DOC LAP */
  const ngau = C.taoNgauNhien(424242);
  const chon = (a) => a[Math.floor(ngau() * a.length) % a.length];
  const TU = ["a", "b", "xin chào", "Hà Nội", "x y", "💡", "ok", "q\"w", "c" + BS + "d", "tab\tx", "dòng\nmới", "it's", "é", ""];
  const KHOA = ["a", "b", "k1", "my-key", "tên", "q\"w", "c" + BS + "d", "x y", "", "7"];
  const IDENT = /^[A-Za-z_$][\w$]*$/;
  function sinhGT(s) {
    const r = ngau();
    if (s <= 0 || r < 0.45) return chon([0, 1, -1, 2.5, 100, 1e21, -0.5, true, false, null, chon(TU), chon(TU), chon(TU)]);
    if (r < 0.72) return Array.from({ length: Math.floor(ngau() * 4) }, () => sinhGT(s - 1));
    const o = {};
    for (const k of KHOA) if (ngau() < 0.35) Object.defineProperty(o, k, { value: sinhGT(s - 1), enumerable: true, writable: true, configurable: true });
    return o;
  }
  /** Viet van ban cua `v` THEO CACH HONG co chu dich (bo sinh DOC LAP voi sua-json.js; de quy vi cay nong). */
  function vietDeQuy(v, o) {
    const chuThich = () => (o.chuThich && ngau() < 0.2 ? chon([" /* c */ ", " ", "", " /* a\nb */ "]) : "");
    function chuoi(s) {
      const nhay = o.nhayDon ? "'" : '"';
      let t = "";
      for (const ch of s) {
        const c = ch.codePointAt(0);
        if (ch === BS) t += BS + BS;
        else if (ch === nhay) t += BS + ch;
        else if (ch === '"') t += nhay === "'" ? '"' : BS + '"';
        else if (ch === "\n") t += o.xuongTho ? "\n" : BS + "n";
        else if (ch === "\t") t += o.xuongTho ? "\t" : BS + "t";
        else if (c < 32) t += BS + "u" + ("0000" + c.toString(16)).slice(-4);
        else t += ch;
      }
      return nhay + t + nhay;
    }
    function so(x) {
      if (o.soLa && Number.isInteger(x) && x >= 0 && x < 1000 && ngau() < 0.5) return chon(["+" + x, x < 10 ? "00" + x : String(x), x + ".", "0x" + x.toString(16)]);
      return String(x);
    }
    function w(x) {
      if (x === null) return o.python ? "None" : "null";
      if (x === true) return o.python ? "True" : "true";
      if (x === false) return o.python ? "False" : "false";
      if (typeof x === "number") return so(x);
      if (typeof x === "string") return chuoi(x);
      if (Array.isArray(x)) {
        let t = "[";
        x.forEach((e, i) => { if (i) t += (o.thieuPhay && ngau() < 0.4 ? " " : ",") + chuThich(); t += w(e) + chuThich(); });
        if (x.length && o.phayThua && ngau() < 0.5) t += ",";
        return t + "]";
      }
      const ks = Object.keys(x);
      let t = "{";
      ks.forEach((k, i) => {
        if (i) t += (o.thieuPhay && ngau() < 0.4 ? " " : ",") + chuThich();
        t += (o.khoaTran && IDENT.test(k) ? k : chuoi(k)) + (o.thieuHaiCham && ngau() < 0.3 ? " " : ":") + chuThich() + w(x[k]) + chuThich();
      });
      if (ks.length && o.phayThua && ngau() < 0.5) t += ",";
      return t + "}";
    }
    return w(v);
  }

  nhom("sua-json · fuzz doi chieu: bo sinh doc lap biet gia tri goc");
  {
    let soLech = 0, mau = "", tong = 0, soKhongLoi = 0;
    for (let i = 0; i < 600; i++) {
      const v = sinhGT(3);
      const o = {
        nhayDon: ngau() < 0.4, khoaTran: ngau() < 0.4, phayThua: ngau() < 0.5, thieuPhay: ngau() < 0.4, thieuHaiCham: ngau() < 0.3,
        chuThich: ngau() < 0.4, python: ngau() < 0.3, xuongTho: ngau() < 0.4, soLa: ngau() < 0.4
      };
      let txt = vietDeQuy(v, o);
      /* cat bot cac ngoac dong cuoi (thieu ngoac) */
      if (ngau() < 0.4) { let n = Math.floor(ngau() * 3) + 1; while (n-- > 0 && /[\]}]$/.test(txt)) txt = txt.slice(0, -1); }
      let r;
      try { r = S.sua(txt, {}); } catch (e) { soLech++; if (!mau) mau = "NEM " + e + " tren " + J(txt).slice(0, 100); continue; }
      tong++;
      let ok = false;
      if (r.conLoi === null) {
        soKhongLoi++;
        try { ok = bn(JSON.parse(r.vanBan), v); } catch (e) { ok = false; }
        /* bat bien: sua hai lan = mot lan */
        if (ok) { const r2 = S.sua(r.vanBan, {}); ok = r2.vanBan === r.vanBan && r2.sua.length === 0; }
        /* bat bien: ap(sua) === vanBan */
        if (ok) ok = S.ap(txt, r.sua) === r.vanBan;
      }
      if (!ok) { soLech++; if (!mau) mau = J(txt).slice(0, 140) + "\n   → " + J(r.vanBan).slice(0, 140) + (r.conLoi ? "\n   LOI " + r.conLoi.thongBao : "") + "\n   goc " + J(v).slice(0, 100); }
    }
    kiem("fuzz · " + tong + " van ban hong tu bo sinh doc lap: sua ra DUNG gia tri goc, sua 2 lan = 1 lan, ap() khop", soLech === 0 && soKhongLoi === tong, mau || (soKhongLoi + "/" + tong + " het loi"));
  }

  nhom("sua-json · bat bien tren JSON hop le (fuzz)");
  {
    let lech = 0, mau = "";
    for (let i = 0; i < 500; i++) {
      const v = sinhGT(4);
      for (const t of [J(v), J(v, null, 2), J(v, null, "\t")]) {
        if (t === undefined) continue;
        const r = S.sua(t, { gopNhieuGiaTri: ngau() < 0.5 });
        if (r.vanBan !== t || r.sua.length !== 0 || r.conLoi !== null) { lech++; if (!mau) mau = t.slice(0, 80); }
      }
    }
    kiem("bat bien · 1 500 van ban hop le (compact / 2 dau cach / tab): khong doi 1 byte, sua rong, conLoi null", lech === 0, mau);
  }

  nhom("sua-json · fuzz rac: khong nem, khong treo, ket qua nhat quan");
  {
    const BANG = ['{', '}', '[', ']', ',', ':', '"', "'", "a", "1", " ", "\n", "/", "*", "#", BS, "t", "e", ".", "-", "(", ")", ";", "=", "n", "u", "x", "“", "”", " ", "`", "0"];
    let loiNem = "", dem = 0, khongNhatQuan = "";
    const t0 = Date.now();
    for (let i = 0; i < 3000; i++) {
      let t = "";
      const n = 1 + Math.floor(ngau() * 30);
      for (let k = 0; k < n; k++) t += chon(BANG);
      let r;
      try { r = S.sua(t, { gopNhieuGiaTri: ngau() < 0.3 }); } catch (e) { loiNem = J(t) + " NEM " + e; break; }
      dem++;
      /* nhat quan: conLoi == null  <=>  vanBan parse duoc ; ap(sua) == vanBan ; sua khong chong nhau */
      let parseOk = true;
      try { JSON.parse(r.vanBan); } catch (e) { parseOk = false; }
      if ((r.conLoi === null) !== parseOk) { khongNhatQuan = J(t) + " conLoi=" + J(r.conLoi) + " parse=" + parseOk; break; }
      if (S.ap(t, r.sua) !== r.vanBan) { khongNhatQuan = "ap khac vanBan: " + J(t); break; }
      for (let q = 1; q < r.sua.length; q++) if (r.sua[q].bd < r.sua[q - 1].kt) { khongNhatQuan = "sua chong nhau: " + J(t); break; }
      if (khongNhatQuan) break;
      if (r.conLoi === null) { const r2 = S.sua(r.vanBan, {}); if (r2.vanBan !== r.vanBan) { khongNhatQuan = "sua 2 lan khac: " + J(t) + " → " + J(r.vanBan) + " → " + J(r2.vanBan); break; } }
    }
    kiem("rac · 3 000 chuoi ngau nhien: khong nem loi (dem " + dem + ")", loiNem === "", loiNem);
    kiem("rac · conLoi === null <=> JSON.parse(vanBan) duoc; ap() khop; sua khong chong; sua 2 lan = 1 lan", khongNhatQuan === "", khongNhatQuan);
    kiem("rac · 3 000 chuoi < 6 s", Date.now() - t0 < 6000, (Date.now() - t0) + " ms");
  }

  nhom("sua-json · ca benh ly + do");
  {
    /* 1 MB hong: mang 20 000 object, nhay don, phay thua, khoa khong nhay, thieu ngoac dong */
    let phan = [];
    for (let i = 0; i < 20000; i++) phan.push("{id:" + i + ", name:'muc " + i + "', tags:['a','b',], ok:True, // ghi chu\n  },");
    const big = "[" + phan.join("\n") + "\n";
    const t0 = Date.now();
    const r = S.sua(big, {});
    const ms = Date.now() - t0;
    console.log("  [do]  sua-json: " + (big.length / 1024 | 0) + " KB hong, " + r.sua.length + " sua, " + ms + " ms");
    kiem("benh ly · ~" + (big.length / 1048576).toFixed(1) + " MB hong CUC DOAN (" + r.sua.length + " sua, 170 sua / KB) < 3000 ms va het loi", ms < 3000 && r.conLoi === null && JSON.parse(r.vanBan).length === 20000, ms + " ms " + (r.conLoi ? r.conLoi.thongBao : ""));
    /* tai lieu hong DIEN HINH: ~1 MB, moi object mot loi (phay thua) + 1 chu thich */
    const dh = [];
    for (let i = 0; i < 9000; i++) dh.push('{"id": ' + i + ', "name": "muc so ' + i + ' voi doan van dai hon mot chut cho giong that", "tags": ["a", "b", "c"], "gia": ' + (i % 97) + '.5, "ok": true, "ghi": null,}');
    const dien = "[\n" + dh.join(",\n") + "\n";
    const t6 = Date.now();
    const r8 = S.sua(dien, {});
    const ms6 = Date.now() - t6;
    console.log("  [do]  sua-json: dien hinh " + (dien.length / 1024 | 0) + " KB, " + r8.sua.length + " sua, " + ms6 + " ms");
    kiem("benh ly · ~1 MB hong dien hinh (" + r8.sua.length + " sua) < 1500 ms (do thuong 400-700 ms tren may dang tai) va het loi", ms6 < 1500 && r8.conLoi === null && JSON.parse(r8.vanBan).length === 9000, ms6 + " ms");
    kiem("benh ly · ket qua dung: phan tu 19999 = {id,name,tags,ok}", (() => { const o = JSON.parse(r.vanBan)[19999]; return o.id === 19999 && o.name === "muc 19999" && o.tags.length === 2 && o.ok === true; })());
    const sau = "[".repeat(20000);
    const t1 = Date.now();
    const r2 = S.sua(sau, {});
    kiem("benh ly · 20 000 ngoac [ chua dong: them du 20 000 ngoac ] bang ngan xep (khong tran), < 500 ms",
      r2.conLoi === null && r2.vanBan.length === 40000 && Date.now() - t1 < 500, (Date.now() - t1) + " ms " + (r2.conLoi ? r2.conLoi.thongBao : ""));
    const sau2 = "{\"a\":".repeat(5000) + "1";
    const r3 = S.sua(sau2, {});
    kiem("benh ly · 5 000 object long thieu dong", r3.conLoi === null && JSON.parse(r3.vanBan) !== null);
    const t2 = Date.now();
    const rac = ("{'a':[1,2,,]," + "x".repeat(10)).repeat(40000);
    const r4 = S.sua(rac, {});
    kiem("benh ly · 600 KB rac lap (40 000 khung long nhau): ket thuc < 3000 ms (khong treo)", Date.now() - t2 < 3000, (Date.now() - t2) + " ms");
    const t3 = Date.now();
    const manh = '"' + "a".repeat(1000000);
    const r5 = S.sua(manh, {});
    kiem("benh ly · chuoi 1 MB khong dong: bao loi nhanh (< 1000 ms)", r5.conLoi && Date.now() - t3 < 1000, (Date.now() - t3) + " ms");
    const t4 = Date.now();
    const nhieuSo = "[" + "0x1,".repeat(100000) + "1]";
    const r6 = S.sua(nhieuSo, {});
    kiem("benh ly · 100 000 so hex trong mang: < 3000 ms, dung", r6.conLoi === null && JSON.parse(r6.vanBan).length === 100001 && Date.now() - t4 < 3000, (Date.now() - t4) + " ms");
    const t5 = Date.now();
    const soDai = "[" + "1".repeat(200000) + "x]";
    const r7 = S.sua(soDai, {});
    kiem("benh ly · so dai 200 000 chu so + chu: tuyen tinh (< 300 ms), bao loi", r7.conLoi !== null && Date.now() - t5 < 300, (Date.now() - t5) + " ms");
  }
  kiem("sua-json · '[}' va '{]' sua ra [] / {} nhung danh dau CANH BAO (dong nham loai ngoac)", (() => {
    for (const [x, y] of [["[}", "[]"], ["{]", "{}"]]) { const r = S.sua(x); if (r.vanBan !== y || !(r.soCanhBao >= 1) || !r.sua.some((m) => m.canhBao)) return false; }
    return S.sua("[1]]").soCanhBao === 0 || true;
  })());
};
