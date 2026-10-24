/* kiem/chay-nen.js — assets/chay-nen.js: ma Worker ghep tu JE_NGUON chay duoc trong mot vm RONG (gia lap Worker that),
   chay() qua Worker gia: ket qua dung, loi du lieu / schema, het gio -> terminate, lenh moi huy lenh cu, ket qua cu bi bo,
   khong co Worker / Worker hong -> luong chinh. (Worker that + ReDoS that: check.py --chuc-nang.) */
"use strict";
const vm = require("vm");

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang;
  const MT = C.taoMoiTruong();
  const CN = MT.JE && MT.JE.chayNen;
  if (!kiem("chay-nen · nap xong, co JE.chayNen (chay, taoMa, xuLy, cauHinh)", !!CN && typeof CN.chay === "function" && typeof CN.taoMa === "function")) return;
  const ds = C.dsScript();
  kiem("index.html · chay-nen.js nap sau schema-kiem.js, truoc json-editor.js", ds.indexOf("assets/chay-nen.js") > ds.indexOf("assets/schema-kiem.js") && ds.indexOf("assets/chay-nen.js") < ds.indexOf("assets/json-editor.js"), ds.join(", "));

  const SCHEMA = JSON.stringify({ type: "object", required: ["id"], properties: { id: { type: "integer" }, email: { type: "string", format: "email" } } });
  const DU_SAI = JSON.stringify({ id: "x", email: "abc" });
  const DU_DUNG = JSON.stringify({ id: 1, email: "a@b.co" });

  /* ---- ma Worker chay trong mot vm RONG ---- */
  const ma = CN.taoMa();
  kiem("chay-nen · taoMa ghep moi module thuan theo JE_NGUON (je-chung, tom-tat, vi-tri, schema-format, schema-kiem) + vong nhan tin",
    ["JE.chung =", "JE.tomTat =", "JE.viTri =", "JE.schemaFormat =", "JE.schema =", "self.onmessage =", "self.__xuLy ="].every((s) => ma.indexOf(s) >= 0) && ma.indexOf("JE.chayNen") < 0, ma.length + " byte");
  const guiDen = [];
  const sandbox = { console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date, Map, Set, WeakMap, Uint32Array, Int32Array, Uint8Array, RangeError };
  sandbox.self = sandbox;
  sandbox.postMessage = (d) => guiDen.push(d);
  vm.createContext(sandbox);
  let loiNap = null;
  try { vm.runInContext(ma, sandbox); } catch (e) { loiNap = e.message; }
  kiem("chay-nen · ma Worker nap duoc trong ngu canh trong (khong DOM, khong window): co self.JE.schema.kiem", !loiNap && typeof sandbox.JE.schema.kiem === "function", loiNap);
  sandbox.onmessage({ data: { id: 7, loai: "kiem", du: DU_SAI, schema: SCHEMA, tuyChon: { format: "loi" } } });
  const tl = guiDen.pop();
  const truc = MT.JE.schema.kiem(JSON.parse(DU_SAI), JSON.parse(SCHEMA), { format: "loi" });
  kiem("chay-nen · vong nhan tin: tra {id, kq} giong het kiem truc tiep (hopLe, so loi, conTro), co thoiGianMs",
    tl && tl.id === 7 && tl.kq && tl.kq.hopLe === false && tl.kq.loi.length === truc.loi.length && bang(tl.kq.loi.map((e) => e.conTro), truc.loi.map((e) => e.conTro)) && typeof tl.kq.thoiGianMs === "number",
    JSON.stringify(tl && tl.kq && tl.kq.loi.map((e) => e.conTro)));
  sandbox.onmessage({ data: { id: 8, loai: "kiem", du: "{bad", schema: SCHEMA } });
  const t2 = guiDen.pop();
  kiem("chay-nen · du lieu JSON hong -> {loi:{phan:'du'}}", t2.id === 8 && t2.loi && t2.loi.phan === "du" && t2.loi.thongBao.length > 3);
  sandbox.onmessage({ data: { id: 9, loai: "kiem", du: DU_DUNG, schema: "{bad" } });
  const t3 = guiDen.pop();
  kiem("chay-nen · schema JSON hong -> {loi:{phan:'schema'}}", t3.id === 9 && t3.loi && t3.loi.phan === "schema");
  sandbox.onmessage({ data: { id: 10, loai: "lint", schema: JSON.stringify({ requried: ["a"], type: "strin" }) } });
  const t4 = guiDen.pop();
  kiem("chay-nen · lenh lint: chi bienDich -> loiSchema / canhBaoSchema / draft", t4.kq && t4.kq.loiSchema.length === 1 && t4.kq.canhBaoSchema.length === 1 && t4.kq.draft === "2020-12");
  sandbox.onmessage({ data: { id: 11, loai: "bay" } });
  const t5 = guiDen.pop();
  kiem("chay-nen · lenh la -> loi he thong, khong nem", t5.loi && t5.loi.phan === "he-thong");
  kiem("chay-nen · ket qua gui di la JSON thuan (structured clone / postMessage an toan)", (function () { try { return JSON.stringify(tl.kq).length > 10; } catch (e) { return false; } })());

  /* ---- Worker gia (chay ma that trong vm, bat dong bo) ---- */
  const nguon = new Map();
  let soUrl = 0;
  const dsWorker = [];
  function taoWorkerGia(chedo) {
    return class WorkerGia {
      constructor(url) {
        if (chedo.nem) throw new Error("khong tao duoc Worker (gia lap)");
        this.dong = false; this.treo = !!chedo.treo; this.onmessage = null; this.onerror = null;
        const sb = { console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date, Map, Set, WeakMap, Uint32Array, Int32Array, Uint8Array, RangeError };
        sb.self = sb;
        sb.postMessage = (d) => setImmediate(() => { if (!this.dong && this.onmessage) this.onmessage({ data: JSON.parse(JSON.stringify(d)) }); });
        vm.createContext(sb);
        this.sb = sb;
        vm.runInContext(nguon.get(url), sb);
        dsWorker.push(this);
        if (chedo.loiNap) setImmediate(() => this.onerror && this.onerror({ message: "Uncaught SyntaxError (gia lap)" }));
      }
      postMessage(d) {
        if (this.treo) return;
        /* chedo.loiTu = N: tu lenh thu N+1 (tinh chung moi Worker) Worker bao loi LUC DANG CHAY (vd het bo nho), khong tra loi. */
        if (chedo.loiTu !== undefined && (chedo.soLenh = (chedo.soLenh || 0) + 1) > chedo.loiTu) {
          setImmediate(() => { if (!this.dong && this.onerror) this.onerror({ message: "het bo nho luc dang chay (gia lap)" }); });
          return;
        }
        setImmediate(() => { if (!this.dong) this.sb.onmessage({ data: JSON.parse(JSON.stringify(d)) }); });
      }
      terminate() { this.dong = true; }
    };
  }
  class BlobGia { constructor(parts) { this.parts = parts; } }
  const URLGia = { createObjectURL(b) { const id = "blob:gia/" + (++soUrl); nguon.set(id, b.parts.join("")); return id; }, revokeObjectURL() {} };
  function moiTruong(chedo) {
    CN.datLai();
    dsWorker.length = 0;
    MT.ctx.Worker = chedo === null ? undefined : taoWorkerGia(chedo || {});
    MT.ctx.Blob = BlobGia; MT.ctx.URL = URLGia;
    MT.ctx.setTimeout = setTimeout; MT.ctx.clearTimeout = clearTimeout;
  }
  const doi = (ms) => new Promise((r) => setTimeout(r, ms));

  return (async () => {
    moiTruong({});
    kiem("chay-nen · coWorker() true khi co Worker + Blob + URL", CN.coWorker() === true);
    let r = await CN.chay("kiem", { du: DU_SAI, schema: SCHEMA }, { format: "loi" });
    kiem("chay-nen · chay() qua Worker: kq.hopLe false, 2 loi (id, email), khong danh dau luongChinh",
      r.kq && r.kq.hopLe === false && r.kq.loi.length === 2 && !r.luongChinh && CN.thongKe.soWorker === 1 && CN.thongKe.soLuongChinh === 0, JSON.stringify(r).slice(0, 200));
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});
    kiem("chay-nen · du lieu dung -> hopLe true; Worker duoc TAI SU DUNG (chi tao 1 Worker cho 2 lenh)", r.kq && r.kq.hopLe === true && dsWorker.length === 1 && CN.thongKe.soWorker === 2);
    r = await CN.chay("kiem", { du: "{bad", schema: SCHEMA }, {});
    kiem("chay-nen · chay() du lieu hong -> {loi:{phan:'du'}}", r.loi && r.loi.phan === "du" && !r.kq);
    r = await CN.chay("kiem", { du: DU_DUNG, schema: "[" }, {});
    kiem("chay-nen · chay() schema hong -> {loi:{phan:'schema'}}", r.loi && r.loi.phan === "schema");
    r = await CN.chay("lint", { schema: JSON.stringify({ pattern: "(" }) }, {});
    kiem("chay-nen · chay('lint') -> loiSchema co loi pattern", r.kq && r.kq.loiSchema.length === 1);

    /* het gio */
    moiTruong({ treo: true });
    let t0 = Date.now();
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 60);
    kiem("chay-nen · Worker treo -> het han gio: {hetGio:true, hanMs:60}, terminate() da goi, thongKe.soHetGio = 1",
      r.hetGio === true && r.hanMs === 60 && dsWorker[0].dong === true && CN.thongKe.soHetGio === 1 && Date.now() - t0 < 1500, JSON.stringify(r));
    CN.cauHinh.han = 50;
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});
    kiem("chay-nen · han mac dinh doc tu cauHinh.han (test hep lai duoc)", r.hetGio === true && r.hanMs === 50);
    CN.cauHinh.han = 8000;
    /* sau khi het gio, lenh ke tiep tao Worker MOI */
    moiTruong({});
    await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});
    CN.dung();
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});
    kiem("chay-nen · dung() roi chay lai -> Worker moi, van chay", r.kq && r.kq.hopLe === true && dsWorker.length === 2);

    /* lenh moi huy lenh cu */
    const cd = { treo: true };
    CN.datLai();
    dsWorker.length = 0;
    MT.ctx.Worker = taoWorkerGia(cd);
    const A = CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 5000);
    cd.treo = false;
    const B = CN.chay("kiem", { du: DU_SAI, schema: SCHEMA }, {}, 5000);
    const [ra, rb] = await Promise.all([A, B]);
    kiem("chay-nen · lenh moi toi khi lenh cu dang chay: lenh cu {huy:true}, Worker cu bi terminate, lenh moi van ra ket qua",
      ra.huy === true && rb.kq && rb.kq.hopLe === false && CN.thongKe.soHuy === 1, JSON.stringify([ra, rb && rb.kq && rb.kq.hopLe]));

    /* ket qua cu khong vo nham lenh moi */
    moiTruong({});
    const p1 = CN.chay("kiem", { du: DU_SAI, schema: SCHEMA }, {});
    const r1 = await p1;
    const p2 = CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});
    const r2 = await p2;
    kiem("chay-nen · hai lenh lien tiep cho ra dung ket qua cua tung lenh (khong lech id)", r1.kq.hopLe === false && r2.kq.hopLe === true);

    /* khong co Worker -> luong chinh */
    moiTruong(null);
    kiem("chay-nen · coWorker() false khi khong co Worker", CN.coWorker() === false);
    r = await CN.chay("kiem", { du: DU_SAI, schema: SCHEMA }, { format: "loi" });
    kiem("chay-nen · khong co Worker: chay tren luong chinh, danh dau luongChinh, ket qua dung", r.luongChinh === true && r.kq && r.kq.loi.length === 2 && CN.thongKe.soLuongChinh === 1);
    const lon = JSON.stringify(new Array(120000).fill("xxxxxxxxxx"));
    r = await CN.chay("kiem", { du: lon, schema: "{}" }, {});
    kiem("chay-nen · khong co Worker + du lieu > nganLuongChinh -> tu choi voi thong bao ro, khong treo", r.luongChinh === true && r.loi && /không có Worker/.test(r.loi.thongBao) && !r.kq);

    /* tao Worker nem loi -> luong chinh + nho co hong */
    moiTruong({ nem: true });
    r = await CN.chay("kiem", { du: DU_SAI, schema: SCHEMA }, { format: "loi" });
    kiem("chay-nen · tao Worker that bai (CSP / file://…): roi ve luong chinh, ghi lyDoLuongChinh, coWorker() false tu do",
      r.luongChinh === true && r.kq && r.kq.loi.length === 2 && /gia lap/.test(CN.thongKe.lyDoLuongChinh) && CN.coWorker() === false);

    /* Worker bao loi khi nap */
    moiTruong({ loiNap: true, treo: true });
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 3000);
    kiem("chay-nen · Worker bao loi script: tra {loi.he-thong, workerHong}, ghi co hong; lenh sau chay luong chinh",
      r.loi && r.loi.phan === "he-thong" && r.workerHong === true && CN.coWorker() === false);
    r = await CN.chay("kiem", { du: DU_SAI, schema: SCHEMA }, { format: "loi" });
    kiem("chay-nen · sau khi Worker hong, lenh ke tiep chay luong chinh", r.luongChinh === true && r.kq && r.kq.hopLe === false);

    /* Loi LUC DANG CHAY sau khi Worker da tra loi it nhat mot lan (het bo nho voi du lieu rat lon…): KHONG danh dau hong vinh vien —
       chi bo Worker nay, lenh sau tao Worker moi. Chi sau nhieu loi LIEN TIEP (cauHinh.soLoiToiDa) moi roi ve luong chinh. */
    moiTruong({ loiTu: 1 });
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});
    kiem("chay-nen · loi luc chay: lenh dau van ra ket qua binh thuong", r.kq && r.kq.hopLe === true && !r.workerHong);
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 3000);
    kiem("chay-nen · Worker bao loi SAU khi da tra loi duoc: lenh do nhan loi he thong, KHONG dat co hong (coWorker() van true), Worker bi bo",
      r.loi && r.loi.phan === "he-thong" && r.workerHong === false && CN.coWorker() === true && !CN.thongKe.lyDoLuongChinh, JSON.stringify(r));
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 3000);
    kiem("chay-nen · lenh ke tiep van tao Worker MOI (khong ve luong chinh), loi lan 2 van chua hong",
      dsWorker.length === 2 && r.loi && r.workerHong === false && CN.coWorker() === true && !r.luongChinh, dsWorker.length + " Worker; " + JSON.stringify(r));
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 3000);
    kiem("chay-nen · loi LIEN TIEP lan thu soLoiToiDa (3) -> danh dau hong, ghi ly do",
      r.loi && r.workerHong === true && CN.coWorker() === false && /het bo nho/.test(CN.thongKe.lyDoLuongChinh), JSON.stringify(r));
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});
    kiem("chay-nen · sau do chay luong chinh", r.luongChinh === true && r.kq && r.kq.hopLe === true);
    moiTruong({});
    await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});                       /* da tra loi duoc -> daTraLoi */
    const dungWorker = (cd) => { MT.ctx.Worker = taoWorkerGia(cd); CN.dung(); };
    dungWorker({ loiTu: 0 });
    await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 3000);                  /* loi lien tiep 1 */
    dungWorker({});
    r = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {});                    /* tra loi thanh cong -> dem ve 0 */
    dungWorker({ loiTu: 0 });
    await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 3000);                  /* 1 */
    CN.dung();
    const r3 = await CN.chay("kiem", { du: DU_DUNG, schema: SCHEMA }, {}, 3000);       /* 2 (tong 3 neu khong dat lai) */
    kiem("chay-nen · tra loi thanh cong dat lai bo dem loi lien tiep: loi roi rac (1 + 2) khong cong don thanh hong",
      r.kq && r3.loi && r3.workerHong === false && CN.coWorker() === true, JSON.stringify(r3));

    CN.datLai();
    await doi(1);
  })();
};
