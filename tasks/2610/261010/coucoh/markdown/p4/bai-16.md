# Unit Test: Hàn thử biểu cho thiết kế

Trong kỹ thuật cơ khí, một thiết kế tốt là thiết kế mà các bộ phận có thể tháo rời và thay thế dễ dàng. Trong phần mềm, Unit Test chính là "hàn thử biểu" (nhiệt kế) nhạy bén nhất để đo lường độ linh hoạt đó. Nếu bạn thấy việc viết Unit Test cho một Class Java là một cực hình, đó không phải lỗi của công cụ Test, mà là tín hiệu đỏ cho thấy thiết kế của bạn đang gặp vấn đề nghiêm trọng về Coupling và Cohesion.

## Mục tiêu

*   Nhận diện mối quan hệ nhân quả giữa khả năng kiểm thử (Testability) và cấu trúc mã nguồn.
*   Phân tích các dấu hiệu của Tight Coupling và Low Cohesion thông qua quá trình viết Test.
*   Sử dụng Mockito để cô lập các phụ thuộc và hiểu giới hạn của việc giả lập.
*   Áp dụng tư duy TDD để ép buộc thiết kế hướng tới Loose Coupling ngay từ đầu.

## 1. Tại sao Tight Coupling khiến Unit Test trở nên bất khả thi?

Unit Test, theo định nghĩa, là kiểm thử một "đơn vị" mã nguồn trong sự cô lập. Khi một Class bị dính chặt (Tight Coupling) với các Concrete Class khác hoặc các tài nguyên bên ngoài (Database, File System, API), việc cô lập trở nên bất khả thi.

### Ví dụ về thiết kế "không thể test"

Giả sử bạn có một lớp `OrderService` khởi tạo trực tiếp các phụ thuộc bên trong Constructor:

```java
public class OrderService {
    private EmailSender emailSender = new EmailSender(); // Hard-coded dependency
    private DatabaseConnection db = new DatabaseConnection(); // Tight coupling

    public void checkout(Order order) {
        db.save(order);
        emailSender.send("Order Success");
    }
}
```

**Vấn đề khi viết Unit Test:**
1.  **Không thể Mock:** Bạn không thể thay thế `EmailSender` bằng một bản giả để tránh gửi email thật khi chạy test.
2.  **Hiệu ứng dây chuyền:** Để test `OrderService`, bạn buộc phải có một Database đang chạy. Nếu Database lỗi, Test của `OrderService` sẽ Fail dù logic của nó hoàn toàn đúng.
3.  **Tốc độ:** Test chạy chậm vì phải khởi tạo các kết nối mạng/DB thực tế.

### Bảng so sánh khả năng kiểm thử

| Đặc điểm | Tight Coupling (Khó Test) | Loose Coupling (Dễ Test) |
| :--- | :--- | :--- |
| **Khởi tạo** | Dùng từ khóa `new` bên trong Class | Dependency Injection qua Constructor |
| **Phụ thuộc** | Phụ thuộc vào Implementation cụ thể | Phụ thuộc vào Abstraction (Interface) |
| **Sự cô lập** | Phải chạy kèm toàn bộ hệ thống | Dễ dàng thay thế bằng Mock/Stub |
| **Tốc độ Test** | Chậm (do dính tới I/O) | Rất nhanh (chỉ chạy trên RAM) |

## 2. Dấu hiệu Cohesion thấp: Test case quá phức tạp

Nếu Coupling đo lường mối quan hệ bên ngoài, thì Cohesion đo lường sự tập trung bên trong. Một Class có Cohesion thấp (làm quá nhiều việc không liên quan) sẽ bộc lộ điểm yếu ngay khi bạn bắt đầu viết `@Test`.

### Dấu hiệu nhận biết qua Test

1.  **Setup quá cồng kềnh:** Bạn mất 50 dòng code chỉ để khởi tạo dữ liệu mẫu (Setup) cho một phương thức cần test.
2.  **Test Case "khổng lồ":** Một phương thức test phải kiểm tra quá nhiều kết quả đầu ra (Side effects) khác nhau.
3.  **Khó đặt tên Test:** Bạn không thể đặt tên ngắn gọn cho Test Case vì phương thức đó thực hiện cùng lúc: tính thuế, lưu kho, gửi thông báo và cập nhật log.

### Ví dụ minh họa

```java
// Class có Cohesion thấp
public class SuperProcessor {
    public void process(Data data) {
        // 1. Validate data
        // 2. Format data
        // 3. Calculate Tax
        // 4. Save to DB
    }
}
```

Khi viết test cho `process()`, bạn sẽ thấy mình đang viết một kịch bản kiểm thử cho cả 4 nhiệm vụ trên. Nếu logic tính thuế thay đổi, test case này hỏng. Nếu cấu trúc DB thay đổi, test case này cũng hỏng. Đây chính là biểu hiện của việc vi phạm Single Responsibility Principle (SRP).

## 3. Sử dụng Mockito để cô lập phụ thuộc

Trong Java, Mockito là công cụ mạnh mẽ nhất để bẻ gãy Tight Coupling trong quá trình Test. Nó giúp chúng ta tạo ra các "vật thế thân" cho các Interface.

### Quy trình cô lập với Mockito

```mermaid
graph LR
    A[Unit Test] --> B[Mock Object]
    B -- Giả lập hành vi --> C[Class Under Test]
    C -- Gọi phương thức --> B
    B -- Trả về giá trị giả --> C
```

**Ví dụ áp dụng Dependency Injection và Mocking:**

```java
// Thiết kế lại để đạt Loose Coupling
public class OrderService {
    private final NotificationService notifier;

    public OrderService(NotificationService notifier) {
        this.notifier = notifier;
    }

    public void processOrder(Order order) {
        // logic...
        notifier.notify(order.getCustomerEmail());
    }
}

// Trong Unit Test
@Test
void testProcessOrder_ShouldNotifyCustomer() {
    // 1. Arrange
    NotificationService mockNotifier = Mockito.mock(NotificationService.class);
    OrderService service = new OrderService(mockNotifier);
    Order order = new Order("test@example.com");

    // 2. Act
    service.processOrder(order);

    // 3. Assert (Verify)
    Mockito.verify(mockNotifier).notify("test@example.com");
}
```

**Lợi ích:** Chúng ta chỉ tập trung kiểm tra xem `OrderService` có gọi đúng hàm `notify` hay không, mà không quan tâm `NotificationService` gửi bằng Email, SMS hay Telegram. Đó chính là sức mạnh của việc tách biệt mối quan tâm.

## 4. TDD: Ép buộc thiết kế hướng tới Low Coupling

Test-Driven Development (TDD) không chỉ là một phương pháp kiểm thử, nó là một phương pháp thiết kế. Khi bạn viết Test trước khi viết Code thực tế, bạn bị đặt vào vị trí của **người sử dụng mã nguồn** (Client).

### Tại sao TDD giúp giảm Coupling?

Khi viết Test trước, bạn sẽ ngay lập tức cảm thấy sự đau khổ nếu Class định viết quá khó để khởi tạo. Để viết được dòng code `new MyClass(...)` trong Test, bạn sẽ tự động hướng tới việc:
1.  Giảm số lượng tham số đầu vào.
2.  Sử dụng Interface thay vì Class cụ thể để dễ Mock.
3.  Chia nhỏ các phương thức lớn thành các phương thức nhỏ, tập trung vào một nhiệm vụ duy nhất (Tăng Cohesion).

### Quy trình TDD thúc đẩy thiết kế

1.  **Red:** Viết một test case cho một chức năng nhỏ. Test này sẽ fail vì code chưa tồn tại.
2.  **Green:** Viết code tối thiểu để test pass. Lúc này bạn thường dùng Dependency Injection để dễ dàng đưa dữ liệu vào.
3.  **Refactor:** Tinh chỉnh code, tách các logic không liên quan ra các Class khác. Vì đã có Test bảo vệ, bạn tự tin tách nhỏ code để tăng Cohesion.

## Tóm tắt

*   **Khả năng kiểm thử (Testability)** tỉ lệ thuận với chất lượng thiết kế. Nếu code khó test, chắc chắn Coupling đang cao hoặc Cohesion đang thấp.
*   **Tight Coupling** làm cho Unit Test trở thành Integration Test (kiểm thử tích hợp), gây chậm trễ và khó xác định nguyên nhân lỗi.
*   **Low Cohesion** dẫn đến các bộ Test Case cồng kềnh, dễ gãy (fragile) và khó bảo trì.
*   **Mockito** là công cụ hỗ trợ, nhưng không nên lạm dụng để che đậy một thiết kế tồi. Nếu bạn phải mock quá nhiều, hãy xem xét việc tách nhỏ Class.
*   **TDD** là kỷ luật giúp duy trì sự cân bằng giữa Coupling và Cohesion ngay từ những dòng code đầu tiên.

## Câu hỏi tự kiểm tra

1. **Dấu hiệu nào trong đoạn code Unit Test cho thấy Class đang vi phạm Single Responsibility Principle (Cohesion thấp)?**
<details><summary>Đáp án</summary>Dấu hiệu rõ nhất là phần Setup (phương thức @Before hoặc đoạn khởi tạo) quá dài, phải chuẩn bị rất nhiều trạng thái cho nhiều đối tượng khác nhau, và một phương thức test phải Assert nhiều kết quả không liên quan đến nhau.</details>

2. **Nếu một Class sử dụng `static method` của một Class khác bên trong logic cốt lõi, điều này ảnh hưởng gì đến Unit Test?**
<details><summary>Đáp án</summary>Nó tạo ra Tight Coupling. Static methods rất khó để Mock (trừ khi dùng các công cụ đặc biệt như PowerMock), dẫn đến việc Unit Test bị phụ thuộc vào implementation của phương thức static đó, không thể cô lập hoàn toàn Class đang test.</details>

3. **Tại sao việc phụ thuộc vào Interface thay vì Concrete Class lại làm Unit Test chạy nhanh hơn?**
<details><summary>Đáp án</summary>Vì khi phụ thuộc vào Interface, ta có thể dùng Mockito để tạo ra các đối tượng giả lập (Mock) nằm hoàn toàn trên RAM. Các Concrete Class thường chứa logic nặng hoặc kết nối I/O (DB, Network) làm chậm quá trình thực thi Test.</details>