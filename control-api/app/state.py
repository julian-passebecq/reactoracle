from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock

from .mock_data import build_mock_overview
from .models import AgentHeartbeat, AgentSnapshot, AgentStatus, Overview, ServiceSummary


class ControlPlaneStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._overview = build_mock_overview()
        self._heartbeat: AgentHeartbeat | None = None
        self._snapshot_at: datetime | None = None

    def get_overview(self) -> Overview:
        with self._lock:
            return deepcopy(self._overview)

    def record_heartbeat(self, heartbeat: AgentHeartbeat) -> None:
        with self._lock:
            self._heartbeat = heartbeat

    def record_snapshot(self, snapshot: AgentSnapshot) -> None:
        with self._lock:
            overview = deepcopy(self._overview)
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
                connected = age.total_seconds() < 90
            return AgentStatus(
                connected=connected,
                lastHeartbeat=deepcopy(self._heartbeat),
                lastSnapshotAt=self._snapshot_at,
            )

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
