import { describe, expect, it } from "vitest";
import { renderMessageTemplate } from "../lib/reminders";

describe("renderMessageTemplate", () => {
  it("replaces known merge tags and preserves unknown tags", () => {
    const rendered = renderMessageTemplate(
      "Due {{deadline_date}} at {{deadline_time}} for {{current_semester}}; {{unknown_tag}}",
      {
        deadline_date: "April 27, 2026",
        deadline_time: "5:00 PM",
        current_semester: "2026-2027 First Semester",
        last_semester: "2025-2026 Second Semester",
      }
    );

    expect(rendered).toBe(
      "Due April 27, 2026 at 5:00 PM for 2026-2027 First Semester; {{unknown_tag}}"
    );
  });
});
