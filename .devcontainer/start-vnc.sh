#!/usr/bin/env bash
# Démarre Xvfb + x11vnc + noVNC pour rendre visible, depuis le navigateur,
# un Chromium Playwright lancé en mode "headed" (headless: false) — utile
# une seule fois pour la connexion Expérience + 2FA manuelle
# (backend/experience/login.ts). Idempotent : ne relance rien de déjà
# actif, sûr à appeler à chaque démarrage du Codespace.
#
# Ces trois processus sont indépendants de toute connexion noVNC : fermer
# l'onglet du navigateur ferme seulement le client noVNC (websockify), pas
# Xvfb, ni x11vnc (lancé avec -forever), ni le Chromium qui tourne dessus
# — un scan en cours n'est donc jamais interrompu par ça.
set -uo pipefail

DISPLAY_NUM=":99"
VNC_PORT=5900
NOVNC_PORT=6080

if ! pgrep -f "Xvfb ${DISPLAY_NUM} " > /dev/null; then
  echo "→ Démarrage de Xvfb sur ${DISPLAY_NUM}..."
  nohup Xvfb "${DISPLAY_NUM}" -screen 0 1440x900x24 > /tmp/xvfb.log 2>&1 &
  sleep 1
fi

if ! pgrep -f "x11vnc.*-display ${DISPLAY_NUM}" > /dev/null; then
  echo "→ Démarrage de x11vnc sur le port ${VNC_PORT}..."
  # -nopw : le port n'est de toute façon accessible qu'à travers le
  # forwarding de ports Codespaces, déjà authentifié par GitHub côté
  # utilisateur (comme les ports 4000/5173) — pas de couche de mot de
  # passe VNC supplémentaire à gérer.
  nohup x11vnc -display "${DISPLAY_NUM}" -forever -shared -nopw -rfbport "${VNC_PORT}" -quiet > /tmp/x11vnc.log 2>&1 &
  sleep 1
fi

if ! pgrep -f "websockify.*${NOVNC_PORT}" > /dev/null; then
  echo "→ Démarrage de noVNC sur le port ${NOVNC_PORT}..."
  nohup websockify --web=/usr/share/novnc "${NOVNC_PORT}" "localhost:${VNC_PORT}" > /tmp/novnc.log 2>&1 &
  sleep 1
fi

echo "✅ Navigateur distant prêt — onglet PORTS → ${NOVNC_PORT} → ouvrir /vnc.html"
