import { Link } from "react-router-dom";

export type NavKey =
  | "live"
  | "assets"
  | "alarms"
  | "work-orders"
  | "history"
  | "kpi"
  | "twin"
  | "wall"
  | "settings";

const ITEMS: { key: NavKey; to: string; label: string }[] = [
  { key: "live", to: "/live", label: "Live panel" },
  { key: "assets", to: "/assets", label: "Assets" },
  { key: "alarms", to: "/alarms", label: "Alarms" },
  { key: "work-orders", to: "/work-orders", label: "Work orders" },
  { key: "history", to: "/history", label: "History" },
  { key: "kpi", to: "/kpi", label: "KPI" },
  { key: "twin", to: "/twin", label: "Twin" },
  { key: "wall", to: "/wall", label: "Wall" },
  { key: "settings", to: "/settings", label: "Settings" },
];

export function PrimaryNav({
  ns,
  current,
  activeCount = 0,
}: {
  ns: string;
  current: NavKey;
  activeCount?: number;
}) {
  return (
    <nav
      className={`${ns}-nav`}
      aria-label="Primary"
      style={{ flexWrap: "wrap", justifyContent: "flex-end" }}
    >
      {ITEMS.map((item) => {
        const badge =
          item.key === "alarms" && activeCount > 0 ? (
            <span
              className={`${ns}-nav-badge`}
              aria-label={`${activeCount} active`}
            >
              {activeCount}
            </span>
          ) : null;
        if (item.key === current) {
          return (
            <span
              key={item.key}
              className={`${ns}-nav-current`}
              aria-current="page"
            >
              {item.label}
              {badge}
            </span>
          );
        }
        return (
          <Link
            key={item.key}
            to={item.to}
            className={item.key === "alarms" ? `${ns}-nav-alarms` : undefined}
          >
            {item.label}
            {badge}
          </Link>
        );
      })}
    </nav>
  );
}
