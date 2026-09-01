import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context.js";
import { LogoFull } from "./ui/Logo.js";
import { WaveBackground } from "./ui/WaveBackground.js";
import { Icon } from "./ui/icons.js";

const NAV_ITEMS = [
  { to: "/", label: "Accueil", end: true, icon: Icon.Home },
  { to: "/portefeuilles", label: "Mes portefeuilles", end: false, icon: Icon.Briefcase },
  { to: "/crm-health", label: "CRM Health", end: false, icon: Icon.HeartPulse },
  { to: "/ask-navi", label: "Ask NAVI", end: false, icon: Icon.Sparkles },
  { to: "/parametres", label: "Paramètres", end: false, icon: Icon.Settings }
];

/** Ossature de navigation NAVI — brief §2 (navigation principale validée). */
export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="relative flex w-64 flex-col overflow-hidden border-r border-graphite/10 bg-linen px-5 pb-6 pt-7">
        <div className="relative z-10 mb-7 flex justify-center">
          <LogoFull className="h-24" />
        </div>

        <nav className="relative z-10 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${
                  isActive ? "bg-terracotta-soft text-terracotta-ink font-medium" : "text-graphite-soft hover:bg-linen-deep"
                }`
              }
            >
              <item.icon width={17} height={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative z-10 mt-auto flex flex-col gap-3 pt-6">
          {user && (
            <div className="flex items-center justify-between rounded-lg border border-graphite/10 bg-parchment/70 px-3 py-2 backdrop-blur-sm">
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
              <button onClick={() => void handleLogout()} className="text-xs text-graphite-soft hover:text-terracotta">
                Déconnexion
              </button>
            </div>
          )}

          <WaveBackground className="pointer-events-none -mx-5 -mb-6 h-44 w-[calc(100%+2.5rem)]" />
        </div>
      </aside>

      <main className="flex-1 bg-parchment p-8">
        <Outlet />
      </main>
    </div>
  );
}
