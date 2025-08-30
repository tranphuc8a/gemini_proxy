package com.tranphuc8a.gemini_proxy.adapter.configs;

import com.tranphuc8a.gemini_proxy.domain.exceptions.AppException;
import com.tranphuc8a.gemini_proxy.domain.exceptions.user.BadRequestException;
import com.tranphuc8a.gemini_proxy.domain.exceptions.system.InternalServerErrorException;
import com.tranphuc8a.gemini_proxy.domain.vo.ResponseError;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class ExceptionResolver {

    private final String pathKey = "path";
    private final String messageKey = "messages";


    protected String getUri(WebRequest webRequest) {
        return webRequest.getDescription(false)
                .replaceAll("uri=", "");
    }

    // Handle general exceptions
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseError<Object>> handleGlobalException(Exception ex, WebRequest request) {
        InternalServerErrorException exception = new InternalServerErrorException(ex.getMessage());
        ResponseError<Object> responseError = ResponseError.from(exception);
        responseError.setData(Map.of(pathKey, getUri(request)));
        return new ResponseEntity<>(responseError, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Handle input validation errors
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Object> handleValidationException(MethodArgumentNotValidException ex, WebRequest request) {
        BadRequestException exception = new BadRequestException(ex.getMessage());
        ResponseError<Object> responseError = ResponseError.from(exception);

        HashMap<String, Object> data = new HashMap<>();
        data.put(messageKey, ex.getBindingResult().getAllErrors());
        data.put(pathKey, getUri(request));
        responseError.setData(data);
        return new ResponseEntity<>(responseError, HttpStatus.BAD_REQUEST);
    }

    // Handle AppException
    @ExceptionHandler(AppException.class)
    public ResponseEntity<Object> handleNotFound(AppException ex, WebRequest request) {
        ResponseError<Object> responseError = ResponseError.from(ex);
        return new ResponseEntity<>(responseError, HttpStatus.NOT_FOUND);
    }
}
