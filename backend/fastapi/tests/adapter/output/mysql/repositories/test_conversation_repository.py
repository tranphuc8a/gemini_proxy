"""Repository behaviour that the sidebar depends on.

Covers the two things that were silently wrong: `save` dropping `updated_at`, and
the list ordering by creation instead of last activity.
"""

from src.adapter.output.mysql.repositories.conversation_repository import ConversationRepository
from src.adapter.output.mysql.repositories.message_repository import MessageRepository
from src.domain.enums.enums import ERole
from src.domain.models.conversation_domain import ConversationDomain
from src.domain.models.message_domain import MessageDomain
from tests.conftest import run_with_db


def _conversation(cid: str, name: str = "New Conversation", created_at: int = 1_000, updated_at=None):
    return ConversationDomain(id=cid, name=name, created_at=created_at, updated_at=updated_at)


def test_save_then_get_by_id_round_trips():
    async def scenario(db):
        repo = ConversationRepository(db)
        saved = await repo.save(_conversation("c1", name="First"))
        assert saved.id == "c1"
        assert saved.name == "First"

        fetched = await repo.get_by_id("c1")
        assert fetched is not None
        assert fetched.name == "First"

    run_with_db(scenario)


def test_get_by_id_returns_none_when_absent():
    async def scenario(db):
        repo = ConversationRepository(db)
        assert await repo.get_by_id("nope") is None

    run_with_db(scenario)


def test_save_persists_updated_at():
    """Regression: save() used to write `name` only, so every touch was lost."""

    async def scenario(db):
        repo = ConversationRepository(db)
        await repo.save(_conversation("c1", created_at=1_000))

        conv = await repo.get_by_id("c1")
        assert conv is not None
        assert conv.updated_at is None

        conv.updated_at = 2_500
        conv.name = "Renamed"
        await repo.save(conv)

        reloaded = await repo.get_by_id("c1")
        assert reloaded is not None
        assert reloaded.updated_at == 2_500
        assert reloaded.name == "Renamed"

    run_with_db(scenario)


def test_get_all_orders_by_last_activity_not_creation():
    """The oldest conversation should lead the list once it is the most recent."""

    async def scenario(db):
        repo = ConversationRepository(db)
        await repo.save(_conversation("old", created_at=1_000))
        await repo.save(_conversation("new", created_at=3_000))

        items, _ = await repo.get_all(limit=10, after=None, order="desc")
        assert [c.id for c in items] == ["new", "old"]

        # Reply to the older conversation; it should now sort first.
        old = await repo.get_by_id("old")
        assert old is not None
        old.updated_at = 5_000
        await repo.save(old)

        items, _ = await repo.get_all(limit=10, after=None, order="desc")
        assert [c.id for c in items] == ["old", "new"]

    run_with_db(scenario)


def test_get_all_paginates_with_cursor():
    async def scenario(db):
        repo = ConversationRepository(db)
        for i in range(5):
            await repo.save(_conversation(f"c{i}", created_at=1_000 + i))

        first, has_more = await repo.get_all(limit=2, after=None, order="desc")
        assert [c.id for c in first] == ["c4", "c3"]
        assert has_more is True

        second, has_more = await repo.get_all(limit=2, after=first[-1].id, order="desc")
        assert [c.id for c in second] == ["c2", "c1"]
        assert has_more is True

        third, has_more = await repo.get_all(limit=2, after=second[-1].id, order="desc")
        assert [c.id for c in third] == ["c0"]
        assert has_more is False

    run_with_db(scenario)


def test_get_all_reports_message_counts():
    async def scenario(db):
        conv_repo = ConversationRepository(db)
        msg_repo = MessageRepository(db)
        await conv_repo.save(_conversation("c1"))
        await conv_repo.save(_conversation("c2"))
        for i in range(3):
            await msg_repo.save(
                MessageDomain(id=f"m{i}", conversation_id="c1", role=ERole.USER, content="hi", created_at=1_000 + i)
            )

        items, _ = await conv_repo.get_all(limit=10, after=None, order="desc")
        counts = {c.id: c.messages_count for c in items}
        assert counts["c1"] == 3
        assert counts["c2"] == 0

    run_with_db(scenario)


def test_delete_removes_conversation():
    async def scenario(db):
        repo = ConversationRepository(db)
        conv = await repo.save(_conversation("c1"))
        assert await repo.delete(conv) is True
        assert await repo.get_by_id("c1") is None

    run_with_db(scenario)
