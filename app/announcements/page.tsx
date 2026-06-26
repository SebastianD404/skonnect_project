"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  publishedAt: string;
  author: {
    id: string;
    fullName: string;
    email: string;
  };
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        setLoading(true);
        const response = await fetch("/api/announcements");
        const data = await response.json();
        
        if (!response.ok) {
          // If error response, just treat as no announcements
          setAnnouncements([]);
        } else {
          setAnnouncements(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        // Network errors - treat as no announcements available yet
        console.error("Failed to fetch announcements:", err);
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAnnouncements();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] py-12 px-6 text-slate-900">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F3D5C] mb-6 hover:text-[#00B4E5] transition-colors"
          >
            ← Back to home
          </Link>
          <h1 className="text-5xl font-black text-[#0F3D5C] mb-4">
            Official Announcements
          </h1>
          <p className="text-lg text-[#555555] leading-relaxed">
            Stay updated with the latest announcements from SK officials.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#00B4E5]/10 mb-4">
                <div className="w-8 h-8 border-4 border-[#00B4E5]/30 border-t-[#00B4E5] rounded-full animate-spin"></div>
              </div>
              <p className="text-[#555555]">Loading announcements...</p>
            </div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="rounded-2xl border border-[#0F3D5C]/10 bg-white p-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00B4E5] to-[#0F3D5C] mx-auto mb-6">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#0F3D5C] mb-3">
              No announcements yet
            </h2>
            <p className="text-[#555555] mb-6 max-w-md mx-auto">
              The SK officials haven't posted any announcements yet. Check back
              soon for updates!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-[#00B4E5] to-[#0F3D5C] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
            >
              Return to home
              <span>→</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="group overflow-hidden rounded-3xl border border-[#0F3D5C]/10 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:border-[#0F3D5C]/30 hover:-translate-y-1"
              >
                {announcement.imageUrl ? (
                  <div className="relative h-64 w-full overflow-hidden bg-slate-100 sm:h-72">
                    <img
                      src={announcement.imageUrl}
                      alt={announcement.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="p-6 sm:p-8">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold text-[#0F3D5C] tracking-tight transition-colors duration-300 group-hover:text-[#00B4E5]">
                        {announcement.title}
                      </h2>
                      <p className="mt-2 text-sm text-[#6B7280]">
                        By {announcement.author.fullName} • {new Date(announcement.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none mt-6 text-[#334155]">
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {announcement.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
