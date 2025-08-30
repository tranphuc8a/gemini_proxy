package com.tranphuc8a.gemini_proxy.domain.exceptions.system;

import com.tranphuc8a.gemini_proxy.domain.exceptions.AppException;
import org.springframework.http.HttpStatus;

public class SystemException extends AppException {
    public SystemException(HttpStatus statusCode) {
        super(statusCode);
    }

    public SystemException(HttpStatus statusCode, String userMessage) {
        super(statusCode, userMessage);
    }

    public SystemException(HttpStatus statusCode, String userMessage, String devMessage) {
        super(statusCode, userMessage, devMessage);
    }
}
