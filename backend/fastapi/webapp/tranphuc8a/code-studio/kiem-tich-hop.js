/* kiem-tich-hop.js — kiểm TÍCH HỢP đồng bộ Code Studio với backend THẬT (không có trong kiem.js mặc định, vì khởi động máy chủ ~15–30 giây).
   Chạy tay:  node backend/fastapi/webapp/tranphuc8a/code-studio/kiem-tich-hop.js   (từ bất kỳ thư mục nào)

   Tự làm: chọn cổng trống → chạy `backend/fastapi/.venv/Scripts/python.exe -m uvicorn src.main:app` (cwd backend/fastapi) với môi trường AN TOÀN
   — DB_URL = SQLite tạm, MONGO_URI rỗng, CODESTORE_STORAGE_BACKEND=json, CODESTORE_JSON_FILE và DATA_DIR trong thư mục tạm (ghi đè .env;
   TUYỆT ĐỐI không chạm database thật; không in biến môi trường) → chờ GET /api/v1/codestore/backends → chạy kịch bản hai thiết bị qua `fetch`
   thật của node với cả kho `json` và `mysql` (mysql ở đây chạy trên SQLite tạm) → giết cả cây tiến trình, xoá tệp tạm.
   Thoát mã 1 nếu có phép kiểm sai. Không gọi mạng ra ngoài, không gọi Gemini. */
"use strict";
const fs = require("fs"), os = require("os"), net = require("net"), path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");           // gốc repo
const FASTAPI = path.join(ROOT, "backend", "fastapi");
const A = (...p) => path.join(__dirname, "assets", ...p);
global.CS = {};
["core/langs.js", "core/project.js", "core/zip.js", "core/store.js"].forEach((f) => require(A(f)));
const CS = global.CS, S = CS.store, P = CS.project;

let tong = 0, sai = 0;
const nhom = (t) => console.log("\n== " + t);
const kiem = (ten, ok, chiTiet) => { tong++; if (ok) console.log("  [ok]  " + ten); else { sai++; console.log("  [SAI] " + ten + (chiTiet !== undefined ? "   → " + chiTiet : "")); } };
const bang = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rej = (p) => p.then(() => null, (e) => e);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ máy chủ thật */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  });
}
function pythonOf() {
  const win = path.join(FASTAPI, ".venv", "Scripts", "python.exe"), nix = path.join(FASTAPI, ".venv", "bin", "python");
  return fs.existsSync(win) ? win : fs.existsSync(nix) ? nix : null;
}
function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore" });
    else { try { process.kill(-child.pid, "SIGKILL"); } catch (e) { child.kill("SIGKILL"); } }
  } catch (e) { /* đã chết */ }
}

async function startServer(tmp) {
  const py = pythonOf();
  if (!py) throw new Error("Không thấy backend/fastapi/.venv — hãy tạo venv (create_venv.ps1) trước.");
  const port = await freePort();
  const slash = (p) => p.replace(/\\/g, "/");
  const env = Object.assign({}, process.env, {
    /* CS_DB_URL: một MySQL/MariaDB TẠM do công cụ backend/fastapi/tools/kiem_mysql_that.py dựng (không bao giờ là DB thật của dự án) */
    DB_URL: process.env.CS_DB_URL || "sqlite+aiosqlite:///" + slash(path.join(tmp, "app.sqlite")),
    DB_HOST: "", DB_USERNAME: "", DB_PASSWORD: "", DB_DATABASE: "",           // phòng khi .env có thông tin MySQL thật
    /* CS_MONGO_URI: một mongod TẠM do backend/fastapi/tools/kiem_mongo_that.py dựng (không bao giờ là MongoDB thật của dự án) */
    MONGO_URI: process.env.CS_MONGO_URI || "",
    CODESTORE_STORAGE_BACKEND: "json",
    CODESTORE_JSON_FILE: path.join(tmp, "codestore.json"),
    CODESTORE_WORKSPACES_PER_HOUR: "1000",
    API_PREFIX: "/api/v1",                                                   // .env của máy này đặt API_PREFIX rỗng — ghi đè để đường dẫn cố định
    DATA_DIR: path.join(tmp, "data"),
    GEMINI_API_KEY: "",
    PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1"
  });
  const child = spawn(py, ["-m", "uvicorn", "src.main:app", "--port", String(port), "--host", "127.0.0.1", "--log-level", "warning"], {
    cwd: FASTAPI, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, detached: process.platform !== "win32"
  });
  let tail = "";
  const keep = (b) => { tail = (tail + b.toString("utf8")).slice(-6000); };
  child.stdout.on("data", keep); child.stderr.on("data", keep);
  const state = { child, port, apiBase: "http://127.0.0.1:" + port + "/api/v1", tail: () => tail, exited: false };
  child.on("exit", () => { state.exited = true; });
  const t0 = Date.now();
  let lastStatus = "chưa kết nối được";
  for (;;) {
    if (state.exited) throw new Error("uvicorn thoát sớm:\n" + tail.split("\n").slice(-25).join("\n"));
    if (Date.now() - t0 > 120000) throw new Error("uvicorn không lên sau 120 giây (trạng thái cuối: " + lastStatus + "):\n" + tail.split("\n").slice(-25).join("\n"));
    try {
      const r = await fetch(state.apiBase + "/codestore/backends", { signal: AbortSignal.timeout(2500) });
      if (r.ok) break;
      lastStatus = "HTTP " + r.status;
    } catch (e) { /* chưa lên */ }
    await sleep(300);
  }
  console.log("(máy chủ thật đã lên ở cổng " + port + " sau " + ((Date.now() - t0) / 1000).toFixed(1) + " s; DB = " + (process.env.CS_DB_URL ? "MySQL/MariaDB tạm" : "SQLite tạm") + ", kho json = tệp tạm)");
  return state;
}

/* ------------------------------------------------------------------ thiết bị */
const snip = (id, name, content) => P.createSnippet({ id, name, language: "cpp", content: content === undefined ? "int a;\n" : content });
function device(server, name, backend, off) {
  const dev = { name, off: off || 0, kv: S.kv.memory() };
  dev.now = () => Date.now() + dev.off;
  dev.lib = S.library({ kv: dev.kv, now: dev.now });
  dev.sy = S.sync({ library: dev.lib, kv: dev.kv, fetch: (u, i) => fetch(u, i), apiBase: server.apiBase, backend, now: dev.now });
  dev.edit = async (id, fn) => { const x = dev.lib.getSync(id); fn(x); return dev.lib.put(x); };
  dev.setContent = (id, content) => dev.edit(id, (x) => { x.files[0].content = content; });
  return dev;
}
const keyOf = async (dev) => (await dev.kv.get("sync:state")).key;
const shape = (arr) => JSON.stringify(arr.map((x) => ({ id: x.id, name: x.name, f: x.files, m: S.stable(x.meta), u: x.updatedAt, d: x.deleted })).sort((a, b) => (a.id < b.id ? -1 : 1)));
const same = (X, Y) => shape(X.lib.listSync()) === shape(Y.lib.listSync());
async function raw(server, method, urlPath, o) {
  o = o || {};
  const r = await fetch(server.apiBase + urlPath, { method, headers: Object.assign({ Accept: "application/json" }, o.key ? { "X-Codestore-Key": o.key } : {}, o.body ? { "Content-Type": "application/json" } : {}), body: o.body ? JSON.stringify(o.body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
  return { status: r.status, json, headers: r.headers };
}

/* ------------------------------------------------------------------ kịch bản cho một kho */
async function scenario(server, backend) {
  nhom("kho '" + backend + "' · hai thiết bị đồng bộ qua backend thật");
  const baseT = Date.now();
  const A = device(server, "A", backend), B = device(server, "B", backend);
  await A.sy.ready; await B.sy.ready;

  await A.lib.put(snip("s1", "Sắp xếp nổi bọt", "// bubble\nint main(){}\n"));
  await A.lib.put(P.createSnippet({ id: "s2", name: "Xin chào 🙂", language: "python", content: "print('Xin chào 🙂')\n" }));
  let proj = P.createProject({ id: "p1", name: "Dự án nhiều tệp", template: "cpp-multi" });
  proj = P.setMeta(P.addFolder(proj, "tai-lieu/rong"), { stdin: "3\n", args: ["a b"], compileArgs: ["-Wall"], pinned: true });
  await A.lib.put(proj);
  await A.lib.put({ id: "u1", kind: "snippet", name: "Tên tệp Unicode", language: "markdown", files: [{ path: "Ghi chú/bài 1 — 🙂.md", content: "# Chào\n" }], meta: {} });

  const ws = await A.sy.createWorkspace();
  kiem("createWorkspace trên backend thật → cs_… + khoá, backend '" + backend + "' được lưu", /^cs_[A-Za-z0-9_-]+$/.test(ws.workspaceId) && ws.key.length >= 20 && (await A.kv.get("sync:state")).backend === backend && A.sy.isConnected(), JSON.stringify(Object.assign({}, ws, { key: "…" })));
  let r = await A.sy.syncNow();
  kiem("syncNow lần đầu: đẩy 4 item, kéo 0", r.pushed === 4 && r.pulled === 0 && A.lib.dirty().length === 0 && A.sy.status === "idle", JSON.stringify(r));

  const direct = await raw(server, "GET", "/codestore/" + ws.workspaceId + "/items?since=0&backend=" + backend, { key: ws.key });
  kiem("GET thật: 4 item có serverUpdatedAt, đúng cấu trúc, serverTime/more", direct.status === 200 && direct.json.items.length === 4 && direct.json.items.every((x) => x.serverUpdatedAt > 0 && Array.isArray(x.files)) && typeof direct.json.serverTime === "number" && direct.json.more === false, JSON.stringify([direct.status, direct.json && direct.json.items && direct.json.items.length]));
  const s2 = direct.json.items.find((x) => x.id === "s2");
  kiem("Unicode/emoji đến máy chủ và trả về nguyên vẹn; thư mục rỗng + stdin + args nằm trong meta", s2.name === "Xin chào 🙂" && s2.files[0].content === "print('Xin chào 🙂')\n" && direct.json.items.find((x) => x.id === "u1").files[0].path === "Ghi chú/bài 1 — 🙂.md" && bang(direct.json.items.find((x) => x.id === "p1").meta.folders, ["tai-lieu/rong"]) && direct.json.items.find((x) => x.id === "p1").meta.stdin === "3\n");
  const noBackendParam = await raw(server, "GET", "/codestore/" + ws.workspaceId + "/items?since=0" + (backend === "json" ? "&backend=mysql" : "&backend=json"), { key: ws.key });
  kiem("mỗi kho một nơi riêng: cùng mã + khoá nhưng hỏi KHO KHÁC → 404 codestore_not_found", noBackendParam.status === 404 && noBackendParam.json.data.code === "codestore_not_found");

  const e1 = await rej(B.sy.connect(ws.workspaceId, "khoa-sai-hoan-toan"));
  kiem("connect SAI KHOÁ → 'Khoá không đúng', không lưu", e1 && e1.message === "Khoá không đúng" && e1.code === "codestore_bad_key" && e1.status === 401 && (await B.kv.get("sync:state")) === undefined && !B.sy.isConnected(), e1 && e1.message);
  const e2 = await rej(B.sy.connect("cs_khong-ton-tai", "k"));
  kiem("connect mã không tồn tại → 'Không tìm thấy không gian' (404 trước 401)", e2 && e2.message === "Không tìm thấy không gian" && e2.status === 404, e2 && e2.message);
  await B.sy.connect(ws.workspaceId, ws.key);
  r = await B.sy.syncNow();
  kiem("B nối đúng khoá và kéo về đủ 4 item, giống hệt A (kể cả meta)", r.pulled === 4 && r.pushed === 0 && same(A, B), JSON.stringify(r));
  const wrongKind = device(server, "W", backend === "json" ? "mysql" : "json"); await wrongKind.sy.ready;
  const e3 = await rej(wrongKind.sy.connect(ws.workspaceId, ws.key));
  kiem("thiết bị chọn kho khác (" + (backend === "json" ? "mysql" : "json") + ") → 'Không tìm thấy không gian'", e3 && e3.message === "Không tìm thấy không gian");

  // sửa ở hai máy
  A.off = 1000; await A.setContent("s1", "// A sửa s1\n");
  B.off = 2000; await B.setContent("s2", "print('B sửa s2')\n");
  await A.sy.syncNow(); await B.sy.syncNow(); await A.sy.syncNow();
  kiem("A sửa s1, B sửa s2 → hội tụ cả hai", A.lib.getSync("s1").files[0].content === "// A sửa s1\n" && A.lib.getSync("s2").files[0].content === "print('B sửa s2')\n" && same(A, B));
  A.off = 3000; await A.setContent("s1", "bản A (sớm hơn)");
  B.off = 6000; await B.setContent("s1", "bản B (muộn hơn)");
  await A.sy.syncNow(); await B.sy.syncNow(); await A.sy.syncNow();
  kiem("cùng s1 sửa ở hai máy → bản sửa SAU (B) thắng ở cả hai", A.lib.getSync("s1").files[0].content === "bản B (muộn hơn)" && same(A, B));
  B.off = 7000; A.off = 7000;
  await B.sy.syncNow();
  r = await B.sy.syncNow();
  kiem("LŨY ĐẲNG trên máy chủ thật: lần đồng bộ kế → pushed 0, pulled 0 (kể cả bản vừa đẩy được trả lại do serverTime lùi 2 giây)", r.pushed === 0 && r.pulled === 0, JSON.stringify(r));
  r = await A.sy.syncNow();
  kiem("… ở A cũng vậy", r.pushed === 0 && r.pulled === 0, JSON.stringify(r));

  // thêm tệp vào dự án, đổi tên thư mục
  A.off = 8000;
  await A.lib.put(P.rename(P.addFile(A.lib.getSync("p1"), "src/extra.cpp", "// thêm\n"), "src", "code"));
  await A.sy.syncNow(); await B.sy.syncNow();
  kiem("A thêm tệp + đổi tên thư mục src → code: B nhận dự án mới (6 tệp, đường dẫn code/…)", B.lib.getSync("p1").files.length === 6 && B.lib.getSync("p1").files.some((f) => f.path === "code/extra.cpp") && !B.lib.getSync("p1").files.some((f) => /^src\//.test(f.path)) && same(A, B));

  // xoá / bia mộ
  A.off = 9000; await A.lib.remove("u1");
  await A.sy.syncNow(); await B.sy.syncNow();
  const tomb = (await raw(server, "GET", "/codestore/" + ws.workspaceId + "/items?since=0&backend=" + backend, { key: ws.key })).json.items.find((x) => x.id === "u1");
  kiem("xoá ở A → B thấy bia mộ; máy chủ giữ bia mộ đã bỏ files/meta", B.lib.getSync("u1").deleted === true && !B.lib.listSync().some((x) => x.id === "u1") && tomb.deleted === true && tomb.files.length === 0 && bang(tomb.meta, {}));
  A.off = 20000; await A.lib.remove("s2"); await A.sy.syncNow();
  B.off = 15000; await B.setContent("s2", "// sửa CŨ hơn bia mộ\n");
  const rb = await B.sy.syncNow();
  kiem("B đẩy bản sửa CŨ hơn bia mộ → máy chủ giữ bia mộ, trả về, B nhận bia mộ và hết dirty", rb.pushed === 1 && B.lib.getSync("s2").deleted === true && B.lib.dirty().length === 0, JSON.stringify(rb));
  A.off = 30000; await A.lib.remove("s1"); await A.sy.syncNow();
  B.off = 40000; await B.setContent("s1", "// sửa MỚI hơn bia mộ → sống lại\n");
  await B.sy.syncNow(); await A.sy.syncNow();
  kiem("B sửa MỚI hơn bia mộ → sống lại ở máy chủ và ở A", A.lib.getSync("s1").deleted === false && A.lib.getSync("s1").files[0].content.indexOf("sống lại") > 0 && same(A, B));

  // item sát giới hạn 512 KB
  const probe = snip("lim", "Sát giới hạn", ""), fixed = P.itemBytes(Object.assign(P.clone(probe), { updatedAt: baseT }));
  const atLimit = "x".repeat(512 * 1024 - fixed - 20);                       // chừa chút cho updatedAt lớn hơn
  A.off = 50000; await A.lib.put(snip("lim", "Sát giới hạn", atLimit));
  r = await A.sy.syncNow();
  kiem("item gần 512 KB (" + (P.itemBytes(A.lib.getSync("lim")) / 1024).toFixed(1) + " KB) được máy chủ thật chấp nhận", r.pushed === 1 && A.sy.status === "idle" && A.lib.dirty().length === 0, A.sy.lastError);
  await B.sy.syncNow();
  kiem("… và đến được B nguyên vẹn", B.lib.getSync("lim").files[0].content.length === atLimit.length);
  A.off = 51000; await A.lib.put(snip("lon", "Quá lớn", "y".repeat(520 * 1024)));
  r = await A.sy.syncNow();
  kiem("item > 512 KB bị bỏ ở phía máy khách, các item khác vẫn đồng bộ; báo lỗi riêng", r.skipped.length === 1 && /quá lớn/.test(A.sy.lastError) && A.sy.status === "error");
  const big = await raw(server, "PUT", "/codestore/" + ws.workspaceId + "/items?backend=" + backend, { key: ws.key, body: { items: [{ id: "lon", kind: "snippet", name: "x", language: "cpp", files: [{ path: "a.cpp", content: "y".repeat(512 * 1024 - 10) }], meta: {}, updatedAt: Date.now() }] } });
  kiem("(đối chiếu hợp đồng) gửi thẳng item vượt 512 KB tính theo byte JSON → máy chủ từ chối codestore_bad_item (400) đúng như ta dự đoán", big.status === 400 && big.json.data.code === "codestore_bad_item" && big.json.data.itemId === "lon", JSON.stringify([big.status, big.json && big.json.data]));
  const huge = await raw(server, "PUT", "/codestore/" + ws.workspaceId + "/items?backend=" + backend, { key: ws.key, body: { items: [{ id: "lon", kind: "snippet", name: "x", language: "cpp", files: [{ path: "a.cpp", content: "y".repeat(600 * 1024) }], meta: {}, updatedAt: Date.now() }] } });
  kiem("(đối chiếu) > 524.288 ký tự → 422 của schema", huge.status === 422);
  await A.lib.remove("lon");
  await A.sy.syncNow();

  // phân trang thật (> 200)
  A.off = 60000;
  for (let i = 0; i < 250; i++) await A.lib.put(snip("pg" + String(i).padStart(3, "0"), "Trang " + i, "// " + i));
  r = await A.sy.syncNow();
  kiem("250 item mới → đẩy 3 lô (100 + 100 + 50), thiết bị hết dirty", r.pushed === 250 && A.lib.dirty().length === 0, JSON.stringify(r));
  const C = device(server, "C", backend); await C.sy.ready;
  await C.sy.connect(ws.workspaceId, ws.key);
  r = await C.sy.syncNow();
  const live = A.lib.listSync().length;
  kiem("thiết bị mới C kéo 250+ item qua nhiều trang thật (limit 200 + more:true): đủ và giống hệt A", r.pulled >= 250 && same(A, C) && C.lib.listSync().length === live, JSON.stringify(r) + " live=" + live + " C=" + C.lib.listSync().length);
  r = await C.sy.syncNow();
  kiem("C: đồng bộ tiếp theo không còn gì", r.pushed === 0 && r.pulled === 0, JSON.stringify(r));

  // đồng hồ lệch
  const D = device(server, "D", backend, 3 * 24 * 3600 * 1000); await D.sy.ready;
  await D.sy.connect(ws.workspaceId, ws.key);
  await D.lib.put(snip("dd", "Đồng hồ lệch"));
  const ec = await rej(D.sy.syncNow());
  kiem("đồng hồ máy nhanh 3 ngày → máy chủ thật trả codestore_bad_clock → 'Đồng hồ máy lệch quá 1 ngày'; dữ liệu cục bộ còn", ec && ec.code === "codestore_bad_clock" && /Đồng hồ máy lệch quá 1 ngày/.test(ec.message) && D.lib.getSync("dd") && D.lib.dirty().some((x) => x.id === "dd"), ec && ec.message);
  D.off = 0;
  const rd = await D.sy.syncNow();
  kiem("chỉnh lại giờ: mục dấu thời gian tương lai bị loại có lời nhắn, KHÔNG làm kẹt các mục khác", rd.skipped.length === 1 && /tương lai/.test(D.sy.lastError));
  await D.setContent("dd", "// sửa sau khi chỉnh giờ\n");
  r = await D.sy.syncNow();
  kiem("sửa lại mục kẹt → đồng bộ được ngay", r.pushed === 1 && D.sy.status === "idle");

  // ngắt, nối lại, xoá không gian
  const before = shape(B.lib.listSync());
  await B.sy.disconnect();
  kiem("disconnect: giữ nguyên dữ liệu cục bộ, quên khoá", shape(B.lib.listSync()) === before && (await B.kv.get("sync:state")) === undefined && !B.sy.isConnected());
  await B.lib.put(snip("sau", "Sau khi ngắt"));
  const stB = B.lib.stats();
  await B.sy.connect(ws.workspaceId, ws.key);
  r = await B.sy.syncNow();
  await A.sy.syncNow();
  kiem("nối lại: đẩy lại MỌI item (kể cả bia mộ — máy chủ gộp lũy đẳng) và mục tạo sau khi ngắt lên đến A", r.pushed === stB.count + stB.tombstones && A.lib.getSync("sau") && A.lib.getSync("sau").name === "Sau khi ngắt", JSON.stringify([r, stB]));
  const del = await raw(server, "DELETE", "/codestore/" + ws.workspaceId + "?backend=" + backend, { key: ws.key });
  kiem("DELETE không gian (khoá đúng) → {deleted:true}", del.status === 200 && del.json.deleted === true);
  await A.lib.put(snip("sau-xoa", "Sau khi xoá không gian"));
  const e404 = await rej(A.sy.syncNow());
  kiem("sau khi không gian bị xoá: 'Không tìm thấy không gian', dữ liệu cục bộ còn đủ", e404 && e404.message === "Không tìm thấy không gian" && A.sy.status === "error" && A.lib.listSync().length > 250 && A.lib.getSync("sau-xoa") !== null);
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cs-tichhop-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  let server = null;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    killTree(server && server.child);
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch (e) { /* tệp SQLite có thể còn khoá một lúc */ }
  };
  process.stdout.on("error", () => { /* EPIPE khi người đọc đóng ống (| head): vẫn phải dọn dẹp */ });
  process.on("exit", cleanup);                                                // mọi lối thoát đều giết máy chủ và xoá thư mục tạm
  process.on("SIGINT", () => { cleanup(); process.exit(130); });
  process.on("SIGTERM", () => { cleanup(); process.exit(143); });
  process.on("uncaughtException", (e) => { console.error(e && e.stack ? e.stack : e); cleanup(); process.exit(1); });
  try {
    server = await startServer(tmp);

    nhom("GET /codestore/backends (backend thật)");
    const b = await raw(server, "GET", "/codestore/backends");
    const byId = Object.fromEntries(((b.json && b.json.backends) || []).map((x) => [x.id, x]));
    kiem("trả {default, backends:[json, mysql, mongo]} với id/label/available/reason/persistent", b.status === 200 && b.json.default === "json" && bang(Object.keys(byId), ["json", "mysql", "mongo"]) && Object.values(byId).every((x) => "label" in x && "available" in x && "reason" in x && "persistent" in x));
    const MONGO = !!process.env.CS_MONGO_URI;
    kiem("json dùng được; mysql dùng được (" + (process.env.CS_DB_URL ? "MariaDB tạm" : "SQLite tạm") + "); mongo " + (MONGO ? "dùng được (mongod tạm)" : "không dùng được (MONGO_URI rỗng) kèm lý do"),
      byId.json.available === true && byId.mysql.available === true && (MONGO ? byId.mongo.available === true : (byId.mongo.available === false && byId.mongo.reason.length > 0)), JSON.stringify(b.json));
    const probeApi = device(server, "P", "json");
    const bk = await probeApi.sy.backends();
    kiem("CS.store.sync.backends() cho cùng kết quả", bang(bk.backends.map((x) => x.id), ["json", "mysql", "mongo"]) && bk.default === "json");
    if (!MONGO) {
      const mg = device(server, "Mg", "mongo"); await mg.sy.ready;
      const em = await rej(mg.sy.createWorkspace());
      kiem("tạo không gian ở kho mongo (chưa cấu hình) → codestore_backend_unavailable (503), không lưu gì", em && em.code === "codestore_backend_unavailable" && em.status === 503 && /chưa dùng được/.test(em.message) && (await mg.kv.get("sync:state")) === undefined, em && em.message);
    }

    await scenario(server, "json");
    await scenario(server, "mysql");
    if (MONGO) await scenario(server, "mongo");

    nhom("giới hạn tốc độ nhập sai khoá (làm CUỐI CÙNG: 20 lần/10 phút/IP rồi 429)");
    const R = device(server, "R", "json"); await R.sy.ready;
    const owner = device(server, "O", "json"); await owner.sy.ready;
    await owner.sy.createWorkspace();
    const wsId = owner.sy.workspaceId, key = await keyOf(owner);
    let last = null;
    for (let i = 0; i < 25; i++) { last = await rej(R.sy.connect(wsId, "sai-" + i)); if (last && last.status === 429) break; }
    kiem("nhập sai khoá nhiều lần → 429 codestore_rate_limited kèm Retry-After; thông báo 'Gửi quá nhanh, thử lại sau N giây'", last && last.status === 429 && last.code === "codestore_rate_limited" && last.retryAfter > 0 && new RegExp("Gửi quá nhanh, thử lại sau " + last.retryAfter + " giây").test(last.message), last && last.message);
    await owner.lib.put(snip("rl", "Trong lúc bị chặn"));
    const er = await rej(owner.sy.syncNow());
    kiem("khoá ĐÚNG cũng bị 429 trong thời gian chờ; trạng thái error; dữ liệu cục bộ còn dirty", er && er.status === 429 && owner.sy.status === "error" && owner.lib.dirty().length === 1, er && er.message);
    kiem("không gọi lại ngay (nhớ Retry-After): syncNow kế tiếp từ chối tại chỗ", await (async () => { const t0 = Date.now(); const e = await rej(owner.sy.syncNow()); return e && e.status === 429 && Date.now() - t0 < 50; })());
    await raw(server, "DELETE", "/codestore/" + wsId + "?backend=json", { key }).catch(() => null);
  } catch (e) {
    kiem("kịch bản tích hợp chạy hết không ném lỗi", false, e && e.stack ? e.stack : String(e));
  } finally {
    cleanup();
    const gone = server ? server.exited || (server.child.exitCode !== null) : true;
    console.log("\n(đã tắt máy chủ " + (server ? "(pid " + server.child.pid + ", " + (gone ? "đã thoát" : "đang tắt") + ")" : "") + " và xoá thư mục tạm " + (fs.existsSync(tmp) ? "— KHÔNG xoá được: " + tmp : "OK") + ")");
  }
  console.log("\n" + "=".repeat(58));
  if (sai) { console.log("SAI " + sai + "/" + tong + " phép kiểm."); process.exit(1); }
  console.log("Đạt — " + tong + " phép kiểm (tích hợp với backend thật).");
}
main();
