# ReactOracle architecture

## Product boundary

ReactOracle is a lightweight control plane for one small Oracle Cloud data-engineering server. It intentionally does not replace mature specialist products.

- ReactOracle provides the simple daily 80% experience.
- Grafana provides deep observability.
- Headlamp provides advanced Kubernetes administration.
- Airflow UI provides DAG-level operations.
- Spark History Server provides completed Spark-job inspection.
- VS Code + OpenTofu remain the primary infrastructure authoring workflow.

## Deployment topology

Cloudflare-hosted React UI -> external Control API -> outbound-connected Oracle Ops Agent -> Oracle A1 VM.

The agent may read host/systemd/apt/storage state, the K3s Kubernetes API, and OCI instance metadata. Kafka, FastAPI application workloads, MotherDuck, Neon and similar managed services remain external.

## Security invariants

1. The browser never receives SSH keys, kubeconfig admin credentials, or OCI secrets.
2. The agent does not implement a generic remote-shell endpoint.
3. Commands are allow-listed domain operations such as k8s.restart_workload or vm.apt.refresh.
4. OpenTofu plan/apply runs in CI rather than as a resident Oracle service.
5. Destructive operations require explicit confirmation and audit records.
6. The agent should prefer outbound connections so the VM does not need a public administration port.

## Workload strategy

Persistent on Oracle when enabled: K3s, Airflow, Grafana, Prometheus, Loki, Spark History Server, Headlamp and the Airflow metadata database. Business analytical data is not persisted there as its canonical copy.

Ephemeral Kubernetes Jobs: Spark applications, dbt, Polars and maintenance jobs.

External: Kafka, FastAPI application backend, MotherDuck, Neon and frontend hosting.

Future source layer: ReactOracle can optionally call a headless Contoso Forge derivative to generate deterministic synthetic Parquet plus ML ground truth. That generator is not required for normal Airflow/Spark use.

The durable analytical plane is MotherDuck / DuckLake. Oracle K3s is compute and orchestration; it is not the canonical home of Raw, Bronze, Silver, Gold or feature data.

The core data-engineering lineage ends at durable Gold:

```text
optional Contoso generator
        -> Parquet + truth manifest
        -> MotherDuck / DuckLake Raw
        -> Airflow
        -> Spark on K3s
        -> MotherDuck / DuckLake Bronze / Silver / Gold / Features
        -> BI / SQL / notebooks / read-only APIs
```

ML is an optional enrichment branch, not a prerequisite for serving Gold:

```text
MotherDuck / DuckLake Features
        -> Kaggle / MLJAR
        -> historical predictions / analytical results back to DuckLake
        -> optional compact latest-state / metadata mirror in Neon
```

If the Oracle VM is stopped or rebuilt, durable analytical tables must remain available in the external lakehouse.

V1 exposes this architecture and capability model; generator execution is a later vertical slice.

## Frontend modules

- Overview
- Architecture
- Topology
- Infrastructure / OpenTofu
- Kubernetes
- Data Factory
- Data Platform
- Monitoring
- Providers
- Logs
- Maintenance
- Activity
- Settings

The future Data Factory / source layer is documented in `docs/DATA_FACTORY_ROADMAP.md`. The Gold serving boundary is documented in `docs/GOLD_SERVING.md`. Business-specific React dashboards are outside this repository; ReactOracle serves and exposes Gold rather than implementing the consuming application.

The implementation keeps typed mock mode for local UI development and also has live adapters behind stable domain interfaces. React components do not connect directly to Kubernetes or OCI APIs.


## Provider inventory policy

ReactOracle keeps provider/free-tier inventory separate from workload telemetry.

The provider page may show provider role, lifecycle state, cost intent and integration status. It must not render quota percentages from remembered or static documentation. A usage bar requires both a live provider usage adapter and a verified current limit.

This keeps mutable free-tier limits from being mistaken for authoritative telemetry.
