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
          var hi = hY(Y.min) + (hY(Y.max) - hY(Y.min)) * (1 - t);
          g.fillText(dinhDang(Y.log ? Math.pow(10, hi) : hi), api.x0() - 8, yy);
        }
        g.strokeStyle = mau("bd"); g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(api.x0(), api.y0());
        g.lineTo(api.x0(), api.y1());
        g.lineTo(api.x1(), api.y1());
        g.stroke();
        if (X.nhan) {
          g.fillStyle = mau("tx3");
          g.textAlign = "center"; g.textBaseline = "top";
          g.fillText(X.nhan, (api.x0() + api.x1()) / 2, api.y1() + 10);
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
    var tuaIn = null, nutGhi = null, slToc = null, mucToc = null;

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
      for (var i = 0; i < n; i++) { if (!motBuoc()) break; }
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
      for (var j = batDau; j < tran; j++) { if (!motBuoc()) break; }
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

      if (toiDa && o.tua !== false) {
        tuaIn = el("input", { type: "range", min: 0, max: toiDa, step: 1, value: 0 });
        tuaIn.addEventListener("input", function () { toi(parseInt(tuaIn.value, 10)); });
        con.splice(3, 0, el("label", { class: "dk" }, [
          el("span", { class: "dk-t" }, ["Tua tới bước"]), tuaIn
        ]));
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
      datToiDa: function (v) { toiDa = v; if (tuaIn) tuaIn.max = v; capNhat(); },
      datTocDo: function (v) { tocDo = v; },
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
