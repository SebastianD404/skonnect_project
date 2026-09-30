"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

type KKProfilingTableSearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
};

const KKProfilingTableSearchContext = createContext<KKProfilingTableSearchContextValue | null>(null);

export function KKProfilingTableSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");

  return (
    <KKProfilingTableSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </KKProfilingTableSearchContext.Provider>
  );
}

export function useKKProfilingTableSearch() {
  return useContext(KKProfilingTableSearchContext);
}

export function KKProfilingTableSearchField() {
  const search = useKKProfilingTableSearch();
  if (!search) return null;

  return (
    <label className="relative block w-full sm:w-80">
      <span className="sr-only">Filter the current profiling table</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        placeholder="Filter by name, email, or classification..."
        title="Filters rows in the current table view"
        className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-400"
      />
    </label>
  );
}
