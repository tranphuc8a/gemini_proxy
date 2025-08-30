package com.tranphuc8a.gemini_proxy.domain.exceptions.system;

import org.springframework.http.HttpStatus;

public class ServiceUnavailableException extends SystemException {
    public ServiceUnavailableException() {
        super(HttpStatus.SERVICE_UNAVAILABLE);
    }

    public ServiceUnavailableException(String userMessage) {
        super(HttpStatus.SERVICE_UNAVAILABLE, userMessage);
    }

    public ServiceUnavailableException(String userMessage, String devMessage) {
        super(HttpStatus.SERVICE_UNAVAILABLE, userMessage, devMessage);
    }
}
