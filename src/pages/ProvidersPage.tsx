import { Badge, Card, Spinner, Text, Title3 } from "@fluentui/react-components";
import { useProviderInventory } from "../api/queries";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import type { ArchitectureState, ProviderInventoryItem } from "../domain/types";

const statePresentation: Record<ArchitectureState, { color: "success" | "informative" | "warning" | "subtle"; label: string }> = {
  live: { color: "success", label: "Implemented" },
  external: { color: "informative", label: "External" },
  planned: { color: "warning", label: "Planned" },
  optional: { color: "subtle", label: "Optional" },
};

const telemetryLabel: Record<ProviderInventoryItem["telemetry"], string> = {
  live: "Live telemetry",
  partial: "Partial telemetry",
  "not-connected": "Adapter not connected",
};

export function ProvidersPage() {
  const inventory = useProviderInventory();

  if (inventory.isLoading) {
    return <div className="loadingState"><Spinner label="Loading provider inventory" /></div>;
  }

  if (inventory.isError || !inventory.data) {
    return (
      <Card className="errorCard">
        <Title3>Provider inventory unavailable</Title3>
        <Text className="muted">
          {inventory.error instanceof Error ? inventory.error.message : "The control plane did not return a provider inventory."}
        </Text>
      </Card>
    );
  }

  const providers = inventory.data.providers;
  const live = providers.filter((provider) => provider.state === "live").length;
  const connected = providers.filter((provider) => provider.telemetry !== "not-connected").length;
  const planned = providers.filter((provider) => provider.state === "planned").length;
  const optional = providers.filter((provider) => provider.state === "optional").length;
  const verifiedLimits = providers.filter((provider) => provider.limitsVerified).length;

  return (
    <>
      <PageHeader
        title="Providers"
        subtitle="External services, free-tier intent and integration state without invented quota data"
      />

      <section className="metrics">
        <MetricCard label="Provider inventory" value={String(providers.length)} detail="Compute, data, ML, CI/CD and edge" />
        <MetricCard label="Live-role systems" value={String(live)} detail="Architecture lifecycle state; see Overview for runtime health" />
        <MetricCard label="Telemetry connected" value={String(connected)} detail="Live or partial adapters" />
        <MetricCard label="Planned / optional" value={String(planned + optional)} detail={planned + " planned · " + optional + " optional"} />
      </section>

      <Card className="providerPolicyCard">
        <div>
          <Title3>Quota policy</Title3>
          <Text className="muted">
            Usage percentages are hidden until ReactOracle has both a provider usage adapter and a verified current limit.
            Provider state badges describe architecture lifecycle, not runtime health. This prevents stale free-tier documentation or design intent from looking like live telemetry.
          </Text>
        </div>
        <Badge color={verifiedLimits > 0 ? "success" : "informative"}>
          {verifiedLimits} verified limit{verifiedLimits === 1 ? "" : "s"}
        </Badge>
      </Card>

      <section className="sectionGap">
        <div className="providerGrid">
          {providers.map((provider) => (
            <Card key={provider.id} className="providerCard">
              <div className="cardTop">
                <div>
                  <Title3>{provider.name}</Title3>
                  <Text size={200} className="muted">{provider.category}</Text>
                </div>
                <Badge color={statePresentation[provider.state].color}>{statePresentation[provider.state].label}</Badge>
              </div>

              <Text>{provider.role}</Text>

              <div className="providerFacts">
                <div>
                  <Text size={200} className="muted">Cost intent</Text>
                  <Text weight="semibold">{provider.costIntent}</Text>
                </div>
                <div>
                  <Text size={200} className="muted">Telemetry</Text>
                  <Text weight="semibold">{telemetryLabel[provider.telemetry]}</Text>
                </div>
                <div>
                  <Text size={200} className="muted">Limits</Text>
                  <Text weight="semibold">{provider.limitsVerified ? "Verified" : "Not verified"}</Text>
                </div>
              </div>

              <Text size={200} className="muted">{provider.detail}</Text>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
