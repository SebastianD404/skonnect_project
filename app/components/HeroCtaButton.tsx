import Link from "next/link";

export default function HeroCtaButton({ hasApplication }: { hasApplication: boolean }) {
  return (
    <Link
      href={hasApplication ? "/applications" : "/programs/skeap-scholarship"}
      className="group inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] px-6 text-center font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95 md:w-auto"
    >
      {hasApplication ? "Manage Applications" : "Discover SKEAP"}
      <span className="group-hover:translate-x-1 transition-transform">→</span>
    </Link>
  );
}
