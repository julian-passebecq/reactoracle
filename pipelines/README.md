# FOIL Oracle data pipeline

This package is the first executable data-engineering slice for ReactOracle.

## Responsibility split

- **Airflow on K3s** orchestrates.
- **Polars** performs dataframe validation and transformations.
- **DuckDB** is the SQL engine.
- **MotherDuck hosted DuckLake** is the target analytical lakehouse for Bronze, Silver and Gold.
- **OCI Object Storage** is the planned immutable raw/archive copy.
- **Neon** is reserved for compact serving/index tables, not Bronze/Silver/Gold.
- **MongoDB** remains project/engineering truth and observations, not telemetry storage.
- **Fabric** and **Databricks** remain separate external FOIL labs.

The current source is deliberately synthetic WIND telemetry. It is software/data-pipeline test data, not measured machine performance.

## Local test

~~~bash
cd pipelines
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
pytest
~~~

Local execution can target a DuckDB file:

~~~bash
export FOIL_DUCKDB_TARGET=/tmp/foil_oracle.duckdb
~~~

## MotherDuck

For automation, provide the secret through the environment:

~~~bash
export MOTHERDUCK_TOKEN='...'
export FOIL_DUCKDB_TARGET='md:foil_oracle_lake'
~~~

Do not commit the token.

MotherDuck's hosted DuckLake can be provisioned once with:

~~~sql
CREATE DATABASE foil_oracle_lake (TYPE ducklake);
~~~

After that, the pipeline creates and updates:

~~~text
bronze.wind_telemetry
silver.wind_telemetry
gold.wind_run_summary
~~~

The Airflow DAG is in airflow/dags/foil_wind_medallion.py.

## Evidence boundary

The pipeline enforces classification = SYNTHETIC.

The current WIND baseline carries MACHINE-WIND-001@2026-09-21.2 and the 90-degree inter-foil phase as project context. Numeric power, vibration and yaw-response fields are explicitly synthetic proxies. This pipeline cannot promote those values into measured engineering truth.
