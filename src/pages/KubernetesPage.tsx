import { Button, Card, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useOverview, useWorkloads } from "../api/queries";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { WorkloadTable } from "../components/WorkloadTable";
import { runtimeConfig } from "../config";

export function KubernetesPage() {
  const overview = useOverview();
  const workloads = useWorkloads();
  if (!overview.data || !workloads.data) return <div className="loadingState"><Spinner label="Loading Kubernetes" /></div>;
  const namespaces = overview.data.namespaces;
  const podTotal = namespaces.reduce((sum, item) => sum + item.podsTotal, 0);
  const podReady = namespaces.reduce((sum, item) => sum + item.podsReady, 0);
  return <>
    <PageHeader title="Kubernetes" subtitle="Single-node K3s operations" actions={<ExternalLinkButton href={runtimeConfig.headlampUrl}>Open Headlamp</ExternalLinkButton>} />
    <section className="metrics">
      <MetricCard label="Node" value="Ready" detail={overview.data.vm.name} />
      <MetricCard label="Pods" value={podReady + " / " + podTotal} detail="Ready / total" />
      <MetricCard label="Namespaces" value={String(namespaces.length)} detail="Managed workload groups" />
      <MetricCard label="Restarts" value={String(workloads.data.reduce((sum, item) => sum + item.restarts, 0))} detail="Current workloads" />
    </section>
    <section><div className="sectionHeader"><div><Title3>Namespaces</Title3><Text className="muted">Resource usage by logical workload boundary.</Text></div></div><div className="namespaceGrid">{namespaces.map((item) => <Card key={item.name}><Text weight="semibold">{item.name}</Text><div className="namespaceMetric">{item.podsReady}/{item.podsTotal} pods</div><div className="muted small">{item.cpuMillicores}m CPU · {item.memoryMb} MB RAM</div></Card>)}</div></section>
    <section className="sectionGap"><div className="sectionHeader"><div><Title3>Workloads</Title3><Text className="muted">Restart is now available for Deployments, StatefulSets and DaemonSets through an explicit moderate-risk confirmation. Jobs remain non-restartable.</Text></div></div><WorkloadTable workloads={workloads.data} machineId={overview.data.vm.id} allowRestart /></section>
  </>;
}
