/* =====================================================================
   json-editor.js — soan, soi, sua, truy van va so sanh JSON.

   Khong thu vien ngoai, chay duoc bang file://.

   Nhung cho dang noi:

   1. JSON.parse chi bao "Unexpected token ... at position N" — mot con so
      vo dung voi nguoi doc. O day ta doi vi tri do thanh DONG va COT, va
      to do dung dong ay trong mang so dong. Do la phan lon gia tri cua
      mot trinh soan JSON.

   2. Phep so sanh khong so chuoi ma so CAY: no doc hai cay roi liet ke
      tung duong dan bi them / bot / doi. Doi thu tu khoa trong object
      khong bi tinh la khac, vi JSON khong quy dinh thu tu khoa.

   3. Cay SUA DUOC. Van ban trong #nhap van la nguon su that duy nhat:
      moi thao tac tren cay (sua gia tri, doi kieu, doi ten khoa, them,
      xoa, doi cho) la mot ham THUAN tren mo hinh theo DUONG DAN, roi ta
      viet lai #nhap bang JSON.stringify theo dung kieu thut le dang dung
      va chay lai duong lam tuoi chung. Trang thai gap/mo luu theo duong
      dan nen song sot qua moi lan ve lai. Viet vao .value thi hoan tac
      cua trinh duyet khong dung duoc nua, nen app co lich su rieng (5).

   4. To mau cu phap khi soan: textarea van lo viec GO (con tro, IME, chon
      chu, hoan tac goc), ta chi ve mot lop <pre> nam duoi no — chu cua
      textarea trong suot. Hai lop phai trung khit tung ky tu.

   5. Hoan tac THONG NHAT: moi lan MAY ghi van ban (dinh dang, nen, sap
      khoa, mo tep, sua tren cay…) deu di qua datVanBan(), ghi mot buoc co
      nhan vao lich su cua app. Nguoi go thi van dung hoan tac goc cua
      textarea cho phan vua go; het phan do thi Ctrl+Z la hoan tac cua app
      (xem "3c. Lich su" va "9. Noi day").

   Can je-chung.js nap truoc (khong gian JE + tien ich dung chung).
   Cac module sau noi chuyen voi loi nay qua cong window.JE_APP (cuoi tep).
   ===================================================================== */
(function () {
  "use strict";

  var JE = window.JE;
  if (!JE || !JE.chung) throw new Error("json-editor.js cần nạp je-chung.js trước");
  var coRieng = JE.chung.coRieng, catNgan = JE.chung.catNgan, moTaDuong = JE.chung.moTaDuong;
  var kieuCua = JE.chung.kieuCua;
  if (!JE.tomTat) throw new Error("json-editor.js cần nạp tom-tat.js trước");
  var TT = JE.tomTat;
  var xemTruoc = TT.xemTruoc, truongNoiBat = TT.truongNoiBat;
  if (!JE.viTri) throw new Error("json-editor.js cần nạp vi-tri.js trước");
  var VT = JE.viTri;

  var $ = function (s) { return document.querySelector(s); };
  var els = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var nhap    = $("#nhap");
  var soDong  = $("#so-dong");
  var den     = $("#den");
  var trangThai = $("#trang-thai");
  var viTri   = $("#vi-tri");
  var coTep   = $("#co-tep");
  var lopMau  = $("#lop-mau");
  var vungSoan = $("#vung-soan");
  var baoMau  = $("#bao-mau");
  var oSoan   = $("#o-soan");
  var nutSua  = $("#soan-sua");
  var nutXem  = $("#soan-xem");
  var nutNgat = $("#soan-ngat-dong");
  var bangLon = $("#bang-lon");

  /* Hang so cua tai lieu lon (dot J5) — CUNG MOT doi tuong voi JE_APP.hangSo,
     nen kiem thu dat lai duoc luc chay (vd NGUONG_XEM nho de thu nhanh). */
  var HS = {
    GIOI_HAN_MAU: 300 * 1024,            /* to mau KHI ngat dong (ve toan van ban); khong ngat dong: ao, toi NGUONG_XEM */
    NGUONG_XEM: 1572864,                 /* 1,5 MB ky tu: tren muc nay tu vao che do Xem (chi doc) */
    NHOM_CON: 100,                       /* cay: nhanh > 100 con thi chia nhom [0 … 99] */
    NGUONG_MO_HET: 20000,                /* "Mở hết" tren so nut nay thi hoi truoc */
    NGUONG_NHAP_LON: 2 * 1024 * 1024,    /* nhap > 2 MB ky tu: luu IndexedDB, khong luu localStorage */
    NGUONG_GHEP: 512 * 1024,             /* sua mot o tren tai lieu > 512 KB: ghep chuoi tai cho, khong viet lai ca van ban */
    DONG_DAI_TOI_DA: 5000,               /* Xem cat dong dai hon, hien "… (+N ky tu)" */
    DONG_DAI_MAU: 20000,                 /* soan ao: dong dai hon nay ve tro tron (khong to mau) */
    XEM_MAX_PX: 15000000,                /* chieu cao toi da cua khung cuon ao (qua nua thi doi ti le cuon) */
    DEBOUNCE_NHAP_LON: 1000,             /* ghi IndexedDB tre 1 s sau lan sua cuoi */
    DEBOUNCE_DOC: 180,                   /* go phim: doc() + ve cay + luu nhap tre 180 ms sau phim cuoi */
    DEBOUNCE_DOC_LON: 700,               /* ... nhung van ban > NGUONG_DEBOUNCE_LON thi 700 ms: parse + luu 1 MB (~50 ms) khong chen giua luc dang go */
    NGUONG_DEBOUNCE_LON: 400 * 1024
  };

  var duLieu = null;         /* ket qua parse gan nhat */
  var hopLe = false;         /* lan parse gan nhat co thanh cong khong — van
                                ban "null" la JSON HOP LE ma duLieu van null */
  var dongLoi = -1;
  var loiTai = -1;           /* chi so ky tu cua cho loi, de to tren lop mau */
  var vanBanDaDoc = null;    /* van ban ma doc() vua parse */
  var moHinhSan = null;      /* {s, goc}: mo hinh ma may vua viet ra van ban `s` — doc() dung thang, khong parse lai */
  /* Van ban LON o che do Xem nam NGOAI textarea: gan .value 12 MB vao textarea (du da an) mat ~1,2 s (do that), nen o
     Xem ta giu chuoi trong bien nay, textarea de trong. Bat bien: vbNgoai !== null  <=>  dang o Xem VA van ban > NGUONG_XEM.
     Moi cho doc van ban di qua layVb(), moi cho ghi di qua datVb(). Roi khoi Xem: datCheDoSoan dua van ban lai vao textarea. */
  var vbNgoai = null;
  var oHien = "soan";        /* tab dang mo */
  var chuTrangThai = "";     /* dong trang thai doc() vua dat (de tra lai sau thong bao tam) */
  var tabDuLieuGan = "cay";  /* tab du lieu (cay / soan) nguoi dung vua dung — denDuong(tab:"tu-dong") */

  function layVb() { return vbNgoai !== null ? vbNgoai : nhap.value; }

  /** Ghi van ban (textarea hoac, o che do Xem voi van ban lon, bien vbNgoai). */
  function datVb(chu) {
    chu = String(chu);
    if (cheDoSoan === "xem" && chu.length > HS.NGUONG_XEM) {
      vbNgoai = chu;
      if (nhap.value !== "") nhap.value = "";
    } else {
      vbNgoai = null;
      nhap.value = chu;
    }
  }

  /* --- su kien cho cac module ngoai (JE_APP.dangKy) --- */
  var nguoiNghe = Object.create(null);
  function dangKy(suKien, ham) {
    var ds = nguoiNghe[suKien] || (nguoiNghe[suKien] = []);
    ds.push(ham);
    return function huy() {
      var i = ds.indexOf(ham);
      if (i >= 0) ds.splice(i, 1);
    };
  }
  /** Goi moi nguoi nghe; mot nguoi nem loi khong chan nguoi khac — loi
      duoc nem lai o luot sau de van hien ra console (khong nuot loi). */
  function phat(suKien, giaTri) {
    var ds = nguoiNghe[suKien];
    if (!ds || !ds.length) return;
    ds.slice().forEach(function (h) {
      try { h(giaTri); } catch (e) { setTimeout(function () { throw e; }, 0); }
    });
  }

  /* ==================================================================
     1. Doc va bao loi
     ================================================================== */

  /** Doi chi so ky tu thanh (dong, cot), dem tu 1. */
  function dongCot(chuoi, viTriKyTu) {
    var dong = 1, cot = 1;
    for (var i = 0; i < viTriKyTu && i < chuoi.length; i++) {
      if (chuoi[i] === "\n") { dong++; cot = 1; } else cot++;
    }
    return { dong: dong, cot: cot };
  }

  /** Moc vi tri ra khoi thong bao cua JSON.parse.

      Trinh duyet moi noi mot kieu:
        V8      "Unexpected token } in JSON at position 42"
        V8 moi  "Expected ',' ... at position 42 (line 3 column 5)"
        SpiderMonkey "JSON.parse: expected ... at line 3 column 5"
      Nen phai thu vai mau, va neu khong ra thi chiu — van hien thong bao
      goc chu khong doan bua mot con so sai. */
  function viTriLoi(loi, chuoi) {
    var s = String(loi && loi.message || loi);

    /* Dang co vi tri ro rang — dung luon, khong phai doan. */
    var m = s.match(/at position (\d+)/i);
    if (m) return dongCot(chuoi, parseInt(m[1], 10));
    m = s.match(/line (\d+) column (\d+)/i);
    if (m) return { dong: parseInt(m[1], 10), cot: parseInt(m[2], 10) };

    /* Het dau vao giua chung -> loi nam o cuoi. */
    if (/unexpected end of (json|data|input)/i.test(s)) {
      return dongCot(chuoi, chuoi.length);
    }

    /* V8 moi, chuoi ngan: KHONG co vi tri nao ca, no nhung mot DOAN TRICH
       cua chinh nguon:

         Unexpected token '}', ..."1,
  "b": }
}" is not valid JSON

       Nen phai tu di tim lai doan trich do trong nguon. Doan trich co the
       chua ca dau nhay, nen phai neo regex vao DUOI chuoi chu khong the
       cat o dau nhay dau tien.

       Day la PHONG DOAN, khong phai vi tri chinh xac: neu doan trich
       xuat hien nhieu cho thi ta lay cho dau tien. Van tot hon nhieu so
       voi khong chi ra duoc dong nao. */
    /* [\s\S] chu khong phai . — ky tu gay loi CO THE la chinh dau xuong
       dong, va luc do `.` khong khop. */
    m = s.match(/token ['"]([\s\S])['"],\s*(\.\.\.)?"([\s\S]*)"(\.\.\.)?\s*is not valid JSON/);
    if (m) {
      var tok = m[1], trich = m[3];
      var k = chuoi.indexOf(trich);
      if (k >= 0) {
        /* V8 cat doan trich CAN GIUA cho loi, nen trong nhieu lan xuat
           hien cua ky tu gay loi, lay cai GAN GIUA doan trich nhat.
           (Lay cai cuoi cung la sai: voi `..."1,\n  "b": }\n}"` thi dau }
           cuoi nam o dong sau, khong phai dong loi.) */
        var giua = trich.length / 2, j = -1, tot = Infinity;
        for (var q = trich.indexOf(tok); q >= 0; q = trich.indexOf(tok, q + 1)) {
          var d = Math.abs(q - giua);
          if (d < tot) { tot = d; j = q; }
        }
        if (j >= 0) return dongCot(chuoi, k + j);
        return dongCot(chuoi, k);
      }
      /* Khong tim lai duoc doan trich (bi cat ca hai dau) — thu tim thang
         ky tu gay loi. */
      var i2 = chuoi.indexOf(tok);
      if (i2 >= 0) return dongCot(chuoi, i2);
    }
    return null;
  }

  /** Nguoc lai dongCot: (dong, cot) dem tu 1 -> chi so ky tu. */
  function chiSoTu(chuoi, dong, cot) {
    var i = 0;
    for (var d = 1; d < dong; d++) {
      var k = chuoi.indexOf("\n", i);
      if (k < 0) return chuoi.length;
      i = k + 1;
    }
    return Math.min(chuoi.length, i + Math.max(0, cot - 1));
  }

  /** Ky tu se to do tren lop mau: chinh cho loi neu no khong phai khoang
      trang; khong thi ky tu "that" gan nhat phia sau, roi phia truoc
      (loi "het dau vao" chi vao CUOI van ban — to ky tu cuoi cung). */
  function viTriDanhDau(chuoi, i) {
    var n = chuoi.length, j;
    for (j = Math.max(0, i); j < n; j++) if (!laTrang(chuoi.charCodeAt(j))) return j;
    for (j = Math.min(i, n) - 1; j >= 0; j--) if (!laTrang(chuoi.charCodeAt(j))) return j;
    return -1;
  }

  function datTrangThai(chu) {
    chuTrangThai = chu;
    trangThai.textContent = chu;
  }

  function doc() {
    var s = layVb(), kq;
    vanBanDaDoc = s;
    loiTai = -1;
    if (!s.trim()) {
      duLieu = null; hopLe = false; dongLoi = -1;
      den.className = "den";
      datTrangThai("Chưa có nội dung");
      kq = false;
    } else {
      try {
        /* Mo hinh vua ghi (apDungGoc) khop van ban nay: dung lai, khong parse lai (10 MB: ~100 ms) va giu dinh danh de dem() dung cache. */
        if (moHinhSan && moHinhSan.s === s) duLieu = moHinhSan.goc; else duLieu = JSON.parse(s);
        moHinhSan = null;
        hopLe = true;
        dongLoi = -1;
        den.className = "den ok";
        datTrangThai("JSON hợp lệ · " + moTaNgan(duLieu));
        kq = true;
      } catch (e) {
        duLieu = null; hopLe = false;
        var vt = viTriLoi(e, s);
        dongLoi = vt ? vt.dong : -1;
        loiTai = vt ? viTriDanhDau(s, chiSoTu(s, vt.dong, vt.cot)) : -1;
        den.className = "den loi";
        datTrangThai(vt
          ? ("Lỗi ở dòng " + vt.dong + ", cột " + vt.cot + " — " + gonLoi(e))
          : ("Lỗi — " + gonLoi(e)));
        kq = false;
      }
    }
    henVeAo();                      /* so dong ao + lop to mau ao: khung hinh ke tiep, KHONG trong su kien input */
    tuChinhCheDo();
    phat("doi-du-lieu", { hopLe: hopLe, vanBan: s });
    capNhatBangLon();               /* SAU phat: o Xem da lam moi (so dong) khi bang doc xemApi.soDong() */
    return kq;
  }

  /** Mo hinh khop van ban dang co (doc lai neu nguoi dung vua go). */
  function dongBoDoc() {
    if (layVb() !== vanBanDaDoc) doc();
    return hopLe;
  }

  function gonLoi(e) {
    return String(e && e.message || e)
      .replace(/^JSON\.parse:\s*/, "")
      .replace(/\s*in JSON at position \d+.*$/, "")
      .replace(/\s*at position \d+.*$/, "");
  }

  function moTaNgan(v) {
    if (Array.isArray(v)) return "mảng " + v.length + " phần tử";
    if (v && typeof v === "object") return "object " + Object.keys(v).length + " khoá";
    return kieuCua(v);
  }

  /* ---------------------------------------------------------- số dòng ảo */
  /* So dong AO (dot J5): khung cao dung bang so dong x do cao dong, chi ~100
     hang nam trong cua so quanh vung nhin thay. Truoc day moi dong mot the
     DOM — dan 1 MB treo 2 giay (65 000 the), 10 MB treo 31 giay. Do cao dong
     la SO NGUYEN (21px, xem kieu.css) nen hang i nam dung o i x 21px, khop
     textarea o moi do cuon. Dem dong KHONG nam trong su kien `input`: lam o
     khung hinh ke tiep (henVeAo), mot lan cho ca so dong va lop to mau. */
  var DEM_CUA_SO = 40;           /* hang dem tren / duoi vung nhin thay */
  var LE_CUA_SO = 12;            /* gan met cua cua so thi ve lai */
  var sdKhung = null, sdCua = null;
  var sdVe = { tu: -1, den: -1, n: -1, loi: -2, lh: 0 };
  var chiSoVb = null, chiSoS = null;
  var doCaoDong = 21, doCaoDaDo = false, lePadTren = 12;

  /** Chi so dau dong cua van ban `s` (nho theo CHUOI: doi van ban moi tinh lai). */
  function chiSoCua(s) {
    if (chiSoS !== s || !chiSoVb) { chiSoVb = VT.chiSoDong(s); chiSoS = s; }
    return chiSoVb;
  }

  /** Do cao dong + le tren cua textarea (do tu CSS, mot lan; 21 va 12 khi khong do duoc). */
  function doKichThuocDong() {
    if (doCaoDaDo) return;
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(nhap) : null;
      var lh = cs ? parseFloat(cs.lineHeight) : NaN, pt = cs ? parseFloat(cs.paddingTop) : NaN;
      if (lh > 0) { doCaoDong = lh; doCaoDaDo = true; }
      if (pt >= 0) lePadTren = pt;
    } catch (e) { /* giu mac dinh */ }
  }

  /** Hang nhin thay [dau, cuoi) cua textarea (da tru do dem), kep trong [0, n]. */
  function cuaSoDong(n) {
    doKichThuocDong();
    var cao = nhap.clientHeight || 600, st = nhap.scrollTop || 0, lh = doCaoDong;
    var dau = Math.floor((st - lePadTren) / lh), cuoi = Math.ceil((st + cao - lePadTren) / lh);
    return { thay: [Math.max(0, dau), Math.min(n, cuoi)],
             tu: Math.max(0, dau - DEM_CUA_SO), den: Math.min(n, cuoi + DEM_CUA_SO) };
  }

  function veSoDong(chiSo) {
    var n = chiSo.length, cs = cuaSoDong(n), lh = doCaoDong;
    if (!sdKhung || sdKhung.parentNode !== soDong) {
      soDong.textContent = "";
      sdKhung = document.createElement("div"); sdKhung.className = "sd-khung";
      sdCua = document.createElement("div"); sdCua.className = "sd-cua";
      sdKhung.appendChild(sdCua); soDong.appendChild(sdKhung);
      sdVe = { tu: -1, den: -1, n: -1, loi: -2, lh: 0 };
    }
    if (n !== sdVe.n || lh !== sdVe.lh) sdKhung.style.height = (n * lh) + "px";
    var thayDoi = n !== sdVe.n || dongLoi !== sdVe.loi || lh !== sdVe.lh ||
                  cs.thay[0] < sdVe.tu + LE_CUA_SO && sdVe.tu > 0 || cs.thay[1] > sdVe.den - LE_CUA_SO && sdVe.den < n ||
                  cs.thay[0] < sdVe.tu || cs.thay[1] > sdVe.den;
    if (thayDoi) {
      var html = "", i;
      for (i = cs.tu; i < cs.den; i++) html += (i + 1 === dongLoi ? '<div class="loi">' : "<div>") + (i + 1) + "</div>";
      sdCua.style.top = (cs.tu * lh) + "px";
      sdCua.setAttribute("data-tu", String(cs.tu));
      sdCua.innerHTML = html;
      sdVe = { tu: cs.tu, den: cs.den, n: n, loi: dongLoi, lh: lh };
    }
    soDong.scrollTop = nhap.scrollTop;
  }

  var KHOI = 64;                  /* so hang moi khoi cua lop to mau KHI ngat dong (duong cu) */

  /* Chay o moi lan nha phim: dem dau xuong dong bang indexOf (nhanh hon
     nhieu so voi duyet tung ky tu nhu dongCot khi van ban dai). */
  function capNhatViTri() {
    if (cheDoSoan === "xem") return;
    var s = layVb(), k = Math.min(nhap.selectionStart || 0, s.length), dong = 1;
    for (var i = s.indexOf("\n"); i >= 0 && i < k; i = s.indexOf("\n", i + 1)) dong++;
    var p = k > 0 ? s.lastIndexOf("\n", k - 1) : -1;
    viTri.textContent = "dòng " + dong + ", cột " + (k - p);
    phat("doi-chon", { bd: k, kt: nhap.selectionEnd || k, dong: dong, cot: k - p });
  }

  /* ==================================================================
     2. Cac phep bien doi
     ================================================================== */
  /** Loi nem ra tu mot phep bien doi -> cau doc duoc. Du lieu long qua sau
      (JSON.parse doc duoc 20 000 cap, JSON.stringify thi tran ngan xep) la
      ca hay gap nhat. */
  function moTaLoiNem(e) {
    var ten = e && e.name, chu = String(e && e.message || e);
    if (ten === "RangeError" || /call stack|too much recursion/i.test(chu)) {
      return "dữ liệu lồng quá sâu, trình duyệt không xử lý nổi (" + chu + ")";
    }
    return chu;
  }

  /** Chay `ham(duLieu)` -> van ban moi, roi ghi qua datVanBan (MOT buoc
      hoan tac co nhan). JSON dang loi: doc() da bao loi, khong lam gi. */
  function bienDoi(nhan, ham, giuMoHinh) {
    var lam = function () {
      if (!doc()) return false;
      var sMoi, goc = duLieu;
      try { sMoi = ham(duLieu); }
      catch (e) { bao("Không " + nhan.toLowerCase() + " được — " + moTaLoiNem(e)); return false; }
      datVanBan(sMoi, giuMoHinh ? { nhan: nhan, goc: goc } : { nhan: nhan });
      return true;
    };
    return chayCoBao(nhan.toLowerCase(), lam);
  }

  /** Dinh dang / Nen. Van ban LON (> 1 MB) chay trong WORKER (parse + stringify 10 MB mat ~0,25 s va treo ca trang
      neu chay o luong chinh): chan trang hien "Đang …", trang van cuon / bam duoc. Worker khong dung duoc, bi huy,
      het gio, hay van ban hong (can thong bao loi co dong / cot) thi roi ve duong dong bo cu — cho ra dung thong bao.
      Neu trong luc cho nguoi dung doi van ban thi bo ket qua (khong dap len thay doi moi). */
  function bienDoiNen(nhan, thut, hamDongBo) {
    var s0 = layVb();
    if (s0.length <= BAN_NGUONG || !JE.chayNen || !JE.chayNen.coWorker || !JE.chayNen.coWorker()) {
      return bienDoi(nhan, hamDongBo, true);
    }
    datTrangThai("Đang " + nhan.toLowerCase() + " " + coChu(s0.length) + "…");
    den.className = "den";
    document.body.classList.add("dang-xu-ly");
    JE.chayNen.chay("dinh-dang", { du: s0 }, { thut: thut }, 60000).then(function (r) {
      document.body.classList.remove("dang-xu-ly");
      if (layVb() !== s0) {                                  /* da sua / mo tep khac trong luc cho */
        thongBao(nhan + " bị bỏ — văn bản đã đổi trong lúc chờ");
        return;
      }
      if (r && r.kq && typeof r.kq.vanBan === "string") {
        datVanBan(r.kq.vanBan, { nhan: nhan });
        phat("dinh-dang-nen", { nhan: nhan, noi: "worker", ms: r.kq.thoiGianMs });
        return;
      }
      bienDoi(nhan, hamDongBo, true);                        /* worker khong cho duoc ket qua: duong dong bo */
    });
    return true;
  }

  function dinhDang(thut) {
    var t = thut === undefined ? 2 : thut;
    return bienDoiNen("Định dạng", t, function (d) { return JSON.stringify(d, null, t); });
  }

  function nen() {
    return bienDoiNen("Nén", 0, function (d) { return JSON.stringify(d); });
  }

  /** Sap khoa theo bang chu cai o moi cap. Mang GIU NGUYEN thu tu — thu tu
      phan tu mang la co y nghia, doi la sai du lieu.
      - Gan khoa bang datKhoa: khoa "__proto__" la khoa THAT (gan thuong thi
        no doi nguyen mau cua object va bien mat khoi JSON).
      - Lap bang ngan xep, khong de quy: chiu duoc du lieu long rat sau. */
  function sapKhoa(v) {
    if (!laNhanh(v)) return v;
    var rong = function (x) { return Array.isArray(x) ? [] : {}; };
    var ra = rong(v), ngan = [v, ra], i, x, c;
    while (ngan.length) {
      var dich = ngan.pop(), nguon = ngan.pop();
      if (Array.isArray(nguon)) {
        for (i = 0; i < nguon.length; i++) {
          x = nguon[i];
          if (laNhanh(x)) { c = rong(x); dich.push(c); ngan.push(x, c); }
          else dich.push(x);
        }
      } else {
        var ks = Object.keys(nguon).sort();
        for (i = 0; i < ks.length; i++) {
          x = nguon[ks[i]];
          if (laNhanh(x)) { c = rong(x); datKhoa(dich, ks[i], c); ngan.push(x, c); }
          else datKhoa(dich, ks[i], x);
        }
      }
    }
    return ra;
  }

  /** Van ban sau khi sap khoa: GIU kieu thut le (2 / 4 / tab / nen) va dau
      xuong dong cuoi cua van ban cu — truoc day luon ep thut 2. */
  function sapKhoaVanBan(v, cu) {
    return vietTheoKieu(sapKhoa(v), cu);
  }

  /** Nhieu API tra ve JSON DA BI DONG GOI THANH CHUOI. Nut nay go mot lop. */
  function thoatChuoi() {
    var s = layVb().trim();
    if (!s) return;
    var thu;
    try {
      thu = JSON.parse(s);
    } catch (e) {
      /* Chua phai JSON hop le — co the la chuoi thieu ngoac ngoai. */
      try { thu = JSON.parse('"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'); }
      catch (e2) { bao("Không gỡ được — nội dung không phải chuỗi JSON hợp lệ"); return; }
    }
    if (typeof thu !== "string") {
      bao("Nội dung không phải một chuỗi — không có lớp nào để gỡ");
      return;
    }
    datVanBan(thu, { nhan: "Thoát chuỗi" });
  }

  function bao(chu) {
    trangThai.textContent = chu;
    den.className = "den loi";
  }

  /** Thong bao tam (vd "Đã hoàn tác: Định dạng"): tab Cay hien o dong bao
      cua cay; tab khac hien o chan trang roi tra lai trang thai cu. */
  var henThongBao = null;
  function thongBao(chu) {
    if (oHien === "cay" && cayBao) { thongBaoCay(chu); return; }
    trangThai.textContent = chu;
    clearTimeout(henThongBao);
    henThongBao = setTimeout(function () {
      if (trangThai.textContent === chu) trangThai.textContent = chuTrangThai;
    }, 1600);
  }

  function sauKhiDoi() {
    doc();
    veCay();
    luuNhap();
    henToMau();
  }

  /* ==================================================================
     3. Cay — xem va SUA truc tiep

     Moi nut mang DUONG DAN cua no: mang cac khoa (chuoi) / chi so (so)
     tinh tu goc. Trang thai gap/mo, nut dang chon va vi tri cuon deu giu
     theo duong dan, nen khong mat khi cay bi ve lai sau moi lan sua.

     Nhanh dang gap thi CHUA dung con — chi dung khi mo ra lan dau. Tai
     lieu lon vi the van mo nhanh: chi ve phan dang nhin thay.
     ================================================================== */
  var cayEl = $("#cay");
  var cayBao = $("#cay-bao");
  var trangThaiMo = Object.create(null);   /* khoaDuong -> true (mo) / false (gap) */
  var cheDoMo = "sau";                     /* mac dinh: "sau" (gap tu cap 2), "mo", "dong", "cap" (mo toi capMo) */
  var capMo = 3;                           /* cap cho che do "cap" ("Mở tới cấp 3") */
  var bangNut = Object.create(null);       /* khoaDuong -> phan tu .n cua lan ve nay */
  var hangChon = "[]";                     /* nut dang chon (roving tabindex) */
  var cayBan = true;                       /* phai ve lai khi tab Cay hien ra */
  var cuonCay = { top: 0, left: 0 };
  var hienKieu = true;
  var hienKichThuoc = true;                /* hop kiem "Kích thước" (nho o localStorage) */
  /* Ngan sach dem kich thuoc cho metadata cua nhanh gap: tong so nut duoc
     duyet moi lan ve (veCay / mo mot nhanh: `ve`) — het thi cac hang con lai
     chua co kich thuoc, den khi re chuot / focus vao tung hang (moi hang
     toi da `hang` nut, thu mot lan). Doi tuong song: kiem thu hep lai duoc
     qua JE_APP.hangSo.NGAN_SACH. */
  var NGAN_SACH = { ve: 250000, hang: 5000000 };
  var nganVe = { con: NGAN_SACH.ve };
  var dangSua = null;                      /* phien sua dang mo, neu co */
  var nhanChuot = false;                   /* dang bam chuot trong cay khi o sua mo */

  function khoaDuong(d) { return JSON.stringify(d); }
  function laNhanh(v) { return v !== null && typeof v === "object"; }

  function laMo(duong) {
    var k = khoaDuong(duong);
    if (k in trangThaiMo) return trangThaiMo[k];
    if (cheDoMo === "mo") return true;
    if (cheDoMo === "dong") return false;
    if (cheDoMo === "cap") return duong.length < capMo;
    return duong.length < 2;
  }

  /* ---------------------------------------------- chia nhom nhanh lon
     Nhanh co > HS.NHOM_CON (100) con khong dung het con: chia thanh cac
     NUT NHOM [0 … 99], [100 … 199] gap san, dung con khi mo nhom. Qua
     NHOM_CON nhom thi chia them mot cap (nhom cua nhom: 100 x 100 phan tu…)
     de moi cap chi co toi da NHOM_CON hang. Nut nhom la treeitem that
     (aria-level, mui ten di xuyen qua). Trang thai mo cua nhom luu cung
     trangThaiMo, khoa = khoaDuong(cha) + "#" + bd + ":" + kt. */
  var NHOM_KHOA_RE = /^\d+:\d+$/;

  /** Chia khoang [bd, kt) thanh cac nhom {bd, kt} (kt khong tinh); null neu khoang <= co (khong can chia). */
  function chiaNhom(bd, kt, co) {
    co = co || HS.NHOM_CON;
    var n = kt - bd;
    if (!(n > co)) return null;
    var buoc = co;
    while (Math.ceil(n / buoc) > co) buoc *= co;
    var ra = [];
    for (var i = bd; i < kt; i += buoc) ra.push({ bd: i, kt: Math.min(kt, i + buoc) });
    return ra;
  }

  /** Cac nhom long nhau chua phan tu thu `i` cua nhanh co `soCon` con, tu ngoai vao trong ([] khi khong chia nhom). */
  function chuoiNhom(i, soCon, co) {
    var ra = [], bd = 0, kt = soCon, g;
    while ((g = chiaNhom(bd, kt, co))) {
      var buoc = g[0].kt - g[0].bd, o = g[Math.min(g.length - 1, Math.floor((i - bd) / buoc))];
      ra.push(o); bd = o.bd; kt = o.kt;
    }
    return ra;
  }

  function khoaNhom(duongCha, bd, kt) { return khoaDuong(duongCha) + "#" + bd + ":" + kt; }

  /** Khoa nhom -> {duong: khoaDuong cua cha, hau: "#bd:kt"} hoac null neu khong phai khoa nhom. */
  function tachKhoaNhom(k) {
    var h = k.lastIndexOf("]#");
    if (h < 0 || !NHOM_KHOA_RE.test(k.slice(h + 2))) return null;
    return { duong: k.slice(0, h + 1), hau: k.slice(h + 1) };
  }

  function soConCua(v) { return Array.isArray(v) ? v.length : Object.keys(v).length; }

  function laMoNhom(khoa) {
    if (khoa in trangThaiMo) return trangThaiMo[khoa];
    return cheDoMo === "mo";
  }

  function nutLa(v) {
    var lop = v === null ? "gt-null"
            : typeof v === "string" ? "gt-chuoi"
            : typeof v === "number" ? "gt-so"
            : typeof v === "boolean" ? "gt-bool" : "gt-null";
    var chu = typeof v === "string" ? JSON.stringify(v) : String(v);
    if (chu.length > 200) chu = chu.slice(0, 200) + "…";
    return '<span class="gt ' + lop + '" data-hd="sua" title="Bấm để sửa (Enter)">' +
      thoat(chu) + "</span>";
  }

  function thoat(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function htmlKhoa(khoa) {
    if (typeof khoa === "string") {
      return '<span class="khoa" data-hd="doi-ten" title="Bấm để đổi tên khoá (F2)">' +
        thoat(khoa) + '</span><span class="dau-2cham">:</span>';
    }
    if (typeof khoa === "number") {
      return '<span class="khoa chi-so">' + khoa + '</span><span class="dau-2cham">:</span>';
    }
    return "";
  }

  /** `meta`: kq cua taoMeta (nhanh dang gap) hoac null (nhanh dang mo). */
  function htmlGiaTri(v, meta) {
    if (!laNhanh(v)) {
      return nutLa(v) + (hienKieu
        ? '<span class="kieu" data-hd="sua" title="Bấm để sửa hoặc đổi kiểu">' + kieuCua(v) + "</span>"
        : "");
    }
    var mang = Array.isArray(v), sl = mang ? v.length : Object.keys(v).length;
    return '<span class="dau-2cham ngoac" data-hd="mo-dong">' + (mang ? "[ ]" : "{ }") + "</span>" +
      '<span class="dem" data-hd="mo-dong">' + TT.soCoDau(sl) + (mang ? " phần tử" : " khoá") + "</span>" +
      (meta ? meta.html : "");
  }

  /** Metadata cua nhanh dang GAP: kich thuoc khi nen, kieu phan tu (mang),
      dong xem truoc (khoa noi bat + vai khoa), kem tooltip day du (duong
      dan, sau, so nut…) va phan them cho ten truy cap. Khong do kich thuoc
      khi o "Kích thước" tat. `ngan` het thi `dayDu` = false (chua co kich
      thuoc — capNhatMeta se dem lai khi re chuot / focus). Moi chuoi tu du
      lieu di qua thoat() (HTML) hoac duoc gan bang thuoc tinh DOM (title,
      aria-label), khong bao gio noi vao HTML. */
  function taoMeta(v, duong, ngan) {
    var t = TT.tomTatNut(v, { byte: hienKichThuoc, ngan: ngan });
    var h = "";
    if (t.byte !== null) {
      h += '<span class="dem-byte" data-hd="mo-dong">· ' + thoat(TT.dinhDangByte(t.byte)) + "</span>";
    }
    if (t.kieuCon && hienKieu) h += '<span class="kieu-con" data-hd="mo-dong">' + thoat(t.kieuCon) + "</span>";
    if (t.dong) h += '<span class="xem-truoc" data-hd="mo-dong">' + thoat(t.dong) + "</span>";
    return {
      html: h, dayDu: !hienKichThuoc || t.daTinh,
      title: TT.moTaNut(t, moTaDuong(duong)), aria: TT.moTaAria(t)
    };
  }

  /** Gan metadata (da co `meta`) vao hang `n` vua dung xong. `daThu`: lan do
      rieng hang nay (re chuot / focus / gap) — van het ngan sach thi dung han,
      khong thu lai o moi lan re chuot. */
  function ganMeta(n, meta, daThu) {
    /* 2: day du; 1: chua co kich thuoc (se thu khi re chuot / focus); 3: da thu, qua lon */
    n._meta = meta.dayDu ? 2 : daThu ? 3 : 1;
    n._dong.title = meta.title + (n._meta === 3 ? " · quá lớn để đo kích thước ngay" : "");
    n.setAttribute("aria-label", n._nhanGoc + (meta.aria ? ", " + meta.aria : ""));
  }

  /** Nhanh vua gap (hoac hang chua co kich thuoc khi re chuot / focus):
      dung metadata cho nhanh nay. Chi tinh khi can — nhanh dang mo khong
      hien metadata nen khong ton gi. */
  function capNhatMeta(n, ngan) {
    if (!n || !n._con || n._nhom || n._meta >= 2) return;
    var dong = n._dong, tt = dong.querySelector ? dong.querySelector(".thao-tac") : null;
    if (!tt || dong.classList.contains("dang-sua")) return;     /* dang sua tai cho */
    var meta = taoMeta(n._v, n._duong, ngan || { con: NGAN_SACH.hang });
    var cu = dong.querySelectorAll(".dem-byte, .kieu-con, .xem-truoc");
    for (var i = 0; i < cu.length; i++) cu[i].parentNode.removeChild(cu[i]);
    tt.insertAdjacentHTML("beforebegin", meta.html);
    ganMeta(n, meta, true);
  }

  function nutTT(hd, kyHieu, nhan, tat) {
    return '<button type="button" class="nut-tt' + (hd === "xoa" ? " nut-xoa" : "") +
      '" data-hd="' + hd + '" tabindex="-1" aria-label="' + nhan + '" title="' + nhan + '"' +
      (tat ? " disabled" : "") + ">" + kyHieu + "</button>";
  }

  function htmlThaoTac(khoa, v, duong, soAnhEm) {
    var h = '<span class="thao-tac">';
    if (laNhanh(v)) {
      h += nutTT("them", "+", Array.isArray(v) ? "Thêm phần tử vào cuối mảng (Insert)" : "Thêm khoá mới (Insert)");
    }
    h += nutTT("sua", "✎", laNhanh(v) ? "Đổi kiểu" : "Sửa giá trị (Enter)");
    if (typeof khoa === "number") {
      h += nutTT("len", "↑", "Chuyển lên (Alt+↑)", khoa === 0);
      h += nutTT("xuong", "↓", "Chuyển xuống (Alt+↓)", khoa >= soAnhEm - 1);
    }
    if (duong.length) h += nutTT("xoa", "✕", "Xoá nút này (Delete)");
    return h + "</span>";
  }

  /** Ten doc cho trinh doc man hinh — treeitem chua ca nhanh con, nen neu
      de trinh duyet tu tinh ten thi no doc het moi thu ben trong. */
  function nhanNut(khoa, v) {
    var dau = khoa === null ? "gốc" : typeof khoa === "number" ? "phần tử " + khoa : "khoá " + khoa;
    var gt;
    if (Array.isArray(v)) gt = "mảng " + v.length + " phần tử";
    else if (laNhanh(v)) gt = "object " + Object.keys(v).length + " khoá";
    else gt = catNgan(typeof v === "string" ? JSON.stringify(v) : String(v), 80);
    return dau + ": " + gt;
  }

  function veNut(khoa, v, duong, soAnhEm, cap) {
    var kd = khoaDuong(duong);
    cap = cap || duong.length + 1;
    var coCon = laNhanh(v), mo = coCon && laMo(duong);
    var meta = coCon && !mo ? taoMeta(v, duong, nganVe) : null;   /* chi nhanh dang gap */
    var n = document.createElement("div");
    n.className = "n";
    n.setAttribute("role", "treeitem");
    n.setAttribute("aria-level", String(cap));
    n._cap = cap;
    n._nhanGoc = nhanNut(khoa, v);
    n.setAttribute("aria-label", n._nhanGoc);
    n.setAttribute("data-p", kd);
    n.tabIndex = -1;
    n._duong = duong; n._v = v; n._khoa = khoa; n._soAnhEm = soAnhEm;
    bangNut[kd] = n;

    var dong = document.createElement("div");
    dong.className = "dong";
    dong.innerHTML = htmlKhoa(khoa) + htmlGiaTri(v, meta) + htmlThaoTac(khoa, v, duong, soAnhEm);
    n._dong = dong;
    n._meta = 0;
    n.appendChild(dong);
    if (meta) ganMeta(n, meta);

    if (coCon) {
      var nut = document.createElement("span");
      nut.className = "mo-dong";
      nut.setAttribute("aria-hidden", "true");
      nut.setAttribute("data-hd", "mo-dong");
      nut.textContent = mo ? "−" : "+";
      n._nutMo = nut;
      n.appendChild(nut);

      var con = document.createElement("div");
      con.className = "con";
      con.setAttribute("role", "group");
      n._con = con;
      n.appendChild(con);
      n.setAttribute("aria-expanded", mo ? "true" : "false");
      if (mo) veCon(n); else n.classList.add("dong-lai");
    }
    if (huyHieuCay) capNhatHuyHieu(n);
    return n;
  }

  /* ---------------------------------------------- huy hieu loi (schema…)
     ui-schema.js dua vao Map(khoaDuong -> {a: [thong bao cua CHINH nut nay],
     b: so loi o nut con chau}). Hang co loi: vien do ben trai + "⛔ N"
     (nhanh dang GAP gom ca loi ben trong). Cap nhat TAI CHO — khong ve lai
     ca cay, de khong pha o dang sua. Chu tu du lieu chi gan bang textContent /
     title, khong qua innerHTML. */
  var huyHieuCay = null;

  function capNhatHuyHieu(n) {
    var kd = n.getAttribute("data-p"), h = huyHieuCay ? huyHieuCay.get(kd) : null;
    var mo = !!n._con && !n.classList.contains("dong-lai");
    var tong = h ? h.a.length + (n._con && !mo ? h.b : 0) : 0;
    var cu = n._huyHieu || null;
    if (!tong) {
      if (cu && cu.parentNode) cu.parentNode.removeChild(cu);
      n._huyHieu = null;
      n.classList.remove("co-loi-schema");
      return;
    }
    if (!cu) {
      cu = document.createElement("span");
      cu.className = "huy-hieu-loi";
      var tt = n._dong.querySelector ? n._dong.querySelector(".thao-tac") : null;
      if (tt) n._dong.insertBefore(cu, tt); else n._dong.appendChild(cu);
      n._huyHieu = cu;
    }
    cu.textContent = "⛔ " + tong;
    var dong = h.a.slice(0, 5);
    if (h.a.length > 5) dong.push("… và " + (h.a.length - 5) + " lỗi nữa ở đây");
    if (h.b && n._con) dong.push("+ " + h.b + " lỗi ở bên trong");
    cu.title = dong.join("\n");
    cu.setAttribute("aria-label", tong + " lỗi schema");
    n.classList.toggle("co-loi-schema", h.a.length > 0);
  }

  /** Doi bang huy hieu (null = xoa het) va cap nhat cac hang DANG HIEN co lien quan. */
  function datHuyHieuCay(map) {
    var cu = huyHieuCay;
    huyHieuCay = map && map.size ? map : null;
    var khoa = new Set();
    if (cu) cu.forEach(function (x, k) { khoa.add(k); });
    if (huyHieuCay) huyHieuCay.forEach(function (x, k) { khoa.add(k); });
    khoa.forEach(function (k) { var n = bangNut[k]; if (n) capNhatHuyHieu(n); });
  }

  /** Dung cac hang con cua nut that `n`: nhanh > NHOM_CON con thi dung cac NUT NHOM (gap san) thay vi tung con. */
  function veCon(n) {
    var v = n._v, ra = document.createDocumentFragment(), i;
    var sl = soConCua(v), nh = chiaNhom(0, sl), cap = (n._cap || n._duong.length + 1) + 1;
    if (nh) {
      for (i = 0; i < nh.length; i++) ra.appendChild(veNhom(n, nh[i].bd, nh[i].kt, cap));
    } else {
      veHangCon(n, 0, sl, cap, ra);
    }
    n._con.appendChild(ra);
    n._daVe = true;
  }

  /** Cac nut con that [bd, kt) cua nut that `cha`, them vao `ra`. */
  function veHangCon(cha, bd, kt, cap, ra) {
    var v = cha._v, duong = cha._duong, sl = soConCua(v), i;
    if (Array.isArray(v)) {
      for (i = bd; i < kt; i++) ra.appendChild(veNut(i, v[i], duong.concat([i]), sl, cap));
    } else {
      var ks = cha._ks || (cha._ks = Object.keys(v));
      for (i = bd; i < kt; i++) ra.appendChild(veNut(ks[i], v[ks[i]], duong.concat([ks[i]]), sl, cap));
    }
  }

  /** Nut NHOM [bd … kt-1] cua nut that `cha`: treeitem gap san, dung con (hoac nhom con) khi mo. */
  function veNhom(cha, bd, kt, cap) {
    var khoa = khoaNhom(cha._duong, bd, kt), mo = laMoNhom(khoa), mang = Array.isArray(cha._v);
    var n = document.createElement("div");
    n.className = "n nhom";
    n.setAttribute("role", "treeitem");
    n.setAttribute("aria-level", String(cap));
    n.setAttribute("data-p", khoa);
    n.tabIndex = -1;
    n._nhom = { bd: bd, kt: kt };
    n._cha = cha; n._duong = cha._duong; n._v = cha._v; n._khoa = cha._khoa; n._cap = cap;
    n._nhanGoc = (mang ? "nhóm phần tử " + bd + " đến " + (kt - 1) : "nhóm khoá " + (bd + 1) + " đến " + kt) +
      " (" + (kt - bd) + (mang ? " phần tử" : " khoá") + ")";
    n.setAttribute("aria-label", n._nhanGoc);
    bangNut[khoa] = n;
    var nhan = mang ? "[" + bd + " … " + (kt - 1) + "]" : "khoá " + (bd + 1) + "–" + kt;
    var dong = document.createElement("div");
    dong.className = "dong";
    dong.innerHTML = '<span class="nhom-nhan" data-hd="mo-dong">' + thoat(nhan) + '</span>' +
      '<span class="dem" data-hd="mo-dong">' + TT.soCoDau(kt - bd) + (mang ? " phần tử" : " khoá") + "</span>";
    n._dong = dong;
    n._meta = 2;
    n.appendChild(dong);
    var nut = document.createElement("span");
    nut.className = "mo-dong";
    nut.setAttribute("aria-hidden", "true");
    nut.setAttribute("data-hd", "mo-dong");
    nut.textContent = mo ? "−" : "+";
    n._nutMo = nut;
    n.appendChild(nut);
    var con = document.createElement("div");
    con.className = "con";
    con.setAttribute("role", "group");
    n._con = con;
    n.appendChild(con);
    n.setAttribute("aria-expanded", mo ? "true" : "false");
    if (mo) veConNhom(n); else n.classList.add("dong-lai");
    return n;
  }

  /** Dung con cua nut nhom `n`: nhom nho hon (neu khoang con > NHOM_CON) hoac cac nut that. */
  function veConNhom(n) {
    var g = n._nhom, cha = n._cha, ra = document.createDocumentFragment(), sub = chiaNhom(g.bd, g.kt), i;
    if (sub) for (i = 0; i < sub.length; i++) ra.appendChild(veNhom(cha, sub[i].bd, sub[i].kt, n._cap + 1));
    else veHangCon(cha, g.bd, g.kt, n._cap + 1, ra);
    n._con.appendChild(ra);
    n._daVe = true;
  }

  function veCay() {
    var tom = $("#cay-tom");
    if (oHien !== "cay") { cayBan = true; return; }
    cayBan = false;
    var coFocus = cayEl.contains(document.activeElement);
    var st = cayEl.scrollTop || cuonCay.top, sl = cayEl.scrollLeft || cuonCay.left;
    dangSua = null;
    bangNut = Object.create(null);
    hienKieu = $("#cay-kieu").checked;
    hienKichThuoc = $("#cay-kich-thuoc").checked;
    nganVe = { con: NGAN_SACH.ve };
    cayEl.textContent = "";
    if (!hopLe) {
      cayEl.removeAttribute("role");
      cayEl.innerHTML = '<p class="phu">Chưa có JSON hợp lệ để dựng cây.</p>';
      tom.textContent = "";
      return;
    }
    cayEl.setAttribute("role", "tree");
    cayEl.appendChild(veNut(null, duLieu, [], 1));
    var d = dem(duLieu);
    tom.textContent = d.nut + " nút · sâu " + d.sau + " cấp";

    var chon = timNut(hangChon) || bangNut["[]"];
    datHangChon(chon);
    cayEl.scrollTop = st;
    cayEl.scrollLeft = sl;
    cuonCay.top = cayEl.scrollTop; cuonCay.left = cayEl.scrollLeft;
    if (coFocus) focusNut(chon);
  }

  /** Nut theo duong dan; neu no nam trong nhanh dang gap (chua ve) thi lay
      to tien gan nhat dang hien. */
  function timNut(kd) {
    if (bangNut[kd]) return bangNut[kd];
    var tn = tachKhoaNhom(kd);
    if (tn) { kd = tn.duong; if (bangNut[kd]) return bangNut[kd]; }
    var p;
    try { p = JSON.parse(kd); } catch (e) { return null; }
    while (p && p.length) {
      p.pop();
      var k = khoaDuong(p);
      if (bangNut[k]) return bangNut[k];
    }
    return null;
  }

  /** Dem nut / la / mang / object, do sau lon nhat va so nut theo kieu.
      LAP bang ngan xep (truoc day de quy: JSON long 20 000 cap — JSON.parse
      van doc duoc — lam tran ngan xep va veCay nem loi). `sau`: do sau cua
      chinh `v` (mac dinh 0).

      Ket qua cua tung nhanh (object / mang) NHO trong WeakMap theo danh tinh
      object: capNhatTai sao nong, nhanh khong doi giu nguyen danh tinh nen
      sua mot o cua tai lieu 10 MB chi tinh lai cac nhanh tren duong di (dem
      moi lan veCay: 205 ms o 10 MB -> vai ms). Chi nho nhanh, khong nho la. */
  var demBoNho = typeof WeakMap === "function" ? new WeakMap() : null;

  function demNhanh(goc) {
    var c = demBoNho && demBoNho.get(goc);
    if (c) return c;
    var moi = function () { return { nut: 1, cao: 0, la: 0, mang: 0, obj: 0, s: 0, n: 0, b: 0, z: 0 }; };
    var ngan = [{ x: goc, ks: null, i: 0, r: moi() }], i;
    ngan[0].r[Array.isArray(goc) ? "mang" : "obj"] = 1;
    ngan[0].ks = Array.isArray(goc) ? null : Object.keys(goc);
    var kq = null;
    while (ngan.length) {
      var f = ngan[ngan.length - 1], x = f.x, arr = f.ks === null, tong = arr ? x.length : f.ks.length, r = f.r, tiep = null;
      while (f.i < tong) {
        var con = arr ? x[f.i] : x[f.ks[f.i]];
        f.i++;
        if (con !== null && typeof con === "object") {
          var cc = demBoNho && demBoNho.get(con);
          if (cc) {
            r.nut += cc.nut; r.la += cc.la; r.mang += cc.mang; r.obj += cc.obj; r.s += cc.s; r.n += cc.n; r.b += cc.b; r.z += cc.z;
            if (cc.cao + 1 > r.cao) r.cao = cc.cao + 1;
          } else {
            var ma = Array.isArray(con), nr = moi();
            nr[ma ? "mang" : "obj"] = 1;
            tiep = { x: con, ks: ma ? null : Object.keys(con), i: 0, r: nr };
            break;
          }
        } else {
          r.nut++; r.la++;
          if (r.cao < 1) r.cao = 1;
          if (typeof con === "string") r.s++; else if (typeof con === "number") r.n++; else if (typeof con === "boolean") r.b++; else r.z++;
        }
      }
      if (tiep) { ngan.push(tiep); continue; }
      ngan.pop();
      if (demBoNho) demBoNho.set(x, r);
      if (ngan.length) {
        var cha = ngan[ngan.length - 1].r;
        cha.nut += r.nut; cha.la += r.la; cha.mang += r.mang; cha.obj += r.obj; cha.s += r.s; cha.n += r.n; cha.b += r.b; cha.z += r.z;
        if (r.cao + 1 > cha.cao) cha.cao = r.cao + 1;
      } else kq = r;
    }
    return kq;
  }

  function dem(v, sau) {
    var base = sau || 0, r = { nut: 0, sau: base, la: 0, mang: 0, obj: 0, kieu: {} };
    if (v === null || typeof v !== "object") {
      r.nut = 1; r.la = 1; r.kieu[kieuCua(v)] = 1;
      return r;
    }
    var c = demNhanh(v);
    r.nut = c.nut; r.la = c.la; r.mang = c.mang; r.obj = c.obj; r.sau = base + c.cao;
    if (c.obj) r.kieu.object = c.obj;
    if (c.mang) r.kieu.array = c.mang;
    if (c.s) r.kieu.string = c.s;
    if (c.n) r.kieu.number = c.n;
    if (c.b) r.kieu.boolean = c.b;
    if (c.z) r.kieu["null"] = c.z;
    return r;
  }

  /* ---------------------------------------------- chon, focus, di chuyen */
  function tabNutTT(n, t) {
    var bs = n._dong.querySelectorAll(".nut-tt");
    for (var i = 0; i < bs.length; i++) bs[i].tabIndex = t;
  }

  /** Roving tabindex: dung MOT nut cua cay nam trong thu tu Tab, kem cac
      nut thao tac cua no. Phim mui ten di giua cac nut. */
  function datHangChon(n) {
    if (!n) return;
    var cu = bangNut[hangChon];
    if (cu && cu !== n) { cu.tabIndex = -1; tabNutTT(cu, -1); }
    hangChon = n.getAttribute("data-p");
    n.tabIndex = 0;
    tabNutTT(n, 0);
  }

  function focusNut(n) {
    if (!n) return;
    datHangChon(n);
    try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); }
    hienTrongKhung(n._dong);
  }

  /** Cuon vua du de thay DONG cua nut (khong phai ca nhanh con). */
  function hienTrongKhung(el) {
    var r = el.getBoundingClientRect(), k = cayEl.getBoundingClientRect();
    if (r.top < k.top) cayEl.scrollTop -= (k.top - r.top) + 6;
    else if (r.bottom > k.bottom) cayEl.scrollTop += (r.bottom - k.bottom) + 6;
  }

  function chaCua(n) {
    var c = n.parentNode;
    return c && c.classList && c.classList.contains("con") ? c.parentNode : null;
  }
  function dangMo(n) { return !!n._con && !n.classList.contains("dong-lai"); }
  function nutSau(n) {
    if (dangMo(n) && n._con.firstElementChild) return n._con.firstElementChild;
    for (var x = n; x; x = chaCua(x)) if (x.nextElementSibling) return x.nextElementSibling;
    return null;
  }
  function nutTruoc(n) {
    var p = n.previousElementSibling;
    if (!p) return chaCua(n);
    while (dangMo(p) && p._con.lastElementChild) p = p._con.lastElementChild;
    return p;
  }
  function nutCuoi() {
    var n = bangNut["[]"];
    while (n && dangMo(n) && n._con.lastElementChild) n = n._con.lastElementChild;
    return n;
  }

  function batTat(n, mo) {
    if (!n || !n._con) return;
    if (mo === undefined) mo = n.classList.contains("dong-lai");
    trangThaiMo[n.getAttribute("data-p")] = mo;
    if (mo && !n._daVe) { nganVe = { con: NGAN_SACH.ve }; if (n._nhom) veConNhom(n); else veCon(n); }
    if (!mo) capNhatMeta(n);                          /* vua gap: dung metadata lan dau */
    n.classList.toggle("dong-lai", !mo);
    n.setAttribute("aria-expanded", mo ? "true" : "false");
    n._nutMo.textContent = mo ? "−" : "+";
    if (huyHieuCay) capNhatHuyHieu(n);
  }

  /* ---------------------------------------------- thong bao trong tab Cay */
  var henBao = null;
  function thongBaoCay(chu) {
    if (!cayBao) return;
    cayBao.textContent = chu;
    clearTimeout(henBao);
    henBao = setTimeout(function () { cayBao.textContent = ""; }, 8000);
  }

  /* ---------------------------------------------- ghi mot thay doi */
  /** Mo hinh co khop van ban hien tai khong — neu khong thi doc lai. */
  function sanSang() {
    if (!dongBoDoc()) { thongBaoCay("JSON đang lỗi — sửa ở tab Soạn trước đã"); return false; }
    return true;
  }

  function moToTien(duong, goc) {
    var v = goc !== undefined ? goc : duLieu;
    for (var i = 0; i < duong.length; i++) {
      var cha = duong.slice(0, i);
      trangThaiMo[khoaDuong(cha)] = true;
      if (!laNhanh(v)) continue;
      var sl = soConCua(v);
      if (sl > HS.NHOM_CON) {
        var idx = Array.isArray(v) ? +duong[i] : Object.keys(v).indexOf(duong[i]);
        if (idx >= 0) chuoiNhom(idx, sl).forEach(function (g) { trangThaiMo[khoaNhom(cha, g.bd, g.kt)] = true; });
      }
      v = laNhanh(v) && coKhoa(v, duong[i]) ? v[duong[i]] : undefined;
    }
  }

  /** Nut that `to` vua mo: mo luon chuoi nhom chua con `khoaCon` (khoa / chi so) de nut con do duoc dung ra. */
  function moNhomChua(to, khoaCon) {
    var v = to._v;
    if (!laNhanh(v)) return;
    var sl = soConCua(v);
    if (sl <= HS.NHOM_CON) return;
    var idx = Array.isArray(v) ? +khoaCon : Object.keys(v).indexOf(khoaCon);
    if (idx < 0) return;
    var ds = chuoiNhom(idx, sl);
    for (var i = 0; i < ds.length; i++) {
      var gn = bangNut[khoaNhom(to._duong, ds[i].bd, ds[i].kt)];
      if (!gn) break;
      if (!dangMo(gn)) batTat(gn, true);
    }
  }

  /** Moi thao tac tren cay di qua day: viet lai #nhap THEO KIEU THUT LE
      DANG DUNG qua datVanBan (mot buoc hoan tac co nhan), chuyen trang
      thai gap/mo theo duong dan moi — SAU khi chup lich su, de hoan tac
      tra ve dung trang thai cu. */
  function apDungGoc(gocMoi, phep, duongChon, nhan) {
    var sMoi = null;
    /* Tai lieu lon: thay MOT o thi ghep chuoi tai cho (O(vi tri)), giu nguyen dinh dang phan con lai —
       khong stringify lai ca tai lieu (10 MB: ~700 ms + doan thut le). */
    if (phep && layVb().length > HS.NGUONG_GHEP) {
      try { sMoi = ghepTaiCho(layVb(), gocMoi, phep); } catch (e) { sMoi = null; }
    }
    if (sMoi === null) {
      try { sMoi = vietTheoKieu(gocMoi, layVb()); }
      catch (e) { thongBaoCay("Không ghi được — " + moTaLoiNem(e)); return false; }
    }
    return datVanBan(sMoi, {
      nhan: nhan || "Sửa trên cây",
      goc: gocMoi,
      sauKhiChup: function () {
        if (phep) trangThaiMo = doiTrangThai(trangThaiMo, phep);
        if (duongChon) { moToTien(duongChon, gocMoi); hangChon = khoaDuong(duongChon); }
      }
    });
  }

  /** Van ban moi sau phep `phep` (thay gia tri / doi ten khoa) bang cach ghep vao van ban cu; null neu khong ghep duoc
      (khi do nguoi goi viet lai ca van ban). Phan van ban con lai GIU NGUYEN tung byte. */
  function ghepTaiCho(s, gocMoi, phep) {
    if (!phep.duong || !phep.duong.length) return null;
    var vt = VT.timViTri(s, phep.duong);
    if (!vt) return null;
    if (phep.loai === "thay") {
      var moi = layTai(gocMoi, phep.duong);
      if (moi === undefined) return null;
      return s.slice(0, vt.bd) + vietGiaTri(moi, s, vt.bd) + s.slice(vt.kt);
    }
    if (phep.loai === "doi-ten" && vt.khoaBd >= 0) {
      return s.slice(0, vt.khoaBd) + JSON.stringify(String(phep.moi)) + s.slice(vt.khoaKt);
    }
    return null;
  }

  /** Van ban cua gia tri `v` dat vao vi tri `bd` cua `s`: cung kieu thut le; dong nao sau dong dau thut them
      theo dong chua vi tri `bd` (gia tri nhanh nam sau "khoa": ). */
  function vietGiaTri(v, s, bd) {
    var t = JSON.stringify(v, null, doThut(s));
    if (t.indexOf("\n") < 0) return t;
    var dau = s.lastIndexOf("\n", bd - 1) + 1, e = dau;
    while (e < bd && (s.charCodeAt(e) === 32 || s.charCodeAt(e) === 9)) e++;
    return t.split("\n").join("\n" + s.slice(dau, e));
  }

  function xoaNut(n) {
    var duong = n._duong;
    if (!duong.length) { thongBaoCay("Không xoá được nút gốc"); return; }
    if (!sanSang()) return;
    var goc;
    try { goc = xoaTai(duLieu, duong); } catch (e) { thongBaoCay(e.message); return; }
    /* Sau khi xoa, chon nut ke tiep (hoac truoc do, hoac cha) de con go
       Delete tiep duoc ngay. */
    var cha = duong.slice(0, -1), k = duong[duong.length - 1], chaMoi = layTai(goc, cha), chon;
    if (Array.isArray(chaMoi)) {
      chon = chaMoi.length ? cha.concat([Math.min(k, chaMoi.length - 1)]) : cha;
    } else {
      var ks = Object.keys(layTai(duLieu, cha)), i = ks.indexOf(k);
      var ke = i + 1 < ks.length ? ks[i + 1] : i > 0 ? ks[i - 1] : null;
      chon = ke === null ? cha : cha.concat([ke]);
    }
    if (!apDungGoc(goc, { loai: "xoa", duong: duong }, chon, "Xoá " + moTaDuong(duong))) return;
    thongBaoCay("Đã xoá " + moTaDuong(duong) + " — Ctrl+Z để hoàn tác");
  }

  function doiCho(n, buoc) {
    var duong = n._duong;
    if (typeof duong[duong.length - 1] !== "number") {
      thongBaoCay("Chỉ đổi chỗ được phần tử của mảng");
      return;
    }
    if (!sanSang()) return;
    var kq;
    try { kq = diChuyen(duLieu, duong, buoc); } catch (e) { thongBaoCay(e.message); return; }
    apDungGoc(kq.goc, { loai: "chuyen", duong: duong, moi: kq.duong[kq.duong.length - 1] }, kq.duong, "Đổi chỗ");
  }

  function themCon(n) {
    if (n && n._nhom) n = n._cha;                   /* Insert tren nut nhom = them vao nhanh cha */
    if (!n || !n._con) return;
    if (!sanSang()) return;
    var v = n._v, kq;
    try {
      kq = themVao(duLieu, n._duong, Array.isArray(v) ? giaTriRongTheo(v[v.length - 1]) : "");
    } catch (e) { thongBaoCay(e.message); return; }
    trangThaiMo[n.getAttribute("data-p")] = true;
    if (!apDungGoc(kq.goc, null, kq.duong, Array.isArray(v) ? "Thêm phần tử" : "Thêm khoá")) return;
    var moi = bangNut[khoaDuong(kq.duong)];
    if (!moi) return;
    focusNut(moi);
    if (!Array.isArray(v)) moSua(moi, "khoa", { tiepGiaTri: true });
    else if (!moi._con) moSua(moi, "gia-tri");
  }

  /* ---------------------------------------------- o sua tai cho */
  var KIEU = ["string", "number", "boolean", "null", "object", "array"];
  var demSua = 0;

  function taoNutSua(kyHieu, nhan, lop) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "nut-sua " + lop;
    b.textContent = kyHieu;
    b.setAttribute("aria-label", nhan);
    b.title = nhan;
    /* Giu focus o o nhap: neu nut lay focus thi o nhap "roi" truoc, va
       "luu khi roi o" chay TRUOC cu bam — bam Huy hoa thanh Luu. */
    b.addEventListener("mousedown", function (e) { e.preventDefault(); });
    return b;
  }

  function taoLuaChon(ds, giaTri) {
    var s = document.createElement("select");
    ds.forEach(function (k) {
      var op = document.createElement("option");
      op.value = k; op.textContent = k;
      s.appendChild(op);
    });
    s.value = giaTri;
    return s;
  }

  function ghiChuNhanh(v, kieu) {
    var mang = Array.isArray(v), sl = mang ? v.length : Object.keys(v).length;
    var cu = mang ? "mảng " + sl + " phần tử" : "object " + sl + " khoá";
    if (kieu === kieuCua(v)) return "giữ nguyên " + cu + " — chọn kiểu khác để chuyển";
    return kieu === "array" ? "đổi " + cu + " thành mảng các giá trị"
                            : "đổi " + cu + " thành object, khoá là chỉ số";
  }

  /** Dung o nhap cho kieu dang chon, hien `giaTri` (da doi sang kieu ay). */
  function datTruong(phien, giaTri) {
    var kieu = phien.kieu, el;
    if (kieu === "boolean") {
      el = taoLuaChon(["true", "false"], giaTri === true ? "true" : "false");
      el.className = "o-nhap o-bool";
    } else if (kieu === "null") {
      el = document.createElement("span");
      el.className = "ghi-chu-sua gt-null";
      el.textContent = "null";
    } else if ((kieu === "object" || kieu === "array") && laNhanh(phien.v)) {
      el = document.createElement("span");
      el.className = "ghi-chu-sua";
      el.textContent = ghiChuNhanh(phien.v, kieu);
    } else {
      var chu = kieu === "string" ? giaTri : kieu === "number" ? String(giaTri) : JSON.stringify(giaTri);
      if (kieu === "string" && /[\r\n]/.test(chu)) {
        el = document.createElement("textarea");
        el.rows = Math.min(8, chu.split("\n").length + 1);
        el.title = "Ctrl+Enter để lưu";
      } else {
        el = document.createElement("input");
        el.type = "text";
      }
      el.className = "o-nhap";
      el.value = chu;
      el.spellcheck = false;
      el.setAttribute("autocomplete", "off");
      if (kieu === "number") el.setAttribute("inputmode", "decimal");
      if (kieu === "object" || kieu === "array") el.placeholder = kieu === "object" ? '{"khoa": 1}' : "[1, 2]";
      el.addEventListener("input", function () { if (phien.loi.textContent) baoLoiSua(phien, ""); });
    }
    if (el.tagName !== "SPAN") {
      el.setAttribute("aria-label", typeof phien.n._khoa === "string"
        ? "Giá trị mới cho khoá " + phien.n._khoa : "Giá trị mới");
    }
    /* Gan o moi TRUOC, chuyen focus sang no, roi moi go o cu: go mot o
       dang focus thi o sua "mat focus" va tu luu giua chung. */
    var cu = phien.truong, coFocus = !!cu && cu === document.activeElement;
    phien.vung.appendChild(el);
    if (coFocus) {
      if (el.tagName !== "SPAN") el.focus();
      else if (phien.chon) phien.chon.focus();
    }
    if (cu && cu.parentNode) cu.parentNode.removeChild(cu);
    phien.truong = el;
  }

  /** Gia tri dang nam trong o — de doi kieu thi chuyen tu CAI DANG GO,
      khong phai tu gia tri cu. Go sai thi coi nhu chuoi tho. */
  function layNguon(phien) {
    var t = phien.truong;
    if (!t || t.tagName === "SPAN") return phien.kieu === "null" ? null : phien.v;
    try { return docGiaTri(t.value, phien.kieu); } catch (e) { return t.value; }
  }

  function layGiaTriSua(phien) {
    var t = phien.truong;
    if (phien.kieu === "null") return null;
    if (!t || t.tagName === "SPAN") return doiKieu(phien.v, phien.kieu);
    return docGiaTri(t.value, phien.kieu);
  }

  function baoLoiSua(phien, chu, keoFocus) {
    phien.loi.textContent = chu;
    var t = phien.truong;
    if (!t || t.tagName === "SPAN") return;
    if (chu) {
      t.setAttribute("aria-invalid", "true");
      t.setAttribute("aria-describedby", phien.loi.id);
      if (keoFocus) t.focus();
    } else {
      t.removeAttribute("aria-invalid");
      t.removeAttribute("aria-describedby");
    }
  }

  /** Mo o sua tren nut `n`: loai "gia-tri" (gia tri + kieu) hoac "khoa"
      (doi ten khoa). Enter / roi o thi luu, Esc thi huy. */
  function moSua(n, loai, tuyChon) {
    if (!n) return;
    if (dangSua) {
      var p = n.getAttribute("data-p");
      if (!luuSua(dangSua, false)) return;
      n = bangNut[p];
      if (!n) return;
    }
    if (!sanSang()) return;
    if (loai === "khoa" && typeof n._khoa !== "string") loai = "gia-tri";

    var phien = {
      n: n, loai: loai, duong: n._duong, v: n._v, cu: n._dong.innerHTML,
      kieu: kieuCua(n._v), truong: null, chon: null, tuyChon: tuyChon || {}
    };
    var o = document.createElement("span");
    o.className = "o-sua" + (loai === "khoa" ? " o-sua-khoa" : "");
    phien.el = o;
    phien.vung = document.createElement("span");
    phien.vung.className = "o-truong";
    o.appendChild(phien.vung);

    var loi = document.createElement("span");
    loi.className = "loi-sua";
    loi.id = "loi-sua-" + (++demSua);
    loi.setAttribute("role", "alert");
    phien.loi = loi;

    if (loai === "khoa") {
      var vao = document.createElement("input");
      vao.type = "text";
      vao.className = "o-nhap";
      vao.value = n._khoa;
      vao.spellcheck = false;
      vao.setAttribute("autocomplete", "off");
      vao.setAttribute("aria-label", "Tên khoá mới");
      vao.addEventListener("input", function () { if (loi.textContent) baoLoiSua(phien, ""); });
      phien.vung.appendChild(vao);
      phien.truong = vao;
    } else {
      datTruong(phien, phien.v);
      var chon = taoLuaChon(KIEU, phien.kieu);
      chon.className = "chon-kieu";
      chon.setAttribute("aria-label", "Kiểu giá trị");
      chon.title = "Đổi kiểu";
      chon.addEventListener("change", function () {
        var nguon = layNguon(phien);
        phien.kieu = chon.value;
        datTruong(phien, doiKieu(nguon, phien.kieu));
        baoLoiSua(phien, "");
      });
      o.appendChild(chon);
      phien.chon = chon;
    }

    var luu = taoNutSua("✓", "Lưu (Enter)", "nut-luu");
    var huy = taoNutSua("✕", "Huỷ (Esc)", "nut-huy");
    luu.addEventListener("click", function () { luuSua(phien, true); });
    huy.addEventListener("click", function () { dongSua(phien, true); });
    o.appendChild(luu);
    o.appendChild(huy);
    o.appendChild(loi);

    o.addEventListener("keydown", function (e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        dongSua(phien, true);
        return;
      }
      if (e.key !== "Enter") return;
      var t = e.target;
      if (t.tagName === "BUTTON") return;
      if (t.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      luuSua(phien, true);
    });
    o.addEventListener("focusout", function (e) {
      if (e.relatedTarget && o.contains(e.relatedTarget)) return;
      /* Bam chuot vao cho khac trong cay: de bo xu ly click luu truoc roi
         lam viec cua cu bam tren cay MOI — neu luu ngay bay gio thi cay ve
         lai giua luc bam va cu bam roi vao khoang khong. */
      if (nhanChuot) return;
      setTimeout(function () {
        if (dangSua !== phien || o.contains(document.activeElement)) return;
        if (document.hasFocus && !document.hasFocus()) return; /* chuyen cua so */
        luuSua(phien, false);
      }, 0);
    });

    var dong = n._dong;
    dong.classList.add("dang-sua");
    if (loai === "khoa") {
      dong.replaceChild(o, dong.querySelector(".khoa"));
    } else {
      dong.innerHTML = htmlKhoa(n._khoa);
      dong.appendChild(o);
    }
    dangSua = phien;
    var f = phien.truong && phien.truong.tagName !== "SPAN" ? phien.truong : phien.chon;
    if (f) {
      f.focus();
      if (f.select && f.tagName !== "SELECT") f.select();
    }
  }

  /** Luu phien sua. Tra false neu gia tri khong hop le — o sua van mo va
      bao loi ngay tai cho, KHONG ghi gi ca. */
  function luuSua(phien, quaPhim) {
    if (!phien || dangSua !== phien) return true;
    var n = phien.n, gocMoi, phep, duongMoi, nhanSua;
    try {
      if (phien.loai === "khoa") {
        var khoaMoi = phien.truong.value;
        if (khoaMoi === n._khoa) {
          dongSua(phien, quaPhim);
          if (quaPhim && phien.tuyChon.tiepGiaTri && !n._con) moSua(n, "gia-tri");
          return true;
        }
        gocMoi = doiTenKhoa(duLieu, phien.duong, khoaMoi);
        duongMoi = phien.duong.slice(0, -1).concat([khoaMoi]);
        phep = { loai: "doi-ten", duong: phien.duong, moi: khoaMoi };
        nhanSua = "Đổi tên khoá";
      } else {
        var v = layGiaTriSua(phien);
        if (v === phien.v) { dongSua(phien, quaPhim); return true; }
        gocMoi = datTai(duLieu, phien.duong, v);
        duongMoi = phien.duong;
        phep = { loai: "thay", duong: phien.duong };
        nhanSua = kieuCua(v) !== kieuCua(phien.v) ? "Đổi kiểu" : "Sửa giá trị";
      }
    } catch (e) {
      baoLoiSua(phien, e.message, quaPhim);
      return false;
    }
    dangSua = null;
    if (!apDungGoc(gocMoi, phep, duongMoi, nhanSua)) { veCay(); return true; }
    if (quaPhim && phien.tuyChon.tiepGiaTri) {
      var moi = bangNut[khoaDuong(duongMoi)];
      if (moi && !moi._con) moSua(moi, "gia-tri");
    }
    return true;
  }

  /** Dong o sua, tra dong ve nhu cu (huy, hoac luu ma khong co gi doi). */
  function dongSua(phien, giuFocus) {
    if (dangSua !== phien) return;
    dangSua = null;
    var n = phien.n, dong = n._dong;
    dong.classList.remove("dang-sua");
    dong.innerHTML = phien.cu;
    if (n.getAttribute("data-p") === hangChon) tabNutTT(n, 0);
    if (giuFocus && cayEl.contains(n)) focusNut(n);
  }

  function thucHien(hd, n) {
    if (hd === "mo-dong") batTat(n);
    else if (hd === "sua") moSua(n, "gia-tri");
    else if (hd === "doi-ten") moSua(n, "khoa");
    else if (hd === "them") themCon(n);
    else if (hd === "xoa") xoaNut(n);
    else if (hd === "len") doiCho(n, -1);
    else if (hd === "xuong") doiCho(n, 1);
  }

  /* ==================================================================
     3b. Cac ham THUAN cho viec sua theo duong dan

     Khong ham nao sua mo hinh dang co: moi ham sao NONG nhung nut tren
     duong dan roi tra ve goc moi, nhanh khong dung toi thi dung chung.
     Duong dan la mang: khoa object la chuoi, chi so mang la so.
     ================================================================== */
  /** Gan khoa cho object. "__proto__" phai di duong rieng — gan thuong thi
      no doi NGUYEN MAU cua object thay vi tao khoa, va khoa ay bien mat. */
  function datKhoa(o, k, v) {
    if (k === "__proto__") {
      Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
    } else {
      o[k] = v;
    }
  }

  function saoNong(v) {
    if (Array.isArray(v)) return v.slice();
    var o = {};
    Object.keys(v).forEach(function (k) { datKhoa(o, k, v[k]); });
    return o;
  }

  function coKhoa(o, k) {
    if (Array.isArray(o)) return typeof k === "number" && k >= 0 && k < o.length && k % 1 === 0;
    return laNhanh(o) && typeof k === "string" && coRieng(o, k);
  }

  function layTai(goc, duong) {
    var v = goc;
    for (var i = 0; i < duong.length; i++) {
      if (!laNhanh(v) || !coKhoa(v, duong[i])) return undefined;
      v = v[duong[i]];
    }
    return v;
  }

  /** Thay nut tai `duong` bang ham(nut cu); tra ve GOC MOI. */
  function capNhatTai(goc, duong, ham, i) {
    i = i || 0;
    if (i === duong.length) return ham(goc);
    if (!laNhanh(goc) || !coKhoa(goc, duong[i])) throw new Error("Không tìm thấy " + moTaDuong(duong));
    var ban = saoNong(goc);
    datKhoa(ban, duong[i], capNhatTai(goc[duong[i]], duong, ham, i + 1));
    return ban;
  }

  function datTai(goc, duong, giaTri) {
    return capNhatTai(goc, duong, function () { return giaTri; });
  }

  /** Doi ten khoa CUOI cua `duong`, giu nguyen vi tri khoa trong object. */
  function doiTenKhoa(goc, duong, khoaMoi) {
    if (!duong.length) throw new Error("Nút gốc không có tên khoá");
    var cu = duong[duong.length - 1];
    khoaMoi = String(khoaMoi);
    return capNhatTai(goc, duong.slice(0, -1), function (o) {
      if (!laNhanh(o) || Array.isArray(o)) throw new Error("Chỉ đổi tên được khoá của object");
      if (!coKhoa(o, cu)) throw new Error("Không tìm thấy khoá “" + cu + "”");
      if (khoaMoi === cu) return o;
      if (coRieng(o, khoaMoi)) throw new Error("Khoá “" + khoaMoi + "” đã có trong object này");
      var ra = {};
      Object.keys(o).forEach(function (k) { datKhoa(ra, k === cu ? khoaMoi : k, o[k]); });
      return ra;
    });
  }

  function khoaMoiDuyNhat(o, goc) {
    goc = goc || "khoa_moi";
    if (!coRieng(o, goc)) return goc;
    for (var i = 2; ; i++) if (!coRieng(o, goc + "_" + i)) return goc + "_" + i;
  }

  /** Them vao object (khoa cho truoc hoac tu dat khoa_moi, khoa_moi_2…)
      hoac mang (cuoi mang, hoac chen tai chi so `khoa` neu la so).
      Tra { goc, duong } — duong dan toi nut vua them. */
  function themVao(goc, duongCha, giaTri, khoa) {
    var duongMoi;
    var gocMoi = capNhatTai(goc, duongCha, function (o) {
      if (Array.isArray(o)) {
        var vt = typeof khoa === "number" ? Math.max(0, Math.min(khoa, o.length)) : o.length;
        var ra = o.slice();
        ra.splice(vt, 0, giaTri);
        duongMoi = duongCha.concat([vt]);
        return ra;
      }
      if (laNhanh(o)) {
        var k = khoa === undefined || khoa === null ? khoaMoiDuyNhat(o) : String(khoa);
        if (coRieng(o, k)) throw new Error("Khoá “" + k + "” đã có trong object này");
        var ra2 = saoNong(o);
        datKhoa(ra2, k, giaTri);
        duongMoi = duongCha.concat([k]);
        return ra2;
      }
      throw new Error("Chỉ thêm được vào object hoặc mảng");
    });
    return { goc: gocMoi, duong: duongMoi };
  }

  function xoaTai(goc, duong) {
    if (!duong.length) throw new Error("Không xoá được nút gốc");
    var k = duong[duong.length - 1];
    return capNhatTai(goc, duong.slice(0, -1), function (o) {
      if (!coKhoa(o, k)) throw new Error("Không tìm thấy " + moTaDuong(duong));
      if (Array.isArray(o)) {
        var ra = o.slice();
        ra.splice(k, 1);
        return ra;
      }
      var ra2 = {};
      Object.keys(o).forEach(function (x) { if (x !== k) datKhoa(ra2, x, o[x]); });
      return ra2;
    });
  }

  /** Doi cho phan tu mang voi hang xom (buoc -1 / +1). Tra { goc, duong }. */
  function diChuyen(goc, duong, buoc) {
    if (!duong.length) throw new Error("Không đổi chỗ được nút gốc");
    var cha = duong.slice(0, -1), i = duong[duong.length - 1], j = i + buoc;
    var gocMoi = capNhatTai(goc, cha, function (o) {
      if (!Array.isArray(o)) throw new Error("Chỉ đổi chỗ được phần tử của mảng");
      if (!coKhoa(o, i)) throw new Error("Không tìm thấy " + moTaDuong(duong));
      if (j < 0 || j >= o.length) throw new Error(buoc < 0 ? "Đã ở đầu mảng" : "Đã ở cuối mảng");
      var ra = o.slice(), t = ra[i];
      ra[i] = ra[j]; ra[j] = t;
      return ra;
    });
    return { goc: gocMoi, duong: cha.concat([j]) };
  }

  /** Gia tri "rong" cung kieu voi phan tu mau — them vao mang so thi duoc
      0, mang object thi duoc {}. */
  function giaTriRongTheo(mau) {
    switch (kieuCua(mau)) {
      case "number": return 0;
      case "boolean": return false;
      case "null": return null;
      case "array": return [];
      case "object": return {};
      default: return "";
    }
  }

  function thuParse(s) {
    try { return JSON.parse(s); } catch (e) { return undefined; }
  }

  var SO_JSON = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

  /** Doi mot gia tri sang kieu khac. KHONG BAO GIO nem loi:
        -> string : so/bool thanh chu, null thanh "", object/mang thanh JSON gon
        -> number : chuoi la so thi lay so (khong thi 0), true/false -> 1/0
        -> boolean: chuoi "true", "1", "yes", "có", "đúng"… -> true; so khac 0;
                    object/mang khong rong
        -> object : mang -> khoa la chi so; chuoi chua JSON object -> giai ra;
                    con lai -> {}
        -> array  : object -> mang cac gia tri; chuoi chua JSON mang -> giai
                    ra; con lai -> [] */
  function doiKieu(v, kieu) {
    var cu = kieuCua(v), p;
    if (cu === kieu) return v;
    switch (kieu) {
      case "string":
        if (v === null) return "";
        if (laNhanh(v)) return JSON.stringify(v);
        return String(v);
      case "number":
        if (cu === "string") {
          var t = v.trim();
          return SO_JSON.test(t) && isFinite(Number(t)) ? Number(t) : 0;
        }
        if (cu === "boolean") return v ? 1 : 0;
        return 0;
      case "boolean":
        if (cu === "string") return /^(true|1|yes|y|on|có|co|đúng|dung)$/i.test(v.trim());
        if (cu === "number") return v !== 0;
        if (cu === "array") return v.length > 0;
        if (cu === "object") return Object.keys(v).length > 0;
        return false;
      case "null":
        return null;
      case "object":
        if (cu === "array") {
          var o = {};
          v.forEach(function (x, i) { o[i] = x; });
          return o;
        }
        if (cu === "string") { p = thuParse(v); if (kieuCua(p) === "object") return p; }
        return {};
      case "array":
        if (cu === "object") return Object.keys(v).map(function (k) { return v[k]; });
        if (cu === "string") { p = thuParse(v); if (Array.isArray(p)) return p; }
        return [];
    }
    return v;
  }

  /** Doc chu nguoi dung go thanh gia tri dung kieu. Sai thi NEM LOI kem
      loi nhan de hien ngay canh o nhap. */
  function docGiaTri(chu, kieu) {
    chu = String(chu);
    var t = chu.trim();
    switch (kieu) {
      case "string":
        return chu;
      case "number":
        if (!t) throw new Error("Chưa nhập số");
        if (!SO_JSON.test(t)) throw new Error("“" + catNgan(t, 24) + "” không phải số hợp lệ");
        var so = Number(t);
        if (!isFinite(so)) throw new Error("Số quá lớn — JSON không chứa được vô cực");
        return so;
      case "boolean":
        if (/^true$/i.test(t)) return true;
        if (/^false$/i.test(t)) return false;
        throw new Error("Chỉ nhận true hoặc false");
      case "null":
        return null;
      case "object":
      case "array":
        var v;
        try { v = JSON.parse(t); } catch (e) { throw new Error("JSON không hợp lệ — " + gonLoi(e)); }
        if (kieuCua(v) !== kieu) {
          throw new Error(kieu === "object" ? "Cần một object, ví dụ {\"a\": 1}" : "Cần một mảng, ví dụ [1, 2]");
        }
        return v;
    }
    throw new Error("Kiểu không rõ: " + kieu);
  }

  function laTrangDoThut(c) {
    return c === 32 || c === 9 || c === 10 || c === 13 || c === 11 || c === 12 || c === 160 || c === 0xfeff || c === 0x2028 || c === 0x2029;
  }

  /** Doan kieu thut le cua van ban: 2 / 4 / ... dau cach, "\t", hoac 0
      (nen tren mot dong). Mac dinh 2. Chi nhin 64 KB dau: trim / split ca
      tai lieu 10 MB mat ~300 ms moi lan sua; cat khoang trang bang vong lap,
      khong regex (`\s+$` la bac hai voi mot dai khoang trang dai). */
  function doThut(s) {
    s = String(s || "");
    var n = s.length, a = 0, b = Math.min(n, 65536);
    while (a < b && laTrangDoThut(s.charCodeAt(a))) a++;
    if (n <= 65536) while (b > a && laTrangDoThut(s.charCodeAt(b - 1))) b--;
    if (a >= b) return 2;
    var t = s.slice(a, b);
    if (t.indexOf("\n") < 0) return 0;
    var dong = t.split("\n"), nho = 0;
    for (var i = 1; i < dong.length && i < 5000; i++) {
      var d = dong[i], k = 0;
      while (k < d.length && (d.charCodeAt(k) === 32 || d.charCodeAt(k) === 9)) k++;
      if (!k || k === d.length) continue;
      if (d.charAt(0) === "\t") { if (!nho) return "\t"; continue; }
      var so = k;
      for (var q = 0; q < k; q++) if (d.charCodeAt(q) === 9) { so = q; break; }
      if (!nho || so < nho) nho = so;
      if (nho === 1) break;
    }
    return nho ? Math.min(nho, 10) : 2;
  }

  /** Viet lai mo hinh THEO KIEU cua van ban cu: cung thut le, va giu dau
      xuong dong cuoi neu van ban cu co. */
  function vietTheoKieu(goc, cu) {
    return JSON.stringify(goc, null, doThut(cu)) + (coXuongDongCuoi(cu) ? "\n" : "");
  }

  /** Van ban ket thuc bang "\n" (kem dau cach / tab) khong? Quet tu cuoi — khong regex tren ca van ban. */
  function coXuongDongCuoi(s) {
    s = String(s || "");
    var j = s.length - 1;
    while (j >= 0 && (s.charCodeAt(j) === 32 || s.charCodeAt(j) === 9)) j--;
    return j >= 0 && s.charCodeAt(j) === 10;
  }

  /* --- doi trang thai gap/mo theo thao tac (de no bam theo dung nut) --- */
  function batDauBang(p, P) {
    if (p.length < P.length) return false;
    for (var i = 0; i < P.length; i++) if (p[i] !== P[i]) return false;
    return true;
  }

  /** Duong dan `p` thanh gi sau thao tac `phep` — null neu nut ay khong
      con. phep = { loai: "doi-ten" | "xoa" | "chuyen" | "thay", duong, moi }. */
  function anhXaDuong(p, phep) {
    var P = phep.duong, n = P.length, r;
    if (!n) return phep.loai === "thay" && p.length ? null : p;
    var cha = P.slice(0, -1), cuoi = P[n - 1];
    if (phep.loai === "doi-ten") {
      if (batDauBang(p, P)) { r = p.slice(); r[n - 1] = phep.moi; return r; }
      return p;
    }
    if (phep.loai === "xoa") {
      if (batDauBang(p, P)) return null;
      if (typeof cuoi === "number" && p.length >= n && batDauBang(p, cha) &&
          typeof p[n - 1] === "number" && p[n - 1] > cuoi) {
        r = p.slice(); r[n - 1]--; return r;
      }
      return p;
    }
    if (phep.loai === "chuyen") {
      if (p.length >= n && batDauBang(p, cha)) {
        if (p[n - 1] === cuoi) { r = p.slice(); r[n - 1] = phep.moi; return r; }
        if (p[n - 1] === phep.moi) { r = p.slice(); r[n - 1] = cuoi; return r; }
      }
      return p;
    }
    if (phep.loai === "thay") return p.length > n && batDauBang(p, P) ? null : p;
    return p;
  }

  function doiTrangThai(tt, phep) {
    var moi = Object.create(null);
    for (var k in tt) {
      var tn = tachKhoaNhom(k);                           /* khoa nhom: dich duong cha, giu nguyen "#bd:kt" */
      var p = anhXaDuong(JSON.parse(tn ? tn.duong : k), phep);
      if (p) moi[khoaDuong(p) + (tn ? tn.hau : "")] = tt[k];
    }
    return moi;
  }

  /* --- xem truoc nhanh dang gap: da chuyen sang tom-tat.js (JE.tomTat) --- */

  /* ==================================================================
     3c. Lich su sua (hoan tac / lam lai) — DUNG CHUNG moi tab

     Viet vao layVb() lam hong hoan tac goc cua trinh duyet (cac buoc go
     cu thanh buoc "chet", xem "9. Noi day"), nen moi thay doi do MAY viet
     (sua tren cay, dinh dang, nen, sap khoa,
     thoat chuoi, mo tep…) deu di qua datVanBan(): chup lai van ban TRUOC
     khi ghi, kem nhan buoc ("Định dạng"…), trang thai gap/mo, nut dang
     chon va vung chon cua textarea — hoan tac xong moi thu hien nhu cu.

     Moi buoc la mot anh chup van ban (app khong dong bo nhieu thiet bi nen
     quy tac "hoan tac = ham nguoc" cua du an khong ap dung o day).

     Nhan cua buoc di theo buoc: trong `truoc`, nhan la thao tac da dua van
     ban tu anh chup ay sang ban ke tiep; hoan tac chuyen anh chup hien tai
     sang `sau` VOI CUNG nhan, de "Làm lại: Định dạng" doc dung.

     Nguoi GO trong textarea van dung hoan tac goc cua trinh duyet (tung
     cum ky tu) cho phan go TU lan may ghi gan nhat; het phan do (van ban
     = ban may ghi) thi Ctrl+Z la hoanTac() cua app — xem "9. Noi day".
     Nguoi go mot thay doi moi thi xoa ngan lam lai cua app.
     ================================================================== */
  var lichSu = { truoc: [], sau: [] };
  var GIOI_HAN_LICH_SU = 100;
  var GIOI_HAN_KY_TU_LICH_SU = 40 * 1024 * 1024;  /* van ban lon: bot buoc cu */
  /* Nut o dau trang (moi tab) + bi danh cu trong thanh cong cu tab Cay. */
  var nutHoanTac = [$("#nut-hoan-tac"), $("#cay-hoan-tac")];
  var nutLamLai = [$("#nut-lam-lai"), $("#cay-lam-lai")];

  function saoTrangThai(tt) {
    var r = Object.create(null);
    for (var k in tt) r[k] = tt[k];
    return r;
  }

  function anhChup(nhan) {
    return {
      s: layVb(), mo: saoTrangThai(trangThaiMo), che: cheDoMo, chon: hangChon, nhan: nhan || "",
      bd: nhap.selectionStart || 0, kt: nhap.selectionEnd || 0, cuon: nhap.scrollTop || 0
    };
  }

  /** Day mot anh chup vao ngan hoan tac (bo qua neu trung van ban dinh
      ngan — chi cap nhat nhan), roi cat theo tran so buoc / so ky tu. */
  function dayBuoc(buoc) {
    var t = lichSu.truoc;
    if (t.length && t[t.length - 1].s === buoc.s) {
      if (buoc.nhan) t[t.length - 1].nhan = buoc.nhan;
      return;
    }
    t.push(buoc);
    var tong = 0, i;
    for (i = 0; i < t.length; i++) tong += t[i].s.length;
    while (t.length > GIOI_HAN_LICH_SU || (t.length > 1 && tong > GIOI_HAN_KY_TU_LICH_SU)) {
      tong -= t.shift().s.length;
    }
  }

  /** Chup van ban HIEN TAI vao ngan hoan tac (truoc khi may ghi de len).
      Neu tu lan may ghi truoc nguoi dung da GO (van ban da khac ban may
      ghi), chen them mot buoc "Sửa tay" cho ban may ghi ay: cac buoc go
      goc cua trinh duyet se chet sau lan ghi nay, con buoc nay giu duoc
      trang thai do de hoan tac di qua — khong nhay coc qua phan da go. */
  function ghiLichSu(nhan) {
    if (goTuMay && vanBanMay !== null && layVb() !== vanBanMay) {
      var tay = anhChup("Sửa tay");
      tay.s = vanBanMay;
      dayBuoc(tay);
    }
    dayBuoc(anhChup(nhan));
    lichSu.sau = [];
    capNhatNutLichSu();
  }

  /** MOI lan may ghi van ban di qua day: mot buoc hoan tac co nhan, roi
      lam tuoi chung (kiem loi, cay, luu nhap, to mau).
        tc.nhan       ten buoc ("Định dạng"…) — hien o nut va thong bao
        tc.sauKhiChup ham chay SAU khi chup lich su, TRUOC khi ghi (doi
                      trang thai gap/mo… de hoan tac tra ve trang thai cu)
        tc.chon / tc.viTriChon  [bd, kt] (hoac mot so) vung chon dat sau khi ghi
        tc.giuChon    giu vung chon dang co (ket vao do dai moi)
      Van ban moi y het van ban cu: khong ghi buoc nao (tra false). */
  function datVanBan(sMoi, tc) {
    tc = tc || {};
    sMoi = String(sMoi);
    chuanBiGhiLon(sMoi.length);
    if (sMoi === layVb()) {
      if (tc.sauKhiChup) { tc.sauKhiChup(); sauKhiDoi(); }
      return false;
    }
    var chon = tc.chon || tc.viTriChon;
    if (typeof chon === "number") chon = [chon, chon];
    if (!chon && tc.giuChon) chon = [nhap.selectionStart || 0, nhap.selectionEnd || 0];
    ghiLichSu(tc.nhan || "Sửa");
    if (tc.sauKhiChup) tc.sauKhiChup();
    datVb(sMoi);
    mayVuaGhi();
    if (chon) datChon(chon[0], chon[1]);
    moHinhSan = tc.goc !== undefined ? { s: sMoi, goc: tc.goc } : null;
    sauKhiDoi();
    phat("doi-lich-su", trangThaiLichSu());
    return true;
  }

  function datChon(bd, kt) {
    var n = layVb().length;
    bd = Math.max(0, Math.min(bd | 0, n));
    kt = Math.max(bd, Math.min(kt | 0, n));
    try { nhap.setSelectionRange(bd, kt); }
    catch (e) { nhap.selectionStart = bd; nhap.selectionEnd = kt; }
  }

  function quayLai(tu, toi, laHoan) {
    if (!tu.length) return false;
    dangSua = null;
    chuanBiGhiLon(tu[tu.length - 1].s.length);
    var a = tu.pop();
    toi.push(anhChup(a.nhan));
    datVb(a.s);
    mayVuaGhi();
    trangThaiMo = a.mo; cheDoMo = a.che; hangChon = a.chon;
    datChon(a.bd, a.kt);
    nhap.scrollTop = a.cuon;
    sauKhiDoi();
    capNhatNutLichSu();
    thongBao((laHoan ? "Đã hoàn tác" : "Đã làm lại") + (a.nhan ? ": " + a.nhan : ""));
    phat("doi-lich-su", trangThaiLichSu());
    return true;
  }

  /** Hoan tac cua app. Neu nguoi dung da GO tu lan may ghi gan nhat (phan
      nay chi nam trong ngan goc cua trinh duyet), buoc dau tien la bo phan
      da go — ve dung ban may ghi ("Sửa tay"), lam lai duoc — chu khong nhay
      qua no toi buoc may ghi truoc do. */
  function hoanTac() {
    if (goTuMay && vanBanMay !== null && layVb() !== vanBanMay) {
      var tay = anhChup("Sửa tay");
      tay.s = vanBanMay;
      dayBuoc(tay);
    }
    return quayLai(lichSu.truoc, lichSu.sau, true);
  }
  function lamLai() { return quayLai(lichSu.sau, lichSu.truoc, false); }

  function trangThaiLichSu() {
    var t = lichSu.truoc, s = lichSu.sau;
    return {
      soHoanTac: t.length, soLamLai: s.length,
      nhanHoanTac: t.length ? t[t.length - 1].nhan : "",
      nhanLamLai: s.length ? s[s.length - 1].nhan : ""
    };
  }

  /** Nguoi dung go mot thay doi MOI: nhanh lam lai cu khong con y nghia. */
  function boLamLai() {
    if (!lichSu.sau.length) return;
    lichSu.sau = [];
    capNhatNutLichSu();
    phat("doi-lich-su", trangThaiLichSu());
  }

  function capNhatNutLichSu() {
    var tt = trangThaiLichSu();
    var tieuHoan = tt.soHoanTac ? "Hoàn tác: " + (tt.nhanHoanTac || "thay đổi trước") + " (Ctrl+Z)" : "Hoàn tác (Ctrl+Z)";
    var tieuLam = tt.soLamLai ? "Làm lại: " + (tt.nhanLamLai || "thay đổi vừa hoàn tác") + " (Ctrl+Y)" : "Làm lại (Ctrl+Y hoặc Ctrl+Shift+Z)";
    nutHoanTac.forEach(function (b) { if (b) { b.disabled = !tt.soHoanTac; b.title = tieuHoan; } });
    nutLamLai.forEach(function (b) { if (b) { b.disabled = !tt.soLamLai; b.title = tieuLam; } });
  }

  /* ==================================================================
     4. Truy van duong dan

     Cu phap nho gon kieu JSONPath, chi phan hay dung:
       $        goc
       .khoa    vao khoa
       [0]      phan tu thu 0
       [*]      moi phan tu / moi gia tri
       ..khoa   tim khoa do o MOI CAP, khong can biet nam sau bao nhieu
     ================================================================== */
  function truyVan(goc, duong) {
    duong = String(duong || "").trim();
    if (!duong || duong === "$") return [{ d: "$", v: goc }];
    if (duong[0] === "$") duong = duong.slice(1);

    var ra = [{ d: "$", v: goc }];
    var i = 0;
    while (i < duong.length) {
      var c = duong[i];
      if (c === ".") {
        if (duong[i + 1] === ".") {
          /* Tim sau: gom moi nut co khoa nay, o bat ky cap nao. */
          i += 2;
          var ten = "";
          while (i < duong.length && /[\w$-]/.test(duong[i])) ten += duong[i++];
          var gom = [];
          ra.forEach(function (n) { quetSau(n.v, n.d, ten, gom); });
          ra = gom;
        } else {
          i++;
          var t2 = "";
          while (i < duong.length && /[\w$-]/.test(duong[i])) t2 += duong[i++];
          ra = vaoKhoa(ra, t2);
        }
      } else if (c === "[") {
        var dong2 = duong.indexOf("]", i);
        if (dong2 < 0) throw new Error("thiếu dấu ] ");
        var trong = duong.slice(i + 1, dong2).trim().replace(/^['"]|['"]$/g, "");
        i = dong2 + 1;
        if (trong === "*") {
          var gom2 = [];
          ra.forEach(function (n) {
            if (Array.isArray(n.v)) {
              n.v.forEach(function (x, k) { gom2.push({ d: n.d + "[" + k + "]", v: x }); });
            } else if (n.v && typeof n.v === "object") {
              Object.keys(n.v).forEach(function (k) { gom2.push({ d: n.d + "." + k, v: n.v[k] }); });
            }
          });
          ra = gom2;
        } else {
          ra = vaoKhoa(ra, trong);
        }
      } else {
        throw new Error("không hiểu ký tự “" + c + "”");
      }
    }
    return ra;
  }

  /** Nut `v` co khoa `khoa` (CHUOI, lay tu bieu thuc) cua RIENG no khong.
      Truoc day dung `khoa in v` nen $.toString, $.o.constructor tra ve ham
      cua nguyen mau, con $.mang.length tra 3. Mang: chi chi so hop le. */
  function coKhoaTruyVan(v, khoa) {
    if (!laNhanh(v)) return false;
    if (Array.isArray(v)) return /^(0|[1-9]\d*)$/.test(khoa) && +khoa < v.length;
    return coRieng(v, khoa);
  }

  function vaoKhoa(ds, khoa) {
    var ra = [];
    ds.forEach(function (n) {
      if (coKhoaTruyVan(n.v, khoa)) {
        ra.push({
          d: n.d + (Array.isArray(n.v) ? "[" + khoa + "]" : "." + khoa),
          v: n.v[khoa]
        });
      }
    });
    return ra;
  }

  function quetSau(v, duong, ten, gom) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(function (x, k) { quetSau(x, duong + "[" + k + "]", ten, gom); });
    } else {
      Object.keys(v).forEach(function (k) {
        var d2 = duong + "." + k;
        if (k === ten) gom.push({ d: d2, v: v[k] });
        quetSau(v[k], d2, ten, gom);
      });
    }
  }

  /** Gia tri cua mot ket qua truy van -> chu hien ra. KHONG BAO GIO nem
      loi: gia tri khong stringify duoc (undefined, ham, long qua sau) van
      hien mot dong mo ta thay vi lam hong ca danh sach ket qua. */
  function chuoiKetQua(v) {
    var s;
    try { s = JSON.stringify(v, null, 2); }
    catch (e) { return "(không hiển thị được — " + moTaLoiNem(e) + ")"; }
    return s === undefined ? String(v) : s;
  }

  /** Nhu chuoiKetQua nhung gon mot dong (cho danh sach khac biet). */
  function chuoiGon(v) {
    var s;
    try { s = JSON.stringify(v); }
    catch (e) { return "(không hiển thị được — " + moTaLoiNem(e) + ")"; }
    return s === undefined ? String(v) : s;
  }

  function chayTruyVan() {
    var ra = $("#loc-ket");
    if (!doc()) { ra.textContent = "JSON chưa hợp lệ — sửa ở tab Soạn trước."; return; }
    var duong = $("#loc-duong").value, kq;
    try {
      kq = truyVan(duLieu, duong);
    } catch (e) {
      ra.textContent = e && e.name === "RangeError"
        ? "Không chạy được truy vấn — " + moTaLoiNem(e)
        : "Đường dẫn sai: " + e.message;
      return;
    }
    if (!kq.length) { ra.textContent = "Không khớp nút nào."; return; }
    ra.textContent = kq.map(function (n) {
      return n.d + "\n  " + chuoiKetQua(n.v).split("\n").join("\n  ");
    }).join("\n\n") + "\n\n— " + kq.length + " kết quả";
  }

  /* ==================================================================
     5. So sanh hai cay

     So theo DUONG DAN chu khong theo chuoi: doi thu tu khoa trong object
     khong bi tinh la khac nhau, vi JSON khong quy dinh thu tu khoa. Con
     thu tu phan tu MANG thi co y nghia, nen van so theo chi so.
     ================================================================== */
  function khacNhau(a, b, duong, ra) {
    duong = duong || "$";
    ra = ra || [];
    var ka = kieuCua(a), kb = kieuCua(b);
    if (ka !== kb) {
      ra.push({ loai: "doi", d: duong, a: a, b: b });
      return ra;
    }
    if (ka === "object") {
      /* Chi khoa RIENG (truoc day dung `in`: {constructor:1} vs {} bi bao
         "doi" thay vi "bot"). Tap khoa khong co nguyen mau, de khoa
         "__proto__" cung la mot khoa binh thuong. */
      var keys = Object.create(null);
      Object.keys(a).forEach(function (k) { keys[k] = 1; });
      Object.keys(b).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).sort().forEach(function (k) {
        if (!coRieng(a, k)) ra.push({ loai: "them", d: duong + "." + k, b: b[k] });
        else if (!coRieng(b, k)) ra.push({ loai: "bot", d: duong + "." + k, a: a[k] });
        else khacNhau(a[k], b[k], duong + "." + k, ra);
      });
    } else if (ka === "array") {
      var n = Math.max(a.length, b.length);
      for (var i = 0; i < n; i++) {
        if (i >= a.length) ra.push({ loai: "them", d: duong + "[" + i + "]", b: b[i] });
        else if (i >= b.length) ra.push({ loai: "bot", d: duong + "[" + i + "]", a: a[i] });
        else khacNhau(a[i], b[i], duong + "[" + i + "]", ra);
      }
    } else if (a !== b) {
      ra.push({ loai: "doi", d: duong, a: a, b: b });
    }
    return ra;
  }

  function chaySoSanh() {
    var ra = $("#ss-ket");
    if (!doc()) { ra.textContent = "JSON bên Soạn chưa hợp lệ."; return; }
    var b;
    try { b = JSON.parse($("#ss-nhap").value); }
    catch (e) { ra.textContent = "JSON thứ hai không hợp lệ: " + gonLoi(e); return; }

    var ds;
    try { ds = khacNhau(duLieu, b); }
    catch (e) { ra.textContent = "Không so sánh được — " + moTaLoiNem(e); return; }
    if (!ds.length) {
      ra.innerHTML = '<p style="color:var(--ok)">✔ Hai JSON <b>giống hệt nhau</b> về nội dung.' +
        '<br><span class="phu">(Thứ tự khoá trong object không tính là khác — ' +
        'JSON không quy định thứ tự khoá.)</span></p>';
      return;
    }
    var html = '<p class="phu">' + ds.length + " khác biệt · " +
      '<span style="color:var(--ok)">+ thêm</span> · ' +
      '<span style="color:var(--loi)">− bớt</span> · ' +
      '<span style="color:var(--ba)">~ đổi</span></p>';
    ds.forEach(function (k) {
      var dau = k.loai === "them" ? "+" : k.loai === "bot" ? "−" : "~";
      var gia = k.loai === "them" ? chuoiGon(k.b)
              : k.loai === "bot" ? chuoiGon(k.a)
              : chuoiGon(k.a) + "  →  " + chuoiGon(k.b);
      if (gia && gia.length > 160) gia = gia.slice(0, 160) + "…";
      html += '<div class="hang-kh ' + k.loai + '">' +
        '<span class="dau-kh">' + dau + "</span>" +
        '<span class="duong">' + thoat(k.d) + "</span>" +
        '<span class="gia">' + thoat(gia) + "</span></div>";
    });
    ra.innerHTML = html;
  }

  /* ==================================================================
     6. Thong ke
     ================================================================== */
  function veThongKe() {
    var ra = $("#tk-ket");
    if (!doc()) { ra.textContent = "JSON chưa hợp lệ."; return; }
    var d = dem(duLieu);              /* lap: chiu duoc du lieu long rat sau */
    var chuoi = layVb();
    var gon = null;
    try { gon = JSON.stringify(duLieu); } catch (e) { gon = null; }
    var kieu = d.kieu;

    var hang = [
      ["Tổng số nút", d.nut.toLocaleString("vi")],
      ["Nút lá (giá trị)", d.la.toLocaleString("vi")],
      ["Object", d.obj.toLocaleString("vi")],
      ["Mảng", d.mang.toLocaleString("vi")],
      ["Độ sâu lớn nhất", (d.sau + 1) + " cấp"],
      ["Kích thước hiện tại", coChu(chuoi.length)],
      ["Sau khi nén", gon === null ? "không tính được (dữ liệu lồng quá sâu)"
        : coChu(gon.length) + "  (−" +
          (chuoi.length ? Math.round((1 - gon.length / chuoi.length) * 100) : 0) + "%)"]
    ];
    Object.keys(kieu).sort().forEach(function (k) {
      hang.push(["… kiểu " + k, kieu[k].toLocaleString("vi")]);
    });

    ra.innerHTML = "<table class='bang'>" + hang.map(function (h) {
      return "<tr><td>" + h[0] + "</td><td>" + h[1] + "</td></tr>";
    }).join("") + "</table>";
  }

  function coChu(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  /* ==================================================================
     7. Luu nhap — de khoi mat khi lo dong tab (KHONG am tham)

     <= NGUONG_NHAP_LON (2 MB ky tu): localStorage (nhanh, dong bo).
     Lon hon, hoac localStorage tu choi (day / bi chan): IndexedDB
     ("json-editor" / "nhap"), ghi tre 1 s sau lan sua cuoi (va ngay khi
     roi trang). Hai noi LOAI TRU nhau: ghi o dau thi xoa o kia — ban nhap
     cu khong bao gio song lai o lan tai trang sau.

     Khong luu duoc o ca hai: XOA ban cu (de khong hien mot ban cu hon so
     voi cai nguoi dung dang co), ghi co `json-editor:nhap-qua-lon` va hien
     bang bao co nut "Tai ve". Lan mo trang sau con nhac mot lan nua.
     ================================================================== */
  var KHOA = "json-editor:nhap";
  var KHOA_QUA_LON = "json-editor:nhap-qua-lon";
  var IDB_TEN = "json-editor", IDB_KHO = "nhap";
  var henLuuLon = 0, daLuuIdb = false;
  var bangNhap = $("#bang-nhap"), bangNhapChu = $("#bang-nhap-chu");
  var bangNhapTai = $("#bang-nhap-tai"), bangNhapDong = $("#bang-nhap-dong");

  /** Hien / an bang bao ve ban nhap. loai: "loi" | "ok" | null (an). */
  function hienBangNhap(chu, loai, coTai) {
    if (!bangNhap) return;
    bangNhap.hidden = !chu;
    if (!chu) return;
    bangNhapChu.textContent = chu;
    bangNhap.className = "bang-goi-y bang-nhap" + (loai === "ok" ? " ok" : "");
    bangNhapTai.hidden = !coTai;
  }

  function lsDat(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsXoa(k) { try { localStorage.removeItem(k); } catch (e) { /* khong co gi de xoa */ } }
  function lsLay(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* --- IndexedDB (moi lenh tra Promise; khong co IndexedDB thi tu choi) --- */
  function idbMo() {
    return new Promise(function (xong, loi) {
      if (typeof indexedDB === "undefined" || !indexedDB) { loi(new Error("trình duyệt không có IndexedDB")); return; }
      var rq;
      try { rq = indexedDB.open(IDB_TEN, 1); } catch (e) { loi(e); return; }
      rq.onupgradeneeded = function () { try { rq.result.createObjectStore(IDB_KHO); } catch (e) { /* da co */ } };
      rq.onsuccess = function () { xong(rq.result); };
      rq.onerror = function () { loi(rq.error || new Error("không mở được IndexedDB")); };
      rq.onblocked = function () { loi(new Error("IndexedDB bị chặn")); };
    });
  }
  /** Chay `ham(kho)` trong mot giao dich; xong khi giao dich HOAN TAT (hoac that bai: Quota…). */
  function idbChay(che, ham) {
    return idbMo().then(function (db) {
      return new Promise(function (xong, loi) {
        var kq, tx;
        try { tx = db.transaction(IDB_KHO, che); kq = ham(tx.objectStore(IDB_KHO)); }
        catch (e) { try { db.close(); } catch (x) { /* thoi */ } loi(e); return; }
        tx.oncomplete = function () { db.close(); xong(kq && "result" in kq ? kq.result : undefined); };
        tx.onerror = function () { db.close(); loi(tx.error || (kq && kq.error) || new Error("giao dịch IndexedDB lỗi")); };
        tx.onabort = function () { db.close(); loi(tx.error || new Error("giao dịch IndexedDB bị huỷ")); };
      });
    });
  }
  function idbGhi(s) { return idbChay("readwrite", function (k) { return k.put({ s: s, n: s.length, luc: Date.now() }, "nhap"); }); }
  function idbDoc() { return idbChay("readonly", function (k) { return k.get("nhap"); }); }
  function idbXoa() { return idbChay("readwrite", function (k) { return k["delete"]("nhap"); }); }

  function moTaLoiLuu(e) {
    var ten = e && e.name, chu = String(e && e.message || e || "");
    if (ten === "QuotaExceededError" || /quota/i.test(chu)) return "hết dung lượng lưu trữ của trình duyệt";
    return chu || "lỗi không rõ";
  }

  /** Khong luu duoc o ca hai noi: xoa ban cu, ghi co, hien bang bao. */
  function luuThatBai(n, e) {
    lsXoa(KHOA);
    if (daLuuIdb) { daLuuIdb = false; idbXoa().then(null, function () {}); }
    lsDat(KHOA_QUA_LON, JSON.stringify({ n: n, luc: Date.now() }));
    hienBangNhap("Bản nháp " + coChu(n) + " không tự lưu được (" + moTaLoiLuu(e) +
      ") — tải về để giữ lại, nếu đóng trang bản nháp sẽ mất.", "loi", true);
    phat("nhap", { luu: false, n: n });
  }

  function ghiNhapLon(s) {
    return idbGhi(s).then(function () {
      if (layVb() !== s) return;                       /* da sua tiep: lan ghi sau lo */
      daLuuIdb = true;
      lsXoa(KHOA); lsXoa(KHOA_QUA_LON);
      hienBangNhap("", null);
      phat("nhap", { luu: true, noi: "indexeddb", n: s.length });
    }, function (e) { if (layVb() === s) luuThatBai(s.length, e); });
  }

  function xaLuuLon() {
    clearTimeout(henLuuLon); henLuuLon = 0;
    luuNhap(true);
  }

  /** Ghi ban nhap hien tai. `ngay` bo qua debounce cua IndexedDB (roi trang). */
  function luuNhap(ngay) {
    var s = layVb();
    if (s.length <= HS.NGUONG_NHAP_LON && lsDat(KHOA, s)) {
      clearTimeout(henLuuLon); henLuuLon = 0;
      lsXoa(KHOA_QUA_LON);
      if (daLuuIdb) { daLuuIdb = false; idbXoa().then(null, function () {}); }
      if (bangNhap && !bangNhap.hidden) hienBangNhap("", null);          /* da luu duoc: bang bao (loi / "da khoi phuc") het y nghia */
      return;
    }
    /* Lon, hoac localStorage khong ghi duoc: bo ban cu o localStorage roi dua sang IndexedDB. */
    lsXoa(KHOA);
    clearTimeout(henLuuLon);
    if (ngay === true) { ghiNhapLon(s); return; }
    henLuuLon = setTimeout(function () { henLuuLon = 0; ghiNhapLon(layVb()); }, HS.DEBOUNCE_NHAP_LON);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && henLuuLon) xaLuuLon();
  });
  if (window.addEventListener) window.addEventListener("pagehide", function () { if (henLuuLon) xaLuuLon(); });

  function docNhap() {
    var v = lsLay(KHOA);
    return v === null ? "" : v;
  }

  /** Nap ban nhap tu IndexedDB khi localStorage khong co (async). Khong dap len thu nguoi dung da go / da mo trong luc cho. */
  function khoiPhucNhapLon() {
    var qua = lsLay(KHOA_QUA_LON);
    if (qua) {
      var th = null;
      try { th = JSON.parse(qua); } catch (e) { th = null; }
      hienBangNhap("Lần trước bản nháp" + (th && th.n ? " " + coChu(th.n) : "") +
        " không tự lưu được nên đã mất khi đóng trang. Tài liệu lớn: hãy bấm Tải về trước khi đóng.", "loi", false);
    }
    idbDoc().then(function (rec) {
      if (!rec || typeof rec.s !== "string" || !rec.s) return;
      if (layVb() !== "" || lichSu.truoc.length) return;          /* nguoi dung da lam viec khac */
      daLuuIdb = true;
      chuanBiGhiLon(rec.s.length);
      datVb(rec.s);
      mayVuaGhi();
      doc(); veCay(); henToMau();
      hienBangNhap("Đã khôi phục bản nháp " + coChu(rec.s.length) + " từ lần trước.", "ok", false);
      phat("nhap", { khoiPhuc: true, n: rec.s.length });
    }, function () { /* khong doc duoc: coi nhu khong co ban nhap */ });
  }

  if (bangNhapDong) bangNhapDong.onclick = function () { lsXoa(KHOA_QUA_LON); hienBangNhap("", null); };
  if (bangNhapTai) bangNhapTai.onclick = function () { $("#nut-luu").click(); };

  /* ==================================================================
     8. To mau cu phap

     Muon lop <pre> trung khit textarea thi MOI thu anh huong toi bo cuc
     phai giong het (xem .lop-mau trong kieu.css): font, co chu, dong cao,
     le, tab-size, cach xuong dong, be rong — be rong lay tu clientWidth
     cua textarea, tuc DA TRU thanh cuon — va vi tri cuon.

     To theo TUNG DONG: chuoi JSON khong duoc chua xuong dong (go do thi
     chuoi chua dong dung o cuoi dong), nen moi dong to doc lap — chi tru
     mot ca: khoa ma dau hai cham nam o dong DUOI ("k"\n : 1), co rieng
     mot co haiChamSau cho dong ay. Nho vay khi go, chi dong nao doi moi
     phai to va ve lai (xem capNhatHang), van ban 300 KB van go muot.

     toMau() / toMauDong() la ham THUAN va chiu duoc JSON hong / dang go
     do: khong bao gio nem loi, ky tu la thi giu nguyen (da thoat HTML).
     Moi ky tu dau vao xuat hien DUNG MOT LAN trong dau ra sau khi bo the.
     ================================================================== */
  /* Tran to mau: xem HS.GIOI_HAN_MAU (khi ngat dong, ve toan van ban) va HS.NGUONG_XEM (khong ngat dong: ao). */

  function laTrang(c) { return c === 32 || c === 10 || c === 13 || c === 9; }
  function laChuCai(c) { return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95 || c === 36; }
  function laChuSo(c) { return c >= 48 && c <= 57; }
  function laDau(c) { return c === 123 || c === 125 || c === 91 || c === 93 || c === 44 || c === 58; }
  function laKyTuSo(c) { return laChuSo(c) || c === 46 || c === 101 || c === 69 || c === 43 || c === 45; }
  function batDauToken(c) { return c === 34 || c === 45 || laChuSo(c) || laChuCai(c) || laDau(c); }

  var THE_MO = {
    "m-k": '<span class="m-k">', "m-s": '<span class="m-s">', "m-n": '<span class="m-n">',
    "m-b": '<span class="m-b">', "m-z": '<span class="m-z">', "m-p": '<span class="m-p">'
  };
  var CO_KY_TU_HTML = /[&<>]/;

  function phatDoan(s, lop, a, b) {
    if (a >= b) return "";
    var t = thoat(s.slice(a, b));
    return lop ? THE_MO[lop] + t + "</span>" : t;
  }

  /** Token [a, b) co chua cho loi `loi`: tach ra, boc ky tu loi (ca cap
      surrogate neu la emoji — tach doi thi hai nua thanh hai o vuong). */
  function phatCoLoi(s, lop, a, b, loi) {
    var cuoi = loi + 1, c = s.charCodeAt(loi), c2 = s.charCodeAt(loi + 1);
    if (c >= 0xd800 && c <= 0xdbff && c2 >= 0xdc00 && c2 <= 0xdfff) cuoi++;
    if (cuoi > b) cuoi = b;
    return phatDoan(s, lop, a, loi) + '<span class="m-loi">' + thoat(s.slice(loi, cuoi)) + "</span>" +
      phatDoan(s, lop, cuoi, b);
  }

  /** To MOT dong (khong chua "\n"). `haiCham`: ky tu that dau tien SAU
      dong nay la ":" — chuoi dung cuoi dong khi ay la khoa. `loi`: cot
      (tu 0) cua ky tu loi trong dong, hoac -1. */
  function toMauDong(s, haiCham, loi) {
    s = String(s);
    var n = s.length, ra = "", i = 0, j, k, c, d, lop, t;
    if (!(loi >= 0 && loi < n)) loi = -1;
    while (i < n) {
      c = s.charCodeAt(i);
      if (c === 34) {                                   /* "chuoi" */
        j = i + 1;
        while (j < n) {
          d = s.charCodeAt(j);
          if (d === 92) { j += 2; continue; }           /* \x: bo qua ky tu ke */
          if (d === 34) { j++; break; }
          if (d === 13) break;
          j++;
        }
        if (j > n) j = n;
        /* La KHOA neu theo sau (bo khoang trang) la dau hai cham. */
        k = j;
        while (k < n && laTrang(s.charCodeAt(k))) k++;
        lop = (k < n ? s.charCodeAt(k) === 58 : !!haiCham) ? "m-k" : "m-s";
      } else if (c === 45 || laChuSo(c)) {              /* so */
        j = i + 1;
        while (j < n && laKyTuSo(s.charCodeAt(j))) j++;
        lop = "m-n";
      } else if (laChuCai(c)) {                         /* true / false / null / chu la */
        j = i + 1;
        while (j < n && (laChuCai(s.charCodeAt(j)) || laChuSo(s.charCodeAt(j)))) j++;
        t = s.slice(i, j);
        lop = t === "true" || t === "false" ? "m-b" : t === "null" ? "m-z" : "";
      } else if (laDau(c)) {                            /* { } [ ] , : */
        j = i + 1;
        while (j < n && laDau(s.charCodeAt(j))) j++;
        lop = "m-p";
      } else {                                          /* khoang trang va ky tu la */
        j = i + 1;
        while (j < n && !batDauToken(s.charCodeAt(j))) j++;
        lop = "";
      }
      if (loi >= i && loi < j) {
        ra += phatCoLoi(s, lop, i, j, loi);
      } else {
        t = s.slice(i, j);
        /* chi chuoi va ky tu la moi co the chua & < > */
        if ((lop === "m-s" || lop === "m-k" || lop === "") && CO_KY_TU_HTML.test(t)) t = thoat(t);
        ra += lop ? THE_MO[lop] + t + "</span>" : t;
      }
      i = j;
    }
    return ra;
  }

  /** Voi moi dong: ky tu that dau tien o cac dong SAU no co phai ":" khong. */
  function haiChamSau(dong, tiepDau) {
    var ra = new Array(dong.length), tiep = !!tiepDau;
    for (var i = dong.length - 1; i >= 0; i--) {
      ra[i] = tiep;
      var d = dong[i], k = 0;
      while (k < d.length && laTrang(d.charCodeAt(k))) k++;
      if (k < d.length) tiep = d.charCodeAt(k) === 58;
    }
    return ra;
  }

  /** Van ban -> HTML co the <span class="m-…">. `loiTai` (tuy chon): chi so
      ky tu se boc trong <span class="m-loi">. */
  function toMau(s, loiTai) {
    s = s === null || s === undefined ? "" : String(s);
    var dong = s.split("\n"), co = haiChamSau(dong), ra = new Array(dong.length), vt = 0;
    var loi = typeof loiTai === "number" && loiTai >= 0 && loiTai < s.length ? loiTai : -1;
    for (var i = 0; i < dong.length; i++) {
      var dai = dong[i].length;
      ra[i] = toMauDong(dong[i], co[i], loi >= vt && loi < vt + dai ? loi - vt : -1);
      vt += dai + 1;
    }
    return ra.join("\n");
  }

  var henMau = 0;
  var mauDaVeLoi = -2;     /* vi tri loi da to tren lop mau (-1: khong to) */
  var mauBan = true;       /* phai to lai khi tab Soan hien ra */
  var kichMau = { w: 0, h: 0 };
  var rafCo = typeof window.requestAnimationFrame === "function";
  function henKhung(f) { return rafCo ? window.requestAnimationFrame(f) : setTimeout(f, 16); }

  function henToMau() {
    if (henMau) return;
    henMau = henKhung(function () { henMau = 0; veMau(); });
  }

  /** Len lich ve lai so dong ao + lop to mau (khung hinh ke tiep). */
  function henVeAo() { henToMau(); }

  function dongBoKichThuoc() {
    var w = nhap.clientWidth, h = nhap.clientHeight;
    if (!w || !h) return;
    if (w !== kichMau.w) { lopMau.style.width = w + "px"; kichMau.w = w; }
    if (h !== kichMau.h) { lopMau.style.height = h + "px"; kichMau.h = h; }
  }

  function dongBoCuon() {
    lopMau.scrollTop = nhap.scrollTop;
    lopMau.scrollLeft = nhap.scrollLeft;
  }

  /* --- ve len lop mau: MOT <span class="h"> (display:block) cho moi dong,
     gom thanh tung khoi <div class="k"> toi da KHOI dong (ly do nhu o so
     dong: go mot phim chi bat trinh duyet xep lai ~n/64 khoi + mot khoi,
     khong phai ca n dong — tren 250 KB do la khac biet giua go muot va
     giat). Dong rong phai co mot ky tu (zero-width space) — the rong cao
     0, con textarea thi van danh mot dong cho no. Xuong dong la do cac
     khoi, nen KHONG co "\n" nao trong DOM cua lop mau. --- */
  var mauDong = [];                     /* cac dong dang ve tren lop mau */
  var mauCo = [];                       /* co haiChamSau cua chung */
  var mauKhoi = [];                     /* so dong cua tung khoi */
  var mauLoi = { dong: -1, cot: -1 };   /* cho dang to do */

  function noiDungHang(dong, co, cot) {
    return dong ? toMauDong(dong, co, cot) : "​";
  }

  /** HTML cho cac dong [a, b) cua `moi`, cat thanh khoi KHOI dong. */
  function htmlKhoi(moi, co, a, b, ld, lc) {
    var html = "", dem = [], i, j;
    for (i = a; i < b; i = j) {
      j = Math.min(b, i + KHOI);
      html += '<div class="k">';
      for (var x = i; x < j; x++) {
        html += '<span class="h">' + noiDungHang(moi[x], co[x], x === ld ? lc : -1) + "</span>";
      }
      html += "</div>";
      dem.push(j - i);
    }
    return { html: html, dem: dem };
  }

  /** The <span class="h"> cua dong k (tinh tu 0). */
  function theDong(k) {
    var bd = 0, khoi = lopMau.children;
    for (var c = 0; c < mauKhoi.length; c++) {
      if (k < bd + mauKhoi[c]) return khoi[c] && khoi[c].children ? khoi[c].children[k - bd] : null;
      bd += mauKhoi[c];
    }
    return null;
  }

  /** So dong moi voi dong dang ve: bo phan dau va phan cuoi GIONG NHAU,
      chi ve lai cac khoi chua doan o giua (go mot phim = mot khoi). Cho
      to loi doi thi ve lai rieng dong cu va dong moi cua no. */
  function capNhatHang(moi, co, ld, lc) {
    var cu = mauDong, coCu = mauCo, nCu = cu.length, nMoi = moi.length;
    var max = Math.min(nCu, nMoi), dau = 0, cuoi = 0, i, kq;
    while (dau < max && cu[dau] === moi[dau] && coCu[dau] === co[dau]) dau++;
    while (cuoi < max - dau && cu[nCu - 1 - cuoi] === moi[nMoi - 1 - cuoi] &&
           coCu[nCu - 1 - cuoi] === co[nMoi - 1 - cuoi]) cuoi++;
    var soCu = nCu - dau - cuoi, soMoi = nMoi - dau - cuoi;
    var khoi = lopMau.children;
    var veLaiTu = 0, veLaiToi = nMoi;        /* doan dong (moi) da ve lai */

    if (!nCu || !khoi || khoi.length !== mauKhoi.length || soMoi + soCu > nMoi / 2) {
      /* lan dau, hoac doi gan het (dinh dang, mo tep…): ve ca */
      kq = htmlKhoi(moi, co, 0, nMoi, ld, lc);
      lopMau.innerHTML = kq.html;
      mauKhoi = kq.dem;
    } else if (soCu || soMoi) {
      /* Cac khoi cu chua dong cu [dau, dau + soCu) — hoac chua cho chen. */
      var dauCu = Math.min(dau, nCu - 1), cuoiCu = Math.min(dau + Math.max(soCu, 1) - 1, nCu - 1);
      var ci = -1, cj = -1, bd = 0, bdCi = 0, ktCj = 0;
      for (i = 0; i < mauKhoi.length; i++) {
        var kt = bd + mauKhoi[i];
        if (ci < 0 && dauCu < kt) { ci = i; bdCi = bd; }
        if (cuoiCu < kt) { cj = i; ktCj = kt; break; }
        bd = kt;
      }
      veLaiTu = bdCi;
      veLaiToi = ktCj - soCu + soMoi;
      kq = htmlKhoi(moi, co, veLaiTu, veLaiToi, ld, lc);
      var sau = khoi[cj + 1] || null;
      var r = document.createRange();
      r.setStartBefore(khoi[ci]);
      r.setEndAfter(khoi[cj]);
      r.deleteContents();
      if (kq.html) {
        if (sau) sau.insertAdjacentHTML("beforebegin", kq.html);
        else lopMau.insertAdjacentHTML("beforeend", kq.html);
      }
      mauKhoi.splice.apply(mauKhoi, [ci, cj - ci + 1].concat(kq.dem));
    } else {
      veLaiTu = veLaiToi = 0;
    }

    /* Cho to do nam tren dong KHONG bi ve lai: sua rieng dong ay. */
    var lCu = mauLoi.dong < 0 ? -1
            : mauLoi.dong < dau ? mauLoi.dong
            : mauLoi.dong >= nCu - cuoi ? mauLoi.dong + nMoi - nCu : -1;
    var veLaiDong = function (k) {
      if (k < 0 || k >= nMoi || (k >= veLaiTu && k < veLaiToi)) return;
      var t = theDong(k);
      if (t) t.innerHTML = noiDungHang(moi[k], co[k], k === ld ? lc : -1);
    };
    if (lCu !== ld || mauLoi.cot !== lc) {
      veLaiDong(lCu);
      if (ld !== lCu) veLaiDong(ld);
    }
    mauDong = moi; mauCo = co; mauLoi = { dong: ld, cot: lc };
  }

  /* --- lop to mau AO (khong ngat dong): khung cao bang ca van ban, mot cua so
     ~100 hang tuyet doi tai top = dong dau x 21px. Moi hang la mot dong that,
     nen toMauDong (ham thuan, khong doi) dung nguyen. --- */
  var maKhung = null, maCua = null;
  var maVe = { s: null, tu: -1, den: -1, loi: -2, lh: 0 };

  /** Dong sau `den` (0-based): ky tu that dau tien co phai ":" khong (de to dung khoa
      o cuoi cua so). Nhin toi da 64 dong. */
  function haiChamSauCuaSo(s, chiSo, den) {
    var n = chiSo.length;
    for (var j = den; j < n && j < den + 64; j++) {
      var b = chiSo[j], e = j + 1 < n ? chiSo[j + 1] - 1 : s.length;
      for (var k = b; k < e; k++) {
        var c = s.charCodeAt(k);
        if (!laTrang(c)) return c === 58;
      }
    }
    return false;
  }

  function veMauAo(s, chiSo) {
    var n = chiSo.length, cs = cuaSoDong(n), lh = doCaoDong;
    if (!maKhung || maKhung.parentNode !== lopMau) {
      lopMau.textContent = "";
      mauDong = []; mauCo = []; mauKhoi = []; mauLoi = { dong: -1, cot: -1 };
      maKhung = document.createElement("div"); maKhung.className = "mau-khung";
      maCua = document.createElement("div"); maCua.className = "mau-cua";
      maKhung.appendChild(maCua); lopMau.appendChild(maKhung);
      maVe = { s: null, tu: -1, den: -1, loi: -2, lh: 0 };
    }
    var loi = s === vanBanDaDoc ? loiTai : -1;
    var doi = s !== maVe.s || loi !== maVe.loi || lh !== maVe.lh ||
              cs.thay[0] < maVe.tu || cs.thay[1] > maVe.den ||
              (cs.thay[0] < maVe.tu + LE_CUA_SO && maVe.tu > 0) || (cs.thay[1] > maVe.den - LE_CUA_SO && maVe.den < n);
    if (!doi) return;
    var ld = -1, lc = -1, i, dong = [];
    if (loi >= 0) { ld = VT.dongCuaViTri(chiSo, loi) - 1; lc = loi - chiSo[ld]; }
    for (i = cs.tu; i < cs.den; i++) dong.push(s.slice(chiSo[i], i + 1 < n ? chiSo[i + 1] - 1 : s.length));
    var co = haiChamSau(dong, haiChamSauCuaSo(s, chiSo, cs.den)), html = "";
    for (i = 0; i < dong.length; i++) {
      var d = dong[i];
      html += '<span class="h">' + (!d ? "" : d.length > HS.DONG_DAI_MAU ? thoat(d)
              : toMauDong(d, co[i], cs.tu + i === ld ? lc : -1)) + "</span>";
    }
    maKhung.style.height = (n * lh) + "px";
    /* Be rong cuon ngang = cua textarea (no thay CA van ban, lop mau chi thay ~100 hang): neu khong, hang dai nam ngoai cua so
       lam textarea cuon duoc ma lop mau thi khong. 32 = le trai + phai cua .lop-mau. */
    maKhung.style.width = Math.max(0, (nhap.scrollWidth || 0) - 32) + "px";
    maCua.style.top = (cs.tu * lh) + "px";
    maCua.setAttribute("data-tu", String(cs.tu));
    maCua.innerHTML = html;
    maVe = { s: s, tu: cs.tu, den: cs.den, loi: loi, lh: lh };
    phat("ve-mau", { tu: cs.tu, den: cs.den });          /* cho ui-* (tim / thay) to them len cac hang vua ve */
  }

  /** Thanh "Tô màu đã tắt" o chan trang. */
  function baoMauHien(tat) {
    if (!baoMau) return;
    baoMau.hidden = !tat;
    if (tat) baoMau.textContent = "Tô màu đã tắt — nội dung trên " +
      (ngatDong ? "300 KB khi ngắt dòng (tắt ngắt dòng để tô tới 1,5 MB)" : "1,5 MB");
  }

  function veMau() {
    if (!lopMau || !vungSoan) return;
    if (oHien !== "soan" || cheDoSoan === "xem") { mauBan = true; return; }
    mauBan = false;
    var s = layVb();
    /* Dan / mo van ban qua lon: tu vao che do Xem (textarea khong sua noi tren muc nay). */
    if (s.length > HS.NGUONG_XEM && !suaTho && xemApi) { xemTuDong = true; datCheDoSoan("xem", { tuDong: true }); return; }
    var chiSo = chiSoCua(s);
    veSoDong(chiSo);
    var lon = s.length > (ngatDong ? HS.GIOI_HAN_MAU : HS.NGUONG_XEM);
    vungSoan.classList.toggle("co-mau", !lon);
    baoMauHien(lon);
    if (lon) {
      if (mauDong.length || maKhung) {
        lopMau.textContent = "";
        mauDong = []; mauCo = []; mauKhoi = []; mauLoi = { dong: -1, cot: -1 }; maKhung = null;
      }
      mauDaVeLoi = -3;
      return;
    }
    if (!ngatDong) {
      veMauAo(s, chiSo);
      mauDaVeLoi = s === vanBanDaDoc ? loiTai : -1;
      dongBoKichThuoc();
      dongBoCuon();
      return;
    }
    if (maKhung) { lopMau.textContent = ""; maKhung = null; mauDong = []; mauCo = []; mauKhoi = []; mauLoi = { dong: -1, cot: -1 }; }
    /* Chi to vi tri loi khi doc() da doc DUNG van ban nay — dang go do thi
       vi tri cu khong con dung nua. */
    var loi = s === vanBanDaDoc ? loiTai : -1, ld = -1, lc = -1;
    if (loi >= 0) {
      var vt = dongCot(s, loi);
      ld = vt.dong - 1; lc = vt.cot - 1;
    }
    var dong = s.split("\n");
    capNhatHang(dong, haiChamSau(dong), ld, lc);
    mauDaVeLoi = loi;
    dongBoKichThuoc();
    dongBoCuon();
  }

  /* ==================================================================
     8b. Che do o soan: Sua | Xem, ngat dong, tai lieu lon

     Textarea khong sua noi tai lieu lon (do that: ~0,1 s moi phim o 1,3 MB,
     ~1,6 s o 10 MB — rieng trinh duyet, chua tinh app). Tren NGUONG_XEM
     (1,5 MB ky tu) o soan tu chuyen sang Xem: cuon ao chi doc (ui-xem.js),
     textarea van giu van ban (nguon su that) nhung bi an. Sua tai lieu lon:
     tren Cay, "Sua khoi" trong Xem, hoac bam "Van sua van ban tho".
     ================================================================== */
  var cheDoSoan = "sua";         /* "sua" | "xem" */
  var suaTho = false;            /* nguoi dung chon van sua van ban tho khi van ban lon */
  var xemTuDong = false;         /* Xem do tu chuyen (qua lon), khong phai nguoi dung bam */
  var xemApi = null;             /* do ui-xem.js dang ky (JE_APP.dangKyXem) */
  var ngatDong = false;          /* "↩ Ngắt dòng" (nho o localStorage) */

  /** Sap ghi mot van ban `n` ky tu vao textarea: lon qua thi vao Xem (an textarea) TRUOC, de trinh duyet khong
      xep chu 12 MB trong textarea dang hien (~1,4 s). */
  function chuanBiGhiLon(n) {
    if (n > HS.NGUONG_XEM && !suaTho && xemApi && cheDoSoan !== "xem") {
      xemTuDong = true;
      datCheDoSoan("xem", { tuDong: true });
    }
  }

  /** Van ban da nho lai duoi nguong (hoan tac / xoa bot): Xem do tu chuyen thi tra ve Sua. */
  function tuChinhCheDo() {
    var n = vanBanDaDoc === null ? 0 : vanBanDaDoc.length;
    if (n <= HS.NGUONG_XEM) suaTho = false;
    if (cheDoSoan === "xem" && xemTuDong && n <= HS.NGUONG_XEM) datCheDoSoan("sua", { khongChon: true });
  }

  function capNhatBangLon() {
    if (!bangLon) return;
    var n = vanBanDaDoc === null ? layVb().length : vanBanDaDoc.length;
    var lon = n > HS.NGUONG_XEM, chu = "", coNut = false;
    if (lon && cheDoSoan === "xem") {
      chu = "Tài liệu lớn (" + coChu(n) + "): đang ở chế độ Xem — sửa trên Cây hoặc “Sửa khối”.";
      coNut = true;
      var sd = xemApi && xemApi.soDong ? xemApi.soDong() : 0;
      if (sd === 1) chu = "Một dòng " + coChu(n) + " — bấm Định dạng để xem và gập.";
    } else if (lon) {
      chu = "Đang sửa văn bản thô " + coChu(n) + " — trình duyệt sẽ chậm; tô màu đã tắt.";
    }
    bangLon.hidden = !chu;
    if (chu) {
      $("#bang-lon-chu").textContent = chu;
      $("#bang-lon-sua-tho").hidden = !coNut;
    }
  }

  /** Doi mat cua o soan. tc.tuDong: do qua lon; tc.giuViTri: dong (tu 1) can nhin thay. */
  function datCheDoSoan(che, tc) {
    tc = tc || {};
    if (che !== "xem") che = "sua";
    if (che === "xem" && !xemApi) return false;
    var cu = cheDoSoan;
    if (che === cu) { capNhatBangLon(); return true; }
    var dongHien = -1;
    if (cu === "sua" && che === "xem" && !tc.tuDong) {
      var s0 = layVb(), k0 = Math.min(nhap.selectionStart || 0, s0.length);
      dongHien = VT.dongCuaViTri(chiSoCua(s0), k0);
    }
    cheDoSoan = che;
    if (che === "sua" && vbNgoai !== null) {                     /* ra khoi Xem: dua van ban lon vao textarea (cham, nguoi dung da chon) */
      var vl = vbNgoai;
      vbNgoai = null;
      nhap.value = vl;
    } else if (che === "xem" && nhap.value.length > HS.NGUONG_XEM) {   /* vao Xem tu o Sua voi van ban lon: lay ra khoi textarea */
      vbNgoai = nhap.value;
      nhap.value = "";
    }
    if (!tc.tuDong) xemTuDong = false;
    if (oSoan) oSoan.classList.toggle("che-xem", che === "xem");
    var khungXem = $("#xem-khung");
    if (khungXem) khungXem.hidden = che !== "xem";
    els(".xem-chi").forEach(function (x) { x.hidden = che !== "xem"; });
    [[nutSua, che === "sua"], [nutXem, che === "xem"]].forEach(function (p) {
      if (!p[0]) return;
      p[0].classList.toggle("dang-chon", p[1]);
      p[0].setAttribute("aria-pressed", p[1] ? "true" : "false");
    });
    if (che === "xem") xemApi.vao({ dong: dongHien > 0 ? dongHien : 1, tuDong: !!tc.tuDong });
    else {
      var dongXem = xemApi && cu === "xem" && xemApi.dongDau ? xemApi.dongDau() : 1;
      if (xemApi && cu === "xem") xemApi.ra();
      mauBan = true;
      veMau();
      if (cu === "xem" && !tc.khongChon) {
        /* dua con tro toi dau dong nhin thay dau tien cua Xem, cuon toi do */
        var i = chiSoTu(layVb(), dongXem, 1);
        datChon(i, i);
        doKichThuocDong();
        nhap.scrollTop = Math.max(0, (dongXem - 1) * doCaoDong - 3 * doCaoDong);
        veMau();
      }
    }
    capNhatBangLon();
    phat("doi-che-do", che);
    return true;
  }

  function datNgatDong(b, luu) {
    ngatDong = !!b;
    if (vungSoan) vungSoan.classList.toggle("ngat-dong", ngatDong);
    if (nutNgat) { nutNgat.setAttribute("aria-pressed", ngatDong ? "true" : "false"); nutNgat.classList.toggle("dang-chon", ngatDong); }
    try { nhap.wrap = ngatDong ? "soft" : "off"; } catch (e) { /* khong ho tro */ }
    if (luu) lsDat("json-editor:ngat-dong", ngatDong ? "1" : "0");
    /* doi cach xep chu: lop mau + so dong ve lai tu dau */
    if (maKhung) { lopMau.textContent = ""; maKhung = null; }
    mauDong = []; mauCo = []; mauKhoi = []; mauLoi = { dong: -1, cot: -1 };
    sdVe = { tu: -1, den: -1, n: -1, loi: -2, lh: 0 };
    kichMau = { w: 0, h: 0 };
    henToMau();
  }

  /** Viec nang tren tai lieu lon: hien "Đang …" va nhuong mot khung hinh de trinh duyet ve truoc
      (parse / ghi 10 MB mat ~0,5 s — thong bao de nguoi dung khong tuong treo). */
  var BAN_NGUONG = 1024 * 1024;
  function chayCoBao(nhan, ham, kichThuoc) {
    var cho = kichThuoc !== undefined ? kichThuoc : layVb().length;
    if (cho <= BAN_NGUONG) return ham();
    datTrangThai("Đang " + nhan + " " + coChu(cho) + "…");
    den.className = "den";
    document.body.classList.add("dang-xu-ly");
    setTimeout(function () {
      try { ham(); }
      finally { document.body.classList.remove("dang-xu-ly"); }
    }, 40);
    return true;
  }

  /* ==================================================================
     9. Noi day
     ================================================================== */
  var hen = null;
  function khiNhap() {
    clearTimeout(hen);
    var cho = vanBanDaDoc !== null && vanBanDaDoc.length > HS.NGUONG_DEBOUNCE_LON ? HS.DEBOUNCE_DOC_LON : HS.DEBOUNCE_DOC;
    hen = setTimeout(function () { doc(); veCay(); luuNhap(); }, cho);
    henToMau();                        /* so dong + to mau ao: khung hinh ke tiep (khong dem dong trong su kien input) */
  }
  nhap.addEventListener("input", khiNhap);

  /* --- Ctrl+Z / Ctrl+Y trong textarea: hoan tac goc cho phan NGUOI GO tu
     lan may ghi gan nhat, con lai thuoc lich su app ----------------------
     Do that tren Edge 155 (check.py): gan .value KHONG xoa ngan hoan tac
     goc. Cac buoc go truoc lan gan ay thanh buoc "chet": hoan tac goc luc
     thi khong doi gi (van phat beforeinput/input "historyUndo"), luc thi
     CHEN LAI doan chu cu vao van ban moi (vd dan de ca van ban -> Sắp khoá
     -> … -> Mở tệp -> Ctrl+Z: noi dung tep bi ghep them JSON cu). Vi vay
     KHONG BAO GIO de trinh duyet cham toi buoc chet:
       - vanBanMay = van ban ngay sau lan may ghi gan nhat (datVanBan,
         hoanTac/lamLai, nap nhap); goTuMay = nguoi dung da go gi tu do.
       - Ctrl+Z: van ban con khac vanBanMay => con buoc go THAT => de trinh
         duyet hoan tac (tung cum ky tu). Bang vanBanMay => moi buoc goc con
         lai deu chet => chan phim, goi hoanTac() cua app.
       - Ctrl+Y: chi giao cho trinh duyet khi nguoi dung da go roi tu hoan
         tac goc (ngan lam lai goc la buoc song); khong thi lamLai() cua app.
     Hoan tac tu menu chuot phai / execCommand("undo") di qua beforeinput —
     chan o do neu trinh duyet cho huy. Sau khi giao cho trinh duyet ma van
     ban van y nguyen (khong co gi that de lam) thi cung roi ve app. */
  var vanBanMay = null;
  var goTuMay = false;

  function mayVuaGhi() { vanBanMay = layVb(); goTuMay = false; }

  /** Ctrl+Z (laHoan) / Ctrl+Y nay co giao cho hoan tac goc duoc khong. */
  function giaoChoGoc(laHoan) {
    if (layVb() !== vanBanMay) return true;
    return !laHoan && goTuMay;
  }

  function xuLyPhimLichSu(laHoan, e) {
    if (!giaoChoGoc(laHoan)) {
      e.preventDefault();
      if (laHoan) hoanTac(); else lamLai();
      return;
    }
    var truoc = layVb();
    setTimeout(function () {
      if (layVb() !== truoc) return;          /* trinh duyet da lam that */
      if (laHoan) hoanTac(); else lamLai();
    }, 0);
  }

  nhap.addEventListener("beforeinput", function (e) {
    var it = e.inputType;
    if (it !== "historyUndo" && it !== "historyRedo") return;
    var laHoan = it === "historyUndo";
    if (giaoChoGoc(laHoan) || !e.cancelable) return;
    e.preventDefault();
    if (laHoan) hoanTac(); else lamLai();
  });

  nhap.addEventListener("input", function (e) {
    var it = e && e.inputType || "";
    if (it === "historyUndo" || it === "historyRedo") return;
    goTuMay = true;
    boLamLai();                 /* nguoi dung go thay doi moi: nhanh lam lai cu het y nghia */
  });

  nhap.addEventListener("scroll", function () {
    soDong.scrollTop = nhap.scrollTop;
    dongBoCuon();
    /* Cuon ra khoi cua so dang ve: ve lai ~100 hang quanh vung nhin thay (so dong + lop mau ao). */
    if (chiSoVb && chiSoS !== null && cheDoSoan === "sua") {
      veSoDong(chiSoVb);
      if (!ngatDong && maKhung && maVe.s === chiSoS) veMauAo(chiSoS, chiSoVb);
    }
  });
  ["click", "keyup"].forEach(function (e) { nhap.addEventListener(e, capNhatViTri); });

  /* Doi co textarea (keo cua so, hien/an thanh cuon) -> doi co lop mau. */
  if (typeof window.ResizeObserver === "function") {
    new window.ResizeObserver(function () { dongBoKichThuoc(); dongBoCuon(); }).observe(nhap);
  } else if (window.addEventListener) {
    window.addEventListener("resize", function () { dongBoKichThuoc(); dongBoCuon(); });
  }

  /** Mot muc thut le theo KIEU van ban dang dung: tab, n dau cach, hay 2
      khi chua doan duoc (van ban rong / nen tren mot dong). Chi xet phan
      dau van ban — doan kieu tren 10 MB moi lan go Tab thi qua cham. */
  function donViThut(s) {
    s = String(s || "");
    var t = doThut(s.length > 200000 ? s.slice(0, 200000) : s);
    if (t === "\t") return "\t";
    return new Array((t > 0 ? t : 2) + 1).join(" ");
  }

  /* Tab trong textarea thut le theo kieu van ban, khong nhay ra khoi o.
     Chen bang execCommand de con hoan tac (Ctrl+Z) duoc va de su kien
     input chay — lop mau va so dong cap nhat theo.
     Duong thoat bang ban phim (WCAG 2.1.2 — khong bay ban phim): bam Esc
     roi Tab (hoac Shift+Tab) thi trinh duyet chuyen focus nhu binh thuong. */
  var vuaEsc = false;
  nhap.addEventListener("blur", function () { vuaEsc = false; });
  nhap.addEventListener("keydown", function (e) {
    if (e.isComposing || e.keyCode === 229) return;
    var k = e.key;
    if (k === "Shift" || k === "Control" || k === "Alt" || k === "Meta") return;
    if (k === "Escape") { vuaEsc = true; return; }
    var thoatO = vuaEsc;
    vuaEsc = false;

    if (k === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (thoatO) return;                     /* Esc roi Tab: roi o */
      e.preventDefault();
      var chen = donViThut(layVb()), daChen = false;
      try { daChen = document.execCommand("insertText", false, chen); } catch (x) { daChen = false; }
      if (!daChen) {
        var a = nhap.selectionStart, b = nhap.selectionEnd;
        datVanBan(layVb().slice(0, a) + chen + layVb().slice(b),
                  { nhan: "Thụt lề", chon: [a + chen.length, a + chen.length] });
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      var c = String(k).toLowerCase();
      if (c === "z" && !e.shiftKey) xuLyPhimLichSu(true, e);
      else if (c === "y" || (c === "z" && e.shiftKey)) xuLyPhimLichSu(false, e);
    }
  });

  $("#nut-dinh-dang").onclick = function () { dinhDang(2); };
  $("#nut-nen").onclick = nen;
  $("#nut-sap-khoa").onclick = function () {
    bienDoi("Sắp khoá", function (d) { return sapKhoaVanBan(d, layVb()); });
  };
  $("#nut-thoat").onclick = thoatChuoi;
  els("#nut-hoan-tac, #cay-hoan-tac").forEach(function (b) { b.onclick = hoanTac; });
  els("#nut-lam-lai, #cay-lam-lai").forEach(function (b) { b.onclick = lamLai; });

  $("#nut-mo").onclick = function () { $("#tep").click(); };
  $("#tep").onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      coTep.textContent = f.name + " · " + coChu(f.size);
      var vanBanTep = String(r.result);
      chayCoBao("mở", function () {
        datVanBan(vanBanTep, {
          nhan: "Mở tệp " + catNgan(f.name, 40),
          /* Tep moi: cay quay ve trang thai gap/mo mac dinh — doi SAU khi
             chup, de hoan tac tra lai ca trang thai cay cu. */
          sauKhiChup: function () {
            trangThaiMo = Object.create(null); cheDoMo = "sau"; hangChon = "[]";
            cuonCay = { top: 0, left: 0 };
            cayEl.scrollTop = 0;
          }
        });
        phat("mo-tep", { ten: f.name, vanBan: vanBanTep });
      }, vanBanTep.length);
    };
    r.readAsText(f);
    e.target.value = "";
  };

  $("#nut-luu").onclick = function () {
    var b = new Blob([layVb()], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "du-lieu.json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  $("#nut-chep").onclick = function () {
    nhap.select();
    var xong = function () {
      var cu = trangThai.textContent;
      trangThai.textContent = "Đã chép vào bộ nhớ tạm";
      setTimeout(function () { trangThai.textContent = cu; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(layVb()).then(xong, function () {
        try { document.execCommand("copy"); xong(); } catch (e) {}
      });
    } else {
      try { document.execCommand("copy"); xong(); } catch (e) {}
    }
  };

  $("#nut-sang-toi").onclick = function () {
    var sang = document.documentElement.getAttribute("data-sang") === "1";
    document.documentElement.setAttribute("data-sang", sang ? "0" : "1");
    try { localStorage.setItem("json-editor:sang", sang ? "0" : "1"); } catch (e) {}
  };

  /* --- Cay --- */
  /* "Mở hết" qua lon (> NGUONG_MO_HET nut): hoi truoc thay vi dung ca trieu the DOM (592 000 nut ~ 8 s). */
  var cayHoi = $("#cay-hoi");
  function anHoiCay() { if (cayHoi) cayHoi.hidden = true; }
  function moHetThat(che) {
    anHoiCay();
    cheDoMo = che; trangThaiMo = Object.create(null);
    veCay();
  }
  $("#cay-mo").onclick = function () {
    anHoiCay();
    var d = hopLe || dongBoDoc() ? dem(duLieu) : null;
    if (d && d.nut > HS.NGUONG_MO_HET && cayHoi) {
      $("#cay-hoi-chu").textContent = "Dựng " + TT.soCoDau(d.nut) + " nút (~" + Math.max(1, Math.round(d.nut * 0.000014)) + " giây)?";
      cayHoi.hidden = false;
      return;
    }
    moHetThat("mo");
  };
  if ($("#cay-hoi-cap3")) $("#cay-hoi-cap3").onclick = function () { capMo = 3; moHetThat("cap"); };
  if ($("#cay-hoi-het")) $("#cay-hoi-het").onclick = function () { moHetThat("mo"); };
  if ($("#cay-hoi-huy")) $("#cay-hoi-huy").onclick = anHoiCay;
  $("#cay-dong").onclick = function () {
    cheDoMo = "dong"; trangThaiMo = Object.create(null);
    veCay();
  };
  $("#cay-kieu").onchange = veCay;
  (function () {
    var luu = null;
    try { luu = localStorage.getItem("json-editor:kich-thuoc"); } catch (e) {}
    if (luu === "0") $("#cay-kich-thuoc").checked = false;
    hienKichThuoc = $("#cay-kich-thuoc").checked;
  })();
  $("#cay-kich-thuoc").onchange = function () {
    try { localStorage.setItem("json-editor:kich-thuoc", this.checked ? "1" : "0"); } catch (e) {}
    veCay();
  };
  /* Hang gap ma ngan sach ve da het (tai lieu lon): do kich thuoc rieng hang
     do khi nguoi dung re chuot toi hoac focus bang phim. */
  function doKichThuocHang(e) {
    var n = e.target && e.target.closest ? e.target.closest(".n") : null;
    if (n && n._meta === 1 && n.classList.contains("dong-lai")) capNhatMeta(n);
  }
  cayEl.addEventListener("mouseover", doKichThuocHang);
  cayEl.addEventListener("focusin", doKichThuocHang);

  cayEl.addEventListener("scroll", function () {
    cuonCay.top = cayEl.scrollTop;
    cuonCay.left = cayEl.scrollLeft;
  });

  cayEl.addEventListener("focusin", function (e) {
    var n = e.target.closest ? e.target.closest(".n") : null;
    if (n && cayEl.contains(n)) datHangChon(n);
  });

  /* Bam chuot ra ngoai o sua nhung van trong cay: danh dau de focusout
     KHONG tu luu — bo xu ly click se luu truoc, roi lam viec cua cu bam. */
  cayEl.addEventListener("mousedown", function (e) {
    if (dangSua && !dangSua.el.contains(e.target)) nhanChuot = true;
  }, true);
  document.addEventListener("mouseup", function () {
    if (!nhanChuot) return;
    setTimeout(function () {
      if (!nhanChuot) return;                 /* click da xu ly */
      nhanChuot = false;                      /* keo chuot, khong thanh click */
      if (dangSua && !dangSua.el.contains(document.activeElement)) luuSua(dangSua, false);
    }, 0);
  });

  cayEl.addEventListener("click", function (e) {
    nhanChuot = false;
    var t = e.target;
    if (!t.closest || !cayEl.contains(t)) return;
    if (dangSua && dangSua.el.contains(t)) return;   /* nut cua chinh o sua */
    var n = t.closest(".n");
    var hdEl = t.closest("[data-hd]");
    var p = n ? n.getAttribute("data-p") : null;
    var hd = hdEl && n && hdEl.closest(".n") === n ? hdEl.getAttribute("data-hd") : null;
    if (dangSua) {
      /* Luu o sua dang mo TRUOC, roi lam viec cua cu bam tren cay da ve
         lai (tim lai nut theo duong dan). Gia tri sai thi dung lai. */
      if (!luuSua(dangSua, false)) return;
      n = p !== null ? bangNut[p] : null;
      if (n) focusNut(n);
    }
    if (!n || !hd || (hdEl.disabled)) return;
    if (hd === "sua" || hd === "doi-ten") {
      /* Dang boi den chu de chep thi dung mo o sua. */
      var chon = window.getSelection ? String(window.getSelection()) : "";
      if (chon) return;
    }
    thucHien(hd, n);
  });

  cayEl.addEventListener("keydown", function (e) {
    if (dangSua && dangSua.el.contains(e.target)) return;
    var n = e.target.closest ? e.target.closest(".n") : null;
    if (!n || !cayEl.contains(n)) return;
    var tren = e.target === n, k = e.key, xong = true;
    if (n._nhom && (k === "Delete" || k === "F2" || (e.altKey && (k === "ArrowUp" || k === "ArrowDown")))) return;   /* nhom khong xoa / doi ten / doi cho */
    if (e.altKey && (k === "ArrowUp" || k === "ArrowDown")) doiCho(n, k === "ArrowUp" ? -1 : 1);
    else if (k === "Delete") xoaNut(n);
    else if (!tren || e.ctrlKey || e.metaKey || e.altKey) xong = false;
    else if (k === "ArrowDown") focusNut(nutSau(n));
    else if (k === "ArrowUp") focusNut(nutTruoc(n));
    else if (k === "ArrowRight") {
      if (n._con && n.classList.contains("dong-lai")) batTat(n, true);
      else if (dangMo(n) && n._con.firstElementChild) focusNut(n._con.firstElementChild);
    } else if (k === "ArrowLeft") {
      if (dangMo(n)) batTat(n, false);
      else focusNut(chaCua(n));
    } else if (k === "Home") focusNut(bangNut["[]"]);
    else if (k === "End") focusNut(nutCuoi());
    else if (k === "Enter") { if (n._con) batTat(n); else moSua(n, "gia-tri"); }
    else if (k === "F2") moSua(n, typeof n._khoa === "string" ? "khoa" : "gia-tri");
    else if (k === "Insert" || k === "+") themCon(n._con ? n : chaCua(n));
    else xong = false;
    if (xong) e.preventDefault();
  });

  /* --- o soan: Sua | Xem, ngat dong --- */
  if (nutSua) nutSua.onclick = function () { suaTho = layVb().length > HS.NGUONG_XEM; datCheDoSoan("sua"); };
  if (nutXem) nutXem.onclick = function () { datCheDoSoan("xem"); };
  if (nutNgat) nutNgat.onclick = function () { datNgatDong(!ngatDong, true); };
  if ($("#bang-lon-sua-tho")) $("#bang-lon-sua-tho").onclick = function () { suaTho = true; datCheDoSoan("sua"); };

  $("#loc-chay").onclick = chayTruyVan;
  $("#loc-duong").addEventListener("keydown", function (e) {
    if (e.key === "Enter") chayTruyVan();
  });
  $("#ss-chay").onclick = chaySoSanh;

  /** Chuyen sang tab `o` ("soan" | "cay" | "loc" | "sosanh" | "thongke"). */
  function chuyenTab(o) {
    var b = null;
    els(".tab-n").forEach(function (x) {
      var la = x.dataset.o === o;
      x.classList.toggle("dang", la);
      x.setAttribute("aria-selected", la ? "true" : "false");
      if (la) b = x;
    });
    if (!b) return false;
    els(".o").forEach(function (x) { x.classList.toggle("dang", x.dataset.o === o); });
    /* Ghi nhan tab du lieu vua ROI, khong chi tab VAO: Soan (tab mo san) -> Schema roi bam hang loi phai ve Soan, khong nhay sang Cay. */
    if (oHien === "cay" || oHien === "soan") tabDuLieuGan = oHien;
    oHien = o;
    if (o === "cay" || o === "soan") tabDuLieuGan = o;
    if (oHien === "cay") {
      if (cayBan) veCay();
      else { cayEl.scrollTop = cuonCay.top; cayEl.scrollLeft = cuonCay.left; }
    }
    if (oHien === "thongke") veThongKe();
    if (oHien === "soan") { kichMau = { w: 0, h: 0 }; veMau(); }
    phat("doi-tab", oHien);
    return true;
  }

  els(".tab-n").forEach(function (b) {
    b.onclick = function () { chuyenTab(b.dataset.o); };
  });

  document.addEventListener("keydown", function (e) {
    /* Alt+Z: bat / tat ngat dong (nhu VS Code) */
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && String(e.key).toLowerCase() === "z") {
      e.preventDefault(); datNgatDong(!ngatDong, true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault(); dinhDang(2);
      return;
    }
    /* Hoan tac / lam lai cua app: o MOI tab, mien la KHONG go trong mot o
       chu (o do de trinh duyet tu hoan tac tung ky tu; rieng #nhap co
       duong roi ve lich su app o tren). Vd vua bam "Định dạng" — focus dang
       o nut — Ctrl+Z hoan tac luon. */
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var t = e.target;
    if (t && t.closest && t.closest(".o-sua, input[type=text], textarea, select")) return;
    var k = String(e.key).toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); hoanTac(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); lamLai(); }
  });

  /* Phoi cac ham THUAN ra ngoai de kiem duoc bang node, khong can trinh
     duyet. Chung khong dung DOM, nen kiem duoc that su chu khong phai
     kiem mot ban chep lai. */
  window.JE_THU = {
    dongCot: dongCot, viTriLoi: viTriLoi, truyVan: truyVan,
    khacNhau: khacNhau, sapKhoa: sapKhoa, dem: dem, kieuCua: kieuCua,
    coChu: coChu,
    /* to mau */
    toMau: toMau, toMauDong: toMauDong, haiChamSau: haiChamSau,
    chiSoTu: chiSoTu, viTriDanhDau: viTriDanhDau,
    /* thut le */
    doThut: doThut, vietTheoKieu: vietTheoKieu,
    /* xem truoc nhanh gap */
    xemTruoc: xemTruoc, truongNoiBat: truongNoiBat,
    /* dot J2: metadata nhanh gap */
    tomTatNut: TT.tomTatNut, doDaiByte: TT.doDaiByte, dinhDangByte: TT.dinhDangByte,
    thongKeNhanh: TT.thongKeNhanh, moTaNut: TT.moTaNut, moTaAria: TT.moTaAria,
    /* sua theo duong dan */
    layTai: layTai, datTai: datTai, doiTenKhoa: doiTenKhoa, themVao: themVao,
    xoaTai: xoaTai, diChuyen: diChuyen, doiKieu: doiKieu, docGiaTri: docGiaTri,
    khoaMoiDuyNhat: khoaMoiDuyNhat, giaTriRongTheo: giaTriRongTheo,
    anhXaDuong: anhXaDuong,
    /* dot J1: sap khoa giu thut le, ket qua truy van, thut le cua Tab */
    sapKhoaVanBan: sapKhoaVanBan, chuoiKetQua: chuoiKetQua, chuoiGon: chuoiGon,
    donViThut: donViThut, moTaLoiNem: moTaLoiNem, coKhoaTruyVan: coKhoaTruyVan,
    /* dot J5: chia nhom cay, ghep van ban tai cho */
    chiaNhom: chiaNhom, chuoiNhom: chuoiNhom, khoaNhom: khoaNhom, tachKhoaNhom: tachKhoaNhom,
    ghepTaiCho: ghepTaiCho, vietGiaTri: vietGiaTri, doiTrangThai: doiTrangThai,
    coXuongDongCuoi: coXuongDongCuoi
  };

  /* ==================================================================
     10. Cong JE_APP — cac module giao dien sau (ui-*.js) chi noi chuyen
     voi loi qua day, khong cham bien noi bo.
     ================================================================== */

  /** Cuon textarea de dong chua ky tu `i` hien ra (uoc theo cao dong; khi
      ngat dong mem thi chi gan dung). */
  function cuonToiViTri(i) {
    var s = layVb(), dong = 0;
    for (var k = s.indexOf("\n"); k >= 0 && k < i; k = s.indexOf("\n", k + 1)) dong++;
    var lh = 20.8;
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(nhap) : null;
      var x = cs ? parseFloat(cs.lineHeight) : NaN;
      if (x > 0) lh = x;
    } catch (e) { /* giu uoc luong */ }
    var h = nhap.clientHeight || 0;
    var dich = dong * lh, st = nhap.scrollTop || 0;
    if (dich < st || dich > st + h - 2 * lh) nhap.scrollTop = Math.max(0, dich - h / 3);
    soDong.scrollTop = nhap.scrollTop;
    dongBoCuon();
  }

  /** Chon doan [bd, kt) trong o Soan (chuyen tab, focus, cuon toi). */
  function denViTri(bd, kt) {
    chuyenTab("soan");
    if (cheDoSoan === "xem" && xemApi) return xemApi.denViTri(bd, kt === undefined ? bd : kt);
    try { nhap.focus({ preventScroll: true }); } catch (e) { nhap.focus(); }
    datChon(bd, kt === undefined ? bd : kt);
    cuonToiViTri(nhap.selectionStart || 0);
    capNhatViTri();
    return true;
  }

  /** Dua con tro toi dau dong `n` (dem tu 1). */
  function denDong(n) {
    var i = chiSoTu(layVb(), Math.max(1, n | 0), 1);
    return denViTri(i, i);
  }

  /** Chon gia tri (hoac khoa) o `duong` trong o Soan nho vi-tri.timViTri —
      dung duoc ca khi JSON dang loi (timViTri chiu JSON hong). `chon`:
      "gia-tri" (mac dinh) hoac "khoa" (token khoa neu co). */
  function denDuongSoan(duong, tc) {
    var vt = VT.timViTri(layVb(), duong);
    if (!vt) return false;
    var bd = vt.bd, kt = vt.kt;
    if (tc.chon === "khoa" && vt.khoaBd >= 0) { bd = vt.khoaBd; kt = vt.khoaKt; }
    return denViTri(bd, kt);
  }

  /** Mo cac to tien, dung dan nhanh can thiet roi focus nut theo duong dan
      tren tab Cay, hoac chon doan van ban tuong ung o tab Soan.
        tc.tab   "cay" (mac dinh) | "soan" | "tu-dong" (tab du lieu dung gan nhat)
        tc.chon  "gia-tri" | "khoa" (chi o Soan) */
  function denDuong(duong, tc) {
    tc = tc || {};
    duong = duong || [];
    var tab = tc.tab === "tu-dong" ? tabDuLieuGan : tc.tab;
    if (tab === "soan") return denDuongSoan(duong, tc);
    if (!dongBoDoc()) return false;
    if (duong.length && layTai(duLieu, duong) === undefined) return false;
    chuyenTab("cay");
    if (cayBan) veCay();
    for (var i = 0; i < duong.length; i++) {
      var to = bangNut[khoaDuong(duong.slice(0, i))];
      if (!to) { moToTien(duong); veCay(); break; }
      if (!dangMo(to)) batTat(to, true);
      moNhomChua(to, duong[i]);
    }
    var n = bangNut[khoaDuong(duong)];
    if (!n) return false;
    focusNut(n);
    n.classList.add("nhay");
    setTimeout(function () { n.classList.remove("nhay"); }, 1300);
    return true;
  }

  window.JE_APP = {
    /* trang thai hien tai (da doc() dung van ban dang co) */
    layVanBan: function () { return layVb(); },
    layDuLieu: function () { dongBoDoc(); return duLieu; },
    hopLe: function () { return dongBoDoc(); },
    /* moi lan may ghi van ban: datVanBan; sua theo mo hinh: apDungGoc */
    datVanBan: datVanBan,
    apDungGoc: apDungGoc,
    /* lich su chung */
    hoanTac: hoanTac,
    lamLai: lamLai,
    lichSu: trangThaiLichSu,
    /* di chuyen */
    chuyenTab: chuyenTab,
    tabHien: function () { return oHien; },
    tabDuLieuGan: function () { return tabDuLieuGan; },       /* "cay" | "soan": tab du lieu nguoi dung vua dung */
    denDuong: denDuong,
    denViTri: denViTri,
    denDong: denDong,
    /* su kien: "doi-du-lieu" (sau moi doc()), "doi-tab", "doi-chon", "doi-lich-su", "mo-tep" ({ten, vanBan}),
       dot J5: "doi-che-do" ("sua" | "xem"), "ve-mau" ({tu, den}: lop mau ao vua ve cac dong [tu, den)), "nhap" ({luu, noi, n}),
       "dinh-dang-nen" ({nhan, noi, ms}) */
    dangKy: dangKy,
    thongBao: thongBao,
    /* huy hieu loi tren cay: Map(JSON.stringify(duong) -> {a:[thongBao…], b:soLoiBenTrong}); null = xoa */
    datHuyHieuCay: datHuyHieuCay,
    /* dot J5: o soan Sua | Xem, tai lieu lon */
    cheDoSoan: function () { return cheDoSoan; },
    datCheDoSoan: datCheDoSoan,
    dangKyXem: function (api) { xemApi = api; henToMau(); },
    tienIch: { toMauDong: toMauDong, haiChamSau: haiChamSau, thoat: thoat, coChu: coChu, chiSoCua: chiSoCua, doThut: doThut },
    hangSo: (function () {
      HS.GIOI_HAN_LICH_SU = GIOI_HAN_LICH_SU;
      HS.GIOI_HAN_KY_TU_LICH_SU = GIOI_HAN_KY_TU_LICH_SU;
      HS.NGAN_SACH = NGAN_SACH;
      HS.NGUONG_KIEM_TU_DONG = 1024 * 1024;               /* schema tu kiem moi lan sua khi du lieu <= 1 MB */
      HS.CHAY_NEN = JE.chayNen ? JE.chayNen.cauHinh : null;  /* {han, nganLuongChinh}: doi duoc luc chay (kiem thu) */
      return HS;
    })()
  };

  /* --- khoi dong --- */
  /* Giao dien: theo lua chon da luu; chua chon bao gio thi theo he dieu
     hanh (prefers-color-scheme), va doi theo neu nguoi dung doi o he thong. */
  (function () {
    var daLuu = null;
    try { daLuu = localStorage.getItem("json-editor:sang"); } catch (e) {}
    if (daLuu) { document.documentElement.setAttribute("data-sang", daLuu); return; }
    if (typeof window.matchMedia !== "function") return;
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var theo = function () {
      var luu = null;
      try { luu = localStorage.getItem("json-editor:sang"); } catch (e) {}
      if (!luu) document.documentElement.setAttribute("data-sang", mq.matches ? "1" : "0");
    };
    theo();
    if (mq.addEventListener) mq.addEventListener("change", theo);
    else if (mq.addListener) mq.addListener(theo);
  })();
  (function () {
    var d = $(".tab-n.dang");
    if (d && d.dataset && d.dataset.o) oHien = d.dataset.o;
  })();
  nhap.value = docNhap();
  mayVuaGhi();
  datNgatDong(lsLay("json-editor:ngat-dong") === "1", false);
  doc();
  veCay();
  veMau();
  capNhatViTri();
  capNhatNutLichSu();
  if (layVb() === "") khoiPhucNhapLon();
})();
