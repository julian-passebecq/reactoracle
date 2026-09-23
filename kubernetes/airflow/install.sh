#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${AIRFLOW_NAMESPACE:-airflow}"
RELEASE="${AIRFLOW_RELEASE:-airflow}"
CHART_VERSION="${AIRFLOW_CHART_VERSION:-1.22.0}"
VALUES_FILE="${AIRFLOW_VALUES_FILE:-$(dirname "$0")/values.yaml}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required" >&2
  exit 1
fi
if ! command -v helm >/dev/null 2>&1; then
  echo "helm is required" >&2
  exit 1
fi
if [[ -z "${MOTHERDUCK_TOKEN:-}" ]]; then
  echo "MOTHERDUCK_TOKEN is required and is never read from the repository." >&2
  exit 1
fi

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" create secret generic reactoracle-data-secrets \
  --from-literal=motherduck-token="$MOTHERDUCK_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

helm repo add apache-airflow https://airflow.apache.org >/dev/null 2>&1 || true
helm repo update apache-airflow

helm upgrade --install "$RELEASE" apache-airflow/airflow \
  --namespace "$NAMESPACE" \
  --version "$CHART_VERSION" \
  --values "$VALUES_FILE" \
  --wait \
  --timeout 10m

echo "Airflow installed in namespace $NAMESPACE."
echo "Runtime verification:"
echo "  kubectl -n $NAMESPACE get pods"
echo "  kubectl -n $NAMESPACE port-forward svc/${RELEASE}-api-server 8080:8080"
