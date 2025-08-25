package com.tranphuc8a.gemini_proxy.domain.models;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Conversation {
    String id;
    String name;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
    List<Message> messages;
}
