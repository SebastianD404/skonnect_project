"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AdminSearchContextValue = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
};

const AdminSearchContext = createContext<AdminSearchContextValue | null>(null);

export function AdminSearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <AdminSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </AdminSearchContext.Provider>
  );
}

export function useAdminSearch() {
  const context = useContext(AdminSearchContext);
  if (!context) {
    throw new Error("useAdminSearch must be used within an AdminSearchProvider");
  }
  return context;
}
