# Control API contract

ReactOracle separates browser UI, orchestration logic, and privileged VM operations.

## Transport

- Browser -> Control API: HTTPS.
- Oracle agent -> Control API: outbound authenticated HTTPS/WebSocket or long polling.
- The browser never connects directly to SSH, the Kubernetes admin API, systemd, or OCI secrets.

## Read endpoints - V0.2

```text
GET /api/v1/overview
GET /api/v1/machines
GET /api/v1/machines/{machineId}
GET /api/v1/k8s/namespaces
GET /api/v1/k8s/workloads
GET /api/v1/infrastructure
GET /api/v1/maintenance
GET /api/v1/activity
GET /api/v1/logs?namespace=&workload=&window=
```

The frontend currently expects four aggregate reads:

```text
GET /api/v1/overview
GET /api/v1/k8s/workloads
GET /api/v1/infrastructure
GET /api/v1/maintenance
```

These payloads must conform to the TypeScript domain contracts in `src/domain/types.ts`.

## Command model - V0.3

Commands are explicit domain operations. There is no generic shell endpoint.

Examples:

```text
k8s.restart_workload
k8s.scale_workload
vm.health_check
k8s.logs
vm.apt_refresh
docker.inspect_images
docker.prune_unused_images
spark.submit_job
dbt.run_build
polars.run_job
backup.run
tofu.validate
tofu.plan
tofu.apply
```

Proposed request:

```json
{
  "command": "k8s.restart_workload",
  "target": { "namespace": "airflow", "name": "airflow-scheduler" },
  "requestId": "client-generated-id"
}
```

Proposed response:

```json
{
  "commandRunId": "cmd_123",
  "status": "queued",
  "risk": "moderate"
}
```

## Risk policy

- Safe: read state, health checks, logs, OpenTofu validate/plan.
- Moderate: restart a workload, submit Spark/dbt/Polars jobs, prune confirmed unused images.
- Dangerous: OpenTofu apply, restart K3s, install OS updates, reboot the VM.
- Destructive: delete a namespace, volume, or infrastructure. Disabled by default.

Every mutation must produce an audit event with actor, command, target, result, start/end timestamps, and a correlation ID.

## Agent heartbeat

Minimum heartbeat payload:

```json
{
  "agentVersion": "0.1.0",
  "machineId": "oracle-a1-01",
  "status": "healthy",
  "k3sReachable": true,
  "sentAt": "2026-09-21T17:00:00+02:00"
}
```

The agent should run as a small systemd service outside K3s so that it can report when K3s itself is unhealthy.


### Kubernetes log reads

The first non-health command is a bounded read-only log operation:

```json
{
  "command": "k8s.logs",
  "machineId": "oracle-a1-01",
  "arguments": {
    "namespace": "airflow",
    "name": "airflow-scheduler",
    "kind": "Deployment",
    "tail": 100
  }
}
```

Validation is duplicated at the Control API and agent boundaries. Allowed kinds are Deployment, StatefulSet, DaemonSet and Job. Namespace and workload names must match Kubernetes-safe lowercase names. Tail is restricted to 10-500 lines. The agent executes a fixed `kubectl logs` command and caps the response size.

This preserves the outbound-only design while giving the React UI a useful live log viewer before Loki/Grafana integration is complete.


### Workload restart

`k8s.restart_workload` is implemented as a moderate-risk command and is disabled by default.

```json
{
  "command": "k8s.restart_workload",
  "machineId": "oracle-a1-01",
  "arguments": {
    "namespace": "airflow",
    "name": "airflow-scheduler",
    "kind": "Deployment"
  }
}
```

Only Deployment, StatefulSet and DaemonSet are accepted. Extra arguments are rejected. The agent constructs a fixed `kubectl rollout restart` invocation; it never accepts a shell fragment from the browser.

Enablement requires both the Control API capability flag and the separate Kubernetes restart RBAC overlay. `GET /api/v1/capabilities` exposes whether restart is currently enabled at the API layer.


## Platform architecture read model

ReactOracle V1 exposes machine-readable platform contracts so the frontend does not have to hard-code the future topology when live mode is enabled.

```text
GET /api/v1/platform/architecture
GET /api/v1/platform/gold-catalog
```

The architecture response includes:

- provider/system nodes and their lifecycle state (`live`, `external`, `planned`, `optional`);
- the core data-engineering flow that ends at durable Gold;
- a separate optional ML-enrichment flow;
- durable data zones;
- explicit invariants that Gold survives Oracle VM shutdown and business React applications are outside ReactOracle scope.

The core flow intentionally does **not** depend on Kaggle or Neon. Kaggle is an optional branch from feature data and its historical analytical outputs return to the lakehouse. Neon can mirror compact latest-state / metadata tables when needed.

The Gold catalog describes stable serving contracts such as `gold.sales_daily`, `gold.customer_360`, and `gold.delivery_performance`. Each entry includes grain, purpose, consumers, storage target, ML-derived flag and lifecycle status.


## Provider inventory

```text
GET /api/v1/platform/providers
```

This endpoint describes the external provider ecosystem without claiming mutable free-tier quotas that have not been verified.

Each provider includes:

- category and role;
- lifecycle state;
- cost intent;
- telemetry connection state;
- whether current limits have been verified;
- a short integration note.

`usageBarsRequireVerifiedLimits=true` is a contract invariant. The frontend must not display quota-used percentages until an adapter supplies live usage and a verified current limit.


## Platform architecture contracts

ReactOracle keeps the V1 platform design behind Control API contracts rather than hard-wiring live UI components directly to providers.

Read-only endpoints:

```text
GET /api/v1/platform/architecture
GET /api/v1/platform/data-factory
GET /api/v1/platform/gold-catalog
GET /api/v1/platform/providers
```

The Data Factory endpoint exposes the planned Contoso -> DuckLake -> Airflow -> Spark -> Gold journey and the optional Kaggle/MLJAR enrichment branch.

V1 invariants enforced by the API models:

- Data Factory execution remains disabled;
- business React applications remain outside ReactOracle scope;
- Gold is included in durable output zones;
- MotherDuck / DuckLake is the canonical durable destination;
- architecture flows may reference only declared nodes;
- platform/provider identifiers must remain unique;
- provider usage bars require verified limits before they can be shown.


## Live read-model readiness

Operational read endpoints never fall back to demo telemetry in live mode.

Until the authenticated Oracle agent posts its first valid snapshot, these endpoints return HTTP 503:

```text
GET /api/v1/overview
GET /api/v1/k8s/workloads
GET /api/v1/infrastructure
GET /api/v1/maintenance
```

The response detail is:

```text
No live Oracle agent snapshot has been received yet.
```

This prevents mock CPU/RAM/Kubernetes/OpenTofu values from being mistaken for live infrastructure state. Static architecture-contract endpoints remain available before the agent connects.
