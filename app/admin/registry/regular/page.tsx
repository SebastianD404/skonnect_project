import RegistryMembersPage from "../RegistryMembersPage";

export default function RegularMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
}) {
  return <RegistryMembersPage searchParams={searchParams} cohort="regular" />;
}
