package com.tranphuc8a.gemini_proxy.domain.exceptions;

import org.springframework.http.HttpStatus;

public class AccessDeniedException extends UserException {

    public AccessDeniedException() {
        super(HttpStatus.FORBIDDEN);
    }

    public AccessDeniedException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }

    public AccessDeniedException(String userMessage, String devMessage) {
        super(HttpStatus.FORBIDDEN, userMessage, devMessage);
    }
}
