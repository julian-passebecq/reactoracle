import { Card, Switch, Text, Title3 } from "@fluentui/react-components";
import { PageHeader } from "../components/PageHeader";
import { runtimeConfig } from "../config";

const displayUrl = (value: string) => value || "Not configured";

export function SettingsPage() {
  return <>
    <PageHeader title="Settings" subtitle="Control-plane policy and integration configuration" />
    <section className="gridTwo">
      <Card><Title3>Safety policy</Title3>
        <div className="settingRow"><div><Text weight="semibold">Read-only bootstrap</Text><div className="muted small">Mutating operations stay disabled until the audited command pipeline exists.</div></div><Switch checked disabled /></div>
        <div className="settingRow"><div><Text weight="semibold">Typed confirmation</Text><div className="muted small">Required for destructive actions.</div></div><Switch checked disabled /></div>
      </Card>
      <Card><Title3>Runtime</Title3><dl className="detailsList">
        <div><dt>Mode</dt><dd>{runtimeConfig.mode}</dd></div>
        <div><dt>Control API</dt><dd>{displayUrl(runtimeConfig.controlApiBaseUrl)}</dd></div>
        <div><dt>Grafana</dt><dd>{displayUrl(runtimeConfig.grafanaUrl)}</dd></div>
        <div><dt>Headlamp</dt><dd>{displayUrl(runtimeConfig.headlampUrl)}</dd></div>
        <div><dt>Airflow</dt><dd>{displayUrl(runtimeConfig.airflowUrl)}</dd></div>
        <div><dt>Spark history</dt><dd>{displayUrl(runtimeConfig.sparkHistoryUrl)}</dd></div>
      </dl></Card>
    </section>
  </>;
}
