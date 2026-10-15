/* browser-cpp.js — biên dịch + chạy C/C++ NGAY TRONG TRÌNH DUYỆT (nơi chạy "browser", ngôn ngữ c, cpp), nhiều tệp.
   Port và tổng quát hoá từ courses/heuristic-practice-2/assets/cpp/cpp.js (không phụ thuộc không gian tên TH).
   • Biên dịch: Clang/LLD → WebAssembly (gói @yowasp/clang, giấy phép ISC) ghim phiên bản, nạp từ cdn.jsdelivr.net/npm trong một Web Worker dựng từ Blob,
     KHI người dùng chủ động chạy lần đầu (hỏi confirmDownload trước, ≈ 25 MB truyền tải / ≈ 105 MB giải nén). Tệp tải về lưu vào Cache Storage
     `cs-clang-<phiên bản>` → lần sau dùng ngay, cả khi không mạng (cần http(s); file:// không có Cache Storage thì tải lại mỗi phiên).
   • MỌI tệp .c/.cpp/.cc/.cxx của dự án (đúng đuôi ngôn ngữ) được truyền cho MỘT lệnh clang cùng các tệp .h/.hpp trong hệ tệp ảo, `-I.` và `-I<thư mục>`
     của từng tệp tiêu đề/nguồn; tệp chính đứng đầu. Chuẩn/tối ưu/cờ lấy từ req.compileArgs (đã lọc theo danh sách cho phép của backend).
   • Chạy: .wasm chạy trong một Web Worker riêng với WASI tối thiểu tự viết (stdin, stdout/stderr truyền dần, argv, đồng hồ, ngẫu nhiên, ngủ bằng chờ bận);
     quá giờ → terminate worker. Có bản giả bits/stdc++.h; bộ nhớ đệm kết quả biên dịch theo (mọi tệp + cờ) để chạy lại với stdin khác tức thì.
   • Giới hạn của thư viện chuẩn trong gói: KHÔNG ngoại lệ (try/catch/throw), không luồng, không tệp (fopen thất bại); stack 8 MB, bộ nhớ ≤ 512 MB;
     đầu ra ≤ 1 MB mỗi luồng; -pthread bị bỏ qua. Lỗi trong lúc chạy: abort/assert → tín hiệu SIGABRT, truy cập ngoài vùng/tràn stack → SIGSEGV. */
(function (root) {
  "use strict";
  if (typeof document === "undefined" && typeof Worker === "undefined") return;
  var CS = root.CS;
  if (!CS || !CS.runner) return;
  var util = CS.runner.util;

  var VERSION = "22.0.0-git20542-10";
  var URL_CLANG = "https://cdn.jsdelivr.net/npm/@yowasp/clang@" + VERSION + "/gen/bundle.js";
  var CACHE = "cs-clang-" + VERSION, MARKER = "https://cs-cache.invalid/clang-" + VERSION + "-ready";
  var STACK = 8 * 1024 * 1024, MAX_MEMORY = 512 * 1024 * 1024;

  /* libc++ của gói không có bits/stdc++.h — cấp một bản giả để mã thi đấu quen thuộc biên dịch được. */
  var STDCPP = ["algorithm", "array", "bitset", "cassert", "cctype", "cfloat", "chrono", "climits", "cmath", "complex", "cstdint", "cstdio", "cstdlib",
    "cstring", "ctime", "deque", "forward_list", "functional", "initializer_list", "iomanip", "iostream", "istream", "iterator", "limits", "list", "map",
    "memory", "numeric", "ostream", "queue", "random", "set", "sstream", "stack", "string", "tuple", "type_traits", "unordered_map", "unordered_set",
    "utility", "vector"].map(function (h) { return "#include <" + h + ">"; }).join("\n") +
    "\n#if __cplusplus >= 201703L\n#include <optional>\n#include <string_view>\n#include <variant>\n#endif\n";

  /* ====================================================================================================
     Worker biên dịch — chạy BÊN TRONG worker (toString() rồi nhúng)
     ==================================================================================================== */
  function compileWorker() {
    var runClang = null, cacheName = "";
    var oldLog = self.console.log.bind(self.console);
    /* gói in "fetched N% (a / b)" qua console.log khi tải: đổi thành thông điệp tiến độ */
    self.console.log = function () {
      var m = /fetched (\d+)% \((\d+) \/ (\d+)\)/.exec(String(arguments[0]));
      if (m) self.postMessage({ t: "dl", pct: +m[1], loaded: +m[2], total: +m[3] });
      else oldLog.apply(null, arguments);
    };
    var realFetch = self.fetch.bind(self);
    self.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && (input.href || input.url)) || String(input);
      if (!/\/npm\/@yowasp\/clang@[^/]+\/gen\//.test(url) || typeof caches === "undefined" || (init && init.method && init.method !== "GET")) return realFetch(input, init);
      return caches.open(cacheName).then(function (c) {
        return c.match(url).then(function (hit) {
          if (hit) { self.postMessage({ t: "cache" }); return hit; }
          return realFetch(input, init).then(function (res) {
            if (res && res.ok && res.status === 200) { try { c.put(url, res.clone()).catch(function () { /* hết chỗ lưu */ }); } catch (e) { /* bỏ qua */ } }
            return res;
          });
        });
      }).catch(function () { return realFetch(input, init); });
    };
    self.onmessage = function (e) {
      var d = e.data, err = "";
      cacheName = d.cacheName;
      Promise.resolve().then(function () {
        if (runClang) return null;
        return import(d.url).then(function (m) { runClang = m.runClang; });
      }).then(function () {
        var t0 = performance.now();
        self.postMessage({ t: "start" });
        return runClang(d.args, d.files, {
          stdout: function () {},
          stderr: function (b) { err += typeof b === "string" ? b : new TextDecoder().decode(b || new Uint8Array()); }
        }).then(function (out) {
          var w = out["main.wasm"];
          self.postMessage({ t: "done", id: d.id, ok: true, ms: performance.now() - t0, wasm: w, err: err }, w ? [w.buffer] : []);
        });
      }).catch(function (er) {
        var msg = String(er && er.message || er), net = /^Exited with status/.test(msg) === false;
        if (net) runClang = null;               /* lỗi nạp/mạng: lần sau nạp lại từ đầu */
        self.postMessage({ t: "done", id: d.id, ok: false, net: net, error: msg, err: err });
      });
    };
  }

  /* ====================================================================================================
     Worker chạy .wasm — WASI tối thiểu
     ==================================================================================================== */
  function runWorker() {
    self.onmessage = function (e) {
      var d = e.data, mem, inp = new TextEncoder().encode(d.stdin || ""), pos = 0, bat = performance.now();
      var enc = new TextEncoder(), argv = ["main"].concat(d.args || []), argBytes = argv.map(function (a) { return enc.encode(a + "\0"); });
      var argTotal = argBytes.reduce(function (s, b) { return s + b.length; }, 0);
      var decO = new TextDecoder(), decE = new TextDecoder(), CAP = 1048576, FAST_MSGS = 500, msgs = 0;
      var bo = { out: "", err: "" }, tongO = 0, tongE = 0, truncated = false, lanCuoi = bat;
      function flush() {
        if (bo.out) { self.postMessage({ t: "out", s: bo.out }); bo.out = ""; }
        if (bo.err) { self.postMessage({ t: "err", s: bo.err }); bo.err = ""; }
        lanCuoi = performance.now(); msgs++;
      }
      function viet(kenh, bytes) {
        var s = (kenh === 1 ? decO : decE).decode(bytes, { stream: true });
        if (kenh === 1) { if (tongO < CAP) { tongO += s.length; bo.out += s; if (tongO >= CAP) { truncated = true; bo.out += "\n[… đầu ra bị cắt ở 1 MB]\n"; } } }
        else if (tongE < CAP) { tongE += s.length; bo.err += s; if (tongE >= CAP) truncated = true; }
        /* vài trăm lần ghi đầu gửi ngay (vòng lặp vô hạn vẫn hiện được dòng đã in); sau đó gom theo kích thước/thời gian */
        if (msgs < FAST_MSGS || bo.out.length > 65536 || performance.now() - lanCuoi > 80) flush();
      }
      var DV = function () { return new DataView(mem.buffer); };
      var wasi = {
        args_get: function (argvPtr, bufPtr) {
          var v = DV(), m8 = new Uint8Array(mem.buffer), p = bufPtr;
          for (var i = 0; i < argBytes.length; i++) { v.setUint32(argvPtr + i * 4, p, true); m8.set(argBytes[i], p); p += argBytes[i].length; }
          return 0;
        },
        args_sizes_get: function (a, b) { var v = DV(); v.setUint32(a, argv.length, true); v.setUint32(b, argTotal, true); return 0; },
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
        /* ngủ (sleep/usleep/this_thread::sleep_for): chờ bận tới hạn đã hẹn; quá giờ chạy thì luồng chính giết worker */
        poll_oneoff: function (inPtr, outPtr, nsubs, neventsPtr) {
          var v = DV(), wait = 0, i;
          for (i = 0; i < nsubs; i++) {
            var b = inPtr + i * 48;
            if (v.getUint8(b + 8) === 0) {
              var ns = Number(v.getBigUint64(b + 24, true)), abs = (v.getUint16(b + 40, true) & 1) !== 0;
              var ms = abs ? ns / 1e6 - (v.getUint32(b + 16, true) === 0 ? Date.now() : performance.now() - bat) : ns / 1e6;
              if (ms > wait) wait = ms;
            }
          }
          var until = performance.now() + wait;
          while (performance.now() < until) { /* chờ bận */ }
          for (i = 0; i < nsubs; i++) {
            var o = outPtr + i * 32, s = inPtr + i * 48;
            v.setBigUint64(o, v.getBigUint64(s, true), true); v.setUint16(o + 8, 0, true); v.setUint8(o + 10, v.getUint8(s + 8));
          }
          v.setUint32(neventsPtr, nsubs, true); return 0;
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
      function loi(msg) { self.postMessage({ t: "done", ok: false, load: true, error: msg }); }
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
              t: "done", ok: false, ms: performance.now() - t0, truncated: truncated,
              trap: /unreachable/.test(m) ? "abort" : /out of bounds/.test(m) ? "oob" : /call stack/.test(m) ? "stack" : /memory/.test(m) ? "memory" : "other",
              error: m
            });
            return;
          }
        }
        flush();
        self.postMessage({ t: "done", ok: true, code: ma, ms: performance.now() - t0, truncated: truncated });
      }).catch(function (er) { loi("Không nạp được chương trình: " + String(er && er.message || er)); });
    };
  }

  /* ====================================================================================================
     Phía luồng chính
     ==================================================================================================== */
  function fail(msg, code, extra) { var e = new Error(msg); e.code = code; if (extra) for (var k in extra) e[k] = extra[k]; return e; }
  var cw = null, cwHandle = null, queue = Promise.resolve(), memo = [], compilerLoaded = false, activeCompile = null;

  function killCompiler() {
    if (!cw) return;
    try { cw.terminate(); } catch (e) { /* đã dừng */ }
    if (cwHandle) cwHandle.revoke();
    cw = null; cwHandle = null;
    if (activeCompile) { var f = activeCompile; activeCompile = null; f(); }
  }
  function getCompiler() {
    if (!cw) { cwHandle = util.workerFromSource("(" + compileWorker.toString() + ")();"); cw = cwHandle.worker; }
    return cw;
  }

  /* ---- kế hoạch biên dịch: tệp nguồn, thư mục -I, cờ, cây tệp ảo ---- */
  function dirOf(p) { var i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); }
  function toTree(files) {
    var tree = {};
    files.forEach(function (f) {
      var parts = f.name.split("/"), node = tree;
      for (var i = 0; i < parts.length - 1; i++) {
        if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = f.content;
    });
    if (typeof tree.bits !== "object") tree.bits = typeof tree.bits === "string" ? tree.bits : {};
    if (typeof tree.bits === "object" && !tree.bits["stdc++.h"]) tree.bits["stdc++.h"] = STDCPP;
    return tree;
  }
  function plan(req) {
    var isC = req.language === "c", srcRe = isC ? /\.c$/i : /\.(?:cpp|cc|cxx|c\+\+)$/i, hdrRe = /\.(?:h|hh|hpp|hxx|h\+\+|inl|tpp|ipp)$/i;
    var names = req.files.map(function (f) { return f.name; });
    var sources = names.filter(function (n) { return srcRe.test(n); }).sort(function (a, b) { return (b === req.mainFile ? 1 : 0) - (a === req.mainFile ? 1 : 0); });
    if (!sources.length) throw fail("Không có tệp nguồn " + (isC ? ".c" : ".cpp/.cc/.cxx") + " nào để biên dịch.", "bad_request");
    var dirs = Object.create(null);
    names.forEach(function (n) { if (hdrRe.test(n) || srcRe.test(n)) dirs[dirOf(n) || "."] = 1; });
    delete dirs["."];
    var incs = ["."].concat(Object.keys(dirs).sort()), flags = [], libs = [], warnings = [];
    (req.compileArgs || []).forEach(function (f) {
      if (f === "-pthread") { warnings.push("-pthread bị bỏ qua: trình biên dịch trong trình duyệt không hỗ trợ luồng."); return; }
      (/^-l/.test(f) ? libs : flags).push(f);
    });
    var args = [isC ? "clang" : "clang++"].concat(flags, ["-D_WASI_EMULATED_PROCESS_CLOCKS"], isC ? [] : ["-fno-exceptions"],
      incs.map(function (d) { return "-I" + d; }), ["-Wl,-z,stack-size=" + STACK, "-Wl,--max-memory=" + MAX_MEMORY], sources,
      libs, ["-lwasi-emulated-process-clocks", "-o", "main.wasm"]);
    var key = req.language + "\u0000" + args.join(" ") + "\u0000" + req.files.map(function (f) { return f.name + "\u0000" + f.content; }).join("\u0001");
    return { args: args, key: key, warnings: warnings, sources: sources };
  }

  /* ---- biên dịch (xếp hàng nối tiếp: một worker) ---- */
  function compile(req, ctx) {
    var p = plan(req);
    for (var i = 0; i < memo.length; i++) if (memo[i].key === p.key) return Promise.resolve(Object.assign({ memo: true, warnings: p.warnings }, memo[i].kq));
    var job = queue.then(function () {
      if (ctx.isCancelled()) throw fail("Đã dừng chương trình.", "cancelled");
      return new Promise(function (resolve, reject) {
        var w = getCompiler(), id = Date.now() + ":" + Math.random(), idle = null, idleMs = req.hasCompileTimeout ? Math.max(req.compileTimeoutMs, 15000) : 120000, t0 = Date.now(), settled = false;
        var sawCache = false, announcedDl = false, lastPct = -1, lastAt = 0;
        function stopIdle() { if (idle) { clearTimeout(idle); idle = null; } }
        function arm() {
          stopIdle();
          idle = setTimeout(function () {
            if (settled) return;
            settled = true; activeCompile = null; killCompiler();
            resolve({ ok: false, timedOut: true, wasm: null, stderr: "Biên dịch quá giờ (" + Math.round(idleMs / 1000) + " giây không có tiến triển).\n", ms: Date.now() - t0, warnings: p.warnings });
          }, idleMs);
        }
        activeCompile = function () { if (!settled) { settled = true; stopIdle(); reject(fail("Đã dừng chương trình.", "cancelled")); } };
        w.onmessage = function (e) {
          var d = e.data || {};
          if (d.t === "dl") {
            arm();
            if (sawCache || !(d.loaded > 0)) return;    /* gói cũng in tiến độ khi đọc từ Cache Storage (đó không phải "tải"), và in "0%" trước cả khi biết nguồn */
            var now = Date.now();
            if (d.pct < 100 && d.pct === lastPct && now - lastAt < 150) return;           /* ~1.400 sự kiện cho 105 MB: giảm bớt */
            if (d.pct < 100 && now - lastAt < 80) return;
            lastPct = d.pct; lastAt = now;
            ctx.onProgress({ type: "download", label: "Trình biên dịch C/C++ (Clang→WebAssembly)", loaded: d.loaded, total: d.total, pct: d.pct });
            if (d.pct >= 100 && !announcedDl) { announcedDl = true; ctx.onProgress({ type: "compile", message: "Đang biên dịch " + p.sources.length + " tệp nguồn…" }); }
            return;
          }
          if (d.t === "cache") { arm(); if (!sawCache) { sawCache = true; ctx.onProgress({ type: "cache", message: "Dùng trình biên dịch đã lưu trong bộ nhớ trình duyệt…" }); } return; }
          if (d.t === "start") { arm(); ctx.onProgress({ type: "compile", message: "Đang biên dịch " + p.sources.length + " tệp nguồn…" }); return; }
          if (d.t !== "done" || d.id !== id || settled) return;
          settled = true; activeCompile = null; stopIdle();
          if (!d.ok && d.net) { reject(fail("Không nạp được trình biên dịch C/C++: " + d.error + " — kiểm tra kết nối mạng (lần đầu cần tải từ cdn.jsdelivr.net).", "download_failed")); return; }
          var kq = { ok: !!d.ok && !!d.wasm, wasm: d.wasm || null, stderr: d.err || (d.ok ? "" : d.error + "\n"), ms: d.ms || Date.now() - t0, timedOut: false, warnings: p.warnings };
          if (kq.ok) { compilerLoaded = true; util.cacheMark(CACHE, MARKER); memo.push({ key: p.key, kq: { ok: true, wasm: kq.wasm, stderr: kq.stderr, ms: kq.ms, timedOut: false } }); if (memo.length > 4) memo.shift(); }
          resolve(kq);
        };
        w.onerror = function (ev) {
          if (ev.preventDefault) ev.preventDefault();
          if (settled) return;
          settled = true; activeCompile = null; stopIdle(); killCompiler();
          reject(fail("Trình biên dịch gặp lỗi: " + (ev.message || "không rõ") + " — kiểm tra kết nối mạng (lần đầu cần tải từ cdn.jsdelivr.net).", "download_failed"));
        };
        arm();
        w.postMessage({ id: id, url: URL_CLANG, cacheName: CACHE, args: p.args, files: toTree(req.files) });
      });
    });
    queue = job.then(function () {}, function () {});
    return job;
  }

  /* ---- chạy .wasm ---- */
  function runWasm(wasm, req, ctx) {
    return new Promise(function (resolve, reject) {
      var h = util.workerFromSource("(" + runWorker.toString() + ")();"), w = h.worker, out = "", err = "", finished = false, timer = null;
      function kill() { if (timer) { clearTimeout(timer); timer = null; } try { w.terminate(); } catch (e) { /* đã dừng */ } h.revoke(); }
      ctx.onCancel(function () { if (!finished) { finished = true; kill(); reject(fail("Đã dừng chương trình.", "cancelled")); } });
      function end(stage) { if (finished) return; finished = true; kill(); resolve(stage); }
      w.onmessage = function (e) {
        var d = e.data || {};
        if (d.t === "out") { out += d.s; ctx.onProgress({ type: "stdout", text: d.s }); }
        else if (d.t === "err") { err += d.s; ctx.onProgress({ type: "stderr", text: d.s }); }
        else if (d.t === "done") {
          if (d.load) { end({ ran: true, ok: false, stdout: out, stderr: err + d.error + "\n", code: null, signal: null, ms: 0, timedOut: false, truncated: false }); return; }
          if (d.trap) {
            var why = { abort: "Chương trình dừng bất thường (abort / assert thất bại / hành vi chưa định nghĩa)", oob: "Truy cập bộ nhớ ngoài vùng cho phép (chỉ số vượt mảng, con trỏ sai)",
              stack: "Tràn ngăn xếp (đệ quy quá sâu hoặc mảng cục bộ quá lớn)", memory: "Hết bộ nhớ (giới hạn 512 MB)", other: d.error }[d.trap];
            end({ ran: true, ok: false, stdout: out, stderr: err + (err && !/\n$/.test(err) ? "\n" : "") + "[" + why + "]\n", code: null, signal: d.trap === "abort" ? "SIGABRT" : d.trap === "other" ? "SIGILL" : "SIGSEGV",
              ms: d.ms || 0, timedOut: false, truncated: !!d.truncated });
            return;
          }
          end({ ran: true, ok: d.code === 0, stdout: out, stderr: err, code: d.code, signal: null, ms: d.ms || 0, timedOut: false, truncated: !!d.truncated });
        }
      };
      w.onerror = function (ev) {
        if (ev.preventDefault) ev.preventDefault();
        end({ ran: true, ok: false, stdout: out, stderr: err + "Trình chạy gặp lỗi: " + ((ev && ev.message) || "không rõ") + "\n", code: null, signal: null, ms: 0, timedOut: false, truncated: false });
      };
      timer = setTimeout(function () {
        end({ ran: true, ok: false, stdout: out, stderr: err, code: null, signal: null, ms: req.runTimeoutMs, timedOut: true, truncated: false });
      }, req.runTimeoutMs);
      ctx.onProgress({ type: "run", message: "Đang chạy chương trình…" });
      var copy = wasm.slice ? wasm.slice() : wasm;           /* mỗi lần chạy một bản sao (bản gốc còn để chạy lại) */
      w.postMessage({ wasm: copy, stdin: req.stdin, args: req.args });
    });
  }

  function execute(req, ctx) {
    var warnings = [];
    ctx.onCancel(function () { if (activeCompile) killCompiler(); });     /* huỷ giữa lúc biên dịch/tải: giết worker biên dịch (chạy .wasm tự có hook riêng) */
    return Promise.resolve().then(function () { plan(req); return compilerLoaded ? true : util.cacheReady(CACHE, MARKER); }).then(function (have) {
      if (have) return true;
      return Promise.resolve(ctx.confirmDownload({
        what: "Trình biên dịch C/C++ (Clang→WebAssembly)", size: "≈ 25 MB",
        note: "Chỉ cần tải một lần (≈ 105 MB sau khi giải nén); sau đó biên dịch C/C++ ngay trong trình duyệt, không cần mạng. Không hỗ trợ ngoại lệ C++ (try/catch), luồng và tệp."
      }));
    }).then(function (ok) {
      if (!ok) throw fail("Bạn đã hoãn tải trình biên dịch C/C++ — chạy ở máy chủ, hoặc bấm Chạy lại và chọn Tải.", "download_declined");
      return compile(req, ctx);
    }).then(function (kq) {
      warnings = warnings.concat(kq.warnings || []);
      var stage = { ran: true, ok: kq.ok, stdout: "", stderr: kq.stderr, code: kq.ok ? 0 : (kq.timedOut ? null : 1), signal: null, ms: Math.round(kq.ms || 0), timedOut: !!kq.timedOut, truncated: false };
      if (!kq.ok) {
        if (/exceptions disabled/.test(kq.stderr)) warnings.push("Trình biên dịch trong trình duyệt tắt ngoại lệ C++ (try/catch/throw không dùng được) — chọn nơi chạy ở máy chủ nếu cần ngoại lệ.");
        return { compile: stage, run: null, version: "Clang " + VERSION.split("-")[0] + " (WebAssembly)", warnings: warnings };
      }
      return runWasm(kq.wasm, req, ctx).then(function (run) {
        return { compile: stage, run: run, version: "Clang " + VERSION.split("-")[0] + " (WebAssembly)", warnings: warnings };
      });
    });
  }

  CS.runner.registerExecutor("cpp", execute);
  CS.runner.registerExecutor("c", execute);
  CS.runner.browserCpp = { version: VERSION, source: URL_CLANG, cacheName: CACHE, plan: plan, reset: killCompiler,
    clearCache: function () { killCompiler(); compilerLoaded = false; memo = []; return util.deleteCache(CACHE); }, cached: function () { return util.cacheReady(CACHE, MARKER); } };
})(typeof globalThis !== "undefined" ? globalThis : this);
