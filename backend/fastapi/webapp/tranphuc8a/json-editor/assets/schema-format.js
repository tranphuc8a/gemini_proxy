/* =====================================================================
   schema-format.js — kiem cac `format` cua JSON Schema (module thuan, khuon
   je-chung.js: khong DOM / storage / dong ho; co JE_NGUON cho Worker).

   JE.schemaFormat:
     kiem(ten, chuoi)  -> true | false | undefined   (undefined: format la — bo qua)
     co(ten)           -> format nay co duoc ho tro khong
     danhSach          -> ten cac format ho tro
     moTa[ten]         -> cum tu mo ta ("email hop le"…) cho thong bao loi
     tomTat(ten)       -> {ten, ghiChu} cho giao dien

   Chu y: format chi ap dung cho CHUOI; kiem(ten, x) voi x khong phai chuoi tra true.
   Cac ham chi dung regex DON GIAN, khong long (khong ReDoS) — tru "regex",
   noi chi BIEN DICH mau (khong chay no tren du lieu).
   idn-* / iri-* la xap xi: cho phep Unicode, khong kiem IDNA / bidi day du.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});

  /* ----------------------------------------------------- ngay / gio */
  function laNhuan(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  function ngayHopLe(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    var ngay = [31, laNhuan(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= ngay[m - 1];
  }

  var RE_NGAY = /^(\d{4})-(\d{2})-(\d{2})$/;
  function kiemNgay(s) {
    var m = RE_NGAY.exec(s);
    return !!m && ngayHopLe(+m[1], +m[2], +m[3]);
  }

  var RE_GIO = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([Zz])|([+-])(\d{2}):(\d{2}))$/;
  /** Gio RFC 3339 co mui gio bat buoc. Giay 60 (giay nhuan) chi hop le khi doi ra UTC la 23:59:60. */
  function kiemGio(s) {
    var m = RE_GIO.exec(s);
    if (!m) return false;
    var h = +m[1], mi = +m[2], se = +m[3];
    if (h > 23 || mi > 59 || se > 60) return false;
    var lech = 0;
    if (!m[4]) {
      var oh = +m[6], om = +m[7];
      if (oh > 23 || om > 59) return false;
      lech = (m[5] === "-" ? -1 : 1) * (oh * 60 + om);
    }
    if (se === 60) {
      var utc = ((h * 60 + mi - lech) % 1440 + 1440) % 1440;
      return utc === 23 * 60 + 59;
    }
    return true;
  }

  function kiemNgayGio(s) {
    var t = s.search(/[Tt]/);
    if (t < 0) return false;
    return kiemNgay(s.slice(0, t)) && kiemGio(s.slice(t + 1));
  }

  /* ISO 8601 theo RFC 3339 phu luc A: P + (nW | ngay [gio] | thang [ngay] [gio] | nam [thang] [ngay] [gio] | gio). */
  var RE_THOI_LUONG = /^P(?:(\d+W)|(?:(\d+Y)(\d+M)?(\d+D)?|(\d+M)(\d+D)?|(\d+D))?(?:T(?:(\d+H)(\d+M)?(\d+S)?|(\d+M)(\d+S)?|(\d+S)))?)$/;
  function kiemThoiLuong(s) {
    if (s === "P" || /T$/.test(s)) return false;
    return RE_THOI_LUONG.test(s);
  }

  /* ----------------------------------------------------- mang */
  var OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
  var RE_IPV4 = new RegExp("^" + OCTET + "(?:\\." + OCTET + "){3}$");
  function kiemIpv4(s) { return RE_IPV4.test(s); }

  function kiemIpv6(s) {
    if (!/^[0-9A-Fa-f:.]+$/.test(s) || s.indexOf(":") < 0) return false;
    var dc = s.indexOf("::");
    if (dc !== s.lastIndexOf("::")) return false;
    if (s.indexOf(":::") >= 0) return false;
    var dau, duoi, nhom;
    if (dc >= 0) {
      dau = s.slice(0, dc); duoi = s.slice(dc + 2);
      nhom = (dau ? dau.split(":") : []).concat(duoi ? duoi.split(":") : []);
    } else {
      nhom = s.split(":");
    }
    var dem = 0;
    for (var i = 0; i < nhom.length; i++) {
      var x = nhom[i];
      if (x.indexOf(".") >= 0) {
        if (i !== nhom.length - 1 || !kiemIpv4(x)) return false;     /* IPv4 chi o cuoi, chiem 2 nhom */
        dem += 2;
      } else {
        if (!/^[0-9A-Fa-f]{1,4}$/.test(x)) return false;
        dem++;
      }
    }
    return dc >= 0 ? dem <= 7 : dem === 8;
  }

  /* ----------------------------------------------------- hostname */
  function kiemHostname(s) {
    if (!s || s.length > 253) return false;
    var ls = s.split(".");
    for (var i = 0; i < ls.length; i++) {
      if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(ls[i])) return false;
    }
    return true;
  }

  var RE_NHAN_IDN = /^[\p{L}\p{N}\p{M}](?:[\p{L}\p{N}\p{M}-]{0,61}[\p{L}\p{N}\p{M}])?$/u;
  function kiemHostnameIdn(s) {
    if (!s) return false;
    var ls = s.split(/[.。．｡]/);
    if (s.length > 253) return false;
    for (var i = 0; i < ls.length; i++) {
      if (!RE_NHAN_IDN.test(ls[i]) || ls[i].length > 63) return false;
    }
    return true;
  }

  /* ----------------------------------------------------- email */
  var ATEXT = "-A-Za-z0-9!#$%&'*+/=?^_`{|}~";
  var RE_LOCAL = new RegExp("^[" + ATEXT + "]+(?:\\.[" + ATEXT + "]+)*$");
  var RE_LOCAL_IDN = new RegExp("^[" + ATEXT + "\\p{L}\\p{N}\\p{M}]+(?:\\.[" + ATEXT + "\\p{L}\\p{N}\\p{M}]+)*$", "u");
  var RE_LOCAL_TRICH = /^"(?:[^"\\\r\n]|\\[\x20-\x7e])*"$/;
  var RE_LOCAL_TRICH_IDN = /^"(?:[^"\\\r\n]|\\[\x20-\x7e -\u{10ffff}])*"$/u;

  function kiemEmailChung(s, idn) {
    var at = s.lastIndexOf("@");
    if (at <= 0 || at === s.length - 1) return false;
    var cuc = s.slice(0, at), mien = s.slice(at + 1);
    if (cuc.length > 64 || s.length > 254) return false;
    var okCuc = cuc.charAt(0) === '"'
      ? (idn ? RE_LOCAL_TRICH_IDN : RE_LOCAL_TRICH).test(cuc)
      : (idn ? RE_LOCAL_IDN : RE_LOCAL).test(cuc);
    if (!okCuc) return false;
    if (mien.charAt(0) === "[") {
      if (mien.charAt(mien.length - 1) !== "]") return false;
      var ben = mien.slice(1, -1);
      if (/^IPv6:/i.test(ben)) return kiemIpv6(ben.slice(5));
      return kiemIpv4(ben);
    }
    return idn ? kiemHostnameIdn(mien) : kiemHostname(mien);
  }

  /* ----------------------------------------------------- URI / IRI (RFC 3986 / 3987) */
  /** Moi ky tu thuoc tap cho phep; `%` phai di kem hai chu so hex; idn: cho phep ucschar (>= U+00A0, tru khoang trang / dieu khien). */
  function kyTuHopLe(s, idn, chiChoPhep) {
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 37) {
        if (!/^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) return false;
        i += 2;
      } else if (c < 128) {
        if (!(chiChoPhep.indexOf(s.charAt(i)) >= 0 || (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122))) return false;
      } else {
        if (!idn || c < 0xa0 || c === 0x2028 || c === 0x2029) return false;
        if (c >= 0xd800 && c <= 0xdbff) {                 /* cap thay the: nua sau phai di ngay sau */
          var d = s.charCodeAt(i + 1);
          if (!(d >= 0xdc00 && d <= 0xdfff)) return false;
          i++;
        } else if (c >= 0xdc00 && c <= 0xdfff) return false;
      }
    }
    return true;
  }

  var PCHAR = "-._~!$&'()*+,;=:@";
  function kiemMienUri(auth, idn) {
    var at = auth.lastIndexOf("@"), tt = at >= 0 ? auth.slice(0, at) : null, host = at >= 0 ? auth.slice(at + 1) : auth;
    if (tt !== null && !kyTuHopLe(tt, idn, "-._~!$&'()*+,;=:")) return false;
    var cong = null;
    if (host.charAt(0) === "[") {
      var dong = host.indexOf("]");
      if (dong < 0) return false;
      var ben = host.slice(1, dong), sau = host.slice(dong + 1);
      if (sau) { if (sau.charAt(0) !== ":") return false; cong = sau.slice(1); }
      if (!(kiemIpv6(ben) || /^v[0-9A-Fa-f]+\.[A-Za-z0-9\-._~!$&'()*+,;=:]+$/.test(ben))) return false;
    } else {
      var c2 = host.lastIndexOf(":");
      if (c2 >= 0) { cong = host.slice(c2 + 1); host = host.slice(0, c2); }
      if (!kyTuHopLe(host, idn, "-._~!$&'()*+,;=")) return false;
    }
    return cong === null || /^\d*$/.test(cong);
  }

  /** `cheDo`: "tuyet-doi" (uri/iri) hay "tham-chieu" (uri-reference/iri-reference). */
  function kiemUri(s, cheDo, idn) {
    if (typeof s !== "string") return true;
    var thamChieu = cheDo === "tham-chieu";
    var h = s.indexOf("#"), manh = null;
    if (h >= 0) {
      manh = s.slice(h + 1);
      s = s.slice(0, h);
      if (manh.indexOf("#") >= 0 || !kyTuHopLe(manh, idn, PCHAR + "/?")) return false;
    }
    var q = s.indexOf("?"), truyVan = null;
    if (q >= 0) {
      truyVan = s.slice(q + 1);
      s = s.slice(0, q);
      if (!kyTuHopLe(truyVan, idn, PCHAR + "/?")) return false;
    }
    var m = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(s), coScheme = !!m;
    if (!coScheme && !thamChieu) return false;
    var rest = coScheme ? s.slice(m[0].length) : s, auth = null, duong;
    if (rest.slice(0, 2) === "//") {
      var sl = rest.indexOf("/", 2);
      auth = sl < 0 ? rest.slice(2) : rest.slice(2, sl);
      duong = sl < 0 ? "" : rest.slice(sl);
      if (!kiemMienUri(auth, idn)) return false;
    } else {
      duong = rest;
    }
    if (!kyTuHopLe(duong, idn, PCHAR + "/")) return false;
    if (!coScheme && auth === null && duong.indexOf(":") >= 0 && duong.indexOf(":") < (duong.indexOf("/") < 0 ? duong.length : duong.indexOf("/"))) return false;
    if (coScheme && auth !== null && duong !== "" && duong.charAt(0) !== "/") return false;
    return true;
  }

  /* ----------------------------------------------------- khac */
  var RE_UUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
  var RE_CON_TRO = /^(?:\/(?:[^~/]|~[01])*)*$/;
  var RE_CON_TRO_TUONG_DOI = /^(?:0|[1-9]\d*)(?:#|(?:\/(?:[^~/]|~[01])*)*)$/;

  function kiemRegex(s) {
    try { new RegExp(s, "u"); return true; } catch (e) { /* thu khong co co u */ }
    try { new RegExp(s); return true; } catch (e2) { return false; }
  }

  /* RFC 6570: literal | { [toan tu] varspec , … }. varspec = ten [":" 1..4 chu so | "*"]. */
  var RE_BIEN = /^(?:[A-Za-z0-9_]|%[0-9A-Fa-f]{2})(?:\.?(?:[A-Za-z0-9_]|%[0-9A-Fa-f]{2}))*(?::[1-9]\d{0,3}|\*)?$/;
  function kiemMauUri(s) {
    var i = 0, n = s.length;
    while (i < n) {
      var c = s.charAt(i);
      if (c === "{") {
        var d = s.indexOf("}", i);
        if (d < 0) return false;
        var bt = s.slice(i + 1, d);
        if (/^[+#./;?&=,!@|]/.test(bt)) bt = bt.slice(1);
        if (bt === "") return false;
        var ds = bt.split(",");
        for (var k = 0; k < ds.length; k++) if (!RE_BIEN.test(ds[k])) return false;
        i = d + 1;
      } else if (c === "}") {
        return false;
      } else if (c === "%") {
        if (!/^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) return false;
        i += 3;
      } else {
        var cc = s.charCodeAt(i);
        if (cc <= 0x20 || cc === 0x7f || '"\'<>\\^`|'.indexOf(c) >= 0) return false;
        i++;
      }
    }
    return true;
  }

  var HAM = {
    "date-time": kiemNgayGio,
    "date": kiemNgay,
    "time": kiemGio,
    "duration": kiemThoiLuong,
    "email": function (s) { return kiemEmailChung(s, false); },
    "idn-email": function (s) { return kiemEmailChung(s, true); },
    "hostname": kiemHostname,
    "idn-hostname": kiemHostnameIdn,
    "ipv4": kiemIpv4,
    "ipv6": kiemIpv6,
    "uri": function (s) { return kiemUri(s, "tuyet-doi", false); },
    "uri-reference": function (s) { return kiemUri(s, "tham-chieu", false); },
    "iri": function (s) { return kiemUri(s, "tuyet-doi", true); },
    "iri-reference": function (s) { return kiemUri(s, "tham-chieu", true); },
    "uuid": function (s) { return RE_UUID.test(s); },
    "regex": kiemRegex,
    "json-pointer": function (s) { return RE_CON_TRO.test(s); },
    "relative-json-pointer": function (s) { return RE_CON_TRO_TUONG_DOI.test(s); },
    "uri-template": kiemMauUri
  };

  var MO_TA = {
    "date-time": "ngày giờ RFC 3339 (vd 2024-05-01T10:30:00Z)",
    "date": "ngày YYYY-MM-DD hợp lệ",
    "time": "giờ RFC 3339 có múi giờ (vd 10:30:00Z)",
    "duration": "khoảng thời gian ISO 8601 (vd P1DT2H)",
    "email": "email hợp lệ",
    "idn-email": "email quốc tế hợp lệ",
    "hostname": "tên máy (hostname) hợp lệ",
    "idn-hostname": "tên máy quốc tế hợp lệ",
    "ipv4": "địa chỉ IPv4 hợp lệ",
    "ipv6": "địa chỉ IPv6 hợp lệ",
    "uri": "URI tuyệt đối hợp lệ",
    "uri-reference": "tham chiếu URI hợp lệ",
    "iri": "IRI tuyệt đối hợp lệ",
    "iri-reference": "tham chiếu IRI hợp lệ",
    "uuid": "UUID hợp lệ (8-4-4-4-12)",
    "regex": "biểu thức chính quy ECMA-262 hợp lệ",
    "json-pointer": "JSON Pointer hợp lệ",
    "relative-json-pointer": "Relative JSON Pointer hợp lệ",
    "uri-template": "mẫu URI (RFC 6570) hợp lệ"
  };

  var GHI_CHU = {
    "idn-email": "xấp xỉ: cho phép chữ Unicode, không kiểm IDNA đầy đủ",
    "idn-hostname": "xấp xỉ: cho phép chữ Unicode, không kiểm IDNA / hai chiều",
    "iri": "xấp xỉ: cho phép ký tự Unicode ngoài ASCII",
    "iri-reference": "xấp xỉ: cho phép ký tự Unicode ngoài ASCII",
    "regex": "biên dịch bằng RegExp của trình duyệt (cờ u, thử lại không cờ u)"
  };

  var hasOwn = Object.prototype.hasOwnProperty;
  function co(ten) { return typeof ten === "string" && hasOwn.call(HAM, ten); }

  function kiem(ten, chuoi) {
    if (!co(ten)) return undefined;
    if (typeof chuoi !== "string") return true;
    return HAM[ten](chuoi) === true;
  }

  JE.schemaFormat = {
    kiem: kiem, co: co,
    danhSach: Object.keys(HAM),
    moTa: MO_TA,
    ghiChu: GHI_CHU,
    tomTat: function (ten) { return { ten: ten, moTa: MO_TA[ten] || "", ghiChu: GHI_CHU[ten] || "" }; }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.schemaFormat;
});
