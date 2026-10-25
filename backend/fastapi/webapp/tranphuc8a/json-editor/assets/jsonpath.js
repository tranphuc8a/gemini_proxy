/* =====================================================================
   jsonpath.js — JSONPath (tap con RFC 9535) + JSON Pointer, THUAN (khong DOM).

   Khuon module nhu je-chung.js; day vao JE_NGUON (Worker co the ghep lai).

     JE.jsonpath.phanTich(chuoi)  -> AST | nem Error {thongBao, cot (tu 0)}
     JE.jsonpath.chay(goc, chuoiHoacAst, tran, tuyChon) -> [ket qua…]
         moi ket qua: {v, duong:[…], chuan:"$['a'][0]", hien:"$.a[0]"}
         (duong / chuan / hien tinh LUOI khi doc — du lieu long 20 000 cap van re)
         mang tra ve co .catBot = true neu bi cat o `tran` (mac dinh 20 000)
         tuyChon.kieuCu  true: ten tren mang co the la chi so ("a.0"), chi so tren object la khoa ("o[0]")
                         — giu hanh vi cu cua tab Truy van. Mac dinh false (dung RFC).
     JE.jsonpath.duongChuan(duong) -> "$['a'][0]"

   Cu phap nhan duoc:
     $  @  .ten  .*  ..ten  ..*  ..[…]  ['ten']  ["t\"en"]  [0]  [-1]  [1:5:2]  [::-1]  [0,2]  ['a','b']  [*]
     [?<bieu thuc>]  voi  || && ! ( )  == != < <= > >=  =~ /regex/i
        toan hang: chuoi, so, true / false / null, @…, $…, ham length() count() match() search() value()
     Thieu "$" o dau van nhan: "a.b" => "$.a.b", ".a" => "$.a", "[0]" => "$[0]".
     JSON Pointer ("/a/0", "#/a/0") nhan duoc: tra ve 0 hoac 1 nut.
   Tuong thich ngu phap cu: ten sau dau cham co the chua "-" va "$"; [ten] khong nhay cung la ten.

   Moi bo phan tich la LAP tren chuoi (khong regex tren du lieu nguoi dung); duyet du lieu bang ngan xep tu
   quan ly (khong de quy), co NGAN SACH buoc de bieu thuc long nhau khong treo. Regex trong match() / search()
   / =~ phai qua JE.chung.kiemRegexAnToan.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});
  var hasOwn = Object.prototype.hasOwnProperty;

  var TRAN_MAC_DINH = 20000;
  var NGAN_SACH = 2500000;               /* so buoc duyet nut toi da cho mot lan chay */
  var SAU_BIEU_THUC = 100;               /* do long toi da cua bieu thuc loc */
  var CHI_SO_TOI_DA = 9007199254740991;

  var NOTHING = { nothing: true };

  function Loi(tb, cot) {
    var e = new Error(tb + (cot !== undefined && cot !== null ? " (cột " + (cot + 1) + ")" : ""));
    e.name = "LoiJsonPath";
    e.thongBao = tb;
    e.cot = cot === undefined ? null : cot;
    return e;
  }

  function laNhanh(v) { return v !== null && typeof v === "object"; }
  function coRieng(o, k) { return o !== null && o !== undefined && hasOwn.call(o, k); }

  /* ====================================================================
     1. Phan tich
     ==================================================================== */
  function laTrang(c) { return c === 32 || c === 9 || c === 10 || c === 13; }
  function laChuSo(c) { return c >= 48 && c <= 57; }
  function laChuCai(c) { return (c >= 97 && c <= 122) || (c >= 65 && c <= 90); }
  function laChuTen(c) { return laChuCai(c) || c === 95 || c >= 128; }
  function laChuTenTiep(c) { return laChuTen(c) || laChuSo(c); }

  function phanTich(chuoi) {
    var s = String(chuoi === undefined || chuoi === null ? "" : chuoi);
    var dau = 0, cuoi = s.length;
    while (dau < cuoi && laTrang(s.charCodeAt(dau))) dau++;
    while (cuoi > dau && laTrang(s.charCodeAt(cuoi - 1))) cuoi--;
    var bu = dau;                         /* cot that = chi so trong chuoi goc */
    s = s.slice(dau, cuoi);

    if (s === "") return { loai: "goc", doan: [] };
    var c0 = s.charAt(0);
    if (c0 === "/" || (c0 === "#" && (s.length === 1 || s.charAt(1) === "/"))) {
      var duongCT;
      try { duongCT = JE.chung.conTroSangDuong(s); }
      catch (e) { throw Loi(String(e.message), null); }
      return { loai: "con-tro", duong: duongCT };
    }
    var tienTo = 0;
    if (c0 === "$") tienTo = 0;
    else if (c0 === "." || c0 === "[") { s = "$" + s; tienTo = -1; }
    else if (laChuTen(s.charCodeAt(0)) || c0 === "*" || c0 === "'" || c0 === '"') { s = "$." + s; tienTo = -2; }
    else if (c0 === "@") throw Loi("“@” chỉ dùng được bên trong bộ lọc [?…]; bắt đầu bằng $", bu);
    else throw Loi("Đường dẫn phải bắt đầu bằng $ (hoặc / cho JSON Pointer), gặp “" + c0 + "”", bu);

    var p = 1, n = s.length;
    var cotThat = function (i) { return Math.max(0, i + bu + tienTo); };
    function loi(tb, i) { return Loi(tb, cotThat(i === undefined ? p : i)); }

    function boTrang() { while (p < n && laTrang(s.charCodeAt(p))) p++; }

    function docChuoi() {
      var q = s.charAt(p), bd = p, ra = "";
      p++;
      for (;;) {
        if (p >= n) throw loi("Chuỗi thiếu dấu " + q + " đóng", bd);
        var ch = s.charAt(p), cc = s.charCodeAt(p);
        if (ch === q) { p++; return ra; }
        if (cc < 32) throw loi("Ký tự điều khiển không hợp lệ trong chuỗi", p);
        if (ch === "\\") {
          var e = s.charAt(p + 1);
          if (e === "b") ra += "\b"; else if (e === "f") ra += "\f"; else if (e === "n") ra += "\n";
          else if (e === "r") ra += "\r"; else if (e === "t") ra += "\t"; else if (e === "/") ra += "/";
          else if (e === "\\") ra += "\\";
          else if (e === q) ra += q;
          else if (e === "u") {
            var hex = s.substr(p + 2, 4);
            if (hex.length < 4 || !soHex(hex)) throw loi("\\u cần đúng 4 chữ số hex", p);
            var u = parseInt(hex, 16);
            if (u >= 0xd800 && u <= 0xdbff) {
              if (s.charAt(p + 6) === "\\" && s.charAt(p + 7) === "u" && soHex(s.substr(p + 8, 4)) && s.substr(p + 8, 4).length === 4) {
                var u2 = parseInt(s.substr(p + 8, 4), 16);
                if (u2 >= 0xdc00 && u2 <= 0xdfff) { ra += String.fromCharCode(u, u2); p += 12; continue; }
              }
              throw loi("Cặp thay thế \\u không đầy đủ", p);
            }
            if (u >= 0xdc00 && u <= 0xdfff) throw loi("Cặp thay thế \\u không đầy đủ", p);
            ra += String.fromCharCode(u);
            p += 6;
            continue;
          } else throw loi("Dấu thoát “\\" + e + "” không hợp lệ", p);
          p += 2;
          continue;
        }
        ra += ch;
        p++;
      }
    }
    function soHex(h) {
      for (var i = 0; i < h.length; i++) {
        var c = h.charCodeAt(i);
        if (!(laChuSo(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70))) return false;
      }
      return true;
    }

    /** So nguyen RFC: -?(0|[1-9]\d*), khong "-0", trong +-(2^53-1). Tra ve so hoac null (khong phai so nguyen). */
    function docSoNguyen() {
      var bd = p, c = s.charCodeAt(p);
      if (c === 45) p++;
      var b0 = p;
      while (p < n && laChuSo(s.charCodeAt(p))) p++;
      if (p === b0) { p = bd; return null; }
      var chu = s.slice(bd, p);
      if (s.charAt(b0) === "0" && p - b0 > 1) throw loi("Số nguyên không được có số 0 đứng đầu", bd);
      if (chu === "-0") throw loi("“-0” không hợp lệ làm chỉ số", bd);
      var so = Number(chu);
      if (Math.abs(so) > CHI_SO_TOI_DA) throw loi("Chỉ số ngoài phạm vi ±(2^53−1)", bd);
      return so;
    }

    function docTen() {                    /* ten viet tat sau dau cham */
      var bd = p;
      while (p < n) {
        var c = s.charCodeAt(p);
        if (laChuTenTiep(c) || c === 45 || c === 36) p++; else break;
      }
      return s.slice(bd, p);
    }

    /* ---- cac doan ($.a[0]..) ---- */
    function docDoan(coThe, sauBieuThuc) {
      var ds = [];
      for (;;) {
        var luu = p;
        boTrang();
        var c = s.charAt(p);
        if (c === ".") {
          if (s.charAt(p + 1) === ".") {
            p += 2;
            var c2 = s.charAt(p);
            if (c2 === "[") { p++; ds.push({ loai: "hau-due", chon: docChon(sauBieuThuc) }); }
            else if (c2 === "*") { p++; ds.push({ loai: "hau-due", chon: [{ k: "sao" }] }); }
            else if (p < n && (laChuTenTiep(s.charCodeAt(p)) || s.charAt(p) === "$")) ds.push({ loai: "hau-due", chon: [{ k: "ten", ten: docTen() }] });
            else throw loi("Sau “..” cần tên, * hoặc [", p);
          } else {
            p++;
            if (s.charAt(p) === "*") { p++; ds.push({ loai: "con", chon: [{ k: "sao" }] }); }
            else if (p < n && (laChuTenTiep(s.charCodeAt(p)) || s.charAt(p) === "$")) ds.push({ loai: "con", chon: [{ k: "ten", ten: docTen() }] });
            else throw loi("Sau dấu “.” cần tên khoá hoặc *", p);
          }
        } else if (c === "[") {
          p++;
          ds.push({ loai: "con", chon: docChon(sauBieuThuc) });
        } else {
          p = luu;                          /* khong phai doan: tra khoang trang lai cho nguoi goi */
          return ds;
        }
      }
    }

    /** Doc cac selector trong [ ... ] (p da qua dau [). */
    function docChon(sau) {
      var ds = [];
      for (;;) {
        boTrang();
        var c = s.charAt(p), cc = s.charCodeAt(p);
        if (p >= n) throw loi("Thiếu dấu ]", p);
        if (c === "'" || c === '"') ds.push({ k: "ten", ten: docChuoi() });
        else if (c === "*") { p++; ds.push({ k: "sao" }); }
        else if (c === "?") { p++; ds.push({ k: "loc", bt: docLoc(sau) }); }
        else if (c === ":" || c === "-" || laChuSo(cc)) ds.push(docSoHoacCat());
        else if (laChuTen(cc) || c === "$") {                 /* [ten] khong nhay: cu phap cu */
          var bd = p;
          while (p < n && (laChuTenTiep(s.charCodeAt(p)) || s.charAt(p) === "$" || s.charAt(p) === "-")) p++;
          ds.push({ k: "ten", ten: s.slice(bd, p) });
        } else throw loi("Không hiểu “" + c + "” trong [ ]", p);
        boTrang();
        if (s.charAt(p) === ",") { p++; continue; }
        if (s.charAt(p) === "]") { p++; return ds; }
        if (p >= n) throw loi("Thiếu dấu ]", p);
        throw loi("Cần “,” hoặc “]”, gặp “" + s.charAt(p) + "”", p);
      }
    }

    function docSoHoacCat() {
      var a = null, b = null, st = null, bd = p;
      a = docSoNguyen();
      boTrang();
      if (s.charAt(p) !== ":") {
        if (a === null) throw loi("Chỉ số không hợp lệ", bd);
        return { k: "so", i: a };
      }
      p++;
      boTrang();
      b = docSoNguyen();
      boTrang();
      if (s.charAt(p) === ":") {
        p++;
        boTrang();
        st = docSoNguyen();
        boTrang();
      }
      return { k: "cat", bd: a, kt: b, buoc: st };
    }

    /* ---- bieu thuc loc ---- */
    var sauLoc = 0, trongArg = 0;
    function docLoc() {
      if (++sauLoc > SAU_BIEU_THUC) throw loi("Bộ lọc lồng quá sâu", p);
      var luuArg = trongArg;
      trongArg = 0;
      var e = docHoac();
      trongArg = luuArg;
      sauLoc--;
      return e;
    }
    function docHoac() {
      var a = docVa();
      for (;;) {
        boTrang();
        if (s.charAt(p) === "|" && s.charAt(p + 1) === "|") { p += 2; a = { t: "hoac", a: a, b: docVa() }; }
        else return a;
      }
    }
    function docVa() {
      var a = docKhong();
      for (;;) {
        boTrang();
        if (s.charAt(p) === "&" && s.charAt(p + 1) === "&") { p += 2; a = { t: "va", a: a, b: docKhong() }; }
        else return a;
      }
    }
    function docKhong() {
      boTrang();
      if (s.charAt(p) === "!" && s.charAt(p + 1) !== "=") {
        p++;
        if (++sauLoc > SAU_BIEU_THUC) throw loi("Bộ lọc lồng quá sâu", p);
        var x = docKhong();
        sauLoc--;
        if (x.t === "so-sanh" || x.t === "khop-re") {   /* !(a == b) can ngoac theo RFC; cho phep !a == b la loi ro rang */
          return { t: "khong", a: x };
        }
        return { t: "khong", a: x };
      }
      if (s.charAt(p) === "(") {
        var bdN = p;
        p++;
        if (++sauLoc > SAU_BIEU_THUC) throw loi("Bộ lọc lồng quá sâu", p);
        var e = docHoac();
        sauLoc--;
        boTrang();
        if (s.charAt(p) !== ")") throw loi("Thiếu dấu ) đóng ở cột " + cotThat(bdN), p);
        p++;
        return { t: "ngoac", a: e };
      }
      return docCoSoSanh();
    }

    function docToanHang() {
      boTrang();
      var c = s.charAt(p), cc = s.charCodeAt(p), bd = p;
      if (c === "'" || c === '"') return { t: "hang", v: docChuoi() };
      if (c === "-" || laChuSo(cc)) return { t: "hang", v: docSoThuc() };
      if (c === "@" || c === "$") {
        p++;
        var ds = docDoan(true, true);
        return { t: "truyvan", goc: c, doan: ds, don: laDon(ds), bd: bd };
      }
      if (laChuCai(cc)) {
        var ten = "";
        while (p < n && (laChuCai(s.charCodeAt(p)) || laChuSo(s.charCodeAt(p)) || s.charAt(p) === "_")) ten += s.charAt(p++);
        if (s.charAt(p) === "(") return docHam(ten, bd);
        if (ten === "true") return { t: "hang", v: true };
        if (ten === "false") return { t: "hang", v: false };
        if (ten === "null") return { t: "hang", v: null };
        throw loi("Không hiểu “" + ten + "” trong bộ lọc (chuỗi phải có nháy)", bd);
      }
      if (p >= n) throw loi("Bộ lọc chưa hoàn chỉnh", p);
      throw loi("Không hiểu “" + c + "” trong bộ lọc", p);
    }

    function docSoThuc() {
      var bd = p;
      if (s.charAt(p) === "-") p++;
      var b0 = p;
      while (p < n && laChuSo(s.charCodeAt(p))) p++;
      if (p === b0) throw loi("Số không hợp lệ", bd);
      if (s.charAt(b0) === "0" && p - b0 > 1) throw loi("Số không được có số 0 đứng đầu", bd);
      if (s.charAt(p) === "." && laChuSo(s.charCodeAt(p + 1))) { p++; while (p < n && laChuSo(s.charCodeAt(p))) p++; }
      if (s.charAt(p) === "e" || s.charAt(p) === "E") {
        var q = p + 1;
        if (s.charAt(q) === "+" || s.charAt(q) === "-") q++;
        if (laChuSo(s.charCodeAt(q))) { p = q; while (p < n && laChuSo(s.charCodeAt(p))) p++; }
        else throw loi("Phần mũ của số không hợp lệ", p);
      }
      var so = Number(s.slice(bd, p));
      return so === 0 ? 0 : so;            /* -0 == 0 */
    }

    function docHam(ten, bd) {
      var ch = HAM[ten];
      if (!ch) throw loi("Hàm “" + ten + "()” không tồn tại (có: length, count, match, search, value)", bd);
      p++;                                  /* ( */
      var tham = [];
      boTrang();
      if (s.charAt(p) === ")") p++;
      else {
        for (;;) {
          if (++sauLoc > SAU_BIEU_THUC) throw loi("Bộ lọc lồng quá sâu", p);
          trongArg++;
          var e = docHoac();
          trongArg--;
          sauLoc--;
          if (e.t === "thu") e = e.e;
          tham.push(e);
          boTrang();
          if (s.charAt(p) === ",") { p++; continue; }
          if (s.charAt(p) === ")") { p++; break; }
          throw loi("Cần “,” hoặc “)” trong lời gọi " + ten + "()", p);
        }
      }
      if (tham.length !== ch.args.length) throw loi("Hàm " + ten + "() cần " + ch.args.length + " tham số, có " + tham.length, bd);
      for (var i = 0; i < tham.length; i++) tham[i] = ep(tham[i], ch.args[i], ten, i, bd);
      if ((ten === "match" || ten === "search") && tham[1].t === "hang" && typeof tham[1].v === "string") {
        var lyDo = JE.chung.kiemRegexAnToan(tham[1].v);
        if (lyDo) throw loi(lyDo, bd);
        try { new RegExp(tham[1].v, "u"); } catch (e) { throw loi("Regex không hợp lệ: " + e.message, bd); }
      }
      return { t: "ham", ten: ten, args: tham, ra: ch.ra, bd: bd };
    }

    /** Dua mot nut bieu thuc ve kieu tham so (RFC 9535 §2.4.3 well-typedness). */
    function ep(nut, kieu, ten, i, bd) {
      var viTri = "tham số " + (i + 1) + " của " + ten + "()";
      if (nut.t === "thu") nut = nut.e;
      if (kieu === "gia-tri") {
        if (nut.t === "hang") return nut;
        if (nut.t === "truyvan") { if (!nut.don) throw loi(viTri + " cần truy vấn trả về MỘT giá trị (dùng $.a / @.a[0], không dùng * .. [?] [a,b])", bd); return nut; }
        if (nut.t === "ham" && nut.ra === "gia-tri") return nut;
        throw loi(viTri + " cần một giá trị", bd);
      }
      if (kieu === "nut") {
        if (nut.t === "truyvan") return nut;
        throw loi(viTri + " cần một truy vấn (@… hoặc $…)", bd);
      }
      return nut;
    }

    function docCoSoSanh() {
      var bd = p;
      var a = docToanHang();
      boTrang();
      var c = s.charAt(p), c2 = s.charAt(p + 1), op = null;
      if (c === "=" && c2 === "=") op = "==";
      else if (c === "!" && c2 === "=") op = "!=";
      else if (c === "<" && c2 === "=") op = "<=";
      else if (c === ">" && c2 === "=") op = ">=";
      else if (c === "<") op = "<";
      else if (c === ">") op = ">";
      else if (c === "=" && c2 === "~") op = "=~";
      if (op === null) {
        if (trongArg > 0) return a;            /* tham so ham: toan hang tran, kieu duoc ep sau */
        /* khong co toan tu: phai la phep thu (ton tai) hoac ham tra ve LogicalType */
        if (a.t === "truyvan") return { t: "thu", e: a };
        if (a.t === "ham") {
          if (a.ra !== "logic") throw loi("Hàm " + a.ten + "() trả về giá trị, cần so sánh nó (vd " + a.ten + "(@.a) > 1)", a.bd);
          return { t: "thu", e: a };
        }
        throw loi("Một giá trị đứng riêng không phải điều kiện — hãy so sánh nó", bd);
      }
      p += op.length;
      boTrang();
      if (op === "=~") {
        if (s.charAt(p) !== "/") throw loi("Sau =~ cần /biểu thức/", p);
        var re = docRegexLiteral();
        kiemToanHangSoSanh(a, bd);
        return { t: "khop-re", a: a, re: re.re, co: re.co };
      }
      var b = docToanHang();
      kiemToanHangSoSanh(a, bd);
      kiemToanHangSoSanh(b, p);
      return { t: "so-sanh", op: op, a: a, b: b };
    }

    function kiemToanHangSoSanh(x, i) {
      if (x.t === "truyvan" && !x.don) throw loi("So sánh chỉ nhận truy vấn trả về MỘT giá trị (không dùng * .. [?] [a,b] [i:j])", x.bd === undefined ? i : x.bd);
      if (x.t === "ham" && x.ra === "logic") throw loi("Không so sánh được kết quả của " + x.ten + "() (đúng/sai) — dùng riêng nó làm điều kiện", x.bd);
    }

    function docRegexLiteral() {
      var bd = p;
      p++;
      var ra = "";
      for (;;) {
        if (p >= n) throw loi("Thiếu dấu / đóng của regex", bd);
        var ch = s.charAt(p);
        if (ch === "\\") { ra += s.substr(p, 2); p += 2; continue; }
        if (ch === "/") { p++; break; }
        ra += ch; p++;
      }
      var co = "";
      while (p < n && (s.charAt(p) === "i")) { co = "i"; p++; }
      var lyDo = JE.chung.kiemRegexAnToan(ra);
      if (lyDo) throw loi(lyDo, bd);
      try { new RegExp(ra, "u" + co); }
      catch (e) { throw loi("Regex không hợp lệ: " + e.message, bd); }
      return { re: ra, co: co };
    }

    var ds = docDoan(false, 0);
    boTrang();
    if (p < n) throw loi("Không hiểu “" + s.charAt(p) + "” — mong “.”, “..” hoặc “[”", p);
    return { loai: "truy-van", doan: ds };
  }

  /** Truy van don (chi doan "con", moi doan MOT selector ten / so) -> mot gia tri duy nhat hoac khong. */
  function laDon(ds) {
    for (var i = 0; i < ds.length; i++) {
      if (ds[i].loai !== "con" || ds[i].chon.length !== 1) return false;
      var k = ds[i].chon[0].k;
      if (k !== "ten" && k !== "so") return false;
    }
    return true;
  }

  /* ====================================================================
     2. Ham
     ==================================================================== */
  var HAM = {
    length: { args: ["gia-tri"], ra: "gia-tri" },
    count: { args: ["nut"], ra: "gia-tri" },
    match: { args: ["gia-tri", "gia-tri"], ra: "logic" },
    search: { args: ["gia-tri", "gia-tri"], ra: "logic" },
    value: { args: ["nut"], ra: "gia-tri" }
  };

  function demCodePoint(str) {
    var d = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) i++;
      }
      d++;
    }
    return d;
  }

  var boNhoRe = Object.create(null), soBoNho = 0;
  function layRe(mau, co) {
    var k = co + "/" + mau;
    if (k in boNhoRe) return boNhoRe[k];
    var re = null;
    if (!JE.chung.kiemRegexAnToan(mau)) {
      try { re = new RegExp(mau, "u" + co); } catch (e) { re = null; }
    }
    if (soBoNho > 500) { boNhoRe = Object.create(null); soBoNho = 0; }
    boNhoRe[k] = re; soBoNho++;
    return re;
  }

  /** So sanh chuoi theo code point (RFC 9535: gia tri vo huong Unicode), tra -1 / 0 / 1. */
  function soChuoiCP(a, b) {
    var i = 0, j = 0;
    while (i < a.length && j < b.length) {
      var x = a.codePointAt(i), y = b.codePointAt(j);
      if (x !== y) return x < y ? -1 : 1;
      i += x > 0xffff ? 2 : 1; j += y > 0xffff ? 2 : 1;
    }
    if (i < a.length) return 1;
    if (j < b.length) return -1;
    return 0;
  }

  function bangGiaTri(x, y) {
    if (x === y) return true;
    var JC = JE.chung;
    return JC.bangNhauSau(x, y);
  }

  /* ====================================================================
     3. Chay
     ==================================================================== */
  /* Nut ket qua: {v, p (nut cha), k (khoa / chi so)}; duong dung lai tu chuoi cha. */
  function nutGoc(v) { return { v: v, p: null, k: undefined }; }
  function duongCua(nut) {
    var ds = [];
    for (var x = nut; x && x.p; x = x.p) ds.push(x.k);
    return ds.reverse();
  }

  function hoanTatChuoiDuong(d) {
    /* chuoi duong chuan RFC 9535 §2.7 */
    var s = "$";
    for (var i = 0; i < d.length; i++) {
      if (typeof d[i] === "number") s += "[" + d[i] + "]";
      else s += "['" + thoatTen(d[i]) + "']";
    }
    return s;
  }
  function thoatTen(k) {
    var ra = "";
    for (var i = 0; i < k.length; i++) {
      var c = k.charCodeAt(i), ch = k.charAt(i);
      if (ch === "'") ra += "\\'";
      else if (ch === "\\") ra += "\\\\";
      else if (c === 8) ra += "\\b";
      else if (c === 12) ra += "\\f";
      else if (c === 10) ra += "\\n";
      else if (c === 13) ra += "\\r";
      else if (c === 9) ra += "\\t";
      else if (c < 32) ra += "\\u" + ("0000" + c.toString(16)).slice(-4);
      else ra += ch;
    }
    return ra;
  }

  function KetQua(nut) { this._nut = nut; this.v = nut.v; this._duong = null; this._chuan = null; this._hien = null; }
  Object.defineProperty(KetQua.prototype, "duong", { get: function () { return this._duong || (this._duong = duongCua(this._nut)); } });
  Object.defineProperty(KetQua.prototype, "chuan", { get: function () { return this._chuan || (this._chuan = hoanTatChuoiDuong(this.duong)); } });
  Object.defineProperty(KetQua.prototype, "hien", { get: function () { return this._hien || (this._hien = JE.chung.moTaDuong(this.duong)); } });
  KetQua.prototype.toJSON = function () { return { duong: this.duong, v: this.v, chuan: this.chuan, hien: this.hien }; };

  function chiSoMang(k) { return /^(0|[1-9]\d*)$/.test(k) ? +k : -1; }

  function chayTho(goc, q, tran, tuyChon) {
    var ast = typeof q === "object" && q !== null ? q : phanTich(q);
    var cu = !!(tuyChon && tuyChon.kieuCu);
    var han = tran > 0 ? tran : TRAN_MAC_DINH;
    var ra = [], catBot = false;
    var sach = { con: NGAN_SACH };
    var rootNut = nutGoc(goc);

    function tieu(x) {
      sach.con -= x || 1;
      if (sach.con < 0) throw Loi("Truy vấn quá nặng: vượt " + (NGAN_SACH / 1000000) + " triệu bước duyệt — hãy thêm bộ lọc [?…] hoặc đường dẫn cụ thể thay vì “..*” trên tài liệu rất lớn", null);
    }

    if (ast.loai === "goc") { ra.push(new KetQua(rootNut)); ra.catBot = false; return ra; }
    if (ast.loai === "con-tro") {
      var nut = rootNut, ok = true;
      for (var i = 0; i < ast.duong.length && ok; i++) {
        var kk = ast.duong[i], v = nut.v;
        if (Array.isArray(v)) {
          var ci = typeof kk === "number" ? kk : chiSoMang(String(kk));
          if (ci >= 0 && ci < v.length) nut = { v: v[ci], p: nut, k: ci }; else ok = false;
        } else if (laNhanh(v) && coRieng(v, String(kk))) nut = { v: v[String(kk)], p: nut, k: String(kk) };
        else ok = false;
      }
      if (ok) ra.push(new KetQua(nut));
      ra.catBot = false;
      return ra;
    }

    /** Ap mot selector len mot nut; goi ham `them(nutCon)`. */
    function apChon(c, nut, them, goc2) {
      var v = nut.v, i, k, n2;
      tieu();
      switch (c.k) {
        case "ten":
          if (Array.isArray(v)) {
            if (cu) { i = chiSoMang(c.ten); if (i >= 0 && i < v.length) them({ v: v[i], p: nut, k: i }); }
          } else if (laNhanh(v) && coRieng(v, c.ten)) them({ v: v[c.ten], p: nut, k: c.ten });
          break;
        case "so":
          if (Array.isArray(v)) {
            i = c.i < 0 ? v.length + c.i : c.i;
            if (i >= 0 && i < v.length) them({ v: v[i], p: nut, k: i });
          } else if (cu && laNhanh(v) && coRieng(v, String(c.i))) them({ v: v[String(c.i)], p: nut, k: String(c.i) });
          break;
        case "sao":
          if (Array.isArray(v)) { for (i = 0; i < v.length; i++) them({ v: v[i], p: nut, k: i }); tieu(v.length); }
          else if (laNhanh(v)) { var ks = Object.keys(v); for (i = 0; i < ks.length; i++) them({ v: v[ks[i]], p: nut, k: ks[i] }); tieu(ks.length); }
          break;
        case "cat":
          if (Array.isArray(v)) {
            var len = v.length, st = c.buoc === null ? 1 : c.buoc;
            if (st === 0) break;
            var bd = c.bd === null ? (st > 0 ? 0 : len - 1) : c.bd;
            var kt = c.kt === null ? (st > 0 ? len : -len - 1) : c.kt;
            var nb = bd >= 0 ? bd : len + bd, nk = kt >= 0 ? kt : len + kt, lo, hi;
            if (st > 0) { lo = Math.min(Math.max(nb, 0), len); hi = Math.min(Math.max(nk, 0), len); for (i = lo; i < hi; i += st) { tieu(); them({ v: v[i], p: nut, k: i }); } }
            else { hi = Math.min(Math.max(nb, -1), len - 1); lo = Math.min(Math.max(nk, -1), len - 1); for (i = hi; lo < i; i += st) { tieu(); them({ v: v[i], p: nut, k: i }); } }
          }
          break;
        case "loc":
          if (Array.isArray(v)) {
            for (i = 0; i < v.length; i++) { n2 = { v: v[i], p: nut, k: i }; if (danhGia(c.bt, n2) === true) them(n2); }
          } else if (laNhanh(v)) {
            var ks2 = Object.keys(v);
            for (i = 0; i < ks2.length; i++) { k = ks2[i]; n2 = { v: v[k], p: nut, k: k }; if (danhGia(c.bt, n2) === true) them(n2); }
          }
          break;
      }
    }

    /** Chay danh sach doan tu cac nut `dau`; tra mang nut. */
    function chayDoan(doan, dau) {
      var cur = dau, i, j, s2;
      for (i = 0; i < doan.length; i++) {
        var dn = doan[i], nxt = [];
        var them = function (x) { nxt.push(x); };
        if (dn.loai === "con") {
          for (j = 0; j < cur.length; j++) for (s2 = 0; s2 < dn.chon.length; s2++) apChon(dn.chon[s2], cur[j], them);
        } else {
          for (j = 0; j < cur.length; j++) {
            /* duyet tien thu tu: nut, roi con (ngan xep tu quan ly) */
            var ngan = [cur[j]];
            while (ngan.length) {
              var x = ngan.pop();
              tieu();
              for (s2 = 0; s2 < dn.chon.length; s2++) apChon(dn.chon[s2], x, them);
              var xv = x.v;
              if (Array.isArray(xv)) { for (var a = xv.length - 1; a >= 0; a--) ngan.push({ v: xv[a], p: x, k: a }); }
              else if (laNhanh(xv)) { var kz = Object.keys(xv); for (var b = kz.length - 1; b >= 0; b--) ngan.push({ v: xv[kz[b]], p: x, k: kz[b] }); }
            }
          }
        }
        cur = nxt;
        if (cur.length > 4 * han + 100000) { /* tranh bung no bo nho */
          throw Loi("Truy vấn sinh quá nhiều nút trung gian (> " + (4 * han + 100000) + ")", null);
        }
      }
      return cur;
    }

    /* ---- danh gia bieu thuc loc ---- */
    function giaTriToanHang(e, nutHT) {
      if (e.t === "hang") return e.v;
      if (e.t === "truyvan") {
        var kq = chayDoan(e.doan, [e.goc === "@" ? nutHT : rootNut]);
        return kq.length ? kq[0].v : NOTHING;
      }
      if (e.t === "ham") return goiHam(e, nutHT);
      return NOTHING;
    }
    function goiHam(e, nutHT) {
      var a = e.args, x, y;
      switch (e.ten) {
        case "length":
          x = giaTriToanHang(a[0], nutHT);
          if (typeof x === "string") return demCodePoint(x);
          if (Array.isArray(x)) return x.length;
          if (x !== NOTHING && laNhanh(x)) return Object.keys(x).length;
          return NOTHING;
        case "count":
          return chayDoan(a[0].doan, [a[0].goc === "@" ? nutHT : rootNut]).length;
        case "value": {
          var kq = chayDoan(a[0].doan, [a[0].goc === "@" ? nutHT : rootNut]);
          return kq.length === 1 ? kq[0].v : NOTHING;
        }
        case "match": case "search":
          x = giaTriToanHang(a[0], nutHT); y = giaTriToanHang(a[1], nutHT);
          if (typeof x !== "string" || typeof y !== "string") return false;
          var re = layRe(e.ten === "match" ? "^(?:" + y + ")$" : y, "");
          return re ? re.test(x) : false;
      }
      return NOTHING;
    }
    function soSanh(op, x, y) {
      var bang;
      if (x === NOTHING || y === NOTHING) bang = x === NOTHING && y === NOTHING;
      else bang = bangGiaTri(x, y);
      if (op === "==") return bang;
      if (op === "!=") return !bang;
      if (op === "<" || op === ">" || op === "<=" || op === ">=") {
        var tr = op === ">" || op === ">=" ? soBe(y, x) : soBe(x, y);
        if (op === "<" || op === ">") return tr;
        return tr || bang;
      }
      return false;
      function soBe(a, b) {
        if (typeof a === "number" && typeof b === "number") return a < b;
        if (typeof a === "string" && typeof b === "string") return soChuoiCP(a, b) < 0;
        return false;
      }
    }
    function danhGia(e, nutHT) {
      tieu();
      switch (e.t) {
        case "hoac": return danhGia(e.a, nutHT) || danhGia(e.b, nutHT);
        case "va": return danhGia(e.a, nutHT) && danhGia(e.b, nutHT);
        case "khong": return !danhGia(e.a, nutHT);
        case "ngoac": return danhGia(e.a, nutHT);
        case "thu":
          if (e.e.t === "truyvan") return chayDoan(e.e.doan, [e.e.goc === "@" ? nutHT : rootNut]).length > 0;
          return goiHam(e.e, nutHT) === true;
        case "so-sanh": return soSanh(e.op, giaTriToanHang(e.a, nutHT), giaTriToanHang(e.b, nutHT));
        case "khop-re": {
          var x = giaTriToanHang(e.a, nutHT);
          if (typeof x !== "string") return false;
          var re = layRe(e.re, e.co);
          return re ? re.test(x) : false;
        }
      }
      return false;
    }

    var kqNut = chayDoan(ast.doan, [rootNut]);
    for (var z = 0; z < kqNut.length; z++) {
      if (ra.length >= han) { catBot = true; break; }
      ra.push(new KetQua(kqNut[z]));
    }
    ra.catBot = catBot;
    return ra;
  }


  /** Boc chayTho/phanTich: RangeError (bieu thuc loc qua dai -> de quy qua sau) thanh loi tieng Viet. */
  function chay(goc, q, tran, tuyChon) {
    try { return chayTho(goc, q, tran, tuyChon); }
    catch (e) {
      if (e instanceof RangeError) throw Loi("Biểu thức quá dài hoặc lồng quá sâu để xử lý — hãy rút gọn bộ lọc", null);
      throw e;
    }
  }
  JE.jsonpath = {
    phanTich: phanTich,
    chay: chay,
    duongChuan: hoanTatChuoiDuong,
    TRAN_MAC_DINH: TRAN_MAC_DINH
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.jsonpath;
});
