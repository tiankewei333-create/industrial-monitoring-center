import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { LivePanelPage } from "./pages/LivePanel/LivePanelPage";
import { LoginPage } from "./pages/LoginPage/LoginPage";

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
      <Route path="/" element={<Navigate to="/live" replace />} />
      <Route path="*" element={<Navigate to="/live" replace />} />
    </Routes>
  );
}
