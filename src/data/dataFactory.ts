import type { ContosoGenerationPlan, DataFactoryPlan, DataFactoryStage } from "../domain/types";

export const contosoPlan: ContosoGenerationPlan = {
  scenario: "foil.wind.synthetic_runtime",
  generator: "FOIL WIND Synthetic Source",
  seed: 20260904,
  optional: true,
  scale: {
    orders: 300,
    customers: 1,
    products: 1,
    stores: 1,
    days: 1,
  },
  ml: {
    profile: "synthetic-wind-proxy-v1",
    positiveOutcomeRate: 0.1,
    signalStrength: 0.5,
    noiseLevel: 0.1,
    target: "runtime quality and scenario summaries",
    primarySignal: "wind speed + yaw alignment proxies",
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
    name: "Generate WIND telemetry",
    engine: "Python / Polars",
    location: "Airflow task pod",
    state: "planned",
    detail: "Deterministic SYNTHETIC telemetry + provenance manifest for MACHINE-WIND-001",
  },
  {
    id: "lake-raw",
    name: "Archive Raw",
    engine: "Parquet",
    location: "OCI Object Storage",
    state: "planned",
    detail: "Immutable raw/recovery copy; separate from analytical medallion tables",
  },
  {
    id: "orchestrate",
    name: "Orchestrate",
    engine: "Airflow",
    location: "Oracle K3s",
    state: "live",
    detail: "DAG coordinates generation, Polars validation, DuckDB SQL and publication",
  },
  {
    id: "process",
    name: "Process",
    engine: "Polars + DuckDB",
    location: "Oracle K3s task pods",
    state: "planned",
    detail: "Validate and transform SYNTHETIC telemetry; publish Bronze / Silver / Gold",
  },
  {
    id: "publish",
    name: "Publish Gold",
    engine: "DuckLake",
    location: "MotherDuck",
    state: "planned",
    detail: "Canonical durable analytical tables in MotherDuck hosted DuckLake",
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


export const dataFactoryPlanMock: DataFactoryPlan = {
  contoso: contosoPlan,
  coreStages: coreDataFactoryStages,
  mlStages: mlDataFactoryStages,
  executionEnabled: false,
  businessReactInScope: false,
};
