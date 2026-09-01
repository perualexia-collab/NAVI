import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth-context.js";

const NAV_ITEMS = [
  { to: "/", label: "Accueil", end: true },
  { to: "/portefeuilles", label: "Mes portefeuilles" },
  { to: "/crm-health", label: "CRM Health" },
  { to: "/ask-navi", label: "Ask NAVI" },
  { to: "/parametres", label: "Paramètres" }
];

/**
 * Ossature de navigation NAVI — brief §2 (navigation principale validée).
 * Fidélité complète aux mockups (motif de vagues, densité des cards…)
 * reportée à la Phase B ; cette étape établit seulement une navigation
 * réelle et fonctionnelle entre les 5 sections.
 */
export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col justify-between border-r border-graphite/10 bg-linen p-5">
        <div>
          <div className="mb-8 px-1">
            <div className="font-display text-lg font-semibold tracking-wide">NAVI</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-graphite-soft">
              Navigate. Analyze. Act.
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
          <div className="flex items-center justify-between rounded-lg border border-graphite/10 px-3 py-2">
            <div>
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-graphite-faint">{user.role === "ADMIN" ? "Admin" : "Utilisateur"}</div>
            </div>
            <button onClick={() => void logout()} className="text-xs text-graphite-soft hover:text-terracotta">
              Déconnexion
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 bg-parchment p-8">
        <Outlet />
      </main>
    </div>
  );
}
