import type { InfrastructureSummary, MaintenanceSummary, Overview, Workload } from "../domain/types";
import { overviewMock } from "../data/mock";

const delay = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ControlPlaneClient {
  getOverview(): Promise<Overview>;
  getWorkloads(): Promise<Workload[]>;
  getInfrastructure(): Promise<InfrastructureSummary>;
  getMaintenance(): Promise<MaintenanceSummary>;
}

class MockControlPlaneClient implements ControlPlaneClient {
  async getOverview() {
    await delay();
    return overviewMock;
  }

  async getWorkloads() {
    await delay();
    return overviewMock.workloads;
  }

  async getInfrastructure() {
    await delay();
    return overviewMock.infrastructure;
  }

  async getMaintenance() {
    await delay();
    return overviewMock.maintenance;
  }
}

export const controlPlane = new MockControlPlaneClient();
