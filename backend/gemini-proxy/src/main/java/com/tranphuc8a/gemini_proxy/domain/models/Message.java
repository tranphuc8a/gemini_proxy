package com.tranphuc8a.gemini_proxy.domain.models;

import com.tranphuc8a.gemini_proxy.domain.enums.Role;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Message {
    Integer id;
    Conversation conversation;
    Role role;
    String content;
    LocalDateTime createdAt;
}
