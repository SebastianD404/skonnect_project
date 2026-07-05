import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { GranteeEventSection } from "@/app/components/GranteeEventSection";

export default async function GranteeEventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    select: { id: true, authId: true, role: true },
  });

  if (appUser && appUser.authId !== user.id) {
    try {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Ignore relink failures and continue with fetched account data.
    }
  }

  if (!appUser || appUser.role !== "GRANTEE") {
    redirect("/login");
  }

  const events = await prisma.event.findMany({
    where: {
      status: {
        in: ["UPCOMING", "REGISTRATION_OPEN"],
      },
    },
    orderBy: { eventDate: "asc" },
    include: {
      // Include a small relation for whether the current user is registered
      registrations: {
        where: {
          userId: appUser.id,
        },
        select: {
          id: true,
        },
      },
      // Also include a count of all registrations so we can show accurate filledSlots
      _count: {
        select: { registrations: true },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  const serializedEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    eventDate: event.eventDate.toISOString(),
    maxSlots: event.maxSlots,
    // Use the registration count (up-to-date) rather than any possibly stale DB column
    filledSlots: event._count?.registrations ?? 0,
    status: event.status,
    isKatipunan: event.isKatipunan,
    imageUrl: event.imageUrl || null,
    createdBy: event.createdBy,
    isRegistered: event.registrations.length > 0,
  }));

  return (
    <main className="px-6 pb-20 pt-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">SKEAP Events</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Register for upcoming programs</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Browse official youth programs, review full event details, and secure your slot before registration closes.
          </p>
        </div>

        {serializedEvents.length > 0 ? (
          <GranteeEventSection events={serializedEvents} currentUserRole={appUser.role} />
        ) : (
          <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 text-center shadow-sm">
            <p className="text-lg text-[#555555]">No upcoming events at this time. Check back soon!</p>
          </div>
        )}
      </div>
    </main>
  );
}
