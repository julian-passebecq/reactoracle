import { Badge, Card, Text, Title2, Title3 } from "@fluentui/react-components";
import { PageHeader } from "../components/PageHeader";
import { architectureNodes, durableDataZones, engineeringFlow, mlEnrichmentFlow, type ArchitectureNode, type ArchitectureState } from "../data/architecture";

const stateAppearance: Record<ArchitectureState, { color: "success" | "informative" | "warning" | "subtle"; label: string }> = {
  live: { color: "success", label: "Live" },
  external: { color: "informative", label: "External" },
  planned: { color: "warning", label: "Planned" },
  optional: { color: "subtle", label: "Optional" },
};

const nodeById = new Map(architectureNodes.map((node) => [node.id, node]));

function ArchitectureBadge({ state }: { state: ArchitectureState }) {
  const presentation = stateAppearance[state];
  return <Badge color={presentation.color}>{presentation.label}</Badge>;
}

function ArchitectureCard({ node }: { node: ArchitectureNode }) {
  return (
    <Card className="architectureNodeCard">
      <div className="cardTop">
        <div>
          <Title3>{node.name}</Title3>
          <Text size={200} className="muted">{node.provider}</Text>
        </div>
        <ArchitectureBadge state={node.state} />
      </div>
      <Text>{node.role}</Text>
      <div className="architectureMeta">
        <span>{node.location}</span>
        <span>{node.durable ? "Durable" : "Compute / ephemeral"}</span>
      </div>
    </Card>
  );
}

function FlowNode({ node }: { node: ArchitectureNode }) {
  return (
    <div className="megaFlowNode">
      <div className="megaFlowNodeHeader">
        <Text weight="semibold">{node.name}</Text>
        <ArchitectureBadge state={node.state} />
      </div>
      <Text size={200} className="muted">{node.role}</Text>
    </div>
  );
}

function FlowLane({ ids, label }: { ids: string[]; label: string }) {
  return (
    <div className="architectureLane">
      <Text size={200} weight="semibold" className="architectureLaneLabel">{label}</Text>
      <div className="megaFlow">
        {ids.map((id, index) => {
          const node = nodeById.get(id);
          if (!node) return null;
          return (
            <div className="megaFlowStep" key={label + "-" + id + "-" + index}>
              <FlowNode node={node} />
              {index < ids.length - 1 ? <div className="megaFlowArrow" aria-hidden="true">→</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ArchitecturePage() {
  const sourceNodes = architectureNodes.filter((node) => node.layer === "source");
  const externalNodes = architectureNodes.filter((node) => ["delivery", "observability", "control"].includes(node.layer));

  return (
    <>
      <PageHeader
        title="Architecture"
        subtitle="Macro view of generation, durable lakehouse, Oracle compute, ML and Gold serving"
      />

      <section className="architecturePrinciple">
        <div>
          <Text size={200} weight="semibold">Core rule</Text>
          <Title2>Oracle is compute. MotherDuck / DuckLake is durable data.</Title2>
          <Text className="muted">
            If the Oracle VM is stopped, Airflow, Spark and local observability disappear temporarily, but Raw, Bronze, Silver,
            Gold and feature tables remain available outside the VM.
          </Text>
        </div>
        <Badge color="success">Gold survives VM shutdown</Badge>
      </section>

      <section className="sectionGap">
        <div className="sectionHeader">
          <div>
            <Title3>Canonical end-to-end flow</Title3>
            <Text className="muted">The generator is optional, and ML is a branch after features. Gold can be served without Kaggle or Neon.</Text>
          </div>
        </div>

        <div className="architectureLanes" aria-label="Canonical data platform flows">
          <FlowLane ids={engineeringFlow} label="Core data engineering → Gold" />
          <FlowLane ids={mlEnrichmentFlow} label="Optional ML enrichment → Gold history / compact serving state" />
        </div>
      </section>

      <section className="sectionGap">
        <div className="sectionHeader">
          <div>
            <Title3>Durable data zones</Title3>
            <Text className="muted">Business React applications are out of scope; ReactOracle publishes and exposes Gold tables instead.</Text>
          </div>
        </div>
        <div className="durableZoneGrid">
          {durableDataZones.map((zone) => (
            <Card key={zone.name} className="durableZoneCard">
              <div className="cardTop">
                <Title3>{zone.name}</Title3>
                <Badge color="success">Durable</Badge>
              </div>
              <Text weight="semibold">{zone.owner}</Text>
              <Text size={200} className="muted">{zone.purpose}</Text>
            </Card>
          ))}
        </div>
      </section>

      <section className="gridTwo sectionGap">
        <Card>
          <Title3>What disappears with the Oracle VM?</Title3>
          <div className="architectureList">
            <div><Badge color="warning">Temporary</Badge><Text>Airflow scheduling and DAG execution</Text></div>
            <div><Badge color="warning">Temporary</Badge><Text>Spark drivers/executors and History Server</Text></div>
            <div><Badge color="warning">Temporary</Badge><Text>Grafana, Prometheus, Loki and local K3s services</Text></div>
            <div><Badge color="success">Preserved</Badge><Text>MotherDuck / DuckLake Raw, Bronze, Silver, Gold and Features</Text></div>
            <div><Badge color="success">Preserved</Badge><Text>GitHub source / CI artifacts and external provider state</Text></div>
            <div><Badge color="success">Preserved</Badge><Text>Neon serving / ML metadata</Text></div>
          </div>
        </Card>

        <Card>
          <Title3>Serving boundary</Title3>
          <div className="architectureList">
            <div><Badge color="success">Primary</Badge><Text>Gold tables in MotherDuck / DuckLake</Text></div>
            <div><Badge color="informative">Optional</Badge><Text>Neon for low-volume serving tables, ML metrics and latest predictions</Text></div>
            <div><Badge color="informative">Consumers</Badge><Text>Power BI, SQL clients, notebooks and APIs</Text></div>
            <div><Badge color="subtle">Out of scope</Badge><Text>Business React dashboards and application-specific frontends</Text></div>
          </div>
        </Card>
      </section>

      <section className="sectionGap">
        <div className="sectionHeader">
          <div>
            <Title3>Sources and supporting systems</Title3>
            <Text className="muted">Optional inputs and platform services around the canonical pipeline.</Text>
          </div>
        </div>
        <div className="architectureCardGrid">
          {[...sourceNodes, ...externalNodes].map((node) => <ArchitectureCard key={node.id} node={node} />)}
        </div>
      </section>
    </>
  );
}
