package com.tranphuc8a.gemini_proxy.adapter.out.mysql.repositories;

import com.tranphuc8a.gemini_proxy.adapter.out.mysql.entities.MessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageMySQLRepository extends JpaRepository<MessageEntity, Integer> {

}
