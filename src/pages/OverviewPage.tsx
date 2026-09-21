import { Button, Card, CardHeader, Divider, ProgressBar, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useOverview } from "../api/queries";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { WorkloadTable } from "../components/WorkloadTable";

export function OverviewPage() {
  const { data, isLoading } = useOverview();
  if (isLoading || !data) return <div className="loadingState"><Spinner label="Loading Oracle control plane" /></div>;
  const vm = data.vm;
  return <>
    <PageHeader title="Oracle data lab" subtitle={vm.shape + " · " + vm.ocpu + " OCPU · " + vm.memoryGb + " GB RAM · K3s " + vm.k3sVersion} actions={<><StatusBadge status="healthy" /><Text>{vm.name}</Text></>} />
    <section className="metrics">
      <MetricCard label="CPU" value={vm.cpuPercent + "%"} detail="Host utilization" />
      <MetricCard label="Memory" value={vm.memoryUsedGb + " / " + vm.memoryGb + " GB"} detail="Available for jobs" />
      <MetricCard label="Storage" value={vm.diskPercent + "%"} detail="Boot volume" />
      <MetricCard label="Projected OCI bill" value={vm.projectedCost} detail="Free-tier guardrail" />
    </section>
    <section className="gridTwo">
      <Card><CardHeader header={<Title3>Platform health</Title3>} /><div className="serviceList">
        {data.services.map((service) => <div className="serviceRow" key={service.id}><div><Text weight="semibold">{service.name}</Text><div className="muted small">{service.detail}</div></div><StatusBadge status={service.status} /></div>)}
      </div></Card>
      <Card><CardHeader header={<Title3>Capacity</Title3>} />
        <div className="capacityBlock"><div className="capacityLabel"><span>Memory</span><span>{vm.memoryUsedGb} / {vm.memoryGb} GB</span></div><ProgressBar value={vm.memoryUsedGb / vm.memoryGb} /></div>
        <div className="capacityBlock"><div className="capacityLabel"><span>CPU</span><span>{vm.cpuPercent}%</span></div><ProgressBar value={vm.cpuPercent / 100} /></div>
        <div className="capacityBlock"><div className="capacityLabel"><span>Disk</span><span>{vm.diskPercent}%</span></div><ProgressBar value={vm.diskPercent / 100} /></div>
        <Divider /><div className="quickActions"><Button appearance="primary">Open monitoring</Button><Button>View logs</Button><Button>Run health check</Button></div>
      </Card>
    </section>
    <section>
      <div className="sectionHeader"><div><Title3>Kubernetes workloads</Title3><Text className="muted">Daily workload view. Headlamp remains the advanced Kubernetes console.</Text></div><Button>Open Headlamp</Button></div>
      <WorkloadTable workloads={data.workloads} />
    </section>
  </>;
}
