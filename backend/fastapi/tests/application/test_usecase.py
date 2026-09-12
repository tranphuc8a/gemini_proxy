"""Use-case behaviour: conversation CRUD, and the streaming contract.

The streaming tests pin down the contract the browser relies on — every stream
ends in exactly one terminal frame, so a failure is reported rather than looking
like a short but successful answer.
"""

from typing import AsyncIterator, List, Optional

import pytest

from src.adapter.output.mysql.repositories.conversation_repository import ConversationRepository
from src.adapter.output.mysql.repositories.message_repository import MessageRepository
from src.application.exceptions.exceptions import NotFoundError
from src.application.ports.output.gemini_output_port import GeminiOutputPort
from src.application.usecases.conversation_usecase import ConversationUseCase
from src.application.usecases.gemini_usecase import GeminiUseCase
from src.domain.enums.enums import ERole, EStreamEvent
from src.domain.models.message_domain import MessageDomain
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from src.domain.vo.message_request import MessageRequest
from tests.conftest import run_with_db


class FakeGemini(GeminiOutputPort):
    """Gemini stand-in that yields fixed parts, optionally failing part-way."""

    def __init__(self, parts: List[str], fail_after: Optional[int] = None, fail_on_start: bool = False):
        self.parts = parts
        self.fail_after = fail_after
        self.fail_on_start = fail_on_start
        self.seen_history: List[MessageDomain] = []

    async def generate(self, model: str, history: List[MessageDomain]) -> str:
        self.seen_history = list(history)
        return "".join(self.parts)

    async def stream_generate(self, model: str, history: List[MessageDomain]) -> AsyncIterator[str]:
        self.seen_history = list(history)
        if self.fail_on_start:
            raise RuntimeError("upstream refused the connection")
        for i, part in enumerate(self.parts):
            if self.fail_after is not None and i == self.fail_after:
                raise RuntimeError("upstream dropped mid-answer")
            yield part

    async def stop(self) -> None:
        return None

    async def health_check(self) -> bool:
        return True


def _make_gemini_usecase(db, gemini: FakeGemini):
    return GeminiUseCase(gemini, MessageRepository(db), ConversationRepository(db))


def _request(conversation_id: str, content: str = "hello", model: str = "gemini-2.5-flash"):
    return MessageRequest(conversation_id=conversation_id, content=content, model=model)


async def _collect(usecase, request):
    return [event async for event in usecase.query_stream(request)]


# --------------------------------------------------------------------------
# ConversationUseCase
# --------------------------------------------------------------------------

def test_create_then_list_conversation():
    async def scenario(db):
        uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        created = await uc.create_conversation()
        assert created.name == ConversationUseCase.CONVERSATION_NEW_NAME

        listed = await uc.get_conversation_list(limit=10)
        assert [c.id for c in listed.data] == [created.id]
        assert listed.has_more is False
        assert listed.first_id == created.id

    run_with_db(scenario)


def test_update_conversation_renames_and_stamps_activity():
    async def scenario(db):
        uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        created = await uc.create_conversation()

        updated = await uc.update_conversation(ConversationUpdateRequest(id=created.id, name="Renamed by hand"))
        assert updated.name == "Renamed by hand"
        assert updated.updated_at is not None

    run_with_db(scenario)


def test_update_missing_conversation_raises_not_found():
    async def scenario(db):
        uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        with pytest.raises(NotFoundError):
            await uc.update_conversation(ConversationUpdateRequest(id="ghost", name="x"))

    run_with_db(scenario)


def test_delete_conversation():
    async def scenario(db):
        uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        created = await uc.create_conversation()
        assert await uc.delete_conversation(created.id) is True

        listed = await uc.get_conversation_list(limit=10)
        assert listed.data == []

    run_with_db(scenario)


def test_conversation_messages_are_paginated_newest_first():
    async def scenario(db):
        conv_repo, msg_repo = ConversationRepository(db), MessageRepository(db)
        uc = ConversationUseCase(conv_repo, msg_repo)
        created = await uc.create_conversation()
        for i in range(3):
            await msg_repo.save(
                MessageDomain(
                    id=f"m{i}",
                    conversation_id=created.id,
                    role=ERole.USER,
                    content=f"m{i}",
                    created_at=1_000 + i,
                )
            )

        page = await uc.get_conversation_messages(conversation_id=created.id, limit=2, order="desc")
        assert [m.id for m in page.data] == ["m2", "m1"]
        assert page.has_more is True

    run_with_db(scenario)


# --------------------------------------------------------------------------
# GeminiUseCase — titles
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text, expected",
    [
        ("Hello there", "Hello there"),
        ("# Heading question", "Heading question"),
        ("**bold** lead", "bold lead"),
        ("first line\nsecond line", "first line"),
        ("", GeminiUseCase.DEFAULT_CONVERSATION_NAME),
        ("   \n  \n", GeminiUseCase.DEFAULT_CONVERSATION_NAME),
    ],
)
def test_derive_title(text, expected):
    assert GeminiUseCase._derive_title(text) == expected


def test_derive_title_truncates_on_a_word_boundary():
    title = GeminiUseCase._derive_title("word " * 40)
    assert title.endswith("...")
    assert len(title) <= GeminiUseCase.TITLE_MAX_LENGTH + 3


# --------------------------------------------------------------------------
# GeminiUseCase — streaming
# --------------------------------------------------------------------------

def test_stream_ends_with_done_and_persists_the_answer():
    async def scenario(db):
        conv_uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        conv = await conv_uc.create_conversation()
        usecase = _make_gemini_usecase(db, FakeGemini(["Hel", "lo!"]))

        events = await _collect(usecase, _request(conv.id, content="Say hi"))

        assert [e.type for e in events] == [EStreamEvent.DELTA, EStreamEvent.DELTA, EStreamEvent.DONE]
        assert "".join(e.text for e in events if e.text) == "Hello!"

        done = events[-1]
        assert done.conversation_id == conv.id
        assert done.user_message_id and done.message_id

        stored = await MessageRepository(db).get_all_by_conversation(conv.id)
        assert [m.role for m in stored] == [ERole.USER, ERole.MODEL]
        assert stored[-1].content == "Hello!"

    run_with_db(scenario)


def test_stream_reports_a_mid_answer_failure_as_an_error_frame():
    """Regression: a failure used to end the stream silently, which the client
    could not tell apart from a complete answer."""

    async def scenario(db):
        conv_uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        conv = await conv_uc.create_conversation()
        usecase = _make_gemini_usecase(db, FakeGemini(["partial ", "answer"], fail_after=1))

        events = await _collect(usecase, _request(conv.id))

        assert [e.type for e in events] == [EStreamEvent.DELTA, EStreamEvent.ERROR]
        assert "dropped mid-answer" in (events[-1].message or "")

        # Whatever arrived before the failure is kept, not thrown away.
        stored = await MessageRepository(db).get_all_by_conversation(conv.id)
        assert stored[-1].content == "partial "

    run_with_db(scenario)


def test_stream_reports_a_failure_to_start_as_an_error_frame():
    async def scenario(db):
        conv_uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        conv = await conv_uc.create_conversation()
        usecase = _make_gemini_usecase(db, FakeGemini([], fail_on_start=True))

        events = await _collect(usecase, _request(conv.id))

        assert [e.type for e in events] == [EStreamEvent.ERROR]
        assert "refused the connection" in (events[-1].message or "")

    run_with_db(scenario)


def test_first_message_titles_the_conversation_and_records_activity():
    async def scenario(db):
        conv_repo = ConversationRepository(db)
        conv_uc = ConversationUseCase(conv_repo, MessageRepository(db))
        conv = await conv_uc.create_conversation()
        assert conv.name == ConversationUseCase.CONVERSATION_NEW_NAME

        usecase = _make_gemini_usecase(db, FakeGemini(["ok"]))
        await _collect(usecase, _request(conv.id, content="How do I reverse a list in Python?"))

        reloaded = await conv_repo.get_by_id(conv.id)
        assert reloaded is not None
        assert reloaded.name == "How do I reverse a list in Python?"
        assert reloaded.updated_at is not None

    run_with_db(scenario)


def test_a_user_renamed_conversation_is_not_retitled():
    async def scenario(db):
        conv_repo = ConversationRepository(db)
        conv_uc = ConversationUseCase(conv_repo, MessageRepository(db))
        conv = await conv_uc.create_conversation()
        await conv_uc.update_conversation(ConversationUpdateRequest(id=conv.id, name="My notes"))

        usecase = _make_gemini_usecase(db, FakeGemini(["ok"]))
        await _collect(usecase, _request(conv.id, content="something else entirely"))

        reloaded = await conv_repo.get_by_id(conv.id)
        assert reloaded is not None
        assert reloaded.name == "My notes"

    run_with_db(scenario)


def test_an_error_frame_names_the_question_it_stored():
    async def scenario(db):
        conv_uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        conv = await conv_uc.create_conversation()
        usecase = _make_gemini_usecase(db, FakeGemini([], fail_on_start=True))

        events = await _collect(usecase, _request(conv.id))

        stored = await MessageRepository(db).get_all_by_conversation(conv.id)
        assert events[-1].user_message_id == stored[0].id

    run_with_db(scenario)


def test_retrying_with_the_same_message_id_does_not_file_the_question_twice():
    """A failed attempt has already stored the question; re-asking it should
    update that record, not add a second copy."""

    async def scenario(db):
        conv_uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        conv = await conv_uc.create_conversation()
        msg_repo = MessageRepository(db)

        failing = await _collect(
            _make_gemini_usecase(db, FakeGemini([], fail_on_start=True)),
            _request(conv.id, content="why is the sky blue?"),
        )
        question_id = failing[-1].user_message_id
        assert question_id

        retry = MessageRequest(
            conversation_id=conv.id,
            content="why is the sky blue?",
            model="gemini-2.5-flash",
            message_id=question_id,
        )
        await _collect(_make_gemini_usecase(db, FakeGemini(["because physics"])), retry)

        stored = await msg_repo.get_all_by_conversation(conv.id)
        assert [m.role for m in stored] == [ERole.USER, ERole.MODEL]
        assert stored[0].id == question_id

    run_with_db(scenario)


def test_message_content_reaches_the_model_unescaped():
    """Regression: content used to be HTML-escaped before being stored and sent."""

    async def scenario(db):
        conv_uc = ConversationUseCase(ConversationRepository(db), MessageRepository(db))
        conv = await conv_uc.create_conversation()
        gemini = FakeGemini(["ok"])
        usecase = _make_gemini_usecase(db, gemini)

        raw = 'if (a < b && c > d) { return "x"; }'
        await _collect(usecase, _request(conv.id, content=raw))

        assert any(m.content == raw for m in gemini.seen_history)
        stored = await MessageRepository(db).get_all_by_conversation(conv.id)
        assert stored[0].content == raw

    run_with_db(scenario)
