/* kiem/lich-su.js — cong JE_APP va hoan tac thong nhat (datVanBan, nhan buoc,
   ngan lam lai, tran 100 buoc), chay tren bo DOM gia cua kiem/chung.js.
   Phan phu thuoc trinh duyet that (Ctrl+Z trong textarea roi ve lich su app,
   nut dau trang, Mo tep) kiem bang Edge trong check.py --chuc-nang. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang;
  const MT = C.taoMoiTruong();
  const A = MT.APP, nhap = MT.dom("#nhap");
  const CAN = ["layVanBan", "layDuLieu", "hopLe", "datVanBan", "apDungGoc", "hoanTac", "lamLai", "lichSu",
               "chuyenTab", "tabHien", "denDuong", "denViTri", "denDong", "dangKy", "thongBao"];
  const thieu = CAN.filter((k) => !A || typeof A[k] !== "function");
  if (!kiem("JE_APP · du cac ham cua cong (" + CAN.length + ")", !thieu.length, thieu.join(", "))) return;
  kiem("JE_APP · hangSo doc duoc (tran lich su 100 buoc, tran to mau 300 KB)",
    A.hangSo && A.hangSo.GIOI_HAN_LICH_SU === 100 && A.hangSo.GIOI_HAN_MAU === 300 * 1024);

  /* --- datVanBan: mot buoc co nhan --- */
  const lan = [];
  const huy = A.dangKy("doi-du-lieu", (x) => lan.push(x));
  kiem("lich su · luc dau rong, nut ↶ ↷ (dau trang + bi danh tab Cay) bi tat",
    A.lichSu().soHoanTac === 0 && MT.dom("#nut-hoan-tac").disabled === true && MT.dom("#cay-lam-lai").disabled === true);
  const ghi1 = A.datVanBan('{"b":1,"a":[1,2]}', { nhan: "Dán thử" });
  kiem("datVanBan · ghi van ban + tra true + MOT buoc co nhan",
    ghi1 === true && nhap.value === '{"b":1,"a":[1,2]}' && A.lichSu().soHoanTac === 1 && A.lichSu().nhanHoanTac === "Dán thử");
  kiem("datVanBan · nut dau trang VA bi danh #cay-hoan-tac bat, title neu ten buoc",
    MT.dom("#nut-hoan-tac").disabled === false && MT.dom("#cay-hoan-tac").disabled === false &&
    MT.dom("#nut-hoan-tac").title === "Hoàn tác: Dán thử (Ctrl+Z)", MT.dom("#nut-hoan-tac").title);
  kiem("datVanBan · chay lai doc(): du lieu moi, hop le, bao 'doi-du-lieu'",
    A.hopLe() === true && bang(A.layDuLieu(), { b: 1, a: [1, 2] }) && lan.length >= 1 && lan[lan.length - 1].hopLe === true);
  kiem("datVanBan · van ban y het thi KHONG them buoc (tra false)",
    A.datVanBan('{"b":1,"a":[1,2]}', { nhan: "Lặp" }) === false && A.lichSu().soHoanTac === 1);

  A.datVanBan(JSON.stringify({ b: 1, a: [1, 2] }, null, 2), { nhan: "Định dạng" });
  kiem("lich su · buoc thu hai: nhan hoan tac la buoc MOI NHAT",
    A.lichSu().soHoanTac === 2 && A.lichSu().nhanHoanTac === "Định dạng");

  /* --- hoan tac / lam lai: nhan di theo buoc --- */
  kiem("hoanTac · tra van ban truoc buoc, nhan chuyen sang ngan lam lai",
    A.hoanTac() === true && nhap.value === '{"b":1,"a":[1,2]}' &&
    A.lichSu().soLamLai === 1 && A.lichSu().nhanLamLai === "Định dạng" && A.lichSu().nhanHoanTac === "Dán thử");
  kiem("hoanTac · title nut lam lai doc dung 'Làm lại: Định dạng'",
    MT.dom("#nut-lam-lai").title === "Làm lại: Định dạng (Ctrl+Y)" && MT.dom("#cay-lam-lai").disabled === false,
    MT.dom("#nut-lam-lai").title);
  kiem("lamLai · ap lai buoc vua hoan tac", A.lamLai() === true && nhap.value === JSON.stringify({ b: 1, a: [1, 2] }, null, 2) &&
    A.lichSu().soLamLai === 0 && A.lichSu().nhanHoanTac === "Định dạng");
  A.hoanTac(); A.hoanTac();
  kiem("hoanTac · ve tan van ban dau tien (rong); het buoc thi tra false",
    nhap.value === "" && A.hoanTac() === false && A.lichSu().soLamLai === 2);
  A.lamLai();
  A.datVanBan("[1]", { nhan: "Mới" });
  kiem("datVanBan · buoc moi sau khi hoan tac xoa ngan lam lai",
    A.lichSu().soLamLai === 0 && MT.dom("#nut-lam-lai").disabled === true);

  /* --- vung chon sau khi ghi (ten tuy chon theo thiet ke: viTriChon / giuChon) --- */
  A.datVanBan("0123456789", { nhan: "Chọn", viTriChon: [2, 5] });
  const c1 = [nhap.selectionStart, nhap.selectionEnd];
  A.datVanBan("01234", { nhan: "Giữ", giuChon: true });
  const c2 = [nhap.selectionStart, nhap.selectionEnd];
  A.datVanBan("ab", { nhan: "Giữ 2", giuChon: true });
  kiem("datVanBan · viTriChon dat vung chon; giuChon giu va ket vao do dai moi",
    bang(c1, [2, 5]) && bang(c2, [2, 5]) && bang([nhap.selectionStart, nhap.selectionEnd], [2, 2]),
    JSON.stringify([c1, c2, [nhap.selectionStart, nhap.selectionEnd]]));
  A.datVanBan("x", { nhan: "Số", viTriChon: 1 });
  kiem("datVanBan · viTriChon la mot so = dat con tro", nhap.selectionStart === 1 && nhap.selectionEnd === 1);

  /* --- apDungGoc: sua theo mo hinh, giu kieu thut le --- */
  A.datVanBan(JSON.stringify({ a: 1, b: [1] }, null, 4) + "\n", { nhan: "Thụt 4" });
  const truoc = A.lichSu().soHoanTac;
  A.apDungGoc({ a: 2, b: [1] }, { loai: "thay", duong: ["a"] }, ["a"], "Sửa giá trị");
  kiem("apDungGoc · viet lai THEO kieu thut 4 + dau xuong dong cuoi, mot buoc 'Sửa giá trị'",
    nhap.value === JSON.stringify({ a: 2, b: [1] }, null, 4) + "\n" &&
    A.lichSu().soHoanTac === truoc + 1 && A.lichSu().nhanHoanTac === "Sửa giá trị");

  /* --- van ban loi --- */
  A.datVanBan('{"a": }', { nhan: "Hỏng" });
  kiem("hopLe / layDuLieu · van ban loi -> false / null", A.hopLe() === false && A.layDuLieu() === null);
  nhap.value = '{"go":"tay"}';          /* nguoi dung go, chua qua debounce */
  kiem("layDuLieu · doc lai neu van ban da doi tu lan doc() truoc", bang(A.layDuLieu(), { go: "tay" }) && A.hopLe() === true);

  /* --- tran lich su --- */
  for (let i = 0; i < 130; i++) A.datVanBan("[" + i + "]", { nhan: "B" + i });
  kiem("lich su · tran 100 buoc (bot buoc cu nhat)", A.lichSu().soHoanTac === 100, String(A.lichSu().soHoanTac));

  /* --- dang ky / huy --- */
  const truocHuy = lan.length;
  huy();
  A.datVanBan("[true]", { nhan: "Sau huỷ" });
  kiem("dangKy · ham huy() go nguoi nghe", lan.length === truocHuy);
  let lichSuDoi = 0;
  A.dangKy("doi-lich-su", () => lichSuDoi++);
  A.hoanTac(); A.lamLai();
  kiem("dangKy · 'doi-lich-su' bao sau moi lan hoan tac / lam lai", lichSuDoi === 2, String(lichSuDoi));
  let nem = 0;
  A.dangKy("doi-du-lieu", () => { nem++; throw new Error("nguoi nghe hong"); });
  let sauDo = 0;
  A.dangKy("doi-du-lieu", () => sauDo++);
  A.datVanBan("[false]", { nhan: "X" });
  kiem("dangKy · mot nguoi nghe nem loi khong chan nguoi khac (loi nem lai o luot sau)",
    nem === 1 && sauDo === 1 && MT.soHenCho() > 0);

  /* --- denDong / denViTri (DOM gia: chi kiem vi tri chon) --- */
  A.datVanBan("a\nbb\nccc\n", { nhan: "Dòng" });
  A.denDong(3);
  kiem("denDong · con tro ve dau dong 3", nhap.selectionStart === 5 && nhap.selectionEnd === 5,
    nhap.selectionStart + "," + nhap.selectionEnd);
  A.denViTri(2, 4);
  kiem("denViTri · chon dung doan [2, 4)", nhap.selectionStart === 2 && nhap.selectionEnd === 4);
  A.denViTri(-5, 999);
  kiem("denViTri · ket vao trong van ban", nhap.selectionStart === 0 && nhap.selectionEnd === nhap.value.length);
  kiem("denDuong · tab Soan chua ho tro (can vi-tri.js) — tra false, khong nem",
    A.denDuong(["a"], { tab: "soan" }) === false);

  /* ================= Phim tat trong #nhap: luat giao cho hoan tac goc ================= */
  C.nhom("Ctrl+Z / Ctrl+Y / Tab trong o Soan (su kien gia)");
  const M2 = C.taoMoiTruong();
  const B = M2.APP, n2 = M2.dom("#nhap");
  const phim = (them) => M2.phat("#nhap", "keydown", them);
  const go = (s) => { n2.value = s; return M2.phat("#nhap", "input", { inputType: "insertText" }); };
  const goc = (s, loai) => { n2.value = s; return M2.phat("#nhap", "input", { inputType: loai }); };
  const Z = { key: "z", ctrlKey: true }, Y = { key: "y", ctrlKey: true }, SZ = { key: "Z", ctrlKey: true, shiftKey: true };

  go('{"b":1}');
  B.datVanBan('{\n  "b": 1\n}', { nhan: "Định dạng" });
  kiem("go roi Định dạng · them buoc 'Sửa tay' cho van ban luc mo trang (rong) + buoc 'Định dạng'",
    B.lichSu().soHoanTac === 2 && B.lichSu().nhanHoanTac === "Định dạng", JSON.stringify(B.lichSu()));
  let e = phim(Z);
  kiem("Ctrl+Z ngay sau may ghi · CHAN phim (khong de trinh duyet cham buoc go da chet) + hoan tac app",
    e.defaultPrevented && n2.value === '{"b":1}' && B.lichSu().nhanLamLai === "Định dạng");
  e = phim(Z);
  kiem("Ctrl+Z lan nua · van chan, ve van ban luc mo trang (buoc 'Sửa tay')",
    e.defaultPrevented && n2.value === "" && B.lichSu().nhanLamLai === "Sửa tay");
  e = phim(Y);
  kiem("Ctrl+Y chua go gi · chan phim + lam lai cua app", e.defaultPrevented && n2.value === '{"b":1}');
  e = phim(SZ);
  kiem("Ctrl+Shift+Z · cung la lam lai", e.defaultPrevented && n2.value === '{\n  "b": 1\n}');

  go('{\n  "b": 1\n}x');
  kiem("go sau may ghi · xoa ngan lam lai cua app", B.lichSu().soLamLai === 0);
  e = phim(Z);
  kiem("Ctrl+Z khi da go · GIAO cho trinh duyet (khong chan)", !e.defaultPrevented);
  goc('{\n  "b": 1\n}', "historyUndo");            /* trinh duyet go "x" */
  M2.chayHen();
  kiem("trinh duyet da doi van ban · app KHONG hoan tac them", n2.value === '{\n  "b": 1\n}' && B.lichSu().soHoanTac === 2);
  e = phim(Y);
  kiem("Ctrl+Y sau khi tu hoan tac goc phan da go · giao cho trinh duyet (lam lai 'x')", !e.defaultPrevented);
  goc('{\n  "b": 1\n}x', "historyRedo");
  M2.chayHen();
  e = phim(Z);
  goc('{\n  "b": 1\n}', "historyUndo");
  M2.chayHen();
  e = phim(Z);
  kiem("het phan da go (van ban = ban may ghi) · Ctrl+Z lai bi chan, app bo 'Định dạng'",
    e.defaultPrevented && n2.value === '{"b":1}');

  /* giao cho trinh duyet ma van ban khong doi -> roi ve app */
  B.datVanBan("[1]", { nhan: "Nén" });
  go("[1,2]");
  e = phim(Z);
  M2.chayHen();                                     /* trinh duyet khong lam gi */
  kiem("giao cho trinh duyet ma van ban y nguyen · sau setTimeout 0 roi ve hoan tac app",
    !e.defaultPrevented && n2.value === "[1]", JSON.stringify(n2.value));

  /* nut ↶ (hoanTac cua app) khi nguoi dung da go tu lan may ghi */
  B.datVanBan('{"k":1}', { nhan: "Mẫu" });
  go('{"k":2}');
  B.hoanTac();
  kiem("nut ↶ sau khi go · buoc dau bo PHAN DA GO (ve ban may ghi), khong nhay qua no",
    n2.value === '{"k":1}' && B.lichSu().nhanLamLai === "Sửa tay" && B.lichSu().nhanHoanTac === "Mẫu");
  B.lamLai();
  kiem("nut ↷ · tra lai phan da go", n2.value === '{"k":2}');
  B.hoanTac(); B.hoanTac();
  kiem("nut ↶ lan nua · bo buoc 'Mẫu'", n2.value === "[1]");

  /* beforeinput (menu chuot phai / Edit → Undo) */
  B.datVanBan("[9]", { nhan: "Thử menu" });
  e = M2.phat("#nhap", "beforeinput", { inputType: "historyUndo", cancelable: true });
  kiem("beforeinput historyUndo khi chi con buoc chet · huy + hoan tac app", e.defaultPrevented && n2.value === "[1]");
  go("[1]!");
  e = M2.phat("#nhap", "beforeinput", { inputType: "historyUndo", cancelable: true });
  kiem("beforeinput historyUndo khi con phan da go · de trinh duyet lam", !e.defaultPrevented);

  /* Tab / Esc+Tab (fake execCommand tra false -> duong du phong datVanBan) */
  B.datVanBan('{\n    "a": 1\n}', { nhan: "Thụt 4" });
  n2.setSelectionRange(1, 1);
  e = phim({ key: "Tab" });
  kiem("Tab · chan phim, chen 4 dau cach theo kieu van ban (du phong: mot buoc 'Thụt lề')",
    e.defaultPrevented && n2.value === '{    \n    "a": 1\n}' && B.lichSu().nhanHoanTac === "Thụt lề" && n2.selectionStart === 5,
    JSON.stringify(n2.value));
  phim({ key: "Escape" });
  phim({ key: "Shift" });
  e = phim({ key: "Tab", shiftKey: true });
  kiem("Esc (Shift xen giua) roi Shift+Tab · KHONG chan — trinh duyet chuyen focus", !e.defaultPrevented);
  phim({ key: "Escape" });
  phim({ key: "ArrowLeft" });
  e = phim({ key: "Tab" });
  kiem("Esc, phim khac, roi Tab · lai thut le nhu thuong", e.defaultPrevented);
  phim({ key: "Escape" });
  M2.phat("#nhap", "blur");
  e = phim({ key: "Tab" });
  kiem("Esc roi roi o (blur) · quen trang thai Esc", e.defaultPrevented);
  e = phim({ key: "Tab", isComposing: true });
  kiem("dang go IME · khong dung toi phim", !e.defaultPrevented);
};
