from typing import List, Optional, Tuple
from sqlalchemy import select, asc, desc, and_, or_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.application.ports.output.health_check_output_port import HealthCheckOutputPort
from src.adapter.output.mysql.entities import MessageEntity
from src.domain.models.message_domain import MessageDomain
from src.application.ports.output.message_output_port import MessageOutputPort


class MessageRepository(MessageOutputPort, HealthCheckOutputPort):

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_list_by_conversation(self, conversation_id: str, after: Optional[str], limit: int, order: str) -> Tuple[List[MessageDomain], bool]:
        """Cursor-pagination: returns (items, has_more).

        - after: optional anchor id (primary key) as string. If provided, results are fetched after/before this anchor depending on order.
        - order: 'asc' or 'desc' (by created_at then id)
        """
        order = (order or "desc").lower()
        if order not in ("asc", "desc"):
            order = "desc"

        order_col = MessageEntity.created_at.asc() if order == "asc" else MessageEntity.created_at.desc()
        tie_order = MessageEntity.id.asc() if order == "asc" else MessageEntity.id.desc()

        stmt = select(MessageEntity).where(MessageEntity.conversation_id == conversation_id)

        if after:
            # try to load anchor by PK; be permissive with types
            anchor = None
            try:
                anchor = await self.db.get(MessageEntity, int(after))
            except Exception:
                try:
                    anchor = await self.db.get(MessageEntity, after)
                except Exception:
                    anchor = None

            if anchor:
                if order == "desc":
                    stmt = stmt.where(
                        or_(
                            MessageEntity.created_at < anchor.created_at,
                            and_(MessageEntity.created_at == anchor.created_at, MessageEntity.id < anchor.id),
                        )
                    )
                else:
                    stmt = stmt.where(
                        or_(
                            MessageEntity.created_at > anchor.created_at,
                            and_(MessageEntity.created_at == anchor.created_at, MessageEntity.id > anchor.id),
                        )
                    )

        stmt = stmt.order_by(order_col, tie_order)

        # fetch one extra to determine has_more
        result = await self.db.execute(stmt.limit(limit + 1))
        rows = result.scalars().all()
        has_more = len(rows) > limit
        items = rows[:limit]
        return [r.to_domain() for r in items], has_more

    async def get_all_by_conversation(self, conversation_id: str) -> List[MessageDomain]:
        stmt = select(MessageEntity).where(MessageEntity.conversation_id == conversation_id).order_by(MessageEntity.created_at.asc(), MessageEntity.id.asc())
        res = await self.db.execute(stmt)
        rows = res.scalars().all()
        return [r.to_domain() for r in rows]

    async def save(self, message: MessageDomain) -> MessageDomain:
        # Try to detect existing entity by PK if provided and numeric
        ent = None
        try:
            # message.id may be numeric-like or generated; try numeric primary-key lookup first
            ent = await self.db.get(MessageEntity, int(message.id))
        except Exception:
            ent = None

        if not ent:
            ent = MessageEntity.from_domain(message)
            self.db.add(ent)
            await self.db.commit()
            await self.db.refresh(ent)
            return ent.to_domain()

        # update existing
        setattr(ent, "role", message.role)
        setattr(ent, "content", message.content)
        await self.db.commit()
        await self.db.refresh(ent)
        return ent.to_domain()

    async def delete(self, message: MessageDomain) -> bool:
        # find by PK
        ent = None
        try:
            ent = await self.db.get(MessageEntity, int(message.id))
        except Exception:
            # fallback: query by id equality
            stmt = select(MessageEntity).where(MessageEntity.id == message.id)
            res = await self.db.execute(stmt)
            ent = res.scalars().first()

        if ent:
            await self.db.delete(ent)
            await self.db.commit()
            return True
        return False

    async def delete_by_conversation(self, conversation_id: str) -> bool:
        stmt = delete(MessageEntity).where(MessageEntity.conversation_id == conversation_id)
        await self.db.execute(stmt)
        await self.db.commit()
        return True

    async def count_by_conversation(self, conversation_id: str) -> int:
        stmt = select(func.count()).select_from(MessageEntity).where(MessageEntity.conversation_id == conversation_id)
        res = await self.db.execute(stmt)
        return int(res.scalar_one() or 0)

    async def get_latest_by_conversation(self, conversation_id: str, count: int) -> List[MessageDomain]:
        stmt = select(MessageEntity).where(MessageEntity.conversation_id == conversation_id).order_by(MessageEntity.created_at.desc(), MessageEntity.id.desc()).limit(count)
        res = await self.db.execute(stmt)
        rows = res.scalars().all()
        return [r.to_domain() for r in rows]

    async def get_by_id(self, message_id: int) -> MessageDomain:
        ent = await self.db.get(MessageEntity, message_id)
        if ent is None:
            raise ValueError(f"Message not found: {message_id}")
        return ent.to_domain()

    async def update(self, message: MessageDomain) -> MessageDomain:
        # update by PK
        ent = None
        try:
            ent = await self.db.get(MessageEntity, int(message.id))
        except Exception:
            # fallback to query
            stmt = select(MessageEntity).where(MessageEntity.id == message.id)
            res = await self.db.execute(stmt)
            ent = res.scalars().first()

        if not ent:
            # If no existing entity, create new
            return await self.save(message)

        setattr(ent, "role", message.role)
        setattr(ent, "content", message.content)
        await self.db.commit()
        await self.db.refresh(ent)
        return ent.to_domain()

    async def get_by_conversation_and_role(self, conversation_id: str, role: str) -> List[MessageDomain]:
        stmt = select(MessageEntity).where(
            MessageEntity.conversation_id == conversation_id,
            MessageEntity.role == role
        ).order_by(MessageEntity.created_at.asc(), MessageEntity.id.asc())
        res = await self.db.execute(stmt)
        rows = res.scalars().all()
        return [r.to_domain() for r in rows]
    
    async def is_healthy(self) -> bool:
        await self.db.execute(select(func.now()))
        return True
    
    async def is_ready(self) -> bool:
        await self.db.execute(select(func.now()))
        return True
