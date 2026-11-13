"use client";

import { usePathname } from "next/navigation";
import { PublicHeader } from "./PublicHeader";
import { useAuth } from "./AuthProvider";

const hiddenPaths = [
  "/login",
  "/signup",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/programs/kk-profiling",
];

export function HeaderShell() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isOnboardingProtectedPath = [
    "/applications",
    "/inquiries",
    "/profile",
    "/settings",
    "/youth-dashboard",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (
    (user?.role === "YOUTH" && user.kkStatus === "UNPROFILED" && isOnboardingProtectedPath) ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/system-admin") ||
    pathname === "/grantee" ||
    pathname.startsWith("/grantee/") ||
    pathname.startsWith("/youth-dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    hiddenPaths.includes(pathname)
  ) {
    return null;
  }

  return <PublicHeader />;
}
