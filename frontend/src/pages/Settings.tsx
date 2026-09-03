import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/ui/Card.js";
import { Modal } from "../components/ui/Modal.js";
import { Icon } from "../components/ui/icons.js";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../lib/auth-context.js";
import type { RealUser, UserStatus } from "../lib/real-hotel-types.js";

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

const USER_STATUS_LABEL: Record<UserStatus, string> = {
  PENDING: "Invitation en attente",
  ACTIVE: "Actif",
  DISABLED: "Désactivé"
};

const USER_STATUS_STYLE: Record<UserStatus, string> = {
  PENDING: "bg-warn-soft text-warn-ink",
  ACTIVE: "bg-sage-soft text-sage-ink",
  DISABLED: "bg-linen-deep text-graphite-faint"
};

const ALL_TABS = ["Hôtels", "Utilisateurs"] as const;

export function Settings() {
  const { user } = useAuth();
  // Gestion des utilisateurs réservée aux admins (brief §7, retours Phase
  // C.5) — le backend refuse déjà ces routes à un compte USER, mais ne pas
  // même proposer l'onglet évite l'incompréhension d'un bouton qui échoue.
  const tabs = user?.role === "ADMIN" ? ALL_TABS : ["Hôtels" as const];
  const [tab, setTab] = useState<(typeof ALL_TABS)[number]>("Hôtels");

  return (
    <div>
      <h1 className="text-2xl">Paramètres</h1>
      <p className="mt-1 text-sm text-graphite-soft">Gestion des hôtels connectés à Expérience et des utilisateurs NAVI.</p>

      <div className="mt-6 flex gap-1 border-b border-graphite/10">
        {tabs.map((t) => (
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
        {tab === "Hôtels" || user?.role !== "ADMIN" ? <HotelsAdmin /> : <UsersAdmin />}
      </div>
    </div>
  );
}

function HotelsAdmin() {
  const queryClient = useQueryClient();
  const hotelsQuery = useQuery({ queryKey: ["hotels"], queryFn: api.listRealHotels });
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (hotelName: string) => api.createHotel(hotelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
      setName("");
      setModalOpen(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Impossible d'ajouter cet hôtel.")
  });

  // Suppression réelle (Phase F6) : l'hôtel disparaît complètement, y
  // compris de CRM Health — son historique de scans/audiences part avec
  // lui (cascade en base), pas de désactivation de secours.
  const [deletingHotelId, setDeletingHotelId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (hotelId: string) => api.deleteHotel(hotelId),
    onMutate: (hotelId: string) => setDeletingHotelId(hotelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotels"] }),
    onSettled: () => setDeletingHotelId(null)
  });

  function handleDelete(hotelId: string, hotelName: string) {
    if (window.confirm(`Supprimer définitivement l'hôtel "${hotelName}" ? Son historique de scans et d'audiences sera supprimé avec lui, sans retour en arrière possible.`)) {
      deleteMutation.mutate(hotelId);
    }
  }

  // "Tester la connexion" — vérifie que l'hôtel est bien retrouvable dans
  // Expérience sous son libellé (même primitive que le début d'un scan).
  const [testingHotelId, setTestingHotelId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ hotelId: string; hotelName: string; status: "ACTIVE" | "NOT_FOUND" | "ERROR"; message: string } | null>(null);
  const testConnectionMutation = useMutation({
    mutationFn: (hotelId: string) => api.testHotelConnection(hotelId),
    onMutate: (hotelId: string) => {
      setTestingHotelId(hotelId);
      setTestResult(null);
    },
    onSuccess: (result, hotelId) => {
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
      const hotelName = hotelsQuery.data?.find((h) => h.id === hotelId)?.name ?? "";
      setTestResult({ hotelId, hotelName, status: result.status, message: result.message });
    },
    onError: (err, hotelId) => {
      const hotelName = hotelsQuery.data?.find((h) => h.id === hotelId)?.name ?? "";
      setTestResult({ hotelId, hotelName, status: "ERROR", message: err instanceof ApiError ? err.message : "Le test de connexion a échoué." });
    },
    onSettled: () => setTestingHotelId(null)
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Icon.Plus width={16} height={16} /> Ajouter un hôtel
        </button>
      </div>

      {hotelsQuery.isLoading && <p className="text-sm text-graphite-faint">Chargement…</p>}
      {hotelsQuery.isError && <p className="text-sm text-alert">Impossible de charger la liste des hôtels.</p>}
      {testResult && (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-sm ${
            testResult.status === "ACTIVE" ? "bg-sage-soft text-sage-ink" : "bg-alert-soft text-alert-ink"
          }`}
        >
          {testResult.status === "ACTIVE" ? "✓" : "✕"} {testResult.hotelName} — {testResult.message}
        </p>
      )}

      {hotelsQuery.data && (
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
            {hotelsQuery.data.map((hotel) => (
              <tr key={hotel.id} className="border-b border-graphite/5 last:border-0">
                <td className="py-2.5 font-medium">{hotel.name}</td>
                <td className="text-graphite-soft">{hotel.experienceLabel}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXPERIENCE_STATUS_STYLE[hotel.experienceStatus]}`}>
                    {EXPERIENCE_STATUS_LABEL[hotel.experienceStatus]}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => testConnectionMutation.mutate(hotel.id)}
                      disabled={testingHotelId !== null}
                      className="rounded-lg border border-graphite/15 px-3 py-1 text-xs text-graphite-soft hover:border-terracotta hover:text-terracotta disabled:opacity-50"
                    >
                      {testingHotelId === hotel.id ? "Test en cours…" : "Tester la connexion"}
                    </button>
                    <button
                      onClick={() => handleDelete(hotel.id, hotel.name)}
                      disabled={deletingHotelId === hotel.id}
                      className="rounded-lg border border-graphite/15 px-3 py-1 text-xs text-alert hover:border-alert disabled:opacity-50"
                    >
                      {deletingHotelId === hotel.id ? "…" : "Supprimer"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal
          title="Ajouter un hôtel"
          onClose={() => {
            setModalOpen(false);
            setError(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate(name.trim());
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1 text-sm text-graphite">
              Nom de l'hôtel (NAVI)
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Hôtel Excelsior Opéra"
                className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
              />
            </label>

            <div className="flex items-start gap-2 rounded-lg bg-horizon-soft px-3 py-2 text-xs text-horizon-ink">
              <Icon.Info width={14} height={14} className="mt-0.5 shrink-0" />
              <span>
                L'hôtel est créé avec le statut « À vérifier ». La vérification automatique dans Expérience (recherche
                par nom normalisé, sans correspondance approximative) n'est pas encore implémentée — elle se fera via
                Playwright dans une prochaine passe.
              </span>
            </div>

            {error && <p className="text-sm text-alert">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-graphite-soft hover:bg-linen-deep">
                Annuler
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {createMutation.isPending ? "Ajout…" : "Ajouter l'hôtel"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

function UsersAdmin() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: api.listUsers });

  const [modalOpen, setModalOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [createError, setCreateError] = useState<string | null>(null);
  const [activationLink, setActivationLink] = useState<string | null>(null);

  function buildLink(token: string) {
    return `${window.location.origin}/activate/${token}`;
  }

  const createMutation = useMutation({
    mutationFn: () => api.createUser({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), role }),
    onSuccess: ({ activationToken }) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFirstName("");
      setLastName("");
      setEmail("");
      setRole("USER");
      setCreateError(null);
      setModalOpen(false);
      setActivationLink(buildLink(activationToken));
    },
    onError: (err) => setCreateError(err instanceof ApiError ? err.message : "Impossible de créer cet utilisateur.")
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => api.disableUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] })
  });
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.reactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] })
  });
  const resendMutation = useMutation({
    mutationFn: (id: string) => api.resendInvite(id),
    onSuccess: ({ activationToken }) => setActivationLink(buildLink(activationToken))
  });

  // Suppression définitive tentée d'abord (compte jamais utilisé) ; si des
  // portefeuilles/scans y sont déjà rattachés, désactivé à la place plutôt
  // que de perdre cet historique (même filet de sécurité que côté backend).
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onMutate: () => setDeleteMessage(null),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteMessage(result.deleted ? "Utilisateur supprimé." : "Ce compte a déjà créé des portefeuilles ou lancé des scans — suppression définitive impossible, il a été désactivé à la place.");
    }
  });

  function handleCopyLink(id: string) {
    // Régénérer invalide le lien précédent (usage unique) — confirmer pour
    // éviter qu'un admin ne rende invalide, sans s'en rendre compte, un
    // lien déjà transmis en cliquant une seconde fois.
    if (window.confirm("Générer un nouveau lien invalidera le précédent s'il existe déjà. Continuer ?")) {
      resendMutation.mutate(id);
    }
  }

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Supprimer l'utilisateur "${name}" ? S'il a déjà créé des portefeuilles ou lancé des scans, il sera désactivé plutôt que supprimé.`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-graphite-soft">Pas d'inscription publique — les comptes sont créés depuis cet écran (brief §7).</p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Icon.Plus width={16} height={16} /> Ajouter un utilisateur
        </button>
      </div>

      {usersQuery.isLoading && <p className="text-sm text-graphite-faint">Chargement…</p>}
      {usersQuery.isError && <p className="text-sm text-alert">Impossible de charger la liste des utilisateurs.</p>}
      {deleteMessage && <p className="mb-3 text-sm text-graphite-soft">{deleteMessage}</p>}

      {usersQuery.data && (
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
            {usersQuery.data.map((u) => (
              <tr key={u.id} className="border-b border-graphite/5 last:border-0">
                <td className="py-2.5 font-medium">{u.name}</td>
                <td className="text-graphite-soft">{u.email}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "ADMIN" ? "bg-terracotta-soft text-terracotta-ink" : "bg-linen-deep text-graphite-soft"}`}>
                    {u.role === "ADMIN" ? "Admin" : "Utilisateur"}
                  </span>
                </td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${USER_STATUS_STYLE[u.status]}`}>{USER_STATUS_LABEL[u.status]}</span>
                </td>
                <td className="text-right">
                  <UserRowAction
                    user={u}
                    isSelf={u.id === currentUser?.id}
                    onDisable={() => disableMutation.mutate(u.id)}
                    onReactivate={() => reactivateMutation.mutate(u.id)}
                    onCopyLink={() => handleCopyLink(u.id)}
                    onDelete={() => handleDelete(u.id, u.name)}
                    pending={disableMutation.isPending || reactivateMutation.isPending || resendMutation.isPending || deleteMutation.isPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal
          title="Ajouter un utilisateur"
          onClose={() => {
            setModalOpen(false);
            setCreateError(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (firstName.trim() && lastName.trim() && email.trim()) createMutation.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-graphite">
                Prénom
                <input
                  autoFocus
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-graphite">
                Nom
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-graphite">
              Adresse e-mail
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@exemple.com"
                className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-graphite">
              Rôle
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}
                className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>

            <div className="flex items-start gap-2 rounded-lg bg-horizon-soft px-3 py-2 text-xs text-horizon-ink">
              <Icon.Info width={14} height={14} className="mt-0.5 shrink-0" />
              <span>
                L'utilisateur ne choisit pas de mot de passe ici : un lien d'activation à usage unique sera généré,
                à copier et transmettre toi-même (aucun envoi d'e-mail automatique n'est encore branché).
              </span>
            </div>

            {createError && <p className="text-sm text-alert">{createError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-graphite-soft hover:bg-linen-deep">
                Annuler
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {createMutation.isPending ? "Création…" : "Ajouter l'utilisateur"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {activationLink && <ActivationLinkModal link={activationLink} onClose={() => setActivationLink(null)} />}
    </Card>
  );
}

function UserRowAction({
  user,
  isSelf,
  onDisable,
  onReactivate,
  onCopyLink,
  onDelete,
  pending
}: {
  user: RealUser;
  isSelf: boolean;
  onDisable: () => void;
  onReactivate: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const baseClass = "rounded-lg border border-graphite/15 px-3 py-1 text-xs text-graphite-soft hover:border-terracotta hover:text-terracotta disabled:opacity-50";
  const deleteClass = "rounded-lg border border-graphite/15 px-3 py-1 text-xs text-alert hover:border-alert disabled:opacity-50";

  if (isSelf) return <span className="text-xs text-graphite-faint">Compte actuel</span>;

  const deleteButton = (
    <button onClick={onDelete} disabled={pending} className={deleteClass}>
      Supprimer
    </button>
  );

  if (user.status === "PENDING") {
    return (
      <div className="flex justify-end gap-2">
        <button onClick={onCopyLink} disabled={pending} className={baseClass}>
          Copier le lien
        </button>
        {deleteButton}
      </div>
    );
  }
  if (user.status === "ACTIVE") {
    return (
      <div className="flex justify-end gap-2">
        <button onClick={onDisable} disabled={pending} className={baseClass}>
          Désactiver
        </button>
        {deleteButton}
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onReactivate} disabled={pending} className={baseClass}>
        Réactiver
      </button>
      {deleteButton}
    </div>
  );
}

function ActivationLinkModal({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sélectionné dès l'affichage — un simple Ctrl/Cmd+C fonctionne toujours,
  // même si l'API Clipboard est indisponible (contexte non sécurisé,
  // permission refusée — fréquent dans un aperçu Codespaces).
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
      inputRef.current?.select();
    }
  }

  return (
    <Modal title="Lien d'activation" onClose={onClose}>
      <p className="mb-3 text-sm text-graphite-soft">
        Transmets ce lien à l'utilisateur pour qu'il définisse son mot de passe. Il est à usage unique et expire dans
        7 jours.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2">
        <input
          ref={inputRef}
          readOnly
          value={link}
          className="w-full bg-transparent text-sm outline-none"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={() => void copy()}
          className="shrink-0 rounded-lg bg-terracotta px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>
      {copyError && (
        <p className="mt-2 text-xs text-alert">
          Impossible de copier automatiquement — le texte ci-dessus est sélectionné, copie-le à la main (Ctrl/Cmd+C).
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-graphite-soft hover:bg-linen-deep">
          Fermer
        </button>
      </div>
    </Modal>
  );
}
