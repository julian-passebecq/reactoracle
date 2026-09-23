import { Button, Card, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useGoldCatalog, useOverview } from "../api/queries";
import { DataError } from "../components/DataError";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { runtimeConfig } from "../config";

const sumMemory = (items: { memoryMb: number }[]) => Math.round(items.reduce((sum, item) => sum + item.memoryMb, 0));
const sumCpu = (items: { cpuMillicores: number }[]) => Math.round(items.reduce((sum, item) => sum + item.cpuMillicores, 0));

export function DataPlatformPage() {
  const overview = useOverview();
  const goldCatalog = useGoldCatalog();
  if (overview.isLoading) return <div className="loadingState"><Spinner label="Loading data platform" /></div>;
  if (overview.isError || !overview.data) {
    return <DataError title="Data platform unavailable" error={overview.error} onRetry={() => void overview.refetch()} />;
  }
  const data = overview.data;

  const airflowService = data.services.find((service) => service.id === "airflow");
  const polarsService = data.services.find((service) => service.id === "polars-duckdb");
  const kafkaService = data.services.find((service) => service.id === "kafka");

  const airflowWorkloads = data.workloads.filter((item) => item.namespace === "airflow");
  const ephemeralJobs = data.workloads.filter((item) => item.namespace === "jobs");
  const dbtJobs = ephemeralJobs.filter((item) => item.name.toLowerCase().includes("dbt"));
  const polarsJobs = ephemeralJobs.filter((item) => item.name.toLowerCase().includes("polars"));

  return <>
    <PageHeader title="Data platform" subtitle="Airflow orchestration with Polars + DuckDB tasks and MotherDuck/DuckLake analytical storage" />

    <section className="metrics">
      <MetricCard label="Airflow memory" value={sumMemory(airflowWorkloads) + " MB"} detail={airflowWorkloads.length + " Kubernetes workloads"} />
      <MetricCard label="Airflow CPU" value={sumCpu(airflowWorkloads) + "m"} detail="Current namespace usage" />
      <MetricCard label="Polars / DuckDB" value={polarsService?.status ?? "idle"} detail="Ephemeral Airflow task workload" />
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
        <div className="cardTop"><Title3>Polars + DuckDB</Title3><StatusBadge status={polarsService?.status ?? "idle"} /></div>
        <Text className="muted">{polarsService?.detail ?? "No active transformation task"}</Text>
        <Text size={200}>Runs as ephemeral Airflow/Kubernetes work rather than a resident distributed compute stack.</Text>
        <Button disabled>Pipeline run control · next slice</Button>
      </Card>

      <Card className="platformCard">
        <div className="cardTop"><Title3>Kafka</Title3><StatusBadge status={kafkaService?.status ?? "offline"} /></div>
        <Text className="muted">{kafkaService?.detail ?? "Managed Kafka not configured"}</Text>
        <Text size={200}>Optional external streaming source; not required for the first FOIL WIND medallion slice.</Text>
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
        <div className="cardTop"><Title3>MotherDuck / DuckLake</Title3><StatusBadge status="idle" /></div>
        <Text className="muted">Durable analytical lakehouse outside the Oracle VM</Text>
        <Text size={200}>Bronze, Silver and Gold remain available even when Oracle compute is stopped; raw archive belongs in OCI Object Storage.</Text>
        <Button disabled>Lakehouse adapter · planned</Button>
      </Card>
    </div>

    <section className="sectionGap">
      <div className="sectionHeader">
        <div>
          <Title3>Gold serving boundary</Title3>
          <Text className="muted">
            ReactOracle publishes durable Gold contracts. Business-specific React dashboards are intentionally outside this product.
          </Text>
        </div>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr><th>Table</th><th>Grain</th><th>Purpose</th><th>Consumers</th><th>Storage</th></tr>
          </thead>
          <tbody>
            {goldCatalog.isLoading ? (
              <tr><td colSpan={5}>Loading Gold catalog…</td></tr>
            ) : null}
            {(goldCatalog.data ?? []).map((table) => (
              <tr key={table.name}>
                <td className="strongCell mono">{table.name}</td>
                <td>{table.grain}</td>
                <td>{table.purpose}</td>
                <td>{table.consumers.join(", ")}</td>
                <td>{table.storage} · {table.status}{table.mlDerived ? " · ML-derived" : ""}</td>
              </tr>
            ))}
            {goldCatalog.isError ? (
              <tr>
                <td colSpan={5} className="commandFailed">
                  Gold catalog unavailable: {goldCatalog.error instanceof Error ? goldCatalog.error.message : "unknown error"}
                </td>
              </tr>
            ) : null}
            {!goldCatalog.isLoading && !goldCatalog.isError && (goldCatalog.data?.length ?? 0) === 0 ? (
              <tr><td colSpan={5}>No Gold contracts configured.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
