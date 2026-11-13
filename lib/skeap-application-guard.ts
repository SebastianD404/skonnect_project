export type SkeapApplyRouter = {
  push: (href: string) => void;
};

type SkeapApplyToast = {
  title: string;
  description: string;
  variant: "warning" | "error" | "info";
};

const SKEAP_APPLY_TOAST_EVENT = "skonnect:skeap-apply-toast";

function showSkeapApplyToast(toast: SkeapApplyToast) {
  window.dispatchEvent(new CustomEvent<SkeapApplyToast>(SKEAP_APPLY_TOAST_EVENT, {
    detail: toast,
  }));
}

export function handleSkeapApply(
  kkProfileStatus: string | undefined,
  skeapStatus: string | null | undefined,
  router: SkeapApplyRouter,
  setShowVerificationModal: (show: boolean) => void,
  onApproved?: () => void,
) {
  switch (kkProfileStatus?.toUpperCase()) {
    case "APPROVED": {
      const currentSkeapStatus = skeapStatus?.toUpperCase() ?? null;
      if (currentSkeapStatus === "REVOKED") {
        showSkeapApplyToast({
          title: "Re-application Started",
          description:
            "You are starting a new SKEAP application. Please ensure you have resolved the grounds for your previous revocation.",
          variant: "info",
        });
      } else if (
        currentSkeapStatus !== null &&
        currentSkeapStatus !== "REJECTED"
      ) {
        showSkeapApplyToast({
          title: "Application unavailable",
          description: "Your current SKEAP status does not allow a new application.",
          variant: "warning",
        });
        return;
      }

      if (onApproved) {
        onApproved();
        return;
      }

      // TODO: Ensure the POST route creates a NEW SkeapApplication record and does not overwrite the historical REVOKED record.
      router.push("/programs/skeap/apply");
      return;
    }
    case "PENDING":
      setShowVerificationModal(true);
      return;
    case "REJECTED":
      showSkeapApplyToast({
        title: "SKEAP application unavailable",
        description:
          "Your Katipunan ng Kabataan profile was not approved, so you are not eligible to apply for SKEAP. Contact the helpdesk if you need assistance.",
        variant: "error",
      });
      router.push("/chatbot");
      return;
    default:
      showSkeapApplyToast({
        title: "KK profile required",
        description: "Complete your Katipunan ng Kabataan profile before applying for SKEAP.",
        variant: "warning",
      });
      router.push("/programs/kk-profiling");
  }
}

export function listenForSkeapApplyToasts(
  listener: (toast: SkeapApplyToast) => void,
) {
  const handleEvent = (event: Event) => {
    if (event instanceof CustomEvent) listener(event.detail as SkeapApplyToast);
  };
  window.addEventListener(SKEAP_APPLY_TOAST_EVENT, handleEvent);
  return () => window.removeEventListener(SKEAP_APPLY_TOAST_EVENT, handleEvent);
}
