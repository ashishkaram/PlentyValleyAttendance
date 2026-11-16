import { DemoStore } from "./demo";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** With no Supabase settings the app runs in demo mode: no login, data in this browser. */
export const store: Store = url && key ? new SupabaseStore(url, key) : new DemoStore();
export * from "./types";
