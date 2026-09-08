from fastapi import Request
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.middleware.sessions import SessionMiddleware

from src.adapter.output.mysql.db.base import get_async_engine
from src.adapter.output.mysql.entities import ConversationEntity, MessageEntity
from src.application.config.config import settings


class AdminAuthentication(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
        if username == settings.ADMIN_USERNAME and password == settings.ADMIN_PASSWORD:
            request.session.update({"admin_authenticated": True})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("admin_authenticated", False)


class ConversationAdmin(ModelView, model=ConversationEntity):
    name = "Conversation"
    name_plural = "Conversations"
    icon = "fa-solid fa-comments"
    column_list = [
        ConversationEntity.id,
        ConversationEntity.name,
        ConversationEntity.created_at,
        ConversationEntity.updated_at,
    ]
    column_searchable_list = [ConversationEntity.id, ConversationEntity.name]
    form_excluded_columns = [ConversationEntity.messages]


class MessageAdmin(ModelView, model=MessageEntity):
    name = "Message"
    name_plural = "Messages"
    icon = "fa-solid fa-message"
    column_list = [
        MessageEntity.id,
        MessageEntity.conversation_id,
        MessageEntity.role,
        MessageEntity.content,
        MessageEntity.created_at,
    ]
    column_searchable_list = [MessageEntity.id, MessageEntity.conversation_id, MessageEntity.content]
    form_excluded_columns = [MessageEntity.conversation]


def setup_admin(app) -> Admin:
    app.add_middleware(SessionMiddleware, secret_key=settings.ADMIN_SECRET_KEY)
    authentication_backend = AdminAuthentication(secret_key=settings.ADMIN_SECRET_KEY)
    admin = Admin(app, get_async_engine(), authentication_backend=authentication_backend)
    admin.add_view(ConversationAdmin)
    admin.add_view(MessageAdmin)
    return admin