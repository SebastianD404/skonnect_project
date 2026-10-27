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
      const data = response.ok ? await response.json() : null;
      const profile = data?.user ?? null;

      if (requestId !== refreshRequestRef.current) return;

      if (profile) {
        setUser(profile);
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }

      const authUser = session?.user;
      setUser(
        authUser
          ? {
              id: authUser.id,
              email: authUser.email,
              fullName:
                authUser.user_metadata.full_name ??
                authUser.user_metadata.name ??
                undefined,
              avatarUrl:
                authUser.user_metadata.avatar_url ??
                authUser.user_metadata.avatarUrl ??
                undefined,
            }
          : null,
      );
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
