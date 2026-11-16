import type { BowlingSet, Format, PhaseScope } from "../engine/resolve";
import type { BatterType, Family, Hand, PaceBand, SpinType, Swing } from "../engine/types";

export type Role = "admin" | "coach" | "captain" | "player";

export interface Player {
  id: string;
  name: string;
  battingHand: Hand;
  battingType?: BatterType;
  bowls: boolean;
  bowlArm?: Hand;
  bowlFamily?: Family;
  paceBand?: PaceBand;
  swing?: Swing;
  spinType?: SpinType;
  keeperUp?: boolean;
  active: boolean;
}

export interface Member {
  userId: string;
  displayName: string;
  role: Role;
}

export interface Invite {
  id: string;
  code: string;
  role: Role;
  expiresAt: string;
  used: boolean;
}

export interface Session {
  userId: string;
  email: string;
  /** null until the user creates or joins a club */
  membership: { clubId: string; clubName: string; role: Role; displayName: string } | null;
}

export interface Store {
  readonly mode: "demo" | "supabase";
  getSession(): Promise<Session | null>;
  onAuthChange(cb: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** returns true when the account needs email confirmation before first sign-in */
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  createClub(clubName: string, displayName: string): Promise<void>;
  claimInvite(code: string, displayName: string): Promise<void>;

  listPlayers(): Promise<Player[]>;
  savePlayer(p: Omit<Player, "id"> & { id?: string }): Promise<Player>;
  listBowlingData(): Promise<BowlingSet[]>;
  saveBowlingSet(set: BowlingSet): Promise<void>;
  deleteBowlingSet(playerId: string, format: Format, scope: PhaseScope): Promise<void>;

  listMembers(): Promise<Member[]>;
  listInvites(): Promise<Invite[]>;
  createInvite(role: Role): Promise<Invite>;
  revokeInvite(id: string): Promise<void>;
  setMemberRole(userId: string, role: Role): Promise<void>;
  removeMember(userId: string): Promise<void>;
  renameClub(name: string): Promise<void>;
}

export const canEditPlayers = (role: Role | undefined) => role === "admin" || role === "coach";
