function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} aria-hidden="true" />;
}

export function KKProfilingTableSkeletonRows({
  showMemberRoleColumn,
  cellPadding,
  actionCellPadding,
  centerVoter,
}: {
  showMemberRoleColumn: boolean;
  cellPadding: string;
  actionCellPadding: string;
  centerVoter: boolean;
}) {
  return (
    <>
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className="h-[72px] border-b border-slate-100 last:border-b-0"
          aria-hidden="true"
        >
          <td className={cellPadding}>
            <SkeletonBlock className="h-4 w-36 max-w-full" />
            <SkeletonBlock className="mt-2 h-3 w-28 max-w-full" />
          </td>
          <td className={cellPadding}><SkeletonBlock className="h-4 w-24" /></td>
          <td className={cellPadding}><SkeletonBlock className="h-4 w-24" /></td>
          <td className={`${cellPadding} ${centerVoter ? "text-center" : ""}`}>
            <SkeletonBlock className={`${centerVoter ? "mx-auto " : ""}h-4 w-8`} />
          </td>
          {showMemberRoleColumn ? (
            <td className={`${cellPadding} ${centerVoter ? "text-center" : ""}`}>
              <SkeletonBlock className={`${centerVoter ? "mx-auto " : ""}h-4 w-20`} />
            </td>
          ) : (
            <>
              <td className={`${cellPadding} ${centerVoter ? "text-center" : ""}`}><SkeletonBlock className={`${centerVoter ? "mx-auto " : ""}h-6 w-20 rounded-full`} /></td>
              <td className={cellPadding}><SkeletonBlock className="h-4 w-24" /></td>
            </>
          )}
          <td className={`${actionCellPadding} text-center`}>
            <SkeletonBlock className="mx-auto h-9 w-16 rounded-md" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function KKProfilingMobileTableSkeleton() {
  return (
    <div role="status" aria-label="Loading applications" aria-live="polite" className="space-y-3">
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-40 max-w-full" />
              <SkeletonBlock className="mt-2 h-3 w-32 max-w-full" />
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
          <SkeletonBlock className="mt-4 h-9 w-16 rounded-md" />
        </div>
      ))}
      <span className="sr-only">Loading applications</span>
    </div>
  );
}
