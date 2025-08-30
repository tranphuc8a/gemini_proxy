# Gemini Proxy

---

## English

### Project Overview

Gemini Proxy is a project that builds a chatbot connecting to Google Gemini via a backend proxy. Its goal is to manage conversation history, send requests to Gemini, and display responses to users via a web interface.

### Project Components

#### 1. Database

* **Technology**: MariaDB
* **Function**:

  * Store conversation information, including chat history, messages, and related metadata.
  * Support backend queries and management for sending requests to Gemini and returning results.

#### 2. Backend

* **Technology**: Spring Boot
* **Function**:

  * CRUD operations on conversations.
  * Receive messages from the frontend.
  * Retrieve conversation history from the database, call Google Gemini API, and return the results to the frontend.
  * Manage sessions and user identification if needed.

#### 3. Frontend

* **Technology**: React.js
* **Function**:

  * Build a Q\&A interface with the chatbot.
  * Send user input to the backend.
  * Display Gemini’s responses and conversation history.

### Project Structure (Suggested)

```
gemini-proxy/
├─ backend/         # Spring Boot backend
├─ frontend/        # React.js frontend
├─ database/        # Scripts, migrations, database.sql
└─ README.md
```

### Quick Start

1. **Database**

   * Install MariaDB.
   * Import `database.sql` into the database.

2. **Backend**

   * Configure `application.properties` for database and other settings.
   * Run Spring Boot application (`mvn spring-boot:run` or build jar).

3. **Frontend**

   * Install dependencies: `npm install`
   * Run the app: `npm start`

4. **Access**

   * Open browser at `http://localhost:<frontend-port>` to interact with the chatbot.

### Technology Stack

* **Database**: MariaDB
* **Backend**: Java 17, Spring Boot
* **Frontend**: React.js
* **Testing**: JUnit, JaCoCo
* **Code Style**: Checkstyle

---

## Tiếng Việt

### Mục tiêu dự án

Gemini Proxy là một dự án xây dựng chatbot kết nối tới Google Gemini thông qua backend proxy. Mục tiêu là quản lý lịch sử trò chuyện, gửi yêu cầu tới Gemini và hiển thị câu trả lời cho người dùng thông qua giao diện web.

### Thành phần dự án

#### 1. Database

* **Công nghệ**: MariaDB
* **Chức năng**:

  * Lưu trữ thông tin cuộc trò chuyện, bao gồm lịch sử chat, tin nhắn và metadata liên quan.
  * Hỗ trợ backend truy vấn và quản lý dữ liệu để gửi yêu cầu tới Gemini và trả kết quả về.

#### 2. Backend

* **Công nghệ**: Spring Boot
* **Chức năng**:

  * CRUD các cuộc trò chuyện.
  * Nhận tin nhắn từ frontend.
  * Lấy lịch sử trò chuyện từ database, gọi API Google Gemini, và trả kết quả về frontend.
  * Quản lý session và định danh người dùng nếu cần.

#### 3. Frontend

* **Công nghệ**: React.js
* **Chức năng**:

  * Xây dựng giao diện hỏi đáp với chatbot.
  * Gửi yêu cầu từ người dùng tới backend.
  * Hiển thị câu trả lời của Gemini và lịch sử trò chuyện.

### Cấu trúc thư mục dự kiến

```
gemini-proxy/
├─ backend/         # Spring Boot backend
├─ frontend/        # React.js frontend
├─ database/        # Scripts, migrations, database.sql
└─ README.md
```

### Hướng dẫn triển khai nhanh

1. **Database**

   * Cài đặt MariaDB.
   * Import file `database.sql` vào cơ sở dữ liệu.

2. **Backend**

   * Cấu hình `application.properties` cho database và các tham số cần thiết.
   * Chạy ứng dụng Spring Boot (`mvn spring-boot:run` hoặc build jar).

3. **Frontend**

   * Cài đặt dependencies: `npm install`
   * Chạy ứng dụng: `npm start`

4. **Truy cập**

   * Mở trình duyệt tại `http://localhost:<frontend-port>` để tương tác với chatbot.

### Công nghệ sử dụng

* **Database**: MariaDB
* **Backend**: Java 17, Spring Boot
* **Frontend**: React.js
* **Kiểm thử**: JUnit, JaCoCo
* **Quản lý style code**: Checkstyle
