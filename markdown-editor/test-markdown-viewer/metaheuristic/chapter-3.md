# Chương 3 — Exact Search (Tìm kiếm chính xác)

Đây là chương cực kỳ quan trọng.

Nếu Greedy là:

```text
Tôi đoán hướng đi tốt.
```

DP là:

```text
Tôi lưu kết quả để tránh tính lại.
```

Thì Exact Search là:

```text
Tôi vẫn tìm nghiệm tối ưu tuyệt đối.
Nhưng tôi sẽ cố không duyệt những thứ vô ích.
```

---

# 3.1. Vị trí của Exact Search trong thế giới Optimization

Có thể chia các phương pháp thành:

```text
Optimization
│
├─ Greedy
│
├─ Dynamic Programming
│
├─ Exact Search
│   ├─ Backtracking
│   ├─ Branch & Bound
│   ├─ A*
│   ├─ IDA*
│   ├─ Meet in the Middle
│   └─ Branch & Cut
│
└─ Metaheuristic
    ├─ Simulated Annealing
    ├─ Tabu Search
    ├─ Genetic Algorithm
    ├─ ALNS
    └─ ...
```

---

# 3.2. Exact Search là gì?

Cho bài toán:

$$
\max f(x)
$$

---

Greedy:

```text
Không xét tất cả.
```

---

Metaheuristic:

```text
Không đảm bảo tối ưu.
```

---

Exact Search:

```text
Luôn tìm được optimum.
```

---

Nhưng cố gắng:

```text
Không duyệt toàn bộ không gian nghiệm.
```

---

# 3.3. Ví dụ đơn giản

Có 20 đồ vật.

Mỗi đồ vật:

```text
lấy
hoặc
không lấy
```

---

Tổng số khả năng:

$$
2^{20}
=
1048576
$$

---

Nếu:

```text
n = 50
```

---

$$
2^{50}
=
1125899906842624
$$

---

Không thể duyệt hết.

---

Ý tưởng Exact Search:

```text
Cắt bỏ sớm.
```

---

# 3.4. Search Tree

Mọi bài toán tối ưu tổ hợp đều có thể nhìn như:

```text
Root
├─ chọn A
│  ├─ chọn B
│  └─ bỏ B
│
└─ bỏ A
   ├─ chọn B
   └─ bỏ B
```

---

Đây gọi là:

$$
\boxed{
Search Tree
}
$$

---

Nghiệm:

```text
một lá
```

---

Tối ưu:

```text
lá tốt nhất
```

---

# 3.5. Backtracking

Thuật toán cơ bản nhất.

---

Ví dụ:

Tìm mọi hoán vị.

```cpp
void dfs(...)
{
    if(done)
    {
        evaluate();
        return;
    }

    for(each choice)
    {
        choose();
        dfs();
        undo();
    }
}
```

---

Mẫu này xuất hiện khắp nơi.

---

# 3.6. Tư duy của Backtracking

Ví dụ:

```text
1 2 3
```

---

Bắt đầu:

```text
[]
```

---

Chọn:

```text
1
```

---

Tiếp:

```text
[1]
```

---

Chọn:

```text
2
```

---

Tiếp:

```text
[1,2]
```

---

Chọn:

```text
3
```

---

Ra nghiệm:

```text
[1,2,3]
```

---

Sau đó:

```text
undo 3
```

---

Đây là nguồn gốc tên:

```text
back-track
```

---

# 3.7. Complexity

Backtracking thuần:

$$
O(b^d)
$$

---

Trong đó:

* b = branching factor
* d = depth

---

Ví dụ:

```text
50 item
```

---

$$
2^{50}
$$

---

Không chạy nổi.

---

# 3.8. Pruning

Vũ khí đầu tiên.

---

Ý tưởng:

Nếu biết chắc:

```text
nhánh này
```

không thể tạo nghiệm tối ưu.

---

Thì:

```text
bỏ luôn
```

---

Không cần duyệt tiếp.

---

# 3.9. Ví dụ Pruning

Knapsack:

Capacity:

```text
10
```

---

Đã chọn:

```text
weight = 12
```

---

Không hợp lệ.

---

Cắt.

```text
X
```

---

Không duyệt sâu hơn.

---

# 3.10. Feasibility Pruning

Loại pruning đầu tiên.

---

Nếu vi phạm ràng buộc:

```text
weight > capacity
```

---

Hoặc:

```text
time > limit
```

---

Hoặc:

```text
xe quá tải
```

---

Cắt.

---

Đây là kiểu pruning dễ nhất.

---

# 3.11. Optimization Pruning

Mạnh hơn nhiều.

---

Giả sử:

Best hiện tại:

```text
1000
```

---

Nhánh đang xét:

```text
700
```

---

Kể cả lấy hết phần còn lại:

```text
+200
```

---

Tổng:

```text
900
```

---

Không thể thắng:

```text
1000
```

---

Cắt.

---

Đây là nền tảng của:

$$
\boxed{
Branch\ and\ Bound
}
$$

---

# 3.12. Branch and Bound

Thuật toán Exact Search quan trọng nhất.

---

Ý tưởng:

```text
Branch
```

=

```text
chia cây
```

---

```text
Bound
```

=

```text
ước lượng giới hạn tốt nhất có thể đạt
```

---

Nếu bound thua nghiệm tốt nhất:

```text
cắt
```

---

# 3.13. Khung Branch and Bound

```cpp
DFS(node)
{
    if(bound(node) <= best)
        return;

    if(leaf)
    {
        update(best);
        return;
    }

    branch();
}
```

---

Đây là framework vàng của optimization.

---

# 3.14. Upper Bound

Bài toán maximize.

---

Ta cần:

$$
UB(node)
$$

---

Sao cho:

$$
true\ optimum
\le UB
$$

---

Nếu:

$$
UB < best
$$

---

Cắt.

---

# 3.15. Ví dụ Knapsack

Đang có:

```text
value = 300
```

---

Còn:

```text
20 kg
```

---

Giả sử:

Nếu cho phép lấy lẻ đồ vật.

---

Ta tính được:

```text
giá trị tối đa lý thuyết
```

=

```text
420
```

---

Đây là:

```text
Upper Bound
```

---

Nếu:

```text
best = 450
```

---

Cắt.

---

# 3.16. Tại sao Bound quan trọng?

Ví dụ:

```text
2^50
```

---

Không pruning:

```text
1125 nghìn tỷ lá
```

---

Bound tốt:

```text
vài triệu node
```

---

Khác biệt cực lớn.

---

# 3.17. Search Order

Không chỉ pruning.

---

Thứ tự duyệt cũng quan trọng.

---

Ví dụ:

```text
nhánh tốt nhất
```

được duyệt trước.

---

Ta nhanh chóng tìm được:

```text
best = 10000
```

---

Sau đó:

```text
bound
```

cắt hàng loạt.

---

# 3.18. Best First Search

Thay vì DFS.

---

Ta dùng:

```text
priority queue
```

---

Luôn mở rộng:

```text
node có bound cao nhất
```

---

Đây là nền tảng của:

$$
\boxed{
A^*
}
$$

---

# 3.19. A*

A* là Branch and Bound cho bài toán đường đi.

---

Định nghĩa:

$$
f(n)
=
g(n)
+
h(n)
$$

---

Trong đó:

$$
g(n)
$$

=

```text
chi phí đã đi
```

---

$$
h(n)
$$

=

```text
ước lượng còn lại
```

---

# 3.20. Ví dụ A*

Đi từ:

```text
Hà Nội
```

tới:

```text
TP HCM
```

---

Hiện ở:

```text
Đà Nẵng
```

---

Chi phí đã đi:

```text
800
```

---

Khoảng cách chim bay:

```text
700
```

---

A* dùng:

$$
800+700
$$

---

để ưu tiên.

---

# 3.21. Admissible Heuristic

Nếu:

$$
h(n)
\le
true\ remaining
$$

---

Thì:

```text
A*
```

luôn tối ưu.

---

Đây là định lý nổi tiếng nhất của A*.

---

# 3.22. IDA*

Iterative Deepening A*.

---

Ý tưởng:

Thay vì:

```text
priority queue
```

khổng lồ.

---

Ta:

```text
DFS
```

với ngưỡng.

---

Ví dụ:

```text
f <= 10
```

---

Không thấy nghiệm.

---

Tăng:

```text
f <= 20
```

---

Tiếp tục.

---

Rất phổ biến trong:

* Rubik
* 15 Puzzle
* Sokoban

---

# 3.23. Meet in the Middle

Kỹ thuật thần kỳ.

---

Ví dụ:

```text
40 phần tử
```

---

Bruteforce:

$$
2^{40}
$$

---

Quá lớn.

---

Tách:

```text
20
+
20
```

---

Duyệt:

$$
2^{20}
$$

và

$$
2^{20}
$$

---

Ghép lại.

---

Complexity:

$$
O(2^{n/2})
$$

---

Đây là giảm cực mạnh.

---

# 3.24. Ví dụ Subset Sum

Cho:

```text
40 số
```

---

Tìm:

```text
tổng = X
```

---

Meet in the Middle:

```text
nửa trái
nửa phải
```

---

Sinh mọi tổng.

---

Sort.

---

Binary Search.

---

Đây là bài kinh điển.

---

# 3.25. Exact Search cho TSP

TSP có 4 họ lớn:

---

### 1. Bruteforce

$$
O(n!)
$$

---

### 2. Held-Karp

$$
O(n^2 2^n)
$$

---

### 3. Branch and Bound

Thực tế:

```text
n = 50~100
```

vẫn có thể.

---

### 4. Branch and Cut

Concorde dùng.

---

Giải được:

```text
hàng chục nghìn thành phố
```

tối ưu.

---

# 3.26. Exact Search trong bài Air Conditioner

Bài Samsung:

```text
200~400 nhà
```

---

State:

```text
nhà nào đã làm
```

---

Không thể DP.

---

Nhưng có thể:

```text
Greedy
```

↓

```text
Branch & Bound cục bộ
```

↓

```text
Local Search
```

---

Đây là tư duy hybrid hiện đại.

---

# 3.27. Exact Search và Metaheuristic

Exact Search:

```text
Có chứng minh tối ưu
```

---

Metaheuristic:

```text
Không có chứng minh
```

---

Đổi lại:

```text
scale lớn hơn nhiều
```

---

# 3.28. Điều quan trọng nhất

Mọi Exact Search mạnh đều dựa trên:

$$
\boxed{
Bound
}
$$

---

Không phải:

```text
DFS
```

---

Không phải:

```text
Backtracking
```

---

Mà là:

```text
ước lượng tương lai tốt đến mức nào
```

---

Bound càng chặt:

```text
càng ít node
```

---

# 3.29. Công thức tư duy

Khi gặp bài tối ưu tổ hợp.

Hãy tự hỏi:

```text
1. Không gian nghiệm là gì?
2. Search tree là gì?
3. Có pruning nào?
4. Có upper bound nào?
5. Có lower bound nào?
6. Có state compression nào?
```

---

# 3.30. Tóm tắt chương

Exact Search gồm:

```text
Backtracking
      ↓
Pruning
      ↓
Branch & Bound
      ↓
A*
      ↓
IDA*
      ↓
Branch & Cut
```

Khái niệm quan trọng nhất:

$$
\boxed{
Search\ Tree
}
$$

$$
\boxed{
Pruning
}
$$

$$
\boxed{
Upper\ Bound
}
$$

$$
\boxed{
Lower\ Bound
}
$$

$$
\boxed{
Branch\ and\ Bound
}
$$

---

Đây là cây cầu nối giữa:

```text
Dynamic Programming
```

và

```text
Mathematical Optimization
```

Bởi vì chương tiếp theo (**Chương 4 — Local Search & Neighborhood Search**) sẽ bắt đầu từ một ý tưởng hoàn toàn khác:

```text
Tôi không cần tối ưu tuyệt đối.

Tôi chỉ cần liên tục cải thiện nghiệm hiện tại.
```

và đó là nền móng của gần như toàn bộ metaheuristic hiện đại.
