package com.tranphuc8a.gemini_proxy.domain.vo.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.tranphuc8a.gemini_proxy.domain.exceptions.AppException;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ResponseError<T> implements Serializable {
    int statusCode;
    String userMessage;
    String devMessage;
    T data;

    public static<T> ResponseError<T> from(AppException e) {
        return ResponseError.<T>builder()
                .statusCode(e.getStatusCode().value())
                .userMessage(e.getUserMessage())
                .devMessage(e.getDevMessage())
                .data(null)
                .build();
    }
}
