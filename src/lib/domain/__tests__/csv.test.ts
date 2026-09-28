import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "../csv";

describe("csv", () => {
  it("quotes fields with commas, quotes and newlines", () => {
    expect(csvField('Smith, "Jo"')).toBe('"Smith, ""Jo"""');
    expect(csvField("a\nb")).toBe('"a\nb"');
    expect(csvField(88)).toBe("88");
    expect(csvField(null)).toBe("");
  });
  it("neutralises formula injection", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("-5")).toBe("'-5");
  });
  it("joins rows with CRLF", () => {
    expect(toCsv([["a", "b"], [1, 2]])).toBe("a,b\r\n1,2\r\n");
  });
});
