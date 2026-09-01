import { useState } from "react";
import { Card } from "../components/ui/Card.js";
import { Icon } from "../components/ui/icons.js";
import { mockAdminHotels, mockUsers } from "../mock/settings.js";

const EXPERIENCE_STATUS_LABEL = {
  ACTIVE: "Actif",
  TO_VERIFY: "À vérifier",
  NOT_FOUND: "Non trouvé",
  ERROR: "Erreur"
} as const;

const EXPERIENCE_STATUS_STYLE = {
  ACTIVE: "bg-sage-soft text-sage-ink",
  TO_VERIFY: "bg-warn-soft text-warn-ink",
  NOT_FOUND: "bg-linen-deep text-graphite-faint",
  ERROR: "bg-alert-soft text-alert-ink"
} as const;

const TABS = ["Hôtels", "Utilisateurs"] as const;

export function Settings() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Hôtels");

  return (
    <div>
      <h1 className="text-2xl">Paramètres</h1>
      <p className="mt-1 text-sm text-graphite-soft">Gestion des hôtels connectés à Expérience et des utilisateurs NAVI.</p>

      <div className="mt-6 flex gap-1 border-b border-graphite/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm ${tab === t ? "border-terracotta font-medium text-terracotta" : "border-transparent text-graphite-soft hover:text-graphite"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "Hôtels" ? <HotelsAdmin /> : <UsersAdmin />}
      </div>
    </div>
  );
}

function HotelsAdmin() {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-graphite-soft">
          Un hôtel n'est actif que si sa connexion a été validée dans Expérience (brief §24) — la seule saisie d'un nom ne suffit pas.
        </p>
        <button className="flex shrink-0 items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          <Icon.Plus width={16} height={16} /> Ajouter un hôtel
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/10 text-left text-[11px] uppercase tracking-wide text-graphite-faint">
            <th className="pb-2 font-medium">Hôtel NAVI</th>
            <th className="pb-2 font-medium">Libellé Expérience</th>
            <th className="pb-2 font-medium">Statut</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {mockAdminHotels.map((hotel) => (
            <tr key={hotel.id} className="border-b border-graphite/5 last:border-0">
              <td className="py-2.5 font-medium">{hotel.name}</td>
              <td className="text-graphite-soft">{hotel.experienceLabel}</td>
              <td>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXPERIENCE_STATUS_STYLE[hotel.experienceStatus]}`}>
                  {EXPERIENCE_STATUS_LABEL[hotel.experienceStatus]}
                </span>
              </td>
              <td className="text-right">
                <button className="rounded-lg border border-graphite/15 px-3 py-1 text-xs text-graphite-soft hover:border-terracotta hover:text-terracotta">
                  Tester la connexion
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function UsersAdmin() {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-graphite-soft">Pas d'inscription publique — les comptes sont créés depuis cet écran (brief §7).</p>
        <button className="flex shrink-0 items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          <Icon.Plus width={16} height={16} /> Ajouter un utilisateur
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/10 text-left text-[11px] uppercase tracking-wide text-graphite-faint">
            <th className="pb-2 font-medium">Nom</th>
            <th className="pb-2 font-medium">E-mail</th>
            <th className="pb-2 font-medium">Rôle</th>
            <th className="pb-2 font-medium">Statut</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {mockUsers.map((user) => (
            <tr key={user.id} className="border-b border-graphite/5 last:border-0">
              <td className="py-2.5 font-medium">{user.name}</td>
              <td className="text-graphite-soft">{user.email}</td>
              <td>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.role === "ADMIN" ? "bg-terracotta-soft text-terracotta-ink" : "bg-linen-deep text-graphite-soft"}`}>
                  {user.role === "ADMIN" ? "Admin" : "Utilisateur"}
                </span>
              </td>
              <td>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? "bg-sage-soft text-sage-ink" : "bg-linen-deep text-graphite-faint"}`}>
                  {user.active ? "Actif" : "Désactivé"}
                </span>
              </td>
              <td className="text-right">
                <button className="rounded-lg border border-graphite/15 px-3 py-1 text-xs text-graphite-soft hover:border-terracotta hover:text-terracotta">
                  {user.active ? "Désactiver" : "Réactiver"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
