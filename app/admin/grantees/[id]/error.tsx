"use client";

import { useEffect } from "react";
import GranteeDetailErrorState from "./GranteeDetailErrorState";

export default function GranteeDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Grantee details route failed to render:", error);
  }, [error]);

  return <GranteeDetailErrorState onRetry={reset} />;
}
