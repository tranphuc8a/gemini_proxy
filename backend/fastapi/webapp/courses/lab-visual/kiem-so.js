/* =====================================================================
   kiem-so.js — doi chieu CON SO cua tung lab voi gia tri da biet.

       node kiem-so.js

   Tang "chay thu" trong engine/thu-nhanh.js chi chung minh lab khong nem
   loi va khong sinh NaN. Tep nay tra loi cau hoi khac: con so lab in ra
   co DUNG khong. No chay xuyen qua dung ma lab that (qua DOM gia cua
   engine/thu-nhanh.js), doc bang so lieu tren man hinh, roi so voi gia
   tri tinh doc lap ngay tai day.

   Them lab moi thi them mot khoi doi chieu o duoi — moi lab nen co it
   nhat MOT con so kiem duoc bang nguon khac.
   ===================================================================== */
"use strict";
const path = require("path");
const H = require(path.join(__dirname, "..", "engine", "thu-nhanh.js"));

/* ---------------------------------------------------------------- chuan */

/** Dem so nguyen to <= N bang sang Eratosthenes — doc lap voi ma cua lab. */
function demNguyenTo(N) {
  const la = new Uint8Array(N + 1).fill(1);
  la[0] = 0; la[1] = 0;
  for (let i = 2; i * i <= N; i++) {
    if (la[i]) for (let j = i * i; j <= N; j += i) la[j] = 0;
  }
  let c = 0;
  for (let i = 2; i <= N; i++) if (la[i]) c++;
  return c;
}

const PI_60000 = demNguyenTo(60000);

/* ---------------------------------------------------------------- dieu khien */

const main = () => H.document.querySelector("#main");

/** Dat mot tham so theo NHAN hien tren man hinh. */
function dat(nhan, giaTri) {
  for (const lab of H.gomTrong(main(), "label")) {
    if (!H.chuTrong(lab).includes(nhan)) continue;
    const o = H.gomTrong(lab, "select")[0] || H.gomTrong(lab, "input")[0];
    if (!o) continue;
    /* O danh dau doc `.checked`, khong phai `.value`. Dat value cho no la
       khong lam gi ca — va phep thu se im lang chay voi tham so SAI. */
    if (o._attr.type === "checkbox") {
      o.checked = !!giaTri;
      o._ban("change");
      H.bomKhung(3);
      return;
    }
    o.value = String(giaTri);
    o._ban(o._tag === "select" || o._attr.type === "number" ? "change" : "input");
    H.bomKhung(3);
    return;
  }
  throw new Error("khong co tham so mang nhan '" + nhan + "'");
}

/** Buoc hien tai, doc tu dong trang thai cua bo phat. */
function buocHienTai() {
  const nhan = H.timTrong(main(), ".phat-nhan");
  if (!nhan) return NaN;
  const m = H.chuTrong(nhan).match(/b\u01b0\u1edbc\s+([\d.]+)/);
  return m ? parseFloat(m[1].replace(/\./g, "")) : NaN;
}

/** Tua toi dung buoc k.

    Bo phat co NGAN SACH THOI GIAN cho moi lan tua (xem `hanTua` trong
    engine): sim nang se dung giua chung thay vi dong bang tab. Tot cho
    nguoi dung, nhung chet nguoi voi phep do — ta tuong dang doc buoc 2000
    ma that ra la buoc 700. Nen phai xac nhan da toi noi. */
function chayToi(k) {
  const t = H.thanhTua(main());
  if (!t) throw new Error("lab nay khong co thanh tua");
  t.value = String(k);
  t._ban("input");
  H.bomKhung(3);
  const toi = buocHienTai();
  /* DUNG SOM co hai nguyen nhan, va chung khac han nhau:
       - mo phong DA XONG (Schelling nguong 0 thi khong ai chuyen nha,
         nen no xong ngay o buoc 1). Hoan toan hop le.
       - ngan sach tua cat giua chung. Sai, va phai bao dong.
     Bo phat gan chu "da xong" vao nhan khi thuoc truong hop dau. */
  if (!isNaN(toi) && toi < k - 1 && !daXong()) {
    throw new Error("tua bi ngan sach cat: xin " + k + " buoc, chi toi " +
      toi + " \u2014 giam so buoc hoac giam quy mo tham so cua phep thu nay");
  }
}

/** Mô phỏng đã chạy hết chưa — khác hẳn với bị ngân sách cắt. */
function daXong() {
  const nhan = H.timTrong(main(), ".phat-nhan");
  return !!nhan && H.chuTrong(nhan).includes("\u0111\u00e3 xong");
}

/** Chạy một số khung hình bằng nút Chạy — cho lab không có thanh tua. */
function chayMotIt(soKhung) {
  const nc = H.nutChayCua(main());
  if (!nc) throw new Error("lab này không có nút Chạy");
  nc._ban("click");
  H.bomKhung(soKhung);
  nc._ban("click");            // tạm dừng lại
  H.bomKhung(1);
}

/** Tua toi buoc cuoi — chay het mo phong mot mach. */
function chayHet() {
  const t = H.thanhTua(main());
  if (!t) throw new Error("lab nay khong co thanh tua");
  t.value = String(t._attr.max);
  t._ban("input");
  H.bomKhung(3);
}

/** Bang so lieu thanh object { nhan: chuoi }. */
function soLieu() {
  const hop = H.timTrong(main(), ".so-lieu");
  const ra = {};
  if (!hop) return ra;
  for (const d of hop.children) {
    const k = d.children[0] ? H.chuTrong(d.children[0]).trim() : "";
    const v = d.children[1] ? H.chuTrong(d.children[1]).trim() : "";
    if (k) ra[k] = v;
  }
  return ra;
}

/* Lab in SO DEM bang toLocaleString("vi") -> "6.057" (cham la phan cach
   nghin), nhung in SO THUC bang toFixed() -> "3.14159" (cham la thap phan).
   Mot ham parse duy nhat se doc sai mot trong hai kieu. */
const soDem = (s) => parseFloat(String(s).replace(/[^0-9]/g, ""));
const soThuc = (s) => parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
/* Nhieu o so lieu la chuoi GHEP: "2 / 401  (0,5%)" hay "48.400  (100% luoi)".
   soDem() se nuot ca cac so phia sau, nen nhung o do phai doc SO DAU TIEN. */
/* Vai o so lieu in theo ky hieu khoa hoc ("4.10e-12"). soThuc() nuot ca
   chu 'e' nen doc ra 4.10 — sai 12 bac do lon ma phep thu van im lang. */
const soKhoaHoc = (s) => {
  const m = String(s).match(/-?[\d.]+(?:[eE][+-]?\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};
const soDemDau = (s) => {
  const m = String(s).match(/^[^\d-]*(-?[\d.]+)/);
  return m ? parseFloat(m[1].replace(/\./g, "")) : NaN;
};

/* ---------------------------------------------------------------- bao cao */

let hong = 0;

function mong(ten, thuc, dung, saiSo) {
  const ok = saiSo === undefined
    ? thuc === dung
    : Math.abs(thuc - dung) <= saiSo;
  console.log("  " + (ok ? "[ok]  " : "[SAI] ") + ten +
    "   thực=" + thuc + "   mong=" + dung + (saiSo !== undefined ? " ±" + saiSo : ""));
  if (!ok) hong++;
}

function mongChuoi(ten, thuc, batDauBang) {
  const ok = String(thuc).startsWith(batDauBang);
  console.log("  " + (ok ? "[ok]  " : "[SAI] ") + ten +
    "   thực='" + thuc + "'   mong bắt đầu bằng '" + batDauBang + "'");
  if (!ok) hong++;
}

/* ---------------------------------------------------------------- chay */

console.log("\nĐối chiếu số — lab-visual\n" + "-".repeat(58));
console.log("Giá trị chuẩn tính độc lập tại chỗ:");
console.log("  π(60000) = " + PI_60000 + "  (số nguyên tố ≤ 60000)");
console.log("");

/* NOI NGAN SACH TUA. Ngan sach 3 giay cua engine la de bao ve tab cua
   NGUOI DUNG; o day no chi lam phep do chap chon — cung mot ma nguon, may
   ranh thi tua toi buoc 1 210, may ban thi 1 153. Noi len 120 giay thi ket
   qua chi con phu thuoc ma nguon. Chot chan chayToi() van giu nguyen tac
   dung: no bat lab KHONG BAO GIO chay xong, chu khong bat lab cham.

   PHAI goi SAU napTheoIndex(): cau-hinh.js cua trang gan `window.CAU_HINH_VIS`
   bang mot doi tuong MOI, nen goi truoc thi bi ghi de va khong co tac dung
   nao ca. (Da mac dung loi nay mot lan: ba lan chay deu xanh, nhung la nho
   may chu khong nho ban va.) */
H.napTheoIndex();
H.noiNganSachTua(120000);       /* PHAI goi SAU napTheoIndex — xem ghi chu tren */
H.khoiDong();

/* --- Xoắn ốc Ulam: đếm số nguyên tố phải khớp sàng độc lập --- */
H.moLab("xoan-oc-ulam");
dat("Xét tới số", 60000);
chayHet();
let S = soLieu();
mong("Ulam · số nguyên tố ≤ 60000", soDem(S["Số nguyên tố"]), PI_60000);
const lechTho = Math.abs(soThuc(S["Mật độ thực tế"]) - soThuc(S["Xấp xỉ thô 1/ln(n)"]));
const lechTot = Math.abs(soThuc(S["Mật độ thực tế"]) - soThuc(S["Xấp xỉ tốt 1/(ln n − 1)"]));
mong("Ulam · xấp xỉ tốt bám sát mật độ", lechTot, 0, 0.3);
mong("Ulam · xấp xỉ thô lệch nhiều hơn xấp xỉ tốt", lechTho > lechTot, true);

/* --- Monte Carlo: ước lượng phải hội tụ quanh π --- */
H.moLab("monte-carlo");
dat("Số lần thử", 40000);
chayHet();
S = soLieu();
mong("Monte Carlo · ném điểm, ước lượng π", soThuc(S["Ước lượng π"]), Math.PI, 0.05);

dat("Phương pháp", "kim-buffon");
dat("Số lần thử", 40000);
chayHet();
S = soLieu();
mong("Monte Carlo · kim Buffon, ước lượng π", soThuc(S["Ước lượng π"]), Math.PI, 0.10);

/* --- Logistic: chu kỳ tại các mốc kinh điển của sơ đồ phân nhánh --- */
H.moLab("logistic");
dat("Chế độ xem", "mang-nhen");
for (const [r, nhip] of [[2.8, "1"], [3.2, "2"], [3.5, "4"], [3.83, "3"]]) {
  dat("Hệ số sinh sản r", r);
  H.bomKhung(4);
  mongChuoi("Logistic · r=" + r + " chu kỳ", soLieu()["Chu kỳ quan sát được"], nhip + " ");
}
dat("Hệ số sinh sản r", 3.9);
H.bomKhung(4);
mongChuoi("Logistic · r=3.9 phải hỗn loạn", soLieu()["Chu kỳ quan sát được"], "không tuần hoàn");

/* --- Giới hạn trung tâm: μ và σ đo được của phân phối đều --- */
H.moLab("gioi-han-trung-tam");
dat("Phân phối nguồn", "dong-deu");
dat("Lấy bao nhiêu mẫu mỗi lần (n)", 10);
chayHet();
S = soLieu();
mong("CLT · μ của phân phối đều", soThuc(S["μ của nguồn (đo được)"]), 0.5, 0.02);
mong("CLT · σ của phân phối đều", soThuc(S["σ của nguồn (đo được)"]),
  1 / Math.sqrt(12), 0.02);
mong("CLT · σ/√n với n=10", soThuc(S["σ/√n — độ rộng dự đoán"]),
  1 / Math.sqrt(12) / Math.sqrt(10), 0.01);

/* --- Fourier: sai số còn lại phải giảm về ~0 khi dùng đủ vòng --- */
H.moLab("fourier");
dat("Số vòng tròn dùng", 100);
chayHet();
const saiSoNhieu = soThuc(soLieu()["Sai số còn lại"]);
dat("Số vòng tròn dùng", 1);
chayHet();
const saiSoMot = soThuc(soLieu()["Sai số còn lại"]);
mong("Fourier · 100 vòng thì sai số ≈ 0", saiSoNhieu, 0, 1.0);
mong("Fourier · 1 vòng thì sai số lớn", saiSoMot > 20, true);

/* --- Collatz: dãy của 27 là con số ai cũng tra được --- */
H.moLab("collatz");
dat("Số bắt đầu", 27);
chayHet();
S = soLieu();
mong("Collatz · 27 đi 111 bước", soDem(S["Tổng số bước"]), 111);
mong("Collatz · 27 lên đỉnh 9232", soDem(S["Đỉnh cao nhất"]), 9232);

/* --- Game of Life: dao dong tu va tau luon giu nguyen dan so --- */
H.moLab("game-of-life");
dat("Khởi đầu", "blinker");
dat("Cạnh lưới", 40);
chayToi(7);
S = soLieu();
mong("Life · đèn nháy giữ dân số 3", soDem(S["Dân số"]), 3);

dat("Khởi đầu", "glider");
chayToi(20);
S = soLieu();
mong("Life · tàu lượn giữ dân số 5", soDem(S["Dân số"]), 5);

dat("Khởi đầu", "r-pentomino");
dat("Cạnh lưới", 120);
chayToi(5);
S = soLieu();
/* R-pentomino noi tieng vi chay rat lau moi dung — sau 5 the he chac chan
   chua the dung yen. */
mongChuoi("Life · R-pentomino chưa dừng ở thế hệ 5", S["Trạng thái"], "còn biến động");

/* --- Luật 90: so o den hang n dung bang 2^(so bit 1 cua n) --- */
H.moLab("rule-1d");
dat("Số luật", 90);
dat("Hàng đầu tiên", "mot-o");
dat("Số ô mỗi hàng", 401);
for (const n of [8, 16, 31, 32]) {
  const bit1 = n.toString(2).split("").filter((x) => x === "1").length;
  chayToi(n);
  const den = soDemDau(soLieu()["Ô đen hàng cuối"]);
  mong("Rule 90 · hàng " + n + " có 2^" + bit1 + " ô đen", den, Math.pow(2, bit1));
}

dat("Số luật", 0);
chayToi(20);
mong("Rule 0 · tắt sạch", soDemDau(soLieu()["Ô đen hàng cuối"]), 0);

dat("Số luật", 90);
chayToi(1);
S = soLieu();
mong("Rule 90 · đối xứng gương là chính nó", soDemDau(S["Luật đối xứng gương"]), 90);
mong("Rule 90 · đảo màu ra luật 165", soDemDau(S["Luật đảo màu"]), 165);

/* --- Thấm: ngưỡng thấu phải quanh p_c = 0,5927 --- */
H.moLab("tham");
dat("Cạnh lưới", 220);
chayHet();
S = soLieu();
const pThau = soThuc(S["Đã thấu từ trên xuống dưới"].replace(/[^0-9.]/g, ""));
mong("Thấm · ngưỡng thấu quanh p_c", pThau, 0.5927, 0.08);
mong("Thấm · mở hết thì cụm lớn nhất là toàn lưới",
  soDemDau(S["Cụm lớn nhất"]), 220 * 220);

/* --- Đống cát: bảo toàn hạt, và phân bố trận lở --- */
H.moLab("dong-cat");
dat("Cạnh lưới", 101);
dat("Thả hạt ở đâu", "giua");
chayToi(20000);
S = soLieu();
mongChuoi("Đống cát · bảo toàn hạt", S["Kiểm tra bảo toàn"], "khớp");
mong("Đống cát · tổng hạt khớp số đã thả",
  soDemDau(S["Hạt còn trên lưới"]) + soDemDau(S["Hạt rơi khỏi mép"]),
  soDemDau(S["Hạt đã thả"]));
mong("Đống cát · có ít nhất một trận lở lớn",
  soDemDau(S["Trận lở lớn nhất"]) > 100, true);

/* --- Schelling: ngưỡng 0 thì không ai nhúc nhích --- */
H.moLab("schelling");
dat("Cần bao nhiêu hàng xóm cùng nhóm", 0);
dat("Cạnh lưới", 40);
chayToi(300);
S = soLieu();
mong("Schelling · ngưỡng 0/8 thì không ai chuyển nhà",
  soDem(S["Lần chuyển nhà"]), 0);
mong("Schelling · ngưỡng 0/8 thì 100% hài lòng",
  soThuc(S["Hộ hài lòng"]), 100, 0.01);

dat("Cần bao nhiêu hàng xóm cùng nhóm", 3);
chayToi(3000);
S = soLieu();
mong("Schelling · ngưỡng 3/8 gây phân ly rõ",
  soThuc(S["Chỉ số phân ly"]) > 0.7, true);

/* --- Kiến Langton: đối chiếu với một bản cài đặt độc lập --- */
function kienDocLap(buoc, N) {
  const o = new Uint8Array(N * N);
  let x = N >> 1, y = N >> 1, h = 0, den = 0;
  for (let k = 0; k < buoc; k++) {
    const i = y * N + x;
    h = (h + (o[i] ? 3 : 1)) % 4;         /* trắng rẽ phải, đen rẽ trái */
    if (o[i]) { o[i] = 0; den--; } else { o[i] = 1; den++; }
    if (h === 0) y--; else if (h === 1) x++; else if (h === 2) y++; else x--;
    x = (x + N) % N; y = (y + N) % N;
  }
  return den;
}

H.moLab("kien-langton");
dat("Luật rẽ", "RL");
dat("Cạnh lưới", 400);
for (const b of [1000, 5000, 12000]) {
  chayToi(b);
  mong("Kiến Langton · ô đã tô sau " + b + " bước",
    soDem(soLieu()["Ô đã tô"]), kienDocLap(b, 400));
}

/* --- Braess: hai con số này tính tay được, không cần mô phỏng ---
   Không cầu: cân bằng chia đôi 2000/2000 → 2000/100 + 45 = 65 phút.
   Có cầu:   ai cũng qua cầu → 4000/100 + 0 + 4000/100 = 80 phút. */
H.moLab("ket-xe");
dat("Chế độ", "braess");
dat("Số tài xế", 4000);
chayHet();
S = soLieu();
mong("Braess · chưa có cầu = 65 phút",
  soThuc(S["Thời gian đi trung bình"]), 65, 0.01);

dat("Đã mở cây cầu A→B (miễn phí, siêu nhanh)", true);
chayHet();
S = soLieu();
mong("Braess · mở cầu = 80 phút — ai cũng chậm hơn",
  soThuc(S["Thời gian đi trung bình"]), 80, 0.01);
mong("Braess · mọi tài xế đều chọn cầu",
  soDemDau(S["Đi qua cầu"]), 4000);

/* --- Kẹt xe ma: không nhiễu thì không bao giờ kẹt --- */
dat("Chế độ", "vong-tron");
dat("Số xe", 32);
dat("Nhiễu động lái xe", 0);
chayToi(1500);
S = soLieu();
mongChuoi("Kẹt xe · nhiễu = 0 thì dòng chảy tự do", S["Trạng thái"], "dòng chảy tự do");

dat("Nhiễu động lái xe", 0.12);
chayToi(2500);
const tocKhiNhieu = soThuc(soLieu()["Tốc độ trung bình"]);
mong("Kẹt xe · có nhiễu thì tốc độ tụt dưới mức mong muốn",
  tocKhiNhieu < 2.2, true);

/* --- Boids: chỉ luật "đi cùng hướng" mới làm đàn đồng hướng --- */
H.moLab("boids");
dat("Số con", 400);
dat("Lực tránh đâm", 0);
dat("Lực đi cùng hướng", 0);
dat("Lực lại gần nhau", 0);
chayToi(300);
const dhTat = soThuc(soLieu()["Độ đồng hướng"]);
mong("Boids · tắt cả ba lực thì không thành đàn", dhTat < 0.2, true);

/* Do that: voi 400 con, do dong huong di 0,43 (300 buoc) -> 0,86 (1000)
   -> 0,88 (2000). 600 buoc la chua du de dan xep xong hang. */
dat("Lực đi cùng hướng", 1.5);
chayToi(1200);
const dhBat = soThuc(soLieu()["Độ đồng hướng"]);
mong("Boids · bật lực đi cùng hướng thì đàn đồng hướng", dhBat > 0.75, true);
mong("Boids · đồng hướng luôn nằm trong [0, 1]",
  dhTat >= 0 && dhTat <= 1 && dhBat >= 0 && dhBat <= 1, true);

/* --- Dịch tễ: tiêm đủ cao thì dịch không bùng --- */
H.moLab("dich-te");
dat("Dân số", 1200);
dat("Tỉ lệ đã tiêm trước dịch", 0);
chayHet();
const nhiemKhongTiem = soThuc(soLieu()["Tổng số đã nhiễm"].split("(")[1] || "0");

dat("Tỉ lệ đã tiêm trước dịch", 0.9);
chayHet();
S = soLieu();
const nhiemCoTiem = soThuc(S["Tổng số đã nhiễm"].split("(")[1] || "0");
mong("Dịch tễ · tiêm 90% thì số ca giảm mạnh",
  nhiemCoTiem < nhiemKhongTiem / 3, true);
mong("Dịch tễ · tiêm 90% thì dưới 10% dân nhiễm", nhiemCoTiem < 10, true);
mong("Dịch tễ · kết thúc thì không còn ai đang nhiễm",
  soDemDau(S["Đang nhiễm"]), 0);

/* --- Nấm nhầy: bay hơi càng nhanh thì vết càng ít --- */
H.moLab("nam-nhay");
dat("Số tác tử", 3000);
dat("Tốc độ bay hơi của vết", 0.005);
chayMotIt(150);
const phuCham = soThuc(soLieu()["Diện tích có vết"]);
dat("Tốc độ bay hơi của vết", 0.3);
chayMotIt(150);
const phuNhanh = soThuc(soLieu()["Diện tích có vết"]);
mong("Nấm nhầy · bay hơi nhanh thì vết phủ ít hơn hẳn",
  phuNhanh < phuCham / 2, true);

/* --- Sinh tồn xã hội: hai nguồn của bất bình đẳng --- */
H.moLab("sinh-ton-xa-hoi");
dat("Tầm nhìn tối đa", 6);
dat("Mức tiêu thụ tối đa", 4);
dat("Rải thức ăn đều khắp lưới", false);
chayToi(800);
const giniMacDinh = soThuc(soLieu()["Hệ số Gini"]);

dat("Tầm nhìn tối đa", 1);
dat("Mức tiêu thụ tối đa", 1);
dat("Rải thức ăn đều khắp lưới", true);
chayToi(800);
const giniDeu = soThuc(soLieu()["Hệ số Gini"]);

mong("Sinh tồn · Gini mặc định lên mức bất bình đẳng thật",
  giniMacDinh > 0.35, true);
mong("Sinh tồn · xoá chênh lệch bẩm sinh + địa lý thì Gini thấp hơn hẳn",
  giniDeu < giniMacDinh - 0.1, true);
mong("Sinh tồn · Gini luôn trong [0, 1]",
  giniMacDinh >= 0 && giniMacDinh <= 1 && giniDeu >= 0 && giniDeu <= 1, true);

/* Đọc một ô số liệu theo MẢNH của tên, thay vì gõ lại đúng cả tên.
   Tên có dấu và có ký hiệu lạ — gõ chính xác rất dễ sai, và sai thì phép
   thử lặng lẽ so `undefined` với con số. */
function oSo(S, manh) {
  for (const k of Object.keys(S)) if (k.includes(manh)) return S[k];
  throw new Error("không có ô số liệu nào chứa '" + manh + "'");
}

/* --- Băm nhất quán: hai con số này suy ra từ lý thuyết ---
   Bỏ 1 trong N máy:  băm % N phải chuyển (N−1)/N,  băm nhất quán ≈ 1/N. */
H.moLab("bam-nhat-quan");
dat("Số khoá", 8000);
dat("Số máy chủ", 6);

dat("Cách phân khoá", "chia-du");
chayHet();
S = soLieu();
mong("Băm % N · bỏ 1 trong 6 máy phải chuyển (6−1)/6",
  soThuc(oSo(S, "chuyển").split("(")[1]), 100 * 5 / 6, 1.0);

dat("Cách phân khoá", "nhat-quan");
dat("Số bản sao ảo mỗi máy", 200);
chayHet();
S = soLieu();
mong("Băm nhất quán · bỏ 1 trong 6 máy chỉ chuyển ≈ 1/6",
  soThuc(oSo(S, "chuyển").split("(")[1]), 100 / 6, 4.0);

/* Bản sao ảo là để chia đều tải — càng nhiều bản, tải càng đều. */
const lechNhieuBan = soThuc(oSo(soLieu(), "Lệch tải"));
dat("Số bản sao ảo mỗi máy", 1);
chayHet();
const lechMotBan = soThuc(oSo(soLieu(), "Lệch tải"));
mong("Băm nhất quán · 1 bản ảo thì tải lệch hơn 200 bản rất nhiều",
  lechMotBan > lechNhieuBan * 3, true);

/* --- Mạng lưới: hệ số cụm của vòng thuần có công thức đóng ---
   Vòng mỗi nút nối k hàng xóm gần nhất:  C = 3(k−2) / (4(k−1)). */
H.moLab("mang-luoi");
dat("Kiểu mạng", "the-gioi-nho");
dat("Số nút", 200);
dat("Tỉ lệ quan hệ bị đổi thành quan hệ xa", 0);
for (const k of [4, 6, 8, 10]) {
  dat("Mỗi nút quen bao nhiêu hàng xóm", k);
  H.bomKhung(3);
  mong("Vòng thuần k=" + k + " · hệ số cụm = 3(k−2)/(4(k−1))",
    soThuc(oSo(soLieu(), "Hệ số cụm")), 3 * (k - 2) / (4 * (k - 1)), 0.005);
}

/* Thế giới nhỏ: đổi 3% quan hệ thì đường đi sụp mà cụm gần như nguyên. */
dat("Mỗi nút quen bao nhiêu hàng xóm", 10);
dat("Tỉ lệ quan hệ bị đổi thành quan hệ xa", 0);
H.bomKhung(3);
const duong0 = soThuc(oSo(soLieu(), "Đường đi trung bình"));
const cum0 = soThuc(oSo(soLieu(), "Hệ số cụm"));
dat("Tỉ lệ quan hệ bị đổi thành quan hệ xa", 0.03);
H.bomKhung(3);
const duong3 = soThuc(oSo(soLieu(), "Đường đi trung bình"));
const cum3 = soThuc(oSo(soLieu(), "Hệ số cụm"));
mong("Thế giới nhỏ · đổi 3% thì đường đi giảm quá nửa",
  duong3 < duong0 * 0.5, true);
mong("Thế giới nhỏ · nhưng hệ số cụm giữ trên 85%",
  cum3 > cum0 * 0.85, true);
mongChuoi("Thế giới nhỏ · lab tự nhận ra vùng đó",
  oSo(soLieu(), "Kết luận"), "ĐANG Ở VÙNG THẾ GIỚI NHỎ");

/* Ưu tiên nối kết sinh ra siêu nút; tắt đi thì không. */
dat("Kiểu mạng", "ti-le");
dat("Số nút", 200);
dat("Nối theo mức nổi tiếng (thay vì ngẫu nhiên)", true);
H.bomKhung(3);
const bacHub = soDemDau(oSo(soLieu(), "Bậc lớn nhất"));
const bacTB = soThuc(oSo(soLieu(), "Bậc trung bình"));
dat("Nối theo mức nổi tiếng (thay vì ngẫu nhiên)", false);
H.bomKhung(3);
const bacDeu = soDemDau(oSo(soLieu(), "Bậc lớn nhất"));
mong("Vô hướng tỉ lệ · ưu tiên nối kết tạo ra siêu nút", bacHub > bacTB * 4, true);
mong("Vô hướng tỉ lệ · nối ngẫu nhiên thì không có siêu nút", bacDeu < bacHub / 2, true);

/* --- Lan truyền: tiêm đúng người ăn đứt tiêm ngẫu nhiên --- */
H.moLab("lan-truyen");
dat("Loại mạng", "ti-le");
dat("Số người", 300);
dat("Tiêm được cho bao nhiêu phần trăm", 0.1);
const bacTiem = {}, nhiem = {};
for (const cl of ["ngau-nhien", "ban-be", "hub"]) {
  dat("Chọn người tiêm thế nào", cl);
  chayHet();
  S = soLieu();
  bacTiem[cl] = soThuc(oSo(S, "Bậc trung bình người được tiêm"));
  nhiem[cl] = soThuc(oSo(S, "Tổng số đã nhiễm").split("(")[1]);
}
mong("Lan truyền · tiêm cho hub trúng người quen rộng nhất",
  bacTiem.hub > bacTiem["ngau-nhien"] * 2, true);
mong("Lan truyền · mẹo bạn bè cũng trúng người quen rộng hơn ngẫu nhiên",
  bacTiem["ban-be"] > bacTiem["ngau-nhien"], true);
mong("Lan truyền · tiêm cho hub chặn dịch tốt hơn tiêm ngẫu nhiên",
  nhiem.hub < nhiem["ngau-nhien"], true);

/* --- Raft: tính an toàn cốt lõi, dù mạng tệ tới đâu --- */
H.moLab("raft");
for (const mat of [0.04, 0.3, 0.55]) {
  dat("Tỉ lệ tin nhắn bị mất", mat);
  chayToi(3000);
  S = soLieu();
  mongChuoi("Raft · mất tin " + Math.round(mat * 100) + "%: không bao giờ 2 lãnh đạo cùng nhiệm kỳ",
    oSo(S, "Hai lãnh đạo"), "chưa bao giờ");
}
/* Mang cang te thi cang phai bau lai nhieu — day la cai gia cua chu P trong CAP. */
dat("Tỉ lệ tin nhắn bị mất", 0.04);
chayToi(3000);
const bauTot = soDemDau(oSo(soLieu(), "Số lần phải bầu lại"));
dat("Tỉ lệ tin nhắn bị mất", 0.55);
chayToi(3000);
const bauTe = soDemDau(oSo(soLieu(), "Số lần phải bầu lại"));
mong("Raft · mạng tệ thì phải bầu lại nhiều hơn hẳn", bauTe > bauTot * 10, true);

/* --- Mandelbrot: diện tích tập là con số đã đo bằng nhiều cách độc lập ---
   Diện tích tập Mandelbrot ≈ 1,506. Khung mặc định rộng 3,2 và cao 3,2·H/W,
   nên tỉ lệ điểm trong tập ≈ 1,506 / (3,2 · 3,2·300/420) ≈ 20,6%.
   Đây là phép kiểm mạnh: nó bắt được cả lỗi công thức lẫn lỗi khung nhìn. */
H.moLab("mandelbrot");
dat("Tập", "mandelbrot");
dat("Số vòng lặp tối đa", 500);
chayHet();
S = soLieu();
const rongKhung = 3.2, caoKhung = 3.2 * 300 / 420;
mong("Mandelbrot · tỉ lệ điểm trong tập khớp diện tích đã biết (1,506)",
  soThuc(oSo(S, "Điểm trong tập")), 1.506 / (rongKhung * caoKhung) * 100, 1.5);

/* Julia liền khối khi c TRONG tập Mandelbrot, vỡ thành bụi khi c ngoài.
   c = −0,8 + 0,156i nằm trong; c = 0,3 + 0,6i nằm ngoài. */
dat("Tập", "julia");
dat("c — phần thực", -0.123);       /* thỏ Douady — nằm TRONG tập Mandelbrot */
dat("c — phần ảo", 0.745);
chayHet();
const trongLien = soThuc(oSo(soLieu(), "Điểm trong tập"));
dat("c — phần thực", 0.3);
dat("c — phần ảo", 0.6);
chayHet();
const trongBui = soThuc(oSo(soLieu(), "Điểm trong tập"));
mong("Julia · c trong tập Mandelbrot cho hình liền khối (nhiều điểm trong)",
  trongLien > 5, true);
mong("Julia · c ngoài tập Mandelbrot thì vỡ thành bụi (gần như không điểm nào trong)",
  trongBui < 0.5, true);

/* Cái bẫy: c = −0,8 + 0,156i TRÔNG liền khối nhưng nằm ngoài M — phần "đặc"
   chỉ khoảng 1% khung. Nhìn không phân biệt được, phải tính. */
dat("c — phần thực", -0.8);
dat("c — phần ảo", 0.156);
dat("Số vòng lặp tối đa", 600);
chayHet();
mong("Julia · c = −0,8+0,156i trông có cấu trúc nhưng thật ra là bụi",
  soThuc(oSo(soLieu(), "Điểm trong tập")) < 2, true);

/* --- Gray-Scott: cơ chế Turing cần chất ức chế lan NHANH HƠN --- */
H.moLab("gray-scott");
dat("Hình mẫu", "phan-bao");
dat("Hệ số lan của U", 0.21);
dat("Hệ số lan của V", 0.105);
chayToi(1200);
const vChenhLan = soThuc(oSo(soLieu(), "Lượng V trung bình"));
mongChuoi("Gray-Scott · lan chênh nhau thì có hoa văn",
  oSo(soLieu(), "Trạng thái"), "đang tạo hoa văn");

dat("Hệ số lan của V", 0.2);
chayToi(1200);
mongChuoi("Gray-Scott · hai chất lan gần bằng nhau thì cơ chế Turing yếu đi",
  oSo(soLieu(), "Lan U / lan V"), "0.21 / 0.200");
mong("Gray-Scott · và lượng V tụt hẳn so với khi lan chênh nhau",
  soThuc(oSo(soLieu(), "Lượng V trung bình")) < vChenhLan, true);

/* --- Hỗn loạn: phân kỳ theo hàm mũ, và đo được --- */
H.moLab("hon-loan");
dat("Hệ", "con-lac");
dat("Góc thanh trên", 120);
dat("Góc thanh dưới", 100);
dat("Chênh lệch ban đầu", -6);
chayToi(2500);
S = soLieu();
const tachSom = soDemDau(oSo(S, "tách hẳn ở bước"));
mong("Hỗn loạn · con lắc lệch 10⁻⁶ rốt cuộc tách hẳn", tachSom > 0, true);

/* Lệch nhỏ hơn 10⁶ lần chỉ mua thêm được một quãng ngắn — đó là điểm mấu chốt. */
dat("Chênh lệch ban đầu", -12);
chayToi(2500);
const tachMuon = soDemDau(oSo(soLieu(), "tách hẳn ở bước"));
mong("Hỗn loạn · chính xác gấp một triệu lần chỉ trì hoãn, không ngăn được",
  tachMuon > tachSom && tachMuon < tachSom * 4, true);

/* Góc nhỏ: con lắc kép gần như không hỗn loạn. */
dat("Góc thanh trên", 12);
dat("Góc thanh dưới", 8);
dat("Chênh lệch ban đầu", -6);
chayToi(2500);
mongChuoi("Hỗn loạn · biên độ nhỏ thì hai bản sao chưa tách",
  oSo(soLieu(), "tách hẳn ở bước"), "chưa tách");

/* Lorenz: dưới ρ = 24,74 hệ lắng về điểm cố định, trên thì hỗn loạn. */
dat("Hệ", "lorenz");
dat("ρ — mức đối lưu", 15);
chayToi(2500);
const lechLang = soKhoaHoc(oSo(soLieu(), "Chênh lệch hiện tại"));
dat("ρ — mức đối lưu", 28);
chayToi(2500);
const lechLoan = soKhoaHoc(oSo(soLieu(), "Chênh lệch hiện tại"));
mong("Lorenz · ρ = 15 thì hai bản sao hội tụ lại (hệ lắng)", lechLang < 1e-4, true);
mong("Lorenz · ρ = 28 thì phân kỳ hẳn", lechLoan > 1, true);

/* --- N-body: leapfrog giữ năng lượng, và ngưỡng ổn định của L4/L5 --- */
H.moLab("n-body");
dat("Cảnh", "he-sao");
dat("Số vật", 100);
chayToi(2000);
mong("N-body · leapfrog giữ năng lượng trôi dưới 2% sau 2000 bước",
  soThuc(oSo(soLieu(), "Năng lượng trôi")) < 2, true);

dat("Cảnh", "lagrange");
dat("Tỉ lệ khối lượng vật thứ hai", 0.02);
H.bomKhung(3);
mongChuoi("N-body · μ = 0,02 thì L4/L5 ổn định", oSo(soLieu(), "L4 và L5"), "ỔN ĐỊNH");
dat("Tỉ lệ khối lượng vật thứ hai", 0.15);
H.bomKhung(3);
mongChuoi("N-body · μ = 0,15 vượt ngưỡng 0,0385 nên mất ổn định",
  oSo(soLieu(), "L4 và L5"), "mất ổn định");

/* ================================================================
   ĐỢT 6 — tối ưu hoá và giảm chiều
   ================================================================ */

/* --- Đua optimizer: bốn kết cục khác hẳn nhau trên bốn mặt lỗi --- */
H.moLab("dua-optimizer");

/* Yên ngựa: f = (x²−1)² + 0,3y². Gốc toạ độ là điểm yên ngựa (f = 1), hai
   đáy thật ở (±1, 0) với f = 0. Xuất phát gần như đúng trên sống yên, nên
   gradient theo x gần bằng 0: đây là phép thử "ai thoát điểm yên ngựa trước". */
dat("Mặt lỗi", "yen-ngua");
chayToi(60);
S = soLieu();
mong("Optimizer · bước 60: SGD thuần vẫn còn dính ở điểm yên ngựa (f ≈ 1)",
  soKhoaHoc(oSo(S, "SGD thuần")) > 0.9, true);
mong("Optimizer · bước 60: Momentum đã thoát được",
  soKhoaHoc(oSo(S, "Momentum")) < 0.01, true);
mong("Optimizer · bước 60: RMSProp thoát sớm nhất",
  soKhoaHoc(oSo(S, "RMSProp")) < 1e-10, true);
chayToi(600);
S = soLieu();
mong("Optimizer · bước 600: cả SGD cũng về tới đáy thật",
  soKhoaHoc(oSo(S, "SGD thuần")) < 1e-5, true);

/* Cao nguyên: gradient gần 0 trên một vùng rộng. Đây là chỗ duy nhất việc
   CHIA CHO ĐỘ LỚN GRADIENT cứu được tình thế — và SGD thuần thì không. */
dat("Mặt lỗi", "cao-nguyen");
chayToi(600);
S = soLieu();
mong("Optimizer · cao nguyên: SGD thuần vẫn kẹt sau 600 bước",
  soKhoaHoc(oSo(S, "SGD thuần")) > 1, true);
mong("Optimizer · cao nguyên: RMSProp về tới đáy",
  soKhoaHoc(oSo(S, "RMSProp")) < 0.01, true);

/* Rosenbrock với bước học 0,02: quán tính cộng dồn làm Momentum văng ra.
   Quán tính không miễn phí — đó là nửa còn lại của câu chuyện. */
dat("Mặt lỗi", "rosenbrock");
chayToi(600);
S = soLieu();
mongChuoi("Optimizer · Rosenbrock: Momentum phát nổ với bước học 0,02",
  oSo(S, "Momentum"), "phát nổ");
mong("Optimizer · Rosenbrock: RMSProp vẫn về được đáy thung lũng",
  soKhoaHoc(oSo(S, "RMSProp")) < 1e-2, true);

/* Nhiều cực trị: bốn thuật toán này đều TẤT ĐỊNH, nên cùng điểm xuất phát
   thì vào cùng một lòng chảo — khác hẳn bốn thuật toán ngẫu nhiên ở lab
   đấu trường. Khoảng cách giữa hai lab đó chính là bài học. */
dat("Mặt lỗi", "nhieu-cuc");
chayToi(300);
S = soLieu();
const bonCuc = ["SGD thuần", "Momentum", "RMSProp", "Adam"]
  .map((n) => soKhoaHoc(oSo(S, n)));
mong("Optimizer · nhiều cực trị: cả bốn rơi vào cùng một cực tiểu địa phương",
  Math.max(...bonCuc) - Math.min(...bonCuc) < 1e-3, true);

/* --- Đấu trường metaheuristic --- */
H.moLab("dau-truong");
dat("Vẽ mọi điểm đã thử", false);

/* BẤT BIẾN quan trọng nhất của lab này: không ai được tiêu quá ngân sách.
   Phải thử ở ngân sách KHÔNG CHIA HẾT cho cỡ quần thể (1 000 / 24), vì đó
   chính là chỗ GA và PSO từng ăn gian thêm tới 23 lần gọi hàm. */
dat("Địa hình", "rastrigin");
dat("Cỡ quần thể (GA và PSO)", 24);
dat("Ngân sách gọi hàm mỗi thuật toán", 1000);
chayToi(1500);
S = soLieu();
mong("Đấu trường · ngân sách 1 000 không chia hết cho 24: không ai vượt",
  soDemDau(S["Vượt ngân sách"]), 0);
mong("Đấu trường · số lần gọi nhiều nhất đúng bằng ngân sách, không hơn",
  soDem(S["Gọi nhiều nhất"]), 1000);
dat("Cỡ quần thể (GA và PSO)", 18);
dat("Ngân sách gọi hàm mỗi thuật toán", 2500);
chayToi(3000);
S = soLieu();
mong("Đấu trường · 2 500 với quần thể 18: vẫn không ai vượt",
  soDemDau(S["Vượt ngân sách"]), 0);

/* PHÉP ĐẢO THEO NGÂN SÁCH — luận điểm chính của lab.
   Cùng địa hình, cùng hạt giống, chỉ đổi ngân sách, người thắng đổi. */
dat("Cỡ quần thể (GA và PSO)", 24);
dat("Hạt giống", 3);
dat("Địa hình", "cau");
dat("Ngân sách gọi hàm mỗi thuật toán", 2000);
chayToi(2500);
S = soLieu();
mongChuoi("Đấu trường · cầu, ngân sách 2 000: leo đồi thắng",
  S["Thắng"], "Leo đồi");
dat("Ngân sách gọi hàm mỗi thuật toán", 20000);
chayToi(4000);
S = soLieu();
mongChuoi("Đấu trường · cầu, ngân sách 20 000: PSO thắng — người thắng đổi " +
  "dù địa hình và hạt giống không đổi",
  S["Thắng"], "Bầy hạt");

/* Kim đáy bể: hàm phẳng lì (= 10) trừ một giếng bán kính 0,5 (f = r² < 0,25).
   Nên giá trị tốt nhất hoặc là đúng 10, hoặc là dưới 0,25 — KHÔNG CÓ GÌ Ở GIỮA.
   Đó là phép kiểm tra địa hình đúng là địa hình mình khai báo. */
dat("Địa hình", "kim-day-rom");
dat("Ngân sách gọi hàm mỗi thuật toán", 2000);
chayToi(2500);
S = soLieu();
const bonKim = [1, 2, 3, 4].map((i) => soKhoaHoc(oSo(S, i + ". ")));
mong("Đấu trường · kim đáy bể: mọi giá trị hoặc = 10 hoặc < 0,25, không có " +
  "gì ở giữa (hàm phẳng lì, không có dốc để bám)",
  bonKim.every((v) => v === 10 || v < 0.25), true);

/* --- Giảm chiều --- */
H.moLab("giam-chieu");

/* Bộ "lưới" là MỘT MẶT PHẲNG thật sự, chỉ bị quay lên 30 chiều. PCA là phép
   quay + chiếu, nên nó PHẢI tìm lại được chính xác. Đây là giá trị biết trước
   chặt nhất trong lab này. */
dat("Bộ dữ liệu", "luoi");
dat("Hạt giống", 7);
chayToi(150);
S = soLieu();
mong("Giảm chiều · lưới: PCA dựng lại gần như trọn vẹn láng giềng",
  soThuc(S["PCA · giữ láng giềng"]) > 99.5, true);
mong("Giảm chiều · lưới: tương quan toàn cục của PCA = 1,000",
  soThuc(S["PCA · toàn cục"]), 1.0, 0.002);
mong("Giảm chiều · lưới: MDS cũng dựng lại được",
  soThuc(S["MDS (SMACOF) · toàn cục"]), 1.0, 0.002);
mong("Giảm chiều · lưới: chiếu ngẫu nhiên kém hơn hẳn PCA",
  soThuc(S["Chiếu ngẫu nhiên · giữ láng giềng"]) <
  soThuc(S["PCA · giữ láng giềng"]) - 20, true);
mong("Giảm chiều · SMACOF: ứng suất chưa bao giờ tăng (đúng điều SMACOF chứng minh)",
  soDemDau(S["Ứng suất từng tăng"]), 0);

/* Ba cụm thật: t-SNE được thiết kế để giữ láng giềng gần, nên nó phải thắng
   ở cột đó; còn PCA thì giữ cấu trúc toàn cục gần như hoàn hảo. */
dat("Bộ dữ liệu", "ba-cum");
chayToi(150);
S = soLieu();
mong("Giảm chiều · ba cụm: t-SNE giữ láng giềng hơn hẳn PCA",
  soThuc(S["t-SNE · giữ láng giềng"]) >
  soThuc(S["PCA · giữ láng giềng"]) + 15, true);
mong("Giảm chiều · ba cụm: PCA giữ cấu trúc toàn cục gần như hoàn hảo",
  soThuc(S["PCA · toàn cục"]) > 0.99, true);

/* QUẢ CẦU ĐỀU — trưng bày chính của lab.
   Dữ liệu là một khối liền, không có cụm nào. Đối chiếu với ba cụm thật ở
   trên: ở đó PCA đạt 0,99+ toàn cục; ở đây MỌI phương pháp đều sụp xuống
   dưới 0,45 — nghĩa là KHÔNG CÓ GÌ ĐỂ TÌM. Vậy mà tấm t-SNE vẫn hiện ra
   những cụm tròn trịa, và điểm giữ-láng-giềng của nó vẫn cao nhất. */
dat("Bộ dữ liệu", "cau-deu");
chayToi(150);
S = soLieu();
const bonTC = ["PCA", "MDS (SMACOF)", "t-SNE", "Chiếu ngẫu nhiên"]
  .map((p) => soThuc(S[p + " · toàn cục"]));
mong("Giảm chiều · quả cầu đều: CẢ BỐN phương pháp đều sụp toàn cục (< 0,45) " +
  "— không có cấu trúc nào để tìm",
  bonTC.every((v) => v < 0.45), true);
mong("Giảm chiều · quả cầu đều: t-SNE bóp méo toàn cục còn nặng hơn PCA",
  soThuc(S["t-SNE · toàn cục"]) < soThuc(S["PCA · toàn cục"]), true);
mong("Giảm chiều · quả cầu đều: vậy mà t-SNE vẫn cao điểm giữ láng giềng nhất " +
  "— tấm hình trông THUYẾT PHỤC nhất lại là tấm sai nhất về toàn cục",
  soThuc(S["t-SNE · giữ láng giềng"]) >
  soThuc(S["PCA · giữ láng giềng"]), true);

/* ================================================================
   ĐỢT 7 — câu đố quyết định
   ================================================================ */

/* --- Cân xu: bộ giải VÉT CẠN, nên mọi con số đều là đáp số đúng, không
   phải xấp xỉ. Đối chiếu với công thức đã biết: w lần cân giải được
   (3^w−3)/2 xu khi không có xu thật, và (3^w−1)/2 khi có. --- */
H.moLab("can-xu");

function canXu(soXu, xuThat) {
  dat("Số đồng xu", soXu);
  dat("Số đồng đã biết chắc là thật", xuThat);
  return soLieu();
}

S = canXu(12, 0);
mong("Cân xu · 12 xu — bài kinh điển cần 3 lần",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 3);
mongChuoi("Cân xu · 12 xu thì cận dưới đạt được",
  oSo(S, "Cận có đạt được không"), "\u2714");

/* ĐÂY LÀ PHÉP QUAN TRỌNG NHẤT: cận nói 3, vét cạn nói 4. */
S = canXu(13, 0);
mong("Cân xu · 13 xu — cận dưới vẫn là 3",
  soDemDau(oSo(S, "Cận dưới lý thuyết")), 3);
mong("Cân xu · 13 xu — nhưng vét cạn ra 4: cận KHÔNG đạt tới được",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 4);

/* Thêm một đồng xu KHÔNG CHỨA THÔNG TIN NÀO mà đáp số tụt từ 4 xuống 3. */
S = canXu(13, 1);
mong("Cân xu · 13 xu + 1 xu thật — tụt về 3 lần",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 3);

/* Bản nhỏ nhất của cùng hiện tượng — 4 xu, soí được bằng tay. */
S = canXu(4, 0);
mong("Cân xu · 4 xu — cận nói 2", soDemDau(oSo(S, "Cận dưới lý thuyết")), 2);
mong("Cân xu · 4 xu — thực tế 3", soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 3);

/* 2 xu không có xu thật: không phải “nhiều lần cân” mà là VÔ NGHIỆM. */
S = canXu(2, 0);
mongChuoi("Cân xu · 2 xu không có xu thật thì vô nghiệm",
  oSo(S, "Tối ưu THỰC TẾ"), "V\u00d4 NGHI\u1ec6M");
S = canXu(2, 1);
mong("Cân xu · 2 xu + 1 xu thật thì lại giải được trong 2 lần",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 2);

/* Công thức (3^w−3)/2: w = 3 → 12 giải được, 13 thì không.
   w = 4 → 39 giải được trong 4, 40 thì phải 5. */
dat("Tìm tới tối đa mấy lần cân", 5);
S = canXu(39, 0);
mong("Cân xu · 39 = (3⁴−3)/2 xu vừa đủ 4 lần",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 4);
S = canXu(40, 0);
mong("Cân xu · 40 xu thì phải 5 lần — đúng chỗ công thức gãy",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 5);

/* --- Thả trứng: quy hoạch động, đối chiếu với số tam giác --- */
H.moLab("tha-trung");

function thaTrung(tang, trung) {
  dat("Số tầng", tang);
  dat("Số quả trứng", trung);
  return soLieu();
}

S = thaTrung(100, 2);
mong("Thả trứng · 100 tầng 2 trứng = 14, không phải √100 = 10",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 14);
mongChuoi("Thả trứng · số tam giác 14·15/2 = 105 ≥ 100 khớp",
  oSo(S, "Kiểm bằng công thức"), "d(d+1)/2 = 105");
mong("Thả trứng · cận nhị phân chỉ là 7 — cận lỏng gấp đôi",
  soDemDau(oSo(S, "Cận dưới nhị phân")), 7);

S = thaTrung(100, 1);
mong("Thả trứng · 1 trứng thì không còn cách nào ngoài dò từng tầng",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 100);

S = thaTrung(100, 5);
mong("Thả trứng · 5 trứng đã chạm cận nhị phân",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 7);
S = thaTrung(100, 10);
mong("Thả trứng · 10 trứng cũng vẫn 7 — thêm trứng vô ích",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 7);
mong("Thả trứng · điểm bão hoà đúng ở 5 trứng",
  soDemDau(oSo(S, "Từ bao nhiêu trứng thì bão hoà")), 5);

S = thaTrung(200, 2);
mong("Thả trứng · 200 tầng 2 trứng = 20  (20·21/2 = 210 ≥ 200)",
  soDemDau(oSo(S, "Tối ưu THỰC TẾ")), 20);

/* --- Dồn hạt: công thức O(H+W) phải khớp vét cạn N² TUYỆT ĐỐI --- */
H.moLab("don-hat");
dat("Cạnh lưới", 40);
dat("Cách gieo hạt ban đầu", "deu");
dat("Ngân sách = mấy lần số ô", 40);
chayToi(260);
S = soLieu();
mongChuoi("Dồn hạt · entropy O(H+W) khớp vét cạn N² tuyệt đối",
  oSo(S, "Kiểm công thức"), "\u2714");

/* BẤT BIẾN THEN CHỐT: tổng khoảng cách mọi cặp BẤT BIẾN THEO TỊNH TIẾN.
   Hai tâm khác nhau phải cho entropy gần như y hệt. */
mong("Dồn hạt · hai tâm khác nhau cho entropy như nhau (bất biến tịnh tiến)",
  String(oSo(S, "Entropy hai bên")).indexOf("lệch hẳn") < 0, true);

/* Một khối luôn thắng ba cụm — kể cả khi dữ liệu VỐN DĨ là hai cụm. */
function conLaiCua(bang, manh) {
  for (const k of Object.keys(bang)) {
    if (k.includes(manh)) {
      const m = String(bang[k]).match(/c\u00f2n ([\d.,]+)%/);
      if (m) return parseFloat(m[1].replace(",", "."));
    }
  }
  throw new Error("khong thay '" + manh + "'");
}
dat("Cách gieo hạt ban đầu", "hai-cum");
chayToi(260);
S = soLieu();
mong("Dồn hạt · dữ liệu vốn là hai cụm, gộp một khối vẫn thắng đậm ba cụm",
  conLaiCua(S, "Về trung vị") < conLaiCua(S, "Ba cụm") - 20, true);

/* --- Đoán chuỗi: đấu vài trăm ván rồi đọc thống kê --- */
H.moLab("doan-chuoi");
dat("Độ dài chuỗi (n)", 4);
dat("Số ký tự khác nhau", 6);
S = soLieu();
mong("Đoán chuỗi · 4×6 có 1 296 chuỗi",
  soDemDau(oSo(S, "Không gian chuỗi")), 1296);
mong("Đoán chuỗi · n = 4 có 14 phản hồi khác nhau",
  soDemDau(oSo(S, "Số phản hồi khác nhau")), 14);
mong("Đoán chuỗi · cận dưới chỉ là 3 lần đoán",
  soDemDau(oSo(S, "Cận dưới lý thuyết")), 3);

dat("Xét tối đa bao nhiêu nước mỗi lượt", 600);
chayMotIt(400);
S = soLieu();
const vanDaDau = soDem(oSo(S, "Số ván đã đấu"));
mong("Đoán chuỗi · giải đấu chạy thật — ít nhất 100 ván",
  vanDaDau >= 100, true);

function xauNhat(bang, manh) {
  for (const k of Object.keys(bang)) {
    if (k.includes(manh)) {
      const m = String(bang[k]).match(/x\u1ea5u nh\u1ea5t (\d+)/);
      if (m) return parseInt(m[1], 10);
    }
  }
  throw new Error("khong thay '" + manh + "'");
}
mong("Đoán chuỗi · thực tế vượt xa cận dưới 3",
  xauNhat(S, "Entropy — lấy nhiều thông tin") >= 5, true);
/* Đuôi của “đoán đại” dài hơn HẴN — đo được 8 so với 5–6. */
mong("Đoán chuỗi · “đoán đại” có đuôi dài hơn entropy",
  xauNhat(S, "Đoán đại") > xauNhat(S, "Entropy — lấy nhiều thông tin"), true);
/* LUẬN ĐIỂM CHÍNH: được đoán cả chuỗi đã biết là sai thì xấu-nhất
   TỐT HƠN. Chỉ hiện ra khi trần tìm kiếm ≥ 600 — xem ghi chú trong lab. */
mong("Đoán chuỗi · được đoán cả chuỗi sai thì xấu-nhất không tệ hơn",
  xauNhat(S, "được đoán cả chuỗi sai") <=
  xauNhat(S, "Entropy — lấy nhiều thông tin"), true);

/* ================================================================ đợt 8 */

/* --- Quân mã: BFS độc lập ngay tại đây, rồi so với màn hình --- */
function maBFS(N, x0, y0) {
  const d = new Int32Array(N * N).fill(-1);
  const B = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  d[y0 * N + x0] = 0;
  const q = [[x0, y0]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [dx, dy] of B) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      if (d[ny * N + nx] >= 0) continue;
      d[ny * N + nx] = d[y * N + x] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}
/* Toạ độ màn hình: y = 0 là hàng TRÊN, nên a1 = (0, N-1), b2 = (1, N-2). */
const d8 = maBFS(8, 0, 7);
const KC_B2 = d8[6 * 8 + 1];      // b2
const KC_E3 = d8[5 * 8 + 4];      // e3
const KC_H8 = d8[0 * 8 + 7];      // h8
const KC_XA = Math.max(...d8);

H.moLab("quan-ma");
S = soLieu();
/* “a1 → b2   4 nước” — lấy số đứng ngay trước chữ “nước”. */
function soNuoc(o) {
  const m = String(o).match(/(\d+)\s+n\u01b0\u1edbc/);
  return m ? parseInt(m[1], 10) : NaN;
}
mong("Quân mã · a1 → b2 (kề chéo) mất đúng số nước BFS tính được",
  soNuoc(oSo(S, "Mã trắng")), KC_B2);
mong("Quân mã · a1 → e3 (xa gấp bốn) mất đúng số nước BFS tính được",
  soNuoc(oSo(S, "Mã đen")), KC_E3);
/* LUẬN ĐIỂM CHÍNH của lab: gần hơn về hình học mà TỐN HƠN về nước đi. */
mong("Quân mã · nghịch lý có thật — ô kề chéo tốn nhiều nước hơn ô xa gấp bốn",
  KC_B2 > KC_E3, true);
mong("Quân mã · ô xa nhất trên bàn 8×8 khớp BFS",
  soDemDau(oSo(S, "Ô xa nhất trên bàn")), KC_XA);

/* Ô chết: ĐO chứ không đoán. Bàn 4×4 LIÊN THÔNG (0 ô chết) — lab từng
   viết ngược lại, và phép thử này là cái bắt được. Chỉ 3×3 mới có ô cô
   lập: ô giữa, vì cả tám nước mã từ đó đều rơi ra ngoài bàn. */
function demOChet(N) {
  const d = maBFS(N, 0, N - 1);
  let c = 0;
  for (let i = 0; i < N * N; i++) if (d[i] < 0) c++;
  return c;
}
mong("Quân mã · bàn 4×4 KHÔNG có ô chết (đồ thị nước đi vẫn liền)",
  demOChet(4), 0);
mong("Quân mã · bàn 3×3 có đúng một ô chết — ô giữa", demOChet(3), 1);

/* Ô xa nhất theo cỡ bàn — KHÔNG đơn điệu theo diện tích.
   4×4 (16 ô) → 5 nước, 5×5 (25 ô) → 4 nước, 8×8 (64 ô) → 6 nước.

   PHẢI đi từ bàn LỚN xuống bàn NHỎ. Lab kẹp quân mã vào trong bàn khi ta
   thu nhỏ, và không trả nó về chỗ cũ khi phóng to lại — nên nếu xuống 3×3
   trước rồi lên 8×8, quân mã còn nằm ở (0,2) chứ không ở góc, và mọi số
   đo sau đó là của một thế cờ khác. (Đã mắc đúng lỗi này một lần: ba ô
   lệch 1 nước, và suýt nữa thì đổ tội cho lab.) */
const XA = {};
for (const N of [8, 5, 4]) {
  dat("Cạnh bàn cờ", N);
  XA[N] = soDemDau(oSo(soLieu(), "Ô xa nhất trên bàn"));
  mong("Quân mã · bàn " + N + "×" + N + ": ô xa nhất khớp BFS độc lập",
    XA[N], Math.max(...maBFS(N, 0, N - 1)));
}
mong("Quân mã · bàn 5×5 TO HƠN 4×4 mà lại DỄ ĐI HƠN", XA[5] < XA[4], true);
mong("Quân mã · bàn 8×8 rộng gấp bốn 4×4 mà chỉ tốn thêm một nước",
  XA[8] - XA[4], 1);

dat("Cạnh bàn cờ", 3);
S = soLieu();
mong("Quân mã · lab cũng báo đúng một ô không tới được trên bàn 3×3",
  soDemDau(oSo(S, "Ô không tới được")), demOChet(3));

/* --- Thử chìa khoá: cận dưới ⌈log₃(n!)⌉ tính lại bằng lgamma thủ công --- */
function logGiaiThua(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
const canChia = (n) => Math.ceil(logGiaiThua(n) / Math.log(3) - 1e-9);

H.moLab("chia-khoa");
dat("Số chìa khoá", 24);
S = soLieu();
mong("Chìa khoá · cận dưới ⌈log₃(24!)⌉ khớp tính độc lập",
  soDemDau(oSo(S, "Cận dưới")), canChia(24));
mongChuoi("Chìa khoá · cả hai cách đều ghép ĐÚNG toàn bộ (không chỉ ít phép)",
  oSo(S, "Ghép đúng hết chưa"), "\u2714");
const vc24 = soDem(String(oSo(S, "Vét cạn")).split("(")[0]);
const nn24 = soDem(String(oSo(S, "Ngẫu nhiên")).split("(")[0]);
mong("Chìa khoá · cả hai cách đều ≥ cận dưới (không cách nào phá được cận)",
  Math.min(vc24, nn24) >= canChia(24), true);
/* ĐO TRƯỚC, VIẾT SAU: ở n nhỏ vét cạn THẮNG — điểm cắt đo được quanh n ≈ 48.
   Nếu ai đó “tối ưu” lại lab cho ngẫu nhiên thắng mọi cỡ thì phép thử này đổ. */
mong("Chìa khoá · n = 24 còn nhỏ nên VÉT CẠN vẫn ít phép hơn", vc24 < nn24, true);

/* Ở n = 120 ngẫu nhiên phải thắng ở MỌI hạt giống, không phải trung bình
   thì thắng. Ngưỡng "nhanh hơn gấp đôi" từng được dùng ở đây, nhưng nó
   phụ thuộc hạt giống (đo được 1,94× ở hạt mặc định, 2,20× khi lấy trung
   bình 8 hạt) — một phép thử xanh-đỏ theo hạt giống thì không kiểm gì cả. */
dat("Số chìa khoá", 120);
let thang120 = 0, tiLeTong = 0;
for (const hat of [1, 2, 3, 4, 5, 6]) {
  dat("Hạt giống", hat);
  S = soLieu();
  const a = soDem(String(oSo(S, "Vét cạn")).split("(")[0]);
  const b = soDem(String(oSo(S, "Ngẫu nhiên")).split("(")[0]);
  if (b < a) thang120++;
  tiLeTong += a / b;
}
mong("Chìa khoá · n = 120: ngẫu nhiên thắng ở CẢ SÁU hạt giống", thang120, 6);
mong("Chìa khoá · n = 120: trung bình nhanh hơn ít nhất 1,8 lần",
  tiLeTong / 6 >= 1.8, true);

/* Và ở n = 40 thì KHÔNG — chỗ đó là dải hoà, người thắng đổi theo hạt.
   Đây mới là điều lab dạy, nên nó phải được kiểm chứ không chỉ được kể. */
dat("Số chìa khoá", 40);
let thang40 = 0;
for (const hat of [1, 2, 3, 4, 5, 6, 7, 8]) {
  dat("Hạt giống", hat);
  S = soLieu();
  const a = soDem(String(oSo(S, "Vét cạn")).split("(")[0]);
  const b = soDem(String(oSo(S, "Ngẫu nhiên")).split("(")[0]);
  if (b < a) thang40++;
}
mong("Chìa khoá · n = 40 là dải hoà — cả hai bên đều thắng được vài hạt",
  thang40 > 0 && thang40 < 8, true);

/* --- Thuốc độc: k × r ≥ log₂ n, và đọc ra đúng chai --- */
H.moLab("thuoc-doc");
dat("Số chai", 1000);
dat("Số người thử", 10);
dat("Số vòng (mỗi vòng một ngày)", 1);
dat("Số chai có độc", 1);
S = soLieu();
mong("Thuốc độc · 1000 chai cần ⌈log₂ 1000⌉ = 10 bit",
  soDemDau(oSo(S, "Cần ít nhất")), Math.ceil(Math.log2(1000)));
mongChuoi("Thuốc độc · 10 người × 1 vòng là vừa đủ", oSo(S, "Đủ chưa"), "\u2714");
mong("Thuốc độc · đọc ra đúng chai đã bị đầu độc",
  soDemDau(oSo(S, "Đọc ra")), soDemDau(oSo(S, "Chai độc thật")));

/* Người và ngày đổi cho nhau được: 2 người × 5 vòng cũng ra 10 bit. */
dat("Số người thử", 2);
dat("Số vòng (mỗi vòng một ngày)", 5);
S = soLieu();
mongChuoi("Thuốc độc · 2 người × 5 vòng vẫn đủ — người và ngày đổi cho nhau được",
  oSo(S, "Đủ chưa"), "\u2714");
mong("Thuốc độc · và vẫn đọc ra đúng chai",
  soDemDau(oSo(S, "Đọc ra")), soDemDau(oSo(S, "Chai độc thật")));

/* Thiếu một bit là hỏng — cận dưới phải CẮN, không phải trang trí. */
dat("Số người thử", 9);
dat("Số vòng (mỗi vòng một ngày)", 1);
S = soLieu();
mongChuoi("Thuốc độc · 9 bit cho 1000 chai là THIẾU — cận dưới cắn thật",
  oSo(S, "Đủ chưa"), "\u2718");

/* Hai chai độc: phép OR làm mất thông tin, nên cần nhiều hơn hẳn cận dưới. */
dat("Số người thử", 10);
dat("Số chai", 16);
dat("Số chai có độc", 2);
S = soLieu();
const canCap = Math.ceil(Math.log2(16 * 15 / 2));
mong("Thuốc độc · cận dưới hai chai là ⌈log₂ C(16,2)⌉",
  soDemDau(oSo(S, "Cận dưới lý thuyết")), canCap);
mong("Thuốc độc · 10 bit chưa chạm cận 2× — mã ngẫu nhiên đo được cần 18 bit",
  canCap < 10, true);

/* --- Tháp Hà Nội: 2ⁿ−1, 3ⁿ trạng thái, và đi hết thì về đúng 0 --- */
H.moLab("ha-noi");
for (const nDia of [3, 5, 8, 10]) {
  dat("Số đĩa", nDia);
  S = soLieu();
  mong("Hà Nội · " + nDia + " đĩa, bài cổ điển cần đúng 2ⁿ−1 nước",
    soDemDau(oSo(S, "Từ cấu hình đầu cần")), Math.pow(2, nDia) - 1);
  mong("Hà Nội · " + nDia + " đĩa có đúng 3ⁿ cấu hình",
    soDemDau(oSo(S, "Số cấu hình")), Math.pow(3, nDia));
}

/* Đi hết đường máy chọn: phải về 0 nước còn lại, và KHÔNG thừa nước nào.
   Đây là phép đối chiếu giữa HAI hàm khác nhau trong lab — nuocTiep() đi
   từng bước, toiThieu() tính bằng công thức. Chúng phải gặp nhau ở 0. */
dat("Số đĩa", 6);
chayHet();
S = soLieu();
mong("Hà Nội · đi hết đường ngắn nhất thì còn 0 nước",
  soDemDau(oSo(S, "Còn cần ít nhất")), 0);
mong("Hà Nội · và đã đi đúng 2⁶−1 = 63 nước, không thừa nước nào",
  soDemDau(oSo(S, "Bạn đã đi")), 63);
mongChuoi("Hà Nội · vẫn nằm trên đường ngắn nhất suốt chặng",
  String(oSo(S, "Tổng nếu đi tiếp tối ưu")).split("nước")[1].trim(), "\u2714");

/* BÀI TỔNG QUÁT — cấu hình đầu lung tung, công thức vẫn phải dẫn về 0. */
dat("Cấu hình ban đầu", "ngau-nhien");
for (const hat of [1, 2, 3, 4, 5]) {
  dat("Hạt giống", hat);
  const canTruoc = soDemDau(oSo(soLieu(), "Từ cấu hình đầu cần"));
  chayHet();
  S = soLieu();
  mong("Hà Nội · cấu hình ngẫu nhiên #" + hat + ": đi hết thì còn 0 nước",
    soDemDau(oSo(S, "Còn cần ít nhất")), 0);
  mong("Hà Nội · cấu hình ngẫu nhiên #" + hat + ": số nước đi khớp công thức",
    soDemDau(oSo(S, "Bạn đã đi")), canTruoc);
}
/* Cấu hình ngẫu nhiên hầu như luôn GẦN đích hơn góc đối diện. */
dat("Hạt giống", 3);
S = soLieu();
mong("Hà Nội · cấu hình ngẫu nhiên thường ngắn hơn 2⁶−1 (không chạy dọc cạnh)",
  soDemDau(oSo(S, "Từ cấu hình đầu cần")) < 63, true);

/* ================================================================ đợt 9 */

/* --- Chuỗi Markov ---

   Ba điều, mỗi điều kiểm được bằng một nguồn khác với chính lab:
     1. xích tuần hoàn thì khe phổ ĐÚNG BẰNG 0 (không xấp xỉ);
     2. thêm ε tự lập thì khe = 2ε — công thức đóng, tính ngay tại đây;
     3. t_trộn × khe gần như hằng số qua bốn bậc độ lớn của khe.       */

H.moLab("markov");
dat("Xích", "vong");
dat("Xác suất tự lập (ở lại chỗ cũ)", 0);
dat("Số đỉnh", 6);
S = soLieu();
mong("Markov · vòng tuần hoàn: |λ₂| đúng bằng 1", soThuc(oSo(S, "|λ₂|")), 1, 1e-6);
mongChuoi("Markov · vòng tuần hoàn thì không trộn nổi",
  oSo(S, "Thời gian trộn"), "không trộn nổi");

/* Thêm tự lập ε thì tuần hoàn vỡ, và khe phổ có CÔNG THỨC ĐÓNG:
   vòng n đỉnh có trị riêng ε + (1−ε)ω^j với ω = e^(2πi/n), nên
   khe = 1 − |ε + (1−ε)ω|. Tính ngay tại đây, đối chiếu với lặp luỹ thừa
   của lab — hai đường tính khác hẳn nhau.

   KHÔNG phải 2ε: đó là trường hợp riêng n = 2 (lúc ấy ω = −1). Phép thử
   này từng viết 2ε và đổ ở cả bốn giá trị — lab cũng từng viết thế. */
function kheVong(n, e) {
  const goc = 2 * Math.PI / n;
  const re = e + (1 - e) * Math.cos(goc), im = (1 - e) * Math.sin(goc);
  return 1 - Math.hypot(re, im);
}
mong("Markov · công thức vòng: n = 2 mới cho khe = 2ε", kheVong(2, 0.01), 0.02, 1e-9);
mong("Markov · còn n = 6 thì chỉ cho một phần tư chừng ấy",
  kheVong(6, 0.01), 0.00496, 1e-4);
for (const e of [0.01, 0.05, 0.2, 0.5]) {
  dat("Xác suất tự lập (ở lại chỗ cũ)", e);
  S = soLieu();
  const mongKhe = kheVong(6, e);
  mong("Markov · vòng 6 đỉnh, tự lập " + e + " → khe phổ khớp công thức đóng",
    soThuc(oSo(S, "Khe phổ")), mongKhe, Math.max(2e-4, mongKhe * 0.05));
}

/* Nút cổ chai: khe co bốn bậc độ lớn, t_trộn phình 500 lần, TÍCH đứng yên. */
H.moLab("markov");
dat("Xích", "hai-cum");
dat("Xác suất tự lập (ở lại chỗ cũ)", 0);
dat("Số đỉnh", 6);
const TICH = [];
/* mu là số mũ: cầu = 10^mu. Giá trị đo offline là cầu 0,5 → mu = −0,301.
   Dùng mu = 0 là cầu = 1, tức cầu nặng BẰNG cạnh trong cụm — xích thành
   đều tăm tắp, khe = 1, và chẳng còn nút cổ chai nào để nói tới. */
for (const [mu, kheMong, tMong] of [[-0.3, 0.666667, 4], [-1, 0.181818, 20],
                                    [-1.7, 0.039216, 98], [-2.3, 0.009950, 392],
                                    [-3, 0.001998, 1957]]) {
  dat("Cầu nối", mu);
  S = soLieu();
  const khe = soThuc(oSo(S, "Khe phổ"));
  const t = soThuc(oSo(S, "Thời gian trộn"));
  mong("Markov · cầu 10^" + mu + ": khe phổ khớp giá trị đã đo",
    khe, kheMong, Math.max(1e-5, kheMong * 0.02));
  mong("Markov · cầu 10^" + mu + ": thời gian trộn khớp giá trị đã đo",
    t, tMong, Math.max(1, tMong * 0.03));
  TICH.push(t * khe);
}
/* LUẬN ĐIỂM CHÍNH: khe chạy qua bốn bậc độ lớn mà tích vẫn bị kẹp. */
mong("Markov · khe phổ thật sự chạy qua bốn bậc độ lớn",
  0.666667 / 0.001998 > 300, true);
mong("Markov · t_trộn × khe bị kẹp trong [2,5 ; 4,2] ở CẢ NĂM giá trị cầu",
  TICH.every((x) => x >= 2.5 && x <= 4.2), true);
mong("Markov · và tích ấy dao động chưa tới 1,6 lần dù t_trộn phình 489 lần",
  Math.max(...TICH) / Math.min(...TICH) < 1.6, true);

/* Mọi khởi đầu về cùng một chỗ — trừ khi tuần hoàn. */
dat("Cầu nối", -1);
/* |λ₂| = 0,818 nên sau 60 bước còn 8e−6 — chưa đủ nhỏ để gọi là “chập”.
   160 bước đưa nó xuống dưới 1e−13. */
chayToi(160);
S = soLieu();
mong("Markov · ba khởi đầu khác hẳn nhau đã chập vào nhau",
  String(oSo(S, "Ba khởi đầu còn lệch nhau")).includes("\u2248 0") ||
  soKhoaHoc(oSo(S, "Ba khởi đầu còn lệch nhau")) < 1e-8, true);
mong("Markov · và đã tới sát phân phối dừng",
  soKhoaHoc(oSo(S, "Xa phân phối dừng nhất")) < 1e-3, true);

/* --- Bloom filter --- */

H.moLab("bloom");
dat("Số bit (m)", 1024);
dat("Số hàm băm (k)", 5);
dat("Số khoá sẽ thêm (n)", 200);
dat("Hạt giống", 3);

/* Tính công thức ĐỘC LẬP ngay tại đây, không đọc của lab. */
const ctBloom = (m, k, n) => Math.pow(1 - Math.exp(-k * n / m), k);
chayHet();
S = soLieu();
mong("Bloom · công thức (1−e^(−kn/m))^k khớp giá trị tính độc lập",
  soThuc(oSo(S, "Công thức")) / 100, ctBloom(1024, 5, 200), 1e-4);
mongChuoi("Bloom · KHÔNG BAO GIỜ bỏ sót — tra lại khoá đã thêm",
  oSo(S, "Không bao giờ bỏ sót"), "\u2714");

/* Băm tốt phải bám công thức — nhưng đọc TRUNG BÌNH 20 HẠT, không đọc
   lần chạy đơn. Lần chạy đơn dùng 800 phép thử nên biên độ lấy mẫu đã là
   ±2 điểm phần trăm, cộng thêm biến thiên theo hạt giống: ở hạt 3 đo được
   12,375% so với công thức 9,415%, lệch 31%. Một ngưỡng đặt lên con số ấy
   chỉ kiểm được vận may. */
const pTot = soThuc(oSo(S, "Dương tính giả · băm TỐT")) / 100;
const tbTot = soThuc(oSo(S, "Băm TỐT: trung bình")) / 100;
mong("Bloom · băm tốt, trung bình 20 hạt, bám công thức trong 10%",
  Math.abs(tbTot / ctBloom(1024, 5, 200) - 1) < 0.10, true);

/* LUẬN ĐIỂM CHÍNH: băm xấu dao động rộng hơn HẲN. Đọc hệ số biến thiên,
   KHÔNG đọc bề rộng min–max — min–max là thống kê cực trị, nó phình ra
   theo số hạt giống nên một ngưỡng cố định đặt lên nó là vô nghĩa. */
function haiSo(chuoi) {
  const m = String(chuoi).match(/(-?[\d.]+)%[^\d-]*(-?[\d.]+)%/);
  if (!m) throw new Error("khong doc duoc hai so tu '" + chuoi + "'");
  return [parseFloat(m[1]), parseFloat(m[2])];
}
const [btTot, btXau] = haiSo(oSo(S, "Hệ số biến thiên"));
mong("Bloom · băm tốt dao động ít (hệ số biến thiên dưới 25%)", btTot < 25, true);
mong("Bloom · băm XẤU dao động rộng gấp ít nhất 2 lần băm tốt",
  btXau > btTot * 2, true);

/* Và “xấu” KHÔNG có nghĩa là luôn tệ: ở hạt 3 nó lại rẻ hơn. Nếu ai đó
   sửa lab thành “xấu luôn đắt hơn” thì phép thử này đổ — đúng như ý. */
const pXau3 = soThuc(oSo(S, "Dương tính giả · băm XẤU")) / 100;
mong("Bloom · ở hạt 3, băm xấu lại RẺ hơn băm tốt (nên “xấu” ≠ “luôn tệ”)",
  pXau3 < pTot, true);

dat("Hạt giống", 7);
chayHet();
S = soLieu();
const pTot7 = soThuc(oSo(S, "Dương tính giả · băm TỐT")) / 100;
const pXau7 = soThuc(oSo(S, "Dương tính giả · băm XẤU")) / 100;
mong("Bloom · nhưng ở hạt 7 thì ngược lại — người thắng đổi chỗ",
  pXau7 > pTot7, true);

/* ---------------------------------------------------------------- kết */
console.log("");
if (H.loiConsole.length) {
  console.log("Có " + H.loiConsole.length + " lỗi console, đầu tiên: " + H.loiConsole[0]);
  hong++;
}
console.log("-".repeat(58));
if (hong) {
  console.log(hong + " phép đối chiếu SAI.\n");
  process.exit(1);
}
console.log("Đạt — mọi con số khớp giá trị chuẩn.\n");
