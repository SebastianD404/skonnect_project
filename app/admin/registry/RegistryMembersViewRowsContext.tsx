"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { KKProfilingRegistration } from "../kk-profiling/types";

const RegistryMembersViewRowsContext = createContext<KKProfilingRegistration[] | null>(null);

export function RegistryMembersViewRowsProvider({
  rows,
  children,
}: {
  rows: KKProfilingRegistration[];
  children: ReactNode;
}) {
  return (
    <RegistryMembersViewRowsContext.Provider value={rows}>
      {children}
    </RegistryMembersViewRowsContext.Provider>
  );
}

export function useRegistryMembersViewRows() {
  return useContext(RegistryMembersViewRowsContext);
}
