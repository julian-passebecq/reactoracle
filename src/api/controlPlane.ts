import type { AgentStatus, CommandRun, InfrastructureSummary, MaintenanceSummary, Overview, Workload } from "../domain/types";
import { overviewMock } from "../data/mock";
import { runtimeConfig } from "../config";

const delay = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ControlPlaneClient {
  getOverview(): Promise<Overview>;
  getWorkloads(): Promise<Workload[]>;
  getInfrastructure(): Promise<InfrastructureSummary>;
  getMaintenance(): Promise<MaintenanceSummary>;
  getAgentStatus(): Promise<AgentStatus>;
  runHealthCheck(machineId: string): Promise<CommandRun>;
  getCommand(commandId: string): Promise<CommandRun>;
  getRecentCommands(): Promise<CommandRun[]>;
}

class MockControlPlaneClient implements ControlPlaneClient {
  private readonly commands = new Map<string, CommandRun>();
  async getOverview() { await delay(); return overviewMock; }
  async getWorkloads() { await delay(); return overviewMock.workloads; }
  async getInfrastructure() { await delay(); return overviewMock.infrastructure; }
  async getMaintenance() { await delay(); return overviewMock.maintenance; }
  async getAgentStatus() { await delay(); return { connected: false, lastHeartbeat: null, lastSnapshotAt: null }; }

  async runHealthCheck(machineId: string) {
    await delay(120);
    const id = "mock_" + Date.now();
    const run: CommandRun = {
      id,
      machineId,
      command: "vm.health_check",
      status: "running",
      risk: "safe",
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
      error: null,
    };
    this.commands.set(id, run);
    window.setTimeout(() => {
      const current = this.commands.get(id);
      if (!current) return;
      this.commands.set(id, {
        ...current,
        status: "success",
        completedAt: new Date().toISOString(),
        result: { k3sReachable: true, workloadCount: overviewMock.workloads.length },
      });
    }, 700);
    return { ...run };
  }

  async getCommand(commandId: string) {
    await delay(80);
    const run = this.commands.get(commandId);
    if (!run) throw new Error("Mock command not found");
    return { ...run };
  }

  async getRecentCommands() {
    await delay(80);
    return Array.from(this.commands.values()).toReversed().map((run) => ({ ...run }));
  }
}

class HttpControlPlaneClient implements ControlPlaneClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error("Control API request failed: " + response.status + " " + response.statusText);
    return response.json() as Promise<T>;
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  getOverview() { return this.get<Overview>("/api/v1/overview"); }
  getWorkloads() { return this.get<Workload[]>("/api/v1/k8s/workloads"); }
  getInfrastructure() { return this.get<InfrastructureSummary>("/api/v1/infrastructure"); }
  getMaintenance() { return this.get<MaintenanceSummary>("/api/v1/maintenance"); }
  getAgentStatus() { return this.get<AgentStatus>("/api/v1/agent/status"); }
  runHealthCheck(machineId: string) {
    return this.request<CommandRun>("/api/v1/commands", {
      method: "POST",
      body: JSON.stringify({ command: "vm.health_check", machineId }),
    });
  }
  getCommand(commandId: string) {
    return this.get<CommandRun>("/api/v1/commands/" + encodeURIComponent(commandId));
  }
  getRecentCommands() {
    return this.get<CommandRun[]>("/api/v1/commands?limit=20");
  }
}

export const controlPlane: ControlPlaneClient = runtimeConfig.mode === "live"
  ? new HttpControlPlaneClient(runtimeConfig.controlApiBaseUrl)
  : new MockControlPlaneClient();
