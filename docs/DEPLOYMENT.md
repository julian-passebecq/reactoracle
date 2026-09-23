# Deployment sequence

ReactOracle adopts the existing Oracle A1 VM incrementally. Source code and CI success do not prove a live deployment.

## 1. Oracle host

Keep the existing Oracle A1 instance.

Host prerequisites:

- Ubuntu
- K3s
- Helm
- kubectl
- Docker only when useful for local image build/test

K3s is the persistent workload runtime.

## 2. K3s namespaces

Recommended boundaries:

```text
kube-system
reactoracle-system
monitoring
airflow
jobs
```

Airflow uses KubernetesExecutor. Data tasks are ephemeral pods; there is no Spark namespace.

## 3. Control API

Deploy `control-api/` outside the Oracle VM.

Required:

```text
REACTORACLE_AGENT_TOKEN=<long-random-secret>
```

Optional:

```text
REACTORACLE_ALLOWED_ORIGINS=https://your-react-frontend.example.com
REACTORACLE_ENABLE_MUTATIONS=false
```

Do not expose an unauthenticated administration API.

## 4. Oracle agent

Install the ARM64 agent artifact produced by CI, or build it manually.

```bash
sudo ./agent/install.sh
sudo ./agent/configure-kube-access.sh
sudo systemctl start reactoracle-agent
sudo systemctl status reactoracle-agent
```

Configure:

```text
REACTORACLE_CONTROL_API_URL=https://your-control-api.example.com
REACTORACLE_AGENT_TOKEN=<same-secret>
REACTORACLE_INTERVAL_SECONDS=30
```

The agent is outbound-only.

## 5. Frontend

Host the Vite build outside Oracle.

```text
VITE_CONTROL_API_BASE_URL=https://your-control-api.example.com
VITE_GRAFANA_URL=https://...
VITE_HEADLAMP_URL=https://...
VITE_AIRFLOW_URL=https://...
```

If `VITE_CONTROL_API_BASE_URL` is empty, ReactOracle intentionally runs in mock mode.

## 6. Monitoring

K3s observability:

```text
Prometheus -> metrics
Loki       -> logs
Grafana    -> deep dashboards
Alloy      -> log collection
```

ReactOracle owns concise operational summaries; Grafana remains the deeper investigation surface.

## 7. Airflow and analytical pipeline

The accepted Oracle data path is:

```text
Airflow / KubernetesExecutor
        -> Polars
        -> DuckDB
        -> MotherDuck / DuckLake Bronze/Silver/Gold
```

Raw Parquet/manifests are planned for OCI Object Storage archive. Neon is an optional compact serving/index database.

Deploy Airflow only after the task image exists:

```bash
docker build -t ghcr.io/julian-passebecq/reactoracle-airflow:0.1.0 pipelines/
# publish through an explicit release workflow
export MOTHERDUCK_TOKEN='...'
bash kubernetes/airflow/install.sh
```

Do not claim this runtime is deployed until the Helm release, MotherDuck database and DAG run are verified.

## 8. External FOIL labs

- Microsoft Fabric: separate real-time / Data Factory / OneLake / notebook lab.
- Databricks: separate frozen-snapshot Monte Carlo / PySpark / ML / MLflow lab.

They consume explicit governed inputs and do not replace the Oracle pipeline or Core Truth.

## 9. OpenTofu

OpenTofu is authored in GitHub/VS Code and executed through CI. ReactOracle may display plan/apply state, but the browser does not hold OCI credentials or execute `tofu apply` directly.

The existing Oracle VM should be adopted/imported rather than destroyed merely to demonstrate IaC.

## First live acceptance gates

1. Control API health succeeds.
2. Oracle agent is authenticated and connected.
3. host telemetry comes from the real VM.
4. K3s workload/namespace inventory matches the VM.
5. monitoring dashboards are reachable through the intended access path.
6. the Airflow Helm release is healthy.
7. `foil_wind_medallion` completes.
8. MotherDuck contains the expected Bronze/Silver/Gold tables.
9. all generated Wind performance fields remain labelled `SYNTHETIC`.
10. no unplanned public administration port is opened.
