import { useState } from "react";
import { Button, Card, Dropdown, Option, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useAgentStatus, useCommandStatus, useLogQueryMutation, useOverview } from "../api/queries";
import { DataError } from "../components/DataError";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { runtimeConfig } from "../config";
import type { LogQueryResult } from "../domain/types";

const tailChoices = [50, 100, 200, 500];

function asLogQueryResult(value: Record<string, unknown> | null | undefined): LogQueryResult | null {
  if (!value || typeof value.text !== "string" || typeof value.lineCount !== "number") return null;
  return value as unknown as LogQueryResult;
}

export function LogsPage() {
  const overview = useOverview();
  const agent = useAgentStatus();
  const logMutation = useLogQueryMutation();
  const [selectedWorkloadId, setSelectedWorkloadId] = useState("");
  const [tail, setTail] = useState(100);

  const commandId = logMutation.data?.id ?? null;
  const command = useCommandStatus(commandId);

  if (overview.isLoading) {
    return <div className="loadingState"><Spinner label="Loading log targets" /></div>;
  }
  if (overview.isError || !overview.data) {
    return <DataError error={overview.error} onRetry={() => void overview.refetch()} />;
  }

  const workloads = overview.data.workloads;
  const selected = workloads.find((item) => item.id === selectedWorkloadId) ?? workloads[0];
  const logResult = asLogQueryResult(command.data?.result);
  const liveAgentUnavailable = runtimeConfig.mode === "live" && !agent.data?.connected;
  const running = logMutation.isPending || command.data?.status === "queued" || command.data?.status === "running";

  const requestLogs = () => {
    if (!selected) return;
    logMutation.mutate({
      machineId: overview.data.vm.id,
      namespace: selected.namespace,
      name: selected.name,
      kind: selected.kind,
      tail,
    });
  };

  const openGrafana = () => {
    if (!runtimeConfig.grafanaUrl) return;
    window.open(runtimeConfig.grafanaUrl, "_blank", "noopener,noreferrer");
  };

  return <>
    <PageHeader
      title="Logs"
      subtitle="Bounded read-only Kubernetes logs through the outbound Oracle agent"
      actions={<Button onClick={openGrafana} disabled={!runtimeConfig.grafanaUrl}>Open Grafana Explore</Button>}
    />

    <section className="gridTwo">
      <Card>
        <Title3>Log target</Title3>
        <div className="logToolbar">
          <div>
            <Text size={200}>Workload</Text>
            <Dropdown
              value={selected ? selected.name : "No workloads"}
              selectedOptions={selected ? [selected.id] : []}
              onOptionSelect={(_, data) => setSelectedWorkloadId(String(data.optionValue ?? ""))}
              disabled={workloads.length === 0}
            >
              {workloads.map((workload) => (
                <Option key={workload.id} value={workload.id} text={workload.name}>
                  {workload.namespace} / {workload.name}
                </Option>
              ))}
            </Dropdown>
          </div>
          <div>
            <Text size={200}>Tail</Text>
            <Dropdown
              value={tail + " lines"}
              selectedOptions={[String(tail)]}
              onOptionSelect={(_, data) => setTail(Number(data.optionValue ?? 100))}
            >
              {tailChoices.map((value) => <Option key={value} value={String(value)} text={value + " lines"}>{value} lines</Option>)}
            </Dropdown>
          </div>
        </div>

        {selected ? (
          <div className="logTargetSummary">
            <div><Text size={200}>Namespace</Text><Text weight="semibold">{selected.namespace}</Text></div>
            <div><Text size={200}>Kind</Text><Text weight="semibold">{selected.kind}</Text></div>
            <div><Text size={200}>Status</Text><Text weight="semibold">{selected.status}</Text></div>
          </div>
        ) : null}

        <div className="quickActions">
          <Button appearance="primary" onClick={requestLogs} disabled={!selected || running || liveAgentUnavailable}>
            {running ? "Reading logs..." : "Read logs"}
          </Button>
          {runtimeConfig.mode === "live" ? (
            <StatusBadge status={agent.data?.connected ? "healthy" : "offline"} />
          ) : (
            <StatusBadge status="idle" />
          )}
          <Text size={200} className="muted">
            {runtimeConfig.mode === "live"
              ? agent.data?.connected ? "Oracle agent connected" : "Oracle agent is offline"
              : "Mock adapter"}
          </Text>
        </div>
      </Card>

      <Card>
        <Title3>Safety boundary</Title3>
        <Text className="muted">
          ReactOracle never accepts a shell command from the browser. The API validates namespace, workload kind,
          workload name and a maximum 500-line tail before the agent runs a fixed kubectl logs command.
        </Text>
        <Text size={200}>RBAC grants get access to pods/log only; no pod mutation is required.</Text>
      </Card>
    </section>

    <section className="sectionGap">
      <div className="sectionHeader">
        <div>
          <Title3>Recent logs</Title3>
          <Text className="muted">
            {logResult ? logResult.lineCount + " lines · " + (logResult.truncated ? "response truncated" : "complete response") : "Choose a workload and request logs."}
          </Text>
        </div>
        {command.data ? <StatusBadge status={command.data.status === "queued" ? "idle" : command.data.status === "running" ? "warning" : command.data.status} /> : null}
      </div>

      {logMutation.isError ? <div className="healthNotice"><Text>{logMutation.error.message}</Text></div> : null}
      {command.data?.status === "failed" ? <div className="healthNotice"><Text>{command.data.error ?? "Log request failed."}</Text></div> : null}

      <pre className="logViewer">
        {logResult?.text ?? (running ? "Waiting for the Oracle agent to execute the bounded log read..." : "No log response yet.")}
      </pre>
    </section>
  </>;
}
