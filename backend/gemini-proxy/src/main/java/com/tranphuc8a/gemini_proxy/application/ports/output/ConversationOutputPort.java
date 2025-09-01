package com.tranphuc8a.gemini_proxy.application.ports.output;

import com.tranphuc8a.gemini_proxy.domain.models.Conversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ConversationOutputPort {

    Conversation getById(String conversationId);

    Page<Conversation> getAll(Pageable pageable);

    Conversation save(Conversation conversation);

    void delete(Conversation conversation);

    void delete(String conversationId);

}
