# K3s system configuration

This directory contains cluster-level resources required by ReactOracle itself.

## Agent RBAC

`reactoracle-agent-rbac.yaml` creates a dedicated service account that can only read:

- nodes
- namespaces
- pods
- pod logs (`pods/log`, get only)
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


Log access remains read-only. The agent can retrieve bounded pod logs for a selected workload, but it cannot exec into pods or mutate workloads.


## Optional restart capability

The base agent RBAC remains read-only.

To enable the moderate-risk `k8s.restart_workload` command, two independent switches are required:

1. set `REACTORACLE_ENABLE_MUTATIONS=true` on the Control API;
2. apply the narrow restart RBAC overlay:

```bash
kubectl apply -f kubernetes/system/reactoracle-agent-restart-rbac.yaml
```

The overlay grants only `get` and `patch` on Deployments, StatefulSets and DaemonSets. It does not grant pod delete, exec, secret access, Job mutation or arbitrary shell execution.

Disable restarts again by removing the overlay and unsetting the Control API flag:

```bash
kubectl delete -f kubernetes/system/reactoracle-agent-restart-rbac.yaml
```
