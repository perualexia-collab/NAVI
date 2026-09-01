export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  active: boolean;
}

export const mockUsers: MockUser[] = [
  { id: "u-1", name: "Alexia V.", email: "alexia@navi.app", role: "ADMIN", active: true },
  { id: "u-2", name: "Marc Dubreuil", email: "marc.dubreuil@navi.app", role: "USER", active: true },
  { id: "u-3", name: "Sophie Nguyen", email: "sophie.nguyen@navi.app", role: "USER", active: true },
  { id: "u-4", name: "Karim Haddad", email: "karim.haddad@navi.app", role: "USER", active: false }
];

export interface MockAdminHotel {
  id: string;
  name: string;
  experienceLabel: string;
  experienceStatus: "ACTIVE" | "TO_VERIFY" | "NOT_FOUND" | "ERROR";
}

export const mockAdminHotels: MockAdminHotel[] = [
  { id: "h-galileo", name: "Hôtel Galileo", experienceLabel: "Hôtel Galileo", experienceStatus: "ACTIVE" },
  { id: "h-louis-ii", name: "Hôtel Louis II", experienceLabel: "Hôtel Louis II", experienceStatus: "ACTIVE" },
  { id: "h-majestic", name: "Hôtel Majestic", experienceLabel: "Hôtel Majestic", experienceStatus: "ACTIVE" },
  { id: "h-delavigne", name: "Hôtel Delavigne", experienceLabel: "Hôtel Delavigne", experienceStatus: "ACTIVE" },
  { id: "h-excelsior", name: "Hôtel Excelsior Opéra", experienceLabel: "Hotel Excelsior Opera", experienceStatus: "TO_VERIFY" }
];
