/* lib-sys.js — Hệ thống & CSDL: LRU, LFU, băm nhất quán, Bloom filter, giới hạn tốc độ, Skip List, B+ Tree, LSM Tree, Merkle Tree,
   HyperLogLog, Raft, Two-Phase Commit, Vector Clock. Đối tượng: kỹ sư ôn System Design / Database / Distributed System.
   Mẫu code là cài đặt tối giản nhưng chạy được và đã được thử; `raft` không có code (nocode), mô tả bằng sơ đồ chữ.
   Cách soạn: xem HUONG-DAN-SOAN.md. */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    // ------------------------------------------------------------------------------------------------ lru-cache
    {
      id: "lru-cache",
      name: "LRU Cache",
      aliases: ["lru", "lru cache", "least recently used", "bộ nhớ đệm lru", "đuổi mục lâu nhất chưa dùng", "cache eviction", "thay thế cache"],
      category: "sys",
      sub: "Bộ nhớ đệm (cache)",
      level: 2,
      tags: ["cache", "lru", "hash-map", "linked-list", "design", "eviction"],
      summary: "Cache có sức chứa cố định, khi đầy đuổi mục lâu nhất chưa được dùng; get/put đều O(1) nhờ danh sách liên kết đôi kết hợp bảng băm.",
      description:
        "LRU (Least Recently Used) đuổi mục **lâu nhất chưa được dùng** khi cache đầy, dựa trên giả định *cục bộ theo thời gian*: vừa dùng thì sẽ sớm dùng lại. Cài đặt O(1): một **danh sách liên kết đôi** sắp mục theo độ mới (đầu = mới nhất) và một **bảng băm** từ khoá tới nút trong danh sách. `get` tìm bằng bảng băm rồi chuyển nút lên đầu (`list::splice` O(1), iterator vẫn hợp lệ); `put` chèn lên đầu và, nếu vượt sức chứa, bỏ nút cuối đồng thời xoá khỏi bảng băm.\n\n" +
        "Điểm yếu lớn nhất: **một lần quét tuần tự lớn** (scan) đẩy toàn bộ dữ liệu nóng ra khỏi cache (cache pollution). Các biến thể LRU-K, 2Q, ARC, TinyLFU ra đời để chống chuyện này. Trong hệ thống nhiều luồng, LRU chính xác cần khoá toàn cục vì mỗi `get` cũng *ghi* (đổi thứ tự), nên nhiều hệ thống dùng LRU **xấp xỉ** (lấy mẫu, chia đoạn, CLOCK) để giảm tranh chấp.\n\n" +
        "Đánh đổi: đơn giản, O(1), hiệu quả khi truy cập có tính cục bộ theo thời gian; nhưng không biết tần suất, không phải chính sách tối ưu (tối ưu offline là Bélády: đuổi mục sẽ được dùng xa nhất trong tương lai, cần biết tương lai).",
      conditions: ["Sức chứa C cố định (số mục hoặc có thể mở rộng thành số byte)", "Truy cập có tính cục bộ theo thời gian: vừa dùng thì dễ được dùng lại", "Khoá băm được (hoặc so sánh được)"],
      complexity: { time: "O(1) trung bình mỗi get/put", space: "O(C)", note: "O(1) kỳ vọng vì dùng bảng băm; xấu nhất bảng băm là O(C) nếu băm tệ." },
      ops: [["get (tra + đẩy lên đầu)", "O(1) trung bình"], ["put (chèn / cập nhật + đuổi nếu đầy)", "O(1) trung bình"], ["Bộ nhớ", "O(C)"]],
      use_case: ["Cache kết quả truy vấn, hồ sơ người dùng, trang đã dựng — khi dữ liệu vừa dùng thường được dùng lại", "Redis với chính sách allkeys-lru (LRU xấp xỉ bằng lấy mẫu), Memcached, bộ nhớ đệm trang (page cache) của nhân Linux dùng biến thể LRU hai danh sách", "Bài phỏng vấn kinh điển: tự cài LRU với get/put O(1)"],
      not_for: ["Có đợt quét lớn đọc-một-lần làm ô nhiễm cache → LFU, 2Q, ARC hoặc TinyLFU", "Quan trọng là TẦN SUẤT dài hạn (mục hot lâu năm) → LFU", "Cần chịu nhiều luồng tranh chấp cao → LRU xấp xỉ (CLOCK, lấy mẫu) hoặc cache chia mảnh"],
      pitfalls: [
        "get cũng là một lần “dùng”: quên đẩy mục lên đầu khi get làm LRU thành FIFO.",
        "put một khoá đã có phải CẬP NHẬT giá trị và đẩy lên đầu, không tăng kích thước và không đuổi ai.",
        "Đuổi mục cuối mà quên xoá khỏi bảng băm → con trỏ treo hoặc kích thước sai.",
        "Sức chứa 0: put không được lưu gì; kiểm tra trước khi đuổi kẻo gọi back() trên danh sách rỗng.",
        "Cache dùng chung giữa các luồng cần khoá cả khi get (vì get ghi); đừng dùng khoá đọc–ghi chỉ cho put."
      ],
      code: {
        lang: "cpp", title: "lru_cache.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// LRU Cache: sức chứa cap mục, get/put O(1) trung bình. Không an toàn đa luồng (get cũng ghi!).
// items: danh sách (khoá, giá trị), ĐẦU danh sách = mới dùng nhất; pos: khoá -> vị trí trong danh sách.
template <class K, class V>
struct LRUCache {
    size_t cap;
    list<pair<K, V>> items;
    unordered_map<K, typename list<pair<K, V>>::iterator> pos;

    explicit LRUCache(size_t capacity) : cap(capacity) {}

    // trả con trỏ tới giá trị (và đánh dấu mới dùng) hoặc nullptr nếu không có
    V* get(const K& key) {
        auto it = pos.find(key);
        if (it == pos.end()) return nullptr;
        items.splice(items.begin(), items, it->second);   // chuyển lên đầu, O(1), iterator vẫn hợp lệ
        return &items.front().second;
    }
    void put(const K& key, V val) {
        if (cap == 0) return;
        auto it = pos.find(key);
        if (it != pos.end()) {                            // đã có: cập nhật + đẩy lên đầu
            it->second->second = std::move(val);
            items.splice(items.begin(), items, it->second);
            return;
        }
        if (items.size() == cap) {                        // đầy: đuổi mục cuối (lâu nhất chưa dùng)
            pos.erase(items.back().first);
            items.pop_back();
        }
        items.emplace_front(key, std::move(val));
        pos[key] = items.begin();
    }
    size_t size() const { return items.size(); }
};
`
      },
      example: {
        input: "Sức chứa 2.\nput(1,1) put(2,2) get(1) put(3,3) get(2) put(4,4) get(1) get(3) get(4)",
        output: "get(1)=1, get(2)=-1, get(1)=-1, get(3)=3, get(4)=4",
        explain: "Sau put(1), put(2): thứ tự từ mới tới cũ là [2,1]. get(1)=1 đưa 1 lên đầu: [1,2]. put(3) làm đầy → đuổi 2 (lâu nhất chưa dùng): [3,1], nên get(2) = -1. put(4) → đuổi 1: [4,3], nên get(1) = -1; get(3) = 3 và get(4) = 4."
      },
      problems: [{ site: "lc", id: "146", name: "LRU Cache" }],
      related: ["lfu-cache", "skip-list", "consistent-hashing", "bloom-filter", "heap"],
      compare: { "Mục đích": "Cache có giới hạn, đuổi theo độ mới", "Đánh đổi": "Đơn giản, O(1); nhạy với quét tuần tự làm ô nhiễm cache; không biết tần suất", "Dùng trong": "Redis (xấp xỉ), Memcached, page cache của OS" },
      cards: [
        { q: "Hai cấu trúc dữ liệu tạo nên LRU O(1)?", a: "Danh sách liên kết đôi (sắp theo độ mới, đầu = mới nhất) và bảng băm từ khoá tới nút trong danh sách." },
        { q: "Vì sao splice của std::list quan trọng trong LRU?", a: "Chuyển một nút lên đầu danh sách trong O(1) mà không làm mất hiệu lực iterator đang lưu trong bảng băm." },
        { q: "Điểm yếu kinh điển của LRU?", a: "Quét tuần tự lớn (đọc một lần) đẩy hết dữ liệu nóng ra khỏi cache — cache pollution. Dùng 2Q, ARC, LRU-K hay TinyLFU để giảm." },
        { q: "Vì sao get của cache LRU dùng chung nhiều luồng vẫn cần khoá ghi?", a: "Mỗi get đổi thứ tự danh sách (đẩy mục lên đầu) nên là thao tác ghi; khoá chỉ-đọc không đủ." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ lfu-cache
    {
      id: "lfu-cache",
      name: "LFU Cache",
      aliases: ["lfu", "lfu cache", "least frequently used", "bộ nhớ đệm lfu", "đuổi mục ít dùng nhất", "tần suất truy cập", "frequency cache"],
      category: "sys",
      sub: "Bộ nhớ đệm (cache)",
      level: 4,
      tags: ["cache", "lfu", "hash-map", "linked-list", "design", "eviction"],
      summary: "Cache đuổi mục được dùng ÍT lần nhất (hòa thì đuổi mục lâu nhất chưa dùng); cài đặt O(1) bằng các danh sách theo tần suất và biến minFreq.",
      description:
        "LFU (Least Frequently Used) giữ lại các mục được truy cập **nhiều lần nhất** và đuổi mục có **tần suất thấp nhất**; khi hòa thì đuổi mục **lâu nhất chưa dùng** (LRU trong cùng nhóm). Cài đặt O(1): bảng băm `key → nút`, và bảng băm `tần suất → danh sách liên kết` các nút cùng tần suất (đầu = mới dùng nhất), cùng biến **minFreq** theo dõi nhóm thấp nhất. Mỗi lần dùng, nút chuyển từ danh sách `f` sang đầu danh sách `f+1`; nếu nhóm `f` rỗng và `f == minFreq` thì minFreq tăng 1. Mục mới vào có tần suất 1 và minFreq đặt lại bằng 1.\n\n" +
        "Điểm mạnh so với LRU: mục **hot lâu dài** không bị đẩy ra bởi một đợt quét đọc-một-lần. Điểm yếu: dữ liệu từng rất nóng nhưng đã nguội vẫn mang tần suất cao và chiếm chỗ vô thời hạn (**cache pollution theo tần suất**), nên LFU thực tế cần **suy giảm tần suất** theo thời gian (đếm xấp xỉ có giảm dần, chia đôi bộ đếm định kỳ).\n\n" +
        "Trong hệ thống lớn, bộ đếm chính xác tốn bộ nhớ; thường dùng bộ đếm xấp xỉ (Morris counter, count-min sketch) và bộ lọc nhận vào (TinyLFU) thay vì danh sách chính xác như mẫu này.",
      conditions: ["Sức chứa C cố định", "Phân bố truy cập lệch (một số mục được dùng nhiều hơn hẳn) và ổn định theo thời gian", "Chấp nhận quy ước: put vào khoá đã có cũng tính là một lần dùng"],
      complexity: { time: "O(1) trung bình mỗi get/put", space: "O(C)", note: "Mỗi thao tác chỉ chuyển một nút giữa hai danh sách và cập nhật minFreq." },
      ops: [["get (tăng tần suất)", "O(1) trung bình"], ["put (chèn mới / cập nhật + đuổi nếu đầy)", "O(1) trung bình"], ["Bộ nhớ", "O(C)"]],
      use_case: ["Cache nội dung có phân bố nổi tiếng lệch (bài viết hot, sản phẩm bán chạy) cần chống đợt crawl đọc một lần", "Redis với chính sách allkeys-lfu (đếm tần suất xấp xỉ có suy giảm), thư viện Caffeine (W-TinyLFU)", "Bài phỏng vấn LFU Cache O(1)"],
      not_for: ["Mẫu truy cập thay đổi theo thời gian (mục hot hôm nay nguội ngày mai) mà không có suy giảm → LRU hoặc LFU có aging", "Cần cài đơn giản nhất → LRU", "Bộ nhớ cho bộ đếm là vấn đề (hàng tỉ khoá) → TinyLFU với count-min sketch"],
      pitfalls: [
        "Quên cập nhật minFreq: khi nhóm minFreq rỗng sau khi tăng tần suất phải tăng minFreq; khi thêm mục mới phải đặt minFreq = 1.",
        "Hòa tần suất phải đuổi mục LÂU NHẤT chưa dùng trong nhóm (cuối danh sách), không phải mục bất kỳ.",
        "Đuổi mục TRƯỚC khi chèn mục mới (mục mới tần suất 1 không được tự đuổi chính nó).",
        "Quên suy giảm: mục từng hot chiếm cache mãi; thêm aging (chia đôi tần suất định kỳ).",
        "Xoá nhóm tần suất rỗng khỏi bảng băm; nếu không bộ nhớ phình ra theo tần suất lớn nhất."
      ],
      code: {
        lang: "cpp", title: "lfu_cache.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// LFU Cache O(1): đuổi mục có tần suất thấp nhất; hòa thì đuổi mục lâu nhất chưa dùng. put vào khoá đã có cũng tính là một lần dùng.
// byFreq[f] = danh sách các nút có tần suất f (ĐẦU = mới dùng nhất); minFreq = tần suất nhỏ nhất đang có.
template <class K, class V>
struct LFUCache {
    struct Node { K key; V val; int freq; };
    typedef typename list<Node>::iterator It;
    size_t cap;
    int minFreq = 0;
    unordered_map<int, list<Node>> byFreq;
    unordered_map<K, It> pos;

    explicit LFUCache(size_t capacity) : cap(capacity) {}

    // tăng tần suất của nút it thêm 1 (chuyển sang danh sách freq + 1), trả iterator mới
    It touch(It it) {
        Node n = std::move(*it);
        list<Node>& lst = byFreq[n.freq];
        lst.erase(it);
        if (lst.empty()) {
            byFreq.erase(n.freq);
            if (minFreq == n.freq) minFreq++;
        }
        n.freq++;
        list<Node>& dst = byFreq[n.freq];
        dst.push_front(std::move(n));
        pos[dst.front().key] = dst.begin();
        return dst.begin();
    }
    V* get(const K& key) {
        auto f = pos.find(key);
        if (f == pos.end()) return nullptr;
        return &touch(f->second)->val;
    }
    void put(const K& key, V val) {
        if (cap == 0) return;
        auto f = pos.find(key);
        if (f != pos.end()) { touch(f->second)->val = std::move(val); return; }
        if (pos.size() == cap) {                          // đầy: đuổi mục lâu nhất chưa dùng trong nhóm tần suất thấp nhất
            list<Node>& lst = byFreq[minFreq];
            pos.erase(lst.back().key);
            lst.pop_back();
            if (lst.empty()) byFreq.erase(minFreq);
        }
        list<Node>& one = byFreq[1];
        one.push_front(Node{key, std::move(val), 1});
        pos[key] = one.begin();
        minFreq = 1;
    }
    size_t size() const { return pos.size(); }
};
`
      },
      example: {
        input: "Sức chứa 2.\nput(1,1) put(2,2) get(1) put(3,3) get(2) get(3) put(4,4) get(1) get(3) get(4)",
        output: "get(1)=1, get(2)=-1, get(3)=3, get(1)=-1, get(3)=3, get(4)=4",
        explain: "Sau put(1), put(2): tần suất 1 và 1. get(1) → tần suất của 1 là 2. put(3) làm đầy: mục tần suất thấp nhất là 2 → bị đuổi, nên get(2) = -1. get(3) → tần suất của 3 là 2. put(4): cả 1 và 3 đều có tần suất 2 → hòa, đuổi mục lâu nhất chưa dùng là 1; nên get(1) = -1, get(3) = 3, get(4) = 4."
      },
      problems: [{ site: "lc", id: "460", name: "LFU Cache" }],
      related: ["lru-cache", "heap", "bloom-filter", "hyperloglog"],
      compare: { "Mục đích": "Cache giữ mục dùng NHIỀU nhất, đuổi mục dùng ít nhất", "Đánh đổi": "Chống quét đọc-một-lần; mục từng hot chiếm chỗ lâu nếu không aging; cài phức tạp hơn LRU", "Dùng trong": "Redis (allkeys-lfu), Caffeine (W-TinyLFU)" },
      cards: [
        { q: "Hai bảng băm và biến nào tạo nên LFU O(1)?", a: "key → nút; tần suất → danh sách các nút cùng tần suất (đầu = mới dùng nhất); và biến minFreq trỏ tới nhóm tần suất nhỏ nhất." },
        { q: "Khi nào minFreq tăng, khi nào đặt lại?", a: "Tăng 1 khi nhóm minFreq trở nên rỗng sau khi một nút chuyển lên tần suất cao hơn. Đặt lại bằng 1 mỗi khi chèn mục mới." },
        { q: "Hòa tần suất khi đuổi thì đuổi mục nào?", a: "Mục lâu nhất chưa dùng trong nhóm tần suất thấp nhất (cuối danh sách của nhóm)." },
        { q: "Điểm yếu thực tế của LFU và cách khắc phục?", a: "Mục từng rất hot nhưng nguội đi vẫn mang tần suất cao, chiếm chỗ mãi. Khắc phục bằng suy giảm tần suất theo thời gian (aging) hoặc TinyLFU." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ consistent-hashing
    {
      id: "consistent-hashing",
      name: "Băm nhất quán (Consistent Hashing)",
      aliases: ["consistent hashing", "băm nhất quán", "hash ring", "vòng băm", "virtual nodes", "nút ảo", "vnode", "sharding", "phân mảnh dữ liệu"],
      category: "sys",
      sub: "Phân mảnh & nhân bản",
      level: 3,
      tags: ["distributed", "sharding", "hashing", "consistent-hashing", "load-balancing", "partitioning"],
      summary: "Băm cả nút lẫn khoá lên một vòng; khoá thuộc nút đầu tiên theo chiều kim đồng hồ, nên thêm/bớt một nút chỉ di chuyển cỡ 1/N số khoá.",
      description:
        "Băm cả **nút** và **khoá** lên cùng một vòng giá trị (ví dụ 0 … 2^64 − 1); khoá thuộc về **nút đầu tiên gặp theo chiều kim đồng hồ** từ vị trí băm của khoá. Khi thêm một nút chỉ các khoá nằm ngay trước vị trí nó (trong cung giữa nó và nút liền trước) chuyển sang nút mới; khi bỏ một nút chỉ khoá của nút đó chuyển sang nút kế. Kỳ vọng chỉ khoảng **1/N** khoá bị di chuyển, trong khi `hash(key) mod N` đổi N làm gần như **mọi** khoá đổi chỗ (từ 3 lên 4 nút: 75% khoá chuyển).\n\n" +
        "Một nút chỉ có một điểm trên vòng thì tải rất lệch. Giải pháp: **nút ảo (virtual node)** — mỗi nút thật đặt V điểm (băm `tên#i`), nên phần vòng nó phụ trách là tổng của V cung nhỏ; độ lệch tải tương đối cỡ 1/√V. Nút ảo còn cho phép nút mạnh hơn nhận nhiều điểm hơn (trọng số). **Nhân bản**: lấy R nút *thật khác nhau* kế tiếp trên vòng làm bản sao của khoá.\n\n" +
        "Cài đặt gọn bằng `std::map<hash, nút>` và `lower_bound` (quay về đầu khi tới cuối). Một số hệ thống chọn cách khác để phân mảnh: số khe cố định (Redis Cluster dùng 16384 hash slot, di chuyển cả khe), rendezvous hashing, jump consistent hash — đều nhằm cùng mục tiêu: ít di chuyển khi đổi số nút.",
      conditions: ["Tập nút thay đổi theo thời gian (thêm, bớt, hỏng)", "Hàm băm phân bố đều (trộn bit tốt) cho cả khoá và tên nút ảo", "Chấp nhận tải lệch tương đối cỡ 1/√V (chọn V đủ lớn, cỡ trăm)"],
      complexity: { time: "O(log(N·V)) mỗi lần tra cứu", space: "O(N·V)", note: "N = số nút thật, V = số nút ảo mỗi nút. Thêm/bớt một nút: O(V · log(N·V)); số khoá cần di chuyển kỳ vọng ≈ K/N (K = tổng số khoá)." },
      ops: [["Tra khoá → nút", "O(log(N·V))"], ["Thêm một nút", "O(V · log(N·V))"], ["Bớt một nút", "O(V · log(N·V))"], ["Bộ nhớ", "O(N·V)"]],
      use_case: ["Phân mảnh cache / kho khoá–giá trị trên nhiều máy mà vẫn giữ hit rate khi thêm hoặc bớt máy", "Cassandra (vòng token + vnode), bài báo Dynamo của Amazon, Riak, thư viện client ketama của Memcached", "Cân bằng tải có tính gắn kết (sticky) theo khoá: cùng khoá luôn vào cùng máy khi tập máy ổn định"],
      not_for: ["Số nút cố định, không bao giờ đổi → hash mod N đơn giản hơn", "Cần kiểm soát chính xác khe nào ở nút nào, di chuyển theo khe → số khe cố định như Redis Cluster", "Khoá nóng đơn lẻ (hot key) → băm không giúp; cần tách khoá hoặc nhân bản đọc"],
      pitfalls: [
        "Chỉ một điểm mỗi nút làm tải lệch nặng (nút có thể gấp vài lần nút khác); dùng nút ảo cỡ trăm.",
        "Hai nút ảo trùng vị trí: cần quy tắc rõ (giữ nút đến trước) và khi xoá chỉ xoá điểm thật sự của nút đó, nếu không xoá nhầm nút khác.",
        "Quên quay vòng: lower_bound trả end() thì phải lấy phần tử đầu tiên của vòng.",
        "Băm kém (ví dụ std::hash của số nguyên là đồng nhất) dồn các điểm vào một cung; cần trộn bit (FNV + splitmix, murmur, xxhash).",
        "Khi bớt một nút mà không nhân bản, dữ liệu của nó mất cho đến khi khôi phục — băm nhất quán chỉ quyết định VỊ TRÍ, không bảo vệ dữ liệu."
      ],
      code: {
        lang: "cpp", title: "consistent_hashing.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Băm nhất quán với nút ảo. ring: vị trí trên vòng 2^64 -> tên nút thật. Mỗi nút thật có vnodes điểm.
// Khoá thuộc nút đầu tiên theo chiều kim đồng hồ (>= vị trí băm của khoá, quay về đầu khi hết vòng).
struct ConsistentHash {
    int vnodes;
    map<uint64_t, string> ring;

    explicit ConsistentHash(int virtualNodes = 100) : vnodes(virtualNodes) {}

    // FNV-1a 64 bit rồi trộn bit (splitmix64 finalizer) để phân bố đều
    static uint64_t hash(const string& s) {
        uint64_t h = 1469598103934665603ULL;
        for (unsigned char c : s) { h ^= c; h *= 1099511628211ULL; }
        h ^= h >> 30; h *= 0xbf58476d1ce4e5b9ULL;
        h ^= h >> 27; h *= 0x94d049bb133111ebULL;
        h ^= h >> 31;
        return h;
    }
    void addNode(const string& name) {
        for (int i = 0; i < vnodes; i++) ring.emplace(hash(name + "#" + to_string(i)), name);   // trùng vị trí: giữ nút đến trước
    }
    void removeNode(const string& name) {
        for (int i = 0; i < vnodes; i++) {
            auto it = ring.find(hash(name + "#" + to_string(i)));
            if (it != ring.end() && it->second == name) ring.erase(it);                           // chỉ xoá điểm thật sự của nút này
        }
    }
    // nút phụ trách khoá; "" nếu vòng rỗng
    string getNode(const string& key) const {
        if (ring.empty()) return "";
        auto it = ring.lower_bound(hash(key));
        if (it == ring.end()) it = ring.begin();
        return it->second;
    }
    // tối đa count nút thật KHÁC NHAU kế tiếp trên vòng (làm bản sao); phần tử đầu = getNode(key)
    vector<string> getNodes(const string& key, size_t count) const {
        vector<string> res;
        if (ring.empty()) return res;
        auto it = ring.lower_bound(hash(key));
        for (size_t step = 0; step < ring.size() && res.size() < count; step++, ++it) {
            if (it == ring.end()) it = ring.begin();
            if (find(res.begin(), res.end(), it->second) == res.end()) res.push_back(it->second);
        }
        return res;
    }
};
`
      },
      example: {
        input: "Cụm 3 nút, các khoá có hash phân bố đều. Thêm nút thứ 4.\nSo hai cách chia: (a) hash(key) mod N, (b) băm nhất quán với nút ảo.",
        output: "(a) 75% số khoá đổi nút; (b) khoảng 25% (1/4) số khoá đổi nút, và tất cả đều chuyển sang nút MỚI",
        explain: "(a) Khoá có hash h ở lại nút cũ chỉ khi h mod 3 = h mod 4, điều này xảy ra khi h mod 12 thuộc {0, 1, 2}: đúng 3/12 = 25% ở lại, 75% chuyển (tính chính xác, không phải ước lượng). (b) Nút mới chỉ nhận các cung ngay trước các điểm ảo của nó, kỳ vọng 1/4 vòng, và khoá không đổi chỗ giữa các nút cũ. Số 25% là giá trị kỳ vọng; với V nút ảo độ lệch cỡ 1/√V."
      },
      problems: [],
      related: ["lru-cache", "bloom-filter", "merkle-tree", "hyperloglog", "raft"],
      compare: { "Mục đích": "Phân mảnh khoá lên nhiều nút, ít di chuyển khi đổi số nút", "Đánh đổi": "Chỉ ~1/N khoá di chuyển; tải lệch cỡ 1/√V nên cần nút ảo; không tự nhân bản dữ liệu", "Dùng trong": "Cassandra, Dynamo, Riak, client ketama (Memcached)" },
      cards: [
        { q: "Vì sao hash(key) mod N tệ khi thêm/bớt nút?", a: "Đổi N làm kết quả mod đổi với hầu hết khoá (3 → 4 nút: 75% khoá đổi nút), cache gần như mất hết." },
        { q: "Băm nhất quán di chuyển bao nhiêu khoá khi thêm một nút?", a: "Kỳ vọng khoảng 1/N tổng số khoá (N = số nút sau khi thêm), tất cả sang nút mới." },
        { q: "Nút ảo (virtual node) để làm gì?", a: "Mỗi nút thật có V điểm trên vòng nên tải cân bằng hơn (độ lệch tương đối cỡ 1/√V), và có thể gán trọng số khác nhau cho nút mạnh yếu." },
        { q: "Cách lấy R bản sao của một khoá?", a: "Đi theo chiều kim đồng hồ từ vị trí khoá, lấy R nút THẬT khác nhau đầu tiên (bỏ qua các nút ảo thuộc cùng một nút thật)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ bloom-filter
    {
      id: "bloom-filter",
      name: "Bloom Filter",
      aliases: ["bloom filter", "bộ lọc bloom", "kiểm tra tồn tại xác suất", "probabilistic membership", "false positive", "dương tính giả", "bit array hash"],
      category: "sys",
      sub: "Cấu trúc xác suất",
      level: 2,
      tags: ["probabilistic", "bloom-filter", "hashing", "membership", "bit-array", "space-efficient"],
      summary: "Tập hợp xác suất tiết kiệm bộ nhớ: kiểm tra phần tử “có thể có” hay “chắc chắn không”; không bao giờ bỏ sót (không âm tính giả) nhưng có thể báo nhầm (dương tính giả).",
      description:
        "Bloom filter là mảng **m bit** cùng **k hàm băm**. `add(x)` bật k bit tại các vị trí `h_i(x)`; `maybeContains(x)` kiểm tra cả k bit đều bật. Nếu có bit tắt thì x **chắc chắn chưa từng được thêm**; nếu cả k bit bật thì x **có thể** đã có — các phần tử khác có thể vô tình bật đủ k bit đó (**dương tính giả**). Không bao giờ có **âm tính giả** (vì chưa hỗ trợ xoá).\n\n" +
        "Xác suất dương tính giả sau khi thêm n phần tử: `p ≈ (1 − e^(−kn/m))^k`. Chọn tham số tối ưu cho n và p mong muốn: `m = −n·ln p / (ln 2)²` bit (≈ 1,44·log2(1/p) bit mỗi phần tử; p = 1% cần khoảng 9,6 bit/phần tử) và `k = (m/n)·ln 2`. Khi đúng tối ưu, đúng nửa số bit được bật. Thêm quá n phần tử làm p tăng nhanh. Hai hàm băm h1, h2 là đủ: dùng `h_i = h1 + i·h2` (double hashing) thay cho k hàm độc lập.\n\n" +
        "Ý nghĩa hệ thống: một phép “chắc chắn không có” rất rẻ trong RAM giúp **tránh truy cập đĩa/mạng đắt** cho khoá không tồn tại (LSM-tree, chống tấn công truy vấn khoá không có, bộ lọc URL đã duyệt). Hai bộ lọc cùng kích thước hợp nhất bằng phép OR bit. Bản mở rộng: Counting Bloom (hỗ trợ xoá bằng bộ đếm), Cuckoo filter (xoá được, gọn hơn ở p thấp).",
      conditions: ["Chấp nhận dương tính giả với xác suất p nhỏ cho trước; KHÔNG chấp nhận âm tính giả", "Biết trước số phần tử tối đa n (để chọn m, k)", "Không cần xoá phần tử hay liệt kê phần tử"],
      complexity: { time: "O(k) mỗi add / maybeContains", space: "O(m) bit", note: "m ≈ 1,44·n·log2(1/p) bit; k ≈ log2(1/p). Không phụ thuộc kích thước phần tử." },
      ops: [["add", "O(k)"], ["maybeContains", "O(k)"], ["Hợp nhất hai bộ lọc cùng tham số (OR bit)", "O(m / 64)"], ["Bộ nhớ", "O(m) bit"]],
      use_case: ["Bộ lọc theo từng tệp SSTable trong RocksDB / LevelDB / Cassandra / HBase / Bigtable: bỏ qua tệp chắc chắn không chứa khoá, tiết kiệm đọc đĩa", "Trình thu thập web: nhớ URL đã duyệt với vài bit mỗi URL (bỏ qua nhầm vài URL mới còn hơn tốn RAM cho cả tập)", "Chặn sớm truy vấn khoá không tồn tại trước cache/CSDL (cache penetration)", "Kiểm tra “đã thấy” trong luồng dữ liệu rất lớn khi không thể lưu cả tập"],
      not_for: ["Cần xoá phần tử → Counting Bloom filter hoặc Cuckoo filter", "Cần câu trả lời CHÍNH XÁC hoặc liệt kê phần tử → tập băm (hash set) / cây", "Cần ĐẾM số phần tử phân biệt → HyperLogLog", "Số phần tử không biết trước, tăng không giới hạn → Scalable Bloom filter hoặc cấu trúc khác"],
      pitfalls: [
        "Thêm nhiều hơn n phần tử dự kiến: tỉ lệ dương tính giả tăng vọt, không có cảnh báo; theo dõi số phần tử đã thêm.",
        "Hàm băm yếu hoặc k hàm không độc lập làm tỉ lệ thực tế cao hơn công thức; dùng bộ trộn bit tốt (splitmix, murmur).",
        "Xoá bằng cách tắt bit sẽ gây âm tính giả cho các phần tử khác — không được xoá trong Bloom filter thường.",
        "Hợp nhất hoặc truyền bộ lọc giữa các máy phải dùng cùng m, k và cùng hàm băm.",
        "Dùng kết quả “có thể có” như “chắc chắn có”: luôn kiểm lại ở nguồn thật khi quyết định quan trọng."
      ],
      code: {
        lang: "cpp", title: "bloom_filter.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Bloom Filter cho khoá 64 bit (khoá khác: dùng hash<string>{}(s) ...). Chọn m, k tối ưu từ n phần tử dự kiến và xác suất dương tính giả p.
// m = ceil(-n ln p / (ln 2)^2) bit, k = round(m / n * ln 2). add/maybeContains O(k). Không có âm tính giả; có thể dương tính giả.
struct BloomFilter {
    size_t m;                 // số bit
    int k;                    // số hàm băm
    vector<uint64_t> bits;

    static uint64_t mix(uint64_t x) {   // splitmix64 finalizer
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }
    static void sizing(size_t n, double p, size_t& m, int& k) {
        n = max<size_t>(n, 1);
        m = max<size_t>(1, (size_t)ceil(-(double)n * log(p) / (log(2.0) * log(2.0))));
        k = max(1, (int)lround((double)m / n * log(2.0)));
    }
    BloomFilter(size_t expectedN, double fpRate) {
        sizing(expectedN, fpRate, m, k);
        bits.assign((m + 63) / 64, 0);
    }
    void add(uint64_t x) {
        uint64_t h1 = mix(x), h2 = mix(x ^ 0x5851f42d4c957f2dULL) | 1;   // double hashing: h_i = h1 + i * h2
        for (int i = 0; i < k; i++) {
            size_t b = (h1 + (uint64_t)i * h2) % m;
            bits[b >> 6] |= 1ULL << (b & 63);
        }
    }
    bool maybeContains(uint64_t x) const {
        uint64_t h1 = mix(x), h2 = mix(x ^ 0x5851f42d4c957f2dULL) | 1;
        for (int i = 0; i < k; i++) {
            size_t b = (h1 + (uint64_t)i * h2) % m;
            if (!(bits[b >> 6] >> (b & 63) & 1)) return false;
        }
        return true;
    }
    // xác suất dương tính giả lý thuyết sau khi đã thêm inserted phần tử: (1 - e^(-k n / m))^k
    double fpRate(size_t inserted) const { return pow(1.0 - exp(-(double)k * inserted / m), k); }
};
`
      },
      example: {
        input: "Dự kiến n = 1000 phần tử, chấp nhận p = 1% dương tính giả. Chọn m và k tối ưu?",
        output: "m = 9586 bit (≈ 1,2 KB), k = 7",
        explain: "m = ⌈−n·ln p / (ln 2)²⌉ = ⌈1000 · 4,60517 / 0,480453⌉ = ⌈9585,06⌉ = 9586 bit ≈ 9,6 bit mỗi phần tử. k = round(m/n · ln 2) = round(9,586 · 0,6931) = round(6,64) = 7. Sau khi thêm đủ 1000 phần tử, xác suất dương tính giả lý thuyết ≈ (1 − e^(−7·1000/9586))^7 ≈ 1%."
      },
      problems: [],
      related: ["hyperloglog", "lsm-tree", "consistent-hashing", "merkle-tree", "lru-cache"],
      compare: { "Mục đích": "Kiểm tra thuộc tập: “chắc chắn không” hay “có thể có”", "Đánh đổi": "Rất tiết kiệm bộ nhớ (~9,6 bit/phần tử cho p = 1%); có dương tính giả, không xoá được, không liệt kê được", "Dùng trong": "RocksDB/LevelDB, Cassandra, HBase, Bigtable" },
      cards: [
        { q: "Bloom filter có thể sai theo chiều nào?", a: "Chỉ dương tính giả (báo “có thể có” cho phần tử chưa thêm). Không bao giờ âm tính giả khi không xoá." },
        { q: "Công thức chọn m và k tối ưu?", a: "m = −n·ln p / (ln 2)² bit và k = (m/n)·ln 2. Khi đó đúng nửa số bit được bật. p = 1% cần ≈ 9,6 bit mỗi phần tử, k ≈ 7." },
        { q: "Vì sao không xoá được phần tử khỏi Bloom filter thường?", a: "Các phần tử khác có thể dùng chung bit; tắt bit sẽ gây âm tính giả. Muốn xoá dùng Counting Bloom filter hoặc Cuckoo filter." },
        { q: "Bloom filter giúp gì cho LSM-tree?", a: "Mỗi tệp SSTable có một bộ lọc; truy vấn khoá không tồn tại bỏ qua gần hết tệp mà không đọc đĩa, giảm read amplification." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ rate-limiter
    {
      id: "rate-limiter",
      name: "Giới hạn tốc độ (Token / Leaky Bucket)",
      aliases: ["rate limiter", "rate limiting", "token bucket", "leaky bucket", "giới hạn tốc độ", "giới hạn request", "throttling", "điều tiết lưu lượng"],
      category: "sys",
      sub: "Điều tiết lưu lượng",
      level: 2,
      tags: ["rate-limiting", "token-bucket", "leaky-bucket", "throttling", "api", "design"],
      summary: "Cho phép tối đa một tốc độ trung bình nhưng chịu được đợt dồn cục (burst): token bucket nạp token đều đặn, mỗi yêu cầu tiêu token; hết token thì từ chối.",
      description:
        "**Token bucket**: một xô chứa tối đa `b` token (độ dồn cục cho phép), được nạp `r` token mỗi giây. Mỗi yêu cầu cần 1 token (hoặc `cost` token); đủ token thì cho qua và trừ, thiếu thì từ chối hoặc bắt chờ. Kết quả: tốc độ trung bình dài hạn ≤ r, nhưng được phép dồn cục tới b yêu cầu liên tiếp nếu xô đầy. Bất biến: trong mọi khoảng thời gian dài T, số token tiêu ≤ b + r·T. Cài đặt O(1): không cần bộ đếm hay luồng nạp — chỉ lưu *số dư* và *thời điểm cập nhật cuối*, tính số token được nạp lười biếng khi có yêu cầu mới (`số dư = min(b, số dư + Δt·r)`).\n\n" +
        "**Leaky bucket** có hai cách hiểu: (1) như **đồng hồ đo (meter)**: mức nước rò đều, yêu cầu làm mức tăng, từ chối khi tràn — hoàn toàn tương đương token bucket (mức = b − số dư token); (2) như **hàng đợi (shaper)**: yêu cầu xếp hàng và được xả ra với tốc độ cố định, làm mượt luồng ra nhưng thêm độ trễ. Các cách khác: **fixed window counter** (đơn giản, nhưng sát ranh giới cửa sổ cho phép gấp đôi), **sliding window log** (chính xác, tốn O(số yêu cầu) bộ nhớ), **sliding window counter** (xấp xỉ, O(1)).\n\n" +
        "Mẫu dưới dùng **thời gian do người gọi truyền vào** (mili-giây nguyên) và **số học nguyên** (số dư tính theo đơn vị 1/perMs token) nên không có sai số số thực và kiểm thử xác định. Trong hệ phân tán, trạng thái xô thường đặt trong kho dùng chung (ví dụ Redis, cập nhật nguyên tử) theo khoá khách hàng; dùng đồng hồ đơn điệu, đừng tin đồng hồ lệch giữa các máy.",
      conditions: ["Có định danh để gắn giới hạn (khách hàng, IP, khoá API)", "Cần giới hạn tốc độ trung bình và cho phép burst có kiểm soát", "Thời gian đơn điệu (không đi lùi) hoặc xử lý được khi lùi"],
      complexity: { time: "O(1) mỗi yêu cầu", space: "O(1) mỗi khoá giới hạn", note: "Chỉ lưu số dư và thời điểm cuối. Với hàng triệu khoá cần thêm cơ chế dọn khoá không hoạt động." },
      ops: [["allow (nạp lười + kiểm tra + trừ)", "O(1)"], ["Bộ nhớ mỗi khoá", "O(1)"]],
      use_case: ["API công khai: tối đa N yêu cầu/phút mỗi khách nhưng cho phép dồn cục ngắn", "Nginx limit_req (leaky bucket), AWS API Gateway (token bucket), bộ lọc token bucket của Linux tc (tbf), Guava RateLimiter", "Chống brute force đăng nhập, spam; bảo vệ dịch vụ phía sau khỏi quá tải", "Điều tiết lưu lượng mạng ra (traffic shaping)"],
      not_for: ["Cần đảm bảo số yêu cầu CHÍNH XÁC trong từng cửa sổ trượt → sliding window log (tốn bộ nhớ hơn)", "Cần giới hạn đồng thời (số yêu cầu đang xử lý) chứ không phải tốc độ → semaphore / giới hạn đồng thời", "Muốn làm mượt luồng ra, chấp nhận trễ → leaky bucket dạng hàng đợi"],
      pitfalls: [
        "Quên cắt số dư tại sức chứa: để xô nạp vô hạn trong lúc rảnh làm burst khổng lồ khi có yêu cầu.",
        "Dùng giờ hệ thống có thể đi lùi (đồng bộ NTP): dùng đồng hồ đơn điệu, và bỏ qua Δt âm.",
        "Số thực tích luỹ sai số khi nạp từng bước nhỏ; dùng số nguyên (như mẫu) hoặc tính theo Δt lớn.",
        "Fixed window counter cho phép gấp đôi giới hạn ở ranh giới hai cửa sổ (cuối cửa sổ cũ + đầu cửa sổ mới).",
        "Phân tán: đọc–sửa–ghi số dư không nguyên tử giữa nhiều máy làm vượt giới hạn; dùng thao tác nguyên tử (Lua script, CAS)."
      ],
      code: {
        lang: "cpp", title: "token_bucket.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Token bucket với THỜI GIAN GIẢ truyền vào (mili-giây nguyên) và số học nguyên => xác định, không sai số số thực.
// Sức chứa capacity token; nạp refill token mỗi perMs mili-giây (liên tục). Bắt đầu đầy tại nowMs.
// Số dư tính theo đơn vị 1/perMs token: nạp mỗi mili-giây thêm refill đơn vị, một token = perMs đơn vị.
struct TokenBucket {
    long long capU, rate, per, bal, last;
    TokenBucket(long long capacity, long long refill, long long perMs, long long nowMs = 0)
        : capU(capacity * perMs), rate(refill), per(perMs), bal(capacity * perMs), last(nowMs) {}

    // cho qua (và trừ cost token) nếu đủ token; thời gian đi lùi bị bỏ qua
    bool allow(long long nowMs, long long cost = 1) {
        if (nowMs > last) {
            long long gap = nowMs - last;
            if (rate > 0 && gap >= (capU - bal + rate - 1) / rate) bal = capU;   // đủ lâu để đầy: tránh tràn gap * rate
            else bal += gap * rate;
            last = nowMs;
        }
        if (cost >= 0 && bal >= cost * per) { bal -= cost * per; return true; }
        return false;
    }
};

// Leaky bucket dạng đồng hồ đo (meter): mức nước rò leak đơn vị mỗi perMs; nhận yêu cầu nếu mức + cost <= sức chứa.
// Quyết định giống hệt TokenBucket cùng tham số (mức nước = sức chứa - số dư token).
struct LeakyBucket {
    long long capU, leak, per, level, last;
    LeakyBucket(long long capacity, long long leakPer, long long perMs, long long nowMs = 0)
        : capU(capacity * perMs), leak(leakPer), per(perMs), level(0), last(nowMs) {}
    bool allow(long long nowMs, long long cost = 1) {
        if (nowMs > last) {
            long long gap = nowMs - last;
            if (leak > 0 && gap >= (level + leak - 1) / leak) level = 0;
            else level -= gap * leak;
            last = nowMs;
        }
        if (cost >= 0 && level + cost * per <= capU) { level += cost * per; return true; }
        return false;
    }
};
`
      },
      example: {
        input: "Token bucket: sức chứa 3 token, nạp 1 token mỗi 1000 ms, bắt đầu đầy lúc t = 0.\nYêu cầu (mỗi yêu cầu 1 token) tại t (ms): 0, 0, 0, 0, 500, 1000, 1000",
        output: "cho, cho, cho, TỪ CHỐI, TỪ CHỐI, cho, TỪ CHỐI",
        explain: "Ba yêu cầu đầu lúc t = 0 dùng hết 3 token ban đầu; yêu cầu thứ tư lúc t = 0 không còn token. Lúc t = 500 mới nạp được 0,5 token (< 1) nên từ chối. Lúc t = 1000 đã nạp đủ 1 token → cho qua và hết lại; yêu cầu thứ hai cùng lúc t = 1000 bị từ chối."
      },
      problems: [{ site: "lc", id: "359", name: "Logger Rate Limiter" }],
      related: ["lru-cache", "bloom-filter", "vector-clock", "skip-list"],
      compare: { "Mục đích": "Giới hạn tốc độ trung bình, cho phép burst có kiểm soát", "Đánh đổi": "O(1) thời gian và bộ nhớ mỗi khoá; cần đồng hồ đơn điệu; phân tán cần cập nhật nguyên tử", "Dùng trong": "Nginx, AWS API Gateway, Linux tc, Guava RateLimiter" },
      cards: [
        { q: "Token bucket đảm bảo điều gì về tốc độ?", a: "Trong mọi khoảng dài T, số yêu cầu qua ≤ b + r·T (b = sức chứa, r = tốc độ nạp): trung bình ≤ r, burst tối đa b." },
        { q: "Vì sao không cần luồng nền để nạp token?", a: "Lưu số dư và thời điểm cập nhật cuối; khi có yêu cầu mới tính lười số dư = min(b, số dư + Δt·r)." },
        { q: "Leaky bucket dạng meter và token bucket khác nhau không?", a: "Về quyết định cho/từ chối thì tương đương (mức nước = sức chứa − số dư token). Leaky bucket dạng hàng đợi mới làm mượt luồng ra bằng cách thêm độ trễ." },
        { q: "Điểm yếu của fixed window counter?", a: "Ở ranh giới hai cửa sổ có thể cho qua gấp đôi giới hạn (cuối cửa sổ trước + đầu cửa sổ sau)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ skip-list
    {
      id: "skip-list",
      name: "Skip List",
      aliases: ["skip list", "danh sách nhảy", "skiplist", "xác suất cân bằng", "sorted set redis", "zset", "concurrent skip list"],
      category: "sys",
      sub: "Cấu trúc dữ liệu có thứ tự",
      level: 3,
      tags: ["data-structure", "skip-list", "probabilistic", "ordered-set", "linked-list", "design"],
      summary: "Danh sách liên kết nhiều tầng, mỗi nút được nâng tầng ngẫu nhiên với xác suất 1/2: tìm, chèn, xoá kỳ vọng O(log N) mà cài đặt đơn giản hơn cây cân bằng.",
      description:
        "Skip list là một danh sách liên kết đã sắp xếp được xếp thêm các **tầng ‘đường cao tốc’**: tầng 0 chứa mọi phần tử; mỗi phần tử còn xuất hiện ở tầng i + 1 với xác suất **1/2** (chiều cao tuân theo phân bố hình học). Tìm kiếm bắt đầu từ tầng cao nhất, đi ngang tới khi nút kế tiếp ≥ khoá thì **hạ xuống một tầng**, lặp tới tầng 0. Kỳ vọng mỗi tầng đi O(1) bước và có O(log N) tầng nên mọi thao tác kỳ vọng **O(log N)**.\n\n" +
        "Chèn: ghi lại ở mỗi tầng nút đứng ngay trước vị trí chèn (mảng `update`), sinh chiều cao ngẫu nhiên h, rồi nối nút mới vào h tầng. Xoá tương tự, rồi hạ số tầng nếu tầng trên cùng rỗng. Không có phép xoay hay tái cân bằng; cân bằng đến từ ngẫu nhiên, nên **không có bảo đảm xấu nhất** (vẫn có thể O(N) với xác suất cực nhỏ). Bộ nhớ kỳ vọng ≈ 2N con trỏ với p = 1/2.\n\n" +
        "Ưu thế: cài đặt gọn, duyệt theo thứ tự và truy vấn khoảng tự nhiên (đi theo tầng 0), và **dễ làm đồng thời hơn** cây cân bằng (chỉ cần cập nhật cục bộ vài con trỏ), nên được dùng cho cấu trúc nhiều luồng. Nhược: kém thân thiện với cache CPU hơn mảng/cây B vì nút cấp phát rải rác.",
      conditions: ["Khoá so sánh được (thứ tự toàn phần)", "Chấp nhận bảo đảm kỳ vọng thay vì xấu nhất", "Có nguồn ngẫu nhiên tốt cho chiều cao nút"],
      complexity: { time: "O(log N) kỳ vọng mỗi thao tác", space: "O(N) kỳ vọng", note: "Xấu nhất O(N) nhưng với xác suất cực nhỏ. Bộ nhớ ≈ N / (1 − p) con trỏ (p = 1/2 → ~2N)." },
      ops: [["Tìm (contains / lowerBound)", "O(log N) kỳ vọng"], ["Chèn", "O(log N) kỳ vọng"], ["Xoá", "O(log N) kỳ vọng"], ["Duyệt theo thứ tự", "O(N)"], ["Bộ nhớ", "O(N) kỳ vọng"]],
      use_case: ["Redis sorted set (ZSET) dùng skip list kèm bảng băm; memtable của LevelDB / RocksDB là skip list", "Java ConcurrentSkipListMap / ConcurrentSkipListSet cho map có thứ tự dùng nhiều luồng", "Bảng xếp hạng, chỉ mục trong bộ nhớ cần truy vấn khoảng và thứ tự", "Bài phỏng vấn: tự cài skip list (LeetCode 1206)"],
      not_for: ["Cần bảo đảm thời gian XẤU NHẤT → cây cân bằng (AVL, đỏ-đen, B-tree)", "Dữ liệu trên đĩa, cần ít lần đọc trang → B+ Tree", "Chỉ cần tra cứu theo khoá, không cần thứ tự → bảng băm", "Cần chen kề CPU cache tốt → cấu trúc dạng mảng/cây B nhỏ"],
      pitfalls: [
        "Chiều cao tối đa phải chặn (ví dụ 32) và sinh ngẫu nhiên với xác suất cố định, nếu không bộ nhớ và độ sâu thất thường.",
        "Quên cập nhật mảng update ở TẤT CẢ tầng thấp hơn chiều cao mới; hoặc quên gán head cho các tầng mới cao hơn level hiện tại.",
        "Xoá xong không hạ biến level khi tầng trên cùng rỗng làm tìm kiếm tốn tầng thừa.",
        "Chèn khoá trùng: quyết định rõ chính sách (bỏ qua, cập nhật hay cho phép trùng) trước khi nối nút.",
        "Rò bộ nhớ: phải giải phóng mọi nút (duyệt tầng 0) trong destructor; sao chép đối tượng cần cài lại hoặc cấm."
      ],
      code: {
        lang: "cpp", title: "skip_list.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Skip List: tập hợp có thứ tự các long long (khoá duy nhất). insert / erase / contains / lowerBound kỳ vọng O(log N).
// Mỗi nút được nâng thêm một tầng với xác suất 1/2 (chiều cao ngẫu nhiên, tối đa MAXL). Không an toàn đa luồng.
struct SkipList {
    static const int MAXL = 32;
    struct Node {
        long long key;
        vector<Node*> next;                    // next[i] = nút kế tiếp ở tầng i
        Node(long long k, int h) : key(k), next(h, nullptr) {}
    };
    Node* head;                                // nút đầu giả, có MAXL tầng
    int level = 1;                             // số tầng đang dùng
    size_t cnt = 0;
    mt19937 rng{20260101};

    SkipList() : head(new Node(0, MAXL)) {}
    SkipList(const SkipList&) = delete;
    SkipList& operator=(const SkipList&) = delete;
    ~SkipList() {
        for (Node* p = head; p;) { Node* q = p->next[0]; delete p; p = q; }
    }

    int randomHeight() {
        int h = 1;
        while (h < MAXL && (rng() & 1)) h++;
        return h;
    }
    // upd[i] = nút cuối cùng ở tầng i có khoá < key; trả về nút đầu tiên có khoá >= key (hoặc nullptr)
    Node* findPath(long long key, Node** upd) const {
        Node* x = head;
        for (int i = level - 1; i >= 0; i--) {
            while (x->next[i] && x->next[i]->key < key) x = x->next[i];
            if (upd) upd[i] = x;
        }
        return x->next[0];
    }
    bool contains(long long key) const {
        Node* x = findPath(key, nullptr);
        return x && x->key == key;
    }
    // khoá nhỏ nhất >= key, hoặc nullptr
    const long long* lowerBound(long long key) const {
        Node* x = findPath(key, nullptr);
        return x ? &x->key : nullptr;
    }
    bool insert(long long key) {
        Node* upd[MAXL] = {};
        Node* x = findPath(key, upd);
        if (x && x->key == key) return false;
        int h = randomHeight();
        if (h > level) {
            for (int i = level; i < h; i++) upd[i] = head;
            level = h;
        }
        Node* n = new Node(key, h);
        for (int i = 0; i < h; i++) { n->next[i] = upd[i]->next[i]; upd[i]->next[i] = n; }
        cnt++;
        return true;
    }
    bool erase(long long key) {
        Node* upd[MAXL] = {};
        Node* x = findPath(key, upd);
        if (!x || x->key != key) return false;
        for (int i = 0; i < level; i++)
            if (upd[i]->next[i] == x) upd[i]->next[i] = x->next[i];
        delete x;
        while (level > 1 && !head->next[level - 1]) level--;
        cnt--;
        return true;
    }
    size_t size() const { return cnt; }
};
`
      },
      example: {
        input: "Chèn lần lượt 3, 6, 7, 9, 12, 19, 17.\ncontains(17), contains(5), lowerBound(8), rồi erase(9) và lowerBound(8).",
        output: "contains(17) = true, contains(5) = false, lowerBound(8) = 9; sau erase(9): lowerBound(8) = 12",
        explain: "Kết quả không phụ thuộc chiều cao ngẫu nhiên của từng nút (ngẫu nhiên chỉ ảnh hưởng tốc độ, không ảnh hưởng đúng sai). Tầng 0 luôn là danh sách có thứ tự 3, 6, 7, 9, 12, 17, 19; lowerBound(8) là khoá nhỏ nhất ≥ 8 nên là 9; sau khi xoá 9 là 12."
      },
      problems: [{ site: "lc", id: "1206", name: "Design Skiplist" }],
      related: ["lru-cache", "b-plus-tree", "lsm-tree", "treap", "ordered-set"],
      compare: { "Mục đích": "Tập/bản đồ có thứ tự trong bộ nhớ, truy vấn khoảng", "Đánh đổi": "Cài đặt gọn, dễ làm đồng thời; chỉ bảo đảm kỳ vọng O(log N), kém thân thiện cache CPU", "Dùng trong": "Redis ZSET, memtable LevelDB/RocksDB, Java ConcurrentSkipListMap" },
      cards: [
        { q: "Skip list cân bằng bằng cách nào?", a: "Không xoay hay tái cân bằng: mỗi nút được nâng tầng ngẫu nhiên với xác suất 1/2, nên số nút giảm một nửa theo mỗi tầng và tìm kiếm kỳ vọng O(log N)." },
        { q: "Bảo đảm thời gian của skip list là gì?", a: "Kỳ vọng O(log N) cho tìm/chèn/xoá; xấu nhất vẫn O(N) nhưng với xác suất cực nhỏ. Cây cân bằng mới có bảo đảm xấu nhất." },
        { q: "Vì sao skip list hay được dùng cho cấu trúc đồng thời?", a: "Chèn/xoá chỉ sửa vài con trỏ cục bộ (không xoay cả cây) nên dễ khoá nhỏ hoặc dùng CAS; ví dụ ConcurrentSkipListMap." },
        { q: "Hai hệ thống thật dùng skip list?", a: "Redis sorted set (ZSET) và memtable của LevelDB/RocksDB." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ b-plus-tree
    {
      id: "b-plus-tree",
      name: "B+ Tree",
      aliases: ["b+ tree", "b plus tree", "cây b+", "b tree", "cây b", "chỉ mục csdl", "database index", "innodb index", "page index"],
      category: "sys",
      sub: "Lưu trữ & chỉ mục",
      level: 4,
      tags: ["database", "b-plus-tree", "index", "disk", "tree", "storage-engine"],
      summary: "Cây tìm kiếm nhiều nhánh, mọi bản ghi nằm ở các lá nối thành danh sách; chiều cao rất thấp nên mỗi truy vấn chỉ cần vài lần đọc trang đĩa, quét khoảng đọc tuần tự.",
      description:
        "B+ tree là cây cân bằng với **độ phân nhánh rất lớn** (hàng trăm con mỗi nút, vừa một trang đĩa 4–16 KB). **Nút trong** chỉ chứa khoá phân cách để dẫn đường; **mọi cặp (khoá, giá trị)** nằm ở **lá**, và các lá được nối thành danh sách liên kết theo thứ tự khoá. Mọi lá cùng độ sâu nên mọi truy vấn tốn đúng chiều cao cây lần đọc trang — với độ phân nhánh cỡ vài trăm, 3–4 tầng chứa hàng tỉ bản ghi, mà tầng trên cùng thường nằm sẵn trong bộ nhớ đệm.\n\n" +
        "**Chèn**: đi xuống lá, chèn theo thứ tự; lá vượt số khoá tối đa thì **tách** đôi, đẩy khoá phân cách (khoá nhỏ nhất của nửa phải, vẫn giữ ở lá) lên cha; cha tràn thì tách tiếp, khoá giữa đi lên; gốc tách thì cây cao thêm một tầng. **Xoá** đúng chuẩn: bỏ khoá khỏi lá, nếu lá thiếu nửa thì **mượn** từ anh em hoặc **gộp**, có thể lan lên. **Quét khoảng**: tìm lá chứa khoá đầu rồi đi theo liên kết lá — đọc tuần tự, đây là lợi thế so với cây băm và B-tree thường (B-tree lưu giá trị cả ở nút trong).\n\n" +
        "Mẫu dưới là cài đặt trong bộ nhớ với **xoá lười** (chỉ bỏ khỏi lá, không gộp nút; cây vẫn hợp lệ, chỉ không thu hồi chỗ trống, cách một số hệ quản trị cũng dùng). So với LSM-tree: B+ tree **ghi tại chỗ** nên đọc điểm/khoảng nhanh và ổn định, ghi ngẫu nhiên tốn nhiều hơn (đọc–sửa–ghi cả trang, khuếch đại ghi do WAL và trang); LSM thiên về ghi.",
      conditions: ["Khoá có thứ tự toàn phần", "Dữ liệu lớn hơn bộ nhớ (hoặc cần cấu trúc thân thiện với trang đĩa)", "Cần cả tra điểm lẫn quét khoảng theo khoá"],
      complexity: { time: "O(log_B N) lần đọc trang mỗi thao tác", space: "O(N)", note: "B = độ phân nhánh (số khoá mỗi nút, cỡ trăm). Trong bộ nhớ mỗi nút còn tốn O(log B) khi tìm nhị phân trong nút. Quét k phần tử: O(log_B N + k / B) lần đọc trang." },
      ops: [["Tra điểm", "O(log_B N)"], ["Chèn (tách nút khi tràn)", "O(log_B N)"], ["Xoá", "O(log_B N)"], ["Quét khoảng k phần tử", "O(log_B N + k)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Chỉ mục mặc định của các CSDL quan hệ: MySQL InnoDB (chỉ mục cụm theo khoá chính là một B+ tree), PostgreSQL (chỉ mục btree, biến thể của B+ tree)", "Bài toán đọc nhiều hơn ghi, cần tra điểm và quét khoảng theo khoá ổn định", "Hệ tệp và kho lưu trữ khoá–giá trị trên đĩa cần số lần đọc trang tối thiểu"],
      not_for: ["Tải ghi rất lớn, chủ yếu thêm mới → LSM-tree (ghi tuần tự)", "Chỉ cần tra điểm theo khoá, không cần thứ tự → bảng băm", "Dữ liệu vừa trong RAM và cần cài đặt gọn → Skip List hoặc cây cân bằng (std::map)"],
      pitfalls: [
        "Quy ước khoá phân cách: khoá bằng khoá phân cách đi sang NHÁNH PHẢI; nhầm chiều làm tìm sai lá (dùng upper_bound để chọn con).",
        "Tách lá: khoá phân cách được SAO CHÉP lên (vẫn nằm ở lá); tách nút trong: khoá giữa ĐI LÊN và không còn ở nút nào thấp hơn.",
        "Quên nối lại con trỏ next của lá khi tách làm hỏng quét khoảng.",
        "Xoá lười để lại lá rỗng và nút trong thừa; cần thu gom định kỳ nếu dữ liệu bị xoá nhiều.",
        "Chọn kích thước nút không khớp trang đĩa làm mỗi truy vấn đọc nhiều trang; chọn theo kích thước trang."
      ],
      code: {
        lang: "cpp", title: "bplus_tree.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// B+ Tree trong bộ nhớ: khoá long long duy nhất -> giá trị long long. MAXK = số khoá tối đa mỗi nút (thực tế vài trăm, vừa một trang đĩa).
// Mọi cặp (khoá, giá trị) nằm ở LÁ; các lá nối thành danh sách (quét khoảng). Nút trong chỉ có khoá phân cách:
// kids[i] chứa các khoá k với keys[i-1] <= k < keys[i]. Xoá LƯỜI: chỉ bỏ khỏi lá, không gộp/mượn nút (cây vẫn đúng).
template <int MAXK = 64>
struct BPlusTree {
    struct Node {
        bool leaf = true;
        vector<long long> keys;
        vector<long long> vals;        // chỉ ở lá: vals[i] ứng với keys[i]
        vector<Node*> kids;            // chỉ ở nút trong: kids.size() == keys.size() + 1
        Node* next = nullptr;          // lá kế tiếp
    };
    Node* root = new Node();
    size_t cnt = 0;

    BPlusTree() {}
    BPlusTree(const BPlusTree&) = delete;
    BPlusTree& operator=(const BPlusTree&) = delete;
    ~BPlusTree() { destroy(root); }
    static void destroy(Node* x) {
        for (Node* c : x->kids) destroy(c);
        delete x;
    }
    static size_t childIndex(const Node* x, long long k) {   // khoá == phân cách đi sang nhánh phải
        return upper_bound(x->keys.begin(), x->keys.end(), k) - x->keys.begin();
    }
    Node* leafFor(long long k) const {
        Node* x = root;
        while (!x->leaf) x = x->kids[childIndex(x, k)];
        return x;
    }

    const long long* find(long long k) const {
        Node* x = leafFor(k);
        auto it = lower_bound(x->keys.begin(), x->keys.end(), k);
        if (it == x->keys.end() || *it != k) return nullptr;
        return &x->vals[it - x->keys.begin()];
    }
    // mọi cặp (khoá, giá trị) với lo <= khoá <= hi, theo thứ tự khoá: đi theo liên kết giữa các lá
    vector<pair<long long, long long>> range(long long lo, long long hi) const {
        vector<pair<long long, long long>> out;
        for (Node* x = leafFor(lo); x; x = x->next) {
            for (size_t i = lower_bound(x->keys.begin(), x->keys.end(), lo) - x->keys.begin(); i < x->keys.size(); i++) {
                if (x->keys[i] > hi) return out;
                out.push_back({x->keys[i], x->vals[i]});
            }
        }
        return out;
    }
    bool erase(long long k) {                                   // xoá lười
        Node* x = leafFor(k);
        auto it = lower_bound(x->keys.begin(), x->keys.end(), k);
        if (it == x->keys.end() || *it != k) return false;
        x->vals.erase(x->vals.begin() + (it - x->keys.begin()));
        x->keys.erase(it);
        cnt--;
        return true;
    }
    void insert(long long k, long long v) {                     // khoá đã có thì ghi đè giá trị
        long long upKey = 0;
        Node* upNode = nullptr;
        if (insertRec(root, k, v, upKey, upNode)) {             // gốc bị tách: cây cao thêm một tầng
            Node* nr = new Node();
            nr->leaf = false;
            nr->keys = {upKey};
            nr->kids = {root, upNode};
            root = nr;
        }
    }
    // true nếu x bị tách: (upKey, upNode) = khoá phân cách đẩy lên cha và nút phải mới
    bool insertRec(Node* x, long long k, long long v, long long& upKey, Node*& upNode) {
        if (x->leaf) {
            size_t i = lower_bound(x->keys.begin(), x->keys.end(), k) - x->keys.begin();
            if (i < x->keys.size() && x->keys[i] == k) { x->vals[i] = v; return false; }
            x->keys.insert(x->keys.begin() + i, k);
            x->vals.insert(x->vals.begin() + i, v);
            cnt++;
            if ((int)x->keys.size() <= MAXK) return false;
            Node* r = new Node();                               // tách lá: nửa phải sang nút mới
            size_t mid = x->keys.size() / 2;
            r->keys.assign(x->keys.begin() + mid, x->keys.end());
            r->vals.assign(x->vals.begin() + mid, x->vals.end());
            x->keys.resize(mid);
            x->vals.resize(mid);
            r->next = x->next;
            x->next = r;
            upKey = r->keys[0];                                 // SAO CHÉP khoá nhỏ nhất của nửa phải lên cha
            upNode = r;
            return true;
        }
        size_t i = childIndex(x, k);
        long long sk = 0;
        Node* sn = nullptr;
        if (!insertRec(x->kids[i], k, v, sk, sn)) return false;
        x->keys.insert(x->keys.begin() + i, sk);
        x->kids.insert(x->kids.begin() + i + 1, sn);
        if ((int)x->keys.size() <= MAXK) return false;
        size_t mid = x->keys.size() / 2;                        // tách nút trong: khoá giữa ĐI LÊN
        Node* r = new Node();
        r->leaf = false;
        upKey = x->keys[mid];
        r->keys.assign(x->keys.begin() + mid + 1, x->keys.end());
        r->kids.assign(x->kids.begin() + mid + 1, x->kids.end());
        x->keys.resize(mid);
        x->kids.resize(mid + 1);
        upNode = r;
        return true;
    }
    size_t size() const { return cnt; }
};
`
      },
      example: {
        input: "BPlusTree<4> (tối đa 4 khoá mỗi nút). Chèn khoá 1, 2, 3, 4, 5 (giá trị tuỳ ý), rồi range(2, 4).",
        output: "Gốc [3]; hai lá [1,2] → [3,4,5]; range(2, 4) = khoá 2, 3, 4",
        explain: "Sau 4 lần chèn, lá [1,2,3,4] còn vừa. Chèn 5 làm lá có 5 khoá > 4 nên tách: nửa trái [1,2], nửa phải [3,4,5]; khoá nhỏ nhất của nửa phải (3) được sao chép lên làm khoá phân cách ở gốc mới. range(2,4): descend tới lá [1,2] (2 < 3), lấy 2, rồi theo liên kết sang lá [3,4,5] lấy 3, 4 và dừng khi gặp 5 > 4."
      },
      problems: [],
      related: ["lsm-tree", "skip-list", "bloom-filter", "treap", "ordered-set"],
      compare: { "Mục đích": "Chỉ mục có thứ tự trên đĩa: tra điểm và quét khoảng", "Đánh đổi": "Đọc ổn định, ít lần đọc trang; ghi ngẫu nhiên tốn hơn LSM (ghi tại chỗ, tách/gộp trang)", "Dùng trong": "MySQL InnoDB, PostgreSQL (btree)" },
      cards: [
        { q: "Khác biệt giữa B+ tree và B-tree?", a: "B+ tree chỉ lưu giá trị ở lá, nút trong chỉ có khoá dẫn đường; các lá nối thành danh sách nên quét khoảng tuần tự. B-tree lưu giá trị cả ở nút trong." },
        { q: "Chiều cao B+ tree với độ phân nhánh cỡ vài trăm và hàng tỉ bản ghi?", a: "Chỉ 3–4 tầng, nên mỗi truy vấn tốn vài lần đọc trang (tầng trên thường nằm sẵn trong bộ nhớ đệm). Độ phức tạp O(log_B N)." },
        { q: "Khi lá bị tràn thì khoá nào đi lên cha?", a: "Khoá nhỏ nhất của nửa phải, được SAO CHÉP lên (vẫn nằm ở lá). Khi nút trong tràn, khoá giữa đi lên và không còn ở nút nào thấp hơn." },
        { q: "Khi nào chọn LSM-tree thay vì B+ tree?", a: "Khi tải ghi rất nặng và chủ yếu là thêm mới: LSM ghi tuần tự vào memtable/SSTable. B+ tree hợp khi đọc điểm/khoảng là chính." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ lsm-tree
    {
      id: "lsm-tree",
      name: "LSM Tree",
      aliases: ["lsm", "lsm tree", "log-structured merge tree", "memtable", "sstable", "compaction", "nén lsm", "write-optimized"],
      category: "sys",
      sub: "Lưu trữ & chỉ mục",
      level: 4,
      tags: ["database", "lsm-tree", "storage-engine", "write-optimized", "compaction", "sstable"],
      summary: "Cấu trúc lưu trữ tối ưu ghi: ghi vào memtable trong RAM, flush thành các tệp đã sắp xếp bất biến, nền gộp (compaction) chúng; xoá bằng tombstone.",
      description:
        "LSM-tree biến mọi ghi ngẫu nhiên thành **ghi tuần tự**. Đường ghi: ghi nhật ký **WAL** (để khôi phục) rồi vào **memtable** (cấu trúc có thứ tự trong RAM, ví dụ skip list). Khi memtable đầy nó được **flush** thành một **run bất biến đã sắp xếp** trên đĩa (SSTable). Các run cũ dần được **compaction** (gộp kiểu merge): với cùng khoá, bản **mới** thắng; **tombstone** (dấu xoá) chỉ được bỏ khi gộp xuống run cũ nhất, vì cần che bản cũ ở dưới.\n\n" +
        "```\n" +
        "ghi ─► WAL (nhật ký tuần tự)\n" +
        "   └─► memtable (RAM, có thứ tự) ── đầy ──► flush\n" +
        "                                             ▼\n" +
        "  run mới nhất  (SSTable bất biến, đã sắp xếp)   ◄── đọc: memtable → run mới → run cũ\n" +
        "  run cũ hơn    ...                                  (Bloom filter mỗi run loại nhanh)\n" +
        "  run lớn nhất  ◄── compaction: gộp các run, bản mới thắng, bỏ tombstone ở đáy\n" +
        "```\n\n" +
        "**Đường đọc**: tra memtable, rồi các run từ mới tới cũ; bản đầu tiên tìm thấy (kể cả tombstone) quyết định kết quả. Vì phải xem nhiều run nên dùng **Bloom filter** theo từng run và chỉ mục thưa. Đánh đổi gọi là **khuếch đại**: *ghi* (một byte được ghi lại nhiều lần qua các lần compaction), *đọc* (xem nhiều run), *không gian* (nhiều bản cũ chưa dọn). **Leveled** compaction (RocksDB mặc định) đọc/không gian tốt, ghi tốn nhiều hơn; **size-tiered** (Cassandra mặc định) ghi rẻ, đọc/không gian tệ hơn.\n\n" +
        "Mẫu dưới gộp hai run mới nhất khi run mới không còn nhỏ hơn hẳn run cũ (kích thước tăng theo cấp số nhân, nên chỉ có O(log N) run), cùng quy tắc tombstone và bản mới thắng. Chưa có WAL, Bloom filter, quét khoảng (cần k-way merge qua các run) hay lưu đĩa.",
      conditions: ["Tải ghi lớn (hầu hết là thêm/ghi đè), có thể chấp nhận đọc chậm hơn B+ tree", "Có tiến trình nền chịu được chi phí compaction", "Khoá có thứ tự (để run sắp xếp và gộp được)"],
      complexity: { time: "Ghi O(log M) vào memtable (+ nén nền); đọc O(L · log N)", space: "O(N) cộng bản cũ chưa dọn", note: "M = kích thước memtable, N = tổng số mục, L = số run (O(log N) nếu compaction theo cấp số nhân). Khuếch đại ghi cỡ O(L) hoặc hơn tuỳ chiến lược." },
      ops: [["Ghi (put/erase) vào memtable", "O(log M)"], ["Đọc điểm (qua L run)", "O(L · log N)"], ["Flush memtable", "O(M)"], ["Compaction hai run", "O(tổng kích thước)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["LevelDB, RocksDB, Cassandra, HBase, ScyllaDB và nhiều công cụ lưu trữ khoá–giá trị / chuỗi thời gian", "Luồng ghi nhật ký, sự kiện, metric: hàng trăm nghìn ghi mỗi giây, ít đọc lại", "Khi ổ đĩa ghi tuần tự nhanh hơn ghi ngẫu nhiên nhiều (HDD, hoặc để giảm hao mòn SSD)"],
      not_for: ["Đọc điểm/khoảng là chính, ghi ít → B+ Tree (đọc ổn định, ít khuếch đại đọc)", "Cần độ trễ đọc cực ổn định, không chịu được gợn do compaction → B+ Tree", "Dữ liệu nhỏ vừa RAM → Skip List / cây cân bằng"],
      pitfalls: [
        "Tombstone không được bỏ khi gộp ở giữa: nếu bỏ sớm, bản cũ của khoá ở run dưới “sống lại”; chỉ bỏ khi gộp thành run CŨ NHẤT.",
        "Đọc phải đi từ mới tới cũ và dừng ở bản đầu tiên (kể cả tombstone); quên kiểm tombstone trả về giá trị đã xoá.",
        "Compaction không theo kịp tốc độ ghi gây ngập run (read amplification tăng, rồi hệ thống phải làm chậm ghi — write stall).",
        "Khuếch đại ghi làm hao mòn SSD và chiếm băng thông đĩa: cần đo, chọn leveled hay size-tiered theo tải.",
        "Quên WAL: mất memtable khi hỏng máy trước lần flush; cần ghi nhật ký rồi mới nhận ghi."
      ],
      code: {
        lang: "cpp", title: "lsm_tree.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// LSM-tree tối giản trong bộ nhớ: memtable (map) + các "run" bất biến đã sắp xếp (giống SSTable). Xoá = ghi tombstone (nullopt).
// runs[0] là MỚI nhất. Sau mỗi flush, gộp hai run mới nhất khi run mới * fanout >= run cũ -> kích thước tăng theo cấp số nhân, O(log N) run.
// Gộp: cùng khoá thì bản MỚI thắng; tombstone chỉ bị bỏ khi kết quả là run CŨ NHẤT (không còn bản cũ nào bên dưới cần che).
// Chưa có WAL, Bloom filter, quét khoảng, lưu đĩa.
struct LSMTree {
    typedef optional<long long> Val;                 // nullopt = tombstone
    typedef vector<pair<long long, Val>> Run;        // tăng dần theo khoá, khoá duy nhất
    size_t memLimit;
    int fanout;
    map<long long, Val> mem;
    vector<Run> runs;

    explicit LSMTree(size_t memtableLimit = 4, int fanoutFactor = 2) : memLimit(memtableLimit), fanout(fanoutFactor) {}

    void put(long long k, long long v) { mem[k] = v; maybeFlush(); }
    void erase(long long k) { mem[k] = nullopt; maybeFlush(); }   // tombstone phải ghi đè bản cũ ở các run dưới

    optional<long long> get(long long k) const {
        auto it = mem.find(k);
        if (it != mem.end()) return it->second;                   // kể cả tombstone: nullopt = đã xoá
        for (const Run& r : runs) {                               // từ mới tới cũ: bản đầu tiên tìm thấy là bản đúng
            auto p = lower_bound(r.begin(), r.end(), k, [](const pair<long long, Val>& e, long long key) { return e.first < key; });
            if (p != r.end() && p->first == k) return p->second;
        }
        return nullopt;
    }
    void maybeFlush() { if (mem.size() >= memLimit) flush(); }
    void flush() {                                                // memtable -> run mới nhất, rồi gộp (compaction)
        if (mem.empty()) return;
        runs.insert(runs.begin(), Run(mem.begin(), mem.end()));
        mem.clear();
        while (runs.size() >= 2 && runs[0].size() * fanout >= runs[1].size()) {
            bool bottom = runs.size() == 2;                       // kết quả sẽ là run cũ nhất -> được bỏ tombstone
            runs[1] = mergeRuns(runs[0], runs[1], bottom);
            runs.erase(runs.begin());
        }
    }
    static Run mergeRuns(const Run& newer, const Run& older, bool dropTombstones) {
        Run out;
        size_t i = 0, j = 0;
        while (i < newer.size() || j < older.size()) {
            const pair<long long, Val>* e;
            if (j == older.size() || (i < newer.size() && newer[i].first <= older[j].first)) {
                if (j < older.size() && older[j].first == newer[i].first) j++;   // trùng khoá: bỏ bản cũ
                e = &newer[i++];
            } else {
                e = &older[j++];
            }
            if (dropTombstones && !e->second) continue;
            out.push_back(*e);
        }
        return out;
    }
};
`
      },
      example: {
        input: "LSMTree(memtableLimit = 2, fanout = 2). put(1,10), put(2,20), put(1,11), erase(2), rồi get(1), get(2).",
        output: "get(1) = 11, get(2) = không có; còn đúng 1 run: {1 → 11}",
        explain: "put(1,10), put(2,20) làm memtable đạt 2 mục nên flush thành run A = {1:10, 2:20}. put(1,11) và erase(2) (tombstone) lại đủ 2 mục nên flush thành run B = {1:11, 2:tombstone}. Run B (2 mục × 2 ≥ 2) được gộp với A; kết quả là run cũ nhất nên tombstone của khoá 2 được bỏ và bản 11 của khoá 1 thắng 10: {1:11}."
      },
      problems: [],
      related: ["b-plus-tree", "bloom-filter", "skip-list", "merkle-tree"],
      compare: { "Mục đích": "Lưu trữ khoá–giá trị tối ưu ghi (ghi tuần tự, nén nền)", "Đánh đổi": "Ghi rẻ; đọc phải qua nhiều run (cần Bloom filter); khuếch đại ghi và không gian; có gợn khi compaction", "Dùng trong": "LevelDB, RocksDB, Cassandra, HBase" },
      cards: [
        { q: "Vì sao LSM-tree ghi nhanh?", a: "Mọi ghi chỉ vào WAL (tuần tự) và memtable trong RAM; dữ liệu xuống đĩa theo lô dưới dạng run sắp xếp, không ghi ngẫu nhiên tại chỗ." },
        { q: "Tombstone dùng để làm gì và khi nào được bỏ?", a: "Đánh dấu một khoá đã xoá để che các bản cũ ở run dưới. Chỉ được bỏ khi gộp xuống run cũ nhất, nếu không bản cũ sẽ “sống lại”." },
        { q: "Đường đọc của LSM-tree?", a: "Tra memtable rồi các run từ mới tới cũ, dừng ở bản đầu tiên tìm thấy (kể cả tombstone). Bloom filter theo run giúp bỏ qua các run chắc chắn không có khoá." },
        { q: "Khuếch đại ghi / đọc / không gian trong LSM nghĩa là gì?", a: "Ghi: một byte bị ghi lại nhiều lần qua compaction. Đọc: phải xem nhiều run. Không gian: bản cũ chưa dọn chiếm chỗ. Leveled và size-tiered đánh đổi ba thứ này khác nhau." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ merkle-tree
    {
      id: "merkle-tree",
      name: "Merkle Tree",
      aliases: ["merkle tree", "cây merkle", "hash tree", "cây băm", "merkle proof", "anti-entropy", "đồng bộ bản sao"],
      category: "sys",
      sub: "Cấu trúc xác thực",
      level: 3,
      tags: ["hashing", "merkle-tree", "verification", "distributed", "anti-entropy", "integrity"],
      summary: "Cây băm: lá là băm dữ liệu, nút trong là băm của hai con; gốc đại diện toàn bộ dữ liệu, chứng minh một phần tử thuộc cây chỉ cần O(log N) băm.",
      description:
        "Mỗi **lá** là băm của một khối dữ liệu; mỗi **nút trong** là băm của (băm con trái, băm con phải); **gốc** là chữ ký của toàn bộ dữ liệu. Đổi bất kỳ khối nào làm đổi mọi băm trên đường lên gốc. Hai ứng dụng chính: **(1) Chứng minh thuộc tập (Merkle proof)**: để chứng tỏ khối i nằm trong dữ liệu có gốc R, chỉ cần gửi các băm **anh em** dọc đường từ lá i lên gốc — O(log N) băm; người kiểm băm dần lên và so với R. **(2) So sánh hai bản sao**: so hai gốc, nếu khác thì đi xuống nhánh nào có băm khác để tìm đúng khoá lệch mà không so toàn bộ dữ liệu (anti-entropy).\n\n" +
        "Điểm an toàn cần nhớ: dùng **tiền tố phân biệt lá và nút trong** (domain separation) để không thể giả một nút trong thành lá; và dùng băm **an toàn mật mã** (SHA-256…) khi cần chống giả mạo. Mẫu dưới dùng băm 64 bit KHÔNG an toàn mật mã chỉ để minh hoạ cấu trúc và để kiểm thử; nút lẻ ở mỗi tầng được **giữ nguyên lên tầng trên** (cách khác: nhân đôi nút cuối như Bitcoin, nhưng cách đó có điểm yếu: hai danh sách giao dịch khác nhau có thể cho cùng gốc).\n\n" +
        "Thực tế: Git lưu đối tượng dưới dạng đồ thị băm (cây băm tổng quát hoá), Bitcoin băm giao dịch của mỗi khối thành một gốc Merkle để client nhẹ (SPV) xác minh một giao dịch bằng proof, Cassandra và Dynamo dùng cây Merkle để đồng bộ bản sao, Certificate Transparency dùng cây Merkle làm nhật ký chỉ-thêm.",
      conditions: ["Có hàm băm tốt (an toàn mật mã nếu cần chống giả mạo)", "Dữ liệu chia được thành các khối có thứ tự cố định", "Hai bên so sánh phải dùng cùng hàm băm, cùng cách chia khối và cùng cách xử lý nút lẻ"],
      complexity: { time: "Dựng O(N); proof và kiểm proof O(log N)", space: "O(N)", note: "N = số lá. Cập nhật một lá: O(log N) băm lại đường lên gốc nếu giữ cây trong bộ nhớ." },
      ops: [["Dựng cây", "O(N)"], ["Tạo proof cho một lá", "O(log N)"], ["Kiểm proof", "O(log N)"], ["Cập nhật một lá", "O(log N)"], ["Bộ nhớ", "O(N)"]],
      use_case: ["Đồng bộ bản sao (anti-entropy) giữa các nút: Cassandra repair, bài báo Dynamo của Amazon", "Chứng minh giao dịch thuộc khối: Bitcoin (client nhẹ SPV), Certificate Transparency", "Git và các hệ lưu trữ địa chỉ theo nội dung dùng đồ thị băm cùng ý tưởng", "Tải tệp lớn theo khối từ nguồn không tin cậy, kiểm từng khối bằng proof"],
      not_for: ["Chỉ cần biết hai tệp có giống nhau hay không → một băm toàn tệp là đủ", "Cần kiểm tra thuộc tập xác suất, tiết kiệm bộ nhớ → Bloom filter", "Dữ liệu thay đổi liên tục từng byte và cần cập nhật rẻ → cân nhắc băm có thể cập nhật dần hoặc cây Merkle thưa (Sparse Merkle tree)"],
      pitfalls: [
        "Không phân biệt lá và nút trong khi băm: kẻ tấn công có thể trình một nút trong như một lá (second-preimage). Thêm tiền tố khác nhau khi băm.",
        "Nhân đôi nút lẻ cuối (kiểu Bitcoin) làm [a,b,c] và [a,b,c,c] cho cùng gốc — cần quy tắc khác hoặc kiểm tra thêm.",
        "Hai bên dùng thứ tự khối hoặc cách xử lý nút lẻ khác nhau sẽ ra gốc khác nhau dù dữ liệu giống nhau.",
        "Dùng băm không an toàn mật mã (như mẫu 64 bit) cho mục đích bảo mật: dễ tìm va chạm. Thực tế dùng SHA-256.",
        "Quên rằng proof chỉ chứng minh thuộc cây với gốc đã biết; gốc phải đến từ nguồn tin cậy."
      ],
      code: {
        lang: "cpp", title: "merkle_tree.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Merkle Tree: dựng gốc, tạo và kiểm chứng proof (O(log N)). Nút lẻ ở mỗi tầng được giữ nguyên lên tầng trên.
// Hàm băm 64 bit dưới đây CHỈ để minh hoạ (không an toàn mật mã); thực tế dùng SHA-256. Lá và nút trong dùng
// tiền tố khác nhau (domain separation) để không thể giả nút trong thành lá.
struct MerkleTree {
    typedef uint64_t H;
    vector<vector<H>> lv;                       // lv[0] = băm các lá, lv.back() = {gốc}; rỗng nếu không có dữ liệu

    static H mix(H x) {                         // splitmix64 finalizer
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }
    static H leaf(const string& s) {
        H h = 1469598103934665603ULL;           // FNV-1a rồi trộn bit
        for (unsigned char c : s) { h ^= c; h *= 1099511628211ULL; }
        return mix(h ^ 0x01);                   // tiền tố 0x01: lá
    }
    static H node(H l, H r) { return mix(mix(l ^ 0xA5A5A5A5A5A5A5A5ULL) + r); }   // không giao hoán: node(l, r) != node(r, l)

    explicit MerkleTree(const vector<string>& data) {
        if (data.empty()) return;
        vector<H> cur;
        for (const string& s : data) cur.push_back(leaf(s));
        lv.push_back(cur);
        while (lv.back().size() > 1) {
            const vector<H>& c = lv.back();
            vector<H> nx;
            for (size_t i = 0; i < c.size(); i += 2)
                nx.push_back(i + 1 < c.size() ? node(c[i], c[i + 1]) : c[i]);   // nút lẻ: giữ nguyên
            lv.push_back(std::move(nx));
        }
    }
    H root() const { return lv.empty() ? 0 : lv.back()[0]; }

    struct Step { H sib; bool sibLeft; };       // băm anh em và anh em nằm bên trái hay phải
    // chứng minh lá idx thuộc cây: các băm anh em từ lá lên gốc (tầng không có anh em thì bỏ qua)
    vector<Step> proof(size_t idx) const {
        vector<Step> p;
        if (lv.empty() || idx >= lv[0].size()) return p;
        for (size_t l = 0; l + 1 < lv.size(); l++, idx >>= 1)
            if ((idx ^ 1) < lv[l].size()) p.push_back({lv[l][idx ^ 1], (idx & 1) == 1});
        return p;
    }
    static bool verify(const string& data, const vector<Step>& proof, H root) {
        H h = leaf(data);
        for (const Step& s : proof) h = s.sibLeft ? node(s.sib, h) : node(h, s.sib);
        return h == root;
    }
};
`
      },
      example: {
        input: "4 khối dữ liệu a, b, c, d. Chứng minh khối c thuộc cây có gốc R.",
        output: "Proof = [băm của d (anh em bên PHẢI), băm của nút ab (anh em bên TRÁI)] — 2 băm = log2 4",
        explain: "Cây: lá h(a), h(b), h(c), h(d); nút trong ab = node(h(a), h(b)) và cd = node(h(c), h(d)); gốc R = node(ab, cd). Với khối c: anh em ở tầng lá là h(d) (bên phải), anh em ở tầng trên là ab (bên trái). Người kiểm tính x = node(h(c), h(d)) rồi R' = node(ab, x) và so R' với R: bằng nhau thì c thuộc cây. Đổi d (hoặc bất kỳ khối nào) thì R' khác R."
      },
      problems: [],
      related: ["bloom-filter", "consistent-hashing", "vector-clock", "lsm-tree", "raft"],
      compare: { "Mục đích": "Xác thực toàn vẹn và so sánh nhanh dữ liệu lớn", "Đánh đổi": "Proof O(log N), tìm đúng chỗ lệch giữa hai bản sao; tốn thêm bộ nhớ O(N) băm và chi phí băm lại khi dữ liệu đổi", "Dùng trong": "Cassandra/Dynamo (anti-entropy), Bitcoin, Certificate Transparency, Git" },
      cards: [
        { q: "Merkle proof cho một lá gồm gì và dài bao nhiêu?", a: "Các băm anh em dọc đường từ lá lên gốc, dài O(log N). Người kiểm băm dần lên và so với gốc đã biết." },
        { q: "Cây Merkle giúp đồng bộ hai bản sao thế nào?", a: "So hai gốc; nếu khác thì xuống nhánh nào có băm khác để khoanh vùng khoá lệch, chỉ trao đổi O(số khoá lệch · log N) băm thay vì toàn bộ dữ liệu." },
        { q: "Vì sao cần tiền tố phân biệt lá và nút trong?", a: "Nếu băm giống nhau, kẻ tấn công trình một nút trong (hai băm nối lại) như một lá có dữ liệu giả cho cùng gốc (second-preimage)." },
        { q: "Đổi một lá thì những băm nào đổi?", a: "Chỉ các băm trên đường từ lá đó lên gốc: O(log N) nút, nên cập nhật một lá tốn O(log N)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ hyperloglog
    {
      id: "hyperloglog",
      name: "HyperLogLog",
      aliases: ["hyperloglog", "hll", "đếm phần tử phân biệt", "cardinality estimation", "count distinct", "ước lượng số phần tử khác nhau", "pfcount"],
      category: "sys",
      sub: "Cấu trúc xác suất",
      level: 4,
      tags: ["probabilistic", "hyperloglog", "cardinality", "count-distinct", "hashing", "sketch"],
      summary: "Ước lượng số phần tử PHÂN BIỆT của một tập rất lớn chỉ với vài KB bộ nhớ, sai số chuẩn ≈ 1,04/√m, gộp (merge) được giữa nhiều máy.",
      description:
        "Ý tưởng: băm mỗi phần tử thành chuỗi bit ngẫu nhiên đều. Trong n phần tử phân biệt, xác suất có chuỗi bắt đầu bằng **k số 0** là 2^−k, nên **số 0 đầu dài nhất** đã thấy xấp xỉ log2 n. Một quan sát duy nhất rất nhiễu, nên HLL chia thành **m = 2^p nhóm**: p bit đầu của băm chọn nhóm j, phần còn lại cho `ρ` = (số bit 0 đầu + 1); thanh ghi `reg[j]` giữ **ρ lớn nhất** đã thấy ở nhóm j. Ước lượng là **trung bình điều hoà** của 2^reg[j]: `E = α·m² / Σ 2^(−reg[j])`.\n\n" +
        "Sai số chuẩn ≈ **1,04/√m**: p = 12 (m = 4096) cho ≈ 1,6% với 4096 thanh ghi; p = 14 (m = 16384) cho ≈ 0,81% — đây chính là cấu hình của Redis (12 KB khi đóng gói 6 bit mỗi thanh ghi; mẫu dưới dùng 1 byte nên 16 KB). Với tập nhỏ (E ≤ 2,5·m) dùng **linear counting** `m·ln(m / số thanh ghi bằng 0)` chính xác hơn. Vì hàm băm 64 bit nên không cần hiệu chỉnh vùng rất lớn; bản HLL++ còn thêm bảng hiệu chỉnh độ lệch ở vùng trung gian.\n\n" +
        "Hai tính chất then chốt cho hệ phân tán: **lặp không ảnh hưởng** (thêm cùng phần tử nhiều lần không đổi thanh ghi — đếm *phân biệt* đúng nghĩa), và **gộp được**: lấy max từng thanh ghi của hai sketch cho đúng sketch của hợp hai tập. Vì vậy mỗi máy giữ một sketch cục bộ và gộp khi cần (đếm người dùng duy nhất theo ngày, tuần…).",
      conditions: ["Chấp nhận ước lượng có sai số tương đối nhỏ thay vì số đếm chính xác", "Hàm băm 64 bit phân bố đều", "Cần bộ nhớ nhỏ cố định bất kể số phần tử"],
      complexity: { time: "O(1) mỗi add; O(m) mỗi lần ước lượng hoặc gộp", space: "O(m) với m = 2^p", note: "Sai số chuẩn ≈ 1,04/√m. Bộ nhớ không phụ thuộc số phần tử phân biệt n (chỉ phụ thuộc log log n cho độ rộng thanh ghi)." },
      ops: [["add", "O(1)"], ["Ước lượng", "O(m)"], ["Gộp hai sketch (max từng thanh ghi)", "O(m)"], ["Bộ nhớ", "O(m)"]],
      use_case: ["Đếm người dùng duy nhất / địa chỉ IP duy nhất / truy vấn duy nhất trên luồng dữ liệu khổng lồ", "Redis PFADD / PFCOUNT / PFMERGE (12 KB, sai số chuẩn 0,81%), BigQuery APPROX_COUNT_DISTINCT, Trino/Presto approx_distinct", "Thống kê trong CSDL (ước lượng số giá trị khác nhau của cột) để lập kế hoạch truy vấn", "Gộp số đếm duy nhất từ nhiều máy hay nhiều khoảng thời gian"],
      not_for: ["Cần số đếm CHÍNH XÁC → tập băm hoặc sắp xếp rồi đếm", "Cần kiểm tra một phần tử có thuộc tập hay không → Bloom filter", "Cần liệt kê phần tử hoặc xoá phần tử → HLL không làm được (chỉ đếm, không xoá)", "Tập nhỏ vài nghìn phần tử và cần đúng → hash set"],
      pitfalls: [
        "Hàm băm yếu hoặc không phân bố đều làm ước lượng lệch có hệ thống; dùng bộ trộn bit tốt (splitmix, murmur) trên khoá 64 bit.",
        "Dùng công thức thô cho tập nhỏ: sai lớn khi nhiều thanh ghi còn 0 — phải dùng linear counting cho E ≤ 2,5·m.",
        "Hai sketch khác p hoặc khác hàm băm KHÔNG gộp được.",
        "Sai số là THỐNG KÊ: ±1,04/√m là một độ lệch chuẩn (≈ 68% xác suất), ±3 lần cho ≈ 99,7%; đừng coi là cận chặt.",
        "Tính ρ khi phần còn lại bằng 0: __builtin_clzll(0) là hành vi không xác định, cần xử lý riêng."
      ],
      code: {
        lang: "cpp", title: "hyperloglog.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// HyperLogLog: ước lượng số phần tử phân biệt. m = 2^p thanh ghi (p trong [4, 18]); sai số chuẩn ~ 1.04 / sqrt(m).
// Khoá 64 bit (khoá khác: add(hash<string>{}(s))). Gộp hai sketch cùng p bằng merge. Mẫu dùng 1 byte/thanh ghi.
struct HyperLogLog {
    int p;
    size_t m;
    vector<uint8_t> reg;                 // reg[j] = rho lớn nhất đã thấy ở nhóm j

    explicit HyperLogLog(int precision = 12) : p(max(4, min(18, precision))), m((size_t)1 << p), reg(m, 0) {}

    static uint64_t mix(uint64_t x) {    // splitmix64 finalizer
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }
    void add(uint64_t x) {
        uint64_t h = mix(x);
        size_t j = h >> (64 - p);                    // p bit đầu chọn nhóm
        uint64_t w = h << p;                         // phần còn lại (64 - p bit, dồn lên đầu)
        uint8_t rho = (uint8_t)(w ? __builtin_clzll(w) + 1 : 64 - p + 1);
        reg[j] = max(reg[j], rho);
    }
    double estimate() const {
        double alpha = m == 16 ? 0.673 : m == 32 ? 0.697 : m == 64 ? 0.709 : 0.7213 / (1 + 1.079 / m);
        double sum = 0;
        size_t zeros = 0;
        for (uint8_t r : reg) { sum += ldexp(1.0, -(int)r); zeros += (r == 0); }
        double e = alpha * m * m / sum;              // trung bình điều hoà
        if (e <= 2.5 * m && zeros) e = m * log((double)m / zeros);   // tập nhỏ: linear counting
        return e;
    }
    void merge(const HyperLogLog& o) {               // hợp hai tập: lấy max từng thanh ghi (cùng p)
        for (size_t i = 0; i < m; i++) reg[i] = max(reg[i], o.reg[i]);
    }
};
`
      },
      example: {
        input: "HyperLogLog với p = 14 (m = 16384 thanh ghi). Thêm 1 000 000 phần tử PHÂN BIỆT (mỗi phần tử thêm nhiều lần cũng không sao). Hỏi estimate().",
        output: "≈ 1 000 000, sai số chuẩn ≈ 0,81% (khoảng ±8100); thường nằm trong ±3 · 0,81% ≈ ±2,4%",
        explain: "Sai số chuẩn = 1,04/√16384 = 1,04/128 ≈ 0,0081. Đó là một độ lệch chuẩn: ≈ 68% các lần chạy có ước lượng trong 1 000 000 ± 8 100 và ≈ 99,7% trong ± 24 400. Bộ nhớ chỉ 16 KB (12 KB nếu đóng gói 6 bit/thanh ghi) bất kể là 1 triệu hay 10 tỉ phần tử."
      },
      problems: [],
      related: ["bloom-filter", "consistent-hashing", "merkle-tree", "lfu-cache"],
      compare: { "Mục đích": "Ước lượng số phần tử phân biệt trong tập rất lớn", "Đánh đổi": "Vài KB cố định, sai số ~1,04/√m; không liệt kê, không xoá; gộp được giữa các máy", "Dùng trong": "Redis (PFCOUNT), BigQuery, Trino/Presto" },
      cards: [
        { q: "Sai số chuẩn của HyperLogLog?", a: "≈ 1,04/√m với m = 2^p thanh ghi: p = 12 → ~1,6%, p = 14 (cấu hình Redis) → ~0,81%." },
        { q: "Vì sao HLL đếm được phần tử PHÂN BIỆT mà thêm trùng không làm đổi kết quả?", a: "Cùng phần tử luôn băm ra cùng nhóm và cùng ρ; thanh ghi chỉ giữ max nên thêm lại không thay đổi gì." },
        { q: "Gộp hai sketch HLL bằng cách nào?", a: "Lấy max từng thanh ghi (cùng p, cùng hàm băm); kết quả đúng bằng sketch của hợp hai tập." },
        { q: "Khi nào dùng linear counting thay công thức trung bình điều hoà?", a: "Khi ước lượng nhỏ (E ≤ 2,5·m) và còn thanh ghi bằng 0: dùng m·ln(m / số thanh ghi bằng 0), chính xác hơn." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ raft
    {
      id: "raft",
      name: "Đồng thuận Raft",
      aliases: ["raft", "consensus", "đồng thuận", "replicated log", "log nhân bản", "leader election", "bầu leader", "etcd", "paxos"],
      category: "sys",
      sub: "Đồng thuận & giao dịch phân tán",
      level: 5,
      tags: ["distributed", "consensus", "raft", "replication", "leader-election", "fault-tolerance"],
      summary: "Giao thức đồng thuận cho một log được nhân bản: một leader được bầu nhận lệnh, nhân bản tới đa số và chỉ commit khi đa số đã lưu; chịu được hỏng tối đa f nút trong 2f + 1.",
      description:
        "Raft cho một nhóm máy (thường 3, 5 hoặc 7) cùng đồng ý về **một dãy lệnh có thứ tự (log)** để áp dụng vào một máy trạng thái, kể cả khi vài máy hỏng hoặc mạng bị chia cắt. Cụm gồm N = 2f + 1 nút chịu được **f nút hỏng** (3 → 1, 5 → 2); số nút chẵn không tăng khả năng chịu lỗi so với số lẻ liền trước. Mỗi nút luôn ở một trong ba vai trò, và thời gian chia thành các **term** (nhiệm kỳ, số nguyên tăng dần, như đồng hồ logic).\n\n" +
        "**Sơ đồ vai trò**:\n\n" +
        "```\n" +
        "Follower --(hết giờ bầu cử, không nghe leader/không bầu ai)--> Candidate\n" +
        "Candidate --(nhận phiếu của đa số)-----------------------------> Leader\n" +
        "Candidate --(thấy leader hợp lệ hoặc term lớn hơn)-------------> Follower\n" +
        "Candidate --(hết giờ, không ai thắng: chia phiếu)--------------> Candidate (term + 1)\n" +
        "Leader    --(thấy term lớn hơn)--------------------------------> Follower\n" +
        "```\n\n" +
        "**Bầu leader**: follower không nghe heartbeat (AppendEntries rỗng) trong **thời gian chờ ngẫu nhiên** (bài báo gợi ý 150–300 ms) thì tăng term, bỏ phiếu cho chính mình và gửi `RequestVote(term, lastLogIndex, lastLogTerm)`. Một nút bỏ phiếu cho ứng viên nếu term của ứng viên ≥ term của mình, nó chưa bỏ phiếu cho ai khác trong term đó, **và log của ứng viên ít nhất mới bằng log của nó** (so term của mục cuối trước, bằng nhau thì log dài hơn thắng). Được đa số phiếu → thành leader và gửi heartbeat ngay. Ngẫu nhiên hoá thời gian chờ làm chia phiếu hiếm và tự giải quyết.\n\n" +
        "**Nhân bản log**: client gửi lệnh tới leader; leader thêm mục `(term, lệnh)` vào log rồi gửi `AppendEntries(term, prevLogIndex, prevLogTerm, mục[], leaderCommit)` song song. Follower **từ chối** nếu log của nó không có mục tại prevLogIndex với term prevLogTerm (kiểm tra *Log Matching*); leader khi đó lùi `nextIndex` của follower đó và thử lại, tới khi khớp thì follower xoá phần log lệch và nối mục mới. Một mục được **commit** khi đã lưu trên **đa số** nút; leader **chỉ tự đếm bản sao để commit mục thuộc term hiện tại**, mục term cũ được commit gián tiếp khi mục term mới đứng sau nó commit. Mục đã commit được áp dụng vào máy trạng thái theo đúng thứ tự.\n\n" +
        "**Bất biến an toàn**: *Election Safety* (mỗi term tối đa một leader), *Leader Append-Only* (leader không xoá/ghi đè log của mình), *Log Matching* (hai log có mục cùng index và term thì giống hệt nhau từ đầu tới đó), *Leader Completeness* (mục đã commit ở term T có mặt trong log của mọi leader term sau), *State Machine Safety* (không hai nút áp dụng hai lệnh khác nhau ở cùng index). **Trạng thái bền** (phải fsync trước khi trả lời RPC): currentTerm, votedFor, log[].\n\n" +
        "**Lỗi và chia cắt**: nhóm thiểu số bị cô lập không bầu được leader mới và không commit được gì; leader cũ ở phía thiểu số vẫn nghĩ mình là leader cho tới khi thấy term lớn hơn nhưng **không commit được**, nên khi mạng nối lại nó xuống follower và các mục chưa commit của nó bị ghi đè. Đọc nhất quán (linearizable) phải đi qua leader còn quyền (ReadIndex hoặc lease), không đọc cục bộ từ follower hay leader cũ. Mở rộng: **snapshot** để cắt log, **thay đổi thành viên** (joint consensus hoặc đổi từng nút một).\n\n" +
        "Không có mẫu code vì cài đặt đầy đủ (bầu cử, nhân bản log, lưu bền, mạng, snapshot) quá dài để dán vào một bài; các triển khai tham khảo: etcd/raft (Go), hashicorp/raft (Go), openraft (Rust), braft (C++).",
      conditions: ["Cụm N = 2f + 1 nút, mạng có thể mất/trễ/lặp gói nhưng không có nút lừa dối (không phải Byzantine)", "Mỗi nút có ổ lưu bền với fsync đáng tin cho term, phiếu bầu và log", "Đồng hồ không cần đồng bộ, nhưng cần thời gian chờ bầu cử lớn hơn độ trễ mạng điển hình"],
      complexity: { time: "O(N) tin nhắn mỗi lệnh; commit sau 1 vòng RTT tới đa số", space: "O(độ dài log) mỗi nút (cắt bằng snapshot)", note: "Leader gửi tới N−1 follower song song; độ trễ ghi ≈ một RTT tới đa số + một lần fsync. Bầu cử xong thường trong vài lần thời gian chờ." },
      ops: [["Một lệnh (leader → đa số)", "O(N) tin nhắn"], ["Bầu leader mới", "O(N) tin nhắn mỗi vòng"], ["Bộ nhớ (log)", "O(độ dài log)"]],
      use_case: ["Kho cấu hình / khoá phân tán cho cả cụm: etcd (nền của Kubernetes), Consul", "CSDL phân tán nhân bản theo khoảng khoá: CockroachDB, TiKV (mỗi vùng một nhóm Raft)", "Kafka KRaft thay ZooKeeper cho metadata của cluster", "Mọi hệ cần một log nhân bản nhất quán mạnh và có thể chịu hỏng một thiểu số nút"],
      not_for: ["Giao dịch nguyên tử trên NHIỀU kho độc lập → Two-Phase Commit (có thể kết hợp: mỗi kho là một nhóm Raft)", "Cần ưu tiên khả dụng khi chia cắt, chấp nhận nhất quán cuối cùng → nhân bản không leader với Vector Clock / CRDT", "Có nút độc hại (Byzantine) → các giao thức BFT (PBFT…), Raft không bảo vệ", "Thông lượng cực cao cần mọi nút ghi → phân mảnh nhiều nhóm Raft thay vì một nhóm lớn"],
      pitfalls: [
        "Commit mục của term cũ bằng cách đếm bản sao (không an toàn: có thể bị ghi đè sau đó): chỉ đếm cho mục term hiện tại, mục cũ commit gián tiếp.",
        "Không fsync currentTerm, votedFor, log trước khi trả lời RPC: sau khi khởi động lại nút có thể bỏ phiếu hai lần trong một term hoặc mất mục đã xác nhận.",
        "Thời gian chờ bầu cử không ngẫu nhiên hoặc quá gần độ trễ mạng gây chia phiếu lặp và bầu cử liên tục.",
        "Đọc trực tiếp từ leader cũ bị cô lập hoặc từ follower trả dữ liệu cũ; cần ReadIndex/lease để đọc tuyến tính.",
        "Số nút chẵn (ví dụ 4) chỉ chịu 1 nút hỏng, như 3 nút nhưng đắt hơn; dùng số lẻ."
      ],
      nocode: true,
      example: {
        input: "Cụm 5 nút A–E, term 1, leader A. Client gửi lệnh x = 1: A ghi vào log và gửi AppendEntries; B và C lưu và xác nhận, còn D và E bị mất kết nối nên chưa nhận. Sau đó A hỏng. D và E kết nối lại; cả D lẫn B đều hết giờ chờ bầu cử.",
        output: "Mục x = 1 ĐÃ commit (có trên A, B, C = 3 trên 5). Leader term 2 chắc chắn là B hoặc C; D và E không thể thắng; x = 1 không bị mất.",
        explain: "A đã có mục trên 3 nút (A, B, C) = đa số nên commit trước khi hỏng. Bầu cử term 2: D có log ngắn hơn (thiếu x = 1), nên B và C từ chối bỏ phiếu cho D (log của D cũ hơn); D chỉ có phiếu của chính nó và của E, tối đa 2 < 3 nên không thể thắng. B có log mới nhất nên nhận được phiếu của chính nó, C, D, E (D và E có log cũ hơn B nên bỏ phiếu cho B) → B thắng. B nhân bản x = 1 cho D và E. Đây là bất biến Leader Completeness: mục đã commit luôn có trong log của leader kế tiếp."
      },
      problems: [],
      related: ["two-phase-commit", "vector-clock", "consistent-hashing", "merkle-tree", "lsm-tree"],
      compare: { "Mục đích": "Đồng thuận một log nhân bản, nhất quán mạnh, chịu f lỗi trong 2f+1 nút", "Đánh đổi": "Mọi ghi qua leader và cần đa số trả lời (độ trễ ≥ 1 RTT + fsync); mất khả dụng ở phía thiểu số khi chia cắt", "Dùng trong": "etcd, Consul, CockroachDB, TiKV, Kafka KRaft" },
      cards: [
        { q: "Một mục log được commit trong Raft khi nào?", a: "Khi đã lưu trên đa số nút. Leader chỉ tự đếm bản sao để commit mục thuộc term hiện tại; mục term cũ commit gián tiếp khi mục term mới sau nó commit." },
        { q: "Quy tắc bỏ phiếu đảm bảo Leader Completeness thế nào?", a: "Nút chỉ bỏ phiếu cho ứng viên có log ít nhất mới bằng log của mình (term mục cuối lớn hơn, hoặc bằng và log dài hơn), nên leader mới luôn có mọi mục đã commit." },
        { q: "Cụm 5 nút chịu được tối đa bao nhiêu nút hỏng?", a: "2 nút (đa số = 3). Tổng quát N = 2f + 1 chịu f nút hỏng; 4 nút vẫn chỉ chịu 1." },
        { q: "Vì sao thời gian chờ bầu cử phải ngẫu nhiên?", a: "Để nhiều follower không cùng thành ứng viên một lúc gây chia phiếu lặp đi lặp lại; ngẫu nhiên khiến thường chỉ một nút hết giờ trước và thắng." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ two-phase-commit
    {
      id: "two-phase-commit",
      name: "Two-Phase Commit (2PC)",
      aliases: ["2pc", "two-phase commit", "two phase commit", "commit hai pha", "giao dịch phân tán", "distributed transaction", "xa transaction", "atomic commit"],
      category: "sys",
      sub: "Đồng thuận & giao dịch phân tán",
      level: 3,
      tags: ["distributed", "transaction", "two-phase-commit", "atomic-commit", "consensus", "database"],
      summary: "Giao thức để nhiều bên cùng COMMIT hoặc cùng ABORT một giao dịch: pha 1 hỏi bỏ phiếu, pha 2 thông báo quyết định; đảm bảo nguyên tử nhưng có thể bị chặn khi điều phối viên hỏng.",
      description:
        "2PC cho một **coordinator** và N **participant** (mỗi bên giữ một phần dữ liệu) cùng đi đến một kết cục duy nhất: *tất cả commit* hoặc *tất cả abort*. **Pha 1 (chuẩn bị)**: coordinator gửi PREPARE; mỗi participant kiểm tra có thể commit được không, nếu có thì **ghi log bền “prepared” rồi mới** trả YES (và từ đó **phải** giữ khoá, chờ quyết định); nếu không thì tự abort và trả NO. **Pha 2 (quyết định)**: nếu mọi phiếu YES coordinator **ghi quyết định COMMIT vào log bền (điểm không thể quay lại)** rồi gửi COMMIT; có NO hoặc hết giờ thì ghi ABORT và gửi ABORT. Participant thực hiện, ghi log, nhả khoá và gửi ACK.\n\n" +
        "```\n" +
        "Coordinator                         Participant i\n" +
        "   | -- PREPARE ------------------>  |  kiểm tra, ghi log \"prepared\" (bền), giữ khoá\n" +
        "   | <-- VOTE YES / NO -------------  |  NO => tự abort ngay\n" +
        "   | tất cả YES: ghi COMMIT vào log bền;  có NO/hết giờ: ghi ABORT\n" +
        "   | -- COMMIT / ABORT ------------>  |  thực hiện, nhả khoá, ghi log\n" +
        "   | <-- ACK -----------------------  |\n" +
        "Participant: INIT --YES--> READY --> COMMITTED | ABORTED     INIT --NO--> ABORTED\n" +
        "```\n\n" +
        "**An toàn (atomicity)**: không bao giờ có participant COMMITTED trong khi participant khác ABORTED, vì COMMIT chỉ được ghi khi mọi phiếu là YES và participant đã ở READY không được tự quyết. **Điểm yếu cốt lõi: bị CHẶN (blocking)**. Nếu coordinator hỏng sau khi mọi participant đã READY mà chưa ai biết quyết định, các participant READY **không được** tự commit hay abort (có thể bên kia đã nhận quyết định ngược lại) và phải giữ khoá chờ coordinator phục hồi. Nếu có participant đã biết kết cục (COMMITTED/ABORTED, hoặc đã bỏ phiếu NO nên ABORTED), các participant khác hỏi nhau (**giao thức kết thúc hợp tác**) và thoát được; bị chặn thật sự chỉ khi MỌI participant còn sống đều đang READY. Khi hồi phục, coordinator đọc log: có quyết định thì gửi lại; **chưa ghi quyết định thì abort** (presumed abort).\n\n" +
        "Chi phí: 2 vòng gọi (2 RTT), O(N) tin nhắn và ít nhất 2 lần ghi đĩa bền cho mỗi bên; khoá bị giữ qua cả hai pha nên giảm thông lượng. Cách giảm rủi ro chặn: nhân bản coordinator và participant bằng đồng thuận (Spanner chạy 2PC giữa các nhóm Paxos), hoặc dùng Saga (bù trừ) nếu chấp nhận nhất quán cuối cùng. 3PC giảm chặn nhưng giả định mạng đồng bộ nên ít dùng trong thực tế.",
      conditions: ["Các bên tham gia chấp nhận một coordinator và có log bền", "Có thể chịu giữ khoá qua hai vòng và chịu nguy cơ chặn khi coordinator hỏng", "Mạng có thể mất gói nhưng các nút phục hồi được từ log bền (không có nút Byzantine)"],
      complexity: { time: "O(N) tin nhắn, 2 vòng gọi (2 RTT)", space: "O(N) trạng thái bên coordinator", note: "Mỗi bên ghi bền ít nhất 2 lần (prepared và quyết định). Số tin nhắn: 4N trong trường hợp thành công (PREPARE, VOTE, COMMIT, ACK)." },
      ops: [["Pha 1: PREPARE + thu phiếu", "O(N) tin nhắn"], ["Pha 2: gửi quyết định + ACK", "O(N) tin nhắn"], ["Phục hồi coordinator", "O(N)"]],
      use_case: ["Giao dịch XA / JTA trên nhiều tài nguyên (nhiều CSDL, hàng đợi); MySQL XA, PostgreSQL PREPARE TRANSACTION", "Spanner và các CSDL phân tán: giao dịch chạm nhiều phân mảnh dùng 2PC giữa các nhóm đồng thuận", "Cập nhật nguyên tử hai hệ độc lập khi cả hai phải cùng thành công hoặc cùng thất bại", "Bài phỏng vấn System Design: giải thích vì sao 2PC chặn và các lựa chọn thay thế"],
      not_for: ["Cần chịu hỏng coordinator mà không chặn → đồng thuận (Raft/Paxos) cho coordinator hoặc Paxos Commit", "Giao dịch kéo dài qua nhiều dịch vụ, chấp nhận bù trừ → Saga", "Mạng chia cắt thường xuyên và cần khả dụng cao → thiết kế nhất quán cuối cùng (CRDT, Vector Clock)", "Chỉ một kho dữ liệu → giao dịch cục bộ, không cần 2PC"],
      pitfalls: [
        "Participant phải ghi bền “prepared” TRƯỚC khi trả YES; nếu không, sau khi khởi động lại nó có thể quên lời hứa và abort trong khi người khác commit.",
        "Coordinator phải ghi bền quyết định TRƯỚC khi gửi đi; nếu không, sau khi hỏng nó có thể quyết định ngược lại.",
        "Participant ở READY KHÔNG được tự abort khi hết giờ chờ (chỉ trước khi bỏ phiếu YES mới được); tự quyết định phá vỡ tính nguyên tử.",
        "Thông điệp quyết định phải gửi lại được và participant xử lý idempotent (nhận COMMIT hai lần không sao).",
        "Giữ khoá qua hai pha làm thông lượng thấp và tăng bế tắc; thời gian chặn có thể kéo dài cả phút."
      ],
      code: {
        lang: "cpp", title: "two_phase_commit.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Two-Phase Commit — MÔ PHỎNG giao thức trong một tiến trình, có "log bền" của coordinator và chèn lỗi coordinator.
// Participant: INIT -> READY (đã bỏ phiếu YES, KHÔNG được tự quyết) -> COMMITTED | ABORTED; bỏ phiếu NO thì tự abort ngay.
enum class PState { INIT, READY, COMMITTED, ABORTED };
enum class Decision { NONE, COMMIT, ABORT };

struct TwoPC {
    enum Crash { NONE, BEFORE_LOG, AFTER_LOG, MID_SEND };   // coordinator hỏng ở đâu (và chưa hồi phục)
    int n;
    vector<bool> yes;                  // phiếu mỗi participant sẽ bỏ
    vector<PState> st;
    Decision log = Decision::NONE;     // quyết định trong log bền của coordinator = điểm không thể quay lại

    explicit TwoPC(vector<bool> votes) : n(votes.size()), yes(votes), st(votes.size(), PState::INIT) {}

    // sent: số participant nhận được quyết định trước khi coordinator hỏng (chỉ dùng với MID_SEND)
    void run(Crash crash, int sent = 0) {
        bool all = true;
        for (int i = 0; i < n; i++) {                                   // PHA 1: PREPARE -> bỏ phiếu
            if (yes[i]) st[i] = PState::READY;                          // ghi log "prepared" bền rồi mới trả YES
            else { st[i] = PState::ABORTED; all = false; }              // NO: tự abort ngay, vì chưa hứa gì
        }
        if (crash == BEFORE_LOG) return;                                // chưa ghi quyết định: participant READY phải chờ
        log = all ? Decision::COMMIT : Decision::ABORT;                 // PHA 2: ghi quyết định bền TRƯỚC khi gửi
        if (crash == AFTER_LOG) return;
        for (int i = 0; i < n; i++) {
            if (crash == MID_SEND && i == sent) return;
            deliver(i);
        }
    }
    void deliver(int i) {                                               // idempotent: chỉ participant READY mới đổi
        if (st[i] == PState::READY) st[i] = (log == Decision::COMMIT) ? PState::COMMITTED : PState::ABORTED;
    }
    // Coordinator khởi động lại: chưa có quyết định trong log -> ABORT (presumed abort); rồi gửi lại cho mọi participant.
    void recover() {
        if (log == Decision::NONE) log = Decision::ABORT;
        for (int i = 0; i < n; i++) deliver(i);
    }
    // Giao thức kết thúc hợp tác khi coordinator đang hỏng: participant READY học kết cục từ participant đã kết thúc.
    // Trả về true nếu vẫn BỊ CHẶN (có participant READY mà không ai biết kết cục).
    bool cooperativeTermination() {
        bool anyCommit = false, anyAbort = false, anyReady = false;
        for (PState s : st) {
            anyCommit |= (s == PState::COMMITTED);
            anyAbort |= (s == PState::ABORTED);
            anyReady |= (s == PState::READY);
        }
        if (!anyReady) return false;
        if (!anyCommit && !anyAbort) return true;
        for (PState& s : st)
            if (s == PState::READY) s = anyCommit ? PState::COMMITTED : PState::ABORTED;
        return false;
    }
};
`
      },
      example: {
        input: "3 participant. Trường hợp (a): phiếu YES, YES, NO. (b): YES, YES, YES và coordinator hỏng NGAY sau pha 1, trước khi ghi quyết định. (c): YES, YES, YES, coordinator ghi COMMIT vào log rồi hỏng trước khi gửi cho ai.",
        output: "(a) cả ba ABORTED. (b) cả ba kẹt ở READY (bị chặn); khi coordinator hồi phục: ABORT (presumed abort). (c) cả ba kẹt ở READY (bị chặn); khi coordinator hồi phục: COMMIT.",
        explain: "(a) Participant bỏ NO tự abort; coordinator thấy NO nên ghi ABORT và gửi cho hai bên còn lại (hoặc hai bên đó học ABORT từ participant thứ ba qua giao thức hợp tác). (b) Cả ba đã hứa nhưng không ai biết quyết định, không ai được tự quyết nên chặn; log chưa có quyết định nên khi hồi phục coordinator abort. (c) Log đã có COMMIT nên khi hồi phục coordinator gửi lại COMMIT; trong lúc chờ các participant vẫn bị chặn và giữ khoá. Khác biệt giữa (b) và (c) chính là việc ghi log trước khi gửi."
      },
      problems: [],
      related: ["raft", "vector-clock", "consistent-hashing", "merkle-tree"],
      compare: { "Mục đích": "Commit nguyên tử giao dịch trên nhiều bên (tất cả commit hoặc tất cả abort)", "Đánh đổi": "2 vòng, giữ khoá lâu; BỊ CHẶN nếu coordinator hỏng khi mọi participant đã READY", "Dùng trong": "XA/JTA, PostgreSQL PREPARE TRANSACTION, Spanner (giữa các nhóm Paxos)" },
      cards: [
        { q: "Hai pha của 2PC?", a: "Pha 1: coordinator gửi PREPARE, participant ghi log prepared rồi trả YES/NO. Pha 2: nếu mọi phiếu YES coordinator ghi COMMIT bền rồi gửi COMMIT, ngược lại ABORT." },
        { q: "Vì sao 2PC có thể bị chặn?", a: "Nếu coordinator hỏng khi mọi participant đã READY và chưa ai biết quyết định, họ không được tự quyết (bên kia có thể đã nhận quyết định ngược) nên phải giữ khoá chờ coordinator phục hồi." },
        { q: "Participant phải làm gì TRƯỚC khi trả YES?", a: "Ghi bền log “prepared”: từ lúc này nó đã hứa sẽ commit được và không được tự abort, kể cả sau khi khởi động lại." },
        { q: "Khi coordinator hồi phục mà chưa ghi quyết định thì sao?", a: "Abort (presumed abort) — an toàn vì chưa ai nhận quyết định commit — rồi gửi ABORT cho mọi participant." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ vector-clock
    {
      id: "vector-clock",
      name: "Vector Clock",
      aliases: ["vector clock", "đồng hồ vector", "happens-before", "causality", "quan hệ nhân quả", "lamport clock", "version vector", "phát hiện xung đột phiên bản"],
      category: "sys",
      sub: "Thời gian & nhân quả",
      level: 3,
      tags: ["distributed", "vector-clock", "causality", "happens-before", "replication", "conflict-detection"],
      summary: "Mỗi tiến trình giữ một vector bộ đếm sự kiện của mọi tiến trình; so sánh hai vector cho biết sự kiện này xảy ra trước, sau hay ĐỒNG THỜI với sự kiện kia.",
      description:
        "Trong hệ phân tán không có đồng hồ chung đáng tin; ta dùng quan hệ **happens-before (→)**: a → b nếu a, b cùng một tiến trình và a trước b, hoặc a là gửi và b là nhận của cùng một thông điệp, hoặc bắc cầu. Hai sự kiện không có quan hệ nào là **đồng thời (concurrent)**. **Vector clock** của hệ N tiến trình là vector V[0..N−1]; V[i] = số sự kiện của tiến trình i mà ta biết. Quy tắc: tiến trình i **tăng V[i]** cho mỗi sự kiện cục bộ hoặc gửi (và đính kèm V vào thông điệp); khi **nhận** thông điệp mang vector U, lấy **max từng phần tử** `V[k] = max(V[k], U[k])` rồi tăng V[i].\n\n" +
        "So sánh: V ≤ W nếu mọi V[k] ≤ W[k]. **a → b khi và chỉ khi V(a) < W(b)** (≤ mọi phần tử và khác ít nhất một); nếu không ai ≤ ai thì a và b **đồng thời**; bằng nhau chỉ khi cùng một sự kiện. Đây là điều **đồng hồ Lamport** (một số nguyên) không làm được: Lamport chỉ bảo đảm a → b ⇒ L(a) < L(b) chứ không suy ngược lại, nên không phát hiện được đồng thời.\n\n" +
        "Ứng dụng: nhân bản không leader (nhiều nút nhận ghi độc lập khi bị chia cắt) cần biết hai phiên bản của một khoá là *bản mới thay bản cũ* (bỏ bản cũ) hay *đồng thời xung đột* (giữ cả hai để ứng dụng hoặc CRDT hoà giải). Giá phải trả: vector có kích thước O(N) (số tiến trình/nút ghi), có thể phình ra theo số client — nên hệ thống thật cắt tỉa hoặc dùng dotted version vector. Một số hệ chọn cách rẻ hơn nhưng có thể mất cập nhật: last-write-wins theo dấu thời gian (Cassandra).",
      conditions: ["Số tiến trình/nút ghi N biết trước hoặc có cách định danh ổn định", "Chấp nhận chi phí O(N) bộ nhớ trên mỗi sự kiện/phiên bản", "Mọi tiến trình tuân thủ đúng quy tắc tăng–gộp"],
      complexity: { time: "O(N) mỗi sự kiện và mỗi lần so sánh", space: "O(N) mỗi vector", note: "N = số tiến trình. Vector lớn dần theo số nút ghi — cắt tỉa hoặc dùng dotted version vector." },
      ops: [["Sự kiện cục bộ / gửi (tăng một phần tử)", "O(1)"], ["Nhận (gộp max + tăng)", "O(N)"], ["So sánh hai vector", "O(N)"], ["Bộ nhớ mỗi vector", "O(N)"]],
      use_case: ["Phát hiện xung đột phiên bản trong lưu trữ nhân bản không leader: Dynamo (giỏ hàng), Riak, Voldemort", "Gỡ lỗi / ghi vết hệ phân tán: xác định thứ tự nhân quả của các sự kiện", "Giao tiếp nhóm cần giao nhận theo thứ tự nhân quả (causal broadcast)", "Bài phỏng vấn: vì sao đồng hồ vật lý không đủ và khác Lamport clock ở đâu"],
      not_for: ["Chỉ cần một thứ tự toàn cục, không cần biết đồng thời → đồng hồ Lamport hoặc leader tuần tự (Raft)", "Có quá nhiều nút/client ghi → vector phình to; dùng dotted version vector hoặc hybrid logical clock", "Chấp nhận mất cập nhật, ưu tiên đơn giản → last-write-wins theo dấu thời gian"],
      pitfalls: [
        "Khi NHẬN thông điệp phải gộp max rồi mới tăng phần tử của mình; quên bước gộp làm mất thông tin nhân quả.",
        "Chỉ tăng phần tử CỦA MÌNH; tăng hộ phần tử người khác làm hỏng quan hệ so sánh.",
        "So sánh hai vector khác độ dài (nút mới gia nhập) cần quy ước phần tử thiếu bằng 0.",
        "Nhầm “không so sánh được” với lỗi: hai vector không ≤ nhau nghĩa là ĐỒNG THỜI — là kết quả hợp lệ cần hoà giải.",
        "Vector không bao giờ co lại: cần chiến lược cắt tỉa an toàn cho nút đã rời cụm."
      ],
      code: {
        lang: "cpp", title: "vector_clock.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Vector clock cho n tiến trình (đánh số 0..n-1). v[i] = số sự kiện của tiến trình i mà ta biết.
struct VectorClock {
    vector<int> v;
    explicit VectorClock(int n) : v(n, 0) {}

    // sự kiện cục bộ hoặc GỬI của tiến trình self; với gửi, đính kèm bản sao của vector vào thông điệp
    void tick(int self) { v[self]++; }
    // NHẬN thông điệp mang vector other: gộp max từng phần tử rồi tính nhận là một sự kiện của self
    void receive(int self, const VectorClock& other) {
        for (size_t k = 0; k < v.size(); k++) v[k] = max(v[k], other.v[k]);
        v[self]++;
    }

    enum Order { BEFORE, AFTER, EQUAL, CONCURRENT };
    // a BEFORE b  <=>  a -> b (a xảy ra trước b); CONCURRENT <=> không có quan hệ nhân quả. Hai vector cùng độ dài.
    static Order compare(const VectorClock& a, const VectorClock& b) {
        bool le = true, ge = true;                   // a <= b mọi phần tử? a >= b mọi phần tử?
        for (size_t k = 0; k < a.v.size(); k++) {
            if (a.v[k] > b.v[k]) le = false;
            if (a.v[k] < b.v[k]) ge = false;
        }
        if (le && ge) return EQUAL;
        if (le) return BEFORE;
        if (ge) return AFTER;
        return CONCURRENT;
    }
};
`
      },
      example: {
        input: "3 tiến trình P0, P1, P2, vector ban đầu [0,0,0].\nP0: sự kiện cục bộ e1, rồi gửi thông điệp m (sự kiện e2). P1: sự kiện cục bộ e3; sau đó NHẬN m (sự kiện e4). P2: sự kiện cục bộ e5.\nVector sau mỗi sự kiện, và so sánh e2 với e4, e3 với e2, e5 với e4.",
        output: "e1 = [1,0,0], e2 = [2,0,0] (đính kèm vào m), e3 = [0,1,0], e4 = [2,2,0], e5 = [0,0,1].\ne2 → e4 (trước); e3 và e2 đồng thời; e5 và e4 đồng thời; e3 → e4 (trước).",
        explain: "e4 nhận m mang [2,0,0]: gộp max với [0,1,0] cho [2,1,0], rồi tăng phần tử của P1: [2,2,0]. e2 = [2,0,0] ≤ e4 = [2,2,0] ở mọi phần tử và khác nên e2 → e4. e3 = [0,1,0] so với e2 = [2,0,0]: phần tử 0 nhỏ hơn nhưng phần tử 1 lớn hơn → không ≤ nhau → đồng thời. e5 = [0,0,1] so với e4: phần tử 2 lớn hơn nhưng phần tử 0, 1 nhỏ hơn → đồng thời. e3 = [0,1,0] ≤ e4 = [2,2,0] → e3 → e4 (cùng tiến trình P1)."
      },
      problems: [],
      related: ["raft", "two-phase-commit", "merkle-tree", "consistent-hashing"],
      compare: { "Mục đích": "Xác định quan hệ nhân quả: trước / sau / đồng thời giữa các sự kiện", "Đánh đổi": "Phát hiện được xung đột (đồng thời) mà Lamport clock không làm được; tốn O(N) bộ nhớ mỗi sự kiện và vector phình theo số nút", "Dùng trong": "Dynamo, Riak, Voldemort" },
      cards: [
        { q: "Quy tắc cập nhật vector clock khi gửi và khi nhận?", a: "Gửi/sự kiện cục bộ: tăng phần tử của mình, đính kèm vector. Nhận: gộp max từng phần tử với vector nhận được rồi tăng phần tử của mình." },
        { q: "Khi nào a xảy ra trước b theo vector clock?", a: "Khi V(a) ≤ V(b) ở mọi phần tử và khác ở ít nhất một phần tử. Nếu không vector nào ≤ vector kia thì a và b đồng thời." },
        { q: "Vector clock hơn đồng hồ Lamport ở điểm nào?", a: "Lamport chỉ bảo đảm a → b ⇒ L(a) < L(b), không suy ngược lại; vector clock cho điều kiện cần và đủ nên phát hiện được sự kiện đồng thời (xung đột)." },
        { q: "Vì sao Dynamo dùng vector clock cho giỏ hàng?", a: "Hai nút có thể nhận ghi độc lập khi chia cắt; vector clock cho biết một phiên bản là cũ hơn (bỏ) hay đồng thời (giữ cả hai để hoà giải) thay vì mất cập nhật như last-write-wins." }
      ]
    }
  ]);

  // ------------------------------------------------------------------------------------------------ kịch bản Quiz
  A.lib.scenarios([
    { id: "q-lru-cache-1",
      prompt: "Dịch vụ cần bộ nhớ đệm kết quả truy vấn tối đa 100 000 mục. Khi đầy phải đuổi mục không được truy cập lâu nhất. get và put đều phải O(1) và các khoá vừa được dùng thường sẽ được dùng lại trong thời gian ngắn.",
      answer: ["lru-cache"], also: [],
      wrong: ["lfu-cache", "heap", "skip-list", "bloom-filter"],
      why: "Đuổi mục lâu nhất chưa dùng với get/put O(1) chính là LRU (danh sách liên kết đôi + bảng băm). LFU đuổi theo tần suất chứ không theo độ mới; heap và skip list đều tốn O(log N); Bloom filter chỉ trả lời “có thể có” chứ không lưu giá trị.",
      level: 2 },
    { id: "q-lfu-cache-1",
      prompt: "Cache nội dung cho một trang tin: vài bài hot được đọc hàng nghìn lần mỗi giờ, thỉnh thoảng có bot đọc hàng loạt bài cũ, mỗi bài đúng một lần. Muốn bài hot ở lại cache lâu dài, không bị đẩy ra bởi đợt đọc-một-lần của bot, và thay thế phải O(1).",
      answer: ["lfu-cache"], also: [],
      wrong: ["lru-cache", "bloom-filter", "consistent-hashing", "rate-limiter"],
      why: "Cần ưu tiên giữ mục dùng NHIỀU (tần suất cao) và bỏ mục đọc một lần → LFU. LRU sẽ để bot đẩy các bài hot ra ngoài vì bot vừa truy cập các bài cũ. Bloom filter, băm nhất quán và giới hạn tốc độ không phải chính sách thay thế cache.",
      level: 3 },
    { id: "q-consistent-hashing-1",
      prompt: "Cụm 10 máy cache phân mảnh khoá bằng hash(key) mod 10. Khi thêm máy thứ 11 gần như mọi khoá đổi sang máy khác, hit rate tụt về gần 0 và CSDL phía sau quá tải. Muốn thêm hoặc bớt một máy chỉ làm di chuyển khoảng 1/N số khoá.",
      answer: ["consistent-hashing"], also: [],
      wrong: ["lru-cache", "merkle-tree", "bloom-filter", "hyperloglog"],
      why: "Băm nhất quán (vòng băm, thêm nút ảo) chỉ di chuyển cỡ 1/N khoá khi đổi số nút, còn hash mod N di chuyển gần như tất cả. LRU là chính sách thay thế bên trong một máy; Merkle tree, Bloom filter, HyperLogLog cũng dùng băm nhưng không dùng để định tuyến khoá tới máy.",
      level: 3 },
    { id: "q-bloom-filter-1",
      prompt: "Trình thu thập web đã duyệt 10^9 URL và với mỗi URL mới phải kiểm tra “đã duyệt chưa” trước khi tải. Chỉ có vài GB RAM, không đủ để lưu hết URL. Chấp nhận bỏ qua nhầm khoảng 1% URL mới (coi như đã duyệt), nhưng URL đã duyệt thì luôn phải được nhận ra là đã duyệt.",
      answer: ["bloom-filter"], also: [],
      wrong: ["hyperloglog", "lru-cache", "skip-list", "merkle-tree"],
      why: "Kiểm tra thuộc tập, tiết kiệm bộ nhớ, chấp nhận dương tính giả nhưng không âm tính giả → Bloom filter (khoảng 9,6 bit/URL cho 1%). HyperLogLog chỉ ĐẾM số phần tử phân biệt, không kiểm tra thành viên; LRU và skip list phải lưu từng khoá nên tốn RAM; Merkle tree để xác thực dữ liệu.",
      level: 2 },
    { id: "q-bloom-filter-2",
      prompt: "Một kho khoá–giá trị lưu dữ liệu trong hàng trăm tệp đã sắp xếp trên đĩa. Truy vấn một khoá KHÔNG tồn tại hiện phải mở nhiều tệp để chắc chắn khoá không có, rất chậm. Muốn mỗi tệp có một cấu trúc nhỏ trong RAM cho biết khoá “chắc chắn không có” để bỏ qua việc đọc tệp, chấp nhận thỉnh thoảng vẫn đọc thừa một tệp.",
      answer: ["bloom-filter"], also: [],
      wrong: ["skip-list", "hyperloglog", "merkle-tree", "b-plus-tree"],
      why: "Cần một phép “chắc chắn không có” rẻ, nhỏ, cho phép dương tính giả (đọc thừa) nhưng không bỏ sót → Bloom filter theo từng tệp (cách RocksDB/Cassandra giảm read amplification). Skip list và B+ tree lưu cả khoá nên không nhỏ; HyperLogLog đếm chứ không kiểm tra thành viên; Merkle tree để xác thực.",
      level: 2 },
    { id: "q-rate-limiter-1",
      prompt: "API công khai: mỗi khách tối đa trung bình 100 yêu cầu/phút nhưng cho phép dồn cục tới 20 yêu cầu liên tiếp ngay lập tức. Với hàng triệu khách, mỗi khách chỉ được tốn O(1) bộ nhớ và mỗi quyết định cho/từ chối phải O(1).",
      answer: ["rate-limiter"], also: [],
      wrong: ["lru-cache", "bloom-filter", "vector-clock", "skip-list"],
      why: "Giới hạn tốc độ trung bình nhưng cho burst, O(1) thời gian và bộ nhớ mỗi khoá → token bucket (mục Giới hạn tốc độ). LRU là cache, Bloom filter kiểm tra thuộc tập, vector clock xác định nhân quả, skip list là cấu trúc có thứ tự — không cái nào giới hạn lưu lượng.",
      level: 2 },
    { id: "q-skip-list-1",
      prompt: "Bảng xếp hạng trực tuyến trong bộ nhớ: thêm và xoá điểm số liên tục, tìm theo điểm, lấy các mục trong một khoảng điểm theo thứ tự. Nhóm muốn cấu trúc có thứ tự dễ cài hơn cây cân bằng (không phải xoay), dễ mở rộng cho nhiều luồng, và chấp nhận bảo đảm O(log N) kỳ vọng.",
      answer: ["skip-list"], also: ["ordered-set", "treap"],
      wrong: ["heap", "lru-cache", "bloom-filter", "dsu"],
      why: "Cần tập có thứ tự với truy vấn khoảng, O(log N) kỳ vọng, không xoay và dễ đồng thời → Skip List (Redis ZSET, ConcurrentSkipListMap). Ordered set hoặc Treap cũng chấp nhận được nhưng phải cài cân bằng. Heap không tìm/duyệt theo khoảng được; LRU, Bloom filter và DSU không phải cấu trúc có thứ tự.",
      level: 3 },
    { id: "q-b-plus-tree-1",
      prompt: "Bảng 10^9 dòng trên SSD của một ứng dụng đọc nhiều: khoảng 90% truy vấn là tra theo khoá chính hoặc quét một khoảng khoá liên tiếp, ghi ít và thường là cập nhật tại chỗ. Muốn mỗi truy vấn chỉ tốn vài lần đọc trang đĩa và quét khoảng đọc tuần tự các trang kề nhau.",
      answer: ["b-plus-tree"], also: [],
      wrong: ["lsm-tree", "skip-list", "bloom-filter", "merkle-tree"],
      why: "Đọc điểm và quét khoảng là chính, ghi ít → B+ tree (chiều cao thấp nên vài lần đọc trang, lá nối nhau để quét tuần tự, chính là chỉ mục của InnoDB/PostgreSQL). LSM-tree thiên về ghi nặng và đọc phải qua nhiều run; skip list nằm trong RAM; Bloom filter và Merkle tree không phải chỉ mục khoảng.",
      level: 3 },
    { id: "q-lsm-tree-1",
      prompt: "Hệ thống thu thập sự kiện nhận 200 000 lần ghi mỗi giây, hầu hết là thêm bản ghi mới và ít khi đọc lại. Ổ đĩa ghi tuần tự nhanh hơn ghi ngẫu nhiên rất nhiều. Chấp nhận đọc chậm hơn một chút và để một tiến trình nền gộp (compaction) dữ liệu.",
      answer: ["lsm-tree"], also: [],
      wrong: ["b-plus-tree", "skip-list", "merkle-tree", "hyperloglog"],
      why: "Ghi nặng, ghi tuần tự, chấp nhận compaction nền và đọc chậm hơn → LSM-tree (memtable + run bất biến). B+ tree ghi tại chỗ nên ghi ngẫu nhiên đắt; skip list chỉ là phần memtable trong RAM; Merkle tree và HyperLogLog không phải công cụ lưu trữ.",
      level: 3 },
    { id: "q-merkle-tree-1",
      prompt: "Hai bản sao của một kho 10^8 khoá ở hai trung tâm dữ liệu có thể lệch nhau vài khoá. Cần tìm CHÍNH XÁC các khoá khác nhau mà không phải gửi hay so toàn bộ dữ liệu qua mạng; muốn chi phí trao đổi cỡ O(số khoá lệch · log N).",
      answer: ["merkle-tree"], also: [],
      wrong: ["bloom-filter", "consistent-hashing", "hyperloglog", "vector-clock"],
      why: "So hai gốc băm rồi đi xuống nhánh băm khác nhau để khoanh vùng khoá lệch, chi phí O(số khoá lệch · log N) → Merkle tree (anti-entropy của Cassandra/Dynamo). Bloom filter cho dương tính giả nên có thể bỏ sót khoá lệch; băm nhất quán chỉ phân mảnh; HyperLogLog chỉ ước lượng số lượng; vector clock so sánh phiên bản, không so dữ liệu.",
      level: 3 },
    { id: "q-hyperloglog-1",
      prompt: "Đếm số người dùng duy nhất mỗi ngày từ luồng 10^10 sự kiện (một người xuất hiện nhiều lần). Chấp nhận sai số khoảng 1–2%, mỗi bộ đếm chỉ được vài KB bộ nhớ, và cần gộp bộ đếm của nhiều máy để ra con số toàn hệ thống.",
      answer: ["hyperloglog"], also: [],
      wrong: ["bloom-filter", "lru-cache", "skip-list", "heap"],
      why: "Đếm phần tử phân biệt xấp xỉ với bộ nhớ vài KB cố định và gộp được (max từng thanh ghi) → HyperLogLog. Bloom filter kiểm tra thành viên chứ không cho số đếm trực tiếp (số bit bật chỉ ước lượng thô); LRU, skip list và heap phải lưu từng phần tử nên không vừa vài KB.",
      level: 3 },
    { id: "q-raft-1",
      prompt: "Cần một cụm 5 nút lưu cấu hình dùng chung nhất quán mạnh: mọi nút thấy cùng dãy thay đổi theo cùng thứ tự, chịu được 2 nút hỏng, chỉ một nút (leader) nhận ghi và tự động bầu leader mới trong vài trăm mili-giây khi leader chết.",
      answer: ["raft"], also: [],
      wrong: ["two-phase-commit", "vector-clock", "consistent-hashing", "merkle-tree"],
      why: "Log nhân bản nhất quán mạnh, bầu leader tự động, chịu f lỗi trong 2f + 1 nút → Raft (etcd, Consul). 2PC cho commit nguyên tử nhưng coordinator hỏng thì chặn, không tự bầu thay thế; vector clock phát hiện xung đột chứ không tuần tự hoá; băm nhất quán phân mảnh; Merkle tree để xác thực.",
      level: 4 },
    { id: "q-two-phase-commit-1",
      prompt: "Một giao dịch phải cập nhật hai CSDL độc lập (đơn hàng và kho): hoặc cả hai cùng commit, hoặc cả hai cùng rollback. Có một bộ điều phối giao dịch trung tâm. Chấp nhận rủi ro bị chặn tạm thời nếu bộ điều phối hỏng giữa chừng, miễn không bao giờ có trạng thái một bên commit và một bên abort.",
      answer: ["two-phase-commit"], also: [],
      wrong: ["raft", "vector-clock", "consistent-hashing", "bloom-filter"],
      why: "Commit nguyên tử qua nhiều tài nguyên với một coordinator, chấp nhận chặn khi coordinator hỏng → Two-Phase Commit (XA). Raft nhân bản một log trong một nhóm nút chứ không điều phối commit giữa hai CSDL khác nhau; vector clock, băm nhất quán và Bloom filter không liên quan tới tính nguyên tử của giao dịch.",
      level: 3 },
    { id: "q-vector-clock-1",
      prompt: "Giỏ hàng được nhân bản trên nhiều nút, và khi mạng bị chia cắt hai nút có thể cùng nhận ghi độc lập vào một giỏ. Khi gộp lại cần phân biệt “bản này mới hơn bản kia nên bỏ bản cũ” với “hai bản được sửa đồng thời, xung đột cần hoà giải”. Không được dựa vào đồng hồ vật lý đồng bộ giữa các máy.",
      answer: ["vector-clock"], also: [],
      wrong: ["raft", "two-phase-commit", "merkle-tree", "consistent-hashing"],
      why: "Phân biệt được trước/sau với đồng thời mà không cần đồng hồ chung → Vector Clock (cách Dynamo xử lý giỏ hàng). Raft tuần tự hoá mọi ghi qua leader (không cho ghi độc lập khi chia cắt) nên không phải bài này; 2PC chặn khi chia cắt; Merkle tree và băm nhất quán không xác định quan hệ nhân quả giữa các phiên bản.",
      level: 3 }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
