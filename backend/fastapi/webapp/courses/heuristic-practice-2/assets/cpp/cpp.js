/* Trình biên dịch + chạy C/C++ NGAY TRONG TRÌNH DUYỆT — không máy chủ, không cài đặt.
   Biên dịch: Clang/LLD biên dịch sang WebAssembly (gói @yowasp/clang, giấy phép ISC, nạp từ jsDelivr đúng phiên bản,
   ~25 MB truyền tải / ~105 MB giải nén, lần đầu mới cần; được lưu vào Cache Storage để lần sau dùng offline).
   Chạy: mô-đun .wasm chạy trong một Web Worker riêng với WASI tối thiểu tự viết (stdin/stdout/stderr, đồng hồ, ngẫu nhiên);
   quá giờ thì giết hẳn worker (vòng lặp vô hạn không treo trang). Đây là phần DUY NHẤT của trang phụ thuộc bên thứ ba.
   Giới hạn của gói thư viện chuẩn: không ngoại lệ (try/catch/throw), không luồng, không tệp. Stack 8 MB, bộ nhớ ≤ 512 MB.

   TH.cpp.bienDich({ma, ngon, chuan, toiUu, tienDo}) → Promise<{ok, wasm, chuanDoan[], stderr, ms}>
   TH.cpp.batDauChay(wasm, stdin, {hanMs, khiOut, khiErr}) → {xong: Promise<{ok, out, err, code, ms, hetGio, loi}>, dung()}
   TH.cpp.trinhChayLab(ma, {hanNhan, tienDo}) → hàm (input, {gioiHan}) cho TH.cham.chayLab */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});

  var PHIEN_BAN = "22.0.0-git20542-10";
  var URL_CLANG = "https://cdn.jsdelivr.net/npm/@yowasp/clang@" + PHIEN_BAN + "/gen/bundle.js";
  var TEN_CACHE = "th2-clang-" + PHIEN_BAN;
  var STACK = 8 * 1024 * 1024, BO_NHO_TOI_DA = 512 * 1024 * 1024;
  var MA_CHUAN = { "c++11": "-std=c++11", "c++14": "-std=c++14", "c++17": "-std=c++17", "c++20": "-std=c++20", "c11": "-std=c11", "c17": "-std=c17" };

  /* libc++ của gói không có bits/stdc++.h — cấp một bản giả để mã thi đấu quen thuộc biên dịch được. */
  var STDCPP = ["algorithm", "array", "bitset", "cassert", "cctype", "chrono", "climits", "cmath", "complex", "cstdint", "cstdio", "cstdlib", "cstring",
    "ctime", "deque", "functional", "iomanip", "iostream", "iterator", "limits", "list", "map", "memory", "numeric", "optional", "queue", "random",
    "set", "sstream", "stack", "string", "tuple", "unordered_map", "unordered_set", "utility", "vector"].map(function (h) { return "#include <" + h + ">"; }).join("\n") + "\n";

  /* ------------------------------ worker biên dịch ------------------------------ */
  function workerBienDich() {
    var runClang = null, tai = null;
    var cu = self.console.log.bind(self.console);
    self.console.log = function () {
      var m = /fetched (\d+)% \((\d+) \/ (\d+)\)/.exec(String(arguments[0]));
      if (m) self.postMessage({ t: "tai", pct: +m[1], da: +m[2], tong: +m[3] });
      else cu.apply(null, arguments);
    };
    var that = self.fetch.bind(self), TEN = "";
    self.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && (input.href || input.url)) || String(input);
      if (!/\/npm\/@yowasp\/clang@[^/]+\/gen\//.test(url) || typeof caches === "undefined" || (init && init.method && init.method !== "GET"))
        return that(input, init);
      return caches.open(TEN).then(function (c) {
        return c.match(url).then(function (hit) {
          if (hit) { self.postMessage({ t: "cache", url: url }); return hit; }
          return that(input, init).then(function (res) {
            if (res && res.ok && res.status === 200) { try { c.put(url, res.clone()).catch(function () { /* hết chỗ lưu */ }); } catch (e) { /* bỏ qua */ } }
            return res;
          });
        });
      }).catch(function () { return that(input, init); });
    };
    self.onmessage = function (e) {
      var d = e.data, err = "";
      TEN = d.tenCache;
      Promise.resolve().then(function () {
        if (runClang) return null;
        return import(d.url).then(function (m) { runClang = m.runClang; });
      }).then(function () {
        var t0 = performance.now();
        return runClang(d.args, d.files, {
          stdout: function () {},
          stderr: function (b) { err += typeof b === "string" ? b : new TextDecoder().decode(b || new Uint8Array()); }
        }).then(function (out) {
          var w = out["main.wasm"];
          self.postMessage({ t: "xong", id: d.id, ok: true, ms: performance.now() - t0, wasm: w, err: err }, w ? [w.buffer] : []);
        });
      }).catch(function (er) {
        var msg = String(er && er.message || er), mang = /^Exited with status/.test(msg) === false;
        if (mang) runClang = null;            /* lỗi nạp/mạng: lần sau nạp lại từ đầu */
        self.postMessage({ t: "xong", id: d.id, ok: false, loiMang: mang, loi: msg, err: err });
      });
    };
  }

  /* ------------------------------ worker chạy .wasm ------------------------------ */
  function workerChay() {
    self.onmessage = function (e) {
      var d = e.data, mem, inp = new TextEncoder().encode(d.stdin || ""), pos = 0, bat = performance.now();
      var decO = new TextDecoder(), decE = new TextDecoder(), bo = { out: "", err: "" }, tongO = 0, tongE = 0, lanCuoi = bat, CAP = 1048576;
      function flush() {
        if (bo.out) { self.postMessage({ t: "out", s: bo.out }); bo.out = ""; }
        if (bo.err) { self.postMessage({ t: "err", s: bo.err }); bo.err = ""; }
        lanCuoi = performance.now();
      }
      function viet(kenh, bytes) {
        var s = (kenh === 1 ? decO : decE).decode(bytes, { stream: true });
        if (kenh === 1) { if (tongO < CAP) { tongO += s.length; bo.out += s; if (tongO >= CAP) bo.out += "\n[… đầu ra bị cắt ở 1 MB]\n"; } }
        else if (tongE < CAP) { tongE += s.length; bo.err += s; }
        if (bo.out.length > 65536 || performance.now() - lanCuoi > 80) flush();
      }
      var DV = function () { return new DataView(mem.buffer); };
      var wasi = {
        args_get: function () { return 0; },
        args_sizes_get: function (a, b) { var v = DV(); v.setUint32(a, 0, true); v.setUint32(b, 0, true); return 0; },
        environ_get: function () { return 0; },
        environ_sizes_get: function (a, b) { var v = DV(); v.setUint32(a, 0, true); v.setUint32(b, 0, true); return 0; },
        clock_time_get: function (id, prec, out) {
          var ns = id === 0 ? BigInt(Date.now()) * 1000000n : BigInt(Math.round((performance.now() - (id >= 2 ? bat : 0)) * 1e6));
          DV().setBigUint64(out, ns, true); return 0;
        },
        clock_res_get: function (id, out) { DV().setBigUint64(out, 1000n, true); return 0; },
        random_get: function (p, n) {
          for (var o = 0; o < n; o += 65536) crypto.getRandomValues(new Uint8Array(mem.buffer, p + o, Math.min(65536, n - o)));
          return 0;
        },
        fd_close: function () { return 0; },
        fd_seek: function () { return 70; },
        fd_tell: function () { return 70; },
        fd_fdstat_get: function (fd, p) { new Uint8Array(mem.buffer, p, 24).fill(0); DV().setUint8(p, fd < 3 ? 2 : 0); return fd < 3 ? 0 : 8; },
        fd_fdstat_set_flags: function () { return 0; },
        fd_prestat_get: function () { return 8; },
        fd_prestat_dir_name: function () { return 8; },
        fd_write: function (fd, iovs, n, nw) {
          if (fd !== 1 && fd !== 2) return 8;
          var v = DV(), t = 0;
          for (var i = 0; i < n; i++) {
            var p = v.getUint32(iovs + i * 8, true), l = v.getUint32(iovs + i * 8 + 4, true);
            viet(fd, new Uint8Array(mem.buffer, p, l)); t += l;
          }
          v.setUint32(nw, t, true); return 0;
        },
        fd_read: function (fd, iovs, n, nr) {
          if (fd !== 0) return 8;
          var v = DV(), t = 0;
          for (var i = 0; i < n; i++) {
            var p = v.getUint32(iovs + i * 8, true), l = v.getUint32(iovs + i * 8 + 4, true), k = Math.min(l, inp.length - pos);
            new Uint8Array(mem.buffer, p, k).set(inp.subarray(pos, pos + k)); pos += k; t += k;
          }
          v.setUint32(nr, t, true); return 0;
        },
        sched_yield: function () { return 0; },
        proc_exit: function (c) { throw { thoat: c }; }
      };
      function hoi(msg) { self.postMessage({ t: "xong", ok: false, loi: msg }); }
      WebAssembly.compile(d.wasm).then(function (mod) {
        var imp = {};                                        /* mọi hàm WASI chưa cài đều trả ENOSYS thay vì làm hỏng việc nạp */
        WebAssembly.Module.imports(mod).forEach(function (m) {
          if (m.module !== "wasi_snapshot_preview1" || m.kind !== "function") return;
          imp[m.name] = wasi[m.name] || function () { return 52; };
        });
        return WebAssembly.instantiate(mod, { wasi_snapshot_preview1: imp });
      }).then(function (inst) {
        mem = inst.exports.memory;
        var ma = 0, t0 = performance.now();
        try { inst.exports._start(); }
        catch (er) {
          if (er && er.thoat !== undefined) ma = er.thoat;
          else {
            flush();
            var m = String(er && er.message || er);
            self.postMessage({
              t: "xong", ok: false, ms: performance.now() - t0,
              loi: /unreachable/.test(m) ? "Chương trình dừng bất thường (abort / assert thất bại / lỗi chưa định nghĩa)" :
                   /out of bounds/.test(m) ? "Truy cập bộ nhớ ngoài vùng cho phép (chỉ số vượt mảng, con trỏ sai)" :
                   /call stack/.test(m) ? "Tràn ngăn xếp (đệ quy quá sâu hoặc mảng cục bộ quá lớn)" :
                   /memory/.test(m) ? "Hết bộ nhớ (giới hạn 512 MB)" : m
            });
            return;
          }
        }
        flush();
        self.postMessage({ t: "xong", ok: true, code: ma, ms: performance.now() - t0 });
      }).catch(function (er) { hoi("Không nạp được chương trình: " + String(er && er.message || er)); });
    };
  }

  /* ------------------------------ phía luồng chính ------------------------------ */
  function taoWorker(fn) {
    var url = URL.createObjectURL(new Blob(["(" + fn.toString() + ")()"], { type: "text/javascript" }));
    var w = new Worker(url);
    return w;
  }

  var wb = null, dem = 0, hang = Promise.resolve(), dangBien = null, boNho = [];
  function lay() { if (!wb) wb = taoWorker(workerBienDich); return wb; }

  function phanTichChuanDoan(text) {
    var ds = [], re = /^[^\s:][^:\n]*:(\d+):(\d+): (fatal error|error|warning|note): (.*)$/gm, m;
    while ((m = re.exec(text))) ds.push({ dong: +m[1], cot: +m[2], loai: m[3] === "fatal error" ? "error" : m[3], msg: m[4] });
    var lk = /^wasm-ld: (error|warning): (.*)$/gm;
    while ((m = lk.exec(text))) ds.push({ dong: 0, cot: 0, loai: m[1], msg: "(liên kết) " + m[2] });
    return ds;
  }

  function cacheDaCo() {
    if (typeof caches === "undefined") return Promise.resolve(false);
    return caches.open(TEN_CACHE).then(function (c) { return c.keys(); }).then(function (k) { return k.length > 0; }, function () { return false; });
  }
  function xoaCache() {
    return (typeof caches === "undefined" ? Promise.resolve(false) : caches.delete(TEN_CACHE)).then(function (x) { if (wb) { wb.terminate(); wb = null; } return x; });
  }

  /* Mỗi lần biên dịch xếp hàng nối tiếp (một worker) và có bộ nhớ đệm theo (mã + cờ). */
  function bienDich(o) {
    var ngon = o.ngon === "c" ? "c" : "cpp";
    var chuan = o.chuan || (ngon === "c" ? "c17" : "c++17"), toiUu = /^O[0-3s]$/.test(o.toiUu || "") ? o.toiUu : "O2";
    /* clock()/times() của WASI cần bản giả lập đồng hồ tiến trình (mã thi đấu hay dùng clock() để đo giờ). */
    var cacCo = ["-" + toiUu, MA_CHUAN[chuan] || MA_CHUAN["c++17"], "-Wall", "-DONLINE_JUDGE", "-D_WASI_EMULATED_PROCESS_CLOCKS"];
    var khoa = ngon + "|" + cacCo.join(" ") + "|" + o.ma;
    for (var i = 0; i < boNho.length; i++) if (boNho[i].khoa === khoa) return Promise.resolve(boNho[i].kq);
    var ten = ngon === "c" ? "main.c" : "main.cpp";
    var args = [ngon === "c" ? "clang" : "clang++"].concat(cacCo, ngon === "c" ? [] : ["-fno-exceptions"],
      ["-I.", "-Wl,-z,stack-size=" + STACK, "-Wl,--max-memory=" + BO_NHO_TOI_DA, ten, "-lwasi-emulated-process-clocks", "-o", "main.wasm"]);
    var files = { bits: { "stdc++.h": STDCPP } };
    files[ten] = o.ma;
    var p = hang.then(function () {
      return new Promise(function (xong) {
        var w = lay(), id = ++dem, t0 = performance.now(), luc = 0, dong = null;
        /* mỗi giây báo số giây đã trôi (trừ lúc đang tải trình biên dịch) — để người học biết máy không treo */
        if (o.tienDo) dong = setInterval(function () { if (performance.now() - luc > 2000) o.tienDo({ loai: "giay", giay: Math.round((performance.now() - t0) / 1000) }); }, 1000);
        function dungDong() { if (dong) { clearInterval(dong); dong = null; } }
        dangBien = function () { dungDong(); w.terminate(); if (wb === w) wb = null; xong({ ok: false, huy: true, chuanDoan: [], stderr: "", ms: 0, loi: "Đã huỷ" }); };
        w.onmessage = function (e) {
          var d = e.data;
          if (d.t === "tai") { luc = performance.now(); if (o.tienDo) o.tienDo({ loai: "tai", pct: d.pct, da: d.da, tong: d.tong }); return; }
          if (d.t === "cache") { luc = performance.now(); if (o.tienDo) o.tienDo({ loai: "cache" }); return; }
          if (d.t !== "xong" || d.id !== id) return;
          dungDong(); dangBien = null;
          var kq = { ok: !!d.ok, wasm: d.wasm || null, stderr: d.err || "", chuanDoan: phanTichChuanDoan(d.err || ""), ms: d.ms || performance.now() - t0, loiMang: !!d.loiMang };
          if (!d.ok && d.loiMang) kq.loi = "Không nạp được trình biên dịch: " + d.loi + " — kiểm tra kết nối mạng (lần đầu cần tải từ cdn.jsdelivr.net).";
          if (d.ok && !kq.wasm) { kq.ok = false; }
          if (kq.ok) { boNho.push({ khoa: khoa, kq: kq }); if (boNho.length > 8) boNho.shift(); }
          xong(kq);
        };
        w.onerror = function (ev) {
          if (ev.preventDefault) ev.preventDefault();
          dungDong(); dangBien = null; wb = null;
          xong({ ok: false, loiMang: true, chuanDoan: [], stderr: "", ms: 0, loi: "Trình biên dịch gặp lỗi: " + ((ev && ev.message) || "không rõ") });
        };
        if (o.tienDo) o.tienDo({ loai: "bat-dau" });
        w.postMessage({ id: id, url: URL_CLANG, tenCache: TEN_CACHE, args: args, files: files });
      });
    });
    hang = p.then(function () {}, function () {});
    return p;
  }
  function huyBienDich() { if (dangBien) dangBien(); }

  function batDauChay(wasm, stdin, o) {
    o = o || {};
    var w = taoWorker(workerChay), out = "", err = "", het = false, daXong = false;
    var p = new Promise(function (xong) {
      var hen = setTimeout(function () {
        het = true; daXong = true; w.terminate();
        xong({ ok: false, hetGio: true, out: out, err: err, code: null, ms: o.hanMs, loi: "Quá giờ (" + Math.round(o.hanMs) + " ms) — có thể là vòng lặp vô hạn hoặc thuật toán quá chậm" });
      }, o.hanMs || 5000);
      w.onmessage = function (e) {
        var d = e.data;
        if (d.t === "out") { out += d.s; if (o.khiOut) o.khiOut(d.s); }
        else if (d.t === "err") { err += d.s; if (o.khiErr) o.khiErr(d.s); }
        else if (d.t === "xong" && !het) {
          clearTimeout(hen); daXong = true; w.terminate();
          xong({ ok: !!d.ok, out: out, err: err, code: d.code === undefined ? null : d.code, ms: d.ms || 0, loi: d.loi || (d.code ? "Chương trình thoát với mã " + d.code : "") });
        }
      };
      w.onerror = function (ev) {
        if (ev.preventDefault) ev.preventDefault();
        if (daXong) return;
        clearTimeout(hen); daXong = true; w.terminate();
        xong({ ok: false, out: out, err: err, code: null, ms: 0, loi: (ev && ev.message) || "Trình chạy gặp lỗi" });
      };
      var sao = wasm.slice ? wasm.slice() : wasm;           /* mỗi lần chạy một bản sao (bản gốc còn để chạy lại) */
      w.postMessage({ wasm: sao, stdin: stdin });
    });
    return { xong: p, dung: function () { if (!daXong) { daXong = true; w.terminate(); } } };
  }

  /* Cho bộ chấm lab: biên dịch MỘT lần, rồi chạy từng test. Lỗi biên dịch trả về như lỗi chạy chung (dừng sớm). */
  function trinhChayLab(ma, o) {
    o = o || {};
    var bien = null;
    return function (input, c) {
      if (!bien) bien = bienDich({ ma: ma, ngon: "cpp", toiUu: o.toiUu || "O2", tienDo: o.tienDo });
      return bien.then(function (kq) {
        if (!kq.ok) {
          var loi = kq.loi || ("Lỗi biên dịch:\n" + kq.chuanDoan.filter(function (d) { return d.loai === "error"; }).slice(0, 4)
            .map(function (d) { return "dòng " + d.dong + ": " + d.msg; }).join("\n"));
          return { ok: false, loi: loi, text: "", err: kq.stderr, ms: 0, bienDichLoi: kq };
        }
        return batDauChay(kq.wasm, input, { hanMs: (c && c.gioiHan ? c.gioiHan : 1500) * (o.hanNhan || 2) }).xong.then(function (r) {
          return { ok: r.ok && !r.code, text: r.out, err: r.err, ms: r.ms, hetGio: r.hetGio, loi: r.ok && !r.code ? "" : (r.loi || "Chương trình thoát với mã " + r.code) };
        });
      });
    };
  }

  TH.cpp = {
    phienBan: PHIEN_BAN, nguon: URL_CLANG,
    bienDich: bienDich, huy: huyBienDich, batDauChay: batDauChay, trinhChayLab: trinhChayLab,
    cacheDaCo: cacheDaCo, xoaCache: xoaCache, phanTichChuanDoan: phanTichChuanDoan,
    khaDung: function () { return !!(root.Worker && root.Blob && root.WebAssembly && root.URL && root.URL.createObjectURL); }
  };
})(window);
