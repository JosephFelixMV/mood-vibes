import { createContext, useContext } from "react";
import { useVisitorRegion, type VisitorRegion } from "@/hooks/useVisitorRegion";

interface RegionContextValue {
  region: VisitorRegion;
  detected: VisitorRegion;
  isOverridden: boolean;
  loading: boolean;
  setRegion: (r: VisitorRegion) => void;
  clearOverride: () => void;
}

const RegionContext = createContext<RegionContextValue>({
  region: "US",
  detected: "US",
  isOverridden: false,
  loading: false,
  setRegion: () => {},
  clearOverride: () => {},
});

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const value = useVisitorRegion();
  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion() {
  return useContext(RegionContext);
}
