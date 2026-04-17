import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/contexts/RegionContext";

const STORAGE_KEY = "mv_welcome_shown";

export default function LaunchWelcomeModal() {
  const { detected, loading } = useRegion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
		if (loading) return;
		  const alreadySeen = localStorage.getItem(STORAGE_KEY);
		  const forceShow = new URLSearchParams(window.location.search).has("welcome_preview");

	  if (!alreadySeen && (detected === "US" || forceShow)) {
		const t = setTimeout(() => setOpen(true), 1200);
		return () => clearTimeout(t);
    }
  }, [loading, detected]);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
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
              Early access
            </span>
            <h2
              className="text-xl font-medium leading-snug"
              style={{ color: "var(--foreground)" }}
            >
              Welcome to Mood and Vibes
            </h2>
          </div>

          {/* Body copy */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            This is an early proof of concept — the collection is growing and
            the experience is evolving. I built this to make product discovery
            feel more intuitive and inspired.
          </p>

          <Button
            className="w-full font-medium"
            style={{ background: "#534AB7", color: "#fff" }}
            onClick={handleClose}
          >
            Start exploring
          </Button>

          {/* Footnote */}
          <p className="text-[11.5px] text-muted-foreground text-center mt-3.5">
            You'll only see this once.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
