# -*- coding: utf-8 -*-
"""Các luồng thao tác phụ của tầng trình duyệt: chạy từng hộp thoại đến cùng và kiểm kết quả trên sổ."""
from __future__ import annotations

import json
import os
import tempfile

from browser_checks import Tab, snap


def flows(browser, base, check, shots, out):
    print("  · các luồng: quyết toán, tiết kiệm, ngân sách, định kỳ, CSV, sao lưu, hoá đơn, lọc…")
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    t = Tab(ctx, base)
    p = t.page
    t.open()
    ev = p.evaluate
    # Dựng sổ: Phúc, hai khoản chung (trang 10 của PDF: mình trả 439,5K, Phúc trả 182K).
    ev("""() => QL.app.apply(d => { const M = QL.model;
        d = M.upsert(d, 'people', {id:'p_x', name:'Phúc', archived:false});
        d = M.setSettings(d, {defaultPartnerIds:['p_x']});
        const mk = (id, amount, paidBy, acc) => ({id, type:'expense', date:QL.dates.today(), amount, categoryId:'c_food', accountId: acc, note:'Cơm '+id, tags:[],
            split:{paidBy, shares: Object.fromEntries(QL.money.allocate(amount,[1,1]).map((v,i)=>[['p_me','p_x'][i], v]))}});
        d = M.upsert(d,'transactions', mk('t_a', 439500, 'p_me', 'a_cash'));
        d = M.upsert(d,'transactions', mk('t_b', 182000, 'p_x', null));
        return d; })""")
    bal = ev("() => QL.ledger.personBalances(QL.app.engine.getDoc()).p_x")
    check("dựng sổ chia tiền theo trang 10 PDF: Phúc nợ 128.750", bal == 128750, str(bal))

    # --- quyết toán
    t.go("chia-tien")
    check("Chia tiền: thẻ Phúc ghi 'Phúc nợ bạn' 128.750 ₫", "Phúc nợ bạn" in t.text() and "128.750 ₫" in t.text(), t.text()[:200])
    p.click('[data-act="settle"]')
    p.wait_for_selector("#st-msg")
    msg = p.input_value("#st-msg")
    check("Quyết toán: có tin nhắn sao chép được, nêu số cần chuyển", "Quyết toán" in msg and "chuyển cho bạn 128.750 ₫" in msg, msg[:300])
    snap(t, shots, out, "08-quyet-toan")
    p.check('dialog input[name="record"]')
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    t.go("chia-tien")
    check("ghi khoản Phúc đã chuyển → số dư về 0, màn hình báo 'Đã hoà'", ev("() => QL.ledger.personBalances(QL.app.engine.getDoc()).p_x") == 0 and "Đã hoà" in t.text())

    # --- máy tính hoá đơn (trang 20)
    p.click('[data-act="bill"]')
    p.wait_for_selector("#bill")
    p.fill('#bill [name="old"]', "934"); p.fill('#bill [name="new"]', "1248")
    p.fill('#bill [name="water"]', "200k"); p.fill('#bill [name="other"]', "200k"); p.fill('#bill [name="rent"]', "4tr")
    out_txt = p.inner_text("#bill-out")
    check("Hoá đơn trọ: điện 314 số × 4.000 = 1.256.000, tổng 5.656.000, mỗi người 2.828.000 (đúng trang 20 PDF)",
          "1.256.000 ₫" in out_txt and "5.656.000 ₫" in out_txt and "2.828.000 ₫ · 2.828.000 ₫" in out_txt, out_txt.replace("\n", " | "))
    p.click("dialog [data-record]")
    p.wait_for_selector("#tx-amt")
    check("…'Ghi thành khoản chi chung' mở hộp thoại điền sẵn 5.656.000 và bật chia tiền", p.input_value("#tx-amt") == "5.656.000" and p.is_checked("#tx-shared"))
    p.keyboard.press("Escape")

    # --- sổ tiết kiệm
    t.go("tai-khoan")
    p.click('[data-act="account-new"]')
    p.fill('dialog input[name="name"]', "Techcombank")
    p.select_option('dialog select[name="kind"]', "bank")
    p.fill('dialog input[name="open"]', "30tr")
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    bank = ev("() => QL.app.engine.getDoc().accounts.find(a => a.name === 'Techcombank')")
    check("thêm tài khoản 'Techcombank' số dư đầu kỳ 30tr", bank and bank["openingBalance"] == 30000000, str(bank))
    p.click('[data-act="deposit-new"]')
    p.fill('dialog input[name="name"]', "Lương 2610")
    p.select_option('dialog select[name="from"]', bank["id"])
    p.fill('dialog input[name="amount"]', "12tr")
    p.fill('dialog input[name="rate"]', "8,6")
    prev = p.inner_text("#dep-prev")
    check("mở sổ: xem trước ngày đáo hạn và lãi dự kiến 1.032.000 ₫ (12tr × 8,6 %)", "Đáo hạn" in prev and "1.032.000 ₫" in prev, prev)
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    acct = ev("() => ({bal: QL.ledger.accountBalances(QL.app.engine.getDoc()), n: QL.app.engine.getDoc().accounts.filter(a => a.kind==='savings').length})")
    check("mở sổ: tiền rời Techcombank (30tr → 18tr), có 1 sổ tiết kiệm", acct["bal"][bank["id"]] == 18000000 and acct["n"] == 1, str(acct))
    check("màn Tài khoản hiện thẻ sổ tiết kiệm với lãi dự kiến", "Lương 2610" in t.text() and "+1.032.000 ₫" in t.text())
    snap(t, shots, out, "09-tai-khoan-tiet-kiem")
    p.click('[data-act="deposit-close"]')
    p.wait_for_selector('dialog input[name="interest"]')
    p.select_option('dialog select[name="to"]', bank["id"])
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    after = ev("id => QL.ledger.accountBalances(QL.app.engine.getDoc())[id]", bank["id"])
    check("tất toán: gốc + lãi về Techcombank (18tr + 12tr + 1.032.000 = 31.032.000)", after == 31032000, str(after))

    # --- ngân sách
    t.go("ke-hoach")
    p.click('[data-act="budget-new"]')
    p.select_option('dialog select[name="cat"]', "c_food")
    p.fill('dialog input[name="amount"]', "300k")
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    txt = t.text()
    check("ngân sách Ăn uống 300k: hiện tiến độ và trạng thái", "Ăn uống" in txt and "300.000 ₫" in txt and ("Vượt hạn mức" in txt or "Sắp hết" in txt or "Ổn" in txt), txt[:300].replace("\n", " | "))
    p.click('[data-act="budget-new"]')
    p.select_option('dialog select[name="cat"]', "c_food")
    p.fill('dialog input[name="amount"]', "1tr")
    p.click('dialog button[type="submit"]')
    check("đặt trùng hạn mức cho cùng danh mục → bị từ chối kèm lý do", "Đã có hạn mức" in p.inner_text("dialog") and p.locator("dialog").count() == 1)
    p.keyboard.press("Escape")

    # --- định kỳ
    p.click('[data-seg="planTab"][data-v="recurring"]')
    p.click('[data-act="rec-new"]')
    p.fill('dialog input[name="name"]', "Vé xe bus tháng")
    p.fill('dialog input[name="amount"]', "280k")
    p.select_option('dialog select[name="cat"]', "c_transport")
    p.fill('dialog input[name="day"]', "28")
    p.fill('dialog input[name="start"]', "2026-08-28")
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    due = ev("() => QL.ledger.dueRecurring(QL.app.engine.getDoc(), QL.dates.today()).length")
    check("định kỳ hằng tháng ngày 28 từ 28/8: có các kỳ đến hạn chờ xác nhận", due >= 1 and "Đến hạn — chờ xác nhận" in t.text(), str(due))
    n0 = ev("() => QL.app.engine.getDoc().transactions.length")
    p.locator('[data-act="rec-confirm"]').first.click()
    p.wait_for_timeout(200)
    check("bấm 'Ghi' → tạo giao dịch 280.000 ₫, kỳ đó hết chờ", ev("() => QL.app.engine.getDoc().transactions.length") == n0 + 1 and ev("() => QL.ledger.dueRecurring(QL.app.engine.getDoc(), QL.dates.today()).length") == due - 1)
    if ev("() => QL.ledger.dueRecurring(QL.app.engine.getDoc(), QL.dates.today()).length"):
        left = ev("() => QL.ledger.dueRecurring(QL.app.engine.getDoc(), QL.dates.today()).length")
        p.locator('[data-act="rec-skip"]').first.click(); p.wait_for_timeout(150)
        check("bấm 'Bỏ qua' → kỳ đó hết chờ mà KHÔNG tạo giao dịch", ev("() => QL.ledger.dueRecurring(QL.app.engine.getDoc(), QL.dates.today()).length") == left - 1 and ev("() => QL.app.engine.getDoc().transactions.length") == n0 + 1)

    # --- sửa / xoá / hoàn tác một khoản
    t.go("giao-dich")
    p.locator('[data-act="tx-edit"]').first.click()
    p.wait_for_selector("#tx-amt")
    p.fill("#tx-amt", "99k")
    p.click("dialog [data-save]")
    p.wait_for_selector("dialog", state="detached")
    check("sửa số tiền một khoản → danh sách cập nhật", "99.000 ₫" in t.text() or "49.500 ₫" in t.text(), t.text()[:300].replace("\n", " | "))
    cnt = ev("() => QL.app.engine.getDoc().transactions.length")
    p.locator('[data-act="tx-edit"]').first.click(); p.wait_for_selector("#tx-amt")
    p.click("dialog [data-del]")
    p.wait_for_selector(".toast")
    check("xoá từ hộp thoại sửa → mất khỏi sổ, có Hoàn tác", ev("() => QL.app.engine.getDoc().transactions.length") == cnt - 1)
    p.locator("#toasts button").last.click(); p.wait_for_timeout(150)
    check("Hoàn tác → khoản quay lại", ev("() => QL.app.engine.getDoc().transactions.length") == cnt)

    # --- tìm kiếm / lọc / kỳ
    p.click('[data-seg="txPeriod"][data-v="all"]')
    p.fill("#tx-q", "com")
    p.wait_for_timeout(300)
    titles = p.locator("#tx-results .item .ttl").all_inner_texts()
    check("tìm 'com' (không dấu) ra các khoản 'Cơm …'", len(titles) >= 2 and all("cơm" in x.lower() for x in titles), str(titles[:4]))
    check("ô tìm giữ focus khi gõ (không bị vẽ lại làm mất)", ev("() => document.activeElement.id") == "tx-q")
    p.fill("#tx-q", "zzzkhongco"); p.wait_for_timeout(300)
    check("không khớp → trạng thái trống kèm nút Xoá bộ lọc", "Không có giao dịch khớp" in t.text() and p.locator('#tx-results [data-act="filter-clear"]').count() == 1)
    p.click('#tx-results [data-act="filter-clear"]'); p.wait_for_timeout(200)
    p.click('[data-act="filter-toggle"]')
    p.select_option('select[name="type"]', "income"); p.wait_for_timeout(200)
    amts = p.locator("#tx-results .item .amt").all_inner_texts()
    check("lọc theo loại 'Thu' chỉ còn khoản thu (lãi tiết kiệm)", len(amts) >= 1 and all("+" in x for x in amts), str(amts))
    p.click('[data-act="filter-clear"]'); p.wait_for_timeout(100)
    for kind in ("week", "year", "all", "month"):
        p.click(f'[data-seg="txPeriod"][data-v="{kind}"]')
    p.click('[data-act="period-prev"]'); p.click('[data-act="period-next"]')
    check("đổi kỳ Tuần/Năm/Tất cả/Tháng và ◀ ▶ không lỗi", not t.errors, "; ".join(t.errors))

    # --- nhập từ văn bản (dòng thật trong PDF)
    t.go("cai-dat")
    p.click('[data-act="import-text"]')
    p.fill("#it-text", "Tháng 3 tuần 1:\n27/2: vé xe buýt tháng 3: 280K\n1/3: Mua data 4G 12 tháng: 840K\n2/3: Thưởng PI: 19.485.250\nT2-T6: 72/2 (chè) + 43/1 (bún đậu)\nCắt tóc bác Chữ")
    p.click("dialog [data-parse]")
    table = p.inner_text("#it-out")
    check("dán ghi chú: nhận 3 dòng, bỏ qua tiêu đề, báo dòng gộp nhiều ngày và dòng thiếu số tiền",
          "Bỏ qua" in table and "nhiều ngày" in table and "Chưa hiểu" in table and p.inner_text("dialog [data-do]") == "Nhập 3 khoản", table.replace("\n", " | ")[:300])
    snap(t, shots, out, "10-nhap-ghi-chu")
    n1 = ev("() => QL.app.engine.getDoc().transactions.length")
    p.click("dialog [data-do]")
    p.wait_for_selector("dialog", state="detached")
    check("nhập 3 khoản từ ghi chú → đúng 3 giao dịch mới", ev("() => QL.app.engine.getDoc().transactions.length") == n1 + 3)
    p.click('[data-act="import-text"]'); p.fill("#it-text", "27/2: vé xe buýt tháng 3: 280K"); p.click("dialog [data-parse]")
    check("dán lại cùng dòng → bị đánh dấu 'trùng', mặc định không nhập", "trùng" in p.inner_text("#it-out") and p.is_disabled("dialog [data-do]"))
    p.keyboard.press("Escape")

    # --- CSV
    tmp = tempfile.mkdtemp()
    csv_path = os.path.join(tmp, "nhap.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        f.write('ngay,loai,so_tien,danh_muc,tai_khoan,ghi_chu\r\n2026-09-01,chi,57000,"Cà phê",Tiền mặt,"Cà phê, ""sữa"""\r\n2026-09-02,thu,500000,Thưởng,Tiền mặt,Quà\r\n2026-13-45,chi,abc,x,y,z\r\n')
    n2 = ev("() => QL.app.engine.getDoc().transactions.length")
    with p.expect_file_chooser() as fc:
        p.click('[data-act="import-csv"]')
    fc.value.set_files(csv_path)
    p.wait_for_selector("dialog [data-do]")
    txt = p.inner_text("dialog")
    check("nhập CSV: 2 mới, 1 dòng lỗi, tạo danh mục 'Cà phê'", "2 giao dịch mới" in txt and "1" in txt and "dòng lỗi" in txt and "Cà phê (danh mục)" in txt, txt.replace("\n", " | ")[:300])
    p.click("dialog [data-do]"); p.wait_for_selector("dialog", state="detached")
    notes = ev("() => QL.app.engine.getDoc().transactions.map(t => t.note)")
    check("nhập CSV: ghi chú có dấu phẩy và nháy kép giữ nguyên", ev("() => QL.app.engine.getDoc().transactions.length") == n2 + 2 and 'Cà phê, "sữa"' in notes, str(notes[-3:]))

    # --- sao lưu → xoá sạch → khôi phục
    with p.expect_download() as dl:
        p.click('[data-act="backup-json"]')
    backup = dl.value.path()
    total = ev("() => QL.app.engine.getDoc().transactions.length")
    p.click('[data-act="wipe"]'); p.click("dialog [data-ok]")
    p.wait_for_selector("dialog [data-ok]"); p.click("dialog [data-ok]")
    p.wait_for_function("() => QL.app.engine.getDoc().transactions.length === 0")
    check("xoá toàn bộ cần xác nhận hai lần, sổ trống", True)
    with p.expect_file_chooser() as fc2:
        p.click('[data-act="restore-json"]')
    fc2.value.set_files(backup)
    p.wait_for_selector('dialog input[name="how"]')
    p.check('dialog input[name="how"][value="replace"]')
    p.click("dialog [data-do]")
    p.wait_for_selector("dialog", state="detached")
    back = ev("() => QL.app.engine.getDoc().transactions.length")
    check("khôi phục từ file sao lưu (thay thế) → đủ lại số giao dịch", back == total, f"{back} / {total}")
    bad_file = os.path.join(tmp, "hong.json")
    open(bad_file, "w", encoding="utf-8").write('{"khong": "phai so"}')
    with p.expect_file_chooser() as fc3:
        p.click('[data-act="restore-json"]')
    fc3.value.set_files(bad_file)
    p.wait_for_selector(".toast")
    check("khôi phục file không phải sổ → báo lỗi rõ, không đổi dữ liệu", "sao lưu" in p.inner_text("#toasts") and ev("() => QL.app.engine.getDoc().transactions.length") == total)

    # --- danh mục
    p.click('[data-act="cat-new"]')
    p.fill('dialog input[name="name"]', "Thú cưng")
    p.click('dialog button[type="submit"]'); p.wait_for_selector("dialog", state="detached")
    check("thêm danh mục 'Thú cưng'", ev("() => QL.app.engine.getDoc().categories.some(c => c.name === 'Thú cưng')") and "Thú cưng" in t.text())
    p.locator('[data-act="cat-edit"]', has_text="Thú cưng").click()
    p.check('dialog input[name="arch"]'); p.click('dialog button[type="submit"]'); p.wait_for_selector("dialog", state="detached")
    check("ẩn danh mục → hiện '(ẩn)'", "Thú cưng (ẩn)" in t.text())
    check("không lỗi console suốt các luồng", not t.errors, "; ".join(t.errors)[:400])
    ctx.close()
