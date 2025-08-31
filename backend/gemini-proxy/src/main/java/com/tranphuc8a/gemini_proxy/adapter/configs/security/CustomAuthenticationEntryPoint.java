package com.tranphuc8a.gemini_proxy.adapter.configs.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tranphuc8a.gemini_proxy.domain.exceptions.user.UnauthorizedException;
import com.tranphuc8a.gemini_proxy.domain.vo.response.ResponseError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");

        UnauthorizedException unauthorizedException =
                new UnauthorizedException(authException.getMessage());
        ResponseError<Object> responseError = ResponseError.from(unauthorizedException);
        ResponseEntity<ResponseError<Object>> body =
                new ResponseEntity<>(responseError, unauthorizedException.getStatusCode());

        response.getWriter().write(objectMapper.writeValueAsString(body));

    }

}
