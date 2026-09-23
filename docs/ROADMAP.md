# Roadmap

## V0.1-V0.3 control plane — implemented in source

- React + TypeScript + Fluent UI
- FastAPI Control API
- outbound Go/ARM64 Oracle agent
- OCI/K3s host telemetry
- bounded Kubernetes logs
- guarded workload restart
- Grafana/Prometheus/Loki observability configuration

Runtime/provider verification remains separate from source implementation.

## V0.4 infrastructure as code — partial

Implemented in source:
- OpenTofu repository/discovery structure
- CI-oriented security boundary

Next:
- OCI validate/plan workflow
- immutable plan artifact
- approval-gated apply
- drift/resource inventory

## V0.5 FOIL Oracle data engineering — implementation in progress

Implemented in source:
- synthetic WIND telemetry contract with provenance
- Polars transformations and quality checks
- DuckDB Bronze/Silver/Gold pipeline
- MotherDuck connection target
- Airflow `foil_wind_medallion` DAG
- K3s Airflow Helm profile using KubernetesExecutor
- Wind-specific Gold catalog
- Neon restricted to compact serving role
- Fabric and Databricks modeled as separate external labs

Next runtime gates:
1. publish task image;
2. deploy Airflow to Oracle K3s;
3. verify MotherDuck/DuckLake;
4. execute the WIND DAG end to end;
5. wire OCI Object Storage raw archive;
6. add Neon serving mirror;
7. expose verified run state in ReactOracle.

## V0.6 Kubernetes / observability quality

Next:
- Polaris cluster/workload audit;
- Airflow/FOIL pipeline Prometheus metrics;
- Grafana pipeline-health dashboard;
- resource tuning from measured VM usage.

## V0.7 live FOIL telemetry

After a real telemetry contract is available:
- ingest timestamped Oracle weather/sensor/model telemetry;
- preserve provenance and classification;
- keep measured and synthetic datasets explicitly separated;
- never promote model output into Core Truth automatically.

## Engineering quality

Current gates include:
- TypeScript build and npm audit
- FastAPI tests
- Go fmt/vet/tests/race detector
- ARM64 agent artifact
- pipeline package tests
- Kubernetes/monitoring YAML checks
- shell syntax validation
