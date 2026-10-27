"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();
  const pathname = usePathname();
  const hasLoadedRef = useRef(initialUser !== undefined);
  const refreshRequestRef = useRef(0);
  const previousPathnameRef = useRef(pathname);

  const refresh = useCallback(async (showLoading = false) => {
    const requestId = ++refreshRequestRef.current;
    if (!hasLoadedRef.current || showLoading) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to refresh the authenticated profile (${response.status}).`);
      }
      const data = await response.json();
      const profile = data?.user ?? null;

      if (requestId !== refreshRequestRef.current) return;

      if (profile) {
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (error) {
      if (requestId === refreshRequestRef.current) {
        console.error("Failed to refresh the authenticated profile:", error);
      }
    } finally {
      if (requestId === refreshRequestRef.current) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      if (!hasLoadedRef.current) {
        void refresh();
      }
    }, 0);

    const handleProfileUpdate = () => void refresh();
    window.addEventListener("skonnect-profile-updated", handleProfileUpdate);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("skonnect-profile-updated", handleProfileUpdate);
    };
  }, [refresh]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
      }
      router.refresh();
      void refresh();
    });

    return () => subscription.unsubscribe();
  }, [refresh, router, supabase]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (previousPathname === "/login" && pathname !== "/login") {
      void refresh(true);
      router.refresh();
    }
  }, [pathname, refresh, router]);

  const value = useMemo(() => ({ user, loading, refresh }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
