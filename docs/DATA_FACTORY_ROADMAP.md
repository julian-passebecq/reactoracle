# FOIL Oracle data-pipeline roadmap

## Canonical V1 path

```text
SYNTHETIC WIND telemetry
   -> Parquet + provenance manifest
   -> Airflow on Oracle K3s
   -> Polars validation/transformation
   -> DuckDB SQL
   -> MotherDuck / DuckLake
        Bronze -> Silver -> Gold
```

A separate OCI Object Storage path will preserve immutable raw Parquet/manifests for recovery.

## Current executable slice

The repository contains:

- deterministic WIND telemetry generator;
- explicit `SYNTHETIC` classification;
- Polars quality validation;
- DuckDB Bronze/Silver/Gold transforms;
- `gold.wind_run_summary`;
- Airflow DAG `foil_wind_medallion`;
- K3s/Airflow Helm values using KubernetesExecutor;
- local DuckDB tests and MotherDuck connection support.

Live MotherDuck, K3s Airflow and OCI archive execution still require provider/runtime verification.

## Storage boundaries

**MotherDuck / DuckLake**
- Bronze
- Silver
- Gold
- optional Features
- governed analytical history

**OCI Object Storage**
- immutable raw/archive files
- manifests/checksums
- recovery artifacts

**Neon**
- compact run/result index
- selected Gold serving rows
- application-oriented relational queries

**MongoDB**
- FOIL engineering/project truth
- provenance
- observations/decisions
- not raw telemetry

## External labs

Fabric remains the Microsoft-oriented real-time/Data Factory/OneLake/notebook lab.

Databricks remains the frozen-snapshot research path for Monte Carlo, PySpark, ML and MLflow.

The Oracle pipeline should not duplicate these responsibilities merely to use another tool.

## Next implementation slices

1. build/publish the ARM64-capable Airflow task image;
2. deploy Airflow Helm release to the OCI K3s host;
3. create/verify MotherDuck DuckLake and token;
4. run `foil_wind_medallion` end to end;
5. archive raw Parquet + manifest to OCI Object Storage;
6. publish a compact Gold run index to Neon;
7. expose verified pipeline/run state in ReactOracle;
8. replace or supplement the synthetic source with timestamped live Oracle telemetry only when a measured-data contract exists.
