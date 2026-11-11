import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./components/AppProviders";
import {
  createClient,
  isAuthSessionMissingError,
  isRefreshTokenMissingError,
} from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcileApprovedSkeapGrantee } from "@/lib/reconcile-approved-skeap-grantee";

export const metadata: Metadata = {
  title: "SKonnect — SK Barangay Pico Youth Services",
  description:
    "Scholarship tracking, event registration, and a multilingual helpdesk for the youth of Barangay Pico, La Trinidad, Benguet.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialAuthUser = await getInitialAuthUser();

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="font-sans antialiased">
        <AppProviders initialUser={initialAuthUser}>{children}</AppProviders>
      </body>
    </html>
  );
}

async function getInitialAuthUser() {
  const supabase = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    if (isRefreshTokenMissingError(sessionError)) {
      return null;
    }
    throw sessionError;
  }

  if (!session) {
    return null;
  }

  let authUser;
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    authUser = user;
  } catch (error) {
    if (isAuthSessionMissingError(error) || isRefreshTokenMissingError(error)) {
      return null;
    }

    throw error;
  }

  if (!authUser) return null;

  const profile = await ensureProfile(authUser);
  if (!profile) {
    return null;
  }

  const isApprovedGrantee = await reconcileApprovedSkeapGrantee(profile.id, profile.role);
  const grantee = await prisma.grantee.findUnique({
    where: { userId: profile.id },
    select: { status: true },
  });

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    avatarUrl: profile.avatarUrl ?? undefined,
    role: isApprovedGrantee ? "GRANTEE" : profile.role,
    skeapStatus: grantee?.status ?? null,
  };
}