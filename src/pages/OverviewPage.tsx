import { Button, Card, CardHeader, Divider, ProgressBar, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useAgentStatus, useOverview } from "../api/queries";
import { Link } from "react-router-dom";
import { DataError } from "../components/DataError";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { HealthCheckControl } from "../components/HealthCheckControl";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { WorkloadTable } from "../components/WorkloadTable";
import { runtimeConfig } from "../config";
import { derivePlatformHealth, healthIssues } from "../domain/health";

export function OverviewPage() {
  const overviewQuery = useOverview();
  const agentQuery = useAgentStatus();
  if (overviewQuery.isLoading) return <div className="loadingState"><Spinner label="Loading Oracle control plane" /></div>;
  if (overviewQuery.isError || !overviewQuery.data) return <DataError error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />;
  const data = overviewQuery.data;
  const vm = data.vm;
  const agentLabel = runtimeConfig.mode === "mock" ? "Mock data" : agentQuery.data?.connected ? "Agent connected" : "Agent offline";
  const agentDetail = runtimeConfig.mode === "mock" ? "Set VITE_CONTROL_API_BASE_URL for live mode" : agentQuery.data?.lastSnapshotAt ?? "No snapshot received";
  const platformHealth = derivePlatformHealth(data, agentQuery.data?.connected, runtimeConfig.mode);
  const issues = healthIssues(data);
  return <>
    <PageHeader title="Oracle data lab" subtitle={vm.shape + " · " + vm.ocpu + " OCPU · " + vm.memoryGb + " GB RAM · K3s " + vm.k3sVersion} actions={<><StatusBadge status={platformHealth} /><Text>{vm.name}</Text></>} />
    <section className="metrics">
      <MetricCard label="CPU" value={vm.cpuPercent + "%"} detail="Host utilization" />
      <MetricCard label="Memory" value={vm.memoryUsedGb + " / " + vm.memoryGb + " GB"} detail="Available for jobs" />
      <MetricCard label="Storage" value={vm.diskPercent + "%"} detail={vm.diskUsedGb + " / " + vm.diskTotalGb + " GB"} />
      <MetricCard label="Network" value={vm.networkRxMbps + " ↓ / " + vm.networkTxMbps + " ↑"} detail="Mbps RX / TX" />
      <MetricCard label="Load" value={String(vm.load1)} detail={"1-minute load · " + vm.ocpu + " OCPU"} />
      <MetricCard label="Swap" value={vm.swapUsedGb + " GB"} detail="Used swap" />
      <MetricCard label="OCI billing" value={vm.projectedCost} detail="Usage/billing adapter not connected" />
      <MetricCard label="Oracle agent" value={agentLabel} detail={agentDetail} />
    </section>
    {issues.length > 0 ? <div className="healthNotice"><Text weight="semibold">Attention</Text><Text>{issues.join(" · ")}</Text></div> : null}
    <section className="gridTwo">
      <Card><CardHeader header={<Title3>Platform health</Title3>} /><div className="serviceList">
        {data.services.map((service) => <div className="serviceRow" key={service.id}><div><Text weight="semibold">{service.name}</Text><div className="muted small">{service.detail}</div></div><StatusBadge status={service.status} /></div>)}
      </div></Card>
      <Card><CardHeader header={<Title3>Capacity</Title3>} />
        <div className="capacityBlock"><div className="capacityLabel"><span>Memory</span><span>{vm.memoryUsedGb} / {vm.memoryGb} GB</span></div><ProgressBar value={vm.memoryUsedGb / vm.memoryGb} /></div>
        <div className="capacityBlock"><div className="capacityLabel"><span>CPU</span><span>{vm.cpuPercent}%</span></div><ProgressBar value={vm.cpuPercent / 100} /></div>
        <div className="capacityBlock"><div className="capacityLabel"><span>Disk</span><span>{vm.diskPercent}%</span></div><ProgressBar value={vm.diskPercent / 100} /></div>
        <Divider /><div className="quickActions"><Link to="/monitoring"><Button appearance="primary">Open monitoring</Button></Link><Link to="/logs"><Button>View logs</Button></Link><HealthCheckControl machineId={vm.id} /></div>
      </Card>
    </section>
    <section>
      <div className="sectionHeader"><div><Title3>Kubernetes workloads</Title3><Text className="muted">Daily workload view. Headlamp remains the advanced Kubernetes console.</Text></div><ExternalLinkButton href={runtimeConfig.headlampUrl}>Open Headlamp</ExternalLinkButton></div>
      <WorkloadTable workloads={data.workloads} />
    </section>
  </>;
}
