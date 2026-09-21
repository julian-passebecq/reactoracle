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
