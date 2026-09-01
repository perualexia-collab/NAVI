import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api.js";
import { LogoFull } from "../components/ui/Logo.js";
import { WaveBackground } from "../components/ui/WaveBackground.js";
import { Icon } from "../components/ui/icons.js";

/**
 * Page d'activation de compte — retours Phase C.5, §3. Accessible sans
 * authentification (le jeton dans l'URL en tient lieu) : un admin a créé
 * le compte depuis Paramètres → Utilisateurs et transmis ce lien
 * manuellement (pas d'envoi d'e-mail automatique branché pour l'instant).
 */
export function ActivateAccount() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.getInvite(token!),
    enabled: Boolean(token),
    retry: false
  });

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      await api.activateInvite(token!, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'activer le compte.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-parchment px-4 pb-16 pt-10">
      <div className="relative z-10 mb-5">
        <LogoFull className="h-32" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-card border border-graphite/10 bg-linen p-8 shadow-sm">
        {inviteQuery.isLoading && <p className="text-center text-sm text-graphite-soft">Vérification du lien…</p>}

        {inviteQuery.isError && (
          <div className="text-center">
            <h1 className="text-xl">Lien invalide</h1>
            <p className="mt-2 text-sm text-graphite-soft">
              Ce lien d'activation est invalide, a déjà été utilisé, ou a expiré. Demande à ton administrateur d'en
              générer un nouveau.
            </p>
            <Link to="/login" className="mt-4 inline-block text-sm text-terracotta hover:underline">
              Retour à la connexion
            </Link>
          </div>
        )}

        {inviteQuery.data && !done && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl">Bienvenue {inviteQuery.data.name.split(" ")[0]}</h1>
              <p className="mt-1 text-sm text-graphite-soft">Définis ton mot de passe pour activer ton compte NAVI ({inviteQuery.data.email}).</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm text-graphite">
                Mot de passe
                <div className="flex items-center gap-2 rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 focus-within:border-terracotta">
                  <Icon.Lock className="text-graphite-faint" width={16} height={16} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1 text-sm text-graphite">
                Confirmer le mot de passe
                <div className="flex items-center gap-2 rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 focus-within:border-terracotta">
                  <Icon.Lock className="text-graphite-faint" width={16} height={16} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </label>

              <p className="text-xs text-graphite-faint">Au moins 8 caractères.</p>

              {error && <p className="text-sm text-alert">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Activation…" : "Activer mon compte"}
              </button>
            </form>
          </>
        )}

        {done && (
          <div className="text-center">
            <h1 className="text-xl">Compte activé</h1>
            <p className="mt-2 text-sm text-graphite-soft">Ton mot de passe est défini. Tu peux maintenant te connecter à NAVI.</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-4 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Aller à la connexion
            </button>
          </div>
        )}
      </div>

      <WaveBackground className="pointer-events-none absolute bottom-0 left-0 z-0 h-64 w-full" />
    </div>
  );
}
