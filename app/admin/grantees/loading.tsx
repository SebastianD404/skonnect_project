import {
  AdminPageHeaderSkeleton,
  AdminTableCardSkeleton,
} from "../components/AdminSkeletonPrimitives";

export default function AdminGranteesLoading() {
  return (
    <main role="status" aria-label="Loading active grantees" className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <AdminPageHeaderSkeleton titleWidth="w-72" subtitleWidth="w-[36rem]" withAction />
      <AdminTableCardSkeleton columns={6} rowCount={5} statusColumns={[2]} actionSlots={2} minTableWidth="min-w-[760px]" />
      <span className="sr-only">Loading active grantees…</span>
    </main>
  );
}
