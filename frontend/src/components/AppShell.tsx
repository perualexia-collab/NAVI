import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth-context.js";
import { LogoMark } from "./ui/Logo.js";
import { WaveBackground } from "./ui/WaveBackground.js";

const NAV_ITEMS = [
  { to: "/", label: "Accueil", end: true },
  { to: "/portefeuilles", label: "Mes portefeuilles" },
  { to: "/crm-health", label: "CRM Health" },
  { to: "/ask-navi", label: "Ask NAVI" },
  { to: "/parametres", label: "Paramètres" }
];

/** Ossature de navigation NAVI — brief §2 (navigation principale validée). */
export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="relative flex w-60 flex-col justify-between overflow-hidden border-r border-graphite/10 bg-linen p-5">
        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-2 px-1">
            <LogoMark size={26} />
            <div>
              <div className="font-display text-base font-semibold tracking-wide leading-none">NAVI</div>
              <div className="text-[8px] uppercase tracking-[0.18em] text-graphite-faint">Navigate. Analyze. Act.</div>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${
                    isActive ? "bg-terracotta-soft text-terracotta-ink font-medium" : "text-graphite-soft hover:bg-linen-deep"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {user && (
          <div className="relative z-10 flex items-center justify-between rounded-lg border border-graphite/10 bg-parchment/70 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sage text-xs font-medium text-white">
                {user.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="text-sm font-medium leading-tight">{user.name}</div>
                <div className="text-xs text-graphite-faint">{user.role === "ADMIN" ? "Admin" : "Utilisateur"}</div>
              </div>
            </div>
            <button onClick={() => void logout()} className="text-xs text-graphite-soft hover:text-terracotta">
              Déconnexion
            </button>
          </div>
        )}

        <WaveBackground className="pointer-events-none absolute bottom-0 left-0 z-0 h-40 w-full opacity-40" />
      </aside>

      <main className="flex-1 bg-parchment p-8">
        <Outlet />
      </main>
    </div>
  );
}
