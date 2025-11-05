from fastapi import APIRouter, Depends
from src.application.ports.input.health_input_port import HealthInputPort
from src.adapter.factory.service_factory import ServiceFactory
from src.adapter.input.controllers.response_utils import success_response

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", summary="Liveness probe")
async def health(health_service: HealthInputPort = Depends(ServiceFactory.get_health_input_port)):
    data = await health_service.check_health()
    return success_response(data=data, message="ok", status_code=200)


@router.get("/ready", summary="Readiness probe")
async def ready(health_service: HealthInputPort = Depends(ServiceFactory.get_health_input_port)):
    data = await health_service.check_readiness()
    return success_response(data=data, message="ready", status_code=200)
