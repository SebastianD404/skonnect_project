"use client";

import { useEffect, useState } from "react";

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
      <ol className="mt-4 flex flex-col border-l border-slate-200/80">
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
                className={`group -ml-px flex items-center gap-2.5 border-l-2 py-1.5 pl-3.5 pr-2 text-sm transition-colors duration-150 ${
                  isActive
                    ? "border-slate-900 font-semibold text-slate-900"
                    : "border-transparent font-normal text-slate-500 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    isActive
                      ? "font-semibold text-teal-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                >
                  {section.index}
                </span>
                {section.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
