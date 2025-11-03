
from abc import ABC, abstractmethod
from typing import Any

class HealthInputPort(ABC):
    @abstractmethod
    async def check_health(self) -> Any:
        pass
    
    @abstractmethod
    async def check_readiness(self) -> Any:
        pass
