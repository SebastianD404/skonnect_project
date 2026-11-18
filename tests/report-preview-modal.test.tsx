// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ReportPreviewModal from "@/app/admin/reports/ReportPreviewModal";
import type { ReportCard } from "@/app/admin/reports/ReportsDashboard";

const mocks = vi.hoisted(() => ({ downloadReport: vi.fn() }));

vi.mock("@/app/admin/reports/report-download", () => ({ downloadReport: mocks.downloadReport }));

const report: ReportCard = {
  title: "Archived/Aged-Out Youth Records",
  description: "Archived profiles",
  href: "/api/admin/reports/export?type=archived_youth",
  reportKey: "archived_youth",
  icon: "archive",
  reportType: "ARCHIVED_RECORDS",
};

function previewPayload() {
  return {
    title: report.title,
    columns: [{ header: "Full Name", key: "fullName" }],
    rows: [{ fullName: "Resident One" }],
    summary: [{ label: "Total Records", value: 1 }],
    totalCount: 1,
    generatedAt: "2026-11-18T10:00:00.000Z",
    isAggregate: false,
    previewLimit: 20,
  };
}

describe("ReportPreviewModal", () => {
  it("syncs the archive reason filter to preview requests and the full download", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => previewPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.downloadReport.mockResolvedValue(undefined);
    function Harness() {
      const [reason, setReason] = useState("all");
      return (
        <ReportPreviewModal
          report={report}
          archivedReasonFilter={reason}
          onArchivedReasonChange={setReason}
          archivedStartDate=""
          archivedEndDate=""
          onArchivedDateRangeChange={vi.fn()}
          onClose={vi.fn()}
        />
      );
    }

    render(<Harness />);

    await waitFor(() => expect(screen.getByText("Resident One")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Filter by archive reason"), {
      target: { value: "deceased" },
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining("archiveReason=deceased"),
        expect.objectContaining({ cache: "no-store" }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Download Full Report (.xlsx)" }));
    await waitFor(() => expect(mocks.downloadReport).toHaveBeenCalledWith(expect.objectContaining({
      href: report.href,
      params: expect.objectContaining({ archiveReason: "deceased" }),
    })));
  });
});
