import { Button, Card, Text, Title3 } from "@fluentui/react-components";

type Props = {
  title?: string;
  error: unknown;
  onRetry?: () => void;
};

export function DataError({ title = "Unable to load data", error, onRetry }: Props) {
  const detail = error instanceof Error ? error.message : "Unknown control-plane error";
  return (
    <Card className="errorCard">
      <Title3>{title}</Title3>
      <Text className="muted">{detail}</Text>
      {onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
    </Card>
  );
}
