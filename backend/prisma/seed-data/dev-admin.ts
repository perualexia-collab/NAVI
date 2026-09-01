/**
 * Compte administrateur de développement — seedé UNIQUEMENT quand
 * SEED_DEV_ADMIN=true (mis par .devcontainer/post-start.sh dans
 * GitHub Codespaces). Jamais actif par défaut, jamais destiné à un
 * environnement partagé ou de production : pas d'inscription publique
 * dans NAVI (brief §7), donc pas d'autre moyen de se connecter à un
 * Codespace fraîchement créé sans cette convenience de dev.
 */
export const devAdmin = {
  email: "admin@navi.local",
  password: "navi-codespaces-dev",
  name: "Admin (dev)"
};
