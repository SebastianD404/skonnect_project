import {
  AdminPageHeaderSkeleton,
  AdminTableCardSkeleton,
} from "../../components/AdminSkeletonPrimitives";

export default function RevokedGranteesLoading() {
  return (
    <main role="status" aria-label="Loading revoked grantees" className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <AdminPageHeaderSkeleton titleWidth="w-56" subtitleWidth="w-[36rem]" />
      <AdminTableCardSkeleton
        columns={6}
        rowCount={5}
        statusColumns={[4]}
        actionSlots={1}
        minTableWidth="min-w-[1040px]"
      />
      <span className="sr-only">Loading revoked grantees…</span>
    </main>
  );
}
