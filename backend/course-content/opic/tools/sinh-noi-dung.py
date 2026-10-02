# -*- coding: utf-8 -*-
"""BUOC 2 — sinh content/scripts/*.md (dinh dang thong nhat) tu tools/parsed.json + sieu du lieu viet tay
(chu de, dang cau hoi, cau hoi EN cho bo A, cau hoi VI cho bo B, bang sua loi chinh ta bo B).

    python tools/sinh-noi-dung.py

Cong cu MOT LAN. Sau khi chay, content/scripts/ la NGUON SU THAT — sua o do, dung chay lai
(se ghi de). Giu lai de biet moi quyet dinh ve du lieu nam o dau.
"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
DICH = os.path.join(os.path.dirname(HERE), "content", "scripts")
D = json.load(open(os.path.join(HERE, "parsed.json"), encoding="utf-8"))

ABBR = ("Dr", "Mr", "Mrs", "Ms", "St", "vs", "e.g", "i.e")
def split_sentences(text):
    text = re.sub(r"\s+", " ", text).strip()
    for a in ABBR:
        text = text.replace(a + ". ", a + ".\u0001")
    parts = re.split(r"(?<=[^.][.!?])\s+(?=[A-Z\"“‘'(])", text)
    return [p.replace("\u0001", " ").strip() for p in parts if p.strip()]

# ---------------------------------------------------------------- chu de
CHU_DE = [
 ("gioi-thieu",           "Giới thiệu bản thân",                       "🙋", 2, "Câu 1 của mọi đề: tên, tuổi, công việc, tính cách, sở thích. Không chấm điểm nhưng quyết định phiếu điểm giám khảo dùng cho bạn — phải chuẩn bị kỹ nhất."),
 ("nha-cua",              "Nhà cửa & việc nhà",                        "🏠", 2, "Tả nhà, phòng yêu thích, so sánh nhà xưa – nay, mua sắm nội thất, sự cố trong nhà, việc nhà. Hay gặp ở câu 2–4 nếu chọn “sống một mình trong căn hộ”."),
 ("am-nhac",              "Âm nhạc",                                   "🎵", 1, "Thể loại yêu thích, ca sĩ, thói quen nghe, sở thích thay đổi xưa – nay, kỷ niệm với âm nhạc. Một trong 6 mục bắt buộc chọn ở survey."),
 ("phim-anh",             "Phim ảnh",                                  "🎬", 1, "Phim và thể loại yêu thích, diễn viên, đi xem phim với bạn làm gì, phim đáng nhớ. Một trong 6 mục bắt buộc chọn ở survey; cũng hay ra ở nhóm diễn (gọi rạp, mua vé)."),
 ("cong-vien",            "Công viên",                                 "🌳", 1, "Tả công viên gần nhà, một lần đi điển hình, lần gần nhất, kỷ niệm đáng nhớ, so sánh công viên xưa – nay. Mục bắt buộc ở survey."),
 ("chay-bo-di-bo",        "Chạy bộ & đi bộ",                           "🏃", 1, "Thói quen chạy bộ / đi bộ, trước – sau khi tập làm gì, so sánh với môn khác, kỷ niệm. Hai mục bắt buộc ở survey, và hay rơi vào câu 14–15 (so sánh, cảm nghĩ)."),
 ("du-lich",              "Du lịch trong nước & nước ngoài",           "✈️", 1, "Điểm đến yêu thích, chuẩn bị gì, chuyến đi hồi nhỏ, chuyến đi khó quên, nước ngoài, món ăn khi đi du lịch. Mục bắt buộc ở survey."),
 ("ky-nghi-ngay-le",      "Kỳ nghỉ, ngày lễ & thời gian rảnh",         "🏖️", 2, "Ngày nghỉ làm gì, kỳ nghỉ ở nhà, ngày lễ, tụ họp ăn mừng, thời gian rảnh xưa – nay."),
 ("thoi-tiet-moi-truong", "Thời tiết & môi trường",                    "🌦️", 1, "Thời tiết từng mùa, hôm nay, so với xưa và với nước khác, thời tiết khắc nghiệt, tái chế. Thuộc mục “Môi trường” — nên chọn ở 3 mục cuối của survey."),
 ("giao-thong",           "Giao thông",                                "🛵", 1, "Phương tiện phổ biến, bạn đi lại bằng gì, giao thông xưa – nay, sự cố khi đi đường. Thuộc mục “Văn hoá xã hội”."),
 ("cong-nghe",            "Internet, điện thoại & tin nhắn",           "📱", 1, "Mọi người làm gì trên internet, điện thoại của bạn, điện thoại xưa – nay, sự cố, tin nhắn, mạng xã hội, gọi điện cho bạn bè. Thuộc mục “Giao tiếp / phương tiện liên lạc”."),
 ("suc-khoe-am-thuc",     "Sức khoẻ, ăn uống & nhà hàng",              "🥗", 1, "Ăn uống lành mạnh, món ăn phổ biến, người khoẻ mạnh bạn biết, thay đổi thói quen vì sức khoẻ, nhà hàng. Thuộc mục “Văn hoá xã hội”."),
 ("thoi-trang-mua-sam",   "Thời trang & mua sắm",                      "👕", 1, "Cửa hàng ở nước bạn, bạn mua sắm ở đâu, ký ức mua sắm hồi nhỏ, người Việt mặc gì, phong cách của bạn, thời trang xưa – nay. Thuộc mục “Văn hoá xã hội”."),
 ("dich-vu",              "Ngân hàng, bệnh viện, cắt tóc & giấy tờ",   "🏦", 2, "Ngân hàng, bệnh viện và bác sĩ, tiệm cắt tóc, giấy tờ tuỳ thân, cảnh sát. Thuộc các mục “Nơi làm việc toàn cầu” và “Nhân quyền” — ít gặp hơn nếu bạn không chọn, nhưng đề mẫu đã từng ra bệnh viện và chứng minh thư."),
 ("gia-dinh-ban-be",      "Gia đình & bạn bè",                         "👥", 2, "Tả người thân / bạn bè, so sánh tính cách, thường làm gì cùng nhau, kỷ niệm đến thăm, mâu thuẫn trong gia đình."),
 ("cong-viec-hoc-tap",    "Công việc & giáo dục",                      "💼", 3, "Công ty, ngày làm việc, dự án, hệ thống giáo dục, học tiếng Anh. Nếu chọn survey đúng (không đi làm, không là sinh viên) thì gần như không gặp — học sau cùng."),
 ("dien",                 "Diễn (role-play) & giải quyết tình huống",  "🎭", 2, "Câu 11–13 của mọi đề: gọi điện hỏi thông tin, đề nghị, khiếu nại, đưa ra 2 giải pháp. Chỉ mình bạn nói; tưởng tượng đầu dây bên kia và nhắc lại ý của họ."),
]
CD_ID = [c[0] for c in CHU_DE]

def chu_de_A(so, rp):
    if rp: return "dien"
    for lo, hi, cd in [(1,1,"gioi-thieu"),(2,7,"gia-dinh-ban-be"),(8,16,"nha-cua"),(17,21,"am-nhac"),(22,26,"phim-anh"),
                       (27,33,"du-lich"),(34,35,"cong-vien"),(36,39,"giao-thong"),(40,43,"thoi-tiet-moi-truong"),(44,54,"cong-nghe"),
                       (55,56,"ky-nghi-ngay-le"),(57,57,"chay-bo-di-bo"),(58,59,"cong-nghe"),(60,65,"dich-vu"),(66,66,"nha-cua")]:
        if lo <= so <= hi: return cd
    raise KeyError(so)

def chu_de_B(so):
    for lo, hi, cd in [(1,3,"am-nhac"),(4,6,"phim-anh"),(7,10,"cong-vien"),(12,18,"du-lich"),(22,24,"ky-nghi-ngay-le"),(25,27,"cong-viec-hoc-tap"),
                       (28,31,"gia-dinh-ban-be"),(32,37,"nha-cua"),(38,43,"cong-nghe"),(44,47,"thoi-tiet-moi-truong"),(48,51,"cong-nghe"),
                       (52,57,"thoi-trang-mua-sam"),(58,58,"nha-cua"),(59,60,"thoi-tiet-moi-truong"),(64,73,"suc-khoe-am-thuc"),(75,77,"ky-nghi-ngay-le"),
                       (83,85,"giao-thong"),(86,89,"dich-vu"),(93,97,"ky-nghi-ngay-le"),(98,99,"nha-cua"),(100,101,"dien"),(102,103,"chay-bo-di-bo"),
                       (104,105,"du-lich"),(106,111,"dich-vu"),(112,114,"cong-viec-hoc-tap"),(115,115,"gioi-thieu")]:
        if lo <= so <= hi: return cd
    raise KeyError(so)

# ---------------------------------------------------------------- dang cau hoi
DANG_A = {1:"gioi-thieu",2:"so-sanh",3:"thoi-quen",4:"thoi-quen",5:"so-sanh",6:"kinh-nghiem",7:"kinh-nghiem",8:"mieu-ta",9:"mieu-ta",10:"so-sanh",
 11:"mieu-ta",12:"y-kien",13:"y-kien",14:"mieu-ta",15:"kinh-nghiem",16:"kinh-nghiem",17:"mieu-ta",18:"so-sanh",19:"so-sanh",20:"kinh-nghiem",
 21:"kinh-nghiem",22:"mieu-ta",23:"mieu-ta",24:"thoi-quen",25:"thoi-quen",26:"mieu-ta",27:"kinh-nghiem",28:"mieu-ta",29:"mieu-ta",30:"y-kien",
 31:"kinh-nghiem",32:"thoi-quen",33:"y-kien",34:"kinh-nghiem",35:"so-sanh",36:"mieu-ta",37:"so-sanh",38:"kinh-nghiem",39:"kinh-nghiem",40:"so-sanh",
 41:"so-sanh",42:"kinh-nghiem",43:"y-kien",44:"mieu-ta",45:"mieu-ta",46:"mieu-ta",47:"y-kien",48:"y-kien",49:"so-sanh",50:"kinh-nghiem",
 51:"kinh-nghiem",52:"so-sanh",53:"so-sanh",54:"y-kien",55:"thoi-quen",56:"kinh-nghiem",57:"thoi-quen",58:"thoi-quen",59:"kinh-nghiem",60:"mieu-ta",
 61:"kinh-nghiem",62:"kinh-nghiem",63:"kinh-nghiem",64:"kinh-nghiem",65:"mieu-ta",66:"kinh-nghiem"}
DANG_AR = {1:"dien",2:"dien",3:"tinh-huong",4:"tinh-huong",5:"dien",6:"dien",7:"dien",8:"tinh-huong",9:"tinh-huong",10:"tinh-huong",
 11:"tinh-huong",12:"tinh-huong",13:"tinh-huong",14:"tinh-huong",15:"tinh-huong",16:"kinh-nghiem"}
DANG_B = {1:"mieu-ta",2:"thoi-quen",3:"so-sanh","3b":"kinh-nghiem",4:"mieu-ta","4b":"mieu-ta",5:"kinh-nghiem",6:"kinh-nghiem",7:"mieu-ta",8:"thoi-quen",
 9:"kinh-nghiem","9b":"kinh-nghiem",10:"so-sanh",12:"mieu-ta",13:"thoi-quen",14:"kinh-nghiem",15:"kinh-nghiem",16:"mieu-ta",17:"thoi-quen",18:"kinh-nghiem",
 22:"thoi-quen",23:"kinh-nghiem",24:"kinh-nghiem",25:"mieu-ta",26:"thoi-quen",27:"kinh-nghiem",28:"mieu-ta",29:"thoi-quen",30:"kinh-nghiem",31:"kinh-nghiem",
 32:"mieu-ta",33:"thoi-quen",34:"mieu-ta",35:"so-sanh",36:"kinh-nghiem",37:"kinh-nghiem",38:"y-kien",39:"thoi-quen",40:"so-sanh",41:"y-kien",42:"so-sanh",
 43:"kinh-nghiem",44:"mieu-ta",45:"mieu-ta","45b":"mieu-ta",46:"so-sanh",47:"kinh-nghiem",48:"thoi-quen",49:"thoi-quen",50:"kinh-nghiem",51:"kinh-nghiem",
 52:"mieu-ta",53:"thoi-quen",54:"kinh-nghiem",55:"mieu-ta",56:"mieu-ta",57:"so-sanh",58:"mieu-ta",59:"thoi-quen",60:"so-sanh",64:"y-kien",65:"kinh-nghiem",
 66:"mieu-ta",67:"mieu-ta",68:"kinh-nghiem",69:"kinh-nghiem",70:"mieu-ta",71:"kinh-nghiem",72:"kinh-nghiem",73:"y-kien",75:"mieu-ta",76:"kinh-nghiem",
 77:"kinh-nghiem",83:"mieu-ta",84:"thoi-quen",85:"so-sanh",86:"mieu-ta",87:"thoi-quen",88:"so-sanh",89:"kinh-nghiem",93:"y-kien",94:"so-sanh",95:"kinh-nghiem",
 96:"mieu-ta",97:"kinh-nghiem",98:"thoi-quen",99:"kinh-nghiem",100:"dien",101:"dien",102:"so-sanh",103:"kinh-nghiem",104:"kinh-nghiem",105:"kinh-nghiem",
 106:"mieu-ta",107:"kinh-nghiem",108:"kinh-nghiem",109:"mieu-ta",110:"mieu-ta",111:"kinh-nghiem",112:"mieu-ta",113:"kinh-nghiem",114:"y-kien",115:"gioi-thieu"}

# ---------------------------------------------------------------- cau hoi tieng Anh cho bo A
EN_A = {
1:"Let's start the interview now. Tell me a little bit about yourself.",
2:"Tell me about two people in your family or among your friends. How are they similar, and how are they different?",
3:"What do you usually talk about when you get together with your friends?",
4:"What do you talk about when you meet your family or friends? How has living together with other people influenced you?",
5:"Compare the personalities of two people in your family or among your friends. What do they have in common, and how are they different?",
6:"Tell me about a difficult time or a disagreement in your family. What happened, and how was it resolved?",
7:"Tell me about a disagreement you had with your parents. What was it about, and how did it end?",
8:"I would like to know where you live. Can you describe your home to me in detail? What does it look like?",
9:"Which room in your home do you like the most? Describe it to me. Why do you like that room?",
10:"Compare the home you live in now with the home you lived in in the past. How are they different?",
11:"Describe your home and your favorite room. Have you changed any furniture or items in your home recently?",
12:"If you needed to buy new furniture, where would you go, and how would you look for it?",
13:"If you could redesign your room, what would you change, and why?",
14:"Tell me about the outside of your home. How is it decorated?",
15:"Tell me about a problem you have had at the place where you live. What was it, and how did you solve it?",
16:"Tell me about a problem at your home that your family discussed together. How did you solve it?",
17:"You indicated in the survey that you listen to music. What kind of music do you like? Who are your favorite singers or composers?",
18:"What kind of music do you like? Has your taste in music changed compared to the past?",
19:"What music did you listen to as a child, and what do you listen to now? Who is your favorite artist, and what is your favorite song?",
20:"When did you first listen to music? Who were you with, and where? How do you usually listen to music?",
21:"How did you first become interested in music? How has your taste in music changed over time?",
22:"What is your favorite movie? Tell me about it, and why you like it.",
23:"What kind of movies do you like? What movies have you watched recently?",
24:"What do you usually do when you go to the movies with your friends? Tell me everything from beginning to end.",
25:"What do you usually do before and after watching a movie at the theater?",
26:"Who is your favorite actor? Why do you like him?",
27:"Tell me about a trip you took in your country. Where did you go, and what did you do there?",
28:"Describe a place you have traveled to. Where is it, what did you do there, and who did you go with?",
29:"Tell me about a country you have visited on vacation. What was it like?",
30:"Why do you think people like to travel? Which reason do you think is the most important?",
31:"Tell me about a memorable trip you have taken. What happened that made it so memorable?",
32:"What do you do to prepare for a trip? Tell me about everything you need to get ready.",
33:"Describe a place you would like to visit. Also, give some travel advice to Jiwon, who is planning to visit your country.",
34:"Tell me about a park you often go to. Also, tell me about a memorable experience you had at a park.",
35:"Who did you go to the park with as a child, and what did you do there? Compare that park with the park you go to now. What do you think about preserving parks?",
36:"What kinds of transportation do people use the most in your country?",
37:"How has transportation in your country changed compared to the past?",
38:"Tell me about a problem you have had with transportation. How did you deal with it?",
39:"Tell me about an unpleasant memory related to transportation. What happened?",
40:"What is the weather like in your city? How is it different from other cities, and from the past?",
41:"Tell me about the weather in your country. How is it different from the weather in other countries?",
42:"Tell me about a memorable event caused by the weather. How did you deal with it?",
43:"Has the weather changed in recent years? What do you think are the causes and effects of these changes?",
44:"Tell me about the computer you use. What does it look like, and what do you use it for?",
45:"Describe your computer in detail: the screen, the sound, and the things you like about it.",
46:"Tell me about your mobile phone. What does it look like, and what do you use it for?",
47:"Why would you like to buy a new phone? What features are you looking for?",
48:"What is the object that people in your country use the most in their daily lives? Why?",
49:"Compare the phone you used in the past with the phone you use now. How are they different?",
50:"Tell me about a memorable experience you had with your phone.",
51:"Tell me about a problem you had with your phone. What was it, and how did you solve it?",
52:"How has the internet changed compared to the past? Also, tell me about a memorable experience you had on Facebook.",
53:"Compare how people use the internet now with how they used it in the past.",
54:"Tell me about social networking services. Which ones do you use? What are the negative sides of SNS?",
55:"What do you usually do on your days off?",
56:"Tell me about a special day off that you remember. What happened?",
57:"You indicated in the survey that you jog. Who do you jog with? What do you do before and after jogging? Why do you like jogging?",
58:"Tell me about the phone calls you make to your friends. What do you talk about, when do you call, and how often?",
59:"Tell me about a time when you could not answer a phone call. What happened?",
60:"Tell me about a bank near your home. Which bank impressed you the most, and why?",
61:"Tell me about a time you went to the hospital. What was the problem? Who recommended the hospital or the doctor?",
62:"Why did you go to the hospital as a child? Tell me about a happy memory with a kind doctor.",
63:"Tell me about the first time you went to get a haircut. When was it, who were you with, and how did you feel?",
64:"Tell me about a bad experience you had at a hair salon. How did you handle it?",
65:"What kinds of identification documents do people have in your country? How do you get one?",
66:"Tell me about a time when an appliance in your home broke down. How did you deal with it?",
}
EN_AR = {
1:"I'd like to give you a situation and ask you to act it out. There is a problem with the trip you booked, so you need to change the schedule. Call the travel agency and ask to reschedule.",
2:"A foreigner on the street looks lost. Offer to help, and explain how to get to the place they are looking for.",
3:"You bought a pair of running shoes, but there is a problem with them. Go to the store, explain the situation, and ask for a solution.",
4:"You left something in a taxi. Call the taxi company, describe the item, and ask for help getting it back.",
5:"You are staying at a hotel for several days. Ask the receptionist three or four questions about things to do nearby.",
6:"Ask Ava three or four questions about where she lives.",
7:"You borrowed an MP3 player from a friend. Call your friend and ask three or four questions about how to use it.",
8:"I'm sorry, but there is a problem you need to resolve. You broke the MP3 player you borrowed from your friend. Call your friend, explain the situation, and suggest two or three solutions.",
9:"You bought a new phone, but it is not working properly. Go back to the store, explain the problem, and suggest two possible solutions.",
10:"You bought a shirt, but it is the wrong size. Call the store to resolve the problem, and ask the owner for advice on what else to buy.",
11:"A window in your apartment is broken. Call the building manager to report it. Then call again, because the repairman has not arrived.",
12:"You received your new ID card, but some information on it is wrong. Go to the office, explain the problem, and ask for it to be fixed quickly.",
13:"You are at a hair salon. Tell the barber what kind of haircut you want. After the haircut, you are not satisfied, so ask for it to be adjusted.",
14:"The travel agency called to say there is a problem with your hotel booking. Call your parents, explain the situation, and discuss how to change the itinerary.",
15:"A shirt you bought was damaged after one wash. Call the store to complain, and ask for a refund or a replacement.",
16:"Have you ever visited the family of a friend from another country? Tell me about that experience in detail.",
}

# ---------------------------------------------------------------- cau hoi tieng Viet cho bo B
VI_B = {
1:"Bạn nghe loại nhạc gì? Ca sĩ / nhạc sĩ yêu thích là ai?",
2:"Bạn thường nghe nhạc khi nào, ở đâu? Có nghe radio, đi xem concert không?",
3:"Bạn bắt đầu thích nhạc từ khi nào? Sở thích thay đổi ra sao từ bé đến giờ?",
"3b":"Kể một kỷ niệm đáng nhớ liên quan đến âm nhạc.",
4:"Bạn thích xem loại phim gì? Vì sao?",
"4b":"Diễn viên yêu thích của bạn là ai? Vì sao thích?",
5:"Lần gần nhất đi xem phim: đi với ai, trước và sau khi xem làm gì?",
6:"Bộ phim đáng nhớ nhất bạn từng xem? Nội dung và điểm đặc biệt?",
7:"Công viên bạn hay đến trông thế nào?",
8:"Một lần đi công viên điển hình của bạn: làm gì, thấy gì?",
9:"Lần gần nhất đi công viên: ở đâu, khi nào, làm gì từ lúc đến tới lúc về?",
"9b":"Kể một lần đi công viên có chuyện bất ngờ (gặp mưa).",
10:"Vì sao bạn bắt đầu đi công viên? Bây giờ đi vì lý do gì?",
12:"Những nơi bạn thích đi du lịch trong nước và lý do?",
13:"Bạn chuẩn bị những gì trước mỗi chuyến đi?",
14:"Kể một trải nghiệm du lịch khó quên: khi nào, ở đâu, với ai, chuyện gì xảy ra?",
15:"Những chuyến đi hồi nhỏ: đi đâu, với ai, làm gì?",
16:"Mô tả một quốc gia bạn từng đến: cảnh vật và con người ra sao?",
17:"Khi đi nước ngoài bạn thường làm những gì?",
18:"Chuyến đi nước ngoài đầu tiên của bạn: khi nào, ở đâu, với ai, làm gì?",
22:"Nghỉ ở nhà, bạn muốn gặp ai và dành thời gian với ai?",
23:"Kỳ nghỉ ở nhà gần nhất: làm gì từ ngày đầu đến ngày cuối, gặp ai?",
24:"Kể một chuyện bất ngờ xảy ra trong kỳ nghỉ ở nhà.",
25:"Giới thiệu công ty bạn: loại hình, thành lập khi nào, ở đâu, sản phẩm gì?",
26:"Một ngày làm việc điển hình của bạn diễn ra thế nào?",
27:"Kể về một dự án bạn làm tuần trước: loại gì, phải làm gì, họp hành ra sao?",
28:"Mô tả một người thân hoặc bạn bè: người đó thế nào, có gì đặc biệt?",
29:"Bạn thường làm gì khi gặp gỡ bạn bè hoặc gia đình?",
30:"Kể lần gần đây đến thăm bạn bè / người thân: làm gì, điều gì đáng nhớ?",
31:"Kể lần gần đây đến thăm bạn (phiên bản: uống say ở nhà bạn).",
32:"Mô tả ngôi nhà bạn đang ở: trông thế nào, có mấy phòng?",
33:"Thói quen ở nhà: có làm việc nhà mỗi ngày không? Ngày thường và cuối tuần làm gì?",
34:"Các phòng trong nhà bạn và phòng yêu thích trông thế nào?",
35:"Ngôi nhà hồi nhỏ của bạn khác gì nhà hiện tại?",
36:"Kể một kỷ niệm đặc biệt ở nhà với gia đình (tiệc, khách đến chơi...).",
37:"Kể về một sự cố xảy ra ở nhà bạn (đồ hỏng, việc không như kế hoạch...).",
38:"Mọi người thường làm gì trên internet?",
39:"Bạn thường làm gì trên internet? Có mua sắm online, chia sẻ video không?",
40:"Trải nghiệm dùng internet thời kỳ đầu của bạn: bạn nhớ gì nhất?",
41:"Bạn thích nhất điều gì ở điện thoại của mình? Vì sao?",
42:"Chiếc điện thoại đầu tiên của bạn khác gì chiếc hiện tại?",
43:"Kể lần bạn gặp rắc rối với điện thoại: vấn đề gì, xử lý thế nào?",
44:"Thời tiết nơi bạn sống: từng mùa thế nào, bạn thích mùa nào?",
45:"Thời tiết hôm nay nơi bạn ở thế nào? (phiên bản: giữa thu mà vẫn nóng)",
"45b":"Thời tiết hôm nay nơi bạn ở thế nào? (phiên bản: đầu đông)",
46:"Thời tiết nước bạn thay đổi thế nào so với hồi bạn còn nhỏ?",
47:"Kể một trải nghiệm thời tiết khắc nghiệt (bão, lũ...) và cách mọi người ứng phó.",
48:"Bạn nhắn tin với bạn bè về những chuyện gì?",
49:"Bạn hay nhắn tin khi nào, ở đâu, với ai?",
50:"Kể một tin nhắn đáng nhớ bạn từng nhận: từ ai, về gì, vì sao đáng nhớ?",
51:"Kể lần bạn gặp rắc rối khi gửi tin nhắn và cách xử lý.",
52:"Các cửa hàng / trung tâm mua sắm ở nước bạn trông thế nào?",
53:"Bạn đi mua sắm ở đâu, khi nào, mua gì? Nơi đó có gì đặc biệt?",
54:"Ký ức mua sắm hồi nhỏ: cửa hàng nào, trông thế nào, ấn tượng gì?",
55:"Người nước bạn thường mặc gì? Đi làm và đi chơi có khác nhau không?",
56:"Bạn thích mặc kiểu gì? Hôm nay bạn mặc gì?",
57:"Thời trang hồi bạn còn nhỏ khác gì bây giờ?",
58:"Đồ nội thất trong nhà bạn có gì? Món nào bạn thích nhất?",
59:"Bạn tái chế những loại đồ gì?",
60:"Hồi nhỏ việc tái chế diễn ra thế nào? Bạn mang đồ tái chế đến đâu?",
64:"Những loại thực phẩm nào tốt cho sức khoẻ, và vì sao?",
65:"Bạn biết đến ăn uống lành mạnh thế nào? Hồi nhỏ gia đình bạn ăn uống ra sao?",
66:"Món ăn phổ biến ở nước bạn là gì? Có gì đặc biệt?",
67:"Mô tả một người khoẻ mạnh bạn biết. Điều gì khiến họ khoẻ?",
68:"Bạn từng thay đổi thói quen nào vì sức khoẻ chưa? Kể về sự thay đổi đó.",
69:"Kể chi tiết một việc bạn làm vì sức khoẻ và tác động của nó.",
70:"Nhà hàng ở nước bạn trông thế nào? Thường bán món gì?",
71:"Lần gần nhất đi ăn nhà hàng: loại gì, thực đơn, ăn gì, đi với ai?",
72:"Nhà hàng bạn hay đến hồi nhỏ: trông thế nào, ăn gì, nhớ gì nhất?",
73:"Người bận rộn thường ăn uống thế nào vào ngày thường?",
75:"Người nước bạn tụ họp, ăn mừng thế nào?",
76:"Lần tụ họp gần nhất của bạn: dịp gì, làm gì?",
77:"Kể một sự cố đáng nhớ trong một buổi tụ họp.",
83:"Người nước bạn đi lại bằng gì? Phương tiện phổ biến là gì?",
84:"Bạn đi lại bằng phương tiện gì? Tự lái hay đi phương tiện công cộng?",
85:"Hồi nhỏ bạn đi lại thế nào? Giao thông khi đó khác gì bây giờ?",
86:"Ngân hàng ở nước bạn trông thế nào, thường nằm ở đâu?",
87:"Bạn làm những gì từ lúc bước vào đến lúc rời ngân hàng?",
88:"Ngân hàng hồi bạn còn nhỏ khác gì ngân hàng bây giờ?",
89:"Kể một rắc rối bạn gặp ở ngân hàng và cách giải quyết.",
93:"Người nước bạn đi đâu khi rảnh? Biển, công viên hay nơi nào khác?",
94:"Thời gian rảnh của bạn ngày xưa nhiều hay ít hơn bây giờ? Khác thế nào?",
95:"Lần gần nhất bạn có thời gian rảnh: khi nào, làm gì, với ai?",
96:"Những ngày lễ phổ biến ở nước bạn: mọi người ăn mừng ở đâu, làm gì?",
97:"Một kỷ niệm ngày lễ hồi nhỏ: ở đâu, nhớ gì?",
98:"Bạn sống với ai? Việc nhà được chia thế nào?",
99:"Việc nhà đáng nhớ nhất bạn từng làm? Khi nào, vì sao đáng nhớ?",
100:"Diễn: Ava cũng có việc nhà phải làm — hỏi cô ấy 3–4 câu về trách nhiệm ở nhà.",
101:"Diễn: Tháng sau bạn đến một thành phố mới — gọi cho bạn ở đó, hỏi 3–4 câu để lên kế hoạch.",
102:"Chạy bộ khác yoga thế nào? Môn nào tốt hơn cho bạn?",
103:"Kể một kỷ niệm đáng nhớ khi chạy bộ: chuyện gì xảy ra, vì sao đáng nhớ?",
104:"Bạn từng về vùng quê chưa? Cảm giác thế nào, có chuyện gì thú vị?",
105:"Một món ăn đáng nhớ bạn thử khi đi du lịch: ở đâu, món gì?",
106:"Các loại giấy tờ tuỳ thân bạn đang có? Dùng mỗi loại khi nào?",
107:"Quy trình làm thẻ căn cước của bạn: làm gì trước, làm gì sau?",
108:"Thẻ căn cước đầu tiên của bạn: cảm giác khi nhận, thường dùng khi nào?",
109:"Cảnh sát ở nước bạn thường làm gì? Trách nhiệm của họ là gì?",
110:"Mô tả một cảnh sát điển hình ở nước bạn: trang phục, xe cảnh sát.",
111:"Kỷ niệm liên quan đến cảnh sát: được giúp đỡ, hoặc thấy trên phim...",
112:"Hệ thống giáo dục nước bạn: học bao nhiêu năm, có những cấp nào?",
113:"Giáo dục tiếng Anh ở nước bạn: bạn học tiếng Anh thế nào?",
114:"Giáo dục công lập nước bạn đã thay đổi thế nào? Cách cải thiện quan trọng nhất?",
115:"Giới thiệu bản thân.",
}

# ---------------------------------------------------------------- sua loi chinh ta / ngu phap ro rang (bo B)
SUA_B = [
("She is also remarkable beautiful,", "She is also remarkably beautiful,"),
("I don't remember exactly, but in my mind, I love music from when I was a kid.", "I don't remember exactly, but I think I have loved music since I was a kid."),
("At that time we were poor, I didn't have opportunity to listen many kind of music.", "At that time we were poor, so I didn't have the opportunity to listen to many kinds of music."),
("I just listened to traditional music on the old radio of my family and the song that my mom, my grandmother sang.", "I just listened to traditional music on my family's old radio and the songs that my mom and my grandmother sang."),
("Now, life become better, I can approach and listen to many kind of music.", "Now, life has become better, and I can access and listen to many kinds of music."),
("Some time I listen to pop music, but some time I listen to rock music, or country music, Some time I listen to EDM music when I do exercise.", "Sometimes I listen to pop music, sometimes rock or country music, and sometimes EDM when I exercise."),
("because it is the first time that I saw my idol in real life.", "because it was the first time I saw my idol in real life."),
("help me to reduce stress very effectively I also love nature", "help me to reduce stress very effectively. I also love nature"),
("he helps poor children have opportunity to go to school", "he helps poor children have the opportunity to go to school"),
("We celebrated a surprise birthday to her, we drove to the cinema to watch an action movie.", "We threw a surprise party for her, then we drove to the cinema to watch an action movie."),
("ordered dried chicken with some snacks.", "ordered fried chicken with some snacks."),
("Moreover, after the meal, We got one ice cream each.", "Moreover, after the meal, we each got an ice cream."),
("We were full after all.", "We were totally full after all that."),
("The film has participation of my favourite actor also.", "My favourite actor also stars in the film."),
("Even though the movie doesn't have a happy ending for the main characters. But it took me a lot of tear during movie.", "Even though the movie doesn't have a happy ending for the main characters, it brought me to tears many times."),
("I can feel the fresh air and spaceful when I am at there.", "I can feel the fresh air and the open space when I am there."),
("slides and bubble house", "slides and a bubble house."),
("fell asleep right away after had a nice day.", "fell asleep right away after having a nice day."),
("That is really great moments for me.", "Those are really great moments for me."),
("There're a of beautiful place in VietNam.", "There are a lot of beautiful places in Vietnam."),
("But there's one I think I like most, It is Ha Long Bay.", "But there's one I like the most: Ha Long Bay."),
("It is a Bay in the North of VietNam, I love there because I like walking along the shore, gazing at the sea and starry sky in the evening", "It is a bay in the north of Vietnam. I love it there because I like walking along the shore, gazing at the sea and the starry sky in the evening."),
("And, Nature scenery there is very beautiful, there're thousand small islands in HaLong bay with different shape.", "And the natural scenery there is very beautiful: there are thousands of small islands in Ha Long Bay with different shapes."),
("I stand on ship go around the island and look them beauty clearly.", "I stand on the ship, go around the islands and see their beauty clearly."),
("Additionally, there're many kind of sea foods and price is quite cheap/affordable.", "Additionally, there are many kinds of seafood, and the prices are quite affordable."),
("I'm a light packer, So when I travel. I only bring essentials", "I'm a light packer, so when I travel, I only bring the essentials."),
("Fistly, I pack a couple of clothers depending on the weather.", "Firstly, I pack a couple of clothes depending on the weather."),
("I also bring a hat, a sunglasses and swim suit.", "I also bring a hat, sunglasses and a swimsuit."),
("Of course ,I need toothbrush, toothpaste, and shampo for trip.", "Of course, I need a toothbrush, toothpaste, and shampoo for the trip."),
("And I cannot forget bring my wallet and my phone and a charger.", "And I cannot forget to bring my wallet, my phone and a charger."),
("When I was a kid, I often followed my parents going to the beach each summer.", "When I was a kid, I often went to the beach with my parents each summer."),
("We also played with ball and built sand castle.", "We also played with a ball and built sandcastles."),
("Moreover, we also looked for seashell and crabs on the beach.", "Moreover, we also looked for seashells and crabs on the beach."),
("It is a special trip because this is the first time I travel by plane.", "It was a special trip because it was the first time I traveled by plane."),
("Although It is small island country and large population, every where I saw is so clean and beautiful", "Although it is a small island country with a large population, everywhere I looked was so clean and beautiful."),
("People usually move by public transport or by foot so there is no traffic jam.", "People usually get around by public transport or on foot, so there are no traffic jams."),
("Food is delicious and price is expensive.", "The food is delicious, but the prices are expensive."),
("People are friendly and working hard.", "People are friendly and hard-working."),
("That is so exciting expericence when I travel oversea.", "That was such an exciting experience when I traveled overseas."),
("When I visit another country , I try to visit the historic place there", "When I visit another country, I try to visit the historic places there."),
("I try to get expericence in street, go to special place at that country", "I try to experience the streets and go to special places in that country."),
("I will try to taste local food.", "I will try to taste the local food."),
("Of course I will take picture to record the nice moment.", "Of course, I will take pictures to record the nice moments."),
("I also want to wear tradition clothes and take part in festival to understand more about the life and the human where I go to.", "I also want to wear traditional clothes and take part in festivals to understand more about the life and the people there."),
("When I arrived, I was supprised about modern and beauti of China captial: Beijing.", "When I arrived, I was surprised by how modern and beautiful China's capital, Beijing, was."),
("There was so much road, And they are so big.", "There were so many roads, and they were so big."),
("There're many underground system with high speed.", "There is a huge high-speed subway system."),
("All around are sky tower.", "All around are skyscrapers."),
("I also had exciting experience with food there, The local food is so delicious and taste is so good.", "I also had an exciting experience with the food there. The local food is so delicious and tastes so good."),
("I had a 3 days of vacation last month. During my vacation.", "I had a three-day vacation last month."),
("I spend first day for clean my house, I made the bed, clean the floor, washed the clothes and blanket, I also clean the kitchen and bathroom.", "I spent the first day cleaning my house: I made the bed, cleaned the floor, washed the clothes and blankets, and also cleaned the kitchen and bathroom."),
("Second day, I meet some old friend at a coffee shop. We talk together about our job, we talked about our family and children, we discuss about plan in the future.", "On the second day, I met some old friends at a coffee shop. We talked about our jobs, our families and children, and discussed our plans for the future."),
("In nextday, I spent time to hang out with my family. We went to the zoo and played many game.", "On the next day, I spent time hanging out with my family. We went to the zoo and played many games."),
("After that , we went to favourite restaurant.", "After that, we went to our favourite restaurant."),
("I had an unusual experience last year. It was 2 days vacation at home. It was peak of hot summer. And unfortunately, electric power of my house was suddenly damaged.", "I had an unusual experience last year, during a two-day vacation at home at the peak of a hot summer. Unfortunately, the electricity in my house suddenly went out."),
("It was so awful for me without electric at that hot weather. No fan, no air conditioner, no cooking, no televison..", "It was so awful for me without electricity in that hot weather: no fan, no air conditioner, no cooking, no television."),
("I called to electric agent to fix the damage but It took to 2 days of repairing. It took all my vacation", "I called the electric company to fix the problem, but it took two days of repairs. It took my whole vacation."),
("That was really terrible vacation I have to spend on it.", "That was a really terrible vacation."),
("Fortunately, I finished the project on time .", "Fortunately, I finished the project on time."),
("Great feedback from my boss and the customer and project bonus for my contributions make me really happy.", "Great feedback from my boss and the customer, and a project bonus for my contributions, made me really happy."),
("We left our works behind", "We left our work behind"),
("I remember visiting my friend's house on last New Year's Day.", "I remember visiting my friend's house last New Year's Day."),
("We had dinner together and have some drinks.", "We had dinner together and had some drinks."),
("I felt like I was hanging on a tree and I could not walk normally.", "I felt like I was hanging from a tree, and I could not walk normally."),
("and a lovely balconyIn the living room, there are many funiture and home appliances.", "and a lovely balcony."),
("In included sink, a dining table and some cabinets.", "It includes a sink, a dining table and some cabinets."),
("We also have fridge, a microwave electric stove to make cooking easy and enjoyable.", "We also have a fridge, a microwave and an electric stove to make cooking easy and enjoyable."),
("In balcony, there is a washing machine and I also plant some trees there.", "On the balcony, there is a washing machine, and I also grow some plants there."),
("So, these are my routine work at home.", "So, these are my routine chores at home."),
("The bride was so beautiful in white dress, and the groom looked very handsome in suit.", "The bride was so beautiful in a white dress, and the groom looked very handsome in a suit."),
("I can only used it to send messages and make phone calls.", "I could only use it to send messages and make phone calls."),
("sometimes I can not use my phone when it runs out of battery.", "sometimes I cannot use my phone when it runs out of battery."),
("but overall, I prefer online shopping in person.", "but overall, I prefer online shopping."),
("Most of my friends were the same with me at that time.", "Most of my friends were the same as me at that time."),
("I recycle everything possible — likes cans,", "I recycle everything possible — like cans,"),
("At that point, So I changed myself.", "At that point, I decided to change myself."),
("It is so great when eat grilled meat with sause.", "It is so great to eat grilled meat with sauce."),
("We had to wait a lot of times because the restaurant is very crowded.", "We had to wait a long time because the restaurant was very crowded."),
("The meal was so tasty, .We enjoyed the food with some beer.", "The meal was so tasty. We enjoyed the food with some beer."),
("we were satisfied with this meals . It was a great dinner.", "We were satisfied with the meal. It was a great dinner."),
("and Korean noodles I usually ordered", "and Korean noodles. I usually ordered"),
("I remember going to my friend's house at last his birthday party.", "I remember going to my friend's house for his last birthday party."),
("However I drank too much and got drunk.", "However, I drank too much and got drunk."),
("I felt like hang on the tree and I could not walk normally.", "I felt like I was hanging from a tree, and I could not walk normally."),
("I still had hangover the next day.", "I still had a hangover the next day."),
("It took me quite a long to sober up.", "It took me quite a long time to sober up."),
("Since then, I should be more careful when I'm drinking.", "Since then, I've told myself to be more careful when I'm drinking."),
("my child enjoyed ourdoor activities We felt", "my child enjoyed outdoor activities. We felt"),
("and they do gathering together.", "and they gather together."),
("I had to go to the hospital for surgery/ and bandage the wound.", "I had to go to the hospital to have the wound treated and bandaged."),
("Actually, we did not divide the housework clearly, we just try to clean our apartment whenever we can.", "Actually, we don't divide the housework clearly; we just try to clean our apartment whenever we can."),
("On weekend, I do a laundry, I put the clothes in the washing machine, then hang them to dry on the rack.", "On weekends, I do the laundry: I put the clothes in the washing machine, then hang them to dry on the rack."),
("So these are our routine work at home.", "So these are our routine chores at home."),
("I remember about cleaning my whole house last year.", "I remember cleaning my whole house last year."),
("yoga focus on stretching", "yoga focuses on stretching"),
("jogging is more effective But if", "jogging is more effective. But if"),
("They also wear a hat with same color,", "They also wear a hat of the same color,"),
("written on the side They often", "written on the side. They often"),
("good impression of police officers in country.", "good impression of police officers in my country."),
("Now, I'm working for a large electronics company, I work in the software development department.", "Now, I'm working for a large electronics company, in the software development department."),
]
SUA_A = [
("think the main causes are global climate change", "I think the main causes are global climate change"),
("personally use Facebook to stay connected", "I personally use Facebook to stay connected"),
("usually wake up a bit later than usual", "I usually wake up a bit later than usual"),
]
SUA_EN_B = [
("prepair to trips?.", "prepare for trips?"), ("a bout", "about"), ("Describle", "Describe"), ("visted", "visited"), ("offten", "often"),
("seaon", "season"), ("Server weather", "Severe weather"), ("practive in many places Tell", "practice in many places. Tell"),
("procedurer", "procedure"), ("in You country", "in your country"), ("our early experience", "your early experience"),
("trainsportation", "transportation"), ("walkout", "walk out"), ("celebarte", "celebrate"), ("that was the problem", "what was the problem"),
("What do the typically look like?", "What do they typically look like?"), ("difference identification cards", "different identification cards"),
("Have you experience visiting", "Have you had any experience visiting"), ("always problem that happen", "always problems that happen"),
("housework everyday?", "housework every day?"), ("those type of movies", "those types of movies"),
("That kind of impact did it have you your health", "What kind of impact did it have on your health"), ("goto restaurants.", "go to restaurants?"),
("visit in New City next month", "visit a new city next month"), ("plan and successful trip", "plan a successful trip"),
("Which one do you think better your exercise?", "Which one do you think is better for exercise?"),
("you ate out recently, What kind", "you ate out recently. What kind"), ("defferent", "different"), ("problems can rise", "problems can arise"),
("some popular holiday in your country Where do people", "some popular holidays in your country. Where do people"),
("Tell me about holiday memory from your childhood. Tell me where you were and what that place look like.", "Tell me about a holiday memory from your childhood. Tell me where you were and what that place looked like."),
("some free time When was it?", "some free time. When was it?"), ("a family or a friend you have What is he or she like?", "a family member or a friend you have. What is he or she like?"),
("eat healthy these days What kinds", "eat healthy these days. What kinds"), ("what is was like", "what it was like"),
("in survey that you exchange", "in the survey that you exchange"), ("You indicated that you work I would like", "You indicated that you work. I would like"),
("That products or services", "What products or services"), ("about unusual or unexpected experience", "about an unusual or unexpected experience"),
("this happended", "this happened"), ("some of the place you like", "some of the places you like"),
("Describe a typical visit to a park is like for you.", "Describe what a typical visit to a park is like for you."),
("how your interested in music developed", "how your interest in music developed"),
]
def sua(text, bang):
    for a, b in bang:
        text = text.replace(a, b)
    return text
def don(text):
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.?!])", r"\1", text)
    text = text.replace("?.", "?").replace("..", ".").replace(" .", ".")
    if text and text[0].islower(): text = text[0].upper() + text[1:]
    return text

# ---------------------------------------------------------------- gom cau hoi theo chu de
theo_cd = {cd: [] for cd in CD_ID}
for q in D["A"]:
    so, rp = q["so"], bool(q.get("rp"))
    qid = ("AR%02d" if rp else "A%02d") % so
    dang = (DANG_AR if rp else DANG_A)[so]
    cau = []
    for c in q["cau"]:
        if re.match(r"^\(.*\)$", c): cau.append(c)          # chi dan san khau, giu nguyen
        else: cau.extend(split_sentences(sua(c, SUA_A)))
    theo_cd[chu_de_A(so, rp)].append({"id": qid, "vi": q["vi"], "en": (EN_AR if rp else EN_A)[so], "dang": dang, "cau": cau})
for q in D["B"]:
    so, bt = q["so"], q.get("bien_the", 0)
    key = ("%d%s" % (so, "b" if bt else "")) if bt else so
    qid = "B%03d%s" % (so, "b" if bt else "")
    text = sua(" ".join(q["cau"]), SUA_B)
    cau = split_sentences(text)
    theo_cd[chu_de_B(so)].append({"id": qid, "vi": VI_B[key], "en": don(sua(q["en"], SUA_EN_B)), "dang": DANG_B[key], "cau": cau})

# ---------------------------------------------------------------- ghi
os.makedirs(DICH, exist_ok=True)
tong = 0
for thu_tu, (cd, ten, icon, uu_tien, mo_ta) in enumerate(CHU_DE, 1):
    qs = theo_cd[cd]
    out = ["---", "id: " + cd, "ten: " + ten, "icon: " + icon, "thu-tu: %d" % thu_tu, "uu-tien: %d" % uu_tien, "mo-ta: " + mo_ta, "---", ""]
    for q in qs:
        out.append("## %s · %s" % (q["id"], q["vi"]))
        out.append("- en: " + q["en"])
        out.append("- dang: " + q["dang"])
        out.append("")
        out.extend(q["cau"])
        out.append("")
    open(os.path.join(DICH, "%02d-%s.md" % (thu_tu, cd)), "w", encoding="utf-8", newline="\n").write("\n".join(out))
    tong += len(qs)
    print("%02d %-22s %3d cau" % (thu_tu, cd, len(qs)))
print("tong", tong)
