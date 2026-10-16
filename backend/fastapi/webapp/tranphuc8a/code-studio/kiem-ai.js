/* Kiểm "Giải thích lỗi bằng AI" (core/ai.js): dựng yêu cầu đúng hợp đồng /ai/code/explain (cắt độ dài, tệp quá dài), kiểm lại kết quả
   của máy chủ (số dòng, đề xuất sửa), xem trước/áp đề xuất, và máy khách HTTP (header, token hết hạn, lỗi, thử lại model, nhớ kết quả)
   bằng fetch + kho lưu GIẢ. Không gọi mạng, không gọi Gemini. Được kiem.js nạp. */
"use strict";

const resp = (status, body, headers) => {
  const h = {}; Object.keys(headers || {}).forEach((k) => { h[k.toLowerCase()] = headers[k]; });
  return { ok: status >= 200 && status < 300, status, headers: { get: (k) => (k.toLowerCase() in h ? h[k.toLowerCase()] : null) }, json: async () => body };
};
const fakeFetch = (handler) => { const f = (url, init) => { f.calls.push({ url, init: init || {} }); return Promise.resolve().then(() => handler(url, init || {}, f.calls.length)); }; f.calls = []; return f; };
const memStore = (init) => { const m = Object.assign({}, init || {}); return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, dump: () => m }; };
const rejected = async (p) => { try { await p; return null; } catch (e) { return e; } };
const GOOD = { summary: "Thiếu dấu chấm phẩy.", items: [{ line: 2, title: "Thiếu ;", why: "Câu lệnh phải kết thúc bằng ;", fix: "Thêm ; cuối dòng 2." }], patch: { line: 2, endLine: 2, replacement: "int x = 1;" }, cached: false };
const CODE = "int main() {\n    int x = 1\n    return x;\n}\n";

module.exports = async function ({ nhom, kiem, bang, CS }) {
  const AI = CS.ai;
  if (!AI) { nhom("ai"); kiem("có module ai", false); return; }

  /* ================================================================ dựng yêu cầu */
  nhom("ai · dựng yêu cầu /ai/code/explain");
  {
    const b = AI.buildExplainRequest({ language: "cpp", filename: "main.cpp", kind: "compile", code: CODE.replace(/\n/g, "\r\n"), diagnostics: [{ line: 2, col: 14, severity: "error", message: "expected ';'" }], stderr: "main.cpp:2:14: error" });
    kiem("yêu cầu đủ trường theo hợp đồng; CRLF → LF; số dòng", bang(Object.keys(b.req).sort(), ["code", "diagnostics", "filename", "kind", "language", "stderr"]) && b.req.code === CODE && b.sentLines === 5 && b.totalLines === 5 && b.truncated === false && b.req.diagnostics[0].line === 2, JSON.stringify(b.req));
    const d = AI.buildExplainRequest({ language: "cpp", code: "x", diagnostics: [{ line: -3, col: "a", severity: "boom", message: "  nhiều   khoảng\ttrắng \u0007và điều khiển " }, { line: 1, message: "" }, null, 5, { line: 1.5, message: "dòng thập phân" }] });
    kiem("chẩn đoán: số âm/lạ → 0, mức lạ → error, khoảng trắng gọn, ký tự điều khiển bỏ, thông báo rỗng/phần tử rác bị loại", d.req.diagnostics.length === 2 && d.req.diagnostics[0].line === 0 && d.req.diagnostics[0].col === 0 && d.req.diagnostics[0].severity === "error" && d.req.diagnostics[0].message === "nhiều khoảng trắng và điều khiển" && d.req.diagnostics[1].line === 0, JSON.stringify(d.req.diagnostics));
    const big = AI.buildExplainRequest({ language: "x".repeat(99), filename: "f".repeat(999), kind: "runtime", code: "a", diagnostics: Array.from({ length: 50 }, (_, i) => ({ line: 1, message: "m" + i + "x".repeat(900) })), stderr: "e".repeat(9000) });
    kiem("cắt theo giới hạn máy chủ: ngôn ngữ 32, tên tệp 200, thông báo 500, ≤ 20 chẩn đoán, stderr 4000; kind giữ runtime", big.req.language.length === 32 && big.req.filename.length === 200 && big.req.diagnostics.length === 20 && big.req.diagnostics.every((x) => x.message.length <= 500) && big.req.stderr.length === 4000 && big.req.kind === "runtime");
    kiem("kind lạ → compile; ngôn ngữ rỗng → plaintext", AI.buildExplainRequest({ code: "x", kind: "zzz", stderr: "e" }).req.kind === "compile" && AI.buildExplainRequest({ code: "x", stderr: "e" }).req.language === "plaintext");
    const none = (() => { try { AI.buildExplainRequest({ code: "x", diagnostics: [], stderr: "  \n " }); return null; } catch (e) { return e; } })();
    kiem("không có chẩn đoán lẫn stderr → lỗi code_error_missing (khỏi gọi máy chủ)", none && none.code === "code_error_missing" && /chạy chương trình/.test(none.message));
    kiem("chỉ có stderr (vd Segmentation fault, không có dòng lỗi) vẫn hỏi được", AI.buildExplainRequest({ code: "x", stderr: "Segmentation fault" }).req.diagnostics.length === 0);

    const lines = Array.from({ length: 4000 }, (_, i) => "line" + i + "........"), longCode = lines.join("\n");
    const t = AI.buildExplainRequest({ language: "cpp", code: longCode, diagnostics: [{ line: 10, message: "ở đầu" }, { line: 3900, message: "ở cuối" }] });
    kiem("tệp > 30 000 ký tự: chỉ gửi PHẦN ĐẦU (cắt ở ranh giới dòng, số dòng không lệch), bỏ chẩn đoán nằm ngoài, đánh dấu truncated", t.truncated && t.req.code.length <= 30000 && longCode.startsWith(t.req.code) && t.req.code.split("\n").length === t.sentLines && t.sentLines < 4000 && t.totalLines === 4000 && t.req.diagnostics.length === 1 && t.req.diagnostics[0].line === 10, t.sentLines + " dòng");
    const tl = (() => { try { AI.buildExplainRequest({ code: longCode, diagnostics: [{ line: 3900, message: "ở cuối" }] }); return null; } catch (e) { return e; } })();
    kiem("tệp dài mà mọi lỗi nằm ngoài phần gửi và không có stderr → code_too_long (nói rõ lý do)", tl && tl.code === "code_too_long" && /30000/.test(tl.message));
    kiem("… có stderr thì vẫn hỏi (AI xem stderr + phần đầu)", AI.buildExplainRequest({ code: longCode, diagnostics: [{ line: 3900, message: "ở cuối" }], stderr: "boom" }).req.stderr === "boom");
  }

  /* ================================================================ kiểm lại kết quả */
  nhom("ai · kiểm lại kết quả của máy chủ");
  {
    const n = AI.normalizeResult(GOOD, CODE);
    kiem("kết quả hợp lệ đi qua nguyên vẹn", n.summary === GOOD.summary && n.items.length === 1 && n.items[0].line === 2 && n.patch && n.patch.line === 2 && n.patch.replacement === "int x = 1;" && n.cached === false);
    const l = AI.normalizeResult({ summary: "s", items: [{ line: 0, title: "a" }, { line: 99, title: "b" }, { line: 3.5, title: "c" }, { line: "2", title: "d" }, { line: 5, title: "e" }, { line: null, title: "f" }], patch: null }, CODE);
    kiem("số dòng của mục phải nằm trong [1, số dòng của tệp] (tệp này 5 dòng kể cả dòng trống cuối), không thì null", bang(l.items.map((x) => x.line), [null, null, null, null, 5, null]), JSON.stringify(l.items.map((x) => x.line)));
    const many = AI.normalizeResult({ summary: "s", items: Array.from({ length: 20 }, (_, i) => ({ title: "t" + i, why: "w".repeat(2000), fix: "f".repeat(2000) })) }, CODE);
    kiem("≤ 8 mục; why/fix cắt 600, tiêu đề 120, tóm tắt 400", many.items.length === 8 && many.items[0].why.length <= 600 && many.items[0].fix.length <= 600 && AI.normalizeResult({ summary: "s".repeat(900), items: [{ title: "t".repeat(500) }] }, CODE).summary.length <= 400 && AI.normalizeResult({ summary: "s", items: [{ title: "t".repeat(500) }] }, CODE).items[0].title.length <= 120);
    kiem("mục rỗng bị bỏ; không có tóm tắt lẫn mục → lỗi bad_response", AI.normalizeResult({ summary: "s", items: [{}, { title: "" }, { title: "ok" }] }, CODE).items.length === 1 && (() => { try { AI.normalizeResult({ summary: "", items: [{}] }, CODE); return false; } catch (e) { return e.code === "bad_response"; } })());
    kiem("không phải đối tượng → bad_response", [null, "x", 5, []].every((v) => { try { AI.normalizeResult(v, CODE); return false; } catch (e) { return e.code === "bad_response"; } }));
    kiem("ký tự điều khiển/ẩn/đảo chiều bị bỏ khỏi chuỗi hiển thị", AI.normalizeResult({ summary: "a‮b\u0000c​d", items: [] }, CODE).summary === "abcd");
    kiem("chuỗi chứa HTML được giữ NGUYÊN VĂN (giao diện dùng textContent — không thoát hộ ở đây)", AI.normalizeResult({ summary: "<img src=x onerror=1>" }, CODE).summary === "<img src=x onerror=1>");

    const P = (p) => AI.normalizeResult({ summary: "s", patch: p }, CODE).patch;
    kiem("patch hợp lệ: thay nhiều dòng; xoá (replacement rỗng) cũng hợp lệ", P({ line: 2, endLine: 3, replacement: "a\nb" }).endLine === 3 && P({ line: 2, endLine: 2, replacement: "" }).replacement === "");
    kiem("patch bị bỏ: ngoài tệp / đảo thứ tự / số lạ / thiếu trường / không phải đối tượng", [{ line: 0, endLine: 1, replacement: "x" }, { line: 2, endLine: 9, replacement: "x" }, { line: 3, endLine: 2, replacement: "x" }, { line: "2", endLine: 2, replacement: "x" }, { line: 2.5, endLine: 3, replacement: "x" }, { line: 2, endLine: 2 }, { line: 2, endLine: 2, replacement: 5 }, "x", [], null].every((p) => P(p) === null));
    const long = Array.from({ length: 100 }, (_, i) => "l" + i).join("\n");
    kiem("patch bị bỏ khi thay > 40 dòng hoặc replacement > 4000 ký tự", AI.normalizeResult({ summary: "s", patch: { line: 1, endLine: 41, replacement: "x" } }, long).patch === null && AI.normalizeResult({ summary: "s", patch: { line: 1, endLine: 40, replacement: "x" } }, long).patch !== null && P({ line: 2, endLine: 2, replacement: "x".repeat(4001) }) === null);
    kiem("patch giống hệt đoạn bị thay → bỏ (không có gì để áp)", P({ line: 2, endLine: 2, replacement: "    int x = 1" }) === null && P({ line: 2, endLine: 3, replacement: "    int x = 1\n    return x;" }) === null);
    kiem("replacement: CRLF → LF, ký tự điều khiển bỏ", P({ line: 2, endLine: 2, replacement: "a\r\nb\u0000" }).replacement === "a\nb");
  }

  nhom("ai · xem trước và áp đề xuất sửa");
  {
    const code = "a\nb\nc\nd";
    const ap = (line, endLine, replacement, src) => AI.applyPatch(src == null ? code : src, { line, endLine, replacement });
    kiem("thay một dòng; thay nhiều dòng bằng ít/nhiều dòng hơn", ap(2, 2, "B") === "a\nB\nc\nd" && ap(2, 3, "X") === "a\nX\nd" && ap(2, 2, "x\ny\nz") === "a\nx\ny\nz\nc\nd");
    kiem("replacement rỗng = XOÁ các dòng (không để lại dòng trống)", ap(2, 3, "") === "a\nd" && ap(1, 4, "") === "");
    kiem("dòng đầu / dòng cuối", ap(1, 1, "A") === "A\nb\nc\nd" && ap(4, 4, "D") === "a\nb\nc\nD" && ap(4, 4, "D\n") === "a\nb\nc\nD\n");
    kiem("văn bản CRLF được chuẩn hoá thành LF khi áp", ap(2, 2, "B", "a\r\nb\r\nc") === "a\nB\nc");
    kiem("không sửa chuỗi gốc; áp xong thì đúng bằng xem trước", (() => { const pv = AI.previewPatch(code, { line: 2, endLine: 3, replacement: "X\nY" }); return bang(pv.before, ["b", "c"]) && bang(pv.after, ["X", "Y"]) && pv.line === 2 && pv.endLine === 3 && code === "a\nb\nc\nd"; })());
    kiem("xem trước bản xoá: after rỗng", bang(AI.previewPatch(code, { line: 2, endLine: 3, replacement: "" }).after, []));
    const bad = (p) => { try { AI.applyPatch(code, p); return null; } catch (e) { return e; } };
    kiem("ngoài tệp / sai thứ tự / không có patch → lỗi bad_patch (không áp bừa)", [{ line: 0, endLine: 1, replacement: "" }, { line: 3, endLine: 9, replacement: "" }, { line: 3, endLine: 2, replacement: "" }, null].every((p) => { const e = bad(p); return e && e.code === "bad_patch"; }) && AI.previewPatch(code, null) === null);
  }

  /* ================================================================ máy khách HTTP */
  nhom("ai · máy khách HTTP (fetch + kho giả)");
  {
    const HREF = "http://localhost:6789/webapp/tranphuc8a/code-studio/", BASE = "/api/v1", GOC = "http://localhost:6789/api/v1";
    const K = (store) => AI.client({ apiBase: BASE, fetch: store.fetch, storage: store.storage, href: HREF, now: store.now });
    const mk = (init, handler) => { const storage = memStore(init); return { storage, fetch: fakeFetch(handler || (() => resp(200, { enabled: true, allowed: true, needs: null }))), now: () => 1700000000000 }; };

    const c0 = K(mk());
    kiem("khoá cất token tính theo địa chỉ gốc ĐÃ chuẩn hoá — đúng như ai-khach.js (dùng chung với các trang khác)", c0.keys.ai === "ai.phien@" + GOC && c0.keys.admin === "qlkh.phien@" + GOC + ".token" && c0.keys.model === "ai.model@" + GOC, JSON.stringify(c0.keys));
    const noTok = K(mk());
    kiem("chưa có gì → header chỉ có Content-Type", bang(Object.keys(noTok.headers()), ["Content-Type"]));
    const s1 = mk({ ["qlkh.phien@" + GOC + ".token"]: JSON.stringify("adm-123"), ["ai.phien@" + GOC]: JSON.stringify({ token: "ai-tok", het: 1700000999 }), ["ai.model@" + GOC]: JSON.stringify("gemini-2.5-flash") });
    const h1 = K(s1).headers();
    kiem("có phiên quản trị + token AI còn hạn (het tính bằng giây) + model → đủ 3 header", h1["X-Admin-Session"] === "adm-123" && h1["X-AI-Session"] === "ai-tok" && h1["X-AI-Model"] === "gemini-2.5-flash", JSON.stringify(h1));
    const s2 = mk({ ["ai.phien@" + GOC]: JSON.stringify({ token: "old", het: 1600000000 }) });
    const h2 = K(s2).headers();
    kiem("token AI HẾT HẠN (giây): không gửi và xoá khỏi kho", !("X-AI-Session" in h2) && !("ai.phien@" + GOC in s2.storage.dump()));
    const h3 = K(mk({ ["ai.phien@" + GOC]: JSON.stringify({ token: "ms", het: 1700000999000 }) })).headers(), h4 = K(mk({ ["ai.phien@" + GOC]: JSON.stringify({ token: "oldms", het: 1600000000000 }) })).headers();
    kiem("het tính bằng mili-giây cũng hiểu đúng (còn hạn gửi, hết hạn không gửi)", h3["X-AI-Session"] === "ms" && !("X-AI-Session" in h4));
    kiem("model sai định dạng (có / hoặc hoa) bị bỏ qua", !("X-AI-Model" in K(mk({ ["ai.model@" + GOC]: JSON.stringify("A/B ../x") })).headers()));
    const other = AI.client({ apiBase: "https://khac.example/api", fetch: s1.fetch, storage: s1.storage, href: HREF });
    kiem("token của gốc API này KHÔNG bao giờ được gửi sang gốc API khác", !("X-AI-Session" in other.headers()) && !("X-Admin-Session" in other.headers()));
    kiem("kho lưu bị chặn (ném lỗi) / không có: vẫn chạy, không header", bang(Object.keys(AI.client({ apiBase: BASE, fetch: s1.fetch, storage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } }, href: HREF }).headers()), ["Content-Type"]) && bang(Object.keys(AI.client({ apiBase: BASE, fetch: s1.fetch, storage: null, href: HREF }).headers()), ["Content-Type"]));

    /* status: nhớ 30 giây, force hỏi lại */
    let t = 1000; const sx = mk({}); sx.now = () => t;
    const cs = K(sx);
    await cs.status(); await cs.status(); t += 29000; await cs.status();
    kiem("status nhớ 30 giây (một lời gọi), hết hạn hoặc force thì hỏi lại; gọi GET /ai/status", sx.fetch.calls.length === 1 && sx.fetch.calls[0].url === BASE + "/ai/status" && !sx.fetch.calls[0].init.method);
    t += 2000; await cs.status(); await cs.status(true);
    kiem("… hết 30 giây / force → hỏi lại", sx.fetch.calls.length === 3, String(sx.fetch.calls.length));
    kiem("usable(): bật + được dùng hoặc chỉ thiếu mã; tắt / chỉ quản trị → không", cs.usable({ enabled: true, allowed: true }) && cs.usable({ enabled: true, allowed: false, needs: "code" }) && !cs.usable({ enabled: true, allowed: false, needs: "admin" }) && !cs.usable({ enabled: false, allowed: true }) && !cs.usable(null));
    const se = mk({}, () => { throw new TypeError("net"); });
    const ce = K(se); const e1 = await rejected(ce.status()); await rejected(ce.status());
    kiem("status lỗi không bị nhớ (lần sau hỏi lại); lỗi mạng có code 'network'", e1 && e1.code === "network" && se.fetch.calls.length === 2);

    /* unlock */
    const su = mk({}, (url, init) => (url.endsWith("/ai/session") ? resp(200, { session: "TOK", expiresAt: 1700009999 }) : resp(200, { enabled: true, allowed: true, needs: null })));
    const cu = K(su); const st = await cu.unlock("mã-bí-mật");
    kiem("unlock: POST /ai/session {code}, cất token theo khoá chung, rồi hỏi lại status", su.fetch.calls[0].init.method === "POST" && JSON.parse(su.fetch.calls[0].init.body).code === "mã-bí-mật" && JSON.parse(su.storage.dump()["ai.phien@" + GOC]).token === "TOK" && st.allowed === true && su.fetch.calls[1].url.endsWith("/ai/status") && su.fetch.calls[1].init.headers["X-AI-Session"] === "TOK");
    const bad = await rejected(K(mk({}, () => resp(403, { status_code: 403, message: "Mã không đúng", data: { code: "ai_code_invalid" } }))).unlock("x"));
    kiem("unlock sai mã: lỗi mang thông báo của máy chủ + code, không cất token", bad && bad.message === "Mã không đúng" && bad.code === "ai_code_invalid" && bad.status === 403);

    /* explain */
    const built = AI.buildExplainRequest({ language: "cpp", filename: "main.cpp", code: CODE, diagnostics: [{ line: 2, col: 14, message: "expected ';'" }] });
    const sf = mk({}, (url) => resp(200, GOOD));
    const cx = K(sf);
    const r1 = await cx.explain(built), r2 = await cx.explain(built);
    kiem("explain: POST /ai/code/explain đúng thân yêu cầu (không gì thêm); kết quả đã kiểm lại; lần 2 cùng yêu cầu dùng lại, không gọi máy chủ", sf.fetch.calls.length === 1 && sf.fetch.calls[0].url === BASE + "/ai/code/explain" && sf.fetch.calls[0].init.method === "POST" && bang(JSON.parse(sf.fetch.calls[0].init.body), built.req) && r1 === r2 && r1.patch.line === 2);
    const built2 = AI.buildExplainRequest({ language: "cpp", filename: "main.cpp", code: CODE + "// đổi", diagnostics: built.req.diagnostics });
    await cx.explain(built2);
    kiem("mã đổi → yêu cầu khác → gọi lại", sf.fetch.calls.length === 2);
    const sbad = mk({}, () => resp(200, { summary: "", items: [] }));
    const eb = await rejected(K(sbad).explain(built));
    kiem("máy chủ trả rỗng → lỗi bad_response, KHÔNG nhớ kết quả hỏng", eb && eb.code === "bad_response");
    const sl = mk({}, () => resp(429, { status_code: 429, message: "Quá nhiều lượt", data: { code: "ai_rate_limited", retryAfter: 17 } }, { "Retry-After": "17" }));
    const el = await rejected(K(sl).explain(built));
    kiem("429: giữ code, status và retryAfter (giao diện hiện 'thử lại sau 17 giây')", el && el.code === "ai_rate_limited" && el.status === 429 && el.retryAfter === 17);
    const sh = mk({}, () => resp(429, { message: "x", data: { code: "ai_budget_exhausted" } }, { "Retry-After": "300" }));
    kiem("retryAfter lấy từ header Retry-After khi thân không có", (await rejected(K(sh).explain(built))).retryAfter === 300);
    const s422 = mk({}, () => resp(422, { detail: [{ msg: "too long" }] }));
    const e422 = await rejected(K(s422).explain(built));
    kiem("422 (quá giới hạn): thông báo tiếng Việt dễ hiểu, không lộ chi tiết thô", e422 && e422.status === 422 && /không nhận dữ liệu/.test(e422.message));
    const s502 = mk({}, () => resp(502, { status_code: 502, message: "AI trả lời sai định dạng — thử lại", data: {} }));
    kiem("502: thông báo của máy chủ được giữ", /sai định dạng/.test((await rejected(K(s502).explain(built))).message));

    /* model không còn: bỏ lựa chọn, thử lại MỘT lần */
    let n = 0;
    const sm = mk({ ["ai.model@" + GOC]: JSON.stringify("gemini-cu") }, (url, init) => (++n === 1 ? resp(400, { message: "model lạ", data: { code: "ai_model_unknown" } }) : resp(200, GOOD)));
    const cm = K(sm); await cm.explain(built);
    kiem("model đã chọn không còn: xoá lựa chọn, gọi lại một lần bằng model mặc định (không header X-AI-Model) và thành công", sm.fetch.calls.length === 2 && sm.fetch.calls[0].init.headers["X-AI-Model"] === "gemini-cu" && !("X-AI-Model" in sm.fetch.calls[1].init.headers) && !("ai.model@" + GOC in sm.storage.dump()));
    const sn = mk({ ["ai.model@" + GOC]: JSON.stringify("gemini-cu") }, () => resp(400, { message: "model lạ", data: { code: "ai_model_unknown" } }));
    const en = await rejected(K(sn).explain(built));
    kiem("model lỗi mà đã mặc định vẫn lỗi: không lặp vô hạn (tối đa 2 lời gọi)", en && en.code === "ai_model_unknown" && sn.fetch.calls.length === 2);
    const sd = mk({}, () => { throw new TypeError("Failed to fetch"); });
    const ed = await rejected(K(sd).explain(built));
    kiem("mất mạng: lỗi code 'network' (không ném TypeError thô)", ed && ed.code === "network" && /kết nối|offline/i.test(ed.message));
    const nf = await rejected(AI.client({ apiBase: BASE, fetch: null, storage: null, href: HREF }).explain(built));
    kiem("không có fetch: lỗi rõ ràng, không treo", nf && nf.code === "no_fetch");
  }
};
