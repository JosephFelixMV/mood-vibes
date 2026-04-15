import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { VisitorRegion } from "@/hooks/useVisitorRegion";

const DISMISSED_KEY = "region_notice_dismissed";

export function wasRegionNoticeDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRegionNoticeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {}
}

interface Props {
  open: boolean;
  onContinueUS: () => void;
  onDismiss: () => void;
}

export default function RegionNoticeDialog({ open, onContinueUS, onDismiss }: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md border-border bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-lg">
            Notice: This site is currently optimized for US shoppers.
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Products and affiliate links on Mood &amp; Vibes are curated with the US shopper
            experience in mind. Shipping to Canada and other regions is not guaranteed. By
            continuing, you acknowledge that fulfillment, pricing, and availability are subject to
            each retailer's own policies.
            <br />
            <br />
            <span className="italic">
              Canadian and international affiliate options are coming soon.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            onClick={onContinueUS}
            className="w-full sm:w-auto"
            style={{
              background: "linear-gradient(135deg, #121212 0%, #3F3F46 100%)",
              border: "1.5px solid rgba(217,115,43,0.5)",
              color: "#fff",
            }}
          >
            Continue to US Experience
          </Button>
          <Button
            variant="outline"
            onClick={onDismiss}
            className="w-full border-border text-muted-foreground hover:text-foreground sm:w-auto"
          >
            Dismiss
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
