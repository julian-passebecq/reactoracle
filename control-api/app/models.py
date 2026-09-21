from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


Health = Literal["healthy", "idle", "warning", "offline"]


class VmSummary(BaseModel):
    id: str
    name: str
    provider: Literal["oci"] = "oci"
    shape: str
    ocpu: float
    memoryGb: float
    cpuPercent: float
    memoryUsedGb: float
    diskPercent: float
    uptime: str
    projectedCost: str = "$0"
    k3sVersion: str
    swapUsedGb: float = 0
    load1: float = 0
    diskUsedGb: float = 0
    diskTotalGb: float = 0
    networkRxMbps: float = 0
    networkTxMbps: float = 0


class ServiceSummary(BaseModel):
    id: str
    name: str
    category: Literal["platform", "data", "monitoring", "external"]
    status: Health
    detail: str
    memoryMb: float | None = None


class Workload(BaseModel):
    id: str
    name: str
    namespace: str
    kind: Literal["Deployment", "StatefulSet", "DaemonSet", "Job"]
    status: Literal["Running", "Pending", "Failed", "Complete"]
    cpuMillicores: float = 0
    memoryMb: float = 0
    restarts: int = 0


class NamespaceSummary(BaseModel):
    name: str
    podsReady: int
    podsTotal: int
    cpuMillicores: float = 0
    memoryMb: float = 0


class TofuRun(BaseModel):
    id: str
    action: Literal["PLAN", "APPLY", "VALIDATE"]
    status: Literal["success", "failed", "running"]
    summary: str
    duration: str
    when: str


class InfrastructureSummary(BaseModel):
    state: Literal["synced", "drift", "unknown"]
    managedResources: int
    lastPlan: str
    drift: str
    publicIp: str
    bootVolumeGb: float
    vcn: str
    subnet: str
    tofuRuns: list[TofuRun] = Field(default_factory=list)


class MaintenanceSummary(BaseModel):
    os: str
    kernel: str
    updatesAvailable: int
    securityUpdates: int
    rebootRequired: bool
    unusedImagesGb: float
    prometheusGb: float
    lokiGb: float
    lastBackup: str
    backupStatus: Literal["success", "failed", "unknown"]


class ActivityEvent(BaseModel):
    id: str
    when: str
    actor: str
    action: str
    status: Literal["success", "warning", "failed"]


class Overview(BaseModel):
    vm: VmSummary
    services: list[ServiceSummary]
    workloads: list[Workload]
    namespaces: list[NamespaceSummary]
    infrastructure: InfrastructureSummary
    maintenance: MaintenanceSummary
    activity: list[ActivityEvent]


class AgentHeartbeat(BaseModel):
    agentVersion: str
    machineId: str
    status: Health
    k3sReachable: bool
    sentAt: datetime


class HostSnapshot(BaseModel):
    id: str
    name: str
    shape: str
    ocpu: float
    memoryGb: float
    cpuPercent: float
    memoryUsedGb: float
    diskPercent: float
    uptime: str
    k3sVersion: str
    swapUsedGb: float = 0
    load1: float = 0
    diskUsedGb: float = 0
    diskTotalGb: float = 0
    networkRxMbps: float = 0
    networkTxMbps: float = 0


class AgentSnapshot(BaseModel):
    machineId: str
    collectedAt: datetime
    host: HostSnapshot
    workloads: list[Workload]
    namespaces: list[NamespaceSummary]
    maintenance: MaintenanceSummary


class AgentStatus(BaseModel):
    connected: bool
    lastHeartbeat: AgentHeartbeat | None = None
    lastSnapshotAt: datetime | None = None


class CommandRequest(BaseModel):
    command: Literal["vm.health_check"]


class CommandRun(BaseModel):
    id: str
    command: Literal["vm.health_check"]
    status: Literal["queued", "running", "success", "failed"]
    risk: Literal["safe"] = "safe"
    createdAt: datetime
    completedAt: datetime | None = None
    result: dict[str, object] | None = None
    error: str | None = None


class AgentCommand(BaseModel):
    id: str
    command: Literal["vm.health_check"]


class AgentCommandResult(BaseModel):
    status: Literal["success", "failed"]
    result: dict[str, object] | None = None
    error: str | None = None
