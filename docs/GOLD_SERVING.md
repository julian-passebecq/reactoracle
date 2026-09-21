# Gold serving contract

ReactOracle's business-data responsibility ends at **Gold**.

It does not implement business-specific React dashboards. The control plane may display platform metadata, lineage, row counts, freshness and ML run summaries, but business visualization belongs to downstream consumers.

## Canonical location

Gold tables should persist outside the Oracle VM in MotherDuck / DuckLake.

```text
Oracle VM / K3s
  Airflow
  Spark
      |
      | publish validated data
      v
MotherDuck / DuckLake
  gold.*
```

The VM can be stopped or rebuilt without losing Gold.

## Consumers

Supported architectural consumers are:

- Power BI
- SQL clients
- notebooks
- read-only APIs
- later application-specific consumers outside this repository

## Table expectations

A Gold table should have:

- stable name
- documented grain
- primary/business key where applicable
- refresh timestamp
- source run / dataset fingerprint
- schema version
- quality status
- lineage back to Silver inputs

Example catalog:

```text
gold.sales_daily
gold.customer_360
gold.product_performance
gold.delivery_performance
gold.customer_satisfaction
gold.customer_scores
```

ML feature datasets belong in a separate `features.*` namespace even when derived from Gold.

## Neon

Neon is optional for compact serving state and metadata, not the canonical Gold warehouse.

Use Neon for things such as:

- latest customer score
- experiment/run metadata
- ML metrics
- model registry metadata
- ReactOracle operational state

Keep historical analytical facts in the lakehouse unless a specific PostgreSQL exercise requires otherwise.
