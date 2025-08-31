package com.tranphuc8a.gemini_proxy.application.ports.output;

import com.tranphuc8a.gemini_proxy.domain.exceptions.system.SystemException;

public interface GeminiOutputPort {

    /**
     * Validate if the gemini key is valid or not
     * @param geminiKey - the gemini key to validate
     * @return true if the gemini key is valid, false otherwise
     */
    boolean validateGeminiKey(String geminiKey) throws SystemException;

}
