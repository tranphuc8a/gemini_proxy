/* format-ext.js — các bộ định dạng NGOÀI mà người dùng có thể chọn thay cho bộ "Tự viết" (format.js).
   Chỉ tải khi người dùng chọn và đồng ý (hỏi qua CS.format.confirmDownload(provider) → Promise<boolean>, do giao diện cung cấp);
   tải xong trình duyệt tự giữ trong bộ nhớ đệm HTTP. Lỗi tải/lỗi cú pháp → format.run() tự rơi về bộ tự viết và nói lý do.
     • clang-format (WebAssembly, @wasm-fmt/clang-format): C, C++, Java, JavaScript, TypeScript, C#  — chuẩn công nghiệp, chọn kiểu LLVM/Google/…
     • Prettier (standalone): JavaScript, TypeScript, JSON, CSS, HTML, Markdown
     • Ruff (WebAssembly, @wasm-fmt/ruff_fmt): Python — tương thích Black
   Phiên bản được ghim; đổi bằng CS.formatExt.versions trước khi dùng. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});
  if (!CS.format) return;

  var V = { clang: "23.1.1", ruff: "0.15.20", prettier: "3.9.10" };
  var CDN = "https://cdn.jsdelivr.net/npm/";
  var loading = {};

  function once(key, make) {
    if (!loading[key]) loading[key] = Promise.resolve().then(make).catch(function (e) { delete loading[key]; throw e; });
    return loading[key];
  }
  function ask(p) {
    var fn = CS.format.confirmDownload;
    return fn ? Promise.resolve(fn(p)).then(function (ok) { if (!ok) throw new Error("bạn chưa đồng ý tải " + p.label); }) : Promise.resolve();
  }
  /* import() động: dùng được trong script thường ở mọi trình duyệt hiện đại (Chrome/Edge 63+, Firefox 67+, Safari 11.1+) */
  function imp(url) { return import(url); }
  function indentOf(o) { return o.indent === "tab" ? { tab: true, n: 4 } : { tab: false, n: (o.indent | 0) || 4 }; }

  /* ---------------- clang-format ---------------- */
  var CLANG_FILE = { c: "main.c", cpp: "main.cpp", java: "Main.java", javascript: "main.js", typescript: "main.ts", csharp: "main.cs" };
  var clangP = {
    id: "clang-format", label: "clang-format (WebAssembly)", kind: "wasm", needsDownload: "≈ 2–3 MB",
    langs: ["c", "cpp", "java", "javascript", "typescript", "csharp"], styles: ["Google", "LLVM", "Chromium", "Mozilla", "WebKit", "Microsoft", "GNU"],
    note: "Chuẩn của LLVM — y như clang-format trong VS Code/CLion. Tải một lần.",
    format: function (text, lang, opts) {
      return once("clang", function () { return ask(clangP).then(function () { return imp(CDN + "@wasm-fmt/clang-format@" + V.clang + "/clang-format-web.js"); }).then(function (m) { return Promise.resolve(m.default()).then(function () { return m; }); }); })
        .then(function (m) {
          var o = CS.format.withDefaults(lang, opts), ind = indentOf(o);
          var style = {
            BasedOnStyle: o.clangStyle || "Google", IndentWidth: ind.n, TabWidth: ind.n, UseTab: ind.tab ? "ForIndentation" : "Never",
            BreakBeforeBraces: o.braces === "allman" ? "Allman" : "Attach", ColumnLimit: o.columnLimit || 100,
            AllowShortFunctionsOnASingleLine: o.keepOneLiners ? "All" : "Empty", AllowShortBlocksOnASingleLine: o.keepOneLiners ? "Always" : "Never",
            AllowShortIfStatementsOnASingleLine: o.keepOneLiners ? "WithoutElse" : "Never", AllowShortLoopsOnASingleLine: !!o.keepOneLiners,
            IndentCaseLabels: o.indentCase !== false, NamespaceIndentation: o.indentNamespace ? "All" : "None", SortIncludes: "Never"
          };
          if (o.pointer === "left" || o.pointer === "right") { style.DerivePointerAlignment = false; style.PointerAlignment = o.pointer === "left" ? "Left" : "Right"; }
          var out = m.format(text, CLANG_FILE[lang] || "main.cpp", JSON.stringify(style));
          return o.finalNewline && out && !/\n$/.test(out) ? out + "\n" : out;
        });
    }
  };

  /* ---------------- Ruff (Python) ---------------- */
  var ruffP = {
    id: "ruff", label: "Ruff (WebAssembly, kiểu Black)", kind: "wasm", needsDownload: "≈ 3 MB", langs: ["python"],
    note: "Bộ định dạng Python của Astral, cho kết quả như Black. Tải một lần.",
    format: function (text, lang, opts) {
      return once("ruff", function () { return ask(ruffP).then(function () { return imp(CDN + "@wasm-fmt/ruff_fmt@" + V.ruff + "/ruff_fmt_web.js"); }).then(function (m) { return Promise.resolve(m.default()).then(function () { return m; }); }); })
        .then(function (m) {
          var o = CS.format.withDefaults(lang, opts), ind = indentOf(o);
          return m.format(text, "main.py", { indent_style: ind.tab ? "tab" : "space", indent_width: ind.n, line_width: o.columnLimit || 88, quote_style: "double" });
        });
    }
  };

  /* ---------------- Prettier ---------------- */
  var PARSER = { javascript: ["babel", ["babel", "estree"]], typescript: ["typescript", ["typescript", "estree"]], json: ["json", ["babel", "estree"]],
    css: ["css", ["postcss"]], html: ["html", ["html", "babel", "estree", "postcss"]], markdown: ["markdown", ["markdown"]] };
  var prettierP = {
    id: "prettier", label: "Prettier", kind: "js", needsDownload: "≈ 1–3 MB tuỳ ngôn ngữ", langs: Object.keys(PARSER),
    note: "Chuẩn của cộng đồng JavaScript/Web. Tải phần cần cho ngôn ngữ đang dùng.",
    format: function (text, lang, opts) {
      var cfg = PARSER[lang];
      return once("prettier", function () { return ask(prettierP).then(function () { return imp(CDN + "prettier@" + V.prettier + "/standalone.mjs"); }); })
        .then(function (core) {
          return Promise.all(cfg[1].map(function (pl) { return once("prettier-" + pl, function () { return imp(CDN + "prettier@" + V.prettier + "/plugins/" + pl + ".mjs"); }); }))
            .then(function (plugins) {
              var o = CS.format.withDefaults(lang, opts), ind = indentOf(o);
              return core.format(text, { parser: cfg[0], plugins: plugins, tabWidth: ind.n, useTabs: ind.tab, printWidth: o.columnLimit || 100, semi: o.semi !== false, singleQuote: !!o.singleQuote });
            });
        });
    }
  };

  CS.format.register(clangP);
  CS.format.register(prettierP);
  CS.format.register(ruffP);
  CS.formatExt = { versions: V, providers: [clangP, prettierP, ruffP] };
})(typeof globalThis !== "undefined" ? globalThis : this);
