import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VisitorRegion } from "@/hooks/useVisitorRegion";
import { getRegionLabel } from "@/hooks/useVisitorRegion";

interface Props {
  region: VisitorRegion;
  detected: VisitorRegion;
  isOverridden: boolean;
  onSelect: (region: VisitorRegion) => void;
  onReset: () => void;
}

const ALL_REGIONS: VisitorRegion[] = ["US", "CA", "Intl"];

const REGION_DESCRIPTIONS: Record<VisitorRegion, string> = {
  US: "Showing products available in USA",
  CA: "Showing products available in Canada",
  Intl: "Showing internationally available products",
};

export default function RegionIndicator({ region, detected, isOverridden, onSelect, onReset }: Props) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Region: {getRegionLabel(region)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {REGION_DESCRIPTIONS[region]}
          </p>
          <div className="my-1 h-px bg-border" />
          {ALL_REGIONS.map((r) => (
            <DropdownMenuItem
              key={r}
              onClick={() => onSelect(r)}
              className={r === region ? "font-semibold text-primary" : ""}
            >
              {getRegionLabel(r)}
              {r === detected && !isOverridden && (
                <span className="ml-auto text-[10px] text-muted-foreground">auto-detected</span>
              )}
              {r === region && isOverridden && (
                <span className="ml-auto text-[10px] text-muted-foreground">selected</span>
              )}
            </DropdownMenuItem>
          ))}
          {isOverridden && (
            <>
              <div className="my-1 h-px bg-border" />
              <DropdownMenuItem onClick={onReset} className="text-xs text-muted-foreground">
                Reset to auto-detected ({getRegionLabel(detected)})
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
