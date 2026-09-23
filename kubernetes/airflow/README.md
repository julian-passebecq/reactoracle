# Airflow on Oracle K3s

This directory defines the intended Airflow deployment for the ReactOracle / FOIL Oracle lab.

## Scope

- Airflow 3.3.2
- official Apache Airflow Helm chart 1.22.x
- KubernetesExecutor
- one task pod per Airflow task
- small in-cluster PostgreSQL metadata database
- no Redis
- no Spark
- Polars + DuckDB task image
- MotherDuck token injected from a Kubernetes Secret
- DAGs synchronized read-only from GitHub

This is a lab profile for a small Oracle VM. It is not presented as a production HA Airflow cluster.

## Why KubernetesExecutor

KubernetesExecutor gives K3s a real responsibility: each Airflow task is isolated in an ephemeral Kubernetes pod. The Airflow metadata database must be non-SQLite.

## Build the task image

The values file expects:

    ghcr.io/julian-passebecq/reactoracle-airflow:0.1.0

Build from the pipeline context:

    docker build -t ghcr.io/julian-passebecq/reactoracle-airflow:0.1.0 pipelines/

The image contains the FOIL pipeline package. Publishing to GHCR is a separate release action; source presence does not imply that the image exists remotely.

## Install

On the Oracle/K3s host, after Helm and kubectl are configured:

    export MOTHERDUCK_TOKEN='...'
    bash kubernetes/airflow/install.sh

The installer creates the namespace and the MotherDuck secret without committing credentials.

## Verify

    kubectl -n airflow get pods
    kubectl -n airflow get jobs
    kubectl -n airflow port-forward svc/airflow-api-server 8080:8080

Then inspect the `foil_wind_medallion` DAG.

## Evidence boundary

The current DAG handles SYNTHETIC Wind telemetry only. It does not ingest measured turbine data and it cannot promote proxy power, vibration or yaw-response values into engineering truth.
