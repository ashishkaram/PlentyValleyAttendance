import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BowlingSet, Format, PhaseScope } from "../engine/resolve";
import type { Invite, Member, Player, Role, Session, Store } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toPlayer = (r: Row): Player => ({
  id: r.id,
  name: r.name,
  battingHand: r.batting_hand,
  battingType: r.batting_type ?? undefined,
  bowls: r.bowls,
  bowlArm: r.bowl_arm ?? undefined,
  bowlFamily: r.bowl_family ?? undefined,
  paceBand: r.pace_band ?? undefined,
  swing: r.swing_shape ?? undefined,
  spinType: r.spin_type ?? undefined,
  keeperUp: r.keeper_up ?? undefined,
  active: r.active,
});

const toSet = (r: Row): BowlingSet => ({
  playerId: r.player_id,
  format: r.format,
  scope: r.phase_scope,
  line:
    r.line_off === null
      ? undefined
      : { outsideOff: r.line_outside_off, off: r.line_off, middle: r.line_middle, leg: r.line_leg, outsideLeg: r.line_outside_leg },
  length: r.len_good === null ? undefined : { short: r.len_short, good: r.len_good, full: r.len_full },
  ballsSampled: r.balls_sampled ?? undefined,
  sourceNote: r.source_note ?? undefined,
});

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export class SupabaseStore implements Store {
  readonly mode = "supabase" as const;
  private db: SupabaseClient;
  private clubId: string | null = null;

  constructor(url: string, key: string) {
    this.db = createClient(url, key);
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.db.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const { data: profile, error } = await this.db
      .from("profiles")
      .select("club_id, role, display_name, clubs(name)")
      .eq("user_id", user.id)
      .maybeSingle();
    fail(error);
    this.clubId = profile?.club_id ?? null;
    return {
      userId: user.id,
      email: user.email ?? "",
      membership: profile
        ? {
            clubId: profile.club_id,
            clubName: (profile as Row).clubs?.name ?? "",
            role: profile.role as Role,
            displayName: profile.display_name,
          }
        : null,
    };
  }

  onAuthChange(cb: () => void) {
    const { data } = this.db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "PASSWORD_RECOVERY" || event === "USER_UPDATED") cb();
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { error } = await this.db.auth.signInWithPassword({ email, password });
    fail(error);
  }
  async signUp(email: string, password: string) {
    const { data, error } = await this.db.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href },
    });
    fail(error);
    return !data.session;
  }
  async signOut() {
    const { error } = await this.db.auth.signOut();
    fail(error);
  }
  async requestPasswordReset(email: string) {
    const { error } = await this.db.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}?reset=1`,
    });
    fail(error);
  }
  async updatePassword(password: string) {
    const { error } = await this.db.auth.updateUser({ password });
    fail(error);
  }
  async createClub(clubName: string, displayName: string) {
    const { error } = await this.db.rpc("create_club", { club_name: clubName, display_name: displayName });
    fail(error);
  }
  async claimInvite(code: string, displayName: string) {
    const { error } = await this.db.rpc("claim_invite", { invite_code: code, display_name: displayName });
    fail(error);
  }

  async listPlayers() {
    const { data, error } = await this.db.from("players").select("*").order("name");
    fail(error);
    return (data ?? []).map(toPlayer);
  }
  async savePlayer(p: Omit<Player, "id"> & { id?: string }) {
    const bowls = p.bowls;
    const row = {
      club_id: this.clubId,
      name: p.name.trim(),
      batting_hand: p.battingHand,
      batting_type: p.battingType ?? null,
      bowls,
      bowl_arm: bowls ? p.bowlArm : null,
      bowl_family: bowls ? p.bowlFamily : null,
      pace_band: bowls && p.bowlFamily === "pace" ? p.paceBand : null,
      swing_shape: bowls && p.bowlFamily === "pace" ? (p.swing ?? "none") : null,
      spin_type: bowls && p.bowlFamily === "spin" ? p.spinType : null,
      keeper_up: bowls ? (p.keeperUp ?? null) : null,
      active: p.active,
    };
    const q = p.id ? this.db.from("players").update(row).eq("id", p.id) : this.db.from("players").insert(row);
    const { data, error } = await q.select().single();
    fail(error);
    return toPlayer(data);
  }
  async listBowlingData() {
    const { data, error } = await this.db.from("player_bowling_data").select("*");
    fail(error);
    return (data ?? []).map(toSet);
  }
  async saveBowlingSet(s: BowlingSet) {
    const { error } = await this.db.from("player_bowling_data").upsert({
      player_id: s.playerId,
      club_id: this.clubId,
      format: s.format,
      phase_scope: s.scope,
      line_outside_off: s.line?.outsideOff ?? null,
      line_off: s.line?.off ?? null,
      line_middle: s.line?.middle ?? null,
      line_leg: s.line?.leg ?? null,
      line_outside_leg: s.line?.outsideLeg ?? null,
      len_short: s.length?.short ?? null,
      len_good: s.length?.good ?? null,
      len_full: s.length?.full ?? null,
      balls_sampled: s.ballsSampled ?? null,
      source_note: s.sourceNote ?? null,
    });
    fail(error);
  }
  async deleteBowlingSet(playerId: string, format: Format, scope: PhaseScope) {
    const { error } = await this.db
      .from("player_bowling_data")
      .delete()
      .match({ player_id: playerId, format, phase_scope: scope });
    fail(error);
  }

  async listMembers(): Promise<Member[]> {
    const { data, error } = await this.db.from("profiles").select("user_id, display_name, role").order("display_name");
    fail(error);
    return (data ?? []).map((r) => ({ userId: r.user_id, displayName: r.display_name, role: r.role as Role }));
  }
  async listInvites(): Promise<Invite[]> {
    const { data, error } = await this.db.rpc("list_invites");
    fail(error);
    return ((data as Row[]) ?? []).map((r) => ({ id: r.id, code: r.code, role: r.role, expiresAt: r.expires_at, used: r.used }));
  }
  async createInvite(role: Role): Promise<Invite> {
    const { data, error } = await this.db.rpc("create_invite", { invite_role: role });
    fail(error);
    const r = (data as Row[])[0];
    return { id: r.id, code: r.code, role: r.role, expiresAt: r.expires_at, used: false };
  }
  async revokeInvite(id: string) {
    const { error } = await this.db.rpc("revoke_invite", { invite_id: id });
    fail(error);
  }
  async setMemberRole(userId: string, role: Role) {
    const { error } = await this.db.rpc("set_member_role", { member: userId, new_role: role });
    fail(error);
  }
  async removeMember(userId: string) {
    const { error } = await this.db.rpc("remove_member", { member: userId });
    fail(error);
  }
  async renameClub(name: string) {
    const { error } = await this.db.rpc("rename_club", { new_name: name });
    fail(error);
  }
}
