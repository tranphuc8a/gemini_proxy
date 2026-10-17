/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */
/* zip.js — đọc/ghi .zip THUẦN, không thư viện. Dùng cho sao lưu và xuất Markdown.

   Ghi  create(entries, {deflate, date}) → Promise<Blob>.  entry = {name, data: string | Uint8Array | Uint8Array[]}.
        STORE hoặc DEFLATE (CompressionStream "deflate-raw" của trình duyệt / Node ≥ 18), tên UTF-8 (cờ bit 11), CRC-32 đúng.
        Quá 65.534 mục hoặc quá 4 GB → tự thêm bản ghi ZIP64 (đủ để 100.000 tệp .md vẫn mở được bằng unzip, Python, Windows).
        Dữ liệu đi vào Blob theo từng mảnh — không nối thành một khối khổng lồ trong RAM.
   Đọc  read(Uint8Array|ArrayBuffer, {inflate}) → Promise<entries[]>; mỗi entry {name, size, bytes() → Promise<Uint8Array>, text()}; bytes() kiểm CRC-32.
        Chặn: quá nhiều mục, kích thước khai báo quá lớn, nén bom (kích thước THỰC khi giải nén), mã hoá, nhiều phần. Ném Error tiếng Việt, .code = "bad_zip". */
(function (root) {
  "use strict";
  var W = root.Algo || (root.Algo = {});

  var SIG_LOCAL = 0x04034b50, SIG_CD = 0x02014b50, SIG_EOCD = 0x06054b50, SIG_Z64_EOCD = 0x06064b50, SIG_Z64_LOC = 0x07064b50;
  var LIM = { entries: 300000, entryBytes: 600 * 1024 * 1024, totalBytes: 2 * 1024 * 1024 * 1024 };
  var U16 = 0xFFFF, U32 = 0xFFFFFFFF;

  function fail(msg) { var e = new Error(msg); e.code = "bad_zip"; return e; }

  var table = null;
  function crcTable() {
    if (table) return table;
    table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
    return table;
  }
  function crc32(bytes, crc) {
    var t = crcTable(), c = (crc === undefined ? 0 : crc) ^ U32;
    for (var i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ U32) >>> 0;
  }
  function utf8(s) { return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : W.text.bytes(s); }

  function dosTime(ms) {
    var d = new Date(ms || Date.now()), y = Math.max(1980, d.getFullYear());
    return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }

  function chunksOf(data) {
    if (typeof data === "string") return [utf8(data)];
    if (data instanceof Uint8Array) return [data];
    if (Array.isArray(data)) return data.map(function (c) { return typeof c === "string" ? utf8(c) : c; });
    throw fail("Dữ liệu tệp không hợp lệ.");
  }
  function joinChunks(chunks) {
    if (chunks.length === 1) return chunks[0];
    var len = 0, i; for (i = 0; i < chunks.length; i++) len += chunks[i].length;
    var out = new Uint8Array(len), at = 0;
    for (i = 0; i < chunks.length; i++) { out.set(chunks[i], at); at += chunks[i].length; }
    return out;
  }

  function deflateRaw(bytes) {
    if (typeof CompressionStream !== "function") return Promise.reject(fail("Trình duyệt chưa nén được .zip — tắt tuỳ chọn nén."));
    var cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter();
    w.write(bytes); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function le(n, size) { var b = new Uint8Array(size); for (var i = 0; i < size; i++) { b[i] = n % 256; n = Math.floor(n / 256); } return b; }
  function cat(list) { return joinChunks(list.filter(function (x) { return x.length; })); }

  function create(entries, o) {
    o = o || {};
    var parts = [], central = [], offset = 0, t = dosTime(o.date), seen = {}, count = 0;
    function entryAt(i) {
      if (i >= entries.length) return Promise.resolve();
      var e = entries[i], name = String(e.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
      if (!name || name.indexOf("../") !== -1 || name === "..") return Promise.reject(fail("Tên tệp không hợp lệ: " + e.name));
      if (seen[name.toLowerCase()]) return Promise.reject(fail("Trùng tên tệp trong zip: " + name));
      seen[name.toLowerCase()] = 1;
      var chunks = chunksOf(e.data), size = 0, crc = 0, j;
      for (j = 0; j < chunks.length; j++) { crc = crc32(chunks[j], crc); size += chunks[j].length; }
      var method = 0, body = chunks, csize = size;
      var step = o.deflate && size > 64 ? deflateRaw(joinChunks(chunks)).then(function (c) { if (c.length < size) { method = 8; body = [c]; csize = c.length; } }) : Promise.resolve();
      return step.then(function () {
        var nameB = utf8(name), big = size >= U32 || csize >= U32 || offset >= U32;
        var extra = big ? cat([le(1, 2), le(24, 2), le(size, 8), le(csize, 8), le(offset, 8)]) : new Uint8Array(0);
        var local = cat([le(SIG_LOCAL, 4), le(big ? 45 : 20, 2), le(0x0800, 2), le(method, 2), le(t.time, 2), le(t.date, 2), le(crc, 4), le(big ? U32 : csize, 4), le(big ? U32 : size, 4),
          le(nameB.length, 2), le(big ? 20 : 0, 2), nameB, big ? cat([le(1, 2), le(16, 2), le(size, 8), le(csize, 8)]) : new Uint8Array(0)]);
        parts.push(local); body.forEach(function (b) { parts.push(b); });
        central.push(cat([le(SIG_CD, 4), le(big ? 45 : 20, 2), le(big ? 45 : 20, 2), le(0x0800, 2), le(method, 2), le(t.time, 2), le(t.date, 2), le(crc, 4),
          le(big ? U32 : csize, 4), le(big ? U32 : size, 4), le(nameB.length, 2), le(extra.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(big ? U32 : offset, 4), nameB, extra]));
        offset += local.length + csize; count++;
        return entryAt(i + 1);
      });
    }
    return entryAt(0).then(function () {
      var cd = cat(central), cdOffset = offset, cdSize = cd.length, tail = [];
      parts.push(cd);
      var need64 = count > 0xFFFE || cdOffset >= U32 || cdSize >= U32;
      if (need64) {
        var z64At = cdOffset + cdSize;
        tail.push(cat([le(SIG_Z64_EOCD, 4), le(44, 8), le(45, 2), le(45, 2), le(0, 4), le(0, 4), le(count, 8), le(count, 8), le(cdSize, 8), le(cdOffset, 8)]));
        tail.push(cat([le(SIG_Z64_LOC, 4), le(0, 4), le(z64At, 8), le(1, 4)]));
      }
      tail.push(cat([le(SIG_EOCD, 4), le(0, 2), le(0, 2), le(need64 ? U16 : count, 2), le(need64 ? U16 : count, 2), le(need64 ? U32 : cdSize, 4), le(need64 ? U32 : cdOffset, 4), le(0, 2)]));
      tail.forEach(function (x) { parts.push(x); });
      return new Blob(parts, { type: "application/zip" });
    });
  }

  // ----------------------------------------------------------------------------------------------- đọc
  function nativeInflate(bytes, limit) {
    if (typeof DecompressionStream !== "function") return Promise.reject(fail("Trình duyệt này chưa giải nén được .zip có nén — hãy cập nhật trình duyệt."));
    var ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(), r = ds.readable.getReader(), total = 0, out = [];
    w.write(bytes).catch(function () {}); w.close().catch(function () {});
    function pump() {
      return r.read().then(function (x) {
        if (x.done) return joinChunks(out.length ? out : [new Uint8Array(0)]);
        total += x.value.length;
        if (total > limit) { r.cancel().catch(function () {}); throw fail("Tệp nén vượt quá kích thước khai báo (nghi nén bom)."); }
        out.push(x.value); return pump();
      });
    }
    return pump();
  }

  function read(input, o) {
    o = o || {};
    var buf = input instanceof Uint8Array ? input : new Uint8Array(input), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), inflate = o.inflate || nativeInflate;
    var u64 = function (p) { return dv.getUint32(p, true) + dv.getUint32(p + 4, true) * 4294967296; };
    var eocd = -1;
    for (var p = buf.length - 22; p >= Math.max(0, buf.length - 22 - 65535); p--) if (dv.getUint32(p, true) === SIG_EOCD) { eocd = p; break; }
    if (eocd === -1) return Promise.reject(fail("Đây không phải tệp .zip hợp lệ (không thấy bản ghi cuối)."));
    var count = dv.getUint16(eocd + 10, true), cdSize = dv.getUint32(eocd + 12, true), cdOff = dv.getUint32(eocd + 16, true);
    if (dv.getUint16(eocd + 4, true) !== 0 || dv.getUint16(eocd + 6, true) !== 0) return Promise.reject(fail("Zip nhiều phần chưa được hỗ trợ."));
    if (count === U16 || cdOff === U32 || cdSize === U32) {
      if (eocd < 20 || dv.getUint32(eocd - 20, true) !== SIG_Z64_LOC) return Promise.reject(fail("Zip64 bị hỏng."));
      var z = u64(eocd - 20 + 8);
      if (dv.getUint32(z, true) !== SIG_Z64_EOCD) return Promise.reject(fail("Zip64 bị hỏng."));
      count = u64(z + 32); cdSize = u64(z + 40); cdOff = u64(z + 48);
    }
    if (count > LIM.entries) return Promise.reject(fail("Zip có quá nhiều tệp (" + count + ")."));
    if (cdOff + cdSize > buf.length) return Promise.reject(fail("Thư mục trung tâm của zip bị hỏng."));
    var entries = [], at = cdOff, total = 0, dec = new TextDecoder("utf-8");
    for (var i = 0; i < count; i++) {
      if (at + 46 > buf.length || dv.getUint32(at, true) !== SIG_CD) return Promise.reject(fail("Thư mục trung tâm của zip bị hỏng."));
      var flags = dv.getUint16(at + 8, true), method = dv.getUint16(at + 10, true), crc = dv.getUint32(at + 16, true), csize = dv.getUint32(at + 20, true), size = dv.getUint32(at + 24, true);
      var nl = dv.getUint16(at + 28, true), xl = dv.getUint16(at + 30, true), cl = dv.getUint16(at + 32, true), lo = dv.getUint32(at + 42, true);
      var name = dec.decode(buf.subarray(at + 46, at + 46 + nl)), x = at + 46 + nl, xe = x + xl;
      while (x + 4 <= xe) {
        var id = dv.getUint16(x, true), len = dv.getUint16(x + 2, true), q = x + 4;
        if (id === 1) { if (size === U32) { size = u64(q); q += 8; } if (csize === U32) { csize = u64(q); q += 8; } if (lo === U32) lo = u64(q); }
        x += 4 + len;
      }
      at += 46 + nl + xl + cl;
      if (flags & 1) return Promise.reject(fail("Zip có mã hoá chưa được hỗ trợ."));
      if (name.charAt(name.length - 1) === "/") continue;
      if (size > LIM.entryBytes) return Promise.reject(fail("Tệp “" + name + "” quá lớn."));
      total += size;
      if (total > LIM.totalBytes) return Promise.reject(fail("Tổng dung lượng giải nén quá lớn."));
      entries.push(makeEntry(name.replace(/\\/g, "/"), method, crc, csize, size, lo));
    }
    function makeEntry(name, method, crc, csize, size, lo) {
      function bytes() {
        if (lo + 30 > buf.length || dv.getUint32(lo, true) !== SIG_LOCAL) return Promise.reject(fail("Tệp “" + name + "” bị hỏng (tiêu đề cục bộ)."));
        var start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = buf.subarray(start, start + csize);
        var done = method === 0 ? Promise.resolve(raw) : method === 8 ? inflate(raw, size + 1) : Promise.reject(fail("Kiểu nén " + method + " chưa được hỗ trợ."));
        return done.then(function (out) {
          if (out.length !== size) throw fail("Tệp “" + name + "” có kích thước không khớp (hỏng).");
          if (crc32(out) !== crc) throw fail("Tệp “" + name + "” sai CRC-32 (hỏng).");
          return out;
        });
      }
      return { name: name, size: size, bytes: bytes, text: function () { return bytes().then(function (b) { return new TextDecoder("utf-8").decode(b); }); } };
    }
    return Promise.resolve(entries);
  }

  W.zip = { create: create, read: read, crc32: crc32, LIM: LIM };
  if (typeof module !== "undefined" && module.exports) module.exports = W.zip;
})(typeof globalThis !== "undefined" ? globalThis : this);
