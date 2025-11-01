"""Smart validators and sanitizers for domain inputs.

Goals:
- Allow diverse message content (markdown, code blocks, URLs, emoji) while
  protecting against obvious XSS/JS execution and large abusive inputs.
- Provide flexible length/token checks and lightweight sanitization without
  adding heavy dependencies.
"""

from __future__ import annotations

import re
import html
from typing import Optional, Tuple
from urllib.parse import urlparse

from src.domain.enums.enums import EModel, ERole, ESortOrder


_SCRIPT_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_ON_ATTR_RE = re.compile(r"on\w+\s*=", re.IGNORECASE)
_JS_URI_RE = re.compile(r"javascript:\s*", re.IGNORECASE)
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
    try:
        return EModel.from_str(value)
    except ValueError:
        # allow unknown model names but ensure it's a sane token (no control chars)
        s = validate_non_empty_string(value, "model")
        if _CONTROL_CHARS_RE.search(s):
            raise ValueError("Model name contains invalid control characters")
        return EModel.GPT_4 if not s else EModel.from_str(s) if s.lower() in {m.value for m in EModel} else EModel.GPT_4


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


def _basic_sql_like_check(s: str) -> bool:
    # detect likely SQL with keywords and semicolon; but allow SQL-like text in codeblocks
    upper = s.upper()
    keywords = ["DROP ", "DELETE ", "INSERT ", "UPDATE ", "SELECT ", "ALTER ", "TRUNCATE "]
    if ";" in s and any(k in upper for k in keywords):
        return True
    return False


def sanitize_message_content(s: str) -> str:
    """Lightweight sanitization that removes executable HTML/JS vectors but
    preserves user content (markdown, code fences, URLs, emoji).

    This is intentionally conservative — it's not a full HTML sanitizer like
    `bleach`, but removes the most common attack vectors:
    - <script>...</script>
    - event handler attributes like onClick=
    - javascript: URIs
    - control characters and null bytes
    """
    if s is None:
        return s

    # Remove script blocks
    s = _SCRIPT_RE.sub("", s)

    # Remove event handler attributes (onXYZ=)
    s = _ON_ATTR_RE.sub("", s)

    # Neutralize javascript: URIs
    s = _JS_URI_RE.sub("", s)

    # Remove control characters (except newline, tab)
    s = _CONTROL_CHARS_RE.sub("", s)

    # Escape any remaining angle brackets so they render as text
    s = html.escape(s)

    # But allow common markdown code fences to remain readable (unescape backticks)
    s = s.replace("&lt;`","<`").replace("`&gt;","`>")

    return s


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
                             max_tokens: int = 20000,
                             allow_sql_snippets: bool = False) -> str:
    """Validate and sanitize a user-supplied message.

    - Allows diverse content (markdown, URLs, code) but strips executable HTML/JS.
    - Optionally rejects likely SQL that contains keywords + semicolon unless
      `allow_sql_snippets=True`.
    - Enforces length and token-based upper bounds.
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

    # SQL-like content: be permissive by default but allow opt-out
    if not allow_sql_snippets and _basic_sql_like_check(value):
        raise ValueError(f"{field_name} looks like SQL and is not allowed in this context.")

    return s


def validate_conversation_name(value: str, field_name: str = "conversation_name") -> str:
    s = validate_non_empty_string(value, field_name)
    s = s.strip()
    validate_string_length(s, field_name, min_length=1, max_length=200)
    # sanitize title lightly
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


