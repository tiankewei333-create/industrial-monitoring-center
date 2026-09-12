import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AlarmsPage } from "./pages/AlarmsPage/AlarmsPage";
import { AssetsPage } from "./pages/AssetsPage/AssetsPage";
import { HistoryPage } from "./pages/HistoryPage/HistoryPage";
import { LivePanelPage } from "./pages/LivePanel/LivePanelPage";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { KpiPage } from "./pages/KpiPage/KpiPage";
import { WorkOrdersPage } from "./pages/WorkOrdersPage/WorkOrdersPage";
import { TwinPage } from "./pages/TwinPage/TwinPage";
import { WallPage } from "./pages/WallPage/WallPage";
import { SettingsPage } from "./pages/SettingsPage/SettingsPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/live"
        element={
          <RequireAuth>
            <LivePanelPage />
          </RequireAuth>
        }
      />
      <Route
        path="/assets"
        element={
          <RequireAuth>
            <AssetsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/alarms"
        element={
          <RequireAuth>
            <AlarmsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/work-orders"
        element={
          <RequireAuth>
            <WorkOrdersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/kpi"
        element={
          <RequireAuth>
            <KpiPage />
          </RequireAuth>
        }
      />
      <Route
        path="/twin"
        element={
          <RequireAuth>
            <TwinPage />
          </RequireAuth>
        }
      />
      <Route
        path="/wall"
        element={
          <RequireAuth>
            <WallPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to="/live" replace />} />
      <Route path="*" element={<Navigate to="/live" replace />} />
    </Routes>
  );
}
