package com.tranphuc8a.gemini_proxy.domain.enums;

import com.tranphuc8a.gemini_proxy.common.annotations.NegativeParameterizedTest;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class RoleTests {

    @ParameterizedTest
    @ValueSource(strings = {"user", "USER", "User", "uSeR"})
    public void testGetRoleUser(String roleValue){
        Assertions.assertDoesNotThrow(() -> {
            Role role = Role.getRole(roleValue);
            Assertions.assertNotNull(role);
            Assertions.assertEquals(role.getValue(), Role.USER.getValue());
            Assertions.assertEquals(role.getIdx(), Role.USER.getIdx());
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"assistant", "ASSISTANT", "Assistant", "AsSiStAnT"})
    public void testGetRoleAssistant(String roleValue){
        Assertions.assertDoesNotThrow(() -> {
            Role role = Role.getRole(roleValue);
            Assertions.assertNotNull(role);
            Assertions.assertEquals(role.getValue(), Role.ASSISTANT.getValue());
            Assertions.assertEquals(role.getIdx(), Role.ASSISTANT.getIdx());
        });
    }

    @NegativeParameterizedTest
    @ValueSource(strings = {"", "      ", " User", "USER ", "ASSISTANT ", ".Assistant", "Student", "Teacher", "Asistant", "use r"})
    @NullSource
    public void testGetRoleValueInvalid(String roleValue) throws Exception {
        Assertions.assertThrows(IllegalArgumentException.class, () -> {
            Role.getRole(roleValue);
        });
    }

    @Test
    public void testGetRoleUser(){
        Assertions.assertDoesNotThrow(() -> {
            Role role = Role.getRole(Role.USER.getIdx());
            Assertions.assertNotNull(role);
            Assertions.assertEquals(role.getValue(), Role.USER.getValue());
            Assertions.assertEquals(role.getIdx(), Role.USER.getIdx());
        });
    }

    @Test
    public void testGetRoleAssistant(){
        Assertions.assertDoesNotThrow(() -> {
            Role role = Role.getRole(Role.ASSISTANT.getIdx());
            Assertions.assertNotNull(role);
            Assertions.assertEquals(role.getValue(), Role.ASSISTANT.getValue());
            Assertions.assertEquals(role.getIdx(), Role.ASSISTANT.getIdx());
        });
    }

    @NegativeParameterizedTest
    @ValueSource(ints = {-1, -2, 2, 3, 4})
    public void testGetRoleInvalidIdx(int roleIdx) {
        Assertions.assertThrows(IllegalArgumentException.class, () -> {
            Role.getRole(roleIdx);
        });
    }

}
