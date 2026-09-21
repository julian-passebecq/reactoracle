export type DataFactoryStageState = "planned" | "live" | "external" | "optional";

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
  optional: true,
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
    optional: true,
  },
  output: {
    format: "Parquet",
    destination: "MotherDuck / DuckLake",
    durableZones: ["Raw", "Bronze", "Silver", "Gold", "Features"],
  },
};

export const coreDataFactoryStages: DataFactoryStage[] = [
  {
    id: "generate",
    name: "Generate",
    engine: ".NET / C#",
    location: "Contoso Forge Lite",
    state: "planned",
    detail: "Optional deterministic retail source + truth manifest",
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
    detail: "DAG coordinates ingestion and Spark stages",
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
    id: "consume",
    name: "Serve Gold",
    engine: "SQL / BI",
    location: "External consumers",
    state: "planned",
    detail: "Power BI, SQL clients, notebooks and APIs consume Gold",
  },
];

export const mlDataFactoryStages: DataFactoryStage[] = [
  {
    id: "features",
    name: "Read Features",
    engine: "DuckLake",
    location: "MotherDuck",
    state: "planned",
    detail: "Governed ML feature dataset derived from durable analytical data",
  },
  {
    id: "train",
    name: "Train",
    engine: "MLJAR",
    location: "Kaggle",
    state: "planned",
    detail: "Optional bounded external AutoML experiment",
  },
  {
    id: "publish-ml",
    name: "Publish ML results",
    engine: "DuckLake",
    location: "MotherDuck",
    state: "planned",
    detail: "Historical predictions and analytical results return to durable storage",
  },
  {
    id: "serve-ml",
    name: "Mirror latest state",
    engine: "PostgreSQL",
    location: "Optional Neon",
    state: "optional",
    detail: "Compact latest predictions / metrics only when a serving use case needs them",
  },
];
