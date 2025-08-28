package com.tranphuc8a.gemini_proxy.domain.exceptions;


import lombok.*;
import org.springframework.http.HttpStatus;

@Getter
@Setter
@Builder
public class AppException extends RuntimeException {
    private final HttpStatus statusCode;
    private final String userMessage;
    private final String devMessage;

    public AppException(HttpStatus statusCode) {
        this(statusCode, statusCode.getReasonPhrase());
    }

    public AppException(HttpStatus statusCode, String userMessage) {
        this(statusCode, userMessage, userMessage);
    }

    public AppException(HttpStatus statusCode, String userMessage, String devMessage) {
        this.statusCode = statusCode;
        this.userMessage = userMessage;
        this.devMessage = devMessage;
    }
}
