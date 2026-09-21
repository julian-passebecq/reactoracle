import type { AgentStatus, InfrastructureSummary, MaintenanceSummary, Overview, Workload } from "../domain/types";
import { overviewMock } from "../data/mock";
import { runtimeConfig } from "../config";

const delay = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ControlPlaneClient {
  getOverview(): Promise<Overview>;
  getWorkloads(): Promise<Workload[]>;
  getInfrastructure(): Promise<InfrastructureSummary>;
  getMaintenance(): Promise<MaintenanceSummary>;
  getAgentStatus(): Promise<AgentStatus>;
}

class MockControlPlaneClient implements ControlPlaneClient {
  async getOverview() { await delay(); return overviewMock; }
  async getWorkloads() { await delay(); return overviewMock.workloads; }
  async getInfrastructure() { await delay(); return overviewMock.infrastructure; }
  async getMaintenance() { await delay(); return overviewMock.maintenance; }
  async getAgentStatus() { await delay(); return { connected: false, lastHeartbeat: null, lastSnapshotAt: null }; }
}

class HttpControlPlaneClient implements ControlPlaneClient {
  constructor(private readonly baseUrl: string) {}

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Control API request failed: " + response.status + " " + response.statusText);
    return response.json() as Promise<T>;
  }

  getOverview() { return this.get<Overview>("/api/v1/overview"); }
  getWorkloads() { return this.get<Workload[]>("/api/v1/k8s/workloads"); }
  getInfrastructure() { return this.get<InfrastructureSummary>("/api/v1/infrastructure"); }
  getMaintenance() { return this.get<MaintenanceSummary>("/api/v1/maintenance"); }
  getAgentStatus() { return this.get<AgentStatus>("/api/v1/agent/status"); }
}

export const controlPlane: ControlPlaneClient = runtimeConfig.mode === "live"
  ? new HttpControlPlaneClient(runtimeConfig.controlApiBaseUrl)
  : new MockControlPlaneClient();
