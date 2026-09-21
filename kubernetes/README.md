# K3s system configuration

This directory contains cluster-level resources required by ReactOracle itself.

## Agent RBAC

`reactoracle-agent-rbac.yaml` creates a dedicated service account that can only read:

- nodes
- namespaces
- pods
- deployments
- stateful sets
- daemon sets
- jobs

It cannot create, update, patch or delete workloads.

On the Oracle VM:

```bash
sudo ./agent/configure-kube-access.sh
```

The script writes `/etc/reactoracle/agent.kubeconfig`, which the systemd agent service uses instead of the K3s administrator kubeconfig.

The final `auth can-i delete pods` check should print `no`.
