import { useQuery } from "@tanstack/react-query";
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
