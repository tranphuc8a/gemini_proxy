from typing import Optional, Tuple, List
from sqlalchemy import and_, or_, asc, desc, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.application.ports.output.health_check_output_port import HealthCheckOutputPort
from src.adapter.output.mysql.entities import ConversationEntity
from src.domain.models.conversation_domain import ConversationDomain
from src.application.ports.output.conversation_output_port import ConversationOutputPort

class ConversationRepository(ConversationOutputPort, HealthCheckOutputPort):
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, conversation_id: str) -> Optional[ConversationDomain]:
        ent = await self.db.get(ConversationEntity, conversation_id)
        return ent.to_domain() if ent is not None else None

    async def get_all(self, limit: int, after: Optional[str], order: str) -> Tuple[List[ConversationDomain], bool]:
        """Cursor pagination (async).

        Returns (items, has_more).
        """
        # determine order
        order = (order or "desc").lower()
        if order not in ("asc", "desc"):
            order = "desc"

        order_col = ConversationEntity.created_at.asc() if order == "asc" else ConversationEntity.created_at.desc()
        tie_order = ConversationEntity.id.asc() if order == "asc" else ConversationEntity.id.desc()

        stmt = select(ConversationEntity)

        if after:
            # find anchor
            anchor = await self.db.get(ConversationEntity, after)
            if anchor:
                if order == "desc":
                    stmt = stmt.where(
                        or_(
                            ConversationEntity.created_at < anchor.created_at,
                            and_(ConversationEntity.created_at == anchor.created_at, ConversationEntity.id < anchor.id),
                        )
                    )
                else:
                    stmt = stmt.where(
                        or_(
                            ConversationEntity.created_at > anchor.created_at,
                            and_(ConversationEntity.created_at == anchor.created_at, ConversationEntity.id > anchor.id),
                        )
                    )

        stmt = stmt.order_by(order_col, tie_order)

        # fetch one extra
        result = await self.db.execute(stmt.limit(limit + 1))
        rows = result.scalars().all()
        has_more = len(rows) > limit
        items = rows[:limit]
        # map to domain
        domains = [r.to_domain() for r in items]
        return domains, has_more

    async def save(self, conversation: ConversationDomain) -> ConversationDomain:
        existing = await self.db.get(ConversationEntity, conversation.id)
        if not existing:
            ent = ConversationEntity.from_domain(conversation)
            self.db.add(ent)
            await self.db.commit()
            await self.db.refresh(ent)
            return ent.to_domain()
        # update fields
        setattr(existing, "name", conversation.name)
        await self.db.commit()
        await self.db.refresh(existing)
        return existing.to_domain()

    async def delete(self, conversation: ConversationDomain) -> bool:
        ent = await self.db.get(ConversationEntity, conversation.id)
        if ent:
            await self.db.delete(ent)
            await self.db.commit()
            return True
        return False

    async def is_healthy(self) -> bool:
        await self.db.execute(select(func.now()))
        return True

    async def is_ready(self) -> bool:
        await self.db.execute(select(func.now()))
        return True
