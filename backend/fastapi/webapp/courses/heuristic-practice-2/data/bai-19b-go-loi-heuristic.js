/* Thực hành — Bài 19B: Gỡ lỗi lời giải heuristic (khi chương trình chạy nhưng điểm sai). */

/* ---------------------------------------------------------------------------------------------
   Bài toán b19b-nhieu-tui: NHIỀU case cái túi 0/1 trong một lần chạy, điểm cộng dồn (như đề thi thật).
   stdin : T / T case, mỗi case "n B" rồi n dòng "w p"
   stdout: mỗi case một dòng "k i1 … ik" (chỉ số từ 1)
   `dao: true` đảo thứ tự các case — cùng một tập case, để người học tự thấy tổng điểm đổi khi có trạng thái sót lại (§4.3).
   --------------------------------------------------------------------------------------------- */
(function () {
  function thuTuTiSo(cs) {
    var o = [], i;
    for (i = 0; i < cs.n; i++) o.push(i);
    return o.sort(function (a, b) { return cs.p[b] * cs.w[a] - cs.p[a] * cs.w[b] || a - b; });
  }
  function thuTuGiaTri(cs) {
    var o = [], i;
    for (i = 0; i < cs.n; i++) o.push(i);
    return o.sort(function (a, b) { return cs.p[b] - cs.p[a] || a - b; });
  }
  function chonTheo(cs, thuTu) {
    var con = cs.B, ds = [];
    thuTu.forEach(function (i) { if (cs.w[i] <= con) { con -= cs.w[i]; ds.push(i + 1); } });
    return ds.length + " " + ds.join(" ");
  }

  TH.vande.dangKy("b19b-nhieu-tui", {
    tot: "cao",
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TH.tienIch.rng(seed), T = tham.T || 6, n = tham.n || 24, cs = [];
      for (var c = 0; c < T; c++) {
        var w = [], p = [], s = 0, mx = 0;
        for (var i = 0; i < n; i++) {
          var wi = r.khoang(5, 60);
          w.push(wi); p.push(r.khoang(5, 100)); s += wi; if (wi > mx) mx = wi;
        }
        cs.push({ n: n, B: Math.max(mx, Math.floor(s * 0.35)), w: w, p: p });
      }
      if (tham.dao) cs.reverse();
      return { T: T, cases: cs };
    },
    viet: function (inst) {
      var s = inst.T + "\n";
      inst.cases.forEach(function (cs) {
        s += cs.n + " " + cs.B + "\n";
        for (var i = 0; i < cs.n; i++) s += cs.w[i] + " " + cs.p[i] + "\n";
      });
      return s;
    },
    cham: function (inst, text) {
      var d = TH.vande.docNguyen(text);
      if (!d.ok) return { ok: false, diem: 0, loi: d.loi };
      var t = d.so, vt = 0, tong = 0;
      if (!t.length) return { ok: false, diem: 0, loi: "Chưa in gì. Mỗi case in một dòng: k rồi k chỉ số." };
      for (var c = 0; c < inst.T; c++) {
        var cs = inst.cases[c], ten = "Case " + (c + 1) + ": ";
        if (vt >= t.length) return { ok: false, diem: 0, loi: ten + "thiếu kết quả (chỉ có " + c + " case được in)." };
        var k = t[vt++];
        if (k < 0 || k > cs.n) return { ok: false, diem: 0, loi: ten + "k = " + k + " không nằm trong [0, " + cs.n + "]." };
        if (vt + k > t.length) return { ok: false, diem: 0, loi: ten + "k = " + k + " nhưng không đủ " + k + " chỉ số theo sau." };
        var seen = {}, W = 0, P = 0;
        for (var j = 0; j < k; j++) {
          var id = t[vt++];
          if (id < 1 || id > cs.n) return { ok: false, diem: 0, loi: ten + "chỉ số " + id + " ngoài khoảng [1, " + cs.n + "]." };
          if (seen[id]) return { ok: false, diem: 0, loi: ten + "món " + id + " được chọn hai lần." };
          seen[id] = 1; W += cs.w[id - 1]; P += cs.p[id - 1];
        }
        if (W > cs.B) return { ok: false, diem: 0, loi: ten + "tổng khối lượng " + W + " vượt sức chứa " + cs.B + "." };
        tong += P;
      }
      if (vt !== t.length) return { ok: false, diem: 0, loi: "Dư " + (t.length - vt) + " số sau case cuối (" + inst.T + ")." };
      return { ok: true, diem: tong, chiTiet: { soCase: inst.T } };
    },
    dinhDang: {
      vao: "Dòng 1: `T` — số case. Rồi `T` case: mỗi case một dòng `n B` (số món, sức chứa) và `n` dòng `w p` (khối lượng, giá trị của món `i`, đánh số từ 1).",
      ra: "Mỗi case một dòng: `k` rồi `k` chỉ số (từ 1), cách nhau khoảng trắng; `k = 0` thì chỉ in `0`. Tổng khối lượng mỗi case không được vượt `B`. Điểm của test là **tổng giá trị mọi case**; một case sai là cả test không hợp lệ."
    },
    thamChieu: {
      giaTri: function (inst) { return inst.cases.map(function (cs) { return chonTheo(cs, thuTuGiaTri(cs)); }).join("\n") + "\n"; },
      tiSo: function (inst) { return inst.cases.map(function (cs) { return chonTheo(cs, thuTuTiSo(cs)); }).join("\n") + "\n"; }
    }
  });
})();

TH.dangKy({
  id: "bai-19b-go-loi-heuristic",

  tomTat: [
    "Trong heuristic, bug không kêu: nó chỉ làm **điểm thấp hơn** và trông y hệt “thuật toán chưa đủ tốt”. Ví dụ thật: hàm `int move()` thiếu `return` làm `-O2` xoá luôn vòng lặp di chuyển, điểm 7 369 thay vì 151 123 — đúng điểm của một `process()` rỗng.",
    "Bốn triệu chứng, bốn nhóm nguyên nhân: **A** điểm thấp, không vi phạm, đúng giờ (điểm tưởng ≠ điểm thật, UB, hoặc thuật toán yếu); **B** có vi phạm (mô phỏng nội bộ lệch grader); **C** vượt giờ ở một số test (độ phức tạp ẩn); **D** chạy lại ra điểm khác (trạng thái sót lại, RNG không reset).",
    "**Bất biến + `KIEM`**: bảo toàn, nhất quán, đơn điệu — đặt ngay sau mỗi nước đi, ở ranh giới pha và trước khi trả về. `KIEM` phải **biến mất** ở bản nộp (`-DGO_LOI`) và phải **đo lại thời gian** sau khi tắt, vì bất biến O(H·W) gọi mỗi nước đi là tự sát.",
    "Bộ kiểm tra hợp lệ phải **độc lập**: đọc trạng thái qua API của grader (`getCell`, `getMoveCount`), không dùng lại mã mô phỏng của chính mình — nó sẽ đồng ý với chính nó. Grader tăng bộ đếm nước đi **trước** khi kiểm hợp lệ nên nước hỏng vẫn mất lượt; đừng tự đếm.",
    "Đối chiếu vét cạn ở n = 5…8 kiểm **hạ tầng**, không kiểm chất lượng thuật toán. Ba điều phải khớp: điểm solver ≤ vét cạn; **điểm tự tính = điểm grader** (dòng bắt nhiều bug nhất); tài nguyên dùng = grader báo.",
    "Chạy xuôi rồi ngược thứ tự seed: tổng khác nhau (S1 ≠ S2) nghĩa là có **trạng thái sống sót** giữa các test — `static` không reset, bộ đệm không xoá, hạt giống RNG không đặt lại.",
    "Với triệu chứng C: quét 1 000 seed, in **seed xấu nhất** và **thời gian xấu nhất**, rồi thu nhỏ test. Ở đề 2609, xấu nhất là H = 178, W = 180, N = 15 905 (mật độ ≈ 0,5) cho 3 331 ms trong khi trung bình chỉ 619 ms.",
    "Bắt UB bằng cách **so hai mức tối ưu**: build `-O0` và `-O2` rồi `diff` — khác nhau là gần như chắc chắn có UB. Quy trình 20 phút gồm 6 bước (2 + 2 + 5 + 3 + 5 + 3); chạy hết mà sạch thì bạn mới được quyền tin thuật toán yếu, vì điểm thấp là một triệu chứng, không phải một chẩn đoán."
  ],

  trac: [
    {
      id: "q1", loai: "mot", doKho: 1, ref: "Bài này nói về chuyện gì",
      hoi: "Một lời giải được 7 369 điểm trong khi lời giải tham khảo được 151 123; không crash, không cảnh báo, không vi phạm. Nguyên nhân thật trong câu chuyện của bài là gì?",
      chon: [
        "Nhiệt độ simulated annealing đặt sai nên thuật toán hội tụ quá sớm",
        "Điểm tích luỹ bị tràn `int` nên quay vòng thành một số nhỏ",
        "Hàm `int move()` thiếu `return`: ở `-O2` trình biên dịch coi nhánh đó không bao giờ tới và xoá vòng lặp di chuyển, nên điểm là điểm của một `process()` rỗng",
        "Bộ chấm cục bộ tính điểm sai so với grader thật"
      ],
      dung: 2,
      giaiThich: "Rơi khỏi cuối hàm non-`void` là hành vi không xác định; ở `-O2` trình biên dịch suy ra nhánh đó không thể xảy ra và xoá cả vòng lặp di chuyển, nên chương trình chạy êm mà không di chuyển hạt nào. 7 369 đúng bằng điểm của hàm rỗng. Chỉnh nhiệt độ SA hay nghi bộ chấm sẽ chỉ cho điểm kém dần hoặc lệch, không ra đúng con số đó — và đây là loại bug bị nhầm thành “thuật toán yếu”."
    },
    {
      id: "q2", loai: "mot", doKho: 2, ref: "§6",
      hoi: "Bạn build cùng một `solution.cpp` ở `-O0` và `-O2`, chạy 200 test rồi `diff` kết quả: hai tệp khác nhau. Kết luận hợp lý nhất là gì?",
      chon: [
        "Gần như chắc chắn mã có hành vi không xác định (UB): trình biên dịch đã tận dụng một giả định mà mã của bạn vi phạm",
        "Bình thường: `-O2` luôn cho kết quả tốt hơn `-O0` nên hai tệp khác nhau là đúng",
        "Thuật toán còn yếu nên cần tăng số vòng lặp",
        "Bộ chấm cục bộ có bug và phải viết lại"
      ],
      dung: 0,
      giaiThich: "Chương trình không có UB cho kết quả giống hệt ở mọi mức tối ưu (trừ khi dùng `double` phụ thuộc thứ tự phép toán). Khác nhau nghĩa là mã đã vi phạm một giả định mà trình biên dịch dựa vào, ví dụ hàm thiếu `return`. Mức tối ưu không được phép đổi **kết quả** của chương trình hợp lệ; nó cũng không liên quan đến độ mạnh của thuật toán hay độ tin cậy của bộ chấm."
    },
    {
      id: "q3", loai: "mot", doKho: 2, ref: "§1 (triệu chứng D), §4.3",
      hoi: "Ví dụ: bạn chạy cùng 10 seed hai lần — xuôi 1…10 được tổng 1 204 300, ngược 10…1 được tổng 1 198 760. Đây là triệu chứng nào, và nên nghi điều gì nhất?",
      chon: [
        "Triệu chứng C: có độ phức tạp ẩn phụ thuộc dữ liệu",
        "Triệu chứng D: có trạng thái sống sót giữa các test, như biến `static` không reset hoặc hạt giống RNG không đặt lại",
        "Triệu chứng B: mô phỏng nội bộ lệch khỏi grader",
        "Không có gì đáng ngờ: tổng điểm luôn dao động vài phần nghìn giữa các lần chạy"
      ],
      dung: 1,
      giaiThich: "Cùng tập test mà đảo thứ tự cho tổng khác nhau nghĩa là kết quả của một test phụ thuộc vào các test chạy trước nó — trạng thái sót lại (triệu chứng D). Thủ phạm quen mặt là `static` không reset, bộ đệm không xoá và hạt giống RNG không đặt lại. Nó không phải triệu chứng C (thời gian) hay B (vi phạm ràng buộc), và một thuật toán tất định đúng đắn thì S1 phải bằng S2 chứ không được “dao động”."
    },
    {
      id: "q4", loai: "mot", doKho: 2, ref: "§3.3",
      hoi: "Grader của đề có hàm sau. Solver của bạn tự đếm “số nước đi thành công” và tin rằng mình còn dư ngân sách, nhưng grader báo đã hết lượt.\n\n```cpp\nint moveParticle(int y, int x, int dir) {\n    if (sMoveCount >= sMoveLimit) return 0;\n    sMoveCount++;\n    if (/* nước đi không hợp lệ */) return 0;\n    /* ... */\n}\n```\nVì sao, và nên làm gì?",
      chon: [
        "Grader đếm sai; hãy báo ban tổ chức",
        "Solver nên cộng thêm hệ số an toàn 10 % vào bộ đếm của mình và dừng sớm",
        "Chỉ là sai số làm tròn nên có thể bỏ qua",
        "Grader tăng `sMoveCount` trước khi kiểm tra hợp lệ nên nước đi hỏng vẫn mất một lượt; hãy gọi `getMoveCount()` của grader thay vì tự đếm"
      ],
      dung: 3,
      giaiThich: "Bộ đếm của grader tăng trước mọi kiểm tra hợp lệ, nên nước đi bị từ chối vẫn tiêu một lượt; solver chỉ đếm nước thành công sẽ luôn tưởng còn dư. Bất biến đáng giá nhất của bài là “bộ đếm của tôi = bộ đếm của grader”, và cách duy nhất đúng là hỏi grader. Cộng hệ số an toàn thì chỉ che triệu chứng; còn không có lỗi của ban tổ chức hay sai số làm tròn nào ở đây."
    },
    {
      id: "q5", loai: "mot", doKho: 2, ref: "§4.2, §7",
      hoi: "Solver in ra “điểm dự kiến 160 000” nhưng grader chấm 120 000. Không crash, không vi phạm, đúng giờ. Bước nào của quy trình chẩn đoán 20 phút bắt thẳng lỗi này?",
      chon: [
        "Bước ①: build `-O0` và `-O2` rồi `diff` kết quả",
        "Bước ④: đối chiếu điểm solver tự tính với điểm grader chấm, ở từng test",
        "Bước ②: chạy xuôi / ngược thứ tự seed rồi so tổng",
        "Bước ⑥: in seed và thời gian xấu nhất"
      ],
      dung: 1,
      giaiThich: "Điểm tự tính ≠ điểm grader chấm là dấu hiệu của bản sao trạng thái lệch hoặc lỗi trôi delta; so hai con số này ở mỗi test là dòng bắt nhiều bug nhất (§4.2). `diff` -O0/-O2 chỉ bắt UB, chạy xuôi/ngược chỉ bắt trạng thái sót lại, còn bước ⑥ chỉ bắt TLE ẩn. Con số 160 000 là hư cấu và mọi quyết định dựa trên nó đều sai."
    },
    {
      id: "q6", loai: "nhieu", doKho: 2, ref: "§6.2",
      hoi: "Theo danh sách UB hay gặp trong mã heuristic của bài, những tình huống nào là **hành vi không xác định**?",
      chon: [
        "Hàm `int` có một nhánh kết thúc mà không `return`",
        "Đọc `dx[dir]` khi `dir = 4` nhưng mảng `dx` chỉ có chỉ số 0…3",
        "Cộng điểm tích luỹ vào `int` vượt quá 2,1 tỉ",
        "Đọc phần tử `static int buf[100]` khi chưa gán giá trị",
        "Đệ quy quá sâu làm tràn stack 1 MB"
      ],
      dung: [0, 1, 2],
      giaiThich: "Hàm non-`void` thiếu `return`, truy cập ngoài mảng và tràn số nguyên có dấu đều nằm trong danh sách UB của bài. Mảng `static` được khởi tạo bằng 0 nên đọc nó là an toàn (biến cục bộ chưa khởi tạo mới là UB). Đệ quy quá sâu thì bài xếp là “không phải UB nhưng chết y hệt” — vì tràn stack, chứ không vì trình biên dịch tận dụng giả định sai."
    },
    {
      id: "q7", loai: "mot", doKho: 2, ref: "§2.2, §9 (cạm bẫy 2)",
      hoi: "Bất biến “tổng số hạt không đổi” tốn O(H·W). Bạn gọi `KIEM` ở mỗi nước đi và bản nộp bị quá giờ. Cách xử lý đúng theo bài là gì?",
      chon: [
        "Định nghĩa `KIEM(dk)` thành `((void)0)` khi không có `-DGO_LOI` để nó biến mất khỏi bản nộp, rồi **đo lại thời gian** sau khi tắt",
        "Giữ nguyên `KIEM` nhưng chỉ gọi mỗi 1 000 nước đi cho nhẹ bớt",
        "Dùng `<cassert>` thay macro vì nó chuẩn hơn",
        "Xoá hẳn bất biến khỏi mã nguồn vì đã thấy nó đúng một lần"
      ],
      dung: 0,
      giaiThich: "`KIEM` chỉ dùng lúc phát triển: bật bằng `-DGO_LOI`, còn bản nộp phải biến mất hoàn toàn (`((void)0)`) và bạn phải đo lại thời gian sau khi tắt. `<cassert>` không dùng được vì đề cấm `#include`. Gọi thưa hơn vẫn để lại chi phí trong bản nộp và làm bất biến mất khả năng bắt bug đúng bước gây ra; xoá hẳn thì mất lớp bảo vệ cho các lần chỉnh sửa sau."
    },
    {
      id: "q8", loai: "so", doKho: 2, ref: "§5", donVi: "(lần)",
      hoi: "Quét 3 000 seed cho kết quả: thời gian trung bình 619 ms, xấu nhất 3 331 ms. Thời gian xấu nhất gấp bao nhiêu lần trung bình? (làm tròn một chữ số thập phân)",
      dapAn: 5.4, saiSo: 0.05,
      giaiThich: "3 331 / 619 ≈ 5,38, làm tròn 5,4 lần. Trung bình 619 ms trông an toàn; chỉ có số xấu nhất (lưới gần vuông H = 178, W = 180 với mật độ gần 0,5, N = 15 905, nút thắt ở đoạn O(N²)) mới lộ ra việc trượt giới hạn. Vì vậy phải cho bộ chấm in luôn seed xấu nhất và thời gian xấu nhất, không chỉ trung bình."
    }
  ],

  luan: [
    {
      id: "l1", doKho: 2, ref: "§1, §7",
      hoi: "Phân loại mỗi tình huống dưới đây vào triệu chứng A, B, C hay D của §1, nêu nhóm nguyên nhân bạn nghi nhất và **kỹ thuật đầu tiên** bạn sẽ chạy:\n\n1. Solver in “điểm dự kiến 160 000” nhưng grader chấm 120 000; không crash, không vi phạm, đúng giờ.\n2. Ở test 37 grader báo vi phạm: gọi `nextDay()` quá số lần cho phép, dù solver tin rằng mình đếm đúng.\n3. Quét 1 000 seed: 997 test chạy dưới 100 ms, ba test mất hơn 3 giây.\n4. Chạy cùng 10 seed hai lần, một lần xuôi một lần ngược thứ tự: tổng điểm khác nhau.",
      goiY: ["Mỗi triệu chứng đi thẳng tới một mục khác nhau của bài: A → §2, §3, §6; B → §3; C → §5; D → §4.3.", "Triệu chứng nguy hiểm nhất là cái nào, và vì sao?"],
      mau: "1. **A** (điểm thấp, hợp lệ, đúng giờ). Nhóm nghi nhất: điểm tưởng ≠ điểm thật (bản sao trạng thái lệch, trôi delta) hoặc UB. Kỹ thuật đầu tiên: bước ① `diff` kết quả `-O0` / `-O2` để loại UB (2 phút), rồi bước ④ đối chiếu điểm tự tính với điểm grader — dòng bắt nhiều bug nhất.\n2. **B** (có vi phạm). Nhóm: mô phỏng / bộ đếm nội bộ lệch khỏi grader — grader tăng bộ đếm trước khi kiểm hợp lệ nên nước hỏng vẫn tốn một lượt. Kỹ thuật (§3): bất biến “bộ đếm của tôi = `getMoveCount()` của grader” và bộ kiểm tra độc lập đọc trạng thái qua API grader.\n3. **C** (vượt giờ ở một số test). Nhóm: độ phức tạp ẩn phụ thuộc dữ liệu. Kỹ thuật (§5): in seed và thời gian xấu nhất, xem đặc điểm chung (kích thước, mật độ), thu nhỏ test tới khi hết hỏng, rồi in trạng thái.\n4. **D** (chạy lại ra điểm khác). Nhóm: trạng thái sót lại giữa các test — `static` không reset, bộ đệm không xoá, hạt giống RNG không đặt lại. Kỹ thuật (§4.3): chạy xuôi / ngược rồi so tổng (chính tình huống này); sửa bằng cách reset ở đầu mỗi test.\n\nA là nguy hiểm nhất vì *trông giống* “thuật toán chưa đủ tốt”; vì vậy loại trừ UB và điểm tưởng trước khi tin rằng thuật toán yếu.",
      tieuChi: [
        "Phân đúng bốn tình huống thành A, B, C, D",
        "Gắn mỗi triệu chứng với đúng nhóm nguyên nhân (điểm tưởng ≠ thật / mô phỏng lệch / độ phức tạp ẩn / trạng thái sót lại)",
        "Nêu kỹ thuật đầu tiên phù hợp cho từng tình huống (diff -O0/-O2 và đối chiếu điểm, bất biến đếm qua API grader, seed và thời gian xấu nhất, chạy xuôi/ngược)",
        "Nhận ra triệu chứng A nguy hiểm nhất vì trông giống “thuật toán yếu”"
      ]
    },
    {
      id: "l2", doKho: 2, ref: "§6, Bài tập 1",
      hoi: "Giải thích bằng lời: vì sao cùng một mã nguồn mà `-O0` cho “crash `ud2`” còn `-O2` cho “chạy êm, 0 nước đi, điểm 7 369”? Và cách rẻ nhất để biết trước điều này là gì?",
      goiY: ["Chuẩn C++ nói gì về việc rơi khỏi cuối hàm non-`void`?", "Nếu một nhánh là hành vi không xác định, trình biên dịch được giả định điều gì về việc nhánh ấy có xảy ra?"],
      mau: "Rơi khỏi cuối một hàm non-`void` là **hành vi không xác định** (UB): chuẩn C++ không quy định gì nên trình biên dịch được làm **bất cứ điều gì**. Theo bảng của bài, ở `-O0` nó chèn `ud2` nên chết ngay ở test đầu với *Illegal instruction*. Ở `-O2`, nó suy luận rằng một chương trình đúng không bao giờ đến nhánh đó, coi nhánh là **unreachable** và xoá luôn vòng lặp di chuyển phía trên; chương trình chạy êm, đúng giờ và không di chuyển hạt nào — điểm 7 369 chính là điểm của một `process()` rỗng. Hai hành vi trái ngược từ cùng một mã vì không có hành vi “đúng” nào để cả hai cùng tuân theo.\n\nCách rẻ nhất: (1) build `-O0` và `-O2` rồi `diff` kết quả — khác nhau là gần như chắc chắn có UB; (2) bật `-Wreturn-type` (cùng `-Wall -Wextra -Wshadow`) để trình biên dịch bắt đúng lỗi này **ngay lúc biên dịch**, miễn phí; (3) coi build sạch cảnh báo là điều kiện cần, không phải điều tốt nên có.",
      tieuChi: [
        "Nêu rơi khỏi cuối hàm non-void là hành vi không xác định nên trình biên dịch được làm bất cứ điều gì",
        "Giải thích `-O0` chèn `ud2` (crash) còn `-O2` coi nhánh là unreachable và xoá vòng lặp (0 nước đi)",
        "Nêu cách phát hiện: `diff` kết quả `-O0` / `-O2` và / hoặc `-Wreturn-type` lúc biên dịch",
        "Liên hệ được điểm 7 369 là điểm của `process()` rỗng — bug bị tưởng là thuật toán yếu"
      ]
    },
    {
      id: "l3", doKho: 3, ref: "§4.3, Bài tập 5",
      hoi: "Một solver dùng RNG với `static unsigned long long sSeed = 5;` khai báo một lần và không bao giờ đặt lại. Bạn chạy 10 test theo thứ tự xuôi rồi theo thứ tự ngược. (a) Điều gì xảy ra với tổng điểm hai lần chạy, và vì sao? (b) Vì sao điều này phá hỏng mọi thí nghiệm A/B ở Bài 4? (c) Cách sửa là gì?",
      goiY: ["Test thứ 50 nhận hạt giống từ đâu?", "Nhắc lại quy tắc: mỗi lần đo chỉ đổi một thứ, và chênh lệch chỉ đáng tin khi lớn hơn 2·SE."],
      mau: "(a) Mỗi test nhận hạt giống là **trạng thái cuối của test trước**, nên kết quả test thứ k phụ thuộc vào toàn bộ lịch sử k − 1 test đã chạy. Đảo thứ tự thì mỗi test nhận một dòng ngẫu nhiên khác, nên tổng S1 ≠ S2 (độ chênh cỡ nhiễu giữa các lần chạy; bạn sẽ thấy hiện tượng tương tự với biến `static` ở lab bên dưới). S1 ≠ S2 chính là dấu hiệu của **trạng thái sống sót** giữa các test — triệu chứng D.\n\n(b) Thí nghiệm A/B cần hai phiên bản chỉ khác nhau đúng một thay đổi. Nếu phiên bản B dùng RNG nhiều hơn hay ít hơn A thì mọi test về sau lệch dòng ngẫu nhiên, nên chênh lệch đo được trộn **nhiễu của dòng ngẫu nhiên** với tác động thật của thay đổi; không tách ra được, và so với 2·SE cũng không còn nghĩa. Test thứ 50 không tái lập được.\n\n(c) Đặt lại trạng thái ở **đầu mỗi test**: seed cố định theo chỉ số test (ví dụ `seed = baseSeed + testId`), reset mọi `static`, xoá mọi bộ đệm; rồi chạy lại xuôi / ngược để kiểm tra S1 = S2.",
      tieuChi: [
        "Nêu test k phụ thuộc lịch sử k − 1 test trước nên S1 ≠ S2 khi đảo thứ tự",
        "Nhận ra đó là triệu chứng D (trạng thái sót lại), không phải thuật toán yếu",
        "Giải thích vì sao A/B bị nhiễu: dòng ngẫu nhiên đổi theo lịch sử nên không tách được tác động thật",
        "Nêu cách sửa: đặt lại seed và mọi trạng thái ở đầu mỗi test, rồi kiểm lại bằng chạy xuôi / ngược"
      ]
    }
  ],

  lab: [
    {
      id: "tim-hai-loi-nhieu-case",
      ten: "Tìm hai lỗi im lặng trong bộ giải nhiều case",
      doKho: 3,
      ref: "§1, §2, §4.3, §7",
      de: "Bộ giải bên dưới xử lý **nhiều case trong một lần chạy** (như đề thi thật: điểm cộng dồn qua các test). Mỗi case là một cái túi 0/1 (`n = 24`); lời giải chuẩn là greedy theo tỉ số `p/w` giảm dần, món nào còn vừa thì lấy. Chương trình **chạy và in ra kết quả** nhưng bị chấm lỗi hoặc điểm thấp. Có **hai lỗi** ẩn trong mã — hãy tìm và sửa theo quy trình của bài, **không viết lại từ đầu**.\n\n" +
          "**Đầu vào:** `T`, rồi `T` case, mỗi case gồm `n B` và `n` dòng `w p`. **Đầu ra:** mỗi case một dòng `k i1 … ik` (chỉ số từ 1). Điểm test là tổng giá trị mọi case.\n\n" +
          "**Cách làm (§7):**\n\n" +
          "1. Đọc thông báo của bộ chấm: nó nói case nào hỏng và vì sao. Đó là triệu chứng B (vi phạm) hay A (điểm thấp)?\n" +
          "2. Thêm bất biến `KIEM` (§2): sau mỗi lần chọn món, `con` phải bằng `B` trừ tổng khối lượng các món đã chọn — **tính lại từ đầu**, không dùng chính biến `con`. Dùng `log()` (stderr, không bị chấm) để xem nó sai lần đầu ở đâu.\n" +
          "3. Khi đã hợp lệ mà điểm vẫn thấp, đừng vội kết luận greedy “yếu”: đổi sang biến thể **Đảo thứ tự case** (tab bên dưới). Cùng các case, chỉ khác thứ tự — tổng điểm có đổi không? (§4.3)\n" +
          "4. **Mỗi lần chỉ sửa một thứ** rồi chạy lại (§9, cạm bẫy 4): hai lỗi có thể che nhau.\n\n" +
          "**Mức đạt:** hợp lệ trên mọi test → đạt ít nhất 99 % điểm của greedy tỉ số đúng. **Suy ngẫm:** lỗi nào là triệu chứng B, lỗi nào là D? Bước nào của quy trình 20 phút bắt được từng lỗi?",
      vanDe: "b19b-nhieu-tui",
      tham: { T: 6, n: 24 },
      bienThe: [
        { ten: "Thứ tự xuôi", tham: { T: 6, n: 24 } },
        { ten: "Đảo thứ tự case (§4.3)", tham: { T: 6, n: 24, dao: true } }
      ],
      soTest: 10,
      gioiHanMs: 1000,
      muc: [
        { ten: "Đạt ≥ 99 % điểm của greedy tỉ số đúng", so: "tiSo", heSo: 0.99 }
      ],
      khoiDau: {
        js: String.raw`// Bộ giải nhiều case: mỗi case là một cái túi 0/1. Đầu vào: T, rồi T case ("n B" và n dòng "w p").
// Đầu ra: mỗi case một dòng "k i1 ... ik" (chỉ số từ 1). Chương trình CHẠY nhưng bị chấm lỗi / điểm thấp:
// có hai lỗi ẩn trong mã. Hãy tìm và sửa — theo quy trình ở Bài 19B.
const GO_LOI = true;                                     // bật khi gỡ lỗi, tắt trước khi nộp (§2.2)
function KIEM(dieuKien, loiNhan) { if (GO_LOI && !dieuKien) log("KIEM sai: " + loiNhan); }

const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let vt = 0;
const T = t[vt++];

let thuTu = null;            // thứ tự xét món (theo p/w giảm dần) — sắp một lần cho nhanh

for (let c = 0; c < T; c++) {
  const n = t[vt++], B = t[vt++];
  const w = [], p = [];
  for (let i = 0; i < n; i++) { w.push(t[vt++]); p.push(t[vt++]); }

  if (thuTu === null) {
    thuTu = w.map((_, i) => i).sort((a, b) => p[b] * w[a] - p[a] * w[b] || a - b);
  }

  const chon = [];
  let con = B;               // sức chứa còn lại
  for (let k = 0; k < n; k++) {
    const i = thuTu[k];
    if (w[i] <= con) { chon.push(i + 1); con -= w[k]; }
  }
  KIEM(con >= 0, "con âm ở case " + (c + 1));   // TODO: thêm bất biến đáng giá hơn (§2.1)
  print(chon.length + " " + chon.join(" "));
}
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

// Bộ giải nhiều case: mỗi case là một cái túi 0/1. Chương trình CHẠY nhưng bị chấm lỗi / điểm thấp:
// có hai lỗi ẩn trong mã. Hãy tìm và sửa — theo quy trình ở Bài 19B.
#define GO_LOI 1                       // bật khi gỡ lỗi, tắt trước khi nộp (§2.2)
#if GO_LOI
#define KIEM(dk, msg) do { if (!(dk)) fprintf(stderr, "KIEM sai: %s\n", msg); } while (0)
#else
#define KIEM(dk, msg) ((void)0)
#endif

static int thuTu[64];          // thứ tự xét món (theo p/w giảm dần) — sắp một lần cho nhanh
static bool daSap = false;

int main() {
    int T;
    scanf("%d", &T);
    for (int c = 0; c < T; c++) {
        int n, B;
        scanf("%d %d", &n, &B);
        vector<int> w(n), p(n);
        for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);

        if (!daSap) {
            for (int i = 0; i < n; i++) thuTu[i] = i;
            sort(thuTu, thuTu + n, [&](int a, int b) {
                long long l = (long long)p[a] * w[b], r = (long long)p[b] * w[a];
                if (l != r) return l > r;
                return a < b;
            });
            daSap = true;
        }

        vector<int> chon;
        int con = B;           // sức chứa còn lại
        for (int k = 0; k < n; k++) {
            int i = thuTu[k];
            if (w[i] <= con) { chon.push_back(i + 1); con -= w[k]; }
        }
        KIEM(con >= 0, "con am");     // TODO: thêm bất biến đáng giá hơn (§2.1)

        printf("%d", (int)chon.size());
        for (int id : chon) printf(" %d", id);
        printf("\n");
    }
    return 0;
}
`
      },
      loiGiai: {
        js: String.raw`const GO_LOI = true;
function KIEM(dieuKien, loiNhan) { if (GO_LOI && !dieuKien) log("KIEM sai: " + loiNhan); }

const t = readInput().split(/\s+/).filter(Boolean).map(Number);
let vt = 0;
const T = t[vt++];

for (let c = 0; c < T; c++) {
  const n = t[vt++], B = t[vt++];
  const w = [], p = [];
  for (let i = 0; i < n; i++) { w.push(t[vt++]); p.push(t[vt++]); }

  // Lỗi D (trạng thái sót lại): thứ tự phụ thuộc DỮ LIỆU của case này, nên phải sắp lại ở MỖI case.
  const thuTu = w.map((_, i) => i).sort((a, b) => p[b] * w[a] - p[a] * w[b] || a - b);

  const chon = [];
  let con = B;
  for (const i of thuTu) {                 // lỗi B: trừ w[i] (khối lượng của MÓN i), không phải w[k] (hạng k)
    if (w[i] <= con) { chon.push(i + 1); con -= w[i]; }
  }
  // Bất biến: sức chứa còn lại tính lại từ đầu phải khớp với biến con.
  KIEM(con === B - chon.reduce((s, id) => s + w[id - 1], 0), "con lệch ở case " + (c + 1));
  print(chon.length + " " + chon.join(" "));
}
`,
        cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

#define GO_LOI 0                       // bản nộp: KIEM biến mất hoàn toàn (§2.2)
#if GO_LOI
#define KIEM(dk, msg) do { if (!(dk)) fprintf(stderr, "KIEM sai: %s\n", msg); } while (0)
#else
#define KIEM(dk, msg) ((void)0)
#endif

int main() {
    int T;
    scanf("%d", &T);
    for (int c = 0; c < T; c++) {
        int n, B;
        scanf("%d %d", &n, &B);
        vector<int> w(n), p(n);
        for (int i = 0; i < n; i++) scanf("%d %d", &w[i], &p[i]);

        // Lỗi D (trạng thái sót lại): thứ tự phụ thuộc dữ liệu của case này nên phải sắp lại ở MỖI case.
        vector<int> thuTu(n);
        iota(thuTu.begin(), thuTu.end(), 0);
        sort(thuTu.begin(), thuTu.end(), [&](int a, int b) {
            long long l = (long long)p[a] * w[b], r = (long long)p[b] * w[a];
            if (l != r) return l > r;
            return a < b;
        });

        vector<int> chon;
        int con = B;
        for (int i : thuTu) {                   // lỗi B: trừ w[i] (khối lượng của MÓN i), không phải w[k]
            if (w[i] <= con) { chon.push_back(i + 1); con -= w[i]; }
        }
        int dung = B;
        for (int id : chon) dung -= w[id - 1];
        KIEM(con == dung, "con lech");

        printf("%d", (int)chon.size());
        for (int id : chon) printf(" %d", id);
        printf("\n");
    }
    return 0;
}
`
      },
      goiY: [
        "Bộ chấm cho biết case nào hỏng và vì sao. Thêm `KIEM(con === B - (tổng w của các món đã chọn tính lại từ đầu), …)` rồi nhìn `log` để thấy chỗ `con` bắt đầu lệch so với khối lượng thật.",
        "Một lỗi nằm ở dòng cập nhật `con`: nó trừ khối lượng của ai? Lỗi còn lại chỉ lộ ra khi đổi sang tab **Đảo thứ tự case**: tổng điểm đổi dù tập case không đổi — thử hỏi “biến nào sống sót từ case này sang case sau?”.",
        "Sửa `con -= w[k]` thành `con -= w[i]`, và sắp `thuTu` lại **ở trong** vòng lặp từng case (đừng giữ kết quả của case đầu để dùng cho các case sau)."
      ]
    }
  ]
});
