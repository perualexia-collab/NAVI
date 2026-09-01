import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../lib/auth-context.js";

/**
 * Login — brief §7. Email + mot de passe + mot de passe oublié uniquement.
 * Pas d'inscription publique, pas de bouton SSO (retiré du périmètre —
 * NAVI Architecture Proposal §11.5). Fidélité visuelle complète au mockup
 * reportée à la Phase B.
 */
export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
      <div className="w-full max-w-sm rounded-card border border-graphite/10 bg-linen p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="font-display text-2xl font-semibold">NAVI</div>
          <p className="mt-1 text-sm text-graphite-soft">Bienvenue sur NAVI</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Adresse e-mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre.email@exemple.com"
              className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Mot de passe
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </label>

          {error && <p className="text-sm text-alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Connexion…" : "Se connecter"}
          </button>

          <a href="#" className="text-center text-xs text-terracotta hover:underline">
            Mot de passe oublié ?
          </a>
        </form>
      </div>
    </div>
  );
}
