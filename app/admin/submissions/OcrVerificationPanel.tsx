"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RotateCw, Save, Trash2 } from "lucide-react";

type OcrStatus = "OCR_PENDING" | "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED";
type GradeFlag = "INC" | "DRP" | "W" | "NG" | "FAILED" | null;

type EditableRow = {
  subjectCode: string;
  subjectName: string;
  units: string;
  grade: string;
  flag: GradeFlag;
};

type OcrPayload = {
  ocrStatus: OcrStatus;
  ocrRawText: string | null;
  ocrParsedRows: unknown;
  ocrGwa: number | null;
  ocrTotalUnits: number | null;
  ocrConfidence: number | null;
  gradeReportSemester: string | null;
  fileUrl: string;
};

const STATUS_STYLE: Record<OcrStatus, string> = {
  OCR_PENDING: "bg-sky-50 text-sky-700",
  OCR_DONE: "bg-emerald-50 text-emerald-700",
  OCR_NEEDS_REVIEW: "bg-amber-50 text-amber-700",
  OCR_FAILED: "bg-rose-50 text-rose-700",
};

const STATUS_LABEL: Record<OcrStatus, string> = {
  OCR_PENDING: "Processing",
  OCR_DONE: "OCR complete",
  OCR_NEEDS_REVIEW: "Needs review",
  OCR_FAILED: "OCR failed",
};

function getRows(value: unknown): EditableRow[] {
  if (!value || typeof value !== "object") return [];
  const candidate = value as { rows?: unknown };
  if (!Array.isArray(candidate.rows)) return [];

  return candidate.rows.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{
      subjectCode: typeof row.subjectCode === "string" ? row.subjectCode : "",
      subjectName: typeof row.subjectName === "string" ? row.subjectName : "",
      units: row.units == null ? "" : String(row.units),
      grade: row.grade == null ? "" : String(row.grade),
      flag:
        row.flag === "INC" || row.flag === "DRP" || row.flag === "W" || row.flag === "NG" || row.flag === "FAILED"
          ? row.flag
          : null,
    }];
  });
}

function computeLiveGwa(rows: EditableRow[]) {
  const gradedRows = rows
    .filter((row) => {
      const grade = Number(row.grade);
      return row.grade.trim() && Number.isFinite(grade) && grade >= 1 && grade < 5 && !row.flag;
    })
    .map((row) => ({ grade: Number(row.grade), units: Number(row.units) }))
    .filter((row) => Number.isFinite(row.units) && row.units > 0);
  const totalUnits = gradedRows.reduce((total, row) => total + row.units, 0);
  if (totalUnits === 0) return null;
  const total = gradedRows.reduce((sum, row) => sum + row.grade * row.units, 0);
  return Number((total / totalUnits).toFixed(2));
}

export default function OcrVerificationPanel({ submissionId }: { submissionId: string }) {
  const [data, setData] = useState<OcrPayload | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyPayload = useCallback((payload: OcrPayload) => {
    setData(payload);
    setRows(getRows(payload.ocrParsedRows));
    setError(null);
  }, []);

  const loadOcrData = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}/ocr`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load OCR data.");
      applyPayload(body as OcrPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load OCR data.");
    } finally {
      setLoading(false);
    }
  }, [applyPayload, submissionId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/submissions/${submissionId}/ocr`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load OCR data.");
        return body as OcrPayload;
      })
      .then((payload) => {
        if (active) applyPayload(payload);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load OCR data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyPayload, submissionId]);

  function updateRow(index: number, changes: Partial<EditableRow>) {
    setRows((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...changes } : row
    ));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { subjectCode: "", subjectName: "", units: "", grade: "", flag: null },
    ]);
  }

  async function saveOverrides() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ocr/override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          correctedRows: rows.map((row) => ({
            subjectCode: row.subjectCode || null,
            subjectName: row.subjectName,
            units: Number(row.units),
            grade: row.grade ? Number(row.grade) : null,
            flag: row.flag,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save corrected grades.");
      setNotice("Corrected grades saved and verified.");
      await loadOcrData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save corrected grades.");
    } finally {
      setSaving(false);
    }
  }

  async function retryOcr() {
    setRetrying(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ocr/re-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not re-run OCR.");
      setNotice("OCR processing started. Refresh this panel shortly to see the result.");
      await loadOcrData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not re-run OCR.");
    } finally {
      setRetrying(false);
    }
  }

  const liveGwa = computeLiveGwa(rows);
  const canEditRows = data?.ocrStatus === "OCR_DONE" ||
    data?.ocrStatus === "OCR_NEEDS_REVIEW" ||
    manualEntry;

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading OCR verification...
        </div>
      ) : error && !data ? (
        <div className="p-4 text-sm text-rose-700">{error}</div>
      ) : data ? (
        <div className="grid min-h-[520px] grid-cols-1 xl:grid-cols-2">
          <div className="flex min-h-[420px] flex-col border-b border-slate-200 bg-slate-100 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Original grade report</h4>
                {data.gradeReportSemester ? (
                  <p className="mt-0.5 text-xs text-slate-500">{data.gradeReportSemester}</p>
                ) : null}
              </div>
              <a
                href={data.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-cyan-800 underline underline-offset-2"
              >
                Open in new tab
              </a>
            </div>
            <iframe
              title="Original grade report"
              src={data.fileUrl}
              className="min-h-[420px] w-full flex-1 bg-slate-200"
            />
          </div>

          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Extracted grade details</h4>
                {data.ocrConfidence !== null ? (
                  <p className="mt-1 text-xs text-slate-500">
                    OCR confidence: {data.ocrConfidence.toFixed(1)}%
                  </p>
                ) : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[data.ocrStatus]}`}>
                {STATUS_LABEL[data.ocrStatus]}
              </span>
            </div>

            {data.ocrStatus === "OCR_PENDING" ? (
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                OCR is processing this grade report. Refresh the panel shortly.
              </div>
            ) : data.ocrStatus === "OCR_FAILED" && !manualEntry ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-800">Automatic extraction failed.</p>
                <p className="mt-1 text-xs text-rose-700">Retry OCR or enter the grades manually.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void retryOcr()}
                    disabled={retrying}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800 disabled:opacity-60"
                  >
                    {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                    Re-run OCR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRows([{ subjectCode: "", subjectName: "", units: "", grade: "", flag: null }]);
                      setManualEntry(true);
                      setError(null);
                      setNotice(null);
                    }}
                    className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
                  >
                    Manual Entry
                  </button>
                </div>
              </div>
            ) : null}

            {canEditRows ? (
              <>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    Computed GWA:{" "}
                    <span className="font-bold text-slate-900">{liveGwa?.toFixed(2) ?? "—"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add row
                  </button>
                </div>
                <div className="mt-3 max-h-[350px] space-y-3 overflow-auto pr-1">
                  {rows.map((row, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 p-3">
                      <label className="col-span-12 text-[11px] font-medium text-slate-600 sm:col-span-6">
                        Subject
                        <input
                          value={row.subjectName}
                          onChange={(event) => updateRow(index, { subjectName: event.target.value })}
                          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                        />
                      </label>
                      <label className="col-span-6 text-[11px] font-medium text-slate-600 sm:col-span-2">
                        Code
                        <input
                          value={row.subjectCode}
                          onChange={(event) => updateRow(index, { subjectCode: event.target.value })}
                          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                        />
                      </label>
                      <label className="col-span-3 text-[11px] font-medium text-slate-600 sm:col-span-1">
                        Units
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.units}
                          onChange={(event) => updateRow(index, { units: event.target.value, flag: null })}
                          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                        />
                      </label>
                      <label className="col-span-3 text-[11px] font-medium text-slate-600 sm:col-span-2">
                        Grade
                        <input
                          type="number"
                          min="1"
                          max="5"
                          step="0.01"
                          value={row.grade}
                          onChange={(event) => {
                            const grade = event.target.value;
                            updateRow(
                              index,
                              Number(grade) === 5
                                ? { grade: "", flag: "FAILED" }
                                : { grade, flag: null }
                            );
                          }}
                          disabled={Boolean(row.flag)}
                          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100"
                        />
                      </label>
                      <label className="col-span-9 text-[11px] font-medium text-slate-600 sm:col-span-1">
                        Flag
                        <select
                          value={row.flag ?? ""}
                          onChange={(event) => updateRow(index, {
                            flag: (event.target.value || null) as GradeFlag,
                            grade: "",
                          })}
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-1 py-1.5 text-xs text-slate-900"
                        >
                          <option value="">None</option>
                          <option value="INC">INC</option>
                          <option value="DRP">DRP</option>
                          <option value="W">W</option>
                          <option value="NG">NG</option>
                          <option value="FAILED">Failed (5.00)</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove subject row ${index + 1}`}
                        onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                        className="col-span-3 mt-4 inline-flex h-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50 sm:col-span-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {data.ocrRawText ? (
                  <label className="mt-4 block text-xs font-semibold text-slate-600">
                    Recognized text
                    <textarea
                      readOnly
                      value={data.ocrRawText}
                      rows={4}
                      className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700"
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveOverrides()}
                  disabled={saving || !rows.length}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0b3048] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Overrides &amp; Verify
                </button>
              </>
            ) : null}

            {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
            {notice ? <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
            {data.ocrParsedRows && rows.length === 0 && data.ocrRawText && !manualEntry ? (
              <label className="mt-4 block text-xs font-semibold text-slate-600">
                Recognized text
                <textarea
                  readOnly
                  value={data.ocrRawText}
                  rows={8}
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700"
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
