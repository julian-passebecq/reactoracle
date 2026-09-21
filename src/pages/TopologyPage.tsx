import { Card, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useOverview } from "../api/queries";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export function TopologyPage() {
  const { data, isLoading } = useOverview();

  if (isLoading || !data) {
    return <div className="loadingState"><Spinner label="Loading platform topology" /></div>;
  }

  const persistent = data.workloads.filter((workload) => workload.kind !== "Job");
  const jobs = data.workloads.filter((workload) => workload.kind === "Job");

  return (
    <>
      <PageHeader
        title="Topology"
        subtitle="How the external control plane, Oracle host and K3s data workloads fit together"
      />

      <div className="topologyFlow" aria-label="ReactOracle platform topology">
        <section className="topologyStage">
          <Text weight="semibold" className="topologyStageLabel">External control plane</Text>
          <div className="topologyCards">
            <Card className="topologyNode">
              <Title3>ReactOracle</Title3>
              <Text className="muted">React + Fluent UI 2</Text>
              <Text size={200}>Hosted outside the Oracle VM</Text>
            </Card>
            <div className="topologyArrow" aria-hidden="true">→</div>
            <Card className="topologyNode">
              <Title3>Control API</Title3>
              <Text className="muted">FastAPI</Text>
              <Text size={200}>Read model, authentication boundary and future command audit</Text>
            </Card>
            <div className="topologyArrow" aria-hidden="true">←</div>
            <Card className="topologyNode">
              <div className="cardTop"><Title3>Oracle agent</Title3><StatusBadge status="healthy" /></div>
              <Text className="muted">Go · systemd · outbound only</Text>
              <Text size={200}>Host + K3s telemetry</Text>
            </Card>
          </div>
        </section>

        <div className="topologyDown" aria-hidden="true">↓</div>

        <section className="topologyStage">
          <Text weight="semibold" className="topologyStageLabel">Oracle compute</Text>
          <Card className="topologyHost">
            <div className="cardTop">
              <div>
                <Title3>{data.vm.name}</Title3>
                <Text className="muted">{data.vm.shape}</Text>
              </div>
              <StatusBadge status="healthy" />
            </div>
            <div className="topologyHostMetrics">
              <span>{data.vm.ocpu} OCPU</span>
              <span>{data.vm.memoryUsedGb} / {data.vm.memoryGb} GB RAM</span>
              <span>{data.vm.cpuPercent}% CPU</span>
              <span>{data.vm.diskPercent}% disk</span>
              <span>{data.vm.uptime} uptime</span>
            </div>
          </Card>
        </section>

        <div className="topologyDown" aria-hidden="true">↓</div>

        <section className="topologyStage">
          <Text weight="semibold" className="topologyStageLabel">K3s namespaces</Text>
          <div className="namespaceGrid">
            {data.namespaces.map((namespace) => (
              <Card key={namespace.name} className="topologyNamespace">
                <div className="cardTop">
                  <Title3>{namespace.name}</Title3>
                  <StatusBadge status={namespace.podsReady === namespace.podsTotal ? "healthy" : "warning"} />
                </div>
                <Text>{namespace.podsReady} / {namespace.podsTotal} pods ready</Text>
                <Text className="muted" size={200}>
                  {namespace.cpuMillicores}m CPU · {namespace.memoryMb} MB RAM
                </Text>
              </Card>
            ))}
          </div>
        </section>

        <section className="gridTwo topologyWorkloadSection">
          <Card>
            <Title3>Persistent workloads</Title3>
            <div className="topologyList">
              {persistent.map((workload) => (
                <div className="serviceRow" key={workload.id}>
                  <div>
                    <Text weight="semibold">{workload.name}</Text>
                    <div className="muted small">{workload.namespace} · {workload.kind}</div>
                  </div>
                  <StatusBadge status={workload.status === "Running" ? "healthy" : "warning"} />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Title3>Ephemeral compute</Title3>
            {jobs.length > 0 ? (
              <div className="topologyList">
                {jobs.map((job) => (
                  <div className="serviceRow" key={job.id}>
                    <div>
                      <Text weight="semibold">{job.name}</Text>
                      <div className="muted small">{job.namespace} · Kubernetes Job</div>
                    </div>
                    <StatusBadge status={job.status === "Failed" ? "warning" : "healthy"} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState">
                <Text weight="semibold">No active jobs</Text>
                <Text className="muted">Spark applications, dbt and Polars should normally consume resources only while running.</Text>
              </div>
            )}
          </Card>
        </section>

        <section className="topologyStage">
          <Text weight="semibold" className="topologyStageLabel">External data services</Text>
          <div className="topologyExternal">
            <Card><Title3>Kafka</Title3><Text className="muted">Managed externally</Text></Card>
            <Card><Title3>FastAPI Cloud</Title3><Text className="muted">Application APIs</Text></Card>
            <Card><Title3>MotherDuck / DuckLake</Title3><Text className="muted">Planned durable Raw → Gold lakehouse</Text></Card>
            <Card><Title3>Neon</Title3><Text className="muted">Optional serving / ML metadata Postgres</Text></Card>
          </div>
        </section>
      </div>
    </>
  );
}
