import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "./authStorage";

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = getSession();

  // 如果session失效，主动调转到login页面
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
