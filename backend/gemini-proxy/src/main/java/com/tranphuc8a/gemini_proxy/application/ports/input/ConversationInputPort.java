package com.tranphuc8a.gemini_proxy.application.ports.input;

import com.tranphuc8a.gemini_proxy.domain.vo.request.ConversationUpdatingRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

public interface ConversationInputPort {

    ResponseEntity<Object> getConversationDetail(String conversationId);

    ResponseEntity<Object> getConversationList(Pageable pageable);

    ResponseEntity<Object> getConversationMessages(String conversationId, Pageable pageable);

    ResponseEntity<Object> createConversation();

    ResponseEntity<Object> updateConversation(ConversationUpdatingRequest conversationUpdatingRequest);

    ResponseEntity<Object> deleteConversation(String conversationId);

}
