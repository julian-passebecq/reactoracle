# Control API contract

ReactOracle separates browser UI, orchestration logic and privileged VM operations.

## Security boundary

- browser -> external Control API over HTTPS
- Oracle agent -> Control API through outbound authenticated requests
- no generic remote shell
- no OCI, Kubernetes admin or MotherDuck credentials in the browser
- mutations are allow-listed and audited

## Operational reads

```text
GET /api/v1/health
GET /api/v1/overview
GET /api/v1/k8s/workloads
GET /api/v1/infrastructure
GET /api/v1/maintenance
GET /api/v1/activity
GET /api/v1/agent/status
GET /api/v1/capabilities
```

Live operational reads return HTTP 503 until an authenticated Oracle-agent snapshot exists. Mock telemetry is never silently returned by the live API.

## Implemented command surface

```text
vm.health_check
k8s.logs
k8s.restart_workload
```

The agent builds fixed kubectl argument arrays. Browser-provided shell fragments are not executed.

Risk policy:

- safe: reads, health checks, bounded logs, future OpenTofu validate/plan
- moderate: guarded workload restart
- dangerous: future infrastructure apply, OS update/reboot
- destructive operations: disabled by default

## Platform read models

```text
GET /api/v1/platform/architecture
GET /api/v1/platform/data-factory
GET /api/v1/platform/gold-catalog
GET /api/v1/platform/providers
```

The Data Factory contract exposes:

```text
FOIL WIND synthetic source
  -> Airflow
  -> Polars + DuckDB
  -> MotherDuck / DuckLake Bronze/Silver/Gold
```

OCI Object Storage is the planned immutable raw/archive path. Neon is an optional compact serving mirror. Fabric and Databricks are separate external FOIL labs.

## Evidence contract

The V1 source contract is `classification=SYNTHETIC`, machine `MACHINE-WIND-001`, revision `2026-09-21.2`.

The API must not represent proxy power, vibration or yaw-response fields as measured engineering performance.

## Agent heartbeat and snapshots

The agent runs outside K3s as a small systemd service so it can still report a K3s failure. It supplies host and workload snapshots used by the operational read model.

Commands are only accepted for the known connected machine and, for Kubernetes workload commands, known recent workload targets. Queued commands expire before they can execute after a long disconnect.

## Provider inventory

Provider rows expose role, lifecycle state, cost intent and integration status. Usage percentages are prohibited unless a live adapter supplies actual usage and a currently verified limit.
