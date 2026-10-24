/* =====================================================================
   chay-nen.js — chay viec nang (kiem JSON Schema…) trong WORKER dung tu
   Blob, co han gio. Nap SAU cac module thuan (JE_NGUON da day), TRUOC
   json-editor.js. Khong cham DOM.

   Vi sao Worker: `pattern` do nguoi dung viet co the quay lui tham hoa
   (ReDoS, vd (a+)+$ tren chuoi dai) — chay tren luong chinh thi treo ca
   trang. Trong Worker thi het han gio ta terminate() va bao "kiem qua lau".

   Worker KHONG fetch tep (bi chan o file://): ma cua no la chinh cac ham
   `khai` cua module thuan (JE_NGUON), ghep "(" + khai + ")(self);" thanh
   mot Blob. Moi lenh gui di la VAN BAN (Worker tu JSON.parse) de khong
   chep cau truc lon hai lan.

   API (JE.chayNen):
     chay(loai, {du, schema}, tuyChon, hanMs) -> Promise<{
         kq?, loi?:{phan:"du"|"schema"|"he-thong", thongBao}, hetGio?, hanMs?, huy?, luongChinh? }>
        loai: "kiem" (bienDich + kiem) | "lint" (chi bienDich) | "sinh" (sinh du lieu mau theo schema: tuyChon = tuy chon cua schemaSinh.sinhMau)
              | "suy" (suy schema tu du lieu: {du} khong can schema; tuyChon = tuy chon cua schemaSuy.suySchema)
        Lenh moi toi khi lenh cu dang chay: lenh cu bi huy ({huy:true}) va Worker bi terminate.
     cauHinh {han, nganLuongChinh, soLoiToiDa}, thongKe {soWorker, soLuongChinh, soHetGio, soHuy}
     coWorker(), dung(), taoMa(), xuLy(JE, tin)   (cho kiem thu)
   Khong co Worker (hoac tao that bai): chay tren luong chinh khi van ban <= nganLuongChinh,
   kem co `luongChinh: true` — giao dien nho nguoi dung ve rui ro treo.
   ===================================================================== */
(function () {
  "use strict";
  var g = typeof globalThis !== "undefined" ? globalThis : window;
  var JE = g.JE;
  if (!JE || !JE.schema) throw new Error("chay-nen.js cần schema-kiem.js nạp trước");

  var cauHinh = { han: 8000, nganLuongChinh: 1024 * 1024, soLoiToiDa: 3 };
  var thongKe = { soWorker: 0, soLuongChinh: 0, soHetGio: 0, soHuy: 0, lyDoLuongChinh: "" };
  var tt = { worker: null, url: null, seq: 0, cho: null, hong: false, daTraLoi: false, loiLienTiep: 0 };

  /** Xu ly mot lenh — TU CHUA (khong dung bien ngoai): duoc nhung vao Worker bang toString(). */
  function xuLy(JEg, tin) {
    var dongHo = function () { return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now(); };
    var t0 = dongHo(), du, sc;
    if (tin.loai === "ping") return { kq: { ok: true } };
    if (tin.loai !== "kiem" && tin.loai !== "lint" && tin.loai !== "sinh" && tin.loai !== "suy") return { loi: { phan: "he-thong", thongBao: "Lệnh nền lạ: " + tin.loai } };
    if (tin.loai === "suy") {                               /* suy schema tu DU LIEU (khong can schema) */
      try { du = JSON.parse(tin.du); }
      catch (e0) { return { loi: { phan: "du", thongBao: String(e0 && e0.message || e0) } }; }
      try {
        var ss = JEg.schemaSuy.suySchema(du, tin.tuyChon || {});
        return { kq: { schema: ss, thoiGianMs: Math.round((dongHo() - t0) * 10) / 10 } };
      } catch (e4) { return { loi: { phan: "he-thong", thongBao: String(e4 && e4.message || e4) } }; }
    }
    try { sc = JSON.parse(tin.schema); }
    catch (e) { return { loi: { phan: "schema", thongBao: String(e && e.message || e) } }; }
    try {
      if (tin.loai === "sinh") {                            /* sinh du lieu mau theo schema (co seed) */
        var sk = JEg.schemaSinh.sinhMau(sc, tin.tuyChon || {});
        sk.thoiGianMs = Math.round((dongHo() - t0) * 10) / 10;
        return { kq: sk };
      }
      var bd = JEg.schema.bienDich(sc, tin.tuyChon || {}), kq;
      if (tin.loai === "lint") {
        kq = { loiSchema: bd.loiSchema, canhBaoSchema: bd.canhBao, draft: bd.draft, hopLe: true, loi: [], canhBao: [], catBot: false };
      } else {
        try { du = JSON.parse(tin.du); }
        catch (e2) { return { loi: { phan: "du", thongBao: String(e2 && e2.message || e2) } }; }
        kq = JEg.schema.kiem(du, bd, tin.tuyChon || {});
      }
      kq.thoiGianMs = Math.round((dongHo() - t0) * 10) / 10;
      return { kq: kq };
    } catch (e3) {
      return { loi: { phan: "he-thong", thongBao: String(e3 && e3.message || e3) } };
    }
  }

  function vongNhan(e) {
    var m = e.data, r = self.__xuLy(self.JE, m);
    r.id = m.id;
    self.postMessage(r);
  }

  /** Ma nguon cua Worker: moi module thuan theo thu tu nap + xuLy + vong nhan tin. */
  function taoMa() {
    var khoi = (g.JE_NGUON || []).map(function (f) { return "(" + f.toString() + ")(self);"; }).join("\n");
    return khoi + "\nself.__xuLy = " + xuLy.toString() + ";\nself.onmessage = " + vongNhan.toString() + ";\n";
  }

  function coWorker() {
    return !tt.hong && typeof Worker === "function" && typeof Blob === "function" && typeof URL !== "undefined" && !!URL.createObjectURL;
  }

  function dung() {
    if (tt.worker) { try { tt.worker.terminate(); } catch (e) { /* da dong */ } tt.worker = null; }
    if (tt.url) { try { URL.revokeObjectURL(tt.url); } catch (e) { /* bo qua */ } tt.url = null; }
  }

  function khiNhan(e) {
    var r = e && e.data, c = tt.cho;
    if (r && typeof r.id === "number") { tt.daTraLoi = true; tt.loiLienTiep = 0; }     /* Worker song va tra loi duoc */
    if (!c || !r || r.id !== c.id) return;               /* ket qua cu (lenh da bi thay) */
    clearTimeout(c.hen);
    tt.cho = null;
    c.xong(r.loi ? { loi: r.loi } : { kq: r.kq });
  }

  function khiLoiWorker(e) {
    /* Hai loai loi:
       - Worker KHONG BAO GIO tra loi duoc (mot module nem loi khi nap / bi chan): hong han -> luong chinh tu lan sau.
       - Loi LUC DANG CHAY sau khi Worker da tra loi it nhat mot lan (het bo nho voi du lieu rat lon…): chi bo Worker nay,
         lan sau tao Worker MOI. Chi sau cauHinh.soLoiToiDa loi LIEN TIEP (khong lan nao thanh cong xen giua) moi coi la hong han
         — truoc day mot loi luc chay lam moi lan kiem sau chay tren luong chinh (khong chong duoc ReDoS) cho toi khi tai lai trang. */
    var c = tt.cho, chu = String(e && e.message || "Worker báo lỗi");
    tt.loiLienTiep++;
    var hanHong = !tt.daTraLoi || tt.loiLienTiep >= cauHinh.soLoiToiDa;
    if (hanHong) { thongKe.lyDoLuongChinh = chu; tt.hong = true; }
    dung();
    if (c) {
      clearTimeout(c.hen); tt.cho = null;
      c.xong({ loi: { phan: "he-thong", thongBao: "Không chạy được trong Worker: " + chu + (hanHong ? "" : " — thử lại sẽ dùng Worker mới") }, luongChinh: false, workerHong: hanHong });
    }
  }

  function khoiTao() {
    if (tt.worker) return tt.worker;
    var blob = new Blob([taoMa()], { type: "text/javascript" });
    tt.url = URL.createObjectURL(blob);
    var w = new Worker(tt.url);
    w.onmessage = khiNhan;
    w.onerror = khiLoiWorker;
    tt.worker = w;
    return w;
  }

  function doDai(du) { return (du && du.du ? du.du.length : 0) + (du && du.schema ? du.schema.length : 0); }

  function chayLuongChinh(loai, du, tuyChon) {
    var tin = { loai: loai, du: du.du, schema: du.schema, tuyChon: tuyChon };
    if (doDai(du) > cauHinh.nganLuongChinh) {
      return { loi: { phan: "he-thong", thongBao: "Trình duyệt không có Worker — dữ liệu lớn hơn " + Math.round(cauHinh.nganLuongChinh / 1024) + " KB không kiểm trên luồng chính được" }, luongChinh: true };
    }
    var r = xuLy(JE, tin);
    thongKe.soLuongChinh++;
    r.luongChinh = true;
    return r;
  }

  function chay(loai, du, tuyChon, hanMs) {
    var han = hanMs > 0 ? hanMs : cauHinh.han;
    return new Promise(function (xong) {
      if (tt.cho) {                                       /* lenh moi: bo lenh dang chay (co the dang ket ReDoS) */
        var cu = tt.cho;
        clearTimeout(cu.hen);
        tt.cho = null;
        thongKe.soHuy++;
        dung();
        cu.xong({ huy: true });
      }
      if (!coWorker()) { xong(chayLuongChinh(loai, du, tuyChon)); return; }
      var w;
      try { w = khoiTao(); }
      catch (e) {
        tt.hong = true; thongKe.lyDoLuongChinh = String(e && e.message || e);
        dung();
        xong(chayLuongChinh(loai, du, tuyChon));
        return;
      }
      var id = ++tt.seq;
      var c = { id: id, xong: xong, hen: null };
      c.hen = setTimeout(function () {
        if (tt.cho !== c) return;
        tt.cho = null;
        thongKe.soHetGio++;
        dung();
        xong({ hetGio: true, hanMs: han });
      }, han);
      tt.cho = c;
      thongKe.soWorker++;
      try { w.postMessage({ id: id, loai: loai, du: du.du, schema: du.schema, tuyChon: tuyChon || {} }); }
      catch (e2) {
        clearTimeout(c.hen); tt.cho = null; dung();
        xong({ loi: { phan: "he-thong", thongBao: "Không gửi được lệnh sang Worker: " + String(e2 && e2.message || e2) } });
      }
    });
  }

  JE.chayNen = {
    chay: chay, cauHinh: cauHinh, thongKe: thongKe, coWorker: coWorker, dung: dung,
    taoMa: taoMa, xuLy: xuLy,
    /** Cho kiem thu: phuc hoi trang thai ban dau (Worker, co hong, thong ke). */
    datLai: function () { dung(); tt.cho = null; tt.hong = false; tt.daTraLoi = false; tt.loiLienTiep = 0; thongKe.soWorker = thongKe.soLuongChinh = thongKe.soHetGio = thongKe.soHuy = 0; thongKe.lyDoLuongChinh = ""; }
  };
})();
