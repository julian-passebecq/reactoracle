import { Spinner } from "@fluentui/react-components";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { RouteErrorPage } from "./components/RouteErrorPage";

const OverviewPage = lazy(() => import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const ArchitecturePage = lazy(() => import("./pages/ArchitecturePage").then((module) => ({ default: module.ArchitecturePage })));
const TopologyPage = lazy(() => import("./pages/TopologyPage").then((module) => ({ default: module.TopologyPage })));
const InfrastructurePage = lazy(() => import("./pages/InfrastructurePage").then((module) => ({ default: module.InfrastructurePage })));
const KubernetesPage = lazy(() => import("./pages/KubernetesPage").then((module) => ({ default: module.KubernetesPage })));
const DataFactoryPage = lazy(() => import("./pages/DataFactoryPage").then((module) => ({ default: module.DataFactoryPage })));
const DataPlatformPage = lazy(() => import("./pages/DataPlatformPage").then((module) => ({ default: module.DataPlatformPage })));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage").then((module) => ({ default: module.MonitoringPage })));
const ProvidersPage = lazy(() => import("./pages/ProvidersPage").then((module) => ({ default: module.ProvidersPage })));
const LogsPage = lazy(() => import("./pages/LogsPage").then((module) => ({ default: module.LogsPage })));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage").then((module) => ({ default: module.MaintenancePage })));
const ActivityPage = lazy(() => import("./pages/ActivityPage").then((module) => ({ default: module.ActivityPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function RouteFallback() {
  return <div className="loadingState"><Spinner label="Loading workspace" /></div>;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />} errorElement={<RouteErrorPage />}>
          <Route index element={<OverviewPage />} />
          <Route path="architecture" element={<ArchitecturePage />} />
          <Route path="topology" element={<TopologyPage />} />
          <Route path="infrastructure" element={<InfrastructurePage />} />
          <Route path="kubernetes" element={<KubernetesPage />} />
          <Route path="data-factory" element={<DataFactoryPage />} />
          <Route path="data-platform" element={<DataPlatformPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
