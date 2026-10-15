/* zip.js — đọc/ghi tệp .zip THUẦN (không DOM, không thư viện) cho Code Studio: nhập/xuất dự án.
   Kiểm: kiem-du-an.js (nhóm "zip").

   Ghi (create): phương thức STORE (không nén), tên UTF-8 (cờ bit 11), CRC-32 đúng, local header + central directory + EOCD.
   Đọc (read): STORE và DEFLATE; tìm EOCD từ cuối (có comment cũng được); chặn zip-slip, zip bomb (theo kích thước khai báo VÀ
   kích thước thực khi giải nén), quá nhiều mục; không hỗ trợ mã hoá/ZIP64/nhiều phần → ném lỗi tiếng Việt rõ ràng.
   DEFLATE giải bằng `inflateRaw(Uint8Array, limit) → Promise<Uint8Array>`; mặc định dùng DecompressionStream("deflate-raw")
   của trình duyệt (và Node ≥ 18). Test node truyền hàm bọc zlib.inflateRawSync.

   Cầu nối với dự án: projectToZip(item) ↔ zipToProject(entries). Phụ thuộc CS.project (normalize, normPath, newId) và CS.langs. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  var SIG_LOCAL = 0x04034b50, SIG_CD = 0x02014b50, SIG_EOCD = 0x06054b50, SIG_Z64_LOC = 0x07064b50;
  var DEFAULT_MAX_TOTAL = 50 * 1024 * 1024, DEFAULT_MAX_ENTRIES = 2000;
  var FILE_MAX_BYTES = 512 * 1024, PROJECT_MAX_FILES = 200, SKIPPED_MAX = 20, META_MAX_BYTES = 8 * 1024;
  var CONFIG_NAME = ".code-studio.json";
  /* nửa trên của bảng mã CP437 (0x80–0xFF): tên tệp trong zip cũ không đặt cờ UTF-8 */
  var CP437_HIGH = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

  function fail(msg, code) { var e = new Error(msg); e.code = code || "bad_zip"; return e; }
  function noop() { /* bỏ qua */ }
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function project() { if (!CS.project) throw fail("Thiếu mô-đun dự án (project.js) — nạp project.js trước zip.js", "no_project"); return CS.project; }
  function mb(n) { return Math.round(n / 104857.6) / 10 + " MB"; }

  /* ------------------------------------------------------------------ CRC-32 */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  /** CRC-32 (không dấu) của một mảng byte (hoặc chuỗi → UTF-8). `prev` để tính nối tiếp. */
  function crc32(bytes, prev) {
    if (typeof bytes === "string") bytes = utf8Encode(bytes);
    var c = prev === undefined ? 0xffffffff : ((prev ^ 0xffffffff) >>> 0);
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* ------------------------------------------------------------------ UTF-8 */
  var encoder = null, lenientDecoder = null, strictDecoder = null, strictTried = false;
  function utf8Encode(str) {
    str = String(str);
    if (typeof TextEncoder === "function") { if (!encoder) encoder = new TextEncoder(); return encoder.encode(str); }
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { c = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00); }
      else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  /** Giải mã UTF-8 thủ công. strict = true: byte sai → null. Không strict: mỗi byte sai thành U+FFFD. */
  function manualDecode(b, strict) {
    var parts = [], buf = [], i = 0, n = b.length;
    function flush() { if (buf.length) { parts.push(String.fromCharCode.apply(null, buf)); buf = []; } }
    function put(cp) {
      if (cp >= 0x10000) { cp -= 0x10000; buf.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); } else buf.push(cp);
      if (buf.length > 4000) flush();
    }
    while (i < n) {
      var c = b[i], need = 0, cp = 0, min = 0;
      if (c < 0x80) { put(c); i++; continue; }
      if (c >= 0xc2 && c <= 0xdf) { need = 1; cp = c & 0x1f; min = 0x80; }
      else if (c >= 0xe0 && c <= 0xef) { need = 2; cp = c & 0x0f; min = 0x800; }
      else if (c >= 0xf0 && c <= 0xf4) { need = 3; cp = c & 0x07; min = 0x10000; }
      else { if (strict) return null; put(0xfffd); i++; continue; }
      var ok = i + need < n;                  // đủ byte nối tiếp
      for (var k = 1; ok && k <= need; k++) { var d = b[i + k]; if ((d & 0xc0) !== 0x80) ok = false; else cp = (cp << 6) | (d & 0x3f); }
      if (ok && (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff))) ok = false;
      if (!ok) { if (strict) return null; put(0xfffd); i++; continue; }
      put(cp); i += need + 1;
    }
    flush();
    return parts.join("");
  }
  /** Giải mã UTF-8, byte sai → U+FFFD. Giữ nguyên BOM. */
  function utf8Decode(bytes) {
    if (typeof TextDecoder === "function") {
      if (!lenientDecoder) lenientDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
      return lenientDecoder.decode(bytes);
    }
    return manualDecode(bytes, false);
  }
  /** Giải mã UTF-8 nghiêm ngặt: chuỗi, hoặc null nếu không phải UTF-8 hợp lệ. */
  function utf8DecodeStrict(bytes) {
    if (typeof TextDecoder === "function" && !strictTried) {
      strictTried = true;
      try { strictDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }); } catch (e) { strictDecoder = null; }
    }
    if (strictDecoder) { try { return strictDecoder.decode(bytes); } catch (e) { return null; } }
    return manualDecode(bytes, true);
  }
  function cp437(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += bytes[i] < 0x80 ? String.fromCharCode(bytes[i]) : CP437_HIGH.charAt(bytes[i] - 0x80);
    return s;
  }

  /* ------------------------------------------------------------------ đường dẫn mục zip */
  /** Làm sạch tên mục: `\` → `/`, bỏ `.` và `//`; từ chối `..`, tuyệt đối, ổ đĩa (C:), NUL. → {path, dir} | {error} */
  function cleanEntryPath(raw) {
    var s = String(raw);
    if (s.indexOf("\u0000") >= 0) return { error: "tên chứa ký tự NUL" };
    s = s.replace(/\\/g, "/");
    if (s.charAt(0) === "/" || /^[A-Za-z]:/.test(s)) return { error: "đường dẫn tuyệt đối/ổ đĩa (chặn zip-slip)" };
    var dir = s.charAt(s.length - 1) === "/", parts = s.split("/"), out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === "" || p === ".") continue;
      if (p === "..") return { error: "đường dẫn chứa '..' (chặn zip-slip)" };
      out.push(p);
    }
    if (!out.length) return { error: "tên rỗng" };
    return { path: out.join("/"), dir: dir };
  }
  /** Mục rác của hệ điều hành/công cụ: bỏ qua im lặng. */
  function isJunk(path) {
    var parts = path.split("/"), base = parts[parts.length - 1];
    if (parts.indexOf("__MACOSX") >= 0 || parts.indexOf(".git") >= 0) return true;
    return base === ".DS_Store" || base.toLowerCase() === "thumbs.db";
  }

  /* ------------------------------------------------------------------ ghi */
  function toBytes(v) {
    if (v == null) return new Uint8Array(0);
    if (typeof v === "string") return utf8Encode(v);
    if (v instanceof Uint8Array) return v;
    if (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer) return new Uint8Array(v);
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    throw fail("Nội dung tệp phải là chuỗi hoặc Uint8Array", "bad_content");
  }
  function dosStamp(date) {
    var d = date instanceof Date ? date : (typeof date === "number" && isFinite(date) ? new Date(date) : new Date());
    if (isNaN(d.getTime())) d = new Date();
    var y = d.getFullYear();
    if (y < 1980) return { date: (1 << 5) | 1, time: 0 };
    if (y > 2107) y = 2107;
    return { date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1) };
  }

  /**
   * Tạo .zip (STORE). entries: [{path, content: string|Uint8Array}] — path kết thúc `/` là thư mục (không dữ liệu).
   * opts.date: Date | mili-giây — thời điểm ghi vào mọi mục (mặc định: bây giờ). → Uint8Array
   */
  function create(entries, opts) {
    if (!Array.isArray(entries)) throw fail("create cần một mảng mục [{path, content}]", "bad_entries");
    var stamp = dosStamp(opts && opts.date), seen = Object.create(null), list = [], total = 22;
    entries.forEach(function (e) {
      if (!e || typeof e.path !== "string") throw fail("Mỗi mục zip cần path là chuỗi", "bad_entries");
      var c = cleanEntryPath(e.path);
      if (c.error) throw fail("Đường dẫn '" + e.path + "' không đưa vào zip được: " + c.error, "bad_path");
      var isDir = c.dir, name = isDir ? c.path + "/" : c.path;
      if (seen[name]) throw fail("Trùng đường dẫn trong zip: '" + name + "'", "bad_entries");
      seen[name] = 1;
      var nameBytes = utf8Encode(name);
      if (nameBytes.length > 0xffff) throw fail("Tên mục quá dài: '" + name.slice(0, 60) + "…'", "bad_path");
      var data = isDir ? new Uint8Array(0) : toBytes(e.content);
      if (data.length > 0xffffffff) throw fail("Tệp '" + name + "' quá lớn cho .zip (chưa hỗ trợ ZIP64)", "zip64");
      list.push({ name: nameBytes, data: data, dir: isDir, crc: isDir ? 0 : crc32(data), offset: 0 });
      total += 30 + nameBytes.length + data.length + 46 + nameBytes.length;
    });
    if (list.length > 0xffff) throw fail("Quá 65.535 mục trong một .zip (chưa hỗ trợ ZIP64)", "zip64");
    if (total > 0xffffffff) throw fail("Zip lớn hơn 4 GB (chưa hỗ trợ ZIP64)", "zip64");
    var out = new Uint8Array(total), dv = new DataView(out.buffer), pos = 0;
    list.forEach(function (f) {
      f.offset = pos;
      dv.setUint32(pos, SIG_LOCAL, true);
      dv.setUint16(pos + 4, 20, true);                 // version cần để giải nén
      dv.setUint16(pos + 6, 0x0800, true);             // cờ: tên UTF-8
      dv.setUint16(pos + 8, 0, true);                  // STORE
      dv.setUint16(pos + 10, stamp.time, true);
      dv.setUint16(pos + 12, stamp.date, true);
      dv.setUint32(pos + 14, f.crc, true);
      dv.setUint32(pos + 18, f.data.length, true);
      dv.setUint32(pos + 22, f.data.length, true);
      dv.setUint16(pos + 26, f.name.length, true);
      dv.setUint16(pos + 28, 0, true);
      out.set(f.name, pos + 30);
      out.set(f.data, pos + 30 + f.name.length);
      pos += 30 + f.name.length + f.data.length;
    });
    var cdStart = pos;
    list.forEach(function (f) {
      dv.setUint32(pos, SIG_CD, true);
      dv.setUint16(pos + 4, 0x0314, true);             // tạo bởi: UNIX, 2.0 (để quyền tệp có nghĩa)
      dv.setUint16(pos + 6, 20, true);
      dv.setUint16(pos + 8, 0x0800, true);
      dv.setUint16(pos + 10, 0, true);
      dv.setUint16(pos + 12, stamp.time, true);
      dv.setUint16(pos + 14, stamp.date, true);
      dv.setUint32(pos + 16, f.crc, true);
      dv.setUint32(pos + 20, f.data.length, true);
      dv.setUint32(pos + 24, f.data.length, true);
      dv.setUint16(pos + 28, f.name.length, true);
      dv.setUint16(pos + 30, 0, true);                 // extra
      dv.setUint16(pos + 32, 0, true);                 // comment
      dv.setUint16(pos + 34, 0, true);                 // đĩa
      dv.setUint16(pos + 36, 0, true);                 // thuộc tính nội bộ
      dv.setUint32(pos + 38, f.dir ? (((0o040755 << 16) | 0x10) >>> 0) : ((0o100644 << 16) >>> 0), true);
      dv.setUint32(pos + 42, f.offset, true);
      out.set(f.name, pos + 46);
      pos += 46 + f.name.length;
    });
    dv.setUint32(pos, SIG_EOCD, true);
    dv.setUint16(pos + 4, 0, true);
    dv.setUint16(pos + 6, 0, true);
    dv.setUint16(pos + 8, list.length, true);
    dv.setUint16(pos + 10, list.length, true);
    dv.setUint32(pos + 12, pos - cdStart, true);
    dv.setUint32(pos + 16, cdStart, true);
    dv.setUint16(pos + 20, 0, true);
    return out;
  }

  /* ------------------------------------------------------------------ đọc */
  function concatChunks(chunks, total) {
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }
  function limitError(limit) {
    var e = fail("Tệp nén giải ra lớn hơn mức cho phép (" + mb(limit) + ") — nghi zip bomb", "zip_bomb");
    e.limitHit = true;
    return e;
  }
  /** DEFLATE thô → byte, dừng ngay khi vượt `limit` byte (chặn zip bomb). */
  function defaultInflateRaw(data, limit) {
    if (typeof DecompressionStream !== "function")
      return Promise.reject(fail("Trình duyệt này chưa giải nén được .zip có nén (thiếu DecompressionStream) — hãy cập nhật trình duyệt hoặc dùng zip không nén", "no_inflate"));
    var ds, writer, reader;
    try { ds = new DecompressionStream("deflate-raw"); writer = ds.writable.getWriter(); reader = ds.readable.getReader(); }
    catch (e) { return Promise.reject(fail("Trình duyệt này không hỗ trợ giải nén deflate-raw", "no_inflate")); }
    writer.write(data).then(function () { return writer.close(); }).catch(noop);
    var chunks = [], total = 0;
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return concatChunks(chunks, total);
        total += r.value.length;
        if (limit > 0 && total > limit) { reader.cancel().catch(noop); writer.abort().catch(noop); throw limitError(limit); }
        chunks.push(r.value);
        return pump();
      });
    }
    return pump();
  }
  function isLimitError(e) {
    return !!e && (e.limitHit === true || e.code === "ERR_BUFFER_TOO_LARGE" || e.code === "zip_bomb");
  }

  /**
   * Đọc .zip → Promise<entries>. entries là MẢNG [{path, data:Uint8Array, dir:boolean}] có thêm entries.skipped = [{path, reason}].
   * opts: {inflateRaw(Uint8Array, limit) → Promise<Uint8Array>, maxTotal = 50 MB, maxEntries = 2000}
   * Từ chối cả zip (Error tiếng Việt): không phải zip, mã hoá, ZIP64, nhiều phần, quá nhiều mục, vượt maxTotal (khai báo hoặc thực tế).
   * Bỏ qua mục + ghi `skipped`: đường dẫn nguy hiểm (.., tuyệt đối, ổ đĩa), phương thức nén lạ, dữ liệu hỏng/sai CRC.
   * Mục rác (__MACOSX/, .DS_Store, Thumbs.db, .git/) bị bỏ im lặng.
   */
  async function read(input, opts) {
    opts = opts || {};
    var maxTotal = opts.maxTotal > 0 ? opts.maxTotal : DEFAULT_MAX_TOTAL;
    var maxEntries = opts.maxEntries > 0 ? opts.maxEntries : DEFAULT_MAX_ENTRIES;
    var inflate = typeof opts.inflateRaw === "function" ? opts.inflateRaw : defaultInflateRaw;
    var bytes = toBytesIn(input), len = bytes.length;
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    function u16(o) { return dv.getUint16(o, true); }
    function u32(o) { return dv.getUint32(o, true); }

    if (len < 22) throw fail("Không phải tệp .zip hợp lệ (quá ngắn)", "not_zip");
    var eocd = -1;
    for (var p = len - 22, minPos = Math.max(0, len - 22 - 0xffff); p >= minPos; p--) {
      if (u32(p) === SIG_EOCD && p + 22 + u16(p + 20) <= len) { eocd = p; break; }
    }
    if (eocd < 0) throw fail("Không phải tệp .zip hợp lệ (không thấy phần cuối của zip) — tệp bị cắt cụt hoặc không phải zip", "not_zip");
    if (eocd >= 20 && u32(eocd - 20) === SIG_Z64_LOC) throw fail("Zip dạng ZIP64 (tệp rất lớn) — Code Studio chưa hỗ trợ", "zip64");
    var disk = u16(eocd + 4), cdDisk = u16(eocd + 6), total = u16(eocd + 10), cdSize = u32(eocd + 12), cdOff = u32(eocd + 16);
    if (cdSize === 0xffffffff || cdOff === 0xffffffff) throw fail("Zip dạng ZIP64 (tệp rất lớn) — Code Studio chưa hỗ trợ", "zip64");
    if (disk !== 0 || cdDisk !== 0) throw fail("Zip chia thành nhiều phần — Code Studio chưa hỗ trợ", "multi_disk");
    if (total > maxEntries) throw fail("Zip có " + total + " mục — quá nhiều (tối đa " + maxEntries + ")", "too_many");
    var result = [];
    result.skipped = [];
    if (total === 0) return result;
    if (cdOff + cdSize > eocd) throw fail("Zip bị hỏng (danh mục tệp nằm sai chỗ)", "corrupt");

    /* 1. đọc danh mục (central directory) */
    var cd = [], off = cdOff, i;
    for (i = 0; i < total; i++) {
      if (off + 46 > len || u32(off) !== SIG_CD) throw fail("Zip bị hỏng (danh mục tệp sai ở mục thứ " + (i + 1) + ")", "corrupt");
      var nameLen = u16(off + 28), extraLen = u16(off + 30), commentLen = u16(off + 32), next = off + 46 + nameLen + extraLen + commentLen;
      if (next > len) throw fail("Zip bị hỏng (mục thứ " + (i + 1) + " vượt quá tệp)", "corrupt");
      cd.push({ flags: u16(off + 8), method: u16(off + 10), crc: u32(off + 16), csize: u32(off + 20), usize: u32(off + 24), localOff: u32(off + 42),
        nameBytes: bytes.subarray(off + 46, off + 46 + nameLen), extra: bytes.subarray(off + 46 + nameLen, off + 46 + nameLen + extraLen) });
      off = next;
    }

    /* 2. chọn mục cần giải nén, kiểm khai báo */
    var plan = [], declared = 0;
    cd.forEach(function (e) {
      var name = decodeName(e);
      var c = cleanEntryPath(name);
      if (c.error) { result.skipped.push({ path: name, reason: c.error }); return; }
      if (isJunk(c.path)) return;
      if (c.dir) { result.push({ path: c.path, data: new Uint8Array(0), dir: true }); return; }
      if ((e.flags & 1) || (e.flags & 0x40)) throw fail("Tệp zip có mã hoá bằng mật khẩu — Code Studio chưa hỗ trợ (hãy giải mã rồi nén lại)", "encrypted");
      if (e.csize === 0xffffffff || e.usize === 0xffffffff || e.localOff === 0xffffffff) throw fail("Zip dạng ZIP64 (tệp rất lớn) — Code Studio chưa hỗ trợ", "zip64");
      if (e.method !== 0 && e.method !== 8) { result.skipped.push({ path: c.path, reason: "phương thức nén " + e.method + " chưa hỗ trợ (chỉ STORE và DEFLATE)" }); return; }
      declared += e.usize;
      if (declared > maxTotal) throw fail("Giải nén sẽ vượt " + mb(maxTotal) + " (khai báo " + mb(declared) + ") — từ chối zip này", "too_big");
      var slot = { path: c.path, data: null, dir: false };
      result.push(slot);                      // giữ đúng thứ tự trong zip; bị bỏ qua thì gỡ ở cuối
      plan.push({ e: e, path: c.path, slot: slot });
    });

    /* 3. giải nén lần lượt (bộ nhớ tăng dần, có trần) */
    var used = 0;
    for (i = 0; i < plan.length; i++) {
      var ent = plan[i].e, path = plan[i].path, slot = plan[i].slot, lo = ent.localOff;
      slot.drop = true;
      if (lo + 30 > len || u32(lo) !== SIG_LOCAL) { result.skipped.push({ path: path, reason: "tiêu đề cục bộ hỏng" }); continue; }
      var start = lo + 30 + u16(lo + 26) + u16(lo + 28);
      if (start + ent.csize > len) { result.skipped.push({ path: path, reason: "dữ liệu bị cắt cụt" }); continue; }
      var comp = bytes.subarray(start, start + ent.csize), data;
      if (ent.method === 0) {
        if (ent.csize !== ent.usize) { result.skipped.push({ path: path, reason: "kích thước không khớp (zip hỏng)" }); continue; }
        data = comp.slice();
      } else {
        var limit = Math.max(1, Math.min(ent.usize, maxTotal - used));
        try { data = await inflate(comp, limit); }
        catch (err) {
          if (isLimitError(err)) throw fail("Tệp '" + path + "' giải nén ra lớn hơn khai báo — nghi zip bomb, từ chối zip này", "zip_bomb");
          if (err && err.code === "no_inflate") throw err;
          result.skipped.push({ path: path, reason: "dữ liệu nén hỏng" });
          continue;
        }
        data = toBytesIn(data);
        if (data.length > ent.usize) throw fail("Tệp '" + path + "' giải nén ra " + data.length + " byte nhưng khai báo " + ent.usize + " — nghi zip bomb, từ chối zip này", "zip_bomb");
        if (data.length !== ent.usize) { result.skipped.push({ path: path, reason: "kích thước sau giải nén không khớp (zip hỏng)" }); continue; }
      }
      used += data.length;
      if (used > maxTotal) throw fail("Giải nén vượt " + mb(maxTotal) + " — từ chối zip này", "too_big");
      if (crc32(data) !== ent.crc) { result.skipped.push({ path: path, reason: "sai CRC (tệp hỏng)" }); continue; }
      slot.data = data;
      slot.drop = false;
    }
    var final = result.filter(function (x) { return !x.drop; });
    final.forEach(function (x) { delete x.drop; });
    final.skipped = result.skipped;
    return final;
  }
  function toBytesIn(v) {
    if (v instanceof Uint8Array) return v;
    if (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer) return new Uint8Array(v);
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    throw fail("Dữ liệu zip phải là Uint8Array hoặc ArrayBuffer", "bad_input");
  }
  /** Tên mục: cờ UTF-8 → UTF-8; Info-ZIP Unicode Path (0x7075) nếu CRC khớp; không cờ → thử UTF-8 nghiêm ngặt, không được → CP437. */
  function decodeName(e) {
    var b = e.nameBytes;
    var ex = e.extra, o = 0;
    while (o + 4 <= ex.length) {
      var id = ex[o] | (ex[o + 1] << 8), sz = ex[o + 2] | (ex[o + 3] << 8);
      if (id === 0x7075 && sz >= 5 && o + 4 + sz <= ex.length && ex[o + 4] === 1) {
        var want = (ex[o + 5] | (ex[o + 6] << 8) | (ex[o + 7] << 16) | (ex[o + 8] << 24)) >>> 0;
        if (want === crc32(b)) { var u = utf8DecodeStrict(ex.subarray(o + 9, o + 4 + sz)); if (u) return u; }
      }
      o += 4 + sz;
    }
    if (e.flags & 0x0800) return utf8Decode(b);
    var s = utf8DecodeStrict(b);
    return s === null ? cp437(b) : s;
  }

  /* ------------------------------------------------------------------ dự án ↔ zip */
  function strArr(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }) : []; }

  /**
   * Item → .zip: mọi tệp (đường dẫn gốc), thư mục rỗng (meta.folders → mục `x/`), và `.code-studio.json` ghi cấu hình
   * (name, language, mainFile, std, opt, stdin, args…) để nhập lại giữ nguyên. → Uint8Array
   */
  function projectToZip(item) {
    var it = item || {}, meta = isObj(it.meta) ? it.meta : {}, P = CS.project;
    var files = Array.isArray(it.files) ? it.files : [];
    var entries = files.map(function (f) { return { path: f.path, content: f.content == null ? "" : String(f.content) }; });
    strArr(meta.folders).forEach(function (d) { entries.push({ path: d.replace(/\/+$/, "") + "/" }); });
    var taken = Object.create(null);
    files.forEach(function (f) { taken[String(f.path)] = 1; });
    if (!taken[CONFIG_NAME]) {
      var main = P && P.mainFileOf ? P.mainFileOf(it) : meta.mainFile;
      var cfg = { app: "code-studio", version: 1, name: it.name || "", language: it.language || "", kind: it.kind || "project", mainFile: main || meta.mainFile || "" };
      if (typeof meta.std === "string") cfg.std = meta.std;
      if (typeof meta.opt === "string") cfg.opt = meta.opt;
      if (typeof meta.stdin === "string") cfg.stdin = meta.stdin;
      cfg.args = strArr(meta.args);
      cfg.compileArgs = strArr(meta.compileArgs);
      if (typeof meta.javaMain === "string" && meta.javaMain) cfg.javaMain = meta.javaMain;
      entries.push({ path: CONFIG_NAME, content: JSON.stringify(cfg, null, 2) + "\n" });
    }
    return create(entries, { date: it.updatedAt > 0 ? it.updatedAt : undefined });
  }

  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  /** ngôn ngữ có nhiều tệp nhất theo đuôi (bỏ markdown/json/văn bản khi còn ngôn ngữ khác); .h theo c/cpp đang có */
  function detectLanguage(paths) {
    var L = CS.langs;
    if (!L) return "plaintext";
    var count = Object.create(null), headers = 0;
    paths.forEach(function (p) {
      if (/\.h$/i.test(p)) { headers++; return; }
      var id = L.byFilename(p);
      count[id] = (count[id] || 0) + 1;
    });
    if (headers) { var host = count.cpp ? "cpp" : "c"; count[host] = (count[host] || 0) + headers; }   // .h theo ngôn ngữ nguồn đang có
    var weak = { markdown: 1, json: 1, plaintext: 1 }, best = "", bestN = 0, strong = Object.keys(count).filter(function (k) { return !weak[k]; });
    var pool = strong.length ? strong : Object.keys(count);
    var order = L.order || [];
    pool.sort(function (a, b) { return count[b] - count[a] || order.indexOf(a) - order.indexOf(b); });
    if (pool.length) { best = pool[0]; bestN = count[best]; }
    return bestN ? best : "plaintext";
  }

  /**
   * Các mục đọc từ zip → item chuẩn của app (CS.project.normalize). Bỏ qua tệp nhị phân (có NUL, hoặc không phải UTF-8),
   * tệp > 512 KB, tên không hợp lệ/trùng, tệp thứ 201 trở đi — ghi vào item.meta.skipped (≤ 20 mục, ≤ 8 KB) + meta.skippedTotal.
   * Bỏ thư mục gốc chung duy nhất; đọc `.code-studio.json` nếu có. kind = "snippet" nếu đúng 1 tệp, ngược lại "project".
   * opts: {name, id, now}. Không tệp nào dùng được → ném Error tiếng Việt.
   */
  function zipToProject(entries, opts) {
    opts = opts || {};
    var P = project();
    var list = Array.isArray(entries) ? entries : (entries && Array.isArray(entries.entries) ? entries.entries : null);
    if (!list) throw fail("zipToProject cần mảng mục do CS.zip.read trả về", "bad_entries");
    var skipped = (list.skipped || []).map(function (s) { return { path: s.path, reason: s.reason }; });
    var items = [];
    list.forEach(function (e) {
      if (!e || typeof e.path !== "string") return;
      var c = cleanEntryPath(e.path);
      if (c.error) { skipped.push({ path: e.path, reason: c.error }); return; }
      if (isJunk(c.path)) return;
      items.push({ path: c.path, dir: !!e.dir || c.dir, data: e.data });
    });

    /* thư mục gốc chung duy nhất → bỏ */
    var rootName = "";
    if (items.length) {
      var first = items[0].path.split("/")[0], same = true;
      for (var k = 0; k < items.length && same; k++) {
        var segs = items[k].path.split("/");
        if (segs[0] !== first || (segs.length === 1 && !items[k].dir)) same = false;
      }
      if (same) {
        rootName = first;
        items = items.filter(function (x) { return x.path !== first; }).map(function (x) { return { path: x.path.slice(first.length + 1), dir: x.dir, data: x.data }; });
      }
    }

    /* cấu hình của chính Code Studio */
    var config = null;
    items = items.filter(function (x) {
      if (x.dir || x.path !== CONFIG_NAME || !x.data) return true;
      var text = utf8DecodeStrict(x.data), j = null;
      try { j = text === null ? null : JSON.parse(text); } catch (e) { j = null; }
      if (isObj(j) && j.app === "code-studio") { config = j; return false; }
      return true;
    });

    var files = [], folders = [], lower = Object.create(null), dirs = Object.create(null), tooMany = 0;
    function ancestorsOf(p) { var parts = p.split("/"), out = []; for (var i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/").toLowerCase()); return out; }
    items.forEach(function (x) {
      var path;
      try { path = P.normPath(x.path, { store: true }); }
      catch (e) { skipped.push({ path: x.path, reason: "tên không hợp lệ: " + e.message.replace(/^Đường dẫn '[^']*' /, "") }); return; }
      if (x.dir) { folders.push(path); return; }
      var data = x.data || new Uint8Array(0);
      if (data.length > FILE_MAX_BYTES) { skipped.push({ path: path, reason: "lớn hơn 512 KB (" + mb(data.length) + ")" }); return; }
      if (data.indexOf(0) >= 0) { skipped.push({ path: path, reason: "tệp nhị phân" }); return; }
      var text = utf8DecodeStrict(data);
      if (text === null) { skipped.push({ path: path, reason: "không phải văn bản UTF-8 (nhị phân?)" }); return; }
      var key = path.toLowerCase();
      if (lower[key]) { skipped.push({ path: path, reason: "trùng tên với '" + lower[key] + "'" }); return; }
      if (dirs[key]) { skipped.push({ path: path, reason: "trùng tên một thư mục" }); return; }
      var anc = ancestorsOf(path), clash = false;
      anc.forEach(function (a) { if (lower[a]) clash = true; });
      if (clash) { skipped.push({ path: path, reason: "nằm trong một tệp trùng tên thư mục" }); return; }
      if (files.length >= PROJECT_MAX_FILES) { skipped.push({ path: path, reason: "quá " + PROJECT_MAX_FILES + " tệp" }); return; }
      lower[key] = path;
      anc.forEach(function (a) { dirs[a] = 1; });
      files.push({ path: path, content: text });
    });
    if (!files.length) {
      var why = skipped.length ? " (" + skipped.length + " mục bị bỏ qua: tệp nhị phân, quá lớn hoặc tên không hợp lệ)" : "";
      throw fail("Tệp zip không có tệp mã nguồn nào dùng được" + why, "no_files");
    }

    var cfg = config || {};
    var language = typeof cfg.language === "string" && /^[A-Za-z0-9_+#.-]{1,32}$/.test(cfg.language) ? cfg.language : detectLanguage(files.map(function (f) { return f.path; }));
    var meta = { folders: folders };
    if (typeof cfg.mainFile === "string" && files.some(function (f) { return f.path === cfg.mainFile; })) meta.mainFile = cfg.mainFile;
    if (typeof cfg.std === "string") meta.std = cfg.std;
    if (typeof cfg.opt === "string") meta.opt = cfg.opt;
    if (typeof cfg.stdin === "string") meta.stdin = cfg.stdin;
    if (Array.isArray(cfg.args)) meta.args = strArr(cfg.args);
    if (Array.isArray(cfg.compileArgs)) meta.compileArgs = strArr(cfg.compileArgs);
    if (typeof cfg.javaMain === "string") meta.javaMain = cfg.javaMain;

    var name = (typeof cfg.name === "string" && cfg.name.trim()) || (typeof opts.name === "string" && opts.name.trim()) || rootName || "Dự án nhập";
    var item = { id: opts.id || P.newId(), kind: files.length === 1 ? "snippet" : "project", name: name, language: language, files: files, meta: meta,
      updatedAt: opts.now > 0 ? Math.floor(opts.now) : 0, deleted: false };
    if (item.kind === "snippet") meta.folders = [];            // đoạn mã không có thư mục (như CS.project.asSnippet)
    var q = P.normalize(item);
    if (!q.meta.openTabs.length && q.meta.mainFile) { q.meta.openTabs = [q.meta.mainFile]; q.meta.activeFile = q.meta.mainFile; }
    if (skipped.length) {
      var out = skipped.slice(0, SKIPPED_MAX).map(function (s) { return { path: clip(s.path, 120), reason: clip(s.reason, 100) }; });
      var base = P.pyJsonBytes(q.meta) + 60;
      while (out.length && base + P.pyJsonBytes(out) > META_MAX_BYTES) out.pop();
      q.meta.skippedTotal = skipped.length;
      q.meta.skipped = out;
    }
    return q;
  }

  CS.zip = {
    create: create, read: read, crc32: crc32, utf8Encode: utf8Encode, utf8Decode: utf8Decode, utf8DecodeStrict: utf8DecodeStrict,
    projectToZip: projectToZip, zipToProject: zipToProject, cleanEntryPath: cleanEntryPath, detectLanguage: detectLanguage,
    CONFIG_NAME: CONFIG_NAME, limits: { maxTotal: DEFAULT_MAX_TOTAL, maxEntries: DEFAULT_MAX_ENTRIES, fileBytes: FILE_MAX_BYTES, files: PROJECT_MAX_FILES }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.zip;
})(typeof globalThis !== "undefined" ? globalThis : this);
