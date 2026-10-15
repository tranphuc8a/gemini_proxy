/* browser-py.js — chạy Python NGAY TRONG TRÌNH DUYỆT bằng Pyodide (CPython biên dịch sang WebAssembly), nơi chạy "browser", ngôn ngữ python.
   • Pyodide ghim phiên bản (v0.26.4 — cùng bản các trang khoá học đang dùng), nạp từ cdn.jsdelivr.net/pyodide/ KHI người dùng chủ động chạy lần đầu
     (hỏi confirmDownload trước, ≈ 10 MB; có báo tiến độ tải). Tệp tải về được lưu vào Cache Storage `cs-pyodide-<phiên bản>` để lần sau dùng ngay,
     cả khi không mạng (nếu trình duyệt cho Cache Storage: cần http(s), không phải file://; không có thì dùng bộ nhớ đệm HTTP thường).
   • Pyodide chạy trong một Web Worker riêng, giữ sống giữa các lần chạy (lần đầu khởi động ≈ 1–3 s khi đã có trong bộ nhớ đệm). Quá giờ →
     terminate worker (lần sau nạp lại).
   • Mọi tệp của dự án được ghi vào hệ tệp ảo /work (thư mục làm việc), nên `import utils`, `from pkg import x`, `open("data.txt")` chạy được.
     Mỗi lần chạy: dọn /work, gỡ các mô-đun của lần trước, sys.argv = [tệp chính, *args], sys.stdin = StringIO(stdin).
   • stdout/stderr truyền dần (onProgress stdout/stderr). Traceback chuẩn ("File "main.py", line N") → chẩn đoán.
   • Không có mạng: fetch/XMLHttpRequest/WebSocket/importScripts/Worker bị thay bằng hàm báo lỗi SAU khi Pyodide nạp xong; không nạp micropip; gói
     ngoài thư viện chuẩn (numpy…) KHÔNG dùng được (cần mạng lúc chạy). Thư viện chuẩn thì đủ (trừ tkinter, threading thật, socket…). */
(function (root) {
  "use strict";
  if (typeof document === "undefined" && typeof Worker === "undefined") return;
  var CS = root.CS;
  if (!CS || !CS.runner) return;
  var util = CS.runner.util;

  var VERSION = "0.26.4";
  var BASE = "https://cdn.jsdelivr.net/pyodide/v" + VERSION + "/full/";
  var CACHE = "cs-pyodide-" + VERSION, MARKER = "https://cs-cache.invalid/pyodide-" + VERSION + "-ready";
  /* tệp cần tải và kích thước GIẢI NÉN ước lượng (để tính %; kích thước thật ± vài %) */
  var ASSETS = [["pyodide.js", 14800], ["pyodide.asm.js", 1230000], ["pyodide.asm.wasm", 10090000], ["python_stdlib.zip", 2342000], ["pyodide-lock.json", 106500]];

  /* ---- mã Python điều khiển (nằm trong chú thích để khỏi gấp đôi dấu \) ---- */
  function driverText() {
    /*
import sys, os, io, shutil, builtins, traceback, importlib

_WORK = "/work"
_o_out, _o_err, _o_in = sys.stdout, sys.stderr, sys.stdin

class _Out:
    encoding = "utf-8"
    errors = "strict"
    def __init__(self, fn):
        self._fn = fn
    def write(self, s):
        if not isinstance(s, str):
            raise TypeError("write() argument must be str, not " + type(s).__name__)
        if s:
            self._fn(s)
        return len(s)
    def writelines(self, lines):
        for l in lines:
            self.write(l)
    def flush(self):
        pass
    def isatty(self):
        return False
    def writable(self):
        return True
    def fileno(self):
        raise io.UnsupportedOperation("fileno")

def _cs_reset():
    for name in list(sys.modules):
        m = sys.modules.get(name)
        f = getattr(m, "__file__", None)
        if isinstance(f, str) and f.startswith(_WORK + "/"):
            del sys.modules[name]
    importlib.invalidate_caches()
    os.chdir("/")
    if os.path.isdir(_WORK):
        shutil.rmtree(_WORK)
    os.makedirs(_WORK)

def _cs_run(main, stdin, args, out, err):
    sys.stdout = _Out(out)
    sys.stderr = _Out(err)
    sys.stdin = io.StringIO(stdin)
    sys.argv = [main] + list(args)
    sys.path[:] = [p for p in sys.path if not (p == _WORK or p.startswith(_WORK + "/"))]
    main_path = _WORK + "/" + main
    sys.path.insert(0, os.path.dirname(main_path))
    if os.path.dirname(main_path) != _WORK:
        sys.path.insert(1, _WORK)
    os.chdir(_WORK)
    code = 0
    try:
        with open(main_path, encoding="utf-8") as f:
            src = f.read()
        obj = compile(src, main, "exec")
        g = {"__name__": "__main__", "__file__": main_path, "__builtins__": builtins, "__doc__": None}
        exec(obj, g)
    except SystemExit as e:
        c = e.code
        if c is None:
            code = 0
        elif isinstance(c, int):
            code = c
        else:
            print(c, file=sys.stderr)
            code = 1
    except BaseException:
        et, ev, tb = sys.exc_info()
        buf = io.StringIO()
        traceback.print_exception(et, ev, tb.tb_next if tb is not None else None, file=buf)
        sys.stderr.write(buf.getvalue().replace('File "' + _WORK + "/", 'File "'))
        code = 1
    finally:
        try:
            sys.stdout.flush()
        except Exception:
            pass
        sys.stdout, sys.stderr, sys.stdin = _o_out, _o_err, _o_in
        os.chdir("/")
    return code

import sys as _s
_cs_version = ".".join(map(str, _s.version_info[:3]))
    */
  }

  /* ====================================================================================================
     BÊN TRONG worker (toString() rồi nhúng; biến DRIVER, BASE do phần nhúng khai báo trước)
     ==================================================================================================== */
  function workerMain() {
    var G = self, post = G.postMessage.bind(G);
    var realFetch = G.fetch.bind(G), realImport = G.importScripts.bind(G);
    var py = null, cacheName = "", userMode = false, blocked = [], blobUrls = {};
    var CAP = 1048576, FAST_MSGS = 500;
    var out = "", err = "", outLen = 0, errLen = 0, truncated = false, lastFlush = 0, msgs = 0;

    function flush() {
      if (out) { post({ t: "out", s: out }); out = ""; }
      if (err) { post({ t: "err", s: err }); err = ""; }
      lastFlush = Date.now(); msgs++;
    }
    function write(isErr, s) {
      s = String(s);
      if (isErr) { if (errLen >= CAP) { truncated = true; return; } errLen += s.length; if (errLen > CAP) { s = s.slice(0, s.length - (errLen - CAP)); truncated = true; } err += s; }
      else { if (outLen >= CAP) { truncated = true; return; } outLen += s.length; if (outLen > CAP) { s = s.slice(0, s.length - (outLen - CAP)); truncated = true; } out += s; }
      if (msgs < FAST_MSGS || out.length + err.length > 65536 || Date.now() - lastFlush > 40) flush();
    }

    /* fetch: đọc Cache Storage trước (trang đã tải sẵn vào đó), không thấy thì ra mạng; khi chạy mã người dùng thì CHẶN */
    function cachedFetch(input, init) {
      var url = typeof input === "string" ? input : (input && (input.href || input.url)) || String(input);
      if (url.indexOf(BASE) !== 0 || typeof caches === "undefined" || (init && init.method && init.method !== "GET")) return realFetch(input, init);
      return caches.open(cacheName).then(function (c) {
        return c.match(url).then(function (hit) { return hit || realFetch(input, init); });
      }).catch(function () { return realFetch(input, init); });
    }
    G.fetch = function (input, init) {
      if (userMode) {
        if (blocked.indexOf("fetch") < 0) blocked.push("fetch");
        return Promise.reject(new Error("Mạng bị chặn: Python trong trình duyệt không được phép ra mạng."));
      }
      return cachedFetch(input, init);
    };
    G.importScripts = function () {
      var a = Array.prototype.map.call(arguments, function (u) { return blobUrls[u] || u; });
      return realImport.apply(null, a);
    };

    function lockDown() {
      ["XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker", "BroadcastChannel"].forEach(function (n) {
        try {
          Object.defineProperty(G, n, { value: function () {
            if (userMode && blocked.indexOf(n) < 0) blocked.push(n);
            throw new Error("Mạng bị chặn: " + n + " không dùng được khi chạy Python trong trình duyệt.");
          }, writable: true, configurable: true });
        } catch (e) { /* bỏ qua */ }
      });
      G.importScripts = function () { throw new Error("importScripts bị chặn khi chạy Python trong trình duyệt."); };
    }

    function init(d) {
      cacheName = d.cacheName;
      var pre = ["pyodide.js", "pyodide.asm.js"].map(function (n) {
        return cachedFetch(BASE + n).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
          if (b) blobUrls[BASE + n] = URL.createObjectURL(new Blob([b], { type: "text/javascript" }));
        }, function () { /* không sao: importScripts sẽ ra mạng */ });
      });
      Promise.all(pre).then(function () {
        G.importScripts(BASE + "pyodide.js");
        return G.loadPyodide({ indexURL: BASE, stdout: function () {}, stderr: function () {} });
      }).then(function (p) {
        py = p;
        py.runPython(DRIVER);
        var ver = String(py.globals.get("_cs_version"));
        lockDown();
        post({ t: "ready", version: ver + " (Pyodide " + py.version + ")" });
      }).catch(function (er) { post({ t: "initfail", error: String(er && er.message || er) }); });
    }

    function mkdirs(dir) { try { py.FS.mkdirTree(dir); } catch (e) { /* đã có */ } }
    function run(d) {
      var t0 = Date.now(), code = 1;
      out = ""; err = ""; outLen = 0; errLen = 0; truncated = false; msgs = 0; lastFlush = t0; blocked = [];
      try {
        py.globals.get("_cs_reset")();
        d.files.forEach(function (f) {
          var path = "/work/" + f.name, i = path.lastIndexOf("/");
          mkdirs(path.slice(0, i));
          py.FS.writeFile(path, f.content, { encoding: "utf8" });
        });
        var args = py.toPy(d.args || []);
        userMode = true;
        try { code = py.globals.get("_cs_run")(d.main, d.stdin || "", args, function (s) { write(false, s); }, function (s) { write(true, s); }); }
        finally { userMode = false; try { args.destroy(); } catch (e) { /* bỏ qua */ } }
        flush();
        post({ t: "done", id: d.id, code: Number(code), ms: Date.now() - t0, blocked: blocked, truncated: truncated });
      } catch (er) {
        userMode = false;
        flush();
        post({ t: "fail", id: d.id, error: String(er && er.message || er), ms: Date.now() - t0 });
      }
    }
    G.onmessage = function (e) {
      var d = e.data;
      if (d.t === "init") init(d);
      else if (d.t === "run") run(d);
    };
  }


  /* ====================================================================================================
     Phía luồng chính
     ==================================================================================================== */
  var inst = null;        /* {worker, handle, busy, cur, version} — null = chưa khởi động hoặc đã bị giết */
  var starting = null;    /* Promise đang khởi động (dùng chung nếu hai lần chạy gọi cùng lúc) */
  function fail(msg, code) { var e = new Error(msg); e.code = code; return e; }
  function declined() { return fail("Bạn đã hoãn tải Python (Pyodide) — chạy ở máy chủ, hoặc bấm Chạy lại và chọn Tải.", "download_declined"); }

  /** Giết worker; chương trình đang chạy (nếu có) bị huỷ với `reason` (mặc định "cancelled"). */
  function killInst(reason) {
    if (!inst) return;
    var i = inst; inst = null;
    try { i.worker.terminate(); } catch (e) { /* đã dừng */ }
    i.handle.revoke();
    if (i.cur) { var c = i.cur; i.cur = null; c.abort(reason); }
  }

  /* tải trước các tệp vào Cache Storage (nếu có) với tiến độ; không có Cache Storage thì đọc bỏ để làm ấm bộ nhớ đệm HTTP */
  function prefetch(ctx) {
    return util.openCache(CACHE).then(function (cache) {
      var label = "Python (Pyodide " + VERSION + ")";
      var totalEst = ASSETS.reduce(function (a, x) { return a + x[1]; }, 0), loaded = 0;
      function report(done) { ctx.onProgress({ type: "download", label: label, loaded: done ? totalEst : loaded, total: totalEst, pct: done ? 100 : Math.min(99, Math.round(100 * loaded / totalEst)) }); }
      report();
      var chain = Promise.resolve();
      ASSETS.forEach(function (a) {
        chain = chain.then(function () {
          if (ctx.isCancelled()) throw fail("Đã dừng chương trình.", "cancelled");
          var url = BASE + a[0];
          return (cache ? cache.match(url) : Promise.resolve(null)).then(function (hit) {
            if (hit) { loaded += a[1]; report(); return null; }
            return fetch(url, { mode: "cors" }).then(function (res) {
              if (!res.ok) throw fail("Không tải được " + a[0] + " (HTTP " + res.status + ") từ cdn.jsdelivr.net.", "download_failed");
              var reader = res.body && res.body.getReader ? res.body.getReader() : null, chunks = [], last = 0;
              if (!reader) return res.blob().then(function (b) { loaded += a[1]; report(); return storeAsset(cache, url, res, [b]); });
              function pump() {
                return reader.read().then(function (r) {
                  if (r.done) return storeAsset(cache, url, res, chunks);
                  chunks.push(r.value); loaded += r.value.length;
                  var now = Date.now(); if (now - last > 120) { last = now; report(); }
                  return pump();
                });
              }
              return pump();
            }, function (e) { if (e && e.code) throw e; throw fail("Không tải được Python (Pyodide) từ cdn.jsdelivr.net — kiểm tra kết nối mạng rồi thử lại.", "download_failed"); });
          });
        });
      });
      return chain.then(function () { report(true); });
    });
  }
  function storeAsset(cache, url, res, chunks) {
    if (!cache) return null;
    var type = res.headers.get("Content-Type") || (/\.wasm$/.test(url) ? "application/wasm" : /\.js$/.test(url) ? "text/javascript" : "application/octet-stream");
    return cache.put(url, new Response(new Blob(chunks), { status: 200, headers: { "Content-Type": type } })).catch(function () { /* hết chỗ lưu: bỏ qua */ });
  }

  function workerSource() {
    return "var BASE = " + JSON.stringify(BASE) + ";\nvar DRIVER = " + JSON.stringify(util.commentText(driverText)) + ";\n(" + workerMain.toString() + ")();\n";
  }

  /* khởi động Pyodide: hỏi (nếu chưa có trong bộ nhớ đệm) → tải trước → dựng worker → đợi "ready" */
  function start(ctx) {
    return util.cacheReady(CACHE, MARKER).then(function (cached) {
      var consent = cached ? Promise.resolve(true) : Promise.resolve(ctx.confirmDownload({
        what: "Python trong trình duyệt (Pyodide)", size: "≈ 10 MB",
        note: "Pyodide là CPython biên dịch sang WebAssembly: chỉ tải một lần, sau đó chạy Python không cần mạng. Chỉ có thư viện chuẩn (không có numpy…)."
      }));
      return consent.then(function (ok) {
        if (!ok) throw declined();
        return cached ? null : prefetch(ctx);
      });
    }).then(function () {
      if (ctx.isCancelled()) throw fail("Đã dừng chương trình.", "cancelled");
      ctx.onProgress({ type: "compile", message: "Đang khởi động Python…" });
      var h = util.workerFromSource(workerSource());
      var me = { worker: h.worker, handle: h, busy: false, cur: null, version: "" };
      return new Promise(function (resolve, reject) {
        h.worker.onmessage = function (e) {
          var d = e.data || {};
          if (d.t === "ready") {
            me.version = d.version; inst = me; util.cacheMark(CACHE, MARKER);
            h.worker.onmessage = function (ev) { if (inst === me && me.cur) me.cur.onMessage(ev.data || {}); };
            h.worker.onerror = function (ev) {
              if (ev.preventDefault) ev.preventDefault();
              if (inst === me) killInst(fail("Trình chạy Python gặp lỗi: " + (ev.message || "không rõ") + ".", "python_crashed"));
            };
            resolve(me);
          } else if (d.t === "initfail") {
            try { h.worker.terminate(); } catch (x) { /* đã dừng */ } h.revoke();
            reject(fail("Không khởi động được Python (Pyodide): " + d.error + (/fetch|network|Failed|load|import/i.test(d.error) ? " — kiểm tra kết nối mạng (lần đầu cần tải từ cdn.jsdelivr.net)." : ""), "download_failed"));
          }
        };
        h.worker.onerror = function (ev) {
          if (ev.preventDefault) ev.preventDefault();
          try { h.worker.terminate(); } catch (x) { /* đã dừng */ } h.revoke();
          reject(fail("Trình chạy Python gặp lỗi: " + (ev.message || "không rõ") + " — kiểm tra kết nối mạng (lần đầu cần tải từ cdn.jsdelivr.net).", "download_failed"));
        };
        h.worker.postMessage({ t: "init", cacheName: CACHE });
      });
    });
  }
  function getReady(ctx) {
    if (inst) return Promise.resolve(inst);
    if (!starting) starting = start(ctx).then(function (me) { starting = null; return me; }, function (e) { starting = null; throw e; });
    return starting;
  }

  function execute(req, ctx) {
    return getReady(ctx).then(function (me) {
      if (ctx.isCancelled()) throw fail("Đã dừng chương trình.", "cancelled");
      if (me.busy) throw fail("Đang chạy một chương trình Python khác — đợi nó xong hoặc bấm Dừng.", "busy");
      return runOn(me, req, ctx);
    });
  }

  function runOn(me, req, ctx) {
    return new Promise(function (resolve, reject) {
      me.busy = true;
      var id = Date.now() + ":" + Math.random(), out = "", err = "", timer = null, finished = false;
      function release() { if (timer) { clearTimeout(timer); timer = null; } me.busy = false; if (me.cur && me.cur.id === id) me.cur = null; }
      function end(stage, warnings) {
        if (finished) return;
        finished = true; release();
        resolve({ compile: null, run: stage, version: me.version, warnings: warnings || [] });
      }
      me.cur = {
        id: id,
        abort: function (reason) { if (!finished) { finished = true; release(); reject(reason || fail("Đã dừng chương trình.", "cancelled")); } },
        onMessage: function (d) {
          if (d.t === "out") { out += d.s; ctx.onProgress({ type: "stdout", text: d.s }); }
          else if (d.t === "err") { err += d.s; ctx.onProgress({ type: "stderr", text: d.s }); }
          else if (d.t === "done" && d.id === id) {
            var warn = [];
            if (d.blocked && d.blocked.length) warn.push("Mã Python gọi " + d.blocked.join(", ") + " nhưng bộ chạy trong trình duyệt không cho ra mạng — chọn nơi chạy ở máy chủ nếu cần mạng.");
            end({ ran: true, ok: d.code === 0, stdout: out, stderr: err, code: d.code, signal: null, ms: d.ms, timedOut: false, truncated: !!d.truncated }, warn);
          } else if (d.t === "fail" && d.id === id) {
            end({ ran: true, ok: false, stdout: out, stderr: err + (err && !/\n$/.test(err) ? "\n" : "") + "Lỗi bộ chạy Python: " + d.error + "\n", code: 1, signal: null, ms: d.ms, timedOut: false, truncated: false });
          }
        }
      };
      ctx.onCancel(function () { if (!finished && inst === me) killInst(); });
      timer = setTimeout(function () {
        if (finished) return;
        finished = true; timer = null;
        /* quá giờ: giết hẳn worker (vòng lặp vô hạn); lần sau khởi động lại Pyodide (từ bộ nhớ đệm, vài giây) */
        if (inst === me) { inst = null; try { me.worker.terminate(); } catch (x) { /* đã dừng */ } me.handle.revoke(); }
        me.busy = false; me.cur = null;
        resolve({ compile: null, run: { ran: true, ok: false, stdout: out, stderr: err, code: null, signal: null, ms: req.runTimeoutMs, timedOut: true, truncated: false },
          version: me.version, warnings: ["Python bị dừng vì quá giờ; lần chạy kế tiếp sẽ khởi động lại trình thông dịch (mất vài giây)."] });
      }, req.runTimeoutMs);
      ctx.onProgress({ type: "run", message: "Đang chạy Python (Pyodide)…" });
      me.worker.postMessage({ t: "run", id: id, files: req.files.map(function (f) { return { name: f.name, content: f.content }; }), main: req.mainFile, stdin: req.stdin, args: req.args });
    });
  }

  CS.runner.registerExecutor("python", execute);
  CS.runner.browserPy = { version: VERSION, base: BASE, cacheName: CACHE, reset: function () { killInst(); },
    clearCache: function () { killInst(); return util.deleteCache(CACHE); }, cached: function () { return util.cacheReady(CACHE, MARKER); } };
})(typeof globalThis !== "undefined" ? globalThis : this);
