import { useMutation, useQuery } from "@tanstack/react-query";
import type { LogQueryInput, RestartWorkloadInput } from "../domain/types";
import { controlPlane } from "./controlPlane";

export function useOverview() {
  return useQuery({ queryKey: ["overview"], queryFn: () => controlPlane.getOverview(), staleTime: 15_000 });
}

export function useWorkloads() {
  return useQuery({ queryKey: ["workloads"], queryFn: () => controlPlane.getWorkloads(), staleTime: 15_000 });
}

export function useInfrastructure() {
  return useQuery({ queryKey: ["infrastructure"], queryFn: () => controlPlane.getInfrastructure(), staleTime: 30_000 });
}

export function useMaintenance() {
  return useQuery({ queryKey: ["maintenance"], queryFn: () => controlPlane.getMaintenance(), staleTime: 30_000 });
}

export function useAgentStatus() {
  return useQuery({ queryKey: ["agent-status"], queryFn: () => controlPlane.getAgentStatus(), refetchInterval: 15_000 });
}

export function useHealthCheckMutation() {
  return useMutation({
    mutationFn: (machineId: string) => controlPlane.runHealthCheck(machineId),
  });
}

export function useCommandStatus(commandId: string | null) {
  return useQuery({
    queryKey: ["command", commandId],
    queryFn: () => controlPlane.getCommand(commandId!),
    enabled: commandId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "success" || status === "failed" ? false : 1500;
    },
  });
}

export function useRecentCommands() {
  return useQuery({
    queryKey: ["commands", "recent"],
    queryFn: () => controlPlane.getRecentCommands(),
    refetchInterval: 5000,
  });
}


export function useLogQueryMutation() {
  return useMutation({
    mutationFn: (input: LogQueryInput) => controlPlane.runLogQuery(input),
  });
}


export function useRestartWorkloadMutation() {
  return useMutation({
    mutationFn: (input: RestartWorkloadInput) => controlPlane.restartWorkload(input),
  });
}


export function useCapabilities() {
  return useQuery({
    queryKey: ["capabilities"],
    queryFn: () => controlPlane.getCapabilities(),
    staleTime: 30_000,
  });
}


export function usePlatformArchitecture() {
  return useQuery({
    queryKey: ["platform-architecture"],
    queryFn: () => controlPlane.getPlatformArchitecture(),
    staleTime: 300_000,
  });
}

export function useGoldCatalog() {
  return useQuery({
    queryKey: ["gold-catalog"],
    queryFn: () => controlPlane.getGoldCatalog(),
    staleTime: 300_000,
  });
}


export function useProviderInventory() {
  return useQuery({
    queryKey: ["provider-inventory"],
    queryFn: () => controlPlane.getProviderInventory(),
    staleTime: 300_000,
  });
}
