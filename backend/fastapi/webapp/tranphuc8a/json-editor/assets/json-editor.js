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
      dan nen song sot qua moi lan ve lai. Viet vao .value thi mat hoan
      tac cua trinh duyet, nen cay co lich su rieng.

   4. To mau cu phap khi soan: textarea van lo viec GO (con tro, IME, chon
      chu, hoan tac goc), ta chi ve mot lop <pre> nam duoi no — chu cua
      textarea trong suot. Hai lop phai trung khit tung ky tu.
   ===================================================================== */
(function () {
  "use strict";

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

  var duLieu = null;         /* ket qua parse gan nhat */
  var hopLe = false;         /* lan parse gan nhat co thanh cong khong — van
                                ban "null" la JSON HOP LE ma duLieu van null */
  var dongLoi = -1;
  var loiTai = -1;           /* chi so ky tu cua cho loi, de to tren lop mau */
  var vanBanDaDoc = null;    /* van ban ma doc() vua parse */
  var oHien = "soan";        /* tab dang mo */

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

  function doc() {
    var s = nhap.value;
    vanBanDaDoc = s;
    loiTai = -1;
    if (!s.trim()) {
      duLieu = null; hopLe = false; dongLoi = -1;
      den.className = "den";
      trangThai.textContent = "Chưa có nội dung";
      veSoDong();
      kiemMauLoi();
      return false;
    }
    try {
      duLieu = JSON.parse(s);
      hopLe = true;
      dongLoi = -1;
      den.className = "den ok";
      trangThai.textContent = "JSON hợp lệ · " + moTaNgan(duLieu);
      veSoDong();
      kiemMauLoi();
      return true;
    } catch (e) {
      duLieu = null; hopLe = false;
      var vt = viTriLoi(e, s);
      dongLoi = vt ? vt.dong : -1;
      loiTai = vt ? viTriDanhDau(s, chiSoTu(s, vt.dong, vt.cot)) : -1;
      den.className = "den loi";
      trangThai.textContent = vt
        ? ("Lỗi ở dòng " + vt.dong + ", cột " + vt.cot + " — " + gonLoi(e))
        : ("Lỗi — " + gonLoi(e));
      veSoDong();
      kiemMauLoi();
      return false;
    }
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

  function kieuCua(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }

  /* ---------------------------------------------------------- số dòng */
  /* So dong gom thanh tung KHOI 64 dong (<div class="k">): trinh duyet bo
     cuc lai theo so con TRUC TIEP, nen 20 000 dong thanh ~300 khoi thi
     them / bot mot dong khong phai xep lai ca 20 000 the. Chi them hoac
     bot o CUOI, va chi doi lop cua dong loi cu / moi. */
  var KHOI = 64;
  var soDongDaVe = 0, dongLoiDaVe = -1;

  function oSoDong(i) {
    var k = soDong.children[Math.floor((i - 1) / KHOI)];
    return k && k.children ? k.children[(i - 1) % KHOI] : null;
  }

  function veSoDong() {
    var s = nhap.value, n = 1, i, j, html;
    for (var k = s.indexOf("\n"); k >= 0; k = s.indexOf("\n", k + 1)) n++;
    if (n !== soDongDaVe) {
      var cu = soDongDaVe;
      if (!cu || !soDong.children || soDong.children.length !== Math.ceil(cu / KHOI)) {
        soDong.textContent = ""; cu = 0; dongLoiDaVe = -1;
      }
      if (n > cu) {
        i = cu + 1;
        var cuoi = soDong.lastElementChild;
        if (cu % KHOI && cuoi) {                  /* lap day khoi cuoi dang do */
          html = "";
          for (; i <= n && (i - 1) % KHOI; i++) html += "<div>" + i + "</div>";
          cuoi.insertAdjacentHTML("beforeend", html);
        }
        html = "";
        while (i <= n) {
          html += '<div class="k">';
          for (j = Math.min(n, i + KHOI - 1); i <= j; i++) html += "<div>" + i + "</div>";
          html += "</div>";
        }
        if (html) soDong.insertAdjacentHTML("beforeend", html);
      } else {
        var giu = Math.ceil(n / KHOI);
        while (soDong.children.length > giu) soDong.removeChild(soDong.lastElementChild);
        var kc = soDong.lastElementChild;
        while (kc && kc.children.length > n - (giu - 1) * KHOI) kc.removeChild(kc.lastElementChild);
        if (dongLoiDaVe > n) dongLoiDaVe = -1;
      }
      soDongDaVe = n;
    }
    if (dongLoi !== dongLoiDaVe) {
      var a = dongLoiDaVe > 0 ? oSoDong(dongLoiDaVe) : null;
      if (a) a.className = "";
      var b = dongLoi > 0 ? oSoDong(dongLoi) : null;
      if (b) b.className = "loi";
      dongLoiDaVe = dongLoi;
    }
    soDong.scrollTop = nhap.scrollTop;
  }

  /* Chay o moi lan nha phim: dem dau xuong dong bang indexOf (nhanh hon
     nhieu so voi duyet tung ky tu nhu dongCot khi van ban dai). */
  function capNhatViTri() {
    var s = nhap.value, k = Math.min(nhap.selectionStart || 0, s.length), dong = 1;
    for (var i = s.indexOf("\n"); i >= 0 && i < k; i = s.indexOf("\n", i + 1)) dong++;
    var p = k > 0 ? s.lastIndexOf("\n", k - 1) : -1;
    viTri.textContent = "dòng " + dong + ", cột " + (k - p);
  }

  /* ==================================================================
     2. Cac phep bien doi
     ================================================================== */
  function dinhDang(thut) {
    if (!doc()) return;
    ghiLichSu();
    nhap.value = JSON.stringify(duLieu, null, thut === undefined ? 2 : thut);
    sauKhiDoi();
  }

  function nen() {
    if (!doc()) return;
    ghiLichSu();
    nhap.value = JSON.stringify(duLieu);
    sauKhiDoi();
  }

  /** Sap khoa theo bang chu cai, de quy. Mang GIU NGUYEN thu tu — thu tu
      phan tu mang la co y nghia, doi la sai du lieu. */
  function sapKhoa(v) {
    if (Array.isArray(v)) return v.map(sapKhoa);
    if (v && typeof v === "object") {
      var ra = {};
      Object.keys(v).sort().forEach(function (k) { ra[k] = sapKhoa(v[k]); });
      return ra;
    }
    return v;
  }

  /** Nhieu API tra ve JSON DA BI DONG GOI THANH CHUOI. Nut nay go mot lop. */
  function thoatChuoi() {
    var s = nhap.value.trim();
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
    ghiLichSu();
    nhap.value = thu;
    sauKhiDoi();
  }

  function bao(chu) {
    trangThai.textContent = chu;
    den.className = "den loi";
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
  var cheDoMo = "sau";                     /* mac dinh: "sau" (gap tu cap 2), "mo", "dong" */
  var bangNut = Object.create(null);       /* khoaDuong -> phan tu .n cua lan ve nay */
  var hangChon = "[]";                     /* nut dang chon (roving tabindex) */
  var cayBan = true;                       /* phai ve lai khi tab Cay hien ra */
  var cuonCay = { top: 0, left: 0 };
  var hienKieu = true;
  var dangSua = null;                      /* phien sua dang mo, neu co */
  var nhanChuot = false;                   /* dang bam chuot trong cay khi o sua mo */

  function khoaDuong(d) { return JSON.stringify(d); }
  function laNhanh(v) { return v !== null && typeof v === "object"; }

  function laMo(duong) {
    var k = khoaDuong(duong);
    if (k in trangThaiMo) return trangThaiMo[k];
    if (cheDoMo === "mo") return true;
    if (cheDoMo === "dong") return false;
    return duong.length < 2;
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

  function htmlGiaTri(v) {
    if (!laNhanh(v)) {
      return nutLa(v) + (hienKieu
        ? '<span class="kieu" data-hd="sua" title="Bấm để sửa hoặc đổi kiểu">' + kieuCua(v) + "</span>"
        : "");
    }
    var mang = Array.isArray(v), sl = mang ? v.length : Object.keys(v).length;
    var xt = xemTruoc(v);
    return '<span class="dau-2cham ngoac" data-hd="mo-dong">' + (mang ? "[ ]" : "{ }") + "</span>" +
      '<span class="dem" data-hd="mo-dong">' + sl + (mang ? " phần tử" : " khoá") + "</span>" +
      (xt ? '<span class="xem-truoc" data-hd="mo-dong">' + thoat(xt) + "</span>" : "");
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

  function veNut(khoa, v, duong, soAnhEm) {
    var kd = khoaDuong(duong);
    var n = document.createElement("div");
    n.className = "n";
    n.setAttribute("role", "treeitem");
    n.setAttribute("aria-level", String(duong.length + 1));
    n.setAttribute("aria-label", nhanNut(khoa, v));
    n.setAttribute("data-p", kd);
    n.tabIndex = -1;
    n._duong = duong; n._v = v; n._khoa = khoa; n._soAnhEm = soAnhEm;
    bangNut[kd] = n;

    var dong = document.createElement("div");
    dong.className = "dong";
    dong.innerHTML = htmlKhoa(khoa) + htmlGiaTri(v) + htmlThaoTac(khoa, v, duong, soAnhEm);
    n._dong = dong;
    n.appendChild(dong);

    if (laNhanh(v)) {
      var mo = laMo(duong);
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
    return n;
  }

  function veCon(n) {
    var v = n._v, duong = n._duong, ra = document.createDocumentFragment(), i;
    if (Array.isArray(v)) {
      for (i = 0; i < v.length; i++) ra.appendChild(veNut(i, v[i], duong.concat([i]), v.length));
    } else {
      var ks = Object.keys(v);
      for (i = 0; i < ks.length; i++) ra.appendChild(veNut(ks[i], v[ks[i]], duong.concat([ks[i]]), ks.length));
    }
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
    var p;
    try { p = JSON.parse(kd); } catch (e) { return null; }
    while (p && p.length) {
      p.pop();
      var k = khoaDuong(p);
      if (bangNut[k]) return bangNut[k];
    }
    return null;
  }

  function dem(v, sau) {
    sau = sau || 0;
    var r = { nut: 1, sau: sau, la: 0, mang: 0, obj: 0 };
    if (Array.isArray(v)) {
      r.mang = 1;
      v.forEach(function (x) {
        var c = dem(x, sau + 1);
        r.nut += c.nut; r.la += c.la; r.mang += c.mang; r.obj += c.obj;
        if (c.sau > r.sau) r.sau = c.sau;
      });
    } else if (v && typeof v === "object") {
      r.obj = 1;
      Object.keys(v).forEach(function (k) {
        var c = dem(v[k], sau + 1);
        r.nut += c.nut; r.la += c.la; r.mang += c.mang; r.obj += c.obj;
        if (c.sau > r.sau) r.sau = c.sau;
      });
    } else r.la = 1;
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
    if (mo && !n._daVe) veCon(n);
    n.classList.toggle("dong-lai", !mo);
    n.setAttribute("aria-expanded", mo ? "true" : "false");
    n._nutMo.textContent = mo ? "−" : "+";
  }

  /* ---------------------------------------------- thong bao trong tab Cay */
  var henBao = null;
  function thongBaoCay(chu) {
    if (!cayBao) return;
    cayBao.textContent = chu;
    clearTimeout(henBao);
    henBao = setTimeout(function () { cayBao.textContent = ""; }, 8000);
  }

  function moTaDuong(d) {
    var s = "$";
    for (var i = 0; i < d.length; i++) {
      s += typeof d[i] === "number" ? "[" + d[i] + "]"
         : /^[A-Za-z_$][\w$-]*$/.test(d[i]) ? "." + d[i] : "[" + JSON.stringify(d[i]) + "]";
    }
    return s;
  }

  /* ---------------------------------------------- ghi mot thay doi */
  /** Mo hinh co khop van ban hien tai khong — neu khong thi doc lai. */
  function sanSang() {
    if (nhap.value !== vanBanDaDoc) doc();
    if (!hopLe) { thongBaoCay("JSON đang lỗi — sửa ở tab Soạn trước đã"); return false; }
    return true;
  }

  function moToTien(duong) {
    for (var i = 0; i < duong.length; i++) trangThaiMo[khoaDuong(duong.slice(0, i))] = true;
  }

  /** Moi thao tac tren cay di qua day: luu lich su, viet lai #nhap THEO
      KIEU THUT LE DANG DUNG, chuyen trang thai gap/mo theo duong dan moi,
      roi chay lai duong lam tuoi chung (kiem loi, cay, luu nhap, to mau). */
  function apDung(gocMoi, phep, duongChon) {
    ghiLichSu();
    nhap.value = vietTheoKieu(gocMoi, nhap.value);
    if (phep) trangThaiMo = doiTrangThai(trangThaiMo, phep);
    if (duongChon) { moToTien(duongChon); hangChon = khoaDuong(duongChon); }
    sauKhiDoi();
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
    apDung(goc, { loai: "xoa", duong: duong }, chon);
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
    apDung(kq.goc, { loai: "chuyen", duong: duong, moi: kq.duong[kq.duong.length - 1] }, kq.duong);
  }

  function themCon(n) {
    if (!n || !n._con) return;
    if (!sanSang()) return;
    var v = n._v, kq;
    try {
      kq = themVao(duLieu, n._duong, Array.isArray(v) ? giaTriRongTheo(v[v.length - 1]) : "");
    } catch (e) { thongBaoCay(e.message); return; }
    trangThaiMo[n.getAttribute("data-p")] = true;
    apDung(kq.goc, null, kq.duong);
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
    var n = phien.n, gocMoi, phep, duongMoi;
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
      } else {
        var v = layGiaTriSua(phien);
        if (v === phien.v) { dongSua(phien, quaPhim); return true; }
        gocMoi = datTai(duLieu, phien.duong, v);
        duongMoi = phien.duong;
        phep = { loai: "thay", duong: phien.duong };
      }
    } catch (e) {
      baoLoiSua(phien, e.message, quaPhim);
      return false;
    }
    dangSua = null;
    apDung(gocMoi, phep, duongMoi);
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
  var coRieng = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

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

  /** Doan kieu thut le cua van ban: 2 / 4 / ... dau cach, "\t", hoac 0
      (nen tren mot dong). Mac dinh 2. */
  function doThut(s) {
    var t = String(s || "").replace(/^\s+|\s+$/g, "");
    if (!t) return 2;
    if (t.indexOf("\n") < 0) return 0;
    var dong = t.split("\n"), nho = 0;
    for (var i = 1; i < dong.length && i < 5000; i++) {
      var m = /^[ \t]+/.exec(dong[i]);
      if (!m || m[0].length === dong[i].length) continue;
      if (m[0].charAt(0) === "\t") { if (!nho) return "\t"; continue; }
      var so = m[0].replace(/\t[\s\S]*$/, "").length;
      if (!nho || so < nho) nho = so;
      if (nho === 1) break;
    }
    return nho ? Math.min(nho, 10) : 2;
  }

  /** Viet lai mo hinh THEO KIEU cua van ban cu: cung thut le, va giu dau
      xuong dong cuoi neu van ban cu co. */
  function vietTheoKieu(goc, cu) {
    return JSON.stringify(goc, null, doThut(cu)) + (/\n[ \t]*$/.test(String(cu || "")) ? "\n" : "");
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
      var p = anhXaDuong(JSON.parse(k), phep);
      if (p) moi[khoaDuong(p)] = tt[k];
    }
    return moi;
  }

  /* --- xem truoc nhanh dang gap --- */
  /* Khoa "dang doc" nhat, theo thu tu uu tien. So sanh sau khi chuan hoa:
     chu thuong, bo dau tieng Viet, bo _ - va khoang trang — nen "Title",
     "tieu_de", "tieuDe", "Tiêu đề", "tên", "Mã" deu khop. */
  var KHOA_UU_TIEN = ["name", "title", "ten", "tieude", "label", "id", "key", "code",
                      "ma", "slug", "email", "username", "type", "kind"];

  function chuanKhoa(k) {
    var s = String(k).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.replace(/đ/g, "d").replace(/[\s_\-]/g, "");
  }

  function catNgan(s, n) {
    s = String(s);
    if (s.length <= n) return s;
    var k = n - 1;
    var c = s.charCodeAt(k - 1);
    if (c >= 0xd800 && c <= 0xdbff) k--;     /* khong cat doi cap surrogate (emoji) */
    return s.slice(0, k) + "…";
  }

  function giaTriNgan(v) {
    return typeof v === "string" ? JSON.stringify(v) : String(v);
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

  function tomTatObject(o) {
    var k = truongNoiBat(o);
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
        mang    -> 1, 2, 3 …               (phan tu nguyen thuy) */
  function xemTruoc(v, gioiHan) {
    gioiHan = gioiHan || 60;
    var s = "";
    if (Array.isArray(v)) {
      if (!v.length) return "";
      var dau = v[0];
      if (laNhanh(dau)) {
        s = "[0] " + (Array.isArray(dau) ? (xemTruoc(dau, gioiHan) || "[ ]") : (tomTatObject(dau) || "{ }"));
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

  /* ==================================================================
     3c. Lich su sua (hoan tac / lam lai)

     Viet vao nhap.value la xoa sach lich su hoan tac cua trinh duyet,
     nen moi thay doi do may viet (sua tren cay, dinh dang, nen, sap khoa,
     mo tep…) chup lai van ban TRUOC khi ghi. Kem ca trang thai gap/mo va
     nut dang chon de hoan tac xong cay hien dung nhu luc truoc.
     ================================================================== */
  var lichSu = { truoc: [], sau: [] };
  var GIOI_HAN_LICH_SU = 100;
  var GIOI_HAN_KY_TU_LICH_SU = 40 * 1024 * 1024;  /* van ban lon: bot buoc cu */
  var nutHoanTac = $("#cay-hoan-tac");
  var nutLamLai = $("#cay-lam-lai");

  function saoTrangThai(tt) {
    var r = Object.create(null);
    for (var k in tt) r[k] = tt[k];
    return r;
  }

  function anhChup() {
    return { s: nhap.value, mo: saoTrangThai(trangThaiMo), che: cheDoMo, chon: hangChon };
  }

  function ghiLichSu() {
    var t = lichSu.truoc, s = nhap.value;
    if (!t.length || t[t.length - 1].s !== s) {
      t.push(anhChup());
      var tong = 0, i;
      for (i = 0; i < t.length; i++) tong += t[i].s.length;
      while (t.length > GIOI_HAN_LICH_SU || (t.length > 1 && tong > GIOI_HAN_KY_TU_LICH_SU)) {
        tong -= t.shift().s.length;
      }
    }
    lichSu.sau = [];
    capNhatNutLichSu();
  }

  function quayLai(tu, toi, chu) {
    if (!tu.length) return;
    dangSua = null;
    toi.push(anhChup());
    var a = tu.pop();
    nhap.value = a.s;
    trangThaiMo = a.mo; cheDoMo = a.che; hangChon = a.chon;
    sauKhiDoi();
    capNhatNutLichSu();
    thongBaoCay(chu);
  }

  function hoanTac() { quayLai(lichSu.truoc, lichSu.sau, "Đã hoàn tác"); }
  function lamLai() { quayLai(lichSu.sau, lichSu.truoc, "Đã làm lại"); }

  function capNhatNutLichSu() {
    if (nutHoanTac) nutHoanTac.disabled = !lichSu.truoc.length;
    if (nutLamLai) nutLamLai.disabled = !lichSu.sau.length;
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

  function vaoKhoa(ds, khoa) {
    var ra = [];
    ds.forEach(function (n) {
      if (n.v && typeof n.v === "object" && khoa in n.v) {
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

  function chayTruyVan() {
    var ra = $("#loc-ket");
    if (!doc()) { ra.textContent = "JSON chưa hợp lệ — sửa ở tab Soạn trước."; return; }
    var duong = $("#loc-duong").value;
    try {
      var kq = truyVan(duLieu, duong);
      if (!kq.length) { ra.textContent = "Không khớp nút nào."; return; }
      ra.textContent = kq.map(function (n) {
        return n.d + "\n  " + JSON.stringify(n.v, null, 2).split("\n").join("\n  ");
      }).join("\n\n") + "\n\n— " + kq.length + " kết quả";
    } catch (e) {
      ra.textContent = "Đường dẫn sai: " + e.message;
    }
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
      var keys = {};
      Object.keys(a).forEach(function (k) { keys[k] = 1; });
      Object.keys(b).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).sort().forEach(function (k) {
        if (!(k in a)) ra.push({ loai: "them", d: duong + "." + k, b: b[k] });
        else if (!(k in b)) ra.push({ loai: "bot", d: duong + "." + k, a: a[k] });
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

    var ds = khacNhau(duLieu, b);
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
      var gia = k.loai === "them" ? JSON.stringify(k.b)
              : k.loai === "bot" ? JSON.stringify(k.a)
              : JSON.stringify(k.a) + "  →  " + JSON.stringify(k.b);
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
    var d = dem(duLieu);
    var chuoi = nhap.value;
    var gon = JSON.stringify(duLieu);
    var kieu = {};
    (function quet(v) {
      var k = kieuCua(v);
      kieu[k] = (kieu[k] || 0) + 1;
      if (Array.isArray(v)) v.forEach(quet);
      else if (v && typeof v === "object") Object.keys(v).forEach(function (x) { quet(v[x]); });
    })(duLieu);

    var hang = [
      ["Tổng số nút", d.nut.toLocaleString("vi")],
      ["Nút lá (giá trị)", d.la.toLocaleString("vi")],
      ["Object", d.obj.toLocaleString("vi")],
      ["Mảng", d.mang.toLocaleString("vi")],
      ["Độ sâu lớn nhất", (d.sau + 1) + " cấp"],
      ["Kích thước hiện tại", coChu(chuoi.length)],
      ["Sau khi nén", coChu(gon.length) + "  (−" +
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
     7. Luu nhap — chi de khoi mat khi lo dong tab
     ================================================================== */
  var KHOA = "json-editor:nhap";
  function luuNhap() {
    try { localStorage.setItem(KHOA, nhap.value); } catch (e) { /* che do rieng tu */ }
  }
  function docNhap() {
    try { return localStorage.getItem(KHOA) || ""; } catch (e) { return ""; }
  }

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
  var GIOI_HAN_MAU = 300 * 1024;

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
  function haiChamSau(dong) {
    var ra = new Array(dong.length), tiep = false;
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

  /** doc() vua tim ra (hoac het) loi: to lai neu cho to do da khac. */
  function kiemMauLoi() {
    if (loiTai !== mauDaVeLoi) henToMau();
  }

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

  function veMau() {
    if (!lopMau || !vungSoan) return;
    if (oHien !== "soan") { mauBan = true; return; }
    mauBan = false;
    var s = nhap.value, lon = s.length > GIOI_HAN_MAU;
    vungSoan.classList.toggle("co-mau", !lon);
    if (baoMau) baoMau.hidden = !lon;
    if (lon) {
      if (mauDong.length) {
        lopMau.textContent = "";
        mauDong = []; mauCo = []; mauKhoi = []; mauLoi = { dong: -1, cot: -1 };
      }
      mauDaVeLoi = -3;
      return;
    }
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
     9. Noi day
     ================================================================== */
  var hen = null;
  function khiNhap() {
    clearTimeout(hen);
    hen = setTimeout(function () { doc(); veCay(); luuNhap(); }, 180);
    veSoDong();
    henToMau();
  }
  nhap.addEventListener("input", khiNhap);
  nhap.addEventListener("scroll", function () {
    soDong.scrollTop = nhap.scrollTop;
    dongBoCuon();
  });
  ["click", "keyup"].forEach(function (e) { nhap.addEventListener(e, capNhatViTri); });

  /* Doi co textarea (keo cua so, hien/an thanh cuon) -> doi co lop mau. */
  if (typeof window.ResizeObserver === "function") {
    new window.ResizeObserver(function () { dongBoKichThuoc(); dongBoCuon(); }).observe(nhap);
  } else if (window.addEventListener) {
    window.addEventListener("resize", function () { dongBoKichThuoc(); dongBoCuon(); });
  }

  /* Tab trong textarea phai thut le, khong duoc nhay ra khoi o. Chen bang
     execCommand de con hoan tac (Ctrl+Z) duoc va de su kien input chay —
     lop mau va so dong cap nhat theo. */
  nhap.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      var daChen = false;
      try { daChen = document.execCommand("insertText", false, "  "); } catch (x) { daChen = false; }
      if (!daChen) {
        var a = nhap.selectionStart, b = nhap.selectionEnd;
        nhap.value = nhap.value.slice(0, a) + "  " + nhap.value.slice(b);
        nhap.selectionStart = nhap.selectionEnd = a + 2;
        khiNhap();
      }
    }
  });

  $("#nut-dinh-dang").onclick = function () { dinhDang(2); };
  $("#nut-nen").onclick = nen;
  $("#nut-sap-khoa").onclick = function () {
    if (!doc()) return;
    ghiLichSu();
    duLieu = sapKhoa(duLieu);
    nhap.value = JSON.stringify(duLieu, null, 2);
    sauKhiDoi();
  };
  $("#nut-thoat").onclick = thoatChuoi;

  $("#nut-mo").onclick = function () { $("#tep").click(); };
  $("#tep").onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      ghiLichSu();
      nhap.value = String(r.result);
      coTep.textContent = f.name + " · " + coChu(f.size);
      /* Tep moi: cay quay ve trang thai gap/mo mac dinh. */
      trangThaiMo = Object.create(null); cheDoMo = "sau"; hangChon = "[]";
      cuonCay = { top: 0, left: 0 };
      cayEl.scrollTop = 0;
      sauKhiDoi();
    };
    r.readAsText(f);
    e.target.value = "";
  };

  $("#nut-luu").onclick = function () {
    var b = new Blob([nhap.value], { type: "application/json" });
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
      navigator.clipboard.writeText(nhap.value).then(xong, function () {
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
  $("#cay-mo").onclick = function () {
    cheDoMo = "mo"; trangThaiMo = Object.create(null);
    veCay();
  };
  $("#cay-dong").onclick = function () {
    cheDoMo = "dong"; trangThaiMo = Object.create(null);
    veCay();
  };
  $("#cay-kieu").onchange = veCay;
  if (nutHoanTac) nutHoanTac.onclick = hoanTac;
  if (nutLamLai) nutLamLai.onclick = lamLai;

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

  $("#loc-chay").onclick = chayTruyVan;
  $("#loc-duong").addEventListener("keydown", function (e) {
    if (e.key === "Enter") chayTruyVan();
  });
  $("#ss-chay").onclick = chaySoSanh;

  els(".tab-n").forEach(function (b) {
    b.onclick = function () {
      els(".tab-n").forEach(function (x) { x.classList.remove("dang"); });
      els(".o").forEach(function (x) { x.classList.remove("dang"); });
      b.classList.add("dang");
      $('.o[data-o="' + b.dataset.o + '"]').classList.add("dang");
      oHien = b.dataset.o;
      if (oHien === "cay") {
        if (cayBan) veCay();
        else { cayEl.scrollTop = cuonCay.top; cayEl.scrollLeft = cuonCay.left; }
      }
      if (oHien === "thongke") veThongKe();
      if (oHien === "soan") { kichMau = { w: 0, h: 0 }; veMau(); }
    };
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault(); dinhDang(2);
      return;
    }
    /* Hoan tac / lam lai cua cay: chi khi dang o tab Cay va KHONG go trong
       mot o chu (o do de trinh duyet tu hoan tac tung ky tu). */
    if (oHien !== "cay" || !(e.ctrlKey || e.metaKey) || e.altKey) return;
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
    /* sua theo duong dan */
    layTai: layTai, datTai: datTai, doiTenKhoa: doiTenKhoa, themVao: themVao,
    xoaTai: xoaTai, diChuyen: diChuyen, doiKieu: doiKieu, docGiaTri: docGiaTri,
    khoaMoiDuyNhat: khoaMoiDuyNhat, giaTriRongTheo: giaTriRongTheo,
    anhXaDuong: anhXaDuong
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
  doc();
  veCay();
  veMau();
  capNhatViTri();
  capNhatNutLichSu();
})();
