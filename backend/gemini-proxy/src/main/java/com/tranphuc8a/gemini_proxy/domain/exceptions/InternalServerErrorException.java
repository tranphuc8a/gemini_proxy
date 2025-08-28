package com.tranphuc8a.gemini_proxy.domain.exceptions;

import org.springframework.http.HttpStatus;

public class InternalServerErrorException extends SystemException{

    public InternalServerErrorException(){
        super(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public InternalServerErrorException(String message) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }

    public InternalServerErrorException(String userMessage, String devMessage) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, userMessage, devMessage);
    }
}
