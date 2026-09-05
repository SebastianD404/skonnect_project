"use client";

import type { SelectHTMLAttributes } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "name" | "children"> & {
  options: SelectOption[];
  value: string;
  name?: string;
};

export function Select({ options, value, name = "semester", className, ...props }: SelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, nextValue);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      name={name}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none shadow-sm focus:border-sky-400",
        className
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-white text-slate-900">
          {option.label}
        </option>
      ))}
    </select>
  );
}
