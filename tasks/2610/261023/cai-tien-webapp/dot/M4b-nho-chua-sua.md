# M4b — góp ý nhỏ của người kiểm độc lập (CHƯA sửa)

Lần kiểm thứ nhất (24/10 11:05) tìm ra 1 lỗi nặng (đếm sai kích thước lô push → đồng bộ kẹt vĩnh viễn); vòng sửa #1 đang chạy. Các điểm dưới đây ở mục "nhỏ", workflow không tự sửa trừ khi vòng sửa tiện tay làm.

## Nên sửa (có thể mất dữ liệu hoặc gây hiểu nhầm)
1. **Cảnh báo sai ở "Replace this device's copy with the server's…"**: `engine.ts:1017` `unsent = outboxEntries().filter(!entry.blocked)` bỏ qua các mục `blocked` (vd tài liệu > 3,5 MB không bao giờ lên được máy chủ, nên bản cục bộ là bản DUY NHẤT). Hộp thoại nói như không có gì chưa gửi → người dùng có thể mất bản duy nhất. Phải tính cả mục `blocked` vào cảnh báo.
2. **Race nhỏ trong `pushAll`** (`engine.ts:446/449` → `workspace.ts:142`): sau push, `ws.apply` gọi `capture()` rồi `set(entry.id, …)` đè mục MỚI hơn bằng mục cũ kèm cờ nếu người dùng sửa tên/chữ đúng lúc push. Người kiểm thử các tình huống đua đã thử không thấy lỗi hội tụ, nhưng nên ghép theo version thay vì ghi đè.
3. **ReconcileModal nói sai**: ghi "Nothing is deleted without your say-so", nhưng sau `reset` (`engine.ts:870-874`) engine xoá lặng lẽ các tài liệu cục bộ đã đồng bộ mà máy chủ không còn (đúng thiết kế md-sync §3.7.4; không hiện hộp thoại nếu không có gì khác nhau). Ít nhất nên có thông báo liệt kê những gì bị xoá, hoặc sửa câu chữ.
4. **Ảnh khởi động v3 chỉ chứa chữ tài liệu đang mở nếu ≤ 512 KB**: sửa tài liệu > 512 KB rồi đóng tab đúng lúc giao dịch IndexedDB chưa xong → có thể mất vài ký tự cuối (không có ảnh để `reconcileBoot` khôi phục).

## Nên sửa (hiệu năng / tài nguyên)
5. `engine.cache` (hashOf) giữ tới 25 chuỗi văn bản NGUYÊN VĂN làm khoá (`engine.ts:385`): tối đa ~25 × 3,5 MB ≈ 90 MB bộ nhớ. Khoá theo (độ dài, tiền tố/hậu tố) hoặc chỉ giữ 3–4 mục.
6. Hiệu năng mở: khung đầu 384 ms so với mốc M1 276 ms (+39 %, trong nhiễu ±35 %); chưa chạy `--ghi-moc`. M5 nên đo lại mốc trước khi kết luận có hồi quy do mở IndexedDB hay không.

## Độ bền / test
7. Khoảng trống test (lộ ra khi đột biến): bỏ `versions.set(sent.entry.id, sent.entry.version)` trong `pushAll` (`engine.ts:441`) mà 49/49 test engine vẫn xanh — bất biến "sửa trong lúc push đang bay thì lần sau vẫn gửi" chỉ được test ở tầng Workspace, không ở tầng engine. 22/26 đột biến bị bắt; 3 sống sót là tương đương hành vi (M1, M7, M10).
8. Làn "dự phòng bị chặn": `openIdbDocStore` (`docStore.ts:264`) khi `onblocked` thì reject ngay nhưng nếu sau đó `onsuccess` vẫn tới thì kết nối không bao giờ được đóng; `IdbDocStore.commit` (`:187-211`) tạo `done = finished(tx)` trước các `store.put`, nếu `put` ném đồng bộ (DataCloneError…) thì có thể treo/rò.
9. `npm test` chạy đầy đủ lần đầu đỏ 1/1061: `shareDialog.test.tsx` "refreshing the list does not erase the title being typed" hết giờ 5056 ms (> 5000 ms) khi máy bận; chạy riêng cả tệp 20/20 xanh (test đó 1,2 s). Là flake do tải. Nên nâng timeout của test đó hoặc chạy vitest với `--maxWorkers=3`.

## Hạn chế đã biết
10. Hai TAB cùng máy dùng chung IndexedDB và `deviceId`, không phối hợp (xử lý như hai thiết bị); chưa có BroadcastChannel/khoá.
11. Giao diện xung đột chỉ có 3 nút, không có diff; "Use the server's" bỏ chữ cục bộ không giữ bản (UI nói rõ). Diff, gộp tay, lịch sử, thùng rác = M8.

## Dọn dẹp
12. `markdown-editor/.env.example:8-9` còn `VITE_MARKDOWN_API_URL` (README nói không còn dùng). Nhiều test (store/smartFormat/responsive/readingMode/m1/install) vẫn mock `loadMarkdownFiles/saveMarkdownFiles` đã gỡ (vô hại).
13. Bản cũ `webapp/tranphuc8a/markdown-editor` (ghi cứng `http://localhost:6789` + khoá mặc định) giờ luôn bị 403 — nên gỡ khỏi cổng hoặc ghi chú.
