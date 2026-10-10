# Báo cáo rà soát nhóm g12 — ca 2607 (6 bài) và ca 2609 (5 bài)

**Kết quả**: 36 bản vá (`g12.json`) — 17 `[LOGIC]`, 15 `[SỐ]`, 2 `[MÂU THUẪN]`, 2 `[NHỎ]`; không có `[MÃ]`/`[THAM CHIẾU]`.
Theo bài: 2607/02 (9), 2607/01 (6), 2607/03 (5), 2607/05 (5), case-2609/tong-quan (4), 2607/tong-quan (1), 2607/04 (1), case-2609/01 (1), case-2609/02 (2), case-2609/03 (2); case-2609/04 không sửa.
`ap-dung-sua-loi.py --thu sua-loi/g12.json` → **áp được 36 · đã áp từ trước 0 · lỗi 0**.
Ghi chú phương pháp: thư mục `04-implementation` của cả hai ca chỉ là README (không có mã nguồn trong repo) nên không biên dịch được mã giải. Đã tự kiểm bằng code: mọi phép %, hiệu, tổng trong các bảng; công thức $F(v)=\sum S_t(N-S_t)$ (khớp trên 200 lưới ngẫu nhiên); Bổ đề ghép cặp đơn điệu (đúng, brute-force 9 000 ca); hằng số hình dạng κ (vuông 0,6667, kim cương 0,66, đĩa 0,6504…); và thử g++ 14.0.1 với hàm `int` thiếu `return`.

## Mục đã biết — kết luận
- **26 (ca 2607) — xác nhận cả 5 ý.** τ=7 (kỳ vọng BHH) và τ=9,5 (quãng đường thực của chính lời giải) không phải cận; chỉ τ=0 hợp lệ: 32 915 840/35 571 464 = **92,5 %** (97,0 % và 98,6 % chỉ là so với mức tham chiếu) — sửa ở tong-quan, 01 §6, 02 §6, 03 §10. "Tối đa 12 nhà/ngày" sai: nhà ở ô phân biệt nên mỗi nhà đi ≥ 1 phút, 12 nhà cần ≥ 731 > 720 ⇒ **11** (03 §3.1–3.2). "Ba lời giải" → hai (01 §4). Phút chết "~1 450" → 1 420 (01 §5; kéo theo 02 §1.4(a): 1 561×1 420 = 2,22 triệu = 7,2 %, không phải 2,26 triệu/7,3 %). λ "±0,8 %": thực đo đỉnh–đáy 0,84 % (≈ ±0,4 %).
- **28 (ca 2609) — xác nhận cả 4 ý.** 99,76 % = 160 933/161 318 (cùng 1 000 TC); 161 205 (200 TC)/161 318 = 99,93 % là so lẫn hai tập (sửa tong-quan). k=1 vs k=2/k=5: ba dòng in cho 1,9–3,7× và 4,8–9,3× (chỉ dòng đầu "gấp đôi, gấp 9"); bằng chứng chỉ 12/12 TC in ra (02 B3). "FW từ dữ liệu cho tối ưu toàn cục mọi thực nghiệm" sai theo bảng §2.5: chỉ seed 1015 bằng giá trị tốt nhất; seed 1 lệch 0,0012 %, seed 5/10 thua "từ đĩa tròn" (03 §2.5, §6.2). 7 369 đo trên 10 seed, không phải 200 (tong-quan; thêm "Nước đi hỏng 2 000 TC" cũng chỉ của lời giải đề xuất).
- **25 — XÁC ĐỊNH SỰ THẬT cho quyết định thống nhất số 6.** Từ bảng ablation 2607 (so với đầy đủ 32 915 840): khung ngày 31 **−3,08 %** (1 014 944 đ), beam −2,43 %, phạt thời gian chết −2,43 %, di chuyển chết cuối ngày **−0,45 %** (146 974 đ), multi-start −0,22 %, ρ −0,10 %, σ −0,01 %; tổng **8,72 điểm %**. Chỉ **hai** thành phần đến từ đọc `main.cpp` (khung ngày 31 và di chuyển chết cuối ngày) = 3,53 điểm % = **40,5 %** tổng ablation (42 % của bốn dòng lớn nhất, 8,39). Beam và phạt thời gian chết (4,86 điểm %) là mô hình hoá (λ), không phải đọc mã; "thưởng OT co rút" cũng từ mã nhưng không có dòng ablation riêng. ⇒ Chuẩn: **"hai trong bốn" (≈ 40 %), không phải "ba trong bốn / 3/4"**. Lưu ý ablation không cộng tính (tổng 8,72 > +7,17 % so với greedy). Đã sửa 2607/05 §5. Bài 20 §3.1 / Bài 23 §3 nên dùng đúng số này.

## Lỗi mới tự tìm ra (đã vá)
- 02 §2.3: "thời gian chết giảm 1 561 → 501" so hai cơ sở (A tính 31 khung gồm 720 phút khung 31 bỏ không, B tính 30 khung); cùng cơ sở là **841 → 501** (mọi cột OT/chết của bảng §6 khớp: A 1 271 703/30 → T_end 692 = 720−28).
- 02 §2.3(c): "+5,35 %" là so với B, đặt cạnh "+1,5 %" (so với A); cùng cơ sở A là +6,94 %. 02 §6: "nhanh hơn 3,5 lần" → 2,8 lần (76,2/26,8); "đi nhiều hơn 200 phút so với B" → 133 (1 510−1 377). 02 §1.4(b): ví dụ ngược chiều luận điểm (1 500 > 1 290 nên greedy chọn m=4). 02 §2.3(a): "7 600 lần/bước" ứng với n=400, n≈293 là ≈ 5 600 (làm rõ cơ sở).
- 03 §10: "gần như toàn bộ khoảng cách 3,0 % nằm ở quãng đường" — thực chỉ ≈ một nửa (≈ 1,5 %, khớp 05 §3.5). 03 §7: "~148 000" → 146 974; "Ba lớp an toàn" → bốn (bảng 4 dòng). 04: "Hai công tắc" → ba `#define`. 05 §3.5: BHH gọi "cận dưới/chính xác" (chỉ là ước lượng tiệm cận), 1 157 → 1 156,4.
- Ca 2609: E₀ "nhỏ nhất ~3×10⁸" → ~10⁸ (N=1 920, H+W=160 ⇒ 9,8×10⁷); "lỗi im lặng nếu không bật `-Wreturn-type`" sai với g++ (đã thử g++ 14.0.1: không cờ vẫn in `[-Wreturn-type]`; theo quyết định số 2).

## Cần tác giả quyết định / chưa phân định được
- 2609 02 B1 hàng `-O2` ("xoá vòng lặp, 0 nước đi"): thử mã tối thiểu g++ 14 cho `-O0` = Illegal instruction (khớp), `-O2` = Segmentation fault (khác mô tả); UB phụ thuộc mã xung quanh/phiên bản — không sửa, nên thêm "tuỳ trình biên dịch".
- 2607/01 §5 đòn bẩy 3 "giá/phút ~1 450 → ~1 530" so với đo thật (greedy ≈ 1 512–1 514, C ≈ 1 519): 1 450 là baseline nào? Chưa phân định.
- 2607/03 §6 "× 3 preset ~4,3 triệu": cộng các dòng bảng ra ≈ 4,6 triệu (3×(1,24+0,22)+0,2); 2607/03 §9 "`act[]` dư 2,4×" không kiểm được (không có mã; Bài 22 §8.5 nêu 461/528 = 1,15×). 2607/02 §3 SA "ngân sách vài nghìn lần đánh giá" phụ thuộc chi phí mỗi lần đánh giá (O(n) ≈ 300 phép ⇒ ~3×10⁵ ở 10⁹/s) — cần nêu giả định.
- 2609/03 §2.4 "kim cương kém đĩa tròn 1,4 %" là κ (điểm kém 3,6 %/6,4 %) — mơ hồ, chưa sửa. §3.3 "tồn tại theo Gale–Ryser" chỉ đúng khi (R, c) thoả điều kiện — §6.1 đã có chú thích, nên liên kết.

## Phát hiện ngoài phạm vi
- "tối đa 12 ngôi nhà (720/60)" cần thành 11: Bài 2 (§ "mỗi ngày ≤ 12 nhà", BT 2.4) và `dap-an` 2.4 (Held–Karp 12² ·2¹² = 589 824 → 11²·2¹¹ = 247 808); Bài 16 ("tối đa 12 ngôi nhà", cách tối ưu); Bài 17B ("nghiệm 12 phần tử"); Bài 23 (ví dụ 12 điểm, 590 000 phép).
- Bài 21 bảng đòn bẩy: "mỗi phút chết mất ~1 450 điểm" → 1 420 (bản sao của 2607/01 §5).
- Bài 18 §3 + bảng tóm tắt cuối ("cận trên τ=7 … di chuyển tối ưu", "98,6 % / 97,0 %"): đồng bộ với 2607/01 §6 mới (chỉ τ=0 là cận). Bài 19B "Không cờ nào cảnh báo nếu quên `-Wreturn-type`" sai với g++.

## Bài thực hành có thể đang trích lại chỗ vừa sửa (`heuristic-practice-2/data/`)
- `ca-2607.js`: "tối đa khoảng 12 nhà" (~dòng 137 → 11); câu hỏi phản biện "đạt 97 % cận trên (τ = 7) và 98,6 % cận τ = 9,5" (~dòng 202 — tiền đề trích văn bản cũ, nay tài liệu đã nói rõ là mức tham chiếu); "~0,48 triệu" (~dòng 117, không đổi).
- `ca-2609.js`: giaiThich "tài liệu tóm tắt là 'gấp đôi' và 'gấp 9'" (~dòng 86); "lỗi im lặng nếu không bật -Wreturn-type" (~dòng 149); câu hỏi phản biện "FW … toàn cục trong mọi thực nghiệm" và "99,76 % … 161 205/161 318" (~dòng 188–196) — tiền đề nay đã được sửa trong bài; "k = 1 luôn thắng" (~dòng 38) và "7 369 / 200 test" nếu có.
