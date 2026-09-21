# Oracle Ops Agent

The Oracle Ops Agent is a small Go binary that runs as a systemd service on the Oracle VM and makes outbound authenticated requests to the external Control API.

## Current read-only capabilities

- OCI IMDSv2 instance metadata when available
- hostname and provisioned shape
- OCPU and RAM
- sampled host CPU usage
- host memory usage
- root filesystem usage
- uptime
- K3s version
- Kubernetes workloads through read-only `kubectl get`
- namespace/pod readiness
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
sudo nano /etc/reactoracle/agent.env
sudo systemctl start reactoracle-agent
sudo systemctl status reactoracle-agent
```

## Kubernetes permissions

The current implementation calls local `kubectl get` commands. Before production use, replace the default/root kubeconfig path with a dedicated least-privilege service account and kubeconfig that can only read the resource kinds ReactOracle requires.

## Security boundary

- outbound only
- bearer token required
- no generic command endpoint
- no OCI credentials stored by the agent
- OpenTofu credentials remain in CI
- mutating operations are intentionally not implemented yet
