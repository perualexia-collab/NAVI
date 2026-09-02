import type { User } from "@navi/shared";
import type { RealHotel, RealHotelHealth, RealPortfolio, RealScanPeriod, RealUser, RealAutomationStatus } from "./real-hotel-types.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    // N'envoyer Content-Type: application/json que s'il y a vraiment un
    // corps JSON — sinon Fastify tente de parser un corps vide comme JSON
    // et rejette la requête en 400 (cassait /auth/logout, retours Phase
    // C.5 : la session n'était alors jamais invalidée côté serveur).
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? "Une erreur est survenue.");
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<User>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),

  listRealHotels: () => request<RealHotel[]>("/hotels"),
  createHotel: (name: string) => request<RealHotel>("/hotels", { method: "POST", body: JSON.stringify({ name }) }),
  getHotelHealth: (hotelId: string) => request<RealHotelHealth>(`/hotels/${hotelId}/health`),
  launchScan: (hotelId: string, period: RealScanPeriod) =>
    request<{ scanId: string; scanHotelId: string; status: string }>(`/hotels/${hotelId}/scans`, {
      method: "POST",
      body: JSON.stringify({ period })
    }),
  computeAudience: (hotelId: string, recommendationId: string) =>
    request<{ audienceResultId: string; audienceDefinitionId: string; recipients: number; measuredAt: string }>(
      `/hotels/${hotelId}/recommendations/${recommendationId}/compute-audience`,
      { method: "POST" }
    ),
  compareOpportunities: (hotelId: string, recommendationId: string) =>
    request<{ comparisonId: string }>(`/hotels/${hotelId}/recommendations/${recommendationId}/compare-opportunities`, { method: "POST" }),
  compareAudiences: (hotelId: string, recommendationId: string) =>
    request<{ blocked: boolean; automationStatus: RealAutomationStatus; comparisonId: string | null }>(
      `/hotels/${hotelId}/recommendations/${recommendationId}/compare-audiences`,
      { method: "POST" }
    ),
  chooseAudienceComparisonResult: (hotelId: string, comparisonId: string, resultId: string) =>
    request<{ comparisonId: string; chosenResultId: string }>(`/hotels/${hotelId}/audience-comparisons/${comparisonId}/choose`, {
      method: "POST",
      body: JSON.stringify({ resultId })
    }),

  listPortfolios: () => request<RealPortfolio[]>("/portfolios"),
  createPortfolio: (name: string, hotelIds: string[]) =>
    request<RealPortfolio>("/portfolios", { method: "POST", body: JSON.stringify({ name, hotelIds }) }),
  updatePortfolio: (portfolioId: string, input: { name?: string; hotelIds?: string[] }) =>
    request<RealPortfolio>(`/portfolios/${portfolioId}`, { method: "PATCH", body: JSON.stringify(input) }),
  deletePortfolio: (portfolioId: string) => request<{ ok: true }>(`/portfolios/${portfolioId}`, { method: "DELETE" }),
  launchPortfolioScan: (portfolioId: string, period: RealScanPeriod) =>
    request<{ scanId: string; scanHotelIds: string[] }>(`/portfolios/${portfolioId}/scans`, {
      method: "POST",
      body: JSON.stringify({ period })
    }),

  listUsers: () => request<RealUser[]>("/users"),
  createUser: (input: { firstName: string; lastName: string; email: string; role: "ADMIN" | "USER" }) =>
    request<{ user: RealUser; activationToken: string }>("/users", { method: "POST", body: JSON.stringify(input) }),
  disableUser: (id: string) => request<RealUser>(`/users/${id}/disable`, { method: "POST" }),
  reactivateUser: (id: string) => request<RealUser>(`/users/${id}/reactivate`, { method: "POST" }),
  resendInvite: (id: string) => request<{ activationToken: string }>(`/users/${id}/resend-invite`, { method: "POST" }),

  getInvite: (token: string) => request<{ email: string; name: string }>(`/invites/${token}`),
  activateInvite: (token: string, password: string) =>
    request<{ ok: true }>(`/invites/${token}/activate`, { method: "POST", body: JSON.stringify({ password }) })
};
