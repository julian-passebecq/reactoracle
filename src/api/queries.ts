import { useMutation, useQuery } from "@tanstack/react-query";
import type { LogQueryInput } from "../domain/types";
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
