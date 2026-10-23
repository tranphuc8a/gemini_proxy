"""The pieces every read-only link shares (application/utils/share_links.py) and the
markdown share value objects (domain/vo/markdown_share_vo.py, markdown_ids.py)."""

import hashlib
import re

import pytest
from pydantic import ValidationError

from src.application.exceptions.exceptions import AppException
from src.application.utils.hashing import sha256_hex
from src.application.utils.rate_limit import FailureWindow
from src.application.utils.rate_limiter import MemoryRateLimiter
from src.application.utils.share_links import (
    TOKEN_SHAPE,
    PublicReadGuard,
    content_hash,
    new_share_token,
    rate_limited,
    token_well_formed,
)
from src.domain.vo.markdown_ids import DOC_ID_PATTERN, UNSHAREABLE_DOC_IDS, is_doc_id
from src.domain.vo.markdown_share_vo import MarkdownShareIn
from tests.conftest import arun


# ------------------------------------------------------------------ tokens
def test_a_token_is_22_url_safe_characters_and_never_repeats():
    tokens = {new_share_token() for _ in range(2000)}
    assert len(tokens) == 2000
    assert all(re.fullmatch(r"[A-Za-z0-9_-]{22}", token) for token in tokens)
    assert all(TOKEN_SHAPE.fullmatch(token) for token in tokens)


@pytest.mark.parametrize("token", ["", None, "short", "../etc/passwd-xxxxxxxx", "a" * 101, "a b" * 10, "tok\nen" * 4],
                         ids=["empty", "none", "short", "path", "101", "space", "newline"])
def test_malformed_tokens_are_recognised(token):
    assert not token_well_formed(token)


def test_a_well_formed_token_passes():
    assert token_well_formed("A" * 16) and token_well_formed("a_b-" * 25)


# ------------------------------------------------------------------- hash
@pytest.mark.parametrize("text", ["", "abc", "Đồng bộ tài liệu — phiên bản 2", "ệ" * 70000, "a\r\nb\n"],
                         ids=["empty", "abc", "vietnamese", "70k-multibyte", "crlf"])
def test_the_content_hash_is_sha256_of_utf8(text):
    expected = hashlib.sha256(text.encode("utf-8")).hexdigest()
    assert sha256_hex(text) == expected == content_hash(text)


def test_known_vectors():
    assert sha256_hex("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert sha256_hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


# ---------------------------------------------------------------- the 429
def test_rate_limited_carries_retry_after_in_body_and_header():
    error = rate_limited("x_rate", "chậm lại", 7)
    assert isinstance(error, AppException)
    assert error.status_code == 429
    assert error.payload == {"code": "x_rate", "retryAfter": 7}
    assert error.headers == {"Retry-After": "7"}


# ------------------------------------------------------------------ guard
def test_the_guard_counts_reads_then_refuses():
    guard = PublicReadGuard(MemoryRateLimiter(3, 60), MemoryRateLimiter(20, 600), code="c")

    async def scenario():
        for _ in range(3):
            await guard.admit("1.2.3.4")
        with pytest.raises(AppException) as caught:
            await guard.admit("1.2.3.4")
        await guard.admit("5.6.7.8")              # another address is not affected
        return caught.value

    error = arun(scenario())
    assert error.status_code == 429 and error.payload["retryAfter"] >= 1


def test_wrong_tokens_lock_the_address_before_reads_are_even_counted():
    reads = FailureWindow(1000, 60)
    misses = FailureWindow(2, 600)
    guard = PublicReadGuard(reads, misses, code="c")

    async def scenario():
        await guard.missed("9.9.9.9")
        await guard.missed("9.9.9.9")
        with pytest.raises(AppException) as caught:
            await guard.admit("9.9.9.9")
        return caught.value

    error = arun(scenario())
    assert error.status_code == 429
    assert "sai quá nhiều" in error.message
    assert reads.retry_after("9.9.9.9") is None and len(reads._events.get("9.9.9.9", [])) == 0


def test_an_empty_address_is_never_limited():
    guard = PublicReadGuard(MemoryRateLimiter(1, 60), MemoryRateLimiter(1, 600), code="c")

    async def scenario():
        for _ in range(5):
            await guard.missed("")
            await guard.admit("")

    arun(scenario())


def test_a_guard_without_counters_admits_everything():
    arun(PublicReadGuard(code="c").admit("1.1.1.1"))


# --------------------------------------------------------------------- VO
def test_doc_id_shape_is_the_one_md_sync_uses():
    assert DOC_ID_PATTERN == r"^[A-Za-z0-9_.:-]{1,80}$"
    assert is_doc_id("file-lz3k-1-abcde") and is_doc_id("welcome") and is_doc_id("a.b:c_d")
    assert not is_doc_id("") and not is_doc_id("a b") and not is_doc_id("x" * 81) and not is_doc_id("đ")
    assert "root" in UNSHAREABLE_DOC_IDS


def test_vo_refuses_an_expiry_outside_the_choices():
    with pytest.raises(ValidationError):
        MarkdownShareIn(docId="d", title="t", content="", expiresInDays=3)
    for days in (None, 1, 7, 30):
        assert MarkdownShareIn(docId="d", title="t", expiresInDays=days).expiresInDays == days


@pytest.mark.parametrize("doc_id", ["", "a b", "a\nb", "x" * 81, "../x", "đ"])
def test_vo_refuses_a_malformed_doc_id(doc_id):
    with pytest.raises(ValidationError):
        MarkdownShareIn(docId=doc_id, title="t")


def test_vo_refuses_a_title_over_200_and_a_mode_other_than_snapshot():
    with pytest.raises(ValidationError):
        MarkdownShareIn(docId="d", title="t" * 201)
    with pytest.raises(ValidationError):
        MarkdownShareIn(docId="d", title="t", mode="live")
