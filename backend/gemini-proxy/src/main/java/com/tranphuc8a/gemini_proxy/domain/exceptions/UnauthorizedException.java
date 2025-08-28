package com.tranphuc8a.gemini_proxy.domain.exceptions;

import org.springframework.http.HttpStatus;

public class UnauthorizedException extends UserException {
    public UnauthorizedException() {
        super(HttpStatus.UNAUTHORIZED);
    }

    public UnauthorizedException(String userMessage) {
        super(HttpStatus.UNAUTHORIZED, userMessage);
    }

    public UnauthorizedException(String userMessage, String devMessage) {
        super(HttpStatus.UNAUTHORIZED, userMessage, devMessage);
    }
}
