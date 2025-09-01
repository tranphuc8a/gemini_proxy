package com.tranphuc8a.gemini_proxy.application.ports.output;

import com.tranphuc8a.gemini_proxy.domain.models.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface MessageOutputPort {

    Message getById(Integer messageId);

    Page<Message> getAll(Pageable pageable);

    void save(Message message);

    void delete(Message message);

    void delete(Integer messageId);

}
