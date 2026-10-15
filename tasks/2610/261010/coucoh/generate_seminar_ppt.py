from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor

OUT = r"c:\Users\tranphuc8a\Desktop\gemini_proxy\tasks\2610\261010\coucoh\seminar-coupling-cohesion-60p.pptx"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

NAVY = RGBColor(15, 23, 42)
BLUE = RGBColor(37, 99, 235)
CYAN = RGBColor(14, 165, 233)
TEAL = RGBColor(20, 184, 166)
GREEN = RGBColor(34, 197, 94)
ORANGE = RGBColor(249, 115, 22)
RED = RGBColor(239, 68, 68)
PURPLE = RGBColor(139, 92, 246)
GOLD = RGBColor(245, 158, 11)
WHITE = RGBColor(255, 255, 255)
SLATE = RGBColor(51, 65, 85)
LIGHT = RGBColor(241, 245, 249)
LIGHT2 = RGBColor(226, 232, 240)
DARK = RGBColor(15, 23, 42)


def hex_to_rgb(value):
    value = value.lstrip('#')
    return RGBColor(int(value[:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def add_bg(slide, color=LIGHT):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_title(slide, title, subtitle=None, color=DARK, title_size=26, subtitle_size=11):
    title_box = slide.shapes.add_textbox(Inches(0.6), Inches(0.35), Inches(12), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.alignment = PP_ALIGN.LEFT
    run = p.runs[0]
    run.font.name = 'Segoe UI Semibold'
    run.font.size = Pt(title_size)
    run.font.bold = True
    run.font.color.rgb = color
    if subtitle:
        sub_box = slide.shapes.add_textbox(Inches(0.65), Inches(0.95), Inches(7), Inches(0.4))
        tf2 = sub_box.text_frame
        p2 = tf2.paragraphs[0]
        p2.text = subtitle
        p2.alignment = PP_ALIGN.LEFT
        run2 = p2.runs[0]
        run2.font.name = 'Segoe UI'
        run2.font.size = Pt(subtitle_size)
        run2.font.color.rgb = RGBColor(100, 116, 139)


def add_footer(slide, page_no):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(7.1), Inches(13.333), Inches(0.4))
    bar.fill.solid()
    bar.fill.fore_color.rgb = NAVY
    bar.line.fill.background()
    txt = slide.shapes.add_textbox(Inches(0.6), Inches(7.18), Inches(3), Inches(0.2))
    p = txt.text_frame.paragraphs[0]
    p.text = "Seminar: Tối ưu Coupling & Cohesion"
    run = p.runs[0]
    run.font.name = 'Segoe UI'
    run.font.size = Pt(9)
    run.font.color.rgb = WHITE
    num = slide.shapes.add_textbox(Inches(12.35), Inches(7.18), Inches(0.5), Inches(0.2))
    p2 = num.text_frame.paragraphs[0]
    p2.text = str(page_no)
    run2 = p2.runs[0]
    run2.font.name = 'Segoe UI'
    run2.font.size = Pt(9)
    run2.font.color.rgb = WHITE
    p2.alignment = PP_ALIGN.RIGHT


def add_card(slide, left, top, width, height, title, body_lines, fill_color, title_color=None, body_color=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.adjustments[0] = 0.12
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    shape.line.color.rgb = RGBColor(148, 163, 184)
    shape.line.width = Pt(1.2)
    box = shape.text_frame
    box.margin_left = Inches(0.18)
    box.margin_right = Inches(0.18)
    box.margin_top = Inches(0.12)
    box.margin_bottom = Inches(0.08)
    box.word_wrap = True
    p = box.paragraphs[0]
    p.text = title
    p.level = 0
    run = p.runs[0]
    run.font.name = 'Segoe UI Semibold'
    run.font.bold = True
    run.font.size = Pt(15)
    run.font.color.rgb = title_color or DARK
    p.space_after = Pt(6)
    for line in body_lines:
        p = box.add_paragraph()
        p.text = line
        p.level = 0
        p.bullet = True
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(5)
        run = p.runs[0]
        run.font.name = 'Segoe UI'
        run.font.size = Pt(11)
        run.font.color.rgb = body_color or DARK


def add_compare(slide, left, top, width, height, title_left, title_right, left_items, right_items, accent_left=BLUE, accent_right=GREEN):
    rect1 = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width/2 - Inches(0.18), height)
    rect1.fill.solid(); rect1.fill.fore_color.rgb = RGBColor(239, 246, 255)
    rect1.line.color.rgb = accent_left
    rect1.line.width = Pt(1.2)
    rect2 = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left + width/2 + Inches(0.18), top, width/2 - Inches(0.18), height)
    rect2.fill.solid(); rect2.fill.fore_color.rgb = RGBColor(240, 253, 244)
    rect2.line.color.rgb = accent_right
    rect2.line.width = Pt(1.2)
    for box, label, items, color in [(rect1, title_left, left_items, accent_left), (rect2, title_right, right_items, accent_right)]:
        tf = box.text_frame
        tf.clear()
        p = tf.paragraphs[0]
        p.text = label
        p.alignment = PP_ALIGN.CENTER
        run = p.runs[0]
        run.font.name = 'Segoe UI Semibold'
        run.font.size = Pt(16)
        run.font.bold = True
        run.font.color.rgb = color
        p.space_after = Pt(10)
        for it in items:
            p = tf.add_paragraph(); p.text = it; p.bullet = True; p.level = 0
            p.alignment = PP_ALIGN.LEFT
            run = p.runs[0]; run.font.size = Pt(12); run.font.name = 'Segoe UI'; run.font.color.rgb = DARK
            if label == title_left:
                p.space_after = Pt(6)
            else:
                p.space_after = Pt(6)


def add_arrow(slide, x1, y1, x2, y2, color=BLUE):
    line = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x1, y1, x2 - x1, y2 - y1)
    line.fill.solid(); line.fill.fore_color.rgb = color
    line.line.color.rgb = color
    line.line.width = Pt(1.5)


def add_icon_block(slide, icon, left, top, width, height, fill_color, title, subtitle=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid(); shape.fill.fore_color.rgb = fill_color
    shape.line.color.rgb = RGBColor(148, 163, 184)
    shape.line.width = Pt(1.1)
    txt = slide.shapes.add_textbox(left + Inches(0.14), top + Inches(0.16), width - Inches(0.28), height - Inches(0.2))
    tf = txt.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = f"{icon}\n{title}"
    p.alignment = PP_ALIGN.CENTER
    run = p.runs[0]
    run.font.name = 'Segoe UI'
    run.font.size = Pt(16)
    run.font.bold = True
    run.font.color.rgb = WHITE
    if subtitle:
        p2 = tf.add_paragraph()
        p2.text = subtitle
        p2.alignment = PP_ALIGN.CENTER
        run2 = p2.runs[0]
        run2.font.name = 'Segoe UI'
        run2.font.size = Pt(9)
        run2.font.color.rgb = RGBColor(224, 242, 254)


def add_small_label(slide, x, y, text, color=BLUE):
    box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, Inches(1.1), Inches(0.3))
    box.fill.solid(); box.fill.fore_color.rgb = color
    box.line.fill.background()
    tf = box.text_frame
    p = tf.paragraphs[0]; p.text = text; p.alignment = PP_ALIGN.CENTER
    run = p.runs[0]; run.font.name='Segoe UI'; run.font.size=Pt(9); run.font.bold=True; run.font.color.rgb=WHITE


# Slide 1 - Cover
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, NAVY)
# big title
shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.55), Inches(0.7), Inches(8.8), Inches(1.7))
shape.fill.solid(); shape.fill.fore_color.rgb = NAVY
shape.line.fill.background()
textbox = slide.shapes.add_textbox(Inches(0.8), Inches(0.95), Inches(8.4), Inches(1.2))
tf = textbox.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]; p.text = 'Tối ưu Coupling & Cohesion\ntrong Java'
run = p.runs[0]; run.font.name='Segoe UI'; run.font.size=Pt(30); run.font.bold=True; run.font.color.rgb=WHITE
# accent block
accent = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9.3), Inches(1.1), Inches(3.2), Inches(1.2))
accent.fill.solid(); accent.fill.fore_color.rgb = BLUE
accent.line.fill.background()
acc_txt = slide.shapes.add_textbox(Inches(9.55), Inches(1.45), Inches(2.8), Inches(0.6))
p2 = acc_txt.text_frame.paragraphs[0]; p2.text = 'Seminar 60 phút'; p2.alignment = PP_ALIGN.CENTER; run2 = p2.runs[0]; run2.font.name='Segoe UI'; run2.font.size=Pt(17); run2.font.bold=True; run2.font.color.rgb=WHITE
# hero area
hero = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(2.4), Inches(11.7), Inches(3.2))
hero.fill.solid(); hero.fill.fore_color.rgb = RGBColor(15, 118, 110)
hero.line.fill.background()
# simple diagram boxes
box1 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.1), Inches(2.8), Inches(2.2), Inches(1.2)); box1.fill.solid(); box1.fill.fore_color.rgb = RGBColor(191, 219, 254); box1.line.color.rgb = BLUE
box1.text_frame.text = 'Low\nCoupling'
box2 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.1), Inches(2.8), Inches(2.35), Inches(1.2)); box2.fill.solid(); box2.fill.fore_color.rgb = RGBColor(187, 247, 208); box2.line.color.rgb = GREEN
box2.text_frame.text = 'High\nCohesion'
box3 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9.2), Inches(2.8), Inches(2.5), Inches(1.2)); box3.fill.solid(); box3.fill.fore_color.rgb = RGBColor(254, 215, 170); box3.line.color.rgb = ORANGE
box3.text_frame.text = 'Easy to\nMaintain'
for sh in [box1, box2, box3]:
    tf = sh.text_frame; tf.paragraphs[0].alignment = PP_ALIGN.CENTER; run = tf.paragraphs[0].runs[0]; run.font.name='Segoe UI'; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb = DARK
arrow1 = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(3.35), Inches(3.35), Inches(1.75), Inches(0.1)); arrow1.fill.solid(); arrow1.fill.fore_color.rgb = WHITE; arrow1.line.color.rgb = WHITE
arrow2 = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(7.5), Inches(3.35), Inches(1.65), Inches(0.1)); arrow2.fill.solid(); arrow2.fill.fore_color.rgb = WHITE; arrow2.line.color.rgb = WHITE
bottom = slide.shapes.add_textbox(Inches(0.9), Inches(5.9), Inches(11.5), Inches(0.6))
p3 = bottom.text_frame.paragraphs[0]; p3.text = 'Mục tiêu: xây dựng hệ thống linh hoạt, dễ thay đổi, ít phản ứng dây chuyền.'; run3 = p3.runs[0]; run3.font.name='Segoe UI'; run3.font.size=Pt(17); run3.font.color.rgb = WHITE
add_footer(slide, 1)

# Slide 2 - Agenda
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Agenda seminar', subtitle='60 phút · 3 phần lớn', color=DARK)
# 5 cards
cards = [
    ('01', 'Nền tảng', 'Khái niệm, quan hệ và mục tiêu', BLUE),
    ('02', 'Coupling', 'Content, common, control, stamp, message', CYAN),
    ('03', 'Cohesion', 'Coincidental đến functional', TEAL),
    ('04', 'SOLID + Test', 'DIP, SRP, unit test, refactor', GREEN),
    ('05', 'Thực hành', 'Metric, tool, checklist design', ORANGE),
]
for idx, (n, title, text, color) in enumerate(cards):
    left = Inches(0.8 + (idx % 3) * 3.95)
    top = Inches(1.6 + (idx // 3) * 2.2)
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(3.2), Inches(1.5))
    card.fill.solid(); card.fill.fore_color.rgb = color
    card.line.color.rgb = RGBColor(148, 163, 184)
    txt = card.text_frame; txt.margin_left = Inches(0.18); txt.margin_right = Inches(0.18); txt.margin_top = Inches(0.12)
    p = txt.paragraphs[0]; p.text = n; run = p.runs[0]; run.font.size=Pt(20); run.font.bold=True; run.font.color.rgb = WHITE
    p2 = txt.add_paragraph(); p2.text = title; run2=p2.runs[0]; run2.font.size=Pt(16); run2.font.bold=True; run2.font.color.rgb = WHITE
    p3 = txt.add_paragraph(); p3.text = text; run3=p3.runs[0]; run3.font.size=Pt(10); run3.font.color.rgb = RGBColor(240, 249, 255)
add_footer(slide, 2)

# Slide 3 - Core concept
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Cốt lõi của thiết kế phần mềm', subtitle='Coupling và Cohesion là hai mặt của cùng một vấn đề', color=DARK)
add_compare(slide, Inches(0.8), Inches(1.8), Inches(11.6), Inches(3.4), 'Coupling', 'Cohesion',
    ['Các module phụ thuộc lẫn nhau', 'Thay đổi của module A làm B ảnh hưởng', 'Mức độ gắn kết của hệ thống quá mạnh'],
    ['Các thành phần trong cùng module hợp nhau', 'Một module chỉ làm một “cái gì đó”', 'Nộp trách nhiệm rõ ràng và tập trung'],
    BLUE, GREEN)
box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(5.6), Inches(11.7), Inches(0.8)); box.fill.solid(); box.fill.fore_color.rgb = RGBColor(239,246,255); box.line.color.rgb = BLUE
p = box.text_frame.paragraphs[0]; p.text = 'Mục tiêu: giảm phụ thuộc giữa module, tăng sự tập trung bên trong module.'; run = p.runs[0]; run.font.name='Segoe UI Semibold'; run.font.size=Pt(17); run.font.color.rgb = DARK
add_footer(slide, 3)

# Slide 4 - Why tight coupling is bad
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Tại sao Tight Coupling là “kẻ thù” của bảo trì?', subtitle='Một thay đổi nhỏ có thể kéo theo hàng loạt hệ thống bị sửa', color=DARK)
# left circle
circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.0), Inches(1.9), Inches(2.2), Inches(2.2)); circle.fill.solid(); circle.fill.fore_color.rgb = RED; circle.line.color.rgb = RED
c_t = circle.text_frame.paragraphs[0]; c_t.text='A'; c_t.alignment=PP_ALIGN.CENTER; run = c_t.runs[0]; run.font.size=Pt(28); run.font.bold=True; run.font.color.rgb=WHITE
# arrows and boxes
for i, label in enumerate(['B', 'C', 'D', 'E']):
    x = Inches(3.7 + i*1.9)
    box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, Inches(2.0 + (i % 2)*1.4), Inches(1.3), Inches(1.0)); box.fill.solid(); box.fill.fore_color.rgb = RGBColor(254, 226, 226); box.line.color.rgb = RED
    t = box.text_frame.paragraphs[0]; t.text = label; t.alignment=PP_ALIGN.CENTER; run = t.runs[0]; run.font.size=Pt(20); run.font.bold=True; run.font.color.rgb = RED
    if i > 0:
        arr = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(3.2 + (i-1)*1.9), Inches(2.5 + (i-1)*0.7), Inches(0.6), Inches(0.1)); arr.fill.solid(); arr.fill.fore_color.rgb = RED; arr.line.color.rgb = RED
# impact list
impact = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.2), Inches(1.8), Inches(4.2), Inches(3.7)); impact.fill.solid(); impact.fill.fore_color.rgb = WHITE; impact.line.color.rgb = RED
impact_tf = impact.text_frame; impact_tf.word_wrap=True; impact_tf.margin_left=Inches(0.2)
for idx, item in enumerate(['Ripple effect', 'Khó test', 'Khó tái sử dụng', 'Cập nhật sai phạm']):
    p = impact_tf.paragraphs[0] if idx == 0 else impact_tf.add_paragraph(); p.text = '• ' + item; p.bullet = True; run = p.runs[0]; run.font.size=Pt(16); run.font.color.rgb = DARK
add_footer(slide, 4)

# Slide 5 - Coupling types overview
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Các loại Coupling thường gặp', subtitle='Độ nguy hiểm tăng dần theo mức phụ thuộc trực tiếp và ẩn tàng', color=DARK)
# cards
items = [
    ('Content Coupling', 'Truy cập trực tiếp field/private state', RED),
    ('Common Coupling', 'Static/public global state', ORANGE),
    ('Control Coupling', 'Gọi nhau theo flag/luồng điều khiển', GOLD),
    ('Stamp Coupling', 'Chuyền cả object lớn chỉ cần 1 field', PURPLE),
    ('Message Coupling', 'Giao tiếp qua interface / message', GREEN),
]
for idx, (title, text, color) in enumerate(items):
    left = Inches(0.75 + (idx % 3)*4.0)
    top = Inches(1.7 + (idx // 3)*2.1)
    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(3.3), Inches(1.5))
    box.fill.solid(); box.fill.fore_color.rgb = RGBColor(248,250,252)
    box.line.color.rgb = color
    tf = box.text_frame
    tf.margin_left = Inches(0.18); tf.margin_right = Inches(0.18); tf.margin_top = Inches(0.1)
    p = tf.paragraphs[0]; p.text = title; run = p.runs[0]; run.font.bold=True; run.font.size=Pt(16); run.font.color.rgb = color
    p2 = tf.add_paragraph(); p2.text = text; run2 = p2.runs[0]; run2.font.size=Pt(10); run2.font.color.rgb = DARK
add_footer(slide, 5)

# Slide 6 - Content coupling
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Content Coupling', subtitle='Mức độ nguy hiểm nhất — truy cập trực tiếp state của đối tượng khác', color=DARK)
# left bad
bad = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(1.8), Inches(4.4), Inches(3.8)); bad.fill.solid(); bad.fill.fore_color.rgb = RGBColor(254, 226, 226); bad.line.color.rgb = RED
bad_t = bad.text_frame.paragraphs[0]; bad_t.text = 'Bad practice'; bad_t.alignment=PP_ALIGN.CENTER; run=bad_t.runs[0]; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb = RED
p = bad.text_frame.add_paragraph(); p.text = 'User user = new User();\nuser.balance = 0;\nuser.status = "BLOCKED";'; run = p.runs[0]; run.font.name='Consolas'; run.font.size=Pt(18); run.font.color.rgb = DARK
# right good
good = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.8), Inches(1.8), Inches(4.5), Inches(3.8)); good.fill.solid(); good.fill.fore_color.rgb = RGBColor(220, 252, 231); good.line.color.rgb = GREEN
good_t = good.text_frame.paragraphs[0]; good_t.text = 'Better'; good_t.alignment=PP_ALIGN.CENTER; run=good_t.runs[0]; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb = GREEN
p = good.text_frame.add_paragraph(); p.text = 'user.debit(500);\nuser.freezeAccount();\n-> Nhà quản lý trạng thái ở 1 nơi'; run = p.runs[0]; run.font.name='Consolas'; run.font.size=Pt(16); run.font.color.rgb = DARK
note = slide.shapes.add_textbox(Inches(0.9), Inches(5.9), Inches(11.6), Inches(0.7)); p = note.text_frame.paragraphs[0]; p.text = 'Nguy hiểm vì phá vỡ encapsulation và làm code phụ thuộc vào “bên trong” của đối tượng khác.'; run = p.runs[0]; run.font.size=Pt(16); run.font.color.rgb = DARK
add_footer(slide, 6)

# Slide 7 - Common Coupling
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Common Coupling', subtitle='Đặc biệt nguy hiểm khi dùng global state / static public', color=DARK)
# visual of global static
global_box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.3), Inches(1.9), Inches(2.7), Inches(1.6)); global_box.fill.solid(); global_box.fill.fore_color.rgb = ORANGE; global_box.line.color.rgb = ORANGE
p = global_box.text_frame.paragraphs[0]; p.text='public static\nConfig'; run=p.runs[0]; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb = WHITE
arr = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(4.0), Inches(2.6), Inches(0.9), Inches(0.1)); arr.fill.solid(); arr.fill.fore_color.rgb = ORANGE; arr.line.color.rgb = ORANGE
box1 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.1), Inches(1.7), Inches(2.2), Inches(1.4)); box1.fill.solid(); box1.fill.fore_color.rgb = RGBColor(254, 243, 199); box1.line.color.rgb = GOLD
box1.text_frame.text = 'OrderService'
box2 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.1), Inches(3.5), Inches(2.2), Inches(1.4)); box2.fill.solid(); box2.fill.fore_color.rgb = RGBColor(254, 243, 199); box2.line.color.rgb = GOLD
box2.text_frame.text = 'BillingService'
box3 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.5), Inches(2.5), Inches(3.5), Inches(1.7)); box3.fill.solid(); box3.fill.fore_color.rgb = RGBColor(219, 234, 254); box3.line.color.rgb = BLUE
box3.text_frame.text = 'Rất khó debug\ntrong đa luồng'
# notes
note = slide.shapes.add_textbox(Inches(0.8), Inches(5.8), Inches(11.5), Inches(0.8)); p = note.text_frame.paragraphs[0]; p.text = 'Một thay đổi trong trạng thái toàn cục có thể ảnh hưởng đồng thời mọi module, đặc biệt khi chạy song song.'; run = p.runs[0]; run.font.size=Pt(16); run.font.color.rgb=DARK
add_footer(slide, 7)

# Slide 8 - Control coupling + data coupling
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Control Coupling & Data Coupling', subtitle='Khi hệ thống phụ thuộc vào “mã điều khiển” hoặc chuyển quá nhiều dữ liệu', color=DARK)
# left
bad = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.5), Inches(3.3)); bad.fill.solid(); bad.fill.fore_color.rgb = RGBColor(254, 215, 170); bad.line.color.rgb = ORANGE
bad_t = bad.text_frame.paragraphs[0]; bad_t.text='Control Coupling'; run=bad_t.runs[0]; run.font.bold=True; run.font.size=Pt(18); run.font.color.rgb=ORANGE
p = bad.text_frame.add_paragraph(); p.text = 'process(order, true)\nprocess(order, false)\nFlag argument làm thay đổi luồng xử lý.'; run=p.runs[0]; run.font.name='Consolas'; run.font.size=Pt(17); run.font.color.rgb = DARK
right = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.0), Inches(1.8), Inches(5.4), Inches(3.3)); right.fill.solid(); right.fill.fore_color.rgb = RGBColor(224, 231, 255); right.line.color.rgb = BLUE
rt = right.text_frame.paragraphs[0]; rt.text='Stamp Coupling'; run=rt.runs[0]; run.font.bold=True; run.font.size=Pt(18); run.font.color.rgb=BLUE
p2 = right.text_frame.add_paragraph(); p2.text='createInvoice(user, profile, orders, history, locale, token, ...);\nChỉ dùng 1 field nhưng phải pass cả object lớn.'; run=p2.runs[0]; run.font.name='Consolas'; run.font.size=Pt(15); run.font.color.rgb = DARK
note = slide.shapes.add_textbox(Inches(1.0), Inches(5.7), Inches(11.0), Inches(0.8)); p = note.text_frame.paragraphs[0]; p.text = 'Đặt câu hỏi: liệu interface đang yêu cầu quá nhiều, hay logic đang ẩn trong chuỗi tham số?'; run = p.runs[0]; run.font.size=Pt(17); run.font.color.rgb=DARK
add_footer(slide, 8)

# Slide 9 - Message coupling
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Message Coupling', subtitle='Đỉnh cao của Loose Coupling', color=DARK)
# diagram client-service
client = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(2.0), Inches(2.4), Inches(1.5)); client.fill.solid(); client.fill.fore_color.rgb=BLUE; client.line.color.rgb=BLUE
client.text_frame.text='OrderService'
provider = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9.8), Inches(2.0), Inches(2.4), Inches(1.5)); provider.fill.solid(); provider.fill.fore_color.rgb=GREEN; provider.line.color.rgb=GREEN
provider.text_frame.text='PaymentPort'
arr = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(3.5), Inches(2.7), Inches(6.2), Inches(0.1)); arr.fill.solid(); arr.fill.fore_color.rgb = GREEN; arr.line.color.rgb = GREEN
msg = slide.shapes.add_textbox(Inches(4.0), Inches(3.3), Inches(5.1), Inches(0.9)); p=msg.text_frame.paragraphs[0]; p.text='order.pay(PaymentRequest)'; run=p.runs[0]; run.font.name='Consolas'; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb = DARK
# compare box
compare = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(4.8), Inches(11.2), Inches(1.4)); compare.fill.solid(); compare.fill.fore_color.rgb = RGBColor(240,253,244); compare.line.color.rgb = GREEN
p = compare.text_frame.paragraphs[0]; p.text='Thay vì: PaymentGatewayImpl concrete, hãy giao tiếp qua Interface / Port / Message contract.'; run = p.runs[0]; run.font.size=Pt(18); run.font.color.rgb = DARK
add_footer(slide, 9)

# Slide 10 - Cohesion overview
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Cohesion: mức độ tập trung trong một module', subtitle='Từ ngẫu nhiên đến chức năng đơn nhiệm', color=DARK)
# gauge/levels blocks
levels = [
    ('Coincidental', 'Không liên quan, gom vào chung', RED),
    ('Logical', 'Cùng loại ý tưởng, nhưng chưa cùng mục đích', ORANGE),
    ('Temporal', 'Cùng thời điểm chạy', GOLD),
    ('Procedural', 'Cùng chuỗi xử lý', PURPLE),
    ('Functional', 'Một nhiệm vụ duy nhất', GREEN),
]
for idx, (title, text, color) in enumerate(levels):
    left = Inches(0.7 + idx*2.38)
    top = Inches(2.0)
    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(2.15), Inches(3.2))
    box.fill.solid(); box.fill.fore_color.rgb = RGBColor(255,255,255)
    box.line.color.rgb = color
    tf = box.text_frame
    tf.margin_left = Inches(0.14); tf.margin_right = Inches(0.14)
    p = tf.paragraphs[0]; p.text = title; run = p.runs[0]; run.font.bold=True; run.font.size=Pt(15); run.font.color.rgb=color
    p2 = tf.add_paragraph(); p2.text = text; run2 = p2.runs[0]; run2.font.size=Pt(11); run2.font.color.rgb = DARK
    if title == 'Functional':
        p3 = tf.add_paragraph(); p3.text = 'Mức lý tưởng'; run3=p3.runs[0]; run3.font.size=Pt(11); run3.font.bold=True; run3.font.color.rgb = GREEN
note = slide.shapes.add_textbox(Inches(0.8), Inches(5.9), Inches(11.7), Inches(0.6)); p = note.text_frame.paragraphs[0]; p.text = 'Cohesion tốt có nghĩa là module chỉ làm một việc và làm thật tốt việc đó.'; run = p.runs[0]; run.font.size=Pt(18); run.font.color.rgb = DARK
add_footer(slide, 10)

# Slide 11 - low cohesion
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Low Cohesion: các kiểu tệ', subtitle='Tập hợp các công việc khác nhau trong một class/module', color=DARK)
# common utils example
left = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.8), Inches(5.3), Inches(3.7)); left.fill.solid(); left.fill.fore_color.rgb = RGBColor(254, 242, 242); left.line.color.rgb = RED
l_t = left.text_frame.paragraphs[0]; l_t.text='CommonUtils'; run=l_t.runs[0]; run.font.size=Pt(20); run.font.bold=True; run.font.color.rgb = RED
for idx, item in enumerate(['readFile', 'sendEmail', 'parseJson', 'saveToDb', 'generatePdf', 'convertImage']):
    p = left.text_frame.add_paragraph(); p.text = item; p.bullet = True; run = p.runs[0]; run.font.size=Pt(13); run.font.color.rgb = DARK
right = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.0), Inches(1.8), Inches(5.4), Inches(3.7)); right.fill.solid(); right.fill.fore_color.rgb = RGBColor(240, 253, 244); right.line.color.rgb = GREEN
r_t = right.text_frame.paragraphs[0]; r_t.text='Điểm xấu'; run=r_t.runs[0]; run.font.size=Pt(20); run.font.bold=True; run.font.color.rgb = GREEN
for idx, item in enumerate(['Tăng độ khó hiểu', 'Khó refactor', 'Khó test', 'Thay đổi khúc xạ', 'Rủi ro sai sót cao']):
    p = right.text_frame.add_paragraph(); p.text = '• ' + item; run = p.runs[0]; run.font.size=Pt(14); run.font.color.rgb = DARK
add_footer(slide, 11)

# Slide 12 - functional cohesion + SRP
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Functional Cohesion & SRP', subtitle='Một class nên có “một lý do để thay đổi”', color=DARK)
# left: bad
bad = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(4.8), Inches(3.7)); bad.fill.solid(); bad.fill.fore_color.rgb = RGBColor(254, 226, 226); bad.line.color.rgb = RED
p = bad.text_frame.paragraphs[0]; p.text = 'Bad: OrderService'; run=p.runs[0]; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb=RED
for item in ['validateOrder', 'sendSms', 'saveInvoice', 'calculateTax', 'sendEmail']:
    p = bad.text_frame.add_paragraph(); p.text = item; p.bullet = True; run = p.runs[0]; run.font.size=Pt(12); run.font.color.rgb = DARK
# right: good
good = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.2), Inches(1.8), Inches(5.3), Inches(3.7)); good.fill.solid(); good.fill.fore_color.rgb = RGBColor(220,252,231); good.line.color.rgb = GREEN
p = good.text_frame.paragraphs[0]; p.text = 'Good: một module = một trách nhiệm'; run=p.runs[0]; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb=GREEN
for item in ['OrderValidator', 'InvoiceRepository', 'PaymentGateway', 'NotificationService']:
    p = good.text_frame.add_paragraph(); p.text = item; p.bullet = True; run = p.runs[0]; run.font.size=Pt(13); run.font.color.rgb = DARK
add_footer(slide, 12)

# Slide 13 - DIP & ISP
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'DIP & ISP: giảm Coupling bằng trừu tượng', subtitle='Phụ thuộc vào abstraction, không phụ thuộc vào concrete', color=DARK)
# boxes
high = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(1.8), Inches(2.6), Inches(1.4)); high.fill.solid(); high.fill.fore_color.rgb = RED; high.line.color.rgb = RED; high.text_frame.text='Concrete\nEmailService'
mid = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.5), Inches(1.8), Inches(2.4), Inches(1.4)); mid.fill.solid(); mid.fill.fore_color.rgb = BLUE; mid.line.color.rgb = BLUE; mid.text_frame.text='Notification\nInterface'
low = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9.4), Inches(1.8), Inches(2.7), Inches(1.4)); low.fill.solid(); low.fill.fore_color.rgb = GREEN; low.line.color.rgb = GREEN; low.text_frame.text='SMS/Email\nImplementations'
for x1, x2 in [(3.7, 5.3), (7.9, 9.2)]:
    arr = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x1), Inches(2.5), Inches(x2-x1), Inches(0.1)); arr.fill.solid(); arr.fill.fore_color.rgb = BLUE; arr.line.color.rgb = BLUE
# note
box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(4.0), Inches(11.1), Inches(1.8)); box.fill.solid(); box.fill.fore_color.rgb = RGBColor(239,246,255); box.line.color.rgb = BLUE
p = box.text_frame.paragraphs[0]; p.text='Điều quan trọng: module cấp cao không biết “cách gửi mail” mà chỉ biết “gửi thông báo”.\nDIP giảm coupling bằng việc trao đổi contract chứ không phải implementation.'; run = p.runs[0]; run.font.size=Pt(18); run.font.color.rgb = DARK
add_footer(slide, 13)

# Slide 14 - testability
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Unit Test: hàn thử biểu cho thiết kế', subtitle='Thiết kế tốt làm cho test dễ viết, dễ đọc và dễ bảo trì', color=DARK)
# bad vs good table
bad = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.0), Inches(3.7)); bad.fill.solid(); bad.fill.fore_color.rgb = RGBColor(254, 226, 226); bad.line.color.rgb = RED
p = bad.text_frame.paragraphs[0]; p.text = 'Không thể test'; run=p.runs[0]; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb=RED
for item in ['Khởi tạo toàn bộ hệ thống', 'Dùng static global', 'Không mock được dependency', 'Cần biết quá nhiều context']:
    p = bad.text_frame.add_paragraph(); p.text='• ' + item; run = p.runs[0]; run.font.size=Pt(12); run.font.color.rgb = DARK

good = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.2), Inches(1.8), Inches(5.3), Inches(3.7)); good.fill.solid(); good.fill.fore_color.rgb = RGBColor(220,252,231); good.line.color.rgb = GREEN
p = good.text_frame.paragraphs[0]; p.text = 'Test tốt'; run=p.runs[0]; run.font.size=Pt(18); run.font.bold=True; run.font.color.rgb=GREEN
for item in ['Dễ stub dependency', 'Mỗi case độc lập', 'Thay đổi nhỏ => test ít lỗi', 'Feedback nhanh']:
    p = good.text_frame.add_paragraph(); p.text='• ' + item; run = p.runs[0]; run.font.size=Pt(12); run.font.color.rgb = DARK
footer_txt = slide.shapes.add_textbox(Inches(1.0), Inches(5.8), Inches(11.0), Inches(0.7)); p = footer_txt.text_frame.paragraphs[0]; p.text = 'Nếu code khó test -> thiết kế có thể đang quá chặt chẽ hoặc quá rời rạc.'; run = p.runs[0]; run.font.size=Pt(16); run.font.color.rgb = DARK
add_footer(slide, 14)

# Slide 15 - refactoring and metrics
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Refactoring và đo lường', subtitle='Từ cảm giác đến số liệu', color=DARK)
# metrics cards
cards = [("CBO", "Số lượng class phụ thuộc", BLUE), ("RFC", "Số method có thể gọi", CYAN), ("LCOM", "Mức độ phân tán trong class", ORANGE), ("SonarQube", "Code smell / nợ kỹ thuật", GREEN)]
for idx, (title, text, color) in enumerate(cards):
    left = Inches(0.8 + idx * 3.0)
    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(2.0), Inches(2.5), Inches(2.8)); box.fill.solid(); box.fill.fore_color.rgb = RGBColor(248,250,252); box.line.color.rgb = color
    tf = box.text_frame; tf.margin_left = Inches(0.15); tf.margin_right = Inches(0.15)
    p = tf.paragraphs[0]; p.text = title; run = p.runs[0]; run.font.bold=True; run.font.size=Pt(18); run.font.color.rgb=color
    p2 = tf.add_paragraph(); p2.text = text; run2 = p2.runs[0]; run2.font.size=Pt(11); run2.font.color.rgb = DARK
# note
typ = slide.shapes.add_textbox(Inches(0.9), Inches(5.8), Inches(11.4), Inches(0.7)); p=typ.text_frame.paragraphs[0]; p.text='Công cụ giúp thấy “điểm nóng” của thiết kế, nhưng nguyên tắc đầu tiên vẫn là tư duy phân tách trách nhiệm.'; run = p.runs[0]; run.font.size=Pt(16); run.font.color.rgb=DARK
add_footer(slide, 15)

# Slide 16 - action checklist
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, NAVY)
add_title(slide, 'Checklist thiết kế tốt', subtitle='Mỗi lần refactor, hãy hỏi 5 câu này', color=WHITE)
# list
items = [
    'Module này có quá nhiều lý do để thay đổi không?',
    'Có thể có class khác truy cập state private không?',
    'Có flag argument / static global nào ẩn trong code không?',
    'Mỗi method/class đang làm quá nhiều việc không?',
    'Tôi có thể test từng phần độc lập không?',
]
for idx, item in enumerate(items):
    box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.7 + idx*0.9), Inches(11.6), Inches(0.6)); box.fill.solid(); box.fill.fore_color.rgb = RGBColor(30,41,59); box.line.color.rgb = RGBColor(71,85,105)
    p = box.text_frame.paragraphs[0]; p.text = f'{idx+1}. {item}'; run = p.runs[0]; run.font.size=Pt(16); run.font.color.rgb = WHITE
add_footer(slide, 16)

# Slide 17 - design principles summary
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Các nguyên tắc cần nhớ', subtitle='Đơn giản và với mục tiêu bảo trì lâu dài', color=DARK)
# 4 big principle cards
principles = [
    ('SRP', 'Một class, một lý do thay đổi', BLUE),
    ('DIP', 'Phụ thuộc vào abstraction', CYAN),
    ('ISP', 'Không ép client dùng API thừa', GREEN),
    ('High Cohesion', 'Một module làm đúng một việc', TEAL),
]
for idx, (title, text, color) in enumerate(principles):
    left = Inches(1.0 + idx * 2.9)
    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(2.0), Inches(2.35), Inches(2.7)); box.fill.solid(); box.fill.fore_color.rgb = RGBColor(239,246,255); box.line.color.rgb = color
    tf = box.text_frame; tf.margin_left = Inches(0.16); tf.margin_right = Inches(0.16)
    p = tf.paragraphs[0]; p.text = title; run=p.runs[0]; run.font.size=Pt(22); run.font.bold=True; run.font.color.rgb=color
    p2 = tf.add_paragraph(); p2.text = text; run2 = p2.runs[0]; run2.font.size=Pt(12); run2.font.color.rgb = DARK
# concluding sentence
note = slide.shapes.add_textbox(Inches(0.9), Inches(5.8), Inches(11.4), Inches(0.8)); p = note.text_frame.paragraphs[0]; p.text = 'Thiết kế tốt không phải “có nhiều lớp”, mà là “các lớp hợp lý và phụ thuộc đúng mức”.'; run=p.runs[0]; run.font.size=Pt(18); run.font.color.rgb = DARK
add_footer(slide, 17)

# Slide 18 - final summary
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, LIGHT)
add_title(slide, 'Kết luận', subtitle='Mục tiêu cuối cùng là hệ thống dễ thay đổi, dễ test và dễ mở rộng', color=DARK)
# summary rows
summary = [
    ('Low Coupling', 'Giảm ràng buộc giữa module, giảm ripple effect', BLUE),
    ('High Cohesion', 'Một module làm một việc, làm đúng việc đó', GREEN),
    ('Clear Contracts', 'Interface và message rõ ràng', CYAN),
    ('Good Tests', 'Mỗi thay đổi đều có phản hồi', ORANGE),
    ('Clean Architecture', 'Dễ bảo trì trong dài hạn', PURPLE),
]
for idx, (title, text, color) in enumerate(summary):
    top = Inches(1.8 + (idx // 2)*1.2)
    left = Inches(0.9 + (idx % 2)*5.9)
    box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, Inches(5.2), Inches(0.9)); box.fill.solid(); box.fill.fore_color.rgb = color; box.line.fill.background()
    p = box.text_frame.paragraphs[0]; p.text = f'{title}: {text}'; run = p.runs[0]; run.font.size=Pt(14); run.font.bold=True; run.font.color.rgb = WHITE
# big quote
quote = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(2.3), Inches(5.5), Inches(8.8), Inches(1.0)); quote.fill.solid(); quote.fill.fore_color.rgb = WHITE; quote.line.color.rgb = LIGHT2
p = quote.text_frame.paragraphs[0]; p.text='“Nền tảng của thiết kế tốt là giảm phụ thuộc và tăng tập trung trách nhiệm.”'; run=p.runs[0]; run.font.size=Pt(20); run.font.bold=True; run.font.color.rgb = DARK
add_footer(slide, 18)

# Slide 19 - Q&A
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, NAVY)
add_title(slide, 'Câu hỏi & thảo luận', subtitle='Hãy đặt câu hỏi về design smell, refactor và trade-off thực tế', color=WHITE)
# big circle and text
circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(5.0), Inches(2.0), Inches(3.2), Inches(3.2)); circle.fill.solid(); circle.fill.fore_color.rgb = BLUE; circle.line.fill.background()
q = circle.text_frame.paragraphs[0]; q.text = '?'; run=q.runs[0]; run.font.size=Pt(64); run.font.bold=True; run.font.color.rgb=WHITE
for idx, txt in enumerate(['Mức coupling hiện tại?','Module nào đang quá dính?', 'Class nào thiếu cohesion?', 'Refactor theo hướng nào?']):
    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9 + (idx % 2)*5.5), Inches(1.8 + (idx // 2)*1.5), Inches(4.0), Inches(1.0)); box.fill.solid(); box.fill.fore_color.rgb = RGBColor(30,41,59); box.line.color.rgb = RGBColor(71,85,105)
    p = box.text_frame.paragraphs[0]; p.text = txt; run = p.runs[0]; run.font.size=Pt(12); run.font.color.rgb = WHITE
add_footer(slide, 19)

# Slide 20 - closing
slide = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(slide, WHITE)
add_title(slide, 'Cảm ơn!', subtitle='Hẹn gặp lại trong buổi thực hành refactor Java tiếp theo', color=DARK)
# CTA banner
banner = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.1), Inches(2.3), Inches(10.9), Inches(2.0)); banner.fill.solid(); banner.fill.fore_color.rgb = RGBColor(239,246,255); banner.line.color.rgb = BLUE
p = banner.text_frame.paragraphs[0]; p.text='“Thiết kế tốt là khi bạn không sợ thay đổi.”'; run = p.runs[0]; run.font.size=Pt(24); run.font.bold=True; run.font.color.rgb = BLUE
bottom = slide.shapes.add_textbox(Inches(1.6), Inches(5.2), Inches(9.8), Inches(0.7)); p = bottom.text_frame.paragraphs[0]; p.text='— Coupling & Cohesion: từ lý thuyết đến Java thực tế'; run = p.runs[0]; run.font.size=Pt(18); run.font.color.rgb = DARK
add_footer(slide, 20)

prs.save(OUT)
print(f"Saved: {OUT}")
