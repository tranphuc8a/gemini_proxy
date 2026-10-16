/* project.js — mô hình "đoạn mã" (snippet, đúng 1 tệp) và "dự án" (nhiều tệp) của Code Studio, cùng các phép biến đổi THUẦN:
   mỗi hàm trả một bản sao mới, không sửa đầu vào, không đọc đồng hồ (thời điểm truyền vào qua `now`), không DOM. Kiểm: kiem-du-an.js.

   Bản ghi trùng hình dạng item của /codestore nên đồng bộ thẳng được:
     {id, kind:"snippet"|"project", name, language, files:[{path, content}], meta:{…}, updatedAt, deleted:false}
   meta: {mainFile, folders:[thư mục rỗng], std, opt:"O2", stdin:"", args:[], compileArgs:[], javaMain, openTabs:[], activeFile,
          pinned, tags:[]} (+ trường tuỳ ý của giao diện). Luôn ≤ 32 KB khi JSON: nếu dài quá thì cắt lần lượt openTabs → trường lạ
          → tags → stdin (đặt stdinTruncated) → folders → args → compileArgs.
   • folders chỉ giữ thư mục KHÔNG có tệp nào bên trong (thư mục có tệp đã hiện ra từ đường dẫn tệp).
   • javaMain: lớp chính do người dùng chọn (tuỳ chọn) — chỉ dùng khi mainFile trống; javaMainClass(p) luôn tính lại từ mã.

   Luật đường dẫn (giống backend: src/application/utils/safe_paths.py):
     • "kho" (/codestore, normPath(p, {store:true})): `\` → `/`, bỏ `./` và `//`; cấm rỗng, `..`, tuyệt đối (`/x`, `C:`), kết thúc
       bằng `/`, ký tự điều khiển/đảo chiều chữ, thành phần bắt đầu/kết thúc bằng khoảng trắng hoặc kết thúc bằng `.`,
       thành phần > 255 ký tự, sâu > 16 cấp, cả đường dẫn > 512 ký tự.
     • "chạy" (/run, mặc định của normPath): thêm — chỉ [A-Za-z0-9_.-] (và `/`), ≤ 8 cấp, ≤ 200 ký tự, thành phần ≤ 100,
       không bắt đầu bằng `-`, không phải tên thiết bị Windows (CON, NUL, COM1…).
   Trùng tên không phân biệt hoa/thường, và tệp trùng tên thư mục, đều bị từ chối. Lỗi là `Error` tiếng Việt (e.code = "bad_path"
   hoặc "bad_project"). */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  /* ------------------------------------------------------------------ giới hạn của backend */
  var LIMITS = {
    store: { files: 200, itemBytes: 512 * 1024, metaBytes: 32 * 1024, nameChars: 200, languageChars: 32, pathChars: 512, segmentChars: 255, depth: 16,
      putItems: 100, putBytes: 2 * 1024 * 1024, maxTimestamp: 4102444800000, clockAheadMs: 24 * 3600 * 1000 },
    run: { files: 64, fileBytes: 128 * 1024, totalBytes: 256 * 1024, stdinBytes: 64 * 1024, args: 16, argChars: 200, compileArgs: 16,
      pathChars: 200, segmentChars: 100, depth: 8 }
  };
  var RUN_LANGS = ["c", "cpp", "java", "python", "javascript", "typescript", "go", "rust", "csharp", "kotlin", "php", "ruby", "bash"];
  /* đuôi tệp và tên tệp "chứa main" theo src/domain/utils/run_languages.py */
  var RUN_EXT = { c: [".c"], cpp: [".cpp", ".cc", ".cxx", ".c++"], java: [".java"], python: [".py"], javascript: [".js", ".mjs", ".cjs"],
    typescript: [".ts"], go: [".go"], rust: [".rs"], csharp: [".cs"], kotlin: [".kt"], php: [".php"], ruby: [".rb"], bash: [".sh", ".bash"] };
  var MAIN_NAMES = { c: ["main.c"], cpp: ["main.cpp", "main.cc", "main.cxx"], java: ["Main.java"], python: ["main.py", "__main__.py"],
    javascript: ["main.js", "index.js"], typescript: ["main.ts", "index.ts"], go: ["main.go"], rust: ["main.rs"], csharp: ["Program.cs", "Main.cs"],
    kotlin: ["Main.kt", "main.kt"], php: ["main.php", "index.php"], ruby: ["main.rb"], bash: ["main.sh", "script.sh"] };
  var COMPILED = { c: 1, cpp: 1, java: 1, typescript: 1, go: 1, rust: 1, csharp: 1, kotlin: 1 };
  /* ngôn ngữ mà "có hàm main" quan trọng hơn tên tệp */
  var MAIN_FIRST = { c: 1, cpp: 1, java: 1, go: 1, rust: 1, csharp: 1, kotlin: 1 };
  var MAIN_RE = {
    c: /\b(?:int|void)\s+main\s*\(/,
    cpp: /\b(?:int|void|auto)\s+main\s*\(/,
    java: /\b(?:public\s+(?:final\s+)?static|static\s+(?:final\s+)?public)\s+(?:final\s+)?void\s+main\s*\(/,
    python: /^if\s+__name__\s*==\s*["']__main__["']\s*:/m,
    go: /^\s*func\s+main\s*\(\s*\)/m,
    rust: /\bfn\s+main\s*\(/,
    csharp: /\bstatic\s+(?:async\s+)?(?:void|int|Task(?:\s*<\s*int\s*>)?)\s+Main\s*\(/,
    kotlin: /\bfun\s+main\s*\(/
  };
  var FALLBACK_FILE = { c: "main.c", cpp: "main.cpp", java: "Main.java", python: "main.py", javascript: "main.js", typescript: "main.ts", go: "main.go",
    rust: "main.rs", csharp: "Program.cs", kotlin: "Main.kt", php: "main.php", ruby: "main.rb", bash: "main.sh" };

  var ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
  var LANG_RE = /^[A-Za-z0-9_+#.-]{0,32}$/;
  /* Cc (U+0000–001F, U+007F–009F) và các ký tự đảo chiều chữ (một tên TRÔNG như main.cpp mà không phải) */
  var CTRL_RE = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
  /* khoảng trắng theo str.strip() của Python */
  var PY_WS = "\\t\\n\\u000b\\f\\r \\u001c-\\u001f\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
  var WS_CHAR = new RegExp("[" + PY_WS + "]");
  var WS_EDGES = new RegExp("^[" + PY_WS + "]+|[" + PY_WS + "]+$", "g");
  var RUN_SEG_RE = /^[A-Za-z0-9_.-]+$/;
  var DEVICE_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.[\s\S]*)?$/i;
  var STD_RE = /^[A-Za-z0-9+:.]{0,20}$/;
  var OPTS = { O0: 1, O1: 1, O2: 1, O3: 1 };

  /* cờ biên dịch được phép — chép đúng src/application/utils/compile_flags.py */
  var EXACT_FLAGS = { "-O0": 1, "-O1": 1, "-O2": 1, "-O3": 1, "-Wall": 1, "-Wextra": 1, "-Wpedantic": 1, "-pedantic": 1, "-Werror": 1, "-g": 1, "-pthread": 1, "-lm": 1 };
  var STD_FLAG = /^-std=[A-Za-z0-9+:.]{1,20}$/;
  var DEFINE_FLAG = /^-D[A-Za-z_][A-Za-z0-9_]{0,63}(=[A-Za-z0-9_.+\-]{0,64})?$/;
  var INCLUDE_FLAG = /^-I[A-Za-z0-9_.\/-]{1,100}$/;

  /* ------------------------------------------------------------------ tiện ích */
  function fail(msg, code) { var e = new Error(msg); e.code = code || "bad_project"; return e; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function cloneJson(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function pyStrip(s) { return String(s).replace(WS_EDGES, ""); }
  /** Số ký tự theo Python (điểm mã, cặp UTF-16 tính là một). */
  function cpLen(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) i++;
      n++;
    }
    return n;
  }
  /** Số byte UTF-8 của một chuỗi (nửa cặp lẻ tính 3 byte như U+FFFD). */
  function utf8Bytes(s) {
    s = String(s);
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }
  /** JSON y như json.dumps(…, ensure_ascii=False) của Python (dấu cách sau `,` và `:`) — để đo đúng như máy chủ đo. */
  function pyJson(v) {
    if (v === null || v === undefined || typeof v === "function") return "null";
    if (Array.isArray(v)) return "[" + v.map(pyJson).join(", ") + "]";
    if (typeof v === "object") {
      var parts = [];
      Object.keys(v).forEach(function (k) { if (v[k] !== undefined && typeof v[k] !== "function") parts.push(JSON.stringify(k) + ": " + pyJson(v[k])); });
      return "{" + parts.join(", ") + "}";
    }
    if (typeof v === "number") return isFinite(v) ? JSON.stringify(v) : "null";
    return JSON.stringify(v);
  }
  function pyJsonBytes(v) { return utf8Bytes(pyJson(v)); }
  /** Kích thước một bản ghi như máy chủ tính (item_bytes): JSON kiểu Python của cả bản ghi kèm serverUpdatedAt. */
  function itemBytes(item) {
    var it = item || {};
    return pyJsonBytes({ id: it.id, kind: it.kind, name: it.name, language: it.language,
      files: (it.files || []).map(function (f) { return { path: f.path, content: f.content }; }),
      meta: it.meta || {}, updatedAt: it.updatedAt, deleted: !!it.deleted, serverUpdatedAt: 1700000000000 });
  }
  function dirname(p) { var i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); }
  function basename(p) { var i = p.lastIndexOf("/"); return i < 0 ? p : p.slice(i + 1); }
  function ancestors(p) {
    var parts = p.split("/"), out = [];
    for (var i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
    return out;
  }
  function stripSlash(p) { return typeof p === "string" ? p.replace(/[\\/]+$/, "") : p; }
  function endsWithAny(s, list) { s = s.toLowerCase(); for (var i = 0; i < list.length; i++) if (s.slice(-list[i].length) === list[i]) return true; return false; }
  function unique(arr, keyFn) {
    var seen = Object.create(null), out = [];
    arr.forEach(function (x) { var k = keyFn ? keyFn(x) : x; if (!seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
  }
  function strArr(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }) : []; }
  function langs() { return CS.langs || null; }
  function langLabel(id) { var L = langs(); return L ? L.get(id).name + (L.get(id).id === "plaintext" && id !== "plaintext" ? " (" + id + ")" : "") : id; }
  function defaultFileOf(lang) { var L = langs(); return L ? L.defaultFile(lang) : (FALLBACK_FILE[lang] || "main.txt"); }
  function helloOf(lang) { var L = langs(); return L ? L.get(lang).hello : ""; }
  function langExts(lang) {
    if (RUN_EXT[lang]) return RUN_EXT[lang];
    var L = langs();
    return L ? L.get(lang).exts.map(function (e) { return "." + e; }) : [];
  }
  function defaultStd(lang) { return lang === "cpp" ? "c++17" : lang === "c" ? "c11" : ""; }
  function natCmp(a, b) {
    var ax = a.toLowerCase().match(/\d+|\D+/g) || [], bx = b.toLowerCase().match(/\d+|\D+/g) || [];
    for (var i = 0; i < Math.min(ax.length, bx.length); i++) {
      var x = ax[i], y = bx[i];
      if (x === y) continue;
      if (/^\d/.test(x) && /^\d/.test(y)) {
        var xs = x.replace(/^0+(?=\d)/, ""), ys = y.replace(/^0+(?=\d)/, "");
        if (xs.length !== ys.length) return xs.length - ys.length;
        if (xs !== ys) return xs < ys ? -1 : 1;
        continue;
      }
      return x < y ? -1 : 1;
    }
    if (ax.length !== bx.length) return ax.length - bx.length;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /* ------------------------------------------------------------------ id, đường dẫn */
  function randomBytes(n) {
    var b = new Uint8Array(n), c = root.crypto;
    if (c && typeof c.getRandomValues === "function") { c.getRandomValues(b); return b; }
    for (var i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }
  /** Id ngẫu nhiên 20 ký tự [0-9a-z] (~100 bit), khớp mẫu id của /codestore. */
  function newId() {
    var A = "0123456789abcdefghijklmnopqrstuvwxyz", b = randomBytes(20), out = "";
    for (var i = 0; i < 20; i++) out += A.charAt(b[i] % 36);
    return out;
  }

  /**
   * Chuẩn hoá đường dẫn tệp; ném Error tiếng Việt nếu máy chủ sẽ từ chối.
   * o.store = true → chỉ luật của kho (/codestore, cho phép Unicode, dấu cách); mặc định thêm luật của /run.
   */
  function normPath(path, o) {
    var lenient = !!(o && (o.store || o.lenient));
    if (typeof path !== "string" || !pyStrip(path)) throw fail("Đường dẫn tệp không được để trống", "bad_path");
    if (CTRL_RE.test(path)) throw fail("Đường dẫn tệp chứa ký tự điều khiển", "bad_path");
    var unified = path.replace(/\\/g, "/");
    if (unified.charAt(0) === "/" || /^[A-Za-z]:/.test(unified)) throw fail("Đường dẫn '" + path + "' phải là đường dẫn tương đối", "bad_path");
    if (unified.charAt(unified.length - 1) === "/") throw fail("Đường dẫn '" + path + "' không được kết thúc bằng '/'", "bad_path");
    var raw = unified.split("/"), segs = [];
    for (var i = 0; i < raw.length; i++) {
      var s = raw[i];
      if (s === "" || s === ".") continue;
      if (s === "..") throw fail("Đường dẫn '" + path + "' chứa '..'", "bad_path");
      if (WS_CHAR.test(s.charAt(0)) || WS_CHAR.test(s.charAt(s.length - 1)) || s.charAt(s.length - 1) === ".")
        throw fail("Đường dẫn '" + path + "' có thành phần bắt đầu/kết thúc bằng khoảng trắng hoặc '.'", "bad_path");
      if (cpLen(s) > LIMITS.store.segmentChars) throw fail("Đường dẫn '" + path + "' có thành phần quá dài", "bad_path");
      segs.push(s);
    }
    if (!segs.length) throw fail("Đường dẫn tệp không được để trống", "bad_path");
    if (segs.length > LIMITS.store.depth) throw fail("Đường dẫn '" + path + "' lồng quá sâu (tối đa " + LIMITS.store.depth + " cấp)", "bad_path");
    var result = segs.join("/");
    if (cpLen(result) > LIMITS.store.pathChars) throw fail("Đường dẫn quá dài (tối đa " + LIMITS.store.pathChars + " ký tự)", "bad_path");
    if (lenient) return result;
    if (result.length > LIMITS.run.pathChars) throw fail("Tên tệp quá dài (tối đa " + LIMITS.run.pathChars + " ký tự)", "bad_path");
    if (segs.length > LIMITS.run.depth) throw fail("Đường dẫn '" + result + "' lồng quá sâu (tối đa " + LIMITS.run.depth + " cấp)", "bad_path");
    for (var j = 0; j < segs.length; j++) {
      var g = segs[j];
      if (g.length > LIMITS.run.segmentChars) throw fail("Đường dẫn '" + result + "' có thành phần quá dài", "bad_path");
      if (!RUN_SEG_RE.test(g)) throw fail("Tên tệp '" + result + "' chỉ được gồm chữ, số, '_', '-', '.' (và '/' cho thư mục con)", "bad_path");
      if (g.charAt(0) === "-") throw fail("Tên tệp '" + result + "' không được bắt đầu bằng '-'", "bad_path");
      if (DEVICE_RE.test(g)) throw fail("Tên tệp '" + result + "' trùng tên thiết bị của Windows", "bad_path");
    }
    return result;
  }
  function isRunnablePath(p) { try { normPath(p); return true; } catch (e) { return false; } }

  /** Thông báo khi hai đường dẫn không cùng tồn tại được (như find_path_conflict), không thì null. */
  function findConflict(paths) {
    var seen = Object.create(null), dirs = Object.create(null), i;
    for (i = 0; i < paths.length; i++) {
      var key = paths[i].toLowerCase();
      if (seen[key]) return "Trùng tên tệp: '" + paths[i] + "'";
      seen[key] = 1;
      ancestors(key).forEach(function (a) { dirs[a] = 1; });
    }
    for (i = 0; i < paths.length; i++) if (dirs[paths[i].toLowerCase()]) return "'" + paths[i] + "' vừa là tệp vừa là thư mục";
    return null;
  }

  /** chữ thường → đường dẫn thật của mọi thư mục (tổ tiên của tệp + folders + tổ tiên của folders). */
  function dirIndex(paths, folders) {
    var idx = Object.create(null);
    function add(d) {
      var parts = d.split("/");
      for (var i = 1; i <= parts.length; i++) { var a = parts.slice(0, i).join("/"), k = a.toLowerCase(); if (!(k in idx)) idx[k] = a; }
    }
    paths.forEach(function (p) { var d = dirname(p); if (d) add(d); });
    (folders || []).forEach(add);
    return idx;
  }
  /** Dùng lại cách viết hoa/thường của thư mục đã có (SRC/x.cpp khi đã có src/ → src/x.cpp). */
  function canonicalDirs(path, idx, includeLast) {
    var parts = path.split("/"), out = [], n = includeLast ? parts.length : parts.length - 1;
    for (var i = 0; i < n; i++) {
      out.push(parts[i]);
      var hit = idx[out.join("/").toLowerCase()];
      if (hit) out = hit.split("/");
    }
    for (var j = n; j < parts.length; j++) out.push(parts[j]);
    return out.join("/");
  }
  function lowerSet(paths) { var s = Object.create(null); paths.forEach(function (p) { s[p.toLowerCase()] = p; }); return s; }

  /* ------------------------------------------------------------------ bản sao, meta */
  function clone(p) {
    p = p || {};
    return { id: p.id, kind: p.kind, name: p.name, language: p.language,
      files: (Array.isArray(p.files) ? p.files : []).map(function (f) { return { path: f && f.path, content: f && f.content }; }),
      meta: isObj(p.meta) ? cloneJson(p.meta) : {}, updatedAt: p.updatedAt, deleted: !!p.deleted };
  }
  function cleanName(name) {
    var s = pyStrip(String(name == null ? "" : name).replace(/[\u0000-\u001f\u007f-\u009f]+/g, " "));
    if (cpLen(s) > LIMITS.store.nameChars) s = pyStrip(Array.from(s).slice(0, LIMITS.store.nameChars).join(""));
    return s;
  }
  function cleanLanguage(lang, fallback) { return typeof lang === "string" && lang && LANG_RE.test(lang) ? lang : fallback; }

  function normFolders(folders, paths) {
    var files = lowerSet(paths), implied = Object.create(null), out = [];
    paths.forEach(function (p) { ancestors(p.toLowerCase()).forEach(function (a) { implied[a] = 1; }); });
    strArr(folders).forEach(function (f) {
      var d;
      try { d = normPath(stripSlash(f), { store: true }); } catch (e) { return; }
      var k = d.toLowerCase();
      if (files[k] || implied[k]) return;
      if (ancestors(k).some(function (a) { return files[a]; })) return;
      out.push(d);
    });
    out = unique(out, function (d) { return d.toLowerCase(); });
    var keys = out.map(function (d) { return d.toLowerCase(); });
    out = out.filter(function (d) { var k = d.toLowerCase() + "/"; return !keys.some(function (o) { return o.indexOf(k) === 0; }); });
    return out.sort(natCmp);
  }

  function trimArray(m, key, max, keep) {
    var arr = m[key];
    if (!Array.isArray(arr)) return;
    var excess = pyJsonBytes(m) - max;
    for (var i = arr.length - 1; i >= 0 && excess > 0; i--) {
      if (keep && keep(arr[i])) continue;
      excess -= pyJsonBytes(arr[i]) + 2;
      arr.splice(i, 1);
    }
  }
  /** meta ≤ 32 KB (đo như máy chủ): cắt dần những gì ít quan trọng nhất. */
  function fitMeta(m) {
    var max = LIMITS.store.metaBytes;
    if (pyJsonBytes(m) <= max) return m;
    trimArray(m, "openTabs", max, function (t) { return t === m.activeFile; });
    if (pyJsonBytes(m) > max) trimArray(m, "openTabs", max);
    var extra = Object.keys(m).filter(function (k) { return KNOWN_META.indexOf(k) < 0; })
      .sort(function (a, b) { return pyJsonBytes(m[b]) - pyJsonBytes(m[a]); });
    while (extra.length && pyJsonBytes(m) > max) delete m[extra.shift()];
    if (pyJsonBytes(m) > max) trimArray(m, "tags", max);
    if (pyJsonBytes(m) > max && m.stdin) {
      var full = m.stdin, lo = 0, hi = full.length;
      m.stdinTruncated = true;
      while (lo < hi) {                       // độ dài lớn nhất còn vừa
        var mid = Math.ceil((lo + hi) / 2);
        m.stdin = full.slice(0, mid);
        if (pyJsonBytes(m) <= max) lo = mid; else hi = mid - 1;
      }
      var cut = full.slice(0, lo);
      if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
      m.stdin = cut;
    }
    if (pyJsonBytes(m) > max) trimArray(m, "folders", max);
    if (pyJsonBytes(m) > max) trimArray(m, "args", max);
    if (pyJsonBytes(m) > max) trimArray(m, "compileArgs", max);
    if (pyJsonBytes(m) > max) trimArray(m, "tests", max);   /* dữ liệu người dùng tự soạn: bỏ sau cùng, từ ca cuối */
    if (pyJsonBytes(m) > max) delete m.testMode;
    return m;
  }
  var KNOWN_META = ["mainFile", "folders", "std", "opt", "stdin", "stdinTruncated", "args", "compileArgs", "javaMain", "openTabs", "activeFile", "pinned", "tags", "tests", "testMode"];

  /** meta đầy đủ trường mặc định, tham chiếu tới tệp còn tồn tại, ≤ 32 KB. */
  function normMeta(meta, item) {
    var m = isObj(meta) ? cloneJson(meta) : {};
    var paths = (item.files || []).map(function (f) { return f.path; }).filter(function (p) { return typeof p === "string"; });
    var has = Object.create(null);
    paths.forEach(function (p) { has[p] = 1; });
    var out = {};
    var main = typeof m.mainFile === "string" && has[m.mainFile] ? m.mainFile : "";
    if (!main) main = mainFileOf({ language: item.language, files: item.files, meta: { javaMain: m.javaMain } }) || "";
    out.mainFile = main;
    out.folders = normFolders(m.folders, paths);
    var std = typeof m.std === "string" ? m.std.trim().replace(/^-std=/, "") : undefined;
    out.std = std !== undefined && STD_RE.test(std) ? std : defaultStd(item.language);
    var opt = typeof m.opt === "string" ? m.opt.trim().replace(/^-/, "") : undefined;
    out.opt = opt === undefined ? "O2" : (opt === "" || OPTS[opt] ? opt : "O2");
    out.stdin = typeof m.stdin === "string" ? m.stdin : "";
    if (m.stdinTruncated === true) out.stdinTruncated = true;
    out.args = strArr(m.args);
    out.compileArgs = strArr(m.compileArgs);
    out.javaMain = typeof m.javaMain === "string" ? m.javaMain.trim() : "";
    out.openTabs = unique(strArr(m.openTabs).filter(function (t) { return has[t]; }));
    out.activeFile = typeof m.activeFile === "string" && has[m.activeFile] ? m.activeFile : (out.openTabs[0] || "");
    out.pinned = m.pinned === true;
    out.tags = unique(strArr(m.tags).map(function (t) { return pyStrip(t); }).filter(Boolean));
    /* bộ test (core/tests.js): chỉ có mặt khi dùng, để meta mặc định không đổi. Trang không nạp tests.js (IDE heuristic dùng chung project.js)
       thì để nguyên — đoạn mã tạo ở Code Studio vẫn giữ bộ test của nó. */
    var T = CS.tests, cases = T ? T.normalize(m.tests) : (Array.isArray(m.tests) ? m.tests : []);
    if (cases.length) out.tests = cases;
    var tmode = T ? T.normalizeMode(m.testMode) : m.testMode;
    if (typeof tmode === "string" && tmode !== (T ? T.defaultMode : "lines")) out.testMode = tmode;
    Object.keys(m).forEach(function (k) { if (KNOWN_META.indexOf(k) < 0 && m[k] !== undefined) out[k] = m[k]; });
    return fitMeta(out);
  }
  function finish(q) { q.meta = normMeta(q.meta, q); return q; }

  /**
   * Bản ghi sạch: đủ trường, kiểu đúng, meta chuẩn hoá (bia mộ: không tệp, meta rỗng). Lũy đẳng.
   * Không kiểm luật đường dẫn — validate() làm việc đó.
   */
  function normalize(item) {
    if (!item || typeof item !== "object") throw fail("Bản ghi không hợp lệ");
    var q = clone(item);
    q.id = typeof q.id === "string" && ID_RE.test(q.id) ? q.id : (typeof q.id === "string" && q.id ? q.id : newId());
    q.kind = q.kind === "snippet" ? "snippet" : "project";
    q.name = cleanName(q.name);
    q.language = cleanLanguage(q.language, "plaintext");
    q.files = q.files.filter(function (f) { return f && typeof f.path === "string"; })
      .map(function (f) { return { path: f.path, content: typeof f.content === "string" ? f.content : (f.content == null ? "" : String(f.content)) }; });
    var t = Number(q.updatedAt);
    q.updatedAt = isFinite(t) && t > 0 ? Math.floor(t) : 0;
    if (q.deleted) { q.files = []; q.meta = {}; return q; }
    return finish(q);
  }

  /* ------------------------------------------------------------------ tạo mới */
  /** Đoạn mã một tệp. o: {name, language, content, path, id, now} */
  function createSnippet(o) {
    o = o || {};
    var lang = cleanLanguage(o.language, "cpp");
    var path = o.path ? normPath(o.path) : defaultFileOf(lang);
    var item = { id: o.id || newId(), kind: "snippet", name: cleanName(o.name) || "Đoạn mã mới", language: lang,
      files: [{ path: path, content: o.content != null ? String(o.content) : helloOf(lang) }],
      meta: { mainFile: path, openTabs: [path], activeFile: path }, updatedAt: o.now > 0 ? Math.floor(o.now) : 0, deleted: false };
    return finish(item);
  }

  function findTemplate(t) {
    if (!t) return null;
    if (typeof t === "object") return t;
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === t) return TEMPLATES[i];
    return null;
  }
  /** Dự án mới. o: {name, language, template (id hoặc đối tượng mẫu), id, now}. Không mẫu → một tệp "Hello" của ngôn ngữ. */
  function createProject(o) {
    o = o || {};
    var tpl = null;
    if (o.template) { tpl = findTemplate(o.template); if (!tpl) throw fail("Không có mẫu dự án '" + o.template + "'"); }
    var lang = cleanLanguage(tpl ? tpl.language : o.language, "cpp");
    var files = tpl ? tpl.files.map(function (f) { return { path: normPath(f.path, { store: true }), content: String(f.content) }; })
      : [{ path: defaultFileOf(lang), content: helloOf(lang) }];
    var c = findConflict(files.map(function (f) { return f.path; }));
    if (c) throw fail(c);
    var meta = tpl && tpl.meta ? cloneJson(tpl.meta) : {};
    var item = { id: o.id || newId(), kind: "project", name: cleanName(o.name) || (tpl ? tpl.name : "Dự án mới"), language: lang,
      files: files, meta: meta, updatedAt: o.now > 0 ? Math.floor(o.now) : 0, deleted: false };
    var main = (meta.mainFile && files.some(function (f) { return f.path === meta.mainFile; })) ? meta.mainFile : detectMain(item);
    meta.mainFile = main || "";
    if (!meta.openTabs) meta.openTabs = main ? [main] : [];
    if (!meta.activeFile) meta.activeFile = main || "";
    return finish(item);
  }

  /* ------------------------------------------------------------------ sửa tệp/thư mục (trả bản sao) */
  function requireProject(p, what) {
    if (p.kind === "snippet") throw fail("Đoạn mã (snippet) chỉ gồm đúng một tệp — hãy chuyển thành dự án để " + what);
  }
  function fileIndex(q, path) { for (var i = 0; i < q.files.length; i++) if (q.files[i].path === path) return i; return -1; }
  function keepParent(q, path) { var d = dirname(path); if (d) q.meta.folders = strArr(q.meta.folders).concat([d]); }
  function checkNewFile(target, otherPaths, folders) {
    var files = lowerSet(otherPaths), dirs = dirIndex(otherPaths, folders), k = target.toLowerCase();
    if (files[k]) throw fail("Đã có tệp '" + files[k] + "' (tên tệp không phân biệt hoa/thường)");
    if (dirs[k]) throw fail("'" + target + "' trùng tên một thư mục");
    ancestors(k).forEach(function (a) { if (files[a]) throw fail("'" + files[a] + "' là một tệp, không chứa được tệp khác"); });
    return dirs;
  }

  /** Thêm tệp (đường dẫn đầy đủ tính từ gốc dự án). */
  function addFile(p, path, content) {
    var q = clone(p);
    requireProject(q, "thêm tệp");
    var target = normPath(path);
    var paths = q.files.map(function (f) { return f.path; });
    var dirs = checkNewFile(target, paths, q.meta.folders);
    target = canonicalDirs(target, dirs, false);
    if (q.files.length >= LIMITS.store.files) throw fail("Dự án đã đủ " + LIMITS.store.files + " tệp");
    q.files.push({ path: target, content: content == null ? "" : String(content) });
    return finish(q);
  }

  /** Thêm thư mục rỗng (lưu trong meta.folders cho tới khi có tệp bên trong). */
  function addFolder(p, path) {
    var q = clone(p);
    requireProject(q, "tạo thư mục");
    var target = normPath(stripSlash(path));
    var paths = q.files.map(function (f) { return f.path; });
    var files = lowerSet(paths), dirs = dirIndex(paths, q.meta.folders), k = target.toLowerCase();
    if (files[k]) throw fail("'" + target + "' trùng tên một tệp");
    if (dirs[k]) throw fail("Thư mục '" + dirs[k] + "' đã có");
    ancestors(k).forEach(function (a) { if (files[a]) throw fail("'" + files[a] + "' là một tệp, không chứa được thư mục"); });
    target = canonicalDirs(target, dirs, false);
    q.meta.folders = strArr(q.meta.folders).concat([target]);
    return finish(q);
  }

  function isDir(q, path) {
    var pre = path + "/";
    return q.files.some(function (f) { return f.path.indexOf(pre) === 0; }) ||
      strArr(q.meta.folders).some(function (d) { return d === path || d.indexOf(pre) === 0; });
  }
  function remapMeta(q, map) {
    var m = q.meta;
    if (typeof m.mainFile === "string") m.mainFile = map(m.mainFile);
    if (typeof m.activeFile === "string") m.activeFile = map(m.activeFile);
    m.openTabs = strArr(m.openTabs).map(map);
  }

  /** Đổi tên/chuyển chỗ một tệp HOẶC một thư mục (mọi đường dẫn con đổi theo). `to` là đường dẫn đầy đủ mới. */
  function rename(p, from, to) {
    var q = clone(p);
    var src = stripSlash(from);
    var fi = fileIndex(q, src);
    if (fi >= 0) {
      var target = normPath(to);
      if (target === src) return finish(q);
      var others = q.files.filter(function (f) { return f.path !== src; }).map(function (f) { return f.path; });
      var dirs = checkNewFile(target, others, q.meta.folders);
      target = canonicalDirs(target, dirs, false);
      q.files[fi] = { path: target, content: q.files[fi].content };
      keepParent(q, src);
      remapMeta(q, function (x) { return x === src ? target : x; });
      return finish(q);
    }
    if (!src || !isDir(q, src)) throw fail("Không có tệp hay thư mục '" + from + "'");
    var dest = normPath(stripSlash(to));
    if (dest === src) return finish(q);
    var lsrc = src.toLowerCase(), ldest = dest.toLowerCase();
    if (ldest.indexOf(lsrc + "/") === 0) throw fail("Không chuyển được thư mục '" + src + "' vào chính nó");
    var pre = src + "/";
    var inside = function (x) { return x === src || x.indexOf(pre) === 0; };
    var move = function (x) { return inside(x) ? dest + x.slice(src.length) : x; };
    if (ldest !== lsrc) {
      var rest = q.files.filter(function (f) { return !inside(f.path); }).map(function (f) { return f.path; });
      var restFolders = strArr(q.meta.folders).filter(function (d) { return !inside(d); });
      var files = lowerSet(rest), dirs = dirIndex(rest, restFolders);
      if (files[ldest]) throw fail("'" + dest + "' trùng tên một tệp");
      if (dirs[ldest]) throw fail("Thư mục '" + dirs[ldest] + "' đã có");
      ancestors(ldest).forEach(function (a) { if (files[a]) throw fail("'" + files[a] + "' là một tệp, không chứa được thư mục"); });
      dest = canonicalDirs(dest, dirs, false);
    }
    q.files = q.files.map(function (f) {
      if (!inside(f.path)) return f;
      var np = move(f.path);
      normPath(np, { store: !isRunnablePath(f.path) });     // đường dẫn mới vẫn phải hợp lệ (độ sâu, độ dài)
      return { path: np, content: f.content };
    });
    q.meta.folders = strArr(q.meta.folders).map(move);
    keepParent(q, src);
    remapMeta(q, move);
    var c = findConflict(q.files.map(function (f) { return f.path; }));
    if (c) throw fail(c);
    return finish(q);
  }

  /** Xoá một tệp hoặc cả thư mục. Dự án luôn còn ít nhất một tệp; thư mục cha trống đi vẫn được giữ lại. */
  function remove(p, path) {
    var q = clone(p);
    var src = stripSlash(path);
    var fi = fileIndex(q, src);
    if (fi >= 0) {
      if (q.files.length === 1) throw fail(q.kind === "snippet" ? "Không xoá được tệp duy nhất của đoạn mã" : "Dự án cần ít nhất một tệp");
      q.files.splice(fi, 1);
      keepParent(q, src);
      remapMeta(q, function (x) { return x === src ? "" : x; });
      return finish(q);
    }
    if (!src || !isDir(q, src)) throw fail("Không có tệp hay thư mục '" + path + "'");
    var pre = src + "/";
    var inside = function (x) { return x === src || x.indexOf(pre) === 0; };
    var left = q.files.filter(function (f) { return !inside(f.path); });
    if (!left.length) throw fail("Dự án cần ít nhất một tệp — không xoá được thư mục chứa mọi tệp");
    q.files = left;
    q.meta.folders = strArr(q.meta.folders).filter(function (d) { return !inside(d); });
    keepParent(q, src);
    remapMeta(q, function (x) { return inside(x) ? "" : x; });
    return finish(q);
  }

  /** Thay nội dung một tệp. */
  function setContent(p, path, content) {
    var q = clone(p), i = fileIndex(q, path);
    if (i < 0) throw fail("Không có tệp '" + path + "'");
    q.files[i] = { path: q.files[i].path, content: content == null ? "" : String(content) };
    return finish(q);
  }
  function setName(p, name) { var q = clone(p); q.name = cleanName(name); return finish(q); }
  /** Gộp `patch` vào meta (rồi chuẩn hoá: tham chiếu sai bị bỏ, ≤ 32 KB). */
  function setMeta(p, patch) {
    var q = clone(p);
    if (isObj(patch)) Object.keys(patch).forEach(function (k) { q.meta[k] = cloneJson(patch[k]); });
    return finish(q);
  }
  /** Đổi ngôn ngữ. Đoạn mã đang dùng tên tệp mặc định (main.cpp) thì đổi theo (main.py); std mặc định đổi theo. */
  function setLanguage(p, language) {
    var q = clone(p), old = q.language, lang = cleanLanguage(language, old || "plaintext");
    q.language = lang;
    if (q.meta.std === defaultStd(old) || q.meta.std === undefined) q.meta.std = defaultStd(lang);
    if (q.kind === "snippet" && q.files.length === 1 && q.files[0].path === defaultFileOf(old)) {
      var np = defaultFileOf(lang);
      if (np !== q.files[0].path) {
        var from = q.files[0].path;
        q.files[0] = { path: np, content: q.files[0].content };
        remapMeta(q, function (x) { return x === from ? np : x; });
      }
    }
    if (q.meta.mainFile && !endsWithAny(q.meta.mainFile, langExts(lang))) q.meta.mainFile = "";
    return finish(q);
  }
  function asProject(p) { var q = clone(p); q.kind = "project"; return finish(q); }
  function asSnippet(p) {
    var q = clone(p);
    if (q.files.length !== 1) throw fail("Chỉ dự án có đúng một tệp mới chuyển được thành đoạn mã");
    q.kind = "snippet"; q.meta.folders = [];
    return finish(q);
  }
  /** Bản sao với id mới. o: {name, id, now} */
  function duplicate(p, o) {
    o = o || {};
    var q = clone(p);
    q.id = o.id || newId();
    q.name = cleanName(o.name || ((q.name || "Không tên") + " (bản sao)"));
    q.updatedAt = o.now > 0 ? Math.floor(o.now) : 0;
    q.deleted = false;
    if (q.meta) q.meta.pinned = false;
    return finish(q);
  }

  /* ------------------------------------------------------------------ cây thư mục */
  /** [{name, path, type:"dir", children:[…]} | {name, path, type:"file", language}] — thư mục trước, theo tên (số tự nhiên). */
  function tree(p) {
    var top = { children: [], dirs: Object.create(null) };
    function dirNode(path) {
      var parts = path.split("/"), node = top, cur = "";
      for (var i = 0; i < parts.length; i++) {
        cur = cur ? cur + "/" + parts[i] : parts[i];
        var next = node.dirs[parts[i]];
        if (!next) { next = { name: parts[i], path: cur, type: "dir", children: [], dirs: Object.create(null) }; node.dirs[parts[i]] = next; node.children.push(next); }
        node = next;
      }
      return node;
    }
    var meta = (p && p.meta) || {};
    strArr(meta.folders).forEach(function (d) { if (d) dirNode(d); });
    ((p && p.files) || []).forEach(function (f) {
      var d = dirname(f.path), parent = d ? dirNode(d) : top;
      parent.children.push({ name: basename(f.path), path: f.path, type: "file", language: langs() ? langs().byFilename(f.path) : "" });
    });
    function finalize(list) {
      list.sort(function (a, b) { if (a.type !== b.type) return a.type === "dir" ? -1 : 1; return natCmp(a.name, b.name); });
      list.forEach(function (n) { if (n.type === "dir") { delete n.dirs; finalize(n.children); } });
      return list;
    }
    return finalize(top.children);
  }

  /* ------------------------------------------------------------------ tệp chính */
  function stripComments(src, lang) {
    var s = String(src || "");
    if (lang === "python" || lang === "ruby" || lang === "bash") return s.replace(/(^|\s)#[^\n]*/g, "$1");
    return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }
  /** Tệp vào chương trình theo quy ước ngôn ngữ, hoặc null nếu không có tệp nào. */
  function detectMain(p) {
    var files = (p && p.files) || [];
    if (!files.length) return null;
    var lang = p.language, exts = langExts(lang), re = MAIN_RE[lang];
    var names = MAIN_NAMES[lang] || [defaultFileOf(lang)];
    var mainW = MAIN_FIRST[lang] ? 4 : 2, nameW = MAIN_FIRST[lang] ? 2 : 4;
    var best = null, bestScore = -1, bestDepth = 0;
    files.forEach(function (f) {
      if (!f || typeof f.path !== "string") return;
      var isLang = exts.length ? endsWithAny(f.path, exts) : false;
      var named = names.indexOf(basename(f.path)) >= 0;
      var hasMain = !!(re && isLang && re.test(stripComments(f.content, lang)));
      var score = (hasMain ? mainW : 0) + (named ? nameW : 0) + (isLang ? 1 : 0);
      var depth = f.path.split("/").length;
      if (score > bestScore || (score === bestScore && depth < bestDepth)) { best = f.path; bestScore = score; bestDepth = depth; }
    });
    return best;
  }

  /** Mã Java bỏ chú thích, chuỗi, ký tự, text block (giữ nguyên độ dài và xuống dòng). */
  function stripJava(src) {
    var s = String(src || ""), out = [], i = 0, n = s.length;
    function blank(t) { return t.replace(/[^\n]/g, " "); }
    while (i < n) {
      var c = s.charAt(i), d = s.charAt(i + 1), j;
      if (c === "/" && d === "/") { j = s.indexOf("\n", i); j = j < 0 ? n : j; out.push(blank(s.slice(i, j))); i = j; }
      else if (c === "/" && d === "*") { j = s.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; out.push(blank(s.slice(i, j))); i = j; }
      else if (c === '"' && s.substr(i, 3) === '"""') { j = s.indexOf('"""', i + 3); j = j < 0 ? n : j + 3; out.push(blank(s.slice(i, j))); i = j; }
      else if (c === '"' || c === "'") {
        j = i + 1;
        while (j < n && s.charAt(j) !== c && s.charAt(j) !== "\n") j += s.charAt(j) === "\\" ? 2 : 1;
        j = Math.min(n, j + 1); out.push(blank(s.slice(i, j))); i = j;
      } else { out.push(c); i++; }
    }
    return out.join("");
  }
  /** {pkg, mainClass, hasMain} của một tệp Java: package và lớp cấp ngoài cùng chứa main. */
  function javaInfo(src) {
    var s = stripJava(src);
    var pkg = /^\s*package\s+([A-Za-z_][\w.]*)\s*;/m.exec(s);
    var mm = MAIN_RE.java.exec(s), mainClass = "";
    if (mm) {
      var stack = [], depth = 0, pending = null, re = /\b(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)|[{}]/g, m;
      while ((m = re.exec(s)) && m.index < mm.index) {
        if (m[1]) pending = m[1];
        else if (m[0] === "{") { depth++; if (pending) { stack.push({ name: pending, depth: depth }); pending = null; } }
        else { if (stack.length && stack[stack.length - 1].depth === depth) stack.pop(); depth--; }
      }
      if (stack.length) mainClass = stack[0].name;
    }
    return { pkg: pkg ? pkg[1] : "", mainClass: mainClass, hasMain: !!mm };
  }
  function javaQualified(f) {
    var info = javaInfo(f.content), cls = info.mainClass || basename(f.path).replace(/\.java$/i, "");
    return info.pkg ? info.pkg + "." + cls : cls;
  }
  /** Tệp chính thật sự dùng: meta.mainFile nếu còn; Java có meta.javaMain thì tệp khai báo lớp đó; không thì detectMain. */
  function mainFileOf(p) {
    var files = (p && p.files) || [], meta = (p && p.meta) || {};
    if (meta.mainFile && files.some(function (f) { return f.path === meta.mainFile; })) return meta.mainFile;
    if (p && p.language === "java" && meta.javaMain) {
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (/\.java$/i.test(f.path) && javaInfo(f.content).hasMain && javaQualified(f) === meta.javaMain) return f.path;
      }
    }
    return detectMain(p);
  }
  /** Tên lớp đầy đủ để chạy Java ("app.Main"), hoặc "" nếu tệp chính không phải .java. */
  function javaMainClass(p) {
    var path = mainFileOf(p);
    if (!path || !/\.java$/i.test(path)) return "";
    var f = p.files.filter(function (x) { return x.path === path; })[0];
    return javaQualified(f);
  }

  /* ------------------------------------------------------------------ yêu cầu /run */
  function isAllowedFlag(flag) {
    if (typeof flag !== "string") return false;
    if (own(EXACT_FLAGS, flag) || STD_FLAG.test(flag) || DEFINE_FLAG.test(flag)) return true;
    if (!INCLUDE_FLAG.test(flag)) return false;
    var dir = flag.slice(2);
    return dir.charAt(0) !== "/" && dir.split("/").indexOf("..") < 0;
  }
  function toList(v) {
    if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
    return Array.isArray(v) ? v.map(function (x) { return String(x).trim(); }).filter(Boolean) : [];
  }
  /**
   * Cờ biên dịch gửi đi: -std=<meta.std>, -<meta.opt>, rồi meta.compileArgs + o.compileArgs/o.extraFlags — CHỈ cờ backend cho phép,
   * chỉ cho C/C++ (ngôn ngữ khác không dùng). → {flags, rejected:[{flag, reason}]}
   */
  function compileFlags(p, o) {
    o = o || {};
    var meta = (p && p.meta) || {}, lang = p && p.language, flags = [], rejected = [];
    var extra = toList(meta.compileArgs).concat(toList(o.compileArgs), toList(o.extraFlags));
    if (lang !== "c" && lang !== "cpp") {
      extra.forEach(function (f) { rejected.push({ flag: f, reason: "Cờ biên dịch chỉ áp dụng cho C/C++" }); });
      return { flags: flags, rejected: rejected };
    }
    function push(f) {
      if (!isAllowedFlag(f)) { rejected.push({ flag: f, reason: "Cờ không nằm trong danh sách máy chủ cho phép" }); return; }
      if (flags.indexOf(f) >= 0) return;
      if (flags.length >= LIMITS.run.compileArgs) { rejected.push({ flag: f, reason: "Quá " + LIMITS.run.compileArgs + " cờ" }); return; }
      flags.push(f);
    }
    var std = typeof meta.std === "string" ? meta.std.trim().replace(/^-std=/, "") : defaultStd(lang);
    var opt = typeof meta.opt === "string" ? meta.opt.trim().replace(/^-/, "") : "O2";
    if (std && !extra.some(function (f) { return /^-std=/.test(f); })) push("-std=" + std);
    if (opt && !extra.some(function (f) { return /^-O/.test(f); })) push("-" + opt);
    extra.forEach(push);
    return { flags: flags, rejected: rejected };
  }
  /**
   * Thân POST /run: {provider?, language, files:[{name, content}], mainFile, stdin, args, compileArgs, runTimeoutMs?, compileTimeoutMs?}.
   * o: {provider, stdin, args, compileArgs|extraFlags, mainFile, runTimeoutMs, compileTimeoutMs}. Ngôn ngữ không chạy được → ném Error.
   */
  function toRunRequest(p, o) {
    o = o || {};
    var lang = p && p.language;
    if (RUN_LANGS.indexOf(lang) < 0) throw fail("Ngôn ngữ " + langLabel(lang) + " không chạy được trên máy chủ", "run_language");
    var meta = p.meta || {}, body = {};
    if (o.provider) body.provider = String(o.provider);
    body.language = lang;
    body.files = (p.files || []).map(function (f) { return { name: f.path, content: f.content == null ? "" : String(f.content) }; });
    var main = o.mainFile || mainFileOf(p);
    if (main) body.mainFile = main;
    body.stdin = o.stdin != null ? String(o.stdin) : (typeof meta.stdin === "string" ? meta.stdin : "");
    body.args = (Array.isArray(o.args) ? o.args : strArr(meta.args)).map(String);
    body.compileArgs = compileFlags(p, o).flags;
    if (o.runTimeoutMs != null) body.runTimeoutMs = o.runTimeoutMs;
    if (o.compileTimeoutMs != null) body.compileTimeoutMs = o.compileTimeoutMs;
    return body;
  }

  /* ------------------------------------------------------------------ kiểm theo giới hạn backend */
  function kb(n) { return (Math.round(n / 102.4) / 10) + " KB"; }
  /**
   * Mảng lỗi tiếng Việt (rỗng = ổn). o.target: "store" (đồng bộ /codestore), "run" (chạy /run), bỏ trống = cả hai
   * (phần "run" chỉ xét khi ngôn ngữ chạy được trên máy chủ).
   */
  function validate(p, o) {
    var target = o && o.target, errs = [];
    var store = !target || target === "store", run = !target || target === "run";
    if (!p || typeof p !== "object") return ["Bản ghi không hợp lệ"];
    var files = Array.isArray(p.files) ? p.files : [];
    var bad = files.filter(function (f) { return !f || typeof f.path !== "string" || typeof f.content !== "string"; });
    if (bad.length) return ["Danh sách tệp không hợp lệ (mỗi tệp cần path và content là chuỗi)"];
    if (store) {
      if (typeof p.id !== "string" || !ID_RE.test(p.id)) errs.push("Mã bản ghi (id) không hợp lệ: chỉ gồm chữ, số, '_', '.', ':', '-' và tối đa 80 ký tự");
      if (p.kind !== "snippet" && p.kind !== "project") errs.push("Loại bản ghi phải là 'snippet' hoặc 'project'");
      if (typeof p.language !== "string" || !LANG_RE.test(p.language)) errs.push("Tên ngôn ngữ không hợp lệ (tối đa 32 ký tự [A-Za-z0-9_+#.-])");
      var nm = typeof p.name === "string" ? p.name : "";
      if (cpLen(nm) > LIMITS.store.nameChars) errs.push("Tên quá dài (tối đa " + LIMITS.store.nameChars + " ký tự)");
      if (/[\u0000-\u001f\u007f-\u009f]/.test(pyStrip(nm))) errs.push("Tên chứa ký tự điều khiển");
      var t = p.updatedAt;
      if (typeof t !== "number" || !isFinite(t) || t < 0 || Math.floor(t) !== t || t > LIMITS.store.maxTimestamp) errs.push("Thời điểm sửa (updatedAt) không hợp lệ");
      if (!p.deleted) {
        if (!files.length) errs.push("Bản ghi cần ít nhất một tệp");
        if (p.kind === "snippet" && files.length > 1) errs.push("Đoạn mã (snippet) chỉ gồm đúng một tệp");
        if (files.length > LIMITS.store.files) errs.push("Dự án có " + files.length + " tệp — tối đa " + LIMITS.store.files);
        var norm = [];
        files.forEach(function (f) {
          try { norm.push(normPath(f.path, { store: true })); } catch (e) { errs.push("Tệp '" + f.path + "': " + e.message); }
        });
        var c = findConflict(norm);
        if (c) errs.push(c);
        if (p.meta !== undefined && !isObj(p.meta)) errs.push("meta phải là một đối tượng");
        else {
          var mb = pyJsonBytes(p.meta || {});
          if (mb > LIMITS.store.metaBytes) errs.push("meta quá lớn (" + mb + " byte, tối đa " + LIMITS.store.metaBytes + ")");
        }
        var ib = itemBytes(p);
        if (ib > LIMITS.store.itemBytes) errs.push("Bản ghi quá lớn để đồng bộ (" + kb(ib) + ", tối đa 512 KB)");
      }
    }
    if (run && !p.deleted) {
      var lang = p.language, meta = isObj(p.meta) ? p.meta : {};
      if (RUN_LANGS.indexOf(lang) < 0) {
        if (target === "run") errs.push("Ngôn ngữ " + langLabel(lang) + " không chạy được trên máy chủ");
      } else {
        if (!files.length) errs.push("Không có tệp nào để chạy");
        if (files.length > LIMITS.run.files) errs.push("Dự án có " + files.length + " tệp — chạy trên máy chủ chỉ nhận tối đa " + LIMITS.run.files);
        var names = [], total = 0;
        files.forEach(function (f) {
          try { names.push(normPath(f.path)); } catch (e) { errs.push("Tệp '" + f.path + "' không chạy được: " + e.message); names.push(f.path); }
          var b = utf8Bytes(f.content);
          total += b;
          if (b > LIMITS.run.fileBytes) errs.push("Tệp '" + f.path + "' quá lớn để chạy (" + kb(b) + ", tối đa 128 KB)");
        });
        if (total > LIMITS.run.totalBytes) errs.push("Tổng dung lượng mã quá lớn để chạy (" + kb(total) + ", tối đa 256 KB)");
        var rc = findConflict(names);
        if (rc) errs.push(rc);
        if (COMPILED[lang] && !files.some(function (f) { return endsWithAny(f.path, RUN_EXT[lang]); }))
          errs.push("Không có tệp mã nguồn " + RUN_EXT[lang].join("/") + " nào để biên dịch");
        var stdin = typeof meta.stdin === "string" ? meta.stdin : "";
        if (utf8Bytes(stdin) > LIMITS.run.stdinBytes) errs.push("Dữ liệu vào (stdin) quá lớn (tối đa 64 KB)");
        var args = strArr(meta.args);
        if (args.length > LIMITS.run.args) errs.push("Quá nhiều tham số chương trình (tối đa " + LIMITS.run.args + ")");
        args.forEach(function (a) {
          if (cpLen(a) > LIMITS.run.argChars) errs.push("Tham số chương trình dài quá " + LIMITS.run.argChars + " ký tự");
          if (a.indexOf("\u0000") >= 0) errs.push("Tham số chương trình không được chứa ký tự NUL");
        });
        compileFlags(p).rejected.forEach(function (r) {
          if (lang === "c" || lang === "cpp") errs.push("Cờ biên dịch '" + r.flag + "' bị bỏ: " + r.reason);
        });
        if (lang === "java") {
          var mf = mainFileOf(p), f = files.filter(function (x) { return x.path === mf; })[0];
          if (f && /\.java$/i.test(f.path)) {
            var info = javaInfo(f.content), stem = basename(f.path).replace(/\.java$/i, "");
            if (!info.hasMain) errs.push("Tệp chính '" + f.path + "' không có hàm public static void main");
            else if (info.mainClass && info.mainClass !== stem)
              errs.push("Lớp chứa main là '" + info.mainClass + "' nhưng tệp tên '" + basename(f.path) + "' — máy chủ chạy lớp theo tên tệp, hãy đặt lớp vào " + info.mainClass + ".java");
          }
        }
      }
    }
    return unique(errs);
  }

  /* ------------------------------------------------------------------ mẫu dự án (mỗi mẫu chạy được và in ra gì đó) */
  var TEMPLATES = [
    { id: "cpp-single", name: "C++ · một tệp", language: "cpp", description: "Một tệp main.cpp — vector và accumulate.",
      meta: { mainFile: "main.cpp", std: "c++17" },
      files: [{ path: "main.cpp", content: [
        "#include <iostream>",
        "#include <numeric>",
        "#include <vector>",
        "",
        "int main() {",
        "    std::vector<int> a = {3, 1, 4, 1, 5, 9, 2, 6};",
        "    int sum = std::accumulate(a.begin(), a.end(), 0);",
        "    std::cout << \"Xin chào từ C++!\" << std::endl;",
        "    std::cout << \"Tổng các phần tử: \" << sum << std::endl;",
        "    return 0;",
        "}", ""].join("\n") }] },

    { id: "cpp-multi", name: "C++ · nhiều tệp (src + include)", language: "cpp",
      description: "main.cpp + src/*.cpp + include/*.h; include theo đường dẫn tương đối nên không cần cờ -I.",
      meta: { mainFile: "main.cpp", std: "c++17" },
      files: [
        { path: "main.cpp", content: [
          "#include <iostream>",
          "#include <vector>",
          "",
          "#include \"include/shapes.h\"",
          "#include \"include/stats.h\"",
          "",
          "int main() {",
          "    Rectangle r(3.0, 4.0);",
          "    Circle c(1.5);",
          "    std::cout << \"Dự án C++ nhiều tệp\" << std::endl;",
          "    std::cout << \"Diện tích hình chữ nhật 3x4: \" << r.area() << std::endl;",
          "    std::cout << \"Chu vi hình tròn r=1.5: \" << c.perimeter() << std::endl;",
          "    std::vector<double> xs = {2, 4, 4, 4, 5, 5, 7, 9};",
          "    std::cout << \"Trung bình: \" << stats::mean(xs) << \", độ lệch chuẩn: \" << stats::stddev(xs) << std::endl;",
          "    return 0;",
          "}", ""].join("\n") },
        { path: "include/shapes.h", content: [
          "#ifndef SHAPES_H",
          "#define SHAPES_H",
          "",
          "class Rectangle {",
          "public:",
          "    Rectangle(double w, double h);",
          "    double area() const;",
          "    double perimeter() const;",
          "private:",
          "    double w_, h_;",
          "};",
          "",
          "class Circle {",
          "public:",
          "    explicit Circle(double r);",
          "    double area() const;",
          "    double perimeter() const;",
          "private:",
          "    double r_;",
          "};",
          "",
          "#endif", ""].join("\n") },
        { path: "include/stats.h", content: [
          "#ifndef STATS_H",
          "#define STATS_H",
          "",
          "#include <vector>",
          "",
          "namespace stats {",
          "double mean(const std::vector<double>& xs);",
          "double stddev(const std::vector<double>& xs);",
          "}",
          "",
          "#endif", ""].join("\n") },
        { path: "src/shapes.cpp", content: [
          "#include \"../include/shapes.h\"",
          "",
          "static const double PI = 3.14159265358979323846;",
          "",
          "Rectangle::Rectangle(double w, double h) : w_(w), h_(h) {}",
          "double Rectangle::area() const { return w_ * h_; }",
          "double Rectangle::perimeter() const { return 2 * (w_ + h_); }",
          "",
          "Circle::Circle(double r) : r_(r) {}",
          "double Circle::area() const { return PI * r_ * r_; }",
          "double Circle::perimeter() const { return 2 * PI * r_; }", ""].join("\n") },
        { path: "src/stats.cpp", content: [
          "#include \"../include/stats.h\"",
          "",
          "#include <cmath>",
          "",
          "namespace stats {",
          "double mean(const std::vector<double>& xs) {",
          "    if (xs.empty()) return 0;",
          "    double s = 0;",
          "    for (double x : xs) s += x;",
          "    return s / xs.size();",
          "}",
          "",
          "double stddev(const std::vector<double>& xs) {",
          "    if (xs.empty()) return 0;",
          "    double m = mean(xs), s = 0;",
          "    for (double x : xs) s += (x - m) * (x - m);",
          "    return std::sqrt(s / xs.size());",
          "}",
          "}", ""].join("\n") }] },

    { id: "c-multi", name: "C · nhiều tệp (src + include)", language: "c",
      description: "main.c + src/*.c + include/*.h; include theo đường dẫn tương đối.",
      meta: { mainFile: "main.c", std: "c11" },
      files: [
        { path: "main.c", content: [
          "#include <stdio.h>",
          "",
          "#include \"include/mathutil.h\"",
          "#include \"include/strutil.h\"",
          "",
          "int main(void) {",
          "    int a[] = {5, 3, 8, 1, 9, 2};",
          "    int n = (int)(sizeof a / sizeof a[0]);",
          "    char word[] = \"studio\";",
          "",
          "    printf(\"Dự án C nhiều tệp\\n\");",
          "    printf(\"Lớn nhất: %d, tổng: %d\\n\", max_of(a, n), sum_of(a, n));",
          "    printf(\"UCLN(84, 36) = %d\\n\", gcd(84, 36));",
          "    reverse_in_place(word);",
          "    printf(\"Đảo chuỗi: %s\\n\", word);",
          "    return 0;",
          "}", ""].join("\n") },
        { path: "include/mathutil.h", content: [
          "#ifndef MATHUTIL_H",
          "#define MATHUTIL_H",
          "",
          "int max_of(const int *a, int n);",
          "int sum_of(const int *a, int n);",
          "int gcd(int a, int b);",
          "",
          "#endif", ""].join("\n") },
        { path: "include/strutil.h", content: [
          "#ifndef STRUTIL_H",
          "#define STRUTIL_H",
          "",
          "void reverse_in_place(char *s);",
          "",
          "#endif", ""].join("\n") },
        { path: "src/mathutil.c", content: [
          "#include \"../include/mathutil.h\"",
          "",
          "int max_of(const int *a, int n) {",
          "    int best = a[0];",
          "    for (int i = 1; i < n; i++)",
          "        if (a[i] > best) best = a[i];",
          "    return best;",
          "}",
          "",
          "int sum_of(const int *a, int n) {",
          "    int s = 0;",
          "    for (int i = 0; i < n; i++) s += a[i];",
          "    return s;",
          "}",
          "",
          "int gcd(int a, int b) {",
          "    while (b != 0) {",
          "        int t = a % b;",
          "        a = b;",
          "        b = t;",
          "    }",
          "    return a;",
          "}", ""].join("\n") },
        { path: "src/strutil.c", content: [
          "#include \"../include/strutil.h\"",
          "",
          "#include <string.h>",
          "",
          "void reverse_in_place(char *s) {",
          "    size_t n = strlen(s);",
          "    for (size_t i = 0; i < n / 2; i++) {",
          "        char t = s[i];",
          "        s[i] = s[n - 1 - i];",
          "        s[n - 1 - i] = t;",
          "    }",
          "}", ""].join("\n") }] },

    { id: "java-single", name: "Java · một lớp Main", language: "java", description: "Main.java — 10 số nguyên tố đầu tiên.",
      meta: { mainFile: "Main.java" },
      files: [{ path: "Main.java", content: [
        "import java.util.ArrayList;",
        "import java.util.List;",
        "",
        "public class Main {",
        "    public static void main(String[] args) {",
        "        List<Integer> primes = new ArrayList<>();",
        "        for (int n = 2; primes.size() < 10; n++) {",
        "            if (isPrime(n)) primes.add(n);",
        "        }",
        "        System.out.println(\"Xin chào từ Java!\");",
        "        System.out.println(\"10 số nguyên tố đầu tiên: \" + primes);",
        "    }",
        "",
        "    static boolean isPrime(int n) {",
        "        for (int d = 2; (long) d * d <= n; d++) {",
        "            if (n % d == 0) return false;",
        "        }",
        "        return n >= 2;",
        "    }",
        "}", ""].join("\n") }] },

    { id: "java-package", name: "Java · có package (src/app)", language: "java",
      description: "src/app/Main.java (package app) + src/app/util/*.java (package app.util); lớp chạy là app.Main.",
      meta: { mainFile: "src/app/Main.java" },
      files: [
        { path: "src/app/Main.java", content: [
          "package app;",
          "",
          "import app.util.Greeter;",
          "import app.util.MathUtil;",
          "",
          "public class Main {",
          "    public static void main(String[] args) {",
          "        Greeter greeter = new Greeter(\"Code Studio\");",
          "        System.out.println(greeter.greet());",
          "        System.out.println(\"5! = \" + MathUtil.factorial(5));",
          "        System.out.println(\"Fibonacci(20) = \" + MathUtil.fibonacci(20));",
          "    }",
          "}", ""].join("\n") },
        { path: "src/app/util/Greeter.java", content: [
          "package app.util;",
          "",
          "public class Greeter {",
          "    private final String name;",
          "",
          "    public Greeter(String name) {",
          "        this.name = name;",
          "    }",
          "",
          "    public String greet() {",
          "        return \"Xin chào từ \" + name + \" (Java có package)!\";",
          "    }",
          "}", ""].join("\n") },
        { path: "src/app/util/MathUtil.java", content: [
          "package app.util;",
          "",
          "public final class MathUtil {",
          "    private MathUtil() {",
          "    }",
          "",
          "    public static long factorial(int n) {",
          "        long r = 1;",
          "        for (int i = 2; i <= n; i++) r *= i;",
          "        return r;",
          "    }",
          "",
          "    public static long fibonacci(int n) {",
          "        long a = 0, b = 1;",
          "        for (int i = 0; i < n; i++) {",
          "            long t = a + b;",
          "            a = b;",
          "            b = t;",
          "        }",
          "        return a;",
          "    }",
          "}", ""].join("\n") }] },

    { id: "python-multi", name: "Python · nhiều mô-đun", language: "python",
      description: "main.py + gói geometry/ + mô-đun textutil.py.",
      meta: { mainFile: "main.py" },
      files: [
        { path: "main.py", content: [
          "from geometry.shapes import Circle, Rectangle",
          "from textutil import title_case, word_count",
          "",
          "",
          "def main():",
          "    shapes = [Rectangle(3, 4), Circle(1.5)]",
          "    print(\"Dự án Python nhiều mô-đun\")",
          "    for s in shapes:",
          "        print(f\"{s.name}: diện tích = {s.area():.2f}\")",
          "    text = \"lập trình python thật vui\"",
          "    print(title_case(text), \"-\", word_count(text), \"từ\")",
          "",
          "",
          "if __name__ == \"__main__\":",
          "    main()", ""].join("\n") },
        { path: "geometry/__init__.py", content: "\"\"\"Gói hình học nhỏ cho mẫu dự án.\"\"\"\n" },
        { path: "geometry/shapes.py", content: [
          "import math",
          "",
          "",
          "class Rectangle:",
          "    name = \"Hình chữ nhật\"",
          "",
          "    def __init__(self, w, h):",
          "        self.w, self.h = w, h",
          "",
          "    def area(self):",
          "        return self.w * self.h",
          "",
          "",
          "class Circle:",
          "    name = \"Hình tròn\"",
          "",
          "    def __init__(self, r):",
          "        self.r = r",
          "",
          "    def area(self):",
          "        return math.pi * self.r ** 2", ""].join("\n") },
        { path: "textutil.py", content: [
          "def title_case(text):",
          "    return \" \".join(w[:1].upper() + w[1:] for w in text.split())",
          "",
          "",
          "def word_count(text):",
          "    return len(text.split())", ""].join("\n") }] },

    { id: "js-multi", name: "JavaScript · Node.js nhiều tệp", language: "javascript",
      description: "main.js + lib/*.js (CommonJS require).",
      meta: { mainFile: "main.js" },
      files: [
        { path: "main.js", content: [
          "const { mean, median } = require(\"./lib/stats\");",
          "const { table } = require(\"./lib/format\");",
          "",
          "const scores = [7, 9, 4, 10, 6, 8];",
          "console.log(\"Xin chào từ JavaScript (Node.js)!\");",
          "console.log(table([",
          "  [\"Trung bình\", mean(scores).toFixed(2)],",
          "  [\"Trung vị\", median(scores)],",
          "]));", ""].join("\n") },
        { path: "lib/stats.js", content: [
          "function mean(xs) {",
          "  return xs.reduce((a, b) => a + b, 0) / xs.length;",
          "}",
          "",
          "function median(xs) {",
          "  const s = [...xs].sort((a, b) => a - b);",
          "  const m = Math.floor(s.length / 2);",
          "  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;",
          "}",
          "",
          "module.exports = { mean, median };", ""].join("\n") },
        { path: "lib/format.js", content: [
          "function table(rows) {",
          "  const width = Math.max(...rows.map((r) => String(r[0]).length));",
          "  return rows.map((r) => String(r[0]).padEnd(width) + \" : \" + r[1]).join(\"\\n\");",
          "}",
          "",
          "module.exports = { table };", ""].join("\n") }] }
  ];
  (function deepFreeze(o) { Object.freeze(o); Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === "object" && !Object.isFrozen(o[k])) deepFreeze(o[k]); }); })(TEMPLATES);

  CS.project = {
    limits: LIMITS, runLanguages: RUN_LANGS, templates: TEMPLATES,
    newId: newId, normPath: normPath, findConflict: findConflict, normalize: normalize, clone: clone,
    createSnippet: createSnippet, createProject: createProject,
    addFile: addFile, addFolder: addFolder, rename: rename, remove: remove, setContent: setContent,
    setName: setName, setMeta: setMeta, setLanguage: setLanguage, asProject: asProject, asSnippet: asSnippet, duplicate: duplicate,
    tree: tree, detectMain: detectMain, mainFileOf: mainFileOf, javaMainClass: javaMainClass,
    isAllowedFlag: isAllowedFlag, compileFlags: compileFlags, toRunRequest: toRunRequest, validate: validate,
    itemBytes: itemBytes, pyJsonBytes: pyJsonBytes, utf8Bytes: utf8Bytes
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.project;
})(typeof globalThis !== "undefined" ? globalThis : this);
