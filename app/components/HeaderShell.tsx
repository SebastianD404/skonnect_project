"use client";

import { usePathname } from "next/navigation";
import { PublicHeader } from "./PublicHeader";

const hiddenPaths = ["/login", "/signup", "/logout"];

export function HeaderShell() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/system-admin") ||
    pathname.startsWith("/grantee-dashboard") ||
    pathname.startsWith("/grantee") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    hiddenPaths.includes(pathname)
  ) {
    return null;
  }

  return <PublicHeader />;
}
