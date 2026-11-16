import {
  AdminPageHeaderSkeleton,
  AdminTableCardSkeleton,
} from "../../components/AdminSkeletonPrimitives";

export function GranteeRecordsLoading() {
  return (
    <main role="status" aria-label="Loading graduated scholars" className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <AdminPageHeaderSkeleton titleWidth="w-64" subtitleWidth="w-[36rem]" withAction />
      <AdminTableCardSkeleton
        columns={7}
        rowCount={5}
        statusColumns={[1]}
        actionSlots={1}
        minTableWidth="min-w-[900px]"
      />
      <span className="sr-only">Loading graduated scholars…</span>
    </main>
  );
}

export default GranteeRecordsLoading;
