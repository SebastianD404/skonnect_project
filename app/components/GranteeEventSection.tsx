"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

interface EventItem {
  id: string;
  title: string;
  description: string;
  status: string;
  maxSlots: number;
  filledSlots: number;
}

interface Props {
  events: EventItem[];
}

export function GranteeEventSection({ events }: Props) {
  const [eventList, setEventList] = useState(events);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleRegister = async (eventId: string) => {
    setNotification(null);
    setRegisteringId(eventId);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        if (result?.error === "Unauthorized") {
          window.location.href = "/signup";
          return;
        }

        setNotification({ type: "error", message: result?.error || "Registration failed. Please try again." });
      } else {
        setNotification({ type: "success", message: "You have successfully registered for this event." });
        setEventList((current) =>
          current.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  filledSlots: Math.min(event.filledSlots + 1, event.maxSlots),
                }
              : event
          )
        );
      }
    } catch (error) {
      setNotification({ type: "error", message: "Registration failed. Please check your connection and try again." });
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {notification ? (
        <div
          className={`col-span-full rounded-3xl px-5 py-4 text-sm shadow-sm ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {notification.message}
        </div>
      ) : null}

      {eventList.map((event) => {
        const pct = event.maxSlots > 0 ? Math.round((event.filledSlots / event.maxSlots) * 100) : 0;
        const isFull = event.filledSlots >= event.maxSlots;
        const isOpen = event.status === "REGISTRATION_OPEN";

        return (
          <article key={event.id} className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-[#0F3D5C]">{event.title}</p>
                <p className="mt-3 text-sm leading-6 text-[#555555]">{event.description}</p>
              </div>
              <span className="rounded-full bg-[#0F3D5C] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {isOpen ? "Open" : "Upcoming"}
              </span>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-100 p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                <span>{event.filledSlots}/{event.maxSlots} slots</span>
                <span>{pct}% taken</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-2.5 rounded-full bg-[#0F3D5C] transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-[#0F3D5C]" />
              <span>{isOpen ? "Registration open" : "Registration opens soon"}</span>
            </div>

            <button
              type="button"
              onClick={() => handleRegister(event.id)}
              disabled={!isOpen || isFull || registeringId === event.id}
              className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                !isOpen || isFull
                  ? "border border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed"
                  : "bg-[#0F3D5C] text-white shadow-lg hover:bg-[#0D2E47]"
              }`}
            >
              {registeringId === event.id ? "Registering..." : isFull ? "Full" : "Register now"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
