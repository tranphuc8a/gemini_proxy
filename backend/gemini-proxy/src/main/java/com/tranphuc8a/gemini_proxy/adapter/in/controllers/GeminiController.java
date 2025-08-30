package com.tranphuc8a.gemini_proxy.adapter.in.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/gemini")
@RequiredArgsConstructor
public class GeminiController {

    @Operation(
            summary = "Health check for application",
            description = "Check application is running"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Application is running"),
            @ApiResponse(responseCode = "400", description = "Application is not running")
    })
    @GetMapping("/health")
    public String healthCheck() {
        return "OK";
    }
}
