import { Button, Card, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useMaintenance } from "../api/queries";
import { DataError } from "../components/DataError";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export function MaintenancePage() {
  const maintenance = useMaintenance();
  if (maintenance.isLoading) return <div className="loadingState"><Spinner label="Loading maintenance state" /></div>;
  if (maintenance.isError || !maintenance.data) {
    return <DataError title="Maintenance state unavailable" error={maintenance.error} onRetry={() => void maintenance.refetch()} />;
  }
  const data = maintenance.data;
  return <>
    <PageHeader title="Maintenance" subtitle="Host hygiene, storage, updates and backup status" />
    <section className="gridTwo">
      <Card><Title3>Operating system</Title3><dl className="detailsList"><div><dt>OS</dt><dd>{data.os}</dd></div><div><dt>Kernel</dt><dd>{data.kernel}</dd></div><div><dt>Updates</dt><dd>{data.updatesAvailable}</dd></div><div><dt>Security</dt><dd>{data.securityUpdates}</dd></div><div><dt>Reboot required</dt><dd>{data.rebootRequired ? "Yes" : "No"}</dd></div></dl><div className="quickActions"><Button>Check updates</Button><Button>Review security updates</Button></div></Card>
      <Card><Title3>Storage hygiene</Title3><dl className="detailsList"><div><dt>Unused images</dt><dd>{data.unusedImagesGb} GB</dd></div><div><dt>Prometheus</dt><dd>{data.prometheusGb} GB</dd></div><div><dt>Loki</dt><dd>{data.lokiGb} GB</dd></div></dl><Button>Inspect cleanup candidates</Button></Card>
    </section>
    <section className="gridTwo sectionGap"><Card><Title3>Backup</Title3><div className="cardTop"><Text>{data.lastBackup}</Text><StatusBadge status={data.backupStatus} /></div><Button>Backup now</Button></Card><Card className="dangerCard"><Title3>Danger zone</Title3><Text className="muted">Destructive and disruptive controls stay disabled until the audited command pipeline exists.</Text><div className="quickActions"><Button disabled>Restart K3s</Button><Button disabled>Reboot VM</Button></div></Card></section>
  </>;
}
