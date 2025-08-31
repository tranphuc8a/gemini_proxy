package com.tranphuc8a.gemini_proxy.adapter.configs.security;

import com.tranphuc8a.gemini_proxy.application.services.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@AllArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtService jwtService;


    public String getJwtFromRequest(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        try {
            String jwtToken = getJwtFromRequest(request);
            if (jwtToken != null) {
                String geminiKey = jwtService.decodeJwt(jwtToken);
                if (geminiKey != null) {
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
