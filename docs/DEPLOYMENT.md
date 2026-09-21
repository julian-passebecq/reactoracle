# Deployment sequence

ReactOracle is designed so the existing Oracle VM can be adopted incrementally. Do not destroy or recreate the VM just to install ReactOracle.

## 1. Oracle host

Keep the existing Oracle A1 instance.

Install the host prerequisites:

```text
Ubuntu
K3s
Docker (optional for image build/test)
Cockpit (optional host administration)
```

K3s is the persistent workload runtime. Docker is not required by K3s.

## 2. K3s workload namespaces

Recommended logical boundaries:

```text
kube-system
reactoracle-system
monitoring
airflow
spark
jobs
```

The `jobs` namespace is intended for short-lived dbt, Polars and maintenance jobs.

Managed Kafka remains external.

## 3. Control API

Deploy `control-api/` outside the Oracle VM.

Required environment variable:

```text
REACTORACLE_AGENT_TOKEN=<long random secret>
```

Optional:

```text
REACTORACLE_ALLOWED_ORIGINS=https://your-react-frontend.example.com
```

The raw Control API should not be exposed as an unauthenticated public administration endpoint. Put the user-facing surface behind the chosen access/authentication layer.

## 4. Oracle agent

Download the `reactoracle-agent-linux-arm64` artifact produced by CI, or build it manually.

On the VM:

```bash
tar/unzip the artifact as appropriate
sudo ./install.sh
sudo ./configure-kube-access.sh
sudo nano /etc/reactoracle/agent.env
sudo systemctl start reactoracle-agent
sudo systemctl status reactoracle-agent
```

The agent configuration needs the same secret as the Control API:

```text
REACTORACLE_CONTROL_API_URL=https://your-control-api.example.com
REACTORACLE_AGENT_TOKEN=<same secret>
REACTORACLE_INTERVAL_SECONDS=30
```

The agent is outbound-only. No new public VM administration port is required.

## 5. Frontend

Host the Vite build outside Oracle.

Set:

```text
VITE_CONTROL_API_BASE_URL=https://your-control-api.example.com
VITE_GRAFANA_URL=https://...
VITE_HEADLAMP_URL=https://...
VITE_AIRFLOW_URL=https://...
VITE_SPARK_HISTORY_URL=https://...
```

If `VITE_CONTROL_API_BASE_URL` is empty, ReactOracle intentionally falls back to mock mode.

## 6. Monitoring

The target monitoring stack on K3s is:

```text
Prometheus -> metrics
Loki       -> logs
Grafana    -> deep dashboards
```

ReactOracle owns the concise operational summaries and navigation. Grafana remains the deep observability surface.

## 7. Data workloads

Persistent:

- Airflow
- Spark History Server
- monitoring components

On demand:

- Spark applications
- dbt
- Polars

External:

- Kafka
- FastAPI application workloads
- MotherDuck / Neon when used

## 8. OpenTofu

OpenTofu should be edited in VS Code and executed through CI.

Do not install a permanent Terraform/OpenTofu service on the Oracle VM.

The existing Oracle VM should be imported/adopted later rather than destroyed and recreated.

## First live acceptance checks

The first live connection is successful when:

1. `GET /api/v1/health` returns OK.
2. the Oracle agent appears connected in ReactOracle.
3. VM shape/OCPU/RAM come from OCI metadata.
4. CPU/RAM/disk/uptime change from mock values.
5. K3s namespaces and workloads match the actual VM.
6. the dedicated agent kubeconfig can list pods.
7. the dedicated agent kubeconfig cannot delete pods.
8. no new inbound Oracle management port has been opened.
