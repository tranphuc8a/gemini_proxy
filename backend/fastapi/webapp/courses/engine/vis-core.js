/* =====================================================================
   ENGINE TRUC QUAN v2 — khung chung cho cac trang "lab" truc quan hoa.
   Khong phu thuoc thu vien nao. Chay duoc bang file://

   * DAY LA NGUON THAT.
     Sua o day roi chay `python engine/sync.py` de chep sang cac trang
     dich khai bao trong engine/dong-bo.json.
     DUNG sua ban sao trong assets/ cua cac trang dich — se bi ghi de.

   Moi trang nap theo thu tu:
     (1) assets/cau-hinh.js   window.CAU_HINH_VIS  — rieng moi trang
     (2) assets/vis-core.js   file nay             — dung chung
     (3) assets/lab-*.js      cac lab              — rieng moi trang

   TUONG THICH NGUOC: moi API cua v1 — demo(), V.el, V.truot, V.nut,
   V.chon, V.danhDau, V.veBang, V.veLuoi, V.mau, V.thangMau, V.rng,
   V.vongLap, V.phat, V.dungHet, V.khung — giu nguyen chu ky va hanh vi.
   Toan bo phan them deu la tuy chon.
   ===================================================================== */

(function () {
  "use strict";

  /* ---------- 0. Cau hinh cua trang ---------------------------------- */
  var CH = window.CAU_HINH_VIS || {};
  function ch(k, macDinh) { return CH[k] === undefined ? macDinh : CH[k]; }

  var KHOA_LUU = ch("khoaLuu", "vis-theme");
  /* Bat/tat tung tinh nang tu cau-hinh.js. Mac dinh bat het. */
  var TN = ch("tinhNang", {});
  function bat(k) { return TN[k] !== false; }

  /* ---------- 1. Tien ich DOM ---------------------------------------- */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") e.className = attrs[k];
        else if (k === "html") e.innerHTML = attrs[k];
        else if (k === "text") e.textContent = attrs[k];
        else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function $(s, r) { return (r || document).querySelector(s); }

  /* Bieu tuong SVG dung trong thanh cong cu. */
  function ico(d) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "ico");
    s.innerHTML = d;
    return s;
  }

  /* ---------- 2. Dieu khien co ban ------------------------------------ */

  /** Thanh truot co nhan va gia tri hien tai. */
  function truot(o) {
    var out = el("b", { class: "gt", text: dinhDang(o.giaTri, o.buoc) + (o.donVi || "") });
    var inp = el("input", {
      type: "range", min: o.min, max: o.max, step: o.buoc || 0.01, value: o.giaTri
    });
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      out.textContent = dinhDang(v, o.buoc) + (o.donVi || "");
      o.doi(v);
    });
    var w = el("label", { class: "dk" }, [
      el("span", { class: "dk-t" }, [o.ten, out]), inp
    ]);
    w.datGiaTri = function (v) {
      inp.value = v;
      out.textContent = dinhDang(v, o.buoc) + (o.donVi || "");
    };
    return w;
  }

  function dinhDang(v, buoc) {
    if (buoc && buoc >= 1) return String(Math.round(v));
    if (Math.abs(v) >= 100) return v.toFixed(0);
    if (Math.abs(v) >= 1) return v.toFixed(2);
    return v.toFixed(3);
  }

  /** Nut bam. loai: "chinh" | "phu" */
  function nut(ten, onClick, loai) {
    return el("button", { class: "nut " + (loai || "phu"), onclick: onClick, text: ten });
  }

  /** Hop chon. */
  function chon(o) {
    var s = el("select", { class: "chon" });
    o.muc.forEach(function (m) {
      s.appendChild(el("option", { value: m.v, text: m.t }));
    });
    s.value = o.giaTri;
    s.addEventListener("change", function () { o.doi(s.value); });
    var w = el("label", { class: "dk" }, [el("span", { class: "dk-t" }, [o.ten]), s]);
    w.datGiaTri = function (v) { s.value = v; };
    return w;
  }

  /** O danh dau. */
  function danhDau(o) {
    var c = el("input", { type: "checkbox" });
    c.checked = !!o.giaTri;
    c.addEventListener("change", function () { o.doi(c.checked); });
    var w = el("label", { class: "dk dk-ck" }, [c, el("span", {}, [o.ten])]);
    w.datGiaTri = function (v) { c.checked = !!v; };
    return w;
  }

  /** O nhap so chinh xac — cho gia tri ma keo thanh truot khong voi toi
      (vi du "so bat dau = 837799"). */
  function nhapSo(o) {
    var inp = el("input", {
      type: "number", class: "so-nhap",
      min: o.min === undefined ? "" : o.min,
      max: o.max === undefined ? "" : o.max,
      step: o.buoc || 1, value: o.giaTri
    });
    function gui() {
      var v = parseFloat(inp.value);
      if (isNaN(v)) { inp.value = o.giaTri; return; }
      if (o.min !== undefined) v = Math.max(o.min, v);
      if (o.max !== undefined) v = Math.min(o.max, v);
      if ((o.buoc || 1) >= 1) v = Math.round(v);
      inp.value = v;
      o.doi(v);
    }
    inp.addEventListener("change", gui);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") gui(); });
    var w = el("label", { class: "dk" }, [el("span", { class: "dk-t" }, [o.ten]), inp]);
    w.datGiaTri = function (v) { inp.value = v; };
    return w;
  }

  /** O nhap hat giong + nut gieo lai. Cung hat -> cung ket qua. */
  function hatGiong(o) {
    var inp = el("input", { type: "number", class: "so-nhap", min: 0, step: 1, value: o.giaTri });
    inp.addEventListener("change", function () {
      o.doi(Math.max(0, Math.round(parseFloat(inp.value) || 0)));
    });
    var gieo = el("button", {
      class: "nut nho", title: "Gieo hạt ngẫu nhiên khác", text: "🎲",
      onclick: function () {
        var v = Math.floor(Math.random() * 99999);
        inp.value = v; o.doi(v);
      }
    });
    var w = el("label", { class: "dk" }, [
      el("span", { class: "dk-t" }, [o.ten]),
      el("div", { class: "hang" }, [inp, gieo])
    ]);
    w.datGiaTri = function (v) { inp.value = v; };
    return w;
  }

  /* ---------- 3. Tham so khai bao bang lieu do ------------------------ *
     Khai bao MOT lan -> tu sinh giao dien + trang thai + nut dat lai +
     doc/ghi URL. Thay cho viec tu tay ghep slider voi mot object trang thai.

       var TS = V.thamSo([
         { ma:"n",   ten:"Số bắt đầu", kieu:"so",   min:1, max:1e5, buoc:1, gt:27 },
         { ma:"che", ten:"Chế độ",     kieu:"chon", muc:[{v:"a",t:"A"}], gt:"a" },
         { ma:"log", ten:"Trục log",   kieu:"bat",  gt:true },
         { ma:"hat", ten:"Hạt giống",  kieu:"hat",  gt:42 },
         { ten:"Riêng chế độ hoa văn", kieu:"nhom" },
         { ma:"goc", ten:"Góc",        kieu:"so", min:0, max:90, gt:12,
           hien:function (gt) { return gt.che === "hoa-van"; } }
       ], {
         doi  : function (ma, giaTri, gt) { ... },   // goi sau moi thay doi
         preset: [ { ten:"Số 27 nổi tiếng", gt:{ n:27 } } ]
       });

     Tra ve:
       TS.gt        object gia tri hien tai — doc truc tiep: TS.gt.n
       TS.dk()      MOT phan tu DOM chua toan bo dieu khien
       TS.dat(ma, v[, imLang])
       TS.datLai()  ve gia tri mac dinh
       TS.chuoiURL() chuoi query cua trang thai hien tai
   * ------------------------------------------------------------------- */
  function thamSo(lieuDo, o) {
    o = o || {};
    var gt = {}, oDK = {}, oBoc = {}, deTrong = {};

    lieuDo.forEach(function (m) {
      if (!m.ma) return;
      deTrong[m.ma] = m.gt;
      gt[m.ma] = m.gt;
    });

    /* Gia tri tu URL de len gia tri mac dinh. */
    Object.keys(THAM_SO_URL).forEach(function (k) {
      var m = timLieuDo(k);
      if (m) gt[k] = epKieu(m, THAM_SO_URL[k]);
    });

    function timLieuDo(ma) {
      for (var i = 0; i < lieuDo.length; i++) if (lieuDo[i].ma === ma) return lieuDo[i];
      return null;
    }

    function epKieu(m, chuoi) {
      if (m.kieu === "bat") return chuoi === "1" || chuoi === "true";
      if (m.kieu === "so" || m.kieu === "hat" || m.kieu === "nhap") {
        var v = parseFloat(chuoi);
        if (isNaN(v)) return m.gt;
        if (m.min !== undefined) v = Math.max(m.min, v);
        if (m.max !== undefined) v = Math.min(m.max, v);
        return v;
      }
      if (m.kieu === "chon") {
        var hopLe = (m.muc || []).some(function (x) { return String(x.v) === chuoi; });
        return hopLe ? chuoi : m.gt;
      }
      return chuoi;
    }

    function dat(ma, v, imLang) {
      if (gt[ma] === v) return;
      gt[ma] = v;
      var w = oDK[ma];
      if (w && w.datGiaTri) w.datGiaTri(v);
      capNhatHien();
      ghiURL();
      if (!imLang && o.doi) o.doi(ma, v, gt);
    }

    /* An/hien tung dieu khien theo ham hien(gt). */
    function capNhatHien() {
      lieuDo.forEach(function (m) {
        var b = oBoc[m.ma || ("__" + m.ten)];
        if (!b || !m.hien) return;
        b.style.display = m.hien(gt) ? "" : "none";
      });
    }

    function chuoiURL() {
      var p = [];
      lieuDo.forEach(function (m) {
        if (!m.ma) return;
        var v = gt[m.ma];
        if (v === deTrong[m.ma]) return;          /* bang mac dinh thi bo qua */
        if (m.kieu === "bat") v = v ? "1" : "0";
        p.push(encodeURIComponent(m.ma) + "=" + encodeURIComponent(String(v)));
      });
      return p.join("&");
    }

    function ghiURL() {
      if (!bat("permalink")) return;
      datQueryURL(chuoiURL());
    }

    function datLai() {
      Object.keys(deTrong).forEach(function (k) {
        gt[k] = deTrong[k];
        if (oDK[k] && oDK[k].datGiaTri) oDK[k].datGiaTri(deTrong[k]);
      });
      capNhatHien();
      ghiURL();
      if (o.doi) o.doi(null, null, gt);
    }

    function apDung(bo) {
      Object.keys(bo).forEach(function (k) {
        var m = timLieuDo(k);
        if (!m) return;
        gt[k] = bo[k];
        if (oDK[k] && oDK[k].datGiaTri) oDK[k].datGiaTri(bo[k]);
      });
      capNhatHien();
      ghiURL();
      if (o.doi) o.doi(null, null, gt);
    }

    function dk() {
      var con = [];

      /* --- hang preset (kich ban dung san) --- */
      if (o.preset && o.preset.length) {
        con.push(el("div", { class: "ts-nhan", text: "Kịch bản dựng sẵn" }));
        con.push(el("div", { class: "chip-hang" }, o.preset.map(function (p) {
          return el("button", {
            class: "chip", text: p.ten, title: p.moTa || "",
            onclick: function () { apDung(p.gt); }
          });
        })));
      }

      lieuDo.forEach(function (m) {
        var w;
        if (m.kieu === "nhom") {
          w = el("div", { class: "ts-nhan", text: m.ten });
        } else if (m.kieu === "chon") {
          w = chon({ ten: m.ten, muc: m.muc, giaTri: gt[m.ma],
                     doi: function (v) { dat(m.ma, v); } });
        } else if (m.kieu === "bat") {
          w = danhDau({ ten: m.ten, giaTri: gt[m.ma],
                        doi: function (v) { dat(m.ma, v); } });
        } else if (m.kieu === "hat") {
          w = hatGiong({ ten: m.ten, giaTri: gt[m.ma],
                         doi: function (v) { dat(m.ma, v); } });
        } else if (m.kieu === "nhap") {
          w = nhapSo({ ten: m.ten, min: m.min, max: m.max, buoc: m.buoc,
                       giaTri: gt[m.ma], doi: function (v) { dat(m.ma, v); } });
        } else {
          w = truot({ ten: m.ten, min: m.min, max: m.max, buoc: m.buoc,
                      donVi: m.donVi, giaTri: gt[m.ma],
                      doi: function (v) { dat(m.ma, v); } });
        }
        if (m.ma) oDK[m.ma] = w;
        var boc = el("div", { class: "ts-o" }, [w]);
        if (m.moTa) boc.appendChild(el("div", { class: "ts-mt", html: m.moTa }));
        oBoc[m.ma || ("__" + m.ten)] = boc;
        con.push(boc);
      });

      con.push(el("div", { class: "ts-day" }, [
        nut("↺ Tham số mặc định", datLai)
      ]));

      var hop = el("div", { class: "ts" }, con);
      capNhatHien();
      return hop;
    }

    return {
      gt: gt, dk: dk, dat: dat, datLai: datLai, apDung: apDung,
      chuoiURL: chuoiURL,
      doc: function () { var c = {}; Object.keys(gt).forEach(function (k) { c[k] = gt[k]; }); return c; }
    };
  }

  /* ---------- 4. Canvas ----------------------------------------------- */

  /** Canvas kich thuoc co dinh, xu ly man hinh net cao. */
  function veBang(w, h) {
    var cv = el("canvas", { class: "cv" });
    var g = cv.getContext("2d");
    cv.g = g;
    datKichThuoc(cv, w, h);
    return cv;
  }

  function datKichThuoc(cv, w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    cv.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv.W = w; cv.H = h;
    /* Doi he toa do: truc y huong LEN (nhu toan hoc) */
    cv.hemToan = function (xmin, xmax, ymin, ymax) {
      var sx = cv.W / (xmax - xmin), sy = cv.H / (ymax - ymin);
      return {
        x: function (x) { return (x - xmin) * sx; },
        y: function (y) { return cv.H - (y - ymin) * sy; },
        nx: function (px) { return px / sx + xmin; },
        ny: function (py) { return (cv.H - py) / sy + ymin; },
        sx: sx, sy: sy
      };
    };
  }

  /** Canvas CO GIAN theo be rong khung chua. Tu ve lai khi doi kich thuoc
      — nho vay toan man hinh va man hinh nho deu dung.
        var cv = V.veBangCo({ rong: 760, tiLe: 0.62, veLai: veLai });
      tiLe = cao / rong. veLai() se duoc goi sau moi lan doi kich thuoc. */
  function veBangCo(o) {
    var cv = veBang(o.rong || 760, Math.round((o.rong || 760) * (o.tiLe || 0.62)));
    cv.style.width = "100%";
    cv.style.maxWidth = (o.toiDa || 1400) + "px";
    var hienTai = 0;

    cv.doKichThuoc = function () {
      var w = Math.round(cv.clientWidth || o.rong || 760);
      if (!w || Math.abs(w - hienTai) < 2) return false;
      hienTai = w;
      datKichThuoc(cv, w, Math.round(w * (o.tiLe || 0.62)));
      cv.style.width = "100%";     /* datKichThuoc dat lai px — ep ve 100% */
      return true;
    };

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (cv.doKichThuoc() && o.veLai) o.veLai();
      });
      ro.observe(cv);
      cv.thoi = function () { try { ro.disconnect(); } catch (e) {} };
    } else {
      window.addEventListener("resize", function () {
        if (cv.doKichThuoc() && o.veLai) o.veLai();
      });
    }
    return cv;
  }

  function mau(ten) {
    var cs = getComputedStyle(document.documentElement);
    return cs.getPropertyValue("--" + ten).trim() || "#000";
  }

  /* Ve luoi + truc cho he toa do toan hoc. */
  function veLuoi(g, T, xmin, xmax, ymin, ymax, W, H, buoc) {
    buoc = buoc || 1;
    g.save();
    g.strokeStyle = mau("bd2"); g.lineWidth = 1;
    for (var x = Math.ceil(xmin / buoc) * buoc; x <= xmax; x += buoc) {
      g.beginPath(); g.moveTo(T.x(x), 0); g.lineTo(T.x(x), H); g.stroke();
    }
    for (var y = Math.ceil(ymin / buoc) * buoc; y <= ymax; y += buoc) {
      g.beginPath(); g.moveTo(0, T.y(y)); g.lineTo(W, T.y(y)); g.stroke();
    }
    g.strokeStyle = mau("bd"); g.lineWidth = 1.5;
    if (ymin < 0 && ymax > 0) { g.beginPath(); g.moveTo(0, T.y(0)); g.lineTo(W, T.y(0)); g.stroke(); }
    if (xmin < 0 && xmax > 0) { g.beginPath(); g.moveTo(T.x(0), 0); g.lineTo(T.x(0), H); g.stroke(); }
    g.restore();
  }

  /* Thang mau chuyen cho ban do nhiet. Moi trang de len bang
     CAU_HINH_VIS.thangMau = [[moc, [r,g,b]], ...] de khop mau nhan cua minh. */
  var THANG_MAC_DINH = [
    [0.00, [253, 242, 246]],
    [0.35, [244, 190, 214]],
    [0.65, [199, 60, 122]],
    [1.00, [88, 12, 45]]
  ];
  function thangMau(t) {
    t = Math.max(0, Math.min(1, t));
    var diem = ch("thangMau", THANG_MAC_DINH);
    for (var i = 1; i < diem.length; i++) {
      if (t <= diem[i][0]) {
        var a = diem[i - 1], b = diem[i];
        var u = (t - a[0]) / (b[0] - a[0]);
        return "rgb(" + [0, 1, 2].map(function (k) {
          return Math.round(a[1][k] + u * (b[1][k] - a[1][k]));
        }).join(",") + ")";
      }
    }
    var cuoi = diem[diem.length - 1][1];
    return "rgb(" + cuoi.join(",") + ")";
  }

  /* ---------- 4b. Bang tich luy --------------------------------------- *
     Cho lab ve CHONG DAN len nhau: hoa van Collatz, quy dao quan the, ban
     do nhiet tinh dan tung o. Ve lai tu dau moi khung hinh thi khong kip,
     nen giu mot canvas phu, chi ve phan MOI vao do roi dan ca tam len.

       var BTL = V.bangTichLuy(cv);
       // trong ve(k):
       BTL.toi(k, function (g, i) { ...ve muc thu i... });   // g: he toa do logic
       nen(cv); BTL.dan();
       // trong datLai(): BTL.xoa();

     Doi kich thuoc canvas thi bo dem tu xoa va dem lai tu 0 — lan `toi()`
     ke tiep se ve lai toan bo, dung y nghia.
   * -------------------------------------------------------------------- */
  function bangTichLuy(cv) {
    var dem = el("canvas");

    function dongBo() {
      if (dem.width !== cv.width || dem.height !== cv.height) {
        dem.width = cv.width;
        dem.height = cv.height;
        api.daVe = 0;              /* tam cu khong con dung kich thuoc */
      }
      return dem.getContext("2d");
    }

    var api = {
      dem: dem,
      daVe: 0,
      xoa: function () {
        var g = dongBo();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, dem.width, dem.height);
        api.daVe = 0;
      },
      /* Ve tiep cho du k muc. veMot(g, i) nhan he toa do LOGIC (da chia dpr). */
      toi: function (k, veMot) {
        var g = dongBo();
        if (api.daVe >= k) return;
        var dpr = cv.width / cv.W;
        g.save();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        while (api.daVe < k) { veMot(g, api.daVe + 1); api.daVe++; }
        g.restore();
      },
      /* Dan tam tich luy len canvas chinh, 1:1 theo diem anh thiet bi. */
      dan: function () {
        var g = cv.g;
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(dem, 0, 0);
        g.restore();
      }
    };
    return api;
  }

  /* ---------- 4c. Bieu do ---------------------------------------------- *
     22/22 tep lab hien co deu tu ve truc, luoi va nhan so — cung mot doan
     ma chep di chep lai. Day la ban dung chung.

       var B = V.bieuDo(cv, {
         x: { min:0, max:100, nhan:"bước →" },
         y: { min:1, max:9232, log:true, dinhDang: V.soGon },
         le: { t:20, r:18, b:34, l:66 },   // tuy chon
         luoi: 5                            // so duong luoi ngang
       });
       B.nen(); B.truc();
       B.duong(diem, V.mau("ac"));          // diem = [[x,y], ...]
       B.doan(x1,y1,x2,y2, mau);            // tung doan, khi moi doan mot mau
       B.diem(x,y,mau); B.moc(y,mau,"đỉnh"); B.chu(x,y,"...",mau);

     Truc log nhan min > 0; gia tri <= 0 bi kep ve min de khong sinh NaN.
   * -------------------------------------------------------------------- */
  function bieuDo(cv, o) {
    var g = cv.g;
    var le = o.le || { t: 20, r: 18, b: 34, l: 66 };
    var X = o.x || {}, Y = o.y || {};
    var soLuoi = o.luoi === undefined ? 5 : o.luoi;
    var CHU = "11px ui-monospace,monospace";

    function hY(v) {
      if (!Y.log) return v;
      return Math.log(Math.max(v, Y.min > 0 ? Y.min : 1e-9)) / Math.LN10;
    }

    var api = {
      le: le,
      /** Bien trai/phai/tren/duoi cua vung ve, tinh bang diem anh logic. */
      x0: function () { return le.l; },
      x1: function () { return cv.W - le.r; },
      y0: function () { return le.t; },
      y1: function () { return cv.H - le.b; },

      px: function (x) {
        var a = X.min, b = X.max;
        if (b === a) return api.x0();
        return api.x0() + (api.x1() - api.x0()) * (x - a) / (b - a);
      },
      py: function (v) {
        var a = hY(Y.min), b = hY(Y.max);
        if (b === a) return api.y1();
        return api.y1() - (api.y1() - api.y0()) * (hY(v) - a) / (b - a);
      },

      nen: function () {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
      },

      truc: function () {
        var dinhDang = Y.dinhDang || soGon;
        g.save();
        g.font = CHU;
        g.strokeStyle = mau("bd2"); g.lineWidth = 1;
        g.fillStyle = mau("tx3");
        g.textAlign = "right"; g.textBaseline = "middle";
        for (var i = 0; i <= soLuoi; i++) {
          var t = i / soLuoi;
          var yy = api.y0() + (api.y1() - api.y0()) * t;
          g.beginPath(); g.moveTo(api.x0(), yy); g.lineTo(api.x1(), yy); g.stroke();
          if (Y.hienSo === false) continue;
          var hi = hY(Y.min) + (hY(Y.max) - hY(Y.min)) * (1 - t);
          g.fillText(dinhDang(Y.log ? Math.pow(10, hi) : hi), api.x0() - 8, yy);
        }
        g.strokeStyle = mau("bd"); g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(api.x0(), api.y0());
        g.lineTo(api.x0(), api.y1());
        g.lineTo(api.x1(), api.y1());
        g.stroke();
        /* Nhan so tren truc ngang. Dat X.hienSo = false de chi giu ten truc
           (vi du khi truc la "thoi gian" khong co don vi dang ke). */
        var cachDay = 8;
        if (X.hienSo !== false) {
          var dinhDangX = X.dinhDang || soGon;
          var soVach = X.vach === undefined ? 5 : X.vach;
          g.fillStyle = mau("tx3");
          g.textAlign = "center"; g.textBaseline = "top";
          for (var q = 0; q <= soVach; q++) {
            var xv = X.min + (X.max - X.min) * q / soVach;
            g.fillText(dinhDangX(xv), api.px(xv), api.y1() + 5);
          }
          cachDay = 19;                 /* chua cho hang so vua ve */
        }
        if (X.nhan) {
          g.fillStyle = mau("tx3");
          g.textAlign = "center"; g.textBaseline = "top";
          g.fillText(X.nhan, (api.x0() + api.x1()) / 2, api.y1() + cachDay);
        }
        if (Y.nhan) {
          g.save();
          g.translate(13, (api.y0() + api.y1()) / 2);
          g.rotate(-Math.PI / 2);
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(Y.nhan, 0, 0);
          g.restore();
        }
        g.restore();
      },

      duong: function (diem, m, day) {
        if (!diem || diem.length < 2) return;
        g.save();
        g.strokeStyle = m || mau("ac");
        g.lineWidth = day || 1.8;
        g.lineJoin = "round"; g.lineCap = "round";
        g.beginPath();
        g.moveTo(api.px(diem[0][0]), api.py(diem[0][1]));
        for (var i = 1; i < diem.length; i++) g.lineTo(api.px(diem[i][0]), api.py(diem[i][1]));
        g.stroke();
        g.restore();
      },

      doan: function (x1, v1, x2, v2, m, day) {
        g.save();
        g.strokeStyle = m || mau("ac");
        g.lineWidth = day || 1.8; g.lineCap = "round";
        g.beginPath();
        g.moveTo(api.px(x1), api.py(v1));
        g.lineTo(api.px(x2), api.py(v2));
        g.stroke();
        g.restore();
      },

      /** Mot cot dung tu day bieu do len gia tri v, tam tai x.
          `rong` tinh theo DON VI TRUC X, khong phai diem anh — nho vay
          histogram giu dung ti le khi doi kich thuoc canvas. */
      cot: function (x, v, rong, m) {
        var xa = api.px(x - rong / 2), xb = api.px(x + rong / 2);
        var yv = api.py(v), yd = api.y1();
        g.save();
        g.fillStyle = m || mau("ac");
        g.fillRect(xa, Math.min(yv, yd),
                   Math.max(1, xb - xa - 1), Math.abs(yd - yv));
        g.restore();
      },

      /** Ca day cot — histogram tu mang dem trai deu tren [xMin, xMax]. */
      cotDay: function (dem, xMin, xMax, m) {
        var n = dem && dem.length;
        if (!n) return;
        var rong = (xMax - xMin) / n;
        for (var i = 0; i < n; i++) {
          if (!dem[i]) continue;
          api.cot(xMin + (i + 0.5) * rong, dem[i], rong, m);
        }
      },

      diem: function (x, v, m, r) {
        g.save();
        g.fillStyle = m || mau("ac2");
        g.beginPath(); g.arc(api.px(x), api.py(v), r || 4.5, 0, 6.2832); g.fill();
        g.restore();
      },

      /** Duong ngang dut net danh dau mot muc — dinh, nguong, muc tieu. */
      moc: function (v, m, chu) {
        g.save();
        g.strokeStyle = m || mau("loi"); g.lineWidth = 1;
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(api.x0(), api.py(v)); g.lineTo(api.x1(), api.py(v));
        g.stroke();
        g.setLineDash([]);
        if (chu) {
          g.font = CHU;
          g.fillStyle = m || mau("loi");
          g.textAlign = "left"; g.textBaseline = "bottom";
          g.fillText(chu, api.x0() + 6, api.py(v) - 4);
        }
        g.restore();
      },

      chu: function (x, v, text, m, canh) {
        g.save();
        g.font = CHU;
        g.fillStyle = m || mau("tx2");
        g.textAlign = canh || "left"; g.textBaseline = "bottom";
        g.fillText(text, api.px(x) + (canh === "right" ? -8 : 8), api.py(v) - 7);
        g.restore();
      },

      /** Doi tham so truc khi du lieu thay doi, khong phai dung lai bieu do. */
      dat: function (truc) {
        if (truc.x) X = truc.x;
        if (truc.y) Y = truc.y;
      }
    };
    return api;
  }

  /** So gon cho nhan truc: 12,3k · 4,5 triệu · 1,2×10¹². */
  function soGon(v) {
    var a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(1) + "×10¹²";
    if (a >= 1e9) return (v / 1e9).toFixed(1) + " tỉ";
    if (a >= 1e6) return (v / 1e6).toFixed(2) + " triệu";
    if (a >= 1000) return (v / 1000).toFixed(1) + "k";
    if (a >= 10) return String(Math.round(v));
    if (a >= 1) return v.toFixed(1);
    return v.toFixed(3);
  }

  /* ---------- 4d. Mau dang so ----------------------------------------- */
  /* V.mau() tra ve chuoi CSS ("#0d7490", "rgb(13,116,144)"). Luoi o ghi
     thang vao ImageData nen can ba so, khong dung duoc chuoi. */
  function mauSo(c) {
    c = String(c || "").trim();
    var m = c.match(/^#([0-9a-f]{3})$/i);
    if (m) {
      return [parseInt(m[1][0] + m[1][0], 16),
              parseInt(m[1][1] + m[1][1], 16),
              parseInt(m[1][2] + m[1][2], 16), 255];
    }
    m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      return [parseInt(m[1].slice(0, 2), 16),
              parseInt(m[1].slice(2, 4), 16),
              parseInt(m[1].slice(4, 6), 16), 255];
    }
    m = c.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      var p = m[1].split(",").map(function (x) { return parseFloat(x); });
      return [p[0] | 0, p[1] | 0, p[2] | 0,
              p.length > 3 ? Math.round(p[3] * 255) : 255];
    }
    return [0, 0, 0, 255];
  }

  /* ---------- 4e. Luoi o ---------------------------------------------- *
     Cho moi lab dung luoi te bao: Game of Life, Rule 30, tham tham, dong
     cat, Schelling. To tung o bang fillRect thi 500x500 = 250 000 lenh ve
     moi khung hinh — khong kip. O day moi o la MOT diem anh trong mot
     ImageData nho, ve xong moi phong to len canvas that (tat lam mem vien
     de o vuong sac net). Ve mot luoi 500x500 ton dung mot lenh drawImage.

       var L = V.luoiO(cv, { cot: 200, hang: 150, le: 10 });
       L.bangMau([V.mau("surf"), V.mau("ac"), V.mau("ba")]);
       L.tuMang(trangThai);        // Uint8Array chi so mau, nhanh nhat
       L.dat(c, r, 2);             // hoac to tung o
       L.dan();                    // day len canvas
       var o = L.oTai(chuot.x, chuot.y);   // -> {c, r} hoac null
   * -------------------------------------------------------------------- */
  function luoiO(cv, o) {
    var cot = Math.max(1, o.cot | 0);
    var hang = Math.max(1, o.hang | 0);
    var dem = el("canvas");
    dem.width = cot; dem.height = hang;
    var gd = dem.getContext("2d");
    var anh = gd.createImageData(cot, hang);
    var px = anh.data;
    var bang = [[255, 255, 255, 255]];
    var x0 = 0, y0 = 0, rong = 0, cao = 0, canh = 1;

    function tinhKhung() {
      var le = o.le === undefined ? 8 : o.le;
      var lt = o.leTren === undefined ? le : o.leTren;
      /* leDuoi chua cho bieu do nam duoi luoi trong cung mot canvas.
         leTrai/lePhai de V.khungNhieu xep nhieu luoi canh nhau. */
      var ld = o.leDuoi === undefined ? le : o.leDuoi;
      var ltr = o.leTrai === undefined ? le : o.leTrai;
      var lph = o.lePhai === undefined ? le : o.lePhai;
      var W = Math.max(1, cv.W - ltr - lph);
      var H = Math.max(1, cv.H - lt - ld);
      canh = Math.min(W / cot, H / hang);
      rong = canh * cot; cao = canh * hang;
      x0 = ltr + (W - rong) / 2;
      y0 = lt + (H - cao) / 2;
    }

    var api = {
      cot: cot, hang: hang,

      /** Bang mau: mang chuoi CSS. Chi so trong tuMang()/dat() tro vao day. */
      bangMau: function (ds) {
        bang = ds.map(mauSo);
        return api;
      },

      dat: function (c, r, k) {
        if (c < 0 || r < 0 || c >= cot || r >= hang) return;
        api.datChiSo(r * cot + c, k);
      },

      datChiSo: function (i, k) {
        var m = bang[k] || bang[0];
        var j = i * 4;
        px[j] = m[0]; px[j + 1] = m[1]; px[j + 2] = m[2]; px[j + 3] = m[3];
      },

      /** To ca luoi tu mot mang chi so mau. Day la duong nhanh nhat. */
      tuMang: function (m) {
        var n = Math.min(m.length, cot * hang);
        for (var i = 0; i < n; i++) {
          var c = bang[m[i]] || bang[0];
          var j = i * 4;
          px[j] = c[0]; px[j + 1] = c[1]; px[j + 2] = c[2]; px[j + 3] = c[3];
        }
      },

      xoa: function (k) {
        var m = bang[k || 0] || bang[0];
        for (var i = 0; i < cot * hang; i++) {
          var j = i * 4;
          px[j] = m[0]; px[j + 1] = m[1]; px[j + 2] = m[2]; px[j + 3] = m[3];
        }
      },

      dan: function () {
        tinhKhung();
        gd.putImageData(anh, 0, 0);
        var g = cv.g;
        g.save();
        /* Tat lam mem: o vuong phai sac canh, khong duoc nhoe. */
        g.imageSmoothingEnabled = false;
        g.mozImageSmoothingEnabled = false;
        g.webkitImageSmoothingEnabled = false;
        g.drawImage(dem, x0, y0, rong, cao);
        g.restore();
      },

      /** Vien quanh luoi — giup nguoi xem thay ranh gioi khi o thua. */
      vien: function (m) {
        var g = cv.g;
        g.save();
        g.strokeStyle = m || mau("bd");
        g.lineWidth = 1;
        g.strokeRect(x0 - 0.5, y0 - 0.5, rong + 1, cao + 1);
        g.restore();
      },

      /** Diem anh tren canvas -> o nao. Tra null khi tro ra ngoai luoi. */
      oTai: function (x, y) {
        if (!canh) return null;
        var c = Math.floor((x - x0) / canh);
        var r = Math.floor((y - y0) / canh);
        if (c < 0 || r < 0 || c >= cot || r >= hang) return null;
        return { c: c, r: r, i: r * cot + c };
      },

      /** Kich thuoc mot o tren man hinh, tinh bang diem anh logic. */
      canhO: function () { tinhKhung(); return canh; }
    };
    return api;
  }

  /* ---------- 4f. He tac tu + bam khong gian --------------------------- *
     Moi lab bay dan (boids, dich te, dong xe, nam nhay) deu hoi cung mot
     cau: "ai dang o gan toi?". Hoi thang thi phai duyet ca n tac tu cho
     tung tac tu — O(n^2), chet o khoang 2000 con. O day toa do duoc bam
     vao luoi o, nen chi phai duyet nhung o ke ben: O(n).

       var HT = V.hat({ soToiDa: 4000, rong: 100, cao: 70, banKinh: 6 });
       HT.them(x, y, vx, vy, loai);
       HT.dungBam();                       // goi MOT lan moi buoc, truoc khi hoi
       HT.quanh(i, 6, function (j, dx, dy, d2) { ... });
       HT.tien(dt);                        // doi cho + xu ly mep

     `vien` la "vong" (mep noi vong quanh, mac dinh) hoac "chan" (dap lai).
     O che do "vong", dx/dy tra ve trong quanh() DA tinh duong vong ngan
     nhat — lab khong phai tu lo.
   * -------------------------------------------------------------------- */
  function hat(o) {
    var toiDa = o.soToiDa || 2000;
    var rong = o.rong || 100, cao = o.cao || 100;
    var vong = o.vien !== "chan";
    /* O bam nen rong bang ban kinh hoi hay dung nhat: nho qua thi nhieu o,
       to qua thi moi o nhieu tac tu — ca hai deu cham.

       O PHAI LAT DUNG MIEN. Neu lay be rong o = banKinh roi lam tron len so
       o, o cuoi cung se hut (vi du mien 100, o 7 -> 15 o phu 105). Luc do o
       cuoi va o dau ke nhau tren vong, nhung khoang cach that giua chung nho
       hon mot o, va phep quet "lui/tien mot o" bo sot lang gieng ngay cho noi
       vong. Nen chia so o TRUOC roi lay be rong = mien / so o. */
    var mong = o.banKinh || Math.max(rong, cao) / 40;
    var nc = Math.max(1, Math.floor(rong / mong));
    var nr = Math.max(1, Math.floor(cao / mong));
    var wx = rong / nc, wy = cao / nr;
    var soO = nc * nr;

    var dau = new Int32Array(soO + 1);
    var troOi = new Int32Array(soO + 1);
    var thuTu = new Int32Array(toiDa);

    function oCua(x, y) {
      var c = Math.floor(x / wx), r = Math.floor(y / wy);
      if (c < 0) c = 0; else if (c >= nc) c = nc - 1;
      if (r < 0) r = 0; else if (r >= nr) r = nr - 1;
      return r * nc + c;
    }

    /** Khoang cach co dau theo mot truc, di duong vong neu mep noi vong. */
    function lech(a, b, L) {
      var d = b - a;
      if (vong) {
        if (d > L / 2) d -= L;
        else if (d < -L / 2) d += L;
      }
      return d;
    }

    var api = {
      n: 0, soToiDa: toiDa, rong: rong, cao: cao, vong: vong,
      x: new Float32Array(toiDa),
      y: new Float32Array(toiDa),
      vx: new Float32Array(toiDa),
      vy: new Float32Array(toiDa),
      loai: new Uint8Array(toiDa),
      so: new Float32Array(toiDa),     /* mot so tuy y cho lab dung: tuoi, nang luong... */

      xoaHet: function () { api.n = 0; },

      them: function (x, y, vx, vy, loai, so) {
        if (api.n >= toiDa) return -1;
        var i = api.n++;
        api.x[i] = x; api.y[i] = y;
        api.vx[i] = vx || 0; api.vy[i] = vy || 0;
        api.loai[i] = loai || 0;
        api.so[i] = so || 0;
        return i;
      },

      /** Xoa bang cach doi cho voi phan tu cuoi — O(1), nhung DOI CHI SO
          cua phan tu cuoi, nen dung khi dang duyet xuoi. */
      xoa: function (i) {
        var c = --api.n;
        if (i !== c) {
          api.x[i] = api.x[c]; api.y[i] = api.y[c];
          api.vx[i] = api.vx[c]; api.vy[i] = api.vy[c];
          api.loai[i] = api.loai[c]; api.so[i] = api.so[c];
        }
      },

      lech: lech,

      /** Dung lai bang bam. Phai goi sau khi doi cho va truoc khi hoi quanh(). */
      dungBam: function () {
        var i, b;
        for (b = 0; b <= soO; b++) dau[b] = 0;
        for (i = 0; i < api.n; i++) dau[oCua(api.x[i], api.y[i]) + 1]++;
        for (b = 0; b < soO; b++) dau[b + 1] += dau[b];
        for (b = 0; b <= soO; b++) troOi[b] = dau[b];
        for (i = 0; i < api.n; i++) {
          thuTu[troOi[oCua(api.x[i], api.y[i])]++] = i;
        }
      },

      /** Goi cb(j, dx, dy, d2) cho moi tac tu j (khac i) nam trong ban kinh r.
          dx, dy huong TU i TOI j va da tinh duong vong. */
      quanh: function (i, r, cb) {
        var xi = api.x[i], yi = api.y[i];
        var r2 = r * r;
        var oRx = Math.ceil(r / wx), oRy = Math.ceil(r / wy);
        /* Vung quet da phu het vong thi quet moi o DUNG MOT LAN — neu cu
           cong tru chi so roi lay du, cung mot o se duoc quet nhieu lan va
           cb() bi goi lap. */
        var motLuotX = (2 * oRx + 1) >= nc;
        var motLuotY = (2 * oRy + 1) >= nr;
        var c0 = Math.floor(xi / wx), r0 = Math.floor(yi / wy);
        if (c0 >= nc) c0 = nc - 1; if (c0 < 0) c0 = 0;
        if (r0 >= nr) r0 = nr - 1; if (r0 < 0) r0 = 0;

        var drTu = motLuotY ? 0 : -oRy, drDen = motLuotY ? nr - 1 : oRy;
        var dcTu = motLuotX ? 0 : -oRx, dcDen = motLuotX ? nc - 1 : oRx;

        for (var dr = drTu; dr <= drDen; dr++) {
          for (var dc = dcTu; dc <= dcDen; dc++) {
            var cc = motLuotX ? dc : c0 + dc;
            var rr = motLuotY ? dr : r0 + dr;
            if (vong) {
              cc = ((cc % nc) + nc) % nc;
              rr = ((rr % nr) + nr) % nr;
            } else if (cc < 0 || rr < 0 || cc >= nc || rr >= nr) continue;
            var b = rr * nc + cc;
            for (var k = dau[b]; k < dau[b + 1]; k++) {
              var j = thuTu[k];
              if (j === i) continue;
              var ddx = lech(xi, api.x[j], rong);
              var ddy = lech(yi, api.y[j], cao);
              var d2 = ddx * ddx + ddy * ddy;
              if (d2 <= r2) cb(j, ddx, ddy, d2);
            }
          }
        }
      },

      /** Doi cho theo van toc roi xu ly mep. */
      tien: function (dt) {
        dt = dt === undefined ? 1 : dt;
        for (var i = 0; i < api.n; i++) {
          api.x[i] += api.vx[i] * dt;
          api.y[i] += api.vy[i] * dt;
          if (vong) {
            if (api.x[i] < 0) api.x[i] += rong; else if (api.x[i] >= rong) api.x[i] -= rong;
            if (api.y[i] < 0) api.y[i] += cao; else if (api.y[i] >= cao) api.y[i] -= cao;
          } else {
            if (api.x[i] < 0) { api.x[i] = 0; api.vx[i] = -api.vx[i]; }
            else if (api.x[i] > rong) { api.x[i] = rong; api.vx[i] = -api.vx[i]; }
            if (api.y[i] < 0) { api.y[i] = 0; api.vy[i] = -api.vy[i]; }
            else if (api.y[i] > cao) { api.y[i] = cao; api.vy[i] = -api.vy[i]; }
          }
        }
      },

      /** Kep toc do ve trong [0, toiDa]. */
      kepToc: function (i, tocToiDa) {
        /* sqrt(x*x+y*y) chu khong phai Math.hypot: hypot xu ly tran so mot
           cach can than va cham hon han trong vong lap nong. */
        var v = Math.sqrt(api.vx[i] * api.vx[i] + api.vy[i] * api.vy[i]);
        if (v > tocToiDa && v > 0) {
          api.vx[i] = api.vx[i] / v * tocToiDa;
          api.vy[i] = api.vy[i] / v * tocToiDa;
        }
      }
    };
    return api;
  }

  /* ---------- 4g. Do thi / mang luoi ----------------------------------- *
     Cho lab lam viec tren mang: dong thuan Raft, the gioi nho, lan truyen
     tin, bam nhat quan. Lo phan te nhat va lap di lap lai nhat — luu tru,
     BO CUC, doi toa do, va bat chuot — con ve thi de lab tu quyet, vi moi
     lab ve mot kieu.

       var DT = V.doThi(cv, { soToiDa: 400, le: 24, leTren: 28 });
       DT.themNut(); DT.themCanh(0, 1);
       DT.boCucTron();                 // hoac DT.boCucLoXo(300)
       DT.veCanh(V.mau("bd"), 1);
       DT.veNut(function (i) { return V.mau("ac"); }, 9);
       var i = DT.nutTai(chuot.x, chuot.y);

     Toa do nut luu trong [0,1]x[0,1]; px()/py() doi sang diem anh, nen
     doi kich thuoc canvas khong phai tinh lai bo cuc.
   * -------------------------------------------------------------------- */
  function doThi(cv, o) {
    o = o || {};
    var toiDa = o.soToiDa || 400;
    /* Tap khoa "min,max" cua cac canh da co. Khong co no thi moi lan hoi
       "da co canh nay chua" phai quet ca danh sach — dung mot do thi 1500
       canh se ton hon mot trieu phep so sanh. */
    var khoaCanh = {};
    function khoa(a, b) { return a < b ? a + "," + b : b + "," + a; }

    var api = {
      n: 0,
      x: new Float32Array(toiDa),
      y: new Float32Array(toiDa),
      canh: [],                     /* [a, b] — do thi vo huong */
      bac: new Int32Array(toiDa),
      soToiDa: toiDa,

      xoaHet: function () {
        api.n = 0;
        api.canh.length = 0;
        khoaCanh = {};
        for (var i = 0; i < toiDa; i++) api.bac[i] = 0;
      },

      themNut: function (x, y) {
        if (api.n >= toiDa) return -1;
        var i = api.n++;
        api.x[i] = x === undefined ? 0.5 : x;
        api.y[i] = y === undefined ? 0.5 : y;
        api.bac[i] = 0;
        return i;
      },

      /** Them canh vo huong. Bo qua canh tu no toi no va canh trung. */
      themCanh: function (a, b) {
        if (a === b || a < 0 || b < 0 || a >= api.n || b >= api.n) return false;
        var kh = khoa(a, b);
        if (khoaCanh[kh] !== undefined) return false;
        khoaCanh[kh] = api.canh.length;
        api.canh.push([a, b]);
        api.bac[a]++; api.bac[b]++;
        return true;
      },

      /** Chi so cua canh (a,b), hoac -1 neu khong co. */
      coCanh: function (a, b) {
        var k = khoaCanh[khoa(a, b)];
        return k === undefined ? -1 : k;
      },

      xoaCanh: function (k) {
        if (k < 0 || k >= api.canh.length) return;
        var c = api.canh[k];
        api.bac[c[0]]--; api.bac[c[1]]--;
        api.canh.splice(k, 1);
        /* Chi so cua moi canh phia sau da tut mot bac — dung lai bang khoa. */
        khoaCanh = {};
        for (var j = 0; j < api.canh.length; j++) {
          khoaCanh[khoa(api.canh[j][0], api.canh[j][1])] = j;
        }
      },

      /** Danh sach ke, dung lai moi lan goi — lab nao duyet nhieu thi giu lai. */
      danhSachKe: function () {
        var ds = [];
        for (var i = 0; i < api.n; i++) ds.push([]);
        for (var k = 0; k < api.canh.length; k++) {
          ds[api.canh[k][0]].push(api.canh[k][1]);
          ds[api.canh[k][1]].push(api.canh[k][0]);
        }
        return ds;
      },

      /* ---------- bo cuc ---------- */

      boCucTron: function (batDau) {
        var g0 = batDau === undefined ? -Math.PI / 2 : batDau;
        for (var i = 0; i < api.n; i++) {
          var a = g0 + i / Math.max(1, api.n) * Math.PI * 2;
          api.x[i] = 0.5 + Math.cos(a) * 0.42;
          api.y[i] = 0.5 + Math.sin(a) * 0.42;
        }
      },

      /** Bo cuc lo xo (Fruchterman–Reingold rut gon): canh keo lai, moi
          cap nut day nhau. O(n^2) moi vong nen chi chay MOT lan luc dung
          do thi, khong chay trong vong ve. */
      boCucLoXo: function (soVong, hat) {
        var R = rng(hat || 1);
        var i, j, k;
        for (i = 0; i < api.n; i++) {
          /* Gieo tren dia thay vi tren o vuong: goc o vuong hut nut ra bien. */
          var a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.45;
          api.x[i] = 0.5 + Math.cos(a) * r;
          api.y[i] = 0.5 + Math.sin(a) * r;
        }
        var n = Math.max(1, api.n);
        var kLyTuong = Math.sqrt(1 / n) * 0.9;
        var dx = new Float32Array(n), dy = new Float32Array(n);
        var vong = soVong || 240;

        for (var t = 0; t < vong; t++) {
          var nhiet = 0.12 * (1 - t / vong) + 0.002;
          for (i = 0; i < n; i++) { dx[i] = 0; dy[i] = 0; }

          for (i = 0; i < n; i++) {
            for (j = i + 1; j < n; j++) {
              var ex = api.x[i] - api.x[j], ey = api.y[i] - api.y[j];
              var d2 = ex * ex + ey * ey;
              if (d2 < 1e-9) { ex = (R() - 0.5) * 1e-3; ey = (R() - 0.5) * 1e-3; d2 = 1e-6; }
              var d = Math.sqrt(d2);
              var f = kLyTuong * kLyTuong / d2;      /* day ra */
              dx[i] += ex / d * f; dy[i] += ey / d * f;
              dx[j] -= ex / d * f; dy[j] -= ey / d * f;
            }
          }
          for (k = 0; k < api.canh.length; k++) {
            var a2 = api.canh[k][0], b2 = api.canh[k][1];
            var gx = api.x[a2] - api.x[b2], gy = api.y[a2] - api.y[b2];
            var gd = Math.sqrt(gx * gx + gy * gy) || 1e-6;
            var fh = gd * gd / kLyTuong;             /* keo lai */
            dx[a2] -= gx / gd * fh; dy[a2] -= gy / gd * fh;
            dx[b2] += gx / gd * fh; dy[b2] += gy / gd * fh;
          }
          for (i = 0; i < n; i++) {
            var dd = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1e-9;
            var buoc = Math.min(dd, nhiet);
            api.x[i] += dx[i] / dd * buoc;
            api.y[i] += dy[i] / dd * buoc;
            if (api.x[i] < 0.03) api.x[i] = 0.03; else if (api.x[i] > 0.97) api.x[i] = 0.97;
            if (api.y[i] < 0.03) api.y[i] = 0.03; else if (api.y[i] > 0.97) api.y[i] = 0.97;
          }
        }
      },

      /* ---------- doi toa do ---------- */

      khung: function () {
        var le = o.le === undefined ? 20 : o.le;
        var lt = o.leTren === undefined ? le : o.leTren;
        var ld = o.leDuoi === undefined ? le : o.leDuoi;
        var W = Math.max(1, cv.W - le * 2), H = Math.max(1, cv.H - lt - ld);
        /* Giu ti le vuong de vong tron khong thanh bau duc. */
        var c = Math.min(W, H);
        return { x0: le + (W - c) / 2, y0: lt + (H - c) / 2, canh: c };
      },

      px: function (i) { var f = api.khung(); return f.x0 + api.x[i] * f.canh; },
      py: function (i) { var f = api.khung(); return f.y0 + api.y[i] * f.canh; },

      nutTai: function (mx, my, banKinh) {
        var f = api.khung(), r = banKinh || 12;
        var tot = -1, xaNhat = r * r;
        for (var i = 0; i < api.n; i++) {
          var ex = f.x0 + api.x[i] * f.canh - mx;
          var ey = f.y0 + api.y[i] * f.canh - my;
          var d2 = ex * ex + ey * ey;
          if (d2 <= xaNhat) { xaNhat = d2; tot = i; }
        }
        return tot;
      },

      /* ---------- ve ---------- */

      /** Ve toan bo canh. `mauCua(k, a, b)` co the tra null de bo qua canh do. */
      veCanh: function (mauCua, day, mo) {
        var f = api.khung(), g = cv.g;
        g.save();
        g.globalAlpha = mo === undefined ? 1 : mo;
        g.lineWidth = day || 1;
        var dungMot = typeof mauCua === "string";
        if (dungMot) g.strokeStyle = mauCua;
        for (var k = 0; k < api.canh.length; k++) {
          var a = api.canh[k][0], b = api.canh[k][1];
          if (!dungMot) {
            var m = mauCua(k, a, b);
            if (!m) continue;
            g.strokeStyle = m;
          }
          g.beginPath();
          g.moveTo(f.x0 + api.x[a] * f.canh, f.y0 + api.y[a] * f.canh);
          g.lineTo(f.x0 + api.x[b] * f.canh, f.y0 + api.y[b] * f.canh);
          g.stroke();
        }
        g.restore();
      },

      /** Ve toan bo nut. `mauCua(i)` tra mau, `banKinhCua` tra so hoac la so. */
      veNut: function (mauCua, banKinhCua, vienMau) {
        var f = api.khung(), g = cv.g;
        var dungMotMau = typeof mauCua === "string";
        var dungMotBan = typeof banKinhCua === "number";
        g.save();
        for (var i = 0; i < api.n; i++) {
          var m = dungMotMau ? mauCua : mauCua(i);
          if (!m) continue;
          var r = dungMotBan ? banKinhCua : banKinhCua(i);
          g.fillStyle = m;
          g.beginPath();
          g.arc(f.x0 + api.x[i] * f.canh, f.y0 + api.y[i] * f.canh, r, 0, 6.2832);
          g.fill();
          if (vienMau) {
            g.strokeStyle = vienMau; g.lineWidth = 1.4;
            g.stroke();
          }
        }
        g.restore();
      }
    };
    return api;
  }

  /* Dong ho don dieu, dung cho cac ngan sach thoi gian cua bo phat. */
  function dongHo() {
    return (typeof performance !== "undefined" && performance.now)
      ? performance.now() : Date.now();
  }

  /* ---------- 4h. Nhieu khung so sanh --------------------------------- *
     Cho lab dat vai thu CANH NHAU de so: bon thuat toan toi uu tren cung
     mot dia hinh, bon phep giam chieu tren cung mot bo du lieu.

     Khong tao nhieu the canvas — chia MOT canvas thanh nhieu o. Nho vay
     nut luu PNG va ghi video van bat duoc ca bang so sanh, va bo phat van
     la mot.

       var K = V.khungNhieu(cv, { so: 4, cot: 2, leDuoi: 200 });
       K[0].nen(); K[0].nhan("SGD");
       var B = V.bieuDo(cv, { le: K[0].le, x: {...}, y: {...} });
       var L = V.luoiO(cv, K[0].leLuoi);

     Moi khung tra ve san `le` (cho bieuDo) va `leLuoi` (cho luoiO) — hai
     nguyen ham do von da nhan le tuyet doi so voi canvas, nen khong phai
     sua gi them.
   * -------------------------------------------------------------------- */
  function khungNhieu(cv, o) {
    o = o || {};
    var so = Math.max(1, o.so || 2);
    var cot = Math.max(1, o.cot || Math.ceil(Math.sqrt(so)));
    var hang = Math.ceil(so / cot);
    var le = o.le === undefined ? 10 : o.le;
    var lt = o.leTren === undefined ? le : o.leTren;
    var ld = o.leDuoi === undefined ? le : o.leDuoi;
    var khoang = o.khoang === undefined ? 10 : o.khoang;
    var caoNhan = o.caoNhan === undefined ? 20 : o.caoNhan;

    var W = Math.max(1, cv.W - le * 2);
    var H = Math.max(1, cv.H - lt - ld);
    var oRong = (W - khoang * (cot - 1)) / cot;
    var oCao = (H - khoang * (hang - 1)) / hang;

    var ds = [];
    for (var i = 0; i < so; i++) {
      var c = i % cot, r = (i / cot) | 0;
      var x0 = le + c * (oRong + khoang);
      var y0 = lt + r * (oCao + khoang);
      ds.push(taoKhung(i, x0, y0, oRong, oCao));
    }
    return ds;

    function taoKhung(i, x0, y0, rong, cao) {
      var k = {
        i: i, x0: x0, y0: y0, rong: rong, cao: cao,
        /* le cho V.bieuDo — tinh tu mep canvas vao. */
        le: {
          t: y0 + caoNhan,
          l: x0 + (o.leTraiBieuDo === undefined ? 46 : o.leTraiBieuDo),
          r: cv.W - (x0 + rong),
          b: cv.H - (y0 + cao)
        },
        /* le cho V.luoiO. */
        leLuoi: {
          leTren: y0 + caoNhan, leTrai: x0,
          lePhai: cv.W - (x0 + rong), leDuoi: cv.H - (y0 + cao)
        },

        nen: function (mau2) {
          var g = cv.g;
          g.save();
          g.fillStyle = mau2 || mau("surf2");
          g.fillRect(x0, y0, rong, cao);
          g.restore();
        },

        vien: function (mau2) {
          var g = cv.g;
          g.save();
          g.strokeStyle = mau2 || mau("bd");
          g.lineWidth = 1;
          g.strokeRect(x0 + 0.5, y0 + 0.5, rong - 1, cao - 1);
          g.restore();
        },

        /** Ten khung, in o goc tren trai. */
        nhan: function (chu, mau2) {
          var g = cv.g;
          g.save();
          g.fillStyle = mau2 || mau("tx2");
          g.font = "600 12px system-ui,sans-serif";
          g.textAlign = "left"; g.textBaseline = "top";
          g.fillText(chu, x0 + 6, y0 + 4);
          g.restore();
        },

        /** Mot dong chu phu o goc tren phai — thuong la con so then chot. */
        soPhu: function (chu, mau2) {
          var g = cv.g;
          g.save();
          g.fillStyle = mau2 || mau("ac");
          g.font = "600 12px ui-monospace,monospace";
          g.textAlign = "right"; g.textBaseline = "top";
          g.fillText(chu, x0 + rong - 6, y0 + 4);
          g.restore();
        },

        /** Vung ve that su, da tru dong nhan. */
        trong: function () {
          return { x: x0, y: y0 + caoNhan, rong: rong, cao: cao - caoNhan };
        },

        /** Chuot co dang o trong khung nay khong. */
        chua: function (mx, my) {
          return mx >= x0 && my >= y0 && mx < x0 + rong && my < y0 + cao;
        }
      };
      return k;
    }
  }

  /* ---------- 5. So ngau nhien tai lap duoc --------------------------- */
  /* LCG don gian: cung hat giong -> cung day so, tren moi trinh duyet. */
  function rng(hat) {
    var s = (hat || 42) >>> 0;
    function u() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    u.chuan = function () {          /* Box-Muller */
      var a = Math.max(u(), 1e-12), b = u();
      return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
    };
    u.khoang = function (lo, hi) { return lo + u() * (hi - lo); };
    return u;
  }

  /* ---------- 6. Vong lap hoat hinh ----------------------------------- */
  /* Moi thu dang chay duoc ghi vao day de router dung het khi doi trang. */
  var DANG_CHAY = [];
  function ghiDanh(o) { if (DANG_CHAY.indexOf(o) < 0) DANG_CHAY.push(o); return o; }
  function dungHet() {
    DANG_CHAY.forEach(function (o) { try { o.dung(); } catch (e) {} });
    DANG_CHAY.length = 0;
    PHAT_HIEN_TAI = null;
  }

  function vongLap(buoc) {
    var id = null, dangChay = false;
    function tick() { buoc(); if (dangChay) id = requestAnimationFrame(tick); }
    var api = {
      chay: function () {
        if (!dangChay) { dangChay = true; ghiDanh(api); id = requestAnimationFrame(tick); }
      },
      dung: function () { dangChay = false; if (id) cancelAnimationFrame(id); },
      dangChay: function () { return dangChay; }
    };
    return api;
  }

  /* ---------- 7. Xuat anh / ghi video --------------------------------- */

  function taiVe(blob, ten) {
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: ten });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function tenAnToan(s) {
    return String(s || "lab").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lab";
  }

  /* PNG. Ghep len nen dac truoc khi xuat — neu khong, vung chua ve
     se trong suot va anh trong den si khi dan vao slide. */
  function xuatAnh(cv, ten) {
    var tmp = el("canvas");
    tmp.width = cv.width; tmp.height = cv.height;
    var g = tmp.getContext("2d");
    g.fillStyle = mau("surf") || "#fff";
    g.fillRect(0, 0, tmp.width, tmp.height);
    g.drawImage(cv, 0, 0);
    tmp.toBlob(function (b) { if (b) taiVe(b, tenAnToan(ten) + ".png"); }, "image/png");
  }

  function coGhiVideo(cv) {
    return !!(cv && cv.captureStream && window.MediaRecorder);
  }

  function kieuVideo() {
    var ds = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (var i = 0; i < ds.length; i++) {
      if (window.MediaRecorder.isTypeSupported &&
          window.MediaRecorder.isTypeSupported(ds[i])) return ds[i];
    }
    return "";
  }

  /* Ghi canvas thanh WebM. Tra ve { dung() }. */
  function ghiVideo(cv, ten, khiXong) {
    var st = cv.captureStream(ch("fpsGhi", 30));
    var mr = new MediaRecorder(st, {
      mimeType: kieuVideo(), videoBitsPerSecond: ch("bitrateGhi", 8000000)
    });
    var manh = [];
    mr.ondataavailable = function (e) { if (e.data && e.data.size) manh.push(e.data); };
    mr.onstop = function () {
      taiVe(new Blob(manh, { type: "video/webm" }), tenAnToan(ten) + ".webm");
      if (khiXong) khiXong();
    };
    mr.start(200);
    return { dung: function () { if (mr.state !== "inactive") mr.stop(); } };
  }

  /* ---------- 8. Bo phat: xem thuat toan chay nhu xem video ----------- *
     phat({
       datLai : function () {...},          dat trang thai ve ban dau
       buoc   : function (k) {... return false khi het},   MOT buoc thuat toan
       ve     : function (k, xong) {...},   ve lai khung hinh
       toiDa  : 20000,        so buoc toi da (de co thanh tien do + tua)
       tocDo  : 8,            buoc/giay luc dau
       nhan   : function (k, xong) { return "..." },   dong chu trang thai
       tuTin  : true,         tu chay ngay khi dat lai (mac dinh false)
       lap    : true,         chay xong thi tu dat lai va chay tiep
       bang   : cv,           canvas — bat nut xuat PNG / ghi video

       -- tua nhanh bang moc (tuy chon, cho sim nang) --
       anh     : function () { return <ban sao SAU cua trang thai> },
       phucHoi : function (s) { ... },
       chuKy   : 500          cach bao nhieu buoc thi luu mot moc

       Khong khai bao anh/phucHoi thi tua van chay, nhung phai dien lai
       tu buoc 0 — sim nang se giat.
     })
   * -------------------------------------------------------------------- */
  function phat(o) {
    var toiDa  = o.toiDa || 0;
    var tocDo  = o.tocDo || 8;
    var lap    = !!o.lap;
    var k = 0, xong = false, dangChay = false, du = 0, tTruoc = 0, id = null;
    var moc = [], chuKy = o.chuKy || Math.max(50, Math.round((toiDa || 5000) / 40));
    var dangGhi = null;

    var nutPL   = nut("▶ Chạy", function () { dangChay ? dung() : chay(); }, "chinh");
    var thanhIn = el("div", { class: "phat-tt-i" });
    var thanh   = el("div", { class: "phat-tt" }, [thanhIn]);
    var dongNhan = el("div", { class: "phat-nhan" });
    var tuaIn = null, oTua = null, nutGhi = null, slToc = null, mucToc = null;

    function capNhat() {
      nutPL.textContent = dangChay ? "⏸ Tạm dừng" : (xong ? "▶ Chạy lại" : "▶ Chạy");
      nutPL.classList.toggle("dang", dangChay);
      var t = toiDa ? Math.min(1, k / toiDa) : 0;
      thanhIn.style.width = (t * 100).toFixed(2) + "%";
      thanh.classList.toggle("het", xong);
      if (tuaIn && document.activeElement !== tuaIn) tuaIn.value = Math.min(k, toiDa);
      var s1 = toiDa ? ("bước " + k.toLocaleString("vi") + " / " + toiDa.toLocaleString("vi"))
                     : ("bước " + k.toLocaleString("vi"));
      /* nhan() doc trang thai cua lab — co the chua san sang o lan goi dau,
         hoac ngay sau khi doi tham so. Nhan la trang tri, khong duoc lam hong lab. */
      var s2 = "";
      if (o.nhan) { try { s2 = o.nhan(k, xong) || ""; } catch (e) { s2 = ""; } }
      dongNhan.innerHTML = "<b>" + s1 + "</b>" + (s2 ? " · " + s2 : "") +
                           (xong ? ' <i class="phat-het">đã xong</i>' : "");
    }

    function veLai() {
      if (o.ve) { try { o.ve(k, xong); } catch (e) { if (window.console) console.error(e); } }
      capNhat();
    }

    function datLai() {
      dung(); k = 0; xong = false; du = 0; moc.length = 0;
      if (o.datLai) o.datLai();
      luuMoc();
      veLai();
      if (o.tuTin) chay();
    }

    function luuMoc() {
      if (!o.anh) return;
      try { moc.push({ k: k, s: o.anh() }); } catch (e) {}
    }

    function motBuoc() {
      if (xong) return false;
      var r = o.buoc(k);
      k++;
      if (o.anh && k % chuKy === 0) luuMoc();
      if (r === false || (toiDa && k >= toiDa)) xong = true;
      return !xong;
    }

    function khung(t) {
      if (!dangChay) return;
      if (!tTruoc) tTruoc = t;
      var dt = Math.min(0.2, (t - tTruoc) / 1000); tTruoc = t;
      du += dt * tocDo;
      var n = Math.min(Math.floor(du), 400000);
      du -= n;

      /* NGAN SACH MOI KHUNG HINH. `tocDo` la so buoc moi giay do nguoi dung
         dat, nhung engine khong biet MOT buoc dat bao nhieu — mot buoc co the
         la ba phep tinh, cung co the la mot hang Mandelbrot 500 vong lap.
         Khong xem dong ho thi mot khung hinh keo dai bao lau cung duoc, va
         trang dung hinh. Lam duoc bao nhieu trong han thi lam, phan con lai
         bo han (khong don sang khung sau, vi don thi khung sau con te hon). */
      var han = o.hanKhung === undefined ? 12 : o.hanKhung;
      var batDauKhung = dongHo();
      for (var i = 0; i < n; i++) {
        if (!motBuoc()) break;
        if ((i & 15) === 0 && dongHo() - batDauKhung > han) { du = 0; break; }
      }
      veLai();
      if (xong) {
        if (lap) { k = 0; xong = false; du = 0; moc.length = 0;
                   if (o.datLai) o.datLai(); luuMoc();
                   id = requestAnimationFrame(khung); return; }
        dung();
      } else id = requestAnimationFrame(khung);
    }

    function chay() {
      if (dangChay) return;
      if (xong) { datLai(); }
      dangChay = true; tTruoc = 0; du = 0;
      ghiDanh(api);
      id = requestAnimationFrame(khung);
      capNhat();
    }
    function dung() {
      dangChay = false; if (id) cancelAnimationFrame(id); id = null;
      capNhat();
    }

    /* Tua toi buoc muc tieu. Co moc thi nhay toi moc gan nhat truoc muc
       tieu roi dien not — khong co thi dien lai tu dau. */
    function toi(muc) {
      dung();
      var tran = Math.min(muc, toiDa || muc);
      var batDau = 0;
      var dungMoc = null;
      if (o.phucHoi) {
        for (var i = moc.length - 1; i >= 0; i--) {
          if (moc[i].k <= tran) { dungMoc = moc[i]; break; }
        }
      }
      if (dungMoc) {
        try { o.phucHoi(dungMoc.s); batDau = dungMoc.k; } catch (e) { dungMoc = null; }
      }
      if (!dungMoc) { if (o.datLai) o.datLai(); batDau = 0; moc.length = 0; luuMoc(); }
      k = batDau; xong = false; du = 0;

      /* NGAN SACH THOI GIAN. Tua la dien lai tung buoc, nen chi phi cua no
         la (so buoc) x (chi phi mot buoc) — ma chi phi mot buoc lai phu
         thuoc tham so nguoi dung dat. Mot lab bay dan 3000 con hay mot
         luoi 300x300 co the ngon hang tram giay, dong bang ca tab.
         Nen tua chay toi khi HET NGAN SACH thi dung lai o day; thanh tua
         se nhay ve dung cho da toi. Tha di duoc it con hon la treo may. */
      var han = o.hanTua === undefined ? 3000 : o.hanTua;
      var batDauLuc = dongHo();
      for (var j = batDau; j < tran; j++) {
        if (!motBuoc()) break;
        /* Xem gio moi 64 buoc — goi dong ho moi buoc cung la mot chi phi. */
        if ((j & 63) === 0 && dongHo() - batDauLuc > han) break;
      }
      veLai();
    }

    /* --- thanh dieu khien --- */
    function dk() {
      var nutB = nut("⏭ Một bước", function () { dung(); motBuoc(); veLai(); });
      var nutR = nut("↺ Đặt lại", function () { datLai(); });
      var hangNut = el("div", { class: "phat-nut" }, [nutPL, nutB, nutR]);

      if (o.bang && bat("xuat")) {
        hangNut.appendChild(nut("🖼 Ảnh PNG", function () {
          xuatAnh(o.bang, o.ten || document.title);
        }));
        if (coGhiVideo(o.bang)) {
          nutGhi = nut("⏺ Ghi video", function () {
            if (dangGhi) {
              dangGhi.dung(); dangGhi = null;
              nutGhi.textContent = "⏺ Ghi video";
              nutGhi.classList.remove("ghi");
            } else {
              dangGhi = ghiVideo(o.bang, o.ten || document.title, function () {
                dangGhi = null;
                nutGhi.textContent = "⏺ Ghi video";
                nutGhi.classList.remove("ghi");
              });
              nutGhi.textContent = "⏹ Dừng ghi";
              nutGhi.classList.add("ghi");
              if (!dangChay) { datLai(); chay(); }
            }
          });
          nutGhi.title = "Ghi khung hình canvas thành tệp .webm";
          hangNut.appendChild(nutGhi);
        }
      }

      mucToc = el("b", { class: "gt", text: dinhDangToc(tocDo) });
      slToc = el("input", {
        type: "range", min: 0, max: 125, step: 1,
        value: Math.round(Math.log(tocDo) / Math.LN10 * 25)
      });
      slToc.addEventListener("input", function () {
        tocDo = Math.max(1, Math.round(Math.pow(10, parseFloat(slToc.value) / 25)));
        mucToc.textContent = dinhDangToc(tocDo);
      });
      var oToc = el("label", { class: "dk" }, [
        el("span", { class: "dk-t" }, ["Tốc độ", mucToc]), slToc
      ]);

      var con = [hangNut, thanh, dongNhan, oToc];

      /* Thanh tua phai duoc dung NGAY, ke ca khi chua biet toiDa: phan lon
         lab chi goi datToiDa() trong apDung(), tuc sau khi dk() da chay.
         Dung theo dieu kien `if (toiDa)` o day thi nhung lab do vinh vien
         khong co thanh tua. Dung san roi an di, datToiDa() se mo ra. */
      if (o.tua !== false) {
        tuaIn = el("input", { type: "range", min: 0, max: toiDa || 1, step: 1, value: 0 });
        tuaIn.addEventListener("input", function () { toi(parseInt(tuaIn.value, 10)); });
        oTua = el("label", { class: "dk" }, [
          el("span", { class: "dk-t" }, ["Tua tới bước"]), tuaIn
        ]);
        oTua.style.display = toiDa ? "" : "none";
        con.splice(3, 0, oTua);
      }

      if (bat("phimTat")) {
        con.push(el("div", { class: "phim-tat", html:
          "<b>Space</b> chạy/dừng · <b>→</b> một bước · <b>R</b> đặt lại · <b>F</b> toàn màn hình" }));
      }
      return el("div", { class: "phat" }, con);
    }

    var api = {
      dk: dk, datLai: datLai, chay: chay, dung: dung, veLai: veLai,
      buoc: function () { dung(); motBuoc(); veLai(); },
      toi: toi,
      chiSo: function () { return k; },
      daXong: function () { return xong; },
      dangChay: function () { return dangChay; },
      datToiDa: function (v) {
        toiDa = v;
        if (tuaIn) tuaIn.setAttribute("max", v);
        if (oTua) oTua.style.display = v ? "" : "none";
        capNhat();
      },
      /* Dat toc do VA keo thanh truot theo, de con so tren man hinh khong
         noi mot dang con bo phat chay mot dang khac. Goi duoc truoc khi
         dk() dung giao dien — luc do chi co trang thai duoc dat. */
      datTocDo: function (v) {
        tocDo = Math.max(1, v);
        if (slToc) slToc.value = Math.round(Math.log(tocDo) / Math.LN10 * 25);
        if (mucToc) mucToc.textContent = dinhDangToc(tocDo);
      },
      datLap: function (v) { lap = !!v; }
    };
    PHAT_HIEN_TAI = api;
    return api;
  }

  function dinhDangToc(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M bước/giây";
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k bước/giây";
    return v + " bước/giây";
  }

  /* ---------- 9. Bang so lieu ----------------------------------------- */
  /* var S = V.soLieu(); ... S.dat({ "Số bước": 111, "Đỉnh": 9232 }); */
  function soLieu() {
    var hop = el("div", { class: "so-lieu" });
    return {
      el: hop,
      dat: function (bo) {
        hop.innerHTML = "";
        Object.keys(bo).forEach(function (k) {
          hop.appendChild(el("div", { class: "d" }, [
            el("span", { text: k }),
            el("b", { text: String(bo[k]) })
          ]));
        });
      }
    };
  }

  /* ---------- 10. Bo cuc mot lab -------------------------------------- */
  /* V.khung(host, {
       ve: [cv],  dieuKhien: [...],  giaiThich: "...",
       bang: cv,          -> bat nut xuat anh tren thanh cong cu
       veLai: fn          -> goi lai sau khi doi khung/toan man hinh
     }) */
  function khungLab(host, o) {
    var trai = el("div", { class: "ve" }, o.ve || []);
    var phai = el("div", { class: "dks" }, o.dieuKhien || []);
    var than = el("div", { class: "demo-body" }, [trai, phai]);

    var cong = [];
    if (bat("toanManHinh")) {
      cong.push(el("button", {
        class: "cg", title: "Toàn màn hình (F)", onclick: function () { toanManHinh(than); }
      }, [ico('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'), el("span", { text: "Toàn màn hình" })]));
    }
    if (bat("tapTrung")) {
      cong.push(el("button", {
        class: "cg", title: "Ẩn mục lục, mở rộng khung vẽ",
        onclick: function () { document.body.classList.toggle("tap-trung"); }
      }, [ico('<path d="M3 12h18M12 3v18"/>'), el("span", { text: "Tập trung" })]));
    }
    if (bat("permalink")) {
      cong.push(el("button", {
        class: "cg", title: "Chép liên kết giữ nguyên mọi tham số hiện tại",
        onclick: function (e) { chepLienKet(e.currentTarget); }
      }, [ico('<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>'),
           el("span", { text: "Chép liên kết" })]));
    }
    if (o.bang && bat("xuat")) {
      cong.push(el("button", {
        class: "cg", title: "Lưu khung hình hiện tại thành PNG",
        onclick: function () { xuatAnh(o.bang, o.ten || document.title); }
      }, [ico('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-4 4-2-2-4 4"/>'),
           el("span", { text: "Lưu ảnh" })]));
    }

    if (cong.length) host.appendChild(el("div", { class: "cong-cu" }, cong));
    host.appendChild(than);
    if (o.giaiThich) host.appendChild(el("div", { class: "gt-box", html: o.giaiThich }));
    return { trai: trai, phai: phai, than: than };
  }

  function toanManHinh(e) {
    var d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else {
      var f = e.requestFullscreen || e.webkitRequestFullscreen;
      if (f) f.call(e);
    }
  }

  function chepLienKet(nutEl) {
    var url = location.href;
    function xong() {
      if (!nutEl) return;
      var sp = nutEl.querySelector("span");
      if (!sp) return;
      var cu = sp.textContent;
      sp.textContent = "Đã chép!";
      setTimeout(function () { sp.textContent = cu; }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(xong, function () { batLui(url, xong); });
    } else batLui(url, xong);
  }
  function batLui(url, xong) {
    var t = el("textarea", { class: "an-di" });
    t.value = url;
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); xong(); } catch (e) { window.prompt("Chép liên kết:", url); }
    document.body.removeChild(t);
  }

  /* ---------- 11. Dang ky lab ----------------------------------------- */
  var DEMOS = [];
  window.demo = function (spec) { DEMOS.push(spec); };
  window.lab = window.demo;          /* ten goi moi, cung mot thu */

  window.VIS = {
    el: el, $: $, ico: ico,
    truot: truot, nut: nut, chon: chon, danhDau: danhDau,
    hatGiong: hatGiong, nhapSo: nhapSo,
    thamSo: thamSo,
    veBang: veBang, veBangCo: veBangCo, veLuoi: veLuoi, mau: mau, thangMau: thangMau,
    bangTichLuy: bangTichLuy, bieuDo: bieuDo, soGon: soGon,
    luoiO: luoiO, mauSo: mauSo, hat: hat, doThi: doThi, khungNhieu: khungNhieu,
    rng: rng, vongLap: vongLap, phat: phat, dungHet: dungHet,
    soLieu: soLieu, xuatAnh: xuatAnh, taiVe: taiVe,
    khung: khungLab,
    /* trang thai tuyen hien tai — lab doc duoc neu can */
    thamSoURL: function () { return THAM_SO_URL; }
  };

  /* ---------- 12. Tuyen + tham so tren URL ---------------------------- *
     Dinh dang:  #/ma-lab?thamso1=gt&thamso2=gt
     Doi tham so chi ghi lai phan query bang replaceState — KHONG kich
     hoat hashchange, nen lab khong bi dung lai giua chung.
   * -------------------------------------------------------------------- */
  var THAM_SO_URL = {};
  var TUYEN_HIEN_TAI = "";
  var PHAT_HIEN_TAI = null;
  var BO_QUA_HASH = false;

  function phanTichHash() {
    var h = location.hash.replace(/^#\/?/, "");
    var i = h.indexOf("?");
    var q = "";
    if (i >= 0) { q = h.slice(i + 1); h = h.slice(0, i); }
    var bo = {};
    q.split("&").forEach(function (p) {
      if (!p) return;
      var j = p.indexOf("=");
      var k = j < 0 ? p : p.slice(0, j);
      var v = j < 0 ? "" : p.slice(j + 1);
      try { bo[decodeURIComponent(k)] = decodeURIComponent(v); }
      catch (e) { bo[k] = v; }
    });
    return { id: h, bo: bo };
  }

  function datQueryURL(q) {
    var moi = "#/" + TUYEN_HIEN_TAI + (q ? "?" + q : "");
    if (moi === location.hash) return;
    try {
      history.replaceState(null, "", moi);
    } catch (e) {
      /* file:// o mot so trinh duyet chan replaceState — lui ve gan hash
         va tu bo qua lan hashchange do chinh minh gay ra. */
      BO_QUA_HASH = true;
      location.hash = moi;
      setTimeout(function () { BO_QUA_HASH = false; }, 0);
    }
  }

  /* ---------- 13. Khung trang ----------------------------------------- */
  /* Thu tu nhom tren trang chu va muc luc. Nhom KHONG khai bao o day van
     hien — xep sau, theo thu tu gap phai. Quen khai bao thi mat trat tu,
     khong mat lab. */
  function thuTuNhom() {
    var dat = ch("nhomThuTu", []);
    var conLai = DEMOS.map(function (d) { return d.nhom; })
      .filter(function (n, i, a) { return a.indexOf(n) === i && dat.indexOf(n) < 0; });
    return dat.filter(function (n) {
      return DEMOS.some(function (d) { return d.nhom === n; });
    }).concat(conLai);
  }

  function dungMucLuc() {
    var nav = $("#nav");
    nav.innerHTML = "";
    thuTuNhom().forEach(function (nhom) {
      var ds = DEMOS.filter(function (d) { return d.nhom === nhom; });
      if (!ds.length) return;
      nav.appendChild(el("div", { class: "nav-h", text: nhom }));
      ds.forEach(function (d) {
        nav.appendChild(el("a", {
          class: "nav-i", href: "#/" + d.id, "data-id": d.id
        }, [
          el("span", { class: "nav-n", text: d.mon || "" }),
          el("span", {}, [d.ten])
        ]));
      });
    });
  }

  function toSang(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".nav-i"), function (a) {
      a.classList.toggle("on", a.getAttribute("data-id") === id);
    });
  }

  function moDemo(id) {
    var d = DEMOS.filter(function (x) { return x.id === id; })[0];
    var main = $("#main");
    dungHet();                       /* dung moi hoat hinh cua trang truoc */
    main.innerHTML = "";
    if (!d) { trangChu(); return; }
    toSang(id);
    document.title = d.ten + " — " + ch("tieuDe", "Lab trực quan");
    main.appendChild(el("div", { class: "d-head" }, [
      el("div", { class: "d-nhom", text: d.nhom }),
      el("h1", { text: d.ten }),
      el("p", { class: "d-mo-ta", html: d.moTa || "" }),
      d.lienKet ? el("p", { class: "d-lk", html: "📖 Đọc thêm: " + d.lienKet }) : null
    ]));
    var host = el("div", { class: "d-body" });
    main.appendChild(host);
    try {
      d.dung(host);
    } catch (e) {
      host.appendChild(el("div", { class: "loi", text: "Lab lỗi: " + e.message }));
      if (window.console) console.error(e);
    }
    window.scrollTo(0, 0);
  }

  function trangChu() {
    dungHet();
    toSang(null);
    document.title = ch("tieuDe", "Lab trực quan");
    var main = $("#main");
    main.innerHTML = "";
    main.appendChild(el("div", { class: "hero" }, [
      el("h1", { html: ch("heroTieuDe", "Lab <u>trực quan</u>") }),
      el("p", { html: ch("heroMoTa", "") }),
      el("p", { class: "hero-note", html: ch("heroGhiChu",
        "💡 <b>Cách dùng đúng:</b> trước khi kéo một thanh trượt, hãy <b>dự đoán</b> điều sẽ xảy ra. " +
        "Mỗi lần dự đoán sai là một lần mô hình tư duy của bạn được sửa.") })
    ]));
    thuTuNhom().forEach(function (nhom) {
      var ds = DEMOS.filter(function (d) { return d.nhom === nhom; });
      if (!ds.length) return;
      main.appendChild(el("h2", { class: "sec-h", text: nhom }));
      main.appendChild(el("div", { class: "luoi" }, ds.map(function (d) {
        return el("a", { class: "the", href: "#/" + d.id }, [
          el("div", { class: "the-n", text: d.mon || "•" }),
          el("h3", { text: d.ten }),
          el("p", { html: d.moTa || "" })
        ]);
      })));
    });
    main.appendChild(el("div", { class: "chan", html:
      ch("chanTrang", DEMOS.length + " lab · không dùng thư viện ngoài") }));
  }

  function dinhTuyen() {
    if (BO_QUA_HASH) return;
    var t = phanTichHash();
    THAM_SO_URL = t.bo;
    TUYEN_HIEN_TAI = t.id;
    document.body.classList.remove("tap-trung");
    if (!t.id) trangChu(); else moDemo(t.id);
  }

  /* ---------- 14. Phim tat -------------------------------------------- */
  function dangGoVaoO(e) {
    var t = e.target;
    if (!t) return false;
    var n = (t.tagName || "").toLowerCase();
    return n === "input" || n === "textarea" || n === "select" || t.isContentEditable;
  }

  function ganPhimTat() {
    if (!bat("phimTat")) return;
    window.addEventListener("keydown", function (e) {
      if (dangGoVaoO(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      var P = PHAT_HIEN_TAI;
      var ph = (e.key || "").toLowerCase();
      if (ph === "f") {
        var b = $(".demo-body");
        if (b) { toanManHinh(b); e.preventDefault(); }
        return;
      }
      if (!P) return;
      if (e.code === "Space" || ph === " ") {
        P.dangChay() ? P.dung() : P.chay(); e.preventDefault();
      } else if (ph === "arrowright") {
        P.buoc(); e.preventDefault();
      } else if (ph === "r") {
        P.datLai(); e.preventDefault();
      }
    });
  }

  /* ---------- 15. Giao dien sang/toi ---------------------------------- */
  function datGiaoDien(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(KHOA_LUU, t); } catch (e) {}
    if (location.hash) dinhTuyen();  /* ve lai canvas theo mau moi */
  }

  window.addEventListener("hashchange", dinhTuyen);
  window.addEventListener("DOMContentLoaded", function () {
    try {
      var t = localStorage.getItem(KHOA_LUU);
      if (t) document.documentElement.setAttribute("data-theme", t);
    } catch (e) {}
    var bt = $("#btnTheme");
    if (bt) bt.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var toi = cur === "dark" ||
        (cur !== "light" && window.matchMedia &&
         window.matchMedia("(prefers-color-scheme: dark)").matches);
      datGiaoDien(toi ? "light" : "dark");
    });
    var bm = $("#btnMenu");
    if (bm) bm.addEventListener("click", function () {
      document.body.classList.toggle("mo-nav");
    });
    ganPhimTat();
    dungMucLuc();
    dinhTuyen();
  });
})();
