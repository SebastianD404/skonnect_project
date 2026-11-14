"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

export type ProgramTocSection = {
  id: string;
  index: string;
  label: string;
};

export default function ProgramTableOfContents({
  sections,
}: {
  sections: ProgramTocSection[];
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    if (!sections.length) return;

    const updateActiveSection = () => {
      const activationPoint = window.innerHeight * 0.5;
      const passedSections = sections
        .map((section) => ({
          id: section.id,
          element: document.getElementById(section.id),
        }))
        .filter((section) => section.element)
        .map((section) => ({
          id: section.id,
          rect: section.element!.getBoundingClientRect(),
        }))
        .filter((section) => section.rect.top <= activationPoint);
      const currentSection = passedSections.find(
        (section) => section.rect.bottom > activationPoint,
      );
      setActiveId(
        currentSection?.id ??
          passedSections[passedSections.length - 1]?.id ??
          sections[0].id,
      );
    };

    let updateFrame: number | null = null;
    const scheduleActiveSectionUpdate = () => {
      if (updateFrame !== null) return;
      updateFrame = window.requestAnimationFrame(() => {
        updateFrame = null;
        updateActiveSection();
      });
    };

    const observer = new IntersectionObserver(scheduleActiveSectionUpdate, {
      rootMargin: "-20% 0px -65% 0px",
    });
    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    updateActiveSection();
    window.addEventListener("scroll", scheduleActiveSectionUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveSectionUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleActiveSectionUpdate);
      window.removeEventListener("resize", scheduleActiveSectionUpdate);
      if (updateFrame !== null) window.cancelAnimationFrame(updateFrame);
    };
  }, [sections]);

  return (
    <nav aria-label="On this page">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
        On this page
      </p>
      <ol className="mt-4 flex flex-col gap-1 border-l-2 border-slate-100 pl-2">
        {sections.map((section) => {
          const isActive = activeId === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveId(section.id);
                  document.getElementById(section.id)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-sky-50/80 font-semibold text-slate-900 ring-1 ring-inset ring-sky-200/70"
                    : "font-medium text-slate-600 hover:translate-x-0.5 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                      isActive
                        ? "bg-sky-600 font-bold text-white"
                        : "text-slate-400 group-hover:text-sky-600"
                    }`}
                  >
                    {section.index}
                  </span>
                  {section.label}
                </span>
                {isActive ? (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-sky-600"
                    aria-hidden="true"
                  />
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
