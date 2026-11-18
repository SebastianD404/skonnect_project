// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReportsDashboard, { type ReportSection } from "@/app/admin/reports/ReportsDashboard";

const mocks = vi.hoisted(() => ({ downloadReport: vi.fn() }));

vi.mock("@/app/admin/reports/report-download", () => ({ downloadReport: mocks.downloadReport }));
vi.mock("@/app/admin/reports/ReportConfigurationModal", () => ({
  default: ({ report }: { report: { title: string } }) => (
    <div role="dialog" aria-label="configuration">{report.title}</div>
  ),
}));
vi.mock("@/app/admin/reports/ReportPreviewModal", () => ({
  default: ({ report }: { report: { title: string } }) => (
    <div role="dialog" aria-label="preview">{report.title}</div>
  ),
}));

const sections: ReportSection[] = [
  {
    title: "KK Registry",
    description: "KK reports",
    reports: [{
      title: "Full KK Census Masterlist",
      description: "All approved profiles",
      href: "/api/admin/reports/export?type=full_kk_census",
      reportKey: "full_kk_census",
      icon: "users",
      reportType: "STATIC",
    }],
  },
  {
    title: "SKEAP",
    description: "Scholarship reports",
    reports: [{
      title: "Active Scholars Masterlist",
      description: "Active scholars",
      href: "/api/admin/reports/export?type=active_scholars",
      reportKey: "active_scholars",
      icon: "badge-check",
      reportType: "STATIC",
    }],
  },
  {
    title: "Financial Audits",
    description: "Financial reports",
    reports: [{
      title: "Payroll",
      description: "Current payroll",
      href: "/api/admin/reports/export?type=skeap_financial",
      reportKey: "skeap_financial",
      icon: "banknote",
      reportType: "SKEAP_FINANCIAL",
      semesterOptions: [{ value: "2026-2027 First Semester", label: "Current Semester" }],
    }],
  },
];

describe("Generate Reports dashboard", () => {
  it("opens report previews across sections and keeps direct export independent", async () => {
    mocks.downloadReport.mockResolvedValue(undefined);
    render(<ReportsDashboard sections={sections} />);

    expect(screen.getAllByText("Preview")).toHaveLength(3);
    fireEvent.click(
      within(screen.getByLabelText("Preview Full KK Census Masterlist"))
        .getByRole("button", { name: /Quick Export/ }),
    );
    await waitFor(() => expect(mocks.downloadReport).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: "preview" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Active Scholars Masterlist").closest("article")!);
    expect(screen.getByRole("dialog", { name: "preview" })).toHaveTextContent("Active Scholars Masterlist");
  });

  it("opens a filter configuration without opening the preview", () => {
    render(<ReportsDashboard sections={sections} />);

    fireEvent.click(screen.getByRole("button", { name: "Advanced settings for Payroll" }));

    expect(screen.getByRole("dialog", { name: "configuration" })).toHaveTextContent("Payroll");
    expect(screen.queryByRole("dialog", { name: "preview" })).not.toBeInTheDocument();
  });
});
