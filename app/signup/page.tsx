import SecureAccountForm from "@/app/secure-account/SecureAccountForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: nextParam } = await searchParams;
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  return <SecureAccountForm mode="signup" redirect={next || "/youth-dashboard"} />;
}
