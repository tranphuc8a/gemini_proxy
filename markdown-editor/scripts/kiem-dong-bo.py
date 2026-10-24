# -*- coding: utf-8 -*-
"""Kiểm đồng bộ delta + kho IndexedDB của Markdown Editor Pro trên Edge THẬT với máy chủ THẬT (md-sync F11, đợt M4b, 24/10/2026).

Máy chủ uvicorn thật (`_kiem_chung.MayChuThat`: SQLite tạm, `MONGO_URI=""`, `RATE_LIMIT_BACKEND=memory`, kho json tạm, khoá quản trị
giả, cổng trống) phục vụ BẢN ĐÃ XUẤT BẢN `backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/` (chạy `node scripts/build-webapps.mjs
--only markdown-editor` trước). Kho đồng bộ là `mysql` — tức SQLite tạm qua đúng mã SQL của kho MySQL (DDL tạo bảng lúc chạy,
chuyển đổi lười, CAS). Không chạm database thật; không gọi Gemini.

  1. A→B        A tạo tài liệu (không nút lưu nào) → lên máy chủ; B (ngữ cảnh mới) thấy nó; trang chào nguyên bản không lên máy chủ
  2. ngoại tuyến B mất mạng rồi sửa ba lần → hàng đợi; có mạng lại → đúng MỘT yêu cầu push, một op; A nhận bản mới
  3. gộp         A và B sửa hai dòng khác nhau → tự gộp, không hỏi; cùng một dòng → "⚠ 1 conflict", bảng Sync, "Keep mine"
  4. delta       sửa 1 dòng của tài liệu 1 MB → thân yêu cầu push < 2 KB (patch), không phải nguyên văn
  5. khối lượng  200 tài liệu / ≈ 9 MB (thiết kế nói 7,4 MB: cố ý nặng hơn) đã có ở máy chủ → máy mới kéo hết, từng tài liệu đúng SHA-256, tải lại trang không mất chữ,
                 localStorage chỉ còn ảnh khởi động nhỏ
  6. client cũ   PUT /markdown/files (bản app cũ) → 409 md_legacy_client; GET /markdown/files dựng lại cây từ kho mới
  7. chuyển kho  workspace v2 (localStorage) → IndexedDB không mất chữ nào, khoá v2 thay bằng ảnh khởi động v3, tải lại vẫn đủ
  8. dự phòng    không có IndexedDB (cửa sổ riêng tư) → vẫn lưu ở khoá v2 như trước, sống qua tải lại
  4b. lô lớn    kho tiếng Việt 8 × 450.000 ký tự (3,6 triệu KÝ TỰ nhưng ≈ 5 MB BYTE) đồng bộ lần đầu → bộ gom lô chia theo byte UTF-8 như máy chủ
                đếm: không 400 md_push_too_large, mọi tài liệu lên đúng SHA-256, mỗi yêu cầu ≤ 4.000.000 (bản cũ đếm ký tự nên kẹt vĩnh viễn)
  9. toàn cục    không có yêu cầu PUT /markdown/files nào từ app mới; không pageerror

Dùng: `PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-dong-bo.py [--anh <thư-mục>] [--chi-lo-lon]`
(`--chi-lo-lon`: chỉ chạy bước 4b, cho nhanh khi sửa bộ gom lô.)
Exit code 0 khi mọi phép đạt.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from _kiem_chung import BAN_XUAT, MayChuThat, SoKiem, mo_trinh_duyet, utf8_console  # noqa: E402

BACKEND = "mysql"  # SQLite tạm qua mã kho MySQL
DEVICE_CLI = "md-kiem-cli"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------------------------------------------------
# Gọi thẳng API (người quản trị bằng khoá giả): để dựng sẵn dữ liệu và để đối chiếu với những gì máy chủ thật sự giữ.
# --------------------------------------------------------------------------------------------------------------------
def api(srv, method: str, path: str, body=None, expect=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(srv.api + path, method=method, data=data, headers={"X-Admin-Key": srv.khoa, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8")
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def server_docs(srv) -> dict:
    """id → bản ghi sống của máy chủ (kéo hết từ since=0, đủ chữ)."""
    out: dict = {}
    since = 0
    for _ in range(200):
        status, page = api(srv, "GET", f"/markdown/sync/changes?since={since}&backend={BACKEND}&device={DEVICE_CLI}")
        if status != 200:
            raise RuntimeError(f"changes → {status}: {page}")
        for item in page["items"]:
            if not item.get("deleted"):
                out[item["id"]] = item
        since = page["cursor"]
        if not page["more"]:
            break
    return out


def push_ops(srv, ops: list) -> None:
    status, answer = api(srv, "POST", f"/markdown/sync/push?backend={BACKEND}", {"device": DEVICE_CLI, "ops": ops})
    if status != 200:
        raise RuntimeError(f"push → {status}: {str(answer)[:300]}")
    bad = [r for r in answer["results"] if r["status"] != "ok"]
    if bad:
        raise RuntimeError(f"push có op không ok: {bad[:2]}")


def poll(cond, timeout: float = 30.0, step: float = 0.4):
    """Gọi `cond` đến khi nó trả giá trị thật hoặc hết giờ; trả giá trị cuối."""
    han = time.time() + timeout
    last = None
    while time.time() < han:
        try:
            last = cond()
        except Exception as exc:  # noqa: BLE001 - cond có thể gọi mạng
            last = None
            _ = exc
        if last:
            return last
        time.sleep(step)
    return last


# --------------------------------------------------------------------------------------------------------------------
# Trình duyệt
# --------------------------------------------------------------------------------------------------------------------
SEED_JS = """([settings, token, v2]) => {
  if (sessionStorage.getItem('__seeded')) return;
  sessionStorage.setItem('__seeded', '1');
  localStorage.setItem('markdown-editor:settings', JSON.stringify(settings));
  if (token) localStorage.setItem('markdown-editor:admin-session', token);
  if (v2) localStorage.setItem('markdown-editor:files', v2);
}"""

NO_IDB_JS = "Object.defineProperty(window, 'indexedDB', {value: undefined, configurable: true})"

# Đọc kho IndexedDB của app, rồi băm từng tài liệu bằng WebCrypto (không chuyển cả 7 MB chữ về Python).
READ_IDB_JS = """async () => {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('markdown-editor');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const all = (name) => new Promise((resolve, reject) => {
    const q = db.transaction(name).objectStore(name).getAll();
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  const docs = await all('docs'), outbox = await all('outbox'), shadows = await all('shadows'), meta = await all('meta');
  db.close();
  const enc = new TextEncoder();
  const hex = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))), (b) => b.toString(16).padStart(2, '0')).join('');
  const hashes = {};
  let chars = 0;
  for (const d of docs) { if (d.kind === 'file') { hashes[d.id] = await hex(d.content || ''); chars += (d.content || '').length } }
  return {count: docs.length, hashes, chars, names: Object.fromEntries(docs.map((d) => [d.id, d.name])), outbox: outbox.map((o) => o.id),
          shadows: shadows.length, meta: Object.fromEntries(meta.map((m) => [m.k, m.v]))};
}"""

IDB_EXISTS_JS = """async () => {
  const dbs = indexedDB.databases ? await indexedDB.databases() : [];
  return dbs.some((d) => d.name === 'markdown-editor');
}"""


class Sesion:
    """Lưu yêu cầu của mọi trang để kiểm 'không PUT cả kho' và đo thân push."""

    def __init__(self):
        self.requests: list[dict] = []
        self.page_errors: list[str] = []

    def theo_doi(self, page, ten: str):
        def on_request(req):
            try:
                body = req.post_data
            except Exception:  # noqa: BLE001
                body = None
            self.requests.append({"page": ten, "method": req.method, "url": req.url, "body": body, "t": time.time()})

        page.on("request", on_request)
        page.on("pageerror", lambda e: self.page_errors.append(f"{ten}: {str(e)[:300]}"))

    def marca(self, *pages) -> int:
        """Một mốc trong dòng yêu cầu. Trình xử lý sự kiện của API đồng bộ chỉ chạy khi script đang ở trong một lời gọi
        Playwright, nên trước khi lấy mốc (và trước khi đọc) phải cho các trang xả sự kiện."""
        for page in pages:
            page.wait_for_timeout(250)
        return len(self.requests)

    def push_cua(self, ten: str, tu: int = 0) -> list[dict]:
        return [r for r in self.requests[tu:] if r["page"] == ten and r["method"] == "POST" and "/markdown/sync/push" in r["url"]]


def settings(view="split", sync=True) -> dict:
    return {"theme": "light", "viewMode": view, "scrollSync": True, "showLineNumbers": True, "wordWrap": True, "sidebarTab": "files",
            "sidebarCollapsed": False, "backendStorage": sync, "backendStorageType": BACKEND}


def mo_ngu_canh(browser, srv, *, token: str | None, view="split", sync=True, v2: str | None = None, khong_idb=False):
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, service_workers="block")
    if khong_idb:
        ctx.add_init_script(NO_IDB_JS)
    ctx.add_init_script(f"({SEED_JS})({json.dumps([settings(view, sync), token, v2])})")
    return ctx


def mo_app(ctx, srv, ses: Sesion, ten: str, cho_quan_tri=True):
    page = ctx.new_page()
    ses.theo_doi(page, ten)
    page.on("dialog", lambda d: d.accept())
    page.goto(srv.app_url, wait_until="load")
    page.wait_for_selector(".editor-input", timeout=30000)
    if cho_quan_tri:
        page.wait_for_selector("button.role-chip.is-admin", timeout=30000)
    return page


def cho_dong_bo(page, timeout=60000):
    """Chờ chỉ báo của thanh trạng thái nói 'Synced …' hoặc 'Up to date …'."""
    page.wait_for_selector('button.status-sync:text-matches("^(Synced|Up to date)")', timeout=timeout)


def trang_thai(page) -> str:
    loc = page.locator("button.status-sync")
    return loc.first.inner_text().strip() if loc.count() else ""


def sync_ngay(page):
    page.get_by_role("button", name=re.compile(r"^Sync")).first.click()
    page.get_by_role("button", name=re.compile(r"^Sync now")).click()


def tao_tep(page, ten: str):
    page.get_by_role("button", name="New file", exact=True).click()
    page.fill('input[aria-label="New file name"]', ten)
    page.keyboard.press("Enter")
    page.wait_for_selector(f'[role="treeitem"]:has-text("{ten}")', timeout=10000)


def mo_tep(page, ten: str):
    page.locator(f'[role="treeitem"]:has-text("{ten}")').first.click()


def soan(page) -> str:
    return page.input_value(".editor-input")


PONER_JS = """(text) => {
  const ta = document.querySelector('.editor-input');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, text);
  ta.dispatchEvent(new Event('input', {bubbles: true}));
}"""


def poner(page, text: str):
    """Pone un texto grande de una vez (un solo evento `input`), sin el coste de `fill` en un textarea enorme."""
    page.evaluate(PONER_JS, text)


def doc_idb(page) -> dict:
    return page.evaluate(READ_IDB_JS)


def van_ban_viet(i: int, so_ky_tu: int) -> str:
    """Chữ tiếng Việt đúng `so_ky_tu` ký tự (≈ 1,3 byte UTF-8 mỗi ký tự), mỗi tài liệu một dấu vết riêng."""
    dong = f"Tiếng Việt có dấu, rất nhiều chữ ệ ở đây (tài liệu {i}).\n"
    return (dong * (so_ky_tu // len(dong) + 1))[:so_ky_tu]


def trong_luong_push(body: str) -> int:
    """Cách máy chủ thật tính cỡ một yêu cầu push: byte UTF-8 của chữ (hoặc của các dòng bản vá) + 200 mỗi op."""
    tong = 0
    for op in json.loads(body)["ops"]:
        tong += 200
        if op.get("content") is not None:
            tong += len(op["content"].encode("utf-8"))
        elif op.get("patch"):
            for _o, _d, dong in op["patch"]["h"]:
                tong += 16 + sum(len(x.encode("utf-8")) + 4 for x in dong)
    return tong


def buoc_lo_lon_viet(browser, srv, so: SoKiem, ses: Sesion, token: str):
    """4b. Lần đồng bộ đầu của một kho tiếng Việt nặng: 8 tài liệu × 450.000 ký tự = 3,6 triệu KÝ TỰ (bộ gom lô cũ đếm ký tự và
    chỉ kiểm trần TRƯỚC khi thêm tài liệu, nên gom hết vào một lô) nhưng ≈ 5 MB BYTE UTF-8 — máy chủ từ chối cả yêu cầu 400 `md_push_too_large` nếu > 4.000.000.
    Bộ gom lô cũ dựng đúng lô đó mãi nên không tài liệu nào lên được; bản đúng chia lô theo BYTE và mọi tài liệu lên máy chủ."""
    print("· 4b. kho tiếng Việt ≈ 5 MB (3,6 triệu ký tự) đồng bộ lần đầu: chia lô theo byte UTF-8")
    viet = [(f"vn{i}", f"viet-{i}.md", van_ban_viet(i, 450_000)) for i in range(8)]
    ky_tu = sum(len(t) for _, _, t in viet)
    byte = sum(len(t.encode("utf-8")) for _, _, t in viet)
    so.kiem(f"dữ liệu thử đúng ý đồ: {ky_tu} ký tự (bộ đếm ký tự cũ vẫn gom hết vào một lô) nhưng {byte} byte (> 4 triệu: máy chủ từ chối)", ky_tu < 3_700_000 and byte > 4_100_000, f"{ky_tu} ký tự, {byte} byte")
    v2 = json.dumps({"version": 2, "currentFileId": "vn0", "expandedFolders": ["root"], "files": [
        {"id": "root", "name": "Docs", "type": "folder", "children": [
            {"id": i, "name": n, "type": "file", "parentId": "root", "content": t} for i, n, t in viet]}]}, ensure_ascii=False)
    ctx = mo_ngu_canh(browser, srv, token=token, v2=v2)
    h = mo_app(ctx, srv, ses, "H")
    mark = ses.marca(h)
    want = {i: sha(t) for i, _, t in viet}
    def da_len_may_chu() -> bool:
        da_co = server_docs(srv)
        return all(da_co.get(i, {}).get("hash") == want[i] for i in want)

    len_ok = poll(da_len_may_chu, timeout=150, step=4.0)
    so.kiem("mọi tài liệu tiếng Việt lên máy chủ đúng SHA-256 (không kẹt ở 400 md_push_too_large)", bool(len_ok))
    try:
        cho_dong_bo(h, timeout=60000)
    except Exception:  # noqa: BLE001 - phép kiểm bên dưới ghi lại trạng thái thật
        pass
    so.kiem("thanh trạng thái báo 'Synced', không 'error' / 'queued'", trang_thai(h).startswith(("Synced", "Up to date")), trang_thai(h))
    ses.marca(h)
    pushes = [p for p in ses.push_cua("H", mark) if p["body"]]
    nang = [trong_luong_push(p["body"]) for p in pushes]
    so.kiem(f"nhiều hơn một yêu cầu push (chia lô), và mỗi yêu cầu ≤ 4.000.000 theo cách đếm của máy chủ ({nang})", len(pushes) >= 2 and max(nang) <= 4_000_000, str(nang))
    ctx.close()


def chay(browser, srv, so: SoKiem, ses: Sesion, shots: str | None, chi_lo_lon: bool = False):
    token = srv.phien_quan_tri()
    if chi_lo_lon:
        buoc_lo_lon_viet(browser, srv, so, ses, token)
        so.kiem("không pageerror", not ses.page_errors, " | ".join(ses.page_errors[:3]))
        return

    def snap(page, ten):
        if shots:
            page.screenshot(path=os.path.join(shots, ten + ".png"))

    # ------------------------------------------------------------------ 1. A → B
    print("· 1. A tạo tài liệu → máy chủ → B (ngữ cảnh mới)")
    ctx_a = mo_ngu_canh(browser, srv, token=token)
    a = mo_app(ctx_a, srv, ses, "A")
    cho_dong_bo(a)
    text_a = "# Ghi chú của A\n\n" + "\n".join(f"Dòng {i}: nội dung {i} của tài liệu hai thiết bị." for i in range(1, 11)) + "\n"
    tao_tep(a, "note-a.md")
    a.fill(".editor-input", text_a)
    on_server = poll(lambda: next((d for d in server_docs(srv).values() if d["name"] == "note-a.md" and d.get("content") == text_a), None), timeout=40)
    so.kiem("A gõ xong → tự đồng bộ nền: tài liệu và đúng chữ đã ở máy chủ (không bấm nút lưu)", bool(on_server), "máy chủ không có note-a.md đúng chữ")
    doc_id = on_server["id"] if on_server else ""
    so.kiem("trang chào nguyên bản (welcome.md) KHÔNG lên máy chủ như tài liệu của người dùng", "welcome" not in server_docs(srv), str(sorted(server_docs(srv))))
    snap(a, "1-a")

    ctx_b = mo_ngu_canh(browser, srv, token=token)
    b = mo_app(ctx_b, srv, ses, "B")
    cho_dong_bo(b)
    b.wait_for_selector('[role="treeitem"]:has-text("note-a.md")', timeout=20000)
    mo_tep(b, "note-a.md")
    b.wait_for_function("(t) => document.querySelector('.editor-input').value === t", arg=text_a, timeout=10000)
    so.kiem("B (máy mới, lần đầu) thấy tài liệu của A đúng từng chữ, không hộp thoại hỏi (chỉ có trang chào chưa sửa ở B)", soan(b) == text_a and b.locator("text=First sync with this server").count() == 0)
    ib = doc_idb(b)
    so.kiem("tài liệu của B nằm ở IndexedDB (không còn ở localStorage v2), đúng SHA-256", ib["hashes"].get(doc_id) == sha(text_a))
    ls = b.evaluate("() => localStorage.getItem('markdown-editor:files') || ''")
    so.kiem("localStorage của B chỉ có ảnh khởi động v3 nhỏ (không giữ cả kho)", '"version":3' in ls and len(ls) < 20000, f"{len(ls)} ký tự")
    snap(b, "1-b")

    # ------------------------------------------------------------------ 2. ngoại tuyến
    print("· 2. B mất mạng, sửa ba lần, có mạng lại")
    b_text = text_a.replace("Dòng 10:", "Dòng 10 (B sửa ngoại tuyến):")
    ctx_b.set_offline(True)
    b.fill(".editor-input", b_text + "một\n")
    b.fill(".editor-input", b_text + "một\nhai\n")
    b.fill(".editor-input", b_text + "một\nhai\nba\n")
    b_final = b_text + "một\nhai\nba\n"
    off = poll(lambda: "Offline" in trang_thai(b), timeout=25)
    so.kiem("mất mạng: thanh trạng thái báo 'Offline — … queued'", bool(off), trang_thai(b))
    b.set_viewport_size({"width": 360, "height": 740})
    b.wait_for_timeout(300)
    wide = b.evaluate("() => ({doc: document.documentElement.scrollWidth, win: window.innerWidth, "
                      "bar: (() => { const s = document.querySelector('.app-statusbar'); return s ? s.scrollWidth - s.clientWidth : 0 })()})")
    so.kiem("360 px: chỉ báo 'Offline — … queued' không làm trang hay thanh trạng thái cuộn ngang", wide["doc"] <= wide["win"] and wide["bar"] <= 1, json.dumps(wide))
    snap(b, "2-360")
    b.set_viewport_size({"width": 1280, "height": 800})
    time.sleep(1.0)
    so.kiem("ngoại tuyến: máy chủ chưa đổi", server_docs(srv).get(doc_id, {}).get("content") == text_a)
    mo = doc_idb(b)
    so.kiem("ngoại tuyến: các sửa nằm trong IndexedDB + hàng đợi (outbox) của B", mo["hashes"].get(doc_id) == sha(b_final) and doc_id in mo["outbox"])
    mark = ses.marca(b)
    ctx_b.set_offline(False)
    ok = poll(lambda: server_docs(srv).get(doc_id, {}).get("content") == b_final, timeout=45)
    so.kiem("có mạng lại: bản của B tự lên máy chủ", bool(ok))
    ses.marca(b)
    todos = ses.push_cua("B", mark)
    pushes = [p for p in todos if doc_id in (p["body"] or "")]
    ops_total = sum(len(json.loads(p["body"])["ops"]) for p in pushes)
    so.kiem("đúng MỘT op cho ba lần sửa (hàng đợi gộp theo tài liệu)", ops_total == 1,
            f"{len(pushes)} yêu cầu có tài liệu, {ops_total} op; tất cả push của B từ lúc nối lại: {len(todos)}, thân rỗng: {sum(1 for p in todos if not p['body'])}")
    sync_ngay(a)
    a.wait_for_function("(t) => document.querySelector('.editor-input').value === t", arg=b_final, timeout=30000)
    so.kiem("A nhận bản của B (đồng bộ ngược) và hiện ngay trong trình soạn", soan(a) == b_final)

    # ------------------------------------------------------------------ 3. gộp và xung đột
    print("· 3. hai máy sửa khác dòng → tự gộp; cùng dòng → hộp chọn")
    ctx_b.set_offline(True)
    a_text = b_final.replace("Dòng 2:", "Dòng 2 (A):")
    a.fill(".editor-input", a_text)
    ok = poll(lambda: server_docs(srv).get(doc_id, {}).get("content") == a_text, timeout=40)
    so.kiem("A sửa dòng 2 → máy chủ", bool(ok))
    b_merge = b_final.replace("Dòng 9:", "Dòng 9 (B):")
    b.fill(".editor-input", b_merge)
    time.sleep(1.0)
    ctx_b.set_offline(False)
    want = a_text.replace("Dòng 9:", "Dòng 9 (B):")
    ok = poll(lambda: server_docs(srv).get(doc_id, {}).get("content") == want, timeout=45)
    so.kiem("B sửa dòng 9 ngoại tuyến → nối lại: tự gộp với dòng 2 của A, không hỏi, kết quả lên máy chủ", bool(ok))
    so.kiem("B hiện bản đã gộp trong trình soạn, không có xung đột", soan(b) == want and "conflict" not in trang_thai(b))
    sync_ngay(a)
    a.wait_for_function("(t) => document.querySelector('.editor-input').value === t", arg=want, timeout=30000)

    ctx_b.set_offline(True)
    a_same = want.replace("Dòng 5:", "Dòng 5 (A cùng dòng):")
    a.fill(".editor-input", a_same)
    poll(lambda: server_docs(srv).get(doc_id, {}).get("content") == a_same, timeout=40)
    b_same = want.replace("Dòng 5:", "Dòng 5 (B cùng dòng):")
    b.fill(".editor-input", b_same)
    time.sleep(1.0)
    ctx_b.set_offline(False)
    conf = poll(lambda: "conflict" in trang_thai(b), timeout=45)
    so.kiem("cùng một dòng → thanh trạng thái báo '⚠ 1 conflict'", bool(conf), trang_thai(b))
    so.kiem("xung đột chưa ghi đè gì: máy chủ vẫn giữ bản của A, B vẫn giữ bản của B", server_docs(srv).get(doc_id, {}).get("content") == a_same and soan(b) == b_same)
    b.locator("button.status-sync").click()
    b.wait_for_selector('[role="dialog"][aria-labelledby="sync-title"]', timeout=10000)
    so.kiem("bảng Sync liệt kê tài liệu xung đột với ba lựa chọn", b.get_by_role("button", name="Keep mine").count() == 1 and b.get_by_role("button", name="Use the server's").count() == 1 and b.get_by_role("button", name="Keep both").count() == 1)
    snap(b, "3-xung-dot")
    b.get_by_role("button", name="Keep mine").click()
    ok = poll(lambda: server_docs(srv).get(doc_id, {}).get("content") == b_same, timeout=45)
    so.kiem("'Keep mine': bản của B lên máy chủ, hết xung đột", bool(ok) and poll(lambda: "conflict" not in trang_thai(b), timeout=20))
    b.keyboard.press("Escape")

    # ------------------------------------------------------------------ 4. delta của tài liệu 1 MB
    print("· 4. sửa 1 dòng của tài liệu 1 MB")
    ctx_c = mo_ngu_canh(browser, srv, token=token, view="editor")
    c = mo_app(ctx_c, srv, ses, "C")
    cho_dong_bo(c)
    big = "\n".join(f"Dòng {i:05d}: " + ("chữ Việt có dấu ệ ư ơ và English words " * 1 + f"#{i}") for i in range(16500)) + "\n"
    tao_tep(c, "big.md")
    poner(c, big)
    big_srv = poll(lambda: next((d for d in server_docs(srv).values() if d["name"] == "big.md" and d.get("content") == big), None), timeout=90)
    so.kiem(f"tài liệu {len(big.encode('utf-8')) / 1e6:.2f} MB lên máy chủ đúng chữ", bool(big_srv))
    if big_srv:
        c.wait_for_selector('button.status-sync:text-matches("^Synced")', timeout=60000)
        mark = ses.marca(c)
        edited = big.replace("Dòng 08000: ", "Dòng 08000 (SỬA): ", 1)
        poner(c, edited)
        ok = poll(lambda: server_docs(srv).get(big_srv["id"], {}).get("content") == edited, timeout=90)
        ses.marca(c)
        lan = [p for p in ses.push_cua("C", mark) if big_srv["id"] in (p["body"] or "")]
        kich = [len(p["body"].encode("utf-8")) for p in lan]
        so.kiem("sửa 1 dòng của tài liệu 1 MB: máy chủ có bản mới đúng chữ", bool(ok))
        so.kiem(f"thân yêu cầu push < 2 KB và là bản vá (patch), không phải nguyên văn ({kich} byte)", bool(kich) and max(kich) < 2000 and '"patch"' in lan[-1]["body"] and '"content"' not in lan[-1]["body"], str(kich))
    ctx_c.close()

    # ------------------------------------------------------------------ 5. 200 tài liệu / ~7,5 MB
    print("· 5. máy mới kéo 200 tài liệu / ≈ 9 MB")
    docs = []
    for i in range(150):
        docs.append((f"f{i:03d}", f"nhỏ-{i:03d}.md", "\n".join(f"Mục {i}.{j}: một đoạn văn nhỏ có dấu tiếng Việt ệ ữ ơ, số {i * j}." for j in range(55)) + "\n"))
    for i in range(40):
        docs.append((f"m{i:03d}", f"vừa-{i:03d}.md", "\n".join(f"Mục {i}.{j}: đoạn văn cỡ vừa, nhiều chữ hơn để đủ 40 KB mỗi tài liệu, số {i * j}. " + "lorem ipsum " * 6 for j in range(250)) + "\n"))
    for i in range(6):
        docs.append((f"l{i:03d}", f"lớn-{i:03d}.md", "\n".join(f"Dòng {j} của tài liệu lớn {i}: " + "văn bản dài lặp lại " * 9 for j in range(1150)) + "\n"))
    for i in range(4):
        docs.append((f"x{i:03d}", f"1MB-{i:03d}.md", "\n".join(f"Dòng {j:05d} của tài liệu 1 MB số {i}: " + "chữ để đủ một megabyte " * 2 for j in range(10000)) + "\n"))
    total = sum(len(t.encode("utf-8")) for _, _, t in docs)
    # Một thư mục gốc 'root' đã có (do A tạo); đẩy theo lô ≤ 3 MB chữ.
    batch: list = []
    size = 0
    for doc_id5, name, text in docs:
        op = {"id": doc_id5, "kind": "file", "baseRev": 0, "set": {"name": name, "parentId": "root"}, "content": text, "hash": sha(text), "updatedAt": int(time.time() * 1000)}
        if batch and size + len(text.encode("utf-8")) > 3_000_000:
            push_ops(srv, batch)
            batch, size = [], 0
        batch.append(op)
        size += len(text.encode("utf-8"))
    if batch:
        push_ops(srv, batch)
    print(f"  · đã dựng {len(docs)} tài liệu, {total / 1e6:.2f} MB ở máy chủ")

    ctx_d = mo_ngu_canh(browser, srv, token=token, view="editor")
    d = mo_app(ctx_d, srv, ses, "D")
    t2 = time.time()
    want_ids = {doc_id5 for doc_id5, _, _ in docs}
    pulled = poll(lambda: want_ids <= set(doc_idb(d)["hashes"]), timeout=180, step=1.0)
    giay = time.time() - t2
    so.kiem(f"máy mới kéo đủ {len(docs)} tài liệu về IndexedDB ({total / 1e6:.2f} MB, {giay:.1f} s)", bool(pulled))
    snap_idb = doc_idb(d)
    sai = [i for i, _, t in docs if snap_idb["hashes"].get(i) != sha(t)]
    so.kiem("mọi tài liệu đúng SHA-256 từng byte (không mất, không hỏng chữ)", not sai, f"{len(sai)} sai: {sai[:3]}")
    cho_dong_bo(d, timeout=120000)
    ls = d.evaluate("() => (localStorage.getItem('markdown-editor:files') || '').length")
    so.kiem(f"localStorage chỉ còn ảnh khởi động nhỏ ({ls} ký tự, so với {total} ký tự của cả kho)", ls < 40000, str(ls))
    d.reload(wait_until="load")
    d.wait_for_selector(".editor-input", timeout=30000)
    d.wait_for_selector('[role="treeitem"]:has-text("1MB-003.md")', timeout=30000)
    again = doc_idb(d)
    sai2 = [i for i, _, t in docs if again["hashes"].get(i) != sha(t)]
    so.kiem("tải lại trang: vẫn đủ 200+ tài liệu, đúng SHA-256", not sai2 and again["count"] >= len(docs), f"{again['count']} bản ghi, {len(sai2)} sai")
    mo_tep(d, "1MB-002.md")
    want_text = next(t for i, n, t in docs if n == "1MB-002.md")
    d.wait_for_function("(n) => document.querySelector('.editor-input').value.length === n", arg=len(want_text), timeout=60000)
    so.kiem("mở tài liệu 1 MB từ kho cục bộ hiện đủ chữ", soan(d) == want_text)
    snap(d, "5-d")
    ctx_d.close()

    # ------------------------------------------------------------------ 6. client cũ
    print("· 6. bản app cũ gọi PUT /markdown/files")
    status, answer = api(srv, "PUT", f"/markdown/files?backend={BACKEND}", {"files": [{"id": "x", "name": "x.md", "type": "file", "content": "ghi đè kho"}]})
    code = (answer or {}).get("data", {}).get("code") if isinstance(answer, dict) else None
    so.kiem("PUT /markdown/files của client cũ → 409 md_legacy_client (mặc định reject)", status == 409 and code == "md_legacy_client", f"{status} {code}")
    status, answer = api(srv, "GET", f"/markdown/files?backend={BACKEND}")
    ids = set()

    def walk(nodes):
        for n in nodes:
            ids.add(n["id"])
            walk(n.get("children") or [])

    walk((answer or {}).get("files", [])) if isinstance(answer, dict) else None
    so.kiem("GET /markdown/files dựng lại cây từ kho mới (đủ tài liệu, không có tài liệu 'x' của client cũ)", status == 200 and want_ids <= ids and "x" not in ids, f"{status}, {len(ids)} nút")
    ctx_b.close()
    ctx_a.close()

    # ------------------------------------------------------------------ 7. localStorage v2 → IndexedDB
    print("· 7. workspace v2 (localStorage) → IndexedDB")
    seed_docs = {
        "small": ("nhỏ.md", "# Tài liệu nhỏ\n\nChữ Việt: ệ ữ ơ ư — emoji 😀 và \\( x^2 \\) cùng dấu \\ ngược.\n"),
        "big": ("lớn.md", "\n".join(f"Dòng {i}: " + "nội dung dài để vượt ngưỡng ảnh khởi động " * 3 for i in range(4600)) + "\n"),
        "inner": ("trong.md", "Trong thư mục con.\n"),
    }
    assert len(seed_docs["big"][1]) > 512 * 1024
    v2 = json.dumps({"version": 2, "currentFileId": "small", "expandedFolders": ["root", "sub"], "files": [
        {"id": "root", "name": "Docs", "type": "folder", "children": [
            {"id": "small", "name": seed_docs["small"][0], "type": "file", "parentId": "root", "content": seed_docs["small"][1]},
            {"id": "big", "name": seed_docs["big"][0], "type": "file", "parentId": "root", "content": seed_docs["big"][1]},
            {"id": "sub", "name": "Con", "type": "folder", "parentId": "root", "children": [
                {"id": "inner", "name": seed_docs["inner"][0], "type": "file", "parentId": "sub", "content": seed_docs["inner"][1]}]}]}]})
    ctx_e = mo_ngu_canh(browser, srv, token=None, sync=False, v2=v2)
    e = ctx_e.new_page()
    ses.theo_doi(e, "E")
    e.goto(srv.app_url, wait_until="load")
    e.wait_for_selector(".editor-input", timeout=30000)
    first = soan(e)
    so.kiem("khung đầu là tài liệu đang mở của workspace v2 (không phải trang chào)", first == seed_docs["small"][1], first[:40])
    swapped = poll(lambda: '"version":3' in (e.evaluate("() => localStorage.getItem('markdown-editor:files') || ''")), timeout=30)
    so.kiem("khoá v2 được thay bằng ảnh khởi động v3 sau khi đã chép + đọc lại", bool(swapped))
    ls = e.evaluate("() => localStorage.getItem('markdown-editor:files') || ''")
    so.kiem("ảnh khởi động không chứa chữ của tài liệu lớn (đã giải phóng hạn mức localStorage)", "nội dung dài để vượt ngưỡng" not in ls and len(ls) < 20000, f"{len(ls)} ký tự")
    got = doc_idb(e)
    want7 = {k: sha(v[1]) for k, v in seed_docs.items()}
    so.kiem("IndexedDB giữ đủ cả ba tài liệu, đúng SHA-256 từng byte (kể cả tài liệu > 512 KB, emoji, dấu \\)", all(got["hashes"].get(k) == h for k, h in want7.items()), json.dumps({k: got["hashes"].get(k) == h for k, h in want7.items()}))
    so.kiem("ghi nhận lần chuyển trong meta (migratedFromLocalStorage, 5 nút)", (got["meta"].get("migratedFromLocalStorage") or {}).get("count") == 5, str(got["meta"].get("migratedFromLocalStorage")))
    e.reload(wait_until="load")
    e.wait_for_selector(".editor-input", timeout=30000)
    mo_tep(e, "lớn.md")
    e.wait_for_function("(n) => document.querySelector('.editor-input').value.length === n", arg=len(seed_docs["big"][1]), timeout=30000)
    so.kiem("tải lại: mở tài liệu lớn (chữ nằm ở IndexedDB, không ở ảnh khởi động) vẫn đủ chữ", soan(e) == seed_docs["big"][1])
    mo_tep(e, "trong.md")
    e.wait_for_function("(t) => document.querySelector('.editor-input').value === t", arg=seed_docs["inner"][1], timeout=10000)
    so.kiem("thư mục con và tài liệu trong đó còn nguyên", soan(e) == seed_docs["inner"][1])
    ctx_e.close()

    # ------------------------------------------------------------------ 8. không có IndexedDB
    print("· 8. không có IndexedDB (cửa sổ riêng tư): dự phòng localStorage")
    ctx_f = mo_ngu_canh(browser, srv, token=None, sync=False, v2=v2, khong_idb=True)
    f = ctx_f.new_page()
    ses.theo_doi(f, "F")
    f.goto(srv.app_url, wait_until="load")
    f.wait_for_selector(".editor-input", timeout=30000)
    so.kiem("không có IndexedDB: khung đầu vẫn là tài liệu đang mở", soan(f) == seed_docs["small"][1])
    f.evaluate("() => { document.querySelector('.editor-input').readOnly && 0 }")
    # Khách (không token) không sửa được: dùng phiên quản trị để sửa.
    ctx_f.close()
    ctx_g = mo_ngu_canh(browser, srv, token=token, sync=False, v2=v2, khong_idb=True)
    g = mo_app(ctx_g, srv, ses, "G")
    g.fill(".editor-input", "sửa khi không có IndexedDB ✓")
    saved = poll(lambda: "sửa khi không có IndexedDB" in (g.evaluate("() => localStorage.getItem('markdown-editor:files') || ''")), timeout=15)
    so.kiem("không có IndexedDB: bản sửa được lưu vào khoá v2 của localStorage như trước", bool(saved))
    so.kiem("không có IndexedDB: khoá vẫn là v2 (không ghi ảnh khởi động rỗng đè lên)", '"version":2' in g.evaluate("() => localStorage.getItem('markdown-editor:files') || ''"))
    g.reload(wait_until="load")
    g.wait_for_selector(".editor-input", timeout=30000)
    so.kiem("không có IndexedDB: tải lại vẫn còn bản sửa", soan(g) == "sửa khi không có IndexedDB ✓")
    ctx_g.close()

    # ------------------------------------------------------------------ 4b. lô lớn tiếng Việt (đặt sau cùng cho khỏi kéo dài các bước trước)
    buoc_lo_lon_viet(browser, srv, so, ses, token)

    # ------------------------------------------------------------------ 9. toàn cục
    puts = [r for r in ses.requests if r["method"] == "PUT" and "/markdown/files" in r["url"]]
    so.kiem("app mới KHÔNG gọi PUT /markdown/files lần nào (cả phiên kiểm)", not puts, str(len(puts)))
    so.kiem("không pageerror trong suốt phiên kiểm", not ses.page_errors, " | ".join(ses.page_errors[:3]))


def main() -> int:
    utf8_console()
    shots = None
    if "--anh" in sys.argv:
        shots = sys.argv[sys.argv.index("--anh") + 1]
        os.makedirs(shots, exist_ok=True)
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        print("Thiếu playwright — bỏ qua phép kiểm trình duyệt")
        return 2
    if not os.path.isfile(os.path.join(BAN_XUAT, "index.html")):
        print("Chưa có bản xuất bản — chạy: node scripts/build-webapps.mjs --only markdown-editor")
        return 2

    so = SoKiem()
    ses = Sesion()
    srv = MayChuThat()
    try:
        srv.start()
        print(f"Máy chủ thật: {srv.base} (SQLite + kho json tạm ở {srv.tmp})")
        with sync_playwright() as pw:
            browser, kenh = mo_trinh_duyet(pw)
            if browser is None:
                print("Không mở được Edge/Chrome")
                return 2
            print(f"Trình duyệt: {kenh}")
            try:
                chay(browser, srv, so, ses, shots, chi_lo_lon="--chi-lo-lon" in sys.argv)
            finally:
                browser.close()
    except Exception as exc:  # noqa: BLE001
        so.kiem("script chạy hết không ngoại lệ", False, repr(exc)[:400])
        import traceback
        traceback.print_exc()
        print("--- nhật ký máy chủ (cuối) ---")
        print(srv.nhat_ky()[-1500:])
    finally:
        srv.cleanup()
    return so.tong_ket("\n" + "=" * 60 + "\n")


if __name__ == "__main__":
    sys.exit(main())
