#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="monitoring"

command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required" >&2; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm is required" >&2; exit 1; }

kubectl apply -f "$ROOT_DIR/namespace.yaml"

if ! kubectl -n "$NAMESPACE" get secret reactoracle-grafana-admin >/dev/null 2>&1; then
  echo "Missing secret monitoring/reactoracle-grafana-admin." >&2
  echo "Create it first:" >&2
  echo "  kubectl -n monitoring create secret generic reactoracle-grafana-admin --from-literal=admin-user=admin --from-literal=admin-password='<strong-password>'" >&2
  exit 2
fi

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack   --namespace "$NAMESPACE"   --values "$ROOT_DIR/kube-prometheus-stack-values.yaml"   --wait --timeout 10m

helm upgrade --install loki grafana/loki   --namespace "$NAMESPACE"   --values "$ROOT_DIR/loki-values.yaml"   --wait --timeout 10m

helm upgrade --install alloy grafana/alloy   --namespace "$NAMESPACE"   --values "$ROOT_DIR/alloy-values.yaml"   --wait --timeout 10m

kubectl apply -f "$ROOT_DIR/dashboard-oracle-vm.yaml"
kubectl apply -f "$ROOT_DIR/dashboard-kubernetes.yaml"
kubectl apply -f "$ROOT_DIR/dashboard-logs.yaml"

echo
echo "Monitoring stack installed."
echo "Use kubectl -n monitoring get pods to verify readiness."
echo "Grafana remains ClusterIP-only; expose it through your authenticated access path."
