
from typing import Any
from src.application.ports.input.health_input_port import HealthInputPort
from src.application.ports.output.health_check_output_port import HealthCheckOutputPort
from src.application.config.config import settings

class HealthUsecase(HealthInputPort):
    
    def __init__(self, servies: list[HealthCheckOutputPort]):
        self.services = servies

    async def check_health(self) -> Any:
        return {
            "status": "ok", 
            "service": "gemini-proxy-fastapi", 
            "port": settings.APP_PORT
        }
    
    async def check_readiness(self) -> Any:
        errors = {}
        is_ready = True
        
        for service in self.services:
            service_name = service.__class__.__name__
            try:
                await service.is_healthy()
                await service.is_ready()
            except Exception as e:
                is_ready = False
                errors[service_name] = str(e)
        
        if is_ready:
            return {
                "status": "ready",
                "service": "gemini-proxy-fastapi",
                "port": settings.APP_PORT
            }
        else:
            return {
                "status": "not ready",
                "service": "gemini-proxy-fastapi",
                "port": settings.APP_PORT,
                "errors": errors
            }
                
            
    