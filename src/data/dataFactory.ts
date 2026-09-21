export type DataFactoryStageState = "planned" | "live" | "external";

export type DataFactoryStage = {
  id: string;
  name: string;
  engine: string;
  location: string;
  state: DataFactoryStageState;
  detail: string;
};

export const contosoPlan = {
  scenario: "retail.customer_satisfaction",
  generator: "Contoso Forge Lite",
  seed: 20260904,
  scale: {
    orders: 1200,
    customers: 240,
    products: 48,
    stores: 4,
    days: 365,
  },
  ml: {
    profile: "causal-v1",
    positiveOutcomeRate: 0.1,
    signalStrength: 0.5,
    noiseLevel: 0.1,
    target: "customer dissatisfaction",
    primarySignal: "delivery delay",
  },
  output: {
    format: "Parquet",
    destination: "MotherDuck / DuckLake",
    durableZones: ["Raw", "Bronze", "Silver", "Gold", "Features"],
  },
};

export const dataFactoryStages: DataFactoryStage[] = [
  {
    id: "generate",
    name: "Generate",
    engine: ".NET / C#",
    location: "Contoso Forge Lite",
    state: "planned",
    detail: "Deterministic retail source + truth manifest",
  },
  {
    id: "lake-raw",
    name: "Land Raw",
    engine: "Parquet / DuckLake",
    location: "MotherDuck",
    state: "planned",
    detail: "Durable generated source outside the Oracle VM",
  },
  {
    id: "orchestrate",
    name: "Orchestrate",
    engine: "Airflow",
    location: "Oracle K3s",
    state: "live",
    detail: "DAG coordinates ingestion, Spark and external stages",
  },
  {
    id: "process",
    name: "Process",
    engine: "Spark",
    location: "Oracle K3s",
    state: "live",
    detail: "Bronze / Silver / Gold / feature engineering",
  },
  {
    id: "publish",
    name: "Publish Gold",
    engine: "DuckLake",
    location: "MotherDuck",
    state: "planned",
    detail: "Canonical durable analytical tables",
  },
  {
    id: "train",
    name: "Train",
    engine: "MLJAR",
    location: "Kaggle",
    state: "external",
    detail: "Bounded external AutoML experiment",
  },
  {
    id: "serve",
    name: "Serve",
    engine: "SQL / BI",
    location: "Gold + optional Neon",
    state: "planned",
    detail: "Expose Gold tables and compact ML serving metadata",
  },
];
