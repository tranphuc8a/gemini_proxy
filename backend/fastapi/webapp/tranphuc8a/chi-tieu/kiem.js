/* =====================================================================
   kiem.js — kiem phan LOI cua ung dung chi tieu.

       node kiem.js

   Tien bac va ngay thang la hai cho sai ma KHONG LAM TRANG DO: no chi
   lam con so sai, va nguoi dung tin con so do. Nen phan nay phai duoc
   kiem ky hon phan giao dien nhieu.
   ===================================================================== */
"use strict";
const path = require("path");
require(path.join(__dirname, "assets", "loi.js"));
const CT = globalThis.CT;

let hong = 0;
function kiem(ten, dat, chiTiet) {
  console.log("  " + (dat ? "[ok]  " : "[SAI] ") + ten + (chiTiet ? "   " + chiTiet : ""));
  if (!dat) hong++;
}
const bang = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("\nKiem chi-tieu\n" + "-".repeat(58));

/* ====================== 1. docTien ====================== */
{
  const d = CT.docTien;
  kiem("docTien · so tron", d("50000") === 50000);
  kiem("docTien · dau cham phan cach nghin", d("50.000") === 50000);
  kiem("docTien · dau phay phan cach nghin", d("50,000") === 50000);
  kiem("docTien · nhieu nhom nghin", d("1.234.567") === 1234567);
  kiem("docTien · hau to k", d("50k") === 50000);
  kiem("docTien · hau to tr", d("2tr") === 2000000);
  kiem("docTien · tr co phan le", d("1.5tr") === 1500000, d("1.5tr"));
  kiem("docTien · tr co phan le dung dau phay", d("1,5 tr") === 1500000, d("1,5 tr"));
  kiem("docTien · chu tieng Viet 'triệu'", d("3 triệu") === 3000000, d("3 triệu"));
  kiem("docTien · chu 'nghìn'", d("20 nghìn") === 20000, d("20 nghìn"));
  kiem("docTien · hau to ti", d("2 tỉ") === 2000000000, d("2 tỉ"));
  kiem("docTien · so am", d("-50000") === -50000);
  kiem("docTien · rong tra 0", d("") === 0 && d(null) === 0 && d(undefined) === 0);
  kiem("docTien · rac tra 0", d("abc") === 0);
  kiem("docTien · nhan thang so", d(1234) === 1234);
  kiem("docTien · co dau do la va khoang trang", d("  1.000 ₫ ") === 1000, d("  1.000 ₫ "));

  /* BAT BIEN: ket qua luon la SO NGUYEN. Tien le khong ton tai o day, va
     luu so thuc thi sau vai tram giao dich tong se lech ma khong ai biet. */
  let nguyenHet = true;
  ["1.5tr", "0.5k", "1,25 tr", "999", "1.234,5"].forEach((x) => {
    if (!Number.isInteger(d(x))) nguyenHet = false;
  });
  kiem("docTien · ket qua LUON la so nguyen", nguyenHet);
}

/* ====================== 2. dinhDangTien / tienGon ====================== */
{
  kiem("dinhDangTien · chen dau cham moi ba chu so",
    CT.dinhDangTien(1234567) === "1.234.567 ₫", CT.dinhDangTien(1234567));
  kiem("dinhDangTien · so nho khong co dau cham",
    CT.dinhDangTien(999) === "999 ₫");
  kiem("dinhDangTien · so 0", CT.dinhDangTien(0) === "0 ₫");
  kiem("dinhDangTien · so am dung dau tru THAT (U+2212)",
    CT.dinhDangTien(-1000) === "−1.000 ₫", CT.dinhDangTien(-1000));
  kiem("dinhDangTien · bo duoc don vi",
    CT.dinhDangTien(1000, false) === "1.000");

  /* Vong tron: in ra roi doc lai phai ra DUNG so cu. */
  let vongOK = true, lech = "";
  [0, 1, 999, 1000, 50000, 1234567, 999999999, 1000000000].forEach((v) => {
    const lai = CT.docTien(CT.dinhDangTien(v, false));
    if (lai !== v) { vongOK = false; lech = v + " -> " + lai; }
  });
  kiem("dinhDangTien · in ra roi doc lai ra dung so cu", vongOK, lech || "8/8");

  kiem("tienGon · nghin", CT.tienGon(50000) === "50k");
  kiem("tienGon · trieu", CT.tienGon(1500000) === "1,5tr", CT.tienGon(1500000));
  kiem("tienGon · ti", CT.tienGon(2500000000) === "2,5tỉ", CT.tienGon(2500000000));
  kiem("tienGon · duoi nghin giu nguyen", CT.tienGon(500) === "500");
}

/* ====================== 3. Ngay thang ====================== */
{
  kiem("thangCua · cat dung 7 ky tu", CT.thangCua("2026-01-31") === "2026-01");
  kiem("tenThang · bo so 0 dau thang", CT.tenThang("2026-01") === "Tháng 1, 2026");
  kiem("tenThang · thang hai chu so", CT.tenThang("2026-12") === "Tháng 12, 2026");

  kiem("thangTruoc · lui trong nam", CT.thangTruoc("2026-05") === "2026-04");
  /* Bien nam: cho de sai nhat. */
  kiem("thangTruoc · lui qua nam moi", CT.thangTruoc("2026-01") === "2025-12",
    CT.thangTruoc("2026-01"));

  kiem("soNgayTrongThang · thang 1 co 31", CT.soNgayTrongThang("2026-01") === 31);
  kiem("soNgayTrongThang · thang 4 co 30", CT.soNgayTrongThang("2026-04") === 30);
  kiem("soNgayTrongThang · thang 2 nam thuong co 28",
    CT.soNgayTrongThang("2026-02") === 28);
  kiem("soNgayTrongThang · thang 2 nam nhuan co 29",
    CT.soNgayTrongThang("2024-02") === 29);
  kiem("soNgayTrongThang · nam 2000 nhuan (chia het 400)",
    CT.soNgayTrongThang("2000-02") === 29);
  kiem("soNgayTrongThang · nam 1900 KHONG nhuan (chia het 100)",
    CT.soNgayTrongThang("1900-02") === 28, CT.soNgayTrongThang("1900-02"));

  /* homNay phai dung dinh dang luu tru, khong duoc lech mui gio. */
  kiem("homNay · dung dang YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(CT.homNay()),
    CT.homNay());
}

/* ====================== 4. Gom nhom ====================== */
{
  const ds = [
    { ngay: "2026-01-05", nhom: "an-uong", tien: 50000 },
    { ngay: "2026-01-05", nhom: "an-uong", tien: 30000 },
    { ngay: "2026-01-12", nhom: "di-lai",  tien: 20000 },
    { ngay: "2026-01-01", nhom: "luong",   tien: 10000000 },
    { ngay: "2026-02-03", nhom: "an-uong", tien: 99000 }
  ];

  kiem("laThu · nhom luong la THU", CT.laThu({ nhom: "luong" }) === true);
  kiem("laThu · nhom an-uong la CHI", CT.laThu({ nhom: "an-uong" }) === false);
  kiem("laThu · nhom la khong bi coi la thu", CT.laThu({ nhom: "khong-co" }) === false);

  const t = CT.tongKet(CT.locThang(ds, "2026-01"));
  kiem("tongKet · cong dung tong thu", t.thu === 10000000, t.thu);
  kiem("tongKet · cong dung tong chi", t.chi === 100000, t.chi);
  kiem("tongKet · so du = thu - chi", t.con === 9900000, t.con);
  kiem("tongKet · danh sach rong ra toan 0",
    bang(CT.tongKet([]), { thu: 0, chi: 0, con: 0 }));

  kiem("locThang · loc dung thang", CT.locThang(ds, "2026-02").length === 1);
  kiem("locThang · khong truyen thang thi giu nguyen het",
    CT.locThang(ds, null).length === 5);

  const n = CT.theoNhom(CT.locThang(ds, "2026-01"));
  kiem("theoNhom · gop cung nhom lai",
    n.filter((x) => x.nhom === "an-uong")[0].tien === 80000);
  kiem("theoNhom · sap giam dan theo tien",
    n[0].tien >= n[1].tien && n[1].tien >= n[2].tien,
    n.map((x) => x.nhom + ":" + x.tien).join(" "));

  const ng = CT.theoNgay(ds, "2026-01");
  kiem("theoNgay · dai dung bang so ngay trong thang", ng.length === 31, ng.length);
  kiem("theoNgay · ngay 5 cong dung", ng[4] === 80000, ng[4]);
  kiem("theoNgay · ngay 12 cong dung", ng[11] === 20000);
  kiem("theoNgay · ngay khong co giao dich la 0, khong phai thieu",
    ng[1] === 0 && ng[30] === 0);
  /* Thu nhap KHONG duoc tinh vao bieu do chi tieu. */
  kiem("theoNgay · khoan THU khong bi tinh vao chi tieu", ng[0] === 0, ng[0]);

  kiem("cacThang · liet ke dung cac thang co giao dich",
    bang(CT.cacThang(ds), ["2026-02", "2026-01"]));
}

/* ====================== 5. Ngan sach ====================== */
{
  const ds = [
    { ngay: "2026-01-05", nhom: "an-uong", tien: 2500000 },
    { ngay: "2026-01-09", nhom: "di-lai",  tien: 300000 },
    { ngay: "2026-01-01", nhom: "luong",   tien: 10000000 }
  ];
  const han = { "an-uong": 2000000, "di-lai": 1000000, "nha-o": 0 };
  const r = CT.soNganSach(ds, han);

  kiem("soNganSach · bo qua nhom dat han muc 0", r.length === 2, r.length);
  const au = r.filter((x) => x.nhom === "an-uong")[0];
  kiem("soNganSach · tinh dung so da chi", au.daChi === 2500000);
  kiem("soNganSach · con lai co the AM khi vuot", au.conLai === -500000, au.conLai);
  kiem("soNganSach · danh dau vuot han muc", au.vuot === true);
  kiem("soNganSach · ti le tinh dung", Math.abs(au.tiLe - 1.25) < 1e-9, au.tiLe);

  const dl = r.filter((x) => x.nhom === "di-lai")[0];
  kiem("soNganSach · chua vuot thi khong danh dau", dl.vuot === false);
  kiem("soNganSach · sap theo ti le giam dan", r[0].tiLe >= r[1].tiLe);

  /* Khoan THU khong duoc tinh vao chi tieu cua ngan sach. */
  const r2 = CT.soNganSach(ds, { luong: 5000000 });
  kiem("soNganSach · khoan thu khong bi tinh la chi", r2[0].daChi === 0, r2[0].daChi);
}

/* ====================== 6. CSV ====================== */
{
  kiem("tachDong · tach don gian",
    bang(CT.tachDong("a,b,c"), ["a", "b", "c"]));
  kiem("tachDong · dau phay TRONG dau nhay khong tach",
    bang(CT.tachDong('a,"b,c",d'), ["a", "b,c", "d"]));
  kiem("tachDong · dau nhay doi la mot dau nhay",
    bang(CT.tachDong('a,"nói ""xin chào""",b'),
         ["a", 'nói "xin chào"', "b"]));
  kiem("tachDong · o rong giu lai", bang(CT.tachDong("a,,b"), ["a", "", "b"]));

  const ds = [
    { ngay: "2026-01-05", nhom: "an-uong", tien: 50000, ghiChu: "cơm trưa" },
    { ngay: "2026-01-06", nhom: "di-lai",  tien: 20000, ghiChu: "xe buýt, tuyến 08" },
    { ngay: "2026-01-07", nhom: "khac",    tien: 15000, ghiChu: 'nói "cảm ơn"' },
    { ngay: "2026-01-08", nhom: "luong",   tien: 10000000, ghiChu: "" }
  ];

  const csv = CT.sangCSV(ds);
  kiem("sangCSV · co dong tieu de", csv.split("\n")[0] === "ngay,nhom,tien,ghiChu");
  kiem("sangCSV · dung so dong", csv.split("\n").length === ds.length + 1);
  kiem("sangCSV · boc dau nhay khi co dau phay", csv.indexOf('"xe buýt, tuyến 08"') >= 0);

  /* VONG TRON: xuat roi nhap lai phai ra DUNG du lieu cu, khong sot
     khong lech. Day la phep thu quan trong nhat cua phan CSV. */
  const lai = CT.tuCSV(csv);
  kiem("CSV · xuat roi nhap lai ra dung so ban ghi", lai.length === ds.length);
  kiem("CSV · vong tron giu nguyen tung truong", bang(lai, ds),
    bang(lai, ds) ? "4/4" : JSON.stringify(lai[2]));

  /* Truong hop hong ma nguoi dung hay gap. */
  kiem("tuCSV · khong co tieu de van doc duoc",
    CT.tuCSV("2026-01-05,an-uong,50000,cơm").length === 1);
  kiem("tuCSV · nhom la duoc doi thanh 'khac'",
    CT.tuCSV("2026-01-05,khong-co-nhom-nay,50000,").length === 1 &&
    CT.tuCSV("2026-01-05,khong-co-nhom-nay,50000,")[0].nhom === "khac");
  kiem("tuCSV · dong thieu ngay bi bo qua",
    CT.tuCSV("ngay,nhom,tien,ghiChu\n,an-uong,5000,\n2026-01-01,an-uong,5000,").length === 1);
  kiem("tuCSV · chuoi rong tra mang rong", bang(CT.tuCSV(""), []));
  kiem("tuCSV · doc duoc tien viet kieu '50k'",
    CT.tuCSV("2026-01-05,an-uong,50k,")[0].tien === 50000);
  kiem("tuCSV · chiu duoc xuong dong kieu Windows",
    CT.tuCSV("ngay,nhom,tien,ghiChu\r\n2026-01-05,an-uong,5000,\r\n").length === 1);
}

/* ====================== 7. Du lieu nhom ====================== */
{
  const ma = CT.NHOM.map((n) => n.ma);
  kiem("NHOM · ma khong trung", new Set(ma).size === ma.length);
  kiem("NHOM · moi nhom deu co ten va mau",
    CT.NHOM.every((n) => n.ten && /^#[0-9a-f]{6}$/i.test(n.mau)));
  kiem("NHOM · co it nhat mot nhom THU", CT.NHOM.some((n) => n.thu));
  kiem("NHOM · co nhom 'khac' lam noi chua mac dinh",
    CT.NHOM.some((n) => n.ma === "khac"));
  kiem("NHOM · bang tra khop danh sach",
    Object.keys(CT.banNhom).length === CT.NHOM.length);
}

/* ---------------------------------------------------------------- */
console.log("-".repeat(58));
if (hong) { console.log(hong + " muc SAI.\n"); process.exit(1); }
console.log("Dat — phan loi cua chi-tieu hoat dong dung.\n");
