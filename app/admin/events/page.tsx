"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  MapPin,
  Users,
  UserCheck,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Hash,
  ArrowUpRight,
  ArrowLeft,
  Download,
  Filter,
  X,
} from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string;
  venue: string;
  eventDate: string;
  maxSlots: number;
  filledSlots: number;
  imageUrl?: string | null;
  status: string;
  isKatipunan: boolean;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

type FilterTab = "all" | "upcoming" | "drafts" | "archived";

type AttendanceParticipant = {
  id: string;
  name: string;
  email: string;
  role: string;
  contact?: string | null;
  barangay?: string | null;
  registeredAt: string;
};

export default function AdminEventsPage() {
  const EVENTS_PER_PAGE = 3;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ totalMonthlyUsers: number; newParticipantPercent: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<"details" | "attendance">("details");
  const [attendanceParticipants, setAttendanceParticipants] = useState<AttendanceParticipant[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [onlyKatipunan, setOnlyKatipunan] = useState(false);
  const [onlyWithImage, setOnlyWithImage] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    venue: "",
    eventDate: "",
    maxSlots: "",
    isKatipunan: false,
    imageUrl: "",
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    const shouldOpenCreate = searchParams.get("new") === "1";
    if (!shouldOpenCreate) return;

    setEditingId(null);
    setForm({
      title: "",
      description: "",
      venue: "",
      eventDate: "",
      maxSlots: "",
      isKatipunan: false,
      imageUrl: "",
    });
    setShowForm(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("new");
    const queryString = nextParams.toString();
    router.replace(queryString ? `/admin/events?${queryString}` : "/admin/events", { scroll: false });
  }, [searchParams, router]);

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && selectedEvent) {
        setSelectedEvent(null);
      }
    }

    if (selectedEvent) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
    return;
  }, [selectedEvent]);

  const closePreview = () => {
    setIsPreviewOpen(false);
    window.setTimeout(() => setSelectedImage(null), 200);
  };

  const closeDetails = () => {
    setSelectedEvent(null);
    setViewMode("details");
    setAttendanceParticipants([]);
    setAttendanceError(null);
  };

  const openAttendanceView = async () => {
    if (!selectedEvent) return;

    setViewMode("attendance");
    setAttendanceError(null);
    setAttendanceLoading(true);

    try {
      const response = await fetch(`/api/events/${selectedEvent.id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load attendance roster.");
      }

      setAttendanceParticipants(Array.isArray(payload?.participants) ? payload.participants : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load attendance roster.";
      setAttendanceParticipants([]);
      setAttendanceError(message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const downloadAttendanceCSV = () => {
    if (!selectedEvent || attendanceParticipants.length === 0) return;

    const csvHeaders = [
      "FULL NAME",
      "CONTACT NUMBER",
      "RESIDENT BARANGAY",
      "SIGNATURE",
    ];
    const csvRows = attendanceParticipants.map((participant) => [
      participant.name.toUpperCase(),
      participant.contact || "",
      participant.barangay || "N/A",
      "",
    ]);

    const csvContent = [
      `EVENT ATTENDANCE ROSTER - ${selectedEvent.title.toUpperCase()}`,
      "",
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = selectedEvent.title.replace(/[^a-zA-Z0-9-_]+/g, "_");
    link.href = url;
    link.setAttribute("download", `Attendance_Sheet_${safeTitle || "Event"}_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredEvents = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const queryFiltered = !lowerQuery
      ? events
      : events.filter((event) => {
          return (
            event.title.toLowerCase().includes(lowerQuery) ||
            event.description.toLowerCase().includes(lowerQuery) ||
            event.venue.toLowerCase().includes(lowerQuery) ||
            event.id.toLowerCase().includes(lowerQuery)
          );
        });

    const now = new Date();
    const tabFiltered = queryFiltered.filter((event) => {
      const eventDate = new Date(event.eventDate);
      const status = event.status?.toLowerCase() ?? "";

      if (activeTab === "upcoming") {
        return eventDate >= now && status !== "archived";
      }

      if (activeTab === "drafts") {
        return status === "draft";
      }

      if (activeTab === "archived") {
        return status === "archived" || eventDate < now;
      }

      return true;
    });

    return tabFiltered.filter((event) => {
      if (onlyKatipunan && !event.isKatipunan) {
        return false;
      }

      if (onlyWithImage && !event.imageUrl) {
        return false;
      }

      return (
        true
      );
    });
  }, [events, query, activeTab, onlyKatipunan, onlyWithImage]);

  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, currentPage, EVENTS_PER_PAGE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, activeTab, onlyKatipunan, onlyWithImage]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalEventPages));
  }, [totalEventPages]);

  async function fetchSummary() {
    try {
      const response = await fetch("/api/events/summary");
      const data = await response.json();
      if (response.ok) {
        setSummary({
          totalMonthlyUsers: data.totalMonthlyUsers ?? 0,
          newParticipantPercent: data.newParticipantPercent ?? 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch event summary:", error);
      setSummary(null);
    }
  }

  async function fetchEvents() {
    try {
      setLoading(true);
      const response = await fetch("/api/events");
      const data = await response.json();
      const eventsList = Array.isArray(data) ? data : [];
      
      // Log image status for debugging
      console.log("📸 Events Image Status:");
      eventsList.forEach(event => {
        console.log(`  • ${event.title}: ${event.imageUrl ? '✅ Has image' : '❌ No image'}`);
        if (event.imageUrl) {
          console.log(`    URL: ${event.imageUrl.substring(0, 100)}...`);
        }
      });
      
      setEvents(eventsList);
      await fetchSummary();
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.venue.trim() || !form.eventDate || !form.maxSlots) {
      alert("All fields are required");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId ? `/api/events/${editingId}` : "/api/events/create";
      const method = editingId ? "PUT" : "POST";

      // Check if imageUrl is a large data URL
      let imageUrl = form.imageUrl && form.imageUrl.trim() ? form.imageUrl.trim() : null;
      if (imageUrl && imageUrl.startsWith("data:")) {
        const sizeInMB = (imageUrl.length / (1024 * 1024)).toFixed(2);
        console.warn(`Data URL size: ${sizeInMB}MB`);
        if (imageUrl.length > 10 * 1024 * 1024) {
          throw new Error(`Image data too large (${sizeInMB}MB). Max 10MB allowed.`);
        }
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        eventDate: form.eventDate,
        maxSlots: Number(form.maxSlots),
        isKatipunan: form.isKatipunan,
        imageUrl: imageUrl,
      };

      console.log("Submitting payload:", { ...payload, imageUrl: payload.imageUrl ? `[${payload.imageUrl.substring(0, 30)}...${payload.imageUrl.length} bytes]` : null });

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("API error response:", response.status, data);
        throw new Error(data.error || data.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Event saved successfully");
      
      setForm({
        title: "",
        description: "",
        venue: "",
        eventDate: "",
        maxSlots: "",
        isKatipunan: false,
        imageUrl: "",
      });
      setShowForm(false);
      setEditingId(null);
      await fetchEvents();
    } catch (err) {
      console.error("Form submission error:", err);
      alert(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImageFile(file: File | null) {
    if (!file) return;
    try {
      setUploadingImage(true);
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/announcements/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      console.log("Upload response:", data);
      
      if (!res.ok) throw new Error(data.error || "Upload failed");
      
      if (!data.url) {
        throw new Error("Upload response missing URL");
      }

      setForm((s) => ({ ...s, imageUrl: data.url }));
      console.log("Image URL set successfully");
    } catch (err) {
      console.error("Image upload failed:", err);
      alert(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      setDeleteConfirm(null);
      await fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(event: Event) {
    const eventDateTime = new Date(event.eventDate);
    const isoString = eventDateTime.toISOString().slice(0, 16);

    setForm({
      title: event.title,
      description: event.description,
      venue: event.venue,
      eventDate: isoString,
      maxSlots: event.maxSlots.toString(),
      isKatipunan: event.isKatipunan,
      imageUrl: event.imageUrl || "",
    });
    setEditingId(event.id);
    setShowForm(true);
  }

  function handleCancel() {
    setForm({
      title: "",
      description: "",
      venue: "",
      eventDate: "",
      maxSlots: "",
      isKatipunan: false,
      imageUrl: "",
    });
    setShowForm(false);
    setEditingId(null);
  }

  const totalSlots = events.reduce((sum, event) => sum + event.maxSlots, 0);
  const totalAttendeesRegistered = events.reduce((sum, event) => sum + event.filledSlots, 0);
  const openSeats = Math.max(totalSlots - totalAttendeesRegistered, 0);
  const upcomingEvents = events
    .filter((event) => new Date(event.eventDate) >= new Date())
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  const nextEvent = upcomingEvents[0];

  const newParticipantMetric = useMemo(() => {
    if (!summary) return "0%";
    return `${summary.newParticipantPercent}%`;
  }, [summary]);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Events · Live
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Published events
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Track registrations, manage capacity, and keep your community in sync — all from one elegant overview.
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-3 sm:items-center">
            <Stat label="Events" value={events.length.toString()} />
            <Stat label="Registered" value={`${totalAttendeesRegistered}/${totalSlots}`} />
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex h-12 self-center items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New event
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events, codes…"
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-900/5"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={activeTab === "all"} onClick={() => setActiveTab("all")}>All</Chip>
            <Chip active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")}>Upcoming</Chip>
            <Chip active={activeTab === "drafts"} onClick={() => setActiveTab("drafts")}>Drafts</Chip>
            <Chip active={activeTab === "archived"} onClick={() => setActiveTab("archived")}>Archived</Chip>
            <button
              type="button"
              onClick={() => setShowFilterOptions((prev) => !prev)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition " +
                (showFilterOptions || onlyKatipunan || onlyWithImage
                  ? "border-slate-300 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
              }
            >
              <Filter className="h-3.5 w-3.5" />
              Filters {(onlyKatipunan ? 1 : 0) + (onlyWithImage ? 1 : 0) > 0 ? `(${(onlyKatipunan ? 1 : 0) + (onlyWithImage ? 1 : 0)})` : ""}
            </button>
          </div>
        </div>
        {showFilterOptions && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setOnlyKatipunan((prev) => !prev)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                  (onlyKatipunan
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                }
              >
                KK events only
              </button>
              <button
                type="button"
                onClick={() => setOnlyWithImage((prev) => !prev)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                  (onlyWithImage
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                }
              >
                With image only
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnlyKatipunan(false);
                  setOnlyWithImage(false);
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
        <div className="mt-8 space-y-8">
          {showForm && (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-teal-700">{editingId ? "Edit event" : "Create event"}</p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">{editingId ? "Update event details" : "Publish a new event"}</h2>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Close form
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-900">Event title</span>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                      placeholder="Youth Leadership Summit"
                      className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-900">Venue</span>
                    <input
                      type="text"
                      value={form.venue}
                      onChange={(e) => setForm((s) => ({ ...s, venue: e.target.value }))}
                      placeholder="Barangay Hall"
                      className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-900">Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    placeholder="Summarize the event in a few sentences..."
                    rows={5}
                    className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 transition resize-none"
                  />
                </label>

                <div className="grid gap-6 lg:grid-cols-3">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-900">Date & time</span>
                    <input
                      type="datetime-local"
                      value={form.eventDate}
                      onChange={(e) => setForm((s) => ({ ...s, eventDate: e.target.value }))}
                      className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-900">Max seats</span>
                    <input
                      type="number"
                      value={form.maxSlots}
                      onChange={(e) => setForm((s) => ({ ...s, maxSlots: e.target.value }))}
                      min="1"
                      placeholder="30"
                      className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-900">Event image</span>
                  <div className="mt-3">
                    <input
                      id="event-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFile(e.target.files ? e.target.files[0] : null)}
                      className="sr-only"
                    />

                    <label
                      htmlFor="event-image"
                      className="group relative flex items-center gap-4 rounded-lg border-2 border-dashed border-slate-200 bg-white px-4 py-3 cursor-pointer hover:border-slate-300"
                    >
                      <div className="flex-shrink-0">
                        {form.imageUrl ? (
                          <img src={form.imageUrl} alt="Event" className="h-20 w-28 rounded-md object-cover" />
                        ) : (
                          <div className="h-20 w-28 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-sm text-slate-400">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {form.imageUrl ? "Change image" : "Upload event image"}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">Drag & drop or click to choose (JPG, PNG, &lt;5MB)</div>
                      </div>

                      <div className="ml-auto flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const el = document.getElementById("event-image") as HTMLInputElement | null;
                            el?.click();
                          }}
                          className="inline-flex items-center justify-center w-20 rounded-full bg-[#0F3D5C] px-3 py-1 text-sm font-semibold text-white"
                        >
                          {uploadingImage ? "Uploading..." : form.imageUrl ? "Change" : "Choose"}
                        </button>
                        {form.imageUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm((s) => ({ ...s, imageUrl: "" }));
                            }}
                            className="inline-flex items-center justify-center w-20 text-sm font-semibold text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </label>
                  </div>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-3xl bg-gradient-to-r from-[#00B4E5] to-[#0F3D5C] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition duration-300 hover:shadow-xl disabled:opacity-50"
                  >
                    {submitting ? (editingId ? "Saving changes..." : "Publishing...") : editingId ? "Save changes" : "Publish event"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    className="rounded-3xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-900 transition duration-300 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Events list</p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">Published events</h2>
                </div>
                <span className="text-sm text-slate-500">{filteredEvents.length} events</span>
              </div>

              <div className="space-y-6">
                {loading ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                    Loading event data...
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                    No events match your selected filters.
                  </div>
                ) : (
                  paginatedEvents.map((event) => {
                    const slotPercentage = event.maxSlots > 0 ? Math.round((event.filledSlots / event.maxSlots) * 100) : 0;
                    const eventDate = new Date(event.eventDate);
                    return (
                      <article
                        key={event.id}
                        className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-20px_rgba(15,23,42,0.18)]"
                      >
                        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[280px_1fr_280px]">
                          <div
                            className="relative h-52 overflow-hidden lg:h-56"
                            role={event.imageUrl ? "button" : undefined}
                            tabIndex={event.imageUrl ? 0 : -1}
                            onClick={() => {
                              if (!event.imageUrl) return;
                              setSelectedImage(event.imageUrl);
                              setSelectedImageTitle(event.title);
                            }}
                            onKeyDown={(e) => {
                              if (!event.imageUrl) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedImage(event.imageUrl);
                                setSelectedImageTitle(event.title);
                              }
                            }}
                            aria-label={event.imageUrl ? `Open full image for ${event.title}` : undefined}
                          >
                            {event.imageUrl ? (
                              <>
                                <img
                                  src={event.imageUrl}
                                  alt={event.title}
                                  className="h-full w-full cursor-zoom-in object-cover transition duration-700 group-hover:scale-105"
                                  onError={(e) => {
                                    console.error(`Failed to load image for event ${event.id}:`, event.imageUrl);
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </>
                            ) : (
                              <div className="flex h-full min-h-[192px] items-center justify-center bg-slate-100 text-sm text-slate-500">
                                No image available
                              </div>
                            )}

                            <div className="absolute left-4 top-4 flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-white/95 shadow-md backdrop-blur">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{eventDate.toLocaleString("en-US", { month: "short" }).toUpperCase()}</span>
                              <span className="text-lg font-bold leading-none text-slate-900">{eventDate.getDate().toString().padStart(2, "0")}</span>
                            </div>
                          </div>

                          <div className="flex flex-col justify-between p-6 lg:p-7">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                  {event.isKatipunan ? "KK Event" : "SK Event"}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                  {event.id}
                                </span>
                              </div>
                              <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">{event.title}</h3>
                              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">{event.description}</p>

                              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                  {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                  {event.venue}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-slate-400" />
                                  {event.filledSlots}/{event.maxSlots} registered
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 border-t border-slate-100 p-6 lg:border-l lg:border-t-0 lg:p-7">
                            <div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Registration</span>
                                <span className={`text-sm font-semibold ${slotPercentage >= 100 ? "text-rose-600" : "text-slate-900"}`}>
                                  {slotPercentage}% full
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-500"
                                  style={{ width: `${slotPercentage}%` }}
                                />
                              </div>
                              <div className="mt-2 text-xs text-slate-500">{Math.max(event.maxSlots - event.filledSlots, 0)} slots remaining</div>
                            </div>

                            <div className="mt-auto flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(event)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(deleteConfirm === event.id ? null : event.id)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                              <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEvent(event);
                                setViewMode("details");
                                setAttendanceParticipants([]);
                                setAttendanceError(null);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                            >
                              View details
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {deleteConfirm === event.id && (
                          <div className="border-t border-slate-200 bg-red-50 px-6 py-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-red-700">Confirm deletion for this event. This cannot be undone.</p>
                              <button
                                onClick={() => handleDelete(event.id)}
                                disabled={submitting}
                                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:bg-red-700 disabled:opacity-50"
                              >
                                {submitting ? "Deleting..." : "Confirm delete"}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>

              {!loading && filteredEvents.length > EVENTS_PER_PAGE && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-medium text-slate-500">
                    Page {currentPage} of {totalEventPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalEventPages }, (_, idx) => idx + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={
                          "h-8 w-8 rounded-full text-xs font-semibold transition " +
                          (currentPage === page
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                        }
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalEventPages, prev + 1))}
                      disabled={currentPage === totalEventPages}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

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

          {selectedEvent ? (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-4 py-6"
              onClick={closeDetails}
            >
              <div
                className="relative w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
                  {viewMode === "attendance" ? (
                    <button
                      type="button"
                      onClick={() => setViewMode("details")}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Event Details
                    </button>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                        {selectedEvent.isKatipunan ? "KK Event" : "SK Event"}
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.title}</h3>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {viewMode === "attendance" ? (
                      <button
                        type="button"
                        onClick={downloadAttendanceCSV}
                        disabled={attendanceParticipants.length === 0}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B192C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                        Download Attendance
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeDetails}
                      aria-label="Close event details"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[80vh] overflow-y-auto bg-slate-50/50 px-6 py-6">
                  {viewMode === "details" ? (
                    <div className="space-y-6">
                      {selectedEvent.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(selectedEvent.imageUrl ?? null);
                            setSelectedImageTitle(selectedEvent.title);
                          }}
                          className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={selectedEvent.imageUrl}
                            alt={selectedEvent.title}
                            className="h-auto max-h-[60vh] w-full object-contain"
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/55 to-transparent px-4 py-3 text-left opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                            <p className="text-xs font-medium text-white">Click image for full-screen preview</p>
                          </div>
                        </button>
                      ) : null}

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Description</p>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{selectedEvent.description}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
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
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            Venue
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{selectedEvent.venue}</p>
                        </div>
                        <button
                          type="button"
                          onClick={openAttendanceView}
                          className="group relative rounded-2xl border-2 border-indigo-100 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500 active:translate-y-0 sm:p-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
                                Registration (Click to open)
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {selectedEvent.filledSlots}/{selectedEvent.maxSlots} registered
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {Math.max(selectedEvent.maxSlots - selectedEvent.filledSlots, 0)} slots remaining
                              </p>
                            </div>
                            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                              <Users className="h-5 w-5" />
                            </div>
                          </div>
                          <span className="mt-3 inline-flex text-[10px] font-semibold text-indigo-600">
                            View Roster Sheet →
                          </span>
                        </button>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            <Hash className="h-3.5 w-3.5 text-slate-400" />
                            Event code
                          </p>
                          <p className="mt-2 break-all text-sm font-semibold text-slate-900">{selectedEvent.id}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                          Registered Participants ({attendanceParticipants.length})
                        </span>
                      </div>

                      {attendanceLoading ? (
                        <div className="px-4 py-8 text-sm text-slate-500">Loading attendance roster...</div>
                      ) : attendanceError ? (
                        <div className="px-4 py-8 text-sm text-rose-600">{attendanceError}</div>
                      ) : attendanceParticipants.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-slate-500">No participants registered yet.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/40">
                                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Full Name</th>
                                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Contact Number</th>
                                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Email Address</th>
                                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">System Role</th>
                                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Barangay</th>
                                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Registration Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                              {attendanceParticipants.map((participant) => (
                                <tr key={participant.id} className="transition hover:bg-slate-50/70">
                                  <td className="px-4 py-3 font-semibold text-slate-900">{participant.name}</td>
                                  <td className="px-4 py-3 text-slate-600">{participant.contact || "N/A"}</td>
                                  <td className="px-4 py-3 font-mono text-slate-500">{participant.email}</td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                        participant.role === "GRANTEE"
                                          ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                                          : "border-amber-100 bg-amber-50 text-amber-700"
                                      }`}
                                    >
                                      {participant.role}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{participant.barangay || "N/A"}</td>
                                  <td className="px-4 py-3 text-slate-500">
                                    {new Date(participant.registeredAt).toLocaleString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex h-14 min-w-[92px] flex-col justify-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-full px-3.5 py-1.5 text-xs font-medium transition " +
        (active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")
      }
    >
      {children}
    </button>
  );
}
