package com.tranphuc8a.gemini_proxy.adapter.configs.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tranphuc8a.gemini_proxy.application.ports.output.GeminiOutputPort;
import com.tranphuc8a.gemini_proxy.domain.vo.request.RegisterTokenRequest;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@AllArgsConstructor
public class GeminiKeyFilter extends OncePerRequestFilter {

    private final GeminiOutputPort geminiOutputPort;

    public static final String apiEndPoint = "/register-token";

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String getGeminiKeyFromRequest(HttpServletRequest request) {
        try {
            String body = request.getReader().lines()
                    .reduce("", (accumulator, actual) -> accumulator + actual);
            RegisterTokenRequest registerTokenRequest = objectMapper.readValue(body, RegisterTokenRequest.class);
            return registerTokenRequest.getGeminiKey();
        } catch (Exception e) {
            log.atInfo().log(GeminiKeyFilter.class.getName() + ": " + e.getMessage());
            return null;
        }
    }

    boolean isCallingRegisterToken(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path != null && path.endsWith(apiEndPoint);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        try {
            if (isCallingRegisterToken(request)) {
                String geminiKey = getGeminiKeyFromRequest(request);
                if (geminiOutputPort.validateGeminiKey(geminiKey)) {
                    GeminiKeyAuthentication authentication = GeminiKeyAuthentication.builder()
                            .geminiKey(geminiKey)
                            .authenticated(true)
                            .build();
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } finally {
            filterChain.doFilter(request, response);
        }
    }
}
