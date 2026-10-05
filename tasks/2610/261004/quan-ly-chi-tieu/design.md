# Thiết kế — Ứng dụng web Quản lý chi tiêu

Căn cứ: `requirements.md` (mã FR/NFR dưới đây trỏ về đó).

## 1. Kiến trúc tổng thể

```
┌────────────────────────── Trình duyệt (vanilla JS, không build) ─────────────────────────┐
│  UI (views, dialogs)                                                                      │
│     │ đọc/ghi qua                                                                         │
│  state (doc trong bộ nhớ) ──► logic THUẦN: money · dates · model · ledger · parser · csv   │
│     │                                      · sync.merge · charts(SVG)   ← kiểm bằng node  │
│  Engine đồng bộ ──► Store "local"  (localStorage)                                         │
│                 └─► Store "remote" (fetch)  ───────────────┐                              │
└────────────────────────────────────────────────────────────┼──────────────────────────────┘
                                                             ▼  /api/v1/spending/*
┌──────────────────────────────── FastAPI (lục giác, theo mẫu postman) ────────────────────┐
│ spending_controller ─► SpendingUseCase ─► SpendingRepositoryPort ─┬► JsonSpendingRepository│
│   (envelope, header khoá)  (khoá, revision,    (create/get/        ├► MySqlSpendingRepository│
│                             kích thước)         replace_if_revision/└► MongoSpendingRepository│
│ spending_factory: chọn kho theo ?backend=, cache singleton          delete)                 │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

Nguyên tắc: **toàn bộ tính toán nằm ở trình duyệt**; máy chủ chỉ là *kho tài liệu có khoá và phiên bản* (đúng vai trò của postman workspace). Nhờ vậy ba chế độ lưu trữ chỉ khác nhau ở chỗ tài liệu nằm đâu, còn mọi con số do cùng một mã tính ra.

## 2. Quyết định thiết kế

| # | Quyết định | Lý do | Đánh đổi |
|---|---|---|---|
| D1 | **Vanilla JS, script cổ điển, không build, không thư viện** | Đúng quy ước `webapp/tranphuc8a/` (chi-tieu, json-editor, design-pattern); mở được bằng `file://`; logic `require` được trong node không cần cấu hình; không thêm dependency. | UI viết tay (template chuỗi + uỷ quyền sự kiện) dài hơn React; bù bằng tách logic thuần khỏi UI. |
| D2 | **Mã nguồn ứng dụng nằm thẳng ở `webapp/tranphuc8a/quan-ly-chi-tieu/`**; thư mục gốc dự án `quan-ly-chi-tieu/` chứa README + công cụ tự kiểm (`selftest/`) | Không có bước build thì "nguồn" = "bản xuất bản"; tách hai nơi chỉ sinh bản sao. Ứng dụng cũ `chi-tieu` cũng viết tại chỗ. | Thư mục gốc không chứa mã chạy. |
| D3 | **Đồng bộ theo tài liệu** (một JSON đầy đủ + `revision`), không phải API từng bản ghi | Mẫu đã có và đã được kiểm chứng (postman); mọi thống kê tính ở client nên server không cần truy vấn; ba adapter chỉ ~4 hàm. Dữ liệu cá nhân ~1 MB/năm. | Mỗi lần đẩy gửi cả tài liệu (giới hạn 4 MB ≈ 20.000 giao dịch); có cảnh báo dung lượng. |
| D4 | **Gộp theo bản ghi (LWW + bia mộ xoá) ở client** khi gặp 409 | Server giữ đơn giản (không hiểu nghĩa dữ liệu); hai thiết bị cùng sửa không mất gì; hàm gộp thuần, giao hoán, kiểm bằng thuộc tính. | Đồng hồ máy lệch có thể làm "bản muộn hơn" sai (chấp nhận, ghi ở rủi ro). |
| D5 | **Lưu có điều kiện nguyên tử** `replace_if_revision(record, expected)` ở cả 3 kho | Postman đọc-rồi-ghi có khe hở; dữ liệu tiền + nhiều thiết bị đòi hỏi không mất cập nhật (NFR-04). | Hợp đồng port khác postman một chút (vẫn nhỏ). |
| D6 | **Mongo lưu tài liệu dạng chuỗi JSON** (`payload_json`) | Tài liệu do client gửi là "mờ"; khoá bắt đầu bằng `$`/chứa `.` trong dữ liệu client không được phép làm hỏng truy vấn; đối xứng với cột LONGTEXT của MySQL. | Khó xem dữ liệu trực tiếp trong Compass. |
| D7 | **Định danh tiếng Anh, giao diện/tài liệu tiếng Việt** | Backend Python và payload dùng chung một bộ từ vựng (`transaction`, `account`…) nên không phải dịch qua lại. | Khác với `chi-tieu` cũ (định danh tiếng Việt không dấu). |
| D8 | **Một mô hình giao dịch cho 4 loại** (`expense`/`income`/`transfer`/`settle`); **sổ tiết kiệm = tài khoản** có siêu dữ liệu `deposit` | Gửi/tất toán chỉ là `transfer` + `income`; không thêm thực thể mới, số dư và tổng tài sản tự đúng. | Tất toán là thao tác hai giao dịch (làm trong một hàm thuần, có test). |
| D9 | **Định kỳ = đề xuất chờ xác nhận**, không tự ghi | Số tiền thật thường lệch (điện, ăn); ghi âm thầm tạo số sai mà người dùng tin. | Thêm một thao tác bấm xác nhận. |
| D10 | Tái dùng `?backend=` + `/storage/backends` hiện có | Cùng cách ba app khác đang chọn kho; không viết lại dò kết nối. | — |

## 3. Mô hình dữ liệu (schema v1)

Một tài liệu duy nhất (cũng là thứ máy chủ lưu và `Sao lưu JSON` xuất ra):

```jsonc
{
  "schema": 1,
  "settings": {                       // LWW cả khối theo settings.updatedAt
    "updatedAt": "2026-10-05T01:02:03.456Z",
    "meId": "p_me",
    "smallAsThousand": true,          // "57" = 57.000
    "defaultAccountId": "a_cash",
    "defaultPartnerIds": ["p_x1"],    // gợi ý khi gõ "/2"
    "theme": "system",                // system | light | dark
    "lastBackupAt": null
  },
  "accounts":     [{ "id","name","kind":"cash|bank|ewallet|savings","icon","openingBalance":0,
                     "archived":false,"order":0,"updatedAt",
                     "deposit":{ "rate":8.6,"termMonths":12,"openedOn":"2026-09-10","taxPct":0,"closedOn":null } }],
  "categories":   [{ "id","name","kind":"expense|income","icon","color","archived":false,"order":0,"updatedAt" }],
  "people":       [{ "id","name","archived":false,"updatedAt" }],          // "p_me" luôn tồn tại
  "transactions": [{ "id","type":"expense|income|transfer|settle","date":"YYYY-MM-DD","amount":57000,
                     "categoryId":null,"accountId":"a_cash","toAccountId":null,"note":"","tags":[],
                     "split":{ "paidBy":"p_me","shares":{"p_me":28500,"p_x1":28500} },   // chỉ type=expense
                     "personId":null,"direction":null,                                    // chỉ type=settle: "in"|"out"
                     "recurringId":null,"createdAt","updatedAt" }],
  "budgets":      [{ "id","categoryId":null,"amount":3000000,"updatedAt" }],            // theo tháng; null = tổng chi
  "recurring":    [{ "id","name","type","amount","categoryId","accountId","note",
                     "frequency":"monthly|weekly","day":28,"startOn","endOn":null,"lastDoneOn":null,
                     "active":true,"updatedAt" }],
  "tombstones":   { "transactions":{"t_9":"2026-10-04T..Z"}, "accounts":{}, "categories":{},
                     "people":{}, "budgets":{}, "recurring":{} }
}
```

### 3.1 Bất biến (do `model.normalize` ép khi nạp, do `validateTx` ép khi ghi)

1. Mọi `amount`, `openingBalance`, phần chia là **số nguyên ≥ 0** (đồng); `amount > 0` với giao dịch.
2. `type=expense` có `split` ⇒ `Σ shares = amount`, `paidBy ∈ people`, mọi khoá của `shares ∈ people`.
3. `type=transfer` ⇒ `accountId ≠ toAccountId`, không có `categoryId`/`split`.
4. `type=settle` ⇒ `personId ≠ meId`, `direction ∈ {in,out}`, có `accountId`.
5. Chi do người khác trả (`split.paidBy ≠ me`) **không** có `accountId` ảnh hưởng số dư (không đụng tiền của tôi).
6. `date` đúng `YYYY-MM-DD` và là ngày thật; `id` duy nhất trong từng mảng; tham chiếu mồ côi (danh mục/tài khoản đã xoá) được hiển thị là "(đã xoá)" thay vì làm hỏng tính toán.
7. Xoá = bỏ khỏi mảng + ghi `tombstones[coll][id] = now`.

### 3.2 Tác động của một giao dịch (`ledger.effects`)

| Loại | Số dư tài khoản | Chi của tôi | Thu của tôi | Số nợ với người khác (`balance[p]` > 0: p nợ tôi) |
|---|---|---|---|---|
| expense, không chia | `account −amount` | `+amount` | | |
| expense, chia, **tôi trả** | `account −amount` | `+shares[me]` | | `balance[p] += shares[p]` (p ≠ me) |
| expense, chia, **p trả** | *không đổi* | `+shares[me]` | | `balance[p] −= shares[me]` |
| income | `account +amount` | | `+amount` | |
| transfer | `from −amount`, `to +amount` | | | |
| settle `in` (p trả tôi) | `account +amount` | | | `balance[p] −= amount` |
| settle `out` (tôi trả p) | `account −amount` | | | `balance[p] += amount` |

Đối chiếu PDF: mình trả 439,5K, bạn trả 182K, chia đôi ⇒ `balance[bạn] = 439,5/2 − 182/2 = 128,75K` ✓ (= `(439,5 − 182)/2`).

### 3.3 Chia tiền không lệch đồng

`money.allocate(total, weights)` — phương pháp phần dư lớn nhất: `base_i = ⌊total·w_i / W⌋`, phần dư phân cho các chỉ số có phần lẻ lớn nhất, hoà thì chỉ số nhỏ trước. Chia đều là `weights = [1,…,1]`: `100001 ÷ 2 = [50001, 50000]`, tổng luôn bằng `total`. Người tham gia được sắp ổn định (tôi trước) để kết quả tái lặp.

### 3.4 Sổ tiết kiệm

```
days      = maturityOn − openedOn            (maturityOn = openedOn + termMonths tháng; ngày cuối tháng được kẹp)
interest  = round(principal × rate/100 × days/365)
tax       = round(interest × taxPct/100)
netInterest = interest − tax
principal = số dư tài khoản sổ (tổng chuyển vào − chuyển ra)
```
Kiểm: 15.000.000 · 8,35 % · 365 ngày = 1.252.500; 620.000 − 5 % = 589.000.
**Tất toán** (hàm thuần `closeDeposit`): `transfer(sổ → tk nhận, principal)` + `income(tk nhận, netInterest, danh mục Lãi tiết kiệm)` + đặt `deposit.closedOn`, `archived=true`. **Tái tục** = mở sổ mới cùng tham số với gốc mới (UI điền sẵn).

### 3.5 Định kỳ

`dueRecurring(doc, today)` trả mọi lần đến hạn chưa xử lý ≤ hôm nay (tối đa 12 lần/quy tắc, tính từ sau `lastDoneOn`, hoặc từ `startOn`). `frequency=monthly` dùng ngày `day` (kẹp về ngày cuối tháng). Xác nhận ⇒ tạo giao dịch (số tiền sửa được) rồi đặt `lastDoneOn`; "Bỏ qua" chỉ đặt `lastDoneOn`.

## 4. Thuật toán chính

### 4.1 Đọc số tiền (`money.parse`)

Vào: chuỗi. Ra: `{ok, value, hint}` với `value` số nguyên (có thể âm). Quy tắc theo thứ tự:

1. Bỏ `₫`, `đ`, `vnd`, khoảng trắng thừa; dấu `-` đầu = âm.
2. **Biểu thức đơn giản** `a - b`, `a + b`, và `... = c` (lấy sau dấu `=` cuối): `87k - 50k = 37k`, `87k - 50k` → 37.000. Chỉ `+` và `−` (không `*`, không `eval`).
3. Hậu tố: `k|nghìn|ngàn` ×1.000 · `tr|triệu|m` ×1.000.000 · `tỷ|tỉ|ty|b` ×10⁹ (không phân biệt hoa thường, được dấu cách trước hậu tố).
4. Số có hậu tố: `.` hoặc `,` là **thập phân**, trừ khi hậu tố là `k` và phần sau dấu có đúng 3 chữ số (`3.520K` = 3.520.000 vì đó là dấu ngăn nghìn). `61.5k` = 61.500; `1,5tr` = 1.500.000.
5. Số trần: nếu có ≥ 2 dấu `.` hoặc `,` hoặc phần sau dấu có đúng 3 chữ số ⇒ dấu ngăn nghìn (`19.485.250`, `1.234.567`); ngược lại, `,` là thập phân kiểu Việt (`1.234,5` ⇒ làm tròn).
6. Số trần `< 1000` và `smallAsThousand` ⇒ ×1.000 (`57` → 57.000; `0` giữ 0). Làm tròn nửa lên về số nguyên.

### 4.2 Nhập nhanh một dòng (`parser.parseQuick`)

Tách theo **token từ phải sang trái cho tiền, từ trái cho ngày**; phần còn lại là ghi chú.

1. **Chia tiền** `<tiền>/<n>` (n ≥ 2): `57/2`, `61.5k/2`; `/1` = không chia. Người tham gia = tôi + `n−1` người đầu của `defaultPartnerIds` (thiếu thì cảnh báo "chưa đủ người").
2. **Ai trả**: `@Tên`, `Tên trả`, `Tên đã trả`, hậu tố `P`/`T` ngay sau `/n` (so tiền tố không dấu với tên người). Mặc định tôi trả.
3. **Số tiền**: token tiền đứng **cuối cùng** trong dòng (`bún chả 60k`); nếu có `=`, lấy vế sau. Nhiều token tiền ⇒ lấy token cuối, cảnh báo.
4. **Ngày**: `hôm nay|hôm qua|hôm kia|qua|nay`, `T2…T7|CN|thứ hai…chủ nhật` (lần gần nhất ≤ hôm nay), `dd/mm`, `dd/mm/yyyy`, `ngày dd`. Không có ⇒ hôm nay.
5. **Loại**: có từ `lương|thưởng|thu|nhận|lãi|hoàn` đầu dòng ⇒ income; `chuyển … sang|→` ⇒ transfer; còn lại expense.
6. **Danh mục**: (a) khớp ghi chú đã gặp trong lịch sử (chuẩn hoá không dấu, trùng khớp tập từ lớn nhất, lấy danh mục dùng nhiều nhất) → (b) từ khoá mặc định (bảng trong `parser.js`) → (c) không đoán.
7. Trả về `{type, amount, date, note, categoryId, split, warnings[], spans[]}`; `spans` để tô màu từng phần trong bản xem trước.

**Dòng ghi chú hàng loạt** (`parseLines`) dùng cùng bộ phân tích cộng cú pháp `dd/mm: nội dung: số tiền` (phần trước dấu `:` đầu là ngày nếu giống ngày); dòng tiêu đề (`Tháng 3 tuần 2`), dòng `Tổng…`, `Chuyển…`, dòng `…` bị đánh dấu *bỏ qua*, dòng không có số tiền bị đánh dấu *không hiểu*.

### 4.3 Gộp hai tài liệu (`sync.merge(a, b)`)

Hàm thuần, **giao hoán – kết hợp – lặp lại không đổi** (kiểm bằng thuộc tính ngẫu nhiên):

```
for coll in [accounts, categories, people, transactions, budgets, recurring]:
    byId = union(a[coll], b[coll]);  khi trùng id: giữ bản có updatedAt lớn hơn
                                      (bằng nhau: so JSON chuỗi để quyết định tất định)
    tomb[coll][id] = max(a.tomb, b.tomb)
    bỏ bản ghi nếu tomb[coll][id] ≥ record.updatedAt     // xoá thắng sửa cũ; sửa MỚI hơn xoá thì sống lại
settings = bản có settings.updatedAt lớn hơn
bia mộ cũ hơn 90 ngày bị dọn
```

### 4.4 Động cơ đồng bộ (`store.Engine`)

```
mutate(doc')       → state.doc = doc'; ghi localStorage ngay; nếu mode≠local: dirty=true, lên lịch push (debounce 1,2 s)
push():            PUT {revision, data}
   200 → revision = r+1, dirty=false, status "Đã lưu"
   409 → current = data.current;  doc = merge(doc, current.data);  revision = current.revision;  thử lại (tối đa 3)
   lỗi mạng/5xx → giữ dirty, status "Chưa đồng bộ", thử lại khi sự kiện `online` / mỗi 30 s / khi tab hiện lại
   401 → status "Khoá truy cập không đúng" (dừng thử, mở hộp thoại kết nối)
pull() (mở app, tab hiện lại, mỗi 60 s): GET ?since=revision → unchanged ⇒ bỏ qua;
   nếu dirty: doc = merge(doc, remote) rồi push;  nếu không: doc = remote
```
Chế độ khác nhau ⇒ **bộ nhớ đệm khác nhau** (`qlct.doc.local|mysql|mongo`): đổi chế độ không ghi đè lẫn nhau. "Đẩy dữ liệu máy lên máy chủ" = tạo không gian kèm `data`; "kéo về" = ghi đè bộ nhớ đệm đích sau khi hỏi xác nhận (kèm tự lưu bản trước để hoàn tác — NFR-09).

### 4.5 Quy ước ngày

Ngày là chuỗi `YYYY-MM-DD` theo giờ địa phương. Phép tính đi qua *số ngày* (`Date.UTC(y,m-1,d)/86400000`) nên không dính múi giờ/DST. Thứ: `0=T2 … 6=CN`. Tuần ISO bắt đầu T2. Nhãn kỳ: `Tuần 40 · 28/9 – 4/10`, `Tháng 10/2026`, `Năm 2026`.

## 5. Hợp đồng API máy chủ

Tiền tố `settings.API_PREFIX` (mặc định `/api/v1`), router `/spending`. Bọc `{status_code, message, data}`. Khoá: header `X-Workspace-Key` (hoặc `Authorization: Bearer`). Kho: `?backend=json|mysql|mongo` (mặc định `SPENDING_STORAGE_BACKEND`).

| Method & đường dẫn | Khoá | Thân / tham số | Thành công | Lỗi |
|---|:--:|---|---|---|
| `GET /spending/backends` | — | — | `{default, backends:[{id,available,reason}]}` | — |
| `POST /spending/workspaces` | — | `{name, data?}` | `201 {id, name, access_key, revision:1, created_at}` — **khoá chỉ hiện một lần** | 400 dữ liệu quá lớn/sai kiểu · 503 mongo chưa cấu hình |
| `GET /spending/workspaces/{id}?since=N` | ✔ | `since` tuỳ chọn | `{id,name,revision,created_at,updated_at,data}`; nếu `since == revision`: `{id,name,revision,updated_at,unchanged:true}` (không `data`) | 401 sai/thiếu khoá · 404 không có |
| `PUT /spending/workspaces/{id}` | ✔ | `{revision, name?, data}` | `{…view mới, revision+1}` | **409** `data:{current:<view>}` khi `revision` không khớp · 400 · 401 · 404 |
| `DELETE /spending/workspaces/{id}` | ✔ | — | `{deleted:true}` | 401 · 404 |

Kho `json` có mặt vì cùng mẫu với các app khác (dev không cần DB, và là kho cho test usecase/controller) nhưng **giao diện chỉ đưa MySQL và MongoDB** theo yêu cầu; `json` vẫn gọi được bằng `?backend=json`.

Quy tắc: 404 (không tồn tại) kiểm **trước** 401 (sai khoá) như postman; khoá lưu dạng SHA-256 và so bằng `secrets.compare_digest`; `data` phải là object JSON, `len(json) ≤ SPENDING_MAX_BYTES` (4.000.000); tên 1–120 ký tự.

### 5.1 Thành phần phía backend

| Tệp | Vai trò |
|---|---|
| `src/domain/vo/spending_vo.py` | `SpendingCreateRequest`, `SpendingSaveRequest`, `SpendingCreated`, `SpendingView`, `SpendingRecord` (có `key_hash`, `to_view`) |
| `src/application/ports/output/spending_repository_port.py` | `create`, `get`, `replace_if_revision(record, expected_revision) -> bool`, `delete` |
| `src/application/ports/input/spending_input_port.py` | `create_workspace`, `get_workspace(id, key, since)`, `save_workspace`, `delete_workspace` |
| `src/application/usecases/spending_usecase.py` | xác thực khoá, kiểm kích thước/kiểu, so `revision` (từ chối sớm) **và** CAS ở kho (chặn đua); khi CAS thất bại đọc lại → `ConflictError(payload={"current": view})` |
| `src/adapter/output/spending/{json,mysql,mongo}_repository.py` | ba kho; JSON giữ `asyncio.Lock` + ghi `os.replace`; MySQL `UPDATE … WHERE id=:id AND revision=:expected`, `rowcount==1`; Mongo `update_one({"_id":id,"revision":expected}, …)` rồi `matched_count==1` |
| `src/adapter/factory/spending_factory.py` | chọn kho, cache singleton, `get_spending_input_port` (dependency), `reset_for_tests` |
| `src/adapter/input/controllers/spending_controller.py` | 5 route trên |
| `src/main.py`, `config.py`, `.env.example`, `README.md` | đăng ký router; `SPENDING_STORAGE_BACKEND`, `SPENDING_JSON_FILE`, `SPENDING_MAX_BYTES` |

MySQL: bảng `spending_workspaces(id VARCHAR(64) PK, name VARCHAR(191), key_hash VARCHAR(128), revision INTEGER, created_at VARCHAR(40), updated_at VARCHAR(40), payload LONGTEXT)` tạo bằng `CREATE TABLE IF NOT EXISTS` (không Alembic, như postman). Mongo: collection `spending_workspaces`, `_id` = id, trường `payload_json` (chuỗi).

## 6. Thiết kế giao diện

### 6.1 Cấu trúc điều hướng

| Màn hình | Nội dung |
|---|---|
| **Tổng quan** | Thẻ kỳ tháng (Chi · Thu · Còn lại, so tháng trước), thanh ngân sách tổng, "Đến hạn" (định kỳ chờ xác nhận, sổ sắp đáo hạn), cột chi theo ngày, top danh mục, tài sản, **nợ chung** (ai nợ ai). |
| **Giao dịch** | Thanh kỳ (Tuần · Tháng · Năm · Tất cả, ◀ ▶), ô tìm, bộ lọc, danh sách nhóm ngày (`T2 05/10 · −231.000`), thao tác nhanh: sửa, nhân bản, xoá (hoàn tác). |
| **Báo cáo** | Kỳ, 3 thẻ tổng, donut + bảng theo danh mục, cột theo ngày, theo thứ (T2–T6/T7/CN), xu hướng 12 tháng, top khoản lớn, Sao chép/In. |
| **Chia tiền** | Danh sách người + số dư, chi tiết khoản chung của từng người, **Quyết toán** (gợi ý số, ghi khoản đã thanh toán, sao chép tin nhắn), máy tính chia hoá đơn. |
| **Tài khoản** | Danh sách tài khoản + số dư, tổng tài sản, sổ tiết kiệm (đáo hạn, lãi dự kiến), chuyển tiền, gửi/tất toán/tái tục. |
| **Kế hoạch** | Hạn mức tháng · Giao dịch định kỳ (hai thẻ tab). |
| **Cài đặt** | Lưu trữ & đồng bộ · Danh mục · Dữ liệu (sao lưu, CSV, nhập hàng loạt, xoá) · Giao diện · Phím tắt. |

### 6.2 Bố cục

```
Điện thoại (< 900 px)                         Máy tính (≥ 900 px)
┌───────────────────────────┐                ┌────────┬───────────────────────────────────────┐
│ Quản lý chi tiêu   ●Đã lưu│ ← đầu         │ 💸 QLCT│ [ Nhập nhanh: cơm trưa 57/2 hôm qua ⏎ ]  ●Đã lưu ◐│
├───────────────────────────┤                │ Tổng quan│───────────────────────────────────────┤
│                           │                │ Giao dịch│  nội dung màn hình (tối đa 1100 px)   │
│   nội dung (cuộn)         │                │ Báo cáo  │                                       │
│                           │                │ Chia tiền│                                       │
├───────────────────────────┤                │ Tài khoản│                                       │
│ ▤   ☰   (＋)   ▥   ⋯      │ ← thanh dưới   │ Kế hoạch │                                       │
└───────────────────────────┘                │ Cài đặt  │                                       │
  (＋) = nút nổi → tờ nhập (bottom sheet)     └────────┴───────────────────────────────────────┘
```

Thanh dưới: Tổng quan · Giao dịch · **＋** · Báo cáo · Thêm (Chia tiền, Tài khoản, Kế hoạch, Cài đặt).

### 6.3 Tờ nhập giao dịch (trái tim UX — FR-02/03/04/06)

```
┌ Thêm giao dịch ───────────────────┐
│ [ cơm trưa 57/2 hôm qua        ]  │  ← ô nhập nhanh, autofocus; Enter = lưu
│  57.000 ₫ · Hôm qua T2 05/10 · 🍜 Ăn uống · chia 2 với Phúc  ← chip nhận diện (chạm để sửa)
│ ─────────────────────────────────  │
│ ( Chi | Thu | Chuyển )            │
│ Số tiền   [ 57k            ] = 57.000 ₫
│ Danh mục  🍜 🚌 🏠 🛍 🎁 💊 … (lưới chip, 5 gần dùng nhất lên đầu)
│ Tài khoản [ Tiền mặt ▾ ]   Ngày [Hôm nay][Hôm qua][ 📅 ]
│ Ghi chú   [                    ]  #thẻ
│ ▢ Chi chung  → Ai trả [Tôi ▾]  Tham gia ☑Tôi ☑Phúc  Chia ( Đều | Theo số tiền )
│ Mẫu nhanh: [Bus 205 · 25k] [Be về trọ · 24k] [Cơm mai dịch · 61,5k]  ← chạm = điền sẵn
│ [ Lưu và thêm tiếp ]   [ Lưu ]    │
└───────────────────────────────────┘
```

Ô nhập nhanh và biểu mẫu **cùng một trạng thái**: gõ vào ô nhanh cập nhật các trường, sửa trường cập nhật chip. Bàn phím số (`inputmode="decimal"`) cho ô số tiền. Lưu xong: toast "Đã lưu · Hoàn tác" và giữ focus ở ô nhanh (nhập liên tiếp).

### 6.4 Hệ thống hình ảnh

- Token màu trên `:root`, đổi bằng `[data-theme="dark|light"]`, mặc định theo `prefers-color-scheme`; nền `body` đặt rõ ràng. Màu ngữ nghĩa: chi = đỏ nhạt, thu = xanh lá, chuyển = xanh dương, cảnh báo = vàng. **Không dựa vào màu đơn thuần**: luôn kèm dấu `−`/`+` và nhãn.
- Chữ hệ thống (`system-ui`), số tiền `font-variant-numeric: tabular-nums`; cỡ cơ sở 16 px (tránh iOS tự zoom khi focus ô nhập).
- Điểm gãy: `<900` điện thoại/tablet dọc (thanh dưới), `≥900` thanh bên, `≥1280` lưới 2–3 cột cho thẻ tổng quan.
- Hộp thoại dùng `<dialog>` (có sẵn khoá focus + Esc); trên điện thoại hiển thị như *bottom sheet*.
- Biểu đồ SVG tự vẽ (`charts.js`) có `role="img"`, `aria-label` tóm tắt và bảng số liệu bên cạnh; giữ nguyên khi in.
- `prefers-reduced-motion`: tắt chuyển động. Vùng chạm ≥ 44 px. Focus ring rõ.

### 6.5 Trạng thái đồng bộ (đầu trang)

| Trạng thái | Hiển thị |
|---|---|
| Máy này | `● Trên máy này` (nhắc sao lưu khi quá hạn) |
| Đã lưu | `● Đã lưu` + giờ |
| Đang lưu | `◌ Đang lưu…` |
| Chờ mạng | `◍ Chưa đồng bộ (n thay đổi)` — chạm để thử lại |
| Đã gộp xung đột | toast "Đã gộp thay đổi từ thiết bị khác" |
| Khoá sai / mất không gian | `⚠ Cần kết nối lại` — mở hộp thoại kết nối |

### 6.6 Kết nối máy chủ (Cài đặt → Lưu trữ)

Bộ chọn 3 thẻ: **Máy này** · **MySQL** · **MongoDB**; thẻ máy chủ lấy tình trạng từ `/spending/backends` (vô hiệu hoá + lý do khi hỏng). Chọn một kho máy chủ ⇒ hai lối: *Tạo không gian mới* (đẩy dữ liệu hiện có lên; hiện **mã kết nối** `id.khoá` một lần, nút Sao chép + cảnh báo "mất khoá = mất truy cập") hoặc *Kết nối bằng mã* (dán `id.khoá`; nếu máy đang có dữ liệu: hỏi *Gộp* / *Thay bằng dữ liệu máy chủ*). Ô "Địa chỉ máy chủ" tuỳ chọn cho trường hợp mở bằng `file://`.

## 7. Cấu trúc mã phía trình duyệt

`webapp/tranphuc8a/quan-ly-chi-tieu/`:

```
index.html            vỏ trang, nạp CSS + script theo thứ tự
metadata.json         title, description, tags, icon (portal đọc)
kiem.js               bộ kiểm node (cùng khuôn kiem.js của các ứng dụng khác)
assets/
  kieu.css            token + bố cục + thành phần + in
  money.js dates.js   tiền, ngày  (thuần)
  model.js            tài liệu, chuẩn hoá, thao tác thêm/sửa/xoá + bia mộ (thuần)
  ledger.js           số dư, kỳ, danh mục, nợ, ngân sách, tiết kiệm, định kỳ, lọc/tìm (thuần)
  parser.js           nhập nhanh + hàng loạt + gợi ý danh mục (thuần)
  sync.js             gộp tài liệu (thuần)
  csv.js              xuất/nhập CSV (thuần)
  charts.js           SVG: cột, donut, đường (thuần → chuỗi)
  store.js            LocalStore, RemoteStore, Engine đồng bộ (tiêm storage + fetch → kiểm được)
  ui.js               tiện ích DOM: esc, h, toast, dialog, router, định dạng
  views.js            các màn hình
  app.js              khởi động, state, kết nối mọi thứ
```

Mọi module thuần đăng ký vào `globalThis.QL.<tên>` và `module.exports` khi chạy trong node (cùng khuôn `loi.js`). `ui.js`, `views.js`, `app.js` chỉ chạy trong trình duyệt. Mọi chuỗi người dùng đi qua `esc()` trước khi vào `innerHTML`; sự kiện dùng uỷ quyền `data-act`. Không `eval`, không `new Function`, không nạp script ngoài.

## 8. Bảo mật và quyền riêng tư

- XSS: `esc()` cho mọi dữ liệu người dùng; CSV nhập chỉ là văn bản; kiểm thử bằng chuỗi `<img onerror>`.
- Máy chủ: băm SHA-256 khoá, `compare_digest`, `404` trước `401`, giới hạn kích thước, không log thân yêu cầu. Khoá 192 bit ngẫu nhiên nên dò khoá không khả thi; không thêm giới hạn tần suất (cùng mức postman).
- Khoá lưu trong localStorage của trình duyệt (cần cho tự đồng bộ) — chấp nhận vì không nạp mã ngoài; ghi rõ ở Cài đặt.
- CSV xuất tránh *CSV injection*: ô bắt đầu bằng `= + - @` được thêm dấu `'` phía trước khi xuất.
- Không thu thập gì ngoài dữ liệu người dùng tự lưu; không dùng cookie/analytics.

## 9. Chiến lược kiểm thử

| Tầng | Công cụ | Nội dung chính |
|---|---|---|
| Logic thuần | `kiem.js` (node) | tiền (bảng ≥ 40 chuỗi), ngày/tuần, chia không lệch đồng (thuộc tính ngẫu nhiên), **các số trong PDF** (§6 requirements), ledger, parser (bảng câu), merge (giao hoán/kết hợp/lặp lại, xoá vs sửa), CSV vòng tròn, escape, SVG hợp lệ |
| Đồng bộ | `kiem.js` với `fetch`/`storage` giả | push 200, 409→gộp→thử lại, offline→dirty→online, 401, pull `unchanged` |
| Backend | `pytest` | usecase (khoá, 404/401, revision, kích thước, CAS đua bằng `asyncio.gather`); ba kho cùng một bộ test (JSON, MySQL qua SQLite bộ nhớ, Mongo qua `fake_mongo`); controller qua `TestClient` |
| Tự kiểm tích hợp | `quan-ly-chi-tieu/selftest/run.py` | chạy uvicorn thật (JSON + SQLite, Mongo nếu có), kịch bản HTTP tạo→sửa→xung đột→xoá; trình duyệt thật: 3 cỡ màn, không lỗi console, không tràn ngang, vùng chạm, tab đáy, nhập nhanh, XSS, đổi sáng/tối, chụp ảnh |

## 10. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Đồng hồ máy lệch → LWW chọn nhầm | Hiển thị toast khi gộp; bản ghi xoá/sửa gần nhau hiếm; sao lưu JSON |
| Tài liệu vượt 4 MB (Vercel 4,5 MB) | Hiện dung lượng, cảnh báo từ 3 MB, hướng dẫn xuất rồi xoá năm cũ |
| `localStorage` đầy / bị xoá | Bắt lỗi ghi (giữ nguyên trong bộ nhớ và báo rõ), nhắc sao lưu, xuất/nhập JSON; thay cả sổ luôn giữ bản cũ để hoàn tác một bước |
| Phân tích câu tiếng Việt sai | Luôn xem trước và sửa được; không lưu im lặng giá trị đoán; test bằng bảng câu thật từ PDF |
| Kho JSON trên Vercel là tạm thời | `/storage/backends` đã cảnh báo; giao diện lặp lại cảnh báo khi chọn JSON |
| Trùng/đua khi hai thiết bị đẩy cùng lúc | CAS nguyên tử ở cả 3 kho + gộp phía client |

## 11. Khác biệt giữa thiết kế và bản đã làm

Ghi lại để người đọc sau không phải đoán. Tất cả đều là quyết định trong lúc làm, đã có test.

| Chỗ | Thiết kế ban đầu | Bản đã làm | Vì sao |
|---|---|---|---|
| Dữ liệu không phải object gửi lên API | 400 | **422** qua HTTP (usecase vẫn ném 400 cho người gọi trực tiếp) | FastAPI kiểm `Dict[str, Any]` trước khi vào usecase; client coi 422 như 400 |
| Ghi localStorage | "ghi hai lớp" | một lớp, bắt lỗi, giữ trong bộ nhớ + báo rõ | localStorage không có đổi tên nguyên tử; hai lần ghi cùng gặp đầy dung lượng như nhau |
| Về chế độ "Máy này" | gộp bản đệm cũ với sổ hiện tại | `useLocal("current")`: chép sổ đang làm việc về máy, **bản cũ trên máy giữ lại để hoàn tác**; `"cached"` dùng lại bản cũ | gộp hai sổ độc lập (vd sau khi "Thay bằng dữ liệu máy chủ") sẽ trộn dữ liệu hai người |
| Nhận diện chuyển khoản trong nhập nhanh | chỉ "chuyển … sang" | thêm "rút sổ / gửi tiết kiệm / tích luỹ…"; trong nhập hàng loạt các dòng này bị đánh dấu **không hiểu** thay vì nhập thành khoản chi | `22/04: Rút sổ tiết kiệm 7.718.147` trong PDF mà nhập thành chi 7,7 triệu là sai nặng |
| Biểu thức tiền | `a - b`, `a + b`, `= c` | dấu **trừ** chỉ hiểu khi cả hai vế có đơn vị (`87k - 50k`); `bus 205 - 25k` vẫn là 25k | tránh biến mã tuyến xe/ghi chú thành phép trừ |
| Tìm kiếm | khớp từ không dấu | khớp **đầu từ** (`com` ≠ `Techcombank`) | khớp giữa từ làm kết quả nhiễu |
| Biểu đồ cột | 3 vạch lưới | 4 vạch, bước 1/2/2,5/5×10ᵏ | nhãn trục tròn (100k, 200k…) |
| Biểu tượng tài khoản | chọn tay | theo loại (tiền mặt/ngân hàng/ví) | ít trường hơn, ít lỗi hơn |
| Nhập nhanh trên đầu trang | Enter lưu | Enter lưu **chỉ khi** nhận ra số tiền *và* danh mục *và* không có cảnh báo; ngược lại mở hộp thoại điền sẵn | không lưu im lặng giá trị đoán (nguyên tắc của parser) |
| Mở bằng `file://` | cho nhập "Địa chỉ máy chủ" | thêm: khi chưa có địa chỉ, engine **không gọi API** (không request, không lỗi CORS ở console) | phát hiện bằng selftest trình duyệt |
| Màu chủ đề sáng | — | `--text3`, `--thu` tối hơn | kiểm tĩnh bắt được hai cặp màu dưới 4,5:1 |
| Hiện chi tiết kho khi sẵn sàng | hiện `detail` | chỉ hiện "Sẵn sàng" | `/storage/backends` trả cả tên host DB; UI này không nhắc lại |
