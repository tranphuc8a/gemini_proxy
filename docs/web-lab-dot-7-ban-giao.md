# Đợt 7 — bàn giao

Ngày 2026-09-27. Đọc cùng [`web-lab-visualize.md`](web-lab-visualize.md) (ngữ
cảnh kỹ thuật) và [`web-lab-ke-hoach.md`](web-lab-ke-hoach.md) (lộ trình, có
phần phân loại 16 ý tưởng ở mục 4b).

---

## Làm được gì

Site `courses/lab-visual/` từ **28 → 32 lab**. Nhóm mới: **Câu đố quyết định** —
93 lab cũ trên bốn site không có cái nào thuộc loại này.

| Lab | Điều nó cho thấy |
|---|---|
| **Cân xu** (`lab-canxu.js`) | 13 xu cần **4** lần dù cận nói 3; thêm một xu *đã biết là thật* thì tụt về 3 |
| **Thả trứng** (`lab-thatrung.js`) | 100 tầng 2 trứng = **14**, không phải √100 = 10; từ **5 trứng** trở đi thêm nữa vô ích |
| **Đoán chuỗi** (`lab-doanchuoi.js`) | Đoán một chuỗi **bạn biết chắc là sai** lại hạ xấu-nhất từ 6 xuống 5 |
| **Dồn hạt** (`lab-donhat.js`) | Entropy trông như tốn N² mà tính đúng bằng **O(H+W)**; dồn về đâu cũng **cùng một đáp số** |

**Engine mọc thêm ba thứ**, cả ba đều đếm được ≥ 2 lab cần trước khi tách ra:

* `V.cayQuyetDinh` — dựng / bố cục / vẽ / đi theo cây quyết định. **5 lab cần.**
* `V.canThongTin(N, b)` — cận dưới ⌈log_b N⌉, có chuẩn hoá chống sai số.
* `V.choiThu({batDau, nuocDi, xong, diem, toiUu})` — chế độ người dùng tự chơi:
  nhận nước đi, lịch sử, hoàn tác, chấm điểm so với tối ưu. **≥ 5 lab cần.**
  Đây là thứ biến lab thành **game**.

Tự kiểm tra nguyên hàm: **59 → 96 mục**.

---

## Bốn lần số đo bác bỏ câu tôi đã viết

Đây là phần đáng đọc nhất của đợt này. Cả bốn lần tôi đều viết sẵn một kết luận
rồi mới đo — và cả bốn lần số đo nói khác.

### 1. “Bỏ yêu cầu nói nặng/nhẹ thì đôi khi bớt được một lần cân”

**Sai.** Vét cạn N = 2–40 × 0–4 xu thật: **không một trường hợp nào** bớt được.
Đã thay bằng chính kết quả âm đó — nó tự nó đã thú vị, và người đọc bật tắt
tham số là kiểm lại được.

### 2. Lab **Dồn hạt**: “điểm tụ tối ưu là trung vị”

**Sai — nhầm mục tiêu với chi phí.** Trung vị là đáp án của bài toán *khác*:
“đặt một điểm sao cho tổng khoảng cách tới nó nhỏ nhất”. Bài này hỏi **entropy
cuối cùng**, mà tổng khoảng cách mọi cặp **bất biến theo tịnh tiến** — dời cả
khối đi không đổi gì. Đo trên lưới 60×60, 729 hạt:

| tâm | entropy cuối | nước đi |
|---|---|---|
| trung vị | 4,7406×10⁶ | 22 569 |
| trung bình | 4,7406×10⁶ | 22 102 |
| giữa lưới | 4,7406×10⁶ | 22 568 |
| góc (5,5) | **5,1276×10⁶** | 26 535 |

Ba tâm đầu **bằng nhau tới từng chữ số**. Tâm chỉ đổi **số nước đi**, và chỉ đổi
kết quả khi khối bị **mép lưới cắt**. Luận điểm mới hay hơn cái cũ, và lab được
viết lại quanh nó.

### 3. Lab **Dồn hạt**: “ngân sách ít thì gom vài cụm sẽ thắng”

**Sai.** Đo 3 cách gieo × 5 mức ngân sách (2–40 lần số ô): **ba cụm thua hết,
không một ô nào**. Kể cả khi dữ liệu *vốn dĩ* là hai cụm — gộp một khối vẫn
thắng đậm (46 % so với 96 %). Đã thay bằng kết quả âm đó.

### 4. Lab **Đoán chuỗi**: “được đoán cả chuỗi sai → xấu nhất 5”

**Đúng, nhưng có điều kiện tôi chưa biết.** Ở trần tìm kiếm 300 (mặc định cũ),
cả bốn chiến lược đều ra 6 — luận điểm biến mất. Phải lên **600** thì bản mở
rộng mới đạt 5. Đã nâng mặc định, và biến chính điều đó thành bài học: *lợi ích
của việc dám hỏi câu mình biết là sai chỉ hiện ra khi bạn thực sự cân nhắc
chúng.* Kèm đánh đổi đo được: bản mở rộng xấu-nhất **tốt hơn** (5 vs 6) nhưng
trung bình **tệ hơn** (4,60 vs 4,48).

> **Bài học lặp lại từ đợt 6, và tôi vẫn dẫm vào:** viết sẵn kết luận rồi đi
> dựng lab để minh hoạ nó là làm ngược. **Đo trước, viết sau.**

---

## Ba bug thật bị lộ ra và đã sửa

### 1. `bomKhung` cho đồng hồ chạy lại từ 0 mỗi lần gọi

DOM giả truyền `i * 16.7` làm dấu thời gian, với `i` bắt đầu lại từ 0 ở **mỗi**
lần gọi. Nên từ lần gọi thứ hai trở đi, `t − tTruoc` trong vòng lặp bộ phát là
**số âm**, `du` tụt xuống âm và không bao giờ hồi.

**Hệ quả: đường “Chạy” của MỌI lab chưa từng chạy nổi một bước nào trong DOM
giả.** Chỉ đường “tua” là được kiểm. Đã sửa bằng một đồng hồ tăng dần toàn cục,
và thêm chặn `dt < 0` ngay trong engine (một dấu thời gian lùi — đổi tab, đồng
hồ hệ thống nhảy — cũng làm hỏng y hệt trên trình duyệt thật).

### 2. `nutChayCua` bắt nhầm nút của lab

Nó lấy nút `.chinh` **đầu tiên** trong `#main`. Các lab đợt này có nút hành động
riêng cũng dùng class `chinh` (“⚖ Cân”, “🎯 Đoán”), nên nó che mất nút Chạy
thật. Mọi phép thử dùng `chayMotIt()` **lặng lẽ không chạy gì cả**. Đã sửa: tìm
trong khối `.phat-nut` của bộ phát trước.

Hai bug này cộng lại giải thích vì sao giải đấu của lab Đoán chuỗi báo **0 ván**
sau 600 khung hình.

### 3. `ceil(log_b N)` sai đúng ở luỹ thừa chẵn

`Math.log(27)/Math.log(3)` ra `3.0000000000000004`, nên `ceil` cho **4** thay vì
3. Sai một đơn vị, đúng ở chỗ người ta tin nhất. Cũng vậy với 81/3 và 125/5.
`V.canThongTin` chuẩn hoá lại bằng phép nhân nguyên, và `thu-engine.js` có phép
thử riêng cho bẫy này.

---

## Trạng thái kiểm tra

```bash
cd backend/fastapi/webapp/courses
python engine/sync.py --kiem                 # bản sao khớp nguồn
node engine/thu-engine.js                    # 96 nguyên hàm engine
node engine/thu-nhanh.js lab-visual          # DOM giả
cd lab-visual && node kiem-so.js             # 141 phép đối chiếu số
cd lab-visual && python check.py --tinh      # cả 5 tầng
cd backend/fastapi && ./.venv/Scripts/python.exe -m pytest tests/ -q
```

| Tầng | Kết quả |
|---|---|
| Tĩnh (Python) | xanh, 32 lab, id không trùng |
| Nguyên hàm engine | **96 mục** đạt (59 → 96) |
| DOM giả `lab-visual` | xanh |
| Đối chiếu số `lab-visual` | **141 phép** khớp (112 → 141) |
| Ba site còn lại | xanh |
| Pytest backend | 640 passed |
| Chromium (playwright) | **chưa cài** → tự bỏ qua |

Các con số then chốt đều **kiểm được bằng nguồn độc lập**: 12 xu → 3 lần và
13 xu → 4 lần (vét cạn, đối chiếu công thức `(3^w−3)/2`); 100 tầng 2 trứng → 14
(quy hoạch động, đối chiếu số tam giác `d(d+1)/2` và tổng `ΣC(d,i)`); entropy
`O(H+W)` đối chiếu vét cạn `N²` khớp **tuyệt đối**.

---

## Điều CHƯA làm, phải nói rõ

> **Vẫn chưa lab nào trong 32 lab được mở bằng trình duyệt thật.** Bảy đợt liền.

Đợt này rủi ro cao hơn hẳn các đợt trước, vì bốn lab đều có **tương tác chuột
mới** mà DOM giả không kiểm được gì:

- bấm từng đồng xu để xếp lên đĩa cân (`lab-canxu`)
- bấm từng tầng toà nhà để thả trứng (`lab-thatrung`)
- bấm từng ô ký tự để đổi chữ (`lab-doanchuoi`)
- bấm vào lưới con để đặt tâm (`lab-donhat`)

Cộng thêm `V.cayQuyetDinh` là nguyên hàm vẽ mới: tầng DOM giả chỉ **đếm số lần
gọi** lệnh vẽ, nên cây có chồng chữ lên nhau hay tràn khung thì không ai biết.
Bố cục cây *có* được kiểm về mặt toạ độ (lá không chồng, cha nằm giữa con, không
tràn lề) nhưng không kiểm được phần nhìn.

**Muốn đóng lỗ hổng này phải cài `playwright`** — tầng 5 đã viết sẵn, đang tự bỏ
qua. Chưa cài vì quy ước dự án là không thêm dependency mà chưa hỏi.

---

## Việc tiếp theo, theo đúng thứ tự đã chốt

1. **Ba ứng dụng ngoài lab** — bạn đã chốt “làm cả ba sau khi xong đợt 7”:
   JSON editor · design pattern cheat sheet · quản lý chi tiêu. Dựng ngoài
   `courses/`, vì chúng dùng hạ tầng khác hẳn (có lưu trữ, không chạy `file://`).
2. **Đợt 8** — thuốc độc · thử chìa khoá · tháp Hà Nội · hai quân mã. Dùng lại
   `V.cayQuyetDinh` + `V.choiThu` nên rẻ hơn hẳn đợt 7.
3. **Đợt 9** — chuỗi Markov · Bloom filter.
4. **Đợt 10** — vẽ số bằng chuột → mạng đoán. Nguồn dữ liệu đã chốt: **sinh thủ
   tục, huấn luyện trong trình duyệt**.
