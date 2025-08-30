package com.tranphuc8a.gemini_proxy.domain.exceptions.user;

import org.springframework.http.HttpStatus;

public class BadRequestException extends UserException {
    public BadRequestException() {
        super(HttpStatus.BAD_REQUEST);
    }

    public BadRequestException(String userMessage) {
        super(HttpStatus.BAD_REQUEST, userMessage);
    }

    public BadRequestException(String userMessage, String devMessage) {
        super(HttpStatus.BAD_REQUEST, userMessage, devMessage);
    }
}
