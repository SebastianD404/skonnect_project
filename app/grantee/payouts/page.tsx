import { AlertCircle, CheckCircle2, Clock3, WalletCards } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRecentSemesters } from "@/lib/semester";
import { PayoutConfirmButton } from "./PayoutConfirmButton";

const GRANT_AMOUNT = 5000;
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatPayoutDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date)
    : "Not disbursed yet";
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
      select: {
        id: true,
        amount: true,
        status: true,
        disbursedAt: true,
        claimedAt: true,
      },
    }),
    db.accountingPayout.findMany({
      where: payoutWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        semester: true,
        status: true,
        disbursedAt: true,
        claimedAt: true,
        createdAt: true,
      },
    }),
  ]);
  const currentStatus = currentPayout
    ? currentPayout.status === "CONFIRMED"
      ? "Confirmed"
      : currentPayout.status === "DISBURSED_UNCONFIRMED"
        ? "Awaiting Confirmation"
        : "Pending"
    : "Not yet filed";
  const historyRows = payouts.map((payout) => ({
    ...payout,
    payoutId: payout.id,
    status: payout.status === "CONFIRMED"
      ? "Confirmed"
      : payout.status === "DISBURSED_UNCONFIRMED"
        ? "Awaiting Confirmation"
        : "Pending",
  }));
  const payoutHistory = currentPayout
    ? historyRows
    : [
        {
          id: `current-${currentSemesterName}`,
          amount: GRANT_AMOUNT,
          semester: currentSemesterName,
          disbursedAt: null,
          claimedAt: null,
          createdAt: new Date(),
          payoutId: null,
          status: "Not yet filed" as const,
        },
        ...historyRows,
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
            Track your SKEAP grant disbursements and confirm when you receive each semester&apos;s assistance.
          </p>
        </header>

        <Card className="mt-8 overflow-hidden border-slate-200/80 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.35)]">
          <div className="grid gap-6 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-7 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-9">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">{currentSemesterName}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{currentSemesterName} payout</h2>
              <div className="mt-5 flex items-center gap-3">
                {currentStatus === "Confirmed" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                ) : (
                  <Clock3 className="h-5 w-5 text-amber-300" />
                )}
                <span className="text-sm text-slate-200">Status:</span>
                <Badge variant={currentStatus === "Confirmed" ? "received" : "pending"}>
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

        {currentPayout?.status === "DISBURSED_UNCONFIRMED" ? (
          <section
            aria-labelledby="payout-confirmation-title"
            className="mt-5 flex flex-col gap-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
              <div>
                <h2 id="payout-confirmation-title" className="font-semibold text-slate-900">
                  Confirm your cash receipt
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                  This payout was marked as disbursed. Confirm only after you have received the cash.
                </p>
              </div>
            </div>
            <PayoutConfirmButton payoutId={currentPayout.id} />
          </section>
        ) : null}

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
                    <TableHead>Disbursed / Confirmed Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutHistory.map((payout) => {
                    const status = "status" in payout
                      ? payout.status
                      : "Pending";
                    const confirmed = status === "Confirmed";
                    const awaitingConfirmation = status === "Awaiting Confirmation";
                    const payoutDate = payout.claimedAt ?? payout.disbursedAt;
                    return (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium text-slate-900">
                          {payout.semester ?? "Current semester"}
                        </TableCell>
                        <TableCell>{currencyFormatter.format(payout.amount || GRANT_AMOUNT)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-2">
                            <Badge variant={confirmed ? "received" : "pending"}>
                              {status}
                            </Badge>
                            {awaitingConfirmation && "payoutId" in payout && payout.payoutId ? (
                              <PayoutConfirmButton payoutId={payout.payoutId} />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatPayoutDate(payoutDate)}
                        </TableCell>
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
