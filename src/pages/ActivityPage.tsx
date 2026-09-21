import { Spinner, Text } from "@fluentui/react-components";
import { useOverview } from "../api/queries";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export function ActivityPage() {
  const { data } = useOverview();
  if (!data) return <div className="loadingState"><Spinner label="Loading activity" /></div>;
  return <><PageHeader title="Activity" subtitle="Unified audit trail for user and automated operations" /><div className="timeline">{data.activity.map((event) => <div className="timelineRow" key={event.id}><Text className="mono">{event.when}</Text><Text>{event.actor}</Text><Text className="timelineAction">{event.action}</Text><StatusBadge status={event.status} /></div>)}</div></>;
}
