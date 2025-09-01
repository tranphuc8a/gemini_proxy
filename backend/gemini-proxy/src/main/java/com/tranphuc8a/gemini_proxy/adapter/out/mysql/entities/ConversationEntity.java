package com.tranphuc8a.gemini_proxy.adapter.out.mysql.entities;

import com.tranphuc8a.gemini_proxy.domain.models.Conversation;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity(name = "conversations")
public class ConversationEntity implements TableEntity<Conversation> {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    @Column(nullable = false)
    String name;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    List<MessageEntity> messages;

    @PrePersist
    public void preInsert(){
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate(){
        updatedAt = LocalDateTime.now();
    }

    @PostLoad
    public void postLoad(){
        if (name == null) name = "";
        if (messages == null) messages = List.of();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }


    @Override
    public Conversation toDomain() {
        return Conversation.builder()
                .id(id)
                .name(name)
                .createdAt(createdAt)
                .updatedAt(updatedAt)
                .messages(messages.stream().map(MessageEntity::toDomainLight).toList())
                .build();
    }

    @Override
    public Conversation toDomainLight() {
        return Conversation.builder()
                .id(id)
                .name(name)
                .createdAt(createdAt)
                .updatedAt(updatedAt)
                .build();
    }

    @Override
    public ConversationEntity fromDomain(Conversation domain) {
        if (domain == null) return this;
        fromDomainLight(domain);
        messages = domain.getMessages().stream().map(
                message -> new MessageEntity().fromDomainLight(message)).toList();
        return this;
    }

    @Override
    public ConversationEntity fromDomainLight(Conversation domain) {
        if (domain == null) return this;
        id = domain.getId();
        name = domain.getName();
        createdAt = domain.getCreatedAt();
        updatedAt = domain.getUpdatedAt();
        return this;
    }
}
