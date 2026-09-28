import { describe, expect, it } from "vitest";
import { DEFAULT_BREAKS, DEFAULT_SEASON, validateSettings } from "../settings";
import { expectedSessionDates } from "../sessions";

describe("validateSettings", () => {
  it("accepts the 2026-27 defaults, which produce 44 sessions", () => {
    expect(validateSettings(DEFAULT_SEASON, DEFAULT_BREAKS)).toEqual([]);
    expect(expectedSessionDates(DEFAULT_SEASON, DEFAULT_BREAKS)).toHaveLength(44);
  });
  it("rejects bad seasons and breaks", () => {
    expect(validateSettings({ ...DEFAULT_SEASON, end_date: "2026-09-01" }, [])).toHaveLength(1);
    expect(validateSettings({ ...DEFAULT_SEASON, training_weekdays: [] }, [])).toHaveLength(1);
    expect(validateSettings({ ...DEFAULT_SEASON, low_attendance_threshold: 101 }, [])).toHaveLength(1);
    expect(validateSettings(DEFAULT_SEASON, [{ name: "", start_date: "2026-12-16", end_date: "2026-12-15" }])).toHaveLength(2);
  });
});
