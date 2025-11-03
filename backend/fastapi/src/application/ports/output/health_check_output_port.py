

from abc import ABC, abstractmethod


class HealthCheckOutputPort(ABC):
    @abstractmethod
    async def is_healthy(self) -> bool:
        pass

    @abstractmethod
    async def is_ready(self) -> bool:
        pass