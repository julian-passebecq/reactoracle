/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTROL_API_BASE_URL?: string;
  readonly VITE_GRAFANA_URL?: string;
  readonly VITE_HEADLAMP_URL?: string;
  readonly VITE_AIRFLOW_URL?: string;
  readonly VITE_SPARK_HISTORY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
