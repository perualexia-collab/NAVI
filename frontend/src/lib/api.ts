import type { User } from "@navi/shared";
import type { RealHotel, RealHotelHealth, ScanPeriodValue } from "./real-hotel-types.js";

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
  getHotelHealth: (hotelId: string) => request<RealHotelHealth>(`/hotels/${hotelId}/health`),
  launchScan: (hotelId: string, periodValue: ScanPeriodValue) =>
    request<{ scanId: string; scanHotelId: string; status: string }>(`/hotels/${hotelId}/scans`, {
      method: "POST",
      body: JSON.stringify({ period: { mode: "preset", value: periodValue } })
    })
};
