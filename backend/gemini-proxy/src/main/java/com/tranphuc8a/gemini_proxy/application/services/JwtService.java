package com.tranphuc8a.gemini_proxy.application.services;

import com.tranphuc8a.gemini_proxy.application.utils.AESUtil;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expires_in_days:7}")
    private int expiresInDays;

    @Value("${jwt.expires_in_minutes:5}")
    private int expiresInMinutes;

    @Value("${jwt.algorithm:HS256}")
    private String algorithm;

    public static final String subjectKey = "gemini-key";

    private final AESUtil aesUtil;

    public JwtService(AESUtil aesUtil) {
        this.aesUtil = aesUtil;
    }

    public String registerToken(String geminiKey) {
        SignatureAlgorithm sigAlg = SignatureAlgorithm.forName(algorithm);
        Key key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));

        Date now = new Date();
        Date expiration = new Date(now.getTime() + expiresInDays * 24L * 60L * 60L * 1000L);

        return Jwts.builder()
                .setSubject(subjectKey)
                .claim(subjectKey, aesUtil.encrypt(geminiKey))
                .setIssuedAt(now)
                .setExpiration(expiration)
                .signWith(key, sigAlg)
                .compact();
    }

    public String decodeJwt(String jwtToken) {
        try {
            Key key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            Jws<Claims> claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(jwtToken);

            String encryptedGeminiKey = claims.getBody().get(subjectKey, String.class);
            return aesUtil.decrypt(encryptedGeminiKey);
        } catch (Exception e) {
            throw new RuntimeException("Invalid JWT token", e);
        }
    }

}
