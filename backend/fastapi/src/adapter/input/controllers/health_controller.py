from fastapi import APIRouter, Depends
from src.application.ports.input.health_input_port import HealthInputPort
from src.adapter.factory.service_factory import ServiceFactory

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/", summary="Liveness probe")
async def health(health_service: HealthInputPort = Depends(ServiceFactory.get_health_input_port)):
    return await health_service.check_health()


@router.get("/ready", summary="Readiness probe")
async def ready(health_service: HealthInputPort = Depends(ServiceFactory.get_health_input_port)):
    return await health_service.check_readiness()
