import { describe, expect, it } from "vitest";
import { comparePlayers, filterPlayers, nameKey, validateName } from "../players";

const p = (name: string, player_number: string | null, is_active = true) => ({ name, player_number, is_active });

describe("comparePlayers", () => {
  it("sorts numbers naturally, then name, with unnumbered players last", () => {
    const sorted = [p("Zoe", null), p("Ivy", "10"), p("Amy", null), p("Bea", "2"), p("Cat", "07"), p("Dee", "1")].sort(comparePlayers);
    expect(sorted.map((x) => x.name)).toEqual(["Dee", "Bea", "Cat", "Ivy", "Amy", "Zoe"]);
  });
  it("breaks number ties by name", () => {
    const sorted = [p("Zoe", "7"), p("Amy", "07")].sort(comparePlayers);
    expect(sorted.map((x) => x.name)).toEqual(["Amy", "Zoe"]);
  });
});

describe("names", () => {
  it("requires 1-100 characters after trimming", () => {
    expect(validateName("   ")).not.toBeNull();
    expect(validateName("A")).toBeNull();
    expect(validateName("x".repeat(101))).not.toBeNull();
  });
  it("matches case-insensitively and trimmed", () => {
    expect(nameKey("  Jane  Citizen ")).toBe(nameKey("jane citizen"));
  });
});

describe("filterPlayers", () => {
  const players = [p("Amy", "1"), p("Bea", "2", false)];
  it("filters by status and search", () => {
    expect(filterPlayers(players, "active", "").map((x) => x.name)).toEqual(["Amy"]);
    expect(filterPlayers(players, "inactive", "").map((x) => x.name)).toEqual(["Bea"]);
    expect(filterPlayers(players, "all", "be").map((x) => x.name)).toEqual(["Bea"]);
    expect(filterPlayers(players, "all", "1").map((x) => x.name)).toEqual(["Amy"]);
  });
});
