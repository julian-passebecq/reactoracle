import type { Health, Overview } from "./types";

export type RuntimeMode = "mock" | "live";

export function derivePlatformHealth(
  overview: Overview,
  agentConnected: boolean | undefined,
  mode: RuntimeMode,
): Health {
  if (mode === "mock") return "idle";
  if (agentConnected !== true) return "offline";

  const memoryPercent = overview.vm.memoryGb > 0
    ? (overview.vm.memoryUsedGb / overview.vm.memoryGb) * 100
    : 0;

  if (
    overview.vm.cpuPercent >= 95 ||
    memoryPercent >= 90 ||
    overview.vm.diskPercent >= 85 ||
    overview.namespaces.some((item) => item.podsReady < item.podsTotal)
  ) {
    return "warning";
  }

  return "healthy";
}

export function healthIssues(overview: Overview): string[] {
  const issues: string[] = [];
  const memoryPercent = overview.vm.memoryGb > 0
    ? (overview.vm.memoryUsedGb / overview.vm.memoryGb) * 100
    : 0;

  if (overview.vm.cpuPercent >= 95) issues.push("Host CPU is above 95%");
  if (memoryPercent >= 90) issues.push("Host memory is above 90%");
  if (overview.vm.diskPercent >= 85) issues.push("Root disk is above 85%");
  if (overview.vm.swapUsedGb >= 1) issues.push("More than 1 GB of swap is in use");

  for (const namespace of overview.namespaces) {
    if (namespace.podsReady < namespace.podsTotal) {
      issues.push(namespace.name + " has unready pods");
    }
  }

  return issues;
}
