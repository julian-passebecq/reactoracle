import { Badge, Card, Text, Title2, Title3 } from "@fluentui/react-components";
import { PageHeader } from "../components/PageHeader";
import { contosoPlan, coreDataFactoryStages, mlDataFactoryStages, type DataFactoryStage, type DataFactoryStageState } from "../data/dataFactory";

const stageColor: Record<DataFactoryStageState, "success" | "warning" | "informative"> = {
  live: "success",
  planned: "warning",
  external: "informative",
};

function StageLane({ stages }: { stages: DataFactoryStage[] }) {
  return (
    <div className="factoryPipeline">
      {stages.map((stage, index) => (
        <div className="factoryStageWrap" key={stage.id}>
          <Card className="factoryStageCard">
            <div className="cardTop">
              <Text weight="semibold">{stage.name}</Text>
              <Badge color={stageColor[stage.state]}>{stage.state}</Badge>
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
  return (
    <>
      <PageHeader
        title="Data Factory"
        subtitle="V1 architecture contract for optional Contoso generation → durable Gold, with ML as a separate enrichment branch"
      />

      <section className="factoryNotice">
        <div>
          <Text size={200} weight="semibold">V1 boundary</Text>
          <Title2>Designed now. Executed later.</Title2>
          <Text className="muted">
            The generator is optional and does not block normal Oracle/Airflow/Spark work. V2 will add the headless C# execution path.
          </Text>
        </div>
        <Badge color="warning">Execution planned</Badge>
      </section>

      <section className="gridTwo sectionGap">
        <Card>
          <Title3>Contoso source plan</Title3>
          <dl className="detailsList">
            <div><dt>Scenario</dt><dd>{contosoPlan.scenario}</dd></div>
            <div><dt>Generator</dt><dd>{contosoPlan.generator}</dd></div>
            <div><dt>Seed</dt><dd>{contosoPlan.seed}</dd></div>
            <div><dt>Orders</dt><dd>{contosoPlan.scale.orders.toLocaleString()}</dd></div>
            <div><dt>Customers</dt><dd>{contosoPlan.scale.customers.toLocaleString()}</dd></div>
            <div><dt>Products</dt><dd>{contosoPlan.scale.products.toLocaleString()}</dd></div>
            <div><dt>Stores</dt><dd>{contosoPlan.scale.stores}</dd></div>
            <div><dt>Time span</dt><dd>{contosoPlan.scale.days} days</dd></div>
          </dl>
        </Card>

        <Card>
          <Title3>Known ML signal</Title3>
          <dl className="detailsList">
            <div><dt>Profile</dt><dd>{contosoPlan.ml.profile}</dd></div>
            <div><dt>Target</dt><dd>{contosoPlan.ml.target}</dd></div>
            <div><dt>Primary signal</dt><dd>{contosoPlan.ml.primarySignal}</dd></div>
            <div><dt>Positive rate</dt><dd>{Math.round(contosoPlan.ml.positiveOutcomeRate * 100)}%</dd></div>
            <div><dt>Signal strength</dt><dd>{Math.round(contosoPlan.ml.signalStrength * 100)}%</dd></div>
            <div><dt>Noise</dt><dd>{Math.round(contosoPlan.ml.noiseLevel * 100)}%</dd></div>
          </dl>
        </Card>
      </section>

      <section className="sectionGap">
        <div className="sectionHeader">
          <div>
            <Title3>Canonical pipeline</Title3>
            <Text className="muted">Gold is complete before ML. Oracle performs compute; MotherDuck / DuckLake owns durable analytical state.</Text>
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
            Contoso emits {contosoPlan.output.format}; the canonical destination is {contosoPlan.output.destination}.
          </Text>
          <div className="factoryZoneRow">
            {contosoPlan.output.durableZones.map((zone) => <Badge key={zone} color="success">{zone}</Badge>)}
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
