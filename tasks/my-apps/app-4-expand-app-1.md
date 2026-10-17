Ứng dụng 9: Personal Knowledge Graph

1. Bài toán

Tôi muốn xây dựng một Knowledge Graph cá nhân để lưu trữ và biểu diễn những thứ tôi biết, những thứ tôi đã học, những người tôi biết, các dự án tôi làm và mối quan hệ giữa chúng.

Vấn đề của cách ghi chú truyền thống là tri thức thường được tổ chức theo dạng cây:

Programming
├── Java
├── Spring
└── Database

Trong thực tế, tri thức có nhiều quan hệ chéo:

Java ──used_by──> Spring
Spring ──depends_on──> JVM
Spring ──used_in──> AGP
AGP ──uses──> MongoDB
MongoDB ──alternative_to──> PostgreSQL

Tôi muốn ứng dụng giúp tôi nhìn thấy và truy vấn những mối quan hệ này.

---

2. Mục tiêu sản phẩm

Ứng dụng phải cho phép người dùng:

- Tạo và quản lý các Entity/Node.
- Tạo các Relationship/Edge giữa các entity.
- Gắn thuộc tính cho entity.
- Tìm kiếm entity.
- Khám phá các entity liên quan.
- Hiển thị knowledge graph trực quan.
- Truy vấn đường đi giữa các entity.
- Ghi chú/kiến thức cho từng entity.
- Import/export toàn bộ graph.

Mục tiêu không phải trở thành một graph database enterprise, mà là một graph database cá nhân + giao diện quản lý tri thức.


---

3. Khái niệm nghiệp vụ

3.1. Entity

Entity là một đối tượng tồn tại trong knowledge graph.

Ví dụ:

Java
Spring Boot
MongoDB
Docker
AGP
Phúc
Bách Khoa Hà Nội

Entity có:

Thuộc tính	Ý nghĩa

id	ID duy nhất
name	tên
type	loại entity
description	mô tả
properties	thuộc tính mở rộng
tags	tag
created_at	thời gian tạo
updated_at	thời gian cập nhật



---

4. Entity Type

Người dùng có thể định nghĩa loại entity.

Ví dụ:

Person
Technology
Programming Language
Framework
Database
Project
Book
Company
Concept
Place

Một entity thuộc một hoặc nhiều type tùy thiết kế.

Ví dụ:

Spring Boot
type = Framework


---

Custom Type

Người dùng có thể tự tạo:

Algorithm
Programming Pattern
Research Paper
Course

Không được hard-code toàn bộ loại entity trong ứng dụng.


---

5. Property

Entity có thể có các thuộc tính tùy ý.

Ví dụ:

Spring Boot

language = Java
version = 4.x
type = Framework
website = ...

Một entity khác:

Phúc

occupation = Backend Developer
location = Hanoi

Ứng dụng không được yêu cầu mọi entity phải có cùng schema.


---

6. Relationship

Relationship biểu diễn quan hệ giữa hai entity.

Ví dụ:

Spring Boot
    |
    └── written_in ──> Java


---

Một relationship gồm:

Trường	Ý nghĩa

source	entity nguồn
type	loại quan hệ
target	entity đích
properties	thuộc tính của quan hệ
created_at	thời gian tạo



---

7. Relationship Type

Người dùng có thể tạo loại quan hệ.

Ví dụ:

depends_on
uses
created_by
part_of
related_to
alternative_to
implements
extends
learned_from


---

Ví dụ:

Spring Boot
   --depends_on-->
Spring Framework

AGP
   --uses-->
MongoDB

AGP
   --uses-->
RDFox


---

8. Directed và Undirected Relationship

Người dùng có thể lựa chọn.

Directed

A ──depends_on──> B

Có ý nghĩa khác với:

B ──depends_on──> A

Undirected

A ──related_to── B

Hai chiều tương đương.


---

9. Tạo Entity

Người dùng bấm:

+
New Entity

Nhập:

Name:
MongoDB

Type:
Database

Description:
Document-oriented database

Sau đó Save.


---

10. Tạo Relationship

Người dùng mở:

AGP

Chọn:

Add Relationship

Nhập:

Target:
MongoDB

Relationship:
uses

Kết quả:

AGP ──uses──> MongoDB


---

11. Graph View

Đây là giao diện chính của ứng dụng.

Ví dụ:

Java
                  ↑
                  |
              uses
                  |
Spring Boot ──────┘
     |
     | used_in
     ↓
    AGP
   /   \
uses   uses
 /       \
MongoDB  RDFox


---

Thao tác

Người dùng có thể:

- Pan.
- Zoom.
- Kéo node.
- Chọn node.
- Mở chi tiết node.
- Tạo relationship.
- Xóa relationship.
- Ẩn node.
- Chuyển layout.


---

12. Local Graph View

Khi mở một entity, ứng dụng cho phép xem:

1-hop neighbors

Ví dụ mở:

Spring Boot

Hiển thị các entity liên quan trực tiếp.


---

Có thể chọn:

Depth = 1
Depth = 2
Depth = 3

Ví dụ Depth 2:

Spring Boot
├── Java
│   └── JVM
└── Spring Framework
    └── Dependency Injection


---

13. Search

Người dùng nhập:

mongo

Kết quả:

MongoDB
MongoDB Atlas
MongoDB Driver

Search cả:

- Entity name.
- Description.
- Property.
- Tag.


---

14. Relationship Search

Người dùng có thể tìm:

Tất cả entity mà AGP uses

Kết quả:

MongoDB
RDFox
Elasticsearch
Logstash


---

Hoặc:

Tất cả project sử dụng Spring Boot


---

15. Path Finder

Đây là một chức năng quan trọng.

Người dùng chọn:

From:
Java

To:
AGP

Ứng dụng tìm đường đi:

Java
 ↓
Spring Boot
 ↓
AGP


---

Nếu có nhiều đường đi:

Java
 ├──> Spring
 │      └──> AGP
 │
 └──> JVM
        └──> ...

Hiển thị các path tìm được.


---

16. Graph Query

Ứng dụng cung cấp giao diện query đơn giản.

Ví dụ:

Find:
Entity type = Framework

Relationship = used_in

Target type = Project

Kết quả:

Spring Boot → AGP

Không nhất thiết phải yêu cầu người dùng học Cypher/SPARQL.


---

17. Advanced Query

Ở phiên bản nâng cao có thể cung cấp query language.

Ví dụ kiểu:

MATCH (a)-[:uses]->(b)
WHERE a.type = "Project"
RETURN b

Mục tiêu là phục vụ những người dùng kỹ thuật.


---

18. Entity Detail

Khi mở một entity:

MongoDB

Hiển thị:

Information

Type:
Database

Description:
...

Properties

category = NoSQL
language = C++

Incoming Relations

AGP ──uses──> MongoDB
Project X ──uses──> MongoDB

Outgoing Relations

MongoDB ──alternative_to──> PostgreSQL

Notes

Người dùng có thể ghi chú Markdown.


---

19. Notes

Entity có thể có nhiều note.

Ví dụ:

MongoDB

Notes:

2026-10-01
MongoDB sử dụng document model.

2026-10-03
Cần nghiên cứu transaction.


---

Điều này giúp kết hợp:

Knowledge Graph
+
Personal Wiki


---

20. Tag

Entity có thể được gắn tag:

#backend
#database
#agp
#learning

Cho phép filter graph.

Ví dụ:

Chỉ hiển thị #backend


---

21. Timeline

Một entity có thể có lịch sử thay đổi.

Ví dụ:

MongoDB

2026-09-01
Created

2026-09-10
Added relation: AGP uses MongoDB

2026-10-01
Updated description


---

22. Graph Statistics

Dashboard hiển thị:

Entities       1,245
Relationships  3,892
Entity Types      24
Relation Types    37


---

Có thể thống kê:

- Entity có nhiều relationship nhất.
- Type phổ biến nhất.
- Relationship phổ biến nhất.
- Entity cô lập.
- Entity chưa có description.


---

23. Orphan Detection

Tìm các entity không có relationship.

Ví dụ:

Entity:
Kafka

Relations:
0

Ứng dụng đề xuất:

> Entity này chưa có quan hệ với entity nào.



Điều này hữu ích để phát hiện tri thức chưa được liên kết.


---

24. Duplicate Detection

Khi tạo:

PostgreSQL

trong khi đã tồn tại:

Postgres
PostgreSQL DB

Ứng dụng cảnh báo:

> Có thể bạn đang tạo entity trùng với entity hiện có.



Người dùng có thể:

- Merge.
- Keep both.
- Cancel.


---

25. Alias

Một entity có thể có nhiều tên.

Ví dụ:

PostgreSQL

Aliases:
Postgres
PG
PostgresSQL

Search alias vẫn tìm được entity.


---

26. Import

Cho phép import graph từ:

JSON
CSV
GraphML

Ví dụ JSON:

{
  "entities": [],
  "relationships": []
}


---

27. Export

Cho phép export:

JSON
CSV
GraphML

Mục tiêu là không khóa dữ liệu người dùng vào ứng dụng.


---

28. Backup & Restore

Người dùng có thể:

Export Backup

và sau này:

Restore Backup

Backup phải bao gồm:

- Entity.
- Relationship.
- Type.
- Property.
- Note.
- Tag.
- Configuration.


---

29. Undo / Redo

Các thao tác quan trọng có thể undo:

Create Entity
Delete Entity
Create Relationship
Delete Relationship
Edit Property

Ví dụ:

Ctrl + Z

trên desktop hoặc nút Undo trên mobile.



---

31. Bảo vệ dữ liệu

Knowledge graph có thể chứa thông tin cá nhân nên ứng dụng hỗ trợ:

- App lock.
- PIN.
- Biometrics nếu nền tảng hỗ trợ.
- Auto-lock sau một khoảng thời gian.

Dữ liệu lưu trữ local nên có cơ chế mã hóa ở mức phù hợp với nền tảng.


---

32. Hiệu năng

Mục tiêu MVP:

10.000 entities
50.000 relationships

vẫn có thể:

- Search nhanh.
- Mở entity nhanh.
- Hiển thị local graph nhanh.

Không yêu cầu render toàn bộ 50.000 relationship cùng lúc.


---

34. Một phiên sử dụng điển hình

Ví dụ tôi đang học Docker.

Tôi tạo:

Docker
type = Technology

Sau đó tạo:

Docker ──uses──> Container
Docker ──related_to──> Linux
Docker ──alternative_to──> Podman

Tôi tiếp tục tạo:

AGP ──uses──> Docker

Sau một thời gian graph trở thành:

Linux
                           ↑
                           |
                        related
                           |
Docker ──uses──> Container
  │
  ├──alternative_to──> Podman
  │
  └──used_in──> AGP
                  │
          ┌───────┴────────┐
          ↓                ↓
       MongoDB            RDFox

Khi đó ứng dụng không chỉ trả lời:

> "Docker là gì?"



mà còn giúp tôi khám phá:

> "Docker liên quan thế nào đến những thứ tôi đang học và những dự án tôi đang làm?"



Đó chính là giá trị cốt lõi của Personal Knowledge Graph.
