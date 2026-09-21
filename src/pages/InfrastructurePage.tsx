import { Badge, Button, Card, CardHeader, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useInfrastructure, useOverview } from "../api/queries";
import { DataError } from "../components/DataError";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export function InfrastructurePage() {
  const infrastructure = useInfrastructure();
  const overview = useOverview();
  if (infrastructure.isLoading || overview.isLoading) {
    return <div className="loadingState"><Spinner label="Loading infrastructure" /></div>;
  }
  if (infrastructure.isError || overview.isError || !infrastructure.data || !overview.data) {
    return (
      <DataError
        title="Infrastructure state unavailable"
        error={infrastructure.error ?? overview.error}
        onRetry={() => {
          void infrastructure.refetch();
          void overview.refetch();
        }}
      />
    );
  }
  const infra = infrastructure.data;
  const vm = overview.data.vm;
  return <>
    <PageHeader title="Infrastructure" subtitle="Oracle Cloud inventory and OpenTofu execution state" actions={<><StatusBadge status={infra.state} /><Button appearance="primary">Run plan</Button></>} />
    <section className="metrics metricsThree">
      <Card className="metricCard"><Text size={200}>OpenTofu state</Text><Title3>{infra.state}</Title3><Text className="muted">{infra.managedResources} managed resources</Text></Card>
      <Card className="metricCard"><Text size={200}>Last plan</Text><Title3>{infra.lastPlan}</Title3><Text className="muted">{infra.drift}</Text></Card>
      <Card className="metricCard"><Text size={200}>Compute</Text><Title3>{vm.ocpu} OCPU · {vm.memoryGb} GB</Title3><Text className="muted">{vm.shape}</Text></Card>
    </section>
    <section className="gridTwo">
      <Card><CardHeader header={<Title3>OCI resources</Title3>} /><dl className="detailsList">
        <div><dt>Instance</dt><dd>{vm.name}</dd></div><div><dt>VCN</dt><dd>{infra.vcn}</dd></div><div><dt>Subnet</dt><dd>{infra.subnet}</dd></div><div><dt>Public IP</dt><dd>{infra.publicIp}</dd></div><div><dt>Boot volume</dt><dd>{infra.bootVolumeGb} GB</dd></div>
      </dl></Card>
      <Card><CardHeader header={<Title3>Safe IaC workflow</Title3>} /><div className="stackText"><Text>Validate and plan are safe read/review operations. Apply will require explicit approval and an audit record.</Text><div className="quickActions"><Button>Validate</Button><Button appearance="primary">Plan</Button><Button disabled>Apply</Button></div></div></Card>
    </section>
    <section><div className="sectionHeader"><div><Title3>Recent OpenTofu runs</Title3><Text className="muted">Execution is planned for CI, not as a resident VM service.</Text></div></div>
      <div className="tableWrap"><table><thead><tr><th>Run</th><th>Action</th><th>Status</th><th>Summary</th><th>Duration</th><th>When</th></tr></thead><tbody>{infra.tofuRuns.map((run) => <tr key={run.id}><td>#{run.id}</td><td>{run.action}</td><td><StatusBadge status={run.status} /></td><td>{run.summary}</td><td>{run.duration}</td><td>{run.when}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}
