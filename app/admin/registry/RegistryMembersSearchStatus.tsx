"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type RegistryMembersSearchStatus = {
  isSearching: boolean;
  setIsSearching: Dispatch<SetStateAction<boolean>>;
};

const RegistryMembersSearchStatusContext = createContext<RegistryMembersSearchStatus | null>(null);

export function RegistryMembersSearchStatusProvider({ children }: { children: ReactNode }) {
  const [isSearching, setIsSearching] = useState(false);

  return (
    <RegistryMembersSearchStatusContext.Provider value={{ isSearching, setIsSearching }}>
      {children}
    </RegistryMembersSearchStatusContext.Provider>
  );
}

export function useRegistryMembersSearchStatus() {
  return useContext(RegistryMembersSearchStatusContext);
}
