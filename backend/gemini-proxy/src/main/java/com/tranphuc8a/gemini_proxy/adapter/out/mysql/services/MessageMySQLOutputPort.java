package com.tranphuc8a.gemini_proxy.adapter.out.mysql.services;

import com.tranphuc8a.gemini_proxy.adapter.out.mysql.entities.MessageEntity;
import com.tranphuc8a.gemini_proxy.adapter.out.mysql.repositories.MessageMySQLRepository;
import com.tranphuc8a.gemini_proxy.application.ports.output.MessageOutputPort;
import com.tranphuc8a.gemini_proxy.domain.models.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MessageMySQLOutputPort implements MessageOutputPort {

    private final MessageMySQLRepository messageMySQLRepository;

    @Override
    public Message getById(Integer messageId) {
        MessageEntity messageEntity = messageMySQLRepository.findById(messageId).orElse(null);
        if (messageEntity == null) {
            return null;
        }
        return messageEntity.toDomain();
    }

    @Override
    public Page<Message> getAll(Pageable pageable) {
        Page<MessageEntity> messageEntityPage = messageMySQLRepository.findAll(pageable);
        return messageEntityPage.map(MessageEntity::toDomain);
    }

    @Override
    public void save(Message message) {
        MessageEntity messageEntity = new MessageEntity().fromDomain(message);
        messageMySQLRepository.save(messageEntity);
    }

    @Override
    public void delete(Message message) {
        MessageEntity messageEntity = new MessageEntity().fromDomain(message);
        messageMySQLRepository.delete(messageEntity);
    }

    @Override
    public void delete(Integer messageId) {
        messageMySQLRepository.deleteById(messageId);
    }
}
