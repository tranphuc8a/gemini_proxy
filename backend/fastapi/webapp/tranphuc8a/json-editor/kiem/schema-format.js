/* kiem/schema-format.js — assets/schema-format.js: moi format >= 5 chuoi DUNG + >= 5 chuoi SAI (29/02, ipv6 nen, email quoted,
   giay nhuan, URI…), format la -> undefined, gia tri khong phai chuoi -> true. Moi chuoi la mot phep. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem;
  const MT = C.taoMoiTruong();
  const F = MT.JE && MT.JE.schemaFormat;
  if (!kiem("schema-format · nap xong, co JE.schemaFormat", !!F && typeof F.kiem === "function")) return;

  const BANG = {
    "date-time": [
      ["2024-05-01T10:30:00Z", "2024-05-01t10:30:00z", "2024-02-29T00:00:00+07:00", "1998-12-31T23:59:60Z", "1998-12-31T15:59:60.123-08:00", "2000-02-29T12:00:00.5Z"],
      ["2024-05-01 10:30:00Z", "2023-02-29T00:00:00Z", "2024-13-01T00:00:00Z", "2024-05-01T25:00:00Z", "2024-05-01T10:30:00", "1998-12-31T23:58:60Z", "1998-12-31T23:59:61Z", "2024-05-01", "abc", ""]
    ],
    "date": [
      ["2024-05-01", "2024-02-29", "2000-02-29", "1999-12-31", "0001-01-01"],
      ["2023-02-29", "1900-02-29", "2024-13-01", "2024-00-10", "2024-04-31", "24-05-01", "2024-5-1", "2024-05-01T00:00:00Z"]
    ],
    "time": [
      ["10:30:00Z", "10:30:00+07:00", "23:59:60Z", "00:00:00.123Z", "08:30:06.283185Z", "15:59:60-08:00"],
      ["10:30:00", "24:00:00Z", "10:60:00Z", "10:30:61Z", "23:59:60+01:00", "10:30Z", "10:30:00+25:00", "abc"]
    ],
    "duration": [
      ["P1Y", "P1Y2M3DT4H5M6S", "PT36H", "P4W", "P1M", "PT0S", "P3DT12H"],
      ["P", "PT", "P1Y2M3DT", "PT1D", "P2D1Y", "P1W1D", "P0.5Y", "1D", "P-1D", "PT1.5S"]
    ],
    "email": [
      ["joe.bloggs@example.com", "te~st@example.com", "~test@example.com", '"joe bloggs"@example.com', '"joe..bloggs"@example.com', '"joe@bloggs"@example.com',
        "joe.bloggs@[127.0.0.1]", "joe.bloggs@[IPv6:::1]", "a@b.co"],
      ["2962", ".test@example.com", "test.@example.com", "te..st@example.com", "joe bloggs@example.com", "@example.com", "joe@", "joe@-bad.com", "joe@[300.1.1.1]", "joe@[IPv6:zzz]"]
    ],
    "idn-email": [
      ["실례@실례.테스트", "joe.bloggs@example.com", "Phúc@example.com", '"đ x"@example.com', "a@büro.de"],
      ["2962", ".test@example.com", "te..st@example.com", "joe@", "joe bloggs@example.com", "@ex.com"]
    ],
    "hostname": [
      ["www.example.com", "xn--4gbwdl.xn--wgbh1c", "a", "a-b.c1", "1.2.3.4", "localhost", "a".repeat(63) + ".com"],
      ["", "-a.com", "a-.com", "a_b.com", "a..com", "example.com.", "a".repeat(64) + ".com", "has space.com", "ví-dụ.com"]
    ],
    "idn-hostname": [
      ["실례.테스트", "www.example.com", "ví-dụ.vn", "xn--4gbwdl.xn--wgbh1c", "a"],
      ["", "-a.com", "a-.com", "a_b.com", "a..com", "has space.com"]
    ],
    "ipv4": [
      ["0.0.0.0", "127.0.0.1", "255.255.255.255", "192.168.1.10", "1.2.3.4"],
      ["256.1.1.1", "1.2.3", "1.2.3.4.5", "087.0.0.1", "1.2.3.-4", "a.b.c.d", "1.2.3.4 ", "", "1..2.3", "١٢٣.1.1.1"]
    ],
    "ipv6": [
      ["::1", "::", "2001:db8::8a2e:370:7334", "1:2:3:4:5:6:7:8", "::ffff:192.168.0.1", "1::", "fe80::1", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"],
      [":1", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", "1::2::3", ":::1", "fe80::1%eth0", "12345::1", "1:2:3:4:5:6:7:1.2.3.4", "::g", "1.2.3.4", ""]
    ],
    "uri": [
      ["http://www.ietf.org/rfc/rfc2396.txt", "urn:example:animal:ferret:nose", "mailto:John.Doe@example.com", "http://[2001:db8::7]/c=GB?objectClass?one",
        "https://user:pw@example.com:8080/a/b?x=1#frag", "ftp://ftp.is.co.za/rfc/rfc1808.txt", "http://a.b/%E2%82%AC"],
      ["/abc", "abc", "//foo.bar/?baz=qux#quux", "http://example.com/a b", "http,://x.y", "http://x.y/%zz", "\\\\WINDOWS\\fileshare", "http://x.y/#a#b", "", "1http://x.y", "http://ex ample.com"]
    ],
    "uri-reference": [
      ["http://foo.bar/?baz=qux#quux", "//foo.bar/?baz=qux#quux", "/abc", "abc", "#fragment", "", "../x/y?z=1", "?q=1"],
      ["\\\\WINDOWS\\fileshare", "#frag\\ment", "http://x.y/a b", "a b", "1a:b", "http://x.y/%zz"]
    ],
    "iri": [
      ["http://ƒøø.ßår/?∂éœ=πîx#πîüx", "http://example.com/путь", "https://日本語.jp/パス", "urn:isbn:0451450523", "http://a.b/ok"],
      ["//ƒøø.ßår/?∂éœ=πîx#πîüx", "/abc", "http://example.com/a b", "abc", "http://x.y/%zz"]
    ],
    "iri-reference": [
      ["http://ƒøø.ßår/?∂éœ=πîx#πîüx", "//ƒøø.ßår/?∂éœ=πîx#πîüx", "/âβγ", "#ƒrägmênt", "", "abc"],
      ["\\\\WINDOWS\\fileshare", "#ƒräg\\mênt", "http://x.y/a b", "a b", "http://x.y/%zz"]
    ],
    "uuid": [
      ["2eb8aa08-aa98-11ea-b4aa-73b441d16380", "2EB8AA08-AA98-11EA-B4AA-73B441D16380", "00000000-0000-0000-0000-000000000000", "6a2f41a3-c54c-fce8-32d2-0324e1c32e22", "ffffffff-ffff-ffff-ffff-ffffffffffff"],
      ["2eb8aa08-aa98-11ea-b4aa-73b441d1638", "2eb8aa08aa9811eab4aa73b441d16380", "2eb8aa08-aa98-11ea-b4aa-73b441d1638g", "2eb8aa08-aa98-11ea-b4aa-73b441d163800", "{2eb8aa08-aa98-11ea-b4aa-73b441d16380}", "", "gggggggg-gggg-gggg-gggg-gggggggggggg"]
    ],
    "regex": [
      ["^[A-Z]{3}$", "a+b*", "(?<ten>x)\\k<ten>", "\\d{3}-\\d{4}", "[^a-z]", "x|y|z"],
      ["(", "[a-", "*a", "a{2,1}", "(?<n>x)(?<n>y)", "\\"]
    ],
    "json-pointer": [
      ["", "/", "/a/b", "/a~0b/c~1d", "/0/1", "//"],
      ["a/b", "/a~2b", "/~", "#/a", "/a~"]
    ],
    "relative-json-pointer": [
      ["0", "1/a", "2#", "0/foo/bar", "12/a~1b"],
      ["", "/a", "01/a", "-1/a", "1#/a", "a", "1/a~"]
    ],
    "uri-template": [
      ["http://example.com/{id}", "{+path}/here", "{#frag}", "/users{/id}{?q,page}", "{var:3}", "{list*}", "x{.a,b}y", "plain-text"],
      ["{", "}", "{}", "{ id}", "{id", "{a b}", "{+}", "{x:0}", "{x:12345}", "100% sure", "{a,,b}"]
    ]
  };

  let tongDung = 0, tongSai = 0;
  for (const ten of Object.keys(BANG)) {
    const [dung, sai] = BANG[ten];
    if (dung.length < 5 || sai.length < 5) kiem("schema-format · " + ten + " du ca (>= 5 dung + >= 5 sai)", false, dung.length + "/" + sai.length);
    for (const s of dung) { kiem("format " + ten + " · hop le " + JSON.stringify(s.length > 40 ? s.slice(0, 38) + "…" : s), F.kiem(ten, s) === true); tongDung++; }
    for (const s of sai) { kiem("format " + ten + " · SAI " + JSON.stringify(s.length > 40 ? s.slice(0, 38) + "…" : s), F.kiem(ten, s) === false); tongSai++; }
  }
  kiem("schema-format · da duyet " + Object.keys(BANG).length + " format (" + tongDung + " dung + " + tongSai + " sai)", Object.keys(BANG).length === 19 && F.danhSach.length === 19 &&
    Object.keys(BANG).every((t) => F.co(t)));
  kiem("schema-format · format la -> undefined; co() false; ten ke thua (toString, __proto__) khong phai format",
    F.kiem("khong-co", "x") === undefined && !F.co("khong-co") && F.kiem("toString", "x") === undefined && !F.co("__proto__") && !F.co("constructor"));
  kiem("schema-format · gia tri KHONG phai chuoi luon hop le (format chi ap dung cho chuoi)",
    ["date", "email", "ipv4", "uuid", "uri"].every((t) => F.kiem(t, 5) === true && F.kiem(t, null) === true && F.kiem(t, {}) === true));
  kiem("schema-format · moi format co cum tu mo ta cho thong bao loi", F.danhSach.every((t) => typeof F.moTa[t] === "string" && F.moTa[t].length > 3));
  kiem("schema-format · ReDoS-an toan: chuoi 100 000 ky tu cho moi format xong < 2 s", (function () {
    const t0 = Date.now();
    const dai = ["a".repeat(100000), "1".repeat(100000), "a.".repeat(50000), "a@".repeat(50000), "{".repeat(100000), "/".repeat(100000), "http://" + "a".repeat(100000)];
    for (const ten of F.danhSach) if (ten !== "regex") for (const s of dai) F.kiem(ten, s);
    return Date.now() - t0 < 2000;
  })());
};
