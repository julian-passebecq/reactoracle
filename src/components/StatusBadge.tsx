import { Badge } from "@fluentui/react-components";
import type { Health } from "../domain/types";

type Props = { status: Health | "success" | "failed" | "running" | "synced" | "drift" | "unknown" };

export function StatusBadge({ status }: Props) {
  const color = status === "warning" || status === "drift" || status === "unknown"
    ? "warning"
    : status === "offline" || status === "failed"
      ? "danger"
      : "success";
  const appearance = status === "healthy" || status === "success" || status === "synced" ? "filled" : "outline";
  return <Badge appearance={appearance} color={color}>{status}</Badge>;
}
