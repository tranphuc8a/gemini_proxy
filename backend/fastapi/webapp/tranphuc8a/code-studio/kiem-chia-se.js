/* Kiểm liên kết chia sẻ chỉ đọc: đoạn "#" của địa chỉ (core/share.js), biến bản chia sẻ thành mục thư viện mới,
   và phần HTTP trong core/store.js (readShared công khai; sync.share/shares/unshare có khoá) bằng fetch GIẢ.
   Hợp đồng máy chủ thật được kiểm ở kiem-tich-hop.js (backend thật) và pytest. Được kiem.js nạp. */
"use strict";

const resp = (status, body, headers) => {
  const h = {}; Object.keys(headers || {}).forEach((k) => { h[k.toLowerCase()] = headers[k]; });
  return { status, ok: status >= 200 && status < 300, headers: { get: (k) => (k.toLowerCase() in h ? h[k.toLowerCase()] : null) }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) };
};
const fakeFetch = (handler) => { const f = (url, init) => { init = init || {}; const c = { url, method: init.method || "GET", headers: init.headers || {}, body: init.body }; f.calls.push(c); return Promise.resolve().then(() => handler(c, f.calls.length)); }; f.calls = []; return f; };
const rej = (p) => p.then(() => null, (e) => e);
const TOK = "AbCdEfGhIjKlMnOpQrSt12";

module.exports = async function ({ nhom, kiem, bang, CS }) {
  const SH = CS.share, S = CS.store, P = CS.project;
  if (!SH || !S || !P) { nhom("chia sẻ"); kiem("có module share + store + project", false); return; }

  /* ================================================================ đoạn # của địa chỉ */
  nhom("chia sẻ · đoạn # của địa chỉ");
  {
    kiem("#share=TOKEN&backend=mysql → xem, token + kho", bang(SH.parseHash("#share=" + TOK + "&backend=mysql"), { mode: "view", token: TOK, backend: "mysql" }));
    kiem("#clone=TOKEN → nhân bản; kho vắng → rỗng (mặc định json ở máy chủ)", bang(SH.parseHash("#clone=" + TOK), { mode: "clone", token: TOK, backend: "" }));
    kiem("không có dấu # đầu cũng đọc được; thứ tự tham số tuỳ ý", bang(SH.parseHash("backend=mongo&share=" + TOK), { mode: "view", token: TOK, backend: "mongo" }));
    kiem("kho lạ bị bỏ (rỗng), không làm hỏng liên kết", SH.parseHash("#share=" + TOK + "&backend=evil").backend === "" && SH.parseHash("#share=" + TOK + "&backend=").backend === "");
    kiem("token sai định dạng → null (quá ngắn / ký tự lạ / quá dài / rỗng)", ["#share=abc", "#share=" + TOK + "!", "#share=" + "a".repeat(101), "#share=", "#share=" + TOK.replace("A", "/"), "#share=%E0%A4%A"].every((h) => SH.parseHash(h) === null));
    kiem("đoạn # không liên quan (ví dụ #item=1, rỗng, null) → null", SH.parseHash("#item=1") === null && SH.parseHash("") === null && SH.parseHash(null) === null && SH.parseHash(undefined) === null && SH.parseHash("#") === null);
    kiem("token mã hoá phần trăm được giải mã; mã hoá lố vẫn an toàn", SH.parseHash("#share=" + encodeURIComponent(TOK)).token === TOK);
    kiem("hashFor/linkFor: ghép đúng, bỏ ? và # cũ của trang, kho lạ không được ghép", SH.hashFor("view", TOK, "json") === "#share=" + TOK + "&backend=json" && SH.hashFor("clone", TOK) === "#clone=" + TOK && SH.hashFor("view", TOK, "evil") === "#share=" + TOK
      && SH.linkFor("https://x.example/webapp/tranphuc8a/code-studio/index.html?item=1#old=1", TOK, "mysql") === "https://x.example/webapp/tranphuc8a/code-studio/index.html#share=" + TOK + "&backend=mysql");
    kiem("vòng khứ hồi: parseHash(hashFor(...)) trả lại đúng", ["json", "mysql", "mongo", ""].every((b) => { const p = SH.parseHash(SH.hashFor("view", TOK, b)); return p && p.token === TOK && p.backend === b && p.mode === "view"; }));
    kiem("token KHÔNG nằm trong đường dẫn hay chuỗi truy vấn (chỉ sau #, không gửi lên máy chủ)", (() => { const l = SH.linkFor("https://x.example/a/", TOK, "json"); return l.indexOf(TOK) > l.indexOf("#") && l.slice(0, l.indexOf("#")).indexOf(TOK) < 0; })());
  }

  /* ================================================================ bản chia sẻ → mục mới */
  nhom("chia sẻ · bản chia sẻ thành mục thư viện mới");
  {
    const shared = { sharedAt: 1700000000000, item: { id: "goc1", kind: "project", name: "  Bài toán A  ", language: "cpp",
      files: [{ path: "main.cpp", content: "int main(){}\n" }, { path: "src/util.h", content: "// u\n" }], updatedAt: 5,
      meta: { mainFile: "main.cpp", std: "c++20", stdin: "1 2\n", tests: [{ id: "abc123", name: "t", input: "1 2", expected: "3" }], testMode: "tokens", pinned: true, openTabs: ["main.cpp"], activeFile: "main.cpp" } } };
    const it = SH.itemFromShared(shared, { newId: () => "moi1", now: 1800000000000 });
    kiem("id mới, tên cắt khoảng trắng + hậu tố “ (bản chia sẻ)”, updatedAt = bây giờ, không phải bia mộ", it.id === "moi1" && it.name === "Bài toán A (bản chia sẻ)" && it.updatedAt === 1800000000000 && it.deleted === false && it.kind === "project" && it.language === "cpp");
    kiem("tệp giữ nguyên; meta giữ stdin/std/bộ test/chế độ so sánh, bỏ ghim và thẻ đang mở", bang(it.files.map((f) => f.path), ["main.cpp", "src/util.h"]) && it.meta.stdin === "1 2\n" && it.meta.std === "c++20" && it.meta.tests.length === 1 && it.meta.testMode === "tokens" && it.meta.pinned === false && bang(it.meta.openTabs, []) && it.meta.activeFile === "" && it.meta.mainFile === "main.cpp");
    kiem("kết quả đã chuẩn hoá + hợp lệ (validate sạch), lũy đẳng", P.validate(it).length === 0 && bang(P.normalize(it), it));
    kiem("không sửa bản chia sẻ gốc", shared.item.meta.pinned === true && shared.item.name === "  Bài toán A  " && shared.item.id === "goc1");
    kiem("id mặc định là id mới hợp lệ (khác id gốc)", (() => { const x = SH.itemFromShared(shared); return /^[A-Za-z0-9_.:-]{1,80}$/.test(x.id) && x.id !== "goc1"; })());
    kiem("tên rỗng → “Không tên”; kind lạ → snippet", (() => { const x = SH.itemFromShared({ item: { kind: "zzz", name: "  ", language: "python", files: [{ path: "main.py", content: "x" }], meta: {} } }); return x.name === "Không tên" + SH.SUFFIX && x.kind === "snippet"; })());
    const long = SH.itemFromShared({ item: { name: "x".repeat(300), language: "python", files: [{ path: "main.py", content: "x" }], meta: {} } });
    kiem("tên dài bị cắt còn ≤ 200 ký tự (giới hạn của máy chủ)", long.name.length <= 200 && P.validate(long).length === 0);
    const bad = (s) => { try { SH.itemFromShared(s); return null; } catch (e) { return e; } };
    kiem("dữ liệu hỏng → Error tiếng Việt, không tạo mục dở dang", [null, "x", {}, { item: null }, { item: { files: "x" } }].every((s) => { const e = bad(s); return e && /chia sẻ/.test(e.message); }) && /không dùng được/.test((bad({ item: { name: "a", language: "cpp", files: [{ path: "../x", content: "" }], meta: {} } }) || {}).message || ""));
  }

  /* ================================================================ readShared (công khai) */
  nhom("chia sẻ · readShared — đọc công khai, không khoá");
  {
    const good = { item: { id: "i", kind: "snippet", name: "A", language: "cpp", files: [{ path: "main.cpp", content: "x" }], meta: {}, updatedAt: 1 }, sharedAt: 2 };
    const f = fakeFetch(() => resp(200, good));
    const r = await S.readShared(TOK, { apiBase: "/api/v1/", backend: "mysql", fetch: f });
    const c = f.calls[0];
    kiem("GET /api/v1/codestore/shared/{token}?backend=mysql, không header khoá, không cache", c.method === "GET" && c.url === "/api/v1/codestore/shared/" + TOK + "?backend=mysql" && !("X-Codestore-Key" in c.headers) && r.item.name === "A" && r.sharedAt === 2);
    kiem("không đặt kho → không có ?backend; token có ký tự lạ được mã hoá trong đường dẫn", await (async () => { const g = fakeFetch(() => resp(200, good)); await S.readShared("a/b c", { apiBase: "/api/v1", fetch: g }); return g.calls[0].url === "/api/v1/codestore/shared/a%2Fb%20c"; })());
    const nf = await rej(S.readShared(TOK, { apiBase: "/api/v1", fetch: fakeFetch(() => resp(404, { status_code: 404, message: "Không tìm thấy", data: { code: "codestore_share_not_found" } })) }));
    kiem("404 share_not_found: thông báo RIÊNG (không phải “Không tìm thấy không gian”), giữ code + status", nf && nf.code === "codestore_share_not_found" && nf.status === 404 && /không tồn tại hoặc đã bị thu hồi/.test(nf.message));
    const rl = await rej(S.readShared(TOK, { apiBase: "/api/v1", fetch: fakeFetch(() => resp(429, { message: "x", data: { code: "codestore_rate_limited", retryAfter: 9 } }, { "Retry-After": "9" })) }));
    kiem("429: nói rõ thử lại sau 9 giây", rl && rl.status === 429 && rl.retryAfter === 9 && /9 giây/.test(rl.message));
    const off = await rej(S.readShared(TOK, { apiBase: "/api/v1", fetch: fakeFetch(() => { throw new TypeError("Failed to fetch"); }) }));
    kiem("mất mạng → lỗi code 'offline'", off && off.code === "offline");
    const bd = await rej(S.readShared(TOK, { apiBase: "/api/v1", fetch: fakeFetch(() => resp(200, { item: { files: "x" } })) }));
    const bd2 = await rej(S.readShared(TOK, { apiBase: "/api/v1", fetch: fakeFetch(() => resp(200, "không phải JSON")) }));
    kiem("thân sai định dạng / không phải JSON → bad_response, không ném lỗi thô", bd && bd.code === "bad_response" && bd2 && bd2.code === "bad_response");
    const nofetch = await rej(S.readShared(TOK, { apiBase: "/api/v1", fetch: null }));
    kiem("không có fetch → lỗi rõ ràng (nếu môi trường cũng không có fetch toàn cục thì bỏ qua)", typeof globalThis.fetch === "function" ? true : nofetch && nofetch.code === "no_fetch");
  }

  /* ================================================================ sync.share / shares / unshare */
  nhom("chia sẻ · sync.share / shares / unshare (có khoá, đi sau đồng bộ)");
  {
    async function setup(handler, state) {
      const kv = S.kv.memory(), lib = S.library({ kv }); await lib.ready;
      if (state !== null) await kv.set("sync:state", state || { workspaceId: "ws1", key: "KHOA-BI-MAT", backend: "mysql", cursor: 0 });
      const f = fakeFetch(handler);
      const sync = S.sync({ library: lib, kv, fetch: f, apiBase: "/api/v1", backend: "mysql", isOnline: () => true });
      await sync.ready;
      return { lib, f, sync };
    }
    const base = (c) => {
      if (c.method === "GET" && /\/ws1\/items\?/.test(c.url)) return resp(200, { items: [], serverTime: 5, more: false });
      if (c.method === "PUT" && /\/ws1\/items(\?|$)/.test(c.url)) return resp(200, { items: JSON.parse(c.body).items.map((x) => Object.assign({}, x, { serverUpdatedAt: 3 })) });     // như máy chủ thật: trả bản đang giữ
      return null;
    };
    const snip = (id) => P.createSnippet({ id, name: "Bài " + id, language: "cpp", content: "int a;\n" });

    let env = await setup((c) => base(c) || (c.method === "POST" && /\/items\/it1\/share/.test(c.url) ? resp(201, { token: TOK, sharedAt: 7, updatedAt: 8 }) : resp(500, {})));
    await env.lib.put(snip("it1"));
    const out = await env.sync.share("it1");
    const urls = env.f.calls.map((c) => c.method + " " + c.url.replace("/api/v1/codestore", ""));
    kiem("share: ĐẨY mục dirty lên trước (PUT chứa it1), kéo, RỒI mới POST …/share; trả {token, sharedAt, updatedAt}", urls[0] === "PUT /ws1/items?backend=mysql" && JSON.parse(env.f.calls[0].body).items.some((x) => x.id === "it1") && urls[urls.length - 1] === "POST /ws1/items/it1/share?backend=mysql" && out.token === TOK && out.sharedAt === 7 && out.updatedAt === 8, urls.join(" | "));
    kiem("khoá nằm ở HEADER X-Codestore-Key, không bao giờ trong địa chỉ", env.f.calls.every((c) => c.headers["X-Codestore-Key"] === "KHOA-BI-MAT" && c.url.indexOf("KHOA-BI-MAT") < 0));
    kiem("mục còn dirty? không — đã đồng bộ xong trước khi chia sẻ", env.lib.dirty().length === 0);

    env = await setup(() => resp(500, {}), null);
    const e0 = await rej(env.sync.share("it1")), e1 = await rej(env.sync.shares()), e2 = await rej(env.sync.unshare("it1"));
    kiem("chưa nối không gian: lỗi not_connected, KHÔNG gọi máy chủ lần nào", [e0, e1, e2].every((e) => e && e.code === "not_connected" && /đồng bộ/.test(e.message)) && env.f.calls.length === 0);

    env = await setup((c) => base(c) || resp(404, { status_code: 404, message: "Mục không có", data: { code: "codestore_item_not_found", itemId: "it1" } }));
    const nfound = await rej(env.sync.share("it1"));
    kiem("404 item_not_found: thông báo riêng (chưa lên máy chủ), không nhầm với “Không tìm thấy không gian”", nfound && nfound.code === "codestore_item_not_found" && /chưa có trên máy chủ/.test(nfound.message));

    env = await setup((c) => base(c) || resp(400, { status_code: 400, message: "Nhiều quá", data: { code: "codestore_too_many_shares", limit: 50 } }));
    const many = await rej(env.sync.share("it1"));
    kiem("400 too_many_shares: nêu giới hạn 50 và cách xử lý", many && many.code === "codestore_too_many_shares" && /tối đa 50/.test(many.message) && /thu hồi/.test(many.message));

    env = await setup((c) => base(c) || resp(429, { message: "x", data: { code: "codestore_rate_limited", retryAfter: 30 } }, { "Retry-After": "30" }));
    const lim = await rej(env.sync.share("it1"));
    kiem("429: nói rõ thử lại sau", lim && lim.status === 429 && /30 giây/.test(lim.message));

    env = await setup((c) => c.method === "GET" && /\/ws1\/shares/.test(c.url) ? resp(200, { shares: [{ token: TOK, itemId: "it1", name: "A", sharedAt: 1, updatedAt: 2 }, { token: "x".repeat(22), itemId: "it2", name: "B", sharedAt: 1, updatedAt: 2 }] }) : resp(500, {}));
    const list = await env.sync.shares();
    kiem("shares: GET /ws1/shares?backend=mysql → mảng; không kéo/đẩy gì thêm", list.length === 2 && list[0].itemId === "it1" && env.f.calls.length === 1 && env.f.calls[0].url === "/api/v1/codestore/ws1/shares?backend=mysql");
    env = await setup(() => resp(200, { shares: "rác" }));
    kiem("shares: thân lạ → [] (không ném)", bang(await env.sync.shares(), []));

    env = await setup((c) => c.method === "DELETE" ? resp(200, { revoked: true }) : resp(500, {}));
    const rv = await env.sync.unshare("it/1 x");
    kiem("unshare: DELETE …/items/{id}/share (id được mã hoá) → true", rv === true && env.f.calls[0].method === "DELETE" && env.f.calls[0].url === "/api/v1/codestore/ws1/items/it%2F1%20x/share?backend=mysql");
    env = await setup(() => resp(404, { message: "x", data: { code: "codestore_share_not_found" } }));
    const nr = await rej(env.sync.unshare("it1"));
    kiem("unshare mục chưa chia sẻ: thông báo riêng", nr && nr.code === "codestore_share_not_found" && /đã bị thu hồi/.test(nr.message));

    env = await setup(() => resp(200, { items: [], serverTime: 1, more: false }));          // POST …/share trả thân kéo-về: không có token
    const weird = await rej(env.sync.share("it1"));
    kiem("máy chủ trả thiếu token → lỗi bad_response", weird && weird.code === "bad_response");
  }
};
