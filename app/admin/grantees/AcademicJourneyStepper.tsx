"use client";

import { GraduationCap } from "lucide-react";
import type { AcademicJourneyNode } from "@/lib/academic-journey";

type JourneyStepperNode = Pick<
  AcademicJourneyNode,
  "index" | "semester" | "yearNumber" | "semesterNumber" | "academicTermCaption" | "status"
>;

const NODE_STATUS_LABEL: Record<AcademicJourneyNode["status"], string> = {
  VALIDATED: "Validated",
  PENDING: "Pending review",
  UNDER_REVIEW: "Pending review",
  RETURNED: "Action required",
  PRE_GRANT: "Pre-grant",
  CURRENT: "Current Step",
  LOCKED: "Locked",
};

function getNodeClassName(status: AcademicJourneyNode["status"]) {
  if (status === "VALIDATED") return "bg-emerald-500";
  if (
    status === "CURRENT" ||
    status === "PENDING" ||
    status === "UNDER_REVIEW" ||
    status === "RETURNED"
  ) {
    return "bg-amber-400 ring-2 ring-amber-400/30";
  }
  return "border border-slate-600 bg-slate-700";
}

function getNodeLabel(node: JourneyStepperNode, index: number) {
  const yearNumber = node.yearNumber ?? Math.floor(index / 2) + 1;
  const semesterNumber = node.semesterNumber ?? ((index % 2) + 1);
  return `Y${yearNumber} S${semesterNumber}`;
}

function getTermCaption(node: JourneyStepperNode) {
  return node.academicTermCaption
    ?.replace(/^(\d{4})-(\d{4})/, "$1–$2")
    .replace(" · ", " ") ?? node.semester;
}

export default function AcademicJourneyStepper({
  nodes,
  validatedCount,
  configured,
}: {
  nodes: JourneyStepperNode[];
  validatedCount: number;
  configured: boolean;
}) {
  if (!configured || nodes.length === 0) {
    return (
      <p className="text-xs text-slate-300">Academic journey not configured</p>
    );
  }

  const isComplete = validatedCount >= nodes.length;
  const trackMinWidth = `${nodes.length * 44 + 24}px`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="min-w-0 flex-1 overflow-x-auto scrollbar-thin">
        <ol
          aria-label={`Academic Journey, ${validatedCount} of ${nodes.length} semesters validated`}
          className="flex items-start"
          style={{ minWidth: trackMinWidth }}
        >
          {nodes.map((node, index) => {
            const label = getNodeLabel(node, index);
            const tooltip =
              `${label} · ${getTermCaption(node)} — ${NODE_STATUS_LABEL[node.status]}`;
            const labelClassName =
              node.status === "VALIDATED"
                ? "text-slate-200"
                : node.status === "CURRENT" ||
                    node.status === "PENDING" ||
                    node.status === "UNDER_REVIEW" ||
                    node.status === "RETURNED"
                  ? "font-semibold text-amber-300"
                  : "text-slate-400";

            return (
              <li
                key={`${node.semester}-${node.index}`}
                title={tooltip}
                aria-label={tooltip}
                className="relative flex min-w-[44px] flex-1 flex-col items-center"
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-[5px] h-px bg-slate-700 ${
                    index < nodes.length - 1 ? "w-full" : "w-[calc(50%+12px)]"
                  }`}
                />
                <span
                  aria-hidden="true"
                  className={`relative z-10 h-2.5 w-2.5 rounded-full ${getNodeClassName(node.status)}`}
                />
                <span className={`mt-1 whitespace-nowrap text-[9px] ${labelClassName}`}>
                  {label}
                </span>
              </li>
            );
          })}
          <li
            title={isComplete ? "Graduation — all semesters validated" : "Graduation"}
            aria-label={isComplete ? "Graduation — all semesters validated" : "Graduation"}
            className="flex h-[22px] w-6 shrink-0 items-start justify-center"
          >
            <GraduationCap
              aria-hidden="true"
              className={`h-4 w-4 ${isComplete ? "text-emerald-400" : "text-slate-400"}`}
            />
          </li>
        </ol>
      </div>
      <span
        title={`${validatedCount} of ${nodes.length} semesters validated`}
        aria-label={`${validatedCount} of ${nodes.length} semesters validated`}
        className="shrink-0 text-sm font-semibold tabular-nums text-slate-100"
      >
        {validatedCount}/{nodes.length}
      </span>
    </div>
  );
}
