import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../lib/auth-context.js";
import { LogoFull } from "../components/ui/Logo.js";
import { WaveBackground } from "../components/ui/WaveBackground.js";
import { Icon } from "../components/ui/icons.js";

/**
 * Login — brief §7, mockup validé. Email + mot de passe + mot de passe
 * oublié + "se souvenir de moi" uniquement. Pas d'inscription publique,
 * pas de bouton SSO (retiré du périmètre — Architecture Proposal §11.5).
 */
export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
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
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-parchment px-4 pb-16 pt-10">
      <div className="relative z-10 mb-5">
        <LogoFull className="h-44" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-card border border-graphite/10 bg-linen p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl">Connexion</h1>
          <p className="mt-1 text-sm text-graphite-soft">Bienvenue sur NAVI</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-graphite">
            Adresse e-mail
            <div className="flex items-center gap-2 rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 focus-within:border-terracotta">
              <Icon.Mail className="text-graphite-faint" width={16} height={16} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@exemple.com"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm text-graphite">
            Mot de passe
            <div className="flex items-center gap-2 rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 focus-within:border-terracotta">
              <Icon.Lock className="text-graphite-faint" width={16} height={16} />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-xs text-graphite-faint hover:text-graphite"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                <Icon.Eye width={16} height={16} />
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-graphite-soft">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-graphite/30"
              />
              Se souvenir de moi
            </label>
            <a href="#" className="text-terracotta hover:underline">
              Mot de passe oublié ?
            </a>
          </div>

          {error && <p className="text-sm text-alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-graphite-faint">
          Besoin d'aide ? <a href="#" className="text-terracotta hover:underline">Contactez votre administrateur.</a>
        </p>
      </div>

      <WaveBackground className="pointer-events-none absolute bottom-0 left-0 z-0 h-64 w-full" />
    </div>
  );
}
