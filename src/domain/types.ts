export type Health = "healthy" | "idle" | "warning" | "offline";

export type VmSummary = {
  id: string;
  name: string;
  provider: "oci";
  shape: string;
  ocpu: number;
  memoryGb: number;
  cpuPercent: number;
  memoryUsedGb: number;
  diskPercent: number;
  uptime: string;
  projectedCost: string;
  k3sVersion: string;
  swapUsedGb: number;
  load1: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkRxMbps: number;
  networkTxMbps: number;
};

export type ServiceSummary = {
  id: string;
  name: string;
  category: "platform" | "data" | "monitoring" | "external";
  status: Health;
  detail: string;
  memoryMb?: number;
};

export type Workload = {
  id: string;
  name: string;
  namespace: string;
  kind: "Deployment" | "StatefulSet" | "DaemonSet" | "Job";
  status: "Running" | "Pending" | "Failed" | "Complete";
  cpuMillicores: number;
  memoryMb: number;
  restarts: number;
};

export type NamespaceSummary = {
  name: string;
  podsReady: number;
  podsTotal: number;
  cpuMillicores: number;
  memoryMb: number;
};

export type TofuRun = {
  id: string;
  action: "PLAN" | "APPLY" | "VALIDATE";
  status: "success" | "failed" | "running";
  summary: string;
  duration: string;
  when: string;
};

export type InfrastructureSummary = {
  state: "synced" | "drift" | "unknown";
  managedResources: number;
  lastPlan: string;
  drift: string;
  publicIp: string;
  bootVolumeGb: number;
  vcn: string;
  subnet: string;
  tofuRuns: TofuRun[];
};

export type MaintenanceSummary = {
  os: string;
  kernel: string;
  updatesAvailable: number;
  securityUpdates: number;
  rebootRequired: boolean;
  unusedImagesGb: number;
  prometheusGb: number;
  lokiGb: number;
  lastBackup: string;
  backupStatus: "success" | "failed" | "unknown";
};

export type ActivityEvent = {
  id: string;
  when: string;
  actor: string;
  action: string;
  status: "success" | "warning" | "failed";
};

export type Overview = {
  vm: VmSummary;
  services: ServiceSummary[];
  workloads: Workload[];
  namespaces: NamespaceSummary[];
  infrastructure: InfrastructureSummary;
  maintenance: MaintenanceSummary;
  activity: ActivityEvent[];
};

export type AgentHeartbeat = {
  agentVersion: string;
  machineId: string;
  status: Health;
  k3sReachable: boolean;
  sentAt: string;
};

export type AgentStatus = {
  connected: boolean;
  lastHeartbeat: AgentHeartbeat | null;
  lastSnapshotAt: string | null;
};

export type CommandName = "vm.health_check" | "k8s.logs" | "k8s.restart_workload";

export type CommandArgument = string | number | boolean;

export type CommandRun = {
  id: string;
  machineId: string;
  command: CommandName;
  arguments: Record<string, CommandArgument>;
  status: "queued" | "running" | "success" | "failed";
  risk: "safe" | "moderate";
  createdAt: string;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
};


export type LogQueryInput = {
  machineId: string;
  namespace: string;
  name: string;
  kind: Workload["kind"];
  tail: number;
};

export type LogQueryResult = {
  namespace: string;
  workload: string;
  kind: Workload["kind"];
  tail: number;
  lineCount: number;
  text: string;
  truncated: boolean;
  collectedAt: string;
};


export type RestartWorkloadInput = {
  machineId: string;
  namespace: string;
  name: string;
  kind: Exclude<Workload["kind"], "Job">;
};


export type Capabilities = {
  restartWorkload: boolean;
};
