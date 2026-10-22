"use client";

import { Check, ChevronDown, Edit2, X } from "lucide-react";
import { useMemo, useState } from "react";

const EXCLUDED_CATEGORIES = new Set(["events", "governance", "technical", "system_overview"]);

type KnowledgeBaseDocument = {
  id: string;
  content: string;
  language: string;
  sourceType: string;
  createdAt: string;
};

export default function KnowledgeBaseAudit({
  documents,
}: {
  documents: KnowledgeBaseDocument[];
}) {
  const [knowledgeBaseDocuments, setKnowledgeBaseDocuments] = useState(documents);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          knowledgeBaseDocuments
            .map((document) => document.sourceType.trim())
            .filter((category) => category && !EXCLUDED_CATEGORIES.has(category.toLowerCase()))
        )
      ).sort((left, right) => left.localeCompare(right)),
    ],
    [knowledgeBaseDocuments]
  );
  const languages = ["All", "ENGLISH", "FILIPINO", "ILOCANO"];
  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedIdQuery = normalizedQuery
      .replace(/^id\s*:\s*/, "")
      .replaceAll("-", "")
      .trim();
    const isIdQuery = /^[0-9a-f]{4,32}$/.test(normalizedIdQuery);
    return knowledgeBaseDocuments.filter((document) => {
      const category = document.sourceType.trim().toLowerCase();
      if (EXCLUDED_CATEGORIES.has(category)) return false;

      const matchesId =
        isIdQuery &&
        document.id.toLowerCase().replaceAll("-", "").startsWith(normalizedIdQuery);
      const matchesText =
        !normalizedQuery ||
        [
          document.content,
          document.language,
          document.sourceType,
          document.createdAt,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesCategory =
        selectedCategory === "All" || category === selectedCategory.toLowerCase();
      const matchesLanguage =
        selectedLanguage === "All" ||
        document.language.toUpperCase() === selectedLanguage;

      return (matchesId || matchesText) && matchesCategory && matchesLanguage;
    });
  }, [knowledgeBaseDocuments, query, selectedCategory, selectedLanguage]);

  function startEditing(document: KnowledgeBaseDocument) {
    setEditingDocumentId(document.id);
    setEditedContent(document.content);
    setSaveError(null);
  }

  function cancelEditing() {
    setEditingDocumentId(null);
    setEditedContent("");
    setSaveError(null);
  }

  async function saveDocument(document: KnowledgeBaseDocument) {
    const content = editedContent.trim();
    if (!content) {
      setSaveError("Chunk content cannot be empty.");
      return;
    }
    if (content.length > 20_000) {
      setSaveError("Chunk content must be 20,000 characters or fewer.");
      return;
    }
    if (content === document.content) {
      cancelEditing();
      return;
    }

    setSavingDocumentId(document.id);
    setSaveError(null);
    try {
      const response = await fetch(`/api/system-admin/knowledge-base/${encodeURIComponent(document.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to update the knowledge-base chunk.");
      }

      setKnowledgeBaseDocuments((current) =>
        current.map((item) => item.id === document.id ? { ...item, content } : item)
      );
      cancelEditing();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update the knowledge-base chunk.");
    } finally {
      setSavingDocumentId(null);
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="knowledge-base-search">Search knowledge base</label>
        <input
          id="knowledge-base-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search text, category, language, or ID prefix (e.g. 319f23dd)..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 sm:max-w-xl"
        />
        <p className="text-sm text-slate-500" aria-live="polite">
          Showing {filteredDocuments.length} of {knowledgeBaseDocuments.length} chunks
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-8 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <label
            htmlFor="knowledge-base-category"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Category
          </label>
          <div className="relative min-w-[250px]">
            <select
              id="knowledge-base-category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-10 text-sm capitalize text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === "All" ? "All Categories" : category.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Language
          </span>
          {languages.map((language) => {
            const isSelected = selectedLanguage === language;
            return (
              <button
                key={language}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedLanguage(language)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  isSelected
                    ? "border-blue-200 bg-blue-100 font-medium text-blue-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {language}
              </button>
            );
          })}
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No current knowledge-base chunks match your search. ID search only finds chunks that still exist in the database.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((document) => (
            <article
              key={document.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                  ID: {document.id}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {document.sourceType}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {document.language}
                </span>
                <time
                  className="ml-auto text-xs text-slate-400"
                  dateTime={document.createdAt}
                >
                  Added {document.createdAt.slice(0, 10)}
                </time>
                {editingDocumentId !== document.id ? (
                  <button
                    type="button"
                    onClick={() => startEditing(document)}
                    disabled={savingDocumentId !== null}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Edit chunk ${document.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {editingDocumentId === document.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editedContent}
                    onChange={(event) => setEditedContent(event.target.value)}
                    maxLength={20_000}
                    aria-label="Edit knowledge-base chunk content"
                    className="min-h-40 w-full rounded-xl border border-emerald-300 p-3 text-sm leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {saveError ? (
                    <p className="text-sm text-rose-600" role="alert">{saveError}</p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={savingDocumentId === document.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveDocument(document)}
                      disabled={savingDocumentId === document.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {savingDocumentId === document.id ? "Saving..." : "Save update"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                  {document.content}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
