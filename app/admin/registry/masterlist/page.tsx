import RegistryMembersPage from "../RegistryMembersPage";

export default function MasterlistPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
}) {
  return <RegistryMembersPage searchParams={searchParams} cohort="all" />;
}
