import { afterEach, describe, expect, it, vi } from "vitest";
import { handleSkeapApply } from "@/lib/skeap-application-guard";

describe("handleSkeapApply", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes approved first-time applicants without a re-application toast", () => {
    const router = { push: vi.fn() };
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    handleSkeapApply("APPROVED", null, router, vi.fn());

    expect(router.push).toHaveBeenCalledWith("/programs/skeap/apply");
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("starts an approved application in place when an application callback is provided", () => {
    const router = { push: vi.fn() };
    const onApproved = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });

    handleSkeapApply("APPROVED", null, router, vi.fn(), onApproved);

    expect(onApproved).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("allows rejected applicants to reapply without a revoked-grantee toast", () => {
    const router = { push: vi.fn() };
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    handleSkeapApply("APPROVED", "REJECTED", router, vi.fn());

    expect(router.push).toHaveBeenCalledWith("/programs/skeap/apply");
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("notifies revoked grantees before routing them to a new application", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };

    handleSkeapApply("APPROVED", "REVOKED", router, vi.fn());

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: "Re-application Started",
          variant: "info",
          description: expect.stringContaining("resolved the grounds"),
        }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/programs/skeap/apply");
  });

  it("does not allow a current grantee to start another application", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };
    const onApproved = vi.fn();

    handleSkeapApply("APPROVED", "ACTIVE", router, vi.fn(), onApproved);

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: "Application unavailable",
          variant: "warning",
        }),
      }),
    );
    expect(onApproved).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens verification for pending profiles without navigating", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };
    const setShowVerificationModal = vi.fn();

    handleSkeapApply("PENDING", null, router, setShowVerificationModal);

    expect(setShowVerificationModal).toHaveBeenCalledWith(true);
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("notifies rejected profiles and routes them to the helpdesk", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const router = { push: vi.fn() };

    handleSkeapApply("REJECTED", null, router, vi.fn());

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          variant: "error",
          description: expect.stringContaining("not approved"),
        }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/chatbot");
  });
});
