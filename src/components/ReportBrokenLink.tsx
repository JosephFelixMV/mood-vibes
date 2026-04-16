import { useState, useEffect, useRef, useCallback } from "react";
import { Flag, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useRateLimitedAction } from "@/hooks/useRateLimitedAction";

interface ReportBrokenLinkProps {
  productId: string;
  variant?: "icon" | "full";
}

export default function ReportBrokenLink({ productId, variant = "icon" }: ReportBrokenLinkProps) {
  const [step, setStep] = useState<"idle" | "confirm" | "verifying" | "done">("idle");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const { trigger, cooldown } = useRateLimitedAction(5000);

  const { data: turnstileSiteKey } = useQuery({
    queryKey: ["turnstile-site-key"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "turnstile_site_key")
        .single();
      return data?.value || "";
    },
    staleTime: 1000 * 60 * 30,
  });

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const submitReport = useCallback(
    (turnstileToken: string) => {
      trigger(async () => {
        try {
          const { data, error } = await supabase.functions.invoke("report-product", {
            body: {
              product_id: productId,
              turnstile_token: turnstileToken || undefined,
              honeypot: honeypotRef.current?.value || undefined,
            },
          });
          if (error) throw error;
          setStep("done");
          toast.success(data?.message || "Thank you for your report!");
        } catch {
          setStep("confirm");
          toast.error("Failed to submit report. Please try again.");
        }
      });
    },
    [productId, trigger],
  );

  // Render visible Turnstile widget when entering the verification step
  useEffect(() => {
    if (step !== "verifying" || !turnstileContainerRef.current) return;

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      if (!turnstile || !turnstileContainerRef.current) return;

      // Reset any previous widget
      if (turnstileWidgetIdRef.current) {
        try { turnstile.remove(turnstileWidgetIdRef.current); } catch { /* noop */ }
      }

      turnstileWidgetIdRef.current = turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => submitReport(token),
        "error-callback": (errorCode?: string) => {
          // Mobile networks often trigger transient errors — let Turnstile auto-retry
          // instead of bouncing the user back. Only log for debugging.
          console.warn("Turnstile transient error:", errorCode);
        },
        "expired-callback": () => {
          toast.info("Verification expired — please try again.");
        },
        "timeout-callback": () => {
          toast.error("Verification timed out. Please try again.");
          setStep("confirm");
        },
        retry: "auto",
        "retry-interval": 2000,
        "refresh-expired": "auto",
        size: "normal",
        theme: "auto",
      });
    };

    // Load Turnstile script if not already present
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      // Script loaded but API may not be ready yet
      const waitForTurnstile = () => {
        if ((window as any).turnstile) {
          renderWidget();
        } else {
          setTimeout(waitForTurnstile, 100);
        }
      };
      waitForTurnstile();
    }

    return () => {
      if (turnstileWidgetIdRef.current) {
        try { (window as any).turnstile?.remove(turnstileWidgetIdRef.current); } catch { /* noop */ }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [step, turnstileSiteKey, submitReport]);

  // Fallback: if no Turnstile key configured, skip verification
  const handleConfirmClick = () => {
    if (turnstileSiteKey) {
      setStep("verifying");
    } else {
      submitReport("");
    }
  };

  // — Done state —
  if (step === "done") {
    return variant === "full" ? (
      <Button variant="ghost" size="sm" disabled className="gap-1.5 text-muted-foreground">
        <Flag className="h-3.5 w-3.5" /> Reported
      </Button>
    ) : (
      <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-muted-foreground" aria-label="Already reported">
        <Flag className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="relative inline-flex flex-col items-end gap-1.5">
      {/* Hidden honeypot field */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
      />

      {/* Step 1: Flag icon button */}
      {step === "idle" && (
        variant === "full" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep("confirm")}
            disabled={cooldown}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            title="Report a problem with this product"
          >
            <Flag className="h-3.5 w-3.5" /> Report Issue
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStep("confirm")}
            disabled={cooldown}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Report a problem with this product"
          >
            <Flag className="h-3.5 w-3.5" />
          </Button>
        )
      )}

      {/* Step 1b: Confirm intent */}
      {step === "confirm" && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Button
            variant="outline"
            size="sm"
            onClick={handleConfirmClick}
            disabled={cooldown}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
          >
            <Flag className="h-3 w-3" />
            Report Broken Link
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep("idle")}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Step 2: Turnstile verification */}
      {step === "verifying" && (
        <div className="flex flex-col items-center gap-2 animate-in fade-in duration-200 rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Quick verification</span>
          </div>
          <div ref={turnstileContainerRef} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep("confirm")}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
