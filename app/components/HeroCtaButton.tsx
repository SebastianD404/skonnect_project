"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HeroCtaButton() {
  const [status, setStatus] = useState<"loading" | "logged-out" | "view" | "dashboard">("loading");
  const [applicationId, setApplicationId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (!data?.user) {
          setStatus("logged-out");
          return;
        }

        fetch("/api/my/inquiries?skeapOnly=1")
          .then((r) => r.json())
          .then((result) => {
            if (!mounted) return;
            const latest = result.inquiries?.[0];
            if (latest) {
              setApplicationId(latest.id);
              setStatus("view");
            } else {
              setStatus("dashboard");
            }
          })
          .catch(() => {
            if (mounted) setStatus("dashboard");
          });
      })
      .catch(() => {
        if (mounted) setStatus("logged-out");
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-[#0F3D5C] text-white font-bold opacity-80">
        Loading...
      </div>
    );
  }

  if (status === "view" && applicationId) {
    return (
      <Link
        href={`/applications/${applicationId}`}
        className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white font-bold rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
      >
        View application
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </Link>
    );
  }

  return (
    <Link
      href="/programs/skeap-scholarship"
      className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white font-bold rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
    >
      Apply for SKEAP
      <span className="group-hover:translate-x-1 transition-transform">→</span>
    </Link>
  );
}
