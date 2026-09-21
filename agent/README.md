# Oracle Ops Agent

The Oracle Ops Agent is a small Go binary that runs as a systemd service on the Oracle VM and makes outbound authenticated requests to the external Control API.

## Current read-only capabilities

- OCI IMDSv2 instance metadata when available
- hostname and provisioned shape
- OCPU and RAM
- sampled host CPU usage
- host memory and swap usage
- 1-minute system load
- root filesystem used/total capacity
- host network RX/TX throughput
- uptime
- K3s version
- Kubernetes workloads through read-only `kubectl get`
- namespace/pod readiness
- pod CPU/RAM from the Kubernetes metrics API when available, aggregated to namespaces and matching workloads
- OS/kernel/reboot-required state

The agent sends:

- `POST /api/v1/agent/heartbeat`
- `POST /api/v1/agent/snapshot`

It does **not** expose a server port and does **not** accept arbitrary shell commands.

## Build for the Oracle Ampere VM

```bash
cd agent
GOOS=linux GOARCH=arm64 go build -o reactoracle-agent ./cmd/reactoracle-agent
```

## Install

Copy the binary plus `reactoracle-agent.service`, `agent.env.example` and `install.sh` to the VM.

```bash
sudo ./install.sh
sudo ./configure-kube-access.sh
sudo nano /etc/reactoracle/agent.env
sudo systemctl start reactoracle-agent
sudo systemctl status reactoracle-agent
```

## Kubernetes permissions

The current implementation calls local `kubectl get` commands using `/etc/reactoracle/agent.kubeconfig`. `configure-kube-access.sh` creates a dedicated service account with get/list/watch access only to nodes, namespaces, pods, Deployments, StatefulSets, DaemonSets and Jobs.

## Security boundary

- outbound only
- bearer token required
- no generic command endpoint
- no OCI credentials stored by the agent
- OpenTofu credentials remain in CI
- mutating operations are intentionally not implemented yet


## Safe read commands

The command channel is allow-listed. It currently supports:

- `vm.health_check`
- `k8s.logs`

`k8s.logs` is not a shell proxy. The control API and the agent both validate the namespace, workload kind, workload name and tail length. The agent then executes a fixed `kubectl logs` invocation with a maximum 500-line tail and truncates oversized responses to 256 KiB.

The dedicated Kubernetes service account has `get` permission on `pods/log` but still has no create/update/patch/delete permissions.
