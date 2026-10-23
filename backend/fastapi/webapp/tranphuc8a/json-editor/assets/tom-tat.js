/* =====================================================================
   tom-tat.js — tom tat mot nut JSON de hien khi nhanh dang GAP (tab Cay):
   so khoa / phan tu, kich thuoc byte khi nen, kieu cac phan tu, vai khoa
   dau, dong xem truoc, chuoi mo ta day du cho tooltip / trinh doc man hinh.

   Theo khuon je-chung.js (khong DOM, khong storage, khong dong ho — kiem
   duoc bang node; JE_NGUON giu ham khai de Worker ghep lai). Can je-chung.js
   nap truoc.

   Hai quy tac de khong lam cham cay lon:
   1. DEM LAP bang ngan xep (JSON long 20 000 cap van duoc, de quy thi tran).
   2. Dem nhanh co "ngan sach": moi nut duyet tru 1; het ngan sach thi bo
      do dang va tra null (khong luu cache) — giao dien khi do khong hien
      kich thuoc cho hang do, doi nguoi dung re chuot / focus roi dem lai
      rieng hang ay. Ket qua day du luu WeakMap theo doi tuong: gia tri JSON
      cua app khong bao gio bi sua tai cho (moi thao tac sao nong theo
      duong dan) nen cache khong bao gio cu, va nhanh khong dung toi giu
      nguyen danh tinh sau moi lan sua.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  /* Nap bang node (khong qua index.html): keo je-chung.js vao truoc. */
  if (!(g.JE && g.JE.chung) && typeof require === "function") require("./je-chung.js");
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE;
  if (!JE || !JE.chung) throw new Error("tom-tat.js cần nạp je-chung.js trước");
  var laNhanh = JE.chung.laNhanh, catNgan = JE.chung.catNgan, kieuCua = JE.chung.kieuCua;

  var kho = typeof WeakMap === "function" ? new WeakMap() : null;

  /* ------------------------------------------------------ xem truoc ngan */
  /* Khoa "dang doc" nhat, theo thu tu uu tien. So sanh sau khi chuan hoa:
     chu thuong, bo dau tieng Viet, bo _ - va khoang trang — nen "Title",
     "tieu_de", "tieuDe", "Tiêu đề", "tên", "Mã" deu khop. */
  var KHOA_UU_TIEN = ["name", "title", "ten", "tieude", "label", "id", "key", "code",
                      "ma", "slug", "email", "username", "type", "kind"];

  /* Mang ban ghi lap lai cung bo khoa hang van lan: nho ket qua (normalize + 2 regex
     moi khoa la phan ton nhat cua xem truoc). Tran 4 096 khoa, qua thi xoa het. */
  var nhoKhoa = Object.create(null), soNhoKhoa = 0;
  function chuanKhoa(k) {
    var c = nhoKhoa[k];
    if (c !== undefined) return c;
    var s = String(k).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/đ/g, "d").replace(/[\s_\-]/g, "");
    if (soNhoKhoa >= 4096) { nhoKhoa = Object.create(null); soNhoKhoa = 0; }
    nhoKhoa[k] = s; soNhoKhoa++;
    return s;
  }

  /** Gia tri nguyen thuy dang ngan. Chuoi dai cat truoc khi stringify (chuoi
      10 MB khong bi stringify moi lan ve): 200 ky tu dau du cho moi gioi han
      xem truoc <= 100, ket qua cat ra giong het. */
  function giaTriNgan(v) {
    if (typeof v === "string") return JSON.stringify(v.length > 200 ? v.slice(0, 200) : v);
    return String(v);
  }

  /** Khoa "dang doc" nhat cua object: khoa uu tien co gia tri nguyen thuy
      (khac null, khac chuoi rong); khong co thi truong nguyen thuy dau
      tien (uu tien co gia tri). Khong co truong nguyen thuy nao: null. */
  function truongNoiBat(o) {
    if (!laNhanh(o) || Array.isArray(o)) return null;
    var ks = Object.keys(o), tot = null, hang = Infinity, dauTien = null, dauRong = null, i, v;
    for (i = 0; i < ks.length; i++) {
      v = o[ks[i]];
      if (laNhanh(v)) continue;
      var coNghia = v !== null && !(typeof v === "string" && !v.trim());
      if (!coNghia) { if (dauRong === null) dauRong = ks[i]; continue; }
      if (dauTien === null) dauTien = ks[i];
      var h = KHOA_UU_TIEN.indexOf(chuanKhoa(ks[i]));
      if (h >= 0 && h < hang) { hang = h; tot = ks[i]; }
    }
    return tot !== null ? tot : dauTien !== null ? dauTien : dauRong;
  }

  /** `nb`: truong noi bat da tinh san (tranh tinh hai lan); bo qua thi tu tinh. */
  function tomTatObject(o, nb) {
    var k = nb === undefined ? truongNoiBat(o) : nb;
    if (k !== null) return k + ": " + giaTriNgan(o[k]);
    var ks = Object.keys(o);
    if (!ks.length) return "";
    return ks.slice(0, 4).join(", ") + (ks.length > 4 ? ", …" : "");
  }

  /** Dong xem truoc ngan (~60 ky tu) cho nhanh dang gap, de phan biet cac
      phan tu ma khong phai mo ra:
        object  -> name: "Phúc"            (truong noi bat)
        object  -> a, b, c, …              (khong co truong nguyen thuy)
        mang    -> [0] name: "A" …         (phan tu dau la object)
        mang    -> 1, 2, 3 …               (phan tu nguyen thuy)
      `muc` (noi bo): so lop mang-trong-mang da di qua. Moi lop them "[0] "
      (4 ky tu), nen qua gioiHan/4 lop thi phan nhin thay da toan la tien to —
      dung som, ket qua y het ma khong de quy 20 000 lop (tran ngan xep). */
  function xemTruoc(v, gioiHan, muc) {
    gioiHan = gioiHan || 60;
    muc = muc || 0;
    if (muc > gioiHan / 4 + 1) return "…";
    var s = "";
    if (Array.isArray(v)) {
      if (!v.length) return "";
      var dau = v[0];
      if (laNhanh(dau)) {
        s = "[0] " + (Array.isArray(dau) ? (xemTruoc(dau, gioiHan, muc + 1) || "[ ]") : (tomTatObject(dau) || "{ }"));
        if (v.length > 1) s += " …";
      } else {
        var phan = [];
        for (var i = 0; i < v.length && phan.length < 3; i++) {
          if (laNhanh(v[i])) break;
          phan.push(giaTriNgan(v[i]));
        }
        s = phan.join(", ") + (v.length > phan.length ? " …" : "");
      }
    } else if (laNhanh(v)) {
      s = tomTatObject(v);
    }
    return catNgan(s, gioiHan);
  }

  /* ------------------------------------------------------ dinh dang so */
  /** 1234567 -> "1.234.567" (dau cham ngan cach nghin, kieu Viet). So
      nguyen khong am; khong phu thuoc ICU / locale cua may. */
  function soCoDau(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  /** 740 -> "740 B"; 3482 -> "3,4 KB"; 7421747 -> "7,08 MB" (dau phay thap phan). */
  function dinhDangByte(n) {
    if (!(n >= 0)) return "";
    if (n < 1024) return n + " B";
    var kb = (n / 1024).toFixed(1);
    if (+kb < 1024) return kb.replace(".", ",") + " KB";
    return (n / 1048576).toFixed(2).replace(".", ",") + " MB";
  }

  /* ------------------------------------------------------ do dai byte */
  var KHONG_DAC_BIET = /^[\x20\x21\x23-\x5b\x5d-\x7e]*$/;

  /** So byte UTF-8 cua chuoi JSON (ca hai dau nhay) — dung bang
      Buffer.byteLength(JSON.stringify(s)): `"` va `\` 2 byte, \b \t \n \f \r
      2 byte, ky tu dieu khien khac 6 byte (\u00XX), cap thay the 4 byte,
      thay the le 6 byte (JSON.stringify thoat thanh \udXXX). */
  function byteChuoi(s) {
    var len = s.length;
    if (len > 24 && KHONG_DAC_BIET.test(s)) return len + 2;     /* duong nhanh: ASCII in duoc */
    var n = 2;
    for (var i = 0; i < len; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) {
        if (c >= 0x20) n += (c === 0x22 || c === 0x5c) ? 2 : 1;
        else n += (c === 8 || c === 9 || c === 10 || c === 12 || c === 13) ? 2 : 6;
      } else if (c < 0x800) {
        n += 2;
      } else if (c >= 0xd800 && c <= 0xdbff) {
        var d = i + 1 < len ? s.charCodeAt(i + 1) : 0;
        if (d >= 0xdc00 && d <= 0xdfff) { n += 4; i++; } else n += 6;
      } else if (c >= 0xdc00 && c <= 0xdfff) {
        n += 6;
      } else {
        n += 3;
      }
    }
    return n;
  }

  function byteSo(x) {
    return isFinite(x) ? String(x).length : 4;      /* JSON.stringify(Infinity / NaN) = "null" */
  }

  /** Duyet LAP mot gia tri: so byte khi nen, so nut (gom ca chinh no), do sau
      lon nhat (goc = 0, giong `dem`). `ngan` = { con: N } (tuy chon): moi nut
      tru 1, chuoi dai tru them len/256; xuong duoi 0 thi bo, tra null. */
  function quet(goc, ngan) {
    var byte = 0, nut = 0, sau = 0;
    var st = [goc], ds = [0], i;
    while (st.length) {
      if (ngan && (ngan.con -= 1) < 0) return null;
      var x = st.pop(), d = ds.pop();
      nut++;
      if (d > sau) sau = d;
      if (x === null || x === undefined) byte += 4;
      else if (typeof x === "string") {
        if (ngan && x.length > 255) ngan.con -= x.length >> 8;
        byte += byteChuoi(x);
      } else if (typeof x === "number") byte += byteSo(x);
      else if (typeof x === "boolean") byte += x ? 4 : 5;
      else if (Array.isArray(x)) {
        byte += x.length ? x.length + 1 : 2;           /* [ ] + (n-1) dau phay */
        for (i = 0; i < x.length; i++) { st.push(x[i]); ds.push(d + 1); }
      } else {
        var ks = Object.keys(x);
        byte += ks.length ? ks.length + 1 : 2;         /* { } + (n-1) dau phay */
        for (i = 0; i < ks.length; i++) {
          byte += byteChuoi(ks[i]) + 1;                /* "khoa": */
          st.push(x[ks[i]]); ds.push(d + 1);
        }
      }
    }
    return { byte: byte, nut: nut, sau: sau };
  }

  /** { byte, nut, sau } cua `v`, co cache theo doi tuong. `ngan` (tuy chon):
      xem `quet`; het ngan sach thi tra null va KHONG luu cache. */
  function thongKeNhanh(v, ngan) {
    var coCache = kho && laNhanh(v);
    if (coCache) { var c = kho.get(v); if (c) return c; }
    var r = quet(v, ngan || null);
    if (r && coCache) kho.set(v, r);
    return r;
  }

  /** So byte UTF-8 cua JSON NEN cua `v` (= Buffer.byteLength(JSON.stringify(v))). */
  function doDaiByte(v) {
    return thongKeNhanh(v).byte;
  }

  /* ------------------------------------------------------ kieu phan tu */
  var MAU_TOI_DA = 1000;

  /** Dem kieu cac phan tu cua mang (lay mau toi da 1 000 phan tu dau).
      Tra { ds: [[kieu, so], …] giam dan, laMau } — khi lay mau, `so` duoc
      nhan theo ti le de cung cho thay "chiem phan lon" (kem "≈"). */
  var TEN_KIEU = ["array", "boolean", "null", "number", "object", "string"];   /* theo thu tu chu cai: hoa thi xep theo ten */

  function kieuPhanTu(mang) {
    var n = Math.min(mang.length, MAU_TOI_DA), dem = [0, 0, 0, 0, 0, 0], i, x;
    for (i = 0; i < n; i++) {
      x = mang[i];
      dem[x === null || x === undefined ? 2 : Array.isArray(x) ? 0 : typeof x === "object" ? 4
        : typeof x === "string" ? 5 : typeof x === "number" ? 3 : 1]++;
    }
    var laMau = mang.length > n, he = laMau ? mang.length / n : 1, ds = [];
    for (i = 0; i < 6; i++) if (dem[i]) ds.push([TEN_KIEU[i], laMau ? Math.round(dem[i] * he) : dem[i]]);
    if (ds.length > 1) ds.sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
    return { ds: ds, laMau: laMau };
  }

  /** "object×2.100, null×8" (toi da 3 kieu, them ", …" neu con), "≈ " khi lay mau. */
  function chuoiKieuPhanTu(kp) {
    if (!kp.ds.length) return "";
    var phan = kp.ds.slice(0, 3).map(function (p) { return p[0] + "×" + soCoDau(p[1]); });
    return (kp.laMau ? "≈ " : "") + phan.join(", ") + (kp.ds.length > 3 ? ", …" : "");
  }

  /* ------------------------------------------------------ tom tat mot nut */
  /** Tom tat mot nut. Khong duyet cay con tru khi `tuyChon.byte` (khi do mot
      lan duyet lap cho byte + nut + sau, co `tuyChon.ngan`):

        kieu        "object" | "array" | kieu nguyen thuy
        so          so khoa / phan tu (nguyen thuy: 0)
        khoaDau     object: toi da 3 khoa dau (chuoi)
        conKhoa     con khoa nua ngoai 3 khoa dau
        noiBat      object: 'name: "Phúc"' hoac ""
        kieuCon     mang: "object×2.100, null×8" ("≈ …" khi lay mau)
        xemTruoc    dong xem truoc cu (<= gioiHan, mac dinh 60)
        dong        dong xem truoc de HIEN: noi bat + vai khoa con lai (<= 90)
        byte|nut|sau  null neu khong yeu cau / het ngan sach (daTinh false) */
  function tomTatNut(v, tuyChon) {
    var tc = tuyChon || {}, gioiHan = tc.gioiHan || 60;
    var t = {
      kieu: kieuCua(v), so: 0, khoaDau: [], conKhoa: false, noiBat: "", kieuCon: "",
      xemTruoc: "", dong: "", byte: null, nut: null, sau: null, daTinh: false
    };
    if (laNhanh(v)) {
      var mang = Array.isArray(v), i;
      if (mang) {
        t.xemTruoc = xemTruoc(v, gioiHan);
        t.so = v.length;
        t.kieuCon = chuoiKieuPhanTu(kieuPhanTu(v));
        t.dong = t.xemTruoc;
      } else {
        var ks = Object.keys(v);
        t.so = ks.length;
        t.khoaDau = ks.slice(0, 3);
        t.conKhoa = ks.length > 3;
        var nb = truongNoiBat(v);
        t.xemTruoc = catNgan(tomTatObject(v, nb), gioiHan);      /* = xemTruoc(v, gioiHan), khong tinh lai nb */
        if (nb !== null) {
          t.noiBat = nb + ": " + giaTriNgan(v[nb]);
          var khac = [];
          for (i = 0; i < ks.length && khac.length < 4; i++) if (ks[i] !== nb) khac.push(ks[i]);
          t.dong = catNgan(t.noiBat, 60) + (khac.length
            ? " · " + khac.slice(0, 3).map(function (k) { return catNgan(k, 24); }).join(", ") + (khac.length > 3 ? ", …" : "")
            : "");
        } else {
          t.dong = t.xemTruoc;
        }
      }
      t.dong = catNgan(t.dong, 90);
    }
    if (tc.byte) {
      var r = thongKeNhanh(v, tc.ngan);
      if (r) { t.byte = r.byte; t.nut = r.nut; t.sau = r.sau; t.daTinh = true; }
    }
    return t;
  }

  /** Kich thuoc dang doc: "3,4 KB" (hoac "740 B"). "" khi chua tinh. */
  function chuoiKichThuoc(t) {
    return t.byte === null ? "" : dinhDangByte(t.byte);
  }

  /** Mo ta day du cho tooltip: duong dan · kieu · so · kich thuoc · sau · nut
      · kieu phan tu · khoa dau. `duong` (tuy chon) dung dau chuoi. */
  function moTaNut(t, duong) {
    var p = [];
    if (duong) p.push(duong);
    var mang = t.kieu === "array";
    p.push(mang ? "mảng" : t.kieu);
    if (mang || t.kieu === "object") p.push(soCoDau(t.so) + (mang ? " phần tử" : " khoá"));
    if (t.byte !== null) p.push(dinhDangByte(t.byte) + " (" + soCoDau(t.byte) + " byte khi nén)");
    if (t.sau !== null) p.push("sâu " + soCoDau(t.sau) + " cấp");
    if (t.nut !== null) p.push(soCoDau(t.nut) + " nút");
    if (t.kieuCon) p.push("kiểu phần tử: " + t.kieuCon);
    if (t.khoaDau.length) {
      p.push("khoá: " + t.khoaDau.map(function (k) { return catNgan(k, 30); }).join(", ") + (t.conKhoa ? ", …" : ""));
    }
    if (mang && t.xemTruoc) p.push("đầu: " + t.xemTruoc);
    return p.join(" · ");
  }

  /** Phan them vao ten truy cap (aria-label) cua treeitem — ngan, khong lap
      lai so khoa / phan tu da co trong ten. "" khi chua co gi de them. */
  function moTaAria(t) {
    var p = [];
    if (t.byte !== null) p.push(dinhDangByte(t.byte) + " khi nén");
    if (t.sau !== null) p.push("sâu " + soCoDau(t.sau) + " cấp");
    if (t.nut !== null) p.push(soCoDau(t.nut) + " nút");
    if (t.kieuCon) p.push("phần tử " + t.kieuCon);
    return p.join(", ");
  }

  JE.tomTat = {
    tomTatNut: tomTatNut, doDaiByte: doDaiByte, thongKeNhanh: thongKeNhanh,
    dinhDangByte: dinhDangByte, soCoDau: soCoDau, chuoiKichThuoc: chuoiKichThuoc,
    moTaNut: moTaNut, moTaAria: moTaAria, kieuPhanTu: kieuPhanTu, chuoiKieuPhanTu: chuoiKieuPhanTu,
    xemTruoc: xemTruoc, truongNoiBat: truongNoiBat, byteChuoi: byteChuoi
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.tomTat;
});
