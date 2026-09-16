/**
 * The keypad, as data.
 *
 * Every key on the fx-580VN X does up to three things depending on whether
 * SHIFT or ALPHA was pressed first, and the two extra labels are printed above
 * it in gold and red. Describing that as data rather than as markup means the
 * layout and the behaviour cannot drift apart, and the whole thing renders from
 * one loop.
 *
 * `insert` is literal text that goes into the entry line. `action` is a key
 * that does something else — equals, delete, cursor movement. A key can have
 * both, one for each modifier level.
 */

export type KeyAction =
  | 'equals'
  | 'ac'
  | 'del'
  | 'shift'
  | 'alpha'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'sd'
  | 'mode'
  | 'setup'
  | 'calc'
  | 'solve'
  | 'sto'
  | 'rcl'
  | 'mplus'
  | 'mminus'
  | 'off'

export interface Key {
  id: string
  label: string
  shiftLabel?: string
  alphaLabel?: string
  insert?: string
  shiftInsert?: string
  alphaInsert?: string
  action?: KeyAction
  shiftAction?: KeyAction
  alphaAction?: KeyAction
  tone?: 'number' | 'operator' | 'function' | 'control' | 'accent'
  /** Grid columns this key spans. */
  span?: number
  /** A hint shown on hover, because half these symbols are not obvious. */
  title?: string
}

/** The five rows of white/grey function keys above the number pad. */
export const FUNCTION_ROWS: Key[][] = [
  [
    { id: 'calc', label: 'CALC', shiftLabel: 'SOLVE', action: 'calc', shiftAction: 'solve', tone: 'function', title: 'Tính công thức với biến / Giải phương trình' },
    { id: 'integral', label: '∫dx', shiftLabel: 'd/dx', insert: '∫(', shiftInsert: 'd/dx(', tone: 'function', title: 'Tích phân ∫(f, cận dưới, cận trên) / Đạo hàm d/dx(f, x)' },
    { id: 'sigma', label: 'Σ', shiftLabel: '∏', insert: 'Σ(', shiftInsert: '∏(', tone: 'function', title: 'Tổng Σ(f, đầu, cuối) / Tích ∏(f, đầu, cuối)' },
    { id: 'frac', label: 'a⁄b', shiftLabel: '⌟', insert: '÷', shiftInsert: '÷', tone: 'function', title: 'Phân số' },
    { id: 'sqrt', label: '√', shiftLabel: '∛', insert: '√(', shiftInsert: '∛(', tone: 'function', title: 'Căn bậc hai / Căn bậc ba' },
    { id: 'square', label: 'x²', shiftLabel: 'x³', insert: '²', shiftInsert: '³', tone: 'function', title: 'Bình phương / Lập phương' },
  ],
  [
    { id: 'power', label: 'x■', shiftLabel: 'ˣ√', insert: '^(', shiftInsert: '^(1÷', tone: 'function', title: 'Luỹ thừa / Căn bậc n' },
    { id: 'log', label: 'log', shiftLabel: '10ˣ', alphaLabel: 'log□', insert: 'log(', shiftInsert: '10^(', alphaInsert: 'log(', tone: 'function', title: 'Logarit cơ số 10 — log(cơ số, số) cho cơ số khác' },
    { id: 'ln', label: 'ln', shiftLabel: 'eˣ', insert: 'ln(', shiftInsert: 'e^(', tone: 'function', title: 'Logarit tự nhiên / e mũ x' },
    { id: 'negate', label: '(−)', shiftLabel: '∠', insert: '-', shiftInsert: '∠', tone: 'function', title: 'Dấu âm / Nhập số phức dạng r∠θ' },
    { id: 'dms', label: '° ’ ”', shiftLabel: 'ʳ', insert: '°', shiftInsert: 'ʳ', tone: 'function', title: 'Độ / Radian' },
    { id: 'hyp', label: 'hyp', shiftLabel: 'Abs', insert: 'sinh(', shiftInsert: 'Abs(', tone: 'function', title: 'sinh / Giá trị tuyệt đối — dùng phím sin,cos,tan cho cosh, tanh' },
  ],
  [
    { id: 'sin', label: 'sin', shiftLabel: 'sin⁻¹', alphaLabel: 'sinh', insert: 'sin(', shiftInsert: 'sin⁻¹(', alphaInsert: 'sinh(', tone: 'function' },
    { id: 'cos', label: 'cos', shiftLabel: 'cos⁻¹', alphaLabel: 'cosh', insert: 'cos(', shiftInsert: 'cos⁻¹(', alphaInsert: 'cosh(', tone: 'function' },
    { id: 'tan', label: 'tan', shiftLabel: 'tan⁻¹', alphaLabel: 'tanh', insert: 'tan(', shiftInsert: 'tan⁻¹(', alphaInsert: 'tanh(', tone: 'function' },
    { id: 'reciprocal', label: 'x⁻¹', shiftLabel: 'x!', insert: '⁻¹', shiftInsert: '!', tone: 'function', title: 'Nghịch đảo / Giai thừa' },
    { id: 'ncr', label: 'nCr', shiftLabel: 'nPr', insert: ' nCr ', shiftInsert: ' nPr ', tone: 'function', title: 'Tổ hợp / Chỉnh hợp' },
    { id: 'mod', label: '÷R', shiftLabel: 'GCD', alphaLabel: 'LCM', insert: ' Mod ', shiftInsert: 'GCD(', alphaInsert: 'LCM(', tone: 'function', title: 'Chia lấy dư / Ước chung lớn nhất / Bội chung nhỏ nhất' },
  ],
  [
    { id: 'sto', label: 'STO', shiftLabel: 'RCL', action: 'sto', shiftAction: 'rcl', tone: 'function', title: 'Gán vào biến nhớ / Gọi lại biến nhớ' },
    { id: 'eng', label: 'ENG', shiftLabel: 'Ran#', alphaLabel: 'RanInt', insert: '×10^(', shiftInsert: 'Ran#', alphaInsert: 'RanInt(', tone: 'function', title: 'Ký hiệu mũ / Số ngẫu nhiên' },
    { id: 'lparen', label: '(', shiftLabel: 'Pol', insert: '(', shiftInsert: 'Pol(', tone: 'function', title: 'Mở ngoặc / Đổi sang toạ độ cực' },
    { id: 'rparen', label: ')', shiftLabel: 'Rec', insert: ')', shiftInsert: 'Rec(', tone: 'function', title: 'Đóng ngoặc / Đổi sang toạ độ vuông' },
    { id: 'comma', label: ',', shiftLabel: ':', insert: ',', shiftInsert: ':', tone: 'function', title: 'Dấu phẩy giữa các tham số / Nối nhiều câu lệnh' },
    { id: 'sd', label: 'S⇔D', shiftLabel: 'M+', alphaLabel: 'M−', action: 'sd', shiftAction: 'mplus', alphaAction: 'mminus', tone: 'function', title: 'Đổi giữa dạng đúng và dạng thập phân / Cộng, trừ kết quả vào bộ nhớ M'},
  ],
]

/** The number pad and the operators. */
export const NUMBER_ROWS: Key[][] = [
  [
    { id: '7', label: '7', insert: '7', tone: 'number' },
    { id: '8', label: '8', insert: '8', tone: 'number' },
    { id: '9', label: '9', insert: '9', tone: 'number' },
    { id: 'del', label: 'DEL', shiftLabel: 'INS', action: 'del', tone: 'control' },
    { id: 'ac', label: 'AC', shiftLabel: 'OFF', action: 'ac', shiftAction: 'off', tone: 'control' },
  ],
  [
    { id: '4', label: '4', insert: '4', tone: 'number' },
    { id: '5', label: '5', insert: '5', tone: 'number' },
    { id: '6', label: '6', insert: '6', tone: 'number' },
    { id: 'times', label: '×', insert: '×', tone: 'operator' },
    { id: 'divide', label: '÷', insert: '÷', tone: 'operator' },
  ],
  [
    { id: '1', label: '1', insert: '1', tone: 'number' },
    { id: '2', label: '2', insert: '2', tone: 'number' },
    { id: '3', label: '3', insert: '3', tone: 'number' },
    { id: 'plus', label: '+', insert: '+', tone: 'operator' },
    { id: 'minus', label: '−', insert: '-', tone: 'operator' },
  ],
  [
    { id: '0', label: '0', insert: '0', tone: 'number' },
    { id: 'dot', label: '.', insert: '.', tone: 'number' },
    { id: 'exp', label: '×10ˣ', shiftLabel: 'π', alphaLabel: 'e', insert: 'E', shiftInsert: 'π', alphaInsert: 'e', tone: 'number', title: 'Nhập số mũ / Hằng số π / Hằng số e' },
    { id: 'ans', label: 'Ans', shiftLabel: 'PreAns', insert: 'Ans', shiftInsert: 'PreAns', tone: 'operator', title: 'Kết quả trước / Kết quả trước nữa' },
    { id: 'equals', label: '=', action: 'equals', tone: 'accent' },
  ],
]

/**
 * The letters ALPHA reaches.
 *
 * On the machine these are printed in red on the keys above; here they get
 * their own small strip, because a browser has no red printing and hunting for
 * `A` on the `x²` key is not a feature worth reproducing.
 */
export const ALPHA_KEYS: Key[] = [
  { id: 'var-A', label: 'A', insert: 'A', tone: 'function' },
  { id: 'var-B', label: 'B', insert: 'B', tone: 'function' },
  { id: 'var-C', label: 'C', insert: 'C', tone: 'function' },
  { id: 'var-D', label: 'D', insert: 'D', tone: 'function' },
  { id: 'var-E', label: 'E', insert: 'E', tone: 'function' },
  { id: 'var-F', label: 'F', insert: 'F', tone: 'function' },
  { id: 'var-x', label: 'x', insert: 'x', tone: 'function' },
  { id: 'var-y', label: 'y', insert: 'y', tone: 'function' },
  { id: 'var-M', label: 'M', insert: 'M', tone: 'function' },
  { id: 'store-arrow', label: '→', insert: '→', tone: 'function', title: 'Gán: 5→A' },
]

/** What a key does at the current modifier level. */
export function resolveKey(
  key: Key,
  shift: boolean,
  alpha: boolean,
): { insert?: string; action?: KeyAction } {
  if (shift && (key.shiftInsert || key.shiftAction)) {
    return { insert: key.shiftInsert, action: key.shiftAction }
  }
  if (alpha && (key.alphaInsert || key.alphaAction)) {
    return { insert: key.alphaInsert, action: key.alphaAction }
  }
  return { insert: key.insert, action: key.action }
}
