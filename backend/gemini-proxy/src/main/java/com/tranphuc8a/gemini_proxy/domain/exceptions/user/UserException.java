package com.tranphuc8a.gemini_proxy.domain.exceptions.user;

import com.tranphuc8a.gemini_proxy.domain.exceptions.AppException;
import org.springframework.http.HttpStatus;


public class UserException extends AppException {
    public UserException(HttpStatus statusCode) {
        super(statusCode);
    }
    
    public UserException(HttpStatus statusCode, String userMessage) {
        super(statusCode, userMessage);
    }

    public UserException(HttpStatus statusCode, String userMessage, String devMessage) {
        super(statusCode, userMessage, devMessage);
    }
}
