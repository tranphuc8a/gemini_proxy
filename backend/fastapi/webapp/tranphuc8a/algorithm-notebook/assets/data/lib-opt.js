/* lib-opt.js — Tối ưu hoá & Heuristic: Hill Climbing, Simulated Annealing, GA, GRASP, Beam Search, Tabu Search, Nhánh cận.
   Mẫu code là KHUNG TỔNG QUÁT (nhận hàm sinh/đánh giá/láng giềng qua template); ví dụ và bài thử dùng TSP nhỏ hoặc một hàm một biến.
   Cách soạn: xem HUONG-DAN-SOAN.md. */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    // ------------------------------------------------------------------------------------------------ hill-climbing
    {
      id: "hill-climbing",
      name: "Hill Climbing",
      aliases: ["hill climbing", "leo đồi", "local search", "tìm kiếm cục bộ", "steepest ascent", "random restart", "khởi động lại ngẫu nhiên"],
      category: "opt",
      sub: "Tìm kiếm cục bộ",
      level: 1,
      tags: ["heuristic", "local-search", "optimization", "hill-climbing", "np-hard"],
      summary: "Giữ một nghiệm, liên tục chuyển sang láng giềng không tệ hơn cho tới khi hết cải thiện được — đơn giản, nhanh, nhưng dễ kẹt ở cực trị cục bộ.",
      description:
        "Hill Climbing giữ **một** nghiệm hiện tại. Mỗi bước sinh một **láng giềng** (thay đổi nhỏ: đổi chỗ hai phần tử, đảo một đoạn, lật một bit…) và chuyển sang nó nếu chi phí **không tệ hơn**. Khi không còn láng giềng nào tốt hơn thì thuật toán đứng yên ở một **cực trị cục bộ**.\n\n" +
        "Đây là heuristic **KHÔNG bảo đảm tối ưu**: kết quả phụ thuộc điểm xuất phát và cách định nghĩa láng giềng. Hai cách cải thiện rẻ nhất là **khởi động lại ngẫu nhiên** (random restart, giữ nghiệm tốt nhất) và nhận cả bước đi ngang (chi phí bằng nhau) để vượt cao nguyên. Muốn thoát hẳn cực trị cục bộ thì chuyển sang Simulated Annealing hoặc Tabu Search.\n\n" +
        "Dùng thay thuật toán chính xác khi bài **NP-khó** hoặc N quá lớn để vét (TSP, xếp lịch, đóng thùng…) và giới hạn thời gian ngặt kiểu OI / Marathon / AtCoder Heuristic Contest; thường là **bước hoàn thiện cuối** sau một thuật toán tham lam. Tham số cần chỉnh: định nghĩa láng giềng (quan trọng nhất), số bước mỗi lần leo, số lần khởi động lại. Với hàm một đỉnh (lồi) leo đồi tới đúng tối ưu toàn cục; địa hình nhiều thung lũng thì không.",
      conditions: ["Có hàm chi phí cost(s) tính được nhanh", "Có cách sinh láng giềng luôn cho nghiệm hợp lệ (hoặc có hàm phạt cho nghiệm vi phạm)", "Chấp nhận nghiệm tốt chứ không nhất thiết tối ưu"],
      complexity: { time: "O(R · I · (T_láng_giềng + T_cost))", space: "O(kích thước một nghiệm)", note: "R = số lần khởi động lại, I = số láng giềng thử mỗi lần. Chi phí thật sự do T_cost quyết định — hãy tính cost theo độ chênh (delta) thay vì tính lại từ đầu." },
      ops: [["Một bước (sinh + đánh giá láng giềng)", "O(T_láng_giềng + T_cost)"], ["Một lần leo", "O(I · (T_láng_giềng + T_cost))"], ["Bộ nhớ", "O(|nghiệm|)"]],
      use_case: ["Cải thiện nghiệm tham lam trong vài chục mili-giây còn lại của một test", "Cực tiểu hoá hàm gần như một đỉnh (ít cực trị cục bộ), ví dụ tinh chỉnh tham số", "Làm bước tìm kiếm cục bộ bên trong GRASP, GA lai (memetic) hay khởi động lại nhiều lần", "Tạo đường cơ sở (baseline) để so với SA/Tabu trước khi đầu tư tinh chỉnh"],
      not_for: ["Cần nghiệm tối ưu bảo đảm → Branch & Bound, DP, ILP", "Địa hình nhiều cực trị cục bộ, ngân sách thời gian lớn → Simulated Annealing hoặc Tabu Search", "Không có cách sinh láng giềng nhỏ hợp lệ → cân nhắc GA hoặc Beam Search (xây từng bước)"],
      pitfalls: [
        "Chỉ nhận láng giềng TỐT HƠN HẲN (c < cur) thì kẹt trên cao nguyên; nhận c <= cur cho phép đi ngang (nhưng cần giới hạn số bước để không lặp vô hạn).",
        "Láng giềng quá lớn (đổi lung tung nhiều phần tử) làm hầu hết bước bị từ chối; quá nhỏ thì leo chậm — chọn kích thước thay đổi theo quy mô.",
        "Một lần leo duy nhất cho kết quả rất phụ thuộc hạt giống: luôn chạy nhiều lần khởi động lại và lấy tốt nhất khi còn thời gian.",
        "Sao chép cả nghiệm (vector lớn) mỗi bước làm thuật toán chậm đi hàng trăm lần so với áp dụng – tính delta – hoàn tác tại chỗ.",
        "Dùng so sánh bằng với số thực (c == cur) cho cao nguyên có thể sai do sai số; dùng ngưỡng nhỏ hoặc cost nguyên."
      ],
      code: {
        lang: "cpp", title: "hill_climbing.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Hill Climbing (leo đồi), khung tổng quát — TỐI THIỂU hoá cost (muốn tối đa hoá thì trả về -giá_trị).
//   gen(rng)          -> một nghiệm khởi đầu (ngẫu nhiên hoặc tham lam)
//   cost(s)           -> double, chi phí của nghiệm s
//   neighbor(s, rng)  -> một láng giềng NGẪU NHIÊN của s (phải luôn là nghiệm hợp lệ)
// Nhận láng giềng nếu KHÔNG tệ hơn (cho phép đi ngang). Khởi động lại restarts lần (>= 1), mỗi lần thử iters láng giềng.
// Trả về nghiệm tốt nhất đã gặp: không bao giờ tệ hơn nghiệm khởi đầu đầu tiên. KHÔNG đảm bảo tối ưu.
// Thời gian: restarts * iters * (T_neighbor + T_cost).
// Dùng: auto best = hillClimbing(genFn, costFn, neighborFn, 20, 100000, rng);
template <class Gen, class Cost, class Neighbor>
auto hillClimbing(Gen gen, Cost cost, Neighbor neighbor, int restarts, int iters, mt19937& rng) {
    using State = decltype(gen(rng));
    State best = gen(rng);
    double bestCost = cost(best);
    for (int r = 0; r < restarts; r++) {
        State cur = (r == 0) ? best : gen(rng);
        double curCost = (r == 0) ? bestCost : cost(cur);
        for (int it = 0; it < iters; it++) {
            State nxt = neighbor(cur, rng);
            double c = cost(nxt);
            if (c <= curCost) { cur = std::move(nxt); curCost = c; }
        }
        if (curCost < bestCost) { best = cur; bestCost = curCost; }
    }
    return best;
}
`
      },
      example: {
        input: "Cực tiểu hoá f(x) = (x - 37)^2 trên số nguyên x thuộc [0, 100].\nBắt đầu từ x = 90; láng giềng của x là x - 1 hoặc x + 1 (chọn ngẫu nhiên, ra ngoài đoạn thì bị từ chối); nhận nếu f không tăng; 1 lần khởi động, 2000 bước.",
        output: "x = 37, f = 0",
        explain: "f là hàm một đỉnh (lồi) nên không có cực tiểu cục bộ nào ngoài tối ưu toàn cục: mỗi bước đi về phía 37 luôn được nhận, bước đi ra xa luôn bị từ chối, sau tối đa khoảng 53 bước tiến thành công thuật toán tới 37 và đứng yên. Với hàm có nhiều thung lũng (xem Simulated Annealing) cùng cách làm này có thể kẹt ở thung lũng sai."
      },
      problems: [],
      related: ["simulated-annealing", "tabu-search", "grasp", "genetic-algorithm", "branch-and-bound"],
      compare: { "Loại": "Tìm kiếm cục bộ", "Bảo đảm tối ưu": "Không", "Tham số cần chỉnh": "Láng giềng, số lần khởi động lại", "Bộ nhớ": "Rất ít" },
      cards: [
        { q: "Hill Climbing có đảm bảo tìm nghiệm tối ưu không?", a: "Không. Nó dừng ở cực trị cục bộ; chỉ đúng tối ưu toàn cục khi địa hình không có cực trị cục bộ nào khác (ví dụ hàm lồi)." },
        { q: "Hai cách rẻ nhất để làm Hill Climbing tốt hơn?", a: "Khởi động lại ngẫu nhiên nhiều lần (lấy nghiệm tốt nhất) và nhận cả bước đi ngang (chi phí bằng nhau) để vượt cao nguyên." },
        { q: "Khi nào chọn Simulated Annealing thay vì Hill Climbing?", a: "Khi địa hình nhiều cực trị cục bộ và còn ngân sách thời gian: SA nhận có xác suất cả nước xấu hơn nên thoát được, còn Hill Climbing thì kẹt." },
        { q: "Vì sao nên tính delta thay vì cost từ đầu?", a: "Một láng giềng chỉ đổi vài phần tử nên cost mới = cost cũ + delta tính trong O(thay đổi); tính lại cost từ đầu thường O(N) và làm số bước/giây giảm hàng chục lần." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ simulated-annealing
    {
      id: "simulated-annealing",
      name: "Simulated Annealing (SA)",
      aliases: ["simulated annealing", "sa", "luyện kim mô phỏng", "ủ nhiệt mô phỏng", "metropolis", "nhiệt độ", "làm nguội"],
      category: "opt",
      sub: "Tìm kiếm cục bộ",
      level: 2,
      tags: ["heuristic", "local-search", "simulated-annealing", "metaheuristic", "optimization", "np-hard"],
      summary: "Tìm kiếm cục bộ chấp nhận có xác suất cả nước đi xấu hơn, xác suất giảm dần theo nhiệt độ — thoát được cực trị cục bộ mà không đảm bảo tối ưu.",
      description:
        "SA mô phỏng quá trình ủ kim loại: ở **nhiệt độ cao** nó nhận cả nước đi làm nghiệm xấu đi để khám phá rộng; khi **nhiệt độ giảm dần** thì ngày càng chỉ nhận nước tốt hơn. Quy tắc Metropolis: nước đi làm chi phí tăng `delta > 0` được nhận với xác suất `exp(-delta / T)`; `delta <= 0` luôn được nhận.\n\n" +
        "Nhờ nhận nước xấu, SA thoát được cực trị cục bộ mà Hill Climbing kẹt. Nó vẫn là heuristic **KHÔNG bảo đảm tối ưu**: lý thuyết chỉ hội tụ xác suất khi làm nguội cực chậm, còn thực tế ta chọn lịch làm nguội vừa với ngân sách thời gian. Tham số then chốt: **nhiệt độ đầu T0** (cỡ độ chênh chi phí của một nước xấu điển hình, để lúc đầu nhận một phần đáng kể các nước xấu), **nhiệt độ cuối T1** (cỡ độ chênh nhỏ nhất còn đáng kể, để cuối chỉ còn leo đồi), **tốc độ làm nguội** (thường nhân một hằng số < 1 mỗi bước) và số bước.\n\n" +
        "Dùng khi bài NP-khó / N lớn và cần nghiệm tốt trong thời gian cố định (OI, Marathon, AtCoder Heuristic Contest): chạy đến hết giờ với nhiệt độ nội suy theo thời gian đã dùng. Trong thi đấu hãy cài láng giềng kiểu *áp dụng – tính delta – hoàn tác* thay vì sao chép cả nghiệm, để mỗi bước chỉ tốn O(kích thước thay đổi).",
      conditions: ["Có hàm chi phí cost(s) và cách sinh láng giềng hợp lệ như Hill Climbing", "Chi phí chênh lệch giữa hai láng giềng đo được để chọn thang nhiệt độ", "Có ngân sách thời gian đủ lớn (hàng nghìn đến hàng triệu bước)"],
      complexity: { time: "O(I · (T_láng_giềng + T_cost))", space: "O(kích thước một nghiệm)", note: "I = tổng số bước (cố định hoặc tới hết giờ). Nếu giữ thêm bản sao nghiệm tốt nhất: cộng O(|nghiệm|) mỗi lần cải thiện kỷ lục." },
      ops: [["Một bước (sinh + đánh giá + quyết định nhận)", "O(T_láng_giềng + T_cost)"], ["Cập nhật nhiệt độ (nhân hằng số)", "O(1)"], ["Bộ nhớ", "O(|nghiệm|)"]],
      use_case: ["TSP, xếp lịch, đóng thùng, bố trí mặt bằng cỡ vừa–lớn trong thi đấu heuristic (AtCoder Heuristic Contest, Marathon)", "Địa hình nhiều cực trị cục bộ mà Hill Climbing hay kẹt", "Bài chỉ cần nghiệm đủ tốt khi hết giờ (anytime algorithm): có thể dừng bất kỳ lúc nào và lấy nghiệm tốt nhất đã thấy"],
      not_for: ["Cần nghiệm tối ưu bảo đảm → Branch & Bound, DP, ILP", "Địa hình đơn giản, ngân sách cực nhỏ → Hill Climbing (ít tham số hơn)", "Hàm đánh giá tốn hàng trăm mili-giây mỗi lần → GA song song hoặc thiết kế lại cost"],
      pitfalls: [
        "T0 quá thấp: SA thành Hill Climbing; quá cao: lúc đầu đi lang thang vô ích. Hãy in tỉ lệ nhận nước xấu ở đầu và cuối để chỉnh.",
        "Chọn T theo thang chi phí của bài: nhân đôi mọi chi phí mà không đổi T là đã đổi hành vi.",
        "Quên giữ nghiệm TỐT NHẤT đã thấy (nghiệm hiện tại ở cuối chưa chắc là tốt nhất); phải lưu kỷ lục riêng.",
        "Gọi pow/exp/clock mỗi bước làm chậm; nhân nhiệt độ một hằng số, tra bảng exp hoặc kiểm tra đồng hồ mỗi vài trăm bước.",
        "Lấy xác suất nhận bằng rng() % K gây lệch; dùng uniform_real_distribution hoặc so sánh số nguyên 32 bit."
      ],
      code: {
        lang: "cpp", title: "simulated_annealing.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Simulated Annealing (luyện kim mô phỏng), khung tổng quát — TỐI THIỂU hoá cost.
//   init              nghiệm khởi đầu hợp lệ
//   cost(s)           -> double
//   neighbor(s, rng)  -> một láng giềng NGẪU NHIÊN hợp lệ của s
//   T0 -> T1          nhiệt độ đầu -> cuối (0 < T1 <= T0), nhiệt độ giảm theo cấp số nhân qua iters bước
// Nước làm chi phí tăng delta > 0 được nhận với xác suất exp(-delta / T). Trả về nghiệm TỐT NHẤT đã thấy.
// KHÔNG đảm bảo tối ưu. Thời gian: iters * (T_neighbor + T_cost).
// Thi đấu: thay vòng for bằng "while còn thời gian" và nội suy T theo thời gian đã dùng.
template <class State, class Cost, class Neighbor>
State simulatedAnnealing(State init, Cost cost, Neighbor neighbor, double T0, double T1, long long iters, mt19937& rng) {
    State cur = init, best = init;
    double curCost = cost(cur), bestCost = curCost;
    uniform_real_distribution<double> U(0.0, 1.0);
    double T = T0, alpha = pow(T1 / T0, 1.0 / max(1LL, iters));   // T *= alpha mỗi bước
    for (long long it = 0; it < iters; it++, T *= alpha) {
        State nxt = neighbor(cur, rng);
        double c = cost(nxt), delta = c - curCost;
        if (delta <= 0 || U(rng) < exp(-delta / T)) {
            cur = std::move(nxt);
            curCost = c;
            if (curCost < bestCost) { best = cur; bestCost = curCost; }
        }
    }
    return best;
}
`
      },
      example: {
        input: "TSP 4 thành phố ở bốn đỉnh một hình vuông cạnh 3: 0 = (0,0), 1 = (0,3), 2 = (3,3), 3 = (3,0).\nNghiệm khởi đầu: thứ tự 0 2 1 3 (hai cạnh chéo cắt nhau). Láng giềng = đảo ngược một đoạn của chu trình (2-opt). T0 = 5, T1 = 0.05, 10000 bước.",
        output: "Chu trình 0 1 2 3 (hoặc đảo chiều/xoay vòng tương đương), độ dài 12",
        explain: "Khởi đầu A-C-B-D dài 3√2 + 3 + 3√2 + 3 ≈ 14,49. Đảo đoạn (2,1) cho 0 1 2 3 = chu vi hình vuông = 12, là chu trình tối ưu duy nhất (mọi chu trình khác của 4 điểm này đều có hai đường chéo, dài ≈ 14,49). SA chắc chắn gặp nước đi này trong 10000 bước và vì lưu nghiệm tốt nhất nên trả về 12. Với N lớn không có gì bảo đảm như vậy: kết quả chỉ \"tốt\" chứ chưa chắc tối ưu."
      },
      problems: [],
      related: ["hill-climbing", "tabu-search", "genetic-algorithm", "grasp", "beam-search", "branch-and-bound"],
      compare: { "Loại": "Tìm kiếm cục bộ (có xác suất)", "Bảo đảm tối ưu": "Không", "Tham số cần chỉnh": "T0, T1, tốc độ làm nguội, số bước", "Bộ nhớ": "Rất ít" },
      cards: [
        { q: "Quy tắc Metropolis của SA là gì?", a: "Nước đi làm chi phí tăng delta > 0 được nhận với xác suất exp(-delta / T); delta <= 0 luôn nhận. T càng thấp càng ít nhận nước xấu." },
        { q: "SA có đảm bảo tối ưu không?", a: "Không trong thực tế: lý thuyết chỉ hội tụ xác suất khi làm nguội cực chậm. Ta chạy theo ngân sách thời gian và lấy nghiệm tốt nhất đã thấy." },
        { q: "Chọn nhiệt độ đầu T0 và cuối T1 như thế nào?", a: "T0 cỡ độ chênh chi phí của một nước xấu điển hình (đầu nhận nhiều nước xấu); T1 cỡ độ chênh nhỏ nhất đáng kể (cuối gần như chỉ leo đồi). Đo tỉ lệ nhận nước xấu để chỉnh." },
        { q: "Vì sao phải lưu nghiệm tốt nhất riêng?", a: "SA có thể rời khỏi nghiệm tốt vì nhận nước xấu; nghiệm hiện tại ở cuối chưa chắc là tốt nhất từng gặp." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ genetic-algorithm
    {
      id: "genetic-algorithm",
      name: "Thuật toán di truyền (GA)",
      aliases: ["genetic algorithm", "ga", "di truyền", "thuật toán di truyền", "evolutionary algorithm", "tiến hoá", "lai ghép", "đột biến", "crossover", "mutation"],
      category: "opt",
      sub: "Quần thể & xây dựng",
      level: 3,
      tags: ["heuristic", "genetic-algorithm", "evolutionary", "population", "metaheuristic", "optimization"],
      summary: "Duy trì một quần thể nghiệm, mỗi thế hệ chọn lọc, lai ghép, đột biến để tiến hoá dần tới nghiệm tốt — không bảo đảm tối ưu, cần chỉnh nhiều tham số.",
      description:
        "GA giữ một **quần thể** nghiệm. Mỗi thế hệ: (1) **chọn lọc** cha mẹ (giải đấu hoặc bánh xe roulette) ưu tiên chi phí thấp, (2) **lai ghép** (crossover) hai cha mẹ thành con mang ghép các phần tốt, (3) **đột biến** (mutation) xáo trộn nhẹ để giữ đa dạng, (4) **ưu tú** (elitism): giữ nguyên vài nghiệm tốt nhất để chất lượng không tụt.\n\n" +
        "GA là heuristic **KHÔNG bảo đảm tối ưu**. Hiệu quả phụ thuộc rất nhiều vào cách **biểu diễn** và toán tử lai ghép: với hoán vị (TSP) phải dùng toán tử giữ tính hoán vị như OX/PMX; ghép bừa hai hoán vị cho ra nghiệm không hợp lệ. Tham số cần chỉnh: **kích thước quần thể**, **tỉ lệ lai ghép / đột biến**, **số thế hệ**, áp lực chọn lọc (cỡ giải đấu). Chọn lọc quá mạnh hoặc quần thể quá nhỏ gây **hội tụ sớm** (cả quần thể giống hệt nhau, mất khả năng cải thiện).\n\n" +
        "Dùng thay thuật toán chính xác khi bài NP-khó, hàm đánh giá là hộp đen, lai ghép hai nghiệm tốt có ý nghĩa và đánh giá song song được. Với bài hoán vị trong thi đấu (AtCoder Heuristic Contest, giới hạn vài giây) tìm kiếm cục bộ (SA) thường hiệu quả hơn vì GA tốn nhiều đánh giá cost.",
      conditions: ["Có hàm đánh giá cost(s) cho nghiệm hoàn chỉnh", "Có biểu diễn nghiệm và toán tử lai ghép / đột biến luôn cho nghiệm hợp lệ", "Chịu được chi phí đánh giá cả quần thể mỗi thế hệ"],
      complexity: { time: "O(G · P · (T_cost + T_lai_ghép))", space: "O(P · |nghiệm|)", note: "G = số thế hệ, P = kích thước quần thể. Đánh giá cost chiếm phần lớn thời gian nên dễ song song hoá theo cá thể." },
      ops: [["Một thế hệ", "O(P · (T_cost + T_lai_ghép))"], ["Chọn lọc giải đấu (cỡ k)", "O(k)"], ["Bộ nhớ", "O(P · |nghiệm|)"]],
      use_case: ["Tối ưu tham số của mô phỏng / mô hình mà hàm đánh giá là hộp đen", "Bài thiết kế, xếp lịch, bố trí có thể ghép hai lời giải tốt thành lời giải mới có nghĩa", "Cần nhiều nghiệm đa dạng (quần thể) thay vì một nghiệm duy nhất", "Có sẵn nhiều lõi để đánh giá song song cả quần thể"],
      not_for: ["Cần nghiệm tối ưu bảo đảm → Branch & Bound / DP / ILP", "Bài hoán vị cỡ lớn, giới hạn vài giây → Simulated Annealing hoặc tìm kiếm cục bộ thường nhanh hơn", "Không có cách lai ghép giữ được tính hợp lệ → dùng Hill Climbing / SA với láng giềng"],
      pitfalls: [
        "Lai ghép làm hỏng ràng buộc (hoán vị trùng phần tử, vượt dung lượng): dùng OX/PMX cho hoán vị, hoặc sửa chữa / phạt sau lai ghép.",
        "Hội tụ sớm: quần thể thành bản sao của một cá thể. Giảm áp lực chọn lọc, tăng đột biến, hoặc chèn cá thể ngẫu nhiên mới.",
        "Không dùng elitism thì nghiệm tốt nhất có thể bị mất qua thế hệ; luôn lưu nghiệm tốt nhất mọi thời đại.",
        "Thứ tự tính các biểu thức đối số trong C++ là không xác định: gọi chọn lọc ngẫu nhiên hai lần ngay trong danh sách đối số sẽ cho kết quả khác nhau giữa trình biên dịch — hãy gán ra biến trước.",
        "Tính lại cost của cá thể không đổi qua thế hệ (ưu tú) là lãng phí; lưu cost kèm cá thể."
      ],
      code: {
        lang: "cpp", title: "genetic_algorithm.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Thuật toán di truyền (GA), khung tổng quát — TỐI THIỂU hoá cost.
//   gen(rng)              -> một cá thể ngẫu nhiên hợp lệ
//   cost(s)               -> double (càng nhỏ càng thích nghi)
//   crossover(a, b, rng)  -> con của hai bố mẹ (phải hợp lệ; hoán vị: dùng OX / PMX)
//   mutate(s, rng)        -> biến đổi nhẹ s TẠI CHỖ (phải giữ s hợp lệ), được gọi với xác suất pm cho mỗi con
// Mỗi thế hệ: giữ nguyên elite cá thể tốt nhất, phần còn lại = chọn lọc giải đấu cỡ 3 -> lai ghép -> đột biến.
// Trả về cá thể tốt nhất mọi thời đại. KHÔNG đảm bảo tối ưu. Thời gian: generations * popSize * (T_cost + T_crossover).
template <class Gen, class Cost, class Cross, class Mutate>
auto geneticAlgorithm(Gen gen, Cost cost, Cross crossover, Mutate mutate,
                      int popSize, int generations, double pm, mt19937& rng, int elite = 1) {
    using State = decltype(gen(rng));
    popSize = max(popSize, 2);
    elite = max(0, min(elite, popSize));
    vector<State> pop;
    vector<double> fit;
    for (int i = 0; i < popSize; i++) { pop.push_back(gen(rng)); fit.push_back(cost(pop.back())); }
    State best = pop[0];
    double bestCost = fit[0];
    auto note = [&]() {
        for (int i = 0; i < popSize; i++)
            if (fit[i] < bestCost) { bestCost = fit[i]; best = pop[i]; }
    };
    note();
    uniform_real_distribution<double> U(0.0, 1.0);
    auto tournament = [&]() {   // chọn giải đấu cỡ 3: lấy cá thể có cost nhỏ nhất trong 3 cá thể ngẫu nhiên
        int w = rng() % popSize;
        for (int k = 1; k < 3; k++) { int c = rng() % popSize; if (fit[c] < fit[w]) w = c; }
        return w;
    };
    for (int g = 0; g < generations; g++) {
        vector<int> order(popSize);
        iota(order.begin(), order.end(), 0);
        sort(order.begin(), order.end(), [&](int a, int b) { return fit[a] < fit[b]; });
        vector<State> np;
        vector<double> nf;
        for (int i = 0; i < elite; i++) { np.push_back(pop[order[i]]); nf.push_back(fit[order[i]]); }
        while ((int)np.size() < popSize) {
            int a = tournament(), b = tournament();   // gán ra biến: thứ tự tính đối số không xác định
            State child = crossover(pop[a], pop[b], rng);
            if (U(rng) < pm) mutate(child, rng);
            nf.push_back(cost(child));
            np.push_back(std::move(child));
        }
        pop = std::move(np);
        fit = std::move(nf);
        note();
    }
    return best;
}
`
      },
      example: {
        input: "OneMax: tìm xâu 10 bit có nhiều bit 1 nhất (cost = số bit 0).\nQuần thể 40 xâu ngẫu nhiên; lai ghép một điểm cắt; đột biến lật một bit với xác suất 0,3; 200 thế hệ; giữ 1 cá thể ưu tú.",
        output: "1111111111 (cost = 0)",
        explain: "Tối ưu duy nhất là toàn bit 1. Chọn lọc ưu tiên xâu nhiều bit 1, lai ghép gộp các đoạn tốt, đột biến sửa các bit 0 còn sót; elitism bảo đảm nghiệm tốt nhất không tụt. Kết quả \"thường\" là tối ưu với tham số này nhưng GA không hứa điều đó: với quần thể nhỏ hay ít thế hệ có thể còn sót vài bit 0."
      },
      problems: [],
      related: ["simulated-annealing", "hill-climbing", "grasp", "beam-search", "tabu-search"],
      compare: { "Loại": "Quần thể (tiến hoá)", "Bảo đảm tối ưu": "Không", "Tham số cần chỉnh": "Cỡ quần thể, tỉ lệ lai ghép/đột biến, số thế hệ", "Bộ nhớ": "Nhiều (cả quần thể)" },
      cards: [
        { q: "Bốn bước của một thế hệ GA?", a: "Chọn lọc cha mẹ, lai ghép tạo con, đột biến để giữ đa dạng, và giữ ưu tú (elitism) vài nghiệm tốt nhất." },
        { q: "Hội tụ sớm là gì và xử lý ra sao?", a: "Cả quần thể trở nên gần như giống hệt nhau nên không còn cải thiện. Giảm áp lực chọn lọc, tăng đột biến, tăng cỡ quần thể hoặc chèn cá thể ngẫu nhiên mới." },
        { q: "Vì sao không thể lai ghép hai hoán vị bằng cách cắt – dán thông thường?", a: "Con có thể trùng hoặc thiếu phần tử, không còn là hoán vị. Dùng toán tử giữ hoán vị như OX hoặc PMX." },
        { q: "GA có đảm bảo tối ưu không?", a: "Không. Kết quả phụ thuộc hạt giống và tham số; chỉ nên coi là nghiệm tốt tìm được trong ngân sách." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ grasp
    {
      id: "grasp",
      name: "GRASP",
      aliases: ["grasp", "greedy randomized adaptive search procedure", "tham lam ngẫu nhiên hoá", "rcl", "restricted candidate list", "danh sách ứng viên hạn chế"],
      category: "opt",
      sub: "Quần thể & xây dựng",
      level: 3,
      tags: ["heuristic", "grasp", "greedy", "local-search", "metaheuristic", "optimization"],
      summary: "Lặp: xây nghiệm bằng tham lam có ngẫu nhiên hoá (chọn trong danh sách ứng viên hạn chế) rồi cải thiện bằng tìm kiếm cục bộ, giữ nghiệm tốt nhất.",
      description:
        "Mỗi vòng GRASP có hai pha. **Pha xây dựng**: dựng nghiệm từng bước; ở mỗi bước chấm điểm tham lam mọi ứng viên rồi chọn NGẪU NHIÊN trong **danh sách ứng viên hạn chế (RCL)** — các ứng viên có chi phí không quá `cmin + α·(cmax − cmin)`. **Pha cải thiện**: chạy tìm kiếm cục bộ (Hill Climbing, 2-opt…) tới khi không cải thiện được. Lặp nhiều vòng và giữ nghiệm tốt nhất.\n\n" +
        "Tham số **α ∈ [0,1]** điều khiển cân bằng: α = 0 là tham lam thuần túy (mọi vòng ra cùng một nghiệm), α = 1 là hoàn toàn ngẫu nhiên. Tham lam thuần cho chất lượng khởi đầu tốt nhưng thiếu đa dạng; ngẫu nhiên thuần đa dạng nhưng khởi đầu kém — α trung gian (thường vài chục phần trăm, cần thử) cho nghiệm xuất phát vừa tốt vừa khác nhau để tìm kiếm cục bộ rơi vào nhiều thung lũng khác nhau.\n\n" +
        "GRASP là heuristic **KHÔNG bảo đảm tối ưu**, hợp khi đã có sẵn bộ xây dựng tham lam và bộ tìm kiếm cục bộ tốt (TSP, set cover, xếp lịch, đóng thùng). Các vòng lặp độc lập nên dễ song song và dễ chạy theo thời gian (anytime).",
      conditions: ["Có cách xây nghiệm theo từng bước với điểm tham lam cho các ứng viên", "Có tìm kiếm cục bộ cải thiện nghiệm tại chỗ", "Chấp nhận nghiệm tốt thay vì tối ưu bảo đảm"],
      complexity: { time: "O(K · (T_xây + T_cục_bộ))", space: "O(kích thước nghiệm)", note: "K = số vòng GRASP. T_xây thường O(N · số ứng viên) cho mỗi nghiệm; T_cục_bộ phụ thuộc bài (2-opt đầy đủ ~ O(N²) mỗi lượt quét)." },
      ops: [["Một vòng GRASP", "O(T_xây + T_cục_bộ)"], ["Chọn ngẫu nhiên trong RCL", "O(số ứng viên)"], ["Bộ nhớ", "O(|nghiệm|)"]],
      use_case: ["Đã có thuật toán tham lam tốt, muốn sinh nhiều nghiệm xuất phát đa dạng rồi tinh chỉnh", "TSP / VRP / set cover / xếp lịch cỡ vừa trong thi đấu heuristic", "Cần thuật toán ít tham số (chủ yếu α và số vòng) và dễ song song"],
      not_for: ["Không có cách xây tham lam tự nhiên → GA hoặc SA từ nghiệm ngẫu nhiên", "Cần nghiệm tối ưu bảo đảm → Branch & Bound, DP, ILP", "Cần thoát cực trị cục bộ sâu trong một lần chạy → SA / Tabu có bộ nhớ thích hợp hơn"],
      pitfalls: [
        "α = 0 cho mọi vòng ra cùng một nghiệm (lãng phí); α = 1 bỏ phí thông tin tham lam. Thử vài giá trị, hoặc đổi α giữa các vòng (reactive GRASP).",
        "Điểm tham lam phải cùng chiều (nhỏ = tốt) cho cả RCL; nếu bài tối đa hoá hãy đổi dấu trước khi gọi.",
        "RCL phải luôn có ít nhất một ứng viên (ứng viên tốt nhất luôn thuộc RCL); cẩn thận khi cmax = cmin hoặc có NaN.",
        "Không cải thiện cục bộ thì GRASP chỉ là tham lam ngẫu nhiên — pha cải thiện mới là phần ăn tiền.",
        "Mỗi vòng độc lập nên không học được gì từ vòng trước; nếu cần, kết hợp với path relinking hoặc giữ tập nghiệm ưu tú."
      ],
      code: {
        lang: "cpp", title: "grasp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// GRASP (Greedy Randomized Adaptive Search Procedure), khung tổng quát — TỐI THIỂU hoá cost.
// rclPick: candCost[i] = điểm tham lam của ứng viên i (nhỏ = tốt; mảng KHÔNG rỗng). Trả về chỉ số ngẫu nhiên trong số
// các ứng viên có candCost <= cmin + alpha * (cmax - cmin). alpha = 0: tham lam thuần (chỉ các ứng viên tốt nhất); alpha = 1: ngẫu nhiên hoàn toàn.
inline int rclPick(const vector<double>& candCost, double alpha, mt19937& rng) {
    double lo = *min_element(candCost.begin(), candCost.end());
    double hi = *max_element(candCost.begin(), candCost.end());
    double limit = lo + alpha * (hi - lo);
    vector<int> rcl;
    for (int i = 0; i < (int)candCost.size(); i++)
        if (candCost[i] <= limit) rcl.push_back(i);
    return rcl[rng() % rcl.size()];
}

//   build(alpha, rng) -> một nghiệm xây từng bước, mỗi bước chọn ứng viên bằng rclPick
//   improve(s)        -> tìm kiếm cục bộ, sửa s TẠI CHỖ tới khi không cải thiện được
//   cost(s)           -> double
// Lặp iters (>= 1) vòng, giữ nghiệm tốt nhất. KHÔNG đảm bảo tối ưu. Thời gian: iters * (T_build + T_improve).
template <class Build, class Improve, class Cost>
auto grasp(Build build, Improve improve, Cost cost, double alpha, int iters, mt19937& rng) {
    using State = decltype(build(alpha, rng));
    State best{};
    double bestCost = numeric_limits<double>::infinity();
    for (int it = 0; it < iters; it++) {
        State s = build(alpha, rng);
        improve(s);
        double c = cost(s);
        if (c < bestCost) { bestCost = c; best = std::move(s); }
    }
    return best;
}
`
      },
      example: {
        input: "TSP 4 thành phố ở bốn đỉnh hình vuông cạnh 3: 0 = (0,0), 1 = (0,3), 2 = (3,3), 3 = (3,0).\nXây dựng: bắt đầu ở thành phố 0, mỗi bước chọn thành phố chưa thăm trong RCL theo khoảng cách (α = 0,3). Cải thiện: 2-opt tới khi hết cải thiện. 20 vòng.",
        output: "Chu trình dài 12 (0 1 2 3 hoặc đảo chiều)",
        explain: "Từ 0, hai thành phố gần nhất (1 và 3) cách 3, còn thành phố 2 cách ≈ 4,24, nên với α = 0,3 RCL chỉ gồm 1 và 3 (giới hạn 3 + 0,3·1,24 ≈ 3,37); các bước sau RCL chỉ còn một ứng viên. Mọi vòng đều xây ra hình vuông 0 1 2 3 hoặc 0 3 2 1 dài 12 — tối ưu duy nhất của bài này — và 2-opt không còn gì để cải thiện. Muốn thấy pha cải thiện làm việc phải đặt α = 1: RCL có cả thành phố 2, chu trình xây ra có thể là 0 2 1 3 (≈ 14,49) rồi 2-opt đảo đoạn về 12. Bài lớn thì không có bảo đảm như vậy."
      },
      problems: [],
      related: ["hill-climbing", "simulated-annealing", "beam-search", "genetic-algorithm", "tabu-search"],
      compare: { "Loại": "Xây dựng + cục bộ", "Bảo đảm tối ưu": "Không", "Tham số cần chỉnh": "α của RCL, số vòng", "Bộ nhớ": "Ít" },
      cards: [
        { q: "Hai pha của mỗi vòng GRASP?", a: "Xây dựng nghiệm bằng tham lam có ngẫu nhiên hoá (chọn trong RCL), rồi cải thiện bằng tìm kiếm cục bộ. Giữ nghiệm tốt nhất qua các vòng." },
        { q: "α trong RCL điều khiển điều gì?", a: "α = 0: tham lam thuần (không đa dạng); α = 1: ngẫu nhiên hoàn toàn. RCL gồm ứng viên có chi phí <= cmin + α(cmax − cmin)." },
        { q: "Vì sao GRASP cần cả ngẫu nhiên lẫn tìm kiếm cục bộ?", a: "Ngẫu nhiên cho nhiều nghiệm xuất phát khác nhau; tìm kiếm cục bộ đưa mỗi nghiệm xuống một thung lũng tốt. Thiếu một trong hai thì hoặc lặp lại cùng nghiệm hoặc chất lượng kém." },
        { q: "GRASP có đảm bảo tối ưu không?", a: "Không, đây là heuristic. Nhiều vòng chỉ tăng xác suất gặp nghiệm tốt." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ beam-search
    {
      id: "beam-search",
      name: "Beam Search",
      aliases: ["beam search", "tìm kiếm chùm", "beam width", "độ rộng beam", "tìm kiếm theo tầng", "ahc beam"],
      category: "opt",
      sub: "Quần thể & xây dựng",
      level: 3,
      tags: ["heuristic", "beam-search", "search", "layered", "optimization", "greedy"],
      summary: "Xây nghiệm theo từng tầng, mỗi tầng chỉ giữ B trạng thái có điểm tốt nhất — nằm giữa tham lam (B = 1) và vét cạn (B = vô hạn).",
      description:
        "Beam Search xây nghiệm theo **tầng**: mỗi bước thêm một quyết định. Từ B trạng thái của tầng hiện tại, sinh **mọi** trạng thái con, chấm điểm, rồi chỉ giữ **B** trạng thái điểm tốt nhất (nth_element / partial_sort) sang tầng sau. B = 1 chính là thuật toán tham lam; B đủ lớn để không cắt gì chính là vét cạn theo tầng.\n\n" +
        "Đây là heuristic **KHÔNG bảo đảm tối ưu**: nghiệm đúng có thể bị loại sớm vì điểm tầng nông của nó chưa đẹp, và tăng B **không đảm bảo** tốt hơn (không đơn điệu). Chất lượng phụ thuộc chủ yếu vào **hàm điểm** cho trạng thái dở dang (chi phí đã đi + ước lượng phần còn lại) và **độ rộng beam B** (tham số chính). Hai kỹ thuật quan trọng: **khử trùng lặp** trạng thái giống nhau (băm, ví dụ Zobrist) để beam không đầy bản sao, và chọn B theo ngân sách thời gian (chạy với B tăng dần tới hết giờ).\n\n" +
        "Dùng khi nghiệm được dựng từng bước (xếp, chọn, đi đường…), có hàm điểm cho trạng thái dở dang khá đáng tin, và cần chất lượng cao hơn tham lam nhưng không vét được — rất hay gặp trong AtCoder Heuristic Contest với giới hạn vài giây.",
      conditions: ["Nghiệm dựng theo từng bước (độ sâu D cố định hoặc xác định)", "Có hàm điểm cho trạng thái dở dang đủ tương quan với chất lượng nghiệm cuối", "Sinh trạng thái con và tính điểm đủ rẻ để làm B · (số con) lần mỗi tầng"],
      complexity: { time: "O(D · B · b · T_điểm)", space: "O(B · |trạng thái|)", note: "D = số tầng, b = số con trung bình mỗi trạng thái. Chọn B tốt nhất cần O(B·b) bằng nth_element thay vì sắp xếp O(B·b·log)." },
      ops: [["Một tầng (sinh con + chọn B tốt nhất)", "O(B · b · T_điểm)"], ["Chọn B tốt nhất", "O(B · b)"], ["Bộ nhớ", "O(B · |trạng thái|)"]],
      use_case: ["AtCoder Heuristic Contest / Marathon: bài dựng nghiệm từng bước có hàm điểm cho trạng thái dở dang", "Bài tối ưu có cấu trúc thứ tự (xếp hàng, lập lịch, đi qua các điểm) mà tham lam hơi yếu", "Giải mã chuỗi (dịch máy, nhận dạng giọng nói) — dạng beam search quen thuộc", "Khi cần chất lượng tốt hơn tham lam nhưng chỉ có O(B) bộ nhớ"],
      not_for: ["Hàm điểm trạng thái dở dang không đáng tin → beam bị lạc, dùng SA / tìm kiếm cục bộ", "Cần tối ưu bảo đảm → Branch & Bound (cận chặt) hoặc DP", "Bài không dựng được từng bước mà sửa nghiệm có sẵn → Hill Climbing / SA"],
      pitfalls: [
        "Tăng B không đảm bảo kết quả tốt hơn — beam rộng hơn có thể loại nhầm nghiệm tốt khi điểm tầng nông đánh lừa.",
        "Không khử trùng lặp thì beam bị đầy bản sao của cùng trạng thái (hoặc các thứ tự thao tác tương đương) và mất đa dạng.",
        "Hàm điểm phải so sánh được CÔNG BẰNG giữa các trạng thái cùng tầng (cùng số quyết định); cộng thêm ước lượng phần còn lại, không chỉ chi phí đã đi.",
        "Sao chép cả trạng thái cho mỗi con tốn bộ nhớ và thời gian; dùng con trỏ cha + nước đi để dựng lại nghiệm.",
        "Trạng thái kết thúc sớm phải được giữ lại để cạnh tranh với trạng thái còn đang xây, nếu không bị mất nghiệm."
      ],
      code: {
        lang: "cpp", title: "beam_search.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Beam Search, khung tổng quát — xây nghiệm theo tầng, mỗi tầng chỉ giữ width trạng thái có score nhỏ nhất.
//   init              trạng thái đầu
//   expand(s, out)    đẩy MỌI trạng thái con của s vào out; để trống nếu s đã là nghiệm hoàn chỉnh
//   score(s)          -> double, nhỏ = tốt; với trạng thái dở dang là ĐÁNH GIÁ (chi phí đã đi + ước lượng phần còn lại)
// Trạng thái không có con được giữ nguyên sang tầng sau. Dừng khi không trạng thái nào mở rộng được; trả về trạng thái score nhỏ nhất.
// width = 1: tham lam; width đủ lớn: vét cạn theo tầng. KHÔNG đảm bảo tối ưu (và tăng width chưa chắc tốt hơn).
// Thời gian ≈ số_tầng * width * số_con * T_score.
template <class State, class Expand, class Score>
State beamSearch(State init, Expand expand, Score score, size_t width) {
    width = max<size_t>(width, 1);
    using Item = pair<double, State>;
    vector<Item> beam;
    beam.push_back({score(init), init});
    while (true) {
        vector<Item> next;
        bool grew = false;
        for (auto& it : beam) {
            vector<State> kids;
            expand(it.second, kids);
            if (kids.empty()) {
                next.push_back(it);
            } else {
                grew = true;
                for (auto& k : kids) { double sc = score(k); next.push_back({sc, std::move(k)}); }
            }
        }
        if (!grew) break;
        if (next.size() > width) {
            nth_element(next.begin(), next.begin() + width, next.end(),
                        [](const Item& a, const Item& b) { return a.first < b.first; });
            next.erase(next.begin() + width, next.end());
        }
        beam = std::move(next);
    }
    auto bi = min_element(beam.begin(), beam.end(), [](const Item& a, const Item& b) { return a.first < b.first; });
    return bi->second;
}
`
      },
      example: {
        input: "TSP 4 thành phố ở bốn đỉnh hình vuông cạnh 3: 0 = (0,0), 1 = (0,3), 2 = (3,3), 3 = (3,0). Xuất phát từ thành phố 0; trạng thái = đường đi dở dang; con = nối thêm một thành phố chưa thăm; điểm = độ dài đường đi (cộng cạnh quay về 0 khi đủ 4 thành phố). Độ rộng beam B = 2.",
        output: "Chu trình dài 12: 0 1 2 3 (hoặc 0 3 2 1)",
        explain: "Tầng 1: [0,1] = 3, [0,3] = 3, [0,2] ≈ 4,24 → giữ [0,1] và [0,3]. Tầng 2: [0,1,2] = 6, [0,3,2] = 6, [0,1,3] ≈ 7,24, [0,3,1] ≈ 7,24 → giữ [0,1,2] và [0,3,2]. Tầng 3: hai đường 0-1-2-3 và 0-3-2-1 đều dài 9 + 3 (cạnh quay về) = 12. Nếu B = 1 và gặp thế hòa ở tầng 1 thì cũng vẫn ra 12, nhưng trên bài lớn B nhỏ dễ loại nhầm nghiệm tốt."
      },
      problems: [],
      related: ["grasp", "hill-climbing", "simulated-annealing", "branch-and-bound", "genetic-algorithm"],
      compare: { "Loại": "Xây dựng theo tầng", "Bảo đảm tối ưu": "Không", "Tham số cần chỉnh": "Độ rộng beam B, hàm điểm trạng thái dở dang", "Bộ nhớ": "Vừa (B trạng thái)" },
      cards: [
        { q: "Beam Search với độ rộng B = 1 là thuật toán gì?", a: "Tham lam: mỗi tầng chỉ giữ một trạng thái tốt nhất. B đủ lớn để không cắt gì thì là vét cạn theo tầng." },
        { q: "Tăng độ rộng beam có đảm bảo nghiệm tốt hơn không?", a: "Không. Beam rộng hơn có thể giữ trạng thái khác, đôi khi cho kết quả tệ hơn beam hẹp vì điểm tầng nông đánh lừa." },
        { q: "Vì sao nên khử trùng lặp trong beam?", a: "Nhiều đường đi cùng dẫn tới một trạng thái; bản sao chiếm chỗ của B vị trí và làm mất đa dạng. Dùng băm (Zobrist…) để bỏ bản sao." },
        { q: "Độ phức tạp một tầng và cách chọn B tốt nhất?", a: "O(B · b · T_điểm) để sinh và chấm điểm; chọn B tốt nhất bằng nth_element trong O(B · b), không cần sắp xếp toàn bộ." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ tabu-search
    {
      id: "tabu-search",
      name: "Tabu Search",
      aliases: ["tabu search", "tìm kiếm tabu", "danh sách cấm", "tabu list", "aspiration", "tìm kiếm cục bộ có bộ nhớ"],
      category: "opt",
      sub: "Tìm kiếm cục bộ",
      level: 3,
      tags: ["heuristic", "tabu-search", "local-search", "metaheuristic", "optimization", "np-hard"],
      summary: "Luôn đi tới láng giềng tốt nhất chưa bị cấm (kể cả tệ hơn hiện tại) và cấm tạm thời việc quay lại — thoát cực trị cục bộ bằng bộ nhớ ngắn hạn.",
      description:
        "Tabu Search là tìm kiếm cục bộ **có bộ nhớ**. Mỗi vòng nó **quét toàn bộ láng giềng** và đi tới láng giềng tốt nhất **không bị cấm**, kể cả khi nó tệ hơn nghiệm hiện tại. Nhờ vậy nó rời được cực trị cục bộ; để không quay lại ngay (lặp vòng), thuộc tính của nước vừa đi (ví dụ cặp phần tử vừa đổi chỗ) bị đưa vào **danh sách tabu** trong `tenure` vòng.\n\n" +
        "**Tiêu chí kỳ vọng (aspiration)**: một nước bị cấm vẫn được phép nếu đưa tới nghiệm tốt hơn mọi nghiệm đã thấy. Heuristic này **KHÔNG bảo đảm tối ưu**. Tham số cần chỉnh: **độ dài tabu (tenure)** — quá ngắn thì quay vòng, quá dài thì cấm hết nước tốt — thường cỡ vài đơn vị tới khoảng căn bậc hai số nước đi, có thể ngẫu nhiên hoá; **cách chọn thuộc tính** để cấm (phải gán cùng khoá cho một nước và nước đảo ngược nó); và kích thước láng giềng.\n\n" +
        "Khác SA (nhận nước xấu theo xác suất, ngẫu nhiên), Tabu Search **xác định** và tốn công quét hết láng giềng mỗi vòng nên hợp khi láng giềng nhỏ hoặc đánh giá delta rẻ (đổi chỗ hai phần tử, lật một bit). Rất phổ biến cho xếp lịch, phân công, tô màu đồ thị, TSP/VRP cỡ vừa.",
      conditions: ["Láng giềng liệt kê được và đủ nhỏ để quét hết mỗi vòng (hoặc đánh giá delta rẻ)", "Có thể định nghĩa thuộc tính của nước đi để đưa vào danh sách cấm", "Nước đi và nước đảo ngược nó nhận cùng một khoá"],
      complexity: { time: "O(I · |láng giềng| · (T_áp_dụng + T_cost))", space: "O(số thuộc tính cấm + |nghiệm|)", note: "I = số vòng. Dùng delta thay vì áp dụng cả nghiệm để mỗi nước đi tốn O(thay đổi). Danh sách cấm dạng bảng hết hạn tra O(1)." },
      ops: [["Một vòng (quét toàn bộ láng giềng)", "O(|láng giềng| · T_đánh_giá)"], ["Kiểm tra / thêm một thuộc tính cấm", "O(1)"], ["Bộ nhớ", "O(|nghiệm| + số thuộc tính cấm)"]],
      use_case: ["Xếp lịch (nhân viên, thời khoá biểu), phân công, tô màu đồ thị, VRP/TSP cỡ vừa", "Nghiệm hay rơi vào cùng vài cực trị cục bộ và Hill Climbing kẹt", "Láng giềng nhỏ, quét hết mỗi vòng được: đổi chỗ hai phần tử, chuyển một phần tử sang nhóm khác", "Muốn thuật toán xác định (cùng đầu vào ra cùng nghiệm), dễ tái hiện lỗi"],
      not_for: ["Láng giềng rất lớn hoặc đánh giá mỗi nước đắt → SA (chỉ thử một láng giềng ngẫu nhiên mỗi bước)", "Cần nghiệm tối ưu bảo đảm → Branch & Bound / DP / ILP", "Không thể định nghĩa thuộc tính cấm hợp lý → Hill Climbing nhiều lần khởi động"],
      pitfalls: [
        "Cấm CẢ nước đảo ngược: khoá của nước đi và nước đảo ngược phải trùng, nếu không thuật toán quay lại ngay.",
        "Tenure quá dài khiến mọi nước đều bị cấm (cần xử lý trường hợp này: xoá danh sách cấm hoặc chọn nước ít cấm nhất); quá ngắn thì lặp vòng.",
        "Quên aspiration thì có thể bỏ lỡ nghiệm tốt nhất mọi thời đại chỉ vì nó nằm trong danh sách cấm.",
        "Chỉ so sánh với nghiệm hiện tại thay vì nghiệm tốt nhất khi kiểm tra aspiration → lệch logic; phải so với kỷ lục toàn cục.",
        "Quét toàn bộ O(N²) láng giềng mỗi vòng quá chậm với N lớn: giới hạn danh sách ứng viên hoặc dùng danh sách láng giềng gần."
      ],
      code: {
        lang: "cpp", title: "tabu_search.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Tabu Search, khung tổng quát — TỐI THIỂU hoá cost.
//   moves(s)      -> vector<Move>: TOÀN BỘ nước đi của láng giềng của s
//   apply(s, m)   -> trạng thái mới sau khi áp nước m lên s (không sửa s)
//   key(m)        -> khoá nguyên của "thuộc tính" nước đi để cấm; nước m và nước đảo ngược nó phải có CÙNG khoá
//                    (vd đổi chỗ thành phố a, b: khoá = a * n + b với a < b)
//   tenure        số vòng một khoá bị cấm sau khi đi (cỡ vài tới ~sqrt(|moves|); cần chỉnh)
// Mỗi vòng đi tới láng giềng tốt nhất KHÔNG bị cấm (kể cả tệ hơn hiện tại). Aspiration: nước bị cấm vẫn được nếu tốt hơn kỷ lục.
// Mọi nước đều bị cấm -> xoá danh sách cấm. Xác định, KHÔNG đảm bảo tối ưu. Thời gian: iters * |moves| * (T_apply + T_cost).
template <class State, class Cost, class Moves, class Apply, class Key>
State tabuSearch(State init, Cost cost, Moves moves, Apply apply, Key key, int iters, int tenure) {
    State cur = init, best = init;
    double bestCost = cost(cur);
    unordered_map<long long, int> until;   // khoá -> vòng cuối cùng khoá còn bị cấm
    for (int it = 1; it <= iters; it++) {
        auto cand = moves(cur);
        if (cand.empty()) break;
        bool found = false;
        State nb = cur;
        double nbCost = 0;
        long long nbKey = 0;
        for (auto& m : cand) {
            State t = apply(cur, m);
            double c = cost(t);
            long long k = key(m);
            auto f = until.find(k);
            bool tabu = (f != until.end() && f->second >= it);
            if (tabu && !(c < bestCost)) continue;   // bị cấm và không đạt aspiration
            if (!found || c < nbCost) { found = true; nb = std::move(t); nbCost = c; nbKey = k; }
        }
        if (!found) { until.clear(); continue; }
        cur = std::move(nb);
        until[nbKey] = it + tenure;                  // cấm thuộc tính của nước vừa đi trong tenure vòng kế
        if (nbCost < bestCost) { best = cur; bestCost = nbCost; }
    }
    return best;
}
`
      },
      example: {
        input: "Cực tiểu hoá f trên x = 0..10, f = [9, 5, 3, 4, 5, 6, 5, 2, 3, 4, 5] (f(0) = 9, f(1) = 5, …, f(7) = 2).\nBắt đầu x = 2 (f = 3, cực tiểu cục bộ). Nước đi: x -> x - 1 hoặc x + 1; khoá cấm = cạnh {x, x ± 1} vừa đi; tenure = 4; 8 vòng.",
        output: "x = 7, f = 2",
        explain: "Tại x = 2 cả hai láng giềng đều tệ hơn (f(1) = 5, f(3) = 4); Tabu vẫn đi tới 3 (tốt nhất trong hai) và cấm cạnh {2,3}. Vòng sau không được quay lại 2 (bị cấm và không phá kỷ lục f = 3) nên tiếp tục 4 (f = 5), 5 (f = 6), 6 (f = 5), rồi 7 (f = 2) — vượt qua \"đồi\" cao 6 để tới thung lũng sâu hơn. Hill Climbing từ x = 2 đứng yên ở f = 3."
      },
      problems: [],
      related: ["hill-climbing", "simulated-annealing", "grasp", "genetic-algorithm", "branch-and-bound"],
      compare: { "Loại": "Tìm kiếm cục bộ (có bộ nhớ)", "Bảo đảm tối ưu": "Không", "Tham số cần chỉnh": "Độ dài tabu, tiêu chí aspiration, láng giềng", "Bộ nhớ": "Ít" },
      cards: [
        { q: "Tabu Search thoát cực trị cục bộ bằng cách nào?", a: "Mỗi vòng đi tới láng giềng tốt nhất chưa bị cấm kể cả khi tệ hơn hiện tại, đồng thời cấm tạm thời nước đảo ngược để không quay lại ngay." },
        { q: "Aspiration (tiêu chí kỳ vọng) là gì?", a: "Một nước đang bị cấm vẫn được thực hiện nếu đưa tới nghiệm tốt hơn nghiệm tốt nhất đã thấy." },
        { q: "Tenure quá ngắn hay quá dài gây hậu quả gì?", a: "Quá ngắn: thuật toán quay vòng quanh cực trị cục bộ. Quá dài: nhiều nước tốt bị cấm, có thể cấm hết mọi nước." },
        { q: "Khác biệt chính giữa Tabu Search và Simulated Annealing?", a: "Tabu xác định: quét hết láng giềng, đi nước tốt nhất chưa cấm. SA ngẫu nhiên: thử một láng giềng, nhận nước xấu theo xác suất exp(-delta/T)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ branch-and-bound
    {
      id: "branch-and-bound",
      name: "Nhánh cận (Branch & Bound)",
      aliases: ["branch and bound", "branch & bound", "b&b", "nhánh cận", "nhánh và cận", "cắt tỉa theo cận", "lower bound pruning"],
      category: "opt",
      sub: "Chính xác",
      level: 3,
      tags: ["branch-and-bound", "exact", "optimization", "pruning", "search", "np-hard"],
      summary: "Vét cạn có cắt tỉa: duyệt cây lời giải và bỏ cả nhánh khi cận dưới của nó không thể tốt hơn nghiệm tốt nhất đã có — chính xác, nhưng xấu nhất vẫn là hàm mũ.",
      description:
        "Branch & Bound chia bài toán thành các bài con (**branch**) bằng cách ra từng quyết định, và với mỗi nút tính một **cận** (bound): cận dưới của chi phí của MỌI nghiệm hoàn chỉnh sinh ra từ nút đó (khi tối thiểu hoá). Nếu cận đó đã không tốt hơn nghiệm tốt nhất hiện có (`lb >= best`) thì cả nhánh bị **cắt** mà không cần duyệt.\n\n" +
        "Khác các mục còn lại của nhóm, đây là thuật toán **CHÍNH XÁC** (không phải heuristic): nếu cận thật sự là cận dưới thì kết quả đúng tối ưu. Giá phải trả là thời gian **hàm mũ ở trường hợp xấu nhất** — mọi thứ phụ thuộc vào **độ chặt của cận** và **thứ tự duyệt** (nhánh hứa hẹn trước để sớm có nghiệm tốt làm ngưỡng cắt). Cận phổ biến: nới lỏng phân số (knapsack), tổng cạnh nhỏ nhất còn lại (TSP), nới lỏng tuyến tính (ILP).\n\n" +
        "Dùng khi cần nghiệm **tối ưu bảo đảm** cho bài NP-khó cỡ vừa (N khoảng vài chục) mà DP theo trạng thái không khả thi nhưng có cận rẻ và chặt, hoặc làm bộ giải ở thi đấu khi test không phải trường hợp xấu nhất. Có thể dừng sớm: giữ nghiệm tốt nhất và khoảng cách tới cận để biết nghiệm cách tối ưu tối đa bao nhiêu.",
      conditions: ["Có cách chia nhánh liệt kê mọi nghiệm (cây quyết định)", "Có hàm cận dưới ĐÚNG (không bao giờ lớn hơn chi phí thật) và đủ chặt để cắt nhiều", "Chấp nhận thời gian hàm mũ ở trường hợp xấu nhất"],
      complexity: { time: "O(b^d) trường hợp xấu nhất", space: "O(d) cho DFS", note: "b = số nhánh mỗi nút, d = độ sâu. Thời gian thật phụ thuộc độ chặt của cận. Best-first cần bộ nhớ lớn hơn nhưng thăm ít nút hơn DFS." },
      ops: [["Một nút (tính cận + chia nhánh)", "O(T_cận + b)"], ["Toàn bộ thuật toán (xấu nhất)", "O(b^d)"], ["Bộ nhớ (DFS)", "O(d)"]],
      use_case: ["Knapsack 0/1 trọng số lớn (DP theo trọng số không dùng được) với cận nới lỏng phân số", "TSP / phân công cỡ nhỏ-vừa cần nghiệm tối ưu thật sự", "Bộ giải của lập trình nguyên (ILP) và bài tổ hợp: cận từ nới lỏng tuyến tính", "Làm bộ kiểm chứng tối ưu để đánh giá chất lượng nghiệm heuristic trên bài nhỏ"],
      not_for: ["N lớn, cận lỏng → Simulated Annealing / Tabu / GA (chấp nhận không tối ưu)", "Bài có cấu trúc DP rõ ràng (knapsack trọng số nhỏ, bitmask nhỏ) → DP đúng thời gian đa thức/giả đa thức", "Không tìm được cận rẻ và chặt → vét cạn có cắt tỉa không hơn gì Backtracking"],
      pitfalls: [
        "Cận KHÔNG phải cận dưới thật (lớn hơn chi phí tối ưu của nhánh) làm cắt nhầm nghiệm tối ưu mà không báo lỗi — kiểm chứng cận trên bài nhỏ so với vét cạn.",
        "Cắt khi lb >= best sẽ bỏ qua nghiệm bằng nhau; nếu cần mọi nghiệm tối ưu thì dùng lb > best. Với chi phí thực dùng sai số nhỏ (epsilon).",
        "Thứ tự duyệt kém (nhánh tệ trước) làm lâu mới có ngưỡng cắt tốt; sắp con theo cận tăng dần.",
        "Đệ quy DFS quá sâu (độ sâu cỡ 10^5) tràn stack; dùng vòng lặp với stack tường minh hoặc best-first với hàng đợi ưu tiên.",
        "Cận tính lại từ đầu mỗi nút là O(N): cập nhật cận theo từng quyết định (incremental) để mỗi nút chỉ tốn O(1) hoặc O(log N)."
      ],
      code: {
        lang: "cpp", title: "branch_and_bound.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Branch & Bound (nhánh cận) — TỐI THIỂU hoá, duyệt DFS. THUẬT TOÁN CHÍNH XÁC nếu lowerBound đúng là cận dưới.
//   lowerBound(s)  cận dưới của chi phí MỌI nghiệm hoàn chỉnh sinh ra từ s; với nghiệm hoàn chỉnh = chi phí thật. Càng chặt càng cắt nhiều.
//   complete(s)    s đã là nghiệm hoàn chỉnh?
//   children(s)    các trạng thái con (chia nhánh)
// Cắt nhánh khi lowerBound >= best - eps (chỉ quan tâm nghiệm TỐT HƠN HẲN). Duyệt con theo cận tăng dần để sớm có ngưỡng tốt.
// Trường hợp xấu nhất O(b^d). Cẩn thận đệ quy sâu. State cần mặc định khởi tạo được.
template <class State>
struct BranchAndBound {
    function<double(const State&)> lowerBound;
    function<bool(const State&)> complete;
    function<vector<State>(const State&)> children;
    double eps = 1e-9;
    double best = numeric_limits<double>::infinity();
    State bestState{};
    long long nodes = 0;   // số nút đã thăm (để so với vét cạn)

    void dfs(const State& s, double lb) {
        nodes++;
        if (complete(s)) {
            if (lb < best - eps) { best = lb; bestState = s; }
            return;
        }
        vector<pair<double, State>> kids;
        for (auto& c : children(s)) kids.push_back({lowerBound(c), c});
        sort(kids.begin(), kids.end(), [](const auto& a, const auto& b) { return a.first < b.first; });
        for (auto& k : kids)
            if (k.first < best - eps) dfs(k.second, k.first);   // best có thể đã giảm trong lúc duyệt các con trước
    }
    // true nếu tìm được nghiệm hoàn chỉnh; kết quả ở best, bestState
    bool solve(const State& root) {
        best = numeric_limits<double>::infinity();
        nodes = 0;
        dfs(root, lowerBound(root));
        return best < numeric_limits<double>::infinity();
    }
};
`
      },
      example: {
        input: "Knapsack 0/1, sức chứa 10. Đồ vật (trọng lượng, giá trị): (5, 10), (4, 40), (6, 30), (3, 50).\nTối đa hoá tổng giá trị (cài như tối thiểu hoá -giá trị); cận trên giá trị = nới lỏng phân số (cho phép lấy một phần đồ vật cuối); duyệt đồ vật theo giá trị/trọng lượng giảm dần: (3,50), (4,40), (6,30), (5,10).",
        output: "90 (lấy hai đồ vật (3, 50) và (4, 40))",
        explain: "Nhánh \"lấy, lấy\" cho ngay nghiệm 90 (trọng lượng 7; (6,30) và (5,10) đều không vừa). Cận của gốc là 90 + 3/6·30 = 105. Nhánh \"bỏ (3,50)\" có cận trên 40 + 30 = 70 ≤ 90 nên bị cắt cả nhánh. Các nhánh còn lại cũng có cận ≤ 90 nên bị cắt: kết quả 90 là tối ưu mà không phải duyệt hết 16 tổ hợp."
      },
      problems: [],
      related: ["simulated-annealing", "tabu-search", "hill-climbing", "genetic-algorithm", "backtracking", "bitmask-dp"],
      compare: { "Loại": "Chính xác (vét cạn có cắt tỉa)", "Bảo đảm tối ưu": "Có (nếu cận đúng)", "Tham số cần chỉnh": "Độ chặt của cận, thứ tự duyệt", "Bộ nhớ": "Ít (DFS)" },
      cards: [
        { q: "Branch & Bound có phải heuristic không?", a: "Không. Nó chính xác: nếu cận đúng là cận dưới thì luôn trả về nghiệm tối ưu. Giá phải trả là thời gian hàm mũ ở trường hợp xấu nhất." },
        { q: "Điều kiện cắt nhánh khi tối thiểu hoá?", a: "lowerBound(nút) >= best (nghiệm tốt nhất hiện có): không nghiệm nào trong nhánh có thể tốt hơn hẳn. Dùng epsilon cho số thực." },
        { q: "Điều gì quyết định B&B nhanh hay chậm?", a: "Độ chặt của cận và thứ tự duyệt: nhánh hứa hẹn trước để sớm có ngưỡng tốt. Cận lỏng thì không cắt được gì, B&B không hơn gì vét cạn." },
        { q: "Cận dưới sai (lớn hơn giá trị thật) gây hậu quả gì?", a: "Cắt nhầm nhánh chứa nghiệm tối ưu mà không có cảnh báo nào, kết quả không còn tối ưu." }
      ]
    }
  ]);

  // ------------------------------------------------------------------------------------------------ kịch bản Quiz
  A.lib.scenarios([
    { id: "q-hill-climbing-1",
      prompt: "Mỗi test cho 50 ms để cải thiện một lộ trình xếp 300 đơn hàng đã có sẵn từ bước tham lam. Việc đổi chỗ hai đơn hàng cập nhật chi phí trong O(1). Địa hình gần như không có cực trị cục bộ sâu và bạn không có thời gian chỉnh nhiều tham số.",
      answer: ["hill-climbing"], also: ["simulated-annealing"],
      wrong: ["genetic-algorithm", "branch-and-bound", "bitmask-dp", "backtracking"],
      why: "Địa hình đơn giản, ngân sách cực ngắn và cần ít tham số → Hill Climbing (SA cũng được nhưng phải chỉnh nhiệt độ). GA tốn nhiều lần đánh giá cho một quần thể; Branch & Bound, bitmask DP và Backtracking tìm nghiệm chính xác nên không kịp với 300 đơn hàng.",
      level: 1 },
    { id: "q-simulated-annealing-1",
      prompt: "TSP với N = 1000 điểm trên mặt phẳng, 2 giây, cần chu trình càng ngắn càng tốt (không cần tối ưu tuyệt đối). Nghiệm đầu lấy từ láng giềng gần nhất; đảo một đoạn (2-opt) cập nhật độ dài trong O(1); các thử nghiệm cho thấy leo đồi thường kẹt ở cực trị cục bộ.",
      answer: ["simulated-annealing"], also: ["tabu-search"],
      wrong: ["branch-and-bound", "bitmask-dp", "backtracking", "hill-climbing"],
      why: "Nhiều cực trị cục bộ, N lớn và có giới hạn thời gian → SA (nhận nước xấu theo xác suất, thoát cực trị cục bộ). Hill Climbing kẹt; Branch & Bound, bitmask DP (N ≤ ~20) và Backtracking không chạy nổi với N = 1000.",
      level: 2 },
    { id: "q-simulated-annealing-2",
      prompt: "Bạn đã cài Hill Climbing cho bài xếp thời khoá biểu và nó luôn dừng ở các nghiệm cùng kém như nhau dù đổi hạt giống. Bạn còn dư thời gian chạy (khoảng 10 giây) và muốn thuật toán chịu đi qua nghiệm tệ hơn tạm thời nhưng vẫn chỉ cần sửa thêm vài dòng so với Hill Climbing.",
      answer: ["simulated-annealing"], also: ["tabu-search"],
      wrong: ["branch-and-bound", "beam-search", "bitmask-dp", "dsu"],
      why: "Chỉ cần thêm quy tắc nhận nước xấu với xác suất exp(-delta/T) và lịch làm nguội là biến Hill Climbing thành SA. Tabu cũng thoát được nhưng phải liệt kê toàn bộ láng giềng và thiết kế danh sách cấm. Branch & Bound là thuật toán chính xác, Beam Search xây nghiệm từng bước chứ không sửa nghiệm có sẵn.",
      level: 2 },
    { id: "q-genetic-algorithm-1",
      prompt: "Bạn cần tìm vector 50 tham số thực cho một chương trình mô phỏng. Hàm đánh giá là hộp đen mất 5 ms, chạy song song được trên 32 lõi. Hai bộ tham số tốt có thể trộn từng phần để ra bộ tham số mới hợp lý, và bạn có vài phút.",
      answer: ["genetic-algorithm"], also: ["simulated-annealing"],
      wrong: ["branch-and-bound", "hill-climbing", "bitmask-dp", "binary-search"],
      why: "Hộp đen, đánh giá song song được và trộn hai nghiệm có nghĩa → GA (quần thể, lai ghép, đột biến). Branch & Bound cần cận dưới trong khi hàm là hộp đen; Hill Climbing chỉ giữ một nghiệm nên không tận dụng song song và dễ kẹt; bitmask DP và tìm kiếm nhị phân không áp dụng cho 50 tham số thực.",
      level: 3 },
    { id: "q-grasp-1",
      prompt: "Bài phủ tập: chọn ít tập con nhất để phủ hết các phần tử, N = 2000 phần tử. Có sẵn thuật toán tham lam (mỗi bước chọn tập phủ thêm nhiều phần tử mới nhất) nhưng nó luôn trả về đúng một nghiệm. Bạn muốn sinh nhiều nghiệm xuất phát đa dạng, mỗi nghiệm sau đó được cải thiện bằng tìm kiếm cục bộ, lặp tới hết giờ.",
      answer: ["grasp"], also: [],
      wrong: ["genetic-algorithm", "branch-and-bound", "beam-search", "bitmask-dp"],
      why: "Xây dựng tham lam có ngẫu nhiên hoá (chọn trong RCL) + tìm kiếm cục bộ lặp nhiều vòng chính là GRASP. GA cần quần thể và toán tử lai ghép; Branch & Bound tìm nghiệm chính xác nên không kịp với N = 2000; Beam Search giữ nhiều trạng thái dở dang chứ không lặp độc lập; bitmask DP không áp dụng được với 2000 phần tử.",
      level: 3 },
    { id: "q-beam-search-1",
      prompt: "Bài thi kiểu AtCoder Heuristic Contest: dựng lời giải qua 100 bước, mỗi bước chọn một trong khoảng 50 nước đi. Có một hàm điểm khá đáng tin cho trạng thái dở dang. Tham lam (chọn nước tốt nhất mỗi bước) cho kết quả kém, vét cạn 50^100 là không thể, bạn có 2 giây.",
      answer: ["beam-search"], also: [],
      wrong: ["branch-and-bound", "hill-climbing", "bitmask-dp", "backtracking"],
      why: "Nghiệm dựng từng bước và có hàm điểm cho trạng thái dở dang → Beam Search, giữ B trạng thái tốt nhất mỗi tầng, nằm giữa tham lam (B = 1) và vét cạn. Branch & Bound và Backtracking cần duyệt cây 50^100; bitmask DP không có trạng thái nhỏ; Hill Climbing cần một nghiệm hoàn chỉnh để sửa, không dựng từng bước.",
      level: 3 },
    { id: "q-tabu-search-1",
      prompt: "Bài phân công 60 công việc cho 8 nhân viên. Láng giềng là chuyển một công việc sang nhân viên khác (60 × 7 nước, mỗi nước đánh giá delta O(1)). Hill Climbing kẹt sớm, còn bản SA bạn thử đôi khi quay lại đúng cấu hình cũ nhiều lần. Bạn muốn thuật toán xác định: quét hết láng giềng, đi nước tốt nhất kể cả khi tệ hơn và cấm việc quay lại trong ít vòng.",
      answer: ["tabu-search"], also: [],
      wrong: ["hill-climbing", "genetic-algorithm", "grasp", "branch-and-bound"],
      why: "Quét toàn bộ láng giềng nhỏ, đi nước tốt nhất chưa bị cấm (kể cả xấu hơn) và dùng danh sách cấm ngắn hạn là Tabu Search. Hill Climbing không bao giờ nhận nước xấu; GA và GRASP không có cơ chế cấm quay lại; Branch & Bound chính xác nên quá chậm cho 60 công việc.",
      level: 3 },
    { id: "q-branch-and-bound-1",
      prompt: "Cần nghiệm TỐI ƯU CHÍNH XÁC (không chấp nhận xấp xỉ) cho một bài tối thiểu hoá NP-khó cỡ N = 30. DP theo trạng thái không khả thi. Có một hàm cận dưới rẻ và khá chặt cho mọi nghiệm sinh ra từ một nhánh dở dang, và các test thực tế (không phải trường hợp xấu nhất) thường cắt được phần lớn cây tìm kiếm.",
      answer: ["branch-and-bound"], also: [],
      wrong: ["simulated-annealing", "genetic-algorithm", "hill-climbing", "bitmask-dp"],
      why: "Cần tối ưu bảo đảm, có cận dưới chặt để cắt nhánh → Branch & Bound. SA, GA và Hill Climbing là heuristic, không bảo đảm tối ưu; bitmask DP bị loại vì đề nói DP theo trạng thái không khả thi (2^30 trạng thái).",
      level: 3 }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
