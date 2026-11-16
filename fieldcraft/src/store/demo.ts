import type { BowlingSet, Format, PhaseScope } from "../engine/resolve";
import type { Invite, Member, Player, Role, Session, Store } from "./types";

const KEY = "fieldcraft-demo-v2";

interface Data {
  clubName: string;
  players: Player[];
  bowling: BowlingSet[];
}

const SEED: Data = {
  clubName: "Demo Club",
  players: [
    { id: "d1", name: "Meg", battingHand: "R", battingType: "accumulator", bowls: true, bowlArm: "R", bowlFamily: "pace", paceBand: "fast-medium", swing: "out", keeperUp: false, active: true },
    { id: "d2", name: "Priya", battingHand: "R", battingType: "technical", bowls: true, bowlArm: "R", bowlFamily: "spin", spinType: "off", keeperUp: true, active: true },
    { id: "d3", name: "Tess", battingHand: "L", battingType: "aggressive", bowls: true, bowlArm: "L", bowlFamily: "pace", paceBand: "medium", swing: "none", keeperUp: true, active: true },
    { id: "d4", name: "Asha", battingHand: "R", battingType: "finisher", bowls: true, bowlArm: "R", bowlFamily: "spin", spinType: "leg", keeperUp: true, active: true },
  ],
  bowling: [
    { playerId: "d1", format: "t20", scope: "overall", line: { outsideOff: 38, off: 24, middle: 20, leg: 10, outsideLeg: 8 }, length: { short: 20, good: 58, full: 22 }, ballsSampled: 180 },
    { playerId: "d1", format: "t20", scope: "death", line: { outsideOff: 20, off: 25, middle: 30, leg: 15, outsideLeg: 10 }, length: { short: 15, good: 30, full: 55 }, ballsSampled: 48 },
    { playerId: "d2", format: "oneday", scope: "overall", line: { outsideOff: 15, off: 30, middle: 35, leg: 15, outsideLeg: 5 }, length: { short: 12, good: 60, full: 28 }, ballsSampled: 240 },
    { playerId: "d3", format: "t20", scope: "overall", line: { outsideOff: 12, off: 20, middle: 30, leg: 22, outsideLeg: 16 }, ballsSampled: 24 },
  ],
};

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Data;
  } catch {
    /* storage unavailable: fall through to the seed */
  }
  return structuredClone(SEED);
}

/** No backend: one pretend Admin, data kept in this browser only. */
export class DemoStore implements Store {
  readonly mode = "demo" as const;
  private data = load();

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* keep working in memory */
    }
  }

  async getSession(): Promise<Session> {
    return {
      userId: "demo",
      email: "demo@example.com",
      membership: { clubId: "demo", clubName: this.data.clubName, role: "admin", displayName: "Demo Admin" },
    };
  }
  onAuthChange() {
    return () => {};
  }
  async signIn() {}
  async signUp() {
    return false;
  }
  async signOut() {}
  async requestPasswordReset() {}
  async updatePassword() {}
  async createClub() {}
  async claimInvite() {}

  async listPlayers() {
    return structuredClone(this.data.players);
  }
  async savePlayer(p: Omit<Player, "id"> & { id?: string }) {
    const player: Player = { ...p, id: p.id ?? crypto.randomUUID() };
    const i = this.data.players.findIndex((x) => x.id === player.id);
    if (i >= 0) this.data.players[i] = player;
    else this.data.players.push(player);
    this.persist();
    return player;
  }
  async listBowlingData() {
    return structuredClone(this.data.bowling);
  }
  async saveBowlingSet(set: BowlingSet) {
    this.data.bowling = this.data.bowling.filter(
      (s) => !(s.playerId === set.playerId && s.format === set.format && s.scope === set.scope),
    );
    this.data.bowling.push(set);
    this.persist();
  }
  async deleteBowlingSet(playerId: string, format: Format, scope: PhaseScope) {
    this.data.bowling = this.data.bowling.filter(
      (s) => !(s.playerId === playerId && s.format === format && s.scope === scope),
    );
    this.persist();
  }

  async listMembers(): Promise<Member[]> {
    return [{ userId: "demo", displayName: "Demo Admin", role: "admin" }];
  }
  async listInvites(): Promise<Invite[]> {
    return [];
  }
  async createInvite(_role: Role): Promise<Invite> {
    throw new Error("Invites need the real backend. Connect Supabase to use them.");
  }
  async revokeInvite() {}
  async setMemberRole() {}
  async removeMember() {}
  async renameClub(name: string) {
    this.data.clubName = name;
    this.persist();
  }
}
