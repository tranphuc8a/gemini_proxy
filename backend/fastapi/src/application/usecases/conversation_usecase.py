from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.fastapi.src.application.ports.input.conversation_input_port import ConversationInputPort
from backend.fastapi.src.application.ports.output.conversation_output_port import ConversationOutputPort, MessageOutputPort
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from src.domain.vo.conversation_response import ConversationResponse
from src.domain.vo.response_list import ResponseList
from src.domain.models import ConversationDomain as Conversation, MessageDomain as Message
from uuid import uuid4
from fastapi import HTTPException
import asyncio


class ConversationUseCase(ConversationInputPort):
    LATEST_MESSAGE_COUNT = 10
    CONVERSATION_NEW_NAME = "New Conversation"

    def __init__(self, conversation_repo: ConversationOutputPort, message_repo: MessageOutputPort):
        self.conversation_repo = conversation_repo
        self.message_repo = message_repo

    async def get_conversation_detail(self, conversation_id: str):
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        # fetch latest messages explicitly to avoid async lazy-loading issues
        messages = await self.message_repo.get_list_by_conversation(conversation_id, offset=0, limit=self.LATEST_MESSAGE_COUNT)
        conv.messages = messages
        return conv

    async def get_conversation_list(self, limit: int = 10, after: Optional[str] = None, offset: int = 0, order: str = "desc"):
        """Return a paginated ResponseList of conversations.

        - order: 'asc' or 'desc' (by created_at)
        - after: id cursor (optional)
        - offset: number of items to skip after the cursor
        - limit: max items to return
        """
        items, has_more = await self.conversation_repo.get_all(limit=limit, after=after, offset=offset, order=order)
        # convert to response VO list
        data = [ConversationResponse.from_domain(c) for c in items]
        first_id = data[0].id if data else None
        last_id = data[-1].id if data else None
        return ResponseList[ConversationResponse](data=data, first_id=first_id, last_id=last_id, has_more=has_more)

    async def get_conversation_messages(self, conversation_id: str, page: int = 0, size: int = 10):
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        offset = page * size
        return await self.message_repo.get_list_by_conversation(conversation_id, offset=offset, limit=size)

    async def create_conversation(self):
        conv = Conversation(id=str(uuid4()), name=self.CONVERSATION_NEW_NAME)
        saved = await self.conversation_repo.save(conv)
        return saved

    async def update_conversation(self, request: ConversationUpdateRequest):
        conv = await self.conversation_repo.get_by_id(request.conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conv.name = request.name
        return await self.conversation_repo.save(conv)

    async def delete_conversation(self, conversation_id: str):
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        await self.conversation_repo.delete(conv)
        return conv

    async def send_message(self, conversation_id: str, content: str, role: str = "user"):
        """Persist a user message, call Gemini, persist assistant reply and return both."""
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # create user message
        from src.adapter.output.mysql.entities import MessageEntity
        from src.domain.models import MessageDomain

        user_domain = MessageDomain(id=None, conversation_id=conversation_id, role=role, content=content)
        ent = MessageEntity.from_domain(user_domain)
        db.add(ent)
        await db.commit()
        await db.refresh(ent)
        user_msg = ent.to_domain()

        assistant_msg = None
        if role == "user":
            # Gemini client is synchronous; run in thread to avoid blocking event loop
            from src.adapter.gemini.gemini_client import GeminiClient, GeminiClientError

            client = GeminiClient()
            try:
                gen_resp = await asyncio.to_thread(client.generate, content)
                text = None
                if isinstance(gen_resp, dict):
                    if "candidates" in gen_resp and isinstance(gen_resp["candidates"], list):
                        first = gen_resp["candidates"][0]
                        text = first.get("output") or first.get("content") or first.get("text")
                    text = text or gen_resp.get("text") or gen_resp.get("output")
                if text is None:
                    text = str(gen_resp)
            except GeminiClientError as ex:
                text = f"[gemini error] {ex}"

            assistant_domain = MessageDomain(id=None, conversation_id=conversation_id, role="assistant", content=text)
            assistant_ent = MessageEntity.from_domain(assistant_domain)
            db.add(assistant_ent)
            await db.commit()
            await db.refresh(assistant_ent)
            assistant_msg = assistant_ent.to_domain()

        return {"user": user_msg, "assistant": assistant_msg}
