# Chương 11 — VND / VNS

## Variable Neighborhood Descent & Variable Neighborhood Search

Chương này rất quan trọng vì nó đưa ta đến một ý tưởng sâu hơn hẳn **Local Search** và **ILS**:

> **Local optimum phụ thuộc vào neighborhood.**
>
> Vì vậy, nếu bị kẹt ở local optimum của \(N_1\), thay vì perturb nghiệm một cách ngẫu nhiên, ta có thể **đổi sang một neighborhood khác**.

Đó chính là nền tảng của **Variable Neighborhood Search (VNS)**.

VNS được Pierre Hansen và Nenad Mladenović phát triển từ cuối những năm 1990; bài tổng quan kinh điển năm 2001 trình bày ý tưởng thay đổi neighborhood một cách có hệ thống trong cả pha descent và pha thoát khỏi valley. ([ScienceDirect][1])

Đặc biệt, **VND — Variable Neighborhood Descent** là thành phần nền tảng của VNS: thay vì chỉ dùng một neighborhood cho Local Search, ta tuần tự thay đổi giữa nhiều neighborhood.

---

# 1. Vấn đề căn bản của Local Search

Ở chương 5, ta đã định nghĩa:

$$
N(s)
$$

là neighborhood của solution \(s\).

Local Search tìm:

$$
s'=\arg\min_{x\in N(s)}f(x)
$$

nếu \(s'\) tốt hơn \(s\), ta đi đến \(s'\).

Tiếp tục cho đến khi:

$$
\forall x\in N(s):
f(x)\ge f(s)
$$

thì:

$$
\boxed{s\text{ là local optimum đối với }N}
$$

Nhưng hãy chú ý:

> **Local optimum là tương đối với neighborhood.**

---

# 2. Một nghiệm có thể là local optimum của \(N_1\) nhưng không phải \(N_2\)

Ví dụ:

```text
N1 = Swap
N2 = Insert
N3 = 2-opt
```

Ta có:

$$
s^*
$$

và:

$$
\forall x\in N_1(s^*):
f(x)\ge f(s^*)
$$

⇒ \(s^*\) là local optimum theo Swap.

Nhưng hoàn toàn có thể:

$$
\exists y\in N_2(s^*):
f(y)<f(s^*)
$$

Do đó:

$$
\boxed{
LocalOptimum(N_1)\not\Rightarrow LocalOptimum(N_2)
}
$$

Đây chính là observation làm nên VND.

---

# 3. Ví dụ cực kỳ trực quan

Giả sử một nghiệm có cost:

$$
100
$$

Ta dùng Swap:

```text
Swap
 ↓
không có move tốt
 ↓
cost = 100
```

Local Search kết luận:

> "Tôi bị kẹt."

Nhưng chuyển sang Insert:

```text
Insert
 ↓
move tốt
 ↓
cost = 94
```

Vậy thực ra:

```text
100
 │
 │ Swap: không đi được
 │
 └── Insert ──→ 94
```

**Không phải solution không còn đường đi.**

Chỉ là:

> neighborhood hiện tại quá yếu.

---

# 4. Đây là insight quan trọng nhất của chương

Ở Local Search, ta thường suy nghĩ:

$$
\boxed{\text{Search solution}}
$$

Trong VND, ta bắt đầu suy nghĩ:

$$
\boxed{\text{Search solution + search neighborhood}}
$$

Tức là neighborhood trở thành **một biến của thuật toán**.

---

# 5. VND — Variable Neighborhood Descent

VND là viết tắt của:

> **Variable Neighborhood Descent**

Ý tưởng:

1. Có danh sách neighborhoods:

$$
N_1,N_2,\ldots,N_k
$$

2. Bắt đầu với \(N_1\).
3. Local Search theo \(N_1\).
4. Nếu tìm được solution tốt hơn → quay lại \(N_1\).
5. Nếu không cải thiện → chuyển \(N_2\).
6. Nếu \(N_2\) cũng không cải thiện → \(N_3\).
7. ...
8. Nếu tất cả neighborhoods đều không cải thiện → dừng.

Đây là một cơ chế cực kỳ đơn giản nhưng rất mạnh.

---

# 6. Pseudocode VND

Cho minimization:

```cpp
Solution VND(Solution s) {

    int k = 1;

    while (k <= K) {

        Solution s2 = localSearch(s, N[k]);

        if (cost(s2) < cost(s)) {
            s = s2;
            k = 1;
        }
        else {
            k++;
        }
    }

    return s;
}
```

Đây là pattern cần nhớ:

$$
\boxed{
\text{improvement}
\Rightarrow
k\leftarrow1
}
$$

$$
\boxed{
\text{no improvement}
\Rightarrow
k\leftarrow k+1
}
$$

---

# 7. Tại sao khi cải thiện phải quay lại \(N_1\)?

Đây là một điểm rất dễ bỏ qua.

Giả sử:

```text
N1 = Swap
N2 = Insert
N3 = 2-opt
```

Ta có:

```text
s
 ↓ N1
không cải thiện
 ↓ N2
s'
 ↓
cost giảm
```

Bây giờ neighborhood \(N_1\) phải được xét lại.

Tại sao?

Vì sau khi chuyển:

$$
s\rightarrow s'
$$

cấu trúc nghiệm đã thay đổi.

Có thể một Swap từng không tốt ở \(s\), nhưng lại rất tốt ở \(s'\).

Ví dụ:

```text
s:
Swap: không tốt
Insert: tốt
   ↓
s'

s':
Swap: tốt
```

Do đó:

$$
\boxed{
\text{Sau mỗi improvement, mọi neighborhood trước đó có thể trở nên hữu ích lại.}
}
$$

---

# 8. Ví dụ VND hoàn chỉnh

Giả sử:

```text
N1 = Swap
N2 = Insert
N3 = 2-opt
```

Ta bắt đầu:

$$
f(s)=100
$$

### Neighborhood 1

Swap:

$$
100\rightarrow100
$$

Không cải thiện.

Chuyển:

$$
N_1\rightarrow N_2
$$

### Neighborhood 2

Insert:

$$
100\rightarrow95
$$

Cải thiện.

Reset:

$$
k=1
$$

### Neighborhood 1 lần nữa

Swap:

$$
95\rightarrow92
$$

Reset.

### Neighborhood 1

Không cải thiện.

### Neighborhood 2

Không cải thiện.

### Neighborhood 3

2-opt:

$$
92\rightarrow87
$$

Reset.

Cuối cùng:

```text
Swap
  ↓
Insert
  ↓
Swap
  ↓
2-opt
  ↓
...
```

Ta không đơn giản đi:

```text
N1 → N2 → N3
```

mà thực tế là:

$$
N_1\rightarrow N_2\rightarrow N_1\rightarrow N_2\rightarrow N_3\rightarrow\cdots
$$

---

# 9. Khi nào VND dừng?

Khi:

$$
N_1,N_2,\ldots,N_k
$$

đều không thể cải thiện.

Tức là:

$$
\forall i,\quad
s=\operatorname{LocalSearch}_{N_i}(s)
$$

Do đó nghiệm cuối cùng thỏa:

$$
\boxed{
s\text{ là local optimum đối với tất cả }N_1,\ldots,N_k
}
$$

Đây là một khái niệm mạnh hơn local optimum thông thường.

Ta có thể gọi nó là:

> **multi-neighborhood local optimum**

---

# 10. Hierarchy của local optimum

Nếu:

$$
N_1\subseteq N_2
$$

thì:

$$
LocalOpt(N_2)
\Rightarrow
LocalOpt(N_1)
$$

nhưng chiều ngược lại không đúng.

Ví dụ:

$$
N_{\text{Swap}}
\subsetneq
N_{\text{Exchange}}
$$

thì một nghiệm local-optimal trên Exchange chắc chắn local-optimal trên Swap.

Nhưng local-optimal trên Swap chưa chắc local-optimal trên Exchange.

Đây là một lý do tại sao xây dựng **neighborhood hierarchy** rất quan trọng.

---

# 11. Neighborhood hierarchy

Một thiết kế điển hình:

```text
N1: nhỏ, rẻ
       ↓
N2: lớn hơn
       ↓
N3: mạnh hơn
       ↓
N4: rất mạnh, rất đắt
```

Ví dụ TSP:

```text
N1 = 2-opt
N2 = Or-opt
N3 = 3-opt
```

hoặc:

```text
N1 = swap
N2 = insert
N3 = 2-opt
N4 = 3-opt
```

Nguyên tắc:

> **Neighborhood càng mạnh thì thường càng đắt để khám phá.**

Do đó nên dùng neighborhood rẻ trước.

---

# 12. VND không phải VNS

Hai khái niệm này rất dễ nhầm.

### VND

Chỉ thay đổi neighborhood trong **descent/local improvement**.

```text
solution
   ↓
N1
   ↓
N2
   ↓
N3
   ↓
local optimum
```

### VNS

Ngoài việc thay đổi neighborhood để descent, còn dùng neighborhood để **perturb/escape** khỏi local optimum.

```text
                  ┌────── N1 ── Local Search
                  │
solution → Shake ─┤
                  │
                  ├────── N2 ── Local Search
                  │
                  └────── N3 ── Local Search
```

Theo Hansen et al., VNS có ý tưởng thay đổi neighborhood một cách có hệ thống **cả trong descent phase lẫn perturbation phase**. ([ScienceDirect][2])

---

# 13. VNS — Variable Neighborhood Search

VNS mở rộng VND bằng một ý tưởng:

> Nếu local search đã tối ưu solution theo neighborhood hiện tại, hãy **shake** solution bằng một neighborhood khác rồi chạy local search lại.

Giả sử:

$$
N_1,N_2,\ldots,N_k
$$

Ta có:

```text
s
 ↓
Shake N1
 ↓
Local Search
 ↓
s'
```

Nếu:

$$
f(s')<f(s)
$$

thì:

$$
s\leftarrow s'
$$

và:

$$
k\leftarrow1
$$

Nếu không:

$$
k\leftarrow k+1
$$

---

# 14. Basic VNS

Pseudo:

```cpp
Solution VNS() {

    Solution s = initialSolution();
    s = localSearch(s);

    Solution best = s;

    int k = 1;

    while (!termination()) {

        Solution sPrime =
            shake(s, N[k]);

        Solution sLocal =
            localSearch(sPrime);

        if (cost(sLocal) < cost(s)) {
            s = sLocal;
            k = 1;
        }
        else {
            k++;
        }

        best = min(best, sLocal);
    }

    return best;
}
```

Đây là **Basic VNS** về mặt ý tưởng.

---

# 15. Điểm khác biệt với ILS

Đây là phần rất quan trọng vì cậu vừa học ILS.

ILS:

$$
\boxed{
\text{Perturbation}
\rightarrow
LS
\rightarrow
Acceptance
}
$$

VNS:

$$
\boxed{
\text{Shake with }N_k
\rightarrow
LS
\rightarrow
\text{change }N_k
}
$$

Sự khác biệt cốt lõi:

### ILS

Perturbation thường được thiết kế như một operator riêng.

Ví dụ:

```text
double bridge
destroy-repair
random k-swap
```

### VNS

Perturbation có cấu trúc:

$$
N_1,N_2,\ldots,N_k
$$

Tức là:

> **mức độ perturbation được điều khiển bởi neighborhood structure.**

---

# 16. Một cách nhìn rất đẹp

ILS:

```text
Local optimum
      ↓
   perturb
      ↓
new solution
```

VNS:

```text
Local optimum
      ↓
 shake N1
      ↓
 shake N2
      ↓
 shake N3
      ↓
 ...
```

Do đó VNS có một **scale of exploration**.

---

# 17. Neighborhood \(N_k\) trong VNS có ý nghĩa gì?

Thông thường:

$$
N_1(s)
$$

là các nghiệm rất gần \(s\).

$$
N_2(s)
$$

xa hơn.

$$
N_3(s)
$$

xa hơn nữa.

Ví dụ:

```text
N1 = 1-swap
N2 = 2-swap
N3 = 3-swap
N4 = 4-swap
```

Ta có:

$$
N_1\subseteq N_2\subseteq N_3\subseteq N_4
$$

theo cách xây dựng thích hợp.

---

# 18. Nhưng “neighborhood” không nhất thiết phải nested

Đây là một điểm quan trọng.

Ta **không bắt buộc**:

$$
N_1\subset N_2\subset N_3
$$

Ví dụ:

```text
N1 = Swap
N2 = Insert
N3 = 2-opt
```

Ba neighborhood hoàn toàn khác nhau.

VNS vẫn hoạt động.

Cái quan trọng là:

$$
\boxed{
N_1,N_2,\ldots,N_k
\text{ tạo ra các dạng biến đổi khác nhau}
}
$$

và thường được sắp xếp từ nhẹ đến mạnh.

---

# 19. VNS có hai loại “search”

Đây là điểm phải phân biệt thật rõ.

## Search 1 — Shake

Từ:

$$
s
$$

chọn ngẫu nhiên một nghiệm:

$$
s'\in N_k(s)
$$

Mục đích:

> **Diversification / escape**

Không nhất thiết \(s'\) tốt hơn.

---

## Search 2 — Local Search

Từ:

$$
s'
$$

tìm:

$$
s^*=LS(s')
$$

Mục đích:

> **Intensification**

Đây là cấu trúc:

$$
\boxed{
Shake = explore
}
$$

$$
\boxed{
Local\ Search = exploit
}
$$

---

# 20. Vì sao Shake phải random?

Nếu Shake luôn chọn cùng một move:

```text
s → s'
```

thì VNS có thể lặp lại cùng trajectory.

Thay vào đó:

$$
s'\sim N_k(s)
$$

randomly.

Ví dụ:

$$
N_2(s)=\{\text{mọi 2-swap}\}
$$

chọn ngẫu nhiên một 2-swap.

Nhờ vậy cùng một local optimum có thể dẫn tới nhiều basin khác nhau.

---

# 21. VNS không nhất thiết cần acceptance kiểu SA

Đây là điểm khác ILS mà cậu nên nhớ.

Basic VNS thường có acceptance rất đơn giản:

$$
\boxed{
\text{accept iff improved}
}
$$

Nếu:

$$
f(s^*)<f(s)
$$

thì:

$$
s\leftarrow s^*
$$

Nếu không:

$$
s\text{ giữ nguyên}
$$

Nhưng neighborhood index:

$$
k\leftarrow k+1
$$

để thử một shake mạnh hơn.

Vì vậy VNS có thể escape local optimum mà **không cần chấp nhận nghiệm xấu**.

Đây là một điểm rất đẹp của VNS. Hansen & Mladenović mô tả basic VNS dựa trên việc thay đổi neighborhood có hệ thống và nhảy sang solution tốt hơn sau local improvement, thay vì cần cơ chế cấm move như Tabu Search. ([ScienceDirect][1])

---

# 22. Ví dụ

Giả sử:

$$
f(s)=100
$$

Ta thử:

### \(N_1\)

```text
shake
 ↓
local search
 ↓
102
```

Không tốt.

Giữ:

$$
s=100
$$

---

### \(N_2\)

```text
shake
 ↓
local search
 ↓
105
```

Không tốt.

---

### \(N_3\)

```text
shake
 ↓
local search
 ↓
94
```

Cải thiện.

Accept:

$$
s=94
$$

và reset:

$$
k=1
$$

Sau đó lại:

```text
N1
N2
N3
...
```

---

# 23. VNS là một dạng ILS đặc biệt?

Đây là một cách nhìn rất hữu ích.

ILS:

$$
P(s)
$$

là perturbation operator tổng quát.

VNS:

$$
P(s,k)=Shake(N_k(s))
$$

Tức là VNS có thể xem như:

$$
\boxed{
ILS + structured perturbation
}
$$

Nhưng về mặt thuật ngữ và framework, không nên đồng nhất hoàn toàn hai thuật toán; VNS có triết lý riêng: **systematic neighborhood change** ở cả descent và escape phase. ([ScienceDirect][2])

---

# 24. VND + VNS = GVNS

Một biến thể quan trọng:

> **General Variable Neighborhood Search — GVNS**

Thay vì:

```text
Shake
 ↓
một Local Search
```

ta dùng:

```text
Shake
 ↓
VND
 ↓
local optimum
```

Tức là:

$$
\boxed{
GVNS = VNS + VND
}
$$

Cấu trúc:

```text
               ┌──── N1 ──┐
               │          │
s ── Shake ──→ s' → VND ──┼→ local optimum
               │          │
               ├──── N2 ──┤
               │          │
               └──── N3 ──┘
```

Đây là một trong những hybrid quan trọng nhất của họ VNS. Các tài liệu tổng quan VNS phân biệt các basic schemes và các biến thể dựa trên VND/local search. ([IDEAS/RePEc][3])

---

# 25. RVNS — Reduced VNS

Có một biến thể rất thú vị:

> **Reduced Variable Neighborhood Search**

Nếu local search quá đắt, ta bỏ Local Search.

Chỉ:

```text
Shake
 ↓
evaluate
 ↓
accept if better
```

Pseudo:

```cpp
while (...) {

    candidate = shake(current, k);

    if (better(candidate, current)) {
        current = candidate;
        k = 1;
    }
    else {
        k++;
    }
}
```

Điều này hữu ích khi:

$$
LS
$$

quá tốn thời gian.

---

# 26. VND vs RVNS vs VNS vs GVNS

| Thuật toán   | Shake | Local Search | Nhiều neighborhood |
| ------------ | ----: | -----------: | -----------------: |
| Local Search |     ❌ |            ✓ |           thường 1 |
| VND          |     ❌ |            ✓ |                  ✓ |
| RVNS         |     ✓ |            ❌ |                  ✓ |
| VNS          |     ✓ |            ✓ |                  ✓ |
| GVNS         |     ✓ |      **VND** |                  ✓ |

Đây là bảng rất đáng nhớ.

---

# 27. Variable Neighborhood Descent sâu hơn

VND không chỉ đơn giản là:

```text
N1 → N2 → N3
```

Nó thực chất là một **meta-local-search**.

Local Search thông thường:

$$
LS_N(s)
$$

VND:

$$
VND(s)
=
LS_{N_1,N_2,\ldots,N_k}(s)
$$

Có thể xem:

$$
\boxed{
VND = Local\ Search\ over\ Local\ Search\ Operators
}
$$

---

# 28. VND tạo ra một local optimum mạnh hơn

Với Local Search:

$$
s^* = LS_{N_1}(s)
$$

ta chỉ biết:

$$
s^*\in LO(N_1)
$$

Với VND:

$$
s^*=VND(s)
$$

thì:

$$
s^*\in
LO(N_1)\cap LO(N_2)\cap\cdots\cap LO(N_k)
$$

Do đó:

$$
\boxed{
LO_{VND}
\subseteq
LO_{N_i}
}
$$

với mọi \(i\), theo cách hiểu tập nghiệm local-optimal tương ứng.

---

# 29. Nhưng VND có một trade-off

Neighborhood càng nhiều:

$$
k\uparrow
$$

thì:

$$
\text{quality}\uparrow
$$

thường nhưng:

$$
\text{runtime}\uparrow
$$

Ví dụ:

```text
VND:
Swap
Insert
2-opt
3-opt
4-opt
5-opt
```

có thể cực mạnh.

Nhưng:

$$
3\text{-opt}
$$

đã có neighborhood rất lớn.

Nếu thời gian giới hạn 100 ms như bài của cậu, việc dùng tất cả neighborhood mạnh nhất chưa chắc tối ưu.

---

# 30. Neighborhood ordering là một bài toán optimization

Giả sử:

```text
N1 = Swap
N2 = Insert
N3 = 2-opt
```

và:

* Swap: rẻ, improvement 20%
* Insert: trung bình, improvement 15%
* 2-opt: đắt, improvement 10%

Thứ tự hợp lý:

$$
Swap\rightarrow Insert\rightarrow2opt
$$

Nhưng nếu:

* Swap: rẻ nhưng hiếm khi cải thiện
* 2-opt: đắt nhưng gần như luôn cải thiện

thì có thể:

$$
2opt\rightarrow Swap
$$

tốt hơn.

Do đó:

$$
\boxed{
\text{Neighborhood ordering is itself a design problem.}
}
$$

---

# 31. Có thể adaptive neighborhood ordering

Ta có thể đo:

$$
p_i=
\frac{\text{number of improvements by }N_i}
{\text{times }N_i\text{ was used}}
$$

và:

$$
c_i=\text{average computational cost}
$$

Sau đó đánh giá:

$$
score_i=
\frac{p_i}{c_i}
$$

Neighborhood nào:

$$
score_i
$$

cao hơn thì ưu tiên hơn.

Đây là hướng **adaptive VNS**.

---

# 32. Variable Neighborhood Change — không chỉ đổi neighborhood

Một ý tưởng sâu hơn:

Ta không nhất thiết phải coi:

$$
N_1,N_2,N_3
$$

là ba neighborhood độc lập.

Ta có thể coi chúng là các **resolution levels**:

```text
N1
↓
micro changes

N2
↓
medium changes

N3
↓
large structural changes
```

Do đó VNS gần với ý tưởng:

> **multi-scale search**

---

# 33. Tại sao đổi neighborhood giúp thoát local optimum?

Giả sử:

$$
s^*\in LO(N_1)
$$

Ta có:

$$
N_1(s^*)
$$

không chứa improvement.

Nhưng:

$$
N_2(s^*)
$$

có.

Do đó:

```text
          N2
         ↗
A* ────────→ B
 ↑
 │
N1
(no move)
```

Không cần:

* accept bad solution,
* tabu list,
* temperature.

Chỉ cần:

$$
\boxed{\text{đổi cách định nghĩa “lân cận”.}}
$$

Đây là insight trung tâm của VNS.

---

# 34. VNS và Tabu Search

Tabu Search:

> Không muốn quay lại những vùng vừa đi qua.

VNS:

> Không muốn bị giới hạn bởi một neighborhood duy nhất.

Khác biệt:

```text
Tabu:
memory → control trajectory

VNS:
neighborhood change → alter search landscape
```

VNS thường không cần tabu memory.

---

# 35. VNS và Simulated Annealing

SA:

$$
P(\text{accept worse})
=
e^{-\Delta/T}
$$

VNS:

$$
\text{change }N_k
$$

SA escape bằng:

> acceptance.

VNS escape bằng:

> neighborhood.

---

# 36. VNS và ILS

Đây là bảng quan trọng nhất của chương:

|                          | ILS              | VNS                                  |
| ------------------------ | ---------------- | ------------------------------------ |
| Local Search             | ✓                | ✓                                    |
| Perturbation             | ✓                | ✓                                    |
| Acceptance               | quan trọng       | thường đơn giản                      |
| Multiple neighborhoods   | không bắt buộc   | **trung tâm**                        |
| Perturbation structure   | operator         | \(N_k\)                              |
| Descent đổi neighborhood | không bắt buộc   | VND/VNS                              |
| Escape mechanism         | perturbation     | shake bằng neighborhood              |
| Main idea                | jump giữa basins | thay đổi scale/cấu trúc neighborhood |

Một câu dễ nhớ:

> **ILS hỏi: “Phá nghiệm hiện tại thế nào?”**

> **VNS hỏi: “Nếu neighborhood hiện tại không đủ, hãy thử một neighborhood khác.”**

---

# 37. Áp dụng VND vào TSP

Ví dụ:

$$
N_1=2opt
$$

$$
N_2=3opt
$$

Algorithm:

```text
Tour
 ↓
2-opt descent
 ↓
2-opt local optimum
 ↓
3-opt descent
 ↓
3-opt local optimum
 ↓
2-opt again
 ↓
...
```

Điểm quan trọng:

> 3-opt thay đổi tour, nên có thể tạo ra cơ hội 2-opt mới.

---

# 38. Áp dụng VND vào Scheduling

Giả sử ta có:

$$
N_1=Swap
$$

$$
N_2=Insert
$$

$$
N_3=Block\ Move
$$

Ví dụ:

```text
Machine 1:
A B C D E F

Machine 2:
G H I
```

VND:

```text
Swap jobs
 ↓
Insert jobs
 ↓
Move block
 ↓
Swap again
 ↓
...
```

Các neighborhood càng lớn càng có khả năng sửa cấu trúc schedule sâu hơn.

---

# 39. Áp dụng VND vào bài Air Conditioner

Đây là nơi chương này đặc biệt hữu ích.

Ta có thể xây:

$$
N_1=\text{swap 2 houses}
$$

$$
N_2=\text{move house}
$$

$$
N_3=\text{swap between days}
$$

$$
N_4=\text{remove + reinsert}
$$

$$
N_5=\text{2-opt route}
$$

---

# 40. Neighborhood 1 — Swap

Ví dụ:

```text
Day 1:
A B C D
```

Swap:

```text
A C B D
```

Mục tiêu cải thiện:

* travel distance
* overtime
* khả năng thêm house khác.

---

# 41. Neighborhood 2 — Insert

```text
A B C D
```

move B:

```text
A C D B
```

Insert đặc biệt hữu ích nếu thứ tự phục vụ quan trọng.

---

# 42. Neighborhood 3 — Cross-day relocate

```text
Day 1:
A B C D

Day 2:
E F G
```

Move:

$$
C:Day1\rightarrow Day2
$$

```text
Day 1:
A B D

Day 2:
E C F G
```

Có thể làm:

$$
Score\uparrow
$$

do cân bằng thời gian giữa các ngày.

---

# 43. Neighborhood 4 — Remove + Reinsert

Đây là neighborhood mạnh hơn:

```text
remove A
remove B

reinsert:
A → Day 3
B → Day 1
```

Nó có thể thay đổi cấu trúc solution đáng kể.

---

# 44. Neighborhood 5 — 2-opt

Trong từng ngày:

```text
A → B → C → D → E
```

2-opt có thể biến:

```text
A → B → D → C → E
```

để giảm tổng Manhattan distance.

---

# 45. Một VND thực tế cho bài AC

Tớ sẽ xếp:

```text
N1 = intra-day swap
N2 = intra-day insert
N3 = inter-day relocate
N4 = inter-day swap
N5 = 2-opt
N6 = destroy-repair nhỏ
```

VND:

```text
N1
 ↓ fail
N2
 ↓ improve
N1
 ↓
N1
 ↓ fail
N2
 ↓ fail
N3
 ↓ improve
N1
 ↓
...
```

Khi tất cả:

$$
N_1,\ldots,N_6
$$

không cải thiện:

$$
\boxed{s=\text{VND local optimum}}
$$

---

# 46. Sau đó nâng thành VNS

Thay vì dừng:

```text
VND → DONE
```

ta làm:

```text
VND
 ↓
local optimum
 ↓
Shake N1
 ↓
VND
 ↓
if improve → reset
 ↓
Shake N2
 ↓
VND
 ↓
...
```

Pseudo:

```cpp
Solution GVNS(Solution s) {

    s = VND(s);

    Solution best = s;

    int k = 1;

    while (timeRemaining()) {

        Solution candidate =
            shake(s, N[k]);

        candidate =
            VND(candidate);

        if (score(candidate) > score(s)) {

            s = candidate;
            best = max(best, candidate);

            k = 1;

        } else {

            k++;
        }

        if (k > K)
            k = 1;
    }

    return best;
}
```

Đây là một framework rất đáng thử cho bài AC.

---

# 47. Một insight cực kỳ quan trọng: VND và VNS có thể lồng nhau

Ta có:

```text
VNS
 ├── Shake N1
 │     └── VND
 │          ├── N1
 │          ├── N2
 │          └── N3
 │
 ├── Shake N2
 │     └── VND
 │
 └── Shake N3
       └── VND
```

Tức là có **hai tầng neighborhood**:

### Outer neighborhood

Điều khiển diversification.

### Inner neighborhood

Điều khiển intensification.

Đây chính là GVNS.

---

# 48. Outer vs Inner Neighborhood

Có thể ký hiệu:

$$
N_k^{outer}
$$

và:

$$
N_j^{inner}
$$

Một iteration:

$$
s'
\in N_k^{outer}(s)
$$

sau đó:

$$
s^*=VND(s')
$$

với:

$$
VND=
N_1^{inner},N_2^{inner},\ldots
$$

Do đó:

$$
\boxed{
GVNS=
\text{outer diversification}
+
\text{inner intensification}
}
$$

Đây là cách nhìn rất hữu ích khi sau này cậu tự thiết kế hybrid metaheuristic.

---

# 49. Neighborhood không chỉ là move

Đây là một khái niệm cần mở rộng.

Ta thường nghĩ:

$$
N(s)=\{\text{solutions tạo bởi một move}\}
$$

Nhưng thực tế neighborhood có thể được định nghĩa bởi:

* số lượng variables thay đổi;
* số node được remove;
* số edge được đổi;
* số jobs được relocate;
* số clusters được merge/split;
* kích thước destroy;
* radius;
* number of exchanges.

Ví dụ:

$$
N_k(s)
=
\{\text{solutions khác }s\text{ ở tối đa }k\text{ components}\}
$$

Do đó VNS rất tổng quát.

---

# 50. VNS không nhất thiết dành cho discrete optimization

Đây là một điểm đáng chú ý trong tài liệu VNS.

VNS được dùng cho:

* combinatorial optimization;
* integer programming;
* mixed-integer programming;
* nonlinear programming;
* continuous optimization;
* graph problems;
* automatic programming.

Handbook of Metaheuristics 2019 dành riêng một chương cho VNS và mô tả các ứng dụng từ large-scale location/MILP đến nonlinear programming và graph theory. ([IDEAS/RePEc][4])

---

# 51. VNS cho continuous optimization

Với:

$$
x\in\mathbb{R}^n
$$

ta có thể định nghĩa:

$$
N_k(x)
=
\{y:\|x-y\|\le r_k\}
$$

với:

$$
r_1<r_2<r_3
$$

Ví dụ:

```text
N1 = radius 0.01
N2 = radius 0.1
N3 = radius 1
N4 = radius 10
```

Nếu search bị kẹt ở vùng nhỏ:

```text
radius 0.01
```

thì tăng:

```text
radius 0.1
→ 1
→ 10
```

Đây chính là multi-scale search.

---

# 52. VNS và “valley”

Hãy tưởng tượng:

```text
Cost
 ^
 |       \       /
 |        \_____/      Valley A
 |             \
 |              \______
 |                     \___ Valley B
 +---------------------------->
```

Local Search tìm đáy Valley A.

VNS:

```text
Valley A
   ↓
Shake N1
   ↓
vẫn Valley A
```

thử:

```text
Shake N2
   ↓
Valley B
```

rồi Local Search:

```text
Valley B
   ↓
đáy B
```

Nếu B tốt hơn A:

$$
B\leftarrow current
$$

---

# 53. Vì sao VNS có thể escape mà không cần accept bad solution?

Giả sử:

$$
s_A
$$

là local optimum.

Shake tạo:

$$
s'
$$

có thể rất xấu:

$$
f(s')>f(s_A)
$$

Nhưng Local Search từ \(s'\):

$$
s'\rightarrow s_B
$$

và:

$$
f(s_B)<f(s_A)
$$

Ta không bao giờ cần accept \(s'\).

Trajectory thực tế:

$$
A^*
\xrightarrow{\text{shake}}
s'
\xrightarrow{LS}
B^*
$$

và chỉ accept:

$$
B^*
$$

Đây là một điểm rất đẹp:

$$
\boxed{
\text{temporary bad solution không cần trở thành incumbent.}
}
$$

---

# 54. Đây cũng là khác biệt với SA

SA:

$$
A^*
\rightarrow
\text{bad solution}
\rightarrow
...
$$

có thể giữ bad solution làm current.

VNS:

$$
A^*
\rightarrow
\text{temporary bad}
\rightarrow
B^*
$$

và chỉ giữ:

$$
B^*
$$

nếu tốt hơn.

Do đó VNS duy trì một incumbent tương đối tốt trong khi exploration diễn ra bên ngoài trajectory chính.

---

# 55. Skewed VNS

Một extension thú vị là:

> **Skewed VNS — SVNS**

Basic VNS chủ yếu thích solution tốt hơn.

SVNS có thể chấp nhận một solution không tốt hơn nếu nó **đủ khác biệt**.

Một dạng score:

$$
F(s)
=
f(s)-\alpha d(s,s_{current})
$$

đối với minimization.

Trong đó:

* \(f(s)\): objective
* \(d(s,s_{current})\): distance
* \(\alpha\): mức thưởng cho diversification.

Như vậy:

> solution hơi xấu nhưng rất khác current vẫn có thể đáng xét.

SVNS được giới thiệu như một extension nhằm khám phá những “valleys” xa incumbent. ([ScienceDirect][1])

---

# 56. VNS và distance

Điều này mở ra một ý tưởng sâu hơn.

Ta không chỉ quan tâm:

$$
f(s)
$$

mà có thể quan tâm:

$$
(f(s),d(s,s_{current}))
$$

Ví dụ:

| Solution | Cost | Distance |
| -------- | ---: | -------: |
| A        |  100 |        1 |
| B        |  102 |       20 |
| C        |  105 |       50 |

Basic VNS:

$$
A
$$

SVNS có thể thích:

$$
B
$$

nếu B đủ khác để mở ra một basin mới.

---

# 57. VNS và ILS bắt đầu hội tụ về một framework chung

Sau chương 10 và 11, cậu có thể nhìn:

### ILS

$$
\text{LS}
+
\text{Perturbation}
+
\text{Acceptance}
$$

### VNS

$$
\text{LS}
+
\text{Neighborhood Change}
+
\text{Shake}
$$

### GVNS

$$
\text{VND}
+
\text{VNS}
$$

### SVNS

$$
\text{VNS}
+
\text{Distance-aware acceptance}
$$

Đây là lúc các metaheuristic bắt đầu trở thành **building blocks**.

---

# 58. ILS → VNS: tiến hóa tư duy

Có thể nhìn quá trình:

```text
Local Search
     │
     │ "Tôi bị kẹt"
     ↓
ILS
     │
     │ "Tôi perturb để thoát"
     ↓
VNS
     │
     │ "Tại sao perturb phải random?
     │  Hãy có nhiều neighborhood
     │  với mức độ khác nhau."
     ↓
GVNS
     │
     │ "Dùng VND làm local search."
     ↓
Hybrid VNS
```

Đây là một progression rất tự nhiên.

---

# 59. Complexity của VND

Giả sử:

$$
L_i
$$

là cost của Local Search với neighborhood \(N_i\).

Một lượt VND có cost xấp xỉ:

$$
T_{VND}
\approx
\sum_{i=1}^{k}L_i
$$

nhưng vì sau improvement lại reset:

$$
k=1
$$

nên một số neighborhood có thể được chạy nhiều lần.

Do đó:

$$
T_{VND}
$$

phụ thuộc mạnh vào:

* số neighborhoods;
* thứ tự;
* số lần improvement;
* tốc độ neighborhood search.

---

# 60. Complexity của VNS

Gọi:

* \(K\): số neighborhoods
* \(S_k\): cost Shake
* \(L\): cost Local Search/VND
* \(I\): số VNS iterations

thì:

$$
T_{VNS}
\approx
I(S_k+L)
$$

Nếu GVNS:

$$
T_{GVNS}
\approx
I(S_k+T_{VND})
$$

Do đó VNS + VND có thể rất mạnh nhưng cũng rất dễ **ăn hết budget** nếu implementation không tối ưu.

---

# 61. Với bài 100 ms, điều này cực kỳ quan trọng

Không nên:

```text
N1 = O(n²)
N2 = O(n²)
N3 = O(n³)
N4 = O(n⁴)
```

rồi mỗi VNS iteration chạy toàn bộ.

Thay vào đó:

### Neighborhood nhỏ

dùng thường xuyên:

```text
swap
insert
relocate
```

### Neighborhood lớn

dùng thưa:

```text
destroy-repair
large k-opt
large exchange
```

---

# 62. Một thiết kế tốt cho bài Air Conditioner

Tớ sẽ chia:

### Inner VND

```text
N1 = intra-day swap
N2 = intra-day insert
N3 = inter-day relocate
N4 = inter-day swap
N5 = 2-opt
```

### Outer VNS

```text
K1 = random 2-house perturb
K2 = random 4-house perturb
K3 = remove 8 houses
K4 = destroy one day + repair
```

Cấu trúc:

```text
                 VNS
                  │
        ┌─────────┼──────────┐
        ↓         ↓          ↓
      Shake2    Shake4    Shake8
        │         │          │
        └─────────┼──────────┘
                  ↓
                 VND
                  │
        ┌─────────┼─────────┐
        ↓         ↓         ↓
      Swap      Insert    Relocate
                  ↓
                2-opt
```

Đây là một **GVNS-like architecture** khá mạnh.

---

# 63. Một điểm còn sâu hơn: Neighborhood design quyết định thuật toán

Trong nhiều metaheuristic:

> hyperparameter rất quan trọng.

Nhưng với VNS:

$$
\boxed{
\text{Neighborhood design gần như là thuật toán.}
}
$$

Nếu:

$$
N_1,N_2,N_3
$$

được thiết kế tốt:

→ VNS mạnh.

Nếu tất cả neighborhood đều tương đương:

→ VNS chẳng có nhiều ý nghĩa.

Nếu neighborhood quá đắt:

→ VNS chậm.

Nếu neighborhood quá giống nhau:

→ diversification thấp.

---

# 64. Neighborhood cần “orthogonality”

Một nguyên tắc thực tế rất hay:

> Các neighborhood nên tạo ra **những kiểu thay đổi khác nhau**, không chỉ khác tên.

Ví dụ:

```text
Swap
Insert
2-opt
```

khá orthogonal.

Nhưng:

```text
1-swap
random swap
best swap
```

thực chất chỉ là các chiến lược tìm kiếm khác nhau trên cùng một neighborhood.

Không mang lại nhiều structural diversification.

---

# 65. Khi nào nên dùng VND?

VND đặc biệt phù hợp khi:

* bài toán có nhiều move tự nhiên;
* mỗi move sửa một khía cạnh khác nhau;
* một neighborhood đơn lẻ dễ bị kẹt;
* local search phải rất mạnh;
* acceptance bad solution không mong muốn.

Ví dụ:

* TSP;
* VRP;
* scheduling;
* facility location;
* clustering;
* graph partitioning;
* packing.

---

# 66. Khi nào VNS đặc biệt phù hợp?

VNS mạnh khi:

$$
\boxed{
\text{Có nhiều scale của perturbation}
}
$$

Ví dụ:

```text
small change
medium change
large structural change
```

Nếu bài toán có cấu trúc như vậy, VNS rất tự nhiên.

---

# 67. Khi nào VNS không phải lựa chọn tốt?

Nếu bài toán chỉ có một neighborhood thực sự hữu ích:

```text
N1 = duy nhất move tốt
N2,N3,N4 = vô nghĩa
```

thì VNS không tạo thêm giá trị.

Hoặc nếu:

$$
N_k
$$

quá đắt để generate/evaluate.

Khi đó:

> một Local Search tối ưu + ILS có thể tốt hơn.

---

# 68. So sánh toàn bộ các thuật toán đã học

| Algorithm     | Escape mechanism                | Main idea               |
| ------------- | ------------------------------- | ----------------------- |
| Hill Climbing | không có                        | descent                 |
| SA            | accept bad                      | temperature             |
| Tabu          | memory                          | forbid/restrict         |
| GA            | population                      | recombination           |
| GRASP         | random construction             | multi-start             |
| ILS           | perturbation                    | jump between basins     |
| VND           | **change neighborhood**         | stronger local optimum  |
| VNS           | **shake + change neighborhood** | multi-scale exploration |
| GVNS          | VNS + VND                       | strong hybrid           |

---

# 69. Một sơ đồ thống nhất

```text
                    METAHEURISTICS
                          │
              ┌───────────┴───────────┐
              │                       │
         Solution-based          Population-based
              │                       │
              │                      GA
              │
       ┌──────┼─────────┐
       │      │         │
      SA    Tabu       LS-family
                         │
             ┌───────────┼────────────┐
             │           │            │
            ILS         VND          VNS
             │                        │
             │                     GVNS
             │
             └────────────┐
                          Hybrid
```

---

# 70. Một mental model cực kỳ quan trọng

Đừng nhớ:

> “VNS là một thuật toán có \(N_1,N_2,N_3\).”

Hãy nhớ:

$$
\boxed{
\text{A local optimum is only local relative to a neighborhood.}
}
$$

Từ đó suy ra:

$$
\boxed{
\text{Change the neighborhood}
\Rightarrow
\text{change what “local optimum” means}
}
$$

Và:

$$
\boxed{
\text{Change neighborhood systematically}
\Rightarrow
VNS
}
$$

Đây mới là bản chất toán học của chương.

---

# 71. Tóm tắt VND bằng một công thức

Cho:

$$
N_1,N_2,\ldots,N_k
$$

VND thực hiện:

$$
s
\xrightarrow{LS_{N_1}}
s_1
\xrightarrow{LS_{N_2}}
s_2
\rightarrow\cdots
$$

nhưng mỗi khi:

$$
f(s_{new})<f(s)
$$

thì:

$$
\boxed{k\leftarrow1}
$$

Cuối cùng:

$$
\boxed{
s^*\in\bigcap_{i=1}^{k}LO(N_i)
}
$$

---

# 72. Tóm tắt VNS bằng một công thức

VNS:

$$
s
\overset{Shake(N_k)}{\longrightarrow}
s'
\overset{LS}{\longrightarrow}
s''
$$

Nếu:

$$
f(s'')<f(s)
$$

thì:

$$
s\leftarrow s'',\qquad k\leftarrow1
$$

nếu không:

$$
k\leftarrow k+1
$$

Đến:

$$
k>K
$$

thì quay vòng hoặc kết thúc tùy framework.

---

# 73. Tóm tắt GVNS

$$
\boxed{
GVNS
=
VNS
+
VND
}
$$

hay:

```text
current
   ↓
Shake Nk
   ↓
VND
   ↓
local optimum
   ↓
accept?
   ↓
next neighborhood
```

Đây là phiên bản mà tớ đánh giá **đáng học nhất về mặt thực chiến** trong chương này.

---

# 74. Những thứ cậu cần nắm thật chắc

Sau chương 11, cậu nên phân biệt được:

### 1.

$$
N(s)
$$

là gì.

### 2.

Local optimum phụ thuộc vào \(N\).

### 3.

$$
N_1\neq N_2
$$

có thể có local optima khác nhau.

### 4.

VND:

$$
\boxed{\text{đổi neighborhood trong descent}}
$$

### 5.

VNS:

$$
\boxed{\text{đổi neighborhood trong descent + escape}}
$$

### 6.

GVNS:

$$
\boxed{VNS+VND}
$$

### 7.

RVNS:

$$
\boxed{VNS-\text{Local Search}}
$$

### 8.

SVNS:

$$
\boxed{\text{VNS + distance/diversification}}
$$

---

# 75. Và quan trọng nhất: VND/VNS nối trực tiếp với ILS

Sau hai chương 10 và 11, cậu có thể nhìn thấy một hierarchy rất đẹp:

$$
\boxed{
Local\ Search
}
$$

↓

$$
\boxed{
VND
=
Local\ Search
+
Multiple\ Neighborhoods
}
$$

↓

$$
\boxed{
ILS
=
Local\ Search
+
Perturbation
}
$$

↓

$$
\boxed{
VNS
=
Local\ Search
+
Systematic\ Neighborhood\ Change
}
$$

↓

$$
\boxed{
GVNS
=
VNS+VND
}
$$

Và từ đây bắt đầu xuất hiện những hybrid rất mạnh:

$$
\boxed{
GRASP+VND
}
$$

$$
\boxed{
ILS+VND
}
$$

$$
\boxed{
VNS+SA
}
$$

$$
\boxed{
VNS+Tabu
}
$$

$$
\boxed{
VNS+Exact\ Search
}
$$

Thậm chí VNS đã được kết hợp với **local branching, MILP/exact solvers, nonlinear programming và decomposition**, cho thấy nó không chỉ là một heuristic độc lập mà là một framework để ghép các phương pháp tối ưu khác nhau. ([IDEAS/RePEc][5])

---

## Tài liệu nền tảng nên đọc

1. **Hansen & Mladenović (2001), *Variable neighborhood search: Principles and applications*, European Journal of Operational Research 130(3), 449–467.** Đây là bài kinh điển đặt nền tảng cho VNS. ([ScienceDirect][1])
2. **Hansen, Mladenović, Brimberg & Moreno Pérez (2019), *Variable Neighborhood Search*, Handbook of Metaheuristics, pp. 57–97.** Đây là tài liệu rất phù hợp để học sâu framework và các biến thể hiện đại. ([IDEAS/RePEc][4])
3. **Hansen, Mladenović, Todosijević & Hanafi (2017), *Variable neighborhood search: basics and variants*.** Đây là survey rất hữu ích để hiểu quan hệ giữa Basic VNS, VND, RVNS, GVNS và các biến thể khác. ([ScienceDirect][2])

### Một câu chốt chương 11

> **Local Search bị kẹt không nhất thiết vì solution đã tốt nhất; có thể chỉ vì ta đang nhìn solution bằng một neighborhood quá hẹp. VND thay đổi neighborhood để tìm một local optimum mạnh hơn, còn VNS dùng chính các neighborhood đó để tạo những cú “shake” có quy mô khác nhau và khám phá các basin mới.**

Và nếu **ILS là “phá nghiệm rồi tối ưu lại”**, thì **VNS là “thay kính quan sát để nhìn thấy những bước đi mà neighborhood hiện tại không cho phép”**. Đây là khác biệt tư duy quan trọng nhất giữa Chương 10 và Chương 11.

[1]: https://www.sciencedirect.com/science/article/pii/S0377221700001004?utm_source=chatgpt.com "Variable neighborhood search: Principles and applications - ScienceDirect"
[2]: https://www.sciencedirect.com/science/article/pii/S2192440621000873?utm_source=chatgpt.com "Variable neighborhood search: basics and variants - ScienceDirect"
[3]: https://ideas.repec.org/h/spr/sprchp/978-3-319-07124-4_19.html?utm_source=chatgpt.com "Variable Neighborhood Search"
[4]: https://ideas.repec.org/h/spr/isochp/978-3-319-91086-4_3.html?utm_source=chatgpt.com "Variable Neighborhood Search"
[5]: https://ideas.repec.org/h/spr/isochp/978-1-4419-1665-5_3.html?utm_source=chatgpt.com "Variable Neighborhood Search"
