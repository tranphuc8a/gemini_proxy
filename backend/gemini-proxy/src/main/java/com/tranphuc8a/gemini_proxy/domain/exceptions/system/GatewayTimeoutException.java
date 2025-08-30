package com.tranphuc8a.gemini_proxy.domain.exceptions.system;

import org.springframework.http.HttpStatus;

public class GatewayTimeoutException extends SystemException {
    public GatewayTimeoutException(){
        super(HttpStatus.GATEWAY_TIMEOUT);
    }

    public GatewayTimeoutException(String userMessage){
        super(HttpStatus.GATEWAY_TIMEOUT, userMessage);
    }

    public GatewayTimeoutException(String userMessage, String devMessage){
        super(HttpStatus.GATEWAY_TIMEOUT, userMessage, devMessage);
    }
}
