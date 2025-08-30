-- Tạo database
CREATE DATABASE IF NOT EXISTS gemini_proxy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gemini_proxy;

-- Bảng conversations
CREATE TABLE IF NOT EXISTS conversations (
                                             id CHAR(36) NOT NULL PRIMARY KEY,        -- UUID (GUID)
    name VARCHAR(255) NOT NULL,              -- Tên conversation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng messages
CREATE TABLE IF NOT EXISTS messages (
                                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                        conversation_id CHAR(36) NOT NULL,
    role ENUM('USER','ASSISTANT') NOT NULL,
    content LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL, -- Nội dung lớn, hỗ trợ emoji, HTML, markdown
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm mock data vào conversations
INSERT INTO conversations (id, name) VALUES
                                         (UUID(), 'First Chat'),
                                         (UUID(), 'Tech Discussion'),
                                         (UUID(), 'General Conversation');

-- Lấy ID đầu tiên để tạo messages demo
SET @conv1 = (SELECT id FROM conversations LIMIT 1);

-- Thêm mock data vào messages
INSERT INTO messages (conversation_id, role, content) VALUES
                                                          (@conv1, 'USER', 'Hello! This is the **first** message with *markdown*! 😊'),
                                                          (@conv1, 'ASSISTANT', 'Hi there! Here is an HTML snippet: <b>Bold text</b>.'),
                                                          (@conv1, 'USER', 'Can you summarize this?');