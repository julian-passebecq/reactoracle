import { Button, Card, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useOverview } from "../api/queries";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

const actionByService: Record<string,string> = { Airflow: "Open Airflow", Spark: "Open history", Kafka: "Inspect Kafka" };

export function DataPlatformPage() {
  const { data } = useOverview();
  if (!data) return <div className="loadingState"><Spinner label="Loading data platform" /></div>;
  const cards = data.services.filter((service) => ["data", "external"].includes(service.category));
  return <>
    <PageHeader title="Data platform" subtitle="Persistent orchestration plus ephemeral compute jobs" />
    <div className="platformGrid">{cards.map((service) => <Card key={service.id} className="platformCard"><div className="cardTop"><Title3>{service.name}</Title3><StatusBadge status={service.status} /></div><Text className="muted">{service.detail}</Text>{service.memoryMb ? <Text size={200}>Resident memory: {service.memoryMb} MB</Text> : null}<Button>{actionByService[service.name] ?? "Open"}</Button></Card>)}
      <Card className="platformCard"><div className="cardTop"><Title3>dbt</Title3><StatusBadge status="idle" /></div><Text className="muted">Ephemeral Kubernetes Job</Text><Text size={200}>Zero resident memory while idle</Text><Button>Run dbt build</Button></Card>
      <Card className="platformCard"><div className="cardTop"><Title3>Polars</Title3><StatusBadge status="idle" /></div><Text className="muted">Ephemeral Python/Polars Job</Text><Text size={200}>Use the VM only while a job runs</Text><Button>Run Polars job</Button></Card>
    </div>
  </>;
}
