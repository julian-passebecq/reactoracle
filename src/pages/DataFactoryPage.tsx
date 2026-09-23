import { Badge, Card, Spinner, Text, Title2, Title3 } from "@fluentui/react-components";
import { useDataFactoryPlan } from "../api/queries";
import { PageHeader } from "../components/PageHeader";
import type { DataFactoryStage, DataFactoryStageState } from "../domain/types";

const stagePresentation: Record<DataFactoryStageState, { color: "success" | "warning" | "informative" | "subtle"; label: string }> = {
  live: { color: "success", label: "Implemented" },
  planned: { color: "warning", label: "Planned" },
  external: { color: "informative", label: "External" },
  optional: { color: "subtle", label: "Optional" },
};

function StageLane({ stages }: { stages: DataFactoryStage[] }) {
  return (
    <div className="factoryPipeline">
      {stages.map((stage, index) => (
        <div className="factoryStageWrap" key={stage.id}>
          <Card className="factoryStageCard">
            <div className="cardTop">
              <Text weight="semibold">{stage.name}</Text>
              <Badge color={stagePresentation[stage.state].color}>{stagePresentation[stage.state].label}</Badge>
            </div>
            <Title3>{stage.engine}</Title3>
            <Text size={200} className="muted">{stage.location}</Text>
            <Text size={200}>{stage.detail}</Text>
          </Card>
          {index < stages.length - 1 ? <div className="megaFlowArrow" aria-hidden="true">→</div> : null}
        </div>
      ))}
    </div>
  );
}

export function DataFactoryPage() {
  const planQuery = useDataFactoryPlan();

  if (planQuery.isLoading) {
    return <div className="loadingState"><Spinner label="Loading Data Factory contract" /></div>;
  }

  if (planQuery.isError || !planQuery.data) {
    return (
      <Card className="errorCard">
        <Title3>Data Factory contract unavailable</Title3>
        <Text className="muted">
          {planQuery.error instanceof Error ? planQuery.error.message : "The control plane did not return the Data Factory plan."}
        </Text>
      </Card>
    );
  }

  const { source, coreStages: coreDataFactoryStages, mlStages: mlDataFactoryStages, executionEnabled } = planQuery.data;

  return (
    <>
      <PageHeader
        title="Data Factory"
        subtitle="FOIL WIND synthetic telemetry → Airflow → Polars/DuckDB → MotherDuck/DuckLake Gold"
      />

      <section className="factoryNotice">
        <div>
          <Text size={200} weight="semibold">V1 boundary</Text>
          <Title2>Executable pipeline code added; cloud deployment still pending.</Title2>
          <Text className="muted">
            The repository now contains the WIND synthetic source and Polars/DuckDB medallion pipeline. MotherDuck credentials, Airflow/K3s deployment and OCI archive wiring remain to be validated live.
          </Text>
        </div>
        <Badge color={executionEnabled ? "success" : "warning"}>{executionEnabled ? "Execution enabled" : "Execution planned"}</Badge>
      </section>

      <section className="gridTwo sectionGap">
        <Card>
          <Title3>FOIL source plan</Title3>
          <dl className="detailsList">
            <div><dt>Scenario</dt><dd>{source.scenario}</dd></div>
            <div><dt>Generator</dt><dd>{source.generator}</dd></div>
            <div><dt>Seed</dt><dd>{source.seed}</dd></div>
            <div><dt>Default samples</dt><dd>{source.scale.samples.toLocaleString()}</dd></div>
            <div><dt>Technology</dt><dd>{source.technology}</dd></div>
            <div><dt>Machine</dt><dd>{source.machineId}</dd></div>
            <div><dt>Revision</dt><dd>{source.machineRevision}</dd></div>
            <div><dt>Classification</dt><dd>{source.classification}</dd></div>
          </dl>
        </Card>

        <Card>
          <Title3>Evidence boundary</Title3>
          <dl className="detailsList">
            <div><dt>Model</dt><dd>{source.modelId}</dd></div>
            <div><dt>Sample period</dt><dd>{source.scale.samplePeriodSeconds}s</dd></div>
            <div><dt>Duration</dt><dd>{source.scale.durationSeconds}s</dd></div>
            <div><dt>90° foil phase</dt><dd>Source-backed project input</dd></div>
            <div><dt>Power</dt><dd>Synthetic proxy; not a validated power curve</dd></div>
            <div><dt>Measured data</dt><dd>No</dd></div>
          </dl>
        </Card>
      </section>

      <section className="sectionGap">
        <div className="sectionHeader">
          <div>
            <Title3>Canonical pipeline</Title3>
            <Text className="muted">Airflow orchestrates. Polars transforms. DuckDB executes analytical SQL. MotherDuck/DuckLake owns durable Bronze/Silver/Gold analytical state.</Text>
          </div>
        </div>

        <div className="factoryLanes">
          <div>
            <Text size={200} weight="semibold" className="architectureLaneLabel">Core data engineering → durable Gold</Text>
            <StageLane stages={coreDataFactoryStages} />
          </div>
          <div>
            <Text size={200} weight="semibold" className="architectureLaneLabel">Optional ML enrichment</Text>
            <StageLane stages={mlDataFactoryStages} />
          </div>
        </div>
      </section>

      <section className="gridTwo sectionGap">
        <Card>
          <Title3>Durable output</Title3>
          <Text>
            The synthetic source emits {source.output.format}; the canonical analytical destination is {source.output.destination}.
          </Text>
          <div className="factoryZoneRow">
            {source.output.durableZones.map((zone) => <Badge key={zone} color="success">{zone}</Badge>)}
          </div>
          <Text size={200} className="muted">
            These zones must remain available when the Oracle VM is stopped or rebuilt.
          </Text>
        </Card>

        <Card>
          <Title3>Serving scope</Title3>
          <div className="architectureList">
            <div><Badge color="success">In scope</Badge><Text>Publish stable Gold tables and table contracts</Text></div>
            <div><Badge color="success">In scope</Badge><Text>Expose lineage, freshness, quality and ML run metadata</Text></div>
            <div><Badge color="informative">Consumer</Badge><Text>Power BI / SQL / notebooks read Gold</Text></div>
            <div><Badge color="subtle">Out of scope</Badge><Text>Business React dashboards</Text></div>
          </div>
        </Card>
      </section>
    </>
  );
}
