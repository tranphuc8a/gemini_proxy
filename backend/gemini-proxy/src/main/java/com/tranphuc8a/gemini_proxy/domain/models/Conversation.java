package com.tranphuc8a.gemini_proxy.domain.models;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Conversation {
    String id;
    String name;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
    @Builder.Default
    List<Message> messages = List.of();
}
