/* tree.js — cây quyết định "Thuật toán nên dùng?" (xem core/decide.js). Mỗi lá trỏ tới id trong thư viện; kiem.js kiểm trỏ đúng, không vòng, không nút mồ côi. */
(function (root) {
  "use strict";
  var A = root.Algo;
  function go(t, next) { return { t: t, next: next }; }
  function out(t, result, note) { return { t: t, result: result, note: note || "" }; }

  A.tree.set({
    root: "root",
    nodes: {
      root: { q: "Bài toán của bạn xoay quanh loại dữ liệu nào?", opts: [
        go("Đồ thị / mạng (đỉnh và cạnh)", "g"), go("Dãy số / mảng (có thể có truy vấn)", "arr"), go("Xâu ký tự", "str"), go("Số học, tổ hợp, modulo", "math"),
        go("Đếm hoặc tối ưu từng bước (trạng thái con lặp lại)", "dp"), go("Hình học (điểm, đoạn, đa giác)", "geo"),
        go("Tối ưu tổ hợp khó, chấp nhận nghiệm tốt", "opt"), go("Hệ thống: cache, phân mảnh, kiểm tra tồn tại, đồng thuận", "sys")
      ] },

      // ---------------------------------------------------------------- đồ thị
      g: { q: "Bạn cần gì từ đồ thị?", opts: [
        go("Đường đi ngắn nhất", "sp"), go("Cây khung nhỏ nhất (nối mọi đỉnh với chi phí thấp nhất)", "mst"),
        out("Thứ tự thực hiện các việc phụ thuộc nhau", ["topological-sort"], "Chỉ có nghiệm khi đồ thị không có chu trình; nếu có chu trình thuật toán phát hiện được."),
        go("Liên thông: thành phần, chu trình, cầu, khớp", "conn"), go("Luồng, cắt nhỏ nhất, ghép cặp, phân công", "flow"),
        go("Truy vấn trên cây (tổ tiên chung, đường đi, đường kính…)", "tree"), go("Duyệt đồ thị, kiểm tra đi tới được, đếm thành phần", "trav"),
        out("Đi qua mọi cạnh đúng một lần", ["euler-path"], "Có điều kiện về bậc của đỉnh; thuật toán Hierholzer dựng đường đi."),
        out("Ràng buộc logic \"A hoặc B\" giữa các biến đúng/sai", ["two-sat"], "Mô hình bằng đồ thị kéo theo rồi tìm thành phần liên thông mạnh.")
      ] },
      sp: { q: "Đồ thị có cạnh trọng số ÂM?", opts: [go("Có", "sp-neg"), go("Không", "sp-pos")] },
      "sp-neg": { q: "Cần khoảng cách giữa MỌI cặp đỉnh và số đỉnh nhỏ (khoảng ≤ 400)?", opts: [
        out("Có", ["floyd-warshall"], "O(V³): chỉ hợp khi V nhỏ; xử lý được cạnh âm và phát hiện chu trình âm."),
        out("Không (một nguồn)", ["bellman-ford", "spfa"], "Bellman-Ford chắc chắn O(VE) và báo chu trình âm; SPFA thường nhanh hơn nhưng xấu nhất vẫn O(VE).")
      ] },
      "sp-pos": { q: "Mọi cạnh có CÙNG trọng số (hoặc chỉ gồm trọng số 0 và 1)?", opts: [go("Có", "sp-unit"), go("Không, trọng số tuỳ ý ≥ 0", "sp-w")] },
      "sp-unit": { q: "Có cả cạnh trọng số 0 lẫn 1?", opts: [out("Có", ["bfs-01"], "Hàng đợi hai đầu: cạnh 0 đẩy đầu, cạnh 1 đẩy cuối. O(V+E)."), out("Không, mọi cạnh trọng số 1", ["bfs"], "BFS cho số bước ít nhất. O(V+E).")] },
      "sp-w": { q: "Cần khoảng cách giữa MỌI cặp đỉnh và số đỉnh nhỏ (khoảng ≤ 400)?", opts: [
        out("Có", ["floyd-warshall"], "Ba vòng for, rất ngắn để cài."), out("Không (một nguồn)", ["dijkstra"], "O((V+E) log V) với priority_queue.")
      ] },
      mst: { q: "Đồ thị rất dày (số cạnh gần V²)?", opts: [out("Có", ["prim"], "Prim bản mảng O(V²) hợp đồ thị dày."), out("Không (thưa)", ["kruskal"], "Sắp xếp cạnh + DSU, O(E log E).")] },
      conn: { q: "Bạn muốn tìm gì?", opts: [
        out("Nhóm đỉnh đi lại được hai chiều trong đồ thị CÓ HƯỚNG", ["scc"]), out("Cạnh hoặc đỉnh mà bỏ đi làm mất liên thông (vô hướng)", ["bridges-articulation"]),
        out("Đếm / gộp các thành phần liên thông, kiểm tra hai đỉnh cùng nhóm", ["dsu", "dfs"], "DSU hợp khi cạnh được thêm dần; DFS khi đồ thị cho sẵn.")
      ] },
      flow: { q: "Bài toán thuộc dạng nào?", opts: [
        go("Luồng cực đại / cắt nhỏ nhất", "flow-max"), go("Ghép cặp hai phía (không chi phí)", "flow-match"),
        out("Phân công n việc cho n người với ma trận chi phí", ["hungarian", "min-cost-flow"], "Hungarian O(n³) chuyên cho phân công; luồng chi phí nhỏ nhất tổng quát hơn."),
        out("Luồng có chi phí trên cạnh (cần tổng chi phí nhỏ nhất)", ["min-cost-flow"])
      ] },
      "flow-max": { q: "Mạng lớn hoặc cần chạy thật nhanh?", opts: [out("Có", ["dinic"], "Dinic: BFS chia tầng + DFS chặn luồng, rất nhanh trong thực tế."), out("Không, mạng nhỏ, muốn cài ngắn", ["edmonds-karp"], "O(VE²), dễ cài đúng.")] },
      "flow-match": { q: "Đồ thị rất lớn (cỡ 10⁵ đỉnh)?", opts: [out("Có", ["hopcroft-karp"], "O(E√V)."), out("Không", ["bipartite-matching"], "Kuhn: ngắn gọn, O(VE).")] },
      tree: { q: "Bạn cần gì trên cây?", opts: [
        out("Tổ tiên chung thấp nhất (LCA) hoặc khoảng cách hai đỉnh", ["lca"]), out("Truy vấn / cập nhật trên đường đi giữa hai đỉnh", ["hld"], "Chia cây thành các đường nặng rồi dùng cây truy vấn trên mỗi đường."),
        out("Đường kính cây / hai đỉnh xa nhất", ["tree-diameter"]), out("Đếm cặp đỉnh theo khoảng cách, chia để trị trên cây", ["centroid-decomposition"]),
        out("Tối ưu / đếm theo cây con (chọn đỉnh, tô màu…)", ["tree-dp"])
      ] },
      trav: { q: "Bạn cần số bước ÍT NHẤT (đồ thị không trọng số)?", opts: [out("Có", ["bfs"]), out("Không, chỉ cần duyệt / kiểm tra tới được", ["dfs", "bfs"], "Hai cách đều O(V+E); DFS ngắn khi viết đệ quy, nhưng coi chừng tràn ngăn xếp khi V rất lớn.")] },

      // ---------------------------------------------------------------- dãy số
      arr: { q: "Bạn làm gì với dãy số?", opts: [
        go("Truy vấn tổng / min / max trên đoạn", "arr-q"), go("Tìm kiếm giá trị hoặc đáp án nhỏ nhất thoả điều kiện", "arr-s"), go("Tìm đoạn con hoặc cặp thoả điều kiện", "arr-sub"),
        go("Sắp xếp, đếm nghịch thế, nén toạ độ, chọn khoảng", "arr-sort"), go("Phần tử lớn/nhỏ hơn gần nhất, cực trị cửa sổ trượt", "arr-mono"),
        go("Liên tục lấy / thêm phần tử, gộp nhóm, ngăn xếp, hàng đợi", "arr-ds"), out("Truy vấn đoạn OFFLINE khó (đếm giá trị khác nhau…)", ["mo-algorithm"], "Sắp xếp truy vấn theo khối rồi di chuyển hai đầu đoạn; cần thêm/bớt một phần tử rẻ."),
        out("Dãy con tối ưu (tăng dài nhất, chung dài nhất…)", ["lis", "lcs"], "Bài dạng này thường là quy hoạch động — xem nhánh \"Quy hoạch động\".")
      ] },
      "arr-q": { q: "Dãy có bị SỬA giữa các truy vấn?", opts: [go("Không (dãy tĩnh)", "arr-static"), go("Có", "arr-dyn")] },
      "arr-static": { q: "Phép truy vấn là gì?", opts: [
        out("Tổng, xor, đếm (có phép trừ ngược)", ["array-prefix-sum"], "Tiền xử lý O(N), mỗi truy vấn O(1)."),
        out("Min, max, gcd — số truy vấn rất nhiều", ["sparse-table"], "Tiền xử lý O(N log N), truy vấn O(1) (phép idempotent).")
      ] },
      "arr-dyn": { q: "Cập nhật là gì?", opts: [
        out("Đổi một phần tử, hỏi tổng / đếm", ["fenwick-tree", "segment-tree"], "Fenwick ngắn và nhanh hơn; Segment Tree tổng quát hơn."),
        out("Đổi một phần tử, hỏi min / max / gcd…", ["segment-tree"]),
        out("Cộng hoặc gán trên cả đoạn, rồi hỏi đoạn", ["lazy-segment-tree"]),
        out("Cộng cả đoạn nhiều lần, chỉ đọc kết quả ở cuối (offline)", ["difference-array"]),
        out("Phép toán lạ, khó đưa vào cây", ["sqrt-decomposition"], "Chia khối cỡ √N: cài đặt dễ, O(√N) mỗi thao tác."),
        out("Chèn / xoá ở giữa, hỏi phần tử thứ k", ["treap", "ordered-set"], "Ordered Set của GCC (pb_ds) có sẵn; Treap tự cài khi cần thao tác tách/ghép.")
      ] },
      "arr-s": { q: "Bạn tìm gì?", opts: [
        out("Vị trí hoặc giá trị trong mảng đã sắp xếp", ["binary-search"], "lower_bound / upper_bound của thư viện chuẩn."),
        out("Giá trị NHỎ NHẤT thoả điều kiện đơn điệu (\"có thể làm được với x không?\")", ["binary-search"], "Nhị phân trên đáp án."),
        out("Cực trị của hàm lồi / lõm", ["ternary-search"])
      ] },
      "arr-sub": { q: "Điều kiện cần là gì?", opts: [
        out("Cặp phần tử có tổng / hiệu cho trước (mảng đã sắp xếp)", ["two-pointers"]), out("Đoạn con liên tục thoả điều kiện đơn điệu (độ dài, số khác nhau…)", ["sliding-window", "two-pointers"]),
        out("Đoạn con có tổng lớn nhất", ["kadane"]), out("Đếm đoạn con có tổng đúng K", ["array-prefix-sum"], "Tổng tiền tố + bảng đếm."),
        out("Tập con có tổng S, n ≤ 40", ["meet-in-the-middle"]), out("Sinh mọi cấu hình, có cắt tỉa", ["backtracking"])
      ] },
      "arr-sort": { q: "Bạn cần?", opts: [
        out("Sắp xếp", ["sorting"]), out("Đếm số cặp nghịch thế", ["count-inversions"]), out("Giá trị rất lớn, cần đánh số lại gọn 0..k-1", ["coordinate-compression"]),
        out("Chọn nhiều khoảng nhất sao cho không giao nhau", ["greedy-interval-scheduling"])
      ] },
      "arr-mono": { q: "Bạn cần?", opts: [
        out("Phần tử gần nhất lớn hơn / nhỏ hơn ở bên trái hoặc phải", ["monotonic-stack"]), out("Max / min của mọi cửa sổ độ dài k", ["monotonic-queue", "sliding-window"])
      ] },
      "arr-ds": { q: "Bạn cần?", opts: [
        out("Liên tục lấy phần tử nhỏ / lớn nhất, có thêm xoá", ["heap"]), out("Gộp nhóm, hỏi hai phần tử có cùng nhóm không", ["dsu"]),
        out("Khớp ngoặc, hoàn tác, đánh giá biểu thức", ["stack"]), out("Xử lý theo thứ tự đến trước đi trước, duyệt theo tầng", ["queue"])
      ] },

      // ---------------------------------------------------------------- xâu
      str: { q: "Bạn cần gì với xâu?", opts: [
        go("Tìm mẫu trong văn bản", "str-find"), out("Tiền tố chung, từ điển, xor lớn nhất của cặp số", ["trie", "xor-trie"]),
        out("Đếm xâu con phân biệt, truy vấn trên mọi hậu tố", ["suffix-array", "suffix-automaton"]), out("Palindrome (xâu con đối xứng)", ["manacher"]),
        out("Dịch vòng nhỏ nhất theo từ điển", ["minimal-rotation"]), out("Khoảng cách chỉnh sửa / dãy con chung giữa hai xâu", ["edit-distance", "lcs"], "Đây là quy hoạch động O(NM).")
      ] },
      "str-find": { q: "Có bao nhiêu mẫu?", opts: [
        out("Một mẫu, một văn bản", ["kmp", "z-function"], "Cả hai O(N+M) tất định."), out("Nhiều mẫu cùng lúc", ["aho-corasick"]),
        out("So sánh nhiều xâu con với nhau (chấp nhận xác suất rất nhỏ sai)", ["rolling-hash"], "Dùng modulo 2⁶¹−1 hoặc hai modulo với cơ số ngẫu nhiên.")
      ] },

      // ---------------------------------------------------------------- toán
      math: { q: "Bạn cần gì?", opts: [
        out("GCD, phương trình đồng dư tuyến tính", ["gcd-extgcd", "modular-inverse", "crt"]), out("Luỹ thừa rất lớn mod, hoặc số hạng thứ n của dãy tuyến tính", ["fast-pow", "matrix-exponentiation"]),
        go("Số nguyên tố, phân tích thừa số", "math-prime"), out("Tổ hợp C(n, k) modulo", ["ncr-mod"]), go("Nhân đa thức / tích chập", "math-poly"),
        out("Hệ phương trình tuyến tính", ["gaussian-elimination"]), out("Hàm phi Euler, đếm số nguyên tố cùng nhau", ["euler-phi"]), out("Giải a^x ≡ b (mod m)", ["discrete-log"])
      ] },
      "math-prime": { q: "Cần gì?", opts: [
        out("Liệt kê mọi số nguyên tố tới N cỡ 10⁷", ["sieve"]), out("Kiểm tra / phân tích MỘT số rất lớn (tới 10¹⁸)", ["miller-rabin", "pollard-rho"], "Miller-Rabin kiểm tra nguyên tố; Pollard's Rho tìm ước.")
      ] },
      "math-poly": { q: "Modulo cố định kiểu 998244353 (hoặc hệ số nguyên nhỏ)?", opts: [out("Có", ["ntt"], "Chính xác tuyệt đối trong số nguyên modulo."), out("Không, hệ số thực / modulo tuỳ ý", ["fft"], "Coi chừng sai số số thực khi hệ số lớn.")] },

      // ---------------------------------------------------------------- quy hoạch động
      dp: { q: "Bài toán thuộc dạng nào?", opts: [
        go("Chọn đồ vật vào túi / đổi tiền", "dp-knap"), out("Dãy con tối ưu (tăng dài nhất, chung dài nhất, chỉnh sửa, đoạn lớn nhất)", ["lis", "lcs", "edit-distance", "kadane"]),
        out("Trạng thái là một tập con (n ≤ 20)", ["bitmask-dp", "sos-dp"]), out("Đếm số theo chữ số có tính chất", ["digit-dp"]), out("Trên cây", ["tree-dp"]),
        out("Gộp / chia đoạn liên tiếp", ["interval-dp"]), out("DP đã đúng nhưng chậm — dạng min(a·x + b) hoặc quyết định đơn điệu", ["convex-hull-trick", "divide-conquer-opt"])
      ] },
      "dp-knap": { q: "Mỗi vật được dùng bao nhiêu lần?", opts: [
        out("Tối đa một lần", ["knapsack-01"]), out("Không giới hạn", ["knapsack-unbounded"]), out("Có số lượng riêng cho từng vật", ["knapsack-bounded"]),
        out("Đổi tiền: số cách hoặc số xu ít nhất", ["coin-change"])
      ] },

      // ---------------------------------------------------------------- hình học
      geo: { q: "Bạn cần gì?", opts: [
        out("Bao lồi của tập điểm", ["convex-hull"]), out("Hai đoạn thẳng có cắt nhau không", ["segment-intersection"]), out("Điểm có nằm trong đa giác không", ["point-in-polygon"]),
        out("Cặp điểm gần nhau nhất", ["closest-pair"]), out("Nhiều đoạn / hình chữ nhật: đếm giao, tính diện tích hợp", ["sweep-line"])
      ] },

      // ---------------------------------------------------------------- tối ưu hoá
      opt: { q: "Đặc điểm bài toán?", opts: [
        go("Không gian nghiệm khổng lồ, cần nghiệm tốt trong thời gian cho phép", "opt-h"), out("Cần nghiệm tối ưu CHÍNH XÁC nhưng có thể cắt tỉa", ["branch-and-bound", "backtracking"])
      ] },
      "opt-h": { q: "Nghiệm được xây theo từng bước hay sửa từ một nghiệm có sẵn?", opts: [
        out("Sửa nghiệm có sẵn bằng thay đổi nhỏ (láng giềng)", ["hill-climbing", "simulated-annealing", "tabu-search"], "Hill Climbing dễ kẹt cực trị địa phương; SA cho phép đi xuống có kiểm soát; Tabu nhớ các bước vừa đi."),
        out("Dựng nghiệm từng bước, giữ vài phương án tốt nhất", ["beam-search", "grasp"]),
        out("Trộn hai nghiệm \"cha mẹ\" cho nghiệm tốt hơn là có nghĩa", ["genetic-algorithm"])
      ] },

      // ---------------------------------------------------------------- hệ thống
      sys: { q: "Bạn cần gì?", opts: [
        go("Cache có dung lượng giới hạn", "sys-cache"), out("Chia dữ liệu qua nhiều node, thêm/bớt node ít xáo trộn", ["consistent-hashing"]),
        out("Kiểm tra \"có thể đã có\" tiết kiệm bộ nhớ", ["bloom-filter"]), out("Đếm xấp xỉ số phần tử phân biệt rất lớn", ["hyperloglog"]), out("Giới hạn số request theo thời gian", ["rate-limiter"]),
        out("Chỉ mục / lưu trữ: đọc nhiều (B+ Tree) hay ghi nhiều (LSM Tree)", ["b-plus-tree", "lsm-tree"]), out("Cấu trúc có thứ tự đơn giản thay cây cân bằng", ["skip-list"]),
        out("Kiểm chứng / đối chiếu dữ liệu giữa các node bằng băm", ["merkle-tree"]), out("Sắp thứ tự các sự kiện giữa các node (không có đồng hồ chung)", ["vector-clock"]),
        out("Nhiều node đồng thuận một giá trị / bầu leader", ["raft"]), out("Giao dịch phân tán cần tất cả cùng commit hoặc cùng huỷ", ["two-phase-commit"])
      ] },
      "sys-cache": { q: "Loại bỏ phần tử theo tiêu chí nào?", opts: [out("Lâu nhất chưa được dùng", ["lru-cache"]), out("Ít được dùng nhất (theo tần suất)", ["lfu-cache"])] }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
