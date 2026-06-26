"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

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

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ totalMonthlyUsers: number; newParticipantPercent: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
        <div className="mb-10 rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 backdrop-blur-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.35em] text-teal-700 transition hover:text-teal-900">
                ← Back to admin
              </Link>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                Manage Youth Events
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Build the official events schedule for youth programs, monitor registration capacity, and keep the community informed with polished event details.
              </p>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-[#00B4E5] to-[#0F3D5C] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition duration-300 hover:scale-[1.01] active:scale-[0.98]"
            >
              + Add new event
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-900/95 p-6 text-white shadow-sm">
              <div className="h-20 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Total events</p>
                <p className="mt-3 text-4xl font-black leading-tight flex items-center">{events.length}</p>
              </div>
              <p className="mt-3 text-sm text-slate-300">Published event listings</p>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-20 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Total Registered</p>
                <p className="mt-3 text-4xl font-black text-slate-900 leading-tight flex items-center">{totalAttendeesRegistered}</p>
              </div>
              <p className="mt-3 text-sm text-slate-500">Youth registered across all events</p>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-20 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Open seats</p>
                <p className="mt-3 text-4xl font-black text-slate-900 leading-tight flex items-center">{openSeats}</p>
              </div>
              <p className="mt-3 text-sm text-slate-500">Available registrations remaining</p>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-20 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">New participants</p>
                <p className="mt-3 text-4xl font-black text-slate-900 leading-tight flex items-center">{newParticipantMetric}</p>
              </div>
              <p className="mt-3 text-sm text-slate-500">First-time event attendees registered this month.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8">
          <section className="space-y-8">
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

            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Events list</p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">Published events</h2>
                </div>
                <span className="text-sm text-slate-500">{events.length} events</span>
              </div>

              <div className="mt-6 space-y-6">
                {loading ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                    Loading event data...
                  </div>
                ) : events.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                    No events have been created yet.
                  </div>
                ) : (
                  events.map((event) => {
                    const slotPercentage = event.maxSlots > 0 ? Math.round((event.filledSlots / event.maxSlots) * 100) : 0;
                    const eventDate = new Date(event.eventDate);
                    return (
                      <article
                        key={event.id}
                        className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                      >
                        <div className="grid gap-6 p-6 lg:grid-cols-[260px_1.6fr_1fr]">
                          <div className="group relative overflow-hidden rounded-[1.75rem] bg-slate-100 shadow-inner">
                            {event.imageUrl ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedImage(event.imageUrl ?? null);
                                    setSelectedImageTitle(event.title);
                                  }}
                                  aria-label={`Open full image for ${event.title}`}
                                  className="absolute inset-0 z-10"
                                />
                                <img
                                  src={event.imageUrl}
                                  alt={event.title}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  onError={(e) => {
                                    console.error(`Failed to load image for event ${event.id}:`, event.imageUrl);
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                                <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                                  <p className="text-sm font-semibold text-white">View full image</p>
                                </div>
                              </>
                            ) : (
                              <div className="flex h-full min-h-[180px] items-center justify-center text-slate-400">
                                <span className="text-sm font-medium">No image available</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-5">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
                                {event.isKatipunan ? "KK Event" : "SK Event"}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                                {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                                {event.venue}
                              </span>
                            </div>
                            <div className="space-y-3">
                              <h3 className="text-2xl font-semibold text-slate-900">{event.title}</h3>
                              <p className="text-sm leading-7 text-slate-600">{event.description}</p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Filled slots</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900">{event.filledSlots}</p>
                              </div>
                              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Capacity</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900">{event.maxSlots}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col justify-between rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                            <div className="space-y-5">
                              <div>
                                <div className="flex items-center justify-between gap-4">
                                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Registration</p>
                                  <p className="text-sm font-semibold text-slate-900">{slotPercentage}% full</p>
                                </div>
                                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white shadow-inner">
                                  <div
                                    className="h-3 rounded-full bg-gradient-to-r from-[#00B4E5] to-[#0F3D5C] transition-all duration-300"
                                    style={{ width: `${slotPercentage}%` }}
                                  />
                                </div>
                              </div>

                              <div className="grid gap-3">
                                <button
                                  onClick={() => handleEdit(event)}
                                  disabled={submitting}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition duration-300 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(deleteConfirm === event.id ? null : event.id)}
                                  disabled={submitting}
                                  className="w-full rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition duration-300 hover:bg-red-100 disabled:opacity-50"
                                >
                                  {deleteConfirm === event.id ? "Cancel" : "Delete"}
                                </button>
                              </div>
                            </div>
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
            </div>
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
        </div>
      </div>
    </div>
  );
}
