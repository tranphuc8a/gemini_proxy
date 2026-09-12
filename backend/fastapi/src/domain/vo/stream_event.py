from typing import Optional

from pydantic import BaseModel

from src.domain.enums.enums import EStreamEvent


class StreamEvent(BaseModel):
    """One frame of a streaming answer, as seen by the controller.

    The use case emits these instead of bare strings so a failure part-way
    through a stream is reportable. Previously an upstream error simply ended the
    iteration, and the client could not tell a finished answer from a broken one.

    - DELTA carries `text`, the next fragment of the answer.
    - DONE is the final frame of a successful stream and carries the ids the
      messages were persisted under, so the client can replace its optimistic
      placeholders with real records.
    - ERROR is the final frame of a failed stream and carries `message`, plus the
      id the question was persisted under so a retry can reuse it.
    """

    type: EStreamEvent
    text: Optional[str] = None
    conversation_id: Optional[str] = None
    user_message_id: Optional[str] = None
    message_id: Optional[str] = None
    message: Optional[str] = None

    @classmethod
    def delta(cls, text: str) -> "StreamEvent":
        return cls(type=EStreamEvent.DELTA, text=text)

    @classmethod
    def done(
        cls,
        conversation_id: Optional[str] = None,
        user_message_id: Optional[str] = None,
        message_id: Optional[str] = None,
    ) -> "StreamEvent":
        return cls(
            type=EStreamEvent.DONE,
            conversation_id=conversation_id,
            user_message_id=user_message_id,
            message_id=message_id,
        )

    @classmethod
    def error(cls, message: str, user_message_id: Optional[str] = None) -> "StreamEvent":
        """A failed attempt.

        `user_message_id` names the record the question was stored under, so a
        client retrying the question can reuse it instead of filing a second copy.
        """
        return cls(type=EStreamEvent.ERROR, message=message, user_message_id=user_message_id)
