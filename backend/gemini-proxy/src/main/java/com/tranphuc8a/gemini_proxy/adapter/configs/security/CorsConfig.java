package com.tranphuc8a.gemini_proxy.adapter.configs.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")  // áp dụng cho tất cả API bắt đầu bằng /**
                .allowedOrigins("*") // Cho phép tất cả các nguồn (có thể thay bằng domain cụ thể)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // Cho phép các phương thức HTTP
                .allowedHeaders("*") // Cho phép tất cả các header
                .exposedHeaders("Authorization") // Cho phép FE đọc header này
                .allowCredentials(true)          // Cho phép gửi cookie/session
                .maxAge(3600);                   // Cache preflight request 1h
    }
}

