/* =====================================================================
   vi-tri.js — con tro JSON <-> vi tri trong VAN BAN (module thuan, khuon
   je-chung.js: khong DOM, khong storage, khong dong ho; co JE_NGUON de
   Worker ghep lai).

   Dung de: bam mot loi schema / ket qua truy van -> chon dung doan van ban
   (tab Soan), quet khoi {…} […] cho che do gap, canh bao khoa trung va so
   mat chu so ma JSON.parse nuot im.

   Moi ham CHIU duoc JSON hong / dang go do: khong bao gio nem loi (tra
   null / bo qua ngoac lech). Khong de quy theo do sau cua DU LIEU (duyet
   lap bang vong lap hoac ngan xep tu quan ly) — chi timNhieuViTri de quy
   theo do dai DUONG DAN, bi chan o TRAN_DUONG.

   API (JE.viTri):
     chiSoDong(s)                  -> Uint32Array dau moi dong
     chiSoDongTang(cu, chiCu, moi) -> nhu chiSoDong(moi), tang dan tu chi so cua `cu` (mot doan doi)
     dongCuaViTri(chiSo, i)        -> so dong (dem tu 1), tim nhi phan
     timViTri(s, duong)            -> {khoaBd, khoaKt, bd, kt} | null
     timNhieuViTri(s, dsDuong)     -> Map(JSON.stringify(duong) -> {…}) mot luot
     duongTaiViTri(s, i)           -> {duong, vungGiaTri:{bd,kt}, trongKhoa} | null
     taoBoQuetKhoi()               -> { chay(s, nganSach) -> xong?, ketQua(), duongCuaKhoi(k) }
     loiNhe(s, tran)               -> [{loai, bd, kt, thongBao}]
   `duong` = mang khoa (chuoi) / chi so (so); doan co the la chuoi so khi
   cha la mang ("0" khop phan tu 0). `kt` la bien PHAI (khong tinh).
   Khoa trung: JSON.parse giu gia tri CUOI, nen moi ham o day cung lay cai
   cuoi — khop mo hinh ma app dang thao tac.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});

  var TRAN_DUONG = 3000;     /* timNhieuViTri bo qua duong dan dai hon (de quy theo do dai duong dan) */

  function laTrang(c) { return c === 32 || c === 10 || c === 13 || c === 9; }

  function boQuaTrang(s, i) {
    var n = s.length;
    while (i < n && laTrang(s.charCodeAt(i))) i++;
    return i;
  }

  /** Chi so ngay SAU dau nhay dong cua chuoi bat dau o s[i] === '"'; -1 neu
      chuoi khong dong. Nhay dong bi thoat khi truoc no co so LE dau `\`. */
  function cuoiChuoi(s, i) {
    var j = i + 1;
    for (;;) {
      var q = s.indexOf('"', j);
      if (q < 0) return -1;
      var b = 0, k = q - 1;
      while (k > i && s.charCodeAt(k) === 92) { b++; k--; }
      if ((b & 1) === 0) return q + 1;
      j = q + 1;
    }
  }

  /** Chi so ngay SAU gia tri bat dau o s[i] (ky tu dau tien cua gia tri);
      -1 khi hong / khong ket thuc. Bo qua khoi bang dem ngoac biet chuoi. */
  function cuoiGiaTri(s, i) {
    var n = s.length, c = s.charCodeAt(i);
    if (c !== c) return -1;                              /* het van ban */
    if (c === 34) return cuoiChuoi(s, i);
    if (c === 123 || c === 91) {
      var sau = 0;
      for (var j = i; j < n; j++) {
        c = s.charCodeAt(j);
        if (c === 34) { j = cuoiChuoi(s, j); if (j < 0) return -1; j--; }
        else if (c === 123 || c === 91) sau++;
        else if (c === 125 || c === 93) { sau--; if (sau === 0) return j + 1; }
      }
      return -1;
    }
    if (c === 44 || c === 125 || c === 93 || c === 58) return -1;
    var k = i;
    while (k < n) {
      c = s.charCodeAt(k);
      if (c === 44 || c === 125 || c === 93 || c === 58 || laTrang(c)) break;
      k++;
    }
    return k > i ? k : -1;
  }

  /** Gia tri bat dau o s[i] la khoi / chuoi (co the chua dong khi dang go do). */
  function cuoiMo(s, i) {
    var c = s.charCodeAt(i);
    return c === 123 || c === 91 || c === 34;
  }

  /** Khoa object (token chuoi [kb, ke)) giai ma; null neu thoat sai. */
  function giaiKhoa(s, kb, ke) {
    for (var q = kb + 1; q < ke - 1; q++) {
      if (s.charCodeAt(q) === 92) {
        try { return JSON.parse(s.slice(kb, ke)); } catch (e) { return null; }
      }
    }
    return s.slice(kb + 1, ke - 1);
  }

  /** Khoa (token [kb, ke)) co bang `seg` khong — khong cat chuoi khi khong can. */
  function khopKhoa(s, kb, ke, seg) {
    seg = String(seg);
    if (ke - kb - 2 === seg.length) {
      var co = false;
      for (var q = kb + 1; q < ke - 1; q++) if (s.charCodeAt(q) === 92) { co = true; break; }
      if (!co) return s.startsWith(seg, kb + 1);
    } else {
      /* do dai tho khac: chi co the bang khi co thoat (\n, \uXXXX…) */
      var coThoat = false;
      for (var q2 = kb + 1; q2 < ke - 1; q2++) if (s.charCodeAt(q2) === 92) { coThoat = true; break; }
      if (!coThoat) return false;
    }
    return giaiKhoa(s, kb, ke) === seg;
  }

  function laChiSo(seg, i) {
    return typeof seg === "number" ? seg === i : /^(0|[1-9]\d*)$/.test(seg) && +seg === i;
  }

  /* ----------------------------------------------------- chi so dong */
  function chiSoDong(s) {
    var n = 1, k;
    for (k = s.indexOf("\n"); k >= 0; k = s.indexOf("\n", k + 1)) n++;
    var ra = new Uint32Array(n), j = 1;
    for (k = s.indexOf("\n"); k >= 0; k = s.indexOf("\n", k + 1)) ra[j++] = k + 1;
    return ra;
  }

  /** chiSoDong(moi) TANG DAN tu chiSoDong(cu) khi `moi` chi khac `cu` o MOT doan lien (go / dan / xoa mot cho):
      chi quet "\n" trong doan doi, phan sau dich mot hang so. `goiY` (tuy chon) = vi tri con tro trong `moi`: go / xoa
      thuong de dau con tro dung cuoi doan doi, nen thu a = goiY - d (chen) hoac a = goiY (xoa) truoc — chi 2 phep so sanh
      chuoi goc (~0,6 ms o 1 M ky tu). Goi y SAI hay khong co thi tim tien to + hau to chung bang tim nhi phan (~12 ms).
      Goi y chi de nhanh: moi phep thu deu duoc XAC MINH (tien to va hau to bang nhau), nen ket qua LUON == chiSoDong(moi). */
  function chiSoDongTang(cu, chiCu, moi, goiY) {
    var L0 = cu.length, L1 = moi.length, m = Math.min(L0, L1), d = L1 - L0;
    if (!chiCu || L0 < 4096 || L1 < 4096) return chiSoDong(moi);
    var a = -1, b = 0, dx = d < 0 ? -d : 0, dm = d > 0 ? d : 0;       /* doan cu [a, a+dx), doan moi [a, a+dm) */
    if (typeof goiY === "number" && goiY >= 0) {
      var ung = d > 0 ? goiY - d : goiY;
      if (ung >= 0 && ung <= m && ung + dx <= L0 && ung + dm <= L1 &&
          cu.slice(0, ung) === moi.slice(0, ung) && cu.slice(ung + dx) === moi.slice(ung + dm)) a = ung;
    }
    if (a < 0) {
      var lo = 0, hi = m, mid;
      while (lo < hi) { mid = (lo + hi + 1) >> 1; if (cu.slice(0, mid) === moi.slice(0, mid)) lo = mid; else hi = mid - 1; }
      a = lo;
      lo = 0; hi = m - a;
      while (lo < hi) { mid = (lo + hi + 1) >> 1; if (cu.slice(L0 - mid) === moi.slice(L1 - mid)) lo = mid; else hi = mid - 1; }
      b = lo; dx = L0 - a - b; dm = L1 - a - b;
    }
    var nc = chiCu.length, k1, k2;
    var cuoiCu = a + dx, cuoiMoi = a + dm;
    /* k1 = so muc co chiCu[k] <= a (dong bat dau trong tien to); k2 = muc dau tien co chiCu[k] > cuoiCu (newline nam trong hau to) */
    lo = 0; hi = nc;
    while (lo < hi) { mid = (lo + hi) >> 1; if (chiCu[mid] <= a) lo = mid + 1; else hi = mid; }
    k1 = lo;
    lo = k1; hi = nc;
    while (lo < hi) { mid = (lo + hi) >> 1; if (chiCu[mid] <= cuoiCu) lo = mid + 1; else hi = mid; }
    k2 = lo;
    var giua = [], q = moi.indexOf("\n", a);
    while (q >= 0 && q < cuoiMoi) { giua.push(q + 1); q = moi.indexOf("\n", q + 1); }
    var ra = new Uint32Array(k1 + giua.length + (nc - k2)), j, t = k1;
    ra.set(chiCu.subarray(0, k1), 0);
    for (j = 0; j < giua.length; j++) ra[t++] = giua[j];
    for (j = k2; j < nc; j++) ra[t++] = chiCu[j] + d;
    return ra;
  }

  /** So dong (tu 1) chua ky tu `i` (tim nhi phan tren chiSoDong). */
  function dongCuaViTri(chiSo, i) {
    var lo = 0, hi = chiSo.length - 1;
    while (lo < hi) {
      var giua = (lo + hi + 1) >> 1;
      if (chiSo[giua] <= i) lo = giua; else hi = giua - 1;
    }
    return lo + 1;
  }

  /* ----------------------------------------------------- timViTri */
  /** Vi tri van ban cua gia tri o `duong`. Quet tu dau, nhay qua nhanh
      khong lien quan bang dem ngoac. Khoa trung: lay cai CUOI. */
  function timViTri(s, duong) {
    s = String(s);
    var n = s.length, i = boQuaTrang(s, 0);
    if (i >= n) return null;
    var cur = { khoaBd: -1, khoaKt: -1, bd: i, kt: -1 }, c;
    for (var d = 0; d < duong.length; d++) {
      var seg = duong[d];
      i = cur.bd;
      c = s.charCodeAt(i);
      var tim = null;
      if (c === 123) {                                   /* object */
        i++;
        for (;;) {
          i = boQuaTrang(s, i);
          c = s.charCodeAt(i);
          if (c === 125) break;
          if (c === 44) { i++; continue; }
          if (c !== 34) return null;
          var kb = i, ke = cuoiChuoi(s, i);
          if (ke < 0) return null;
          i = boQuaTrang(s, ke);
          if (s.charCodeAt(i) !== 58) return null;
          i = boQuaTrang(s, i + 1);
          var kv = cuoiGiaTri(s, i), khop = khopKhoa(s, kb, ke, seg);
          if (kv < 0) {                                  /* gia tri chua dong (JSON dang go do): van di xuong neu la khoa can tim */
            if (khop && cuoiMo(s, i)) { tim = { khoaBd: kb, khoaKt: ke, bd: i, kt: -1 }; break; }
            return null;
          }
          if (khop) tim = { khoaBd: kb, khoaKt: ke, bd: i, kt: kv };
          i = boQuaTrang(s, kv);
          c = s.charCodeAt(i);
          if (c === 44) { i++; continue; }
          if (c === 125) break;
          return null;
        }
      } else if (c === 91) {                             /* mang */
        i++;
        var idx = 0;
        for (;;) {
          i = boQuaTrang(s, i);
          c = s.charCodeAt(i);
          if (c === 93) break;
          if (c === 44) { i++; continue; }
          var ev = cuoiGiaTri(s, i);
          if (ev < 0) {
            if (laChiSo(seg, idx) && cuoiMo(s, i)) { tim = { khoaBd: -1, khoaKt: -1, bd: i, kt: -1 }; break; }
            return null;
          }
          if (laChiSo(seg, idx)) { tim = { khoaBd: -1, khoaKt: -1, bd: i, kt: ev }; break; }
          idx++;
          i = boQuaTrang(s, ev);
          c = s.charCodeAt(i);
          if (c === 44) { i++; continue; }
          if (c === 93) break;
          return null;
        }
      } else return null;
      if (!tim) return null;
      cur = tim;
    }
    var kt = cuoiGiaTri(s, cur.bd);
    if (kt < 0) {
      if (!cuoiMo(s, cur.bd)) return null;               /* chua dong: keo toi het van ban (bo khoang trang cuoi) */
      kt = n;
      while (kt > cur.bd && laTrang(s.charCodeAt(kt - 1))) kt--;
    }
    cur.kt = kt;
    return cur;
  }

  /* ----------------------------------------------------- timNhieuViTri */
  function taoCay(dsDuong) {
    var goc = { con: null, kq: null, dich: false, khoa: null };
    for (var a = 0; a < dsDuong.length; a++) {
      var d = dsDuong[a];
      if (!Array.isArray(d) || d.length > TRAN_DUONG) continue;
      var nut = goc;
      for (var b = 0; b < d.length; b++) {
        var k = String(d[b]);
        if (!nut.con) nut.con = Object.create(null);
        nut = nut.con[k] || (nut.con[k] = { con: null, kq: null, dich: false, khoa: null });
      }
      nut.dich = true;
      (nut.khoa || (nut.khoa = [])).push(JSON.stringify(d));
    }
    return goc;
  }

  function xoaKq(nut) {
    nut.kq = null;
    if (nut.con) for (var k in nut.con) xoaKq(nut.con[k]);
  }

  function gomKq(nut, ra) {
    if (nut.dich && nut.kq && nut.khoa) {
      for (var i = 0; i < nut.khoa.length; i++) ra.set(nut.khoa[i], nut.kq);
    }
    if (nut.con) for (var k in nut.con) gomKq(nut.con[k], ra);
  }

  /** Duyet gia tri bat dau o s[i] ung voi nut `nut` cua cay duong dan;
      tra chi so ngay sau gia tri (-1 khi hong). Chi de quy theo do sau cua
      CAY DUONG DAN, khong theo du lieu. */
  function duyetNut(s, i, nut, khoaBd, khoaKt) {
    var kt, c = s.charCodeAt(i);
    if (!nut.con || (c !== 123 && c !== 91)) {
      kt = cuoiGiaTri(s, i);
      if (kt >= 0 && nut.dich) nut.kq = { khoaBd: khoaBd, khoaKt: khoaKt, bd: i, kt: kt };
      return kt;
    }
    var bd = i, j = i + 1, daCo = null;
    if (c === 123) {
      for (;;) {
        j = boQuaTrang(s, j);
        c = s.charCodeAt(j);
        if (c === 125) { j++; break; }
        if (c === 44) { j++; continue; }
        if (c !== 34) return -1;
        var kb = j, ke = cuoiChuoi(s, j);
        if (ke < 0) return -1;
        j = boQuaTrang(s, ke);
        if (s.charCodeAt(j) !== 58) return -1;
        j = boQuaTrang(s, j + 1);
        var con = null;
        if (nut.con) {
          var kk = giaiKhoa(s, kb, ke);
          if (kk !== null) con = nut.con[kk] || null;
        }
        var ev;
        if (con) {
          if (con.kq || con.daGap) xoaKq(con);            /* khoa trung: cai sau thang */
          con.daGap = true;
          ev = duyetNut(s, j, con, kb, ke);
        } else ev = cuoiGiaTri(s, j);
        if (ev < 0) return -1;
        j = boQuaTrang(s, ev);
        c = s.charCodeAt(j);
        if (c === 44) { j++; continue; }
        if (c === 125) { j++; break; }
        return -1;
      }
    } else {
      var idx = 0;
      for (;;) {
        j = boQuaTrang(s, j);
        c = s.charCodeAt(j);
        if (c === 93) { j++; break; }
        if (c === 44) { j++; continue; }
        var cc = nut.con[String(idx)] || null, e2;
        e2 = cc ? duyetNut(s, j, cc, -1, -1) : cuoiGiaTri(s, j);
        if (e2 < 0) return -1;
        idx++;
        j = boQuaTrang(s, e2);
        c = s.charCodeAt(j);
        if (c === 44) { j++; continue; }
        if (c === 93) { j++; break; }
        return -1;
      }
    }
    if (nut.dich) nut.kq = { khoaBd: khoaBd, khoaKt: khoaKt, bd: bd, kt: j };
    return j;
  }

  /** MOT luot quet cho nhieu dich. Khoa Map = JSON.stringify(duong) cua
      duong dan duoc dua vao. Duong khong tim thay thi khong co trong Map. */
  function timNhieuViTri(s, dsDuong) {
    s = String(s);
    var ra = new Map();
    if (!dsDuong || !dsDuong.length) return ra;
    var goc = taoCay(dsDuong), i = boQuaTrang(s, 0);
    if (i >= s.length) return ra;
    duyetNut(s, i, goc, -1, -1);
    gomKq(goc, ra);
    return ra;
  }

  /* ----------------------------------------------------- duongTaiViTri */
  /** Duong dan tai con tro `i`: gia tri SAU NHAT chua `i`. Con tro nam trong
      mot khoa -> duong dan toi khoa do, trongKhoa = true. Con tro nam o
      khoang trang / dau cau giua cac phan tu -> duong dan cua khoi chua no. */
  function duongTaiViTri(s, i) {
    s = String(s);
    var n = s.length;
    i = Math.max(0, Math.min(i | 0, n));
    var bd = boQuaTrang(s, 0);
    if (bd >= n || i < bd) return null;
    var duong = [];
    for (;;) {
      var kt = cuoiGiaTri(s, bd);
      if (kt < 0) kt = n;
      var c = s.charCodeAt(bd);
      if (c !== 123 && c !== 91) return { duong: duong, vungGiaTri: { bd: bd, kt: kt }, trongKhoa: false };
      var j = bd + 1, idx = 0, xuong = null;
      for (;;) {
        j = boQuaTrang(s, j);
        if (j >= kt || j > i) break;
        c = s.charCodeAt(j);
        if (c === 125 || c === 93) break;
        if (c === 44) { j++; continue; }
        var khoa = idx, kb = -1, ke = -1, vb;
        if (s.charCodeAt(bd) === 123) {
          if (c !== 34) break;
          kb = j; ke = cuoiChuoi(s, j);
          if (ke < 0) ke = n;
          var gk = giaiKhoa(s, kb, Math.min(ke, n));
          khoa = gk === null ? s.slice(kb + 1, ke - 1) : gk;
          j = boQuaTrang(s, ke);
          if (s.charCodeAt(j) !== 58) {
            if (i >= kb && i <= ke) return { duong: duong.concat([khoa]), vungGiaTri: { bd: kb, kt: ke }, trongKhoa: true };
            break;
          }
          vb = boQuaTrang(s, j + 1);
        } else {
          vb = j;
        }
        var ve = cuoiGiaTri(s, vb);
        if (ve < 0) ve = n;
        if (kb >= 0 && i >= kb && i < vb && i <= ke) {
          return { duong: duong.concat([khoa]), vungGiaTri: { bd: vb, kt: ve }, trongKhoa: true };
        }
        var laKhoi = s.charCodeAt(vb) === 123 || s.charCodeAt(vb) === 91;
        if (i >= vb && (laKhoi ? i < ve : i <= ve)) { xuong = { khoa: khoa, bd: vb }; break; }
        idx++;
        j = ve;
      }
      if (!xuong) return { duong: duong, vungGiaTri: { bd: bd, kt: kt }, trongKhoa: false };
      duong.push(xuong.khoa);
      bd = xuong.bd;
    }
  }

  /* ----------------------------------------------------- quet khoi */
  /** Bo quet khoi {…} / […] chia lat. `chay(s, nganSach)` xu ly toi da ~nganSach
      ky tu roi nghi (tra true khi het van ban); goi lai voi CUNG chuoi `s`
      de quet tiep. Ngoac lech / chuoi khong dong khong gay loi.
      Khoi chua dong den cuoi van ban: viTriDong = -1, dongDong = tong so dong. */
  function taoBoQuetKhoi() {
    var s = "", n = 0, pos = 0, dong = 1, tiepNL = -1, daBatDau = false, xong = false;
    var cap = 1024, soKhoi = 0;
    /* Mang dac (typed array) la BIEN CUC BO (khong qua doi tuong) de truy cap nhanh trong vong quet nong. */
    var loai = new Uint8Array(cap), dongMo = new Int32Array(cap), dongDong = new Int32Array(cap), viTriMo = new Int32Array(cap),
      viTriDong = new Int32Array(cap), sau = new Int32Array(cap), cha = new Int32Array(cap), soCon = new Int32Array(cap),
      khoaBd = new Int32Array(cap), khoaKt = new Int32Array(cap), chiSo = new Int32Array(cap);
    var ngan = [];                                       /* khung: {k, kieu, st, kb, ke, idx} */

    function lon() {
      var moi = cap * 2;
      var gan = function (cu, Kieu) { var a = new Kieu(moi); a.set(cu); return a; };
      loai = gan(loai, Uint8Array);
      dongMo = gan(dongMo, Int32Array); dongDong = gan(dongDong, Int32Array); viTriMo = gan(viTriMo, Int32Array); viTriDong = gan(viTriDong, Int32Array);
      sau = gan(sau, Int32Array); cha = gan(cha, Int32Array); soCon = gan(soCon, Int32Array);
      khoaBd = gan(khoaBd, Int32Array); khoaKt = gan(khoaKt, Int32Array); chiSo = gan(chiSo, Int32Array);
      cap = moi;
    }

    function dongKhung(sauKhung, nao) {
      var f = ngan[sauKhung];
      viTriDong[f.k] = nao >= 0 ? nao : -1;
      dongDong[f.k] = dong;
    }

    function chay(text, nganSach) {
      if (xong) return true;
      if (!daBatDau) {
        s = String(text); n = s.length; daBatDau = true;
        tiepNL = s.indexOf("\n");
      }
      var bd0 = pos, han = nganSach > 0 ? nganSach : Infinity;
      while (pos < n && pos - bd0 < han) {
        var c = s.charCodeAt(pos), top, ket;
        if (c === 32 || c === 9 || c === 13) {            /* khoang trang thuong (thut le): duong nhanh */
          pos++;
          while (pos < n && s.charCodeAt(pos) === 32) pos++;
          continue;
        }
        if (c === 10) { dong++; tiepNL = s.indexOf("\n", pos + 1); pos++; continue; }
        top = ngan.length ? ngan[ngan.length - 1] : null;
        if (c === 123 || c === 91) {
          if (soKhoi >= cap) lon();
          var k = soKhoi++;
          viTriMo[k] = pos; dongMo[k] = dong; viTriDong[k] = -1; dongDong[k] = -1;
          loai[k] = c === 123 ? 1 : 2; sau[k] = ngan.length; soCon[k] = 0;
          cha[k] = top ? top.k : -1;
          khoaBd[k] = -1; khoaKt[k] = -1; chiSo[k] = -1;
          if (top) {
            if (top.kieu === 1) { khoaBd[k] = top.kb; khoaKt[k] = top.ke; top.st = 3; }
            else { chiSo[k] = top.idx; top.idx++; soCon[top.k] = top.idx; top.st = 3; }
          }
          ngan.push({ k: k, kieu: loai[k], st: 0, kb: -1, ke: -1, idx: 0 });
          pos++;
        } else if (c === 125 || c === 93) {
          var kieu = c === 125 ? 1 : 2, m = ngan.length - 1;
          while (m >= 0 && ngan[m].kieu !== kieu) m--;
          if (m >= 0) {                                   /* khung o giua bi bo do: de -1 */
            for (var q = ngan.length - 1; q > m; q--) dongKhung(q, -1);
            dongKhung(m, pos);
            ngan.length = m;
          }                                               /* khong khop khung nao: bo qua ngoac thua */
          pos++;
        } else if (c === 44) {
          if (top) top.st = 0;
          pos++;
        } else if (c === 58) {
          if (top && top.kieu === 1) top.st = 2;
          pos++;
        } else {
          if (c === 34) {
            ket = cuoiChuoi(s, pos);
            if (ket < 0) ket = n;
          } else {
            ket = pos + 1;
            while (ket < n) {
              var cc = s.charCodeAt(ket);
              if (cc === 44 || cc === 125 || cc === 93 || cc === 58 || cc === 123 || cc === 91 || cc === 34 || laTrang(cc)) break;
              ket++;
            }
          }
          if (top) {
            if (top.kieu === 1) {
              if (top.st === 0 || top.st === 1) { top.kb = pos; top.ke = ket; top.st = 1; soCon[top.k]++; }
              else top.st = 3;
            } else { top.idx++; soCon[top.k] = top.idx; top.st = 3; }
          }
          while (tiepNL >= 0 && tiepNL < ket) { dong++; tiepNL = s.indexOf("\n", tiepNL + 1); }
          pos = ket;
        }
      }
      if (pos >= n) xong = true;
      return xong;
    }

    function ketQua() {
      var soDong = dong, i, k;
      for (i = 0; i < ngan.length; i++) { dongDong[ngan[i].k] = soDong; viTriDong[ngan[i].k] = -1; }
      var khoiCuaDong = new Int32Array(soDong).fill(-1);
      for (k = 0; k < soKhoi; k++) {
        var dm = dongMo[k];
        if (dongDong[k] > dm && khoiCuaDong[dm - 1] < 0) khoiCuaDong[dm - 1] = k;
      }
      var kq = {
        soKhoi: soKhoi, soDong: soDong, xong: xong, khoiCuaDong: khoiCuaDong,
        duongCuaKhoi: function (kk) { return duongCuaKhoi(kk); }
      };
      kq.dongMo = dongMo.subarray(0, soKhoi); kq.dongDong = dongDong.subarray(0, soKhoi); kq.viTriMo = viTriMo.subarray(0, soKhoi);
      kq.viTriDong = viTriDong.subarray(0, soKhoi); kq.sau = sau.subarray(0, soKhoi); kq.cha = cha.subarray(0, soKhoi);
      kq.soCon = soCon.subarray(0, soKhoi); kq.khoaBd = khoaBd.subarray(0, soKhoi); kq.khoaKt = khoaKt.subarray(0, soKhoi);
      kq.chiSo = chiSo.subarray(0, soKhoi);
      kq.loai = loai.subarray(0, soKhoi);
      return kq;
    }

    /** Duong dan toi khoi k: di nguoc cha[]; khoa giai ma lười bang JSON.parse
        lat cat. Khoi tren cung = []. */
    function duongCuaKhoi(k) {
      var ra = [];
      if (k < 0 || k >= soKhoi) return null;
      for (var x = k; cha[x] >= 0; x = cha[x]) {
        if (khoaBd[x] >= 0) {
          var g = giaiKhoa(s, khoaBd[x], khoaKt[x]);
          ra.push(g === null ? s.slice(khoaBd[x] + 1, khoaKt[x] - 1) : g);
        } else ra.push(chiSo[x]);
      }
      return ra.reverse();
    }

    return { chay: chay, ketQua: ketQua, duongCuaKhoi: duongCuaKhoi };
  }

  /* ----------------------------------------------------- loiNhe */
  /** Quy ve (chuSo khong 0 dau/cuoi, vi tri dau thap phan) de so hai cach viet cua cung mot so. */
  function chuanSo(t) {
    var m = /^-?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(t);
    if (!m) return null;
    var all = m[1] + (m[2] || ""), cham = m[1].length + (m[3] ? parseInt(m[3], 10) : 0);
    var lead = 0;
    while (lead < all.length && all.charAt(lead) === "0") lead++;
    all = all.slice(lead); cham -= lead;
    all = all.replace(/0+$/, "");
    return all === "" ? "0" : all + "@" + cham;
  }

  /** Chu so co nghia cua token (bo 0 dau va 0 cuoi). */
  function soChuSoNghia(t) {
    var m = /^-?(\d+)(?:\.(\d+))?/.exec(t);
    if (!m) return 0;
    return (m[1] + (m[2] || "")).replace(/^0+/, "").replace(/0+$/, "").length;
  }

  function soBiLamTron(tok) {
    if (tok.length < 16 && !/[eE]/.test(tok)) return null;
    var v = Number(tok);
    if (!isFinite(v)) return { loai: "vuot", ra: v };
    if (soChuSoNghia(tok) <= 15) return null;
    var a = chuanSo(tok), b = chuanSo(String(v));
    return a !== null && a !== b ? { loai: "lam-tron", ra: v } : null;
  }

  /** Cac dieu JSON.parse nuot im: khoa trung (giu gia tri cuoi) va so mat chu
      so (> 2^53, hoac > 15 chu so co nghia). Tra ve toi da `tran` muc. */
  function loiNhe(s, tran) {
    s = String(s);
    tran = tran || 1000;
    var n = s.length, pos = 0, ra = [], ngan = [];
    while (pos < n && ra.length < tran) {
      var c = s.charCodeAt(pos), top = ngan.length ? ngan[ngan.length - 1] : null, ket;
      if (laTrang(c)) { pos++; continue; }
      if (c === 123 || c === 91) {
        ngan.push({ kieu: c === 123 ? 1 : 2, st: 0, khoa: null });
        if (top) top.st = 3;
        pos++;
      } else if (c === 125 || c === 93) {
        var kieu = c === 125 ? 1 : 2, m = ngan.length - 1;
        while (m >= 0 && ngan[m].kieu !== kieu) m--;
        if (m >= 0) ngan.length = m;
        pos++;
      } else if (c === 44) { if (top) top.st = 0; pos++; }
      else if (c === 58) { if (top && top.kieu === 1) top.st = 2; pos++; }
      else if (c === 34) {
        ket = cuoiChuoi(s, pos);
        if (ket < 0) ket = n;
        if (top && top.kieu === 1 && (top.st === 0 || top.st === 1)) {
          var k = giaiKhoa(s, pos, Math.min(ket, n));
          if (k !== null) {
            if (!top.khoa) top.khoa = Object.create(null);
            if (top.khoa[k] === 1) {
              ra.push({ loai: "khoa-trung", bd: pos, kt: ket, thongBao: "Khoá trùng “" + (k.length > 40 ? k.slice(0, 39) + "…" : k) + "” — JSON.parse chỉ giữ giá trị cuối" });
            }
            top.khoa[k] = 1;
          }
          top.st = 1;
        } else if (top) top.st = 3;
        pos = ket;
      } else {
        ket = pos + 1;
        while (ket < n) {
          var cc = s.charCodeAt(ket);
          if (cc === 44 || cc === 125 || cc === 93 || cc === 58 || cc === 123 || cc === 91 || cc === 34 || laTrang(cc)) break;
          ket++;
        }
        if (c === 45 || (c >= 48 && c <= 57)) {
          var tok = s.slice(pos, ket), b = soBiLamTron(tok);
          if (b) {
            ra.push({
              loai: "so-lam-tron", bd: pos, kt: ket,
              thongBao: b.loai === "vuot"
                ? "Số " + (tok.length > 30 ? tok.slice(0, 29) + "…" : tok) + " vượt phạm vi số thực — JSON.parse đọc thành " + b.ra
                : "Số " + (tok.length > 30 ? tok.slice(0, 29) + "…" : tok) + " mất chữ số khi đọc (thành " + b.ra + ")"
            });
          }
        }
        if (top) top.st = 3;
        pos = ket;
      }
    }
    return ra;
  }

  JE.viTri = {
    chiSoDong: chiSoDong, chiSoDongTang: chiSoDongTang, dongCuaViTri: dongCuaViTri,
    timViTri: timViTri, timNhieuViTri: timNhieuViTri, duongTaiViTri: duongTaiViTri,
    taoBoQuetKhoi: taoBoQuetKhoi, loiNhe: loiNhe,
    cuoiGiaTri: cuoiGiaTri, cuoiChuoi: cuoiChuoi, giaiKhoa: giaiKhoa,
    TRAN_DUONG: TRAN_DUONG
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.viTri;
});
