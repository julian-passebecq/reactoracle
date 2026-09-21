import { Button, Card, Text, Title3 } from "@fluentui/react-components";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { PageHeader } from "../components/PageHeader";
import { runtimeConfig } from "../config";

const dashboards = [
  ["Oracle VM", "CPU, memory, disk, network, uptime and free-tier guardrails"],
  ["Kubernetes", "Node, namespace, pod and workload resource usage"],
  ["Airflow", "Scheduler health, DAG runs, task failures and duration"],
  ["Spark", "Applications, executors, memory, stages and shuffle"],
  ["Free tiers", "Secondary view for SaaS quotas and external providers"],
];

export function MonitoringPage() {
  return <>
    <PageHeader title="Monitoring" subtitle="React summaries for daily use; Grafana for deep observability" actions={<ExternalLinkButton href={runtimeConfig.grafanaUrl} appearance="primary">Open Grafana</ExternalLinkButton>} />
    <div className="platformGrid">{dashboards.map(([name,detail]) => <Card key={name} className="platformCard"><Title3>{name}</Title3><Text className="muted">{detail}</Text><div className="grafanaPlaceholder">Grafana dashboard adapter</div><Button>Open dashboard</Button></Card>)}</div>
  </>;
}
