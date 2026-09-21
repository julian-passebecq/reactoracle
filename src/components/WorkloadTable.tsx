import { Badge } from "@fluentui/react-components";
import type { Workload } from "../domain/types";

type Props = { workloads: Workload[] };

export function WorkloadTable({ workloads }: Props) {
  return (
    <div className="tableWrap">
      <table>
        <thead><tr><th>Name</th><th>Namespace</th><th>Type</th><th>Status</th><th>CPU</th><th>RAM</th><th>Restarts</th></tr></thead>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
