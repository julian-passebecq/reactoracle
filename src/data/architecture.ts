export type ArchitectureState = "live" | "external" | "planned" | "optional";

export type ArchitectureNode = {
  id: string;
  name: string;
  layer: "source" | "delivery" | "lakehouse" | "orchestration" | "compute" | "ml" | "serving" | "consumption" | "observability" | "control";
  state: ArchitectureState;
  provider: string;
  role: string;
  durable: boolean;
  location: string;
};

export const architectureNodes: ArchitectureNode[] = [
  {
    id: "contoso",
    name: "Contoso Forge Lite",
    layer: "source",
    state: "planned",
    provider: ".NET / C#",
    role: "Deterministic synthetic retail data + causal ML truth",
    durable: false,
    location: "Ephemeral generator job",
  },
  {
    id: "github",
    name: "GitHub",
    layer: "delivery",
    state: "external",
    provider: "GitHub",
    role: "Source, DAGs, manifests, CI/CD and release artifacts",
    durable: true,
    location: "Managed external",
  },
  {
    id: "motherduck",
    name: "MotherDuck / DuckLake",
    layer: "lakehouse",
    state: "planned",
    provider: "MotherDuck",
    role: "Durable Parquet lakehouse for Raw, Bronze, Silver, Gold and ML features",
    durable: true,
    location: "Managed external",
  },
  {
    id: "airflow",
    name: "Airflow",
    layer: "orchestration",
    state: "live",
    provider: "Apache Airflow",
    role: "Pipeline orchestration and external job coordination",
    durable: false,
    location: "Oracle K3s",
  },
  {
    id: "spark",
    name: "Spark",
    layer: "compute",
    state: "live",
    provider: "Apache Spark",
    role: "Distributed transformations, joins, partitioning and feature engineering",
    durable: false,
    location: "Oracle K3s",
  },
  {
    id: "kafka",
    name: "Managed Kafka",
    layer: "source",
    state: "external",
    provider: "External free tier",
    role: "Streaming source without consuming Oracle VM memory",
    durable: true,
    location: "Managed external",
  },
  {
    id: "kaggle",
    name: "Kaggle + MLJAR",
    layer: "ml",
    state: "planned",
    provider: "Kaggle",
    role: "External bounded ML / AutoML execution",
    durable: false,
    location: "Managed external compute",
  },
  {
    id: "neon",
    name: "Neon",
    layer: "serving",
    state: "optional",
    provider: "Neon Postgres",
    role: "Small serving tables, ML metrics, predictions and platform metadata",
    durable: true,
    location: "Managed external",
  },
  {
    id: "dbt",
    name: "dbt",
    layer: "serving",
    state: "planned",
    provider: "dbt Core",
    role: "Curated analytical marts over Gold / serving data",
    durable: false,
    location: "Ephemeral Oracle K3s job",
  },
  {
    id: "bi",
    name: "BI / SQL consumers",
    layer: "consumption",
    state: "planned",
    provider: "Power BI / SQL",
    role: "Consume published Gold tables; business React applications are intentionally out of scope",
    durable: false,
    location: "External clients",
  },
  {
    id: "grafana",
    name: "Grafana stack",
    layer: "observability",
    state: "live",
    provider: "Grafana / Prometheus / Loki",
    role: "Operational metrics and logs",
    durable: false,
    location: "Oracle K3s",
  },
  {
    id: "reactoracle",
    name: "ReactOracle",
    layer: "control",
    state: "live",
    provider: "React + Fluent UI",
    role: "Control plane, architecture inventory and operational status",
    durable: true,
    location: "Hosted outside Oracle",
  },
];

export const primaryDataFlow = [
  "contoso",
  "motherduck",
  "airflow",
  "spark",
  "motherduck",
  "kaggle",
  "neon",
  "dbt",
  "bi",
];

export const durableDataZones = [
  { name: "Raw", owner: "MotherDuck / DuckLake", purpose: "Generated Parquet and ingested source data" },
  { name: "Bronze", owner: "MotherDuck / DuckLake", purpose: "Durable landed / typed data" },
  { name: "Silver", owner: "MotherDuck / DuckLake", purpose: "Validated and conformed data" },
  { name: "Gold", owner: "MotherDuck / DuckLake", purpose: "Canonical analytical tables served outside the VM" },
  { name: "Features", owner: "MotherDuck / DuckLake", purpose: "ML-ready feature datasets" },
  { name: "ML results", owner: "Neon (small serving state) + lakehouse history", purpose: "Metrics, predictions and model metadata" },
];
