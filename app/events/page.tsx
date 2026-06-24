"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, Ticket, Users } from "lucide-react";

type EventItem = {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  slotsFilled: number;
  capacity: number;
  tags: string[];
  imageUrl: string;
};

const EVENTS: EventItem[] = [
  {
    id: "youth-leadership-summit",
    title: "Youth Leadership Summit",
    date: "June 24, 2026 · 9:00 AM – 3:00 PM",
    location: "Barangay Hall",
    description: "A full-day leadership workshop for youth leaders with planning sessions, motivational talks, and community project planning.",
    slotsFilled: 20,
    capacity: 30,
    tags: ["Leadership", "SK Official"],
    imageUrl: "/brgyhall.jpeg",
  },
  {
    id: "scholarship-orientation",
    title: "Scholarship Orientation",
    date: "July 2, 2026 · 1:00 PM – 4:00 PM",
    location: "Community Center",
    description: "Get the latest SKEAP updates, scholarship requirements, and step-by-step help for submitting your documents correctly.",
    slotsFilled: 26,
    capacity: 30,
    tags: ["SKEAP", "Scholarship"],
    imageUrl: "/brgyhall.jpeg",
  },
  {
    id: "barangay-youth-games",
    title: "Barangay Youth Games",
    date: "July 15, 2026 · 8:00 AM – 5:00 PM",
    location: "Pico Sports Complex",
    description: "Friendly competitions for youth teams with sports, arts, and academic challenges. Awards and support come from the SK office.",
    slotsFilled: 28,
    capacity: 30,
    tags: ["Sports", "Team"],
    imageUrl: "/brgyhall.jpeg",
  },
];

export default function EventsPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [registrationEvent, setRegistrationEvent] = useState<EventItem | null>(null);
  const [registrantName, setRegistrantName] = useState("");
  const [registrantContact, setRegistrantContact] = useState("");
  const [registrationNotes, setRegistrationNotes] = useState("");
  const [registrationConfirmed, setRegistrationConfirmed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <header className="sticky top-0 z-50 border-b border-white/50 bg-gradient-to-b from-[#FAFBFC]/95 to-[#F5F7FB]/90 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] shadow-lg text-xs font-black tracking-tighter text-white">
              SK
            </div>
            <span className="text-xl font-black tracking-tight text-[#0F3D5C]">SKonnect</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Link href="/" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">
              Home
            </Link>
            <Link href="/about" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">
              About
            </Link>
            <Link href="/events" className="px-4 py-2 font-semibold rounded-lg bg-[#0F3D5C]/10 text-[#0F3D5C]">
              Events
            </Link>
            <a href="/#programs" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">
              Programs
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-[#3C3C3C] transition-all px-4 py-2 hover:text-[#0F3D5C]">
              Log in
            </Link>
            <Link href="/signup" className="rounded-xl bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr] items-start">
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-[#0F3D5C]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C] mb-6">
              <span className="w-2 h-2 rounded-full bg-[#0F3D5C]"></span>
              Official SK events
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#0F3D5C] mt-2">
              Live SK Events Hub
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              This is the central events hub for Pico youth and SKEAP grantees. Here you can see official event announcements, live registration availability, and the slots remaining for each program.
            </p>
          </section>

          <aside className="self-start rounded-[2rem] border border-slate-200 bg-[#F8FBFF] p-8 shadow-sm pb-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">How it works</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Register in a few steps</h2>
            <ol className="mt-5 space-y-2 text-sm leading-6 text-slate-600">
              <li>
                <strong className="text-slate-900">1.</strong> Browse events uploaded by the SK official.
              </li>
              <li>
                <strong className="text-slate-900">2.</strong> Review the slot count and deadline.
              </li>
              <li>
                <strong className="text-slate-900">3.</strong> Click Register to secure your seat.
              </li>
              <li>
                <strong className="text-slate-900">4.</strong> Use your account dashboard to track registration status.
              </li>
            </ol>
          </aside>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <Users className="h-5 w-5 text-[#0F3D5C]" />
              <span>Designed for Pico Youth</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Event registration and seat counts are visible in real time, so you know when slots are filling fast.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <CalendarDays className="h-5 w-5 text-[#0F3D5C]" />
              <span>Upcoming schedule and deadlines</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Events appear as soon as SK uploads them, with clear dates, locations, and registration status for every youth activity.
            </p>
          </div>
        </div>

        <section className="mt-16">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Live events</p>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Current events and open registration</h2>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-[#0F3D5C]/15 bg-white px-4 py-3 text-sm font-semibold text-[#0F3D5C] shadow-sm">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#0F3D5C]"></span>
              Updated by SK officials
            </div>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {EVENTS.map((event) => {
              const pct = Math.round((event.slotsFilled / event.capacity) * 100);
              const isFull = event.slotsFilled >= event.capacity;

              return (
                <article key={event.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(event.imageUrl);
                      setSelectedImageTitle(event.title);
                    }}
                    className="group relative block h-48 w-full overflow-hidden"
                  >
                    <img src={event.imageUrl} alt={`${event.title} image`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-white">
                      <p className="text-xs uppercase tracking-[0.24em]">SK official event</p>
                    </div>
                    <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                      <span className="rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white">
                        View image
                      </span>
                    </div>
                  </button>

                  <div className="px-6 py-7">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.32em] text-teal-600">
                          {event.date}
                        </p>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
                          {event.title}
                        </h3>
                      </div>
                      <div className="rounded-full bg-[#0F3D5C]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">
                        {isFull ? "Full" : "Open"}
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {event.description}
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4 text-[#0F3D5C]" />
                      <span>{event.location}</span>
                    </div>

                    <div className="mt-5 rounded-3xl bg-slate-100 p-4">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                        <span>{event.slotsFilled}/{event.capacity} slots</span>
                        <span>{pct}% taken</span>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-2.5 rounded-full bg-[#0F3D5C]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {event.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isFull) {
                            setRegistrationEvent(event);
                            setRegistrantName("");
                            setRegistrantContact("");
                            setRegistrationNotes("");
                            setRegistrationConfirmed(false);
                          }
                        }}
                        className={
                          "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition " +
                          (isFull
                            ? "border border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed"
                            : "bg-[#0F3D5C] text-white shadow-lg hover:bg-[#0D2E47]")
                        }
                      >
                        {isFull ? "Registration closed" : "Register now"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {selectedImage ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 sm:px-6">
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl sm:mx-auto">
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/80"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <img src={selectedImage} alt={selectedImageTitle} className="h-[70vh] w-full object-contain bg-black" />
              <div className="border-t border-white/10 bg-slate-950 px-6 py-4 text-sm text-slate-200">
                <div className="font-semibold text-white">{selectedImageTitle}</div>
                <div className="mt-1 text-slate-300">Full image preview</div>
              </div>
            </div>
          </div>
        ) : null}

        {registrationEvent ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 sm:px-6">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:mx-auto">
              <button
                type="button"
                onClick={() => setRegistrationEvent(null)}
                className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="px-6 pt-20 pb-6 sm:px-10 sm:pt-24 sm:pb-8">
                <p className="text-xs uppercase tracking-[0.35em] text-teal-600">Event registration</p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-900">{registrationEvent.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{registrationEvent.date} · {registrationEvent.location}</p>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setRegistrationConfirmed(true);
                  }}
                  className="mt-8 space-y-5"
                >
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-800">Your name</label>
                    <input
                      value={registrantName}
                      onChange={(event) => setRegistrantName(event.target.value)}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-800">Contact info</label>
                    <input
                      value={registrantContact}
                      onChange={(event) => setRegistrantContact(event.target.value)}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="Email or phone number"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-800">Notes / questions</label>
                    <textarea
                      value={registrationNotes}
                      onChange={(event) => setRegistrationNotes(event.target.value)}
                      className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="Optional details for organizers"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">{registrationEvent.slotsFilled}/{registrationEvent.capacity} slots filled</p>
                      <p>{Math.round((registrationEvent.slotsFilled / registrationEvent.capacity) * 100)}% taken</p>
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-[#0F3D5C] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0D2E47]"
                    >
                      Confirm registration
                    </button>
                  </div>
                </form>

                {registrationConfirmed ? (
                  <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
                    Registration submitted! We’ll follow up with confirmation details soon.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <section className="mt-16 rounded-[2rem] border border-slate-200 bg-[#F8FBFF] p-10 text-center shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Need help?</p>
          <h2 className="mt-4 text-3xl font-black text-slate-900">Want to see more event details?</h2>
          <p className="mt-4 max-w-2xl mx-auto text-sm leading-7 text-slate-600">
            SKonnect is building the official events stream for youth programs. If you need assistance with registration or want support for a scholarship event, the helpdesk is ready to assist.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center rounded-full bg-[#0F3D5C] px-8 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#0D2E47] transition">
              Create an account
            </Link>
            <Link href="/chatbot" className="inline-flex items-center justify-center rounded-full border border-[#0F3D5C] bg-white px-8 py-3 text-sm font-semibold text-[#0F3D5C] transition hover:bg-[#F0F8FF]">
              Ask the helpdesk
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
