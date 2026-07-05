"use client";

import { useState } from "react";
import { Megaphone, CalendarDays } from "lucide-react";
import { AnnouncementDetailModal, AnnouncementModalItem } from "../../components/AnnouncementDetailModal";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  publishedAt: string | Date;
  author: {
    id: string;
    fullName: string;
    email: string;
  };
  imageUrl?: string | null;
}

interface Props {
  announcements: AnnouncementItem[];
}

export default function GranteeAnnouncementsPageClient({ announcements }: Props) {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementModalItem | null>(null);

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
            {announcements.map((announcement) => {
              const previewContent =
                announcement.content.length > 220
                  ? `${announcement.content.slice(0, 220).trim()}...`
                  : announcement.content;

              return (
                <article
                  key={announcement.id}
                  className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedAnnouncement(announcement)}
                    className="text-left"
                  >
                    {announcement.imageUrl ? (
                      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-slate-100 sm:h-52">
                        <img
                          src={announcement.imageUrl}
                          alt={announcement.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="relative flex h-48 w-full shrink-0 items-center justify-center rounded-t-[2rem] bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] text-white sm:h-52">
                        <Megaphone className="h-10 w-10 opacity-90" />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col px-6 py-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <h2 className="text-2xl font-semibold tracking-tight text-[#0F3D5C] md:text-3xl">
                          {announcement.title}
                        </h2>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(announcement.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                        Posted by {announcement.author.fullName}
                      </p>

                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-700">
                        {previewContent}
                      </p>
                    </div>
                  </button>
                </article>
              );
            })}
          </section>
        )}

        {selectedAnnouncement ? (
          <AnnouncementDetailModal
            announcement={selectedAnnouncement}
            onClose={() => setSelectedAnnouncement(null)}
          />
        ) : null}
      </div>
    </main>
  );
}
