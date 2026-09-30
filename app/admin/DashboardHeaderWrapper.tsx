"use client";

import { useState } from "react";
import DashboardHeader from "./DashboardHeader";
import { Users, CalendarDays, Inbox, Check, FileText, CheckSquare, GraduationCap, type LucideIcon } from "lucide-react";

export type TimePeriod = "Today" | "Week" | "Month" | "Quarter";

type IconName = "Users" | "CalendarDays" | "Inbox" | "Check" | "FileText" | "CheckSquare" | "GraduationCap";

interface StatItem {
  label: string;
  value: string;
  sub: string;
  delta?: string;
  up?: boolean;
  href?: string;
  accent?: "cyan" | "amber" | "emerald";
  iconName: IconName;
}

interface DashboardHeaderWrapperProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  stats?: StatItem[];
  statsByPeriod?: Record<TimePeriod, StatItem[]>;
  operationalSnapshot?: boolean;
  compact?: boolean;
  showNotificationBell?: boolean;
}

const ICON_MAP: Record<IconName, LucideIcon> = {
  Users,
  CalendarDays,
  Inbox,
  Check,
  FileText,
  CheckSquare,
  GraduationCap,
};

export default function DashboardHeaderWrapper({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  stats,
  statsByPeriod,
  operationalSnapshot = false,
  compact = false,
  showNotificationBell = true,
}: DashboardHeaderWrapperProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("Month");

  const activeStats = statsByPeriod?.[timePeriod] ?? stats ?? [];

  // Map stats with icon components
  const statsWithIcons = activeStats.map((stat) => ({
    ...stat,
    icon: ICON_MAP[stat.iconName],
  }));

  const handleTimePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period);
  };

  return (
    <DashboardHeader
      dateLabel={dateLabel}
      openInquiryCount={openInquiryCount}
      pendingSubmissionCount={pendingSubmissionCount}
      timePeriod={timePeriod}
      onTimePeriodChange={handleTimePeriodChange}
      stats={statsWithIcons}
      operationalSnapshot={operationalSnapshot}
      compact={compact}
      showNotificationBell={showNotificationBell}
      showToolbar={false}
    />
  );
}
