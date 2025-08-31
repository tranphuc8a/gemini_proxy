package com.tranphuc8a.gemini_proxy.domain.vo.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RegisterTokenRequest {

    @JsonProperty("gemini_key")
    String geminiKey;

}
