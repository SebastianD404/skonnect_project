"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, ClipboardList, Send, FileText, Image, X, Download } from "lucide-react";

interface DocumentItem {
  id: string;
  label: string;
  type: string;
  previewUrl: string;
  verified: boolean;
  comment: string;
  isImage: boolean;
  status?: "Pending" | "Returned" | "Verified" | string;
}

interface ApplicationMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  attachments?: AttachedFileNote[];
}

interface AttachedFileNote {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  adminRemark: string;
  fileStatus?: "FLAGGED" | "REJECTED" | "PENDING" | string;
}

interface ApplicationRecord {
  id: string;
  applicantName: string;
  applicantEmail: string;
  yearLevel: string;
  school: string;
  submittedAt: string;
  status: string;
  documents: DocumentItem[];
  messages: ApplicationMessage[];
}

function isValidAttachedFileNote(note: unknown): note is AttachedFileNote {
  return (
    typeof note === "object" &&
    note !== null &&
    typeof (note as any).fileId === "string" &&
    typeof (note as any).fileName === "string" &&
    typeof (note as any).fileUrl === "string" &&
    typeof (note as any).fileType === "string" &&
    typeof (note as any).adminRemark === "string"
  );
}

function getDocumentReviewStatus(doc: DocumentItem, reviewThread: ApplicationMessage[]) {
  if (doc.status === "Returned") return "Returned";

  const flaggedAttachment = reviewThread
    .flatMap((message) => message.attachments ?? [])
    .find((attachment) => {
      const isTargetedDocument =
        attachment.fileId === doc.id ||
        attachment.fileUrl === doc.previewUrl ||
        attachment.fileUrl?.includes(doc.label) ||
        attachment.fileName === doc.label;

      return (
        isTargetedDocument &&
        /flagged|returned|rejected/i.test(attachment.fileStatus ?? attachment.adminRemark ?? "")
      );
    });

  if (flaggedAttachment) return "Returned";
  if (doc.verified) return "Verified";
  return "Pending";
}

function normalizeApplicationStatus(status: string) {
  const normalized = (status || "").trim().toLowerCase();
  if (/returned|correction|required|resubmit|revise|revision/.test(normalized)) return "Returned";
  if (/approve|approved/.test(normalized)) return "Approved";
  if (/rejected|ineligible/.test(normalized)) return "Ineligible";
  if (/responded/.test(normalized)) return "Responded";
  return "Pending Review";
}

function statusFromReviewText(text: string) {
  const normalized = (text || "").trim();
  if (/returned|correction|required|resubmit|revise|revision/i.test(normalized)) return "Returned";
  if (/approve|approved/i.test(normalized)) return "Approved";
  if (/rejected|ineligible/i.test(normalized)) return "Ineligible";
  return null;
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateString;
  }
}

function extractUrls(text: string) {
  const urlRegex = /https?:\/\/[\w\-./?=&%]+/g;
  return Array.from(text.match(urlRegex) || []);
}

function isUploadedFilesSystemMessage(text: string) {
  return /^Applicant uploaded files:\s*\n?/i.test((text || "").trim());
}

function isImageUrl(url: string) {
  return /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.avif|\.svg)(\?|$)/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

function getFileTypeFromUrl(url: string): "image" | "pdf" | "office" | "document" {
  if (isImageUrl(url)) return "image";
  if (isPdfUrl(url)) return "pdf";
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return "office";
  return "document";
}

function extractFileNameFromUrl(url: string): string {
  try {
    const filename = url.split("/").pop() || "";
    const decoded = decodeURIComponent(filename);
    const cleaned = decoded.replace(/\+/g, " ").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    return normalizeDocumentLabel(cleaned || "Document");
  } catch {
    return "Document";
  }
}

function normalizeDocumentLabel(raw: string): string {
  const label = (raw || "").trim();
  const keyword = label.toLowerCase();
  if (keyword.includes("barangay")) return "Barangay Clearance";
  if (keyword.includes("skeap") && keyword.includes("form")) return "SKEAP Form";
  if (keyword.includes("id") && keyword.includes("photo")) return "ID Photo";
  if (keyword.includes("passport")) return "Passport";
  if (keyword.includes("proof") && keyword.includes("address")) return "Proof of Address";
  if (keyword.includes("recommendation")) return "Recommendation Letter";
  const stripped = label.replace(/^[0-9]{8,}\s*[-_ ]?/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stripped || "Document";
}

function getDocumentInlineRemark(doc: DocumentItem, reviewThread: ApplicationMessage[]) {
  return (
    reviewThread
      .flatMap((message) => message.attachments ?? [])
      .filter((attachment) => attachment.fileId === doc.id)
      .map((attachment) => attachment.adminRemark)
      .filter(Boolean)
      .pop() ?? ""
  );
}

export default function SkeapApplicationsClient({
  applications: initialApplications,
  counts,
}: {
  applications: ApplicationRecord[];
  counts?: { pending: number; returned: number; approved: number };
}) {
  const [applications, setApplications] = useState<ApplicationRecord[]>(initialApplications);
  const [selectedAppId, setSelectedAppId] = useState<string>(initialApplications[0]?.id ?? "");
  const [messageDraft, setMessageDraft] = useState("");
  const [attachedFileNotes, setAttachedFileNotes] = useState<AttachedFileNote[]>([]);
  const [showApprovePreview, setShowApprovePreview] = useState(false);
  const [activeReviewFile, setActiveReviewFile] = useState<string | null>(null);
  const [reviewModalNote, setReviewModalNote] = useState("");

  const visibleApplications = useMemo(
    () => applications.filter((app) => {
      const s = normalizeApplicationStatus(app.status);
      return s === "Pending Review" || s === "Returned";
    }),
    [applications]
  );

  const selectedApplication =
    applications.find((app) => app.id === selectedAppId) ?? visibleApplications[0] ?? applications[0];

  console.log("RAW WORKSPACE DATA:", applications.map((a) => ({ name: a.applicantName, status: a.status })));

  const stats = useMemo(() => {
    if (counts) return counts;
    return {
      pending: applications.filter((app) => normalizeApplicationStatus(app.status) === "Pending Review").length,
      returned: applications.filter((app) => normalizeApplicationStatus(app.status) === "Returned").length,
      approved: applications.filter((app) => normalizeApplicationStatus(app.status) === "Approved").length,
    };
  }, [applications, counts]);

  const verifiedCount = useMemo(
    () => selectedApplication?.documents.filter((doc) => doc.verified).length ?? 0,
    [selectedApplication]
  );

  function updateSelectedApplication(
    updater: (application: ApplicationRecord) => ApplicationRecord
  ) {
    setApplications((current) =>
      current.map((application) =>
        application.id === selectedApplication?.id ? updater(application) : application
      )
    );
  }

  function toggleDocumentVerified(documentId: string) {
    if (!selectedApplication) return;
    updateSelectedApplication((application) => ({
      ...application,
      documents: application.documents.map((document) =>
        document.id === documentId ? { ...document, verified: !document.verified } : document
      ),
    }));
  }

  async function saveReviewUpdate(action: "message" | "approve", text: string, attachments: AttachedFileNote[]) {
    if (!selectedApplication) return;

    const payload = {
      action,
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
    } as const;

    const response = await fetch(`/api/inquiries/${selectedApplication.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to send review update");
    }

    const body = await response.json();
    return {
      reviewThread: body.reviewThread as ApplicationMessage[] | undefined,
      reviewStatus: typeof body.reviewStatus === "string" ? body.reviewStatus : undefined,
    };
  }

  async function handleSendMessage() {
    if (!messageDraft.trim() && attachedFileNotes.length === 0) return;
    if (!selectedApplication) return;

    try {
        const result = await saveReviewUpdate("message", messageDraft.trim(), attachedFileNotes);
      if (result?.reviewThread) {
        const reviewThread = result.reviewThread;
        const nextStatus = result.reviewStatus || statusFromReviewText(messageDraft.trim()) || selectedApplication.status;
        const flaggedFileIds = attachedFileNotes.map((attachment) => attachment.fileId);

        updateSelectedApplication((application) => {
          const applicantMessage =
            application.messages.find((message) => message.role === "applicant") ?? application.messages[0];
          return {
            ...application,
            status: nextStatus,
            documents: application.documents.map((doc) =>
              flaggedFileIds.includes(doc.id)
                ? { ...doc, status: "Returned" }
                : doc
            ),
            messages: applicantMessage ? [applicantMessage, ...reviewThread] : [...reviewThread],
          };
        });
      }
      setMessageDraft("");
      setAttachedFileNotes([]);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleApprove() {
    if (!selectedApplication) return;

    try {
      const result = await saveReviewUpdate("approve", "Application approved. We will move this applicant to the next step.", []);
      const reviewThread = result?.reviewThread;
      if (reviewThread) {
        updateSelectedApplication((application) => ({
          ...application,
          status: "Approved",
          messages: [
            ...reviewThread,
          ],
        }));
      } else {
        updateSelectedApplication((application) => ({
          ...application,
          status: "Approved",
          messages: [
            {
              id: `msg-${Date.now()}`,
              role: "admin",
              createdAt: new Date().toISOString(),
              text: "Application approved. We will move this applicant to the next step.",
            },
            ...application.messages,
          ],
        }));
      }
    } catch (error) {
      console.error(error);
    }
    setShowApprovePreview(false);
  }

  // Always render the workspace shell. The left column will show a local empty state
  // when there are no visible applications (pending or returned).

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-6 py-8">
        <main className="flex-1 space-y-6">
          <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">SKEAP Applications</p>
                <h1 className="mt-3 text-4xl font-black text-slate-950">Application review workspace</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-600">
                  Select an application to inspect uploaded files, leave reviewer notes, and approve or return applicants.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Pending</p>
                  <p className="mt-3 text-2xl font-black text-slate-950">{stats.pending}</p>
                </div>
                <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-amber-500">Returned</p>
                  <p className="mt-3 text-2xl font-black text-slate-950">{stats.returned}</p>
                </div>
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Approved</p>
                  <p className="mt-3 text-2xl font-black text-slate-950">{stats.approved}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] items-stretch">
            <div className="flex min-h-0 flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Applicant queue</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">Open applications</h2>
                </div>
                <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                  <ClipboardList className="h-4 w-4" />
                  Refresh list
                </button>
              </div>

              <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300">
                {visibleApplications.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
                    <ClipboardList className="h-10 w-10 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">No open applications</p>
                    <p className="text-xs text-slate-500">There are no pending or returned applications to review.</p>
                  </div>
                ) : (
                  visibleApplications.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      onClick={() => setSelectedAppId(application.id)}
                      className={`w-full rounded-[1.75rem] border px-5 py-4 text-left transition ${
                        application.id === selectedAppId
                          ? "border-slate-900 bg-slate-950 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{application.applicantName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {application.school || "No school provided"}
                            {application.school && application.yearLevel ? " • " : ""}
                            {application.yearLevel || ""}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${
                          normalizeApplicationStatus(application.status) === "Returned"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {normalizeApplicationStatus(application.status) === "Returned" ? "Returned" : application.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-500">
                        <span>{formatDate(application.submittedAt)}</span>
                        <span>{application.documents.length} docs</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Application details</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">{selectedApplication?.applicantName ?? "No applicant selected"}</h2>
                    <p className="mt-2 text-sm text-slate-600">{selectedApplication?.applicantEmail ?? ""}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-700 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Status</p>
                    <p className="mt-2 text-sm font-semibold">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                          selectedApplication?.status === "Returned"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : selectedApplication?.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : selectedApplication?.status === "Ineligible"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {selectedApplication?.status === "Returned" ? "Correction Required" : selectedApplication?.status}
                      </span>
                    </p>
                  </div>
                    <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-700 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Submitted</p>
                      <p className="mt-2 font-semibold text-slate-950">{formatDate(selectedApplication?.submittedAt ?? "")}</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-700 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Verified docs</p>
                      <p className="mt-2 font-semibold text-slate-950">
                        {verifiedCount}/{selectedApplication?.documents.length ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setShowApprovePreview(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve Application
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Files</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Documents to verify</h2>
                  </div>
                  <div className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600">
                    {verifiedCount}/{selectedApplication?.documents.length ?? 0}
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200">
                  <div className="divide-y divide-slate-200 bg-white">
                    {(selectedApplication?.documents || []).map((doc) => (
                      <div key={doc.id} className="w-full">
                        <div className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                            {doc.isImage ? (
                              <img
                                src={doc.previewUrl}
                                alt={doc.label}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-600">
                                <FileText className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{doc.label}</p>
                            <p className="truncate text-xs text-slate-500">{doc.type}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={doc.previewUrl}
                              download
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                getDocumentReviewStatus(doc, selectedApplication?.messages ?? []) === "Returned"
                                  ? "bg-red-50 text-red-600 border border-red-100"
                                  : doc.verified
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-100"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {getDocumentReviewStatus(doc, selectedApplication?.messages ?? [])}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveReviewFile(doc.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 transition hover:bg-slate-200"
                            >
                              Review
                            </button>
                          </div>
                        </div>

                        {getDocumentReviewStatus(doc, selectedApplication?.messages ?? []) === "Returned" ? (
                          <div className="ml-20 rounded-r-lg border-l-2 border-red-400 bg-slate-50/70 p-2.5 text-xs text-slate-600">
                            <div className="flex items-center gap-2 font-semibold text-red-600">
                              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                              Reviewer Note:
                            </div>
                            <p className="mt-1 leading-5">{getDocumentInlineRemark(doc, selectedApplication?.messages ?? [])}</p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Conversation</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Return notes & messages</h2>
                  </div>
                  <span className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600">
                    {selectedApplication?.messages?.length ?? 0} messages
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {(selectedApplication?.messages || [])
                    .filter((message) => !isUploadedFilesSystemMessage(message.text))
                    .map((message) => {
                      const urls = extractUrls(message.text);
                      const textWithoutUrls = urls.reduce((text, url) => text.replace(url, ""), message.text).trim();
                      return (
                        <div
                          key={message.id}
                          className={`rounded-[1.5rem] border p-4 ${
                            message.role === "admin"
                              ? "border-emerald-100 bg-emerald-50 text-slate-900"
                              : "border-slate-200 bg-slate-50 text-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-end gap-3 text-xs uppercase tracking-[0.35em] text-slate-500">
                            <span>{formatDate(message.createdAt)}</span>
                          </div>
                          {textWithoutUrls && <p className="mt-3 leading-7 text-sm">{textWithoutUrls}</p>}
                          {urls.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-3">
                              {urls.map((url) => {
                                const fileType = getFileTypeFromUrl(url);
                                const fileName = extractFileNameFromUrl(url);
                                return (
                                  <div key={url}>
                                    {fileType === "image" ? (
                                      <button
                                        type="button"
                                        onClick={() => setActiveReviewFile(`url-${url}`)}
                                        className="overflow-hidden rounded-lg border border-slate-200 hover:shadow-md transition"
                                      >
                                        <img src={url} alt={fileName} className="h-16 w-16 object-cover" />
                                      </button>
                                    ) : (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span className="max-w-[120px] truncate">{fileName}</span>
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {message.attachments.map((attachment) => (
                                <div
                                  key={`${message.id}-${attachment.fileId}`}
                                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                      {attachment.fileType.toLowerCase().includes("image") ? (
                                        <img
                                          src={attachment.fileUrl}
                                          alt={attachment.fileName}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <FileText className="h-5 w-5 text-slate-500" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                                      <p className="mt-1 text-xs text-slate-500">{attachment.adminRemark}</p>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex items-center justify-between gap-2">
                                    <a
                                      href={attachment.fileUrl}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                    >
                                      <Download className="h-4 w-4" />
                                      Download
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {attachedFileNotes.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Attached file notes</p>
                    <div className="space-y-2">
                      {attachedFileNotes.map((attachment, index) => (
                        <div
                          key={`${attachment.fileId}-${index}`}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                        >
                          <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                            {attachment.fileType?.toLowerCase().includes("image") || attachment.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img
                                src={attachment.fileUrl}
                                alt={attachment.fileName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-600">
                                <FileText className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                            <p className="truncate text-xs text-slate-600">{attachment.adminRemark}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachedFileNotes((prev) => prev.filter((_, i) => i !== index));
                            }}
                            className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <label className="block text-sm font-semibold text-slate-900">Write a note to the applicant</label>
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    rows={4}
                    placeholder="Explain what is missing or how to improve the upload."
                    className="mt-3 w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageDraft.trim() && attachedFileNotes.length === 0}
                    className="mt-4 inline-flex items-center gap-2 rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Send message
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {activeReviewFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          {activeReviewFile.startsWith("url-") ? (
            <div className="w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <p className="text-sm font-semibold text-slate-900">Image preview</p>
                <button
                  type="button"
                  onClick={() => setActiveReviewFile(null)}
                  className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-hidden rounded-b-[2rem]">
                <img src={activeReviewFile.replace("url-", "")} alt="Preview" className="w-full h-auto max-h-96 object-contain" />
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl rounded-[2rem] bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Document review</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.label}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.previewUrl}
                    download
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReviewFile(null);
                      setReviewModalNote("");
                    }}
                    className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 overflow-hidden">
                  {selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.isImage ? (
                    <img
                      src={selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.previewUrl}
                      alt="Document preview"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  ) : isPdfUrl(selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.previewUrl || "") ? (
                    <iframe
                      src={selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.previewUrl}
                      title="PDF preview"
                      className="h-[560px] w-full bg-white"
                    />
                  ) : selectedApplication?.documents.find((d) => d.id === activeReviewFile) ? (
                    <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center text-slate-700">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-600">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Click to open live preview wrapper</p>
                        <p className="mt-2 max-w-xl text-xs text-slate-500">
                          This document cannot be rendered natively in-browser. Use the Office viewer for a richer preview experience.
                        </p>
                      </div>
                      <a
                        href={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                          selectedApplication.documents.find((d) => d.id === activeReviewFile)?.previewUrl || ""
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Open live preview
                      </a>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-900">Admin remarks</label>
                  <textarea
                    value={reviewModalNote}
                    onChange={(e) => setReviewModalNote(e.target.value)}
                    placeholder="Add notes about this document..."
                    rows={4}
                    className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeReviewFile) {
                        toggleDocumentVerified(activeReviewFile);
                      }
                    }}
                    className={`inline-flex items-center justify-center gap-2 rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                      selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.verified
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {selectedApplication?.documents.find((d) => d.id === activeReviewFile)?.verified
                      ? "Mark as unverified"
                      : "Mark verified"}
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReviewFile(null);
                        setReviewModalNote("");
                      }}
                      className="inline-flex items-center justify-center rounded-3xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (reviewModalNote.trim() && selectedApplication && activeReviewFile) {
                          const doc = selectedApplication.documents.find((d) => d.id === activeReviewFile);
                          if (doc) {
                            const attachedNote: AttachedFileNote = {
                              fileId: doc.id,
                              fileName: doc.label,
                              fileUrl: doc.previewUrl,
                              fileType: doc.type,
                              adminRemark: reviewModalNote.trim(),
                            };
                            setAttachedFileNotes((prev) => [...prev, attachedNote]);
                          }
                        }
                        setActiveReviewFile(null);
                        setReviewModalNote("");
                      }}
                      disabled={!reviewModalNote.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Save Note & Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {showApprovePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Approval preview</p>
                <h2 className="mt-3 text-3xl font-bold text-slate-950">Approve this applicant</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovePreview(false)}
                className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-6 text-slate-900">
              <div className="flex items-center gap-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Acceptance message preview
              </div>
              <p className="mt-4 leading-7">
                Dear {selectedApplication.applicantName}, your SKEAP application has been approved. We will notify you with onboarding details and next steps for grantee enrollment.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowApprovePreview(false)}
                className="inline-flex items-center justify-center rounded-3xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="inline-flex items-center justify-center rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <ArrowUpRight className="h-4 w-4" />
                Confirm approval
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
