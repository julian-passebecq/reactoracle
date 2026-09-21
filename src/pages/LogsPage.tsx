import { Button, Card, Dropdown, Option, Text, Title3 } from "@fluentui/react-components";
import { PageHeader } from "../components/PageHeader";

const mockLogs = [
  "16:42:11 INFO  airflow.scheduler  Processing DAG run daily_etl",
  "16:42:13 INFO  airflow.scheduler  Queued task transform_sales",
  "16:42:17 INFO  spark.history      Event log scan complete",
  "16:42:21 INFO  prometheus         Scrape targets healthy",
];

export function LogsPage() {
  return <>
    <PageHeader title="Logs" subtitle="Simplified cross-service viewer; Grafana/Loki remains the advanced explorer" actions={<Button>Open Grafana Explore</Button>} />
    <Card>
      <div className="logToolbar"><div><Text size={200}>Namespace</Text><Dropdown defaultValue="airflow" defaultSelectedOptions={["airflow"]}><Option value="airflow">airflow</Option><Option value="spark">spark</Option><Option value="monitoring">monitoring</Option></Dropdown></div><div><Text size={200}>Window</Text><Dropdown defaultValue="Last hour" defaultSelectedOptions={["1h"]}><Option value="1h">Last hour</Option><Option value="6h">Last 6 hours</Option></Dropdown></div></div>
      <Title3>Recent logs</Title3>
      <pre className="logViewer">{mockLogs.join("\n")}</pre>
    </Card>
  </>;
}
