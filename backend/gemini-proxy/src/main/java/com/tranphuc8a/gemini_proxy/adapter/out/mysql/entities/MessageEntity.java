package com.tranphuc8a.gemini_proxy.adapter.out.mysql.entities;

import com.tranphuc8a.gemini_proxy.domain.enums.Role;
import com.tranphuc8a.gemini_proxy.domain.models.Message;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Column;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PrePersist;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.Builder;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity(name = "messages")
public class MessageEntity implements TableEntity<Message> {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    Integer id;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    Role role;

    @Column(nullable = false)
    String content;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "conversation_id", nullable = false)
    ConversationEntity conversation;


    @PrePersist
    public void preInsert() {
        createdAt = LocalDateTime.now();
    }

    @PostLoad
    public void postLoad() {
        if (role == null) {
            role = Role.USER;
        }
        if (content == null) {
            content = "";
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }


    @Override
    public Message toDomain() {
        return Message.builder()
                .id(id)
                .content(content)
                .createdAt(createdAt)
                .role(role)
                .conversation(conversation.toDomainLight())
                .build();
    }

    @Override
    public Message toDomainLight() {
        return Message.builder()
                .id(id)
                .content(content)
                .createdAt(createdAt)
                .role(role)
                .build();
    }

    @Override
    public MessageEntity fromDomain(Message domain) {
        if (domain == null) {
            return this;
        }
        fromDomainLight(domain);
        conversation = new ConversationEntity().fromDomainLight(domain.getConversation());
        return this;
    }

    @Override
    public MessageEntity fromDomainLight(Message domain) {
        if (domain == null) {
            return this;
        }
        id = domain.getId();
        role = domain.getRole();
        content = domain.getContent();
        createdAt = domain.getCreatedAt();
        return this;
    }

}
