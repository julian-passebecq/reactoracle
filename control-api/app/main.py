from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    AgentHeartbeat,
    AgentSnapshot,
    AgentStatus,
    InfrastructureSummary,
    MaintenanceSummary,
    Overview,
    Workload,
)
from .state import store


app = FastAPI(
    title="ReactOracle Control API",
    version="0.1.0",
    description="Read-only control plane and Oracle agent ingress for ReactOracle.",
)

origins = [item.strip() for item in os.getenv("REACTORACLE_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if item.strip()]
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


@app.post("/api/v1/agent/heartbeat", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_agent_token)])
def agent_heartbeat(heartbeat: AgentHeartbeat) -> None:
    store.record_heartbeat(heartbeat)


@app.post("/api/v1/agent/snapshot", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_agent_token)])
def agent_snapshot(snapshot: AgentSnapshot) -> None:
    store.record_snapshot(snapshot)
