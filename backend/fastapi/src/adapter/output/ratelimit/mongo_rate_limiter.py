"""Rate limiter whose counts live in a MongoDB collection, so every instance sees them.

One document per (counter, key, bucket):

    {_id: "<counter>:<sha256 of key>:<bucket>", limiter, subject, bucket, hits, expire_at}

The bucket is a slot of `window / 6` seconds (see `application/utils/rate_limiter`).
Counting is one atomic upsert - `$inc` on the document, `$setOnInsert` for the
fields that are only written when it is created - so two instances adding at the
same moment never lose an event. Asking reads the few documents of the live
buckets by `_id` (no scan). `expire_at` carries a TTL index
(`expireAfterSeconds=0`) that lets the server delete a bucket once no window can
reach it; the query never depends on that deletion happening on time.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from src.adapter.output.mongostore import client as mongo_store
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.utils.rate_limiter import (
    bucket_expires_at,
    bucket_of,
    live_buckets,
    subject_digest,
    wait_seconds,
)

logger = logging.getLogger(__name__)

COLLECTION = "rate_limits"


class MongoRateLimiter(RateLimiterPort):
    def __init__(
        self,
        name: str,
        max_events: int,
        window_seconds: int,
        *,
        clock: Callable[[], float] = time.time,
        collection: str = COLLECTION,
    ):
        if not name or ":" in name:
            raise ValueError("the counter name must be non-empty and contain no ':'")
        self._name = name
        self._max = max(1, int(max_events))
        self._window = max(1, int(window_seconds))
        self._clock = clock
        self._collection_name = collection
        self._indexed = False

    async def _collection(self) -> Any:
        collection = mongo_store.get_collection(self._collection_name)
        if not self._indexed:
            try:
                await collection.create_index("expire_at", expireAfterSeconds=0)
            except Exception as cause:  # noqa: BLE001 - a missing privilege must not stop counting
                logger.warning("Rate limiter %r: no TTL index (%s); old buckets stay until removed by hand",
                               self._name, type(cause).__name__)
            self._indexed = True
        return collection

    def _id(self, subject: str, bucket: int) -> str:
        return f"{self._name}:{subject}:{bucket}"

    async def retry_after(self, key: str) -> Optional[int]:
        now = self._clock()
        subject = subject_digest(key)
        buckets = live_buckets(now, self._window)
        ids = [self._id(subject, bucket) for bucket in buckets]
        collection = await self._collection()
        counts: Dict[int, int] = {}
        async for document in collection.find({"_id": {"$in": ids}}):
            counts[int(document["bucket"])] = int(document["hits"])
        return wait_seconds(counts, now, self._window, self._max)

    async def add(self, key: str) -> None:
        now = self._clock()
        subject = subject_digest(key)
        bucket = bucket_of(now, self._window)
        collection = await self._collection()
        await collection.update_one(
            {"_id": self._id(subject, bucket)},
            {
                "$inc": {"hits": 1},
                "$setOnInsert": {
                    "limiter": self._name,
                    "subject": subject,
                    "bucket": bucket,
                    "expire_at": datetime.fromtimestamp(bucket_expires_at(bucket, self._window), tz=timezone.utc),
                },
            },
            upsert=True,
        )

    async def reset(self, key: Optional[str] = None) -> None:
        collection = await self._collection()
        query: Dict[str, Any] = {"limiter": self._name}
        if key is not None:
            query["subject"] = subject_digest(key)
        await collection.delete_many(query)
