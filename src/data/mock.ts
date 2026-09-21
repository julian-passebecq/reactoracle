export type Health = "healthy" | "idle" | "warning" | "offline";

export const vm = {
  name: "oracle-a1-01",
  shape: "VM.Standard.A1.Flex",
  ocpu: 2,
  memoryGb: 12,
  cpuPercent: 23,
  memoryUsedGb: 5.9,
  diskPercent: 31,
  uptime: "16d 04h",
  projectedCost: "$0",
};

export const services: Array<{ name: string; status: Health; detail: string }> = [
  { name: "K3s", status: "healthy", detail: "14 / 14 pods" },
  { name: "Airflow", status: "healthy", detail: "scheduler healthy" },
  { name: "Spark", status: "idle", detail: "no active application" },
  { name: "Grafana", status: "healthy", detail: "dashboards available" },
  { name: "Prometheus", status: "healthy", detail: "metrics scraping" },
  { name: "Loki", status: "healthy", detail: "logs ingesting" },
  { name: "Kafka", status: "healthy", detail: "Aiven / external" },
];

export const workloads = [
  ["airflow-api", "airflow", "Deployment", "Running", "320 MB"],
  ["airflow-scheduler", "airflow", "Deployment", "Running", "510 MB"],
  ["postgres", "airflow", "StatefulSet", "Running", "420 MB"],
  ["spark-history", "spark", "Deployment", "Running", "280 MB"],
  ["grafana", "monitoring", "Deployment", "Running", "230 MB"],
  ["prometheus", "monitoring", "StatefulSet", "Running", "680 MB"],
  ["loki", "monitoring", "StatefulSet", "Running", "390 MB"],
];
