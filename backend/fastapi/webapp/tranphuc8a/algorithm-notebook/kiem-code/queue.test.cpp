// @TEMPLATE

// Thử RingDeque (dung lượng nhỏ để buộc quay vòng nhiều lần) với std::deque, và TwoStackQueue với std::queue:
// chuỗi thao tác ngẫu nhiên hợp lệ, so sánh toàn bộ nội dung sau mỗi bước.
int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 2000; iter++) {
        int cap = 1 + rng() % 8;
        RingDeque<int> rd(cap);
        deque<int> ref;
        for (int step = 0; step < 200; step++) {
            int op = rng() % 5;
            int x = (int)(rng() % 1000);
            if (op == 0 && (int)ref.size() < cap) { rd.push_back(x); ref.push_back(x); }
            else if (op == 1 && (int)ref.size() < cap) { rd.push_front(x); ref.push_front(x); }
            else if (op == 2 && !ref.empty()) { rd.pop_front(); ref.pop_front(); }
            else if (op == 3 && !ref.empty()) { rd.pop_back(); ref.pop_back(); }
            if ((int)ref.size() != rd.size() || ref.empty() != rd.empty()) { printf("SAI kích thước iter=%d\n", iter); return 1; }
            for (int i = 0; i < (int)ref.size(); i++)
                if (rd[i] != ref[i]) { printf("SAI phần tử iter=%d step=%d i=%d\n", iter, step, i); return 1; }
            if (!ref.empty() && (rd.front() != ref.front() || rd.back() != ref.back())) { puts("SAI front/back"); return 1; }
        }
    }
    for (int iter = 0; iter < 2000; iter++) {
        TwoStackQueue<int> q;
        queue<int> ref;
        for (int step = 0; step < 200; step++) {
            int op = rng() % 3;
            if (op == 0 || ref.empty()) { int x = rng() % 1000; q.push(x); ref.push(x); }
            else if (op == 1) { q.pop(); ref.pop(); }
            if ((int)ref.size() != q.size() || ref.empty() != q.empty()) { puts("SAI kích thước hàng đợi hai stack"); return 1; }
            if (!ref.empty() && q.front() != ref.front()) { printf("SAI front iter=%d step=%d\n", iter, step); return 1; }
        }
    }
    // ca lớn: 10^6 phần tử đẩy rồi lấy ra đúng thứ tự (FIFO)
    int n = 1000000;
    RingDeque<int> rd(n);
    TwoStackQueue<int> q;
    for (int i = 0; i < n; i++) { rd.push_back(i); q.push(i); }
    for (int i = 0; i < n; i++) {
        if (rd.front() != i || q.front() != i) { puts("SAI ca lớn"); return 1; }
        rd.pop_front();
        q.pop();
    }
    if (!rd.empty() || !q.empty()) { puts("SAI: phải rỗng"); return 1; }
    puts("OK");
}
