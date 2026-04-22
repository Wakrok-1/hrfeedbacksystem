import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string, role?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; data: AuthUser }>("/api/auth/me")
      .then((res) => setUser(res.data.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string, role = "admin"): Promise<AuthUser> {
    const res = await api.post<{ success: boolean; data: AuthUser }>("/api/auth/login", {
      identifier,
      password,
      role,
    });
    setUser(res.data.data);
    return res.data.data;
  }

  async function logout() {
    await api.post("/api/auth/logout").catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
