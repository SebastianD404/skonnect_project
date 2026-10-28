import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { HeaderShell } from "./components/HeaderShell";
import { ChatWidget } from "./components/chatbot/ChatWidget";
import { NotificationProvider } from "./components/NotificationProvider";
import { AuthProvider } from "./components/AuthProvider";
import {
  createClient,
  isAuthSessionMissingError,
  isRefreshTokenMissingError,
} from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

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
      <body
        className={`${fraunces.variable} ${inter.variable} font-sans antialiased`}
      >
        <AuthProvider initialUser={initialAuthUser}>
          <NotificationProvider>
            <HeaderShell />
            {children}
          </NotificationProvider>
        </AuthProvider>
        <ChatWidget />
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

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    avatarUrl: profile.avatarUrl ?? undefined,
    role: profile.role,
  };
}