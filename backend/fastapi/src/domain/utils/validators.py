"""Smart validators and sanitizers for domain inputs.

Goals:
- Store what the user actually typed. Message content is prose bound for an LLM,
  so rewriting it here corrupts both the stored record and the prompt we send
  upstream: `if (a < b)` must not become `if (a &lt; b)`.
- Reject only what is genuinely invalid as text (control characters) or abusive
  in size (length / token ceilings).
- Escaping is the *renderer's* job, not the store's. The web client renders
  message content as Markdown with raw HTML disabled, so untrusted angle
  brackets are inert at the point they are displayed.
"""

from __future__ import annotations

import re
from typing import Optional, Tuple
from urllib.parse import urlparse

from src.domain.enums.enums import EModel, ERole, ESortOrder

# Used when a caller names a model this enum does not know about yet.
DEFAULT_MODEL = EModel.GEMINI_2_5_FLASH


_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]")


def validate_non_empty_string(value: str, field_name: str) -> str:
    if value is None:
        raise ValueError(f"{field_name} must be provided and be a non-empty string.")
    s = str(value).strip()
    if not s:
        raise ValueError(f"{field_name} must be a non-empty string.")
    return s


def validate_string_length(value: str, field_name: str, min_length: int = 1, max_length: Optional[int] = 100) -> str:
    s = str(value)
    length = len(s)
    if length < min_length:
        raise ValueError(f"{field_name} must be at least {min_length} characters long.")
    if max_length is not None and length > max_length:
        raise ValueError(f"{field_name} must be at most {max_length} characters long.")
    return s


def validate_positive_integer(value: int, field_name: str) -> int:
    if not isinstance(value, int) or value <= 0:
        raise ValueError(f"{field_name} must be a positive integer.")
    return value


def validate_range_integer(value: int, field_name: str, min_value: int, max_value: int) -> int:
    if not isinstance(value, int) or value < min_value or value > max_value:
        raise ValueError(f"{field_name} must be between {min_value} and {max_value}.")
    return value


def validate_role(value: str) -> ERole:
    try:
        return ERole.from_str(value)
    except ValueError as exc:
        raise ValueError(f"Role is invalid: {exc}") from exc


def validate_model_name(value: str) -> EModel:
    """Resolve a model name to an EModel member.

    An unrecognised but well-formed name falls back to DEFAULT_MODEL rather than
    failing, so a client asking for a model id newer than this enum still gets an
    answer.
    """
    try:
        return EModel.from_str(value)
    except ValueError:
        # allow unknown model names but ensure it's a sane token (no control chars)
        s = validate_non_empty_string(value, "model")
        if _CONTROL_CHARS_RE.search(s):
            raise ValueError("Model name contains invalid control characters")
        return DEFAULT_MODEL


def validate_order(value: str) -> ESortOrder:
    try:
        return ESortOrder.from_str(value)
    except ValueError as exc:
        raise ValueError(f"Order is invalid: {exc}") from exc


def validate_pagination_params(limit: int, offset: int, max_limit: int = 100) -> Tuple[int, int]:
    limit = int(limit)
    offset = int(offset)
    if limit < 1 or limit > max_limit:
        raise ValueError(f"Limit must be between 1 and {max_limit}.")
    if offset < 0:
        raise ValueError("Offset must be a non-negative integer.")
    return limit, offset


def validate_timestamp(value: int, field_name: str) -> int:
    if not isinstance(value, int) or value < 0:
        raise ValueError(f"{field_name} must be a non-negative integer representing a timestamp.")
    return value


def sanitize_message_content(s: str) -> str:
    """Strip characters that are not legal text, and nothing else.

    Only C0/C1 control characters (minus tab, newline and carriage return) are
    removed: they have no meaning in a chat message, break JSON transport and can
    confuse the upstream model. Everything a user can actually type — angle
    brackets, ampersands, quotes, code fences, URLs, emoji — is preserved
    verbatim, because this value is both the stored record and the prompt sent to
    Gemini. See the module docstring for why escaping does not belong here.
    """
    if s is None:
        return s

    return _CONTROL_CHARS_RE.sub("", s)


def estimate_tokens(text: str) -> int:
    """Very rough token estimator. For English-like text, assume ~4 characters/token.
    This is only for quick guardrails; for exact token counts use model tokenizer.
    """
    if not text:
        return 0
    # Count words as base and refine with char length
    words = len(re.findall(r"\S+", text))
    approx_by_chars = max(1, round(len(text) / 4))
    # Mix words and char-based estimate to be more robust across languages
    return max(words, approx_by_chars)


def validate_message_content(value: str,
                             field_name: str = "message",
                             min_length: int = 1,
                             max_length: int = 20000,
                             max_tokens: int = 20000) -> str:
    """Validate a user-supplied message and return it unchanged apart from
    trimming and control-character removal.

    Content is *not* rewritten: a question about SQL, HTML or JavaScript is a
    legitimate thing to ask a chat model, and the previous keyword-based
    rejection turned "how do I write SELECT ...; ?" into an error. Only length
    and token ceilings can reject a message here.
    """
    s = validate_non_empty_string(value, field_name)
    s = s.strip()
    s = sanitize_message_content(s)

    # length checks
    validate_string_length(s, field_name, min_length=min_length, max_length=max_length)

    # tokens
    tokens = estimate_tokens(s)
    if tokens > max_tokens:
        raise ValueError(f"{field_name} is too large: ~{tokens} tokens (max {max_tokens}).")

    return s


def validate_conversation_name(value: str, field_name: str = "conversation_name") -> str:
    s = validate_non_empty_string(value, field_name)
    s = s.strip()
    validate_string_length(s, field_name, min_length=1, max_length=200)
    return sanitize_message_content(s)


def validate_url(value: str, field_name: str = "url") -> str:
    s = validate_non_empty_string(value, field_name)
    parsed = urlparse(s)
    if parsed.scheme not in {"http", "https", "ftp"}:
        raise ValueError(f"{field_name} must be an http/https/ftp URL.")
    if not parsed.netloc:
        raise ValueError(f"{field_name} must include a network location (domain).")
    return s


def validate_email(value: str, field_name: str = "email") -> str:
    s = validate_non_empty_string(value, field_name)
    email_regex = re.compile(r'^[\w\.-]+@[\w\.-]+\.\w+$')
    if not email_regex.match(s):
        raise ValueError(f"{field_name} must be a valid email address.")
    return s


def validate_uuid(value: str, field_name: str = "uuid") -> str:
    uuid_regex = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\Z', re.I)
    if not uuid_regex.match(str(value)):
        raise ValueError(f"{field_name} must be a valid UUID.")
    return value


