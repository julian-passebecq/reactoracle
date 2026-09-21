import { Spinner, Text, Title3 } from "@fluentui/react-components";
import { useOverview, useRecentCommands } from "../api/queries";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function ActivityPage() {
  const overview = useOverview();
  const commands = useRecentCommands();

  if (!overview.data) {
    return <div className="loadingState"><Spinner label="Loading activity" /></div>;
  }

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Unified audit trail for automated events and control-plane operations"
      />

      <section>
        <div className="sectionHeader">
          <div>
            <Title3>Control operations</Title3>
            <Text className="muted">Allow-listed commands executed through the outbound Oracle agent.</Text>
          </div>
        </div>

        {commands.data && commands.data.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Machine</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {commands.data.map((run) => (
                  <tr key={run.id}>
                    <td className="strongCell">{run.command}</td>
                    <td>{run.machineId}</td>
                    <td>{run.risk}</td>
                    <td><StatusBadge status={run.status === "queued" ? "idle" : run.status === "running" ? "warning" : run.status} /></td>
                    <td>{formatTime(run.createdAt)}</td>
                    <td>{run.completedAt ? formatTime(run.completedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyPanel">
            <Text weight="semibold">No control operations yet</Text>
            <Text className="muted">Run the safe health check from Overview to prove the outbound command path.</Text>
          </div>
        )}
      </section>

      <section className="sectionGap">
        <div className="sectionHeader">
          <div>
            <Title3>Platform events</Title3>
            <Text className="muted">System and data-platform activity from the current read model.</Text>
          </div>
        </div>
        <div className="timeline">
          {overview.data.activity.map((event) => (
            <div className="timelineRow" key={event.id}>
              <Text className="mono">{event.when}</Text>
              <Text>{event.actor}</Text>
              <Text className="timelineAction">{event.action}</Text>
              <StatusBadge status={event.status} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
