package com.tranphuc8a.gemini_proxy.domain.enums;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
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

    public static Role getRole(String roleValue) {
        for (Role role : Role.values()) {
            if (role.value.equalsIgnoreCase(roleValue)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Invalid role value: " + roleValue);
    }
    public static Role getRole(int idx) {
        for (Role role : Role.values()) {
            if (role.idx == idx) {
                return role;
            }
        }
        throw new IllegalArgumentException("Invalid role index: " + idx);
    }
}
