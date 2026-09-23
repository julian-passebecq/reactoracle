const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const controlApiBaseUrl = trimTrailingSlash(import.meta.env.VITE_CONTROL_API_BASE_URL ?? "");

export const runtimeConfig = {
  mode: controlApiBaseUrl ? "live" : "mock",
  controlApiBaseUrl,
  grafanaUrl: import.meta.env.VITE_GRAFANA_URL ?? "",
  headlampUrl: import.meta.env.VITE_HEADLAMP_URL ?? "",
  airflowUrl: import.meta.env.VITE_AIRFLOW_URL ?? "",
} as const;
