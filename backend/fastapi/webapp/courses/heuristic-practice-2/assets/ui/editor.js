/* Trình soạn mã của trang thực hành: bộ chuyển (adapter) mỏng giữ nguyên API tiếng Việt cũ cho lab.js / ide.js,
   còn thân là trình soạn dùng chung CS.editor (assets/cs/editor.js — sao chép từ tranphuc8a/code-studio bằng sync.py):
   tô cú pháp, gợi ý khi gõ, tự đóng ngoặc, tự thụt dòng, tìm/thay, tới dòng, tô cặp ngoặc, định dạng, hàng phím ký hiệu cho điện thoại.
   TH.editor.tao(host, {ngon: "cpp"|"c"|"js", giaTri, khiDoi(v), khiChay(), khiDinhDang(), chiDoc, nhan, coChu, ngatDong})
     → {lay, dat, doiNgon, focus, danhDauLoi([{dong,msg,loai}]), nhayToi(dong,cot), chen, dinhDang(tuyChon), tuyChon(o), goc} */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var NGON = { cpp: "cpp", c: "c", js: "javascript", java: "java", python: "python" };

  function tao(host, o) {
    o = o || {};
    var CS = root.CS, cai = (TH.ui && TH.ui.cai && TH.ui.cai()) || {};
    var ed = CS.editor.create(host, {
      lang: NGON[o.ngon] || o.ngon || "cpp", value: o.giaTri || "", readOnly: !!o.chiDoc, keys: !o.chiDoc, label: o.nhan || "Trình soạn mã",
      fontSize: o.coChu || cai.coChu || 14, wrap: o.ngatDong != null ? !!o.ngatDong : !!cai.ngatDong, completion: !o.chiDoc, autoClose: !o.chiDoc,
      onChange: o.khiDoi, onRun: o.khiChay, onFormat: o.khiDinhDang, onSave: o.khiLuu, onCursor: o.khiConTro, onOptions: o.khiDoiTuyChon
    });
    return {
      goc: ed,
      lay: function () { return ed.getValue(); },
      dat: function (v) { ed.setValue(v == null ? "" : String(v)); },
      doiNgon: function (n) { ed.setLang(NGON[n] || n); },
      focus: function () { ed.focus(); },
      chen: function (t) { ed.insert(t); },
      tuyChon: function (x) { ed.setOptions(x); },
      danhDauLoi: function (ds) {
        ed.setMarkers((ds || []).map(function (d) { return { line: d.dong, severity: d.loai === "warning" ? "warning" : d.loai === "note" ? "note" : "error", message: d.msg || d.loai || "lỗi" }; }));
      },
      nhayToi: function (dong, cot) { ed.goTo(dong, cot || 1); },
      /* Định dạng bằng bộ đã chọn; trả Promise<{ok, provider, error}>. Một bước hoàn tác (Ctrl+Z trả lại mã cũ). */
      dinhDang: function (tuyChon) {
        var before = ed.getValue();
        return CS.format.run(before, ed.getLang(), tuyChon || {}).then(function (r) {
          if (r.ok && ed.getValue() === before) ed.replaceAllText(r.text);
          return r;
        });
      }
    };
  }

  TH.editor = { tao: tao };
})(window);
