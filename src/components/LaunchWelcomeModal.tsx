import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/contexts/RegionContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

const STORAGE_KEY = "mv_welcome_shown";

export default function LaunchWelcomeModal() {
  const { detected, loading } = useRegion();
  const { enabled: flagEnabled, loading: flagLoading } = useFeatureFlag("feature_welcome_modal");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (flagLoading || !flagEnabled) return;
    const params = new URLSearchParams(window.location.search);
    const forceShow = params.has("welcome_preview");
    const reset = params.has("welcome_reset");

    if (reset) {
      localStorage.removeItem(STORAGE_KEY);
    }

    const alreadySeen = localStorage.getItem(STORAGE_KEY);

    if (!alreadySeen || forceShow) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [loading, detected, flagEnabled, flagLoading]);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  if (!flagEnabled) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-[440px] p-0 overflow-hidden"
        style={{ borderRadius: "20px", border: "0.5px solid var(--border)" }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="p-8">
          {/* Icon + eyebrow + title — centred block */}
          <div className="flex flex-col items-center text-center mb-5">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-[22px] mb-4"
              style={{ background: "#EEEDFE" }}
            >
              ✦
            </div>
            <span
              className="inline-block text-[11px] font-medium tracking-[0.08em] uppercase px-2.5 py-1 rounded-full mb-3"
              style={{ color: "#534AB7", background: "#EEEDFE" }}
            >
              Proof of Concept.
            </span>
            <h2 className="text-xl font-medium leading-snug" style={{ color: "var(--foreground)" }}>
              Welcome to Mood and Vibes a POC I created to help people find products when they are not sure what exactly
              they are looking for.
            </h2>
          </div>

          {/* Body copy */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Embrace the occasional "variation" in our collections as we add new finds daily. See a way we can improve?
            Want to see a specific vibe? Let us know—we’re building this for you.
          </p>

          <Button className="w-full font-medium" style={{ background: "#534AB7", color: "#fff" }} onClick={handleClose}>
            Start exploring
          </Button>

          {/* Footnote */}
          <p className="text-[11.5px] text-muted-foreground text-center mt-3.5">You'll only see this once.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
