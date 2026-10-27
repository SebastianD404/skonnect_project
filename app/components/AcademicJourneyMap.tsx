"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  BookOpen,
  CheckCircle2,
  Check,
  Clock3,
  Flag,
  GraduationCap,
  Lock,
  MoveHorizontal,
  Star,
  Upload,
  TriangleAlert,
} from "lucide-react";
import {
  getAcademicJourneyTerms,
  normalizeAcademicJourneyStepStatus,
  type AcademicJourneyStepStatus,
} from "@/lib/academic-journey";
import type { LucideIcon } from "lucide-react";

type AcademicJourneyMapProps = {
  studentName?: string;
  photoUrl?: string;
  totalYears?: number;
  currentSemesterIndex: number;
  validatedSemesterIndexes: number[];
  currentStepStatus?: AcademicJourneyStepStatus;
  currentStepOpensAt?: string | null;
  compact?: boolean;
};

const STEP_WIDTH = 120;
const START_X = 80;
const END_PADDING = 128;
const COMPACT_END_PADDING = 48;
const NODE_Y_POSITIONS = [110, 174];
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
    activePathClassName: string;
    pathColor: string;
    glowClassName: string;
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
    activePathClassName: "bg-slate-200",
    pathColor: "#e2e8f0",
    glowClassName: "bg-slate-500/10",
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
    activePathClassName: "bg-slate-300",
    pathColor: "#cbd5e1",
    glowClassName: "bg-slate-400/10",
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
    activePathClassName: "bg-amber-500",
    pathColor: "#f59e0b",
    glowClassName: "bg-amber-500/10",
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
    activePathClassName: "bg-indigo-400",
    pathColor: "#818cf8",
    glowClassName: "bg-indigo-500/10",
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
    activePathClassName: "bg-amber-500",
    pathColor: "#f59e0b",
    glowClassName: "bg-amber-500/10",
    avatarClassName: "border-amber-500",
    avatarPointerClassName: "fill-amber-500",
    Icon: TriangleAlert,
  },
  validated: {
    label: "Validated",
    badgeClassName: "border-transparent bg-emerald-600 text-white shadow-sm",
    badgeIconClassName: "text-white",
    activeNodeClassName: "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20",
    activeNodeCoreClassName: "bg-emerald-600",
    compactActiveNodeClassName: "bg-emerald-500 ring-4 ring-emerald-500/30 ring-offset-2 ring-offset-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    activeLabelClassName: "text-emerald-300",
    activePathClassName: "bg-emerald-500",
    pathColor: "#10b981",
    glowClassName: "bg-emerald-500/10",
    avatarClassName: "border-emerald-500",
    avatarPointerClassName: "fill-emerald-500",
    Icon: CheckCircle2,
  },
};

export default function AcademicJourneyMap({
  studentName,
  photoUrl,
  totalYears = 4,
  currentSemesterIndex,
  validatedSemesterIndexes,
  currentStepStatus = "scheduled_locked",
  currentStepOpensAt,
  compact = false,
}: AcademicJourneyMapProps) {
  const neonGlowId = `neon-glow-${useId().replace(/:/g, "")}`;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hasMoreRight, setHasMoreRight] = useState(false);
  const [activeNodeOffset, setActiveNodeOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ pointerId: number; x: number; scrollLeft: number } | null>(null);
  const years = Number.isFinite(totalYears) ? Math.max(1, Math.floor(totalYears)) : 4;
  const terms = useMemo(() => getAcademicJourneyTerms(years), [years]);
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
  const isExtendedCourse = termCount > 8;
  const currentIndex = Number.isFinite(currentSemesterIndex)
    ? Math.max(0, Math.min(Math.floor(currentSemesterIndex), termCount))
    : 0;
  const validatedIndexes = useMemo(
    () => new Set(validatedSemesterIndexes.filter(
      (index) => Number.isInteger(index) && index >= 0 && index < termCount
    )),
    [termCount, validatedSemesterIndexes]
  );
  const pathNodeCount = termCount + (compact ? 0 : 1);
  const focusedIndex = Math.min(currentIndex, pathNodeCount - 1);
  const trackWidth = START_X + (pathNodeCount - 1) * STEP_WIDTH + STEP_WIDTH / 2
    + (compact ? COMPACT_END_PADDING : END_PADDING);
  const nodePoints = Array.from({ length: pathNodeCount }, (_, index) => ({
    x: START_X + index * STEP_WIDTH,
    y: index === termCount ? 150 : NODE_Y_POSITIONS[index % NODE_Y_POSITIONS.length],
  }));
  let activeBeamPath = "";
  if (currentIndex < nodePoints.length - 1) {
    const current = nodePoints[currentIndex];
    const next = nodePoints[currentIndex + 1];
    const controlX = (current.x + next.x) / 2;
    activeBeamPath = `M ${current.x} ${current.y} C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  const journeyPath = nodePoints.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = nodePoints[index - 1];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const progressPath = currentIndex > 0
    ? nodePoints.slice(0, currentIndex + 1).reduce((path, point, index, points) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const previous = points[index - 1];
        const midX = (previous.x + point.x) / 2;
        return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
      }, "")
    : "";
  const totalTrackYears = `${years} year${years === 1 ? "" : "s"}`;

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
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
    setIsDragging(false);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const centerCurrentNode = () => {
      const node = nodeRefs.current[focusedIndex];
      if (!node) return;
      const nodeBounds = node.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      setActiveNodeOffset(nodeBounds.left + nodeBounds.width / 2 - viewportBounds.left);
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
    const updateActiveNodeOffset = () => {
      const node = nodeRefs.current[focusedIndex];
      if (!node) return;
      const nodeBounds = node.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      setActiveNodeOffset(nodeBounds.left + nodeBounds.width / 2 - viewportBounds.left);
    };
    const handleScroll = () => {
      updateRightFade();
      updateActiveNodeOffset();
    };

    const frame = window.requestAnimationFrame(() => {
      centerCurrentNode();
      updateRightFade();
    });
    const resizeObserver = new ResizeObserver(updateRightFade);
    resizeObserver.observe(viewport);
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", centerCurrentNode);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", centerCurrentNode);
    };
  }, [focusedIndex, termCount]);

  if (compact) {
    const progressWidth = termCount > 1
      ? `${(Math.min(currentIndex, termCount - 1) / (termCount - 1)) * 87.5}%`
      : "0%";

    return (
      <div className="w-full text-white">
        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Academic Journey
          </span>
          <span className="shrink-0 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            {validatedIndexes.size}/{termCount} Validated
          </span>
        </div>

        <div className="relative w-full pb-5">
          <div
            className="absolute left-[6.25%] right-[6.25%] top-1.5 h-0.5 rounded-full bg-slate-700"
            aria-hidden="true"
          />
          <div
            className={`absolute left-[6.25%] top-1.5 h-0.5 rounded-full transition-all duration-500 ${stepStatusConfig.activePathClassName}`}
            style={{ width: progressWidth }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-full justify-between">
            {terms.map((term, index) => {
              const isCompleted = validatedIndexes.has(index);
              const isCurrent = index === currentIndex;
              const isMissed = index < currentIndex && !isCompleted;
              const stateLabel = isCompleted
                ? "validated"
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
    <div className={compact ? "relative" : "relative rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] md:p-8"}>
      {!compact ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
          aria-hidden="true"
        />
      ) : null}

      {activeNodeOffset !== null ? (
        <div
          className={`pointer-events-none absolute rounded-full blur-3xl transition-all duration-500 ${stepStatusConfig.glowClassName} ${
            compact ? "hidden" : "h-72 w-72"
          }`}
          style={compact ? undefined : {
            left: `${activeNodeOffset}px`,
            top: "58%",
            transform: "translate(-50%, -50%)",
          }}
          aria-hidden="true"
        />
      ) : null}

      {!compact ? (
        <div className="relative z-10 mb-5 flex flex-col justify-between gap-3 md:mb-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Academic Journey</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Track validated semesters across your {totalTrackYears} toward graduation.
            </p>
          </div>
          <span className="inline-flex self-start rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-2xs md:self-auto">
            {validatedIndexes.size} of {termCount} semesters validated
          </span>
          {isExtendedCourse ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-200/60 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-400 sm:inline-flex">
              <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Drag map to explore</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative z-10">
        <div
          ref={viewportRef}
          onPointerDown={isExtendedCourse ? handlePointerDown : undefined}
          onPointerMove={isExtendedCourse ? handlePointerMove : undefined}
          onPointerUp={isExtendedCourse ? handlePointerEnd : undefined}
          onPointerCancel={isExtendedCourse ? handlePointerEnd : undefined}
          onLostPointerCapture={isExtendedCourse ? handlePointerEnd : undefined}
          className={`scrollbar-hide snap-x snap-mandatory overflow-x-auto scroll-smooth ${
            isExtendedCourse
              ? `select-none ${isDragging ? "cursor-grabbing snap-none" : "cursor-grab"}`
              : ""
          } ${compact ? "" : "pt-16"}`}
          style={{ touchAction: "pan-x" }}
        >
          <div
            className={`relative ${compact ? "h-[74px]" : "min-w-[1150px] h-[240px] pl-12 pr-32 pt-24 pb-12 md:h-[260px]"}`}
            style={compact
              ? { width: `${trackWidth}px`, paddingLeft: "24px", paddingRight: `${COMPACT_END_PADDING}px` }
              : { width: `${trackWidth}px` }}
          >

            {!compact ? (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                width="100%"
                height="100%"
                viewBox={`0 0 ${trackWidth} 230`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <filter id={neonGlowId} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d={`M 0 75 Q ${trackWidth * 0.25} 130 ${trackWidth * 0.5} 70 T ${trackWidth} 115`}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
                <path
                  d={`M 0 205 Q ${trackWidth * 0.25} 140 ${trackWidth * 0.5} 210 T ${trackWidth} 160`}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
                <path
                  d={journeyPath}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {progressPath ? (
                  <path
                    d={progressPath}
                    fill="none"
                    stroke={stepStatusConfig.pathColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-700"
                  />
                ) : null}
                {activeBeamPath ? (
                  <path
                    d={activeBeamPath}
                    fill="none"
                    stroke={stepStatusConfig.pathColor}
                    opacity="0.75"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="40 180"
                    filter={`url(#${neonGlowId})`}
                    aria-hidden="true"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="220"
                      to="0"
                      dur="2s"
                      repeatCount="indefinite"
                      calcMode="linear"
                    />
                  </path>
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
              const isCompleted = validatedIndexes.has(index);
              const isCurrent = index === currentIndex;
              const isMissed = index < currentIndex && !isCompleted;
              const stateLabel = isCompleted
                ? "validated"
                : isCurrent
                  ? "current step"
                  : isMissed
                    ? "missed"
                    : "locked";
              const yearNumber = Math.floor(index / 2) + 1;
              const isYearMilestone = index % 2 === 0;
              const isMidpoint = yearNumber === Math.ceil(years / 2) && isYearMilestone && years > 2;
              const isFinalYear = yearNumber === years && isYearMilestone;
              const milestoneIcon = isYearMilestone
                ? isMidpoint
                  ? Star
                  : isFinalYear
                    ? BookOpen
                    : Flag
                : null;
              const MilestoneIcon = milestoneIcon;

              return (
                <div
                  key={term.label}
                  ref={(node) => { nodeRefs.current[index] = node; }}
                  className="absolute z-10 flex w-[120px] -translate-x-1/2 -translate-y-1/2 snap-center flex-col items-center"
                  style={{
                    left: `${nodePoints[index].x}px`,
                    top: compact ? "8px" : `${nodePoints[index].y}px`,
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                >
                  {!compact && hoveredIndex === index ? (
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
                      <p className={`mt-0.5 text-[10px] ${isMissed ? "text-rose-300" : "text-emerald-300"}`}>
                        {isCompleted
                          ? "Semester validated"
                          : isCurrent
                            ? "Current step"
                            : isMissed
                              ? "Semester missed"
                              : `Unlocks after ${terms[index - 1]?.label ?? "the previous semester"}`}
                      </p>
                    </div>
                  ) : null}

                  {!compact && isCurrent && studentName ? (
                    <div className="animate-levitate pointer-events-none absolute -top-16 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
                      <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-sm backdrop-blur-sm ${stepStatusConfig.badgeClassName}`}>
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

                  <div
                    tabIndex={0}
                    aria-label={`${term.year}, ${term.semester}: ${stateLabel}`}
                    className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
                      compact ? "h-4 w-4 border-2" : "h-10 w-10 border-2"
                    } ${
                      isCompleted
                        ? compact
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:scale-110"
                        : isCurrent
                          ? compact
                            ? `${stepStatusConfig.compactActiveNodeClassName} h-4 w-4 border-2`
                            : `h-11 w-11 border-4 ${stepStatusConfig.activeNodeClassName}`
                          : isMissed
                            ? compact
                              ? "border-rose-400 bg-rose-500"
                              : "h-10 w-10 border-2 border-rose-200 bg-rose-50 text-rose-400"
                            : compact
                              ? "border-slate-600 bg-slate-800"
                              : "h-9 w-9 border-2 border-dashed border-slate-300 bg-slate-50 text-slate-300"
                    }`}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                  >
                    {isCompleted ? (
                      <Check className={compact ? "h-2.5 w-2.5" : "h-5 w-5 stroke-[3]"} aria-hidden="true" />
                    ) : isCurrent ? (
                      <span className={`rounded-full ${stepStatusConfig.activeNodeCoreClassName} ${compact ? "h-1.5 w-1.5" : "h-3.5 w-3.5 animate-pulse"}`} aria-hidden="true" />
                    ) : isMissed ? (
                      compact ? null : <span className="text-[10px] font-bold">N/A</span>
                    ) : compact ? null : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>

                  <span className={`mt-2.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider ${
                    isCurrent ? compact ? stepStatusConfig.activeLabelClassName : `font-extrabold ${stepStatusConfig.badgeIconClassName}`
                    : compact ? isCompleted ? "text-slate-300" : "text-slate-500" : "text-slate-400"
                  }`}>
                    {term.label}
                  </span>

                  {!compact && isCurrent ? (() => {
                    const { badgeClassName, badgeIconClassName, Icon } = stepStatusConfig;
                    return (
                      <span className={`mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${badgeClassName}`}>
                        <Icon className={`h-3 w-3 ${badgeIconClassName}`} aria-hidden="true" />
                        {stepStatusLabel}
                      </span>
                    );
                  })() : null}

                  {!compact && milestoneIcon && index !== 0 ? (
                    <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-2xs">
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
                className="absolute z-10 flex w-[120px] -translate-x-1/2 -translate-y-1/2 snap-center flex-col items-center"
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
                      {validatedIndexes.size === termCount ? "All semesters validated" : "Complete all semesters to unlock"}
                    </p>
                  </div>
                ) : null}
                <div
                  tabIndex={0}
                  aria-label={`Graduation: ${validatedIndexes.size === termCount ? "current milestone" : "locked"}`}
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
                    validatedIndexes.size === termCount
                      ? "bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-500/30"
                      : "border-2 border-slate-200 bg-white text-slate-300"
                  }`}
                >
                  <GraduationCap className="h-7 w-7" aria-hidden="true" />
                </div>
                <span className={`mt-2.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider ${
                  currentIndex === termCount ? "text-emerald-700" : "text-slate-400"
                }`}>
                  Graduation
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
          {validatedIndexes.size} of {termCount} semesters validated
        </p>
      ) : (
        <div className="relative z-10 mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{validatedIndexes.size} of {termCount} semesters validated</span>
        </div>
      )}
    </div>
  );
}
