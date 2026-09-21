# Data Factory roadmap

ReactOracle V1 remains an infrastructure and data-platform control plane. It must, however, model the first upstream source layer so the complete architecture is visible before the execution path is implemented.

## Future source layer

The first supported synthetic source will be a small ReactOracle-specific derivative of Contoso Forge.

It will remain an external/headless generator with a narrow contract. ReactOracle owns the UI and orchestration.

```text
ReactOracle
   |
   v
Contoso Forge Lite
   |
   +--> optional Neon source database
   |
   v
Airflow
   |
   v
Spark on Oracle K3s
   |
   v
Bronze / Silver / Gold / feature set
   |
   v
Kaggle + MLJAR
   |
   +--> metrics / predictions -> Neon
   +--> artifacts -> artifact storage
   |
   v
dbt / BI
```

## Why the generator is optional

The Oracle VM must remain useful independently.

ReactOracle must support at least three source modes:

1. **Generated source** — Contoso Forge Lite creates deterministic synthetic data.
2. **Existing source** — Airflow ingests an already-existing database, API, file set or Kafka topic.
3. **Direct lab input** — a user can work directly with Spark/dbt/Polars on an existing dataset without running a generator.

The generator is therefore an additional source-system layer, not a prerequisite for Airflow, Spark or the VM.

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

ReactOracle should never need the old WPF UI.

## Neon roles

Do not treat every Neon database as the same thing.

### Optional source Neon

Purpose: simulate an operational PostgreSQL source.

Flow:

```text
Contoso generator -> source Neon -> Airflow extraction -> Spark
```

This is useful for learning:

- source credentials/connections
- incremental extraction
- JDBC/PostgreSQL ingestion
- source-watermark logic
- schema evolution
- CDC-style patterns

It should be used only for appropriately sized generated datasets.

### Results / serving Neon

Purpose: persist small and queryable outputs such as:

- pipeline runs
- experiment metadata
- ML metrics
- predictions
- model registry metadata
- dbt/BI serving tables

Large raw/bronze data and large model artifacts should not be forced into PostgreSQL.

## V1 boundary

V1 should display:

- the Data Factory node in the macro architecture
- source mode
- future Contoso generator capability
- optional source Neon
- Airflow -> Spark -> Kaggle -> serving/BI lineage
- capability state such as `planned`, `configured`, `available`

V1 should not yet:

- run the C# generator
- provision source Neon automatically
- upload large generated datasets
- trigger Kaggle training
- treat the generator as a requirement for normal VM use

## V2 vertical slice

The first executable journey should be intentionally small:

1. submit a Contoso generation spec;
2. run the generator;
3. validate its manifest and fingerprints;
4. optionally load a source Neon database;
5. start an Airflow DAG;
6. use Spark for Bronze/Silver/feature engineering;
7. create a bounded ML feature package;
8. submit Kaggle/MLJAR;
9. import metrics and predictions;
10. store result metadata in Neon;
11. display run lineage and ML results in ReactOracle;
12. expose a BI-ready serving table.

This becomes ReactOracle's canonical end-to-end case, while the VM remains usable for unrelated Spark/Airflow/dbt/Polars work.
