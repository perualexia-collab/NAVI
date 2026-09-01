import type { Config } from "tailwindcss";

/**
 * Design tokens NAVI — brief §33 (Design System).
 *
 * Valeurs approximées depuis les mockups fournis (Login, Accueil, Mes
 * portefeuilles, CRM Health, Ask NAVI) — aucune charte graphique séparée
 * n'a encore été transmise avec des valeurs hex exactes. À ajuster dès
 * réception des assets de marque définitifs (cf. NAVI Architecture
 * Proposal §11, logos en attente).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "#f4eee1", // fond principal
          soft: "#faf6ec"
        },
        linen: {
          DEFAULT: "#fbf8f1", // fond des cards
          deep: "#eee5d3"
        },
        graphite: {
          DEFAULT: "#2b2a25", // texte principal
          soft: "#6e6858",
          faint: "#948d78"
        },
        terracotta: {
          DEFAULT: "#be5e2e", // accent primaire — CTA, alertes
          soft: "#efdbc9",
          ink: "#7a3c19"
        },
        sage: {
          DEFAULT: "#5c7455", // accent secondaire — positif, réutilisable
          soft: "#dee6d3",
          ink: "#3a4a35"
        },
        horizon: {
          DEFAULT: "#5f7ea3", // accent tertiaire — info, liens
          soft: "#dbe4ed",
          ink: "#33455a"
        },
        alert: { DEFAULT: "#a13a2b", soft: "#f1d3c9" },
        warn: { DEFAULT: "#a97620", soft: "#f1e1bd" }
      },
      fontFamily: {
        display: ["Poppins", "Inter", "sans-serif"], // titres — brief §33
        sans: ["Inter", "sans-serif"] // corps / interface
      },
      borderRadius: {
        card: "14px"
      }
    }
  },
  plugins: []
} satisfies Config;
