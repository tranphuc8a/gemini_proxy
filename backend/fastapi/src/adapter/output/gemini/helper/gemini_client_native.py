"""Native Gemini/Generative Language client wrapper.

This module provides an async-friendly wrapper around possible Google-provided
native client libraries. It tries to use, in order:
 - `google.ai.generativelanguage` (GAPIC)
 - `google.generativeai` (the lightweight convenience package)

The wrapper exposes a similar interface to the HTTP-based `GeminiClient` in
`gemini_client.py`: `generate()`, `stream_generate()`, `health_check()` and
`stop()` so the rest of the code can swap implementations with minimal changes.

Behavior and mapping:
 - Native responses are mapped into a dict with a `candidates` list where each
   candidate contains `content.parts[*].text` (the same shape used by the
   HTTP client). This is intentionally permissive — it will attempt to extract
   text from several common response shapes.
 - Calls into synchronous native clients are executed inside `asyncio.to_thread`
   to avoid blocking the event loop.

If no supported native client library is installed, calling `generate()` will
raise a `GeminiClientError` with installation instructions.
"""
from __future__ import annotations

from typing import Any, Dict, Optional, AsyncIterator, List
import asyncio
import time

from src.application.config.config import settings


class GeminiClientError(RuntimeError):
    pass


# Detect available native clients
_HAS_GAPIC = False
_HAS_GENAI = False
_gapic: Any = None
_genai: Any = None
try:
    # Prefer the official GAPIC if available
    from google.ai import generativelanguage as _gapic  # type: ignore
    _HAS_GAPIC = True
except Exception:
    try:
        import google.generativeai as _genai  # type: ignore
        _HAS_GENAI = True
    except Exception:
        _HAS_GAPIC = False
        _HAS_GENAI = False


class GeminiClientNative:
    """Wrapper that uses a native Google generative client when available.

    Note: this class intentionally keeps a small, compatibility-focused
    surface (generate/stream_generate/health_check/stop) so it can replace
    the existing HTTP client in the codebase with minimal changes.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> None:
        self.model = model or getattr(settings, "GEMINI_MODEL", None)
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", None)
        self.timeout = timeout or getattr(settings, "GEMINI_TIMEOUT_SECONDS", None)

        self._client = None
        self._client_type = None

        if _HAS_GAPIC:
            # Create a GAPIC client
            try:
                self._client = _gapic.TextServiceClient()
                self._client_type = "gapic"
            except Exception as exc:  # pragma: no cover - runtime environment dependent
                raise GeminiClientError(f"Failed to instantiate google.ai.generativelanguage client: {exc}") from exc
        elif _HAS_GENAI:
            try:
                # Configure the convenience library with an API key if provided
                _genai.configure(api_key=self.api_key)
                self._client = _genai
                self._client_type = "genai"
            except Exception as exc:  # pragma: no cover - runtime environment dependent
                raise GeminiClientError(f"Failed to configure google.generativeai: {exc}") from exc

    def _require_client(self) -> None:
        if self._client is None:
            raise GeminiClientError(
                "No native Gemini client is installed. Install one of:\n"
                "  pip install google-generativeai\n"
                "or the GAPIC package (example):\n"
                "  pip install google-cloud-generativelanguage\n"
                "Then restart the application."
            )

    async def generate(self, prompt: Any, model: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate text using a native client and return a mapped response dict.

        The returned dict follows the same shape the HTTP client produces:
        {"candidates": [{"content": {"parts": [{"text": ...}]}}]}
        """
        self._require_client()
        model_to_use = model or self.model

        # Make the blocking native call in a thread
        if self._client_type == "gapic":
            return await asyncio.to_thread(self._generate_with_gapic, prompt, model_to_use, extra)
        else:
            return await asyncio.to_thread(self._generate_with_genai, prompt, model_to_use, extra)

    def _extract_texts_from_response(self, resp: Any) -> List[str]:
        """Attempt to pull human-readable text parts from a native response.

        This function is defensive because different client libraries expose
        content in different attribute names/structures.
        """
        texts: List[str] = []

        # 1) GAPIC-like responses may have 'candidates' with 'content'/'text' fields
        try:
            candidates = getattr(resp, "candidates", None)
            if candidates:
                for cand in candidates:
                    # common shapes: cand.output, cand.text, cand.content.parts
                    # try several access patterns
                    if hasattr(cand, "output"):
                        output = getattr(cand, "output")
                        if hasattr(output, "text"):
                            texts.append(str(getattr(output, "text")))
                            continue
                    if hasattr(cand, "text"):
                        texts.append(str(getattr(cand, "text")))
                        continue
                    # nested content.parts
                    content = getattr(cand, "content", None) or getattr(cand, "message", None)
                    if content is not None:
                        parts = getattr(content, "parts", None) or getattr(content, "text_segments", None)
                        if parts:
                            for p in parts:
                                # p might be a simple string or proto with 'text'
                                if isinstance(p, str):
                                    texts.append(p)
                                elif hasattr(p, "text"):
                                    texts.append(str(getattr(p, "text")))
                            continue
        except Exception:
            pass

        # 2) genai convenience library may return an object with 'content' or 'output' or plain text
        try:
            if hasattr(resp, "text"):
                texts.append(str(getattr(resp, "text")))
            elif isinstance(resp, dict):
                # try common dict keys
                for k in ("candidates", "outputs", "items"):
                    if k in resp:
                        for item in resp[k]:
                            # try item['content']['parts'] or item.get('output')
                            if isinstance(item, dict):
                                content = item.get("content") or item.get("output") or item.get("message")
                                if isinstance(content, dict):
                                    parts = content.get("parts") or content.get("text_segments")
                                    if parts:
                                        for p in parts:
                                            if isinstance(p, str):
                                                texts.append(p)
                                            elif isinstance(p, dict) and "text" in p:
                                                texts.append(p["text"])
                                        continue
                                # fallback to extracting string fields
                                for fld in ("text", "output", "content"):
                                    if fld in item and isinstance(item[fld], str):
                                        texts.append(item[fld])
                                        break
                        if texts:
                            break
            elif isinstance(resp, str):
                texts.append(resp)
        except Exception:
            pass

        # 3) Fallback: string-ify the whole response if nothing found
        if not texts:
            try:
                texts.append(str(resp))
            except Exception:
                texts = [""]

        return texts

    def _map_texts_to_response(self, texts: List[str]) -> Dict[str, Any]:
        return {"candidates": [{"content": {"parts": [{"text": t} for t in texts]}}]}

    def _generate_with_gapic(self, prompt: Any, model: Optional[str], extra: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        # GAPIC client expects a request proto or dict — try a permissive dict form
        req: Dict[str, Any] = {"model": model}
        # The GAPIC prompt shape varies; try a simple text prompt first
        if isinstance(prompt, str):
            req["prompt"] = {"text": prompt}
        else:
            # allow callers to pass structured prompts (list/dict)
            req["prompt"] = prompt
        if extra:
            req.update(extra)

        # Ensure the client is present and use a local variable to appease static checkers
        if self._client is None:
            raise GeminiClientError("GAPIC client is not initialized")
        client = self._client

        try:
            # The TextServiceClient.generate_text supports a 'request' dict in many versions
            resp = client.generate_text(request=req)
        except TypeError:
            # fallback to positional kwargs (older/newer gaps may vary)
            resp = client.generate_text(**req)

        texts = self._extract_texts_from_response(resp)
        return self._map_texts_to_response(texts)

    def _generate_with_genai(self, prompt: Any, model: Optional[str], extra: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        # google.generativeai convenience library has different APIs across versions.
        # Try a few common call signatures.
        try:
            client = self._client
            if client is None:
                raise GeminiClientError("genai client is not initialized")

            # newer versions: genai.generate_text(model=model, input=prompt)
            if hasattr(client, "generate_text"):
                kwargs = {"model": model or self.model}
                # prefer 'input' or 'prompt' depending on the signature
                kwargs["input"] = prompt
                if extra:
                    kwargs.update(extra)
                resp = client.generate_text(**kwargs)
            elif hasattr(client, "chat") and hasattr(client.chat, "complete"):
                # experimental/chat APIs
                resp = client.chat.complete(model=model or self.model, messages=[{"content": prompt}])
            else:
                # last resort: call a top-level 'generate' if present
                resp = getattr(client, "generate", lambda *a, **k: None)(model or self.model, prompt)
        except GeminiClientError:
            # propagate explicit client errors without wrapping
            raise
        except Exception as exc:  # pragma: no cover - runtime dependent
            raise GeminiClientError(f"Native genai call failed: {exc}") from exc

        texts = self._extract_texts_from_response(resp)
        return self._map_texts_to_response(texts)

    async def stream_generate(self, prompt: Any, model: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> AsyncIterator[str]:
        resp = await self.generate(prompt, model=model, extra=extra)
        candidates = resp.get("candidates") or []
        for cand in candidates:
            content = cand.get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                text = part.get("text")
                if text:
                    # small cooperative pause
                    await asyncio.sleep(0)
                    yield text

    async def health_check(self) -> bool:
        # Basic health: native client available and a quick lightweight call possible.
        if self._client is None:
            return False
        # For GAPIC we can try a cheap call (list models may exist) but to be conservative,
        # just return True when client object exists. If you want a stronger check,
        # we can attempt a real request (may incur costs).
        return True

    async def stop(self) -> None:
        # Close or cleanup if needed.
        try:
            if self._client_type == "gapic" and hasattr(self._client, "transport"):
                # GAPIC clients sometimes expose transport.close()
                transport = getattr(self._client, "transport", None)
                if transport and hasattr(transport, "close"):
                    await asyncio.to_thread(transport.close)
        finally:
            self._client = None
