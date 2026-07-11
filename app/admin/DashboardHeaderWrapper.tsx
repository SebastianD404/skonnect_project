"use client";

import { useState } from "react";
import DashboardHeader from "./DashboardHeader";
import { Users, CalendarDays, Inbox, Check, type LucideIcon } from "lucide-react";

export type TimePeriod = "Today" | "Week" | "Month" | "Quarter";

type IconName = "Users" | "CalendarDays" | "Inbox" | "Check";

interface StatItem {
  label: string;
  value: string;
  sub: string;
  delta: string;
  up: boolean;
  iconName: IconName;
}

interface DashboardHeaderWrapperProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  stats?: StatItem[];
  statsByPeriod?: Record<TimePeriod, StatItem[]>;
  compact?: boolean;
  onSearch?: (query: string) => void;
  showNotificationBell?: boolean;
}

const ICON_MAP: Record<IconName, LucideIcon> = {
  Users,
  CalendarDays,
  Inbox,
  Check,
};

export default function DashboardHeaderWrapper({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  stats,
  statsByPeriod,
  compact = false,
  onSearch,
  showNotificationBell = true,
}: DashboardHeaderWrapperProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("Month");
  const [searchQuery, setSearchQuery] = useState("");

  const activeStats = statsByPeriod?.[timePeriod] ?? stats ?? [];

  // Map stats with icon components
  const statsWithIcons = activeStats.map((stat) => ({
    ...stat,
    icon: ICON_MAP[stat.iconName],
  }));

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

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
      onSearch={handleSearch}
      stats={statsWithIcons}
      compact={compact}
      showNotificationBell={showNotificationBell}
    />
  );
}
