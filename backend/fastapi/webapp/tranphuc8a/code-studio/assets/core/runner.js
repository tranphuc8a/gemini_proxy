/* runner.js — điều phối "chạy mã" của Code Studio. LÕI THUẦN (không DOM; kiểm bằng node: kiem-chay.js).

   Một lần chạy = CS.runner.run(req, opts) → {promise, cancel()}. Nơi chạy (req.target):
     "browser"        bộ chạy trong trình duyệt do assets/run/browser-{js,py,cpp}.js tự đăng ký (registerExecutor)
     "server:<id>"    POST {apiBase}/run (backend gemini_proxy; provider chọn bằng id: piston, judge0, wandbox, local)
     "piston-custom"  trình duyệt gọi thẳng POST {pistonUrl}/execute (máy Piston tự dựng, cần CORS)
   Kết quả của MỌI nơi chạy được chuẩn hoá về hình dạng phản hồi 200 của /run (docs/code-studio-api.md):
     {ok, provider, language, version, compile:null|stage, run:stage, error:null|{code,message}, warnings:[],
      target, diagnostics:[{file,line,col,severity,message}]}      stage = {ran,ok,stdout,stderr,code,signal,ms,timedOut,truncated}
   Mã người dùng lỗi (biên dịch hỏng, thoát khác 0, quá giờ) là kết quả ok:false BÌNH THƯỜNG; chỉ lỗi hạ tầng (mạng, 4xx/5xx,
   tải thư viện hỏng, huỷ) mới reject Promise bằng Error có `.code` và thông báo tiếng Việt.
   Phụ thuộc: CS.project (isAllowedFlag/compileFlags/detectMain) — nạp project.js trước file này. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  /* ------------------------------------------------------------------ bảng ngôn ngữ */
  var BROWSER_LANGS = { javascript: 1, python: 1, c: 1, cpp: 1 };
  /* ngôn ngữ → tên của Piston (docs: piston_executor.LANGUAGE_MAP) */
  var PISTON_LANG = { c: "c", cpp: "c++", java: "java", python: "python", javascript: "javascript", typescript: "typescript", go: "go",
    rust: "rust", csharp: "csharp", kotlin: "kotlin", php: "php", ruby: "ruby", bash: "bash" };
  /* tên/bí danh Piston → ngôn ngữ của ta (đọc phản hồi) */
  var PISTON_BACK = { c: "c", "c++": "cpp", cpp: "cpp", java: "java", python: "python", python3: "python", py: "python", javascript: "javascript",
    node: "javascript", js: "javascript", typescript: "typescript", ts: "typescript", go: "go", golang: "go", rust: "rust", rs: "rust",
    csharp: "csharp", "c#": "csharp", "csharp.net": "csharp", mono: "csharp", kotlin: "kotlin", kt: "kotlin", php: "php", ruby: "ruby",
    rb: "ruby", bash: "bash", sh: "bash" };
  var ALIASES = { "c++": "cpp", cxx: "cpp", cc: "cpp", py: "python", python3: "python", js: "javascript", node: "javascript", nodejs: "javascript",
    ts: "typescript", golang: "go", rs: "rust", "c#": "csharp", cs: "csharp", kt: "kotlin", rb: "ruby", sh: "bash", shell: "bash" };
  var EXTS = { c: [".c"], cpp: [".cpp", ".cc", ".cxx", ".c++"], java: [".java"], python: [".py"], javascript: [".js", ".mjs", ".cjs"], typescript: [".ts"],
    go: [".go"], rust: [".rs"], csharp: [".cs"], kotlin: [".kt"], php: [".php"], ruby: [".rb"], bash: [".sh", ".bash"] };
  var MAIN_NAMES = { c: ["main.c"], cpp: ["main.cpp", "main.cc", "main.cxx"], java: ["Main.java"], python: ["main.py", "__main__.py"],
    javascript: ["main.js", "index.js"], typescript: ["main.ts", "index.ts"], go: ["main.go"], rust: ["main.rs"], csharp: ["Program.cs", "Main.cs"],
    kotlin: ["Main.kt", "main.kt"], php: ["main.php", "index.php"], ruby: ["main.rb"], bash: ["main.sh", "script.sh"] };
  var LANG_NAME = { c: "C", cpp: "C++", java: "Java", python: "Python", javascript: "JavaScript", typescript: "TypeScript", go: "Go", rust: "Rust",
    csharp: "C#", kotlin: "Kotlin", php: "PHP", ruby: "Ruby", bash: "Bash" };

  var MAX_STREAM_BYTES = 1024 * 1024;           /* như backend: mỗi luồng stdout/stderr giữ tối đa 1 MiB */
  var DEFAULT_RUN_MS = 5000, DEFAULT_COMPILE_MS = 15000, MIN_MS = 100;
  var MAX_DIAGNOSTICS = 200;

  /* ------------------------------------------------------------------ tiện ích nhỏ */
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function str(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }
  function strList(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }) : []; }
  function toInt(v, dflt) {
    var n = typeof v === "number" ? v : parseInt(v, 10);
    return isFinite(n) ? Math.trunc(n) : (dflt === undefined ? null : dflt);
  }
  function num(v, dflt) { var n = Number(v); return isFinite(n) && v !== null && v !== "" && typeof v !== "boolean" ? n : dflt; }
  function trimSlash(s) { return str(s).trim().replace(/\/+$/, ""); }
  function langName(id) {
    try { if (CS.langs && CS.langs.get) { var l = CS.langs.get(id); if (l && l.id !== "plaintext") return l.name; } } catch (e) { /* bỏ qua */ }
    return LANG_NAME[id] || String(id);
  }
  function canonLang(v) { var k = str(v).trim().toLowerCase(); return ALIASES[k] || k; }
  function basename(p) { var i = p.lastIndexOf("/"); return i < 0 ? p : p.slice(i + 1); }
  function cleanName(n) {
    var p = str(n).replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    while (p.slice(0, 2) === "./") p = p.slice(2);
    return p;
  }
  function endsWithAny(s, list) { s = s.toLowerCase(); for (var i = 0; i < list.length; i++) if (s.slice(-list[i].length) === list[i]) return true; return false; }
  function fileName(f) { return typeof f === "string" ? f : (f && (f.name != null ? f.name : f.path)); }
  function makeError(message, code, extra) {
    var e = new Error(message);
    e.code = code || "run_error";
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) e[k] = extra[k];
    return e;
  }
  function safeCall(fn, a) { if (typeof fn !== "function") return; try { fn(a); } catch (e) { /* hàm gọi lại của giao diện không được làm hỏng lần chạy */ } }

  /* ------------------------------------------------------------------ cắt luồng ở 1 MiB (tính theo byte UTF-8) */
  /** Cắt `text` còn tối đa `limit` byte UTF-8 (mặc định 1 MiB), không cắt ngang một ký tự. → {text, truncated, bytes} */
  function splitStdoutLimit(text, limit) {
    text = text == null ? "" : String(text);
    limit = limit > 0 ? limit : MAX_STREAM_BYTES;
    if (text.length * 3 <= limit) return { text: text, truncated: false, bytes: -1 };   /* ≤ 3 byte mỗi đơn vị UTF-16: chắc chắn vừa */
    var bytes = 0, i = 0, n = text.length;
    while (i < n) {
      var c = text.charCodeAt(i), w, step = 1;
      if (c < 0x80) w = 1; else if (c < 0x800) w = 2;
      else if (c >= 0xd800 && c < 0xdc00 && i + 1 < n && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { w = 4; step = 2; }
      else w = 3;
      if (bytes + w > limit) return { text: text.slice(0, i), truncated: true, bytes: bytes };
      bytes += w; i += step;
    }
    return { text: text, truncated: false, bytes: bytes };
  }

  /* ------------------------------------------------------------------ stage / kết quả chuẩn */
  function notRunStage() { return { ran: false, ok: false, stdout: "", stderr: "", code: null, signal: null, ms: 0, timedOut: false, truncated: false }; }
  function crlf(s) { return s.replace(/\r\n/g, "\n"); }
  /** Chuẩn hoá một stage (compile/run) về đủ trường; CRLF → LF (backend chạy trên Windows chèn \r). null nếu không phải object. */
  function normStage(raw) {
    if (!isObj(raw)) return null;
    var o = splitStdoutLimit(crlf(str(raw.stdout))), e = splitStdoutLimit(crlf(str(raw.stderr)));
    var ms = num(raw.ms, 0);
    return { ran: !!raw.ran, ok: !!raw.ok, stdout: o.text, stderr: e.text, code: toInt(raw.code, null), signal: raw.signal ? String(raw.signal) : null,
      ms: ms > 0 ? Math.round(ms) : 0, timedOut: !!raw.timedOut, truncated: !!raw.truncated || o.truncated || e.truncated };
  }
  /** Ráp kết quả và SUY RA ok/error từ hai stage — đúng luật của backend (run_vo.finish). */
  function finish(o) {
    o = o || {};
    var compile = o.compile ? normStage(o.compile) : null, run = o.run ? normStage(o.run) : notRunStage(), error = null;
    if (compile && compile.ran && !compile.ok) error = compile.timedOut ? { code: "compile_timeout", message: "Biên dịch quá thời gian cho phép" } : { code: "compile_error", message: "Biên dịch thất bại" };
    else if (run.ran && !run.ok) error = run.timedOut ? { code: "run_timeout", message: "Chương trình chạy quá thời gian cho phép" } : { code: "runtime_error", message: "Chương trình kết thúc với lỗi" };
    var ok = !error && run.ran;
    if (!ok && !error) error = { code: "runtime_error", message: "Chương trình không chạy được" };
    return { ok: ok, provider: str(o.provider), language: str(o.language), version: str(o.version), compile: compile, run: run, error: error, warnings: strList(o.warnings) };
  }
  function normError(e) { return isObj(e) && e.code ? { code: str(e.code), message: str(e.message) } : null; }

  /** Phản hồi 200 của POST /run → hình dạng chuẩn (điền trường thiếu). Ném Error "bad_response" nếu không đọc được. */
  function normalizeServerResult(json) {
    if (!isObj(json) || (!isObj(json.run) && !isObj(json.compile))) throw makeError("Máy chủ trả về dữ liệu chạy mã không đúng định dạng.", "bad_response");
    var res = { ok: !!json.ok, provider: str(json.provider), language: str(json.language), version: str(json.version),
      compile: normStage(json.compile), run: normStage(json.run) || notRunStage(), error: normError(json.error), warnings: strList(json.warnings) };
    if (!res.ok && !res.error) res.error = { code: "runtime_error", message: "Chương trình không chạy được" };
    if (res.ok) res.error = null;
    return res;
  }

  /** Một stage của Piston → stage chuẩn (cùng luật với piston_executor._stage của backend). */
  function pistonStage(raw, elapsed, timeoutMs, fallbackMs) {
    var o = splitStdoutLimit(str(raw.stdout != null ? raw.stdout : "")), e = splitStdoutLimit(str(raw.stderr != null ? raw.stderr : ""));
    var status = raw.status || null, signal = raw.signal || null, code = toInt(raw.code, null);
    var timedOut = status === "TO" || (status == null && signal === "SIGKILL" && elapsed >= 0.95 * timeoutMs);
    var wall = typeof raw.wall_time === "number" ? raw.wall_time : null;
    return { ran: true, ok: code === 0 && signal == null && status == null, stdout: crlf(o.text), stderr: crlf(e.text), code: code,
      signal: signal ? String(signal) : null, ms: Math.max(0, Math.round(wall != null ? wall : fallbackMs)), timedOut: timedOut,
      truncated: o.truncated || e.truncated || status === "OL" || status === "EL" };
  }
  /**
   * Phản hồi của Piston ({language, version, run:{stdout,stderr,code,signal,output,status?,wall_time?}, compile?:{…}}) → hình dạng chuẩn.
   * o: {language, runTimeoutMs, compileTimeoutMs, elapsedMs, warnings}
   */
  function normalizePiston(json, o) {
    o = o || {};
    if (!isObj(json) || (!isObj(json.run) && !isObj(json.compile))) throw makeError("Piston trả về dữ liệu không đúng định dạng.", "bad_response");
    var elapsed = num(o.elapsedMs, 0), runT = num(o.runTimeoutMs, DEFAULT_RUN_MS), compT = num(o.compileTimeoutMs, DEFAULT_COMPILE_MS);
    var compile = isObj(json.compile) ? pistonStage(json.compile, elapsed, compT, 0) : null, run;
    if (compile && !compile.ok) run = notRunStage();
    else if (isObj(json.run)) run = pistonStage(json.run, elapsed, runT, elapsed);
    else throw makeError("Piston không trả kết quả chạy.", "bad_response");
    var lang = o.language || PISTON_BACK[str(json.language).toLowerCase()] || str(json.language);
    return finish({ provider: "piston", language: lang, version: typeof json.version === "string" ? json.version : "", compile: compile, run: run, warnings: o.warnings });
  }

  /* ------------------------------------------------------------------ lỗi hạ tầng → thông báo tiếng Việt */
  function firstDetail(body) {
    if (!isObj(body)) return "";
    var d = body.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length && isObj(d[0]) && d[0].msg) return str(d[0].msg);
    return "";
  }
  /**
   * Mã HTTP + phong bì lỗi của backend {status_code, message, data:{code,…}} (hoặc {message} của Piston) → Error có
   * .code (data.code), .status, .retryAfter (giây, nếu có), .data. Thông báo tiếng Việt, người dùng đọc được.
   */
  function friendlyError(status, body) {
    var data = isObj(body) && isObj(body.data) ? body.data : {};
    var code = str(data.code) || (status ? "http_" + status : "network");
    var backendMsg = isObj(body) && typeof body.message === "string" ? body.message : "";
    var retry = toInt(data.retryAfter != null ? data.retryAfter : (isObj(body) ? body.retryAfter : null), null);
    var msg;
    if (!status) { msg = "Không kết nối được máy chủ — kiểm tra mạng rồi thử lại."; code = "network"; }
    else if (status === 400) {
      if (code === "run_unknown_provider") msg = "Nơi chạy này không tồn tại trên máy chủ.";
      else if (code === "run_language_unsupported") msg = "Nơi chạy này không hỗ trợ ngôn ngữ đang chọn.";
      else if (code === "run_bad_flag") msg = "Cờ biên dịch " + (data.flag ? "'" + data.flag + "' " : "") + "không được phép" + (backendMsg ? " — " + backendMsg : ".");
      else if (code === "run_multifile_unsupported") msg = "Nơi chạy này chỉ nhận một tệp — chọn nơi chạy khác hoặc gộp thành một tệp.";
      else msg = backendMsg || "Yêu cầu chạy mã không hợp lệ.";
    } else if (status === 401 || status === 403) {
      msg = code === "admin_required" ? "Cần khoá quản trị để dùng máy chủ cục bộ." : (backendMsg || "Không có quyền dùng nơi chạy này.");
    } else if (status === 404) { msg = "Máy chủ không có chức năng chạy mã (không thấy đường dẫn /run) — backend có thể chưa cập nhật."; code = code === "http_404" ? "run_not_found" : code; }
    else if (status === 413) msg = "Mã quá lớn để gửi đi (tối đa 256 KB cho mọi tệp).";
    else if (status === 422) msg = "Dữ liệu gửi đi không hợp lệ" + (firstDetail(body) ? " (" + firstDetail(body) + ")" : " (quá dài hoặc sai kiểu).");
    else if (status === 429) {
      if (code === "run_busy") msg = "Máy chủ đang bận chạy mã khác — thử lại sau ít giây.";
      else msg = retry ? "Chạy quá nhanh, thử lại sau " + retry + " giây." : "Chạy quá nhanh, thử lại sau ít giây.";
      if (code === "http_429") code = "run_rate_limited";
    } else if (status === 502) {
      if (code === "run_provider_rejected") msg = backendMsg || "Nơi chạy từ chối yêu cầu.";
      else msg = "Nơi chạy" + (data.provider ? " '" + data.provider + "'" : "") + " đang không phản hồi — thử nơi chạy khác." + (data.detail ? " (" + data.detail + ")" : "");
    } else if (status === 503) {
      if (code === "run_disabled") msg = "Chạy mã trên máy chủ đang bị tắt.";
      else msg = backendMsg || "Nơi chạy này chưa dùng được.";
    } else if (status === 504) msg = "Nơi chạy trả lời quá chậm — thử lại hoặc chọn nơi chạy khác.";
    else if (status >= 500) msg = "Máy chủ gặp lỗi (HTTP " + status + ") — thử lại sau.";
    else msg = backendMsg || "Yêu cầu bị từ chối (HTTP " + status + ").";
    return makeError(msg, code, { status: status || 0, retryAfter: retry, data: data });
  }

  /* ------------------------------------------------------------------ cờ biên dịch, tệp chính */
  /**
   * Cờ biên dịch gửi đi: -std=<std>, -<opt>, rồi `extra` — CHỈ cờ backend cho phép (CS.project.isAllowedFlag), chỉ cho C/C++.
   * → {flags:[…], rejected:[{flag, reason}]}
   */
  function buildCompileArgs(o) {
    o = o || {};
    var P = CS.project;
    if (!P || !P.compileFlags) throw makeError("Thiếu core/project.js (nạp trước runner.js).", "missing_dependency");
    var r = P.compileFlags({ language: canonLang(o.language), meta: { std: o.std, opt: o.opt } }, { compileArgs: o.extra });
    return { flags: r.flags, rejected: r.rejected };
  }
  /** Tệp chính: `requested` nếu có trong danh sách; không thì theo quy ước ngôn ngữ (như backend), rồi tệp chứa main(), rồi tệp cùng đuôi đầu tiên. */
  function mainFileFor(language, files, requested) {
    language = canonLang(language);
    var list = files || [], names = [], i;
    for (i = 0; i < list.length; i++) { var n = fileName(list[i]); names.push(typeof n === "string" ? cleanName(n) : ""); }
    names = names.filter(Boolean);
    if (!names.length) return "";
    if (requested) { var r = cleanName(requested); if (names.indexOf(r) >= 0) return r; }
    var conv = MAIN_NAMES[language] || [], exts = EXTS[language] || [], j, k;
    for (j = 0; j < conv.length; j++) for (k = 0; k < names.length; k++) if (names[k] === conv[j] || names[k].slice(-(conv[j].length + 1)) === "/" + conv[j]) return names[k];
    var P = CS.project;
    if (P && P.detectMain && typeof list[0] === "object") {
      try {
        var m = P.detectMain({ language: language, files: list.map(function (f) { return { path: cleanName(fileName(f)), content: str(f && f.content) }; }) });
        if (m && names.indexOf(m) >= 0) return m;
      } catch (e) { /* dùng cách đơn giản bên dưới */ }
    }
    for (k = 0; k < names.length; k++) if (endsWithAny(names[k], exts)) return names[k];
    return names[0];
  }

  /* ------------------------------------------------------------------ phân tích chẩn đoán */
  function makeIndex(files) {
    if (!files || !files.length) return null;
    var names = [], contents = Object.create(null), set = Object.create(null), baseCount = Object.create(null);
    files.forEach(function (f) {
      var n = fileName(f);
      if (typeof n !== "string") return;
      n = cleanName(n); names.push(n); set[n] = 1;
      if (f && typeof f === "object" && typeof f.content === "string") contents[n] = f.content;
      var b = basename(n); baseCount[b] = (baseCount[b] || 0) + 1;
    });
    return { names: names, set: set, contents: contents, baseCount: baseCount };
  }
  function collapse(p) {
    var out = [];
    p.split("/").forEach(function (seg) {
      if (seg === "" || seg === ".") return;
      if (seg === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else out.push(".."); } else out.push(seg);
    });
    return out.join("/");
  }
  /** Tên tệp trong thông báo của trình biên dịch (tuyệt đối, ./x, a\b…) → tên tệp của dự án. {file, known:true|false|undefined} */
  function resolveName(raw, index) {
    var p = str(raw).replace(/\\/g, "/").trim().replace(/^["'`]+|["'`]+$/g, "").replace(/^file:\/+/i, "");
    p = collapse(p);
    if (!index) return { file: p, known: undefined };
    if (index.set[p]) return { file: p, known: true };
    var s = "/" + p, best = "", i;
    for (i = 0; i < index.names.length; i++) {
      var n = index.names[i];
      if (s.length > n.length + 1 && s.slice(-(n.length + 1)) === "/" + n && n.length > best.length) best = n;
    }
    if (best) return { file: best, known: true };
    var b = basename(p);
    if (index.baseCount[b] === 1) for (i = 0; i < index.names.length; i++) if (basename(index.names[i]) === b) return { file: index.names[i], known: true };
    return { file: p, known: false };
  }
  function makeCollector(index) {
    var list = [], seen = Object.create(null);
    function add(rawFile, line, col, severity, message) {
      var r = rawFile ? resolveName(rawFile, index) : { file: "", known: undefined };
      /* thông báo nằm ngoài dự án (tệp tiêu đề hệ thống…): chỉ giữ lỗi, bỏ cảnh báo/ghi chú cho đỡ ồn */
      if (index && rawFile && r.known === false && severity !== "error") return;
      message = str(message).replace(/\s+$/, "");
      var key = r.file + "|" + line + "|" + col + "|" + severity + "|" + message;
      if (seen[key]) return;
      seen[key] = 1;
      list.push({ file: r.file, line: line | 0, col: col | 0, severity: severity, message: message });
    }
    return { add: add, list: list };
  }
  function userFrame(file, index, extraSkip) {
    if (index) return resolveName(file, index).known === true;
    var f = str(file).replace(/\\/g, "/");
    return !!f && !/^</.test(f) && !/^node:/.test(f) && !(extraSkip && extraSkip.test(f));
  }
  function indentOf(line, file, index) {
    if (!index) return 0;
    var r = resolveName(file, index), src = index.contents[r.file];
    if (typeof src !== "string") return 0;
    var l = src.replace(/\r\n?/g, "\n").split("\n")[line - 1] || "", m = /^[ \t\f]*/.exec(l);
    return m ? m[0].length : 0;
  }
  /* "chỉ báo mọi frame của người dùng": lỗi ở frame trong cùng, các lời gọi dẫn tới nó là ghi chú */
  function addFrames(frames, add, msg, note) {
    if (!frames.length) { if (msg) add("", 0, 0, "error", msg); return; }
    var inner = frames[frames.length - 1];
    add(inner.file, inner.line, inner.col || 0, "error", msg);
    var shown = 0;
    for (var k = frames.length - 2; k >= 0 && shown < 4; k--, shown++) add(frames[k].file, frames[k].line, frames[k].col || 0, "note", note(frames[k]));
  }

  /* gcc / clang / kotlinc: file:line:col: error|warning|note: … ; cả "fatal error"; bỏ "In file included from", "In function", caret */
  function parseGcc(lines, add) {
    var re = /^(.+?):(\d+):(?:(\d+):)? (fatal error|error|warning|note): (.*)$/;
    var tool = /^[\w+.\-\/\\:]*?(?:clang\+\+|clang|g\+\+|gcc|cc|c\+\+)(?:\.exe)?: (fatal error|error|warning): (.*)$/;
    var wasmLd = /^(?:wasm-ld|ld\.lld|lld|ld|ld\.exe)(?:\.exe)?: (error|warning): (.*)$/;
    var undef = /(?:^|[\s:])([\w.\-\/]+\.(?:c|cc|cpp|cxx|c\+\+)):\(\.[\w.]+\+0x[0-9a-f]+\): (undefined reference to .+)$/i;
    var undefAny = /(undefined reference to .+)$/;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i], m = re.exec(l);
      if (m) { add(m[1], +m[2], m[3] ? +m[3] : 0, m[4] === "fatal error" ? "error" : m[4], m[5]); continue; }
      if ((m = undef.exec(l))) { add(m[1], 0, 0, "error", "(liên kết) " + m[2]); continue; }
      if ((m = wasmLd.exec(l))) { add("", 0, 0, m[1], "(liên kết) " + m[2].replace(/^\S+\.o: /, "")); continue; }
      if ((m = tool.exec(l))) {
        if (/linker command failed|ld returned/.test(m[2])) continue;
        add("", 0, 0, m[1] === "fatal error" ? "error" : m[1], m[2]); continue;
      }
      if (/ld(?:\.exe)?: /.test(l) && (m = undefAny.exec(l))) add("", 0, 0, "error", "(liên kết) " + m[1]);
    }
  }

  /* javac: File.java:12: error: … kèm dòng mã + caret (lấy cột); và ngoại lệ lúc chạy "Exception in thread … at X(File.java:N)" */
  function parseJava(lines, add, index) {
    var re = /^(.+?\.java):(\d+): (error|warning): (.*)$/, frameRe = /^\s+at\s+([^\s(]+)\(([^():]+\.java):(\d+)\)\s*$/;
    var i, m, j;
    for (i = 0; i < lines.length; i++) {
      m = re.exec(lines[i]);
      if (m) {
        var col = 0, next = i + 1;
        if (lines[i + 2] != null && /^\s*\^\s*$/.test(lines[i + 2])) { col = lines[i + 2].indexOf("^") + 1; next = i + 3; }
        var extra = [];
        for (j = next; j < lines.length && /^ {2}\S/.test(lines[j]) && extra.length < 3; j++) if (/^ {2}(symbol|location|required|found|reason):/i.test(lines[j])) extra.push(lines[j].trim().replace(/\s{2,}/g, " "));
        add(m[1], +m[2], col, m[3], m[4] + (extra.length ? " (" + extra.join("; ") + ")" : ""));
        continue;
      }
      if ((m = /^Exception in thread "[^"]*" (.*)$/.exec(lines[i])) || (m = /^(Error: (?:Could not find or load main class|Main method not found).*)$/.exec(lines[i]))) {
        var msg = m[1], frames = [];
        for (j = i + 1; j < lines.length && frames.length < 40; j++) {
          var fm = frameRe.exec(lines[j]);
          if (fm) { if (userFrame(fm[2], index, null) && !/^(?:java\.|javax\.|jdk\.|sun\.|com\.sun\.)|java\.base\//.test(fm[1])) frames.push({ file: fm[2], line: +fm[3], col: 0, fn: fm[1] }); }
          else if (!/^\s*(Caused by:|Suppressed:|\.\.\. \d+ more)/.test(lines[j]) && lines[j].trim() !== "" && !/^\t/.test(lines[j])) break;
        }
        /* trong cùng = frame ĐẦU của ngăn xếp (nơi ném), nên đảo để addFrames lấy frame cuối làm lỗi */
        addFrames(frames.reverse(), add, msg, function (f) { return "Lời gọi dẫn tới lỗi (" + f.fn + ")"; });
      } else if ((m = /^error: (.+)$/.exec(lines[i]))) add("", 0, 0, "error", m[1]);
    }
  }

  /* Python: Traceback / SyntaxError — mỗi `File "x.py", line N` là một frame; dòng không thụt lề kế tiếp là lỗi */
  function parsePython(lines, add, index) {
    var fileRe = /^\s*File "(.+)", line (\d+)(?:, in (.*))?$/, frames = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i], m = fileRe.exec(l);
      if (m) {
        var fr = { file: m[1], line: +m[2], fn: m[3] || "", col: 0 }, src = lines[i + 1], caret = lines[i + 2];
        if (src != null && /^\s{4}\S/.test(src) && caret != null && /^\s+[~^]+\s*$/.test(caret) && /\^/.test(caret))
          fr.col = caret.search(/[~^]/) - 4 + 1 + indentOf(fr.line, fr.file, index);
        if (fr.col < 0) fr.col = 0;
        frames.push(fr);
        continue;
      }
      if (frames.length && /^\S/.test(l) && !/^Traceback \(most recent call last\)/.test(l)) {
        var mine = frames.filter(function (f) { return userFrame(f.file, index, /site-packages|\/lib\/python|python3\d*\.zip/); });
        addFrames(mine, add, l.trim(), function (f) { return "Lời gọi dẫn tới lỗi" + (f.fn ? " (trong " + f.fn + ")" : ""); });
        frames = [];
      }
    }
  }

  /* Node / V8: "main.js:4" + dòng mã + caret + "ReferenceError: …" + "at fn (main.js:4:7)" */
  function parseNode(lines, add, index) {
    var headRe = /^(.+\.(?:[cm]?js|jsx|tsx?|json)):(\d+)$/, frameRe = /^\s+at (?:.*? \()?(.+?):(\d+):(\d+)\)?\s*$/;
    var skip = /node_modules|\/internal\//, i, m, head = null, k;
    for (i = 0; i < lines.length; i++) {
      m = headRe.exec(lines[i]);
      if (m && lines[i + 2] != null && /^\s*\^+\s*$/.test(lines[i + 2])) {
        var msg = "";
        for (k = i + 3; k < lines.length; k++) if (lines[k].trim()) { msg = lines[k].trim(); break; }
        head = { file: m[1], line: +m[2], col: lines[i + 2].indexOf("^") + 1, msg: msg, at: i };
        break;
      }
    }
    var frames = [], firstFrameAt = -1;
    for (i = head ? head.at : 0; i < lines.length; i++) {
      m = frameRe.exec(lines[i]);
      if (m && userFrame(m[1].replace(/^file:\/+/i, ""), index, skip)) { frames.push({ file: m[1], line: +m[2], col: +m[3] }); if (firstFrameAt < 0) firstFrameAt = i; }
    }
    if (head) {
      add(head.file, head.line, head.col, "error", head.msg || "Lỗi khi chạy");
      var headR = resolveName(head.file, index).file, shown = 0;
      frames.forEach(function (f, idx) {
        if (idx === 0 && resolveName(f.file, index).file === headR && f.line === head.line) return;
        if (shown++ < 4) add(f.file, f.line, f.col, "note", "Lời gọi dẫn tới lỗi");
      });
      return;
    }
    if (!frames.length) {
      /* không có vị trí: vẫn báo dòng lỗi đầu tiên nếu có (vd "SyntaxError: …" từ nơi chạy khác) */
      for (i = 0; i < lines.length; i++) if (/^(?:[A-Za-z_$][\w$]*)?Error: /.test(lines[i])) { add("", 0, 0, "error", lines[i].trim()); break; }
      return;
    }
    /* dòng lỗi = dòng không-phải-frame, không rỗng, gần frame đầu nhất ở phía trên */
    var emsg = "";
    for (i = firstFrameAt - 1; i >= 0; i--) if (lines[i].trim() && !/^\s+at /.test(lines[i])) { emsg = lines[i].trim(); break; }
    /* V8 in frame trong cùng TRƯỚC: đảo để addFrames lấy frame đầu làm lỗi */
    addFrames(frames.slice().reverse(), add, emsg || "Lỗi khi chạy", function () { return "Lời gọi dẫn tới lỗi"; });
  }

  /* Go: ./main.go:4:2: lỗi biên dịch ; panic: … + "\tfile.go:5 +0x14" */
  function parseGo(lines, add, index) {
    var re = /^(?:\.\/)?(.+?\.go):(\d+):(\d+): (.*)$/, frameRe = /^\s+(.+\.go):(\d+)(?: \+0x[0-9a-f]+)?\s*$/, i, m;
    for (i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/^\.\\/, "./");
      if ((m = re.exec(l))) { add(m[1], +m[2], +m[3], "error", m[4]); continue; }
      if ((m = /^panic: (.*)$/.exec(l)) || (m = /^fatal error: (.*)$/.exec(l))) {
        var frames = [], j;
        for (j = i + 1; j < lines.length && frames.length < 40; j++) {
          var fm = frameRe.exec(lines[j]);
          if (fm && userFrame(fm[1], index, /\/go\/src\/|\/usr\/local\/go\/|^runtime\//)) frames.push({ file: fm[1], line: +fm[2], col: 0 });
        }
        addFrames(frames.reverse(), add, (/^fatal/.test(l) ? "fatal error: " : "panic: ") + m[1], function () { return "Lời gọi dẫn tới lỗi"; });
        break;
      }
    }
  }

  /* Rust: error[E0425]: … / "  --> src/main.rs:3:5" ; panic: thread 'main' panicked at src/main.rs:3:5: */
  function parseRust(lines, add) {
    var head = /^(error|warning)(?:\[(\w+)\])?: (.*)$/, arrow = /^\s*--> (.+?):(\d+):(\d+)\s*$/, i, j, m;
    for (i = 0; i < lines.length; i++) {
      if ((m = head.exec(lines[i]))) {
        for (j = i + 1; j < lines.length && j <= i + 4; j++) {
          if (head.test(lines[j])) break;
          var a = arrow.exec(lines[j]);
          if (a) { add(a[1], +a[2], +a[3], m[1], m[3] + (m[2] ? " [" + m[2] + "]" : "")); break; }
        }
      } else if ((m = /^thread '[^']*' panicked at (.+?):(\d+):(\d+):?$/.exec(lines[i]))) {
        add(m[1], +m[2], +m[3], "error", "panic: " + (str(lines[i + 1]).trim() || "chương trình dừng bất thường"));
      }
    }
  }

  /* C# (dotnet/mcs) và TypeScript (tsc): File(l,c): error CS1002: … ; File:l:c - error TS…: … */
  function parseParen(lines, add) {
    var a = /^(.+?)\((\d+),(\d+)\): (error|warning) ([A-Z]+\d+): (.*?)(?: \[[^\]]+\.(?:csproj|sln)\])?$/, b = /^(.+?):(\d+):(\d+) - (error|warning) ([A-Z]+\d+): (.*)$/;
    for (var i = 0; i < lines.length; i++) {
      var m = a.exec(lines[i]) || b.exec(lines[i]);
      if (m) add(m[1], +m[2], +m[3], m[4], m[6] + " [" + m[5] + "]");
    }
  }
  /* Ruby: main.rb:3:in 'foo': msg (NameError) / main.rb:2: syntax error… / "\tfrom main.rb:5:in '<main>'" */
  function parseRuby(lines, add) {
    var re = /^(.+?\.rb):(\d+):(?:in [`'].*?': )?(.*)$/, from = /^\s+from (.+?\.rb):(\d+):in /, first = true;
    for (var i = 0; i < lines.length; i++) {
      var m = re.exec(lines[i]);
      if (m && first) { add(m[1], +m[2], 0, "error", m[3]); first = false; continue; }
      if ((m = from.exec(lines[i]))) add(m[1], +m[2], 0, "note", "Lời gọi dẫn tới lỗi");
    }
  }
  /* PHP: "PHP Parse error:  syntax error … in /x/main.php on line 3" */
  function parsePhp(lines, add) {
    var re = /^(?:PHP )?(Parse error|Fatal error|Warning|Notice|Deprecated):\s+(.*) in (.+?) on line (\d+)\s*$/;
    for (var i = 0; i < lines.length; i++) {
      var m = re.exec(lines[i]);
      if (m) add(m[3], +m[4], 0, /^(Warning|Notice|Deprecated)$/.test(m[1]) ? "warning" : "error", m[1] + ": " + m[2]);
    }
  }
  /* Bash: main.sh: line 3: foo: command not found */
  function parseBash(lines, add) {
    var re = /^(.+?): line (\d+): (.*)$/;
    for (var i = 0; i < lines.length; i++) { var m = re.exec(lines[i]); if (m) add(m[1], +m[2], 0, "error", m[3]); }
  }
  var PARSERS = { c: [parseGcc], cpp: [parseGcc], kotlin: [parseGcc], java: [parseJava], python: [parsePython], javascript: [parseNode],
    typescript: [parseParen, parseNode], go: [parseGo], rust: [parseRust], csharp: [parseParen], ruby: [parseRuby], php: [parsePhp], bash: [parseBash] };

  /**
   * Chẩn đoán từ một đoạn stderr của `language`. files (tuỳ chọn): [{name|path, content}] để quy tên tệp về tên trong dự án
   * (tuyệt đối, ./x, a\b → "a/b") và tính đúng cột của Python; thông báo ngoài dự án chỉ giữ lại nếu là lỗi.
   * → [{file, line, col, severity:"error"|"warning"|"note", message}] theo thứ tự xuất hiện (dòng 0/cột 0 = không rõ), tối đa 200.
   */
  function parseDiagnostics(stderr, language, files) {
    var text = str(stderr);
    if (!text.trim()) return [];
    var index = makeIndex(files), col = makeCollector(index), lines = text.replace(/\r\n?/g, "\n").split("\n");
    (PARSERS[canonLang(language)] || [parseGcc]).forEach(function (p) { p(lines, col.add, index); });
    return col.list.slice(0, MAX_DIAGNOSTICS);
  }
  /** Chẩn đoán của cả kết quả: stderr biên dịch rồi stderr chạy (C/C++ bỏ qua stderr chạy: là chữ của chương trình). */
  function collectDiagnostics(res, files) {
    var lang = canonLang(res.language), out = [], c = res.compile, r = res.run;
    function push(list) { list.forEach(function (d) { if (out.length < MAX_DIAGNOSTICS) out.push(d); }); }
    if (c && (c.stderr || c.stdout)) push(parseDiagnostics(c.stderr + "\n" + c.stdout, lang, files));
    if (r && r.stderr && lang !== "c" && lang !== "cpp") push(parseDiagnostics(r.stderr, lang, files));
    if (c && c.ran && !c.ok && !out.some(function (d) { return d.severity === "error"; })) {
      var first = (c.stderr + "\n" + c.stdout).split(/\r?\n/).filter(function (x) { return x.trim(); })[0];
      out.unshift({ file: "", line: 0, col: 0, severity: "error", message: first ? first.trim() : (c.timedOut ? "Biên dịch quá giờ" : "Biên dịch thất bại") });
    }
    return out;
  }

  /* ------------------------------------------------------------------ nơi chạy: danh sách cho giao diện */
  /**
   * Các nơi chạy cho MỘT ngôn ngữ: [{id, label, available, reason}] — "browser" (js/python/c/cpp), "server:<id>" mỗi provider của
   * GET /run/providers, "piston-custom". o: {language, server:[providers], pistonUrl}
   */
  function targets(o) {
    o = o || {};
    var lang = canonLang(o.language || (o.languages && o.languages[0])), out = [];
    if (BROWSER_LANGS[lang]) out.push({ id: "browser", label: "Trong trình duyệt", available: true, reason: "" });
    (Array.isArray(o.server) ? o.server : []).forEach(function (p) {
      if (!isObj(p) || !p.id) return;
      var langs = Array.isArray(p.languages) ? p.languages : [], has = langs.indexOf(lang) >= 0, ok = !!p.available && has, reason = "";
      if (!p.available) reason = p.reason ? str(p.reason) : "Máy chủ chưa bật nơi chạy này.";
      else if (!has) reason = "Nơi chạy này không chạy được " + langName(lang) + ".";
      out.push({ id: "server:" + p.id, label: "Máy chủ · " + str(p.label || p.id), available: ok, reason: reason, needsSession: !!p.needsSession, multiFile: (Array.isArray(p.multiFileLanguages) ? p.multiFileLanguages : []).indexOf(lang) >= 0 });
    });
    var url = trimSlash(o.pistonUrl), pl = !!PISTON_LANG[lang];
    out.push({ id: "piston-custom", label: "Piston của bạn (URL)", available: !!url && pl, reason: !url ? "Chưa đặt URL Piston ở Cài đặt" : (!pl ? "Piston không chạy được " + langName(lang) + "." : "") });
    return out;
  }
  /** GET {apiBase}/run/providers → mảng providers (đã có .default ở thuộc tính defaultId). Lỗi mạng/định dạng → mảng rỗng, KHÔNG ném. */
  function loadServerProviders(apiBase, o) {
    var f = (o && o.fetch) || root.fetch;
    if (typeof f !== "function") return Promise.resolve([]);
    return Promise.resolve().then(function () {
      return f(trimSlash(apiBase) + "/run/providers", { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    }).then(function (res) { return res && res.ok ? res.json() : null; }).then(function (j) {
      var list = j && Array.isArray(j.providers) ? j.providers.filter(function (p) { return isObj(p) && p.id; }) : [];
      list.defaultId = j && typeof j["default"] === "string" ? j["default"] : "";
      return list;
    }).catch(function () { var e = []; e.defaultId = ""; return e; });
  }

  /* ------------------------------------------------------------------ bộ chạy trong trình duyệt */
  var executors = Object.create(null);
  /** fn(req, ctx) → Promise<{compile, run, version, warnings?, diagnostics?}>; ctx = {onProgress, confirmDownload, onCancel(fn), isCancelled()} */
  function registerExecutor(language, fn) { if (typeof fn !== "function") throw makeError("Bộ chạy phải là hàm", "bad_executor"); executors[canonLang(language)] = fn; }
  function hasExecutor(language) { return typeof executors[canonLang(language)] === "function"; }
  function unregisterExecutor(language) { delete executors[canonLang(language)]; }

  /* ------------------------------------------------------------------ điều khiển một lần chạy (huỷ) */
  function newControl() {
    var c = { cancelled: false, finished: false, hooks: [], rejectCancel: null };
    c.cancelPromise = new Promise(function (_, rej) { c.rejectCancel = rej; });
    c.cancelPromise.catch(function () { /* đã được Promise.race xử lý */ });
    c.onCancel = function (fn) { if (c.cancelled) safeCall(fn); else c.hooks.push(fn); };
    c.cancel = function () {
      if (c.cancelled || c.finished) return;
      c.cancelled = true;
      c.hooks.splice(0).forEach(function (h) { safeCall(h); });
      c.rejectCancel(makeError("Đã dừng chương trình.", "cancelled"));
    };
    return c;
  }
  var latest = null;

  /* ------------------------------------------------------------------ chuẩn bị yêu cầu */
  function prepare(req) {
    if (!isObj(req)) throw makeError("Thiếu yêu cầu chạy mã.", "bad_request");
    var language = canonLang(req.language), target = str(req.target);
    if (!language) throw makeError("Chưa chọn ngôn ngữ để chạy.", "bad_request");
    if (!target) throw makeError("Chưa chọn nơi chạy.", "bad_request");
    if (!Array.isArray(req.files) || !req.files.length) throw makeError("Không có tệp nào để chạy.", "bad_request");
    var files = req.files.map(function (f) {
      var n = fileName(f);
      if (typeof n !== "string" || !n.trim()) throw makeError("Có tệp không có tên.", "bad_request");
      return { name: cleanName(n), content: f && f.content != null ? String(f.content) : "" };
    });
    var warnings = [], flags = [], rejected = [];
    if (language === "c" || language === "cpp") {
      var b = buildCompileArgs({ language: language, std: req.std, opt: req.opt, extra: req.compileArgs });
      flags = b.flags; rejected = b.rejected;
      rejected.forEach(function (r) { warnings.push("Cờ biên dịch '" + r.flag + "' bị bỏ qua: " + r.reason + "."); });
    }
    var args = Array.isArray(req.args) ? req.args.map(String) : [];
    return { target: target, language: language, files: files, mainFile: mainFileFor(language, files, req.mainFile), stdin: str(req.stdin), args: args,
      std: req.std == null ? "" : String(req.std), opt: req.opt == null ? "" : String(req.opt), compileArgs: flags, rejectedFlags: rejected,
      runTimeoutMs: Math.max(MIN_MS, num(req.runTimeoutMs, DEFAULT_RUN_MS)), compileTimeoutMs: Math.max(MIN_MS, num(req.compileTimeoutMs, DEFAULT_COMPILE_MS)),
      hasRunTimeout: req.runTimeoutMs != null, hasCompileTimeout: req.compileTimeoutMs != null, warnings: warnings };
  }

  /* ------------------------------------------------------------------ nơi chạy từ xa */
  function fetchFn(opts) {
    var f = opts.fetch || root.fetch;
    if (typeof f !== "function") throw makeError("Trình duyệt này không có fetch để gọi máy chủ.", "no_fetch");
    return f;
  }
  function readJson(res) {
    if (res && typeof res.text === "function") return res.text().then(function (t) { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } }, function () { return null; });
    if (res && typeof res.json === "function") return Promise.resolve(res.json()).catch(function () { return null; });
    return Promise.resolve(null);
  }
  function headerOf(res, name) { try { return res && res.headers && res.headers.get ? res.headers.get(name) : null; } catch (e) { return null; } }
  function abortable(ctl) {
    var ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ac) ctl.onCancel(function () { ac.abort(); });
    return ac;
  }
  function networkError(e, what, hint) {
    if (e && e.code) return e;
    return makeError("Không kết nối được " + what + (hint ? " — " + hint : " — kiểm tra mạng rồi thử lại."), "network", { cause: e });
  }

  function runServer(p, opts, ctl) {
    var id = p.target.slice(7), f = fetchFn(opts);
    if (!id) throw makeError("Nơi chạy máy chủ không có tên (server:<id>).", "bad_target");
    var body = { provider: id, language: p.language, files: p.files.map(function (x) { return { name: x.name, content: x.content }; }), mainFile: p.mainFile,
      stdin: p.stdin, args: p.args, compileArgs: p.compileArgs };
    if (p.hasRunTimeout) body.runTimeoutMs = Math.round(p.runTimeoutMs);
    if (p.hasCompileTimeout) body.compileTimeoutMs = Math.round(p.compileTimeoutMs);
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (opts.adminSession) headers["X-Admin-Session"] = String(opts.adminSession);
    if (opts.adminKey) headers["X-Admin-Key"] = String(opts.adminKey);
    var ac = abortable(ctl), t0 = Date.now();
    safeCall(opts.onProgress, { type: "run", message: "Đang gửi mã tới máy chủ (" + id + ")…" });
    return Promise.resolve().then(function () {
      return f(trimSlash(opts.apiBase) + "/run", { method: "POST", headers: headers, body: JSON.stringify(body), cache: "no-store", signal: ac ? ac.signal : undefined });
    }).then(function (res) {
      return readJson(res).then(function (json) {
        if (!res.ok) {
          var b = isObj(json) ? json : {}, ra = toInt(headerOf(res, "Retry-After"), null);
          if (ra != null) { b.data = isObj(b.data) ? b.data : {}; if (b.data.retryAfter == null) b.data.retryAfter = ra; }
          throw friendlyError(res.status, b);
        }
        var out = normalizeServerResult(json);
        out.provider = out.provider || id;
        out.elapsedMs = Date.now() - t0;
        return out;
      });
    }, function (e) { if (ctl.cancelled) throw makeError("Đã dừng chương trình.", "cancelled"); throw networkError(e, "máy chủ"); });
  }

  function runPiston(p, opts, ctl) {
    var f = fetchFn(opts), base = trimSlash(opts.pistonUrl).replace(/\/execute$/, "");
    if (!base) throw makeError("Chưa đặt URL Piston ở Cài đặt.", "no_piston_url");
    var lang = PISTON_LANG[p.language];
    if (!lang) throw makeError("Piston không chạy được " + langName(p.language) + ".", "run_language_unsupported");
    var ordered = p.files.slice().sort(function (a, b) { return (b.name === p.mainFile ? 1 : 0) - (a.name === p.mainFile ? 1 : 0); });   /* tệp chính đứng đầu */
    var payload = { language: lang, version: "*", files: ordered.map(function (x) { return { name: x.name, content: x.content }; }), stdin: p.stdin, args: p.args,
      compile_timeout: Math.round(p.compileTimeoutMs), run_timeout: Math.round(p.runTimeoutMs) };
    var warnings = p.warnings.slice();
    if ((p.language === "c" || p.language === "cpp") && (p.compileArgs.length || p.std || p.opt)) warnings.push("Piston không nhận cờ biên dịch (chuẩn, tối ưu, compileArgs) nên chúng đã bị bỏ qua.");
    var ac = abortable(ctl), t0 = Date.now();
    safeCall(opts.onProgress, { type: "run", message: "Đang gửi mã tới Piston của bạn…" });
    return Promise.resolve().then(function () {
      return f(base + "/execute", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), cache: "no-store", signal: ac ? ac.signal : undefined });
    }).then(function (res) {
      return readJson(res).then(function (json) {
        var elapsed = Date.now() - t0;
        if (!res.ok) {
          var msg = isObj(json) && typeof json.message === "string" ? json.message : "";
          if (res.status === 401 || res.status === 403) throw makeError("Piston từ chối quyền truy cập (máy Piston này đòi khoá API).", "run_provider_rejected", { status: res.status });
          if (res.status === 429) throw makeError("Piston đang giới hạn tốc độ — thử lại sau ít giây.", "run_rate_limited", { status: 429 });
          if (res.status >= 500) throw makeError("Piston đang không phản hồi (HTTP " + res.status + ") — kiểm tra máy Piston.", "run_provider_unavailable", { status: res.status });
          throw makeError("Piston từ chối yêu cầu" + (msg ? ": " + msg : " (HTTP " + res.status + ")."), "run_provider_rejected", { status: res.status });
        }
        var out = normalizePiston(json, { language: p.language, runTimeoutMs: p.runTimeoutMs, compileTimeoutMs: p.compileTimeoutMs, elapsedMs: elapsed, warnings: warnings });
        out.elapsedMs = elapsed;
        return out;
      });
    }, function (e) {
      if (ctl.cancelled) throw makeError("Đã dừng chương trình.", "cancelled");
      throw networkError(e, "Piston", "kiểm tra URL, máy Piston có chạy không, và máy đó phải cho phép CORS (Access-Control-Allow-Origin) cho trang này.");
    });
  }

  function runBrowser(p, opts, ctl) {
    var ex = executors[p.language];
    if (!ex) throw makeError("Chưa có bộ chạy trong trình duyệt cho " + langName(p.language) + " (chỉ JavaScript, Python, C, C++) — chọn nơi chạy khác.", "no_executor");
    var ctx = {
      onProgress: function (e) { safeCall(opts.onProgress, e); },
      confirmDownload: typeof opts.confirmDownload === "function" ? opts.confirmDownload : function () { return Promise.resolve(true); },
      onCancel: ctl.onCancel, isCancelled: function () { return ctl.cancelled; }
    };
    var t0 = Date.now();
    return Promise.resolve().then(function () { return ex(p, ctx); }).then(function (raw) {
      raw = raw || {};
      var out = finish({ provider: "browser", language: p.language, version: raw.version, compile: raw.compile, run: raw.run, warnings: p.warnings.concat(strList(raw.warnings)) });
      out.elapsedMs = Date.now() - t0;
      if (Array.isArray(raw.diagnostics)) out.ownDiagnostics = raw.diagnostics;
      return out;
    });
  }

  /* ------------------------------------------------------------------ run */
  function dispatch(p, opts, ctl) {
    if (p.target === "browser") return runBrowser(p, opts, ctl);
    if (p.target === "piston-custom") return runPiston(p, opts, ctl);
    if (p.target.indexOf("server:") === 0) return runServer(p, opts, ctl);
    throw makeError("Nơi chạy không hợp lệ: " + p.target, "bad_target");
  }
  function finalize(res, p) {
    res.target = p.target;
    if (p.warnings.length && res.warnings.length === 0) res.warnings = p.warnings.slice();
    else if (p.warnings.length) p.warnings.forEach(function (w) { if (res.warnings.indexOf(w) < 0) res.warnings.push(w); });
    var diags = collectDiagnostics(res, p.files), own = res.ownDiagnostics;
    delete res.ownDiagnostics;
    if (own && own.length) {
      var seen = Object.create(null), merged = [];
      own.concat(diags).forEach(function (d) {
        var k = d.file + "|" + d.line + "|" + d.col + "|" + d.severity + "|" + d.message;
        if (!seen[k]) { seen[k] = 1; merged.push({ file: str(d.file), line: d.line | 0, col: d.col | 0, severity: d.severity || "error", message: str(d.message) }); }
      });
      diags = merged.slice(0, MAX_DIAGNOSTICS);
    }
    res.diagnostics = diags;
    return res;
  }
  /**
   * Chạy một lần. req = {target, language, files:[{name,content}], mainFile, stdin, args, std, opt, compileArgs, runTimeoutMs, compileTimeoutMs};
   * opts = {apiBase, fetch, onProgress(evt), confirmDownload(info)→Promise<bool>, adminSession, adminKey, pistonUrl}.
   * → {promise, cancel()}. promise resolve kết quả chuẩn; reject Error có .code ("cancelled", "download_declined", "network", "admin_required"…).
   * onProgress: {type:"download",label,loaded,total,pct} | {type:"cache",message} | {type:"compile",message} | {type:"run",message} | {type:"stdout",text} | {type:"stderr",text}
   */
  function run(req, opts) {
    opts = opts || {};
    var ctl = newControl(), prepared = null;
    var work = Promise.resolve().then(function () { prepared = prepare(req); return dispatch(prepared, opts, ctl); }).then(function (res) { return finalize(res, prepared); });
    var promise = Promise.race([work, ctl.cancelPromise]);
    var done = function () { ctl.finished = true; if (latest === ctl) latest = null; };
    promise.then(done, done);
    latest = ctl;
    return { promise: promise, cancel: ctl.cancel };
  }
  /** Huỷ lần chạy gần nhất (dự phòng cho giao diện không giữ handle). */
  function cancel() { if (latest) latest.cancel(); }

  /* ------------------------------------------------------------------ tiện ích dùng chung cho assets/run/*.js (chỉ chạy trong trình duyệt) */
  var util = {
    /* Nội dung nằm trong dấu chú thích khối của một hàm (từ "/*" đầu tới "*" + "/" cuối) — để nhúng mã Python/JS nguyên văn, khỏi gấp đôi dấu \ */
    commentText: function (fn) { var s = String(fn), a = s.indexOf("/*"), b = s.lastIndexOf("*/"); return a < 0 || b < a ? "" : s.slice(a + 2, b); },
    /** Dựng Worker từ mã nguồn (Blob). Trả {worker, revoke()}. */
    workerFromSource: function (src) {
      if (!root.Worker || !root.Blob || !root.URL || !root.URL.createObjectURL) throw makeError("Trình duyệt này không hỗ trợ Web Worker/Blob.", "no_worker");
      var url = root.URL.createObjectURL(new root.Blob([src], { type: "text/javascript" })), w = new root.Worker(url);
      return { worker: w, url: url, revoke: function () { try { root.URL.revokeObjectURL(url); } catch (e) { /* bỏ qua */ } } };
    },
    /** Mở Cache Storage; null nếu không có (file://, cửa sổ riêng tư, HTTP thường). */
    openCache: function (name) {
      if (typeof root.caches === "undefined" || !root.caches) return Promise.resolve(null);
      return Promise.resolve().then(function () { return root.caches.open(name); }).catch(function () { return null; });
    },
    /** Tệp đánh dấu "đã tải đủ" trong Cache Storage, để biết có cần hỏi người dùng trước khi tải hay không. */
    cacheReady: function (name, marker) {
      return util.openCache(name).then(function (c) { return c ? c.match(marker).then(function (r) { return !!r; }, function () { return false; }) : false; });
    },
    cacheMark: function (name, marker) {
      return util.openCache(name).then(function (c) { return c ? c.put(marker, new root.Response("ok")).then(function () { return true; }, function () { return false; }) : false; });
    },
    deleteCache: function (name) { return typeof root.caches === "undefined" || !root.caches ? Promise.resolve(false) : root.caches.delete(name).catch(function () { return false; }); }
  };

  CS.runner = {
    run: run, cancel: cancel, targets: targets, loadServerProviders: loadServerProviders,
    registerExecutor: registerExecutor, unregisterExecutor: unregisterExecutor, hasExecutor: hasExecutor,
    parseDiagnostics: parseDiagnostics, collectDiagnostics: collectDiagnostics, buildCompileArgs: buildCompileArgs,
    normalizeServerResult: normalizeServerResult, normalizePiston: normalizePiston, finish: finish, friendlyError: friendlyError,
    mainFileFor: mainFileFor, splitStdoutLimit: splitStdoutLimit,
    PISTON_LANG: PISTON_LANG, PISTON_BACK: PISTON_BACK, BROWSER_LANGS: BROWSER_LANGS, util: util
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.runner;
})(typeof globalThis !== "undefined" ? globalThis : this);
