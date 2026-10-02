from typing import List, Optional

from fastapi import Request
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqlalchemy import select
from starlette.middleware.sessions import SessionMiddleware

from src.adapter.output.mysql.db.base import get_async_engine, get_async_session
from src.adapter.output.mysql.entities import (
    ConversationEntity,
    CourseDocEntity,
    CourseEntity,
    CourseGroupEntity,
    CourseSectionEntity,
    MessageEntity,
)
from src.adapter.output.mysql.repositories.course_repository import CourseRepository
from src.application.config.config import settings
from src.application.usecases.course_usecase import reset_search_cache


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


async def _course_of_section(section_id) -> Optional[int]:
    if not section_id:
        return None
    session = get_async_session()
    try:
        return (await session.execute(
            select(CourseSectionEntity.course_id).where(CourseSectionEntity.id == int(section_id))
        )).scalar_one_or_none()
    finally:
        await session.close()


async def _touch_courses(*course_ids) -> None:
    """After an edit made here, do what the course API does after its own edits:
    recompute each course's stats and bump its version, so browsers revalidate
    the manifest and the search index is rebuilt. A course that no longer
    exists is skipped; the search cache is dropped either way."""
    for course_id in dict.fromkeys(int(c) for c in course_ids if c):
        session = get_async_session()
        try:
            await CourseRepository(session).touch_course(course_id)
        finally:
            await session.close()
    reset_search_cache()


class _TouchesCourses:
    """Keeps a course's version honest whatever sqladmin changes under it.

    The ids are taken twice: before the write (an edit can MOVE a row to
    another course, and a deleted row can no longer be read after the commit)
    and after it. Both courses are touched.
    """

    async def _course_ids(self, model) -> List[Optional[int]]:
        raise NotImplementedError

    async def on_model_change(self, data, model, is_created, request) -> None:
        request.state.course_ids_before = [] if is_created else await self._course_ids(model)

    async def after_model_change(self, data, model, is_created, request) -> None:
        before = getattr(request.state, "course_ids_before", None) or []
        await _touch_courses(*before, *(await self._course_ids(model)))

    async def on_model_delete(self, model, request) -> None:
        request.state.course_ids_before = await self._course_ids(model)

    async def after_model_delete(self, model, request) -> None:
        await _touch_courses(*(getattr(request.state, "course_ids_before", None) or []))


class CourseAdmin(_TouchesCourses, ModelView, model=CourseEntity):
    name = "Course"
    name_plural = "Courses"
    icon = "fa-solid fa-graduation-cap"
    category = "Courses"
    column_list = [CourseEntity.id, CourseEntity.slug, CourseEntity.title, CourseEntity.published,
                   CourseEntity.version, CourseEntity.updated_at]
    column_searchable_list = [CourseEntity.slug, CourseEntity.title]
    column_sortable_list = [CourseEntity.slug, CourseEntity.title, CourseEntity.updated_at]
    # The tree and the documents are edited through the API / their own views;
    # stats and version are maintained, never typed in.
    form_excluded_columns = [CourseEntity.sections, CourseEntity.docs, CourseEntity.stats,
                             CourseEntity.version, CourseEntity.created_at, CourseEntity.updated_at]

    async def _course_ids(self, model) -> List[Optional[int]]:
        return [model.id]


class CourseSectionAdmin(_TouchesCourses, ModelView, model=CourseSectionEntity):
    name = "Course section"
    name_plural = "Course sections"
    icon = "fa-solid fa-folder-tree"
    category = "Courses"
    column_list = [CourseSectionEntity.id, CourseSectionEntity.course, CourseSectionEntity.sec_id,
                   CourseSectionEntity.title, CourseSectionEntity.sort_order]
    form_excluded_columns = [CourseSectionEntity.groups]

    async def _course_ids(self, model) -> List[Optional[int]]:
        return [model.course_id]


class CourseGroupAdmin(_TouchesCourses, ModelView, model=CourseGroupEntity):
    name = "Course group"
    name_plural = "Course groups"
    icon = "fa-solid fa-layer-group"
    category = "Courses"
    column_list = [CourseGroupEntity.id, CourseGroupEntity.section, CourseGroupEntity.short,
                   CourseGroupEntity.title, CourseGroupEntity.sort_order]
    column_searchable_list = [CourseGroupEntity.title, CourseGroupEntity.short]
    form_excluded_columns = [CourseGroupEntity.docs]

    async def _course_ids(self, model) -> List[Optional[int]]:
        return [await _course_of_section(model.section_id)]


class CourseDocAdmin(_TouchesCourses, ModelView, model=CourseDocEntity):
    name = "Course document"
    name_plural = "Course documents"
    icon = "fa-solid fa-file-lines"
    category = "Courses"
    page_size = 25
    column_list = [CourseDocEntity.id, CourseDocEntity.course, CourseDocEntity.doc_id, CourseDocEntity.title,
                   CourseDocEntity.kind, CourseDocEntity.words, CourseDocEntity.updated_at]
    column_searchable_list = [CourseDocEntity.doc_id, CourseDocEntity.title, CourseDocEntity.slug]
    column_sortable_list = [CourseDocEntity.doc_id, CourseDocEntity.title, CourseDocEntity.words,
                            CourseDocEntity.updated_at]
    # Derived from md by an ORM event; showing them as inputs would invite edits
    # that the next save silently overwrites.
    form_excluded_columns = [CourseDocEntity.outline, CourseDocEntity.words, CourseDocEntity.code_lines,
                             CourseDocEntity.minutes, CourseDocEntity.title_folded, CourseDocEntity.heads_folded,
                             CourseDocEntity.body_folded, CourseDocEntity.updated_at]
    column_details_exclude_list = [CourseDocEntity.title_folded, CourseDocEntity.heads_folded,
                                   CourseDocEntity.body_folded]

    async def _course_ids(self, model) -> List[Optional[int]]:
        return [model.course_id]


def setup_admin(app) -> Admin:
    app.add_middleware(SessionMiddleware, secret_key=settings.ADMIN_SECRET_KEY)
    authentication_backend = AdminAuthentication(secret_key=settings.ADMIN_SECRET_KEY)
    admin = Admin(app, get_async_engine(), authentication_backend=authentication_backend)
    admin.add_view(ConversationAdmin)
    admin.add_view(MessageAdmin)
    admin.add_view(CourseAdmin)
    admin.add_view(CourseSectionAdmin)
    admin.add_view(CourseGroupAdmin)
    admin.add_view(CourseDocAdmin)
    return admin