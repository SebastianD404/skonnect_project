import Link from "next/link";

export default function HeroCtaButton({ hasApplication }: { hasApplication: boolean }) {
  return (
    <Link
      href={hasApplication ? "/applications" : "/programs/skeap-scholarship"}
      className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white font-bold rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 min-w-[220px]"
    >
      {hasApplication ? "Manage Applications" : "Discover SKEAP"}
      <span className="group-hover:translate-x-1 transition-transform">→</span>
    </Link>
  );
}
