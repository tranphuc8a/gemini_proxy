/* =====================================================================
   lab-physarum.js — Nam nhay Physarum polycephalum.

   Mot sinh vat khong co nao, khong co he than kinh, khong co mot te bao
   nao biet ban do. Moi tac tu chi lam hai viec: ngui vet chat quanh minh
   roi re ve phia dam hon, va de lai vet cua chinh no. Tu do moc ra mot
   MANG LUOI van chuyen — va nam that da tung ve lai duoc mang tau dien
   Tokyo trong mot thi nghiem noi tieng nam 2010.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  demo({
    id: "nam-nhay",
    nhom: "Bầy đàn & tác tử",
    mon: "L16",
    ten: "Nấm nhầy — mạng lưới mọc ra từ hai quy tắc",
    moTa: "Mỗi tác tử chỉ làm hai việc: <b>ngửi</b> vết chất ở ba điểm phía trước rồi rẽ " +
          "về phía đậm hơn, và <b>để lại vết</b> của chính nó. Không có bản đồ, không có " +
          "kế hoạch, không tác tử nào biết mạng lưới trông ra sao. Vậy mà mạng vẫn mọc ra.",

    dung: function (host) {
      var W = 320, H = 200;           /* luoi vet chat */
      var vet = null, vetMoi = null;  /* Float32Array W*H */
      var gocHuong = null;            /* huong tung tac tu */
      var HT = null, L = null, P = null;
      var Rnd = null, oMau = null;

      var TS = V.thamSo([
        { ma: "soTacTu", ten: "Số tác tử", kieu: "so", min: 500, max: 20000, buoc: 500, gt: 6000 },
        { ma: "gocNgui", ten: "Góc ngửi hai bên", kieu: "so", min: 5, max: 90, buoc: 2.5, gt: 30,
          donVi: "°" },
        { ma: "xaNgui", ten: "Ngửi xa bao nhiêu ô", kieu: "so", min: 2, max: 30, buoc: 1, gt: 9,
          moTa: "Đây là tham số quan trọng nhất. Nhỏ → nhiều sợi mảnh rối. " +
                "Lớn → ít nhánh nhưng dày và thẳng." },
        { ma: "gocQuay", ten: "Góc rẽ mỗi bước", kieu: "so", min: 2, max: 90, buoc: 2, gt: 26,
          donVi: "°" },
        { ma: "bayHoi", ten: "Tốc độ bay hơi của vết", kieu: "so",
          min: 0.005, max: 0.3, buoc: 0.005, gt: 0.06,
          moTa: "Bay hơi nhanh → mạng không kịp hình thành. Bay hơi chậm → cả khung " +
                "sáng đều, mất hết cấu trúc. Cấu trúc chỉ sống trong một dải hẹp ở giữa." },
        { ma: "khuechTan", ten: "Mức lan của vết", kieu: "so", min: 0, max: 1, buoc: 0.05, gt: 0.6 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 17 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Mạng cân đối",       gt: { xaNgui: 9, gocNgui: 30, gocQuay: 26, bayHoi: 0.06 } },
          { ten: "Sợi mảnh dày đặc",   gt: { xaNgui: 3, gocNgui: 22, gocQuay: 40, bayHoi: 0.05 } },
          { ten: "Nhánh to và thẳng",  gt: { xaNgui: 22, gocNgui: 45, gocQuay: 14, bayHoi: 0.04 } },
          { ten: "Bay hơi quá nhanh",  gt: { bayHoi: 0.28 } },
          { ten: "Bay hơi quá chậm",   gt: { bayHoi: 0.008 } },
          { ten: "Đông đúc 20k",       gt: { soTacTu: 20000, xaNgui: 9 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.66, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        vet = new Float32Array(W * H);
        vetMoi = new Float32Array(W * H);
        Rnd = V.rng(Math.round(G.hat) || 1);

        var n = Math.round(G.soTacTu);
        /* Khong dung bam khong gian o day: tac tu khong hoi nhau, chung chi
           doc luoi vet. V.hat van tien de giu toa do va xu ly mep noi vong. */
        HT = V.hat({ soToiDa: n, rong: W, cao: H, banKinh: 8, vien: "vong" });
        gocHuong = new Float32Array(n);
        for (var i = 0; i < n; i++) {
          /* Gieo trong mot dia o giua — de thay mang moc TU DAU ra. */
          var a = Rnd() * Math.PI * 2, r = Math.sqrt(Rnd()) * Math.min(W, H) * 0.28;
          HT.them(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 0, 0, 0);
          gocHuong[i] = Rnd() * Math.PI * 2;
        }

        oMau = new Uint8Array(W * H);
        L = V.luoiO(cv, { cot: W, hang: H, le: 8, leTren: 22 });
        var bang = [];
        for (var k = 0; k < 32; k++) bang.push(V.thangMau(k / 31));
        L.bangMau(bang);
      }

      function doc(x, y) {
        var c = Math.floor(x), r = Math.floor(y);
        c = ((c % W) + W) % W;
        r = ((r % H) + H) % H;
        return vet[r * W + c];
      }

      function motBuoc() {
        var n = HT.n, i;
        var gN = G.gocNgui * Math.PI / 180;
        var gQ = G.gocQuay * Math.PI / 180;
        var xa = G.xaNgui;

        /* --- 1. Ngui va re --- */
        for (i = 0; i < n; i++) {
          var a = gocHuong[i], x = HT.x[i], y = HT.y[i];
          var giua = doc(x + Math.cos(a) * xa, y + Math.sin(a) * xa);
          var trai = doc(x + Math.cos(a - gN) * xa, y + Math.sin(a - gN) * xa);
          var phai = doc(x + Math.cos(a + gN) * xa, y + Math.sin(a + gN) * xa);

          if (giua >= trai && giua >= phai) {
            /* phia truoc dam nhat — di thang */
          } else if (trai > phai) {
            a -= gQ;
          } else if (phai > trai) {
            a += gQ;
          } else {
            a += (Rnd() < 0.5 ? -gQ : gQ);      /* hai ben bang nhau: re bua */
          }
          gocHuong[i] = a;
          HT.vx[i] = Math.cos(a);
          HT.vy[i] = Math.sin(a);
        }

        /* --- 2. Di chuyen --- */
        HT.tien(1);

        /* --- 3. De lai vet --- */
        for (i = 0; i < n; i++) {
          var c = Math.floor(HT.x[i]), r = Math.floor(HT.y[i]);
          if (c < 0) c = 0; else if (c >= W) c = W - 1;
          if (r < 0) r = 0; else if (r >= H) r = H - 1;
          vet[r * W + c] += 1;
        }

        /* --- 4. Lan toa + bay hoi --- *
           Lan bang trung binh 3x3 roi nhan voi (1 - bay hoi). Khong co buoc
           nay thi vet chi la cac cham roi rac, khong bao gio noi thanh soi. */
        var k = G.khuechTan;
        var giu = 1 - G.bayHoi;
        var mot_k = 1 - k, k9 = k / 9;
        for (var rr = 0; rr < H; rr++) {
          var rt = ((rr - 1 + H) % H) * W, rg = rr * W, rd = ((rr + 1) % H) * W;
          /* Cot 0 va cot cuoi phai lay modulo de vong qua mep; TOAN BO phan
             giua thi khong — bo modulo o day la phan tiet kiem lon nhat, vi
             vong nay chay qua ca luoi moi buoc. */
          var cc, ct, cd, tong;
          for (cc = 0; cc < W; cc++) {
            if (cc === 0 || cc === W - 1) {
              ct = (cc - 1 + W) % W; cd = (cc + 1) % W;
            } else {
              ct = cc - 1; cd = cc + 1;
            }
            tong = vet[rt + ct] + vet[rt + cc] + vet[rt + cd] +
                   vet[rg + ct] + vet[rg + cc] + vet[rg + cd] +
                   vet[rd + ct] + vet[rd + cc] + vet[rd + cd];
            vetMoi[rg + cc] = (vet[rg + cc] * mot_k + tong * k9) * giu;
          }
        }
        var tam = vet; vet = vetMoi; vetMoi = tam;
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(kb) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        /* Chuan hoa theo phan vi cao thay vi theo cuc dai: mot o sang bat
           thuong se lam toi om ca khung neu chia cho max. */
        var dinh = 0, i;
        for (i = 0; i < vet.length; i += 7) if (vet[i] > dinh) dinh = vet[i];
        var chia = Math.max(0.5, dinh * 0.55);
        var phu = 0;
        for (i = 0; i < vet.length; i++) {
          var t = vet[i] / chia;
          if (t > 1) t = 1;
          if (t > 0.08) phu++;
          oMau[i] = (t * 31) | 0;
        }
        L.tuMang(oMau);
        L.dan();
        L.vien();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("lưới vết chất " + W + "×" + H + " · " +
                   HT.n.toLocaleString("vi") + " tác tử", 8, 5);

        S.dat({
          "Tác tử": HT.n.toLocaleString("vi"),
          "Bước": kb.toLocaleString("vi"),
          "Ngửi xa / góc ngửi": G.xaNgui + " ô / " + G.gocNgui + "°",
          "Bay hơi mỗi bước": (G.bayHoi * 100).toFixed(1) + "%",
          "Diện tích có vết": (phu / (W * H) * 100).toFixed(1) + "% lưới",
          "Trạng thái": phu / (W * H) > 0.75 ? "vết phủ kín — mất cấu trúc"
                      : (phu / (W * H) < 0.04 ? "vết tan gần hết" : "đang có mạng lưới")
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(4000);
        P.datTocDo(30);
        ghiChu.innerHTML = "";
        [[V.thangMau(0.1), "vết nhạt"], [V.thangMau(0.55), "vết vừa"],
         [V.thangMau(1), "vết đậm — sợi chính"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "nam-nhay",
        bang: cv,
        tocDo: 30,
        /* 28 ms moi buoc: tua chi dien lai duoc vai chuc buoc trong ngan
           sach thoi gian, khong dang. Bo thanh tua, giu thanh tien do. */
        tua: false,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k) { return "bước " + k.toLocaleString("vi"); }
      });

      var r = V.khung(host, {
        ten: "nam-nhay",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Hai quy tắc, áp cho từng tác tử:</b>" +
          "<ul>" +
          "<li><b>Ngửi</b> — đọc lượng vết chất ở ba điểm phía trước (trái · giữa · phải), " +
          "rẽ về phía đậm nhất.</li>" +
          "<li><b>Để vết</b> — bước tới một ô và cộng thêm vết vào đúng ô đó.</li>" +
          "</ul>" +
          "Cộng thêm hai quy tắc của môi trường: vết <b>lan</b> nhẹ sang ô bên cạnh và " +
          "<b>bay hơi</b> dần. Hết. Không tác tử nào nhìn thấy tác tử khác." +
          "<ul>" +
          "<li><b>Vòng phản hồi dương:</b> chỗ nào nhiều tác tử đi qua thì vết đậm, vết đậm " +
          "thì hút thêm tác tử. Đó là toàn bộ cơ chế — <b>stigmergy</b>: liên lạc bằng cách " +
          "thay đổi môi trường thay vì nói chuyện trực tiếp. Đàn kiến dùng đúng cơ chế này.</li>" +
          "<li><b>Cấu trúc chỉ sống trong một dải hẹp.</b> Đẩy <b>bay hơi</b> lên 0,28: vết tan " +
          "trước khi kịp hút ai, chỉ còn nhiễu. Kéo xuống 0,008: vết tích tụ khắp nơi, cả khung " +
          "sáng đều và cũng mất sạch cấu trúc. Mạng lưới chỉ xuất hiện ở khoảng giữa — " +
          "<b>đây là ý nghĩa thật của “ở bên bờ hỗn loạn”</b>.</li>" +
          "<li><b>Ngửi xa</b> là tham số đổi dáng mạnh nhất: 3 ô cho ra búi sợi mảnh rối như " +
          "nỉ; 22 ô cho ra vài nhánh to thẳng như mạch máu.</li>" +
          "<li><b>Không phải chuyện chơi:</b> năm 2010 nhóm của Toshiyuki Nakagaki đặt yến mạch " +
          "lên bản đồ vùng Tokyo theo đúng vị trí các thành phố, thả nấm nhầy vào. Mạng nó mọc " +
          "ra có hiệu suất, độ bền và chi phí <b>xấp xỉ mạng tàu điện Tokyo</b> — thứ mà các " +
          "kỹ sư đã mất hàng chục năm để thiết kế. Công trình được giải Ig Nobel, rồi đăng " +
          "trên <i>Science</i>.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
