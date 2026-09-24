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
  if (!isNaN(toi) && toi < k - 1) {
    throw new Error("tua bi ngan sach cat: xin " + k + " buoc, chi toi " +
      toi + " \u2014 giam so buoc hoac giam quy mo tham so cua phep thu nay");
  }
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

H.napTheoIndex();
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
