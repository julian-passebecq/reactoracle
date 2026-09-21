from __future__ import annotations

import os
import re
import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
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
    DataFactoryPlan,
    GoldTableContract,
    InfrastructureSummary,
    MaintenanceSummary,
    Overview,
    PlatformArchitecture,
    ProviderInventory,
    Workload,
)
from .platform_catalog import build_data_factory_plan, build_gold_catalog, build_platform_architecture, build_provider_inventory
from .state import CommandStateConflict, MachineIdentityConflict, store


app = FastAPI(
    title="ReactOracle Control API",
    version="0.1.0",
    description="Read-mostly control plane and Oracle agent ingress for ReactOracle.",
)

origins = [item.strip() for item in os.getenv("REACTORACLE_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if item.strip()]
K8S_NAMESPACE = re.compile(r"^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$")
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
    if authorization is None or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid agent token.")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def require_overview() -> Overview:
    current = store.get_overview()
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No live Oracle agent snapshot has been received yet.",
        )
    return current


@app.get("/api/v1/overview", response_model=Overview)
def overview() -> Overview:
    return require_overview()


@app.get("/api/v1/k8s/workloads", response_model=list[Workload])
def workloads() -> list[Workload]:
    return require_overview().workloads


@app.get("/api/v1/infrastructure", response_model=InfrastructureSummary)
def infrastructure() -> InfrastructureSummary:
    return require_overview().infrastructure


@app.get("/api/v1/maintenance", response_model=MaintenanceSummary)
def maintenance() -> MaintenanceSummary:
    return require_overview().maintenance


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


@app.get("/api/v1/platform/data-factory", response_model=DataFactoryPlan)
def data_factory_plan() -> DataFactoryPlan:
    return build_data_factory_plan()


def mutations_enabled() -> bool:
    return os.getenv("REACTORACLE_ENABLE_MUTATIONS", "").strip().lower() in {"1", "true", "yes", "on"}


def _require_known_machine(machine_id: str) -> None:
    overview = store.get_overview()
    if overview is not None:
        known_machine = overview.vm.id
    else:
        status_snapshot = store.get_agent_status()
        known_machine = status_snapshot.lastHeartbeat.machineId if status_snapshot.lastHeartbeat else None

    if known_machine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No Oracle agent identity has been established yet.",
        )
    if machine_id != known_machine:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Command targets {machine_id}, but the connected Oracle machine is {known_machine}.",
        )

    status_snapshot = store.get_agent_status()
    if not status_snapshot.connected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Oracle agent is not currently connected; refusing to queue a command for later execution.",
        )


def _require_known_workload(
    machine_id: str,
    namespace: str,
    name: str,
    kind: str,
) -> None:
    _require_known_machine(machine_id)
    agent = store.get_agent_status()
    if not agent.snapshotFresh:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kubernetes workload commands require a fresh Oracle agent snapshot.",
        )

    overview = require_overview()
    known = any(
        item.namespace == namespace and item.name == name and item.kind == kind
        for item in overview.workloads
    )
    if not known:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kubernetes workload is not present in the latest Oracle agent snapshot.",
        )


@app.get("/api/v1/capabilities", response_model=Capabilities)
def capabilities() -> Capabilities:
    return Capabilities(restartWorkload=mutations_enabled())




def _validated_log_arguments(arguments: dict[str, str | int | float | bool]) -> dict[str, str | int]:
    allowed = {"namespace", "name", "kind", "tail"}
    if not set(arguments).issubset(allowed):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Log query contains unsupported arguments.")

    namespace = arguments.get("namespace")
    name = arguments.get("name")
    kind = arguments.get("kind")
    tail_value = arguments.get("tail", 100)

    if not isinstance(namespace, str) or len(namespace) > 63 or not K8S_NAMESPACE.fullmatch(namespace):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid Kubernetes namespace.")
    if not isinstance(name, str) or len(name) > 253 or not K8S_NAME.fullmatch(name):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid Kubernetes workload name.")
    if not isinstance(kind, str) or kind not in LOG_KINDS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unsupported Kubernetes workload kind.")
    if isinstance(tail_value, bool):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="tail must be an integer.")
    try:
        tail = int(tail_value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="tail must be an integer.") from None
    if tail < 10 or tail > 500:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="tail must be between 10 and 500 lines.")

    return {"namespace": namespace, "name": name, "kind": kind, "tail": tail}


def _validated_restart_arguments(arguments: dict[str, str | int | float | bool]) -> dict[str, str]:
    namespace = arguments.get("namespace")
    name = arguments.get("name")
    kind = arguments.get("kind")

    if not isinstance(namespace, str) or not K8S_NAME.fullmatch(namespace):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid Kubernetes namespace.")
    if not isinstance(name, str) or not K8S_NAME.fullmatch(name):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid Kubernetes workload name.")
    if not isinstance(kind, str) or kind not in RESTART_KINDS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unsupported restart workload kind.")
    if set(arguments) != {"namespace", "name", "kind"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Restart accepts only namespace, name and kind.")

    return {"namespace": namespace, "name": name, "kind": kind}


@app.post("/api/v1/commands", response_model=CommandRun, status_code=status.HTTP_202_ACCEPTED)
def create_command(request: CommandRequest) -> CommandRun:
    if request.command == "vm.health_check":
        if request.arguments:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="vm.health_check does not accept arguments.")
        _require_known_machine(request.machineId)
        return store.create_command(request.machineId, request.command)

    if request.command == "k8s.logs":
        arguments = _validated_log_arguments(request.arguments)
        _require_known_workload(
            request.machineId,
            str(arguments["namespace"]),
            str(arguments["name"]),
            str(arguments["kind"]),
        )
        return store.create_command(request.machineId, request.command, arguments)

    if request.command == "k8s.restart_workload":
        if not mutations_enabled():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mutating operations are disabled. Set REACTORACLE_ENABLE_MUTATIONS=true only behind the authenticated control-plane boundary.",
            )
        arguments = _validated_restart_arguments(request.arguments)
        _require_known_workload(
            request.machineId,
            arguments["namespace"],
            arguments["name"],
            arguments["kind"],
        )
        return store.create_command(request.machineId, request.command, arguments, risk="moderate")

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported command.")


@app.get("/api/v1/commands", response_model=list[CommandRun])
def recent_commands(limit: int = Query(default=20, ge=1, le=100)) -> list[CommandRun]:
    return store.recent_commands(limit)


@app.get("/api/v1/commands/{command_id}", response_model=CommandRun)
def command_status(command_id: str) -> CommandRun:
    run = store.get_command(command_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found.")
    return run


@app.post("/api/v1/agent/heartbeat", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_agent_token)])
def agent_heartbeat(heartbeat: AgentHeartbeat) -> None:
    try:
        store.record_heartbeat(heartbeat)
    except MachineIdentityConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent machine identity changed from {exc.expected} to {exc.received}.",
        ) from exc


@app.post("/api/v1/agent/snapshot", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_agent_token)])
def agent_snapshot(snapshot: AgentSnapshot) -> None:
    try:
        store.record_snapshot(snapshot)
    except MachineIdentityConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent machine identity changed from {exc.expected} to {exc.received}.",
        ) from exc


@app.get("/api/v1/agent/commands/next", response_model=AgentCommand | None, dependencies=[Depends(require_agent_token)])
def next_agent_command(machineId: str) -> AgentCommand | Response:
    command = store.lease_next_command(machineId)
    if command is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return command


@app.post("/api/v1/agent/commands/{command_id}/result", response_model=CommandRun, dependencies=[Depends(require_agent_token)])
def agent_command_result(command_id: str, result: AgentCommandResult) -> CommandRun:
    try:
        run = store.complete_command(command_id, result)
    except CommandStateConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Command result can only complete a running command; current state is {exc.current_status}.",
        ) from exc
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found.")
    return run
