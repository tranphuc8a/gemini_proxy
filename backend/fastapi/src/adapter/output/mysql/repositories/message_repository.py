from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapter.output.mysql.entities import MessageEntity
from src.application.ports.output.message_output_port import MessageOutputPort

class MessageRepository(MessageOutputPort):

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_list_by_conversation(self, conversation_id: str, offset: int, limit: int):
        stmt = select(MessageEntity).where(MessageEntity.conversation_id == conversation_id).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        rows = res.scalars().all()
        return [r.to_domain() for r in rows]
