/* Kiểm bộ chạy mã (core/runner.js): hàm thuần, nơi chạy server:<id> và piston-custom bằng fetch GIẢ, huỷ, lỗi hạ tầng, chuẩn hoá,
   targets, và phân tích chẩn đoán bằng mẫu stderr THẬT của g++ 14 / clang / javac / python / node / go (đã lưu cứng) + chạy chương trình thật
   một lần (nếu máy có). Được kiem.js nạp. Không gọi mạng. Bộ chạy trong trình duyệt (assets/run/*.js) kiểm ở kiem-chay-trinh-duyet.py. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");

/* ---------------------------------------------------------------- fetch giả */
const resp = (status, body, headers) => {
  const h = {}; Object.keys(headers || {}).forEach((k) => { h[k.toLowerCase()] = headers[k]; });
  return { ok: status >= 200 && status < 300, status, headers: { get: (k) => (k.toLowerCase() in h ? h[k.toLowerCase()] : null) }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : body) };
};
const fakeFetch = (handler) => { const f = (url, init) => { f.calls.push({ url, init: init || {} }); return Promise.resolve().then(() => handler(url, init || {}, f.calls.length)); }; f.calls = []; return f; };
const okBody = (over) => Object.assign({ ok: true, provider: "piston", language: "cpp", version: "10.2.0",
  compile: { ran: true, ok: true, stdout: "", stderr: "", code: 0, signal: null, ms: 412, timedOut: false, truncated: false },
  run: { ran: true, ok: true, stdout: "42\n", stderr: "", code: 0, signal: null, ms: 3, timedOut: false, truncated: false }, error: null, warnings: [] }, over || {});
const rejected = async (p) => { try { await p; return null; } catch (e) { return e; } };
const F = (name, content) => ({ name, content: content == null ? "" : content });
const reqOf = (over) => Object.assign({ target: "server:piston", language: "cpp", files: [F("main.cpp", "int main(){}")], mainFile: "main.cpp", stdin: "", args: [], std: "c++17", opt: "O2", compileArgs: [] }, over || {});

module.exports = async function ({ nhom, kiem, bang, CS }) {
  const R = CS.runner;
  if (!R) { nhom("runner"); kiem("có module runner", false); return; }

  /* ================================================================ hàm thuần */
  nhom("runner · hàm thuần");
  {
    const a = R.splitStdoutLimit("héllo", 100);
    kiem("splitStdoutLimit · ngắn thì giữ nguyên", a.text === "héllo" && a.truncated === false);
    const b = R.splitStdoutLimit("é".repeat(10), 5);
    kiem("splitStdoutLimit · cắt theo BYTE UTF-8 (é = 2 byte), không cắt ngang ký tự", b.truncated && b.text === "éé" && b.bytes === 4, JSON.stringify(b));
    const c = R.splitStdoutLimit("😀😀😀", 9);
    kiem("splitStdoutLimit · cặp thay thế (emoji 4 byte) không bị tách đôi", c.truncated && c.text === "😀😀", JSON.stringify(c));
    const d = R.splitStdoutLimit("a".repeat(1048577));
    kiem("splitStdoutLimit · mặc định 1 MiB", d.truncated && d.text.length === 1048576);

    const f1 = R.buildCompileArgs({ language: "cpp" });
    kiem("buildCompileArgs · C++ mặc định -std=c++17 -O2", bang(f1.flags, ["-std=c++17", "-O2"]) && f1.rejected.length === 0, JSON.stringify(f1));
    const f2 = R.buildCompileArgs({ language: "cpp", std: "c++20", opt: "O3", extra: ["-Wall", "-fplugin=evil.so", "-o", "x", "-DDEBUG=1", "-Iinclude", "-I../up", "-lm"] });
    kiem("buildCompileArgs · chỉ giữ cờ backend cho phép; -fplugin/-o/-I.. bị loại và có lý do", bang(f2.flags, ["-std=c++20", "-O3", "-Wall", "-DDEBUG=1", "-Iinclude", "-lm"]) && f2.rejected.map((r) => r.flag).join() === "-fplugin=evil.so,-o,x,-I../up" && f2.rejected.every((r) => r.reason), JSON.stringify(f2));
    const f3 = R.buildCompileArgs({ language: "c", std: "c11", opt: "O0", extra: "-Wall -Wextra -std=c99" });
    kiem("buildCompileArgs · chuỗi cờ tách theo dấu cách; -std= do người dùng ghi thắng cài đặt", bang(f3.flags, ["-O0", "-Wall", "-Wextra", "-std=c99"]), JSON.stringify(f3));
    const f4 = R.buildCompileArgs({ language: "java", extra: ["-Wall"] });
    kiem("buildCompileArgs · ngôn ngữ không phải C/C++: không cờ nào, cờ thêm bị loại", f4.flags.length === 0 && f4.rejected.length === 1);
    const f5 = R.buildCompileArgs({ language: "cpp", extra: Array.from({ length: 20 }, (_, i) => "-DX" + i) });
    kiem("buildCompileArgs · tối đa 16 cờ như backend", f5.flags.length === 16 && f5.rejected.length === 6, f5.flags.length + "/" + f5.rejected.length);
    kiem("buildCompileArgs · -std=gnu++2b và -Wpedantic hợp lệ; -Os không (backend chỉ cho O0-O3)", R.buildCompileArgs({ language: "cpp", std: "gnu++2b", extra: ["-Wpedantic", "-Os"] }).rejected.map((r) => r.flag).join() === "-Os");

    kiem("mainFileFor · tên theo quy ước ở thư mục con (src/main.cpp)", R.mainFileFor("cpp", [F("a.cpp"), F("src/main.cpp"), F("b.h")]) === "src/main.cpp");
    kiem("mainFileFor · mainFile yêu cầu thắng khi có trong danh sách; không có thì bỏ qua", R.mainFileFor("cpp", [F("a.cpp"), F("main.cpp")], "a.cpp") === "a.cpp" && R.mainFileFor("cpp", [F("a.cpp"), F("main.cpp")], "zzz.cpp") === "main.cpp");
    kiem("mainFileFor · không có tên quy ước: tệp có hàm main()", R.mainFileFor("cpp", [F("util.cpp", "int add(int a,int b){return a+b;}"), F("app.cpp", "int main() { return 0; }")]) === "app.cpp");
    kiem("mainFileFor · Java Main.java sâu trong package; Python __main__.py; không khớp gì → tệp đầu", R.mainFileFor("java", [F("src/app/util/Calc.java"), F("src/app/Main.java")]) === "src/app/Main.java" && R.mainFileFor("python", [F("lib.py"), F("__main__.py")]) === "__main__.py" && R.mainFileFor("rust", [F("zzz.txt")]) === "zzz.txt");
    kiem("mainFileFor · đường dẫn kiểu Windows ./a\\b.py được chuẩn hoá", R.mainFileFor("python", [".\\pkg\\main.py", "x.py"]) === "pkg/main.py");
    kiem("PISTON_LANG · cpp ↔ c++, csharp, bí danh đọc ngược", R.PISTON_LANG.cpp === "c++" && R.PISTON_LANG.csharp === "csharp" && R.PISTON_BACK["c++"] === "cpp" && R.PISTON_BACK.node === "javascript" && Object.keys(R.PISTON_LANG).length === 13);
  }

  /* ---------------------------------------------------------------- lỗi hạ tầng */
  nhom("runner · friendlyError (mã HTTP + data.code → tiếng Việt)");
  {
    const E = (status, code, data, message) => R.friendlyError(status, { status_code: status, message: message || "", data: Object.assign({ code }, data || {}) });
    let e = E(429, "run_rate_limited", { retryAfter: 7 });
    kiem("429 run_rate_limited → \"Chạy quá nhanh, thử lại sau 7 giây\"", e.code === "run_rate_limited" && e.retryAfter === 7 && e.message === "Chạy quá nhanh, thử lại sau 7 giây." && e.status === 429, e.message);
    e = E(429, "run_rate_limited", {});
    kiem("429 không có retryAfter → vẫn nói chạy quá nhanh", /Chạy quá nhanh/.test(e.message) && e.retryAfter === null);
    e = E(429, "run_busy", {});
    kiem("429 run_busy → máy chủ đang bận", /bận/.test(e.message) && e.code === "run_busy");
    e = E(403, "admin_required", {}, "Cần quyền quản trị");
    kiem("403 admin_required → \"Cần khoá quản trị để dùng máy chủ cục bộ\"", e.code === "admin_required" && /Cần khoá quản trị để dùng máy chủ cục bộ/.test(e.message));
    e = E(502, "run_provider_unavailable", { provider: "judge0", detail: "HTTP 503" });
    kiem("502 unavailable → nêu nơi chạy + gợi ý chọn nơi khác + chi tiết", e.code === "run_provider_unavailable" && /judge0/.test(e.message) && /nơi chạy khác/.test(e.message) && /HTTP 503/.test(e.message), e.message);
    e = E(502, "run_provider_rejected", {}, "Nhà cung cấp 'piston' từ chối quyền truy cập (khoá API thiếu hoặc không đúng).");
    kiem("502 rejected → dùng nguyên câu tiếng Việt của backend", e.code === "run_provider_rejected" && /từ chối quyền truy cập/.test(e.message));
    e = E(504, "run_provider_timeout", { provider: "wandbox" });
    kiem("504 timeout → trả lời quá chậm", e.code === "run_provider_timeout" && /quá chậm/.test(e.message));
    e = E(503, "run_disabled", {});
    kiem("503 run_disabled → chạy mã trên máy chủ đang tắt", /đang bị tắt/.test(e.message));
    e = E(503, "run_provider_disabled", {}, "Chưa cấu hình địa chỉ Judge0 (RUN_JUDGE0_URL)");
    kiem("503 provider_disabled → lý do của backend", /Judge0/.test(e.message));
    e = E(400, "run_bad_flag", { flag: "-fplugin=x" }, "Cờ không hợp lệ");
    kiem("400 run_bad_flag → nêu cờ", /-fplugin=x/.test(e.message) && e.code === "run_bad_flag" && e.data.flag === "-fplugin=x");
    e = E(400, "run_multifile_unsupported", {});
    kiem("400 multifile → gợi ý chọn nơi chạy khác", /một tệp/.test(e.message));
    e = E(400, "run_bad_file", {}, "Tên tệp 'a b.cpp' không hợp lệ");
    kiem("400 run_bad_file → thông báo của backend", /a b\.cpp/.test(e.message));
    e = R.friendlyError(422, { detail: [{ msg: "String should have at most 128 characters", loc: ["body"] }] });
    kiem("422 sai schema → thông báo + lý do đầu tiên", /không hợp lệ/.test(e.message) && /128/.test(e.message) && e.code === "http_422");
    e = R.friendlyError(404, null);
    kiem("404 → backend chưa có /run", /\/run/.test(e.message) && e.code === "run_not_found");
    e = R.friendlyError(0, null);
    kiem("status 0 → mất mạng", e.code === "network" && /mạng/.test(e.message));
    e = R.friendlyError(500, "<html>lỗi</html>");
    kiem("500 với thân không phải JSON → không ném, có mã http_500", e.code === "http_500" && /HTTP 500/.test(e.message));
  }

  /* ---------------------------------------------------------------- chuẩn hoá kết quả */
  nhom("runner · chuẩn hoá phản hồi (server, Piston)");
  {
    const n = R.normalizeServerResult(okBody({ run: { ran: true, ok: true, stdout: "a\r\nb\r\n", stderr: "", code: 0, ms: 3.6 } }));
    kiem("normalizeServerResult · điền đủ trường stage, CRLF → LF, ms làm tròn", n.ok && n.run.stdout === "a\nb\n" && n.run.ms === 4 && n.run.signal === null && n.run.timedOut === false && n.run.truncated === false && n.compile.ran && n.error === null && Array.isArray(n.warnings));
    const bad = (() => { try { R.normalizeServerResult({ nope: 1 }); return null; } catch (e) { return e; } })();
    kiem("normalizeServerResult · dữ liệu lạ → Error bad_response tiếng Việt", bad && bad.code === "bad_response" && /không đúng định dạng/.test(bad.message));
    const n2 = R.normalizeServerResult({ ok: false, provider: "local", language: "python", run: { ran: true, ok: false, code: 1, stderr: "x" } });
    kiem("normalizeServerResult · ok:false thiếu error → bù runtime_error; compile thiếu → null", n2.error && n2.error.code === "runtime_error" && n2.compile === null && n2.run.stderr === "x");
    kiem("normalizeServerResult · ok:true thì error luôn null", R.normalizeServerResult(okBody({ error: { code: "x", message: "y" } })).error === null);

    const piston = (over) => R.normalizePiston(Object.assign({ language: "c++", version: "10.2.0", compile: { stdout: "", stderr: "", code: 0, signal: null, output: "" }, run: { stdout: "42\n", stderr: "", code: 0, signal: null, output: "42\n" } }, over || {}), { language: "cpp", runTimeoutMs: 5000, compileTimeoutMs: 15000, elapsedMs: 800 });
    let p = piston();
    kiem("normalizePiston · thành công: ok, provider piston, language cpp, version, compile.ran", p.ok && p.provider === "piston" && p.language === "cpp" && p.version === "10.2.0" && p.compile.ran && p.compile.ok && p.run.stdout === "42\n" && p.run.ms === 800 && p.error === null);
    p = piston({ compile: { stdout: "", stderr: "main.cpp:1:1: error: x", code: 1, signal: null } });
    kiem("normalizePiston · biên dịch hỏng → compile_error, run chưa chạy", !p.ok && p.error.code === "compile_error" && p.run.ran === false && p.compile.ok === false && p.compile.stderr.indexOf("error: x") > 0);
    p = piston({ run: { stdout: "", stderr: "", code: null, signal: "SIGKILL", status: "TO", wall_time: 5001 } });
    kiem("normalizePiston · status TO → run_timeout, ms = wall_time", !p.ok && p.error.code === "run_timeout" && p.run.timedOut && p.run.ms === 5001 && p.run.signal === "SIGKILL");
    p = R.normalizePiston({ language: "python", version: "3.12", run: { stdout: "", stderr: "", code: null, signal: "SIGKILL" } }, { language: "python", runTimeoutMs: 1000, elapsedMs: 990 });
    kiem("normalizePiston · máy cũ không có status: SIGKILL sau ≥95% giờ cho phép coi là quá giờ; python không có compile", p.error.code === "run_timeout" && p.compile === null);
    p = R.normalizePiston({ language: "python", run: { stdout: "", stderr: "", code: null, signal: "SIGKILL" } }, { language: "python", runTimeoutMs: 5000, elapsedMs: 300 });
    kiem("normalizePiston · SIGKILL sớm (không phải quá giờ) → runtime_error", p.error.code === "runtime_error" && !p.run.timedOut);
    p = piston({ run: { stdout: "x", stderr: "", code: 0, signal: null, status: "OL" } });
    kiem("normalizePiston · status OL (vượt giới hạn in) → truncated và ok:false", p.run.truncated === true && p.ok === false);
    p = piston({ run: { stdout: "boom", stderr: "Traceback", code: 3, signal: null } });
    kiem("normalizePiston · thoát mã 3 → runtime_error, giữ mã", !p.ok && p.error.code === "runtime_error" && p.run.code === 3);
    const bp = (() => { try { R.normalizePiston({ message: "x" }, {}); return null; } catch (e) { return e; } })();
    kiem("normalizePiston · dữ liệu lạ → Error bad_response", bp && bp.code === "bad_response");
    const big = R.normalizePiston({ language: "python", run: { stdout: "é".repeat(700000), stderr: "", code: 0 } }, { language: "python" });
    kiem("normalizePiston · stdout > 1 MiB bị cắt và truncated:true (ok vẫn true: thoát 0)", big.run.truncated && big.ok && big.run.stdout.length === 524288, big.run.stdout.length);
  }

  /* ---------------------------------------------------------------- targets */
  nhom("runner · targets + loadServerProviders");
  {
    const prov = [
      { id: "piston", label: "Piston", kind: "remote", available: true, reason: "", languages: ["c", "cpp", "java", "python"], multiFile: true, multiFileLanguages: ["cpp", "java"], needsSession: false },
      { id: "judge0", label: "Judge0", kind: "remote", available: false, reason: "Chưa cấu hình Judge0 (RUN_JUDGE0_URL)", languages: ["c", "cpp"], multiFile: false, multiFileLanguages: [], needsSession: false },
      { id: "local", label: "Máy chủ (cục bộ)", kind: "local", available: true, reason: "", languages: ["cpp", "python"], multiFile: true, multiFileLanguages: ["cpp"], needsSession: true }];
    const ids = (t) => t.map((x) => x.id + (x.available ? "+" : "-")).join(" ");
    let t = R.targets({ language: "cpp", languages: ["cpp"], server: prov, pistonUrl: "" });
    kiem("targets · cpp: browser, server:*, piston-custom theo đúng thứ tự", ids(t) === "browser+ server:piston+ server:judge0- server:local+ piston-custom-", ids(t));
    kiem("targets · server không dùng được: reason là lý do của backend; có nhãn tiếng Việt", t[2].reason === "Chưa cấu hình Judge0 (RUN_JUDGE0_URL)" && t[1].label === "Máy chủ · Piston" && t[0].label === "Trong trình duyệt" && t[3].needsSession === true);
    kiem("targets · piston-custom chưa có URL → reason \"Chưa đặt URL Piston ở Cài đặt\"", t[4].reason === "Chưa đặt URL Piston ở Cài đặt" && t[4].available === false);
    t = R.targets({ language: "java", server: prov, pistonUrl: "https://p.example/api/v2" });
    kiem("targets · java: không có browser; judge0/local không hỗ trợ java (kèm reason); piston-custom có URL → available", ids(t) === "server:piston+ server:judge0- server:local- piston-custom+" && /Java/.test(t[2].reason) && t[3].reason === "", ids(t));
    t = R.targets({ language: "python", server: prov, pistonUrl: "  " });
    kiem("targets · python: có browser", t[0].id === "browser" && t[0].available === true && t[t.length - 1].available === false);
    kiem("targets · sql/html: không browser, không piston", ids(R.targets({ language: "sql", server: [], pistonUrl: "https://x" })) === "piston-custom-" && /Piston không chạy được/.test(R.targets({ language: "sql", server: [], pistonUrl: "https://x" })[0].reason));
    kiem("targets · chấp nhận bí danh \"c++\" và tham số languages", R.targets({ languages: ["c++"], server: [] })[0].id === "browser");
    kiem("targets · server không phải mảng / phần tử rác bị bỏ qua", ids(R.targets({ language: "cpp", server: [null, 5, { label: "x" }] })) === "browser+ piston-custom-");

    const ff = fakeFetch(() => resp(200, { providers: prov, default: "piston" }));
    const got = await R.loadServerProviders("/api/v1/", { fetch: ff });
    kiem("loadServerProviders · GET {apiBase}/run/providers → mảng providers (+ defaultId)", Array.isArray(got) && got.length === 3 && got.defaultId === "piston" && ff.calls[0].url === "/api/v1/run/providers" && (ff.calls[0].init.method || "GET") === "GET", JSON.stringify(ff.calls));
    kiem("loadServerProviders · apiBase rỗng → /run/providers", (await R.loadServerProviders("", { fetch: (ff.calls.length = 0, ff) })) && ff.calls[0].url === "/run/providers");
    const netFail = await R.loadServerProviders("/x", { fetch: () => Promise.reject(new TypeError("Failed to fetch")) });
    kiem("loadServerProviders · lỗi mạng → mảng RỖNG, không ném", Array.isArray(netFail) && netFail.length === 0);
    kiem("loadServerProviders · HTTP 500 / JSON hỏng / không có fetch → mảng rỗng", (await R.loadServerProviders("/x", { fetch: () => resp(500, "no") })).length === 0 && (await R.loadServerProviders("/x", { fetch: () => ({ ok: true, json: () => Promise.reject(new Error("bad json")) }) })).length === 0 && (await R.loadServerProviders("/x", { fetch: 5 })).length === 0);
    kiem("loadServerProviders · bỏ phần tử không có id", (await R.loadServerProviders("/x", { fetch: () => resp(200, { providers: [{ id: "a" }, { label: "no id" }, null] }) })).length === 1);
  }

  /* ================================================================ server:<id> */
  nhom("runner · server:<id> (fetch giả)");
  {
    const files = [F("main.cpp", "#include \"util.h\"\nint main(){return add(1,2);}"), F("util.h", "int add(int,int);"), F("util.cpp", "int add(int a,int b){return a+b;}")];
    const ff = fakeFetch((url, init) => resp(200, okBody({ provider: "local", version: "g++ 14" })));
    const h = R.run(reqOf({ target: "server:local", files, stdin: "5 6", args: ["a b", "c"], compileArgs: ["-Wall", "-std=c++20"], std: "c++17", opt: "O3", runTimeoutMs: 2500, compileTimeoutMs: 9000 }),
      { apiBase: "/api/v1", fetch: ff, adminKey: "khoa-thu", adminSession: "phien-1" });
    kiem("run trả {promise, cancel}", h && typeof h.cancel === "function" && h.promise && typeof h.promise.then === "function");
    const r = await h.promise, c = ff.calls[0], body = JSON.parse(c.init.body);
    kiem("POST {apiBase}/run với JSON, Content-Type và header quản trị", c.url === "/api/v1/run" && c.init.method === "POST" && c.init.headers["Content-Type"] === "application/json" && c.init.headers["X-Admin-Key"] === "khoa-thu" && c.init.headers["X-Admin-Session"] === "phien-1", JSON.stringify(c));
    kiem("thân gửi đúng các trường của req (provider=id, files{name,content}, mainFile, stdin, args, compileArgs lọc, timeouts)", bang(Object.keys(body).sort(), ["args", "compileArgs", "compileTimeoutMs", "files", "language", "mainFile", "provider", "runTimeoutMs", "stdin"]) && body.provider === "local" && body.language === "cpp" && body.mainFile === "main.cpp" && body.stdin === "5 6" && bang(body.args, ["a b", "c"]) && bang(body.compileArgs, ["-O3", "-Wall", "-std=c++20"]) && body.runTimeoutMs === 2500 && body.compileTimeoutMs === 9000 && body.files.length === 3 && bang(Object.keys(body.files[0]), ["name", "content"]), JSON.stringify(body).slice(0, 300));
    kiem("kết quả chuẩn: ok, provider, target, diagnostics là mảng, warnings", r.ok && r.provider === "local" && r.target === "server:local" && r.version === "g++ 14" && Array.isArray(r.diagnostics) && Array.isArray(r.warnings) && r.run.stdout === "42\n" && r.compile && r.compile.ok);

    /* không gửi header quản trị khi không có; không gửi timeouts khi req không có; compileArgs = std + opt mặc định */
    const ff2 = fakeFetch(() => resp(200, okBody()));
    await R.run(reqOf({ files: [F("main.cpp", "int main(){}")] }), { apiBase: "", fetch: ff2 }).promise;
    const c2 = ff2.calls[0], b2 = JSON.parse(c2.init.body);
    kiem("apiBase rỗng → /run; không header quản trị; không timeouts; compileArgs mặc định -std/-O", c2.url === "/run" && !("X-Admin-Key" in c2.init.headers) && !("X-Admin-Session" in c2.init.headers) && !("runTimeoutMs" in b2) && bang(b2.compileArgs, ["-std=c++17", "-O2"]), JSON.stringify([c2.url, b2]));
    const ff3 = fakeFetch(() => resp(200, okBody({ language: "python", compile: null })));
    await R.run(reqOf({ language: "python", files: [F("main.py", "print(1)")], mainFile: "main.py", compileArgs: ["-Wall"], std: "c++17" }), { fetch: ff3 }).promise;
    kiem("ngôn ngữ không phải C/C++: compileArgs gửi đi rỗng", bang(JSON.parse(ff3.calls[0].init.body).compileArgs, []));
    const ff4 = fakeFetch(() => resp(200, okBody()));
    const w4 = (await R.run(reqOf({ compileArgs: ["-fplugin=evil.so", "-Wall"] }), { fetch: ff4 }).promise).warnings;
    kiem("cờ bị backend từ chối được lọc TRƯỚC khi gửi và báo trong warnings", !/fplugin/.test(ff4.calls[0].init.body) && w4.some((w) => /-fplugin=evil\.so/.test(w) && /bị bỏ qua/.test(w)), JSON.stringify(w4));

    /* chẩn đoán lấy từ stderr biên dịch */
    const ffc = fakeFetch(() => resp(200, okBody({ ok: false, error: { code: "compile_error", message: "Biên dịch thất bại" },
      compile: { ran: true, ok: false, stdout: "", stderr: "main.cpp: In function 'int main()':\nmain.cpp:4:13: error: invalid conversion from 'const char*' to 'int' [-fpermissive]\n    4 |     int x = \"abc\";\n      |             ^~~~~\nsrc/util.cpp:2:1: warning: unused variable 'q' [-Wunused-variable]\n", code: 1, signal: null, ms: 80, timedOut: false, truncated: false },
      run: { ran: false, ok: false, stdout: "", stderr: "", code: null, signal: null, ms: 0, timedOut: false, truncated: false } })));
    const rc = await R.run(reqOf({ files: [F("main.cpp", "x"), F("src/util.cpp", "y")] }), { fetch: ffc }).promise;
    kiem("kết quả biên dịch lỗi: ok:false, error compile_error, diagnostics từ stderr biên dịch (đúng tệp/dòng/cột)", !rc.ok && rc.error.code === "compile_error" && rc.diagnostics.length === 2 && rc.diagnostics[0].file === "main.cpp" && rc.diagnostics[0].line === 4 && rc.diagnostics[0].col === 13 && rc.diagnostics[0].severity === "error" && rc.diagnostics[1].file === "src/util.cpp" && rc.diagnostics[1].severity === "warning", JSON.stringify(rc.diagnostics));

    /* lỗi hạ tầng */
    let e = await rejected(R.run(reqOf(), { fetch: fakeFetch(() => resp(429, { status_code: 429, message: "Quá nhanh", data: { code: "run_rate_limited", retryAfter: 9 } }, { "Retry-After": "9" })) }).promise);
    kiem("429 → reject Error .code run_rate_limited, .retryAfter 9, \"thử lại sau 9 giây\"", e instanceof Error && e.code === "run_rate_limited" && e.retryAfter === 9 && /thử lại sau 9 giây/.test(e.message), e && e.message);
    e = await rejected(R.run(reqOf(), { fetch: fakeFetch(() => resp(429, { message: "x", data: { code: "run_rate_limited" } }, { "Retry-After": "4" })) }).promise);
    kiem("429 chỉ có header Retry-After → vẫn lấy 4 giây", e && e.retryAfter === 4 && /4 giây/.test(e.message), e && e.message);
    e = await rejected(R.run(reqOf(), { fetch: fakeFetch(() => resp(502, { status_code: 502, message: "Nhà cung cấp 'piston' hiện không phản hồi", data: { code: "run_provider_unavailable", provider: "piston" } })) }).promise);
    kiem("502 → run_provider_unavailable, nói tên nơi chạy", e && e.code === "run_provider_unavailable" && e.status === 502 && /piston/.test(e.message), e && e.message);
    e = await rejected(R.run(reqOf(), { fetch: fakeFetch(() => resp(504, { status_code: 504, message: "chậm", data: { code: "run_provider_timeout", provider: "piston" } })) }).promise);
    kiem("504 → run_provider_timeout, \"quá chậm\"", e && e.code === "run_provider_timeout" && /quá chậm/.test(e.message));
    e = await rejected(R.run(reqOf({ target: "server:local" }), { fetch: fakeFetch(() => resp(403, { status_code: 403, message: "Cần quyền quản trị", data: { code: "admin_required" } })) }).promise);
    kiem("403 admin_required → \"Cần khoá quản trị để dùng máy chủ cục bộ\"", e && e.code === "admin_required" && /Cần khoá quản trị để dùng máy chủ cục bộ/.test(e.message));
    e = await rejected(R.run(reqOf(), { fetch: () => Promise.reject(new TypeError("Failed to fetch")) }).promise);
    kiem("lỗi mạng (fetch ném TypeError) → Error code network, thông báo tiếng Việt", e && e.code === "network" && /Không kết nối được máy chủ/.test(e.message), e && e.message);
    e = await rejected(R.run(reqOf(), { fetch: fakeFetch(() => resp(200, "<html>proxy</html>")) }).promise);
    kiem("200 nhưng không phải JSON → bad_response", e && e.code === "bad_response");
    e = await rejected(R.run(reqOf(), { fetch: fakeFetch(() => resp(400, { status_code: 400, message: "Cờ", data: { code: "run_bad_flag", flag: "-x" } })) }).promise);
    kiem("400 run_bad_flag → giữ data.code", e && e.code === "run_bad_flag" && /-x/.test(e.message));

    /* huỷ */
    let aborted = false;
    const hang = (url, init) => new Promise((_, rej) => { init.signal && init.signal.addEventListener("abort", () => { aborted = true; const er = new Error("The operation was aborted"); er.name = "AbortError"; rej(er); }); });
    const hc = R.run(reqOf(), { fetch: hang });
    setTimeout(() => hc.cancel(), 20);
    e = await rejected(hc.promise);
    kiem("cancel() giữa chừng → reject code \"cancelled\" và fetch bị abort", e && e.code === "cancelled" && aborted, e && e.code + " aborted=" + aborted);
    const hd = R.run(reqOf(), { fetch: fakeFetch(() => resp(200, okBody())) });
    const done = await hd.promise; hd.cancel();
    kiem("cancel() sau khi xong là vô hại; kết quả đã nhận vẫn dùng được", done.ok === true);
    const he = R.run(reqOf(), { fetch: hang }); R.cancel();
    e = await rejected(he.promise);
    kiem("CS.runner.cancel() huỷ lần chạy gần nhất", e && e.code === "cancelled");
  }

  /* ================================================================ piston-custom */
  nhom("runner · piston-custom (trình duyệt gọi thẳng Piston)");
  {
    const pBody = { language: "c++", version: "10.2.0", compile: { stdout: "", stderr: "", code: 0, signal: null, output: "" }, run: { stdout: "42\n", stderr: "", code: 0, signal: null, output: "42\n" } };
    const ff = fakeFetch(() => resp(200, pBody));
    const files = [F("util.cpp", "u"), F("main.cpp", "m"), F("include/util.h", "h")];
    const r = await R.run(reqOf({ target: "piston-custom", files, mainFile: "main.cpp", stdin: "7", args: ["x"], compileArgs: ["-O2"], runTimeoutMs: 3000, compileTimeoutMs: 8000 }), { fetch: ff, pistonUrl: "https://piston.local:2000/api/v2/" }).promise;
    const c = ff.calls[0], b = JSON.parse(c.init.body);
    kiem("POST {pistonUrl}/execute (bỏ dấu / cuối), JSON", c.url === "https://piston.local:2000/api/v2/execute" && c.init.method === "POST" && c.init.headers["Content-Type"] === "application/json", c.url);
    kiem("thân Piston: language c++, version *, tệp CHÍNH ĐỨNG ĐẦU, stdin, args, compile_timeout, run_timeout", b.language === "c++" && b.version === "*" && b.files[0].name === "main.cpp" && b.files.length === 3 && b.files[1].name === "util.cpp" && b.stdin === "7" && bang(b.args, ["x"]) && b.run_timeout === 3000 && b.compile_timeout === 8000, JSON.stringify(b));
    kiem("không gửi header quản trị cho Piston của người dùng", !("X-Admin-Key" in c.init.headers));
    kiem("kết quả chuẩn: provider piston, target piston-custom, version, ok", r.ok && r.provider === "piston" && r.target === "piston-custom" && r.version === "10.2.0" && r.language === "cpp" && r.run.stdout === "42\n" && r.compile.ran);
    kiem("cpp: cờ biên dịch bị Piston bỏ qua → warnings báo rõ", r.warnings.some((w) => /Piston không nhận cờ biên dịch/.test(w)), JSON.stringify(r.warnings));

    const ffu = fakeFetch(() => resp(200, pBody));
    await R.run(reqOf({ target: "piston-custom" }), { fetch: ffu, pistonUrl: "http://x:2000/api/v2/execute" }).promise;
    kiem("pistonUrl đã có /execute thì không nhân đôi", ffu.calls[0].url === "http://x:2000/api/v2/execute", ffu.calls[0].url);

    const ffp = fakeFetch(() => resp(200, { language: "python", version: "3.12.0", run: { stdout: "hi\n", stderr: "", code: 0, signal: null, output: "hi\n" } }));
    const rp = await R.run(reqOf({ target: "piston-custom", language: "python", files: [F("main.py", "print('hi')")], mainFile: "main.py", compileArgs: [], std: "", opt: "" }), { fetch: ffp, pistonUrl: "http://x/api/v2" }).promise;
    kiem("python qua Piston: compile null, không cảnh báo cờ", rp.ok && rp.compile === null && rp.language === "python" && rp.warnings.length === 0 && JSON.parse(ffp.calls[0].init.body).language === "python");

    const ffe = fakeFetch(() => resp(200, { language: "c++", version: "10.2.0", compile: { stdout: "", stderr: "main.cpp:3:5: error: expected ';' before '}' token\n", code: 1, signal: null, output: "" }, run: { stdout: "", stderr: "", code: null, signal: null, output: "" } }));
    const re = await R.run(reqOf({ target: "piston-custom", files: [F("main.cpp", "x")] }), { fetch: ffe, pistonUrl: "http://x/api/v2" }).promise;
    kiem("Piston: lỗi biên dịch → ok:false compile_error + chẩn đoán", !re.ok && re.error.code === "compile_error" && re.diagnostics[0].line === 3 && re.diagnostics[0].col === 5 && re.run.ran === false, JSON.stringify(re.diagnostics));

    let e = await rejected(R.run(reqOf({ target: "piston-custom" }), { fetch: ff }).promise);
    kiem("chưa đặt pistonUrl → Error no_piston_url \"Chưa đặt URL Piston ở Cài đặt\"", e && e.code === "no_piston_url" && /Chưa đặt URL Piston ở Cài đặt/.test(e.message));
    e = await rejected(R.run(reqOf({ target: "piston-custom", language: "sql", files: [F("a.sql", "select 1")], mainFile: "a.sql" }), { fetch: ff, pistonUrl: "http://x" }).promise);
    kiem("ngôn ngữ Piston không có (sql) → run_language_unsupported", e && e.code === "run_language_unsupported");
    e = await rejected(R.run(reqOf({ target: "piston-custom" }), { fetch: () => Promise.reject(new TypeError("Failed to fetch")), pistonUrl: "http://x/api/v2" }).promise);
    kiem("lỗi mạng tới Piston → code network, nhắc CORS", e && e.code === "network" && /CORS/.test(e.message) && /Piston/.test(e.message), e && e.message);
    e = await rejected(R.run(reqOf({ target: "piston-custom" }), { fetch: fakeFetch(() => resp(400, { message: "c++ runtime is unknown" })), pistonUrl: "http://x/api/v2" }).promise);
    kiem("Piston 400 {message} → run_provider_rejected, kèm câu của Piston", e && e.code === "run_provider_rejected" && /c\+\+ runtime is unknown/.test(e.message));
    e = await rejected(R.run(reqOf({ target: "piston-custom" }), { fetch: fakeFetch(() => resp(401, { message: "Requires authorization" })), pistonUrl: "http://x/api/v2" }).promise);
    kiem("Piston 401 → từ chối quyền truy cập (đòi khoá)", e && e.code === "run_provider_rejected" && /khoá API/.test(e.message));
    e = await rejected(R.run(reqOf({ target: "piston-custom" }), { fetch: fakeFetch(() => resp(429, { message: "slow down" })), pistonUrl: "http://x/api/v2" }).promise);
    kiem("Piston 429 → run_rate_limited", e && e.code === "run_rate_limited");
    e = await rejected(R.run(reqOf({ target: "piston-custom" }), { fetch: fakeFetch(() => resp(503, "")), pistonUrl: "http://x/api/v2" }).promise);
    kiem("Piston 503 → run_provider_unavailable", e && e.code === "run_provider_unavailable");
    let ab = false;
    const hang = (url, init) => new Promise((_, rej) => { init.signal.addEventListener("abort", () => { ab = true; rej(new Error("aborted")); }); });
    const hc = R.run(reqOf({ target: "piston-custom" }), { fetch: hang, pistonUrl: "http://x/api/v2" });
    setTimeout(() => hc.cancel(), 10);
    e = await rejected(hc.promise);
    kiem("huỷ lúc chờ Piston → cancelled + abort", e && e.code === "cancelled" && ab);
  }

  /* ================================================================ điều phối + bộ chạy trình duyệt (giả) */
  nhom("runner · điều phối (target browser với bộ chạy giả)");
  {
    let e = await rejected(R.run(reqOf({ target: "browser", language: "cpp" }), {}).promise);
    kiem("browser mà chưa có bộ chạy → Error no_executor, nói rõ", e && e.code === "no_executor" && /C\+\+/.test(e.message) && /nơi chạy khác/.test(e.message), e && e.message);
    kiem("hasExecutor · chưa đăng ký thì false", R.hasExecutor("cpp") === false);

    let seen = null;
    R.registerExecutor("cpp", async (req, ctx) => {
      seen = req;
      ctx.onProgress({ type: "download", label: "Clang", loaded: 5, total: 10, pct: 50 });
      ctx.onProgress({ type: "stdout", text: "xin chao\n" });
      return { compile: { ran: true, ok: true, stdout: "", stderr: "main.cpp:2:3: warning: unused [-Wunused]\n", code: 0, ms: 120 },
        run: { ran: true, ok: true, stdout: "xin chao\n", stderr: "", code: 0, ms: 4 }, version: "Clang 22", warnings: ["lưu ý riêng của bộ chạy"] };
    });
    const events = [];
    const r = await R.run(reqOf({ target: "browser", files: [F("src/main.cpp", "int main(){}"), F("a.h", "")], mainFile: "", compileArgs: ["-Wall", "-fplugin=x"], std: "c++20", opt: "O1", stdin: "in", args: ["1"] }), { onProgress: (x) => events.push(x) }).promise;
    kiem("executor nhận yêu cầu đã chuẩn bị: tệp chính suy ra, cờ đã lọc (std/opt + -Wall), stdin/args, timeouts mặc định", seen.mainFile === "src/main.cpp" && bang(seen.compileArgs, ["-std=c++20", "-O1", "-Wall"]) && seen.stdin === "in" && bang(seen.args, ["1"]) && seen.runTimeoutMs === 5000 && seen.language === "cpp" && seen.files[0].name === "src/main.cpp", JSON.stringify(seen).slice(0, 300));
    kiem("sự kiện tiến độ của bộ chạy được chuyển nguyên cho onProgress", events.length === 2 && events[0].type === "download" && events[0].pct === 50 && events[1].type === "stdout" && events[1].text === "xin chao\n");
    kiem("kết quả chuẩn hoá: provider \"browser\", target, version, ok suy ra từ stage, diagnostics từ stderr biên dịch (warning)", r.ok && r.provider === "browser" && r.target === "browser" && r.version === "Clang 22" && r.compile.ok && r.run.stdout === "xin chao\n" && r.diagnostics.length === 1 && r.diagnostics[0].severity === "warning" && r.diagnostics[0].file === "src/main.cpp", JSON.stringify(r.diagnostics));
    kiem("warnings gộp: của bộ chạy + cờ bị bỏ qua (không lặp)", r.warnings.length === 2 && r.warnings.some((w) => /lưu ý riêng/.test(w)) && r.warnings.some((w) => /-fplugin=x/.test(w)), JSON.stringify(r.warnings));

    R.registerExecutor("cpp", async () => ({ compile: { ran: true, ok: false, stderr: "main.cpp:1:1: error: boom\n", code: 1 }, run: null, version: "x" }));
    const r2 = await R.run(reqOf({ target: "browser" }), {}).promise;
    kiem("executor báo biên dịch hỏng (run:null) → ok:false compile_error, run chưa chạy", !r2.ok && r2.error.code === "compile_error" && r2.run.ran === false && r2.diagnostics[0].message === "boom");
    R.registerExecutor("cpp", async () => ({ compile: null, run: { ran: true, ok: false, stdout: "", stderr: "", code: null, signal: "SIGABRT", ms: 5000, timedOut: true }, version: "x" }));
    const r3 = await R.run(reqOf({ target: "browser" }), {}).promise;
    kiem("executor báo quá giờ → run_timeout", !r3.ok && r3.error.code === "run_timeout" && r3.run.timedOut && r3.run.signal === "SIGABRT");
    R.registerExecutor("cpp", async () => ({ compile: null, run: { ran: true, ok: true, stdout: "", code: 0 }, diagnostics: [{ file: "a.js", line: 2, col: 3, severity: "error", message: "riêng" }] }));
    const r4 = await R.run(reqOf({ target: "browser" }), {}).promise;
    kiem("diagnostics do bộ chạy tự cấp được giữ", r4.diagnostics.length === 1 && r4.diagnostics[0].message === "riêng" && r4.diagnostics[0].line === 2);

    /* confirmDownload: từ chối → bộ chạy ném download_declined, run() reject đúng mã */
    let asked = null;
    R.registerExecutor("cpp", async (req, ctx) => {
      const ok = await ctx.confirmDownload({ what: "Trình biên dịch C/C++ (Clang→WebAssembly)", size: "≈ 25 MB", note: "ghi chú" });
      if (!ok) { const er = new Error("Bạn đã hoãn tải"); er.code = "download_declined"; throw er; }
      return { compile: null, run: { ran: true, ok: true, code: 0 } };
    });
    e = await rejected(R.run(reqOf({ target: "browser" }), { confirmDownload: (info) => { asked = info; return Promise.resolve(false); } }).promise);
    kiem("confirmDownload nhận {what, size, note}; trả false → reject code download_declined", asked && asked.what === "Trình biên dịch C/C++ (Clang→WebAssembly)" && asked.size === "≈ 25 MB" && asked.note === "ghi chú" && e && e.code === "download_declined");
    const r5 = await R.run(reqOf({ target: "browser" }), { confirmDownload: () => Promise.resolve(true) }).promise;
    kiem("confirmDownload trả true → chạy tiếp bình thường", r5.ok === true);
    const r6 = await R.run(reqOf({ target: "browser" }), {}).promise;
    kiem("không truyền confirmDownload → coi như đồng ý (giao diện luôn truyền)", r6.ok === true);

    /* huỷ: hook được gọi */
    let hooked = false;
    R.registerExecutor("cpp", (req, ctx) => new Promise(() => { ctx.onCancel(() => { hooked = true; }); }));
    const hc = R.run(reqOf({ target: "browser" }), {});
    setTimeout(() => hc.cancel(), 15);
    e = await rejected(hc.promise);
    kiem("cancel() gọi hook ctx.onCancel của bộ chạy và reject \"cancelled\"", hooked && e && e.code === "cancelled");
    R.registerExecutor("cpp", async () => { throw Object.assign(new Error("Không nạp được trình biên dịch — kiểm tra mạng"), { code: "download_failed" }); });
    e = await rejected(R.run(reqOf({ target: "browser" }), {}).promise);
    kiem("executor ném lỗi hạ tầng (mạng) → reject giữ nguyên .code", e && e.code === "download_failed" && /mạng/.test(e.message));
    R.registerExecutor("cpp", async () => { throw new TypeError("x is not a function"); });
    e = await rejected(R.run(reqOf({ target: "browser" }), {}).promise);
    kiem("executor ném lỗi thường → vẫn reject (không treo)", e instanceof Error && /x is not a function/.test(e.message));

    /* yêu cầu hỏng */
    e = await rejected(R.run(null, {}).promise);
    kiem("req null → bad_request", e && e.code === "bad_request");
    e = await rejected(R.run(reqOf({ files: [] }), {}).promise);
    kiem("không có tệp → bad_request \"Không có tệp nào để chạy\"", e && e.code === "bad_request" && /Không có tệp/.test(e.message));
    e = await rejected(R.run(reqOf({ target: "ssh:evil" }), {}).promise);
    kiem("target lạ → bad_target", e && e.code === "bad_target");
    e = await rejected(R.run(reqOf({ target: "" }), {}).promise);
    kiem("thiếu target → bad_request", e && e.code === "bad_request");
    e = await rejected(R.run(reqOf({ language: "" }), {}).promise);
    kiem("thiếu language → bad_request", e && e.code === "bad_request");
    e = await rejected(R.run(reqOf({ target: "server:" }), { fetch: fakeFetch(() => resp(200, okBody())) }).promise);
    kiem("server: không có id → bad_target", e && e.code === "bad_target");
    R.unregisterExecutor("cpp");                    // dọn: bộ chạy giả không để lại cho nhóm khác
    kiem("unregisterExecutor · gỡ bộ chạy giả", R.hasExecutor("cpp") === false);
  }

  /* ================================================================ chẩn đoán: mẫu stderr thật */
  nhom("runner · parseDiagnostics với mẫu stderr thật");
  {
    const lines = (...a) => a.join("\n");
    const show = (d) => d.map((x) => x.severity[0] + " " + x.file + ":" + x.line + ":" + x.col + " " + x.message).join(" | ");
    const P = (stderr, lang, files) => R.parseDiagnostics(stderr, lang, files);
    const names = (...n) => n.map((x) => ({ name: x }));

    /* ---------- g++ 14.0.1 (MinGW) ---------- */
    const GPP = lines("main.cpp: In function 'int main()':",
      "main.cpp:4:13: error: invalid conversion from 'const char*' to 'int' [-fpermissive]",
      "    4 |     int x = \"abc\";", "      |             ^~~~~", "      |             |", "      |             const char*",
      "main.cpp:5:5: error: 'undefined_fn' was not declared in this scope", "    5 |     undefined_fn(3);", "      |     ^~~~~~~~~~~~",
      "main.cpp:6:40: error: expected ';' before 'return'", "    6 |     std::cout << add(1, 2) << std::endl", "      |                                        ^", "      |                                        ;", "    7 |     return 0;", "      |     ~~~~~~                              ",
      "main.cpp:4:9: warning: unused variable 'x' [-Wunused-variable]", "    4 |     int x = \"abc\";", "      |         ^");
    let d = P(GPP, "cpp", names("main.cpp", "util.h"));
    kiem("g++ · 3 lỗi rồi 1 cảnh báo, ĐÚNG THỨ TỰ xuất hiện, có dòng/cột, bỏ 'In function' và caret", d.length === 4 && d[0].line === 4 && d[0].col === 13 && d[1].line === 5 && d[1].col === 5 && d[2].line === 6 && d[2].col === 40 && d[3].severity === "warning" && d.slice(0, 3).every((x) => x.severity === "error" && x.file === "main.cpp"), show(d));
    kiem("g++ · message giữ cờ [-fpermissive] / [-Wunused-variable]", /\[-fpermissive\]$/.test(d[0].message) && /\[-Wunused-variable\]$/.test(d[3].message));

    const GPP2 = lines("In file included from warn2.cpp:2:", "hdr.h: In function 'int bad(int)':",
      "hdr.h:2:29: warning: unused variable 'unused_h' [-Wunused-variable]", "    2 | inline int bad(int a) { int unused_h; return a; }", "      |                             ^~~~~~~~",
      "warn2.cpp: In function 'void g()':",
      "warn2.cpp:5:43: error: no matching function for call to 'std::vector<int>::push_back(int, int)'", "    5 | void g() { std::vector<int> v; v.push_back(1,2); }", "      |                                ~~~~~~~~~~~^~~~~",
      "In file included from C:/devtools/mingw/mingw64/include/c++/14.0.1/vector:66,", "                 from warn2.cpp:3:",
      "C:/devtools/mingw/mingw64/include/c++/14.0.1/bits/stl_vector.h:1283:7: note: candidate: 'void std::vector<_Tp, _Alloc>::push_back(const value_type&) [with _Tp = int]'", " 1283 |       push_back(const value_type& __x)", "      |       ^~~~~~~~~",
      "C:/devtools/mingw/mingw64/include/c++/14.0.1/bits/stl_vector.h:1283:7: note:   candidate expects 1 argument, 2 provided",
      "warn2.cpp:4:49: warning: control reaches end of non-void function [-Wreturn-type]");
    d = P(GPP2, "cpp", names("warn2.cpp", "hdr.h"));
    kiem("g++ · tệp tiêu đề CỦA DỰ ÁN giữ nguyên; ghi chú trong thư viện hệ thống (C:/devtools/…/stl_vector.h) bị bỏ khi biết danh sách tệp", d.length === 3 && d[0].file === "hdr.h" && d[0].severity === "warning" && d[1].file === "warn2.cpp" && d[1].severity === "error" && d[2].severity === "warning" && !d.some((x) => /stl_vector/.test(x.file)), show(d));
    kiem("g++ · không biết danh sách tệp thì giữ cả ghi chú ở tệp tuyệt đối kiểu Windows (ổ đĩa C:)", P(GPP2, "cpp").some((x) => x.file === "C:/devtools/mingw/mingw64/include/c++/14.0.1/bits/stl_vector.h" && x.line === 1283 && x.col === 7 && x.severity === "note"));
    d = P(lines("warn.cpp:2:10: fatal error: missing_header.h: No such file or directory", "    2 | #include \"missing_header.h\"", "      |          ^~~~~~~~~~~~~~~~~~", "compilation terminated."), "cpp", names("warn.cpp"));
    kiem("g++ · fatal error là lỗi (severity error) có vị trí", d.length === 1 && d[0].severity === "error" && d[0].line === 2 && d[0].col === 10 && /No such file/.test(d[0].message));
    d = P(lines("C:/devtools/mingw/mingw64/bin/../lib/gcc/x86_64-w64-mingw32/14.0.1/../../../../x86_64-w64-mingw32/bin/ld.exe: C:\\Users\\TRANPH~1\\AppData\\Local\\Temp\\ccyG9ehw.o:link.cpp:(.text+0x13): undefined reference to `missing(int)'", "collect2.exe: error: ld returned 1 exit status"), "cpp", names("link.cpp"));
    kiem("g++ · lỗi liên kết (ld.exe): file lấy từ \"x.o:link.cpp:(.text+0x13)\", bỏ dòng 'ld returned 1 exit status'", d.length === 1 && d[0].file === "link.cpp" && d[0].line === 0 && /undefined reference to `missing\(int\)'/.test(d[0].message) && /^\(liên kết\)/.test(d[0].message), show(d));

    /* ---------- clang (Clang-WASM, mẫu lấy từ chính bộ chạy) ---------- */
    const CLANG = lines("main.cpp:3:9: error: cannot initialize a variable of type 'int' with an lvalue of type 'const char[4]'", "    3 |     int x = \"abc\";", "      |         ^   ~~~~~",
      "src/util.cpp:5:19: error: expected ';' after expression", "    5 |     std::cout << 1", "      |                   ^", "      |                   ;",
      "main.cpp:2:34: warning: using the result of an assignment as a condition without parentheses [-Wparentheses]", "main.cpp:2:34: note: place parentheses around the assignment to silence this warning",
      "3 errors generated.");
    d = P(CLANG, "cpp", names("main.cpp", "src/util.cpp"));
    kiem("clang · lỗi/cảnh báo/ghi chú đúng thứ tự và tệp trong thư mục con; bỏ '3 errors generated.'", show(d) === "e main.cpp:3:9 cannot initialize a variable of type 'int' with an lvalue of type 'const char[4]' | e src/util.cpp:5:19 expected ';' after expression | w main.cpp:2:34 using the result of an assignment as a condition without parentheses [-Wparentheses] | n main.cpp:2:34 place parentheses around the assignment to silence this warning", show(d));
    d = P("wasm-ld: error: /tmp/main-62bf3f.o: undefined symbol: missing(int)\n", "cpp", names("main.cpp"));
    kiem("wasm-ld · lỗi liên kết không có vị trí, bỏ đường dẫn tệp tạm .o", d.length === 1 && d[0].file === "" && d[0].line === 0 && d[0].message === "(liên kết) undefined symbol: missing(int)", show(d));
    d = P("clang++: error: no such file or directory: 'x.cpp'\nclang++: error: no input files\n", "cpp");
    kiem("clang++: error: … (không vị trí) vẫn được ghi nhận", d.length === 2 && d[0].file === "" && d[0].severity === "error");

    /* ---------- javac 20 (Windows: dấu \ và CRLF) ---------- */
    const JAVAC = ["src\\app\\Main.java:8: error: ';' expected", "        int x = 3", "                 ^", "src\\app\\Main.java:9: error: cannot find symbol", "        undefined(x);", "        ^",
      "  symbol:   method undefined(int)", "  location: class Main", "src\\app\\util\\Calc.java:4: warning: [rawtypes] found raw type: List", "    List l;", "    ^", "  missing type arguments for generic class List<E>", "  where E is a type-variable:", "    E extends Object declared in interface List", "2 errors", "1 warning", ""].join("\r\n");
    d = P(JAVAC, "java", names("src/app/Main.java", "src/app/util/Calc.java"));
    kiem("javac · đường dẫn \\ chuẩn hoá về /, CRLF, cột lấy từ dòng dấu mũ (\"';' expected\" ở cột 18)", d.length === 3 && d[0].file === "src/app/Main.java" && d[0].line === 8 && d[0].col === 18 && d[0].message === "';' expected", show(d));
    kiem("javac · cannot find symbol kèm (symbol/location) gộp vào message; cảnh báo [rawtypes] ở tệp khác", /cannot find symbol \(symbol: method undefined\(int\); location: class Main\)/.test(d[1].message) && d[1].col === 9 && d[2].severity === "warning" && d[2].file === "src/app/util/Calc.java" && d[2].col === 5, show(d));
    kiem("javac · không lẫn dòng 'Note: …uses unchecked', '2 errors'", P("Note: W.java uses unchecked or unsafe operations.\nNote: Recompile with -Xlint:unchecked for details.\n", "java").length === 0);
    d = P("Exception in thread \"main\" java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 2\r\n\tat app.Calc.get(Calc.java:12)\r\n\tat java.base/java.util.ArrayList.get(ArrayList.java:427)\r\n\tat app.Main.main(Main.java:7)\r\n", "java", names("src/app/Main.java", "src/app/Calc.java"));
    kiem("java · ngoại lệ lúc chạy: lỗi ở frame trong cùng CỦA DỰ ÁN (Calc.java:12), lời gọi (Main.java:7) là ghi chú, bỏ frame JDK", d.length === 2 && d[0].file === "src/app/Calc.java" && d[0].line === 12 && d[0].severity === "error" && /ArrayIndexOutOfBounds/.test(d[0].message) && d[1].file === "src/app/Main.java" && d[1].line === 7 && d[1].severity === "note", show(d));
    kiem("java · 'Error: Could not find or load main class' cũng được báo", P("Error: Could not find or load main class Foo\nCaused by: java.lang.ClassNotFoundException: Foo\n", "java").length === 1);

    /* ---------- Python 3.12 (Windows) ---------- */
    const PYTB = ["start", "Traceback (most recent call last):", "  File \"C:\\Users\\x\\Temp\\cs\\py\\main.py\", line 3, in <module>", "    utils.boom(3)",
      "  File \"C:\\Users\\x\\Temp\\cs\\py\\utils.py\", line 2, in boom", "    return helper(n)", "           ^^^^^^^^^", "  File \"C:\\Users\\x\\Temp\\cs\\py\\utils.py\", line 5, in helper", "    return 10 / (n - 3)", "           ~~~^~~~~~~~~", "ZeroDivisionError: division by zero", ""].join("\r\n");
    const pyFiles = [{ name: "main.py", content: "import utils\nprint(\"start\")\nutils.boom(3)\n" }, { name: "utils.py", content: "def boom(n):\n    return helper(n)\n\ndef helper(n):\n    return 10 / (n - 3)\n" }];
    d = P(PYTB, "python", pyFiles);
    kiem("python · traceback: lỗi ở frame TRONG CÙNG của dự án (utils.py:5), cột tính cả thụt lề (12), rồi lời gọi (utils.py:2, main.py:3) là ghi chú", d.length === 3 && d[0].severity === "error" && d[0].file === "utils.py" && d[0].line === 5 && d[0].col === 12 && /^ZeroDivisionError: division by zero$/.test(d[0].message) && d[1].severity === "note" && d[1].file === "utils.py" && d[1].line === 2 && d[2].file === "main.py" && d[2].line === 3 && /trong <module>/.test(d[2].message), show(d));
    d = P(["  File \"C:\\Users\\x\\main.py\", line 1", "    x = (1 +", "        ^", "SyntaxError: '(' was never closed", ""].join("\r\n"), "python", names("main.py"));
    kiem("python · SyntaxError không có Traceback: cột lấy từ dòng dấu mũ (5)", d.length === 1 && d[0].line === 1 && d[0].col === 5 && d[0].message === "SyntaxError: '(' was never closed", show(d));
    d = P(lines("  File \"main.py\", line 2", "    print(1)", "    ^^^^^", "IndentationError: expected an indented block after 'if' statement on line 1"), "python", [{ name: "main.py", content: "if True:\nprint(1)\n" }]);
    kiem("python · IndentationError", d.length === 1 && d[0].line === 2 && d[0].col === 1 && /^IndentationError/.test(d[0].message), show(d));
    d = P(lines("Traceback (most recent call last):", "  File \"/work/main.py\", line 4, in <module>", "    foo()", "NameError: name 'foo' is not defined"), "python", names("main.py"));
    kiem("python · đường dẫn tuyệt đối Pyodide (/work/main.py) quy về main.py", d.length === 1 && d[0].file === "main.py" && d[0].line === 4);
    d = P(lines("Traceback (most recent call last):", "  File \"<string>\", line 1, in <module>", "ModuleNotFoundError: No module named 'nomod'"), "python", names("main.py"));
    kiem("python · lỗi chỉ ở <string> (không có tệp dự án) → báo thông điệp không vị trí", d.length === 1 && d[0].file === "" && d[0].line === 0 && /ModuleNotFoundError/.test(d[0].message), show(d));
    d = P(lines("Traceback (most recent call last):", "  File \"main.py\", line 2, in <module>", "    raise ValueError('a')", "ValueError: a", "", "During handling of the above exception, another exception occurred:", "", "Traceback (most recent call last):", "  File \"main.py\", line 4, in <module>", "    raise KeyError('b')", "KeyError: 'b'"), "python", names("main.py"));
    kiem("python · lỗi nối tiếp (During handling…): cả hai lỗi, đúng thứ tự", d.map((x) => x.line + ":" + x.message).join("|") === "2:ValueError: a|4:KeyError: 'b'", show(d));

    /* ---------- Node 24 ---------- */
    const NODE = lines("C:\\Users\\x\\Temp\\cs\\js\\lib\\util.js:2", "  return nope(n);", "  ^", "", "ReferenceError: nope is not defined",
      "    at exports.fail (C:\\Users\\x\\Temp\\cs\\js\\lib\\util.js:2:3)", "    at Object.<anonymous> (C:\\Users\\x\\Temp\\cs\\js\\main.js:3:3)", "    at Module._compile (node:internal/modules/cjs/loader:1760:14)",
      "    at node:internal/main/run_main_module:33:47", "", "Node.js v24.11.0");
    d = P(NODE, "javascript", names("main.js", "lib/util.js"));
    kiem("node · tiêu đề 'path:2' + dấu mũ → lỗi ở lib/util.js:2:3; lời gọi main.js:3:3 là ghi chú; bỏ frame node:internal", d.length === 2 && d[0].file === "lib/util.js" && d[0].line === 2 && d[0].col === 3 && d[0].message === "ReferenceError: nope is not defined" && d[1].file === "main.js" && d[1].line === 3 && d[1].severity === "note", show(d));
    d = P(lines("C:\\Users\\x\\syn.js:2", "let x = ;", "        ^", "", "SyntaxError: Unexpected token ';'", "    at wrapSafe (node:internal/modules/cjs/loader:1691:18)", "    at Module._compile (node:internal/modules/cjs/loader:1734:20)"), "javascript", names("syn.js"));
    kiem("node · SyntaxError: cột lấy từ dấu mũ (9)", d.length === 1 && d[0].line === 2 && d[0].col === 9 && /SyntaxError: Unexpected token/.test(d[0].message), show(d));
    d = P(lines("Error: kaboom", "    at f (/piston/jobs/abc/main.js:1:22)", "    at Object.<anonymous> (/piston/jobs/abc/main.js:2:1)", "    at node:internal/main/run_main_module:33:47"), "javascript", names("main.js"));
    kiem("node · không có tiêu đề (Piston): lỗi ở frame đầu của dự án, đường dẫn tuyệt đối quy về main.js", d.length === 2 && d[0].file === "main.js" && d[0].line === 1 && d[0].col === 22 && d[0].message === "Error: kaboom" && d[1].line === 2, show(d));
    d = P(lines("TypeError: x is not a function", "    at Array.map (<anonymous>)", "    at main.js:3:5"), "javascript", names("main.js"));
    kiem("node/V8 trong trình duyệt · frame 'at main.js:3:5', bỏ qua frame <anonymous>", d.length === 1 && d[0].file === "main.js" && d[0].line === 3 && d[0].col === 5 && /^TypeError/.test(d[0].message), show(d));

    /* ---------- Go / Rust / TS / C# / Ruby / PHP / Bash ---------- */
    d = P(".\\main.go:5:2: \"os\" imported and not used\r\n.\\main.go:9:2: declared and not used: x\r\n.\\main.go:10:14: undefined: y\r\n", "go", names("main.go"));
    kiem("go · '# command-line-arguments' bỏ qua, .\\main.go:5:2 → main.go, 3 lỗi đúng thứ tự", d.length === 3 && d[0].file === "main.go" && d[0].line === 5 && d[0].col === 2 && d[2].line === 10 && d[2].message === "undefined: y", show(d));
    d = P(lines("panic: runtime error: index out of range [3] with length 0", "", "goroutine 1 [running]:", "main.main()", "\tC:/Users/x/go/pan.go:5 +0x14", "exit status 2"), "go", names("pan.go"));
    kiem("go · panic: lỗi ở pan.go:5", d.length === 1 && d[0].file === "pan.go" && d[0].line === 5 && /^panic: runtime error/.test(d[0].message), show(d));
    d = P(lines("error[E0425]: cannot find value `y` in this scope", " --> src/main.rs:3:20", "  |", "3 |     println!(\"{}\", y);", "  |                    ^ not found in this scope", "", "warning: unused variable: `x`", " --> src/main.rs:2:9", "  |", "error: aborting due to 1 previous error", "", "thread 'main' panicked at src/main.rs:7:5:", "explicit panic"), "rust", names("src/main.rs"));
    kiem("rust · error[E0425] + '--> file:line:col', warning, panic; bỏ 'aborting due to'", show(d) === "e src/main.rs:3:20 cannot find value `y` in this scope [E0425] | w src/main.rs:2:9 unused variable: `x` | e src/main.rs:7:5 panic: explicit panic", show(d));
    d = P("src/Program.cs(5,9): error CS1002: ; expected [/work/p.csproj]\nProgram.cs(7,1): warning CS0168: The variable 'e' is declared but never used\n", "csharp", names("src/Program.cs"));
    kiem("csharp · File(l,c): error CS1002 (bỏ [.csproj] ở cuối), cảnh báo CS0168; Program.cs tên trần quy về src/Program.cs", d.length === 2 && d[0].file === "src/Program.cs" && d[0].line === 5 && d[0].col === 9 && d[0].message === "; expected [CS1002]" && d[1].severity === "warning" && d[1].file === "src/Program.cs", show(d));
    d = P("main.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.\nmain.ts:7:1 - error TS1005: ';' expected.\n", "typescript", names("main.ts"));
    kiem("typescript · tsc cả hai kiểu (l,c) và l:c - error", d.length === 2 && d[0].line === 3 && d[1].line === 7 && d[1].col === 1, show(d));
    d = P("main.kt:3:5: error: unresolved reference: foo\n", "kotlin", names("main.kt"));
    kiem("kotlin · cùng dạng gcc", d.length === 1 && d[0].file === "main.kt" && d[0].line === 3);
    d = P("main.rb:3:in 'foo': undefined local variable or method 'x' (NameError)\n\tfrom main.rb:7:in '<main>'\n", "ruby", names("main.rb"));
    kiem("ruby · lỗi + 'from' làm ghi chú", d.length === 2 && d[0].line === 3 && d[0].severity === "error" && d[1].line === 7 && d[1].severity === "note", show(d));
    d = P("PHP Parse error:  syntax error, unexpected end of file in /tmp/x/main.php on line 3\n", "php", names("main.php"));
    kiem("php · Parse error in … on line 3", d.length === 1 && d[0].file === "main.php" && d[0].line === 3);
    d = P("main.sh: line 4: foo: command not found\n", "bash", names("main.sh"));
    kiem("bash · 'main.sh: line 4: foo: command not found'", d.length === 1 && d[0].line === 4 && /command not found/.test(d[0].message));

    /* ---------- tính chất chung ---------- */
    kiem("parseDiagnostics · rỗng/undefined/chuỗi không có gì → mảng rỗng", P("", "cpp").length === 0 && P(undefined, "python").length === 0 && P("   \n", "java").length === 0 && P("chỉ là chữ thường\nkhông có lỗi", "cpp").length === 0);
    kiem("parseDiagnostics · loại trùng (cùng tệp/dòng/cột/mức/nội dung)", P(GPP + "\n" + GPP, "cpp", names("main.cpp")).length === 4);
    kiem("parseDiagnostics · không ném với dữ liệu rác, tối đa 200", (() => { try { const many = Array.from({ length: 500 }, (_, i) => "a.cpp:" + (i + 1) + ":1: error: e" + i).join("\n"); return P(many, "cpp").length === 200 && P("\u0000\uffff:::: error: \n:::", "cpp") !== null && P("x", "khong-co-ngon-ngu").length === 0; } catch (e) { return false; } })());
    const col = R.collectDiagnostics({ language: "cpp", compile: { ran: true, ok: false, stderr: "lạ hoắc không có vị trí\n", stdout: "", timedOut: false }, run: { ran: false, stderr: "" } }, []);
    kiem("collectDiagnostics · biên dịch hỏng mà không phân tích được → vẫn có 1 lỗi chung (dòng đầu stderr)", col.length === 1 && col[0].severity === "error" && col[0].message === "lạ hoắc không có vị trí" && col[0].line === 0);
    const col2 = R.collectDiagnostics({ language: "python", compile: null, run: { ran: true, ok: false, stderr: "  File \"main.py\", line 1\n    x = (\n        ^\nSyntaxError: '(' was never closed\n" } }, [{ name: "main.py", content: "x = (\n" }]);
    kiem("collectDiagnostics · ngôn ngữ thông dịch: lấy từ stderr CHẠY; C/C++ bỏ qua stderr chạy (là chữ của chương trình)", col2.length === 1 && col2[0].line === 1 && R.collectDiagnostics({ language: "cpp", compile: { ran: true, ok: true, stderr: "", stdout: "" }, run: { ran: true, ok: false, stderr: "a.cpp:1:1: error: tự in" } }, []).length === 0);
  }

  /* ---------------------------------------------------------------- chạy chương trình thật một lần (nếu máy có) */
  nhom("runner · stderr của trình biên dịch/thông dịch THẬT trên máy này");
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-chay-"));
    const put = (name, text) => { const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
    const sh = (cmd, args) => { const r = cp.spawnSync(cmd, args, { cwd: dir, encoding: "utf8", timeout: 60000 }); return r.error ? null : (r.stderr || "") + (r.stdout || ""); };
    const has = (cmd, args) => { const r = cp.spawnSync(cmd, args, { encoding: "utf8", timeout: 20000 }); return !r.error && r.status === 0; };
    const live = (ten, ok, chiTiet) => kiem("(máy thật) " + ten, ok, chiTiet);
    try {
      if (has("g++", ["--version"])) {
        put("main.cpp", "#include <iostream>\n#include \"util.h\"\nint main() {\n    int x = \"abc\";\n    undefined_fn(3);\n    std::cout << add(1, 2) << std::endl\n    return 0;\n}\n");
        put("util.h", "#pragma once\nint add(int a, int b);\n");
        const out = sh("g++", ["-std=c++17", "-Wall", "-Wextra", "main.cpp"]);
        const d = R.parseDiagnostics(out, "cpp", [{ name: "main.cpp" }, { name: "util.h" }]);
        live("g++: 3 lỗi đúng dòng 4,5,6 theo thứ tự xuất hiện và cảnh báo biến không dùng", d.filter((x) => x.severity === "error").map((x) => x.line).join() === "4,5,6" && d.some((x) => x.severity === "warning" && x.line === 4), JSON.stringify(d));
        put("link.cpp", "int missing(int);\nint main() { return missing(3); }\n");
        const d2 = R.parseDiagnostics(sh("g++", ["link.cpp"]), "cpp", [{ name: "link.cpp" }]);
        live("g++: lỗi liên kết undefined reference", d2.length === 1 && d2[0].severity === "error" && /undefined reference/.test(d2[0].message), JSON.stringify(d2));
      } else live("g++ không có trên máy — bỏ qua", true);
      if (has("javac", ["-version"])) {
        put("src/app/Main.java", "package app;\n\npublic class Main {\n    public static void main(String[] args) {\n        int x = 3\n        undefined(x);\n    }\n}\n");
        const d = R.parseDiagnostics(sh("javac", ["-encoding", "UTF-8", "-d", "out", "src/app/Main.java"]), "java", [{ name: "src/app/Main.java" }]);
        live("javac: lỗi cú pháp ';' expected ở dòng 5 trong src/app/Main.java, có cột (javac dừng ở lỗi cú pháp nên không có lỗi ngữ nghĩa)", d.length >= 1 && d[0].file === "src/app/Main.java" && d[0].line === 5 && d[0].col > 0 && d[0].severity === "error" && /expected/.test(d[0].message), JSON.stringify(d));
        put("src/app/Sem.java", "package app;\n\npublic class Sem {\n    public static void main(String[] args) {\n        undefined(3);\n    }\n}\n");
        const d3 = R.parseDiagnostics(sh("javac", ["-encoding", "UTF-8", "-d", "out", "src/app/Sem.java"]), "java", [{ name: "src/app/Sem.java" }]);
        live("javac: cannot find symbol ở dòng 5, message kèm symbol/location", d3.length === 1 && d3[0].line === 5 && d3[0].col === 9 && /cannot find symbol \(symbol: +method undefined\(int\); location: class Sem\)/.test(d3[0].message.replace(/symbol:\s+/, "symbol: ")), JSON.stringify(d3));
        put("W.java", "public class W {\n    public static void main(String[] args) {\n        int[] a = new int[2];\n        System.out.println(a[5]);\n    }\n}\n");
        sh("javac", ["-d", "out", "W.java"]);
        const d2 = R.parseDiagnostics(sh("java", ["-cp", "out", "W"]), "java", [{ name: "W.java" }]);
        live("java: ngoại lệ lúc chạy → lỗi ở W.java:4", d2.length >= 1 && d2[0].file === "W.java" && d2[0].line === 4 && /ArrayIndexOutOfBounds/.test(d2[0].message), JSON.stringify(d2));
      } else live("javac không có trên máy — bỏ qua", true);
      const py = ["python", "python3"].filter((c) => has(c, ["--version"]))[0];
      if (py) {
        put("main.py", "import utils\nprint('start')\nutils.boom(3)\n");
        put("utils.py", "def boom(n):\n    return helper(n)\n\ndef helper(n):\n    return 10 / (n - 3)\n");
        const files = [{ name: "main.py", content: fs.readFileSync(path.join(dir, "main.py"), "utf8") }, { name: "utils.py", content: fs.readFileSync(path.join(dir, "utils.py"), "utf8") }];
        const d = R.parseDiagnostics(sh(py, ["main.py"]), "python", files);
        live("python: traceback nhiều tệp → lỗi ở utils.py:5, ghi chú utils.py:2 và main.py:3", d.length === 3 && d[0].file === "utils.py" && d[0].line === 5 && d[0].severity === "error" && d[1].line === 2 && d[2].file === "main.py" && d[2].line === 3 && /ZeroDivisionError/.test(d[0].message), JSON.stringify(d));
        put("syn.py", "x = (1 +\nprint('hi')\n");
        const d2 = R.parseDiagnostics(sh(py, ["syn.py"]), "python", [{ name: "syn.py", content: "x = (1 +\nprint('hi')\n" }]);
        live("python: SyntaxError có dòng 1 và cột 5", d2.length === 1 && d2[0].line === 1 && d2[0].col === 5 && /SyntaxError/.test(d2[0].message), JSON.stringify(d2));
      } else live("python không có trên máy — bỏ qua", true);
      if (has("node", ["--version"])) {
        put("main.js", "const u = require('./lib/util.js');\nconsole.log('go');\nu.fail(2);\n");
        put("lib/util.js", "exports.fail = function (n) {\n  return nope(n);\n};\n");
        const d = R.parseDiagnostics(sh("node", ["main.js"]), "javascript", [{ name: "main.js" }, { name: "lib/util.js" }]);
        live("node: ReferenceError ở lib/util.js:2 rồi main.js:3", d.length === 2 && d[0].file === "lib/util.js" && d[0].line === 2 && d[0].col === 3 && d[0].severity === "error" && d[1].file === "main.js" && d[1].line === 3 && d[1].severity === "note", JSON.stringify(d));
        put("syn.js", "const a = 1;\nlet x = ;\nconsole.log(a);\n");
        const d2 = R.parseDiagnostics(sh("node", ["syn.js"]), "javascript", [{ name: "syn.js" }]);
        live("node: SyntaxError ở dòng 2 cột 9", d2.length === 1 && d2[0].line === 2 && d2[0].col === 9, JSON.stringify(d2));
      } else live("node không có trên máy — bỏ qua", true);
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ } }
  }
};
