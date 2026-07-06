import type { Metadata } from "next";
import Script from "next/script";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { HeaderShell } from "./components/HeaderShell";
import { ChatWidget } from "./components/chatbot/ChatWidget";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${fraunces.variable} ${inter.variable} font-sans antialiased`}
      >
        <Script id="theme-script" strategy="beforeInteractive">
          {`(() => {
              try {
                const savedTheme = localStorage.getItem('skonnect-theme');
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldUseDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);
                document.documentElement.classList.toggle('dark', shouldUseDark);
                document.documentElement.dataset.theme = shouldUseDark ? 'dark' : (savedTheme || 'light');
              } catch (error) {}
            })();`}
        </Script>
        <HeaderShell />
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}