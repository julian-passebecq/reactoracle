# Monitoring architecture

ReactOracle uses a deliberately small observability stack for the single-node Oracle A1 lab.

## Components

- kube-prometheus-stack: Prometheus, Grafana, node-exporter, kube-state-metrics and Prometheus Operator
- Loki: short-retention Kubernetes/runtime logs
- Grafana Alloy: pod-log collection to Loki
- Airflow metrics: scheduler/task health when the Airflow deployment is live

Alertmanager remains disabled initially to conserve resources.

## Resource policy

Checked-in resource limits are starting bounds, not measured production requirements.

| Component group | Initial memory bound |
| --- | ---: |
| Grafana | <= 384 MiB |
| Prometheus | <= 1 GiB |
| Loki | <= 512 MiB |
| Alloy | <= 192 MiB |
| kube-state-metrics + operator + node-exporter | <= 576 MiB combined |

Airflow and ephemeral Polars/DuckDB task pods share the same small VM, so runtime tuning must be based on observed usage rather than assumed capacity.

## Access

Grafana is ClusterIP-only by default.

```bash
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
```

Use an authenticated access layer before exposing it remotely.

## Retention

- Prometheus: short lab retention
- Loki: short lab retention
- long-term analytical data does not belong in either system

## Dashboard groups

1. Oracle VM
2. Kubernetes / K3s
3. Airflow
4. FOIL pipeline health
5. external provider synchronization where a verified adapter exists

Useful pipeline metrics to add:

```text
foil_pipeline_runs_total
foil_pipeline_failures_total
foil_pipeline_duration_seconds
foil_last_success_timestamp
foil_archive_success_total
foil_motherduck_publish_success_total
```

Grafana is observability only. It does not become machine truth, analytical storage or the infrastructure control plane.
