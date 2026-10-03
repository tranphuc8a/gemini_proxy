"""AI features: access, status and spending; the features add their routes here.

    GET  /ai/status     what this caller may do (pages decide how to offer AI)
    POST /ai/session    access code → AI token (when AI_ACCESS="code")
    GET  /ai/usage      requests and tokens per day and feature        [admin]
    POST /ai/tutor      the tutor beside a lesson: summary, explain, quiz, ask, cards
    POST /ai/ask        a question about anything in the published courses, with citations
    POST /ai/draft/outline   a course outline from a topic / text / URL / PDF  [admin]
    POST /ai/draft/lesson    one lesson of that outline, as markdown           [admin]
    POST /ai/opic       feedback on a recorded OPIc answer (audio → transcript, level, fixes)

A caller is identified by the headers the course pages already send:
`X-Admin-Session` / `X-Admin-Key` (course administrator) and `X-AI-Session`
(a token issued for `AI_ACCESS_CODE`). Answers are bare JSON like the course
API; errors use the common envelope with `data.code`.
"""

from __future__ import annotations

from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.adapter.factory.ai_factory import (get_ai_course_usecase, get_ai_draft_usecase, get_ai_speaking_usecase,
                                            get_ai_usecase)
from src.adapter.input.controllers.admin_auth import client_address, is_admin, require_admin
from src.application.usecases import ai_usecase
from src.application.usecases.ai_course_usecase import SELECTION_CHARS, AiCourseUseCase
from src.application.usecases.ai_draft_usecase import AiDraftUseCase
from src.application.usecases.ai_speaking_usecase import AiSpeakingUseCase
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller

router = APIRouter(prefix="/ai", tags=["ai"])


def ai_caller(
    request: Request,
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
    x_ai_session: Optional[str] = Header(default=None),
) -> AiCaller:
    return AiCaller(ip=client_address(request), admin=is_admin(x_admin_key, x_admin_session),
                    code=ai_usecase.code_session_valid(x_ai_session))


class CodeLogin(BaseModel):
    code: str = Field(default="", max_length=200)


class TutorAsk(BaseModel):
    course: str = Field(..., min_length=1, max_length=63)
    doc: str = Field(..., min_length=1, max_length=300)
    action: Literal["summary", "explain", "quiz", "ask", "cards"]
    question: str = Field(default="", max_length=1000)
    selection: str = Field(default="", max_length=SELECTION_CHARS)
    # Another set of quiz questions for the same lesson (a separate cache entry).
    variant: int = Field(default=0, ge=0, le=20)


Level = Literal["co-ban", "trung-cap", "nang-cao"]


class DraftOutline(BaseModel):
    topic: str = Field(default="", max_length=500)
    text: str = Field(default="", max_length=200_000)
    url: str = Field(default="", max_length=2000)
    # Base64 of a PDF up to ~3 MB: serverless platforms cap the request body (Vercel: 4.5 MB).
    # A larger PDF can still be given by URL.
    pdf: str = Field(default="", max_length=4_200_000)
    level: Level = "co-ban"
    lessons: int = Field(default=8, ge=2, le=24)
    notes: str = Field(default="", max_length=2000)


class AskAll(BaseModel):
    q: str = Field(..., min_length=1, max_length=1000)


class OpicAnswer(BaseModel):
    question: str = Field(..., min_length=1, max_length=600)
    questionVi: str = Field(default="", max_length=400)
    kind: str = Field(default="", max_length=80)
    script: str = Field(default="", max_length=6000)
    # Base64 of up to ~3 MB of audio (Vercel caps the request body at 4.5 MB).
    audio: str = Field(..., min_length=1, max_length=4_200_000)
    mime: str = Field(default="audio/wav", max_length=60)
    seconds: int = Field(default=0, ge=0, le=900)


class DraftCourse(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=600)


class DraftLessonPlan(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    summary: str = Field(default="", max_length=600)
    points: List[Annotated[str, Field(max_length=300)]] = Field(default_factory=list, max_length=12)
    notes: str = Field(default="", max_length=4000)


class DraftLesson(BaseModel):
    course: DraftCourse
    outline: List[Annotated[str, Field(max_length=160)]] = Field(default_factory=list, max_length=48)
    part: str = Field(default="", max_length=120)
    lesson: DraftLessonPlan
    level: Level = "co-ban"
    notes: str = Field(default="", max_length=2000)


@router.get("/status")
async def ai_status(caller: AiCaller = Depends(ai_caller)):
    return JSONResponse(AiUseCase.status(caller), headers={"Cache-Control": "no-store"})


@router.post("/session")
async def ai_session(body: CodeLogin, request: Request):
    issued = ai_usecase.issue_code_session(body.code, client_address(request))
    return {"ok": True, "session": issued.token, "expiresAt": issued.expires_at}


@router.post("/tutor")
async def ai_tutor(body: TutorAsk, caller: AiCaller = Depends(ai_caller),
                   uc: AiCourseUseCase = Depends(get_ai_course_usecase)):
    return JSONResponse(await uc.tutor(caller, **body.model_dump()), headers={"Cache-Control": "no-store"})


@router.post("/ask")
async def ai_ask(body: AskAll, caller: AiCaller = Depends(ai_caller),
                 uc: AiCourseUseCase = Depends(get_ai_course_usecase)):
    return JSONResponse(await uc.answer(caller, question=body.q), headers={"Cache-Control": "no-store"})


@router.post("/opic")
async def ai_opic(body: OpicAnswer, caller: AiCaller = Depends(ai_caller),
                  uc: AiSpeakingUseCase = Depends(get_ai_speaking_usecase)):
    out = await uc.opic(caller, question=body.question, question_vi=body.questionVi, kind=body.kind,
                        script=body.script, audio=body.audio, mime=body.mime, seconds=body.seconds)
    return JSONResponse(out, headers={"Cache-Control": "no-store"})


@router.post("/draft/outline", dependencies=[Depends(require_admin)])
async def ai_draft_outline(body: DraftOutline, caller: AiCaller = Depends(ai_caller),
                           uc: AiDraftUseCase = Depends(get_ai_draft_usecase)):
    return JSONResponse(await uc.outline(caller, **body.model_dump()), headers={"Cache-Control": "no-store"})


@router.post("/draft/lesson", dependencies=[Depends(require_admin)])
async def ai_draft_lesson(body: DraftLesson, caller: AiCaller = Depends(ai_caller),
                          uc: AiDraftUseCase = Depends(get_ai_draft_usecase)):
    out = await uc.lesson(caller, course=body.course.model_dump(), outline=body.outline, part=body.part,
                          lesson=body.lesson.model_dump(), level=body.level, notes=body.notes)
    return JSONResponse(out, headers={"Cache-Control": "no-store"})


@router.get("/usage", dependencies=[Depends(require_admin)])
async def ai_usage(days: int = Query(30, ge=1, le=90), uc: AiUseCase = Depends(get_ai_usecase)):
    return JSONResponse(await uc.usage(days), headers={"Cache-Control": "no-store"})
