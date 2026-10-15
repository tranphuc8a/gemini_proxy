/* browser-js.js — chạy JavaScript NGAY TRONG TRÌNH DUYỆT (nơi chạy "browser", ngôn ngữ javascript). Không cần tải gì, chạy tức thì.
   Mỗi lần chạy dựng một Web Worker (Blob) mà nguồn là: bộ chuẩn bị môi trường (workerPrelude) + MỌI tệp .js/.cjs/.mjs của dự án, mỗi tệp
   bọc thành hàm mô-đun CommonJS (exports, require, module, __filename, __dirname) — nhờ vậy lỗi cú pháp ở bất kỳ tệp nào cũng là lỗi cú pháp
   của chính script worker, trình duyệt báo đúng dòng/cột (ErrorEvent), và ta đổi ngược về tệp + dòng của dự án.
   Môi trường cấp sẵn (giống Node ở mức học tập): require("./x.js") tương đối từ các tệp dự án (+ .json, index.js), console.* (log/info/debug → stdout,
   error/warn → stderr, in đối tượng kiểu util.inspect), print(...), readInput() (toàn bộ stdin), readLine(), process (argv, env, exit, stdout.write,
   stdin.on('data'/'end'), nextTick, hrtime…), và vài mô-đun lõi nhỏ: fs (đọc stdin/tệp dự án), readline, util, assert, path, events, os, perf_hooks.
   Hạn chế đã biết: không có mạng (fetch/XMLHttpRequest/WebSocket/EventSource/importScripts/Worker bị thay bằng hàm báo lỗi — chỉ là rào chắn mức
   "tai nạn", KHÔNG phải sandbox: import() động không chặn được), không có ESM (import/export) và không có top-level await.
   Quá giờ → worker bị terminate; stdout/stderr truyền dần qua onProgress. */
(function (root) {
  "use strict";
  if (typeof document === "undefined" && typeof Worker === "undefined") return;   /* chỉ chạy trong trình duyệt */
  var CS = root.CS;
  if (!CS || !CS.runner) return;
  var util = CS.runner.util;

  /* ====================================================================================================
     Phần chạy BÊN TRONG worker. Hàm này được toString() rồi nhúng nguyên văn vào script worker — nên phải tự chứa
     (không tham chiếu biến ngoài). Nó định nghĩa self.__csDef / self.__csBoot cho phần đuôi script gọi.
     ==================================================================================================== */
  function workerPrelude() {
    "use strict";
    var G = self, post = G.postMessage.bind(G);
    var realSetTimeout = G.setTimeout.bind(G), realClearTimeout = G.clearTimeout.bind(G);
    var realSetInterval = G.setInterval.bind(G), realClearInterval = G.clearInterval.bind(G);
    var CAP = 1048576, FAST_MSGS = 500;
    var out = "", err = "", outLen = 0, errLen = 0, truncated = false, lastFlush = 0, msgs = 0;
    var stdinText = "", stdinPos = 0, argsList = [], mainName = "", t0 = 0, exited = false, exitCode = 0;
    var defs = Object.create(null), jsons = Object.create(null), cache = Object.create(null), table = [], vfs = Object.create(null);
    var timers = Object.create(null), nTimers = 0, exitHandlers = [], blocked = [], groupIndent = "", mainModule = null;
    var doneMs = 0;

    /* ---------------------------------------------------------------- đầu ra */
    function flush() {
      if (out) { post({ t: "out", s: out }); out = ""; }
      if (err) { post({ t: "err", s: err }); err = ""; }
      lastFlush = Date.now(); msgs++;
    }
    function write(isErr, s) {
      if (exited) return;
      s = String(s);
      if (isErr) { if (errLen >= CAP) { truncated = true; return; } errLen += s.length; if (errLen > CAP) { s = s.slice(0, s.length - (errLen - CAP)); truncated = true; } err += s; }
      else { if (outLen >= CAP) { truncated = true; return; } outLen += s.length; if (outLen > CAP) { s = s.slice(0, s.length - (outLen - CAP)); truncated = true; } out += s; }
      /* vài trăm lần ghi đầu: gửi ngay (để chương trình vòng lặp vô hạn vẫn hiện được những dòng đã in); sau đó gom theo thời gian/kích thước */
      if (msgs < FAST_MSGS || out.length + err.length > 65536 || Date.now() - lastFlush > 40) flush();
    }

    /* ---------------------------------------------------------------- đổi vị trí trong script worker về (tệp, dòng) của dự án */
    function mapPos(line) {
      for (var i = 0; i < table.length; i++) { var m = table[i]; if (line >= m.start && line < m.start + m.count) return { file: m.name, line: line - m.start + 1 }; }
      return null;
    }
    function mapStack(stack) {
      var lines = String(stack).split("\n"), res = [];
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i], keep = true;
        l = l.replace(/(blob:\S+?|[^\s(]*cs-run\.js):(\d+):(\d+)/g, function (all, f, ln, col) {
          var p = mapPos(+ln);
          if (!p) { keep = false; return all; }
          return p.file + ":" + p.line + ":" + col;
        });
        if (keep) res.push(l);
      }
      return res.join("\n");
    }

    /* ---------------------------------------------------------------- in đối tượng kiểu Node (rút gọn) */
    function quote(s) {
      var q = s.indexOf("'") < 0 ? "'" : (s.indexOf('"') < 0 ? '"' : (s.indexOf("`") < 0 ? "`" : "'"));
      var esc = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      if (q === "'") esc = esc.replace(/'/g, "\\'");
      return q + esc + q;
    }
    var IDENT = /^[A-Za-z_$][\w$]*$/;
    function inspect(v, depth, seen) {
      if (depth === undefined) depth = 2;
      seen = seen || [];
      var t = typeof v;
      if (v === null) return "null";
      if (t === "undefined") return "undefined";
      if (t === "string") return seen.length ? quote(v) : v;
      if (t === "number") return v === 0 && 1 / v < 0 ? "-0" : String(v);
      if (t === "bigint") return v + "n";
      if (t === "boolean") return String(v);
      if (t === "symbol") return v.toString();
      if (t === "function") {
        var src = Function.prototype.toString.call(v), nm = v.name;
        if (/^class[\s{]/.test(src)) return "[class " + (nm || "(anonymous)") + (Object.getPrototypeOf(v) && Object.getPrototypeOf(v).name ? " extends " + Object.getPrototypeOf(v).name : "") + "]";
        return "[" + (/^(async\s+)?function\s*\*/.test(src) ? "GeneratorFunction" : /^async/.test(src) ? "AsyncFunction" : "Function") + (nm ? ": " + nm : " (anonymous)") + "]";
      }
      if (seen.indexOf(v) >= 0) return "[Circular *1]";
      if (v instanceof Error) return mapStack(v.stack || (v.name + ": " + v.message));
      if (v instanceof Date) return isNaN(v) ? "Invalid Date" : v.toISOString();
      if (v instanceof RegExp) return String(v);
      if (typeof v.then === "function" && v instanceof Promise) return "Promise { <pending> }";
      var isArr = Array.isArray(v), isMap = v instanceof Map, isSet = v instanceof Set, typed = ArrayBuffer.isView(v) && !(v instanceof DataView);
      var ctor = "", proto = Object.getPrototypeOf(v);
      if (proto === null) ctor = "[Object: null prototype]";
      else if (proto.constructor && proto.constructor.name) ctor = proto.constructor.name;
      if (depth < 0) return isArr ? "[Array]" : "[" + (ctor || "Object") + "]";
      seen.push(v);
      var items = [], i, keys;
      if (isArr || typed) {
        var n = v.length, shown = Math.min(n, 100);
        for (i = 0; i < shown; i++) items.push(inspect(v[i], depth - 1, seen));
        if (n > shown) items.push("... " + (n - shown) + " more item" + (n - shown > 1 ? "s" : ""));
        keys = Object.keys(v).filter(function (k) { return !/^\d+$/.test(k); });
      } else if (isMap) {
        v.forEach(function (val, k) { items.push(inspect(k, depth - 1, seen) + " => " + inspect(val, depth - 1, seen)); });
        keys = Object.keys(v);
      } else if (isSet) {
        v.forEach(function (val) { items.push(inspect(val, depth - 1, seen)); });
        keys = Object.keys(v);
      } else keys = Object.keys(v);
      keys.forEach(function (k) {
        var d = Object.getOwnPropertyDescriptor(v, k), val;
        if (d && (d.get || d.set)) val = d.get && d.set ? "[Getter/Setter]" : d.get ? "[Getter]" : "[Setter]";
        else val = inspect(v[k], depth - 1, seen);
        items.push((IDENT.test(k) ? k : quote(k)) + ": " + val);
      });
      seen.pop();
      var prefix = "", open = "{", close = "}";
      if (isArr) { open = "["; close = "]"; if (ctor && ctor !== "Array") prefix = ctor + "(" + v.length + ") "; }
      else if (typed) { open = "["; close = "]"; prefix = ctor + "(" + v.length + ") "; }
      else if (isMap) prefix = "Map(" + v.size + ") ";
      else if (isSet) prefix = "Set(" + v.size + ") ";
      else if (ctor && ctor !== "Object") prefix = ctor + " ";
      if (!items.length) return prefix + open + close;
      var oneLine = prefix + open + " " + items.join(", ") + " " + close;
      if (oneLine.length <= 72 && oneLine.indexOf("\n") < 0) return oneLine;
      return prefix + open + "\n" + items.map(function (x) { return "  " + x.split("\n").join("\n  "); }).join(",\n") + "\n" + close;
    }
    function format(args) {
      var a = Array.prototype.slice.call(args), first = a[0], s;
      if (typeof first === "string" && /%[sdifjoOc%]/.test(first) && a.length > 1) {
        var k = 1;
        s = first.replace(/%([sdifjoOc%])/g, function (m, c) {
          if (c === "%") return "%";
          if (k >= a.length) return m;
          var x = a[k++];
          if (c === "s") return typeof x === "string" ? x : inspect(x, 0, [0]);
          if (c === "d") return typeof x === "bigint" ? x + "n" : String(Number(x));
          if (c === "i") return String(parseInt(x, 10));
          if (c === "f") return String(parseFloat(x));
          if (c === "j") { try { return JSON.stringify(x); } catch (e) { return "[Circular]"; } }
          if (c === "c") return "";
          return inspect(x, 4, [0]);
        });
        for (; k < a.length; k++) s += " " + (typeof a[k] === "string" ? a[k] : inspect(a[k]));
        return s;
      }
      return a.map(function (x) { return typeof x === "string" ? x : inspect(x); }).join(" ");
    }
    function indentLines(s) { return groupIndent ? groupIndent + s.split("\n").join("\n" + groupIndent) : s; }
    var counts = Object.create(null), clocks = Object.create(null);
    var consoleObj = {
      log: function () { write(false, indentLines(format(arguments)) + "\n"); },
      error: function () { write(true, indentLines(format(arguments)) + "\n"); },
      dir: function (v) { write(false, indentLines(inspect(v, 2, [0])) + "\n"); },
      assert: function (c) { if (!c) { var r = Array.prototype.slice.call(arguments, 1); write(true, "Assertion failed" + (r.length ? ": " + format(r) : "") + "\n"); } },
      group: function () { if (arguments.length) consoleObj.log.apply(null, arguments); groupIndent += "  "; },
      groupEnd: function () { groupIndent = groupIndent.slice(2); },
      count: function (l) { l = l === undefined ? "default" : String(l); counts[l] = (counts[l] || 0) + 1; consoleObj.log(l + ": " + counts[l]); },
      countReset: function (l) { counts[l === undefined ? "default" : String(l)] = 0; },
      time: function (l) { clocks[l === undefined ? "default" : String(l)] = performance.now(); },
      timeEnd: function (l) { l = l === undefined ? "default" : String(l); if (clocks[l] !== undefined) { consoleObj.log(l + ": " + (performance.now() - clocks[l]).toFixed(3) + "ms"); delete clocks[l]; } },
      timeLog: function (l) { l = l === undefined ? "default" : String(l); if (clocks[l] !== undefined) consoleObj.log(l + ": " + (performance.now() - clocks[l]).toFixed(3) + "ms"); },
      trace: function () { consoleObj.error("Trace: " + format(arguments) + "\n" + mapStack(String(new Error().stack).split("\n").slice(2).join("\n"))); },
      table: function (d) { consoleObj.log(d); }
    };
    consoleObj.info = consoleObj.debug = consoleObj.log;
    consoleObj.warn = consoleObj.error;
    consoleObj.groupCollapsed = consoleObj.group;

    /* ---------------------------------------------------------------- bộ hẹn giờ (theo dõi để biết lúc nào chương trình "xong") */
    function mkTimeout(fn, ms) {
      var rest = Array.prototype.slice.call(arguments, 2), id;
      nTimers++;
      id = realSetTimeout(function () { if (timers[id]) { delete timers[id]; nTimers--; } if (!exited) fn.apply(null, rest); }, ms);
      timers[id] = 1;
      return id;
    }
    function mkInterval(fn, ms) {
      var rest = Array.prototype.slice.call(arguments, 2), id = realSetInterval(function () { if (!exited) fn.apply(null, rest); }, ms);
      timers[id] = 2; nTimers++;
      return id;
    }
    function clearT(id) { if (timers[id]) { delete timers[id]; nTimers--; } realClearTimeout(id); realClearInterval(id); }
    function sleepFree(fn) { return mkTimeout(fn, 0); }

    /* ---------------------------------------------------------------- stdin */
    function readInput() { stdinPos = stdinText.length; return stdinText; }
    function readLine() {
      if (stdinPos >= stdinText.length) return null;
      var nl = stdinText.indexOf("\n", stdinPos), line;
      if (nl < 0) { line = stdinText.slice(stdinPos); stdinPos = stdinText.length; } else { line = stdinText.slice(stdinPos, nl); stdinPos = nl + 1; }
      return line.replace(/\r$/, "");
    }

    /* ---------------------------------------------------------------- mô-đun lõi nhỏ */
    function notAvail(name) { var e = new Error("Mô-đun '" + name + "' không có trong bộ chạy trình duyệt (chỉ có: fs, readline, util, assert, path, events, os, perf_hooks)."); e.code = "MODULE_NOT_FOUND"; return e; }
    function Emitter() { this._ev = Object.create(null); }
    Emitter.prototype.on = Emitter.prototype.addListener = function (n, f) { (this._ev[n] = this._ev[n] || []).push(f); return this; };
    Emitter.prototype.once = function (n, f) { var self = this; function w() { self.off(n, w); return f.apply(this, arguments); } w.listener = f; return this.on(n, w); };
    Emitter.prototype.off = Emitter.prototype.removeListener = function (n, f) { var l = this._ev[n]; if (l) this._ev[n] = l.filter(function (x) { return x !== f && x.listener !== f; }); return this; };
    Emitter.prototype.removeAllListeners = function (n) { if (n === undefined) this._ev = Object.create(null); else delete this._ev[n]; return this; };
    Emitter.prototype.emit = function (n) { var l = (this._ev[n] || []).slice(), a = Array.prototype.slice.call(arguments, 1); if (n === "error" && !l.length) throw a[0]; for (var i = 0; i < l.length; i++) l[i].apply(this, a); return l.length > 0; };
    Emitter.prototype.listenerCount = function (n) { return (this._ev[n] || []).length; };
    Emitter.EventEmitter = Emitter;

    function readStdinOnce() { var s = stdinText.slice(stdinPos); stdinPos = stdinText.length; return s; }
    var fsMod = {
      readFileSync: function (p, enc) {
        if (p === 0 || p === "/dev/stdin") return readStdinOnce();
        var k = String(p).replace(/^\.\//, "").replace(/^\//, "");
        if (k in vfs) return vfs[k];
        var e = new Error("ENOENT: no such file or directory, open '" + p + "'"); e.code = "ENOENT"; throw e;
      },
      writeFileSync: function (p, d) { vfs[String(p).replace(/^\.\//, "").replace(/^\//, "")] = String(d); },
      appendFileSync: function (p, d) { var k = String(p).replace(/^\.\//, "").replace(/^\//, ""); vfs[k] = (vfs[k] || "") + String(d); },
      existsSync: function (p) { return String(p).replace(/^\.\//, "").replace(/^\//, "") in vfs; },
      writeSync: function (fd, s) { s = String(s); write(fd === 2, s); return s.length; },
      readdirSync: function () { return Object.keys(vfs); }
    };
    function makeInterface() {
      var em = new Emitter(), lines = null, closed = false, started = false;
      function pump() {
        if (started) return; started = true;
        sleepFree(function () {
          var l;
          while (!closed && (l = readLine()) !== null) em.emit("line", l);
          if (!closed) { closed = true; em.emit("close"); }
        });
      }
      var on = em.on;
      em.on = function (n) { on.apply(em, arguments); if (n === "line" || n === "close") pump(); return em; };
      em.question = function (q, cb) { write(false, String(q)); var l = readLine(); sleepFree(function () { cb(l === null ? "" : l); }); };
      em.close = function () { if (!closed) { closed = true; sleepFree(function () { em.emit("close"); }); } };
      em.setPrompt = em.prompt = function () {};
      em[Symbol.asyncIterator] = function () {
        return { next: function () { var l = readLine(); return Promise.resolve(l === null ? { done: true, value: undefined } : { done: false, value: l }); }, "return": function () { return Promise.resolve({ done: true }); } };
      };
      return em;
    }
    function deepEq(a, b) {
      if (Object.is(a, b)) return true;
      if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
      if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var i = 0; i < ka.length; i++) if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEq(a[ka[i]], b[ka[i]])) return false;
      return true;
    }
    function AssertionError(msg, actual, expected) { var e = new Error(msg); e.name = "AssertionError"; e.code = "ERR_ASSERTION"; e.actual = actual; e.expected = expected; return e; }
    function assert(c, m) { if (!c) throw m instanceof Error ? m : AssertionError(m || "The expression evaluated to a falsy value", c, true); }
    assert.ok = assert;
    assert.equal = function (a, b, m) { if (a != b) throw AssertionError(m || inspect(a, 2, [0]) + " == " + inspect(b, 2, [0]), a, b); };
    assert.strictEqual = function (a, b, m) { if (!Object.is(a, b)) throw AssertionError(m || "Expected values to be strictly equal:\n\n" + inspect(a, 2, [0]) + " !== " + inspect(b, 2, [0]) + "\n", a, b); };
    assert.notStrictEqual = function (a, b, m) { if (Object.is(a, b)) throw AssertionError(m || "Expected \"actual\" to be strictly unequal to: " + inspect(b, 2, [0]), a, b); };
    assert.deepStrictEqual = assert.deepEqual = function (a, b, m) { if (!deepEq(a, b)) throw AssertionError(m || "Expected values to be strictly deep-equal:\n" + inspect(a) + "\n\nshould equal\n\n" + inspect(b), a, b); };
    assert.throws = function (fn, m) { var th = false; try { fn(); } catch (e) { th = true; } if (!th) throw AssertionError(typeof m === "string" ? m : "Missing expected exception.", undefined, undefined); };
    assert.fail = function (m) { throw AssertionError(m || "Failed", undefined, undefined); };
    assert.AssertionError = AssertionError;
    var pathMod = {
      sep: "/", delimiter: ":",
      normalize: function (p) { var abs = p.charAt(0) === "/", out = []; p.split("/").forEach(function (s) { if (!s || s === ".") return; if (s === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else if (!abs) out.push(".."); } else out.push(s); }); return (abs ? "/" : "") + out.join("/") || (abs ? "/" : "."); },
      join: function () { return pathMod.normalize(Array.prototype.filter.call(arguments, Boolean).join("/")); },
      resolve: function () { var p = ""; for (var i = arguments.length - 1; i >= 0 && p.charAt(0) !== "/"; i--) if (arguments[i]) p = arguments[i] + (p ? "/" + p : ""); return pathMod.normalize(p.charAt(0) === "/" ? p : "/" + p); },
      dirname: function (p) { var i = p.replace(/\/+$/, "").lastIndexOf("/"); return i < 0 ? "." : i === 0 ? "/" : p.slice(0, i); },
      basename: function (p, ext) { var b = p.replace(/\/+$/, "").split("/").pop(); return ext && b.slice(-ext.length) === ext ? b.slice(0, -ext.length) : b; },
      extname: function (p) { var b = p.split("/").pop(), i = b.lastIndexOf("."); return i <= 0 ? "" : b.slice(i); },
      isAbsolute: function (p) { return p.charAt(0) === "/"; }
    };
    var utilMod = {
      inspect: function (v, o) { return inspect(v, o && typeof o.depth === "number" ? o.depth : 2, [0]); }, format: function () { return format(arguments); },
      promisify: function (fn) { return function () { var a = Array.prototype.slice.call(arguments), self = this; return new Promise(function (res, rej) { a.push(function (e, v) { e ? rej(e) : res(v); }); fn.apply(self, a); }); }; },
      isDeepStrictEqual: deepEq, TextEncoder: G.TextEncoder, TextDecoder: G.TextDecoder
    };
    var builtins = {
      fs: fsMod, readline: { createInterface: makeInterface }, util: utilMod, assert: assert, path: pathMod, events: Emitter,
      os: { EOL: "\n", platform: function () { return "browser"; }, cpus: function () { return []; }, homedir: function () { return "/"; }, tmpdir: function () { return "/tmp"; } },
      perf_hooks: { performance: G.performance }
    };

    /* ---------------------------------------------------------------- process */
    var stdinEm = new Emitter(), stdinStarted = false;
    function pumpStdin() {
      if (stdinStarted) return; stdinStarted = true;
      sleepFree(function () { var s = readStdinOnce(); if (s) stdinEm.emit("data", s); stdinEm.emit("end"); stdinEm.emit("close"); });
    }
    var stdinOn = stdinEm.on;
    stdinEm.on = function (n) { stdinOn.apply(stdinEm, arguments); if (n === "data" || n === "end" || n === "close" || n === "readable") pumpStdin(); return stdinEm; };
    stdinEm.setEncoding = stdinEm.resume = stdinEm.pause = function () { return stdinEm; };
    stdinEm.read = function () { var s = readStdinOnce(); return s || null; };
    stdinEm.isTTY = false; stdinEm.fd = 0;
    var processObj = {
      argv: [], env: {}, platform: "browser", pid: 1, arch: "wasm", version: "v0.0.0-browser", versions: {}, exitCode: undefined,
      cwd: function () { return "/"; }, uptime: function () { return (Date.now() - t0) / 1000; },
      exit: function (c) { var e = { __csExit: c === undefined ? (processObj.exitCode | 0) : c | 0 }; throw e; },
      nextTick: function (fn) { var a = Array.prototype.slice.call(arguments, 1); G.queueMicrotask(function () { fn.apply(null, a); }); },
      hrtime: function (prev) { var ms = performance.now(), s = Math.floor(ms / 1000), ns = Math.round((ms % 1000) * 1e6); if (prev) { s -= prev[0]; ns -= prev[1]; if (ns < 0) { s--; ns += 1e9; } } return [s, ns]; },
      memoryUsage: function () { return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }; },
      on: function (n, f) { if (n === "exit") exitHandlers.push(f); return processObj; },
      stdout: { write: function (s) { write(false, s); return true; }, isTTY: false, columns: 80, fd: 1 },
      stderr: { write: function (s) { write(true, s); return true; }, isTTY: false, columns: 80, fd: 2 },
      stdin: stdinEm
    };
    processObj.hrtime.bigint = function () { return BigInt(Math.round(performance.now() * 1e6)); };

    /* ---------------------------------------------------------------- hệ mô-đun */
    function dirOf(name) { var i = name.lastIndexOf("/"); return i < 0 ? "" : name.slice(0, i); }
    function join(dir, rel) {
      var parts = (rel.charAt(0) === "/" ? rel : (dir ? dir + "/" : "") + rel).split("/"), out = [];
      parts.forEach(function (s) { if (!s || s === ".") return; if (s === "..") out.pop(); else out.push(s); });
      return out.join("/");
    }
    function resolveFile(dir, id) {
      var base = join(dir, id), c = [base, base + ".js", base + ".cjs", base + ".mjs", base + ".json", base + "/index.js"];
      for (var i = 0; i < c.length; i++) if (defs[c[i]] || (c[i] in jsons)) return c[i];
      return null;
    }
    function loadModule(name, parent) {
      if (cache[name]) return cache[name].exports;
      if (name in jsons) { var jm = { exports: JSON.parse(jsons[name]), id: name, loaded: true }; cache[name] = jm; return jm.exports; }
      var fn = defs[name], mod = { exports: {}, id: name, filename: name, loaded: false, parent: parent || null, children: [] };
      cache[name] = mod;
      if (!mainModule) mainModule = mod;
      var dir = dirOf(name);
      try { fn.call(mod.exports, mod.exports, makeRequire(dir), mod, name, dir || "."); }
      catch (e) { delete cache[name]; throw e; }
      mod.loaded = true;
      return mod.exports;
    }
    function makeRequire(dir) {
      var req = function (id) {
        id = String(id);
        var bare = id.replace(/^node:/, "");
        if (!/^\.{0,2}\//.test(id) && id !== "." && id !== "..") {
          if (Object.prototype.hasOwnProperty.call(builtins, bare)) return builtins[bare];
          if (/^(child_process|http|https|net|tls|dgram|dns|cluster|worker_threads|crypto|zlib|stream|buffer|vm|v8|repl|tty|url|querystring|string_decoder|timers)$/.test(bare)) throw notAvail(bare);
          var e = new Error("Cannot find module '" + id + "' — trình duyệt không có npm; chỉ require được tệp trong dự án (./x.js) và vài mô-đun lõi nhỏ."); e.code = "MODULE_NOT_FOUND"; throw e;
        }
        var f = resolveFile(dir, id);
        if (!f) { var e2 = new Error("Cannot find module '" + id + "' (không có tệp này trong dự án)"); e2.code = "MODULE_NOT_FOUND"; throw e2; }
        return loadModule(f, null);
      };
      req.main = mainModule; req.cache = cache;
      req.resolve = function (id) { var f = resolveFile(dir, id); if (!f) throw new Error("Cannot find module '" + id + "'"); return f; };
      return req;
    }

    /* ---------------------------------------------------------------- chặn mạng (rào chắn mức tai nạn, KHÔNG phải sandbox) */
    function block(name) {
      return function () {
        if (blocked.indexOf(name) < 0) blocked.push(name);
        var e = new Error("Mạng bị chặn: " + name + " không dùng được khi chạy JavaScript trong trình duyệt (mã của bạn không được phép ra ngoài). Hãy chạy ở máy chủ nếu cần mạng.");
        e.code = "ERR_NETWORK_BLOCKED";
        if (name === "fetch") return Promise.reject(e);
        throw e;
      };
    }
    ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "Worker", "SharedWorker", "BroadcastChannel"].forEach(function (n) {
      try { Object.defineProperty(G, n, { value: block(n), writable: true, configurable: true }); } catch (e) { /* bỏ qua */ }
    });
    try { Object.defineProperty(G, "postMessage", { value: undefined, writable: true, configurable: true }); } catch (e) { /* bỏ qua */ }

    /* ---------------------------------------------------------------- kết thúc */
    function finish(code) {
      if (exited) return;
      exitCode = code;
      try { exitHandlers.slice().forEach(function (f) { f(code); }); } catch (e) { /* bỏ qua */ }
      flush();
      exited = true;
      Object.keys(timers).forEach(function (id) { realClearTimeout(+id); realClearInterval(+id); });
      post({ t: "done", code: code, ms: (doneMs || Date.now() - t0), blocked: blocked, truncated: truncated });
    }
    function reportError(er) {
      if (er && er.__csExit !== undefined) { finish(er.__csExit); return; }
      var text;
      if (er instanceof Error) text = mapStack(er.stack || (er.name + ": " + er.message));
      else text = "Uncaught " + inspect(er, 4, [0]);
      write(true, text + "\n");
      finish(1);
    }
    G.addEventListener("error", function (ev) { ev.preventDefault(); reportError(ev.error || new Error(ev.message)); });
    G.addEventListener("unhandledrejection", function (ev) { ev.preventDefault(); reportError(ev.reason); });

    /* "xong" = hết hẹn giờ đang chờ; thêm một nhịp ân hạn ngắn vì trình duyệt báo promise bị từ chối (unhandledrejection) ở một tác vụ SAU */
    var quietAt = 0;
    function settle() {
      if (exited) return;
      if (nTimers > 0) { quietAt = 0; realSetTimeout(settle, 4); return; }
      if (!quietAt) { quietAt = Date.now(); realSetTimeout(settle, 15); return; }
      doneMs = quietAt - t0;
      finish(processObj.exitCode | 0);
    }

    /* ---------------------------------------------------------------- điểm vào cho phần đuôi script */
    G.__csDef = function (name, fn) { defs[name] = fn; };
    G.__csJson = function (name, text) { jsons[name] = text; };
    G.__csBoot = function (tbl) {
      table = tbl;
      G.onmessage = function (e) {
        var d = e.data;
        stdinText = String(d.stdin || ""); argsList = d.args || []; mainName = d.main;
        (d.files || []).forEach(function (f) { vfs[f.name] = f.content; });
        processObj.argv = ["node", mainName].concat(argsList);
        G.console = consoleObj; G.print = function () { write(false, Array.prototype.map.call(arguments, function (x) { return typeof x === "string" ? x : inspect(x); }).join(" ") + "\n"); };
        G.readInput = readInput; G.readLine = readLine; G.process = processObj;
        G.setTimeout = mkTimeout; G.setInterval = mkInterval; G.clearTimeout = G.clearInterval = clearT;
        G.setImmediate = function (fn) { var a = Array.prototype.slice.call(arguments, 1); return mkTimeout.apply(null, [fn, 0].concat(a)); };
        G.clearImmediate = clearT;
        t0 = Date.now(); lastFlush = t0;
        try { loadModule(mainName, null); }
        catch (er) { reportError(er); return; }
        G.queueMicrotask(function () { realSetTimeout(settle, 0); });
      };
    };
  }

  /* ====================================================================================================
     Phía luồng chính: dựng script worker, chạy, thu kết quả
     ==================================================================================================== */
  function countLines(s) { var n = 1, i = -1; while ((i = s.indexOf("\n", i + 1)) >= 0) n++; return n; }
  function normLf(s) { return String(s).replace(/\r\n?/g, "\n"); }
  var RE_JS = /\.(?:c|m)?js$/i, RE_JSON = /\.json$/i;

  /** Ghép nguồn worker: prelude + mỗi tệp .js bọc thành hàm mô-đun. → {source, table:[{name,start,count}], contents:{name:text}} */
  function buildSource(files) {
    var parts = [], line = 1, table = [], contents = Object.create(null);
    function push(t) { parts.push(t); line += countLines(t) - 1; }
    push("(" + workerPrelude.toString() + ")();\n");
    files.forEach(function (f) {
      var text = normLf(f.content);
      if (RE_JS.test(f.name)) {
        push("__csDef(" + JSON.stringify(f.name) + ", function (exports, require, module, __filename, __dirname) {\n");
        contents[f.name] = text;
        table.push({ name: f.name, start: line, count: countLines(text) + 1 });   /* +1: dòng "});" kề sau cũng thuộc về tệp (lỗi "Unexpected end of input") */
        push(text + "\n});\n");
      } else if (RE_JSON.test(f.name)) {
        push("__csJson(" + JSON.stringify(f.name) + ", " + JSON.stringify(text) + ");\n");
      }
    });
    push("__csBoot(" + JSON.stringify(table) + ");\n//# sourceURL=cs-run.js\n");
    return { source: parts.join(""), table: table, contents: contents };
  }
  function mapLine(table, line) {
    for (var i = 0; i < table.length; i++) { var m = table[i]; if (line >= m.start && line < m.start + m.count) return { file: m.name, line: Math.min(line - m.start + 1, m.count - 1) }; }
    return null;
  }

  function execute(req, ctx) {
    var main = req.mainFile;
    if (!RE_JS.test(main || "")) {
      var e = new Error("Tệp chính “" + main + "” không phải JavaScript (.js/.cjs/.mjs) — chọn tệp chính trong “Cấu hình chạy”.");
      e.code = "bad_request";
      return Promise.reject(e);
    }
    return new Promise(function (resolve, reject) {
      var built = buildSource(req.files), h;
      try { h = util.workerFromSource(built.source); } catch (er) { reject(er); return; }
      var w = h.worker, out = "", err = "", finished = false, timer = null, t0 = Date.now();
      function kill() { if (timer) { clearTimeout(timer); timer = null; } try { w.terminate(); } catch (e2) { /* đã dừng */ } h.revoke(); }
      function end(stage, extra) {
        if (finished) return;
        finished = true; kill();
        resolve({ compile: null, run: stage, version: "V8 · Web Worker", warnings: extra || [] });
      }
      ctx.onCancel(function () { if (!finished) { finished = true; kill(); var c = new Error("Đã dừng chương trình."); c.code = "cancelled"; reject(c); } });

      w.onmessage = function (ev) {
        var d = ev.data || {};
        if (d.t === "out") { out += d.s; ctx.onProgress({ type: "stdout", text: d.s }); }
        else if (d.t === "err") { err += d.s; ctx.onProgress({ type: "stderr", text: d.s }); }
        else if (d.t === "done") {
          var warn = [];
          if (d.blocked && d.blocked.length) warn.push("Mã gọi " + d.blocked.join(", ") + " nhưng bộ chạy trong trình duyệt không cho ra mạng — chọn nơi chạy ở máy chủ nếu cần mạng.");
          end({ ran: true, ok: d.code === 0, stdout: out, stderr: err, code: d.code, signal: null, ms: d.ms || (Date.now() - t0), timedOut: false, truncated: !!d.truncated }, warn);
        }
      };
      /* lỗi KHÔNG ai bắt: chủ yếu là lỗi cú pháp (script worker không biên dịch được) — có dòng/cột trong script, đổi về tệp của dự án */
      w.onerror = function (ev) {
        if (ev.preventDefault) ev.preventDefault();
        if (finished) return;
        var msg = String(ev.message || "Lỗi không rõ").replace(/^Uncaught\s+/, ""), pos = ev.lineno ? mapLine(built.table, ev.lineno) : null, text;
        if (pos) {
          var srcLine = (built.contents[pos.file] || "").split("\n")[pos.line - 1] || "", col = Math.max(1, ev.colno | 0);
          text = pos.file + ":" + pos.line + "\n" + srcLine + "\n" + new Array(col).join(" ") + "^\n\n" + msg + "\n    at " + pos.file + ":" + pos.line + ":" + col + "\n";
        } else text = msg + "\n";
        end({ ran: true, ok: false, stdout: out, stderr: err + text, code: 1, signal: null, ms: Date.now() - t0, timedOut: false, truncated: false });
      };
      timer = setTimeout(function () {
        if (finished) return;
        end({ ran: true, ok: false, stdout: out, stderr: err, code: null, signal: null, ms: req.runTimeoutMs, timedOut: true, truncated: false });
      }, req.runTimeoutMs);
      ctx.onProgress({ type: "run", message: "Đang chạy JavaScript trong trình duyệt…" });
      w.postMessage({ stdin: req.stdin, args: req.args, main: main, files: req.files.map(function (f) { return { name: f.name, content: f.content }; }) });
    });
  }

  CS.runner.registerExecutor("javascript", execute);
  CS.runner.browserJs = { buildSource: buildSource, mapLine: mapLine };
})(typeof globalThis !== "undefined" ? globalThis : this);
