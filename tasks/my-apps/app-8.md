Ứng dụng 13: Logic Puzzle Suite

1. Bài toán

Tôi muốn có một ứng dụng trên điện thoại và máy tính để luyện tư duy logic và giải các bài toán suy luận.

Hiện nay các loại puzzle thường bị phân tán:

- Sudoku.
- Nonogram.
- Minesweeper.
- Lights Out.
- Logic grid puzzle.
- Kakuro.
- N-Queens.
- Graph puzzle.
- Sequence puzzle.
- Deduction puzzle.
- Strategy puzzle.
- Optimization puzzle.
- Other...

Tôi muốn gom chúng vào một ứng dụng duy nhất, đồng thời không chỉ cung cấp game mà còn hỗ trợ phân tích, gợi ý và theo dõi quá trình giải.


---

2. Mục tiêu sản phẩm

Ứng dụng phải đáp ứng 4 nhu cầu:

1. Chơi puzzle.
2. Luyện tư duy theo độ khó.
3. Tạo puzzle/custom problem.
4. Phân tích lời giải để hiểu tại sao đáp án đúng.

Điểm quan trọng là ứng dụng phải phục vụ cả hai nhóm:

Người mới
   ↓
Giải puzzle
   ↓
Nhận hint
   ↓
Hiểu chiến thuật
   ↓
Người dùng nâng cao
   ↓
Tự tạo / phân tích puzzle


---

3. Phân loại Puzzle

Ứng dụng không nên hard-code chỉ một loại puzzle.

Concept nghiệp vụ chính:

Puzzle Type
    │
    ├── Grid Puzzle
    ├── Constraint Puzzle
    ├── Graph Puzzle
    ├── Mathematical Puzzle
    ├── Deduction Puzzle
    └── Search / State Puzzle


---

4. Các puzzle V1

Tôi muốn MVP có khoảng 5 loại.

1. Sudoku

9 × 9

Luật:

- Mỗi hàng chứa 1–9.
- Mỗi cột chứa 1–9.
- Mỗi block 3×3 chứa 1–9.


---

2. N-Queens

Đặt N quân hậu trên bàn cờ sao cho không quân hậu nào ăn nhau.

Ví dụ:

. Q . .
. . . Q
Q . . .
. . Q .


---

3. Lights Out

Mỗi ô có trạng thái:

ON / OFF

Nhấn một ô sẽ đảo trạng thái:

↑
← [X] →
    ↓

Mục tiêu:

Tất cả OFF


---

4. Logic Grid

Ví dụ:

> Có 3 người: A, B, C.
Mỗi người có một màu và một nghề khác nhau.



Người chơi phải suy luận:

Red Blue Green
Alice    ?    ?    ?
Bob      ?    ?    ?
Carol    ?    ?    ?

Có các clue:

Alice không mặc màu đỏ.

Người mặc xanh là Bob.

Carol không phải bác sĩ.


---

5. Nonogram

Người chơi dựa vào số clue ở hàng/cột để tô các ô.

Ví dụ:

1 3 1
    ┌─┬─┬─┬─┬─┐
  2 │ │ │ │ │ │
  1 │ │ │ │ │ │
  3 │ │ │ │ │ │
    └─┴─┴─┴─┴─┘


---

5. Puzzle Generator

Một tính năng quan trọng là tự sinh puzzle.

Người dùng chọn:

Puzzle:
Sudoku

Difficulty:
Easy / Medium / Hard / Expert

Ứng dụng sinh puzzle mới.


---

Seed

Puzzle phải có seed:

Seed: 18372941

Nếu nhập lại cùng seed:

Seed
  ↓
Generator
  ↓
Same Puzzle

Điều này giúp reproducibility.


---

6. Difficulty

Không chỉ ghi:

Easy
Medium
Hard

Mà nên có difficulty score.

Ví dụ:

Difficulty: 7.3 / 10

Có thể dựa trên:

- kích thước problem;
- số constraint;
- số bước giải;
- độ sâu search;
- số lượng candidate;
- độ phức tạp của strategy cần sử dụng.


---

7. Puzzle State

Trong khi chơi, hệ thống lưu:

Puzzle
├── Initial State
├── Current State
├── Candidate State
└── Solution

Ví dụ Sudoku:

Initial:
5 . . | . 7 . | . . .

Current:
5 3 . | . 7 . | . . .

Solution:
5 3 4 | 6 7 8 | 9 1 2


---

8. Undo / Redo

Mọi thao tác phải có:

Undo
Redo

Ví dụ:

Fill cell
Mark candidate
Delete candidate
Toggle cell
Move piece


---

9. Candidate / Pencil Mark

Đặc biệt quan trọng với Sudoku.

Một ô có thể chứa:

┌─────────┐
│ 1 3 7   │
│ 2   8   │
│   5 9   │
└─────────┘

Người dùng có thể:

- bật/tắt candidate;
- auto-remove candidate;
- clear candidate.


---

10. Hint System

Người dùng có thể yêu cầu:

Hint

Nhưng không muốn ứng dụng lập tức đưa đáp án.

Có nhiều mức:

Hint Level 1

"Bạn nên tập trung vào hàng 5."

Hint Level 2

"Ô R5C7 chỉ còn 2 candidate."

Hint Level 3

"R5C7 = 2."

Reveal

Hiển thị trực tiếp đáp án.


---

11. Giải thích Hint

Hint phải giải thích tại sao.

Ví dụ:

R5C7 chỉ có thể là 2 vì:

- Hàng 5 đã có 1,3,4,5,6,7,8,9.
- Cột 7 đã có ...
- Block 3×3 đã có ...

→ Chỉ còn 2.

Đây là điểm khác biệt giữa:

> Puzzle game



và

> Puzzle learning tool.




---

12. Solver

Ứng dụng có solver cho những puzzle phù hợp.

Ví dụ Sudoku:

Puzzle
   ↓
Constraint Propagation
   ↓
Backtracking
   ↓
Solution

Solver có thể cung cấp:

- Có nghiệm / vô nghiệm.
- Có duy nhất một nghiệm hay nhiều nghiệm.
- Số bước.
- Solution.
- Một số chiến thuật đã sử dụng.


---

13. Multiple Solutions

Một puzzle không nhất thiết có một nghiệm.

Ứng dụng phải phát hiện:

0 solution
1 solution
2+ solutions

Ví dụ:

Status:
⚠ Puzzle has multiple solutions

Điều này đặc biệt quan trọng khi người dùng tự tạo puzzle.


---

14. Solution Replay

Thay vì chỉ hiển thị:

Solved!

Ứng dụng có thể replay lời giải:

Step 1
↓

Step 2
↓

Step 3
↓

...

Step N

Người dùng có thể:

◀ Previous
▶ Next


---

15. Statistics

Mỗi lần giải lưu:

Puzzle #182
Difficulty: Hard

Time: 08:32
Mistakes: 3
Hints: 1
Result: Solved


---

16. Personal Statistics

Dashboard:

Total solved: 342

Sudoku
  Solved: 180
  Avg: 06:42

N-Queens
  Solved: 42
  Avg: 02:15

Lights Out
  Solved: 31
  Avg: 01:32


---

17. Streak

Theo dõi:

Current streak: 12 days
Best streak: 37 days

Có thể đặt mục tiêu:

Solve 1 puzzle/day


---

18. Difficulty Progression

Ứng dụng có thể tự điều chỉnh độ khó.

Ví dụ:

Easy
 ↓
Medium
 ↓
Hard
 ↓
Expert

Nếu người dùng liên tục giải Hard nhanh:

Recommended:
Expert


---

19. Daily Puzzle

Mỗi ngày có một puzzle đặc biệt.

Ví dụ:

Daily Puzzle
06 Oct 2026

Sudoku
Difficulty: 7/10



---

20. Puzzle Collection

Người dùng có thể bookmark:

★ Favorite

hoặc tạo collection:

My Hard Problems
Sudoku Training
Interesting Problems
Interview Problems


---

21. Custom Puzzle

Người dùng có thể tự nhập puzzle.

Ví dụ Sudoku:

530070000
600195000
098000060
...

Ứng dụng kiểm tra:

Valid puzzle
Unique solution


---

22. Puzzle Editor

Có UI trực quan:

┌───┬───┬───┐
│ 5 │ 3 │   │
├───┼───┼───┤
│ 6 │   │   │
├───┼───┼───┤
│   │ 9 │ 8 │
└───┴───┴───┘

Người dùng click để nhập.


---

23. Logic Puzzle Builder

Với Logic Grid, người dùng có thể tạo:

People:
Alice
Bob
Carol

Color:
Red
Blue
Green

Job:
Doctor
Engineer
Teacher

Sau đó nhập clue:

Alice != Red

Bob = Blue

Carol != Doctor

Ứng dụng tự xây dựng constraint problem.


---

24. Constraint View

Đây là một tính năng khá thú vị cho người dùng thích thuật toán.

Có thể xem:

Variables
Constraints
Domains

Ví dụ:

Variables:
A, B, C

Domain:
{Red, Blue, Green}

Constraints:
A != Red
B = Blue
C != A

Điều này giúp biến ứng dụng thành một công cụ học Constraint Satisfaction Problem (CSP).


---

25. Puzzle theo thuật toán

Có thể thêm category:

Category	Ví dụ

Constraint	Sudoku, N-Queens
Search	Maze
Graph	Coloring
Linear Algebra	Lights Out
Deduction	Logic Grid
Number Theory	Number Puzzle
DP	Optimization Puzzle


Điều này phù hợp với mục tiêu học thuật/thuật toán của ứng dụng.


---

26. Algorithm Explanation

Với một số puzzle, app có thể hiển thị thuật toán dùng để giải.

Ví dụ Lights Out:

Lights Out
    ↓
Model as linear system
    ↓
Ax = b
    ↓
Gaussian Elimination over GF(2)
    ↓
Solution

Hoặc N-Queens:

Backtracking
   ↓
Place Queen
   ↓
Check constraints
   ↓
Backtrack


---

27. Visualization

Đối với solver, có thể bật:

Show Solver

Sau đó xem search tree:

Start
          /     \
        A         B
       / \       / \
      C   D     E   F

Đây sẽ là tính năng nâng cao, không nhất thiết có trong MVP.


---

28. Puzzle Generator API nội bộ

Về mặt nghiệp vụ, mỗi puzzle type nên có interface thống nhất:

Puzzle Type
├── generate()
├── validate()
├── solve()
├── getHint()
├── getDifficulty()
└── getSolution()

Nhờ vậy sau này thêm puzzle mới không phá cấu trúc ứng dụng.


---

29. Import / Export

Export:

JSON
CSV
TXT

Ví dụ một puzzle có thể lưu:

{
  "type": "sudoku",
  "seed": 12345,
  "difficulty": 7,
  "initialState": "...",
  "solution": "...",
  "metadata": {}
}

Có thể chia sẻ file puzzle trực tiếp qua điện thoại.


---

30. Cho phép hoạt động Offline


---

31. Privacy

Dữ liệu luyện tập cá nhân không rời khỏi thiết bị.

Có thể hỗ trợ:

- App lock.
- PIN.
- Biometric unlock.

Nhưng đây là tính năng V2.


---

32. MVP V1

Tớ sẽ chọn 5 puzzle:

1. Sudoku.
2. N-Queens.
3. Lights Out.
4. Nonogram.
5. Logic Grid.

Core engine

- Puzzle model.
- Generator.
- Validator.
- Solver.
- Difficulty.
- Hint.

Gameplay

- Touch UI.
- Undo/redo.
- Timer.
- Pause/resume.
- Hint.
- Solution.
- Restart.

Personal

- History.
- Statistics.
- Favorite.
- Daily puzzle.
- Difficulty progression.

Data

- Local storage.
- JSON export/import.
- Backup/restore.


---

33. V2

Có thể mở rộng:

- Minesweeper.
- Kakuro.
- KenKen.
- Maze.
- Graph coloring.
- Graph traversal puzzle.
- Matchstick puzzle.
- Cryptarithm.
- Tower of Hanoi.
- Sliding puzzle.
- River crossing.
- Coin/weight puzzles.
- Boolean logic puzzles.
- Nim games
- Board games
- Các games dựa trên bàn cờ
- Các games dựa trên đồ thị
- Các nghịch lý toán học
- Game đoán chuỗi nhị phân mô phỏng bài toán coin weighing
- Thả trứng đếm tầng
- Lạc đà chở chuối đi xa nhất
- Phối hợp chia sẻ xăng cho xe đi xa nhất
- Nhóm n người đi bộ có thêm xe máy tới đích nhanh nhất
- Tự đề xuất puzzles khác.

Đặc biệt có thể xây dựng một generic CSP engine để nhiều puzzle dùng chung.


---

34. Một phiên sử dụng điển hình

Tôi mở app vào buổi tối:

Daily Puzzle
     ↓
Sudoku – Hard
     ↓
Start

Sau 5 phút bị kẹt:

Hint

App không cho đáp án ngay:

> “Hãy tìm một ô trong block trung tâm chỉ còn một candidate.”



Tôi vẫn không giải được:

Hint Level 2

App chỉ ra:

R5C7
Candidates: {2}

Tôi điền 2.

Sau khi hoàn thành:

Solved!

Time: 07:42
Mistakes: 1
Hints: 2

Difficulty: 7.4/10

Sau vài tuần:

Sudoku
──────────────
Solved: 83
Average: 06:31
Best: 03:48
Current level: Hard


---

35. Giá trị cốt lõi

Ứng dụng này không nên chỉ là:

> “Một app chứa nhiều trò puzzle.”



Mà nên hướng tới:

> “Một phòng tập tư duy logic + phòng thí nghiệm thuật toán nhỏ trên điện thoại.”



Kiến trúc chức năng có thể hình dung:

Logic Puzzle Suite
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
       PLAY              LEARN            CREATE
          │                │                │
       Puzzle           Hint/Solver       Builder
       Timer            Explanation       Generator
       Score            Replay            Validator
          │                │                │
          └────────────────┼────────────────┘
                           ↓
                    Statistics / History

Và đây cũng là ứng dụng trong danh sách có tiềm năng kết nối mạnh nhất với #11 Heuristic Playground và #6 Algorithm Notebook: một bên là puzzle, một bên là thuật toán giải, một bên là kiến thức/giải thích thuật toán.