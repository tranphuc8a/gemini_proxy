"""The one content hash of the markdown features (ke-hoach §1.2).

`markdown_share` stores it with every snapshot (the editor compares it with the open
document to say "changed since this snapshot") and the markdown sync (md-sync) uses
the same digest for its `baseHash`/`hash` fields. Both sides must agree byte for
byte with the browser's `src/lib/hash.ts`: SHA-256 of the UTF-8 encoding, lowercase
hex. Keep it that way - the values are persisted.
"""

from __future__ import annotations

import hashlib


def sha256_hex(text: str) -> str:
    """Lowercase hex SHA-256 of `text` encoded as UTF-8 (`""` hashes too)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
