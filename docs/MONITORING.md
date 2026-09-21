# Monitoring architecture

ReactOracle uses a deliberately small observability stack for the single-node Oracle A1 lab.

## Components

- **kube-prometheus-stack**: Prometheus, Grafana, node-exporter, kube-state-metrics and the Prometheus Operator.
- **Loki**: single-binary mode with local-path persistence and short retention.
- **Grafana Alloy**: DaemonSet log collector forwarding Kubernetes pod logs to Loki.

Alertmanager is disabled initially to save memory. ReactOracle can add notification workflows later when the base telemetry is stable.

## Resource policy

The checked-in values are designed as conservative starting limits, not guaranteed measurements.

| Component group | Target memory |
| --- | ---: |
| Grafana | <= 384 MiB |
| Prometheus | <= 1 GiB |
| Loki | <= 512 MiB |
| Alloy | <= 192 MiB |
| kube-state-metrics + operator + node-exporter | <= 576 MiB combined |

The practical objective is to keep the whole monitoring stack around or below about 2 GiB under normal lab usage, leaving RAM for Airflow and temporary Spark/dbt/Polars jobs.

## Installation

Create a Grafana administrator secret first:

    kubectl apply -f kubernetes/monitoring/namespace.yaml
    kubectl -n monitoring create secret generic reactoracle-grafana-admin \
      --from-literal=admin-user=admin \
      --from-literal=admin-password='<strong-password>'

Then:

    bash kubernetes/monitoring/install.sh

The script installs the current compatible Helm charts from the Prometheus Community and Grafana repositories using the checked-in values.

## Access

Grafana is intentionally configured as ClusterIP. Do not expose port 3000 directly to the public internet.

For initial validation, use a local tunnel:

    kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80

Then open http://localhost:3000.

Production access should go through the authenticated access layer selected for ReactOracle.

## Retention

- Prometheus: 3 days / about 3 GB.
- Loki: 72 hours / 3 GiB PVC.

These values are intentionally short because the Oracle VM is a lab server, not a long-term telemetry archive.

## Grafana integration

ReactOracle keeps the summary cards in React and opens Grafana only for deep investigation.

Planned dashboard groups:

1. Oracle VM
2. Kubernetes
3. Airflow
4. Spark
5. Free-tier/SaaS usage

The frontend supports a Grafana base URL through VITE_GRAFANA_URL.
