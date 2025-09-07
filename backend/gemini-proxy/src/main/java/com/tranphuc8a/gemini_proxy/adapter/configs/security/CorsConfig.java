package com.tranphuc8a.gemini_proxy.adapter.configs.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")  // Apply to all APIs starting with /**
                .allowedOrigins("*") // Allow all origins (can be replaced with specific domains)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // Allow HTTP methods
                .allowedHeaders("*") // Allow all headers
                .exposedHeaders("Authorization") // Allow FE to read this header
                .allowCredentials(true)          // Allow sending cookies/session
                .maxAge(3600);                   // Cache preflight request for 1h
    }
}

