/* =====================================================================
   kiem.js — kiem du lieu mau va cac ham thuan cua trang tra.

       node kiem.js

   Hai phan:
     1. DU LIEU — 23 mau GoF phai du va dung nhom, khong mau nao thieu
        truong, khong ma trung. Day la loai loi de lot nhat khi go tay
        hang nghin dong du lieu.
     2. HAM THUAN — tim khong dau, to sang, va SVG sinh ra phai hop le.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* --- nap mau.js va trang.js voi DOM toi thieu --- */
function nutGia() {
  const n = {
    _t: "", className: "", value: "", textContent: "", children: [],
    appendChild(c) { n.children.push(c); return c; },
    addEventListener() {}, onclick: null, focus() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }
  };
  Object.defineProperty(n, "innerHTML", { get: () => n._t, set(v) { n._t = v; } });
  return n;
}
const ctx = {
  window: {},
  document: {
    querySelector: () => nutGia(),
    createElement: () => nutGia(),
    documentElement: { getAttribute: () => null, setAttribute() {} },
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {} },
  setTimeout, clearTimeout,
  console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const A = path.join(__dirname, "assets");
vm.runInContext(fs.readFileSync(path.join(A, "mau.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(A, "trang.js"), "utf8"), ctx);

const M = ctx.window.MAU_THIET_KE;
const T = ctx.window.DP_THU;
if (!M || !T) { console.error("Khong nap duoc du lieu hoac ham."); process.exit(1); }

let hong = 0;
function kiem(ten, dat, chiTiet) {
  console.log("  " + (dat ? "[ok]  " : "[SAI] ") + ten + (chiTiet ? "   " + chiTiet : ""));
  if (!dat) hong++;
}

console.log("\nKiem design-pattern\n" + "-".repeat(58));

/* ====================== 1. Du lieu ====================== */
{
  const theoNhom = {};
  M.forEach((m) => { theoNhom[m.nhom] = (theoNhom[m.nhom] || 0) + 1; });

  /* Con so GoF la co dinh va kiem duoc: 5 + 7 + 11 = 23. */
  kiem("du lieu · du 5 mau KHOI TAO", theoNhom["khoi-tao"] === 5, theoNhom["khoi-tao"]);
  kiem("du lieu · du 7 mau CAU TRUC", theoNhom["cau-truc"] === 7, theoNhom["cau-truc"]);
  kiem("du lieu · du 11 mau HANH VI", theoNhom["hanh-vi"] === 11, theoNhom["hanh-vi"]);
  kiem("du lieu · tong GoF dung 23",
    theoNhom["khoi-tao"] + theoNhom["cau-truc"] + theoNhom["hanh-vi"] === 23);

  /* Doi chieu voi DANH SACH TEN goc cua GoF — khong chi dem so luong. */
  const GOF = [
    "Abstract Factory", "Builder", "Factory Method", "Prototype", "Singleton",
    "Adapter", "Bridge", "Composite", "Decorator", "Facade", "Flyweight", "Proxy",
    "Chain of Responsibility", "Command", "Interpreter", "Iterator", "Mediator",
    "Memento", "Observer", "State", "Strategy", "Template Method", "Visitor"
  ];
  const co = new Set(M.filter((m) => m.nhom !== "hien-dai").map((m) => m.ten));
  const thieu = GOF.filter((g) => !co.has(g));
  const thua = [...co].filter((x) => GOF.indexOf(x) < 0);
  kiem("du lieu · co du dung 23 ten GoF, khong thieu cai nao",
    thieu.length === 0, thieu.length ? "thieu: " + thieu.join(", ") : "23/23");
  kiem("du lieu · khong co ten la nao bi xep nham vao GoF",
    thua.length === 0, thua.length ? "thua: " + thua.join(", ") : "sach");

  const ma = M.map((m) => m.ma);
  kiem("du lieu · ma khong trung", new Set(ma).size === ma.length);
  kiem("du lieu · ma chi dung chu thuong va gach ngang",
    ma.every((x) => /^[a-z0-9-]+$/.test(x)));

  const BAT_BUOC = ["ma", "ten", "viet", "nhom", "yDinh", "dungKhi", "khongDung",
                    "tonKem", "ma_nguon", "soDo"];
  const thieuTruong = M.filter((m) => BAT_BUOC.some((k) => !m[k]));
  kiem("du lieu · khong mau nao thieu truong bat buoc",
    thieuTruong.length === 0,
    thieuTruong.length ? thieuTruong.map((m) => m.ma).join(",") : BAT_BUOC.length + " truong");

  /* DAY LA DIEM RIENG cua trang nay: moi mau PHAI noi duoc khi nao DUNG dung. */
  kiem("du lieu · moi mau deu co it nhat 2 muc 'dung khi'",
    M.every((m) => m.dungKhi.length >= 2));
  kiem("du lieu · moi mau deu co it nhat 2 muc 'DUNG dung khi'",
    M.every((m) => m.khongDung.length >= 2),
    M.filter((m) => m.khongDung.length < 2).map((m) => m.ma).join(",") || "27/27");

  kiem("du lieu · nhom chi thuoc bon gia tri da biet",
    M.every((m) => ["khoi-tao", "cau-truc", "hanh-vi", "hien-dai"].indexOf(m.nhom) >= 0));

  /* Moi kieu so do duoc khai bao deu phai co ham ve that. */
  const thieuSoDo = [...new Set(M.map((m) => m.soDo))].filter((k) => !T.SO_DO[k]);
  kiem("du lieu · moi kieu so do duoc khai bao deu co ham ve",
    thieuSoDo.length === 0, thieuSoDo.join(",") || "du");

  /* Ma nguon la de doc, nen khong duoc dai qua. */
  const dai = M.filter((m) => m.ma_nguon.split("\n").length > 18);
  kiem("du lieu · vi du ma nguon deu duoi 18 dong",
    dai.length === 0, dai.map((m) => m.ma).join(",") || "27/27");
}

/* ====================== 2. boDau ====================== */
{
  kiem("boDau · bo dau tieng Viet", T.boDau("Chiến lược") === "chien luoc");
  kiem("boDau · d gach thanh d", T.boDau("Đừng dùng") === "dung dung");
  kiem("boDau · ha chu thuong", T.boDau("ABC") === "abc");
  kiem("boDau · chu khong dau giu nguyen", T.boDau("proxy") === "proxy");
  kiem("boDau · chuoi rong khong no", T.boDau("") === "");
}

/* ====================== 3. khop ====================== */
{
  const m = M.filter((x) => x.ma === "singleton")[0];

  kiem("khop · tim rong thi moi mau deu khop", T.khop(m, ""));
  kiem("khop · tim dung ten", T.khop(m, "Singleton"));
  kiem("khop · tim khong dau van ra", T.khop(m, "the duy nhat"));
  kiem("khop · tim theo ten tieng Viet co dau", T.khop(m, "Thể duy nhất"));
  /* Quen dau phu dinh o day mot lan roi: phep thu bao SAI trong khi code dung. */
  kiem("khop · khong khop thi tra false", T.khop(m, "khong-he-co-tu-nay") === false);

  /* Nhieu tu = phai co DU ca may tu, khong phai cum lien tiep. */
  kiem("khop · nhieu tu thi phai co du ca may tu", T.khop(m, "toan cuc test"));
  kiem("khop · thieu mot tu thi khong khop", !T.khop(m, "toan cuc caphe"));

  /* Tim duoc theo VAN DE dang gap, khong chi theo ten mau. */
  const coTest = M.filter((x) => T.khop(x, "test"));
  kiem("khop · tim 'test' ra duoc vai mau lien quan",
    coTest.length >= 2, coTest.map((x) => x.ma).join(","));

  const coHoanTac = M.filter((x) => T.khop(x, "hoan tac"));
  kiem("khop · tim 'hoan tac' ra Command va Memento",
    coHoanTac.some((x) => x.ma === "command") &&
    coHoanTac.some((x) => x.ma === "memento"),
    coHoanTac.map((x) => x.ma).join(","));
}

/* ====================== 4. toSang ====================== */
{
  kiem("toSang · khong co tu tim thi giu nguyen",
    T.toSang("Chiến lược", "") === "Chiến lược");
  kiem("toSang · to dung doan, GIU NGUYEN DAU cua ban goc",
    T.toSang("Chiến lược", "chien") === "<mark>Chiến</mark> lược",
    T.toSang("Chiến lược", "chien"));
  kiem("toSang · khong khop thi khong chen the nao",
    T.toSang("Proxy", "abc") === "Proxy");
  kiem("toSang · to duoc nhieu lan xuat hien",
    (T.toSang("proxy va proxy", "proxy").match(/<mark>/g) || []).length === 2);

  /* Bat bien quan trong: bo het the <mark> phai ra dung chuoi goc.
     Neu sai thi chu bi mat hoac nhan doi tren man hinh. */
  let giuNguyen = true;
  const thu = ["Chiến lược", "Đừng dùng khi", "Observer — bên quan sát", "abc xyz"];
  thu.forEach((c) => {
    ["chien", "dung", "quan sat", "b", ""].forEach((t) => {
      if (T.toSang(c, t).replace(/<\/?mark>/g, "") !== c) giuNguyen = false;
    });
  });
  kiem("toSang · bo the <mark> ra luon bang dung chuoi goc", giuNguyen);
}

/* ====================== 5. SVG ====================== */
{
  const cac = Object.keys(T.SO_DO);
  kiem("so do · co du cac kieu duoc dung", cac.length >= 10, cac.length + " kieu");

  let hopLe = true, loi = "";
  cac.forEach((k) => {
    const s = T.veSoDo(k);
    if (!/^<svg /.test(s) || !/<\/svg>$/.test(s)) { hopLe = false; loi = k + ": khong phai svg"; }
    /* The mo va the dong phai can nhau — SVG vo can thi trinh duyet bo qua im lang. */
    ["svg", "defs", "marker"].forEach((the) => {
      const mo = (s.match(new RegExp("<" + the + "[ >]", "g")) || []).length;
      const dong = (s.match(new RegExp("</" + the + ">", "g")) || []).length;
      if (mo !== dong) { hopLe = false; loi = k + ": the <" + the + "> khong can"; }
    });
  });
  kiem("so do · moi kieu sinh ra SVG can the", hopLe, loi || cac.length + "/" + cac.length);

  kiem("so do · kieu la thi lui ve kieu mac dinh chu khong no",
    /^<svg /.test(T.veSoDo("khong-he-co")));
}

/* ---------------------------------------------------------------- */
console.log("-".repeat(58));
if (hong) { console.log(hong + " muc SAI.\n"); process.exit(1); }
console.log("Dat — du lieu va ham cua design-pattern deu dung.\n");
