"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FloatingFeedback from "@/app/components/FloatingFeedback";

export default function YouthDashboardWelcomeToast({ show }: { show: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    router.replace("/youth/dashboard", { scroll: false });
  }, [router, show]);

  if (!visible) return null;

  return (
    <FloatingFeedback
      message="Account created! Welcome to SKonnect."
      type="success"
      onDismiss={() => setVisible(false)}
    />
  );
}
