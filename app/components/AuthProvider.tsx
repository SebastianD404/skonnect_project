"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";

type AuthUser = {
  id?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  role?: "YOUTH" | "GRANTEE" | "SK_OFFICIAL" | "SUPER_ADMIN";
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const refreshRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    if (!hasLoadedRef.current) {
      setLoading(true);
    }

    try {
      const browserSupabase = createBrowserClient();
      const { data: { user: authUser } } = await browserSupabase.auth.getUser();
      const response = await fetch("/api/session", { cache: "no-store" });
      const data = response.ok ? await response.json() : null;
      const profile = data?.user ?? null;

      if (requestId !== refreshRequestRef.current) return;

      if (profile) {
        setUser({ ...profile, id: profile.id ?? authUser?.id, email: profile.email ?? authUser?.email ?? undefined });
      } else {
        setUser(null);
      }
    } catch {
      if (requestId !== refreshRequestRef.current) return;
      setUser(null);
    } finally {
      if (requestId === refreshRequestRef.current) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);

    const handleProfileUpdate = () => void refresh();
    window.addEventListener("skonnect-profile-updated", handleProfileUpdate);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("skonnect-profile-updated", handleProfileUpdate);
    };
  }, [refresh]);

  const value = useMemo(() => ({ user, loading, refresh }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
