# -*- coding: utf-8 -*-
"""Tầng trình duyệt: nhóm người + sổ "Các khoản chung" (lọc, phân trang, cuộn) và nhập bằng AI.

AI không bao giờ gọi Gemini thật ở đây: bước đầu dùng máy chủ thật (selftest đặt AI_ENABLED=false nên
trang phải nói rõ "AI đang tắt"), bước sau giả lập /ai/* bằng page.route để kiểm cả luồng mở khoá bằng
mã, những gì trang gửi lên (chỉ tên + id, không số dư) và việc chọn từng khoản trước khi lưu.
"""
from __future__ import annotations

import json
import time

from browser_checks import Tab, snap


def groups_flow(browser, base, check, shots, out):
    print("  · nhóm người: tạo nhóm, chia cả nhóm, quyết toán nhóm, sổ khoản chung có lọc/phân trang/cuộn")
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    t = Tab(ctx, base)
    p = t.page
    ev = p.evaluate
    t.open()
    ev("""() => QL.app.apply(d => { d = QL.model.upsert(d, 'people', {id:'p_x', name:'Phúc', archived:false});
        return QL.model.upsert(d, 'people', {id:'p_l', name:'Lan', archived:false}); })""")
    t.go("chia-tien")
    check("Chia tiền: chưa có nhóm → có gợi ý tạo nhóm", "Đi chung nhiều người?" in t.text())

    # --- tạo nhóm qua giao diện, thêm người mới ngay trong hộp
    p.click('.view-head [data-act="group-new"]')
    p.fill('dialog input[name="name"]', "Phòng trọ")
    p.check('dialog [data-mid="p_x"]')
    p.check('dialog [data-mid="p_l"]')
    p.fill("#gm-new", "Nam")
    p.press("#gm-new", "Enter")
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    doc = t.docs()
    g = doc["groups"][0] if doc["groups"] else {}
    gid = g.get("id")
    names = sorted(x["name"] for x in doc["people"] if x["id"] in g.get("memberIds", []))
    check("tạo nhóm: 3 thành viên (Nam thêm ngay trong hộp), thành nhóm mặc định", names == ["Lan", "Nam", "Phúc"] and doc["settings"]["defaultGroupId"] == gid, json.dumps(g, ensure_ascii=False))

    # --- nhập nhanh nhắc tên nhóm
    t.quick_add("lẩu 600k nhóm phòng trọ")
    p.wait_for_selector(".toast")
    tx = ev("() => QL.app.engine.getDoc().transactions.slice(-1)[0]") or {}
    shares = sorted((tx.get("split") or {}).get("shares", {}).values())
    check("nhập nhanh 'lẩu 600k nhóm phòng trọ' → chia 4 người, mỗi người 150.000, gắn nhóm", tx.get("groupId") == gid and shares == [150000] * 4, json.dumps(tx, ensure_ascii=False)[:300])

    # --- nhập tay: "Chi chung" tự chọn nhóm mặc định; người khác trả
    ev("() => { QL.dialogs.tx({}); }")
    p.fill("#tx-amt", "90k")
    p.check("#tx-shared")
    check("nhập tay: bấm 'Chi chung' → tự chọn nhóm mặc định, chia đủ 4 người", p.input_value("#tx-group") == gid and p.inner_text("#tx-split-sum").count("22.500") == 4, p.inner_text("#tx-split-sum"))
    p.select_option("#tx-payer", "p_l")
    p.click('dialog [data-cat="c_food"]')
    p.click("dialog [data-save]")
    p.wait_for_selector("dialog", state="detached")
    tx2 = ev("() => QL.app.engine.getDoc().transactions.slice(-1)[0]") or {}
    check("lưu: Lan trả hộ, thuộc nhóm, không trừ tài khoản của bạn", tx2.get("groupId") == gid and (tx2.get("split") or {}).get("paidBy") == "p_l" and tx2.get("accountId") is None)

    t.go("chia-tien")
    card = p.inner_text(".card:has([data-act='group-settle'])")
    check("thẻ nhóm: 'Nhóm nợ bạn 427.500 ₫' (450.000 lẩu − 22.500 phần của bạn khi Lan trả) + từng người", "Nhóm nợ bạn" in card and "427.500" in card and "Phúc nợ bạn 150.000" in card, card.replace("\n", " | "))
    check("thẻ người có huy hiệu nhóm", "Phòng trọ" in p.inner_text(".card:has([data-act='settle'][data-id='p_x'])"))
    snap(t, shots, out, "30-nhom")

    # --- quyết toán nhóm: tin nhắn + ghi nhận phần của bạn
    p.click('[data-act="group-settle"]')
    p.wait_for_selector("#gs-out table")
    p.select_option('dialog select[name="per"]', "all")
    msg = p.input_value("#gs-msg")
    check("quyết toán nhóm: tin nhắn có kỳ, từng người, cách chuyển", msg.startswith("Quyết toán nhóm Phòng trọ — Tất cả") and "Lan: đã trả 90.000" in msg and "Chuyển tiền:" in msg, msg[-400:])
    snap(t, shots, out, "31-quyet-toan-nhom")
    p.check('dialog input[name="rec-p_x"]')
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    gb = ev("gid => QL.ledger.personBalances(QL.app.engine.getDoc(), gid)", gid)
    st = ev("gid => QL.app.engine.getDoc().transactions.filter(t => t.type === 'settle' && t.groupId === gid).length", gid)
    check("ghi nhận Phúc chuyển 150.000 vào nhóm → Phúc hết nợ trong nhóm, người khác giữ nguyên", gb.get("p_x") == 0 and gb.get("p_l") == 127500 and st == 1, json.dumps(gb))

    # --- 600 khoản chung: lọc, phân trang, cuộn
    ev("""gid => QL.app.apply(d => { let x = d; const ids = ['p_me', 'p_x', 'p_l'];
        for (let i = 0; i < 600; i++) {
          const a = 30000 + (i % 7) * 10000, parts = QL.money.allocate(a, [1, 1, 1]), payer = ids[i % 3];
          x = QL.model.upsert(x, 'transactions', { id: 'gx' + i, type: 'expense', date: QL.dates.addDays(QL.dates.today(), -(i % 180)), amount: a, categoryId: 'c_food',
            accountId: payer === 'p_me' ? 'a_cash' : null, note: 'Bữa ' + i, tags: [], groupId: gid, split: { paidBy: payer, shares: { p_me: parts[0], p_x: parts[1], p_l: parts[2] } } });
        }
        return x; })""", gid)
    t.go("chia-tien")
    p.click('[data-act="group-detail"]')
    p.wait_for_selector("#sl-out .item")
    total = ev("gid => QL.ledger.sharedLedger(QL.app.engine.getDoc(), {groupId: gid}).count", gid)
    more = p.inner_text("[data-more]") if p.locator("[data-more]").count() else ""
    check(f"Các khoản chung (nhóm, {total} khoản): chỉ vẽ 50 dòng đầu, có 'Hiện thêm'", p.locator("#sl-out .item").count() == 50 and f"còn {total - 50}" in more, more)
    p.click("[data-more]")
    focused = ev("() => [...document.querySelectorAll('#sl-out .item')].indexOf(document.activeElement)")
    check("'Hiện thêm' → 100 dòng, con trỏ bàn phím nhảy tới dòng mới đầu tiên", p.locator("#sl-out .item").count() == 100 and focused == 50, str(focused))

    month = ev("() => document.querySelector('#sl-month').options[1].value")
    p.select_option("#sl-month", month)
    want = ev("([gid, m]) => { const per = QL.dates.period('month', m + '-01'); return QL.ledger.sharedLedger(QL.app.engine.getDoc(), {groupId: gid}, {from: per.from, to: per.to}).count; }", [gid, month])
    check(f"lọc tháng {month}: {want} khoản, tổng ghi đúng trong bộ lọc", p.locator("#sl-out .item").count() == min(50, want) and f"Trong bộ lọc: {want} khoản" in p.inner_text("#sl-sum"), p.inner_text("#sl-sum"))
    p.click('[data-step="1"]')
    check("nút ‹ lùi một tháng", p.input_value("#sl-month") == ev("() => document.querySelector('#sl-month').options[2].value"))
    p.select_option("#sl-month", "")
    p.select_option("#sl-member", "p_l")
    p.select_option("#sl-payer", "other")
    p.fill("#sl-q", "bữa 1")
    p.wait_for_timeout(350)
    want2 = ev("gid => QL.ledger.sharedLedger(QL.app.engine.getDoc(), {groupId: gid}, {memberId: 'p_l', payer: 'other', q: 'bữa 1'}).count", gid)
    check(f"lọc thành viên + ai trả + tìm kiếm: {want2} khoản (khớp ledger.sharedLedger)", 0 < want2 < total and f"Trong bộ lọc: {want2} khoản" in p.inner_text("#sl-sum") and p.locator("#sl-out .item").count() == min(50, want2), p.inner_text("#sl-sum"))
    p.fill("#sl-q", "")
    p.select_option("#sl-member", "")
    p.select_option("#sl-payer", "")
    p.wait_for_timeout(300)
    gap = ev("() => { const b = document.querySelector('dialog .dlg-body'); b.scrollTop = 4000; return new Promise(r => requestAnimationFrame(() => r(document.querySelector('.sl-bar').getBoundingClientRect().top - b.getBoundingClientRect().top))); }")
    check("cuộn danh sách dài: thanh lọc vẫn dính trên đầu hộp thoại", abs(gap) <= 2, str(gap))
    snap(t, shots, out, "32-khoan-chung-nhom")
    p.set_viewport_size({"width": 390, "height": 844})
    p.wait_for_timeout(200)
    wide = ev("() => { const d = document.querySelector('dialog'); return d.scrollWidth - d.clientWidth; }")
    check("điện thoại 390px: hộp khoản chung không tràn ngang", wide <= 1, str(wide))
    snap(t, shots, out, "33-khoan-chung-dien-thoai")
    p.set_viewport_size({"width": 1280, "height": 900})
    p.keyboard.press("Escape")

    # --- với một người: lọc theo nhóm
    p.click('[data-act="person-detail"][data-id="p_x"]')
    p.wait_for_selector("#sl-group")
    p.select_option("#sl-group", "none")
    check("Các khoản chung với Phúc: lọc 'Không thuộc nhóm' → không còn khoản nào", "Không có khoản nào khớp bộ lọc" in p.inner_text("#sl-out"))
    p.keyboard.press("Escape")
    check("nhóm: không lỗi console", not t.errors, "; ".join(t.errors))
    ctx.close()


AI_STATUS_CODE = {"enabled": True, "access": "code", "allowed": False, "needs": "code", "admin": False, "model": "gemini-2.5-flash",
                  "limits": {"perMinute": 12, "perDay": 200}}


def ai_flow(browser, base, check, shots, out):
    print("  · nhập bằng AI (máy chủ thật với AI tắt; rồi AI giả lập qua page.route)")
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
    t = Tab(ctx, base)
    p = t.page
    ev = p.evaluate
    t.open()
    ev("""() => QL.app.apply(d => { d = QL.model.upsert(d, 'people', {id:'p_x', name:'Phúc', archived:false});
        d = QL.model.upsert(d, 'people', {id:'p_l', name:'Lan', archived:false});
        return QL.model.upsert(d, 'groups', {id:'g_tro', name:'Phòng trọ', memberIds:['p_x', 'p_l'], archived:false, order:0}); })""")
    spending_calls = []
    p.on("request", lambda r: spending_calls.append(r.url) if "/ai/spending" in r.url else None)

    # 1. máy chủ thật: selftest chạy với AI_ENABLED=false
    t.go("giao-dich")
    p.click('[data-act="import-ai"]')
    p.wait_for_function("() => (document.querySelector('#it-ai-state') || {}).textContent")
    p.fill("#it-text", "cơm 57k")
    p.click("dialog [data-ai]")
    p.wait_for_timeout(300)
    check("AI trên máy chủ thật đang tắt → nói rõ, không gửi văn bản đi", "AI đang tắt" in p.inner_text("#it-ai-state") and not spending_calls, p.inner_text("#it-ai-state"))
    p.keyboard.press("Escape")

    # 2. AI giả lập: cần mã → mở khoá → đề xuất → chọn → lưu
    state = {"status": dict(AI_STATUS_CODE)}
    seen = {}
    today = ev("() => QL.dates.today()")
    answer = {"transactions": [
        {"type": "expense", "date": today, "amount": 57000, "note": "Cơm trưa", "categoryId": "c_food", "accountId": None, "paidBy": {"id": "p_me"},
         "participants": [{"id": "p_me"}, {"id": "p_x"}], "splitCount": 0, "groupId": None, "shares": [], "source": "trưa nay cơm 57k chia đôi với Phúc", "confidence": 0.95, "warnings": []},
        {"type": "expense", "date": today, "amount": 600000, "note": "Lẩu", "categoryId": "c_food", "accountId": None, "paidBy": {"id": "p_x"},
         "participants": [], "splitCount": 0, "groupId": "g_tro", "shares": [], "source": "tối Phúc trả lẩu 600k cả phòng", "confidence": 0.85, "warnings": []},
        {"type": "expense", "date": today, "amount": 90000, "note": "Cà phê", "categoryId": None, "accountId": None, "paidBy": {"name": "Nam"},
         "participants": [{"id": "p_me"}, {"name": "Nam"}], "splitCount": 0, "groupId": None, "shares": [], "source": "Nam trả cà phê 90k", "confidence": 0.5, "warnings": ["Không rõ ngày — tạm lấy hôm nay"]}],
        "ignored": [{"text": "Tổng hôm nay: 747k", "reason": "Dòng tổng"}]}

    def reply(route, status, body):
        route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

    def on_session(route):
        if (route.request.post_data_json or {}).get("code") != "ma-dung":
            return reply(route, 403, {"success": False, "message": "Mã truy cập AI không đúng", "data": {"code": "ai_code_invalid"}})
        state["status"] = dict(AI_STATUS_CODE, allowed=True, needs=None)
        reply(route, 200, {"ok": True, "session": "tok-123", "expiresAt": int(time.time()) + 86400})

    def on_spending(route):
        seen["headers"] = route.request.headers
        seen["body"] = route.request.post_data_json
        reply(route, 200, answer)

    p.route("**/ai/status", lambda route: reply(route, 200, state["status"]))
    p.route("**/ai/session", on_session)
    p.route("**/ai/spending", on_spending)
    text = "trưa nay cơm 57k chia đôi với Phúc\ntối Phúc trả lẩu 600k cả phòng\nNam trả cà phê 90k\nTổng hôm nay: 747k"
    ev("() => { QL.dialogs.importText({ai: true}); }")
    p.wait_for_function("() => /mã truy cập/.test((document.querySelector('#it-ai-state') || {}).textContent || '')")
    p.fill("#it-text", text)
    p.click("dialog [data-ai]")
    p.wait_for_selector("#it-code")
    check("AI cần mã: hiện ô nhập mã ngay trong hộp", p.locator("#it-code").count() == 1)
    p.fill("#it-code", "sai")
    p.press("#it-code", "Enter")
    p.wait_for_function("() => /không đúng/.test(document.querySelector('#it-ai-state').textContent)")
    check("mã sai → báo lỗi, chưa gửi văn bản", not spending_calls)
    p.fill("#it-code", "ma-dung")
    p.press("#it-code", "Enter")
    p.wait_for_selector("#it-out table")
    body = seen.get("body") or {}
    check("mở khoá xong tự gửi lại; header X-AI-Session mang token vừa cấp", (seen.get("headers") or {}).get("x-ai-session") == "tok-123")
    check("trang chỉ gửi văn bản + TÊN/id (không số dư, không giao dịch cũ)",
          set(body) == {"text", "today", "me", "categories", "accounts", "people", "groups"} and body.get("text") == text and body.get("me") == "p_me"
          and set(body["categories"][0]) == {"id", "name", "kind"} and "openingBalance" not in json.dumps(body) and "transactions" not in body
          and {x["id"] for x in body["people"]} == {"p_x", "p_l"}, json.dumps(body, ensure_ascii=False)[:300])
    key = ev("() => localStorage.getItem('ai.phien@' + new URL('/api/v1', location.href).href)") or ""
    check("token AI cất đúng khoá của ai-khach.js (dùng chung với trang khác)", "tok-123" in key, key)
    table = p.inner_text("#it-out")
    check("bảng xem trước: 3 khoản + dòng bỏ qua, người mới, cờ 'nên kiểm lại'",
          "Bỏ qua — Dòng tổng" in table and "Sẽ thêm người mới: Nam" in table and "nên kiểm lại" in table and "nhóm Phòng trọ" in table and p.inner_text("dialog [data-do]") == "Nhập 3 khoản",
          table.replace("\n", " | ")[:400])
    snap(t, shots, out, "34-nhap-ai")
    p.uncheck('dialog [data-i="2"]')
    check("bỏ chọn khoản có người mới → không tạo người đó nữa", p.inner_text("#it-new") == "" and p.inner_text("dialog [data-do]") == "Nhập 2 khoản")
    p.click("dialog [data-do]")
    p.wait_for_selector("dialog", state="detached")
    doc = t.docs()
    lau = next((x for x in doc["transactions"] if x.get("note") == "Lẩu"), {})
    check("lưu 2 khoản: lẩu thuộc nhóm, Phúc trả, chia 3 mỗi người 200.000; KHÔNG có Nam",
          len(doc["transactions"]) == 2 and lau.get("groupId") == "g_tro" and (lau.get("split") or {}).get("paidBy") == "p_x"
          and sorted((lau.get("split") or {}).get("shares", {}).values()) == [200000] * 3 and not any(x["name"] == "Nam" for x in doc["people"]))
    p.click("#toasts button")
    p.wait_for_timeout(200)
    check("hoàn tác một bước → bỏ cả 2 khoản", len(t.docs()["transactions"]) == 0)

    ev("() => { QL.dialogs.importText({ai: true}); }")
    p.fill("#it-text", text)
    p.click("dialog [data-ai]")
    p.wait_for_selector("#it-out table")
    p.click("dialog [data-do]")
    p.wait_for_selector("dialog", state="detached")
    doc = t.docs()
    nam = next((x for x in doc["people"] if x["name"] == "Nam"), None)
    cafe = next((x for x in doc["transactions"] if x.get("note") == "Cà phê"), {})
    check("nhập cả 3 (token đã cất, không hỏi mã lại) → tạo Nam, khoản cà phê Nam trả hộ hợp lệ",
          nam is not None and len(doc["transactions"]) == 3 and (cafe.get("split") or {}).get("paidBy") == nam["id"]
          and ev("() => QL.app.engine.getDoc().transactions.every(t => QL.model.validateTx(t, QL.app.engine.getDoc()).length === 0)"))
    errs = [e for e in t.errors if "status of 403" not in e]
    check("AI: không lỗi console (trừ 403 cố ý của mã sai)", not errs, "; ".join(errs))
    ctx.close()
