package com.tranphuc8a.gemini_proxy.adapter.configs;

import com.tranphuc8a.gemini_proxy.domain.exceptions.AppException;
import com.tranphuc8a.gemini_proxy.domain.exceptions.user.BadRequestException;
import com.tranphuc8a.gemini_proxy.domain.exceptions.system.InternalServerErrorException;
import com.tranphuc8a.gemini_proxy.domain.vo.response.ResponseError;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.data.mapping.PropertyReferenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
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

    // Handle invalid data access api usage exception
    @ExceptionHandler(InvalidDataAccessApiUsageException.class)
    public ResponseEntity<ResponseError<Object>> handleInvalidDataAccessApiUsageException(
            InvalidDataAccessApiUsageException ex, WebRequest request) {
        BadRequestException exception = new BadRequestException(ex.getMessage());
        ResponseError<Object> responseError = ResponseError.from(exception);
        Map<String, Object> data = new HashMap<>(Map.of(pathKey, getUri(request)));
        data.put(messageKey, ex.getMessage());
        responseError.setData(data);
        return new ResponseEntity<>(responseError, HttpStatus.BAD_REQUEST);
    }

    // Handle property reference exception
    @ExceptionHandler(PropertyReferenceException.class)
    public ResponseEntity<ResponseError<Object>> handlePropertyReferenceException(
            PropertyReferenceException ex, WebRequest request) {
        BadRequestException exception = new BadRequestException(ex.getMessage());
        ResponseError<Object> responseError = ResponseError.from(exception);
        Map<String, Object> data = new HashMap<>(Map.of(pathKey, getUri(request)));
        data.put(ex.getPropertyName(), ex.getMessage());
        responseError.setData(data);
        return new ResponseEntity<>(responseError, HttpStatus.BAD_REQUEST);
    }


    // Handle missing request params exception
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ResponseError<Object>> handleMissingParamsException(
            MissingServletRequestParameterException ex, WebRequest request) {
        BadRequestException exception = new BadRequestException(ex.getMessage());
        ResponseError<Object> responseError = ResponseError.from(exception);
        Map<String, Object> data = new HashMap<>(Map.of(pathKey, getUri(request)));
        data.put(ex.getParameterName(), ex.getMessage());
        responseError.setData(data);
        return new ResponseEntity<>(responseError, HttpStatus.BAD_REQUEST);
    }

    // Handle input validation errors
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ResponseError<Object>> handleValidationException(MethodArgumentNotValidException ex, WebRequest request) {
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
    public ResponseEntity<ResponseError<Object>> handleAppException(AppException ex, WebRequest request) {
        return new ResponseEntity<>(ResponseError.from(ex), ex.getStatusCode());
    }
}
