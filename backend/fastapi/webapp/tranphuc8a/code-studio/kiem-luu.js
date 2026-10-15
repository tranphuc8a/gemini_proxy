/* Kiểm kho lưu cục bộ + đồng bộ (store.js): kv (bộ nhớ, localStorage giả), library (put/list/xoá/nhập-xuất/đua nhiều put/gộp từ xa),
   sync với MÁY CHỦ GIẢ mô phỏng đúng hợp đồng /codestore (kiem-may-chu-gia.js). Được kiem.js nạp. */
"use strict";
const makeServer = require("./kiem-may-chu-gia.js");

module.exports = async function ({ nhom, kiem, bang, CS }) {
  if (!CS.store || !CS.project) { nhom("store · kho lưu"); kiem("có module store + project", false); return; }
  const S = CS.store, P = CS.project;
  const Z = 1790000000000, DAY = 24 * 3600 * 1000;
  const snip = (id, name, content) => P.createSnippet({ id, name, language: "cpp", content: content === undefined ? "int a;\n" : content });
  const rej = (p) => p.then(() => null, (e) => e);                  // → lỗi, hoặc null nếu thành công
  const names = (arr) => arr.map((x) => x.id + ":" + x.name);
  const memKv = () => S.kv.memory();
  const fakeStorage = (flags) => {
    const m = new Map(), st = { flags: flags || {}, m };
    st.getItem = (k) => { if (st.flags.throwGet) throw new Error("SecurityError"); return m.has(k) ? m.get(k) : null; };
    st.setItem = (k, v) => { if (st.flags.throwSet) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); m.set(k, String(v)); };
    st.removeItem = (k) => { if (st.flags.throwRemove) throw new Error("x"); m.delete(k); };
    st.key = (i) => { const a = Array.from(m.keys()); return i < a.length ? a[i] : null; };
    Object.defineProperty(st, "length", { get: () => m.size });
    return st;
  };

  /* ================================================================ kv */
  nhom("store · kv bộ nhớ");
  {
    const kv = memKv();
    kiem("get khoá chưa có → undefined; set rồi get đúng; JSON lồng nhau", (await kv.get("x")) === undefined && (await kv.set("x", { a: [1, 2, { b: "é" }] })) === undefined && bang(await kv.get("x"), { a: [1, 2, { b: "é" }] }));
    const v = await kv.get("x"); v.a.push(99);
    kiem("giá trị trả về là bản sao: sửa nó không đổi kho", bang(await kv.get("x"), { a: [1, 2, { b: "é" }] }));
    const src = { z: 1 }; await kv.set("y", src); src.z = 2;
    kiem("giá trị ghi vào cũng được sao chép", (await kv.get("y")).z === 1);
    await kv.set("item:b", 1); await kv.set("item:a", 2); await kv.set("other", 3);
    kiem("keys(prefix) lọc theo tiền tố và sắp xếp; keys() không đối số = tất cả", bang(await kv.keys("item:"), ["item:a", "item:b"]) && (await kv.keys()).length === 5);
    await kv.del("item:a"); await kv.del("không-có");
    kiem("del xoá một khoá, xoá khoá không có không lỗi", (await kv.get("item:a")) === undefined && bang(await kv.keys("item:"), ["item:b"]));
    await kv.set("y", undefined);
    kiem("set(key, undefined) = xoá", (await kv.get("y")) === undefined);
    const cyc = {}; cyc.self = cyc;
    kiem("giá trị không JSON-hoá được → Promise từ chối (không ném đồng bộ)", (await rej(kv.set("c", cyc))) instanceof Error);
    kiem("memory().persistent === false", kv.persistent === false);
  }

  nhom("store · kv localStorage (giả)");
  {
    const st = fakeStorage();
    const kv = S.kv.local("cs:data:", { storage: st });
    kiem("localStorage dùng được → persistent true, error rỗng", kv.persistent === true && kv.error === "");
    await kv.set("a", { n: 1 }); await kv.set("item:1", "x");
    kiem("khoá thật = tiền tố + khoá; lưu dạng JSON", st.m.get("cs:data:a") === '{"n":1}' && st.m.has("cs:data:item:1"));
    kiem("get/keys(prefix) đúng và bỏ tiền tố", bang(await kv.get("a"), { n: 1 }) && bang(await kv.keys("item:"), ["item:1"]) && bang(await kv.keys(), ["a", "item:1"]));
    st.m.set("khác:z", "1");
    kiem("khoá ngoài tiền tố không lẫn vào keys()", !(await kv.keys()).some((k) => /z/.test(k)));
    const kv2 = S.kv.local("cs:khac:", { storage: st });
    await kv2.set("a", 2);
    kiem("hai tiền tố khác nhau cách ly nhau", bang(await kv.get("a"), { n: 1 }) && (await kv2.get("a")) === 2);
    st.m.set("cs:data:hong", "{không phải json");
    kiem("mục hỏng (JSON sai) → undefined, không ném", (await kv.get("hong")) === undefined);
    await kv.del("a");
    kiem("del xoá khỏi localStorage", !st.m.has("cs:data:a") && (await kv.get("a")) === undefined);

    // bị chặn hoàn toàn (cửa sổ riêng tư): setItem ném ngay từ lúc thăm dò
    const blocked = S.kv.local("p:", { storage: fakeStorage({ throwSet: true }) });
    kiem("localStorage bị chặn → persistent false + error tiếng Việt, vẫn chạy như bộ nhớ", blocked.persistent === false && /chặn|phiên/.test(blocked.error));
    await blocked.set("k", [1, 2]);
    kiem("… ghi/đọc/keys/xoá vẫn đúng trong phiên", bang(await blocked.get("k"), [1, 2]) && bang(await blocked.keys(), ["k"]) && ((await blocked.del("k")), (await blocked.get("k")) === undefined));

    // truy cập thuộc tính localStorage ném (Safari/Chrome chặn cookie)
    const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError: truy cập bị chặn"); } });
    let kvg = null, threw = false;
    try { kvg = S.kv.local("g:"); } catch (e) { threw = true; }
    if (had) Object.defineProperty(globalThis, "localStorage", had); else delete globalThis.localStorage;
    kiem("truy cập globalThis.localStorage ném lỗi → local() không ném, persistent false", !threw && kvg && kvg.persistent === false && ((await kvg.set("a", 1)), (await kvg.get("a")) === 1));

    // ghi lỗi giữa chừng (đầy bộ nhớ)
    const st2 = fakeStorage(), q = S.kv.local("q:", { storage: st2 });
    await q.set("cu", "cũ");
    st2.flags.throwSet = true;
    const r = await rej(q.set("moi", { x: 1 }));
    kiem("đầy bộ nhớ: set KHÔNG từ chối, đọc lại được trong phiên, persistent false + error", r === null && bang(await q.get("moi"), { x: 1 }) && q.persistent === false && /[Kk]hông ghi được/.test(q.error));
    kiem("… dữ liệu cũ vẫn đọc được, keys gồm cả mục chỉ nằm trong bộ nhớ", (await q.get("cu")) === "cũ" && bang(await q.keys(), ["cu", "moi"]));
    await q.set("cu", "cũ hơn");
    kiem("… ghi đè khoá cũ khi đang lỗi: đọc ra bản mới nhất", (await q.get("cu")) === "cũ hơn");
    st2.flags.throwSet = false;
    await q.set("moi", { x: 2 }); await q.set("cu", "xong");
    kiem("hết lỗi, ghi lại được → persistent true, bản mới đã nằm trong localStorage", q.persistent === true && q.error === "" && st2.m.get("q:moi") === '{"x":2}');

    const st3 = fakeStorage(), d = S.kv.local("d:", { storage: st3 });
    await d.set("a", 1);
    st3.flags.throwRemove = true;
    await d.del("a");
    kiem("removeItem ném: xoá vẫn có hiệu lực trong phiên (ẩn bản trong localStorage)", (await d.get("a")) === undefined && !(await d.keys()).includes("a"));
    const st4 = fakeStorage(); await S.kv.local("e:", { storage: st4 }).set("a", 1); st4.flags.throwGet = true;
    kiem("getItem ném giữa chừng → undefined, không ném", (await S.kv.local("e:", { storage: st4 }).get("a")) === undefined);
  }

  nhom("store · kv IndexedDB (không có trong node)");
  {
    let threw = null;
    try { S.kv.idb("code-studio"); } catch (e) { threw = e; }
    kiem("không có indexedDB → idb() ném lỗi ĐỒNG BỘ (code no_idb) để app rơi về local", threw && threw.code === "no_idb");
    const kv = await S.kv.auto({ idb: "x", local: "au:", storage: fakeStorage() });
    kiem("auto() không có IndexedDB → rơi về localStorage, dùng được", kv.kind === "local" && ((await kv.set("a", 1)), (await kv.get("a")) === 1));
    // IndexedDB hỏng khi mở: open() gọi onerror
    const badFactory = { open() { const req = {}; setTimeout(() => { req.error = new Error("mở hỏng"); req.onerror && req.onerror(); }, 0); return req; } };
    const bad = S.kv.idb("x", { indexedDB: badFactory });
    const e1 = await rej(bad.ready), e2 = await rej(bad.get("a"));
    kiem("mở IndexedDB hỏng → ready và mọi thao tác từ chối (code idb_open)", e1 && e1.code === "idb_open" && e2 && e2.code === "idb_open");
    const kv3 = await S.kv.auto({ idb: "x", indexedDB: badFactory, local: "au3:", storage: fakeStorage() });
    kiem("auto() với IndexedDB hỏng → rơi về localStorage", kv3.kind === "local");
  }

  /* ================================================================ library */
  nhom("store · library (put/get/list/xoá)");
  {
    const clock = { t: Z };
    const kv = memKv(), lib = S.library({ kv, now: () => clock.t });
    await lib.ready;
    kiem("thư viện mới trống", lib.listSync().length === 0 && lib.stats().count === 0);
    const a = await lib.put(snip("a", "Một"));
    kiem("put trả bản đã chuẩn hoá có updatedAt = đồng hồ", a.id === "a" && a.updatedAt === Z && a.kind === "snippet" && a.deleted === false && a.meta.mainFile === "main.cpp");
    const a2 = await lib.put(Object.assign({}, a, { name: "Một sửa" }));
    kiem("put lần hai cùng đồng hồ → updatedAt = cũ + 1 (sửa sau luôn mới hơn)", a2.updatedAt === Z + 1 && a2.name === "Một sửa");
    clock.t = Z + 5000;
    const a3 = await lib.put(a2);
    kiem("đồng hồ đi tiếp → updatedAt = đồng hồ", a3.updatedAt === Z + 5000);
    clock.t = Z - 99999;
    kiem("đồng hồ lùi → vẫn tăng (cũ + 1)", (await lib.put(a3)).updatedAt === Z + 5001);
    clock.t = Z + 10000;
    const got = lib.getSync("a");
    got.files[0].content = "ĐÃ SỬA NGOÀI"; got.meta.pinned = true;
    kiem("get/list trả BẢN SAO: sửa chúng không đổi kho", lib.getSync("a").files[0].content !== "ĐÃ SỬA NGOÀI" && lib.listSync()[0].meta.pinned === false);
    kiem("get id lạ → null", lib.getSync("khong-co") === null);
    const noId = await lib.put({ kind: "snippet", name: "Không id", language: "python", files: [{ path: "m.py", content: "x" }] });
    kiem("put item không id → cấp id mới hợp lệ", ID_OK(noId.id) && lib.getSync(noId.id));
    function ID_OK(s) { return /^[A-Za-z0-9_.:-]{1,80}$/.test(s); }
    const bad = await rej(lib.put(null));
    kiem("put(null) → Promise từ chối, hàng đợi vẫn chạy tiếp", bad instanceof Error && (await lib.put(snip("sau", "Sau"))).id === "sau");

    // thứ tự list
    const k2 = memKv(), l2 = S.library({ kv: k2, now: () => clock.t });
    clock.t = 1000; await l2.put(snip("c1", "cũ nhất"));
    clock.t = 2000; await l2.put(snip("c2", "giữa"));
    clock.t = 3000; await l2.put(snip("c3", "mới nhất"));
    kiem("list: mới sửa nhất lên đầu", bang(l2.listSync().map((x) => x.id), ["c3", "c2", "c1"]));
    clock.t = 4000; await l2.put(P.setMeta(l2.getSync("c1"), { pinned: true }));
    clock.t = 5000; await l2.put(snip("c4", "mới hơn nữa"));
    kiem("list: mục GHIM luôn trên cùng, trong nhóm ghim và không ghim đều mới → cũ", bang(l2.listSync().map((x) => x.id), ["c1", "c4", "c3", "c2"]), l2.listSync().map((x) => x.id).join());
    clock.t = 6000; await l2.put(P.setMeta(l2.getSync("c3"), { pinned: true }));
    kiem("hai mục ghim: mới sửa trước", bang(l2.listSync().map((x) => x.id).slice(0, 2), ["c3", "c1"]));

    // xoá = bia mộ
    clock.t = 7000;
    const tomb = await l2.remove("c2");
    kiem("remove → bia mộ {deleted:true, files:[], meta:{}} với updatedAt mới", tomb.deleted === true && bang(tomb.files, []) && bang(tomb.meta, {}) && tomb.updatedAt === 7000 && tomb.id === "c2" && tomb.name === "giữa");
    kiem("list bỏ bia mộ; get vẫn trả bia mộ", !l2.listSync().some((x) => x.id === "c2") && l2.getSync("c2").deleted === true);
    kiem("remove lần hai: không đổi gì (không tăng updatedAt)", (await l2.remove("c2")).updatedAt === 7000);
    kiem("remove id lạ → null", (await l2.remove("zzz")) === null);
    clock.t = 8000;
    const rev = await l2.put(snip("c2", "sống lại"));
    kiem("put lại cùng id sau khi xoá → sống lại, updatedAt mới hơn bia mộ", rev.deleted === false && rev.updatedAt === 8000 && l2.listSync().some((x) => x.id === "c2"));
    const st = l2.stats();
    kiem("stats: count/tombstones/dirty/bytes", st.count === 4 && st.tombstones === 0 && st.dirty === 4 && st.bytes > 100, JSON.stringify(st));
    await l2.remove("c4");
    kiem("stats đếm bia mộ", l2.stats().tombstones === 1 && l2.stats().count === 3);

    // bền vững: nạp lại từ cùng kv
    const l3 = S.library({ kv: k2, now: () => clock.t });
    await l3.ready;
    kiem("nạp lại từ cùng kv: danh sách, bia mộ và cờ dirty giống hệt", bang(names(l3.listSync()), names(l2.listSync())) && l3.getSync("c4").deleted === true && l3.stats().dirty === l2.stats().dirty && bang(l3.dirty().map((x) => x.id), l2.dirty().map((x) => x.id)));
    kiem("mỗi item một khoá item:<id> + chỉ mục + dirty", bang(await k2.keys("item:"), ["item:c1", "item:c2", "item:c3", "item:c4"]) && (await k2.get("index")).v === 1 && Array.isArray(await k2.get("dirty")));
    // phục hồi
    await k2.set("item:mocoi", P.normalize(Object.assign(snip("mocoi", "Mồ côi"), { updatedAt: 123 })));
    await k2.set("item:hong", "không phải đối tượng");
    await k2.set("item:khacid", Object.assign(snip("khac", "Sai id"), { updatedAt: 5 }));
    const l4 = S.library({ kv: k2, now: () => clock.t });
    await l4.ready;
    kiem("ready nhặt item mồ côi (có khoá item nhưng chưa vào chỉ mục)", !!l4.getSync("mocoi") && l4.getSync("mocoi").name === "Mồ côi");
    kiem("ready bỏ qua khoá item hỏng/sai id, không ném", !l4.getSync("hong") && !l4.getSync("khac"));
    await k2.del("index");
    const l5 = S.library({ kv: k2, now: () => clock.t });
    await l5.ready;
    kiem("mất chỉ mục → dựng lại từ các khoá item", l5.getSync("c1") && l5.getSync("mocoi") && (await k2.get("index")).v === 1);
  }

  nhom("store · library: list()/get() là Promise, đọc thấy ngay thứ vừa ghi");
  {
    const clock = { t: Z }, lib = S.library({ kv: memKv(), now: () => clock.t });
    const pl = lib.list(), pg = lib.get("x");
    kiem("list() và get() trả Promise (dùng được với .then như ide.js của heuristic-practice-2)", pl instanceof Promise && pg instanceof Promise && Array.isArray(await pl) && (await pg) === null && typeof lib.list().then === "function");
    lib.put(snip("r1", "Một"));                                    // KHÔNG await put
    lib.put(snip("r2", "Hai"));
    const seen = await lib.list();
    kiem("list() gọi ngay sau put chưa await vẫn thấy cả hai (cùng hàng đợi, đọc theo thứ tự gọi)", seen.length === 2 && (await lib.get("r1")).name === "Một");
    const p3 = lib.remove("r1"), after = lib.list();
    kiem("list() sau remove chưa await: không còn r1; get(r1) trả bia mộ", (await after).length === 1 && (await lib.get("r1")).deleted === true && (await p3).deleted === true);
    kiem("listSync/getSync: bản đồng bộ cùng kết quả (dùng sau ready)", bang(names(lib.listSync()), names(await lib.list())) && lib.getSync("r2").name === "Hai" && lib.getSync("zzz") === null);
    const ids = [];
    const off = lib.onChange(async () => { ids.push((await lib.list()).length); });
    await lib.put(snip("r3", "Ba"));
    await lib.list();
    kiem("gọi list() trong onChange không gây kẹt hàng đợi", ids.length === 1 && ids[0] === 2);
    off();
    // ready từ chối → list/get từ chối (không trả mảng rỗng một cách im lặng)
    const bad = { kind: "x", get: () => Promise.reject(new Error("kv hỏng")), set: () => Promise.resolve(), del: () => Promise.resolve(), keys: () => Promise.resolve([]) };
    const broken = S.library({ kv: bad });
    const e1 = await rej(broken.ready), e2 = await rej(broken.list()), e3 = await rej(broken.put(snip("z", "Z")));
    kiem("kv hỏng khi nạp: ready, list và put đều từ chối (app thấy lỗi thay vì mất dữ liệu im lặng)", e1 && e2 && e3 && /kv hỏng/.test(e1.message + e2.message + e3.message));
    // kv kiểu ide.js: get trả null cho khoá thiếu, không có kind
    const store = new Map();
    const ideKv = { persistent: true, get: (k) => Promise.resolve(store.has(k) ? JSON.parse(store.get(k)) : null), set: (k, v) => { store.set(k, JSON.stringify(v)); return Promise.resolve(); }, del: (k) => { store.delete(k); return Promise.resolve(); }, keys: (p) => Promise.resolve(Array.from(store.keys()).filter((k) => k.indexOf(p || "") === 0)) };
    const l1 = S.library({ kv: ideKv, now: () => clock.t });
    await l1.put(snip("k1", "Kiểu ide.js"));
    const l2 = S.library({ kv: ideKv, now: () => clock.t });
    kiem("kv tuỳ biến trả null cho khoá thiếu (như kvLuu của ide.js) vẫn chạy và nạp lại đúng", (await l2.list()).length === 1 && (await l2.get("k1")).name === "Kiểu ide.js");
    const sy = S.sync({ library: l2, kv: ideKv, fetch: () => Promise.reject(new TypeError("x")), apiBase: "x" });
    await sy.ready;
    kiem("sync trên kv tuỳ biến (get trả null): chưa nối, idle", sy.isConnected() === false && sy.workspaceId === "");
  }

  nhom("store · library đua nhiều put (tuần tự hoá)");
  {
    const clock = { t: Z }, kv = memKv(), lib = S.library({ kv, now: () => clock.t });
    const ps = [];
    for (let i = 0; i < 60; i++) ps.push(lib.put(snip("i" + i, "Mục " + i, "int x" + i + ";")));
    for (let i = 0; i < 20; i++) ps.push(lib.put(Object.assign(snip("chung", "Chung"), { files: [{ path: "main.cpp", content: "lần " + i }] })));
    const res = await Promise.all(ps);
    kiem("80 put gọi dồn: không mất bản ghi nào (60 + 1)", lib.listSync().length === 61);
    kiem("20 put cùng id: bản cuối thắng, updatedAt tăng nghiêm ngặt", lib.getSync("chung").files[0].content === "lần 19" && res.slice(60).every((x, i, a) => !i || x.updatedAt > a[i - 1].updatedAt));
    const re = S.library({ kv, now: () => clock.t });
    await re.ready;
    kiem("nạp lại: đủ 61 mục và nội dung cuối đúng", re.listSync().length === 61 && re.getSync("chung").files[0].content === "lần 19" && re.getSync("i59").name === "Mục 59");
    const mixed = [lib.put(snip("m1", "M1")), lib.remove("m1"), lib.put(snip("m2", "M2")), lib.markAllDirty()];
    await Promise.all(mixed);
    kiem("put/remove/markAllDirty xen kẽ vẫn đúng thứ tự gọi", lib.getSync("m1").deleted === true && lib.getSync("m2").deleted === false);
  }

  nhom("store · library sao lưu JSON (export/import)");
  {
    const clock = { t: Z }, A = S.library({ kv: memKv(), now: () => clock.t });
    await A.put(snip("e1", "Một", "int a;")); clock.t += 10;
    await A.put(P.createProject({ id: "e2", name: "Dự án", template: "cpp-multi" })); clock.t += 10;
    await A.put(snip("e3", "Sẽ xoá")); clock.t += 10;
    await A.remove("e3");
    const json = A.exportJson();
    const obj = JSON.parse(json);
    kiem("exportJson: {app, version, items} gọn, không có bia mộ", json.indexOf('{"app":"code-studio","version":1,"items":[') === 0 && obj.items.length === 2 && !obj.items.some((x) => x.deleted));
    const B = S.library({ kv: memKv(), now: () => clock.t });
    const r = await B.importJson(json, { mode: "merge" });
    kiem("importJson vào thư viện trống: imported 2, skipped 0", r.imported === 2 && r.skipped === 0 && B.listSync().length === 2);
    kiem("… nội dung, updatedAt giữ nguyên, item thành dirty", bang(B.getSync("e2").files, A.getSync("e2").files) && B.getSync("e1").updatedAt === A.getSync("e1").updatedAt && B.stats().dirty === 2);
    const r2 = await B.importJson(json);
    kiem("nhập lại cùng tệp: không đổi gì (LWW), kept = 2", r2.imported === 0 && r2.kept === 2 && r2.skipped === 0);
    // LWW
    const newer = JSON.parse(json); newer.items[0].name = "Bản mới hơn"; newer.items[0].updatedAt += 100;
    const older = JSON.parse(json); older.items[1].name = "Bản cũ hơn"; older.items[1].updatedAt -= 100;
    const r3 = await B.importJson(JSON.stringify({ app: "code-studio", version: 1, items: [newer.items[0], older.items[1]] }));
    kiem("LWW theo updatedAt: bản mới hơn thắng, bản cũ hơn bị giữ lại bản cục bộ", r3.imported === 1 && r3.kept === 1 && B.getSync(newer.items[0].id).name === "Bản mới hơn" && B.getSync(older.items[1].id).name !== "Bản cũ hơn");
    // bia mộ cục bộ mới hơn bản trong tệp → giữ bia mộ
    const r4 = await B.importJson(json);
    await B.remove("e1");
    const r5 = await B.importJson(json);
    kiem("item đã xoá cục bộ (bia mộ mới hơn) không bị tệp cũ làm sống lại", r5.imported === 0 && B.getSync("e1").deleted === true);
    // item sai
    const messy = { app: "code-studio", version: 1, items: [
      { id: "ok1", kind: "snippet", name: "Tốt", language: "cpp", files: [{ path: "main.cpp", content: "x" }], updatedAt: Z },
      { id: "x/y", kind: "snippet", name: "Id sai", language: "cpp", files: [{ path: "a.cpp", content: "" }], updatedAt: Z },
      { kind: "snippet", name: "Thiếu id", files: [{ path: "a.cpp", content: "" }] },
      { id: "p1", kind: "project", name: "Đường dẫn trèo", language: "cpp", files: [{ path: "../x.cpp", content: "" }], updatedAt: Z },
      { id: "p2", kind: "project", name: "Không tệp", language: "cpp", files: [], updatedAt: Z },
      { id: "p3", kind: "project", name: "Trùng tên", language: "cpp", files: [{ path: "a.cpp", content: "" }, { path: "A.CPP", content: "" }], updatedAt: Z },
      { id: "p4", kind: "snippet", name: "Bia mộ", deleted: true, files: [], updatedAt: Z },
      "không phải đối tượng", null, 42,
      { id: "ok2", kind: "snippet", name: "Hai tệp nhưng khai báo snippet", language: "cpp", files: [{ path: "a.cpp", content: "1" }, { path: "b.cpp", content: "2" }], updatedAt: Z },
      { id: "ok3", kind: "project", name: "Không updatedAt", language: "cpp", files: [{ path: "a.cpp", content: "1" }] }
    ] };
    const C = S.library({ kv: memKv(), now: () => Z + 777 });
    const r6 = await C.importJson(JSON.stringify(messy));
    kiem("item sai bị bỏ và đếm skipped (id sai, thiếu id, '..', không tệp, trùng tên, bia mộ, không phải đối tượng)", r6.imported === 3 && r6.skipped === 9, JSON.stringify(r6));
    kiem("snippet nhiều tệp được chuyển thành dự án; thiếu updatedAt → lấy giờ hiện tại", C.getSync("ok2").kind === "project" && C.getSync("ok3").updatedAt === Z + 777);
    kiem("mảng trần cũng nhập được", (await S.library({ kv: memKv() }).importJson(JSON.stringify([messy.items[0]]))).imported === 1);
    const E = S.library({ kv: memKv() });
    const msgs = [];
    for (const bad of ["{không phải json", "", "[1,2", '{"app":"khac","items":[]}', '{"app":"code-studio","version":2,"items":[]}', '{"x":1}', "123"]) {
      const e = await rej(E.importJson(bad)); msgs.push(e && /[À-ỹ]/.test(e.message) ? "ok" : "SAI:" + bad);
    }
    kiem("JSON hỏng/sai app/phiên bản mới/thiếu items → Error tiếng Việt, kho không đổi", msgs.every((x) => x === "ok") && E.listSync().length === 0, msgs.join());
    kiem("nhập BOM đầu tệp được", (await S.library({ kv: memKv() }).importJson("﻿" + json)).imported === 2);
  }

  nhom("store · library sự kiện onChange");
  {
    const lib = S.library({ kv: memKv(), now: () => Z }), ev = [];
    const off = lib.onChange((e) => ev.push(e.type + ":" + e.ids.join()));
    lib.onChange(() => { throw new Error("người nghe lỗi"); });
    await lib.put(snip("v1", "V1")); await lib.remove("v1");
    await lib.importJson(JSON.stringify({ app: "code-studio", version: 1, items: [Object.assign(snip("v2", "V2"), { updatedAt: Z })] }));
    await lib.applyRemote(Object.assign(snip("v3", "V3"), { updatedAt: Z }));
    kiem("onChange: put, remove, import, remote — người nghe lỗi không phá thư viện", bang(ev, ["put:v1", "remove:v1", "import:v2", "remote:v3"]), ev.join("|"));
    off();
    await lib.put(snip("v4", "V4"));
    kiem("hàm huỷ gỡ người nghe", ev.length === 4);
  }

  nhom("store · library dirty / markClean / applyRemote");
  {
    const clock = { t: Z }, lib = S.library({ kv: memKv(), now: () => clock.t });
    const a = await lib.put(snip("d1", "D1"));
    kiem("put đánh dấu dirty; dirty() trả bản sao theo updatedAt tăng dần", lib.dirty().length === 1 && lib.dirty()[0].id === "d1");
    kiem("markClean với updatedAt sai → vẫn dirty (false)", (await lib.markClean("d1", a.updatedAt - 1)) === false && lib.dirty().length === 1);
    clock.t += 10;
    const b = await lib.put(Object.assign({}, a, { name: "D1 sửa" }));
    kiem("markClean(bản cũ) sau khi sửa tiếp → giữ dirty (đừng mất sửa đổi trong lúc đẩy)", (await lib.markClean("d1", a.updatedAt)) === false && lib.dirty().length === 1);
    kiem("markClean(đúng updatedAt) → hết dirty (true); lần hai → false", (await lib.markClean("d1", b.updatedAt)) === true && lib.dirty().length === 0 && (await lib.markClean("d1", b.updatedAt)) === false);
    kiem("markClean id lạ → false", (await lib.markClean("zzz", 1)) === false);
    kiem("markAllDirty đánh dấu cả bia mộ, trả số item", (await lib.put(snip("d2", "D2")), await lib.remove("d2"), await lib.markAllDirty()) === 2 && lib.dirty().length === 2);
    await lib.markClean("d1", b.updatedAt); await lib.markClean("d2", lib.getSync("d2").updatedAt);

    const base = lib.getSync("d1");                                         // sạch
    const remote = (o) => Object.assign({}, P.clone(base), o);
    let r = await lib.applyRemote(remote({ id: "moi", name: "Mới", updatedAt: Z + 500 }));
    kiem("chưa có cục bộ → applied, không dirty", r === "applied" && lib.getSync("moi").name === "Mới" && !lib.dirty().some((x) => x.id === "moi"));
    r = await lib.applyRemote(remote({ name: "Từ máy chủ", updatedAt: base.updatedAt + 5 }));
    kiem("máy chủ mới hơn → applied, thay bản cục bộ", r === "applied" && lib.getSync("d1").name === "Từ máy chủ");
    r = await lib.applyRemote(remote({ name: "Từ máy chủ", updatedAt: base.updatedAt + 5 }));
    kiem("giống hệt → same", r === "same");
    // cục bộ dirty mới hơn
    clock.t += 100;
    const mine = await lib.put(Object.assign({}, lib.getSync("d1"), { name: "Của tôi" }));
    r = await lib.applyRemote(remote({ name: "Cũ hơn của máy chủ", updatedAt: mine.updatedAt - 1 }));
    kiem("cục bộ dirty mới hơn → kept-local, vẫn dirty", r === "kept-local" && lib.getSync("d1").name === "Của tôi" && lib.dirty().some((x) => x.id === "d1"));
    // cục bộ sạch nhưng mới hơn máy chủ → đánh dấu để đẩy lại (máy chủ cũ hơn)
    await lib.markClean("d1", mine.updatedAt);
    r = await lib.applyRemote(remote({ name: "Rất cũ", updatedAt: mine.updatedAt - 50 }));
    kiem("cục bộ sạch mà mới hơn máy chủ → kept-local và bị đánh dấu dirty để đẩy lại", r === "kept-local" && lib.dirty().some((x) => x.id === "d1"));
    await lib.markClean("d1", mine.updatedAt);
    // same xoá dirty
    await lib.put(Object.assign({}, lib.getSync("d1")));
    const cur = lib.getSync("d1");
    r = await lib.applyRemote(Object.assign({}, cur));
    kiem("giống hệt bản cục bộ đang dirty → same và hết dirty (máy chủ đã có đúng bản này)", r === "same" && !lib.dirty().some((x) => x.id === "d1"));
    // bia mộ
    const live = lib.getSync("d1");
    r = await lib.applyRemote({ id: "d1", kind: live.kind, name: live.name, language: live.language, files: [], meta: {}, updatedAt: live.updatedAt + 1, deleted: true });
    kiem("bia mộ mới hơn từ máy chủ → applied: cục bộ thành bia mộ, hết dirty", r === "applied" && lib.getSync("d1").deleted === true && !lib.listSync().some((x) => x.id === "d1") && !lib.dirty().some((x) => x.id === "d1"));
    const tl = lib.getSync("d1");
    r = await lib.applyRemote(Object.assign(snip("d1", "Bản sống cũ hơn bia mộ"), { updatedAt: tl.updatedAt - 1 }));
    kiem("bản sống CŨ hơn bia mộ cục bộ → kept-local (bia mộ giữ)", r === "kept-local" && lib.getSync("d1").deleted === true);
    r = await lib.applyRemote(Object.assign(snip("d1", "Sống lại"), { updatedAt: tl.updatedAt + 1 }));
    kiem("bản sống MỚI hơn bia mộ → applied, sống lại", r === "applied" && lib.getSync("d1").deleted === false && lib.getSync("d1").name === "Sống lại");
    // hoà
    const t1 = await lib.remove("d1");
    await lib.markClean("d1", t1.updatedAt);
    r = await lib.applyRemote(Object.assign(snip("d1", "Hoà, bản sống"), { updatedAt: t1.updatedAt }));
    kiem("hoà updatedAt: bia mộ cục bộ thắng bản sống → kept-local (+ dirty để máy chủ cũng hội tụ)", r === "kept-local" && lib.getSync("d1").deleted === true && lib.dirty().some((x) => x.id === "d1"));
    await lib.markClean("d1", t1.updatedAt);
    r = await lib.applyRemote({ id: "d1", kind: "snippet", name: "x", language: "cpp", files: [], meta: {}, updatedAt: t1.updatedAt, deleted: true });
    kiem("hoà, cả hai bia mộ → same", r === "same");
    const e1 = await lib.put(Object.assign(snip("h1", "Bản A"), { files: [{ path: "main.cpp", content: "A" }] }));
    await lib.markClean("h1", e1.updatedAt);
    r = await lib.applyRemote(Object.assign(snip("h1", "Bản B"), { files: [{ path: "main.cpp", content: "B" }], updatedAt: e1.updatedAt }));
    kiem("hoà updatedAt, nội dung khác: nhận bản máy chủ (máy chủ đã phân xử) để hội tụ", r === "applied" && lib.getSync("h1").files[0].content === "B" && lib.dirty().every((x) => x.id !== "h1"));
    const before = JSON.stringify(lib.listSync());
    kiem("bản ghi từ xa hỏng (không id / không phải đối tượng) → kept-local, không đổi gì", (await lib.applyRemote({ name: "x" })) === "kept-local" && (await lib.applyRemote(null)) === "kept-local" && (await lib.applyRemote("s")) === "kept-local" && JSON.stringify(lib.listSync()) === before);
    const withMeta = Object.assign(snip("h2", "Meta"), { updatedAt: Z, serverUpdatedAt: 99999, extra: "x" });
    await lib.applyRemote(withMeta);
    kiem("serverUpdatedAt và trường lạ không lọt vào item cục bộ", lib.getSync("h2").serverUpdatedAt === undefined && lib.getSync("h2").extra === undefined);
    // so sánh bỏ qua thứ tự khoá của meta (MySQL JSON xáo khoá)
    const mA = await lib.put(P.setMeta(lib.getSync("h2"), { tags: ["a"], pinned: false }));
    await lib.markClean("h2", mA.updatedAt);
    const reorder = lib.getSync("h2"); const m2 = {}; Object.keys(reorder.meta).reverse().forEach((k) => { m2[k] = reorder.meta[k]; }); reorder.meta = m2;
    kiem("meta khác thứ tự khoá vẫn là 'same'", (await lib.applyRemote(reorder)) === "same");
  }

  nhom("store · library dọn bia mộ cũ khi nạp");
  {
    const clock = { t: Z }, kv = memKv(), lib = S.library({ kv, now: () => clock.t });
    await lib.put(snip("p1", "Cũ đã đồng bộ")); await lib.remove("p1");
    await lib.put(snip("p2", "Cũ chưa đồng bộ")); await lib.remove("p2");
    await lib.put(snip("p3", "Mới")); await lib.remove("p3");
    const t1 = lib.getSync("p1").updatedAt, t3 = lib.getSync("p3").updatedAt;
    await lib.markClean("p1", t1); await lib.markClean("p3", t3);
    clock.t = Z + 130 * DAY;
    await lib.put(snip("p5", "Bình thường"));
    // p3 đã đồng bộ nhưng cũng quá 120 ngày → dọn; p2 chưa đồng bộ → giữ mãi
    const l2 = S.library({ kv, now: () => clock.t });
    await l2.ready;
    kiem("nạp lại sau 130 ngày: bia mộ đã đồng bộ cũ bị dọn, bia mộ chưa đồng bộ được giữ", l2.getSync("p1") === null && l2.getSync("p3") === null && l2.getSync("p2") && l2.getSync("p2").deleted === true && l2.getSync("p5"));
    kiem("… và khoá item tương ứng biến mất khỏi kv", !(await kv.keys("item:")).includes("item:p1"));
    clock.t = Z + 10 * DAY;
    const l3 = S.library({ kv: memKv(), now: () => clock.t });
    await l3.put(snip("q1", "Q")); await l3.remove("q1"); await l3.markClean("q1", l3.getSync("q1").updatedAt);
    const l4 = S.library({ kv: l3.kv, now: () => clock.t + 5 * DAY });
    await l4.ready;
    kiem("bia mộ mới (5 ngày) được giữ", l4.getSync("q1") && l4.getSync("q1").deleted === true);
  }

  nhom("store · library trên localStorage (giả): nạp lại giữ nguyên, đủ bộ nhớ vẫn chạy");
  {
    const st = fakeStorage(), kv = S.kv.local("cs:data:", { storage: st }), clock = { t: Z };
    const lib = S.library({ kv, now: () => clock.t });
    await lib.put(snip("l1", "Một")); await lib.put(snip("l2", "Hai")); await lib.remove("l2");
    const lib2 = S.library({ kv: S.kv.local("cs:data:", { storage: st }), now: () => clock.t });
    await lib2.ready;
    kiem("kv local: nạp lại từ localStorage", bang(names(lib2.listSync()), ["l1:Một"]) && lib2.getSync("l2").deleted === true && lib2.dirty().length === 2);
    st.flags.throwSet = true;
    const saved = await lib.put(snip("l3", "Khi đầy"));
    kiem("localStorage đầy: put vẫn thành công trong phiên, kv báo persistent false", saved.id === "l3" && lib.getSync("l3") && kv.persistent === false);
    const blocked = S.library({ kv: S.kv.local("b:", { storage: fakeStorage({ throwSet: true }) }), now: () => clock.t });
    await blocked.put(snip("b1", "Riêng tư"));
    kiem("localStorage bị chặn hẳn: thư viện vẫn chạy được", (await blocked.list()).length === 1);
  }

  /* ================================================================ sync */
  const apiBase = "http://test/api/v1";
  let seqDev = 0;
  function device(srv, o) {
    o = o || {};
    const dev = { name: o.name || "dev" + (++seqDev), clock: { t: o.t !== undefined ? o.t : Z }, kv: memKv(), srv };
    dev.now = () => dev.clock.t;
    dev.lib = S.library({ kv: dev.kv, now: dev.now });
    dev.sy = S.sync({ library: dev.lib, kv: dev.kv, fetch: srv.fetch, apiBase, backend: o.backend || "json", now: dev.now, isOnline: o.isOnline });
    dev.again = () => { dev.lib = S.library({ kv: dev.kv, now: dev.now }); dev.sy = S.sync({ library: dev.lib, kv: dev.kv, fetch: srv.fetch, apiBase, backend: o.backend || "json", now: dev.now }); return dev.sy.ready; };
    dev.edit = async (id, fn) => { const x = dev.lib.getSync(id); fn(x); return dev.lib.put(x); };
    dev.setContent = (id, content) => dev.edit(id, (x) => { x.files[0].content = content; });
    return dev;
  }
  const shape = (arr) => JSON.stringify(arr.map((x) => ({ id: x.id, name: x.name, f: x.files, u: x.updatedAt, d: x.deleted })).sort((a, b) => (a.id < b.id ? -1 : 1)));
  const same = (A, B) => shape(A.lib.listSync()) === shape(B.lib.listSync()) && shape(A.lib.listSync().concat([])) === shape(B.lib.listSync());
  async function connected(srv, o) {                                    // một thiết bị đã tạo không gian
    const A = device(srv, o); await A.sy.ready;
    await A.sy.createWorkspace();
    return A;
  }
  async function join(srv, A, o) {
    const B = device(srv, o); await B.sy.ready;
    await B.sy.connect(A.sy.workspaceId, (await A.kv.get("sync:state")).key);
    return B;
  }

  nhom("sync · chưa nối không gian = chỉ máy này");
  {
    const srv = makeServer(CS, { clock: { t: Z } }), A = device(srv);
    await A.sy.ready;
    kiem("trạng thái đầu: workspaceId rỗng, chưa nối, idle, không lỗi", A.sy.workspaceId === "" && A.sy.isConnected() === false && A.sy.status === "idle" && A.sy.lastError === "");
    await A.lib.put(snip("a1", "Một")); await A.lib.put(snip("a2", "Hai"));
    const e = await rej(A.sy.syncNow());
    kiem("syncNow khi chưa nối → từ chối code not_connected, KHÔNG gọi mạng, dữ liệu cục bộ nguyên vẹn", e && e.code === "not_connected" && srv.calls === 0 && A.lib.listSync().length === 2 && A.lib.dirty().length === 2);
    kiem("trạng thái vẫn idle (chưa nối không phải lỗi)", A.sy.status === "idle");
  }

  nhom("sync · tạo không gian, hai thiết bị cùng sửa → hội tụ");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = device(srv, { name: "A" }); await A.sy.ready;
    await A.lib.put(snip("a1", "Một", "int a1;")); await A.lib.put(snip("a2", "Hai", "int a2;")); await A.lib.put(P.createProject({ id: "p1", name: "Dự án", template: "cpp-multi" }));
    const ws = await A.sy.createWorkspace();
    kiem("createWorkspace → {workspaceId cs_…, key}; getter workspaceId, isConnected", /^cs_/.test(ws.workspaceId) && typeof ws.key === "string" && ws.key.length > 3 && A.sy.workspaceId === ws.workspaceId && A.sy.isConnected() === true);
    kiem("POST /workspaces?backend=json, không gửi khoá", srv.requests("POST", "/workspaces")[0].query.backend === "json" && srv.requests("POST", "/workspaces")[0].key === "");
    const st = await A.kv.get("sync:state");
    kiem("lưu workspaceId + key + backend vào kv", st.workspaceId === ws.workspaceId && st.key === ws.key && st.backend === "json" && st.cursor === 0);
    let r = await A.sy.syncNow();
    kiem("syncNow lần đầu: đẩy 3 item, kéo 0 (các bản của chính mình là 'same')", r.pushed === 3 && r.pulled === 0, JSON.stringify(r));
    kiem("máy chủ có đủ 3 item; thiết bị hết dirty; status idle", srv.live(ws.workspaceId).length === 3 && A.lib.dirty().length === 0 && A.sy.status === "idle" && A.sy.lastError === "");
    kiem("header X-Codestore-Key và ?backend= có ở mọi lời gọi item", srv.requests(null, "/items").every((q) => q.key === ws.key && q.query.backend === "json"));
    r = await A.sy.syncNow();
    kiem("LŨY ĐẲNG: syncNow lần hai → pushed 0, pulled 0", r.pushed === 0 && r.pulled === 0, JSON.stringify(r));
    r = await A.sy.syncNow();
    kiem("… lần ba cũng vậy, và không gửi PUT nào nữa", r.pushed === 0 && r.pulled === 0 && srv.requests("PUT", "/items").length === 1);

    // thiết bị B
    const B = device(srv, { name: "B" }); await B.sy.ready;
    const e1 = await rej(B.sy.connect(ws.workspaceId, "khoa-sai"));
    kiem("connect SAI KHOÁ → ném 'Khoá không đúng', KHÔNG lưu gì", e1 && e1.message === "Khoá không đúng" && e1.code === "codestore_bad_key" && B.sy.workspaceId === "" && B.sy.isConnected() === false && (await B.kv.get("sync:state")) === undefined);
    const e2 = await rej(B.sy.connect("cs_khong_co", "k"));
    kiem("connect mã không tồn tại → 'Không tìm thấy không gian'", e2 && e2.message === "Không tìm thấy không gian" && (await B.kv.get("sync:state")) === undefined);
    const n0 = srv.calls;
    const e3 = await rej(B.sy.connect("mã sai!", "k")), e4 = await rej(B.sy.connect(ws.workspaceId, ""));
    kiem("connect mã sai định dạng / khoá rỗng → từ chối ngay, không gọi mạng thêm", e3 && /không hợp lệ/.test(e3.message) && e4 && /khoá/.test(e4.message) && srv.calls === n0);
    await B.sy.connect(ws.workspaceId, ws.key);
    kiem("connect đúng → lưu vào kv; GET ?since=0&limit=1 để kiểm", B.sy.isConnected() && (await B.kv.get("sync:state")).key === ws.key && srv.requests("GET", "/items").slice(-1)[0].query.since === "0" && srv.requests("GET", "/items").slice(-1)[0].query.limit === "1");
    r = await B.sy.syncNow();
    kiem("B kéo về đủ 3 item giống hệt A", r.pulled === 3 && r.pushed === 0 && same(A, B) && B.lib.listSync().length === 3, JSON.stringify(r));
    kiem("B không có gì dirty sau khi kéo (item nhận về là sạch)", B.lib.dirty().length === 0);

    // sửa khác item
    A.clock.t += 1000; await A.setContent("a1", "int a1 = A;");
    B.clock.t += 2000; await B.setContent("a2", "int a2 = B;");
    await A.sy.syncNow(); await B.sy.syncNow(); await A.sy.syncNow();
    kiem("A sửa a1, B sửa a2 → cả hai thấy cả hai sửa đổi, hội tụ", A.lib.getSync("a1").files[0].content === "int a1 = A;" && A.lib.getSync("a2").files[0].content === "int a2 = B;" && same(A, B));
    // cùng item: B sửa sau
    A.clock.t += 1000; await A.setContent("a1", "bản A");
    B.clock.t += 5000; await B.setContent("a1", "bản B (sau)");
    await A.sy.syncNow(); await B.sy.syncNow(); await A.sy.syncNow();
    kiem("cùng một item sửa ở hai máy → bản sửa SAU thắng ở cả hai máy", A.lib.getSync("a1").files[0].content === "bản B (sau)" && same(A, B));
    // sửa dự án nhiều tệp, thêm tệp
    A.clock.t += 9000;
    await A.lib.put(P.addFile(A.lib.getSync("p1"), "src/extra.cpp", "// thêm"));
    await A.sy.syncNow(); await B.sy.syncNow();
    kiem("thêm tệp vào dự án ở A → B nhận đủ 6 tệp, đường dẫn thư mục đúng", B.lib.getSync("p1").files.length === 6 && B.lib.getSync("p1").files.some((f) => f.path === "src/extra.cpp") && same(A, B));
    for (const d of [A, B]) { const x = await d.sy.syncNow(); if (x.pushed || x.pulled) kiem("lũy đẳng sau hội tụ", false, JSON.stringify(x)); }
    kiem("sau hội tụ, đồng bộ tiếp không còn gì để đẩy/kéo", true);
  }

  nhom("sync · xoá lan sang thiết bị kia; bia mộ vs sửa cũ/mới");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = await connected(srv, { name: "A" });
    for (const id of ["x1", "x2", "x3", "x4"]) await A.lib.put(snip(id, "Item " + id, "// " + id));
    await A.sy.syncNow();
    const B = await join(srv, A, { name: "B" });
    await B.sy.syncNow();
    kiem("tiền đề: B có 4 item", B.lib.listSync().length === 4);
    A.clock.t += 1000; await A.lib.remove("x1");
    await A.sy.syncNow(); await B.sy.syncNow();
    kiem("xoá ở A → B: list không còn, get là bia mộ, máy chủ giữ bia mộ bỏ files/meta", B.lib.getSync("x1").deleted === true && !B.lib.listSync().some((x) => x.id === "x1") && srv.snapshot(A.sy.workspaceId).find((x) => x.id === "x1").deleted === true && srv.snapshot(A.sy.workspaceId).find((x) => x.id === "x1").files.length === 0);
    // sửa CŨ hơn bia mộ
    A.clock.t = Z + 100000; await A.lib.remove("x2");
    B.clock.t = Z + 50000; await B.setContent("x2", "// sửa cũ hơn bia mộ");
    await A.sy.syncNow();
    const rB = await B.sy.syncNow();
    kiem("B sửa x2 ở thời điểm CŨ hơn bia mộ → bị bỏ: B nhận bia mộ, hết dirty, máy chủ vẫn là bia mộ", B.lib.getSync("x2").deleted === true && B.lib.dirty().length === 0 && srv.snapshot(A.sy.workspaceId).find((x) => x.id === "x2").deleted === true && rB.pushed === 1, JSON.stringify(rB));
    // sửa MỚI hơn bia mộ → sống lại
    A.clock.t = Z + 200000; await A.lib.remove("x3"); await A.sy.syncNow();
    B.clock.t = Z + 300000; await B.setContent("x3", "// sửa mới hơn bia mộ → sống lại");
    await B.sy.syncNow(); await A.sy.syncNow();
    kiem("B sửa x3 MỚI hơn bia mộ → sống lại trên máy chủ và ở A", A.lib.getSync("x3").deleted === false && A.lib.getSync("x3").files[0].content.indexOf("sống lại") > 0 && srv.live(A.sy.workspaceId).some((x) => x.id === "x3"));
    // xoá ở cả hai máy
    A.clock.t = Z + 400000; await A.lib.remove("x4");
    B.clock.t = Z + 400000; await B.lib.remove("x4");
    await A.sy.syncNow(); await B.sy.syncNow(); await A.sy.syncNow();
    kiem("cùng xoá một item ở hai máy: hội tụ, không lỗi", A.lib.getSync("x4").deleted && B.lib.getSync("x4").deleted && same(A, B));
    // xoá ở A, sửa ở B (B chưa biết) rồi B đồng bộ trước
    const C = await connected(srv, { name: "C" });
    await C.lib.put(snip("y1", "Y1")); await C.sy.syncNow();
    const D = await join(srv, C, { name: "D" }); await D.sy.syncNow();
    D.clock.t = Z + 500000; await D.setContent("y1", "// D sửa trước");
    C.clock.t = Z + 600000; await C.lib.remove("y1");
    await D.sy.syncNow(); await C.sy.syncNow(); await D.sy.syncNow();
    kiem("D sửa (cũ hơn) rồi C xoá (mới hơn), D đồng bộ trước: cuối cùng cả hai thấy bia mộ", C.lib.getSync("y1").deleted && D.lib.getSync("y1").deleted && same(C, D));
  }

  nhom("sync · phân trang (more:true) và con trỏ");
  {
    const srv = makeServer(CS, { clock: { t: Z }, pageItems: 3 });
    const A = await connected(srv, { name: "A" });
    for (let i = 0; i < 10; i++) { A.clock.t += 5; await A.lib.put(snip("pg" + i, "P" + i, "// " + i)); }
    await A.sy.syncNow();
    const B = await join(srv, A, { name: "B" });
    const g0 = srv.requests("GET", "/items").length;
    const r = await B.sy.syncNow();
    const gets = srv.requests("GET", "/items").slice(g0);
    const sinces = gets.map((q) => Number(q.query.since));
    kiem("kéo 10 item với trang 3 → đủ 10, ≥ 4 lượt GET", r.pulled === 10 && B.lib.listSync().length === 10 && gets.length >= 4, JSON.stringify([r, gets.length]));
    kiem("con trỏ since tăng nghiêm ngặt qua các trang (since đầu = 0)", sinces[0] === 0 && sinces.every((v, i) => !i || v > sinces[i - 1]), sinces.join());
    kiem("mọi lượt đều gửi limit=200 (tối đa cho phép)", gets.every((q) => q.query.limit === "200"));
    const cursor = (await B.kv.get("sync:state")).cursor;
    kiem("con trỏ cuối được lưu và không lùi (≥ since cuối cùng đã gửi)", cursor > 0 && cursor >= sinces[sinces.length - 1]);
    const r2 = await B.sy.syncNow();
    kiem("đồng bộ tiếp theo dùng since = con trỏ đã lưu; không gì đổi", Number(srv.requests("GET", "/items").slice(-1)[0].query.since) === cursor && r2.pulled === 0 && r2.pushed === 0);
    // một trang lỗi giữa chừng: giữ tiến độ
    const C = await join(srv, A, { name: "C" });
    srv.failWhen((q) => q.method === "GET" && /since=\d+/.test(q.url) && Number(new URL(q.url).searchParams.get("since")) > 0, "network", 1);
    const e = await rej(C.sy.syncNow());
    kiem("mất mạng ở trang thứ hai → offline; các trang đã nhận được giữ lại, con trỏ đã tiến", e && e.code === "offline" && C.lib.listSync().length === 3 && (await C.kv.get("sync:state")).cursor > 0, e && e.message);
    const r3 = await C.sy.syncNow();
    kiem("thử lại: kéo nốt phần còn lại, tổng đủ 10", C.lib.listSync().length === 10 && r3.pulled === 7, JSON.stringify(r3));
    // con trỏ không tiến → không lặp vô hạn
    const bad = makeServer(CS, { clock: { t: Z } }), X = await connected(bad, { name: "X" });
    bad.failWhen((q) => q.method === "GET", (q) => bad.res(200, { items: [], serverTime: 5, more: true }), Infinity);
    X.kv.set("sync:state", Object.assign(await X.kv.get("sync:state"), { cursor: 10 }));
    await X.again();
    const eLoop = await rej(X.sy.syncNow());
    kiem("máy chủ trả more:true mà con trỏ không tiến → dừng với lỗi, không vòng lặp vô hạn", eLoop && eLoop.code === "bad_response" && bad.requests("GET", "/items").length <= 3);
  }

  nhom("sync · lỗi 401 / 404 / 429 / 5xx / mạng / đồng hồ — không mất dữ liệu cục bộ");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = await connected(srv, { name: "A" }), wsId = A.sy.workspaceId;
    await A.lib.put(snip("k1", "K1")); await A.sy.syncNow();
    const key0 = srv.workspaces.get("json/" + wsId).key;
    const log = [];
    A.sy.onStatus((s, e) => log.push(s + (e ? "(" + e + ")" : "")));

    // 401
    srv.workspaces.get("json/" + wsId).key = "da-doi-khoa";
    A.clock.t += 100; await A.setContent("k1", "// sửa khi khoá sai");
    let e = await rej(A.sy.syncNow());
    kiem("401: ném 'Khoá không đúng', status error, lastError, mục đã sửa vẫn dirty và nội dung còn nguyên", e && e.message === "Khoá không đúng" && e.status === 401 && e.code === "codestore_bad_key" && A.sy.status === "error" && A.sy.lastError === "Khoá không đúng" && A.lib.dirty().length === 1 && A.lib.getSync("k1").files[0].content === "// sửa khi khoá sai");
    srv.workspaces.get("json/" + wsId).key = key0;
    let r = await A.sy.syncNow();
    kiem("khoá đúng lại → đẩy được bản sửa đã chờ, status idle, lastError xoá", r.pushed === 1 && A.sy.status === "idle" && A.sy.lastError === "" && srv.live(wsId).find((x) => x.id === "k1").files[0].content === "// sửa khi khoá sai");

    // 401 thiếu khoá (khoá rỗng trong kv) — message khác
    // 404
    A.clock.t += 100; await A.setContent("k1", "// sửa khi không gian mất");
    const saved = srv.workspaces.get("json/" + wsId);
    srv.workspaces.delete("json/" + wsId);
    e = await rej(A.sy.syncNow());
    kiem("404: 'Không tìm thấy không gian'; dữ liệu cục bộ và dirty còn nguyên", e && e.message === "Không tìm thấy không gian" && e.status === 404 && A.sy.status === "error" && A.lib.dirty().length === 1);
    srv.workspaces.set("json/" + wsId, saved);
    await A.sy.syncNow();

    // 429 + Retry-After
    A.clock.t += 100; await A.setContent("k1", "// sửa khi bị chặn tốc độ");
    srv.failNext(1, { status: 429, code: "codestore_rate_limited", message: "Nhập sai khoá quá nhiều lần", headers: { "Retry-After": "7" }, data: { retryAfter: 7 } });
    e = await rej(A.sy.syncNow());
    kiem("429: 'Gửi quá nhanh, thử lại sau 7 giây' (đọc Retry-After), status error", e && e.message === "Gửi quá nhanh, thử lại sau 7 giây" && e.retryAfter === 7 && A.sy.status === "error" && A.sy.lastError === "Gửi quá nhanh, thử lại sau 7 giây");
    const calls = srv.calls;
    A.clock.t += 3000;
    const e2 = await rej(A.sy.syncNow());
    kiem("trong thời gian chờ: syncNow từ chối ngay, KHÔNG gọi mạng, báo số giây còn lại", e2 && /thử lại sau 4 giây/.test(e2.message) && srv.calls === calls, e2 && e2.message);
    A.clock.t += 5000;
    r = await A.sy.syncNow();
    kiem("hết thời gian chờ → đồng bộ lại bình thường", r.pushed === 1 && A.sy.status === "idle" && A.lib.dirty().length === 0);
    // 429 chỉ có data.retryAfter (không header)
    srv.failNext(1, { status: 429, code: "codestore_rate_limited", data: { retryAfter: 12 } });
    A.clock.t += 10; await A.setContent("k1", "x");
    e = await rej(A.sy.syncNow());
    kiem("429 không header: đọc data.retryAfter", e && e.message === "Gửi quá nhanh, thử lại sau 12 giây");
    A.clock.t += 13000; await A.sy.syncNow();
    srv.failNext(1, { status: 429 });
    A.clock.t += 10; await A.setContent("k1", "y");
    e = await rej(A.sy.syncNow());
    kiem("429 không biết bao lâu → thông báo chung", e && /Gửi quá nhanh/.test(e.message) && !/\d+ giây/.test(e.message));
    await A.sy.syncNow();

    // 5xx
    A.clock.t += 100; await A.setContent("k1", "// sửa khi máy chủ lỗi");
    srv.failNext(1, { status: 500 });
    e = await rej(A.sy.syncNow());
    kiem("500: status error, thông báo có HTTP 500, dirty còn", e && /HTTP 500/.test(e.message) && A.sy.status === "error" && A.lib.dirty().length === 1);
    srv.failNext(1, { status: 503, code: "codestore_backend_unavailable", message: "Kho MongoDB chưa được cấu hình trên máy chủ này" });
    e = await rej(A.sy.syncNow());
    kiem("503 backend_unavailable: nói rõ kho chưa dùng được", e && e.code === "codestore_backend_unavailable" && /chưa dùng được/.test(e.message));
    srv.failNext(1, () => ({ status: 502, ok: false, headers: { get: () => null }, text: async () => "<html>Bad gateway</html>", json: async () => { throw new Error("x"); } }));
    e = await rej(A.sy.syncNow());
    kiem("502 với thân không phải JSON: vẫn ra lỗi sạch, không ném lỗi phân tích", e && /HTTP 502/.test(e.message) && A.sy.status === "error");
    r = await A.sy.syncNow();
    kiem("hết lỗi máy chủ → đồng bộ được", r.pushed === 1 && A.sy.status === "idle");

    // mạng
    A.clock.t += 100; await A.setContent("k1", "// sửa khi mất mạng");
    srv.offline = true;
    e = await rej(A.sy.syncNow());
    kiem("fetch ném TypeError → status offline, lỗi code offline, dirty còn, nội dung còn", e && e.code === "offline" && A.sy.status === "offline" && /mạng/.test(A.sy.lastError) && A.lib.dirty().length === 1 && A.lib.getSync("k1").files[0].content === "// sửa khi mất mạng");
    srv.offline = false;
    r = await A.sy.syncNow();
    kiem("có mạng lại → thử lại được, status idle", r.pushed === 1 && A.sy.status === "idle");
    // navigator.onLine === false
    let online = true;
    const off = device(srv, { name: "Off", isOnline: () => online }); await off.sy.ready;
    await off.sy.connect(wsId, key0);
    online = false;
    const c0 = srv.calls;
    const e3 = await rej(off.sy.syncNow());
    kiem("isOnline() = false (navigator.onLine === false) → offline NGAY, không gọi fetch", e3 && e3.code === "offline" && off.sy.status === "offline" && srv.calls === c0, "calls " + (srv.calls - c0));
    // mạng đứt sau khi PUT đã xong
    A.clock.t += 100; await A.setContent("k1", "// PUT xong rồi mất mạng");
    srv.failWhen((q) => q.method === "GET", "network", 1);
    const cur0 = (await A.kv.get("sync:state")).cursor;
    e = await rej(A.sy.syncNow());
    kiem("PUT xong rồi GET mất mạng: bản đã đẩy đã sạch (không đẩy lại), con trỏ chưa tiến", e && e.code === "offline" && A.lib.dirty().length === 0 && (await A.kv.get("sync:state")).cursor === cur0 && srv.live(wsId).find((x) => x.id === "k1").files[0].content === "// PUT xong rồi mất mạng");
    r = await A.sy.syncNow();
    kiem("thử lại: pushed 0, con trỏ tiến", r.pushed === 0 && (await A.kv.get("sync:state")).cursor > cur0);

    // đồng hồ lệch
    const sane = A.clock.t;                                           // giờ đúng lần cuối (giờ thật chỉ tiến, không lùi)
    A.clock.t = sane + 3 * DAY;
    await A.setContent("k1", "// sửa khi đồng hồ lệch 3 ngày");
    const futureStamp = A.lib.getSync("k1").updatedAt;
    e = await rej(A.sy.syncNow());
    kiem("đồng hồ lệch > 1 ngày: 'Đồng hồ máy lệch quá 1 ngày', code codestore_bad_clock, dữ liệu cục bộ còn", e && e.code === "codestore_bad_clock" && /Đồng hồ máy lệch quá 1 ngày/.test(e.message) && A.sy.lastError === e.message && A.lib.dirty().length === 1 && A.lib.getSync("k1").files[0].content.indexOf("lệch 3 ngày") > 0);
    A.clock.t = sane + 2000;                                          // đã chỉnh lại giờ
    r = await A.sy.syncNow();
    kiem("chỉnh lại giờ nhưng mục còn mang dấu thời gian tương lai: bị loại có lời nhắn rõ, KHÔNG làm kẹt đồng bộ", r.pushed === 0 && r.skipped.length === 1 && /tương lai/.test(A.sy.lastError) && A.sy.status === "error", A.sy.lastError);
    await A.setContent("k1", "// sửa lại sau khi chỉnh giờ");
    kiem("sửa lại mục kẹt: dấu thời gian lấy giờ máy (không kẹt vì ratchet cũ+1)", A.lib.getSync("k1").updatedAt < futureStamp && A.lib.getSync("k1").updatedAt <= A.clock.t + 1);
    r = await A.sy.syncNow();
    kiem("… và đồng bộ được ngay", r.pushed === 1 && A.sy.status === "idle" && srv.live(wsId).find((x) => x.id === "k1").files[0].content === "// sửa lại sau khi chỉnh giờ");
    kiem("onStatus ghi nhận đủ chuỗi syncing/error/offline/idle", ["syncing", "error(Khoá không đúng)", "offline", "idle"].every((s) => log.some((x) => x.indexOf(s.split("(")[0]) === 0)), log.join(" | "));
  }

  nhom("sync · item quá lớn / không hợp lệ / bị máy chủ từ chối không làm hỏng lô");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = await connected(srv, { name: "A" }), wsId = A.sy.workspaceId;
    await A.lib.put(snip("s1", "Nhỏ 1")); await A.lib.put(snip("s2", "Nhỏ 2")); await A.lib.put(snip("s3", "Nhỏ 3"));
    await A.lib.put(snip("big", "Khổng lồ", "x".repeat(600 * 1024)));
    const r = await A.sy.syncNow();
    kiem("item > 512 KB bị bỏ khỏi lô, 3 item còn lại vẫn lên máy chủ (resolve, không ném)", r.pushed === 3 && r.skipped.length === 1 && r.skipped[0].id === "big" && srv.live(wsId).length === 3);
    kiem('lỗi riêng: item "Khổng lồ" quá lớn; status error; item vẫn còn trong dirty', /item "Khổng lồ" quá lớn/.test(A.sy.lastError) && A.sy.status === "error" && A.lib.dirty().map((x) => x.id).join() === "big");
    kiem("không có lời gọi PUT nào chứa item quá lớn", srv.requests("PUT", "/items").every((q) => q.ids.indexOf("big") < 0));
    const r2 = await A.sy.syncNow();
    kiem("đồng bộ lại: vẫn báo, không gửi lại item quá lớn, không lỗi ném ra", r2.pushed === 0 && r2.skipped.length === 1 && srv.requests("PUT", "/items").length === 1);
    await A.setContent("big", "đã thu nhỏ");
    const r3 = await A.sy.syncNow();
    kiem("sửa nhỏ lại → đồng bộ được, hết lỗi", r3.pushed === 1 && A.sy.status === "idle" && A.sy.lastError === "" && srv.live(wsId).length === 4);

    // máy chủ từ chối một item (bad_item) → loại item đó và gửi lại phần còn lại
    srv.rejectIds.add("bad1");
    await A.lib.put(snip("ok1", "OK1")); await A.lib.put(snip("bad1", "Bị từ chối")); await A.lib.put(snip("ok2", "OK2"));
    const p0 = srv.requests("PUT", "/items").length;
    const r4 = await A.sy.syncNow();
    kiem("máy chủ từ chối cả lô vì một item (bad_item + itemId) → loại item đó, gửi lại phần còn lại", r4.pushed === 2 && r4.skipped.length === 1 && r4.skipped[0].id === "bad1" && srv.live(wsId).some((x) => x.id === "ok2") && !srv.live(wsId).some((x) => x.id === "bad1"));
    kiem("đúng 2 lượt PUT (không thử lại vô ích), lời nhắn nêu máy chủ từ chối", srv.requests("PUT", "/items").length - p0 === 2 && /máy chủ từ chối/.test(A.sy.lastError) && A.lib.dirty().map((x) => x.id).join() === "bad1");
    srv.rejectIds.clear();

    // item không hợp lệ theo CS.project.validate (đường dẫn trèo ra ngoài vì lọt vào bằng nhập khẩu hỏng)
    const bad = A.lib.getSync("ok1"); bad.files = [{ path: "a/../b.cpp", content: "x" }];
    await A.lib.put(Object.assign({}, bad));
    const r5 = await A.sy.syncNow();
    kiem("item có đường dẫn sai bị loại trước khi gửi (validate), không làm hỏng lô", r5.skipped.some((s) => s.id === "ok1" && /không hợp lệ/.test(s.reason)) && srv.requests("PUT", "/items").slice(-1)[0].ids.indexOf("ok1") < 0);
  }

  nhom("sync · chia lô (≤ 100 item, ≤ ~1,8 MB)");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = await connected(srv, { name: "A" }), wsId = A.sy.workspaceId;
    for (let i = 0; i < 250; i++) await A.lib.put(snip("b" + String(i).padStart(3, "0"), "B" + i, "// " + i));
    const r = await A.sy.syncNow();
    const puts = srv.requests("PUT", "/items");
    kiem("250 item → 3 lượt PUT (100, 100, 50); máy chủ có đủ 250", r.pushed === 250 && puts.length === 3 && puts.map((q) => q.ids.length).join() === "100,100,50" && srv.live(wsId).length === 250, puts.map((q) => q.ids.length).join());
    kiem("không item nào gửi hai lần", new Set(puts.flatMap((q) => q.ids)).size === 250);
    const B = device(srv, { name: "B" }); await B.sy.ready;
    await B.sy.connect(wsId, (await A.kv.get("sync:state")).key);
    const r2 = await B.sy.syncNow();
    kiem("thiết bị khác kéo đủ 250 (một trang 200 + trang kế)", r2.pulled === 250 && B.lib.listSync().length === 250 && srv.requests("GET", "/items").length >= 3);

    const srv2 = makeServer(CS, { clock: { t: Z } });
    const C = await connected(srv2, { name: "C" });
    for (let i = 0; i < 5; i++) await C.lib.put(snip("m" + i, "Lớn " + i, String(i).repeat(400 * 1024)));
    const r3 = await C.sy.syncNow();
    const p2 = srv2.requests("PUT", "/items");
    kiem("5 item ~400 KB (tổng 2 MB > 1,8 MB) → tách 2 lượt PUT (4 + 1), không bị 'quá lớn'", r3.pushed === 5 && p2.length === 2 && p2.map((q) => q.ids.length).join() === "4,1" && srv2.live(C.sy.workspaceId).length === 5, p2.map((q) => q.ids.length).join());

    // máy chủ vẫn nói 'quá lớn' → chia đôi
    const srv3 = makeServer(CS, { clock: { t: Z } });
    const D = await connected(srv3, { name: "D" });
    for (let i = 0; i < 6; i++) await D.lib.put(snip("c" + i, "C" + i));
    srv3.failWhen((q) => q.method === "PUT" && q.body.items.length > 2, { status: 400, code: "codestore_too_large", message: "Yêu cầu quá lớn" });
    const r4 = await D.sy.syncNow();
    kiem("máy chủ báo codestore_too_large → chia đôi lô rồi gửi lại tới khi vừa", r4.pushed === 6 && srv3.live(D.sy.workspaceId).length === 6);
  }

  nhom("sync · giới hạn hạn mức, backend, nhiều kho");
  {
    const srv = makeServer(CS, { clock: { t: Z }, maxItems: 2 });
    const A = await connected(srv, { name: "A" });
    for (let i = 0; i < 3; i++) await A.lib.put(snip("f" + i, "F" + i));
    const e = await rej(A.sy.syncNow());
    kiem("không gian đầy: lỗi rõ 'đã đầy', dữ liệu cục bộ còn đủ 3 và vẫn dirty", e && e.code === "codestore_workspace_full" && /đã đầy/.test(e.message) && A.lib.listSync().length === 3 && A.lib.dirty().length === 3);

    const s2 = makeServer(CS, { clock: { t: Z } });
    const M = device(s2, { name: "M", backend: "mysql" }); await M.sy.ready;
    await M.lib.put(snip("m1", "Trên MySQL"));
    await M.sy.createWorkspace();
    await M.sy.syncNow();
    kiem("createWorkspace và mọi lời gọi item dùng ?backend=mysql; kho mysql có dữ liệu, kho json thì không", s2.requests("POST", "/workspaces")[0].query.backend === "mysql" && s2.requests(null, "/items").every((q) => q.query.backend === "mysql") && s2.live(M.sy.workspaceId, "mysql").length === 1 && s2.snapshot(M.sy.workspaceId, "json") === null);
    const J = device(s2, { name: "J", backend: "json" }); await J.sy.ready;
    const e2 = await rej(J.sy.connect(M.sy.workspaceId, (await M.kv.get("sync:state")).key));
    kiem("nối cùng mã + khoá nhưng CHỌN KHO KHÁC → 'Không tìm thấy không gian' (mỗi kho một nơi riêng)", e2 && e2.message === "Không tìm thấy không gian");
    const K = device(s2, { name: "K", backend: "mysql" }); await K.sy.ready;
    await K.sy.connect(M.sy.workspaceId, (await M.kv.get("sync:state")).key);
    await K.sy.syncNow();
    kiem("chọn đúng kho mysql → nối và kéo được", K.lib.getSync("m1") && K.lib.getSync("m1").name === "Trên MySQL" && K.sy.backend === "mysql");
    const b = await K.sy.backends();
    kiem("backends(): {default, backends:[{id,label,available,reason,persistent}]}, gọi không khoá và không ?backend=", b.default === "json" && b.backends.length === 3 && b.backends.every((x) => "id" in x && "available" in x && "reason" in x && "persistent" in x) && s2.requests("GET", "/backends").slice(-1)[0].key === "" && s2.requests("GET", "/backends").slice(-1)[0].query.backend === undefined);
    const mg = device(s2, { name: "Mg", backend: "mongo" }); await mg.sy.ready;
    const e3 = await rej(mg.sy.createWorkspace());
    kiem("tạo không gian ở kho chưa cấu hình → code codestore_backend_unavailable, không lưu gì", e3 && e3.code === "codestore_backend_unavailable" && /chưa dùng được/.test(e3.message) && mg.sy.isConnected() === false && (await mg.kv.get("sync:state")) === undefined);
    // kho đã lưu thắng tuỳ chọn
    const K2 = device(s2, { name: "K2", backend: "json" }); K2.kv = K.kv;
    const lib2 = S.library({ kv: K.kv, now: K.now }), sy2 = S.sync({ library: lib2, kv: K.kv, fetch: s2.fetch, apiBase, backend: "json", now: K.now });
    await sy2.ready;
    kiem("kv đã nối ở kho mysql: tuỳ chọn backend:'json' bị bỏ qua (kho lưu trong kv thắng)", sy2.backend === "mysql" && sy2.workspaceId === K.sy.workspaceId);
  }

  nhom("sync · nối lại, ngắt, lưu qua phiên, chống chạy chồng");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = await connected(srv, { name: "A" }), wsId = A.sy.workspaceId;
    await A.lib.put(snip("n1", "N1")); await A.lib.put(snip("n2", "N2"));
    await A.sy.syncNow();
    const cur = (await A.kv.get("sync:state")).cursor;
    await A.again();
    kiem("phiên mới trên cùng kv: nhớ không gian + khoá + kho + con trỏ", A.sy.workspaceId === wsId && A.sy.isConnected() && (await A.kv.get("sync:state")).cursor === cur);
    await A.sy.syncNow();
    kiem("… đồng bộ tiếp bằng since = con trỏ đã lưu", Number(srv.requests("GET", "/items").slice(-1)[0].query.since) === cur);

    // B có sẵn dữ liệu cục bộ trước khi nối
    const B = device(srv, { name: "B" }); await B.sy.ready;
    await B.lib.put(snip("local1", "Có sẵn 1")); await B.lib.put(snip("local2", "Có sẵn 2"));
    await B.sy.connect(wsId, (await A.kv.get("sync:state")).key);
    const rB = await B.sy.syncNow();
    kiem("nối vào không gian có sẵn: mục cục bộ có từ trước được ĐẨY LÊN (mọi item bị đánh dấu dirty khi nối), đồng thời kéo n1,n2", rB.pushed === 2 && rB.pulled === 2 && B.lib.listSync().length === 4 && srv.live(wsId).length === 4, JSON.stringify(rB));
    await A.sy.syncNow();
    kiem("A nhận 2 mục của B → hội tụ", A.lib.listSync().length === 4 && same(A, B));

    // ngắt: giữ dữ liệu cục bộ
    const before = shape(B.lib.listSync());
    await B.sy.disconnect();
    kiem("disconnect: xoá mã+khoá khỏi kv, isConnected false, workspaceId rỗng, GIỮ nguyên dữ liệu cục bộ", B.sy.isConnected() === false && B.sy.workspaceId === "" && (await B.kv.get("sync:state")) === undefined && shape(B.lib.listSync()) === before && B.lib.listSync().length === 4);
    const e = await rej(B.sy.syncNow());
    kiem("sau khi ngắt, syncNow → not_connected, không gọi mạng", e && e.code === "not_connected");
    await B.lib.put(snip("local3", "Sau khi ngắt"));
    kiem("sau khi ngắt vẫn dùng bình thường như 'chỉ máy này'", B.lib.listSync().length === 5);
    await B.again();
    kiem("phiên mới sau khi ngắt: vẫn không nối", B.sy.isConnected() === false);
    await B.sy.connect(wsId, (await A.kv.get("sync:state")).key);
    const r2 = await B.sy.syncNow();
    kiem("nối lại: đẩy lại mọi thứ (máy chủ gộp lũy đẳng) và nhận mục sau khi ngắt", r2.pushed === 5 && srv.live(wsId).length === 5 && srv.live(wsId).some((x) => x.id === "local3"));

    // chống chạy chồng
    const C = await join(srv, A, { name: "C" });
    const g0 = srv.calls;
    const p1 = C.sy.syncNow(), p2 = C.sy.syncNow(), p3 = C.sy.syncNow();
    const [r1, r2b] = await Promise.all([p1, p2, p3]);
    kiem("gọi syncNow khi đang đồng bộ → dùng lại ĐÚNG Promise đang chạy; chỉ một lượt kéo", p1 === p2 && p2 === p3 && r1 === r2b && srv.calls - g0 === 1 && C.lib.listSync().length === 5, "calls " + (srv.calls - g0));
    kiem("xong thì syncNow tiếp theo là lượt mới", C.sy.syncNow() !== p1);
    await C.sy.syncNow();
    // sửa trong lúc đang đồng bộ → lượt bổ sung
    await C.lib.put(snip("w1", "W1"));
    let injected = false;
    srv.failWhen((q) => q.method === "PUT" && !injected, (q) => { injected = true; C.lib.put(snip("w2", "Sửa trong lúc đồng bộ")); return undefined; }, 1);
    await C.sy.syncNow();
    kiem("sửa thêm TRONG lúc đang đồng bộ → bị nhặt ở lượt bổ sung của cùng lần gọi (không bỏ sót)", injected && srv.live(wsId).some((x) => x.id === "w2") && C.lib.dirty().length === 0);
  }

  nhom("sync · bản máy chủ đang giữ (PUT trả về) được nhận; hoà updatedAt");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = await connected(srv, { name: "A" }), wsId = A.sy.workspaceId;
    await A.lib.put(snip("i1", "I1", "gốc")); await A.sy.syncNow();
    const B = await join(srv, A, { name: "B" }); await B.sy.syncNow();
    A.clock.t = Z + 90000; await A.setContent("i1", "A sửa muộn");
    B.clock.t = Z + 40000; await B.setContent("i1", "B sửa sớm");
    await A.sy.syncNow();
    const r = await B.sy.syncNow();
    kiem("B đẩy bản CŨ hơn: máy chủ giữ bản của A, trả về → B nhận ngay; hết dirty; không đẩy lại", B.lib.getSync("i1").files[0].content === "A sửa muộn" && B.lib.dirty().length === 0 && r.pulled >= 1 && srv.requests("PUT", "/items").length === 3, JSON.stringify(r));
    // hoà updatedAt, nội dung khác
    A.clock.t = Z + 200000; B.clock.t = Z + 200000;
    await A.setContent("i1", "hoà A"); await B.setContent("i1", "hoà B");
    await A.sy.syncNow(); await B.sy.syncNow(); await A.sy.syncNow();
    kiem("hoà updatedAt, nội dung khác: máy chủ giữ bản đến trước (A) → mọi thiết bị hội tụ về bản đó", A.lib.getSync("i1").files[0].content === "hoà A" && B.lib.getSync("i1").files[0].content === "hoà A" && B.lib.dirty().length === 0 && A.lib.dirty().length === 0 && same(A, B));
    // hoà: xoá vs sửa
    A.clock.t = Z + 300000; B.clock.t = Z + 300000;
    await A.setContent("i1", "sửa hoà xoá"); await B.lib.remove("i1");
    await A.sy.syncNow(); await B.sy.syncNow(); await A.sy.syncNow();
    kiem("hoà updatedAt giữa sửa và xoá: bia mộ thắng ở mọi nơi", A.lib.getSync("i1").deleted && B.lib.getSync("i1").deleted && srv.snapshot(wsId).find((x) => x.id === "i1").deleted === true);
    // máy chủ trả bản quá nhiều: không mất bản cục bộ dirty mới hơn trong lúc đẩy
    const C = await join(srv, A, { name: "C" }); await C.sy.syncNow();
    await C.lib.put(snip("race", "Đua")); C.clock.t += 5;
    let bumped = false;
    srv.failWhen((q) => q.method === "PUT" && !bumped, (q) => { bumped = true; C.clock.t += 1000; C.setContent("race", "SỬA SAU KHI ĐÃ GỬI"); return undefined; }, 1);
    await C.sy.syncNow();
    kiem("sửa tiếp item ngay trong lúc nó đang được đẩy: bản sửa mới KHÔNG bị markClean/ghi đè, được đẩy ở lượt kế", bumped && C.lib.getSync("race").files[0].content === "SỬA SAU KHI ĐÃ GỬI" && srv.live(wsId).find((x) => x.id === "race").files[0].content === "SỬA SAU KHI ĐÃ GỬI" && C.lib.dirty().length === 0);
  }

  nhom("sync · onStatus, dispose, ready");
  {
    const srv = makeServer(CS, { clock: { t: Z } });
    const A = await connected(srv, { name: "A" });
    await A.lib.put(snip("o1", "O1"));
    const seen = [], off = A.sy.onStatus((s, e) => seen.push(s));
    await A.sy.syncNow();
    kiem("onStatus: syncing rồi idle", bang(seen, ["syncing", "idle"]), seen.join());
    off(); seen.length = 0;
    await A.lib.put(snip("o2", "O2")); await A.sy.syncNow();
    kiem("hàm huỷ onStatus gỡ người nghe", seen.length === 0);
    A.sy.onStatus(() => { throw new Error("người nghe lỗi"); });
    kiem("người nghe onStatus ném lỗi không phá đồng bộ", (await rej((A.lib.put(snip("o3", "O3")), A.sy.syncNow()))) === null);
    A.sy.dispose();
    const e = await rej(A.sy.syncNow());
    kiem("dispose: syncNow bị từ chối (code disposed)", e && e.code === "disposed");
    const E = S.sync({ library: A.lib, kv: A.kv, fetch: srv.fetch, apiBase: apiBase + "/", backend: "json", now: A.now });
    await E.ready;
    kiem("apiBase có dấu / thừa vẫn đúng; ready nạp lại kết nối từ kv", E.workspaceId === A.sy.workspaceId && (await E.syncNow()).pushed === 0 && /^http:\/\/test\/api\/v1\/codestore\/cs_/.test(srv.lastUrl));
    const e2 = await rej((async () => S.sync({}))());
    kiem("thiếu library → ném lỗi rõ ràng", e2 && /library/.test(e2.message));
  }
};
