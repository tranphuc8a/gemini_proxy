/* =====================================================================
   vis-4-hien-dai.js — demo cho M06, M09
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ==================================================================
     1. ATTENTION: ma tran QKᵀ va vai tro cua √d
     ================================================================== */
  demo({
    id: "attention", nhom: "AI hiện đại", mon: "M06",
    ten: "Attention: ma trận QKᵀ và vì sao chia √d",
    moTa: "Tắt phép chia √d rồi tăng số chiều — xem softmax bão hoà thành ma trận " +
          "gần như one-hot.",
    lienKet: '<a href="../web/index.html#/bai/m06-bai-08-tu-attention-den-self-attention">M06 b.8</a>' +
             ' · <a href="../web/index.html#/bai/m06-bai-09-kien-truc-transformer">M06 b.9</a>',
    dung: function (host) {
      var TOKEN = ["Con", "mèo", "đen", "ngồi", "trên", "thảm", "vì", "nó", "mệt"];
      var n = TOKEN.length;
      var O = 78, PAD = 92, W = PAD + n * O + 20, H = PAD + n * O + 20;
      var cv = V.veBang(W, H), g = cv.g;
      var tt = { d: 16, chia: true, T: 1, nhanQua: false, hat: 5, dau: 0 };
      var oSo = V.el("div", { class: "so-lieu" });

      /* Sinh Q, K tu "ngu nghia" gia lap: token cung nhom co vector gan nhau. */
      function sinhQK() {
        var R = V.rng(tt.hat + tt.dau * 101);
        var nhom = [0, 0, 0, 1, 2, 3, 4, 0, 1];   /* mèo-đen-nó cùng nhóm, v.v. */
        var co = [];
        for (var k = 0; k < 5; k++) {
          var v = [];
          for (var j = 0; j < tt.d; j++) v.push(R.chuan());
          co.push(v);
        }
        var Q = [], K = [];
        for (var i = 0; i < n; i++) {
          var q = [], kk = [];
          for (var j2 = 0; j2 < tt.d; j2++) {
            q.push(co[nhom[i]][j2] * 0.85 + R.chuan() * 0.45);
            kk.push(co[nhom[i]][j2] * 0.85 + R.chuan() * 0.45);
          }
          Q.push(q); K.push(kk);
        }
        return [Q, K];
      }

      function tinh() {
        var QK = sinhQK(), Q = QK[0], K = QK[1];
        var A = [];
        for (var i = 0; i < n; i++) {
          var row = [];
          for (var j = 0; j < n; j++) {
            var s = 0;
            for (var k = 0; k < tt.d; k++) s += Q[i][k] * K[j][k];
            if (tt.chia) s /= Math.sqrt(tt.d);
            if (tt.nhanQua && j > i) s = -Infinity;
            row.push(s / Math.max(tt.T, 0.02));
          }
          var m = Math.max.apply(null, row.filter(isFinite));
          var e = row.map(function (v) { return isFinite(v) ? Math.exp(v - m) : 0; });
          var sum = e.reduce(function (a, b) { return a + b; }, 0);
          A.push(e.map(function (v) { return v / sum; }));
        }
        return A;
      }

      function ve() {
        var A = tinh();
        g.clearRect(0, 0, W, H);
        g.font = "12.5px system-ui";
        for (var j = 0; j < n; j++) {
          g.save();
          g.translate(PAD + j * O + O / 2, PAD - 10);
          g.rotate(-Math.PI / 4);
          g.fillStyle = V.mau("tx2"); g.textAlign = "left";
          g.fillText(TOKEN[j], 0, 0);
          g.restore();
        }
        g.textAlign = "right";
        for (var i = 0; i < n; i++) {
          g.fillStyle = V.mau("tx2");
          g.fillText(TOKEN[i], PAD - 10, PAD + i * O + O / 2 + 4);
        }
        g.textAlign = "left";
        for (var i2 = 0; i2 < n; i2++) {
          for (var j2 = 0; j2 < n; j2++) {
            var v = A[i2][j2];
            g.fillStyle = V.thangMau(Math.pow(v, 0.6));
            g.fillRect(PAD + j2 * O, PAD + i2 * O, O - 2, O - 2);
            if (v > 0.06) {
              g.fillStyle = v > 0.45 ? "#fff" : V.mau("tx");
              g.font = "600 11px " + "monospace"; g.textAlign = "center";
              g.fillText(v.toFixed(2), PAD + j2 * O + O / 2 - 1, PAD + i2 * O + O / 2 + 4);
              g.textAlign = "left"; g.font = "12.5px system-ui";
            }
          }
        }
        /* do bao hoa: entropy trung binh moi hang */
        var Hs = 0, maxP = 0;
        A.forEach(function (r) {
          r.forEach(function (v) {
            if (v > 1e-9) Hs -= v * Math.log2(v);
            if (v > maxP) maxP = v;
          });
        });
        Hs /= n;
        oSo.innerHTML =
          '<div class="d"><span>Entropy TB mỗi hàng</span><b>' + Hs.toFixed(3) + " bit</b></div>" +
          '<div class="d"><span>Entropy tối đa</span><b>' + Math.log2(n).toFixed(3) + " bit</b></div>" +
          '<div class="d"><span>Trọng số lớn nhất</span><b>' + maxP.toFixed(3) + "</b></div>" +
          '<div class="d"><span>Trạng thái</span><b style="color:' +
            (Hs < 0.6 ? "var(--loi)" : "var(--ok)") + '">' +
            (Hs < 0.6 ? "BÃO HOÀ (gần one-hot)" : "phân bố lành mạnh") + "</b></div>";
      }

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.truot({ ten: "Số chiều d_k", min: 2, max: 512, buoc: 2, giaTri: tt.d,
          doi: function (v) { tt.d = v; ve(); } }),
        V.danhDau({ ten: "Chia cho √d_k (scaled attention)", giaTri: tt.chia,
          doi: function (v) { tt.chia = v; ve(); } }),
        V.danhDau({ ten: "Mặt nạ nhân quả (chỉ nhìn về trái)", giaTri: tt.nhanQua,
          doi: function (v) { tt.nhanQua = v; ve(); } }),
        V.truot({ ten: "Nhiệt độ", min: 0.1, max: 4, buoc: 0.05, giaTri: tt.T,
          doi: function (v) { tt.T = v; ve(); } }),
        V.truot({ ten: "Đầu attention số", min: 0, max: 7, buoc: 1, giaTri: tt.dau,
          doi: function (v) { tt.dau = v; ve(); } }),
        V.nut("Đổi khởi tạo", function () { tt.hat = Math.floor(Math.random() * 999); ve(); }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, V.el("p", { class: "d-lk",
          text: "Hàng = token đang hỏi (query). Cột = token được nhìn (key). Mỗi hàng cộng lại bằng 1." })],
        dieuKhien: dk,
        giaiThich:
          "<b>Công thức:</b> <code>Attention(Q,K,V) = softmax(QKᵀ / √d_k) · V</code><br>" +
          "Ma trận bạn đang nhìn là phần <code>softmax(QKᵀ/√d_k)</code> — mỗi hàng là một " +
          "phân phối xác suất trên các token.<ul>" +
          "<li><b>Thí nghiệm then chốt — vì sao chia √d.</b> Tắt ô <i>chia cho √d_k</i>, " +
          "rồi kéo <i>số chiều</i> từ 16 lên 512. Ma trận chuyển từ nhiều màu sang gần như " +
          "one-hot: mỗi query chỉ nhìn đúng một key. Entropy sụp về gần 0.<br>" +
          "<b>Lý do toán học:</b> tích vô hướng của hai vector ngẫu nhiên d chiều có " +
          "độ lệch chuẩn tỷ lệ với <code>√d</code>. Logit càng lớn thì softmax càng sắc. " +
          "Chia cho <code>√d_k</code> giữ phương sai của logit ở mức ~1 <b>bất kể d bằng bao nhiêu</b>.</li>" +
          "<li><b>Vì sao bão hoà là vấn đề:</b> khi softmax gần one-hot, đạo hàm của nó " +
          "gần 0 ở mọi nơi → <b>gradient không truyền qua được</b>. Mô hình ngừng học. " +
          "Đây không phải chi tiết làm đẹp — nó là điều kiện để transformer huấn luyện được.</li>" +
          "<li><b>Mặt nạ nhân quả:</b> bật lên, nửa trên bên phải thành 0. Đây là khác biệt " +
          "kiến trúc giữa GPT (chỉ nhìn về trái, sinh được) và BERT (nhìn hai chiều, " +
          "hiểu tốt hơn nhưng không sinh tự nhiên được).</li>" +
          "<li><b>Nhiều đầu (multi-head):</b> đổi <i>đầu attention</i>. Mỗi đầu là một " +
          "phép chiếu khác nhau của cùng token, nên nhìn ra quan hệ khác nhau. " +
          "Đó là lý do transformer dùng nhiều đầu thay vì một đầu to.</li></ul>" +
          "<i>Lưu ý trung thực: vector Q, K ở đây được sinh giả lập để minh hoạ cơ chế, " +
          "không phải từ một mô hình đã huấn luyện. Cấu trúc toán học là thật; " +
          "ngữ nghĩa cụ thể là dàn dựng.</i>"
      });
      ve();
    }
  });

  /* ==================================================================
     2. BPE — huan luyen tokenizer ngay tren trinh duyet
     ================================================================== */
  demo({
    id: "bpe", nhom: "AI hiện đại", mon: "M06",
    ten: "BPE: tokenizer được học như thế nào",
    moTa: "Huấn luyện Byte Pair Encoding thật trên văn bản tiếng Việt. Xem từng phép " +
          "gộp và đo chi phí token của tiếng Việt so với tiếng Anh.",
    lienKet: '<a href="../web/index.html#/bai/m06-bai-03-tokenization-hien-dai">M06 b.3</a>' +
             ' · <a href="../web/index.html#/bai/m06-bai-15-nlp-tieng-viet">M06 b.15</a>',
    dung: function (host) {
      var VAN_BAN_VI =
        "học máy là một nhánh của trí tuệ nhân tạo. học sâu là một nhánh của học máy. " +
        "mô hình học từ dữ liệu. dữ liệu huấn luyện quyết định chất lượng mô hình. " +
        "mạng neuron học biểu diễn từ dữ liệu thô. học có giám sát cần dữ liệu có nhãn. " +
        "học không giám sát tìm cấu trúc trong dữ liệu không nhãn. mô hình ngôn ngữ lớn " +
        "học từ rất nhiều văn bản. tokenizer chia văn bản thành token. ";
      var VAN_BAN_EN =
        "machine learning is a branch of artificial intelligence. deep learning is a branch " +
        "of machine learning. models learn from data. training data determines model quality. " +
        "neural networks learn representations from raw data. supervised learning needs " +
        "labeled data. unsupervised learning finds structure in unlabeled data. large " +
        "language models learn from very large text corpora. tokenizers split text into tokens. ";

      var tt = { soGop: 30, nguon: "vi", thu: "" };
      var oKQ = V.el("div", { style: "font:13px/1.9 var(--fm)" });
      var oGop = V.el("div", { style: "font:12px/1.7 var(--fm);max-height:190px;overflow:auto;" +
        "background:var(--bg2);border:1px solid var(--bd);border-radius:9px;padding:10px" });
      var oSo = V.el("div", { class: "so-lieu" });

      function huanLuyen(vanBan, soGop) {
        var tu = vanBan.trim().split(/\s+/);
        var kho = {};
        tu.forEach(function (t) {
          var k = t.split("").join(" ") + " </w>";
          kho[k] = (kho[k] || 0) + 1;
        });
        var gopDs = [];
        for (var it = 0; it < soGop; it++) {
          var dem = {};
          Object.keys(kho).forEach(function (k) {
            var s = k.split(" ");
            for (var i = 0; i + 1 < s.length; i++) {
              var p = s[i] + " " + s[i + 1];
              dem[p] = (dem[p] || 0) + kho[k];
            }
          });
          var best = null, bestC = 0;
          Object.keys(dem).forEach(function (p) { if (dem[p] > bestC) { bestC = dem[p]; best = p; } });
          if (!best || bestC < 2) break;
          var ab = best.split(" ");
          gopDs.push({ a: ab[0], b: ab[1], dem: bestC });
          var moi = {};
          Object.keys(kho).forEach(function (k) {
            var k2 = k.split(" ");
            var r = [];
            for (var i = 0; i < k2.length; i++) {
              if (i + 1 < k2.length && k2[i] === ab[0] && k2[i + 1] === ab[1]) {
                r.push(ab[0] + ab[1]); i++;
              } else r.push(k2[i]);
            }
            var nk = r.join(" ");
            moi[nk] = (moi[nk] || 0) + kho[k];
          });
          kho = moi;
        }
        return { kho: kho, gop: gopDs };
      }

      function apDung(gop, tu) {
        var s = tu.split("").concat(["</w>"]);
        gop.forEach(function (m) {
          var r = [];
          for (var i = 0; i < s.length; i++) {
            if (i + 1 < s.length && s[i] === m.a && s[i + 1] === m.b) { r.push(m.a + m.b); i++; }
            else r.push(s[i]);
          }
          s = r;
        });
        return s;
      }

      function ve() {
        var vb = tt.nguon === "vi" ? VAN_BAN_VI : VAN_BAN_EN;
        var kq = huanLuyen(vb, tt.soGop);

        oGop.innerHTML = kq.gop.map(function (m, i) {
          return '<div><span style="color:var(--tx3)">' + String(i + 1).padStart(2, " ") +
            '.</span> "' + m.a.replace("</w>", "␣") + '" + "' + m.b.replace("</w>", "␣") +
            '" → <b style="color:var(--ac)">"' + (m.a + m.b).replace("</w>", "␣") +
            '"</b> <span style="color:var(--tx3)">(' + m.dem + " lần)</span></div>";
        }).join("") || '<i style="color:var(--tx3)">chưa có phép gộp nào</i>';

        var thu = tt.thu || (tt.nguon === "vi" ? "học sâu và học máy" : "deep learning and machine learning");
        oKQ.innerHTML = thu.trim().split(/\s+/).map(function (t) {
          return apDung(kq.gop, t).map(function (x) {
            return '<span style="background:var(--acbg);border:1px solid var(--acbd);' +
              'border-radius:5px;padding:2px 5px;margin:2px 2px;display:inline-block">' +
              x.replace("</w>", "␣") + "</span>";
          }).join("");
        }).join(" ");

        /* do chi phi token */
        function demToken(vanBan, gop) {
          var n = 0;
          vanBan.trim().split(/\s+/).forEach(function (t) { n += apDung(gop, t).length; });
          return n;
        }
        var soToken = demToken(vb, kq.gop);
        var soKyTu = vb.replace(/\s/g, "").length;
        var tuVung = {};
        Object.keys(kq.kho).forEach(function (k) {
          k.split(" ").forEach(function (x) { tuVung[x] = 1; });
        });
        oSo.innerHTML =
          '<div class="d"><span>Số phép gộp</span><b>' + kq.gop.length + "</b></div>" +
          '<div class="d"><span>Kích thước từ vựng</span><b>' + Object.keys(tuVung).length + "</b></div>" +
          '<div class="d"><span>Số token toàn văn</span><b>' + soToken + "</b></div>" +
          '<div class="d"><span>Ký tự / token</span><b>' + (soKyTu / soToken).toFixed(2) + "</b></div>";
      }

      var oThu = V.el("input", {
        type: "text", placeholder: "gõ câu để thử tách…",
        style: "width:100%;padding:8px 10px;border:1px solid var(--bd);border-radius:8px;" +
               "background:var(--surf2);color:var(--tx);font:inherit;font-size:13.5px"
      });
      oThu.addEventListener("input", function () { tt.thu = oThu.value; ve(); });

      var dk = [
        V.el("h4", { text: "HUẤN LUYỆN" }),
        V.chon({ ten: "Văn bản huấn luyện", giaTri: tt.nguon,
          muc: [{ v: "vi", t: "Tiếng Việt" }, { v: "en", t: "Tiếng Anh" }],
          doi: function (v) { tt.nguon = v; tt.thu = ""; oThu.value = ""; ve(); } }),
        V.truot({ ten: "Số phép gộp", min: 0, max: 120, buoc: 1, giaTri: tt.soGop,
          doi: function (v) { tt.soGop = v; ve(); } }),
        V.el("h4", { text: "THỬ TÁCH CÂU", style: "margin-top:16px" }),
        oThu,
        oSo
      ];

      V.khung(host, {
        ve: [
          V.el("div", { class: "d-nhom", text: "CÁC PHÉP GỘP ĐÃ HỌC (theo thứ tự)" }), oGop,
          V.el("div", { class: "d-nhom", text: "KẾT QUẢ TÁCH", style: "margin-top:14px" }),
          V.el("div", { style: "background:var(--surf2);border:1px solid var(--bd);" +
            "border-radius:9px;padding:12px;min-height:60px" }, [oKQ])
        ],
        dieuKhien: dk,
        giaiThich:
          "<b>Thuật toán BPE, đúng như bạn vừa chạy:</b><ol>" +
          "<li>Bắt đầu: mỗi từ = dãy ký tự riêng lẻ, cộng ký hiệu kết thúc từ <code>␣</code>.</li>" +
          "<li>Đếm mọi cặp ký hiệu kề nhau trong toàn bộ kho.</li>" +
          "<li>Gộp cặp <b>xuất hiện nhiều nhất</b> thành một ký hiệu mới.</li>" +
          "<li>Lặp lại đúng <i>số phép gộp</i> lần.</li></ol>" +
          "<b>Hãy quan sát:</b> ở vài chục phép gộp đầu, BPE tự khám phá ra các âm tiết và " +
          "hình vị thường gặp — không ai dạy nó ngữ pháp. Đây là thống kê thuần tuý.<ul>" +
          "<li><b>Số phép gộp = 0</b>: mỗi ký tự là một token. Từ vựng rất nhỏ, chuỗi rất dài.</li>" +
          "<li><b>Số phép gộp lớn</b>: từ vựng lớn, chuỗi ngắn. Chỉ số <i>ký tự/token</i> " +
          "chính là hiệu quả nén.</li></ul>" +
          "<b>Đánh đổi trung tâm của tokenization:</b> từ vựng lớn → chuỗi ngắn → ngữ cảnh " +
          "chứa được nhiều nội dung hơn và chi phí thấp hơn; nhưng bảng nhúng to hơn và " +
          "token hiếm ít được học kỹ.<br><br>" +
          "<b>So tiếng Việt với tiếng Anh:</b> chạy cùng số phép gộp cho cả hai và so " +
          "<i>ký tự/token</i>. Chênh lệch này là lý do thật khiến cùng một nội dung tốn " +
          "nhiều token hơn ở tiếng Việt — nghĩa là <b>đắt hơn và ngữ cảnh hiệu dụng ngắn hơn</b>. " +
          "Với tokenizer đa ngữ thương mại, chênh lệch còn lớn hơn vì phần lớn phép gộp của " +
          "chúng được học từ văn bản tiếng Anh."
      });
      ve();
    }
  });

  /* ==================================================================
     3. MO HINH KHUECH TAN — xuoi va nguoc, score CHINH XAC
     ================================================================== */
  demo({
    id: "khuech-tan", nhom: "AI hiện đại", mon: "M09",
    ten: "Mô hình khuếch tán: thêm nhiễu rồi gỡ nhiễu",
    moTa: "Dữ liệu là hỗn hợp Gauss nên <b>score chính xác tính được bằng công thức</b> — " +
          "bộ lấy mẫu ngược ở đây là thật, không phải hoạt hình.",
    lienKet: '<a href="../web/index.html#/bai/m09-bai-05-mo-hinh-khuech-tan">M09 b.5</a>',
    dung: function (host) {
      var W = 420, H = 420;
      var cvF = V.veBang(W, H), gF = cvF.g;
      var cvR = V.veBang(W, H), gR = cvR.g;
      var TF = cvF.hemToan(-3.2, 3.2, -3.2, 3.2);
      var Tn = 400;
      var tt = { t: 0, soBuoc: 60, hat: 21, dang: "bon" };
      var oSo = V.el("div", { class: "so-lieu" });

      function tamCum() {
        if (tt.dang === "bon") return [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]];
        if (tt.dang === "hai") return [[-1.6, 0], [1.6, 0]];
        return [[0, 1.7], [-1.6, -1.0], [1.6, -1.0]];
      }
      var SIG0 = 0.22;

      function lichNhieu(t) {                       /* alpha_bar theo lich cosine */
        var s = 0.008, u = (t / Tn + s) / (1 + s) * Math.PI / 2;
        var f = Math.cos(u) * Math.cos(u), f0 = Math.cos(s / (1 + s) * Math.PI / 2);
        return Math.max(1e-5, Math.min(1 - 1e-5, f / (f0 * f0)));
      }

      var X0 = [];
      function sinhDL() {
        var R = V.rng(tt.hat), c = tamCum();
        X0 = [];
        for (var i = 0; i < 400; i++) {
          var k = c[i % c.length];
          X0.push([k[0] + R.chuan() * SIG0, k[1] + R.chuan() * SIG0]);
        }
      }

      /* Score chinh xac cua hon hop Gauss sau khi them nhieu:
         q(x_t) = (1/K) Σ N(x_t ; √ᾱ μ_k , (ᾱ σ0² + 1−ᾱ) I) */
      function score(x, y, ab) {
        var c = tamCum();
        var vr = ab * SIG0 * SIG0 + (1 - ab);
        var w = [], tong = 0;
        for (var k = 0; k < c.length; k++) {
          var mx = Math.sqrt(ab) * c[k][0], my = Math.sqrt(ab) * c[k][1];
          var d2 = (x - mx) * (x - mx) + (y - my) * (y - my);
          var p = Math.exp(-d2 / (2 * vr));
          w.push([p, mx, my]); tong += p;
        }
        var sx = 0, sy = 0;
        w.forEach(function (e) {
          var r = e[0] / (tong + 1e-300);
          sx += r * (e[1] - x) / vr;
          sy += r * (e[2] - y) / vr;
        });
        return [sx, sy];
      }

      function veDiem(g, T, P, mau_, r) {
        P.forEach(function (p) {
          g.fillStyle = mau_;
          g.beginPath(); g.arc(T.x(p[0]), T.y(p[1]), r || 2.6, 0, 7); g.fill();
        });
      }

      function xuoiTai(t) {
        var ab = lichNhieu(t), R = V.rng(tt.hat + t);
        return X0.map(function (p) {
          return [Math.sqrt(ab) * p[0] + Math.sqrt(1 - ab) * R.chuan(),
                  Math.sqrt(ab) * p[1] + Math.sqrt(1 - ab) * R.chuan()];
        });
      }

      function nguoc() {
        var R = V.rng(tt.hat * 3 + 1);
        var P = [];
        for (var i = 0; i < 400; i++) P.push([R.chuan(), R.chuan()]);
        var B = tt.soBuoc;
        for (var s = B; s >= 1; s--) {
          var t = Math.round(s / B * Tn), tprev = Math.round((s - 1) / B * Tn);
          var ab = lichNhieu(t), abp = tprev > 0 ? lichNhieu(tprev) : 1;
          for (var i2 = 0; i2 < P.length; i2++) {
            var sc = score(P[i2][0], P[i2][1], ab);
            /* uoc luong x0 tu score:  x0 ≈ (x + (1−ᾱ)·score) / √ᾱ */
            var x0x = (P[i2][0] + (1 - ab) * sc[0]) / Math.sqrt(ab);
            var x0y = (P[i2][1] + (1 - ab) * sc[1]) / Math.sqrt(ab);
            /* lay mau lai o muc nhieu tprev (DDIM tat dinh) */
            var nx = Math.sqrt(abp) * x0x + Math.sqrt(Math.max(1 - abp, 0)) *
                     (P[i2][0] - Math.sqrt(ab) * x0x) / Math.sqrt(Math.max(1 - ab, 1e-9));
            var ny = Math.sqrt(abp) * x0y + Math.sqrt(Math.max(1 - abp, 0)) *
                     (P[i2][1] - Math.sqrt(ab) * x0y) / Math.sqrt(Math.max(1 - ab, 1e-9));
            P[i2] = [nx, ny];
          }
        }
        return P;
      }

      function ve() {
        var t = Math.round(tt.t);
        var ab = lichNhieu(t);
        gF.clearRect(0, 0, W, H);
        V.veLuoi(gF, TF, -3.2, 3.2, -3.2, 3.2, W, H, 1);
        veDiem(gF, TF, xuoiTai(t), "rgba(157,23,77,.55)");
        gF.fillStyle = V.mau("tx2"); gF.font = "600 13px system-ui";
        gF.fillText("t = " + t + " / " + Tn + "   ᾱ = " + ab.toFixed(3), 12, 20);

        gR.clearRect(0, 0, W, H);
        V.veLuoi(gR, TF, -3.2, 3.2, -3.2, 3.2, W, H, 1);
        veDiem(gR, TF, nguoc(), "rgba(15,118,110,.55)");
        gR.fillStyle = V.mau("tx2"); gR.font = "600 13px system-ui";
        gR.fillText("sinh từ nhiễu thuần, " + tt.soBuoc + " bước", 12, 20);

        oSo.innerHTML =
          '<div class="d"><span>ᾱ(t)</span><b>' + ab.toFixed(4) + "</b></div>" +
          '<div class="d"><span>Hệ số tín hiệu √ᾱ</span><b>' + Math.sqrt(ab).toFixed(3) + "</b></div>" +
          '<div class="d"><span>Hệ số nhiễu √(1−ᾱ)</span><b>' + Math.sqrt(1 - ab).toFixed(3) + "</b></div>";
      }

      var dk = [
        V.el("h4", { text: "QUÁ TRÌNH XUÔI (thêm nhiễu)" }),
        V.truot({ ten: "Bước thời gian t", min: 0, max: Tn, buoc: 4, giaTri: tt.t,
          doi: function (v) { tt.t = v; ve(); } }),
        V.el("h4", { text: "QUÁ TRÌNH NGƯỢC (gỡ nhiễu)", style: "margin-top:16px" }),
        V.truot({ ten: "Số bước lấy mẫu", min: 2, max: 120, buoc: 1, giaTri: tt.soBuoc,
          doi: function (v) { tt.soBuoc = v; ve(); } }),
        V.chon({ ten: "Phân bố dữ liệu", giaTri: tt.dang,
          muc: [{ v: "bon", t: "Bốn cụm" }, { v: "hai", t: "Hai cụm" }, { v: "ba", t: "Ba cụm (tam giác)" }],
          doi: function (v) { tt.dang = v; sinhDL(); ve(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 60, buoc: 1, giaTri: tt.hat,
          doi: function (v) { tt.hat = v; sinhDL(); ve(); } }),
        oSo
      ];

      sinhDL();
      V.khung(host, {
        ve: [V.el("div", { style: "display:flex;gap:12px;flex-wrap:wrap" }, [
              V.el("div", {}, [V.el("div", { class: "d-nhom", text: "XUÔI: dữ liệu → nhiễu" }), cvF]),
              V.el("div", {}, [V.el("div", { class: "d-nhom", text: "NGƯỢC: nhiễu → dữ liệu" }), cvR])
            ])],
        dieuKhien: dk,
        giaiThich:
          "<b>Quá trình xuôi</b> (cố định, không học gì): " +
          "<code>x_t = √ᾱ_t · x₀ + √(1−ᾱ_t) · ε</code>, với ε ~ N(0, I).<br>" +
          "Kéo thanh <i>t</i> từ 0 tới 400: bốn cụm co dần về gốc và tan vào nhiễu Gauss chuẩn. " +
          "Chú ý hai hệ số — tín hiệu tắt dần, nhiễu mạnh dần.<br><br>" +
          "<b>Quá trình ngược</b> cần biết <b>score</b> <code>∇ₓ log q(x_t)</code> — hướng " +
          "&quot;đi về phía dữ liệu có khả năng hơn&quot;. Trong thực tế, một mạng neuron " +
          "<i>học</i> score này. Ở đây dữ liệu là hỗn hợp Gauss nên score <b>tính được chính " +
          "xác bằng công thức</b> — nên bạn đang nhìn một bộ lấy mẫu khuếch tán <i>đúng</i>, " +
          "chỉ không có phần học.<ul>" +
          "<li><b>Thí nghiệm — vì sao lấy mẫu đắt.</b> Giảm <i>số bước lấy mẫu</i> xuống 2–4. " +
          "Các điểm sinh ra không về đúng cụm, phân bố sai lệch rõ rệt. Tăng lên 60+: đúng. " +
          "<b>Đây là nút thắt trung tâm của mô hình khuếch tán</b> — chất lượng cao đòi hỏi " +
          "nhiều lần chạy mạng, và đó là lý do sinh ảnh chậm hơn sinh văn bản rất nhiều.</li>" +
          "<li>Toàn bộ nghiên cứu về <i>bộ lấy mẫu nhanh</i> (DDIM, DPM-Solver, chưng cất " +
          "nhất quán) là để giảm con số bước này mà không mất chất lượng.</li></ul>" +
          "<b>Vì sao khuếch tán thắng GAN:</b> mục tiêu huấn luyện là <i>dự đoán nhiễu đã " +
          "thêm vào</i> — một bài toán hồi quy có giám sát, dễ và ổn định. GAN phải giải một " +
          "trò chơi minimax, vốn bất ổn và hay sụp chế độ."
      });
      ve();
    }
  });
})();
