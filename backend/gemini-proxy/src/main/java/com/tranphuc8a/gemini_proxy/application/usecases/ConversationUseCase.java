package com.tranphuc8a.gemini_proxy.application.usecases;

import com.tranphuc8a.gemini_proxy.application.ports.input.ConversationInputPort;
import com.tranphuc8a.gemini_proxy.application.ports.output.ConversationOutputPort;
import com.tranphuc8a.gemini_proxy.application.ports.output.MessageOutputPort;
import com.tranphuc8a.gemini_proxy.domain.exceptions.user.ResourceNotFoundException;
import com.tranphuc8a.gemini_proxy.domain.models.Conversation;
import com.tranphuc8a.gemini_proxy.domain.models.Message;
import com.tranphuc8a.gemini_proxy.domain.vo.request.ConversationUpdatingRequest;
import com.tranphuc8a.gemini_proxy.domain.vo.response.ResponseResult;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationUseCase implements ConversationInputPort {

    public static final int LATEST_MESSAGE_COUNT = 10;
    public static final String CONVERSATION_NEW_NAME = "New Conversation";

    private final ConversationOutputPort conversationOutputPort;

    private final MessageOutputPort messageOutputPort;

    @Override
    public ResponseEntity<Object> getConversationDetail(String conversationId) {
        Conversation conversation = conversationOutputPort.getById(conversationId);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found");
        }
        conversation.setMessages(
                conversation.getMessages().stream().limit(LATEST_MESSAGE_COUNT).toList()
        );
        return ResponseEntity.ok(ResponseResult.from(
                conversation, "Get conversation detail successfully"));
    }

    @Override
    public ResponseEntity<Object> getConversationList(Pageable pageable) {
        Page<Conversation> conversationPage = conversationOutputPort.getAll(pageable);
        conversationPage.forEach(conversation -> conversation.setMessages(List.of()));
        return ResponseEntity.ok(ResponseResult.from(
                conversationPage, "Get conversation list successfully"));
    }

    @Override
    public ResponseEntity<Object> getConversationMessages(String conversationId, Pageable pageable) {
        Conversation conversation = conversationOutputPort.getById(conversationId);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found");
        }
        Page<Message> messagePage = messageOutputPort.getListByConversation(conversationId, pageable);
        messagePage.forEach(message -> message.setConversation(null));
        return ResponseEntity.ok(ResponseResult.from(
                messagePage, "Get conversation messages successfully"));
    }

    @Override
    public ResponseEntity<Object> createConversation() {
        Conversation conversation = Conversation.builder()
                .id(null)
                .name(CONVERSATION_NEW_NAME)
                .build();
        conversation = conversationOutputPort.save(conversation);
        return ResponseEntity.ok(ResponseResult.from(
                conversation, "Create conversation successfully"));
    }

    @Override
    public ResponseEntity<Object> updateConversation(ConversationUpdatingRequest conversationUpdatingRequest) {
        Conversation conversation = conversationOutputPort.getById(conversationUpdatingRequest.getConversationId());
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found");
        }
        conversation.setName(conversationUpdatingRequest.getName());
        conversation = conversationOutputPort.save(conversation);
        return ResponseEntity.ok(ResponseResult.from(
                conversation, "Update conversation successfully"));
    }

    @Override
    public ResponseEntity<Object> deleteConversation(String conversationId) {
        Conversation conversation = conversationOutputPort.getById(conversationId);
        if (conversation == null) {
            throw new ResourceNotFoundException("Conversation not found");
        }
        conversationOutputPort.delete(conversation);
        return ResponseEntity.ok(ResponseResult.from(
                conversation, "Delete conversation successfully"));
    }
}
