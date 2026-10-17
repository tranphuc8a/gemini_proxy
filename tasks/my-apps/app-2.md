Ứng dụng 6: Algorithm Notebook

1. Bài toán

Tôi là sinh viên CNTT, lập trình viên hoặc người học thuật toán.

Khi học thuật toán tôi gặp các vấn đề:

- Kiến thức phân tán ở nhiều nguồn.
- Khó nhớ khi nào nên dùng thuật toán nào.
- Quên độ phức tạp.
- Quên template code.
- Khó so sánh các thuật toán tương tự nhau.
- Đọc lại giáo trình mất thời gian.
- Khi gặp bài toán mới không biết bắt đầu từ đâu.

Tôi muốn một ứng dụng offline đóng vai trò như:

Sổ tay thuật toán cá nhân
+
Bách khoa thư thuật toán
+
Công cụ tra cứu nhanh
+
Người hướng dẫn lựa chọn thuật toán


---

2. Mục tiêu sản phẩm

Ứng dụng phải giúp người dùng:

- Học thuật toán.
- Tra cứu nhanh.
- So sánh thuật toán.
- Luyện tập ghi nhớ.
- Xây dựng thư viện cá nhân.
- Chuẩn bị phỏng vấn.
- Chuẩn bị thi ICPC/OI/Codeforces.



---

3. Đối tượng người dùng

Nhóm 1

Sinh viên CNTT.

Ví dụ:

Học CTDL&GT


---

Nhóm 2

Competitive Programmer.

Ví dụ:

ICPC
Codeforces
AtCoder


---

Nhóm 3

Software Engineer.

Ví dụ:

System Design
Database
Distributed System


---

4. Khái niệm nghiệp vụ

Algorithm

Đơn vị kiến thức chính.

Ví dụ:

Dijkstra
Fenwick Tree
KMP
Dinic


---

Mỗi algorithm gồm:

Trường	Mô tả

id	định danh
name	tên
category	nhóm
description	mô tả
complexity	độ phức tạp
code	template
use_case	khi nào dùng
pitfalls	lỗi thường gặp
tags	tag



---

5. Danh mục thuật toán

Cấu trúc dữ liệu

Array
Stack
Queue
Heap
DSU
Fenwick
Segment Tree
Treap


---

Graph

BFS
DFS
Dijkstra
Bellman Ford
Floyd
MST
Dinic


---

String

KMP
Trie
Suffix Array
Aho Corasick


---

DP

Knapsack
Bitmask DP
Digit DP
Tree DP


---

Math

Prime
CRT
FFT
NTT


---

Optimization

Hill Climbing
SA
GA
GRASP
Beam Search


---

6. Xem chi tiết thuật toán

Ví dụ:

Dijkstra


---

Thông tin hiển thị:

Mô tả

Tìm đường đi ngắn nhất


---

Điều kiện áp dụng

Trọng số không âm


---

Độ phức tạp

O((V+E)logV)


---

Code

...


---

Ví dụ

Input

Output


---

Bài tập liên quan

CSES
Codeforces
VNOI


---

7. Search

Search theo tên

Ví dụ:

dijk


---

Search theo tag

graph
shortest-path


---

Search theo độ phức tạp

Ví dụ:

O(logN)


---

Search theo use case

Ví dụ:

range query


---

8. Thuật toán nên dùng?

Đây là chức năng quan trọng.


---

Use Case

Người dùng trả lời câu hỏi.

Ví dụ:

Dữ liệu là đồ thị?
YES

Có trọng số?
YES

Có trọng số âm?
NO


---

Kết quả:

Dijkstra


---

Ví dụ:

Update điểm?
YES

Query prefix sum?
YES


---

Kết quả:

Fenwick Tree


---

9. Decision Tree

Ứng dụng chứa cây quyết định.

Ví dụ:

Graph

├─ shortest path
│  ├─ negative edge
│  │      Bellman Ford
│  └─ non-negative
│         Dijkstra


---

Mục tiêu:

Người dùng không cần biết tên thuật toán.

Chỉ cần mô tả bài toán.


---

10. So sánh thuật toán

Use Case

Người dùng chọn:

Fenwick
Segment Tree


---

Hệ thống hiển thị:

Tiêu chí	Fenwick	Segment

Query	O(logN)	O(logN)
Range Update	khó	dễ
Memory	ít	nhiều



---

Ví dụ khác:

Dijkstra
Bellman Ford
SPFA


---

11. Cheat Sheet

Hiển thị dạng ngắn gọn.

Ví dụ:

DSU

Union:
O(αN)

Find:
O(αN)


---

Mục tiêu:

Tra cứu trong 5 giây.


---

12. Personal Library

Người dùng tự thêm kiến thức.

Ví dụ:

Li Chao Tree

Nguồn:
cp-algorithms


---

Hoặc:

AGP Permission Engine


---

Ứng dụng không giới hạn chỉ thuật toán chuẩn.


---

13. Template Manager

Quản lý code.

Ví dụ:

template.cpp


---

Người dùng lưu:

DSU
Segment Tree
Dinic


---

Có thể:

Copy
Export


---

14. Visualization

Graph Algorithm

Ví dụ:

Dijkstra

Hiển thị animation:

Step 1

Relax A->B

Step 2

Relax B->C


---

Data Structure

Ví dụ:

Fenwick Tree

Hiển thị:

update(5,+3)

Node 5
Node 4


---

15. Quiz Mode

Ứng dụng tạo câu hỏi.

Ví dụ:

N = 100000

Point Update

Range Sum Query

Hỏi:

Nên dùng gì?


---

Người dùng trả lời.


---

16. Flashcard Mode

Ví dụ:

Q:
Dijkstra dùng được khi nào?

A:
Không có cạnh âm.


---

17. Roadmap Learning

Người dùng chọn mục tiêu.

Ví dụ:

Competitive Programming


---

Ứng dụng đề xuất:

Array
↓
Stack
↓
Queue
↓
Binary Search
↓
Graph
↓
DP


---

18. Theo dõi tiến độ

Mỗi thuật toán có trạng thái.

Chưa học

Đang học

Đã học

Thành thạo


---

Dashboard:

Graph: 80%

DP: 60%

Math: 40%


---

19. Bookmark

Đánh dấu thuật toán quan trọng.

Ví dụ:

Dinic

LCA

Tree DP


---

20. Export

Xuất:

JSON

Markdown

PDF


---

21. Phi chức năng

Cho phép Offline


---

Hiệu năng

Search:

< 100ms


---

Quy mô

Ít nhất:

10.000 thuật toán

và ghi chú cá nhân.


---

22. MVP V1

Để phát hành đầu tiên chỉ cần:

Core

- Danh mục thuật toán
- Xem chi tiết
- Search
- Template Manager
- Bookmark
- Personal Notes

Chưa cần

- Visualization
- Quiz
- Flashcard
- Learning Roadmap
- Decision Tree

MVP này đã đủ để trở thành một "CP Algorithms Handbook Offline" dùng hàng ngày cho sinh viên CNTT, người luyện ICPC và kỹ sư phần mềm.