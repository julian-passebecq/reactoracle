#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUBECONFIG_OUT=/etc/reactoracle/agent.kubeconfig
CA_OUT=/etc/reactoracle/agent-ca.crt

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

KUBECTL=kubectl
if ! command -v kubectl >/dev/null 2>&1; then
  KUBECTL="k3s kubectl"
fi

$KUBECTL apply -f "$ROOT/kubernetes/system/reactoracle-agent-rbac.yaml"

for _ in $(seq 1 30); do
  token_b64="$($KUBECTL -n reactoracle-system get secret reactoracle-agent-token -o jsonpath='{.data.token}' 2>/dev/null || true)"
  ca_b64="$($KUBECTL -n reactoracle-system get secret reactoracle-agent-token -o jsonpath='{.data.ca\.crt}' 2>/dev/null || true)"
  if [[ -n "$token_b64" && -n "$ca_b64" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "${token_b64:-}" || -z "${ca_b64:-}" ]]; then
  echo "Service account token secret was not populated." >&2
  exit 1
fi

server="$($KUBECTL config view --raw -o jsonpath='{.clusters[0].cluster.server}')"
token="$(printf '%s' "$token_b64" | base64 -d)"
printf '%s' "$ca_b64" | base64 -d > "$CA_OUT"

$KUBECTL config --kubeconfig="$KUBECONFIG_OUT" set-cluster reactoracle-k3s \
  --server="$server" \
  --certificate-authority="$CA_OUT" \
  --embed-certs=true >/dev/null
$KUBECTL config --kubeconfig="$KUBECONFIG_OUT" set-credentials reactoracle-agent \
  --token="$token" >/dev/null
$KUBECTL config --kubeconfig="$KUBECONFIG_OUT" set-context reactoracle \
  --cluster=reactoracle-k3s \
  --user=reactoracle-agent >/dev/null
$KUBECTL config --kubeconfig="$KUBECONFIG_OUT" use-context reactoracle >/dev/null

chmod 0600 "$KUBECONFIG_OUT" "$CA_OUT"

echo "Wrote least-privilege kubeconfig to $KUBECONFIG_OUT"
$KUBECTL --kubeconfig="$KUBECONFIG_OUT" auth can-i list pods --all-namespaces
$KUBECTL --kubeconfig="$KUBECONFIG_OUT" auth can-i delete pods --all-namespaces
