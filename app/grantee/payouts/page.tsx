import { CheckCircle2, Clock3, WalletCards } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRecentSemesters } from "@/lib/semester";

const GRANT_AMOUNT = 5000;
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatClaimedDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date)
    : "Not claimed yet";
}

export default async function GranteePayoutsPage() {
  const appUser = await requireRole(["GRANTEE"]);
  const db = prisma;

  const grantee = await db.grantee.findUnique({
    where: { userId: appUser.id },
    select: { id: true },
  });

  const currentSemesterName = getRecentSemesters()[0].name;
  const payoutWhere = { granteeId: grantee?.id ?? "no-grantee" };
  const [currentPayout, payouts] = await Promise.all([
    db.accountingPayout.findFirst({
      where: { ...payoutWhere, semester: currentSemesterName },
      select: { amount: true, claimedAt: true },
    }),
    db.accountingPayout.findMany({
      where: payoutWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        semester: true,
        claimedAt: true,
        createdAt: true,
      },
    }),
  ]);
  const currentStatus = currentPayout
    ? currentPayout.claimedAt
      ? "Received"
      : "Pending"
    : "Not yet filed";
  const payoutHistory = currentPayout
    ? payouts
    : [
        {
          id: `current-${currentSemesterName}`,
          amount: GRANT_AMOUNT,
          semester: currentSemesterName,
          claimedAt: null,
          createdAt: new Date(),
          status: "Not yet filed" as const,
        },
        ...payouts,
      ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
            <WalletCards className="h-3.5 w-3.5" />
            Financial assistance
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">My Payouts</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Track your SKEAP grant disbursements and see when each semester&apos;s assistance was claimed.
          </p>
        </header>

        <Card className="mt-8 overflow-hidden border-slate-200/80 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.35)]">
          <div className="grid gap-6 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-7 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-9">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">{currentSemesterName}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{currentSemesterName} payout</h2>
              <div className="mt-5 flex items-center gap-3">
                {currentStatus === "Received" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                ) : (
                  <Clock3 className="h-5 w-5 text-amber-300" />
                )}
                <span className="text-sm text-slate-200">Status:</span>
                <Badge variant={currentStatus === "Received" ? "received" : "pending"}>
                  {currentStatus}
                </Badge>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Standard grant</p>
              <p className="mt-2 text-3xl font-semibold">
                {currencyFormatter.format(currentPayout?.amount || GRANT_AMOUNT)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="mt-8 border-slate-200/80">
          <CardHeader>
            <CardTitle>Payout history</CardTitle>
            <CardDescription>Your recorded SKEAP financial assistance by semester.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Semester Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Claimed Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutHistory.map((payout) => {
                    const status = "status" in payout
                      ? payout.status
                      : payout.claimedAt
                        ? "Received"
                        : "Pending";
                    const received = status === "Received";
                    return (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium text-slate-900">
                          {payout.semester ?? "Current semester"}
                        </TableCell>
                        <TableCell>{currencyFormatter.format(payout.amount || GRANT_AMOUNT)}</TableCell>
                        <TableCell>
                          <Badge variant={received ? "received" : "pending"}>
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">{formatClaimedDate(payout.claimedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {payoutHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                        No payout records have been posted yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
