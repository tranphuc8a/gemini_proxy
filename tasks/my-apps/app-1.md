Ứng dụng 1: Personal Wiki (Second Brain)

1. Bài toán

Tôi là người thường xuyên học tập, nghiên cứu và ghi chép kiến thức.

Hiện nay tôi gặp các vấn đề:

- Ghi chú nằm rải rác ở nhiều nơi.
- Khó tìm lại kiến thức đã học.
- Không thấy được mối liên hệ giữa các kiến thức.
- Đọc sách xong dễ quên.
- Học nhiều chủ đề khác nhau (lập trình, toán học, AI, DevOps...) nhưng không xây dựng được hệ thống tri thức cá nhân.

Tôi muốn một ứng dụng pwa chạy trên điện thoại, máy tính để lưu trữ và tổ chức tri thức cá nhân.


---

2. Mục tiêu sản phẩm

Ứng dụng phải cho phép:

- Ghi chép kiến thức.
- Liên kết các kiến thức với nhau.
- Tìm kiếm nhanh.
- Quan sát tri thức dưới dạng đồ thị.
- Theo dõi quá trình học tập lâu dài.


---

3. Khái niệm nghiệp vụ

Workspace

Là không gian tri thức của người dùng.

Ví dụ:

Workspace của Phúc

Một người dùng thường chỉ có một workspace.


---

Note

Đơn vị tri thức cơ bản.

Ví dụ:

# Bloom Filter

Bloom Filter là cấu trúc dữ liệu...

Mỗi note có:

Thuộc tính	Mô tả

id	định danh
title	tiêu đề
content	nội dung
created_at	ngày tạo
updated_at	ngày sửa
tags	danh sách tag
status	trạng thái



---

Tag

Nhãn phân loại.

Ví dụ:

algorithm
database
spring
docker

Một note có nhiều tag.


---

Link

Liên kết giữa hai note.

Ví dụ:

Bloom Filter
    |
Hash Function

Người dùng có thể tạo link bằng:

[[Hash Function]]


---

4. Quản lý Note

UC-01 Tạo note

Người dùng chọn:

+
New Note

Nhập:

Title
Content
Tags

Bấm lưu.

Hệ thống tạo note mới.


---

UC-02 Chỉnh sửa note

Người dùng mở note.

Sửa nội dung.

Bấm Save.


---

UC-03 Xóa note

Người dùng chọn:

Delete

Hệ thống:

- hỏi xác nhận
- xóa note


---

UC-04 Archive note

Người dùng có thể lưu trữ note cũ.

Archive khác Delete.

Archive vẫn có thể khôi phục.


---

5. Markdown Editor

Yêu cầu

Hỗ trợ:

# heading

## heading

**bold**

*italic*

- list

1. list

`code`

```cpp
int main(){}

---

## Preview

Người dùng chuyển đổi:

```text
Edit
Preview

để xem kết quả render.


---

6. Backlink

Mục tiêu

Khi note A tham chiếu note B.

Ví dụ:

Bloom Filter sử dụng [[Hash Function]]

Hệ thống tự động:

Hash Function

Referenced By:
- Bloom Filter


---

Use case

Người dùng mở:

Hash Function

Thấy toàn bộ note liên quan.


---

7. Graph View

Mục tiêu

Quan sát tri thức dưới dạng mạng lưới.

Ví dụ:

Docker
 |
Container
 |
Kubernetes

Java
 |
Spring


---

Chức năng

Zoom.

Pan.

Click node.

Mở note.

Ẩn hiện tag.

Lọc node.


---

8. Search

Search theo tiêu đề

Ví dụ:

bloom

Trả về:

Bloom Filter


---

Full Text Search

Ví dụ:

false positive

Tìm trong nội dung.


---

Search theo tag

Ví dụ:

tag:algorithm


---

9. Note Relationship

Mối quan hệ

Cho phép:

related_to

depends_on

parent_of

child_of

Ví dụ:

Spring depends_on Java

Docker related_to Container


---

10. Daily Note

Người dùng mở app.

Tự động có:

2026-10-06

để ghi chép trong ngày.


---

11. Reading Note

Người dùng đọc sách.

Tạo:

Book:
Clean Code

Chapter:
Functions

Quote:
...


---

12. Flashcard

Người dùng đánh dấu:

Q: Bloom Filter là gì?

A: ...

Hệ thống tạo flashcard.


---

13. Favorites

Cho phép ghim note quan trọng.

Ví dụ:

DSU
Segment Tree
Spring Security


---

14. Export

Người dùng xuất dữ liệu:

JSON
Markdown ZIP
PDF
Image

---

15. Backup

Người dùng bấm:

Backup

Sinh:

backup_20261006.zip


---

16. Phi chức năng

Cho phép: offline - hoạt động không cần mạng.


---

Dung lượng

Mục tiêu:

100.000 note

vẫn tìm kiếm được.


---

Hiệu năng

Search:

< 1 giây

với 100.000 note.


---

An toàn dữ liệu

Không mất dữ liệu khi:

- tắt ứng dụng
- hết pin
- crash

