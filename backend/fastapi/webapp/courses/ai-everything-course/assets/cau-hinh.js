/* ==========================================================================
   Đại khoá học Trí tuệ nhân tạo — cấu hình riêng của khoá.
   Nạp SAU content.js và TRƯỚC app.js. Engine dùng chung đọc window.CAU_HINH.
   ========================================================================== */
window.CAU_HINH = {

  tenNgan: "Đại khoá học AI",
  tieuDe:  "Đại khoá học Trí tuệ nhân tạo — từ số 0 đến trình độ nghiên cứu",
  khoaLuu: "ai",                       /* tiền tố localStorage — phải khác hai khoá kia */

  heroTieuDe: "Đại khoá học <u>Trí tuệ nhân tạo</u> — từ số 0 đến trình độ nghiên cứu",
  heroMoTa:
    "15 môn học tiếng Việt trong 2 năm: toán nền tảng, học máy, học sâu, NLP, thị giác, " +
    "học tăng cường, mô hình nền tảng, kỹ nghệ LLM, MLOps và an toàn AI — kèm " +
    "<b>8 đồ án bắt buộc</b> và <b>42 bài báo</b> phải đọc kỹ.",
  heroNut: [
    { href: "#/bai/00-tong-quan-dai-khoa", text: "Xem tổng quan" },
    { href: "#/bai/03-kiem-tra-dau-vao",   text: "Kiểm tra đầu vào" },
    { href: "#/do-an/do-an",               text: "Tám đồ án", icon: "layers" }
  ],

  kpi: function (s) {
    return [
      [s.subjects || 15, "môn học"],
      [s.lessons + (s.lessonsPlanned && s.lessons < s.lessonsPlanned
                    ? "/" + s.lessonsPlanned : ""), "bài giảng"],
      ["~" + Math.round(s.minutes / 60), "giờ đọc"],
      [(s.words / 1000).toFixed(0) + "k", "từ nội dung"]
    ];
  },

  loTrinhTieuDe: "Mười lăm môn học",
  boTienTo: /^M\d+ — /,

  doAnLat:    [1, 2],
  doAnTieuDe: "Tám đồ án bắt buộc",
  doAnPhu:    "kiến thức dính lại thành năng lực",
  doAnMoTa:   "mỗi đồ án phải có: mã tái lập được bằng <b>một lệnh</b>, baseline để so, " +
              "<b>≥3 seed</b> kèm độ lệch chuẩn, phân tích lỗi và tự nêu hạn chế.",

  traCuuChiSo: 2,
  traCuuTieuDe: "Tài liệu tra cứu & đề thi",
  traCuuPhu:    "mở khi đang làm bài",

  /* Gợi ý khi ô tìm kiếm còn trống. Engine tự bỏ mục không có thật. */
  goiYTimKiem: [
    "bai/m05-bai-04-lan-truyen-nguoc",
    "bai/m06-bai-08-tu-attention-den-self-attention",
    "tai-lieu/so-lieu-can-nho",
    "bai/m14-bai-05-reward-hacking-va-goodhart"
  ],

  moTaNhom: {
    "CT":  "Đại khoá học này là gì, học thế nào, bản đồ 15 môn, lộ trình 6 kỳ, kiểm tra đầu vào và nguyên tắc biên soạn.",
    "M01": "Khung tư duy: AI là gì, ba mùa đông, tác tử hợp lý, không gian trạng thái, tìm kiếm, CSP, bốn trường phái, đo lường trí tuệ.",
    "M02": "Nền toán: NumPy & độ phức tạp, đại số tuyến tính, SVD/PCA, gradient & autograd, tối ưu, xác suất, Bayes, lý thuyết thông tin.",
    "M03": "Học máy có giám sát: hồi quy, bias–variance, chính quy hoá, logistic & cross-entropy, SVM, ensemble, đánh giá, hiệu chỉnh.",
    "M04": "Dữ liệu: EDA, xử lý thiếu, giảm chiều, phân cụm, luật kết hợp, phát hiện dị thường, đặc trưng, và RÒ RỈ DỮ LIỆU.",
    "M05": "Học sâu: backprop từ đầu, khởi tạo, chuẩn hoá, Adam, CNN, RNN/LSTM, residual, GPU & huấn luyện phân tán, double descent, gỡ lỗi.",
    "M06": "Ngôn ngữ: tokenization, n-gram, word2vec, seq2seq, attention, TRANSFORMER từ đầu, BERT/GPT, giải mã, đánh giá, tiếng Việt.",
    "M07": "Thị giác: ảnh số, tích chập & hình học tensor, CNN kinh điển, tăng cường dữ liệu, phát hiện, phân đoạn, ViT, tự giám sát, CLIP, 3D.",
    "M08": "Học tăng cường: bandit, MDP, Bellman, MC & TD, Q-learning, DQN, policy gradient, PPO, MCTS/AlphaGo, và RLHF.",
    "M09": "Mô hình nền tảng: GAN, VAE & ELBO, khuếch tán, guidance, LLM, scaling laws, attention hiệu quả, ảo giác, RLHF/DPO, đánh giá.",
    "M10": "Kỹ năng đọc: quy trình 3 lượt, tách tuyên bố khỏi bằng chứng, 8 kiểu thí nghiệm gây hiểu nhầm, 42 bài báo, và tái lập.",
    "M11": "AI ký hiệu: logic, suy diễn, hệ chuyên gia và bài học từ thất bại của nó, ontology, đồ thị tri thức, neuro-symbolic.",
    "M12": "Kỹ nghệ LLM: prompt, ngữ cảnh, đầu ra có cấu trúc, gọi công cụ, tác tử, RAG, MCP, skill/workflow, đánh giá, chi phí, prompt injection.",
    "M13": "Vận hành: theo dõi thí nghiệm, feature store, kiểm thử hệ ML, triển khai, phục vụ LLM, giám sát, phát hiện trôi, chi phí.",
    "M14": "An toàn: phân loại rủi ro, vấn đề căn chỉnh, ảo giác, reward hacking, jailbreak, định lý bất khả về công bằng, riêng tư, red teaming.",
    "M15": "Nghiên cứu: chọn đề tài, khảo sát tài liệu, thiết kế thí nghiệm, trình bày kết quả trung thực, viết bài báo, phản biện, đạo đức.",
    "Đồ án":   "Tám đồ án từ phân loại viết từ đầu tới capstone nghiên cứu — mỗi cái phải tái lập được bằng một lệnh.",
    "Tra cứu": "Từ điển thuật ngữ, công thức và số liệu cần nhớ, 40 khái niệm phải đạt T3, thư viện bài báo, các mẫu tài liệu.",
    "Đề thi":  "Đề giữa kỳ và cuối kỳ cho 15 môn — trắc nghiệm, tự luận, vận dụng — KÈM ĐÁP ÁN."
  }
};
