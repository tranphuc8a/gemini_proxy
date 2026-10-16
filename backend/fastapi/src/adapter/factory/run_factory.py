"""Process-wide wiring for `/run`: which providers exist, built from the settings.

The use case is a singleton because its rate-limit counters must outlive a
request. Providers are chosen by id from this table; a client can never supply an
address (see `application/usecases/run_usecase`).
"""

from __future__ import annotations

from typing import Dict, Optional

from src.adapter.output.run.judge0_executor import Judge0Executor
from src.adapter.output.run.local_executor import LocalExecutor
from src.adapter.output.run.piston_executor import PistonExecutor
from src.adapter.output.run.wandbox_executor import WandboxExecutor
from src.application.config.config import settings
from src.application.ports.input.run_input_port import RunInputPort
from src.application.ports.output.code_executor_port import CodeExecutorPort
from src.application.usecases.run_usecase import RunUseCase

_usecase: Optional[RunUseCase] = None


def build_executors() -> Dict[str, CodeExecutorPort]:
    timeout = float(getattr(settings, "RUN_HTTP_TIMEOUT_S", 30.0))
    return {
        "piston": PistonExecutor(
            base_url=getattr(settings, "RUN_PISTON_URL", ""),
            api_key=getattr(settings, "RUN_PISTON_KEY", ""),
            http_timeout_s=timeout,
        ),
        "judge0": Judge0Executor(
            base_url=getattr(settings, "RUN_JUDGE0_URL", ""),
            api_key=getattr(settings, "RUN_JUDGE0_KEY", ""),
            key_header=getattr(settings, "RUN_JUDGE0_KEY_HEADER", "X-Auth-Token"),
            language_ids=getattr(settings, "RUN_JUDGE0_LANGUAGE_IDS", ""),
            http_timeout_s=timeout,
        ),
        "wandbox": WandboxExecutor(
            base_url=getattr(settings, "RUN_WANDBOX_URL", ""),
            compilers=getattr(settings, "RUN_WANDBOX_COMPILERS", ""),
            http_timeout_s=timeout,
        ),
        "local": LocalExecutor(
            enabled=bool(getattr(settings, "RUN_LOCAL_ENABLED", False)),
            tools={
                "gcc": getattr(settings, "RUN_LOCAL_GCC", ""),
                "gxx": getattr(settings, "RUN_LOCAL_GXX", ""),
                "javac": getattr(settings, "RUN_LOCAL_JAVAC", ""),
                "java": getattr(settings, "RUN_LOCAL_JAVA", ""),
                "python": getattr(settings, "RUN_LOCAL_PYTHON", ""),
                "node": getattr(settings, "RUN_LOCAL_NODE", ""),
            },
        ),
    }


def get_run_usecase() -> RunUseCase:
    global _usecase
    if _usecase is None:
        _usecase = RunUseCase(
            build_executors(),
            enabled=bool(getattr(settings, "RUN_ENABLED", True)),
            default_provider=getattr(settings, "RUN_DEFAULT_PROVIDER", "wandbox"),
            rate_per_minute=int(getattr(settings, "RUN_RATE_PER_MIN", 20)),
        )
    return _usecase


def get_run_input_port() -> RunInputPort:
    """FastAPI dependency."""
    return get_run_usecase()


def reset_for_tests() -> None:
    global _usecase
    _usecase = None
