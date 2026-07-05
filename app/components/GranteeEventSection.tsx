"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Calendar, Hash, Mail, MapPin, Phone, User, Users, X } from "lucide-react";

interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  eventDate: string;
  status: string;
  maxSlots: number;
  filledSlots: number;
  isRegistered?: boolean;
  imageUrl?: string | null;
  isKatipunan?: boolean;
}

interface Props {
  events: EventItem[];
  currentUserRole?: string | null;
}

type SessionUser = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  age?: string;
  sex?: string;
};

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

export function GranteeEventSection({ events, currentUserRole }: Props) {
  const [eventList, setEventList] = useState(events);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [selectedRegisterEvent, setSelectedRegisterEvent] = useState<EventItem | null>(null);
  const [registerFormError, setRegisterFormError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [showKkModal, setShowKkModal] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    address: "",
    age: "",
    sex: "",
  });

  useEffect(() => {
    setEventList(events);
  }, [events]);

  useEffect(() => {
    if (selectedImage) {
      setIsPreviewOpen(true);
    }
  }, [selectedImage]);

  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch("/api/session");
        const data = await response.json();
        const u = data?.user ?? null;
        if (!u) {
          setSessionUser(null);
          return;
        }

        // Prefer KK profiling data, then fall back to SKEAP application, then user profile
        const kk = u.kkProfile ?? null;
        const sa = u.skeapApplication ?? null;

const normalizeSex = (raw?: any) => {
            if (!raw) return undefined;
            const normalized = String(raw).trim().toLowerCase();
            if (normalized.startsWith("m")) return "Male";
            if (normalized.startsWith("f")) return "Female";
            return undefined;
          };

          const mapped: SessionUser = {
            fullName: (kk?.fullName as string) || u.fullName || (sa?.applicantName as string) || undefined,
            email: u.email || (sa?.emailAddress as string) || undefined,
            phoneNumber: (kk?.contactNumber as string) || (sa?.contactNumber as string) || u.phoneNumber || undefined,
            address: (kk?.addressLine as string) || (sa?.permanentAddress as string) || undefined,
            age:
              sa?.age != null
                ? String(sa.age)
                : kk?.birthDate
                ? String(Math.floor((Date.now() - new Date(kk.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
                : undefined,
            sex: normalizeSex((sa?.gender as string) || (u.latestKkRegistration?.sex as string) || undefined),
        };

        setSessionUser(mapped);
      } catch {
        setSessionUser(null);
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

      const mapped: SessionUser = {
        fullName: (kk?.fullName as string) || u.fullName || (sa?.applicantName as string) || undefined,
        email: u.email || (sa?.emailAddress as string) || undefined,
        phoneNumber: (kk?.contactNumber as string) || (sa?.contactNumber as string) || u.phoneNumber || undefined,
        address: (kk?.addressLine as string) || (sa?.permanentAddress as string) || undefined,
        age:
          sa?.age != null
            ? String(sa.age)
            : kk?.birthDate
            ? String(Math.floor((Date.now() - new Date(kk.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
            : undefined,
        sex: normalizeSex((sa?.gender as string) || (u.latestKkRegistration?.sex as string) || undefined),
      };

      return mapped;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedImage) {
          setIsPreviewOpen(false);
          window.setTimeout(() => setSelectedImage(null), 200);
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

        if (result?.error === "Already registered for this event") {
          setSelectedRegisterEvent(null);
          setEventList((current) =>
            current.map((event) =>
              event.id === eventId
                ? {
                    ...event,
                    isRegistered: true,
                  }
                : event
            )
          );
        }

        setNotification({ type: "error", message: result?.error || "Registration failed. Please try again." });
      } else {
        setNotification({ type: "success", message: "You have successfully registered for this event." });
        setSelectedRegisterEvent(null);
        setEventList((current) =>
          current.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  filledSlots: Math.min(event.filledSlots + 1, event.maxSlots),
                  isRegistered: true,
                }
              : event
          )
        );
      }
    } catch (error) {
      setNotification({ type: "error", message: "Registration failed. Please check your connection and try again." });
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

  const openRegisterModal = async (event: EventItem) => {
    // If the user is not signed in, prompt them to complete KK profiling first.
    if (!sessionUser) {
      setShowKkModal(true);
      return;
    }

    setRegisterFormError(null);
    setSelectedRegisterEvent(event);

    // Refresh session data to ensure autofill uses the latest KK/SKEAP profile
    const mapped = await fetchAndMapSession();
    const mf = mapped || sessionUser || {};
    setSessionUser(mf as SessionUser);

    setRegisterForm({
      fullName: getAutofilledFullName(),
      email: mf.email || "",
      phoneNumber: mf.phoneNumber || "",
      address: mf.address || "",
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

    await handleRegister(selectedRegisterEvent.id);
  };

  const orderedEvents = useMemo(() => {
    return [...eventList].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [eventList]);

  return (
    <>
      {notification?.type === "error" ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
          {notification.message}
        </div>
      ) : null}

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
            <h3 className="mt-4 text-center text-xl font-bold text-slate-900">Registration successful</h3>
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

      <div className="grid auto-rows-fr gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {orderedEvents.map((event) => {
          const pct = event.maxSlots > 0 ? Math.round((event.filledSlots / event.maxSlots) * 100) : 0;
          const isFull = event.filledSlots >= event.maxSlots;
          const isOpen = ["REGISTRATION_OPEN", "UPCOMING"].includes(event.status);
          const isRegistered = Boolean(event.isRegistered);
          const isAllowedToRegister = ["YOUTH", "GRANTEE"].includes((currentUserRole || "").toUpperCase());
          const isLoading = registeringId === event.id;
          // Allow anonymous users to click the register button so we can show the KK profiling modal.
          const isButtonDisabled = isRegistered || (!isAllowedToRegister && Boolean(currentUserRole)) || !isOpen || isFull || isLoading;
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </>
                ) : (
                  <div className="text-center text-white">
                    <div className="text-3xl font-black mb-1">
                      {eventDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-xs uppercase tracking-[0.24em] opacity-80">SK Official Event</div>
                  </div>
                )}

                <div className="absolute left-4 top-4 flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-white/95 shadow-md backdrop-blur">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {eventDate.toLocaleString("en-US", { month: "short" }).toUpperCase()}
                  </span>
                  <span className="text-lg font-bold leading-none text-slate-900">{eventDate.getDate().toString().padStart(2, "0")}</span>
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
                    {isFull ? "Full" : isOpen ? "Open" : "Upcoming"}
                  </div>
                </div>

                <p className="mt-2 line-clamp-2 min-h-[3rem] text-sm leading-6 text-slate-600">{event.description}</p>

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
                    <div className="h-2.5 rounded-full bg-[#0F3D5C] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-900"
                >
                  View details
                  <ArrowUpRight className="h-3 w-3" />
                </button>

                <div className="mt-auto pt-6">
                  <button
                    type="button"
                    onClick={() => openRegisterModal(event)}
                    disabled={isButtonDisabled}
                    className={`w-full h-11 text-xs font-semibold rounded-xl transition-all duration-150 flex items-center justify-center gap-2 border ${
                      isButtonDisabled
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : "bg-[#0B192C] hover:bg-slate-800 text-white border-transparent cursor-pointer active:scale-[0.99]"
                    }`}
                  >
                        {isLoading
                          ? "Registering..."
                          : isRegistered
                          ? "Already registered"
                          : !isAllowedToRegister && Boolean(currentUserRole)
                          ? "Role Restricted"
                          : !isOpen || isFull
                          ? "Registration closed"
                          : "Register now"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/55 backdrop-blur-[2px] px-4 pt-20 pb-8"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="relative mx-auto mt-4 mb-6 w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-2xl"
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

            <div className="max-h-[calc(100vh-6rem)] space-y-6 overflow-y-auto px-6 py-6">
              {selectedEvent.imageUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(selectedEvent.imageUrl || null);
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
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 sm:col-span-2">
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    Registration
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedEvent.filledSlots}/{selectedEvent.maxSlots} registered
                  </p>
                </div>
              </div>
            </div>
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
                  {/* Intentionally removed auxiliary auto-fill message per UX request */}
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
                  disabled={registeringId === selectedRegisterEvent.id}
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

        {showKkModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] px-4 py-6"
            onClick={() => setShowKkModal(false)}
          >
            <div
              className="w-full max-w-lg rounded-[1.25rem] bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-600">S K program access</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">KK Profiling required first</h3>
                <p className="mt-3 text-sm text-slate-600">
                  To register for community events you must first complete the Katipunan ng Kabataan (KK) profiling. This ensures events are reserved for verified residents.
                </p>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowKkModal(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Maybe later
                </button>
                <button
                  type="button"
                  onClick={() => (window.location.href = "/programs/kk-profiling")}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Go to KK Profiling
                </button>
              </div>
            </div>
          </div>
        ) : null}

      {selectedImage ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 transition-opacity duration-200 ${
            isPreviewOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => {
            setIsPreviewOpen(false);
            window.setTimeout(() => setSelectedImage(null), 200);
          }}
        >
          <button
            type="button"
            aria-label="Close image preview"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={() => {
              setIsPreviewOpen(false);
              window.setTimeout(() => setSelectedImage(null), 200);
            }}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={selectedImage}
            alt={selectedImageTitle || "Event image preview"}
            className={`max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl transition-transform duration-200 ${
              isPreviewOpen ? "scale-100" : "scale-95"
            }`}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
