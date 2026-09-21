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

Persistent: K3s, Airflow, Grafana, Prometheus, Loki, Spark History Server, Headlamp and initially PostgreSQL.

Ephemeral Kubernetes Jobs: Spark applications, dbt, Polars and maintenance jobs.

External: Kafka, FastAPI application backend, MotherDuck, Neon and frontend hosting.

Future source layer: ReactOracle can optionally call a headless Contoso Forge derivative to generate deterministic synthetic source data. That generator is not required for normal Airflow/Spark use. Small/medium scenarios may first load an optional source-system Neon/PostgreSQL database; large scenarios should flow as Parquet/object/file outputs directly into Airflow/Spark.

The intended complete lineage is:

```text
optional Contoso generator
        -> optional source Neon
        -> Airflow
        -> Spark on K3s
        -> Bronze/Silver/Gold/features
        -> Kaggle/MLJAR
        -> result/serving Neon
        -> dbt / BI
```

V1 exposes this architecture and capability model; generator execution is a later vertical slice.

## Frontend modules

- Overview
- Infrastructure / OpenTofu
- Kubernetes
- Data Platform
- Monitoring
- Logs
- Maintenance
- Activity
- Settings

A future Data Factory / source layer is documented in `docs/DATA_FACTORY_ROADMAP.md`.

The first implementation is UI-first with typed mock data. Live adapters should be introduced behind stable domain interfaces rather than wiring UI components directly to Kubernetes or OCI APIs.
