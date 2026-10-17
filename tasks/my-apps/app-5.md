Ứng dụng 10: Reading Journal 

1. Bài toán

Tôi thường đọc nhiều loại tài liệu như:

- Sách.
- Tiểu thuyết.
- Truyện tranh.
- Giáo trình.
- Tài liệu kỹ thuật.
- Bài báo.
- Tài liệu nghiên cứu.

Sau khi đọc, tôi thường gặp các vấn đề:

- Không nhớ mình đã đọc gì.
- Không nhớ đang đọc đến đâu.
- Khó lưu lại những đoạn hay.
- Ghi chú về sách bị phân tán.
- Không biết một năm mình đã đọc bao nhiêu.
- Khó nhìn lại quá trình đọc và những kiến thức đã tích lũy.

Tôi muốn một ứng dụng Reading Journal để quản lý toàn bộ quá trình đọc và ghi chép cá nhân.


---

2. Mục tiêu sản phẩm

Ứng dụng phải cho phép người dùng:

- Quản lý thư viện tài liệu.
- Theo dõi trạng thái đọc.
- Theo dõi tiến độ.
- Ghi chú.
- Lưu trích dẫn.
- Đánh giá tài liệu.
- Theo dõi lịch sử đọc.
- Thống kê thói quen đọc.
- Tìm kiếm nhanh.

Ứng dụng không phải ebook reader bắt buộc. Người dùng có thể đọc sách bằng ứng dụng khác và dùng Reading Journal để quản lý việc đọc.


---

3. Đối tượng người dùng

Người đọc phổ thông

Theo dõi:

Sách đã đọc
Sách đang đọc
Sách muốn đọc

Sinh viên

Theo dõi:

Giáo trình
Tài liệu học tập
Paper

Người làm kỹ thuật

Theo dõi:

Clean Code
Design Patterns
Computer Networks
Research Paper
Documentation


---

4. Khái niệm nghiệp vụ

4.1. Book / Reading Item

Đơn vị tài liệu được quản lý.

Có thể là:

- Book.
- Manga.
- Comic.
- Paper.
- Article.
- Documentation.
- Textbook.

Không nên hard-code chỉ có Book.


---

4.2. Thông tin tài liệu

Ví dụ:

Tên:
Clean Code

Tác giả:
Robert C. Martin

Loại:
Book

Năm:
2008

Các thuộc tính:

Trường	Ý nghĩa

id	định danh
title	tiêu đề
authors	tác giả
type	loại tài liệu
description	mô tả
publisher	nhà xuất bản
published_year	năm xuất bản
language	ngôn ngữ
tags	tag



---

5. Trạng thái đọc

Mỗi tài liệu có một trạng thái:

Want to Read
     ↓
Reading
     ↓
Completed

Ngoài ra:

Paused
Dropped

Ví dụ:

Dấu ấn hung tàn
Status = Reading


---

6. Thêm tài liệu

Người dùng bấm:

+ Add Book

Nhập:

Title
Author
Type
Total Pages
Language
Tags

Sau đó lưu.


---

7. Theo dõi tiến độ

Nếu tài liệu có số trang:

Current page:
125

Total:
400

Ứng dụng tính:

31.25%


---

Nếu là ebook có số chương:

Chapter:
12 / 40


---

Nếu không có page/chapter:

Người dùng có thể dùng:

0 → 100%

để nhập tiến độ thủ công.


---

8. Reading Session

Người dùng có thể ghi nhận một phiên đọc.

Ví dụ:

06/10/2026

20:00 → 21:15

Đọc:
25 pages

Thông tin:

Trường	Ví dụ

Date	06/10
Duration	75 phút
Start page	100
End page	125
Note	Chapter 5



---

9. Reading Timer

Ứng dụng cung cấp timer:

00:42:18

Người dùng:

Start
Pause
Finish

Khi kết thúc:

Reading Session
Duration = 42m

được lưu tự động.


---

10. Nhật ký đọc

Mỗi ngày có thể ghi:

06/10/2026

Hôm nay đọc Clean Code.

Đọc chapter 5.

Điểm đáng chú ý:
...

Có thể xem theo timeline:

Oct 1
Oct 2
Oct 3
...
Oct 6


---

11. Ghi chú

Mỗi tài liệu có thể có nhiều note.

Ví dụ:

Clean Code

Chapter 3

Functions nên nhỏ.

Note hỗ trợ Markdown:

# Functions

- Keep functions small
- One responsibility


---

12. Bookmark

Người dùng có thể đánh dấu vị trí quan trọng.

Ví dụ:

Page 127

"Some important passage..."


---

13. Quote / Trích dẫn

Một quote gồm:

Content
Page
Chapter
Comment

Ví dụ:

"....."

Page 127

My thought:
Điều này áp dụng được cho...


---

14. Rating

Người dùng đánh giá:

★★★★★

Có thể đánh giá riêng:

Tiêu chí	Điểm

Nội dung	5
Văn phong	4
Tính thực tiễn	5
Tổng thể	4.5



---

15. Review

Sau khi hoàn thành tài liệu, người dùng có thể viết review:

Tóm tắt:
...

Điều tôi học được:
...

Điểm mạnh:
...

Điểm yếu:
...

Có nên đọc lại:
Yes

Review là nội dung cá nhân, không phải đánh giá cộng đồng.


---

16. Library

Màn hình thư viện hiển thị:

All
Reading
Completed
Want to Read
Paused
Dropped

Ví dụ:

📖 Reading

Clean Code              60%
Dấu ấn hung tàn         35%

📚 Want to Read

Design Patterns
The Pragmatic Programmer


---

17. Collection

Người dùng tạo bộ sưu tập.

Ví dụ:

Backend

├── Clean Code
├── Effective Java
├── Spring in Action
└── Design Patterns

Một tài liệu có thể thuộc nhiều collection.


---

18. Tag

Ví dụ:

#java
#backend
#algorithm
#fiction
#psychology

Cho phép filter:

tag:algorithm


---

19. Search

Search theo:

- Tên.
- Tác giả.
- Tag.
- Note.
- Quote.
- Review.

Ví dụ:

"dependency injection"

có thể tìm thấy cả note nằm trong một cuốn sách.


---

20. Filter

Có thể lọc:

Type = Book
Status = Completed
Rating >= 4
Tag = Algorithm

Kết hợp nhiều điều kiện.


---

21. Reading Goals

Người dùng đặt mục tiêu:

Mục tiêu năm 2026

Đọc 20 cuốn

Ứng dụng hiển thị:

12 / 20

60%


---

Hoặc mục tiêu thời gian:

Đọc 30 phút/ngày


---

22. Reading Streak

Theo dõi chuỗi ngày đọc:

Mon ✓
Tue ✓
Wed ✓
Thu ✓
Fri ✓

Ví dụ:

Current streak: 12 days
Longest streak: 28 days


---

23. Thống kê

Dashboard:

Books completed
12

Reading time
84h 20m

Pages
4,532

This year


---

Thống kê theo tháng

Jan   █████
Feb   ███
Mar   ███████
...


---

Thống kê theo loại

Fiction       40%
Technical     35%
Textbook      15%
Other         10%


---

24. Reading Speed

Từ Reading Session:

Pages read = 30
Time = 60 min

Ứng dụng tính:

30 pages/hour

Có thể thống kê:

Average:
28 pages/hour


---

25. Estimated Completion

Nếu còn:

200 pages

và tốc độ trung bình:

25 pages/hour

thì:

Estimated reading time:
8 hours

Nếu người dùng đọc trung bình 30 phút/ngày:

Estimated completion:
16 days

Đây là ước tính, không phải cam kết.


---

26. Reading Calendar

Hiển thị dạng calendar:

October 2026

Mon Tue Wed Thu Fri Sat Sun
          ✓   ✓
✓   ✓       ✓       ✓
    ✓   ✓   ✓

Mỗi ngày có thể mở ra để xem:

- Đọc gì.
- Bao lâu.
- Bao nhiêu trang.
- Ghi chú gì.


---

27. Related Knowledge

Nếu kết hợp với ứng dụng Personal Knowledge Graph, tài liệu có thể liên kết tới các khái niệm.

Ví dụ:

Clean Code
    |
    ├──> SOLID
    ├──> OOP
    ├──> Refactoring
    └──> Design Pattern

Từ tài liệu có thể mở trực tiếp entity tương ứng.


---

28. Recommendation cá nhân

Không cần AI ở V1.

Dựa trên:

- Tag.
- Author.
- Rating.
- Collection.
- Lịch sử đọc.

Ứng dụng có thể gợi ý:

Bạn thích:

#algorithm
#computer-science

Có thể đọc tiếp:

Introduction to Algorithms

Đây chỉ là recommendation dựa trên dữ liệu local.


---

29. Import / Export

Import:

JSON
CSV

Export:

JSON
CSV
Markdown


---

30. Backup / Restore

Backup phải chứa:

Books
Authors
Collections
Tags
Reading Sessions
Notes
Quotes
Reviews
Goals
Statistics metadata

Restore phải kiểm tra:

- Version backup.
- Dữ liệu lỗi.
- Trùng ID.
- Khả năng tương thích schema.


---

31. Cho phép hoạt động Offline

Toàn bộ chức năng core:

- CRUD.
- Search.
- Statistics.
- Timer.
- Notes.
- Quotes.
- Goals.

đều có thể hoạt động được khi không có Internet.


---

32. Privacy

Reading history và personal notes là dữ liệu cá nhân.

Ứng dụng không được mặc định gửi dữ liệu ra ngoài.

Có thể hỗ trợ:

- App lock.
- PIN.
- Biometrics.
- Auto-lock.



---

34. Một phiên sử dụng điển hình

Tôi thêm:

Clean Code
400 pages

Đặt:

Status = Reading

Buổi tối tôi mở app:

Start Reading

Đọc từ:

Page 120

đến:

Page 145

sau 50 phút.

Bấm:

Finish

Ứng dụng tự ghi:

Reading Session

50 minutes
25 pages
50 pages/hour

Tôi đánh dấu một đoạn ở trang 137:

Quote
+
Personal note

Sau một tháng hoàn thành sách:

Status = Completed

Ứng dụng tổng hợp:

Clean Code

Reading time: 14h 20m
Pages: 400
Sessions: 18
Rating: ★★★★★

Notes: 24
Quotes: 12

Như vậy, ứng dụng không chỉ lưu "tôi đã đọc cuốn gì", mà xây dựng được một lịch sử đọc có cấu trúc để sau này có thể truy vấn lại: mình đã đọc gì, học được gì, đọc như thế nào và những kiến thức nào xuất hiện nhiều nhất trong quá trình đọc.