# ReactOracle

ReactOracle is a lightweight control plane for an Oracle Cloud data-engineering lab.

It is intentionally split so the Oracle VM spends its resources on data-platform workloads instead of on a large administration frontend.

## Architecture

```text
React + Fluent UI 2
(hosted outside Oracle)
        |
        v
FastAPI Control API
(hosted outside Oracle)
        |
        | outbound authenticated telemetry
        v
Oracle Ops Agent
(systemd, Go, ARM64)
        |
        +-- OCI IMDSv2
        +-- Linux host inventory
        +-- read-only K3s API access
        |
        v
Oracle A1 VM
        |
        +-- K3s
        |   +-- Airflow
        |   +-- Spark jobs / Spark History Server
        |   +-- Grafana
        |   +-- Prometheus
        |   +-- Loki
        |
        +-- Docker for build/test work when useful
```

External services such as managed Kafka, FastAPI application workloads, MotherDuck and Neon stay outside the VM.

The target data architecture treats **Oracle as compute** and **MotherDuck / DuckLake as durable analytical storage**. Raw, Bronze, Silver, Gold and feature tables should survive Oracle VM shutdown/rebuild. ReactOracle stops at the Gold serving boundary; business-specific React dashboards are intentionally out of scope.

OpenTofu manages OCI infrastructure through CI rather than running as a permanent service on the VM.

## Current implementation

The frontend already provides routed pages for:

- Overview
- Architecture
- Topology
- Infrastructure / OpenTofu
- Kubernetes
- Data Factory
- Data Platform
- Monitoring
- Logs
- Maintenance
- Activity
- Settings

The current live read path is:

```text
Oracle VM
  -> Go agent
  -> Control API
  -> React Query adapter
  -> ReactOracle UI
```

The agent currently collects OCI shape metadata, OCPU/RAM, CPU usage, memory usage, root disk utilization, uptime, K3s version, Kubernetes workload inventory, namespace readiness, OS/kernel and reboot-required state.

A lightweight K3s observability bundle is also checked in under `kubernetes/monitoring/`: kube-prometheus-stack, Grafana, Loki and Grafana Alloy, with short retention and resource limits sized for the small Oracle lab.

## Frontend

```bash
npm install
npm run dev
```

Without configuration the UI uses typed mock data.

For live mode:

```bash
cp .env.example .env
```

Set:

```env
VITE_CONTROL_API_BASE_URL=https://your-control-api.example.com
VITE_GRAFANA_URL=
VITE_HEADLAMP_URL=
VITE_AIRFLOW_URL=
VITE_SPARK_HISTORY_URL=
```

## Control API

The backend lives in `control-api/`.

```bash
cd control-api
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
export REACTORACLE_AGENT_TOKEN='replace-me'
fastapi dev app/main.py
```

The browser-facing API is read-only in the current phase. The agent ingress requires a bearer token.

## Oracle agent

The agent lives in `agent/` and is written in Go so it can run as a small ARM64 systemd service.

CI cross-compiles an installable Linux ARM64 artifact containing:

- `reactoracle-agent`
- systemd unit
- environment example
- install script
- least-privilege K3s bootstrap script
- read-only RBAC manifest
- SHA-256 checksum

Manual build:

```bash
cd agent
GOOS=linux GOARCH=arm64 go build -o reactoracle-agent ./cmd/reactoracle-agent
```

The agent opens no inbound administration port.

## Security invariants

- no generic remote-shell API
- no SSH key, OCI secret or cluster-admin kubeconfig in the browser
- agent traffic is outbound from the VM
- agent Kubernetes access is read-only through dedicated RBAC
- OpenTofu credentials remain in CI
- disruptive operations will require explicit confirmation and audit records
- destructive operations remain disabled during bootstrap

See:

- `docs/ARCHITECTURE.md`
- `docs/CONTROL_API.md`
- `docs/ROADMAP.md`
- `docs/DEPLOYMENT.md`
- `docs/MONITORING.md`
- `docs/DATA_FACTORY_ROADMAP.md`
- `docs/GOLD_SERVING.md`
- `agent/README.md`
- `kubernetes/README.md`
