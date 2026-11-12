"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton({ showLabel = false }: { showLabel?: boolean }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        router.push("/login");
      } else {
        console.error("Sign out failed", response.status);
      }
    } catch (error) {
      console.error("Sign out error", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={
        showLabel
          ? "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          : "rounded-full p-2 text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      }
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
      {showLabel ? <span>{isSigningOut ? "Signing out..." : "Sign out"}</span> : null}
    </button>
  );
}
