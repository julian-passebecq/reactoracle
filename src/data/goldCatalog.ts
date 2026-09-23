import type { GoldTableContract } from "../domain/types";

export const goldTableCatalog: GoldTableContract[] = [
  {
    name: "gold.wind_run_summary",
    grain: "simulation run",
    purpose: "Validated synthetic runtime summary with provenance and quality state",
    consumers: ["ReactOracle", "SQL", "Neon serving mirror"],
    storage: "MotherDuck / DuckLake",
    mlDerived: false,
    status: "planned",
  },
  {
    name: "gold.wind_scenario_comparison",
    grain: "scenario × machine revision",
    purpose: "Compare governed synthetic WIND scenarios without promoting proxies to measured performance",
    consumers: ["SQL", "notebooks", "Databricks frozen export"],
    storage: "MotherDuck / DuckLake",
    mlDerived: false,
    status: "planned",
  },
  {
    name: "gold.wind_quality_summary",
    grain: "run × quality rule",
    purpose: "Pipeline validation, anomaly counts and evidence-boundary checks",
    consumers: ["ReactOracle", "Grafana", "SQL"],
    storage: "MotherDuck / DuckLake",
    mlDerived: false,
    status: "planned",
  },
];
