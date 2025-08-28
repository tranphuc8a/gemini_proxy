package com.tranphuc8a.gemini_proxy.domain.exceptions;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends UserException {
    public ResourceNotFoundException() {
        super(HttpStatus.NOT_FOUND);
    }
    public ResourceNotFoundException(String userMessage) {
        super(HttpStatus.NOT_FOUND, userMessage);
    }
    public ResourceNotFoundException(String userMessage, String devMessage) {
        super(HttpStatus.NOT_FOUND, userMessage, devMessage);
    }
}
