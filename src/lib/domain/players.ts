import type { PlayerRecord } from "./types";

export const NAME_MAX_LENGTH = 100;
export const NUMBER_MAX_LENGTH = 10;

/** Trim and collapse internal whitespace. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Key used for duplicate detection: case-insensitive, trimmed. */
export function nameKey(name: string): string {
  return normaliseName(name).toLocaleLowerCase("en-AU");
}

export function validateName(name: string): string | null {
  const n = normaliseName(name);
  if (n.length === 0) return "Name is required";
  if (n.length > NAME_MAX_LENGTH) return `Name must be ${NAME_MAX_LENGTH} characters or fewer`;
  return null;
}

/** Blank numbers become null; otherwise trimmed text (keeps "07"). */
export function normaliseNumber(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
}

export function validateNumber(value: string | null): string | null {
  if (value !== null && value.length > NUMBER_MAX_LENGTH)
    return `Player number must be ${NUMBER_MAX_LENGTH} characters or fewer`;
  return null;
}

const collator = new Intl.Collator("en-AU", { numeric: true, sensitivity: "base" });

/**
 * Sort by player number (natural: 2 before 10, "07" as 7), then name.
 * Players with no number sort after numbered players.
 */
export function comparePlayers(
  a: Pick<PlayerRecord, "name" | "player_number">,
  b: Pick<PlayerRecord, "name" | "player_number">,
): number {
  const an = a.player_number;
  const bn = b.player_number;
  if (an !== null && bn === null) return -1;
  if (an === null && bn !== null) return 1;
  if (an !== null && bn !== null) {
    const byNumber = collator.compare(an, bn);
    if (byNumber !== 0) return byNumber;
  }
  const byName = collator.compare(a.name, b.name);
  if (byName !== 0) return byName;
  return (an ?? "").localeCompare(bn ?? "");
}

export type PlayerFilter = "active" | "inactive" | "all";

export function filterPlayers<T extends Pick<PlayerRecord, "name" | "player_number" | "is_active">>(
  players: T[],
  filter: PlayerFilter,
  search: string,
): T[] {
  const q = search.trim().toLocaleLowerCase("en-AU");
  return players
    .filter((p) => filter === "all" || (filter === "active" ? p.is_active : !p.is_active))
    .filter(
      (p) =>
        q === "" ||
        p.name.toLocaleLowerCase("en-AU").includes(q) ||
        (p.player_number ?? "").toLocaleLowerCase("en-AU") === q,
    )
    .sort(comparePlayers);
}
