from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


Health = Literal["healthy", "idle", "warning", "offline"]
CommandName = Literal["vm.health_check", "k8s.logs", "k8s.restart_workload"]
CommandArgument = str | int | float | bool


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
    command: CommandName
    machineId: str
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
    machineId: str
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
    orders: int
    customers: int
    products: int
    stores: int
    days: int


class ContosoMlPlan(BaseModel):
    profile: str
    positiveOutcomeRate: float
    signalStrength: float
    noiseLevel: float
    target: str
    primarySignal: str
    optional: bool = True


class ContosoOutputPlan(BaseModel):
    format: Literal["Parquet"]
    destination: Literal["MotherDuck / DuckLake"]
    durableZones: list[str]


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
