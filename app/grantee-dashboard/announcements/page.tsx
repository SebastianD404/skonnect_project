import { prisma } from "@/lib/prisma";
import { Megaphone, CalendarDays } from "lucide-react";

export default async function GranteeAnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    where: {
      isPublished: true,
    },
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
  });

  return (
    <main className="px-6 pb-20 pt-12">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-sm sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-[#00B4E5]/20 to-[#0F3D5C]/5 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#0F3D5C]/80">Announcement center</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-[#0F3D5C] sm:text-5xl">Grantee announcements</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Stay updated with official notices, schedules, and scholarship reminders from SK officials.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/15 bg-[#F6FBFF] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3D5C]">
              <Megaphone className="h-3.5 w-3.5" />
              {announcements.length} Published
            </div>
          </div>
        </section>

        {announcements.length === 0 ? (
          <section className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white/80 p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F3D5C] to-[#00B4E5] text-white">
              <Megaphone className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">No announcements yet</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">
              No published updates are available right now. Check back soon for official announcements from your SK team.
            </p>
          </section>
        ) : (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {announcement.imageUrl ? (
                  <div className="relative h-56 w-full overflow-hidden bg-slate-100">
                    <img
                      src={announcement.imageUrl}
                      alt={announcement.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <div className="relative flex h-56 w-full items-center justify-center bg-gradient-to-br from-[#0F3D5C] to-[#00B4E5] text-white">
                    <Megaphone className="h-10 w-10 opacity-90" />
                  </div>
                )}

                <div className="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-2xl font-bold tracking-tight text-[#0F3D5C]">{announcement.title}</h2>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(announcement.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    Posted by {announcement.author.fullName}
                  </p>

                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                    {announcement.content}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
