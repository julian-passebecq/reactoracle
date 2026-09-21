from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from .mock_data import build_live_overview_template
from .models import AgentCommand, AgentCommandResult, AgentHeartbeat, AgentSnapshot, AgentStatus, CommandName, CommandRun, Overview, ServiceSummary


class ControlPlaneStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self._overview: Overview | None = None
            self._heartbeat: AgentHeartbeat | None = None
            self._snapshot_at: datetime | None = None
            self._commands: dict[str, CommandRun] = {}
            self._command_order: list[str] = []

    def get_overview(self) -> Overview | None:
        with self._lock:
            return deepcopy(self._overview)

    def record_heartbeat(self, heartbeat: AgentHeartbeat) -> None:
        with self._lock:
            self._heartbeat = heartbeat

    def record_snapshot(self, snapshot: AgentSnapshot) -> None:
        with self._lock:
            overview = deepcopy(self._overview) if self._overview is not None else build_live_overview_template()
            host = snapshot.host
            overview.vm.id = host.id
            overview.vm.name = host.name
            overview.vm.shape = host.shape
            overview.vm.ocpu = host.ocpu
            overview.vm.memoryGb = host.memoryGb
            overview.vm.cpuPercent = host.cpuPercent
            overview.vm.memoryUsedGb = host.memoryUsedGb
            overview.vm.diskPercent = host.diskPercent
            overview.vm.uptime = host.uptime
            overview.vm.k3sVersion = host.k3sVersion
            overview.vm.swapUsedGb = host.swapUsedGb
            overview.vm.load1 = host.load1
            overview.vm.diskUsedGb = host.diskUsedGb
            overview.vm.diskTotalGb = host.diskTotalGb
            overview.vm.networkRxMbps = host.networkRxMbps
            overview.vm.networkTxMbps = host.networkTxMbps
            overview.workloads = snapshot.workloads
            overview.namespaces = snapshot.namespaces
            overview.maintenance = snapshot.maintenance
            overview.services = self._derive_services(snapshot, overview.services)
            self._overview = overview
            self._snapshot_at = snapshot.collectedAt

    def get_agent_status(self) -> AgentStatus:
        with self._lock:
            connected = False
            if self._heartbeat is not None:
                age = datetime.now(timezone.utc) - self._heartbeat.sentAt
                age_seconds = age.total_seconds()
                connected = 0 <= age_seconds < 90
            return AgentStatus(
                connected=connected,
                lastHeartbeat=deepcopy(self._heartbeat),
                lastSnapshotAt=self._snapshot_at,
            )


    def create_command(
        self,
        machine_id: str,
        command: CommandName,
        arguments: dict[str, str | int | float | bool] | None = None,
        risk: str = "safe",
    ) -> CommandRun:
        with self._lock:
            run = CommandRun(
                id=f"cmd_{uuid4().hex}",
                machineId=machine_id,
                command=command,
                arguments=arguments or {},
                status="queued",
                risk=risk,
                createdAt=datetime.now(timezone.utc),
            )
            self._commands[run.id] = run
            self._command_order.append(run.id)
            return deepcopy(run)

    def get_command(self, command_id: str) -> CommandRun | None:
        with self._lock:
            run = self._commands.get(command_id)
            return deepcopy(run) if run else None

    def recent_commands(self, limit: int = 20) -> list[CommandRun]:
        with self._lock:
            ids = self._command_order[-max(1, min(limit, 100)):]
            return [deepcopy(self._commands[item]) for item in reversed(ids)]

    def lease_next_command(self, machine_id: str) -> AgentCommand | None:
        with self._lock:
            for command_id in self._command_order:
                run = self._commands[command_id]
                if run.status == "queued" and run.machineId == machine_id:
                    run.status = "running"
                    self._commands[command_id] = run
                    return AgentCommand(id=run.id, machineId=run.machineId, command=run.command, arguments=run.arguments)
            return None

    def complete_command(self, command_id: str, result: AgentCommandResult) -> CommandRun | None:
        with self._lock:
            run = self._commands.get(command_id)
            if run is None:
                return None
            run.status = result.status
            run.result = result.result
            run.error = result.error
            run.completedAt = datetime.now(timezone.utc)
            self._commands[command_id] = run
            return deepcopy(run)

    @staticmethod
    def _derive_services(snapshot: AgentSnapshot, previous: list[ServiceSummary]) -> list[ServiceSummary]:
        by_id = {service.id: deepcopy(service) for service in previous}
        namespaces = {item.name: item for item in snapshot.namespaces}

        total_ready = sum(item.podsReady for item in snapshot.namespaces)
        total = sum(item.podsTotal for item in snapshot.namespaces)
        k3s = by_id.get("k3s")
        if k3s:
            k3s.status = "healthy" if total > 0 and total_ready == total else "warning"
            k3s.detail = f"{total_ready} / {total} pods"

        airflow = by_id.get("airflow")
        if airflow:
            ns = namespaces.get("airflow")
            airflow.status = "healthy" if ns and ns.podsTotal > 0 and ns.podsReady == ns.podsTotal else "warning"
            airflow.detail = "namespace healthy" if airflow.status == "healthy" else "check airflow namespace"

        spark = by_id.get("spark")
        if spark:
            running_jobs = [item for item in snapshot.workloads if item.namespace == "spark" and item.kind == "Job" and item.status == "Running"]
            spark.status = "healthy" if running_jobs else "idle"
            spark.detail = f"{len(running_jobs)} active job(s)" if running_jobs else "no active application"

        for service_id in ("grafana", "prometheus", "loki"):
            service = by_id.get(service_id)
            if not service:
                continue
            matches = [item for item in snapshot.workloads if item.namespace == "monitoring" and service_id in item.name]
            service.status = "healthy" if any(item.status == "Running" for item in matches) else "warning"
            service.detail = "workload running" if service.status == "healthy" else "workload not ready"

        return list(by_id.values())


store = ControlPlaneStore()
