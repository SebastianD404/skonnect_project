"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Users, X } from "lucide-react";
import { PublicHeader } from "../components/PublicHeader";

interface Event {
  id: string;
  title: string;
  description: string;
  venue: string;
  eventDate: string;
  maxSlots: number;
  filledSlots: number;
  status: string;
  isKatipunan: boolean;
  imageUrl: string | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ fullName?: string; email?: string; avatarUrl?: string } | null>(null);

  const handleRegister = async (eventId: string) => {
    setNotification(null);
    setRegisteringId(eventId);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        if (result?.error === "Unauthorized") {
          window.location.href = "/signup";
          return;
        }

        setNotification({
          type: "error",
          message: result?.error || "Registration failed. Please try again.",
        });
        return;
      }

      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.id === eventId
            ? { ...event, filledSlots: Math.min(event.filledSlots + 1, event.maxSlots) }
            : event
        )
      );
      setNotification({ type: "success", message: "You have successfully registered for this event." });
    } catch (error) {
      setNotification({
        type: "error",
        message: "Registration failed. Please check your connection and try again.",
      });
    } finally {
      setRegisteringId(null);
    }
  };

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const response = await fetch("/api/events");
        const data = await response.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedImage) {
      setIsPreviewOpen(true);
    }
  }, [selectedImage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && selectedImage) {
        closePreview();
      }
    }

    if (selectedImage) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }

    return;
  }, [selectedImage]);

  const closePreview = () => {
    setIsPreviewOpen(false);
    window.setTimeout(() => setSelectedImage(null), 200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <PublicHeader />

      <main className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr] items-start">
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-[#0F3D5C]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C] mb-6">
              <span className="w-2 h-2 rounded-full bg-[#0F3D5C]"></span>
              Official SK events
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#0F3D5C] mt-2">
              Live SK Events Hub
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              This is the central events hub for Pico youth and SKEAP grantees. Here you can see official event announcements, live registration availability, and the slots remaining for each program.
            </p>
          </section>

          <aside className="self-start rounded-[2rem] border border-slate-200 bg-[#F8FBFF] p-8 shadow-sm pb-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">How it works</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Register in a few steps</h2>
            <ol className="mt-5 space-y-2 text-sm leading-6 text-slate-600">
              <li>
                <strong className="text-slate-900">1.</strong> Browse events uploaded by the SK official.
              </li>
              <li>
                <strong className="text-slate-900">2.</strong> Review the slot count and deadline.
              </li>
              <li>
                <strong className="text-slate-900">3.</strong> Click Register to secure your seat.
              </li>
              <li>
                <strong className="text-slate-900">4.</strong> Use your account dashboard to track registration status.
              </li>
            </ol>
          </aside>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <Users className="h-5 w-5 text-[#0F3D5C]" />
              <span>Designed for Pico Youth</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Event registration and seat counts are visible in real time, so you know when slots are filling fast.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <CalendarDays className="h-5 w-5 text-[#0F3D5C]" />
              <span>Upcoming schedule and deadlines</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Events appear as soon as SK uploads them, with clear dates, locations, and registration status for every youth activity.
            </p>
          </div>
        </div>

        {notification ? (
          <div
            className={`mt-8 rounded-3xl border px-5 py-4 text-sm shadow-sm ${
              notification.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {notification.message}
          </div>
        ) : null}

        <section className="mt-16">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Live events</p>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Current events and open registration</h2>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-[#0F3D5C]/15 bg-white px-4 py-3 text-sm font-semibold text-[#0F3D5C] shadow-sm">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#0F3D5C]"></span>
              Updated by SK officials
            </div>
          </div>

          {loading ? (
            <div className="mt-10 flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#00B4E5]/10 mb-4">
                  <div className="w-8 h-8 border-4 border-[#00B4E5]/30 border-t-[#00B4E5] rounded-full animate-spin"></div>
                </div>
                <p className="text-[#555555]">Loading events...</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-[#0F3D5C]/10 bg-white p-12 text-center">
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#0F3D5C] mb-3">
                No events yet
              </h2>
              <p className="text-[#555555] mb-6 max-w-md mx-auto">
                The SK officials haven''t uploaded any events yet. Check back soon for upcoming youth activities and programs!
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => {
                const pct = event.maxSlots > 0 ? Math.round((event.filledSlots / event.maxSlots) * 100) : 0;
                const isFull = event.filledSlots >= event.maxSlots;
                const eventDate = new Date(event.eventDate);

                return (
                  <article
                    key={event.id}
                    className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:shadow-md cursor-pointer group"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] flex items-center justify-center">
                      {event.imageUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (event.imageUrl) {
                                setSelectedImage(event.imageUrl);
                                setSelectedImageTitle(event.title);
                              }
                            }}
                            aria-label={`Open full image for ${event.title}`}
                            className="absolute inset-0 z-10"
                          />
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                        </>
                      ) : (
                        <div className="text-center text-white">
                          <div className="text-3xl font-black mb-1">
                            {eventDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          <div className="text-xs uppercase tracking-[0.24em] opacity-80">
                            SK Official Event
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-7">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.32em] text-teal-600">
                            {eventDate.toLocaleDateString("en-US", {
                              weekday: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <h3 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
                            {event.title}
                          </h3>
                        </div>
                        <div className="rounded-full bg-[#0F3D5C]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">
                          {isFull ? "Full" : "Open"}
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        {event.description}
                      </p>

                      <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 text-[#0F3D5C]" />
                        <span>{event.venue}</span>
                      </div>

                      <div className="mt-5 rounded-3xl bg-slate-100 p-4">
                        <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                          <span>{event.filledSlots}/{event.maxSlots} slots</span>
                          <span>{pct}% taken</span>
                        </div>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-2.5 rounded-full bg-[#0F3D5C] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {event.isKatipunan && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                            KK Event
                          </span>
                        )}
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                          SK Official
                        </span>
                      </div>

                      <div className="mt-6">
                        <button
                          type="button"
                          disabled={isFull || registeringId === event.id}
                          onClick={() => handleRegister(event.id)}
                          className={
                            "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition " +
                            (isFull
                              ? "border border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed"
                              : "bg-[#0F3D5C] text-white shadow-lg hover:bg-[#0D2E47]")
                          }
                        >
                          {registeringId === event.id
                            ? "Registering..."
                            : isFull
                            ? "Registration closed"
                            : "Register now"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {selectedImage || isPreviewOpen ? (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 sm:px-6 transition-opacity duration-200 ${
              isPreviewOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closePreview}
          >
            <div
              className={`relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:mx-auto transform transition-all duration-200 ${
                isPreviewOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closePreview}
                aria-label="Close full image preview"
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={selectedImage ?? undefined}
                alt={selectedImageTitle}
                className="h-[70vh] w-full object-contain bg-slate-100"
              />
              <div className="border-t border-slate-200 bg-white px-6 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">{selectedImageTitle}</div>
                <div className="mt-1 text-slate-500">Full image preview</div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
