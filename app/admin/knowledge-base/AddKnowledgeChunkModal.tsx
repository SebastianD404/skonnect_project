"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";

export type NewKnowledgeBaseDocument = {
  id: string;
  content: string;
  language: string;
  sourceType: string;
  createdAt: string;
};

function isKnowledgeBaseDocument(value: unknown): value is NewKnowledgeBaseDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Record<string, unknown>;
  return (
    typeof document.id === "string" &&
    typeof document.content === "string" &&
    typeof document.language === "string" &&
    typeof document.sourceType === "string" &&
    typeof document.createdAt === "string"
  );
}

export default function AddKnowledgeChunkModal({
  onCreated,
}: {
  onCreated: (document: NewKnowledgeBaseDocument) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function closeModal() {
    if (isSubmitting) return;
    setIsOpen(false);
    setError(null);
  }

  async function submitChunk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("Enter the knowledge chunk content.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/system-admin/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmedContent }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to add the knowledge chunk.";
        throw new Error(message);
      }

      if (typeof result !== "object" || result === null || !("document" in result) ||
        !isKnowledgeBaseDocument(result.document)) {
        throw new Error("The server returned an invalid knowledge chunk.");
      }

      onCreated(result.document);
      setContent("");
      setIsOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to add the knowledge chunk.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#174968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Policy Note
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-knowledge-chunk-title"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 id="add-knowledge-chunk-title" className="text-lg font-bold text-slate-900">
                  Add Policy Note
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add public guidance for the SKonnect assistant.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={submitChunk} className="space-y-5 px-6 py-5">
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Content</span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={20_000}
                  minLength={1}
                  required
                  rows={8}
                  placeholder="Enter a public policy, program detail, or general FAQ..."
                  className="min-h-[150px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                />
                <span className="block text-right text-xs text-slate-400">
                  {content.length.toLocaleString()} / 20,000
                </span>
              </label>

              <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <p>
                  <span className="font-semibold">Privacy Notice:</span> Ensure no sensitive Personally
                  Identifiable Information (PII) is included in this chunk. Only input public SKEAP
                  policies or general FAQs.
                </p>
              </div>

              {error ? (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174968] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Categorizing and saving..." : "Add Policy Note"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
