import { Button, Card, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useOverview } from "../api/queries";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { runtimeConfig } from "../config";

const sumMemory = (items: { memoryMb: number }[]) => Math.round(items.reduce((sum, item) => sum + item.memoryMb, 0));
const sumCpu = (items: { cpuMillicores: number }[]) => Math.round(items.reduce((sum, item) => sum + item.cpuMillicores, 0));

export function DataPlatformPage() {
  const { data } = useOverview();
  if (!data) return <div className="loadingState"><Spinner label="Loading data platform" /></div>;

  const airflowService = data.services.find((service) => service.id === "airflow");
  const sparkService = data.services.find((service) => service.id === "spark");
  const kafkaService = data.services.find((service) => service.id === "kafka");

  const airflowWorkloads = data.workloads.filter((item) => item.namespace === "airflow");
  const sparkWorkloads = data.workloads.filter((item) => item.namespace === "spark");
  const activeSparkJobs = sparkWorkloads.filter((item) => item.kind === "Job" && item.status === "Running");
  const sparkHistory = sparkWorkloads.find((item) => item.name.includes("history"));
  const ephemeralJobs = data.workloads.filter((item) => item.namespace === "jobs");
  const dbtJobs = ephemeralJobs.filter((item) => item.name.toLowerCase().includes("dbt"));
  const polarsJobs = ephemeralJobs.filter((item) => item.name.toLowerCase().includes("polars"));

  return <>
    <PageHeader title="Data platform" subtitle="Airflow orchestration, Spark compute and ephemeral transformation jobs" />

    <section className="metrics">
      <MetricCard label="Airflow memory" value={sumMemory(airflowWorkloads) + " MB"} detail={airflowWorkloads.length + " Kubernetes workloads"} />
      <MetricCard label="Airflow CPU" value={sumCpu(airflowWorkloads) + "m"} detail="Current namespace usage" />
      <MetricCard label="Active Spark jobs" value={String(activeSparkJobs.length)} detail={sparkHistory?.status === "Running" ? "History server available" : "History server not ready"} />
      <MetricCard label="Ephemeral jobs" value={String(ephemeralJobs.length)} detail="jobs namespace" />
    </section>

    <div className="platformGrid">
      <Card className="platformCard">
        <div className="cardTop"><Title3>Airflow</Title3><StatusBadge status={airflowService?.status ?? "warning"} /></div>
        <Text className="muted">{airflowService?.detail ?? "Airflow service not discovered"}</Text>
        <Text size={200}>{airflowWorkloads.length} workload(s) · {sumMemory(airflowWorkloads)} MB · {sumCpu(airflowWorkloads)}m CPU</Text>
        <ExternalLinkButton href={runtimeConfig.airflowUrl}>Open Airflow</ExternalLinkButton>
      </Card>

      <Card className="platformCard">
        <div className="cardTop"><Title3>Spark</Title3><StatusBadge status={sparkService?.status ?? "idle"} /></div>
        <Text className="muted">{sparkService?.detail ?? "No Spark service discovered"}</Text>
        <Text size={200}>{activeSparkJobs.length} active application(s) · {sumMemory(sparkWorkloads)} MB visible in K3s</Text>
        <ExternalLinkButton href={runtimeConfig.sparkHistoryUrl}>Open Spark History</ExternalLinkButton>
      </Card>

      <Card className="platformCard">
        <div className="cardTop"><Title3>Kafka</Title3><StatusBadge status={kafkaService?.status ?? "offline"} /></div>
        <Text className="muted">{kafkaService?.detail ?? "Managed Kafka not configured"}</Text>
        <Text size={200}>Kept outside Oracle so broker/JVM memory does not compete with Spark.</Text>
        <Button disabled>Provider adapter later</Button>
      </Card>

      <Card className="platformCard">
        <div className="cardTop"><Title3>dbt</Title3><StatusBadge status={dbtJobs.some((item) => item.status === "Running") ? "healthy" : "idle"} /></div>
        <Text className="muted">Ephemeral Kubernetes Job</Text>
        <Text size={200}>{dbtJobs.length > 0 ? dbtJobs.length + " observed job(s)" : "Zero resident memory while idle"}</Text>
        <Button disabled>Run dbt build · next slice</Button>
      </Card>

      <Card className="platformCard">
        <div className="cardTop"><Title3>Polars</Title3><StatusBadge status={polarsJobs.some((item) => item.status === "Running") ? "healthy" : "idle"} /></div>
        <Text className="muted">Ephemeral Python/Polars Job</Text>
        <Text size={200}>{polarsJobs.length > 0 ? polarsJobs.length + " observed job(s)" : "VM resources are used only while a job runs"}</Text>
        <Button disabled>Run Polars job · next slice</Button>
      </Card>

      <Card className="platformCard">
        <div className="cardTop"><Title3>DuckDB / DuckLake</Title3><StatusBadge status="idle" /></div>
        <Text className="muted">Library/runtime rather than a permanent database daemon</Text>
        <Text size={200}>Available inside Spark-adjacent, dbt or Polars jobs without consuming idle RAM.</Text>
        <Button disabled>Job integration later</Button>
      </Card>
    </div>
  </>;
}
