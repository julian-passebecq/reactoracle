from __future__ import annotations

import os
import re
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    AgentCommand,
    AgentCommandResult,
    AgentHeartbeat,
    AgentSnapshot,
    AgentStatus,
    CommandRequest,
    CommandRun,
    Capabilities,
    GoldTableContract,
    InfrastructureSummary,
    MaintenanceSummary,
    Overview,
    PlatformArchitecture,
    ProviderInventory,
    Workload,
)
from .platform_catalog import build_gold_catalog, build_platform_architecture, build_provider_inventory
from .state import store


app = FastAPI(
    title="ReactOracle Control API",
    version="0.1.0",
    description="Read-only control plane and Oracle agent ingress for ReactOracle.",
)

origins = [item.strip() for item in os.getenv("REACTORACLE_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if item.strip()]
K8S_NAME = re.compile(r"^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$")
LOG_KINDS = {"Deployment", "StatefulSet", "DaemonSet", "Job"}
RESTART_KINDS = {"Deployment", "StatefulSet", "DaemonSet"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def require_agent_token(authorization: Annotated[str | None, Header()] = None) -> None:
    configured = os.getenv("REACTORACLE_AGENT_TOKEN")
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent ingress is disabled until REACTORACLE_AGENT_TOKEN is configured.",
        )
    expected = f"Bearer {configured}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid agent token.")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/overview", response_model=Overview)
def overview() -> Overview:
    return store.get_overview()


@app.get("/api/v1/k8s/workloads", response_model=list[Workload])
def workloads() -> list[Workload]:
    return store.get_overview().workloads


@app.get("/api/v1/infrastructure", response_model=InfrastructureSummary)
def infrastructure() -> InfrastructureSummary:
    return store.get_overview().infrastructure


@app.get("/api/v1/maintenance", response_model=MaintenanceSummary)
def maintenance() -> MaintenanceSummary:
    return store.get_overview().maintenance


@app.get("/api/v1/agent/status", response_model=AgentStatus)
def agent_status() -> AgentStatus:
    return store.get_agent_status()


@app.get("/api/v1/platform/architecture", response_model=PlatformArchitecture)
def platform_architecture() -> PlatformArchitecture:
    return build_platform_architecture()


@app.get("/api/v1/platform/gold-catalog", response_model=list[GoldTableContract])
def gold_catalog() -> list[GoldTableContract]:
    return build_gold_catalog()


@app.get("/api/v1/platform/providers", response_model=ProviderInventory)
def provider_inventory() -> ProviderInventory:
    return build_provider_inventory()


def mutations_enabled() -> bool:
    return os.getenv("REACTORACLE_ENABLE_MUTATIONS", "").strip().lower() in {"1", "true", "yes", "on"}


@app.get("/api/v1/capabilities", response_model=Capabilities)
def capabilities() -> Capabilities:
    return Capabilities(restartWorkload=mutations_enabled())




def _validated_log_arguments(arguments: dict[str, str | int | float | bool]) -> dict[str, str | int]:
    namespace = arguments.get("namespace")
    name = arguments.get("name")
    kind = arguments.get("kind")
    tail_value = arguments.get("tail", 100)

    if not isinstance(namespace, str) or not K8S_NAME.fullmatch(namespace):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid Kubernetes namespace.")
    if not isinstance(name, str) or not K8S_NAME.fullmatch(name):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid Kubernetes workload name.")
    if not isinstance(kind, str) or kind not in LOG_KINDS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported Kubernetes workload kind.")
    if isinstance(tail_value, bool):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tail must be an integer.")
    try:
        tail = int(tail_value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tail must be an integer.") from None
    if tail < 10 or tail > 500:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tail must be between 10 and 500 lines.")

    return {"namespace": namespace, "name": name, "kind": kind, "tail": tail}


def _validated_restart_arguments(arguments: dict[str, str | int | float | bool]) -> dict[str, str]:
    namespace = arguments.get("namespace")
    name = arguments.get("name")
    kind = arguments.get("kind")

    if not isinstance(namespace, str) or not K8S_NAME.fullmatch(namespace):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid Kubernetes namespace.")
    if not isinstance(name, str) or not K8S_NAME.fullmatch(name):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid Kubernetes workload name.")
    if not isinstance(kind, str) or kind not in RESTART_KINDS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported restart workload kind.")
    if set(arguments) != {"namespace", "name", "kind"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Restart accepts only namespace, name and kind.")

    return {"namespace": namespace, "name": name, "kind": kind}


@app.post("/api/v1/commands", response_model=CommandRun, status_code=status.HTTP_202_ACCEPTED)
def create_command(request: CommandRequest) -> CommandRun:
    if request.command == "vm.health_check":
        if request.arguments:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="vm.health_check does not accept arguments.")
        return store.create_command(request.machineId, request.command)

    if request.command == "k8s.logs":
        arguments = _validated_log_arguments(request.arguments)
        return store.create_command(request.machineId, request.command, arguments)

    if request.command == "k8s.restart_workload":
        if not mutations_enabled():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mutating operations are disabled. Set REACTORACLE_ENABLE_MUTATIONS=true only behind the authenticated control-plane boundary.",
            )
        arguments = _validated_restart_arguments(request.arguments)
        return store.create_command(request.machineId, request.command, arguments, risk="moderate")

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported command.")


@app.get("/api/v1/commands", response_model=list[CommandRun])
def recent_commands(limit: int = 20) -> list[CommandRun]:
    return store.recent_commands(limit)


@app.get("/api/v1/commands/{command_id}", response_model=CommandRun)
def command_status(command_id: str) -> CommandRun:
    run = store.get_command(command_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found.")
    return run


@app.post("/api/v1/agent/heartbeat", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_agent_token)])
def agent_heartbeat(heartbeat: AgentHeartbeat) -> None:
    store.record_heartbeat(heartbeat)


@app.post("/api/v1/agent/snapshot", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_agent_token)])
def agent_snapshot(snapshot: AgentSnapshot) -> None:
    store.record_snapshot(snapshot)


@app.get("/api/v1/agent/commands/next", response_model=AgentCommand | None, dependencies=[Depends(require_agent_token)])
def next_agent_command(machineId: str) -> AgentCommand | Response:
    command = store.lease_next_command(machineId)
    if command is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return command


@app.post("/api/v1/agent/commands/{command_id}/result", response_model=CommandRun, dependencies=[Depends(require_agent_token)])
def agent_command_result(command_id: str, result: AgentCommandResult) -> CommandRun:
    run = store.complete_command(command_id, result)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found.")
    return run
