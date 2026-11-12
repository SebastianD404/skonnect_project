import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export default function HeroCtaButton({
  hasApplication,
  locked = false,
}: {
  hasApplication: boolean;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <button
        type="button"
        disabled
        title="Complete and receive approval for KK Profiling to unlock SKEAP applications."
        aria-label="SKEAP applications locked until KK Profiling is approved"
        className="inline-flex h-12 w-[232px] cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-slate-300 px-6 font-bold text-slate-600 shadow-sm"
      >
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        SKEAP locked
      </button>
    );
  }

  return (
    <Link
      href={hasApplication ? "/applications" : "/programs/skeap-scholarship"}
      className="group inline-flex h-12 w-[232px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] px-6 text-white font-bold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
    >
      {hasApplication ? "Manage Applications" : "Discover SKEAP"}
      <span className="group-hover:translate-x-1 transition-transform">→</span>
    </Link>
  );
}
