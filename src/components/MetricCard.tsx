import { Card, Text, Title3 } from "@fluentui/react-components";

type Props = { label: string; value: string; detail: string };

export function MetricCard({ label, value, detail }: Props) {
  return (
    <Card className="metricCard">
      <Text size={200}>{label}</Text>
      <Title3>{value}</Title3>
      <Text size={200} className="muted">{detail}</Text>
    </Card>
  );
}
