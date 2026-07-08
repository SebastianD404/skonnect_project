"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ApprovalModalGatekeepProps {
  isProfileApproved: boolean;
  isProfileLoading: boolean;
  registration: any | null;
}

/**
 * ApprovalModalGatekeep: ULTRA-AGGRESSIVE ZERO-FLICKER COMPONENT
 * 
 * Five Hard Gates (render-time checks that return null immediately):
 * 1. Synchronous localStorage check FIRST - prevents any JSX if dismissed
 * 2. Hydration/mount check
 * 3. Profile loading check
 * 4. Approval status check
 * 5. Registration data check
 * 
 * NO JSX is rendered until ALL gates pass.
 */
export default function ApprovalModalGatekeep({
  isProfileApproved,
  isProfileLoading,
  registration,
}: ApprovalModalGatekeepProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const urlCleanedRef = useRef(false);

  // === GATE-0: SYNCHRONOUS CHECK ===
  // Read localStorage at render time (before JSX) - FIRST GATE
  const userHasAlreadyDismissedModal = typeof window !== "undefined" 
    ? !!localStorage.getItem("kk-approval-modal-shown-v2")
    : true; // Default to true (safe) on server

  // Query parameter cleanup
  useEffect(() => {
    if (typeof window !== "undefined" && !urlCleanedRef.current) {
      const params = new URLSearchParams(searchParams);
      if (params.has("showApprovalModal") || params.has("modal") || params.has("approved")) {
        console.log("🧹 Cleaning modal trigger query parameters");
        params.delete("showApprovalModal");
        params.delete("modal");
        params.delete("approved");
        const newSearch = params.toString();
        const newUrl = newSearch ? `?${newSearch}` : window.location.pathname;
        router.replace(newUrl);
      }
      urlCleanedRef.current = true;
    }
  }, [router, searchParams]);

  // Mount guard
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ============================================
  // === FIVE HARD GATES (render-time checks) ===
  // ============================================

  // GATE-0: User has already dismissed modal (FIRST CHECK)
  if (userHasAlreadyDismissedModal) {
    console.log("⛔ [GATE-0] Already dismissed - NO JSX");
    return null;
  }

  // GATE-1: Component not mounted on client yet
  if (!isMounted) {
    console.log("⛔ [GATE-1] Not mounted - NO JSX");
    return null;
  }

  // GATE-2: Profile data still loading from API
  if (isProfileLoading) {
    console.log("⛔ [GATE-2] Profile loading - NO JSX");
    return null;
  }

  // GATE-3: User not approved
  if (!isProfileApproved) {
    console.log("⛔ [GATE-3] Not approved - NO JSX");
    return null;
  }

  // GATE-4: Registration data missing
  if (!registration) {
    console.log("⛔ [GATE-4] No registration - NO JSX");
    return null;
  }

  // ============================================
  // === ALL GATES PASSED - RENDER MODAL ===
  // ============================================
  console.log("✅ ALL GATES PASSED - Rendering modal");

  // Set dismissed flag so this never renders again
  if (typeof window !== "undefined") {
    localStorage.setItem("kk-approval-modal-shown-v2", "true");
  }

  // === RENDER MODAL JSX ===
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="relative w-full max-w-xl rounded-[2rem] border border-emerald-200 bg-white p-8 shadow-2xl">
        <div className="flex items-start justify-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-8 w-8 text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <h2 className="mt-6 text-center text-2xl font-bold text-slate-950">Congratulations!</h2>
        <p className="mt-4 text-center text-sm leading-7 text-slate-600">
          Your KK Profiling registration has been approved by Barangay Pico staff. You can now apply for the SKEAP scholarship and register for community events.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              router.push("/");
            }}
            className="inline-flex justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Go to Homepage
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.setItem("kk-approval-modal-shown-v2", "true");
              }
              router.refresh();
            }}
            className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
