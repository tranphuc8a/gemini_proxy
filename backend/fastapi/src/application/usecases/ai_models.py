"""Which Gemini models a caller may pick, and how to ask each of them.

* **Catalog** — the deployment's real list (Gemini `models.list`, through the
  model port), cut down to text models that answer `generateContent`, newest
  first. Kept `AI_MODELS_TTL_SECONDS` per instance; a failed listing falls back
  to `FALLBACK` for a few minutes instead of failing every request. `AI_MODELS`
  (comma-separated) pins the list and skips the call.
* **Who may pick what** — anyone allowed to use AI may pick a Flash / Flash-Lite
  model; Pro models are for administrators (they cost several times more and
  the daily budget counts tokens, not money).
* **Thinking** — the same field means different things per family, and a wrong
  one is an HTTP 400 (measured 2026-10-08 against the live API):
  2.5 Flash / Flash-Lite and 3.x Flash accept `thinkingBudget: 0` (thinking
  off); 3.x Flash-Lite rejects it but takes `thinkingLevel: "low"`; 2.5 rejects
  `thinkingLevel`; Pro models cannot switch thinking off. `thinking_config`
  encodes that; the adapter retries once without it if a model still refuses.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional, Tuple

from src.application.config.config import settings

#: Used when the listing is unavailable: the text models the live API offered on 2026-10-08.
FALLBACK: Tuple[str, ...] = (
    "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.1-pro-preview",
    "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest",
    "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro",
)

#: Not chat/text models even though they answer generateContent: speech, images, video, robots…
_NOT_TEXT = ("tts", "image", "banana", "omni", "transcribe", "robotics", "computer-use", "customtools", "live",
             "embedding", "audio", "veo", "imagen", "aqa", "learnlm", "gemma")
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]{1,62}$")
_FAILED_TTL = 300

_CACHE: Dict[str, Any] = {}


def reset_catalog() -> None:
    """Forget the cached listing (tests, and after changing AI_MODELS)."""
    _CACHE.clear()


def valid_id(model: Optional[str]) -> bool:
    return bool(model) and bool(_ID_RE.match(str(model)))


def is_text_model(model_id: str) -> bool:
    m = model_id.lower()
    return m.startswith("gemini-") and not any(word in m for word in _NOT_TEXT)


def tier(model_id: str) -> str:
    m = model_id.lower()
    if "flash-lite" in m:
        return "flash-lite"
    if "flash" in m:
        return "flash"
    if "-pro" in m:
        return "pro"
    return "other"


def admin_only(model_id: str) -> bool:
    return tier(model_id) == "pro"


def _version(model_id: str) -> float:
    m = re.match(r"gemini-(\d+(?:\.\d+)?)", model_id)
    return float(m.group(1)) if m else 0.0


def sort_key(model_id: str) -> Tuple[int, float, int, int, str]:
    """Newest first; within a version Flash, Flash-Lite, Pro; a preview after its stable sibling."""
    alias = model_id.endswith("-latest")
    order = {"flash": 0, "flash-lite": 1, "pro": 2}.get(tier(model_id), 3)
    return (1 if alias else 0, -_version(model_id), order, 1 if "preview" in model_id else 0, model_id)


def thinking_config(model: str) -> Optional[Dict[str, Any]]:
    """The thinking switch for short, well-specified tasks (fast, few output tokens); None = model default."""
    m = (model or "").lower()
    if "2.5-flash" in m:                      # 2.5 Flash and 2.5 Flash-Lite: budget 0 turns thinking off
        return {"thinkingBudget": 0}
    if tier(m) == "pro":                      # cannot be switched off; leave the model's own default
        return None
    if tier(m) == "flash-lite" and not m.startswith("gemini-2"):
        return {"thinkingLevel": "low"}       # 3.x Flash-Lite: budget 0 is an HTTP 400
    if tier(m) == "flash" and (m.startswith("gemini-3") or m.endswith("-latest")):
        return {"thinkingBudget": 0}
    return None


def fit_config(config: Optional[Dict[str, Any]], model: str) -> Optional[Dict[str, Any]]:
    """`config` with the thinking switch that suits `model` (generation_config was built for the default model)."""
    if config is None:
        return None
    out = {k: v for k, v in config.items() if k != "thinkingConfig"}
    thinking = thinking_config(model)
    if thinking is not None:
        out["thinkingConfig"] = thinking
    return out


def _describe(model_id: str, label: str = "") -> Dict[str, Any]:
    return {"id": model_id, "label": label or model_id, "tier": tier(model_id), "preview": "preview" in model_id,
            "alias": model_id.endswith("-latest"), "adminOnly": admin_only(model_id)}


def _configured() -> List[str]:
    raw = str(getattr(settings, "AI_MODELS", "") or "")
    return [m.strip() for m in raw.split(",") if valid_id(m.strip())]


async def catalog(port: Any) -> Tuple[List[Dict[str, Any]], str]:
    """(models, source) — source is "config", "api" or "fallback". The default model is always included."""
    now = time.time()
    pinned = _configured()
    if pinned:
        models, source = [_describe(m) for m in pinned], "config"
    else:
        hit = _CACHE.get("catalog")
        if hit and hit["until"] > now:
            models, source = hit["models"], hit["source"]
        else:
            try:
                listed = await port.list_models() if port is not None else []
            except Exception:                 # an outage of the listing must not take AI down
                listed = []
            seen, models = set(), []
            for item in listed or []:
                mid = str(item.get("id") or "")
                if valid_id(mid) and is_text_model(mid) and mid not in seen:
                    seen.add(mid)
                    models.append(_describe(mid, str(item.get("label") or "")))
            if models:
                source, ttl = "api", int(getattr(settings, "AI_MODELS_TTL_SECONDS", 21600) or 21600)
            else:
                models, source, ttl = [_describe(m) for m in FALLBACK], "fallback", _FAILED_TTL
            models.sort(key=lambda d: sort_key(d["id"]))
            _CACHE["catalog"] = {"models": models, "source": source, "until": now + ttl}
    default = settings.AI_MODEL
    if valid_id(default) and not any(m["id"] == default for m in models):
        models = [_describe(default)] + list(models)
    return [dict(m, default=(m["id"] == default)) for m in models], source
