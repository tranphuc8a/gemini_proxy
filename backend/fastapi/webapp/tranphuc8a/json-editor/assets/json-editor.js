/* =====================================================================
   json-editor.js — soan, soi, truy van va so sanh JSON.

   Khong thu vien ngoai, chay duoc bang file://.

   Hai cho dang noi:

   1. JSON.parse chi bao "Unexpected token ... at position N" — mot con so
      vo dung voi nguoi doc. O day ta doi vi tri do thanh DONG va COT, va
      to do dung dong ay trong mang so dong. Do la phan lon gia tri cua
      mot trinh soan JSON.

   2. Phep so sanh khong so chuoi ma so CAY: no doc hai cay roi liet ke
      tung duong dan bi them / bot / doi. Doi thu tu khoa trong object
      khong bi tinh la khac, vi JSON khong quy dinh thu tu khoa.
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

  var duLieu = null;         /* ket qua parse gan nhat, null neu hong */
  var dongLoi = -1;

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

  function doc() {
    var s = nhap.value;
    if (!s.trim()) {
      duLieu = null; dongLoi = -1;
      den.className = "den";
      trangThai.textContent = "Chưa có nội dung";
      veSoDong();
      return false;
    }
    try {
      duLieu = JSON.parse(s);
      dongLoi = -1;
      den.className = "den ok";
      trangThai.textContent = "JSON hợp lệ · " + moTaNgan(duLieu);
      veSoDong();
      return true;
    } catch (e) {
      duLieu = null;
      var vt = viTriLoi(e, s);
      dongLoi = vt ? vt.dong : -1;
      den.className = "den loi";
      trangThai.textContent = vt
        ? ("Lỗi ở dòng " + vt.dong + ", cột " + vt.cot + " — " + gonLoi(e))
        : ("Lỗi — " + gonLoi(e));
      veSoDong();
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
  function veSoDong() {
    var n = nhap.value.split("\n").length;
    var ra = "";
    for (var i = 1; i <= n; i++) {
      ra += '<div' + (i === dongLoi ? ' class="loi"' : '') + '>' + i + '</div>';
    }
    soDong.innerHTML = ra;
    soDong.scrollTop = nhap.scrollTop;
  }

  function capNhatViTri() {
    var vt = dongCot(nhap.value, nhap.selectionStart);
    viTri.textContent = "dòng " + vt.dong + ", cột " + vt.cot;
  }

  /* ==================================================================
     2. Cac phep bien doi
     ================================================================== */
  function dinhDang(thut) {
    if (!doc()) return;
    nhap.value = JSON.stringify(duLieu, null, thut === undefined ? 2 : thut);
    sauKhiDoi();
  }

  function nen() {
    if (!doc()) return;
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
  }

  /* ==================================================================
     3. Cay
     ================================================================== */
  var cayEl = $("#cay");

  function nutLa(v) {
    var lop = v === null ? "gt-null"
            : typeof v === "string" ? "gt-chuoi"
            : typeof v === "number" ? "gt-so"
            : typeof v === "boolean" ? "gt-bool" : "gt-null";
    var chu = typeof v === "string" ? JSON.stringify(v) : String(v);
    if (chu.length > 200) chu = chu.slice(0, 200) + "…";
    return '<span class="' + lop + '">' + thoat(chu) + "</span>";
  }

  function thoat(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function veNut(khoa, v, sau) {
    var hienKieu = $("#cay-kieu").checked;
    var la = !(v && typeof v === "object");
    var n = document.createElement("div");
    n.className = "n" + (sau >= 2 && !la ? " dong-lai" : "");

    var dong = document.createElement("div");
    dong.className = "dong";
    var html = "";
    if (khoa !== null) {
      html += '<span class="khoa">' + thoat(khoa) + '</span><span class="dau-2cham">:</span>';
    }
    if (la) {
      html += nutLa(v);
      if (hienKieu) html += '<span class="kieu">' + kieuCua(v) + "</span>";
    } else {
      var mang = Array.isArray(v);
      var sl = mang ? v.length : Object.keys(v).length;
      html += '<span class="dau-2cham">' + (mang ? "[ ]" : "{ }") + "</span>";
      html += '<span class="dem">' + sl + (mang ? " phần tử" : " khoá") + "</span>";
    }
    dong.innerHTML = html;
    n.appendChild(dong);

    if (!la) {
      var nut = document.createElement("span");
      nut.className = "mo-dong";
      nut.textContent = n.classList.contains("dong-lai") ? "+" : "−";
      nut.onclick = function () {
        n.classList.toggle("dong-lai");
        nut.textContent = n.classList.contains("dong-lai") ? "+" : "−";
      };
      n.appendChild(nut);

      var con = document.createElement("div");
      con.className = "con";
      if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) con.appendChild(veNut(String(i), v[i], sau + 1));
      } else {
        Object.keys(v).forEach(function (k) { con.appendChild(veNut(k, v[k], sau + 1)); });
      }
      n.appendChild(con);
    }
    return n;
  }

  function veCay() {
    cayEl.innerHTML = "";
    var tom = $("#cay-tom");
    if (duLieu === null) {
      cayEl.innerHTML = '<p class="phu">Chưa có JSON hợp lệ để dựng cây.</p>';
      tom.textContent = "";
      return;
    }
    cayEl.appendChild(veNut(null, duLieu, 0));
    var d = dem(duLieu);
    tom.textContent = d.nut + " nút · sâu " + d.sau + " cấp";
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
     8. Noi day
     ================================================================== */
  var hen = null;
  nhap.addEventListener("input", function () {
    clearTimeout(hen);
    hen = setTimeout(function () { doc(); veCay(); luuNhap(); }, 180);
    veSoDong();
  });
  nhap.addEventListener("scroll", function () { soDong.scrollTop = nhap.scrollTop; });
  ["click", "keyup"].forEach(function (e) { nhap.addEventListener(e, capNhatViTri); });

  /* Tab trong textarea phai thut le, khong duoc nhay ra khoi o. */
  nhap.addEventListener("keydown", function (e) {
    if (e.key === "Tab") {
      e.preventDefault();
      var a = nhap.selectionStart, b = nhap.selectionEnd;
      nhap.value = nhap.value.slice(0, a) + "  " + nhap.value.slice(b);
      nhap.selectionStart = nhap.selectionEnd = a + 2;
    }
  });

  $("#nut-dinh-dang").onclick = function () { dinhDang(2); };
  $("#nut-nen").onclick = nen;
  $("#nut-sap-khoa").onclick = function () {
    if (!doc()) return;
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
      nhap.value = String(r.result);
      coTep.textContent = f.name + " · " + coChu(f.size);
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

  $("#cay-mo").onclick = function () {
    els(".n.dong-lai").forEach(function (n) {
      n.classList.remove("dong-lai");
      var b = n.querySelector(":scope > .mo-dong");
      if (b) b.textContent = "−";
    });
  };
  $("#cay-dong").onclick = function () {
    els(".cay .n").forEach(function (n) {
      if (!n.querySelector(":scope > .mo-dong")) return;
      n.classList.add("dong-lai");
      n.querySelector(":scope > .mo-dong").textContent = "+";
    });
  };
  $("#cay-kieu").onchange = veCay;

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
      if (b.dataset.o === "cay") veCay();
      if (b.dataset.o === "thongke") veThongKe();
    };
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault(); dinhDang(2);
    }
  });

  /* Phoi cac ham THUAN ra ngoai de kiem duoc bang node, khong can trinh
     duyet. Chung khong dung DOM, nen kiem duoc that su chu khong phai
     kiem mot ban chep lai. */
  window.JE_THU = {
    dongCot: dongCot, viTriLoi: viTriLoi, truyVan: truyVan,
    khacNhau: khacNhau, sapKhoa: sapKhoa, dem: dem, kieuCua: kieuCua,
    coChu: coChu
  };

  /* --- khoi dong --- */
  try {
    var s = localStorage.getItem("json-editor:sang");
    if (s) document.documentElement.setAttribute("data-sang", s);
  } catch (e) {}
  nhap.value = docNhap();
  doc();
  veCay();
  capNhatViTri();
})();
