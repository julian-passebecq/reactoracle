import { Badge, Text } from "@fluentui/react-components";
import type { Workload } from "../domain/types";
import { RestartWorkloadButton } from "./RestartWorkloadButton";

type Props = {
  workloads: Workload[];
  machineId?: string;
  allowRestart?: boolean;
};

export function WorkloadTable({ workloads, machineId, allowRestart = false }: Props) {
  const showActions = Boolean(machineId && allowRestart);

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Namespace</th><th>Type</th><th>Status</th><th>CPU</th><th>RAM</th><th>Restarts</th>
            {showActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {workloads.map((workload) => (
            <tr key={workload.id}>
              <td className="strongCell">{workload.name}</td>
              <td>{workload.namespace}</td>
              <td>{workload.kind}</td>
              <td><Badge color={workload.status === "Failed" ? "danger" : "success"}>{workload.status}</Badge></td>
              <td>{workload.cpuMillicores}m</td>
              <td>{workload.memoryMb} MB</td>
              <td>{workload.restarts}</td>
              {showActions ? (
                <td>
                  {workload.kind === "Job" ? (
                    <Text size={200} className="muted">Not restartable</Text>
                  ) : (
                    <RestartWorkloadButton
                      input={{
                        machineId: machineId!,
                        namespace: workload.namespace,
                        name: workload.name,
                        kind: workload.kind,
                      }}
                    />
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
