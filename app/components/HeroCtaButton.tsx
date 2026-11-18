import Link from "next/link";

type HeroCtaButtonProps = {
  hasCurrentApplication?: boolean;
  isLoading?: boolean;
  isPastGrantee?: boolean;
  isEligiblePastGrantee?: boolean;
  isApplicationOpen?: boolean;
  outcome?: string | null;
  age?: number | null;
  helpdeskHref?: string;
};

const primaryClassName =
  "group inline-flex h-12 w-[232px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] px-6 text-white font-bold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95";
const secondaryClassName =
  "inline-flex h-12 w-[232px] items-center justify-center whitespace-nowrap rounded-2xl border-2 border-[#0F3D5C]/30 bg-transparent px-6 font-semibold text-[#0F3D5C] transition-all duration-300 hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2";

export default function HeroCtaButton({
  hasCurrentApplication = false,
  isLoading = false,
  isPastGrantee = false,
  isEligiblePastGrantee = false,
  isApplicationOpen = false,
  outcome = null,
  age = null,
  helpdeskHref = "/programs/skeap-scholarship",
}: HeroCtaButtonProps) {
  if (isLoading) {
    return (
      <span
        aria-label="Loading application options"
        className="h-12 w-48 animate-pulse rounded-full bg-slate-200/80"
      />
    );
  }

  if (
    isPastGrantee &&
    (!isEligiblePastGrantee ||
      !isApplicationOpen ||
      outcome === "GRADUATED" ||
      (age !== null && age >= 31))
  ) {
    return (
      <>
        <Link href="/applications" className={primaryClassName}>
          View Past Records <span>→</span>
        </Link>
        <Link href={helpdeskHref} className={secondaryClassName}>
          Contact Helpdesk
        </Link>
      </>
    );
  }

  if (isEligiblePastGrantee && isApplicationOpen) {
    return (
      <>
        <Link href="/programs/skeap" className={primaryClassName}>
          Reapply for SKEAP <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
        <Link href="/applications" className={secondaryClassName}>
          Past Applications
        </Link>
      </>
    );
  }

  return (
    <Link
      href={hasCurrentApplication ? "/applications" : "/programs/skeap-scholarship"}
      className={primaryClassName}
    >
      {hasCurrentApplication ? "Manage Applications" : "Discover SKEAP"}
      <span className="group-hover:translate-x-1 transition-transform">→</span>
    </Link>
  );
}
