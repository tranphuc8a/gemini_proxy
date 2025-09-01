package com.tranphuc8a.gemini_proxy.adapter.in.controllers;

import com.tranphuc8a.gemini_proxy.application.ports.input.ConversationInputPort;
import com.tranphuc8a.gemini_proxy.domain.vo.request.ConversationUpdatingRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/conversation")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationInputPort conversationInputPort;


    @Operation(
            summary = "Get conversation detail",
            description = "Get conversation detail by conversation id"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Get conversation detail successfully"),
            @ApiResponse(responseCode = "400", description = "ConversationId is invalid"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Conversation not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error"),
    })
    @GetMapping("/{conversationId}")
    public ResponseEntity<Object> getConversationDetail(
            @NotNull @NotEmpty @PathVariable("conversationId") String conversationId) {
        return conversationInputPort.getConversationDetail(conversationId);
    }


    @Operation(
            summary = "Get conversation messages",
            description = "Get conversation messages by conversation id"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Get conversation messages successfully"),
            @ApiResponse(responseCode = "400", description = "ConversationId is invalid"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Conversation not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error"),
    })
    @GetMapping("/messages/{conversationId}")
    public ResponseEntity<Object> getConversationMessages(
            @NotNull @NotEmpty @PathVariable("conversationId") String conversationId,
            Pageable pageable) {
        return conversationInputPort.getConversationMessages(conversationId, pageable);
    }


    @Operation(
            summary = "Get conversation list",
            description = "Get conversation list with pagination"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Get conversation list successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "500", description = "Internal server error"),
    })
    @GetMapping("/list")
    public ResponseEntity<Object> getConversationList(Pageable pageable) {
        return conversationInputPort.getConversationList(pageable);
    }


    @Operation(
            summary = "Create conversation",
            description = "Create conversation"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Create conversation successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "500", description = "Internal server error"),
    })
    @PostMapping
    public ResponseEntity<Object> createConversation() {
        return conversationInputPort.createConversation();
    }


    @Operation(
            summary = "Update conversation",
            description = "Update conversation"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Update conversation successfully"),
            @ApiResponse(responseCode = "400", description = "Conversation Updating Request is invalid"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "500", description = "Internal server error"),
    })
    @PatchMapping
    @PutMapping
    public ResponseEntity<Object> updateConversation(
            @Valid @RequestBody ConversationUpdatingRequest conversationUpdatingRequest) {
        return conversationInputPort.updateConversation(conversationUpdatingRequest);
    }


    @Operation(
            summary = "Delete conversation",
            description = "Delete conversation by conversation id"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Delete conversation successfully"),
            @ApiResponse(responseCode = "400", description = "ConversationId is invalid"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Conversation not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error"),
    })
    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Object> deleteConversation(
            @NotNull @NotEmpty @PathVariable("conversationId") String conversationId) {
        return conversationInputPort.deleteConversation(conversationId);
    }
}
