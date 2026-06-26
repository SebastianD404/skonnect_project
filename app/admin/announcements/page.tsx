"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, X, Loader2, AlertCircle, Check } from "lucide-react";

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

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
    imageUrl: null as string | null,
  });

  const announcementCount = announcements.length;

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    try {
      setLoading(true);
      const response = await fetch("/api/announcements");
      if (!response.ok) {
        console.error("Announcements endpoint returned non-ok status:", response.status);
        setAnnouncements([]);
        return;
      }
      const data = await response.json();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load announcements:", err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/announcements/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image");
      }

      setForm((s) => ({ ...s, imageUrl: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/announcements/${editingId}`
        : "/api/announcements/create";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to save announcement");
      }

      setForm({ title: "", content: "", imageUrl: null });
      setShowForm(false);
      setEditingId(null);
      await fetchAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      setDeleteConfirm(null);
      await fetchAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete announcement");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(announcement: Announcement) {
    setForm({
      title: announcement.title,
      content: announcement.content,
      imageUrl: announcement.imageUrl,
    });
    setEditingId(announcement.id);
    setShowForm(true);
  }

  function handleCancel() {
    setForm({ title: "", content: "", imageUrl: null });
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] py-12 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F3D5C] mb-6 hover:text-[#00B4E5] transition-colors"
          >
            ← Back to admin
          </Link>
          <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-[#0F3D5C] text-opacity-80">
                  Announcement center
                </p>
                <h1 className="mt-3 text-5xl font-black text-[#0F3D5C]">
                  Manage announcements
                </h1>
                <p className="mt-4 max-w-2xl text-lg text-slate-600">
                  Create, edit, and publish official SK announcements with images for the community feed.
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#00B4E5] to-[#0F3D5C] px-6 py-3 text-sm font-semibold text-white shadow-lg transition duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-95"
              >
                + New announcement
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-8">
            <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-[#0F3D5C] text-opacity-80">
                    Announcement workflow
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-[#0F3D5C]">
                    {showForm ? (editingId ? "Edit announcement" : "Create announcement") : "Announcements"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {showForm
                      ? "Publish an official announcement with an image to the community feed."
                      : `You have ${announcementCount} published announcement${announcementCount === 1 ? "" : "s"}.`}
                  </p>
                </div>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center justify-center rounded-full bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white shadow-sm transition duration-300 hover:bg-[#0D2E47] active:scale-[0.98]"
                  >
                    + Add announcement
                  </button>
                )}
              </div>

              {showForm ? (
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F3D5C] mb-3">
                      Title
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                      placeholder="Enter announcement title"
                      className="w-full rounded-3xl border border-[#0F3D5C]/15 bg-[#F8FBFF] px-5 py-4 text-[#1A1A1A] placeholder-[#94A3B8] focus:border-[#0F3D5C] focus:outline-none focus:ring-2 focus:ring-[#0F3D5C]/10 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0F3D5C] mb-3">
                      Content
                    </label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
                      placeholder="Write the announcement details here"
                      rows={8}
                      className="w-full rounded-3xl border border-[#0F3D5C]/15 bg-[#F8FBFF] px-5 py-4 text-[#1A1A1A] placeholder-[#94A3B8] focus:border-[#0F3D5C] focus:outline-none focus:ring-2 focus:ring-[#0F3D5C]/10 transition resize-none"
                    />
                  </div>

                  {/* Image Upload Section */}
                  <div>
                    <label className="block text-sm font-semibold text-[#0F3D5C] mb-3">
                      Image (Optional)
                    </label>

                    {form.imageUrl ? (
                      <div className="rounded-3xl border-2 border-[#0F3D5C]/20 overflow-hidden bg-[#F8FBFF]">
                        <div className="relative">
                          <img
                            src={form.imageUrl}
                            alt="Preview"
                            className="w-full h-64 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setForm((s) => ({ ...s, imageUrl: null }))}
                            className="absolute top-3 right-3 rounded-full bg-red-500 hover:bg-red-600 text-white p-2 shadow-lg transition"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="px-5 py-4 bg-green-50 border-t border-green-200">
                          <div className="flex items-center gap-2 text-sm text-green-700 font-semibold">
                            <Check className="h-4 w-4" />
                            Image ready to publish
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`relative rounded-3xl border-2 border-dashed transition-all ${
                          dragActive
                            ? "border-[#0F3D5C] bg-[#0F3D5C]/5"
                            : "border-[#0F3D5C]/30 hover:border-[#0F3D5C]/50 bg-[#F8FBFF]"
                        } p-8`}
                      >
                        <input
                          type="file"
                          id="image-upload"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <label
                          htmlFor="image-upload"
                          className="flex flex-col items-center gap-4 cursor-pointer"
                        >
                          {uploadingImage ? (
                            <>
                              <Loader2 className="h-12 w-12 text-[#0F3D5C] animate-spin" />
                              <div className="text-center">
                                <p className="font-semibold text-[#0F3D5C]">Uploading image...</p>
                                <p className="text-sm text-slate-500 mt-1">Please wait</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="rounded-full bg-[#0F3D5C]/10 p-4">
                                <Upload className="h-8 w-8 text-[#0F3D5C]" />
                              </div>
                              <div className="text-center">
                                <p className="font-semibold text-[#0F3D5C]">
                                  Drag and drop your image here
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                  or click to browse • Max 5MB
                                </p>
                              </div>
                            </>
                          )}
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00B4E5] to-[#0F3D5C] px-6 py-3 text-sm font-semibold text-white shadow-lg transition duration-300 hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editingId ? "Updating..." : "Publishing..."}
                        </>
                      ) : editingId ? (
                        "Update announcement"
                      ) : (
                        "Publish announcement"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center rounded-full border border-[#0F3D5C]/20 bg-white px-6 py-3 text-sm font-semibold text-[#0F3D5C] transition duration-300 hover:bg-[#0F3D5C]/5 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-8 rounded-[1.75rem] border border-dashed border-[#0F3D5C]/20 bg-[#F8FBFF] p-8 text-center text-slate-600">
                  <p className="text-lg font-semibold text-[#0F3D5C] mb-2">
                    Create your first announcement
                  </p>
                  <p className="max-w-xl mx-auto text-sm leading-6">
                    Use the button above to compose a new announcement with an optional image and publish it instantly to the community feed.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-[#0F3D5C]/10 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-[#0F3D5C] animate-spin" />
                    </div>
                    <p className="text-slate-600">Loading announcements...</p>
                  </div>
                </div>
              ) : announcements.length === 0 ? (
                <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-10 text-center shadow-sm">
                  <p className="text-base font-semibold text-[#0F3D5C] mb-2">No announcements yet</p>
                  <p className="text-sm leading-6 text-slate-600">
                    Once you create an announcement, it will appear here with editing and delete controls.
                  </p>
                </div>
              ) : (
                announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white overflow-hidden shadow-sm hover:shadow-xl transition"
                  >
                    {/* Facebook-style announcement display */}
                    <div className="p-6">
                      {/* Header with author info */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-semibold text-[#0F3D5C]">{announcement.author.fullName}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(announcement.publishedAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(announcement)}
                            disabled={submitting}
                            className="rounded-full border border-[#0F3D5C]/20 bg-[#F8FBFF] px-4 py-2 text-sm font-semibold text-[#0F3D5C] transition hover:bg-[#0F3D5C]/5 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(deleteConfirm === announcement.id ? null : announcement.id)}
                            disabled={submitting}
                            className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {deleteConfirm === announcement.id ? "Cancel" : "Delete"}
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-2xl font-bold text-[#0F3D5C] mb-3">{announcement.title}</h3>

                      {/* Content */}
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap break-all mb-4">
                        {announcement.content}
                      </p>

                      {/* Image - prominent display */}
                      {announcement.imageUrl && (
                        <div className="rounded-2xl overflow-hidden bg-slate-100 mb-4 -mx-6 -mb-6">
                          <img
                            src={announcement.imageUrl}
                            alt={announcement.title}
                            className="w-full h-80 object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Delete Confirmation */}
                    {deleteConfirm === announcement.id && (
                      <div className="border-t border-[#0F3D5C]/10 px-6 py-4 rounded-b-[2rem] bg-red-50">
                        <p className="text-sm font-semibold text-red-700 mb-4">
                          Are you sure you want to delete this announcement? This action cannot be undone.
                        </p>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          disabled={submitting}
                          className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          {submitting ? "Deleting..." : "Confirm delete"}
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>

          {/* Sidebar Stats */}
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-[#0F3D5C] text-opacity-80">
                Announcement stats
              </p>
              <div className="mt-6 grid gap-4">
                <div className="rounded-3xl bg-gradient-to-br from-[#00B4E5]/10 to-[#0F3D5C]/10 p-5 border border-[#0F3D5C]/10">
                  <p className="text-3xl font-black text-[#0F3D5C]">{announcementCount}</p>
                  <p className="mt-2 text-sm text-slate-600">Published announcements</p>
                </div>
                <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 border border-amber-200">
                  <p className="text-3xl font-black text-amber-600">
                    {announcements.filter(a => {
                      const now = new Date();
                      const announcementDate = new Date(a.publishedAt);
                      return announcementDate.getMonth() === now.getMonth() && 
                             announcementDate.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">This month</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-[#0F3D5C] text-opacity-80 mb-4">
                Tips
              </p>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="text-[#0F3D5C] font-bold">•</span>
                  <span>Add images to make announcements more engaging and shareable</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#0F3D5C] font-bold">•</span>
                  <span>Images are displayed prominently like Facebook posts</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#0F3D5C] font-bold">•</span>
                  <span>Max file size is 5MB; JPG, PNG formats supported</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#0F3D5C] font-bold">•</span>
                  <span>Edit or delete announcements anytime</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
