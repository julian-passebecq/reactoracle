import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Spinner,
  Text,
} from "@fluentui/react-components";
import { useCommandStatus, useRestartWorkloadMutation } from "../api/queries";
import type { RestartWorkloadInput } from "../domain/types";

type Props = {
  input: RestartWorkloadInput;
};

export function RestartWorkloadButton({ input }: Props) {
  const [open, setOpen] = useState(false);
  const [commandId, setCommandId] = useState<string | null>(null);
  const mutation = useRestartWorkloadMutation();
  const command = useCommandStatus(commandId);

  const status = command.data?.status;
  const running = mutation.isPending || status === "queued" || status === "running";
  const succeeded = status === "success";
  const failed = mutation.isError || status === "failed";

  async function restart() {
    const run = await mutation.mutateAsync(input);
    setCommandId(run.id);
  }

  function close() {
    setOpen(false);
    setCommandId(null);
    mutation.reset();
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement>
        <Button size="small">Restart</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Restart {input.name}?</DialogTitle>
          <DialogContent>
            <div className="restartDialogContent">
              <Text>
                ReactOracle will request a Kubernetes rollout restart for the existing {input.kind.toLowerCase()}.
                It will not change the image, replica count, environment variables or configuration.
              </Text>
              <div className="restartTarget">
                <Text size={200}>Namespace</Text><Text weight="semibold">{input.namespace}</Text>
                <Text size={200}>Workload</Text><Text weight="semibold">{input.name}</Text>
                <Text size={200}>Risk</Text><Text weight="semibold">Moderate · service interruption possible</Text>
              </div>
              {running ? <div className="commandProgress"><Spinner size="tiny" /><Text>Restart command in progress…</Text></div> : null}
              {succeeded ? <Text className="monitoringReady">Restart command completed successfully.</Text> : null}
              {failed ? <Text className="commandFailed">{command.data?.error ?? mutation.error?.message ?? "Restart failed."}</Text> : null}
            </div>
          </DialogContent>
          <DialogActions>
            {succeeded || failed ? (
              <Button appearance="primary" onClick={close}>Done</Button>
            ) : (
              <>
                <DialogTrigger disableButtonEnhancement>
                  <Button disabled={running}>Cancel</Button>
                </DialogTrigger>
                <Button appearance="primary" disabled={running} onClick={() => void restart()}>
                  Confirm restart
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
