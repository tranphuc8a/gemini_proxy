/**
 * What the editor can do, in the order a new user needs it.
 *
 * Written as prose rather than a shortcut table: the part people get stuck on
 * is not which key does what, it is that drawing an edge takes two clicks and
 * that the document kind changes what is allowed.
 */

import './HelpModal.css'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="help panel-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header className="row">
          <h2 id="help-title" className="grow">graphuc — hướng dẫn nhanh</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        <div className="prose">
          <h3>Vẽ</h3>
          <ul>
            <li>Chọn công cụ <b>Đỉnh</b> rồi bấm vào canvas để thêm đỉnh.</li>
            <li>Công cụ <b>Cạnh</b> cần <b>hai</b> lần bấm: đỉnh nguồn, rồi đỉnh đích. Sau khi nối xong nó vẫn giữ đỉnh vừa nối làm nguồn, nên vẽ một đường đi liên tiếp rất nhanh.</li>
            <li>Công cụ <b>Chọn</b>: kéo đỉnh để di chuyển, kéo trên nền để quét vùng, giữ <kbd>Shift</kbd> để chọn thêm.</li>
            <li>Kéo bằng chuột giữa (hoặc giữ <kbd>Alt</kbd>) để di chuyển canvas; <kbd>Ctrl</kbd>+lăn chuột để phóng to/thu nhỏ.</li>
          </ul>

          <h3>Kiểu đồ thị quyết định luật</h3>
          <ul>
            <li>Đổi kiểu ở ô chọn trên thanh công cụ. Kiểu quyết định đồ thị có hướng hay không, có cho cạnh song song và khuyên hay không.</li>
            <li>Ràng buộc được <b>báo</b> chứ không <b>chặn</b>: bảng bên phải liệt kê chỗ đang sai và bấm vào là chọn đúng chỗ đó. Việc vẽ thường phải đi qua trạng thái tạm sai, nên chặn sẽ khó chịu hơn là giúp.</li>
            <li>Đổi kiểu không bao giờ xoá gì. Biến một đồ thị có chu trình thành cây sẽ giữ nguyên chu trình và báo cho bạn.</li>
          </ul>

          <h3>Sắp xếp và thuật toán</h3>
          <ul>
            <li>Menu <b>Sắp xếp</b> có bố cục cây, phân tầng, toả tròn, vòng tròn, lưới, hai phía và lực hút/đẩy. Đỉnh được <b>ghim</b> sẽ không bị di chuyển.</li>
            <li>Bảng <b>Thuật toán</b> chạy BFS, DFS, Dijkstra, sắp xếp tô-pô, cây khung nhỏ nhất, thành phần liên thông, kiểm tra 2-phân và tìm chu trình — chạy <i>từng bước</i>, canvas tô sáng theo.</li>
          </ul>

          <h3>Lưu và chia sẻ</h3>
          <ul>
            <li>Mọi thay đổi được tự lưu vào trình duyệt. Mở lại trang là thấy đồ thị gần nhất.</li>
            <li><b>Copy link chia sẻ</b> nhét cả đồ thị vào URL — không cần máy chủ, nhưng chỉ hợp với đồ thị nhỏ.</li>
            <li><b>Lưu lên máy chủ</b> cần admin token, và cho chọn kho: JSON, MySQL hoặc MongoDB. Mỗi kho độc lập với nhau.</li>
            <li>Xuất ra JSON (nhập lại được), PNG, SVG, PDF, DOT cho Graphviz, và ma trận kề dạng CSV.</li>
          </ul>

          <h3>Phím tắt</h3>
          <table className="keys">
            <tbody>
              <tr><td><kbd>V</kbd></td><td>Công cụ chọn</td><td><kbd>N</kbd></td><td>Thêm đỉnh</td></tr>
              <tr><td><kbd>E</kbd></td><td>Thêm cạnh</td><td><kbd>T</kbd></td><td>Ghi chú</td></tr>
              <tr><td><kbd>H</kbd></td><td>Di chuyển canvas</td><td><kbd>X</kbd></td><td>Xoá nhanh</td></tr>
              <tr><td><kbd>Del</kbd></td><td>Xoá phần đang chọn</td><td><kbd>Esc</kbd></td><td>Bỏ chọn</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Hoàn tác</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Làm lại</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Lưu cục bộ</td><td><kbd>Ctrl</kbd>+<kbd>O</kbd></td><td>Mở thư viện</td></tr>
            </tbody>
          </table>
        </div>

        <div className="row">
          <button className="btn btn-primary" onClick={onClose}>Bắt đầu vẽ</button>
        </div>
      </div>
    </div>
  )
}

export default HelpModal
