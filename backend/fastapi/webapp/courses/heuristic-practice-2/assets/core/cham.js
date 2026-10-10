/* Bộ chấm lab: sinh dữ liệu từ seed, chạy lời giải của người học qua một `trinhChay` (JS hay C++),
   chấm từng test, rồi tổng hợp ra "mức đạt" — so với các lời giải tham chiếu của bài toán và kèm
   kiểm định có ý nghĩa thống kê theo Bài 4 (chênh lệch trung bình so với 2·SE).
   Thuần logic (không DOM) — kiểm bằng node. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var TI = TH.tienIch || (typeof require !== "undefined" ? require("./tien-ich.js") : null);

  var HAN_MAC_DINH = 1500, SO_TEST_MAC_DINH = 10;

  var boNho = {};            /* điểm của lời giải tham chiếu: tên bài toán|seed|tham số|tên → số */
  function diemThamChieu(vd, inst, khoa, ten) {
    var k = khoa + "|" + ten;
    if (boNho[k] !== undefined) return boNho[k];
    var f = vd.thamChieu && vd.thamChieu[ten];
    var v = null;
    if (f) {
      var r = vd.cham(inst, f(inst));
      v = r && r.ok ? r.diem : null;
    }
    boNho[k] = v;
    return v;
  }

  /* Tham số sinh dữ liệu của biến thể `bt` (lab.bienThe[bt].tham); không có biến thể thì lab.tham. */
  function thamCua(lab, bt) {
    var v = lab.bienThe && lab.bienThe[bt || 0];
    return v ? v.tham : lab.tham;
  }

  function danhSachTest(lab, vd, bt) {
    var n = lab.soTest || SO_TEST_MAC_DINH, seed0 = lab.seed0 || (1000 + (TI.bam(lab.id || "lab") % 9000)), a = [];
    for (var i = 0; i < n; i++) {
      var seed = seed0 + i * 7;
      var tham = thamCua(lab, bt);
      var inst = vd.sinh(seed, tham);
      a.push({ i: i, seed: seed, tham: tham, inst: inst, khoa: vd.ten + "|" + seed + "|" + JSON.stringify(tham || {}), input: vd.viet(inst) });
    }
    return a;
  }

  /* trinhChay(input, {i, gioiHan}) → Promise<{text, err, ms, loi, hetGio, ...}>
     tuyChon: {bienThe: chỉ số biến thể dữ liệu, tienDo(i, tong, ketQuaTest), huy() → bool} */
  function chayLab(lab, vd, trinhChay, tuyChon) {
    tuyChon = tuyChon || {};
    var tests = danhSachTest(lab, vd, tuyChon.bienThe), ketQua = [], han = lab.gioiHanMs || HAN_MAC_DINH;
    var i = 0;
    return new Promise(function (xong) {
      function tiep() {
        if (i >= tests.length || (tuyChon.huy && tuyChon.huy())) { xong(tongHop(lab, vd, tests, ketQua)); return; }
        var t = tests[i];
        Promise.resolve(trinhChay(t.input, { i: i, gioiHan: han })).then(function (r) {
          var kq = { i: t.i, seed: t.seed, ms: r.ms || 0, err: r.err || "", text: r.text || "" };
          if (r.hetGio) { kq.ok = false; kq.loi = r.loi || ("Quá giờ (" + han + " ms)"); kq.hetGio = true; }
          else if (r.ok === false || r.loi) { kq.ok = false; kq.loi = r.loi; kq.dong = r.dong; kq.loiChayMa = true; }
          else {
            var c = vd.cham(t.inst, r.text);
            kq.ok = !!c.ok; kq.diem = c.ok ? c.diem : 0; kq.loi = c.loi || ""; kq.chiTiet = c.chiTiet;
          }
          ketQua.push(kq);
          if (tuyChon.tienDo) tuyChon.tienDo(i + 1, tests.length, kq);
          /* Lỗi biên dịch/chạy chung cho mọi test (cú pháp, ném lỗi ngay) thì dừng sớm, không lặp lại cùng một lỗi. */
          if (kq.loiChayMa && ketQua.length >= 2 && ketQua[0].loi === kq.loi) { i = tests.length; } else i++;
          tiep();
        }, function (er) {
          ketQua.push({ i: t.i, seed: t.seed, ok: false, diem: 0, loi: String(er && er.message || er), ms: 0, loiChayMa: true });
          i = tests.length; tiep();
        });
      }
      tiep();
    });
  }

  function tongHop(lab, vd, tests, ketQua) {
    var daChay = ketQua.length, hopLe = daChay === tests.length && ketQua.every(function (k) { return k.ok; });
    var res = {
      soTest: tests.length, daChay: daChay, soHopLe: ketQua.filter(function (k) { return k.ok; }).length,
      hopLe: hopLe, tongDiem: null, dsMuc: [], muc: 0, mucToiDa: 1 + (lab.muc || []).length,
      chenhLech: null, tests: ketQua, tot: vd.tot, msTrungBinh: TI.trungBinh(ketQua.map(function (k) { return k.ms || 0; })),
      msLonNhat: ketQua.reduce(function (m, k) { return Math.max(m, k.ms || 0); }, 0)
    };
    if (!hopLe) return res;
    var diem = ketQua.map(function (k) { return k.diem; });
    res.tongDiem = diem.reduce(function (a, b) { return a + b; }, 0);
    res.muc = 1;
    var conDat = true, dau = null;
    (lab.muc || []).forEach(function (m, idx) {
      var ref = tests.map(function (t) { return diemThamChieu(vd, t.inst, t.khoa, m.so); });
      var coDuLieu = ref.every(function (x) { return x != null; });
      var tongRef = coDuLieu ? ref.reduce(function (a, b) { return a + b; }, 0) : null;
      var heSo = m.heSo == null ? 1 : m.heSo, tile = null;
      if (coDuLieu) {
        if (vd.tot === "thap") tile = res.tongDiem > 0 ? tongRef / res.tongDiem : (tongRef > 0 ? 0 : 1);
        else tile = tongRef > 0 ? res.tongDiem / tongRef : (res.tongDiem > 0 ? Infinity : 1);
      }
      var dat = coDuLieu && tile >= heSo - 1e-12;
      if (conDat && dat) res.muc = 2 + idx; else conDat = false;
      res.dsMuc.push({ ten: m.ten, so: m.so, heSo: heSo, tile: tile, tongRef: tongRef, dat: dat });
      if (idx === 0 || !dau) dau = { ref: ref };
    });
    if (dau) {                                   /* chênh lệch so với mốc đầu tiên, theo từng test (Bài 4) */
      var d = diem.map(function (v, k) {
        var r = dau.ref[k];
        if (!r) return 0;
        return vd.tot === "thap" ? (v > 0 ? r / v - 1 : 0) : (r > 0 ? v / r - 1 : 0);
      });
      var tb = TI.trungBinh(d), se = TI.saiSoChuan(d);
      res.chenhLech = { so: res.dsMuc[0].ten, tb: tb, se: se, coYNghia: Math.abs(tb) > 2 * se && se > 0 };
    }
    return res;
  }

  TH.cham = { chayLab: chayLab, tongHop: tongHop, danhSachTest: danhSachTest, thamCua: thamCua, diemThamChieu: diemThamChieu, xoaBoNho: function () { boNho = {}; } };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.cham;
})(typeof globalThis !== "undefined" ? globalThis : this);
