"""Where this process is allowed to write its JSON data files.

Every JSON-file store in the app used to resolve its path against `Path.cwd()`.
That is right on a laptop and wrong on a serverless platform: Vercel unpacks the
deployment into `/var/task` and mounts it **read-only**, so the first save came
back as `[Errno 30] Read-only file system: '/var/task/data'`. Only `/tmp` is
writable there.

The resolution order is:

1. ``DATA_DIR`` -- an explicit answer always wins. Point it at a mounted volume
   and nothing below applies.
2. The bundled ``data/`` next to the project, when it is actually writable.
3. A directory under the system temp dir, as the last resort.

Choosing by *probing* rather than by platform sniffing is deliberate: a
container with a read-only root, a locked-down CI runner and Vercel all fail the
same way, and all want the same fallback.

**The fallback is ephemeral.** `/tmp` on a serverless platform lives as long as
the instance does and is not shared between instances, so JSON storage there is
a scratchpad, not a database. Deployments that must keep data across requests
should use the ``mysql`` or ``mongo`` backend instead; the JSON backend stays the
zero-setup default for local work. `seeded_data_path` bridges the gap for
read-only *seed* data: a file shipped inside the bundle is copied into the
writable directory on first use, so a deployment can ship starting content and
still accept writes.
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

#: Name of the directory created under the system temp dir when the preferred
#: location cannot be written to. Fixed so that every store in one instance
#: agrees on where the fallback lives.
_FALLBACK_DIR_NAME = "gemini-proxy-data"

#: Resolved once per process: the probe touches the filesystem, and every store
#: must agree on the answer.
_writable_root: Path | None = None


def _is_writable(directory: Path) -> bool:
    """Can this process create a file in `directory`?

    Creating the directory counts as part of the question: `data/` often does not
    exist yet, and `mkdir` is exactly what failed on Vercel.
    """
    try:
        directory.mkdir(parents=True, exist_ok=True)
        probe = directory / ".write-probe"
        probe.write_text("", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def _fallback_root() -> Path:
    return Path(tempfile.gettempdir()) / _FALLBACK_DIR_NAME


def _settings_data_dir() -> str:
    """`DATA_DIR` as read from the .env file, if the settings object loaded."""
    try:
        from src.application.config.config import settings

        return (getattr(settings, "DATA_DIR", "") or "").strip()
    except Exception:  # pragma: no cover - settings failing is its own error
        return ""


def data_root() -> Path:
    """The directory JSON stores may write into, created if needed."""
    global _writable_root
    if _writable_root is not None:
        return _writable_root

    # os.environ first so a platform-set variable beats a checked-in .env.
    configured = os.getenv("DATA_DIR") or _settings_data_dir()
    if configured:
        # An explicit setting is an instruction, not a suggestion: if it is not
        # writable the deployment is misconfigured and should say so loudly
        # rather than quietly scattering files in a temp dir.
        chosen = Path(configured).expanduser()
        if not _is_writable(chosen):
            raise RuntimeError(f"DATA_DIR={configured!r} is not writable by this process")
        _writable_root = chosen.resolve()
        return _writable_root

    preferred = Path.cwd() / "data"
    if _is_writable(preferred):
        _writable_root = preferred.resolve()
        return _writable_root

    fallback = _fallback_root()
    if not _is_writable(fallback):
        raise RuntimeError(
            f"Neither {preferred} nor {fallback} is writable; set DATA_DIR to a writable directory"
        )
    logger.warning(
        "%s is read-only; JSON data will be written to %s instead. This directory is "
        "ephemeral on serverless platforms -- use the mysql or mongo storage backend "
        "for anything that must survive a redeploy.",
        preferred,
        fallback,
    )
    _writable_root = fallback.resolve()
    return _writable_root


def resolve_data_path(configured: str | Path) -> Path:
    """Turn a configured data-file path into one this process can write to.

    An absolute path is honoured as given -- it was chosen deliberately. A
    relative path is resolved against `data_root()`, with a leading ``data/``
    stripped so the existing settings (``data/postman-workspaces.json``) keep
    working when the root itself moves.
    """
    path = Path(configured)
    if path.is_absolute():
        return path

    parts = path.parts
    if parts and parts[0] == "data":
        parts = parts[1:]
    if not parts:
        raise ValueError(f"{configured!r} does not name a file")
    return data_root().joinpath(*parts)


def seeded_data_path(configured: str | Path) -> Path:
    """Like `resolve_data_path`, but carry over content shipped in the bundle.

    When the writable location is a fallback, a file of the same name sitting in
    the read-only deployment is copied across the first time it is asked for.
    That is what lets a deployment ship starting data and still take writes.
    """
    target = resolve_data_path(configured)
    if target.exists():
        return target

    original = Path(configured)
    source = original if original.is_absolute() else Path.cwd() / original
    if source != target and source.is_file():
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            logger.info("Seeded %s from the read-only bundle at %s", target, source)
        except OSError:
            # Losing the seed is survivable -- the store starts empty.
            logger.warning("Could not seed %s from %s", target, source, exc_info=True)
    return target


def reset_for_tests() -> None:
    """Forget the probed root so a test can change the environment."""
    global _writable_root
    _writable_root = None
