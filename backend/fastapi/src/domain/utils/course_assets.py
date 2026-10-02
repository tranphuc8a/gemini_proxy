"""Files uploaded to a course: which ones, under what name, served as what.

The media type is decided HERE from the extension, never taken from the
uploader: a file is served from the same origin as the course pages and the
management page, so "an image" that is really HTML would be a stored XSS. For
the same reason there is no HTML, JavaScript or XML on the list, and SVG — which
can carry script — is served with a sandboxing Content-Security-Policy by the
controller.
"""

from __future__ import annotations

import posixpath
import re
from typing import Optional

from src.domain.utils.course_text import fold

MEDIA_TYPES = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp",
    "svg": "image/svg+xml", "avif": "image/avif",
    "pdf": "application/pdf", "txt": "text/plain; charset=utf-8", "csv": "text/csv; charset=utf-8",
    "json": "application/json", "zip": "application/zip", "mp3": "audio/mpeg", "mp4": "video/mp4",
    "py": "text/plain; charset=utf-8", "ipynb": "application/json",
}
IMAGE_EXTENSIONS = frozenset({"png", "jpg", "jpeg", "gif", "webp", "svg", "avif"})
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,119}$")


def clean_name(raw: str) -> str:
    """"Ảnh Chụp màn hình (2).PNG" → "anh-chup-man-hinh-2.png"."""
    base = posixpath.basename((raw or "").replace("\\", "/")).strip()
    stem, dot, ext = base.rpartition(".")
    if not dot:
        stem, ext = base, ""
    stem = re.sub(r"[^a-z0-9]+", "-", fold(stem)).strip("-")[:100] or "tep"
    ext = re.sub(r"[^a-z0-9]", "", ext.lower())[:8]
    return stem + ("." + ext if ext else "")


def media_type(name: str) -> Optional[str]:
    ext = name.rpartition(".")[2].lower() if "." in name else ""
    return MEDIA_TYPES.get(ext)


def is_image(name: str) -> bool:
    return name.rpartition(".")[2].lower() in IMAGE_EXTENSIONS
