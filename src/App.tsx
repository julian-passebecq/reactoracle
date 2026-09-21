import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ActivityPage } from "./pages/ActivityPage";
import { ArchitecturePage } from "./pages/ArchitecturePage";
import { DataPlatformPage } from "./pages/DataPlatformPage";
import { InfrastructurePage } from "./pages/InfrastructurePage";
import { KubernetesPage } from "./pages/KubernetesPage";
import { LogsPage } from "./pages/LogsPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { MonitoringPage } from "./pages/MonitoringPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TopologyPage } from "./pages/TopologyPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="topology" element={<TopologyPage />} />
        <Route path="infrastructure" element={<InfrastructurePage />} />
        <Route path="kubernetes" element={<KubernetesPage />} />
        <Route path="data-platform" element={<DataPlatformPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
