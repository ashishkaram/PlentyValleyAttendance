import { describe, expect, it } from "vitest";
import { allowedActions, buildPreview, defaultUploadActiveFrom, excelSerialToISODate, parseActiveFrom, planImport, rowsFromTable, type DuplicateAction } from "../upload";
import { SEASON_2026 } from "./fixtures";

describe("parseActiveFrom", () => {
  it("accepts DD/MM/YYYY, YYYY-MM-DD and Excel serials", () => {
    expect(parseActiveFrom("29/09/2026")).toBe("2026-09-29");
    expect(parseActiveFrom("1/10/2026")).toBe("2026-10-01");
    expect(parseActiveFrom("2026-09-29")).toBe("2026-09-29");
    expect(parseActiveFrom(46294)).toBe("2026-09-29");
    expect(excelSerialToISODate(1)).toBe("1900-01-01");
    expect(excelSerialToISODate(61)).toBe("1900-03-01");
  });
  it("returns blank for empty cells and null for junk", () => {
    expect(parseActiveFrom("")).toBe("blank");
    expect(parseActiveFrom(undefined)).toBe("blank");
    expect(parseActiveFrom("31/02/2026")).toBeNull();
    expect(parseActiveFrom("next week")).toBeNull();
  });
});

describe("rowsFromTable", () => {
  it("maps headers case-insensitively and skips blank lines", () => {
    const result = rowsFromTable([["name", "PLAYER NUMBER", "Active From"], ["Amy", "7", ""], ["", "", ""], ["Bea", "", "1/10/2026"]]);
    expect("rows" in result && result.rows.map((r) => r.rowNumber)).toEqual([2, 4]);
  });
  it("requires a Name column", () => {
    expect(rowsFromTable([["Player", "Number"]])).toHaveProperty("error");
  });
});

describe("buildPreview and planImport", () => {
  const existing = [{ id: "e1", name: "Amy Adams", player_number: "3" }];
  const table = [
    ["Name", "Player number", "Active from"],
    ["amy adams ", "4", ""], // duplicate of existing
    ["Bea", "", "01/10/2026"],
    ["", "5", ""], // missing name
    ["Cat", "", "2026-09-01"], // before season start
    ["BEA", "9", ""], // duplicate within file
    ["Dee", "", "not a date"],
  ];
  const parsed = rowsFromTable(table);
  if (!("rows" in parsed)) throw new Error("bad fixture");
  const preview = buildPreview({ rows: parsed.rows, existing, defaultActiveFrom: "2026-09-29", season: SEASON_2026 });

  it("validates each row", () => {
    expect(preview.map((r) => r.errors.length > 0)).toEqual([false, false, true, true, false, true]);
    expect(preview[0].activeFrom).toBe("2026-09-29");
    expect(preview[0].usedDefaultDate).toBe(true);
  });

  it("detects duplicates against existing players and within the file", () => {
    expect(preview[0].existingMatches.map((m) => m.id)).toEqual(["e1"]);
    expect(preview[4].duplicateOfRow).toBe(3);
    expect(allowedActions(preview[0])).toEqual(["skip", "update_number", "add"]);
    expect(allowedActions(preview[4])).toEqual(["skip", "add"]);
    expect(allowedActions(preview[1])).toEqual(["add"]);
  });

  it("defaults duplicates to skip and follows the manager's choices", () => {
    const skipAll = planImport(preview, new Map());
    expect(skipAll.operations.map((o) => o.rowNumber)).toEqual([3]);
    expect(skipAll.skipped).toEqual([2, 6]);
    expect(skipAll.errors.map((e) => e.rowNumber)).toEqual([4, 5, 7]);

    const choices = new Map<number, DuplicateAction>([[2, "update_number"], [6, "add"]]);
    const plan = planImport(preview, choices);
    expect(plan.operations).toEqual([
      { kind: "update_number", rowNumber: 2, playerId: "e1", playerNumber: "4" },
      { kind: "add", rowNumber: 3, name: "Bea", playerNumber: null, activeFrom: "2026-10-01" },
      { kind: "add", rowNumber: 6, name: "BEA", playerNumber: "9", activeFrom: "2026-09-29" },
    ]);
  });
});

describe("defaultUploadActiveFrom", () => {
  it("uses the season start for the initial squad, otherwise today", () => {
    expect(defaultUploadActiveFrom(0, "2026-09-29", "2026-10-03")).toBe("2026-09-29");
    expect(defaultUploadActiveFrom(12, "2026-09-29", "2026-10-03")).toBe("2026-10-03");
  });
});
