export type UserRole = "superadmin" | "admin" | "vendor";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  plant: string;
  category: string | null;
  department_id: number | null;
  is_active: boolean;
}
