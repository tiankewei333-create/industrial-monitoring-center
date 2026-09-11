import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "./authStorage";

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = getSession();

  // Redirect to login when no local session is present.
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
