package com.tranphuc8a.gemini_proxy.adapter.out.mysql.repositories;

import com.tranphuc8a.gemini_proxy.adapter.out.mysql.entities.ConversationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationMySQLRepository extends JpaRepository<ConversationEntity, String> {
}
