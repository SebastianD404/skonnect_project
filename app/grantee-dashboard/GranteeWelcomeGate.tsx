"use client";

import { useState } from "react";
import GranteeWelcomeModal from "./GranteeWelcomeModal";

type Props = {
  initialShouldShow: boolean;
};

export default function GranteeWelcomeGate({ initialShouldShow }: Props) {
  const [isOpen, setIsOpen] = useState(initialShouldShow);
  const [isSaving, setIsSaving] = useState(false);

  const handleAcknowledge = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/grantee/onboarding/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Unable to save onboarding state.");
      }

      setIsOpen(false);
    } catch {
      // Keep modal open so user can retry acknowledgement.
    } finally {
      setIsSaving(false);
    }
  };

  return <GranteeWelcomeModal isOpen={isOpen} isSaving={isSaving} onAcknowledge={handleAcknowledge} />;
}
