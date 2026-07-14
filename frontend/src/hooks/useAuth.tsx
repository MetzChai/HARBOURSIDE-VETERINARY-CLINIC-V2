"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { authClient, db } from "@/lib/db-client";

type Role = "admin" | "owner" | null;

interface AuthUser {
  id: string;
  email: string;
  user_metadata?: { full_name?: string };
}

interface Session {
  user: AuthUser;
  access_token?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (uid: string) => {
    const { data, error } = await db.from("user_roles").select("role").eq("user_id", uid);
    if (error) {
      setRole(null);
      return;
    }
    const roles = ((data as { role: string }[]) ?? []).map((r) => r.role);
    setRole(roles.includes("admin") ? "admin" : roles.includes("owner") ? "owner" : null);
  }, []);

  const loadSession = useCallback(async () => {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) {
      setSession(null);
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }
    const json = await res.json();
    if (json.session?.user) {
      setSession(json.session);
      setUser(json.session.user);
      setRole(json.role ?? null);
      if (!json.role) await fetchRole(json.session.user.id);
    } else {
      setSession(null);
      setUser(null);
      setRole(null);
    }
    setLoading(false);
  }, [fetchRole]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const refreshSession = loadSession;

  const signOut = async () => {
    await authClient.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
