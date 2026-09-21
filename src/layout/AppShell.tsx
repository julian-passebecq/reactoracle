import { Divider, Text } from "@fluentui/react-components";
import { Apps24Regular, Cloud24Regular, DataUsage24Regular, DocumentBulletList24Regular, History24Regular, Pulse24Regular, Server24Regular, Settings24Regular, Wrench24Regular } from "@fluentui/react-icons";
import { NavLink, Outlet } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { useAgentStatus } from "../api/queries";
import { runtimeConfig } from "../config";

const nav = [
  { to: "/", label: "Overview", icon: <Pulse24Regular />, end: true },
  { to: "/architecture", label: "Architecture", icon: <Cloud24Regular /> },
  { to: "/topology", label: "Topology", icon: <Server24Regular /> },
  { to: "/infrastructure", label: "Infrastructure", icon: <Cloud24Regular /> },
  { to: "/kubernetes", label: "Kubernetes", icon: <Apps24Regular /> },
  { to: "/data-platform", label: "Data Platform", icon: <DataUsage24Regular /> },
  { to: "/monitoring", label: "Monitoring", icon: <Server24Regular /> },
  { to: "/logs", label: "Logs", icon: <DocumentBulletList24Regular /> },
  { to: "/maintenance", label: "Maintenance", icon: <Wrench24Regular /> },
  { to: "/activity", label: "Activity", icon: <History24Regular /> },
  { to: "/settings", label: "Settings", icon: <Settings24Regular /> },
];

export function AppShell() {
  const agent = useAgentStatus();
  const controlHealth = runtimeConfig.mode === "mock" ? "idle" : agent.data?.connected ? "healthy" : "offline";
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">RO</div><div><Text weight="semibold">ReactOracle</Text><div className="muted small">Oracle data lab</div></div></div>
      <Divider />
      <nav aria-label="Primary navigation">{nav.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => "navItem " + (isActive ? "active" : "")}>{item.icon}<span>{item.label}</span></NavLink>)}</nav>
      <div className="sidebarFooter"><StatusBadge status={controlHealth} /><Text size={200}>{runtimeConfig.mode} control plane</Text></div>
    </aside>
    <main className="content"><Outlet /></main>
  </div>;
}
