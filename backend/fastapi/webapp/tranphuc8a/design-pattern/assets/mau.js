/* =====================================================================
   mau.js — du lieu 23 mau thiet ke GoF + vai mau hien dai.

   Moi muc co mot truong ma hau het cheat sheet khac KHONG co:
   `khongDung` — khi nao ĐỪNG dung mau nay. Do moi la phan kho, vi mau
   thiet ke bi lam dung nhieu hon la bi dung thieu.

   `tonKem` ghi cai gia phai tra: mau nao cung them mot lop gian tiep, va
   lop do khong mien phi.
   ===================================================================== */
window.MAU_THIET_KE = [

/* ================================================================
   KHỞI TẠO
   ================================================================ */
{
  ma: "factory-method", ten: "Factory Method", nhom: "khoi-tao",
  viet: "Phương thức nhà máy",
  yDinh: "Lớp cha định nghĩa <b>khung</b> để tạo đối tượng, nhưng để lớp con quyết định tạo ra <b>lớp cụ thể nào</b>.",
  dungKhi: [
    "Bạn biết mình cần tạo một thứ, nhưng chưa biết lớp cụ thể cho tới lúc chạy",
    "Muốn cho người dùng thư viện mở rộng được phần tạo đối tượng mà không sửa mã của bạn"
  ],
  khongDung: [
    "Chỉ có <b>một</b> lớp cụ thể và không dự định có thêm — lúc đó `new` là đủ",
    "Bạn thêm nó “cho chắc”. Một nhà máy chỉ có một sản phẩm là <b>lớp thừa</b>"
  ],
  tonKem: "Thêm một cây lớp song song với cây sản phẩm. Số lớp tăng gấp đôi.",
  ma_nguon: `abstract class Kho {
  abstract taoVanChuyen(): VanChuyen;   // lớp con quyết định

  giao(don: Don) {
    const xe = this.taoVanChuyen();     // khung cố định
    xe.chuyen(don);
  }
}

class KhoDuongBo extends Kho {
  taoVanChuyen() { return new XeTai(); }
}
class KhoDuongBien extends Kho {
  taoVanChuyen() { return new Tau(); }
}`,
  soDo: "cha-con"
},
{
  ma: "abstract-factory", ten: "Abstract Factory", nhom: "khoi-tao",
  viet: "Nhà máy trừu tượng",
  yDinh: "Tạo ra <b>cả một họ</b> đối tượng liên quan nhau mà không nêu tên lớp cụ thể của chúng.",
  dungKhi: [
    "Có nhiều họ sản phẩm phải dùng <b>trọn bộ</b>, không được trộn lẫn (nút Windows với thanh cuộn macOS là sai)",
    "Muốn đổi cả bộ giao diện / cả bộ driver bằng một dòng"
  ],
  khongDung: [
    "Chỉ có một họ sản phẩm — dùng Factory Method là đủ",
    "Họ sản phẩm hay <b>thêm loại mới</b>: mỗi lần thêm phải sửa tất cả các nhà máy"
  ],
  tonKem: "Thêm loại sản phẩm mới là phải sửa <i>mọi</i> nhà máy cụ thể. Đây là điểm cứng nhắc lớn nhất của mẫu này.",
  ma_nguon: `interface NhaMayGiaoDien {
  taoNut(): Nut;
  taoOChon(): OChon;        // cùng một họ
}

class GiaoDienToi implements NhaMayGiaoDien {
  taoNut()   { return new NutToi(); }
  taoOChon() { return new OChonToi(); }
}

// Đổi cả bộ giao diện bằng một dòng:
const nm = sang ? new GiaoDienSang() : new GiaoDienToi();`,
  soDo: "ho"
},
{
  ma: "builder", ten: "Builder", nhom: "khoi-tao",
  viet: "Thợ xây",
  yDinh: "Dựng một đối tượng phức tạp <b>từng bước</b>, để cùng một quy trình dựng ra được nhiều biểu diễn khác nhau.",
  dungKhi: [
    "Hàm khởi tạo có quá nhiều tham số, phần lớn tuỳ chọn (<i>telescoping constructor</i>)",
    "Muốn đối tượng <b>bất biến</b> nhưng vẫn dựng được linh hoạt"
  ],
  khongDung: [
    "Chỉ có 2–3 tham số. Tham số đặt tên hoặc object literal gọn hơn nhiều",
    "Ngôn ngữ đã có <b>tham số đặt tên</b> (Python, Kotlin, C#) — builder gần như thừa"
  ],
  tonKem: "Một lớp builder riêng cho mỗi sản phẩm. Trong ngôn ngữ có tham số đặt tên thì đây thường là mã thừa.",
  ma_nguon: `const truyVan = new TruyVanBuilder()
  .tuBang("don_hang")
  .loc("trang_thai", "moi")
  .sapXep("ngay", "giam")
  .gioiHan(20)
  .dung();               // trả về đối tượng BẤT BIẾN

// So với: new TruyVan("don_hang", "trang_thai", "moi",
//                     null, null, "ngay", "giam", 20, 0)`,
  soDo: "chuoi"
},
{
  ma: "prototype", ten: "Prototype", nhom: "khoi-tao",
  viet: "Nguyên mẫu",
  yDinh: "Tạo đối tượng mới bằng cách <b>nhân bản</b> một đối tượng sẵn có, thay vì dựng lại từ đầu.",
  dungKhi: [
    "Dựng lại từ đầu quá đắt (đọc CSDL, tính toán nặng) mà nhân bản thì rẻ",
    "Cần bản sao mà không phụ thuộc vào lớp cụ thể của bản gốc"
  ],
  khongDung: [
    "Đối tượng có tham chiếu vòng hoặc tài nguyên hệ thống (socket, tệp) — sao chép sâu rất dễ sai",
    "Dựng mới vốn đã rẻ"
  ],
  tonKem: "Sao chép <b>nông</b> hay <b>sâu</b> là câu hỏi phải trả lời cho từng trường được — và trả lời sai thì lỗi rất khó tìm.",
  ma_nguon: `class CauHinh {
  nhanBan(): CauHinh {
    const b = new CauHinh();
    b.ten   = this.ten;              // nông: đủ cho giá trị
    b.danh  = [...this.danh];        // SÂU: nếu không, hai bản dùng chung mảng
    b.nested = this.nested.nhanBan();
    return b;
  }
}`,
  soDo: "nhan-ban"
},
{
  ma: "singleton", ten: "Singleton", nhom: "khoi-tao",
  viet: "Thể duy nhất",
  yDinh: "Bảo đảm một lớp chỉ có <b>đúng một</b> thể hiện, và cho một điểm truy cập toàn cục tới nó.",
  dungKhi: [
    "Thật sự chỉ được phép có một (bể kết nối, bộ ghi log ra một tệp)",
    "…và ngay cả lúc đó, thường nên là <b>một thể hiện được tiêm vào</b> chứ không phải singleton"
  ],
  khongDung: [
    "<b>Hầu hết mọi lúc.</b> Đây là mẫu bị lạm dụng nhiều nhất trong cả 23 mẫu",
    "Khi cần viết test: singleton là <b>trạng thái toàn cục</b>, và trạng thái toàn cục làm test dính nhau",
    "Ứng dụng đa luồng, trừ khi bạn thật sự hiểu khởi tạo lười có khoá đôi"
  ],
  tonKem: "Trạng thái toàn cục nguỵ trang. Nó giấu phụ thuộc (không nhìn chữ ký hàm mà biết được), phá test, và biến thứ tự khởi tạo thành bẫy.",
  ma_nguon: `// Thường gặp — và thường là sai:
class CSDL {
  private static duyNhat: CSDL;
  static lay() {
    if (!CSDL.duyNhat) CSDL.duyNhat = new CSDL();
    return CSDL.duyNhat;
  }
}

// Gần như luôn tốt hơn — TIÊM vào:
class DichVu {
  constructor(private csdl: CSDL) {}   // test thay được bằng giả
}`,
  soDo: "don",
  canh: "Mẫu bị lạm dụng nhiều nhất. Trước khi dùng, hãy hỏi: “mình cần <i>một thể hiện</i>, hay mình chỉ lười truyền tham số?”"
},

/* ================================================================
   CẤU TRÚC
   ================================================================ */
{
  ma: "adapter", ten: "Adapter", nhom: "cau-truc",
  viet: "Bộ chuyển",
  yDinh: "Cho hai giao diện <b>không khớp nhau</b> làm việc được với nhau, bằng một lớp bọc dịch qua lại.",
  dungKhi: [
    "Phải dùng thư viện ngoài mà giao diện của nó không khớp mã của bạn",
    "Muốn <b>cô lập</b> mã của mình khỏi một API có thể đổi hoặc bị thay"
  ],
  khongDung: [
    "Bạn <b>sở hữu</b> cả hai phía — sửa thẳng giao diện còn hơn thêm lớp dịch",
    "Đã có ba adapter chồng lên nhau: đó là dấu hiệu thiết kế gốc sai chỗ khác"
  ],
  tonKem: "Một lớp gián tiếp nữa mỗi lần gỡ lỗi phải bước qua.",
  ma_nguon: `// Mã của ta muốn: .ghiLog(muc, chu)
// Thư viện có:     .log(level, msg, meta)

class BocThuVien implements BoGhiLog {
  constructor(private tv: ThuVienNgoai) {}
  ghiLog(muc: string, chu: string) {
    this.tv.log(DOI_MUC[muc], chu, {});   // dịch
  }
}`,
  soDo: "boc"
},
{
  ma: "bridge", ten: "Bridge", nhom: "cau-truc",
  viet: "Cầu nối",
  yDinh: "Tách <b>trừu tượng</b> khỏi <b>cài đặt</b> để hai bên thay đổi độc lập nhau.",
  dungKhi: [
    "Có hai chiều biến thiên độc lập (hình × cách vẽ, thiết bị × giao thức) và kế thừa sẽ nổ tổ hợp",
    "Muốn đổi cài đặt lúc chạy"
  ],
  khongDung: [
    "Chỉ có một chiều biến thiên — kế thừa thường đủ",
    "Hai chiều đó thật ra <b>không</b> độc lập"
  ],
  tonKem: "Khó nhận ra nhất trong nhóm cấu trúc. Nếu không giải thích được <i>hai chiều</i> là gì thì bạn chưa cần nó.",
  ma_nguon: `// Không có Bridge: 2 hình × 3 API = 6 lớp
//   HinhTronOpenGL, HinhTronVulkan, HinhTronMetal, HinhVuong…

// Có Bridge: 2 + 3 = 5 lớp, và thêm hình mới chỉ tốn 1
abstract class Hinh {
  constructor(protected ve: BoVe) {}   // ← cây cầu
  abstract veRa(): void;
}
class HinhTron extends Hinh {
  veRa() { this.ve.veVongTron(this.x, this.y, this.r); }
}`,
  soDo: "cau"
},
{
  ma: "composite", ten: "Composite", nhom: "cau-truc",
  viet: "Kết hợp",
  yDinh: "Cho phép đối xử với <b>một vật</b> và <b>một nhóm vật</b> theo cùng một cách.",
  dungKhi: [
    "Dữ liệu vốn có dạng cây (thư mục, DOM, danh mục lồng nhau, biểu thức)",
    "Muốn mã dùng không cần biết mình đang cầm lá hay cành"
  ],
  khongDung: [
    "Cấu trúc thật ra phẳng",
    "Lá và cành khác nhau nhiều tới mức giao diện chung phải có hàm ném lỗi — đó là dấu hiệu sai mẫu"
  ],
  tonKem: "Giao diện chung bị kéo về mẫu số chung nhỏ nhất. Hàm `themCon()` trên một chiếc lá là vô nghĩa.",
  ma_nguon: `interface Muc { kichThuoc(): number; }

class Tep implements Muc {
  kichThuoc() { return this.byte; }
}
class ThuMuc implements Muc {
  con: Muc[] = [];
  kichThuoc() {                        // đệ quy, không cần phân biệt
    return this.con.reduce((t, c) => t + c.kichThuoc(), 0);
  }
}`,
  soDo: "cay"
},
{
  ma: "decorator", ten: "Decorator", nhom: "cau-truc",
  viet: "Bộ trang trí",
  yDinh: "Thêm hành vi cho một đối tượng <b>lúc chạy</b> bằng cách bọc nó, thay vì kế thừa.",
  dungKhi: [
    "Cần tổ hợp nhiều tính năng tuỳ chọn mà kế thừa sẽ nổ tổ hợp",
    "Muốn thêm/bớt hành vi lúc chạy (nén, mã hoá, đệm, đếm)"
  ],
  khongDung: [
    "Thứ tự bọc <b>có ý nghĩa</b> mà người dùng không biết: nén-rồi-mã-hoá khác mã-hoá-rồi-nén",
    "Chỉ có một cách trang trí — viết thẳng vào lớp"
  ],
  tonKem: "Vết gọi ngăn xếp dài ngoằng, và <b>thứ tự bọc trở thành một phần của API</b> dù không ai viết ra.",
  ma_nguon: `let luong: Luong = new LuongTep("a.txt");
luong = new Nen(luong);
luong = new MaHoa(luong);      // THỨ TỰ có ý nghĩa!

// nén rồi mã hoá  → nhỏ, an toàn
// mã hoá rồi nén  → to, vì dữ liệu mã hoá gần như không nén được`,
  soDo: "boc-nhieu"
},
{
  ma: "facade", ten: "Facade", nhom: "cau-truc",
  viet: "Mặt tiền",
  yDinh: "Cho một giao diện <b>đơn giản</b> phủ lên một hệ thống con phức tạp.",
  dungKhi: [
    "Hệ thống con có 20 lớp mà 90% người dùng chỉ cần 3 thao tác",
    "Muốn giảm ràng buộc giữa mã của bạn và một thư viện lớn"
  ],
  khongDung: [
    "Mặt tiền phình ra tới mức lộ lại gần hết hệ thống con — lúc đó nó chỉ là một lớp chuyển tiếp vô nghĩa",
    "Bạn dùng nó để <b>giấu</b> một thiết kế tồi thay vì sửa nó"
  ],
  tonKem: "Dễ trở thành <i>god object</i>. Mặt tiền phải <b>đơn giản hoá</b>, không phải chỉ chuyển tiếp.",
  ma_nguon: `// Trước: người dùng phải biết 5 lớp và đúng thứ tự
const d = new BoGiaiMa(); const t = new BoTron();
const x = new BoXuatAnh(); // … và thứ tự gọi

// Sau:
class ChuyenDoiVideo {
  chuyen(tep: string, dinhDang: string): Tep { /* … */ }
}`,
  soDo: "mat-tien"
},
{
  ma: "flyweight", ten: "Flyweight", nhom: "cau-truc",
  viet: "Hạng ruồi",
  yDinh: "Dùng chung phần trạng thái <b>giống nhau</b> giữa rất nhiều đối tượng, để tiết kiệm bộ nhớ.",
  dungKhi: [
    "Có hàng chục nghìn đối tượng trở lên và bộ nhớ là <b>vấn đề đã đo được</b>",
    "Phần lớn trạng thái của chúng là trùng nhau (glyph, texture, cấu hình hạt)"
  ],
  khongDung: [
    "<b>Chưa đo.</b> Đây là tối ưu hoá, và tối ưu hoá trước khi đo thì gần như luôn sai chỗ",
    "Số đối tượng chỉ vài nghìn — bộ nhớ hiện đại không quan tâm"
  ],
  tonKem: "Tách trạng thái thành <i>nội tại</i> (dùng chung) và <i>ngoại lai</i> (truyền vào) làm mã khó đọc hẳn. Chỉ trả giá đó khi đã có số đo.",
  ma_nguon: `// 1 triệu cây trong rừng, nhưng chỉ 5 LOẠI cây
class LoaiCay {                   // nội tại — dùng chung
  constructor(public ten, public texture) {}
}
class Cay {                       // ngoại lai — riêng từng cây
  constructor(public x, public y, public loai: LoaiCay) {}
}
// 1 000 000 × (2 số + 1 con trỏ) thay vì 1 000 000 × texture`,
  soDo: "dung-chung"
},
{
  ma: "proxy", ten: "Proxy", nhom: "cau-truc",
  viet: "Người đại diện",
  yDinh: "Đặt một vật <b>thay mặt</b> cho vật thật, để kiểm soát việc truy cập tới nó.",
  dungKhi: [
    "Khởi tạo lười (chỉ nạp ảnh khi thật sự cần hiện)",
    "Kiểm soát truy cập, đệm kết quả, ghi log, đếm tham chiếu"
  ],
  khongDung: [
    "Bạn chỉ muốn thêm hành vi — đó là <b>Decorator</b>. Proxy là để <i>kiểm soát truy cập</i>",
    "Proxy giấu mất chi phí mạng: người gọi tưởng rẻ mà thật ra là một vòng gọi từ xa"
  ],
  tonKem: "Giống Decorator tới mức hay bị lẫn. Khác nhau ở <b>ý định</b>: Decorator thêm việc, Proxy canh cửa.",
  ma_nguon: `class AnhLuoi implements Anh {
  private that: AnhThat | null = null;
  hien() {
    if (!this.that) this.that = new AnhThat(this.duongDan);  // nạp khi cần
    this.that.hien();
  }
}`,
  soDo: "boc"
},

/* ================================================================
   HÀNH VI
   ================================================================ */
{
  ma: "chain", ten: "Chain of Responsibility", nhom: "hanh-vi",
  viet: "Chuỗi trách nhiệm",
  yDinh: "Chuyển yêu cầu dọc một <b>chuỗi</b> bộ xử lý, mỗi bộ tự quyết xử lý hay đẩy tiếp.",
  dungKhi: [
    "Middleware: xác thực → giới hạn tần suất → ghi log → xử lý",
    "Số bộ xử lý và thứ tự của chúng phải đổi được lúc chạy"
  ],
  khongDung: [
    "Luôn chỉ có một bộ xử lý đúng và bạn biết nó là ai — dùng `if` hoặc bảng tra",
    "Không bộ nào xử lý thì yêu cầu <b>rơi im lặng</b>: phải xử lý trường hợp này"
  ],
  tonKem: "Không có bảo đảm nào rằng yêu cầu sẽ được xử lý. Và gỡ lỗi “vì sao nó không tới nơi” rất khổ.",
  ma_nguon: `app.dung(xacThuc);
app.dung(gioiHanTanSuat);
app.dung(ghiLog);
app.dung(xuLyChinh);

// Mỗi khâu: làm việc của mình rồi gọi tiep(), hoặc DỪNG chuỗi
function xacThuc(yc, tra, tiep) {
  if (!yc.token) return tra.loi(401);   // dừng ở đây
  tiep();
}`,
  soDo: "chuoi"
},
{
  ma: "command", ten: "Command", nhom: "hanh-vi",
  viet: "Mệnh lệnh",
  yDinh: "Đóng gói một yêu cầu thành <b>một đối tượng</b>, để xếp hàng, ghi log hoặc hoàn tác được.",
  dungKhi: [
    "Cần <b>hoàn tác / làm lại</b> — đây là lý do số một",
    "Cần xếp hàng, lập lịch hoặc ghi lại thao tác để phát lại"
  ],
  khongDung: [
    "Không cần hoàn tác, không cần xếp hàng — một hàm là đủ",
    "Trong ngôn ngữ có hàm hạng nhất, Command đơn giản chỉ là một closure"
  ],
  tonKem: "Một lớp cho mỗi thao tác. Nhiều ngôn ngữ chỉ cần `() => {}` và một hàm `hoanTac`.",
  ma_nguon: `interface Lenh { chay(): void; hoanTac(): void; }

class ThemChu implements Lenh {
  chay()    { vb.chen(this.vt, this.chu); }
  hoanTac() { vb.xoa(this.vt, this.chu.length); }
}

lichSu.push(lenh); lenh.chay();
// Ctrl+Z:
lichSu.pop().hoanTac();`,
  soDo: "don"
},
{
  ma: "iterator", ten: "Iterator", nhom: "hanh-vi",
  viet: "Bộ lặp",
  yDinh: "Duyệt qua các phần tử của một tập hợp mà không lộ cách nó lưu trữ bên trong.",
  dungKhi: [
    "Tập hợp có cấu trúc phức tạp (cây, đồ thị) mà người dùng chỉ muốn duyệt",
    "Cần nhiều cách duyệt khác nhau trên cùng một dữ liệu"
  ],
  khongDung: [
    "Ngôn ngữ đã có sẵn (`for…of`, generator, `IEnumerable`) — <b>dùng cái có sẵn</b>",
    "Chỉ là một mảng"
  ],
  tonKem: "Gần như đã được <b>ngôn ngữ nuốt trọn</b>. Ngày nay bạn hiện thực giao thức lặp của ngôn ngữ, không viết lớp Iterator.",
  ma_nguon: `class Cay {
  *[Symbol.iterator]() {          // ngôn ngữ lo phần còn lại
    yield this.gt;
    for (const c of this.con) yield* c;
  }
}

for (const x of cay) { /* … */ }   // không biết gì về cấu trúc trong`,
  soDo: "chuoi"
},
{
  ma: "mediator", ten: "Mediator", nhom: "hanh-vi",
  viet: "Bên trung gian",
  yDinh: "Bắt các đối tượng nói chuyện <b>qua một bên trung gian</b> thay vì gọi thẳng nhau.",
  dungKhi: [
    "N thành phần đang tham chiếu chéo nhau thành mớ bòng bong",
    "Hộp thoại phức tạp: ô này đổi thì nút kia bật/tắt"
  ],
  khongDung: [
    "Chỉ có 2–3 thành phần — trung gian chỉ thêm việc",
    "Trung gian phình thành <b>god object</b> biết hết mọi thứ: lúc đó bạn chỉ dời mớ bòng bong sang chỗ khác"
  ],
  tonKem: "Đổi N² liên kết lấy 1 lớp <i>biết tất cả</i>. Nếu lớp đó vượt quá vài trăm dòng thì mẫu này đang thua.",
  ma_nguon: `// Trước: ô ngày gọi thẳng nút Lưu, nút Lưu gọi thẳng ô tên…
// Sau:
class HopThoai {                    // trung gian
  doi(nguon: ThanhPhan) {
    if (nguon === this.oNgay) this.nutLuu.bat(this.hopLe());
    if (nguon === this.oTen)  this.nhan.doiChu(this.oTen.gt);
  }
}`,
  soDo: "sao"
},
{
  ma: "memento", ten: "Memento", nhom: "hanh-vi",
  viet: "Vật lưu niệm",
  yDinh: "Chụp lại trạng thái trong của một đối tượng để khôi phục sau, mà <b>không phá vỡ tính đóng gói</b>.",
  dungKhi: [
    "Hoàn tác / ảnh chụp / điểm lưu, và trạng thái là <b>riêng tư</b>",
    "Không muốn lộ trường riêng chỉ để lưu lại chúng"
  ],
  khongDung: [
    "Trạng thái rất lớn — chụp toàn bộ mỗi lần sẽ ngốn bộ nhớ. Cân nhắc lưu <i>hiệu</i> (Command) thay vì <i>ảnh</i>",
    "Trạng thái vốn đã công khai và bất biến — chỉ cần giữ tham chiếu"
  ],
  tonKem: "Bộ nhớ. Mỗi ảnh chụp là một bản sao đầy đủ, và lịch sử hoàn tác dài thì tốn thật.",
  ma_nguon: `class BienTap {
  private noiDung = "";
  luu(): Anh { return new Anh(this.noiDung); }   // chỉ nó đọc được bên trong
  phucHoi(a: Anh) { this.noiDung = a.lay(); }
}

// Người quản lý lịch sử giữ Anh[] nhưng KHÔNG đọc được bên trong nó`,
  soDo: "don"
},
{
  ma: "observer", ten: "Observer", nhom: "hanh-vi",
  viet: "Bên quan sát",
  yDinh: "Khi một đối tượng đổi trạng thái, mọi bên đã đăng ký được <b>báo tự động</b>.",
  dungKhi: [
    "Nhiều nơi cần phản ứng với một thay đổi, và bạn không muốn nguồn biết chúng là ai",
    "Nền tảng của mọi hệ phản ứng: sự kiện DOM, signal, store"
  ],
  khongDung: [
    "Thứ tự thông báo <b>có ý nghĩa</b> — Observer không hứa thứ tự nào cả",
    "Dễ gây <b>rò rỉ bộ nhớ</b>: quên huỷ đăng ký là nguồn giữ mãi bên nghe",
    "Chuỗi thông báo có thể thành vòng lặp vô hạn"
  ],
  tonKem: "Luồng điều khiển <b>biến mất khỏi mã</b>. Đọc mã không thấy ai gọi ai, phải chạy mới biết.",
  ma_nguon: `class Nguon {
  private nghe = new Set<(gt) => void>();
  dangKy(f)  { this.nghe.add(f); return () => this.nghe.delete(f); }
  //                              ↑ TRẢ VỀ hàm huỷ — không có nó là rò rỉ
  bao(gt)    { this.nghe.forEach(f => f(gt)); }
}`,
  soDo: "sao",
  canh: "Luôn trả về hàm huỷ đăng ký. Quên huỷ là nguyên nhân rò rỉ bộ nhớ phổ biến nhất trong ứng dụng có trạng thái."
},
{
  ma: "state", ten: "State", nhom: "hanh-vi",
  viet: "Trạng thái",
  yDinh: "Cho đối tượng đổi hành vi khi trạng thái trong của nó đổi — như thể nó đổi lớp.",
  dungKhi: [
    "Có một máy trạng thái thật sự, với chuyển tiếp rõ ràng (đơn hàng, kết nối, trình phát)",
    "Mã đang đầy `if (trangThai === …)` lặp đi lặp lại ở nhiều hàm"
  ],
  khongDung: [
    "Chỉ có 2 trạng thái và 1 chỗ kiểm tra — một cờ boolean là đủ",
    "Chuyển tiếp là tuỳ ý, không theo luật nào"
  ],
  tonKem: "Một lớp cho mỗi trạng thái. Với 8 trạng thái là 8 lớp, và bảng chuyển tiếp nằm rải rác trong chúng.",
  ma_nguon: `// Trước: if (tt === "moi") … else if (tt === "dang-giao") … (ở 6 hàm)
// Sau:
interface TrangThai { huy(don: Don): void; }

class Moi implements TrangThai {
  huy(don) { don.doiTrangThai(new DaHuy()); }   // cho phép
}
class DaGiao implements TrangThai {
  huy(don) { throw new Error("đã giao rồi, không huỷ được"); }
}`,
  soDo: "may"
},
{
  ma: "strategy", ten: "Strategy", nhom: "hanh-vi",
  viet: "Chiến lược",
  yDinh: "Gói mỗi thuật toán vào một lớp riêng, và cho <b>hoán đổi</b> chúng cho nhau.",
  dungKhi: [
    "Nhiều cách làm cùng một việc (sắp xếp, nén, tính phí ship, định giá)",
    "Muốn chọn cách làm lúc chạy, hoặc cho người dùng thư viện tự cắm cách của họ"
  ],
  khongDung: [
    "Chỉ có một thuật toán và không dự định có thêm",
    "Ngôn ngữ có hàm hạng nhất — lúc đó Strategy <b>chỉ là một tham số hàm</b>"
  ],
  tonKem: "Trong JS/Python/Go, mẫu này gần như tan biến thành “truyền vào một hàm”. Đừng dựng cả cây lớp cho việc đó.",
  ma_nguon: `// Bản GoF: interface + 3 lớp
// Bản thực tế trong ngôn ngữ hiện đại:
function tinhPhi(don, chienLuoc: (d: Don) => number) {
  return chienLuoc(don);
}

tinhPhi(don, phiNhanh);
tinhPhi(don, phiTietKiem);`,
  soDo: "ho"
},
{
  ma: "template-method", ten: "Template Method", nhom: "hanh-vi",
  viet: "Phương thức khung",
  yDinh: "Lớp cha định nghĩa <b>bộ khung</b> của một thuật toán, để lớp con điền vào vài bước.",
  dungKhi: [
    "Nhiều biến thể chỉ khác nhau ở vài bước, phần còn lại y hệt",
    "Muốn ép một trình tự cố định (mở → xử lý → đóng)"
  ],
  khongDung: [
    "Lớp con phải ghi đè quá nửa số bước — lúc đó dùng <b>Strategy</b> (hợp thành) thay vì kế thừa",
    "Bộ khung hay đổi: mọi lớp con vỡ theo"
  ],
  tonKem: "Ràng buộc kế thừa rất chặt. Đây là chỗ <i>“ưu tiên hợp thành hơn kế thừa”</i> hay được nhắc nhất.",
  ma_nguon: `abstract class TrichXuat {
  chay(tep: string) {          // KHUNG — lớp con không đụng vào
    const d = this.doc(tep);
    const s = this.phanTich(d);
    this.luu(s);
  }
  protected abstract phanTich(d: string): Ban;   // chỗ để điền
  protected doc(t) { /* chung */ }
  protected luu(b) { /* chung */ }
}`,
  soDo: "cha-con"
},
{
  ma: "visitor", ten: "Visitor", nhom: "hanh-vi",
  viet: "Khách thăm",
  yDinh: "Tách một thao tác ra khỏi cấu trúc dữ liệu mà nó chạy trên đó.",
  dungKhi: [
    "Cấu trúc <b>ổn định</b> (AST, hình học) mà số thao tác trên nó thì cứ tăng",
    "Muốn thêm thao tác mới mà không sửa các lớp nút"
  ],
  khongDung: [
    "Hay <b>thêm loại nút mới</b>: mỗi lần thêm là phải sửa tất cả visitor. Đây là điểm yếu chí mạng",
    "Ngôn ngữ có khớp mẫu (pattern matching) — nó giải quyết cùng vấn đề gọn hơn nhiều"
  ],
  tonKem: "Đánh đổi rõ ràng: <b>dễ thêm thao tác, khó thêm loại nút</b>. Đúng ngược với hướng đối tượng thông thường. Đây là <i>bài toán biểu thức</i>.",
  ma_nguon: `interface Khach {
  thamSo(n: NutSo): void;
  thamCong(n: NutCong): void;
}

class InRa implements Khach { /* … */ }
class TinhGiaTri implements Khach { /* … */ }
// Thêm thao tác thứ ba: KHÔNG đụng vào lớp nút nào
// Thêm loại nút thứ ba: phải sửa CẢ BA visitor`,
  soDo: "cheo"
},
{
  ma: "interpreter", ten: "Interpreter", nhom: "hanh-vi",
  viet: "Bộ thông dịch",
  yDinh: "Định nghĩa văn phạm cho một ngôn ngữ nhỏ, và một bộ máy diễn giải câu trong ngôn ngữ đó.",
  dungKhi: [
    "Có một ngôn ngữ nhỏ, đơn giản, ổn định (luật lọc, biểu thức, truy vấn)",
    "Văn phạm nhỏ tới mức mỗi luật thành một lớp vẫn đọc được"
  ],
  khongDung: [
    "Văn phạm phức tạp — dùng bộ sinh parser, đừng viết tay bằng mẫu này",
    "Hiệu năng quan trọng: cây đối tượng diễn giải rất chậm"
  ],
  tonKem: "Ít dùng nhất trong 23 mẫu. Với văn phạm thật thì nó không chịu nổi.",
  ma_nguon: `interface BieuThuc { tinh(bien: Map<string, number>): number; }

class Cong implements BieuThuc {
  constructor(private t: BieuThuc, private p: BieuThuc) {}
  tinh(b) { return this.t.tinh(b) + this.p.tinh(b); }
}
// "x + 2 * y" → cây đối tượng → .tinh({x: 1, y: 3})`,
  soDo: "cay"
},

/* ================================================================
   HIỆN ĐẠI — không có trong GoF nhưng gặp hằng ngày
   ================================================================ */
{
  ma: "di", ten: "Dependency Injection", nhom: "hien-dai",
  viet: "Tiêm phụ thuộc",
  yDinh: "Đưa phụ thuộc <b>vào</b> đối tượng từ bên ngoài, thay vì để nó tự tạo lấy.",
  dungKhi: [
    "Gần như luôn luôn. Đây là <b>thuốc giải</b> cho Singleton",
    "Cần thay phụ thuộc bằng bản giả khi viết test"
  ],
  khongDung: [
    "Tiêm cả thứ không bao giờ đổi (`Math`, `JSON`) — chỉ thêm nhiễu",
    "Khung DI nặng nề cho một ứng dụng nhỏ: tiêm qua hàm khởi tạo là đủ"
  ],
  tonKem: "Phụ thuộc trở nên <b>hiện rõ</b> trong chữ ký hàm — đó là điểm mạnh, nhưng chữ ký dài ra. Chữ ký dài quá là dấu hiệu lớp đang làm quá nhiều việc.",
  ma_nguon: `// Xấu — tự tạo, không test được
class DichVu {
  private csdl = new CSDLThat();
}

// Tốt — nhận từ ngoài
class DichVu {
  constructor(private csdl: CSDL) {}
}
new DichVu(new CSDLGia());    // test dễ dàng`,
  soDo: "boc"
},
{
  ma: "repository", ten: "Repository", nhom: "hien-dai",
  viet: "Kho chứa",
  yDinh: "Một lớp trông như <b>tập hợp trong bộ nhớ</b>, che đi việc dữ liệu thật ra nằm ở CSDL.",
  dungKhi: [
    "Muốn tầng nghiệp vụ không biết gì về SQL",
    "Cần thay CSDL bằng bản trong bộ nhớ khi test"
  ],
  khongDung: [
    "ORM của bạn <b>đã là</b> một repository — thêm một lớp nữa là thừa",
    "Kho phình ra 40 hàm `timTheoA_vaB_sapXepC` — lúc đó nó chỉ là SQL viết bằng tên hàm"
  ],
  tonKem: "Rất dễ rò rỉ trừu tượng: hễ cần phân trang, nạp kèm hay truy vấn phức tạp là mô hình “tập hợp” vỡ.",
  ma_nguon: `interface KhoNguoiDung {
  theoId(id: string): Promise<NguoiDung | null>;
  luu(nd: NguoiDung): Promise<void>;
}

// Nghiệp vụ chỉ thấy cái này.
// Có KhoSQL và KhoTrongBoNho — test dùng cái thứ hai.`,
  soDo: "mat-tien"
},
{
  ma: "null-object", ten: "Null Object", nhom: "hien-dai",
  viet: "Vật rỗng",
  yDinh: "Thay `null` bằng một đối tượng <b>không làm gì cả</b> nhưng vẫn đúng giao diện.",
  dungKhi: [
    "Mã đầy `if (x != null)` lặp lại khắp nơi",
    "Có hành vi mặc định hợp lý cho trường hợp “không có” (bộ ghi log câm, giá bằng 0)"
  ],
  khongDung: [
    "“Không có gì” là <b>lỗi</b> cần báo — nuốt nó đi là giấu bug",
    "Ngôn ngữ có `Option`/`Maybe` và mã của bạn đã dùng nhất quán"
  ],
  tonKem: "Che mất lỗi. Một `BoGhiLogCam` làm log biến mất mà không ai biết vì sao.",
  ma_nguon: `class BoGhiLogCam implements BoGhiLog {
  ghi(_: string) { /* không làm gì */ }
}

// Thay vì:  if (this.log) this.log.ghi("…")
// Chỉ cần:  this.log.ghi("…")`,
  soDo: "don"
},
{
  ma: "circuit-breaker", ten: "Circuit Breaker", nhom: "hien-dai",
  viet: "Cầu dao",
  yDinh: "Khi một dịch vụ phụ thuộc hỏng liên tục, <b>ngắt</b> luôn thay vì cứ gọi và cứ chờ hết giờ.",
  dungKhi: [
    "Gọi dịch vụ qua mạng có thể hỏng hoặc chậm",
    "Muốn hỏng nhanh thay vì kéo cả hệ thống xuống theo"
  ],
  khongDung: [
    "Gọi nội bộ, không qua mạng",
    "Ngưỡng đặt sai: cầu dao nhảy oan còn tệ hơn không có"
  ],
  tonKem: "Ba trạng thái (đóng / mở / hé mở) và ba tham số phải chỉnh. Chỉnh sai thì nó tự tạo ra sự cố.",
  ma_nguon: `// ĐÓNG  → gọi bình thường, đếm lỗi
// MỞ    → hỏng ngay, không gọi nữa (chờ t giây)
// HÉ MỞ → cho một yêu cầu thử; thành công → ĐÓNG, hỏng → MỞ

if (cauDao.trangThai === "mo") throw new LoiNgat();`,
  soDo: "may",
  canh: "Xem lab <i>Bão retry</i> trong khoá thiết kế hệ thống: thử lại mà không có cầu dao thì làm sự cố nặng thêm chứ không nhẹ đi."
}
];
