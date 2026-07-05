"use client";

import { X } from "lucide-react";

export type AnnouncementModalItem = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  publishedAt: string | Date;
  author: {
    id: string;
    fullName: string;
    email: string;
  };
};

interface AnnouncementDetailModalProps {
  announcement: AnnouncementModalItem | null;
  onClose: () => void;
}

export function AnnouncementDetailModal({ announcement, onClose }: AnnouncementDetailModalProps) {
  if (!announcement) return null;

  const publishedAt = new Date(announcement.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          aria-label="Close announcement details"
        >
          <X className="h-5 w-5" />
        </button>

        {announcement.imageUrl ? (
          <div className="relative h-[420px] w-full overflow-hidden bg-slate-100 sm:h-[520px]">
            <img
              src={announcement.imageUrl}
              alt={announcement.title}
              className="h-full w-full object-contain object-center"
            />
          </div>
        ) : (
          <div className="flex h-[260px] w-full items-center justify-center bg-[#0F3D5C] text-white sm:h-[320px]">
            <span className="text-lg font-semibold uppercase tracking-[0.24em]">No image available</span>
          </div>
        )}

        <div className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-900">{announcement.title}</h2>
              <p className="mt-2 text-sm text-slate-500">
                Posted by {announcement.author.fullName} • {publishedAt}
              </p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-slate-700">
            <p className="whitespace-pre-wrap break-words leading-relaxed">{announcement.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
