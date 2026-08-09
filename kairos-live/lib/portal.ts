import { Portal } from "@portalsdk/core";

// Publishable key — safe to expose in the browser bundle (Portal docs).
// Anonymous mode gives every visitor a stable identity with zero backend,
// which is exactly what KAIROS LIVE needs for a fast, auth-free MVP.
const apiKey = process.env.NEXT_PUBLIC_PORTAL_KEY ?? "";

export const portal = new Portal({ apiKey });

export function roomChannelId(code: string): string {
  return `kairos-room-${code.toUpperCase()}`;
}
