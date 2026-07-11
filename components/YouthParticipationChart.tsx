import React, { useEffect, useState, useRef } from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

const YouthParticipationGraph = () => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartData, setChartData] = useState<{ month: string; registrations: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRegistrationData = async () => {
      try {
        const response = await fetch("/api/analytics/registrations");
        const backendData = await response.json();

        const monthLabels = [
          "JAN",
          "FEB",
          "MAR",
          "APR",
          "MAY",
          "JUN",
          "JUL",
          "AUG",
          "SEP",
          "OCT",
          "NOV",
          "DEC",
        ];

        const formattedTimeline = monthLabels.map((month) => ({ month, registrations: 0 }));

        if (Array.isArray(backendData)) {
          backendData.forEach((item: { month: string; count: number }) => {
            const targetMonth = formattedTimeline.find((m) => m.month === item.month.toUpperCase());
            if (targetMonth) {
              targetMonth.registrations = item.count;
            }
          });
        }

        setChartData(formattedTimeline);
      } catch (error) {
        console.error("Error loading analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRegistrationData();
  }, []);

  useEffect(() => {
    if (!isLoading && scrollContainerRef.current) {
      const timer = window.setTimeout(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const currentMonthIndex = new Date().getMonth();
        const totalMonths = 12;
        const innerCanvasWidth = 960;
        const columnWidth = innerCanvasWidth / totalMonths;
        const monthCenterPosition = currentMonthIndex * columnWidth + columnWidth / 2;
        const targetScrollLeft = monthCenterPosition - container.clientWidth / 2;

        container.scrollLeft = targetScrollLeft;
      }, 100);

      return () => window.clearTimeout(timer);
    }
  }, [isLoading]);

  if (isLoading) {
    return <div className="h-40 flex items-center justify-center text-slate-400 text-xs">Loading analytics...</div>;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="w-full overflow-x-auto overflow-y-hidden block select-none scroll-smooth scrollbar-none touch-pan-x"
      style={{ minWidth: "0" }}
    >
      <div className="w-[960px] h-40 pr-4 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f3456" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#0f3456" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
            />

            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-md font-medium">
                      {`${payload[0].payload.month}: ${payload[0].value} registrations`}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="registrations"
              stroke="#0f3456"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRegistrations)"
              dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: "#0f3456" }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YouthParticipationGraph;
