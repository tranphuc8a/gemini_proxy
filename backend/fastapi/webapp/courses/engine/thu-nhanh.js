/* =====================================================================
   thu-nhanh.js — chay THAT engine + cac lab cua mot trang, trong Node,
   tren mot ban DOM/canvas gia. Khong can trinh duyet, khong can cai them
   thu vien nao.

       node engine/thu-nhanh.js lab-visual

   Bat duoc: loi runtime, bien chua khai bao, lab nem ngoai le, bo phat
   khong ve, permalink khong ghi. KHONG bat duoc loi hinh hoc — canvas o
   day chi dem so lan goi, khong ve pixel that. Muon kiem tra hinh anh
   thi dung tang playwright trong kiem_demo.py.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const TRANG = process.argv[2] || "lab-visual";
const GOC = process.env.COURSES_DIR || path.resolve(__dirname, "..");
const TM = path.join(GOC, TRANG);

/* ---------------- DOM gia ---------------- */
let idRAF = 1;
const hangRAF = [];
const loiConsole = [];

function taoAnh(w, h) {
  w = Math.max(1, w | 0); h = Math.max(1, h | 0);
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

function taoCtx(cv) {
  const c = { _goi: 0, canvas: cv };
  /* Ham chi de dem so lan goi — canvas gia khong ve pixel that. */
  const ham = ["clearRect", "fillRect", "strokeRect", "beginPath", "moveTo", "lineTo",
    "stroke", "fill", "arc", "arcTo", "ellipse", "bezierCurveTo", "quadraticCurveTo",
    "closePath", "save", "restore", "scale", "translate", "rotate", "transform",
    "setTransform", "resetTransform", "fillText", "strokeText", "setLineDash",
    "getLineDash", "drawImage", "clip", "rect", "roundRect", "putImageData"];
  for (const h of ham) {
    c[h] = function () { c._goi++; return h === "getLineDash" ? [] : undefined; };
  }
  /* Nhung ham PHAI tra ve gia tri dung kieu — neu tra undefined thi lab
     se hong o day vi loi cua harness, khong phai loi cua lab. */
  c.measureText = (t) => { c._goi++; return { width: String(t || "").length * 6 }; };
  c.createImageData = (a, b) => {
    c._goi++;
    return (a && typeof a === "object") ? taoAnh(a.width, a.height) : taoAnh(a, b);
  };
  c.getImageData = (x, y, w, h) => { c._goi++; return taoAnh(w, h); };
  c.createLinearGradient = () => { c._goi++; return { addColorStop() {} }; };
  c.createRadialGradient = () => { c._goi++; return { addColorStop() {} }; };
  c.createPattern = () => { c._goi++; return null; };
  c.isPointInPath = () => false;
  return c;
}

function taoEl(tag) {
  tag = String(tag || "div").toLowerCase();
  const e = {
    tagName: tag.toUpperCase(),
    _tag: tag,
    children: [],
    _cha: null,
    _lop: new Set(),
    _attr: {},
    _sk: {},
    style: {},
    value: "",
    checked: false,
    _text: "",
    _html: "",
  };
  Object.defineProperty(e, "className", {
    get() { return [...e._lop].join(" "); },
    set(v) { e._lop = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  Object.defineProperty(e, "textContent", {
    get() { return e._text; }, set(v) { e._text = String(v); },
  });
  Object.defineProperty(e, "innerHTML", {
    get() { return e._html; },
    set(v) { e._html = String(v); if (v === "") e.children = []; },
  });
  e.classList = {
    add: (...c) => c.forEach((x) => e._lop.add(x)),
    remove: (...c) => c.forEach((x) => e._lop.delete(x)),
    contains: (c) => e._lop.has(c),
    toggle: (c, f) => {
      const co = f === undefined ? !e._lop.has(c) : !!f;
      co ? e._lop.add(c) : e._lop.delete(c);
      return co;
    },
  };
  e.setAttribute = (k, v) => { e._attr[k] = String(v); if (k === "class") e.className = v; };
  e.getAttribute = (k) => (k in e._attr ? e._attr[k] : null);
  e.removeAttribute = (k) => { delete e._attr[k]; };
  e.addEventListener = (t, f) => { (e._sk[t] = e._sk[t] || []).push(f); };
  e.removeEventListener = () => {};
  e.dispatchEvent = (ev) => (e._sk[ev.type] || []).forEach((f) => f.call(e, ev));
  e._ban = (t, extra) => (e._sk[t] || []).forEach((f) => f.call(e, Object.assign({ type: t, target: e, currentTarget: e, preventDefault() {} }, extra)));
  e.appendChild = (c) => { c._cha = e; e.children.push(c); return c; };
  e.insertBefore = (c, r) => { const i = e.children.indexOf(r); e.children.splice(i < 0 ? e.children.length : i, 0, c); c._cha = e; return c; };
  e.removeChild = (c) => { const i = e.children.indexOf(c); if (i >= 0) e.children.splice(i, 1); return c; };
  e.click = () => e._ban("click");
  e.select = () => {};
  e.focus = () => {};
  e.getBoundingClientRect = () => ({ left: 0, top: 0, width: e.clientWidth || 900, height: 560 });
  Object.defineProperty(e, "clientWidth", { get() { return e._rong === undefined ? 900 : e._rong; }, configurable: true });
  e.requestFullscreen = () => {};
  e.querySelector = (s) => timTrong(e, s);
  e.querySelectorAll = (s) => gomTrong(e, s);

  if (tag === "canvas") {
    e.width = 300; e.height = 150;
    e._ctx = taoCtx(e);
    e.getContext = () => e._ctx;
    e.toBlob = (cb) => cb({ size: 1 });
    e.captureStream = undefined;   /* gia lap trinh duyet khong ho tro ghi */
  }
  return e;
}

function hopKhop(e, s) {
  if (s.startsWith(".")) return e._lop.has(s.slice(1));
  if (s.startsWith("#")) return e._attr.id === s.slice(1);
  return e._tag === s.toLowerCase();
}
/* Chi ho tro bo chon don gian va chuoi hai cap "a b" — du cho engine. */
function timTrong(goc, s) {
  const phan = s.trim().split(/\s+/);
  const ds = gomTrong(goc, phan[0]);
  if (phan.length === 1) return ds[0] || null;
  for (const d of ds) { const r = timTrong(d, phan.slice(1).join(" ")); if (r) return r; }
  return null;
}
function gomTrong(goc, s) {
  const phan = s.trim().split(/\s+/);
  const ra = [];
  (function di(e) {
    for (const c of e.children) { if (hopKhop(c, phan[0])) ra.push(c); di(c); }
  })(goc);
  if (phan.length === 1) return ra;
  const sau = [];
  for (const d of ra) sau.push(...gomTrong(d, phan.slice(1).join(" ")));
  return sau;
}

const body = taoEl("body");
const goc = taoEl("html");
const document = {
  documentElement: goc,
  body,
  createElement: taoEl,
  createElementNS: (ns, t) => taoEl(t),
  createTextNode: (t) => ({ _tag: "#text", _text: t, children: [], classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, _lop: new Set(), _attr: {} }),
  querySelector: (s) => timTrong(body, s),
  querySelectorAll: (s) => gomTrong(body, s),
  addEventListener: () => {},
  activeElement: null,
  title: "",
  fullscreenElement: null,
  execCommand: () => true,
};

for (const id of ["nav", "main", "btnTheme", "btnMenu"]) {
  const e = taoEl(id === "nav" || id === "main" ? "div" : "button");
  e.setAttribute("id", id);
  body.appendChild(e);
}

const skWindow = {};
const window = {
  addEventListener: (t, f) => { (skWindow[t] = skWindow[t] || []).push(f); },
  removeEventListener: () => {},
  devicePixelRatio: 2,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  requestAnimationFrame: (f) => { hangRAF.push({ id: idRAF, f }); return idRAF++; },
  cancelAnimationFrame: (id) => { const i = hangRAF.findIndex((x) => x.id === id); if (i >= 0) hangRAF.splice(i, 1); },
  scrollTo: () => {},
  location: { hash: "", href: "file:///lab/index.html", protocol: "file:" },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  getComputedStyle: () => ({ getPropertyValue: (p) => (p === "--surf" ? "#ffffff" : "#123456") }),
  ResizeObserver: function (cb) { this.observe = () => cb(); this.disconnect = () => {}; },
  MediaRecorder: undefined,
  URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  Blob: function () {},
  history: { replaceState: (a, b, h) => { window.location.hash = h; } },
  console,
  prompt: () => {},
  navigator: { clipboard: null },
};
window.window = window;
window.document = document;

const ctx = vm.createContext(Object.assign(Object.create(null), {
  window, document, console: {
    log: console.log, warn: console.warn,
    error: (...a) => { loiConsole.push(a.map(String).join(" ")); },
  },
  requestAnimationFrame: window.requestAnimationFrame,
  cancelAnimationFrame: window.cancelAnimationFrame,
  getComputedStyle: window.getComputedStyle,
  ResizeObserver: window.ResizeObserver,
  location: window.location,
  localStorage: window.localStorage,
  history: window.history,
  navigator: window.navigator,
  URL: window.URL, Blob: window.Blob,
  setTimeout, clearTimeout, Math, Date, JSON, Object, Array, String, Number,
  Int32Array, Uint32Array, Uint8Array, Uint8ClampedArray, Float32Array, Float64Array,
  ImageData: function (w, h) { return taoAnh(w, h); }, isNaN, parseFloat, parseInt, Error,
  globalThis: null,
}));
ctx.globalThis = ctx;

/* Nap mot tep theo duong dan tuong doi so voi thu muc trang. */
function nap(rel) {
  const p = path.join(TM, rel.replace(/\//g, path.sep));
  vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: rel });
  /* Trong trinh duyet `window.x = ...` tao luon bien toan cuc. vm thi khong,
     nen phai cheo sang tay sau moi lan nap. */
  for (const k of ["VIS", "demo", "lab"]) {
    if (ctx.window[k] !== undefined) ctx[k] = ctx.window[k];
  }
}

function bomKhung(n) {
  for (let i = 0; i < n; i++) {
    const dot = hangRAF.splice(0, hangRAF.length);
    for (const k of dot) k.f(i * 16.7);
  }
}

function moLab(id) {
  window.location.hash = "#/" + id;
  (skWindow.hashchange || []).forEach((f) => f());
  bomKhung(5);
}

function nutChayCua(main) {
  /* Bam vao CLASS chu khong phai chu tren nut: lab dat `tuTin: true` se tu
     chay ngay, va luc do nut ghi "Tam dung" chu khong phai "Chay". */
  const theoLop = gomTrong(main, ".chinh").find((b) => b._tag === "button");
  if (theoLop) return theoLop;
  return gomTrong(main, "button").find((b) => /Chạy/.test(b._text));
}

/** Dam bao bo phat DANG CHAY, khong phai chi bam nut mot cai.
    Engine gan class `dang` len nut khi dang chay; lab `tuTin: true` da chay
    san, nen bam them mot cai la tam dung — va phep thu se ket luan nguoc. */
function batDauChay(main) {
  const nut = nutChayCua(main);
  if (!nut) return null;
  if (!nut._lop.has("dang")) nut._ban("click");
  return nut;
}

/** Gom toan bo chu trong mot nhanh DOM (ke ca nut van ban). */
function chuTrong(e) {
  let s = e._text || "";
  for (const c of e.children || []) s += " " + chuTrong(c);
  return s;
}

/** Thanh tua cua bo phat.
    KHONG duoc lay `input[type=range]` cuoi cung trong #main: thu tu that la
    [tua] [toc do] roi moi den cac slider THAM SO, nen cai cuoi cung la tham so.
    Nhan dien bang nhan cua no moi dung. */
function thanhTua(main) {
  for (const lab of gomTrong(main, "label")) {
    if (/Tua tới bước/.test(chuTrong(lab))) {
      return gomTrong(lab, "input").find((i) => i._attr.type === "range") || null;
    }
  }
  return null;
}

/** Chu trong bang so lieu — de soi NaN / Infinity / undefined. */
function soLieuCua(main) {
  const hop = timTrong(main, ".so-lieu");
  return hop ? chuTrong(hop) : "";
}


/** Nap dung nhung tep index.html khai bao, dung thu tu do, roi khoi dong
    engine. Khong doan ten tep: moi trang dat ten lab mot kieu. */
function napTheoIndex() {
  const html = fs.readFileSync(path.join(TM, "index.html"), "utf8");
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((m) => m[1]).filter((x) => !/^https?:/i.test(x));
  for (const x of srcs) nap(x);
  return srcs;
}

/** Khoi dong engine roi tra ve danh sach ma lab doc tu muc luc. */
function khoiDong() {
  (skWindow.DOMContentLoaded || []).forEach((f) => f());
  bomKhung(3);
  return gomTrong(document.querySelector("#nav"), ".nav-i")
    .map((a) => a.getAttribute("data-id")).filter(Boolean);
}

/* ------------------------------------------------------------------
   Dung lam THU VIEN: `require(".../thu-nhanh.js")` tra ve bo DOM gia va
   cac tien ich ma khong chay test (kiem-so.js dung duong nay). Chay truc
   tiep `node thu-nhanh.js <trang>` thi phan duoi moi thuc thi.
   Trong CommonJS, `return` o cap module la hop le.
   ------------------------------------------------------------------ */
module.exports = {
  document, window, skWindow, ctx, TM, loiConsole,
  nap, napTheoIndex, khoiDong, bomKhung, timTrong, gomTrong,
  moLab, nutChayCua, batDauChay, chuTrong, thanhTua, soLieuCua
};
if (require.main !== module) return;

/* ---------------- Chay ---------------- */
const loi = [];
function kiem(ten, f) {
  loiConsole.length = 0;              /* moi muc kiem tra bat dau sach */
  try { f(); console.log("  [ok]   " + ten); }
  catch (e) { loi.push(ten); console.log("  [LOI]  " + ten + " — " + e.message); }
}

console.log("\nChay thu " + TRANG + " bang DOM gia (Node)\n" + "-".repeat(58));

const srcs = napTheoIndex();
if (!srcs.length) {
  console.error("  [LOI]  index.html khong nap tep script cuc bo nao");
  process.exit(1);
}

kiem("engine gan window.VIS voi day du API loi", () => {
  const V = ctx.window.VIS;
  if (!V) throw new Error("khong co window.VIS");
  for (const k of ["el", "truot", "nut", "chon", "danhDau", "veBang", "veLuoi",
                   "mau", "thangMau", "rng", "vongLap", "phat", "dungHet", "khung"]) {
    if (!V[k]) throw new Error("thieu V." + k);
  }
});

let dsLab = [];
kiem("DOMContentLoaded dung muc luc + trang chu", () => {
  dsLab = khoiDong();
  if (!dsLab.length) throw new Error("muc luc rong — khong lab nao dang ky duoc");
  if (!timTrong(document.querySelector("#main"), ".hero")) throw new Error("trang chu khong ve");
});





console.log("  ---- " + dsLab.length + " lab ----");

for (const id of dsLab) {
  kiem("lab '" + id + "' dung va ve duoc", () => {
    moLab(id);
    const main = document.querySelector("#main");
    const oLoi = timTrong(main, ".loi");
    if (oLoi) throw new Error("lab nem ngoai le: " + oLoi._text);
    if (!timTrong(main, ".demo-body")) throw new Error("khong dung duoc bo cuc .demo-body");

    const cv = timTrong(main, "canvas");
    const truoc = cv ? cv._ctx._goi : 0;
    const nc = batDauChay(main);
    if (nc) { bomKhung(20); } else { bomKhung(4); }

    if (cv) {
      if (nc && cv._ctx._goi <= truoc) throw new Error("bam Chay nhung canvas khong ve them gi");
      if (!nc && cv._ctx._goi === 0) throw new Error("canvas chua he duoc ve");
    }
    if (loiConsole.length) throw new Error("console.error: " + loiConsole[0]);
  });
}

/* Doi qua moi lua chon cua o chon dau tien — bat duoc nhanh code chi chay
   o mot che do. */
for (const id of dsLab) {
  const main = document.querySelector("#main");
  moLab(id);
  const sel = timTrong(document.querySelector("#main"), "select");
  if (!sel || !sel.children.length || sel.children.length > 8) continue;
  const muc = sel.children.map((o) => o._attr.value).filter((v) => v !== undefined);
  if (muc.length < 2) continue;
  kiem("lab '" + id + "': " + muc.length + " lua chon cua o chon dau", () => {
    for (const v of muc) {
      sel.value = v;
      sel._ban("change");
      bomKhung(8);
      if (loiConsole.length) throw new Error("lua chon '" + v + "' → " + loiConsole[0]);
    }
  });
}

for (const id of dsLab) {
  kiem("lab '" + id + "': chay het, so lieu sach", () => {
    moLab(id);
    const main = document.querySelector("#main");
    const t = thanhTua(main);

    if (t) {
      /* Tua toi cuoi chay TOAN BO cac buoc mot mach — day la luc cong thuc
         hong hien ra thanh NaN, chu khong phai o vai khung dau. */
      t.value = String(t._attr.max);
      t._ban("input");
      bomKhung(3);
      if (loiConsole.length) throw new Error("console.error khi tua: " + loiConsole[0]);
    } else {
      /* Lab tinh, khong co bo phat — chay bang khung hinh. Day la truong
         hop hop le, khong phai loi. */
      batDauChay(main);
      bomKhung(120);
      if (loiConsole.length) throw new Error("console.error khi chay: " + loiConsole[0]);
    }

    /* Bang so lieu la tuy chon, nhung co thi khong duoc chua NaN. */
    const so = soLieuCua(main);
    if (so.trim()) {
      const xau = so.match(/\bNaN\b|\bInfinity\b|\bundefined\b/);
      if (xau) throw new Error("so lieu co '" + xau[0] + "': " + so.trim().slice(0, 150));
    }

    if (t) {
      /* Tua ve giua roi ve 0 — phuc hoi trang thai phai khong nem loi. */
      t.value = String(Math.floor(Number(t._attr.max) / 2));
      t._ban("input");
      bomKhung(2);
      t.value = "0";
      t._ban("input");
      bomKhung(2);
      if (loiConsole.length) throw new Error("tua nguoc: " + loiConsole[0]);
    }
  });
}

if (ctx.window.VIS && ctx.window.VIS.thamSo) {
  kiem("permalink ghi tham so vao URL", () => {
    const id = dsLab.find((x) => { moLab(x); return !!timTrong(document.querySelector("#main"), ".ts"); });
    if (!id) throw new Error("khong lab nao dung V.thamSo");
    const sel = timTrong(document.querySelector("#main"), "select");
    if (!sel || sel.children.length < 2) throw new Error("lab '" + id + "' khong co o chon de thu");
    const khac = sel.children.map((o) => o._attr.value).find((v) => v !== sel.value);
    sel.value = khac; sel._ban("change");
    bomKhung(2);
    if (!window.location.hash.includes("=")) {
      throw new Error("hash khong mang tham so: " + window.location.hash);
    }
  });
} else {
  console.log("  [bo qua] engine nay chua co V.thamSo — khong kiem tra permalink");
}

console.log("-".repeat(58));
if (loi.length) { console.log(loi.length + " muc that bai.\n"); process.exit(1); }
console.log("Dat — moi lab chay sach trong DOM gia.\n");
