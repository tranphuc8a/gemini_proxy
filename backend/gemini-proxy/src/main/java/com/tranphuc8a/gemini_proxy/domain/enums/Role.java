package com.tranphuc8a.gemini_proxy.domain.enums;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@FieldDefaults(level = AccessLevel.PRIVATE)
@AllArgsConstructor
public enum Role {
    USER(0, "User"),
    ASSISTANT(1, "Assistant"),
    ;

    final int idx;
    final String value;

    public static String getRole(String roleValue){
        if (USER.value.equals(roleValue)){
            return USER.value;
        }
        return ASSISTANT.value;
    }

    public static String getRole(int idx){
        if (USER.idx == idx){
            return USER.value;
        }
        return ASSISTANT.value;
    }
}
