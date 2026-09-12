
import threading
import time
import uuid

# Guards the monotonic clock below. Ids are minted from request handlers running
# on an event loop, but also from worker threads, so a plain lock is the simplest
# thing that is correct in both.
_id_lock = threading.Lock()
_last_millis = 0
_sequence = 0


def _next_ordered_parts() -> tuple[int, int]:
    """Return a (millis, sequence) pair that strictly increases within a process.

    The sequence disambiguates ids minted inside the same millisecond, and pins
    `millis` if the wall clock steps backwards (NTP correction, DST on a naive
    clock), so ids never go backwards either.
    """
    global _last_millis, _sequence
    with _id_lock:
        millis = int(time.time() * 1000)
        if millis > _last_millis:
            _last_millis = millis
            _sequence = 0
        else:
            millis = _last_millis
            _sequence += 1
        return millis, _sequence


def generate_unique_id(prefix: str = "") -> str:
    """Return a unique id that also sorts by creation time.

    `created_at` has one-second resolution, so a conversation's messages routinely
    tie on it and the queries fall back to ordering by id. A random uuid made that
    fallback arbitrary: a question and its answer, or two quick messages, could
    come back in either order — both in the transcript and in the history sent to
    the model. Embedding the creation time in the id makes the lexicographic
    tie-break chronological.

    Fields are zero-padded so string ordering matches numeric ordering: 13 digits
    of milliseconds (good until the year 2286), then the intra-millisecond
    sequence, then random bits to keep ids unique across processes.
    """
    prefix = f"{prefix}-" if prefix and not prefix.endswith("-") else prefix
    millis, sequence = _next_ordered_parts()
    return f"{prefix}{millis:013d}-{sequence:04d}-{uuid.uuid4().hex[:8]}"


def get_current_timestamp() -> int:
    return int(time.time())
