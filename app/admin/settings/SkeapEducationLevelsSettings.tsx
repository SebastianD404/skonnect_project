"use client";

import {
  SKEAP_EDUCATION_LEVEL_OPTIONS,
  type SkeapEducationLevelCode,
} from "@/lib/skeap-education";

type Props = {
  activeLevels: readonly SkeapEducationLevelCode[];
  onToggle: (code: SkeapEducationLevelCode, checked: boolean) => void;
  disabled?: boolean;
};

export default function SkeapEducationLevelsSettings({
  activeLevels,
  onToggle,
  disabled = false,
}: Props) {
  return (
    <section className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900">SKEAP education categories</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Select the education categories open for the current SKEAP cycle. Tech-Voc remains available to enable in a future cycle.
        </p>
      </div>
      <div className="md:col-span-2">
        <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Education categories open for the current SKEAP cycle</legend>
          {SKEAP_EDUCATION_LEVEL_OPTIONS.map((option) => {
            const isSelected = activeLevels.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled || (isSelected && activeLevels.length === 1)}
                  onChange={(event) => onToggle(option.value, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Changes are included with the page&apos;s Save settings action. At least one category must remain enabled.
        </p>
      </div>
    </section>
  );
}
