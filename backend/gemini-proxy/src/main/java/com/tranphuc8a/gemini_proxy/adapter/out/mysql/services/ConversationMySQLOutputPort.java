package com.tranphuc8a.gemini_proxy.adapter.out.mysql.services;

import com.tranphuc8a.gemini_proxy.adapter.out.mysql.entities.ConversationEntity;
import com.tranphuc8a.gemini_proxy.adapter.out.mysql.repositories.ConversationMySQLRepository;
import com.tranphuc8a.gemini_proxy.application.ports.output.ConversationOutputPort;
import com.tranphuc8a.gemini_proxy.domain.models.Conversation;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class ConversationMySQLOutputPort implements ConversationOutputPort {

    private final ConversationMySQLRepository conversationMySQLRepository;

    @Override
    public Conversation getById(String conversationId) {
        ConversationEntity conversationEntity =
                conversationMySQLRepository.findById(conversationId).orElse(null);
        if (conversationEntity == null) return null;
        return conversationEntity.toDomain();
    }

    @Override
    public Page<Conversation> getAll(Pageable pageable) {
        Page<ConversationEntity> conversationEntityPage = conversationMySQLRepository.findAll(pageable);
        return conversationEntityPage.map(ConversationEntity::toDomain);
    }

    @Override
    public void save(Conversation conversation) {
        ConversationEntity conversationEntity = new ConversationEntity().fromDomain(conversation);
        conversationMySQLRepository.save(conversationEntity);
    }

    @Override
    public void delete(Conversation conversation) {
        ConversationEntity conversationEntity = new ConversationEntity().fromDomain(conversation);
        conversationMySQLRepository.delete(conversationEntity);
    }

    @Override
    public void delete(String conversationId) {
        conversationMySQLRepository.deleteById(conversationId);
    }
}
