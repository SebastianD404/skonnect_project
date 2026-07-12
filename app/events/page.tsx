"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Calendar, CalendarDays, Hash, Mail, MapPin, Phone, User, Users, X } from "lucide-react";
import { normalizeAddressText } from "@/lib/address";

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
  isRegistered?: boolean;
  imageUrl: string | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toFirstAndLastName(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => toTitleCase(word));

  if (words.length === 0) return "";
  if (words.length === 1) return words[0];

  return `${words[0]} ${words[words.length - 1]}`;
}

function deriveNameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "";
  const spaced = localPart
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+/g, " ")
    .trim();

  return toFirstAndLastName(spaced);
}

export default function EventsPage() {
  const EVENTS_PER_PAGE = 9;
  const [events, setEvents] = useState<Event[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [selectedRegisterEvent, setSelectedRegisterEvent] = useState<Event | null>(null);
  const [selectedRegisteredEvent, setSelectedRegisteredEvent] = useState<Event | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ fullName?: string; email?: string; avatarUrl?: string } | null>(null);
  const [showKkModal, setShowKkModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    address: "",
    age: "",
    sex: "",
  });
  const [registerFormError, setRegisterFormError] = useState<string | null>(null);

  const submitRegistration = async (eventId: string) => {
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
      setSelectedRegisterEvent(null);
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

  const handleCancelRegistration = async (eventId: string) => {
    setNotification(null);
    setRegisteringId(eventId);
    try {
      const response = await fetch(`/api/events/${eventId}/registration`, { method: "DELETE" });

      if (response.status === 401) {
        window.location.href = "/signup";
        return;
      }

      let result: any = null;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : null;
      } catch (err) {
        result = null;
      }

      if (!response.ok) {
        setNotification({ type: "error", message: result?.error || "Failed to cancel registration." });
        return;
      }

      setNotification({ type: "success", message: result?.message || "Your registration has been cancelled." });
      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? { ...event, filledSlots: Math.max(0, event.filledSlots - 1), isRegistered: false }
            : event
        )
      );
      setSelectedRegisteredEvent(null);
    } catch (err) {
      setNotification({ type: "error", message: "Failed to cancel registration. Please try again." });
    } finally {
      setRegisteringId(null);
    }
  };

  const getAutofilledFullName = () => {
    const rawFullName = (sessionUser?.fullName || "").trim();
    if (rawFullName && !rawFullName.includes("@")) {
      return toFirstAndLastName(rawFullName.replace(/\s+/g, " "));
    }

    const candidateEmail = (sessionUser?.email || rawFullName).trim();
    if (!candidateEmail) return "";

    return deriveNameFromEmail(candidateEmail);
  };

  const getAutofilledAddress = (mapped: any) => {
    return normalizeAddressText(
      mapped?.address || mapped?.latestKkRegistration?.address || mapped?.kkProfile?.addressLine || mapped?.skeapApplication?.permanentAddress || ""
    );
  };

  const openRegisterModal = async (event: Event) => {
    // Require sign-in / KK profiling for registration. If not authenticated, prompt to complete KK profiling first.
    if (!isAuthenticated) {
      setShowKkModal(true);
      return;
    }

    setRegisterFormError(null);
    setSelectedRegisterEvent(event);

    // Fetch fresh session-mapped data and fill the form from KK/SKEAP/profile fields
    const mapped = await fetchAndMapSession();
    const mf: any = mapped || sessionUser || {};
    setSessionUser(mf as any);
    setRegisterForm({
      fullName: getAutofilledFullName(),
      email: mf.email || "",
      phoneNumber: mf.phoneNumber || "",
      address: getAutofilledAddress(mf),
      age: mf.age || "",
      sex: mf.sex || "",
    });
  };

  const handleRegisterFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedRegisterEvent) {
      return;
    }

    if (
      !registerForm.fullName.trim() ||
      !registerForm.email.trim() ||
      !registerForm.address.trim() ||
      !registerForm.age.trim() ||
      !registerForm.sex.trim()
    ) {
      setRegisterFormError("Full name, email, address, age, and sex are required.");
      return;
    }

    await submitRegistration(selectedRegisterEvent.id);
  };

  const totalEventPages = Math.max(1, Math.ceil(events.length / EVENTS_PER_PAGE));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * EVENTS_PER_PAGE;
    return events.slice(start, start + EVENTS_PER_PAGE);
  }, [events, currentPage]);

  const paginationItems = useMemo<Array<number | "dots">>(() => {
    if (totalEventPages <= 7) {
      return Array.from({ length: totalEventPages }, (_, idx) => idx + 1);
    }

    const items: Array<number | "dots"> = [1];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalEventPages - 1, currentPage + 1);

    if (left > 2) {
      items.push("dots");
    }

    for (let page = left; page <= right; page += 1) {
      items.push(page);
    }

    if (right < totalEventPages - 1) {
      items.push("dots");
    }

    items.push(totalEventPages);
    return items;
  }, [currentPage, totalEventPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [events.length]);

  useEffect(() => {
    async function fetchEvents(isInitial = false) {
      try {
        if (isInitial) {
          setLoading(true);
        }

        const response = await fetch("/api/events", { cache: "no-store" });
        const data = await response.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setEvents([]);
      } finally {
        if (isInitial) {
          setLoading(false);
          setHasLoadedEvents(true);
        }
      }
    }

    fetchEvents(true);

    const refreshEvents = () => {
      if (document.visibilityState !== "visible") return;
      fetchEvents(false);
    };

    const intervalId = window.setInterval(refreshEvents, 15000);
    window.addEventListener("focus", refreshEvents);
    document.addEventListener("visibilitychange", refreshEvents);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshEvents);
      document.removeEventListener("visibilitychange", refreshEvents);
    };
  }, []);

  useEffect(() => {
    async function fetchSession() {
      try {
        setAuthLoading(true);
        const response = await fetch("/api/session");
        const data = await response.json();
        const u = data?.user ?? null;
        if (!u) {
          setSessionUser(null);
          setIsAuthenticated(false);
        } else {
          const kk = u.kkProfile ?? null;
          const sa = u.skeapApplication ?? null;

          const normalizeSex = (raw?: any) => {
            if (!raw) return undefined;
            const normalized = String(raw).trim().toLowerCase();
            if (normalized.startsWith("m")) return "Male";
            if (normalized.startsWith("f")) return "Female";
            return undefined;
          };

          const mapped = {
            fullName: (kk?.fullName as string) || u.fullName || (sa?.applicantName as string) || undefined,
            email: u.email || (sa?.emailAddress as string) || undefined,
            phoneNumber: (kk?.contactNumber as string) || (sa?.contactNumber as string) || u.phoneNumber || undefined,
            address: normalizeAddressText((u.address as string) || (u.latestKkRegistration?.address as string) || (kk?.addressLine as string) || (sa?.permanentAddress as string) || undefined),
            age:
              sa?.age != null
                ? String(sa.age)
                : kk?.birthDate
                ? String(Math.floor((Date.now() - new Date(kk.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
                : undefined,
            sex: normalizeSex((sa?.gender as string) || (u.latestKkRegistration?.sex as string) || undefined),
          };

          setSessionUser(mapped);
          setIsAuthenticated(true);
        }
      } catch (error) {
        setSessionUser(null);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    }

    fetchSession();
  }, []);

  async function fetchAndMapSession() {
    try {
      const response = await fetch('/api/session');
      const data = await response.json();
      const u = data?.user ?? null;
      if (!u) return null;

      const kk = u.kkProfile ?? null;
      const sa = u.skeapApplication ?? null;

      const normalizeSex = (raw?: any) => {
        if (!raw) return undefined;
        const s = String(raw).trim().toLowerCase();
        if (s.startsWith("m")) return "Male";
        if (s.startsWith("f")) return "Female";
        return undefined;
      };

      return {
        fullName: (kk?.fullName as string) || u.fullName || (sa?.applicantName as string) || undefined,
        email: u.email || (sa?.emailAddress as string) || undefined,
        phoneNumber: (kk?.contactNumber as string) || (sa?.contactNumber as string) || u.phoneNumber || undefined,
        address: normalizeAddressText((u.address as string) || (u.latestKkRegistration?.address as string) || (kk?.addressLine as string) || (sa?.permanentAddress as string) || undefined),
        age:
          sa?.age != null
            ? String(sa.age)
            : kk?.birthDate
            ? String(Math.floor((Date.now() - new Date(kk.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
            : undefined,
        sex: normalizeSex((sa?.gender as string) || (u.latestKkRegistration?.sex as string) || undefined),
      };
    } catch (err) {
      return null;
    }
  }

  useEffect(() => {
    if (selectedImage) {
      setIsPreviewOpen(true);
    }
  }, [selectedImage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedImage) {
          closePreview();
        }
        if (selectedEvent) {
          setSelectedEvent(null);
        }
        if (selectedRegisterEvent) {
          setSelectedRegisterEvent(null);
        }
      }
    }

    if (selectedImage || selectedEvent || selectedRegisterEvent) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }

    return;
  }, [selectedImage, selectedEvent, selectedRegisterEvent]);

  const closePreview = () => {
    setIsPreviewOpen(false);
    window.setTimeout(() => setSelectedImage(null), 200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
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

        {notification?.type === "error" ? (
          <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
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
            <>
              <div className="mt-10 grid auto-rows-fr gap-8 sm:grid-cols-2 xl:grid-cols-3">
                {paginatedEvents.map((event) => {
                const pct = event.maxSlots > 0 ? Math.round((event.filledSlots / event.maxSlots) * 100) : 0;
                const isFull = event.filledSlots >= event.maxSlots;
                const eventDate = new Date(event.eventDate);

                return (
                  <article
                    key={event.id}
                    className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative h-48 w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] flex items-center justify-center">
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

                      <div className="absolute left-4 top-4 flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-white/95 shadow-md backdrop-blur">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {eventDate.toLocaleString("en-US", { month: "short" }).toUpperCase()}
                        </span>
                        <span className="text-lg font-bold leading-none text-slate-900">
                          {eventDate.getDate().toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-6 py-6">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.32em] text-teal-600">
                            {eventDate.toLocaleDateString("en-US", {
                              weekday: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <h3 className="mt-2 line-clamp-2 min-h-[2.75rem] text-xl font-semibold leading-tight text-slate-900 md:text-2xl">
                            {event.title}
                          </h3>
                        </div>
                        <div className="rounded-full bg-[#0F3D5C]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">
                          {isFull ? "Full" : "Open"}
                        </div>
                      </div>

                      <p className="mt-2 line-clamp-2 min-h-[3rem] text-sm leading-6 text-slate-600">
                        {event.description}
                      </p>

                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 text-[#0F3D5C]" />
                        <span className="line-clamp-1">{event.venue}</span>
                      </div>

                      <div className="mt-4 rounded-3xl bg-slate-100 p-4">
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

                      {event.isKatipunan && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                            KK Event
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-900"
                      >
                        View details
                        <ArrowUpRight className="h-3 w-3" />
                      </button>

                      <div className="mt-auto pt-6">
                        {(() => {
                          const isRegistered = Boolean(event.isRegistered);
                          const isLoading = registeringId === event.id;
                          const disabled = (!isRegistered && (isFull || isLoading)) || (isRegistered && isLoading);
                          return (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                if (isRegistered) setSelectedRegisteredEvent(event);
                                else openRegisterModal(event);
                              }}
                              className={
                                "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition " +
                                (disabled
                                  ? "border border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed"
                                  : isRegistered
                                  ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-95"
                                  : "bg-[#0F3D5C] text-white shadow-lg hover:bg-[#0D2E47]")
                              }
                            >
                              {isLoading && !isRegistered
                                ? "Registering..."
                                : isRegistered
                                ? isLoading
                                  ? "Processing..."
                                  : "Registered"
                                : isFull
                                ? "Registration closed"
                                : "Register now"}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!loading && totalEventPages > 1 ? (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-medium text-slate-500">
                  Page {currentPage} of {totalEventPages}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {paginationItems.map((item, idx) =>
                    item === "dots" ? (
                      <span
                        key={`dots-${idx}`}
                        className="flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-slate-50 px-2 text-xs font-semibold text-slate-500"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={
                          "h-8 min-w-[2rem] rounded-full px-2 text-xs font-semibold transition " +
                          (currentPage === item
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                        }
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalEventPages, prev + 1))}
                    disabled={currentPage === totalEventPages}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
          )}
        </section>

        {notification?.type === "success" ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] px-4"
            onClick={() => setNotification(null)}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <span className="text-2xl leading-none">✓</span>
              </div>
              <h3 className="mt-4 text-center text-xl font-bold text-slate-900">{(notification.message || "").toLowerCase().includes('cancel') ? 'Registration cancelled successfully' : 'Registration successful'}</h3>
              <p className="mt-2 text-center text-sm text-slate-600">{notification.message}</p>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        {selectedRegisterEvent ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] px-4 py-6"
            onClick={() => setSelectedRegisterEvent(null)}
          >
            <div
              className="relative w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-white to-sky-50/60 px-6 py-5">
                <div>
                  <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                    Event registration
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">Register for {selectedRegisterEvent.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {new Date(selectedRegisterEvent.eventDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {selectedRegisterEvent.venue}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRegisterEvent(null)}
                  aria-label="Close registration form"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterFormSubmit} className="space-y-5 px-6 py-6">
                {registerFormError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {registerFormError}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Full name
                    </span>
                    <input
                      type="text"
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, fullName: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="Juan Dela Cruz"
                      required
                    />
                  </label>

                  <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      Email
                    </span>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="you@example.com"
                      required
                      readOnly={Boolean(sessionUser?.email)}
                    />
                    {sessionUser?.email ? (
                      <p className="mt-1 text-[11px] text-slate-500">Auto-filled from your account</p>
                    ) : null}
                  </label>

                  <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      Address
                    </span>
                    <input
                      type="text"
                      value={registerForm.address}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, address: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="Your complete address"
                      required
                    />
                  </label>

                  <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Hash className="h-3.5 w-3.5 text-slate-400" />
                      Age
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={registerForm.age}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, age: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="Your age"
                      required
                    />
                  </label>

                  <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Sex
                    </span>
                    <select
                      value={registerForm.sex}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, sex: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      required
                    >
                      <option value="" className="text-slate-400">
                        Select sex
                      </option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </label>

                  <label className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      Contact number
                    </span>
                    <input
                      type="tel"
                      value={registerForm.phoneNumber}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="09xxxxxxxxx"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={registeringId === selectedRegisterEvent.id || authLoading}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {registeringId === selectedRegisterEvent.id ? "Registering..." : "Confirm registration"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRegisterEvent(null)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {selectedRegisteredEvent ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] px-4 py-6"
            onClick={() => setSelectedRegisteredEvent(null)}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900">You're registered</h3>
              <p className="mt-2 text-sm text-slate-600">You are currently registered for {selectedRegisteredEvent.title}. Do you want to cancel your registration?</p>

              <div className="mt-6 flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRegisteredEvent(null)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => selectedRegisteredEvent && handleCancelRegistration(selectedRegisteredEvent.id)}
                  disabled={registeringId === selectedRegisteredEvent.id}
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-60"
                >
                  {registeringId === selectedRegisteredEvent.id ? "Cancelling..." : "Cancel registration"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showKkModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] px-4 py-6"
            onClick={() => setShowKkModal(false)}
          >
            <div
              className="relative w-full max-w-lg rounded-[1.25rem] bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowKkModal(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-600">SK Program Access</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">KK profiling required</h3>
                <p className="mt-3 text-sm text-slate-600">
                  To register for community events you must have a verified Katipunan ng Kabataan (KK) profile. If you already have an SKonnect account, please log in to continue. If you do not have an account, register for KK profiling to create an account and complete verification.
                </p>
              </div>

              <div className="mt-6 flex flex-row-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href); }}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Log in
                </button>

                <button
                  type="button"
                  onClick={() => { window.location.href = '/programs/kk-profiling?redirect=' + encodeURIComponent(window.location.href); }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Go to KK Profiling
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedEvent ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] px-4 py-6"
            onClick={() => setSelectedEvent(null)}
          >
            <div
              className="relative w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-white to-sky-50/60 px-6 py-5">
                <div>
                  <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                    {selectedEvent.isKatipunan ? "KK Event" : "SK Event"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  aria-label="Close event details"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[80vh] space-y-6 overflow-y-auto px-6 py-6">
                {selectedEvent.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(selectedEvent.imageUrl);
                      setSelectedImageTitle(selectedEvent.title);
                    }}
                    className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <img
                      src={selectedEvent.imageUrl}
                      alt={selectedEvent.title}
                      className="h-auto max-h-[60vh] w-full object-contain bg-slate-100"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0F3D5C]/80 to-transparent px-4 py-3 text-left opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <p className="text-xs font-medium text-white">Click image for full-screen preview</p>
                    </div>
                  </button>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Description</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{selectedEvent.description}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Date and time
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {new Date(selectedEvent.eventDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {new Date(selectedEvent.eventDate).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      Venue
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{selectedEvent.venue}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      Registration
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {selectedEvent.filledSlots}/{selectedEvent.maxSlots} registered
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {Math.max(selectedEvent.maxSlots - selectedEvent.filledSlots, 0)} slots remaining
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Hash className="h-3.5 w-3.5 text-slate-400" />
                      Event code
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-900">{selectedEvent.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
