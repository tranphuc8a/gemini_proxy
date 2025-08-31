package com.tranphuc8a.gemini_proxy.adapter.out.gemini.services;

import com.tranphuc8a.gemini_proxy.application.ports.output.GeminiOutputPort;
import com.tranphuc8a.gemini_proxy.domain.exceptions.system.SystemException;
import org.springframework.stereotype.Service;

@Service
public class GeminiService implements GeminiOutputPort {
    @Override
    public boolean validateGeminiKey(String geminiKey) throws SystemException {
        return false;
    }
}
