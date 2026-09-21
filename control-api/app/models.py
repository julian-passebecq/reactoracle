from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


Health = Literal["healthy", "idle", "warning", "offline"]
CommandName = Literal["vm.health_check", "k8s.logs", "k8s.restart_workload"]
CommandArgument = str | int | float | bool


def require_timezone(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must include a timezone offset.")
    return value


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
    projectedCost: str = "Not connected"
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
    id: str = Field(min_length=1, max_length=256)
    name: str = Field(min_length=1, max_length=253)
    namespace: str = Field(min_length=1, max_length=253)
    kind: Literal["Deployment", "StatefulSet", "DaemonSet", "Job"]
    status: Literal["Running", "Pending", "Failed", "Complete"]
    cpuMillicores: float = Field(default=0, ge=0)
    memoryMb: float = Field(default=0, ge=0)
    restarts: int = Field(default=0, ge=0)


class NamespaceSummary(BaseModel):
    name: str = Field(min_length=1, max_length=253)
    podsReady: int = Field(ge=0)
    podsTotal: int = Field(ge=0)
    cpuMillicores: float = Field(default=0, ge=0)
    memoryMb: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_pod_counts(self) -> "NamespaceSummary":
        if self.podsReady > self.podsTotal:
            raise ValueError("podsReady cannot exceed podsTotal.")
        return self


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
    updatesAvailable: int = Field(ge=0)
    securityUpdates: int = Field(ge=0)
    rebootRequired: bool
    unusedImagesGb: float = Field(ge=0)
    prometheusGb: float = Field(ge=0)
    lokiGb: float = Field(ge=0)
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
    agentVersion: str = Field(min_length=1, max_length=64)
    machineId: str = Field(min_length=1, max_length=128)
    status: Health
    k3sReachable: bool
    sentAt: datetime

    _sent_at_timezone = field_validator("sentAt")(require_timezone)


class HostSnapshot(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=255)
    shape: str = Field(min_length=1, max_length=255)
    ocpu: float = Field(gt=0)
    memoryGb: float = Field(gt=0)
    cpuPercent: float = Field(ge=0, le=100)
    memoryUsedGb: float = Field(ge=0)
    diskPercent: float = Field(ge=0, le=100)
    uptime: str
    k3sVersion: str
    swapUsedGb: float = Field(default=0, ge=0)
    load1: float = Field(default=0, ge=0)
    diskUsedGb: float = Field(default=0, ge=0)
    diskTotalGb: float = Field(default=0, ge=0)
    networkRxMbps: float = Field(default=0, ge=0)
    networkTxMbps: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_capacity(self) -> "HostSnapshot":
        if self.memoryUsedGb > self.memoryGb:
            raise ValueError("memoryUsedGb cannot exceed memoryGb.")
        if self.diskTotalGb > 0 and self.diskUsedGb > self.diskTotalGb:
            raise ValueError("diskUsedGb cannot exceed diskTotalGb.")
        return self


class AgentSnapshot(BaseModel):
    machineId: str = Field(min_length=1, max_length=128)
    collectedAt: datetime
    host: HostSnapshot

    _collected_at_timezone = field_validator("collectedAt")(require_timezone)
    workloads: list[Workload]
    namespaces: list[NamespaceSummary]
    maintenance: MaintenanceSummary

    @model_validator(mode="after")
    def validate_snapshot_identity(self) -> "AgentSnapshot":
        if self.machineId != self.host.id:
            raise ValueError("snapshot machineId must match host.id.")

        workload_ids = [workload.id for workload in self.workloads]
        if len(workload_ids) != len(set(workload_ids)):
            raise ValueError("snapshot workload ids must be unique.")

        namespace_names = [namespace.name for namespace in self.namespaces]
        if len(namespace_names) != len(set(namespace_names)):
            raise ValueError("snapshot namespace names must be unique.")
        return self


class AgentStatus(BaseModel):
    connected: bool
    lastHeartbeat: AgentHeartbeat | None = None
    lastSnapshotAt: datetime | None = None


class CommandRequest(BaseModel):
    command: CommandName
    machineId: str = Field(min_length=1, max_length=128)
    arguments: dict[str, CommandArgument] = Field(default_factory=dict)


class CommandRun(BaseModel):
    id: str
    machineId: str
    command: CommandName
    arguments: dict[str, CommandArgument] = Field(default_factory=dict)
    status: Literal["queued", "running", "success", "failed"]
    risk: Literal["safe", "moderate"] = "safe"
    createdAt: datetime
    completedAt: datetime | None = None
    result: dict[str, object] | None = None
    error: str | None = None


class AgentCommand(BaseModel):
    id: str
    machineId: str = Field(min_length=1, max_length=128)
    command: CommandName
    arguments: dict[str, CommandArgument] = Field(default_factory=dict)


class AgentCommandResult(BaseModel):
    status: Literal["success", "failed"]
    result: dict[str, object] | None = None
    error: str | None = None


class Capabilities(BaseModel):
    restartWorkload: bool = False


ArchitectureState = Literal["live", "external", "planned", "optional"]


class PlatformNode(BaseModel):
    id: str
    name: str
    layer: Literal["source", "delivery", "lakehouse", "orchestration", "compute", "ml", "serving", "consumption", "observability", "control"]
    state: ArchitectureState
    provider: str
    role: str
    durable: bool
    location: str


class DurableDataZone(BaseModel):
    name: str
    owner: str
    purpose: str


class PlatformArchitecture(BaseModel):
    nodes: list[PlatformNode]
    deliveryFlow: list[str]
    controlFlow: list[str]
    engineeringFlow: list[str]
    mlEnrichmentFlow: list[str]
    durableZones: list[DurableDataZone]
    goldSurvivesVmShutdown: bool = True
    businessReactInScope: bool = False

    @model_validator(mode="after")
    def validate_graph(self) -> "PlatformArchitecture":
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Platform node ids must be unique.")

        known = set(node_ids)
        for flow_name in ("deliveryFlow", "controlFlow", "engineeringFlow", "mlEnrichmentFlow"):
            flow = getattr(self, flow_name)
            unknown = [node_id for node_id in flow if node_id not in known]
            if unknown:
                raise ValueError(f"{flow_name} references unknown platform nodes: {unknown}")

        zone_names = [zone.name for zone in self.durableZones]
        if len(zone_names) != len(set(zone_names)):
            raise ValueError("Durable data zone names must be unique.")

        if self.goldSurvivesVmShutdown:
            gold = next((zone for zone in self.durableZones if zone.name == "Gold"), None)
            if gold is None:
                raise ValueError("Gold durability invariant requires a Gold durable data zone.")
            if gold.owner != "MotherDuck / DuckLake":
                raise ValueError("Gold durability invariant requires MotherDuck / DuckLake ownership.")

        if self.businessReactInScope:
            raise ValueError("Business React applications are outside the ReactOracle product boundary.")

        return self


class GoldTableContract(BaseModel):
    name: str
    grain: str
    purpose: str
    consumers: list[str]
    storage: str
    mlDerived: bool = False
    status: Literal["planned", "available"] = "planned"

    @field_validator("name")
    @classmethod
    def validate_gold_name(cls, value: str) -> str:
        if not value.startswith("gold.") or value == "gold.":
            raise ValueError("Gold table names must use the gold.<name> namespace.")
        return value

    @field_validator("consumers")
    @classmethod
    def validate_consumers(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("Gold tables must declare at least one consumer.")
        if len(value) != len(set(value)):
            raise ValueError("Gold table consumers must be unique.")
        return value


class ProviderInventoryItem(BaseModel):
    id: str
    name: str
    category: Literal["compute", "code", "cicd", "lakehouse", "streaming", "database", "ml", "edge", "api", "lab", "artifacts"]
    state: ArchitectureState
    role: str
    costIntent: Literal["free-tier", "no-cost", "unknown"]
    telemetry: Literal["live", "partial", "not-connected"]
    limitsVerified: bool = False
    detail: str


class ProviderInventory(BaseModel):
    providers: list[ProviderInventoryItem]
    usageBarsRequireVerifiedLimits: bool = True

    @model_validator(mode="after")
    def validate_inventory(self) -> "ProviderInventory":
        provider_ids = [provider.id for provider in self.providers]
        if len(provider_ids) != len(set(provider_ids)):
            raise ValueError("Provider ids must be unique.")

        if not self.usageBarsRequireVerifiedLimits:
            raise ValueError("Provider usage bars must require verified provider limits.")
        return self


DataFactoryStageState = Literal["planned", "live", "external", "optional"]


class DataFactoryStage(BaseModel):
    id: str
    name: str
    engine: str
    location: str
    state: DataFactoryStageState
    detail: str


class ContosoScale(BaseModel):
    orders: int = Field(gt=0)
    customers: int = Field(gt=0)
    products: int = Field(gt=0)
    stores: int = Field(gt=0)
    days: int = Field(gt=0)


class ContosoMlPlan(BaseModel):
    profile: str
    positiveOutcomeRate: float = Field(ge=0, le=1)
    signalStrength: float = Field(ge=0, le=1)
    noiseLevel: float = Field(ge=0, le=1)
    target: str
    primarySignal: str
    optional: bool = True


class ContosoOutputPlan(BaseModel):
    format: Literal["Parquet"]
    destination: Literal["MotherDuck / DuckLake"]
    durableZones: list[str]

    @field_validator("durableZones")
    @classmethod
    def validate_durable_zones(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("At least one durable zone is required.")
        if len(value) != len(set(value)):
            raise ValueError("Durable output zones must be unique.")
        return value


class ContosoGenerationPlan(BaseModel):
    scenario: str
    generator: str
    seed: int
    optional: bool = True
    scale: ContosoScale
    ml: ContosoMlPlan
    output: ContosoOutputPlan


class DataFactoryPlan(BaseModel):
    contoso: ContosoGenerationPlan
    coreStages: list[DataFactoryStage]
    mlStages: list[DataFactoryStage]
    executionEnabled: bool = False
    businessReactInScope: bool = False

    @model_validator(mode="after")
    def validate_boundary(self) -> "DataFactoryPlan":
        if self.executionEnabled:
            raise ValueError("Data Factory execution is disabled in ReactOracle V1.")
        if self.businessReactInScope:
            raise ValueError("Business React applications are outside the ReactOracle product boundary.")
        if "Gold" not in self.contoso.output.durableZones:
            raise ValueError("Data Factory output must include durable Gold.")
        if self.contoso.output.destination != "MotherDuck / DuckLake":
            raise ValueError("Data Factory durable destination must be MotherDuck / DuckLake.")
        return self
