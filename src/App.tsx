import { Badge, Button, Card, CardHeader, Divider, ProgressBar, Text, Title1, Title3 } from "@fluentui/react-components";
import { Apps24Regular, Cloud24Regular, DataUsage24Regular, Pulse24Regular, Server24Regular, Settings24Regular, Wrench24Regular } from "@fluentui/react-icons";
import { services, vm, workloads } from "./data/mock";

const nav = [
  ["Overview", <Pulse24Regular />],
  ["Infrastructure", <Cloud24Regular />],
  ["Kubernetes", <Apps24Regular />],
  ["Data Platform", <DataUsage24Regular />],
  ["Monitoring", <Server24Regular />],
  ["Maintenance", <Wrench24Regular />],
  ["Settings", <Settings24Regular />],
] as const;

function StatusBadge({ status }: { status: string }) {
  const appearance = status === "healthy" ? "filled" : "outline";
  const color = status === "warning" ? "warning" : status === "offline" ? "danger" : "success";
  return <Badge appearance={appearance} color={color}>{status}</Badge>;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="metricCard"><Text size={200}>{label}</Text><Title3>{value}</Title3><Text size={200} className="muted">{detail}</Text></Card>;
}

export default function App() {
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">RO</div><div><Text weight="semibold">ReactOracle</Text><div className="muted small">Oracle data lab</div></div></div>
      <Divider />
      <nav>{nav.map(([label, icon], index) => <button key={label} className={"navItem " + (index === 0 ? "active" : "")}>{icon}<span>{label}</span></button>)}</nav>
      <div className="sidebarFooter"><StatusBadge status="healthy" /><Text size={200}>Control plane</Text></div>
    </aside>
    <main className="content">
      <header className="topbar">
        <div><Title1>Oracle data lab</Title1><div className="subtitle">{vm.shape} · {vm.ocpu} OCPU · {vm.memoryGb} GB RAM · K3s</div></div>
        <div className="headerStatus"><StatusBadge status="healthy" /><Text>{vm.name}</Text></div>
      </header>
      <section className="metrics">
        <MetricCard label="CPU" value={vm.cpuPercent + "%"} detail="Host utilization" />
        <MetricCard label="Memory" value={vm.memoryUsedGb + " / " + vm.memoryGb + " GB"} detail="Available for jobs" />
        <MetricCard label="Storage" value={vm.diskPercent + "%"} detail="Boot volume" />
        <MetricCard label="Projected OCI bill" value={vm.projectedCost} detail="Free-tier guardrail" />
      </section>
      <section className="gridTwo">
        <Card><CardHeader header={<Title3>Platform health</Title3>} /><div className="serviceList">{services.map((service) => <div className="serviceRow" key={service.name}><div><Text weight="semibold">{service.name}</Text><div className="muted small">{service.detail}</div></div><StatusBadge status={service.status} /></div>)}</div></Card>
        <Card><CardHeader header={<Title3>Capacity</Title3>} />
          <div className="capacityBlock"><div className="capacityLabel"><span>Memory</span><span>{vm.memoryUsedGb} / {vm.memoryGb} GB</span></div><ProgressBar value={vm.memoryUsedGb / vm.memoryGb} /></div>
          <div className="capacityBlock"><div className="capacityLabel"><span>CPU</span><span>{vm.cpuPercent}%</span></div><ProgressBar value={vm.cpuPercent / 100} /></div>
          <div className="capacityBlock"><div className="capacityLabel"><span>Disk</span><span>{vm.diskPercent}%</span></div><ProgressBar value={vm.diskPercent / 100} /></div>
          <Divider /><div className="quickActions"><Button appearance="primary">Open monitoring</Button><Button>View logs</Button><Button>Run health check</Button></div>
        </Card>
      </section>
      <section>
        <div className="sectionHeader"><div><Title3>Kubernetes workloads</Title3><Text className="muted">Simplified daily operations; Headlamp remains the advanced escape hatch.</Text></div><Button>Open Headlamp</Button></div>
        <div className="tableWrap"><table><thead><tr><th>Name</th><th>Namespace</th><th>Type</th><th>Status</th><th>RAM</th></tr></thead><tbody>
          {workloads.map(([name, namespace, type, status, ram]) => <tr key={name}><td>{name}</td><td>{namespace}</td><td>{type}</td><td><Badge color="success">{status}</Badge></td><td>{ram}</td></tr>)}
        </tbody></table></div>
      </section>
    </main>
  </div>;
}
