# ReactOracle architecture

## Product boundary

ReactOracle is the lightweight control plane for the FOIL Oracle Cloud lab. Specialist tools keep their own responsibilities:

- ReactOracle: daily control/status and architecture inventory
- Airflow: workflow scheduling and DAG operations
- K3s: task isolation and runtime orchestration
- Grafana / Prometheus / Loki: observability
- Headlamp: deeper Kubernetes administration
- OpenTofu: OCI infrastructure-as-code through CI
- MotherDuck / DuckLake: durable analytical plane

The browser never receives OCI credentials, cluster-admin kubeconfig, SSH keys or MotherDuck tokens.

## Deployment topology

```text
React UI
  -> external FastAPI Control API
  -> outbound Oracle Ops Agent
  -> OCI Ampere VM
       -> K3s
            -> Airflow 3.3.2
            -> KubernetesExecutor task pods
                 -> Polars
                 -> DuckDB
            -> Grafana / Prometheus / Loki
```

Fabric and Databricks are separate FOIL labs. They do not run on this VM.

## Data architecture

The Oracle VM is compute/orchestration, not the authoritative analytical store.

```text
FOIL WIND synthetic runtime
        |
        +--> OCI Object Storage
        |      immutable raw/archive (planned)
        |
        v
Airflow on K3s
        |
        v
Polars validation / transformation
        |
        v
DuckDB analytical SQL
        |
        v
MotherDuck hosted DuckLake
  bronze.wind_telemetry
  silver.wind_telemetry
  gold.wind_run_summary
        |
        +--> optional compact Neon serving mirror
        +--> frozen/versioned research export -> Databricks
        +--> selected external experiments -> Fabric
```

Bronze, Silver and Gold stay together in MotherDuck/DuckLake. Neon is not a substitute medallion store.

## Evidence boundary

The first executable source is deliberately `SYNTHETIC`.

Current software contracts may carry source-backed project context such as the 90-degree inter-foil phase and head-only yaw architecture, but numeric power, vibration and yaw-response values remain model/synthetic proxies. They are not measured performance and cannot update Core Truth automatically.

## Workload strategy

Persistent on Oracle when enabled:

- K3s
- Airflow scheduler/API/DAG processor
- small Airflow PostgreSQL metadata database
- Grafana / Prometheus / Loki / Alloy
- Oracle Ops Agent

Ephemeral:

- Airflow KubernetesExecutor task pods
- Polars transformations
- DuckDB analytical tasks
- maintenance jobs

External:

- MotherDuck/DuckLake
- OCI Object Storage
- Neon
- Fabric
- Databricks
- frontend/control-plane hosting

## Infrastructure

OpenTofu source belongs in GitHub and runs through CI. ReactOracle may display plan/apply status, but the browser does not execute `tofu apply` or hold cloud credentials.

## Deployment claims

Repository code and CI success do not prove runtime deployment. Airflow, MotherDuck, OCI archive and provider integrations stay `planned` until verified against live services.
