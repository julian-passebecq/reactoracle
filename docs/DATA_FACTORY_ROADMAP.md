# Data Factory roadmap

ReactOracle V1 remains an infrastructure and data-platform control plane. It models the first upstream source and durable analytical layers so the complete architecture is visible before generator execution is implemented.

## Canonical future source path

The first synthetic source will be a small ReactOracle-specific derivative of Contoso Forge.

It remains an external/headless generator with a narrow contract. ReactOracle owns the UI and orchestration.

```text
CORE DATA ENGINEERING

ReactOracle
   |
   v
Contoso Forge Lite (optional source)
   |
   | Parquet + truth/provenance
   v
MotherDuck / DuckLake Raw
   |
   v
Airflow
   |
   v
Spark on Oracle K3s
   |
   | validated outputs
   v
MotherDuck / DuckLake
Bronze / Silver / Gold / Features
   |
   +--> Power BI / SQL / notebooks / APIs


OPTIONAL ML ENRICHMENT

MotherDuck / DuckLake Features
   |
   v
Kaggle + MLJAR
   |
   +--> historical predictions -> DuckLake
   +--> compact latest state / metrics -> optional Neon
   +--> model artifacts -> artifact storage
```

## Why the generator is optional

The Oracle VM must remain useful independently.

ReactOracle supports three conceptual source modes:

1. **Generated source** — Contoso Forge Lite creates deterministic synthetic Parquet plus ML ground truth.
2. **Existing source** — Airflow ingests an existing database, API, file set or Kafka topic.
3. **Direct lab input** — Spark/dbt/Polars can work on an existing dataset without invoking the generator.

The generator is an additional source-system layer, not a prerequisite for Airflow, Spark or the VM.

## Contoso contract to preserve

The minimal derivative should retain:

- deterministic seed
- realistic relational retail entities
- shipments, returns, support tickets and reviews
- optional DE defects such as duplicates, CDC, late arrivals, SCD2 and quality issues
- `causal-v1` ML signal controls
- `positiveOutcomeRate`
- `signalStrength`
- `noiseLevel`
- truth/provenance manifest
- dataset fingerprint and checksums
- CSV and Parquet output
- Linux/ARM64 headless execution if practical

ReactOracle should never require the old WPF UI.

## Durable data ownership

The Oracle VM is compute, not the durable business-data store.

The canonical durable analytical zones are:

```text
MotherDuck / DuckLake
  Raw
  Bronze
  Silver
  Gold
  Features
```

Stopping or rebuilding the Oracle VM must not remove these tables.

Spark may use temporary/local files while a job is running, but pipeline completion should publish the canonical result back to the durable lakehouse.

## Optional Neon role

Neon is no longer the canonical Contoso source or Gold store.

Use it only when a scenario benefits from PostgreSQL semantics or small low-latency serving state, for example:

- a dedicated exercise simulating a PostgreSQL operational source;
- ReactOracle operational metadata;
- ML experiment metadata;
- compact latest-prediction / serving tables;
- model registry metadata.

Do not force large generated, Bronze, Silver or Gold datasets through PostgreSQL.

## Gold serving boundary

ReactOracle does not build business-specific React dashboards.

The platform responsibility ends at a stable Gold interface:

```text
MotherDuck / DuckLake Gold
        |
        +--> Power BI
        +--> SQL clients
        +--> notebooks
        +--> read-only APIs
```

A future business application may consume those interfaces, but that application is outside ReactOracle scope.

## V1 boundary

V1 should display:

- Contoso Forge as a planned optional source;
- MotherDuck / DuckLake as the planned durable analytical layer;
- Raw -> Bronze -> Silver -> Gold -> Features;
- Airflow -> Spark compute on Oracle K3s;
- Kaggle / MLJAR as planned external ML compute;
- optional Neon serving/metadata role;
- Gold as the final platform serving boundary;
- capability state such as `planned`, `external`, `optional` and `live`.

V1 should not yet:

- run the C# generator;
- provision MotherDuck automatically;
- upload generated datasets;
- trigger Kaggle training;
- implement a business dashboard;
- treat the generator as a requirement for normal VM use.

## V2 vertical slice

The first executable journey should remain intentionally small:

1. submit a Contoso generation spec;
2. run the generator;
3. validate manifest and fingerprints;
4. publish generated Parquet into the durable lakehouse;
5. start an Airflow DAG;
6. use Spark for Bronze/Silver/Gold/feature engineering;
7. publish validated outputs back to MotherDuck / DuckLake;
8. create a bounded ML feature package;
9. submit Kaggle / MLJAR;
10. import metrics and predictions;
11. retain historical analytical outputs in the lakehouse;
12. optionally publish compact serving metadata to Neon;
13. expose Gold tables to BI / SQL consumers.

This becomes ReactOracle's canonical end-to-end case while the VM remains usable for unrelated Spark/Airflow/dbt/Polars work.
