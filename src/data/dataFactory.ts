import type { DataFactoryPlan, DataFactoryStage, SyntheticSourcePlan } from "../domain/types";

export const syntheticSourcePlan: SyntheticSourcePlan = {
  scenario: "foil.wind.synthetic_runtime",
  generator: "FOIL WIND Synthetic Source",
  seed: 20260922,
  optional: false,
  technology: "WIND",
  machineId: "MACHINE-WIND-001",
  machineRevision: "2026-09-21.2",
  classification: "SYNTHETIC",
  modelId: "synthetic-wind-proxy-v1",
  scale: {
    samples: 300,
    samplePeriodSeconds: 1,
    durationSeconds: 300,
  },
  output: {
    format: "Parquet",
    destination: "MotherDuck / DuckLake",
    durableZones: ["Bronze", "Silver", "Gold"],
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
    state: "planned",
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
    engine: "SQL / API",
    location: "External consumers",
    state: "planned",
    detail: "ReactOracle, SQL clients and optional Neon mirror consume compact Gold outputs",
  },
];

export const mlDataFactoryStages: DataFactoryStage[] = [
  {
    id: "features",
    name: "Freeze research input",
    engine: "DuckLake / Parquet",
    location: "MotherDuck",
    state: "planned",
    detail: "Create explicit versioned/frozen dataset for research use",
  },
  {
    id: "train",
    name: "Research / ML",
    engine: "PySpark / MLflow",
    location: "Databricks",
    state: "external",
    detail: "Separate FOIL research lab; never overwrites Core Truth",
  },
  {
    id: "publish-ml",
    name: "Return approved summary",
    engine: "DuckLake",
    location: "MotherDuck",
    state: "planned",
    detail: "Only governed derived outputs return to the Oracle analytical plane",
  },
  {
    id: "serve-ml",
    name: "Mirror compact results",
    engine: "PostgreSQL",
    location: "Optional Neon",
    state: "optional",
    detail: "Compact run/result serving state only",
  },
];

export const dataFactoryPlanMock: DataFactoryPlan = {
  source: syntheticSourcePlan,
  coreStages: coreDataFactoryStages,
  mlStages: mlDataFactoryStages,
  executionEnabled: false,
  businessReactInScope: false,
};
