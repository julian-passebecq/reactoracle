import { Card, Text, Title3 } from "@fluentui/react-components";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { PageHeader } from "../components/PageHeader";
import { runtimeConfig } from "../config";

const dashboardUrl = (uid: string, slug: string) => {
  if (!runtimeConfig.grafanaUrl) return "";
  return runtimeConfig.grafanaUrl.replace(/\/$/, "") + "/d/" + uid + "/" + slug;
};

const dashboards = [
  {
    name: "Oracle VM",
    detail: "CPU, memory, disk, network, uptime and host-level trends",
    status: "Provisioned",
    href: dashboardUrl("reactoracle-vm", "reactoracle-oracle-vm"),
  },
  {
    name: "Kubernetes",
    detail: "Node readiness, pods, namespace CPU/RAM and restart trends",
    status: "Provisioned",
    href: dashboardUrl("reactoracle-k8s", "reactoracle-kubernetes"),
  },
  {
    name: "Kubernetes logs",
    detail: "Loki-backed pod logs with namespace and application filters",
    status: "Provisioned",
    href: dashboardUrl("reactoracle-logs", "reactoracle-kubernetes-logs"),
  },
  {
    name: "Airflow",
    detail: "Scheduler health, DAG runs, task failures and duration",
    status: "Planned",
    href: "",
  },
  {
    name: "FOIL pipeline",
    detail: "Airflow DAG runs, task pods, Polars/DuckDB duration and export health",
    status: "Planned",
    href: "",
  },
  {
    name: "Free tiers",
    detail: "Secondary view for SaaS quotas and external providers",
    status: "Planned",
    href: "",
  },
];

export function MonitoringPage() {
  return <>
    <PageHeader
      title="Monitoring"
      subtitle="React summaries for daily use; Grafana for deep observability"
      actions={<ExternalLinkButton href={runtimeConfig.grafanaUrl} appearance="primary">Open Grafana</ExternalLinkButton>}
    />
    <div className="platformGrid">
      {dashboards.map((dashboard) => (
        <Card key={dashboard.name} className="platformCard">
          <div className="cardTop">
            <Title3>{dashboard.name}</Title3>
            <Text size={200} className={dashboard.status === "Provisioned" ? "monitoringReady" : "muted"}>
              {dashboard.status}
            </Text>
          </div>
          <Text className="muted">{dashboard.detail}</Text>
          <div className="grafanaPlaceholder">
            {dashboard.status === "Provisioned" ? "Grafana dashboard available after monitoring install" : "Adapter not provisioned yet"}
          </div>
          <ExternalLinkButton href={dashboard.href}>Open dashboard</ExternalLinkButton>
        </Card>
      ))}
    </div>
  </>;
}
