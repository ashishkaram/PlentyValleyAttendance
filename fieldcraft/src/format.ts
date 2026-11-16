import type { Format } from "./engine/resolve";

/** Which instance this build is: set VITE_FORMAT=oneday for the One-Day app. */
export const FORMAT: Format = import.meta.env.VITE_FORMAT === "oneday" ? "oneday" : "t20";
export const OTHER_FORMAT: Format = FORMAT === "t20" ? "oneday" : "t20";
