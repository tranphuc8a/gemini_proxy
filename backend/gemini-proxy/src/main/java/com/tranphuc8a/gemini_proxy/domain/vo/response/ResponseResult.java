package com.tranphuc8a.gemini_proxy.domain.vo.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ResponseResult<T> implements Serializable {
    int statusCode;
    String userMessage;
    String devMessage;
    T data;

    public static <T> ResponseResult<T> from(T data, String userMessage) {
        return ResponseResult.<T>builder()
                .statusCode(HttpStatus.OK.value())
                .userMessage(userMessage)
                .devMessage(userMessage)
                .data(data)
                .build();
    }

    public static <T> ResponseResult<T> from(T data) {
        return ResponseResult.<T>builder()
                .statusCode(HttpStatus.OK.value())
                .userMessage(HttpStatus.OK.getReasonPhrase())
                .devMessage(HttpStatus.OK.getReasonPhrase())
                .data(data)
                .build();
    }
}
