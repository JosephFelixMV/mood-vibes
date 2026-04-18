export interface DiscoveryContext {
  type: "category" | "vibe" | "mood" | "all";
  slug: string;
  name: string;
}

const KEY = "discovery_context";

export function setDiscoveryContext(ctx: DiscoveryContext) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {}
}

export function getDiscoveryContext(): DiscoveryContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
