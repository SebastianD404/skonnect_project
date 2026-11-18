"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import {
  BookOpen,
  CheckCircle2,
  Check,
  Clock3,
  Download,
  Eye,
  Flag,
  GraduationCap,
  Lock,
  MoveHorizontal,
  Settings,
  Star,
  Upload,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  ACADEMIC_JOURNEY_START_OPTIONS,
  getAcademicJourneyTermsForRange,
  isValidAcademicJourneyRange,
  mapSkeapYearLevelToStartingPoint,
  normalizeAcademicJourneyStepStatus,
  type AcademicJourneyNode,
  type AcademicJourneyStepStatus,
} from "@/lib/academic-journey";
import type { LucideIcon } from "lucide-react";

export type AcademicJourneyMapProps = {
  studentName?: string;
  photoUrl?: string;
  currentSemesterIndex: number;
  validatedSemesterIndexes: number[];
  currentStepStatus?: AcademicJourneyStepStatus;
  currentStepOpensAt?: string | null;
  eligibleSemesterCount?: number;
  journeyNodes?: AcademicJourneyNode[];
  isGraduated?: boolean;
  journeyStart?: string | null;
  journeyEnd?: string | null;
  startingPointYearLevel?: string | null;
  onConfigureJourney?: () => void;
  compact?: boolean;
};

const STEP_WIDTH = 120;
const START_X = 80;
const COMPACT_END_PADDING = 48;
const MIN_MOBILE_TRACK_WIDTH = 680;
const WAVE_CANVAS_HEIGHT = 340;

type WavePoint = { x: number; y: number };

function getNodePosition(index: number, totalNodes: number, containerWidth: number) {
  const horizontalPadding = 84;
  const intervals = Math.max(totalNodes - 1, 1);
  const stepX = Math.max(145, (containerWidth - horizontalPadding * 2) / intervals);
  const canvasWidth = Math.max(containerWidth, horizontalPadding * 2 + stepX * intervals);

  return {
    x: horizontalPadding + stepX * index,
    y: 158 + 64 * Math.cos(index * 1.15),
    canvasWidth,
  };
}

function buildSmoothWavePath(points: WavePoint[]) {
  if (points.length === 0) return "";

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function formatJourneyDate(value: Date | string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(date);
}

function getDownloadHref(url: string, filename: string) {
  const parsed = new URL(url, "https://skonnect.local");
  parsed.searchParams.set("download", "true");
  parsed.searchParams.set("filename", filename);
  return url.startsWith("/") ? `${parsed.pathname}${parsed.search}` : parsed.toString();
}

const STEP_STATUS_CONFIG: Record<
  AcademicJourneyStepStatus,
  {
    label: string;
    badgeClassName: string;
    badgeIconClassName: string;
    activeNodeClassName: string;
    activeNodeCoreClassName: string;
    compactActiveNodeClassName: string;
    activeLabelClassName: string;
    lightActiveLabelClassName: string;
    activePathClassName: string;
    pathColor: string;
    avatarClassName: string;
    avatarPointerClassName: string;
    Icon: LucideIcon;
  }
> = {
  locked: {
    label: "Locked",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-400",
    badgeIconClassName: "text-slate-400",
    activeNodeClassName: "border-slate-200 bg-slate-50",
    activeNodeCoreClassName: "bg-slate-400",
    compactActiveNodeClassName: "border-2 border-slate-600 bg-slate-800",
    activeLabelClassName: "text-slate-400",
    lightActiveLabelClassName: "text-slate-700",
    activePathClassName: "bg-slate-200",
    pathColor: "#e2e8f0",
    avatarClassName: "border-slate-300",
    avatarPointerClassName: "fill-slate-300",
    Icon: Lock,
  },
  scheduled_locked: {
    label: "Submission Closed",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-600",
    badgeIconClassName: "text-slate-500",
    activeNodeClassName: "border-slate-300 bg-slate-100 ring-4 ring-slate-300/20",
    activeNodeCoreClassName: "bg-slate-400",
    compactActiveNodeClassName: "border-2 border-slate-400 bg-slate-700 ring-4 ring-slate-500/20 ring-offset-2 ring-offset-slate-900",
    activeLabelClassName: "text-slate-400",
    lightActiveLabelClassName: "text-slate-700",
    activePathClassName: "bg-slate-300",
    pathColor: "#cbd5e1",
    avatarClassName: "border-slate-400 animate-pulse",
    avatarPointerClassName: "fill-slate-400",
    Icon: Clock3,
  },
  open_for_submit: {
    label: "Submit Requirements",
    badgeClassName: "border-amber-300 bg-amber-50 text-amber-800 shadow-sm",
    badgeIconClassName: "text-amber-600",
    activeNodeClassName: "border-amber-500 bg-amber-500/10 ring-4 ring-amber-500/20 animate-pulse",
    activeNodeCoreClassName: "bg-amber-500",
    compactActiveNodeClassName: "animate-pulse bg-amber-400 ring-4 ring-amber-500/30 ring-offset-2 ring-offset-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
    activeLabelClassName: "text-amber-300",
    lightActiveLabelClassName: "text-amber-800",
    activePathClassName: "bg-amber-500",
    pathColor: "#f59e0b",
    avatarClassName: "border-amber-500",
    avatarPointerClassName: "fill-amber-500",
    Icon: Upload,
  },
  under_review: {
    label: "Under Review",
    badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    badgeIconClassName: "text-indigo-600",
    activeNodeClassName: "border-indigo-400 bg-indigo-50 ring-4 ring-indigo-400/20",
    activeNodeCoreClassName: "bg-indigo-500",
    compactActiveNodeClassName: "bg-indigo-400 ring-4 ring-indigo-500/30 ring-offset-2 ring-offset-slate-900",
    activeLabelClassName: "text-indigo-300",
    lightActiveLabelClassName: "text-indigo-700",
    activePathClassName: "bg-indigo-400",
    pathColor: "#818cf8",
    avatarClassName: "border-indigo-400",
    avatarPointerClassName: "fill-indigo-400",
    Icon: Clock3,
  },
  action_required: {
    label: "Action Required",
    badgeClassName: "border-amber-300 bg-amber-50 text-amber-800 shadow-sm",
    badgeIconClassName: "text-amber-600",
    activeNodeClassName: "border-amber-500 bg-amber-500/10 ring-4 ring-amber-500/20 animate-pulse",
    activeNodeCoreClassName: "bg-amber-600",
    compactActiveNodeClassName: "animate-pulse bg-amber-500 ring-4 ring-amber-500/30 ring-offset-2 ring-offset-slate-900",
    activeLabelClassName: "text-amber-300",
    lightActiveLabelClassName: "text-amber-800",
    activePathClassName: "bg-amber-500",
    pathColor: "#f59e0b",
    avatarClassName: "border-amber-500",
    avatarPointerClassName: "fill-amber-500",
    Icon: TriangleAlert,
  },
  validated: {
    label: "Validated",
    badgeClassName: "border-emerald-200/60 bg-emerald-100/80 text-emerald-700",
    badgeIconClassName: "text-emerald-700",
    activeNodeClassName: "border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm",
    activeNodeCoreClassName: "bg-emerald-600",
    compactActiveNodeClassName: "bg-emerald-500 ring-4 ring-emerald-500/30 ring-offset-2 ring-offset-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    activeLabelClassName: "text-emerald-300",
    lightActiveLabelClassName: "text-emerald-800",
    activePathClassName: "bg-emerald-500",
    pathColor: "#10b981",
    avatarClassName: "border-emerald-500",
    avatarPointerClassName: "fill-emerald-500",
    Icon: CheckCircle2,
  },
};

export default function AcademicJourneyMap({
  studentName,
  photoUrl,
  currentSemesterIndex,
  validatedSemesterIndexes,
  currentStepStatus = "scheduled_locked",
  currentStepOpensAt,
  eligibleSemesterCount,
  journeyNodes,
  isGraduated = false,
  journeyStart,
  journeyEnd,
  startingPointYearLevel,
  onConfigureJourney,
  compact = false,
}: AcademicJourneyMapProps) {
  const router = useRouter();
  const progressGradientId = `journey-progress-${useId().replace(/:/g, "")}`;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<AcademicJourneyNode | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [hasMoreRight, setHasMoreRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ pointerId: number; x: number; scrollLeft: number } | null>(null);
  const mappedStartingPoint = mapSkeapYearLevelToStartingPoint(startingPointYearLevel);
  const mappedStartValue = mappedStartingPoint
    ? ACADEMIC_JOURNEY_START_OPTIONS.find(({ label }) => label === mappedStartingPoint)?.value
    : null;
  const effectiveJourneyStart = journeyStart || mappedStartValue;
  const hasJourneyRange = Boolean(
    effectiveJourneyStart &&
    journeyEnd &&
    isValidAcademicJourneyRange(effectiveJourneyStart, journeyEnd),
  );
  const terms = useMemo(
    () => hasJourneyRange
      ? getAcademicJourneyTermsForRange(effectiveJourneyStart!, journeyEnd!).map((term, index) => ({
          ...term,
          academicTermCaption: journeyNodes?.[index]?.academicTermCaption ?? null,
        }))
      : journeyNodes?.length
        ? journeyNodes.map((node, index) => {
          const yearNumber = node.yearNumber ?? Math.floor(index / 2) + 1;
          const semesterNumber = node.semesterNumber ?? ((index % 2) + 1);
          return {
            label: `Y${yearNumber} S${semesterNumber}`,
            year: `${yearNumber}${yearNumber === 1 ? "st" : yearNumber === 2 ? "nd" : yearNumber === 3 ? "rd" : "th"} Year`,
            semester: `${semesterNumber}${semesterNumber === 1 ? "st" : "nd"} Sem`,
            academicTermCaption: node.academicTermCaption ?? null,
          };
        })
        : [],
    [effectiveJourneyStart, hasJourneyRange, journeyEnd, journeyNodes],
  );
  const journeyYears = terms.length / 2;
  const termCount = terms.length;
  const stepStatusConfig =
    STEP_STATUS_CONFIG[normalizeAcademicJourneyStepStatus(currentStepStatus)];
  const stepStatusLabel =
    normalizeAcademicJourneyStepStatus(currentStepStatus) === "scheduled_locked" &&
    currentStepOpensAt
      ? `Opens ${new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "Asia/Manila",
        }).format(new Date(currentStepOpensAt))}`
      : stepStatusConfig.label;
  const currentIndex = Number.isFinite(currentSemesterIndex)
    ? Math.max(0, Math.min(Math.floor(currentSemesterIndex), termCount))
    : 0;
  const validatedIndexes = useMemo(
    () => new Set(validatedSemesterIndexes.filter(
      (index) => Number.isInteger(index) && index >= 0 && index < termCount
    )),
    [termCount, validatedSemesterIndexes]
  );
  const semesterNodes = useMemo(() => terms.map((term, index) => {
    const suppliedNode = journeyNodes?.[index];
    if (suppliedNode) return suppliedNode;

    const isValidated = validatedIndexes.has(index);
    const isCurrent = index === currentIndex;
    return {
      index,
      semester: term.label,
      status: isValidated
        ? "VALIDATED" as const
        : isCurrent
          ? normalizeAcademicJourneyStepStatus(currentStepStatus) === "under_review"
            ? "UNDER_REVIEW" as const
            : normalizeAcademicJourneyStepStatus(currentStepStatus) === "action_required"
              ? "RETURNED" as const
              : "CURRENT" as const
          : "LOCKED" as const,
      submissionId: null,
      submittedAt: null,
      approvedAt: null,
      gwa: null,
      remarks: null,
      gradeReportUrl: null,
      coeFileUrl: null,
      isInitialGrant: false,
    };
  }), [currentIndex, currentStepStatus, journeyNodes, terms, validatedIndexes]);
  const validatedCount = semesterNodes.filter((node) => node.status === "VALIDATED").length;
  const eligibleCount = hasJourneyRange
    ? termCount
    : Math.max(0, Math.min(eligibleSemesterCount ?? termCount, termCount));
  const eligibleNodeIndex = journeyNodes?.findIndex((node) => node.status !== "PRE_GRANT") ?? 0;
  const firstEligibleIndex = eligibleNodeIndex < 0 ? termCount : eligibleNodeIndex;
  const pathNodeCount = termCount + (compact ? 0 : 1);
  const containerWidth = viewportWidth || MIN_MOBILE_TRACK_WIDTH;
  const focusedIndex = Math.min(currentIndex, pathNodeCount - 1);
  const compactTrackWidth = compact
    ? START_X + (pathNodeCount - 1) * STEP_WIDTH + STEP_WIDTH / 2 + COMPACT_END_PADDING
    : 0;
  const waveLayout = compact
    ? null
    : getNodePosition(pathNodeCount - 1, pathNodeCount, containerWidth);
  const nodePoints: WavePoint[] = Array.from({ length: pathNodeCount }, (_, index) =>
    compact
      ? { x: START_X + index * STEP_WIDTH, y: 8 }
      : getNodePosition(index, pathNodeCount, containerWidth),
  );
  const canvasWidth = compact
    ? compactTrackWidth
    : waveLayout?.canvasWidth ?? containerWidth;
  const hasHorizontalOverflow = canvasWidth > containerWidth;
  const progressEndIndex = isGraduated || (eligibleCount > 0 && validatedCount >= eligibleCount)
    ? termCount
    : Math.min(currentIndex, termCount);
  const journeyPath = compact ? "" : buildSmoothWavePath(nodePoints);
  const progressPath = compact
    ? ""
    : buildSmoothWavePath(nodePoints.slice(0, progressEndIndex + 1));
  const totalTrackYears = `${journeyYears} year${journeyYears === 1 ? "" : "s"}`;
  const selectedNodeIndex = selectedNode?.index ?? -1;
  const selectedJourneyPosition = selectedNodeIndex >= 0 ? terms[selectedNodeIndex] : null;
  const selectedNodeHistoricalTerm = selectedNode?.semester ?? null;
  const selectedNodeYearNumber = selectedJourneyPosition?.year.match(/^(\d+)/)?.[1];
  const selectedNodeYearLabel = selectedJourneyPosition?.year.startsWith("Grade")
    ? selectedJourneyPosition.year
    : selectedNodeYearNumber
      ? `Year ${selectedNodeYearNumber}`
      : `Year ${Math.floor(selectedNodeIndex / 2) + 1}`;
  const selectedNodeSemesterNumber = (selectedNodeIndex % 2) + 1;
  const selectedNodeTitle = selectedNode && selectedNodeHistoricalTerm
    ? `${selectedNodeYearLabel} · Semester ${selectedNodeSemesterNumber} — ${selectedNodeHistoricalTerm}`
    : "";
  const selectedNodeStatusLabel = selectedNode?.status === "VALIDATED"
    ? "Validated"
    : selectedNode?.status === "PENDING" || selectedNode?.status === "UNDER_REVIEW"
      ? "Under Review"
      : selectedNode?.status === "CURRENT"
        ? "Current Step"
        : selectedNode?.status === "PRE_GRANT"
          ? "Prior Term"
        : "Returned";
  const selectedDocuments = selectedNode
    ? [
        { label: "Grade Report", url: selectedNode.gradeReportUrl },
        { label: "Certificate of Enrollment", url: selectedNode.coeFileUrl },
      ]
    : [];
  const selectedNodeDate = selectedNode
    ? formatJourneyDate(selectedNode.status === "VALIDATED" ? selectedNode.approvedAt : selectedNode.submittedAt)
    : null;
  const selectedNodeStatusClass = selectedNode?.status === "VALIDATED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : selectedNode?.status === "PRE_GRANT"
      ? "border-slate-200 bg-slate-100 text-slate-500"
    : selectedNode?.status === "RETURNED"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-indigo-200 bg-indigo-50 text-indigo-700";

  function openCurrentRequirements() {
    router.push("/grantee-dashboard/documents#submit-requirements");
  }

  useEffect(() => {
    if (!selectedNode) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedNode(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedNode]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    event.currentTarget.style.scrollBehavior = "auto";
    event.currentTarget.scrollLeft = event.currentTarget.scrollLeft;
    dragStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = dragStart.current.scrollLeft - (event.clientX - dragStart.current.x);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return;
    dragStart.current = null;
    event.currentTarget.style.removeProperty("scroll-behavior");
    setIsDragging(false);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const centerCurrentNode = () => {
      if (dragStart.current) return;
      const node = nodeRefs.current[focusedIndex];
      if (!node) return;
      const nodeBounds = node.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      const targetScrollLeft =
        viewport.scrollLeft +
        nodeBounds.left +
        nodeBounds.width / 2 -
        viewportBounds.left -
        viewport.clientWidth / 2;
      viewport.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
    };
    const updateRightFade = () => {
      setHasMoreRight(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
    };
    const updateViewportWidth = () => {
      if (viewport.clientWidth > 0) setViewportWidth(viewport.clientWidth);
    };
    let scrollFrame = 0;
    const handleScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        if (!viewport.isConnected) return;
        updateRightFade();
      });
    };

    const frame = window.requestAnimationFrame(() => {
      centerCurrentNode();
      updateRightFade();
    });
    const resizeObserver = new ResizeObserver(() => {
      updateViewportWidth();
      updateRightFade();
    });
    resizeObserver.observe(viewport);
    updateViewportWidth();
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", centerCurrentNode);

    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", centerCurrentNode);
    };
  }, [canvasWidth, focusedIndex, termCount]);

  if (termCount === 0) return null;

  if (compact) {
    const progressStart = termCount > 1
      ? 6.25 + (firstEligibleIndex / (termCount - 1)) * 87.5
      : 6.25;
    const progressWidth = termCount > 1
      ? (Math.max(0, Math.min(currentIndex - firstEligibleIndex, eligibleCount - 1)) / (termCount - 1)) * 87.5
      : 0;

    return (
      <div className="w-full text-white">
        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Academic Journey
          </span>
          <span className="shrink-0 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            {validatedCount}/{eligibleCount} Validated
          </span>
        </div>

        <div className="relative w-full pb-5">
          <div
            className="absolute left-[6.25%] right-[6.25%] top-1.5 h-0.5 rounded-full bg-slate-700"
            aria-hidden="true"
          />
          <div
            className={`absolute top-1.5 h-0.5 rounded-full transition-all duration-500 ${stepStatusConfig.activePathClassName}`}
            style={{ left: `${progressStart}%`, width: `${progressWidth}%` }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-full justify-between">
            {terms.map((term, index) => {
              const isCompleted = semesterNodes[index].status === "VALIDATED";
              const isCurrent = index === currentIndex;
              const isMissed = !journeyNodes && index < currentIndex && !isCompleted;
              const stateLabel = isCompleted
                ? "validated"
                : semesterNodes[index].status === "PENDING" || semesterNodes[index].status === "UNDER_REVIEW"
                  ? "under review"
                  : semesterNodes[index].status === "RETURNED"
                    ? "returned"
                    : isCurrent
                  ? "current step"
                  : isMissed
                    ? "missed"
                    : "locked";

              return (
                <div key={term.label} className="relative flex min-w-0 flex-1 justify-center">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      isCompleted
                        ? "bg-emerald-500"
                        : isCurrent
                          ? stepStatusConfig.compactActiveNodeClassName
                          : isMissed
                            ? "bg-rose-400"
                            : "border-2 border-slate-600 bg-slate-800"
                    }`}
                    title={`${term.year}, ${term.semester}: ${stateLabel}`}
                    aria-label={`${term.year}, ${term.semester}: ${stateLabel}`}
                  />
                  <span className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-slate-400">
                    {term.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "relative w-full overflow-hidden" : "relative w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"}>
      {!compact ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
        </div>
      ) : null}

      {!compact ? (
        <div className="relative z-20 flex flex-col items-start justify-between gap-3 p-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Academic Journey</h2>
              {onConfigureJourney ? (
                <>
                  <button
                    type="button"
                    onClick={onConfigureJourney}
                    aria-label="Edit academic journey setup"
                    title="Edit academic journey setup"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {validatedCount === 0 && !hasJourneyRange ? (
                    <button
                      type="button"
                      onClick={onConfigureJourney}
                      className="inline-flex h-7 items-center rounded-full border border-cyan-100 bg-cyan-50 px-2.5 text-[10px] font-semibold text-cyan-800 transition hover:border-cyan-200 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                    >
                      Confirm degree length
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Track validated semesters across your {totalTrackYears} toward graduation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex self-start rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-2xs md:self-auto">
              {validatedCount} of {eligibleCount} semesters validated
            </span>
            {hasHorizontalOverflow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-400">
                <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Drag map to explore</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 w-full">
        <div
          ref={viewportRef}
          onPointerDown={hasHorizontalOverflow ? handlePointerDown : undefined}
          onPointerMove={hasHorizontalOverflow ? handlePointerMove : undefined}
          onPointerUp={hasHorizontalOverflow ? handlePointerEnd : undefined}
          onPointerCancel={hasHorizontalOverflow ? handlePointerEnd : undefined}
          onLostPointerCapture={hasHorizontalOverflow ? handlePointerEnd : undefined}
          className={`scrollbar-hide hide-scrollbar relative w-full scroll-smooth overflow-x-auto overflow-y-hidden whitespace-nowrap ${
            hasHorizontalOverflow
              ? `select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`
              : "cursor-default"
          } ${compact ? "pb-0 pt-2" : "pb-5 pt-10"}`}
          style={{ touchAction: "pan-x" }}
        >
          <div
            className={`relative ${compact ? "h-[74px]" : "h-[340px]"}`}
            style={{
              width: `${canvasWidth}px`,
              ...(compact ? { paddingLeft: "24px", paddingRight: `${COMPACT_END_PADDING}px` } : {}),
            }}
          >

            {!compact ? (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${canvasWidth} ${WAVE_CANVAS_HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={progressGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="55%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <path
                  d={journeyPath}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {progressPath ? (
                  <path
                    d={progressPath}
                    fill="none"
                    stroke={`url(#${progressGradientId})`}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                ) : null}
              </svg>
            ) : (
              <>
                <div
                  className="absolute top-2 h-1 -translate-y-1/2 rounded-full bg-slate-700"
                  style={{ left: `${START_X}px`, width: `${Math.max(0, (pathNodeCount - 1) * STEP_WIDTH)}px` }}
                  aria-hidden="true"
                />
                {currentIndex > 0 ? (
                  <div
                    className={`absolute top-2 h-1 -translate-y-1/2 rounded-full transition-all duration-500 ${stepStatusConfig.activePathClassName}`}
                    style={{
                      left: `${START_X}px`,
                      width: `${Math.min(termCount - 1, currentIndex) * STEP_WIDTH}px`,
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </>
            )}

            {terms.map((term, index) => {
              const journeyNode = semesterNodes[index];
              const isCompleted = journeyNode.status === "VALIDATED";
              const isPriorTerm = journeyNode.status === "PRE_GRANT";
              const isCurrent = index === currentIndex;
              const isMissed = !journeyNodes && index < currentIndex && !isCompleted;
              const canOpenNode = Boolean(journeyNodes) && !compact && [
                "VALIDATED",
                "PENDING",
                "UNDER_REVIEW",
                "RETURNED",
                "CURRENT",
              ].includes(journeyNode.status);
              const stateLabel = isCompleted
                ? "validated"
                : isPriorTerm
                  ? "prior term"
                : journeyNode.status === "PENDING" || journeyNode.status === "UNDER_REVIEW"
                  ? "under review"
                  : journeyNode.status === "RETURNED"
                    ? "returned"
                    : isCurrent
                  ? "current step"
                  : isMissed
                    ? "missed"
                    : "locked";
              const yearNumber = Math.floor(index / 2) + 1;
              const isYearMilestone = index % 2 === 0;
              const isFinalSemester = index === termCount - 1;
              const isMidpoint = yearNumber === Math.ceil(journeyYears / 2) && isYearMilestone && journeyYears > 2;
              const isFinalYear = yearNumber === journeyYears && isYearMilestone;
              const milestoneIcon = isYearMilestone
                ? isMidpoint
                  ? Star
                  : isFinalYear
                    ? BookOpen
                    : Flag
                : null;
              const MilestoneIcon = milestoneIcon;
              const journeyNodeScheduleLabel =
                journeyNode.scheduleStatus === "future" && journeyNode.scheduleOpensAt
                  ? `OPENS ${new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "Asia/Manila",
                    }).format(new Date(journeyNode.scheduleOpensAt)).toUpperCase()}`
                  : journeyNode.scheduleStatus === "open"
                    ? "OPEN NOW"
                    : journeyNode.scheduleStatus === "none"
                      ? "UPCOMING TERM"
                      : null;

              return (
                <div
                  key={term.label}
                  ref={(node) => { nodeRefs.current[index] = node; }}
                  className={`absolute z-10 snap-center ${
                    compact
                      ? "flex w-[120px] -translate-x-1/2 flex-col items-center"
                      : "h-0 w-[140px] -translate-x-1/2 -translate-y-1/2"
                  }`}
                  style={{
                    left: `${nodePoints[index].x}px`,
                    top: compact ? "8px" : `${nodePoints[index].y}px`,
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                >
                  {!compact && isCurrent ? (
                    <div
                      className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border border-amber-300/70 bg-amber-300/10 shadow-[0_0_0_8px_rgba(251,191,36,0.12),0_0_0_16px_rgba(245,158,11,0.07)]"
                      aria-hidden="true"
                    />
                  ) : null}
                  {!compact && isCompleted ? (
                    <div
                      className="pointer-events-none absolute left-1/2 top-0 -z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/15 blur-md"
                      aria-hidden="true"
                    />
                  ) : null}

                  {!compact && hoveredIndex === index && !isCurrent ? (
                    <div className={`pointer-events-none absolute z-30 px-3 py-2 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 text-white rounded-xl shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 ${
                      isCurrent ? "top-16" : "-top-14"
                    } ${
                      index === 0
                        ? "left-0 origin-left"
                        : index === terms.length - 1
                          ? "right-0 origin-right"
                          : "left-1/2 -translate-x-1/2 origin-bottom"
                    }`}>
                      <p className="text-[11px] font-bold">{`${term.year}, ${term.semester}`}</p>
                      <p className={`mt-0.5 text-[10px] ${isMissed || journeyNode.status === "RETURNED" ? "text-rose-300" : "text-emerald-300"}`}>
                        {canOpenNode
                          ? journeyNode.status === "CURRENT"
                            ? "Click to upload requirements"
                            : "Click to view"
                          : isCompleted
                            ? "Semester validated"
                          : isPriorTerm
                            ? "Before SKEAP admission"
                          : isCurrent
                            ? stepStatusLabel
                            : isMissed
                              ? "Semester missed"
                              : `Unlocks after ${terms[index - 1]?.label ?? "the previous semester"}`}
                      </p>
                    </div>
                  ) : null}

                  {!compact && isCurrent && studentName ? (
                    <div className="animate-levitate pointer-events-none absolute bottom-[22px] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
                      <span className={`absolute -top-5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-sm backdrop-blur-sm ${stepStatusConfig.badgeClassName}`}>
                        Current step
                      </span>
                      <div className="flex flex-col items-center drop-shadow-md">
                        <Avatar
                          src={photoUrl}
                          alt={studentName}
                          size={44}
                          className={`rounded-2xl border-2 bg-white text-sm font-bold text-slate-800 shadow-inner ring-2 ring-white/90 ${stepStatusConfig.avatarClassName}`}
                        />
                        <svg
                          className={`-mt-px h-2 w-3 drop-shadow-sm ${stepStatusConfig.avatarPointerClassName}`}
                          viewBox="0 0 12 8"
                          aria-hidden="true"
                        >
                          <path d="M0 0 L6 8 L12 0 Z" />
                        </svg>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    tabIndex={canOpenNode ? 0 : -1}
                    disabled={!canOpenNode}
                    aria-label={`${term.year}, ${term.semester}: ${stateLabel}${canOpenNode ? journeyNode.status === "CURRENT" ? ", open requirements" : ", click to view" : ""}`}
                    title={journeyNode.status === "LOCKED"
                      ? `Unlocks after ${terms[index - 1]?.label ?? "the previous semester"} is validated`
                      : canOpenNode
                        ? journeyNode.status === "CURRENT" ? "Open Submit Requirements" : "Click to view"
                        : undefined}
                    onClick={() => {
                      if (!canOpenNode) return;
                      if (journeyNode.status === "CURRENT") {
                        openCurrentRequirements();
                      } else {
                        setSelectedNode(journeyNode);
                      }
                    }}
                    className={`${compact
                      ? "relative z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-all duration-300"
                      : "absolute left-1/2 top-0 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-all duration-300"
                    } ${
                      isCompleted
                        ? compact
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm ring-4 ring-emerald-500/10"
                        : isCurrent
                          ? compact
                            ? stepStatusConfig.compactActiveNodeClassName
                            : `border-4 ${stepStatusConfig.activeNodeClassName}`
                            : isPriorTerm
                              ? compact
                                ? "border-slate-700 bg-slate-800"
                                : "border-2 border-slate-200 bg-slate-100 text-slate-400"
                          : journeyNode.status === "PENDING" || journeyNode.status === "UNDER_REVIEW"
                            ? compact
                              ? "border-indigo-400 bg-indigo-400"
                              : "border-2 border-indigo-300 bg-indigo-50 text-indigo-600"
                            : journeyNode.status === "RETURNED"
                              ? compact
                                ? "border-amber-400 bg-amber-400"
                                : "border-2 border-amber-300 bg-amber-50 text-amber-700"
                          : isMissed
                            ? compact
                              ? "border-rose-400 bg-rose-500"
                              : "border-2 border-rose-200 bg-rose-50 text-rose-400"
                            : compact
                              ? "border-slate-600 bg-slate-800"
                              : "border-2 border-dashed border-slate-300 bg-white text-slate-400"
                    } ${
                      canOpenNode
                        ? "cursor-pointer hover:ring-4 hover:ring-sky-500/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/30"
                        : journeyNode.status === "LOCKED"
                          ? "cursor-not-allowed"
                          : ""
                    }`}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                  >
                    {isCompleted ? (
                      <Check className={compact ? "h-2.5 w-2.5" : "h-5 w-5 text-emerald-600 stroke-[2.5]"} aria-hidden="true" />
                    ) : isCurrent ? (
                      <span className={`rounded-full ${stepStatusConfig.activeNodeCoreClassName} ${compact ? "h-1.5 w-1.5" : "h-3.5 w-3.5 animate-pulse"}`} aria-hidden="true" />
                    ) : isMissed ? (
                      compact ? null : <span className="text-[10px] font-bold">N/A</span>
                    ) : journeyNode.status === "PENDING" || journeyNode.status === "UNDER_REVIEW" ? (
                      compact ? null : <Clock3 className="h-4 w-4" aria-hidden="true" />
                    ) : journeyNode.status === "RETURNED" ? (
                      compact ? null : <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                    ) : isPriorTerm ? (
                      compact ? null : <Check className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    ) : compact ? null : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>

                  <span className={`${compact
                    ? `${index % 2 === 1 ? "mt-5" : "mt-2.5"}`
                    : "absolute left-1/2 top-7 -translate-x-1/2"
                  } whitespace-nowrap text-[10px] font-bold uppercase tracking-wider ${
                    isCurrent ? compact
                      ? stepStatusConfig.activeLabelClassName
                      : `font-extrabold ${stepStatusConfig.lightActiveLabelClassName}`
                    : compact ? isCompleted ? "text-slate-300" : "text-slate-500" : "text-slate-400"
                  }`}>
                    {term.label}
                  </span>
                  {!compact && journeyNode.academicTermCaption ? (
                    <span className="absolute left-1/2 top-[44px] w-[140px] -translate-x-1/2 whitespace-normal text-center text-[10px] leading-3 text-slate-400">
                      {journeyNode.academicTermCaption.replace(/^(\d{4})-(\d{4})/, "$1–$2")}
                    </span>
                  ) : null}

                  {!compact && isCurrent && journeyNodeScheduleLabel === "OPEN NOW" ? (
                    <button
                      type="button"
                      onClick={openCurrentRequirements}
                      className={`absolute left-1/2 top-[62px] -translate-x-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider shadow-sm ${stepStatusConfig.badgeClassName}`}
                    >
                      OPEN NOW
                    </button>
                  ) : !compact && isFinalSemester ? (
                    <span
                      title="Final semester"
                      className={`absolute left-1/2 top-[62px] -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${
                        isCompleted
                          ? "border-emerald-200/60 bg-emerald-100/80 text-emerald-700"
                          : isCurrent
                            ? stepStatusConfig.badgeClassName
                            : journeyNode.status === "PENDING" || journeyNode.status === "UNDER_REVIEW"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : journeyNode.status === "RETURNED"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : isPriorTerm
                                  ? "border-slate-200 bg-slate-100 text-slate-500"
                                  : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {isCompleted
                        ? "Validated"
                        : isCurrent
                          ? journeyNodeScheduleLabel ?? stepStatusLabel
                          : journeyNode.status === "PENDING" || journeyNode.status === "UNDER_REVIEW"
                            ? journeyNode.status === "PENDING" ? "Pending" : "Under Review"
                            : journeyNode.status === "RETURNED"
                              ? "Returned"
                              : isPriorTerm
                                ? "Prior Term"
                                : "FINAL SEM"}
                    </span>
                  ) : !compact && isCompleted ? (
                      <span className="absolute left-1/2 top-[62px] -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-200/60 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      VALIDATED
                    </span>
                  ) : !compact && isCurrent ? (() => {
                    const { badgeClassName, badgeIconClassName, Icon } = stepStatusConfig;
                    return (
                        <span className={`absolute left-1/2 top-[62px] inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${badgeClassName}`}>
                        <Icon className={`h-3 w-3 ${badgeIconClassName}`} aria-hidden="true" />
                        {journeyNodeScheduleLabel ?? stepStatusLabel}
                      </span>
                    );
                  })() : !compact && journeyNode.status === "PENDING" ? (
                      <span className="absolute left-1/2 top-[62px] -translate-x-1/2 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase text-indigo-700">
                      Pending
                    </span>
                  ) : !compact && journeyNode.status === "UNDER_REVIEW" ? (
                      <span className="absolute left-1/2 top-[62px] -translate-x-1/2 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase text-indigo-700">
                      Under Review
                    </span>
                  ) : !compact && journeyNode.status === "RETURNED" ? (
                      <span className="absolute left-1/2 top-[62px] -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-800">
                      Returned
                    </span>
                  ) : !compact && isPriorTerm ? (
                      <span className="absolute left-1/2 top-[62px] -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                      Prior Term
                    </span>
                  ) : null}

                  {!compact && !isFinalSemester && milestoneIcon && index !== 0 ? (
                      <div className="absolute left-1/2 top-[84px] flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-2xs">
                      {MilestoneIcon ? <MilestoneIcon className="h-3 w-3 text-emerald-600" aria-hidden="true" /> : null}
                      <span>{isMidpoint ? "Halfway milestone" : isFinalYear ? "Final year" : `Year ${yearNumber}`}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!compact ? (
              <div
                ref={(node) => { nodeRefs.current[termCount] = node; }}
                className="absolute z-10 h-0 w-[140px] -translate-x-1/2 -translate-y-1/2 snap-center"
                style={{ left: `${nodePoints[termCount].x}px`, top: `${nodePoints[termCount].y}px` }}
                onMouseEnter={() => setHoveredIndex(termCount)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(termCount)}
                onBlur={() => setHoveredIndex(null)}
              >
                {hoveredIndex === termCount ? (
                  <div className="pointer-events-none absolute -top-14 right-0 origin-right z-30 w-max rounded-xl bg-slate-900 px-3 py-2 text-center text-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
                    <p className="text-[11px] font-bold">Graduation</p>
                    <p className="mt-0.5 text-[10px] text-emerald-300">
                      {isGraduated
                        ? "Exit clearance verified"
                        : validatedCount === eligibleCount
                          ? "All semesters validated"
                          : "Complete all semesters to unlock"}
                    </p>
                  </div>
                ) : null}
                <div
                  tabIndex={0}
                  aria-label={`Graduation: ${isGraduated ? "completed and verified" : validatedCount === termCount ? "current milestone" : "locked"}`}
                  className={`absolute left-1/2 top-0 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl shadow-lg transition-all duration-300 ${
                    isGraduated
                      ? "border border-amber-200/80 bg-gradient-to-tr from-emerald-500 via-teal-400 to-amber-300 text-slate-950 shadow-xl shadow-emerald-500/30 ring-4 ring-amber-300/20"
                      : validatedCount === eligibleCount
                      ? "bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-500/30"
                      : "border-2 border-slate-200 bg-white text-slate-300"
                  }`}
                >
                  <GraduationCap className="h-7 w-7" aria-hidden="true" />
                </div>
                <span className={`absolute left-1/2 top-[34px] -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider ${
                  isGraduated ? "text-amber-700" : currentIndex === termCount ? "text-emerald-700" : "text-slate-400"
                }`}>
                  {isGraduated ? "Graduated" : "Graduation"}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {hasMoreRight ? (
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 w-10 ${
              compact ? "bg-gradient-to-l from-slate-900 to-transparent" : "bg-gradient-to-l from-white to-transparent"
            }`}
            aria-hidden="true"
          />
        ) : null}
      </div>

      {compact ? (
        <p className="mt-2 text-[10px] text-slate-400">
          {validatedCount} of {eligibleCount} semesters validated
        </p>
      ) : null}

      {selectedNode && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedNode(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="semester-submission-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Semester Submission
                </p>
                <h2 id="semester-submission-title" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                  {selectedNodeTitle}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedNodeStatusClass}`}>
                    {selectedNodeStatusLabel}
                  </span>
                  {selectedNodeDate ? (
                    <span className="text-xs text-slate-500">
                      {selectedNode.status === "VALIDATED" ? "Approved" : "Submitted"} {selectedNodeDate}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close semester submission"
                onClick={() => setSelectedNode(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {selectedNode.gwa !== null || selectedNode.remarks ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {selectedNode.gwa !== null ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recorded GWA</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{selectedNode.gwa.toFixed(2)}</p>
                  </div>
                ) : null}
                {selectedNode.remarks ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Academic remarks</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selectedNode.remarks}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900">Submitted documents</h3>
              {selectedDocuments.length ? (
                <div className="mt-3 space-y-3">
                  {selectedDocuments.map((file) => (
                    <div
                      key={file.label}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{file.label}</p>
                        {selectedNode.isInitialGrant ? (
                          <p className="mt-0.5 text-xs text-slate-500">From your approved SKEAP application</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {file.url ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Preview
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="File not available"
                            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Preview
                          </button>
                        )}
                        {file.url ? (
                          <a
                            href={getDownloadHref(
                              file.url,
                              `${file.label === "Grade Report" ? "Grade-Report" : "Certificate-of-Enrollment"}-Y${Math.floor(selectedNodeIndex / 2) + 1}-S${(selectedNodeIndex % 2) + 1}`,
                            )}
                            download={`${file.label === "Grade Report" ? "Grade-Report" : "Certificate-of-Enrollment"}-Y${Math.floor(selectedNodeIndex / 2) + 1}-S${(selectedNodeIndex % 2) + 1}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            Download
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="File not available"
                            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No document links are available for this semester.
                </p>
              )}
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
