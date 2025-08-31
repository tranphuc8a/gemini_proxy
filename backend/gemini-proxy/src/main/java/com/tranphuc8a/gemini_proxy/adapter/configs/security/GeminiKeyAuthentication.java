package com.tranphuc8a.gemini_proxy.adapter.configs.security;

import lombok.*;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class GeminiKeyAuthentication implements Authentication {

    String geminiKey;
    boolean authenticated;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of();
    }

    @Override
    public @Nullable Object getCredentials() {
        return geminiKey;
    }

    @Override
    public @Nullable Object getDetails() {
        return geminiKey;
    }

    @Override
    public @Nullable Object getPrincipal() {
        return geminiKey;
    }

    @Override
    public boolean isAuthenticated() {
        return authenticated;
    }

    @Override
    public void setAuthenticated(boolean isAuthenticated) throws IllegalArgumentException {
        this.authenticated = isAuthenticated;
    }

    @Override
    public String getName() {
        return geminiKey;
    }
}
