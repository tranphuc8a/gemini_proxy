package com.tranphuc8a.gemini_proxy.domain.exceptions.system;
import org.springframework.http.HttpStatus;

public class BadGatewayException extends SystemException {

    public BadGatewayException() {
        super(HttpStatus.BAD_GATEWAY);
    }

    public BadGatewayException(String userMessage) {
        super(HttpStatus.BAD_GATEWAY, userMessage);
    }

    public BadGatewayException(String userMessage, String devMessage) {
        super(HttpStatus.BAD_GATEWAY, userMessage, devMessage);
    }

}
