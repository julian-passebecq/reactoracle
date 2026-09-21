import { Button, Text } from "@fluentui/react-components";
import { useState } from "react";
import { useCommandStatus, useHealthCheckMutation } from "../api/queries";

type Props = {
  machineId: string;
};

export function HealthCheckControl({ machineId }: Props) {
  const [commandId, setCommandId] = useState<string | null>(null);
  const mutation = useHealthCheckMutation();
  const command = useCommandStatus(commandId);
  const status = command.data?.status ?? mutation.data?.status;
  const error = mutation.error ?? command.error;
  const busy = mutation.isPending || status === "queued" || status === "running";

  const run = () => {
    setCommandId(null);
    mutation.mutate(machineId, {
      onSuccess: (created) => setCommandId(created.id),
    });
  };

  return (
    <div className="healthCheckControl">
      <Button onClick={run} disabled={busy}>
        {busy ? "Checking…" : "Run health check"}
      </Button>
      {error ? (
        <Text size={200} className="commandFailed">
          {error instanceof Error ? error.message : "Health check request failed"}
        </Text>
      ) : status ? (
        <Text size={200} className={status === "failed" ? "commandFailed" : "muted"}>
          {status === "success"
            ? "Health check passed"
            : status === "failed"
              ? "Health check failed"
              : "Health check " + status}
        </Text>
      ) : null}
    </div>
  );
}
