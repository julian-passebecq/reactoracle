import { Card, Switch, Text, Title3 } from "@fluentui/react-components";
import { PageHeader } from "../components/PageHeader";

export function SettingsPage() {
  return <><PageHeader title="Settings" subtitle="Control-plane policy and integration configuration" /><section className="gridTwo"><Card><Title3>Safety policy</Title3><div className="settingRow"><div><Text weight="semibold">Read-only mode</Text><div className="muted small">Keep mutating operations disabled during bootstrap.</div></div><Switch checked readOnly /></div><div className="settingRow"><div><Text weight="semibold">Typed confirmation</Text><div className="muted small">Required for destructive actions.</div></div><Switch checked readOnly /></div></Card><Card><Title3>Planned integrations</Title3><Text className="muted">Oracle agent, Grafana, GitHub Actions/OpenTofu, Headlamp, Airflow, Spark History Server and external free-tier providers.</Text></Card></section></>;
}
