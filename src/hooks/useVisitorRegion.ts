import { useState, useEffect, useCallback } from "react";

export type VisitorRegion = "US" | "CA" | "Intl";

const STORAGE_KEY = "visitor_region";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredRegion {
  region: VisitorRegion;
  timestamp: number;
}

function getStored(): StoredRegion | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredRegion = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function store(region: VisitorRegion) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ region, timestamp: Date.now() }));
}

const OVERRIDE_KEY = "visitor_region_override";

function getOverride(): VisitorRegion | null {
  try {
    return localStorage.getItem(OVERRIDE_KEY) as VisitorRegion | null;
  } catch {
    return null;
  }
}

function setOverride(region: VisitorRegion | null) {
  if (region) {
    localStorage.setItem(OVERRIDE_KEY, region);
  } else {
    localStorage.removeItem(OVERRIDE_KEY);
  }
}

const REGION_LABELS: Record<VisitorRegion, string> = {
  US: "🇺🇸 USA",
  CA: "🇨🇦 Canada",
  Intl: "🌍 International",
};

export function getRegionLabel(region: VisitorRegion) {
  return REGION_LABELS[region] || region;
}

export function useVisitorRegion() {
  const [detected, setDetected] = useState<VisitorRegion>(
    () => getStored()?.region || "US"
  );
  const [override, setOverrideState] = useState<VisitorRegion | null>(
    () => getOverride()
  );
  const [loading, setLoading] = useState(!getStored());

  useEffect(() => {
    const existing = getStored();
    if (existing) {
      setDetected(existing.region);
      setLoading(false);
      return;
    }

    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((data) => {
        const country = (data.country_code || "").toUpperCase();
        let region: VisitorRegion = "Intl";
        if (country === "US") region = "US";
        else if (country === "CA") region = "CA";
        store(region);
        setDetected(region);
      })
      .catch(() => {
        // Default to US as the primary target market
        store("US");
        setDetected("US");
      })
      .finally(() => setLoading(false));
  }, []);

  const activeRegion: VisitorRegion = override || detected;

  const setRegion = useCallback((r: VisitorRegion) => {
    setOverrideState(r);
    setOverride(r);
  }, []);

  const clearOverride = useCallback(() => {
    setOverrideState(null);
    setOverride(null);
  }, []);

  return {
    region: activeRegion,
    detected,
    isOverridden: !!override,
    loading,
    setRegion,
    clearOverride,
  };
}
