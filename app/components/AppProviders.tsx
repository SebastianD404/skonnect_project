"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, type AuthUser } from "./AuthProvider";
import { ChatWidget } from "./chatbot/ChatWidget";
import { HeaderShell } from "./HeaderShell";
import { NotificationProvider } from "./NotificationProvider";
import SkeapApplyToastViewport from "./SkeapApplyToastViewport";

const INACTIVE_GRANTEE_STATUSES = new Set(["REMOVED", "REVOKED", "GRADUATED"]);

export function AppProviders({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const pathname = usePathname();
  const isCaptiveOnboarding = pathname === "/programs/kk-profiling";
  const isRevokedDashboard =
    pathname.startsWith("/grantee-dashboard") &&
    (INACTIVE_GRANTEE_STATUSES.has(initialUser?.skeapStatus ?? "") || initialUser?.role !== "GRANTEE");

  if (isRevokedDashboard) {
    return <>{children}</>;
  }

  return (
    <AuthProvider initialUser={initialUser}>
      <NotificationProvider>
        <HeaderShell />
        {children}
        <SkeapApplyToastViewport />
        {isCaptiveOnboarding ? null : <ChatWidget />}
      </NotificationProvider>
    </AuthProvider>
  );
}
